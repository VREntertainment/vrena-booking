import type { Metadata } from 'next'
import { connection } from 'next/server'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'
import '../staff/staff.css'

export const metadata: Metadata = {
  title: 'VRena HR Console',
  description: 'VRena company HR hub for employee records, attendance, payroll, and HR setup.',
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
