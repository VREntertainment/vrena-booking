import { games, type GameId, type GameInfo } from './bookingStaticData'

export type AchievementTier = 'none' | 'bronze' | 'silver' | 'gold' | 'mastered'
export type AchievementState = 'locked' | 'unlocked' | 'mastered' | 'secret'

type AchievementSessionParticipant = {
  checked_in?: boolean | null
  profile_id?: string | null
  score?: number | string | null
}

export type AchievementSession = {
  booking_type?: string | null
  challenge_status?: string | null
  challenge_target_id?: string | null
  club_id?: string | null
  confirmed_game_id?: GameId | string | null
  date?: string | null
  game_options?: Array<GameId | string> | null
  owner_id?: string | null
  session_participants?: AchievementSessionParticipant[] | null
  start_time?: string | null
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

export type RetentionAchievement = {
  category: 'comeback' | 'explore' | 'social' | 'performance' | 'special'
  current: number
  description: string
  id: string
  progressPercent: number
  state: AchievementState
  target: number
  title: string
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

function sessionDateValue(session: AchievementSession) {
  if (!session.date) return null
  const date = new Date(`${session.date}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function weekKey(date: Date) {
  const weekStart = new Date(date)
  weekStart.setHours(0, 0, 0, 0)
  const dayOffset = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - dayOffset)
  return weekStart.toISOString().slice(0, 10)
}

function weeksBetween(previousWeekKey: string, nextWeekKey: string) {
  const previous = new Date(`${previousWeekKey}T00:00:00`).getTime()
  const next = new Date(`${nextWeekKey}T00:00:00`).getTime()
  return Math.round((next - previous) / (7 * 24 * 60 * 60 * 1000))
}

function longestWeeklyStreak(sessions: AchievementSession[]) {
  const weekKeys = Array.from(new Set(sessions
    .map(sessionDateValue)
    .filter((date): date is Date => Boolean(date))
    .map(weekKey)))
    .sort()

  if (weekKeys.length === 0) return 0

  let longest = 1
  let current = 1

  for (let index = 1; index < weekKeys.length; index += 1) {
    if (weeksBetween(weekKeys[index - 1], weekKeys[index]) === 1) {
      current += 1
    } else {
      current = 1
    }
    longest = Math.max(longest, current)
  }

  return longest
}

function maxGapDaysBetweenSessions(sessions: AchievementSession[]) {
  const dates = sessions
    .map(sessionDateValue)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())

  let maxGap = 0
  for (let index = 1; index < dates.length; index += 1) {
    const gapDays = Math.floor((dates[index].getTime() - dates[index - 1].getTime()) / (24 * 60 * 60 * 1000))
    maxGap = Math.max(maxGap, gapDays)
  }
  return maxGap
}

function currentWeekPlayCount(sessions: AchievementSession[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentWeekKey = weekKey(today)
  return sessions.filter((session) => {
    const date = sessionDateValue(session)
    return date && weekKey(date) === currentWeekKey
  }).length
}

function sessionStartsAtOrAfter(session: AchievementSession, hour: number) {
  if (!session.start_time) return false
  const [hours] = session.start_time.split(':')
  return Number(hours) >= hour
}

function isWeekendSession(session: AchievementSession) {
  const date = sessionDateValue(session)
  if (!date) return false
  const day = date.getDay()
  return day === 0 || day === 6
}

function isChallengeAchievementSession(session: AchievementSession) {
  return Boolean(session.challenge_target_id || session.challenge_status || session.booking_type === 'challenge')
}

function retentionState(current: number, target: number): AchievementState {
  return current >= target ? 'unlocked' : 'locked'
}

function progress(current: number, target: number) {
  if (target <= 0) return 100
  return Math.min(100, Math.round((current / target) * 100))
}

function retentionAchievement(
  id: string,
  title: string,
  description: string,
  category: RetentionAchievement['category'],
  current: number,
  target: number,
): RetentionAchievement {
  const cappedCurrent = Math.max(0, current)
  return {
    category,
    current: Math.min(cappedCurrent, target),
    description,
    id,
    progressPercent: progress(cappedCurrent, target),
    state: retentionState(cappedCurrent, target),
    target,
    title,
  }
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

export function buildRetentionAchievements(sessions: AchievementSession[], profileId: string | null | undefined): RetentionAchievement[] {
  const completedSessions = completedAchievementSessions(sessions, profileId)
  const gameCounts = new Map<GameId, number>()
  let fpsGamesTried = 0
  let escapeGamesTried = 0
  let scoredSessions = 0

  completedSessions.forEach((session) => {
    const participant = participantForSession(session, profileId)
    if (numericScore(participant?.score) !== null) scoredSessions += 1

    playedGameIds(session).forEach((gameId) => {
      gameCounts.set(gameId, (gameCounts.get(gameId) ?? 0) + 1)
    })
  })

  gameCounts.forEach((count, gameId) => {
    if (count <= 0) return
    const game = games.find((item) => item.id === gameId)
    if (game?.category === 'Escape') {
      escapeGamesTried += 1
    } else if (game?.category === 'FPS / PVP') {
      fpsGamesTried += 1
    }
  })

  const gamesTried = gameCounts.size
  const maxGameCount = Math.max(0, ...Array.from(gameCounts.values()))
  const bronzeGameCount = games.filter((game) => (gameCounts.get(game.id) ?? 0) >= 1).length
  const clubSessionCount = completedSessions.filter((session) => Boolean(session.club_id)).length
  const challengeSessionCount = completedSessions.filter(isChallengeAchievementSession).length
  const weekendSessionCount = completedSessions.filter(isWeekendSession).length
  const nightSessionCount = completedSessions.filter((session) => sessionStartsAtOrAfter(session, 18)).length

  return [
    retentionAchievement('weekly-warrior', 'Weekly Warrior', 'Play one checked-in session this week.', 'comeback', currentWeekPlayCount(completedSessions), 1),
    retentionAchievement('streak-builder', 'Streak Builder', 'Play in two consecutive weeks.', 'comeback', longestWeeklyStreak(completedSessions), 2),
    retentionAchievement('arena-regular', 'Arena Regular', 'Play in four consecutive weeks.', 'comeback', longestWeeklyStreak(completedSessions), 4),
    retentionAchievement('back-for-more', 'Back for More', 'Return after a break of 30 days or more.', 'comeback', maxGapDaysBetweenSessions(completedSessions), 30),
    retentionAchievement('perfect-rotation', 'Perfect Rotation', 'Try every VRena game at least once.', 'explore', gamesTried, games.length),
    retentionAchievement('genre-explorer', 'Genre Explorer', 'Play at least one FPS/PVP game and one Escape game.', 'explore', Math.min(2, (fpsGamesTried > 0 ? 1 : 0) + (escapeGamesTried > 0 ? 1 : 0)), 2),
    retentionAchievement('specialist', 'Specialist', 'Play the same game ten times.', 'explore', maxGameCount, 10),
    retentionAchievement('completionist', 'Completionist', 'Unlock Bronze on every game.', 'explore', bronzeGameCount, games.length),
    retentionAchievement('challenge-accepted', 'Challenge Accepted', 'Complete a challenge session.', 'social', challengeSessionCount, 1),
    retentionAchievement('club-loyalist', 'Club Loyalist', 'Play three checked-in club sessions.', 'social', clubSessionCount, 3),
    retentionAchievement('personal-best', 'Personal Best', 'Record scores in three sessions so improvement tracking can begin.', 'performance', scoredSessions, 3),
    retentionAchievement('weekend-raider', 'Weekend Raider', 'Play on a Saturday or Sunday.', 'special', weekendSessionCount, 1),
    retentionAchievement('night-owl', 'Night Owl', 'Play an evening session.', 'special', nightSessionCount, 1),
  ]
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
