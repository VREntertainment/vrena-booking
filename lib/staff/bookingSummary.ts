import type { BookingForm, StaffOperationSession, StaffOrder } from './types.ts'

export type BookingSummaryDetails = Pick<BookingForm, 'date' | 'time' | 'venueKey' | 'bookingKind' | 'players' | 'arenaCount' | 'guestBooking' | 'customerName' | 'contactName'>
export type BookingSummaryQuote = { subtotal: number; discountTotal: number; total: number; duration: number }
export type ConfirmedBookingSummary = { orderNumber: string; booking: BookingSummaryDetails; quote: BookingSummaryQuote }

/** Use persisted session timing and agreed order prices, never today's pricing rules. */
export function savedBookingSummary(session: StaffOperationSession, order: StaffOrder | null): ConfirmedBookingSummary | null {
  const venue = session.venue_key || (order?.arena_id?.startsWith('cafe:') ? 'cafe-des-stagiaires' : 'ha-do-centrosa')
  if (!['ha-do-centrosa', 'cafe-des-stagiaires'].includes(venue || '') || !session.date || !session.start_time || !(session.duration_minutes > 0)) return null
  const total = order?.total ?? session.ticket_total_price
  if (total == null || !Number.isFinite(total)) return null
  const confirmed = session.status !== 'cancelled' && (order
    ? ['confirmed', 'paid', 'partially_paid', 'completed'].includes(order.order_status)
    : session.ticket_status === 'confirmed')
  if (session.status === 'cancelled' || (order && ['cancelled', 'refunded', 'no_show'].includes(order.order_status))) return null
  return {
    orderNumber: confirmed ? order?.order_number || session.ticket_reference || '' : '',
    booking: {
      date: session.date, time: session.start_time.slice(0, 5), venueKey: venue as BookingForm['venueKey'],
      bookingKind: order?.internal_note?.includes('Event / corporate; reserved minutes:') ? 'event' : 'standard',
      players: session.ticket_player_count || session.max_players, arenaCount: session.arena_count ?? 1,
      guestBooking: !order?.customer_name, customerName: order?.customer_name || '',
      contactName: order?.internal_note?.match(/(?:^|\n)Contact person: ([^\n]+)/)?.[1] || '',
    },
    quote: { subtotal: order?.subtotal ?? total, discountTotal: order?.discount_total ?? 0, total, duration: session.duration_minutes },
  }
}

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
