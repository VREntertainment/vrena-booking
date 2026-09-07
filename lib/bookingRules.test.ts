import assert from 'node:assert/strict'
import { test } from 'node:test'
import { availableSessionTimes, cafeTicketTimes } from './booking/availability.ts'
import { calculateTicketCheckout, clampTicketLoyaltyRedemption, type TicketCheckoutAmountsInput } from './booking/checkout.ts'

const date = '2026-09-09'
const now = new Date(2026, 8, 8, 12, 0)
const availability = { date, duration: 40, arenaCount: 1, sessions: [], blockedTimes: [], text: { arenaAvailable: 'arena available', arenasAvailable: 'arenas available' }, now }
const occupied = { id: 'reserved', status: 'open' as const, date, venue_key: 'ha-do-centrosa', start_time: '10:00', duration_minutes: 40, arena_count: 2, max_players: 8 }

test('booking availability respects closing time, adjacent sessions, and complete arena occupancy', () => {
  const times = availableSessionTimes({ ...availability, sessions: [occupied] })
  assert.ok(times.some(slot => slot.value === '09:20'))
  assert.ok(!times.some(slot => slot.value === '09:40'))
  assert.ok(!times.some(slot => slot.value === '10:00'))
  assert.ok(times.some(slot => slot.value === '10:40'))
  assert.equal(times.at(-1)?.value, '21:20')
  assert.equal(times[0].label, '09:00-09:40 (2 arenas available)')
})

test('editing excludes the current booking; other venues and cancelled sessions do not consume Ha Do capacity', () => {
  const fullDay = availableSessionTimes(availability)
  assert.deepEqual(availableSessionTimes({ ...availability, sessions: [occupied], excludeSessionId: occupied.id }), fullDay)
  assert.deepEqual(availableSessionTimes({ ...availability, sessions: [{ ...occupied, venue_key: 'cafe-des-stagiaires' }, { ...occupied, status: 'cancelled' }] }), fullDay)
})

test('blocked arenas and legacy session capacity are combined, with singular availability labels', () => {
  const oneArena = { ...occupied, arena_count: null, max_players: 4 }
  const times = availableSessionTimes({ ...availability, sessions: [oneArena] })
  assert.equal(times.find(slot => slot.value === '10:00')?.label, '10:00-10:40 (1 arena available)')
  assert.ok(!availableSessionTimes({ ...availability, sessions: [oneArena], arenaCount: 2 }).some(slot => slot.value === '10:00'))
  const blockedTimes = [{ date, start_time: '10:00', end_time: '10:20', arenas_used: 1 }]
  assert.ok(!availableSessionTimes({ ...availability, sessions: [oneArena], blockedTimes }).some(slot => slot.value === '10:00'))
})

test('same-day slots skip the current minute while future days retain opening slots', () => {
  const sameDay = new Date(2026, 8, 9, 10, 20)
  assert.equal(availableSessionTimes({ ...availability, now: sameDay })[0].value, '10:40')
  assert.equal(availableSessionTimes(availability)[0].value, '09:00')
  assert.deepEqual(availableSessionTimes({ ...availability, date: '' }), [])
})

test('Cafe availability keeps its own launch date, opening hours, and same-day cutoff', () => {
  assert.deepEqual(cafeTicketTimes('2026-08-30', 45, 1, now), [])
  const times = cafeTicketTimes(date, 45, 1, now)
  assert.equal(times[0].label, '16:00-16:45')
  assert.equal(times.at(-1)?.label, '21:00-21:45')
  assert.equal(times.length, 16)
  assert.equal(cafeTicketTimes(date, 45, 1, new Date(2026, 8, 9, 16, 0))[0].value, '16:20')
})

const base: TicketCheckoutAmountsInput = {
  ticketType: 'individual', isHaDoBookingVenue: true,
  currentTicketPricing: { grossPrice: 1000000, discountAmount: 100000 },
  ticketDiscountQuote: { discount_amount: 150000, discount_name: 'Voucher' },
  ticketAutomaticDiscountQuote: { discount_amount: 120000, discount_name: 'Automatic' },
  ticketLoyaltyRedemption: { loyalty_points_total: 100, redeem_value_vnd_per_point: 1000 },
  profile: null, ticketUseLoyaltyPoints: true, ticketLoyaltyPointsToRedeem: '50', ticketLoyaltyEarnQuote: null,
}

test('checkout chooses one best discount, then applies loyalty to the remaining price', () => {
  const quote = calculateTicketCheckout(base)
  assert.equal(quote.activeTicketDiscountSource, 'voucher')
  assert.equal(quote.activeTicketDiscountAmount, 150000)
  assert.equal(quote.currentTicketPriceBeforeLoyalty, 850000)
  assert.equal(quote.appliedTicketLoyaltyPoints, 50)
  assert.equal(quote.currentTicketTotalPrice, 800000)
})

test('built-in group reduction wins ties and is never stacked with a voucher', () => {
  const quote = calculateTicketCheckout({ ...base, currentTicketPricing: { grossPrice: 1000000, discountAmount: 150000 } })
  assert.equal(quote.activeTicketDiscountSource, 'automatic')
  assert.equal(quote.activeTicketDiscountAmount, 150000)
  assert.equal(quote.currentTicketTotalPrice, 800000)
})

test('loyalty is capped by both available balance and remaining price, rounding down whole points', () => {
  const quote = calculateTicketCheckout({ ...base, ticketLoyaltyPointsToRedeem: '1000.9', ticketLoyaltyRedemption: { loyalty_points_total: 10000, redeem_value_vnd_per_point: 3000 } })
  assert.equal(quote.maxTicketLoyaltyPoints, 283)
  assert.equal(quote.appliedTicketLoyaltyPoints, 283)
  assert.equal(quote.currentTicketTotalPrice, 1000)
  assert.equal(clampTicketLoyaltyRedemption(9, 3, 1000, 100000), 3)
  assert.equal(clampTicketLoyaltyRedemption(Infinity, 3, 1000, 100000), 0)
  assert.equal(clampTicketLoyaltyRedemption(3, 3, 0, 100000), 0)
})

test('Cafe and special-event quotes cannot apply Ha Do voucher or loyalty reductions', () => {
  const cafe = calculateTicketCheckout({ ...base, isHaDoBookingVenue: false })
  assert.equal(cafe.activeTicketDiscountAmount, 100000)
  assert.equal(cafe.appliedTicketLoyaltyPoints, 0)
  assert.equal(cafe.currentTicketTotalPrice, 900000)
  for (const ticketType of ['birthday', 'corporate'] as const) {
    const event = calculateTicketCheckout({ ...base, ticketType })
    assert.equal(event.currentTicketTotalPrice, 0)
    assert.equal(event.appliedTicketLoyaltyPoints, 0)
    assert.equal(event.activeTicketDiscountAmount, 0)
  }
})
