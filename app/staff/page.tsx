import type { Metadata } from 'next'
import { connection } from 'next/server'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'
import './staff.css'

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

export default async function StaffPage() {
  await connection()
  return <HomeAppShell initialView="staff" />
}
