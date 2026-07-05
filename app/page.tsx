import type { Metadata } from 'next'
import HomeAppShell from '../components/HomeAppShell'

export const metadata: Metadata = {
  title: 'VRena Booking | VR Games in Vietnam',
  description: 'Book VRena tickets, join community sessions, discover clubs, and view player rankings.',
  alternates: {
    canonical: '/',
  },
}

export default function Home() {
  return <HomeAppShell />
}
