export const GOOGLE_ANALYTICS_ID = 'G-1K2MBG959X'
export const CONSENT_COOKIE_NAME = 'vrena-cookie-consent'
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
export const CONSENT_CHANGE_EVENT = 'vrena-cookie-consent-change'

export type ConsentChoice = 'essential' | 'analytics' | 'all'

export const consentStates: Record<ConsentChoice, { analytics: boolean; marketing: boolean }> = {
  essential: { analytics: false, marketing: false },
  analytics: { analytics: true, marketing: false },
  all: { analytics: true, marketing: true },
}

declare global {
  interface Window {
    __vrenaGoogleAnalyticsConfigured?: boolean
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function sharedConsentCookieDomain() {
  const hostname = window.location.hostname

  return hostname === 'vre-vietnam.com' || hostname.endsWith('.vre-vietnam.com')
    ? '; Domain=vre-vietnam.com'
    : ''
}

export function readConsentChoice(): ConsentChoice | null {
  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE_NAME}=`))
  const value = cookie?.slice(CONSENT_COOKIE_NAME.length + 1)

  return value && value in consentStates ? value as ConsentChoice : null
}

export function writeConsentChoice(choice: ConsentChoice) {
  document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; Secure`
  document.cookie = `${CONSENT_COOKIE_NAME}=${choice}; Path=/; Max-Age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax; Secure${sharedConsentCookieDomain()}`
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT))
}

export function analyticsConsentGranted() {
  const choice = readConsentChoice()
  return choice ? consentStates[choice].analytics : false
}

function trackEvent(eventName: string, parameters: Record<string, unknown>) {
  if (!analyticsConsentGranted() || typeof window.gtag !== 'function') return

  window.gtag('event', eventName, parameters)
}

type TicketAnalyticsInput = {
  ticketType: 'individual' | 'birthday' | 'corporate'
  ticketLabel: string
  date: string
  time: string
  players: number
  durationMinutes: number
  totalPrice: number
}

function ticketItem(input: TicketAnalyticsInput) {
  return [{
    item_id: `ticket_${input.ticketType}`,
    item_name: input.ticketLabel,
    item_category: 'VR booking',
    price: input.totalPrice,
    quantity: 1,
  }]
}

export function trackTicketCheckoutStarted(input: TicketAnalyticsInput) {
  trackEvent('begin_checkout', {
    ...(input.ticketType === 'individual' ? { currency: 'VND', value: input.totalPrice } : {}),
    items: ticketItem(input),
    ticket_type: input.ticketType,
    booking_date: input.date,
    booking_time: input.time,
    player_count: input.players,
    duration_minutes: input.durationMinutes,
  })
}

export function trackTicketBookingCompleted(
  input: TicketAnalyticsInput & { transactionId: string },
) {
  const sharedParameters = {
    items: ticketItem(input),
    ticket_type: input.ticketType,
    booking_date: input.date,
    booking_time: input.time,
    player_count: input.players,
    duration_minutes: input.durationMinutes,
  }

  if (input.ticketType === 'individual') {
    if (!input.transactionId.trim()) return

    trackEvent('purchase', {
      ...sharedParameters,
      transaction_id: input.transactionId,
      currency: 'VND',
      value: input.totalPrice,
    })
    return
  }

  trackEvent('qualify_lead', {
    ...sharedParameters,
    lead_type: input.ticketType,
  })
}
