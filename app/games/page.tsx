import type { Metadata } from 'next'
import PublicGameGuidePage from '../../components/PublicGameGuidePage'
import { uiText } from '../../lib/i18n/translations'
import { getCachedPublicStaffGameGuides } from '../../lib/publicGameGuides'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Game Guide | VRena_Booking_App',
  description: 'Fast public guide to VRena games, gameplay, tips, duration, and audience fit.',
}

export default async function GamesPage() {
  const staffGuides = await getCachedPublicStaffGameGuides()

  return (
    <div className="app public-game-guide-app">
      <PublicGameGuidePage language="en" staffGuides={staffGuides} text={uiText.en} />
    </div>
  )
}
