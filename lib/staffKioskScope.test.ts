import assert from 'node:assert/strict'
import test from 'node:test'
import { requiresStaffKioskPin, STAFF_KIOSK_EMAIL } from './staffKioskScope.ts'

test('the shared store login requires an employee PIN', () => {
  assert.equal(requiresStaffKioskPin(STAFF_KIOSK_EMAIL), true)
  assert.equal(requiresStaffKioskPin('  CONTACT@VRE-VIETNAM.COM  '), true)
})

test('privileged and individually named staff accounts bypass the employee PIN', () => {
  const individualAccounts = [
    'owner@vre-vietnam.com',
    'admin@vre-vietnam.com',
    'viewer@vre-vietnam.com',
    'accounting@vre-vietnam.com',
    'administration@vre-vietnam.com',
    'staff.member@vre-vietnam.com',
  ]

  for (const email of individualAccounts) {
    assert.equal(requiresStaffKioskPin(email), false, `${email} should bypass the shared-login PIN`)
  }

  assert.equal(requiresStaffKioskPin(null), false)
  assert.equal(requiresStaffKioskPin(undefined), false)
  assert.equal(requiresStaffKioskPin(''), false)
})
