import type { Metadata } from 'next'
import { connection } from 'next/server'
import BookingWidget from '../../components/BookingWidget'
import '../staff/staff.css'

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

export default async function AdminPage() {
  await connection()
  return <BookingWidget initialView="staff" />
}
