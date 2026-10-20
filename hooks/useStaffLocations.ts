'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase/client'

export type StaffLocation = { venue_key: string; name: string }

// The server remains authoritative; refresh when returning to the tab or changing operator.
export function useStaffLocations(enabled = true, identity = '') {
  const [result, setResult] = useState<{ identity: string; locations: StaffLocation[]; error: string }>({ identity: '', locations: [], error: '' })
  useEffect(() => {
    if (!enabled) return
    let active = true
    async function refresh() {
      const { data, error } = await supabase.rpc('staff_access_locations')
      if (active) setResult({ identity, locations: error ? [] : (data ?? []) as StaffLocation[], error: error?.message || '' })
    }
    void refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('staff-locations-updated', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('staff-locations-updated', refresh) }
  }, [enabled, identity])
  return { locations: enabled && result.identity === identity ? result.locations : [], error: result.error }
}
