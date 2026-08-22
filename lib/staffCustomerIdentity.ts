export function cleanStaffCustomerText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeOptionalStaffCustomerEmail(value: unknown) {
  const email = cleanStaffCustomerText(value).toLowerCase()
  return email || null
}

export function normalizeStaffCustomerNickname(value: unknown) {
  return cleanStaffCustomerText(value)
}

export function isStaffCustomerNicknameConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; message?: unknown }
  const message = typeof record.message === 'string' ? record.message : ''
  return record.code === '23505'
    && /nickname|profiles_active_nickname_identity_idx/i.test(message)
}
