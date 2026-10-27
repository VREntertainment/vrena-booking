import { guideSearchText } from './gameGuideCollections.ts'
import type { LanguageCode, TranslationMap } from './i18n'

export type GameAudience =
  | 'familyFriendly'
  | 'scary'
  | 'fun'
  | 'quest'
  | 'teamwork'
  | 'beginnerFriendly'
  | 'competitive'

export type GameVenue = 'ha-do-centrosa' | 'cafe-des-stagiaires'

export type PublicGameGuideGame = {
  id: string
  title: string
  category: 'PVP' | 'PVE' | 'PVP / PVE' | 'Escape' | 'Tournament' | 'Other' | 'Kid birthday' | 'Pop-Up event'
  image: string
  durationMinutes: number
  maxPlayersPerArena: number
  audience: GameAudience[]
  popUp?: boolean
  venues: GameVenue[]
}

export type StaffGameGuideText = Partial<Record<LanguageCode, string>>

export type StaffGameGuide = {
  slug: string
  active?: boolean
  name?: string | null
  game_type?: string | null
  duration_minutes?: number | null
  max_players_per_arena?: number | null
  image_url?: string | null
  difficulty?: string | null
  audience?: string[] | string | null
  guide_language?: string | null
  guide_summary?: StaffGameGuideText | null
  guide_rules?: StaffGameGuideText | null
  guide_tips?: StaffGameGuideText | null
}

export const PUBLIC_GAME_GUIDE_REVALIDATE_SECONDS = 60

export const publicGameGuideCatalog: PublicGameGuideGame[] = [
  {
    id: 'laser-tag',
    title: 'Laser Tag',
    category: 'PVP',
    image: '/games/laser-tag.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'teamwork', 'beginnerFriendly', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'mini-block-towers',
    title: 'Mini Block Towers',
    category: 'PVP',
    image: '/games/mini-block-towers.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['familyFriendly', 'beginnerFriendly', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'office-war',
    title: 'Office War',
    category: 'PVP',
    image: '/games/office-war.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['fun', 'teamwork', 'beginnerFriendly'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'paintball',
    title: 'Paintball',
    category: 'PVP',
    image: '/games/paintball.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'teamwork', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'snow-battle',
    title: 'Snow Battle',
    category: 'PVP',
    image: '/games/snow-battle.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['familyFriendly', 'beginnerFriendly', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'castle-unspunnen',
    title: 'Castle Unspunnen',
    category: 'PVP',
    image: '/games/castle-unspunnen.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['quest', 'teamwork', 'competitive'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'wild-west',
    title: 'Wild West',
    category: 'PVP',
    image: '/games/wild-west.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'arc-of-the-covenant',
    title: 'The Secret of the Arc',
    category: 'Escape',
    image: '/games/arc-of-the-covenant.png',
    durationMinutes: 40,
    maxPlayersPerArena: 4,
    audience: ['quest', 'teamwork'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'joller-house',
    title: 'Joller House',
    category: 'Escape',
    image: '/games/joller-house.png',
    durationMinutes: 40,
    maxPlayersPerArena: 4,
    audience: ['scary', 'quest', 'teamwork'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'revolta',
    title: 'Revolta',
    category: 'PVP',
    image: '/games/revolta.webp',
    durationMinutes: 45,
    maxPlayersPerArena: 8,
    audience: ['competitive', 'teamwork', 'fun'],
    venues: ['ha-do-centrosa', 'cafe-des-stagiaires'],
  },
  {
    id: 'city-z',
    title: 'City Z',
    category: 'Other',
    image: '/games/city-z.webp',
    durationMinutes: 45,
    maxPlayersPerArena: 6,
    audience: ['scary', 'quest', 'teamwork'],
    venues: ['ha-do-centrosa', 'cafe-des-stagiaires'],
  },
  {
    id: 'station-zarya',
    title: 'Station Zarya',
    category: 'Other',
    image: '/games/station-zarya.webp',
    durationMinutes: 45,
    maxPlayersPerArena: 6,
    audience: ['scary', 'quest', 'teamwork'],
    venues: ['ha-do-centrosa', 'cafe-des-stagiaires'],
  },
]

export const gameAudienceLabelKeys: Record<GameAudience, keyof TranslationMap> = {
  familyFriendly: 'audienceFamilyFriendly',
  scary: 'audienceScary',
  fun: 'audienceFun',
  quest: 'audienceQuest',
  teamwork: 'audienceTeamwork',
  beginnerFriendly: 'audienceBeginnerFriendly',
  competitive: 'audienceCompetitive',
}

const staffAudienceMap: Record<string, GameAudience> = {
  familyfriendly: 'familyFriendly',
  family_friendly: 'familyFriendly',
  scary: 'scary',
  fun: 'fun',
  quest: 'quest',
  teamwork: 'teamwork',
  beginnerfriendly: 'beginnerFriendly',
  beginner_friendly: 'beginnerFriendly',
  competitive: 'competitive',
}

export function guideTextItems(value: string) {
  return value
    .split(/\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizedGuideText(
  value: StaffGameGuideText | null | undefined,
  language: LanguageCode,
  fallbackLanguage: LanguageCode,
  fallback: string
) {
  const directText = value?.[language]?.trim()
  if (directText) return directText

  const fallbackLanguageText = value?.[fallbackLanguage]?.trim()
  if (fallbackLanguageText) return fallbackLanguageText

  const englishText = value?.en?.trim()
  if (englishText) return englishText

  return fallback
}

export function normalizeStaffAudience(value: StaffGameGuide['audience'], legacyDifficulty?: string | null) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  const normalized = rawItems
    .map((item) => staffAudienceMap[item.trim().toLowerCase().replace(/\s+/g, '_')])
    .filter((item): item is GameAudience => Boolean(item))

  if (normalized.length > 0) return Array.from(new Set(normalized))

  const difficulty = legacyDifficulty?.toLowerCase() || ''
  return [
    difficulty.includes('family') ? 'familyFriendly' : null,
    difficulty.includes('scary') || difficulty.includes('hard') ? 'scary' : null,
    difficulty.includes('fun') || difficulty.includes('medium') ? 'fun' : null,
    difficulty.includes('quest') ? 'quest' : null,
    difficulty.includes('team') ? 'teamwork' : null,
    difficulty.includes('beginner') ? 'beginnerFriendly' : null,
    difficulty.includes('competitive') ? 'competitive' : null,
  ].filter((item): item is GameAudience => Boolean(item))
}

export function isStaffGuideLanguage(value: string | null | undefined): value is LanguageCode {
  return value === 'en' || value === 'vi' || value === 'ko' || value === 'ja' || value === 'fr' || value === 'de' || value === 'it'
}

const missingGuideArtwork: Record<string, string> = {
  'arcade-2-0': '/games/portal-arcade.png',
  'birthday-party': '/games/birthday-party.png',
  'orc-kings-arena': '/games/galactic-arena.png',
  'party-games': '/games/party-games.png',
  'portal-mafia': '/games/portal-mafia.png',
  'portal-zombie': '/games/portal-zombie.png',
  'vr-arena-strike': '/games/portal-strike.svg',
}

const sharedGuideGameSlugs = new Set(['arcade-2-0', 'birthday-party', 'orc-kings-arena', 'party-games', 'portal-mafia', 'portal-zombie', 'vr-arena-strike', 'laser-limbo', 'spatial-ops'])

/** Active staff records define availability; the built-in catalog supplies artwork
 * and editorial defaults only for games that are actually in the staff catalog. */
export function mergeStaffGameCatalog(staffGuides: StaffGameGuide[], imageOrigin?: string) {
  const defaults = new Map(publicGameGuideCatalog.map((game) => [game.id, game]))
  const categories: Record<string, PublicGameGuideGame['category']> = {
    shooting: 'PVP', escape: 'Escape', puzzle: 'Escape', tournament: 'Tournament', other: 'Other',
  }
  const safeImage = (url: string | null | undefined) => {
    if (!url) return false
    if (/^\/games\/[a-zA-Z0-9/_.-]+$/.test(url) && !url.includes('..')) return true
    if (!imageOrigin) return false
    try { return new URL(url).origin === new URL(imageOrigin).origin } catch { return false }
  }
  return staffGuides.filter((guide) => guide.slug && guide.active !== false).map<PublicGameGuideGame>((guide) => {
    const base = defaults.get(guide.slug)
    const audience = normalizeStaffAudience(guide.audience, guide.difficulty)
    return {
      id: guide.slug,
      title: guide.slug === 'orc-kings-arena' ? 'Galactic Arena' : guide.name?.trim() || base?.title || guide.slug,
      category: ['orc-kings-arena', 'portal-mafia', 'vr-arena-strike'].includes(guide.slug) ? 'PVP / PVE' : guide.slug === 'portal-zombie' ? 'PVE' : ['birthday-party', 'party-games'].includes(guide.slug) ? 'Kid birthday' : ['laser-limbo', 'spatial-ops'].includes(guide.slug) ? 'Pop-Up event' : categories[guide.game_type?.toLowerCase() || ''] || base?.category || 'Other',
      image: guide.slug === 'birthday-party' ? '/games/birthday-party.png' : guide.image_url !== '/games/vrena-shared.svg' && safeImage(guide.image_url) ? guide.image_url! : base?.image || missingGuideArtwork[guide.slug] || '/brand/vrena-mark-light.svg',
      durationMinutes: guide.duration_minutes || base?.durationMinutes || 20,
      maxPlayersPerArena: guide.max_players_per_arena || base?.maxPlayersPerArena || 4,
      audience: audience.length > 0 ? audience : base?.audience || [],
      venues: base?.venues || (sharedGuideGameSlugs.has(guide.slug) ? ['ha-do-centrosa', 'cafe-des-stagiaires'] : ['ha-do-centrosa']),
    }
  })
}

export function gameMinimumAge(game: Pick<PublicGameGuideGame, 'id' | 'category'>): 7 | 12 | 16 {
  // Per-game recommendations approved in the shared Canva reception booklet.
  if (['city-z', 'station-zarya', 'portal-zombie', 'arc-of-the-covenant'].includes(game.id)) return 16
  if (game.category === 'Escape' || ['joller-house', 'portal-mafia', 'spatial-ops', 'revolta', 'orc-kings-arena', 'vr-arena-strike'].includes(game.id)) return 12
  return 7
}

export type GuideFilters = { search: string; venue: GameVenue | 'all'; category: string; playerAge: string }

export function isScaryGuideGame(game: Pick<PublicGameGuideGame, 'id' | 'audience'>) {
  return game.audience.includes('scary') || game.id === 'portal-zombie'
}

export function filterGuideGames(games: PublicGameGuideGame[], filters: GuideFilters) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
  const query = normalize(filters.search)
  return games.filter((game) =>
    (!query || normalize(`${game.title} ${guideSearchText(game.id, filters.playerAge)}`).includes(query)) &&
    (game.popUp || filters.venue === 'all' || game.venues.includes(filters.venue)) &&
    (filters.category === 'all' || (filters.category === 'scary' ? isScaryGuideGame(game) : game.category === filters.category)) &&
    // Match the selected rating band, rather than every game an older player can play.
    (filters.playerAge === 'all' || gameMinimumAge(game) === (Number(filters.playerAge) >= 16 ? 16 : Number(filters.playerAge) >= 12 ? 12 : 7))
  )
}

/** Event guide entries never enter booking inventory or claim permanent venue capacity. */
export function withPopUpGuides(games: PublicGameGuideGame[]): PublicGameGuideGame[] {
  const ids = new Set(games.map((game) => game.id))
  const events: PublicGameGuideGame[] = [
    { id: 'laser-limbo', title: 'Laser Limbo', category: 'Pop-Up event', image: '/games/laser-limbo.avif', durationMinutes: 0, maxPlayersPerArena: 0, audience: ['fun', 'teamwork'], venues: [], popUp: true },
    { id: 'spatial-ops', title: 'Spatial Ops', category: 'Pop-Up event', image: '/games/spatial-ops.webp', durationMinutes: 0, maxPlayersPerArena: 0, audience: ['teamwork', 'competitive'], venues: [], popUp: true },
  ]
  return [...games.map((game) => events.find((event) => event.id === game.id) ? { ...game, category: 'Pop-Up event' as const, popUp: true, venues: [] } : game), ...events.filter((game) => !ids.has(game.id))]
}

export function gameCategoryDisplay(game: { id: string; category: string }, categoryLabel = game.category) {
  return ['laser-limbo', 'spatial-ops'].includes(game.id) ? `${categoryLabel} · PVP / PVE` : categoryLabel
}
