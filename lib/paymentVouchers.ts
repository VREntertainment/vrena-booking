export type PaymentVoucher = {
  id: string; code: string; source_order_id: string; source_payment_id: string
  customer_id: string | null; venue_key: string; amount: number; balance: number; created_at: string; expires_at?: string | null; valid_venue_keys?: string[] | null
}
export function voucherAmount(value: string): number | null {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value.trim())) return null
  const amount = Number(value.replaceAll(',', ''))
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 2147483647 ? amount : null
}
export function availablePaymentCredit(paymentId: string, amount: number, vouchers: PaymentVoucher[]) {
  return Math.max(0, amount - vouchers.filter(v => v.source_payment_id === paymentId).reduce((sum, v) => sum + v.amount, 0))
}

export function voucherMoneyInput(value: string): string {
  const digits = value.replaceAll(',', '')
  return /^\d*$/.test(digits) ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : value
}
export function voucherExpiryLabel(expiresAt: string | null | undefined, vi: boolean): string {
  return expiresAt ? `${vi ? 'Có hiệu lực đến' : 'Valid until'} ${new Date(new Date(expiresAt).getTime() - 1).toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })} (23:59, GMT+7).` : vi ? 'Không hết hạn.' : 'No expiry.'
}

export const paymentVoucherVenues = [
  { key: 'ha-do-centrosa', name: 'VRena Hà Đô Centrosa' },
  { key: 'cafe-des-stagiaires', name: 'VRena Thảo Điền' },
] as const
export function voucherVenueNames(voucher: Pick<PaymentVoucher, 'venue_key' | 'valid_venue_keys'>): string[] {
  return (voucher.valid_venue_keys ?? [voucher.venue_key]).map(key => paymentVoucherVenues.find(venue => venue.key === key)?.name ?? key)
}
