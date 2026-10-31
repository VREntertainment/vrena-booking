import { redirect } from 'next/navigation'
import { CUSTOMER_SOCIAL_FEATURES_ENABLED } from '../../lib/customerExperience'
import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import PublicRouteSeoContent from '../../components/PublicRouteSeoContent'
import { publicAppRoutes } from '../../lib/appRoutes'

const title = 'VRena Hall of Fame | Player Rankings'
const description = 'Explore the VRena Hall of Fame for player rankings, top scores, achievements, game statistics, and leading VR competitors in Ho Chi Minh City.'

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: publicAppRoutes.leaderboard,
  },
  robots: {
    index: CUSTOMER_SOCIAL_FEATURES_ENABLED,
    follow: true,
  },
  openGraph: {
    type: 'website',
    title,
    description,
    url: publicAppRoutes.leaderboard,
    images: [{ url: '/gallery/vrena-gallery-players-01.jpg', alt: 'Players enjoying VR games at VRena' }],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: ['/gallery/vrena-gallery-players-01.jpg'],
  },
}

export default async function HallOfFamePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!CUSTOMER_SOCIAL_FEATURES_ENABLED) {
    const params = await searchParams
    const venue = params.venue === 'cafe-des-stagiaires' ? 'cafe-des-stagiaires' : 'ha-do-centrosa'
    redirect(`/tickets?venue=${venue}`)
  }
  return (
    <>
      <PublicRouteSeoContent currentPath={publicAppRoutes.leaderboard} title="VRena Hall of Fame" />
      <HomeAppShell initialView="leaderboard" />
    </>
  )
}
