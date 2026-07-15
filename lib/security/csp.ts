type ContentSecurityPolicyOptions = {
  isDev: boolean
  nonce?: string
  supabaseOrigin?: string | null
  supabaseRealtimeOrigin?: string | null
}

export function buildContentSecurityPolicy({
  isDev,
  nonce,
  supabaseOrigin,
  supabaseRealtimeOrigin,
}: ContentSecurityPolicyOptions) {
  const scriptSources = [
    "'self'",
    nonce ? `'nonce-${nonce}'` : "'unsafe-inline'",
    nonce ? "'strict-dynamic'" : null,
    isDev ? "'unsafe-eval'" : null,
    'https://js.hcaptcha.com',
    'https://hcaptcha.com',
    'https://*.hcaptcha.com',
  ].filter(Boolean).join(' ')

  return [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' data: blob:",
      supabaseOrigin,
      'https://lh3.googleusercontent.com',
    ].filter(Boolean).join(' '),
    "font-src 'self' data:",
    [
      "connect-src 'self'",
      supabaseOrigin,
      supabaseRealtimeOrigin,
      'https://hcaptcha.com',
      'https://*.hcaptcha.com',
      'https://vitals.vercel-insights.com',
      'https://*.vercel-insights.com',
    ].filter(Boolean).join(' '),
    'frame-src https://hcaptcha.com https://*.hcaptcha.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev ? null : 'upgrade-insecure-requests',
  ].filter(Boolean).join('; ')
}

export function configuredSupabaseOrigins() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return { supabaseOrigin: null, supabaseRealtimeOrigin: null }

  try {
    const url = new URL(supabaseUrl)
    const supabaseOrigin = url.origin
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
    return { supabaseOrigin, supabaseRealtimeOrigin: url.origin }
  } catch {
    return { supabaseOrigin: null, supabaseRealtimeOrigin: null }
  }
}
