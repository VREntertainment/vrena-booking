import type { Metadata } from 'next'
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

export default function HrPage() {
  return <HomeAppShell initialView="hr" />
}
