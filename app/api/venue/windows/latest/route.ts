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
      downloadUrl: 'https://github.com/VREntertainment/vrena-booking/releases/download/v2.1.4/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-07-31T09:14:56Z',
      releaseNotes:
        'Read up to four player rows, privately upload unresolved screenshots for review, and highlight available updates with an animated button.',
      sha256: '4cf540015c93f279f0b5e6b02d62f4339c3d45856d7e00ce5e8dbc368a4f9e4e',
      version: '2.1.4',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
