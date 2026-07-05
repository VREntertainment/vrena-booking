export type HCaptchaApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      size?: 'invisible'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    }
  ) => string
  execute?: (
    widgetId?: string,
    options?: { async?: boolean }
  ) => void | Promise<string | { response?: string }>
  getResponse?: (widgetId?: string) => string
  reset: (widgetId?: string) => void
  remove?: (widgetId: string) => void
}

export type PasskeyCaptchaPolicy = {
  mode: 'unsupported' | 'execute-on-click' | 'cached-before-passkey' | 'visible-before-passkey'
  reason: 'no-passkeys' | 'standard-browser' | 'webkit-focus-risk' | 'safari-visible-challenge'
}

export const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || 'a4be4d0e-2570-4642-a1a6-a44c02fa0d46'
export const HCAPTCHA_SCRIPT_ID = 'vrena-hcaptcha-script'
export const HCAPTCHA_PRIMARY_SCRIPT_URL = 'https://js.hcaptcha.com/1/api.js?render=explicit'
export const HCAPTCHA_FALLBACK_SCRIPT_URL = 'https://hcaptcha.com/1/api.js?render=explicit'
export const HCAPTCHA_LOAD_TIMEOUT_MS = 8000

let hcaptchaLoadPromise: Promise<HCaptchaApi> | null = null

export function getHCaptcha() {
  if (typeof window === 'undefined') return undefined

  return (window as unknown as { hcaptcha?: HCaptchaApi }).hcaptcha
}

function waitForHCaptcha(timeoutMs = HCAPTCHA_LOAD_TIMEOUT_MS) {
  const availableCaptcha = getHCaptcha()
  if (availableCaptcha) return Promise.resolve(availableCaptcha)
  if (typeof window === 'undefined') return Promise.reject(new Error('hCaptcha is not available.'))

  const startedAt = Date.now()

  return new Promise<HCaptchaApi>((resolve, reject) => {
    const check = () => {
      const hcaptcha = getHCaptcha()

      if (hcaptcha) {
        resolve(hcaptcha)
        return
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('hCaptcha did not load.'))
        return
      }

      window.setTimeout(check, 50)
    }

    check()
  })
}

function loadHCaptchaScript(src: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('hCaptcha can only load in the browser.'))
  }

  const availableCaptcha = getHCaptcha()
  if (availableCaptcha) return Promise.resolve(availableCaptcha)

  return new Promise<HCaptchaApi>((resolve, reject) => {
    const existingScript = document.getElementById(HCAPTCHA_SCRIPT_ID) as HTMLScriptElement | null
    if (existingScript?.src === src) {
      waitForHCaptcha().then(resolve).catch(reject)
      return
    }
    existingScript?.remove()

    const script = document.createElement('script')
    let timeoutId: number | null = null

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }

    const onLoad = () => {
      waitForHCaptcha().then((hcaptcha) => {
        cleanup()
        resolve(hcaptcha)
      }).catch((error) => {
        cleanup()
        reject(error)
      })
    }

    const onError = () => {
      cleanup()
      reject(new Error('hCaptcha script failed to load.'))
    }

    script.id = HCAPTCHA_SCRIPT_ID
    script.src = src
    script.async = true
    script.defer = true
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    timeoutId = window.setTimeout(onError, HCAPTCHA_LOAD_TIMEOUT_MS)
    document.body.appendChild(script)
  })
}

export function ensureHCaptcha() {
  const availableCaptcha = getHCaptcha()
  if (availableCaptcha) return Promise.resolve(availableCaptcha)

  hcaptchaLoadPromise ??= loadHCaptchaScript(HCAPTCHA_PRIMARY_SCRIPT_URL)
    .catch(() => loadHCaptchaScript(HCAPTCHA_FALLBACK_SCRIPT_URL))
    .catch((error) => {
      hcaptchaLoadPromise = null
      throw error
    })

  return hcaptchaLoadPromise
}

export function removeHCaptchaWidget(widgetId: string | null) {
  if (!widgetId) return

  const hcaptcha = getHCaptcha()
  if (!hcaptcha) return

  try {
    hcaptcha.remove?.(widgetId)
  } catch {
    hcaptcha.reset(widgetId)
  }
}

export function passkeysAvailable() {
  return typeof window !== 'undefined'
    && 'PublicKeyCredential' in window
    && Boolean(window.PublicKeyCredential)
    && 'credentials' in navigator
    && typeof navigator.credentials?.create === 'function'
    && typeof navigator.credentials?.get === 'function'
}

function isLikelyIOSWebKit() {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  const platform = navigator.platform || ''

  return /iPad|iPhone|iPod/i.test(userAgent)
    || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isLikelyMacSafari() {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  const vendor = navigator.vendor || ''

  return /Safari/i.test(userAgent)
    && /Apple/i.test(vendor)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android/i.test(userAgent)
}

export function passkeyCaptchaPolicy(): PasskeyCaptchaPolicy {
  if (!passkeysAvailable()) {
    return { mode: 'unsupported', reason: 'no-passkeys' }
  }

  if (isLikelyIOSWebKit()) {
    return { mode: 'cached-before-passkey', reason: 'webkit-focus-risk' }
  }

  if (isLikelyMacSafari()) {
    return { mode: 'visible-before-passkey', reason: 'safari-visible-challenge' }
  }

  return { mode: 'execute-on-click', reason: 'standard-browser' }
}
