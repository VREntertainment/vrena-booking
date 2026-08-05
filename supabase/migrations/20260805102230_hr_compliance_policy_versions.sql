alter table public.staff_hr_settings
  add column if not exists policy_version text not null default 'VN-2026.1',
  add column if not exists effective_from date not null default date '2026-01-01',
  add column if not exists policy_status text not null default 'active',
  add column if not exists legal_source_url text,
  add column if not exists legal_reviewed_on date,
  add column if not exists personal_deduction_vnd integer not null default 15500000,
  add column if not exists dependent_deduction_vnd integer not null default 6200000,
  add column if not exists short_term_pit_rate numeric(5,2) not null default 10,
  add column if not exists pit_brackets jsonb not null default '[{"up_to":10000000,"rate":5},{"up_to":30000000,"rate":10},{"up_to":60000000,"rate":20},{"up_to":100000000,"rate":30},{"up_to":null,"rate":35}]'::jsonb,
  add column if not exists employee_social_insurance_rate numeric(5,2) not null default 8,
  add column if not exists employee_health_insurance_rate numeric(5,2) not null default 1.5,
  add column if not exists employee_unemployment_insurance_rate numeric(5,2) not null default 1,
  add column if not exists employer_social_insurance_rate numeric(5,2) not null default 17.5,
  add column if not exists employer_health_insurance_rate numeric(5,2) not null default 3,
  add column if not exists employer_unemployment_insurance_rate numeric(5,2) not null default 1,
  add column if not exists employer_trade_union_rate numeric(5,2) not null default 2,
  add column if not exists night_work_bonus_rate numeric(5,2) not null default 30,
  add column if not exists night_overtime_extra_rate numeric(5,2) not null default 20,
  add column if not exists leave_accrual_days_per_month numeric(5,2) not null default 1,
  add column if not exists leave_qualifying_worked_days integer not null default 16,
  add column if not exists leave_join_cutoff_day integer not null default 15,
  add column if not exists leave_exit_cutoff_day integer not null default 17,
  add column if not exists leave_carry_forward_month integer not null default 3,
  add column if not exists leave_carry_forward_day integer not null default 31;

alter table public.staff_hr_settings
  drop constraint if exists staff_hr_settings_policy_status_check,
  add constraint staff_hr_settings_policy_status_check check (policy_status in ('draft', 'active', 'retired')),
  drop constraint if exists staff_hr_settings_policy_version_check,
  add constraint staff_hr_settings_policy_version_check check (length(trim(policy_version)) > 0),
  drop constraint if exists staff_hr_settings_legal_source_url_check,
  add constraint staff_hr_settings_legal_source_url_check check (legal_source_url is null or legal_source_url ~ '^https://'),
  drop constraint if exists staff_hr_settings_pit_brackets_check,
  add constraint staff_hr_settings_pit_brackets_check check (jsonb_typeof(pit_brackets) = 'array' and jsonb_array_length(pit_brackets) > 0),
  drop constraint if exists staff_hr_settings_leave_days_check,
  add constraint staff_hr_settings_leave_days_check check (
    leave_qualifying_worked_days between 0 and 31
    and leave_join_cutoff_day between 1 and 31
    and leave_exit_cutoff_day between 1 and 31
    and leave_carry_forward_month between 1 and 12
    and leave_carry_forward_day between 1 and 31
  );

update public.staff_hr_settings
set
  policy_version = coalesce(nullif(trim(policy_version), ''), 'VN-2026.1'),
  effective_from = coalesce(effective_from, date '2026-01-01'),
  policy_status = 'active',
  legal_source_url = coalesce(legal_source_url, 'https://vanban.chinhphu.vn/?classid=1&docid=198540&pageid=27160&typegroupid=3'),
  legal_reviewed_on = coalesce(legal_reviewed_on, date '2026-08-05'),
  employee_contribution_rate = employee_social_insurance_rate + employee_health_insurance_rate + employee_unemployment_insurance_rate,
  employer_contribution_rate = employer_social_insurance_rate + employer_health_insurance_rate + employer_unemployment_insurance_rate
where id = 'default';

create table if not exists public.staff_hr_policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_version text not null check (length(trim(policy_version)) > 0),
  effective_from date not null,
  policy_status text not null default 'active' check (policy_status in ('draft', 'active', 'retired')),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  legal_source_url text check (legal_source_url is null or legal_source_url ~ '^https://'),
  legal_reviewed_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_version, effective_from)
);

alter table public.staff_hr_policy_versions enable row level security;

drop policy if exists "staff hr policy read" on public.staff_hr_policy_versions;
create policy "staff hr policy read"
on public.staff_hr_policy_versions for select to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select private.is_staff_attendance_editor())
);

grant select on public.staff_hr_policy_versions to authenticated;
revoke insert, update, delete on public.staff_hr_policy_versions from authenticated;
revoke all on public.staff_hr_policy_versions from anon;

create index if not exists staff_hr_policy_versions_created_by_idx
on public.staff_hr_policy_versions(created_by);

create or replace function public.capture_staff_hr_policy_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  new.employee_contribution_rate := new.employee_social_insurance_rate
    + new.employee_health_insurance_rate
    + new.employee_unemployment_insurance_rate;
  new.employer_contribution_rate := new.employer_social_insurance_rate
    + new.employer_health_insurance_rate
    + new.employer_unemployment_insurance_rate
    + new.employer_trade_union_rate;
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  new.updated_at := now();

  insert into public.staff_hr_policy_versions (
    policy_version, effective_from, policy_status, settings,
    legal_source_url, legal_reviewed_on, created_by, updated_at
  ) values (
    new.policy_version,
    new.effective_from,
    new.policy_status,
    to_jsonb(new) - 'updated_by' - 'updated_at' - 'last_auto_payroll_sync_on',
    new.legal_source_url,
    new.legal_reviewed_on,
    new.updated_by,
    now()
  )
  on conflict (policy_version, effective_from) do update
  set
    policy_status = excluded.policy_status,
    settings = excluded.settings,
    legal_source_url = excluded.legal_source_url,
    legal_reviewed_on = excluded.legal_reviewed_on,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_hr_settings_capture_policy_version on public.staff_hr_settings;
create trigger staff_hr_settings_capture_policy_version
before insert or update on public.staff_hr_settings
for each row execute function public.capture_staff_hr_policy_version();

revoke all on function public.capture_staff_hr_policy_version() from public, anon, authenticated;

-- Seed the first immutable policy snapshot without changing any historical payroll item.
update public.staff_hr_settings set updated_at = now() where id = 'default';

create or replace function public.staff_progressive_pit(
  p_taxable_income bigint,
  p_brackets jsonb
)
returns bigint
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_bracket jsonb;
  v_previous_cap numeric := 0;
  v_cap numeric;
  v_rate numeric;
  v_remaining numeric := greatest(0, coalesce(p_taxable_income, 0));
  v_tax numeric := 0;
begin
  if v_remaining <= 0 then return 0; end if;
  for v_bracket in select value from jsonb_array_elements(coalesce(p_brackets, '[]'::jsonb)) loop
    v_cap := nullif(v_bracket ->> 'up_to', '')::numeric;
    v_rate := greatest(0, coalesce((v_bracket ->> 'rate')::numeric, 0));
    if v_cap is null then
      v_tax := v_tax + v_remaining * v_rate / 100;
      v_remaining := 0;
    else
      v_tax := v_tax + least(v_remaining, greatest(0, v_cap - v_previous_cap)) * v_rate / 100;
      v_remaining := greatest(0, v_remaining - greatest(0, v_cap - v_previous_cap));
      v_previous_cap := v_cap;
    end if;
    exit when v_remaining <= 0;
  end loop;
  return round(v_tax)::bigint;
end;
$$;

revoke all on function public.staff_progressive_pit(bigint, jsonb) from public, anon;
grant execute on function public.staff_progressive_pit(bigint, jsonb) to authenticated, service_role;

alter table public.staff_hr_adjustments
  add column if not exists taxable boolean not null default true,
  add column if not exists social_insurance_subject boolean not null default false;

create or replace function public.enforce_staff_payroll_compliance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_settings public.staff_hr_settings%rowtype;
  v_policy jsonb;
  v_employee public.staff_employee_profiles%rowtype;
  v_period_end date;
  v_contribution_base bigint := 0;
  v_employee_rate numeric := 0;
  v_employer_rate numeric := 0;
  v_trade_union_rate numeric := 0;
  v_taxable_income bigint := 0;
  v_original_overtime_pay bigint := 0;
  v_hourly_rate numeric := 0;
  v_regular_overtime_minutes integer := 0;
  v_night_overtime_minutes integer := 0;
  v_holiday_overtime_minutes integer := 0;
begin
  select run.period_end into v_period_end
  from public.staff_payroll_runs run where run.id = new.payroll_run_id;

  select * into v_settings from public.staff_hr_settings where id = 'default';
  select version.settings into v_policy
  from public.staff_hr_policy_versions version
  where version.policy_status = 'active'
    and version.effective_from <= coalesce(v_period_end, current_date)
  order by version.effective_from desc, version.updated_at desc
  limit 1;
  if v_policy is not null then
    v_settings := jsonb_populate_record(v_settings, v_policy);
  end if;

  select * into v_employee
  from public.staff_employee_profiles employee
  where employee.profile_id = new.profile_id;

  -- Attendance category minutes overlap in the legacy function. Rebuild overtime
  -- once, with holiday taking priority over night and night over ordinary OT.
  v_original_overtime_pay := coalesce(new.overtime_pay_vnd, 0);
  v_hourly_rate := coalesce(
    nullif(new.payslip_snapshot ->> 'payrollHourlyRateVnd', '')::numeric,
    nullif(v_employee.hourly_rate_vnd, 0),
    nullif(v_employee.base_salary_vnd, 0) / greatest(1, v_settings.standard_monthly_hours),
    0
  );
  v_holiday_overtime_minutes := least(greatest(0, coalesce(new.holiday_minutes, 0)), greatest(0, coalesce(new.overtime_minutes, 0)));
  v_night_overtime_minutes := least(
    greatest(0, coalesce(new.night_minutes, 0)),
    greatest(0, coalesce(new.overtime_minutes, 0) - v_holiday_overtime_minutes)
  );
  v_regular_overtime_minutes := greatest(0, coalesce(new.overtime_minutes, 0) - v_holiday_overtime_minutes - v_night_overtime_minutes);
  new.overtime_pay_vnd := round(
    (v_regular_overtime_minutes / 60.0) * v_hourly_rate * v_settings.normal_overtime_multiplier
    + (v_night_overtime_minutes / 60.0) * v_hourly_rate * (
      v_settings.normal_overtime_multiplier
      + v_settings.night_work_bonus_rate / 100.0
      + v_settings.night_overtime_extra_rate / 100.0
    )
    + (v_holiday_overtime_minutes / 60.0) * v_hourly_rate * v_settings.holiday_overtime_multiplier
  );
  new.gross_income_vnd := greatest(0, new.gross_income_vnd - v_original_overtime_pay + new.overtime_pay_vnd);

  if v_settings.social_insurance_enabled
    and coalesce(v_employee.social_insurance_enrolled, false)
    and coalesce(v_employee.contract_status, '') = 'active'
  then
    v_contribution_base := greatest(0, coalesce(nullif(v_employee.social_insurance_salary_vnd, 0), nullif(v_employee.base_salary_vnd, 0), 0));
    v_employee_rate := v_settings.employee_social_insurance_rate
      + v_settings.employee_health_insurance_rate
      + v_settings.employee_unemployment_insurance_rate;
    v_employer_rate := v_settings.employer_social_insurance_rate
      + v_settings.employer_health_insurance_rate
      + v_settings.employer_unemployment_insurance_rate;
    v_trade_union_rate := v_settings.employer_trade_union_rate;
  end if;

  new.employee_contributions_vnd := round(v_contribution_base * v_employee_rate / 100.0);
  new.employer_contributions_vnd := round(v_contribution_base * (v_employer_rate + v_trade_union_rate) / 100.0);

  v_taxable_income := greatest(
    0,
    new.gross_income_vnd
      - new.employee_contributions_vnd
      - v_settings.personal_deduction_vnd
      - greatest(0, coalesce(v_employee.dependents_count, 0)) * v_settings.dependent_deduction_vnd
  );
  if not v_settings.personal_income_tax_enabled then
    new.pit_withholding_vnd := 0;
  elsif coalesce(v_employee.pit_withholding_rate, 0) > 0 then
    new.pit_withholding_vnd := round(greatest(0, new.gross_income_vnd - new.employee_contributions_vnd) * v_employee.pit_withholding_rate / 100.0);
  else
    new.pit_withholding_vnd := public.staff_progressive_pit(v_taxable_income, v_settings.pit_brackets);
  end if;

  new.net_income_vnd := greatest(0, new.gross_income_vnd - new.employee_contributions_vnd - new.pit_withholding_vnd - new.deductions_vnd - new.advances_vnd);
  new.company_cost_vnd := greatest(0, new.gross_income_vnd + new.employer_contributions_vnd);
  new.payslip_snapshot := coalesce(new.payslip_snapshot, '{}'::jsonb) || jsonb_build_object(
    'policyVersion', v_settings.policy_version,
    'policyEffectiveFrom', v_settings.effective_from,
    'taxableIncomeVnd', v_taxable_income,
    'employeeContributionRate', v_employee_rate,
    'employerContributionRate', v_employer_rate,
    'tradeUnionRate', v_trade_union_rate,
    'legalSourceUrl', v_settings.legal_source_url
  );
  return new;
end;
$$;

drop trigger if exists staff_payroll_items_enforce_compliance on public.staff_payroll_items;
create trigger staff_payroll_items_enforce_compliance
before insert or update of gross_income_vnd, deductions_vnd, advances_vnd, payroll_run_id, profile_id
on public.staff_payroll_items
for each row execute function public.enforce_staff_payroll_compliance();

revoke all on function public.enforce_staff_payroll_compliance() from public, anon, authenticated;
revoke all on function public.staff_progressive_pit(bigint, jsonb) from public, anon, authenticated;

create or replace function public.staff_upsert_hr_setup_option(p_option_type text, p_name text)
returns public.staff_hr_setup_options
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare v_result public.staff_hr_setup_options%rowtype;
begin
  if not private.is_staff_attendance_editor() then raise exception 'HR settings access required.'; end if;
  if p_option_type not in ('department','job_title','location','contract_status','contract_type','employment_type','payroll_template','allowance','deduction') then
    raise exception 'Unsupported HR option type.';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Option name is required.'; end if;
  insert into public.staff_hr_setup_options(option_type, name, active, sort_order, created_by)
  values (p_option_type, trim(p_name), true,
    coalesce((select max(sort_order) + 10 from public.staff_hr_setup_options where option_type = p_option_type and deleted_at is null), 10),
    (select auth.uid()))
  on conflict (option_type, lower(name)) where deleted_at is null
  do update set active = true, name = excluded.name, updated_at = now()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.staff_set_hr_setup_option_active(p_option_id uuid, p_active boolean)
returns public.staff_hr_setup_options
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare v_result public.staff_hr_setup_options%rowtype;
begin
  if not private.is_staff_attendance_editor() then raise exception 'HR settings access required.'; end if;
  update public.staff_hr_setup_options
  set active = coalesce(p_active, false), updated_at = now()
  where id = p_option_id and deleted_at is null
  returning * into v_result;
  if v_result.id is null then raise exception 'HR option not found.'; end if;
  return v_result;
end;
$$;

revoke all on function public.staff_upsert_hr_setup_option(text, text) from public, anon;
revoke all on function public.staff_set_hr_setup_option_active(uuid, boolean) from public, anon;
grant execute on function public.staff_upsert_hr_setup_option(text, text) to authenticated;
grant execute on function public.staff_set_hr_setup_option_active(uuid, boolean) to authenticated;

-- Backfill option dictionaries from actual HR records, then keep the July master defaults.
insert into public.staff_hr_setup_options(option_type, name, active, sort_order)
select source.option_type, min(source.name), true, row_number() over (partition by source.option_type order by lower(source.name)) * 10
from (
  select distinct 'department'::text option_type, trim(department) name from public.staff_employee_profiles where nullif(trim(department), '') is not null and deleted_at is null
  union select distinct 'job_title', trim(job_title) from public.staff_employee_profiles where nullif(trim(job_title), '') is not null and deleted_at is null
  union select distinct 'location', trim(main_work_location) from public.staff_employee_profiles where nullif(trim(main_work_location), '') is not null and deleted_at is null
  union select distinct 'location', trim(payroll_location) from public.staff_employee_profiles where nullif(trim(payroll_location), '') is not null and deleted_at is null
  union select distinct 'contract_type', trim(contract_type) from public.staff_employee_profiles where nullif(trim(contract_type), '') is not null and deleted_at is null
) source
group by source.option_type, lower(source.name)
on conflict (option_type, lower(name)) where deleted_at is null do update set active = true, updated_at = now();

insert into public.staff_hr_setup_options(option_type, name, active, sort_order)
values
  ('department','GC',true,10),('department','VRena',true,20),('department','Manager',true,30),('department','Office',true,40),
  ('location','HaDo',true,10),('location','CS',true,20),
  ('contract_status','active',true,10),('contract_status','probation',true,20),('contract_status','suspended',true,30),('contract_status','ended',true,40),('contract_status','draft',true,50),
  ('employment_type','Full-time',true,10),('employment_type','Part-time',true,20),('employment_type','Probation full-time',true,30),('employment_type','Probation part-time',true,40),('employment_type','Contractor',true,50),('employment_type','Intern',true,60)
on conflict (option_type, lower(name)) where deleted_at is null do update set active = true, sort_order = excluded.sort_order, updated_at = now();

comment on table public.staff_hr_policy_versions is
  'Effective-dated, immutable-at-period payroll policy snapshots. Historical approved payroll remains unchanged.';
comment on column public.staff_hr_settings.pit_brackets is
  'Ordered monthly progressive PIT brackets. Each object contains up_to VND or null and a percentage rate.';
