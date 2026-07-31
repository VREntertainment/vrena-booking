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
      downloadUrl: 'https://github.com/VREntertainment/vrena-booking/releases/download/v2.1.5/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-07-31T10:33:14Z',
      releaseNotes:
        'Recognize MBTowers as Mini Block Towers and sync its Hits and Total results to player profiles.',
      sha256: '4c1cc47aa0627b89680e06ca5c72c9bcbf766458cf93f453c21374c73acc9a3f',
      version: '2.1.5',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
