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
      downloadUrl: 'https://github.com/VREntertainment/vrena-results-capture/releases/download/v2.1.11/VRenaResultsCapture-Setup.exe',
      publishedAt: '2026-08-11T01:11:50Z',
      releaseNotes:
        'Reliability update: supports 1-4 escape players and 2-4 shooting players, recovers missed OCR statistics, keeps sync queues moving, and creates uploadable debug bundles.',
      sha256: 'eafc67bcddb298c49ce1cfaf5225dc5b678c37ad756c23b0af1be00120eb605d',
      version: '2.1.11',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
