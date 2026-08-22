import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  isPendingPhoneAccountSetup,
  isValidPhoneSetupPassword,
  normalizePhoneSetupEmail,
  type PhoneSetupAppMetadata,
} from '@/lib/phoneAccountSetup'
import { trustedClientIp } from '@/lib/security/requestIp'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return jsonError('Account setup is unavailable.', 503)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid account setup request.', 400)
  }

  const userId = cleanString(body.userId)
  const token = cleanString(body.token)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!validUuid(userId) || token.length < 32) return jsonError('This setup link is invalid.', 400)
  if (!isValidPhoneSetupPassword(password)) return jsonError('Use a password between 8 and 128 characters.', 400)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: rateLimitError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'phone_account_setup_complete',
    p_limit: 8,
    p_window_seconds: 10 * 60,
    p_subject: `user:${userId}:ip:${trustedClientIp(request.headers)}`,
  })
  if (rateLimitError) return jsonError('Too many setup attempts. Please wait and try again.', 429)

  const { data: authRecord, error: authRecordError } = await adminClient.auth.admin.getUserById(userId)
  const metadata = authRecord.user?.app_metadata as PhoneSetupAppMetadata | undefined
  const email = normalizePhoneSetupEmail(metadata?.phone_setup_email)
  const expectedHash = typeof metadata?.phone_setup_token_hash === 'string' ? metadata.phone_setup_token_hash : ''
  const expiresAt = typeof metadata?.phone_setup_token_expires_at === 'string' ? new Date(metadata.phone_setup_token_expires_at) : null
  const receivedHash = createHash('sha256').update(token).digest('hex')
  const tokenMatches = expectedHash.length === receivedHash.length
    && timingSafeEqual(Buffer.from(expectedHash), Buffer.from(receivedHash))

  if (
    authRecordError
    || !authRecord.user
    || !isPendingPhoneAccountSetup(metadata)
    || !email
    || !expiresAt
    || Number.isNaN(expiresAt.getTime())
    || expiresAt.getTime() <= Date.now()
    || !tokenMatches
  ) {
    return jsonError('This setup link is invalid or has expired. Sign in again to request a new email.', 400)
  }

  const { data: profile, error: profileReadError } = await adminClient
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  if (profileReadError || !profile) return jsonError('Could not load this customer account.', 500)

  const previousProfileEmail = profile.email || null
  const { error: profileUpdateError } = await adminClient
    .from('profiles')
    .update({ email, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (profileUpdateError) return jsonError('This email is already connected to another account.', 409)

  const completedAt = new Date().toISOString()
  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
    password,
    app_metadata: {
      ...metadata,
      phone_setup_required: false,
      phone_setup_email: null,
      phone_setup_token_hash: null,
      phone_setup_token_expires_at: null,
      phone_setup_completed_at: completedAt,
      recovery_email_verified: true,
    },
  })

  if (authUpdateError) {
    await adminClient.from('profiles').update({ email: previousProfileEmail }).eq('id', userId)
    const status = /already|registered|exists/i.test(authUpdateError.message) ? 409 : 500
    return jsonError(status === 409 ? 'This email is already connected to another account.' : 'Could not finish account setup.', status)
  }

  await adminClient.from('audit_logs').insert({
    actor_user_id: userId,
    auth_user_id: userId,
    action: 'customer_phone_setup_completed',
    entity_type: 'profiles',
    entity_id: userId,
    new_value: { email, email_verified: true, phone_verified: false },
  })

  return NextResponse.json({ email, message: 'Email verified and permanent password created.' }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
