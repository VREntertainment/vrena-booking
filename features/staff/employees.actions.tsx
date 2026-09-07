'use client'

import type { ChangeEvent } from 'react'
import {
  safeStorageFileName
} from '../../lib/staff/catalog'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  decimalInput,
  parseDong
} from '../../lib/staff/formatting'
import {
  normalizeStaffContractStatus,
  normalizeStaffEmploymentType,
  normalizeStaffGender
} from '../../lib/staff/hrSettings'
import {
  staffCvMaxBytes,
  staffCvTypes,
  staffHrDocumentBucket,
  staffProfilePhotoMaxBytes,
  staffProfilePhotoTypes
} from '../../lib/staff/options'
import {
  normalizeEmployeePayrollType
} from '../../lib/staff/payroll'
import {
  roleLabel,
  staffProfileFromEmployee,
  staffRoleName
} from '../../lib/staff/profiles'
import type {
  StaffEmployeeProfile,
  StaffHrDocumentType,
  StaffProfile
} from '../../lib/staff/types'
import { employeeHomeLocation } from '../../lib/staffCostAllocation'
import type { StaffEmployeeRecordEmploymentType } from '../../lib/staffEmployeeRecord'
import { isStaffKioskEligibleDepartment } from '../../lib/staffKioskDirectory'
import { supabase } from '../../lib/supabase/client'

export type EmployeesActionContext = {
  text: StaffConsoleCopy
  employeeProfileById: Map<string, import("../../lib/staff/types").StaffEmployeeProfile>
  setEmployeeForm: React.Dispatch<React.SetStateAction<{ profile_id: string; employee_code: string; attendance_number: string; legal_name: string; personal_phone: string; personal_email: string; national_id: string; date_of_birth: string; gender: string; address: string; department: string; job_title: string; employment_type: import("../../lib/staff/types").StaffEmploymentType; main_work_location: string; payroll_location: string; contract_status: import("../../lib/staff/types").StaffContractStatus; contract_type: string; contract_start_date: string; contract_end_date: string; probation_payroll_type: "monthly" | "manager" | "hourly"; labor_payroll_type: "monthly" | "manager" | "hourly"; probation_salary_percentage: string; probation_bonus_percentage: string; probation_start_date: string; probation_end_date: string; labor_start_date: string; labor_end_date: string; start_date: string; end_date: string; base_salary_vnd: string; hourly_rate_vnd: string; monthly_bonus_vnd: string; lunch_allowance_vnd: string; rest_period_hours: string; overtime_rate_multiplier: string; night_rate_multiplier: string; holiday_rate_multiplier: string; employee_contribution_rate: string; employer_contribution_rate: string; pit_withholding_rate: string; dependents_count: string; bank_name: string; bank_account_number: string; tax_code: string; social_insurance_number: string; social_insurance_enrolled: boolean; social_insurance_salary_vnd: string; emergency_contact: string; emergency_contact_name: string; emergency_contact_relationship: string; emergency_contact_phone: string; google_drive_folder_url: string; payroll_note: string; profile_photo_path: string; cv_document_path: string; active: boolean; kiosk_access_role: "" | "manager" | "staff"; kiosk_pin_configured_at: string }>>
  setEmployeeKioskPin: React.Dispatch<React.SetStateAction<string>>
  setEmployeeKioskPinConfirm: React.Dispatch<React.SetStateAction<string>>
  setEmployeeKioskPinSaveConfirmation: React.Dispatch<React.SetStateAction<"" | "created" | "replaced">>
  setEmployeeKioskPinVisibleValue: React.Dispatch<React.SetStateAction<string>>
  setEmployeeKioskPinEmailState: React.Dispatch<React.SetStateAction<"idle" | "sending" | "sent">>
  setEmployeeKioskPinEmailRecipient: React.Dispatch<React.SetStateAction<string>>
  employeeKioskPinProfileRef: React.RefObject<string>
  employeeKioskPinConfirmationTimerRef: React.RefObject<number | null>
  employeeKioskPinEmailTimerRef: React.RefObject<number | null>
  setEmployeeKioskAccessRole: React.Dispatch<React.SetStateAction<"manager" | "staff">>
  setHrTab: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffHrTab>>
  setActiveTab: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffTab>>
  canRevealEmployeeKioskPin: boolean
  setEmployeeKioskPinLoading: React.Dispatch<React.SetStateAction<boolean>>
  setStatus: React.Dispatch<React.SetStateAction<string>>
  employeeKioskPinEmailState: "idle" | "sending" | "sent"
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  canManageEmployeeKioskPins: boolean
  employeeForm: { profile_id: string; employee_code: string; attendance_number: string; legal_name: string; personal_phone: string; personal_email: string; national_id: string; date_of_birth: string; gender: string; address: string; department: string; job_title: string; employment_type: import("../../lib/staff/types").StaffEmploymentType; main_work_location: string; payroll_location: string; contract_status: import("../../lib/staff/types").StaffContractStatus; contract_type: string; contract_start_date: string; contract_end_date: string; probation_payroll_type: "monthly" | "manager" | "hourly"; labor_payroll_type: "monthly" | "manager" | "hourly"; probation_salary_percentage: string; probation_bonus_percentage: string; probation_start_date: string; probation_end_date: string; labor_start_date: string; labor_end_date: string; start_date: string; end_date: string; base_salary_vnd: string; hourly_rate_vnd: string; monthly_bonus_vnd: string; lunch_allowance_vnd: string; rest_period_hours: string; overtime_rate_multiplier: string; night_rate_multiplier: string; holiday_rate_multiplier: string; employee_contribution_rate: string; employer_contribution_rate: string; pit_withholding_rate: string; dependents_count: string; bank_name: string; bank_account_number: string; tax_code: string; social_insurance_number: string; social_insurance_enrolled: boolean; social_insurance_salary_vnd: string; emergency_contact: string; emergency_contact_name: string; emergency_contact_relationship: string; emergency_contact_phone: string; google_drive_folder_url: string; payroll_note: string; profile_photo_path: string; cv_document_path: string; active: boolean; kiosk_access_role: "" | "manager" | "staff"; kiosk_pin_configured_at: string }
  firstEmployeeStaffProfileId: string
  employeeKioskPin: string
  employeeKioskPinConfirm: string
  kioskText: { title: string; subtitle: string; manager: string; staff: string; pin: string; unlock: string; switch: string; lock: string; noAccess: string; setupTitle: string; setupHelp: string; employee: string; mismatch: string; loading: string; secured: string; inactivity: string; chooseEmployee: string; incorrect: string; back: string; clear: string; logout: string } | { title: string; subtitle: string; manager: string; staff: string; pin: string; unlock: string; switch: string; lock: string; noAccess: string; setupTitle: string; setupHelp: string; employee: string; mismatch: string; loading: string; secured: string; inactivity: string; chooseEmployee: string; incorrect: string; back: string; clear: string; logout: string } | { title: string; subtitle: string; manager: string; staff: string; pin: string; unlock: string; switch: string; lock: string; noAccess: string; setupTitle: string; setupHelp: string; employee: string; mismatch: string; loading: string; secured: string; inactivity: string; chooseEmployee: string; incorrect: string; back: string; clear: string; logout: string } | { title: string; subtitle: string; manager: string; staff: string; pin: string; unlock: string; switch: string; lock: string; noAccess: string; setupTitle: string; setupHelp: string; employee: string; mismatch: string; loading: string; secured: string; inactivity: string; chooseEmployee: string; incorrect: string; back: string; clear: string; logout: string } | { title: string; subtitle: string; manager: string; staff: string; pin: string; unlock: string; switch: string; lock: string; noAccess: string; setupTitle: string; setupHelp: string; employee: string; mismatch: string; loading: string; secured: string; inactivity: string; chooseEmployee: string; incorrect: string; back: string; clear: string; logout: string } | { title: string; subtitle: string; manager: string; staff: string; pin: string; unlock: string; switch: string; lock: string; noAccess: string; setupTitle: string; setupHelp: string; employee: string; mismatch: string; loading: string; secured: string; inactivity: string; chooseEmployee: string; incorrect: string; back: string; clear: string; logout: string } | { title: string; subtitle: string; manager: string; staff: string; pin: string; unlock: string; switch: string; lock: string; noAccess: string; setupTitle: string; setupHelp: string; employee: string; mismatch: string; loading: string; secured: string; inactivity: string; chooseEmployee: string; incorrect: string; back: string; clear: string; logout: string }
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  employeeKioskAccessRole: "manager" | "staff"
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  loadAttendanceData: (force?: boolean) => Promise<void>
  canEditEmployeeProfiles: boolean
  visibleAllStaffProfileOptions: import("../../lib/staff/types").StaffProfile[]
  profile: import("../../lib/staff/types").StaffProfile | null
  loadHrData: (force?: boolean) => Promise<void>
  isOwnerOrAdmin: boolean
  saving: boolean
  selectedEmployeeStaffId: string
  setHrDocumentUploading: React.Dispatch<React.SetStateAction<"" | import("../../lib/staff/types").StaffHrDocumentType>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffEmployeesActions(getContext: () => EmployeesActionContext) {
  function employeeFormForProfile(staffProfile: StaffProfile, employee?: StaffEmployeeProfile) {
    const { text } = getContext()

    return {
      profile_id: staffProfile.id,
      employee_code: employee?.employee_code || '',
      attendance_number: employee?.attendance_number || '',
      legal_name: employee?.legal_name || staffProfile.full_name || '',
      personal_phone: employee?.personal_phone || staffProfile.phone || '',
      personal_email: employee?.personal_email || staffProfile.email || '',
      national_id: employee?.national_id || '',
      date_of_birth: employee?.date_of_birth || '',
      gender: normalizeStaffGender(employee?.gender),
      address: employee?.address || '',
      department: employee?.department || '',
      job_title: employee?.job_title || staffRoleName(roleLabel(staffProfile.role, staffProfile.email), text),
      employment_type: normalizeStaffEmploymentType(employee?.employment_type),
      main_work_location: employee?.main_work_location || '',
      payroll_location: employee?.payroll_location || '',
      contract_status: normalizeStaffContractStatus(employee?.contract_status),
      contract_type: employee?.contract_type || '',
      contract_start_date: employee?.contract_start_date || '',
      contract_end_date: employee?.contract_end_date || '',
      probation_payroll_type: normalizeEmployeePayrollType(employee?.probation_payroll_type),
      labor_payroll_type: normalizeEmployeePayrollType(employee?.labor_payroll_type),
      probation_salary_percentage: String(employee?.probation_salary_percentage || 85),
      probation_bonus_percentage: String(employee?.probation_bonus_percentage || 100),
      probation_start_date: employee?.probation_start_date || '',
      probation_end_date: employee?.probation_end_date || '',
      labor_start_date: employee?.labor_start_date || employee?.contract_start_date || '',
      labor_end_date: employee?.labor_end_date || employee?.contract_end_date || '',
      start_date: employee?.start_date || '',
      end_date: employee?.end_date || '',
      base_salary_vnd: employee?.base_salary_vnd ? String(employee.base_salary_vnd) : '',
      hourly_rate_vnd: employee?.hourly_rate_vnd ? String(employee.hourly_rate_vnd) : '',
      monthly_bonus_vnd: employee?.monthly_bonus_vnd ? String(employee.monthly_bonus_vnd) : '',
      lunch_allowance_vnd: employee?.lunch_allowance_vnd ? String(employee.lunch_allowance_vnd) : '',
      rest_period_hours: employee?.rest_period_minutes ? String(Number((employee.rest_period_minutes / 60).toFixed(2))) : '',
      overtime_rate_multiplier: employee?.overtime_rate_multiplier ? String(employee.overtime_rate_multiplier) : '',
      night_rate_multiplier: employee?.night_rate_multiplier ? String(employee.night_rate_multiplier) : '',
      holiday_rate_multiplier: employee?.holiday_rate_multiplier ? String(employee.holiday_rate_multiplier) : '',
      employee_contribution_rate: employee?.employee_contribution_rate ? String(employee.employee_contribution_rate) : '',
      employer_contribution_rate: employee?.employer_contribution_rate ? String(employee.employer_contribution_rate) : '',
      pit_withholding_rate: employee?.pit_withholding_rate ? String(employee.pit_withholding_rate) : '',
      dependents_count: String(employee?.dependents_count ?? 0),
      bank_name: employee?.bank_name || '',
      bank_account_number: employee?.bank_account_number || '',
      tax_code: employee?.tax_code || '',
      social_insurance_number: employee?.social_insurance_number || '',
      social_insurance_enrolled: employee?.social_insurance_enrolled ?? false,
      social_insurance_salary_vnd: employee?.social_insurance_salary_vnd ? String(employee.social_insurance_salary_vnd) : '',
      emergency_contact: employee?.emergency_contact || '',
      emergency_contact_name: employee?.emergency_contact_name || employee?.emergency_contact || '',
      emergency_contact_relationship: employee?.emergency_contact_relationship || '',
      emergency_contact_phone: employee?.emergency_contact_phone || '',
      google_drive_folder_url: employee?.google_drive_folder_url || '',
      payroll_note: employee?.payroll_note || '',
      profile_photo_path: employee?.profile_photo_path || '',
      cv_document_path: employee?.cv_document_path || '',
      active: employee?.active ?? true,
      kiosk_access_role: employee?.kiosk_access_role === 'manager'
        ? 'manager' as const
        : employee?.kiosk_access_role === 'staff' ? 'staff' as const : '' as const,
      kiosk_pin_configured_at: employee?.kiosk_pin_configured_at || '',
    }
  }

  function editEmployeeProfile(staffProfile: StaffProfile) {
    const {
      employeeProfileById,
      setEmployeeForm,
      setEmployeeKioskPin,
      setEmployeeKioskPinConfirm,
      setEmployeeKioskPinSaveConfirmation,
      setEmployeeKioskPinVisibleValue,
      setEmployeeKioskPinEmailState,
      setEmployeeKioskPinEmailRecipient,
      employeeKioskPinProfileRef,
      employeeKioskPinConfirmationTimerRef,
      employeeKioskPinEmailTimerRef,
      setEmployeeKioskAccessRole,
      setHrTab,
      setActiveTab,
      canRevealEmployeeKioskPin,
    } = getContext()

    const employee = employeeProfileById.get(staffProfile.id)
    setEmployeeForm(employeeFormForProfile(staffProfile, employee))
    setEmployeeKioskPin('')
    setEmployeeKioskPinConfirm('')
    setEmployeeKioskPinSaveConfirmation('')
    setEmployeeKioskPinVisibleValue('')
    setEmployeeKioskPinEmailState('idle')
    setEmployeeKioskPinEmailRecipient('')
    employeeKioskPinProfileRef.current = staffProfile.id
    if (employeeKioskPinConfirmationTimerRef.current !== null) {
      window.clearTimeout(employeeKioskPinConfirmationTimerRef.current)
      employeeKioskPinConfirmationTimerRef.current = null
    }
    if (employeeKioskPinEmailTimerRef.current !== null) {
      window.clearTimeout(employeeKioskPinEmailTimerRef.current)
      employeeKioskPinEmailTimerRef.current = null
    }
    setEmployeeKioskAccessRole(employee?.kiosk_access_role === 'manager' ? 'manager' : 'staff')
    setHrTab('employees')
    setActiveTab('hr')
    if (canRevealEmployeeKioskPin && isStaffKioskEligibleDepartment(employee?.department)) {
      void revealEmployeeKioskPin(staffProfile.id)
    }
  }

  async function revealEmployeeKioskPin(staffProfileId: string) {
    const { canRevealEmployeeKioskPin, setEmployeeKioskPinLoading, employeeKioskPinProfileRef, setEmployeeKioskPinVisibleValue, setStatus } = getContext()

    if (!canRevealEmployeeKioskPin || !staffProfileId) return
    setEmployeeKioskPinLoading(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')
      const response = await fetch(`/api/staff/kiosk/pin?profileId=${encodeURIComponent(staffProfileId)}`, {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; pin?: string | null }
      if (!response.ok) throw new Error(payload.error || 'Could not load employee PIN.')
      if (employeeKioskPinProfileRef.current === staffProfileId) {
        setEmployeeKioskPinVisibleValue(typeof payload.pin === 'string' ? payload.pin : '')
      }
    } catch (pinError) {
      if (employeeKioskPinProfileRef.current === staffProfileId) {
        setEmployeeKioskPinVisibleValue('')
        setStatus(pinError instanceof Error ? pinError.message : String(pinError))
      }
    } finally {
      if (employeeKioskPinProfileRef.current === staffProfileId) setEmployeeKioskPinLoading(false)
    }
  }

  async function sendEmployeeKioskPinEmail(staffProfileId: string) {
    const {
      canRevealEmployeeKioskPin,
      employeeKioskPinEmailState,
      setEmployeeKioskPinEmailState,
      setEmployeeKioskPinEmailRecipient,
      employeeKioskPinProfileRef,
      setStatus,
      resolvedLanguage,
      employeeKioskPinEmailTimerRef,
    } = getContext()

    if (!canRevealEmployeeKioskPin || !staffProfileId || employeeKioskPinEmailState === 'sending') return
    setEmployeeKioskPinEmailState('sending')
    setEmployeeKioskPinEmailRecipient('')
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')
      const response = await fetch('/api/staff/kiosk/pin/email', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ profileId: staffProfileId }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; recipient?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not send employee PIN email.')
      if (employeeKioskPinProfileRef.current !== staffProfileId) return

      const recipient = payload.recipient || ''
      setEmployeeKioskPinEmailRecipient(recipient)
      setEmployeeKioskPinEmailState('sent')
      setStatus(resolvedLanguage === 'vi'
        ? `Đã gửi PIN qua email${recipient ? ` tới ${recipient}` : ''}.`
        : `PIN emailed${recipient ? ` to ${recipient}` : ''}.`)
      if (employeeKioskPinEmailTimerRef.current !== null) {
        window.clearTimeout(employeeKioskPinEmailTimerRef.current)
      }
      employeeKioskPinEmailTimerRef.current = window.setTimeout(() => {
        if (employeeKioskPinProfileRef.current === staffProfileId) setEmployeeKioskPinEmailState('idle')
        employeeKioskPinEmailTimerRef.current = null
      }, 5000)
    } catch (pinEmailError) {
      if (employeeKioskPinProfileRef.current === staffProfileId) {
        setEmployeeKioskPinEmailState('idle')
        setStatus(pinEmailError instanceof Error ? pinEmailError.message : String(pinEmailError))
      }
    }
  }

  async function configureEmployeeKioskPin() {
    const {
      canManageEmployeeKioskPins,
      employeeForm,
      firstEmployeeStaffProfileId,
      employeeKioskPin,
      employeeKioskPinConfirm,
      setStatus,
      kioskText,
      setEmployeeKioskPinSaveConfirmation,
      setEmployeeKioskPinVisibleValue,
      setEmployeeKioskPinEmailState,
      setEmployeeKioskPinEmailRecipient,
      setSaving,
      employeeKioskAccessRole,
      setEmployeeKioskPin,
      setEmployeeKioskPinConfirm,
      setEmployeeForm,
      employeeKioskPinConfirmationTimerRef,
      resolvedLanguage,
      markStaffDataStale,
      loadAttendanceData,
    } = getContext()

    if (!canManageEmployeeKioskPins) return
    const staffProfileId = employeeForm.profile_id || firstEmployeeStaffProfileId
    if (!staffProfileId) return
    if (!/^\d{6}$/.test(employeeKioskPin) || employeeKioskPin !== employeeKioskPinConfirm) {
      setStatus(kioskText.mismatch)
      return
    }

    const pinWasConfigured = Boolean(employeeForm.kiosk_pin_configured_at)
    const pinToSave = employeeKioskPin
    setEmployeeKioskPinSaveConfirmation('')
    setEmployeeKioskPinVisibleValue('')
    setEmployeeKioskPinEmailState('idle')
    setEmployeeKioskPinEmailRecipient('')
    setSaving(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')
      const response = await fetch('/api/staff/kiosk/pin', {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          profileId: staffProfileId,
          pin: employeeKioskPin,
          accessRole: employeeKioskAccessRole,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not save employee PIN.')
      setEmployeeKioskPin('')
      setEmployeeKioskPinConfirm('')
      setEmployeeForm((current) => current.profile_id === staffProfileId
        ? {
          ...current,
          kiosk_access_role: employeeKioskAccessRole,
          kiosk_pin_configured_at: new Date().toISOString(),
        }
        : current)
      setEmployeeKioskPinSaveConfirmation(pinWasConfigured ? 'replaced' : 'created')
      setEmployeeKioskPinVisibleValue(pinToSave)
      if (employeeKioskPinConfirmationTimerRef.current !== null) {
        window.clearTimeout(employeeKioskPinConfirmationTimerRef.current)
      }
      employeeKioskPinConfirmationTimerRef.current = window.setTimeout(() => {
        setEmployeeKioskPinSaveConfirmation('')
        employeeKioskPinConfirmationTimerRef.current = null
      }, 5000)
      setStatus(resolvedLanguage === 'vi' ? 'Đã lưu PIN nhân viên.' : 'Employee PIN saved.')
      markStaffDataStale('attendance', 'hr')
      await loadAttendanceData(true)
    } catch (pinError) {
      setStatus(pinError instanceof Error ? pinError.message : String(pinError))
    } finally {
      setSaving(false)
    }
  }

  function generateEmployeeKioskPin() {
    const { setEmployeeKioskPin, setEmployeeKioskPinConfirm, setEmployeeKioskPinSaveConfirmation } = getContext()

    const randomValue = new Uint32Array(1)
    const range = 900000
    const unbiasedLimit = Math.floor(0x100000000 / range) * range
    let value = unbiasedLimit

    while (value >= unbiasedLimit) {
      window.crypto.getRandomValues(randomValue)
      value = randomValue[0]
    }

    const pin = String(100000 + (value % range))
    setEmployeeKioskPin(pin)
    setEmployeeKioskPinConfirm(pin)
    setEmployeeKioskPinSaveConfirmation('')
  }

  async function saveEmployeeProfile() {
    const {
      canEditEmployeeProfiles,
      employeeForm,
      firstEmployeeStaffProfileId,
      visibleAllStaffProfileOptions,
      setSaving,
      profile,
      setStatus,
      text,
      markStaffDataStale,
      loadAttendanceData,
      loadHrData,
    } = getContext()

    if (!canEditEmployeeProfiles) return
    const staffProfileId = employeeForm.profile_id || firstEmployeeStaffProfileId
    if (!staffProfileId) return
    const selectedStaff = visibleAllStaffProfileOptions.find((item) => item.id === staffProfileId) || null
    setSaving(true)
    const payload = {
      profile_id: staffProfileId,
      employee_code: employeeForm.employee_code.trim() || null,
      attendance_number: employeeForm.attendance_number.trim() || null,
      legal_name: employeeForm.legal_name.trim() || selectedStaff?.full_name || null,
      personal_phone: employeeForm.personal_phone.trim() || selectedStaff?.phone || null,
      personal_email: employeeForm.personal_email.trim() || selectedStaff?.email || null,
      national_id: employeeForm.national_id.trim() || null,
      date_of_birth: employeeForm.date_of_birth || null,
      gender: normalizeStaffGender(employeeForm.gender) || null,
      address: employeeForm.address.trim() || null,
      department: employeeForm.department.trim() || null,
      job_title: employeeForm.job_title.trim() || null,
      employment_type: normalizeStaffEmploymentType(employeeForm.employment_type),
      main_work_location: employeeHomeLocation(employeeForm.department) || employeeForm.main_work_location.trim() || null,
      payroll_location: employeeForm.payroll_location.trim() || null,
      contract_status: normalizeStaffContractStatus(employeeForm.contract_status),
      contract_type: employeeForm.contract_type.trim() || null,
      contract_start_date: employeeForm.labor_start_date || null,
      contract_end_date: employeeForm.labor_end_date || null,
      probation_payroll_type: normalizeEmployeePayrollType(employeeForm.probation_payroll_type),
      labor_payroll_type: normalizeEmployeePayrollType(employeeForm.labor_payroll_type),
      probation_salary_percentage: employeeForm.probation_salary_percentage === '100' ? 100 : 85,
      probation_bonus_percentage: employeeForm.probation_bonus_percentage === '85' ? 85 : 100,
      probation_start_date: employeeForm.probation_start_date || null,
      probation_end_date: employeeForm.probation_end_date || null,
      labor_start_date: employeeForm.labor_start_date || null,
      labor_end_date: employeeForm.labor_end_date || null,
      start_date: employeeForm.probation_start_date || employeeForm.labor_start_date || null,
      end_date: employeeForm.active ? null : (employeeForm.labor_end_date || employeeForm.probation_end_date || null),
      base_salary_vnd: parseDong(employeeForm.base_salary_vnd),
      hourly_rate_vnd: parseDong(employeeForm.hourly_rate_vnd),
      monthly_bonus_vnd: parseDong(employeeForm.monthly_bonus_vnd),
      lunch_allowance_vnd: 0,
      rest_period_minutes: null,
      overtime_rate_multiplier: null,
      night_rate_multiplier: null,
      holiday_rate_multiplier: null,
      employee_contribution_rate: null,
      employer_contribution_rate: null,
      pit_withholding_rate: employeeForm.pit_withholding_rate ? decimalInput(employeeForm.pit_withholding_rate) : null,
      dependents_count: Math.max(0, Math.round(Number(employeeForm.dependents_count) || 0)),
      bank_name: employeeForm.bank_name.trim() || null,
      bank_account_number: employeeForm.bank_account_number.trim() || null,
      tax_code: employeeForm.tax_code.trim() || null,
      social_insurance_number: employeeForm.social_insurance_number.trim() || null,
      social_insurance_enrolled: employeeForm.social_insurance_enrolled,
      social_insurance_salary_vnd: parseDong(employeeForm.social_insurance_salary_vnd),
      emergency_contact: employeeForm.emergency_contact_name.trim() || null,
      emergency_contact_name: employeeForm.emergency_contact_name.trim() || null,
      emergency_contact_relationship: employeeForm.emergency_contact_relationship.trim() || null,
      emergency_contact_phone: employeeForm.emergency_contact_phone.trim() || null,
      google_drive_folder_url: employeeForm.google_drive_folder_url.trim() || null,
      payroll_note: employeeForm.payroll_note.trim() || null,
      profile_photo_path: employeeForm.profile_photo_path || null,
      cv_document_path: employeeForm.cv_document_path || null,
      active: employeeForm.active,
      created_by: profile?.id || null,
    }
    const { error } = await supabase
      .from('staff_employee_profiles')
      .upsert(payload, { onConflict: 'profile_id' })
    setStatus(error ? error.message : text.messages.employeeProfileSaved)
    if (!error) {
      markStaffDataStale('attendance', 'hr')
      await Promise.all([loadAttendanceData(true), loadHrData(true)])
    }
    setSaving(false)
  }

  async function createEmployeeRecord(input: {
    email: string
    employmentType: StaffEmployeeRecordEmploymentType
    fullName: string
    phone: string
  }) {
    const {
      isOwnerOrAdmin,
      saving,
      text,
      setSaving,
      setEmployeeForm,
      setEmployeeKioskPin,
      setEmployeeKioskPinConfirm,
      setEmployeeKioskPinSaveConfirmation,
      setEmployeeKioskPinVisibleValue,
      setEmployeeKioskPinEmailState,
      setEmployeeKioskPinEmailRecipient,
      setEmployeeKioskAccessRole,
      employeeKioskPinProfileRef,
      setStatus,
      resolvedLanguage,
      markStaffDataStale,
      loadAttendanceData,
      loadHrData,
    } = getContext()

    if (!isOwnerOrAdmin || saving) throw new Error(text.accessRequired)

    setSaving(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')

      const response = await fetch('/api/staff/employees/record', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      })
      const payload = await response.json().catch(() => ({})) as {
        employee?: StaffEmployeeProfile
        error?: string
        warning?: string
      }
      if (!response.ok || !payload.employee) {
        throw new Error(payload.error || 'Could not create the employee HR record.')
      }

      const employeeStaffProfile = staffProfileFromEmployee(payload.employee)
      setEmployeeForm(employeeFormForProfile(employeeStaffProfile, payload.employee))
      setEmployeeKioskPin('')
      setEmployeeKioskPinConfirm('')
      setEmployeeKioskPinSaveConfirmation('')
      setEmployeeKioskPinVisibleValue('')
      setEmployeeKioskPinEmailState('idle')
      setEmployeeKioskPinEmailRecipient('')
      setEmployeeKioskAccessRole(payload.employee.kiosk_access_role === 'manager' ? 'manager' : 'staff')
      employeeKioskPinProfileRef.current = payload.employee.profile_id
      setStatus(payload.warning || (resolvedLanguage === 'vi' ? 'Đã tạo hồ sơ HR. Hãy cấp PIN 6 số.' : 'HR record created. Assign the six-digit PIN.'))
      markStaffDataStale('attendance', 'hr')
      await Promise.all([loadAttendanceData(true), loadHrData(true)])
      return { warning: payload.warning || '' }
    } finally {
      setSaving(false)
    }
  }

  async function handleHrDocumentUpload(event: ChangeEvent<HTMLInputElement>, documentType: Extract<StaffHrDocumentType, 'profile_photo' | 'cv'>) {
    const {
      canEditEmployeeProfiles,
      selectedEmployeeStaffId,
      setStatus,
      text,
      setHrDocumentUploading,
      profile,
      setEmployeeForm,
      markStaffDataStale,
      loadAttendanceData,
      loadHrData,
    } = getContext()

    if (!canEditEmployeeProfiles || !selectedEmployeeStaffId) return
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const isProfilePhoto = documentType === 'profile_photo'
    const allowedTypes = isProfilePhoto ? staffProfilePhotoTypes : staffCvTypes
    const maxBytes = isProfilePhoto ? staffProfilePhotoMaxBytes : staffCvMaxBytes
    if (!allowedTypes.includes(file.type)) {
      setStatus(isProfilePhoto ? text.messages.gamePhotoType : text.messages.documentUploadFailed)
      return
    }
    if (file.size > maxBytes) {
      setStatus(isProfilePhoto ? text.messages.profilePhotoTooLarge : text.messages.cvTooLarge)
      return
    }

    setHrDocumentUploading(documentType)
    const storagePath = `${selectedEmployeeStaffId}/${documentType}/${Date.now()}-${safeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage
      .from(staffHrDocumentBucket)
      .upload(storagePath, file, { contentType: file.type, upsert: true })

    if (uploadError) {
      setStatus(uploadError.message || text.messages.documentUploadFailed)
      setHrDocumentUploading('')
      return
    }

    const { error: documentError } = await supabase.from('staff_hr_documents').insert({
      profile_id: selectedEmployeeStaffId,
      document_type: documentType,
      file_name: file.name,
      storage_bucket: staffHrDocumentBucket,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: profile?.id || null,
    })
    const profilePathPatch = documentType === 'profile_photo'
      ? { profile_photo_path: storagePath }
      : { cv_document_path: storagePath }
    const { error: profileError } = await supabase
      .from('staff_employee_profiles')
      .upsert({
        profile_id: selectedEmployeeStaffId,
        ...profilePathPatch,
        created_by: profile?.id || null,
      }, { onConflict: 'profile_id' })

    const error = documentError || profileError
    setStatus(error ? error.message : text.messages.documentUploaded)
    if (!error) {
      setEmployeeForm((current) => ({ ...current, ...profilePathPatch }))
      markStaffDataStale('attendance', 'hr')
      await Promise.all([loadAttendanceData(true), loadHrData(true)])
    }
    setHrDocumentUploading('')
  }

  return {
    employeeFormForProfile,
    editEmployeeProfile,
    revealEmployeeKioskPin,
    sendEmployeeKioskPinEmail,
    configureEmployeeKioskPin,
    generateEmployeeKioskPin,
    saveEmployeeProfile,
    createEmployeeRecord,
    handleHrDocumentUpload,
  }
}
