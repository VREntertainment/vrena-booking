import { endOfMonth, normalizeTime, startOfMonth, todayString } from './dates.ts'
import {
  staffContractStatuses,
  staffEmploymentTypes,
  staffGenderOptions,
  staffHrAdjustmentStatuses,
  staffHrAdjustmentTypes,
  staffPayrollPayCycles,
  staffPayrollStatuses,
} from './options.ts'
import type {
  StaffAttendanceSettings,
  StaffAttendanceStatus,
  StaffContractStatus,
  StaffEmploymentType,
  StaffGender,
  StaffHrAdjustmentStatus,
  StaffHrAdjustmentType,
  StaffHrSettings,
  StaffHrSetupOptionType,
  StaffLeaveType,
  StaffPayrollPayCycle,
  StaffPayrollStatus,
  StaffShiftStatus,
  StaffShiftTemplate,
} from './types.ts'

export const defaultStaffShiftTemplates = [
  { id: 'opening', start_time: '09:00', end_time: '13:00', break_minutes: '0', shift_role: 'Staff' },
  { id: 'afternoon', start_time: '13:00', end_time: '18:00', break_minutes: '30', shift_role: 'Staff' },
  { id: 'evening', start_time: '18:00', end_time: '22:00', break_minutes: '0', shift_role: 'Staff' },
  { id: 'full_day', start_time: '09:00', end_time: '18:00', break_minutes: '60', shift_role: 'Staff' },
] satisfies StaffShiftTemplate[]

export function normalizeStaffShiftTemplates(value: unknown, standardBreakMinutes = 60): StaffShiftTemplate[] {
  const source = Array.isArray(value) ? value : []
  return defaultStaffShiftTemplates.map((fallback) => {
    const incoming = source.find((item) => {
      if (!item || typeof item !== 'object') return false
      return (item as Partial<StaffShiftTemplate>).id === fallback.id
    }) as Partial<StaffShiftTemplate> | undefined
    const startTime = normalizeTime(incoming?.start_time) || fallback.start_time
    const endTime = normalizeTime(incoming?.end_time) || fallback.end_time
    const rawBreakMinutes = incoming?.break_minutes ?? fallback.break_minutes ?? standardBreakMinutes
    const parsedBreakMinutes = Number(rawBreakMinutes)
    const fallbackBreakMinutes = Number(fallback.break_minutes)
    const breakMinutes = Number.isFinite(parsedBreakMinutes)
      ? Math.max(0, Math.round(parsedBreakMinutes))
      : Number.isFinite(fallbackBreakMinutes)
        ? Math.max(0, Math.round(fallbackBreakMinutes))
        : Math.max(0, Math.round(Number(standardBreakMinutes) || 0))
    return {
      id: fallback.id,
      start_time: startTime,
      end_time: endTime,
      break_minutes: String(breakMinutes),
      shift_role: 'Staff',
    }
  })
}

export function minutesSetting(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

export function normalizeStaffGender(value: string | null | undefined): StaffGender | '' {
  return staffGenderOptions.includes(value as StaffGender) ? (value as StaffGender) : ''
}

export function normalizeStaffContractStatus(value: string | null | undefined): StaffContractStatus {
  return staffContractStatuses.includes(value as StaffContractStatus) ? (value as StaffContractStatus) : 'active'
}

export function normalizeHrAdjustmentType(value: string | null | undefined): StaffHrAdjustmentType {
  return staffHrAdjustmentTypes.includes(value as StaffHrAdjustmentType) ? (value as StaffHrAdjustmentType) : 'bonus'
}

export function normalizeHrAdjustmentStatus(value: string | null | undefined): StaffHrAdjustmentStatus {
  return staffHrAdjustmentStatuses.includes(value as StaffHrAdjustmentStatus) ? (value as StaffHrAdjustmentStatus) : 'pending'
}

export function normalizePayrollStatus(value: string | null | undefined): StaffPayrollStatus {
  return staffPayrollStatuses.includes(value as StaffPayrollStatus) ? (value as StaffPayrollStatus) : 'draft'
}

export function normalizePayrollPayCycle(value: string | null | undefined): StaffPayrollPayCycle {
  return staffPayrollPayCycles.includes(value as StaffPayrollPayCycle) ? (value as StaffPayrollPayCycle) : 'monthly'
}

export const defaultAttendanceSettings = (): StaffAttendanceSettings => ({
  id: 'default',
  location: 'VRena',
  standard_daily_minutes: 480,
  standard_weekly_minutes: 2880,
  standard_break_minutes: 60,
  overtime_monthly_cap_minutes: 2400,
  overtime_yearly_cap_minutes: 12000,
  night_start: '22:00',
  night_end: '06:00',
  annual_leave_days: 12,
  half_day_enabled: true,
  half_day_min_minutes: 0,
  half_day_max_minutes: 270,
  count_late_early_on_half_day: false,
  late_arrival_enabled: true,
  late_after_minutes: 5,
  early_leave_enabled: true,
  early_leave_before_minutes: 5,
  overtime_before_shift_enabled: false,
  overtime_before_shift_minutes: 10,
  overtime_after_shift_enabled: false,
  overtime_after_shift_minutes: 10,
  single_clock_for_consecutive_shifts: true,
  work_week_start: 1,
  weekly_rest_days: [0],
  shift_templates: normalizeStaffShiftTemplates(defaultStaffShiftTemplates, 60),
  updated_by: null,
  updated_at: null,
})

export function normalizeAttendanceSettings(value?: Partial<StaffAttendanceSettings> | null): StaffAttendanceSettings {
  const fallback = defaultAttendanceSettings()
  const standardBreakMinutes = minutesSetting(value?.standard_break_minutes, fallback.standard_break_minutes)
  return {
    ...fallback,
    ...(value || {}),
    location: String(value?.location || fallback.location),
    standard_daily_minutes: minutesSetting(value?.standard_daily_minutes, fallback.standard_daily_minutes),
    standard_weekly_minutes: minutesSetting(value?.standard_weekly_minutes, fallback.standard_weekly_minutes),
    standard_break_minutes: standardBreakMinutes,
    overtime_monthly_cap_minutes: minutesSetting(value?.overtime_monthly_cap_minutes, fallback.overtime_monthly_cap_minutes),
    overtime_yearly_cap_minutes: minutesSetting(value?.overtime_yearly_cap_minutes, fallback.overtime_yearly_cap_minutes),
    night_start: normalizeTime(value?.night_start) || fallback.night_start,
    night_end: normalizeTime(value?.night_end) || fallback.night_end,
    annual_leave_days: Math.max(0, Number(value?.annual_leave_days ?? fallback.annual_leave_days) || 0),
    half_day_enabled: value?.half_day_enabled ?? fallback.half_day_enabled,
    half_day_min_minutes: minutesSetting(value?.half_day_min_minutes, fallback.half_day_min_minutes),
    half_day_max_minutes: minutesSetting(value?.half_day_max_minutes, fallback.half_day_max_minutes),
    count_late_early_on_half_day: value?.count_late_early_on_half_day ?? fallback.count_late_early_on_half_day,
    late_arrival_enabled: value?.late_arrival_enabled ?? fallback.late_arrival_enabled,
    late_after_minutes: minutesSetting(value?.late_after_minutes, fallback.late_after_minutes),
    early_leave_enabled: value?.early_leave_enabled ?? fallback.early_leave_enabled,
    early_leave_before_minutes: minutesSetting(value?.early_leave_before_minutes, fallback.early_leave_before_minutes),
    overtime_before_shift_enabled: value?.overtime_before_shift_enabled ?? fallback.overtime_before_shift_enabled,
    overtime_before_shift_minutes: minutesSetting(value?.overtime_before_shift_minutes, fallback.overtime_before_shift_minutes),
    overtime_after_shift_enabled: value?.overtime_after_shift_enabled ?? fallback.overtime_after_shift_enabled,
    overtime_after_shift_minutes: minutesSetting(value?.overtime_after_shift_minutes, fallback.overtime_after_shift_minutes),
    single_clock_for_consecutive_shifts: value?.single_clock_for_consecutive_shifts ?? fallback.single_clock_for_consecutive_shifts,
    work_week_start: Math.min(6, Math.max(0, Math.round(Number(value?.work_week_start ?? fallback.work_week_start) || 0))),
    weekly_rest_days: Array.isArray(value?.weekly_rest_days)
      ? value.weekly_rest_days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : fallback.weekly_rest_days,
    shift_templates: normalizeStaffShiftTemplates(value?.shift_templates, standardBreakMinutes),
    updated_by: value?.updated_by ?? fallback.updated_by,
    updated_at: value?.updated_at ?? fallback.updated_at,
  }
}

export const defaultHrSettings = (): StaffHrSettings => ({
  id: 'default',
  currency: 'VND',
  standard_monthly_days: 26,
  standard_monthly_hours: 169,
  rest_period_minutes: 660,
  normal_overtime_multiplier: 1.5,
  night_overtime_multiplier: 2,
  holiday_overtime_multiplier: 3,
  lunch_allowance_vnd: 35000,
  annual_leave_days: 12,
  employee_contribution_rate: 10.5,
  employer_contribution_rate: 21.5,
  pit_withholding_rate: 10,
  policy_version: 'VN-2026.1',
  effective_from: '2026-01-01',
  policy_status: 'active',
  legal_source_url: 'https://vanban.chinhphu.vn/?classid=1&docid=198540&pageid=27160&typegroupid=3',
  legal_reviewed_on: '2026-08-05',
  personal_deduction_vnd: 15500000,
  dependent_deduction_vnd: 6200000,
  short_term_pit_rate: 10,
  pit_brackets: [
    { up_to: 10000000, rate: 5 },
    { up_to: 30000000, rate: 10 },
    { up_to: 60000000, rate: 20 },
    { up_to: 100000000, rate: 30 },
    { up_to: null, rate: 35 },
  ],
  employee_social_insurance_rate: 8,
  employee_health_insurance_rate: 1.5,
  employee_unemployment_insurance_rate: 1,
  employer_social_insurance_rate: 17.5,
  employer_health_insurance_rate: 3,
  employer_unemployment_insurance_rate: 1,
  employer_trade_union_rate: 2,
  night_work_bonus_rate: 30,
  night_overtime_extra_rate: 20,
  leave_accrual_days_per_month: 1,
  leave_qualifying_worked_days: 16,
  leave_join_cutoff_day: 15,
  leave_exit_cutoff_day: 17,
  leave_carry_forward_month: 3,
  leave_carry_forward_day: 31,
  pay_period_start_day: 1,
  auto_create_payroll_runs: false,
  auto_update_payroll_daily: false,
  personal_income_tax_enabled: true,
  social_insurance_enabled: true,
  last_auto_payroll_sync_on: null,
  payslip_note: '',
  updated_by: null,
  updated_at: null,
})

export function normalizeHrSettings(value?: Partial<StaffHrSettings> | null): StaffHrSettings {
  const fallback = defaultHrSettings()
  return {
    ...fallback,
    ...(value || {}),
    currency: String(value?.currency || fallback.currency),
    standard_monthly_days: Math.max(1, Number(value?.standard_monthly_days ?? fallback.standard_monthly_days) || fallback.standard_monthly_days),
    standard_monthly_hours: Math.max(1, Number(value?.standard_monthly_hours ?? fallback.standard_monthly_hours) || fallback.standard_monthly_hours),
    rest_period_minutes: minutesSetting(value?.rest_period_minutes, fallback.rest_period_minutes),
    normal_overtime_multiplier: Math.max(0, Number(value?.normal_overtime_multiplier ?? fallback.normal_overtime_multiplier) || 0),
    night_overtime_multiplier: Math.max(0, Number(value?.night_overtime_multiplier ?? fallback.night_overtime_multiplier) || 0),
    holiday_overtime_multiplier: Math.max(0, Number(value?.holiday_overtime_multiplier ?? fallback.holiday_overtime_multiplier) || 0),
    lunch_allowance_vnd: Math.max(0, Number(value?.lunch_allowance_vnd ?? fallback.lunch_allowance_vnd) || 0),
    annual_leave_days: Math.max(0, Number(value?.annual_leave_days ?? fallback.annual_leave_days) || 0),
    employee_contribution_rate: Math.max(0, Number(value?.employee_contribution_rate ?? fallback.employee_contribution_rate) || 0),
    employer_contribution_rate: Math.max(0, Number(value?.employer_contribution_rate ?? fallback.employer_contribution_rate) || 0),
    pit_withholding_rate: Math.max(0, Number(value?.pit_withholding_rate ?? fallback.pit_withholding_rate) || 0),
    policy_version: String(value?.policy_version || fallback.policy_version),
    effective_from: String(value?.effective_from || fallback.effective_from),
    policy_status: ['draft', 'active', 'retired'].includes(String(value?.policy_status)) ? value?.policy_status as StaffHrSettings['policy_status'] : fallback.policy_status,
    legal_source_url: value?.legal_source_url ?? fallback.legal_source_url,
    legal_reviewed_on: value?.legal_reviewed_on ?? fallback.legal_reviewed_on,
    personal_deduction_vnd: Math.max(0, Number(value?.personal_deduction_vnd ?? fallback.personal_deduction_vnd) || 0),
    dependent_deduction_vnd: Math.max(0, Number(value?.dependent_deduction_vnd ?? fallback.dependent_deduction_vnd) || 0),
    short_term_pit_rate: Math.max(0, Number(value?.short_term_pit_rate ?? fallback.short_term_pit_rate) || 0),
    pit_brackets: Array.isArray(value?.pit_brackets) && value.pit_brackets.length > 0
      ? value.pit_brackets.map((bracket) => ({ up_to: bracket.up_to == null ? null : Math.max(0, Number(bracket.up_to) || 0), rate: Math.max(0, Number(bracket.rate) || 0) }))
      : fallback.pit_brackets,
    employee_social_insurance_rate: Math.max(0, Number(value?.employee_social_insurance_rate ?? fallback.employee_social_insurance_rate) || 0),
    employee_health_insurance_rate: Math.max(0, Number(value?.employee_health_insurance_rate ?? fallback.employee_health_insurance_rate) || 0),
    employee_unemployment_insurance_rate: Math.max(0, Number(value?.employee_unemployment_insurance_rate ?? fallback.employee_unemployment_insurance_rate) || 0),
    employer_social_insurance_rate: Math.max(0, Number(value?.employer_social_insurance_rate ?? fallback.employer_social_insurance_rate) || 0),
    employer_health_insurance_rate: Math.max(0, Number(value?.employer_health_insurance_rate ?? fallback.employer_health_insurance_rate) || 0),
    employer_unemployment_insurance_rate: Math.max(0, Number(value?.employer_unemployment_insurance_rate ?? fallback.employer_unemployment_insurance_rate) || 0),
    employer_trade_union_rate: Math.max(0, Number(value?.employer_trade_union_rate ?? fallback.employer_trade_union_rate) || 0),
    night_work_bonus_rate: Math.max(0, Number(value?.night_work_bonus_rate ?? fallback.night_work_bonus_rate) || 0),
    night_overtime_extra_rate: Math.max(0, Number(value?.night_overtime_extra_rate ?? fallback.night_overtime_extra_rate) || 0),
    leave_accrual_days_per_month: Math.max(0, Number(value?.leave_accrual_days_per_month ?? fallback.leave_accrual_days_per_month) || 0),
    leave_qualifying_worked_days: Math.max(0, Math.round(Number(value?.leave_qualifying_worked_days ?? fallback.leave_qualifying_worked_days) || 0)),
    leave_join_cutoff_day: Math.min(31, Math.max(1, Math.round(Number(value?.leave_join_cutoff_day ?? fallback.leave_join_cutoff_day) || 1))),
    leave_exit_cutoff_day: Math.min(31, Math.max(1, Math.round(Number(value?.leave_exit_cutoff_day ?? fallback.leave_exit_cutoff_day) || 1))),
    leave_carry_forward_month: Math.min(12, Math.max(1, Math.round(Number(value?.leave_carry_forward_month ?? fallback.leave_carry_forward_month) || 1))),
    leave_carry_forward_day: Math.min(31, Math.max(1, Math.round(Number(value?.leave_carry_forward_day ?? fallback.leave_carry_forward_day) || 1))),
    pay_period_start_day: Math.min(28, Math.max(1, Math.round(Number(value?.pay_period_start_day ?? fallback.pay_period_start_day) || 1))),
    auto_create_payroll_runs: value?.auto_create_payroll_runs ?? fallback.auto_create_payroll_runs,
    auto_update_payroll_daily: value?.auto_update_payroll_daily ?? fallback.auto_update_payroll_daily,
    personal_income_tax_enabled: value?.personal_income_tax_enabled ?? fallback.personal_income_tax_enabled,
    social_insurance_enabled: value?.social_insurance_enabled ?? fallback.social_insurance_enabled,
    last_auto_payroll_sync_on: value?.last_auto_payroll_sync_on ?? fallback.last_auto_payroll_sync_on,
    payslip_note: value?.payslip_note ?? fallback.payslip_note,
    updated_by: value?.updated_by ?? fallback.updated_by,
    updated_at: value?.updated_at ?? fallback.updated_at,
  }
}

export const defaultShiftForm = (settings?: StaffAttendanceSettings) => ({
  id: '',
  staff_profile_id: '',
  location: settings?.location || 'VRena',
  shift_role: 'Staff',
  shift_date: todayString(),
  start_time: '09:00',
  end_time: '18:00',
  break_minutes: String(settings?.standard_break_minutes ?? 60),
  status: 'published' as StaffShiftStatus,
  notes: '',
})

export const defaultAttendanceLogForm = () => ({
  id: '',
  staff_profile_id: '',
  shift_id: '',
  work_date: todayString(),
  clock_in_time: '09:00',
  clock_out_time: '18:00',
  break_minutes: '60',
  status: 'present' as StaffAttendanceStatus,
  regular_minutes: '8',
  overtime_minutes: '0',
  night_minutes: '0',
  holiday_minutes: '0',
  manager_note: '',
})

export const defaultLeaveForm = () => ({
  id: '',
  staff_profile_id: '',
  leave_type: 'annual' as StaffLeaveType,
  start_date: todayString(),
  end_date: todayString(),
  hours: '8',
  reason: '',
})

export const defaultEmployeeForm = () => ({
  profile_id: '',
  employee_code: '',
  attendance_number: '',
  legal_name: '',
  personal_phone: '',
  personal_email: '',
  national_id: '',
  date_of_birth: '',
  gender: '',
  address: '',
  department: '',
  job_title: '',
  employment_type: 'part_time' as StaffEmploymentType,
  main_work_location: '',
  payroll_location: '',
  contract_status: 'active' as StaffContractStatus,
  contract_type: '',
  contract_start_date: '',
  contract_end_date: '',
  probation_payroll_type: 'hourly' as 'hourly' | 'monthly' | 'manager',
  labor_payroll_type: 'hourly' as 'hourly' | 'monthly' | 'manager',
  probation_salary_percentage: '85',
  probation_bonus_percentage: '100',
  probation_start_date: '',
  probation_end_date: '',
  labor_start_date: '',
  labor_end_date: '',
  start_date: '',
  end_date: '',
  base_salary_vnd: '',
  hourly_rate_vnd: '',
  monthly_bonus_vnd: '',
  lunch_allowance_vnd: '',
  rest_period_hours: '',
  overtime_rate_multiplier: '',
  night_rate_multiplier: '',
  holiday_rate_multiplier: '',
  employee_contribution_rate: '',
  employer_contribution_rate: '',
  pit_withholding_rate: '',
  dependents_count: '0',
  bank_name: '',
  bank_account_number: '',
  tax_code: '',
  social_insurance_number: '',
  social_insurance_enrolled: false,
  social_insurance_salary_vnd: '',
  emergency_contact: '',
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_phone: '',
  google_drive_folder_url: '',
  payroll_note: '',
  profile_photo_path: '',
  cv_document_path: '',
  active: true,
  kiosk_access_role: '' as '' | 'manager' | 'staff',
  kiosk_pin_configured_at: '',
})

export const defaultHrAdjustmentForm = (profileId = '', type: StaffHrAdjustmentType = 'bonus') => ({
  id: '',
  profile_id: profileId,
  adjustment_type: type,
  title: '',
  amount_vnd: '',
  effective_date: todayString(),
  period_start: startOfMonth(todayString()),
  period_end: endOfMonth(todayString()),
  status: 'pending' as StaffHrAdjustmentStatus,
  notes: '',
})

export const defaultPayrollRunForm = () => ({
  id: '',
  code: `PAY-${todayString().slice(0, 7).replace('-', '')}`,
  name: `Payroll ${todayString().slice(0, 7)}`,
  pay_cycle: 'monthly' as StaffPayrollPayCycle,
  period_start: startOfMonth(todayString()),
  period_end: endOfMonth(todayString()),
  notes: '',
})

export const defaultHrSetupForm = (): Record<StaffHrSetupOptionType, string> => ({
  department: '',
  job_title: '',
  location: '',
  contract_status: '',
  contract_type: '',
  employment_type: '',
  payroll_template: '',
  allowance: '',
  deduction: '',
})

export function normalizeStaffEmploymentType(value: StaffEmploymentType | string | null | undefined): StaffEmploymentType {
  if (value === 'probation') return 'probation_part_time'
  return staffEmploymentTypes.includes(value as StaffEmploymentType) ? (value as StaffEmploymentType) : 'part_time'
}
