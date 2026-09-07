import { CAFE_OPEN_MINUTES, CLOSE_MINUTES, OPEN_MINUTES, minutesToTime } from '../booking/availability.ts'

export function staffBookingHours(venueKey: string, duration: number) {
  return {
    min: minutesToTime(venueKey === 'cafe-des-stagiaires' ? CAFE_OPEN_MINUTES : OPEN_MINUTES),
    max: minutesToTime(CLOSE_MINUTES - duration),
    close: minutesToTime(CLOSE_MINUTES),
  }
}

export function validStaffBookingTime(venueKey: string, duration: number, time: string) {
  const { min, max } = staffBookingHours(venueKey, duration)
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && time >= min && time <= max
}
