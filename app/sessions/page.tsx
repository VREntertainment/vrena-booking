import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'VRena Sessions | Join VR Games',
  description: 'Find and join public VRena community game sessions with other players.',
  alternates: {
    canonical: publicAppRoutes.sessions,
  },
}

export default function SessionsPage() {
  return <HomeAppShell initialView="sessions" />
}
