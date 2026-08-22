import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { normalizePhonePasswordIdentifier } from '@/lib/phonePasswordAccount'
import { phoneSetupTemporaryPasswordExpired } from '@/lib/phoneAccountSetup'
import { trustedClientIp } from '@/lib/security/requestIp'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return jsonError('Phone login is unavailable.', 503)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid login request.', 400)
  }

  const phone = normalizePhonePasswordIdentifier(cleanString(body.phone))
  const password = typeof body.password === 'string' ? body.password : ''
  const captchaToken = cleanString(body.captchaToken)
  if (!phone || password.length < 6 || !captchaToken) return jsonError('Invalid phone number or password.', 400)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const clientIp = trustedClientIp(request.headers)
  const { error: ipRateLimitError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'phone_password_login_ip',
    p_limit: 30,
    p_window_seconds: 10 * 60,
    p_subject: `ip:${clientIp}`,
  })
  if (ipRateLimitError) return jsonError('Too many login attempts. Please wait and try again.', 429)

  const { data: profiles, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .is('deleted_at', null)
    .limit(2)

  if (profileError || profiles?.length !== 1) return jsonError('Invalid phone number or password.', 400)

  const { error: accountRateLimitError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'phone_password_login_account',
    p_limit: 8,
    p_window_seconds: 10 * 60,
    p_subject: `user:${profiles[0].id}:ip:${clientIp}`,
  })
  if (accountRateLimitError) return jsonError('Too many login attempts. Please wait and try again.', 429)

  const { data: authRecord, error: authRecordError } = await adminClient.auth.admin.getUserById(profiles[0].id)
  const credentialEmail = authRecord.user?.email?.toLowerCase() || ''
  if (authRecordError || !credentialEmail) return jsonError('Invalid phone number or password.', 400)

  if (
    authRecord.user
    && authRecord.user.app_metadata?.phone_setup_required === true
    && phoneSetupTemporaryPasswordExpired(authRecord.user.app_metadata)
  ) {
    return jsonError('This temporary password has expired. Ask VRena staff to generate a new one.', 403)
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await authClient.auth.signInWithPassword({
    email: credentialEmail,
    password,
    options: { captchaToken },
  })

  if (error || !data.session) return jsonError('Invalid phone number or password.', 400)

  return NextResponse.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    phoneSetupRequired: data.user.app_metadata?.phone_setup_required === true,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
