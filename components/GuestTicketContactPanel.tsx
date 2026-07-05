'use client'

import type { GuestTicketContact } from '../lib/guestTicketBooking'

type GuestTicketContactPanelProps = {
  contact: GuestTicketContact
  disabled: boolean
  onChange: (contact: GuestTicketContact) => void
  onPromptLogin: () => void
  text: Record<string, string>
}

export default function GuestTicketContactPanel({
  contact,
  disabled,
  onChange,
  onPromptLogin,
  text,
}: GuestTicketContactPanelProps) {
  return (
    <div className="guest-ticket-contact" aria-label={text.guestTicketTitle}>
      <div className="guest-ticket-copy">
        <strong>{text.guestTicketTitle}</strong>
        <span>{text.guestTicketBody}</span>
      </div>
      <label>
        <span>{text.phone} <span className="required">*</span></span>
        <input
          autoComplete="tel"
          disabled={disabled}
          inputMode="tel"
          onChange={(event) => onChange({ ...contact, phone: event.target.value })}
          placeholder={text.guestTicketPhonePlaceholder}
          type="tel"
          value={contact.phone}
        />
      </label>
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
