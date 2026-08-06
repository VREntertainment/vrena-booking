import type { LanguageCode } from './languages'
import { en, type TranslationMap } from './base'

export function getFallbackTranslation(): TranslationMap {
  return en
}

async function loadBaseTranslation(language: LanguageCode): Promise<TranslationMap> {
  switch (language) {
    case 'vi':
      return import('./locales/vi').then((module) => module.vi)
    case 'ko':
      return import('./locales/ko').then((module) => module.ko)
    case 'ja':
      return import('./locales/ja').then((module) => module.ja)
    case 'fr':
      return import('./locales/fr').then((module) => module.fr)
    case 'de':
      return import('./locales/de').then((module) => module.de)
    case 'it':
      return import('./locales/it').then((module) => module.it)
    case 'en':
    default:
      return en
  }
}

async function applyPublishedCopy(
  language: LanguageCode,
  translation: TranslationMap,
): Promise<TranslationMap> {
  if (typeof window === 'undefined') return translation

  try {
    const response = await fetch(
      `/api/content-studio/published-copy?locale=${encodeURIComponent(language)}`,
      { cache: 'no-store' },
    )

    if (!response.ok) return translation

    const payload = (await response.json()) as { copy?: unknown }

    if (!payload.copy || typeof payload.copy !== 'object' || Array.isArray(payload.copy)) {
      return translation
    }

    const nextTranslation = { ...translation }

    for (const [key, value] of Object.entries(payload.copy)) {
      if (key in translation && typeof value === 'string') {
        nextTranslation[key as keyof TranslationMap] = value
      }
    }

    return nextTranslation
  } catch {
    return translation
  }
}

export async function loadTranslation(language: LanguageCode): Promise<TranslationMap> {
  const translation = await loadBaseTranslation(language)
  return applyPublishedCopy(language, translation)
}

export type { TranslationMap }
