type PayrollPeriodBasisInput = {
  periodStart: string
  periodEnd: string
  standardMonthlyDays: number
  standardMonthlyHours: number
  weeklyRestDays: number[]
}

type TimesheetBasePayInput = {
  payrollType: 'hourly' | 'monthly' | 'manager'
  monthlyBasePay: number
  hourlyRate: number
  periodStandardDays: number
  salaryPaidDays: number
  baseWorkedMinutes: number
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(value: string, days: number) {
  const date = dateFromInput(value)
  date.setDate(date.getDate() + days)
  return dateInputValue(date)
}

export function countPayrollWorkingDays(periodStart: string, periodEnd: string, weeklyRestDays: number[]) {
  const [from, to] = periodStart <= periodEnd ? [periodStart, periodEnd] : [periodEnd, periodStart]
  const restDays = new Set(
    weeklyRestDays
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )
  let cursor = from
  let workingDays = 0
  while (cursor <= to) {
    if (!restDays.has(dateFromInput(cursor).getDay())) workingDays += 1
    cursor = addDays(cursor, 1)
  }
  return workingDays
}

export function payrollFallbackPeriodBasis({
  periodStart,
  periodEnd,
  standardMonthlyDays,
  standardMonthlyHours,
  weeklyRestDays,
}: PayrollPeriodBasisInput) {
  const standardDailyMinutes = Math.max(
    1,
    Math.round((Math.max(0, standardMonthlyHours) * 60) / Math.max(1, standardMonthlyDays)),
  )
  const workingDays = countPayrollWorkingDays(periodStart, periodEnd, weeklyRestDays)
  return {
    workingDays,
    standardDailyMinutes,
    standardMinutes: Math.max(1, workingDays * standardDailyMinutes),
  }
}

export function calculateTimesheetBasePay({
  payrollType,
  monthlyBasePay,
  hourlyRate,
  periodStandardDays,
  salaryPaidDays,
  baseWorkedMinutes,
}: TimesheetBasePayInput) {
  if (payrollType !== 'hourly' && monthlyBasePay > 0) {
    return Math.round(
      Math.max(0, monthlyBasePay) * Math.min(1, Math.max(0, salaryPaidDays) / Math.max(1, periodStandardDays)),
    )
  }
  return Math.round((Math.max(0, baseWorkedMinutes) / 60) * Math.max(0, hourlyRate))
}
