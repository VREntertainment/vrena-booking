import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmedBookingSummary, savedBookingSummary } from './staff/bookingSummary.ts'
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


test('saved share uses current persisted timing and agreed prices, excluding internal notes', () => {
  const session = { venue_key: 'cafe-des-stagiaires', date: '2026-10-03', start_time: '16:30:00', duration_minutes: 120, max_players: 10, arena_count: 1, status: 'open' } as import('./staff/types.ts').StaffOperationSession
  const order = { order_number: 'VR-1', order_status: 'confirmed', customer_name: 'Client', subtotal: 3000000, discount_total: 200000, total: 2800000, internal_note: 'Private note\nEvent / corporate; reserved minutes: 90\nContact person: Host' } as import('./staff/types.ts').StaffOrder
  const snapshot = savedBookingSummary(session, order)!
  assert.equal(snapshot.booking.time, '16:30')
  assert.equal(snapshot.quote.duration, 120)
  assert.equal(snapshot.quote.total, 2800000)
  assert.equal(snapshot.booking.venueKey, 'cafe-des-stagiaires')
  assert.equal(snapshot.booking.contactName, 'Host')
  assert.equal(JSON.stringify(snapshot).includes('Private note'), false)
  assert.equal(savedBookingSummary({ ...session, status: 'cancelled' }, order), null)
  assert.equal(savedBookingSummary(session, { ...order, order_status: 'refunded' }), null)
  assert.equal(savedBookingSummary(session, null), null)
  const ticket = savedBookingSummary({ ...session, ticket_status: 'confirmed', ticket_reference: 'TICKET-1', ticket_total_price: 0 }, null)!
  assert.equal(ticket.orderNumber, 'TICKET-1')
  assert.equal(ticket.quote.total, 0)
  const pending = savedBookingSummary({ ...session, ticket_status: 'pending', ticket_total_price: 240000 }, null)!
  assert.equal(pending.orderNumber, '')
  assert.equal(pending.quote.total, 240000)
  assert.equal(savedBookingSummary({ ...session, venue_key: null }, order)!.booking.venueKey, 'ha-do-centrosa')
})
