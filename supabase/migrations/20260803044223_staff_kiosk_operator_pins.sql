begin;

create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.staff_employee_profiles
  add column if not exists kiosk_access_role text,
  add column if not exists kiosk_pin_configured_at timestamptz;

alter table public.staff_employee_profiles
  drop constraint if exists staff_employee_profiles_kiosk_access_role_check;

alter table public.staff_employee_profiles
  add constraint staff_employee_profiles_kiosk_access_role_check
  check (kiosk_access_role is null or kiosk_access_role in ('manager', 'staff'));

create table if not exists private.staff_kiosk_pin_credentials (
  profile_id uuid primary key references public.staff_employee_profiles(profile_id) on delete cascade,
  pin_hash text not null,
  access_role text not null check (access_role in ('manager', 'staff')),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  configured_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.staff_kiosk_operator_sessions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  operator_profile_id uuid not null references public.staff_employee_profiles(profile_id) on delete cascade,
  access_role text not null check (access_role in ('manager', 'staff')),
  token_hash text not null unique check (length(token_hash) = 64),
  user_agent_hash text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  revoked_at timestamptz,
  revoked_reason text
);

create index if not exists staff_kiosk_sessions_active_idx
  on private.staff_kiosk_operator_sessions (auth_user_id, last_activity_at desc)
  where revoked_at is null;

revoke all on private.staff_kiosk_pin_credentials from public, anon, authenticated;
revoke all on private.staff_kiosk_operator_sessions from public, anon, authenticated;
grant all on private.staff_kiosk_pin_credentials to service_role;
grant all on private.staff_kiosk_operator_sessions to service_role;

create or replace function private.staff_kiosk_request_headers()
returns jsonb
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  v_headers jsonb := '{}'::jsonb;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  return v_headers;
end;
$$;

create or replace function private.staff_kiosk_request_token_hash()
returns text
language plpgsql
stable
set search_path = pg_catalog, extensions
as $$
declare
  v_token text := nullif(private.staff_kiosk_request_headers() ->> 'x-vrena-operator-session', '');
begin
  if v_token is null then
    return null;
  end if;
  return encode(extensions.digest(v_token, 'sha256'), 'hex');
end;
$$;

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
  where session.auth_user_id = (select auth.uid())
    and session.token_hash = private.staff_kiosk_request_token_hash()
    and session.revoked_at is null
    and session.last_activity_at > now() - interval '5 minutes'
    and session.expires_at > now()
    and employee.active = true
    and employee.deleted_at is null
    and credential.access_role = session.access_role
    and lower(coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
  order by session.last_activity_at desc
  limit 1
$$;

create or replace function private.current_staff_kiosk_operator_profile_id()
returns uuid
language sql
security definer
stable
set search_path = pg_catalog, private
as $$
  select session.operator_profile_id
  from private.staff_kiosk_operator_sessions as session
  where session.id = private.current_staff_kiosk_session_id()
$$;

create or replace function private.current_staff_kiosk_role_key()
returns text
language sql
security definer
stable
set search_path = pg_catalog, private
as $$
  select session.access_role
  from private.staff_kiosk_operator_sessions as session
  where session.id = private.current_staff_kiosk_session_id()
$$;

create or replace function private.current_staff_kiosk_role_rank()
returns integer
language sql
security definer
stable
set search_path = pg_catalog, private
as $$
  select case private.current_staff_kiosk_role_key()
    when 'manager' then 80
    when 'staff' then 50
    else 0
  end
$$;

create or replace function public.current_staff_role_rank()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_auth_email text;
  v_jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_profile_role text;
begin
  if v_actor is null then
    return 0;
  end if;

  select lower(users.email), profiles.role
  into v_auth_email, v_profile_role
  from auth.users as users
  left join public.profiles as profiles
    on profiles.id = users.id
   and profiles.deleted_at is null
  where users.id = v_actor;

  if coalesce(v_auth_email, v_jwt_email, '') = 'contact@vre-vietnam.com'
     or v_jwt_email = 'contact@vre-vietnam.com' then
    return private.current_staff_kiosk_role_rank();
  end if;

  return greatest(
    public.staff_role_rank(v_profile_role, null),
    public.staff_role_rank(null, v_auth_email),
    public.staff_role_rank(null, v_jwt_email)
  );
end;
$$;

create or replace function public.current_staff_role_key()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_auth_email text;
  v_jwt_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_profile_role text;
  v_rank integer := 0;
begin
  if v_actor is null then
    return 'player';
  end if;

  select lower(users.email), profiles.role
  into v_auth_email, v_profile_role
  from auth.users as users
  left join public.profiles as profiles
    on profiles.id = users.id
   and profiles.deleted_at is null
  where users.id = v_actor;

  if coalesce(v_auth_email, v_jwt_email, '') = 'contact@vre-vietnam.com'
     or v_jwt_email = 'contact@vre-vietnam.com' then
    return coalesce(private.current_staff_kiosk_role_key(), 'player');
  end if;

  v_rank := greatest(
    public.staff_role_rank(v_profile_role, null),
    public.staff_role_rank(null, v_auth_email),
    public.staff_role_rank(null, v_jwt_email)
  );

  if v_rank >= 120 then return 'owner'; end if;
  if v_rank >= 100 then return 'admin'; end if;
  if v_rank >= 80 then return 'manager'; end if;
  if lower(coalesce(v_profile_role, '')) = 'cashier' then return 'cashier'; end if;
  if v_rank >= 50 then return 'staff'; end if;
  if v_rank >= 20 then return 'viewer'; end if;
  return 'player';
end;
$$;

create or replace function public.current_staff_actor_profile_id()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
stable
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_actor is null then
    return null;
  end if;
  if v_email = 'contact@vre-vietnam.com' then
    return private.current_staff_kiosk_operator_profile_id();
  end if;
  return v_actor;
end;
$$;

create or replace function public.current_staff_operator_session_id()
returns uuid
language sql
security definer
set search_path = pg_catalog, private
stable
as $$
  select private.current_staff_kiosk_session_id()
$$;

create or replace function public.is_staff_attendance_editor()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier')
$$;

create or replace function public.can_read_staff_attendance_row(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select public.current_staff_role_key() in ('owner', 'admin', 'manager', 'cashier', 'viewer')
    or p_profile_id = public.current_staff_actor_profile_id()
$$;

revoke all on function public.current_staff_actor_profile_id() from public, anon;
revoke all on function public.current_staff_operator_session_id() from public, anon;
revoke all on function public.is_staff_attendance_editor() from public, anon;
revoke all on function public.can_read_staff_attendance_row(uuid) from public, anon;
grant execute on function public.current_staff_actor_profile_id() to authenticated, service_role;
grant execute on function public.current_staff_operator_session_id() to authenticated, service_role;
grant execute on function public.is_staff_attendance_editor() to authenticated, service_role;
grant execute on function public.can_read_staff_attendance_row(uuid) to authenticated, service_role;

alter table public.audit_logs
  add column if not exists auth_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists operator_session_id uuid,
  add column if not exists operator_role text;

create index if not exists audit_logs_operator_session_idx
  on public.audit_logs (operator_session_id, created_at desc)
  where operator_session_id is not null;

create or replace function public.attribute_staff_kiosk_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_auth_user uuid := (select auth.uid());
  v_operator uuid := private.current_staff_kiosk_operator_profile_id();
  v_session uuid := private.current_staff_kiosk_session_id();
  v_role text := private.current_staff_kiosk_role_key();
begin
  new.auth_user_id := coalesce(new.auth_user_id, v_auth_user);
  if v_operator is not null and v_session is not null then
    new.actor_user_id := v_operator;
    new.operator_session_id := v_session;
    new.operator_role := v_role;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_logs_staff_kiosk_attribution on public.audit_logs;
create trigger audit_logs_staff_kiosk_attribution
before insert on public.audit_logs
for each row execute function public.attribute_staff_kiosk_audit();

create or replace function public.staff_kiosk_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := private.current_staff_kiosk_operator_profile_id();
  v_session uuid := private.current_staff_kiosk_session_id();
  v_role text := private.current_staff_kiosk_role_key();
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_entity_id uuid;
  v_changed_fields text[] := array[]::text[];
begin
  if v_actor is null or v_session is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  begin
    v_entity_id := coalesce(nullif(v_row ->> 'id', ''), nullif(v_row ->> 'profile_id', ''))::uuid;
  exception when others then
    v_entity_id := null;
  end;

  select coalesce(array_agg(key order by key), array[]::text[])
  into v_changed_fields
  from (
    select fields.key
    from jsonb_object_keys(v_old || v_new) as fields(key)
    where v_old -> fields.key is distinct from v_new -> fields.key
  ) as changed;

  insert into public.audit_logs (
    actor_user_id,
    auth_user_id,
    operator_session_id,
    operator_role,
    action,
    entity_type,
    entity_id,
    new_value
  )
  values (
    v_actor,
    (select auth.uid()),
    v_session,
    v_role,
    'kiosk_' || lower(tg_op),
    tg_table_name,
    v_entity_id,
    jsonb_build_object('changed_fields', to_jsonb(v_changed_fields))
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'staff_employee_profiles',
    'staff_schedule_shifts',
    'staff_attendance_logs',
    'staff_leave_requests',
    'staff_hr_adjustments',
    'staff_payroll_runs',
    'sessions',
    'session_participants'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists %I on public.%I', 'staff_kiosk_audit_' || v_table, v_table);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.staff_kiosk_audit_mutation()',
        'staff_kiosk_audit_' || v_table,
        v_table
      );
    end if;
  end loop;
end;
$$;

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
  v_has_credentials boolean;
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
  left join public.profiles as profiles on profiles.id = users.id
  where users.id = p_actor_user_id;

  if v_actor_email is null then
    raise exception 'Staff session required.';
  end if;

  select exists(select 1 from private.staff_kiosk_pin_credentials)
  into v_has_credentials;

  if v_actor_email = 'contact@vre-vietnam.com' then
    if v_has_credentials and not exists (
      select 1
      from private.staff_kiosk_operator_sessions as session
      where session.auth_user_id = p_actor_user_id
        and session.operator_profile_id = p_actor_profile_id
        and session.access_role = 'manager'
        and session.token_hash = p_operator_token_hash
        and session.revoked_at is null
        and session.last_activity_at > now() - interval '5 minutes'
        and session.expires_at > now()
    ) then
      raise exception 'Manager PIN required.';
    end if;
  elsif public.staff_role_rank(v_actor_role, v_actor_email) < 100 then
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
    coalesce(p_actor_profile_id, p_actor_user_id),
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
    coalesce(p_actor_profile_id, p_actor_user_id),
    p_actor_user_id,
    case when p_actor_profile_id is not null then 'manager' else null end,
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

create or replace function public.staff_kiosk_verify_pin(
  p_actor_user_id uuid,
  p_profile_id uuid,
  p_pin text,
  p_token_hash text,
  p_user_agent_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_actor_email text;
  v_credential private.staff_kiosk_pin_credentials%rowtype;
  v_session_id uuid;
  v_name text;
  v_avatar_emoji text;
  v_avatar_initials text;
  v_avatar_color text;
  v_avatar_text_color text;
  v_next_attempts integer;
  v_locked_until timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_pin !~ '^\d{4}$' or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select lower(email) into v_actor_email from auth.users where id = p_actor_user_id;
  if v_actor_email <> 'contact@vre-vietnam.com' then
    raise exception 'The shared store login is required.';
  end if;

  select credential.*
  into v_credential
  from private.staff_kiosk_pin_credentials as credential
  join public.staff_employee_profiles as employee on employee.profile_id = credential.profile_id
  where credential.profile_id = p_profile_id
    and employee.active = true
    and employee.deleted_at is null
  for update of credential;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if v_credential.locked_until is not null and v_credential.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_credential.locked_until);
  end if;

  if extensions.crypt(p_pin, v_credential.pin_hash) <> v_credential.pin_hash then
    v_next_attempts := v_credential.failed_attempts + 1;
    v_locked_until := case when v_next_attempts >= 5 then now() + interval '15 minutes' else null end;
    update private.staff_kiosk_pin_credentials
    set failed_attempts = case when v_next_attempts >= 5 then 0 else v_next_attempts end,
        locked_until = v_locked_until,
        updated_at = now()
    where profile_id = p_profile_id;
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_locked_until is null then 'incorrect' else 'locked' end,
      'attempts_remaining', greatest(0, 5 - v_next_attempts),
      'locked_until', v_locked_until
    );
  end if;

  update private.staff_kiosk_pin_credentials
  set failed_attempts = 0,
      locked_until = null,
      updated_at = now()
  where profile_id = p_profile_id;

  update private.staff_kiosk_operator_sessions
  set revoked_at = now(),
      revoked_reason = 'operator_switched'
  where auth_user_id = p_actor_user_id
    and revoked_at is null;

  insert into private.staff_kiosk_operator_sessions (
    auth_user_id,
    operator_profile_id,
    access_role,
    token_hash,
    user_agent_hash
  )
  values (
    p_actor_user_id,
    p_profile_id,
    v_credential.access_role,
    p_token_hash,
    nullif(p_user_agent_hash, '')
  )
  returning id into v_session_id;

  select
    coalesce(employee.legal_name, profiles.full_name, profiles.nickname, employee.employee_code, 'Employee'),
    profiles.avatar_emoji,
    profiles.avatar_initials,
    profiles.avatar_color,
    profiles.avatar_text_color
  into v_name, v_avatar_emoji, v_avatar_initials, v_avatar_color, v_avatar_text_color
  from public.staff_employee_profiles as employee
  join public.profiles as profiles on profiles.id = employee.profile_id
  where employee.profile_id = p_profile_id;

  insert into public.audit_logs (
    actor_user_id,
    auth_user_id,
    operator_session_id,
    operator_role,
    action,
    entity_type,
    entity_id
  )
  values (
    p_profile_id,
    p_actor_user_id,
    v_session_id,
    v_credential.access_role,
    'kiosk_unlocked',
    'staff_employee_profiles',
    p_profile_id
  );

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'profile_id', p_profile_id,
    'name', v_name,
    'access_role', v_credential.access_role,
    'avatar_emoji', v_avatar_emoji,
    'avatar_initials', v_avatar_initials,
    'avatar_color', v_avatar_color,
    'avatar_text_color', v_avatar_text_color,
    'expires_at', now() + interval '12 hours'
  );
end;
$$;

create or replace function public.staff_kiosk_touch_session(
  p_actor_user_id uuid,
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_updated integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update private.staff_kiosk_operator_sessions
  set last_activity_at = now()
  where auth_user_id = p_actor_user_id
    and token_hash = p_token_hash
    and revoked_at is null
    and last_activity_at > now() - interval '5 minutes'
    and expires_at > now();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.staff_kiosk_revoke_session(
  p_actor_user_id uuid,
  p_token_hash text,
  p_reason text default 'locked'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_session private.staff_kiosk_operator_sessions%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  update private.staff_kiosk_operator_sessions
  set revoked_at = now(),
      revoked_reason = left(coalesce(nullif(p_reason, ''), 'locked'), 80)
  where auth_user_id = p_actor_user_id
    and token_hash = p_token_hash
    and revoked_at is null
  returning * into v_session;

  if v_session.id is null then
    return false;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    auth_user_id,
    operator_session_id,
    operator_role,
    action,
    entity_type,
    entity_id
  )
  values (
    v_session.operator_profile_id,
    p_actor_user_id,
    v_session.id,
    v_session.access_role,
    'kiosk_locked',
    'staff_employee_profiles',
    v_session.operator_profile_id
  );
  return true;
end;
$$;

revoke all on function public.staff_kiosk_configure_pin(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.staff_kiosk_verify_pin(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.staff_kiosk_touch_session(uuid, text) from public, anon, authenticated;
revoke all on function public.staff_kiosk_revoke_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.staff_kiosk_configure_pin(uuid, uuid, text, uuid, text, text) to service_role;
grant execute on function public.staff_kiosk_verify_pin(uuid, uuid, text, text, text) to service_role;
grant execute on function public.staff_kiosk_touch_session(uuid, text) to service_role;
grant execute on function public.staff_kiosk_revoke_session(uuid, text, text) to service_role;

commit;
