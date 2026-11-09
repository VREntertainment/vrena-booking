import { birthdayPackageById, birthdayPackageNote } from './birthdayPackages.ts'
import { vietnamClock } from './booking/arenaAvailability.ts'
import { buildTicketBookingRequest } from './ticketBookingRequest.ts'
import { individualTicketUnitPrice, ticketPriceBlockMinutesForDate } from './ticketTariffs.ts'
import { calculateTicketPricing, minimumTicketDurationMinutes, ticketArenaCapacityForVenue } from './ticketPricing.ts'

export const zaloMiniAppVenues = ['ha-do-centrosa', 'cafe-des-stagiaires'] as const
export const zaloMiniAppTicketTypes = ['individual', 'birthday'] as const

export type ZaloMiniAppVenue = typeof zaloMiniAppVenues[number]
export type ZaloMiniAppTicketType = typeof zaloMiniAppTicketTypes[number]

export type ZaloMiniAppBookingSelection = {
  venue: ZaloMiniAppVenue
  ticketType: ZaloMiniAppTicketType
  date: string
  time: string
  durationMinutes: number
  players: number
  arenaCount: number
  guestName: string
  guestPhone: string
  birthdayPackageId: string | null
  acceptedTerms: true
}

export type ZaloMiniAppBookingQuote = {
  unitPrice: number
  bookingTotal: number
  displayTotal: number
  requiresStaffConfirmation: boolean
  durationMinutes: number
  players: number
  arenaCount: number
  specialNote: string
}

function integer(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : Number.NaN
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00+07:00`))
}

function isTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

export function isFutureVietnamBookingTime(date: string, time: string, now = new Date()) {
  if (!isDate(date) || !isTime(time)) return false
  const clock = vietnamClock(now)
  if (date !== clock.date) return date > clock.date
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes > clock.minutes
}

export function normalizeZaloMiniAppBookingSelection(input: unknown, now = new Date()): { data: ZaloMiniAppBookingSelection | null; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { data: null, error: 'Invalid booking request.' }
  const value = input as Record<string, unknown>
  const venue = cleanText(value.venue, 40)
  const ticketType = cleanText(value.ticketType, 20)
  const date = cleanText(value.date, 10)
  const time = cleanText(value.time, 5)
  const guestName = cleanText(value.guestName, 80)
  const guestPhone = cleanText(value.guestPhone, 24).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  const birthdayPackageId = cleanText(value.birthdayPackageId, 40) || null
  let durationMinutes = integer(value.durationMinutes)
  let players = integer(value.players)
  let arenaCount = integer(value.arenaCount)

  if (!zaloMiniAppVenues.includes(venue as ZaloMiniAppVenue)) return { data: null, error: 'Choose a valid VRena venue.' }
  if (!zaloMiniAppTicketTypes.includes(ticketType as ZaloMiniAppTicketType)) return { data: null, error: 'Choose a valid ticket type.' }
  if (!isDate(date) || !isTime(time)) return { data: null, error: 'Choose a valid date and time.' }
  if (!isFutureVietnamBookingTime(date, time, now)) return { data: null, error: 'Choose a future date and time.' }

  const packageItem = ticketType === 'birthday' ? birthdayPackageById(birthdayPackageId) : null
  if (ticketType === 'birthday' && !packageItem) return { data: null, error: 'Choose a birthday package.' }
  if (packageItem) {
    durationMinutes = 60
    players = packageItem.players
    arenaCount = venue === 'cafe-des-stagiaires' ? 1 : packageItem.arenas
  }

  const maxPlayers = 16
  const minPlayers = ticketType === 'birthday' ? 4 : 1
  if (!Number.isInteger(players) || players < minPlayers || players > maxPlayers) return { data: null, error: 'Choose a valid number of players.' }
  if (!Number.isInteger(arenaCount) || arenaCount < 1 || arenaCount > (venue === 'ha-do-centrosa' ? 2 : 1)) return { data: null, error: 'Choose a valid arena count.' }
  if (arenaCount === 2 && players <= 4) return { data: null, error: 'Two arenas require at least five players.' }

  const blockMinutes = ticketPriceBlockMinutesForDate(date)
  const minimumDuration = minimumTicketDurationMinutes(players, blockMinutes, ticketArenaCapacityForVenue(venue as ZaloMiniAppVenue), arenaCount)
  if (!Number.isInteger(durationMinutes) || durationMinutes < minimumDuration || durationMinutes > 180 || durationMinutes % blockMinutes !== 0) {
    return { data: null, error: `Choose a duration of at least ${minimumDuration} minutes.` }
  }

  const phoneDigits = guestPhone.replace(/\D/g, '').length
  if (phoneDigits < 8 || phoneDigits > 15) return { data: null, error: 'Enter a valid phone number.' }
  if (value.acceptedTerms !== true) return { data: null, error: 'Accept the Privacy Policy and Terms before booking.' }

  return {
    data: {
      venue: venue as ZaloMiniAppVenue,
      ticketType: ticketType as ZaloMiniAppTicketType,
      date,
      time,
      durationMinutes,
      players,
      arenaCount,
      guestName,
      guestPhone,
      birthdayPackageId,
      acceptedTerms: true,
    },
    error: '',
  }
}

export function normalizeZaloMiniAppQuoteSelection(input: unknown, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { data: null, error: 'Invalid booking request.' }
  }
  return normalizeZaloMiniAppBookingSelection({
    ...(input as Record<string, unknown>),
    guestName: '',
    guestPhone: '00000000',
    acceptedTerms: true,
  }, now)
}

export function quoteZaloMiniAppBooking(selection: ZaloMiniAppBookingSelection): ZaloMiniAppBookingQuote {
  const packageItem = selection.ticketType === 'birthday' ? birthdayPackageById(selection.birthdayPackageId) : null
  if (packageItem) {
    return {
      unitPrice: 0,
      bookingTotal: 0,
      displayTotal: packageItem.price,
      requiresStaffConfirmation: true,
      durationMinutes: 60,
      players: packageItem.players,
      arenaCount: selection.venue === 'cafe-des-stagiaires' ? 1 : packageItem.arenas,
      specialNote: birthdayPackageNote(packageItem),
    }
  }
  const unitPrice = individualTicketUnitPrice(selection.date, selection.time, selection.venue)
  const pricing = calculateTicketPricing(
    unitPrice,
    selection.players,
    selection.durationMinutes,
    ticketPriceBlockMinutesForDate(selection.date),
    ticketArenaCapacityForVenue(selection.venue),
    selection.arenaCount,
  )
  return {
    unitPrice,
    bookingTotal: pricing.totalPrice,
    displayTotal: pricing.totalPrice,
    requiresStaffConfirmation: false,
    durationMinutes: selection.durationMinutes,
    players: selection.players,
    arenaCount: selection.arenaCount,
    specialNote: '',
  }
}

export function buildZaloMiniAppBookingRequest(selection: ZaloMiniAppBookingSelection) {
  const quote = quoteZaloMiniAppBooking(selection)
  const defaultGame = selection.ticketType === 'birthday'
    ? 'joller-house'
    : 'laser-tag'
  return {
    quote,
    request: buildTicketBookingRequest({
      isHaDo: selection.venue === 'ha-do-centrosa',
      authenticated: false,
      ticketType: selection.ticketType,
      date: selection.date,
      time: selection.time,
      durationMinutes: quote.durationMinutes,
      players: quote.players,
      arenaCount: quote.arenaCount,
      defaultGame,
      unitPrice: quote.unitPrice,
      totalPrice: quote.bookingTotal,
      special: selection.ticketType !== 'individual',
      note: quote.specialNote,
      loyaltyPoints: 0,
      discountCode: null,
      guestName: selection.guestName,
      guestPhone: selection.guestPhone,
    }),
  }
}
