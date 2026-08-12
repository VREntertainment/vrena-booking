import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import PublicRouteSeoContent from '../../components/PublicRouteSeoContent'
import { publicAppRoutes } from '../../lib/appRoutes'

const title = 'VRena Clubs | Player Groups'
const description = 'Discover public and private VRena clubs for friends, teams, and regular players in Ho Chi Minh City, including club sessions, members, and competitions.'

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: publicAppRoutes.clubs,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    title,
    description,
    url: publicAppRoutes.clubs,
    images: [{ url: '/gallery/vrena-gallery-players-01.jpg', alt: 'Players enjoying VR games at VRena' }],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: ['/gallery/vrena-gallery-players-01.jpg'],
  },
}

export default function ClubsPage() {
  return (
    <>
      <PublicRouteSeoContent currentPath={publicAppRoutes.clubs} title="VRena Clubs" />
      <HomeAppShell initialView="clubs" />
    </>
  )
}
