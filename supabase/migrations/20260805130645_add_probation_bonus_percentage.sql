begin;

alter table public.staff_employee_profiles
  add column if not exists probation_bonus_percentage numeric(5,2) not null default 100;

alter table public.staff_employee_profiles
  drop constraint if exists staff_employee_profiles_probation_bonus_percentage_check,
  add constraint staff_employee_profiles_probation_bonus_percentage_check
    check (probation_bonus_percentage in (85, 100));

comment on column public.staff_employee_profiles.probation_bonus_percentage is
  'Percentage of approved bonus and commission amounts paid while the payroll period is inside the employee probation dates. Existing employees default to 100 percent.';

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
  v_original_bonus := greatest(0, coalesce(new.bonuses_vnd, 0));

  if v_period_end is not null
    and v_employee.probation_start_date is not null
    and v_period_end >= v_employee.probation_start_date
    and (v_employee.probation_end_date is null or v_period_end <= v_employee.probation_end_date)
    and (v_employee.labor_start_date is null or v_period_end < v_employee.labor_start_date)
  then
    v_percentage := case when v_employee.probation_bonus_percentage = 85 then 85 else 100 end;
  end if;

  if v_already_applied then
    v_adjusted_bonus := v_original_bonus;
  else
    v_adjusted_bonus := round(v_original_bonus * v_percentage / 100.0);
    new.bonuses_vnd := v_adjusted_bonus;
    new.gross_income_vnd := greatest(0, coalesce(new.gross_income_vnd, 0) - v_original_bonus + v_adjusted_bonus);
  end if;

  new.payslip_snapshot := coalesce(new.payslip_snapshot, '{}'::jsonb) || jsonb_build_object(
    'probationBonusPercentage', v_percentage,
    'probationBonusApplied', true
  );

  return new;
end;
$$;

drop trigger if exists staff_payroll_items_apply_probation_bonus on public.staff_payroll_items;
create trigger staff_payroll_items_apply_probation_bonus
before insert or update of bonuses_vnd, payroll_run_id, profile_id
on public.staff_payroll_items
for each row execute function public.apply_staff_probation_bonus_percentage();

revoke all on function public.apply_staff_probation_bonus_percentage() from public, anon, authenticated;
grant execute on function public.apply_staff_probation_bonus_percentage() to service_role;

commit;
