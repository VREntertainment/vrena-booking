import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'VRena Clubs | Player Groups',
  description: 'Discover public and private VRena clubs for groups, friends, and regular players.',
  alternates: {
    canonical: publicAppRoutes.clubs,
  },
}

export default function ClubsPage() {
  return <HomeAppShell initialView="clubs" />
}
