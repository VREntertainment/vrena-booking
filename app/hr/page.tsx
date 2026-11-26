import type { Metadata } from 'next'
import { connection } from 'next/server'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'VRena Employee Access',
  description: 'Manage employee store access and PIN validity.',
  alternates: {
    canonical: publicAppRoutes.hr,
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default async function HrPage() {
  await connection()
  return <HomeAppShell initialView="hr" />
}
