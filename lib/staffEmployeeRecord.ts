export const staffEmployeeRecordEmploymentTypes = [
  'full_time',
  'part_time',
  'probation_full_time',
  'probation_part_time',
  'contractor',
  'intern',
] as const

export type StaffEmployeeRecordEmploymentType = (typeof staffEmployeeRecordEmploymentTypes)[number]

type StaffEmployeeRecordInput = {
  email?: unknown
  employmentType?: unknown
  fullName?: unknown
  phone?: unknown
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function validateStaffEmployeeRecord(input: StaffEmployeeRecordInput) {
  const fullName = cleanString(input.fullName)
  const email = cleanString(input.email).toLowerCase()
  const phone = cleanString(input.phone)
  const employmentType = cleanString(input.employmentType) as StaffEmployeeRecordEmploymentType

  if (!fullName) return { ok: false as const, error: 'Enter the employee name.' }
  if (fullName.length > 120) return { ok: false as const, error: 'Employee name is too long.' }
  if (email.length > 254) return { ok: false as const, error: 'Email is too long.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: 'Enter a valid email or leave it blank.' }
  }
  if (phone.length > 40) return { ok: false as const, error: 'Phone number is too long.' }
  if (!staffEmployeeRecordEmploymentTypes.includes(employmentType)) {
    return { ok: false as const, error: 'Choose a valid employment type.' }
  }

  return {
    ok: true as const,
    value: { email, employmentType, fullName, phone },
  }
}
