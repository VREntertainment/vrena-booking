import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendBookingUpdateEmail } from '@/lib/bookingUpdateEmail'
import type { BookingUpdateEmailPayload } from '@/lib/bookingUpdateEmailTypes'
import { staffConsoleRoleRank as staffRank } from '@/lib/staffRoles'
import { hasVerifiedAal2Session, hasVerifiedMfaFactor } from '@/lib/security/staffMfa'
import { ageBandFromBirthday } from '@/lib/agePolicy'

export const runtime = 'nodejs'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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
        const label = cleanString(change.label)
        if (!label) return null
        return {
          label,
          before: typeof change.before === 'number' || typeof change.before === 'boolean' ? change.before : cleanString(change.before) || null,
          after: typeof change.after === 'number' || typeof change.after === 'boolean' ? change.after : cleanString(change.after) || null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 12)
    : []

  return {
    action,
    bookingKind,
    sessionId: cleanString(body.sessionId) || null,
    orderId: cleanString(body.orderId) || null,
    title: cleanString(body.title) || null,
    reference: cleanString(body.reference) || null,
    date: cleanString(body.date) || null,
    time: cleanString(body.time) || null,
    customerName: cleanString(body.customerName) || null,
    customerPhone: cleanString(body.customerPhone) || null,
    customerEmail: cleanString(body.customerEmail) || null,
    total: typeof body.total === 'number' && Number.isFinite(body.total) ? body.total : null,
    summary: cleanString(body.summary) || null,
    minorWarning: cleanString(body.minorWarning) || null,
    source: cleanString(body.source) || null,
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
      .select('id, owner_id, name, date, start_time, duration_minutes, max_players, booking_type, ticket_reference, ticket_type, ticket_status, status, ticket_customer_id')
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
    if (data) order = data
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
      .select('id, owner_id, name, date, start_time, duration_minutes, max_players, booking_type, ticket_reference, ticket_type, ticket_status, status, ticket_customer_id')
      .eq('id', order.session_id)
      .maybeSingle()

    if (error) return jsonError(error.message, 500)
    session = data || null
  }

  const isOwner = Boolean(session?.owner_id && session.owner_id === userData.user.id)
  if (actorRank < 50 && !isOwner) return jsonError('Booking update email is not authorized.', 403)

  const minorProfileId = cleanString(session?.ticket_customer_id) || cleanString(session?.owner_id)
  let trustedMinorWarning: string | null = null
  if (minorProfileId) {
    const { data: minorProfile, error: minorProfileError } = await adminClient
      .from('profiles')
      .select('birthday')
      .eq('id', minorProfileId)
      .maybeSingle()

    if (minorProfileError) return jsonError(minorProfileError.message, 500)
    trustedMinorWarning = minorWarningForBirthday(minorProfile?.birthday)
  }

  await sendBookingUpdateEmail({
    ...payload,
    sessionId: cleanString(session?.id) || payload.sessionId || null,
    orderId: cleanString(order?.id) || payload.orderId || null,
    bookingKind: payload.bookingKind === 'ticket' || session?.booking_type === 'ticket' ? 'ticket' : 'session',
    title: payload.title || cleanString(session?.name) || null,
    reference: payload.reference || cleanString(order?.order_number) || cleanString(session?.ticket_reference) || null,
    date: payload.date || cleanString(order?.booking_date) || cleanString(session?.date) || null,
    time: payload.time || cleanString(order?.booking_time).slice(0, 5) || cleanString(session?.start_time).slice(0, 5) || null,
    customerName: payload.customerName || cleanString(order?.customer_name) || null,
    customerPhone: payload.customerPhone || cleanString(order?.customer_phone) || null,
    customerEmail: payload.customerEmail || cleanString(order?.customer_email) || null,
    total: payload.total ?? (typeof order?.total === 'number' ? order.total : null),
    minorWarning: trustedMinorWarning || payload.minorWarning || null,
    actorEmail: actorProfile?.email || userData.user.email || null,
  })

  return NextResponse.json({ ok: true })
}
