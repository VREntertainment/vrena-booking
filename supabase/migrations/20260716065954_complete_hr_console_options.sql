begin;

alter table public.staff_attendance_settings
  add column if not exists half_day_enabled boolean not null default true,
  add column if not exists half_day_min_minutes integer not null default 0,
  add column if not exists half_day_max_minutes integer not null default 270,
  add column if not exists count_late_early_on_half_day boolean not null default false,
  add column if not exists late_arrival_enabled boolean not null default true,
  add column if not exists late_after_minutes integer not null default 5,
  add column if not exists early_leave_enabled boolean not null default true,
  add column if not exists early_leave_before_minutes integer not null default 5,
  add column if not exists overtime_before_shift_enabled boolean not null default false,
  add column if not exists overtime_before_shift_minutes integer not null default 10,
  add column if not exists overtime_after_shift_enabled boolean not null default false,
  add column if not exists overtime_after_shift_minutes integer not null default 10,
  add column if not exists single_clock_for_consecutive_shifts boolean not null default true,
  add column if not exists work_week_start smallint not null default 1,
  add column if not exists weekly_rest_days smallint[] not null default array[0]::smallint[];

alter table public.staff_attendance_settings
  drop constraint if exists staff_attendance_settings_half_day_range_check,
  drop constraint if exists staff_attendance_settings_clock_rule_minutes_check,
  drop constraint if exists staff_attendance_settings_work_week_start_check,
  drop constraint if exists staff_attendance_settings_weekly_rest_days_check;

alter table public.staff_attendance_settings
  add constraint staff_attendance_settings_half_day_range_check check (
    half_day_min_minutes >= 0
    and half_day_max_minutes >= half_day_min_minutes
    and half_day_max_minutes <= 1440
  ),
  add constraint staff_attendance_settings_clock_rule_minutes_check check (
    late_after_minutes between 0 and 240
    and early_leave_before_minutes between 0 and 240
    and overtime_before_shift_minutes between 0 and 240
    and overtime_after_shift_minutes between 0 and 240
  ),
  add constraint staff_attendance_settings_work_week_start_check check (work_week_start between 0 and 6),
  add constraint staff_attendance_settings_weekly_rest_days_check check (
    weekly_rest_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );

alter table public.staff_hr_settings
  add column if not exists pay_period_start_day integer not null default 1,
  add column if not exists auto_create_payroll_runs boolean not null default false,
  add column if not exists auto_update_payroll_daily boolean not null default false,
  add column if not exists personal_income_tax_enabled boolean not null default true,
  add column if not exists social_insurance_enabled boolean not null default true,
  add column if not exists last_auto_payroll_sync_on date;

alter table public.staff_hr_settings
  drop constraint if exists staff_hr_settings_pay_period_start_day_check;

alter table public.staff_hr_settings
  add constraint staff_hr_settings_pay_period_start_day_check
    check (pay_period_start_day between 1 and 28);

alter table public.staff_hr_setup_options
  drop constraint if exists staff_hr_setup_options_option_type_check;

alter table public.staff_hr_setup_options
  add constraint staff_hr_setup_options_option_type_check check (
    option_type in (
      'department',
      'job_title',
      'location',
      'contract_status',
      'contract_type',
      'employment_type',
      'payroll_template',
      'allowance',
      'deduction'
    )
  );

insert into public.staff_hr_setup_options (option_type, name, sort_order)
values
  ('payroll_template', 'Standard monthly payroll', 10),
  ('allowance', 'Lunch', 10),
  ('allowance', 'Transportation', 20),
  ('allowance', 'Phone', 30),
  ('deduction', 'Late arrival', 10),
  ('deduction', 'Early leave', 20),
  ('deduction', 'Rule violation', 30)
on conflict do nothing;

alter table public.staff_attendance_logs
  add column if not exists late_minutes integer not null default 0,
  add column if not exists early_leave_minutes integer not null default 0,
  add column if not exists is_half_day boolean not null default false,
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

alter table public.staff_attendance_logs
  drop constraint if exists staff_attendance_logs_rule_minutes_check,
  drop constraint if exists staff_attendance_logs_approval_status_check;

alter table public.staff_attendance_logs
  add constraint staff_attendance_logs_rule_minutes_check check (
    late_minutes >= 0 and early_leave_minutes >= 0
  ),
  add constraint staff_attendance_logs_approval_status_check check (
    approval_status in ('pending', 'approved')
  );

create index if not exists staff_attendance_logs_approval_idx
  on public.staff_attendance_logs (approval_status, work_date, staff_profile_id)
  where deleted_at is null;

create table if not exists public.staff_attendance_approvals (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  approved_log_count integer not null default 0 check (approved_log_count >= 0),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_attendance_approvals_period_order check (period_end >= period_start),
  unique (period_start, period_end)
);

drop trigger if exists staff_attendance_approvals_touch_updated_at on public.staff_attendance_approvals;
create trigger staff_attendance_approvals_touch_updated_at
before update on public.staff_attendance_approvals
for each row execute function public.staff_attendance_touch_updated_at();

alter table public.staff_attendance_approvals enable row level security;

revoke all on table public.staff_attendance_approvals from public, anon, authenticated;
grant select on table public.staff_attendance_approvals to authenticated;
grant all on table public.staff_attendance_approvals to service_role;

drop policy if exists "staff attendance approvals read" on public.staff_attendance_approvals;
create policy "staff attendance approvals read"
on public.staff_attendance_approvals
for select to authenticated
using (public.current_staff_role_rank() >= 20);

create or replace function public.staff_attendance_apply_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_settings public.staff_attendance_settings%rowtype;
  v_shift_start timestamp;
  v_shift_end timestamp;
  v_scheduled_minutes integer := 0;
  v_clock_in timestamp;
  v_clock_out timestamp;
  v_worked_minutes integer := 0;
  v_raw_late_minutes integer := 0;
  v_raw_early_minutes integer := 0;
  v_before_shift_minutes integer := 0;
  v_after_shift_minutes integer := 0;
begin
  select * into v_settings
  from public.staff_attendance_settings
  where id = 'default';

  if not found then
    return new;
  end if;

  if coalesce(v_settings.single_clock_for_consecutive_shifts, true) then
    select
      min(shift.shift_date + shift.start_time),
      max(
        shift.shift_date + shift.end_time
        + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end
      ),
      coalesce(sum(greatest(
        0,
        floor(extract(epoch from (
          shift.shift_date + shift.end_time
          + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end
          - (shift.shift_date + shift.start_time)
        )) / 60)::integer - coalesce(shift.break_minutes, 0)
      )), 0)::integer
    into v_shift_start, v_shift_end, v_scheduled_minutes
    from public.staff_schedule_shifts as shift
    where shift.staff_profile_id = new.staff_profile_id
      and shift.shift_date = new.work_date
      and shift.status in ('published', 'completed')
      and shift.deleted_at is null;
  elsif new.shift_id is not null then
    select
      shift.shift_date + shift.start_time,
      shift.shift_date + shift.end_time
        + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end,
      greatest(
        0,
        floor(extract(epoch from (
          shift.shift_date + shift.end_time
          + case when shift.end_time <= shift.start_time then interval '1 day' else interval '0 day' end
          - (shift.shift_date + shift.start_time)
        )) / 60)::integer - coalesce(shift.break_minutes, 0)
      )
    into v_shift_start, v_shift_end, v_scheduled_minutes
    from public.staff_schedule_shifts as shift
    where shift.id = new.shift_id;
  end if;

  v_clock_in := new.clock_in_at at time zone 'Asia/Ho_Chi_Minh';
  v_clock_out := new.clock_out_at at time zone 'Asia/Ho_Chi_Minh';

  if v_clock_in is not null and v_shift_start is not null then
    v_raw_late_minutes := greatest(
      0,
      floor(extract(epoch from (v_clock_in - v_shift_start)) / 60)::integer
    );
    new.late_minutes := case
      when v_settings.late_arrival_enabled
        and v_raw_late_minutes > v_settings.late_after_minutes then v_raw_late_minutes
      else 0
    end;

    if new.status not in ('absent', 'no_show', 'leave', 'holiday') then
      new.status := case when new.late_minutes > 0 then 'late' else 'present' end;
    end if;
  else
    new.late_minutes := 0;
  end if;

  if v_clock_out is not null and v_shift_end is not null then
    v_raw_early_minutes := greatest(
      0,
      floor(extract(epoch from (v_shift_end - v_clock_out)) / 60)::integer
    );
    new.early_leave_minutes := case
      when v_settings.early_leave_enabled
        and v_raw_early_minutes > v_settings.early_leave_before_minutes then v_raw_early_minutes
      else 0
    end;
  else
    new.early_leave_minutes := 0;
  end if;

  if v_clock_in is not null and v_clock_out is not null then
    v_worked_minutes := greatest(
      0,
      floor(extract(epoch from (new.clock_out_at - new.clock_in_at)) / 60)::integer
        - coalesce(new.break_minutes, 0)
    );

    if v_shift_start is not null then
      v_before_shift_minutes := greatest(
        0,
        floor(extract(epoch from (v_shift_start - v_clock_in)) / 60)::integer
      );
    end if;
    if v_shift_end is not null then
      v_after_shift_minutes := greatest(
        0,
        floor(extract(epoch from (v_clock_out - v_shift_end)) / 60)::integer
      );
    end if;

    new.regular_minutes := case
      when v_scheduled_minutes > 0 then least(v_worked_minutes, v_scheduled_minutes)
      else least(v_worked_minutes, v_settings.standard_daily_minutes)
    end;
    new.overtime_minutes :=
      case
        when v_settings.overtime_before_shift_enabled
          and v_before_shift_minutes >= v_settings.overtime_before_shift_minutes
        then v_before_shift_minutes
        else 0
      end
      + case
        when v_settings.overtime_after_shift_enabled
          and v_after_shift_minutes >= v_settings.overtime_after_shift_minutes
        then v_after_shift_minutes
        else 0
      end;
    new.is_half_day := v_settings.half_day_enabled
      and v_worked_minutes > v_settings.half_day_min_minutes
      and v_worked_minutes <= v_settings.half_day_max_minutes;

    if new.is_half_day and not v_settings.count_late_early_on_half_day then
      new.late_minutes := 0;
      new.early_leave_minutes := 0;
      if new.status = 'late' then new.status := 'present'; end if;
    end if;
  else
    new.is_half_day := false;
  end if;

  if tg_op = 'UPDATE' and (
    new.clock_in_at is distinct from old.clock_in_at
    or new.clock_out_at is distinct from old.clock_out_at
    or new.break_minutes is distinct from old.break_minutes
    or new.shift_id is distinct from old.shift_id
    or new.status is distinct from old.status
  ) then
    new.approval_status := 'pending';
    new.approved_by := null;
    new.approved_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists staff_attendance_logs_apply_rules_insert on public.staff_attendance_logs;
create trigger staff_attendance_logs_apply_rules_insert
before insert on public.staff_attendance_logs
for each row execute function public.staff_attendance_apply_rules();

drop trigger if exists staff_attendance_logs_apply_rules_update on public.staff_attendance_logs;
create trigger staff_attendance_logs_apply_rules_update
before update of shift_id, clock_in_at, clock_out_at, break_minutes, status
on public.staff_attendance_logs
for each row execute function public.staff_attendance_apply_rules();

create or replace function public.staff_approve_attendance_period(
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce(public.current_staff_role_rank(), 0) < 100 then
    raise exception 'Only an owner or administrator can approve attendance.';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Choose a valid attendance approval period.';
  end if;

  update public.staff_attendance_logs
  set
    approval_status = 'approved',
    approved_by = v_actor,
    approved_at = now()
  where work_date between p_period_start and p_period_end
    and deleted_at is null;
  get diagnostics v_count = row_count;

  insert into public.staff_attendance_approvals (
    period_start,
    period_end,
    approved_log_count,
    approved_by,
    approved_at
  ) values (
    p_period_start,
    p_period_end,
    v_count,
    v_actor,
    now()
  )
  on conflict (period_start, period_end) do update
  set
    approved_log_count = excluded.approved_log_count,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at;

  return jsonb_build_object(
    'period_start', p_period_start,
    'period_end', p_period_end,
    'approved_log_count', v_count
  );
end;
$$;

revoke all on function public.staff_approve_attendance_period(date, date)
from public, anon, authenticated;
grant execute on function public.staff_approve_attendance_period(date, date)
to authenticated;

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
    code,
    name,
    pay_cycle,
    period_start,
    period_end,
    status,
    generated_by,
    notes
  ) values (
    v_run_code,
    'Automatic payroll ' || to_char(v_period_start, 'DD/MM/YYYY') || ' - ' || to_char(v_period_end, 'DD/MM/YYYY'),
    'monthly',
    v_period_start,
    v_period_end,
    'draft',
    auth.uid(),
    'Automatically synchronized from HR attendance.'
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
        coalesce(employee.base_salary_vnd, 0) as base_salary_vnd,
        coalesce(employee.hourly_rate_vnd, 0) as hourly_rate_vnd,
        coalesce(employee.lunch_allowance_vnd, v_settings.lunch_allowance_vnd, 0) as lunch_allowance_vnd,
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
        coalesce(sum(leave_request.hours), 0)::numeric(7, 2) as paid_leave_hours
      from public.staff_leave_requests as leave_request
      where leave_request.status = 'approved'
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
        coalesce(attendance.worked_minutes, 0) as worked_minutes,
        coalesce(attendance.regular_minutes, 0) as regular_minutes,
        coalesce(attendance.overtime_minutes, 0) as overtime_minutes,
        coalesce(attendance.night_minutes, 0) as night_minutes,
        coalesce(attendance.holiday_minutes, 0) as holiday_minutes,
        coalesce(attendance.worked_days, 0) as worked_days,
        coalesce(leave_data.paid_leave_hours, 0) as paid_leave_hours,
        coalesce(adjustment.allowances, 0) + employee.lunch_allowance_vnd * coalesce(attendance.worked_days, 0) as allowances,
        coalesce(adjustment.bonuses, 0) as bonuses,
        coalesce(adjustment.advances, 0) as advances,
        coalesce(adjustment.deductions, 0) as deductions
      from employee_rows as employee
      left join attendance_rows as attendance on attendance.profile_id = employee.profile_id
      left join leave_rows as leave_data on leave_data.profile_id = employee.profile_id
      left join adjustment_rows as adjustment on adjustment.profile_id = employee.profile_id
    ),
    pay_rows as (
      select
        base.*,
        case
          when base.employment_type in ('full_time', 'probation_full_time') and base.base_salary_vnd > 0
            then base.base_salary_vnd
          else round((base.worked_minutes / 60.0) * base.hourly_rate_vnd)::integer
        end as base_pay,
        round(
          (base.overtime_minutes / 60.0) * base.hourly_rate_vnd * base.overtime_rate
          + (base.night_minutes / 60.0) * base.hourly_rate_vnd * greatest(0, base.night_rate - 1)
          + (base.holiday_minutes / 60.0) * base.hourly_rate_vnd * greatest(0, base.holiday_rate - 1)
        )::integer as overtime_pay
      from base_rows as base
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
          then round(gross.gross_income * gross.employee_contribution_rate / 100.0)::integer
          else 0
        end as employee_contributions,
        case when v_settings.social_insurance_enabled
          then round(gross.gross_income * gross.employer_contribution_rate / 100.0)::integer
          else 0
        end as employer_contributions
      from gross_rows as gross
    ),
    final_rows as (
      select
        contribution.*,
        case when v_settings.personal_income_tax_enabled
          then round(
            greatest(0, contribution.gross_income - contribution.employee_contributions - contribution.deductions - contribution.advances)
            * contribution.pit_rate / 100.0
          )::integer
          else 0
        end as pit_withheld
      from contribution_rows as contribution
    )
    insert into public.staff_payroll_items (
      payroll_run_id,
      profile_id,
      payslip_number,
      worked_minutes,
      regular_minutes,
      overtime_minutes,
      night_minutes,
      holiday_minutes,
      paid_leave_hours,
      base_salary_vnd,
      overtime_pay_vnd,
      allowances_vnd,
      bonuses_vnd,
      advances_vnd,
      deductions_vnd,
      employee_contributions_vnd,
      employer_contributions_vnd,
      pit_withholding_vnd,
      gross_income_vnd,
      net_income_vnd,
      company_cost_vnd,
      status,
      payslip_snapshot,
      deleted_at,
      deleted_by,
      delete_reason
    )
    select
      v_run_id,
      final.profile_id,
      v_run_code || '-' || coalesce(final.employee_code, left(final.profile_id::text, 6)),
      final.worked_minutes,
      final.regular_minutes,
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
        'automated', true
      ),
      null,
      null,
      null
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
    set
      deleted_at = now(),
      delete_reason = 'No longer active during automatic payroll synchronization.'
    where item.payroll_run_id = v_run_id
      and item.deleted_at is null
      and not exists (
        select 1
        from public.staff_employee_profiles as employee
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
      where item.payroll_run_id = v_run_id
        and item.deleted_at is null
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

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'staff-daily-payroll-sync';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'staff-daily-payroll-sync',
    '5 17 * * *',
    $command$select public.staff_sync_payroll_draft((now() at time zone 'Asia/Ho_Chi_Minh')::date, false);$command$
  );
end;
$$;

commit;
