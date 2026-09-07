'use client'

import {
  useRef,
  useState
} from 'react'
import {
  type TicketType
} from '../../lib/bookingStaticData'
import {
  TicketBookingConfirmation,
  localDateString
} from '../../lib/bookingWidgetDomain'
import { type GuestTicketContact } from '../../lib/guestTicketBooking'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingTicketsState({ incomingCalendar, initialView }: { incomingCalendar: import("../../lib/bookingCalendar").CalendarNavigation | null | undefined; initialView: import("../../components/AppSidebar").AppView }) {
  const [calendarTicketDraft, setCalendarTicketDraft] = useState(incomingCalendar?.mode === 'client-ticket' && initialView === 'tickets')
  const [ticketType, setTicketType] = useState<TicketType>('individual')
  const [ticketDate, setTicketDate] = useState(incomingCalendar?.mode === 'client-ticket' ? incomingCalendar.date : localDateString())
  const [ticketTime, setTicketTime] = useState(incomingCalendar?.mode === 'client-ticket' ? incomingCalendar.time : '')
  const [ticketPlayers, setTicketPlayers] = useState(1)
  const [ticketArenaCount, setTicketArenaCount] = useState(1)
  const [ticketDuration, setTicketDuration] = useState(20)
  const [ticketSpecialNote, setTicketSpecialNote] = useState('')
  const [guestTicketContact, setGuestTicketContact] = useState<GuestTicketContact>({ name: '', phone: '' })
  const [pendingGuestTicketClaim, setPendingGuestTicketClaim] = useState<{ phone: string; reference: string; name?: string; date?: string } | null>(null)
  const [pendingTicketAuthAction, setPendingTicketAuthAction] = useState<'book-after-login' | 'claim-after-auth' | null>(null)
  const pendingTicketAuthCompletingRef = useRef(false)
  const [ticketStatus, setTicketStatus] = useState('')
  const [ticketStatusVariant, setTicketStatusVariant] = useState<'info' | 'error'>('info')
  const [isBookingTickets, setIsBookingTickets] = useState(false)
  const bookingTicketsInFlightRef = useRef(false)
  const [ticketConfirmation, setTicketConfirmation] = useState<TicketBookingConfirmation | null>(null)
  const [ticketAvailabilitySearchTick, setTicketAvailabilitySearchTick] = useState(0)
  const ticketAvailabilitySearchLoadingRef = useRef(false)
  return {
    calendarTicketDraft,
    setCalendarTicketDraft,
    ticketType,
    setTicketType,
    ticketDate,
    setTicketDate,
    ticketTime,
    setTicketTime,
    ticketPlayers,
    setTicketPlayers,
    ticketArenaCount,
    setTicketArenaCount,
    ticketDuration,
    setTicketDuration,
    ticketSpecialNote,
    setTicketSpecialNote,
    guestTicketContact,
    setGuestTicketContact,
    pendingGuestTicketClaim,
    setPendingGuestTicketClaim,
    pendingTicketAuthAction,
    setPendingTicketAuthAction,
    pendingTicketAuthCompletingRef,
    ticketStatus,
    setTicketStatus,
    ticketStatusVariant,
    setTicketStatusVariant,
    isBookingTickets,
    setIsBookingTickets,
    bookingTicketsInFlightRef,
    ticketConfirmation,
    setTicketConfirmation,
    ticketAvailabilitySearchTick,
    setTicketAvailabilitySearchTick,
    ticketAvailabilitySearchLoadingRef,
  }
}
