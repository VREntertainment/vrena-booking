'use client'

import dynamic from 'next/dynamic'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import { calendarNavigation } from '../lib/bookingCalendar'
import { appRouteForView, publicAppRoutes } from '../lib/appRoutes'
import BrandLoader from './BrandLoader'
import type { AppView } from './AppSidebar'

const BookingWidget = dynamic(() => import('./BookingWidget'), {
  ssr: false,
  loading: () => (
    <main className="app-route-loader">
      <BrandLoader />
    </main>
  ),
})

type HomeAppShellProps = {
  initialView?: AppView
}

export default function HomeAppShell({ initialView = 'tickets' }: HomeAppShellProps) {
  return <Suspense fallback={<main className="app-route-loader"><BrandLoader /></main>}><RoutedAppShell initialView={initialView} /></Suspense>
}

function RoutedAppShell({ initialView = 'tickets' }: HomeAppShellProps) {
  const pathname = usePathname()
  const search = useSearchParams()
  const hasHandledInitialViewRef = useRef(false)
  const restoringHistoryRef = useRef<string | null>(null)
  const pendingNavigationRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Let the workspace consume Back/Forward before writing its next URL.
    const restore = () => { restoringHistoryRef.current = window.location.pathname + window.location.search }
    window.addEventListener('popstate', restore, true)
    return () => {
      window.removeEventListener('popstate', restore, true)
      if (pendingNavigationRef.current) clearTimeout(pendingNavigationRef.current)
    }
  }, [])

  const handleActiveViewChange = useCallback((view: AppView, query?: string) => {
    if (!hasHandledInitialViewRef.current) {
      hasHandledInitialViewRef.current = true
      return
    }

    if (pendingNavigationRef.current) clearTimeout(pendingNavigationRef.current)
    // Next can flush effects inside its popstate listener. Wait for all history
    // listeners to restore the workspace before deciding whether to write a URL.
    pendingNavigationRef.current = setTimeout(() => {
      const nextPath = appRouteForView(view)
      const nextUrl = query ? `${nextPath}?${query}` : nextPath
      if (restoringHistoryRef.current) {
        if (nextUrl === restoringHistoryRef.current) restoringHistoryRef.current = null
        return
      }
      if (nextPath !== window.location.pathname || (query !== undefined && window.location.search !== (query ? `?${query}` : ''))) {
        window.history.pushState(null, '', nextUrl)
      }
    }, 0)
  }, [])

  const routedInitialView = Object.entries(publicAppRoutes).find(([, path]) => path === pathname)?.[0] as AppView | undefined

  return (
    <BookingWidget
      initialView={routedInitialView || initialView}
      initialBookingVenue={search.get('venue') === 'cafe-des-stagiaires' ? 'cafe-des-stagiaires' : 'ha-do-centrosa'}
      initialCalendarNavigation={calendarNavigation(search.toString())}
      onActiveViewChange={handleActiveViewChange}
      restoreStoredView={pathname === '/'}
    />
  )
}
