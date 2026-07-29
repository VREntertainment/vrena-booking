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
      downloadUrl: 'https://github.com/VREntertainment/vrena-booking/releases/download/v2.1.3/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-07-29T13:42:11Z',
      releaseNotes: 'Keep the web app URL and token saved across Windows restarts and recover them from a safe backup.',
      sha256: '84aaf581f79e4fcd0ab0647f96b8f03c7eb2d18552689e276e09a031f85d190d',
      version: '2.1.3',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
