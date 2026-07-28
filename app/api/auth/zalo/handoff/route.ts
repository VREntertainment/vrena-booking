import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { trustedClientIp, UNKNOWN_CLIENT_IP } from '@/lib/security/requestIp'
import { siteUrl } from '@/lib/siteMetadata'

export const runtime = 'nodejs'

const MAX_HANDOFF_TOKEN_LENGTH = 128

function cleanToken(value: unknown) {
  if (typeof value !== 'string') return ''
  const token = value.trim()
  return token.length <= MAX_HANDOFF_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(token) ? token : ''
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  })
}

function isSameOrigin(request: NextRequest, origin: string) {
  const expectedOrigins = new Set<string>([request.nextUrl.origin, new URL(siteUrl).origin])
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')?.trim()
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(':', '')

  if (host && protocol) expectedOrigins.add(`${protocol}://${host}`)
  if (process.env.NODE_ENV !== 'production') {
    expectedOrigins.add('http://localhost:3000')
    expectedOrigins.add('http://127.0.0.1:3000')
  }

  return expectedOrigins.has(origin)
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && !isSameOrigin(request, origin)) {
    return noStoreJson({ error: 'Origin not allowed.' }, 403)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return noStoreJson({ error: 'Zalo sign-in is not configured on this environment.' }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return noStoreJson({ error: 'Invalid sign-in request.' }, 400)
  }

  const token = cleanToken(body.token)
  if (!token) return noStoreJson({ error: 'This Zalo sign-in link is invalid.' }, 400)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const ip = trustedClientIp(request.headers)
  const subject = ip === UNKNOWN_CLIENT_IP
    ? `token:${createHash('sha256').update(token).digest('hex').slice(0, 24)}`
    : `ip:${ip}`
  const { error: rateError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'otp_request',
    p_limit: 12,
    p_window_seconds: 60,
    p_subject: `zalo-handoff:${subject}`,
  })
  if (rateError) {
    return noStoreJson({
      error: rateError.message.includes('Too many attempts')
        ? 'Too many attempts. Wait a moment and try again.'
        : 'Sign-in security checks are temporarily unavailable.',
    }, rateError.message.includes('Too many attempts') ? 429 : 503)
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = new Date().toISOString()
  const { data: handoff, error: handoffError } = await adminClient
    .from('player_zalo_handoffs')
    .update({ consumed_at: now })
    .eq('token_hash', tokenHash)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('profile_id')
    .maybeSingle()

  if (handoffError || !handoff) {
    return noStoreJson({ error: 'This Zalo sign-in link expired or was already used. Reopen the Mini App.' }, 401)
  }

  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(handoff.profile_id)
  const email = userData.user?.email
  if (userError || !email) {
    return noStoreJson({ error: 'The VRena player account is unavailable.' }, 503)
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHashForSession = linkData.properties?.hashed_token
  if (linkError || !tokenHashForSession) {
    return noStoreJson({ error: 'VRena could not establish the secure player session.' }, 503)
  }

  return noStoreJson({ tokenHash: tokenHashForSession })
}
