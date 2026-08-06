import type { AchievementSession } from './profileAchievements'

type DatedSession = Pick<AchievementSession, 'date'>

export type PlayerReturnMission = {
  activeWeeks: number
  currentWeekVisits: number
  graceAvailable: boolean
  graceUsed: boolean
  latestSession: AchievementSession | null
  targetWeeks: 2 | 4
}

function sessionDate(session: DatedSession) {
  if (!session.date) return null
  const value = new Date(`${session.date}T12:00:00`)
  return Number.isNaN(value.getTime()) ? null : value
}

export function returnMissionWeekKey(date: Date) {
  const weekStart = new Date(date)
  weekStart.setHours(12, 0, 0, 0)
  const dayOffset = (weekStart.getDay() + 6) % 7
  weekStart.setDate(weekStart.getDate() - dayOffset)
  return weekStart.toISOString().slice(0, 10)
}

function vrenaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0)
  return {
    day: value('day'),
    hour: value('hour'),
    month: value('month'),
    year: value('year'),
  }
}

export function nextVrenaWeekendReminderAt(now = new Date()) {
  const local = vrenaDateParts(now)
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day))
  const dayOfWeek = localDate.getUTCDay()
  let daysUntilSaturday = (6 - dayOfWeek + 7) % 7
  if (daysUntilSaturday === 0 && local.hour >= 10) daysUntilSaturday = 7

  return new Date(Date.UTC(
    local.year,
    local.month - 1,
    local.day + daysUntilSaturday,
    3,
    0,
    0,
    0,
  ))
}

export function returnReminderDateKey(date: Date) {
  const local = vrenaDateParts(date)
  return `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`
}

function weeksBetween(previousWeekKey: string, nextWeekKey: string) {
  const previous = new Date(`${previousWeekKey}T12:00:00`).getTime()
  const next = new Date(`${nextWeekKey}T12:00:00`).getTime()
  return Math.round((next - previous) / (7 * 24 * 60 * 60 * 1000))
}

function uniqueWeekKeys(sessions: DatedSession[]) {
  return Array.from(new Set(sessions
    .map(sessionDate)
    .filter((date): date is Date => Boolean(date))
    .map(returnMissionWeekKey)))
    .sort()
}

export function longestWeeklyRunWithGrace(sessions: DatedSession[]) {
  const weekKeys = uniqueWeekKeys(sessions)
  if (weekKeys.length === 0) return 0

  let longest = 1
  let runStart = 0
  let graceGapIndex = -1

  for (let index = 1; index < weekKeys.length; index += 1) {
    const gap = weeksBetween(weekKeys[index - 1], weekKeys[index])

    if (gap === 1) {
      longest = Math.max(longest, index - runStart + 1)
      continue
    }

    if (gap === 2) {
      if (graceGapIndex >= runStart) runStart = graceGapIndex + 1
      graceGapIndex = index - 1
      longest = Math.max(longest, index - runStart + 1)
      continue
    }

    runStart = index
    graceGapIndex = -1
  }

  return longest
}

export function buildPlayerReturnMission(
  completedSessions: AchievementSession[],
  today = new Date(),
): PlayerReturnMission {
  const sortedSessions = completedSessions
    .filter((session) => sessionDate(session))
    .slice()
    .sort((left, right) => `${right.date ?? ''} ${right.start_time ?? ''}`.localeCompare(`${left.date ?? ''} ${left.start_time ?? ''}`))
  const latestSession = sortedSessions[0] ?? null
  const currentWeekKey = returnMissionWeekKey(today)
  const weekKeys = uniqueWeekKeys(sortedSessions)
  const currentWeekVisits = sortedSessions.filter((session) => {
    const date = sessionDate(session)
    return Boolean(date && returnMissionWeekKey(date) === currentWeekKey)
  }).length

  if (weekKeys.length === 0) {
    return {
      activeWeeks: 0,
      currentWeekVisits: 0,
      graceAvailable: true,
      graceUsed: false,
      latestSession: null,
      targetWeeks: 2,
    }
  }

  const latestWeekKey = weekKeys[weekKeys.length - 1]
  const gapToCurrentWeek = weeksBetween(latestWeekKey, currentWeekKey)
  if (gapToCurrentWeek > 2) {
    return {
      activeWeeks: 0,
      currentWeekVisits,
      graceAvailable: true,
      graceUsed: false,
      latestSession,
      targetWeeks: 2,
    }
  }

  let activeWeeks = 1
  let graceUsed = gapToCurrentWeek === 2
  for (let index = weekKeys.length - 1; index > 0; index -= 1) {
    const gap = weeksBetween(weekKeys[index - 1], weekKeys[index])
    if (gap === 1) {
      activeWeeks += 1
      continue
    }
    if (gap === 2 && !graceUsed) {
      activeWeeks += 1
      graceUsed = true
      continue
    }
    break
  }

  return {
    activeWeeks,
    currentWeekVisits,
    graceAvailable: !graceUsed,
    graceUsed,
    latestSession,
    targetWeeks: activeWeeks < 2 ? 2 : 4,
  }
}
