import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveTrustedAppRedirect } from '@/lib/security/authRedirect'
import { trustedClientIp } from '@/lib/security/requestIp'
import { staffConsoleRoleRank as staffRank } from '@/lib/staffRoles'
import { hasVerifiedAal2Session, hasVerifiedMfaFactor } from '@/lib/security/staffMfa'

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError('Staff invite is not configured on this environment.', 500)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) return jsonError('Staff session required.', 401)

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
  if (userError || !userData.user) return jsonError(userError?.message || 'Staff session required.', 401)

  const { data: actorProfile, error: actorError } = await adminClient
    .from('profiles')
    .select('id, email, role, deleted_at')
    .eq('id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (actorError) return jsonError(actorError.message, 500)

  const actorRank = Math.max(
    staffRank(actorProfile?.role, actorProfile?.email),
    staffRank(userData.user.app_metadata?.role as string | undefined, userData.user.email),
  )
  if (actorRank < 50) return jsonError('Staff access required.', 403)
  const [hasAal2, hasMfaFactor] = await Promise.all([
    hasVerifiedAal2Session(authClient, accessToken),
    hasVerifiedMfaFactor(adminClient, userData.user.id),
  ])
  if (!hasAal2 || !hasMfaFactor) return jsonError('Staff two-step verification required.', 403)

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
    p_subject: `staff:${userData.user.id}:ip:${ip}`,
  })

  if (actorRateLimitError) {
    return jsonError(actorRateLimitError.message || 'Too many attempts. Please wait a moment and try again.', 429)
  }

  const { error: rateLimitError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'customer_invite',
    p_limit: 5,
    p_window_seconds: 10 * 60,
    p_subject: `staff:${userData.user.id}:email:${email}:ip:${ip}`,
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
      created_by_staff_id: userData.user.id,
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

  return NextResponse.json({
    profile: profilePayload,
    message: 'Customer account created and password request sent.',
  })
}
