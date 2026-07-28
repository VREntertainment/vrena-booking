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
      downloadUrl: 'https://github.com/VREntertainment/vrena-booking/releases/download/v2.1.0/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-07-28T09:44:00Z',
      releaseNotes: 'Automatic achievement validation, secure online support bundles, and future one-click updates.',
      sha256: 'e9fe811da12181389457fef4ecc505ab94958aafb3a9af6cff688d57ebaec83e',
      version: '2.1.0',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
