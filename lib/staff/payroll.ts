import { calculatePayrollTaxBases, calculateProgressivePit } from '../hrPayrollPolicy.ts'
import { calculateTimesheetBasePay, isMealAllowanceEligible, payrollFallbackPeriodBasis, resolveEmployeePayrollCalendar } from '../staffPayrollPeriod.ts'
import { employeeBonusPercentageForPeriod, employeeSalaryPercentageForPeriod } from '../staffPayrollProbation.ts'
import { addDays, daysBetween, minutesBetween, minutesBetweenTimes } from './dates.ts'
import { normalizeStaffContractStatus } from './hrSettings.ts'
import { countRestPeriodWarnings } from './scheduling.ts'
import type {
  StaffAttendanceLog,
  StaffAttendanceSettings,
  StaffEmployeeProfile,
  StaffHrAdjustment,
  StaffHrSettings,
  StaffLeaveRequest,
  StaffPayrollCalculation,
  StaffPayrollSourceSnapshot,
  StaffScheduleShift,
} from './types.ts'

export function dateWithinRange(value: string | null | undefined, start: string, end: string) {
  return Boolean(value && value >= start && value <= end)
}

export function adjustmentAppliesToPeriod(adjustment: StaffHrAdjustment, start: string, end: string) {
  if (adjustment.period_start && adjustment.period_end) {
    return adjustment.period_start <= end && adjustment.period_end >= start
  }
  return dateWithinRange(adjustment.effective_date, start, end)
}

export function employeeRate(value: number | null | undefined, fallback: number) {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : fallback
}

export function employeeRestPeriodMinutes(employee: StaffEmployeeProfile | undefined, settings: StaffHrSettings) {
  return Math.max(0, Number(settings.rest_period_minutes) || 0)
}

export function normalizeEmployeePayrollType(value: string | null | undefined): 'hourly' | 'monthly' | 'manager' {
  return value === 'monthly' || value === 'manager' ? value : 'hourly'
}

export function employeePayrollTypeForPeriod(employee: StaffEmployeeProfile | undefined, periodEnd: string) {
  const probationEnd = employee?.probation_end_date || ''
  const laborStart = employee?.labor_start_date || ''
  const probationApplies = Boolean(
    (employee?.probation_start_date && periodEnd >= employee.probation_start_date) &&
    (!probationEnd || periodEnd <= probationEnd) &&
    (!laborStart || periodEnd < laborStart)
  )
  return probationApplies
    ? normalizeEmployeePayrollType(employee?.probation_payroll_type)
    : normalizeEmployeePayrollType(employee?.labor_payroll_type)
}

export function leaveHoursInsidePeriod(leave: StaffLeaveRequest, periodStart: string, periodEnd: string) {
  const overlapStart = leave.start_date > periodStart ? leave.start_date : periodStart
  const overlapEnd = leave.end_date < periodEnd ? leave.end_date : periodEnd
  if (overlapStart > overlapEnd) return 0
  const requestDays = Math.max(1, daysBetween(leave.start_date, leave.end_date) + 1)
  const overlapDays = Math.max(1, daysBetween(overlapStart, overlapEnd) + 1)
  return Math.max(0, Number(leave.hours) || 0) * overlapDays / requestDays
}

export function leaveSalaryUnitsInsidePeriod(
  leave: StaffLeaveRequest,
  employee: StaffEmployeeProfile | undefined,
  periodStart: string,
  periodEnd: string,
  standardDailyHours: number,
) {
  const overlapStart = leave.start_date > periodStart ? leave.start_date : periodStart
  const overlapEnd = leave.end_date < periodEnd ? leave.end_date : periodEnd
  if (overlapStart > overlapEnd) return 0
  const requestDays = Math.max(1, daysBetween(leave.start_date, leave.end_date) + 1)
  const paidDayFraction = (Math.max(0, Number(leave.hours) || 0) / requestDays) / Math.max(1, standardDailyHours)
  let salaryUnits = 0
  let date = overlapStart
  while (date <= overlapEnd) {
    salaryUnits += paidDayFraction * employeeSalaryPercentageForPeriod(employee, date)
    date = addDays(date, 1)
  }
  return salaryUnits
}

export function isPaidLeaveForEmployee(leave: StaffLeaveRequest, employee: StaffEmployeeProfile | undefined) {
  if (employeePayrollTypeForPeriod(employee, leave.end_date) === 'hourly') return false
  return leave.leave_type === 'annual' || leave.leave_type === 'public_holiday'
}

export function approvedAttendanceMinutes(log: StaffAttendanceLog) {
  const approvedMinutes = Math.max(0, Number(log.regular_minutes) || 0) + Math.max(0, Number(log.overtime_minutes) || 0)
  if (approvedMinutes > 0) return approvedMinutes
  return minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes)
}

export function calculateStaffPayroll(
  staffProfileId: string,
  employee: StaffEmployeeProfile | undefined,
  shifts: StaffScheduleShift[],
  logs: StaffAttendanceLog[],
  leaves: StaffLeaveRequest[],
  adjustments: StaffHrAdjustment[],
  settings: StaffHrSettings,
  attendanceSettings: StaffAttendanceSettings,
  periodStart: string,
  periodEnd: string,
  periodReference?: StaffPayrollSourceSnapshot,
): StaffPayrollCalculation {
  const employeeShifts = shifts.filter((shift) => (
    shift.staff_profile_id === staffProfileId &&
    shift.shift_date >= periodStart &&
    shift.shift_date <= periodEnd &&
    ['published', 'completed'].includes(shift.status)
  ))
  const employeeLogs = logs.filter((log) => (
    log.staff_profile_id === staffProfileId &&
    log.work_date >= periodStart &&
    log.work_date <= periodEnd &&
    log.approval_status === 'approved'
  ))
  const employeeLeaves = leaves.filter((leave) => (
    leave.staff_profile_id === staffProfileId &&
    leave.status === 'approved' &&
    leave.end_date >= periodStart &&
    leave.start_date <= periodEnd &&
    isPaidLeaveForEmployee(leave, employee)
  ))
  const employeeAdjustments = adjustments.filter((adjustment) => (
    adjustment.profile_id === staffProfileId &&
    ['approved', 'paid'].includes(adjustment.status) &&
    adjustmentAppliesToPeriod(adjustment, periodStart, periodEnd)
  ))

  const scheduledMinutes = employeeShifts.reduce((sum, shift) => sum + minutesBetweenTimes(shift.start_time, shift.end_time, shift.break_minutes), 0)
  const workedMinutes = employeeLogs.reduce((sum, log) => sum + approvedAttendanceMinutes(log), 0)
  const regularMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.regular_minutes) || 0), 0)
  const computedOvertimeMinutes = scheduledMinutes > 0
    ? Math.max(0, workedMinutes - (regularMinutes || Math.min(workedMinutes, scheduledMinutes)))
    : 0
  const overtimeMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.overtime_minutes) || 0), 0) || computedOvertimeMinutes
  const nightMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.night_minutes) || 0), 0)
  const holidayMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.holiday_minutes) || 0), 0)
  const paidLeaveHours = employeeLeaves.reduce((sum, leave) => sum + leaveHoursInsidePeriod(leave, periodStart, periodEnd), 0)
  const workedDates = Array.from(new Set(employeeLogs.filter((log) => approvedAttendanceMinutes(log) > 0).map((log) => log.work_date)))
  const workedDays = workedDates.length
  const payrollType = employeePayrollTypeForPeriod(employee, periodEnd)
  const companyStandardDailyMinutes = Math.max(
    1,
    Math.round((Math.max(0, settings.standard_monthly_hours) * 60) / Math.max(1, settings.standard_monthly_days)),
  )
  const employeePayrollCalendar = resolveEmployeePayrollCalendar({
    department: employee?.department,
    payrollType,
    companyWeeklyRestDays: attendanceSettings.weekly_rest_days,
    companyStandardDailyMinutes,
  })
  const fallbackPeriodBasis = payrollFallbackPeriodBasis({
    periodStart,
    periodEnd,
    standardMonthlyDays: settings.standard_monthly_days,
    standardMonthlyHours: settings.standard_monthly_hours,
    weeklyRestDays: employeePayrollCalendar.weeklyRestDays,
    standardDailyMinutes: employeePayrollCalendar.standardDailyMinutes,
  })
  const standardDailyHours = fallbackPeriodBasis.standardDailyMinutes / 60
  const paidLeaveDays = paidLeaveHours / standardDailyHours
  const annualEntitlement = Math.max(0, Number(employee?.contract_status === 'ended' ? 0 : settings.annual_leave_days) || 0)
  const leaveBalanceDays = Math.max(0, annualEntitlement - paidLeaveDays)
  const periodStandardDays = Math.max(1, fallbackPeriodBasis.workingDays)
  const periodStandardMinutes = Math.max(1, fallbackPeriodBasis.standardMinutes)
  const payrollBasis = 'working_calendar'
  const payPercentage = employeeSalaryPercentageForPeriod(employee, periodEnd)
  const bonusPercentage = employeeBonusPercentageForPeriod(employee, periodEnd)
  const hourlyRate = (employee?.hourly_rate_vnd || (employee?.base_salary_vnd ? employee.base_salary_vnd / Math.max(1, periodStandardMinutes / 60) : 0)) * payPercentage
  const monthlyBasePay = payrollType !== 'hourly' ? Math.max(0, Number(employee?.base_salary_vnd) || 0) : 0
  const baseWorkedMinutes = regularMinutes > 0 ? regularMinutes : Math.max(0, workedMinutes - overtimeMinutes)
  const salaryPaidDays = Math.min(periodStandardDays, workedDays + paidLeaveDays)
  const rawSalaryPaidDays = workedDays + paidLeaveDays
  const weightedWorkedDays = workedDates.reduce(
    (sum, workDate) => sum + employeeSalaryPercentageForPeriod(employee, workDate),
    0,
  )
  const weightedLeaveDays = employeeLeaves.reduce(
    (sum, leave) => sum + leaveSalaryUnitsInsidePeriod(leave, employee, periodStart, periodEnd, standardDailyHours),
    0,
  )
  const weightedSalaryPaidDays = (weightedWorkedDays + weightedLeaveDays) * Math.min(
    1,
    periodStandardDays / Math.max(1, rawSalaryPaidDays),
  )
  const salaryPaidMinutes = monthlyBasePay > 0
    ? Math.round(weightedSalaryPaidDays * periodStandardMinutes / periodStandardDays)
    : baseWorkedMinutes + Math.round(paidLeaveHours * 60)
  const hourlyBasePay = calculateTimesheetBasePay({
    payrollType,
    monthlyBasePay,
    hourlyRate,
    periodStandardDays,
    salaryPaidDays,
    weightedSalaryPaidDays,
    baseWorkedMinutes,
  })
  const overtimeMultiplier = Math.max(0, Number(settings.normal_overtime_multiplier) || 0)
  const nightMultiplier = Math.max(0, Number(settings.night_overtime_multiplier) || 0)
  const holidayMultiplier = Math.max(0, Number(settings.holiday_overtime_multiplier) || 0)
  const categorizedHolidayMinutes = Math.min(holidayMinutes, overtimeMinutes)
  const categorizedNightMinutes = Math.min(nightMinutes, Math.max(0, overtimeMinutes - categorizedHolidayMinutes))
  const categorizedRegularOvertimeMinutes = Math.max(0, overtimeMinutes - categorizedHolidayMinutes - categorizedNightMinutes)
  const legalNightOvertimeMultiplier = overtimeMultiplier + settings.night_work_bonus_rate / 100 + settings.night_overtime_extra_rate / 100
  const overtimePay = Math.round(
    (categorizedRegularOvertimeMinutes / 60) * hourlyRate * overtimeMultiplier +
    (categorizedNightMinutes / 60) * hourlyRate * (legalNightOvertimeMultiplier || nightMultiplier) +
    (categorizedHolidayMinutes / 60) * hourlyRate * holidayMultiplier
  )
  const lunchAllowance = settings.lunch_allowance_vnd
  const mealDays = new Set(employeeLogs
    .filter((log) => isMealAllowanceEligible(payrollType, approvedAttendanceMinutes(log), employeePayrollCalendar.standardDailyMinutes))
    .map((log) => log.work_date)).size
  const autoLunchAllowance = Math.round(Math.max(0, lunchAllowance) * mealDays)
  const otherAllowances = employeeAdjustments
    .filter((item) => ['allowance', 'lunch_allowance'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const allowances = autoLunchAllowance + otherAllowances
  const recurringBonus = Math.round(Math.max(0, Number(employee?.monthly_bonus_vnd) || 0) * bonusPercentage)
  const bonuses = recurringBonus + employeeAdjustments
    .filter((item) => ['bonus', 'commission'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + Math.round(item.amount_vnd * bonusPercentage), 0)
  const advances = employeeAdjustments
    .filter((item) => ['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const deductions = employeeAdjustments
    .filter((item) => item.adjustment_type === 'deduction')
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const basePay = Math.max(0, hourlyBasePay)
  const grossIncome = Math.max(0, basePay + overtimePay + allowances + bonuses)
  const employeeContributionRate = Math.max(0,
    Number(settings.employee_social_insurance_rate) +
    Number(settings.employee_health_insurance_rate) +
    Number(settings.employee_unemployment_insurance_rate),
  )
  const employerContributionRate = Math.max(0,
    Number(settings.employer_social_insurance_rate) +
    Number(settings.employer_health_insurance_rate) +
    Number(settings.employer_unemployment_insurance_rate) +
    Number(settings.employer_trade_union_rate),
  )
  const contributionBase = settings.social_insurance_enabled && employee?.social_insurance_enrolled && normalizeStaffContractStatus(employee?.contract_status) === 'active'
    ? Math.max(0, Number(employee?.social_insurance_salary_vnd) || Number(employee?.base_salary_vnd) || 0)
    : 0
  const calculatedEmployeeContributions = Math.round(contributionBase * employeeContributionRate / 100)
  const employeeContributions = periodReference
    ? Math.max(0, Number(periodReference.employee_insurance_vnd) || 0)
    : calculatedEmployeeContributions
  const employerContributions = Math.round(contributionBase * employerContributionRate / 100)
  const taxBases = calculatePayrollTaxBases({
    grossIncome,
    mealAllowance: autoLunchAllowance,
    overtimePay,
    employeeContributions,
    personalDeduction: settings.personal_deduction_vnd,
    dependentDeduction: Math.max(0, Number(employee?.dependents_count) || 0) * settings.dependent_deduction_vnd,
  })
  const employeePitRate = Math.max(
    0,
    Number(periodReference?.source_payload?.pit_rate_percent) || Number(employee?.pit_withholding_rate) || 0,
  )
  const pitWithheld = !settings.personal_income_tax_enabled
    ? 0
    : employeePitRate > 0
      ? Math.round(taxBases.shortTermWithholdingBase * employeePitRate / 100)
      : calculateProgressivePit(taxBases.progressiveTaxableIncome, settings.pit_brackets)
  const netIncome = Math.max(0, grossIncome - employeeContributions - pitWithheld - deductions - advances)
  const companyCost = Math.max(0, grossIncome + employerContributions)

  return {
    profileId: staffProfileId,
    scheduledMinutes,
    periodStandardMinutes,
    periodStandardDays,
    payrollBasis,
    workedMinutes,
    workedDays,
    mealDays,
    salaryPaidDays,
    regularMinutes,
    salaryPaidMinutes,
    overtimeMinutes,
    nightMinutes,
    holidayMinutes,
    paidLeaveHours,
    paidLeaveDays,
    leaveBalanceDays,
    restWarningCount: countRestPeriodWarnings(employeeShifts, employeeRestPeriodMinutes(employee, settings)),
    hourlyRate,
    basePay,
    overtimePay,
    mealAllowance: autoLunchAllowance,
    otherAllowances,
    allowances,
    bonuses,
    advances,
    deductions,
    contributionBase,
    employeeContributions,
    employerContributions,
    pitWithheld,
    grossIncome,
    netIncome,
    companyCost,
  }
}

export function emptyStaffPayrollCalculation(profileId = ''): StaffPayrollCalculation {
  return {
    profileId,
    scheduledMinutes: 0,
    periodStandardMinutes: 0,
    periodStandardDays: 0,
    payrollBasis: 'working_calendar',
    workedMinutes: 0,
    workedDays: 0,
    mealDays: 0,
    salaryPaidDays: 0,
    regularMinutes: 0,
    salaryPaidMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
    holidayMinutes: 0,
    paidLeaveHours: 0,
    paidLeaveDays: 0,
    leaveBalanceDays: 0,
    restWarningCount: 0,
    hourlyRate: 0,
    basePay: 0,
    overtimePay: 0,
    mealAllowance: 0,
    otherAllowances: 0,
    allowances: 0,
    bonuses: 0,
    advances: 0,
    deductions: 0,
    contributionBase: 0,
    employeeContributions: 0,
    employerContributions: 0,
    pitWithheld: 0,
    grossIncome: 0,
    netIncome: 0,
    companyCost: 0,
  }
}
