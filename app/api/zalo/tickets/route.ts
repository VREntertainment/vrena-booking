import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { arenaTimeOptions, type ArenaOccupancy } from '@/lib/booking/arenaAvailability'
import { trustedClientIp } from '@/lib/security/requestIp'
import {
  checkoutTokenFromExtradata,
  createOrderMac,
  createOrderStatusMac,
  ZALO_BOOKING_MINI_APP_ID,
  ZALO_CHECKOUT_METHOD,
  ZALO_CHECKOUT_STATUS_URL,
  type ZaloCheckoutOrderStatus,
  type ZaloCreateOrderParams,
} from '@/lib/zaloCheckout'
import { finalizeZaloCheckoutSelection } from '@/lib/zaloCheckoutBooking'
import {
  buildZaloMiniAppBookingRequest,
  normalizeZaloMiniAppQuoteSelection,
  normalizeZaloMiniAppBookingSelection,
  zaloMiniAppVenues,
} from '@/lib/zaloMiniAppBooking'

export const runtime = 'nodejs'
export const maxDuration = 30

const ZALO_MINI_APP_ORIGIN = 'https://h5.zdn.vn'

function requestOrigin(request: NextRequest) {
  return request.headers.get('origin')?.trim() || null
}

function isAllowedOrigin(origin: string | null) {
  if (!origin || origin === ZALO_MINI_APP_ORIGIN) return true
  if (process.env.NODE_ENV === 'production') return false
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

function corsHeaders(request: NextRequest) {
  const origin = requestOrigin(request)
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    Vary: 'Origin',
  })
  if (origin && isAllowedOrigin(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

function reply(request: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) })
}

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function parseBody(request: NextRequest) {
  const raw = await request.text()
  if (raw.length > 16_384) throw new Error('Booking request too large.')
  const body = JSON.parse(raw)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid booking request.')
  return body as Record<string, unknown>
}

function cleanToken(value: unknown) {
  const token = typeof value === 'string' ? value.trim() : ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)
    ? token
    : ''
}

function cleanOrderId(value: unknown) {
  const orderId = typeof value === 'string' ? value.trim() : ''
  return orderId.length >= 1 && orderId.length <= 200 && !/[\u0000-\u001f\u007f]/.test(orderId)
    ? orderId
    : ''
}

function confirmationPayload(confirmation: Record<string, unknown>) {
  return {
    reference: confirmation.ticket_reference,
    sessionId: confirmation.session_id,
    totalPrice: confirmation.totalPrice,
    displayTotal: confirmation.displayTotal,
    requiresStaffConfirmation: false,
    venue: confirmation.venue,
    date: confirmation.date,
    time: confirmation.time,
  }
}

async function fetchZaloOrderStatus(privateKey: string, orderId: string) {
  const url = new URL(ZALO_CHECKOUT_STATUS_URL)
  url.searchParams.set('appId', ZALO_BOOKING_MINI_APP_ID)
  url.searchParams.set('orderId', orderId)
  url.searchParams.set('mac', createOrderStatusMac(privateKey, orderId))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) return null
    const payload = await response.json() as ZaloCheckoutOrderStatus
    return Number.isInteger(Number(payload.returnCode)) ? payload : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function OPTIONS(request: NextRequest) {
  if (!isAllowedOrigin(requestOrigin(request))) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(requestOrigin(request))) {
    return reply(request, { data: null, error: { message: 'Request origin is not allowed.' } }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await parseBody(request)
  } catch (error) {
    return reply(request, { data: null, error: { message: error instanceof Error ? error.message : 'Invalid booking request.' } }, 400)
  }

  if (body.action === 'availability') {
    const client = anonClient()
    if (!client) return reply(request, { data: null, error: { message: 'Booking is temporarily unavailable.' } }, 503)
    const venue = typeof body.venue === 'string' ? body.venue : ''
    const date = typeof body.date === 'string' ? body.date : ''
    const durationMinutes = Number(body.durationMinutes)
    const arenaCount = Number(body.arenaCount)
    if (!zaloMiniAppVenues.includes(venue as (typeof zaloMiniAppVenues)[number])
      || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 180
      || !Number.isInteger(arenaCount) || arenaCount < 1 || arenaCount > (venue === 'ha-do-centrosa' ? 2 : 1)) {
      return reply(request, { data: null, error: { message: 'Choose a valid venue, date, and duration.' } }, 400)
    }

    const { data, error } = await client.rpc('booking_arena_occupancy', { p_from: date, p_to: date })
    if (error) return reply(request, { data: null, error: { message: error.message } }, 400)
    const times = arenaTimeOptions(venue, date, durationMinutes, arenaCount, (data || []) as ArenaOccupancy[])
    return reply(request, { data: { times }, error: null })
  }

  if (body.action === 'quote') {
    const normalized = normalizeZaloMiniAppQuoteSelection(body.selection)
    if (!normalized.data) return reply(request, { data: null, error: { message: normalized.error } }, 400)
    const { quote } = buildZaloMiniAppBookingRequest(normalized.data)
    return reply(request, {
      data: {
        displayTotal: quote.displayTotal,
        durationMinutes: quote.durationMinutes,
        players: quote.players,
        arenaCount: quote.arenaCount,
      },
      error: null,
    })
  }

  const admin = adminClient()
  if (!admin) return reply(request, { data: null, error: { message: 'Booking is temporarily unavailable.' } }, 503)

  if (body.action === 'register') {
    const checkoutToken = cleanToken(body.checkoutToken)
    const orderId = cleanOrderId(body.orderId)
    if (!checkoutToken || !orderId) {
      return reply(request, { data: null, error: { message: 'Invalid Checkout order reference.' } }, 400)
    }
    const { data: checkout, error: lookupError } = await admin
      .from('zalo_checkout_bookings')
      .select('status, zmp_order_id, expires_at')
      .eq('checkout_token', checkoutToken)
      .maybeSingle()
    if (lookupError || !checkout) return reply(request, { data: null, error: { message: 'Checkout reference was not found.' } }, 404)
    if (checkout.status !== 'pending' || new Date(checkout.expires_at).getTime() <= Date.now()) {
      return reply(request, { data: null, error: { message: 'Checkout request is no longer active.' } }, 409)
    }
    if (checkout.zmp_order_id && checkout.zmp_order_id !== orderId) {
      return reply(request, { data: null, error: { message: 'Checkout order reference does not match.' } }, 409)
    }
    if (!checkout.zmp_order_id) {
      const { data: updated, error: updateError } = await admin.from('zalo_checkout_bookings').update({
        zmp_order_id: orderId,
        updated_at: new Date().toISOString(),
      }).eq('checkout_token', checkoutToken).eq('status', 'pending').is('zmp_order_id', null)
        .select('zmp_order_id').maybeSingle()
      if (updateError) return reply(request, { data: null, error: { message: 'Checkout order could not be recorded.' } }, 409)
      if (!updated) {
        const { data: current } = await admin.from('zalo_checkout_bookings')
          .select('zmp_order_id').eq('checkout_token', checkoutToken).maybeSingle()
        if (current?.zmp_order_id !== orderId) {
          return reply(request, { data: null, error: { message: 'Checkout order reference does not match.' } }, 409)
        }
      }
    }
    return reply(request, { data: { registered: true }, error: null })
  }

  if (body.action === 'status') {
    const checkoutToken = cleanToken(body.checkoutToken)
    if (!checkoutToken) return reply(request, { data: null, error: { message: 'Invalid Checkout reference.' } }, 400)
    const { data, error } = await admin
      .from('zalo_checkout_bookings')
      .select('status, booking_response, failure_message, expires_at, created_at, zmp_order_id, expected_amount')
      .eq('checkout_token', checkoutToken)
      .maybeSingle()
    if (error) return reply(request, { data: null, error: { message: 'Checkout status is temporarily unavailable.' } }, 503)
    if (!data) return reply(request, { data: null, error: { message: 'Checkout reference was not found.' } }, 404)
    if (data.status === 'confirmed' && data.booking_response) {
      return reply(request, {
        data: {
          status: 'confirmed',
          confirmation: confirmationPayload(data.booking_response as Record<string, unknown>),
        },
        error: null,
      })
    }
    if (data.status === 'failed' || new Date(data.expires_at).getTime() <= Date.now()) {
      return reply(request, { data: { status: 'failed' }, error: { message: data.failure_message || 'Checkout was not completed.' } }, 409)
    }

    const privateKey = process.env.ZALO_CHECKOUT_PRIVATE_KEY
    const ageMs = Date.now() - new Date(data.created_at).getTime()
    if (privateKey && data.zmp_order_id && ageMs >= 20 * 60_000) {
      const checkoutStatus = await fetchZaloOrderStatus(privateKey, data.zmp_order_id)
      if (checkoutStatus?.returnCode === 1
        && checkoutStatus.method === ZALO_CHECKOUT_METHOD
        && Number(checkoutStatus.amount) === data.expected_amount
        && cleanOrderId(checkoutStatus.transId)) {
        const responseToken = checkoutStatus.extradata
          ? checkoutTokenFromExtradata(checkoutStatus.extradata)
          : checkoutToken
        if (responseToken === checkoutToken) {
          const finalized = await finalizeZaloCheckoutSelection(admin, {
            checkoutToken,
            orderId: data.zmp_order_id,
            transId: String(checkoutStatus.transId),
            amount: Number(checkoutStatus.amount),
          })
          if (finalized.result) {
            return reply(request, {
              data: { status: 'confirmed', confirmation: confirmationPayload(finalized.result) },
              error: null,
            })
          }
          return reply(request, { data: { status: 'failed' }, error: { message: finalized.error } }, finalized.status)
        }
      }
      if (checkoutStatus?.returnCode === -1) {
        await admin.from('zalo_checkout_bookings').update({
          status: 'failed',
          failure_message: 'Zalo Checkout was not completed.',
          selection: {},
          updated_at: new Date().toISOString(),
        }).eq('checkout_token', checkoutToken).eq('status', 'pending')
        return reply(request, { data: { status: 'failed' }, error: { message: 'Checkout was not completed.' } }, 409)
      }
    }
    return reply(request, { data: { status: 'pending' }, error: null })
  }

  if (body.action !== 'prepare') return reply(request, { data: null, error: { message: 'Invalid booking action.' } }, 400)

  const privateKey = process.env.ZALO_CHECKOUT_PRIVATE_KEY
  if (!privateKey) return reply(request, { data: null, error: { message: 'Zalo Checkout is not configured yet.' } }, 503)

  const normalized = normalizeZaloMiniAppBookingSelection(body.selection)
  if (!normalized.data) return reply(request, { data: null, error: { message: normalized.error } }, 400)
  const { quote } = buildZaloMiniAppBookingRequest(normalized.data)
  if (!Number.isInteger(quote.displayTotal) || quote.displayTotal <= 0) {
    return reply(request, { data: null, error: { message: 'This booking needs a fixed Checkout price.' } }, 400)
  }

  const subject = createHash('sha256')
    .update(`${trustedClientIp(request.headers)}:${normalized.data.guestPhone}`)
    .digest('hex')
  const { data: rateLimit, error: rateLimitError } = await admin.rpc('consume_rate_limit', {
    p_action: 'zalo_checkout_prepare', p_limit: 10, p_window_seconds: 60, p_subject: subject,
  })
  if (rateLimitError || !rateLimit?.allowed) {
    return reply(request, { data: null, error: { message: 'Please wait before starting another Checkout.' } }, 429)
  }

  const checkoutToken = randomUUID()
  const selectionJson = JSON.stringify(normalized.data)
  const selectionFingerprint = createHash('sha256').update(selectionJson).digest('hex')
  const extradata = JSON.stringify({ checkoutToken })
  const method = JSON.stringify({ id: ZALO_CHECKOUT_METHOD, isCustom: false })
  const itemId = normalized.data.ticketType === 'birthday'
    ? normalized.data.birthdayPackageId || 'birthday'
    : 'individual'
  const order: ZaloCreateOrderParams = {
    amount: quote.displayTotal,
    desc: `VRena Booking - ${normalized.data.date} ${normalized.data.time}`,
    item: [{ id: itemId, amount: quote.displayTotal }],
    extradata,
    method,
  }

  const { error: insertError } = await admin.from('zalo_checkout_bookings').insert({
    checkout_token: checkoutToken,
    app_id: '2401555387563548266',
    selection: normalized.data,
    selection_fingerprint: selectionFingerprint,
    expected_amount: quote.displayTotal,
  })
  if (insertError) return reply(request, { data: null, error: { message: 'Checkout could not be prepared.' } }, 503)

  void admin.from('zalo_checkout_bookings')
    .delete()
    .eq('status', 'pending')
    .lt('expires_at', new Date(Date.now() - 86_400_000).toISOString())

  return reply(request, {
    data: { checkoutToken, order: { ...order, mac: createOrderMac(privateKey, order) } },
    error: null,
  })
}
