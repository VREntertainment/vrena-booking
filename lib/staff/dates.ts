import type { StaffReportRangePreset } from './types.ts'

export function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateFromInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

export function addDays(value: string, days: number) {
  const date = dateFromInput(value)
  date.setDate(date.getDate() + days)
  return dateInputValue(date)
}

export function orderedRange(start: string, end: string) {
  return start <= end ? [start, end] : [end, start]
}
export const todayString = () => {
  const date = new Date()
  return dateInputValue(date)
}

export const shortDateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

export const staffDateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit' })

export function addMonths(value: string, months: number) {
  const date = dateFromInput(value)
  date.setMonth(date.getMonth() + months)
  return dateInputValue(date)
}

export function daysBetween(start: string, end: string) {
  return Math.round((dateFromInput(end).getTime() - dateFromInput(start).getTime()) / 86400000)
}

export function startOfWeek(value: string) {
  const date = dateFromInput(value)
  const weekday = date.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  date.setDate(date.getDate() + diff)
  return dateInputValue(date)
}

export function startOfMonth(value: string) {
  const date = dateFromInput(value)
  return dateInputValue(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function endOfMonth(value: string) {
  const date = dateFromInput(value)
  return dateInputValue(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function previousPeriodRange(start: string, end: string) {
  const [from, to] = orderedRange(start, end)
  const periodDays = Math.max(1, daysBetween(from, to) + 1)
  const previousEnd = addDays(from, -1)
  const previousStart = addDays(previousEnd, -(periodDays - 1))
  return [previousStart, previousEnd] as const
}

export function reportPresetRange(preset: StaffReportRangePreset, anchor = todayString()) {
  if (preset === 'today') return [anchor, anchor] as const
  if (preset === 'yesterday') {
    const yesterday = addDays(anchor, -1)
    return [yesterday, yesterday] as const
  }
  if (preset === 'this_week') {
    const start = startOfWeek(anchor)
    return [start, addDays(start, 6)] as const
  }
  if (preset === 'last_week') {
    const end = addDays(startOfWeek(anchor), -1)
    return [addDays(end, -6), end] as const
  }
  if (preset === 'this_month') return [startOfMonth(anchor), endOfMonth(anchor)] as const
  if (preset === 'last_month') {
    const previousMonth = addMonths(startOfMonth(anchor), -1)
    return [startOfMonth(previousMonth), endOfMonth(previousMonth)] as const
  }
  if (preset === 'last_60') return [addDays(anchor, -59), anchor] as const
  if (preset === 'last_90') return [addDays(anchor, -89), anchor] as const
  return [addDays(anchor, -29), anchor] as const
}

export function shortDateLabel(value: string) {
  return shortDateFormatter.format(dateFromInput(value))
}

export function staffDateLabel(value: string) {
  return value ? staffDateFormatter.format(dateFromInput(value)) : ''
}

export function rangeLabel(start: string, end: string) {
  return start === end ? shortDateLabel(start) : `${shortDateLabel(start)} - ${shortDateLabel(end)}`
}

export function attendanceWeekRange(anchor: string) {
  const start = startOfWeek(anchor)
  return [start, addDays(start, 6)] as const
}

export function attendanceDateRange(start: string, end: string) {
  const normalizedStart = start || todayString()
  const normalizedEnd = end || normalizedStart
  const [orderedStart, orderedEnd] = normalizedStart <= normalizedEnd
    ? [normalizedStart, normalizedEnd]
    : [normalizedEnd, normalizedStart]
  const maxEnd = addDays(orderedStart, 30)
  return [orderedStart, orderedEnd > maxEnd ? maxEnd : orderedEnd] as const
}

export function attendanceRangeLength(start: string, end: string) {
  const startTime = dateFromInput(start).getTime()
  const endTime = dateFromInput(end).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 7
  return Math.max(1, Math.min(31, Math.round((endTime - startTime) / 86400000) + 1))
}

export function attendanceDateKeys(start: string, end: string) {
  const dayCount = attendanceRangeLength(start, end)
  return Array.from({ length: dayCount }, (_, index) => addDays(start, index))
}

export function localDateTimeIso(dateValue: string, timeValue: string) {
  const normalized = normalizeTime(timeValue) || '00:00'
  return new Date(`${dateValue}T${normalized}:00`).toISOString()
}

export function timeValueFromIso(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return normalizeTime(value)
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

export function parseMinutesTime(value?: string | null) {
  const [hour, minute] = normalizeTime(value).split(':').map(Number)
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0
}

export function durationTimeValue(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(Number(minutes) || 0)))
  const hours = Math.floor(safeMinutes / 60)
  const minute = safeMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function minutesBetweenTimes(start?: string | null, end?: string | null, breakMinutes = 0) {
  const startMinutes = parseMinutesTime(start)
  let endMinutes = parseMinutesTime(end)
  if (endMinutes < startMinutes) endMinutes += 24 * 60
  return Math.max(0, endMinutes - startMinutes - breakMinutes)
}

export function minutesBetween(startIso?: string | null, endIso?: string | null, breakMinutes = 0) {
  if (!startIso || !endIso) return 0
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.round((end - start) / 60000) - breakMinutes)
}

export function hoursLabel(minutes: number) {
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`
}

export const staffTimeOptions = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4)
  const minute = String((index % 4) * 15).padStart(2, '0')
  return `${String(hour).padStart(2, '0')}:${minute}`
})

export function normalizeTypedStaffTime(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/[h.]/, ':')
  const colonMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (colonMatch) return `${colonMatch[1].padStart(2, '0')}:${colonMatch[2]}`

  const compactMatch = trimmed.match(/^([01]?\d|2[0-3])([0-5]\d)$/)
  if (compactMatch) return `${compactMatch[1].padStart(2, '0')}:${compactMatch[2]}`

  const hourMatch = trimmed.match(/^([01]?\d|2[0-3])$/)
  if (hourMatch) return `${hourMatch[1].padStart(2, '0')}:00`

  return ''
}

export function normalizeTypedStaffDuration(value: string) {
  const trimmed = value.trim().toLowerCase()
  const decimalMatch = trimmed.match(/^(\d{1,2})(?:[.,](\d{1,2}))$/)
  if (decimalMatch) {
    const hours = Number(decimalMatch[1])
    const fraction = Number(`0.${decimalMatch[2]}`)
    if (Number.isFinite(hours) && Number.isFinite(fraction)) {
      return durationTimeValue((hours * 60) + Math.round(fraction * 60))
    }
  }

  return normalizeTypedStaffTime(value)
}

export function normalizeTime(value: string | null | undefined) {
  return (value || '').slice(0, 5)
}

export function addMinutesToTime(value: string, minutes: number) {
  const [hours, mins] = normalizeTime(value).split(':').map(Number)
  const total = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(mins) ? mins : 0) + minutes
  const normalized = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}
