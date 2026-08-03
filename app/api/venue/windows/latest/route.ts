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
      downloadUrl: 'https://github.com/VREntertainment/vrena-results-capture/releases/download/v2.1.10/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-08-03T05:11:42Z',
      releaseNotes:
        'Use booking.vre-vietnam.com as the canonical web app endpoint and migrate existing settings from the retired Vercel hostname.',
      sha256: '9c312539f74b62f48bd3eea0fc0d9f4c78a16e8e5efbc99eeac290ba8dbeb330',
      version: '2.1.10',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
