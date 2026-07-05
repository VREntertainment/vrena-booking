import type { Metadata } from 'next'
import BookingWidget from '../../components/BookingWidget'
import { publicAppRoutes } from '../../lib/appRoutes'

export const metadata: Metadata = {
  title: 'VRena Booking',
  description: 'Legacy VRena booking app entry point.',
  alternates: {
    canonical: publicAppRoutes.tickets,
  },
  robots: {
    index: false,
    follow: true,
  },
}

export default function BookPage() {
  return <BookingWidget initialView="tickets" restoreStoredView={false} />
}
