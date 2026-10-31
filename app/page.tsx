import type { Metadata } from 'next'
import HomeAppShell from '../components/HomeAppShell'

export const metadata: Metadata = {
  title: 'VRena Booking | VR Games in Vietnam',
  description: 'Book your VR experience at Hà Đô Centrosa or Thảo Điền. Manage bookings, loyalty points, and account preferences.',
  alternates: {
    canonical: '/',
  },
}

export default function Home() {
  return <HomeAppShell />
}
