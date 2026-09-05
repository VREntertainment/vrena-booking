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
  category: 'FPS / PVP' | 'Escape' | 'Tournament' | 'Other'
  image: string
  durationMinutes: number
  maxPlayersPerArena: number
  audience: GameAudience[]
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
    category: 'FPS / PVP',
    image: '/games/laser-tag.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'teamwork', 'beginnerFriendly', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'mini-block-towers',
    title: 'Mini Block Towers',
    category: 'FPS / PVP',
    image: '/games/mini-block-towers.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['familyFriendly', 'beginnerFriendly', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'office-war',
    title: 'Office War',
    category: 'FPS / PVP',
    image: '/games/office-war.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['fun', 'teamwork', 'beginnerFriendly'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'paintball',
    title: 'Paintball',
    category: 'FPS / PVP',
    image: '/games/paintball.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'teamwork', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'snow-battle',
    title: 'Snow Battle',
    category: 'FPS / PVP',
    image: '/games/snow-battle.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['familyFriendly', 'beginnerFriendly', 'fun'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'castle-unspunnen',
    title: 'Castle Unspunnen',
    category: 'FPS / PVP',
    image: '/games/castle-unspunnen.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['quest', 'teamwork', 'competitive'],
    venues: ['ha-do-centrosa'],
  },
  {
    id: 'wild-west',
    title: 'Wild West',
    category: 'FPS / PVP',
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
    category: 'FPS / PVP',
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

/** Active staff records define availability; the built-in catalog supplies artwork
 * and editorial defaults only for games that are actually in the staff catalog. */
export function mergeStaffGameCatalog(staffGuides: StaffGameGuide[], imageOrigin?: string) {
  const defaults = new Map(publicGameGuideCatalog.map((game) => [game.id, game]))
  const categories: Record<string, PublicGameGuideGame['category']> = {
    shooting: 'FPS / PVP', escape: 'Escape', tournament: 'Tournament', other: 'Other',
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
      title: guide.name?.trim() || base?.title || guide.slug,
      category: categories[guide.game_type?.toLowerCase() || ''] || base?.category || 'Other',
      image: safeImage(guide.image_url) ? guide.image_url! : base?.image || '/games/laser-tag.png',
      durationMinutes: guide.duration_minutes || base?.durationMinutes || 20,
      maxPlayersPerArena: guide.max_players_per_arena || base?.maxPlayersPerArena || 4,
      audience: audience.length > 0 ? audience : base?.audience || [],
      venues: base?.venues || ['ha-do-centrosa'],
    }
  })
}
