import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeOperationMoney } from './staffOperationMoney.ts'

const ticket = (id: string, total: number, status = 'confirmed') => ({
  id, status: 'open', booking_type: 'ticket', ticket_status: status, ticket_total_price: total,
})
const order = (total: number, paidAmount = 0, session_id: string | null = null) => ({
  total, paidAmount, session_id, order_status: 'confirmed', payment_status: 'unpaid',
})

test('shows the reviewed unlinked booking and pending Cafe request without inventing payments', () => {
  const money = summarizeOperationMoney([ticket('hado', 660_000), ticket('cafe', 480_000, 'pending')], [])
  assert.equal(money.bookingValue, 660_000)
  assert.equal(money.pendingValue, 480_000)
  assert.equal(money.orderPaid, 0)
  assert.equal(money.orderBalance, 0)
  assert.equal(money.unlinkedValue, 660_000)
  assert.deepEqual(money.unlinkedSessionIds, ['hado'])
})

test('a linked order is counted once and its actual discounted total takes precedence', () => {
  const money = summarizeOperationMoney([ticket('booking', 660_000)], [order(600_000, 200_000, 'booking')])
  assert.equal(money.bookingValue, 600_000)
  assert.equal(money.orderPaid, 200_000)
  assert.equal(money.orderBalance, 400_000)
  assert.equal(money.unlinkedCount, 0)
})

test('does not use one order overpayment to reduce another order balance', () => {
  const money = summarizeOperationMoney([], [order(100, 150), order(200, 0)])
  assert.equal(money.orderBalance, 200)
})

test('cancelled and refunded orders do not revive a linked ticket as unpaid', () => {
  const money = summarizeOperationMoney([ticket('cancelled', 100), ticket('refunded', 200)], [
    { ...order(100, 0, 'cancelled'), order_status: 'cancelled' },
    { ...order(200, 200, 'refunded'), payment_status: 'refunded' },
  ])
  assert.equal(money.bookingValue, 0)
  assert.equal(money.orderPaid, 0)
  assert.equal(money.unlinkedCount, 0)
})

test('draft orders and pending tickets stay out of confirmed booking value', () => {
  const money = summarizeOperationMoney([ticket('pending', 480_000, 'pending')], [
    { ...order(480_000, 0, 'pending'), order_status: 'draft' },
  ])
  assert.equal(money.bookingValue, 0)
  assert.equal(money.orderBalance, 0)
  assert.equal(money.pendingValue, 480_000)
  assert.equal(money.pendingCount, 1)
})

test('completed tickets count; cancellations and unpriced community sessions do not', () => {
  const money = summarizeOperationMoney([
    ticket('completed', 330_000, 'completed'),
    ticket('cancelled', 330_000, 'cancelled'),
    { ...ticket('cancelled-session', 330_000), status: 'cancelled' },
    { id: 'community', status: 'open', booking_type: 'community' },
  ], [])
  assert.equal(money.bookingValue, 330_000)
  assert.equal(money.unlinkedCount, 1)
})
