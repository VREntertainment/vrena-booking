import type { StaffConsoleCopy } from './copy.ts'
import { staffConsoleText } from './copy.ts'
import { normalizeTime } from './dates.ts'
import { parseDong } from './formatting.ts'
import type { PaymentSplitDraft, PaymentSplitPayload, StaffOrder, StaffOrderEditDraft, StaffPaymentMethod } from './types.ts'

export function newPaymentSplit(method: StaffPaymentMethod = 'cash', amount = ''): PaymentSplitDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    payment_method: method,
    amount,
  }
}

export function normalizePaymentSplits(splits: PaymentSplitDraft[]): PaymentSplitPayload[] {
  return splits
    .map((split) => ({
      payment_method: split.payment_method,
      amount: parseDong(split.amount),
    }))
    .filter((split) => split.amount > 0)
}

export function paymentSplitTotal(splits: PaymentSplitPayload[]) {
  return splits.reduce((sum, split) => sum + split.amount, 0)
}

export function paymentStatusFromAmount(total: number, paidTotal: number): StaffOrder['payment_status'] {
  if (total <= 0) return 'paid'
  if (paidTotal <= 0) return 'unpaid'
  return paidTotal >= total ? 'paid' : 'partially_paid'
}

export function staffOrderEditDraft(order: StaffOrder): StaffOrderEditDraft {
  return {
    orderId: order.id,
    reason: '',
    gameId: order.game_id || '',
    bookingDate: order.booking_date,
    bookingTime: normalizeTime(order.booking_time),
    total: String(order.total),
  }
}

export function paymentMethodLabel(value: string, text: StaffConsoleCopy = staffConsoleText.en) {
  if (value === 'split') return text.split
  if (value === 'unpaid') return text.unpaid
  if (value === 'cash' || value === 'bank_transfer' || value === 'card_manual' || value === 'momo_manual' || value === 'vnpay') return text.paymentMethods[value]
  return value.replace(/_/g, ' ')
}

export function paymentStatusLabel(value: StaffOrder['payment_status'], text: StaffConsoleCopy = staffConsoleText.en) {
  if (value === 'unpaid') return text.unpaid
  if (value === 'paid') return text.orderStatuses.paid
  if (value === 'partially_paid') return text.orderStatuses.partially_paid
  if (value === 'refunded') return text.orderStatuses.refunded
  return value
}
