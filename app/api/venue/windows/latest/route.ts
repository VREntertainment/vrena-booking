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
      downloadUrl: 'https://github.com/VREntertainment/vrena-results-capture/releases/download/v2.1.8/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-08-01T13:37:03Z',
      releaseNotes:
        'Open VRena Results Capture maximized by default and restore it maximized from the notification area.',
      sha256: '5de1ba01fe3b1a5e16742017f8d63d66bbac5a47147d0ff58080c2e2a969dad5',
      version: '2.1.8',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
