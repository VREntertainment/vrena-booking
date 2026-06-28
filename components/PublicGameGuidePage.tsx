import Image from 'next/image'
import Link from 'next/link'
import type { LanguageCode, TranslationMap } from '../lib/i18n'
import { languageOptions } from '../lib/i18n'
import {
  gameAudienceLabelKeys,
  guideTextItems,
  isStaffGuideLanguage,
  normalizeStaffAudience,
  normalizedGuideText,
  publicGameGuideCatalog,
  type PublicGameGuideGame,
  type StaffGameGuide,
} from '../lib/gameGuideCatalog'

type PublicGameGuidePageProps = {
  appUrl?: string
  language: LanguageCode
  staffGuides: StaffGameGuide[]
  text: TranslationMap
}

function isSafeStaffImageUrl(value: string | null | undefined) {
  if (!value) return false

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false

  try {
    return new URL(value).origin === new URL(supabaseUrl).origin
  } catch {
    return false
  }
}

function categoryFromStaffGame(value: string | null | undefined, fallback: PublicGameGuideGame['category']) {
  const normalized = value?.toLowerCase() || ''
  if (normalized === 'escape') return 'Escape'
  if (normalized === 'tournament') return 'Tournament'
  if (normalized === 'shooting') return 'FPS / PVP'
  if (normalized === 'other') return 'Other'
  return fallback
}

function mergeStaffGames(staffGuides: StaffGameGuide[]) {
  const staffGuideBySlug = new Map(staffGuides.map((guide) => [guide.slug, guide]))
  const knownIds = new Set(publicGameGuideCatalog.map((game) => game.id))
  const mergedGames = publicGameGuideCatalog.map((game) => {
    const staffGuide = staffGuideBySlug.get(game.id)
    if (!staffGuide) return game

    const staffAudience = normalizeStaffAudience(staffGuide.audience, staffGuide.difficulty)

    return {
      ...game,
      title: staffGuide.name?.trim() || game.title,
      category: categoryFromStaffGame(staffGuide.game_type, game.category),
      image: isSafeStaffImageUrl(staffGuide.image_url) ? staffGuide.image_url as string : game.image,
      durationMinutes: staffGuide.duration_minutes || game.durationMinutes,
      maxPlayersPerArena: staffGuide.max_players_per_arena || game.maxPlayersPerArena,
      audience: staffAudience.length > 0 ? staffAudience : game.audience,
    }
  })

  const extraStaffGames = staffGuides
    .filter((guide) => guide.slug && !knownIds.has(guide.slug))
    .map<PublicGameGuideGame>((guide) => ({
      id: guide.slug,
      title: guide.name?.trim() || guide.slug,
      category: categoryFromStaffGame(guide.game_type, 'Other'),
      image: isSafeStaffImageUrl(guide.image_url) ? guide.image_url as string : '/games/laser-tag.png',
      durationMinutes: guide.duration_minutes || 20,
      maxPlayersPerArena: guide.max_players_per_arena || 4,
      audience: normalizeStaffAudience(guide.audience, guide.difficulty),
    }))

  return [...mergedGames, ...extraStaffGames]
}

function fallbackSummary(game: PublicGameGuideGame, text: TranslationMap) {
  if (game.id === 'mini-block-towers') return text.gameGuideBlockTowersSummary
  if (game.category === 'Escape') return text.gameGuideEscapeSummary
  return text.gameGuideFpsSummary
}

function fallbackRules(game: PublicGameGuideGame, text: TranslationMap) {
  if (game.category === 'Escape') return ''
  if (game.id === 'mini-block-towers') return text.gameGuideBlockTowersRules
  return text.gameGuideFpsRules
}

function fallbackTips(game: PublicGameGuideGame, text: TranslationMap) {
  if (game.id === 'mini-block-towers') return text.gameGuideBlockTowersTips
  if (game.category === 'Escape') return text.gameGuideEscapeTips
  return text.gameGuideFpsTips
}

export default function PublicGameGuidePage({
  appUrl = '/',
  language,
  staffGuides,
  text,
}: PublicGameGuidePageProps) {
  const staffGuideBySlug = new Map(staffGuides.map((guide) => [guide.slug, guide]))
  const games = mergeStaffGames(staffGuides)

  return (
    <main>
      <section className="public-game-guide-page">
        <header className="public-game-guide-hero">
          <Link className="brand-logo" href="/" aria-label="VRena Booking App">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-logo-full-dark.svg" />
              <img src="/brand/vrena-logo-full-light.svg" alt="VRena" />
            </picture>
          </Link>
          <div className="public-game-guide-title">
            <h1>{text.gameGuideTitle}</h1>
            <p>{text.gameGuideIntro}</p>
          </div>
          <nav className="public-game-guide-languages" aria-label={text.language}>
            {languageOptions.map((option) => {
              const href = option === 'en' ? '/games' : `/games/${option}`
              return (
                <Link aria-current={option === language ? 'page' : undefined} href={href} key={option}>
                  {option.toUpperCase()}
                </Link>
              )
            })}
          </nav>
          <Link className="public-game-guide-app-link" href={appUrl}>
            {text.sessions}
          </Link>
        </header>

        <div className="game-guide-scroll public-game-guide-list">
          {games.map((game, index) => {
            const staffGuide = staffGuideBySlug.get(game.id)
            const fallbackLanguage = isStaffGuideLanguage(staffGuide?.guide_language) ? staffGuide.guide_language : 'en'
            const summary = normalizedGuideText(staffGuide?.guide_summary, language, fallbackLanguage, fallbackSummary(game, text))
            const rules = guideTextItems(normalizedGuideText(staffGuide?.guide_rules, language, fallbackLanguage, fallbackRules(game, text)))
            const tips = guideTextItems(normalizedGuideText(staffGuide?.guide_tips, language, fallbackLanguage, fallbackTips(game, text)))

            return (
              <article className="game-guide-card public-game-guide-card" key={game.id}>
                <Image src={game.image} alt={game.title} width={240} height={240} priority={index < 2} sizes="(max-width: 720px) 96px, 140px" />
                <div className="game-guide-card-body">
                  <div className="game-guide-card-head">
                    <div>
                      <h2>{game.title}</h2>
                      <span>{game.category}</span>
                    </div>
                    <div className="game-guide-facts">
                      <span>{text.gameGuideDuration}: <strong>{game.durationMinutes} min</strong></span>
                      <span>{text.gameGuidePlayers}: <strong>{game.maxPlayersPerArena} / {text.arena}</strong></span>
                    </div>
                  </div>
                  <p>{summary}</p>
                  {game.audience.length > 0 && (
                    <div className="game-guide-audience" aria-label={text.gameGuideAudience}>
                      {game.audience.map((audience) => (
                        <span key={audience}>{text[gameAudienceLabelKeys[audience]]}</span>
                      ))}
                    </div>
                  )}
                  {rules.length > 0 && (
                    <details className="game-guide-panel">
                      <summary>{text.gameGuideRules}</summary>
                      <ul>
                        {rules.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {tips.length > 0 && (
                    <details className="game-guide-panel">
                      <summary>{text.gameGuideTips}</summary>
                      <ul>
                        {tips.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
