export const staffCostLocations = ['HaDo', 'CS', 'VRE'] as const

export function employeeHomeLocation(department: string | null | undefined) {
  return department === 'Office' ? 'VRE' : department === 'GC' ? 'HaDo' : null
}

export type StaffCostAssignment = {
  id: string
  profile_id: string
  cost_location: string
  start_date: string
  end_date: string
  reason: string
  cancelled_at: string | null
}

export type StaffCostShare = { location: string; paidMinutes: number; companyCost: number }

// Cost attribution only: never change salary, recorded clocks, or approved minutes.
// Night minutes overlap regular/OT minutes and must not be counted twice.
export function allocateStaffCompanyCost(input: {
  profileId: string
  homeLocation: string
  periodStart: string
  periodEnd: string
  companyCost: number
  paidLeaveMinutes: number
  assignments: StaffCostAssignment[]
  attendance: Array<{
    staff_profile_id: string; work_date: string; approval_status: string
    regular_minutes: number; overtime_minutes: number; holiday_minutes: number
  }>
}) {
  const home = input.homeLocation || 'Unassigned'
  const assignments = input.assignments.filter((row) => row.profile_id === input.profileId && !row.cancelled_at
    && row.start_date <= input.periodEnd && row.end_date >= input.periodStart)
  const minutes = new Map<string, number>()
  // Paid leave contributes its hours to the normal payroll location.
  if (input.paidLeaveMinutes > 0) minutes.set(home, input.paidLeaveMinutes)
  for (const log of input.attendance) {
    if (log.staff_profile_id !== input.profileId || log.approval_status !== 'approved'
      || log.work_date < input.periodStart || log.work_date > input.periodEnd) continue
    const paid = Math.max(0, Number(log.regular_minutes) || 0)
      + Math.max(0, Number(log.overtime_minutes) || 0) + Math.max(0, Number(log.holiday_minutes) || 0)
    if (!paid) continue
    const location = assignments.find((row) => row.start_date <= log.work_date && row.end_date >= log.work_date)?.cost_location || home
    minutes.set(location, (minutes.get(location) || 0) + paid)
  }
  const total = [...minutes.values()].reduce((sum, value) => sum + value, 0)
  const cost = Math.max(0, Math.round(input.companyCost))
  if (!total) return {
    shares: [{ location: home, paidMinutes: 0, companyCost: cost }],
    needsPaidHours: assignments.length > 0 && cost > 0,
  }
  // Cumulative rounding guarantees the allocation reconciles to the exact VND total.
  let cumulativeMinutes = 0
  let allocated = 0
  const shares: StaffCostShare[] = [...minutes].sort(([a], [b]) => a.localeCompare(b)).map(([location, paidMinutes]) => {
    cumulativeMinutes += paidMinutes
    const cumulativeCost = Math.round(cost * cumulativeMinutes / total)
    const companyCost = cumulativeCost - allocated
    allocated = cumulativeCost
    return { location, paidMinutes, companyCost }
  })
  return { shares, needsPaidHours: false }
}
