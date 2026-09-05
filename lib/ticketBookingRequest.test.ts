import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTicketBookingRequest, type TicketBookingSelection } from './ticketBookingRequest.ts'

const selection: TicketBookingSelection = {
  isHaDo: true, authenticated: true, ticketType: 'individual',
  date: '2026-10-10', time: '17:00', durationMinutes: 20,
  players: 5, arenaCount: 2, defaultGame: 'laser-tag',
  unitPrice: 110000, totalPrice: 550000, special: false,
  note: '', loyaltyPoints: 10, discountCode: 'PLAYER',
  guestName: ' Guest ', guestPhone: '+84900000993',
}

test('Cafe requests leave pricing to the server and preserve validated player and arena counts', () => {
  for (const players of [5, 8, 9]) {
    const request = buildTicketBookingRequest({ ...selection, isHaDo: false, authenticated: false, players })
    assert.equal(request.name, 'create_cafe_ticket_booking_request')
    assert.equal(request.args.p_player_count, players)
    assert.equal(request.args.p_arena_count, 2)
    assert.equal('p_total_price' in request.args, false)
    assert.equal('p_discount_code' in request.args, false)
    assert.equal(request.args.p_guest_name, 'Guest')
    assert.equal(request.args.p_guest_phone, '+84900000993')
  }
})

test('account bookings do not leak a previous guest contact into Cafe requests', () => {
  const request = buildTicketBookingRequest({ ...selection, isHaDo: false })
  assert.equal(request.name, 'create_cafe_ticket_booking_request')
  assert.equal(request.args.p_guest_name, null)
  assert.equal(request.args.p_guest_phone, null)
})

test('special requests disable payment discounts and use the appropriate bounded note argument', () => {
  const note = `  ${'x'.repeat(550)}  `
  const account = buildTicketBookingRequest({ ...selection, ticketType: 'birthday', special: true, note })
  assert.equal(account.name, 'create_ticket_booking')
  assert.equal(account.args.p_unit_price, 0)
  assert.equal(account.args.p_total_price, 0)
  assert.equal(account.args.p_loyalty_points_to_redeem, 0)
  assert.equal(account.args.p_discount_code, null)
  assert.equal(account.args.p_special_note?.length, 500)
  const guest = buildTicketBookingRequest({ ...selection, ticketType: 'corporate', authenticated: false, special: true, note })
  assert.equal(guest.name, 'create_guest_ticket_booking')
  assert.equal(guest.args.p_guest_note?.length, 500)
  assert.equal('p_special_note' in guest.args, false)
  assert.equal('p_loyalty_points_to_redeem' in guest.args, false)
})

test('ordinary account bookings preserve the price quote and do not send special-request arguments', () => {
  const request = buildTicketBookingRequest(selection)
  assert.equal(request.name, 'create_ticket_booking')
  assert.equal(request.args.p_total_price, 550000)
  assert.equal(request.args.p_loyalty_points_to_redeem, 10)
  assert.equal(request.args.p_discount_code, 'PLAYER')
  assert.equal(request.args.p_start_time, '17:00:00')
  assert.equal('p_special_note' in request.args, false)
})
