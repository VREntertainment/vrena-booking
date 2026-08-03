import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { canConfigureStaffKioskPin, canEnterStaffConsole, requiresStaffKioskPin, shouldRedirectStaffKioskToPin, STAFF_KIOSK_EMAIL } from './staffKioskScope.ts'

test('the shared store login requires an employee PIN', () => {
  assert.equal(requiresStaffKioskPin(STAFF_KIOSK_EMAIL), true)
  assert.equal(requiresStaffKioskPin('  CONTACT@VRE-VIETNAM.COM  '), true)
})

test('the shared store login lands on the PIN gate instead of player views', () => {
  assert.equal(shouldRedirectStaffKioskToPin(STAFF_KIOSK_EMAIL, 'leaderboard'), true)
  assert.equal(shouldRedirectStaffKioskToPin(STAFF_KIOSK_EMAIL, 'profile'), true)
  assert.equal(shouldRedirectStaffKioskToPin(STAFF_KIOSK_EMAIL, 'staff'), false)
  assert.equal(shouldRedirectStaffKioskToPin(STAFF_KIOSK_EMAIL, 'hr'), false)
  assert.equal(shouldRedirectStaffKioskToPin('manager@vre-vietnam.com', 'leaderboard'), false)
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

test('the shared store login can reach the PIN gate without account MFA', () => {
  assert.equal(canEnterStaffConsole({
    authEmail: STAFF_KIOSK_EMAIL,
    hasVerifiedMfaFactor: false,
    mfaAssuranceLevel: 'aal1',
    profileRank: 80,
  }), true)
  assert.equal(canEnterStaffConsole({
    authEmail: STAFF_KIOSK_EMAIL,
    hasVerifiedMfaFactor: false,
    mfaAssuranceLevel: 'aal1',
    profileRank: 0,
  }), false)
})

test('individually authenticated staff still require MFA to enter the console', () => {
  assert.equal(canEnterStaffConsole({
    authEmail: 'manager@vre-vietnam.com',
    hasVerifiedMfaFactor: false,
    mfaAssuranceLevel: 'aal1',
    profileRank: 80,
  }), false)
  assert.equal(canEnterStaffConsole({
    authEmail: 'manager@vre-vietnam.com',
    hasVerifiedMfaFactor: true,
    mfaAssuranceLevel: 'aal2',
    profileRank: 80,
  }), true)
})

test('only individually authenticated owners and admins can configure employee PINs', () => {
  assert.equal(canConfigureStaffKioskPin(STAFF_KIOSK_EMAIL, 120), false)
  assert.equal(canConfigureStaffKioskPin('manager@vre-vietnam.com', 80), false)
  assert.equal(canConfigureStaffKioskPin('admin@vre-vietnam.com', 100), true)
  assert.equal(canConfigureStaffKioskPin('owner@vre-vietnam.com', 120), true)
})
