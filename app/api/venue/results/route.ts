import { NextRequest, NextResponse } from 'next/server'
import {
  parseVenueResultPayload,
  venueCaptureDateRange,
  venueSessionContainsTimestamp,
  type VenueResultPayload,
  type VenueResultPlayer,
} from '@/lib/venueResults'
import {
  createVenueAdminClient,
  isAuthorizedVenueRequest,
  usableVenueToken,
} from '@/lib/venueService'

export const runtime = 'nodejs'

type ProfileRow = {
  full_name: string
  id: string
  nickname: string
}

type VenueAdminClient = NonNullable<ReturnType<typeof createVenueAdminClient>>

type SessionParticipantRow = {
  display_name: string | null
  id: string
  session_id: string
  sessions: {
    confirmed_game_id: string | null
    date: string
    duration_minutes: number
    game_options: string[] | null
    id: string
    start_time: string
  } | null
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function sessionMatchesGame(session: NonNullable<SessionParticipantRow['sessions']>, gameSlug: string) {
  return session.confirmed_game_id === gameSlug || (session.game_options ?? []).includes(gameSlug)
}

async function exactProfilesForName(
  adminClient: VenueAdminClient,
  playerName: string
) {
  const { data, error } = await adminClient
    .rpc('service_profiles_for_venue_identity', {
      p_player_name: playerName,
    } as never)

  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

async function candidateSessionParticipants(
  adminClient: VenueAdminClient,
  profileId: string,
  payload: VenueResultPayload
) {
  const range = venueCaptureDateRange(payload.capturedAt)
  const { data, error } = await adminClient
    .from('session_participants')
    .select(`
      id,
      session_id,
      display_name,
      sessions!inner(
        id,
        date,
        start_time,
        duration_minutes,
        confirmed_game_id,
        game_options
      )
    `)
    .eq('profile_id', profileId)
    .is('deleted_at', null)
    .is('sessions.deleted_at', null)
    .neq('sessions.status', 'cancelled')
    .gte('sessions.date', range.from)
    .lte('sessions.date', range.to)

  if (error) throw error

  const inTimeSlot = (data ?? [])
    .map((row) => row as unknown as SessionParticipantRow)
    .filter((row) => row.sessions && venueSessionContainsTimestamp(
      row.sessions.date,
      row.sessions.start_time,
      Number(row.sessions.duration_minutes),
      payload.capturedAt
    ))

  if (inTimeSlot.length <= 1) return inTimeSlot
  const matchingGame = inTimeSlot.filter(
    (row) => row.sessions && sessionMatchesGame(row.sessions, payload.gameSlug)
  )
  return matchingGame.length === 1 ? matchingGame : inTimeSlot
}

async function importPlayerResult(
  adminClient: VenueAdminClient,
  payload: VenueResultPayload,
  player: VenueResultPlayer
) {
  const { data: existing, error: existingError } = await adminClient
    .from('venue_game_results')
    .select('id, match_status')
    .eq('source_capture_id', payload.captureId)
    .eq('player_name', player.name)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    const existingResult = existing as { match_status: string }
    return { name: player.name, status: 'duplicate', matchStatus: existingResult.match_status }
  }

  const profiles = await exactProfilesForName(adminClient, player.name)
  if (profiles.length === 0) return { name: player.name, status: 'player_not_found' }
  if (profiles.length > 1) return { name: player.name, status: 'player_name_ambiguous' }

  const profile = profiles[0]
  const candidates = await candidateSessionParticipants(adminClient, profile.id, payload)
  const matchedParticipant = candidates.length === 1 ? candidates[0] : null
  const matchStatus = matchedParticipant
    ? 'session_matched'
    : candidates.length > 1
      ? 'session_ambiguous'
      : 'player_only'

  const { data: importResult, error: insertError } = await adminClient.rpc(
    'service_ingest_venue_game_result',
    ({
      p_accuracy_percent: player.accuracyPercent,
      p_captured_at: payload.capturedAt,
      p_external_session_label: payload.externalSessionLabel,
      p_game_name: payload.gameName,
      p_game_slug: payload.gameSlug,
      p_hits: player.hits,
      p_match_status: matchStatus,
      p_matched_participant_id: matchedParticipant?.id ?? null,
      p_matched_session_id: matchedParticipant?.session_id ?? null,
      p_movement_meters: player.movementMeters,
      p_player_name: player.name,
      p_profile_id: profile.id,
      p_score: player.score,
      p_source_capture_id: payload.captureId,
      p_source_device: payload.deviceName,
    }) as never
  )

  if (insertError) throw insertError
  const importStatus = importResult as unknown as { status?: string } | null
  if (importStatus?.status === 'duplicate') {
    return { name: player.name, status: 'duplicate', matchStatus }
  }

  return {
    game: payload.gameSlug,
    matchStatus,
    name: player.name,
    profileId: profile.id,
    sessionId: matchedParticipant?.session_id ?? null,
    status: 'saved',
  }
}

export async function GET(request: NextRequest) {
  const configuredToken = process.env.VRENA_RESULTS_INGEST_TOKEN
  if (!usableVenueToken(configuredToken)) return jsonError('Venue results import is not configured.', 503)
  if (!isAuthorizedVenueRequest(request, configuredToken)) return jsonError('Unauthorized.', 401)
  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  const configuredToken = process.env.VRENA_RESULTS_INGEST_TOKEN
  const adminClient = createVenueAdminClient()

  if (!usableVenueToken(configuredToken) || !adminClient) {
    return jsonError('Venue results import is not configured.', 503)
  }
  if (!isAuthorizedVenueRequest(request, configuredToken)) return jsonError('Unauthorized.', 401)

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 65_536) return jsonError('Payload too large.', 413)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON payload.', 400)
  }

  const payload = parseVenueResultPayload(body)
  if (!payload) return jsonError('Invalid venue result payload.', 400)

  try {
    const results = []
    for (const player of payload.players) {
      results.push(await importPlayerResult(adminClient, payload, player))
    }

    const savedCount = results.filter((result) => result.status === 'saved').length
    return NextResponse.json({
      captureId: payload.captureId,
      results,
      savedCount,
    })
  } catch (error) {
    console.error('Venue result import failed', {
      captureId: payload.captureId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return jsonError('Venue result import failed.', 500)
  }
}
