begin;

alter table public.staff_employee_profiles
  add column if not exists attendance_number text,
  add column if not exists national_id text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists address text,
  add column if not exists department text,
  add column if not exists main_work_location text,
  add column if not exists payroll_location text,
  add column if not exists contract_status text not null default 'active',
  add column if not exists contract_type text,
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date date,
  add column if not exists profile_photo_path text,
  add column if not exists cv_document_path text,
  add column if not exists lunch_allowance_vnd integer not null default 0,
  add column if not exists rest_period_minutes integer,
  add column if not exists overtime_rate_multiplier numeric(5,2),
  add column if not exists night_rate_multiplier numeric(5,2),
  add column if not exists holiday_rate_multiplier numeric(5,2),
  add column if not exists employee_contribution_rate numeric(5,2),
  add column if not exists employer_contribution_rate numeric(5,2),
  add column if not exists pit_withholding_rate numeric(5,2),
  add column if not exists dependents_count integer not null default 0;

alter table public.staff_employee_profiles
  drop constraint if exists staff_employee_profiles_contract_status_check,
  drop constraint if exists staff_employee_profiles_gender_check,
  drop constraint if exists staff_employee_profiles_lunch_allowance_check,
  drop constraint if exists staff_employee_profiles_dependents_count_check,
  drop constraint if exists staff_employee_profiles_rest_period_check,
  drop constraint if exists staff_employee_profiles_rate_overrides_check;

alter table public.staff_employee_profiles
  add constraint staff_employee_profiles_contract_status_check
    check (contract_status in ('active', 'probation', 'suspended', 'ended', 'draft')),
  add constraint staff_employee_profiles_gender_check
    check (gender is null or gender in ('female', 'male', 'non_binary', 'prefer_not_to_say', 'other')),
  add constraint staff_employee_profiles_lunch_allowance_check
    check (lunch_allowance_vnd >= 0),
  add constraint staff_employee_profiles_dependents_count_check
    check (dependents_count >= 0),
  add constraint staff_employee_profiles_rest_period_check
    check (rest_period_minutes is null or rest_period_minutes >= 0),
  add constraint staff_employee_profiles_rate_overrides_check
    check (
      (overtime_rate_multiplier is null or overtime_rate_multiplier >= 0)
      and (night_rate_multiplier is null or night_rate_multiplier >= 0)
      and (holiday_rate_multiplier is null or holiday_rate_multiplier >= 0)
      and (employee_contribution_rate is null or employee_contribution_rate >= 0)
      and (employer_contribution_rate is null or employer_contribution_rate >= 0)
      and (pit_withholding_rate is null or pit_withholding_rate >= 0)
    );

create index if not exists staff_employee_profiles_hr_filters_idx
  on public.staff_employee_profiles (active, contract_status, department, main_work_location)
  where deleted_at is null;

create table if not exists public.staff_hr_settings (
  id text primary key default 'default',
  currency text not null default 'VND',
  standard_monthly_days numeric(5,2) not null default 26 check (standard_monthly_days > 0),
  standard_monthly_hours numeric(6,2) not null default 208 check (standard_monthly_hours > 0),
  rest_period_minutes integer not null default 660 check (rest_period_minutes >= 0),
  normal_overtime_multiplier numeric(5,2) not null default 1.50 check (normal_overtime_multiplier >= 0),
  night_overtime_multiplier numeric(5,2) not null default 2.00 check (night_overtime_multiplier >= 0),
  holiday_overtime_multiplier numeric(5,2) not null default 3.00 check (holiday_overtime_multiplier >= 0),
  lunch_allowance_vnd integer not null default 0 check (lunch_allowance_vnd >= 0),
  annual_leave_days numeric(5,2) not null default 12 check (annual_leave_days >= 0),
  employee_contribution_rate numeric(5,2) not null default 10.50 check (employee_contribution_rate >= 0),
  employer_contribution_rate numeric(5,2) not null default 21.50 check (employer_contribution_rate >= 0),
  pit_withholding_rate numeric(5,2) not null default 10.00 check (pit_withholding_rate >= 0),
  payslip_note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_hr_setup_options (
  id uuid primary key default gen_random_uuid(),
  option_type text not null check (option_type in ('department', 'job_title', 'location', 'contract_status', 'contract_type', 'employment_type')),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text
);

create unique index if not exists staff_hr_setup_options_type_name_idx
  on public.staff_hr_setup_options (option_type, lower(name))
  where deleted_at is null;

create index if not exists staff_hr_setup_options_type_idx
  on public.staff_hr_setup_options (option_type, active, sort_order)
  where deleted_at is null;

create table if not exists public.staff_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  pay_cycle text not null default 'monthly' check (pay_cycle in ('monthly', 'semi_monthly', 'weekly', 'custom')),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'paid', 'cancelled')),
  total_gross_vnd integer not null default 0 check (total_gross_vnd >= 0),
  total_net_vnd integer not null default 0 check (total_net_vnd >= 0),
  total_company_cost_vnd integer not null default 0 check (total_company_cost_vnd >= 0),
  generated_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text,
  constraint staff_payroll_runs_date_order check (period_end >= period_start)
);

create index if not exists staff_payroll_runs_period_idx
  on public.staff_payroll_runs (period_start, period_end, status)
  where deleted_at is null;

create table if not exists public.staff_hr_adjustments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payroll_run_id uuid references public.staff_payroll_runs(id) on delete set null,
  adjustment_type text not null check (adjustment_type in ('bonus', 'commission', 'allowance', 'lunch_allowance', 'deduction', 'advance', 'debt', 'debt_repayment')),
  title text not null default '',
  amount_vnd integer not null check (amount_vnd >= 0),
  effective_date date not null default current_date,
  period_start date,
  period_end date,
  status text not null default 'pending' check (status in ('draft', 'pending', 'approved', 'rejected', 'paid', 'cancelled')),
  requires_validation boolean not null default true,
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text,
  constraint staff_hr_adjustments_period_order check (period_start is null or period_end is null or period_end >= period_start)
);

create index if not exists staff_hr_adjustments_profile_period_idx
  on public.staff_hr_adjustments (profile_id, effective_date, status, adjustment_type)
  where deleted_at is null;

create table if not exists public.staff_payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.staff_payroll_runs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payslip_number text,
  worked_minutes integer not null default 0 check (worked_minutes >= 0),
  regular_minutes integer not null default 0 check (regular_minutes >= 0),
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  night_minutes integer not null default 0 check (night_minutes >= 0),
  holiday_minutes integer not null default 0 check (holiday_minutes >= 0),
  paid_leave_hours numeric(7,2) not null default 0 check (paid_leave_hours >= 0),
  rest_warning_count integer not null default 0 check (rest_warning_count >= 0),
  base_salary_vnd integer not null default 0 check (base_salary_vnd >= 0),
  overtime_pay_vnd integer not null default 0 check (overtime_pay_vnd >= 0),
  allowances_vnd integer not null default 0 check (allowances_vnd >= 0),
  bonuses_vnd integer not null default 0 check (bonuses_vnd >= 0),
  advances_vnd integer not null default 0 check (advances_vnd >= 0),
  deductions_vnd integer not null default 0 check (deductions_vnd >= 0),
  employee_contributions_vnd integer not null default 0 check (employee_contributions_vnd >= 0),
  employer_contributions_vnd integer not null default 0 check (employer_contributions_vnd >= 0),
  pit_withholding_vnd integer not null default 0 check (pit_withholding_vnd >= 0),
  gross_income_vnd integer not null default 0 check (gross_income_vnd >= 0),
  net_income_vnd integer not null default 0 check (net_income_vnd >= 0),
  company_cost_vnd integer not null default 0 check (company_cost_vnd >= 0),
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'paid', 'cancelled')),
  payslip_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text,
  unique (payroll_run_id, profile_id)
);

create index if not exists staff_payroll_items_profile_idx
  on public.staff_payroll_items (profile_id, payroll_run_id, status)
  where deleted_at is null;

create table if not exists public.staff_hr_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('profile_photo', 'cv', 'contract', 'national_id', 'payslip', 'other')),
  file_name text not null,
  storage_bucket text not null default 'staff-hr-documents',
  storage_path text not null,
  mime_type text,
  size_bytes integer not null default 0 check (size_bytes >= 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_reason text
);

create index if not exists staff_hr_documents_profile_idx
  on public.staff_hr_documents (profile_id, document_type, created_at desc)
  where deleted_at is null;

drop trigger if exists staff_hr_settings_touch_updated_at on public.staff_hr_settings;
create trigger staff_hr_settings_touch_updated_at
before update on public.staff_hr_settings
for each row execute function public.staff_attendance_touch_updated_at();

drop trigger if exists staff_hr_setup_options_touch_updated_at on public.staff_hr_setup_options;
create trigger staff_hr_setup_options_touch_updated_at
before update on public.staff_hr_setup_options
for each row execute function public.staff_attendance_touch_updated_at();

drop trigger if exists staff_payroll_runs_touch_updated_at on public.staff_payroll_runs;
create trigger staff_payroll_runs_touch_updated_at
before update on public.staff_payroll_runs
for each row execute function public.staff_attendance_touch_updated_at();

drop trigger if exists staff_hr_adjustments_touch_updated_at on public.staff_hr_adjustments;
create trigger staff_hr_adjustments_touch_updated_at
before update on public.staff_hr_adjustments
for each row execute function public.staff_attendance_touch_updated_at();

drop trigger if exists staff_payroll_items_touch_updated_at on public.staff_payroll_items;
create trigger staff_payroll_items_touch_updated_at
before update on public.staff_payroll_items
for each row execute function public.staff_attendance_touch_updated_at();

alter table public.staff_hr_settings enable row level security;
alter table public.staff_hr_setup_options enable row level security;
alter table public.staff_hr_adjustments enable row level security;
alter table public.staff_payroll_runs enable row level security;
alter table public.staff_payroll_items enable row level security;
alter table public.staff_hr_documents enable row level security;

grant select, insert, update, delete on
  public.staff_hr_settings,
  public.staff_hr_setup_options,
  public.staff_hr_adjustments,
  public.staff_payroll_runs,
  public.staff_payroll_items,
  public.staff_hr_documents
to authenticated;

grant all on
  public.staff_hr_settings,
  public.staff_hr_setup_options,
  public.staff_hr_adjustments,
  public.staff_payroll_runs,
  public.staff_payroll_items,
  public.staff_hr_documents
to service_role;

drop policy if exists "staff hr settings read" on public.staff_hr_settings;
create policy "staff hr settings read"
on public.staff_hr_settings
for select to authenticated
using ((select public.can_read_staff_attendance_settings()));

drop policy if exists "staff hr settings manage" on public.staff_hr_settings;
create policy "staff hr settings manage"
on public.staff_hr_settings
for all to authenticated
using ((select public.is_staff_attendance_editor()))
with check ((select public.is_staff_attendance_editor()));

drop policy if exists "staff hr setup read" on public.staff_hr_setup_options;
create policy "staff hr setup read"
on public.staff_hr_setup_options
for select to authenticated
using ((select public.can_read_staff_attendance_settings()));

drop policy if exists "staff hr setup manage" on public.staff_hr_setup_options;
create policy "staff hr setup manage"
on public.staff_hr_setup_options
for all to authenticated
using ((select public.is_staff_attendance_editor()))
with check ((select public.is_staff_attendance_editor()));

drop policy if exists "staff hr adjustments read" on public.staff_hr_adjustments;
create policy "staff hr adjustments read"
on public.staff_hr_adjustments
for select to authenticated
using (
  (select public.can_read_staff_attendance_settings())
  and public.can_read_staff_attendance_row(profile_id)
);

drop policy if exists "staff hr adjustments manage" on public.staff_hr_adjustments;
create policy "staff hr adjustments manage"
on public.staff_hr_adjustments
for all to authenticated
using ((select public.is_staff_attendance_editor()))
with check ((select public.is_staff_attendance_editor()));

drop policy if exists "staff payroll runs read" on public.staff_payroll_runs;
create policy "staff payroll runs read"
on public.staff_payroll_runs
for select to authenticated
using ((select public.can_read_staff_attendance_settings()));

drop policy if exists "staff payroll runs manage" on public.staff_payroll_runs;
create policy "staff payroll runs manage"
on public.staff_payroll_runs
for all to authenticated
using ((select public.is_staff_attendance_editor()))
with check ((select public.is_staff_attendance_editor()));

drop policy if exists "staff payroll items read" on public.staff_payroll_items;
create policy "staff payroll items read"
on public.staff_payroll_items
for select to authenticated
using (
  (select public.can_read_staff_attendance_settings())
  and public.can_read_staff_attendance_row(profile_id)
);

drop policy if exists "staff payroll items manage" on public.staff_payroll_items;
create policy "staff payroll items manage"
on public.staff_payroll_items
for all to authenticated
using ((select public.is_staff_attendance_editor()))
with check ((select public.is_staff_attendance_editor()));

drop policy if exists "staff hr documents read" on public.staff_hr_documents;
create policy "staff hr documents read"
on public.staff_hr_documents
for select to authenticated
using (
  (select public.can_read_staff_attendance_settings())
  and public.can_read_staff_attendance_row(profile_id)
);

drop policy if exists "staff hr documents manage" on public.staff_hr_documents;
create policy "staff hr documents manage"
on public.staff_hr_documents
for all to authenticated
using ((select public.is_staff_attendance_editor()))
with check ((select public.is_staff_attendance_editor()));

insert into public.staff_hr_settings (id)
values ('default')
on conflict (id) do nothing;

insert into public.staff_hr_setup_options (option_type, name, sort_order)
values
  ('location', 'VRena', 10),
  ('location', 'Ha Do Centrosa', 20),
  ('department', 'Operations', 10),
  ('department', 'Front Desk', 20),
  ('department', 'Game Master', 30),
  ('job_title', 'Game Master', 10),
  ('job_title', 'Cashier', 20),
  ('job_title', 'Supervisor', 30),
  ('contract_status', 'active', 10),
  ('contract_status', 'probation', 20),
  ('contract_status', 'suspended', 30),
  ('contract_status', 'ended', 40),
  ('contract_type', 'Indefinite term', 10),
  ('contract_type', 'Fixed term', 20),
  ('contract_type', 'Probation', 30),
  ('employment_type', 'Full-time', 10),
  ('employment_type', 'Part-time', 20),
  ('employment_type', 'Probation full-time', 30),
  ('employment_type', 'Probation part-time', 40)
on conflict do nothing;

create or replace function public.can_read_staff_hr_document_path(p_object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when split_part(coalesce(p_object_name, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and split_part(coalesce(p_object_name, ''), '/', 2) <> ''
      and position('..' in coalesce(p_object_name, '')) = 0
    then (select public.can_read_staff_attendance_settings())
      and public.can_read_staff_attendance_row(split_part(coalesce(p_object_name, ''), '/', 1)::uuid)
    else false
  end;
$$;

create or replace function public.can_manage_staff_hr_document_path(p_object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (select public.is_staff_attendance_editor())
    and split_part(coalesce(p_object_name, ''), '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(coalesce(p_object_name, ''), '/', 2) <> ''
    and position('..' in coalesce(p_object_name, '')) = 0;
$$;

revoke all on function public.can_read_staff_hr_document_path(text) from public;
revoke all on function public.can_manage_staff_hr_document_path(text) from public;
grant execute on function public.can_read_staff_hr_document_path(text) to authenticated, service_role;
grant execute on function public.can_manage_staff_hr_document_path(text) to authenticated, service_role;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'staff-hr-documents',
      'staff-hr-documents',
      false,
      10485760,
      array[
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    )
    on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  drop policy if exists "staff hr documents read" on storage.objects;
  create policy "staff hr documents read"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'staff-hr-documents'
    and public.can_read_staff_hr_document_path(name)
  );

  drop policy if exists "staff hr document uploads" on storage.objects;
  create policy "staff hr document uploads"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'staff-hr-documents'
    and public.can_manage_staff_hr_document_path(name)
  );

  drop policy if exists "staff hr document updates" on storage.objects;
  create policy "staff hr document updates"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'staff-hr-documents'
    and public.can_manage_staff_hr_document_path(name)
  )
  with check (
    bucket_id = 'staff-hr-documents'
    and public.can_manage_staff_hr_document_path(name)
  );

  drop policy if exists "staff hr document deletes" on storage.objects;
  create policy "staff hr document deletes"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'staff-hr-documents'
    and public.can_manage_staff_hr_document_path(name)
  );
end $$;

notify pgrst, 'reload schema';

commit;
