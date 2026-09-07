'use client'

import { uiText } from '../../lib/i18n/translations'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import type {
  StaffConsoleLanguage
} from '../../lib/staff/types'
import { StaffHrHub } from './shared'

export type HrSectionProps = {
  approvePayrollRun: (run: import("../../lib/staff/types").StaffPayrollRun) => Promise<void>
  downloadEmployeePayslip: (staffProfileId?: string) => Promise<void>
  downloadPayrollExcel: () => Promise<boolean>
  generatePayrollRun: () => Promise<void>
  hrAdjustmentForm: { id: string; profile_id: string; adjustment_type: import("../../lib/staff/types").StaffHrAdjustmentType; title: string; amount_vnd: string; effective_date: string; period_start: string; period_end: string; status: import("../../lib/staff/types").StaffHrAdjustmentStatus; notes: string }
  hrPayrollTotals: { gross: number; net: number; companyCost: number; restWarnings: number }
  leaveRequests: import("../../lib/staff/types").StaffLeaveRequest[]
  payrollItems: import("../../lib/staff/types").StaffPayrollItem[]
  payrollPeriodEnd: string
  payrollPeriodStart: string
  payrollRunForm: { id: string; code: string; name: string; pay_cycle: import("../../lib/staff/types").StaffPayrollPayCycle; period_start: string; period_end: string; notes: string }
  payrollRuns: import("../../lib/staff/types").StaffPayrollRun[]
  periodHrAdjustments: import("../../lib/staff/types").StaffHrAdjustment[]
  profileById: Map<string, import("../../lib/staff/types").StaffProfile>
  costAssignments: import("../../lib/staffCostAllocation").StaffCostAssignment[]
  loadHrData: (force?: boolean) => Promise<void>
  staffCostAllocations: Map<string, { shares: { location: string; paidMinutes: number; companyCost: number }[]; needsPaidHours: boolean }>
  saveHrAdjustment: (kind?: "advance" | "adjustment") => Promise<void>
  setHrAdjustmentForm: React.Dispatch<React.SetStateAction<{ id: string; profile_id: string; adjustment_type: import("../../lib/staff/types").StaffHrAdjustmentType; title: string; amount_vnd: string; effective_date: string; period_start: string; period_end: string; status: import("../../lib/staff/types").StaffHrAdjustmentStatus; notes: string }>>
  setPayrollRunForm: React.Dispatch<React.SetStateAction<{ id: string; code: string; name: string; pay_cycle: import("../../lib/staff/types").StaffPayrollPayCycle; period_start: string; period_end: string; notes: string }>>
  staffPayrollCalculations: Map<string, import("../../lib/staff/types").StaffPayrollCalculation>
  updateHrAdjustmentStatus: (adjustment: import("../../lib/staff/types").StaffHrAdjustment, statusValue: import("../../lib/staff/types").StaffHrAdjustmentStatus) => Promise<void>
  visibleStaffProfileOptions: import("../../lib/staff/types").StaffProfile[]
  approveAttendancePeriod: () => Promise<void>
  applyShiftTemplate: (templateId: import("../../lib/staff/types").StaffShiftTemplateId) => void
  attendanceLogs: import("../../lib/staff/types").StaffAttendanceLog[]
  attendanceScheduleScopeOptions: import("../../lib/staff/types").StaffScheduleScope[]
  attendanceSettings: import("../../lib/staff/types").StaffAttendanceSettings
  attendanceShiftsByCell: Map<string, import("../../lib/staff/types").StaffScheduleShift[]>
  attendanceWeekEnd: string
  attendanceWeekDates: string[]
  attendanceWeekStart: string
  draggingShiftId: string
  draftShiftCount: number
  effectiveAttendanceScheduleScope: import("../../lib/staff/types").StaffScheduleScope
  effectiveShiftTemplates: import("../../lib/staff/types").StaffShiftTemplate[]
  editShift: (shift: import("../../lib/staff/types").StaffScheduleShift) => void
  firstScheduleStaffProfileId: string
  saveAttendanceSettings: () => Promise<void>
  saveShift: () => Promise<void>
  selectedShiftTemplate: import("../../lib/staff/types").StaffShiftTemplateId
  setAttendanceScheduleScope: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffScheduleScope>>
  setAttendanceSettings: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffAttendanceSettings>>
  setAttendanceRange: (start: string, end: string) => void
  setDraggingShiftId: React.Dispatch<React.SetStateAction<string>>
  setShiftForm: React.Dispatch<React.SetStateAction<{ id: string; staff_profile_id: string; location: string; shift_role: string; shift_date: string; start_time: string; end_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffShiftStatus; notes: string }>>
  shiftForm: { id: string; staff_profile_id: string; location: string; shift_role: string; shift_date: string; start_time: string; end_time: string; break_minutes: string; status: import("../../lib/staff/types").StaffShiftStatus; notes: string }
  shiftAttendanceRange: (dayOffset: number) => void
  shiftWarningsById: Map<string, string[]>
  startShiftForCell: (staffProfileId: string, shiftDate: string) => Promise<void>
  resetAttendanceRangeToThisWeek: () => void
  updateShiftStatus: (shift: import("../../lib/staff/types").StaffScheduleShift, status: import("../../lib/staff/types").StaffShiftStatus) => Promise<void>
  visibleScheduleAttendanceShifts: import("../../lib/staff/types").StaffScheduleShift[]
  visibleScheduleStaffProfileOptions: import("../../lib/staff/types").StaffProfile[]
  copyPreviousAttendanceWeek: () => Promise<void>
  moveShiftToCell: (shift: import("../../lib/staff/types").StaffScheduleShift, staffProfileId: string, shiftDate: string) => Promise<void>
  publishAttendanceWeek: () => Promise<void>
  canEditEmployeeProfiles: boolean
  canAccessHrSettings: boolean
  canAccessZaloSettings: boolean
  canManageEmployeeKioskPins: boolean
  canManageAttendance: boolean
  isOwnerOrAdmin: boolean
  canRevealEmployeeKioskPin: boolean
  editEmployeeProfile: (staffProfile: import("../../lib/staff/types").StaffProfile) => void
  configureEmployeeKioskPin: () => Promise<void>
  createEmployeeRecord: (input: { email: string; employmentType: "full_time" | "part_time" | "contractor" | "intern" | "probation_full_time" | "probation_part_time"; fullName: string; phone: string }) => Promise<{ warning: string }>
  employeeForm: { profile_id: string; employee_code: string; attendance_number: string; legal_name: string; personal_phone: string; personal_email: string; national_id: string; date_of_birth: string; gender: string; address: string; department: string; job_title: string; employment_type: import("../../lib/staff/types").StaffEmploymentType; main_work_location: string; payroll_location: string; contract_status: import("../../lib/staff/types").StaffContractStatus; contract_type: string; contract_start_date: string; contract_end_date: string; probation_payroll_type: "monthly" | "manager" | "hourly"; labor_payroll_type: "monthly" | "manager" | "hourly"; probation_salary_percentage: string; probation_bonus_percentage: string; probation_start_date: string; probation_end_date: string; labor_start_date: string; labor_end_date: string; start_date: string; end_date: string; base_salary_vnd: string; hourly_rate_vnd: string; monthly_bonus_vnd: string; lunch_allowance_vnd: string; rest_period_hours: string; overtime_rate_multiplier: string; night_rate_multiplier: string; holiday_rate_multiplier: string; employee_contribution_rate: string; employer_contribution_rate: string; pit_withholding_rate: string; dependents_count: string; bank_name: string; bank_account_number: string; tax_code: string; social_insurance_number: string; social_insurance_enrolled: boolean; social_insurance_salary_vnd: string; emergency_contact: string; emergency_contact_name: string; emergency_contact_relationship: string; emergency_contact_phone: string; google_drive_folder_url: string; payroll_note: string; profile_photo_path: string; cv_document_path: string; active: boolean; kiosk_access_role: "" | "manager" | "staff"; kiosk_pin_configured_at: string }
  employeeKioskAccessRole: "manager" | "staff"
  employeeKioskPin: string
  employeeKioskPinConfirm: string
  employeeKioskPinEmailRecipient: string
  employeeKioskPinEmailState: "idle" | "sending" | "sent"
  employeeKioskPinSaveConfirmation: "" | "created" | "replaced"
  employeeKioskPinLoading: boolean
  employeeKioskPinVisibleValue: string
  employeePayrollSummary: import("../../lib/staff/types").StaffPayrollCalculation
  employeeProfileById: Map<string, import("../../lib/staff/types").StaffEmployeeProfile>
  firstEmployeeStaffProfileId: string
  generateEmployeeKioskPin: () => void
  handleHrDocumentUpload: (event: React.ChangeEvent<HTMLInputElement, Element>, documentType: "profile_photo" | "cv") => Promise<void>
  hrDocumentUploading: "" | import("../../lib/staff/types").StaffHrDocumentType
  saveEmployeeProfile: () => Promise<void>
  sendEmployeeKioskPinEmail: (staffProfileId: string) => Promise<void>
  selectedEmployeeDocuments: import("../../lib/staff/types").StaffHrDocument[]
  selectedEmployeeOutstandingDebt: number
  selectedEmployeeStaffId: string
  selectedEmployeeStaffProfile: import("../../lib/staff/types").StaffProfile | null
  setEmployeeForm: React.Dispatch<React.SetStateAction<{ profile_id: string; employee_code: string; attendance_number: string; legal_name: string; personal_phone: string; personal_email: string; national_id: string; date_of_birth: string; gender: string; address: string; department: string; job_title: string; employment_type: import("../../lib/staff/types").StaffEmploymentType; main_work_location: string; payroll_location: string; contract_status: import("../../lib/staff/types").StaffContractStatus; contract_type: string; contract_start_date: string; contract_end_date: string; probation_payroll_type: "monthly" | "manager" | "hourly"; labor_payroll_type: "monthly" | "manager" | "hourly"; probation_salary_percentage: string; probation_bonus_percentage: string; probation_start_date: string; probation_end_date: string; labor_start_date: string; labor_end_date: string; start_date: string; end_date: string; base_salary_vnd: string; hourly_rate_vnd: string; monthly_bonus_vnd: string; lunch_allowance_vnd: string; rest_period_hours: string; overtime_rate_multiplier: string; night_rate_multiplier: string; holiday_rate_multiplier: string; employee_contribution_rate: string; employer_contribution_rate: string; pit_withholding_rate: string; dependents_count: string; bank_name: string; bank_account_number: string; tax_code: string; social_insurance_number: string; social_insurance_enrolled: boolean; social_insurance_salary_vnd: string; emergency_contact: string; emergency_contact_name: string; emergency_contact_relationship: string; emergency_contact_phone: string; google_drive_folder_url: string; payroll_note: string; profile_photo_path: string; cv_document_path: string; active: boolean; kiosk_access_role: "" | "manager" | "staff"; kiosk_pin_configured_at: string }>>
  setEmployeeKioskAccessRole: React.Dispatch<React.SetStateAction<"manager" | "staff">>
  setEmployeeKioskPin: React.Dispatch<React.SetStateAction<string>>
  setEmployeeKioskPinConfirm: React.Dispatch<React.SetStateAction<string>>
  visibleAllStaffProfileOptions: import("../../lib/staff/types").StaffProfile[]
  hrContractTypeOptions: import("../../lib/staff/types").StaffHrSetupOption[]
  hrDepartmentOptions: import("../../lib/staff/types").StaffHrSetupOption[]
  hrJobTitleOptions: import("../../lib/staff/types").StaffHrSetupOption[]
  hrLocationOptions: import("../../lib/staff/types").StaffHrSetupOption[]
  hrOptionsByType: Map<import("../../lib/staff/types").StaffHrSetupOptionType, import("../../lib/staff/types").StaffHrSetupOption[]>
  hrSettings: import("../../lib/staff/types").StaffHrSettings
  hrSetupForm: Record<import("../../lib/staff/types").StaffHrSetupOptionType, string>
  hrSetupOptions: import("../../lib/staff/types").StaffHrSetupOption[]
  saveHrSettings: () => Promise<void>
  saveHrSetupOption: (optionType: import("../../lib/staff/types").StaffHrSetupOptionType) => Promise<void>
  updateHrSetupOption: (optionId: string, name: string) => Promise<boolean>
  setHrSetupOptionActive: (optionId: string, active: boolean) => Promise<void>
  setHrSettings: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffHrSettings>>
  setHrSetupForm: React.Dispatch<React.SetStateAction<Record<import("../../lib/staff/types").StaffHrSetupOptionType, string>>>
  syncPayrollDraft: () => Promise<void>
  hrTab: import("../../lib/staff/types").StaffHrTab
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  saving: boolean
  setHrTab: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffHrTab>>
  setStatus: React.Dispatch<React.SetStateAction<string>>
  sharedText: (typeof uiText)[StaffConsoleLanguage]
  text: StaffConsoleCopy
}

export default function HrSection({
  approvePayrollRun,
  downloadEmployeePayslip,
  downloadPayrollExcel,
  generatePayrollRun,
  hrAdjustmentForm,
  hrPayrollTotals,
  leaveRequests,
  payrollItems,
  payrollPeriodEnd,
  payrollPeriodStart,
  payrollRunForm,
  payrollRuns,
  periodHrAdjustments,
  profileById,
  costAssignments,
  loadHrData,
  staffCostAllocations,
  saveHrAdjustment,
  setHrAdjustmentForm,
  setPayrollRunForm,
  staffPayrollCalculations,
  updateHrAdjustmentStatus,
  visibleStaffProfileOptions,
  approveAttendancePeriod,
  applyShiftTemplate,
  attendanceLogs,
  attendanceScheduleScopeOptions,
  attendanceSettings,
  attendanceShiftsByCell,
  attendanceWeekEnd,
  attendanceWeekDates,
  attendanceWeekStart,
  draggingShiftId,
  draftShiftCount,
  effectiveAttendanceScheduleScope,
  effectiveShiftTemplates,
  editShift,
  firstScheduleStaffProfileId,
  saveAttendanceSettings,
  saveShift,
  selectedShiftTemplate,
  setAttendanceScheduleScope,
  setAttendanceSettings,
  setAttendanceRange,
  setDraggingShiftId,
  setShiftForm,
  shiftForm,
  shiftAttendanceRange,
  shiftWarningsById,
  startShiftForCell,
  resetAttendanceRangeToThisWeek,
  updateShiftStatus,
  visibleScheduleAttendanceShifts,
  visibleScheduleStaffProfileOptions,
  copyPreviousAttendanceWeek,
  moveShiftToCell,
  publishAttendanceWeek,
  canEditEmployeeProfiles,
  canAccessHrSettings,
  canAccessZaloSettings,
  canManageEmployeeKioskPins,
  canManageAttendance,
  isOwnerOrAdmin,
  canRevealEmployeeKioskPin,
  editEmployeeProfile,
  configureEmployeeKioskPin,
  createEmployeeRecord,
  employeeForm,
  employeeKioskAccessRole,
  employeeKioskPin,
  employeeKioskPinConfirm,
  employeeKioskPinEmailRecipient,
  employeeKioskPinEmailState,
  employeeKioskPinSaveConfirmation,
  employeeKioskPinLoading,
  employeeKioskPinVisibleValue,
  employeePayrollSummary,
  employeeProfileById,
  firstEmployeeStaffProfileId,
  generateEmployeeKioskPin,
  handleHrDocumentUpload,
  hrDocumentUploading,
  saveEmployeeProfile,
  sendEmployeeKioskPinEmail,
  selectedEmployeeDocuments,
  selectedEmployeeOutstandingDebt,
  selectedEmployeeStaffId,
  selectedEmployeeStaffProfile,
  setEmployeeForm,
  setEmployeeKioskAccessRole,
  setEmployeeKioskPin,
  setEmployeeKioskPinConfirm,
  visibleAllStaffProfileOptions,
  hrContractTypeOptions,
  hrDepartmentOptions,
  hrJobTitleOptions,
  hrLocationOptions,
  hrOptionsByType,
  hrSettings,
  hrSetupForm,
  hrSetupOptions,
  saveHrSettings,
  saveHrSetupOption,
  updateHrSetupOption,
  setHrSetupOptionActive,
  setHrSettings,
  setHrSetupForm,
  syncPayrollDraft,
  hrTab,
  resolvedLanguage,
  saving,
  setHrTab,
  setStatus,
  sharedText,
  text,
}: HrSectionProps) {
  return (
    <StaffHrHub
      model={{
        payroll: {
          approvePayrollRun,
          downloadEmployeePayslip,
          downloadPayrollExcel,
          generatePayrollRun,
          hrAdjustmentForm,
          hrPayrollTotals,
          leaveRequests,
          payrollItems,
          payrollPeriodEnd,
          payrollPeriodStart,
          payrollRunForm,
          payrollRuns,
          periodHrAdjustments,
          profileById,
          costAssignments,
          reloadCostAssignments: () => loadHrData(true),
          staffCostAllocations,
          saveHrAdjustment,
          setHrAdjustmentForm,
          setPayrollRunForm,
          staffPayrollCalculations,
          updateHrAdjustmentStatus,
          visibleStaffProfileOptions,
        },
        schedule: {
          approveAttendancePeriod,
          applyShiftTemplate,
          attendanceLogs,
          attendanceScheduleScopeOptions,
          attendanceSettings,
          attendanceShiftsByCell,
          attendanceWeekEnd,
          attendanceWeekDates,
          attendanceWeekStart,
          draggingShiftId,
          draftShiftCount,
          effectiveAttendanceScheduleScope,
          effectiveShiftTemplates,
          editShift,
          firstScheduleStaffProfileId,
          saveAttendanceSettings,
          saveShift,
          selectedShiftTemplate,
          setAttendanceScheduleScope,
          setAttendanceSettings,
          setAttendanceRange,
          setDraggingShiftId,
          setShiftForm,
          shiftForm,
          shiftAttendanceRange,
          shiftWarningsById,
          startShiftForCell,
          resetAttendanceRangeToThisWeek,
          updateShiftStatus,
          visibleScheduleAttendanceShifts,
          visibleScheduleStaffProfileOptions,
          copyPreviousAttendanceWeek,
          moveShiftToCell,
          publishAttendanceWeek,
        },
        access: {
          canEditEmployeeProfiles,
          canAccessHrSettings,
          canAccessZaloSettings,
          canManageEmployeeKioskPins,
          canManageAttendance,
          isOwnerOrAdmin,
          canRevealEmployeeKioskPin,
        },
        employees: {
          editEmployeeProfile,
          configureEmployeeKioskPin,
          createEmployeeRecord,
          employeeForm,
          employeeKioskAccessRole,
          employeeKioskPin,
          employeeKioskPinConfirm,
          employeeKioskPinEmailRecipient,
          employeeKioskPinEmailState,
          employeeKioskPinSaveConfirmation,
          employeeKioskPinLoading,
          employeeKioskPinVisibleValue,
          employeePayrollSummary,
          employeeProfileById,
          firstEmployeeStaffProfileId,
          generateEmployeeKioskPin,
          handleHrDocumentUpload,
          hrDocumentUploading,
          saveEmployeeProfile,
          sendEmployeeKioskPinEmail,
          selectedEmployeeDocuments,
          selectedEmployeeOutstandingDebt,
          selectedEmployeeStaffId,
          selectedEmployeeStaffProfile,
          setEmployeeForm,
          setEmployeeKioskAccessRole,
          setEmployeeKioskPin,
          setEmployeeKioskPinConfirm,
          visibleAllStaffProfileOptions,
        },
        settings: {
          hrContractTypeOptions,
          hrDepartmentOptions,
          hrJobTitleOptions,
          hrLocationOptions,
          hrOptionsByType,
          hrSettings,
          hrSetupForm,
          hrSetupOptions,
          saveHrSettings,
          saveHrSetupOption,
          updateHrSetupOption,
          setHrSetupOptionActive,
          setHrSettings,
          setHrSetupForm,
          syncPayrollDraft,
        },
        shared: {
          hrTab,
          resolvedLanguage,
          saving,
          setHrTab,
          setStatus,
          sharedText,
          text,
        }
      }}
    />
  )
}
