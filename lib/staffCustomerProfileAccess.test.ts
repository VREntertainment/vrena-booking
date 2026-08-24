import assert from 'node:assert/strict'
import test from 'node:test'
import { isStaffCustomerProfile } from './staffCustomerProfileAccess.ts'

test('allows ordinary player and legacy empty-role customer profiles', () => {
  assert.equal(isStaffCustomerProfile('player', false), true)
  assert.equal(isStaffCustomerProfile(null, false), true)
})

test('rejects employee-linked and privileged profiles', () => {
  assert.equal(isStaffCustomerProfile('player', true), false)
  assert.equal(isStaffCustomerProfile('staff', false), false)
  assert.equal(isStaffCustomerProfile('admin', false), false)
  assert.equal(isStaffCustomerProfile('owner', false), false)
})
