import { staffBookingCopy } from './bookingCopy.ts'
import type { StaffConsoleCopy } from './copy.ts'
import { staffConsoleText } from './copy.ts'
import { formatVnd } from './formatting.ts'
import { paymentMethodLabel } from './payments.ts'
import { staffOrderPaymentRows } from './reporting.ts'
import type { StaffOrder, StaffOrderPayment, StaffReportSummary } from './types.ts'

export function bookingSourceLabel(source: string | null | undefined, text: StaffConsoleCopy = staffConsoleText.en) {
  const copy = staffBookingCopy[text === staffConsoleText.vi ? 'vi' : 'en']
  return copy.sources[source as keyof typeof copy.sources] || (text === staffConsoleText.vi ? 'Chưa xác định' : 'Unspecified')
}

export function orderPaymentLabel(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>, text: StaffConsoleCopy = staffConsoleText.en) {
  const payments = staffOrderPaymentRows(order, paymentsByOrderId)
  if (payments.length === 0) return paymentMethodLabel(order.payment_method, text)
  return payments
    .map((payment) => `${paymentMethodLabel(payment.payment_method, text)} ${formatVnd(payment.amount)}`)
    .join(' + ')
}

export function paymentPieItems(report: StaffReportSummary, text: StaffConsoleCopy = staffConsoleText.en) {
  return [
    { label: text.labels.cash, value: report.cashTotal },
    { label: text.labels.bankTransfer, value: report.bankTransferTotal },
    { label: text.paymentMethods.card_manual, value: report.cardTotal },
    { label: text.paymentMethods.momo_manual, value: report.momoTotal },
    { label: text.paymentMethods.vnpay, value: report.vnpayTotal },
    { label: text.unpaid, value: report.unpaidAmount },
  ]
}
