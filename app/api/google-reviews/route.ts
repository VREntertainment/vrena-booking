import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const GOOGLE_PLACES_TIMEOUT_MS = 8_000
const GOOGLE_PLACES_CACHE_SECONDS = 60 * 60
const GOOGLE_PLACES_FIELD_MASK = [
  'id',
  'displayName',
  'rating',
  'userRatingCount',
  'googleMapsUri',
  'googleMapsLinks.reviewsUri',
  'googleMapsLinks.writeAReviewUri',
  'reviews.name',
  'reviews.relativePublishTimeDescription',
  'reviews.text',
  'reviews.originalText',
  'reviews.rating',
  'reviews.authorAttribution',
  'reviews.publishTime',
  'reviews.flagContentUri',
  'reviews.googleMapsUri',
].join(',')

const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.vre-vietnam.com',
  'https://vre-vietnam.com',
  'https://pepper-arugula-7b5k.squarespace.com',
]

const LANGUAGE_ALIASES: Record<string, string> = {
  cn: 'zh-CN',
  de: 'de',
  en: 'en',
  fr: 'fr',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  vi: 'vi',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
}

type LocalizedText = {
  text?: unknown
  languageCode?: unknown
}

type GoogleReview = {
  name?: unknown
  relativePublishTimeDescription?: unknown
  text?: LocalizedText
  originalText?: LocalizedText
  rating?: unknown
  authorAttribution?: {
    displayName?: unknown
    uri?: unknown
    photoUri?: unknown
  }
  publishTime?: unknown
  flagContentUri?: unknown
  googleMapsUri?: unknown
}

type GooglePlace = {
  id?: unknown
  displayName?: LocalizedText
  rating?: unknown
  userRatingCount?: unknown
  googleMapsUri?: unknown
  googleMapsLinks?: {
    reviewsUri?: unknown
    writeAReviewUri?: unknown
  }
  reviews?: unknown
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, '')
}

function allowedOrigins() {
  const configuredOrigins = (process.env.GOOGLE_REVIEWS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])
}

function corsHeaders(request: NextRequest) {
  const origin = normalizeOrigin(request.headers.get('origin') || '')
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  })

  if (origin && allowedOrigins().has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  return { headers, origin, permitted: !origin || allowedOrigins().has(origin) }
}

function languageCode(request: NextRequest) {
  const requested = cleanString(
    request.nextUrl.searchParams.get('language') || request.nextUrl.searchParams.get('lang'),
  ).toLowerCase()

  return LANGUAGE_ALIASES[requested] || 'en'
}

function errorResponse(request: NextRequest, message: string, status: number) {
  const { headers } = corsHeaders(request)
  headers.set('Cache-Control', 'no-store')
  return NextResponse.json({ error: message }, { status, headers })
}

function isGoogleReview(value: unknown): value is GoogleReview {
  return Boolean(value && typeof value === 'object')
}

function normalizeReview(review: GoogleReview, index: number) {
  const translatedText = cleanString(review.text?.text)
  const originalText = cleanString(review.originalText?.text)

  return {
    id: cleanString(review.name) || `review-${index + 1}`,
    author: {
      name: cleanString(review.authorAttribution?.displayName) || 'Google reviewer',
      profileUri: cleanString(review.authorAttribution?.uri) || null,
      photoUri: cleanString(review.authorAttribution?.photoUri) || null,
    },
    rating: cleanNumber(review.rating),
    text: translatedText || originalText,
    originalText: originalText || translatedText,
    language: cleanString(review.text?.languageCode || review.originalText?.languageCode) || null,
    relativeTime: cleanString(review.relativePublishTimeDescription) || null,
    publishTime: cleanString(review.publishTime) || null,
    googleMapsUri: cleanString(review.googleMapsUri) || null,
    flagContentUri: cleanString(review.flagContentUri) || null,
  }
}

export async function OPTIONS(request: NextRequest) {
  const { headers, permitted } = corsHeaders(request)
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Cache-Control', 'public, max-age=86400')

  if (!permitted) {
    return NextResponse.json({ error: 'Origin is not allowed.' }, { status: 403, headers })
  }

  return new NextResponse(null, { status: 204, headers })
}

export async function GET(request: NextRequest) {
  const { headers, permitted } = corsHeaders(request)
  if (!permitted) {
    return errorResponse(request, 'Origin is not allowed.', 403)
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const placeId = process.env.GOOGLE_PLACES_PLACE_ID
  if (!apiKey || !placeId) {
    return errorResponse(request, 'Google reviews are not configured on this environment.', 503)
  }

  const language = languageCode(request)
  const endpoint = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`)
  endpoint.searchParams.set('languageCode', language)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GOOGLE_PLACES_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(endpoint, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': GOOGLE_PLACES_FIELD_MASK,
      },
      signal: controller.signal,
      next: { revalidate: GOOGLE_PLACES_CACHE_SECONDS },
    })
  } catch {
    return errorResponse(request, 'Google reviews are temporarily unavailable.', 502)
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    return errorResponse(request, 'Google reviews are temporarily unavailable.', 502)
  }

  let place: GooglePlace
  try {
    place = (await response.json()) as GooglePlace
  } catch {
    return errorResponse(request, 'Google reviews returned an invalid response.', 502)
  }

  const reviews = Array.isArray(place.reviews)
    ? place.reviews.filter(isGoogleReview).map(normalizeReview)
    : []

  headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=21600')

  return NextResponse.json(
    {
      source: 'google',
      attribution: 'Google Maps',
      order: 'relevance',
      language,
      place: {
        id: cleanString(place.id) || placeId,
        name: cleanString(place.displayName?.text) || 'VRena',
        rating: cleanNumber(place.rating),
        userRatingCount: cleanNumber(place.userRatingCount),
        googleMapsUri: cleanString(place.googleMapsUri) || null,
        reviewsUri: cleanString(place.googleMapsLinks?.reviewsUri) || null,
        writeAReviewUri: cleanString(place.googleMapsLinks?.writeAReviewUri) || null,
      },
      reviews,
      fetchedAt: new Date().toISOString(),
    },
    { headers },
  )
}
