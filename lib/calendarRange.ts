/** Visible calendar bounds for the selected venue/week's non-cancelled bookings. */
export function calendarRange(open: number, close: number, step: number, bookings: ReadonlyArray<{ start_time: string; duration_minutes: number }>, staff: boolean): [number, number] {
  let first = open
  let last = close
  if (staff) {
    for (const booking of bookings) {
      const [hour, minute] = booking.start_time.split(':').map(Number)
      const start = hour * 60 + minute
      if (!Number.isFinite(start) || !Number.isFinite(booking.duration_minutes)) continue
      first = Math.min(first, Math.max(0, Math.floor(start / step) * step))
      last = Math.max(last, Math.min(1440, Math.ceil((start + booking.duration_minutes) / step) * step))
    }
  }
  return [first, last]
}
