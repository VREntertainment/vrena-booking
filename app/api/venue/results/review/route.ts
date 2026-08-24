import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  createVenueAdminClient,
  authorizedVenuePrincipal,
  configuredVenueCredentials,
} from '@/lib/venueService'
import { isVenueResultReviewReason } from '@/lib/venueResultReview'

export const runtime = 'nodejs'

const maximumScreenshotBytes = 2_000_000
const maximumOcrCharacters = 100_000
const captureIdPattern = /^[0-9a-f]{64}$/
function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function safeHeader(value: string | null, fallback: string, maximumLength: number) {
  const normalized = (value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return (normalized || fallback).slice(0, maximumLength)
}

export async function POST(request: NextRequest) {
  const adminClient = createVenueAdminClient()
  if (configuredVenueCredentials().length === 0 || !adminClient) {
    return jsonError('Venue result review upload is not configured.', 503)
  }
  const principal = authorizedVenuePrincipal(request)
  if (!principal) return jsonError('Unauthorized.', 401)

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > maximumScreenshotBytes + 250_000) {
    return jsonError('Review screenshot is too large.', 413)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonError('Invalid result review upload.', 400)
  }

  const captureId = String(formData.get('captureId') || '').trim().toLowerCase()
  const capturedAt = String(formData.get('capturedAt') || '').trim()
  const reviewReason = String(formData.get('reviewReason') || '').trim()
  const ocrText = String(formData.get('ocrText') || '').slice(0, maximumOcrCharacters)
  const screenshot = formData.get('screenshot')

  if (!captureIdPattern.test(captureId)) return jsonError('Invalid capture ID.', 400)
  if (!Number.isFinite(Date.parse(capturedAt))) return jsonError('Invalid capture time.', 400)
  if (!isVenueResultReviewReason(reviewReason)) return jsonError('Invalid review reason.', 400)
  if (!(screenshot instanceof File)) return jsonError('Review screenshot is required.', 400)
  if (screenshot.name !== `${captureId}.jpg` || screenshot.type !== 'image/jpeg') {
    return jsonError('Invalid review screenshot.', 400)
  }
  if (screenshot.size < 1 || screenshot.size > maximumScreenshotBytes) {
    return jsonError('Review screenshot is too large.', 413)
  }

  const bytes = Buffer.from(await screenshot.arrayBuffer())
  const hasJpegSignature = bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  if (!hasJpegSignature) return jsonError('Invalid review screenshot.', 400)

  const { data: reservationId, error: reservationError } = await adminClient.rpc('service_reserve_venue_upload', {
    p_bytes: screenshot.size,
    p_upload_kind: 'review',
    p_venue_key: principal.venueKey,
  })
  if (reservationError || typeof reservationId !== 'string') {
    return jsonError('Venue review upload quota reached.', 429)
  }
  const releaseReservation = () => adminClient.rpc('service_release_venue_upload', { p_reservation_id: reservationId })

  const { data: existing, error: existingError } = await adminClient
    .from('venue_result_reviews')
    .select('id, created_at')
    .eq('source_capture_id', captureId)
    .maybeSingle()
  if (existingError) {
    await releaseReservation()
    console.error('Venue result review duplicate check failed', { error: existingError.message })
    return jsonError('Result review upload failed.', 500)
  }
  if (existing) {
    await releaseReservation()
    return NextResponse.json({
      duplicate: true,
      reviewId: existing.id,
      uploadedAt: existing.created_at,
    })
  }

  const now = new Date()
  const reviewId = randomUUID()
  const storagePath = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    reviewId,
    `${captureId}.jpg`,
  ].join('/')
  const sourceDevice = safeHeader(request.headers.get('x-vrena-device-name'), 'Unknown device', 120)
  const appVersion = safeHeader(request.headers.get('x-vrena-app-version'), 'Unknown', 40)

  const { error: uploadError } = await adminClient.storage
    .from('venue-result-reviews')
    .upload(storagePath, bytes, {
      cacheControl: '0',
      contentType: 'image/jpeg',
      upsert: false,
    })
  if (uploadError) {
    await releaseReservation()
    console.error('Venue result review storage upload failed', {
      error: uploadError.message,
      fileSize: screenshot.size,
    })
    return jsonError('Result review upload failed.', 500)
  }

  const { error: metadataError } = await adminClient
    .from('venue_result_reviews')
    .insert({
      app_version: appVersion,
      captured_at: new Date(capturedAt).toISOString(),
      id: reviewId,
      file_size_bytes: screenshot.size,
      ocr_text: ocrText,
      review_reason: reviewReason,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      source_capture_id: captureId,
      source_device: sourceDevice,
      storage_path: storagePath,
      venue_key: principal.venueKey,
    })

  if (metadataError) {
    await adminClient.storage.from('venue-result-reviews').remove([storagePath])
    await releaseReservation()
    console.error('Venue result review metadata insert failed', { error: metadataError.message })
    return jsonError('Result review upload failed.', 500)
  }

  await releaseReservation()

  return NextResponse.json({
    duplicate: false,
    reviewId,
    uploadedAt: now.toISOString(),
  })
}
