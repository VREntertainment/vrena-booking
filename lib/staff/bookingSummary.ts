import type { BookingForm } from './types.ts'

export type BookingSummaryDetails = Pick<BookingForm, 'date' | 'time' | 'venueKey' | 'bookingKind' | 'players' | 'arenaCount' | 'guestBooking' | 'customerName' | 'contactName'>
export type BookingSummaryQuote = { subtotal: number; discountTotal: number; total: number; duration: number }
export type ConfirmedBookingSummary = { orderNumber: string; booking: BookingSummaryDetails; quote: BookingSummaryQuote }

/** Only a successful server response can produce a confirmed customer document. */
export function confirmedBookingSummary(booking: BookingForm, quote: BookingSummaryQuote, result: {
  order_number?: string; total?: number; subtotal?: number; discount_total?: number; duration_minutes?: number
} | null): ConfirmedBookingSummary | null {
  if (!result?.order_number || !Number.isFinite(result.total) || !['confirmed', 'paid', 'partially_paid'].includes(booking.orderStatus)) return null
  return {
    orderNumber: result.order_number,
    booking: {
      date: booking.date, time: booking.time, venueKey: booking.venueKey, bookingKind: booking.bookingKind,
      players: booking.players, arenaCount: booking.arenaCount, guestBooking: booking.guestBooking,
      customerName: booking.customerName, contactName: booking.contactName,
    },
    quote: {
      subtotal: Number.isFinite(result.subtotal) ? result.subtotal! : quote.subtotal,
      discountTotal: Number.isFinite(result.discount_total) ? result.discount_total! : quote.discountTotal,
      total: result.total!,
      duration: Number.isFinite(result.duration_minutes) && result.duration_minutes! > 0 ? result.duration_minutes! : quote.duration,
    },
  }
}
