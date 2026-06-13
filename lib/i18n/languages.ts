export type LanguageCode =
  | 'en'
  | 'vi'
  | 'ko'
  | 'ja'
  | 'fr'
  | 'de'
  | 'it'

export const languageOptions = ['en', 'vi', 'ko', 'ja', 'fr', 'de', 'it'] as const satisfies readonly LanguageCode[]

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return Boolean(value && (languageOptions as readonly string[]).includes(value))
}
