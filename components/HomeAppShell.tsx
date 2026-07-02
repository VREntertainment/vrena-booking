'use client'

import dynamic from 'next/dynamic'
import BrandLoader from './BrandLoader'

const BookingWidget = dynamic(() => import('./BookingWidget'), {
  ssr: false,
  loading: () => (
    <main className="app-route-loader">
      <BrandLoader label="Loading Hall of Fame" />
    </main>
  ),
})

export default function HomeAppShell() {
  return <BookingWidget />
}
