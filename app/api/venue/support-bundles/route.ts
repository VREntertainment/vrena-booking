import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  createVenueAdminClient,
  isAuthorizedVenueRequest,
  usableVenueToken,
} from '@/lib/venueService'

export const runtime = 'nodejs'

const maximumBundleBytes = 3_500_000
const bundleNamePattern = /^VRena-Results-Capture-Support-\d{8}-\d{6}\.zip$/

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function safeHeader(value: string | null, fallback: string, maximumLength: number) {
  const normalized = (value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return (normalized || fallback).slice(0, maximumLength)
}

export async function POST(request: NextRequest) {
  const configuredToken = process.env.VRENA_RESULTS_INGEST_TOKEN
  const adminClient = createVenueAdminClient()
  if (!usableVenueToken(configuredToken) || !adminClient) {
    return jsonError('Venue support upload is not configured.', 503)
  }
  if (!isAuthorizedVenueRequest(request, configuredToken)) return jsonError('Unauthorized.', 401)

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > maximumBundleBytes + 100_000) return jsonError('Support bundle is too large.', 413)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('Invalid support bundle upload.', 400)
  }

  const bundle = formData.get('bundle')
  if (!(bundle instanceof File)) return jsonError('Support bundle file is required.', 400)
  if (!bundleNamePattern.test(bundle.name)) return jsonError('Invalid support bundle file name.', 400)
  if (bundle.size < 1 || bundle.size > maximumBundleBytes) {
    return jsonError('Support bundle is too large.', 413)
  }

  const bytes = Buffer.from(await bundle.arrayBuffer())
  const hasZipSignature = bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))
  if (!hasZipSignature) return jsonError('Invalid support bundle file.', 400)

  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const now = new Date()
  const bundleId = randomUUID()
  const storagePath = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    bundleId,
    bundle.name,
  ].join('/')
  const sourceDevice = safeHeader(request.headers.get('x-vrena-device-name'), 'Unknown device', 120)
  const appVersion = safeHeader(request.headers.get('x-vrena-app-version'), 'Unknown', 40)

  const { error: uploadError } = await adminClient.storage
    .from('venue-support-bundles')
    .upload(storagePath, bytes, {
      cacheControl: '0',
      contentType: 'application/zip',
      upsert: false,
    })
  if (uploadError) {
    console.error('Venue support bundle storage upload failed', {
      error: uploadError.message,
      fileSize: bundle.size,
    })
    return jsonError('Support bundle upload failed.', 500)
  }

  const { error: metadataError } = await adminClient
    .from('venue_support_bundles')
    .insert({
      app_version: appVersion,
      file_name: bundle.name,
      file_size_bytes: bundle.size,
      id: bundleId,
      sha256,
      source_device: sourceDevice,
      storage_path: storagePath,
    })

  if (metadataError) {
    await adminClient.storage.from('venue-support-bundles').remove([storagePath])
    console.error('Venue support bundle metadata insert failed', { error: metadataError.message })
    return jsonError('Support bundle upload failed.', 500)
  }

  return NextResponse.json({
    bundleId,
    sha256,
    uploadedAt: now.toISOString(),
  })
}
