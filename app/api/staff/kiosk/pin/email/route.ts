import type { NextRequest } from 'next/server'
import {
  authenticateStaffKioskRequest,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'
import { canRevealStaffKioskPin } from '@/lib/staffKioskScope'
import { maskEmailAddress, sendStaffPinEmail } from '@/lib/staffPinEmail'
import {
  isStaffKioskEligibleDepartment,
  STAFF_KIOSK_ELIGIBILITY_MESSAGE,
} from '@/lib/staffKioskDirectory'

export const runtime = 'nodejs'

const PIN_EMAIL_LIMIT = 3
const PIN_EMAIL_WINDOW_SECONDS = 15 * 60

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return staffKioskJsonError('Invalid employee PIN email request.', 400)
  }

  const profileId = cleanString(body.profileId)
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return staffKioskJsonError('Choose an employee HR file.', 400)

  try {
    const [{ data: actorProfile, error: actorError }, rank] = await Promise.all([
      auth.adminClient.from('profiles').select('role').eq('id', auth.user.id).maybeSingle(),
      staffKioskCurrentRank(auth),
    ])
    if (actorError) throw new Error(actorError.message)
    if (!canRevealStaffKioskPin(auth.user.email, actorProfile?.role, rank)) {
      return staffKioskJsonError('Owner, Admin, or Office Staff access required.', 403)
    }

    const { data: employee, error: employeeError } = await auth.adminClient
      .from('staff_employee_profiles')
      .select('profile_id, legal_name, personal_email, department, kiosk_access_role, kiosk_pin_configured_at, active, deleted_at')
      .eq('profile_id', profileId)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle()
    if (employeeError) throw new Error(employeeError.message)
    if (!employee) return staffKioskJsonError('Active employee HR file not found.', 404)
    if (!isStaffKioskEligibleDepartment(employee.department)) {
      return staffKioskJsonError(STAFF_KIOSK_ELIGIBILITY_MESSAGE, 409)
    }

    const recipientEmail = cleanString(employee.personal_email).toLowerCase()
    if (!validEmail(recipientEmail)) {
      return staffKioskJsonError('Save a valid personal email in this employee HR file first.', 409)
    }
    if (!employee.kiosk_pin_configured_at || (employee.kiosk_access_role !== 'manager' && employee.kiosk_access_role !== 'staff')) {
      return staffKioskJsonError('Create an employee PIN before sending it by email.', 409)
    }

    const { error: rateLimitError } = await auth.adminClient.rpc('consume_rate_limit', {
      p_action: 'employee_pin_email',
      p_limit: PIN_EMAIL_LIMIT,
      p_window_seconds: PIN_EMAIL_WINDOW_SECONDS,
      p_subject: `actor:${auth.user.id}:employee:${profileId}`,
    })
    if (rateLimitError) {
      const isRateLimited = rateLimitError.message.includes('Too many attempts')
      return staffKioskJsonError(
        isRateLimited
          ? 'This PIN was emailed recently. Please wait before sending it again.'
          : 'PIN email security checks are temporarily unavailable.',
        isRateLimited ? 429 : 503,
      )
    }

    const { data: revealed, error: revealError } = await auth.adminClient.rpc('staff_kiosk_reveal_pin', {
      p_actor_profile_id: auth.user.id,
      p_actor_user_id: auth.user.id,
      p_operator_token_hash: null,
      p_profile_id: profileId,
    })
    if (revealError) return staffKioskJsonError(revealError.message, 400)
    const pinResult = revealed && typeof revealed === 'object' ? revealed as Record<string, unknown> : {}
    const pin = typeof pinResult.pin === 'string' ? pinResult.pin : ''
    if (pinResult.available !== true || !/^\d{6}$/.test(pin)) {
      return staffKioskJsonError('No PIN is configured for this employee.', 409)
    }

    const recipientDomain = recipientEmail.split('@')[1] || ''
    const { error: requestAuditError } = await auth.adminClient.from('audit_logs').insert({
      actor_user_id: auth.user.id,
      auth_user_id: auth.user.id,
      action: 'kiosk_pin_email_requested',
      entity_type: 'staff_employee_profiles',
      entity_id: profileId,
      new_value: { recipient_domain: recipientDomain },
    })
    if (requestAuditError) throw new Error(requestAuditError.message)

    try {
      await sendStaffPinEmail({
        accessRole: employee.kiosk_access_role,
        employeeName: cleanString(employee.legal_name) || 'VRena employee',
        pin,
        recipientEmail,
      })
    } catch (emailError) {
      const unavailable = emailError instanceof Error && emailError.message === 'Employee PIN email is not configured.'
      return staffKioskJsonError(
        unavailable ? 'Employee PIN email is not configured.' : 'Could not send the employee PIN email. Please try again.',
        unavailable ? 503 : 502,
      )
    }

    const { error: deliveredAuditError } = await auth.adminClient.from('audit_logs').insert({
      actor_user_id: auth.user.id,
      auth_user_id: auth.user.id,
      action: 'kiosk_pin_emailed',
      entity_type: 'staff_employee_profiles',
      entity_id: profileId,
      new_value: { recipient_domain: recipientDomain },
    })
    if (deliveredAuditError) {
      console.warn('Employee PIN email sent but completion audit failed.', deliveredAuditError.code)
    }

    return Response.json({ ok: true, recipient: maskEmailAddress(recipientEmail) }, {
      headers: { 'Cache-Control': 'no-store, private' },
    })
  } catch (error) {
    console.error('Employee PIN email request failed.', error instanceof Error ? error.name : 'UnknownError')
    return staffKioskJsonError('Could not send employee PIN email.', 500)
  }
}
