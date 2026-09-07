type CalendarSession = { id: string; date: string; start_time: string; duration_minutes: number }

export type CalendarNavigation = { mode: 'calendar' | 'staff-booking' | 'client-ticket'; date: string; time: string; venue: 'ha-do-centrosa' | 'cafe-des-stagiaires' }
export function calendarNavigation(search: string): CalendarNavigation | null {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  const date = params.get('date') || ''
  const time = params.get('time') || ''
  const venue = params.get('venue')
  if (!['calendar','staff-booking','client-ticket'].includes(mode || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))
    || (venue !== 'ha-do-centrosa' && venue !== 'cafe-des-stagiaires') || (mode !== 'calendar' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return null
  return { mode: mode as CalendarNavigation['mode'], date, time, venue }
}

export const calendarMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** Give simultaneous bookings separate lanes, without narrowing unrelated times. */
export function calendarLanes(sessions: CalendarSession[]) {
  const result = new Map<string, { lane: number; lanes: number }>()
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id))
  let group: Array<{ id: string; lane: number }> = []
  let ends: number[] = []
  let date = ''
  const flush = () => {
    group.forEach((entry) => result.set(entry.id, { lane: entry.lane, lanes: ends.length }))
    group = []
    ends = []
  }
  for (const session of sorted) {
    const start = calendarMinutes(session.start_time)
    if (session.date !== date || ends.every((end) => end <= start)) flush()
    date = session.date
    let lane = ends.findIndex((end) => end <= start)
    if (lane < 0) lane = ends.length
    ends[lane] = start + session.duration_minutes
    group.push({ id: session.id, lane })
  }
  flush()
  return result
}
