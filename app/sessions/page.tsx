import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import PublicRouteSeoContent from '../../components/PublicRouteSeoContent'
import { publicAppRoutes } from '../../lib/appRoutes'

const title = 'VRena Sessions | Join VR Games'
const description = 'Find and join public VRena game sessions in Ho Chi Minh City, meet other VR players, choose upcoming games, and plan your next multiplayer visit.'

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: publicAppRoutes.sessions,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    title,
    description,
    url: publicAppRoutes.sessions,
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
}

export default function SessionsPage() {
  return (
    <>
      <PublicRouteSeoContent currentPath={publicAppRoutes.sessions} title="Join VRena Sessions" />
      <HomeAppShell initialView="sessions" />
    </>
  )
}
