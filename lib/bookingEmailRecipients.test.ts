import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingEmailRecipients } from './bookingEmailRecipients.ts'

test('booking updates use the correct venue recipients despite a global override', () => {
  const previous = process.env.BOOKING_UPDATE_EMAIL_TO
  process.env.BOOKING_UPDATE_EMAIL_TO = 'contact@vre-vietnam.com'
  try {
    assert.deepEqual(bookingEmailRecipients('cafe-des-stagiaires'), ['vrena-thaodien@vre-vietnam.com', 'emile@vre-vietnam.com'])
    assert.deepEqual(bookingEmailRecipients('ha-do-centrosa'), ['contact@vre-vietnam.com'])
    assert.deepEqual(bookingEmailRecipients(null, 'CS-TEST'), ['vrena-thaodien@vre-vietnam.com', 'emile@vre-vietnam.com'])
    assert.throws(() => bookingEmailRecipients('unknown'), /Unknown booking venue/)
  } finally {
    if (previous === undefined) delete process.env.BOOKING_UPDATE_EMAIL_TO
    else process.env.BOOKING_UPDATE_EMAIL_TO = previous
  }
})
