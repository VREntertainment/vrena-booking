import assert from 'node:assert/strict'
import test from 'node:test'
// Node's type-stripping test runner requires the explicit TypeScript extension.
import {
  isValidStaffCustomerEmail,
  isPhonePasswordLoginEmail,
  normalizePhonePasswordIdentifier,
  phonePasswordLoginEmail,
} from './phonePasswordAccount.ts'

test('validates staff customer email without a backtracking expression', () => {
  assert.equal(isValidStaffCustomerEmail('customer@example.com'), true)
  assert.equal(isValidStaffCustomerEmail('customer@example'), false)
  assert.equal(isValidStaffCustomerEmail('customer@@example.com'), false)
  assert.equal(isValidStaffCustomerEmail(`customer@${'example.'.repeat(1000)}com`), false)
})

test('normalizes Vietnamese local and country-prefixed phone numbers consistently', () => {
  assert.equal(normalizePhonePasswordIdentifier('0779 950 079'), '+84779950079')
  assert.equal(normalizePhonePasswordIdentifier('+84 0779 950 079'), '+84779950079')
  assert.equal(normalizePhonePasswordIdentifier('0084 779 950 079'), '+84779950079')
  assert.equal(normalizePhonePasswordIdentifier('84779950079'), '+84779950079')
})

test('rejects empty and implausible phone numbers', () => {
  assert.equal(normalizePhonePasswordIdentifier(''), '')
  assert.equal(normalizePhonePasswordIdentifier('123'), '')
})

test('creates a stable non-routable login email without exposing the phone number', async () => {
  const first = await phonePasswordLoginEmail('0779950079')
  const second = await phonePasswordLoginEmail('+84 779 950 079')

  assert.equal(first, second)
  assert.equal(isPhonePasswordLoginEmail(first), true)
  assert.equal(first.includes('779950079'), false)

  const randomized = await phonePasswordLoginEmail('0779950079', 'unique-account-salt')
  assert.notEqual(randomized, first)
  assert.equal(isPhonePasswordLoginEmail(randomized), true)
})
