'use client'

import { useRouter } from 'next/navigation'
import { isLanguageCode, languageOptions, type LanguageCode } from '../lib/i18n/languages'

export default function GameGuideLanguageSelect({ language, label }: { language: LanguageCode; label: string }) {
  const router = useRouter()
  return <select aria-label={label} value={language} onChange={(event) => {
    if (isLanguageCode(event.target.value)) router.push(`/games/${event.target.value}`)
  }}>{languageOptions.map((option) => <option value={option} key={option}>{option.toUpperCase()}</option>)}</select>
}
