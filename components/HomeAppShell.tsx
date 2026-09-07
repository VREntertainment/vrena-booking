'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useRef } from 'react'
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
  const router = useRouter()
  const search = useSearchParams()
  const hasHandledInitialViewRef = useRef(false)

  function handleActiveViewChange(view: AppView, query?: string) {
    if (!hasHandledInitialViewRef.current) {
      hasHandledInitialViewRef.current = true
      return
    }

    const nextPath = appRouteForView(view)
    if (nextPath !== pathname || (query !== undefined && window.location.search !== (query ? `?${query}` : ''))) {
      router.push(query ? `${nextPath}?${query}` : nextPath)
    }
  }

  const routedInitialView = Object.entries(publicAppRoutes).find(([, path]) => path === pathname)?.[0] as AppView | undefined

  return (
    <BookingWidget
      initialView={routedInitialView || initialView}
      initialCalendarNavigation={calendarNavigation(search.toString())}
      onActiveViewChange={handleActiveViewChange}
      restoreStoredView={pathname === '/'}
    />
  )
}
