import type { AccountantPayrollWorkbookInput } from './accountantPayrollWorkbook'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const ACCOUNTANT_PAYROLL_EXPORT_MAX_BYTES = 5 * 1024 * 1024

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isRecordArray(value: unknown, maximum: number): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.length <= maximum && value.every(isRecord)
}

function utcDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function isIsoCalendarDate(value: string) {
  if (!ISO_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

export function validateAccountantPayrollExportInput(value: unknown): AccountantPayrollWorkbookInput {
  if (!isRecord(value)) throw new Error('Invalid accountant payroll export data.')

  const periodStart = typeof value.periodStart === 'string' ? value.periodStart : ''
  const periodEnd = typeof value.periodEnd === 'string' ? value.periodEnd : ''
  if (!isIsoCalendarDate(periodStart) || !isIsoCalendarDate(periodEnd)) {
    throw new Error('The payroll export period is invalid.')
  }

  const startDay = utcDay(periodStart)
  const endDay = utcDay(periodEnd)
  const inclusiveDays = Math.round((endDay - startDay) / 86_400_000) + 1
  if (!Number.isFinite(inclusiveDays) || inclusiveDays < 1 || inclusiveDays > 31) {
    throw new Error('The accountant template supports payroll periods of up to 31 days.')
  }

  if (!isRecordArray(value.payrollRows, 32)) throw new Error('Invalid payroll rows in the accountant export.')
  if (!isRecordArray(value.employeeRows, 32)) throw new Error('Invalid employee rows in the accountant export.')
  if (!isRecordArray(value.attendanceRows, 5_000)) throw new Error('Invalid attendance rows in the accountant export.')
  if (!isRecordArray(value.calculationBasisRows, 250)) throw new Error('Invalid calculation basis rows in the accountant export.')

  const sourceWorkbookKey = typeof value.sourceWorkbookKey === 'string' ? value.sourceWorkbookKey.trim() : ''
  const sourceWorkbookRowCount = value.sourceWorkbookRowCount
  if (sourceWorkbookKey && !/^[a-z0-9][a-z0-9-]{0,79}$/.test(sourceWorkbookKey)) {
    throw new Error('The accountant source workbook key is invalid.')
  }
  if (sourceWorkbookRowCount !== undefined && (typeof sourceWorkbookRowCount !== 'number' || !Number.isInteger(sourceWorkbookRowCount) || sourceWorkbookRowCount < 0 || sourceWorkbookRowCount > 32)) {
    throw new Error('The accountant source workbook row count is invalid.')
  }

  return {
    periodStart,
    periodEnd,
    ...(sourceWorkbookKey ? { sourceWorkbookKey } : {}),
    ...(sourceWorkbookRowCount !== undefined ? { sourceWorkbookRowCount: Number(sourceWorkbookRowCount) } : {}),
    payrollRows: value.payrollRows,
    employeeRows: value.employeeRows,
    attendanceRows: value.attendanceRows,
    calculationBasisRows: value.calculationBasisRows,
  }
}

export function accountantPayrollFilename(value: unknown) {
  const source = typeof value === 'string' ? value : 'vrena-payroll.xlsx'
  const withoutExtension = source.replace(/\.(xls|xlsx)$/i, '')
  const safeBase = withoutExtension
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 100) || 'vrena-payroll'
  return `${safeBase}.xlsx`
}

export function accountantPayrollContentDisposition(filename: string) {
  const safeFilename = accountantPayrollFilename(filename)
  return `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
}
