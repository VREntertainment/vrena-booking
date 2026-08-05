begin;

alter table public.staff_employee_profiles
  add column if not exists probation_payroll_type text not null default 'hourly',
  add column if not exists labor_payroll_type text not null default 'hourly',
  add column if not exists probation_salary_percentage numeric(5,2) not null default 85,
  add column if not exists probation_start_date date,
  add column if not exists probation_end_date date,
  add column if not exists labor_start_date date,
  add column if not exists labor_end_date date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_contact_phone text,
  add column if not exists social_insurance_enrolled boolean not null default false,
  add column if not exists social_insurance_salary_vnd integer not null default 0,
  add column if not exists google_drive_folder_url text;

alter table public.staff_employee_profiles
  drop constraint if exists staff_employee_profiles_probation_payroll_type_check,
  drop constraint if exists staff_employee_profiles_labor_payroll_type_check,
  drop constraint if exists staff_employee_profiles_probation_salary_percentage_check,
  drop constraint if exists staff_employee_profiles_probation_dates_check,
  drop constraint if exists staff_employee_profiles_labor_dates_check,
  drop constraint if exists staff_employee_profiles_social_insurance_salary_check,
  drop constraint if exists staff_employee_profiles_google_drive_url_check;

alter table public.staff_employee_profiles
  add constraint staff_employee_profiles_probation_payroll_type_check
    check (probation_payroll_type in ('hourly', 'monthly', 'manager')),
  add constraint staff_employee_profiles_labor_payroll_type_check
    check (labor_payroll_type in ('hourly', 'monthly', 'manager')),
  add constraint staff_employee_profiles_probation_salary_percentage_check
    check (probation_salary_percentage in (85, 100)),
  add constraint staff_employee_profiles_probation_dates_check
    check (probation_end_date is null or probation_start_date is null or probation_end_date >= probation_start_date),
  add constraint staff_employee_profiles_labor_dates_check
    check (labor_end_date is null or labor_start_date is null or labor_end_date >= labor_start_date),
  add constraint staff_employee_profiles_social_insurance_salary_check
    check (social_insurance_salary_vnd >= 0),
  add constraint staff_employee_profiles_google_drive_url_check
    check (google_drive_folder_url is null or google_drive_folder_url ~ '^https://drive[.]google[.]com/drive/folders/[A-Za-z0-9_-]+');

update public.staff_employee_profiles
set probation_payroll_type = case when employment_type in ('full_time', 'probation_full_time') then 'monthly' else 'hourly' end,
    labor_payroll_type = case when employment_type in ('full_time', 'probation_full_time') then 'monthly' else 'hourly' end,
    probation_salary_percentage = 85,
    probation_start_date = case when employment_type in ('probation', 'probation_full_time', 'probation_part_time') then coalesce(contract_start_date, start_date) else probation_start_date end,
    probation_end_date = case when employment_type in ('probation', 'probation_full_time', 'probation_part_time') then contract_end_date else probation_end_date end,
    labor_start_date = case when employment_type not in ('probation', 'probation_full_time', 'probation_part_time') then coalesce(contract_start_date, start_date) else labor_start_date end,
    labor_end_date = case when employment_type not in ('probation', 'probation_full_time', 'probation_part_time') then contract_end_date else labor_end_date end,
    emergency_contact_name = coalesce(emergency_contact_name, nullif(btrim(emergency_contact), '')),
    department = case when department = 'Management' then 'Manager' else department end,
    main_work_location = case when main_work_location = 'VRena' then 'HaDo' else main_work_location end,
    payroll_location = case when payroll_location = 'VRena' then 'HaDo' else payroll_location end,
    lunch_allowance_vnd = 0,
    rest_period_minutes = null,
    overtime_rate_multiplier = null,
    night_rate_multiplier = null,
    holiday_rate_multiplier = null,
    employee_contribution_rate = null,
    employer_contribution_rate = null,
    updated_at = now()
where deleted_at is null;

-- Employee values from HR Employee Master are reconciled through a private,
-- audited production data operation. Personal HR data is deliberately excluded
-- from source control.

update public.staff_hr_setup_options
set active = false,
    updated_at = now()
where deleted_at is null
  and option_type in ('department', 'location');

insert into public.staff_hr_setup_options (option_type, name, sort_order, active)
values
  ('department', 'GC', 10, true),
  ('department', 'VRena', 20, true),
  ('department', 'Manager', 30, true),
  ('location', 'HaDo', 10, true),
  ('location', 'CS', 20, true)
on conflict (option_type, lower(name)) where deleted_at is null
do update set active = true, sort_order = excluded.sort_order, updated_at = now();

comment on column public.staff_employee_profiles.probation_salary_percentage is
  'Probation percentage from the authoritative HR Employee Master. Labor salary is the 100% base salary.';
comment on column public.staff_employee_profiles.google_drive_folder_url is
  'Editable link to the employee HR folder in Google Drive.';
comment on column public.staff_employee_profiles.employee_contribution_rate is
  'Deprecated employee override. Payroll uses staff_hr_settings and employee eligibility.';
comment on column public.staff_employee_profiles.overtime_rate_multiplier is
  'Deprecated employee override. Payroll uses staff_hr_settings.';

commit;
