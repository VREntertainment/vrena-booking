begin;

-- Explicit per-employee grants never imply a department change or HR access.
alter table public.staff_employee_profiles
  add column kiosk_staff_access_granted boolean not null default false;
comment on column public.staff_employee_profiles.kiosk_staff_access_granted is
  'Service-managed exception for Staff-only store PIN access. Not editable through normal HR profile updates.';
alter table public.staff_employee_profiles add constraint kiosk_staff_grant_role_check
  check (not kiosk_staff_access_granted or kiosk_access_role is null or kiosk_access_role = 'staff');

create function private.guard_staff_kiosk_grant()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if ((tg_op = 'INSERT' and new.kiosk_staff_access_granted)
      or (tg_op = 'UPDATE' and new.kiosk_staff_access_granted is distinct from old.kiosk_staff_access_granted))
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Only the service administrator may change explicit store access grants.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_staff_kiosk_grant() from public, anon, authenticated;
create trigger guard_staff_kiosk_grant before insert or update of kiosk_staff_access_granted
on public.staff_employee_profiles for each row execute function private.guard_staff_kiosk_grant();

create or replace function private.enforce_staff_kiosk_department_eligibility()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare
  v_was_eligible boolean;
  v_is_eligible boolean;
begin
  v_was_eligible := case when tg_op = 'UPDATE' then
    private.staff_kiosk_department_is_eligible(old.department) or old.kiosk_staff_access_granted
    else false end;
  v_is_eligible := private.staff_kiosk_department_is_eligible(new.department) or new.kiosk_staff_access_granted;

  -- Revoking an explicit grant also invalidates any sessions it authorized.
  if tg_op = 'UPDATE' and old.kiosk_staff_access_granted and not new.kiosk_staff_access_granted then
    update private.staff_kiosk_operator_sessions
    set revoked_at = now(), revoked_reason = 'explicit_store_access_revoked'
    where operator_profile_id = new.profile_id and revoked_at is null;
  end if;
  if v_is_eligible then return new; end if;
  if tg_op = 'UPDATE' and v_was_eligible then
    update private.staff_kiosk_operator_sessions
    set revoked_at = now(), revoked_reason = 'employee_group_not_kiosk_eligible'
    where operator_profile_id = new.profile_id and revoked_at is null;
    new.kiosk_access_role := null;
    new.kiosk_pin_configured_at := null;
    return new;
  end if;
  if new.kiosk_access_role is not null or new.kiosk_pin_configured_at is not null then
    raise exception 'Store PIN access requires an eligible department or an explicit Staff-only grant.';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_staff_kiosk_department_eligibility() from public, anon, authenticated;
drop trigger enforce_staff_kiosk_department_eligibility on public.staff_employee_profiles;
create trigger enforce_staff_kiosk_department_eligibility
before insert or update of department, kiosk_staff_access_granted, kiosk_access_role, kiosk_pin_configured_at
on public.staff_employee_profiles for each row execute function private.enforce_staff_kiosk_department_eligibility();

-- Preserve the current verifier's rate limiting, hashing and concurrent sessions.
do $$
declare
  v_definition text;
  v_old text := 'and private.staff_kiosk_department_is_eligible(employee.department)';
  v_new text := 'and (private.staff_kiosk_department_is_eligible(employee.department) or employee.kiosk_staff_access_granted)
    and (not employee.kiosk_staff_access_granted or credential.access_role = ''staff'')';
begin
  select pg_get_functiondef('public.staff_kiosk_verify_pin(uuid,text,text,text)'::regprocedure) into v_definition;
  if strpos(v_definition, v_old) = 0 then
    raise exception 'Unexpected kiosk verifier definition; inspect before migration.';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$$;
commit;
