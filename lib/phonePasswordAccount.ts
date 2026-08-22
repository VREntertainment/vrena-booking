const DEFAULT_COUNTRY_CODE = '+84'
const PHONE_LOGIN_DOMAIN = 'phone-login.vrena.invalid'

export function isValidStaffCustomerEmail(value: string) {
  if (!value || value.length > 254) return false

  let atIndex = -1
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index)
    if (characterCode <= 32 || characterCode === 127) return false
    if (value[index] !== '@') continue
    if (atIndex !== -1) return false
    atIndex = index
  }

  if (atIndex <= 0 || atIndex > 64 || atIndex >= value.length - 3) return false
  const domain = value.slice(atIndex + 1)
  const finalDotIndex = domain.lastIndexOf('.')
  return finalDotIndex > 0 && finalDotIndex < domain.length - 1
}

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

export async function phonePasswordLoginEmail(phone: string, accountSalt = '') {
  const normalizedPhone = normalizePhonePasswordIdentifier(phone)
  if (!normalizedPhone) throw new Error('Enter a valid phone number.')

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`vrena-phone-login:${normalizedPhone}:${accountSalt}`),
  )
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `phone-${hash.slice(0, 48)}@${PHONE_LOGIN_DOMAIN}`
}
