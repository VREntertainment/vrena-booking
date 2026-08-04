import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { validateStaffEmployeeInvite } from './staffEmployeeInvite.ts'

test('normalizes a valid employee invitation', () => {
  const result = validateStaffEmployeeInvite({
    email: '  NEW.STAFF@EXAMPLE.COM ',
    employmentType: 'part_time',
    fullName: '  New Employee ',
    phone: ' +84 900 000 000 ',
    role: 'staff',
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.value, {
    email: 'new.staff@example.com',
    employmentType: 'part_time',
    fullName: 'New Employee',
    phone: '+84 900 000 000',
    role: 'staff',
  })
})

test('rejects invalid employee invitation fields', () => {
  assert.equal(validateStaffEmployeeInvite({}).ok, false)
  assert.equal(validateStaffEmployeeInvite({ fullName: 'Employee', email: 'invalid', role: 'staff', employmentType: 'part_time' }).ok, false)
  assert.equal(validateStaffEmployeeInvite({ fullName: 'Employee', email: 'staff@example.com', role: 'owner', employmentType: 'part_time' }).ok, false)
  assert.equal(validateStaffEmployeeInvite({ fullName: 'Employee', email: 'staff@example.com', role: 'staff', employmentType: 'temporary' }).ok, false)
})
