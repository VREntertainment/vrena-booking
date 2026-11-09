import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { arenaTimeOptions, type ArenaOccupancy } from '@/lib/booking/arenaAvailability'
import { buildZaloMiniAppBookingRequest, normalizeZaloMiniAppBookingSelection, zaloMiniAppVenues } from '@/lib/zaloMiniAppBooking'

export const runtime = 'nodejs'
export const maxDuration = 30

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders })
}

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function parseBody(request: NextRequest) {
  const raw = await request.text()
  if (raw.length > 16_384) throw new Error('Booking request too large.')
  const body = JSON.parse(raw)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid booking request.')
  return body as Record<string, unknown>
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await parseBody(request)
  } catch (error) {
    return reply({ data: null, error: { message: error instanceof Error ? error.message : 'Invalid booking request.' } }, 400)
  }

  const client = supabaseClient()
  if (!client) return reply({ data: null, error: { message: 'Booking is temporarily unavailable.' } }, 503)

  if (body.action === 'availability') {
    const venue = typeof body.venue === 'string' ? body.venue : ''
    const date = typeof body.date === 'string' ? body.date : ''
    const durationMinutes = Number(body.durationMinutes)
    const arenaCount = Number(body.arenaCount)
    if (!zaloMiniAppVenues.includes(venue as (typeof zaloMiniAppVenues)[number])
      || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || !Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 180
      || !Number.isInteger(arenaCount) || arenaCount < 1 || arenaCount > (venue === 'ha-do-centrosa' ? 2 : 1)) {
      return reply({ data: null, error: { message: 'Choose a valid venue, date, and duration.' } }, 400)
    }

    const { data, error } = await client.rpc('booking_arena_occupancy', { p_from: date, p_to: date })
    if (error) return reply({ data: null, error: { message: error.message } }, 400)
    const times = arenaTimeOptions(venue, date, durationMinutes, arenaCount, (data || []) as ArenaOccupancy[])
    return reply({ data: { times }, error: null })
  }

  if (body.action !== 'book') return reply({ data: null, error: { message: 'Invalid booking action.' } }, 400)

  const normalized = normalizeZaloMiniAppBookingSelection(body.selection)
  if (!normalized.data) return reply({ data: null, error: { message: normalized.error } }, 400)
  const { quote, request: bookingRequest } = buildZaloMiniAppBookingRequest(normalized.data)
  const { data, error } = await client.rpc(bookingRequest.name, bookingRequest.args)
  if (error) return reply({ data: null, error: { message: error.message } }, 400)
  if (!data || data.ticket_status !== 'confirmed' || !data.ticket_reference || !data.session_id) {
    return reply({ data: null, error: { message: 'The selected time could not be confirmed.' } }, 409)
  }
  return reply({
    data: {
      sessionId: data.session_id,
      reference: data.ticket_reference,
      status: data.ticket_status,
      totalPrice: Number(data.ticket_total_price ?? quote.displayTotal) || quote.displayTotal,
      displayTotal: quote.displayTotal,
      requiresStaffConfirmation: quote.requiresStaffConfirmation,
    },
    error: null,
  })
}
