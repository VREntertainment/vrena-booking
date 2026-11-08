import { test } from 'node:test'
import assert from 'node:assert/strict'
import { voucherAmount, availablePaymentCredit, voucherMoneyInput, voucherExpiryLabel, type PaymentVoucher } from './paymentVouchers.ts'
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
