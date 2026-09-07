'use client'

import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Coins,
  ReceiptText,
  Settings2,
  Smartphone,
  UserRound,
  WalletCards
} from 'lucide-react'
import { type ReactNode } from 'react'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import type { StaffHrModel } from '../../lib/staff/hrModel'
import type {
  StaffEmployeeProfile,
  StaffLeaveRequest
} from '../../lib/staff/types'

export type StaffHrHubProps = {
  model: StaffHrModel
}

export type HrSettingsSection = 'initialization' | 'clocking' | 'salary' | 'work_rest' | 'categories' | 'organization'

export type StaffScheduleViewMode = 'employee' | 'shift'

export type EmployeeProfileSectionId = 'identity' | 'contract' | 'payroll' | 'bank' | 'contact' | 'store' | 'documents'

export type EmployeeDirectoryStatus = 'all' | 'active' | 'terminated'

export type StaffPeriodRangePickerProps = {
  end: string
  endLabel: string
  onEndChange: (value: string) => void
  onStartChange: (value: string) => void
  PickerField: typeof StaffPickerField
  start: string
  startLabel: string
}

export function StaffPeriodRangePicker({
  end,
  endLabel,
  onEndChange,
  onStartChange,
  PickerField,
  start,
  startLabel,
}: StaffPeriodRangePickerProps) {
  return (
    <div className="staff-hr-period-picker" role="group">
      <CalendarDays aria-hidden="true" size={18} />
      <label>
        <span>{startLabel}</span>
        <PickerField ariaLabel={startLabel} type="date" value={start} onChange={onStartChange} />
      </label>
      <span aria-hidden="true">–</span>
      <label>
        <span>{endLabel}</span>
        <PickerField ariaLabel={endLabel} type="date" value={end} onChange={onEndChange} />
      </label>
    </div>
  )
}

export function leaveDateRangeTitle(
  leaves: StaffLeaveRequest[],
  periodStart: string,
  periodEnd: string,
  formatDate: (value: string) => string,
) {
  return leaves.map((leave) => {
    const start = leave.start_date < periodStart ? periodStart : leave.start_date
    const end = leave.end_date > periodEnd ? periodEnd : leave.end_date
    return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
  }).join('\n')
}

export function employeeMatchesDirectoryFilters(
  employee: StaffEmployeeProfile | undefined,
  groupFilter: string,
  locationFilter: string,
  statusFilter: EmployeeDirectoryStatus,
  unassignedLabel: string,
) {
  const group = String(employee?.department || '').trim() || unassignedLabel
  const location = String(employee?.main_work_location || '').trim() || unassignedLabel
  const terminated = employee?.active === false || employee?.contract_status === 'ended'
  const matchesStatus = statusFilter === 'all' || (statusFilter === 'terminated' ? terminated : !terminated)
  return matchesStatus
    && (groupFilter === 'all' || group === groupFilter)
    && (locationFilter === 'all' || location === locationFilter)
}

export const employeeExperienceCopy = {
  en: {
    collapseAll: 'Collapse all',
    createEmployee: 'Create employee',
    createHelp: 'Create a private HR record, then complete the employee details.',
    createIntro: 'This creates an internal HR record only—no player profile, login, or account invitation. Store PIN access is available only to employees in the VRena or Manager group.',
    created: 'HR record created. Complete the employee’s identity and employment details.',
    creating: 'Creating employee…',
    employeeProfiles: 'Employee profiles',
    employeeProfilesHelp: 'Choose an employee, expand only the details you need, then save once.',
    employeePicker: 'Employee',
    selectEmployee: 'Select an employee',
    groupFilter: 'Group',
    locationFilter: 'Location',
    statusFilter: 'Employment status',
    allGroups: 'All groups',
    allLocations: 'All locations',
    allStatuses: 'All statuses',
    activeStatus: 'Active',
    terminatedStatus: 'Terminated / inactive',
    resetFilters: 'Reset filters',
    unassigned: 'Unassigned',
    noEmployeeMatches: 'No employees match these filters.',
    showingEmployees: (shown: number, total: number) => `${shown} of ${total} employees`,
    employmentType: 'Employment type',
    laborPayrollType: 'Labor payroll type',
    probationPayrollType: 'Probation payroll type',
    hourly: 'Hourly',
    monthly: 'Monthly',
    manager: 'Manager',
    probationSalaryPercentage: 'Probation salary',
    probationBonusPercentage: 'Probation bonus',
    probationStart: 'Probation start',
    probationEnd: 'Probation end',
    laborStart: 'Labor start',
    laborEnd: 'Labor end',
    companyPolicy: 'Company payroll policy',
    companyPolicyHelp: 'Meal allowance, minimum rest, overtime and insurance rates come from HR Settings. Insurance applies only when this employee is enrolled.',
    monthlyBonus: 'Recurring monthly bonus',
    insuranceEnrolled: 'Social insurance enrolled',
    insuranceSalary: 'Insurance salary base',
    emergencyName: 'Emergency contact name',
    emergencyRelationship: 'Relationship',
    emergencyPhone: 'Emergency phone',
    driveFolder: 'Google Drive employee folder',
    driveFolderHelp: 'Open',
    expandAll: 'Expand all',
    fullName: 'Full name',
    saveRecord: 'Create HR record',
    phone: 'Phone (optional)',
    sectionHelp: {
      identity: 'Identity, attendance, and legal information',
      contract: 'Role, workplace, employment, and dates',
      payroll: 'Pay rate, allowances, rest, and overtime',
      bank: 'Contributions, tax, insurance, and bank details',
      contact: 'Personal contact and internal payroll notes',
      store: 'Shared-device role and personal six-digit PIN',
      documents: 'Google Drive folder and HR attachments',
    } satisfies Record<EmployeeProfileSectionId, string>,
    sectionTitles: {
      identity: 'Private employee profile',
      contract: 'Employment & contract',
      payroll: 'Pay & overtime',
      bank: 'Tax, insurance & bank',
      contact: 'Contact & notes',
      store: 'Store access',
      documents: 'Documents',
    } satisfies Record<EmployeeProfileSectionId, string>,
    workEmail: 'Email (optional)',
  },
  vi: {
    collapseAll: 'Thu gọn tất cả',
    createEmployee: 'Tạo nhân viên',
    createHelp: 'Tạo hồ sơ HR riêng tư, sau đó hoàn thiện thông tin nhân viên.',
    createIntro: 'Thao tác này chỉ tạo hồ sơ HR nội bộ—không tạo hồ sơ người chơi, tài khoản đăng nhập hoặc gửi lời mời. PIN thiết bị cửa hàng chỉ dành cho nhân viên thuộc nhóm VRena hoặc Manager.',
    created: 'Đã tạo hồ sơ HR. Hãy hoàn thiện thông tin danh tính và việc làm.',
    creating: 'Đang tạo nhân viên…',
    employeeProfiles: 'Hồ sơ nhân viên',
    employeeProfilesHelp: 'Chọn nhân viên, chỉ mở phần cần chỉnh sửa rồi lưu một lần.',
    employeePicker: 'Nhân viên',
    selectEmployee: 'Chọn nhân viên',
    groupFilter: 'Nhóm',
    locationFilter: 'Địa điểm',
    statusFilter: 'Tình trạng làm việc',
    allGroups: 'Tất cả nhóm',
    allLocations: 'Tất cả địa điểm',
    allStatuses: 'Tất cả trạng thái',
    activeStatus: 'Đang làm việc',
    terminatedStatus: 'Đã nghỉ / không hoạt động',
    resetFilters: 'Đặt lại bộ lọc',
    unassigned: 'Chưa phân loại',
    noEmployeeMatches: 'Không có nhân viên phù hợp với bộ lọc.',
    showingEmployees: (shown: number, total: number) => `${shown} / ${total} nhân viên`,
    employmentType: 'Hình thức làm việc',
    laborPayrollType: 'Hình thức lương chính thức',
    probationPayrollType: 'Hình thức lương thử việc',
    hourly: 'Theo giờ',
    monthly: 'Theo tháng',
    manager: 'Quản lý',
    probationSalaryPercentage: 'Tỷ lệ lương thử việc',
    probationBonusPercentage: 'Tỷ lệ thưởng thử việc',
    probationStart: 'Bắt đầu thử việc',
    probationEnd: 'Kết thúc thử việc',
    laborStart: 'Bắt đầu hợp đồng lao động',
    laborEnd: 'Kết thúc hợp đồng lao động',
    companyPolicy: 'Chính sách lương công ty',
    companyPolicyHelp: 'Phụ cấp ăn, nghỉ tối thiểu, tăng ca và tỷ lệ bảo hiểm được lấy từ Cài đặt HR. Bảo hiểm chỉ áp dụng khi nhân viên được đăng ký.',
    monthlyBonus: 'Thưởng hàng tháng cố định',
    insuranceEnrolled: 'Đã tham gia bảo hiểm xã hội',
    insuranceSalary: 'Mức lương đóng bảo hiểm',
    emergencyName: 'Tên người liên hệ khẩn cấp',
    emergencyRelationship: 'Mối quan hệ',
    emergencyPhone: 'Điện thoại khẩn cấp',
    driveFolder: 'Thư mục nhân viên Google Drive',
    driveFolderHelp: 'Mở',
    expandAll: 'Mở tất cả',
    fullName: 'Họ và tên',
    saveRecord: 'Tạo hồ sơ HR',
    phone: 'Điện thoại (không bắt buộc)',
    sectionHelp: {
      identity: 'Danh tính, chấm công và thông tin pháp lý',
      contract: 'Vai trò, nơi làm việc, hình thức và ngày hợp đồng',
      payroll: 'Mức lương, phụ cấp, nghỉ và tăng ca',
      bank: 'Đóng góp, thuế, bảo hiểm và ngân hàng',
      contact: 'Liên hệ cá nhân và ghi chú nội bộ',
      store: 'Vai trò thiết bị dùng chung và PIN 6 số',
      documents: 'Thư mục Google Drive và tài liệu HR',
    } satisfies Record<EmployeeProfileSectionId, string>,
    sectionTitles: {
      identity: 'Hồ sơ nhân viên riêng tư',
      contract: 'Việc làm & hợp đồng',
      payroll: 'Lương & tăng ca',
      bank: 'Thuế, bảo hiểm & ngân hàng',
      contact: 'Liên hệ & ghi chú',
      store: 'Quyền truy cập cửa hàng',
      documents: 'Tài liệu',
    } satisfies Record<EmployeeProfileSectionId, string>,
    workEmail: 'Email (không bắt buộc)',
  },
} as const

export const accountantWorkspaceCopy = {
  en: {
    title: 'Payroll & compliance',
    subtitle: 'One guided workflow from employee records to an accountant-ready workbook.',
    download: 'Download accountant Excel',
    downloading: 'Preparing accountant Excel…',
    downloadWait: 'Download can take up to 3 minutes. Do not close this page.',
    readiness: 'Payroll readiness',
    ready: 'Ready',
    review: 'Review',
    formulaNote: 'Every calculated amount remains a live Excel formula so your accountant can trace and test it.',
    includesTitle: 'Export includes',
    includes: ['Instructions', 'Summary', 'Employee master', 'Contract checks', 'Attendance', 'Leave requests', 'Leave balance', 'Adjustments', 'Payroll formulas', 'Payslips', 'Bank transfer', 'Reconciliation', 'Calculation basis'],
    policyTitle: '2026 Vietnam payroll policy',
    policies: ['5-band PIT', '15.5M self deduction', '6.2M / dependent', '10.5% employee insurance', '21.5% employer insurance'],
    steps: {
      employees: ['Employee records', 'Identity, contract, salary, tax, and bank data'],
      attendance: ['Attendance & leave', 'Approve time records and paid leave'],
      policy: ['Payroll policy', 'Review company rules and employee eligibility'],
      reconcile: ['Reconcile & export', 'Resolve missing bank and payroll controls'],
    },
    checks: {
      employees: 'Employee master', contracts: 'Contract checks', attendance: 'Attendance approval', bank: 'Bank details', payroll: 'Payroll reconciliation',
    },
    issueLabels: { employees: 'employee records incomplete', attendance: 'attendance rows pending', bank: 'bank details missing' },
  },
  vi: {
    title: 'Bảng lương & tuân thủ',
    subtitle: 'Một quy trình hướng dẫn từ hồ sơ nhân viên đến file Excel sẵn sàng cho kế toán.',
    download: 'Tải Excel cho kế toán',
    downloading: 'Đang chuẩn bị Excel cho kế toán…',
    downloadWait: 'Quá trình tải xuống có thể mất đến 3 phút. Vui lòng không đóng trang này.',
    readiness: 'Mức độ sẵn sàng',
    ready: 'Sẵn sàng',
    review: 'Cần kiểm tra',
    formulaNote: 'Mọi số tiền tính toán đều là công thức Excel để kế toán có thể truy vết và kiểm tra.',
    includesTitle: 'Nội dung file xuất',
    includes: ['Hướng dẫn', 'Tổng hợp', 'Hồ sơ nhân viên', 'Kiểm tra hợp đồng', 'Chấm công', 'Đơn nghỉ phép', 'Số dư phép', 'Điều chỉnh', 'Công thức lương', 'Phiếu lương', 'Chuyển khoản', 'Đối chiếu', 'Cơ sở tính'],
    policyTitle: 'Chính sách lương Việt Nam 2026',
    policies: ['PIT 5 bậc', 'Giảm trừ bản thân 15,5M', '6,2M / người phụ thuộc', 'BH người lao động 10,5%', 'BH doanh nghiệp 21,5%'],
    steps: {
      employees: ['Hồ sơ nhân viên', 'Danh tính, hợp đồng, lương, thuế và ngân hàng'],
      attendance: ['Chấm công & nghỉ phép', 'Duyệt chấm công và nghỉ hưởng lương'],
      policy: ['Chính sách lương', 'Kiểm tra quy định công ty và điều kiện nhân viên'],
      reconcile: ['Đối chiếu & xuất file', 'Xử lý thiếu ngân hàng và kiểm soát lương'],
    },
    checks: {
      employees: 'Danh sách nhân viên', contracts: 'Kiểm tra hợp đồng', attendance: 'Duyệt chấm công', bank: 'Thông tin ngân hàng', payroll: 'Đối chiếu lương',
    },
    issueLabels: { employees: 'hồ sơ chưa hoàn tất', attendance: 'dòng chấm công chờ duyệt', bank: 'thiếu thông tin ngân hàng' },
  },
} as const

export const payslipSelectorCopy = {
  en: {
    allGroups: 'All groups',
    allLocations: 'All shop locations',
    employee: 'Employee',
    group: 'Employee group',
    location: 'Shop location',
    noEmployees: 'No employees match this group and shop location.',
    result: 'employee available',
    results: 'employees available',
  },
  vi: {
    allGroups: 'Tất cả nhóm',
    allLocations: 'Tất cả địa điểm',
    employee: 'Nhân viên',
    group: 'Nhóm nhân viên',
    location: 'Địa điểm cửa hàng',
    noEmployees: 'Không có nhân viên phù hợp với nhóm và địa điểm này.',
    result: 'nhân viên phù hợp',
    results: 'nhân viên phù hợp',
  },
} as const

export function CollapsibleEmployeeSection({
  children,
  description,
  id,
  onToggle,
  open,
  title,
}: {
  children: ReactNode
  description: string
  id: EmployeeProfileSectionId
  onToggle: (id: EmployeeProfileSectionId) => void
  open: boolean
  title: string
}) {
  const contentId = `staff-employee-section-${id}`
  return (
    <section className={`staff-hr-form-section staff-hr-collapsible-section ${open ? 'is-open' : ''}`}>
      <button aria-controls={contentId} aria-expanded={open} className="staff-hr-section-toggle" type="button" onClick={() => onToggle(id)}>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <ChevronDown aria-hidden="true" size={19} />
      </button>
      <div className="staff-hr-section-content" hidden={!open} id={contentId}>{children}</div>
    </section>
  )
}

export const staffScheduleCopy = {
  en: {
    add: 'Add',
    addShift: 'Add shift',
    byEmployee: 'By employee',
    byEmployeeHelp: 'Scan each person’s week and fill open days.',
    byShift: 'By shift',
    byShiftHelp: 'Compare coverage for each saved shift template.',
    customShift: 'Custom shift',
    customShiftHelp: 'Assignments outside saved shift templates',
    drafts: 'Drafts',
    scheduledEmployees: 'Scheduled employees',
    scheduledShifts: 'Scheduled shifts',
    shiftEditor: 'Shift editor',
    shiftEditorHelp: 'Choose a calendar cell to prefill the employee, date, and shift times.',
    viewScheduleBy: 'View schedule by',
    week: 'Week',
  },
  vi: {
    add: 'Thêm',
    addShift: 'Thêm ca',
    byEmployee: 'Theo nhân viên',
    byEmployeeHelp: 'Xem nhanh tuần của từng người và bổ sung ngày còn trống.',
    byShift: 'Theo ca',
    byShiftHelp: 'So sánh mức độ phủ của từng mẫu ca đã lưu.',
    customShift: 'Ca tùy chỉnh',
    customShiftHelp: 'Lịch ngoài các mẫu ca đã lưu',
    drafts: 'Bản nháp',
    scheduledEmployees: 'Nhân viên có lịch',
    scheduledShifts: 'Ca đã xếp',
    shiftEditor: 'Chỉnh sửa ca',
    shiftEditorHelp: 'Chọn một ô lịch để điền sẵn nhân viên, ngày và giờ làm.',
    viewScheduleBy: 'Xem lịch theo',
    week: 'Tuần',
  },
} as const

export const hrCompletionCopy = {
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
    paidLeave: 'Paid leave',
    unpaidLeave: 'Unpaid leave',
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
    paidLeave: 'Nghỉ có lương',
    unpaidLeave: 'Nghỉ không lương',
    lateArrival: 'Đi trễ',
    earlyLeave: 'Về sớm',
    shifts: 'ca',
    occurrences: 'lần',
    noAttendance: 'Không có dữ liệu chấm công trong kỳ này.',
    days: ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
  },
} as const

export function hrModuleIcon(tab: string) {
  if (tab === 'employees') return <UserRound aria-hidden="true" size={18} />
  if (tab === 'schedule') return <CalendarDays aria-hidden="true" size={18} />
  if (tab === 'timesheet') return <Clock3 aria-hidden="true" size={18} />
  if (tab === 'payroll') return <ReceiptText aria-hidden="true" size={18} />
  if (tab === 'adjustments') return <Coins aria-hidden="true" size={18} />
  if (tab === 'advances') return <WalletCards aria-hidden="true" size={18} />
  if (tab === 'zalo') return <Smartphone aria-hidden="true" size={18} />
  return <Settings2 aria-hidden="true" size={18} />
}
