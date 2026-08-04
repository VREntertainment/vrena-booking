begin;

-- Employee identities are private HR records. They are intentionally independent
-- from public.profiles, auth.users, and web-app roles.
alter table public.staff_employee_profiles
  drop constraint if exists staff_employee_profiles_profile_id_fkey;

comment on column public.staff_employee_profiles.profile_id is
  'Independent employee UUID. This is not a player profile ID or auth user ID.';

-- Employee-owned records now reference the HR employee identity. Actor/auditor
-- columns continue to reference public.profiles because they identify signed-in users.
alter table public.staff_schedule_shifts
  drop constraint if exists staff_schedule_shifts_staff_profile_id_fkey,
  add constraint staff_schedule_shifts_staff_profile_id_fkey
    foreign key (staff_profile_id) references public.staff_employee_profiles(profile_id) on delete cascade;

alter table public.staff_attendance_logs
  drop constraint if exists staff_attendance_logs_staff_profile_id_fkey,
  add constraint staff_attendance_logs_staff_profile_id_fkey
    foreign key (staff_profile_id) references public.staff_employee_profiles(profile_id) on delete cascade;

alter table public.staff_leave_requests
  drop constraint if exists staff_leave_requests_staff_profile_id_fkey,
  add constraint staff_leave_requests_staff_profile_id_fkey
    foreign key (staff_profile_id) references public.staff_employee_profiles(profile_id) on delete cascade;

alter table public.staff_hr_adjustments
  drop constraint if exists staff_hr_adjustments_profile_id_fkey,
  add constraint staff_hr_adjustments_profile_id_fkey
    foreign key (profile_id) references public.staff_employee_profiles(profile_id) on delete cascade;

alter table public.staff_payroll_items
  drop constraint if exists staff_payroll_items_profile_id_fkey,
  add constraint staff_payroll_items_profile_id_fkey
    foreign key (profile_id) references public.staff_employee_profiles(profile_id) on delete cascade;

alter table public.staff_hr_documents
  drop constraint if exists staff_hr_documents_profile_id_fkey,
  add constraint staff_hr_documents_profile_id_fkey
    foreign key (profile_id) references public.staff_employee_profiles(profile_id) on delete cascade;

alter table public.staff_zalo_identities
  drop constraint if exists staff_zalo_identities_staff_profile_id_fkey,
  add constraint staff_zalo_identities_staff_profile_id_fkey
    foreign key (staff_profile_id) references public.staff_employee_profiles(profile_id) on delete cascade;

alter table public.staff_zalo_attendance_events
  drop constraint if exists staff_zalo_attendance_events_staff_profile_id_fkey,
  add constraint staff_zalo_attendance_events_staff_profile_id_fkey
    foreign key (staff_profile_id) references public.staff_employee_profiles(profile_id) on delete set null;

drop index if exists public.staff_employee_profiles_employee_code_idx;
create unique index staff_employee_profiles_employee_code_idx
  on public.staff_employee_profiles (lower(employee_code))
  where deleted_at is null and employee_code is not null;

-- Retire all legacy account-linked employee rows without removing customer
-- profiles, auth users, permissions, or historical HR records.
update public.staff_employee_profiles
set active = false,
    deleted_at = coalesce(deleted_at, now()),
    delete_reason = coalesce(delete_reason, 'Replaced by independent employee records'),
    updated_at = now()
where deleted_at is null;

-- Retire any unused HR-only profile shells created by the earlier transitional
-- model. Auth-backed customer and administrator profiles are not changed.
update public.profiles
set deleted_at = coalesce(deleted_at, now()),
    delete_reason = coalesce(delete_reason, 'Employee identity moved to independent HR record'),
    updated_at = now()
where coalesce(is_hr_record_only, false)
  and deleted_at is null;

create or replace function public.staff_hr_create_employee_record(
  p_actor_user_id uuid,
  p_full_name text,
  p_personal_email text,
  p_personal_phone text,
  p_employment_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  v_actor_email text;
  v_actor_role text;
  v_employee public.staff_employee_profiles;
  v_full_name text := nullif(btrim(coalesce(p_full_name, '')), '');
  v_personal_email text := nullif(lower(btrim(coalesce(p_personal_email, ''))), '');
  v_personal_phone text := nullif(btrim(coalesce(p_personal_phone, '')), '');
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
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
    raise exception 'Sign in with an individual Owner or Admin account to create employees.';
  end if;
  if public.staff_role_rank(v_actor_role, v_actor_email) < 100 then
    raise exception 'Administrator access required.';
  end if;
  if v_full_name is null then
    raise exception 'Enter the employee name.';
  end if;
  if length(v_full_name) > 120 then
    raise exception 'Employee name is too long.';
  end if;
  if v_personal_email is not null and length(v_personal_email) > 254 then
    raise exception 'Email is too long.';
  end if;
  if v_personal_email is not null and v_personal_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid email or leave it blank.';
  end if;
  if v_personal_phone is not null and length(v_personal_phone) > 40 then
    raise exception 'Phone number is too long.';
  end if;
  if p_employment_type not in ('full_time', 'part_time', 'probation_full_time', 'probation_part_time', 'contractor', 'intern') then
    raise exception 'Choose a valid employment type.';
  end if;

  insert into public.staff_employee_profiles (
    profile_id,
    active,
    created_by,
    employment_type,
    job_title,
    legal_name,
    personal_email,
    personal_phone
  ) values (
    extensions.gen_random_uuid(),
    true,
    p_actor_user_id,
    p_employment_type,
    'Employee',
    v_full_name,
    v_personal_email,
    v_personal_phone
  )
  returning * into v_employee;

  insert into public.audit_logs (
    action,
    actor_user_id,
    entity_id,
    entity_type,
    new_value
  ) values (
    'employee_hr_record_created',
    p_actor_user_id,
    v_employee.profile_id,
    'staff_employee_profiles',
    jsonb_build_object(
      'employment_type', p_employment_type,
      'full_name', v_full_name,
      'independent_employee_record', true
    )
  );

  return jsonb_build_object('employee', to_jsonb(v_employee));
end;
$$;

revoke all on function public.staff_hr_create_employee_record(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_hr_create_employee_record(uuid, text, text, text, text)
  to service_role;

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
set search_path = pg_catalog, public, private, extensions, vault
as $$
declare
  v_actor_email text;
  v_actor_role text;
  v_actor_rank integer;
  v_duplicate_profile uuid;
  v_target_name text;
  v_pin_secret_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_pin !~ '^\d{6}$' then
    raise exception 'PIN must contain exactly six digits.';
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

  select coalesce(employee.legal_name, employee.employee_code, 'Employee')
  into v_target_name
  from public.staff_employee_profiles as employee
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

  select credential.pin_secret_id
  into v_pin_secret_id
  from private.staff_kiosk_pin_credentials as credential
  where credential.profile_id = p_profile_id;

  if v_pin_secret_id is null then
    select vault.create_secret(
      p_pin,
      'staff-kiosk-pin-' || p_profile_id::text,
      'Encrypted six-digit VRena employee PIN'
    ) into v_pin_secret_id;
  else
    perform vault.update_secret(
      v_pin_secret_id,
      p_pin,
      'staff-kiosk-pin-' || p_profile_id::text,
      'Encrypted six-digit VRena employee PIN'
    );
  end if;

  insert into private.staff_kiosk_pin_credentials (
    profile_id, pin_hash, pin_secret_id, access_role, failed_attempts,
    locked_until, configured_by, updated_at
  ) values (
    p_profile_id,
    extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
    v_pin_secret_id,
    p_access_role,
    0,
    null,
    p_actor_user_id,
    now()
  )
  on conflict (profile_id) do update
  set pin_hash = excluded.pin_hash,
      pin_secret_id = excluded.pin_secret_id,
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
  set revoked_at = now(), revoked_reason = 'pin_changed'
  where operator_profile_id = p_profile_id and revoked_at is null;

  insert into public.audit_logs (
    actor_user_id, auth_user_id, operator_role, action, entity_type, entity_id, new_value
  ) values (
    p_actor_user_id, p_actor_user_id,
    case when v_actor_rank >= 120 then 'owner' else 'admin' end,
    'kiosk_pin_configured', 'staff_employee_profiles', p_profile_id,
    jsonb_build_object('access_role', p_access_role, 'pin_length', 6)
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
  v_attempt private.staff_kiosk_pin_attempts%rowtype;
  v_credential private.staff_kiosk_pin_credentials%rowtype;
  v_user_agent_hash text;
  v_session_id uuid;
  v_name text;
  v_employee_code text;
  v_job_title text;
  v_next_attempts integer;
  v_locked_until timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_pin !~ '^\d{6}$' or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select lower(email) into v_actor_email
  from auth.users
  where id = p_actor_user_id;

  if v_actor_email <> 'contact@vre-vietnam.com' then
    raise exception 'The shared store login is required.';
  end if;

  v_user_agent_hash := coalesce(nullif(p_user_agent_hash, ''), repeat('0', 64));
  if v_user_agent_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  insert into private.staff_kiosk_pin_attempts (auth_user_id, user_agent_hash)
  values (p_actor_user_id, v_user_agent_hash)
  on conflict (auth_user_id, user_agent_hash) do nothing;

  select attempts.*
  into v_attempt
  from private.staff_kiosk_pin_attempts as attempts
  where attempts.auth_user_id = p_actor_user_id
    and attempts.user_agent_hash = v_user_agent_hash
  for update;

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_attempt.locked_until);
  end if;

  select credential.*
  into v_credential
  from private.staff_kiosk_pin_credentials as credential
  join public.staff_employee_profiles as employee
    on employee.profile_id = credential.profile_id
  where employee.active = true
    and employee.deleted_at is null
    and extensions.crypt(p_pin, credential.pin_hash) = credential.pin_hash
  limit 1;

  if not found then
    v_next_attempts := v_attempt.failed_attempts + 1;
    v_locked_until := case when v_next_attempts >= 5 then now() + interval '15 minutes' else null end;
    update private.staff_kiosk_pin_attempts
    set failed_attempts = case when v_next_attempts >= 5 then 0 else v_next_attempts end,
        locked_until = v_locked_until,
        updated_at = now()
    where auth_user_id = p_actor_user_id
      and user_agent_hash = v_user_agent_hash;
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_locked_until is null then 'incorrect' else 'locked' end,
      'attempts_remaining', greatest(0, 5 - v_next_attempts),
      'locked_until', v_locked_until
    );
  end if;

  update private.staff_kiosk_pin_attempts
  set failed_attempts = 0, locked_until = null, updated_at = now()
  where auth_user_id = p_actor_user_id
    and user_agent_hash = v_user_agent_hash;

  update private.staff_kiosk_operator_sessions
  set revoked_at = now(), revoked_reason = 'operator_switched'
  where auth_user_id = p_actor_user_id
    and revoked_at is null;

  insert into private.staff_kiosk_operator_sessions (
    auth_user_id, operator_profile_id, access_role, token_hash, user_agent_hash
  ) values (
    p_actor_user_id, v_credential.profile_id, v_credential.access_role,
    p_token_hash, v_user_agent_hash
  ) returning id into v_session_id;

  select
    coalesce(employee.legal_name, employee.employee_code, 'Employee'),
    employee.employee_code,
    employee.job_title
  into v_name, v_employee_code, v_job_title
  from public.staff_employee_profiles as employee
  where employee.profile_id = v_credential.profile_id;

  insert into public.audit_logs (
    actor_user_id, auth_user_id, operator_session_id, operator_role,
    action, entity_type, entity_id
  ) values (
    p_actor_user_id, p_actor_user_id, v_session_id, v_credential.access_role,
    'kiosk_unlocked', 'staff_employee_profiles', v_credential.profile_id
  );

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'profile_id', v_credential.profile_id,
    'employee_code', v_employee_code,
    'name', v_name,
    'job_title', v_job_title,
    'access_role', v_credential.access_role,
    'avatar_emoji', null,
    'avatar_initials', null,
    'avatar_color', '#f3f4f6',
    'avatar_text_color', '#111827',
    'expires_at', now() + interval '12 hours'
  );
end;
$$;

revoke all on function public.staff_kiosk_configure_pin(uuid, uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_kiosk_configure_pin(uuid, uuid, text, uuid, text, text)
  to service_role;

revoke all on function public.staff_kiosk_verify_pin(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_kiosk_verify_pin(uuid, text, text, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
