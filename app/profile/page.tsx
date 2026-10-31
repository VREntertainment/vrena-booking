import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'VRena Profile',
  description: 'Manage your VRena bookings, loyalty points, contact details, and account preferences.',
  alternates: {
    canonical: publicAppRoutes.profile,
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ProfilePage() {
  return <HomeAppShell initialView="profile" />
}
