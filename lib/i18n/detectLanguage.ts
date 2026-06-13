import { isLanguageCode, type LanguageCode } from './languages'

export const LANGUAGE_STORAGE_KEY = 'vrena-language'

export function detectLanguageFromLocale(locale: string | null | undefined): LanguageCode {
  const value = (locale || '').toLowerCase()

  if (value.startsWith('vi')) return 'vi'
  if (value.startsWith('ko')) return 'ko'
  if (value.startsWith('ja')) return 'ja'
  if (value.startsWith('fr')) return 'fr'
  if (value.startsWith('de')) return 'de'
  if (value.startsWith('it')) return 'it'

  return 'en'
}

export function detectBrowserLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return 'en'

  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language]

  for (const browserLanguage of browserLanguages) {
    const detected = detectLanguageFromLocale(browserLanguage)
    if (detected !== 'en') return detected
  }

  return 'en'
}

export function getStoredLanguage(): LanguageCode | null {
  if (typeof window === 'undefined') return null

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isLanguageCode(storedLanguage) ? storedLanguage : null
}

export function storeLanguage(language: LanguageCode) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}

export function getInitialLanguage(): LanguageCode {
  return getStoredLanguage() || detectBrowserLanguage()
}
