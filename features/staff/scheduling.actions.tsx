'use client'

import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  addDays,
  attendanceDateRange,
  attendanceRangeLength,
  attendanceWeekRange,
  localDateTimeIso,
  normalizeTime,
  orderedRange,
  timeValueFromIso,
  todayString
} from '../../lib/staff/dates'
import {
  defaultAttendanceLogForm,
  defaultAttendanceSettings,
  defaultLeaveForm,
  defaultShiftForm,
  defaultStaffShiftTemplates,
  minutesSetting,
  normalizeAttendanceSettings,
  normalizeStaffShiftTemplates
} from '../../lib/staff/hrSettings'
import {
  staffHrDocumentBucket
} from '../../lib/staff/options'
import {
  staffProfileFromEmployee
} from '../../lib/staff/profiles'
import type {
  StaffAttendanceLog,
  StaffAttendanceSettings,
  StaffEmployeeProfile,
  StaffLeaveRequest,
  StaffLeaveStatus,
  StaffScheduleShift,
  StaffShiftStatus,
  StaffShiftTemplate,
  StaffShiftTemplateId
} from '../../lib/staff/types'
import { isStaffKioskEligibleDepartment } from '../../lib/staffKioskDirectory'
import { supabase } from '../../lib/supabase/client'

export type SchedulingActionContext = {
  runStaffLoader: (key: import("../../lib/staff/types").StaffDataKey, loader: () => Promise<void>, force?: boolean) => Promise<void>
  currentTab: import("../../lib/staff/types").StaffTab
  payrollPeriodStart: string
  payrollPeriodEnd: string
  attendanceWeekStart: string
  attendanceWeekEnd: string
  canViewAllEmployeeProfiles: boolean
  setAttendanceShifts: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffScheduleShift[]>>
  setAttendanceLogs: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffAttendanceLog[]>>
  setLeaveRequests: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffLeaveRequest[]>>
  setAttendanceSettings: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffAttendanceSettings>>
  setEmployeeProfiles: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffEmployeeProfile[]>>
  setEmployeePhotoUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>
  employeeForm: { profile_id: string; employee_code: string; attendance_number: string; legal_name: string; personal_phone: string; personal_email: string; national_id: string; date_of_birth: string; gender: string; address: string; department: string; job_title: string; employment_type: import("../../lib/staff/types").StaffEmploymentType; main_work_location: string; payroll_location: string; contract_status: import("../../lib/staff/types").StaffContractStatus; contract_type: string; contract_start_date: string; contract_end_date: string; probation_payroll_type: "monthly" | "manager" | "hourly"; labor_payroll_type: "monthly" | "manager" | "hourly"; probation_salary_percentage: string; probation_bonus_percentage: string; probation_start_date: string; probation_end_date: string; labor_start_date: string; labor_end_date: string; start_date: string; end_date: string; base_salary_vnd: string; hourly_rate_vnd: string; monthly_bonus_vnd: string; lunch_allowance_vnd: string; rest_period_hours: string; overtime_rate_multiplier: string; night_rate_multiplier: string; holiday_rate_multiplier: string; employee_contribution_rate: string; employer_contribution_rate: string; pit_withholding_rate: string; dependents_count: string; bank_name: string; bank_account_number: string; tax_code: string; social_insurance_number: string; social_insurance_enrolled: boolean; social_insurance_salary_vnd: string; emergency_contact: string; emergency_contact_name: string; emergency_contact_relationship: string; emergency_contact_phone: string; google_drive_folder_url: string; payroll_note: string; profile_photo_path: string; cv_document_path: string; active: boolean; kiosk_access_role: "" | "manager" | "staff"; kiosk_pin_configured_at: string }
  setEmployeeForm: React.Dispatch<React.SetStateAction<{ profile_id: string; employee_code: string; attendance_number: string; legal_name: string; personal_phone: string; personal_email: string; national_id: string; date_of_birth: string; gender: string; address: string; department: string; job_title: string; employment_type: import("../../lib/staff/types").StaffEmploymentType; main_work_location: string; payroll_location: string; contract_status: import("../../lib/staff/types").StaffContractStatus; contract_type: string; contract_start_date: string; contract_end_date: string; probation_payroll_type: "monthly" | "manager" | "hourly"; labor_payroll_type: "monthly" | "manager" | "hourly"; probation_salary_percentage: string; probation_bonus_percentage: string; probation_start_date: string; probation_end_date: string; labor_start_date: string; labor_end_date: string; start_date: string; end_date: string; base_salary_vnd: string; hourly_rate_vnd: string; monthly_bonus_vnd: string; lunch_allowance_vnd: string; rest_period_hours: string; overtime_rate_multiplier: string; night_rate_multiplier: string; holiday_rate_multiplier: string; employee_contribution_rate: string; employer_contribution_rate: string; pit_withholding_rate: string; dependents_count: string; bank_name: string; bank_account_number: string; tax_code: string; social_insurance_number: string; social_insurance_enrolled: boolean; social_insurance_salary_vnd: string; emergency_contact: string; emergency_contact_name: string; emergency_contact_relationship: string; emergency_contact_phone: string; google_drive_folder_url: string; payroll_note: string; profile_photo_path: string; cv_document_path: string; active: boolean; kiosk_access_role: "" | "manager" | "staff"; kiosk_pin_configured_at: string }>>
  employeeFormForProfile: (staffProfile: import("../../lib/staff/types").StaffProfile, employee?: import("../../lib/staff/types").StaffEmployeeProfile | undefined) => { profile_id: string; employee_code: string; attendance_number: string; legal_name: string; personal_phone: string; personal_email: string; national_id: string; date_of_birth: string; gender: "" | import("../../lib/staff/types").StaffGender; address: string; department: string; job_title: string; employment_type: import("../../lib/staff/types").StaffEmploymentType; main_work_location: string; payroll_location: string; contract_status: import("../../lib/staff/types").StaffContractStatus; contract_type: string; contract_start_date: string; contract_end_date: string; probation_payroll_type: "monthly" | "manager" | "hourly"; labor_payroll_type: "monthly" | "manager" | "hourly"; probation_salary_percentage: string; probation_bonus_percentage: string; probation_start_date: string; probation_end_date: string; labor_start_date: string; labor_end_date: string; start_date: string; end_date: string; base_salary_vnd: string; hourly_rate_vnd: string; monthly_bonus_vnd: string; lunch_allowance_vnd: string; rest_period_hours: string; overtime_rate_multiplier: string; night_rate_multiplier: string; holiday_rate_multiplier: string; employee_contribution_rate: string; employer_contribution_rate: string; pit_withholding_rate: string; dependents_count: string; bank_name: string; bank_account_number: string; tax_code: string; social_insurance_number: string; social_insurance_enrolled: boolean; social_insurance_salary_vnd: string; emergency_contact: string; emergency_contact_name: string; emergency_contact_relationship: string; emergency_contact_phone: string; google_drive_folder_url: string; payroll_note: string; profile_photo_path: string; cv_document_path: string; active: boolean; kiosk_access_role: "" | "manager" | "staff"; kiosk_pin_configured_at: string }
  setEmployeeKioskPin: React.Dispatch<React.SetStateAction<string>>
  setEmployeeKioskPinConfirm: React.Dispatch<React.SetStateAction<string>>
  setEmployeeKioskPinSaveConfirmation: React.Dispatch<React.SetStateAction<"" | "created" | "replaced">>
  setEmployeeKioskPinVisibleValue: React.Dispatch<React.SetStateAction<string>>
  setEmployeeKioskPinEmailState: React.Dispatch<React.SetStateAction<"idle" | "sending" | "sent">>
  setEmployeeKioskPinEmailRecipient: React.Dispatch<React.SetStateAction<string>>
  setEmployeeKioskAccessRole: React.Dispatch<React.SetStateAction<"manager" | "staff">>
  employeeKioskPinProfileRef: React.RefObject<string>
  canRevealEmployeeKioskPin: boolean
  revealEmployeeKioskPin: (staffProfileId: string) => Promise<void>
  canManageAttendance: boolean
  shiftForm: { id: string; staff_profile_id: string; location: string; shift_role: string; shift_date: string; start_time: string; end_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffShiftStatus; notes: string }
  firstStaffProfileId: string
  employeeProfileById: Map<string, import("../../lib/staff/types").StaffEmployeeProfile>
  setStatus: React.Dispatch<React.SetStateAction<string>>
  text: StaffConsoleCopy
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  attendanceSettings: import("../../lib/staff/types").StaffAttendanceSettings
  profile: import("../../lib/staff/types").StaffProfile | null
  setShiftForm: React.Dispatch<React.SetStateAction<{ id: string; staff_profile_id: string; location: string; shift_role: string; shift_date: string; start_time: string; end_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffShiftStatus; notes: string }>>
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  setAttendanceTab: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffAttendanceTab>>
  effectiveShiftTemplates: import("../../lib/staff/types").StaffShiftTemplate[]
  setSelectedShiftTemplate: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffShiftTemplateId>>
  saving: boolean
  selectedShiftTemplate: import("../../lib/staff/types").StaffShiftTemplateId
  attendanceShifts: import("../../lib/staff/types").StaffScheduleShift[]
  isOwnerOrAdmin: boolean
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  setAttendanceRangeStart: React.Dispatch<React.SetStateAction<string>>
  setAttendanceRangeEnd: React.Dispatch<React.SetStateAction<string>>
  canEditAttendance: boolean
  attendanceLogForm: { id: string; staff_profile_id: string; shift_id: string; work_date: string; clock_in_time: string; clock_out_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffAttendanceStatus; regular_minutes: string; overtime_minutes: string; night_minutes: string; holiday_minutes: string; manager_note: string }
  setAttendanceLogForm: React.Dispatch<React.SetStateAction<{ id: string; staff_profile_id: string; shift_id: string; work_date: string; clock_in_time: string; clock_out_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffAttendanceStatus; regular_minutes: string; overtime_minutes: string; night_minutes: string; holiday_minutes: string; manager_note: string }>>
  leaveForm: { id: string; staff_profile_id: string; leave_type: import("../../lib/staff/types").StaffLeaveType; start_date: string; end_date: string; hours: string; reason: string }
  setLeaveForm: React.Dispatch<React.SetStateAction<{ id: string; staff_profile_id: string; leave_type: import("../../lib/staff/types").StaffLeaveType; start_date: string; end_date: string; hours: string; reason: string }>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffSchedulingActions(getContext: () => SchedulingActionContext) {
  async function loadAttendanceData(force = false) {
    const {
      runStaffLoader,
      currentTab,
      payrollPeriodStart,
      payrollPeriodEnd,
      attendanceWeekStart,
      attendanceWeekEnd,
      canViewAllEmployeeProfiles,
      setAttendanceShifts,
      setAttendanceLogs,
      setLeaveRequests,
      setAttendanceSettings,
      setEmployeeProfiles,
      setEmployeePhotoUrls,
      employeeForm,
      setEmployeeForm,
      employeeFormForProfile,
      setEmployeeKioskPin,
      setEmployeeKioskPinConfirm,
      setEmployeeKioskPinSaveConfirmation,
      setEmployeeKioskPinVisibleValue,
      setEmployeeKioskPinEmailState,
      setEmployeeKioskPinEmailRecipient,
      setEmployeeKioskAccessRole,
      employeeKioskPinProfileRef,
      canRevealEmployeeKioskPin,
      revealEmployeeKioskPin,
    } = getContext()

    await runStaffLoader('attendance', async () => {
      const [weekStart, weekEnd] = currentTab === 'hr'
        ? orderedRange(payrollPeriodStart, payrollPeriodEnd)
        : [attendanceWeekStart, attendanceWeekEnd]
      const employeeRequest = canViewAllEmployeeProfiles
        ? supabase
          .from('staff_employee_profiles')
          .select('*')
          .is('deleted_at', null)
          .order('legal_name', { ascending: true })
        : supabase.rpc('staff_employee_directory')
      const [shiftsResult, logsResult, leaveResult, settingsResult, employeeResult] = await Promise.all([
        supabase
          .from('staff_schedule_shifts')
          .select('*')
          .gte('shift_date', weekStart)
          .lte('shift_date', weekEnd)
          .is('deleted_at', null)
          .order('shift_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('staff_attendance_logs')
          .select('*')
          .gte('work_date', weekStart)
          .lte('work_date', weekEnd)
          .is('deleted_at', null)
          .order('work_date', { ascending: true })
          .order('clock_in_at', { ascending: true }),
        supabase
          .from('staff_leave_requests')
          .select('*')
          .gte('end_date', weekStart)
          .lte('start_date', weekEnd)
          .is('deleted_at', null)
          .order('start_date', { ascending: true }),
        supabase
          .from('staff_attendance_settings')
          .select('*')
          .eq('id', 'default')
          .maybeSingle(),
        employeeRequest,
      ])

      if (shiftsResult.error) throw new Error(shiftsResult.error.message)
      if (logsResult.error) throw new Error(logsResult.error.message)
      if (leaveResult.error) throw new Error(leaveResult.error.message)
      const settingsUnavailable = Boolean(settingsResult.error && (
        settingsResult.error.code === '42501' ||
        settingsResult.error.message.toLowerCase().includes('permission denied') ||
        settingsResult.error.message.includes('staff_attendance_settings')
      ))
      if (settingsResult.error && !settingsUnavailable) throw new Error(settingsResult.error.message)
      const employeeUnavailable = Boolean(employeeResult.error && (
        employeeResult.error.code === '42P01' ||
        employeeResult.error.code === '42501' ||
        employeeResult.error.message.toLowerCase().includes('permission denied') ||
        employeeResult.error.message.includes('staff_employee_profiles')
      ))
      if (employeeResult.error && !employeeUnavailable) throw new Error(employeeResult.error.message)

      setAttendanceShifts((shiftsResult.data ?? []) as StaffScheduleShift[])
      setAttendanceLogs((logsResult.data ?? []) as StaffAttendanceLog[])
      setLeaveRequests((leaveResult.data ?? []) as StaffLeaveRequest[])
      setAttendanceSettings(settingsUnavailable ? defaultAttendanceSettings() : normalizeAttendanceSettings(settingsResult.data as Partial<StaffAttendanceSettings> | null))
      const nextEmployeeProfiles = employeeUnavailable ? [] : (employeeResult.data ?? []) as StaffEmployeeProfile[]
      setEmployeeProfiles(nextEmployeeProfiles)
      const employeePhotoEntries = await Promise.all(
        nextEmployeeProfiles
          .filter((employee) => Boolean(employee.profile_photo_path))
          .map(async (employee) => {
            const { data, error } = await supabase.storage
              .from(staffHrDocumentBucket)
              .createSignedUrl(employee.profile_photo_path as string, 60 * 60)
            return [employee.profile_id, error ? '' : data?.signedUrl || ''] as const
          })
      )
      setEmployeePhotoUrls(Object.fromEntries(employeePhotoEntries.filter((entry) => Boolean(entry[1]))))

      if (nextEmployeeProfiles.length > 0 && !nextEmployeeProfiles.some((employee) => employee.profile_id === employeeForm.profile_id)) {
        const employee = nextEmployeeProfiles[0]
        const staffProfile = staffProfileFromEmployee(employee)
        setEmployeeForm(employeeFormForProfile(staffProfile, employee))
        setEmployeeKioskPin('')
        setEmployeeKioskPinConfirm('')
        setEmployeeKioskPinSaveConfirmation('')
        setEmployeeKioskPinVisibleValue('')
        setEmployeeKioskPinEmailState('idle')
        setEmployeeKioskPinEmailRecipient('')
        setEmployeeKioskAccessRole(employee.kiosk_access_role === 'manager' ? 'manager' : 'staff')
        employeeKioskPinProfileRef.current = employee.profile_id
        if (canRevealEmployeeKioskPin && isStaffKioskEligibleDepartment(employee.department)) {
          void revealEmployeeKioskPin(employee.profile_id)
        }
      }
    }, force)
  }

  async function saveShift() {
    const {
      canManageAttendance,
      shiftForm,
      firstStaffProfileId,
      employeeProfileById,
      setStatus,
      text,
      setSaving,
      attendanceSettings,
      profile,
      setShiftForm,
      markStaffDataStale,
    } = getContext()

    if (!canManageAttendance) return
    const staffProfileId = shiftForm.staff_profile_id || firstStaffProfileId
    if (!staffProfileId) return
    if (!shiftForm.id && employeeProfileById.get(staffProfileId)?.active === false) {
      setStatus(text.messages.inactiveEmployeePlanningBlocked)
      return
    }
    setSaving(true)
    const payload = {
      staff_profile_id: staffProfileId,
      location: shiftForm.location.trim() || attendanceSettings.location || 'VRena',
      shift_role: 'Staff',
      shift_date: shiftForm.shift_date,
      start_time: normalizeTime(shiftForm.start_time) || '09:00',
      end_time: normalizeTime(shiftForm.end_time) || '18:00',
      break_minutes: Number(shiftForm.break_minutes) || 0,
      status: shiftForm.status,
      notes: shiftForm.notes.trim() || null,
      created_by: profile?.id || null,
    }
    const request = shiftForm.id
      ? supabase.from('staff_schedule_shifts').update(payload).eq('id', shiftForm.id)
      : supabase.from('staff_schedule_shifts').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.shiftSaved)
    if (!error) {
      setShiftForm({ ...defaultShiftForm(attendanceSettings), staff_profile_id: payload.staff_profile_id, location: payload.location })
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function editShift(shift: StaffScheduleShift) {
    const { setShiftForm, setAttendanceTab } = getContext()

    setShiftForm({
      id: shift.id,
      staff_profile_id: shift.staff_profile_id,
      location: shift.location,
      shift_role: 'Staff',
      shift_date: shift.shift_date,
      start_time: normalizeTime(shift.start_time),
      end_time: normalizeTime(shift.end_time),
      break_minutes: String(shift.break_minutes),
      status: shift.status,
      notes: shift.notes || '',
    })
    setAttendanceTab('schedule')
  }

  async function updateShiftStatus(shift: StaffScheduleShift, status: StaffShiftStatus) {
    const { canManageAttendance, setSaving, setStatus, text, markStaffDataStale } = getContext()

    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase.from('staff_schedule_shifts').update({ status }).eq('id', shift.id)
    setStatus(error ? error.message : text.messages.shiftSaved)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function applyShiftTemplate(templateId: StaffShiftTemplateId) {
    const { effectiveShiftTemplates, setSelectedShiftTemplate, setShiftForm } = getContext()

    const template = effectiveShiftTemplates.find((item) => item.id === templateId) || effectiveShiftTemplates[0] || defaultStaffShiftTemplates[0]
    setSelectedShiftTemplate(template.id)
    setShiftForm((current) => ({
      ...current,
      start_time: template.start_time,
      end_time: template.end_time,
      break_minutes: template.break_minutes,
    }))
  }

  function updateAttendanceShiftTemplate(templateId: StaffShiftTemplateId, patch: Partial<Omit<StaffShiftTemplate, 'id'>>) {
    const { setAttendanceSettings } = getContext()

    setAttendanceSettings((current) => {
      const templates = normalizeStaffShiftTemplates(current.shift_templates, current.standard_break_minutes)
      return {
        ...current,
        shift_templates: templates.map((template) => (
          template.id === templateId ? { ...template, ...patch } : template
        )),
      }
    })
  }

  async function startShiftForCell(staffProfileId: string, shiftDate: string) {
    const {
      canManageAttendance,
      saving,
      employeeProfileById,
      setStatus,
      text,
      effectiveShiftTemplates,
      selectedShiftTemplate,
      attendanceSettings,
      profile,
      setShiftForm,
      setAttendanceTab,
      attendanceShifts,
      setSaving,
      markStaffDataStale,
    } = getContext()

    if (!canManageAttendance || saving) return
    if (employeeProfileById.get(staffProfileId)?.active === false) {
      setStatus(text.messages.inactiveEmployeePlanningBlocked)
      return
    }
    const template = effectiveShiftTemplates.find((item) => item.id === selectedShiftTemplate) || effectiveShiftTemplates[0] || defaultStaffShiftTemplates[0]
    const payload = {
      staff_profile_id: staffProfileId,
      location: attendanceSettings.location || 'VRena',
      shift_role: 'Staff',
      shift_date: shiftDate,
      start_time: normalizeTime(template.start_time) || '09:00',
      end_time: normalizeTime(template.end_time) || '18:00',
      break_minutes: Number(template.break_minutes) || 0,
      status: 'draft' as StaffShiftStatus,
      notes: null as string | null,
      created_by: profile?.id || null,
    }

    setShiftForm({
      ...defaultShiftForm(attendanceSettings),
      ...payload,
      break_minutes: String(payload.break_minutes),
      notes: '',
    })
    setAttendanceTab('schedule')

    const duplicate = attendanceShifts.some((shift) => (
      shift.staff_profile_id === staffProfileId &&
      shift.shift_date === shiftDate &&
      normalizeTime(shift.start_time) === payload.start_time &&
      normalizeTime(shift.end_time) === payload.end_time &&
      shift.status !== 'cancelled'
    ))
    if (duplicate) {
      setStatus(text.messages.draftShiftExists)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('staff_schedule_shifts').insert(payload)
    setStatus(error ? error.message : text.messages.draftShiftCreated)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function approveAttendancePeriod() {
    const { isOwnerOrAdmin, payrollPeriodStart, payrollPeriodEnd, setSaving, setStatus, resolvedLanguage, markStaffDataStale } = getContext()

    if (!isOwnerOrAdmin) return
    const [periodStart, periodEnd] = orderedRange(payrollPeriodStart, payrollPeriodEnd)
    setSaving(true)
    const { data, error } = await supabase.rpc('staff_approve_attendance_period', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
    })
    setStatus(error
      ? error.message
      : resolvedLanguage === 'vi'
        ? `Đã duyệt ${Number(data?.approved_log_count) || 0} bản ghi chấm công.`
        : `Approved ${Number(data?.approved_log_count) || 0} attendance records.`)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function setAttendanceRange(start: string, end: string) {
    const { markStaffDataStale, setAttendanceRangeStart, setAttendanceRangeEnd } = getContext()

    const [nextStart, nextEnd] = attendanceDateRange(start, end)
    markStaffDataStale('attendance')
    setAttendanceRangeStart(nextStart)
    setAttendanceRangeEnd(nextEnd)
  }

  function shiftAttendanceRange(dayOffset: number) {
    const { attendanceWeekStart, attendanceWeekEnd } = getContext()

    setAttendanceRange(addDays(attendanceWeekStart, dayOffset), addDays(attendanceWeekEnd, dayOffset))
  }

  function resetAttendanceRangeToThisWeek() {
    const [start, end] = attendanceWeekRange(todayString())
    setAttendanceRange(start, end)
  }

  async function copyPreviousAttendanceWeek() {
    const {
      canManageAttendance,
      setSaving,
      attendanceWeekStart,
      attendanceWeekEnd,
      setStatus,
      text,
      attendanceShifts,
      attendanceSettings,
      profile,
      markStaffDataStale,
    } = getContext()

    if (!canManageAttendance) return
    setSaving(true)
    const rangeDays = attendanceRangeLength(attendanceWeekStart, attendanceWeekEnd)
    const previousStart = addDays(attendanceWeekStart, -rangeDays)
    const previousEnd = addDays(attendanceWeekEnd, -rangeDays)
    const { data, error } = await supabase
      .from('staff_schedule_shifts')
      .select('*')
      .gte('shift_date', previousStart)
      .lte('shift_date', previousEnd)
      .is('deleted_at', null)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      setStatus(error.message)
      setSaving(false)
      return
    }

    const previousShifts = (data ?? []) as StaffScheduleShift[]
    if (previousShifts.length === 0) {
      setStatus(text.messages.previousWeekEmpty)
      setSaving(false)
      return
    }

    const existingKeys = new Set(attendanceShifts.map((shift) => (
      `${shift.staff_profile_id}:${shift.shift_date}:${normalizeTime(shift.start_time)}:${normalizeTime(shift.end_time)}`
    )))
    const rows = previousShifts.flatMap((shift) => {
      const nextDate = addDays(shift.shift_date, rangeDays)
      const key = `${shift.staff_profile_id}:${nextDate}:${normalizeTime(shift.start_time)}:${normalizeTime(shift.end_time)}`
      if (existingKeys.has(key)) return []
      return [{
        staff_profile_id: shift.staff_profile_id,
        location: shift.location || attendanceSettings.location || 'VRena',
        shift_role: 'Staff',
        shift_date: nextDate,
        start_time: normalizeTime(shift.start_time) || '09:00',
        end_time: normalizeTime(shift.end_time) || '18:00',
        break_minutes: shift.break_minutes || 0,
        status: 'draft' as StaffShiftStatus,
        notes: shift.notes,
        created_by: profile?.id || null,
      }]
    })

    if (rows.length === 0) {
      setStatus(text.messages.previousWeekNoNew)
      setSaving(false)
      return
    }

    const insertResult = await supabase.from('staff_schedule_shifts').insert(rows)
    setStatus(insertResult.error ? insertResult.error.message : text.messages.previousWeekCopied)
    if (!insertResult.error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function publishAttendanceWeek() {
    const { canManageAttendance, attendanceShifts, setSaving, setStatus, text, markStaffDataStale } = getContext()

    if (!canManageAttendance) return
    const draftIds = attendanceShifts.filter((shift) => shift.status === 'draft').map((shift) => shift.id)
    if (draftIds.length === 0) return
    setSaving(true)
    const { error } = await supabase
      .from('staff_schedule_shifts')
      .update({ status: 'published' })
      .in('id', draftIds)
    setStatus(error ? error.message : text.messages.weekPublished)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function moveShiftToCell(shift: StaffScheduleShift, staffProfileId: string, shiftDate: string) {
    const { canManageAttendance, employeeProfileById, setStatus, text, setSaving, markStaffDataStale } = getContext()

    if (!canManageAttendance) return
    if (shift.staff_profile_id === staffProfileId && shift.shift_date === shiftDate) return
    if (employeeProfileById.get(staffProfileId)?.active === false) {
      setStatus(text.messages.inactiveEmployeePlanningBlocked)
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('staff_schedule_shifts')
      .update({ staff_profile_id: staffProfileId, shift_date: shiftDate })
      .eq('id', shift.id)
    setStatus(error ? error.message : text.messages.shiftSaved)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function saveAttendanceLog() {
    const { canEditAttendance, setSaving, attendanceLogForm, firstStaffProfileId, profile, setStatus, text, setAttendanceLogForm, markStaffDataStale } = getContext()

    if (!canEditAttendance) return
    setSaving(true)
    const clockIn = attendanceLogForm.clock_in_time ? localDateTimeIso(attendanceLogForm.work_date, attendanceLogForm.clock_in_time) : null
    const clockOut = attendanceLogForm.clock_out_time ? localDateTimeIso(attendanceLogForm.work_date, attendanceLogForm.clock_out_time) : null
    const payload = {
      staff_profile_id: attendanceLogForm.staff_profile_id || firstStaffProfileId,
      shift_id: attendanceLogForm.shift_id || null,
      work_date: attendanceLogForm.work_date,
      clock_in_at: clockIn,
      clock_out_at: clockOut,
      break_minutes: Number(attendanceLogForm.break_minutes) || 0,
      status: attendanceLogForm.status,
      regular_minutes: Math.round((Number(attendanceLogForm.regular_minutes) || 0) * 60),
      overtime_minutes: Math.round((Number(attendanceLogForm.overtime_minutes) || 0) * 60),
      night_minutes: Math.round((Number(attendanceLogForm.night_minutes) || 0) * 60),
      holiday_minutes: Math.round((Number(attendanceLogForm.holiday_minutes) || 0) * 60),
      manager_note: attendanceLogForm.manager_note.trim() || null,
      created_by: profile?.id || null,
    }
    const request = attendanceLogForm.id
      ? supabase.from('staff_attendance_logs').update(payload).eq('id', attendanceLogForm.id)
      : supabase.from('staff_attendance_logs').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.attendanceSaved)
    if (!error) {
      setAttendanceLogForm({ ...defaultAttendanceLogForm(), staff_profile_id: payload.staff_profile_id })
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function editAttendanceLog(log: StaffAttendanceLog) {
    const { setAttendanceLogForm, setAttendanceTab } = getContext()

    setAttendanceLogForm({
      id: log.id,
      staff_profile_id: log.staff_profile_id,
      shift_id: log.shift_id || '',
      work_date: log.work_date,
      clock_in_time: timeValueFromIso(log.clock_in_at),
      clock_out_time: timeValueFromIso(log.clock_out_at),
      break_minutes: String(log.break_minutes),
      status: log.status,
      regular_minutes: String(log.regular_minutes / 60),
      overtime_minutes: String(log.overtime_minutes / 60),
      night_minutes: String(log.night_minutes / 60),
      holiday_minutes: String(log.holiday_minutes / 60),
      manager_note: log.manager_note || '',
    })
    setAttendanceTab('clock')
  }

  async function submitLeaveRequest() {
    const { canEditAttendance, setSaving, leaveForm, firstStaffProfileId, profile, setStatus, text, setLeaveForm, markStaffDataStale } = getContext()

    if (!canEditAttendance) return
    setSaving(true)
    const payload = {
      staff_profile_id: leaveForm.staff_profile_id || firstStaffProfileId,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      hours: Number(leaveForm.hours) || 0,
      reason: leaveForm.reason.trim() || null,
      requested_by: profile?.id || null,
    }
    const request = leaveForm.id
      ? supabase.from('staff_leave_requests').update(payload).eq('id', leaveForm.id)
      : supabase.from('staff_leave_requests').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.leaveSaved)
    if (!error) {
      setLeaveForm({ ...defaultLeaveForm(), staff_profile_id: payload.staff_profile_id })
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function editLeaveRequest(request: StaffLeaveRequest) {
    const { setLeaveForm, setAttendanceTab } = getContext()

    setLeaveForm({
      id: request.id,
      staff_profile_id: request.staff_profile_id,
      leave_type: request.leave_type,
      start_date: request.start_date,
      end_date: request.end_date,
      hours: String(request.hours),
      reason: request.reason || '',
    })
    setAttendanceTab('leave')
  }

  async function updateLeaveStatus(request: StaffLeaveRequest, status: StaffLeaveStatus) {
    const { canManageAttendance, setSaving, profile, setStatus, text, markStaffDataStale } = getContext()

    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase
      .from('staff_leave_requests')
      .update({
        status,
        reviewed_by: profile?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id)
    setStatus(error ? error.message : text.messages.leaveUpdated)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function saveAttendanceSettings() {
    const { canManageAttendance, setSaving, attendanceSettings, profile, setStatus, text, setAttendanceSettings, markStaffDataStale } = getContext()

    if (!canManageAttendance) return
    setSaving(true)
    const standardBreakMinutes = minutesSetting(attendanceSettings.standard_break_minutes, 60)
    const shiftTemplates = normalizeStaffShiftTemplates(attendanceSettings.shift_templates, standardBreakMinutes)
    const payload = {
      id: 'default',
      location: attendanceSettings.location.trim() || 'VRena',
      standard_daily_minutes: minutesSetting(attendanceSettings.standard_daily_minutes, 480),
      standard_weekly_minutes: minutesSetting(attendanceSettings.standard_weekly_minutes, 2880),
      standard_break_minutes: standardBreakMinutes,
      overtime_monthly_cap_minutes: minutesSetting(attendanceSettings.overtime_monthly_cap_minutes, 2400),
      overtime_yearly_cap_minutes: minutesSetting(attendanceSettings.overtime_yearly_cap_minutes, 12000),
      night_start: normalizeTime(attendanceSettings.night_start) || '22:00',
      night_end: normalizeTime(attendanceSettings.night_end) || '06:00',
      annual_leave_days: attendanceSettings.annual_leave_days,
      half_day_enabled: Boolean(attendanceSettings.half_day_enabled),
      half_day_min_minutes: minutesSetting(attendanceSettings.half_day_min_minutes, 0),
      half_day_max_minutes: Math.max(
        minutesSetting(attendanceSettings.half_day_min_minutes, 0),
        minutesSetting(attendanceSettings.half_day_max_minutes, 270),
      ),
      count_late_early_on_half_day: Boolean(attendanceSettings.count_late_early_on_half_day),
      late_arrival_enabled: Boolean(attendanceSettings.late_arrival_enabled),
      late_after_minutes: Math.min(240, minutesSetting(attendanceSettings.late_after_minutes, 5)),
      early_leave_enabled: Boolean(attendanceSettings.early_leave_enabled),
      early_leave_before_minutes: Math.min(240, minutesSetting(attendanceSettings.early_leave_before_minutes, 5)),
      overtime_before_shift_enabled: Boolean(attendanceSettings.overtime_before_shift_enabled),
      overtime_before_shift_minutes: Math.min(240, minutesSetting(attendanceSettings.overtime_before_shift_minutes, 10)),
      overtime_after_shift_enabled: Boolean(attendanceSettings.overtime_after_shift_enabled),
      overtime_after_shift_minutes: Math.min(240, minutesSetting(attendanceSettings.overtime_after_shift_minutes, 10)),
      single_clock_for_consecutive_shifts: Boolean(attendanceSettings.single_clock_for_consecutive_shifts),
      work_week_start: Math.min(6, Math.max(0, Math.round(Number(attendanceSettings.work_week_start) || 0))),
      weekly_rest_days: attendanceSettings.weekly_rest_days,
      shift_templates: shiftTemplates,
      updated_by: profile?.id || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('staff_attendance_settings').upsert(payload, { onConflict: 'id' })
    setStatus(error ? error.message : text.messages.attendanceRulesSaved)
    if (!error) {
      setAttendanceSettings(normalizeAttendanceSettings(payload))
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  return {
    loadAttendanceData,
    saveShift,
    editShift,
    updateShiftStatus,
    applyShiftTemplate,
    updateAttendanceShiftTemplate,
    startShiftForCell,
    approveAttendancePeriod,
    setAttendanceRange,
    shiftAttendanceRange,
    resetAttendanceRangeToThisWeek,
    copyPreviousAttendanceWeek,
    publishAttendanceWeek,
    moveShiftToCell,
    saveAttendanceLog,
    editAttendanceLog,
    submitLeaveRequest,
    editLeaveRequest,
    updateLeaveStatus,
    saveAttendanceSettings,
  }
}
