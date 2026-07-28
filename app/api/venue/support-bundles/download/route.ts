import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createVenueAdminClient } from '@/lib/venueService'

export const runtime = 'nodejs'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const tokenPattern = /^[0-9a-f]{64}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  const adminClient = createVenueAdminClient()
  if (!adminClient) return jsonError('Venue support download is not configured.', 503)

  const suppliedToken = (request.headers.get('x-vrena-support-token') || '').trim()
  if (!tokenPattern.test(suppliedToken)) return jsonError('Unauthorized.', 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid request.', 400)
  }

  const bundleId = typeof body === 'object' && body !== null && 'bundleId' in body
    ? String(body.bundleId)
    : ''
  if (!uuidPattern.test(bundleId)) return jsonError('Invalid request.', 400)

  const tokenDigest = createHash('sha256').update(suppliedToken).digest('hex')
  const { data, error } = await adminClient.rpc(
    'service_consume_venue_support_bundle_token',
    {
      p_bundle_id: bundleId,
      p_token_digest: tokenDigest,
    },
  )
  if (error) {
    console.error('Venue support download token validation failed', { error: error.message })
    return jsonError('Support bundle download failed.', 500)
  }

  const bundle = Array.isArray(data) ? data[0] as { file_name?: string; storage_path?: string } | undefined : undefined
  if (!bundle?.storage_path || !bundle.file_name) return jsonError('Download token is invalid or expired.', 401)

  const { data: signed, error: signedError } = await adminClient.storage
    .from('venue-support-bundles')
    .createSignedUrl(bundle.storage_path, 60, { download: bundle.file_name })
  if (signedError || !signed?.signedUrl) {
    console.error('Venue support signed URL creation failed', { error: signedError?.message })
    return jsonError('Support bundle download failed.', 500)
  }

  return NextResponse.json({
    expiresInSeconds: 60,
    fileName: bundle.file_name,
    signedUrl: signed.signedUrl,
  })
}
