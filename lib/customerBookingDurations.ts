import { ticketMaxCustomerDurationMinutes, ticketPriceBlockMinutesForDate } from './ticketTariffs.ts'

/** Shared by ticket booking and Create Session; tariff changes flow to both. */
export function customerBookingDurations(date: string) {
  const block = ticketPriceBlockMinutesForDate(date)
  return Array.from({ length: Math.floor(ticketMaxCustomerDurationMinutes / block) }, (_, index) => (index + 1) * block)
}
