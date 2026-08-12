import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import PublicRouteSeoContent from '../../components/PublicRouteSeoContent'
import { publicAppRoutes } from '../../lib/appRoutes'

const title = 'VRena Tickets | Book Without an Account'
const description = 'Book VRena tickets in Ho Chi Minh City for individual players, friends, families, birthdays, and groups, with guest booking available without an account.'

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: publicAppRoutes.tickets,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    title,
    description,
    url: publicAppRoutes.tickets,
    images: [{ url: '/gallery/vrena-gallery-players-01.jpg', alt: 'Players enjoying VR games at VRena' }],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: ['/gallery/vrena-gallery-players-01.jpg'],
  },
}

export default function TicketsPage() {
  return (
    <>
      <PublicRouteSeoContent currentPath={publicAppRoutes.tickets} title="Book VRena Tickets" />
      <HomeAppShell initialView="tickets" />
    </>
  )
}
