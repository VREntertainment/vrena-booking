import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error allowImportingTsExtensions is intentionally disabled for app code.
import {
  isPendingPhoneAccountSetup,
  isValidPhoneSetupPassword,
  maskPhoneSetupEmail,
  normalizePhoneSetupEmail,
  phoneSetupTemporaryPasswordExpired,
} from './phoneAccountSetup.ts'

test('recognizes only pending staff-created phone accounts', () => {
  assert.equal(isPendingPhoneAccountSetup({ login_identifier: 'phone_password', phone_setup_required: true }), true)
  assert.equal(isPendingPhoneAccountSetup({ login_identifier: 'phone_password', phone_setup_required: false }), false)
  assert.equal(isPendingPhoneAccountSetup({ phone_setup_required: true }), false)
})

test('validates setup email and permanent password', () => {
  assert.equal(normalizePhoneSetupEmail(' Player@Example.com '), 'player@example.com')
  assert.equal(normalizePhoneSetupEmail('not-an-email'), '')
  assert.equal(isValidPhoneSetupPassword('1234567'), false)
  assert.equal(isValidPhoneSetupPassword('strong-pass-8'), true)
})

test('checks temporary password expiry and masks the recovery email', () => {
  assert.equal(phoneSetupTemporaryPasswordExpired({ phone_setup_expires_at: '2026-08-23T00:00:00.000Z' }, new Date('2026-08-22T00:00:00.000Z')), false)
  assert.equal(phoneSetupTemporaryPasswordExpired({ phone_setup_expires_at: '2026-08-21T00:00:00.000Z' }, new Date('2026-08-22T00:00:00.000Z')), true)
  assert.equal(maskPhoneSetupEmail('player@example.com'), 'pl••••@example.com')
})
