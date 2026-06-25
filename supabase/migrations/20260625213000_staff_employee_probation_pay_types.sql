begin;

alter table public.staff_employee_profiles
  drop constraint if exists staff_employee_profiles_employment_type_check;

update public.staff_employee_profiles
set employment_type = 'probation_part_time'
where employment_type = 'probation';

alter table public.staff_employee_profiles
  add constraint staff_employee_profiles_employment_type_check
  check (employment_type in (
    'full_time',
    'part_time',
    'contractor',
    'intern',
    'probation_full_time',
    'probation_part_time'
  ));

commit;
