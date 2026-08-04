export const staffEmployeeInviteRoles = ['manager', 'staff', 'cashier'] as const
export type StaffEmployeeInviteRole = (typeof staffEmployeeInviteRoles)[number]

export const staffEmployeeInviteEmploymentTypes = [
  'full_time',
  'part_time',
  'probation_full_time',
  'probation_part_time',
  'contractor',
  'intern',
] as const
export type StaffEmployeeInviteEmploymentType = (typeof staffEmployeeInviteEmploymentTypes)[number]

type StaffEmployeeInviteInput = {
  email?: unknown
  employmentType?: unknown
  fullName?: unknown
  phone?: unknown
  role?: unknown
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateStaffEmployeeInvite(input: StaffEmployeeInviteInput) {
  const fullName = cleanString(input.fullName)
  const email = cleanString(input.email).toLowerCase()
  const phone = cleanString(input.phone)
  const role = cleanString(input.role) as StaffEmployeeInviteRole
  const employmentType = cleanString(input.employmentType) as StaffEmployeeInviteEmploymentType

  if (!fullName) return { ok: false as const, error: 'Enter the employee name.' }
  if (fullName.length > 120) return { ok: false as const, error: 'Employee name is too long.' }
  if (email.length > 254) return { ok: false as const, error: 'Work email is too long.' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: 'Enter a valid work email.' }
  }
  if (phone.length > 40) return { ok: false as const, error: 'Phone number is too long.' }
  if (!staffEmployeeInviteRoles.includes(role)) {
    return { ok: false as const, error: 'Choose Staff, Manager, or Office Staff.' }
  }
  if (!staffEmployeeInviteEmploymentTypes.includes(employmentType)) {
    return { ok: false as const, error: 'Choose a valid employment type.' }
  }

  return {
    ok: true as const,
    value: { email, employmentType, fullName, phone, role },
  }
}
