begin;

alter table public.profiles
  add column if not exists onboarding_tour_completed_at timestamptz;

grant select (onboarding_tour_completed_at) on public.profiles to authenticated;
grant update (onboarding_tour_completed_at) on public.profiles to authenticated;

alter table private.staff_kiosk_pin_credentials
  add column if not exists pin_secret_id uuid;

create table if not exists private.staff_kiosk_pin_attempts (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  user_agent_hash text not null check (length(user_agent_hash) = 64),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (auth_user_id, user_agent_hash)
);

revoke all on private.staff_kiosk_pin_attempts from public, anon, authenticated;
grant all on private.staff_kiosk_pin_attempts to service_role;

-- A six-digit PIN now identifies the employee, so every active HR file needs a
-- unique PIN. Vault keeps the recoverable value encrypted while bcrypt remains
-- the only value used by the kiosk verification path.
do $$
declare
  v_employee record;
  v_pin text;
  v_pin_secret_id uuid;
  v_access_role text;
begin
  for v_employee in
    select
      employee.profile_id,
      employee.kiosk_access_role,
      profiles.role as profile_role,
      credential.pin_secret_id,
      credential.access_role as credential_access_role,
      credential.configured_by
    from public.staff_employee_profiles as employee
    join public.profiles as profiles on profiles.id = employee.profile_id
    left join private.staff_kiosk_pin_credentials as credential on credential.profile_id = employee.profile_id
    where employee.active = true
      and employee.deleted_at is null
    order by employee.profile_id
  loop
    loop
      v_pin := (((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 900000) + 100000)::text;
      exit when not exists (
        select 1
        from private.staff_kiosk_pin_credentials as credential
        where credential.profile_id <> v_employee.profile_id
          and extensions.crypt(v_pin, credential.pin_hash) = credential.pin_hash
      );
    end loop;

    if v_employee.pin_secret_id is null then
      select vault.create_secret(
        v_pin,
        'staff-kiosk-pin-' || v_employee.profile_id::text,
        'Encrypted six-digit VRena staff kiosk PIN'
      ) into v_pin_secret_id;
    else
      perform vault.update_secret(
        v_employee.pin_secret_id,
        v_pin,
        'staff-kiosk-pin-' || v_employee.profile_id::text,
        'Encrypted six-digit VRena staff kiosk PIN'
      );
      v_pin_secret_id := v_employee.pin_secret_id;
    end if;

    v_access_role := coalesce(
      v_employee.credential_access_role,
      v_employee.kiosk_access_role,
      case when lower(coalesce(v_employee.profile_role, '')) in ('owner', 'super_admin', 'admin', 'manager')
        then 'manager'
        else 'staff'
      end
    );

    insert into private.staff_kiosk_pin_credentials (
      profile_id,
      pin_hash,
      pin_secret_id,
      access_role,
      failed_attempts,
      locked_until,
      configured_by,
      updated_at
    )
    values (
      v_employee.profile_id,
      extensions.crypt(v_pin, extensions.gen_salt('bf', 10)),
      v_pin_secret_id,
      v_access_role,
      0,
      null,
      v_employee.configured_by,
      now()
    )
    on conflict (profile_id) do update
    set pin_hash = excluded.pin_hash,
        pin_secret_id = excluded.pin_secret_id,
        access_role = excluded.access_role,
        failed_attempts = 0,
        locked_until = null,
        updated_at = now();

    update public.staff_employee_profiles
    set kiosk_access_role = v_access_role,
        kiosk_pin_configured_at = now(),
        updated_at = now()
    where profile_id = v_employee.profile_id;
  end loop;

  update private.staff_kiosk_operator_sessions
  set revoked_at = now(),
      revoked_reason = 'six_digit_pin_upgrade'
  where revoked_at is null;
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

  select credential.pin_secret_id
  into v_pin_secret_id
  from private.staff_kiosk_pin_credentials as credential
  where credential.profile_id = p_profile_id;

  if v_pin_secret_id is null then
    select vault.create_secret(
      p_pin,
      'staff-kiosk-pin-' || p_profile_id::text,
      'Encrypted six-digit VRena staff kiosk PIN'
    ) into v_pin_secret_id;
  else
    perform vault.update_secret(
      v_pin_secret_id,
      p_pin,
      'staff-kiosk-pin-' || p_profile_id::text,
      'Encrypted six-digit VRena staff kiosk PIN'
    );
  end if;

  insert into private.staff_kiosk_pin_credentials (
    profile_id, pin_hash, pin_secret_id, access_role, failed_attempts,
    locked_until, configured_by, updated_at
  )
  values (
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

create or replace function public.staff_kiosk_reveal_pin(
  p_actor_user_id uuid,
  p_actor_profile_id uuid,
  p_operator_token_hash text,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, vault
as $$
declare
  v_actor_email text;
  v_actor_role text;
  v_actor_rank integer;
  v_pin text;
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

  if v_actor_email is null or v_actor_email = 'contact@vre-vietnam.com' then
    raise exception 'An individual staff account is required.';
  end if;
  if p_actor_profile_id is distinct from p_actor_user_id then
    raise exception 'The PIN viewer identity is invalid.';
  end if;

  v_actor_rank := public.staff_role_rank(v_actor_role, v_actor_email);
  if v_actor_rank < 100 and lower(coalesce(v_actor_role, '')) <> 'cashier' then
    raise exception 'Owner, Admin, or Office Staff access required.';
  end if;

  select decrypted.decrypted_secret
  into v_pin
  from private.staff_kiosk_pin_credentials as credential
  join public.staff_employee_profiles as employee on employee.profile_id = credential.profile_id
  join vault.decrypted_secrets as decrypted on decrypted.id = credential.pin_secret_id
  where credential.profile_id = p_profile_id
    and employee.active = true
    and employee.deleted_at is null;

  if v_pin is null then
    return jsonb_build_object('available', false);
  end if;

  insert into public.audit_logs (
    actor_user_id, auth_user_id, operator_role, action, entity_type, entity_id
  ) values (
    p_actor_user_id, p_actor_user_id,
    case
      when v_actor_rank >= 120 then 'owner'
      when v_actor_rank >= 100 then 'admin'
      else 'cashier'
    end,
    'kiosk_pin_revealed', 'staff_employee_profiles', p_profile_id
  );

  return jsonb_build_object('available', true, 'pin', v_pin);
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
  if p_pin !~ '^\d{6}$' or p_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select lower(email) into v_actor_email from auth.users where id = p_actor_user_id;
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
  join public.staff_employee_profiles as employee on employee.profile_id = credential.profile_id
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
    where auth_user_id = p_actor_user_id and user_agent_hash = v_user_agent_hash;
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_locked_until is null then 'incorrect' else 'locked' end,
      'attempts_remaining', greatest(0, 5 - v_next_attempts),
      'locked_until', v_locked_until
    );
  end if;

  update private.staff_kiosk_pin_attempts
  set failed_attempts = 0, locked_until = null, updated_at = now()
  where auth_user_id = p_actor_user_id and user_agent_hash = v_user_agent_hash;

  update private.staff_kiosk_operator_sessions
  set revoked_at = now(), revoked_reason = 'operator_switched'
  where auth_user_id = p_actor_user_id and revoked_at is null;

  insert into private.staff_kiosk_operator_sessions (
    auth_user_id, operator_profile_id, access_role, token_hash, user_agent_hash
  ) values (
    p_actor_user_id, v_credential.profile_id, v_credential.access_role,
    p_token_hash, v_user_agent_hash
  ) returning id into v_session_id;

  select
    coalesce(employee.legal_name, profiles.full_name, profiles.nickname, employee.employee_code, 'Employee'),
    employee.employee_code,
    employee.job_title,
    profiles.avatar_emoji,
    profiles.avatar_initials,
    profiles.avatar_color,
    profiles.avatar_text_color
  into v_name, v_employee_code, v_job_title, v_avatar_emoji, v_avatar_initials, v_avatar_color, v_avatar_text_color
  from public.staff_employee_profiles as employee
  join public.profiles as profiles on profiles.id = employee.profile_id
  where employee.profile_id = v_credential.profile_id;

  insert into public.audit_logs (
    actor_user_id, auth_user_id, operator_session_id, operator_role,
    action, entity_type, entity_id
  ) values (
    v_credential.profile_id, p_actor_user_id, v_session_id, v_credential.access_role,
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
    'avatar_emoji', v_avatar_emoji,
    'avatar_initials', v_avatar_initials,
    'avatar_color', v_avatar_color,
    'avatar_text_color', v_avatar_text_color,
    'expires_at', now() + interval '12 hours'
  );
end;
$$;

revoke all on function public.staff_kiosk_configure_pin(uuid, uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_kiosk_configure_pin(uuid, uuid, text, uuid, text, text)
  to service_role;

revoke all on function public.staff_kiosk_reveal_pin(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.staff_kiosk_reveal_pin(uuid, uuid, text, uuid)
  to service_role;

revoke all on function public.staff_kiosk_verify_pin(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_kiosk_verify_pin(uuid, text, text, text)
  to service_role;

revoke execute on function public.staff_kiosk_verify_pin(uuid, uuid, text, text, text)
  from service_role;

commit;
