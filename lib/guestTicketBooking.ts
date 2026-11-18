import { reservationPhone, officialReservationContact } from './reservationContact.ts'
export type GuestTicketContact = {
  email?: string
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
  const normalizedPhone = reservationPhone(contact.phone) || ''

  if (!normalizedPhone) {
    return { normalizedPhone, error: contact.phone.trim() ? text.guestTicketPhoneInvalid : text.phoneRequired }
  }

  const digitCount = normalizedPhone.replace(/\D/g, '').length
  if (digitCount < 8 || digitCount > 15) {
    return { normalizedPhone, error: text.guestTicketPhoneInvalid }
  }

  if (officialReservationContact(contact.email, normalizedPhone)) return { normalizedPhone, error: text.reservationContactPersonal || 'Use your personal phone number and email, not VRena company contacts.' }
  return { normalizedPhone, error: '' }
}
