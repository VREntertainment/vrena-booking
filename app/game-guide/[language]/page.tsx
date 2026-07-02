import { redirect } from 'next/navigation'
import { isLanguageCode } from '../../../lib/i18n/languages'

type GameGuideAliasLanguagePageProps = {
  params: Promise<{
    language: string
  }>
}

export default async function GameGuideAliasLanguagePage({ params }: GameGuideAliasLanguagePageProps) {
  const { language } = await params
  redirect(isLanguageCode(language) && language !== 'en' ? `/games/${language}` : '/games')
}
