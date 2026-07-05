'use client'

import { useMemo, useState } from 'react'
import { countries } from '../lib/bookingStaticData'
import type { GuestTicketContact } from '../lib/guestTicketBooking'

type GuestTicketContactPanelProps = {
  contact: GuestTicketContact
  disabled: boolean
  onChange: (contact: GuestTicketContact) => void
  onPromptLogin: () => void
  text: Record<string, string>
}

function splitGuestTicketPhone(phone: string) {
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

export default function GuestTicketContactPanel({
  contact,
  disabled,
  onChange,
  onPromptLogin,
  text,
}: GuestTicketContactPanelProps) {
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const phoneParts = splitGuestTicketPhone(contact.phone)
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase()
    if (!query) return countries
    return countries.filter((country) => `${country.code} ${country.name}`.toLowerCase().includes(query))
  }, [countrySearch])

  function updatePhone(countryCode: string, localPhone: string) {
    onChange({ ...contact, phone: `${countryCode}${localPhone}` })
  }

  return (
    <div className="guest-ticket-contact" aria-label={text.guestTicketTitle}>
      <div className="guest-ticket-copy">
        <strong>{text.guestTicketTitle}</strong>
        <span>{text.guestTicketBody}</span>
      </div>
      <div className="guest-ticket-phone-row">
        <div className="guest-ticket-country-picker">
          <button
            aria-label={text.countryCode}
            className="guest-ticket-country-button"
            disabled={disabled}
            onClick={() => setCountryPickerOpen((open) => !open)}
            type="button"
          >
            {phoneParts.countryInput}
          </button>
          {countryPickerOpen && (
            <div className="guest-ticket-country-menu">
              <input
                autoFocus
                onChange={(event) => setCountrySearch(event.target.value)}
                placeholder={text.searchCountry}
                value={countrySearch}
              />
              <div className="guest-ticket-country-list">
                {filteredCountries.map((country) => (
                  <button
                    key={`${country.code}-${country.name}`}
                    onClick={() => {
                      updatePhone(country.code, phoneParts.localPhone)
                      setCountrySearch('')
                      setCountryPickerOpen(false)
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
        <input
          aria-label={`${text.phone} *`}
          autoComplete="tel-national"
          className="guest-ticket-phone-input"
          disabled={disabled}
          inputMode="tel"
          onChange={(event) => updatePhone(phoneParts.countryInput, event.target.value)}
          placeholder="0981152315"
          type="tel"
          value={phoneParts.localPhone}
        />
      </div>
      <label>
        <span>{text.name} <small>{text.optional}</small></span>
        <input
          autoComplete="name"
          disabled={disabled}
          onChange={(event) => onChange({ ...contact, name: event.target.value })}
          placeholder={text.guestTicketNamePlaceholder}
          type="text"
          value={contact.name}
        />
      </label>
      <p>{text.guestTicketAccountHint}</p>
      <button className="link-button" disabled={disabled} onClick={onPromptLogin} type="button">
        {text.guestTicketLoginLink}
      </button>
    </div>
  )
}
