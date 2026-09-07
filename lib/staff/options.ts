import type {
  AccountantExportFormat,
  AccountantExportReportId,
  StaffAttendanceStatus,
  StaffAttendanceTab,
  StaffAudience,
  StaffCommerceTab,
  StaffConsoleLanguage,
  StaffContractStatus,
  StaffDailyPoint,
  StaffDiscountDayScope,
  StaffDiscountTicketType,
  StaffEmploymentType,
  StaffGender,
  StaffHrAdjustmentStatus,
  StaffHrAdjustmentType,
  StaffHrSetupOptionType,
  StaffHrTab,
  StaffLeaveType,
  StaffOrder,
  StaffOrderPayment,
  StaffPayrollPayCycle,
  StaffPayrollStatus,
  StaffRole,
  StaffRoleSort,
  StaffShiftStatus,
  StaffTab,
  StaffTabGroupId,
} from './types.ts'

export const staffTabGroups: Array<{ id: StaffTabGroupId; tabs: StaffTab[] }> = [
  { id: 'operate', tabs: ['new', 'clientProfile', 'today', 'orders'] },
  { id: 'reports', tabs: ['report'] },
  { id: 'team', tabs: ['attendance', 'hr', 'roles'] },
  { id: 'setup', tabs: ['games', 'prices', 'discounts'] },
  { id: 'admin', tabs: ['restore'] },
]

export const emptyStaffOrders: StaffOrder[] = []

export const emptyStaffPayments: StaffOrderPayment[] = []

export const emptyStaffDailySeries: StaffDailyPoint[] = []

export const staffDiscountDayScopes: StaffDiscountDayScope[] = ['all', 'weekday', 'weekend', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const staffDiscountTicketTypes: StaffDiscountTicketType[] = ['all', 'individual', 'birthday', 'corporate']

export const accountantExportReports = [
  { id: 'sales_revenue', fileBase: 'Sales_Revenue_Report', label: { en: 'Sales revenue', vi: 'Doanh thu bán hàng' } },
  { id: 'einvoice_reconciliation', fileBase: 'EInvoice_Reconciliation', label: { en: 'E-invoice reconciliation', vi: 'Đối soát hóa đơn điện tử' } },
  { id: 'payments_reconciliation', fileBase: 'Payments_Reconciliation', label: { en: 'Payments reconciliation', vi: 'Đối soát thanh toán' } },
  { id: 'refunds_adjustments', fileBase: 'Refunds_Adjustments', label: { en: 'Refunds and adjustments', vi: 'Hoàn tiền và điều chỉnh' } },
  { id: 'discounts_vouchers', fileBase: 'Discounts_Vouchers', label: { en: 'Discounts and vouchers', vi: 'Ưu đãi và voucher' } },
  { id: 'daily_cash_closing', fileBase: 'Daily_Cash_Closing', label: { en: 'Daily cash closing', vi: 'Chốt quỹ hằng ngày' } },
  { id: 'expenses_purchases', fileBase: 'Expenses_Purchases', label: { en: 'Expenses and purchases', vi: 'Chi phí và mua hàng' } },
  { id: 'vat_input_output', fileBase: 'VAT_Input_Output_Summary', label: { en: 'VAT input/output summary', vi: 'Tóm tắt VAT đầu vào/đầu ra' } },
  { id: 'payroll_staff', fileBase: 'Payroll_Staff_Report', label: { en: 'Payroll and staff', vi: 'Lương và nhân sự' } },
  { id: 'inventory_movement', fileBase: 'Inventory_Movement', label: { en: 'Inventory movement', vi: 'Biến động tồn kho' } },
  { id: 'deferred_revenue_bookings', fileBase: 'Deferred_Revenue_Bookings', label: { en: 'Deferred revenue bookings', vi: 'Doanh thu chưa thực hiện' } },
  { id: 'accountant_journal', fileBase: 'Accountant_Journal_Export', label: { en: 'Accountant journal', vi: 'Bút toán kế toán' } },
  { id: 'audit_trail', fileBase: 'Audit_Trail', label: { en: 'Audit trail', vi: 'Nhật ký kiểm toán' } },
] satisfies Array<{
  id: AccountantExportReportId
  fileBase: string
  label: Record<StaffConsoleLanguage, string>
}>

export const accountantExportFormats: AccountantExportFormat[] = ['excel', 'csv']

export const accountantExportLanguages: StaffConsoleLanguage[] = ['vi', 'en']

export const accountantExportStores = [
  { id: 'all', label: { en: 'All stores', vi: 'Tất cả cơ sở' } },
  { id: 'vrena-vietnam', label: { en: 'VRena Vietnam', vi: 'VRena Vietnam' } },
] satisfies Array<{ id: string; label: Record<StaffConsoleLanguage, string> }>

export const paymentMethods = ['cash', 'bank_transfer'] as const

export const orderStatuses = ['draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed'] as const

export const gameTypes = ['shooting', 'escape', 'tournament', 'other'] as const

export const dayTypes = ['weekday', 'weekend', 'holiday', 'custom'] as const

export const discountTypes = ['percentage', 'fixed_amount', 'free_ticket', 'birthday', 'resident', 'group'] as const

export const loyaltyCalculationTypes = ['per_vnd_spent', 'per_booking', 'per_player', 'per_visit'] as const

export const staffCommerceTabs: StaffCommerceTab[] = ['discounts', 'vouchers', 'loyalty']

export const staffAttendanceTabs: StaffAttendanceTab[] = ['schedule', 'clock', 'timesheet', 'leave', 'settings']

export const staffHrTabs: StaffHrTab[] = ['employees', 'schedule', 'timesheet', 'payroll', 'adjustments', 'advances', 'zalo', 'settings']

export const staffShiftStatuses: StaffShiftStatus[] = ['draft', 'published', 'completed', 'cancelled']

export const staffAttendanceStatuses: StaffAttendanceStatus[] = ['present', 'late', 'absent', 'no_show', 'leave', 'holiday']

export const staffLeaveTypes: StaffLeaveType[] = ['annual', 'sick', 'unpaid', 'personal', 'public_holiday']

export const staffEmploymentTypes: StaffEmploymentType[] = ['full_time', 'part_time', 'probation_full_time', 'probation_part_time', 'contractor', 'intern']

export const staffGenderOptions: StaffGender[] = ['female', 'male', 'non_binary', 'prefer_not_to_say', 'other']

export const staffContractStatuses: StaffContractStatus[] = ['active', 'probation', 'suspended', 'ended', 'draft']

export const staffHrSetupOptionTypes: StaffHrSetupOptionType[] = ['location', 'department', 'job_title', 'contract_status', 'contract_type', 'employment_type', 'payroll_template', 'allowance', 'deduction']

export const staffHrAdjustmentTypes: StaffHrAdjustmentType[] = ['bonus', 'commission', 'allowance', 'lunch_allowance', 'deduction', 'advance', 'debt', 'debt_repayment']

export const staffHrAdjustmentStatuses: StaffHrAdjustmentStatus[] = ['draft', 'pending', 'approved', 'rejected', 'paid', 'cancelled']

export const staffPayrollStatuses: StaffPayrollStatus[] = ['draft', 'pending', 'approved', 'paid', 'cancelled']

export const staffPayrollPayCycles: StaffPayrollPayCycle[] = ['monthly', 'semi_monthly', 'weekly', 'custom']

export const assignableWebAppRoleOptions: StaffRole[] = ['owner', 'admin', 'cashier', 'viewer', 'player']

export const roleFilterOptions: Array<StaffRole | 'all'> = ['all', 'owner', 'admin', 'cashier', 'viewer', 'employee', 'player']

export const roleSortOptions: StaffRoleSort[] = ['name_asc', 'name_desc', 'created_desc', 'role_desc', 'role_asc', 'email_asc']

export const staffProfileSelect = 'id, created_at, full_name, nickname, email, phone, role, loyalty_points_total, average_accuracy_override, best_escape_duration_seconds_override, total_projectiles_override, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, anonymous_mode, anonymous_callsign, birthday, is_seed_demo, seed_batch'

export const staffProfileAvatarSelect = 'id, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, anonymous_mode, anonymous_callsign'

export const staffGameImageBucket = 'staff-game-images'

export const staffGameImageMaxBytes = 2 * 1024 * 1024

export const staffGameImageTypes = ['image/jpeg', 'image/png', 'image/webp']

export const staffHrDocumentBucket = 'staff-hr-documents'

export const staffProfilePhotoMaxBytes = 2 * 1024 * 1024

export const staffCvMaxBytes = 10 * 1024 * 1024

export const staffProfilePhotoTypes = ['image/jpeg', 'image/png', 'image/webp']

export const staffCvTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

export const staffAudienceOptions: StaffAudience[] = [
  'family_friendly',
  'scary',
  'fun',
  'quest',
  'teamwork',
  'beginner_friendly',
  'competitive',
]

export const staffArenaOptions = [
  { id: 'arena-1', label: 'Arena 1' },
  { id: 'arena-2', label: 'Arena 2' },
]

export const defaultStaffArenaIds = staffArenaOptions.map((arena) => arena.id)
