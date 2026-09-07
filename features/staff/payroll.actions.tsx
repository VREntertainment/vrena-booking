'use client'

import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  hoursLabel,
  orderedRange,
  rangeLabel,
  staffDateLabel,
  todayString
} from '../../lib/staff/dates'
import {
  formatVnd,
  parseDong
} from '../../lib/staff/formatting'
import {
  defaultHrAdjustmentForm,
  normalizeHrAdjustmentStatus,
  normalizeHrAdjustmentType,
  normalizePayrollPayCycle,
  normalizeStaffContractStatus
} from '../../lib/staff/hrSettings'
import {
  emptyStaffPayrollCalculation
} from '../../lib/staff/payroll'
import {
  customerName
} from '../../lib/staff/profiles'
import {
  downloadPdf
} from '../../lib/staff/reportExports'
import type {
  StaffHrAdjustment,
  StaffHrAdjustmentStatus,
  StaffPayrollRun
} from '../../lib/staff/types'
import { supabase } from '../../lib/supabase/client'

export type PayrollActionContext = {
  isOwnerOrAdmin: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  setStatus: React.Dispatch<React.SetStateAction<string>>
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  loadHrData: (force?: boolean) => Promise<void>
  canManageAttendance: boolean
  hrAdjustmentForm: { id: string; profile_id: string; adjustment_type: import("../../lib/staff/types").StaffHrAdjustmentType; title: string; amount_vnd: string; effective_date: string; period_start: string; period_end: string; status: import("../../lib/staff/types").StaffHrAdjustmentStatus; notes: string }
  selectedEmployeeStaffId: string
  firstEmployeeStaffProfileId: string
  text: StaffConsoleCopy
  profile: import("../../lib/staff/types").StaffProfile | null
  setHrAdjustmentForm: React.Dispatch<React.SetStateAction<{ id: string; profile_id: string; adjustment_type: import("../../lib/staff/types").StaffHrAdjustmentType; title: string; amount_vnd: string; effective_date: string; period_start: string; period_end: string; status: import("../../lib/staff/types").StaffHrAdjustmentStatus; notes: string }>>
  payrollRunForm: { id: string; code: string; name: string; pay_cycle: import("../../lib/staff/types").StaffPayrollPayCycle; period_start: string; period_end: string; notes: string }
  visibleStaffProfileOptions: import("../../lib/staff/types").StaffProfile[]
  staffPayrollCalculations: Map<string, import("../../lib/staff/types").StaffPayrollCalculation>
  employeeProfileById: Map<string, import("../../lib/staff/types").StaffEmployeeProfile>
  profileById: Map<string, import("../../lib/staff/types").StaffProfile>
  hrSettings: import("../../lib/staff/types").StaffHrSettings
  staffCostAllocations: Map<string, { shares: { location: string; paidMinutes: number; companyCost: number }[]; needsPaidHours: boolean }>
  costAssignments: import("../../lib/staffCostAllocation").StaffCostAssignment[]
  setPayrollRunForm: React.Dispatch<React.SetStateAction<{ id: string; code: string; name: string; pay_cycle: import("../../lib/staff/types").StaffPayrollPayCycle; period_start: string; period_end: string; notes: string }>>
  payrollPeriodStart: string
  payrollPeriodEnd: string
  attendanceSettings: import("../../lib/staff/types").StaffAttendanceSettings
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffPayrollActions(getContext: () => PayrollActionContext) {
  async function syncPayrollDraft() {
    const { isOwnerOrAdmin, setSaving, setStatus, resolvedLanguage, markStaffDataStale, loadHrData } = getContext()

    if (!isOwnerOrAdmin) return
    setSaving(true)
    const { data, error } = await supabase.rpc('staff_sync_payroll_draft', {
      p_run_date: todayString(),
      p_force: true,
    })
    setStatus(error
      ? error.message
      : resolvedLanguage === 'vi'
        ? `Đã đồng bộ bảng lương tự động (${Number(data?.item_count) || 0} nhân viên).`
        : `Automatic payroll synchronized (${Number(data?.item_count) || 0} employees).`)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function saveHrAdjustment(kind: 'adjustment' | 'advance' = 'adjustment') {
    const {
      canManageAttendance,
      hrAdjustmentForm,
      selectedEmployeeStaffId,
      firstEmployeeStaffProfileId,
      text,
      profile,
      setSaving,
      setStatus,
      setHrAdjustmentForm,
      markStaffDataStale,
      loadHrData,
    } = getContext()

    if (!canManageAttendance) return
    const profileId = hrAdjustmentForm.profile_id || selectedEmployeeStaffId || firstEmployeeStaffProfileId
    if (!profileId) return
    const adjustmentType = kind === 'advance' && !['advance', 'debt', 'debt_repayment'].includes(hrAdjustmentForm.adjustment_type)
      ? 'advance'
      : normalizeHrAdjustmentType(hrAdjustmentForm.adjustment_type)
    const payload = {
      profile_id: profileId,
      adjustment_type: adjustmentType,
      title: hrAdjustmentForm.title.trim() || text.adjustmentTypes[adjustmentType],
      amount_vnd: parseDong(hrAdjustmentForm.amount_vnd),
      effective_date: hrAdjustmentForm.effective_date || todayString(),
      period_start: hrAdjustmentForm.period_start || null,
      period_end: hrAdjustmentForm.period_end || null,
      status: normalizeHrAdjustmentStatus(hrAdjustmentForm.status),
      notes: hrAdjustmentForm.notes.trim() || null,
      created_by: profile?.id || null,
    }
    setSaving(true)
    const query = hrAdjustmentForm.id
      ? supabase.from('staff_hr_adjustments').update(payload).eq('id', hrAdjustmentForm.id)
      : supabase.from('staff_hr_adjustments').insert(payload)
    const { error } = await query
    setStatus(error ? error.message : text.messages.adjustmentSaved)
    if (!error) {
      setHrAdjustmentForm(defaultHrAdjustmentForm(profileId, kind === 'advance' ? 'advance' : 'bonus'))
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function updateHrAdjustmentStatus(adjustment: StaffHrAdjustment, statusValue: StaffHrAdjustmentStatus) {
    const { canManageAttendance, setSaving, profile, setStatus, text, markStaffDataStale, loadHrData } = getContext()

    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase
      .from('staff_hr_adjustments')
      .update({
        status: statusValue,
        validated_by: ['approved', 'rejected'].includes(statusValue) ? profile?.id || null : adjustment.validated_by,
        validated_at: ['approved', 'rejected'].includes(statusValue) ? new Date().toISOString() : adjustment.validated_at,
      })
      .eq('id', adjustment.id)
    setStatus(error ? error.message : statusValue === 'approved' ? text.messages.adjustmentApproved : text.messages.adjustmentSaved)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function generatePayrollRun() {
    const {
      canManageAttendance,
      payrollRunForm,
      visibleStaffProfileOptions,
      staffPayrollCalculations,
      setSaving,
      text,
      profile,
      setStatus,
      employeeProfileById,
      profileById,
      hrSettings,
      staffCostAllocations,
      costAssignments,
      setPayrollRunForm,
      markStaffDataStale,
      loadHrData,
    } = getContext()

    if (!canManageAttendance) return
    const [periodStart, periodEnd] = orderedRange(payrollRunForm.period_start, payrollRunForm.period_end)
    const calculations = visibleStaffProfileOptions.map((staffProfile) => staffPayrollCalculations.get(staffProfile.id) || emptyStaffPayrollCalculation(staffProfile.id))
    const totals = calculations.reduce((sum, item) => ({
      gross: sum.gross + item.grossIncome,
      net: sum.net + item.netIncome,
      companyCost: sum.companyCost + item.companyCost,
    }), { gross: 0, net: 0, companyCost: 0 })

    setSaving(true)
    const { data: runData, error: runError } = await supabase
      .from('staff_payroll_runs')
      .upsert({
        code: payrollRunForm.code.trim() || `PAY-${periodStart.replace(/-/g, '')}`,
        name: payrollRunForm.name.trim() || `${text.labels.payrollRun} ${rangeLabel(periodStart, periodEnd)}`,
        pay_cycle: normalizePayrollPayCycle(payrollRunForm.pay_cycle),
        period_start: periodStart,
        period_end: periodEnd,
        status: 'draft',
        total_gross_vnd: totals.gross,
        total_net_vnd: totals.net,
        total_company_cost_vnd: totals.companyCost,
        generated_by: profile?.id || null,
        notes: payrollRunForm.notes.trim() || null,
      }, { onConflict: 'code' })
      .select('*')
      .single()

    if (runError || !runData) {
      setStatus(runError?.message || text.messages.hrSetupUnavailable)
      setSaving(false)
      return
    }

    const run = runData as StaffPayrollRun
    const rows = calculations.map((item) => {
      const employee = employeeProfileById.get(item.profileId)
      const staffProfile = profileById.get(item.profileId)
      const payslipNumber = `${run.code}-${employee?.employee_code || item.profileId.slice(0, 6)}`
      return {
        payroll_run_id: run.id,
        profile_id: item.profileId,
        payslip_number: payslipNumber,
        worked_minutes: item.workedMinutes,
        regular_minutes: item.regularMinutes,
        overtime_minutes: item.overtimeMinutes,
        night_minutes: item.nightMinutes,
        holiday_minutes: item.holidayMinutes,
        paid_leave_hours: item.paidLeaveHours,
        rest_warning_count: item.restWarningCount,
        base_salary_vnd: item.basePay,
        overtime_pay_vnd: item.overtimePay,
        allowances_vnd: item.allowances,
        bonuses_vnd: item.bonuses,
        advances_vnd: item.advances,
        deductions_vnd: item.deductions,
        employee_contributions_vnd: item.employeeContributions,
        employer_contributions_vnd: item.employerContributions,
        pit_withholding_vnd: item.pitWithheld,
        gross_income_vnd: item.grossIncome,
        net_income_vnd: item.netIncome,
        company_cost_vnd: item.companyCost,
        status: 'draft',
        payslip_snapshot: {
          employeeCode: employee?.employee_code || null,
          employeeName: employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : ''),
          periodStart,
          periodEnd,
          currency: hrSettings.currency,
          note: hrSettings.payslip_note || null,
          workedDays: item.workedDays,
          periodStandardMinutes: item.periodStandardMinutes,
          salaryPaidMinutes: item.salaryPaidMinutes,
          paidLeaveDays: item.paidLeaveDays,
          payrollHourlyRateVnd: item.hourlyRate,
          mealAllowanceVnd: item.mealAllowance,
          otherAllowancesVnd: item.otherAllowances,
          probationBonusPercentage: Number(employee?.probation_bonus_percentage) === 85 ? 85 : 100,
          probationBonusApplied: true,
          contributionBaseVnd: item.contributionBase,
          costAllocation: staffCostAllocations.get(item.profileId),
          costAssignments: costAssignments.filter((row) => row.profile_id === item.profileId && !row.cancelled_at && row.start_date <= periodEnd && row.end_date >= periodStart),
          mainWorkLocation: employee?.main_work_location || null,
          payrollLocation: employee?.payroll_location || null,
          policyReference: 'VR_ Payroll July - 260805.xlsx · HR Employee Master',
        },
      }
    })
    const { error: itemError } = await supabase
      .from('staff_payroll_items')
      .upsert(rows, { onConflict: 'payroll_run_id,profile_id' })

    const correctionResults = itemError ? [] : await Promise.all(rows.map((row) => (
      supabase
        .from('staff_payroll_items')
        .update({
          base_salary_vnd: row.base_salary_vnd,
          overtime_pay_vnd: row.overtime_pay_vnd,
          allowances_vnd: row.allowances_vnd,
          employee_contributions_vnd: row.employee_contributions_vnd,
          employer_contributions_vnd: row.employer_contributions_vnd,
          pit_withholding_vnd: row.pit_withholding_vnd,
          net_income_vnd: row.net_income_vnd,
          company_cost_vnd: row.company_cost_vnd,
          payslip_snapshot: row.payslip_snapshot,
        })
        .eq('payroll_run_id', row.payroll_run_id)
        .eq('profile_id', row.profile_id)
    )))
    const correctionError = correctionResults.find((result) => result.error)?.error

    setStatus(itemError?.message || correctionError?.message || text.messages.payrollGenerated)
    if (!itemError && !correctionError) {
      setPayrollRunForm({ ...payrollRunForm, id: run.id })
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function approvePayrollRun(run: StaffPayrollRun) {
    const { canManageAttendance, setSaving, profile, setStatus, text, markStaffDataStale, loadHrData } = getContext()

    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase
      .from('staff_payroll_runs')
      .update({ status: 'approved', approved_by: profile?.id || null, approved_at: new Date().toISOString() })
      .eq('id', run.id)
    setStatus(error ? error.message : text.messages.payrollApproved)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function downloadEmployeePayslip(staffProfileId = getContext().selectedEmployeeStaffId) {
    const { profileById, employeeProfileById, staffPayrollCalculations, text, payrollPeriodStart, payrollPeriodEnd, attendanceSettings, hrSettings } = getContext()

    const staffProfile = profileById.get(staffProfileId)
    const employee = employeeProfileById.get(staffProfileId)
    const calculation = staffPayrollCalculations.get(staffProfileId) || emptyStaffPayrollCalculation(staffProfileId)
    const displayName = employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : text.customerFallback)
    const lines = [
      'PHIEU LUONG / PAYSLIP',
      `Company: VRena`,
      `Payroll period: ${staffDateLabel(payrollPeriodStart)} - ${staffDateLabel(payrollPeriodEnd)}`,
      `Employee: ${displayName}`,
      `Employee code: ${employee?.employee_code || '-'}`,
      `Attendance number: ${employee?.attendance_number || '-'}`,
      `Workplace: ${employee?.main_work_location || attendanceSettings.location}`,
      `Contract: ${employee?.contract_type || '-'} / ${text.contractStatuses[normalizeStaffContractStatus(employee?.contract_status)]}`,
      '',
      `${text.labels.workedHours}: ${hoursLabel(calculation.workedMinutes)}`,
      `Paid leave: ${Number(calculation.paidLeaveDays.toFixed(2))} ${text.days} / ${Number(calculation.paidLeaveHours.toFixed(2))}h`,
      `Payroll basis: ${calculation.payrollBasis === 'published_schedule' ? 'published schedule' : 'working calendar'} (${Number(calculation.periodStandardDays.toFixed(2))} days)`,
      `Salary-paid days: ${Number(calculation.salaryPaidDays.toFixed(2))}`,
      `Salary-paid hours: ${hoursLabel(calculation.salaryPaidMinutes)}`,
      `${text.labels.overtimeHours}: ${hoursLabel(calculation.overtimeMinutes)}`,
      `${text.labels.leaveBalance}: ${Number(calculation.leaveBalanceDays.toFixed(2))} ${text.days}`,
      '',
      `${text.labels.baseSalary}: ${formatVnd(calculation.basePay)}`,
      `${text.labels.overtimePay}: ${formatVnd(calculation.overtimePay)}`,
      `Meal allowance: ${formatVnd(calculation.mealAllowance)}`,
      `${text.labels.allowances}: ${formatVnd(calculation.otherAllowances)}`,
      `${text.labels.bonuses}: ${formatVnd(calculation.bonuses)}`,
      `${text.labels.grossIncome}: ${formatVnd(calculation.grossIncome)}`,
      `${text.labels.employeeContributions}: ${formatVnd(calculation.employeeContributions)}`,
      `${text.labels.pitWithheld}: ${formatVnd(calculation.pitWithheld)}`,
      `${text.labels.advances}: ${formatVnd(calculation.advances)}`,
      `${text.labels.deductions}: ${formatVnd(calculation.deductions)}`,
      `${text.labels.netIncome}: ${formatVnd(calculation.netIncome)}`,
      `${text.labels.companyCost}: ${formatVnd(calculation.companyCost)}`,
      '',
      hrSettings.payslip_note || '',
    ].filter((line) => line !== '')
    await downloadPdf(`payslip-${employee?.employee_code || staffProfileId.slice(0, 8)}-${payrollPeriodStart}.pdf`, lines, text)
  }

  return { syncPayrollDraft, saveHrAdjustment, updateHrAdjustmentStatus, generatePayrollRun, approvePayrollRun, downloadEmployeePayslip }
}
