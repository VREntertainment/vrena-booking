import { NextRequest, NextResponse } from 'next/server'
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
  const phone = cleanString(body.phone)
  const nickname = cleanString(body.nickname)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Enter a valid customer email.', 400)
  if (!fullName) return jsonError('Enter the customer name.', 400)

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
    p_subject: `staff:${auth.user.id}:email:${email}:ip:${ip}`,
  })

  if (rateLimitError) {
    return jsonError(rateLimitError.message || 'Too many attempts. Please wait a moment and try again.', 429)
  }

  const redirect = resolveTrustedAppRedirect('/login')
  if (!redirect.ok) {
    return jsonError(redirect.message, redirect.status)
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirect.url,
    data: {
      full_name: fullName,
      name: fullName,
      display_name: nickname || fullName,
      nickname: nickname || null,
      phone: phone || null,
      staff_created: true,
      created_by_staff_id: actorProfileId,
    },
  })

  if (inviteError || !invited.user) {
    const message = errorMessage(inviteError) || 'Could not create customer account.'
    const status = /already|registered|exists/i.test(message) ? 409 : 400
    return jsonError(message, status)
  }

  const profilePayload = {
    id: invited.user.id,
    email,
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
    action: 'customer_invited',
    entity_type: 'profiles',
    entity_id: invited.user.id,
    new_value: { email, full_name: fullName },
  })
  if (auditError) return jsonError(auditError.message, 500)

  return NextResponse.json({
    profile: profilePayload,
    message: 'Customer account created and password request sent.',
  })
}
