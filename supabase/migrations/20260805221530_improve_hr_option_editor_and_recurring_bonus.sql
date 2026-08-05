begin;

alter table public.staff_employee_profiles
  add column if not exists monthly_bonus_vnd integer not null default 0;

alter table public.staff_employee_profiles
  drop constraint if exists staff_employee_profiles_monthly_bonus_check,
  add constraint staff_employee_profiles_monthly_bonus_check
    check (monthly_bonus_vnd >= 0);

comment on column public.staff_employee_profiles.monthly_bonus_vnd is
  'Recurring monthly bonus included in payroll. The probation bonus percentage is applied while the employee is in probation.';

create or replace function public.apply_staff_probation_bonus_percentage()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_employee public.staff_employee_profiles%rowtype;
  v_period_end date;
  v_percentage numeric := 100;
  v_adjustment_bonus bigint := 0;
  v_recurring_bonus bigint := 0;
  v_original_bonus bigint := 0;
  v_adjusted_bonus bigint := 0;
  v_already_applied boolean := false;
begin
  select run.period_end
  into v_period_end
  from public.staff_payroll_runs run
  where run.id = new.payroll_run_id;

  select *
  into v_employee
  from public.staff_employee_profiles employee
  where employee.profile_id = new.profile_id;

  v_already_applied := coalesce((new.payslip_snapshot ->> 'probationBonusApplied')::boolean, false);
  v_adjustment_bonus := greatest(0, coalesce(new.bonuses_vnd, 0));
  v_recurring_bonus := greatest(0, coalesce(v_employee.monthly_bonus_vnd, 0));
  v_original_bonus := v_adjustment_bonus + v_recurring_bonus;

  if v_period_end is not null
    and v_employee.probation_start_date is not null
    and v_period_end >= v_employee.probation_start_date
    and (v_employee.probation_end_date is null or v_period_end <= v_employee.probation_end_date)
    and (v_employee.labor_start_date is null or v_period_end < v_employee.labor_start_date)
  then
    v_percentage := case when v_employee.probation_bonus_percentage = 85 then 85 else 100 end;
  end if;

  if v_already_applied then
    v_adjusted_bonus := v_adjustment_bonus;
  else
    v_adjusted_bonus := round(v_original_bonus * v_percentage / 100.0);
    new.bonuses_vnd := v_adjusted_bonus;
    new.gross_income_vnd := greatest(0, coalesce(new.gross_income_vnd, 0) - v_adjustment_bonus + v_adjusted_bonus);
  end if;

  new.payslip_snapshot := coalesce(new.payslip_snapshot, '{}'::jsonb) || jsonb_build_object(
    'recurringMonthlyBonusVnd', v_recurring_bonus,
    'probationBonusPercentage', v_percentage,
    'probationBonusApplied', true
  );

  return new;
end;
$$;

revoke all on function public.apply_staff_probation_bonus_percentage() from public, anon, authenticated;
grant execute on function public.apply_staff_probation_bonus_percentage() to service_role;

create or replace function public.staff_update_hr_setup_option(p_option_id uuid, p_name text)
returns public.staff_hr_setup_options
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_option public.staff_hr_setup_options%rowtype;
  v_result public.staff_hr_setup_options%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_old_token text;
  v_new_token text;
begin
  if not private.is_staff_attendance_editor() then
    raise exception 'HR settings access required.';
  end if;
  if length(v_name) = 0 then
    raise exception 'Option name is required.';
  end if;

  select * into v_option
  from public.staff_hr_setup_options
  where id = p_option_id and deleted_at is null
  for update;

  if v_option.id is null then
    raise exception 'HR option not found.';
  end if;

  v_old_token := lower(regexp_replace(trim(v_option.name), '[[:space:]-]+', '_', 'g'));
  v_new_token := lower(regexp_replace(v_name, '[[:space:]-]+', '_', 'g'));

  if v_option.option_type = 'contract_status'
    and v_new_token not in ('active', 'probation', 'suspended', 'ended', 'draft')
  then
    raise exception 'Contract status must be Active, Probation, Suspended, Ended, or Draft.';
  end if;
  if v_option.option_type = 'employment_type'
    and v_new_token not in ('full_time', 'part_time', 'probation_full_time', 'probation_part_time', 'contractor', 'intern')
  then
    raise exception 'Employment type is not supported by payroll.';
  end if;

  case v_option.option_type
    when 'department' then
      update public.staff_employee_profiles set department = v_name
      where department = v_option.name and deleted_at is null;
    when 'job_title' then
      update public.staff_employee_profiles set job_title = v_name
      where job_title = v_option.name and deleted_at is null;
      update public.staff_schedule_shifts set shift_role = v_name
      where shift_role = v_option.name and deleted_at is null;
    when 'location' then
      update public.staff_employee_profiles
      set main_work_location = case when main_work_location = v_option.name then v_name else main_work_location end,
          payroll_location = case when payroll_location = v_option.name then v_name else payroll_location end
      where (main_work_location = v_option.name or payroll_location = v_option.name)
        and deleted_at is null;
      update public.staff_schedule_shifts set location = v_name
      where location = v_option.name and deleted_at is null;
      update public.staff_attendance_settings set location = v_name
      where location = v_option.name;
    when 'contract_status' then
      update public.staff_employee_profiles set contract_status = v_new_token
      where contract_status = v_old_token and deleted_at is null;
    when 'contract_type' then
      update public.staff_employee_profiles set contract_type = v_name
      where contract_type = v_option.name and deleted_at is null;
    when 'employment_type' then
      update public.staff_employee_profiles set employment_type = v_new_token
      where employment_type = v_old_token and deleted_at is null;
    else
      null;
  end case;

  update public.staff_hr_setup_options
  set name = v_name, active = true, updated_at = now()
  where id = p_option_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.staff_update_hr_setup_option(uuid, text) from public, anon;
grant execute on function public.staff_update_hr_setup_option(uuid, text) to authenticated;

commit;
