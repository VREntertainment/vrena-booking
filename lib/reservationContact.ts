import { parsePhoneNumberFromString } from 'libphonenumber-js/max'

export function reservationPhone(value: string) {
  if (!/^[+\d\s().-]+$/.test(value.trim())) return null
  const input = value.trim().replace(/^00/, '+')
  const phone = parsePhoneNumberFromString(input, 'VN')
  return phone?.isValid() ? phone.number : null
}

export function officialReservationContact(email: string | undefined, phone: string) {
  const normalized = reservationPhone(phone)
  return /@vre-vietnam\.com$/i.test(email?.trim() || '') || ['+84981152315', '+84981157039'].includes(normalized || '')
}

export function guestEmailIsValid(email: string | undefined) {
  return Boolean(email && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !email.trim().toLowerCase().endsWith('.invalid'))
}
