// Browser-only, consent-gated OpenAI Ads measurement. No customer identifiers.
export const OPENAI_ADS_PIXEL_ID = 'Y2uNue1R9VNaKHAjR1K9Ev'
type Pixel = ((...args: unknown[]) => void) & { q?: unknown[][] }
declare global {
  interface Window {
    oaiq?: Pixel
    __vrenaOpenAiInitialized?: boolean
    __vrenaOpenAiPage?: string
  }
}

const internalPath = /^\/(staff|hr|admin|content-studio|auth)(\/|$)/
function allowed() {
  return !internalPath.test(window.location.pathname) && document.cookie.split(';').some(c => c.trim() === 'vrena-cookie-consent=all')
}

export function syncOpenAiMeasurement(granted: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (!granted || !allowed()) {
      window.oaiq?.('consent', false)
      window.__vrenaOpenAiPage = undefined
      sessionStorage.removeItem('vrena:booking-attribution')
      return
    }
    if (!window.oaiq) {
      const queue: Pixel = (...args: unknown[]) => { queue.q?.push(args) }
      queue.q = []
      window.oaiq = queue
    }
    window.oaiq('consent', true)
    if (!window.__vrenaOpenAiInitialized) {
      window.oaiq('init', { pixelId: OPENAI_ADS_PIXEL_ID })
      window.__vrenaOpenAiInitialized = true
      const script = document.createElement('script')
      script.src = 'https://bzrcdn.openai.com/sdk/oaiq.min.js'
      script.async = true
      document.head.appendChild(script)
    }
    const page = window.location.origin + window.location.pathname
    if (window.__vrenaOpenAiPage !== page) {
      window.oaiq('measure', 'page_viewed', { type: 'contents', contents: [{ id: window.location.pathname, content_type: 'page' }] })
      window.__vrenaOpenAiPage = page
    }
  } catch { /* Measurement must never interrupt booking. */ }
}

export function measureOpenAiBooking(eventId: string) {
  if (typeof window === 'undefined') return
  try {
    if (!allowed() || !eventId.trim()) return
    syncOpenAiMeasurement(true)
    const key = 'vrena:openai:booking:' + eventId
    if (sessionStorage.getItem(key)) return
    window.oaiq?.('measure', 'appointment_scheduled', { type: 'customer_action' }, { event_id: 'booking:' + eventId })
    sessionStorage.setItem(key, '1')
  } catch { /* Includes storage-disabled browsers and SDK failures. */ }
}
