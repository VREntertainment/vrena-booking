'use client'

import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  todayString
} from '../../lib/staff/dates'
import { isStaffHrPermissionDenied, isStaffHrSchemaUnavailable } from '../../lib/staff/errors'
import {
  defaultHrSettings,
  normalizeHrSettings
} from '../../lib/staff/hrSettings'
import type {
  StaffHrAdjustment,
  StaffHrDocument,
  StaffHrSettings,
  StaffHrSetupOption,
  StaffHrSetupOptionType,
  StaffPayrollItem,
  StaffPayrollRun,
  StaffPayrollSourceSnapshot
} from '../../lib/staff/types'
import { type StaffCostAssignment } from '../../lib/staffCostAllocation'
import { supabase } from '../../lib/supabase/client'

export type SettingsActionContext = {
  runStaffLoader: (key: import("../../lib/staff/types").StaffDataKey, loader: () => Promise<void>, force?: boolean) => Promise<void>
  canAccessHrSettings: boolean
  setHrSettings: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffHrSettings>>
  setHrSetupOptions: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffHrSetupOption[]>>
  setHrAdjustments: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffHrAdjustment[]>>
  setPayrollRuns: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffPayrollRun[]>>
  setPayrollItems: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffPayrollItem[]>>
  setPayrollSourceSnapshots: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffPayrollSourceSnapshot[]>>
  setHrDocuments: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffHrDocument[]>>
  setCostAssignments: React.Dispatch<React.SetStateAction<import("../../lib/staffCostAllocation").StaffCostAssignment[]>>
  canManageAttendance: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  hrSettings: import("../../lib/staff/types").StaffHrSettings
  profile: import("../../lib/staff/types").StaffProfile | null
  setStatus: React.Dispatch<React.SetStateAction<string>>
  text: StaffConsoleCopy
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  hrSetupForm: Record<import("../../lib/staff/types").StaffHrSetupOptionType, string>
  setHrSetupForm: React.Dispatch<React.SetStateAction<Record<import("../../lib/staff/types").StaffHrSetupOptionType, string>>>
  loadAttendanceData: (force?: boolean) => Promise<void>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffSettingsActions(getContext: () => SettingsActionContext) {
  async function loadHrData(force = false) {
    const {
      runStaffLoader,
      canAccessHrSettings,
      setHrSettings,
      setHrSetupOptions,
      setHrAdjustments,
      setPayrollRuns,
      setPayrollItems,
      setPayrollSourceSnapshots,
      setHrDocuments,
      setCostAssignments,
    } = getContext()

    await runStaffLoader('hr', async () => {
      if (!canAccessHrSettings) {
        setHrSettings(defaultHrSettings())
        setHrSetupOptions([])
        setHrAdjustments([])
        setPayrollRuns([])
        setPayrollItems([])
        setPayrollSourceSnapshots([])
        setHrDocuments([])
        setCostAssignments([])
        return
      }
      const [settingsResult, optionsResult, adjustmentsResult, payrollRunsResult, payrollItemsResult, sourceSnapshotsResult, documentsResult, costAssignmentsResult] = await Promise.all([
        supabase
          .from('staff_hr_settings')
          .select('*')
          .eq('id', 'default')
          .maybeSingle(),
        supabase
          .from('staff_hr_setup_options')
          .select('*')
          .is('deleted_at', null)
          .order('option_type', { ascending: true })
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('staff_hr_adjustments')
          .select('*')
          .is('deleted_at', null)
          .order('effective_date', { ascending: false })
          .limit(500),
        supabase
          .from('staff_payroll_runs')
          .select('*')
          .is('deleted_at', null)
          .order('period_start', { ascending: false })
          .limit(50),
        supabase
          .from('staff_payroll_items')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('staff_payroll_source_snapshots')
          .select('*')
          .order('period_start', { ascending: false })
          .order('employee_code', { ascending: true })
          .limit(500),
        supabase
          .from('staff_hr_documents')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('staff_cost_assignments').select('*').is('cancelled_at', null).order('start_date', { ascending: false }),
      ])

      const coreResults = [settingsResult, optionsResult, adjustmentsResult, payrollRunsResult, payrollItemsResult, documentsResult, costAssignmentsResult]
      const blockingError = coreResults.find((result) => result.error && !isStaffHrSchemaUnavailable(result.error))?.error
        ?? (sourceSnapshotsResult.error && !isStaffHrSchemaUnavailable(sourceSnapshotsResult.error) && !isStaffHrPermissionDenied(sourceSnapshotsResult.error)
          ? sourceSnapshotsResult.error
          : null)
      if (blockingError) throw new Error(blockingError.message)

      const hrUnavailable = coreResults.some((result) => result.error && isStaffHrSchemaUnavailable(result.error))
      if (hrUnavailable) {
        setHrSettings(defaultHrSettings())
        setHrSetupOptions([])
        setHrAdjustments([])
        setPayrollRuns([])
        setPayrollItems([])
        setPayrollSourceSnapshots([])
        setHrDocuments([])
        setCostAssignments([])
        return
      }

      setHrSettings(normalizeHrSettings(settingsResult.data as Partial<StaffHrSettings> | null))
      setHrSetupOptions((optionsResult.data ?? []) as StaffHrSetupOption[])
      setHrAdjustments((adjustmentsResult.data ?? []) as StaffHrAdjustment[])
      setPayrollRuns((payrollRunsResult.data ?? []) as StaffPayrollRun[])
      setPayrollItems((payrollItemsResult.data ?? []) as StaffPayrollItem[])
      setPayrollSourceSnapshots(sourceSnapshotsResult.error ? [] : (sourceSnapshotsResult.data ?? []) as StaffPayrollSourceSnapshot[])
      setHrDocuments((documentsResult.data ?? []) as StaffHrDocument[])
      setCostAssignments((costAssignmentsResult.data ?? []) as StaffCostAssignment[])
    }, force)
  }

  async function saveHrSettings() {
    const { canManageAttendance, setSaving, hrSettings, profile, setStatus, text, markStaffDataStale } = getContext()

    if (!canManageAttendance) return
    setSaving(true)
    const payload = {
      id: 'default',
      currency: hrSettings.currency.trim() || 'VND',
      standard_monthly_days: Math.max(1, Number(hrSettings.standard_monthly_days) || 26),
      standard_monthly_hours: Math.max(1, Number(hrSettings.standard_monthly_hours) || 208),
      rest_period_minutes: Math.max(0, Number(hrSettings.rest_period_minutes) || 0),
      normal_overtime_multiplier: Math.max(0, Number(hrSettings.normal_overtime_multiplier) || 0),
      night_overtime_multiplier: Math.max(0, Number(hrSettings.night_overtime_multiplier) || 0),
      holiday_overtime_multiplier: Math.max(0, Number(hrSettings.holiday_overtime_multiplier) || 0),
      lunch_allowance_vnd: Math.max(0, Number(hrSettings.lunch_allowance_vnd) || 0),
      annual_leave_days: Math.max(0, Number(hrSettings.annual_leave_days) || 0),
      employee_contribution_rate: Math.max(0, Number(hrSettings.employee_contribution_rate) || 0),
      employer_contribution_rate: Math.max(0, Number(hrSettings.employer_contribution_rate) || 0),
      pit_withholding_rate: Math.max(0, Number(hrSettings.pit_withholding_rate) || 0),
      policy_version: hrSettings.policy_version.trim() || 'VN-2026.1',
      effective_from: hrSettings.effective_from || todayString(),
      policy_status: hrSettings.policy_status,
      legal_source_url: hrSettings.legal_source_url?.trim() || null,
      legal_reviewed_on: hrSettings.legal_reviewed_on || null,
      personal_deduction_vnd: Math.max(0, Number(hrSettings.personal_deduction_vnd) || 0),
      dependent_deduction_vnd: Math.max(0, Number(hrSettings.dependent_deduction_vnd) || 0),
      short_term_pit_rate: Math.max(0, Number(hrSettings.short_term_pit_rate) || 0),
      pit_brackets: hrSettings.pit_brackets,
      employee_social_insurance_rate: Math.max(0, Number(hrSettings.employee_social_insurance_rate) || 0),
      employee_health_insurance_rate: Math.max(0, Number(hrSettings.employee_health_insurance_rate) || 0),
      employee_unemployment_insurance_rate: Math.max(0, Number(hrSettings.employee_unemployment_insurance_rate) || 0),
      employer_social_insurance_rate: Math.max(0, Number(hrSettings.employer_social_insurance_rate) || 0),
      employer_health_insurance_rate: Math.max(0, Number(hrSettings.employer_health_insurance_rate) || 0),
      employer_unemployment_insurance_rate: Math.max(0, Number(hrSettings.employer_unemployment_insurance_rate) || 0),
      employer_trade_union_rate: Math.max(0, Number(hrSettings.employer_trade_union_rate) || 0),
      night_work_bonus_rate: Math.max(0, Number(hrSettings.night_work_bonus_rate) || 0),
      night_overtime_extra_rate: Math.max(0, Number(hrSettings.night_overtime_extra_rate) || 0),
      leave_accrual_days_per_month: Math.max(0, Number(hrSettings.leave_accrual_days_per_month) || 0),
      leave_qualifying_worked_days: Math.max(0, Math.round(Number(hrSettings.leave_qualifying_worked_days) || 0)),
      leave_join_cutoff_day: Math.min(31, Math.max(1, Math.round(Number(hrSettings.leave_join_cutoff_day) || 1))),
      leave_exit_cutoff_day: Math.min(31, Math.max(1, Math.round(Number(hrSettings.leave_exit_cutoff_day) || 1))),
      leave_carry_forward_month: Math.min(12, Math.max(1, Math.round(Number(hrSettings.leave_carry_forward_month) || 1))),
      leave_carry_forward_day: Math.min(31, Math.max(1, Math.round(Number(hrSettings.leave_carry_forward_day) || 1))),
      pay_period_start_day: Math.min(28, Math.max(1, Math.round(Number(hrSettings.pay_period_start_day) || 1))),
      auto_create_payroll_runs: Boolean(hrSettings.auto_create_payroll_runs),
      auto_update_payroll_daily: Boolean(hrSettings.auto_update_payroll_daily),
      personal_income_tax_enabled: Boolean(hrSettings.personal_income_tax_enabled),
      social_insurance_enabled: Boolean(hrSettings.social_insurance_enabled),
      payslip_note: hrSettings.payslip_note?.trim() || null,
      updated_by: profile?.id || null,
    }
    const { error } = await supabase.from('staff_hr_settings').upsert(payload, { onConflict: 'id' })
    setStatus(error ? error.message : text.messages.hrSettingsSaved)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function saveHrSetupOption(optionType: StaffHrSetupOptionType) {
    const { canManageAttendance, hrSetupForm, setSaving, setStatus, text, setHrSetupForm, markStaffDataStale } = getContext()

    if (!canManageAttendance) return
    const name = hrSetupForm[optionType].trim()
    if (!name) return
    setSaving(true)
    const { error } = await supabase.rpc('staff_upsert_hr_setup_option', {
      p_option_type: optionType,
      p_name: name,
    })
    setStatus(error ? error.message : text.messages.hrSetupOptionSaved)
    if (!error) {
      setHrSetupForm((current) => ({ ...current, [optionType]: '' }))
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function updateHrSetupOption(optionId: string, name: string) {
    const { canManageAttendance, setSaving, setStatus, text, markStaffDataStale, loadAttendanceData } = getContext()

    if (!canManageAttendance || !optionId || !name.trim()) return false
    setSaving(true)
    const { error } = await supabase.rpc('staff_update_hr_setup_option', {
      p_option_id: optionId,
      p_name: name.trim(),
    })
    setStatus(error ? error.message : text.messages.hrSetupOptionSaved)
    if (!error) {
      markStaffDataStale('attendance', 'hr')
      await Promise.all([loadAttendanceData(true), loadHrData(true)])
    }
    setSaving(false)
    return !error
  }

  async function setHrSetupOptionActive(optionId: string, active: boolean) {
    const { canManageAttendance, setSaving, setStatus, text, markStaffDataStale } = getContext()

    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase.rpc('staff_set_hr_setup_option_active', {
      p_option_id: optionId,
      p_active: active,
    })
    setStatus(error ? error.message : text.messages.hrSetupOptionSaved)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  return { loadHrData, saveHrSettings, saveHrSetupOption, updateHrSetupOption, setHrSetupOptionActive }
}
