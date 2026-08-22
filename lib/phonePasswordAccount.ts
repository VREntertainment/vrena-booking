const DEFAULT_COUNTRY_CODE = '+84'
const PHONE_LOGIN_DOMAIN = 'phone-login.vrena.invalid'

export function normalizePhonePasswordIdentifier(value: string, defaultCountryCode = DEFAULT_COUNTRY_CODE) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  let normalized = trimmed
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '')

  if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`

  if (!normalized.startsWith('+')) {
    const digits = normalized.replace(/\D/g, '')
    if (!digits) return ''
    const defaultCountryDigits = defaultCountryCode.replace(/\D/g, '')
    normalized = digits.startsWith(defaultCountryDigits)
      ? `+${digits}`
      : digits.startsWith('0')
      ? `${defaultCountryCode}${digits.slice(1)}`
      : `${defaultCountryCode}${digits}`
  }

  if (normalized.startsWith(`${defaultCountryCode}0`)) {
    normalized = `${defaultCountryCode}${normalized.slice(defaultCountryCode.length).replace(/^0+/, '')}`
  }

  const digitCount = normalized.replace(/\D/g, '').length
  return digitCount >= 8 && digitCount <= 15 ? normalized : ''
}

export function isPhonePasswordLoginEmail(value: string | null | undefined) {
  return Boolean(value?.toLowerCase().endsWith(`@${PHONE_LOGIN_DOMAIN}`))
}

export async function phonePasswordLoginEmail(phone: string) {
  const normalizedPhone = normalizePhonePasswordIdentifier(phone)
  if (!normalizedPhone) throw new Error('Enter a valid phone number.')

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`vrena-phone-login:${normalizedPhone}`),
  )
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `phone-${hash.slice(0, 48)}@${PHONE_LOGIN_DOMAIN}`
}
