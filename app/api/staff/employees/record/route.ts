import type { NextRequest } from 'next/server'
import { trustedClientIp } from '@/lib/security/requestIp'
import {
  authenticateStaffKioskRequest,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'
import { validateStaffEmployeeRecord } from '@/lib/staffEmployeeRecord'
import { canConfigureStaffKioskPin } from '@/lib/staffKioskScope'

export const runtime = 'nodejs'

function errorMessage(value: unknown) {
  if (value instanceof Error) return value.message
  if (value && typeof value === 'object' && 'message' in value) {
    return String((value as { message?: unknown }).message || '')
  }
  return ''
}

export async function POST(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  try {
    const rank = await staffKioskCurrentRank(auth)
    if (!canConfigureStaffKioskPin(auth.user.email, rank)) {
      return staffKioskJsonError('Sign in with an individual Owner or Admin account to create employees.', 403)
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return staffKioskJsonError('Invalid employee details.', 400)
    }

    const validation = validateStaffEmployeeRecord(body)
    if (!validation.ok) return staffKioskJsonError(validation.error, 400)
    const { email, employmentType, fullName, phone } = validation.value
    const adminClient = auth.adminClient
    const ip = trustedClientIp(request.headers)

    const { error: rateLimitError } = await adminClient.rpc('consume_rate_limit', {
      p_action: 'employee_hr_record',
      p_limit: 8,
      p_window_seconds: 10 * 60,
      p_subject: `staff:${auth.user.id}:ip:${ip}`,
    })
    if (rateLimitError) return staffKioskJsonError(rateLimitError.message, 429)

    const { data, error } = await adminClient.rpc('staff_hr_create_employee_record', {
      p_actor_user_id: auth.user.id,
      p_employment_type: employmentType,
      p_full_name: fullName,
      p_personal_email: email || null,
      p_personal_phone: phone || null,
    })
    if (error) return staffKioskJsonError(error.message, 400)

    const result = data as { employee?: unknown; profile?: unknown } | null
    if (!result?.employee || !result.profile) {
      return staffKioskJsonError('Could not create the employee HR record.', 500)
    }

    return Response.json(result, { status: 201 })
  } catch (error) {
    return staffKioskJsonError(errorMessage(error) || 'Could not create the employee HR record.', 500)
  }
}
