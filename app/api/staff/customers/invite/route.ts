import { randomBytes, randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isValidStaffCustomerEmail, normalizePhonePasswordIdentifier, phonePasswordLoginEmail } from '@/lib/phonePasswordAccount'
import { PHONE_SETUP_TEMPORARY_PASSWORD_TTL_HOURS } from '@/lib/phoneAccountSetup'
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

const TEMPORARY_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

function temporaryPassword() {
  const characters = Array.from({ length: 12 }, () => TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)])
  return `${characters.slice(0, 4).join('')}-${characters.slice(4, 8).join('')}-${characters.slice(8).join('')}`
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
  const phoneAccount = !email
  const phone = phoneAccount ? normalizePhonePasswordIdentifier(submittedPhone) : submittedPhone

  if (!fullName) return jsonError('Enter the customer name.', 400)
  if (email && !isValidStaffCustomerEmail(email)) return jsonError('Enter a valid customer email.', 400)
  if (phoneAccount && !phone) return jsonError('Enter a valid customer phone number.', 400)

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

  const generatedTemporaryPassword = phoneAccount ? temporaryPassword() : ''
  const temporaryPasswordExpiresAt = phoneAccount
    ? new Date(Date.now() + PHONE_SETUP_TEMPORARY_PASSWORD_TTL_HOURS * 60 * 60 * 1000).toISOString()
    : null

  if (phoneAccount) {
    const { data: existingProfiles, error: existingProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .is('deleted_at', null)
      .limit(2)

    if (existingProfileError) return jsonError('Could not check this phone number.', 503)
    if ((existingProfiles?.length || 0) > 1) return jsonError('More than one account uses this phone number. Contact an administrator.', 409)

    const existingProfileId = existingProfiles?.[0]?.id
    if (existingProfileId) {
      const { data: existingAuth, error: existingAuthError } = await adminClient.auth.admin.getUserById(existingProfileId)
      if (existingAuthError || !existingAuth.user) return jsonError('Could not load the existing phone account.', 503)
      if (existingAuth.user.app_metadata?.phone_setup_required !== true) {
        return jsonError('This phone number already belongs to a completed account.', 409)
      }

      const { error: profileUpdateError } = await adminClient.from('profiles').update({
        full_name: fullName,
        nickname: nickname || null,
        updated_at: new Date().toISOString(),
      }).eq('id', existingProfileId)
      if (profileUpdateError) return jsonError(profileUpdateError.message, 500)

      const { error: rotateError } = await adminClient.auth.admin.updateUserById(existingProfileId, {
        password: generatedTemporaryPassword,
        user_metadata: { ...existingAuth.user.user_metadata, ...userMetadata },
        app_metadata: {
          ...existingAuth.user.app_metadata,
          phone_setup_expires_at: temporaryPasswordExpiresAt,
          phone_setup_email: null,
          phone_setup_token_hash: null,
          phone_setup_token_expires_at: null,
        },
      })
      if (rotateError) return jsonError('Could not generate a new temporary password.', 500)

      await adminClient.from('audit_logs').insert({
        actor_user_id: actorProfileId,
        auth_user_id: auth.user.id,
        operator_session_id: operatorSessionId,
        operator_role: operatorSessionId ? (actorRank >= 80 ? 'manager' : 'staff') : null,
        action: 'customer_phone_temporary_password_rotated',
        entity_type: 'profiles',
        entity_id: existingProfileId,
        new_value: { phone, phone_setup_required: true },
      })

      return NextResponse.json({
        profile: { id: existingProfileId, email: null, full_name: fullName, nickname: nickname || null, phone, role: 'player' },
        temporaryPassword: generatedTemporaryPassword,
        temporaryPasswordExpiresAt,
        message: 'A new temporary password was generated for the pending phone account.',
      })
    }
  }

  const invited = phoneAccount
    ? await adminClient.auth.admin.createUser({
        email: await phonePasswordLoginEmail(phone, randomBytes(16).toString('hex')),
        email_confirm: true,
        password: generatedTemporaryPassword,
        user_metadata: userMetadata,
        app_metadata: {
          login_identifier: 'phone_password',
          phone_verified: false,
          phone_setup_required: true,
          phone_setup_expires_at: temporaryPasswordExpiresAt,
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

  if (profileError) {
    if (phoneAccount) await adminClient.auth.admin.deleteUser(invited.data.user.id).catch(() => undefined)
    return jsonError(profileError.message, 500)
  }

  const { error: auditError } = await adminClient.from('audit_logs').insert({
    actor_user_id: actorProfileId,
    auth_user_id: auth.user.id,
    operator_session_id: operatorSessionId,
    operator_role: operatorSessionId ? (actorRank >= 80 ? 'manager' : 'staff') : null,
    action: phoneAccount ? 'customer_phone_account_created' : 'customer_invited',
    entity_type: 'profiles',
    entity_id: invited.data.user.id,
    new_value: phoneAccount
      ? { phone, full_name: fullName, phone_verified: false, phone_setup_required: true }
      : { email, full_name: fullName },
  })
  if (auditError) return jsonError(auditError.message, 500)

  return NextResponse.json({
    profile: profilePayload,
    temporaryPassword: phoneAccount ? generatedTemporaryPassword : null,
    temporaryPasswordExpiresAt,
    message: phoneAccount
      ? 'Phone account created. Give the temporary password to the customer for first login.'
      : 'Customer account created and password request sent.',
  })
}
