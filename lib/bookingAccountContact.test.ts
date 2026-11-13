import assert from 'node:assert/strict'
import test from 'node:test'
import { needsBookingEmail } from './bookingAccountContact.ts'

test('checkout requests a real contact email for incomplete and synthetic identities', () => {
  for (const email of [null, undefined, '', ' ', 'broken', 'phone-123@phone-login.vrena.invalid', 'guest@vrena.guest.invalid']) {
    assert.equal(needsBookingEmail(email), true)
  }
  for (const email of ['customer@example.com', ' Customer@Example.com ']) {
    assert.equal(needsBookingEmail(email), false)
  }
})
