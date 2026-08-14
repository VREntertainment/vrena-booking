import { createHash, createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { trustedClientIp, UNKNOWN_CLIENT_IP } from '@/lib/security/requestIp'

export const runtime = 'nodejs'

const ZALO_MINI_APP_ORIGIN = 'https://h5.zdn.vn'
const MAX_TOKEN_LENGTH = 4096
const PRIVACY_POLICY_URL = 'https://www.vre-vietnam.com/privacy-policy'
const TERMS_CONDITIONS_URL = 'https://www.vre-vietnam.com/terms-and-conditions'
const LEGAL_CONSENT_VERSION = '2026-08-10'

type PlayerAction = 'status' | 'register'

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

type ZaloApiStage = 'access-token' | 'phone-number'

class ZaloApiError extends Error {
  constructor(
    message: string,
    readonly stage: ZaloApiStage,
    readonly httpStatus: number,
    readonly zaloErrorCode: number | null,
  ) {
    super(message)
    this.name = 'ZaloApiError'
  }
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

function zaloErrorCode(payload: Record<string, unknown> | null) {
  if (!payload) return null
  if (typeof payload.error === 'number') return payload.error
  if (typeof payload.error === 'string' && /^-?\d+$/.test(payload.error)) {
    return Number(payload.error)
  }
  return null
}

async function fetchZaloJson(
  url: string,
  headers: HeadersInit,
  stage: ZaloApiStage,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    const rawPayload: unknown = await response.json().catch(() => null)
    const payload = rawPayload && typeof rawPayload === 'object'
      ? rawPayload as Record<string, unknown>
      : null
    const errorCode = zaloErrorCode(payload)
    if (!response.ok || !payload || (errorCode !== null && errorCode !== 0)) {
      throw new ZaloApiError(
        stage === 'phone-number'
          ? 'Zalo chưa thể xác minh số điện thoại. Vui lòng cấp quyền và thử lại.'
          : 'Zalo chưa thể xác minh phiên đăng ký sau khi cấp quyền. Vui lòng đóng và mở lại Mini App.',
        stage,
        response.status,
        errorCode,
      )
    }
    return payload
  } catch (error) {
    if (error instanceof ZaloApiError) throw error
    throw new ZaloApiError(
      'Zalo chưa phản hồi yêu cầu xác minh. Vui lòng thử lại.',
      stage,
      503,
      null,
    )
  } finally {
    clearTimeout(timeout)
  }
}

async function verifyZaloAccessToken(accessToken: string): Promise<ZaloProfile> {
  const appSecret = process.env.ZALO_APP_SECRET
  if (!appSecret) throw new Error('Dịch vụ đăng ký VRena chưa được cấu hình đầy đủ.')

  const appsecretProof = createHmac('sha256', appSecret)
    .update(accessToken)
    .digest('hex')
  const payload = await fetchZaloJson(
    'https://graph.zalo.me/v2.0/me?fields=id',
    {
      access_token: accessToken,
      appsecret_proof: appsecretProof,
    },
    'access-token',
  )
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : payload
  const id = cleanString(data.id, 255)

  if (!id) {
    throw new ZaloApiError(
      'Zalo chưa thể xác minh phiên đăng ký sau khi cấp quyền. Vui lòng đóng và mở lại Mini App.',
      'access-token',
      401,
      null,
    )
  }

  return {
    id,
    name: cleanString(data.name, 120) || null,
  }
}

async function decodeZaloPhone(accessToken: string, phoneToken: string) {
  const appSecret = process.env.ZALO_APP_SECRET
  if (!appSecret) throw new Error('Dịch vụ đăng ký VRena chưa được cấu hình đầy đủ.')

  const payload = await fetchZaloJson(
    'https://graph.zalo.me/v2.0/me/info',
    {
      access_token: accessToken,
      code: phoneToken,
      secret_key: appSecret,
    },
    'phone-number',
  )
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {}
  const phone = normalizeVietnamPhone(data.number)

  if (!phone) {
    throw new ZaloApiError(
      'Zalo chưa thể xác minh số điện thoại. Vui lòng cấp quyền và thử lại.',
      'phone-number',
      400,
      null,
    )
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
        ? 'Bạn đã thử quá nhiều lần. Vui lòng chờ một phút rồi thử lại.'
        : 'Kiểm tra bảo mật đang tạm thời gián đoạn. Vui lòng thử lại sau.',
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

  if (error) throw new Error('VRena chưa thể kiểm tra an toàn số điện thoại này.')
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
        ? 'Số điện thoại này đã có hồ sơ VRena. Vui lòng liên hệ nhân viên VRena tại quầy để được hỗ trợ.'
        : 'VRena chưa thể tạo hồ sơ người chơi.',
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
    if (identityError || !identity) throw identityError || new Error('Không tìm thấy hồ sơ người chơi vừa tạo.')

    return identity as PlayerIdentity
  } catch {
    await adminClient.auth.admin.deleteUser(createdUser.id).catch(() => undefined)
    throw new Error('VRena chưa thể hoàn tất hồ sơ người chơi.')
  }
}

function safeErrorStatus(message: string) {
  if (message.includes('quá nhiều lần')) return 429
  if (message.includes('tạm thời gián đoạn') || message.includes('chưa được cấu hình')) return 503
  if (message.toLowerCase().includes('phiên zalo')) return 401
  if (message.includes('đã có hồ sơ') || message.includes('đã được dùng')) return 409
  if (message.includes('đã bị thu hồi')) return 403
  return 400
}

export async function OPTIONS(request: NextRequest) {
  const origin = requestOrigin(request)
  if (!isAllowedOrigin(origin)) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function POST(request: NextRequest) {
  const origin = requestOrigin(request)
  if (!isAllowedOrigin(origin)) return jsonResponse(request, { error: 'Nguồn yêu cầu không được phép.' }, 403)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(request, { error: 'Dịch vụ đăng ký VRena chưa được cấu hình trên môi trường này.' }, 503)
  }

  const accessToken = bearerToken(request)
  if (!accessToken) return jsonResponse(request, { error: 'Cần một phiên Zalo hợp lệ để tiếp tục.' }, 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse(request, { error: 'Yêu cầu đăng ký hồ sơ không hợp lệ.' }, 400)
  }

  const action = cleanString(body.action, 20) as PlayerAction
  if (!['status', 'register'].includes(action)) {
    return jsonResponse(request, { error: 'Thao tác hồ sơ không được hỗ trợ.' }, 400)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const ip = trustedClientIp(request.headers)
    const tokenHash = createHash('sha256').update(accessToken).digest('hex').slice(0, 24)
    const preAuthSubject = ip === UNKNOWN_CLIENT_IP ? `token:${tokenHash}` : `ip:${ip}`
    await consumeRateLimit(adminClient, `zalo-player-preauth:${preAuthSubject}`, 40, 60)

    let verifiedPhone: string | null = null
    if (action === 'register') {
      if (body.acceptedTerms !== true) {
        throw new Error('Vui lòng đồng ý với Chính sách quyền riêng tư và Điều khoản sử dụng trước khi đăng ký.')
      }
      const phoneToken = cleanString(body.phoneToken, MAX_TOKEN_LENGTH)
      if (!phoneToken) throw new Error('Vui lòng cấp quyền số điện thoại Zalo để đăng ký hồ sơ mới.')

      // Requesting and decoding the phone permission first is intentional. For a
      // parent Zalo App with multiple Mini Apps, the access token only becomes
      // usable after this Mini App has completed its own authorization step.
      verifiedPhone = await decodeZaloPhone(accessToken, phoneToken)
    }

    const zaloProfile = await verifyZaloAccessToken(accessToken)
    const clientZaloUserId = cleanString(body.zaloUserId, 255)
    if (action === 'register' && (!clientZaloUserId || clientZaloUserId !== zaloProfile.id)) {
      throw new Error('Phiên Zalo không khớp với người dùng đăng ký. Vui lòng đóng và mở lại Mini App.')
    }
    await consumeRateLimit(adminClient, `zalo-player:${action}:${zaloProfile.id}`, action === 'status' ? 60 : 12, 60)

    const { data: identityData, error: identityError } = await adminClient
      .from('player_zalo_identities')
      .select('id, profile_id, zalo_app_user_id, verified_phone, display_name, revoked_at')
      .eq('zalo_app_user_id', zaloProfile.id)
      .maybeSingle()
    if (identityError) throw new Error('VRena chưa thể kiểm tra hồ sơ người chơi Zalo.')

    let identity = identityData as PlayerIdentity | null
    if (identity?.revoked_at) throw new Error('Hồ sơ Zalo này đã bị thu hồi. Vui lòng liên hệ VRena để được hỗ trợ.')

    if (action === 'status') {
      return jsonResponse(request, {
        registered: Boolean(identity),
        displayName: identity?.display_name || zaloProfile.name || 'Người chơi',
        maskedPhone: identity ? maskPhone(identity.verified_phone) : null,
      })
    }

    if (!identity) {
      const phone = verifiedPhone
      if (!phone) throw new Error('Zalo chưa thể xác minh số điện thoại. Vui lòng cấp quyền và thử lại.')
      const existingPhoneIdentity = await adminClient
        .from('player_zalo_identities')
        .select('id')
        .eq('verified_phone', phone)
        .maybeSingle()
      if (existingPhoneIdentity.error) throw new Error('VRena chưa thể kiểm tra an toàn số điện thoại này.')
      if (existingPhoneIdentity.data) {
        throw new Error('Số điện thoại này đã được dùng để đăng ký một hồ sơ VRena khác.')
      }
      if (await existingProfileForPhone(adminClient, phone)) {
        throw new Error('Số điện thoại này đã có hồ sơ VRena. Vui lòng liên hệ nhân viên VRena tại quầy để được hỗ trợ.')
      }

      identity = await createPlayer(adminClient, zaloProfile, phone)
    } else {
      if (verifiedPhone && verifiedPhone !== identity.verified_phone) {
        throw new Error('Số điện thoại Zalo không khớp với hồ sơ thành viên đã đăng ký.')
      }
      const { error: updateError } = await adminClient
        .from('player_zalo_identities')
        .update({
          display_name: zaloProfile.name || identity.display_name,
          last_login_at: new Date().toISOString(),
        })
        .eq('id', identity.id)
      if (updateError) throw new Error('VRena chưa thể cập nhật hồ sơ người chơi Zalo.')
    }

    return jsonResponse(request, {
      registered: true,
      displayName: identity.display_name || zaloProfile.name || 'Người chơi',
      maskedPhone: maskPhone(identity.verified_phone),
    })
  } catch (error) {
    if (error instanceof ZaloApiError) {
      console.error('[zalo-player-auth] Zalo verification failed', {
        action,
        stage: error.stage,
        httpStatus: error.httpStatus,
        zaloErrorCode: error.zaloErrorCode,
      })
    }
    const message = error instanceof Error ? error.message : 'VRena chưa thể hoàn tất đăng ký hồ sơ.'
    return jsonResponse(request, { error: message }, safeErrorStatus(message))
  }
}
