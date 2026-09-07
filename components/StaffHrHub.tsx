'use client'

import dynamic from 'next/dynamic'
import { EmployeeDirectoryStatus, EmployeeProfileSectionId, HrSettingsSection, StaffHrHubProps, StaffScheduleViewMode, accountantWorkspaceCopy, employeeExperienceCopy, employeeMatchesDirectoryFilters, hrCompletionCopy, hrModuleIcon, payslipSelectorCopy, staffScheduleCopy } from '../features/hr/presentation'
const EmployeesSection = dynamic(() => import('../features/hr/EmployeesSection'), { ssr: false })
const ScheduleSection = dynamic(() => import('../features/hr/ScheduleSection'), { ssr: false })
const TimesheetSection = dynamic(() => import('../features/hr/TimesheetSection'), { ssr: false })
const PayrollSection = dynamic(() => import('../features/hr/PayrollSection'), { ssr: false })
const AdjustmentsSection = dynamic(() => import('../features/hr/AdjustmentsSection'), { ssr: false })
const SettingsSection = dynamic(() => import('../features/hr/SettingsSection'), { ssr: false })


import { normalizeTime } from '../lib/staff/dates'
import { formatVndCompact } from '../lib/staff/formatting'
import { normalizeHrAdjustmentStatus, normalizeHrAdjustmentType } from '../lib/staff/hrSettings'
import {
  staffContractStatuses,
  staffEmploymentTypes,
  staffHrSetupOptionTypes,
  staffHrTabs
} from '../lib/staff/options'
import { emptyStaffPayrollCalculation } from '../lib/staff/payroll'
import { customerName } from '../lib/staff/profiles'

import type { StaffEmployeeRecordEmploymentType } from '@/lib/staffEmployeeRecord'
import { isStaffKioskEligibleDepartment } from '@/lib/staffKioskDirectory'
import { accessibleStaffHrTabs } from '@/lib/staffKioskScope'
import {
  CalendarDays,
  Coins,
  Landmark,
  ListChecks,
  Settings2,
  TimerReset
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  StaffHrSetupOptionType,
  StaffProfile,
  StaffScheduleShift,
  StaffShiftTemplate
} from '../lib/staff/types'
import { type StaffCostReportRow } from './StaffCostAssignments'
import StaffZaloMiniAppSettings from './StaffZaloMiniAppSettings'

export default function StaffHrHub({ model }: StaffHrHubProps) {
  const { hrTab, resolvedLanguage, saving, setHrTab, setStatus, sharedText, text } = model.shared
  const {
    canEditEmployeeProfiles,
    canAccessHrSettings,
    canAccessZaloSettings,
    canManageEmployeeKioskPins,
    canManageAttendance,
    isOwnerOrAdmin,
    canRevealEmployeeKioskPin,
  } = model.access
  const {
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
  } = model.employees
  const {
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
    setDraggingShiftId,
    setAttendanceRange,
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
  } = model.schedule
  const {
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
    reloadCostAssignments,
    staffCostAllocations,
    saveHrAdjustment,
    setHrAdjustmentForm,
    setPayrollRunForm,
    staffPayrollCalculations,
    updateHrAdjustmentStatus,
    visibleStaffProfileOptions,
  } = model.payroll
  const {
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
  } = model.settings

  const completionText = hrCompletionCopy[resolvedLanguage === 'vi' ? 'vi' : 'en']
  const scheduleCopy = staffScheduleCopy[resolvedLanguage === 'vi' ? 'vi' : 'en']
  const costReportRows: StaffCostReportRow[] = visibleStaffProfileOptions.flatMap((staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    const allocation = staffCostAllocations.get(staffProfile.id)
    return (allocation?.shares || []).map((share) => ({
      ...share, employee: employee?.legal_name || customerName(staffProfile, text),
      employeeCode: employee?.employee_code || '', home: employee?.main_work_location || '—',
      needsPaidHours: allocation?.needsPaidHours || false,
    }))
  })
  const employeeCopy = employeeExperienceCopy[resolvedLanguage === 'vi' ? 'vi' : 'en']
  const accountantCopy = accountantWorkspaceCopy[resolvedLanguage === 'vi' ? 'vi' : 'en']
  const payslipCopy = payslipSelectorCopy[resolvedLanguage === 'vi' ? 'vi' : 'en']
  const [settingsSection, setSettingsSection] = useState<HrSettingsSection>('initialization')
  const [scheduleViewMode, setScheduleViewMode] = useState<StaffScheduleViewMode>('employee')
  const [timesheetSearch, setTimesheetSearch] = useState('')
  const [createEmployeeOpen, setCreateEmployeeOpen] = useState(false)
  const [createEmployeeStatus, setCreateEmployeeStatus] = useState('')
  const [createEmployeeStatusTone, setCreateEmployeeStatusTone] = useState<'error' | 'success'>('success')
  const [createEmployeeSaving, setCreateEmployeeSaving] = useState(false)
  const [employeeDirectoryGroup, setEmployeeDirectoryGroup] = useState('all')
  const [employeeDirectoryLocation, setEmployeeDirectoryLocation] = useState('all')
  const [employeeDirectoryStatus, setEmployeeDirectoryStatus] = useState<EmployeeDirectoryStatus>('active')
  const [selectedHrSetupOptionIds, setSelectedHrSetupOptionIds] = useState<Record<string, string>>({})
  const [payslipDepartmentFilter, setPayslipDepartmentFilter] = useState('all')
  const [payslipLocationFilter, setPayslipLocationFilter] = useState('all')
  const [payslipSelectedEmployeeId, setPayslipSelectedEmployeeId] = useState(selectedEmployeeStaffId)
  const [accountantDownloadPending, setAccountantDownloadPending] = useState(false)
  const [newEmployee, setNewEmployee] = useState<{
    email: string
    employmentType: StaffEmployeeRecordEmploymentType
    fullName: string
    phone: string
  }>({ email: '', employmentType: 'part_time', fullName: '', phone: '' })
  const [openEmployeeSections, setOpenEmployeeSections] = useState<Record<EmployeeProfileSectionId, boolean>>({
    identity: true,
    contract: false,
    payroll: false,
    bank: false,
    contact: false,
    store: false,
    documents: false,
  })
  const updatePayrollPeriodStart = (value: string) => {
    if (!value) return
    setPayrollRunForm((current) => ({
      ...current,
      period_start: value,
      period_end: current.period_end && current.period_end >= value ? current.period_end : value,
    }))
  }
  const updatePayrollPeriodEnd = (value: string) => {
    if (!value) return
    setPayrollRunForm((current) => ({
      ...current,
      period_start: current.period_start && current.period_start <= value ? current.period_start : value,
      period_end: value,
    }))
  }
  useEffect(() => {
    if (!accountantDownloadPending) return
    const timeoutId = window.setTimeout(() => setAccountantDownloadPending(false), 180_000)
    return () => window.clearTimeout(timeoutId)
  }, [accountantDownloadPending])
  const startAccountantDownload = async () => {
    if (accountantDownloadPending) return
    setAccountantDownloadPending(true)
    try {
      const started = await downloadPayrollExcel()
      if (started === false) setAccountantDownloadPending(false)
    } catch {
      setAccountantDownloadPending(false)
    }
  }
  const employeeDirectoryGroups = useMemo(() => {
    const groupOrder = ['GC', 'VRena', 'Manager', 'Office']
    return Array.from(new Set<string>(visibleAllStaffProfileOptions.map((staffProfile) => (
      String(employeeProfileById.get(staffProfile.id)?.department || '').trim() || employeeCopy.unassigned
    )))).sort((left, right) => {
      const leftIndex = groupOrder.indexOf(left)
      const rightIndex = groupOrder.indexOf(right)
      if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
      return left.localeCompare(right)
    })
  }, [employeeCopy.unassigned, employeeProfileById, visibleAllStaffProfileOptions])
  const employeeDirectoryLocations = useMemo(() => {
    const locationOrder = ['HaDo', 'CS']
    return Array.from(new Set<string>(visibleAllStaffProfileOptions.map((staffProfile) => (
      String(employeeProfileById.get(staffProfile.id)?.main_work_location || '').trim() || employeeCopy.unassigned
    )))).sort((left, right) => {
      const leftIndex = locationOrder.indexOf(left)
      const rightIndex = locationOrder.indexOf(right)
      if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
      return left.localeCompare(right)
    })
  }, [employeeCopy.unassigned, employeeProfileById, visibleAllStaffProfileOptions])
  const employeeDirectoryCounts = useMemo(() => visibleAllStaffProfileOptions.reduce((counts: { active: number; terminated: number }, staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    const terminated = employee?.active === false || employee?.contract_status === 'ended'
    counts[terminated ? 'terminated' : 'active'] += 1
    return counts
  }, { active: 0, terminated: 0 }), [employeeProfileById, visibleAllStaffProfileOptions])
  const filteredEmployeeProfileOptions = useMemo(() => {
    return visibleAllStaffProfileOptions.filter((staffProfile) => {
      const employee = employeeProfileById.get(staffProfile.id)
      return employeeMatchesDirectoryFilters(employee, employeeDirectoryGroup, employeeDirectoryLocation, employeeDirectoryStatus, employeeCopy.unassigned)
    })
  }, [employeeCopy.unassigned, employeeDirectoryGroup, employeeDirectoryLocation, employeeDirectoryStatus, employeeProfileById, visibleAllStaffProfileOptions])
  const groupedEmployeeOptions = useMemo(() => {
    const groupOrder = ['GC', 'VRena', 'Manager', 'Office']
    const locationOrder = ['HaDo', 'CS']
    const groups = new Map<string, StaffProfile[]>()
    filteredEmployeeProfileOptions.forEach((staffProfile) => {
      const employee = employeeProfileById.get(staffProfile.id)
      const group = String(employee?.department || '').trim() || employeeCopy.unassigned
      const location = String(employee?.main_work_location || '').trim() || employeeCopy.unassigned
      const key = `${group} · ${location}`
      const current = groups.get(key) || []
      current.push(staffProfile)
      groups.set(key, current)
    })
    return Array.from(groups.entries())
      .sort(([left], [right]) => {
        const [leftGroup, leftLocation] = left.split(' · ')
        const [rightGroup, rightLocation] = right.split(' · ')
        const groupDifference = (groupOrder.indexOf(leftGroup) < 0 ? 99 : groupOrder.indexOf(leftGroup)) - (groupOrder.indexOf(rightGroup) < 0 ? 99 : groupOrder.indexOf(rightGroup))
        if (groupDifference) return groupDifference
        return (locationOrder.indexOf(leftLocation) < 0 ? 99 : locationOrder.indexOf(leftLocation)) - (locationOrder.indexOf(rightLocation) < 0 ? 99 : locationOrder.indexOf(rightLocation))
      })
      .map(([label, employees]) => ({
        label,
        employees: employees.sort((left, right) => customerName(left, text).localeCompare(customerName(right, text))),
      }))
  }, [employeeCopy.unassigned, employeeProfileById, filteredEmployeeProfileOptions, text])
  const selectedEmployeeOutsideFilters = Boolean(selectedEmployeeStaffProfile)
    && !filteredEmployeeProfileOptions.some((staffProfile) => staffProfile.id === selectedEmployeeStaffId)
  const firstFilteredEmployeeProfile = filteredEmployeeProfileOptions[0]
  useEffect(() => {
    if (selectedEmployeeOutsideFilters && firstFilteredEmployeeProfile) {
      editEmployeeProfile(firstFilteredEmployeeProfile)
    }
  }, [editEmployeeProfile, firstFilteredEmployeeProfile, selectedEmployeeOutsideFilters])
  const employeeDirectoryFiltersActive = employeeDirectoryGroup !== 'all'
    || employeeDirectoryLocation !== 'all'
    || employeeDirectoryStatus !== 'active'
  const updateEmployeeDirectoryFilters = ({
    group = employeeDirectoryGroup,
    location = employeeDirectoryLocation,
    status = employeeDirectoryStatus,
  }: {
    group?: string
    location?: string
    status?: EmployeeDirectoryStatus
  }) => {
    setEmployeeDirectoryGroup(group)
    setEmployeeDirectoryLocation(location)
    setEmployeeDirectoryStatus(status)

    const matchingProfiles = visibleAllStaffProfileOptions.filter((staffProfile) => (
      employeeMatchesDirectoryFilters(employeeProfileById.get(staffProfile.id), group, location, status, employeeCopy.unassigned)
    ))
    if (matchingProfiles.length > 0 && !matchingProfiles.some((staffProfile) => staffProfile.id === selectedEmployeeStaffId)) {
      editEmployeeProfile(matchingProfiles[0])
    }
  }
  const enabledEmploymentTypes = useMemo(() => {
    const activeTokens = new Set((hrOptionsByType.get('employment_type') || []).map((option) => String(option.name).toLowerCase().replace(/[-\s]+/g, '_')))
    const filtered = staffEmploymentTypes.filter((value: string) => activeTokens.has(value))
    return filtered.length > 0 ? filtered : staffEmploymentTypes
  }, [hrOptionsByType])
  const enabledContractStatuses = useMemo(() => {
    const activeTokens = new Set((hrOptionsByType.get('contract_status') || []).map((option) => String(option.name).toLowerCase().replace(/[-\s]+/g, '_')))
    const filtered = staffContractStatuses.filter((value: string) => activeTokens.has(value))
    return filtered.length > 0 ? filtered : staffContractStatuses
  }, [hrOptionsByType])

  const employeeKioskEligible = isStaffKioskEligibleDepartment(employeeForm.department)
  const visibleEmployeeSectionIds: EmployeeProfileSectionId[] = employeeKioskEligible
    ? ['identity', 'contract', 'payroll', 'bank', 'contact', 'store', 'documents']
    : ['identity', 'contract', 'payroll', 'bank', 'contact', 'documents']
  const allEmployeeSectionsOpen = visibleEmployeeSectionIds.every((section) => openEmployeeSections[section])
  const savedEmployeeEmail = String(employeeProfileById.get(selectedEmployeeStaffId)?.personal_email || '').trim()

  function toggleEmployeeSection(section: EmployeeProfileSectionId) {
    setOpenEmployeeSections((current) => ({ ...current, [section]: !current[section] }))
  }

  function toggleAllEmployeeSections() {
    const nextOpen = !allEmployeeSectionsOpen
    setOpenEmployeeSections({
      identity: nextOpen,
      contract: nextOpen,
      payroll: nextOpen,
      bank: nextOpen,
      contact: nextOpen,
      store: employeeKioskEligible ? nextOpen : false,
      documents: nextOpen,
    })
  }

  function selectHrSetupOption(optionType: StaffHrSetupOptionType, optionId: string) {
    const selectedOption = hrSetupOptions.find((option) => option.id === optionId)
    setSelectedHrSetupOptionIds((current) => ({ ...current, [optionType]: optionId }))
    setHrSetupForm((current) => ({
      ...current,
      [optionType]: selectedOption?.name || '',
    }))
  }

  function cancelHrSetupOptionEdit(optionType: StaffHrSetupOptionType) {
    setSelectedHrSetupOptionIds((current) => ({ ...current, [optionType]: '' }))
    setHrSetupForm((current) => ({ ...current, [optionType]: '' }))
  }

  async function modifyHrSetupOption(optionType: StaffHrSetupOptionType) {
    const optionId = selectedHrSetupOptionIds[optionType]
    if (!optionId) return
    const updated = await updateHrSetupOption(optionId, hrSetupForm[optionType])
    if (updated) cancelHrSetupOptionEdit(optionType)
  }

  async function submitNewEmployee() {
    if (createEmployeeSaving || !newEmployee.fullName.trim()) return
    setCreateEmployeeSaving(true)
    setCreateEmployeeStatus('')
    try {
      const result = await createEmployeeRecord(newEmployee)
      setCreateEmployeeStatusTone('success')
      setCreateEmployeeStatus(result?.warning || employeeCopy.created)
      setCreateEmployeeOpen(false)
      setNewEmployee({ email: '', employmentType: 'part_time', fullName: '', phone: '' })
      setOpenEmployeeSections((current) => ({ ...current, identity: true, contract: true, store: false }))
    } catch (error) {
      setCreateEmployeeStatusTone('error')
      setCreateEmployeeStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setCreateEmployeeSaving(false)
    }
  }

  const weekScheduleShifts = useMemo(() => (
    visibleScheduleAttendanceShifts.filter((shift) => (
      shift.shift_date >= attendanceWeekStart && shift.shift_date <= attendanceWeekEnd
    ))
  ), [attendanceWeekEnd, attendanceWeekStart, visibleScheduleAttendanceShifts])
  const scheduledEmployeeIds = useMemo(() => new Set(
    weekScheduleShifts
      .filter((shift) => shift.status !== 'cancelled')
      .map((shift) => shift.staff_profile_id),
  ), [weekScheduleShifts])
  const weekDraftCount = weekScheduleShifts.filter((shift) => shift.status === 'draft').length
  const scheduleGridStyle = useMemo(() => ({
    gridTemplateColumns: `minmax(168px, 0.85fr) repeat(${attendanceWeekDates.length}, minmax(92px, 1fr))`,
    minWidth: `${168 + attendanceWeekDates.length * 96}px`,
  }), [attendanceWeekDates.length])
  const scheduleShiftRows = useMemo(() => {
    const rowByTemplateId = new Map<string, { id: string; label: string; template: StaffShiftTemplate | null; shiftsByDate: Map<string, StaffScheduleShift[]>; subtitle: string }>()
    effectiveShiftTemplates.forEach((template) => {
      rowByTemplateId.set(template.id, {
        id: template.id,
        label: text.shiftTemplates[template.id],
        template,
        shiftsByDate: new Map<string, StaffScheduleShift[]>(),
        subtitle: `${normalizeTime(template.start_time)}–${normalizeTime(template.end_time)}`,
      })
    })

    const customRow = {
      id: 'custom',
      label: scheduleCopy.customShift,
      template: null,
      shiftsByDate: new Map<string, StaffScheduleShift[]>(),
      subtitle: scheduleCopy.customShiftHelp,
    }

    weekScheduleShifts.forEach((shift) => {
      const matchingTemplate = effectiveShiftTemplates.find((template) => (
        normalizeTime(template.start_time) === normalizeTime(shift.start_time)
        && normalizeTime(template.end_time) === normalizeTime(shift.end_time)
      ))
      const row = matchingTemplate ? rowByTemplateId.get(matchingTemplate.id) : customRow
      if (!row) return
      const shifts = row.shiftsByDate.get(shift.shift_date) || []
      shifts.push(shift)
      row.shiftsByDate.set(shift.shift_date, shifts)
    })

    rowByTemplateId.forEach((row) => {
      row.shiftsByDate.forEach((shifts) => shifts.sort((left, right) => {
        const leftProfile = profileById.get(left.staff_profile_id)
        const rightProfile = profileById.get(right.staff_profile_id)
        const leftName = leftProfile ? customerName(leftProfile, text) : text.customerFallback
        const rightName = rightProfile ? customerName(rightProfile, text) : text.customerFallback
        return leftName.localeCompare(rightName)
      }))
    })
    customRow.shiftsByDate.forEach((shifts) => shifts.sort((left, right) => (
      left.start_time.localeCompare(right.start_time)
    )))

    const rows = Array.from(rowByTemplateId.values())
    if (customRow.shiftsByDate.size > 0) rows.push(customRow)
    return rows
  }, [effectiveShiftTemplates, profileById, scheduleCopy.customShift, scheduleCopy.customShiftHelp, text, weekScheduleShifts])

  function prepareShiftEditor(template: StaffShiftTemplate | null, shiftDate: string) {
    if (!canManageAttendance || !template) return
    applyShiftTemplate(template.id)
    setShiftForm((current) => ({
      ...current,
      staff_profile_id: current.staff_profile_id || firstScheduleStaffProfileId,
      shift_date: shiftDate,
      start_time: normalizeTime(template.start_time),
      end_time: normalizeTime(template.end_time),
      break_minutes: String(template.break_minutes || 0),
      status: 'draft',
    }))
    window.requestAnimationFrame(() => {
      document.getElementById('staff-hr-shift-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const activeEmployeeCount = visibleAllStaffProfileOptions.filter((staffProfile) => (
    employeeProfileById.get(staffProfile.id)?.active !== false
  )).length
  const missingEmployeeDocumentCount = visibleAllStaffProfileOptions.filter((staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    return !employee?.profile_photo_path || !employee?.cv_document_path
  }).length
  const pendingAdjustmentCount = periodHrAdjustments.filter((item) => normalizeHrAdjustmentStatus(item.status) === 'pending').length
  const periodAdvanceCount = periodHrAdjustments.filter((item) => ['advance', 'debt', 'debt_repayment'].includes(normalizeHrAdjustmentType(item.adjustment_type))).length
  const visibleHrTabs = accessibleStaffHrTabs(staffHrTabs, { canAccessHrSettings, canAccessZaloSettings })
  const periodAttendanceLogs = attendanceLogs.filter((log) => log.work_date >= payrollPeriodStart && log.work_date <= payrollPeriodEnd)
  const pendingAttendanceCount = periodAttendanceLogs.filter((log) => log.approval_status !== 'approved').length
  const timesheetProfiles = visibleStaffProfileOptions.filter((staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    const query = timesheetSearch.trim().toLowerCase()
    if (!query) return true
    return [customerName(staffProfile, text), employee?.employee_code, employee?.attendance_number]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
  const scheduledEmployeeCount = new Set(visibleScheduleAttendanceShifts.filter((shift) => shift.status === 'published').map((shift) => shift.staff_profile_id)).size
  const salaryConfiguredCount = visibleAllStaffProfileOptions.filter((staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    return Number(employee?.base_salary_vnd) > 0 || Number(employee?.hourly_rate_vnd) > 0
  }).length
  const incompleteEmployeeCount = visibleStaffProfileOptions.filter((staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    return !employee?.employee_code
      || !employee?.legal_name
      || (!Number(employee?.base_salary_vnd) && !Number(employee?.hourly_rate_vnd))
      || !employee?.start_date
  }).length
  const missingBankCount = visibleStaffProfileOptions.filter((staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    return !employee?.bank_name || !employee?.bank_account_number
  }).length
  const accountantIssueCount = incompleteEmployeeCount + pendingAttendanceCount + missingBankCount
  const payslipDepartments = useMemo(() => Array.from(new Set<string>(
    visibleStaffProfileOptions
      .map((staffProfile) => (employeeProfileById.get(staffProfile.id)?.department || '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right)), [employeeProfileById, visibleStaffProfileOptions])
  const payslipLocations = useMemo(() => Array.from(new Set<string>(
    visibleStaffProfileOptions
      .map((staffProfile) => (employeeProfileById.get(staffProfile.id)?.main_work_location || '').trim())
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right)), [employeeProfileById, visibleStaffProfileOptions])
  const filteredPayslipProfiles = useMemo(() => visibleStaffProfileOptions.filter((staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    if (payslipDepartmentFilter !== 'all' && (employee?.department || '').trim() !== payslipDepartmentFilter) return false
    if (payslipLocationFilter !== 'all' && (employee?.main_work_location || '').trim() !== payslipLocationFilter) return false
    return true
  }), [employeeProfileById, payslipDepartmentFilter, payslipLocationFilter, visibleStaffProfileOptions])
  const effectivePayslipEmployeeId = filteredPayslipProfiles.some((staffProfile) => staffProfile.id === payslipSelectedEmployeeId)
    ? payslipSelectedEmployeeId
    : filteredPayslipProfiles[0]?.id || ''
  const payslipEmployeeProfile = filteredPayslipProfiles.find((staffProfile) => staffProfile.id === effectivePayslipEmployeeId) || null
  const payslipEmployee = payslipEmployeeProfile ? employeeProfileById.get(payslipEmployeeProfile.id) : null
  const payslipEmployeeSummary = effectivePayslipEmployeeId
    ? staffPayrollCalculations.get(effectivePayslipEmployeeId) || emptyStaffPayrollCalculation(effectivePayslipEmployeeId)
    : emptyStaffPayrollCalculation('')
  const payslipEmployeeName = payslipEmployee?.legal_name
    || (payslipEmployeeProfile ? customerName(payslipEmployeeProfile, text) : text.customerFallback)
  const settingsSections: Array<{ id: HrSettingsSection; icon: typeof ListChecks }> = [
    { id: 'initialization', icon: ListChecks },
    { id: 'clocking', icon: TimerReset },
    { id: 'salary', icon: Landmark },
    { id: 'work_rest', icon: CalendarDays },
    { id: 'categories', icon: Coins },
    { id: 'organization', icon: Settings2 },
  ]
  const initializationRows = [
    { id: 'employees', complete: activeEmployeeCount > 0, meta: `${activeEmployeeCount}/${visibleAllStaffProfileOptions.length}`, open: () => setHrTab('employees') },
    { id: 'shifts', complete: effectiveShiftTemplates.length > 0, meta: String(effectiveShiftTemplates.length), open: () => setHrTab('schedule') },
    { id: 'schedule', complete: scheduledEmployeeCount > 0, meta: `${scheduledEmployeeCount}/${activeEmployeeCount}`, open: () => setHrTab('schedule') },
    { id: 'attendance', complete: Boolean(attendanceSettings.location), meta: attendanceSettings.location || '—', open: () => setSettingsSection('clocking') },
    { id: 'salary', complete: salaryConfiguredCount > 0, meta: `${salaryConfiguredCount}/${activeEmployeeCount}`, open: () => setSettingsSection('salary') },
    { id: 'payroll', complete: payrollRuns.length > 0, meta: String(payrollRuns.length), open: () => setHrTab('payroll') },
  ] as const

  const hrModuleMeta = (tab: string) => {
    if (tab === 'employees') return `${activeEmployeeCount}/${visibleAllStaffProfileOptions.length} ${text.labels.activeEmployee}`
    if (tab === 'schedule') return `${visibleScheduleAttendanceShifts.length} ${text.labels.shiftRole}`
    if (tab === 'timesheet') return `${visibleStaffProfileOptions.length} ${text.hrTabs.employees}`
    if (tab === 'payroll') return `${payrollRuns.length} ${text.labels.payrollRun}`
    if (tab === 'adjustments') return `${pendingAdjustmentCount} ${text.adjustmentStatuses.pending}`
    if (tab === 'advances') return `${periodAdvanceCount} ${text.hrTabs.advances}`
    if (tab === 'zalo') return 'Mini App'
    return `${staffHrSetupOptionTypes.length} ${text.labels.rule}`
  }

  return (
    <div className="staff-hr-console">
      {visibleAllStaffProfileOptions.length === 0 ? (
        <p className="notice">{text.messages.noStaffProfiles}</p>
      ) : (
        <>
          <nav className="staff-hr-module-rail staff-hr-top-navigation" aria-label={text.tabs.hr}>
            {visibleHrTabs.map((tab) => (
              <button aria-current={hrTab === tab ? 'page' : undefined} className={hrTab === tab ? 'active' : ''} key={tab} type="button" onClick={() => setHrTab(tab)}>
                <span className="staff-hr-module-icon">{hrModuleIcon(tab)}</span>
                <span>
                  <strong>{text.hrTabs[tab]}</strong>
                  <small>{hrModuleMeta(tab)}</small>
                </span>
              </button>
            ))}
          </nav>
          {isOwnerOrAdmin && (
            <div className="staff-hr-summary staff-hr-metrics">
              <div><span>{text.hrTabs.employees}</span><strong>{visibleAllStaffProfileOptions.length}</strong><small>{activeEmployeeCount} {text.labels.activeEmployee} · {missingEmployeeDocumentCount} {text.labels.missingDocuments}</small></div>
              <div><span>{text.labels.totalGross}</span><strong>{formatVndCompact(hrPayrollTotals.gross)}</strong></div>
              <div><span>{text.labels.totalNet}</span><strong>{formatVndCompact(hrPayrollTotals.net)}</strong></div>
              <div><span>{text.labels.totalCompanyCost}</span><strong>{formatVndCompact(hrPayrollTotals.companyCost)}</strong></div>
              <div><span>{text.labels.restWarnings}</span><strong>{hrPayrollTotals.restWarnings}</strong></div>
              <div><span>{text.labels.outstandingDebt}</span><strong>{formatVndCompact(Math.max(0, selectedEmployeeOutstandingDebt))}</strong></div>
            </div>
          )}
          <div className="staff-hr-main staff-hr-main-full">
            <div className="staff-hr-content">

              {hrTab === 'employees' && (<EmployeesSection
                employeeCopy={employeeCopy}
                toggleAllEmployeeSections={toggleAllEmployeeSections}
                allEmployeeSectionsOpen={allEmployeeSectionsOpen}
                isOwnerOrAdmin={isOwnerOrAdmin}
                setCreateEmployeeStatus={setCreateEmployeeStatus}
                setCreateEmployeeStatusTone={setCreateEmployeeStatusTone}
                setCreateEmployeeOpen={setCreateEmployeeOpen}
                createEmployeeStatus={createEmployeeStatus}
                createEmployeeStatusTone={createEmployeeStatusTone}
                createEmployeeOpen={createEmployeeOpen}
                text={text}
                newEmployee={newEmployee}
                setNewEmployee={setNewEmployee}
                sharedText={sharedText}
                createEmployeeSaving={createEmployeeSaving}
                submitNewEmployee={submitNewEmployee}
                filteredEmployeeProfileOptions={filteredEmployeeProfileOptions}
                selectedEmployeeOutsideFilters={selectedEmployeeOutsideFilters}
                selectedEmployeeStaffId={selectedEmployeeStaffId}
                editEmployeeProfile={editEmployeeProfile}
                groupedEmployeeOptions={groupedEmployeeOptions}
                employeeProfileById={employeeProfileById}
                employeeDirectoryGroup={employeeDirectoryGroup}
                updateEmployeeDirectoryFilters={updateEmployeeDirectoryFilters}
                employeeDirectoryGroups={employeeDirectoryGroups}
                employeeDirectoryLocation={employeeDirectoryLocation}
                employeeDirectoryLocations={employeeDirectoryLocations}
                employeeDirectoryStatus={employeeDirectoryStatus}
                employeeDirectoryCounts={employeeDirectoryCounts}
                visibleAllStaffProfileOptions={visibleAllStaffProfileOptions}
                employeeDirectoryFiltersActive={employeeDirectoryFiltersActive}
                canEditEmployeeProfiles={canEditEmployeeProfiles}
                selectedEmployeeStaffProfile={selectedEmployeeStaffProfile}
                hrDocumentUploading={hrDocumentUploading}
                handleHrDocumentUpload={handleHrDocumentUpload}
                saving={saving}
                saveEmployeeProfile={saveEmployeeProfile}
                employeePayrollSummary={employeePayrollSummary}
                hrJobTitleOptions={hrJobTitleOptions}
                toggleEmployeeSection={toggleEmployeeSection}
                openEmployeeSections={openEmployeeSections}
                employeeForm={employeeForm}
                setEmployeeForm={setEmployeeForm}
                hrDepartmentOptions={hrDepartmentOptions}
                hrLocationOptions={hrLocationOptions}
                enabledEmploymentTypes={enabledEmploymentTypes}
                enabledContractStatuses={enabledContractStatuses}
                hrContractTypeOptions={hrContractTypeOptions}
                costAssignments={costAssignments}
                resolvedLanguage={resolvedLanguage}
                reloadCostAssignments={reloadCostAssignments}
                hrSettings={hrSettings}
                canRevealEmployeeKioskPin={canRevealEmployeeKioskPin}
                employeeKioskEligible={employeeKioskEligible}
                canManageEmployeeKioskPins={canManageEmployeeKioskPins}
                employeeKioskAccessRole={employeeKioskAccessRole}
                setEmployeeKioskAccessRole={setEmployeeKioskAccessRole}
                employeeKioskPinLoading={employeeKioskPinLoading}
                employeeKioskPinVisibleValue={employeeKioskPinVisibleValue}
                savedEmployeeEmail={savedEmployeeEmail}
                employeeKioskPinEmailState={employeeKioskPinEmailState}
                employeeKioskPinEmailRecipient={employeeKioskPinEmailRecipient}
                sendEmployeeKioskPinEmail={sendEmployeeKioskPinEmail}
                generateEmployeeKioskPin={generateEmployeeKioskPin}
                employeeKioskPin={employeeKioskPin}
                setEmployeeKioskPin={setEmployeeKioskPin}
                employeeKioskPinConfirm={employeeKioskPinConfirm}
                setEmployeeKioskPinConfirm={setEmployeeKioskPinConfirm}
                employeeKioskPinSaveConfirmation={employeeKioskPinSaveConfirmation}
                configureEmployeeKioskPin={configureEmployeeKioskPin}
                selectedEmployeeDocuments={selectedEmployeeDocuments}
              />)}

              {hrTab === 'schedule' && (<ScheduleSection
                text={text}
                shiftAttendanceRange={shiftAttendanceRange}
                attendanceWeekDates={attendanceWeekDates}
                scheduleCopy={scheduleCopy}
                attendanceWeekStart={attendanceWeekStart}
                attendanceWeekEnd={attendanceWeekEnd}
                resetAttendanceRangeToThisWeek={resetAttendanceRangeToThisWeek}
                setAttendanceRange={setAttendanceRange}
                scheduleViewMode={scheduleViewMode}
                weekScheduleShifts={weekScheduleShifts}
                scheduledEmployeeIds={scheduledEmployeeIds}
                visibleScheduleStaffProfileOptions={visibleScheduleStaffProfileOptions}
                weekDraftCount={weekDraftCount}
                setScheduleViewMode={setScheduleViewMode}
                attendanceScheduleScopeOptions={attendanceScheduleScopeOptions}
                effectiveAttendanceScheduleScope={effectiveAttendanceScheduleScope}
                setAttendanceScheduleScope={setAttendanceScheduleScope}
                selectedShiftTemplate={selectedShiftTemplate}
                applyShiftTemplate={applyShiftTemplate}
                canManageAttendance={canManageAttendance}
                effectiveShiftTemplates={effectiveShiftTemplates}
                copyPreviousAttendanceWeek={copyPreviousAttendanceWeek}
                saving={saving}
                publishAttendanceWeek={publishAttendanceWeek}
                draftShiftCount={draftShiftCount}
                scheduleGridStyle={scheduleGridStyle}
                employeeProfileById={employeeProfileById}
                attendanceShiftsByCell={attendanceShiftsByCell}
                visibleScheduleAttendanceShifts={visibleScheduleAttendanceShifts}
                draggingShiftId={draggingShiftId}
                moveShiftToCell={moveShiftToCell}
                setDraggingShiftId={setDraggingShiftId}
                startShiftForCell={startShiftForCell}
                shiftWarningsById={shiftWarningsById}
                editShift={editShift}
                scheduleShiftRows={scheduleShiftRows}
                prepareShiftEditor={prepareShiftEditor}
                profileById={profileById}
                staffPayrollCalculations={staffPayrollCalculations}
                updateShiftStatus={updateShiftStatus}
                shiftForm={shiftForm}
                firstScheduleStaffProfileId={firstScheduleStaffProfileId}
                setShiftForm={setShiftForm}
                hrLocationOptions={hrLocationOptions}
                saveShift={saveShift}
              />)}

              {hrTab === 'timesheet' && (<TimesheetSection
                text={text}
                payrollPeriodEnd={payrollPeriodEnd}
                updatePayrollPeriodEnd={updatePayrollPeriodEnd}
                updatePayrollPeriodStart={updatePayrollPeriodStart}
                payrollPeriodStart={payrollPeriodStart}
                completionText={completionText}
                timesheetSearch={timesheetSearch}
                setTimesheetSearch={setTimesheetSearch}
                isOwnerOrAdmin={isOwnerOrAdmin}
                saving={saving}
                periodAttendanceLogs={periodAttendanceLogs}
                pendingAttendanceCount={pendingAttendanceCount}
                approveAttendancePeriod={approveAttendancePeriod}
                timesheetProfiles={timesheetProfiles}
                staffPayrollCalculations={staffPayrollCalculations}
                employeeProfileById={employeeProfileById}
                leaveRequests={leaveRequests}
              />)}

              {hrTab === 'payroll' && (<PayrollSection
                accountantCopy={accountantCopy}
                payrollPeriodEnd={payrollPeriodEnd}
                text={text}
                updatePayrollPeriodEnd={updatePayrollPeriodEnd}
                updatePayrollPeriodStart={updatePayrollPeriodStart}
                payrollPeriodStart={payrollPeriodStart}
                accountantDownloadPending={accountantDownloadPending}
                saving={saving}
                startAccountantDownload={startAccountantDownload}
                incompleteEmployeeCount={incompleteEmployeeCount}
                setHrTab={setHrTab}
                pendingAttendanceCount={pendingAttendanceCount}
                missingBankCount={missingBankCount}
                accountantIssueCount={accountantIssueCount}
                costReportRows={costReportRows}
                resolvedLanguage={resolvedLanguage}
                canManageAttendance={canManageAttendance}
                payrollRunForm={payrollRunForm}
                setPayrollRunForm={setPayrollRunForm}
                hrPayrollTotals={hrPayrollTotals}
                generatePayrollRun={generatePayrollRun}
                downloadPayrollExcel={downloadPayrollExcel}
                filteredPayslipProfiles={filteredPayslipProfiles}
                payslipCopy={payslipCopy}
                payslipDepartmentFilter={payslipDepartmentFilter}
                setPayslipDepartmentFilter={setPayslipDepartmentFilter}
                payslipDepartments={payslipDepartments}
                payslipLocationFilter={payslipLocationFilter}
                setPayslipLocationFilter={setPayslipLocationFilter}
                payslipLocations={payslipLocations}
                effectivePayslipEmployeeId={effectivePayslipEmployeeId}
                setPayslipSelectedEmployeeId={setPayslipSelectedEmployeeId}
                employeeProfileById={employeeProfileById}
                payslipEmployeeProfile={payslipEmployeeProfile}
                payslipEmployeeName={payslipEmployeeName}
                payslipEmployee={payslipEmployee}
                payslipEmployeeSummary={payslipEmployeeSummary}
                downloadEmployeePayslip={downloadEmployeePayslip}
                payrollRuns={payrollRuns}
                payrollItems={payrollItems}
                approvePayrollRun={approvePayrollRun}
              />)}

              {(hrTab === 'adjustments' || hrTab === 'advances') && (<AdjustmentsSection
                canManageAttendance={canManageAttendance}
                hrTab={hrTab}
                text={text}
                hrAdjustmentForm={hrAdjustmentForm}
                selectedEmployeeStaffId={selectedEmployeeStaffId}
                firstEmployeeStaffProfileId={firstEmployeeStaffProfileId}
                setHrAdjustmentForm={setHrAdjustmentForm}
                visibleAllStaffProfileOptions={visibleAllStaffProfileOptions}
                saving={saving}
                saveHrAdjustment={saveHrAdjustment}
                periodHrAdjustments={periodHrAdjustments}
                profileById={profileById}
                updateHrAdjustmentStatus={updateHrAdjustmentStatus}
              />)}

              {hrTab === 'zalo' && canAccessZaloSettings && (
                <StaffZaloMiniAppSettings language={resolvedLanguage} onStatus={setStatus} />
              )}

              {hrTab === 'settings' && canAccessHrSettings && (<SettingsSection
                completionText={completionText}
                text={text}
                settingsSections={settingsSections}
                settingsSection={settingsSection}
                setSettingsSection={setSettingsSection}
                initializationRows={initializationRows}
                canManageAttendance={canManageAttendance}
                setHrTab={setHrTab}
                effectiveShiftTemplates={effectiveShiftTemplates}
                attendanceSettings={attendanceSettings}
                setAttendanceSettings={setAttendanceSettings}
                saving={saving}
                saveAttendanceSettings={saveAttendanceSettings}
                hrSettings={hrSettings}
                setHrSettings={setHrSettings}
                hrOptionsByType={hrOptionsByType}
                resolvedLanguage={resolvedLanguage}
                syncPayrollDraft={syncPayrollDraft}
                saveHrSettings={saveHrSettings}
                hrSetupOptions={hrSetupOptions}
                selectedHrSetupOptionIds={selectedHrSetupOptionIds}
                selectHrSetupOption={selectHrSetupOption}
                hrSetupForm={hrSetupForm}
                setHrSetupForm={setHrSetupForm}
                modifyHrSetupOption={modifyHrSetupOption}
                saveHrSetupOption={saveHrSetupOption}
                cancelHrSetupOptionEdit={cancelHrSetupOptionEdit}
                setHrSetupOptionActive={setHrSetupOptionActive}
              />)}
            </div>
          </div>
        </>
      )}
    </div>

  )
}
