import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isStaffCustomerNicknameConflict,
  normalizeOptionalStaffCustomerEmail,
  normalizeStaffCustomerNickname,
} from './staffCustomerIdentity.ts'

test('stores a blank customer email as null', () => {
  assert.equal(normalizeOptionalStaffCustomerEmail(''), null)
  assert.equal(normalizeOptionalStaffCustomerEmail('   '), null)
  assert.equal(normalizeOptionalStaffCustomerEmail(undefined), null)
})

test('normalizes a supplied customer email and nickname', () => {
  assert.equal(normalizeOptionalStaffCustomerEmail(' Customer@Example.COM '), 'customer@example.com')
  assert.equal(normalizeStaffCustomerNickname('  Harris  '), 'Harris')
})

test('recognizes database nickname conflicts', () => {
  assert.equal(isStaffCustomerNicknameConflict({ code: '23505', message: 'Player nickname is already in use.' }), true)
  assert.equal(isStaffCustomerNicknameConflict({ code: '23505', message: 'Different unique constraint' }), false)
  assert.equal(isStaffCustomerNicknameConflict({ code: '22000', message: 'Player nickname is already in use.' }), false)
})
