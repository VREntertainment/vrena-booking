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
      downloadUrl: 'https://github.com/VREntertainment/vrena-booking/releases/download/v2.1.1/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-07-28T10:43:46Z',
      releaseNotes: 'Fix update-version validation, use the VRena mark as the Windows icon, and keep the app window out of result screenshots.',
      sha256: '79cbfc03b1d52f101683933e3770854613fbfc79285f47600a34b305bfa4b904',
      version: '2.1.1',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
