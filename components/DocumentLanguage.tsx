'use client'

import { useEffect } from 'react'
import type { LanguageCode } from '../lib/i18n/languages'

export default function DocumentLanguage({ language }: { language: LanguageCode }) {
  useEffect(() => {
    document.documentElement.lang = language
    return () => { document.documentElement.lang = 'en' }
  }, [language])
  return null
}
