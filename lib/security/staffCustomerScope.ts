import type { SupabaseClient } from '@supabase/supabase-js'

// Always use the caller client: it carries both the verified login and kiosk token.
export async function staffCustomerAccessResponse(client: Pick<SupabaseClient, 'rpc'>, profileId: string) {
  const { data, error } = await client.rpc('staff_customer_profile_allowed', { p_profile_id: profileId })
  if (error) return Response.json({ error: 'Could not verify customer access.' }, { status: 503 })
  if (data !== true) return Response.json({ error: 'Customer access denied.' }, { status: 403 })
  return null
}

export async function staffCustomerCreationLocations(client: Pick<SupabaseClient, 'rpc'>) {
  const { data, error } = await client.rpc('staff_access_locations')
  if (error) return { locations: [], response: Response.json({ error: 'Could not verify location access.' }, { status: 503 }) }
  const locations = Array.isArray(data)
    ? data.flatMap((row: { venue_key?: unknown }) => typeof row.venue_key === 'string' ? [row.venue_key] : [])
    : []
  if (!locations.length) return { locations, response: Response.json({ error: 'Location access required.' }, { status: 403 }) }
  return { locations, response: null }
}
