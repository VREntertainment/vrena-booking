import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  isPendingPhoneAccountSetup,
  maskPhoneSetupEmail,
  normalizePhoneSetupEmail,
  phoneSetupTemporaryPasswordExpired,
  PHONE_SETUP_TOKEN_TTL_MINUTES,
  type PhoneSetupAppMetadata,
} from '@/lib/phoneAccountSetup'
import { sendPhoneAccountSetupEmail } from '@/lib/phoneAccountSetupEmail'
import { trustedClientIp } from '@/lib/security/requestIp'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return jsonError('Account setup is unavailable.', 503)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid account setup request.', 400)
  }

  const email = normalizePhoneSetupEmail(body.email)
  if (!email) return jsonError('Enter a valid email address.', 400)

  const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) return jsonError('Sign in with the temporary password first.', 401)

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !authData.user) return jsonError('Sign in with the temporary password first.', 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: currentAuth, error: currentAuthError }, { data: duplicateProfile, error: duplicateError }] = await Promise.all([
    adminClient.auth.admin.getUserById(authData.user.id),
    adminClient.from('profiles').select('id').eq('email', email).neq('id', authData.user.id).limit(1).maybeSingle(),
  ])

  if (currentAuthError || !currentAuth.user || !isPendingPhoneAccountSetup(currentAuth.user.app_metadata)) {
    return jsonError('This account no longer needs first-login setup.', 409)
  }
  if (phoneSetupTemporaryPasswordExpired(currentAuth.user.app_metadata)) {
    return jsonError('This temporary password has expired. Ask VRena staff to generate a new one.', 403)
  }
  if (duplicateError) return jsonError('Could not check this email address.', 503)
  if (duplicateProfile) return jsonError('This email is already connected to another account.', 409)

  const { error: rateLimitError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'phone_account_setup_email',
    p_limit: 3,
    p_window_seconds: 10 * 60,
    p_subject: `user:${authData.user.id}:ip:${trustedClientIp(request.headers)}`,
  })
  if (rateLimitError) return jsonError('Too many setup emails were requested. Please wait and try again.', 429)

  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const tokenExpiresAt = new Date(Date.now() + PHONE_SETUP_TOKEN_TTL_MINUTES * 60_000).toISOString()
  const appMetadata = currentAuth.user.app_metadata as PhoneSetupAppMetadata
  const { error: metadataError } = await adminClient.auth.admin.updateUserById(authData.user.id, {
    app_metadata: {
      ...appMetadata,
      phone_setup_email: email,
      phone_setup_token_hash: tokenHash,
      phone_setup_token_expires_at: tokenExpiresAt,
    },
  })
  if (metadataError) return jsonError('Could not prepare the verification email.', 500)

  const setupUrl = new URL('/phone-account-setup', process.env.NEXT_PUBLIC_SITE_URL || 'https://booking.vre-vietnam.com')
  setupUrl.hash = new URLSearchParams({ uid: authData.user.id, token }).toString()

  try {
    await sendPhoneAccountSetupEmail({
      customerName: String(currentAuth.user.user_metadata?.full_name || currentAuth.user.user_metadata?.name || ''),
      recipientEmail: email,
      setupUrl: setupUrl.toString(),
    })
  } catch (error) {
    await adminClient.auth.admin.updateUserById(authData.user.id, {
      app_metadata: {
        ...appMetadata,
        phone_setup_email: null,
        phone_setup_token_hash: null,
        phone_setup_token_expires_at: null,
      },
    })
    return jsonError(error instanceof Error ? error.message : 'Could not send the verification email.', 503)
  }

  return NextResponse.json({
    expiresAt: tokenExpiresAt,
    maskedEmail: maskPhoneSetupEmail(email),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
