import type { Metadata } from 'next'
import PhoneAccountSetupClient from '@/components/PhoneAccountSetupClient'

export const metadata: Metadata = {
  title: 'Finish VRena account setup',
  description: 'Verify your email and create your private VRena password.',
  robots: { index: false, follow: false },
}

export default function PhoneAccountSetupPage() {
  return <PhoneAccountSetupClient />
}
