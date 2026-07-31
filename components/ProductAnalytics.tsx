'use client'

import { ShieldCheck } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase/client'

type Consent = 'granted' | 'denied' | null
type AnalyticsEventName = 'page_view' | 'engagement' | 'search'

type AnalyticsEvent = {
  eventName: AnalyticsEventName
  path: string
  durationSeconds?: number
  searchSurface?: string
  searchQueryLength?: number
  searchResultCount?: number
}

type PageEngagement = {
  path: string
  activeMilliseconds: number
  activeSince: number | null
}

const CONSENT_KEY = 'vrena_product_analytics_consent'
const CLIENT_KEY = 'vrena_product_analytics_client_id'
const SESSION_KEY = 'vrena_product_analytics_session_id'
const ATTRIBUTION_KEY = 'vrena_product_analytics_attribution'
const INTERNAL_PATH = /^\/(staff|hr|admin)(\/|$)/

const messages = {
  en: {
    eyebrow: 'Privacy-first analytics',
    title: 'Help improve VRena',
    body: 'With your permission, VRena measures page journeys, searches, time in app, device type and visit source without a fixed retention period. Search text and raw IP addresses are never stored, and staff only see aggregate reporting.',
    allow: 'Allow analytics',
    decline: 'Not now',
    settings: 'Analytics privacy settings',
  },
  vi: {
    eyebrow: 'Phân tích ưu tiên quyền riêng tư',
    title: 'Giúp VRena cải thiện',
    body: 'Khi bạn đồng ý, VRena đo lường hành trình trang, lượt tìm kiếm, thời gian dùng app, loại thiết bị và nguồn truy cập mà không có thời hạn lưu trữ cố định. Nội dung tìm kiếm và địa chỉ IP thô không bao giờ được lưu; nhân viên chỉ xem báo cáo tổng hợp.',
    allow: 'Cho phép phân tích',
    decline: 'Để sau',
    settings: 'Cài đặt quyền riêng tư phân tích',
  },
} as const

function randomId() {
  return crypto.randomUUID()
}

function storageValue(storage: Storage, key: string, create: boolean) {
  const current = storage.getItem(key)
  if (current) return current
  if (!create) return ''
  const value = randomId()
  storage.setItem(key, value)
  return value
}

function deviceContext() {
  const userAgent = navigator.userAgent
  const width = window.innerWidth
  const deviceClass = /Mobi|Android|iPhone/i.test(userAgent) || width < 720
    ? 'mobile'
    : /iPad|Tablet/i.test(userAgent) || width < 1100
      ? 'tablet'
      : 'desktop'
  const browserFamily = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Other'
  const osFamily = /Android/i.test(userAgent)
    ? 'Android'
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? 'iOS'
      : /Windows/i.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/i.test(userAgent)
          ? 'macOS'
          : /Linux/i.test(userAgent)
            ? 'Linux'
            : 'Other'
  const viewportBucket = width < 480 ? '<480' : width < 768 ? '480-767' : width < 1024 ? '768-1023' : width < 1440 ? '1024-1439' : '1440+'

  return { deviceClass, browserFamily, osFamily, viewportBucket }
}

function firstTouchAttribution() {
  const stored = sessionStorage.getItem(ATTRIBUTION_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as Record<string, string | null>
    } catch {
      sessionStorage.removeItem(ATTRIBUTION_KEY)
    }
  }

  const params = new URLSearchParams(window.location.search)
  let referrerHost: string | null = null
  try {
    const host = document.referrer ? new URL(document.referrer).host : ''
    referrerHost = host && host !== window.location.host ? host : null
  } catch {
    referrerHost = null
  }
  const attribution = {
    referrerHost,
    acquisitionSource: params.get('utm_source')?.slice(0, 80) || null,
    acquisitionMedium: params.get('utm_medium')?.slice(0, 80) || null,
    acquisitionCampaign: params.get('utm_campaign')?.slice(0, 120) || null,
  }
  sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
  return attribution
}

export default function ProductAnalytics() {
  const pathname = usePathname()
  const [consent, setConsent] = useState<Consent>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const accessTokenRef = useRef('')
  const pageRef = useRef<PageEngagement | null>(null)
  const sendEventRef = useRef<(event: AnalyticsEvent, beacon?: boolean) => void>(() => undefined)
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false)
  const excluded = INTERNAL_PATH.test(pathname)
  const language = mounted && navigator.language.toLowerCase().startsWith('vi') ? 'vi' : 'en'
  const text = messages[language]

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(CONSENT_KEY)
        setConsent(stored === 'granted' || stored === 'denied' ? stored : null)
      } catch {
        setConsent('denied')
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      accessTokenRef.current = data.session?.access_token || ''
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token || ''
      setAuthReady(true)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    sendEventRef.current = (event, beacon = false) => {
      if (consent !== 'granted' || INTERNAL_PATH.test(event.path)) return
      try {
        const clientId = storageValue(localStorage, CLIENT_KEY, true)
        const sessionId = storageValue(sessionStorage, SESSION_KEY, true)
        const payload = JSON.stringify({
          ...event,
          ...deviceContext(),
          ...firstTouchAttribution(),
          clientId,
          sessionId,
        })
        const accessToken = accessTokenRef.current
        if (beacon && !accessToken && navigator.sendBeacon) {
          navigator.sendBeacon('/api/analytics/events', new Blob([payload], { type: 'application/json' }))
          return
        }
        void fetch('/api/analytics/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: payload,
          credentials: 'same-origin',
          keepalive: true,
        }).catch(() => undefined)
      } catch {
        // Analytics must never interrupt the booking experience.
      }
    }
  }, [consent])

  function flushEngagement(beacon = false) {
    const page = pageRef.current
    if (!page) return
    const now = performance.now()
    const activeMilliseconds = page.activeMilliseconds + (page.activeSince === null ? 0 : now - page.activeSince)
    page.activeMilliseconds = 0
    page.activeSince = document.visibilityState === 'visible' ? now : null
    const durationSeconds = Math.min(1800, Math.floor(activeMilliseconds / 1000))
    if (durationSeconds >= 2) sendEventRef.current({ eventName: 'engagement', path: page.path, durationSeconds }, beacon)
  }

  useEffect(() => {
    if (consent !== 'granted' || !authReady) {
      pageRef.current = null
      return
    }
    if (excluded) {
      flushEngagement(true)
      pageRef.current = null
      return
    }
    if (pageRef.current?.path === pathname) return
    flushEngagement(true)
    pageRef.current = {
      path: pathname,
      activeMilliseconds: 0,
      activeSince: document.visibilityState === 'visible' ? performance.now() : null,
    }
    sendEventRef.current({ eventName: 'page_view', path: pathname })
  }, [authReady, consent, excluded, pathname])

  useEffect(() => {
    if (consent !== 'granted' || !authReady || excluded) return

    const searchTimers = new WeakMap<HTMLInputElement, number>()
    const lastSearches = new WeakMap<HTMLInputElement, string>()
    const handleInput = (event: Event) => {
      const input = event.target
      if (!(input instanceof HTMLInputElement)) return
      const searchSurface = input.dataset.analyticsSearchSurface
      if (!searchSurface) return
      const existingTimer = searchTimers.get(input)
      if (existingTimer) window.clearTimeout(existingTimer)
      const query = input.value.trim()
      const timer = window.setTimeout(() => {
        if (query.length < 2 || lastSearches.get(input) === query) return
        lastSearches.set(input, query)
        const resultValue = input.dataset.analyticsSearchResults
        const resultCount = resultValue && /^\d+$/.test(resultValue) ? Number(resultValue) : undefined
        sendEventRef.current({
          eventName: 'search',
          path: pathname,
          searchSurface,
          searchQueryLength: Math.min(240, query.length),
          searchResultCount: resultCount,
        })
      }, 650)
      searchTimers.set(input, timer)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushEngagement(true)
      } else if (pageRef.current) {
        pageRef.current.activeSince = performance.now()
      }
    }
    const handlePageExit = () => flushEngagement(true)
    const interval = window.setInterval(() => flushEngagement(), 30_000)

    document.addEventListener('input', handleInput)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageExit)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('input', handleInput)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageExit)
    }
  }, [authReady, consent, excluded, pathname])

  function chooseConsent(nextConsent: Exclude<Consent, null>) {
    try {
      localStorage.setItem(CONSENT_KEY, nextConsent)
      if (nextConsent === 'denied') {
        localStorage.removeItem(CLIENT_KEY)
        sessionStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(ATTRIBUTION_KEY)
      }
    } catch {
      // State still updates so the privacy prompt remains usable.
    }
    setConsent(nextConsent)
    setSettingsOpen(false)
  }

  if (!mounted || excluded) return null
  const showPrompt = consent === null || settingsOpen

  return (
    <>
      {showPrompt ? (
        <aside className="product-analytics-consent" aria-labelledby="product-analytics-consent-title">
          <span className="product-analytics-consent-icon"><ShieldCheck aria-hidden="true" size={20} /></span>
          <div className="product-analytics-consent-copy">
            <span>{text.eyebrow}</span>
            <strong id="product-analytics-consent-title">{text.title}</strong>
            <p>{text.body}</p>
          </div>
          <div className="product-analytics-consent-actions">
            <button className="product-analytics-consent-allow" type="button" onClick={() => chooseConsent('granted')}>{text.allow}</button>
            <button className="product-analytics-consent-decline" type="button" onClick={() => chooseConsent('denied')}>{text.decline}</button>
          </div>
        </aside>
      ) : (
        <button className="product-analytics-settings" type="button" aria-label={text.settings} title={text.settings} onClick={() => setSettingsOpen(true)}>
          <ShieldCheck aria-hidden="true" size={17} />
          <span>{text.settings}</span>
        </button>
      )}
    </>
  )
}
