export type LanguageCode =
  | 'en'
  | 'vi'
  | 'ko'
  | 'ja'
  | 'fr'
  | 'de'
  | 'it'
  | 'zh'

export const languageOptions = ['en', 'vi', 'ko', 'ja', 'fr', 'de', 'it', 'zh'] as const satisfies readonly LanguageCode[]

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return Boolean(value && (languageOptions as readonly string[]).includes(value))
}
