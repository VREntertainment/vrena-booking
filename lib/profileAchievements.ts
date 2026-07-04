import { games, type GameId, type GameInfo } from './bookingStaticData'

export type AchievementTier = 'none' | 'bronze' | 'silver' | 'gold' | 'mastered'
export type AchievementState = 'locked' | 'unlocked' | 'mastered' | 'secret'
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'

type AchievementSessionParticipant = {
  accuracy_percent?: number | string | null
  checked_in?: boolean | null
  escape_duration_seconds?: number | string | null
  placement?: number | string | null
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
  ticket_type?: string | null
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
  retentionUnlocked: number
  sessionsPlayed: number
  totalUnlocked: number
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

export type ClosestAchievement = {
  current: number
  id: string
  progressPercent: number
  target: number
  title: string
  type: 'game' | 'retention'
}

export type RecentAchievement = {
  id: string
  kind: 'game' | 'retention'
  title: string
  unlockedAt: string | null
}

export type AchievementSpotlight = {
  current: number
  description: string
  id: string
  progressPercent: number
  target: number
  title: string
}

export type AchievementMilestoneReward = {
  current: number
  description: string
  id: string
  target: number
  title: string
  unlocked: boolean
}

export type RetentionAchievementProfile = {
  anonymous_mode?: boolean | null
  birthday?: string | null
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

function numericValue(value: number | string | null | undefined) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
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

function checkedInParticipants(session: AchievementSession) {
  return (session.session_participants ?? []).filter((participant) => participant.checked_in)
}

function checkedInParticipantCount(session: AchievementSession) {
  return checkedInParticipants(session).length
}

function checkedInOtherParticipants(session: AchievementSession, profileId: string | null | undefined) {
  return checkedInParticipants(session).filter((participant) => participant.profile_id && participant.profile_id !== profileId)
}

function playerCreatedSession(session: AchievementSession, profileId: string | null | undefined) {
  return Boolean(profileId && session.owner_id === profileId)
}

function maxSessionsInSingleDay(sessions: AchievementSession[]) {
  const byDate = new Map<string, number>()
  sessions.forEach((session) => {
    if (!session.date) return
    byDate.set(session.date, (byDate.get(session.date) ?? 0) + 1)
  })
  return Math.max(0, ...Array.from(byDate.values()))
}

function maxRepeatedCoplayerCount(sessions: AchievementSession[], profileId: string | null | undefined) {
  const counts = new Map<string, number>()
  sessions.forEach((session) => {
    checkedInOtherParticipants(session, profileId).forEach((participant) => {
      if (!participant.profile_id) return
      counts.set(participant.profile_id, (counts.get(participant.profile_id) ?? 0) + 1)
    })
  })
  return Math.max(0, ...Array.from(counts.values()))
}

function hasPlayerTopScore(session: AchievementSession, profileId: string | null | undefined) {
  const player = participantForSession(session, profileId)
  const playerScore = numericScore(player?.score)
  if (playerScore === null) return false

  const scores = checkedInParticipants(session)
    .map((participant) => numericScore(participant.score))
    .filter((score): score is number => score !== null)
  if (scores.length < 2) return false

  return playerScore === Math.max(...scores)
}

function hasTopTenPercentPlacement(session: AchievementSession, profileId: string | null | undefined) {
  const player = participantForSession(session, profileId)
  const placement = numericValue(player?.placement)
  if (placement === null || placement < 1) return false

  const checkedInCount = checkedInParticipantCount(session)
  if (checkedInCount < 2) return false

  return placement <= Math.max(1, Math.ceil(checkedInCount * 0.1))
}

function hasAccuracyUpgrade(sessions: AchievementSession[], profileId: string | null | undefined) {
  const accuracyValues = sessions
    .map((session) => ({
      date: sessionDateValue(session)?.getTime() ?? 0,
      value: numericValue(participantForSession(session, profileId)?.accuracy_percent),
    }))
    .filter((item): item is { date: number; value: number } => item.value !== null)
    .sort((a, b) => a.date - b.date)

  let total = 0
  for (let index = 0; index < accuracyValues.length; index += 1) {
    if (index > 0 && accuracyValues[index].value > total / index) return true
    total += accuracyValues[index].value
  }

  return false
}

function hasScoreImprovement(sessions: AchievementSession[], profileId: string | null | undefined) {
  const scores = sessions
    .map((session) => ({
      date: sessionDateValue(session)?.getTime() ?? 0,
      value: numericScore(participantForSession(session, profileId)?.score),
    }))
    .filter((item): item is { date: number; value: number } => item.value !== null)
    .sort((a, b) => a.date - b.date)

  let best = Number.NEGATIVE_INFINITY
  for (const score of scores) {
    if (best !== Number.NEGATIVE_INFINITY && score.value > best) return true
    best = Math.max(best, score.value)
  }

  return false
}

function hasEscapeBreakthrough(sessions: AchievementSession[], profileId: string | null | undefined) {
  const durations = sessions
    .map((session) => ({
      date: sessionDateValue(session)?.getTime() ?? 0,
      value: numericValue(participantForSession(session, profileId)?.escape_duration_seconds),
    }))
    .filter((item): item is { date: number; value: number } => item.value !== null && item.value > 0)
    .sort((a, b) => a.date - b.date)

  let best = Number.POSITIVE_INFINITY
  for (const duration of durations) {
    if (best !== Number.POSITIVE_INFINITY && duration.value < best) return true
    best = Math.min(best, duration.value)
  }

  return false
}

function birthdayMonth(birthday: string | null | undefined) {
  if (!birthday) return null
  const match = birthday.match(/^\d{4}-(\d{2})-\d{2}$/)
  return match ? Number(match[1]) : null
}

function sessionMonth(session: AchievementSession) {
  if (!session.date) return null
  const match = session.date.match(/^\d{4}-(\d{2})-\d{2}$/)
  return match ? Number(match[1]) : null
}

function isOffPeakSession(session: AchievementSession) {
  if (!session.start_time) return false
  const [hoursText] = session.start_time.split(':')
  const hours = Number(hoursText)
  if (!Number.isFinite(hours)) return false
  const date = sessionDateValue(session)
  const day = date?.getDay()
  const isWeekday = day !== 0 && day !== 6
  return isWeekday && (hours < 14 || hours >= 21)
}

function retentionState(current: number, target: number): AchievementState {
  return current >= target ? 'unlocked' : 'locked'
}

function progress(current: number, target: number) {
  if (target <= 0) return 100
  return Math.min(100, Math.round((current / target) * 100))
}

function latestSessionDate(sessions: AchievementSession[]) {
  const latest = sessions
    .map(sessionDateValue)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return latest ? latest.toISOString().slice(0, 10) : null
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

export function buildRetentionAchievements(
  sessions: AchievementSession[],
  profileId: string | null | undefined,
  profile?: RetentionAchievementProfile | null,
): RetentionAchievement[] {
  const completedSessions = completedAchievementSessions(sessions, profileId)
  const gameCounts = new Map<GameId, number>()
  let fpsGamesTried = 0
  let escapeGamesTried = 0
  let scoredSessions = 0
  let accuracySessions = 0
  let escapeDurationSessions = 0

  completedSessions.forEach((session) => {
    const participant = participantForSession(session, profileId)
    if (numericScore(participant?.score) !== null) scoredSessions += 1
    if (numericValue(participant?.accuracy_percent) !== null) accuracySessions += 1
    if (numericValue(participant?.escape_duration_seconds) !== null) escapeDurationSessions += 1

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
  const squadStarterCount = completedSessions.filter((session) => playerCreatedSession(session, profileId) && checkedInParticipantCount(session) >= 3).length
  const bringCrewCount = completedSessions.filter((session) => playerCreatedSession(session, profileId) && checkedInOtherParticipants(session, profileId).length >= 3).length
  const friendlyRivalryCount = maxRepeatedCoplayerCount(completedSessions, profileId)
  const clutchCount = completedSessions.filter((session) => numericValue(participantForSession(session, profileId)?.placement) === 1 || hasPlayerTopScore(session, profileId)).length
  const topTenCount = completedSessions.filter((session) => hasTopTenPercentPlacement(session, profileId)).length
  const birthdayHeroCount = completedSessions.filter((session) => {
    const month = birthdayMonth(profile?.birthday)
    return Boolean(month && sessionMonth(session) === month)
  }).length
  const teamBuilderCount = completedSessions.filter((session) => session.booking_type === 'ticket' && session.ticket_type === 'corporate').length
  const offPeakCount = completedSessions.filter(isOffPeakSession).length
  const doubleSessionCount = maxSessionsInSingleDay(completedSessions)
  const maskModeCount = profile?.anonymous_mode && completedSessions.length > 0 ? 1 : 0

  return [
    retentionAchievement('first-blood', 'First Blood', 'Complete your first checked-in session.', 'special', completedSessions.length, 1),
    retentionAchievement('weekly-warrior', 'Weekly Warrior', 'Play one checked-in session this week.', 'comeback', currentWeekPlayCount(completedSessions), 1),
    retentionAchievement('streak-builder', 'Streak Builder', 'Play in two consecutive weeks.', 'comeback', longestWeeklyStreak(completedSessions), 2),
    retentionAchievement('arena-regular', 'Arena Regular', 'Play in four consecutive weeks.', 'comeback', longestWeeklyStreak(completedSessions), 4),
    retentionAchievement('back-for-more', 'Back for More', 'Return after a break of 30 days or more.', 'comeback', maxGapDaysBetweenSessions(completedSessions), 30),
    retentionAchievement('perfect-rotation', 'Perfect Rotation', 'Try every VRena game at least once.', 'explore', gamesTried, games.length),
    retentionAchievement('genre-explorer', 'Genre Explorer', 'Play at least one FPS/PVP game and one Escape game.', 'explore', Math.min(2, (fpsGamesTried > 0 ? 1 : 0) + (escapeGamesTried > 0 ? 1 : 0)), 2),
    retentionAchievement('specialist', 'Specialist', 'Play the same game ten times.', 'explore', maxGameCount, 10),
    retentionAchievement('completionist', 'Completionist', 'Unlock Bronze on every game.', 'explore', bronzeGameCount, games.length),
    retentionAchievement('squad-starter', 'Squad Starter', 'Create a session with at least three checked-in players.', 'social', squadStarterCount, 1),
    retentionAchievement('challenge-accepted', 'Challenge Accepted', 'Complete a challenge session.', 'social', challengeSessionCount, 1),
    retentionAchievement('friendly-rivalry', 'Friendly Rivalry', 'Play with the same player three times.', 'social', friendlyRivalryCount, 3),
    retentionAchievement('club-loyalist', 'Club Loyalist', 'Play three checked-in club sessions.', 'social', clubSessionCount, 3),
    retentionAchievement('bring-the-crew', 'Bring the Crew', 'Create a session where three other players check in.', 'social', bringCrewCount, 1),
    retentionAchievement('personal-best', 'Personal Best', 'Beat your previous recorded score.', 'performance', hasScoreImprovement(completedSessions, profileId) ? 2 : Math.min(scoredSessions, 1), 2),
    retentionAchievement('clutch-player', 'Clutch Player', 'Finish first or top-score a checked-in session.', 'performance', clutchCount, 1),
    retentionAchievement('accuracy-upgrade', 'Accuracy Upgrade', 'Improve one recorded accuracy result above your previous average.', 'performance', hasAccuracyUpgrade(completedSessions, profileId) ? 2 : Math.min(accuracySessions, 1), 2),
    retentionAchievement('escape-breakthrough', 'Escape Breakthrough', 'Beat your previous recorded Escape completion time.', 'performance', hasEscapeBreakthrough(completedSessions, profileId) ? 2 : Math.min(escapeDurationSessions, 1), 2),
    retentionAchievement('top-ten-moment', 'Top 10% Moment', 'Place in the top 10% of a checked-in scored session.', 'performance', topTenCount, 1),
    retentionAchievement('birthday-hero', 'Birthday Hero', 'Play during your birthday month.', 'special', birthdayHeroCount, 1),
    retentionAchievement('team-builder', 'Team Builder', 'Join a checked-in corporate/event session.', 'social', teamBuilderCount, 1),
    retentionAchievement('off-peak-explorer', 'Off-Peak Explorer', 'Play during quieter weekday hours.', 'special', offPeakCount, 1),
    retentionAchievement('double-session-day', 'Double Session Day', 'Complete two checked-in sessions in one day.', 'comeback', doubleSessionCount, 2),
    retentionAchievement('weekend-raider', 'Weekend Raider', 'Play on a Saturday or Sunday.', 'special', weekendSessionCount, 1),
    retentionAchievement('night-owl', 'Night Owl', 'Play an evening session.', 'special', nightSessionCount, 1),
    retentionAchievement('secret-hunter', 'Secret Hunter', 'Reveal the hidden profile achievement by trying three different games.', 'special', gamesTried, 3),
    retentionAchievement('mask-mode', 'Mask Mode', 'Complete a session with anonymous mode enabled.', 'special', maskModeCount, 1),
  ]
}

export function achievementSummary(
  achievements: GameAchievement[],
  sessionsPlayed: number,
  retentionAchievements: RetentionAchievement[] = [],
): AchievementSummary {
  const achievementsUnlocked = achievements.filter((achievement) => achievement.state !== 'locked').length
  const retentionUnlocked = retentionAchievements.filter((achievement) => achievement.state !== 'locked').length

  return {
    achievementsUnlocked,
    gamesTried: achievements.filter((achievement) => achievement.playedCount > 0).length,
    masteredCount: achievements.filter((achievement) => achievement.state === 'mastered').length,
    retentionUnlocked,
    sessionsPlayed,
    totalUnlocked: achievementsUnlocked + retentionUnlocked,
    totalGames: achievements.length,
  }
}

export function achievementRarityForGame(achievement: Pick<GameAchievement, 'tier' | 'nextRequirement'>): AchievementRarity {
  if (achievement.tier === 'mastered') return 'legendary'
  if (achievement.tier === 'gold' || achievement.nextRequirement === levelRequirements.mastered) return 'epic'
  if (achievement.tier === 'silver' || achievement.nextRequirement === levelRequirements.gold) return 'rare'
  return 'common'
}

export function achievementRarityForRetention(achievement: Pick<RetentionAchievement, 'target' | 'category'>): AchievementRarity {
  if (achievement.target >= 10 || achievement.category === 'performance') return 'legendary'
  if (achievement.target >= 4 || achievement.category === 'explore') return 'epic'
  if (achievement.target >= 2 || achievement.category === 'social') return 'rare'
  return 'common'
}

export function closestAchievement(
  achievements: GameAchievement[],
  retentionAchievements: RetentionAchievement[],
): ClosestAchievement | null {
  const gameCandidates: ClosestAchievement[] = achievements
    .filter((achievement) => achievement.state !== 'mastered')
    .map((achievement) => ({
      current: achievement.playedCount,
      id: achievement.game.id,
      progressPercent: achievement.progressPercent,
      target: achievement.nextRequirement ?? levelRequirements.mastered,
      title: achievement.game.title,
      type: 'game',
    }))

  const retentionCandidates: ClosestAchievement[] = retentionAchievements
    .filter((achievement) => achievement.state === 'locked')
    .map((achievement) => ({
      current: achievement.current,
      id: achievement.id,
      progressPercent: achievement.progressPercent,
      target: achievement.target,
      title: achievement.title,
      type: 'retention',
    }))

  return [...gameCandidates, ...retentionCandidates]
    .sort((a, b) => {
      if (b.progressPercent !== a.progressPercent) return b.progressPercent - a.progressPercent
      return (a.target - a.current) - (b.target - b.current)
    })[0] ?? null
}

export function weeklyAchievementSpotlight(
  sessions: AchievementSession[],
  profileId: string | null | undefined,
  retentionAchievements: RetentionAchievement[],
): AchievementSpotlight {
  const weekly = retentionAchievements.find((achievement) => achievement.id === 'weekly-warrior')
  if (weekly) {
    return {
      current: weekly.current,
      description: weekly.description,
      id: weekly.id,
      progressPercent: weekly.progressPercent,
      target: weekly.target,
      title: weekly.title,
    }
  }

  const completedSessions = completedAchievementSessions(sessions, profileId)
  const current = currentWeekPlayCount(completedSessions)
  return {
    current,
    description: 'Play one checked-in session this week.',
    id: 'weekly-warrior',
    progressPercent: progress(current, 1),
    target: 1,
    title: 'Weekly Warrior',
  }
}

export function recentUnlockedAchievements(
  sessions: AchievementSession[],
  profileId: string | null | undefined,
  achievements: GameAchievement[],
  retentionAchievements: RetentionAchievement[],
): RecentAchievement[] {
  const completedSessions = completedAchievementSessions(sessions, profileId)
  const byGame = new Map<GameId, AchievementSession[]>()

  completedSessions.forEach((session) => {
    playedGameIds(session).forEach((gameId) => {
      byGame.set(gameId, [...(byGame.get(gameId) ?? []), session])
    })
  })

  const gameItems = achievements
    .filter((achievement) => achievement.state !== 'locked')
    .map((achievement) => ({
      id: achievement.game.id,
      kind: 'game' as const,
      title: achievement.title,
      unlockedAt: latestSessionDate(byGame.get(achievement.game.id) ?? []),
    }))

  const latestOverall = latestSessionDate(completedSessions)
  const retentionItems = retentionAchievements
    .filter((achievement) => achievement.state !== 'locked')
    .map((achievement) => ({
      id: achievement.id,
      kind: 'retention' as const,
      title: achievement.title,
      unlockedAt: latestOverall,
    }))

  return [...gameItems, ...retentionItems]
    .filter((item) => Boolean(item.unlockedAt))
    .sort((a, b) => String(b.unlockedAt).localeCompare(String(a.unlockedAt)))
    .slice(0, 4)
}

export function achievementMilestoneRewards(summary: AchievementSummary): AchievementMilestoneReward[] {
  return [
    {
      current: summary.sessionsPlayed,
      description: 'A profile frame for showing up.',
      id: 'rookie-frame',
      target: 1,
      title: 'Rookie Frame',
      unlocked: summary.sessionsPlayed >= 1,
    },
    {
      current: summary.totalUnlocked,
      description: 'A warm badge glow for your deck.',
      id: 'arena-glow',
      target: 5,
      title: 'Arena Glow',
      unlocked: summary.totalUnlocked >= 5,
    },
    {
      current: summary.retentionUnlocked,
      description: 'A Trickster title for unusual patterns.',
      id: 'trickster-title',
      target: 3,
      title: 'Trickster Title',
      unlocked: summary.retentionUnlocked >= 3,
    },
    {
      current: summary.masteredCount,
      description: 'A crown treatment for mastered games.',
      id: 'master-crown',
      target: 1,
      title: 'Master Crown',
      unlocked: summary.masteredCount >= 1,
    },
  ]
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
