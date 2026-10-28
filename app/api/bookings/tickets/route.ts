import { createClient } from '@supabase/supabase-js'
import { after, NextRequest, NextResponse } from 'next/server'
import { confirmedTicketBooking } from '@/lib/openAiAdsEvent'
import { sendOpenAiBooking } from '@/lib/server/openAiConversions'
import { isSameOriginRequest } from '@/lib/security/requestOrigin'

export const runtime = 'nodejs'
export const maxDuration = 30
const bookingRpcs = new Set(['create_ticket_booking', 'create_guest_ticket_booking', 'create_cafe_ticket_booking_request'])

export async function POST(request: NextRequest) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!isSameOriginRequest(request.headers, request.nextUrl.origin)) return reply({ error: { message: 'Same-origin booking required.' } }, 403)
  let body: { name?: unknown; args?: unknown; sourceUrl?: unknown }
  try {
    const raw = await request.text()
    if (raw.length > 16384) return reply({ error: { message: 'Booking request too large.' } }, 413)
    body = JSON.parse(raw)
    if (!body || typeof body !== 'object') throw new Error('Invalid body')
  } catch { return reply({ error: { message: 'Invalid booking request.' } }, 400) }
  if (typeof body.name !== 'string' || !bookingRpcs.has(body.name)
    || !body.args || typeof body.args !== 'object' || Array.isArray(body.args)) {
    return reply({ error: { message: 'Invalid booking request.' } }, 400)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return reply({ error: { message: 'Booking unavailable.' } }, 503)
  // Preserve the caller's JWT and existing database validation/RLS. Never use a service-role key.
  const authorization = request.headers.get('authorization')
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  })
  const { data, error } = await client.rpc(body.name, body.args)
  if (error) return reply({ data: null, error: { message: error.message } }, 400)
  if (confirmedTicketBooking(data)) {
    try {
      const input = {
        bookingId: data.session_id,
        venue: body.name === 'create_cafe_ticket_booking_request' ? 'thao_dien' as const : 'ha_do_centrosa' as const,
        timestampMs: Date.now(),
        headers: new Headers(request.headers),
        requestOrigin: request.nextUrl.origin,
        sourceUrl: body.sourceUrl,
      }
      after(() => sendOpenAiBooking(input))
    } catch { console.warn('OpenAI booking conversion scheduling unavailable') }
  }
  return reply({ data, error: null })
}
