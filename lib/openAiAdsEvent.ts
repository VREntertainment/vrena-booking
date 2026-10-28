// Public constants shared by browser and server; never put credentials here.
export const OPENAI_ADS_PIXEL_ID = 'Y2uNue1R9VNaKHAjR1K9Ev'
export type BookingVenue = 'ha_do_centrosa' | 'thao_dien'

export function openAiBookingEventId(bookingId: string, venue: BookingVenue) {
  return `booking:${venue}:${bookingId}`
}

export function confirmedTicketBooking(value: unknown): value is { session_id: string; ticket_reference: string; ticket_status: 'confirmed' } {
  if (!value || typeof value !== 'object') return false
  const booking = value as Record<string, unknown>
  return booking.ticket_status === 'confirmed'
    && typeof booking.session_id === 'string' && Boolean(booking.session_id.trim())
    && typeof booking.ticket_reference === 'string' && Boolean(booking.ticket_reference.trim())
}
