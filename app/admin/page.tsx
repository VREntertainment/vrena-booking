import type { Metadata } from 'next'
import BookingWidget from '../../components/BookingWidget'

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

export default function AdminPage() {
  return <BookingWidget initialView="staff" />
}
