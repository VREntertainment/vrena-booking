export type AgeBand = 'unknown' | 'adult' | 'minor' | 'under13'

export function ageFromDateValue(dateValue: string | null | undefined, today = new Date()) {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null

  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return null

  const birthDate = new Date(Date.UTC(year, month - 1, day))
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) {
    return null
  }

  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()
  let age = todayYear - year
  if (todayMonth < month || (todayMonth === month && todayDay < day)) age -= 1

  return age >= 0 && age < 130 ? age : null
}

export function ageBandFromBirthday(dateValue: string | null | undefined, today = new Date()): AgeBand {
  const age = ageFromDateValue(dateValue, today)
  if (age === null) return 'unknown'
  if (age < 13) return 'under13'
  if (age < 18) return 'minor'
  return 'adult'
}

export function isAdultBirthday(dateValue: string | null | undefined) {
  return ageBandFromBirthday(dateValue) === 'adult'
}

export function isMinorBirthday(dateValue: string | null | undefined) {
  const band = ageBandFromBirthday(dateValue)
  return band === 'minor' || band === 'under13'
}

export function isUnder13Birthday(dateValue: string | null | undefined) {
  return ageBandFromBirthday(dateValue) === 'under13'
}
