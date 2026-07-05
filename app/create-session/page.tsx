import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'Create a VRena Session',
  description: 'Create a public or private VRena game session and invite others to play.',
  alternates: {
    canonical: publicAppRoutes.create,
  },
  robots: {
    index: false,
    follow: true,
  },
}

export default function CreateSessionPage() {
  return <HomeAppShell initialView="create" />
}
