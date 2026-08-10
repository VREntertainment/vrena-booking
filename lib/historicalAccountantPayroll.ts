import type { AccountantPayrollCategory, AccountantPayrollPlacement } from './accountantPayrollWorkbook'

export const JULY_2026_ACCOUNTANT_SOURCE_KEY = 'july-2026-260805'

type JulyPlacement = AccountantPayrollPlacement & { order: number }

const julyPlacements: Record<string, JulyPlacement> = {
  NV25: { order: 1, layoutCategory: 'monthly', basic: 9, payroll: 10, workRecord: 14, bank: 9, reconcile: 10, timesheet: { sheet: 'Manager-timesheet', slot: 1 }, sequence: { basic: 1, payroll: 1, workRecord: 1, bank: 1, reconcile: 1 } },
  NV18: { order: 2, layoutCategory: 'monthly', basic: 10, payroll: 11, workRecord: 15, bank: 10, reconcile: 11, timesheet: { sheet: 'GC- timesheet', slot: 1 }, sequence: { basic: 2, payroll: 2, workRecord: 2, bank: 2, reconcile: 2 } },
  NV04: { order: 3, layoutCategory: 'monthly', basic: 11, payroll: 12, workRecord: 16, bank: 11, reconcile: 12, timesheet: { sheet: 'VRENA-timesheet', slot: 0 }, sequence: { basic: 3, payroll: 3, workRecord: 3, bank: 3, reconcile: 3 } },
  NV03: { order: 4, layoutCategory: 'monthly', basic: 46, payroll: 13, reconcile: 13, sequence: { basic: 4, payroll: 4, reconcile: 4 } },
  NV07: { order: 5, layoutCategory: 'monthly', basic: 12, payroll: 14, workRecord: 17, bank: 12, reconcile: 14, timesheet: { sheet: 'GC- timesheet', slot: 0 }, sequence: { basic: 5, payroll: 5, workRecord: 4, bank: 4, reconcile: 5 } },
  NV28: { order: 6, layoutCategory: 'monthly', basic: 13, payroll: 15, workRecord: 18, bank: 13, reconcile: 15, timesheet: { sheet: 'GC- timesheet', slot: 4 }, sequence: { basic: 6, payroll: 6, workRecord: 5, bank: 5, reconcile: 6 } },
  NV30: { order: 7, layoutCategory: 'monthly', basic: 14, payroll: 16, workRecord: 19, bank: 14, reconcile: 29, timesheet: { sheet: 'GC- timesheet', slot: 5 }, sequence: { basic: 7, payroll: 7, workRecord: 6, bank: 6, reconcile: 7 } },
  NV16: { order: 8, layoutCategory: 'official_hourly', basic: 16, payroll: 18, workRecord: 21, bank: 16, reconcile: 17, timesheet: { sheet: 'GC- timesheet', slot: 2 }, sequence: { basic: 1, payroll: 1, workRecord: 1, bank: 1, reconcile: 1 } },
  NV12: { order: 9, layoutCategory: 'official_hourly', basic: 17, payroll: 19, workRecord: 22, bank: 17, reconcile: 18, timesheet: { sheet: 'VRENA-timesheet', slot: 3 }, sequence: { basic: 2, payroll: 2, workRecord: 2, bank: 2, reconcile: 2 } },
  NV08: { order: 10, layoutCategory: 'official_hourly', basic: 18, payroll: 20, workRecord: 23, bank: 18, reconcile: 19, timesheet: { sheet: 'VRENA-timesheet', slot: 1 }, sequence: { basic: 3, payroll: 3, workRecord: 3, bank: 3, reconcile: 3 } },
  NV24: { order: 11, layoutCategory: 'part_time', basic: 20, payroll: 22, workRecord: 25, bank: 20, reconcile: 23, timesheet: { sheet: 'VRENA-timesheet', slot: 4 }, sequence: { basic: 1, payroll: 1, workRecord: 1, bank: 1, reconcile: 1 } },
  NV09: { order: 12, layoutCategory: 'part_time', basic: 21, payroll: 23, workRecord: 26, bank: 21, reconcile: 24, timesheet: { sheet: 'VRENA-timesheet', slot: 2 }, sequence: { basic: 2, payroll: 2, workRecord: 2, bank: 2, reconcile: 2 } },
  NV27: { order: 13, layoutCategory: 'manager', basic: 23, payroll: 25, workRecord: 28, bank: 23, reconcile: 26, timesheet: { sheet: 'Manager-timesheet', slot: 2 }, sequence: { basic: 1, payroll: 1, workRecord: 1, bank: 1, reconcile: 1 } },
  NV31: { order: 14, layoutCategory: 'probation_monthly', basic: 25, payroll: 27, workRecord: 30, bank: 25, reconcile: 30, timesheet: { sheet: 'VRENA-timesheet', slot: 5 }, sequence: { basic: 1, payroll: 1, workRecord: 1, bank: 1, reconcile: 1 } },
  NV34: { order: 15, layoutCategory: 'probation_monthly', basic: 26, payroll: 28, workRecord: 31, bank: 26, reconcile: 31, timesheet: { sheet: 'GC- timesheet', slot: 3 }, sequence: { basic: 2, payroll: 2, workRecord: 2, bank: 2, reconcile: 2 } },
}

export function historicalAccountantPlacement(sourceKey: string, employeeCode: string) {
  return sourceKey === JULY_2026_ACCOUNTANT_SOURCE_KEY ? julyPlacements[employeeCode] || null : null
}

export function historicalAccountantCategory(sourceKey: string, employeeCode: string, sourceCategory: string | null | undefined): AccountantPayrollCategory {
  const placement = historicalAccountantPlacement(sourceKey, employeeCode)
  if (placement) return placement.layoutCategory
  const normalized = String(sourceCategory || '').toLowerCase()
  if (normalized.includes('manager')) return 'manager'
  if (normalized.includes('hourly')) return 'official_hourly'
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'part_time'
  return 'monthly'
}

export function sortHistoricalAccountantRows<T extends { employee_code: string }>(sourceKey: string, rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftOrder = historicalAccountantPlacement(sourceKey, left.employee_code)?.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = historicalAccountantPlacement(sourceKey, right.employee_code)?.order ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder || left.employee_code.localeCompare(right.employee_code)
  })
}

export function hasCompleteHistoricalAccountantLayout(sourceKey: string, employeeCodes: string[]) {
  const uniqueEmployeeCodes = new Set(employeeCodes)
  return sourceKey === JULY_2026_ACCOUNTANT_SOURCE_KEY
    && employeeCodes.length === Object.keys(julyPlacements).length
    && uniqueEmployeeCodes.size === employeeCodes.length
    && employeeCodes.every((employeeCode) => Boolean(julyPlacements[employeeCode]))
}
