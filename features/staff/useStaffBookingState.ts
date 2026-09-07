'use client'

import { useRef, useState } from 'react'
import { defaultBookingForm } from '../../lib/staff/forms'
import type {
  BookingForm
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffBookingState({ initialBooking }: { initialBooking: Pick<import("../../lib/staff/types").BookingForm, "date" | "time" | "venueKey"> | undefined }) {
  const [booking, setBooking] = useState<BookingForm>(() => ({ ...defaultBookingForm(), ...initialBooking, arenaId: initialBooking?.venueKey === 'cafe-des-stagiaires' ? 'cafe:arena-1' : 'arena-1' }))
  const [customerNameFocused, setCustomerNameFocused] = useState(false)
  const [customerSuggestionIndex, setCustomerSuggestionIndex] = useState(-1)
  const bookingSubmitRef = useRef(false)
  return { booking, setBooking, customerNameFocused, setCustomerNameFocused, customerSuggestionIndex, setCustomerSuggestionIndex, bookingSubmitRef }
}
