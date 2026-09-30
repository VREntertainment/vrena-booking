import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmedBookingSummary } from './staff/bookingSummary.ts'
import { defaultBookingForm } from './staff/forms.ts'

const quote = { subtotal: 1200000, discountTotal: 0, total: 1200000, duration: 90 }
test('confirmation requires a saved server order and an active booking status', () => {
  const booking = defaultBookingForm()
  assert.equal(confirmedBookingSummary(booking, quote, null), null)
  assert.equal(confirmedBookingSummary(booking, quote, { total: 100 }), null)
  for (const orderStatus of ['draft', 'cancelled', 'refunded', 'no_show', 'completed'] as const) {
    assert.equal(confirmedBookingSummary({ ...booking, orderStatus }, quote, { order_number: 'VRE-1', total: 100 }), null)
  }
})
test('confirmation uses server totals and preserves details after the new-booking form changes', () => {
  const booking = { ...defaultBookingForm(), customerName: 'QA Client', date: '2026-10-15', time: '14:00', note: 'Private staff note' }
  const snapshot = confirmedBookingSummary(booking, quote, { order_number: 'VRE-1', subtotal: 1100000, discount_total: 100000, total: 1000000 })!
  booking.customerName = 'Next customer'
  booking.time = '17:00'
  quote.total = 2000000
  assert.equal(snapshot.booking.customerName, 'QA Client')
  assert.equal(snapshot.booking.time, '14:00')
  assert.equal(snapshot.quote.total, 1000000)
  assert.equal(snapshot.quote.subtotal, 1100000)
  assert.equal(snapshot.quote.discountTotal, 100000)
  assert.equal(snapshot.quote.duration, 90)
  assert.equal('note' in snapshot.booking, false)
})
