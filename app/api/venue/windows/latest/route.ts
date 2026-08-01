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
      downloadUrl: 'https://github.com/VREntertainment/vrena-results-capture/releases/download/v2.1.7/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-08-01T12:18:00Z',
      releaseNotes:
        'Recognize the Unspunnen venue label and prevent repeated result-screen captures from inflating player statistics.',
      sha256: 'bcb943e845848facc442186db3c706da124534ae051b0e16f7e00f59232f2cf0',
      version: '2.1.7',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
