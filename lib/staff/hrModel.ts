import type { ChangeEvent, Dispatch, JSX, ReactNode, SetStateAction } from 'react'
import type { uiText } from '../i18n/translations'
import type { StaffCostAssignment } from '../staffCostAllocation'
import type { StaffEmployeeRecordEmploymentType } from '../staffEmployeeRecord'
import type { StaffConsoleCopy } from './copy'
import type { StaffHrTab, StaffScheduleScope, StaffRole, StaffShiftTemplateId, StaffShiftTemplate, StaffEmploymentType, StaffProfile, StaffShiftStatus, StaffGender, StaffContractStatus, StaffHrSetupOptionType, StaffHrAdjustmentType, StaffHrAdjustmentStatus, StaffPayrollStatus, StaffPayrollPayCycle, StaffHrDocumentType, StaffScheduleShift, StaffAttendanceLog, StaffLeaveRequest, StaffEmployeeProfile, StaffAttendanceSettings, StaffHrSettings, StaffHrSetupOption, StaffHrAdjustment, StaffPayrollRun, StaffPayrollItem, StaffHrDocument, StaffPayrollCalculation, StaffConsoleLanguage, StaffPickerFieldProps } from './types'

/** Typed boundary between the staff controller and its lazy HR view. */
export type StaffHrModel = {
  ButtonIconText: ({ children, icon }: { children: ReactNode; icon: ReactNode; }) => JSX.Element
  StaffPickerField: ({ ariaLabel, type, value, mode, placeholder, inputRef, onChange }: StaffPickerFieldProps) => JSX.Element
  StaffRoleAvatar: ({ profile, text }: { profile: StaffProfile; text: StaffConsoleCopy; }) => JSX.Element
  approvePayrollRun: (run: StaffPayrollRun) => Promise<void>
  approveAttendancePeriod: () => Promise<void>
  applyShiftTemplate: (templateId: StaffShiftTemplateId) => void
  attendanceGridStyle: { gridTemplateColumns: string; minWidth: string; }
  attendanceLogs: StaffAttendanceLog[]
  attendanceScheduleScopeOptions: StaffScheduleScope[]
  attendanceSettings: StaffAttendanceSettings
  attendanceShiftsByCell: Map<string, StaffScheduleShift[]>
  attendanceWeekEnd: string
  attendanceWeekDates: string[]
  attendanceWeekStart: string
  canEditEmployeeProfiles: boolean
  canAccessHrSettings: boolean
  canAccessZaloSettings: boolean
  canManageEmployeeKioskPins: boolean
  canManageAttendance: boolean
  customerName: (profile: StaffProfile, text?: StaffConsoleCopy) => string
  dateFromInput: (value: string) => Date
  dongDigits: (value: string | number | null | undefined) => string
  downloadEmployeePayslip: (staffProfileId?: string) => Promise<void>
  downloadPayrollExcel: () => Promise<boolean>
  draggingShiftId: string
  draftShiftCount: number
  effectiveAttendanceScheduleScope: StaffScheduleScope
  effectiveShiftTemplates: StaffShiftTemplate[]
  editEmployeeProfile: (staffProfile: StaffProfile) => void
  editShift: (shift: StaffScheduleShift) => void
  configureEmployeeKioskPin: () => Promise<void>
  createEmployeeRecord: (input: { email: string; employmentType: StaffEmployeeRecordEmploymentType; fullName: string; phone: string; }) => Promise<{ warning: string; }>
  employeeForm: { profile_id: string; employee_code: string; attendance_number: string; legal_name: string; personal_phone: string; personal_email: string; national_id: string; date_of_birth: string; gender: string; address: string; department: string; job_title: string; employment_type: StaffEmploymentType; main_work_location: string; payroll_location: string; contract_status: StaffContractStatus; contract_type: string; contract_start_date: string; contract_end_date: string; probation_payroll_type: "hourly" | "monthly" | "manager"; labor_payroll_type: "hourly" | "monthly" | "manager"; probation_salary_percentage: string; probation_bonus_percentage: string; probation_start_date: string; probation_end_date: string; labor_start_date: string; labor_end_date: string; start_date: string; end_date: string; base_salary_vnd: string; hourly_rate_vnd: string; monthly_bonus_vnd: string; lunch_allowance_vnd: string; rest_period_hours: string; overtime_rate_multiplier: string; night_rate_multiplier: string; holiday_rate_multiplier: string; employee_contribution_rate: string; employer_contribution_rate: string; pit_withholding_rate: string; dependents_count: string; bank_name: string; bank_account_number: string; tax_code: string; social_insurance_number: string; social_insurance_enrolled: boolean; social_insurance_salary_vnd: string; emergency_contact: string; emergency_contact_name: string; emergency_contact_relationship: string; emergency_contact_phone: string; google_drive_folder_url: string; payroll_note: string; profile_photo_path: string; cv_document_path: string; active: boolean; kiosk_access_role: "" | "manager" | "staff"; kiosk_pin_configured_at: string; }
  employeeKioskAccessRole: "manager" | "staff"
  employeeKioskPin: string
  employeeKioskPinConfirm: string
  employeeKioskPinEmailRecipient: string
  employeeKioskPinEmailState: "idle" | "sending" | "sent"
  employeeKioskPinSaveConfirmation: "" | "created" | "replaced"
  employeeKioskPinLoading: boolean
  employeeKioskPinVisibleValue: string
  employeeFormForProfile: (staffProfile: StaffProfile, employee?: StaffEmployeeProfile) => StaffHrModel["employeeForm"]
  employeePayrollSummary: StaffPayrollCalculation
  employeeProfileById: Map<string, StaffEmployeeProfile>
  emptyStaffPayrollCalculation: (profileId?: string) => StaffPayrollCalculation
  filteredHrStaffProfiles: StaffProfile[]
  firstEmployeeStaffProfileId: string
  firstScheduleStaffProfileId: string
  formatDongInput: (value: string | number | null | undefined) => string
  formatVnd: (value: number) => string
  formatVndCompact: (value: number) => string
  generateEmployeeKioskPin: () => void
  generatePayrollRun: () => Promise<void>
  handleHrDocumentUpload: (event: ChangeEvent<HTMLInputElement>, documentType: Extract<StaffHrDocumentType, "profile_photo" | "cv">) => Promise<void>
  hoursLabel: (minutes: number) => string
  hrAdjustmentForm: { id: string; profile_id: string; adjustment_type: StaffHrAdjustmentType; title: string; amount_vnd: string; effective_date: string; period_start: string; period_end: string; status: StaffHrAdjustmentStatus; notes: string; }
  hrContractTypeOptions: StaffHrSetupOption[]
  hrDepartmentFilter: string
  hrDepartmentOptions: StaffHrSetupOption[]
  hrDocumentUploading: "" | StaffHrDocumentType
  hrJobTitleOptions: StaffHrSetupOption[]
  hrLocationOptions: StaffHrSetupOption[]
  hrOptionsByType: Map<StaffHrSetupOptionType, StaffHrSetupOption[]>
  hrPayrollTotals: { gross: number; net: number; companyCost: number; restWarnings: number; }
  hrSearch: string
  hrSettings: StaffHrSettings
  hrSetupForm: Record<StaffHrSetupOptionType, string>
  hrSetupOptions: StaffHrSetupOption[]
  hrStatusFilter: "all" | StaffContractStatus
  hrTab: StaffHrTab
  isOwnerOrAdmin: boolean
  isPaidLeaveForEmployee: (leave: StaffLeaveRequest, employee: StaffEmployeeProfile | undefined) => boolean
  canRevealEmployeeKioskPin: boolean
  leaveHoursInsidePeriod: (leave: StaffLeaveRequest, periodStart: string, periodEnd: string) => number
  leaveRequests: StaffLeaveRequest[]
  normalizeHrAdjustmentStatus: (value: string | null | undefined) => StaffHrAdjustmentStatus
  normalizeHrAdjustmentType: (value: string | null | undefined) => StaffHrAdjustmentType
  normalizePayrollPayCycle: (value: string | null | undefined) => StaffPayrollPayCycle
  normalizePayrollStatus: (value: string | null | undefined) => StaffPayrollStatus
  normalizeStaffContractStatus: (value: string | null | undefined) => StaffContractStatus
  normalizeStaffEmploymentType: (value: StaffEmploymentType | string | null | undefined) => StaffEmploymentType
  normalizeTime: (value: string | null | undefined) => string
  parseDong: (value: string | number | null | undefined) => number
  payrollItems: StaffPayrollItem[]
  payrollPeriodEnd: string
  payrollPeriodStart: string
  payrollRunForm: { id: string; code: string; name: string; pay_cycle: StaffPayrollPayCycle; period_start: string; period_end: string; notes: string; }
  payrollRuns: StaffPayrollRun[]
  periodHrAdjustments: StaffHrAdjustment[]
  profileById: Map<string, StaffProfile>
  rangeLabel: (start: string, end: string) => string
  resolvedLanguage: StaffConsoleLanguage
  roleLabel: (role?: string | null, email?: string | null) => StaffRole
  costAssignments: StaffCostAssignment[]
  reloadCostAssignments: () => Promise<void>
  staffCostAllocations: Map<string, { shares: { location: string; paidMinutes: number; companyCost: number; }[]; needsPaidHours: boolean; }>
  saveEmployeeProfile: () => Promise<void>
  saveHrAdjustment: (kind?: "adjustment" | "advance") => Promise<void>
  saveHrSettings: () => Promise<void>
  saveHrSetupOption: (optionType: StaffHrSetupOptionType) => Promise<void>
  updateHrSetupOption: (optionId: string, name: string) => Promise<boolean>
  setHrSetupOptionActive: (optionId: string, active: boolean) => Promise<void>
  saveAttendanceSettings: () => Promise<void>
  saveShift: () => Promise<void>
  saving: boolean
  sendEmployeeKioskPinEmail: (staffProfileId: string) => Promise<void>
  selectedEmployeeDocuments: StaffHrDocument[]
  selectedEmployeeOutstandingDebt: number
  selectedEmployeeStaffId: string
  selectedEmployeeStaffProfile: StaffProfile | null
  selectedShiftTemplate: StaffShiftTemplateId
  setEmployeeForm: Dispatch<SetStateAction<StaffHrModel['employeeForm']>>
  setEmployeeKioskAccessRole: Dispatch<SetStateAction<StaffHrModel['employeeKioskAccessRole']>>
  setEmployeeKioskPin: Dispatch<SetStateAction<StaffHrModel['employeeKioskPin']>>
  setEmployeeKioskPinConfirm: Dispatch<SetStateAction<StaffHrModel['employeeKioskPinConfirm']>>
  setAttendanceScheduleScope: Dispatch<SetStateAction<StaffScheduleScope>>
  setAttendanceSettings: Dispatch<SetStateAction<StaffHrModel['attendanceSettings']>>
  setAttendanceRange: (start: string, end: string) => void
  setDraggingShiftId: Dispatch<SetStateAction<StaffHrModel['draggingShiftId']>>
  setHrAdjustmentForm: Dispatch<SetStateAction<StaffHrModel['hrAdjustmentForm']>>
  setHrDepartmentFilter: Dispatch<SetStateAction<StaffHrModel['hrDepartmentFilter']>>
  setHrSearch: Dispatch<SetStateAction<StaffHrModel['hrSearch']>>
  setHrSettings: Dispatch<SetStateAction<StaffHrModel['hrSettings']>>
  setHrSetupForm: Dispatch<SetStateAction<StaffHrModel['hrSetupForm']>>
  setHrStatusFilter: Dispatch<SetStateAction<StaffHrModel['hrStatusFilter']>>
  setHrTab: Dispatch<SetStateAction<StaffHrModel['hrTab']>>
  setStatus: Dispatch<SetStateAction<string>>
  setPayrollRunForm: Dispatch<SetStateAction<StaffHrModel['payrollRunForm']>>
  setShiftForm: Dispatch<SetStateAction<StaffHrModel['shiftForm']>>
  sharedText: (typeof uiText)['en' | 'vi']
  shiftForm: { id: string; staff_profile_id: string; location: string; shift_role: string; shift_date: string; start_time: string; end_time: string; break_minutes: string; status: StaffShiftStatus; notes: string; }
  shiftAttendanceRange: (dayOffset: number) => void
  shortDateLabel: (value: string) => string
  shiftWarningsById: Map<string, string[]>
  staffContractStatuses: StaffContractStatus[]
  staffCvTypes: string[]
  staffDateLabel: (value: string) => string
  staffEmploymentTypes: StaffEmploymentType[]
  staffGenderOptions: StaffGender[]
  staffHrAdjustmentStatuses: StaffHrAdjustmentStatus[]
  staffHrAdjustmentTypes: StaffHrAdjustmentType[]
  staffHrSetupOptionTypes: StaffHrSetupOptionType[]
  staffHrTabs: StaffHrTab[]
  staffPayrollCalculations: Map<string, StaffPayrollCalculation>
  staffPayrollPayCycles: StaffPayrollPayCycle[]
  staffProfilePhotoTypes: string[]
  staffShiftStatuses: StaffShiftStatus[]
  staffRoleName: (role: StaffRole, text?: StaffConsoleCopy) => string
  startShiftForCell: (staffProfileId: string, shiftDate: string) => Promise<void>
  syncPayrollDraft: () => Promise<void>
  text: StaffConsoleCopy
  resetAttendanceRangeToThisWeek: () => void
  updateHrAdjustmentStatus: (adjustment: StaffHrAdjustment, statusValue: StaffHrAdjustmentStatus) => Promise<void>
  updateShiftStatus: (shift: StaffScheduleShift, status: StaffShiftStatus) => Promise<void>
  visibleAllStaffProfileOptions: StaffProfile[]
  visibleAttendanceShifts: StaffScheduleShift[]
  visibleScheduleAttendanceShifts: StaffScheduleShift[]
  visibleScheduleStaffProfileOptions: StaffProfile[]
  visibleStaffProfileOptions: StaffProfile[]
  copyPreviousAttendanceWeek: () => Promise<void>
  moveShiftToCell: (shift: StaffScheduleShift, staffProfileId: string, shiftDate: string) => Promise<void>
  publishAttendanceWeek: () => Promise<void>
}
