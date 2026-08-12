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
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    title,
    description,
    url: publicAppRoutes.leaderboard,
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
}

export default function HallOfFamePage() {
  return (
    <>
      <PublicRouteSeoContent currentPath={publicAppRoutes.leaderboard} title="VRena Hall of Fame" />
      <HomeAppShell initialView="leaderboard" />
    </>
  )
}
