import type { TicketType } from '../bookingStaticData'

const PENDING_TICKET_ACCOUNT_BOOKING_STORAGE_KEY = 'vrena.ticket.pending-account-booking.v1'
const PENDING_TICKET_ACCOUNT_BOOKING_MAX_AGE_MS = 30 * 60 * 1000

export type PendingTicketAccountBooking = {
  authMode: 'login' | 'create'
  createdAt: number
  ticketType: TicketType
  date: string
  time: string
  players: number
  duration: number
  specialNote: string
}

export function readPendingTicketAccountBooking(): PendingTicketAccountBooking | null {
  if (typeof window === 'undefined') return null

  try {
    const storedValue = window.sessionStorage.getItem(PENDING_TICKET_ACCOUNT_BOOKING_STORAGE_KEY)
    if (!storedValue) return null

    const candidate = JSON.parse(storedValue) as Partial<PendingTicketAccountBooking>
    const isTicketType = candidate.ticketType === 'individual' || candidate.ticketType === 'birthday' || candidate.ticketType === 'corporate'
    const isValid = (candidate.authMode === 'login' || candidate.authMode === 'create')
      && isTicketType
      && typeof candidate.createdAt === 'number'
      && Date.now() - candidate.createdAt <= PENDING_TICKET_ACCOUNT_BOOKING_MAX_AGE_MS
      && typeof candidate.date === 'string'
      && typeof candidate.time === 'string'
      && typeof candidate.players === 'number'
      && Number.isInteger(candidate.players)
      && candidate.players > 0
      && typeof candidate.duration === 'number'
      && Number.isInteger(candidate.duration)
      && candidate.duration > 0
      && typeof candidate.specialNote === 'string'

    if (!isValid) {
      window.sessionStorage.removeItem(PENDING_TICKET_ACCOUNT_BOOKING_STORAGE_KEY)
      return null
    }

    return candidate as PendingTicketAccountBooking
  } catch {
    return null
  }
}

export function writePendingTicketAccountBooking(booking: PendingTicketAccountBooking) {
  try {
    window.sessionStorage.setItem(PENDING_TICKET_ACCOUNT_BOOKING_STORAGE_KEY, JSON.stringify(booking))
  } catch {
    // The current in-memory handoff still works when browser storage is unavailable.
  }
}

export function clearPendingTicketAccountBooking() {
  try {
    window.sessionStorage.removeItem(PENDING_TICKET_ACCOUNT_BOOKING_STORAGE_KEY)
  } catch {
    // Nothing else is needed when browser storage is unavailable.
  }
}
