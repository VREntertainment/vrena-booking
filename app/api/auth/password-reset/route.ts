import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type CaptchaVerifyResponse = {
  success?: boolean
  'error-codes'?: string[]
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value: unknown) {
  return cleanString(value).toLowerCase()
}

function requestIp(request: NextRequest) {
  return (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown')
    .split(',')[0]
    .trim()
}

async function verifyCaptcha(token: string, ip: string) {
  const secret = process.env.HCAPTCHA_SECRET
  if (!secret) {
    return { ok: false, message: 'Password reset captcha is not configured.' }
  }

  const response = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: token,
      remoteip: ip,
    }),
  })

  if (!response.ok) {
    return { ok: false, message: 'Could not verify captcha. Please try again.' }
  }

  const result = (await response.json()) as CaptchaVerifyResponse
  if (!result.success) {
    return { ok: false, message: 'Captcha verification failed. Please try again.' }
  }

  return { ok: true, message: '' }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError('Password reset is not configured on this environment.', 500)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid password reset payload.', 400)
  }

  const email = normalizeEmail(body.email)
  const captchaToken = cleanString(body.captchaToken)
  const redirectTo = cleanString(body.redirectTo) || request.nextUrl.origin
  const ip = requestIp(request)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError('Enter a valid email.', 400)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const rateLimitClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim()
  let isOwnAuthenticatedReset = false

  if (accessToken) {
    const { data } = await supabase.auth.getUser(accessToken)
    isOwnAuthenticatedReset = data.user?.email?.toLowerCase() === email
  }

  if (!isOwnAuthenticatedReset) {
    if (!captchaToken) return jsonError('Captcha required.', 400)

    const captcha = await verifyCaptcha(captchaToken, ip)
    if (!captcha.ok) return jsonError(captcha.message, 400)
  }

  const { error: rateLimitError } = await rateLimitClient.rpc('consume_password_reset_rate_limit', {
    p_email: email,
    p_ip: ip,
  })

  if (rateLimitError) {
    return jsonError(rateLimitError.message || 'Too many attempts. Please wait a moment and try again.', 429)
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
    captchaToken: captchaToken || undefined,
  })

  if (error) {
    return jsonError(error.message || 'Could not send password reset email.', 400)
  }

  return NextResponse.json({ message: 'Password reset email sent.' })
}
