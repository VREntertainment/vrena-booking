import assert from 'node:assert/strict'
import test from 'node:test'
import {
  accountantPayrollContentDisposition,
  accountantPayrollFilename,
  validateAccountantPayrollExportInput,
} from './accountantPayrollExport.ts'

const validInput = {
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  payrollRows: [],
  employeeRows: [],
  attendanceRows: [],
  calculationBasisRows: [],
}

test('validates a monthly accountant payroll payload', () => {
  assert.deepEqual(validateAccountantPayrollExportInput(validInput), validInput)
})

test('rejects malformed and overlong payroll periods', () => {
  assert.throws(
    () => validateAccountantPayrollExportInput({ ...validInput, periodStart: '2026-08-32' }),
    /period is invalid/,
  )
  assert.throws(
    () => validateAccountantPayrollExportInput({ ...validInput, periodEnd: '2026-09-01' }),
    /up to 31 days/,
  )
})

test('creates a safe cross-browser Excel attachment filename', () => {
  assert.equal(accountantPayrollFilename('../VR Payroll August?.xls'), 'VR-Payroll-August.xlsx')
  assert.equal(
    accountantPayrollContentDisposition('../VR Payroll August?.xls'),
    'attachment; filename="VR-Payroll-August.xlsx"; filename*=UTF-8\'\'VR-Payroll-August.xlsx',
  )
})
