import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  applicationName: 'VRena Staff',
  manifest: '/staff.webmanifest',
  appleWebApp: { capable: true, title: 'VRena Staff', statusBarStyle: 'default' },
  title: 'Create a VRena Session',
  description: 'Check VRena availability and plan your next booking.',
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
