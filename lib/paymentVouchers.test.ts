import { test } from 'node:test'
import assert from 'node:assert/strict'
import { voucherAmount, availablePaymentCredit, voucherMoneyInput, voucherExpiryLabel, voucherVenueNames, voucherExpiryDateInput, voucherExpiryFromDate, type PaymentVoucher } from './paymentVouchers.ts'
test('money accepts positive integer VND only', () => {
  for (const value of ['', '-1', '0', '1.1', '1e3', 'Infinity', '2147483648']) assert.equal(voucherAmount(value), null)
  assert.equal(voucherAmount(' 40000 '), 40000)
})
test('already-issued credit cannot be issued again after redemption', () => {
  const voucher = { source_payment_id: 'receipt', amount: 40000, balance: 0 } as PaymentVoucher
  assert.equal(availablePaymentCredit('receipt', 100000, [voucher]), 60000)
})

test('comma grouped VND stays exact and rejects malformed money', () => {
  assert.equal(voucherMoneyInput('1976000'), '1,976,000')
  assert.equal(voucherAmount('1,976,000'), 1976000)
  for (const value of ['1,97,600', '1,000.50', '-1,000']) assert.equal(voucherAmount(value), null)
  assert.equal(voucherExpiryLabel(null, false), 'No expiry.')
  assert.match(voucherExpiryLabel('2026-12-08T17:00:00Z', false), /08\/12\/2026/)
})

test('legacy and multi-venue vouchers list only valid venues', () => {
  assert.deepEqual(voucherVenueNames({ venue_key: 'ha-do-centrosa' }), ['VRena Hà Đô Centrosa'])
  assert.deepEqual(voucherVenueNames({ venue_key: 'ha-do-centrosa', valid_venue_keys: ['cafe-des-stagiaires'] }), ['VRena Thảo Điền'])
  assert.equal(voucherVenueNames({ venue_key: 'ha-do-centrosa', valid_venue_keys: ['ha-do-centrosa', 'cafe-des-stagiaires'] }).length, 2)
})

test('editing expiry preserves the final valid Vietnam calendar date', () => {
  assert.equal(voucherExpiryDateInput('2027-11-08T17:00:00Z'), '2027-11-08')
  assert.equal(voucherExpiryFromDate('2027-11-08'), '2027-11-08T17:00:00.000Z')
  assert.equal(voucherExpiryDateInput(null), '')
  assert.equal(voucherExpiryFromDate(''), null)
})
