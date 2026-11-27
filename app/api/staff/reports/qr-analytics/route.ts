import type { NextRequest } from 'next/server'
import {
  authenticateStaffKioskRequest,
  staffKioskCurrentRank,
  staffKioskJsonError,
} from '@/lib/security/staffKioskServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// The public site forwards Content Studio and QR scans to this deployment.
const defaultContentStudioOrigin = 'https://vrena-website-10hqzls75-vrentertainment.vercel.app'

function contentStudioOrigin() {
  const configuredOrigin = process.env.VRENA_CONTENT_STUDIO_ORIGIN?.trim() || defaultContentStudioOrigin

  try {
    const url = new URL(configuredOrigin)
    return url.protocol === 'https:' ? url.origin : defaultContentStudioOrigin
  } catch {
    return defaultContentStudioOrigin
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateStaffKioskRequest(request)
  if (auth instanceof Response) return auth

  try {
    if (await staffKioskCurrentRank(auth) < 20) {
      return staffKioskJsonError('Staff report access required.', 403)
    }

    const sharedSecret = process.env.VRENA_QR_ANALYTICS_SHARED_SECRET?.trim()
    if (!sharedSecret) {
      return staffKioskJsonError('QR analytics are not configured on this environment.', 503)
    }

    const upstreamUrl = new URL('/api/internal/qr-analytics', contentStudioOrigin())
    const requestParams = request.nextUrl.searchParams
    for (const key of ['start', 'end', 'compareStart', 'compareEnd']) {
      const value = requestParams.get(key)
      if (value) upstreamUrl.searchParams.set(key, value)
    }

    const response = await fetch(upstreamUrl, {
      cache: 'no-store',
      redirect: 'error',
      headers: { authorization: `Bearer ${sharedSecret}` },
      signal: AbortSignal.timeout(10_000),
    })
    const payload = await response.json().catch(() => null)
    if (!payload || (response.ok && (
      !Number.isFinite(payload.summary?.totalScans) || !payload.comparisonSummary
      || !Array.isArray(payload.scanSeries) || !Array.isArray(payload.deviceMix) || !Array.isArray(payload.qrCodes)
    ))) {
      return staffKioskJsonError('Content Studio returned an invalid response.', 502)
    }

    return Response.json(payload, {
      status: response.status,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'QR analytics took too long to respond.'
      : 'QR analytics are temporarily unavailable.'
    return staffKioskJsonError(message, 503)
  }
}
