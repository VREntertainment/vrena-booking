import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

type WorkbookFormulaValue = {
  __xlsxFormula: true
  formula: string
  result?: string | number
}

export type AccountantPayrollCategory =
  | 'monthly'
  | 'official_hourly'
  | 'part_time'
  | 'manager'
  | 'probation_monthly'
  | 'probation_part_time'

export type AccountantPayrollPlacement = {
  layoutCategory: AccountantPayrollCategory
  basic: number
  payroll: number
  workRecord?: number
  bank?: number
  reconcile?: number
  sequence?: Partial<Record<'basic' | 'payroll' | 'workRecord' | 'bank' | 'reconcile', number>>
  timesheet?: { sheet: 'VRENA-timesheet' | 'Manager-timesheet' | 'GC- timesheet'; slot: number }
}

export type AccountantPayrollWorkbookInput = {
  periodStart: string
  periodEnd: string
  sourceWorkbookKey?: string
  sourceWorkbookRowCount?: number
  payrollRows: Array<Record<string, unknown>>
  employeeRows: Array<Record<string, unknown>>
  attendanceRows: Array<Record<string, unknown>>
  calculationBasisRows: Array<Record<string, unknown>>
}

type CellValue = string | number | null | WorkbookFormulaValue
type ZipEntries = Record<string, Uint8Array>

const categoryLayouts: Record<AccountantPayrollCategory, {
  basic: number[]
  payroll: number[]
  workRecord: number[]
  bank: number[]
  reconcile: number[]
}> = {
  monthly: { basic: [9, 10, 11, 12, 13, 14], payroll: [10, 11, 12, 13, 14, 15, 16], workRecord: [14, 15, 16, 17, 18, 19, 20], bank: [9, 10, 11, 12, 13, 14, 15], reconcile: [10, 11, 12, 13, 14, 15, 16] },
  official_hourly: { basic: [16, 17, 18], payroll: [18, 19, 20], workRecord: [21, 22, 23], bank: [16, 17, 18], reconcile: [17, 18, 19, 20, 21] },
  part_time: { basic: [20, 21], payroll: [22, 23], workRecord: [25, 26], bank: [20, 21], reconcile: [23, 24] },
  manager: { basic: [23], payroll: [25], workRecord: [28], bank: [23], reconcile: [26, 27] },
  probation_monthly: { basic: [25, 26], payroll: [27, 28], workRecord: [30, 31], bank: [25, 26], reconcile: [29, 30, 31, 32, 33] },
  probation_part_time: { basic: [28], payroll: [30], workRecord: [33], bank: [28], reconcile: [35, 36] },
}

const payrollDataRows = Object.values(categoryLayouts).flatMap((layout) => layout.payroll)
const basicDataRows = Object.values(categoryLayouts).flatMap((layout) => layout.basic)
const workRecordDataRows = Object.values(categoryLayouts).flatMap((layout) => layout.workRecord)
const bankDataRows = Object.values(categoryLayouts).flatMap((layout) => layout.bank)
const reconcileDataRows = Object.values(categoryLayouts).flatMap((layout) => layout.reconcile)
const categories = Object.keys(categoryLayouts) as AccountantPayrollCategory[]

const timesheetLayouts = {
  'VRENA-timesheet': [
    { name: 7, date: 8, day: 9, marker: 10, timeIn: 11, timeOut: 12, total: 13, break: 14, net: 15, ot: 16, summary: 18 },
    { name: 24, date: 25, day: 26, marker: 27, timeIn: 28, timeOut: 29, total: 30, break: 31, net: 32, ot: 33, summary: 35 },
    { name: 41, date: 42, day: 43, marker: 44, timeIn: 45, timeOut: 46, total: 47, break: 48, net: 49, ot: 50, summary: 52 },
    { name: 57, date: 58, day: 59, marker: 60, timeIn: 61, timeOut: 62, total: 63, break: 64, net: 65, ot: 66, summary: 68 },
    { name: 76, date: 77, day: 78, marker: 79, timeIn: 80, timeOut: 81, total: 82, break: 83, net: 84, ot: 85, summary: 87 },
    { name: 92, date: 93, day: 94, marker: 95, timeIn: 96, timeOut: 97, total: 98, break: 99, net: 100, ot: 101, summary: 103 },
  ],
  'Manager-timesheet': [
    { name: 1, date: 3, day: 4, marker: 5, timeIn: 6, timeOut: 7, total: 8, break: 9, net: 10, ot: 11, summary: 13 },
    { name: 17, date: 19, day: 20, marker: 21, timeIn: 22, timeOut: 23, total: 24, break: 25, net: 26, ot: 27, summary: 29 },
    { name: 34, date: 35, day: 36, marker: 37, timeIn: 38, timeOut: 39, total: 40, break: 41, net: 42, ot: 43, summary: 45 },
    { name: 51, date: 52, day: 53, marker: 54, timeIn: 55, timeOut: 56, total: 57, break: 58, net: 59, ot: 60, summary: 62 },
  ],
  'GC- timesheet': [
    { name: 6, date: 7, day: 8, marker: 9, timeIn: 10, timeOut: 11, total: 12, break: 13, net: 14, ot: 15, summary: 17 },
    { name: 24, date: 25, day: 26, marker: 27, timeIn: 28, timeOut: 29, total: 30, break: 31, net: 32, ot: 33, summary: 35 },
    { name: 43, date: 44, day: 45, marker: 46, timeIn: 47, timeOut: 48, total: 49, break: 50, net: 51, ot: 52, summary: 54 },
    { name: 60, date: 61, day: 62, marker: 63, timeIn: 64, timeOut: 65, total: 66, break: 67, net: 68, ot: 69, summary: 71 },
    { name: 76, date: 77, day: 78, marker: 79, timeIn: 80, timeOut: 81, total: 82, break: 83, net: 84, ot: 85, summary: 87 },
    { name: 92, date: 93, day: 94, marker: 95, timeIn: 96, timeOut: 97, total: 98, break: 99, net: 100, ot: 101, summary: 103 },
  ],
} as const

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function regexEscape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function unwrap(value: unknown): string | number {
  if (value && typeof value === 'object' && (value as WorkbookFormulaValue).__xlsxFormula) {
    return (value as WorkbookFormulaValue).result ?? ''
  }
  return typeof value === 'number' || typeof value === 'string' ? value : ''
}

function numberValue(row: Record<string, unknown>, key: string) {
  const value = Number(unwrap(row[key]))
  return Number.isFinite(value) ? value : 0
}

function stringValue(row: Record<string, unknown>, key: string) {
  return String(unwrap(row[key]) ?? '')
}

function hasNumericValue(row: Record<string, unknown>, key: string) {
  const raw = unwrap(row[key])
  return raw !== '' && Number.isFinite(Number(raw))
}

function bankAdjustmentValue(row: Record<string, unknown>) {
  if (hasNumericValue(row, 'Bank adjustment (VND)')) return numberValue(row, 'Bank adjustment (VND)')
  return -(numberValue(row, 'Advances (VND)') + numberValue(row, 'Deductions (VND)'))
}

function netBeforeAdjustmentValue(row: Record<string, unknown>) {
  if (hasNumericValue(row, 'Net before adjustment (VND)')) return numberValue(row, 'Net before adjustment (VND)')
  return numberValue(row, 'Net payable (VND)') - bankAdjustmentValue(row)
}

function bankTransferValue(row: Record<string, unknown>) {
  if (hasNumericValue(row, 'Bank transfer (VND)')) return numberValue(row, 'Bank transfer (VND)')
  return netBeforeAdjustmentValue(row) + bankAdjustmentValue(row)
}

function employeeInsuranceDeductionValue(row: Record<string, unknown>) {
  if (hasNumericValue(row, 'Employee insurance deducted (VND)')) return numberValue(row, 'Employee insurance deducted (VND)')
  return numberValue(row, 'Employee insurance (VND)')
}

function employeeInsuranceDeductionFormula(row: Record<string, unknown>, payrollRow: number) {
  const deduction = employeeInsuranceDeductionValue(row)
  const contributions = numberValue(row, 'Employee insurance (VND)')
  if (Math.abs(deduction - contributions) <= 1) return `SUM(AG${payrollRow}:AI${payrollRow})`
  if (Math.abs(deduction) <= 1) return '0'
  return String(Math.round(deduction))
}

function formula(formulaText: string, result: string | number = ''): WorkbookFormulaValue {
  return { __xlsxFormula: true, formula: formulaText.replace(/^=/, ''), result }
}

function excelSerial(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number)
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000)
}

function excelDateOrText(value: string): string | number {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? excelSerial(value) : value
}

function dateRange(start: string, end: string) {
  const dates: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cursor <= last && dates.length < 31) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function columnName(index: number) {
  let value = index
  let output = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    output = String.fromCharCode(65 + remainder) + output
    value = Math.floor((value - 1) / 26)
  }
  return output
}

function timeFraction(value: string) {
  const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/)
  if (!match) return 0
  return (Number(match[1]) * 60 + Number(match[2])) / 1_440
}

function categoryOf(row: Record<string, unknown>): AccountantPayrollCategory {
  const value = row.__accountantCategory
  return categories.includes(value as AccountantPayrollCategory) ? value as AccountantPayrollCategory : 'monthly'
}

function probationAppliesToPayroll(row: Record<string, unknown>) {
  return row.__accountantProbation === true || categoryOf(row).startsWith('probation')
}

function cellXml(openingAttributes: string, value: CellValue) {
  const attributes = openingAttributes.replace(/\s+t="[^"]*"/g, '').replace(/\/\s*$/, '')
  if (value && typeof value === 'object' && value.__xlsxFormula) {
    const cached = value.result ?? ''
    const type = typeof cached === 'number' ? '' : ' t="str"'
    return `<c${attributes}${type}><f>${xmlEscape(value.formula)}</f><v>${xmlEscape(cached)}</v></c>`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c${attributes}><v>${value}</v></c>`
  }
  return `<c${attributes} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value ?? '')}</t></is></c>`
}

function setCell(xml: string, reference: string, value: CellValue) {
  const escapedReference = regexEscape(reference)
  const emptyCell = new RegExp(`<c([^>]*\\br="${escapedReference}"[^>]*)\\s*\\/>`)
  if (emptyCell.test(xml)) return xml.replace(emptyCell, (_match, attributes) => cellXml(attributes, value))
  const fullCell = new RegExp(`<c([^>]*\\br="${escapedReference}"[^>]*[^/])>([\\s\\S]*?)<\\/c>`)
  if (fullCell.test(xml)) return xml.replace(fullCell, (_match, attributes) => cellXml(attributes, value))
  const rowNumber = reference.match(/\d+$/)?.[0]
  const row = rowNumber ? xml.match(new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*>[\\s\\S]*?<\\/row>`))?.[0] : undefined
  throw new Error(`Accountant template cell ${reference} is missing${row ? ` (row present: ${row.slice(0, 240)})` : ' (row missing)'}`)
}

function sheetPaths(entries: ZipEntries) {
  const workbookXml = strFromU8(entries['xl/workbook.xml'])
  const relsXml = strFromU8(entries['xl/_rels/workbook.xml.rels'])
  const relationshipTargets = new Map<string, string>()
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/>/g)) {
    relationshipTargets.set(match[1], match[2])
  }
  const paths = new Map<string, string>()
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"[^>]*\/>/g)) {
    const target = relationshipTargets.get(match[2])
    if (target) paths.set(match[1], target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  }
  return paths
}

function getSheet(entries: ZipEntries, paths: Map<string, string>, name: string) {
  const path = paths.get(name)
  if (!path || !entries[path]) throw new Error(`Accountant template sheet ${name} is missing`)
  return { path, xml: strFromU8(entries[path]) }
}

function saveSheet(entries: ZipEntries, path: string, xml: string) {
  entries[path] = strToU8(xml)
}

function assignRows(rows: Array<Record<string, unknown>>) {
  const assignments = new Map<Record<string, unknown>, AccountantPayrollPlacement>()
  const explicitPlacements = rows.map((row) => row.__accountantPlacement as AccountantPayrollPlacement | undefined)
  if (explicitPlacements.some(Boolean)) {
    if (!explicitPlacements.every(Boolean)) throw new Error('Accountant row placements must be supplied for every payroll row or for none of them.')
    const occupied = new Map<string, string>()
    rows.forEach((row, index) => {
      const placement = explicitPlacements[index] as AccountantPayrollPlacement
      if (!categories.includes(placement.layoutCategory) || !Number.isInteger(placement.basic) || !Number.isInteger(placement.payroll)) {
        throw new Error(`Invalid accountant row placement for ${row['Employee code'] || 'an employee'}.`)
      }
      for (const surface of ['basic', 'payroll', 'workRecord', 'bank', 'reconcile'] as const) {
        const target = placement[surface]
        if (target == null) continue
        const key = `${surface}:${target}`
        const existing = occupied.get(key)
        if (existing) throw new Error(`Accountant ${surface} row ${target} is assigned to both ${existing} and ${row['Employee code'] || 'an employee'}.`)
        occupied.set(key, String(row['Employee code'] || 'an employee'))
      }
      assignments.set(row, placement)
    })
    return assignments
  }
  const assignCategoryRows = (categoryRows: Array<Record<string, unknown>>, layoutCategory: AccountantPayrollCategory, startIndex = 0) => {
    const layout = categoryLayouts[layoutCategory]
    if (startIndex + categoryRows.length > layout.basic.length || startIndex + categoryRows.length > layout.payroll.length || startIndex + categoryRows.length > layout.bank.length) {
      const unavailableRow = categoryRows[Math.max(0, layout.basic.length - startIndex)]
      throw new Error(`The accountant template has no free ${layoutCategory.replaceAll('_', ' ')} row for ${unavailableRow?.['Employee code'] || 'an employee'}.`)
    }
    categoryRows.forEach((row, index) => assignments.set(row, {
      basic: layout.basic[startIndex + index],
      payroll: layout.payroll[startIndex + index],
      workRecord: layout.workRecord[startIndex + index],
      bank: layout.bank[startIndex + index],
      reconcile: layout.reconcile[startIndex + index],
      layoutCategory,
    }))
  }

  const pooledCategories: AccountantPayrollCategory[] = ['monthly', 'probation_monthly', 'official_hourly', 'part_time', 'probation_part_time']
  for (const category of categories.filter((category) => !pooledCategories.includes(category))) {
    const categoryRows = rows.filter((row) => categoryOf(row) === category)
    assignCategoryRows(categoryRows, category)
  }

  const probationMonthlyRows = rows.filter((row) => categoryOf(row) === 'probation_monthly')
  assignCategoryRows(probationMonthlyRows, 'probation_monthly')
  const monthlyRows = rows.filter((row) => categoryOf(row) === 'monthly')
  const standardMonthlyCapacity = categoryLayouts.monthly.basic.length
  assignCategoryRows(monthlyRows.slice(0, standardMonthlyCapacity), 'monthly')
  assignCategoryRows(monthlyRows.slice(standardMonthlyCapacity), 'probation_monthly', probationMonthlyRows.length)

  const officialHourlyRows = rows.filter((row) => categoryOf(row) === 'official_hourly')
  const partTimeRows = rows.filter((row) => categoryOf(row) === 'part_time')
  const probationPartTimeRows = rows.filter((row) => categoryOf(row) === 'probation_part_time')
  const hourlyPoolLayouts: AccountantPayrollCategory[] = ['official_hourly', 'part_time', 'probation_part_time']
  const preferredRows = new Map<AccountantPayrollCategory, Array<Record<string, unknown>>>([
    ['official_hourly', officialHourlyRows],
    ['part_time', partTimeRows],
    ['probation_part_time', probationPartTimeRows],
  ])
  const usedCounts = new Map<AccountantPayrollCategory, number>()
  const overflowRows: Array<Record<string, unknown>> = []
  for (const layoutCategory of hourlyPoolLayouts) {
    const categoryRows = preferredRows.get(layoutCategory) || []
    const capacity = categoryLayouts[layoutCategory].basic.length
    const preferred = categoryRows.slice(0, capacity)
    assignCategoryRows(preferred, layoutCategory)
    usedCounts.set(layoutCategory, preferred.length)
    overflowRows.push(...categoryRows.slice(capacity))
  }
  let overflowIndex = 0
  for (const layoutCategory of hourlyPoolLayouts) {
    const used = usedCounts.get(layoutCategory) || 0
    const free = categoryLayouts[layoutCategory].basic.length - used
    const sharedRows = overflowRows.slice(overflowIndex, overflowIndex + free)
    assignCategoryRows(sharedRows, layoutCategory, used)
    overflowIndex += sharedRows.length
  }
  if (overflowIndex < overflowRows.length) {
    throw new Error(`The accountant template has no free hourly or part-time row for ${overflowRows[overflowIndex]?.['Employee code'] || 'an employee'}.`)
  }
  return assignments
}

function probationMonthlyBandLabel(input: AccountantPayrollWorkbookInput, assignments: ReturnType<typeof assignRows>) {
  const hasMonthlyOverflow = input.payrollRows.some((row) => categoryOf(row) === 'monthly' && assignments.get(row)?.layoutCategory === 'probation_monthly')
  if (!hasMonthlyOverflow) return null
  const hasProbationEmployees = input.payrollRows.some((row) => categoryOf(row) === 'probation_monthly')
  return hasProbationEmployees
    ? 'V. Nhân viên tháng bổ sung / thử việc - Additional monthly / probation employees'
    : 'V. Nhân viên tháng bổ sung - Additional monthly employees'
}

function sharedHourlyBandLabel(input: AccountantPayrollWorkbookInput, assignments: ReturnType<typeof assignRows>, layoutCategory: AccountantPayrollCategory) {
  const hasSharedRows = input.payrollRows.some((row) => assignments.get(row)?.layoutCategory === layoutCategory && categoryOf(row) !== layoutCategory)
  if (!hasSharedRows) return null
  const labels: Partial<Record<AccountantPayrollCategory, string>> = {
    official_hourly: 'II. Nhân viên theo giờ / bán thời gian - Hourly / part-time employees',
    part_time: 'III. Nhân viên bán thời gian / theo giờ - Part-time / hourly employees',
    probation_part_time: 'VI. Nhân viên bán thời gian bổ sung / thử việc - Additional / probation part-time employees',
  }
  return labels[layoutCategory] || null
}

function updateEmployeeMaster(xml: string, input: AccountantPayrollWorkbookInput, assignments: ReturnType<typeof assignRows>) {
  for (const row of basicDataRows) {
    for (let column = 2; column <= 42; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  }
  // The reference keeps resigned staff below the live payroll roster. Those identities
  // must not leak into a newly generated period when they are not present in HR data.
  for (let row = 29; row <= 48; row += 1) {
    for (let column = 2; column <= 42; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  }
  const employeesByCode = new Map(input.employeeRows.map((row) => [stringValue(row, 'Employee code'), row]))
  for (const payroll of input.payrollRows) {
    const assignment = assignments.get(payroll)
    if (!assignment) continue
    const employee = employeesByCode.get(stringValue(payroll, 'Employee code')) || payroll
    const row = assignment.basic
    const values: Record<string, CellValue> = {
      B: assignment.sequence?.basic ?? categoryLayouts[assignment.layoutCategory].basic.indexOf(row) + 1,
      C: stringValue(employee, 'Legal name') || stringValue(payroll, 'Employee'),
      D: stringValue(employee, 'Employee code') || stringValue(payroll, 'Employee code'),
      E: stringValue(employee, 'Position'), F: stringValue(employee, 'Division') || stringValue(payroll, 'Division'),
      G: stringValue(employee, 'Phone'), H: stringValue(employee, 'Email'), I: stringValue(employee, 'Bank account') || stringValue(payroll, 'Bank account'),
      J: stringValue(employee, 'Bank') || stringValue(payroll, 'Bank'), K: stringValue(employee, 'Date of birth'), L: stringValue(employee, 'Tax code'),
      M: stringValue(employee, 'National ID'), P: stringValue(employee, 'Address'), Q: stringValue(employee, 'Address'),
      R: stringValue(employee, 'Probation start'), S: stringValue(employee, 'Probation end'), T: stringValue(employee, 'Contract start'), U: stringValue(employee, 'Contract end'),
      Y: numberValue(employee, 'Configured hourly rate (VND)') * numberValue(employee, 'Probation salary %') / 100,
      Z: numberValue(employee, 'Hourly rate (VND)') || numberValue(payroll, 'Payroll hourly rate (VND)'),
      AA: numberValue(employee, 'Monthly salary (VND)') || numberValue(payroll, 'Contract salary (VND)'),
      AB: numberValue(employee, 'Monthly salary (VND)') * numberValue(employee, 'Probation salary %') / 100,
      AC: numberValue(employee, 'Recurring monthly bonus (VND)'), AG: numberValue(employee, 'Meal / worked day (VND)'), AI: numberValue(employee, 'Dependents'),
      AO: stringValue(employee, 'Notes'),
    }
    for (const [column, value] of Object.entries(values)) xml = setCell(xml, `${column}${row}`, value)
  }
  xml = setCell(xml, 'A22', 'IV. Quản lý cửa hàng - Store manager')
  const monthlyBandLabel = probationMonthlyBandLabel(input, assignments)
  if (monthlyBandLabel) xml = setCell(xml, 'A24', monthlyBandLabel)
  const hourlyBandLabel = sharedHourlyBandLabel(input, assignments, 'official_hourly')
  const partTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'part_time')
  const probationPartTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'probation_part_time')
  if (hourlyBandLabel) xml = setCell(xml, 'A15', hourlyBandLabel)
  if (partTimeBandLabel) xml = setCell(xml, 'A19', partTimeBandLabel)
  if (probationPartTimeBandLabel) xml = setCell(xml, 'A27', probationPartTimeBandLabel)
  xml = setCell(xml, 'C3', excelSerial(input.periodEnd))
  return xml
}

function updateContractCheck(xml: string, input: AccountantPayrollWorkbookInput) {
  const employees = input.employeeRows.slice(0, 32)
  if (input.employeeRows.length > 32) throw new Error(`check contract supports 32 employees, but HR supplied ${input.employeeRows.length}.`)
  for (let row = 3; row <= 34; row += 1) {
    for (let column = 1; column <= 18; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  }
  employees.forEach((employee, index) => {
    const row = index + 3
    const probationStart = stringValue(employee, 'Probation start')
    const probationEnd = stringValue(employee, 'Probation end')
    const contractStart = stringValue(employee, 'Labor start') || stringValue(employee, 'Contract start')
    const contractEnd = stringValue(employee, 'Labor end') || stringValue(employee, 'Contract end')
    const employmentStatus = stringValue(employee, 'Employment status')
    const employmentType = stringValue(employee, 'Employment type')
    const isHourly = stringValue(employee, 'Labor payroll type') === 'hourly' || numberValue(employee, 'Hourly rate (VND)') > 0
    const values: Record<string, CellValue> = {
      A: index + 1,
      B: stringValue(employee, 'Division'),
      C: stringValue(employee, 'Employee code'),
      D: stringValue(employee, 'Legal name'),
      E: excelDateOrText(probationStart),
      F: excelDateOrText(probationEnd),
      G: probationEnd ? formula(`F${row}-TODAY()`, 0) : '',
      H: isHourly ? numberValue(employee, 'Hourly rate (VND)') * numberValue(employee, 'Probation salary %') / 100 : numberValue(employee, 'Monthly salary (VND)') * numberValue(employee, 'Probation salary %') / 100,
      I: excelDateOrText(contractStart),
      J: excelDateOrText(contractEnd),
      K: contractEnd ? formula(`J${row}-TODAY()`, 0) : '',
      L: isHourly ? numberValue(employee, 'Hourly rate (VND)') : '',
      M: numberValue(employee, 'Insurance salary base (VND)') || numberValue(employee, 'Monthly salary (VND)'),
      N: employmentStatus.toLowerCase().includes('inactive') ? excelDateOrText(stringValue(employee, 'Employment end')) : '',
      O: isHourly ? 'Hourly salary' : 'Monthly salary',
      P: [employmentStatus, employmentType].filter(Boolean).join(' · '),
      Q: '',
      R: stringValue(employee, 'Notes'),
    }
    for (const [column, value] of Object.entries(values)) xml = setCell(xml, `${column}${row}`, value)
  })
  return xml
}

function updateFreelancer(xml: string) {
  for (let row = 7; row <= 10; row += 1) {
    for (let column = 1; column <= 16; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  }
  for (const column of ['L', 'M', 'N', 'O', 'P']) xml = setCell(xml, `${column}11`, formula(`SUM(${column}7:${column}10)`, 0))
  return xml
}

function updateLeaveBalance(xml: string, input: AccountantPayrollWorkbookInput) {
  const managers = input.employeeRows.filter((employee) => {
    const role = `${stringValue(employee, 'Division')} ${stringValue(employee, 'Position')}`.toLowerCase()
    return role.includes('manager') || role.includes('quản')
  }).slice(0, 2)
  for (const row of [11, 12]) {
    for (let column = 1; column <= 10; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  }
  managers.forEach((employee, index) => {
    const row = index + 11
    xml = setCell(xml, `A${row}`, index + 1)
    xml = setCell(xml, `C${row}`, stringValue(employee, 'Legal name'))
    xml = setCell(xml, `D${row}`, excelDateOrText(stringValue(employee, 'Employment start')))
    xml = setCell(xml, `E${row}`, excelDateOrText(stringValue(employee, 'Contract start')))
    xml = setCell(xml, `F${row}`, excelDateOrText(stringValue(employee, 'Contract end')))
  })
  return xml
}

function timesheetName(payroll: Record<string, unknown>) {
  const division = `${stringValue(payroll, 'Division')} ${stringValue(payroll, 'Employee')}`.toLowerCase()
  if (division.includes('gong') || division.includes('gc')) return 'GC- timesheet' as const
  if (division.includes('quản') || division.includes('manager') || division.includes('office') || division.includes('văn phòng')) return 'Manager-timesheet' as const
  return 'VRENA-timesheet' as const
}

function updateTimesheets(entries: ZipEntries, paths: Map<string, string>, input: AccountantPayrollWorkbookInput) {
  const dates = dateRange(input.periodStart, input.periodEnd)
  const attendanceByEmployeeDate = new Map<string, Record<string, unknown>>()
  input.attendanceRows.forEach((row) => attendanceByEmployeeDate.set(`${stringValue(row, 'Employee code')}|${stringValue(row, 'Date')}`, row))
  const assignments = new Map<Record<string, unknown>, { sheet: keyof typeof timesheetLayouts; summaryRow: number }>()
  for (const sheetName of Object.keys(timesheetLayouts) as Array<keyof typeof timesheetLayouts>) {
    const target = getSheet(entries, paths, sheetName)
    let xml = target.xml
    const hasExplicitTimesheetPlacements = input.payrollRows.some((row) => Boolean((row.__accountantPlacement as AccountantPayrollPlacement | undefined)?.timesheet))
    const explicitlyPlacedEmployees = new Map<number, Record<string, unknown>>()
    if (hasExplicitTimesheetPlacements) {
      input.payrollRows.forEach((row) => {
        const placement = (row.__accountantPlacement as AccountantPayrollPlacement | undefined)?.timesheet
        if (!placement || placement.sheet !== sheetName) return
        if (explicitlyPlacedEmployees.has(placement.slot)) throw new Error(`${sheetName} slot ${placement.slot + 1} is assigned more than once.`)
        explicitlyPlacedEmployees.set(placement.slot, row)
      })
    }
    const employees = hasExplicitTimesheetPlacements
      ? [...explicitlyPlacedEmployees.values()]
      : input.payrollRows.filter((row) => !row.__accountantSkipTimesheet && timesheetName(row) === sheetName)
    const layouts = timesheetLayouts[sheetName]
    if (employees.length > layouts.length) throw new Error(`${sheetName} has ${employees.length} employees but the accountant template supports ${layouts.length}.`)
    layouts.forEach((layout, index) => {
      const payroll = hasExplicitTimesheetPlacements ? explicitlyPlacedEmployees.get(index) : employees[index]
      const hasThirtyFirstDay = xml.includes(`r="AH${layout.summary}"`)
      const dayCapacity = hasThirtyFirstDay ? 31 : 30
      const totalColumn = hasThirtyFirstDay ? 'AH' : 'AG'
      if (payroll && dates.length > dayCapacity) {
        throw new Error(`${sheetName} employee slot ${index + 1} supports ${dayCapacity} days, but ${input.periodStart} - ${input.periodEnd} has ${dates.length}.`)
      }
      const code = payroll ? stringValue(payroll, 'Employee code') : ''
      const name = payroll ? stringValue(payroll, 'Employee') : ''
      xml = setCell(xml, `C${layout.name}`, name)
      xml = setCell(xml, `G${layout.name}`, payroll && ['monthly', 'manager', 'probation_monthly'].includes(categoryOf(payroll)) ? 'FULLTIME' : payroll ? 'PARTTIME' : '')
      for (let dayIndex = 0; dayIndex < dayCapacity; dayIndex += 1) {
        const column = columnName(dayIndex + 3)
        const date = dates[dayIndex]
        const attendance = date && payroll ? attendanceByEmployeeDate.get(`${code}|${date}`) : undefined
        const workedFraction = attendance ? numberValue(attendance, 'Worked hours') / 24 : 0
        const breakFraction = attendance ? numberValue(attendance, 'Break minutes') / 1_440 : 0
        const overtimeFraction = attendance ? numberValue(attendance, 'Overtime hours') / 24 : 0
        const nightFraction = attendance ? numberValue(attendance, 'Night hours') / 24 : 0
        const holidayFraction = attendance ? numberValue(attendance, 'Holiday hours') / 24 : 0
        const regularFraction = Math.max(0, workedFraction - overtimeFraction - nightFraction - holidayFraction)
        xml = setCell(xml, `${column}${layout.date}`, date ? excelSerial(date) : '')
        const weekday = date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : ''
        xml = setCell(xml, `${column}${layout.day}`, date ? formula(`TEXT(${column}${layout.date},"dddd")`, weekday) : '')
        xml = setCell(xml, `${column}${layout.marker}`, '')
        xml = setCell(xml, `${column}${layout.timeIn}`, attendance ? timeFraction(stringValue(attendance, 'Clock in')) : '')
        xml = setCell(xml, `${column}${layout.timeOut}`, attendance ? timeFraction(stringValue(attendance, 'Clock out')) : '')
        xml = setCell(xml, `${column}${layout.break}`, attendance ? breakFraction : 0)
        xml = setCell(xml, `${column}${layout.ot}`, overtimeFraction)
        if (payroll) {
          xml = setCell(xml, `${column}${layout.total}`, formula(`${column}${layout.timeOut}-${column}${layout.timeIn}`, workedFraction + breakFraction))
          xml = setCell(xml, `${column}${layout.net}`, formula(`MAX(0,${column}${layout.total}-${column}${layout.break})`, workedFraction))
          xml = setCell(xml, `${column}${layout.summary}`, formula(`MAX(0,${column}${layout.net}-${column}${layout.ot}-${nightFraction}-${holidayFraction})`, regularFraction))
          xml = setCell(xml, `${column}${layout.summary + 1}`, formula(`${column}${layout.ot}`, overtimeFraction))
          xml = setCell(xml, `${column}${layout.summary + 2}`, formula(`0+${nightFraction}`, nightFraction))
          xml = setCell(xml, `${column}${layout.summary + 3}`, formula(`0+${holidayFraction}`, holidayFraction))
        }
      }
      for (let summaryOffset = 0; summaryOffset < 4; summaryOffset += 1) {
        xml = setCell(xml, `A${layout.summary + summaryOffset}`, name)
        xml = setCell(xml, `B${layout.summary + summaryOffset}`, payroll ? [1, 1.5, 2, 3][summaryOffset] : '')
        if (payroll) xml = setCell(xml, `${totalColumn}${layout.summary + summaryOffset}`, formula(`SUM(C${layout.summary + summaryOffset}:${columnName(dayCapacity + 2)}${layout.summary + summaryOffset})`, dates.reduce((sum, date) => {
          const attendance = attendanceByEmployeeDate.get(`${code}|${date}`)
          if (!attendance) return sum
          if (summaryOffset === 1) return sum + numberValue(attendance, 'Overtime hours') / 24
          if (summaryOffset === 2) return sum + numberValue(attendance, 'Night hours') / 24
          if (summaryOffset === 3) return sum + numberValue(attendance, 'Holiday hours') / 24
          return sum + Math.max(0, numberValue(attendance, 'Worked hours') - numberValue(attendance, 'Overtime hours') - numberValue(attendance, 'Night hours') - numberValue(attendance, 'Holiday hours')) / 24
        }, 0)))
      }
      if (payroll) assignments.set(payroll, { sheet: sheetName, summaryRow: layout.summary })
    })
    saveSheet(entries, target.path, xml)
  }
  return assignments
}

function updateWorkRecord(xml: string, input: AccountantPayrollWorkbookInput, assignments: ReturnType<typeof assignRows>, timesheetAssignments: ReturnType<typeof updateTimesheets>) {
  const dates = dateRange(input.periodStart, input.periodEnd)
  for (const row of workRecordDataRows) {
    for (let column = 1; column <= 41; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  }
  for (const row of [11, 12]) {
    xml = setCell(xml, `B${row}`, '')
    xml = setCell(xml, `C${row}`, '')
  }
  for (let dayIndex = 0; dayIndex < 31; dayIndex += 1) {
    const column = columnName(dayIndex + 4)
    const date = dates[dayIndex]
    xml = setCell(xml, `${column}8`, date ? excelSerial(date) : '')
    xml = setCell(xml, `${column}9`, date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) : '')
  }
  xml = setCell(xml, 'A5', `BẢNG CHẤM CÔNG - WORKING RECORD ${input.periodStart} - ${input.periodEnd}`)
  xml = setCell(xml, 'A27', 'IV. Quản lý cửa hàng - Store manager')
  input.payrollRows.forEach((payroll) => {
    const assignment = assignments.get(payroll)
    const timesheet = timesheetAssignments.get(payroll)
    if (!assignment || !timesheet || assignment.workRecord == null) return
    const row = assignment.workRecord
    xml = setCell(xml, `A${row}`, assignment.sequence?.workRecord ?? categoryLayouts[assignment.layoutCategory].workRecord.indexOf(row) + 1)
    xml = setCell(xml, `B${row}`, stringValue(payroll, 'Employee'))
    xml = setCell(xml, `C${row}`, stringValue(payroll, 'Employee code'))
    for (let dayIndex = 0; dayIndex < 31; dayIndex += 1) {
      const column = columnName(dayIndex + 4)
      const sourceColumn = columnName(dayIndex + 3)
      const attendance = input.attendanceRows.find((item) => stringValue(item, 'Employee code') === stringValue(payroll, 'Employee code') && stringValue(item, 'Date') === dates[dayIndex])
      xml = setCell(xml, `${column}${row}`, formula(`'${timesheet.sheet}'!${sourceColumn}${timesheet.summaryRow}`, attendance ? numberValue(attendance, 'Worked hours') / 24 : 0))
    }
    xml = setCell(xml, `AJ${row}`, formula(`SUM(D${row}:AH${row})`, numberValue(payroll, 'Worked hours') / 24))
    xml = setCell(xml, `AK${row}`, formula(`'${timesheet.sheet}'!AH${timesheet.summaryRow + 1}`, numberValue(payroll, 'Overtime hours') / 24))
    xml = setCell(xml, `AL${row}`, formula(`'${timesheet.sheet}'!AH${timesheet.summaryRow + 2}`, numberValue(payroll, 'Night hours') / 24))
    xml = setCell(xml, `AM${row}`, formula(`'${timesheet.sheet}'!AH${timesheet.summaryRow + 3}`, numberValue(payroll, 'Holiday hours') / 24))
    xml = setCell(xml, `AN${row}`, formula(`COUNTIF(D${row}:AH${row},">0")`, numberValue(payroll, 'Worked days')))
  })
  xml = setCell(xml, 'A20', 'II. Nhân viên chính thức lương giờ - Hourly salary')
  const monthlyBandLabel = probationMonthlyBandLabel(input, assignments)
  if (monthlyBandLabel) xml = setCell(xml, 'A29', monthlyBandLabel)
  const hourlyBandLabel = sharedHourlyBandLabel(input, assignments, 'official_hourly')
  const partTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'part_time')
  const probationPartTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'probation_part_time')
  if (hourlyBandLabel) xml = setCell(xml, 'A20', hourlyBandLabel)
  if (partTimeBandLabel) xml = setCell(xml, 'A24', partTimeBandLabel)
  if (probationPartTimeBandLabel) xml = setCell(xml, 'A32', probationPartTimeBandLabel)
  return xml
}

function updatePayroll(xml: string, input: AccountantPayrollWorkbookInput, assignments: ReturnType<typeof assignRows>) {
  const employeesByCode = new Map(input.employeeRows.map((row) => [stringValue(row, 'Employee code'), row]))
  const totalResults = new Map<string, number>()
  for (const row of payrollDataRows) {
    for (let column = 1; column <= 48; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  }
  for (const payroll of input.payrollRows) {
    const assignment = assignments.get(payroll)
    if (!assignment) continue
    const employee = employeesByCode.get(stringValue(payroll, 'Employee code')) || payroll
    const row = assignment.payroll
    const basicRow = assignment.basic
    const workRow = assignment.workRecord
    const categoryIndex = categoryLayouts[assignment.layoutCategory].payroll.indexOf(row) + 1
    const workedHours = numberValue(payroll, 'Worked hours')
    const overtimeHours = numberValue(payroll, 'Overtime hours')
    const nightHours = numberValue(payroll, 'Night hours')
    const holidayHours = numberValue(payroll, 'Holiday hours')
    const employeeInsurance = numberValue(payroll, 'Employee insurance (VND)')
    const employerInsurance = numberValue(payroll, 'Employer insurance (VND)')
    const contributionBase = numberValue(payroll, 'Insurance base (VND)')
    const employeeInsuranceRate = numberValue(payroll, 'Employee insurance %') || (contributionBase > 0 ? employeeInsurance / contributionBase * 100 : 0)
    const employerRate = numberValue(payroll, 'Employer insurance %') || (contributionBase > 0 ? employerInsurance / contributionBase * 100 : 0)
    const tradeUnionRate = Math.max(0, employerRate - 21.5)
    const personalDeduction = numberValue(input.calculationBasisRows.find((item) => item.Setting === 'PIT self deduction (VND)') || {}, 'Value') || 15_500_000
    const dependentDeduction = numberValue(input.calculationBasisRows.find((item) => item.Setting === 'PIT dependent deduction (VND)') || {}, 'Value') || 6_200_000
    const dependents = numberValue(payroll, 'Dependents') || numberValue(employee, 'Dependents')
    const pitRate = numberValue(payroll, 'PIT rate %')
    const basePay = numberValue(payroll, 'Base pay (VND)')
    const mealAllowance = numberValue(payroll, 'Meal allowance (VND)')
    const gross = numberValue(payroll, 'Gross income (VND)')
    const taxable = numberValue(payroll, 'Taxable income (VND)') || Math.max(0, gross - mealAllowance)
    const historicalSource = Boolean(payroll.__accountantHistoricalSource)
    const historicalNonTaxableIncome = Math.max(0, gross - taxable)
    const assessable = Math.max(0, taxable - employeeInsurance - personalDeduction - dependents * dependentDeduction)
    const pit = numberValue(payroll, 'PIT withheld (VND)')
    const adjustments = bankAdjustmentValue(payroll)
    const netBeforeAdjustment = netBeforeAdjustmentValue(payroll)
    const bankTransfer = bankTransferValue(payroll)
    const probation = probationAppliesToPayroll(payroll)
    const values: Record<string, CellValue> = {
      A: assignment.sequence?.payroll ?? categoryIndex, B: formula(`'Basic'!D${basicRow}`, stringValue(payroll, 'Employee code')), C: formula(`'Basic'!C${basicRow}`, stringValue(payroll, 'Employee')),
      D: formula(`IFERROR('Basic'!U${basicRow}-$C$3,0)`, 0), E: formula(`'Basic'!E${basicRow}`, stringValue(employee, 'Position')),
      F: numberValue(payroll, 'Salary-paid days'), G: numberValue(payroll, 'Paid leave days'), H: numberValue(payroll, 'Period standard days'),
      I: probation ? Math.max(0, workedHours - overtimeHours) / 24 : 0,
      J: probation ? 0 : Math.max(0, workedHours - overtimeHours) / 24,
      K: (workedHours - overtimeHours) / 24, L: contributionBase, M: formula(`'Basic'!F${basicRow}`, stringValue(payroll, 'Division')),
      N: formula(`ROUND(IF('Basic'!AA${basicRow}>0,'Basic'!AA${basicRow}*MIN(1,F${row}/MAX(1,H${row})),K${row}*24*Y${row}),0)`, basePay),
      P: numberValue(payroll, 'Other allowances (VND)'), Q: 0, R: 0,
      S: formula(`${numberValue(payroll, 'Meal days')}*${numberValue(employee, 'Meal / worked day (VND)') || (numberValue(payroll, 'Meal days') > 0 ? mealAllowance / numberValue(payroll, 'Meal days') : 0)}`, mealAllowance),
      T: 0,
      U: historicalSource ? formula(`${overtimeHours}/24`, overtimeHours / 24) : workRow == null ? 0 : formula(`'Work record 100%'!AK${workRow}`, overtimeHours / 24),
      V: historicalSource ? formula(`${nightHours}/24`, nightHours / 24) : workRow == null ? 0 : formula(`'Work record 100%'!AL${workRow}`, nightHours / 24),
      W: historicalSource ? formula(`${holidayHours}/24`, holidayHours / 24) : workRow == null ? 0 : formula(`'Work record 100%'!AM${workRow}`, holidayHours / 24),
      X: probation ? numberValue(payroll, 'Payroll hourly rate (VND)') : 0, Y: numberValue(payroll, 'Payroll hourly rate (VND)'),
      Z: numberValue(payroll, 'Bonuses (VND)'), AA: 0, AB: numberValue(payroll, 'Recurring monthly bonus (VND)'),
      AC: formula(`ROUND(N${row}+SUM(P${row}:T${row})+Z${row}-AA${row}+AB${row}+(U${row}*150%+V${row}*200%+W${row}*300%)*24*Y${row},0)`, gross),
      AD: formula(historicalSource
        ? `MAX(0,AC${row}-${Math.round(historicalNonTaxableIncome)})`
        : `MAX(0,AC${row}-S${row}-(U${row}*150%+V${row}*200%+W${row}*300%)*24*Y${row})`, taxable),
      AE: formula(`MAX(0,AD${row}-SUM(AG${row}:AI${row})-AN${row}-AO${row})`, assessable),
      AF: formula(pitRate > 0
        ? historicalSource
          ? `ROUND(AD${row}*${pitRate}%,0)`
          : `ROUND(MAX(0,AD${row}-SUM(AG${row}:AI${row}))*${pitRate}%,0)`
        : `ROUND(IF(AE${row}<=10000000,AE${row}*5%,IF(AE${row}<=30000000,AE${row}*10%-500000,IF(AE${row}<=60000000,AE${row}*20%-3500000,IF(AE${row}<=100000000,AE${row}*30%-9500000,AE${row}*35%-14500000)))),0)`, pit),
      AG: historicalSource && Math.abs(employeeInsuranceRate - 10.5) > 0.001
        ? formula(`ROUND(L${row}*${employeeInsuranceRate}%,0)`, employeeInsurance)
        : formula(`ROUND(L${row}*8%,0)`, Math.round(employeeInsurance * 8 / 10.5)),
      AH: historicalSource && Math.abs(employeeInsuranceRate - 10.5) > 0.001
        ? formula('0', 0)
        : formula(`ROUND(L${row}*1.5%,0)`, Math.round(employeeInsurance * 1.5 / 10.5)),
      AI: historicalSource && Math.abs(employeeInsuranceRate - 10.5) > 0.001
        ? formula('0', 0)
        : formula(`ROUND(L${row}*1%,0)`, employeeInsurance - Math.round(employeeInsurance * 8 / 10.5) - Math.round(employeeInsurance * 1.5 / 10.5)),
      AJ: formula(`ROUND(L${row}*17.5%,0)`, Math.round(contributionBase * 17.5 / 100)),
      AK: formula(`ROUND(L${row}*3%,0)`, Math.round(contributionBase * 3 / 100)),
      AL: formula(`ROUND(L${row}*1%,0)`, Math.round(contributionBase * 1 / 100)),
      AM: formula(`ROUND(L${row}*${tradeUnionRate}%,0)`, Math.max(0, employerInsurance - Math.round(contributionBase * 17.5 / 100) - Math.round(contributionBase * 3 / 100) - Math.round(contributionBase * 1 / 100))),
      AN: personalDeduction, AO: dependents * dependentDeduction, AP: 0,
      AQ: formula(`MAX(0,AC${row}-${employeeInsuranceDeductionFormula(payroll, row)}-AF${row}-AP${row})`, netBeforeAdjustment), AR: adjustments,
      AS: formula(`MAX(0,AQ${row}+AR${row})`, bankTransfer), AT: formula(`AS${row}`, bankTransfer), AU: formula(`AT${row}-AS${row}`, 0), AV: stringValue(payroll, 'Notes'),
    }
    for (const [column, value] of Object.entries(values)) {
      xml = setCell(xml, `${column}${row}`, value)
      const numericValue = Number(unwrap(value))
      if (Number.isFinite(numericValue) && numericValue !== 0) {
        totalResults.set(column, (totalResults.get(column) || 0) + numericValue)
      }
    }
  }
  xml = setCell(xml, 'A24', 'IV. Quản lý cửa hàng - Store manager')
  const monthlyBandLabel = probationMonthlyBandLabel(input, assignments)
  if (monthlyBandLabel) xml = setCell(xml, 'A26', monthlyBandLabel)
  const hourlyBandLabel = sharedHourlyBandLabel(input, assignments, 'official_hourly')
  const partTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'part_time')
  const probationPartTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'probation_part_time')
  if (hourlyBandLabel) xml = setCell(xml, 'A17', hourlyBandLabel)
  if (partTimeBandLabel) xml = setCell(xml, 'A21', partTimeBandLabel)
  if (probationPartTimeBandLabel) xml = setCell(xml, 'A29', probationPartTimeBandLabel)
  xml = setCell(xml, 'C3', excelSerial(input.periodEnd))
  for (let column = 6; column <= 47; column += 1) {
    const name = columnName(column)
    xml = setCell(xml, `${name}31`, formula(`SUM(${name}10:${name}30)`, totalResults.get(name) || 0))
  }
  return xml
}

function updateBank(xml: string, input: AccountantPayrollWorkbookInput, assignments: ReturnType<typeof assignRows>) {
  for (const row of bankDataRows) for (let column = 1; column <= 6; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  input.payrollRows.forEach((payroll) => {
    const assignment = assignments.get(payroll)
    if (!assignment || assignment.bank == null) return
    const row = assignment.bank
    xml = setCell(xml, `A${row}`, assignment.sequence?.bank ?? categoryLayouts[assignment.layoutCategory].bank.indexOf(row) + 1)
    xml = setCell(xml, `B${row}`, stringValue(payroll, 'Employee'))
    xml = setCell(xml, `C${row}`, formula(`'Full time'!AS${assignment.payroll}`, bankTransferValue(payroll)))
    xml = setCell(xml, `D${row}`, stringValue(payroll, 'Bank account'))
    xml = setCell(xml, `E${row}`, stringValue(payroll, 'Bank'))
    xml = setCell(xml, `F${row}`, stringValue(payroll, 'Notes'))
  })
  xml = setCell(xml, 'A15', 'II. Nhân viên chính thức lương giờ - Part-time')
  xml = setCell(xml, 'A22', 'IV. Quản lý cửa hàng - Store manager')
  const monthlyBandLabel = probationMonthlyBandLabel(input, assignments)
  if (monthlyBandLabel) xml = setCell(xml, 'A24', monthlyBandLabel)
  const hourlyBandLabel = sharedHourlyBandLabel(input, assignments, 'official_hourly')
  const partTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'part_time')
  const probationPartTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'probation_part_time')
  if (hourlyBandLabel) xml = setCell(xml, 'A15', hourlyBandLabel)
  if (partTimeBandLabel) xml = setCell(xml, 'A19', partTimeBandLabel)
  if (probationPartTimeBandLabel) xml = setCell(xml, 'A27', probationPartTimeBandLabel)
  xml = setCell(xml, 'A3', excelSerial(input.periodEnd))
  xml = setCell(xml, 'C29', formula('SUM(C9:C28)', input.payrollRows.reduce((sum, row) => sum + bankTransferValue(row), 0)))
  return xml
}

function updateSummary(xml: string, input: AccountantPayrollWorkbookInput) {
  const divisions = Array.from(new Set(input.payrollRows.map((row) => stringValue(row, 'Division') || 'Unassigned'))).slice(0, 4)
  for (let index = 0; index < 4; index += 1) {
    const row = index + 9
    const division = divisions[index] || ''
    xml = setCell(xml, `B${row}`, division)
    const formulaColumns: Array<[string, string]> = [
      ['C', `COUNTIF('Full time'!$M$10:$M$30,B${row})`], ['D', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$N$10:$N$30)`],
      ['H', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AC$10:$AC$30)`], ['I', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AE$10:$AE$30)`],
      ['J', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AG$10:$AG$30)`], ['K', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AH$10:$AH$30)`],
      ['L', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AI$10:$AI$30)`], ['M', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AF$10:$AF$30)`],
      ['N', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AQ$10:$AQ$30)`], ['O', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AJ$10:$AJ$30)`],
      ['P', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AK$10:$AK$30)`], ['Q', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AL$10:$AL$30)`],
      ['R', `SUMIF('Full time'!$M$10:$M$30,B${row},'Full time'!$AM$10:$AM$30)`], ['S', `H${row}+SUM(O${row}:R${row})`],
    ]
    for (const column of ['E', 'F', 'G']) xml = setCell(xml, `${column}${row}`, 0)
    for (const [column, formulaText] of formulaColumns) xml = setCell(xml, `${column}${row}`, division ? formula(formulaText, 0) : '')
  }
  for (let column = 3; column <= 19; column += 1) {
    const name = columnName(column)
    xml = setCell(xml, `${name}13`, formula(`SUM(${name}9:${name}12)`, 0))
  }
  xml = setCell(xml, 'D6', formula(`D13-'Full time'!N31`, 0))
  xml = setCell(xml, 'H6', formula(`H13-'Full time'!AC31`, 0))
  return xml
}

function updatePayslip(xml: string, input: AccountantPayrollWorkbookInput, assignments: ReturnType<typeof assignRows>, payroll: Record<string, unknown> | undefined) {
  if (!payroll) return xml
  const assignment = assignments.get(payroll)
  if (!assignment) return xml
  const row = assignment.payroll
  const cells: Record<string, CellValue> = {
    B5: excelSerial(input.periodEnd), D7: formula(`'Full time'!C${row}`, stringValue(payroll, 'Employee')), D8: formula(`'Full time'!B${row}`, stringValue(payroll, 'Employee code')),
    D9: formula(`'Full time'!E${row}`, ''), D10: formula(`'Full time'!F${row}`, numberValue(payroll, 'Salary-paid days')), D11: formula(`'Full time'!K${row}*24`, numberValue(payroll, 'Salary-paid hours')),
    D15: formula(`'Full time'!AC${row}`, numberValue(payroll, 'Gross income (VND)')), D16: formula(`'Full time'!X${row}`, numberValue(payroll, 'Payroll hourly rate (VND)')), D17: formula(`'Full time'!Y${row}`, numberValue(payroll, 'Payroll hourly rate (VND)')),
    D18: formula(`'Full time'!S${row}`, numberValue(payroll, 'Meal allowance (VND)')), D19: formula(`'Full time'!Z${row}`, numberValue(payroll, 'Bonuses (VND)')), D20: formula(`'Full time'!U${row}*24`, numberValue(payroll, 'Overtime hours')),
    D21: formula(`'Full time'!V${row}*24`, numberValue(payroll, 'Night hours')), D22: formula(`'Full time'!W${row}*24`, numberValue(payroll, 'Holiday hours')), D23: formula(`SUM('Full time'!AJ${row}:AM${row})`, numberValue(payroll, 'Employer insurance (VND)')),
    D24: formula(`'Full time'!AJ${row}`, 0), D25: formula(`'Full time'!AK${row}`, 0), D26: formula(`'Full time'!AL${row}`, 0), D27: formula(`SUM('Full time'!AG${row}:AI${row})`, numberValue(payroll, 'Employee insurance (VND)')),
    D28: formula(`'Full time'!AG${row}`, 0), D29: formula(`'Full time'!AH${row}`, 0), D30: formula(`'Full time'!AI${row}`, 0), D31: formula(`SUM('Full time'!AN${row}:AO${row})`, 0),
    D32: formula(`'Full time'!AN${row}`, 0), D33: formula(`'Full time'!AO${row}`, 0), D34: formula(`'Full time'!AF${row}`, numberValue(payroll, 'PIT withheld (VND)')), D35: formula(`'Full time'!AE${row}`, 0),
    D36: formula(`'Full time'!AS${row}`, bankTransferValue(payroll)), D37: formula(`'Full time'!AC${row}+SUM('Full time'!AJ${row}:AM${row})`, numberValue(payroll, 'Company cost (VND)')),
  }
  for (const [reference, value] of Object.entries(cells)) xml = setCell(xml, reference, value)
  return xml
}

function updateReconcile(xml: string, input: AccountantPayrollWorkbookInput, assignments: ReturnType<typeof assignRows>) {
  for (const row of reconcileDataRows) for (let column = 1; column <= 48; column += 1) xml = setCell(xml, `${columnName(column)}${row}`, '')
  input.payrollRows.forEach((payroll) => {
    const assignment = assignments.get(payroll)
    if (!assignment || assignment.reconcile == null) return
    const row = assignment.reconcile
    xml = setCell(xml, `A${row}`, assignment.sequence?.reconcile ?? categoryLayouts[assignment.layoutCategory].reconcile.indexOf(row) + 1)
    xml = setCell(xml, `B${row}`, stringValue(payroll, 'Employee code'))
    for (let column = 3; column <= 45; column += 1) {
      const name = columnName(column)
      xml = setCell(xml, `${name}${row}`, formula(`IFERROR(VLOOKUP(B${row},'Full time'!$B$10:$AS$30,${column - 1},FALSE),0)`, column === 3 ? stringValue(payroll, 'Employee') : 0))
    }
    xml = setCell(xml, `AT${row}`, formula(`AS${row}`, bankTransferValue(payroll)))
    xml = setCell(xml, `AU${row}`, formula(`AT${row}-AS${row}`, 0))
    xml = setCell(xml, `AV${row}`, stringValue(payroll, 'Notes'))
  })
  xml = setCell(xml, 'A16', 'II. Nhân viên chính thức lương giờ - Hourly salary')
  xml = setCell(xml, 'A25', 'IV. Quản lý cửa hàng - Store manager')
  const monthlyBandLabel = probationMonthlyBandLabel(input, assignments)
  if (monthlyBandLabel) xml = setCell(xml, 'A28', monthlyBandLabel)
  const hourlyBandLabel = sharedHourlyBandLabel(input, assignments, 'official_hourly')
  const partTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'part_time')
  const probationPartTimeBandLabel = sharedHourlyBandLabel(input, assignments, 'probation_part_time')
  if (hourlyBandLabel) xml = setCell(xml, 'A16', hourlyBandLabel)
  if (partTimeBandLabel) xml = setCell(xml, 'A22', partTimeBandLabel)
  if (probationPartTimeBandLabel) xml = setCell(xml, 'A34', probationPartTimeBandLabel)
  xml = setCell(xml, 'C3', excelSerial(input.periodEnd))
  for (let column = 6; column <= 47; column += 1) {
    const name = columnName(column)
    xml = setCell(xml, `${name}37`, formula(`SUM(${name}10:${name}36)`, 0))
  }
  return xml
}

export function buildAccountantPayrollWorkbook(templateBytes: Uint8Array, input: AccountantPayrollWorkbookInput) {
  const entries = unzipSync(templateBytes)
  const paths = sheetPaths(entries)
  const assignments = assignRows(input.payrollRows)

  const timesheetAssignments = updateTimesheets(entries, paths, input)
  for (const [name, updater] of [
    ['Basic', (xml: string) => updateEmployeeMaster(xml, input, assignments)],
    ['check contract', (xml: string) => updateContractCheck(xml, input)],
    ['Work record 100%', (xml: string) => updateWorkRecord(xml, input, assignments, timesheetAssignments)],
    ['Full time', (xml: string) => updatePayroll(xml, input, assignments)],
    ['Freelancer', (xml: string) => updateFreelancer(xml)],
    ['Bank account ', (xml: string) => updateBank(xml, input, assignments)],
    ['Summary', (xml: string) => updateSummary(xml, input)],
    ['PaySlip-h', (xml: string) => updatePayslip(xml, input, assignments, input.payrollRows.find((row) => ['official_hourly', 'part_time', 'probation_part_time'].includes(categoryOf(row))))],
    ['PaySlip-D', (xml: string) => updatePayslip(xml, input, assignments, input.payrollRows.find((row) => ['monthly', 'manager', 'probation_monthly'].includes(categoryOf(row))))],
    ['Reconcile', (xml: string) => updateReconcile(xml, input, assignments)],
    ['Leave balance', (xml: string) => updateLeaveBalance(xml, input)],
  ] as const) {
    const target = getSheet(entries, paths, name)
    saveSheet(entries, target.path, updater(target.xml))
  }

  const workbookPath = 'xl/workbook.xml'
  let workbookXml = strFromU8(entries[workbookPath])
  workbookXml = workbookXml.replace(/<calcPr\b[^>]*\/>/, '<calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>')
  entries[workbookPath] = strToU8(workbookXml)
  delete entries['xl/calcChain.xml']
  return zipSync(entries, { level: 6 })
}
