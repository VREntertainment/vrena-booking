import type { StaffConsoleCopy } from './copy.ts'
import { staffConsoleText } from './copy.ts'
import { normalizeTime } from './dates.ts'
import { formatPercentInput, formatVnd } from './formatting.ts'
import type {
  BookingForm,
  StaffDiscount,
  StaffDiscountDayScope,
  StaffDiscountTicketType,
  StaffDiscountValueUnit,
  StaffLoyaltyRule,
  StaffPriceRule,
} from './types.ts'

export function discountValueUnit(type: StaffDiscount['discount_type']): StaffDiscountValueUnit {
  return type === 'fixed_amount' ? 'fixed_amount' : 'percentage'
}

export function dayTypeFor(dateValue: string): 'weekday' | 'weekend' {
  const day = new Date(`${dateValue}T12:00:00`).getDay()
  return day === 0 || day === 6 ? 'weekend' : 'weekday'
}

export function isDateInRange(dateValue: string, from: string, until: string | null) {
  return dateValue >= from && (!until || dateValue <= until)
}

export function isTimeInRule(timeValue: string, rule: StaffPriceRule) {
  const time = normalizeTime(timeValue)
  const start = normalizeTime(rule.time_start)
  const end = normalizeTime(rule.time_end)
  return (!start || time >= start) && (!end || time < end)
}

export function weekdayScopeFor(dateValue: string): StaffDiscountDayScope {
  const day = new Date(`${dateValue}T12:00:00`).getDay()
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day] as StaffDiscountDayScope
}

export function isDayInDiscountScope(dateValue: string, scope: StaffDiscountDayScope) {
  if (scope === 'all') return true
  const weekday = weekdayScopeFor(dateValue)
  if (scope === 'weekday') return !['sun', 'sat'].includes(weekday)
  if (scope === 'weekend') return ['sun', 'sat'].includes(weekday)
  return weekday === scope
}

export function isTimeInDiscount(timeValue: string, discount: Pick<StaffDiscount, 'time_start' | 'time_end'>) {
  const time = normalizeTime(timeValue)
  const start = normalizeTime(discount.time_start)
  const end = normalizeTime(discount.time_end)
  if (!start && !end) return true
  if (!time) return false
  if (start && end && start > end) return time >= start || time < end
  return (!start || time >= start) && (!end || time < end)
}

export function discountMatchesContext(
  discount: StaffDiscount,
  context: {
    date: string
    gameId: string | null
    players: number
    priceRuleId?: string | null
    subtotal: number
    ticketType?: StaffDiscountTicketType
    time: string
  },
) {
  if (!discount.active) return false
  if (discount.max_uses !== null && discount.used_count >= discount.max_uses) return false
  if (discount.game_id && discount.game_id !== context.gameId) return false
  if (discount.price_rule_id && discount.price_rule_id !== context.priceRuleId) return false
  if (!isDateInRange(context.date, discount.valid_from, discount.valid_until)) return false
  if (!isDayInDiscountScope(context.date, discount.day_scope || 'all')) return false
  if (!isTimeInDiscount(context.time, discount)) return false
  if (discount.min_players !== null && context.players < discount.min_players) return false
  if (discount.max_players !== null && context.players > discount.max_players) return false
  if ((discount.min_order_total ?? 0) > 0 && context.subtotal < discount.min_order_total) return false
  if (discount.ticket_type && discount.ticket_type !== 'all' && discount.ticket_type !== context.ticketType) return false
  return true
}

export function selectPricingRule(rules: StaffPriceRule[], gameId: string, dateValue: string, timeValue: string) {
  const dayType = dayTypeFor(dateValue)
  return rules
    .filter((rule) => {
      if (!rule.active) return false
      if (rule.game_id && rule.game_id !== gameId) return false
      if (!isDateInRange(dateValue, rule.valid_from, rule.valid_until)) return false
      if (rule.day_type !== 'custom' && rule.day_type !== 'holiday' && rule.day_type !== dayType) return false
      return isTimeInRule(timeValue, rule)
    })
    .sort((left, right) => {
      if (left.game_id && !right.game_id) return -1
      if (!left.game_id && right.game_id) return 1
      if (left.day_type === 'custom' && right.day_type !== 'custom') return -1
      if (left.day_type !== 'custom' && right.day_type === 'custom') return 1
      return right.valid_from.localeCompare(left.valid_from)
    })[0] || null
}

export function calculateDiscount(discount: StaffDiscount | null, subtotal: number, unitPrice: number) {
  if (!discount) return 0
  let amount = 0
  if (discount.discount_type === 'fixed_amount') amount = discount.value
  if (discount.discount_type === 'free_ticket') amount = unitPrice
  if (['percentage', 'birthday', 'resident', 'group'].includes(discount.discount_type)) {
    amount = subtotal * Math.min(discount.value, 100) / 100
  }

  if (discount.max_discount_amount !== null) {
    amount = Math.min(amount, discount.max_discount_amount)
  }

  return Math.min(subtotal, Math.max(0, Math.round(amount)))
}

export function formatDiscountRuleValue(discount: Pick<StaffDiscount, 'discount_type' | 'value'>, text: StaffConsoleCopy = staffConsoleText.en) {
  if (discount.discount_type === 'fixed_amount') return formatVnd(discount.value)
  if (discount.discount_type === 'free_ticket') return text.discountTypes.free_ticket
  return `${formatPercentInput(discount.value) || '0'}%`
}

export function formatDiscountRuleConditions(
  discount: StaffDiscount,
  gameName: string,
  priceRuleName: string,
  text: StaffConsoleCopy = staffConsoleText.en,
) {
  const conditions = [gameName, priceRuleName]
  if (discount.min_players !== null || discount.max_players !== null) {
    conditions.push(`${discount.min_players ?? 1}-${discount.max_players ?? text.any} ${text.labels.players}`)
  }
  conditions.push(text.discountDayScopes[discount.day_scope || 'all'])
  if (discount.time_start || discount.time_end) {
    conditions.push(`${normalizeTime(discount.time_start) || '00:00'}-${normalizeTime(discount.time_end) || '24:00'}`)
  }
  if (discount.ticket_type && discount.ticket_type !== 'all') {
    conditions.push(text.discountTicketTypes[discount.ticket_type])
  }
  if ((discount.min_order_total ?? 0) > 0) {
    conditions.push(`${text.labels.minimumSpend} ${formatVnd(discount.min_order_total)}`)
  }
  if (discount.max_discount_amount !== null) {
    conditions.push(`${text.labels.maxDiscountAmount} ${formatVnd(discount.max_discount_amount)}`)
  }
  if (discount.per_customer_limit !== null) {
    conditions.push(`${text.labels.perCustomerLimit} ${discount.per_customer_limit}`)
  }
  return conditions.join(' · ')
}

export function calculateManualDiscount(type: BookingForm['manualDiscountType'], value: number, subtotal: number) {
  if (!type || value <= 0) return 0
  const amount = type === 'percentage'
    ? subtotal * Math.min(value, 100) / 100
    : value
  return Math.min(subtotal, Math.max(0, Math.round(amount)))
}

export function manualDiscountLabel(type: BookingForm['manualDiscountType'], value: number, text: StaffConsoleCopy = staffConsoleText.en) {
  if (!type || value <= 0) return ''
  return type === 'percentage'
    ? `${text.labels.uniqueDiscount} · ${Math.min(value, 100)}%`
    : `${text.labels.uniqueDiscount} · ${formatVnd(value)}`
}

export function loyaltyCalculationLabel(type: StaffLoyaltyRule['calculation_type'], text: StaffConsoleCopy = staffConsoleText.en) {
  return text.loyaltyCalculation[type]
}

export function isStaffGroupDiscount(discount: StaffDiscount) {
  return !discount.code && discount.ticket_type !== 'birthday' && (discount.discount_type === 'group' || (discount.min_players ?? 0) > 1)
}

export function validBookingTotalOverride(booking: Pick<BookingForm, 'overrideTotalEnabled' | 'overrideTotal' | 'overrideReason'>) {
  if (!booking.overrideTotalEnabled) return true
  const value = Number(booking.overrideTotal)
  return booking.overrideTotal.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 2147483647 && booking.overrideReason.trim().length > 0
}
