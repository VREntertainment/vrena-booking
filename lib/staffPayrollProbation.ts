export type StaffProbationPayProfile = {
  probation_start_date?: string | null
  probation_end_date?: string | null
  labor_start_date?: string | null
  probation_salary_percentage?: number | null
  probation_bonus_percentage?: number | null
}

export function employeeIsInProbationForPeriod(
  employee: StaffProbationPayProfile | undefined,
  periodEnd: string,
) {
  const probationEnd = employee?.probation_end_date || ''
  const laborStart = employee?.labor_start_date || ''

  return Boolean(
    employee?.probation_start_date &&
    periodEnd >= employee.probation_start_date &&
    (!probationEnd || periodEnd <= probationEnd) &&
    (!laborStart || periodEnd < laborStart)
  )
}

function allowedProbationPercentage(value: number | null | undefined, fallback: 85 | 100) {
  return Number(value) === 100 ? 100 : Number(value) === 85 ? 85 : fallback
}

export function employeeSalaryPercentageForPeriod(
  employee: StaffProbationPayProfile | undefined,
  periodEnd: string,
) {
  if (!employeeIsInProbationForPeriod(employee, periodEnd)) return 1
  return allowedProbationPercentage(employee?.probation_salary_percentage, 85) / 100
}

export function employeeBonusPercentageForPeriod(
  employee: StaffProbationPayProfile | undefined,
  periodEnd: string,
) {
  if (!employeeIsInProbationForPeriod(employee, periodEnd)) return 1
  return allowedProbationPercentage(employee?.probation_bonus_percentage, 100) / 100
}
