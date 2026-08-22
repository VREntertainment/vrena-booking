import { NextRequest, NextResponse } from 'next/server'
import { isValidStaffCustomerEmail, normalizePhonePasswordIdentifier, phonePasswordLoginEmail } from '@/lib/phonePasswordAccount'
import { resolveTrustedAppRedirect } from '@/lib/security/authRedirect'
import { trustedClientIp } from '@/lib/security/requestIp'
import { authenticateStaffKioskRequest, staffKioskCurrentActorProfileId, staffKioskCurrentRank, staffKioskCurrentSessionId } from '@/lib/security/staffKioskServer'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value: unknown) {
  return cleanString(value).toLowerCase()
}

function errorMessage(value: unknown) {
  if (value instanceof Error) return value.message
  if (value && typeof value === 'object' && 'message' in value) return String((value as { message?: unknown }).message || '')
  return ''
}

export async function POST(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth
  const actorRank = await staffKioskCurrentRank(auth)
  if (actorRank < 50) return jsonError('Staff access required.', 403)
  const adminClient = auth.adminClient
  const actorProfileId = await staffKioskCurrentActorProfileId(auth) || auth.user.id
  const operatorSessionId = await staffKioskCurrentSessionId(auth)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid customer payload.', 400)
  }

  const email = normalizeEmail(body.email)
  const fullName = cleanString(body.fullName)
  const submittedPhone = cleanString(body.phone)
  const nickname = cleanString(body.nickname)
  const password = typeof body.password === 'string' ? body.password : ''
  const phoneAccount = !email
  const phone = phoneAccount ? normalizePhonePasswordIdentifier(submittedPhone) : submittedPhone

  if (!fullName) return jsonError('Enter the customer name.', 400)
  if (email && !isValidStaffCustomerEmail(email)) return jsonError('Enter a valid customer email.', 400)
  if (phoneAccount && !phone) return jsonError('Enter a valid customer phone number.', 400)
  if (phoneAccount && password.length < 6) return jsonError('Password must be at least 6 characters.', 400)
  if (phoneAccount && password.length > 128) return jsonError('Password must be 128 characters or fewer.', 400)

  const ip = trustedClientIp(request.headers)
  const { error: actorRateLimitError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'customer_invite_actor',
    p_limit: 10,
    p_window_seconds: 10 * 60,
    p_subject: `staff:${auth.user.id}:ip:${ip}`,
  })

  if (actorRateLimitError) {
    return jsonError(actorRateLimitError.message || 'Too many attempts. Please wait a moment and try again.', 429)
  }

  const { error: rateLimitError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'customer_invite',
    p_limit: 5,
    p_window_seconds: 10 * 60,
    p_subject: `staff:${auth.user.id}:${phoneAccount ? `phone:${phone}` : `email:${email}`}:ip:${ip}`,
  })

  if (rateLimitError) {
    return jsonError(rateLimitError.message || 'Too many attempts. Please wait a moment and try again.', 429)
  }

  const userMetadata = {
    full_name: fullName,
    name: fullName,
    display_name: nickname || fullName,
    nickname: nickname || null,
    phone: phone || null,
    staff_created: true,
    created_by_staff_id: actorProfileId,
  }

  const redirect = phoneAccount ? null : resolveTrustedAppRedirect('/login')
  if (redirect && !redirect.ok) return jsonError(redirect.message, redirect.status)

  const invited = phoneAccount
    ? await adminClient.auth.admin.createUser({
        email: await phonePasswordLoginEmail(phone),
        email_confirm: true,
        password,
        user_metadata: userMetadata,
        app_metadata: {
          login_identifier: 'phone_password',
          phone_verified: false,
        },
      })
    : await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirect!.url,
        data: userMetadata,
      })

  const inviteError = invited.error

  if (inviteError || !invited.data.user) {
    const message = errorMessage(inviteError) || 'Could not create customer account.'
    const status = /already|registered|exists/i.test(message) ? 409 : 400
    return jsonError(message, status)
  }

  const profilePayload = {
    id: invited.data.user.id,
    email: email || null,
    full_name: fullName,
    nickname: nickname || null,
    phone: phone || null,
    role: 'player',
    updated_at: new Date().toISOString(),
  }
  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })

  if (profileError) return jsonError(profileError.message, 500)

  const { error: auditError } = await adminClient.from('audit_logs').insert({
    actor_user_id: actorProfileId,
    auth_user_id: auth.user.id,
    operator_session_id: operatorSessionId,
    operator_role: operatorSessionId ? (actorRank >= 80 ? 'manager' : 'staff') : null,
    action: phoneAccount ? 'customer_phone_account_created' : 'customer_invited',
    entity_type: 'profiles',
    entity_id: invited.data.user.id,
    new_value: phoneAccount
      ? { phone, full_name: fullName, phone_verified: false }
      : { email, full_name: fullName },
  })
  if (auditError) return jsonError(auditError.message, 500)

  return NextResponse.json({
    profile: profilePayload,
    message: phoneAccount
      ? 'Phone account created. No SMS verification or recovery was enabled.'
      : 'Customer account created and password request sent.',
  })
}
