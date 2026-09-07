'use client'

import { ageBandFromBirthday } from '../../lib/agePolicy'
import { getSupabase } from '../../lib/booking/client'
import { clearPendingTicketAccountBooking, writePendingTicketAccountBooking } from '../../lib/booking/pendingAccountBooking'
import {
  selectedTicketService
} from '../../lib/bookingStaticData'
import {
  Profile,
  TicketBookingConfirmation,
  splitPhoneNumber,
  ticketTypeLabel
} from '../../lib/bookingWidgetDomain'
import { trackTicketBookingCompleted, trackTicketCheckoutStarted } from '../../lib/googleAnalytics'
import { validateGuestTicketContact } from '../../lib/guestTicketBooking'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { buildTicketBookingRequest } from '../../lib/ticketBookingRequest'

export type TicketsActionContext = {
  setProfileCountryCode: React.Dispatch<React.SetStateAction<string>>
  setProfilePhone: React.Dispatch<React.SetStateAction<string>>
  setProfileName: React.Dispatch<React.SetStateAction<string>>
  setPendingGuestTicketClaim: React.Dispatch<React.SetStateAction<{ phone: string; reference: string; name?: string | undefined; date?: string | undefined } | null>>
  pendingGuestTicketClaim: { phone: string; reference: string; name?: string | undefined; date?: string | undefined } | null
  ticketConfirmation: import("../../lib/bookingWidgetDomain").TicketBookingConfirmation | null
  ticketDate: string
  ticketTime: string
  ticketType: import("../../lib/bookingStaticData").TicketType
  ticketPlayers: number
  ticketDuration: number
  ticketSpecialNote: string
  setPendingTicketAuthAction: React.Dispatch<React.SetStateAction<"book-after-login" | "claim-after-auth" | null>>
  goToLogin: () => void
  setLoginPromptOpen: React.Dispatch<React.SetStateAction<boolean>>
  updateAuthMode: (nextMode: "create" | "login") => void
  setActiveView: React.Dispatch<React.SetStateAction<import("../../components/AppSidebar").AppView>>
  setProfileStatus: React.Dispatch<React.SetStateAction<string>>
  bookingTicketsInFlightRef: React.RefObject<boolean>
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  ticketTimeOptions: import("../../lib/booking/availability").BookingTimeOption[]
  ticketDiscountCode: string
  showTicketStatus: (message: string, variant?: "error" | "info") => void
  text: TranslationMap
  validateTicketSelection: (activeProfile?: import("../../lib/bookingWidgetDomain").Profile | null) => boolean
  guestTicketContact: import("../../lib/guestTicketBooking").GuestTicketContact
  looseText: Record<string, string>
  setIsBookingTickets: React.Dispatch<React.SetStateAction<boolean>>
  consumeAppRateLimit: (action: "login_attempt" | "otp_request" | "join_leave" | "booking_attempt" | "admin_destructive" | "password_reset" | "invite_player" | "session_message" | "customer_invite" | "voucher_quote" | "staff_config_write", subject: string, setStatus?: (message: string) => void) => Promise<boolean>
  activeTicketDuration: number
  isSpecialTicketType: boolean
  currentTicketTotalPrice: number
  isHaDoBookingVenue: boolean
  setTicketConfirmation: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TicketBookingConfirmation | null>>
  activeTicketArenaCount: number
  currentTicketUnitPrice: 220000 | 260000 | 290000 | 330000 | 390000 | 190000 | 240000 | 200000 | 250000
  appliedTicketLoyaltyPoints: number
  ticketDiscountQuote: import("../../lib/bookingWidgetDomain").TicketDiscountQuote | null
  currentTicketPricing: { arenaCount: number; durationBlocks: number; chargedPlayersPerBlock: number; chargedPlayerSpots: number; grossPrice: number; discountRate: number; discountAmount: number; totalPrice: number; baseUnitPrice: 220000 | 260000 | 290000 | 330000 | 390000 | 190000 | 240000 | 200000 | 250000; unitPrice: 220000 | 260000 | 290000 | 330000 | 390000 | 190000 | 240000 | 200000 | 250000; requiredSlots: number }
  ticketLoyaltyDiscountAmount: number
  setProfile: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Profile | null>>
  syncProfileEverywhere: (updatedProfile: import("../../lib/bookingWidgetDomain").Profile) => void
  setTicketLoyaltyRedemption: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TicketLoyaltyRedemption | null>>
  ticketLoyaltyRedeemValue: number
  showActionToast: (message: string) => void
  setTicketTime: React.Dispatch<React.SetStateAction<string>>
  setTicketUseLoyaltyPoints: React.Dispatch<React.SetStateAction<boolean>>
  setTicketLoyaltyPointsToRedeem: React.Dispatch<React.SetStateAction<string>>
  setTicketDiscountCode: React.Dispatch<React.SetStateAction<string>>
  setTicketDiscountQuote: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TicketDiscountQuote | null>>
  setTicketDiscountStatus: React.Dispatch<React.SetStateAction<string>>
  notifyMinorBookingCreated: (kind: "ticket" | "session", sessionId: string | null | undefined, sourceProfile: import("../../lib/bookingWidgetDomain").Profile | null) => Promise<void>
  loadSessions: (options?: { focusDate?: string | undefined }) => Promise<void>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingTicketsActions(getContext: () => TicketsActionContext) {
  function prefillProfileFromGuestTicketClaim(claimSource: { phone: string; reference?: string; name?: string; date?: string } | null) {
    const { setProfileCountryCode, setProfilePhone, setProfileName, setPendingGuestTicketClaim } = getContext()

    if (!claimSource?.phone) return

    const phoneParts = splitPhoneNumber(claimSource.phone)
    setProfileCountryCode(phoneParts.countryInput || '+84')
    setProfilePhone(phoneParts.localPhone)
    if (claimSource.name) setProfileName(claimSource.name)
    if (claimSource.reference) {
      setPendingGuestTicketClaim({
        phone: claimSource.phone,
        reference: claimSource.reference,
        name: claimSource.name,
        date: claimSource.date,
      })
    }
  }

  function promptTicketLogin() {
    const {
      pendingGuestTicketClaim,
      ticketConfirmation,
      ticketDate,
      ticketTime,
      ticketType,
      ticketPlayers,
      ticketDuration,
      ticketSpecialNote,
      setPendingTicketAuthAction,
      goToLogin,
    } = getContext()

    const claimSource = pendingGuestTicketClaim || (ticketConfirmation?.guestPhone ? {
      phone: ticketConfirmation.guestPhone,
      reference: ticketConfirmation.reference,
      name: ticketConfirmation.guestName,
      date: ticketConfirmation.date,
    } : null)

    const ticketAuthAction = claimSource?.phone && claimSource.reference
      ? 'claim-after-auth'
      : ticketDate && ticketTime
        ? 'book-after-login'
        : null
    if (ticketAuthAction === 'book-after-login') {
      writePendingTicketAccountBooking({
        authMode: 'login',
        createdAt: Date.now(),
        ticketType,
        date: ticketDate,
        time: ticketTime,
        players: ticketPlayers,
        duration: ticketDuration,
        specialNote: ticketSpecialNote,
      })
    } else {
      clearPendingTicketAccountBooking()
    }
    setPendingTicketAuthAction(ticketAuthAction)
    prefillProfileFromGuestTicketClaim(claimSource)
    goToLogin()
  }

  function promptTicketCreateAccount() {
    const {
      pendingGuestTicketClaim,
      ticketConfirmation,
      ticketDate,
      ticketTime,
      ticketType,
      ticketPlayers,
      ticketDuration,
      ticketSpecialNote,
      setPendingTicketAuthAction,
      setLoginPromptOpen,
      updateAuthMode,
      setActiveView,
      setProfileStatus,
    } = getContext()

    const claimSource = pendingGuestTicketClaim || (ticketConfirmation?.guestPhone ? {
      phone: ticketConfirmation.guestPhone,
      reference: ticketConfirmation.reference,
      name: ticketConfirmation.guestName,
      date: ticketConfirmation.date,
    } : null)

    const ticketAuthAction = claimSource?.phone && claimSource.reference
      ? 'claim-after-auth'
      : ticketDate && ticketTime
        ? 'book-after-login'
        : null
    if (ticketAuthAction === 'book-after-login') {
      writePendingTicketAccountBooking({
        authMode: 'create',
        createdAt: Date.now(),
        ticketType,
        date: ticketDate,
        time: ticketTime,
        players: ticketPlayers,
        duration: ticketDuration,
        specialNote: ticketSpecialNote,
      })
    } else {
      clearPendingTicketAccountBooking()
    }
    setPendingTicketAuthAction(ticketAuthAction)
    prefillProfileFromGuestTicketClaim(claimSource)
    setLoginPromptOpen(false)
    updateAuthMode('create')
    setActiveView('profile')
    setProfileStatus('')
  }

  async function bookTickets(profileOverride?: Profile | null) {
    const {
      bookingTicketsInFlightRef,
      profile,
      ticketType,
      ticketTimeOptions,
      ticketTime,
      ticketDiscountCode,
      showTicketStatus,
      text,
      validateTicketSelection,
      guestTicketContact,
      looseText,
      setIsBookingTickets,
      consumeAppRateLimit,
      ticketDate,
      ticketPlayers,
      activeTicketDuration,
      isSpecialTicketType,
      currentTicketTotalPrice,
      isHaDoBookingVenue,
      setTicketConfirmation,
      activeTicketArenaCount,
      currentTicketUnitPrice,
      ticketSpecialNote,
      appliedTicketLoyaltyPoints,
      ticketDiscountQuote,
      currentTicketPricing,
      ticketLoyaltyDiscountAmount,
      setPendingGuestTicketClaim,
      setProfile,
      syncProfileEverywhere,
      setTicketLoyaltyRedemption,
      ticketLoyaltyRedeemValue,
      showActionToast,
      setTicketTime,
      setTicketUseLoyaltyPoints,
      setTicketLoyaltyPointsToRedeem,
      setTicketDiscountCode,
      setTicketDiscountQuote,
      setTicketDiscountStatus,
      notifyMinorBookingCreated,
      loadSessions,
    } = getContext()

    if (bookingTicketsInFlightRef.current) return false

    const activeProfile = profileOverride === undefined ? profile : profileOverride

    const service = selectedTicketService(ticketType)
    const selectedTimeOption = ticketTimeOptions.find((option) => option.value === ticketTime)
    const normalizedTicketDiscountCode = ticketDiscountCode.trim().toUpperCase()

    if (activeProfile && ageBandFromBirthday(activeProfile.birthday) === 'under13') {
      showTicketStatus(text.under13BookingBlocked, 'error')
      return false
    }

    if (!validateTicketSelection(activeProfile) || !selectedTimeOption) return false

    const guestContactValidation = activeProfile
      ? { normalizedPhone: '', error: '' }
      : validateGuestTicketContact(guestTicketContact, looseText)

    if (guestContactValidation.error) {
      showTicketStatus(guestContactValidation.error, 'error')
      return false
    }

    // Lock synchronously before the first server check, including same-tick clicks.
    bookingTicketsInFlightRef.current = true
    setIsBookingTickets(true)
    try {
      const allowed = await consumeAppRateLimit('booking_attempt', `${ticketType}:${ticketDate}:${ticketTime}`, (message) => showTicketStatus(message, 'error'))
      if (!allowed) return false

      const ticketAnalytics = {
        ticketType,
        ticketLabel: ticketTypeLabel(ticketType, looseText),
        date: ticketDate,
        time: ticketTime,
        players: ticketPlayers,
        durationMinutes: activeTicketDuration,
        totalPrice: isSpecialTicketType ? 0 : currentTicketTotalPrice,
      }
      trackTicketCheckoutStarted(ticketAnalytics)

      showTicketStatus(isHaDoBookingVenue ? text.bookingTickets : text.submittingBookingRequest)
      setTicketConfirmation(null)

      const request = buildTicketBookingRequest({
        isHaDo: isHaDoBookingVenue,
        authenticated: Boolean(activeProfile),
        ticketType,
        date: ticketDate,
        time: ticketTime,
        durationMinutes: activeTicketDuration,
        players: ticketPlayers,
        arenaCount: activeTicketArenaCount,
        defaultGame: service.defaultGame,
        unitPrice: currentTicketUnitPrice,
        totalPrice: currentTicketTotalPrice,
        special: isSpecialTicketType,
        note: ticketSpecialNote,
        loyaltyPoints: appliedTicketLoyaltyPoints,
        discountCode: ticketDiscountQuote ? normalizedTicketDiscountCode : null,
        guestName: guestTicketContact.name,
        guestPhone: guestContactValidation.normalizedPhone,
      })
      const client = await getSupabase()
      const { data, error } = await client.rpc(request.name, request.args)

      if (error) {
        showTicketStatus(error.message || text.ticketBookingError, 'error')
        return false
      }

      const booking = (data || {}) as {
        discount_amount?: number | null
        discount_code?: string | null
        loyalty_points_total?: number | null
        session_id?: string
        ticket_reference?: string
        ticket_total_price?: number | null
      }
      const confirmation: TicketBookingConfirmation = {
        sessionId: booking.session_id || '',
        reference: booking.ticket_reference || '',
        ticketType,
        ticketLabel: ticketTypeLabel(ticketType, looseText),
        date: ticketDate,
        time: ticketTime,
        players: ticketPlayers,
        totalPrice: isSpecialTicketType
          ? 0
          : isHaDoBookingVenue
            ? currentTicketTotalPrice
            : Math.max(0, Math.floor(Number(booking.ticket_total_price ?? currentTicketPricing.totalPrice) || 0)),
        guestPhone: activeProfile ? undefined : guestContactValidation.normalizedPhone,
        guestName: activeProfile ? undefined : guestTicketContact.name.trim() || undefined,
        discountCode: activeProfile && !isSpecialTicketType ? booking.discount_code || undefined : undefined,
        discountAmount: activeProfile && !isSpecialTicketType ? Math.max(0, Math.floor(Number(booking.discount_amount ?? 0) || 0)) : 0,
        loyaltyPointsRedeemed: activeProfile && !isSpecialTicketType ? appliedTicketLoyaltyPoints : 0,
        loyaltyDiscountAmount: activeProfile && !isSpecialTicketType ? ticketLoyaltyDiscountAmount : 0,
        requiresZaloConfirmation: !isHaDoBookingVenue,
      }

      if (!activeProfile && confirmation.guestPhone && confirmation.reference) {
        setPendingGuestTicketClaim({
          phone: confirmation.guestPhone,
          reference: confirmation.reference,
          name: confirmation.guestName,
          date: confirmation.date,
        })
      }

      if (isHaDoBookingVenue && activeProfile && booking.loyalty_points_total !== undefined && booking.loyalty_points_total !== null) {
        const nextPointsTotal = Math.max(0, Math.floor(Number(booking.loyalty_points_total) || 0))
        const nextProfile = { ...activeProfile, loyalty_points_total: nextPointsTotal }
        setProfile(nextProfile)
        syncProfileEverywhere(nextProfile)
        setTicketLoyaltyRedemption((current) => current
          ? { ...current, loyalty_points_total: nextPointsTotal }
          : { loyalty_points_total: nextPointsTotal, redeem_value_vnd_per_point: ticketLoyaltyRedeemValue })
      }

      setTicketConfirmation(confirmation)
      trackTicketBookingCompleted({
        ...ticketAnalytics,
        transactionId: confirmation.reference || confirmation.sessionId,
      })
      const bookingCreatedMessage = isHaDoBookingVenue ? text.ticketBookingCreated : text.bookingRequestSubmitted
      showTicketStatus(bookingCreatedMessage)
      showActionToast(bookingCreatedMessage)
      setTicketTime('')
      setTicketUseLoyaltyPoints(false)
      setTicketLoyaltyPointsToRedeem('')
      setTicketDiscountCode('')
      setTicketDiscountQuote(null)
      setTicketDiscountStatus('')
      await notifyMinorBookingCreated('ticket', confirmation.sessionId, activeProfile)
      await loadSessions({ focusDate: ticketDate })
      return true
    } catch (error) {
      showTicketStatus(error instanceof Error ? error.message : text.ticketBookingError, 'error')
      return false
    } finally {
      bookingTicketsInFlightRef.current = false
      setIsBookingTickets(false)
    }
  }

  return { prefillProfileFromGuestTicketClaim, promptTicketLogin, promptTicketCreateAccount, bookTickets }
}
