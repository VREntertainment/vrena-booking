import type { Metadata } from 'next'
import { connection } from 'next/server'
import HomeAppShell from '../../components/HomeAppShell'
import '../staff/staff.css'

export const metadata: Metadata = {
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
