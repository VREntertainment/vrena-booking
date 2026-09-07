import type { BlockedTime, Session } from '../bookingWidgetDomain'

export const ARENA_COUNT = 2

export const OPEN_MINUTES = 9 * 60

export const CLOSE_MINUTES = 22 * 60

export const TIME_STEP_MINUTES = 20

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function arenasUsedBySession(session: Pick<Session, 'max_players' | 'arena_count'>) {
  return session.arena_count || (session.max_players > 7 ? 2 : 1)
}

export const CAFE_SOFT_OPENING_DATE = '2026-08-31'
const CAFE_OPEN_MINUTES = 16 * 60
const CAFE_CLOSE_MINUTES = 22 * 60

export type BookingTimeOption = { value: string; label: string; remaining: number }

/** Pure availability calculation. The caller supplies the clock for deterministic checks. */
export function availableSessionTimes({ date, duration, arenaCount, excludeSessionId = '', sessions, blockedTimes, text, now = new Date() }: {
  date: string
  duration: number
  arenaCount: number
  excludeSessionId?: string
  sessions: Array<Pick<Session, 'id' | 'status' | 'date' | 'venue_key' | 'start_time' | 'duration_minutes' | 'arena_count' | 'max_players'>>
  blockedTimes: Array<Pick<BlockedTime, 'date' | 'start_time' | 'end_time' | 'arenas_used'>>
  text: { arenaAvailable: string; arenasAvailable: string }
  now?: Date
}): BookingTimeOption[] {
  if (!date) return []

  const today = localDateString(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const options: Array<{ value: string; label: string; remaining: number }> = []
  const latestStart = CLOSE_MINUTES - duration

  for (let start = OPEN_MINUTES; start <= latestStart; start += TIME_STEP_MINUTES) {
    const end = start + duration

    if (date === today && start <= nowMinutes) continue

    const activeSessionArenas = sessions
      .filter((session) => (
        session.status === 'open'
        && session.date === date
        && session.id !== excludeSessionId
        && (session.venue_key || 'ha-do-centrosa') === 'ha-do-centrosa'
      ))
      .filter((session) =>
        rangesOverlap(
          start,
          end,
          timeToMinutes(session.start_time),
          timeToMinutes(session.start_time) + session.duration_minutes
        )
      )
      .reduce((total, session) => total + arenasUsedBySession(session), 0)

    const activeBlockedArenas = blockedTimes
      .filter((blocked) => blocked.date === date)
      .filter((blocked) =>
        rangesOverlap(start, end, timeToMinutes(blocked.start_time), timeToMinutes(blocked.end_time))
      )
      .reduce((total, blocked) => total + blocked.arenas_used, 0)

    const remaining = ARENA_COUNT - activeSessionArenas - activeBlockedArenas

    if (remaining >= arenaCount) {
      options.push({
        value: minutesToTime(start),
        label: `${minutesToTime(start)}-${minutesToTime(end)} (${remaining} ${remaining > 1 ? text.arenasAvailable : text.arenaAvailable})`,
        remaining,
      })
    }
  }

  return options
}

export function cafeTicketTimes(date: string, duration: number, arenaCount: number, now = new Date()): BookingTimeOption[] {
  if (!date || date < CAFE_SOFT_OPENING_DATE) return []

  const today = localDateString(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const latestStart = CAFE_CLOSE_MINUTES - duration
  const options: Array<{ value: string; label: string; remaining: number }> = []

  for (let start = CAFE_OPEN_MINUTES; start <= latestStart; start += TIME_STEP_MINUTES) {
    if (date === today && start <= nowMinutes) continue

    const end = start + duration
    const endLabel = minutesToTime(end)
    options.push({
      value: minutesToTime(start),
      label: `${minutesToTime(start)}-${endLabel}`,
      remaining: arenaCount,
    })
  }

  return options
}
