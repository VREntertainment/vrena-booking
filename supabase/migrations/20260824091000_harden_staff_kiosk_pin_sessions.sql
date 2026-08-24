begin;

-- Keep guessing protection on the shared credential itself. User-Agent is
-- retained only as station metadata because the caller can rotate it freely.
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
  v_attempt_hash text := repeat('0', 64);
  v_device_hash text;
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

  select lower(email) into v_actor_email from auth.users where id = p_actor_user_id;
  if v_actor_email <> 'contact@vre-vietnam.com' then
    raise exception 'The shared store login is required.';
  end if;

  v_device_hash := coalesce(nullif(p_user_agent_hash, ''), repeat('0', 64));
  if v_device_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  insert into private.staff_kiosk_pin_attempts (auth_user_id, user_agent_hash)
  values (p_actor_user_id, v_attempt_hash)
  on conflict (auth_user_id, user_agent_hash) do nothing;

  select attempts.* into v_attempt
  from private.staff_kiosk_pin_attempts as attempts
  where attempts.auth_user_id = p_actor_user_id
    and attempts.user_agent_hash = v_attempt_hash
  for update;

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_attempt.locked_until);
  end if;

  select credential.* into v_credential
  from private.staff_kiosk_pin_credentials as credential
  join public.staff_employee_profiles as employee on employee.profile_id = credential.profile_id
  where employee.active = true
    and employee.deleted_at is null
    and employee.kiosk_pin_configured_at is not null
    and employee.kiosk_access_role = credential.access_role
    and private.staff_kiosk_department_is_eligible(employee.department)
    and extensions.crypt(p_pin, credential.pin_hash) = credential.pin_hash
  limit 1;

  if not found then
    v_next_attempts := v_attempt.failed_attempts + 1;
    v_locked_until := case when v_next_attempts >= 5 then now() + interval '15 minutes' else null end;
    update private.staff_kiosk_pin_attempts
    set failed_attempts = case when v_next_attempts >= 5 then 0 else v_next_attempts end,
        locked_until = v_locked_until,
        updated_at = now()
    where auth_user_id = p_actor_user_id and user_agent_hash = v_attempt_hash;
    return jsonb_build_object(
      'ok', false,
      'reason', case when v_locked_until is null then 'incorrect' else 'locked' end,
      'attempts_remaining', greatest(0, 5 - v_next_attempts),
      'locked_until', v_locked_until
    );
  end if;

  update private.staff_kiosk_pin_attempts
  set failed_attempts = 0, locked_until = null, updated_at = now()
  where auth_user_id = p_actor_user_id and user_agent_hash = v_attempt_hash;

  -- Existing station sessions stay active. Lock/logout RPCs revoke only the
  -- station token that the operator actually presented.
  insert into private.staff_kiosk_operator_sessions (
    auth_user_id, operator_profile_id, access_role, token_hash, user_agent_hash
  ) values (
    p_actor_user_id, v_credential.profile_id, v_credential.access_role,
    p_token_hash, v_device_hash
  ) returning id into v_session_id;

  select coalesce(employee.legal_name, employee.employee_code, 'Employee'),
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

revoke all on function public.staff_kiosk_verify_pin(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_kiosk_verify_pin(uuid, text, text, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
