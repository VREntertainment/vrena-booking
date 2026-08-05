export const STAFF_KIOSK_EMAIL = 'contact@vre-vietnam.com'

export function normalizedStaffKioskEmail(email?: string | null) {
  return email?.trim().toLowerCase() || ''
}

export function requiresStaffKioskPin(email?: string | null) {
  return normalizedStaffKioskEmail(email) === STAFF_KIOSK_EMAIL
}

export function normalizedStaffKioskPin(value: string) {
  return value.replace(/\D/g, '').slice(0, 6)
}

export function isCompleteStaffKioskPin(value: string) {
  return /^\d{6}$/.test(value)
}

export function shouldAutoUnlockStaffKioskPin(value: string, pinAvailable: boolean) {
  return pinAvailable && isCompleteStaffKioskPin(value)
}

export type StaffKioskAccessRole = 'manager' | 'staff'

export function canStaffKioskOperatorAccessStaff(role?: StaffKioskAccessRole | null) {
  return role === 'manager' || role === 'staff'
}

export function canStaffKioskOperatorAccessHr(role?: StaffKioskAccessRole | null) {
  return role === 'manager'
}

type StaffConsoleEntry = {
  authEmail?: string | null
  hasVerifiedMfaFactor: boolean
  mfaAssuranceLevel?: string | null
  profileRank: number
}

type StaffHrAccessContext = {
  authEmail?: string | null
  role?: string | null
  roleRank: number
}

export function canEnterStaffConsole({
  authEmail,
  hasVerifiedMfaFactor,
  mfaAssuranceLevel,
  profileRank,
}: StaffConsoleEntry) {
  if (requiresStaffKioskPin(authEmail)) return true
  if (profileRank < 20) return false
  return hasVerifiedMfaFactor && mfaAssuranceLevel === 'aal2'
}

export function canAccessHrConsole({ authEmail, roleRank }: StaffHrAccessContext) {
  return !requiresStaffKioskPin(authEmail) && roleRank >= 20
}

export function canAccessZaloHrSettings(context: StaffHrAccessContext) {
  return canAccessHrConsole(context) && context.roleRank >= 100
}

export function canAccessCoreHrSettings(context: StaffHrAccessContext) {
  return canAccessHrConsole(context)
    && (context.roleRank >= 100 || context.role?.trim().toLowerCase() === 'cashier')
}

export function accessibleStaffHrTabs<T extends string>(
  tabs: readonly T[],
  access: { canAccessHrSettings: boolean; canAccessZaloSettings: boolean },
) {
  return tabs.filter((tab) => (
    (tab !== 'zalo' || access.canAccessZaloSettings)
    && (tab !== 'settings' || access.canAccessHrSettings)
  ))
}

export function canConfigureStaffKioskPin(email: string | null | undefined, roleRank: number) {
  return !requiresStaffKioskPin(email) && roleRank >= 100
}

export function canRevealStaffKioskPin(email: string | null | undefined, role: string | null | undefined, roleRank: number) {
  return !requiresStaffKioskPin(email) && (roleRank >= 100 || role?.trim().toLowerCase() === 'cashier')
}
