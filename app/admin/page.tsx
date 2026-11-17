import type { Metadata } from 'next'
import { connection } from 'next/server'
import HomeAppShell from '../../components/HomeAppShell'

export const metadata: Metadata = {
  applicationName: 'VRena Staff',
  manifest: '/staff.webmanifest',
  appleWebApp: { capable: true, title: 'VRena Staff', statusBarStyle: 'default' },
  title: 'VRena Admin',
  description: 'VRena admin console.',
  alternates: {
    canonical: '/admin',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminPage() {
  await connection()
  return <HomeAppShell initialView="staff" />
}
