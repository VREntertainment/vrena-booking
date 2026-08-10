import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasCompleteHistoricalAccountantLayout,
  historicalAccountantPlacement,
  JULY_2026_ACCOUNTANT_SOURCE_KEY,
  sortHistoricalAccountantRows,
} from './historicalAccountantPayroll.ts'

const julyCodes = ['NV07', 'NV18', 'NV04', 'NV28', 'NV30', 'NV25', 'NV16', 'NV12', 'NV08', 'NV09', 'NV24', 'NV27', 'NV34', 'NV31', 'NV03']

test('maps the complete July snapshot into the accountant workbook row order', () => {
  assert.equal(hasCompleteHistoricalAccountantLayout(JULY_2026_ACCOUNTANT_SOURCE_KEY, julyCodes), true)
  assert.deepEqual(
    sortHistoricalAccountantRows(JULY_2026_ACCOUNTANT_SOURCE_KEY, julyCodes.map((employee_code) => ({ employee_code }))).map((row) => row.employee_code),
    ['NV25', 'NV18', 'NV04', 'NV03', 'NV07', 'NV28', 'NV30', 'NV16', 'NV12', 'NV08', 'NV24', 'NV09', 'NV27', 'NV31', 'NV34'],
  )

  const terminated = historicalAccountantPlacement(JULY_2026_ACCOUNTANT_SOURCE_KEY, 'NV03')
  assert.equal(terminated?.payroll, 13)
  assert.equal(terminated?.basic, 46)
  assert.equal(terminated?.bank, undefined)
  assert.equal(terminated?.workRecord, undefined)
})

test('rejects incomplete or unknown historical layouts', () => {
  assert.equal(hasCompleteHistoricalAccountantLayout(JULY_2026_ACCOUNTANT_SOURCE_KEY, julyCodes.slice(1)), false)
  assert.equal(hasCompleteHistoricalAccountantLayout(JULY_2026_ACCOUNTANT_SOURCE_KEY, [...julyCodes.slice(1), 'NV18']), false)
  assert.equal(hasCompleteHistoricalAccountantLayout('unknown-source', julyCodes), false)
  assert.equal(historicalAccountantPlacement(JULY_2026_ACCOUNTANT_SOURCE_KEY, 'NV999'), null)
})
