import { NextRequest, NextResponse } from 'next/server'
import { buildContentSecurityPolicy, configuredSupabaseOrigins } from './lib/security/csp'

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID())
  const requestHeaders = new Headers(request.headers)
  const { supabaseOrigin, supabaseRealtimeOrigin } = configuredSupabaseOrigins()
  const contentSecurityPolicy = buildContentSecurityPolicy({
    isDev: process.env.NODE_ENV !== 'production',
    nonce,
    supabaseOrigin,
    supabaseRealtimeOrigin,
  })

  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  return response
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/hr/:path*'],
}
