import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicGameGuidePage from '../../../components/PublicGameGuidePage'
import { isLanguageCode, languageOptions, type LanguageCode } from '../../../lib/i18n/languages'
import { uiText } from '../../../lib/i18n/translations'
import { getCachedPublicStaffGameGuides } from '../../../lib/publicGameGuides'
import '../public-game-guide.css'

type GamesLanguagePageProps = {
  params: Promise<{
    language: string
  }>
}

export const revalidate = 60

export async function generateMetadata({ params }: GamesLanguagePageProps): Promise<Metadata> {
  const { language } = await params
  if (!isLanguageCode(language)) notFound()
  return {
    title: `${uiText[language].gameGuideTitle} | VRena`,
    description: uiText[language].gameGuideIntro,
    alternates: { canonical: `/games/${language}` },
  }
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
