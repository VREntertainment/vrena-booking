import type { LanguageCode } from './languages'
import { en, type TranslationMap } from './base'

const translationLoaders = {
  en: () => Promise.resolve(en),
  vi: () => import('./locales/vi').then((module) => module.vi),
  ko: () => import('./locales/ko').then((module) => module.ko),
  ja: () => import('./locales/ja').then((module) => module.ja),
  fr: () => import('./locales/fr').then((module) => module.fr),
  de: () => import('./locales/de').then((module) => module.de),
  it: () => import('./locales/it').then((module) => module.it),
} satisfies Record<LanguageCode, () => Promise<TranslationMap>>

export function getFallbackTranslation(): TranslationMap {
  return en
}

export async function loadTranslation(language: LanguageCode): Promise<TranslationMap> {
  return translationLoaders[language]()
}

export type { TranslationMap }
