import type { Metadata } from 'next'
import ZaloAuthHandoff from './ZaloAuthHandoff'

export const metadata: Metadata = {
  title: 'Signing in with Zalo | VRena',
  description: 'Securely complete your VRena player sign-in.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ZaloAuthPage() {
  return <ZaloAuthHandoff />
}
