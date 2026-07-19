import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBookingUpdateEmail } from '@/lib/bookingUpdateEmail'
import type { BookingUpdateEmailPayload } from '@/lib/bookingUpdateEmailTypes'
import { staffConsoleRoleRank as staffRank } from '@/lib/staffRoles'
import { hasVerifiedAal2Session, hasVerifiedMfaFactor } from '@/lib/security/staffMfa'
import { ageBandFromBirthday } from '@/lib/agePolicy'

export const runtime = 'nodejs'

const BOOKING_UPDATE_EMAIL_LIMIT = 3
const BOOKING_UPDATE_EMAIL_WINDOW_SECONDS = 5 * 60

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanLimitedString(value: unknown, maxLength: number) {
  return cleanString(value).slice(0, maxLength)
}

function cleanChangeValue(value: unknown) {
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return cleanLimitedString(value, 500) || null
}

function cleanAction(value: unknown): BookingUpdateEmailPayload['action'] | null {
  return value === 'created' || value === 'edited' || value === 'cancelled' || value === 'deleted' ? value : null
}

function cleanKind(value: unknown): BookingUpdateEmailPayload['bookingKind'] | null {
  return value === 'session' || value === 'ticket' ? value : null
}

function cleanPayload(body: Record<string, unknown>): BookingUpdateEmailPayload | null {
  const action = cleanAction(body.action)
  const bookingKind = cleanKind(body.bookingKind)
  if (!action || !bookingKind) return null

  const changes = Array.isArray(body.changes)
    ? body.changes
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const change = item as Record<string, unknown>
        const label = cleanLimitedString(change.label, 120)
        if (!label) return null
        return {
          label,
          before: cleanChangeValue(change.before),
          after: cleanChangeValue(change.after),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 12)
    : []

  return {
    action,
    bookingKind,
    sessionId: cleanLimitedString(body.sessionId, 64) || null,
    orderId: cleanLimitedString(body.orderId, 64) || null,
    title: cleanLimitedString(body.title, 200) || null,
    reference: cleanLimitedString(body.reference, 120) || null,
    date: cleanLimitedString(body.date, 40) || null,
    time: cleanLimitedString(body.time, 40) || null,
    customerName: cleanLimitedString(body.customerName, 160) || null,
    customerPhone: cleanLimitedString(body.customerPhone, 80) || null,
    customerEmail: cleanLimitedString(body.customerEmail, 320) || null,
    total: typeof body.total === 'number' && Number.isFinite(body.total) ? body.total : null,
    summary: cleanLimitedString(body.summary, 2000) || null,
    minorWarning: cleanLimitedString(body.minorWarning, 500) || null,
    source: cleanLimitedString(body.source, 120) || null,
    changes,
  }
}

function minorWarningForBirthday(birthday: unknown) {
  if (typeof birthday !== 'string') return null
  const band = ageBandFromBirthday(birthday)
  if (band === 'minor') {
    return 'MINOR PLAYER: This user is under 18. Parent/guardian confirmation is required before confirming this booking/session.'
  }
  if (band === 'under13') {
    return 'UNDER-13 PLAYER: Online booking/session creation should remain disabled. Staff must handle this manually with a parent/guardian.'
  }
  return null
}

function canonicalAction(
  requestedAction: BookingUpdateEmailPayload['action'],
  session: Record<string, unknown> | null,
  order: Record<string, unknown> | null,
  allowCreatedNotice: boolean,
): BookingUpdateEmailPayload['action'] {
  if (session?.deleted_at) return 'deleted'
  if (session?.status === 'cancelled' || session?.ticket_status === 'cancelled' || order?.order_status === 'cancelled') {
    return 'cancelled'
  }
  const createdAt = Date.parse(cleanString(session?.created_at))
  const isRecentlyCreated = Number.isFinite(createdAt) && Date.now() - createdAt >= 0 && Date.now() - createdAt <= 10 * 60 * 1000
  return requestedAction === 'created' && allowCreatedNotice && isRecentlyCreated ? 'created' : 'edited'
}

function playerSummary(action: BookingUpdateEmailPayload['action']) {
  if (action === 'created') return 'A booking was created by a player account and needs staff attention.'
  if (action === 'deleted') return 'The booking was deleted.'
  if (action === 'cancelled') return 'Booking status was changed to cancelled.'
  return 'Booking details were edited.'
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError('Booking update email is not configured on this environment.', 500)
  }

  const authorization = request.headers.get('authorization') || ''
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) return jsonError('Login required.', 401)

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken)
  if (userError || !userData.user) return jsonError(userError?.message || 'Login required.', 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid booking update payload.', 400)
  }

  const payload = cleanPayload(body)
  if (!payload) return jsonError('Invalid booking update payload.', 400)
  if (!payload.sessionId && !payload.orderId) return jsonError('Booking identifier is required.', 400)

  const { data: actorProfile, error: actorError } = await adminClient
    .from('profiles')
    .select('id, email, role, deleted_at')
    .eq('id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (actorError) return jsonError(actorError.message, 500)

  const actorRank = Math.max(
    staffRank(actorProfile?.role, actorProfile?.email),
    staffRank(userData.user.app_metadata?.role as string | undefined, userData.user.email),
  )
  if (actorRank >= 20) {
    const [hasAal2, hasMfaFactor] = await Promise.all([
      hasVerifiedAal2Session(authClient, accessToken),
      hasVerifiedMfaFactor(adminClient, userData.user.id),
    ])
    if (!hasAal2 || !hasMfaFactor) return jsonError('Staff two-step verification required.', 403)
  }

  let session: Record<string, unknown> | null = null
  if (payload.sessionId) {
    const { data, error } = await adminClient
      .from('sessions')
      .select('id, owner_id, name, date, start_time, duration_minutes, max_players, booking_type, ticket_reference, ticket_type, ticket_status, ticket_total_price, status, ticket_customer_id, deleted_at, created_at')
      .eq('id', payload.sessionId)
      .maybeSingle()

    if (error) return jsonError(error.message, 500)
    if (!data) return jsonError('Booking session not found.', 404)
    session = data
  }

  let order: Record<string, unknown> | null = null
  if (payload.orderId) {
    const { data, error } = await adminClient
      .from('staff_orders')
      .select('id, order_number, session_id, customer_id, customer_name, customer_phone, customer_email, booking_date, booking_time, total, payment_status, order_status')
      .eq('id', payload.orderId)
      .maybeSingle()

    if (error) return jsonError(error.message, 500)
    if (!data) return jsonError('Booking order not found.', 404)
    order = data
  } else if (payload.sessionId) {
    const { data, error } = await adminClient
      .from('staff_orders')
      .select('id, order_number, session_id, customer_id, customer_name, customer_phone, customer_email, booking_date, booking_time, total, payment_status, order_status')
      .eq('session_id', payload.sessionId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) return jsonError(error.message, 500)
    order = data?.[0] || null
  }

  if (!session && order?.session_id) {
    const { data, error } = await adminClient
      .from('sessions')
      .select('id, owner_id, name, date, start_time, duration_minutes, max_players, booking_type, ticket_reference, ticket_type, ticket_status, ticket_total_price, status, ticket_customer_id, deleted_at, created_at')
      .eq('id', order.session_id)
      .maybeSingle()

    if (error) return jsonError(error.message, 500)
    session = data || null
  }

  if (payload.sessionId && order && cleanString(order.session_id) !== cleanString(session?.id)) {
    return jsonError('Booking identifiers do not refer to the same booking.', 400)
  }

  const isOwner = Boolean(session?.owner_id && session.owner_id === userData.user.id)
  if (actorRank < 50 && !isOwner) return jsonError('Booking update email is not authorized.', 403)

  const canonicalSessionId = cleanString(session?.id)
  const canonicalOrderId = cleanString(order?.id)
  const rateLimitBookingId = canonicalSessionId || canonicalOrderId
  if (!rateLimitBookingId) return jsonError('Booking not found.', 404)

  const { error: rateLimitError } = await adminClient.rpc('consume_rate_limit', {
    p_action: 'booking_update_email',
    p_limit: BOOKING_UPDATE_EMAIL_LIMIT,
    p_window_seconds: BOOKING_UPDATE_EMAIL_WINDOW_SECONDS,
    p_subject: `actor:${userData.user.id}:booking:${rateLimitBookingId}`,
  })

  if (rateLimitError) {
    const isRateLimited = rateLimitError.message.includes('Too many attempts')
    return jsonError(
      isRateLimited
        ? 'Too many booking notifications. Please wait a few minutes and try again.'
        : 'Booking notification security checks are temporarily unavailable.',
      isRateLimited ? 429 : 503,
    )
  }

  const minorProfileId = cleanString(session?.ticket_customer_id) || cleanString(session?.owner_id)
  let trustedMinorWarning: string | null = null
  let bookingProfile: Record<string, unknown> | null = null
  if (minorProfileId) {
    const { data: minorProfile, error: minorProfileError } = await adminClient
      .from('profiles')
      .select('birthday, full_name, nickname, email, phone')
      .eq('id', minorProfileId)
      .maybeSingle()

    if (minorProfileError) return jsonError(minorProfileError.message, 500)
    bookingProfile = minorProfile
    trustedMinorWarning = minorWarningForBirthday(minorProfile?.birthday)
  }

  const isStaffActor = actorRank >= 50
  const action = canonicalAction(
    payload.action,
    session,
    order,
    isStaffActor || Boolean(trustedMinorWarning?.startsWith('MINOR PLAYER:')),
  )

  await sendBookingUpdateEmail({
    ...payload,
    action,
    sessionId: canonicalSessionId || payload.sessionId || null,
    orderId: canonicalOrderId || payload.orderId || null,
    bookingKind: session ? (session.booking_type === 'ticket' ? 'ticket' : 'session') : payload.bookingKind,
    title: cleanString(session?.name) || (isStaffActor ? payload.title : null),
    reference: cleanString(order?.order_number)
      || cleanString(session?.ticket_reference)
      || (isStaffActor ? payload.reference : null),
    date: cleanString(order?.booking_date)
      || cleanString(session?.date)
      || (isStaffActor ? payload.date : null),
    time: cleanString(order?.booking_time).slice(0, 5)
      || cleanString(session?.start_time).slice(0, 5)
      || (isStaffActor ? payload.time : null),
    customerName: cleanString(order?.customer_name)
      || cleanString(bookingProfile?.nickname)
      || cleanString(bookingProfile?.full_name)
      || (isStaffActor ? payload.customerName : null),
    customerPhone: cleanString(order?.customer_phone)
      || cleanString(bookingProfile?.phone)
      || (isStaffActor ? payload.customerPhone : null),
    customerEmail: cleanString(order?.customer_email)
      || cleanString(bookingProfile?.email)
      || (isStaffActor ? payload.customerEmail : null),
    total: typeof order?.total === 'number'
      ? order.total
      : typeof session?.ticket_total_price === 'number'
        ? session.ticket_total_price
        : isStaffActor ? payload.total : null,
    summary: isStaffActor ? payload.summary : playerSummary(action),
    changes: isStaffActor ? payload.changes : [],
    minorWarning: trustedMinorWarning || (isStaffActor ? payload.minorWarning : null),
    source: isStaffActor ? payload.source : 'Player booking flow',
    actorEmail: actorProfile?.email || userData.user.email || null,
  })

  return NextResponse.json({ ok: true })
}
