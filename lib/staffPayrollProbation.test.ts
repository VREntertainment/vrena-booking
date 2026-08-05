import assert from 'node:assert/strict'
import test from 'node:test'

import {
  employeeBonusPercentageForPeriod,
  employeeIsInProbationForPeriod,
  employeeSalaryPercentageForPeriod,
} from './staffPayrollProbation.ts'

const probationEmployee = {
  probation_start_date: '2026-08-01',
  probation_end_date: '2026-08-31',
  labor_start_date: '2026-09-01',
  probation_salary_percentage: 85,
  probation_bonus_percentage: 85,
}

test('applies configured salary and bonus percentages during probation', () => {
  assert.equal(employeeIsInProbationForPeriod(probationEmployee, '2026-08-31'), true)
  assert.equal(employeeSalaryPercentageForPeriod(probationEmployee, '2026-08-31'), 0.85)
  assert.equal(employeeBonusPercentageForPeriod(probationEmployee, '2026-08-31'), 0.85)
})

test('returns full salary and bonus after labor starts', () => {
  assert.equal(employeeIsInProbationForPeriod(probationEmployee, '2026-09-01'), false)
  assert.equal(employeeSalaryPercentageForPeriod(probationEmployee, '2026-09-01'), 1)
  assert.equal(employeeBonusPercentageForPeriod(probationEmployee, '2026-09-01'), 1)
})

test('preserves existing bonuses at 100 percent when the new value is absent', () => {
  const legacyEmployee = { ...probationEmployee, probation_bonus_percentage: undefined }
  assert.equal(employeeBonusPercentageForPeriod(legacyEmployee, '2026-08-15'), 1)
})
