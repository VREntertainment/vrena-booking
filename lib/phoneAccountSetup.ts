export const PHONE_SETUP_TOKEN_TTL_MINUTES = 30
export const PHONE_SETUP_TEMPORARY_PASSWORD_TTL_HOURS = 24
export const PHONE_SETUP_MINIMUM_PASSWORD_LENGTH = 8

export type PhoneSetupAppMetadata = Record<string, unknown> & {
  login_identifier?: string
  phone_setup_required?: boolean
  phone_setup_expires_at?: string | null
  phone_setup_email?: string | null
  phone_setup_token_hash?: string | null
  phone_setup_token_expires_at?: string | null
}

export function isPendingPhoneAccountSetup(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return false
  const value = metadata as PhoneSetupAppMetadata
  return value.login_identifier === 'phone_password' && value.phone_setup_required === true
}

export function normalizePhoneSetupEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!email || email.length > 254) return ''

  let atIndex = -1
  for (let index = 0; index < email.length; index += 1) {
    const characterCode = email.charCodeAt(index)
    if (characterCode <= 32 || characterCode === 127) return ''
    if (email[index] !== '@') continue
    if (atIndex !== -1) return ''
    atIndex = index
  }

  if (atIndex <= 0 || atIndex > 64 || atIndex >= email.length - 3) return ''
  const domain = email.slice(atIndex + 1)
  const finalDotIndex = domain.lastIndexOf('.')
  return finalDotIndex > 0 && finalDotIndex < domain.length - 1 ? email : ''
}

export function isValidPhoneSetupPassword(password: string) {
  return password.length >= PHONE_SETUP_MINIMUM_PASSWORD_LENGTH && password.length <= 128
}

export function phoneSetupTemporaryPasswordExpired(metadata: unknown, now = new Date()) {
  if (!metadata || typeof metadata !== 'object') return true
  const rawExpiry = (metadata as PhoneSetupAppMetadata).phone_setup_expires_at
  if (typeof rawExpiry !== 'string') return true
  const expiry = new Date(rawExpiry)
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()
}

export function maskPhoneSetupEmail(email: string) {
  const [localPart, domain] = email.trim().toLowerCase().split('@')
  if (!localPart || !domain) return ''
  const visible = localPart.slice(0, Math.min(2, localPart.length))
  return `${visible}${'•'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`
}
