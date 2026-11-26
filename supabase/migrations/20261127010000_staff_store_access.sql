begin;

-- Apply the contract end date to new PIN logins and already-issued sessions.
do $$
declare
  signature regprocedure;
  definition text;
  marker constant text := 'and employee.deleted_at is null';
begin
  foreach signature in array array[
    'public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure,
    'private.current_staff_kiosk_session_id()'::regprocedure
  ] loop
    definition := pg_get_functiondef(signature);
    if strpos(definition, marker) = 0 then
      raise exception 'Could not apply contract expiry to %', signature;
    end if;
    execute replace(definition, marker, marker ||
      ' and (employee.contract_end_date is null or employee.contract_end_date >= (now() at time zone ''Asia/Ho_Chi_Minh'')::date)');
  end loop;
end $$;

create or replace function public.staff_kiosk_touch_session(p_actor_user_id uuid, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update private.staff_kiosk_operator_sessions s
  set last_activity_at = now()
  from public.staff_employee_profiles e
  where s.auth_user_id = p_actor_user_id and s.token_hash = p_token_hash
    and s.revoked_at is null and s.last_activity_at > now() - interval '5 minutes' and s.expires_at > now()
    and e.profile_id = s.operator_profile_id and e.active and e.deleted_at is null
    and (e.contract_end_date is null or e.contract_end_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date);
  get diagnostics updated = row_count;
  return updated = 1;
end;
$$;

create function public.staff_save_store_access(
  actor_id uuid, employee_id uuid, employee_name text, contract_end date,
  access_level text, venues text[], new_pin text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee public.staff_employee_profiles;
  target_id uuid := coalesce(employee_id, gen_random_uuid());
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' or not exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = actor_id and p.deleted_at is null
      and lower(u.email) <> 'contact@vre-vietnam.com'
      and public.staff_role_rank(p.role, u.email) >= 100
  ) then
    raise exception 'Administrator access required.';
  end if;

  if nullif(btrim(employee_name), '') is null or length(employee_name) > 120
     or access_level is null or access_level not in ('manager', 'staff')
     or (new_pin is not null and new_pin !~ '^[0-9]{6}$') then
    raise exception 'Check the name, access level and PIN.';
  end if;
  if venues is null or exists (
    select 1 from unnest(venues) v where not exists (
      select 1 from public.staff_locations l where l.venue_key = v and l.active
    )
  ) then
    raise exception 'Choose valid stores.';
  end if;

  if employee_id is null then
    insert into public.staff_employee_profiles(profile_id, legal_name, department, contract_end_date, created_by)
    values (target_id, btrim(employee_name), 'VRena', contract_end, actor_id);
  else
    select * into employee from public.staff_employee_profiles p
    where p.profile_id = target_id and p.active and p.deleted_at is null
      and lower(btrim(coalesce(p.department, ''))) not in ('gc', 'gong cha')
    for update;
    if not found then
      raise exception 'Active employee not found.';
    end if;
    if employee.kiosk_staff_access_granted and access_level <> 'staff' then
      raise exception 'This employee is limited to Staff store access.';
    end if;
    update public.staff_employee_profiles
    set legal_name = btrim(employee_name), contract_end_date = contract_end
    where profile_id = target_id;
    if not private.staff_kiosk_department_is_eligible(employee.department)
       and not employee.kiosk_staff_access_granted and new_pin is not null then
      if access_level = 'manager' then
        raise exception 'This employee is limited to Staff store access.';
      end if;
      update public.staff_employee_profiles set kiosk_staff_access_granted = true where profile_id = target_id;
    end if;
  end if;

  if new_pin is not null then
    -- Serialize duplicate checks for the store-access form.
    perform pg_advisory_xact_lock(314509710);
    perform public.staff_kiosk_configure_pin(actor_id, actor_id, null, target_id, new_pin, access_level);
  elsif employee.kiosk_pin_configured_at is not null then
    if employee.kiosk_access_role is distinct from access_level then
      update private.staff_kiosk_pin_credentials
      set access_role = access_level where profile_id = target_id;
      update private.staff_kiosk_operator_sessions
      set revoked_at = now(), revoked_reason = 'access_level_changed'
      where operator_profile_id = target_id and revoked_at is null;
    end if;
  else
    if employee_id is null then
      raise exception 'A new employee needs a six-digit PIN.';
    end if;
  end if;

  if new_pin is not null or employee.kiosk_pin_configured_at is not null then
    update public.staff_employee_profiles set kiosk_access_role = access_level where profile_id = target_id;
  end if;
  delete from public.staff_employee_locations where profile_id = target_id and not (venue_key = any(venues));
  insert into public.staff_employee_locations(profile_id, venue_key)
    select target_id, v from unnest(venues) v on conflict do nothing;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, new_value)
    values (actor_id, 'staff_store_access_saved', 'staff_employee_profiles', target_id,
      jsonb_build_object('contract_end_date', contract_end, 'access_level', access_level, 'venue_keys', venues));
  return target_id;
end;
$$;

revoke all on function public.staff_save_store_access(uuid,uuid,text,date,text,text[],text) from public, anon, authenticated;
grant execute on function public.staff_save_store_access(uuid,uuid,text,date,text,text[],text) to service_role;

notify pgrst, 'reload schema';

commit;
