import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicGameGuidePage from '../../../components/PublicGameGuidePage'
import { isLanguageCode, languageOptions, type LanguageCode } from '../../../lib/i18n'
import { uiText } from '../../../lib/i18n/translations'
import { getCachedPublicStaffGameGuides } from '../../../lib/publicGameGuides'

type GamesLanguagePageProps = {
  params: Promise<{
    language: string
  }>
}

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Game Guide | VRena_Booking_App',
  description: 'Fast public guide to VRena games, gameplay, tips, duration, and audience fit.',
}

export function generateStaticParams() {
  return languageOptions.map((language) => ({ language }))
}

export default async function GamesLanguagePage({ params }: GamesLanguagePageProps) {
  const { language: rawLanguage } = await params
  if (!isLanguageCode(rawLanguage)) notFound()

  const language = rawLanguage as LanguageCode
  const staffGuides = await getCachedPublicStaffGameGuides()

  return (
    <div className="app public-game-guide-app">
      <PublicGameGuidePage language={language} staffGuides={staffGuides} text={uiText[language]} />
    </div>
  )
}
