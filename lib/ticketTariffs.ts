export const ticketTariffEffectiveDate = '2026-08-31'

export const legacyIndividualTicketPrices = {
  weekdayDay: 200000,
  weekdayEvening: 250000,
  weekend: 330000,
} as const

export const individualTicketPrices = {
  'ha-do-centrosa': {
    weekdayDay: 220000,
    happyHour: 260000,
    evening: 290000,
    weekendDay: 330000,
    weekendEvening: 390000,
  },
  'cafe-des-stagiaires': {
    weekdayDay: 190000,
    happyHour: 240000,
    evening: 290000,
    weekendDay: 240000,
    weekendEvening: 290000,
  },
} as const

export const legacyTicketPriceBlockMinutes = 20
export const ticketPriceBlockMinutes = 45

export type TicketPricingVenue = keyof typeof individualTicketPrices

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function ticketPriceBlockMinutesForDate(dateValue: string) {
  return !dateValue || dateValue < ticketTariffEffectiveDate
    ? legacyTicketPriceBlockMinutes
    : ticketPriceBlockMinutes
}

export function individualTicketUnitPrice(
  dateValue: string,
  timeValue: string,
  venue: TicketPricingVenue = 'ha-do-centrosa'
) {
  if (!dateValue || dateValue < ticketTariffEffectiveDate) {
    if (!dateValue) return legacyIndividualTicketPrices.weekdayDay
    const legacyDay = new Date(`${dateValue}T12:00:00`).getDay()
    if (legacyDay === 0 || legacyDay === 6) return legacyIndividualTicketPrices.weekend
    const legacyMinutes = timeValue ? timeToMinutes(timeValue) : 12 * 60
    return legacyMinutes >= 18 * 60
      ? legacyIndividualTicketPrices.weekdayEvening
      : legacyIndividualTicketPrices.weekdayDay
  }

  const prices = individualTicketPrices[venue]
  const day = new Date(`${dateValue}T12:00:00`).getDay()
  const minutes = timeValue ? timeToMinutes(timeValue) : 12 * 60
  if (day === 0 || day === 6) {
    return minutes >= 20 * 60 ? prices.weekendEvening : prices.weekendDay
  }
  if (minutes >= 20 * 60) return prices.evening
  if (minutes >= 16 * 60) return prices.happyHour
  return prices.weekdayDay
}
