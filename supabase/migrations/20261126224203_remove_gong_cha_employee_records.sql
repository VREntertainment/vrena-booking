begin;

-- Employee UUIDs are independent of customer accounts and staff login accounts.
create temporary table gong_cha_employees on commit drop as
select profile_id, employee_code
from public.staff_employee_profiles
where lower(btrim(department)) in ('gc', 'gong cha');

do $$
begin
  if exists (
    select 1 from public.staff_employee_profiles e
    join gong_cha_employees gc using (profile_id)
    where e.active and e.deleted_at is null and e.kiosk_pin_configured_at is not null
  ) then
    raise exception 'A Gong Cha employee has active store PIN access. Verify the roster before removing that employee.';
  end if;
end $$;

delete from public.staff_payroll_source_snapshots source
where source.employee_code in (select employee_code from gong_cha_employees)
  and not exists (
    select 1 from public.staff_employee_profiles employee
    where employee.employee_code = source.employee_code
      and employee.profile_id not in (select profile_id from gong_cha_employees)
  );

delete from public.staff_cost_assignments where profile_id in (select profile_id from gong_cha_employees);

create temporary table gong_cha_pin_secrets on commit drop as
select pin_secret_id
from private.staff_kiosk_pin_credentials
where profile_id in (select profile_id from gong_cha_employees) and pin_secret_id is not null;

delete from public.staff_employee_profiles where profile_id in (select profile_id from gong_cha_employees);

delete from vault.secrets secret
where secret.id in (select pin_secret_id from gong_cha_pin_secrets)
  and not exists (select 1 from private.staff_kiosk_pin_credentials credential where credential.pin_secret_id = secret.id);

commit;
