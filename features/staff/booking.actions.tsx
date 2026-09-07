'use client'

import { validStaffBookingTime } from '../../lib/staff/bookingHours'
import type { staffBookingCopy } from '../../lib/staff/bookingCopy'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  formatVnd
} from '../../lib/staff/formatting'
import { defaultBookingForm } from '../../lib/staff/forms'
import { newPaymentSplit, normalizePaymentSplits } from '../../lib/staff/payments'
import {
  calculateManualDiscount,
  validBookingTotalOverride
} from '../../lib/staff/pricing'
import {
  customerName
} from '../../lib/staff/profiles'
import type {
  PaymentSplitDraft
} from '../../lib/staff/types'
import { supabase } from '../../lib/supabase/client'

export type BookingActionContext = {
  profiles: import("../../lib/staff/types").StaffProfile[]
  setBooking: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").BookingForm>>
  text: StaffConsoleCopy
  setCustomerNameFocused: React.Dispatch<React.SetStateAction<boolean>>
  profileById: Map<string, import("../../lib/staff/types").StaffProfile>
  setCustomerSuggestionIndex: React.Dispatch<React.SetStateAction<number>>
  canCreateOrders: boolean
  selectedGame: import("../../lib/staff/types").StaffGame
  bookingSubmitRef: React.RefObject<boolean>
  booking: import("../../lib/staff/types").BookingForm
  setStatus: React.Dispatch<React.SetStateAction<string>>
  bookingText: (typeof staffBookingCopy)['en' | 'vi']
  selectedDiscount: import("../../lib/staff/types").StaffDiscount | null
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  consumeStaffRateLimit: (action: "login_attempt" | "otp_request" | "join_leave" | "booking_attempt" | "admin_destructive" | "password_reset" | "invite_player" | "session_message" | "customer_invite" | "voucher_quote" | "staff_config_write", subject: string) => Promise<boolean>
  quote: { unitPrice: number; subtotal: number; discountTotal: number; discountLabel: string; total: number; ruleName: string; duration: number }
  selectedBookingArena: string
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  onBookingCreated: ((dateValue: string, venueKey: "ha-do-centrosa" | "cafe-des-stagiaires") => void) | undefined
  loadProfiles: (force?: boolean) => Promise<void>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffBookingActions(getContext: () => BookingActionContext) {
  function applyCustomer(profileId: string) {
    const { profiles, setBooking, text } = getContext()

    const selected = profiles.find((item) => item.id === profileId)
    setBooking((current) => ({
      ...current,
      guestBooking: false,
      customerId: profileId,
      customerName: selected ? customerName(selected, text) : current.customerName,
      customerPhone: selected?.phone || '',
      customerEmail: selected?.email || '',
    }))
  }

  function setGuestBooking(enabled: boolean) {
    const { setCustomerNameFocused, setBooking } = getContext()

    setCustomerNameFocused(false)
    setBooking((current) => ({
      ...current,
      guestBooking: enabled,
      ...(enabled ? {
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
      } : {}),
    }))
  }

  function handleCustomerNameChange(value: string) {
    const { setBooking, profileById, text, setCustomerNameFocused, setCustomerSuggestionIndex } = getContext()

    setBooking((current) => ({
      ...current,
      customerId: (() => {
        const selected = current.customerId ? profileById.get(current.customerId) : null
        return selected && customerName(selected, text) === value ? current.customerId : ''
      })(),
      customerName: value,
      ...(current.customerId ? { customerPhone: '', customerEmail: '' } : {}),
    }))
    setCustomerNameFocused(true)
    setCustomerSuggestionIndex(-1)
  }

  function selectCustomerSuggestion(profileId: string) {
    const { setCustomerNameFocused } = getContext()

    applyCustomer(profileId)
    setCustomerNameFocused(false)
  }

  async function createOrder() {
    const {
      canCreateOrders,
      selectedGame,
      bookingSubmitRef,
      booking,
      setStatus,
      text,
      bookingText,
      selectedDiscount,
      setSaving,
      consumeStaffRateLimit,
      quote,
      selectedBookingArena,
      setBooking,
      markStaffDataStale,
      onBookingCreated,
      loadProfiles,
    } = getContext()

    if (!canCreateOrders || !selectedGame || bookingSubmitRef.current) return
    if (!booking.guestBooking && !booking.customerName.trim()) {
      setStatus(text.messages.customerAccountNameRequired)
      return
    }
    if (!Number.isInteger(booking.players) || booking.players < 1 || booking.players > 16 || !booking.date || !booking.time) {
      setStatus(bookingText.invalidBooking)
      return
    }
    if (!validStaffBookingTime(booking.venueKey, quote.duration, booking.time)) {
      setStatus(bookingText.outsideHours)
      return
    }
    if (booking.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.customerEmail)) {
      setStatus(bookingText.invalidEmail)
      return
    }
    if (booking.discountId && !selectedDiscount) {
      setStatus(bookingText.discountChanged)
      return
    }
    if (!validBookingTotalOverride(booking)) {
      setStatus(bookingText.invalidOverride)
      return
    }
    bookingSubmitRef.current = true
    setSaving(true)
    try {
      const allowed = await consumeStaffRateLimit('booking_attempt', `${booking.date}:${booking.time}:${selectedGame.id}`)
      if (!allowed) return
      setStatus(text.messages.orderCreating)
      const guestCustomer = booking.guestBooking
      const hasManualDiscount = calculateManualDiscount(booking.manualDiscountType, booking.manualDiscountValue, quote.subtotal) > 0
      const paymentSplits = normalizePaymentSplits(booking.paymentSplits)
      const { data, error } = await supabase.rpc('staff_create_booking', {
        p_booking_source: booking.bookingSource,
        p_booking: {
          p_total_override: booking.overrideTotalEnabled ? Number(booking.overrideTotal) : null,
          p_override_reason: booking.overrideTotalEnabled ? booking.overrideReason.trim() : null,
          p_customer_id: guestCustomer ? null : booking.customerId || null,
          p_customer_name: guestCustomer ? null : booking.customerName || null,
          p_customer_phone: guestCustomer ? null : booking.customerPhone || null,
          p_customer_email: guestCustomer ? null : booking.customerEmail || null,
          p_game_id: selectedGame.id,
          p_booking_date: booking.date,
          p_booking_time: `${booking.time}:00`,
          p_players_count: booking.players,
          p_arena_id: selectedBookingArena || null,
          p_discount_rule_id: hasManualDiscount ? null : selectedDiscount?.id || null,
          p_manual_discount_type: hasManualDiscount ? booking.manualDiscountType : null,
          p_manual_discount_value: hasManualDiscount ? booking.manualDiscountValue : 0,
          p_payment_splits: paymentSplits,
          p_order_status: booking.orderStatus,
          p_invoice_required: booking.invoiceRequired,
          p_company_name: booking.companyName || null,
          p_tax_code: booking.taxCode || null,
          p_invoice_email: booking.invoiceEmail || null,
          p_invoice_address: booking.invoiceAddress || null,
          p_internal_note: booking.note || null,
        },
      })

      if (error) {
        setStatus(error.message)
        setSaving(false)
        return
      }

      const order = data as { order_number?: string; total?: number } | null
      setStatus(text.messages.orderConfirmed
        .replace('{order}', order?.order_number || '')
        .replace('{total}', formatVnd(order?.total ?? quote.total)))
      setBooking(defaultBookingForm())
      markStaffDataStale('today', 'todaySessions', 'orders', 'report', 'profiles')
      onBookingCreated?.(booking.date, booking.venueKey)
      void loadProfiles(true)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      bookingSubmitRef.current = false
      setSaving(false)
    }
  }

  function updateBookingPaymentSplit(splitId: string, patch: Partial<PaymentSplitDraft>) {
    const { setBooking } = getContext()

    setBooking((current) => ({
      ...current,
      paymentSplits: current.paymentSplits.map((split) => (
        split.id === splitId ? { ...split, ...patch } : split
      )),
    }))
  }

  function addBookingPaymentSplit() {
    const { setBooking } = getContext()

    setBooking((current) => ({
      ...current,
      paymentSplits: [...current.paymentSplits, newPaymentSplit('cash')],
    }))
  }

  function removeBookingPaymentSplit(splitId: string) {
    const { setBooking } = getContext()

    setBooking((current) => ({
      ...current,
      paymentSplits: current.paymentSplits.length > 1
        ? current.paymentSplits.filter((split) => split.id !== splitId)
        : [newPaymentSplit('cash')],
    }))
  }

  return {
    applyCustomer,
    setGuestBooking,
    handleCustomerNameChange,
    selectCustomerSuggestion,
    createOrder,
    updateBookingPaymentSplit,
    addBookingPaymentSplit,
    removeBookingPaymentSplit,
  }
}
