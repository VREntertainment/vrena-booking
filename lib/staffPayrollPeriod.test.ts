import assert from 'node:assert/strict'
import test from 'node:test'

// @ts-expect-error Node's built-in TypeScript test runner requires the explicit extension.
import { calculateTimesheetBasePay, countPayrollWorkingDays, payrollFallbackPeriodBasis } from './staffPayrollPeriod.ts'

test('July 2026 has 27 working days when Sunday is the weekly rest day', () => {
  assert.equal(countPayrollWorkingDays('2026-07-01', '2026-07-31', [0]), 27)
})

test('August 2026 has 26 working days when Sunday is the weekly rest day', () => {
  assert.equal(countPayrollWorkingDays('2026-08-01', '2026-08-31', [0]), 26)
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
