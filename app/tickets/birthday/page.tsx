import type { Metadata } from 'next'
import HomeAppShell from '../../../components/HomeAppShell'

export const metadata: Metadata = {
  title: 'Birthday Packages | VRena Booking',
  description: 'Choose Mini Birthday, Birthday Squad or Epic Birthday and reserve your two-hour VRena birthday.',
  alternates: { canonical: '/tickets/birthday' },
  robots: { index: false, follow: true },
}

export default function BirthdayBookingPage() {
  return <HomeAppShell initialView="tickets" />
}
