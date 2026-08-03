import { createClient } from '@supabase/supabase-js'

export const STAFF_KIOSK_HEADER = 'x-vrena-operator-session'

let staffKioskOperatorToken = ''

export function setStaffKioskOperatorToken(token: string) {
  staffKioskOperatorToken = token.trim()
}

export function getStaffKioskOperatorToken() {
  return staffKioskOperatorToken
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
