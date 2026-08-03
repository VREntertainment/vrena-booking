begin;

-- The shared store account is a kiosk transport identity, never an admin.
-- Its effective role comes only from a valid employee PIN session.
create or replace function public.staff_role_rank(p_role text, p_email text default null)
returns integer
language sql
stable
set search_path = pg_catalog
as $$
  select case
    when lower(coalesce(p_email, '')) = 'emilejacquet@icloud.com' then 120
    when lower(coalesce(p_email, '')) = 'emile@vre-vietnam.com' then 100
    when lower(coalesce(p_role, '')) in ('super_admin', 'owner') then 120
    when lower(coalesce(p_role, '')) = 'admin' then 100
    when lower(coalesce(p_role, '')) = 'manager' then 80
    when lower(coalesce(p_role, '')) = 'staff' then 50
    when lower(coalesce(p_role, '')) in ('cashier', 'viewer') then 20
    else 0
  end;
$$;

-- For the kiosk account, the account password plus the employee PIN replaces
-- personal TOTP. This helper still requires the exact shared auth account, a
-- live unrevoked token, an active HR file, and a matching credential role.
create or replace function private.current_staff_kiosk_session_id()
returns uuid
language sql
security definer
stable
set search_path = pg_catalog, public, private
as $$
  select session.id
  from private.staff_kiosk_operator_sessions as session
  join private.staff_kiosk_pin_credentials as credential
    on credential.profile_id = session.operator_profile_id
  join public.staff_employee_profiles as employee
    on employee.profile_id = session.operator_profile_id
  join auth.users as shared_user
    on shared_user.id = session.auth_user_id
  where session.auth_user_id = (select auth.uid())
    and lower(shared_user.email) = 'contact@vre-vietnam.com'
    and session.token_hash = private.staff_kiosk_request_token_hash()
    and session.revoked_at is null
    and session.last_activity_at > now() - interval '5 minutes'
    and session.expires_at > now()
    and employee.active = true
    and employee.deleted_at is null
    and credential.access_role = session.access_role
  order by session.last_activity_at desc
  limit 1
$$;

-- Employee PINs can only be created or replaced by an individually signed-in
-- Owner/Admin. A manager PIN on the shared store account cannot call this path.
create or replace function public.staff_kiosk_configure_pin(
  p_actor_user_id uuid,
  p_actor_profile_id uuid,
  p_operator_token_hash text,
  p_profile_id uuid,
  p_pin text,
  p_access_role text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_email text;
  v_actor_role text;
  v_actor_rank integer;
  v_duplicate_profile uuid;
  v_target_name text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_pin !~ '^\d{4}$' then
    raise exception 'PIN must contain exactly four digits.';
  end if;
  if p_access_role not in ('manager', 'staff') then
    raise exception 'Choose Manager or Staff access.';
  end if;

  select lower(users.email), profiles.role
  into v_actor_email, v_actor_role
  from auth.users as users
  left join public.profiles as profiles
    on profiles.id = users.id
   and profiles.deleted_at is null
  where users.id = p_actor_user_id;

  if v_actor_email is null then
    raise exception 'Staff session required.';
  end if;
  if v_actor_email = 'contact@vre-vietnam.com' then
    raise exception 'Sign in with an individual Owner or Admin account to manage employee PINs.';
  end if;
  if p_actor_profile_id is distinct from p_actor_user_id then
    raise exception 'The PIN administrator identity is invalid.';
  end if;

  v_actor_rank := public.staff_role_rank(v_actor_role, v_actor_email);
  if v_actor_rank < 100 then
    raise exception 'Administrator access required.';
  end if;

  select coalesce(employee.legal_name, profiles.full_name, profiles.nickname, employee.employee_code, 'Employee')
  into v_target_name
  from public.staff_employee_profiles as employee
  join public.profiles as profiles on profiles.id = employee.profile_id
  where employee.profile_id = p_profile_id
    and employee.active = true
    and employee.deleted_at is null;

  if v_target_name is null then
    raise exception 'Choose an active employee HR file.';
  end if;

  select credential.profile_id
  into v_duplicate_profile
  from private.staff_kiosk_pin_credentials as credential
  where credential.profile_id <> p_profile_id
    and extensions.crypt(p_pin, credential.pin_hash) = credential.pin_hash
  limit 1;

  if v_duplicate_profile is not null then
    raise exception 'This PIN is already assigned to another employee.';
  end if;

  insert into private.staff_kiosk_pin_credentials (
    profile_id,
    pin_hash,
    access_role,
    failed_attempts,
    locked_until,
    configured_by,
    updated_at
  )
  values (
    p_profile_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    p_access_role,
    0,
    null,
    p_actor_user_id,
    now()
  )
  on conflict (profile_id) do update
  set pin_hash = excluded.pin_hash,
      access_role = excluded.access_role,
      failed_attempts = 0,
      locked_until = null,
      configured_by = excluded.configured_by,
      updated_at = now();

  update public.staff_employee_profiles
  set kiosk_access_role = p_access_role,
      kiosk_pin_configured_at = now(),
      updated_at = now()
  where profile_id = p_profile_id;

  update private.staff_kiosk_operator_sessions
  set revoked_at = now(),
      revoked_reason = 'pin_changed'
  where operator_profile_id = p_profile_id
    and revoked_at is null;

  insert into public.audit_logs (
    actor_user_id,
    auth_user_id,
    operator_role,
    action,
    entity_type,
    entity_id,
    new_value
  )
  values (
    p_actor_user_id,
    p_actor_user_id,
    case when v_actor_rank >= 120 then 'owner' else 'admin' end,
    'kiosk_pin_configured',
    'staff_employee_profiles',
    p_profile_id,
    jsonb_build_object('access_role', p_access_role)
  );

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'name', v_target_name,
    'access_role', p_access_role,
    'configured_at', now()
  );
end;
$$;

revoke all on function public.staff_kiosk_configure_pin(uuid, uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_kiosk_configure_pin(uuid, uuid, text, uuid, text, text)
  to service_role;

commit;
