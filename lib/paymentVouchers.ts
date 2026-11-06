export type PaymentVoucher = {
  id: string; code: string; source_order_id: string; source_payment_id: string
  customer_id: string | null; venue_key: string; amount: number; balance: number; created_at: string
}
export function voucherAmount(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 2147483647 ? amount : null
}
export function availablePaymentCredit(paymentId: string, amount: number, vouchers: PaymentVoucher[]) {
  return Math.max(0, amount - vouchers.filter(v => v.source_payment_id === paymentId).reduce((sum, v) => sum + v.amount, 0))
}
