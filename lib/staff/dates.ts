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
