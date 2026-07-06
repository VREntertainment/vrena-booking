import type { BookingUpdateEmailPayload } from './bookingUpdateEmailTypes'

type SupabaseSessionReader = {
  auth: {
    getSession: () => Promise<{
      data: { session?: { access_token?: string | null } | null }
      error?: { message?: string } | null
    }>
  }
}

export async function notifyBookingUpdateEmail(
  supabase: SupabaseSessionReader,
  payload: BookingUpdateEmailPayload,
) {
  const { data, error } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (error || !accessToken) return

  const response = await fetch('/api/bookings/update-email', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || 'Could not send booking update email.')
  }
}
