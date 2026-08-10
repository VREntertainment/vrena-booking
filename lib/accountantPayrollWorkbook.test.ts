import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { strFromU8, unzipSync } from 'fflate'
import { buildAccountantPayrollWorkbook } from './accountantPayrollWorkbook.ts'

const templatePath = new URL('../public/templates/vr-payroll-accountant-template.xlsx', import.meta.url)

function worksheetByName(entries: Record<string, Uint8Array>, name: string) {
  const workbook = strFromU8(entries['xl/workbook.xml'])
  const rels = strFromU8(entries['xl/_rels/workbook.xml.rels'])
  const relationship = workbook.match(new RegExp(`<sheet[^>]*name="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*r:id="([^"]+)"`))?.[1]
  assert.ok(relationship, `${name} relationship exists`)
  const target = rels.match(new RegExp(`<Relationship[^>]*Id="${relationship}"[^>]*Target="([^"]+)"`))?.[1]
  assert.ok(target, `${name} target exists`)
  return strFromU8(entries[`xl/${target}`])
}

test('builds the accountant workbook from the exact 19-tab template with live formulas', () => {
  const templateBytes = new Uint8Array(fs.readFileSync(templatePath))
  const templateEntries = unzipSync(templateBytes)
  const monthlyCapacityRows = Array.from({ length: 5 }, (_, index) => ({
    __accountantCategory: 'monthly', __accountantProbation: false, 'Employee code': `NV10${index + 5}`, Employee: `MONTHLY CAPACITY ${index + 1}`, Division: 'Vrena', Bank: 'MB Bank', 'Bank account': `9900000${index}`,
    'Salary-paid days': 0, 'Paid leave days': 0, 'Period standard days': 26, 'Worked hours': 0, 'Worked days': 0, 'Meal days': 0,
    'Salary-paid hours': 0, 'Overtime hours': 0, 'Night hours': 0, 'Holiday hours': 0, 'Payroll hourly rate (VND)': 0,
    'Base pay (VND)': 0, 'Meal allowance (VND)': 0, 'Other allowances (VND)': 0, 'Bonuses (VND)': 0,
    'Gross income (VND)': 0, 'Insurance base (VND)': 0, 'Employee insurance (VND)': 0,
    'PIT withheld (VND)': 0, 'Net payable (VND)': 0, 'Employer insurance (VND)': 0, 'Company cost (VND)': 0,
    'Advances (VND)': 0, 'Deductions (VND)': 0, Dependents: 0, Notes: '',
  }))
  const payrollRows = [
    {
      __accountantCategory: 'monthly', 'Employee code': 'NV101', Employee: 'MONTHLY EMPLOYEE', Division: 'Vrena', Bank: 'MB Bank', 'Bank account': '00112233',
      'Salary-paid days': 25, 'Paid leave days': 1, 'Period standard days': 26, 'Worked hours': 156, 'Worked days': 24, 'Meal days': 24,
      'Salary-paid hours': 162.5, 'Overtime hours': 2, 'Night hours': 0, 'Holiday hours': 0, 'Payroll hourly rate (VND)': 40000,
      'Base pay (VND)': 9_615_385, 'Meal allowance (VND)': 840_000, 'Other allowances (VND)': 0, 'Bonuses (VND)': 200_000,
      'Gross income (VND)': 10_775_385, 'Insurance base (VND)': 10_000_000, 'Employee insurance (VND)': 1_050_000,
      'PIT withheld (VND)': 0, 'Net payable (VND)': 9_725_385, 'Employer insurance (VND)': 2_350_000, 'Company cost (VND)': 13_125_385,
      'Advances (VND)': 0, 'Deductions (VND)': 0, Dependents: 0, Notes: '',
    },
    {
      __accountantCategory: 'official_hourly', 'Employee code': 'NV102', Employee: 'HOURLY EMPLOYEE', Division: 'Gongcha', Bank: 'Vietcombank', 'Bank account': '44556677',
      'Salary-paid days': 20, 'Paid leave days': 0, 'Period standard days': 26, 'Worked hours': 120, 'Worked days': 20, 'Meal days': 20,
      'Salary-paid hours': 120, 'Overtime hours': 3, 'Night hours': 1, 'Holiday hours': 0, 'Payroll hourly rate (VND)': 30_000,
      'Base pay (VND)': 3_600_000, 'Meal allowance (VND)': 700_000, 'Other allowances (VND)': 0, 'Bonuses (VND)': 0,
      'Gross income (VND)': 4_495_000, 'Insurance base (VND)': 0, 'Employee insurance (VND)': 0,
      'PIT withheld (VND)': 0, 'Net payable (VND)': 4_495_000, 'Employer insurance (VND)': 0, 'Company cost (VND)': 4_495_000,
      'Advances (VND)': 0, 'Deductions (VND)': 0, Dependents: 0, Notes: '',
    },
    {
      __accountantCategory: 'probation_monthly', __accountantProbation: true, 'Employee code': 'NV103', Employee: 'PROBATION EMPLOYEE', Division: 'Office', Bank: 'TPBank', 'Bank account': '88990011',
      'Salary-paid days': 15, 'Paid leave days': 0, 'Period standard days': 26, 'Worked hours': 90, 'Worked days': 15, 'Meal days': 15,
      'Salary-paid hours': 90, 'Overtime hours': 0, 'Night hours': 0, 'Holiday hours': 0, 'Payroll hourly rate (VND)': 25_000,
      'Base pay (VND)': 2_700_000, 'Meal allowance (VND)': 525_000, 'Other allowances (VND)': 0, 'Bonuses (VND)': 0,
      'Gross income (VND)': 3_225_000, 'Insurance base (VND)': 0, 'Employee insurance (VND)': 0,
      'PIT withheld (VND)': 0, 'Net payable (VND)': 3_225_000, 'Employer insurance (VND)': 0, 'Company cost (VND)': 3_225_000,
      'Advances (VND)': 0, 'Deductions (VND)': 0, Dependents: 0, Notes: '',
    },
    {
      __accountantCategory: 'manager', __accountantProbation: false, 'Employee code': 'NV104', Employee: 'STORE MANAGER', Division: 'Office', Bank: 'ACB', 'Bank account': '22334455',
      'Salary-paid days': 26, 'Paid leave days': 0, 'Period standard days': 26, 'Worked hours': 169, 'Worked days': 26, 'Meal days': 26,
      'Salary-paid hours': 169, 'Overtime hours': 0, 'Night hours': 0, 'Holiday hours': 0, 'Payroll hourly rate (VND)': 50_000,
      'Base pay (VND)': 13_000_000, 'Meal allowance (VND)': 910_000, 'Other allowances (VND)': 0, 'Bonuses (VND)': 0,
      'Gross income (VND)': 13_910_000, 'Insurance base (VND)': 13_000_000, 'Employee insurance (VND)': 1_365_000,
      'PIT withheld (VND)': 0, 'Net payable (VND)': 12_545_000, 'Employer insurance (VND)': 3_055_000, 'Company cost (VND)': 16_965_000,
      'Advances (VND)': 0, 'Deductions (VND)': 0, Dependents: 0, Notes: '',
    },
    ...monthlyCapacityRows,
  ]
  const employeeRows = payrollRows.map((row) => ({
    ...row, 'Legal name': row.Employee, Position: 'Staff', Phone: '0900000000', Email: 'payroll@example.com',
    'Date of birth': '2000-01-01', 'Tax code': '', 'National ID': '079000000000', Address: 'Ho Chi Minh City',
    'Contract start': '2026-01-01', 'Contract end': '2027-01-01', 'Monthly salary (VND)': row['Base pay (VND)'],
    'Hourly rate (VND)': row['Payroll hourly rate (VND)'], 'Recurring monthly bonus (VND)': 0, 'Meal / worked day (VND)': 35_000,
    'Probation salary %': 85,
  }))
  const attendanceRows = payrollRows.flatMap((row) => [
    { 'Employee code': row['Employee code'], Employee: row.Employee, Date: '2026-07-01', 'Clock in': '2026-07-01T09:00:00+07:00', 'Clock out': '2026-07-01T16:30:00+07:00', 'Break minutes': 30, 'Worked hours': 7, 'Overtime hours': 0, 'Night hours': 0, 'Holiday hours': 0 },
  ])

  const output = buildAccountantPayrollWorkbook(templateBytes, {
    periodStart: '2026-07-01', periodEnd: '2026-07-31', payrollRows, employeeRows, attendanceRows,
    calculationBasisRows: [
      { Setting: 'PIT self deduction (VND)', Value: 15_500_000 },
      { Setting: 'PIT dependent deduction (VND)', Value: 6_200_000 },
    ],
  })
  if (process.env.ACCOUNTANT_WORKBOOK_OUTPUT) fs.writeFileSync(process.env.ACCOUNTANT_WORKBOOK_OUTPUT, output)
  const entries = unzipSync(output)
  const workbook = strFromU8(entries['xl/workbook.xml'])
  assert.equal([...workbook.matchAll(/<sheet\b/g)].length, 19)
  assert.deepEqual(entries['xl/media/image1.png'], templateEntries['xl/media/image1.png'])
  assert.deepEqual(entries['xl/styles.xml'], templateEntries['xl/styles.xml'])

  const payroll = worksheetByName(entries, 'Full time')
  assert.match(payroll, /<c[^>]*r="B10"[^>]*><f>&apos;Basic&apos;!D9<\/f><v>NV101<\/v><\/c>/)
  assert.match(payroll, /<c[^>]*r="AC10"[^>]*><f>ROUND\(N10\+SUM\(P10:T10\)/)
  assert.match(payroll, /<c[^>]*r="AS10"[^>]*><f>MAX\(0,AQ10\+AR10\)<\/f><v>9725385<\/v><\/c>/)
  assert.match(payroll, /<c[^>]*r="A24"[^>]*t="inlineStr"><is><t[^>]*>IV\. Quản lý cửa hàng - Store manager<\/t><\/is><\/c>/)
  assert.match(payroll, /<c[^>]*r="B25"[^>]*><f>&apos;Basic&apos;!D23<\/f><v>NV104<\/v><\/c>/)
  assert.match(payroll, /<c[^>]*r="I25"[^>]*><v>0<\/v><\/c>/)
  assert.match(payroll, /<c[^>]*r="J25"[^>]*><v>7\.041666666666667<\/v><\/c>/)
  assert.doesNotMatch(payroll, /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/)

  const basic = worksheetByName(entries, 'Basic')
  assert.match(basic, /<c[^>]*r="D14"[^>]*t="inlineStr"><is><t[^>]*>NV109<\/t><\/is><\/c>/)
  assert.match(basic, /<c[^>]*r="D23"[^>]*t="inlineStr"><is><t[^>]*>NV104<\/t><\/is><\/c>/)

  const bank = worksheetByName(entries, 'Bank account ')
  assert.match(bank, /<c[^>]*r="B9"[^>]*t="inlineStr"><is><t[^>]*>MONTHLY EMPLOYEE<\/t><\/is><\/c>/)
  assert.match(bank, /<c[^>]*r="C29"[^>]*><f>SUM\(C9:C28\)<\/f><v>29990385<\/v><\/c>/)

  const summary = worksheetByName(entries, 'Summary')
  assert.doesNotMatch(summary, /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/)
  assert.match(summary, /SUMIF\(&apos;Full time&apos;!\$M\$10:\$M\$30/)

  const workRecord = worksheetByName(entries, 'Work record 100%')
  assert.match(workRecord, /<c[^>]*r="D14"[^>]*><f>&apos;VRENA-timesheet&apos;!C18<\/f><v>/)
  const reconcile = worksheetByName(entries, 'Reconcile')
  assert.match(reconcile, /VLOOKUP\(B10,&apos;Full time&apos;!\$B\$10:\$AS\$30,2,FALSE\)/)
})
