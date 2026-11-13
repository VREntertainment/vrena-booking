import { isValidStaffCustomerEmail } from './phonePasswordAccount.ts'

// Phone-only and guest identities may contain a synthetic login address.
export function needsBookingEmail(email: string | null | undefined) {
  const value = email?.trim() || ''
  return !isValidStaffCustomerEmail(value) || value.toLowerCase().endsWith('.invalid')
}
