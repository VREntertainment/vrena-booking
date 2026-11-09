import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildZaloMiniAppBookingRequest, normalizeZaloMiniAppBookingSelection } from '@/lib/zaloMiniAppBooking'

type FinalizeInput = {
  checkoutToken: string
  orderId: string
  transId: string
  amount: number
}

type FinalizeResult = {
  result: Record<string, unknown> | null
  error: string | null
  status: number
}

export async function finalizeZaloCheckoutSelection(
  admin: SupabaseClient,
  input: FinalizeInput,
): Promise<FinalizeResult> {
  const { data: checkout, error: lookupError } = await admin
    .from('zalo_checkout_bookings')
    .select('selection, selection_fingerprint, expected_amount, status, zmp_order_id, zmp_trans_id, expires_at, booking_response')
    .eq('checkout_token', input.checkoutToken)
    .maybeSingle()

  if (lookupError || !checkout) return { result: null, error: 'Checkout reference was not found.', status: 404 }
  if (checkout.status === 'confirmed' && checkout.booking_response) {
    return { result: { ...(checkout.booking_response as Record<string, unknown>), duplicate: true }, error: null, status: 200 }
  }
  if (checkout.status === 'failed' || new Date(checkout.expires_at).getTime() <= Date.now()) {
    return { result: null, error: 'Checkout request is no longer active.', status: 409 }
  }
  if (checkout.zmp_order_id && checkout.zmp_order_id !== input.orderId) {
    return { result: null, error: 'Checkout order reference does not match.', status: 409 }
  }
  if (checkout.zmp_trans_id && checkout.zmp_trans_id !== input.transId) {
    return { result: null, error: 'Checkout transaction reference does not match.', status: 409 }
  }

  const normalized = normalizeZaloMiniAppBookingSelection(checkout.selection)
  if (!normalized.data) return { result: null, error: 'Stored booking selection is invalid.', status: 409 }
  const selectionFingerprint = createHash('sha256').update(JSON.stringify(normalized.data)).digest('hex')
  if (selectionFingerprint !== checkout.selection_fingerprint) {
    return { result: null, error: 'Stored booking selection does not match.', status: 409 }
  }

  const { quote, request: bookingRequest } = buildZaloMiniAppBookingRequest(normalized.data)
  if (input.amount !== checkout.expected_amount || quote.displayTotal !== checkout.expected_amount) {
    return { result: null, error: 'Checkout amount does not match the booking.', status: 409 }
  }

  const { data: result, error: finalizeError } = await admin.rpc('finalize_zalo_checkout_booking', {
    p_checkout_token: input.checkoutToken,
    p_zmp_order_id: input.orderId,
    p_zmp_trans_id: input.transId,
    p_selection_fingerprint: selectionFingerprint,
    p_expected_amount: checkout.expected_amount,
    p_booking_name: bookingRequest.name,
    p_booking_args: bookingRequest.args,
  })

  if (finalizeError || !result) {
    await admin.from('zalo_checkout_bookings').update({
      status: 'failed',
      failure_message: 'The selected time could not be confirmed. Please choose another time.',
      updated_at: new Date().toISOString(),
    }).eq('checkout_token', input.checkoutToken).eq('status', 'pending')
    return { result: null, error: 'Booking could not be confirmed.', status: 409 }
  }

  return { result: result as Record<string, unknown>, error: null, status: 200 }
}
