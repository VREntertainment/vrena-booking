import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildZaloMiniAppBookingRequest,
  normalizeZaloMiniAppBookingSelection,
  normalizeZaloMiniAppQuoteSelection,
  quoteZaloMiniAppBooking,
} from './zaloMiniAppBooking.ts'

const base = {
  venue: 'ha-do-centrosa',
  ticketType: 'individual',
  date: '2026-11-10',
  time: '10:00',
  durationMinutes: 30,
  players: 2,
  arenaCount: 1,
  guestName: 'Zalo reviewer',
  guestPhone: '0707472499',
  birthdayPackageId: null,
  acceptedTerms: true,
}

test('normalizes a current Hà Đô Mini App guest booking', () => {
  const result = normalizeZaloMiniAppBookingSelection(base)
  assert.equal(result.error, '')
  assert.equal(result.data?.guestPhone, '0707472499')
  assert.equal(result.data?.durationMinutes, 30)
})

test('uses the current November tariff and guest RPC for Mini App tickets', () => {
  const selection = normalizeZaloMiniAppBookingSelection(base).data!
  const { quote, request } = buildZaloMiniAppBookingRequest(selection)
  assert.equal(quote.unitPrice, 260_000)
  assert.equal(quote.bookingTotal, 520_000)
  assert.equal(request.name, 'create_guest_ticket_booking')
  assert.equal(request.args.p_guest_phone, '0707472499')
})

test('keeps birthday packages and sends them through staff-confirmed special booking fields', () => {
  const result = normalizeZaloMiniAppBookingSelection({
    ...base,
    ticketType: 'birthday',
    birthdayPackageId: 'epic-birthday',
    players: 1,
    durationMinutes: 30,
  })
  assert.equal(result.error, '')
  assert.equal(result.data?.players, 12)
  assert.equal(result.data?.arenaCount, 2)
  const quote = quoteZaloMiniAppBooking(result.data!)
  assert.equal(quote.displayTotal, 4_500_000)
  assert.equal(quote.bookingTotal, 0)
  assert.match(quote.specialNote, /Epic Birthday/)
})

test('requires in-app consent and a valid phone before any booking call', () => {
  assert.match(normalizeZaloMiniAppBookingSelection({ ...base, acceptedTerms: false }).error, /Accept/)
  assert.match(normalizeZaloMiniAppBookingSelection({ ...base, guestPhone: '123' }).error, /phone/)
})

test('quotes without collecting contact details or consent', () => {
  const result = normalizeZaloMiniAppQuoteSelection({
    ...base,
    guestPhone: undefined,
    acceptedTerms: false,
  })
  assert.equal(result.error, '')
  assert.equal(quoteZaloMiniAppBooking(result.data!).displayTotal, 520_000)
})

test('rejects custom-price corporate requests from the fixed-price Checkout flow', () => {
  assert.match(normalizeZaloMiniAppBookingSelection({ ...base, ticketType: 'corporate' }).error, /ticket type/)
})
