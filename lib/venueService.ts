import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export function usableVenueToken(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length >= 24
}

export function isAuthorizedVenueRequest(request: NextRequest, configuredToken: string) {
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!supplied) return false

  const suppliedDigest = createHash('sha256').update(supplied).digest()
  const configuredDigest = createHash('sha256').update(configuredToken).digest()
  return timingSafeEqual(suppliedDigest, configuredDigest)
}

export function createVenueAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
