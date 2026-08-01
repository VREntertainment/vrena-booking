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
      downloadUrl: 'https://github.com/VREntertainment/vrena-results-capture/releases/download/v2.1.6/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-07-31T14:54:59Z',
      releaseNotes:
        'Correct Windows OCR percent-sign artifacts and restore dropped trailing zeros in shooter scores.',
      sha256: 'e628be1d4785ecdf9c97fa49e907bdb33cbb6ff61f1fd1312399dc3dae6788db',
      version: '2.1.6',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
