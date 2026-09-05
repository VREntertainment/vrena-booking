import type { RefObject } from 'react'
import type { LanguageCode } from '../i18n/languages'
import type { ProgressivePitBracket } from '../hrPayrollPolicy'
import type { StaffKioskOperator } from '../../components/StaffKioskGate'

export type StaffTab = 'new' | 'clientProfile' | 'today' | 'attendance' | 'hr' | 'games' | 'prices' | 'discounts' | 'roles' | 'restore' | 'orders' | 'report'

export type StaffTabGroupId = 'operate' | 'reports' | 'team' | 'setup' | 'admin'

export type StaffCommerceTab = 'discounts' | 'vouchers' | 'loyalty'

export type StaffAttendanceTab = 'schedule' | 'clock' | 'timesheet' | 'leave' | 'settings'

export type StaffHrTab = 'employees' | 'schedule' | 'timesheet' | 'payroll' | 'adjustments' | 'advances' | 'zalo' | 'settings'

export type StaffScheduleScope = 'all' | 'department' | 'mine'

export type StaffOperationScope = 'today' | 'past'

export type StaffRole = 'owner' | 'admin' | 'manager' | 'staff' | 'cashier' | 'viewer' | 'player' | 'employee'

export type StaffRoleSort = 'name_asc' | 'name_desc' | 'created_desc' | 'role_desc' | 'role_asc' | 'email_asc'

export type StaffReportChartMode = 'columns' | 'curves' | 'cheese'

export type StaffReportView = 'business' | 'players' | 'qr'

export type StaffReportRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_30' | 'last_60' | 'last_90'

export type AccountantExportFormat = 'excel' | 'csv'

export type StaffShiftTemplateId = 'opening' | 'afternoon' | 'evening' | 'full_day'

export type StaffShiftTemplate = {
  id: StaffShiftTemplateId
  start_time: string
  end_time: string
  break_minutes: string
  shift_role: string
}

export type StaffEmploymentType = 'full_time' | 'part_time' | 'contractor' | 'intern' | 'probation' | 'probation_full_time' | 'probation_part_time'

export type AccountantExportReportId =
  | 'sales_revenue'
  | 'einvoice_reconciliation'
  | 'payments_reconciliation'
  | 'refunds_adjustments'
  | 'discounts_vouchers'
  | 'daily_cash_closing'
  | 'expenses_purchases'
  | 'vat_input_output'
  | 'payroll_staff'
  | 'inventory_movement'
  | 'deferred_revenue_bookings'
  | 'accountant_journal'
  | 'audit_trail'

export type StaffPaymentMethod = 'cash' | 'bank_transfer'

export type StaffDiscountValueUnit = 'percentage' | 'fixed_amount'

export type StaffDiscountDayScope = 'all' | 'weekday' | 'weekend' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type StaffDiscountTicketType = 'all' | 'individual' | 'birthday' | 'corporate'

export type StaffAudience = 'family_friendly' | 'scary' | 'fun' | 'quest' | 'teamwork' | 'beginner_friendly' | 'competitive'

export type StaffGuideTextMap = Partial<Record<LanguageCode, string>>

export type PaymentSplitDraft = {
  id: string
  payment_method: StaffPaymentMethod
  amount: string
}

export type PaymentSplitPayload = {
  payment_method: StaffPaymentMethod
  amount: number
}

export type StaffProfile = {
  id: string
  created_at?: string | null
  full_name?: string | null
  nickname?: string | null
  email?: string | null
  phone?: string | null
  avatar_url?: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
  avatar_color?: string | null
  avatar_text_color?: string | null
  birthday?: string | null
  profile_motto?: string | null
  anonymous_mode?: boolean | null
  anonymous_callsign?: string | null
  role?: string | null
  loyalty_points_total?: number | null
  average_accuracy_override?: number | null
  best_escape_duration_seconds_override?: number | null
  total_projectiles_override?: number | null
  is_seed_demo?: boolean | null
  seed_batch?: string | null
}

export type StaffGame = {
  id: string
  slug: string
  name: string
  game_type: 'shooting' | 'escape' | 'tournament' | 'other'
  duration_minutes: number
  max_players_per_arena: number
  number_of_rounds: number
  escape_chapter_count?: number | null
  description: string | null
  difficulty?: string | null
  audience?: StaffAudience[] | string | null
  guide_language?: LanguageCode | null
  guide_summary?: StaffGuideTextMap | null
  guide_rules?: StaffGuideTextMap | null
  guide_tips?: StaffGuideTextMap | null
  image_url: string | null
  active: boolean
  available_arena_ids: string[]
}

export type StaffPriceRule = {
  id: string
  rule_name: string
  game_id: string | null
  day_type: 'weekday' | 'weekend' | 'holiday' | 'custom'
  time_start: string | null
  time_end: string | null
  price_per_player: number
  price_per_arena_slot: number | null
  valid_from: string
  valid_until: string | null
  active: boolean
}

export type StaffDiscount = {
  id: string
  code: string | null
  name: string
  game_id: string | null
  price_rule_id: string | null
  min_players: number | null
  max_players: number | null
  day_scope: StaffDiscountDayScope
  time_start: string | null
  time_end: string | null
  ticket_type: StaffDiscountTicketType
  min_order_total: number
  max_discount_amount: number | null
  per_customer_limit: number | null
  discount_type: 'percentage' | 'fixed_amount' | 'free_ticket' | 'birthday' | 'resident' | 'group'
  value: number
  valid_from: string
  valid_until: string | null
  max_uses: number | null
  used_count: number
  active: boolean
}

export type StaffLoyaltyRule = {
  id: string
  rule_name: string
  game_id: string | null
  calculation_type: 'per_vnd_spent' | 'per_booking' | 'per_player' | 'per_visit'
  points_value: number
  spend_amount: number
  min_order_total: number
  redeem_value_vnd_per_point: number
  earn_trigger: 'session_payment_confirmed'
  rounding_rule: 'floor_whole_points'
  point_expiry_days: number | null
  valid_from: string
  valid_until: string | null
  active: boolean
  notes: string | null
}

export type StaffShiftStatus = 'draft' | 'published' | 'completed' | 'cancelled'

export type StaffAttendanceStatus = 'present' | 'late' | 'absent' | 'no_show' | 'leave' | 'holiday'

export type StaffLeaveType = 'annual' | 'sick' | 'unpaid' | 'personal' | 'public_holiday'

export type StaffLeaveStatus = 'requested' | 'approved' | 'rejected' | 'cancelled'

export type StaffGender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say' | 'other'

export type StaffContractStatus = 'active' | 'probation' | 'suspended' | 'ended' | 'draft'

export type StaffHrSetupOptionType = 'department' | 'job_title' | 'location' | 'contract_status' | 'contract_type' | 'employment_type' | 'payroll_template' | 'allowance' | 'deduction'

export type StaffHrAdjustmentType = 'bonus' | 'commission' | 'allowance' | 'lunch_allowance' | 'deduction' | 'advance' | 'debt' | 'debt_repayment'

export type StaffHrAdjustmentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled'

export type StaffPayrollStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled'

export type StaffPayrollPayCycle = 'monthly' | 'semi_monthly' | 'weekly' | 'custom'

export type StaffHrDocumentType = 'profile_photo' | 'cv' | 'contract' | 'national_id' | 'payslip' | 'other'

export type StaffScheduleShift = {
  id: string
  staff_profile_id: string
  location: string
  shift_role: string
  shift_date: string
  start_time: string
  end_time: string
  break_minutes: number
  status: StaffShiftStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type StaffAttendanceLog = {
  id: string
  staff_profile_id: string
  shift_id: string | null
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  break_minutes: number
  status: StaffAttendanceStatus
  regular_minutes: number
  overtime_minutes: number
  night_minutes: number
  holiday_minutes: number
  late_minutes: number
  early_leave_minutes: number
  is_half_day: boolean
  approval_status: 'pending' | 'approved'
  approved_by: string | null
  approved_at: string | null
  manager_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type StaffLeaveRequest = {
  id: string
  staff_profile_id: string
  leave_type: StaffLeaveType
  start_date: string
  end_date: string
  hours: number
  reason: string | null
  status: StaffLeaveStatus
  requested_by: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type StaffEmployeeProfile = {
  profile_id: string
  employee_code: string | null
  attendance_number: string | null
  legal_name: string | null
  personal_phone: string | null
  personal_email: string | null
  national_id: string | null
  date_of_birth: string | null
  gender: StaffGender | null
  address: string | null
  department: string | null
  job_title: string | null
  employment_type: StaffEmploymentType
  main_work_location: string | null
  payroll_location: string | null
  contract_status: StaffContractStatus
  contract_type: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  probation_payroll_type: 'hourly' | 'monthly' | 'manager'
  labor_payroll_type: 'hourly' | 'monthly' | 'manager'
  probation_salary_percentage: number
  probation_bonus_percentage: number
  probation_start_date: string | null
  probation_end_date: string | null
  labor_start_date: string | null
  labor_end_date: string | null
  start_date: string | null
  end_date: string | null
  base_salary_vnd: number
  hourly_rate_vnd: number
  monthly_bonus_vnd: number
  lunch_allowance_vnd: number
  rest_period_minutes: number | null
  overtime_rate_multiplier: number | null
  night_rate_multiplier: number | null
  holiday_rate_multiplier: number | null
  employee_contribution_rate: number | null
  employer_contribution_rate: number | null
  pit_withholding_rate: number | null
  dependents_count: number
  bank_name: string | null
  bank_account_number: string | null
  tax_code: string | null
  social_insurance_number: string | null
  social_insurance_enrolled: boolean
  social_insurance_salary_vnd: number
  emergency_contact: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  google_drive_folder_url: string | null
  payroll_note: string | null
  profile_photo_path: string | null
  cv_document_path: string | null
  active: boolean
  kiosk_access_role: 'manager' | 'staff' | null
  kiosk_pin_configured_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type StaffAttendanceSettings = {
  id: string
  location: string
  standard_daily_minutes: number
  standard_weekly_minutes: number
  standard_break_minutes: number
  overtime_monthly_cap_minutes: number
  overtime_yearly_cap_minutes: number
  night_start: string
  night_end: string
  annual_leave_days: number
  half_day_enabled: boolean
  half_day_min_minutes: number
  half_day_max_minutes: number
  count_late_early_on_half_day: boolean
  late_arrival_enabled: boolean
  late_after_minutes: number
  early_leave_enabled: boolean
  early_leave_before_minutes: number
  overtime_before_shift_enabled: boolean
  overtime_before_shift_minutes: number
  overtime_after_shift_enabled: boolean
  overtime_after_shift_minutes: number
  single_clock_for_consecutive_shifts: boolean
  work_week_start: number
  weekly_rest_days: number[]
  shift_templates: StaffShiftTemplate[]
  updated_by: string | null
  updated_at: string | null
}

export type StaffHrSettings = {
  id: string
  currency: string
  standard_monthly_days: number
  standard_monthly_hours: number
  rest_period_minutes: number
  normal_overtime_multiplier: number
  night_overtime_multiplier: number
  holiday_overtime_multiplier: number
  lunch_allowance_vnd: number
  annual_leave_days: number
  employee_contribution_rate: number
  employer_contribution_rate: number
  pit_withholding_rate: number
  policy_version: string
  effective_from: string
  policy_status: 'draft' | 'active' | 'retired'
  legal_source_url: string | null
  legal_reviewed_on: string | null
  personal_deduction_vnd: number
  dependent_deduction_vnd: number
  short_term_pit_rate: number
  pit_brackets: ProgressivePitBracket[]
  employee_social_insurance_rate: number
  employee_health_insurance_rate: number
  employee_unemployment_insurance_rate: number
  employer_social_insurance_rate: number
  employer_health_insurance_rate: number
  employer_unemployment_insurance_rate: number
  employer_trade_union_rate: number
  night_work_bonus_rate: number
  night_overtime_extra_rate: number
  leave_accrual_days_per_month: number
  leave_qualifying_worked_days: number
  leave_join_cutoff_day: number
  leave_exit_cutoff_day: number
  leave_carry_forward_month: number
  leave_carry_forward_day: number
  pay_period_start_day: number
  auto_create_payroll_runs: boolean
  auto_update_payroll_daily: boolean
  personal_income_tax_enabled: boolean
  social_insurance_enabled: boolean
  last_auto_payroll_sync_on: string | null
  payslip_note: string | null
  updated_by: string | null
  updated_at: string | null
}

export type StaffHrSetupOption = {
  id: string
  option_type: StaffHrSetupOptionType
  name: string
  active: boolean
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type StaffHrAdjustment = {
  id: string
  profile_id: string
  payroll_run_id: string | null
  adjustment_type: StaffHrAdjustmentType
  title: string
  amount_vnd: number
  effective_date: string
  period_start: string | null
  period_end: string | null
  status: StaffHrAdjustmentStatus
  requires_validation: boolean
  validated_by: string | null
  validated_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type StaffPayrollRun = {
  id: string
  code: string
  name: string
  pay_cycle: StaffPayrollPayCycle
  period_start: string
  period_end: string
  status: StaffPayrollStatus
  total_gross_vnd: number
  total_net_vnd: number
  total_company_cost_vnd: number
  generated_by: string | null
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type StaffPayrollItem = {
  id: string
  payroll_run_id: string
  profile_id: string
  payslip_number: string | null
  worked_minutes: number
  regular_minutes: number
  overtime_minutes: number
  night_minutes: number
  holiday_minutes: number
  paid_leave_hours: number
  rest_warning_count: number
  base_salary_vnd: number
  overtime_pay_vnd: number
  allowances_vnd: number
  bonuses_vnd: number
  advances_vnd: number
  deductions_vnd: number
  employee_contributions_vnd: number
  employer_contributions_vnd: number
  pit_withholding_vnd: number
  gross_income_vnd: number
  net_income_vnd: number
  company_cost_vnd: number
  status: StaffPayrollStatus
  payslip_snapshot: Record<string, unknown>
  notes: string | null
  created_at: string
  updated_at: string
}

export type StaffPayrollSourceSnapshot = {
  id: string
  source_key: string
  source_name: string
  source_url: string | null
  period_start: string
  period_end: string
  employee_code: string
  employee_name: string
  division: string | null
  employment_status: string | null
  bank_name: string | null
  bank_account_number: string | null
  contract_rate_vnd: number
  worked_minutes: number | null
  worked_days: number | null
  basic_days: number | null
  paid_leave_days: number
  salary_paid_minutes: number
  overtime_minutes: number
  meal_days: number
  base_pay_vnd: number
  meal_allowance_vnd: number
  overtime_pay_vnd: number
  gross_income_vnd: number
  taxable_income_vnd: number
  pit_withheld_vnd: number
  employee_insurance_vnd: number
  net_payable_vnd: number
  leave_opening: number | null
  leave_accrual: number | null
  leave_used: number | null
  leave_closing: number | null
  leave_payout_vnd: number | null
  details: string | null
  source_payload: Record<string, unknown>
  imported_at: string
}

export type StaffHrDocument = {
  id: string
  profile_id: string
  document_type: StaffHrDocumentType
  file_name: string
  storage_bucket: string
  storage_path: string
  mime_type: string | null
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}

export type StaffPayrollCalculation = {
  profileId: string
  scheduledMinutes: number
  periodStandardMinutes: number
  periodStandardDays: number
  payrollBasis: 'published_schedule' | 'working_calendar'
  workedMinutes: number
  workedDays: number
  mealDays: number
  salaryPaidDays: number
  regularMinutes: number
  salaryPaidMinutes: number
  overtimeMinutes: number
  nightMinutes: number
  holidayMinutes: number
  paidLeaveHours: number
  paidLeaveDays: number
  leaveBalanceDays: number
  restWarningCount: number
  hourlyRate: number
  basePay: number
  overtimePay: number
  mealAllowance: number
  otherAllowances: number
  allowances: number
  bonuses: number
  advances: number
  deductions: number
  contributionBase: number
  employeeContributions: number
  employerContributions: number
  pitWithheld: number
  grossIncome: number
  netIncome: number
  companyCost: number
}

export type StaffOrder = {
  id: string
  order_number: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  game_id: string | null
  session_id: string | null
  booking_date: string
  booking_time: string
  players_count: number
  arena_id: string | null
  subtotal: number
  discount_rule_id: string | null
  discount_code: string | null
  discount_total: number
  total: number
  payment_method: string
  payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
  order_status: 'draft' | 'confirmed' | 'paid' | 'partially_paid' | 'cancelled' | 'refunded' | 'no_show' | 'completed'
  created_by: string | null
  created_at: string
  updated_at: string
  invoice_required: boolean
  company_name: string | null
  tax_code: string | null
  invoice_email: string | null
  invoice_address: string | null
  invoice_status: string
  external_invoice_id: string | null
  internal_note: string | null
}

export type StaffOrderEditDraft = {
  orderId: string
  gameId: string
  bookingDate: string
  bookingTime: string
  total: string
}

export type StaffOrderPayment = {
  id: string
  order_id: string
  payment_method: StaffPaymentMethod
  amount: number
  created_by: string | null
  created_at: string
}

export type StaffSessionParticipant = {
  id: string
  profile_id: string | null
  display_name?: string | null
  deleted_at?: string | null
  checked_in?: boolean | null
  payment_status?: string | null
  payment_amount?: number | null
  payment_splits?: unknown
  score?: number | null
  accuracy_percent?: number | null
  hits?: number | null
  movement_meters?: number | null
  projectiles_fired?: number | null
  escape_duration_seconds?: number | null
  placement?: number | null
  chapter_times?: Array<{
    chapter_number: number
    duration_seconds: number
    game_slug: string
  }> | null
}

export type StaffOperationSession = {
  id: string
  venue_key?: string | null
  owner_id: string | null
  name: string
  date: string
  start_time: string
  duration_minutes: number
  max_players: number
  arena_count: number | null
  game_options: string[] | null
  confirmed_game_id?: string | null
  visibility: 'public' | 'private'
  status: 'open' | 'cancelled' | 'completed'
  booking_type?: string | null
  ticket_type?: string | null
  ticket_player_count?: number | null
  ticket_total_price?: number | null
  ticket_status?: string | null
  ticket_reference?: string | null
  notes?: string | null
  session_participants?: StaffSessionParticipant[]
}

export type StaffDeleteSessionDraft = {
  session: StaffOperationSession
  order: StaffOrder | null
}

export type RoleSaveFeedback = {
  tone: 'saving' | 'success' | 'error'
  message: string
}

export type StaffProfileDeleteDraft = {
  profile: StaffProfile
  ban: boolean
  reason: string
  confirmation: string
}

export type StaffAuditLog = {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value?: unknown
  new_value?: unknown
  created_at: string
}

export type SoftDeletedRecord = {
  entity_table: string
  entity_id: string
  label: string | null
  deleted_at: string
  deleted_by: string | null
  delete_reason: string | null
  deleted_by_name?: string | null
  deleted_by_email?: string | null
  deleted_by_phone?: string | null
}

export type StaffDataKey = 'games' | 'prices' | 'discounts' | 'loyalty' | 'today' | 'todaySessions' | 'attendance' | 'hr' | 'orders' | 'profiles' | 'achievementAwards' | 'restore' | 'report' | 'qrReport'

export type StaffReportSummary = {
  totalSales: number
  totalPaid: number
  unpaidAmount: number
  cashTotal: number
  bankTransferTotal: number
  bookings: number
  players: number
  cancelled: number
  noShows: number
  discounts: number
  bestSellingGame: string
}

export type StaffDailyPoint = {
  date: string
  sales: number
  bookings: number
  players: number
}

export type StaffReportSnapshot = {
  report: StaffReportSummary
  comparisonReport: StaffReportSummary
  reportSeries: StaffDailyPoint[]
  comparisonSeries: StaffDailyPoint[]
  orders: StaffOrder[]
  comparisonOrders: StaffOrder[]
  payments: StaffOrderPayment[]
}

export type StaffWeekdayRevenuePoint = {
  key: string
  label: string
  sales: number
}

export type StaffHourlyRevenuePoint = {
  hour: number
  label: string
  sales: number
}

export type BookingForm = {
  guestBooking: boolean
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  gameId: string
  date: string
  time: string
  players: number
  arenaId: string
  discountId: string
  manualDiscountType: '' | 'fixed_amount' | 'percentage'
  manualDiscountValue: number
  paymentSplits: PaymentSplitDraft[]
  orderStatus: 'draft' | 'confirmed' | 'paid' | 'partially_paid' | 'cancelled' | 'refunded' | 'no_show' | 'completed'
  invoiceRequired: boolean
  companyName: string
  taxCode: string
  invoiceEmail: string
  invoiceAddress: string
  note: string
}

export type CustomerInviteForm = {
  fullName: string
  email: string
  phone: string
  nickname: string
}

export type CustomerTemporaryAccess = {
  expiresAt: string
  password: string
  phone: string
}

export type StaffConsoleProps = {
  profile: StaffProfile | null
  authEmail?: string
  language?: string
  mode?: 'staff' | 'hr'
  kioskOperator?: StaffKioskOperator | null
  onKioskLock?: () => void
  onOpenPlayerProfile?: (profile: StaffProfile) => void
  onOpenSessionCalendar?: (dateValue: string) => void
}

export type StaffConsoleLanguage = 'en' | 'vi'

export type StaffPickerFieldProps = {
  ariaLabel: string
  type: 'date' | 'time'
  value: string
  mode?: 'clock' | 'duration'
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
}
