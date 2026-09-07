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

/** Typed boundary between the staff controller and its lazy HR view. */
export type StaffHrModel = {
  approvePayrollRun: (run: StaffPayrollRun) => Promise<void>
  approveAttendancePeriod: () => Promise<void>
  applyShiftTemplate: (templateId: StaffShiftTemplateId) => void
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
  firstScheduleStaffProfileId: string
  generateEmployeeKioskPin: () => void
  generatePayrollRun: () => Promise<void>
  handleHrDocumentUpload: (event: ChangeEvent<HTMLInputElement>, documentType: Extract<StaffHrDocumentType, "profile_photo" | "cv">) => Promise<void>
  hrAdjustmentForm: ReturnType<typeof defaultHrAdjustmentForm>
  hrContractTypeOptions: StaffHrSetupOption[]
  hrDepartmentOptions: StaffHrSetupOption[]
  hrDocumentUploading: "" | StaffHrDocumentType
  hrJobTitleOptions: StaffHrSetupOption[]
  hrLocationOptions: StaffHrSetupOption[]
  hrOptionsByType: Map<StaffHrSetupOptionType, StaffHrSetupOption[]>
  hrPayrollTotals: { gross: number; net: number; companyCost: number; restWarnings: number; }
  hrSettings: StaffHrSettings
  hrSetupForm: Record<StaffHrSetupOptionType, string>
  hrSetupOptions: StaffHrSetupOption[]
  hrTab: StaffHrTab
  isOwnerOrAdmin: boolean
  canRevealEmployeeKioskPin: boolean
  leaveRequests: StaffLeaveRequest[]
  payrollItems: StaffPayrollItem[]
  payrollPeriodEnd: string
  payrollPeriodStart: string
  payrollRunForm: ReturnType<typeof defaultPayrollRunForm>
  payrollRuns: StaffPayrollRun[]
  periodHrAdjustments: StaffHrAdjustment[]
  profileById: Map<string, StaffProfile>
  resolvedLanguage: StaffConsoleLanguage
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
  setHrSettings: Dispatch<SetStateAction<StaffHrModel['hrSettings']>>
  setHrSetupForm: Dispatch<SetStateAction<StaffHrModel['hrSetupForm']>>
  setHrTab: Dispatch<SetStateAction<StaffHrModel['hrTab']>>
  setStatus: Dispatch<SetStateAction<string>>
  setPayrollRunForm: Dispatch<SetStateAction<StaffHrModel['payrollRunForm']>>
  setShiftForm: Dispatch<SetStateAction<StaffHrModel['shiftForm']>>
  sharedText: (typeof uiText)['en' | 'vi']
  shiftForm: ReturnType<typeof defaultShiftForm>
  shiftAttendanceRange: (dayOffset: number) => void
  shiftWarningsById: Map<string, string[]>
  staffPayrollCalculations: Map<string, StaffPayrollCalculation>
  startShiftForCell: (staffProfileId: string, shiftDate: string) => Promise<void>
  syncPayrollDraft: () => Promise<void>
  text: StaffConsoleCopy
  resetAttendanceRangeToThisWeek: () => void
  updateHrAdjustmentStatus: (adjustment: StaffHrAdjustment, statusValue: StaffHrAdjustmentStatus) => Promise<void>
  updateShiftStatus: (shift: StaffScheduleShift, status: StaffShiftStatus) => Promise<void>
  visibleAllStaffProfileOptions: StaffProfile[]
  visibleScheduleAttendanceShifts: StaffScheduleShift[]
  visibleScheduleStaffProfileOptions: StaffProfile[]
  visibleStaffProfileOptions: StaffProfile[]
  copyPreviousAttendanceWeek: () => Promise<void>
  moveShiftToCell: (shift: StaffScheduleShift, staffProfileId: string, shiftDate: string) => Promise<void>
  publishAttendanceWeek: () => Promise<void>
}
