import type { Metadata } from 'next'
import HomeAppShell from '../../components/HomeAppShell'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'VRena Tickets | Book Without an Account',
  description: 'Reserve VRena for you or your group without creating an account.',
  alternates: {
    canonical: publicAppRoutes.tickets,
  },
}

export default function TicketsPage() {
  return <HomeAppShell initialView="tickets" />
}
