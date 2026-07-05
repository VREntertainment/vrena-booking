'use client'

import { useMemo, useState } from 'react'
import { countries } from '../lib/bookingStaticData'

type CountryCodePickerProps = {
  buttonLabel: string
  disabled?: boolean
  onChange: (countryCode: string) => void
  searchPlaceholder: string
  value: string
}

type PhoneNumberInputProps = {
  autoComplete?: string
  buttonLabel: string
  className?: string
  disabled?: boolean
  inputLabel: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder: string
  value: string
}

function normalizeCountrySearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function splitPhoneNumberValue(phone: string) {
  const cleaned = phone.trim()
  const country = [...countries]
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => cleaned.startsWith(item.code))

  if (!country) return { countryInput: '+84', localPhone: cleaned }

  return {
    countryInput: country.code,
    localPhone: cleaned.slice(country.code.length).trim(),
  }
}

export default function CountryCodePicker({
  buttonLabel,
  disabled = false,
  onChange,
  searchPlaceholder,
  value,
}: CountryCodePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filteredCountries = useMemo(() => {
    const query = normalizeCountrySearch(search.trim())
    if (!query) return countries

    return countries.filter((country) =>
      normalizeCountrySearch(`${country.code} ${country.name}`).includes(query)
    )
  }, [search])

  return (
    <div className="country-picker">
      <button
        aria-label={buttonLabel}
        className="country-button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {value}
      </button>
      {isOpen && (
        <div className="country-menu">
          <input
            autoFocus
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            value={search}
          />
          <div className="country-list">
            {filteredCountries.map((country) => (
              <button
                key={`${country.code}-${country.name}`}
                onClick={() => {
                  onChange(country.code)
                  setSearch('')
                  setIsOpen(false)
                }}
                type="button"
              >
                <span>{country.code}</span>
                <strong>{country.name}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function PhoneNumberInput({
  autoComplete = 'tel',
  buttonLabel,
  className,
  disabled = false,
  inputLabel,
  onChange,
  placeholder = '0981152315',
  searchPlaceholder,
  value,
}: PhoneNumberInputProps) {
  const { countryInput, localPhone } = splitPhoneNumberValue(value)
  const rootClassName = className ? `phone-number-control ${className}` : 'phone-number-control'

  function updatePhone(countryCode: string, nextLocalPhone: string) {
    onChange(`${countryCode}${nextLocalPhone}`)
  }

  return (
    <div className={rootClassName}>
      <CountryCodePicker
        buttonLabel={buttonLabel}
        disabled={disabled}
        onChange={(countryCode) => updatePhone(countryCode, localPhone)}
        searchPlaceholder={searchPlaceholder}
        value={countryInput}
      />
      <input
        aria-label={inputLabel}
        autoComplete={autoComplete}
        disabled={disabled}
        inputMode="tel"
        onChange={(event) => updatePhone(countryInput, event.target.value)}
        placeholder={placeholder}
        type="tel"
        value={localPhone}
      />
    </div>
  )
}
