import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import type { uiText } from '../i18n/translations'
import type { StaffCostAssignment } from '../staffCostAllocation'
import type { StaffEmployeeRecordEmploymentType } from '../staffEmployeeRecord'
import type { StaffConsoleCopy } from './copy'
import type { defaultEmployeeForm, defaultHrAdjustmentForm, defaultPayrollRunForm, defaultShiftForm } from './hrSettings'
import type {
  StaffAttendanceLog,
  StaffAttendanceSettings,
  StaffConsoleLanguage,
  StaffEmployeeProfile,
  StaffHrAdjustment,
  StaffHrAdjustmentStatus,
  StaffHrDocument,
  StaffHrDocumentType,
  StaffHrSettings,
  StaffHrSetupOption,
  StaffHrSetupOptionType,
  StaffHrTab,
  StaffLeaveRequest,
  StaffPayrollCalculation,
  StaffPayrollItem,
  StaffPayrollRun,
  StaffProfile,
  StaffScheduleScope,
  StaffScheduleShift,
  StaffShiftStatus,
  StaffShiftTemplate,
  StaffShiftTemplateId,
} from './types'
export type StaffHrSharedModel = {
  hrTab: StaffHrTab
  resolvedLanguage: StaffConsoleLanguage
  saving: boolean
  setHrTab: Dispatch<SetStateAction<StaffHrSharedModel['hrTab']>>
  setStatus: Dispatch<SetStateAction<string>>
  sharedText: (typeof uiText)['en' | 'vi']
  text: StaffConsoleCopy
}

export type StaffHrAccessModel = {
  canEditEmployeeProfiles: boolean
  canAccessHrSettings: boolean
  canAccessZaloSettings: boolean
  canManageEmployeeKioskPins: boolean
  canManageAttendance: boolean
  isOwnerOrAdmin: boolean
  canRevealEmployeeKioskPin: boolean
}

export type StaffHrEmployeesModel = {
  editEmployeeProfile: (staffProfile: StaffProfile) => void
  configureEmployeeKioskPin: () => Promise<void>
  createEmployeeRecord: (input: { email: string; employmentType: StaffEmployeeRecordEmploymentType; fullName: string; phone: string; }) => Promise<{ warning: string; }>
  employeeForm: ReturnType<typeof defaultEmployeeForm>
  employeeKioskAccessRole: "manager" | "staff"
  employeeKioskPin: string
  employeeKioskPinConfirm: string
  employeeKioskPinEmailRecipient: string
  employeeKioskPinEmailState: "idle" | "sending" | "sent"
  employeeKioskPinSaveConfirmation: "" | "created" | "replaced"
  employeeKioskPinLoading: boolean
  employeeKioskPinVisibleValue: string
  employeePayrollSummary: StaffPayrollCalculation
  employeeProfileById: Map<string, StaffEmployeeProfile>
  firstEmployeeStaffProfileId: string
  generateEmployeeKioskPin: () => void
  handleHrDocumentUpload: (event: ChangeEvent<HTMLInputElement>, documentType: Extract<StaffHrDocumentType, "profile_photo" | "cv">) => Promise<void>
  hrDocumentUploading: "" | StaffHrDocumentType
  saveEmployeeProfile: () => Promise<void>
  sendEmployeeKioskPinEmail: (staffProfileId: string) => Promise<void>
  selectedEmployeeDocuments: StaffHrDocument[]
  selectedEmployeeOutstandingDebt: number
  selectedEmployeeStaffId: string
  selectedEmployeeStaffProfile: StaffProfile | null
  setEmployeeForm: Dispatch<SetStateAction<StaffHrEmployeesModel['employeeForm']>>
  setEmployeeKioskAccessRole: Dispatch<SetStateAction<StaffHrEmployeesModel['employeeKioskAccessRole']>>
  setEmployeeKioskPin: Dispatch<SetStateAction<StaffHrEmployeesModel['employeeKioskPin']>>
  setEmployeeKioskPinConfirm: Dispatch<SetStateAction<StaffHrEmployeesModel['employeeKioskPinConfirm']>>
  visibleAllStaffProfileOptions: StaffProfile[]
}

export type StaffHrScheduleModel = {
  approveAttendancePeriod: () => Promise<void>
  applyShiftTemplate: (templateId: StaffShiftTemplateId) => void
  attendanceLogs: StaffAttendanceLog[]
  attendanceScheduleScopeOptions: StaffScheduleScope[]
  attendanceSettings: StaffAttendanceSettings
  attendanceShiftsByCell: Map<string, StaffScheduleShift[]>
  attendanceWeekEnd: string
  attendanceWeekDates: string[]
  attendanceWeekStart: string
  draggingShiftId: string
  draftShiftCount: number
  effectiveAttendanceScheduleScope: StaffScheduleScope
  effectiveShiftTemplates: StaffShiftTemplate[]
  editShift: (shift: StaffScheduleShift) => void
  firstScheduleStaffProfileId: string
  saveAttendanceSettings: () => Promise<void>
  saveShift: () => Promise<void>
  selectedShiftTemplate: StaffShiftTemplateId
  setAttendanceScheduleScope: Dispatch<SetStateAction<StaffScheduleScope>>
  setAttendanceSettings: Dispatch<SetStateAction<StaffHrScheduleModel['attendanceSettings']>>
  setAttendanceRange: (start: string, end: string) => void
  setDraggingShiftId: Dispatch<SetStateAction<StaffHrScheduleModel['draggingShiftId']>>
  setShiftForm: Dispatch<SetStateAction<StaffHrScheduleModel['shiftForm']>>
  shiftForm: ReturnType<typeof defaultShiftForm>
  shiftAttendanceRange: (dayOffset: number) => void
  shiftWarningsById: Map<string, string[]>
  startShiftForCell: (staffProfileId: string, shiftDate: string) => Promise<void>
  resetAttendanceRangeToThisWeek: () => void
  updateShiftStatus: (shift: StaffScheduleShift, status: StaffShiftStatus) => Promise<void>
  visibleScheduleAttendanceShifts: StaffScheduleShift[]
  visibleScheduleStaffProfileOptions: StaffProfile[]
  copyPreviousAttendanceWeek: () => Promise<void>
  moveShiftToCell: (shift: StaffScheduleShift, staffProfileId: string, shiftDate: string) => Promise<void>
  publishAttendanceWeek: () => Promise<void>
}

export type StaffHrPayrollModel = {
  approvePayrollRun: (run: StaffPayrollRun) => Promise<void>
  downloadEmployeePayslip: (staffProfileId?: string) => Promise<void>
  downloadPayrollExcel: () => Promise<boolean>
  generatePayrollRun: () => Promise<void>
  hrAdjustmentForm: ReturnType<typeof defaultHrAdjustmentForm>
  hrPayrollTotals: { gross: number; net: number; companyCost: number; restWarnings: number; }
  leaveRequests: StaffLeaveRequest[]
  payrollItems: StaffPayrollItem[]
  payrollPeriodEnd: string
  payrollPeriodStart: string
  payrollRunForm: ReturnType<typeof defaultPayrollRunForm>
  payrollRuns: StaffPayrollRun[]
  periodHrAdjustments: StaffHrAdjustment[]
  profileById: Map<string, StaffProfile>
  costAssignments: StaffCostAssignment[]
  reloadCostAssignments: () => Promise<void>
  staffCostAllocations: Map<string, { shares: { location: string; paidMinutes: number; companyCost: number; }[]; needsPaidHours: boolean; }>
  saveHrAdjustment: (kind?: "adjustment" | "advance") => Promise<void>
  setHrAdjustmentForm: Dispatch<SetStateAction<StaffHrPayrollModel['hrAdjustmentForm']>>
  setPayrollRunForm: Dispatch<SetStateAction<StaffHrPayrollModel['payrollRunForm']>>
  staffPayrollCalculations: Map<string, StaffPayrollCalculation>
  updateHrAdjustmentStatus: (adjustment: StaffHrAdjustment, statusValue: StaffHrAdjustmentStatus) => Promise<void>
  visibleStaffProfileOptions: StaffProfile[]
}

export type StaffHrSettingsModel = {
  hrContractTypeOptions: StaffHrSetupOption[]
  hrDepartmentOptions: StaffHrSetupOption[]
  hrJobTitleOptions: StaffHrSetupOption[]
  hrLocationOptions: StaffHrSetupOption[]
  hrOptionsByType: Map<StaffHrSetupOptionType, StaffHrSetupOption[]>
  hrSettings: StaffHrSettings
  hrSetupForm: Record<StaffHrSetupOptionType, string>
  hrSetupOptions: StaffHrSetupOption[]
  saveHrSettings: () => Promise<void>
  saveHrSetupOption: (optionType: StaffHrSetupOptionType) => Promise<void>
  updateHrSetupOption: (optionId: string, name: string) => Promise<boolean>
  setHrSetupOptionActive: (optionId: string, active: boolean) => Promise<void>
  setHrSettings: Dispatch<SetStateAction<StaffHrSettingsModel['hrSettings']>>
  setHrSetupForm: Dispatch<SetStateAction<StaffHrSettingsModel['hrSetupForm']>>
  syncPayrollDraft: () => Promise<void>
}

/** Each HR feature receives its own state and commands; access remains explicit and shared. */
export type StaffHrModel = {
  shared: StaffHrSharedModel
  access: StaffHrAccessModel
  employees: StaffHrEmployeesModel
  schedule: StaffHrScheduleModel
  payroll: StaffHrPayrollModel
  settings: StaffHrSettingsModel
}
