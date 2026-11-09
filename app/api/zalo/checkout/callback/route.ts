import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  checkoutTokenFromExtradata,
  isAllowedZaloCallbackSource,
  verifyZaloCheckoutCallback,
  ZALO_BOOKING_MINI_APP_ID,
  ZALO_CHECKOUT_METHOD,
  type ZaloCheckoutCallbackBody,
} from '@/lib/zaloCheckout'
import { finalizeZaloCheckoutSelection } from '@/lib/zaloCheckoutBooking'

export const runtime = 'nodejs'
export const maxDuration = 30

function callbackReply(returnCode: number, returnMessage: string, status = 200) {
  return NextResponse.json({ returnCode, returnMessage }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function parseBody(request: NextRequest) {
  const raw = await request.text()
  if (!raw || raw.length > 32_768) throw new Error('Invalid callback body.')
  const body = JSON.parse(raw) as ZaloCheckoutCallbackBody
  if (!body?.data || typeof body.data !== 'object' || typeof body.mac !== 'string' || typeof body.overallMac !== 'string') {
    throw new Error('Invalid callback body.')
  }
  return body
}

export async function POST(request: NextRequest) {
  if (!isAllowedZaloCallbackSource(request.headers)) {
    return callbackReply(-1, 'Checkout callback source is not allowed.', 403)
  }
  const privateKey = process.env.ZALO_CHECKOUT_PRIVATE_KEY
  const admin = adminClient()
  if (!privateKey || !admin) return callbackReply(-1, 'Checkout service is not configured.', 503)

  let body: ZaloCheckoutCallbackBody
  try {
    body = await parseBody(request)
  } catch {
    return callbackReply(-1, 'Invalid callback body.', 400)
  }

  if (!verifyZaloCheckoutCallback(body, privateKey)) return callbackReply(-1, 'Invalid callback signature.', 401)
  const data = body.data
  if (String(data.appId) !== ZALO_BOOKING_MINI_APP_ID || data.method !== ZALO_CHECKOUT_METHOD) {
    return callbackReply(-1, 'Unexpected application or payment method.', 400)
  }

  const checkoutToken = checkoutTokenFromExtradata(data.extradata)
  if (!checkoutToken) return callbackReply(-1, 'Invalid Checkout reference.', 400)

  if (Number(data.resultCode) !== 1) {
    const { data: recorded, error: recordError } = await admin.from('zalo_checkout_bookings').update({
      status: 'failed',
      zmp_order_id: String(data.orderId),
      zmp_trans_id: String(data.transId),
      failure_message: 'Zalo Checkout was not completed.',
      selection: {},
      updated_at: new Date().toISOString(),
    }).eq('checkout_token', checkoutToken).eq('status', 'pending').select('checkout_token').maybeSingle()
    if (recordError || !recorded) return callbackReply(-1, 'Checkout reference was not found.', 404)
    return callbackReply(1, 'Checkout result recorded.')
  }

  const finalized = await finalizeZaloCheckoutSelection(admin, {
    checkoutToken,
    orderId: String(data.orderId),
    transId: String(data.transId),
    amount: Number(data.amount),
  })
  if (!finalized.result) return callbackReply(-1, finalized.error || 'Booking could not be confirmed.', finalized.status)

  return finalized.result.duplicate
    ? callbackReply(2, 'Transaction already completed.')
    : callbackReply(1, 'Booking confirmed.')
}
