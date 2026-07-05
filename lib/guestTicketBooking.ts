export type GuestTicketContact = {
  name: string
  phone: string
}

export type GuestTicketContactValidation = {
  normalizedPhone: string
  error: string
}

export function normalizeGuestTicketPhone(value: string) {
  return value
    .trim()
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '')
}

export function validateGuestTicketContact(
  contact: GuestTicketContact,
  text: Record<string, string>,
): GuestTicketContactValidation {
  const normalizedPhone = normalizeGuestTicketPhone(contact.phone)

  if (!normalizedPhone) {
    return { normalizedPhone, error: text.phoneRequired }
  }

  const digitCount = normalizedPhone.replace(/\D/g, '').length
  if (digitCount < 8 || digitCount > 15) {
    return { normalizedPhone, error: text.guestTicketPhoneInvalid }
  }

  return { normalizedPhone, error: '' }
}
