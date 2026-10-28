import 'server-only'
import { OPENAI_ADS_PIXEL_ID, openAiBookingEventId, type BookingVenue } from '../openAiAdsEvent'
import { trustedClientIp, UNKNOWN_CLIENT_IP } from '../security/requestIp'

// Only called with the result of a committed booking RPC, never a browser claim.
export async function sendOpenAiBooking(input: {
  bookingId: string
  venue: BookingVenue
  timestampMs: number
  headers: Headers
  requestOrigin: string
  sourceUrl: unknown
}, fetcher: typeof fetch = fetch) {
  try {
    const cookie = (name: string) => input.headers.get('cookie')?.split(';').map(v => v.trimStart()).find(v => v.startsWith(name + '='))?.slice(name.length + 1)
    if (cookie('vrena-cookie-consent') !== 'all') return
    const apiKey = process.env.OPENAI_ADS_CAPI_KEY
    if (!apiKey) {
      console.warn('OpenAI booking conversion: credential missing')
      return
    }
    const canonical = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://booking.vre-vietnam.com')
    let sourceUrl = new URL('/tickets', canonical)
    try {
      const candidate = new URL(typeof input.sourceUrl === 'string' ? input.sourceUrl : '')
      if (['https:', 'http:'].includes(candidate.protocol)
        && [canonical.origin, input.requestOrigin].includes(candidate.origin)
        && candidate.pathname === '/tickets') sourceUrl = candidate
    } catch { /* Use the trusted canonical fallback. */ }
    const oppref = cookie('__oppref')
    const obref = cookie('__obref')
    const ip = trustedClientIp(input.headers)
    const userAgent = input.headers.get('user-agent')
    const event = {
      id: openAiBookingEventId(input.bookingId, input.venue),
      type: 'appointment_scheduled',
      timestamp_ms: input.timestampMs,
      action_source: 'web',
      source_url: sourceUrl.origin + sourceUrl.pathname,
      ...(oppref ? { oppref } : {}),
      user: {
        ...(obref ? { obref } : {}),
        ...(userAgent ? { user_agent: userAgent } : {}),
        ...(ip !== UNKNOWN_CLIENT_IP ? { ip_address: ip } : {}),
      },
      data: { type: 'customer_action' },
    }
    // Same event and timestamp on retry. No customer contact data or response bodies logged.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetcher(`https://bzr.openai.com/v1/events?pid=${OPENAI_ADS_PIXEL_ID}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: [event] }),
          signal: AbortSignal.timeout(3000),
        })
        if (response.ok) {
          console.info('OpenAI booking conversion accepted', { venue: input.venue })
          return
        }
        if (response.status !== 429 && response.status < 500) {
          console.warn('OpenAI booking conversion rejected', { status: response.status })
          return
        }
      } catch { /* Retry bounded transport failures without affecting the booking. */ }
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)))
    }
    console.warn('OpenAI booking conversion delivery exhausted')
  } catch { console.warn('OpenAI booking conversion unavailable') }
}
