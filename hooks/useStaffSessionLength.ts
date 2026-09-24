'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase/client'

export function useStaffSessionLength(date: string) {
  const [result, setResult] = useState<{ date: string; minutes: number | null; error: boolean } | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    window.addEventListener('focus', refresh)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])
  useEffect(() => {
    if (!date) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('staff_booking_session_minutes', { p_booking_date: date })
        const valid = !error && Number.isInteger(data) && data > 0 && data <= 1440
        if (!cancelled) setResult({ date, minutes: valid ? data : null, error: !valid })
      } catch {
        if (!cancelled) setResult({ date, minutes: null, error: true })
      }
    })()
    return () => { cancelled = true }
  }, [date, revision])
  return { minutes: result?.date === date ? result.minutes : null, error: result?.date === date && result.error, refresh }
}
