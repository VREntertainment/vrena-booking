import assert from 'node:assert/strict'
import test from 'node:test'
import { reportPresetRange } from './staff/dates.ts'
import { decisionFinancial, decisionPeriod, type ReportOrderFact } from './staff/decisionReport.ts'

function order(id: string, overrides: Partial<ReportOrderFact> = {}): ReportOrderFact {
  return {
    id, session_id: 'linked', booking_date: '2026-11-23', booking_time: '09:20:00',
    arena_id: 'arena-1', players_count: 2, total: 200_000, order_status: 'confirmed', payment_status: 'paid',
    sessions: { date: '2026-11-23', venue_key: 'ha-do-centrosa' }, ...overrides,
  }
}

test('paid players, per-day averages and linked sessions use distinct denominators', () => {
  const result = decisionPeriod('2026-11-23', '2026-11-24', [
    order('a'), order('b', { payment_status: 'partially_paid' }),
    order('c', { session_id: null, sessions: null, booking_date: '2026-11-24', booking_time: '16:00:00', arena_id: 'cafe:arena-1' }),
    order('d', { order_status: 'cancelled' }), order('e', { payment_status: 'refunded' }),
  ], [], 'all', 1)
  assert.equal(result.paidPlayers, 4)
  assert.equal(result.playersPerDay, 3)
  assert.equal(result.playersPerSession, 3)
  assert.equal(result.sessions, 2)
  assert.equal(result.cancelled, 1)
  assert.deepEqual(result.weekdays, [2, 1, 0, 0, 0, 0, 0])
  assert.equal(result.hours[0][9], 2)
  assert.equal(result.times[16], 1)
  assert.equal(result.byVenue['cafe-des-stagiaires'].paidPlayers, 2)
})

test('played games count each game once per recorded session and respect date and venue filters', () => {
  const session = { date: '2026-11-23', venue_key: 'ha-do-centrosa' }
  const result = decisionPeriod('2026-11-23', '2026-11-25', [
    order('a'), order('b', { arena_id: 'arena-1', sessions: { ...session, venue_key: 'cafe-des-stagiaires' } }),
  ], [
    { session_id: 'a', game_ids: ['laser-tag','laser-tag','other-game'], sessions: session },
    { session_id: 'b', game_ids: ['laser-tag'], sessions: { ...session, venue_key: 'cafe-des-stagiaires' } },
    { session_id: 'c', game_ids: ['laser-tag'], sessions: { ...session, date: '2026-11-22' } },
    { session_id: 'd', game_ids: ['laser-tag'], sessions: { ...session, status: 'cancelled' } },
  ], 'ha-do-centrosa', 2)
  assert.equal(result.games.get('laser-tag')?.['ha-do-centrosa'], 1)
  assert.equal(result.games.get('other-game')?.['ha-do-centrosa'], 1)
  assert.equal(result.recordedSessions, 1)
  assert.equal(result.bookings, 1)
  assert.deepEqual(result.buckets.map((bin) => [bin.from, bin.to, bin.bookings]), [
    ['2026-11-23', '2026-11-24', 1], ['2026-11-25', '2026-11-25', 0],
  ])
})

test('venue checkboxes filter aggregate metrics while preserving per-venue comparison totals', () => {
  const date = '2026-11-23'
  const orders = [
    order('ha-do'),
    order('thao-dien', { session_id: null, sessions: null, arena_id: 'cafe:arena-1' }),
    order('unassigned', { session_id: null, sessions: null, arena_id: null }),
  ]
  const result = decisionPeriod(date, date, orders, [], new Set(['ha-do-centrosa', 'cafe-des-stagiaires']), 1)
  assert.equal(result.bookings, 2)
  assert.equal(result.sales, 400_000)
  assert.equal(result.byVenue.other.bookings, 1)
  assert.equal(decisionPeriod(date, date, orders, [], new Set(), 1).bookings, 0)
})

test('net sales follow receipt dates and the venue filter independently of booked sales', () => {
  const start = '2026-11-23'
  const end = '2026-11-26'
  const venue = 'cafe-des-stagiaires'
  const bookings = [
    order('reservation', { sessions: { date: start, venue_key: venue }, payment_status: 'unpaid' }),
    order('future', { booking_date: end, sessions: { date: end, venue_key: venue }, payment_status: 'unpaid' }),
  ]
  const result = decisionPeriod(start, end, bookings, [], venue, 2, [
    { sale_date: '2026-11-25', venue_key: venue, net_sales: 275_500, gross_sales: 315_500 },
    { sale_date: '2026-11-25', venue_key: 'ha-do-centrosa', net_sales: 240_000, gross_sales: 240_000 },
    { sale_date: '2026-11-27', venue_key: venue, net_sales: 420_000 },
  ])
  assert.equal(result.sales, 400_000)
  assert.equal(result.netSales, 275_500)
  assert.equal(result.grossSales, 315_500)
  assert.deepEqual(result.buckets.map((bin) => bin.grossSales), [0, 315_500])
  assert.deepEqual(result.buckets.map((bin) => bin.netSales), [0, 275_500])
  assert.equal(result.byVenue['ha-do-centrosa'].netSales, 240_000)
})

test('the default reporting window uses the last 30 completed days', () => {
  assert.deepEqual(reportPresetRange('last_30', '2026-11-27'), ['2026-10-28', '2026-11-26'])
})

test('this month covers only completed days in the current month', () => {
  assert.deepEqual(reportPresetRange('this_month', '2026-11-28'), ['2026-11-01', '2026-11-27'])
  assert.deepEqual(reportPresetRange('this_month', '2026-12-02'), ['2026-12-01', '2026-12-01'])
  const [start, end] = reportPresetRange('this_month', '2026-12-01')
  assert.ok(start > end)
})

test('Unpaid includes only eligible bookings through yesterday in the selected venue', () => {
  const orders = [
    order('part', { booking_date: '2026-11-27', payment_status: 'partially_paid' }),
    order('cancelled', { booking_date: '2026-11-27', order_status: 'cancelled', payment_status: 'unpaid' }),
    order('no-show', { booking_date: '2026-11-27', order_status: 'no_show', payment_status: 'unpaid' }),
    order('today', { booking_date: '2026-11-28', payment_status: 'unpaid' }),
    order('future', { booking_date: '2026-11-29', payment_status: 'unpaid' }),
    order('other', { booking_date: '2026-11-27', payment_status: 'unpaid', sessions: { date: '2026-11-27', venue_key: 'cafe-des-stagiaires' } }),
  ]
  const totals = decisionFinancial(orders, [{ order_id: 'part', amount: 50_000, payment_method: 'cash' }], 'ha-do-centrosa', '2026-11-27')
  assert.equal(totals.unpaidAmount, 150_000)
  assert.equal(totals.methodTotals.cash, 50_000)
})

test('the free trial metric counts unique active sessions in the selected dates and venues', () => {
  const trial = { date: '2026-11-23', venue_key: 'ha-do-centrosa', booking_category: 'free_trial' }
  const orders = [
    order('trial', { session_id: 'trial', sessions: trial, players_count: 4, total: 0 }),
    order('duplicate', { session_id: 'trial', sessions: trial }),
    order('standard', { total: 0 }),
    order('other-venue', { session_id: 'other', sessions: { ...trial, venue_key: 'cafe-des-stagiaires' } }),
    order('other-date', { session_id: 'prior', booking_date: '2026-11-22', sessions: { ...trial, date: '2026-11-22' } }),
    order('cancelled-order', { session_id: 'cancelled-order', order_status: 'cancelled', sessions: trial }),
    order('cancelled-session', { session_id: 'cancelled-session', sessions: { ...trial, status: 'cancelled' } }),
    order('deleted-session', { session_id: 'deleted-session', sessions: { ...trial, deleted_at: '2026-11-23T12:00:00Z' } }),
    order('refunded', { session_id: 'refunded', payment_status: 'refunded', sessions: trial }),
    order('no-show', { session_id: 'no-show', order_status: 'no_show', sessions: trial }),
  ]
  const count = (period: string, venue: Parameters<typeof decisionPeriod>[4]) =>
    decisionPeriod(period, period, orders, [], venue, 1).freeTrials
  assert.equal(count('2026-11-23', 'ha-do-centrosa'), 1)
  assert.equal(count('2026-11-23', 'all'), 2)
  assert.equal(count('2026-11-22', 'ha-do-centrosa'), 1)
  assert.equal(count('2026-11-22', 'cafe-des-stagiaires'), 0)
})
