import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays } from './staff/dates.ts'
import { buildDailySeries, buildStaffReport, mergeOrderPayments, orderPaidAmount, paymentMapFromRows, staffReportSnapshotFromRpc } from './staff/reporting.ts'
import type { StaffOrder, StaffOrderPayment } from './staff/types'

function order(overrides: Partial<StaffOrder> = {}): StaffOrder {
  return {
    id: 'order-1', order_number: 'LOCAL-1', customer_id: null, customer_name: null,
    customer_phone: null, customer_email: null, game_id: 'game-1', session_id: null,
    booking_date: '2026-09-05', booking_time: '17:00', players_count: 4, arena_id: 'arena-1',
    subtotal: 440000, discount_rule_id: null, discount_code: null, discount_total: 0,
    total: 440000, payment_method: 'cash', payment_status: 'partially_paid', order_status: 'confirmed',
    created_by: null, created_at: '', updated_at: '', invoice_required: false,
    company_name: null, tax_code: null, invoice_email: null, invoice_address: null,
    invoice_status: '', external_invoice_id: null, internal_note: null, ...overrides,
  }
}
function payment(id: string, amount: number, method: StaffOrderPayment['payment_method'], orderId = 'order-1'): StaffOrderPayment {
  return { id, order_id: orderId, amount, payment_method: method, created_by: null, created_at: '' }
}

test('report totals preserve split payments and remaining balances after extraction', () => {
  const payments = paymentMapFromRows([payment('cash', 100000, 'cash'), payment('bank', 200000, 'bank_transfer')])
  const report = buildStaffReport([order()], new Map([['game-1', 'Laser Tag']]), payments)
  assert.equal(report.totalSales, 440000)
  assert.equal(report.totalPaid, 300000)
  assert.equal(report.unpaidAmount, 140000)
  assert.equal(report.cashTotal, 100000)
  assert.equal(report.bankTransferTotal, 200000)
  assert.equal(report.bestSellingGame, 'Laser Tag')
  assert.equal(report.players, 4)
})

test('payment rows remain authoritative for overpayments and legacy paid orders still work', () => {
  const payments = paymentMapFromRows([payment('bank', 500000, 'bank_transfer')])
  assert.equal(orderPaidAmount(order(), payments), 500000)
  assert.equal(buildStaffReport([order()], new Map(), payments).unpaidAmount, 0)
  assert.equal(orderPaidAmount(order({ payment_status: 'paid' }), new Map()), 440000)
  assert.equal(orderPaidAmount(order({ payment_status: 'unpaid' }), new Map()), 0)
})

test('refreshing one order replaces its payments without duplicating or deleting another order', () => {
  const other = payment('other', 1, 'cash', 'order-2')
  const replacement = payment('new', 300000, 'bank_transfer')
  const merged = mergeOrderPayments([payment('old', 1, 'cash'), other], ['order-1'], [replacement])
  assert.deepEqual(merged, [other, replacement])
  assert.deepEqual(mergeOrderPayments(merged, ['order-1'], [replacement]), merged)
})

test('daily reports include empty dates, normalize reversed ranges, and cross month boundaries', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  const series = buildDailySeries([order({ booking_date: '2026-09-01' }), order({ booking_date: '2026-09-03' })], '2026-09-02', '2026-08-31')
  assert.deepEqual(series.map((point) => [point.date, point.sales]), [
    ['2026-08-31', 0], ['2026-09-01', 440000], ['2026-09-02', 0],
  ])
})

test('report snapshots accept numeric database strings and missing comparison data', () => {
  const snapshot = staffReportSnapshotFromRpc({ report: { total_sales: '440000', total_paid: '300000' }, report_series: [{ date: '2026-09-05', sales: '440000', bookings: '1' }] })
  assert.equal(snapshot.report.totalSales, 440000)
  assert.equal(snapshot.report.totalPaid, 300000)
  assert.equal(snapshot.comparisonReport.totalSales, 0)
  assert.equal(snapshot.reportSeries[0].sales, 440000)
  assert.deepEqual(snapshot.comparisonOrders, [])
})
