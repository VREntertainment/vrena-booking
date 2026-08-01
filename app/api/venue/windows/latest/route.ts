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
      downloadUrl: 'https://github.com/VREntertainment/vrena-results-capture/releases/download/v2.1.9/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-08-01T23:53:49Z',
      releaseNotes:
        'Use game-specific OCR for up to four players, improve faint escape-game names, and exclude ZG Marbles from player records and review uploads.',
      sha256: 'a40e18df86afc21d76f39a88b5d8bd3cf53ba44d72775be87fdd90e178d61cf7',
      version: '2.1.9',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
