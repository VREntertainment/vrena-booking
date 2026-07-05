import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'VRena Hall of Fame | Player Rankings',
  description: 'Explore VRena player rankings, stats, and top performers.',
  alternates: {
    canonical: publicAppRoutes.leaderboard,
  },
}

export default function HallOfFamePage() {
  return <HomeAppShell initialView="leaderboard" />
}
