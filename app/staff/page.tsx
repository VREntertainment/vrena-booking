import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'VRena Staff Console',
  description: 'VRena staff operations console.',
  alternates: {
    canonical: publicAppRoutes.staff,
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function StaffPage() {
  return <HomeAppShell initialView="staff" />
}
