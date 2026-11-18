import { reservationPhoneRules } from './reservationPhoneRules.ts'

const phoneRules = reservationPhoneRules.map(([code, prefix, pattern]) => ({ code, prefix, pattern: new RegExp(`^(?:${pattern})$`) }))

export function reservationPhone(value: string) {
  const input = value.trim().replace(/^00/, '+')
  if (!/^\+?[\d\s().-]+$/.test(input)) return null
  let digits = input.replace(/\D/g, '')
  if (!input.startsWith('+')) {
    if (digits.startsWith('0')) digits = `84${digits.slice(1)}`
    else if (!digits.startsWith('84')) digits = `84${digits}`
  }
  if (digits.length > 16) return null
  for (const { code, prefix, pattern } of phoneRules) {
    if (!digits.startsWith(code)) continue
    const national = digits.slice(code.length)
    if (pattern.test(national)) return `+${code}${national}`
    if (['0', '1', '8'].includes(prefix) && national.startsWith(prefix) && pattern.test(national.slice(1))) return `+${code}${national.slice(1)}`
  }
  return null
}

export function officialReservationContact(email: string | undefined, phone: string) {
  const normalized = reservationPhone(phone)
  return /@vre-vietnam\.com$/i.test(email?.trim() || '') || ['+84981152315', '+84981157039'].includes(normalized || '')
}

export function guestEmailIsValid(email: string | undefined) {
  return Boolean(email && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !email.trim().toLowerCase().endsWith('.invalid'))
}
