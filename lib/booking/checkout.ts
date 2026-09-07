import type { TicketType } from '../bookingStaticData'
import type { Profile, TicketDiscountQuote, TicketLoyaltyEarnQuote, TicketLoyaltyRedemption } from '../bookingWidgetDomain'

export function clampTicketLoyaltyRedemption(points: number, balance: number, redeemValue: number, subtotal: number) {
  if (!Number.isFinite(points) || !Number.isFinite(balance) || !Number.isFinite(redeemValue) || !Number.isFinite(subtotal)) return 0
  if (redeemValue <= 0 || subtotal <= 0) return 0
  const maxByBalance = Math.max(0, Math.floor(balance))
  const maxByPrice = Math.floor(Math.max(0, subtotal) / redeemValue)
  return Math.max(0, Math.min(Math.floor(points), maxByBalance, maxByPrice))
}

export type TicketCheckoutAmountsInput = {
  ticketType: TicketType
  isHaDoBookingVenue: boolean
  currentTicketPricing: { grossPrice: number; discountAmount: number }
  ticketDiscountQuote: TicketDiscountQuote | null
  ticketAutomaticDiscountQuote: TicketDiscountQuote | null
  ticketLoyaltyRedemption: TicketLoyaltyRedemption | null
  profile: Pick<Profile, 'loyalty_points_total'> | null
  ticketUseLoyaltyPoints: boolean
  ticketLoyaltyPointsToRedeem: string
  ticketLoyaltyEarnQuote: TicketLoyaltyEarnQuote | null
}

/** Choose the best single discount, then apply loyalty within the remaining price and balance. */
export function calculateTicketCheckout({ ticketType, isHaDoBookingVenue, currentTicketPricing, ticketDiscountQuote, ticketAutomaticDiscountQuote, ticketLoyaltyRedemption, profile, ticketUseLoyaltyPoints, ticketLoyaltyPointsToRedeem, ticketLoyaltyEarnQuote }: TicketCheckoutAmountsInput) {
  const isSpecialTicketType = ticketType !== 'individual'
  const ticketVoucherDiscountAmount = isHaDoBookingVenue
    ? Math.max(0, Math.floor(Number(ticketDiscountQuote?.discount_amount ?? 0) || 0))
    : 0
  const ticketAutomaticDiscountAmount = isHaDoBookingVenue
    ? Math.max(0, Math.floor(Number(ticketAutomaticDiscountQuote?.discount_amount ?? 0) || 0))
    : 0
  const ticketBuiltInDiscountAmount = Math.max(0, Math.floor(Number(currentTicketPricing.discountAmount ?? 0) || 0))
  const activeTicketAutomaticDiscountAmount = Math.max(ticketBuiltInDiscountAmount, ticketAutomaticDiscountAmount)
  const activeTicketDiscountAmount = isSpecialTicketType ? 0 : Math.max(activeTicketAutomaticDiscountAmount, ticketVoucherDiscountAmount)
  const activeTicketDiscountSource: 'automatic' | 'voucher' = ticketVoucherDiscountAmount > activeTicketAutomaticDiscountAmount ? 'voucher' : 'automatic'
  const currentTicketPriceBeforeLoyalty = isSpecialTicketType ? 0 : Math.max(0, currentTicketPricing.grossPrice - activeTicketDiscountAmount)
  const ticketLoyaltyBalance = Math.max(
    0,
    Math.floor(Number(ticketLoyaltyRedemption?.loyalty_points_total ?? profile?.loyalty_points_total ?? 0) || 0)
  )
  const ticketLoyaltyRedeemValue = Math.max(0, Math.floor(Number(ticketLoyaltyRedemption?.redeem_value_vnd_per_point ?? 0) || 0))
  const canUseTicketLoyaltyPoints = !isSpecialTicketType && isHaDoBookingVenue
  const requestedTicketLoyaltyPoints = ticketUseLoyaltyPoints && canUseTicketLoyaltyPoints
    ? Math.max(0, Math.floor(Number(ticketLoyaltyPointsToRedeem) || 0))
    : 0
  const maxTicketLoyaltyPoints = clampTicketLoyaltyRedemption(
    ticketLoyaltyBalance,
    ticketLoyaltyBalance,
    ticketLoyaltyRedeemValue,
    currentTicketPriceBeforeLoyalty
  )
  const appliedTicketLoyaltyPoints = ticketUseLoyaltyPoints && canUseTicketLoyaltyPoints
    ? clampTicketLoyaltyRedemption(
      requestedTicketLoyaltyPoints,
      ticketLoyaltyBalance,
      ticketLoyaltyRedeemValue,
      currentTicketPriceBeforeLoyalty
    )
    : 0
  const ticketLoyaltyDiscountAmount = isSpecialTicketType ? 0 : appliedTicketLoyaltyPoints * ticketLoyaltyRedeemValue
  const currentTicketTotalPrice = isSpecialTicketType ? 0 : Math.max(0, currentTicketPriceBeforeLoyalty - ticketLoyaltyDiscountAmount)
  const estimatedTicketLoyaltyPointsEarned = Math.max(0, Math.floor(Number(ticketLoyaltyEarnQuote?.estimated_points ?? 0) || 0))
  const estimatedTicketLoyaltyReductionValue = Math.max(0, Math.floor(Number(ticketLoyaltyEarnQuote?.estimated_reduction_vnd ?? 0) || 0))

  return {
    isSpecialTicketType,
    ticketVoucherDiscountAmount,
    ticketAutomaticDiscountAmount,
    ticketBuiltInDiscountAmount,
    activeTicketAutomaticDiscountAmount,
    activeTicketDiscountAmount,
    activeTicketDiscountSource,
    currentTicketPriceBeforeLoyalty,
    ticketLoyaltyBalance,
    ticketLoyaltyRedeemValue,
    canUseTicketLoyaltyPoints,
    requestedTicketLoyaltyPoints,
    maxTicketLoyaltyPoints,
    appliedTicketLoyaltyPoints,
    ticketLoyaltyDiscountAmount,
    currentTicketTotalPrice,
    estimatedTicketLoyaltyPointsEarned,
    estimatedTicketLoyaltyReductionValue
  }
}
