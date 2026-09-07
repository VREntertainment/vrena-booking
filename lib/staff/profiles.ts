import { isStaffAdminOnlyEmail as isAdminOnlyEmail, isStaffOwnerEmail as isOwnerEmail, staffConsoleRoleRank as staffRank } from '../staffRoles.ts'
import { vrenaPalette } from '../theme/vrenaPalette.ts'
import type { StaffConsoleCopy } from './copy.ts'
import { staffConsoleText } from './copy.ts'
import { assignableWebAppRoleOptions } from './options.ts'
import type { SoftDeletedRecord, StaffEmployeeProfile, StaffProfile, StaffRole, StaffRoleSort } from './types.ts'

export function roleLabel(role?: string | null, email?: string | null): StaffRole {
  const normalizedRole = role?.toLowerCase()
  if (normalizedRole === 'employee' || normalizedRole === 'manager' || normalizedRole === 'staff') return 'employee'
  const rank = staffRank(role, email)
  if (rank >= 120) return 'owner'
  if (rank >= 100) return 'admin'
  if (normalizedRole === 'cashier') return 'cashier'
  if (rank >= 20) return 'viewer'
  return 'player'
}

export function storedRoleValue(role?: string | null, email?: string | null): StaffRole {
  const normalized = (role || '').toLowerCase()
  if (isOwnerEmail(email)) return 'owner'
  if (isAdminOnlyEmail(email) && (normalized === 'super_admin' || normalized === 'owner')) return 'admin'
  if (normalized === 'super_admin') return 'owner'
  if (normalized === 'manager' || normalized === 'staff') return 'employee'
  if (normalized === 'employee') return 'employee'
  return assignableWebAppRoleOptions.includes(normalized as StaffRole) ? normalized as StaffRole : 'player'
}

export function isDemoProfile(profile: StaffProfile) {
  const email = (profile.email || '').toLowerCase()
  const fullName = (profile.full_name || '').toLowerCase()
  const nickname = (profile.nickname || '').toLowerCase()
  return Boolean(
    profile.is_seed_demo ||
    profile.seed_batch ||
    email.includes('@vrena.demo') ||
    email.includes('.demo') ||
    email.startsWith('softlaunch-') ||
    /^demo(\s|-|_)/.test(fullName) ||
    /^demo(\s|-|_)/.test(nickname)
  )
}

export function staffRoleName(role: StaffRole, text: StaffConsoleCopy = staffConsoleText.en) {
  return text.roles[role]
}

export function staffRoleSortName(sort: StaffRoleSort, text: StaffConsoleCopy = staffConsoleText.en) {
  return text.roleSorts[sort]
}

export function customerName(profile: StaffProfile, text: StaffConsoleCopy = staffConsoleText.en) {
  if (profile.anonymous_mode) return profile.nickname || profile.anonymous_callsign || text.customerFallback
  return profile.nickname || profile.full_name || profile.phone || profile.email || text.customerFallback
}

export function staffProfileFromEmployee(employee: StaffEmployeeProfile, profilePhotoUrl = ''): StaffProfile {
  const fullName = employee.legal_name?.trim() || employee.employee_code?.trim() || 'Employee'
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return {
    id: employee.profile_id,
    created_at: employee.created_at,
    full_name: fullName,
    email: employee.personal_email,
    phone: employee.personal_phone,
    avatar_url: profilePhotoUrl || null,
    avatar_initials: initials || 'E',
    avatar_color: employee.kiosk_access_role === 'manager' ? vrenaPalette.purple[100] : vrenaPalette.cyan[50],
    avatar_text_color: employee.kiosk_access_role === 'manager' ? vrenaPalette.purple[700] : vrenaPalette.cyan[800],
    role: employee.kiosk_access_role === 'manager' ? 'manager' : 'staff',
  }
}

export function deletedRecordActorLabel(record: SoftDeletedRecord) {
  const name = record.deleted_by_name?.trim() || ''
  const contact = record.deleted_by_email?.trim() || record.deleted_by_phone?.trim() || ''
  if (name && contact && name !== contact) return `${name} · ${contact}`
  return name || contact || record.deleted_by || ''
}

export function normalizeStaffSearchValue(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

export function customerSearchText(profile: StaffProfile, text: StaffConsoleCopy = staffConsoleText.en) {
  return normalizeStaffSearchValue([
    customerName(profile, text),
    profile.full_name || '',
    profile.nickname || '',
    profile.phone || '',
    profile.email || '',
  ].join(' '))
}

export function staffRoleAvatarInitials(value: string) {
  const cleaned = value.trim()
  if (!cleaned || cleaned === '?') return 'PL'
  const words = cleaned.split(/\s+/).filter(Boolean)
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0] || '').join('')
    : Array.from(cleaned).slice(0, 2).join('')
  return letters.toUpperCase() || 'PL'
}

export function shouldSkipStaffImageOptimization(source: string | null | undefined) {
  const normalizedSource = source?.trim().toLowerCase() || ''
  return normalizedSource.startsWith('blob:') || normalizedSource.startsWith('data:') || normalizedSource.includes('/storage/v1/object/sign/') || /\.gif($|\?)/.test(normalizedSource)
}
