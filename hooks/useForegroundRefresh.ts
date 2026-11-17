'use client'

import { useEffect, useEffectEvent } from 'react'

/** Mobile standalone apps can sleep without a window focus event or a live socket. */
export function useForegroundRefresh(enabled: boolean, refresh: () => void) {
  const refreshCurrentView = useEffectEvent(refresh)
  useEffect(() => {
    if (!enabled) return
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refreshCurrentView()
    }
    const events = ['focus', 'pageshow', 'online', 'offline'] as const
    events.forEach(event => window.addEventListener(event, refreshVisible))
    document.addEventListener('visibilitychange', refreshVisible)
    const timer = window.setInterval(refreshVisible, 30_000)
    return () => {
      events.forEach(event => window.removeEventListener(event, refreshVisible))
      document.removeEventListener('visibilitychange', refreshVisible)
      window.clearInterval(timer)
    }
  }, [enabled])
}
