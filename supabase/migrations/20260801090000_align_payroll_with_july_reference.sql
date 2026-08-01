-- Align automatic payroll with the verified July 2026 payroll workbook.
-- Zero employee meal allowance means "inherit the company setting".

alter table public.staff_hr_settings
  alter column standard_monthly_hours set default 169,
  alter column lunch_allowance_vnd set default 35000;

update public.staff_hr_settings
set
  standard_monthly_hours = case when standard_monthly_hours = 208 then 169 else standard_monthly_hours end,
  lunch_allowance_vnd = case when lunch_allowance_vnd = 0 then 35000 else lunch_allowance_vnd end,
  updated_at = now()
where id = 'default'
  and (standard_monthly_hours = 208 or lunch_allowance_vnd = 0);

create table if not exists public.staff_payroll_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_name text not null,
  source_url text,
  period_start date not null,
  period_end date not null,
  employee_code text not null,
  employee_name text not null,
  division text,
  employment_status text,
  bank_name text,
  bank_account_number text,
  contract_rate_vnd integer not null default 0 check (contract_rate_vnd >= 0),
  worked_minutes integer check (worked_minutes >= 0),
  worked_days numeric(9, 4) check (worked_days >= 0),
  basic_days numeric(7, 2) check (basic_days >= 0),
  paid_leave_days numeric(7, 2) not null default 0 check (paid_leave_days >= 0),
  salary_paid_minutes integer not null default 0 check (salary_paid_minutes >= 0),
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  meal_days integer not null default 0 check (meal_days >= 0),
  base_pay_vnd integer not null default 0 check (base_pay_vnd >= 0),
  meal_allowance_vnd integer not null default 0 check (meal_allowance_vnd >= 0),
  overtime_pay_vnd integer not null default 0 check (overtime_pay_vnd >= 0),
  gross_income_vnd integer not null default 0 check (gross_income_vnd >= 0),
  taxable_income_vnd integer not null default 0 check (taxable_income_vnd >= 0),
  pit_withheld_vnd integer not null default 0 check (pit_withheld_vnd >= 0),
  employee_insurance_vnd integer not null default 0 check (employee_insurance_vnd >= 0),
  net_payable_vnd integer not null default 0 check (net_payable_vnd >= 0),
  leave_opening numeric(7, 2),
  leave_accrual numeric(7, 2),
  leave_used numeric(7, 2),
  leave_closing numeric(7, 2),
  leave_payout_vnd integer,
  details text,
  source_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  constraint staff_payroll_source_snapshots_period_order check (period_end >= period_start),
  unique (source_key, employee_code)
);

create index if not exists staff_payroll_source_snapshots_period_idx
  on public.staff_payroll_source_snapshots (period_start, period_end, employee_code);

alter table public.staff_payroll_source_snapshots enable row level security;

revoke all on table public.staff_payroll_source_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.staff_payroll_source_snapshots to authenticated;
grant all on table public.staff_payroll_source_snapshots to service_role;

drop policy if exists "staff payroll source snapshots read" on public.staff_payroll_source_snapshots;
create policy "staff payroll source snapshots read"
on public.staff_payroll_source_snapshots
for select to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select public.can_read_staff_attendance_settings())
);

drop policy if exists "staff payroll source snapshots manage" on public.staff_payroll_source_snapshots;
create policy "staff payroll source snapshots manage"
on public.staff_payroll_source_snapshots
for all to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select public.is_staff_attendance_editor())
)
with check (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (select public.is_staff_attendance_editor())
);

create or replace function public.staff_sync_payroll_draft(
  p_run_date date default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.staff_hr_settings%rowtype;
  v_period_start date;
  v_period_end date;
  v_run_code text;
  v_run_id uuid;
  v_existing_status text;
  v_item_count integer := 0;
begin
  if auth.uid() is not null and coalesce(public.current_staff_role_rank(), 0) < 100 then
    raise exception 'Only an owner or administrator can synchronize payroll.';
  end if;

  select * into v_settings
  from public.staff_hr_settings
  where id = 'default';

  if not found then
    raise exception 'HR salary settings are not configured.';
  end if;

  if not p_force
    and not v_settings.auto_create_payroll_runs
    and not v_settings.auto_update_payroll_daily
  then
    return jsonb_build_object('skipped', true, 'reason', 'automation_disabled');
  end if;

  if extract(day from p_run_date)::integer >= v_settings.pay_period_start_day then
    v_period_start := make_date(
      extract(year from p_run_date)::integer,
      extract(month from p_run_date)::integer,
      v_settings.pay_period_start_day
    );
  else
    v_period_start := (
      date_trunc('month', p_run_date)::date - interval '1 month'
      + (v_settings.pay_period_start_day - 1) * interval '1 day'
    )::date;
  end if;
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;
  v_run_code := 'AUTO-' || to_char(v_period_start, 'YYYYMMDD');

  select id, status into v_run_id, v_existing_status
  from public.staff_payroll_runs
  where code = v_run_code
    and deleted_at is null;

  if v_run_id is null and not (p_force or v_settings.auto_create_payroll_runs) then
    return jsonb_build_object('skipped', true, 'reason', 'auto_create_disabled');
  end if;
  if v_existing_status in ('approved', 'paid', 'cancelled') then
    return jsonb_build_object('skipped', true, 'reason', 'payroll_locked', 'payroll_run_id', v_run_id);
  end if;

  insert into public.staff_payroll_runs (
    code, name, pay_cycle, period_start, period_end, status, generated_by, notes
  ) values (
    v_run_code,
    'Automatic payroll ' || to_char(v_period_start, 'DD/MM/YYYY') || ' - ' || to_char(v_period_end, 'DD/MM/YYYY'),
    'monthly', v_period_start, v_period_end, 'draft', auth.uid(),
    'Automatically synchronized from HR attendance using the July 2026 payroll policy.'
  )
  on conflict (code) do update
  set
    name = excluded.name,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    updated_at = now()
  returning id into v_run_id;

  if p_force or v_settings.auto_update_payroll_daily or v_existing_status is null then
    with employee_rows as (
      select
        employee.profile_id,
        employee.employee_code,
        employee.legal_name,
        employee.employment_type,
        employee.contract_status,
        coalesce(employee.base_salary_vnd, 0) as base_salary_vnd,
        coalesce(employee.hourly_rate_vnd, 0) as configured_hourly_rate_vnd,
        coalesce(nullif(employee.lunch_allowance_vnd, 0), v_settings.lunch_allowance_vnd, 0) as lunch_allowance_vnd,
        coalesce(employee.overtime_rate_multiplier, v_settings.normal_overtime_multiplier, 0) as overtime_rate,
        coalesce(employee.night_rate_multiplier, v_settings.night_overtime_multiplier, 0) as night_rate,
        coalesce(employee.holiday_rate_multiplier, v_settings.holiday_overtime_multiplier, 0) as holiday_rate,
        coalesce(employee.employee_contribution_rate, v_settings.employee_contribution_rate, 0) as employee_contribution_rate,
        coalesce(employee.employer_contribution_rate, v_settings.employer_contribution_rate, 0) as employer_contribution_rate,
        coalesce(employee.pit_withholding_rate, v_settings.pit_withholding_rate, 0) as pit_rate
      from public.staff_employee_profiles as employee
      where employee.active = true
        and employee.contract_status in ('active', 'probation')
        and employee.deleted_at is null
    ),
    schedule_rows as (
      select
        shift.staff_profile_id as profile_id,
        coalesce(sum(greatest(
          0,
          floor(extract(epoch from (
            (shift.shift_date + shift.end_time)::timestamp
            + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end
            - (shift.shift_date + shift.start_time)::timestamp
          )) / 60)::integer - coalesce(shift.break_minutes, 0)
        )), 0)::integer as scheduled_minutes
      from public.staff_schedule_shifts as shift
      where shift.shift_date between v_period_start and v_period_end
        and shift.status in ('draft', 'published', 'completed')
        and shift.deleted_at is null
      group by shift.staff_profile_id
    ),
    attendance_rows as (
      select
        log.staff_profile_id as profile_id,
        coalesce(sum(greatest(
          0,
          floor(extract(epoch from (log.clock_out_at - log.clock_in_at)) / 60)::integer
            - coalesce(log.break_minutes, 0)
        )) filter (where log.clock_in_at is not null and log.clock_out_at is not null), 0)::integer as worked_minutes,
        coalesce(sum(log.regular_minutes), 0)::integer as regular_minutes,
        coalesce(sum(log.overtime_minutes), 0)::integer as overtime_minutes,
        coalesce(sum(log.night_minutes), 0)::integer as night_minutes,
        coalesce(sum(log.holiday_minutes), 0)::integer as holiday_minutes,
        count(distinct log.work_date) filter (where log.clock_in_at is not null and log.clock_out_at is not null)::integer as worked_days
      from public.staff_attendance_logs as log
      where log.work_date between v_period_start and v_period_end
        and log.deleted_at is null
      group by log.staff_profile_id
    ),
    leave_rows as (
      select
        leave_request.staff_profile_id as profile_id,
        coalesce(sum(
          leave_request.hours
          * ((least(leave_request.end_date, v_period_end) - greatest(leave_request.start_date, v_period_start) + 1)::numeric
            / greatest(1, leave_request.end_date - leave_request.start_date + 1))
        ), 0)::numeric(7, 2) as paid_leave_hours
      from public.staff_leave_requests as leave_request
      join employee_rows as employee on employee.profile_id = leave_request.staff_profile_id
      where leave_request.status = 'approved'
        and leave_request.leave_type in ('annual', 'public_holiday')
        and employee.employment_type in ('full_time', 'probation_full_time')
        and leave_request.end_date >= v_period_start
        and leave_request.start_date <= v_period_end
        and leave_request.deleted_at is null
      group by leave_request.staff_profile_id
    ),
    adjustment_rows as (
      select
        adjustment.profile_id,
        coalesce(sum(adjustment.amount_vnd) filter (where adjustment.adjustment_type in ('allowance', 'lunch_allowance')), 0)::integer as allowances,
        coalesce(sum(adjustment.amount_vnd) filter (where adjustment.adjustment_type in ('bonus', 'commission')), 0)::integer as bonuses,
        coalesce(sum(adjustment.amount_vnd) filter (where adjustment.adjustment_type in ('advance', 'debt', 'debt_repayment')), 0)::integer as advances,
        coalesce(sum(adjustment.amount_vnd) filter (where adjustment.adjustment_type = 'deduction'), 0)::integer as deductions
      from public.staff_hr_adjustments as adjustment
      where adjustment.status in ('approved', 'paid')
        and adjustment.deleted_at is null
        and (
          (adjustment.period_start is not null and adjustment.period_end is not null
            and adjustment.period_start <= v_period_end and adjustment.period_end >= v_period_start)
          or
          ((adjustment.period_start is null or adjustment.period_end is null)
            and adjustment.effective_date between v_period_start and v_period_end)
        )
      group by adjustment.profile_id
    ),
    base_rows as (
      select
        employee.*,
        coalesce(schedule.scheduled_minutes, 0) as scheduled_minutes,
        greatest(round(v_settings.standard_monthly_hours * 60)::integer, coalesce(schedule.scheduled_minutes, 0), 1) as period_standard_minutes,
        coalesce(attendance.worked_minutes, 0) as worked_minutes,
        coalesce(attendance.regular_minutes, 0) as logged_regular_minutes,
        case
          when coalesce(attendance.overtime_minutes, 0) > 0 then attendance.overtime_minutes
          when coalesce(schedule.scheduled_minutes, 0) > 0 then greatest(
            0,
            coalesce(attendance.worked_minutes, 0)
              - coalesce(nullif(attendance.regular_minutes, 0), least(coalesce(attendance.worked_minutes, 0), schedule.scheduled_minutes))
          )
          else 0
        end::integer as overtime_minutes,
        coalesce(attendance.night_minutes, 0) as night_minutes,
        coalesce(attendance.holiday_minutes, 0) as holiday_minutes,
        coalesce(attendance.worked_days, 0) as worked_days,
        coalesce(leave_data.paid_leave_hours, 0) as paid_leave_hours,
        coalesce(adjustment.allowances, 0) + employee.lunch_allowance_vnd * coalesce(attendance.worked_days, 0) as allowances,
        coalesce(adjustment.bonuses, 0) as bonuses,
        coalesce(adjustment.advances, 0) as advances,
        coalesce(adjustment.deductions, 0) as deductions
      from employee_rows as employee
      left join schedule_rows as schedule on schedule.profile_id = employee.profile_id
      left join attendance_rows as attendance on attendance.profile_id = employee.profile_id
      left join leave_rows as leave_data on leave_data.profile_id = employee.profile_id
      left join adjustment_rows as adjustment on adjustment.profile_id = employee.profile_id
    ),
    rate_rows as (
      select
        base.*,
        case
          when base.configured_hourly_rate_vnd > 0 then base.configured_hourly_rate_vnd
          when base.base_salary_vnd > 0 then base.base_salary_vnd / greatest(1, base.period_standard_minutes / 60.0)
          else 0
        end as payroll_hourly_rate_vnd,
        case
          when base.logged_regular_minutes > 0 then base.logged_regular_minutes
          else greatest(0, base.worked_minutes - base.overtime_minutes)
        end::integer as base_worked_minutes
      from base_rows as base
    ),
    pay_rows as (
      select
        rate.*,
        (rate.base_worked_minutes + round(rate.paid_leave_hours * 60)::integer) as salary_paid_minutes,
        case
          when rate.employment_type in ('full_time', 'probation_full_time') and rate.base_salary_vnd > 0
            then round(rate.base_salary_vnd * least(
              1,
              (rate.base_worked_minutes + rate.paid_leave_hours * 60) / greatest(1, rate.period_standard_minutes)::numeric
            ))::integer
          else round((rate.base_worked_minutes / 60.0) * rate.payroll_hourly_rate_vnd)::integer
        end as base_pay,
        round(
          (rate.overtime_minutes / 60.0) * rate.payroll_hourly_rate_vnd * rate.overtime_rate
          + (rate.night_minutes / 60.0) * rate.payroll_hourly_rate_vnd * greatest(0, rate.night_rate - 1)
          + (rate.holiday_minutes / 60.0) * rate.payroll_hourly_rate_vnd * greatest(0, rate.holiday_rate - 1)
        )::integer as overtime_pay,
        case
          when rate.employment_type = 'full_time' and rate.contract_status = 'active'
            then rate.base_salary_vnd
          else 0
        end::integer as contribution_base
      from rate_rows as rate
    ),
    gross_rows as (
      select
        pay.*,
        greatest(0, pay.base_pay + pay.overtime_pay + pay.allowances + pay.bonuses)::integer as gross_income
      from pay_rows as pay
    ),
    contribution_rows as (
      select
        gross.*,
        case when v_settings.social_insurance_enabled
          then round(gross.contribution_base * gross.employee_contribution_rate / 100.0)::integer else 0 end as employee_contributions,
        case when v_settings.social_insurance_enabled
          then round(gross.contribution_base * gross.employer_contribution_rate / 100.0)::integer else 0 end as employer_contributions
      from gross_rows as gross
    ),
    final_rows as (
      select
        contribution.*,
        case when v_settings.personal_income_tax_enabled
          then round(
            greatest(0, contribution.gross_income - contribution.employee_contributions - contribution.deductions - contribution.advances)
            * contribution.pit_rate / 100.0
          )::integer else 0 end as pit_withheld
      from contribution_rows as contribution
    )
    insert into public.staff_payroll_items (
      payroll_run_id, profile_id, payslip_number, worked_minutes, regular_minutes, overtime_minutes,
      night_minutes, holiday_minutes, paid_leave_hours, base_salary_vnd, overtime_pay_vnd, allowances_vnd,
      bonuses_vnd, advances_vnd, deductions_vnd, employee_contributions_vnd, employer_contributions_vnd,
      pit_withholding_vnd, gross_income_vnd, net_income_vnd, company_cost_vnd, status, payslip_snapshot,
      deleted_at, deleted_by, delete_reason
    )
    select
      v_run_id,
      final.profile_id,
      v_run_code || '-' || coalesce(final.employee_code, left(final.profile_id::text, 6)),
      final.worked_minutes,
      final.base_worked_minutes,
      final.overtime_minutes,
      final.night_minutes,
      final.holiday_minutes,
      final.paid_leave_hours,
      final.base_pay,
      final.overtime_pay,
      final.allowances,
      final.bonuses,
      final.advances,
      final.deductions,
      final.employee_contributions,
      final.employer_contributions,
      final.pit_withheld,
      final.gross_income,
      greatest(0, final.gross_income - final.employee_contributions - final.pit_withheld - final.deductions - final.advances),
      greatest(0, final.gross_income + final.employer_contributions),
      'draft',
      jsonb_build_object(
        'employeeCode', final.employee_code,
        'employeeName', final.legal_name,
        'periodStart', v_period_start,
        'periodEnd', v_period_end,
        'currency', v_settings.currency,
        'automated', true,
        'workedDays', final.worked_days,
        'periodStandardMinutes', final.period_standard_minutes,
        'salaryPaidMinutes', final.salary_paid_minutes,
        'payrollHourlyRateVnd', final.payroll_hourly_rate_vnd,
        'contributionBaseVnd', final.contribution_base,
        'policyReference', 'VR_Payroll_July_2026_QA'
      ),
      null, null, null
    from final_rows as final
    on conflict (payroll_run_id, profile_id) do update
    set
      payslip_number = excluded.payslip_number,
      worked_minutes = excluded.worked_minutes,
      regular_minutes = excluded.regular_minutes,
      overtime_minutes = excluded.overtime_minutes,
      night_minutes = excluded.night_minutes,
      holiday_minutes = excluded.holiday_minutes,
      paid_leave_hours = excluded.paid_leave_hours,
      base_salary_vnd = excluded.base_salary_vnd,
      overtime_pay_vnd = excluded.overtime_pay_vnd,
      allowances_vnd = excluded.allowances_vnd,
      bonuses_vnd = excluded.bonuses_vnd,
      advances_vnd = excluded.advances_vnd,
      deductions_vnd = excluded.deductions_vnd,
      employee_contributions_vnd = excluded.employee_contributions_vnd,
      employer_contributions_vnd = excluded.employer_contributions_vnd,
      pit_withholding_vnd = excluded.pit_withholding_vnd,
      gross_income_vnd = excluded.gross_income_vnd,
      net_income_vnd = excluded.net_income_vnd,
      company_cost_vnd = excluded.company_cost_vnd,
      payslip_snapshot = excluded.payslip_snapshot,
      deleted_at = null,
      deleted_by = null,
      delete_reason = null,
      updated_at = now();

    get diagnostics v_item_count = row_count;

    update public.staff_payroll_items as item
    set deleted_at = now(), delete_reason = 'No longer active during automatic payroll synchronization.'
    where item.payroll_run_id = v_run_id
      and item.deleted_at is null
      and not exists (
        select 1 from public.staff_employee_profiles as employee
        where employee.profile_id = item.profile_id
          and employee.active = true
          and employee.contract_status in ('active', 'probation')
          and employee.deleted_at is null
      );

    update public.staff_payroll_runs as run
    set
      total_gross_vnd = totals.total_gross,
      total_net_vnd = totals.total_net,
      total_company_cost_vnd = totals.total_company_cost,
      updated_at = now()
    from (
      select
        coalesce(sum(item.gross_income_vnd), 0)::integer as total_gross,
        coalesce(sum(item.net_income_vnd), 0)::integer as total_net,
        coalesce(sum(item.company_cost_vnd), 0)::integer as total_company_cost
      from public.staff_payroll_items as item
      where item.payroll_run_id = v_run_id and item.deleted_at is null
    ) as totals
    where run.id = v_run_id;

    update public.staff_hr_settings
    set last_auto_payroll_sync_on = p_run_date
    where id = 'default';
  end if;

  return jsonb_build_object(
    'skipped', false,
    'payroll_run_id', v_run_id,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'item_count', v_item_count
  );
end;
$$;

revoke all on function public.staff_sync_payroll_draft(date, boolean)
from public, anon, authenticated;
grant execute on function public.staff_sync_payroll_draft(date, boolean)
to authenticated, service_role;

comment on function public.staff_sync_payroll_draft(date, boolean) is
  'Builds draft payroll using paid annual leave, per-worked-day meal allowance, and non-duplicated overtime rules aligned to VR_Payroll_July_2026_QA.';
