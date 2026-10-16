import Link from 'next/link'
import DocumentLanguage from './DocumentLanguage'
import GameGuideBrowser from './GameGuideBrowser'
import GameGuideLanguageSelect from './GameGuideLanguageSelect'
import { gameGuideCopy } from '../lib/gameGuideCopy'
import type { TranslationMap } from '../lib/i18n/base'
import type { LanguageCode } from '../lib/i18n/languages'
import { mergeStaffGameCatalog, type StaffGameGuide } from '../lib/gameGuideCatalog'

type Props = { appUrl?: string; language: LanguageCode; staffGuides: StaffGameGuide[]; text: TranslationMap }

export default function PublicGameGuidePage({ appUrl = '/tickets', language, staffGuides, text }: Props) {
  const games = mergeStaffGameCatalog(staffGuides, process.env.NEXT_PUBLIC_SUPABASE_URL)
  const copy = gameGuideCopy[language]
  const guideText = Object.fromEntries(Object.entries(text).filter(([key]) => /^(gameGuide|bookingVenue|playerAgeLimit|audience)/.test(key)))
  return (
    <main lang={language}>
      <DocumentLanguage language={language} />
      <section className="public-game-guide-page">
        <header className="public-game-guide-topbar">
          <Link className="brand-logo" href="/" aria-label="VRena">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-logo-full-dark.svg" />
              <img src="/brand/vrena-logo-full-light.svg" alt="VRena" width="4886" height="1000" />
            </picture>
          </Link>
          <Link className="public-game-guide-back" href={appUrl}>{copy.booking}</Link>
          <GameGuideLanguageSelect language={language} label={text.language} />
        </header>
        <div className="public-game-guide-title">
          <h1>{text.gameGuideTitle}</h1>
          <p>{copy.intro}</p>
        </div>
        <GameGuideBrowser games={games} staffGuides={Object.fromEntries(staffGuides.map((guide) => [guide.slug, guide]))} language={language} text={guideText} />
      </section>
    </main>
  )
}
