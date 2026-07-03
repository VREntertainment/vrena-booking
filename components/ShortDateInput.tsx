'use client'

import { useId, useRef } from 'react'
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
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const displayValue = value ? formatShortDate(value, language) : placeholder
  const openPicker = () => {
    const input = inputRef.current
    if (!input) return

    input.focus({ preventScroll: true })
    try {
      input.showPicker?.()
    } catch {
      // Some browsers only allow showPicker during a trusted activation.
    }
  }

  return (
    <label
      className="date-input-shell"
      htmlFor={inputId}
      onClick={openPicker}
    >
      <input
        aria-label={ariaLabel}
        className="date-input-native"
        id={inputId}
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span className={value ? 'date-input-display' : 'date-input-display placeholder'}>
        {displayValue}
      </span>
    </label>
  )
}
