'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '../lib/booking/client'
import type { ArenaOccupancy } from '../lib/booking/arenaAvailability'

export function useArenaOccupancy(date: string, refreshKey: unknown) {
  const [result, setResult] = useState<{ date: string; through: string; rows: ArenaOccupancy[] } | null>(null)
  useEffect(() => {
    if (!date) return
    let disposed = false
    const end = new Date(`${date}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + 31)
    const through = end.toISOString().slice(0, 10)
    async function refresh() {
      try {
        const client = await getSupabase()
        const { data, error } = await client.rpc('booking_arena_occupancy', { p_from: date, p_to: through })
        if (!disposed) setResult(error ? null : { date, through, rows: (data ?? []) as ArenaOccupancy[] })
      } catch {
        if (!disposed) setResult(null)
      }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 30_000)
    return () => { disposed = true; clearInterval(timer) }
  }, [date, refreshKey])
  // Fail closed while fetching a new date or if availability cannot be read.
  return result?.date === date ? result : null
}
