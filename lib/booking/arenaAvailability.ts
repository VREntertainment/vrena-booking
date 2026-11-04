import { CAFE_OPEN_MINUTES, CAFE_CLOSE_MINUTES, CAFE_TIME_STEP_MINUTES, haDoStartMinutes, minutesToTime, rangesOverlap, timeToMinutes, type BookingTimeOption } from './availability.ts'

export type ArenaOccupancy = { venue_key: string; date: string; start_time: string; duration_minutes: number; arena_number: number }

export function vietnamClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (name: string) => parts.find(p => p.type === name)!.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, minutes: Number(part('hour')) * 60 + Number(part('minute')) }
}

/** Use physical arenas, not a sum of all intersecting bookings: one arena may
 * have several consecutive bookings during a longer requested interval. */
export function arenaTimeOptions(venue: string, date: string, duration: number, arenaCount: number, occupancy: ArenaOccupancy[], now = new Date()): BookingTimeOption[] {
  const cafe = venue === 'cafe-des-stagiaires'
  const capacity = cafe ? 1 : 2
  const clock = vietnamClock(now)
  if (!date || date < clock.date || !Number.isInteger(duration) || duration <= 0 || arenaCount < 1 || arenaCount > capacity) return []
  const options: BookingTimeOption[] = []
  const starts = cafe ? Array.from({ length: Math.max(0, Math.floor((CAFE_CLOSE_MINUTES - duration - CAFE_OPEN_MINUTES) / CAFE_TIME_STEP_MINUTES) + 1) }, (_, i) => CAFE_OPEN_MINUTES + i * CAFE_TIME_STEP_MINUTES) : haDoStartMinutes(duration)
  for (const start of starts) {
    if (date === clock.date && start <= clock.minutes) continue
    const occupied = new Set(occupancy.filter(row => row.venue_key === venue && row.date === date && rangesOverlap(start, start + duration, timeToMinutes(row.start_time), timeToMinutes(row.start_time) + row.duration_minutes)).map(row => row.arena_number))
    const remaining = capacity - occupied.size
    if (remaining >= arenaCount) options.push({ value: minutesToTime(start), label: `${minutesToTime(start)}-${minutesToTime(start + duration)}`, remaining })
  }
  return options
}
