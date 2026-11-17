'use client'

import { useEffect, useEffectEvent } from 'react'

/** Standalone mobile apps can sleep without a window focus event or a live socket. */
export function useForegroundRefresh(enabled: boolean, refresh: () => void) {
  const refreshCurrentView = useEffectEvent(refresh)
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let cleanup: (() => void) | undefined
    const connect = () => {
      if (disposed || cleanup) return
      void import('../lib/foregroundRefresh').then(({ listenForForegroundRefresh }) => {
        if (!disposed && !cleanup) {
          cleanup = listenForForegroundRefresh(() => refreshCurrentView())
          refreshCurrentView()
        }
      }).catch(() => { /* Retry module loading on reconnect or return to the app. */ })
    }
    connect()
    window.addEventListener('online', connect)
    window.addEventListener('focus', connect)
    return () => {
      disposed = true
      cleanup?.()
      window.removeEventListener('online', connect)
      window.removeEventListener('focus', connect)
    }
  }, [enabled])
}
