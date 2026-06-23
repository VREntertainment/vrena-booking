import type { LanguageCode, TranslationMap } from './i18n'

export type GameAudience =
  | 'familyFriendly'
  | 'scary'
  | 'fun'
  | 'quest'
  | 'teamwork'
  | 'beginnerFriendly'
  | 'competitive'

export type PublicGameGuideGame = {
  id: string
  title: string
  category: 'FPS / PVP' | 'Escape' | 'Tournament' | 'Other'
  image: string
  durationMinutes: number
  maxPlayersPerArena: number
  audience: GameAudience[]
}

export type StaffGameGuideText = Partial<Record<LanguageCode, string>>

export type StaffGameGuide = {
  slug: string
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

export const PUBLIC_GAME_GUIDE_REVALIDATE_SECONDS = 60 * 60 * 24

export const publicGameGuideCatalog: PublicGameGuideGame[] = [
  {
    id: 'laser-tag',
    title: 'Laser Tag',
    category: 'FPS / PVP',
    image: '/games/laser-tag.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'teamwork', 'beginnerFriendly', 'fun'],
  },
  {
    id: 'mini-block-towers',
    title: 'Mini Block Towers',
    category: 'FPS / PVP',
    image: '/games/mini-block-towers.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['familyFriendly', 'beginnerFriendly', 'fun'],
  },
  {
    id: 'office-war',
    title: 'Office War',
    category: 'FPS / PVP',
    image: '/games/office-war.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['fun', 'teamwork', 'beginnerFriendly'],
  },
  {
    id: 'paintball',
    title: 'Paintball',
    category: 'FPS / PVP',
    image: '/games/paintball.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'teamwork', 'fun'],
  },
  {
    id: 'snow-battle',
    title: 'Snow Battle',
    category: 'FPS / PVP',
    image: '/games/snow-battle.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['familyFriendly', 'beginnerFriendly', 'fun'],
  },
  {
    id: 'castle-unspunnen',
    title: 'Castle Unspunnen',
    category: 'FPS / PVP',
    image: '/games/castle-unspunnen.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['quest', 'teamwork', 'competitive'],
  },
  {
    id: 'wild-west',
    title: 'Wild West',
    category: 'FPS / PVP',
    image: '/games/wild-west.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'fun'],
  },
  {
    id: 'arc-of-the-covenant',
    title: 'The Secret of the Arc',
    category: 'Escape',
    image: '/games/arc-of-the-covenant.png',
    durationMinutes: 40,
    maxPlayersPerArena: 4,
    audience: ['quest', 'teamwork'],
  },
  {
    id: 'joller-house',
    title: 'Joller House',
    category: 'Escape',
    image: '/games/joller-house.png',
    durationMinutes: 40,
    maxPlayersPerArena: 4,
    audience: ['scary', 'quest', 'teamwork'],
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
