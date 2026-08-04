import type { NextRequest } from 'next/server'
import { resolveTrustedAppRedirect } from '@/lib/security/authRedirect'
import { trustedClientIp } from '@/lib/security/requestIp'
import {
  authenticateStaffKioskRequest,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'
import { canConfigureStaffKioskPin } from '@/lib/staffKioskScope'
import { validateStaffEmployeeInvite } from '@/lib/staffEmployeeInvite'

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

    const validation = validateStaffEmployeeInvite(body)
    if (!validation.ok) return staffKioskJsonError(validation.error, 400)
    const { email, employmentType, fullName, phone, role } = validation.value
    const adminClient = auth.adminClient
    const ip = trustedClientIp(request.headers)

    const { error: actorRateLimitError } = await adminClient.rpc('consume_rate_limit', {
      p_action: 'employee_invite_actor',
      p_limit: 8,
      p_window_seconds: 10 * 60,
      p_subject: `staff:${auth.user.id}:ip:${ip}`,
    })
    if (actorRateLimitError) return staffKioskJsonError(actorRateLimitError.message, 429)

    const { error: inviteRateLimitError } = await adminClient.rpc('consume_rate_limit', {
      p_action: 'employee_invite',
      p_limit: 4,
      p_window_seconds: 10 * 60,
      p_subject: `staff:${auth.user.id}:email:${email}:ip:${ip}`,
    })
    if (inviteRateLimitError) return staffKioskJsonError(inviteRateLimitError.message, 429)

    const redirect = resolveTrustedAppRedirect('/login')
    if (!redirect.ok) return staffKioskJsonError(redirect.message, redirect.status)

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirect.url,
      data: {
        created_by_staff_id: auth.user.id,
        display_name: fullName,
        full_name: fullName,
        name: fullName,
        phone: phone || null,
        staff_created: true,
      },
    })
    if (inviteError || !invited.user) {
      const message = errorMessage(inviteError) || 'Could not create employee account.'
      return staffKioskJsonError(message, /already|registered|exists/i.test(message) ? 409 : 400)
    }

    const profileId = invited.user.id
    const profilePayload = {
      id: profileId,
      email,
      full_name: fullName,
      phone: phone || null,
      role,
      updated_at: new Date().toISOString(),
    }
    const employeePayload = {
      active: true,
      created_by: auth.user.id,
      employment_type: employmentType,
      job_title: role === 'manager' ? 'Manager' : role === 'cashier' ? 'Office Staff' : 'Staff',
      legal_name: fullName,
      personal_email: email,
      personal_phone: phone || null,
      profile_id: profileId,
    }

    const { error: profileError } = await adminClient.from('profiles').upsert(profilePayload, { onConflict: 'id' })
    if (profileError) {
      await adminClient.auth.admin.deleteUser(profileId).catch(() => undefined)
      return staffKioskJsonError(profileError.message, 500)
    }

    const { data: employee, error: employeeError } = await adminClient
      .from('staff_employee_profiles')
      .upsert(employeePayload, { onConflict: 'profile_id' })
      .select('*')
      .single()
    if (employeeError) {
      await adminClient.from('profiles').delete().eq('id', profileId)
      await adminClient.auth.admin.deleteUser(profileId).catch(() => undefined)
      return staffKioskJsonError(employeeError.message, 500)
    }

    const { error: auditError } = await adminClient.from('audit_logs').insert({
      action: 'employee_invited',
      actor_user_id: auth.user.id,
      auth_user_id: auth.user.id,
      entity_id: profileId,
      entity_type: 'staff_employee_profiles',
      new_value: { email, employment_type: employmentType, full_name: fullName, role },
    })
    if (auditError) {
      return Response.json({ employee, profile: profilePayload, warning: auditError.message }, { status: 201 })
    }

    return Response.json({ employee, profile: profilePayload }, { status: 201 })
  } catch (error) {
    return staffKioskJsonError(errorMessage(error) || 'Could not create employee account.', 500)
  }
}
