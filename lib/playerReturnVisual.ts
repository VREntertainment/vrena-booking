import type { GameId } from './bookingStaticData'
import type {
  AchievementState,
  AchievementTier,
  RetentionAchievementId,
} from './profileAchievements'

export type PlayerReturnVisualSource = 'achievement' | 'fallback' | 'trickster'

export type PlayerReturnVisual = {
  id: string
  imageSrc: string
  source: PlayerReturnVisualSource
  title: string
}

type GameVisualAchievement = {
  game: {
    id: GameId
    title: string
  }
  state: AchievementState
  tier: AchievementTier
}

type TricksterVisualAchievement = {
  id: RetentionAchievementId
  state: AchievementState
  title: string
}

const fallbackVisual: PlayerReturnVisual = {
  id: 'fallback:wild-west',
  imageSrc: '/retention/wild-west-cowboy.png',
  source: 'fallback',
  title: 'VRena player',
}

const gameVisualById: Record<GameId, string> = {
  'arc-of-the-covenant': '/retention/escape-investigator.png',
  'castle-unspunnen': '/retention/alpine-sentinel.png',
  'joller-house': '/retention/escape-investigator.png',
  'laser-tag': '/retention/arena-laser-champion.png',
  'mini-block-towers': '/retention/arena-builder.png',
  'office-war': '/retention/arena-builder.png',
  paintball: '/retention/arena-laser-champion.png',
  'snow-battle': '/retention/alpine-sentinel.png',
  'wild-west': '/retention/wild-west-cowboy.png',
}

const vietnamDayFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
})

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function featuredVisualKey(achievement: { id: string; kind: 'game' | 'retention' }) {
  return achievement.kind === 'game'
    ? `achievement:${achievement.id}`
    : `trickster:${achievement.id}`
}

export function playerReturnVisualDayKey(date: Date) {
  const parts = Object.fromEntries(
    vietnamDayFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function buildPlayerReturnVisualPool(
  gameAchievements: GameVisualAchievement[],
  tricksterAchievements: TricksterVisualAchievement[],
) {
  const gameVisuals = gameAchievements
    .filter((achievement) => achievement.state !== 'locked' && achievement.tier !== 'none')
    .map((achievement): PlayerReturnVisual => ({
      id: `achievement:${achievement.game.id}`,
      imageSrc: gameVisualById[achievement.game.id],
      source: 'achievement',
      title: achievement.game.title,
    }))

  const tricksterVisuals = tricksterAchievements
    .filter((achievement) => achievement.state !== 'locked')
    .map((achievement): PlayerReturnVisual => ({
      id: `trickster:${achievement.id}`,
      imageSrc: '/retention/trickster-host.png',
      source: 'trickster',
      title: achievement.title,
    }))

  return [...gameVisuals, ...tricksterVisuals]
}

export function selectPlayerReturnVisual({
  candidates,
  dayKey,
  featuredUnlock,
  userId,
}: {
  candidates: PlayerReturnVisual[]
  dayKey: string
  featuredUnlock?: { id: string; kind: 'game' | 'retention' }
  userId: string
}) {
  if (candidates.length === 0) return fallbackVisual

  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  if (featuredUnlock) {
    const featuredCandidate = candidateById.get(featuredVisualKey(featuredUnlock))
    if (featuredCandidate) return featuredCandidate
  }

  const collectionVisuals = candidates.filter((candidate) => candidate.source === 'achievement')
  const tricksterVisuals = candidates.filter((candidate) => candidate.source === 'trickster')
  const sourceGroups = [collectionVisuals, tricksterVisuals].filter((group) => group.length > 0)
  const sourceGroup = sourceGroups[stableHash(`${userId}:${dayKey}:source`) % sourceGroups.length]

  return sourceGroup[stableHash(`${userId}:${dayKey}:item`) % sourceGroup.length] ?? fallbackVisual
}
