import type { NextRequest } from 'next/server'
import {
  authenticateStaffKioskRequest,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'
import { canConfigureStaffKioskPin, canRevealStaffKioskPin } from '@/lib/staffKioskScope'
import {
  isStaffKioskEligibleDepartment,
  STAFF_KIOSK_ELIGIBILITY_MESSAGE,
} from '@/lib/staffKioskDirectory'

export const runtime = 'nodejs'

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  const profileId = cleanString(request.nextUrl.searchParams.get('profileId'))
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return staffKioskJsonError('Choose an employee HR file.', 400)

  try {
    const [{ data: profile, error: profileError }, rank, { data: employee, error: employeeError }] = await Promise.all([
      auth.adminClient.from('profiles').select('role').eq('id', auth.user.id).maybeSingle(),
      staffKioskCurrentRank(auth),
      auth.adminClient
        .from('staff_employee_profiles')
        .select('department')
        .eq('profile_id', profileId)
        .eq('active', true)
        .is('deleted_at', null)
        .maybeSingle(),
    ])
    if (profileError) throw new Error(profileError.message)
    if (employeeError) throw new Error(employeeError.message)
    if (!canRevealStaffKioskPin(auth.user.email, profile?.role, rank)) {
      return staffKioskJsonError('Owner, Admin, or Office Staff access required.', 403)
    }
    if (!employee) return staffKioskJsonError('Active employee HR file not found.', 404)
    if (!isStaffKioskEligibleDepartment(employee.department)) {
      return staffKioskJsonError(STAFF_KIOSK_ELIGIBILITY_MESSAGE, 409)
    }

    const { data, error } = await auth.adminClient.rpc('staff_kiosk_reveal_pin', {
      p_actor_profile_id: auth.user.id,
      p_actor_user_id: auth.user.id,
      p_operator_token_hash: null,
      p_profile_id: profileId,
    })
    if (error) return staffKioskJsonError(error.message, 400)

    const result = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    return Response.json({
      available: result.available === true,
      pin: typeof result.pin === 'string' ? result.pin : null,
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    return staffKioskJsonError(error instanceof Error ? error.message : 'Could not load employee PIN.', 500)
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return staffKioskJsonError('Invalid PIN settings.', 400)
  }

  const profileId = cleanString(body.profileId)
  const pin = cleanString(body.pin)
  const accessRole = cleanString(body.accessRole)
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return staffKioskJsonError('Choose an employee HR file.', 400)
  if (!/^\d{6}$/.test(pin)) return staffKioskJsonError('PIN must contain exactly six digits.', 400)
  if (accessRole !== 'manager' && accessRole !== 'staff') return staffKioskJsonError('Choose Manager or Staff access.', 400)

  try {
    const rank = await staffKioskCurrentRank(auth)
    if (!canConfigureStaffKioskPin(auth.user.email, rank)) {
      return staffKioskJsonError('Sign in with an individual Owner or Admin account to manage employee PINs.', 403)
    }

    const { data: employee, error: employeeError } = await auth.adminClient
      .from('staff_employee_profiles')
      .select('department')
      .eq('profile_id', profileId)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle()
    if (employeeError) throw new Error(employeeError.message)
    if (!employee) return staffKioskJsonError('Active employee HR file not found.', 404)
    if (!isStaffKioskEligibleDepartment(employee.department)) {
      return staffKioskJsonError(STAFF_KIOSK_ELIGIBILITY_MESSAGE, 409)
    }

    const { data, error } = await auth.adminClient.rpc('staff_kiosk_configure_pin', {
      p_access_role: accessRole,
      p_actor_profile_id: auth.user.id,
      p_actor_user_id: auth.user.id,
      p_operator_token_hash: null,
      p_pin: pin,
      p_profile_id: profileId,
    })
    if (error) return staffKioskJsonError(error.message, 400)

    return Response.json({ operator: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return staffKioskJsonError(error instanceof Error ? error.message : 'Could not save employee PIN.', 500)
  }
}
