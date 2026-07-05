'use client'

import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useRef } from 'react'
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
  const pathname = usePathname()
  const router = useRouter()
  const hasHandledInitialViewRef = useRef(false)

  function handleActiveViewChange(view: AppView) {
    if (!hasHandledInitialViewRef.current) {
      hasHandledInitialViewRef.current = true
      return
    }

    const nextPath = appRouteForView(view)
    if (nextPath !== pathname) {
      router.push(nextPath)
    }
  }

  const routedInitialView = Object.entries(publicAppRoutes).find(([, path]) => path === pathname)?.[0] as AppView | undefined

  return (
    <BookingWidget
      initialView={routedInitialView || initialView}
      onActiveViewChange={handleActiveViewChange}
      restoreStoredView={pathname === '/'}
    />
  )
}
