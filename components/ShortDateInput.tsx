'use client'

import type { LanguageCode } from '../lib/i18n/languages'

function formatShortDate(dateValue: string, language: LanguageCode) {
  if (!dateValue) return ''

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString(language, {
    day: '2-digit',
    month: 'short',
  })
}

export default function ShortDateInput({
  value,
  onChange,
  language,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  language: LanguageCode
  placeholder: string
  ariaLabel: string
}) {
  const displayValue = value ? formatShortDate(value, language) : placeholder

  return (
    <div className="date-input-shell">
      <input
        aria-label={ariaLabel}
        className="date-input-native"
        type="date"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span className={value ? 'date-input-display' : 'date-input-display placeholder'}>
        {displayValue}
      </span>
    </div>
  )
}
