import { createClient } from '@supabase/supabase-js'
import type { StaffKioskAccessRole } from '../staffKioskScope'

export const STAFF_KIOSK_HEADER = 'x-vrena-operator-session'

let staffKioskOperatorToken = ''

export type StaffKioskOperator = {
  profileId: string
  employeeCode: string | null
  name: string
  jobTitle: string | null
  accessRole: StaffKioskAccessRole
  avatarEmoji: string | null
  avatarInitials: string | null
  avatarColor: string | null
  avatarTextColor: string | null
}

let staffKioskOperator: StaffKioskOperator | null = null

export function setStaffKioskOperatorToken(token: string) {
  staffKioskOperatorToken = token.trim()
  if (!staffKioskOperatorToken) staffKioskOperator = null
}

export function getStaffKioskOperatorToken() {
  return staffKioskOperatorToken
}

export function setStaffKioskOperator(operator: StaffKioskOperator | null) {
  staffKioskOperator = operator
  if (!operator) staffKioskOperatorToken = ''
}

export function getStaffKioskOperator() {
  return staffKioskOperatorToken ? staffKioskOperator : null
}

async function staffKioskAwareFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (staffKioskOperatorToken) headers.set(STAFF_KIOSK_HEADER, staffKioskOperatorToken)
  return globalThis.fetch(input, { ...init, headers })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    experimental: {
      passkey: true,
    },
  },
  global: {
    fetch: staffKioskAwareFetch,
  },
})
