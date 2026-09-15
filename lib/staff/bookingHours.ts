import { CAFE_CLOSE_MINUTES, CAFE_OPEN_MINUTES, CLOSE_MINUTES, OPEN_MINUTES, minutesToTime } from '../booking/availability.ts'

export function staffBookingHours(venueKey: string, duration: number) {
  const closeMinutes = venueKey === 'cafe-des-stagiaires' ? CAFE_CLOSE_MINUTES : CLOSE_MINUTES
  return {
    min: minutesToTime(venueKey === 'cafe-des-stagiaires' ? CAFE_OPEN_MINUTES : OPEN_MINUTES),
    max: minutesToTime(closeMinutes - duration),
    close: minutesToTime(closeMinutes),
  }
}

export function validStaffBookingTime(venueKey: string, duration: number, time: string) {
  const { min, max } = staffBookingHours(venueKey, duration)
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && time >= min && time <= max
}
