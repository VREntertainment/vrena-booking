import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export function usableVenueToken(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length >= 24
}

export type VenueServicePrincipal = {
  venueKey: string
}

type VenueCredential = VenueServicePrincipal & {
  token: string
}

const venueKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function configuredVenueCredentials(): VenueCredential[] {
  const configured = process.env.VRENA_RESULTS_INGEST_TOKENS
  if (configured) {
    try {
      const parsed = JSON.parse(configured) as Record<string, unknown>
      const credentials = Object.entries(parsed)
        .filter(([venueKey, token]) => venueKeyPattern.test(venueKey) && usableVenueToken(typeof token === 'string' ? token : undefined))
        .map(([venueKey, token]) => ({ venueKey, token: String(token).trim() }))
      if (credentials.length > 0) return credentials
    } catch {
      return []
    }
  }

  const fallbackToken = process.env.VRENA_RESULTS_INGEST_TOKEN
  if (!usableVenueToken(fallbackToken)) return []
  const venueKey = process.env.VRENA_RESULTS_DEFAULT_VENUE_KEY?.trim() || 'ha-do-centrosa'
  return venueKeyPattern.test(venueKey) ? [{ venueKey, token: fallbackToken.trim() }] : []
}

export function authorizedVenuePrincipal(request: NextRequest): VenueServicePrincipal | null {
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!supplied) return null

  const suppliedDigest = createHash('sha256').update(supplied).digest()
  let matchedVenue: string | null = null
  for (const credential of configuredVenueCredentials()) {
    const configuredDigest = createHash('sha256').update(credential.token).digest()
    if (timingSafeEqual(suppliedDigest, configuredDigest)) matchedVenue = credential.venueKey
  }
  return matchedVenue ? { venueKey: matchedVenue } : null
}

export function createVenueAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
