import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

const supabaseImageRemotePatterns = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) return []

  try {
    const { hostname } = new URL(supabaseUrl)

    return [
      {
        protocol: 'https' as const,
        hostname,
        pathname: '/storage/v1/object/public/**',
      },
    ]
  } catch {
    return []
  }
})()

const supabaseOrigin = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  try {
    return new URL(supabaseUrl).origin
  } catch {
    return null
  }
})()

const supabaseRealtimeOrigin = (() => {
  if (!supabaseOrigin) return null

  try {
    const url = new URL(supabaseOrigin)
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
    return url.origin
  } catch {
    return null
  }
})()

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.hcaptcha.com https://hcaptcha.com https://*.hcaptcha.com`,
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
  "frame-src https://hcaptcha.com https://*.hcaptcha.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isDev ? null : 'upgrade-insecure-requests',
].filter(Boolean).join('; ')

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: csp,
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
]

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    formats: ['image/webp'],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [
      ...supabaseImageRemotePatterns,
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/a/**',
        search: '',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
