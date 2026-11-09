import { NextRequest, NextResponse } from 'next/server'
import {
  isAllowedZaloCallbackSource,
  verifyZaloCheckoutNotify,
  ZALO_BOOKING_MINI_APP_ID,
  ZALO_CHECKOUT_METHOD,
  type ZaloCheckoutNotifyBody,
} from '@/lib/zaloCheckout'

export const runtime = 'nodejs'

function notifyReply(returnCode: number, returnMessage: string, status = 200) {
  return NextResponse.json({ returnCode, returnMessage }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  if (!isAllowedZaloCallbackSource(request.headers)) {
    return notifyReply(-1, 'Checkout notification source is not allowed.', 403)
  }
  const privateKey = process.env.ZALO_CHECKOUT_PRIVATE_KEY
  if (!privateKey) return notifyReply(-1, 'Checkout service is not configured.', 503)

  let body: ZaloCheckoutNotifyBody
  try {
    const raw = await request.text()
    if (!raw || raw.length > 8_192) throw new Error('Invalid notification body.')
    body = JSON.parse(raw) as ZaloCheckoutNotifyBody
    if (!body?.data || typeof body.mac !== 'string') throw new Error('Invalid notification body.')
  } catch {
    return notifyReply(-1, 'Invalid notification body.', 400)
  }

  if (!verifyZaloCheckoutNotify(body, privateKey)) return notifyReply(-1, 'Invalid notification signature.', 401)
  if (String(body.data.appId) !== ZALO_BOOKING_MINI_APP_ID || body.data.method !== ZALO_CHECKOUT_METHOD) {
    return notifyReply(-1, 'Unexpected application or payment method.', 400)
  }
  return notifyReply(1, 'Payment method recorded.')
}
