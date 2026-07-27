import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { trustedClientIp, UNKNOWN_CLIENT_IP } from '@/lib/security/requestIp'
import { absoluteSiteUrl } from '@/lib/siteMetadata'

export const runtime = 'nodejs'

const ZALO_MINI_APP_ORIGIN = 'https://h5.zdn.vn'
const MAX_TOKEN_LENGTH = 4096
const HANDOFF_LIFETIME_MS = 2 * 60 * 1000
const PRIVACY_POLICY_URL = 'https://www.vre-vietnam.com/privacy-policy'
const TERMS_CONDITIONS_URL = 'https://www.vre-vietnam.com/terms-and-conditions'
const LEGAL_CONSENT_VERSION = '2026-07-06'

type PlayerAction = 'status' | 'continue'

type ZaloProfile = {
  id: string
  name: string | null
}

type PlayerIdentity = {
  id: string
  profile_id: string
  zalo_app_user_id: string
  verified_phone: string
  display_name: string | null
  revoked_at: string | null
}

function requestOrigin(request: NextRequest) {
  return request.headers.get('origin')?.trim() || null
}

function isAllowedOrigin(origin: string | null) {
  if (!origin || origin === ZALO_MINI_APP_ORIGIN) return true
  if (process.env.NODE_ENV === 'production') return false

  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function corsHeaders(origin: string | null) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    Vary: 'Origin',
  })

  if (origin && isAllowedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  return headers
}

function jsonResponse(request: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders(requestOrigin(request)),
  })
}

function cleanString(value: unknown, maxLength = 255) {
  if (typeof value !== 'string') return ''
  return Array.from(value.trim()).slice(0, maxLength).join('')
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i)
  const token = match?.[1]?.trim() || ''
  return token && token.length <= MAX_TOKEN_LENGTH ? token : ''
}

function normalizeVietnamPhone(value: unknown) {
  let digits = cleanString(value, 40).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('84')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.length >= 8 && digits.length <= 10 ? `+84${digits}` : ''
}

function maskPhone(phone: string) {
  return `+84 ••• ••• ${phone.slice(-3)}`
}

async function fetchZaloJson(url: string, headers: HeadersInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload || typeof payload !== 'object') {
      throw new Error('Zalo could not verify this request.')
    }
    return payload as Record<string, unknown>
  } finally {
    clearTimeout(timeout)
  }
}

async function verifyZaloAccessToken(accessToken: string): Promise<ZaloProfile> {
  const payload = await fetchZaloJson('https://graph.zalo.me/v2.0/me?fields=id,name', {
    access_token: accessToken,
  })
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : payload
  const id = cleanString(data.id, 255)

  if (!id || (typeof payload.error === 'number' && payload.error !== 0)) {
    throw new Error('Zalo session expired. Reopen the Mini App and try again.')
  }

  return {
    id,
    name: cleanString(data.name, 120) || null,
  }
}

async function decodeZaloPhone(accessToken: string, phoneToken: string) {
  const appSecret = process.env.ZALO_APP_SECRET
  if (!appSecret) throw new Error('Zalo player accounts are not configured yet.')

  const payload = await fetchZaloJson('https://graph.zalo.me/v2.0/me/info', {
    access_token: accessToken,
    code: phoneToken,
    secret_key: appSecret,
  })
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {}
  const phone = normalizeVietnamPhone(data.number)

  if (!phone || (typeof payload.error === 'number' && payload.error !== 0)) {
    throw new Error('Zalo could not verify the phone number. Approve access and try again.')
  }

  return phone
}

async function consumeRateLimit(
  adminClient: SupabaseClient,
  subject: string,
  limit: number,
  windowSeconds: number,
) {
  const { error } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'otp_request',
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_subject: subject,
  })
  if (error) {
    const message = cleanString(error.message, 200)
    throw new Error(
      message.includes('Too many attempts')
        ? message
        : 'Account security checks are temporarily unavailable.',
    )
  }
}

function internalEmailForZaloUser(zaloAppUserId: string) {
  const subject = createHash('sha256')
    .update(`vrena:zalo-player:${zaloAppUserId}`)
    .digest('hex')
    .slice(0, 40)
  return `zalo-${subject}@accounts.vrena.internal`
}

async function existingProfileForPhone(adminClient: SupabaseClient, phone: string) {
  const localPhone = `0${phone.slice(3)}`
  const { data, error } = await adminClient
    .from('profiles')
    .select('id')
    .in('phone', [phone, localPhone])
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error('VRena could not safely check this phone number.')
  return data as { id: string } | null
}

async function createPlayer(
  adminClient: SupabaseClient,
  zaloProfile: ZaloProfile,
  phone: string,
) {
  const email = internalEmailForZaloUser(zaloProfile.id)
  const consentAt = new Date().toISOString()
  let createdUser: User | null = null

  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    phone,
    phone_confirm: true,
    user_metadata: {
      auth_origin: 'zalo_mini_app',
      display_name: zaloProfile.name || 'Người chơi',
      full_name: zaloProfile.name || 'Người chơi',
      name: zaloProfile.name || 'Người chơi',
      phone,
      personal_data_consent: true,
      personal_data_consent_at: consentAt,
      privacy_policy_url: PRIVACY_POLICY_URL,
      terms_conditions_url: TERMS_CONDITIONS_URL,
      legal_consent_version: LEGAL_CONSENT_VERSION,
    },
  })

  if (createError || !createData.user) {
    throw new Error(
      createError?.message.toLowerCase().includes('already')
        ? 'A VRena account already uses this phone number. Sign in normally before connecting Zalo.'
        : 'VRena could not create the player account.',
    )
  }
  createdUser = createData.user

  try {
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: createdUser.id,
      full_name: zaloProfile.name || null,
      nickname: zaloProfile.name || null,
      phone,
      email: null,
      personal_data_consent: true,
      personal_data_consent_at: consentAt,
      privacy_policy_url: PRIVACY_POLICY_URL,
      terms_conditions_url: TERMS_CONDITIONS_URL,
      legal_consent_version: LEGAL_CONSENT_VERSION,
      marketing_consent: false,
      marketing_opted_out_at: consentAt,
      updated_at: consentAt,
    })
    if (profileError) throw profileError

    const { data: identity, error: identityError } = await adminClient
      .from('player_zalo_identities')
      .insert({
        profile_id: createdUser.id,
        zalo_app_user_id: zaloProfile.id,
        verified_phone: phone,
        display_name: zaloProfile.name,
      })
      .select('id, profile_id, zalo_app_user_id, verified_phone, display_name, revoked_at')
      .single()
    if (identityError || !identity) throw identityError || new Error('Missing player identity.')

    return identity as PlayerIdentity
  } catch {
    await adminClient.auth.admin.deleteUser(createdUser.id).catch(() => undefined)
    throw new Error('VRena could not finish creating the player account.')
  }
}

async function issueHandoff(adminClient: SupabaseClient, profileId: string) {
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const now = Date.now()

  await adminClient
    .from('player_zalo_handoffs')
    .delete()
    .lt('expires_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())

  const { error } = await adminClient.from('player_zalo_handoffs').insert({
    profile_id: profileId,
    token_hash: tokenHash,
    expires_at: new Date(now + HANDOFF_LIFETIME_MS).toISOString(),
  })
  if (error) throw new Error('VRena could not prepare the secure sign-in.')

  return absoluteSiteUrl(`/auth/zalo?token=${encodeURIComponent(rawToken)}`)
}

function safeErrorStatus(message: string) {
  if (message.includes('Too many attempts')) return 429
  if (message.includes('temporarily unavailable') || message.includes('not configured')) return 503
  if (message.includes('expired')) return 401
  if (message.includes('already uses') || message.includes('already connected')) return 409
  if (message.includes('revoked')) return 403
  return 400
}

export async function OPTIONS(request: NextRequest) {
  const origin = requestOrigin(request)
  if (!isAllowedOrigin(origin)) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(request: NextRequest) {
  const origin = requestOrigin(request)
  if (!isAllowedOrigin(origin)) return jsonResponse(request, { error: 'Origin not allowed.' }, 403)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(request, { error: 'Zalo player accounts are not configured on this environment.' }, 503)
  }

  const accessToken = bearerToken(request)
  if (!accessToken) return jsonResponse(request, { error: 'A valid Zalo session is required.' }, 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse(request, { error: 'Invalid player account request.' }, 400)
  }

  const action = cleanString(body.action, 20) as PlayerAction
  if (!['status', 'continue'].includes(action)) {
    return jsonResponse(request, { error: 'Unsupported player account action.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const ip = trustedClientIp(request.headers)
    const tokenHash = createHash('sha256').update(accessToken).digest('hex').slice(0, 24)
    const preAuthSubject = ip === UNKNOWN_CLIENT_IP ? `token:${tokenHash}` : `ip:${ip}`
    await consumeRateLimit(adminClient, `zalo-player-preauth:${preAuthSubject}`, 40, 60)

    const zaloProfile = await verifyZaloAccessToken(accessToken)
    await consumeRateLimit(adminClient, `zalo-player:${action}:${zaloProfile.id}`, action === 'status' ? 60 : 12, 60)

    const { data: identityData, error: identityError } = await adminClient
      .from('player_zalo_identities')
      .select('id, profile_id, zalo_app_user_id, verified_phone, display_name, revoked_at')
      .eq('zalo_app_user_id', zaloProfile.id)
      .maybeSingle()
    if (identityError) throw new Error('VRena could not check the Zalo player account.')

    let identity = identityData as PlayerIdentity | null
    if (identity?.revoked_at) throw new Error('This Zalo connection was revoked. Contact VRena for help.')

    if (action === 'status') {
      return jsonResponse(request, {
        linked: Boolean(identity),
        displayName: identity?.display_name || zaloProfile.name || 'Người chơi',
        maskedPhone: identity ? maskPhone(identity.verified_phone) : null,
      })
    }

    if (!identity) {
      if (body.acceptedTerms !== true) {
        throw new Error('Accept the Privacy Policy and Terms before creating the account.')
      }
      const phoneToken = cleanString(body.phoneToken, MAX_TOKEN_LENGTH)
      if (!phoneToken) throw new Error('Approve phone access in Zalo to create the VRena account.')

      const phone = await decodeZaloPhone(accessToken, phoneToken)
      const existingPhoneIdentity = await adminClient
        .from('player_zalo_identities')
        .select('id')
        .eq('verified_phone', phone)
        .maybeSingle()
      if (existingPhoneIdentity.error) throw new Error('VRena could not safely check this phone number.')
      if (existingPhoneIdentity.data) {
        throw new Error('This phone number is already connected to another Zalo account.')
      }
      if (await existingProfileForPhone(adminClient, phone)) {
        throw new Error('A VRena account already uses this phone number. Sign in normally before connecting Zalo.')
      }

      identity = await createPlayer(adminClient, zaloProfile, phone)
    } else {
      const { error: updateError } = await adminClient
        .from('player_zalo_identities')
        .update({
          display_name: zaloProfile.name || identity.display_name,
          last_login_at: new Date().toISOString(),
        })
        .eq('id', identity.id)
      if (updateError) throw new Error('VRena could not refresh the Zalo player account.')
    }

    return jsonResponse(request, {
      linked: true,
      displayName: identity.display_name || zaloProfile.name || 'Người chơi',
      maskedPhone: maskPhone(identity.verified_phone),
      handoffUrl: await issueHandoff(adminClient, identity.profile_id),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'VRena could not complete the Zalo sign-in.'
    return jsonResponse(request, { error: message }, safeErrorStatus(message))
  }
}
