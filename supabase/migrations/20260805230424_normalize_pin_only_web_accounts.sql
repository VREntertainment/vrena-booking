begin;

-- Employee identities now live exclusively in staff_employee_profiles. The
-- only auth-backed profile that remains PIN-only is the shared store login.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_new_role text := lower(nullif(btrim(coalesce(new.role, 'player')), ''));
  v_old_role text := case
    when tg_op = 'UPDATE' then lower(nullif(btrim(coalesce(old.role, 'player')), ''))
    else null
  end;
  v_actor_rank integer := public.current_staff_role_rank();
  v_is_service_role boolean := coalesce(auth.role(), '') = 'service_role';
  v_is_hr_record_only boolean := coalesce(new.is_hr_record_only, false);
  v_is_shared_kiosk boolean := lower(coalesce(new.email, '')) = 'contact@vre-vietnam.com';
begin
  if v_new_role is null then
    v_new_role := 'player';
  end if;

  if v_new_role = 'super_admin' then
    v_new_role := 'owner';
  end if;

  if v_old_role = 'super_admin' then
    v_old_role := 'owner';
  end if;

  if v_new_role not in ('owner', 'admin', 'cashier', 'viewer', 'player', 'employee') then
    raise exception 'Invalid profile role.';
  end if;

  if v_is_hr_record_only then
    new.role := 'employee';
    return new;
  end if;

  if v_is_shared_kiosk then
    new.role := 'employee';
    return new;
  end if;

  -- The Employee role is no longer assignable to normal web accounts. Ignore
  -- spoofed signup metadata and reject later attempts to restore the old role.
  if v_new_role = 'employee' then
    if tg_op = 'INSERT' then
      new.role := 'player';
      return new;
    end if;
    raise exception 'Employee PIN access is reserved for the shared store account.';
  end if;

  if tg_op = 'INSERT' then
    if v_new_role <> 'player' and not v_is_service_role and v_actor_rank < 100 then
      new.role := 'player';
    else
      new.role := v_new_role;
    end if;
    return new;
  end if;

  if v_new_role is distinct from v_old_role
    and not v_is_service_role
    and v_actor_rank < 100
  then
    raise exception 'Admin access required to change profile roles.';
  end if;

  new.role := v_new_role;
  return new;
end;
$$;

create or replace function public.set_staff_profile_role(
  p_profile_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_rank integer := public.current_staff_role_rank();
  v_old_role text;
  v_new_role text := lower(nullif(btrim(coalesce(p_role, '')), ''));
  v_saved_role text;
  v_target_email text;
  v_is_hr_record_only boolean;
begin
  if v_actor is null or v_actor_rank < 100 then
    raise exception 'Admin access required.';
  end if;

  if to_regprocedure('public.consume_rate_limit(text, integer, integer, text)') is not null then
    perform public.consume_rate_limit('admin_destructive', 3, 60, 'role:' || p_profile_id::text);
  end if;

  if p_profile_id is null then
    raise exception 'Profile id is required.';
  end if;

  if v_new_role = 'super_admin' then
    v_new_role := 'owner';
  end if;

  if v_new_role not in ('owner', 'admin', 'cashier', 'viewer', 'player') then
    raise exception 'Invalid web-app role.';
  end if;

  select role, lower(email), coalesce(is_hr_record_only, false)
  into v_old_role, v_target_email, v_is_hr_record_only
  from public.profiles
  where id = p_profile_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if v_is_hr_record_only then
    raise exception 'Employee HR identities do not have an assignable web-app role.';
  end if;

  if v_target_email = 'contact@vre-vietnam.com' then
    raise exception 'The shared store account must keep Employee PIN access.';
  end if;

  if (v_new_role = 'owner' or lower(coalesce(v_old_role, '')) in ('super_admin', 'owner'))
    and v_actor_rank < 120
  then
    raise exception 'Owner access required.';
  end if;

  update public.profiles
  set role = v_new_role,
      updated_at = now()
  where id = p_profile_id
    and deleted_at is null
  returning role into v_saved_role;

  if v_saved_role is distinct from v_new_role then
    raise exception 'Role update failed.';
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      v_actor,
      'role_updated',
      'profile',
      p_profile_id,
      jsonb_build_object('role', v_old_role),
      jsonb_build_object('role', v_saved_role)
    );
  end if;

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'old_role', v_old_role,
    'role', v_saved_role
  );
end;
$$;

-- Migration writes pass through the existing sensitive-field trigger as the
-- service role. No auth account or employee record is created or deleted.
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update public.profiles as profiles
set role = 'player',
    updated_at = now()
from auth.users as users
where users.id = profiles.id
  and profiles.deleted_at is null
  and lower(users.email) <> 'contact@vre-vietnam.com'
  and lower(coalesce(profiles.role, '')) in ('employee', 'manager', 'staff');

update public.profiles as profiles
set role = 'employee',
    updated_at = now()
from auth.users as users
where users.id = profiles.id
  and profiles.deleted_at is null
  and lower(users.email) = 'contact@vre-vietnam.com'
  and lower(coalesce(profiles.role, '')) <> 'employee';

revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.set_staff_profile_role(uuid, text) from public, anon;
grant execute on function public.set_staff_profile_role(uuid, text) to authenticated, service_role;

comment on column public.profiles.role is
  'Authenticated web-app role. Employee is reserved for the contact@vre-vietnam.com shared store account; staff permissions come from employee PIN sessions.';

notify pgrst, 'reload schema';

commit;
