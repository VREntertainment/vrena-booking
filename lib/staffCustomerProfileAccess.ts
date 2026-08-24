export function isStaffCustomerProfile(role: unknown, hasEmployeeRecord: boolean) {
  if (hasEmployeeRecord) return false
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : ''
  return normalizedRole === '' || normalizedRole === 'player'
}
