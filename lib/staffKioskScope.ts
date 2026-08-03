export const STAFF_KIOSK_EMAIL = 'contact@vre-vietnam.com'

export function normalizedStaffKioskEmail(email?: string | null) {
  return email?.trim().toLowerCase() || ''
}

export function requiresStaffKioskPin(email?: string | null) {
  return normalizedStaffKioskEmail(email) === STAFF_KIOSK_EMAIL
}
