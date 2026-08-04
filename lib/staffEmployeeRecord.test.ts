import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { validateStaffEmployeeRecord } from './staffEmployeeRecord.ts'

test('normalizes an HR-only employee record with optional contact details', () => {
  const result = validateStaffEmployeeRecord({
    email: '  NEW.STAFF@EXAMPLE.COM ',
    employmentType: 'part_time',
    fullName: '  New Employee ',
    phone: ' +84 900 000 000 ',
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.value, {
    email: 'new.staff@example.com',
    employmentType: 'part_time',
    fullName: 'New Employee',
    phone: '+84 900 000 000',
  })
})

test('accepts an employee record without email or phone', () => {
  const result = validateStaffEmployeeRecord({
    employmentType: 'full_time',
    fullName: 'Employee Without Login',
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.email, '')
  assert.equal(result.value.phone, '')
})

test('rejects invalid employee record fields', () => {
  assert.equal(validateStaffEmployeeRecord({}).ok, false)
  assert.equal(validateStaffEmployeeRecord({ fullName: 'Employee', email: 'invalid', employmentType: 'part_time' }).ok, false)
  assert.equal(validateStaffEmployeeRecord({ fullName: 'Employee', email: `${'a'.repeat(250)}@example.com`, employmentType: 'part_time' }).ok, false)
  assert.equal(validateStaffEmployeeRecord({ fullName: 'Employee', employmentType: 'temporary' }).ok, false)
})
