import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { staffKioskOperatorFromEmployee } from './staffKioskDirectory.ts'

test('independent HR employee remains available without a web-player profile', () => {
  const operator = staffKioskOperatorFromEmployee({
    profile_id: '11111111-1111-4111-8111-111111111111',
    employee_code: 'VRE-007',
    legal_name: 'Nguyen Van Tu',
    job_title: 'Manager',
    kiosk_access_role: 'manager',
    kiosk_pin_configured_at: '2026-08-05T00:00:00.000Z',
  })

  assert.equal(operator.name, 'Nguyen Van Tu')
  assert.equal(operator.accessRole, 'manager')
  assert.equal(operator.pinConfigured, true)
  assert.equal(operator.avatarInitials, 'NT')
})

test('employee is not marked PIN-ready without a valid kiosk role', () => {
  const operator = staffKioskOperatorFromEmployee({
    profile_id: '22222222-2222-4222-8222-222222222222',
    employee_code: 'VRE-008',
    legal_name: null,
    job_title: null,
    kiosk_access_role: null,
    kiosk_pin_configured_at: '2026-08-05T00:00:00.000Z',
  })

  assert.equal(operator.name, 'VRE-008')
  assert.equal(operator.accessRole, null)
  assert.equal(operator.pinConfigured, false)
})
