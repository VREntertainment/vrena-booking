import assert from 'node:assert/strict'
import test from 'node:test'

// @ts-expect-error Node's built-in TypeScript test runner requires the explicit extension.
import { calculateTimesheetBasePay, countPayrollWorkingDays, isMealAllowanceEligible, payrollFallbackPeriodBasis, resolveEmployeePayrollCalendar } from './staffPayrollPeriod.ts'

test('July 2026 has 27 working days when Sunday is the weekly rest day', () => {
  assert.equal(countPayrollWorkingDays('2026-07-01', '2026-07-31', [0]), 27)
})

test('August 2026 has 26 working days when Sunday is the weekly rest day', () => {
  assert.equal(countPayrollWorkingDays('2026-08-01', '2026-08-31', [0]), 26)
})

test('July payroll calendar follows the employee group from the accountant master', () => {
  assert.deepEqual(resolveEmployeePayrollCalendar({
    department: 'Office',
    payrollType: 'monthly',
    companyWeeklyRestDays: [0],
    companyStandardDailyMinutes: 390,
  }), { weeklyRestDays: [0, 6], standardDailyMinutes: 480, schedule: 'office_5_day' })
  assert.deepEqual(resolveEmployeePayrollCalendar({
    department: 'Manager',
    payrollType: 'manager',
    companyWeeklyRestDays: [0],
    companyStandardDailyMinutes: 390,
  }), { weeklyRestDays: [0], standardDailyMinutes: 435, schedule: 'manager_6_day' })
  assert.equal(countPayrollWorkingDays('2026-07-01', '2026-07-31', [0, 6]), 23)
})

test('monthly fallback hours change with the selected payroll period', () => {
  assert.deepEqual(payrollFallbackPeriodBasis({
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    standardMonthlyDays: 26,
    standardMonthlyHours: 169,
    weeklyRestDays: [0],
  }), {
    workingDays: 27,
    standardDailyMinutes: 390,
    standardMinutes: 10_530,
  })
  assert.deepEqual(payrollFallbackPeriodBasis({
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    standardMonthlyDays: 26,
    standardMonthlyHours: 169,
    weeklyRestDays: [0],
  }), {
    workingDays: 26,
    standardDailyMinutes: 390,
    standardMinutes: 10_140,
  })
})

test('partial periods count only payable weekdays', () => {
  assert.equal(countPayrollWorkingDays('2026-07-01', '2026-07-07', [0]), 6)
})

test('monthly pay uses the selected period day denominator', () => {
  assert.equal(calculateTimesheetBasePay({
    payrollType: 'monthly',
    monthlyBasePay: 13_000_000,
    hourlyRate: 0,
    periodStandardDays: 27,
    salaryPaidDays: 26,
    baseWorkedMinutes: 0,
  }), 12_518_519)
  assert.equal(calculateTimesheetBasePay({
    payrollType: 'monthly',
    monthlyBasePay: 13_000_000,
    hourlyRate: 0,
    periodStandardDays: 27,
    salaryPaidDays: 27,
    baseWorkedMinutes: 0,
  }), 13_000_000)
})

test('monthly pay weights probation and labor days inside one payroll period', () => {
  assert.equal(calculateTimesheetBasePay({
    payrollType: 'monthly',
    monthlyBasePay: 5_400_000,
    hourlyRate: 0,
    periodStandardDays: 27,
    salaryPaidDays: 27,
    weightedSalaryPaidDays: 7 * 0.85 + 20,
    baseWorkedMinutes: 0,
  }), 5_190_000)
})

test('meal eligibility follows the accountant full-day tolerance for every payroll type', () => {
  assert.equal(isMealAllowanceEligible('monthly', 355, 390), false)
  assert.equal(isMealAllowanceEligible('monthly', 360, 390), true)
  assert.equal(isMealAllowanceEligible('hourly', 300, 390), false)
  assert.equal(isMealAllowanceEligible('hourly', 360, 390), true)
})

test('hourly pay uses approved regular minutes and ignores the monthly day denominator', () => {
  assert.equal(calculateTimesheetBasePay({
    payrollType: 'hourly',
    monthlyBasePay: 0,
    hourlyRate: 30_000,
    periodStandardDays: 27,
    salaryPaidDays: 10,
    baseWorkedMinutes: 10 * 6.5 * 60,
  }), 1_950_000)
})
