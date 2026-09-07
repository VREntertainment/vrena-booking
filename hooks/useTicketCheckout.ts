'use client'

import { calculateTicketCheckout } from '../lib/booking/checkout'

import { useEffect, useState } from 'react'
import type { AppView } from '../components/AppSidebar'
import type { BookingVenueId } from '../components/BookingVenueSelector'
import { getSupabase } from '../lib/booking/client'
import { selectedTicketService, type TicketType } from '../lib/bookingStaticData'
import {
  formatVnd,
  schedulePostEffectStateUpdate,
  ticketPricingSummary,
  type Profile,
  type TicketDiscountQuote,
  type TicketLoyaltyEarnQuote,
  type TicketLoyaltyRedemption,
} from '../lib/bookingWidgetDomain'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

type TicketCheckoutInput = {
  ticketType: TicketType
  ticketDate: string
  ticketTime: string
  ticketPlayers: number
  activeTicketDuration: number
  activeTicketArenaCount: number
  bookingVenue: BookingVenueId
  isHaDoBookingVenue: boolean
  activeView: AppView
  profile: Profile | null
  text: TranslationMap
}

/** Owns voucher and loyalty requests, stale-response cancellation, and checkout amounts. */
export function useTicketCheckout({ ticketType, ticketDate, ticketTime, ticketPlayers, activeTicketDuration, activeTicketArenaCount, bookingVenue, isHaDoBookingVenue, activeView, profile, text }: TicketCheckoutInput) {
  const [ticketUseLoyaltyPoints, setTicketUseLoyaltyPoints] = useState(false)
  const [ticketLoyaltyPointsToRedeem, setTicketLoyaltyPointsToRedeem] = useState('')
  const [ticketLoyaltyRedemption, setTicketLoyaltyRedemption] = useState<TicketLoyaltyRedemption | null>(null)
  const [ticketLoyaltyEarnQuote, setTicketLoyaltyEarnQuote] = useState<TicketLoyaltyEarnQuote | null>(null)
  const [isLoadingTicketLoyalty, setIsLoadingTicketLoyalty] = useState(false)
  const [ticketDiscountCode, setTicketDiscountCode] = useState('')
  const [ticketDiscountQuote, setTicketDiscountQuote] = useState<TicketDiscountQuote | null>(null)
  const [ticketAutomaticDiscountQuote, setTicketAutomaticDiscountQuote] = useState<TicketDiscountQuote | null>(null)
  const [ticketDiscountStatus, setTicketDiscountStatus] = useState('')
  const [isCheckingTicketDiscount, setIsCheckingTicketDiscount] = useState(false)
  const activeTicketService = selectedTicketService(ticketType)
  const currentTicketPricing = ticketPricingSummary(ticketType, ticketDate, ticketTime, ticketPlayers, activeTicketDuration, activeTicketArenaCount, bookingVenue)
  const currentTicketUnitPrice = currentTicketPricing.unitPrice
  const {
    isSpecialTicketType,
    ticketAutomaticDiscountAmount,
    activeTicketDiscountAmount,
    activeTicketDiscountSource,
    ticketLoyaltyBalance,
    ticketLoyaltyRedeemValue,
    maxTicketLoyaltyPoints,
    appliedTicketLoyaltyPoints,
    ticketLoyaltyDiscountAmount,
    currentTicketTotalPrice,
    estimatedTicketLoyaltyPointsEarned,
    estimatedTicketLoyaltyReductionValue
  } = calculateTicketCheckout({ ticketType, isHaDoBookingVenue, currentTicketPricing, ticketDiscountQuote, ticketAutomaticDiscountQuote, ticketLoyaltyRedemption, profile, ticketUseLoyaltyPoints, ticketLoyaltyPointsToRedeem, ticketLoyaltyEarnQuote })

  const ticketDiscountCodeInvalidText = text.ticketDiscountCodeInvalid
  const ticketDiscountCodeAppliedText = text.ticketDiscountCodeApplied
  const ticketDiscountBestReductionText = text.ticketDiscountBestReductionMessage
  const ticketDiscountCodeCheckingText = text.ticketDiscountCodeChecking

  useEffect(() => {
    if (!isHaDoBookingVenue || isSpecialTicketType || !ticketDate || currentTicketPricing.grossPrice <= 0) {
      return schedulePostEffectStateUpdate(() => setTicketAutomaticDiscountQuote(null))
    }

    let active = true
    void getSupabase()
      .then((client) => client.rpc('ticket_automatic_discount_quote', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
        p_player_count: ticketPlayers,
        p_start_time: ticketTime ? `${ticketTime}:00` : null,
        p_subtotal: currentTicketPricing.grossPrice,
        p_ticket_type: ticketType,
        p_unit_price: currentTicketUnitPrice,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketAutomaticDiscountQuote(null)
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        const discountAmount = Math.max(0, Math.floor(Number(row?.discount_amount ?? 0) || 0))
        setTicketAutomaticDiscountQuote(row && discountAmount > 0
          ? {
            discount_rule_id: String(row.discount_rule_id || ''),
            discount_name: String(row.discount_name || ''),
            discount_amount: discountAmount,
          }
          : null)
      })
      .catch(() => {
        if (active) setTicketAutomaticDiscountQuote(null)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, currentTicketPricing.grossPrice, currentTicketUnitPrice, isHaDoBookingVenue, isSpecialTicketType, ticketDate, ticketPlayers, ticketTime, ticketType])

  useEffect(() => {
    const normalizedCode = ticketDiscountCode.trim().toUpperCase()

    if (!isHaDoBookingVenue || isSpecialTicketType || !normalizedCode) {
      return schedulePostEffectStateUpdate(() => {
        setTicketDiscountQuote(null)
        if (!isHaDoBookingVenue || isSpecialTicketType) setTicketDiscountCode('')
        setTicketDiscountStatus('')
        setIsCheckingTicketDiscount(false)
      })
    }

    let active = true
    const timeoutId = window.setTimeout(() => {
      setIsCheckingTicketDiscount(true)
      void getSupabase()
        .then((client) => client.rpc('ticket_discount_code_quote', {
          p_code: normalizedCode,
          p_booking_date: ticketDate,
          p_game_id: activeTicketService.defaultGame,
          p_player_count: ticketPlayers,
          p_start_time: ticketTime ? `${ticketTime}:00` : null,
          p_subtotal: currentTicketPricing.grossPrice,
          p_ticket_type: ticketType,
          p_unit_price: currentTicketUnitPrice,
        }))
        .then(({ data, error }) => {
          if (!active) return
          if (error) {
            setTicketDiscountQuote(null)
            setTicketDiscountStatus(error.message || ticketDiscountCodeInvalidText)
            return
          }

          const row = Array.isArray(data) ? data[0] : null
          const discountAmount = Math.max(0, Math.floor(Number(row?.discount_amount ?? 0) || 0))
          if (!row || discountAmount <= 0) {
            setTicketDiscountQuote(null)
            setTicketDiscountStatus(ticketDiscountCodeInvalidText)
            return
          }

          setTicketDiscountQuote({
            discount_code: String(row.discount_code || normalizedCode),
            discount_name: String(row.discount_name || ''),
            discount_amount: discountAmount,
          })
          setTicketDiscountStatus(ticketAutomaticDiscountAmount > 0 && discountAmount <= ticketAutomaticDiscountAmount
            ? ticketDiscountBestReductionText
            : ticketDiscountCodeAppliedText.replace('{amount}', formatVnd(discountAmount)))
        })
        .catch(() => {
          if (!active) return
          setTicketDiscountQuote(null)
          setTicketDiscountStatus(ticketDiscountCodeInvalidText)
        })
        .finally(() => {
          if (active) setIsCheckingTicketDiscount(false)
        })
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [activeTicketService.defaultGame, currentTicketPricing.grossPrice, currentTicketUnitPrice, isHaDoBookingVenue, isSpecialTicketType, ticketAutomaticDiscountAmount, ticketDate, ticketDiscountBestReductionText, ticketDiscountCode, ticketDiscountCodeAppliedText, ticketDiscountCodeInvalidText, ticketPlayers, ticketTime, ticketType])

  useEffect(() => {
    if (!ticketUseLoyaltyPoints) return
    if (maxTicketLoyaltyPoints <= 0) {
      return schedulePostEffectStateUpdate(() => {
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
      })
    }

    const requestedPoints = Math.max(0, Math.floor(Number(ticketLoyaltyPointsToRedeem) || 0))
    if (requestedPoints > maxTicketLoyaltyPoints) {
      return schedulePostEffectStateUpdate(() => {
        setTicketLoyaltyPointsToRedeem(String(maxTicketLoyaltyPoints))
      })
    }

    return undefined
  }, [maxTicketLoyaltyPoints, ticketLoyaltyPointsToRedeem, ticketUseLoyaltyPoints])


useEffect(() => {
    let active = true

    if (!profile || activeView !== 'tickets' || isSpecialTicketType) {
      return schedulePostEffectStateUpdate(() => {
        setTicketLoyaltyRedemption(null)
        setTicketLoyaltyEarnQuote(null)
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
        setIsLoadingTicketLoyalty(false)
      })
    }

    schedulePostEffectStateUpdate(() => setIsLoadingTicketLoyalty(true))
    void getSupabase()
      .then((client) => client.rpc('ticket_loyalty_redemption_settings', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketLoyaltyRedemption(null)
          setTicketUseLoyaltyPoints(false)
          setTicketLoyaltyPointsToRedeem('')
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        const pointsTotal = Math.max(0, Math.floor(Number(row?.loyalty_points_total ?? profile.loyalty_points_total ?? 0) || 0))
        const redeemValue = Math.max(0, Math.floor(Number(row?.redeem_value_vnd_per_point ?? 0) || 0))
        setTicketLoyaltyRedemption({
          loyalty_points_total: pointsTotal,
          redeem_value_vnd_per_point: redeemValue,
        })
      })
      .catch(() => {
        if (!active) return
        setTicketLoyaltyRedemption(null)
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
      })
      .finally(() => {
        if (active) setIsLoadingTicketLoyalty(false)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, activeView, isSpecialTicketType, profile, ticketDate])

useEffect(() => {
    let active = true

    if (activeView !== 'tickets' || isSpecialTicketType) {
      return schedulePostEffectStateUpdate(() => setTicketLoyaltyEarnQuote(null))
    }

    void getSupabase()
      .then((client) => client.rpc('ticket_loyalty_earn_quote', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
        p_paid_total: currentTicketTotalPrice,
        p_player_count: ticketPlayers,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketLoyaltyEarnQuote(null)
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        setTicketLoyaltyEarnQuote({
          estimated_points: Math.max(0, Math.floor(Number(row?.estimated_points ?? 0) || 0)),
          estimated_reduction_vnd: Math.max(0, Math.floor(Number(row?.estimated_reduction_vnd ?? 0) || 0)),
          redeem_value_vnd_per_point: Math.max(0, Math.floor(Number(row?.redeem_value_vnd_per_point ?? 0) || 0)),
        })
      })
      .catch(() => {
        if (active) setTicketLoyaltyEarnQuote(null)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, activeView, currentTicketTotalPrice, isSpecialTicketType, ticketDate, ticketPlayers])

  return {
    ticketUseLoyaltyPoints,
    ticketLoyaltyPointsToRedeem,
    isLoadingTicketLoyalty,
    ticketDiscountCode,
    ticketDiscountQuote,
    ticketDiscountStatus,
    isCheckingTicketDiscount,
    setTicketUseLoyaltyPoints,
    setTicketLoyaltyPointsToRedeem,
    setTicketLoyaltyRedemption,
    setTicketDiscountCode,
    setTicketDiscountQuote,
    setTicketAutomaticDiscountQuote,
    setTicketDiscountStatus,
    currentTicketPricing,
    currentTicketUnitPrice,
    isSpecialTicketType,
    activeTicketDiscountAmount,
    activeTicketDiscountSource,
    ticketLoyaltyBalance,
    ticketLoyaltyRedeemValue,
    maxTicketLoyaltyPoints,
    appliedTicketLoyaltyPoints,
    ticketLoyaltyDiscountAmount,
    currentTicketTotalPrice,
    estimatedTicketLoyaltyPointsEarned,
    estimatedTicketLoyaltyReductionValue,
    ticketDiscountCodeInvalidText,
    ticketDiscountCodeCheckingText,
  }
}
