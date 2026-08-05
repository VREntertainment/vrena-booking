export type StaffKioskOperatorDirectoryItem = {
  profileId: string
  employeeCode: string | null
  name: string
  jobTitle: string | null
  accessRole: 'manager' | 'staff' | null
  pinConfigured: boolean
  avatarEmoji: string | null
  avatarInitials: string | null
  avatarColor: string | null
  avatarTextColor: string | null
}

export type StaffKioskEmployeeDirectoryRow = {
  profile_id: string
  employee_code: string | null
  legal_name: string | null
  job_title: string | null
  kiosk_access_role: string | null
  kiosk_pin_configured_at: string | null
}

function employeeInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase()
}

export function staffKioskOperatorFromEmployee(
  employee: StaffKioskEmployeeDirectoryRow,
): StaffKioskOperatorDirectoryItem {
  const accessRole = employee.kiosk_access_role === 'manager' || employee.kiosk_access_role === 'staff'
    ? employee.kiosk_access_role
    : null
  const name = employee.legal_name?.trim() || employee.employee_code?.trim() || 'Employee'

  return {
    profileId: employee.profile_id,
    employeeCode: employee.employee_code,
    name,
    jobTitle: employee.job_title,
    accessRole,
    pinConfigured: Boolean(employee.kiosk_pin_configured_at && accessRole),
    avatarEmoji: null,
    avatarInitials: employeeInitials(name),
    avatarColor: '#f3f4f6',
    avatarTextColor: '#111827',
  }
}
