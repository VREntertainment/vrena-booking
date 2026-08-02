import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { trustedClientIp, UNKNOWN_CLIENT_IP } from '@/lib/security/requestIp'
import { staffRoleRank } from '@/lib/staffRoles'

export const runtime = 'nodejs'

const EVENT_NAMES = new Set(['page_view', 'engagement', 'search'])
const DEVICE_CLASSES = new Set(['mobile', 'tablet', 'desktop'])
const INTERNAL_PATH = /^\/(staff|hr|admin)(\/|$)/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type AnalyticsInsert = {
  client_id: string
  session_id: string
  profile_id: string | null
  event_name: string
  path: string
  device_class: string
  browser_family: string
  os_family: string
  viewport_bucket: string
  referrer_host: string | null
  acquisition_source: string | null
  acquisition_medium: string | null
  acquisition_campaign: string | null
  duration_seconds: number | null
  search_surface: string | null
  search_query_length: number | null
  search_result_count: number | null
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function nullableString(value: unknown, maxLength: number) {
  return cleanString(value, maxLength) || null
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

function cleanPath(value: unknown) {
  const raw = cleanString(value, 240)
  if (!raw.startsWith('/')) return null
  const path = raw.split(/[?#]/, 1)[0]?.replace(/\/{2,}/g, '/') || '/'
  if (path.length > 180 || INTERNAL_PATH.test(path)) return null
  return path
}

function sameOriginRequest(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site'
  try {
    return new URL(origin).host === request.nextUrl.host
  } catch {
    return false
  }
}

function cleanEvent(value: unknown, profileId: string | null): AnalyticsInsert | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Record<string, unknown>
  const eventName = cleanString(event.eventName, 24)
  const clientId = cleanString(event.clientId, 36)
  const sessionId = cleanString(event.sessionId, 36)
  const path = cleanPath(event.path)
  const deviceClass = cleanString(event.deviceClass, 12)
  if (!EVENT_NAMES.has(eventName) || !UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(sessionId) || !path) return null
  if (!DEVICE_CLASSES.has(deviceClass)) return null

  const durationSeconds = eventName === 'engagement'
    ? boundedInteger(event.durationSeconds, 1, 1800)
    : null
  if (eventName === 'engagement' && durationSeconds === null) return null

  const searchQueryLength = eventName === 'search'
    ? boundedInteger(event.searchQueryLength, 0, 240)
    : null
  if (eventName === 'search' && searchQueryLength === null) return null

  return {
    client_id: clientId,
    session_id: sessionId,
    profile_id: profileId,
    event_name: eventName,
    path,
    device_class: deviceClass,
    browser_family: cleanString(event.browserFamily, 40) || 'Other',
    os_family: cleanString(event.osFamily, 40) || 'Other',
    viewport_bucket: cleanString(event.viewportBucket, 24) || 'unknown',
    referrer_host: nullableString(event.referrerHost, 120),
    acquisition_source: nullableString(event.acquisitionSource, 80),
    acquisition_medium: nullableString(event.acquisitionMedium, 80),
    acquisition_campaign: nullableString(event.acquisitionCampaign, 120),
    duration_seconds: durationSeconds,
    search_surface: eventName === 'search' ? nullableString(event.searchSurface, 80) : null,
    search_query_length: searchQueryLength,
    search_result_count: eventName === 'search' ? boundedInteger(event.searchResultCount, 0, 10000) : null,
  }
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return jsonError('Cross-site analytics requests are not accepted.', 403)

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > 16_384) return jsonError('Analytics payload is too large.', 413)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) return jsonError('Analytics is not configured.', 503)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid analytics payload.', 400)
  }

  const accessToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  let profileId: string | null = null
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  if (accessToken) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await authClient.auth.getUser(accessToken)
    profileId = data.user?.id || null

    if (profileId) {
      const { data: analyticsProfile, error: profileError } = await adminClient
        .from('profiles')
        .select('role, email')
        .eq('id', profileId)
        .maybeSingle()
      if (profileError) return NextResponse.json({ accepted: 0 }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
      if (analyticsProfile && staffRoleRank(analyticsProfile.role, analyticsProfile.email) >= 20) {
        return NextResponse.json({ accepted: 0 }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
      }
      if (!analyticsProfile) profileId = null
    }
  }

  const rawEvents = Array.isArray(body) ? body.slice(0, 10) : [body]
  const events = rawEvents
    .map((event) => cleanEvent(event, profileId))
    .filter((event): event is AnalyticsInsert => event !== null)
  if (events.length === 0 || events.length !== rawEvents.length) return jsonError('Invalid analytics event.', 400)

  const clientId = events[0].client_id
  const ip = trustedClientIp(request.headers)
  const limitChecks = [
    adminClient.rpc('consume_rate_limit', {
      p_action: 'product_analytics',
      p_limit: 90,
      p_window_seconds: 60,
      p_subject: `client:${clientId}`,
    }),
  ]
  if (ip !== UNKNOWN_CLIENT_IP) {
    limitChecks.push(adminClient.rpc('consume_rate_limit', {
      p_action: 'product_analytics',
      p_limit: 240,
      p_window_seconds: 60,
      p_subject: `ip:${ip}`,
    }))
  }

  const rateLimitResults = await Promise.all(limitChecks)
  if (rateLimitResults.some((result) => result.error)) return jsonError('Analytics rate limit reached.', 429)

  const { error } = await adminClient.from('app_analytics_events').insert(events)
  if (error) {
    console.error('Could not record product analytics event.', error.code)
    return jsonError('Analytics is temporarily unavailable.', 503)
  }

  return NextResponse.json({ accepted: events.length }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
}
