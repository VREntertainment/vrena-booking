export const STAFF_OWNER_EMAILS: readonly string[] = ['emilejacquet@icloud.com']
export const STAFF_ADMIN_ONLY_EMAILS: readonly string[] = ['emile@vre-vietnam.com', 'contact@vre-vietnam.com']
export const STAFF_ADMIN_EMAILS: readonly string[] = [...STAFF_OWNER_EMAILS, ...STAFF_ADMIN_ONLY_EMAILS]

export function isStaffAdminEmail(email?: string | null) {
  return Boolean(email && STAFF_ADMIN_EMAILS.includes(email.toLowerCase()))
}

export function isStaffOwnerEmail(email?: string | null) {
  return Boolean(email && STAFF_OWNER_EMAILS.includes(email.toLowerCase()))
}

export function isStaffAdminOnlyEmail(email?: string | null) {
  return Boolean(email && STAFF_ADMIN_ONLY_EMAILS.includes(email.toLowerCase()))
}

export function defaultStaffRoleForEmail(email?: string | null) {
  const normalizedEmail = email?.toLowerCase() || ''
  if (isStaffOwnerEmail(normalizedEmail)) return 'owner'
  if (isStaffAdminEmail(normalizedEmail)) return 'admin'
  return 'player'
}

export function isStaffAdminRole(role?: string | null) {
  const normalizedRole = role?.toLowerCase()
  return normalizedRole === 'super_admin' || normalizedRole === 'owner' || normalizedRole === 'admin'
}

export function staffRoleRank(role?: string | null, email?: string | null) {
  const normalizedRole = role?.toLowerCase() || ''
  if (isStaffOwnerEmail(email)) return 120
  if (isStaffAdminOnlyEmail(email)) return 100
  if (normalizedRole === 'super_admin' || normalizedRole === 'owner') return 120
  if (normalizedRole === 'admin') return 100
  if (normalizedRole === 'manager') return 80
  if (normalizedRole === 'staff' || normalizedRole === 'cashier') return 50
  if (normalizedRole === 'viewer') return 20
  return 0
}

export function staffConsoleRoleRank(role?: string | null, email?: string | null) {
  const normalizedRole = role?.toLowerCase() || ''
  if (isStaffOwnerEmail(email)) return 120
  if (isStaffAdminOnlyEmail(email)) return 100
  if (normalizedRole === 'super_admin' || normalizedRole === 'owner') return 120
  if (normalizedRole === 'admin') return 100
  if (normalizedRole === 'manager') return 80
  if (normalizedRole === 'staff') return 50
  if (normalizedRole === 'cashier' || normalizedRole === 'viewer') return 20
  return 0
}
