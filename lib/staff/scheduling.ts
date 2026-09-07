import type { StaffConsoleCopy } from './copy.ts'
import { minutesBetweenTimes, normalizeTime, parseMinutesTime } from './dates.ts'
import type { StaffAttendanceSettings, StaffLeaveRequest, StaffScheduleShift } from './types.ts'

export function activeShift(shift: StaffScheduleShift) {
  return shift.status !== 'cancelled'
}

export function timeRangesOverlap(
  leftStart: string | null | undefined,
  leftEnd: string | null | undefined,
  rightStart: string | null | undefined,
  rightEnd: string | null | undefined
) {
  const leftStartMinutes = parseMinutesTime(leftStart)
  let leftEndMinutes = parseMinutesTime(leftEnd)
  const rightStartMinutes = parseMinutesTime(rightStart)
  let rightEndMinutes = parseMinutesTime(rightEnd)
  if (leftEndMinutes <= leftStartMinutes) leftEndMinutes += 24 * 60
  if (rightEndMinutes <= rightStartMinutes) rightEndMinutes += 24 * 60
  return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes
}

export function shiftConflictWarnings(
  shift: StaffScheduleShift,
  shifts: StaffScheduleShift[],
  requests: StaffLeaveRequest[],
  settings: StaffAttendanceSettings,
  text: StaffConsoleCopy
) {
  if (!activeShift(shift)) return []
  const warnings: string[] = []
  const hasOverlap = shifts.some((item) => (
    item.id !== shift.id
    && activeShift(item)
    && item.staff_profile_id === shift.staff_profile_id
    && item.shift_date === shift.shift_date
    && timeRangesOverlap(shift.start_time, shift.end_time, item.start_time, item.end_time)
  ))
  if (hasOverlap) warnings.push(text.messages.planningConflictOverlap)

  const hasApprovedLeave = requests.some((item) => (
    item.status === 'approved'
    && item.staff_profile_id === shift.staff_profile_id
    && item.start_date <= shift.shift_date
    && item.end_date >= shift.shift_date
  ))
  if (hasApprovedLeave) warnings.push(text.messages.planningConflictLeave)

  const scheduledMinutes = shifts
    .filter((item) => activeShift(item) && item.staff_profile_id === shift.staff_profile_id && item.shift_date === shift.shift_date)
    .reduce((sum, item) => sum + minutesBetweenTimes(item.start_time, item.end_time, item.break_minutes), 0)
  if (settings.standard_daily_minutes > 0 && scheduledMinutes > settings.standard_daily_minutes) {
    warnings.push(text.messages.planningConflictDailyLimit)
  }

  return Array.from(new Set(warnings))
}

export function shiftStartDateTime(shift: StaffScheduleShift) {
  return new Date(`${shift.shift_date}T${normalizeTime(shift.start_time) || '00:00'}:00`).getTime()
}

export function shiftEndDateTime(shift: StaffScheduleShift) {
  const start = shiftStartDateTime(shift)
  const minutes = minutesBetweenTimes(shift.start_time, shift.end_time, 0)
  return start + minutes * 60000
}

export function countRestPeriodWarnings(shifts: StaffScheduleShift[], restPeriodMinutes: number) {
  if (restPeriodMinutes <= 0) return 0
  const activeShifts = shifts.filter(activeShift).sort((left, right) => shiftStartDateTime(left) - shiftStartDateTime(right))
  return activeShifts.reduce((count, shift, index) => {
    const previous = activeShifts[index - 1]
    if (!previous) return count
    const gapMinutes = Math.round((shiftStartDateTime(shift) - shiftEndDateTime(previous)) / 60000)
    return gapMinutes >= 0 && gapMinutes < restPeriodMinutes ? count + 1 : count
  }, 0)
}
