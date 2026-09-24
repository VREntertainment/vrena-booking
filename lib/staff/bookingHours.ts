import { CAFE_CLOSE_MINUTES, CAFE_OPEN_MINUTES, CLOSE_MINUTES, OPEN_MINUTES, minutesToTime } from '../booking/availability.ts'

export function staffBookingHours(venueKey: string, duration: number) {
  const closeMinutes = venueKey === 'cafe-des-stagiaires' ? CAFE_CLOSE_MINUTES : CLOSE_MINUTES
  return {
    min: minutesToTime(venueKey === 'cafe-des-stagiaires' ? CAFE_OPEN_MINUTES : OPEN_MINUTES),
    max: minutesToTime(closeMinutes - duration),
    close: minutesToTime(closeMinutes),
  }
}

export function validStaffBookingTime(venueKey: string, duration: number, time: string, allowOutsideHours = false) {
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) return false
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false
  const [hour, minute] = time.split(':').map(Number)
  if (hour * 60 + minute + duration > 1440) return false
  if (allowOutsideHours) return true
  const { min, max } = staffBookingHours(venueKey, duration)
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && time >= min && time <= max
}

export function staffBookingEndTime(time: string, duration: number) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isInteger(duration) || duration < 1) return '—'
  const [hour, minute] = time.split(':').map(Number)
  const end = hour * 60 + minute + duration
  if (end > 1440) return '—'
  return minutesToTime(end)
}
