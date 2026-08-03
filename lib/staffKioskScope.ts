export const STAFF_KIOSK_EMAIL = 'contact@vre-vietnam.com'

export function normalizedStaffKioskEmail(email?: string | null) {
  return email?.trim().toLowerCase() || ''
}

export function requiresStaffKioskPin(email?: string | null) {
  return normalizedStaffKioskEmail(email) === STAFF_KIOSK_EMAIL
}

export function shouldRedirectStaffKioskToPin(email: string | null | undefined, activeView: string) {
  return requiresStaffKioskPin(email) && activeView !== 'staff' && activeView !== 'hr'
}

type StaffConsoleEntry = {
  authEmail?: string | null
  hasVerifiedMfaFactor: boolean
  mfaAssuranceLevel?: string | null
  profileRank: number
}

export function canEnterStaffConsole({
  authEmail,
  hasVerifiedMfaFactor,
  mfaAssuranceLevel,
  profileRank,
}: StaffConsoleEntry) {
  if (profileRank < 20) return false
  if (requiresStaffKioskPin(authEmail)) return true
  return hasVerifiedMfaFactor && mfaAssuranceLevel === 'aal2'
}

export function canConfigureStaffKioskPin(email: string | null | undefined, roleRank: number) {
  return !requiresStaffKioskPin(email) && roleRank >= 100
}

export function canRevealStaffKioskPin(email: string | null | undefined, role: string | null | undefined, roleRank: number) {
  return !requiresStaffKioskPin(email) && (roleRank >= 100 || role?.trim().toLowerCase() === 'cashier')
}
