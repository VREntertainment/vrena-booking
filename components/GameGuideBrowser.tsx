'use client'

import { useId, useState } from 'react'
import Image from 'next/image'
import { Clock3, Search, Users, ChevronDown } from 'lucide-react'
import { bookingDurationCopy } from '../lib/bookingDurationCopy'
import { gameGuideCopy } from '../lib/gameGuideCopy'
import { filterGuideGames, gameMinimumAge, gameAudienceLabelKeys, guideTextItems, isStaffGuideLanguage, normalizedGuideText, type GuideFilters, type PublicGameGuideGame, type StaffGameGuide } from '../lib/gameGuideCatalog'
import type { LanguageCode } from '../lib/i18n/languages'
import { collectionLabels, experienceCount } from '../lib/gameGuideCollectionLabels'
import { gameGuideCollections, collectionText } from '../lib/gameGuideCollections'
import { withPopUpGuides } from '../lib/gameGuideCatalog'
import styles from './GameGuideBrowser.module.css'

const fallbackArtwork = '/brand/vrena-mark-light.svg'

type Props = {
  games: PublicGameGuideGame[]
  staffGuides: Partial<Record<string, StaffGameGuide>>
  language: LanguageCode
  text: Record<string, string>
  initialVenue?: GuideFilters['venue']
  variant?: 'page' | 'modal'
  loading?: boolean
  loadError?: boolean
  onRetry?: () => void
}

function Artwork({ src, gameId }: { src: string; gameId: string }) {
  const [failed, setFailed] = useState(false)
  const image = failed ? fallbackArtwork : src
  const artwork = <Image className={`${image === fallbackArtwork ? styles.brandArtwork : styles.artwork} ${['arcade-2-0', 'portal-zombie', 'vr-arena-strike', 'laser-limbo'].includes(gameId) ? styles.logoArtwork : ''} ${gameId === 'birthday-party' ? styles.birthdayArtwork : ''} ${['portal-mafia', 'party-games', 'orc-kings-arena'].includes(gameId) ? styles.posterArtwork : ''}`} src={image} alt="" width={192} height={192} sizes="96px" onError={() => setFailed(true)} />
  return gameId === 'spatial-ops' && !failed ? <span className={styles.spatialCrop}>{artwork}</span> : artwork
}

function guideContent(game: PublicGameGuideGame, guide: StaffGameGuide | undefined, language: LanguageCode, text: Record<string, string>) {
  const customSummaryKeys: Record<string, string> = { revolta: 'gameGuideRevoltaSummary', 'city-z': 'gameGuideCityZSummary', 'station-zarya': 'gameGuideStationZaryaSummary' }
  const custom = customSummaryKeys[game.id]
  const block = game.id === 'mini-block-towers'
  const escape = game.category === 'Escape'
  const shooting = game.category === 'FPS / PVP'
  const fallbackLanguage = isStaffGuideLanguage(guide?.guide_language) ? guide.guide_language : 'en'
  // Unknown and collection games must not inherit a different game's weapons or scoring rules.
  const summary = custom ? text[custom] : block ? text.gameGuideBlockTowersSummary : escape ? text.gameGuideEscapeSummary : shooting ? text.gameGuideFpsSummary : gameGuideCopy[language].neutralSummary
  const rules = custom ? text[custom.replace('Summary', 'Rules')] : escape || !shooting ? '' : block ? text.gameGuideBlockTowersRules : text.gameGuideFpsRules
  const tips = custom ? '' : block ? text.gameGuideBlockTowersTips : escape ? text.gameGuideEscapeTips : shooting ? text.gameGuideFpsTips : ''
  return {
    summary: normalizedGuideText(guide?.guide_summary, language, fallbackLanguage, summary),
    rules: guideTextItems(normalizedGuideText(guide?.guide_rules, language, fallbackLanguage, rules)),
    tips: guideTextItems(normalizedGuideText(guide?.guide_tips, language, fallbackLanguage, tips)),
  }
}

export default function GameGuideBrowser({ games, staffGuides, language, text, initialVenue = 'all', variant = 'page', loading = false, loadError = false, onRetry }: Props) {
  const GameHeading = variant === 'modal' ? 'h3' : 'h2'
  const id = useId()
  const copy = { ...gameGuideCopy[language], ...collectionLabels[language] }
  const [filters, setFilters] = useState<GuideFilters>({ search: '', venue: initialVenue, category: 'all', playerAge: 'all' })
  const catalog = withPopUpGuides(games)
  const filtered = filterGuideGames(catalog, filters)
  const categoryLabels = { 'FPS / PVP': copy.shooting, Escape: copy.escape, Other: copy.other, Tournament: copy.tournament, 'Kid birthday': copy.kidBirthday, 'Pop-Up event': copy.popUpEvent }
  const categories = Object.keys(categoryLabels) as PublicGameGuideGame['category'][]
  const venueLabel = (venue: string) => venue === 'ha-do-centrosa' ? text.bookingVenueHaDoName : text.bookingVenueCafeName
  const changed = Boolean(filters.search || filters.venue !== 'all' || filters.category !== 'all' || filters.playerAge !== 'all')
  const reset = () => setFilters({ search: '', venue: 'all', category: 'all', playerAge: 'all' })

  return (
    <div className={`${styles.browser} ${variant === 'modal' ? styles.modal : ''}`}>
      <div className={styles.toolbar} role="search" aria-label={text.gameGuideTitle}>
        <label className={styles.search} htmlFor={`${id}-search`}>
          <span className={styles.srOnly}>{copy.search}</span>
          <Search size={20} aria-hidden="true" />
          <input id={`${id}-search`} type="search" placeholder={copy.search} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        </label>
        <label className={styles.select} htmlFor={`${id}-venue`}>
          <span className={styles.srOnly}>{copy.location}</span>
          <select id={`${id}-venue`} value={filters.venue} onChange={(event) => setFilters({ ...filters, venue: event.target.value as GuideFilters['venue'] })}>
            <option value="all">{copy.allLocations}</option>
            <option value="ha-do-centrosa">Hà Đô</option>
            <option value="cafe-des-stagiaires">Thảo Điền</option>
          </select>
        </label>
        <label className={styles.select} htmlFor={`${id}-category`}>
          <span className={styles.srOnly}>{copy.category}</span>
          <select id={`${id}-category`} value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
            <option value="all">{copy.allCategories}</option>
            {categories.filter((category) => catalog.some((game) => game.category === category)).map((category) => <option value={category} key={category}>{categoryLabels[category]}</option>)}
          </select>
        </label>
        <label className={`${styles.select} ${styles.ageSelect}`} htmlFor={`${id}-age`}>
          <span className={styles.srOnly}>{copy.age}</span>
          <select id={`${id}-age`} value={filters.playerAge} onChange={(event) => setFilters({ ...filters, playerAge: event.target.value })}>
            <option value="all">{copy.allAges}</option>
            <option value="11">{copy.age7}</option>
            <option value="15">{copy.age12}</option>
            <option value="16">{copy.age16}</option>
          </select>
        </label>
      </div>
      <div className={styles.resultBar}>
        <p role="status" aria-live="polite">{loading ? copy.loading : experienceCount[language].replace('{shown}', String(filtered.length)).replace('{total}', String(catalog.length))}</p>
        {changed && <button type="button" onClick={reset}>{copy.clear}</button>}
      </div>
      {loadError && <div className={styles.empty} role="alert"><p>{copy.unavailable}</p>{onRetry && <button type="button" onClick={onRetry}>{copy.retry}</button>}</div>}
      {!loading && !loadError && filtered.length === 0 && <div className={styles.empty}><p>{copy.empty}</p>{changed && <button type="button" onClick={reset}>{copy.clear}</button>}</div>}
      <div className={styles.list} aria-busy={loading}>
        {filtered.map((game) => {
          const guide = guideContent(game, staffGuides[game.id], language, text)
          const collection = gameGuideCollections[game.id]
          const age = gameMinimumAge(game)
          const ageText = text[age === 16 ? 'playerAgeLimit16' : age === 12 ? 'playerAgeLimit12' : 'playerAgeLimit']
          const capacity = filters.venue === 'ha-do-centrosa' ? Math.min(4, game.maxPlayersPerArena) : game.maxPlayersPerArena
          return (
            <article key={game.id} className={styles.game} aria-labelledby={`${id}-${game.id}`}>
              <div className={styles.gameTop}>
                <Artwork src={game.image} gameId={game.id} />
                <div className={styles.gameHeading}>
                  <GameHeading id={`${id}-${game.id}`}>{game.title}</GameHeading>
                  <p className={styles.category}>{categoryLabels[game.category]}</p>
                  <strong className={styles.age}>{ageText}</strong>
                </div>
              </div>
              {game.popUp ? <p className={styles.summary}>{copy.eventSetup}</p> : <div className={styles.facts}>
                <span><Clock3 size={17} aria-hidden="true" /><span className={styles.srOnly}>{bookingDurationCopy[language].game}: </span>{game.durationMinutes} min</span>
                <span><Users size={17} aria-hidden="true" />{copy.players.replace('{count}', String(capacity))}</span>
              </div>}
              <p className={styles.summary}>{collection ? collectionText(collection.summary, language) : guide.summary}</p>
              {collection && <details className={styles.details} key={`${game.id}-${filters.search}`} open={filters.search.trim() ? true : undefined}>
                <summary>{copy.included}<span className={styles.srOnly}> - {game.title}</span><ChevronDown size={18} aria-hidden="true" /></summary>
                <div className={styles.instructions}>
                  {(['games', 'modes'] as const).map((kind) => collection[kind] && <section key={kind}><h3>{copy[kind]}</h3><ul>{collection[kind]!.filter((item) => filters.playerAge === 'all' || (item.minimumAge || age) <= Number(filters.playerAge)).map((item) => <li key={item.title}><strong>{item.title}</strong>{item.minimumAge && <span className={styles.age}>{text.playerAgeLimit12}</span>}<p>{collectionText(item.description, language)}</p></li>)}</ul></section>)}
                  {collection.maps && <section><h3>{copy.maps}</h3><ul>{collection.maps.map((map) => <li key={map}>{map}</li>)}</ul></section>}
                </div>
              </details>}
              {!collection && <details className={styles.details}>
                <summary>{copy.howToPlay}<span className={styles.srOnly}> — {game.title}</span><ChevronDown size={18} aria-hidden="true" /></summary>
                <div className={styles.instructions}>
                  {guide.rules.length > 0 ? <ol>{guide.rules.map((rule) => <li key={rule}>{rule}</li>)}</ol> : <p>{copy.neutralSummary}</p>}
                  {guide.tips.length > 0 && <section><h3>{text.gameGuideTips}</h3><ul>{guide.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>}
                  {!game.popUp && <section><h3>{text.bookingVenueLabel}</h3><ul>{game.venues.map((venue) => <li key={venue}>{venueLabel(venue)} · {text.gameGuidePlayers}: {venue === 'ha-do-centrosa' ? Math.min(4, game.maxPlayersPerArena) : game.maxPlayersPerArena}</li>)}</ul></section>}
                  {game.audience.length > 0 && <p>{game.audience.map((audience) => text[gameAudienceLabelKeys[audience]]).join(' · ')}</p>}
                </div>
              </details>}
            </article>
          )
        })}
      </div>
    </div>
  )
}
