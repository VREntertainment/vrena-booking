'use client'

/* eslint-disable @typescript-eslint/no-explicit-any -- This lazy view receives StaffConsole's private HR model without exporting the whole console type graph. */
import { Ban, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheckBig, Clock3, Coins, Copy, Download, FileCheck2, FileSpreadsheet, FileText, Landmark, ListChecks, Pencil, Plus, ReceiptText, RefreshCw, Save, Search, Send, Settings2, Smartphone, TimerReset, UserRound, WalletCards, X } from 'lucide-react'
import { Fragment, useState } from 'react'
import { PhoneNumberInput } from './CountryCodePicker'
import StaffZaloMiniAppSettings from './StaffZaloMiniAppSettings'

type StaffContractStatus = string
type StaffHrHubProps = {
  model: any
}

type HrSettingsSection = 'initialization' | 'clocking' | 'salary' | 'work_rest' | 'categories' | 'organization'

const hrCompletionCopy = {
  en: {
    settingsTitle: 'Employee settings',
    settingsIntro: 'Configure attendance, work rules, and salary processing from one place.',
    sections: {
      initialization: 'Initialization',
      clocking: 'Clocking',
      salary: 'Salary settings',
      work_rest: 'Work & rest day',
      categories: 'Salary categories',
      organization: 'Organization',
    } satisfies Record<HrSettingsSection, string>,
    quickSetup: 'Quick setup',
    quickSetupHelp: 'Complete the essential steps to start using HR attendance and payroll.',
    setupRows: {
      employees: ['Create employees', 'Employee profiles are ready'],
      shifts: ['Create shifts', 'Standard shifts are available'],
      schedule: ['Schedule work', 'Employees have published shifts'],
      attendance: ['Timekeeping form', 'Attendance rules are configured'],
      salary: ['Salary configuration', 'Employees have salary or hourly rates'],
      payroll: ['Paysheet setting', 'At least one payroll run exists'],
    },
    open: 'Open',
    attendanceSetup: 'Attendance setup',
    shiftSetup: 'Shift setup',
    shiftSetupHelp: 'Manage the shifts used for attendance calculations.',
    standardDay: 'Number of hours in a standard workday',
    standardDayHelp: 'Used when no published shift is assigned.',
    halfDay: 'Count as half workday when worked time is',
    from: 'From',
    to: 'To',
    countHalfDayLate: 'Record late arrival and early leave for half days',
    lateEarly: 'Late arrival & early leave',
    lateAfter: 'Late arrival after',
    earlyBefore: 'Early leave before',
    overtime: 'Overtime settings',
    overtimeBefore: 'Overtime worked before shift',
    overtimeAfter: 'Overtime worked after shift',
    consecutive: 'Use one clock-in and clock-out for consecutive shifts',
    minutes: 'minutes',
    salaryTitle: 'Salary settings',
    payday: 'Payday',
    paydayHelp: 'Select the start day of each monthly pay period.',
    day: 'Day',
    autoCreate: 'Automatically create payroll drafts',
    autoCreateHelp: 'Supabase Cron creates the current pay-period draft every day when enabled.',
    autoUpdate: 'Automatically update payroll drafts daily',
    autoUpdateHelp: 'Attendance, leave, bonuses, allowances, deductions, tax, and insurance are recalculated daily.',
    tax: 'Personal income tax for employees',
    taxHelp: 'Apply the configured personal-income-tax withholding rate.',
    insurance: 'Social insurance for employees',
    insuranceHelp: 'Apply employee and employer contribution rates.',
    syncNow: 'Synchronize payroll now',
    lastSync: 'Last automatic sync',
    never: 'Not yet synchronized',
    workRestTitle: 'Work & rest day settings',
    weekStarts: 'Work week starts on',
    restDays: 'Weekly rest days',
    standardWeek: 'Standard workweek hours',
    standardBreak: 'Standard break',
    annualLeave: 'Annual leave days',
    monthlyDays: 'Standard monthly days',
    monthlyHours: 'Standard monthly hours',
    minimumRest: 'Minimum rest between shifts',
    overtimeMonth: 'Monthly overtime cap',
    overtimeYear: 'Yearly overtime cap',
    categoriesTitle: 'Payroll templates and categories',
    categoriesHelp: 'Create reusable names for payroll templates, allowances, and deductions.',
    organizationTitle: 'Organization options',
    organizationHelp: 'Maintain locations, departments, roles, and employment classifications.',
    add: 'Add',
    noOptions: 'No options yet',
    approveAttendance: 'Approve attendance',
    approved: 'Approved',
    pending: 'Pending',
    searchEmployees: 'Search employees',
    payType: 'Type of pay',
    byMonth: 'Monthly salary',
    byHour: 'By hour',
    present: 'Present',
    onLeave: 'On leave',
    lateArrival: 'Late arrival',
    earlyLeave: 'Early leave',
    shifts: 'shifts',
    occurrences: 'times',
    noAttendance: 'No attendance records in this period.',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  vi: {
    settingsTitle: 'Thiết lập nhân viên',
    settingsIntro: 'Quản lý chấm công, quy tắc làm việc và xử lý lương tại một nơi.',
    sections: {
      initialization: 'Khởi tạo',
      clocking: 'Chấm công',
      salary: 'Thiết lập lương',
      work_rest: 'Ngày làm & nghỉ',
      categories: 'Nhóm lương',
      organization: 'Tổ chức',
    } satisfies Record<HrSettingsSection, string>,
    quickSetup: 'Thiết lập nhanh',
    quickSetupHelp: 'Hoàn thành các bước cần thiết để sử dụng chấm công và bảng lương.',
    setupRows: {
      employees: ['Tạo nhân viên', 'Hồ sơ nhân viên đã sẵn sàng'],
      shifts: ['Tạo ca', 'Đã có ca làm việc chuẩn'],
      schedule: ['Xếp lịch làm việc', 'Nhân viên có ca đã xuất bản'],
      attendance: ['Hình thức chấm công', 'Đã cấu hình quy tắc chấm công'],
      salary: ['Cấu hình lương', 'Nhân viên có lương tháng hoặc lương giờ'],
      payroll: ['Thiết lập bảng lương', 'Đã có ít nhất một bảng lương'],
    },
    open: 'Mở',
    attendanceSetup: 'Thiết lập chấm công',
    shiftSetup: 'Thiết lập ca',
    shiftSetupHelp: 'Quản lý các ca dùng để tính chấm công.',
    standardDay: 'Số giờ trong một ngày làm việc chuẩn',
    standardDayHelp: 'Được dùng khi chưa có ca đã xuất bản.',
    halfDay: 'Tính nửa ngày công khi thời gian làm việc từ',
    from: 'Từ',
    to: 'Đến',
    countHalfDayLate: 'Ghi nhận đi trễ và về sớm trong nửa ngày',
    lateEarly: 'Đi trễ & về sớm',
    lateAfter: 'Đi trễ sau',
    earlyBefore: 'Về sớm trước',
    overtime: 'Thiết lập tăng ca',
    overtimeBefore: 'Tăng ca trước ca',
    overtimeAfter: 'Tăng ca sau ca',
    consecutive: 'Dùng một lần chấm vào và ra cho các ca liên tiếp',
    minutes: 'phút',
    salaryTitle: 'Thiết lập lương',
    payday: 'Ngày bắt đầu kỳ lương',
    paydayHelp: 'Chọn ngày bắt đầu mỗi kỳ lương tháng.',
    day: 'Ngày',
    autoCreate: 'Tự động tạo bảng lương nháp',
    autoCreateHelp: 'Supabase Cron tạo bản nháp kỳ lương hiện tại mỗi ngày khi được bật.',
    autoUpdate: 'Tự động cập nhật bảng lương mỗi ngày',
    autoUpdateHelp: 'Chấm công, nghỉ phép, thưởng, phụ cấp, khấu trừ, thuế và bảo hiểm được tính lại mỗi ngày.',
    tax: 'Thuế thu nhập cá nhân',
    taxHelp: 'Áp dụng tỷ lệ khấu trừ thuế thu nhập cá nhân đã cấu hình.',
    insurance: 'Bảo hiểm xã hội',
    insuranceHelp: 'Áp dụng tỷ lệ đóng của nhân viên và công ty.',
    syncNow: 'Đồng bộ bảng lương ngay',
    lastSync: 'Lần đồng bộ tự động gần nhất',
    never: 'Chưa đồng bộ',
    workRestTitle: 'Thiết lập ngày làm & nghỉ',
    weekStarts: 'Tuần làm việc bắt đầu vào',
    restDays: 'Ngày nghỉ hàng tuần',
    standardWeek: 'Số giờ làm việc chuẩn mỗi tuần',
    standardBreak: 'Thời gian nghỉ chuẩn',
    annualLeave: 'Số ngày phép năm',
    monthlyDays: 'Số ngày chuẩn mỗi tháng',
    monthlyHours: 'Số giờ chuẩn mỗi tháng',
    minimumRest: 'Thời gian nghỉ tối thiểu giữa các ca',
    overtimeMonth: 'Giới hạn tăng ca tháng',
    overtimeYear: 'Giới hạn tăng ca năm',
    categoriesTitle: 'Mẫu và nhóm bảng lương',
    categoriesHelp: 'Tạo tên dùng lại cho mẫu bảng lương, phụ cấp và khấu trừ.',
    organizationTitle: 'Tùy chọn tổ chức',
    organizationHelp: 'Quản lý cơ sở, bộ phận, chức danh và loại việc làm.',
    add: 'Thêm',
    noOptions: 'Chưa có tùy chọn',
    approveAttendance: 'Duyệt chấm công',
    approved: 'Đã duyệt',
    pending: 'Chờ duyệt',
    searchEmployees: 'Tìm nhân viên',
    payType: 'Hình thức lương',
    byMonth: 'Lương tháng',
    byHour: 'Theo giờ',
    present: 'Có mặt',
    onLeave: 'Nghỉ phép',
    lateArrival: 'Đi trễ',
    earlyLeave: 'Về sớm',
    shifts: 'ca',
    occurrences: 'lần',
    noAttendance: 'Không có dữ liệu chấm công trong kỳ này.',
    days: ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
  },
} as const

function hrModuleIcon(tab: string) {
  if (tab === 'employees') return <UserRound aria-hidden="true" size={18} />
  if (tab === 'schedule') return <CalendarDays aria-hidden="true" size={18} />
  if (tab === 'timesheet') return <Clock3 aria-hidden="true" size={18} />
  if (tab === 'payroll') return <ReceiptText aria-hidden="true" size={18} />
  if (tab === 'adjustments') return <Coins aria-hidden="true" size={18} />
  if (tab === 'advances') return <WalletCards aria-hidden="true" size={18} />
  if (tab === 'zalo') return <Smartphone aria-hidden="true" size={18} />
  return <Settings2 aria-hidden="true" size={18} />
}

export default function StaffHrHub({ model }: StaffHrHubProps) {
  const {
    ButtonIconText,
    StaffPickerField,
    StaffRoleAvatar,
    approveAttendancePeriod,
    approvePayrollRun,
    applyShiftTemplate,
    attendanceGridStyle,
    attendanceLogs,
    attendanceScheduleScopeOptions,
    attendanceSettings,
    attendanceShiftsByCell,
    attendanceWeekEnd,
    attendanceWeekDates,
    attendanceWeekStart,
    canEditEmployeeProfiles,
    canManageAttendance,
    customerName,
    dateFromInput,
    dongDigits,
    downloadEmployeePayslip,
    draggingShiftId,
    draftShiftCount,
    effectiveAttendanceScheduleScope,
    effectiveShiftTemplates,
    editEmployeeProfile,
    editShift,
    employeeForm,
    employeeFormForProfile,
    employeePayrollSummary,
    employeeProfileById,
    employeeUsesMonthlyGross,
    emptyStaffPayrollCalculation,
    filteredHrStaffProfiles,
    firstEmployeeStaffProfileId,
    firstScheduleStaffProfileId,
    formatDongInput,
    formatVnd,
    formatVndCompact,
    generatePayrollRun,
    handleHrDocumentUpload,
    hoursLabel,
    hrAdjustmentForm,
    hrContractTypeOptions,
    hrDepartmentFilter,
    hrDepartmentOptions,
    hrDocumentUploading,
    hrJobTitleOptions,
    hrLocationOptions,
    hrOptionsByType,
    hrPayrollTotals,
    hrSearch,
    hrSettings,
    hrSetupForm,
    hrStatusFilter,
    hrTab,
    isOwnerOrAdmin,
    leaveRequests,
    normalizeHrAdjustmentStatus,
    normalizeHrAdjustmentType,
    normalizePayrollPayCycle,
    normalizePayrollStatus,
    normalizeStaffContractStatus,
    normalizeStaffEmploymentType,
    normalizeTime,
    parseDong,
    payrollItems,
    payrollPeriodEnd,
    payrollPeriodStart,
    payrollRunForm,
    payrollRuns,
    periodHrAdjustments,
    profileById,
    rangeLabel,
    resolvedLanguage,
    roleLabel,
    saveEmployeeProfile,
    saveHrAdjustment,
    saveHrSettings,
    saveHrSetupOption,
    saveAttendanceSettings,
    saveShift,
    saving,
    selectedEmployeeDocuments,
    selectedEmployeeOutstandingDebt,
    selectedEmployeeStaffId,
    selectedEmployeeStaffProfile,
    selectedShiftTemplate,
    setAttendanceScheduleScope,
    setAttendanceSettings,
    setDraggingShiftId,
    setAttendanceRange,
    setEmployeeForm,
    setHrAdjustmentForm,
    setHrDepartmentFilter,
    setHrSearch,
    setHrSettings,
    setHrSetupForm,
    setHrStatusFilter,
    setHrTab,
    setStatus,
    setPayrollRunForm,
    setShiftForm,
    sharedText,
    shiftForm,
    shortDateLabel,
    shiftAttendanceRange,
    shiftWarningsById,
    staffContractStatuses,
    staffCvTypes,
    staffDateLabel,
    staffEmploymentTypes,
    staffGenderOptions,
    staffHrAdjustmentStatuses,
    staffHrAdjustmentTypes,
    staffHrSetupOptionTypes,
    staffHrTabs,
    staffPayrollCalculations,
    staffPayrollPayCycles,
    staffProfilePhotoTypes,
    staffShiftStatuses,
    staffRoleName,
    startShiftForCell,
    syncPayrollDraft,
    text,
    resetAttendanceRangeToThisWeek,
    updateHrAdjustmentStatus,
    updateShiftStatus,
    visibleAllStaffProfileOptions,
    visibleScheduleAttendanceShifts,
    visibleScheduleStaffProfileOptions,
    visibleStaffProfileOptions,
    copyPreviousAttendanceWeek,
    moveShiftToCell,
    publishAttendanceWeek,
  } = model

  const completionText = hrCompletionCopy[resolvedLanguage === 'vi' ? 'vi' : 'en']
  const [settingsSection, setSettingsSection] = useState<HrSettingsSection>('initialization')
  const [timesheetSearch, setTimesheetSearch] = useState('')

  const activeEmployeeCount = visibleAllStaffProfileOptions.filter((staffProfile: any) => (
    employeeProfileById.get(staffProfile.id)?.active !== false
  )).length
  const missingEmployeeDocumentCount = visibleAllStaffProfileOptions.filter((staffProfile: any) => {
    const employee = employeeProfileById.get(staffProfile.id)
    return !employee?.profile_photo_path || !employee?.cv_document_path
  }).length
  const pendingAdjustmentCount = periodHrAdjustments.filter((item: any) => normalizeHrAdjustmentStatus(item.status) === 'pending').length
  const periodAdvanceCount = periodHrAdjustments.filter((item: any) => ['advance', 'debt', 'debt_repayment'].includes(normalizeHrAdjustmentType(item.adjustment_type))).length
  const selectedEmployeeLabel = selectedEmployeeStaffProfile ? customerName(selectedEmployeeStaffProfile, text) : text.customerFallback
  const visibleHrTabs = isOwnerOrAdmin ? staffHrTabs : staffHrTabs.filter((tab: string) => tab !== 'zalo')
  const periodAttendanceLogs = attendanceLogs.filter((log: any) => log.work_date >= payrollPeriodStart && log.work_date <= payrollPeriodEnd)
  const pendingAttendanceCount = periodAttendanceLogs.filter((log: any) => log.approval_status !== 'approved').length
  const timesheetProfiles = visibleStaffProfileOptions.filter((staffProfile: any) => {
    const employee = employeeProfileById.get(staffProfile.id)
    const query = timesheetSearch.trim().toLowerCase()
    if (!query) return true
    return [customerName(staffProfile, text), employee?.employee_code, employee?.attendance_number]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
  const scheduledEmployeeCount = new Set(visibleScheduleAttendanceShifts.filter((shift: any) => shift.status === 'published').map((shift: any) => shift.staff_profile_id)).size
  const salaryConfiguredCount = visibleAllStaffProfileOptions.filter((staffProfile: any) => {
    const employee = employeeProfileById.get(staffProfile.id)
    return Number(employee?.base_salary_vnd) > 0 || Number(employee?.hourly_rate_vnd) > 0
  }).length
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
                {visibleHrTabs.map((tab: any) => (
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
                  <div><span>{text.labels.outstandingDebt}</span><strong>{formatVndCompact(Math.max(0, selectedEmployeeOutstandingDebt))}</strong><small>{selectedEmployeeLabel}</small></div>
                </div>
              )}
              <div className="staff-hr-main staff-hr-main-full">
                <div className="staff-hr-content">

              {hrTab === 'employees' && (
                <div className="staff-attendance-layout staff-employee-layout staff-hr-employee-layout">
                  <div className="staff-attendance-list staff-employee-list staff-hr-roster-panel">
                    <div className="staff-hr-filter-grid">
                      <label>{text.labels.searchUsers}<input value={hrSearch} onChange={(event) => setHrSearch(event.target.value)} /></label>
                      <label>
                        {text.labels.contractStatus}
                        <select value={hrStatusFilter} onChange={(event) => setHrStatusFilter(event.target.value as StaffContractStatus | 'all')}>
                          <option value="all">{text.any}</option>
                          {staffContractStatuses.map((statusValue: any) => <option key={statusValue} value={statusValue}>{text.contractStatuses[statusValue]}</option>)}
                        </select>
                      </label>
                      <label>
                        {text.labels.department}
                        <select value={hrDepartmentFilter} onChange={(event) => setHrDepartmentFilter(event.target.value)}>
                          <option value="all">{text.any}</option>
                          {hrDepartmentOptions.map((option: any) => <option key={option.id} value={option.name}>{option.name}</option>)}
                        </select>
                      </label>
                    </div>
                    {filteredHrStaffProfiles.map((staffProfile: any) => {
                      const employee = employeeProfileById.get(staffProfile.id)
                      const isInactiveEmployee = employee?.active === false
                      const isSelected = (employeeForm.profile_id || firstEmployeeStaffProfileId) === staffProfile.id
                      return (
                        <button
                          className={`staff-employee-row ${isSelected ? 'active' : ''} ${isInactiveEmployee ? 'inactive' : ''}`}
                          key={staffProfile.id}
                          type="button"
                          onClick={() => editEmployeeProfile(staffProfile)}
                        >
                          <StaffRoleAvatar profile={staffProfile} text={text} />
                          <span>
                            <strong>{customerName(staffProfile, text)}</strong>
                            <small>
                              {employee?.employee_code || employee?.attendance_number || staffRoleName(roleLabel(staffProfile.role, staffProfile.email), text)} · {employee?.job_title || text.labels.staffMember}
                              {employee?.main_work_location ? ` · ${employee.main_work_location}` : ''}
                              {isInactiveEmployee ? ` · ${text.labels.inactiveEmployee}` : ''}
                            </small>
                          </span>
                          <span className="staff-hr-row-status">{employee?.contract_status ? text.contractStatuses[normalizeStaffContractStatus(employee.contract_status)] : text.noneYet}</span>
                        </button>
                      )
                    })}
                  </div>

                  <fieldset className="staff-readonly-fieldset staff-attendance-form staff-employee-form staff-hr-workspace" disabled={!canEditEmployeeProfiles || !selectedEmployeeStaffProfile}>
                    {selectedEmployeeStaffProfile && (
                      <div className="staff-employee-selected">
                        <StaffRoleAvatar profile={selectedEmployeeStaffProfile} text={text} />
                        <div>
                          <strong>{customerName(selectedEmployeeStaffProfile, text)}</strong>
                          <span>{selectedEmployeeStaffProfile.email || selectedEmployeeStaffProfile.phone || text.noContact}</span>
                        </div>
                        <button className="primary staff-employee-selected-save" type="button" disabled={saving || !canEditEmployeeProfiles} onClick={saveEmployeeProfile}>
                          <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveEmployeeProfile}</ButtonIconText>
                        </button>
                      </div>
                    )}
                    <div className="staff-summary-grid staff-employee-summary staff-hr-pay-summary">
                      <div><span>{text.labels.scheduledHours}</span><strong>{hoursLabel(employeePayrollSummary.scheduledMinutes)}</strong></div>
                      <div><span>{text.labels.workedHours}</span><strong>{hoursLabel(employeePayrollSummary.workedMinutes)}</strong></div>
                      <div><span>{text.labels.grossIncome}</span><strong>{formatVnd(employeePayrollSummary.grossIncome)}</strong></div>
                      <div><span>{text.labels.netIncome}</span><strong>{formatVnd(employeePayrollSummary.netIncome)}</strong></div>
                    </div>
                    <datalist id="staff-hr-department-options">{hrDepartmentOptions.map((option: any) => <option key={option.id} value={option.name} />)}</datalist>
                    <datalist id="staff-hr-location-options">{hrLocationOptions.map((option: any) => <option key={option.id} value={option.name} />)}</datalist>
                    <datalist id="staff-hr-job-title-options">{hrJobTitleOptions.map((option: any) => <option key={option.id} value={option.name} />)}</datalist>
                    <datalist id="staff-hr-contract-type-options">{hrContractTypeOptions.map((option: any) => <option key={option.id} value={option.name} />)}</datalist>
                    <div className="staff-hr-profile-form">
                      <section className="staff-hr-form-section">
                        <h5>{text.labels.privateEmployeeProfile}</h5>
                        <div className="form-grid compact-form-grid">
                          <label>
                            {text.labels.staffMember}
                            <select value={employeeForm.profile_id || firstEmployeeStaffProfileId} onChange={(event) => {
                              const staffProfile = visibleAllStaffProfileOptions.find((item: any) => item.id === event.target.value)
                              if (staffProfile) setEmployeeForm(employeeFormForProfile(staffProfile, employeeProfileById.get(staffProfile.id)))
                            }}>
                              {visibleAllStaffProfileOptions.map((item: any) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                            </select>
                          </label>
                          <label>{text.labels.employeeCode}<input value={employeeForm.employee_code} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_code: event.target.value })} /></label>
                          <label>{text.labels.attendanceNumber}<input value={employeeForm.attendance_number} onChange={(event) => setEmployeeForm({ ...employeeForm, attendance_number: event.target.value })} /></label>
                          <label>{text.labels.legalName}<input value={employeeForm.legal_name} onChange={(event) => setEmployeeForm({ ...employeeForm, legal_name: event.target.value })} /></label>
                          <label>{text.labels.nationalId}<input value={employeeForm.national_id} onChange={(event) => setEmployeeForm({ ...employeeForm, national_id: event.target.value })} /></label>
                          <label>{text.labels.dateOfBirth}<StaffPickerField ariaLabel={text.labels.dateOfBirth} placeholder={text.chooseDate} type="date" value={employeeForm.date_of_birth} onChange={(value: string) => setEmployeeForm({ ...employeeForm, date_of_birth: value })} /></label>
                          <label>
                            {text.labels.gender}
                            <select value={employeeForm.gender} onChange={(event) => setEmployeeForm({ ...employeeForm, gender: event.target.value })}>
                              <option value="">{text.any}</option>
                              {staffGenderOptions.map((gender: any) => <option key={gender} value={gender}>{text.genderOptions[gender]}</option>)}
                            </select>
                          </label>
                        </div>
                      </section>

                      <section className="staff-hr-form-section">
                        <h5>{text.labels.contractStatus}</h5>
                        <div className="form-grid compact-form-grid">
                          <label>{text.labels.department}<input list="staff-hr-department-options" value={employeeForm.department} onChange={(event) => setEmployeeForm({ ...employeeForm, department: event.target.value })} /></label>
                          <label>{text.labels.jobTitle}<input list="staff-hr-job-title-options" value={employeeForm.job_title} onChange={(event) => setEmployeeForm({ ...employeeForm, job_title: event.target.value })} /></label>
                          <label>{text.labels.mainWorkLocation}<input list="staff-hr-location-options" value={employeeForm.main_work_location} onChange={(event) => setEmployeeForm({ ...employeeForm, main_work_location: event.target.value })} /></label>
                          <label>{text.labels.payrollLocation}<input list="staff-hr-location-options" value={employeeForm.payroll_location} onChange={(event) => setEmployeeForm({ ...employeeForm, payroll_location: event.target.value })} /></label>
                          <label>
                            {text.labels.employmentType}
                            <select value={employeeForm.employment_type} onChange={(event) => setEmployeeForm({ ...employeeForm, employment_type: normalizeStaffEmploymentType(event.target.value) })}>
                              {staffEmploymentTypes.map((item: any) => <option key={item} value={item}>{text.employmentTypes[item]}</option>)}
                            </select>
                          </label>
                          <label>
                            {text.labels.contractStatus}
                            <select value={employeeForm.contract_status} onChange={(event) => setEmployeeForm({ ...employeeForm, contract_status: normalizeStaffContractStatus(event.target.value) })}>
                              {staffContractStatuses.map((statusValue: any) => <option key={statusValue} value={statusValue}>{text.contractStatuses[statusValue]}</option>)}
                            </select>
                          </label>
                          <label>{text.labels.contractType}<input list="staff-hr-contract-type-options" value={employeeForm.contract_type} onChange={(event) => setEmployeeForm({ ...employeeForm, contract_type: event.target.value })} /></label>
                          <label>{text.labels.contractStartDate}<StaffPickerField ariaLabel={text.labels.contractStartDate} placeholder={text.chooseDate} type="date" value={employeeForm.contract_start_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, contract_start_date: value })} /></label>
                          <label>{text.labels.contractEndDate}<StaffPickerField ariaLabel={text.labels.contractEndDate} placeholder={text.chooseDate} type="date" value={employeeForm.contract_end_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, contract_end_date: value })} /></label>
                          <label>{text.labels.startDate}<StaffPickerField ariaLabel={text.labels.startDate} placeholder={text.chooseDate} type="date" value={employeeForm.start_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, start_date: value })} /></label>
                          <label>{text.labels.endDate}<StaffPickerField ariaLabel={text.labels.endDate} placeholder={text.chooseDate} type="date" value={employeeForm.end_date} onChange={(value: string) => setEmployeeForm({ ...employeeForm, end_date: value })} /></label>
                        </div>
                      </section>

                      <section className="staff-hr-form-section">
                        <h5>{text.labels.payrollLink}</h5>
                        <div className="form-grid compact-form-grid">
                          {employeeUsesMonthlyGross ? (
                            <label>{text.labels.monthlyGross}<input inputMode="numeric" value={formatDongInput(employeeForm.base_salary_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, base_salary_vnd: dongDigits(event.target.value) })} /></label>
                          ) : (
                            <label>{text.labels.hourlyRate}<input inputMode="numeric" value={formatDongInput(employeeForm.hourly_rate_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, hourly_rate_vnd: dongDigits(event.target.value) })} /></label>
                          )}
                          <label>{text.labels.lunchAllowance}<input inputMode="numeric" value={formatDongInput(employeeForm.lunch_allowance_vnd)} onChange={(event) => setEmployeeForm({ ...employeeForm, lunch_allowance_vnd: dongDigits(event.target.value) })} /></label>
                          <label>{text.labels.restPeriodHours}<input min={0} step="0.25" type="number" value={employeeForm.rest_period_hours} onChange={(event) => setEmployeeForm({ ...employeeForm, rest_period_hours: event.target.value })} /></label>
                          <label>{text.labels.normalOvertimeMultiplier}<input min={0} step="0.05" type="number" value={employeeForm.overtime_rate_multiplier} onChange={(event) => setEmployeeForm({ ...employeeForm, overtime_rate_multiplier: event.target.value })} /></label>
                          <label>{text.labels.nightOvertimeMultiplier}<input min={0} step="0.05" type="number" value={employeeForm.night_rate_multiplier} onChange={(event) => setEmployeeForm({ ...employeeForm, night_rate_multiplier: event.target.value })} /></label>
                          <label>{text.labels.holidayOvertimeMultiplier}<input min={0} step="0.05" type="number" value={employeeForm.holiday_rate_multiplier} onChange={(event) => setEmployeeForm({ ...employeeForm, holiday_rate_multiplier: event.target.value })} /></label>
                        </div>
                      </section>

                      <section className="staff-hr-form-section">
                        <h5>{text.labels.bankTransfer}</h5>
                        <div className="form-grid compact-form-grid">
                          <label>{text.labels.employeeContributionRate}<input min={0} step="0.1" type="number" value={employeeForm.employee_contribution_rate} onChange={(event) => setEmployeeForm({ ...employeeForm, employee_contribution_rate: event.target.value })} /></label>
                          <label>{text.labels.employerContributionRate}<input min={0} step="0.1" type="number" value={employeeForm.employer_contribution_rate} onChange={(event) => setEmployeeForm({ ...employeeForm, employer_contribution_rate: event.target.value })} /></label>
                          <label>{text.labels.pitWithholdingRate}<input min={0} step="0.1" type="number" value={employeeForm.pit_withholding_rate} onChange={(event) => setEmployeeForm({ ...employeeForm, pit_withholding_rate: event.target.value })} /></label>
                          <label>{text.labels.dependentsCount}<input min={0} step="1" type="number" value={employeeForm.dependents_count} onChange={(event) => setEmployeeForm({ ...employeeForm, dependents_count: event.target.value })} /></label>
                          <label>{text.labels.bankName}<input value={employeeForm.bank_name} onChange={(event) => setEmployeeForm({ ...employeeForm, bank_name: event.target.value })} /></label>
                          <label>{text.labels.bankAccount}<input value={employeeForm.bank_account_number} onChange={(event) => setEmployeeForm({ ...employeeForm, bank_account_number: event.target.value })} /></label>
                          <label>{text.labels.taxCodeEmployee}<input value={employeeForm.tax_code} onChange={(event) => setEmployeeForm({ ...employeeForm, tax_code: event.target.value })} /></label>
                          <label>{text.labels.socialInsurance}<input value={employeeForm.social_insurance_number} onChange={(event) => setEmployeeForm({ ...employeeForm, social_insurance_number: event.target.value })} /></label>
                        </div>
                      </section>

                      <section className="staff-hr-form-section">
                        <h5>{text.labels.personalPhone}</h5>
                        <div className="form-grid compact-form-grid">
                          <label>{text.labels.personalPhone}<PhoneNumberInput buttonLabel={sharedText.countryCode} className="staff-phone-control" inputLabel={text.labels.personalPhone} onChange={(phone) => setEmployeeForm({ ...employeeForm, personal_phone: phone })} searchPlaceholder={sharedText.searchCountry} value={employeeForm.personal_phone} /></label>
                          <label>{text.labels.personalEmail}<input value={employeeForm.personal_email} onChange={(event) => setEmployeeForm({ ...employeeForm, personal_email: event.target.value })} /></label>
                          <label className="full">{text.labels.address}<input value={employeeForm.address} onChange={(event) => setEmployeeForm({ ...employeeForm, address: event.target.value })} /></label>
                          <label className="full">{text.labels.emergencyContact}<input value={employeeForm.emergency_contact} onChange={(event) => setEmployeeForm({ ...employeeForm, emergency_contact: event.target.value })} /></label>
                          <label className="full">{text.labels.payrollNote}<textarea value={employeeForm.payroll_note} onChange={(event) => setEmployeeForm({ ...employeeForm, payroll_note: event.target.value })} /></label>
                        </div>
                      </section>
                    </div>
                    <div className="staff-hr-document-section">
                      <div className="staff-hr-panel-head compact">
                        <div>
                          <h5>{text.labels.attachmentList}</h5>
                        </div>
                        <strong>{selectedEmployeeDocuments.length}</strong>
                      </div>
                      <div className="staff-hr-document-actions">
                        <label className="staff-file-action">
                          <FileText aria-hidden="true" size={15} />
                          <span>{hrDocumentUploading === 'profile_photo' ? text.loading : text.actions.uploadPhoto}</span>
                          <small>{text.messages.profilePhotoHelp}</small>
                          <input accept={staffProfilePhotoTypes.join(',')} disabled={Boolean(hrDocumentUploading)} type="file" onChange={(event) => void handleHrDocumentUpload(event, 'profile_photo')} />
                        </label>
                        <label className="staff-file-action">
                          <FileCheck2 aria-hidden="true" size={15} />
                          <span>{hrDocumentUploading === 'cv' ? text.loading : text.actions.uploadCv}</span>
                          <small>{text.messages.cvHelp}</small>
                          <input accept={staffCvTypes.join(',')} disabled={Boolean(hrDocumentUploading)} type="file" onChange={(event) => void handleHrDocumentUpload(event, 'cv')} />
                        </label>
                        <div className="staff-hr-document-list">
                          {selectedEmployeeDocuments.length > 0 ? selectedEmployeeDocuments.slice(0, 4).map((document: any) => (
                            <span key={document.id}>{text.hrTabs.employees}: {document.file_name}</span>
                          )) : <span>{text.messages.noHrDocuments}</span>}
                        </div>
                      </div>
                    </div>
                    <label className="staff-checkbox-row staff-employee-active-row">
                      <input type="checkbox" checked={employeeForm.active} onChange={(event) => setEmployeeForm({ ...employeeForm, active: event.target.checked })} />
                      <span>{text.labels.activeEmployee}</span>
                    </label>
                  </fieldset>
                </div>
              )}

              {hrTab === 'schedule' && (
                <div className="staff-hr-schedule-stack">
                  <div className="staff-operations-actions staff-attendance-actions staff-hr-week-controls">
                    <button type="button" onClick={() => shiftAttendanceRange(-attendanceWeekDates.length)}>
                      <ButtonIconText icon={<ChevronLeft aria-hidden="true" size={14} />}>{text.actions.previousWeek}</ButtonIconText>
                    </button>
                    <label>
                      <span className="staff-field-label">{text.labels.startDate}</span>
                      <StaffPickerField
                        ariaLabel={text.labels.startDate}
                        placeholder={text.chooseDate}
                        type="date"
                        value={attendanceWeekStart}
                        onChange={(value: string) => setAttendanceRange(value, attendanceWeekEnd)}
                      />
                    </label>
                    <label>
                      <span className="staff-field-label">{text.labels.endDate}</span>
                      <StaffPickerField
                        ariaLabel={text.labels.endDate}
                        placeholder={text.chooseDate}
                        type="date"
                        value={attendanceWeekEnd}
                        onChange={(value: string) => setAttendanceRange(attendanceWeekStart, value)}
                      />
                    </label>
                    <button type="button" onClick={resetAttendanceRangeToThisWeek}>
                      <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>{text.actions.today}</ButtonIconText>
                    </button>
                    <button type="button" onClick={() => shiftAttendanceRange(attendanceWeekDates.length)}>
                      <ButtonIconText icon={<ChevronRight aria-hidden="true" size={14} />}>{text.actions.nextWeek}</ButtonIconText>
                    </button>
                  </div>
                  <section className="staff-planning-panel staff-hr-planning-panel" aria-label={text.labels.weeklySchedule}>
                    <div className="staff-planning-toolbar">
                      <div className="staff-planning-title">
                        <strong>{text.labels.weeklySchedule}</strong>
                        <span>{text.messages.planningGridHelp}</span>
                      </div>
                      <div className="staff-planning-scope" role="group" aria-label={text.labels.scheduleScope}>
                        {attendanceScheduleScopeOptions.map((scope: any) => (
                          <button
                            className={effectiveAttendanceScheduleScope === scope ? 'active' : ''}
                            key={scope}
                            type="button"
                            onClick={() => setAttendanceScheduleScope(scope)}
                          >
                            {text.scheduleScopes[scope]}
                          </button>
                        ))}
                      </div>
                      <label>
                        {text.labels.shiftTemplate}
                        <select value={selectedShiftTemplate} onChange={(event) => applyShiftTemplate(event.target.value)} disabled={!canManageAttendance}>
                          {effectiveShiftTemplates.map((template: any) => <option key={template.id} value={template.id}>{text.shiftTemplates[template.id]}</option>)}
                        </select>
                      </label>
                      {canManageAttendance && (
                        <div className="staff-planning-actions">
                          <button type="button" onClick={copyPreviousAttendanceWeek} disabled={saving}>
                            <ButtonIconText icon={<Copy aria-hidden="true" size={14} />}>{text.actions.copyPreviousWeek}</ButtonIconText>
                          </button>
                          <button type="button" onClick={publishAttendanceWeek} disabled={saving || draftShiftCount === 0}>
                            <ButtonIconText icon={<Send aria-hidden="true" size={14} />}>
                              {text.actions.publishWeek}{draftShiftCount > 0 ? ` (${draftShiftCount})` : ''}
                            </ButtonIconText>
                          </button>
                        </div>
                      )}
                    </div>

                    {!canManageAttendance && <p className="staff-readonly-note">{text.messages.attendanceReadOnly}</p>}

                    {visibleScheduleStaffProfileOptions.length > 0 ? (
                      <div className="staff-planning-grid-shell">
                        <div className="staff-planning-grid" role="grid" aria-label={text.labels.weeklySchedule} style={attendanceGridStyle}>
                          <div className="staff-planning-corner" role="columnheader">{text.labels.staffMember}</div>
                          {attendanceWeekDates.map((dateValue: string) => (
                            <div className="staff-planning-day" role="columnheader" key={dateValue}>
                              <strong>{shortDateLabel(dateValue)}</strong>
                              <span>{text.reportWeekdays[(dateFromInput(dateValue).getDay() + 6) % 7]}</span>
                            </div>
                          ))}
                          {visibleScheduleStaffProfileOptions.map((staffProfile: any) => {
                            const employee = employeeProfileById.get(staffProfile.id)
                            const isInactiveEmployee = employee?.active === false
                            return (
                              <Fragment key={staffProfile.id}>
                                <div className={`staff-planning-staff ${isInactiveEmployee ? 'inactive' : ''}`} role="rowheader">
                                  <StaffRoleAvatar profile={staffProfile} text={text} />
                                  <span>
                                    <strong>{customerName(staffProfile, text)}</strong>
                                    <small>{employee?.department || text.labels.staffMember}{isInactiveEmployee ? ` · ${text.labels.inactiveEmployee}` : ''}</small>
                                  </span>
                                </div>
                                {attendanceWeekDates.map((dateValue: string) => {
                                  const cellShifts = attendanceShiftsByCell.get(`${staffProfile.id}:${dateValue}`) || []
                                  return (
                                    <div
                                      className="staff-planning-cell"
                                      key={`${staffProfile.id}:${dateValue}`}
                                      role="gridcell"
                                      onDragOver={(event) => {
                                        if (!canManageAttendance || isInactiveEmployee) return
                                        event.preventDefault()
                                      }}
                                      onDrop={(event) => {
                                        event.preventDefault()
                                        if (isInactiveEmployee) return
                                        const shift = visibleScheduleAttendanceShifts.find((item: any) => item.id === draggingShiftId)
                                        if (shift) void moveShiftToCell(shift, staffProfile.id, dateValue)
                                        setDraggingShiftId('')
                                      }}
                                    >
                                      {canManageAttendance && (
                                        <button
                                          aria-label={`${text.aria.draftShift}: ${customerName(staffProfile, text)} ${shortDateLabel(dateValue)}`}
                                          className="staff-planning-cell-button"
                                          disabled={saving || isInactiveEmployee}
                                          type="button"
                                          onClick={() => void startShiftForCell(staffProfile.id, dateValue)}
                                        >
                                          +
                                        </button>
                                      )}
                                      {cellShifts.map((shift: any) => {
                                        const warnings = shiftWarningsById.get(shift.id) || []
                                        return (
                                          <button
                                            className={`staff-shift-chip ${warnings.length > 0 ? 'has-warning' : ''}`}
                                            disabled={!canManageAttendance}
                                            draggable={canManageAttendance}
                                            key={shift.id}
                                            type="button"
                                            onClick={() => {
                                              if (canManageAttendance) editShift(shift)
                                            }}
                                            onDragStart={() => setDraggingShiftId(shift.id)}
                                            onDragEnd={() => setDraggingShiftId('')}
                                          >
                                            <span>{normalizeTime(shift.start_time)}-{normalizeTime(shift.end_time)}</span>
                                            <small>{text.shiftStatuses[shift.status]}</small>
                                            {warnings.length > 0 && <em>{warnings[0]}</em>}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </Fragment>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="notice">{text.messages.noStaffProfiles}</p>
                    )}
                  </section>

                  <div className="staff-attendance-layout staff-hr-schedule-layout">
                    <div className="staff-attendance-list">
                      <div className="staff-hr-panel-head">
                        <div>
                          <h4>{text.labels.shiftList}</h4>
                          <p className="staff-helper-text">{text.labels.attendanceSchedule}</p>
                        </div>
                        <strong>{visibleScheduleAttendanceShifts.length}</strong>
                      </div>
                      {visibleScheduleAttendanceShifts.map((shift: any) => {
                        const staffProfile = profileById.get(shift.staff_profile_id)
                        const warnings = shiftWarningsById.get(shift.id) || []
                        const payrollWarnings = staffPayrollCalculations.get(shift.staff_profile_id)?.restWarningCount || 0
                        return (
                          <article className="staff-attendance-row" key={shift.id}>
                            <div className="staff-attendance-person">
                              {staffProfile && <StaffRoleAvatar profile={staffProfile} text={text} />}
                              <div>
                                <strong>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</strong>
                                <span>{staffDateLabel(shift.shift_date)} · {normalizeTime(shift.start_time)}-{normalizeTime(shift.end_time)}</span>
                              </div>
                            </div>
                            <div className="staff-attendance-meta">
                              <span>{shift.location}</span>
                              <span>{text.shiftStatuses[shift.status]}</span>
                              <span>{text.labels.breakMinutes}: {shift.break_minutes}</span>
                              {[...warnings, payrollWarnings > 0 ? `${text.labels.restWarnings}: ${payrollWarnings}` : ''].filter(Boolean).map((warning: string) => <span className="staff-warning-text" key={warning}>{warning}</span>)}
                            </div>
                            {canManageAttendance && (
                              <div className="staff-row-actions staff-attendance-row-actions">
                                <button type="button" onClick={() => editShift(shift)}>
                                  <ButtonIconText icon={<Pencil aria-hidden="true" size={14} />}>{text.actions.edit}</ButtonIconText>
                                </button>
                                {shift.status === 'draft' && (
                                  <button type="button" onClick={() => updateShiftStatus(shift, 'published')}>
                                    <ButtonIconText icon={<Send aria-hidden="true" size={14} />}>{text.actions.publish}</ButtonIconText>
                                  </button>
                                )}
                                {shift.status !== 'completed' && (
                                  <button type="button" onClick={() => updateShiftStatus(shift, 'completed')}>
                                    <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.done}</ButtonIconText>
                                  </button>
                                )}
                                {shift.status !== 'cancelled' && (
                                  <button type="button" onClick={() => updateShiftStatus(shift, 'cancelled')}>
                                    <ButtonIconText icon={<Ban aria-hidden="true" size={14} />}>{text.actions.cancelShift}</ButtonIconText>
                                  </button>
                                )}
                              </div>
                            )}
                          </article>
                        )
                      })}
                      {visibleScheduleAttendanceShifts.length === 0 && <p className="notice">{text.messages.noShifts}</p>}
                    </div>

                    {canManageAttendance && (
                      <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
                        <h4>{text.labels.weeklySchedule}</h4>
                        <div className="form-grid compact-form-grid">
                          <label>
                            {text.labels.staffMember}
                            <select value={shiftForm.staff_profile_id || firstScheduleStaffProfileId} onChange={(event) => setShiftForm({ ...shiftForm, staff_profile_id: event.target.value })}>
                              {visibleScheduleStaffProfileOptions.map((item: any) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                            </select>
                          </label>
                          <label>
                            {text.labels.shiftDate}
                            <StaffPickerField ariaLabel={text.labels.shiftDate} placeholder={text.chooseDate} type="date" value={shiftForm.shift_date} onChange={(value: string) => setShiftForm({ ...shiftForm, shift_date: value })} />
                          </label>
                          <label>
                            {text.labels.start}
                            <StaffPickerField ariaLabel={text.labels.start} placeholder={text.chooseTime} type="time" value={shiftForm.start_time} onChange={(value: string) => setShiftForm({ ...shiftForm, start_time: value })} />
                          </label>
                          <label>
                            {text.labels.end}
                            <StaffPickerField ariaLabel={text.labels.end} placeholder={text.chooseTime} type="time" value={shiftForm.end_time} onChange={(value: string) => setShiftForm({ ...shiftForm, end_time: value })} />
                          </label>
                          <label>{text.labels.breakMinutes}<input min={0} type="number" value={shiftForm.break_minutes} onChange={(event) => setShiftForm({ ...shiftForm, break_minutes: event.target.value })} /></label>
                          <label>{text.labels.location}<input value={shiftForm.location} onChange={(event) => setShiftForm({ ...shiftForm, location: event.target.value })} /></label>
                          <label>{text.labels.status}<select value={shiftForm.status} onChange={(event) => setShiftForm({ ...shiftForm, status: event.target.value })}>{staffShiftStatuses.map((status: any) => <option key={status} value={status}>{text.shiftStatuses[status]}</option>)}</select></label>
                          <label className="full">{text.labels.notes}<textarea value={shiftForm.notes} onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })} /></label>
                        </div>
                        <button className="primary" type="button" disabled={saving || !(shiftForm.staff_profile_id || firstScheduleStaffProfileId)} onClick={saveShift}>
                          <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveShift}</ButtonIconText>
                        </button>
                      </fieldset>
                    )}
                  </div>
                </div>
              )}

              {hrTab === 'timesheet' && (
                <div className="staff-hr-table-panel">
                  <div className="staff-hr-panel-head staff-hr-timesheet-toolbar">
                    <div>
                      <h4>{text.hrTabs.timesheet}</h4>
                      <p className="staff-helper-text">{rangeLabel(payrollPeriodStart, payrollPeriodEnd)}</p>
                    </div>
                    <label className="staff-hr-timesheet-search">
                      <Search aria-hidden="true" size={17} />
                      <input aria-label={completionText.searchEmployees} placeholder={completionText.searchEmployees} value={timesheetSearch} onChange={(event) => setTimesheetSearch(event.target.value)} />
                    </label>
                    {isOwnerOrAdmin && (
                      <button className="primary staff-hr-approve-attendance" disabled={saving || periodAttendanceLogs.length === 0 || pendingAttendanceCount === 0} type="button" onClick={() => void approveAttendancePeriod()}>
                        <CalendarCheck2 aria-hidden="true" size={17} />
                        {completionText.approveAttendance}
                        {pendingAttendanceCount > 0 && <span>{pendingAttendanceCount}</span>}
                      </button>
                    )}
                  </div>
                  <div className="staff-table-wrap">
                    <table className="staff-table staff-attendance-table">
                    <thead>
                      <tr>
                        <th>{text.labels.staffMember}</th>
                        <th>{completionText.payType}</th>
                        <th>{completionText.present}</th>
                        <th>{completionText.onLeave}</th>
                        <th>{completionText.lateArrival}</th>
                        <th>{completionText.earlyLeave}</th>
                        <th>{text.labels.overtimeHours}</th>
                        <th>{completionText.approveAttendance}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timesheetProfiles.map((staffProfile: any) => {
                        const calculation = staffPayrollCalculations.get(staffProfile.id) || emptyStaffPayrollCalculation(staffProfile.id)
                        const employee = employeeProfileById.get(staffProfile.id)
                        const employeeLogs = periodAttendanceLogs.filter((log: any) => log.staff_profile_id === staffProfile.id)
                        const employeeLeaves = leaveRequests.filter((leave: any) => (
                          leave.staff_profile_id === staffProfile.id
                          && leave.status === 'approved'
                          && leave.end_date >= payrollPeriodStart
                          && leave.start_date <= payrollPeriodEnd
                        ))
                        const presentShifts = employeeLogs.filter((log: any) => log.clock_in_at && log.clock_out_at).length
                        const lateLogs = employeeLogs.filter((log: any) => Number(log.late_minutes) > 0)
                        const earlyLogs = employeeLogs.filter((log: any) => Number(log.early_leave_minutes) > 0)
                        const lateMinutes = lateLogs.reduce((sum: number, log: any) => sum + Number(log.late_minutes || 0), 0)
                        const earlyMinutes = earlyLogs.reduce((sum: number, log: any) => sum + Number(log.early_leave_minutes || 0), 0)
                        const approved = employeeLogs.length > 0 && employeeLogs.every((log: any) => log.approval_status === 'approved')
                        return (
                          <tr key={staffProfile.id}>
                            <td>
                              <strong>{customerName(staffProfile, text)}</strong>
                              <small>{employee?.employee_code || employee?.attendance_number || '—'}</small>
                            </td>
                            <td>{Number(employee?.base_salary_vnd) > 0 ? completionText.byMonth : completionText.byHour}</td>
                            <td><strong>{presentShifts} {completionText.shifts}</strong><small>{hoursLabel(calculation.workedMinutes)}</small></td>
                            <td><strong>{employeeLeaves.length || '—'}</strong><small>{employeeLeaves.length ? hoursLabel(calculation.paidLeaveHours * 60) : ''}</small></td>
                            <td><strong>{lateLogs.length || '—'}{lateLogs.length ? ` ${completionText.occurrences}` : ''}</strong><small>{lateMinutes ? hoursLabel(lateMinutes) : ''}</small></td>
                            <td><strong>{earlyLogs.length || '—'}{earlyLogs.length ? ` ${completionText.occurrences}` : ''}</strong><small>{earlyMinutes ? hoursLabel(earlyMinutes) : ''}</small></td>
                            <td><strong>{calculation.overtimeMinutes > 0 ? hoursLabel(calculation.overtimeMinutes) : '—'}</strong></td>
                            <td><span className={`staff-hr-approval-state ${approved ? 'approved' : 'pending'}`}>{approved ? completionText.approved : completionText.pending}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                    </table>
                  </div>
                  {timesheetProfiles.length === 0 && <p className="notice">{completionText.noAttendance}</p>}
                </div>
              )}

              {hrTab === 'payroll' && (
                <div className="staff-attendance-layout staff-hr-payroll-layout">
                  <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
                    <h4>{text.labels.payrollRun}</h4>
                    <div className="form-grid compact-form-grid">
                      <label>{text.labels.payrollCode}<input value={payrollRunForm.code} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, code: event.target.value })} /></label>
                      <label>{text.labels.payrollName}<input value={payrollRunForm.name} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, name: event.target.value })} /></label>
                      <label>{text.labels.payCycle}<select value={payrollRunForm.pay_cycle} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, pay_cycle: normalizePayrollPayCycle(event.target.value) })}>{staffPayrollPayCycles.map((cycle: any) => <option key={cycle} value={cycle}>{text.payrollPayCycles[cycle]}</option>)}</select></label>
                      <label>{text.labels.periodStart}<StaffPickerField ariaLabel={text.labels.periodStart} placeholder={text.chooseDate} type="date" value={payrollRunForm.period_start} onChange={(value: string) => setPayrollRunForm({ ...payrollRunForm, period_start: value })} /></label>
                      <label>{text.labels.periodEnd}<StaffPickerField ariaLabel={text.labels.periodEnd} placeholder={text.chooseDate} type="date" value={payrollRunForm.period_end} onChange={(value: string) => setPayrollRunForm({ ...payrollRunForm, period_end: value })} /></label>
                      <label className="full">{text.labels.notes}<textarea value={payrollRunForm.notes} onChange={(event) => setPayrollRunForm({ ...payrollRunForm, notes: event.target.value })} /></label>
                    </div>
                    <div className="staff-summary-grid staff-employee-summary staff-hr-pay-summary">
                      <div><span>{text.labels.totalGross}</span><strong>{formatVnd(hrPayrollTotals.gross)}</strong></div>
                      <div><span>{text.labels.totalNet}</span><strong>{formatVnd(hrPayrollTotals.net)}</strong></div>
                      <div><span>{text.labels.totalCompanyCost}</span><strong>{formatVnd(hrPayrollTotals.companyCost)}</strong></div>
                    </div>
                    <button className="primary" type="button" disabled={saving} onClick={generatePayrollRun}>
                      <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.generatePayroll}</ButtonIconText>
                    </button>
                  </fieldset>
                  <div className="staff-attendance-list">
                    <h4>{text.labels.payslipPreview}</h4>
                    <div className="staff-hr-payslip">
                      <strong>{selectedEmployeeStaffProfile ? customerName(selectedEmployeeStaffProfile, text) : text.customerFallback}</strong>
                      <span>{rangeLabel(payrollPeriodStart, payrollPeriodEnd)}</span>
                      <dl>
                        <div><dt>{text.labels.grossIncome}</dt><dd>{formatVnd(employeePayrollSummary.grossIncome)}</dd></div>
                        <div><dt>{text.labels.employeeContributions}</dt><dd>{formatVnd(employeePayrollSummary.employeeContributions)}</dd></div>
                        <div><dt>{text.labels.pitWithheld}</dt><dd>{formatVnd(employeePayrollSummary.pitWithheld)}</dd></div>
                        <div><dt>{text.labels.netIncome}</dt><dd>{formatVnd(employeePayrollSummary.netIncome)}</dd></div>
                        <div><dt>{text.labels.companyCost}</dt><dd>{formatVnd(employeePayrollSummary.companyCost)}</dd></div>
                      </dl>
                      <button type="button" onClick={() => void downloadEmployeePayslip()}>
                        <ButtonIconText icon={<Download aria-hidden="true" size={14} />}>{text.actions.viewPayslip}</ButtonIconText>
                      </button>
                    </div>
                    <h4>{text.hrTabs.payroll}</h4>
                    {payrollRuns.map((run: any) => (
                      <article className="staff-attendance-row" key={run.id}>
                        <div className="staff-attendance-person">
                          <FileSpreadsheet aria-hidden="true" size={20} />
                          <div>
                            <strong>{run.name}</strong>
                            <span>{run.code} · {staffDateLabel(run.period_start)} - {staffDateLabel(run.period_end)}</span>
                          </div>
                        </div>
                        <div className="staff-attendance-meta">
                          <span>{text.payrollStatuses[normalizePayrollStatus(run.status)]}</span>
                          <span>{formatVnd(run.total_net_vnd)}</span>
                          <span>{payrollItems.filter((item: any) => item.payroll_run_id === run.id).length} {text.hrTabs.employees}</span>
                        </div>
                        <div className="staff-row-actions staff-attendance-row-actions">
                          {canManageAttendance && run.status !== 'approved' && (
                            <button type="button" onClick={() => approvePayrollRun(run)}>
                              <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.approvePayroll}</ButtonIconText>
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                    {payrollRuns.length === 0 && <p className="notice">{text.messages.noPayrollRuns}</p>}
                  </div>
                </div>
              )}

              {(hrTab === 'adjustments' || hrTab === 'advances') && (
                <div className="staff-attendance-layout">
                  <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
                    <h4>{hrTab === 'advances' ? text.hrTabs.advances : text.hrTabs.adjustments}</h4>
                    <div className="form-grid compact-form-grid">
                      <label>{text.labels.staffMember}<select value={hrAdjustmentForm.profile_id || selectedEmployeeStaffId || firstEmployeeStaffProfileId} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, profile_id: event.target.value })}>{visibleAllStaffProfileOptions.map((item: any) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}</select></label>
                      <label>{text.labels.type}<select value={hrAdjustmentForm.adjustment_type} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, adjustment_type: normalizeHrAdjustmentType(event.target.value) })}>{staffHrAdjustmentTypes.filter((type: any) => hrTab === 'advances' ? ['advance', 'debt', 'debt_repayment'].includes(type) : !['advance', 'debt', 'debt_repayment'].includes(type)).map((type: any) => <option key={type} value={type}>{text.adjustmentTypes[type]}</option>)}</select></label>
                      <label>{text.labels.name}<input value={hrAdjustmentForm.title} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, title: event.target.value })} /></label>
                      <label>{text.vndAmount}<input inputMode="numeric" value={formatDongInput(hrAdjustmentForm.amount_vnd)} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, amount_vnd: dongDigits(event.target.value) })} /></label>
                      <label>{text.labels.date}<StaffPickerField ariaLabel={text.labels.date} placeholder={text.chooseDate} type="date" value={hrAdjustmentForm.effective_date} onChange={(value: string) => setHrAdjustmentForm({ ...hrAdjustmentForm, effective_date: value })} /></label>
                      <label>{text.labels.status}<select value={hrAdjustmentForm.status} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, status: normalizeHrAdjustmentStatus(event.target.value) })}>{staffHrAdjustmentStatuses.map((statusValue: any) => <option key={statusValue} value={statusValue}>{text.adjustmentStatuses[statusValue]}</option>)}</select></label>
                      <label className="full">{text.labels.notes}<textarea value={hrAdjustmentForm.notes} onChange={(event) => setHrAdjustmentForm({ ...hrAdjustmentForm, notes: event.target.value })} /></label>
                    </div>
                    <button className="primary" type="button" disabled={saving || parseDong(hrAdjustmentForm.amount_vnd) <= 0} onClick={() => saveHrAdjustment(hrTab === 'advances' ? 'advance' : 'adjustment')}>
                      <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveAdjustment}</ButtonIconText>
                    </button>
                  </fieldset>
                  <div className="staff-attendance-list">
                    {periodHrAdjustments.filter((item: any) => hrTab === 'advances' ? ['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type) : !['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type)).map((adjustment: any) => {
                      const staffProfile = profileById.get(adjustment.profile_id)
                      return (
                        <article className="staff-attendance-row" key={adjustment.id}>
                          <div className="staff-attendance-person">
                            {staffProfile && <StaffRoleAvatar profile={staffProfile} text={text} />}
                            <div>
                              <strong>{adjustment.title || text.adjustmentTypes[adjustment.adjustment_type]}</strong>
                              <span>{staffProfile ? customerName(staffProfile, text) : text.customerFallback} · {staffDateLabel(adjustment.effective_date)}</span>
                            </div>
                          </div>
                          <div className="staff-attendance-meta">
                            <span>{text.adjustmentTypes[adjustment.adjustment_type]}</span>
                            <span>{formatVnd(adjustment.amount_vnd)}</span>
                            <span>{text.adjustmentStatuses[adjustment.status]}</span>
                          </div>
                          <div className="staff-row-actions staff-attendance-row-actions">
                            {canManageAttendance && adjustment.status === 'pending' && (
                              <button type="button" onClick={() => updateHrAdjustmentStatus(adjustment, 'approved')}>
                                <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.approve}</ButtonIconText>
                              </button>
                            )}
                            {canManageAttendance && adjustment.status === 'pending' && (
                              <button type="button" onClick={() => updateHrAdjustmentStatus(adjustment, 'rejected')}>
                                <ButtonIconText icon={<X aria-hidden="true" size={14} />}>{text.actions.reject}</ButtonIconText>
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    })}
                    {periodHrAdjustments.length === 0 && <p className="notice">{text.messages.noAdjustments}</p>}
                  </div>
                </div>
              )}

              {hrTab === 'zalo' && isOwnerOrAdmin && (
                <StaffZaloMiniAppSettings language={resolvedLanguage} onStatus={setStatus} />
              )}

              {hrTab === 'settings' && (
                <div className="staff-hr-settings-shell">
                  <header className="staff-hr-settings-heading">
                    <h3>{completionText.settingsTitle}</h3>
                    <p>{completionText.settingsIntro}</p>
                  </header>
                  <div className="staff-hr-settings-workspace">
                    <nav className="staff-hr-settings-nav" aria-label={completionText.settingsTitle}>
                      <span>{text.hrTabs.settings}</span>
                      {settingsSections.map(({ id, icon: Icon }) => (
                        <button aria-current={settingsSection === id ? 'page' : undefined} className={settingsSection === id ? 'active' : ''} key={id} type="button" onClick={() => setSettingsSection(id)}>
                          <Icon aria-hidden="true" size={18} />
                          {completionText.sections[id]}
                        </button>
                      ))}
                    </nav>

                    <section className="staff-hr-settings-panel">
                      {settingsSection === 'initialization' && (
                        <div className="staff-hr-setup-checklist">
                          <div className="staff-hr-settings-panel-title">
                            <div><h4>{completionText.quickSetup}</h4><p>{completionText.quickSetupHelp}</p></div>
                          </div>
                          {initializationRows.map((row) => {
                            const [title, description] = completionText.setupRows[row.id]
                            return (
                              <div className="staff-hr-checklist-row" key={row.id}>
                                <CircleCheckBig aria-hidden="true" className={row.complete ? 'complete' : ''} size={24} />
                                <div><strong>{title}</strong><span>{description} · {row.meta}</span></div>
                                <button type="button" onClick={row.open}>{completionText.open}</button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {settingsSection === 'clocking' && (
                        <fieldset className="staff-readonly-fieldset staff-hr-reference-settings" disabled={!canManageAttendance}>
                          <div className="staff-hr-settings-panel-title"><div><h4>{completionText.attendanceSetup}</h4><p>{completionText.standardDayHelp}</p></div></div>
                          <div className="staff-hr-reference-row">
                            <div><strong>{completionText.shiftSetup}</strong><span>{completionText.shiftSetupHelp}</span></div>
                            <button type="button" onClick={() => setHrTab('schedule')}>{effectiveShiftTemplates.length} {completionText.shifts}</button>
                          </div>
                          <div className="staff-hr-reference-group">
                            <div className="staff-hr-reference-copy"><strong>{completionText.standardDay}</strong><span>{completionText.standardDayHelp}</span></div>
                            <div className="staff-hr-inline-control">
                              <StaffPickerField ariaLabel={completionText.standardDay} mode="duration" placeholder="08:00" type="time" value={`${String(Math.floor(attendanceSettings.standard_daily_minutes / 60)).padStart(2, '0')}:${String(attendanceSettings.standard_daily_minutes % 60).padStart(2, '0')}`} onChange={(value: string) => {
                                const [hours, minutes] = value.split(':').map(Number)
                                setAttendanceSettings({ ...attendanceSettings, standard_daily_minutes: Math.max(0, hours * 60 + minutes) })
                              }} />
                            </div>
                            <label className="staff-hr-rule-toggle">
                              <input checked={attendanceSettings.half_day_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, half_day_enabled: event.target.checked })} />
                              <span>{completionText.halfDay}</span>
                            </label>
                            <div className="staff-hr-inline-control staff-hr-range-control">
                              <label>{completionText.from}<input min={0} type="number" value={attendanceSettings.half_day_min_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, half_day_min_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                              <label>{completionText.to}<input min={0} type="number" value={attendanceSettings.half_day_max_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, half_day_max_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                            </div>
                            <label className="staff-hr-rule-toggle">
                              <input checked={attendanceSettings.count_late_early_on_half_day} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, count_late_early_on_half_day: event.target.checked })} />
                              <span>{completionText.countHalfDayLate}</span>
                            </label>
                          </div>
                          <div className="staff-hr-reference-group">
                            <div className="staff-hr-reference-copy"><strong>{completionText.lateEarly}</strong></div>
                            <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.late_arrival_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, late_arrival_enabled: event.target.checked })} /><span>{completionText.lateAfter}</span><input min={0} type="number" value={attendanceSettings.late_after_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, late_after_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                            <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.early_leave_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, early_leave_enabled: event.target.checked })} /><span>{completionText.earlyBefore}</span><input min={0} type="number" value={attendanceSettings.early_leave_before_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, early_leave_before_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                          </div>
                          <div className="staff-hr-reference-group">
                            <div className="staff-hr-reference-copy"><strong>{completionText.overtime}</strong></div>
                            <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.overtime_before_shift_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_before_shift_enabled: event.target.checked })} /><span>{completionText.overtimeBefore}</span><input min={0} type="number" value={attendanceSettings.overtime_before_shift_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_before_shift_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                            <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.overtime_after_shift_enabled} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_after_shift_enabled: event.target.checked })} /><span>{completionText.overtimeAfter}</span><input min={0} type="number" value={attendanceSettings.overtime_after_shift_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_after_shift_minutes: Number(event.target.value) || 0 })} /><small>{completionText.minutes}</small></label>
                            <label className="staff-hr-rule-toggle"><input checked={attendanceSettings.single_clock_for_consecutive_shifts} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, single_clock_for_consecutive_shifts: event.target.checked })} /><span>{completionText.consecutive}</span></label>
                          </div>
                          <div className="staff-hr-settings-actions"><button className="primary" disabled={saving} type="button" onClick={() => void saveAttendanceSettings()}><Save aria-hidden="true" size={16} />{text.actions.saveRules}</button></div>
                        </fieldset>
                      )}

                      {settingsSection === 'salary' && (
                        <fieldset className="staff-readonly-fieldset staff-hr-reference-settings" disabled={!canManageAttendance}>
                          <div className="staff-hr-settings-panel-title"><div><h4>{completionText.salaryTitle}</h4><p>{completionText.paydayHelp}</p></div></div>
                          <div className="staff-hr-reference-row">
                            <div><strong>{completionText.payday}</strong><span>{completionText.paydayHelp}</span></div>
                            <label className="staff-hr-payday-select">{completionText.day}<select value={hrSettings.pay_period_start_day} onChange={(event) => setHrSettings({ ...hrSettings, pay_period_start_day: Number(event.target.value) })}>{Array.from({ length: 28 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
                          </div>
                          <label className="staff-hr-reference-row staff-hr-switch-row"><div><strong>{completionText.autoCreate}</strong><span>{completionText.autoCreateHelp}</span></div><input checked={hrSettings.auto_create_payroll_runs} role="switch" type="checkbox" onChange={(event) => setHrSettings({ ...hrSettings, auto_create_payroll_runs: event.target.checked })} /></label>
                          <label className="staff-hr-reference-row staff-hr-switch-row"><div><strong>{completionText.autoUpdate}</strong><span>{completionText.autoUpdateHelp}</span></div><input checked={hrSettings.auto_update_payroll_daily} role="switch" type="checkbox" onChange={(event) => setHrSettings({ ...hrSettings, auto_update_payroll_daily: event.target.checked })} /></label>
                          {(['payroll_template', 'allowance', 'deduction'] as const).map((optionType) => (
                            <button className="staff-hr-reference-row staff-hr-reference-link" key={optionType} type="button" onClick={() => setSettingsSection('categories')}>
                              <div><strong>{text.hrSetupOptionTypes[optionType]}</strong><span>{(hrOptionsByType.get(optionType) || []).map((option: any) => option.name).slice(0, 3).join(', ') || completionText.noOptions}</span></div>
                              <span>{(hrOptionsByType.get(optionType) || []).length}</span>
                            </button>
                          ))}
                          <label className="staff-hr-reference-row staff-hr-switch-row"><div><strong>{completionText.tax}</strong><span>{completionText.taxHelp}</span></div><input checked={hrSettings.personal_income_tax_enabled} role="switch" type="checkbox" onChange={(event) => setHrSettings({ ...hrSettings, personal_income_tax_enabled: event.target.checked })} /></label>
                          <label className="staff-hr-reference-row staff-hr-switch-row"><div><strong>{completionText.insurance}</strong><span>{completionText.insuranceHelp}</span></div><input checked={hrSettings.social_insurance_enabled} role="switch" type="checkbox" onChange={(event) => setHrSettings({ ...hrSettings, social_insurance_enabled: event.target.checked })} /></label>
                          <div className="staff-hr-salary-rates">
                            <label>{text.labels.employeeContributionRate}<input min={0} step="0.1" type="number" value={hrSettings.employee_contribution_rate} onChange={(event) => setHrSettings({ ...hrSettings, employee_contribution_rate: Number(event.target.value) || 0 })} /></label>
                            <label>{text.labels.employerContributionRate}<input min={0} step="0.1" type="number" value={hrSettings.employer_contribution_rate} onChange={(event) => setHrSettings({ ...hrSettings, employer_contribution_rate: Number(event.target.value) || 0 })} /></label>
                            <label>{text.labels.pitWithholdingRate}<input min={0} step="0.1" type="number" value={hrSettings.pit_withholding_rate} onChange={(event) => setHrSettings({ ...hrSettings, pit_withholding_rate: Number(event.target.value) || 0 })} /></label>
                          </div>
                          <div className="staff-hr-settings-actions">
                            <span>{completionText.lastSync}: {hrSettings.last_auto_payroll_sync_on || completionText.never}</span>
                            <button disabled={saving} type="button" onClick={() => void syncPayrollDraft()}><RefreshCw aria-hidden="true" size={16} />{completionText.syncNow}</button>
                            <button className="primary" disabled={saving} type="button" onClick={() => void saveHrSettings()}><Save aria-hidden="true" size={16} />{text.actions.saveHrSettings}</button>
                          </div>
                        </fieldset>
                      )}

                      {settingsSection === 'work_rest' && (
                        <fieldset className="staff-readonly-fieldset staff-hr-reference-settings" disabled={!canManageAttendance}>
                          <div className="staff-hr-settings-panel-title"><div><h4>{completionText.workRestTitle}</h4></div></div>
                          <div className="staff-hr-work-rest-grid">
                            <label>{completionText.weekStarts}<select value={attendanceSettings.work_week_start} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, work_week_start: Number(event.target.value) })}>{completionText.days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
                            <label>{completionText.standardWeek}<input min={0} step="0.25" type="number" value={attendanceSettings.standard_weekly_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, standard_weekly_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                            <label>{completionText.standardBreak}<input min={0} type="number" value={attendanceSettings.standard_break_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, standard_break_minutes: Number(event.target.value) || 0 })} /></label>
                            <label>{completionText.annualLeave}<input min={0} step="0.5" type="number" value={attendanceSettings.annual_leave_days} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, annual_leave_days: Number(event.target.value) || 0 })} /></label>
                            <label>{completionText.monthlyDays}<input min={1} step="0.5" type="number" value={hrSettings.standard_monthly_days} onChange={(event) => setHrSettings({ ...hrSettings, standard_monthly_days: Number(event.target.value) || 26 })} /></label>
                            <label>{completionText.monthlyHours}<input min={1} step="0.5" type="number" value={hrSettings.standard_monthly_hours} onChange={(event) => setHrSettings({ ...hrSettings, standard_monthly_hours: Number(event.target.value) || 208 })} /></label>
                            <label>{completionText.minimumRest}<input min={0} step="0.25" type="number" value={Number((hrSettings.rest_period_minutes / 60).toFixed(2))} onChange={(event) => setHrSettings({ ...hrSettings, rest_period_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                            <label>{completionText.overtimeMonth}<input min={0} step="0.25" type="number" value={attendanceSettings.overtime_monthly_cap_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_monthly_cap_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                            <label>{completionText.overtimeYear}<input min={0} step="0.25" type="number" value={attendanceSettings.overtime_yearly_cap_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_yearly_cap_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                            <label>{text.labels.normalOvertimeMultiplier}<input min={0} step="0.05" type="number" value={hrSettings.normal_overtime_multiplier} onChange={(event) => setHrSettings({ ...hrSettings, normal_overtime_multiplier: Number(event.target.value) || 0 })} /></label>
                            <label>{text.labels.nightOvertimeMultiplier}<input min={0} step="0.05" type="number" value={hrSettings.night_overtime_multiplier} onChange={(event) => setHrSettings({ ...hrSettings, night_overtime_multiplier: Number(event.target.value) || 0 })} /></label>
                            <label>{text.labels.holidayOvertimeMultiplier}<input min={0} step="0.05" type="number" value={hrSettings.holiday_overtime_multiplier} onChange={(event) => setHrSettings({ ...hrSettings, holiday_overtime_multiplier: Number(event.target.value) || 0 })} /></label>
                          </div>
                          <div className="staff-hr-rest-days"><strong>{completionText.restDays}</strong>{completionText.days.map((day, index) => <label key={day}><input checked={attendanceSettings.weekly_rest_days.includes(index)} type="checkbox" onChange={(event) => setAttendanceSettings({ ...attendanceSettings, weekly_rest_days: event.target.checked ? [...new Set([...attendanceSettings.weekly_rest_days, index])].sort() : attendanceSettings.weekly_rest_days.filter((value: number) => value !== index) })} />{day}</label>)}</div>
                          <div className="staff-hr-settings-actions"><button disabled={saving} type="button" onClick={() => void saveAttendanceSettings()}><Save aria-hidden="true" size={16} />{text.actions.saveRules}</button><button className="primary" disabled={saving} type="button" onClick={() => void saveHrSettings()}><Save aria-hidden="true" size={16} />{text.actions.saveHrSettings}</button></div>
                        </fieldset>
                      )}

                      {(settingsSection === 'categories' || settingsSection === 'organization') && (
                        <div className="staff-hr-option-settings">
                          <div className="staff-hr-settings-panel-title"><div><h4>{settingsSection === 'categories' ? completionText.categoriesTitle : completionText.organizationTitle}</h4><p>{settingsSection === 'categories' ? completionText.categoriesHelp : completionText.organizationHelp}</p></div></div>
                          {(settingsSection === 'categories' ? ['payroll_template', 'allowance', 'deduction'] : ['location', 'department', 'job_title', 'contract_status', 'contract_type', 'employment_type']).map((optionType) => (
                            <div className="staff-hr-option-row" key={optionType}>
                              <div><strong>{text.hrSetupOptionTypes[optionType]}</strong><p>{(hrOptionsByType.get(optionType) || []).map((option: any) => option.name).join(' · ') || completionText.noOptions}</p></div>
                              <label><input value={hrSetupForm[optionType]} onChange={(event) => setHrSetupForm((current: any) => ({ ...current, [optionType]: event.target.value }))} /><button disabled={saving || !hrSetupForm[optionType].trim() || !canManageAttendance} type="button" onClick={() => void saveHrSetupOption(optionType)}><Plus aria-hidden="true" size={15} />{completionText.add}</button></label>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
                </div>
              </div>
            </>
          )}
        </div>

  )
}
