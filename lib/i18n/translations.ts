import type { LanguageCode } from './languages'
import { en, type TranslationMap } from './base'
import { vi } from './locales/vi'
import { ko } from './locales/ko'
import { ja } from './locales/ja'
import { fr } from './locales/fr'
import { de } from './locales/de'
import { it } from './locales/it'

export { en, type TranslationKey, type TranslationMap } from './base'
export { vi } from './locales/vi'
export { ko } from './locales/ko'
export { ja } from './locales/ja'
export { fr } from './locales/fr'
export { de } from './locales/de'
export { it } from './locales/it'

export const uiText = {
  en,
  vi,
  ko,
  ja,
  fr,
  de,
  it,
} satisfies Record<LanguageCode, TranslationMap>
