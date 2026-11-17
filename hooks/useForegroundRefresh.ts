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
    window.addEventListener('focus', refreshVisible)
    window.addEventListener('pageshow', refreshVisible)
    window.addEventListener('online', refreshVisible)
    window.addEventListener('offline', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    const timer = window.setInterval(refreshVisible, 30_000)
    return () => {
      window.removeEventListener('focus', refreshVisible)
      window.removeEventListener('pageshow', refreshVisible)
      window.removeEventListener('online', refreshVisible)
      window.removeEventListener('offline', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
      window.clearInterval(timer)
    }
  }, [enabled])
}
