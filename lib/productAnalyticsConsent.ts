export type ProductAnalyticsConsent = 'granted' | 'denied' | null

export const PRODUCT_ANALYTICS_CONSENT_KEY = 'vrena_product_analytics_consent'
const PRODUCT_ANALYTICS_CLIENT_KEY = 'vrena_product_analytics_client_id'
const PRODUCT_ANALYTICS_SESSION_KEY = 'vrena_product_analytics_session_id'
const PRODUCT_ANALYTICS_ATTRIBUTION_KEY = 'vrena_product_analytics_attribution'
const PRODUCT_ANALYTICS_CONSENT_CHANGE_EVENT = 'vrena:product-analytics-consent-change'

export function readProductAnalyticsConsent(): ProductAnalyticsConsent {
  try {
    const stored = localStorage.getItem(PRODUCT_ANALYTICS_CONSENT_KEY)
    return stored === 'granted' || stored === 'denied' ? stored : null
  } catch {
    return 'denied'
  }
}

export function subscribeToProductAnalyticsConsent(onChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PRODUCT_ANALYTICS_CONSENT_KEY) onChange()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(PRODUCT_ANALYTICS_CONSENT_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(PRODUCT_ANALYTICS_CONSENT_CHANGE_EVENT, onChange)
  }
}

export function writeProductAnalyticsConsent(consent: Exclude<ProductAnalyticsConsent, null>) {
  try {
    localStorage.setItem(PRODUCT_ANALYTICS_CONSENT_KEY, consent)
    if (consent === 'denied') {
      localStorage.removeItem(PRODUCT_ANALYTICS_CLIENT_KEY)
      sessionStorage.removeItem(PRODUCT_ANALYTICS_SESSION_KEY)
      sessionStorage.removeItem(PRODUCT_ANALYTICS_ATTRIBUTION_KEY)
    }
  } catch {
    // Consent controls remain usable even when browser storage is unavailable.
  } finally {
    window.dispatchEvent(new Event(PRODUCT_ANALYTICS_CONSENT_CHANGE_EVENT))
  }
}
