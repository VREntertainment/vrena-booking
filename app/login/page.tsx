import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'VRena Login',
  description: 'Sign in to VRena.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginPage() {
  redirect('/')
}
