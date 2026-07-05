'use client'

import type { GuestTicketContact } from '../lib/guestTicketBooking'
import { PhoneNumberInput } from './CountryCodePicker'

type GuestTicketContactPanelProps = {
  contact: GuestTicketContact
  disabled: boolean
  estimatedLoyaltyPointsEarned: number
  onChange: (contact: GuestTicketContact) => void
  onPromptLogin: () => void
  text: Record<string, string>
}

export default function GuestTicketContactPanel({
  contact,
  disabled,
  estimatedLoyaltyPointsEarned,
  onChange,
  onPromptLogin,
  text,
}: GuestTicketContactPanelProps) {
  const loyaltyPointsText = String(Math.max(0, Math.floor(Number(estimatedLoyaltyPointsEarned) || 0)))

  return (
    <div className="guest-ticket-contact" aria-label={text.guestTicketTitle}>
      <div className="guest-ticket-copy">
        <strong>{text.guestTicketTitle}</strong>
        <span>{text.guestTicketBody}</span>
      </div>
      <div className="guest-ticket-phone-field">
        <span className="guest-ticket-phone-required" aria-hidden="true"><span className="required">*</span></span>
        <PhoneNumberInput
          autoComplete="tel-national"
          buttonLabel={text.countryCode}
          className="guest-ticket-phone-control"
          disabled={disabled}
          inputLabel={`${text.phone} *`}
          onChange={(phone) => onChange({ ...contact, phone })}
          placeholder="0981152315"
          searchPlaceholder={text.searchCountry}
          value={contact.phone}
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
      <p>{text.guestTicketAccountHint.replace('{points}', loyaltyPointsText)}</p>
      <button className="link-button" disabled={disabled} onClick={onPromptLogin} type="button">
        {text.guestTicketLoginLink}
      </button>
    </div>
  )
}
