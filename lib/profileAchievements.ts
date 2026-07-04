import { games, type GameId, type GameInfo } from './bookingStaticData'

export type AchievementTier = 'none' | 'bronze' | 'silver' | 'gold' | 'mastered'
export type AchievementState = 'locked' | 'unlocked' | 'mastered' | 'secret'

type AchievementSessionParticipant = {
  checked_in?: boolean | null
  profile_id?: string | null
  score?: number | string | null
}

export type AchievementSession = {
  confirmed_game_id?: GameId | string | null
  date?: string | null
  game_options?: Array<GameId | string> | null
  session_participants?: AchievementSessionParticipant[] | null
  status?: string | null
}

export type GameAchievement = {
  bestScore: number | null
  game: GameInfo
  nextRequirement: number | null
  playedCount: number
  progressPercent: number
  state: AchievementState
  tier: AchievementTier
  title: string
}

export type AchievementProgressPoint = {
  label: string
  value: number
}

export type AchievementSummary = {
  achievementsUnlocked: number
  gamesTried: number
  masteredCount: number
  sessionsPlayed: number
  totalGames: number
}

const levelRequirements = {
  bronze: 1,
  silver: 3,
  gold: 5,
  mastered: 10,
} as const

function isKnownGameId(gameId: string | null | undefined): gameId is GameId {
  return games.some((game) => game.id === gameId)
}

function participantForSession(session: AchievementSession, profileId: string | null | undefined) {
  if (!profileId) return null
  return (session.session_participants ?? []).find((participant) => participant.profile_id === profileId) ?? null
}

function playedGameIds(session: AchievementSession): GameId[] {
  if (isKnownGameId(session.confirmed_game_id)) return [session.confirmed_game_id]

  const ids = new Set<GameId>()
  ;(session.game_options ?? []).forEach((gameId) => {
    if (isKnownGameId(gameId)) ids.add(gameId)
  })
  return Array.from(ids)
}

function numericScore(value: number | string | null | undefined) {
  const score = Number(value)
  return Number.isFinite(score) ? score : null
}

function tierForCount(count: number): AchievementTier {
  if (count >= levelRequirements.mastered) return 'mastered'
  if (count >= levelRequirements.gold) return 'gold'
  if (count >= levelRequirements.silver) return 'silver'
  if (count >= levelRequirements.bronze) return 'bronze'
  return 'none'
}

function nextRequirementForTier(tier: AchievementTier) {
  if (tier === 'none') return levelRequirements.bronze
  if (tier === 'bronze') return levelRequirements.silver
  if (tier === 'silver') return levelRequirements.gold
  if (tier === 'gold') return levelRequirements.mastered
  return null
}

function achievementTitle(game: GameInfo, tier: AchievementTier) {
  if (tier === 'mastered') return `${game.title} Master`
  if (tier === 'gold') return `${game.title} Gold`
  if (tier === 'silver') return `${game.title} Silver`
  if (tier === 'bronze') return `${game.title} Rookie`
  return `${game.title} Initiate`
}

export function completedAchievementSessions(sessions: AchievementSession[], profileId: string | null | undefined) {
  return sessions.filter((session) => {
    const participant = participantForSession(session, profileId)
    return Boolean(participant?.checked_in)
  })
}

export function buildGameAchievements(sessions: AchievementSession[], profileId: string | null | undefined): GameAchievement[] {
  const completedSessions = completedAchievementSessions(sessions, profileId)
  const counts = new Map<GameId, number>()
  const bestScores = new Map<GameId, number>()

  completedSessions.forEach((session) => {
    const participant = participantForSession(session, profileId)
    const score = numericScore(participant?.score)

    playedGameIds(session).forEach((gameId) => {
      counts.set(gameId, (counts.get(gameId) ?? 0) + 1)
      if (score !== null) {
        const previous = bestScores.get(gameId)
        if (previous === undefined || score > previous) bestScores.set(gameId, score)
      }
    })
  })

  return games.map((game) => {
    const playedCount = counts.get(game.id) ?? 0
    const tier = tierForCount(playedCount)
    const nextRequirement = nextRequirementForTier(tier)
    const state: AchievementState = tier === 'mastered' ? 'mastered' : tier === 'none' ? 'locked' : 'unlocked'
    const progressTarget = nextRequirement ?? levelRequirements.mastered
    const progressPercent = Math.min(100, Math.round((playedCount / progressTarget) * 100))

    return {
      bestScore: bestScores.get(game.id) ?? null,
      game,
      nextRequirement,
      playedCount,
      progressPercent,
      state,
      tier,
      title: achievementTitle(game, tier),
    }
  })
}

export function achievementSummary(achievements: GameAchievement[], sessionsPlayed: number): AchievementSummary {
  return {
    achievementsUnlocked: achievements.filter((achievement) => achievement.state !== 'locked').length,
    gamesTried: achievements.filter((achievement) => achievement.playedCount > 0).length,
    masteredCount: achievements.filter((achievement) => achievement.state === 'mastered').length,
    sessionsPlayed,
    totalGames: achievements.length,
  }
}

export function profileLevelProgress(playerStats: { gamesJoined?: number | null; totalScore?: number | null; wins?: number | null }) {
  const scoreXp = Math.max(0, Math.floor(Number(playerStats.totalScore ?? 0) || 0))
  const gameXp = Math.max(0, Math.floor(Number(playerStats.gamesJoined ?? 0) || 0)) * 120
  const winXp = Math.max(0, Math.floor(Number(playerStats.wins ?? 0) || 0)) * 240
  const xp = scoreXp + gameXp + winXp
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 180)) + 1)
  const currentLevelXp = Math.pow(level - 1, 2) * 180
  const nextLevelXp = Math.pow(level, 2) * 180
  const progressToNext = nextLevelXp > currentLevelXp
    ? Math.round(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100)
    : 100

  return {
    level,
    nextLevelXp,
    progressToNext: Math.max(0, Math.min(100, progressToNext)),
    rankLabel: level >= 20 ? 'VR Master' : level >= 12 ? 'Arena Ace' : level >= 6 ? 'Rising Player' : 'Rookie',
    xp,
  }
}

export function sessionsByRecentWeek(sessions: AchievementSession[], profileId: string | null | undefined, locale: string): AchievementProgressPoint[] {
  const completedSessions = completedAchievementSessions(sessions, profileId)
  const weekStarts: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOffset = (today.getDay() + 6) % 7
  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(today.getDate() - dayOffset)

  for (let index = 5; index >= 0; index -= 1) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(currentWeekStart.getDate() - index * 7)
    weekStarts.push(weekStart)
  }

  return weekStarts.map((weekStart) => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    const value = completedSessions.filter((session) => {
      if (!session.date) return false
      const date = new Date(`${session.date}T00:00:00`)
      return date >= weekStart && date < weekEnd
    }).length

    return {
      label: weekStart.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      value,
    }
  })
}
