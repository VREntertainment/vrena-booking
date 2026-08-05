import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import {
  staffKioskOperatorFromEmployee,
  type StaffKioskEmployeeDirectoryRow,
} from '../staffKioskDirectory'
import { hasVerifiedAal2Session, hasVerifiedMfaFactor } from './staffMfa'
import { requiresStaffKioskPin } from '../staffKioskScope'

export type { StaffKioskOperatorDirectoryItem } from '../staffKioskDirectory'

export const STAFF_KIOSK_HEADER = 'x-vrena-operator-session'

type StaffKioskAuth = {
  accessToken: string
  adminClient: SupabaseClient
  authClient: SupabaseClient
  operatorToken: string
  operatorTokenHash: string
  user: User
}

export function staffKioskJsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function staffKioskTokenHash(value: string) {
  return value ? createHash('sha256').update(value).digest('hex') : ''
}

export async function authenticateStaffKioskRequest(request: NextRequest): Promise<StaffKioskAuth | Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return staffKioskJsonError('Store operator access is not configured on this environment.', 503)
  }

  const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) return staffKioskJsonError('Staff session required.', 401)

  const operatorToken = (request.headers.get(STAFF_KIOSK_HEADER) || '').trim()
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(operatorToken ? { [STAFF_KIOSK_HEADER]: operatorToken } : {}),
      },
    },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
  if (userError || !userData.user) {
    return staffKioskJsonError(userError?.message || 'Staff session required.', 401)
  }

  const [hasAal2, hasMfaFactor] = await Promise.all([
    hasVerifiedAal2Session(authClient, accessToken),
    hasVerifiedMfaFactor(adminClient, userData.user.id),
  ])
  if (!requiresStaffKioskPin(userData.user.email) && (!hasAal2 || !hasMfaFactor)) {
    return staffKioskJsonError('Staff two-step verification required.', 403)
  }

  return {
    accessToken,
    adminClient,
    authClient,
    operatorToken,
    operatorTokenHash: staffKioskTokenHash(operatorToken),
    user: userData.user,
  }
}

export async function staffKioskCurrentRank(auth: StaffKioskAuth) {
  const { data, error } = await auth.authClient.rpc('current_staff_role_rank')
  if (error) throw new Error(error.message)
  return Number(data) || 0
}

export async function staffKioskCurrentActorProfileId(auth: StaffKioskAuth) {
  const { data, error } = await auth.authClient.rpc('current_staff_actor_profile_id')
  if (error) throw new Error(error.message)
  return typeof data === 'string' ? data : null
}

export async function staffKioskCurrentSessionId(auth: StaffKioskAuth) {
  const { data, error } = await auth.authClient.rpc('current_staff_operator_session_id')
  if (error) throw new Error(error.message)
  return typeof data === 'string' ? data : null
}

export async function loadStaffKioskOperatorDirectory(adminClient: SupabaseClient) {
  const { data: employees, error: employeeError } = await adminClient
    .from('staff_employee_profiles')
    .select('profile_id, employee_code, legal_name, job_title, kiosk_access_role, kiosk_pin_configured_at')
    .eq('active', true)
    .is('deleted_at', null)
    .order('legal_name', { ascending: true })
  if (employeeError) throw new Error(employeeError.message)

  return ((employees ?? []) as StaffKioskEmployeeDirectoryRow[]).map(staffKioskOperatorFromEmployee)
}
