import type { NextConfig } from 'next'

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
}

export default nextConfig
