import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const PLAYER_MINI_APP_ID = '2586740010836800026'
const MAX_BODY_LENGTH = 16_384
const SIGNATURE_HEADER = 'x-zevent-signature'

type ZaloConsentEvent = {
  event: 'user.revoke.consent'
  appId: string
  userId: string
  timestamp?: number
}

function cleanString(value: unknown, maxLength = 255) {
  if (typeof value !== 'string') return ''
  return Array.from(value.trim()).slice(0, maxLength).join('')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function signatureFor(payload: Record<string, unknown>, apiKey: string) {
  const content = Object.keys(payload)
    .sort()
    .map((key) => {
      const value = payload[key]
      return typeof value === 'object' ? JSON.stringify(value) : String(value)
    })
    .join('')

  // Zalo's webhook protocol requires SHA-256(sorted payload values + Open API key).
  // This is message authentication, not password storage.
  // lgtm[js/insufficient-password-hash]
  return createHash('sha256').update(`${content}${apiKey}`).digest('hex')
}

function signaturesMatch(supplied: string, expected: string) {
  if (!/^[0-9a-f]{64}$/i.test(supplied)) return false
  const suppliedBuffer = Buffer.from(supplied.toLowerCase(), 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  return suppliedBuffer.length === expectedBuffer.length
    && timingSafeEqual(suppliedBuffer, expectedBuffer)
}

function parseConsentEvent(payload: Record<string, unknown>): ZaloConsentEvent | null {
  const event = cleanString(payload.event, 80)
  const appId = cleanString(payload.appId, 40)
  const userId = cleanString(payload.userId, 255)
  const timestamp = typeof payload.timestamp === 'number' && Number.isFinite(payload.timestamp)
    ? payload.timestamp
    : undefined

  if (event !== 'user.revoke.consent' || appId !== PLAYER_MINI_APP_ID || !userId) return null
  return { event, appId, userId, timestamp }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'zalo-consent-webhook' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ZALO_OPEN_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 })
  }

  const rawBody = await request.text()
  if (!rawBody || rawBody.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
  }

  if (!isRecord(payload)) {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 })
  }

  const suppliedSignature = cleanString(request.headers.get(SIGNATURE_HEADER), 128)
  const expectedSignature = signatureFor(payload, apiKey)
  if (!signaturesMatch(suppliedSignature, expectedSignature)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  const event = parseConsentEvent(payload)
  if (!event) {
    return NextResponse.json({ error: 'Unsupported webhook event.' }, { status: 400 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: identity, error: identityError } = await adminClient
    .from('player_zalo_identities')
    .select('profile_id')
    .eq('zalo_app_user_id', event.userId)
    .maybeSingle()

  if (identityError) {
    return NextResponse.json({ error: 'Unable to process consent withdrawal.' }, { status: 503 })
  }
  if (!identity) {
    return NextResponse.json({ ok: true })
  }

  const profileId = cleanString(identity.profile_id, 64)
  const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(profileId)
  if (authError && !authError.message.toLowerCase().includes('not found')) {
    return NextResponse.json({ error: 'Unable to process consent withdrawal.' }, { status: 503 })
  }

  const isZaloOnlyAccount = authData.user?.user_metadata?.auth_origin === 'zalo_mini_app'

  if (isZaloOnlyAccount) {
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(profileId)
    if (deleteUserError) {
      return NextResponse.json({ error: 'Unable to process consent withdrawal.' }, { status: 503 })
    }
  } else {
    const { error: deleteHandoffsError } = await adminClient
      .from('player_zalo_handoffs')
      .delete()
      .eq('profile_id', profileId)
    if (deleteHandoffsError) {
      return NextResponse.json({ error: 'Unable to process consent withdrawal.' }, { status: 503 })
    }

    const { error: deleteIdentityError } = await adminClient
      .from('player_zalo_identities')
      .delete()
      .eq('zalo_app_user_id', event.userId)
    if (deleteIdentityError) {
      return NextResponse.json({ error: 'Unable to process consent withdrawal.' }, { status: 503 })
    }
  }

  return NextResponse.json({ ok: true })
}
