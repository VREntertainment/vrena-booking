'use client'

import { hasCompleteHistoricalAccountantLayout, historicalAccountantCategory, historicalAccountantPlacement, sortHistoricalAccountantRows } from '../../lib/historicalAccountantPayroll'
import { calculatePayrollTaxBases, progressivePitExcelFormula } from '../../lib/hrPayrollPolicy'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import { orderedRange } from '../../lib/staff/dates'
import {
  formatVndCompact
} from '../../lib/staff/formatting'
import {
  normalizeStaffContractStatus,
  normalizeStaffEmploymentType
} from '../../lib/staff/hrSettings'
import {
  adjustmentAppliesToPeriod,
  approvedAttendanceMinutes,
  employeePayrollTypeForPeriod,
  employeeRate,
  emptyStaffPayrollCalculation,
  isPaidLeaveForEmployee,
  leaveHoursInsidePeriod,
  normalizeEmployeePayrollType
} from '../../lib/staff/payroll'
import {
  customerName
} from '../../lib/staff/profiles'
import {
  accountantFormula,
  excelColumnName
} from '../../lib/staff/reportExports'
import type {
  StaffEmployeeProfile,
  StaffPayrollSourceSnapshot
} from '../../lib/staff/types'
import { getStaffKioskOperatorToken, supabase } from '../../lib/supabase/client'

export type PayrollExportActionContext = {
  payrollPeriodStart: string
  payrollPeriodEnd: string
  payrollSourceSnapshots: import("../../lib/staff/types").StaffPayrollSourceSnapshot[]
  visibleStaffProfileOptions: import("../../lib/staff/types").StaffProfile[]
  employeeProfileById: Map<string, import("../../lib/staff/types").StaffEmployeeProfile>
  staffPayrollCalculations: Map<string, import("../../lib/staff/types").StaffPayrollCalculation>
  text: StaffConsoleCopy
  attendanceLogs: import("../../lib/staff/types").StaffAttendanceLog[]
  profileById: Map<string, import("../../lib/staff/types").StaffProfile>
  leaveRequests: import("../../lib/staff/types").StaffLeaveRequest[]
  hrAdjustments: import("../../lib/staff/types").StaffHrAdjustment[]
  hrSettings: import("../../lib/staff/types").StaffHrSettings
  attendanceSettings: import("../../lib/staff/types").StaffAttendanceSettings
  setStatus: React.Dispatch<React.SetStateAction<string>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffPayrollExportActions(getContext: () => PayrollExportActionContext) {
  async function downloadPayrollExcel() {
    const {
      payrollPeriodStart,
      payrollPeriodEnd,
      payrollSourceSnapshots,
      visibleStaffProfileOptions,
      employeeProfileById,
      staffPayrollCalculations,
      text,
      attendanceLogs,
      profileById,
      leaveRequests,
      hrAdjustments,
      hrSettings,
      attendanceSettings,
      setStatus,
    } = getContext()

    const [periodStart, periodEnd] = orderedRange(payrollPeriodStart, payrollPeriodEnd)
    const accountantClassificationForEmployee = (employee: StaffEmployeeProfile | undefined) => {
      const employmentType = normalizeStaffEmploymentType(employee?.employment_type)
      const contractStatus = normalizeStaffContractStatus(employee?.contract_status)
      const payrollType = employeePayrollTypeForPeriod(employee, periodEnd)
      const probationEnd = employee?.probation_end_date || ''
      const laborStart = employee?.labor_start_date || ''
      const probationApplies = Boolean(
        (employee?.probation_start_date && periodEnd >= employee.probation_start_date) &&
        (!probationEnd || periodEnd <= probationEnd) &&
        (!laborStart || periodEnd < laborStart)
      )
      const probation = probationApplies || contractStatus === 'probation' || employmentType.startsWith('probation')
      if (payrollType === 'manager') return { category: 'manager', probation }
      if (probation) {
        if (payrollType === 'hourly' || employmentType === 'probation_part_time') return { category: 'probation_part_time', probation }
        return { category: 'probation_monthly', probation }
      }
      if (payrollType === 'hourly') {
        return { category: employmentType === 'part_time' || employmentType === 'contractor' ? 'part_time' : 'official_hourly', probation }
      }
      return { category: 'monthly', probation }
    }
    const historicalSnapshots = payrollSourceSnapshots.filter((snapshot) => (
      snapshot.period_start === periodStart && snapshot.period_end === periodEnd
    ))
    const candidateHistoricalSourceKey = historicalSnapshots.length === 15
      && historicalSnapshots.every((snapshot) => snapshot.source_key === historicalSnapshots[0]?.source_key)
      ? historicalSnapshots[0]?.source_key || ''
      : ''
    const historicalSourceKey = hasCompleteHistoricalAccountantLayout(
      candidateHistoricalSourceKey,
      historicalSnapshots.map((snapshot) => snapshot.employee_code),
    ) ? candidateHistoricalSourceKey : ''
    const orderedHistoricalSnapshots = historicalSourceKey
      ? sortHistoricalAccountantRows(historicalSourceKey, historicalSnapshots)
      : historicalSnapshots
    const calculatedPayrollRows: Array<Record<string, unknown>> = visibleStaffProfileOptions.map((staffProfile) => {
      const employee = employeeProfileById.get(staffProfile.id)
      const calculation = staffPayrollCalculations.get(staffProfile.id) || emptyStaffPayrollCalculation(staffProfile.id)
      const payrollType = employeePayrollTypeForPeriod(employee, periodEnd)
      const accountantClassification = accountantClassificationForEmployee(employee)
      return {
        __accountantCategory: accountantClassification.category,
        __accountantProbation: accountantClassification.probation,
        'Employee code': employee?.employee_code || '',
        Employee: employee?.legal_name || customerName(staffProfile, text),
        Department: employee?.department || '',
        'Employment type': text.employmentTypes[normalizeStaffEmploymentType(employee?.employment_type)],
        'Contract status': text.contractStatuses[normalizeStaffContractStatus(employee?.contract_status)],
        'Bank name': employee?.bank_name || '',
        'Bank account': employee?.bank_account_number || '',
        'Contract salary (VND)': payrollType === 'hourly' ? 0 : Math.max(0, Number(employee?.base_salary_vnd) || 0),
        'Configured hourly rate (VND)': Math.max(0, Number(employee?.hourly_rate_vnd) || 0),
        'Recurring monthly bonus (VND)': Math.max(0, Number(employee?.monthly_bonus_vnd) || 0),
        'Payroll hourly rate (VND)': Math.round(calculation.hourlyRate),
        'Period standard hours': Number((calculation.periodStandardMinutes / 60).toFixed(2)),
        'Scheduled hours': Number((calculation.scheduledMinutes / 60).toFixed(2)),
        'Worked hours': Number((calculation.workedMinutes / 60).toFixed(2)),
        'Worked days': calculation.workedDays,
        'Meal days': calculation.mealDays,
        'Paid leave hours': Number(calculation.paidLeaveHours.toFixed(2)),
        'Paid leave days': Number(calculation.paidLeaveDays.toFixed(2)),
        'Salary-paid hours': Number((calculation.salaryPaidMinutes / 60).toFixed(2)),
        'Overtime hours': Number((calculation.overtimeMinutes / 60).toFixed(2)),
        'Night hours': Number((calculation.nightMinutes / 60).toFixed(2)),
        'Holiday hours': Number((calculation.holidayMinutes / 60).toFixed(2)),
        'Base pay (VND)': calculation.basePay,
        'Meal allowance (VND)': calculation.mealAllowance,
        'Other allowances (VND)': calculation.otherAllowances,
        'Overtime pay (VND)': calculation.overtimePay,
        'Bonuses (VND)': calculation.bonuses,
        'Gross income (VND)': calculation.grossIncome,
        'Insurance base (VND)': calculation.contributionBase,
        'Employee insurance (VND)': calculation.employeeContributions,
        'PIT withheld (VND)': calculation.pitWithheld,
        'Advances (VND)': calculation.advances,
        'Deductions (VND)': calculation.deductions,
        'Net payable (VND)': calculation.netIncome,
        'Employer insurance (VND)': calculation.employerContributions,
        'Company cost (VND)': calculation.companyCost,
        'Rest alerts': calculation.restWarningCount,
        Notes: employee?.payroll_note || '',
        'Payroll basis': calculation.payrollBasis === 'published_schedule' ? 'Published schedule' : 'Working calendar',
        'Period standard days': Number(calculation.periodStandardDays.toFixed(2)),
        'Salary-paid days': Number(calculation.salaryPaidDays.toFixed(2)),
      }
    })
    const historicalSnapshotNumber = (snapshot: StaffPayrollSourceSnapshot, key: string, fallback = 0) => {
      const value = Number(snapshot.source_payload?.[key])
      return Number.isFinite(value) ? value : fallback
    }
    const historicalPayrollRows: Array<Record<string, unknown>> = orderedHistoricalSnapshots.map((snapshot) => {
      const standardHoursPerDay = snapshot.employment_status?.toLowerCase().includes('office') ? 8 : 6.5
      const insuranceBase = historicalSnapshotNumber(
        snapshot,
        'insurance_base_vnd',
        snapshot.employee_insurance_vnd > 0 ? snapshot.contract_rate_vnd : 0,
      )
      const placement = historicalAccountantPlacement(historicalSourceKey, snapshot.employee_code)
      const accountantCategory = historicalAccountantCategory(
        historicalSourceKey,
        snapshot.employee_code,
        String(snapshot.source_payload?.category || snapshot.employment_status || ''),
      )
      const bankAdjustment = historicalSnapshotNumber(snapshot, 'difference_vnd')
      const bankTransfer = snapshot.net_payable_vnd + bankAdjustment
      const employeeInsuranceDeducted = Math.max(0, snapshot.gross_income_vnd - snapshot.pit_withheld_vnd - snapshot.net_payable_vnd)
      const employeeInsuranceRate = insuranceBase > 0 ? snapshot.employee_insurance_vnd / insuranceBase * 100 : 0
      const employerInsuranceRate = insuranceBase > 0 && snapshot.employee_insurance_vnd > 0 ? 21.5 : 0
      const employerInsurance = Math.round(insuranceBase * employerInsuranceRate / 100)
      const standardDays = snapshot.basic_days ?? 0
      const salaryPaidDays = accountantCategory === 'official_hourly' || accountantCategory === 'part_time'
        ? snapshot.worked_days ?? 0
        : snapshot.contract_rate_vnd > 0 && standardDays > 0
          ? Number((snapshot.base_pay_vnd / snapshot.contract_rate_vnd * standardDays).toFixed(6))
          : 0
      const payrollHourlyRate = accountantCategory === 'official_hourly' || accountantCategory === 'part_time'
        ? snapshot.contract_rate_vnd
        : standardDays > 0
          ? snapshot.contract_rate_vnd / standardDays / standardHoursPerDay
          : 0
      return {
        __accountantHistoricalSource: true,
        __accountantCategory: accountantCategory,
        __accountantProbation: accountantCategory === 'probation_monthly' || accountantCategory === 'probation_part_time',
        __accountantPlacement: placement || undefined,
        __accountantSkipTimesheet: snapshot.employee_code === 'NV03',
        'Employee code': snapshot.employee_code,
        Employee: snapshot.employee_name,
        Department: snapshot.division || '',
        'Employment type': snapshot.employment_status || '',
        'Contract status': snapshot.employment_status || '',
        'Bank name': snapshot.bank_name || '',
        'Bank account': snapshot.bank_account_number || '',
        'Contract salary (VND)': snapshot.contract_rate_vnd,
        'Configured hourly rate (VND)': snapshot.employment_status?.toLowerCase().includes('hourly') ? snapshot.contract_rate_vnd : 0,
        'Payroll hourly rate (VND)': payrollHourlyRate,
        'Period standard hours': snapshot.basic_days === null ? '' : Number((snapshot.basic_days * standardHoursPerDay).toFixed(2)),
        'Scheduled hours': '',
        'Worked hours': snapshot.worked_minutes === null ? '' : Number((snapshot.worked_minutes / 60).toFixed(2)),
        'Worked days': snapshot.worked_days ?? '',
        'Meal days': snapshot.meal_days,
        'Paid leave hours': snapshot.worked_minutes === null ? '' : Number(((snapshot.salary_paid_minutes - snapshot.worked_minutes) / 60).toFixed(2)),
        'Paid leave days': snapshot.paid_leave_days,
        'Salary-paid hours': Number((snapshot.salary_paid_minutes / 60).toFixed(2)),
        'Overtime hours': Number((snapshot.overtime_minutes / 60).toFixed(2)),
        'Night hours': 0,
        'Holiday hours': 0,
        'Base pay (VND)': snapshot.base_pay_vnd,
        'Meal allowance (VND)': snapshot.meal_allowance_vnd,
        'Other allowances (VND)': historicalSnapshotNumber(snapshot, 'other_income_vnd'),
        'Overtime pay (VND)': snapshot.overtime_pay_vnd,
        'Bonuses (VND)': 0,
        'Gross income (VND)': snapshot.gross_income_vnd,
        'Insurance base (VND)': insuranceBase,
        'Employee insurance (VND)': snapshot.employee_insurance_vnd,
        'Employee insurance %': employeeInsuranceRate,
        'Taxable income (VND)': snapshot.taxable_income_vnd,
        'PIT withheld (VND)': snapshot.pit_withheld_vnd,
        'Advances (VND)': 0,
        'Deductions (VND)': 0,
        'Net payable (VND)': snapshot.net_payable_vnd,
        'Net before adjustment (VND)': snapshot.net_payable_vnd,
        'Employee insurance deducted (VND)': employeeInsuranceDeducted,
        'Employer insurance %': employerInsuranceRate,
        'Employer insurance (VND)': employerInsurance,
        'Company cost (VND)': snapshot.gross_income_vnd + employerInsurance,
        'Bank adjustment (VND)': bankAdjustment,
        'Bank transfer (VND)': bankTransfer,
        'Rest alerts': '',
        Notes: snapshot.details || '',
        'Period standard days': standardDays,
        'Salary-paid days': salaryPaidDays,
      }
    })
    const payrollRows = historicalSourceKey ? historicalPayrollRows : calculatedPayrollRows

    const attendanceRows = attendanceLogs
      .filter((log) => log.work_date >= periodStart && log.work_date <= periodEnd)
      .sort((left, right) => left.work_date.localeCompare(right.work_date))
      .map((log) => {
        const staffProfile = profileById.get(log.staff_profile_id)
        const employee = employeeProfileById.get(log.staff_profile_id)
        return {
          'Employee code': employee?.employee_code || '',
          Employee: employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : log.staff_profile_id),
          Date: log.work_date,
          'Clock in': log.clock_in_at || '',
          'Clock out': log.clock_out_at || '',
          'Break minutes': Math.max(0, Number(log.break_minutes) || 0),
          'Worked hours': Number((approvedAttendanceMinutes(log) / 60).toFixed(2)),
          'Regular hours': Number((Math.max(0, Number(log.regular_minutes) || 0) / 60).toFixed(2)),
          'Overtime hours': Number((Math.max(0, Number(log.overtime_minutes) || 0) / 60).toFixed(2)),
          'Night hours': Number((Math.max(0, Number(log.night_minutes) || 0) / 60).toFixed(2)),
          'Holiday hours': Number((Math.max(0, Number(log.holiday_minutes) || 0) / 60).toFixed(2)),
          Status: log.status,
          Approval: log.approval_status,
          'Manager note': log.manager_note || '',
        }
      })

    const paidLeaveRows = leaveRequests
      .filter((leave) => leave.end_date >= periodStart && leave.start_date <= periodEnd)
      .map((leave) => {
        const staffProfile = profileById.get(leave.staff_profile_id)
        const employee = employeeProfileById.get(leave.staff_profile_id)
        const paidInPayroll = leave.status === 'approved' && isPaidLeaveForEmployee(leave, employee)
        return {
          'Employee code': employee?.employee_code || '',
          Employee: employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : leave.staff_profile_id),
          'Leave type': leave.leave_type,
          'Request start': leave.start_date,
          'Request end': leave.end_date,
          'Requested hours': Math.max(0, Number(leave.hours) || 0),
          'Hours inside selected period': Number(leaveHoursInsidePeriod(leave, periodStart, periodEnd).toFixed(2)),
          Status: leave.status,
          'Paid in payroll': paidInPayroll ? 'Yes' : 'No',
          Reason: leave.reason || '',
        }
      })

    const adjustmentRows = hrAdjustments
      .filter((adjustment) => adjustmentAppliesToPeriod(adjustment, periodStart, periodEnd))
      .map((adjustment) => {
        const staffProfile = profileById.get(adjustment.profile_id)
        const employee = employeeProfileById.get(adjustment.profile_id)
        return {
          'Employee code': employee?.employee_code || '',
          Employee: employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : adjustment.profile_id),
          Type: adjustment.adjustment_type,
          Title: adjustment.title,
          'Amount (VND)': adjustment.amount_vnd,
          'Effective date': adjustment.effective_date,
          'Period start': adjustment.period_start || '',
          'Period end': adjustment.period_end || '',
          Status: adjustment.status,
          Notes: adjustment.notes || '',
        }
      })

    const calculationBasisRows = [
      { Setting: 'Report period', Value: `${periodStart} to ${periodEnd}`, Notes: 'Selected in the Payroll tab' },
      { Setting: 'Payroll data source', Value: historicalSourceKey ? 'Protected historical payroll source' : 'Live HR attendance and payroll data', Notes: historicalSourceKey ? 'The workbook is regenerated from the signed-off employee-level source snapshot, including historical reconciliation adjustments.' : 'Calculated when the Excel file is generated.' },
      { Setting: 'Reference workbook', Value: 'VR_Payroll_July_2026_Emile_V2 · HR Employee Master', Notes: 'HR Employee Master is authoritative for employee status, contract periods, payroll type, salary, and insurance enrollment. Reconcile remains authoritative for the July historical snapshot.' },
      { Setting: 'Reference workbook URL', Value: 'https://docs.google.com/spreadsheets/d/1UbmITiVHdogTU8zOhHRFS4NmZn6unL_XsZms16zIZfA', Notes: '' },
      { Setting: 'Monthly payroll denominator', Value: 'Published employee schedule for the selected period', Notes: 'Changes with each month. Approved attendance and paid leave are the payable numerator.' },
      { Setting: 'Fallback daily hours', Value: Number((hrSettings.standard_monthly_hours / Math.max(1, hrSettings.standard_monthly_days)).toFixed(2)), Notes: `Applied to the selected period's working-calendar days when an employee has no published schedule. Weekly rest days: ${attendanceSettings.weekly_rest_days.join(', ')} (0 = Sunday).` },
      { Setting: 'Meal allowance per worked day (VND)', Value: hrSettings.lunch_allowance_vnd, Notes: 'July reference: 35,000 VND per worked day' },
      { Setting: 'Normal overtime multiplier', Value: hrSettings.normal_overtime_multiplier, Notes: 'July reference: 150%' },
      { Setting: 'Night overtime multiplier', Value: hrSettings.normal_overtime_multiplier + hrSettings.night_work_bonus_rate / 100 + hrSettings.night_overtime_extra_rate / 100, Notes: 'Ordinary OT multiplier plus night-work and night-OT premiums' },
      { Setting: 'Holiday overtime multiplier', Value: hrSettings.holiday_overtime_multiplier, Notes: 'July reference: up to 300%' },
      { Setting: 'Paid leave policy', Value: 'Approved annual/public-holiday leave for monthly full-time payroll', Notes: 'Part-time staff do not receive paid annual leave under the July policy' },
      { Setting: 'Leave accrual per qualifying month', Value: hrSettings.leave_accrual_days_per_month, Notes: `Qualifies from ${hrSettings.leave_qualifying_worked_days} worked days` },
      { Setting: 'Join / exit cutoff days', Value: `${hrSettings.leave_join_cutoff_day} / ${hrSettings.leave_exit_cutoff_day}`, Notes: 'July HR Employee Master leave-balance policy' },
      { Setting: 'Carry-forward expiry', Value: `${String(hrSettings.leave_carry_forward_day).padStart(2, '0')}/${String(hrSettings.leave_carry_forward_month).padStart(2, '0')}`, Notes: 'Unused prior-year balance expiry' },
      { Setting: 'Social insurance', Value: hrSettings.social_insurance_enabled ? 'Enabled' : 'Disabled', Notes: 'Applied to active full-time contract salary, excluding meal allowance and overtime' },
      { Setting: 'Employee insurance rate', Value: hrSettings.employee_social_insurance_rate + hrSettings.employee_health_insurance_rate + hrSettings.employee_unemployment_insurance_rate, Notes: `SI ${hrSettings.employee_social_insurance_rate}% · HI ${hrSettings.employee_health_insurance_rate}% · UI ${hrSettings.employee_unemployment_insurance_rate}%` },
      { Setting: 'Employer insurance and union rate', Value: hrSettings.employer_social_insurance_rate + hrSettings.employer_health_insurance_rate + hrSettings.employer_unemployment_insurance_rate + hrSettings.employer_trade_union_rate, Notes: `SI ${hrSettings.employer_social_insurance_rate}% · HI ${hrSettings.employer_health_insurance_rate}% · UI ${hrSettings.employer_unemployment_insurance_rate}% · union ${hrSettings.employer_trade_union_rate}%` },
      { Setting: 'Personal income tax', Value: hrSettings.personal_income_tax_enabled ? 'Enabled' : 'Disabled', Notes: `Progressive calculation; employee-specific fixed withholding is used only when explicitly configured.` },
      { Setting: 'PIT self deduction (VND)', Value: hrSettings.personal_deduction_vnd, Notes: `Policy ${hrSettings.policy_version}, effective ${hrSettings.effective_from}` },
      { Setting: 'PIT dependent deduction (VND)', Value: hrSettings.dependent_deduction_vnd, Notes: 'Per registered dependent per month' },
      { Setting: 'Progressive PIT bands', Value: hrSettings.pit_brackets.map((bracket) => `${bracket.rate}%`).join(' / '), Notes: hrSettings.pit_brackets.map((bracket) => bracket.up_to == null ? 'above final threshold' : formatVndCompact(bracket.up_to)).join(' / ') },
      { Setting: 'Legal source', Value: hrSettings.legal_source_url || '', Notes: `Reviewed ${hrSettings.legal_reviewed_on || 'not recorded'}` },
    ]

    const employeeByCode = new Map(Array.from(employeeProfileById.values()).map((employee) => [employee.employee_code || '', employee]))
    const employeeMasterRows = visibleStaffProfileOptions.map((staffProfile) => {
      const employee = employeeProfileById.get(staffProfile.id)
      const accountantClassification = accountantClassificationForEmployee(employee)
      return {
        __accountantCategory: accountantClassification.category,
        __accountantProbation: accountantClassification.probation,
        'Employee code': employee?.employee_code || '',
        'Legal name': employee?.legal_name || customerName(staffProfile, text),
        'Employment status': employee?.active === false ? 'Inactive' : text.contractStatuses[normalizeStaffContractStatus(employee?.contract_status)],
        'Employment type': text.employmentTypes[normalizeStaffEmploymentType(employee?.employment_type)],
        Position: employee?.job_title || '',
        Division: employee?.department || '',
        Workplace: employee?.main_work_location || '',
        Phone: employee?.personal_phone || '',
        Email: employee?.personal_email || '',
        'Date of birth': employee?.date_of_birth || '',
        'National ID': employee?.national_id || '',
        Address: employee?.address || '',
        'Employment start': employee?.start_date || '',
        'Employment end': employee?.end_date || '',
        'Contract type': employee?.contract_type || '',
        'Contract start': employee?.contract_start_date || '',
        'Contract end': employee?.contract_end_date || '',
        'Monthly salary (VND)': Math.max(0, Number(employee?.base_salary_vnd) || 0),
        'Hourly rate (VND)': Math.max(0, Number(employee?.hourly_rate_vnd) || 0),
        'Recurring monthly bonus (VND)': Math.max(0, Number(employee?.monthly_bonus_vnd) || 0),
        'Meal / worked day (VND)': hrSettings.lunch_allowance_vnd,
        'OT multiplier': hrSettings.normal_overtime_multiplier,
        'Night multiplier': hrSettings.normal_overtime_multiplier + hrSettings.night_work_bonus_rate / 100 + hrSettings.night_overtime_extra_rate / 100,
        'Holiday multiplier': hrSettings.holiday_overtime_multiplier,
        'Employee insurance %': hrSettings.employee_social_insurance_rate + hrSettings.employee_health_insurance_rate + hrSettings.employee_unemployment_insurance_rate,
        'Employer insurance & union %': hrSettings.employer_social_insurance_rate + hrSettings.employer_health_insurance_rate + hrSettings.employer_unemployment_insurance_rate + hrSettings.employer_trade_union_rate,
        'Configured PIT %': employeeRate(employee?.pit_withholding_rate, hrSettings.pit_withholding_rate),
        Dependents: Math.max(0, Number(employee?.dependents_count) || 0),
        'Tax code': employee?.tax_code || '',
        'Social insurance number': employee?.social_insurance_number || '',
        Bank: employee?.bank_name || '',
        'Bank account': employee?.bank_account_number || '',
        'Profile photo': employee?.profile_photo_path ? 'Available' : 'Missing',
        CV: employee?.cv_document_path ? 'Available' : 'Missing',
        Notes: employee?.payroll_note || '',
        'Probation payroll type': normalizeEmployeePayrollType(employee?.probation_payroll_type),
        'Labor payroll type': normalizeEmployeePayrollType(employee?.labor_payroll_type),
        'Probation salary %': Math.max(0, Number(employee?.probation_salary_percentage) || 85),
        'Probation bonus %': Number(employee?.probation_bonus_percentage) === 85 ? 85 : 100,
        'Probation start': employee?.probation_start_date || '',
        'Probation end': employee?.probation_end_date || '',
        'Labor start': employee?.labor_start_date || '',
        'Labor end': employee?.labor_end_date || '',
        'Insurance enrolled': employee?.social_insurance_enrolled ? 'Yes' : 'No',
        'Insurance salary base (VND)': Math.max(0, Number(employee?.social_insurance_salary_vnd) || 0),
        'Emergency contact name': employee?.emergency_contact_name || '',
        'Emergency contact relationship': employee?.emergency_contact_relationship || '',
        'Emergency contact phone': employee?.emergency_contact_phone || '',
        'Google Drive employee folder': employee?.google_drive_folder_url || '',
      }
    })
    const currentEmployeeRowByCode = new Map<string, Record<string, unknown>>(employeeMasterRows.map((employee) => [String(employee['Employee code'] || ''), employee]))
    const historicalPayrollRowByCode = new Map<string, Record<string, unknown>>(historicalPayrollRows.map((payroll) => [String(payroll['Employee code'] || ''), payroll]))
    const exportEmployeeRows: Array<Record<string, unknown>> = historicalSourceKey
      ? orderedHistoricalSnapshots.map((snapshot) => {
        const payroll = historicalPayrollRowByCode.get(snapshot.employee_code) || {}
        const current = currentEmployeeRowByCode.get(snapshot.employee_code) || {}
        const category = String(payroll.__accountantCategory || '')
        const hourly = category === 'official_hourly' || category === 'part_time' || category === 'probation_part_time'
        return {
          ...current,
          __accountantCategory: payroll.__accountantCategory,
          __accountantProbation: payroll.__accountantProbation,
          'Employee code': snapshot.employee_code,
          'Legal name': snapshot.employee_name,
          'Employment status': snapshot.employment_status || current['Employment status'] || '',
          'Employment type': snapshot.employment_status || current['Employment type'] || '',
          Division: snapshot.division || current.Division || '',
          'Monthly salary (VND)': hourly ? 0 : snapshot.contract_rate_vnd,
          'Hourly rate (VND)': hourly ? snapshot.contract_rate_vnd : 0,
          'Configured hourly rate (VND)': hourly ? snapshot.contract_rate_vnd : 0,
          'Meal / worked day (VND)': snapshot.meal_days > 0 ? snapshot.meal_allowance_vnd / snapshot.meal_days : hrSettings.lunch_allowance_vnd,
          'Employee insurance %': Number(payroll['Employee insurance %']) || 0,
          'Employer insurance & union %': Number(payroll['Employer insurance %']) || 0,
          Bank: snapshot.bank_name || '',
          'Bank account': snapshot.bank_account_number || '',
          Notes: snapshot.details || '',
        }
      })
      : employeeMasterRows

    const contractCheckRows = exportEmployeeRows.map((employee, index) => {
      const row = index + 5
      const employeeRow = row
      const statusFormula = `IF(OR('Employee Master'!A${employeeRow}="",'Employee Master'!B${employeeRow}=""),"MISSING IDENTITY",IF(AND('Employee Master'!R${employeeRow}=0,'Employee Master'!S${employeeRow}=0),"MISSING PAY RATE",IF(OR('Employee Master'!AD${employeeRow}="",'Employee Master'!AE${employeeRow}=""),"MISSING BANK",IF(AND('Employee Master'!P${employeeRow}<>"",'Employee Master'!Q${employeeRow}<>"",'Employee Master'!Q${employeeRow}<'Employee Master'!P${employeeRow}),"CHECK CONTRACT DATES","OK"))))`
      return {
        'Employee code': accountantFormula(`'Employee Master'!A${employeeRow}`, String(employee['Employee code'] || '')),
        Employee: accountantFormula(`'Employee Master'!B${employeeRow}`, String(employee['Legal name'] || '')),
        Division: accountantFormula(`'Employee Master'!F${employeeRow}`, String(employee.Division || '')),
        'Contract type': accountantFormula(`'Employee Master'!O${employeeRow}`, String(employee['Contract type'] || '')),
        'Contract start': accountantFormula(`'Employee Master'!P${employeeRow}`, String(employee['Contract start'] || '')),
        'Contract end': accountantFormula(`'Employee Master'!Q${employeeRow}`, String(employee['Contract end'] || '')),
        'Monthly salary (VND)': accountantFormula(`'Employee Master'!R${employeeRow}`, Number(employee['Monthly salary (VND)']) || 0, 'currency'),
        'Hourly rate (VND)': accountantFormula(`'Employee Master'!S${employeeRow}`, Number(employee['Hourly rate (VND)']) || 0, 'currency'),
        'Bank status': accountantFormula(`IF(OR('Employee Master'!AD${employeeRow}="",'Employee Master'!AE${employeeRow}=""),"MISSING","OK")`, employee.Bank && employee['Bank account'] ? 'OK' : 'MISSING'),
        Check: accountantFormula(statusFormula, employee['Employee code'] && employee['Legal name'] && (Number(employee['Monthly salary (VND)']) > 0 || Number(employee['Hourly rate (VND)']) > 0) && employee.Bank && employee['Bank account'] ? 'OK' : 'REVIEW'),
      }
    })

    const payrollFormulaRows: Array<Record<string, unknown>> = payrollRows.map((source, index) => {
      const row = index + 5
      const employee = employeeByCode.get(String(source['Employee code'] || ''))
      const calculation = employee ? staffPayrollCalculations.get(employee.profile_id) : undefined
      const sourceEmployeeCode = String(source['Employee code'] || '')
      const periodReference = historicalSnapshots.find((snapshot) => snapshot.employee_code === sourceEmployeeCode)
      const sourceMealDays = Math.max(0, Number(source['Meal days']) || 0)
      const mealPerDay = sourceMealDays > 0
        ? Math.max(0, Number(source['Meal allowance (VND)']) || 0) / sourceMealDays
        : hrSettings.lunch_allowance_vnd
      const insuranceBaseValue = Math.max(0, Number(source['Insurance base (VND)']) || 0)
      const employeeRateValue = periodReference
        ? insuranceBaseValue > 0
          ? periodReference.employee_insurance_vnd / insuranceBaseValue * 100
          : 0
        : hrSettings.employee_social_insurance_rate + hrSettings.employee_health_insurance_rate + hrSettings.employee_unemployment_insurance_rate
      const sourceEmployerRateValue = Number(source['Employer insurance %'])
      const employerRateValue = Number.isFinite(sourceEmployerRateValue)
        ? Math.max(0, sourceEmployerRateValue)
        : hrSettings.employer_social_insurance_rate + hrSettings.employer_health_insurance_rate + hrSettings.employer_unemployment_insurance_rate + hrSettings.employer_trade_union_rate
      const pitRateValue = Math.max(
        0,
        Number(periodReference?.source_payload?.pit_rate_percent) || Number(employee?.pit_withholding_rate) || 0,
      )
      const basePay = Number(source['Base pay (VND)']) || 0
      const mealAllowance = Number(source['Meal allowance (VND)']) || 0
      const overtimePay = Number(source['Overtime pay (VND)']) || 0
      const gross = Number(source['Gross income (VND)']) || 0
      const employeeInsurance = Number(source['Employee insurance (VND)']) || 0
      const pit = Number(source['PIT withheld (VND)']) || 0
      const advances = Number(source['Advances (VND)']) || 0
      const deductions = Number(source['Deductions (VND)']) || 0
      const net = Number(source['Net payable (VND)']) || 0
      const employerInsurance = Number(source['Employer insurance (VND)']) || 0
      const companyCost = Number(source['Company cost (VND)']) || gross + employerInsurance
      const taxBases = calculatePayrollTaxBases({
        grossIncome: gross,
        employeeContributions: employeeInsurance,
        mealAllowance,
        overtimePay,
        personalDeduction: hrSettings.personal_deduction_vnd,
        dependentDeduction: Math.max(0, Number(employee?.dependents_count) || 0) * hrSettings.dependent_deduction_vnd,
      })
      const sourceTaxableIncomeValue = Number(source['Taxable income (VND)'])
      const taxableIncome = source.__accountantHistoricalSource && Number.isFinite(sourceTaxableIncomeValue)
        ? Math.max(0, sourceTaxableIncomeValue)
        : taxBases.progressiveTaxableIncome
      const sourceBankTransferValue = Number(source['Bank transfer (VND)'])
      const bankTransfer = Number.isFinite(sourceBankTransferValue) ? sourceBankTransferValue : net
      const sourceBankAdjustmentValue = Number(source['Bank adjustment (VND)'])
      const bankAdjustment = Number.isFinite(sourceBankAdjustmentValue) ? sourceBankAdjustmentValue : -(advances + deductions)
      const bankTransferCheck = !source['Bank name'] || !source['Bank account']
        ? 'MISSING BANK'
        : Math.abs(bankTransfer - (net + bankAdjustment)) > 1
          ? 'CHECK TRANSFER'
          : 'OK'
      return {
        __accountantHistoricalSource: source.__accountantHistoricalSource,
        __accountantCategory: source.__accountantCategory,
        __accountantProbation: source.__accountantProbation,
        __accountantPlacement: source.__accountantPlacement,
        __accountantSkipTimesheet: source.__accountantSkipTimesheet,
        'Employee code': source['Employee code'], Employee: source.Employee, Division: source.Department,
        'Employment type': source['Employment type'], 'Contract status': source['Contract status'], Bank: source['Bank name'], 'Bank account': source['Bank account'],
        'Contract salary (VND)': source['Contract salary (VND)'], 'Configured hourly rate (VND)': source['Configured hourly rate (VND)'],
        'Payroll hourly rate (VND)': accountantFormula(`IF(I${row}>0,I${row},IF(H${row}>0,H${row}/MAX(1,K${row}),0))`, Number(source['Payroll hourly rate (VND)']) || 0, 'currency'),
        'Period standard hours': source['Period standard hours'], 'Worked hours': source['Worked hours'], 'Worked days': source['Worked days'],
        'Paid leave hours': source['Paid leave hours'], 'Paid leave days': source['Paid leave days'], 'Salary-paid hours': source['Salary-paid hours'],
        'Overtime hours': source['Overtime hours'], 'Night hours': source['Night hours'], 'Holiday hours': source['Holiday hours'],
        'Meal / worked day (VND)': mealPerDay, 'Other allowances (VND)': source['Other allowances (VND)'], 'Bonuses (VND)': source['Bonuses (VND)'],
        'Advances (VND)': advances, 'Deductions (VND)': deductions, 'Employee insurance %': employeeRateValue,
        'Employer insurance %': employerRateValue, 'PIT method': pitRateValue > 0 ? 'Employee fixed withholding' : 'Progressive PIT', 'PIT rate %': pitRateValue,
        Dependents: Math.max(0, Number(employee?.dependents_count) || 0), 'OT multiplier': hrSettings.normal_overtime_multiplier,
        'Night multiplier': hrSettings.normal_overtime_multiplier + hrSettings.night_work_bonus_rate / 100 + hrSettings.night_overtime_extra_rate / 100, 'Holiday multiplier': hrSettings.holiday_overtime_multiplier,
        'Base pay (VND)': accountantFormula(`IF(H${row}>0,ROUND(H${row}*MIN(1,P${row}/MAX(1,K${row})),0),ROUND(P${row}*J${row},0))`, basePay, 'currency'),
        'Meal days': sourceMealDays,
        'Meal allowance (VND)': accountantFormula(`ROUND(${sourceMealDays || calculation?.mealDays || 0}*T${row},0)`, mealAllowance, 'currency'),
        'Overtime pay (VND)': accountantFormula(`ROUND(MAX(0,Q${row}-R${row}-S${row})*J${row}*AD${row}+R${row}*J${row}*(AD${row}+${hrSettings.night_work_bonus_rate / 100}+${hrSettings.night_overtime_extra_rate / 100})+S${row}*J${row}*AF${row},0)`, overtimePay, 'currency'),
        'Gross income (VND)': accountantFormula(`MAX(0,SUM(AG${row}:AI${row})+U${row}+V${row})`, gross, 'currency'),
        'Insurance base (VND)': source['Insurance base (VND)'],
        'Employee insurance (VND)': accountantFormula(`ROUND(AK${row}*Y${row}/100,0)`, employeeInsurance, 'currency'),
        'Taxable income (VND)': accountantFormula(`MAX(0,AJ${row}-AL${row}-AH${row}-AI${row}-${hrSettings.personal_deduction_vnd}-AC${row}*${hrSettings.dependent_deduction_vnd})`, taxableIncome, 'currency'),
        'PIT withheld (VND)': accountantFormula(`IF('${hrSettings.personal_income_tax_enabled ? 'yes' : 'no'}'<>"yes",0,IF(AB${row}>0,ROUND(MAX(0,AJ${row}-AL${row}-AI${row})*AB${row}/100,0),ROUND(${progressivePitExcelFormula(`AM${row}`, hrSettings.pit_brackets)},0)))`, pit, 'currency'),
        'Net payable (VND)': accountantFormula(`MAX(0,AJ${row}-AL${row}-AN${row}-X${row}-W${row})`, net, 'currency'),
        'Net before adjustment (VND)': source['Net before adjustment (VND)'] ?? net,
        'Employee insurance deducted (VND)': source['Employee insurance deducted (VND)'] ?? employeeInsurance,
        'Employer insurance (VND)': accountantFormula(`ROUND(AK${row}*Z${row}/100,0)`, employerInsurance, 'currency'),
        'Company cost (VND)': accountantFormula(`MAX(0,AJ${row}+AP${row})`, companyCost, 'currency'),
        'Bank adjustment (VND)': bankAdjustment,
        'Bank transfer (VND)': accountantFormula(`AO${row}`, bankTransfer, 'currency'),
        Check: accountantFormula(`IF(OR(A${row}="",B${row}=""),"MISSING EMPLOYEE",IF(OR(F${row}="",G${row}=""),"MISSING BANK",IF(ABS(AR${row}-AO${row})>1,"CHECK TRANSFER","OK")))`, bankTransferCheck),
        Notes: source.Notes,
        'Payroll basis': source['Payroll basis'] || '',
        'Period standard days': source['Period standard days'] ?? '',
        'Salary-paid days': source['Salary-paid days'] ?? '',
      }
    })
    const payrollFirstRow = 5
    const payrollLastRow = payrollFirstRow + payrollFormulaRows.length - 1
    const formulaHeaders = Object.keys(payrollFormulaRows[0] || {})
    const payrollTotalRow = formulaHeaders.reduce<Record<string, unknown>>((row, header, index) => {
      if (header === 'Employee') row[header] = 'TOTAL'
      else if (header === 'Employee code') row[header] = ''
      else if (/hours|days|VND|income|insurance|PIT|cost|transfer|allowance|pay/i.test(header) && payrollFormulaRows.length > 0) {
        const column = excelColumnName(index + 1)
        row[header] = accountantFormula(`SUM(${column}${payrollFirstRow}:${column}${payrollLastRow})`, payrollFormulaRows.reduce((sum, item) => sum + Number((item[header] as { result?: number })?.result ?? item[header] ?? 0), 0), /VND|income|insurance|PIT|cost|transfer|allowance|pay/i.test(header) ? 'currency' : 'decimal')
      } else row[header] = ''
      return row
    }, { __xlsxRowStyle: 'total' })

    const payrollFormulaRowByEmployeeCode = new Map(
      payrollFormulaRows.map((row, index) => [String(row['Employee code'] || ''), index + payrollFirstRow]),
    )
    const historicalComparisonRows = historicalSnapshots.map((snapshot, index) => {
      const row = index + payrollFirstRow
      const payrollRow = payrollFormulaRowByEmployeeCode.get(snapshot.employee_code)
      const sourceBankTransfer = historicalSnapshotNumber(snapshot, 'bank_transfer_vnd', snapshot.net_payable_vnd)
      const calculatedGross = payrollRow ? Number((payrollFormulaRows[payrollRow - payrollFirstRow]?.['Gross income (VND)'] as { result?: number })?.result || 0) : 0
      const calculatedNet = payrollRow ? Number((payrollFormulaRows[payrollRow - payrollFirstRow]?.['Net payable (VND)'] as { result?: number })?.result || 0) : 0
      return {
        'Employee code': snapshot.employee_code,
        Employee: snapshot.employee_name,
        'Source basic days': snapshot.basic_days ?? '',
        'Source worked days': snapshot.worked_days ?? '',
        'Source worked hours': snapshot.worked_minutes === null ? '' : Number((snapshot.worked_minutes / 60).toFixed(2)),
        'Source gross (VND)': snapshot.gross_income_vnd,
        'Calculated gross (VND)': payrollRow ? accountantFormula(`'Payroll Formulas'!AJ${payrollRow}`, calculatedGross, 'currency') : 0,
        'Gross difference (VND)': accountantFormula(`G${row}-F${row}`, calculatedGross - snapshot.gross_income_vnd, 'currency'),
        'Source employee insurance (VND)': snapshot.employee_insurance_vnd,
        'Source PIT (VND)': snapshot.pit_withheld_vnd,
        'Source net (VND)': snapshot.net_payable_vnd,
        'Calculated net (VND)': payrollRow ? accountantFormula(`'Payroll Formulas'!AO${payrollRow}`, calculatedNet, 'currency') : 0,
        'Net difference (VND)': accountantFormula(`L${row}-K${row}`, calculatedNet - snapshot.net_payable_vnd, 'currency'),
        'Source bank transfer (VND)': sourceBankTransfer,
        Check: accountantFormula(`IF(ABS(H${row})<=1,"GROSS MATCH",IF(ABS(M${row})<=1,"NET MATCH","REVIEW"))`, Math.abs(calculatedGross - snapshot.gross_income_vnd) <= 1 ? 'GROSS MATCH' : Math.abs(calculatedNet - snapshot.net_payable_vnd) <= 1 ? 'NET MATCH' : 'REVIEW'),
        Notes: snapshot.details || '',
      }
    })

    const summaryRows = [
      { Metric: 'Payroll period', Value: `${periodStart} to ${periodEnd}`, Status: historicalPayrollRows.length > 0 ? 'Live calculation with imported source comparison' : 'Live HR data' },
      { Metric: 'Headcount', Value: accountantFormula(`COUNTA('Payroll Formulas'!A${payrollFirstRow}:A${payrollLastRow})`, payrollFormulaRows.length, 'integer'), Status: 'Employees included' },
      { Metric: 'Gross pay (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AJ${payrollFirstRow}:AJ${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Gross income (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'Employee insurance (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AL${payrollFirstRow}:AL${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Employee insurance (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'PIT withheld (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AN${payrollFirstRow}:AN${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['PIT withheld (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'Net payable (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AO${payrollFirstRow}:AO${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Net payable (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'Employer insurance (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AP${payrollFirstRow}:AP${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Employer insurance (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'Company cost (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AQ${payrollFirstRow}:AQ${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Company cost (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
    ]

    const leaveBalanceRows = payrollRows.map((source, index) => {
      const row = index + 5
      const employee = employeeByCode.get(String(source['Employee code'] || ''))
      const entitlement = employee?.contract_status === 'ended' ? 0 : hrSettings.annual_leave_days
      const used = Number(source['Paid leave days']) || 0
      return {
        'Employee code': source['Employee code'], Employee: source.Employee, Division: source.Department,
        'Employment type': source['Employment type'], 'Employment start': employee?.start_date || '', 'Contract end': employee?.contract_end_date || employee?.end_date || '',
        'Annual entitlement': entitlement, 'Paid leave used': used,
        'Closing balance': accountantFormula(`MAX(0,G${row}-H${row})`, Math.max(0, entitlement - used), 'decimal'),
        'Leave payout due (VND)': accountantFormula(`IF(F${row}<>"",ROUND(I${row}*IFERROR(VLOOKUP(A${row},'Employee Master'!A:R,18,FALSE)/${Math.max(1, Number(hrSettings.standard_monthly_days) || 26)},0),0),0)`, 0, 'currency'),
        Check: accountantFormula(`IF(A${row}="","MISSING EMPLOYEE",IF(I${row}<0,"CHECK BALANCE","OK"))`, 'OK'),
      }
    })

    const bankTransferRows = payrollFormulaRows.map((source, index) => {
      const row = index + 5
      return {
        'Employee code': accountantFormula(`'Payroll Formulas'!A${row}`, String(source['Employee code'] || '')),
        Employee: accountantFormula(`'Payroll Formulas'!B${row}`, String(source.Employee || '')),
        Bank: accountantFormula(`'Payroll Formulas'!F${row}`, String(source.Bank || '')),
        'Bank account': accountantFormula(`'Payroll Formulas'!G${row}`, String(source['Bank account'] || '')),
        'Transfer amount (VND)': accountantFormula(`'Payroll Formulas'!AR${row}`, Number((source['Bank transfer (VND)'] as { result?: number }).result || 0), 'currency'),
        Status: accountantFormula(`IF(OR(C${row}="",D${row}=""),"MISSING BANK",IF(E${row}<=0,"CHECK AMOUNT","READY"))`, source.Bank && source['Bank account'] ? 'READY' : 'MISSING BANK'),
      }
    })

    const reconciliationRows = payrollFormulaRows.map((source, index) => {
      const row = index + 5
      const net = Number((source['Net payable (VND)'] as { result?: number }).result || 0)
      return {
        'Employee code': accountantFormula(`'Payroll Formulas'!A${row}`, String(source['Employee code'] || '')),
        Employee: accountantFormula(`'Payroll Formulas'!B${row}`, String(source.Employee || '')),
        'Gross income (VND)': accountantFormula(`'Payroll Formulas'!AJ${row}`, Number((source['Gross income (VND)'] as { result?: number }).result || 0), 'currency'),
        'Employee insurance (VND)': accountantFormula(`'Payroll Formulas'!AL${row}`, Number((source['Employee insurance (VND)'] as { result?: number }).result || 0), 'currency'),
        'PIT withheld (VND)': accountantFormula(`'Payroll Formulas'!AN${row}`, Number((source['PIT withheld (VND)'] as { result?: number }).result || 0), 'currency'),
        'Net payable (VND)': accountantFormula(`'Payroll Formulas'!AO${row}`, net, 'currency'),
        'Bank transfer (VND)': accountantFormula(`'Bank Transfer'!E${row}`, net, 'currency'),
        'Difference (VND)': accountantFormula(`G${row}-F${row}`, 0, 'currency'),
        Check: accountantFormula(`IF(ABS(H${row})>1,"CHECK",IF('Bank Transfer'!F${row}<>"READY","CHECK BANK","OK"))`, source.Bank && source['Bank account'] ? 'OK' : 'CHECK BANK'),
      }
    })

    const payslipRows = payrollFormulaRows.map((source, index) => {
      const row = index + 5
      return {
        'Employee code': accountantFormula(`'Payroll Formulas'!A${row}`, String(source['Employee code'] || '')),
        Employee: accountantFormula(`'Payroll Formulas'!B${row}`, String(source.Employee || '')),
        Period: `${periodStart} to ${periodEnd}`,
        'Base pay (VND)': accountantFormula(`'Payroll Formulas'!AG${row}`, Number((source['Base pay (VND)'] as { result?: number }).result || 0), 'currency'),
        'Meal allowance (VND)': accountantFormula(`'Payroll Formulas'!AH${row}`, Number((source['Meal allowance (VND)'] as { result?: number }).result || 0), 'currency'),
        'Overtime pay (VND)': accountantFormula(`'Payroll Formulas'!AI${row}`, Number((source['Overtime pay (VND)'] as { result?: number }).result || 0), 'currency'),
        'Gross income (VND)': accountantFormula(`'Payroll Formulas'!AJ${row}`, Number((source['Gross income (VND)'] as { result?: number }).result || 0), 'currency'),
        'Employee insurance (VND)': accountantFormula(`'Payroll Formulas'!AL${row}`, Number((source['Employee insurance (VND)'] as { result?: number }).result || 0), 'currency'),
        'PIT withheld (VND)': accountantFormula(`'Payroll Formulas'!AN${row}`, Number((source['PIT withheld (VND)'] as { result?: number }).result || 0), 'currency'),
        'Net payable (VND)': accountantFormula(`'Payroll Formulas'!AO${row}`, Number((source['Net payable (VND)'] as { result?: number }).result || 0), 'currency'),
      }
    })

    const instructionRows = [
      { Step: '1', Action: 'Complete employee records', Details: 'Legal identity, contract dates, salary/rate, tax, insurance, bank, and documents are maintained in HR > Employee profiles.' },
      { Step: '2', Action: 'Publish schedules and approve attendance', Details: 'Payroll uses the selected period. Review worked time, paid leave, overtime, and missing clock-outs before export.' },
      { Step: '3', Action: 'Review payroll policy', Details: `Company policy ${hrSettings.policy_version} is effective ${hrSettings.effective_from}. Confirm legal-source and review dates in Calculation Basis before approval.` },
      { Step: '4', Action: 'Reconcile', Details: 'Contract Checks, Bank Transfer, and Reconciliation must show OK before sending the workbook.' },
      { Step: '5', Action: 'Send to accountant', Details: 'Open in Microsoft Excel and allow recalculation. Blue headers are inputs/identifiers; calculated payroll values contain live formulas.' },
      { Step: 'Policy', Action: '2026 Vietnam PIT', Details: 'Progressive bands: 5% to 10M, 10% to 30M, 20% to 60M, 30% to 100M, 35% above 100M; self deduction 15.5M and dependent deduction 6.2M.' },
      { Step: 'Control', Action: 'Source workbook', Details: 'Functional specification: VR_Payroll_July_2026_Emile_V2. The app export is normalized for human HR and accountant review.' },
    ]

    const historicalComparisonSheets = historicalSnapshots.length > 0
      ? [
        { title: 'Source Payroll', description: 'Protected source payroll imported from the authoritative workbook. These values are reference inputs, not the live calculation.', rows: historicalPayrollRows },
        { title: 'Source Comparison', description: 'Employee-by-employee comparison between the timesheet-based live calculation and the authoritative source payroll.', rows: historicalComparisonRows },
      ]
      : []

    // Keep the normalized audit tables available while the exact accountant-template
    // export is the active download path. They remain useful for parity checks and a
    // controlled fallback without changing the workbook handed to the accountant.
    void [paidLeaveRows, adjustmentRows, contractCheckRows, payrollTotalRow, summaryRows, leaveBalanceRows, bankTransferRows, reconciliationRows, payslipRows, instructionRows, historicalComparisonSheets]

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const accessToken = sessionData.session?.access_token || ''
      const { submitAccountantPayrollDownload } = await import('../../lib/accountantPayrollBrowserDownload')
      submitAccountantPayrollDownload({
        accessToken,
        operatorToken: getStaffKioskOperatorToken(),
        filename: `vrena-payroll-${periodStart}-${periodEnd}.xlsx`,
        input: {
          periodStart,
          periodEnd,
          ...(historicalSourceKey ? {
            sourceWorkbookKey: historicalSourceKey,
            sourceWorkbookRowCount: historicalSnapshots.length,
          } : {}),
          payrollRows: payrollFormulaRows,
          employeeRows: exportEmployeeRows,
          attendanceRows,
          calculationBasisRows,
        },
      })
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
      return false
    }
  }

  return { downloadPayrollExcel }
}
