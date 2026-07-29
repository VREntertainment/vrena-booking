import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedVenueRequest, usableVenueToken } from '@/lib/venueService'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const configuredToken = process.env.VRENA_RESULTS_INGEST_TOKEN
  if (!usableVenueToken(configuredToken)) {
    return NextResponse.json({ error: 'Venue updates are not configured.' }, { status: 503 })
  }
  if (!isAuthorizedVenueRequest(request, configuredToken)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  return NextResponse.json(
    {
      downloadUrl: 'https://github.com/VREntertainment/vrena-booking/releases/download/v2.1.2/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-07-29T12:11:56Z',
      releaseNotes: 'Read venue result screens more reliably, include the latest screenshot in private debug logs, and simplify app messages.',
      sha256: '2acdb1826739cca57530ad53bb8501a3cffa4fd819d8d483fe7c5b4d7428cc2f',
      version: '2.1.2',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
