'use client'

import dynamic from 'next/dynamic'
import NextImage from 'next/image'
import {
  Ban,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  UserX,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode, RefObject } from 'react'
import { languageOptions, type LanguageCode } from '../lib/i18n/languages'
import { uiText } from '../lib/i18n/translations'
import { RATE_LIMITS, type RateLimitAction } from '../lib/security/rateLimit'
import { isStaffAdminEmail as isAdminEmail, isStaffAdminOnlyEmail as isAdminOnlyEmail, isStaffOwnerEmail as isOwnerEmail, staffConsoleRoleRank as staffRank } from '../lib/staffRoles'
import { staffAchievementAwardById, staffAchievementAwardCatalog } from '../lib/staffAchievementAwards'
import { supabase } from '../lib/supabase/client'
import { notifyBookingUpdateEmail } from '../lib/bookingUpdateNotificationClient'
import { vrenaPalette } from '../lib/theme/vrenaPalette'
import StaffAchievementAwardPanel, { type StaffAchievementAward } from './StaffAchievementAwardPanel'
import AppLoadingState from './AppLoadingState'
import { PhoneNumberInput } from './CountryCodePicker'

const StaffReportDateRangeModal = dynamic(() => import('./StaffReportDateRangeModal'), {
  ssr: false,
})

const StaffHrHub = dynamic(() => import('./StaffHrHub'), {
  ssr: false,
})

type StaffTab = 'new' | 'clientProfile' | 'today' | 'attendance' | 'hr' | 'games' | 'prices' | 'discounts' | 'roles' | 'restore' | 'orders' | 'report'
type StaffTabGroupId = 'operate' | 'reports' | 'team' | 'setup' | 'admin'
type StaffCommerceTab = 'discounts' | 'vouchers' | 'loyalty'
type StaffAttendanceTab = 'schedule' | 'clock' | 'timesheet' | 'leave' | 'settings'
type StaffHrTab = 'employees' | 'schedule' | 'timesheet' | 'payroll' | 'adjustments' | 'advances' | 'settings'
type StaffScheduleScope = 'all' | 'department' | 'mine'
type StaffOperationScope = 'today' | 'past'
type StaffRole = 'owner' | 'admin' | 'manager' | 'staff' | 'cashier' | 'viewer' | 'player'
type StaffRoleSort = 'name_asc' | 'name_desc' | 'created_desc' | 'role_desc' | 'role_asc' | 'email_asc'
type StaffReportChartMode = 'columns' | 'curves' | 'cheese'
type StaffReportRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_30' | 'last_60' | 'last_90'
type AccountantExportFormat = 'excel' | 'csv'
type StaffShiftTemplateId = 'opening' | 'afternoon' | 'evening' | 'full_day'
type StaffShiftTemplate = {
  id: StaffShiftTemplateId
  start_time: string
  end_time: string
  break_minutes: string
  shift_role: string
}
type StaffEmploymentType = 'full_time' | 'part_time' | 'contractor' | 'intern' | 'probation' | 'probation_full_time' | 'probation_part_time'
type AccountantExportReportId =
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
type StaffPaymentMethod = 'cash' | 'bank_transfer'
type StaffDiscountValueUnit = 'percentage' | 'fixed_amount'
type StaffDiscountDayScope = 'all' | 'weekday' | 'weekend' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type StaffDiscountTicketType = 'all' | 'individual' | 'birthday' | 'corporate'
type StaffAudience = 'family_friendly' | 'scary' | 'fun' | 'quest' | 'teamwork' | 'beginner_friendly' | 'competitive'
type StaffGuideTextMap = Partial<Record<LanguageCode, string>>
type PaymentSplitDraft = {
  id: string
  payment_method: StaffPaymentMethod
  amount: string
}
type PaymentSplitPayload = {
  payment_method: StaffPaymentMethod
  amount: number
}

function ButtonIconText({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <span className="button-icon-text">
      {icon}
      <span>{children}</span>
    </span>
  )
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

type StaffGame = {
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

type StaffPriceRule = {
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

type StaffDiscount = {
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

type StaffLoyaltyRule = {
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

type StaffShiftStatus = 'draft' | 'published' | 'completed' | 'cancelled'
type StaffAttendanceStatus = 'present' | 'late' | 'absent' | 'no_show' | 'leave' | 'holiday'
type StaffLeaveType = 'annual' | 'sick' | 'unpaid' | 'personal' | 'public_holiday'
type StaffLeaveStatus = 'requested' | 'approved' | 'rejected' | 'cancelled'
type StaffGender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say' | 'other'
type StaffContractStatus = 'active' | 'probation' | 'suspended' | 'ended' | 'draft'
type StaffHrSetupOptionType = 'department' | 'job_title' | 'location' | 'contract_status' | 'contract_type' | 'employment_type'
type StaffHrAdjustmentType = 'bonus' | 'commission' | 'allowance' | 'lunch_allowance' | 'deduction' | 'advance' | 'debt' | 'debt_repayment'
type StaffHrAdjustmentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled'
type StaffPayrollStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled'
type StaffPayrollPayCycle = 'monthly' | 'semi_monthly' | 'weekly' | 'custom'
type StaffHrDocumentType = 'profile_photo' | 'cv' | 'contract' | 'national_id' | 'payslip' | 'other'

type StaffScheduleShift = {
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

type StaffAttendanceLog = {
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
  manager_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type StaffLeaveRequest = {
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

type StaffEmployeeProfile = {
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
  start_date: string | null
  end_date: string | null
  base_salary_vnd: number
  hourly_rate_vnd: number
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
  emergency_contact: string | null
  payroll_note: string | null
  profile_photo_path: string | null
  cv_document_path: string | null
  active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

type StaffAttendanceSettings = {
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
  shift_templates: StaffShiftTemplate[]
  updated_by: string | null
  updated_at: string | null
}

type StaffHrSettings = {
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
  payslip_note: string | null
  updated_by: string | null
  updated_at: string | null
}

type StaffHrSetupOption = {
  id: string
  option_type: StaffHrSetupOptionType
  name: string
  active: boolean
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

type StaffHrAdjustment = {
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

type StaffPayrollRun = {
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

type StaffPayrollItem = {
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

type StaffHrDocument = {
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

type StaffPayrollCalculation = {
  profileId: string
  scheduledMinutes: number
  workedMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  nightMinutes: number
  holidayMinutes: number
  paidLeaveHours: number
  leaveBalanceDays: number
  restWarningCount: number
  basePay: number
  overtimePay: number
  allowances: number
  bonuses: number
  advances: number
  deductions: number
  employeeContributions: number
  employerContributions: number
  pitWithheld: number
  grossIncome: number
  netIncome: number
  companyCost: number
}

const staffTabGroups: Array<{ id: StaffTabGroupId; tabs: StaffTab[] }> = [
  { id: 'operate', tabs: ['new', 'clientProfile', 'today', 'orders'] },
  { id: 'reports', tabs: ['report'] },
  { id: 'team', tabs: ['attendance', 'hr', 'roles'] },
  { id: 'setup', tabs: ['games', 'prices', 'discounts'] },
  { id: 'admin', tabs: ['restore'] },
]

type StaffOrder = {
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

type StaffOrderPayment = {
  id: string
  order_id: string
  payment_method: StaffPaymentMethod
  amount: number
  created_by: string | null
  created_at: string
}

type StaffSessionParticipant = {
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
  projectiles_fired?: number | null
  escape_duration_seconds?: number | null
  placement?: number | null
  chapter_times?: Array<{
    chapter_number: number
    duration_seconds: number
    game_slug: string
  }> | null
}

type StaffOperationSession = {
  id: string
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

type StaffDeleteSessionDraft = {
  session: StaffOperationSession
  order: StaffOrder | null
}

type RoleSaveFeedback = {
  tone: 'saving' | 'success' | 'error'
  message: string
}

type StaffProfileDeleteDraft = {
  profile: StaffProfile
  ban: boolean
  reason: string
  confirmation: string
}

type StaffAuditLog = {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value?: unknown
  new_value?: unknown
  created_at: string
}

type SoftDeletedRecord = {
  entity_table: string
  entity_id: string
  label: string | null
  deleted_at: string
  deleted_by: string | null
  delete_reason: string | null
}

type StaffDataKey = 'games' | 'prices' | 'discounts' | 'loyalty' | 'today' | 'todaySessions' | 'attendance' | 'hr' | 'orders' | 'profiles' | 'achievementAwards' | 'restore' | 'report'

type StaffReportSummary = {
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

type StaffDailyPoint = {
  date: string
  sales: number
  bookings: number
  players: number
}

type StaffReportSnapshot = {
  report: StaffReportSummary
  comparisonReport: StaffReportSummary
  reportSeries: StaffDailyPoint[]
  comparisonSeries: StaffDailyPoint[]
  orders: StaffOrder[]
  comparisonOrders: StaffOrder[]
  payments: StaffOrderPayment[]
}

const emptyStaffOrders: StaffOrder[] = []
const emptyStaffPayments: StaffOrderPayment[] = []
const emptyStaffDailySeries: StaffDailyPoint[] = []

type StaffWeekdayRevenuePoint = {
  key: string
  label: string
  sales: number
}

type StaffHourlyRevenuePoint = {
  hour: number
  label: string
  sales: number
}

type BookingForm = {
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

type CustomerInviteForm = {
  fullName: string
  email: string
  phone: string
  nickname: string
}

type StaffConsoleProps = {
  profile: StaffProfile | null
  authEmail?: string
  language?: string
  mode?: 'staff' | 'hr'
  onOpenPlayerProfile?: (profile: StaffProfile) => void
  onOpenSessionCalendar?: (dateValue: string) => void
}

type StaffConsoleLanguage = 'en' | 'vi'

const staffWeekdayLabels = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  vi: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
} satisfies Record<StaffConsoleLanguage, string[]>

const staffDiscountDayScopes: StaffDiscountDayScope[] = ['all', 'weekday', 'weekend', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const staffDiscountTicketTypes: StaffDiscountTicketType[] = ['all', 'individual', 'birthday', 'corporate']

const staffConsoleText = {
  en: {
    accessRequired: 'Staff access required.',
    active: 'active',
    inactive: 'inactive',
    allGames: 'All games',
    allPriceRules: 'All price rules',
    allRoles: 'All roles',
    any: 'any',
    chooseDate: 'Choose date',
    chooseTime: 'Choose time',
    closeRoleHelp: 'Close role explanation',
    compareOff: 'Turn on compare',
    compareWith: 'Compare with',
    customerFallback: 'Customer',
    defaultWalkInRate: 'Default walk-in rate',
    editDiscount: 'Edit discount',
    editGame: 'Edit game',
    editLoyaltyRule: 'Edit loyalty rule',
    editPriceRule: 'Edit price rule',
    editVoucher: 'Edit voucher',
    gameFallback: 'Game',
    gamePhotoHelp: 'JPG, PNG, or WEBP · max 2 MB · square photo works best.',
    loading: 'Loading Staff Console...',
    noContact: 'No contact',
    noData: 'No data',
    noDiscount: 'No discount',
    noUniqueDiscount: 'No unique discount',
    days: 'days',
    emailOverrideKeepsAdmin: 'Email override keeps this account in its protected role.',
    noExpiry: 'no expiry',
    noneYet: 'None yet',
    newValue: 'New',
    noUsersFound: 'No users found.',
    reportTitleFallback: 'VRena report',
    split: 'Split',
    title: 'Staff Console',
    unknown: 'Unknown',
    unpaid: 'Unpaid',
    vndAmount: 'VND amount',
    walkIn: 'Walk-in / manual customer',
    actions: {
      addSplit: 'Add split',
      apply: 'Apply',
      calendar: 'Calendar',
      approve: 'Approve',
      confirmBooking: 'Confirm booking',
      complete: 'Complete',
      copyPreviousWeek: 'Copy previous week',
      done: 'Done',
      edit: 'Edit',
      excel: 'Excel',
      newGame: 'New game',
      nextWeek: 'Next week',
      noShow: 'No-show',
      paid: 'Paid',
      past: 'Past',
      pdf: 'PDF',
      previousWeek: 'Previous week',
      publish: 'Publish',
      publishWeek: 'Publish week',
      reject: 'Reject',
      remove: 'Remove',
      removePlayer: 'Remove player',
      restore: 'Restore',
      save: 'Save',
      saveParticipant: 'Save player',
      cancel: 'Cancel',
      cancelShift: 'Cancel shift',
      confirmDeleteAccount: 'Delete account',
      deleteAccount: 'Delete account',
      deleteSession: 'Delete',
      confirmDeleteSession: 'Delete',
      download: 'Download',
      approvePayroll: 'Approve payroll',
      createEmployee: 'Create employee',
      generatePayroll: 'Generate payroll',
      saveAttendance: 'Save attendance',
      saveAdjustment: 'Save adjustment',
      saveDiscount: 'Save discount',
      saveEmployeeProfile: 'Save employee profile',
      saveGame: 'Save game',
      saveHrSettings: 'Save HR settings',
      saveLoyaltyRule: 'Save loyalty rule',
      savePrice: 'Save price',
      saveRole: 'Save role',
      saveRules: 'Save rules',
      saveShift: 'Save shift',
      saveSetupOption: 'Save option',
      saveVoucher: 'Save voucher',
      sendPasswordRequest: 'Send setup link',
      sessionCalendar: 'Session Calendar',
      submitLeave: 'Submit leave',
      today: 'Today',
      uploadCv: 'Upload CV',
      uploadPhoto: 'Upload photo',
      viewPayslip: 'View payslip',
      yesterday: 'Yesterday',
      previousPeriod: 'Previous period',
    },
    aria: {
      bookingDate: 'Booking date',
      bookingTime: 'Booking time',
      attendanceDate: 'Attendance date',
      closeReportCalendar: 'Close report calendar',
      clockIn: 'Clock-in time',
      clockOut: 'Clock-out time',
      leaveEnd: 'Leave end date',
      leaveStart: 'Leave start date',
      nightEnd: 'Night window end',
      nightStart: 'Night window start',
      openBookingCalendar: 'Open booking calendar',
      openSessionCalendar: 'Open session calendar',
      compareEndDate: 'Compare end date',
      compareStartDate: 'Compare start date',
      discountValueUnit: 'Discount value unit',
      discountStartTime: 'Discount start time',
      discountEndTime: 'Discount end time',
      discountValidFrom: 'Discount valid from',
      discountValidUntil: 'Discount valid until',
      draftShift: 'Draft shift',
      graphDisplay: 'Graph display',
      loyaltyValidFrom: 'Loyalty valid from',
      loyaltyValidUntil: 'Loyalty valid until',
      nextReportMonth: 'Next report month',
      paymentAmount: 'Payment amount',
      paymentMethod: 'Payment method',
      paymentMix: 'Payment mix',
      periodComparison: 'Period comparison',
      previousReportMonth: 'Previous report month',
      priceEndTime: 'Price end time',
      priceStartTime: 'Price start time',
      priceValidFrom: 'Price valid from',
      priceValidUntil: 'Price valid until',
      reportEndDate: 'Report end date',
      reportStartDate: 'Report start date',
      revenueByDayOfWeek: 'Revenue by day of week',
      revenueByHour: 'Revenue by hour',
      salesByDay: 'Sales by day',
      staffConsole: 'Staff Console',
    },
    chartModes: {
      cheese: 'Cheese',
      columns: 'Column',
      curves: 'Curves',
    } satisfies Record<StaffReportChartMode, string>,
    commerceTabs: {
      discounts: 'Discounts',
      vouchers: 'Vouchers',
      loyalty: 'Loyalty Points',
    } satisfies Record<StaffCommerceTab, string>,
    attendanceTabs: {
      schedule: 'Schedule',
      clock: 'Clock-in log',
      timesheet: 'Timesheet',
      leave: 'Leave',
      settings: 'Rules',
    } satisfies Record<StaffAttendanceTab, string>,
    hrTabs: {
      employees: 'Employee profile',
      schedule: 'Calendar',
      timesheet: 'Timesheet',
      payroll: 'Payroll',
      adjustments: 'Bonuses',
      advances: 'Debts & advances',
      settings: 'HR settings',
    } satisfies Record<StaffHrTab, string>,
    shiftStatuses: {
      cancelled: 'cancelled',
      completed: 'completed',
      draft: 'draft',
      published: 'published',
    } satisfies Record<StaffShiftStatus, string>,
    shiftTemplates: {
      afternoon: 'Afternoon',
      evening: 'Evening',
      full_day: 'Full day',
      opening: 'Opening',
    } satisfies Record<StaffShiftTemplateId, string>,
    scheduleScopes: {
      all: 'All departments',
      department: 'My department',
      mine: 'My shifts',
    } satisfies Record<StaffScheduleScope, string>,
    attendanceStatuses: {
      absent: 'absent',
      holiday: 'holiday',
      late: 'late',
      leave: 'leave',
      no_show: 'no-show',
      present: 'present',
    } satisfies Record<StaffAttendanceStatus, string>,
    leaveTypes: {
      annual: 'annual leave',
      personal: 'personal leave',
      public_holiday: 'public holiday',
      sick: 'sick leave',
      unpaid: 'unpaid leave',
    } satisfies Record<StaffLeaveType, string>,
    leaveStatuses: {
      approved: 'approved',
      cancelled: 'cancelled',
      rejected: 'rejected',
      requested: 'requested',
    } satisfies Record<StaffLeaveStatus, string>,
    employmentTypes: {
      full_time: 'Full-time',
      part_time: 'Part-time',
      contractor: 'Contractor',
      intern: 'Intern',
      probation: 'Probation',
      probation_full_time: 'Probation full-time',
      probation_part_time: 'Probation part-time',
    } satisfies Record<StaffEmploymentType, string>,
    genderOptions: {
      female: 'Female',
      male: 'Male',
      non_binary: 'Non-binary',
      prefer_not_to_say: 'Prefer not to say',
      other: 'Other',
    } satisfies Record<StaffGender, string>,
    contractStatuses: {
      active: 'Active',
      probation: 'Probation',
      suspended: 'Suspended',
      ended: 'Ended',
      draft: 'Draft',
    } satisfies Record<StaffContractStatus, string>,
    adjustmentTypes: {
      bonus: 'Bonus',
      commission: 'Commission',
      allowance: 'Allowance',
      lunch_allowance: 'Lunch allowance',
      deduction: 'Deduction',
      advance: 'Advance',
      debt: 'Debt',
      debt_repayment: 'Debt repayment',
    } satisfies Record<StaffHrAdjustmentType, string>,
    adjustmentStatuses: {
      draft: 'draft',
      pending: 'pending validation',
      approved: 'approved',
      rejected: 'rejected',
      paid: 'paid',
      cancelled: 'cancelled',
    } satisfies Record<StaffHrAdjustmentStatus, string>,
    payrollStatuses: {
      draft: 'draft',
      pending: 'pending',
      approved: 'approved',
      paid: 'paid',
      cancelled: 'cancelled',
    } satisfies Record<StaffPayrollStatus, string>,
    payrollPayCycles: {
      monthly: 'Monthly',
      semi_monthly: 'Semi-monthly',
      weekly: 'Weekly',
      custom: 'Custom',
    } satisfies Record<StaffPayrollPayCycle, string>,
    hrSetupOptionTypes: {
      department: 'Department',
      job_title: 'Job title',
      location: 'Location',
      contract_status: 'Contract status',
      contract_type: 'Contract type',
      employment_type: 'Employment type',
    } satisfies Record<StaffHrSetupOptionType, string>,
    dayTypes: {
      custom: 'custom',
      holiday: 'holiday',
      weekday: 'weekday',
      weekend: 'weekend',
    } satisfies Record<StaffPriceRule['day_type'], string>,
    discountDayScopes: {
      all: 'All days',
      fri: 'Friday',
      mon: 'Monday',
      sat: 'Saturday',
      sun: 'Sunday',
      thu: 'Thursday',
      tue: 'Tuesday',
      wed: 'Wednesday',
      weekday: 'Weekdays',
      weekend: 'Weekend',
    } satisfies Record<StaffDiscountDayScope, string>,
    discountTicketTypes: {
      all: 'All ticket types',
      birthday: 'Birthday / Events',
      corporate: 'Corporate',
      individual: 'Individual',
    } satisfies Record<StaffDiscountTicketType, string>,
    discountTypes: {
      birthday: 'birthday',
      fixed_amount: 'fixed amount',
      free_ticket: 'free ticket',
      group: 'group',
      percentage: 'percentage',
      resident: 'resident',
    } satisfies Record<StaffDiscount['discount_type'], string>,
    gameTypes: {
      escape: 'escape',
      other: 'other',
      shooting: 'shooting',
      tournament: 'tournament',
    } satisfies Record<StaffGame['game_type'], string>,
    ticketTypes: {
      birthday: 'Birthday',
      corporate: 'Corporate',
      individual: 'Individual',
    } satisfies Record<string, string>,
    audienceOptions: {
      family_friendly: 'Family friendly',
      scary: 'Scary',
      fun: 'Fun',
      quest: 'Quest',
      teamwork: 'Teamwork',
      beginner_friendly: 'Beginner friendly',
      competitive: 'Competitive',
    } satisfies Record<StaffAudience, string>,
    labels: {
      actions: 'Actions',
      active: 'Active',
      activeEmployee: 'Active employee',
      inactiveEmployee: 'Inactive employee',
      accountantExports: 'Accountant exports',
      arena: 'Arena',
      arenaIds: 'Arena IDs',
      attachmentList: 'Attachment list',
      annualLeaveDays: 'Annual leave days',
      attendance: 'Attendance',
      attendanceDate: 'Attendance date',
      attendanceSchedule: 'Attendance & work schedule',
      bankAccount: 'Bank account',
      bankName: 'Bank name',
      bankTransfer: 'Bank transfer',
      baseSalary: 'Base salary (đ)',
      bestSellingGame: 'Best-selling game',
      bookings: 'Bookings',
      breakMinutes: 'Break minutes',
      calculation: 'Calculation',
      cancelled: 'Cancelled',
      cash: 'Cash',
      capacity: 'Capacity',
      checkIns: 'Check-ins',
      codeOptional: 'Code (optional)',
      banAccount: 'Ban this account too',
      compare: 'Compare',
      compareEditingHint: 'Calendar clicks now edit the compare range.',
      compareInactiveHint: 'Switch to Compare above to edit this range.',
      compareRange: 'Compare range',
      confirmDeleteWord: 'Type DELETE to confirm',
      createCustomerAccount: 'Create customer account',
      awardAchievement: 'Unlock achievement',
      awardAchievementHelp: 'Manually unlock an existing player achievement when the automatic session data does not cover the real-world moment.',
      awardNote: 'Staff note',
      awardToPlayer: 'Why are you unlocking it?',
      chooseAchievement: 'Choose achievement',
      choosePlayer: 'Choose player',
      grantedAwards: 'Manual unlocks',
      createDiscount: 'Create discount',
      createGame: 'Create game',
      createLoyaltyRule: 'Create loyalty rule',
      createPriceRule: 'Create price rule',
      createVoucher: 'Create voucher',
      current: 'current',
      communitySession: 'Community session',
      customer: 'Customer',
      customerAccountHelp: 'Create a customer profile and email them a secure link to set their password.',
      customerName: 'Customer name',
      customerProfile: 'Customer profile',
      noAwardsYet: 'No manual unlocks yet.',
      noPlayersFound: 'No matching players.',
      optional: 'optional',
      sendAward: 'Unlock achievement',
      date: 'Date',
      dateRange: 'Date range',
      dayType: 'Day type',
      deleteReason: 'Reason',
      description: 'Description',
      audience: 'Audience',
      discount: 'Discount',
      discountRuleHelp: 'Discounts apply automatically when their rules match. Vouchers work when the customer enters the voucher code.',
      discountConditions: 'Conditions',
      discountType: 'Discount type',
      discountVoucher: 'Discount / voucher',
      discounts: 'Discounts',
      duration: 'Duration',
      escapeChapters: 'Escape chapters',
      email: 'E-mail',
      employeeCode: 'Employee code',
      attendanceNumber: 'Attendance number',
      employmentType: 'Employment type',
      end: 'End',
      endDate: 'End date',
      contractStatus: 'Contract status',
      contractType: 'Contract type',
      contractStartDate: 'Contract start date',
      contractEndDate: 'Contract end date',
      editingRange: 'Editing',
      emergencyContact: 'Emergency contact',
      estimatedPayroll: 'Estimated payroll',
      exportFormat: 'Format',
      exportLanguage: 'Language',
      exportReport: 'Report',
      exportStore: 'Store / location',
      holidayHours: 'Holiday hours',
      hours: 'Hours',
      hourlyRate: 'Gross hourly rate (đ)',
      monthlyGross: 'Monthly gross (đ)',
      missingDocuments: 'Missing documents',
      filterByRole: 'Filter by role',
      game: 'Game',
      guideGameplay: 'GamePlay',
      guideLanguage: 'Guide language',
      guideSummary: 'Guide summary',
      guideTips: 'Guide tips',
      gamePhoto: 'Game photo',
      games: 'Games',
      imageUrl: 'Image URL',
      includeAttachments: 'Include attachments list',
      internalNote: 'Internal note',
      jobTitle: 'Job title',
      department: 'Department',
      lateNoShow: 'Late / no-show',
      legalName: 'Legal name',
      leaveHours: 'Leave hours',
      leaveBalance: 'Available leave',
      leaveType: 'Leave type',
      location: 'Location',
      mainWorkLocation: 'Main workplace',
      payrollLocation: 'Payroll outlet',
      managerNote: 'Manager note',
      maxPlayersArena: 'Max players / arena',
      maxPlayers: 'Max players',
      maxDiscountAmount: 'Max discount amount',
      maxUses: 'Max uses',
      limitByHour: 'Limit by hour',
      minPlayers: 'Min players',
      minimumSpend: 'Minimum spend',
      name: 'Name',
      newBooking: 'New booking',
      nickname: 'Nickname',
      noLinkedOrder: 'No linked order',
      no: 'No',
      noShows: 'No-shows',
      nightHours: 'Night hours',
      nightWindow: 'Night window',
      notes: 'Notes',
      order: 'Order',
      orderStatus: 'Order status',
      orders: 'Orders',
      off: 'Off',
      operationsCalendar: 'Operations calendar',
      operationsDate: 'Operations date',
      paid: 'Paid',
      payment: 'Payment',
      paymentSplits: 'Payment splits',
      paymentStatus: 'Payment status',
      paymentMix: 'Payment mix',
      payrollLink: 'Attendance / payroll link',
      payrollNote: 'Payroll note',
      payrollRun: 'Payroll run',
      payrollCode: 'Payroll code',
      payrollName: 'Payroll name',
      payCycle: 'Pay cycle',
      payslipPreview: 'Vietnam payslip preview',
      periodStart: 'Period start',
      periodEnd: 'Period end',
      perCustomerLimit: 'Per customer limit',
      perVndSpent: 'Per VND spent',
      phone: 'Phone',
      personalEmail: 'Personal e-mail',
      personalPhone: 'Personal phone',
      profilePhoto: 'Profile photo',
      cvDocument: 'CV document',
      profileCompletion: 'Profile completion',
      players: 'Players',
      addPlayer: 'Add player',
      sessionFields: 'Session fields',
      participantResults: 'Player results',
      chapterTimes: 'Chapter times',
      chapter: 'Chapter',
      score: 'Score',
      place: 'Place',
      accuracy: 'Accuracy',
      projectiles: 'Shots',
      escapeTime: 'Escape time',
      loyaltyPoints: 'Loyalty points',
      pointsEarned: 'Points earned',
      pointsExpireAfterDays: 'Points expire after days',
      redeemValue: 'Redeem value',
      privateSession: 'Private session',
      priceArenaSlot: 'Price / arena slot (đ)',
      pricePlayer: 'Price / player (đ)',
      priceRule: 'Price rule',
      priceRules: 'Price rules',
      privateEmployeeProfile: 'Private employee profile',
      address: 'Address',
      dateOfBirth: 'Date of birth',
      gender: 'Gender',
      nationalId: 'National ID',
      regularHours: 'Regular hours',
      remaining: 'Remaining',
      restoreDeletedRecords: 'Restore deleted records',
      referenceRange: 'Reference range',
      reportRange: 'Report range',
      roleExplanation: 'Role explanation',
      roleFor: 'Role for',
      roles: 'Roles',
      rounds: 'Rounds',
      rule: 'Rule',
      ruleName: 'Rule name',
      sales: 'Sales',
      salesTrend: 'Sales trend',
      revenueByDayOfWeek: 'Revenue by day of week',
      revenueByHour: 'Revenue by hour',
      searchUsers: 'Search users',
      selectedRange: 'Selected range',
      sessions: 'Sessions',
      scheduledHours: 'Scheduled hours',
      shiftDate: 'Shift date',
      shiftList: 'Shift list',
      shiftRole: 'Shift role',
      scheduleScope: 'Schedule view',
      shiftTemplate: 'Shift template',
      sortBy: 'Sort by',
      slug: 'Slug',
      standardDay: 'Standard day length',
      standardDayHelp: 'Use HH:mm. Example: 07:15 = 7h 15m.',
      standardDayPresets: 'Standard day presets',
      standardBreakMinutes: 'Standard break (minutes)',
      standardShiftTemplates: 'Standard shifts',
      standardWeek: 'Standard week',
      start: 'Start',
      startDate: 'Start date',
      status: 'Status',
      staffMember: 'Staff member',
      socialInsurance: 'Social insurance number',
      standardMonthlyDays: 'Standard monthly days',
      standardMonthlyHours: 'Standard monthly hours',
      subtotal: 'Subtotal',
      summary: 'Summary',
      taxCodeEmployee: 'Tax code',
      time: 'Time',
      ticketBookings: 'Ticket bookings',
      ticketType: 'Ticket type',
      total: 'Total',
      totalCompanyCost: 'Total company cost',
      totalGross: 'Total gross',
      totalNet: 'Total net',
      totalPaid: 'Total paid',
      totalSales: 'Total sales',
      type: 'Type',
      uniqueDiscount: 'Unique discount',
      used: 'used',
      value: 'Value',
      validFrom: 'Valid from',
      validUntil: 'Valid until',
      validUntilHelp: 'optional, by default forever',
      voucherCodeRequired: 'Voucher code *',
      vouchers: 'Vouchers',
      weeklyRange: 'Week',
      weeklySchedule: 'Weekly schedule',
      allDays: 'All days',
      allTicketTypes: 'All ticket types',
      overtimeHours: 'Overtime hours',
      overtimePay: 'Overtime pay',
      overtimeMonthlyCap: 'Monthly overtime cap',
      overtimeYearlyCap: 'Yearly overtime cap',
      normalOvertimeMultiplier: 'Normal OT multiplier',
      nightOvertimeMultiplier: 'Night OT multiplier',
      holidayOvertimeMultiplier: 'Holiday OT multiplier',
      lunchAllowance: 'Lunch allowance / day',
      restPeriodHours: 'Minimum rest (hours)',
      restWarnings: 'Rest alerts',
      employeeContributionRate: 'Employee contribution %',
      employerContributionRate: 'Employer contribution %',
      pitWithholdingRate: 'PIT withholding %',
      dependentsCount: 'Dependents',
      grossIncome: 'Gross income',
      netIncome: 'Net income',
      companyCost: 'Company cost',
      allowances: 'Allowances',
      bonuses: 'Bonuses',
      advances: 'Advances',
      deductions: 'Deductions',
      employeeContributions: 'Employee contributions',
      employerContributions: 'Employer contributions',
      pitWithheld: 'PIT withheld',
      outstandingDebt: 'Outstanding debt',
      workedHours: 'Worked hours',
      yes: 'Yes',
    },
    loyaltyCalculation: {
      per_booking: 'Per booking',
      per_player: 'Per player',
      per_visit: 'Per visit/check-in',
      per_vnd_spent: 'Spend based',
    } satisfies Record<StaffLoyaltyRule['calculation_type'], string>,
    messages: {
      clickUploadGamePhoto: 'Click to upload game photo',
      accountDeleteBanNote: 'Ban metadata stays attached to the deleted profile for future review.',
      accountDeleteBody: 'This soft-deletes the user profile and removes it from active app lists. Historical sessions, scores, orders, and audit records stay intact.',
      accountDeleteTitle: 'Delete account?',
      operationDeleteBody: 'This removes it from the Sessions and Tickets lists. Linked players are removed and any linked order is marked cancelled.',
      operationDeleteTitle: 'Delete this session or ticket?',
      accountDeleted: 'Account deleted.',
      accountDeleting: 'Deleting account...',
      accountDeleteConfirmationHelp: 'Write DELETE exactly to unlock this action.',
      accountantExportHelp: 'Choose filters, report type, and format, then download.',
      accountantExportSourcePending: 'Detailed source table is not configured yet. This export includes the available report summary for the selected range.',
      attendanceIntro: 'Plan shifts, clock-ins, leave, overtime, and Vietnam labor-rule checks in one place.',
      attendanceReadOnly: 'Read-only view. Viewer can inspect attendance, but cannot save changes.',
      attendanceRulesSaved: 'Attendance rules saved.',
      attendanceSaved: 'Attendance saved.',
      customerAccountEmailRequired: 'Enter a customer email.',
      customerAccountInvited: 'Customer account created. Password request sent.',
      customerAccountNameRequired: 'Enter the customer name.',
      achievementAwarded: 'Achievement unlocked for this player.',
      achievementAlreadyAwarded: 'Already awarded to this player.',
      achievementAwardSelectPlayer: 'Choose a player first.',
      discountSaved: 'Discount saved.',
      draftShiftCreated: 'Draft shift created.',
      draftShiftExists: 'That draft already exists for this staff member and day.',
      employeeProfileIntro: 'Private HR details linked to attendance and payroll. Visible to staff HR roles only.',
      employeeProfileSaved: 'Employee profile saved.',
      hrIntro: 'Company HR hub for employee records, schedule health, payroll, payslips, bonuses, advances, and setup.',
      hrSetupUnavailable: 'Apply the HR migration to enable saved HR settings, bonuses, payroll runs, and document uploads.',
      hrSettingsSaved: 'HR settings saved.',
      hrSetupOptionSaved: 'HR option saved.',
      adjustmentSaved: 'HR adjustment saved.',
      adjustmentApproved: 'Adjustment approved.',
      payrollGenerated: 'Payroll draft generated.',
      payrollApproved: 'Payroll approved.',
      profilePhotoHelp: 'JPG, PNG, or WEBP · max 2 MB.',
      cvHelp: 'PDF, DOC, or DOCX · max 10 MB.',
      profilePhotoTooLarge: 'Profile photo must be 2 MB or smaller.',
      cvTooLarge: 'CV must be 10 MB or smaller.',
      documentUploaded: 'Document uploaded.',
      documentUploadFailed: 'Document upload failed.',
      noAdjustments: 'No HR adjustments for this period.',
      noPayrollRuns: 'No payroll runs yet.',
      noHrDocuments: 'No HR documents uploaded yet.',
      noScheduleShifts: 'No scheduled shifts for this period.',
      inactiveEmployeePlanningBlocked: 'Inactive employee: reactivate this employee profile before planning new shifts.',
      gamePhotoSmall: 'Game photo must be 2 MB or smaller.',
      gamePhotoType: 'Game photo must be JPG, PNG, or WEBP.',
      gamePhotoUploaded: 'Game photo uploaded. Save the game to keep it.',
      gameGuideHelp: 'Select a language, then edit the summary, GamePlay, and tips for this game only. Use one line per GamePlay item or tip.',
      gameSaved: 'Game saved.',
      loyaltyIntro: 'Define how customers earn points. Redemption will use these rules later.',
      loyaltyRuleSaved: 'Loyalty rule saved.',
      loyaltySingleActiveConfirm: 'Only one loyalty rule can be active. Saving this rule will deactivate {rule} but keep it for analytics. Continue?',
      loyaltyPointsUpdated: 'Loyalty points updated.',
      loyaltyPointsUpdating: 'Updating loyalty points...',
      leaveSaved: 'Leave request saved.',
      leaveUpdated: 'Leave request updated.',
      noAttendanceLogs: 'No clock-in logs for this week.',
      noDiscounts: 'No discounts yet.',
      noLeaveRequests: 'No leave requests for this week.',
      noLoyaltyRules: 'No loyalty rules yet.',
      noOrders: 'No orders in this range.',
      noSales: 'No sales in this period yet.',
      noShifts: 'No shifts for this week.',
      noStaffProfiles: 'No staff profiles yet.',
      noSoftDeleted: 'No soft-deleted records.',
      noVouchers: 'No vouchers yet.',
      orderConfirmed: 'Order {order} confirmed · {total}',
      orderCreating: 'Creating order...',
      orderUpdated: 'Order updated.',
      priceRuleSaved: 'Price rule saved.',
      readOnlyBooking: 'Read-only view. Viewer can inspect this flow, but cannot create bookings.',
      readOnlyCommerce: 'Read-only view. Viewer can inspect these rules, but cannot save changes.',
      readOnlyGames: 'Read-only view. Viewer can inspect games, but cannot save changes.',
      readOnlyPrices: 'Read-only view. Viewer can inspect price rules, but cannot save changes.',
      restoreIntro: 'Owner only. Restoring clears deleted_at, deleted_by, and delete_reason.',
      restoringRecord: 'Restoring record...',
      recordRestored: 'Record restored.',
      roleSaveFailed: 'Role was not saved. Apply the latest Supabase SQL migration, then try again.',
      roleSaveMismatch: 'Role was not saved. Supabase still returned a different role.',
      roleUpdated: 'Role updated.',
      roleUpdating: 'Updating role...',
      shiftSaved: 'Shift saved.',
      staffTooManyAttempts: 'Too many attempts. Please wait a moment and try again.',
      planningConflictDailyLimit: 'Above standard daily hours.',
      planningConflictLeave: 'Approved leave on this day.',
      planningConflictOverlap: 'Overlaps another shift.',
      planningGridHelp: 'Click a cell to draft a shift. Drag chips to move them.',
      previousWeekCopied: 'Previous week copied as draft shifts.',
      previousWeekEmpty: 'No shifts found in previous week.',
      previousWeekNoNew: 'Previous week already exists here. Nothing copied.',
      weekPublished: 'Week published.',
      uniqueDiscountHelp: 'One-off discount for this booking only. It does not create a reusable voucher.',
      uploadGamePhoto: 'Uploading game photo...',
      noOperationSessions: 'No sessions or ticket bookings for this day.',
      operationsIntro: 'Manage sessions, ticket bookings, capacity, payments, check-ins, players, and results in one place.',
      operationSessionSaved: 'Session updated.',
      operationParticipantSaved: 'Player updated.',
      operationParticipantAdded: 'Player added.',
      operationParticipantRemoved: 'Player removed.',
      operationSessionDeleted: 'Session deleted.',
      operationSessionDeleting: 'Deleting session...',
      voucherCodeRequired: 'Voucher code is required.',
      voucherSaved: 'Voucher saved.',
    },
    orderStatuses: {
      cancelled: 'cancelled',
      completed: 'completed',
      confirmed: 'confirmed',
      draft: 'draft',
      no_show: 'no_show',
      paid: 'paid',
      partially_paid: 'partially_paid',
      refunded: 'refunded',
    } satisfies Record<StaffOrder['order_status'], string>,
    paymentMethods: {
      bank_transfer: 'Bank Transfer',
      cash: 'Cash',
    } satisfies Record<StaffPaymentMethod, string>,
    roles: {
      admin: 'Admin',
      cashier: 'Office Staff',
      manager: 'Manager',
      owner: 'Owner',
      player: 'Player',
      staff: 'Staff',
      viewer: 'Viewer',
    } satisfies Record<StaffRole, string>,
    roleSorts: {
      created_desc: 'Created last',
      email_asc: 'E-mail A-Z',
      name_asc: 'Name A-Z',
      name_desc: 'Name Z-A',
      role_asc: 'Role low-high',
      role_desc: 'Role high-low',
    } satisfies Record<StaffRoleSort, string>,
    reportRangePresets: {
      today: 'Sessions',
      yesterday: 'Yesterday',
      this_week: 'This week',
      last_week: 'Last week',
      this_month: 'This month',
      last_month: 'Last month',
      last_30: 'Last 30 days',
      last_60: 'Last 60 days',
      last_90: 'Last 90 days',
    } satisfies Record<StaffReportRangePreset, string>,
    reportWeekdays: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
    roleHelp: [
      { title: 'Owner', body: 'Full Staff Console access, role management, restore tools, and every client app feature.' },
      { title: 'Admin', body: 'Full daily operations access and role management below Owner. Restore stays Owner only.' },
      { title: 'Manager', body: 'Can manage games, prices, discounts, vouchers, loyalty rules, bookings, orders, and reports.' },
      { title: 'Staff', body: 'Can create counter bookings, check today, use discounts or vouchers, manage orders, and view reports. In HR, Staff only sees their own employee profile.' },
      { title: 'Office Staff', body: 'Viewer access plus editable reports and full Attendance edit access.' },
      { title: 'Viewer', body: 'Can use the normal player app, view the whole Staff Console, and adjust or download reports. All other staff data is read-only.' },
      { title: 'Player', body: 'Client app only. No Staff Console access.' },
    ],
    tabs: {
      clientProfile: 'Client Profile',
      discounts: 'Offers',
      attendance: 'Attendance',
      games: 'Games',
      hr: 'HR',
      new: 'New Booking',
      orders: 'Orders',
      prices: 'Prices',
      report: 'Daily Report',
      restore: 'Restore',
      roles: 'Roles',
      today: 'Today',
    } satisfies Record<StaffTab, string>,
    tabGroups: {
      admin: 'Admin',
      operate: 'Operate',
      reports: 'Reports',
      setup: 'Setup',
      team: 'Team',
    } satisfies Record<StaffTabGroupId, string>,
  },
  vi: {
    accessRequired: 'Cần quyền nhân viên.',
    active: 'đang bật',
    inactive: 'đã tắt',
    allGames: 'Tất cả trò chơi',
    allPriceRules: 'Tất cả quy tắc giá',
    allRoles: 'Tất cả vai trò',
    any: 'bất kỳ',
    chooseDate: 'Chọn ngày',
    chooseTime: 'Chọn giờ',
    closeRoleHelp: 'Đóng giải thích vai trò',
    compareOff: 'Bật so sánh',
    compareWith: 'So sánh với',
    customerFallback: 'Khách hàng',
    defaultWalkInRate: 'Giá khách tại quầy',
    editDiscount: 'Sửa ưu đãi',
    editGame: 'Sửa trò chơi',
    editLoyaltyRule: 'Sửa quy tắc điểm',
    editPriceRule: 'Sửa quy tắc giá',
    editVoucher: 'Sửa voucher',
    gameFallback: 'Trò chơi',
    gamePhotoHelp: 'JPG, PNG hoặc WEBP · tối đa 2 MB · ảnh vuông hiển thị đẹp nhất.',
    loading: 'Đang tải Bảng nhân viên...',
    noContact: 'Chưa có liên hệ',
    noData: 'Chưa có dữ liệu',
    noDiscount: 'Không ưu đãi',
    noUniqueDiscount: 'Không có ưu đãi riêng',
    days: 'ngày',
    emailOverrideKeepsAdmin: 'Email cố định vẫn giữ tài khoản này trong vai trò được bảo vệ.',
    noExpiry: 'không hết hạn',
    noneYet: 'Chưa có',
    newValue: 'Mới',
    noUsersFound: 'Không tìm thấy người dùng.',
    reportTitleFallback: 'Báo cáo VRena',
    split: 'Tách thanh toán',
    title: 'Bảng nhân viên',
    unknown: 'Không rõ',
    unpaid: 'Chưa thanh toán',
    vndAmount: 'Số tiền VND',
    walkIn: 'Khách tại quầy / nhập tay',
    actions: {
      addSplit: 'Thêm phần thanh toán',
      apply: 'Áp dụng',
      calendar: 'Lịch',
      approve: 'Duyệt',
      confirmBooking: 'Xác nhận đặt chỗ',
      complete: 'Hoàn tất',
      copyPreviousWeek: 'Sao chép tuần trước',
      done: 'Hoàn tất',
      edit: 'Sửa',
      excel: 'Excel',
      newGame: 'Trò chơi mới',
      nextWeek: 'Tuần sau',
      noShow: 'Không đến',
      paid: 'Đã thanh toán',
      past: 'Đã qua',
      pdf: 'PDF',
      previousWeek: 'Tuần trước',
      publish: 'Công bố',
      publishWeek: 'Công bố tuần',
      reject: 'Từ chối',
      remove: 'Xóa',
      removePlayer: 'Xóa người chơi',
      restore: 'Khôi phục',
      save: 'Lưu',
      saveParticipant: 'Lưu người chơi',
      cancel: 'Hủy',
      cancelShift: 'Hủy ca',
      confirmDeleteAccount: 'Xóa tài khoản',
      deleteAccount: 'Xóa tài khoản',
      deleteSession: 'Xóa',
      confirmDeleteSession: 'Xóa',
      download: 'Tải xuống',
      approvePayroll: 'Duyệt bảng lương',
      createEmployee: 'Tạo nhân viên',
      generatePayroll: 'Tạo bảng lương',
      saveAttendance: 'Lưu chấm công',
      saveAdjustment: 'Lưu khoản điều chỉnh',
      saveDiscount: 'Lưu ưu đãi',
      saveEmployeeProfile: 'Lưu hồ sơ nhân viên',
      saveGame: 'Lưu trò chơi',
      saveHrSettings: 'Lưu thiết lập HR',
      saveLoyaltyRule: 'Lưu quy tắc điểm',
      savePrice: 'Lưu giá',
      saveRole: 'Lưu vai trò',
      saveRules: 'Lưu quy định',
      saveShift: 'Lưu ca',
      saveSetupOption: 'Lưu tùy chọn',
      saveVoucher: 'Lưu voucher',
      sendPasswordRequest: 'Gửi link tạo mật khẩu',
      sessionCalendar: 'Lịch phiên',
      submitLeave: 'Gửi nghỉ phép',
      today: 'Hôm nay',
      uploadCv: 'Tải CV',
      uploadPhoto: 'Tải ảnh',
      viewPayslip: 'Xem phiếu lương',
      yesterday: 'Hôm qua',
      previousPeriod: 'Kỳ trước',
    },
    aria: {
      bookingDate: 'Ngày đặt chỗ',
      bookingTime: 'Giờ đặt chỗ',
      attendanceDate: 'Ngày chấm công',
      closeReportCalendar: 'Đóng lịch báo cáo',
      clockIn: 'Giờ vào ca',
      clockOut: 'Giờ ra ca',
      leaveEnd: 'Ngày kết thúc nghỉ',
      leaveStart: 'Ngày bắt đầu nghỉ',
      nightEnd: 'Kết thúc giờ đêm',
      nightStart: 'Bắt đầu giờ đêm',
      openBookingCalendar: 'Mở lịch đặt chỗ',
      openSessionCalendar: 'Mở lịch phiên',
      compareEndDate: 'Ngày kết thúc so sánh',
      compareStartDate: 'Ngày bắt đầu so sánh',
      discountValueUnit: 'Đơn vị ưu đãi',
      discountStartTime: 'Giờ bắt đầu ưu đãi',
      discountEndTime: 'Giờ kết thúc ưu đãi',
      discountValidFrom: 'Ưu đãi hiệu lực từ',
      discountValidUntil: 'Ưu đãi hiệu lực đến',
      draftShift: 'Tạo ca nháp',
      graphDisplay: 'Cách hiển thị biểu đồ',
      loyaltyValidFrom: 'Điểm hiệu lực từ',
      loyaltyValidUntil: 'Điểm hiệu lực đến',
      nextReportMonth: 'Tháng báo cáo sau',
      paymentAmount: 'Số tiền thanh toán',
      paymentMethod: 'Phương thức thanh toán',
      paymentMix: 'Cơ cấu thanh toán',
      periodComparison: 'So sánh kỳ',
      previousReportMonth: 'Tháng báo cáo trước',
      priceEndTime: 'Giờ kết thúc giá',
      priceStartTime: 'Giờ bắt đầu giá',
      priceValidFrom: 'Giá hiệu lực từ',
      priceValidUntil: 'Giá hiệu lực đến',
      reportEndDate: 'Ngày kết thúc báo cáo',
      reportStartDate: 'Ngày bắt đầu báo cáo',
      revenueByDayOfWeek: 'Doanh thu theo ngày trong tuần',
      revenueByHour: 'Doanh thu theo giờ',
      salesByDay: 'Doanh thu theo ngày',
      staffConsole: 'Bảng nhân viên',
    },
    chartModes: {
      cheese: 'Tròn',
      columns: 'Cột',
      curves: 'Đường',
    } satisfies Record<StaffReportChartMode, string>,
    commerceTabs: {
      discounts: 'Ưu đãi',
      vouchers: 'Voucher',
      loyalty: 'Điểm thưởng',
    } satisfies Record<StaffCommerceTab, string>,
    attendanceTabs: {
      schedule: 'Lịch làm',
      clock: 'Chấm công',
      timesheet: 'Bảng công',
      leave: 'Nghỉ phép',
      settings: 'Quy định',
    } satisfies Record<StaffAttendanceTab, string>,
    hrTabs: {
      employees: 'Hồ sơ nhân viên',
      schedule: 'Lịch',
      timesheet: 'Bảng công',
      payroll: 'Bảng lương',
      adjustments: 'Thưởng',
      advances: 'Nợ & tạm ứng',
      settings: 'Thiết lập HR',
    } satisfies Record<StaffHrTab, string>,
    shiftStatuses: {
      cancelled: 'đã hủy',
      completed: 'hoàn tất',
      draft: 'nháp',
      published: 'đã công bố',
    } satisfies Record<StaffShiftStatus, string>,
    shiftTemplates: {
      afternoon: 'Ca chiều',
      evening: 'Ca tối',
      full_day: 'Cả ngày',
      opening: 'Ca mở cửa',
    } satisfies Record<StaffShiftTemplateId, string>,
    scheduleScopes: {
      all: 'Tất cả bộ phận',
      department: 'Bộ phận của tôi',
      mine: 'Ca của tôi',
    } satisfies Record<StaffScheduleScope, string>,
    attendanceStatuses: {
      absent: 'vắng',
      holiday: 'ngày lễ',
      late: 'đi trễ',
      leave: 'nghỉ phép',
      no_show: 'không đến',
      present: 'có mặt',
    } satisfies Record<StaffAttendanceStatus, string>,
    leaveTypes: {
      annual: 'nghỉ phép năm',
      personal: 'nghỉ cá nhân',
      public_holiday: 'ngày lễ',
      sick: 'nghỉ bệnh',
      unpaid: 'nghỉ không lương',
    } satisfies Record<StaffLeaveType, string>,
    leaveStatuses: {
      approved: 'đã duyệt',
      cancelled: 'đã hủy',
      rejected: 'từ chối',
      requested: 'đang chờ',
    } satisfies Record<StaffLeaveStatus, string>,
    employmentTypes: {
      full_time: 'Toàn thời gian',
      part_time: 'Bán thời gian',
      contractor: 'Cộng tác viên',
      intern: 'Thực tập',
      probation: 'Thử việc',
      probation_full_time: 'Thử việc toàn thời gian',
      probation_part_time: 'Thử việc bán thời gian',
    } satisfies Record<StaffEmploymentType, string>,
    genderOptions: {
      female: 'Nữ',
      male: 'Nam',
      non_binary: 'Phi nhị nguyên',
      prefer_not_to_say: 'Không muốn trả lời',
      other: 'Khác',
    } satisfies Record<StaffGender, string>,
    contractStatuses: {
      active: 'Đang hiệu lực',
      probation: 'Thử việc',
      suspended: 'Tạm ngưng',
      ended: 'Đã kết thúc',
      draft: 'Nháp',
    } satisfies Record<StaffContractStatus, string>,
    adjustmentTypes: {
      bonus: 'Thưởng',
      commission: 'Hoa hồng',
      allowance: 'Phụ cấp',
      lunch_allowance: 'Phụ cấp ăn trưa',
      deduction: 'Khấu trừ',
      advance: 'Tạm ứng',
      debt: 'Nợ',
      debt_repayment: 'Trả nợ',
    } satisfies Record<StaffHrAdjustmentType, string>,
    adjustmentStatuses: {
      draft: 'nháp',
      pending: 'chờ duyệt',
      approved: 'đã duyệt',
      rejected: 'từ chối',
      paid: 'đã trả',
      cancelled: 'đã hủy',
    } satisfies Record<StaffHrAdjustmentStatus, string>,
    payrollStatuses: {
      draft: 'nháp',
      pending: 'đang chờ',
      approved: 'đã duyệt',
      paid: 'đã trả',
      cancelled: 'đã hủy',
    } satisfies Record<StaffPayrollStatus, string>,
    payrollPayCycles: {
      monthly: 'Hàng tháng',
      semi_monthly: 'Nửa tháng',
      weekly: 'Hàng tuần',
      custom: 'Tùy chỉnh',
    } satisfies Record<StaffPayrollPayCycle, string>,
    hrSetupOptionTypes: {
      department: 'Bộ phận',
      job_title: 'Chức danh',
      location: 'Cơ sở',
      contract_status: 'Trạng thái hợp đồng',
      contract_type: 'Loại hợp đồng',
      employment_type: 'Loại việc làm',
    } satisfies Record<StaffHrSetupOptionType, string>,
    dayTypes: {
      custom: 'tùy chỉnh',
      holiday: 'ngày lễ',
      weekday: 'ngày thường',
      weekend: 'cuối tuần',
    } satisfies Record<StaffPriceRule['day_type'], string>,
    discountDayScopes: {
      all: 'Tất cả ngày',
      fri: 'Thứ Sáu',
      mon: 'Thứ Hai',
      sat: 'Thứ Bảy',
      sun: 'Chủ Nhật',
      thu: 'Thứ Năm',
      tue: 'Thứ Ba',
      wed: 'Thứ Tư',
      weekday: 'Ngày thường',
      weekend: 'Cuối tuần',
    } satisfies Record<StaffDiscountDayScope, string>,
    discountTicketTypes: {
      all: 'Tất cả loại vé',
      birthday: 'Sinh nhật / sự kiện',
      corporate: 'Doanh nghiệp',
      individual: 'Cá nhân',
    } satisfies Record<StaffDiscountTicketType, string>,
    discountTypes: {
      birthday: 'sinh nhật',
      fixed_amount: 'số tiền cố định',
      free_ticket: 'vé miễn phí',
      group: 'nhóm',
      percentage: 'phần trăm',
      resident: 'cư dân',
    } satisfies Record<StaffDiscount['discount_type'], string>,
    gameTypes: {
      escape: 'escape',
      other: 'khác',
      shooting: 'bắn súng',
      tournament: 'giải đấu',
    } satisfies Record<StaffGame['game_type'], string>,
    ticketTypes: {
      birthday: 'Sinh nhật',
      corporate: 'Doanh nghiệp',
      individual: 'Cá nhân',
    } satisfies Record<string, string>,
    audienceOptions: {
      family_friendly: 'Thân thiện gia đình',
      scary: 'Rùng rợn',
      fun: 'Vui nhộn',
      quest: 'Nhiệm vụ',
      teamwork: 'Đồng đội',
      beginner_friendly: 'Dễ cho người mới',
      competitive: 'Thi đấu',
    } satisfies Record<StaffAudience, string>,
    labels: {
      actions: 'Thao tác',
      active: 'Đang bật',
      activeEmployee: 'Nhân viên đang làm',
      inactiveEmployee: 'Nhân viên ngưng làm',
      accountantExports: 'Xuất kế toán',
      arena: 'Arena',
      arenaIds: 'Mã arena',
      attachmentList: 'Danh sách chứng từ',
      annualLeaveDays: 'Ngày phép năm',
      attendance: 'Chấm công',
      attendanceDate: 'Ngày chấm công',
      attendanceSchedule: 'Chấm công & lịch làm',
      bankAccount: 'Số tài khoản',
      bankName: 'Ngân hàng',
      bankTransfer: 'Chuyển khoản',
      baseSalary: 'Lương cơ bản (đ)',
      bestSellingGame: 'Trò chơi bán chạy nhất',
      bookings: 'Đặt chỗ',
      breakMinutes: 'Phút nghỉ',
      calculation: 'Cách tính',
      cancelled: 'Đã hủy',
      cash: 'Tiền mặt',
      capacity: 'Sức chứa',
      checkIns: 'Check-in',
      codeOptional: 'Mã (không bắt buộc)',
      banAccount: 'Cấm tài khoản này luôn',
      compare: 'So sánh',
      compareEditingHint: 'Bấm lịch sẽ chỉnh khoảng so sánh.',
      compareInactiveHint: 'Chọn So sánh phía trên để chỉnh khoảng này.',
      compareRange: 'Khoảng so sánh',
      confirmDeleteWord: 'Nhập DELETE để xác nhận',
      createCustomerAccount: 'Tạo tài khoản khách hàng',
      awardAchievement: 'Mở khóa thành tựu',
      awardAchievementHelp: 'Mở khóa thủ công một thành tựu hiện có khi dữ liệu phiên tự động chưa phản ánh đúng khoảnh khắc thực tế.',
      awardNote: 'Ghi chú nhân viên',
      awardToPlayer: 'Vì sao mở khóa thành tựu này?',
      chooseAchievement: 'Chọn thành tựu',
      choosePlayer: 'Chọn người chơi',
      grantedAwards: 'Mở khóa thủ công',
      createDiscount: 'Tạo ưu đãi',
      createGame: 'Tạo trò chơi',
      createLoyaltyRule: 'Tạo quy tắc điểm',
      createPriceRule: 'Tạo quy tắc giá',
      createVoucher: 'Tạo voucher',
      current: 'hiện tại',
      communitySession: 'Phiên cộng đồng',
      customer: 'Khách hàng',
      customerAccountHelp: 'Tạo hồ sơ khách hàng và gửi email bảo mật để họ đặt mật khẩu.',
      customerName: 'Tên khách hàng',
      customerProfile: 'Hồ sơ khách',
      noAwardsYet: 'Chưa có mở khóa thủ công.',
      noPlayersFound: 'Không tìm thấy người chơi.',
      optional: 'không bắt buộc',
      sendAward: 'Mở khóa thành tựu',
      date: 'Ngày',
      dateRange: 'Khoảng ngày',
      dayType: 'Loại ngày',
      deleteReason: 'Lý do',
      description: 'Mô tả',
      audience: 'Đối tượng',
      discount: 'Ưu đãi',
      discountRuleHelp: 'Ưu đãi được áp dụng tự động khi khớp quy tắc. Voucher hoạt động khi khách nhập mã voucher.',
      discountConditions: 'Điều kiện',
      discountType: 'Loại ưu đãi',
      discountVoucher: 'Ưu đãi / voucher',
      discounts: 'Ưu đãi',
      duration: 'Thời lượng',
      escapeChapters: 'Số chapter Escape',
      email: 'E-mail',
      employeeCode: 'Mã nhân viên',
      attendanceNumber: 'Mã chấm công',
      employmentType: 'Loại hợp đồng',
      end: 'Kết thúc',
      endDate: 'Ngày kết thúc',
      contractStatus: 'Trạng thái hợp đồng',
      contractType: 'Loại hợp đồng',
      contractStartDate: 'Ngày bắt đầu HĐ',
      contractEndDate: 'Ngày kết thúc HĐ',
      editingRange: 'Đang chỉnh',
      emergencyContact: 'Liên hệ khẩn cấp',
      estimatedPayroll: 'Lương tạm tính',
      exportFormat: 'Định dạng',
      exportLanguage: 'Ngôn ngữ',
      exportReport: 'Báo cáo',
      exportStore: 'Cơ sở',
      holidayHours: 'Giờ ngày lễ',
      hours: 'Giờ',
      hourlyRate: 'Lương gross theo giờ (đ)',
      monthlyGross: 'Lương gross tháng (đ)',
      missingDocuments: 'Thiếu chứng từ',
      filterByRole: 'Lọc theo vai trò',
      game: 'Trò chơi',
      guideGameplay: 'GamePlay',
      guideLanguage: 'Ngôn ngữ hướng dẫn',
      guideSummary: 'Tóm tắt hướng dẫn',
      guideTips: 'Mẹo hướng dẫn',
      gamePhoto: 'Ảnh trò chơi',
      games: 'Trò chơi',
      imageUrl: 'URL ảnh',
      includeAttachments: 'Kèm danh sách chứng từ',
      internalNote: 'Ghi chú nội bộ',
      jobTitle: 'Chức danh',
      department: 'Bộ phận',
      lateNoShow: 'Đi trễ / không đến',
      legalName: 'Tên pháp lý',
      leaveHours: 'Giờ nghỉ',
      leaveBalance: 'Phép còn lại',
      leaveType: 'Loại nghỉ',
      location: 'Cơ sở',
      mainWorkLocation: 'Cơ sở làm việc chính',
      payrollLocation: 'Cơ sở tính lương',
      managerNote: 'Ghi chú quản lý',
      maxPlayersArena: 'Số người tối đa / arena',
      maxPlayers: 'Số người tối đa',
      maxDiscountAmount: 'Giảm tối đa',
      maxUses: 'Số lần dùng tối đa',
      limitByHour: 'Giới hạn theo giờ',
      minPlayers: 'Số người tối thiểu',
      minimumSpend: 'Chi tiêu tối thiểu',
      name: 'Tên',
      newBooking: 'Đặt chỗ mới',
      nickname: 'Biệt danh',
      noLinkedOrder: 'Chưa có đơn liên kết',
      no: 'Không',
      noShows: 'Không đến',
      nightHours: 'Giờ đêm',
      nightWindow: 'Khung giờ đêm',
      notes: 'Ghi chú',
      order: 'Đơn',
      orderStatus: 'Trạng thái đơn',
      orders: 'Đơn hàng',
      off: 'Tắt',
      operationsCalendar: 'Lịch vận hành',
      operationsDate: 'Ngày vận hành',
      paid: 'Đã trả',
      payment: 'Thanh toán',
      paymentSplits: 'Tách thanh toán',
      paymentStatus: 'Trạng thái thanh toán',
      paymentMix: 'Cơ cấu thanh toán',
      payrollLink: 'Liên kết chấm công / lương',
      payrollNote: 'Ghi chú lương',
      payrollRun: 'Bảng lương',
      payrollCode: 'Mã bảng lương',
      payrollName: 'Tên bảng lương',
      payCycle: 'Chu kỳ lương',
      payslipPreview: 'Phiếu lương Việt Nam',
      periodStart: 'Bắt đầu kỳ',
      periodEnd: 'Kết thúc kỳ',
      perCustomerLimit: 'Giới hạn / khách',
      perVndSpent: 'Theo VND chi tiêu',
      phone: 'Điện thoại',
      personalEmail: 'Email cá nhân',
      personalPhone: 'SĐT cá nhân',
      profilePhoto: 'Ảnh hồ sơ',
      cvDocument: 'CV',
      profileCompletion: 'Độ hoàn thiện hồ sơ',
      players: 'Người chơi',
      addPlayer: 'Thêm người chơi',
      sessionFields: 'Thông tin phiên',
      participantResults: 'Kết quả người chơi',
      chapterTimes: 'Thời gian chapter',
      chapter: 'Chapter',
      score: 'Điểm',
      place: 'Hạng',
      accuracy: 'Độ chính xác',
      projectiles: 'Số phát bắn',
      escapeTime: 'Thời gian Escape',
      loyaltyPoints: 'Điểm thưởng',
      pointsEarned: 'Điểm nhận được',
      pointsExpireAfterDays: 'Điểm hết hạn sau số ngày',
      redeemValue: 'Giá trị đổi điểm',
      privateSession: 'Phiên riêng tư',
      priceArenaSlot: 'Giá / slot arena (đ)',
      pricePlayer: 'Giá / người (đ)',
      priceRule: 'Quy tắc giá',
      priceRules: 'Quy tắc giá',
      privateEmployeeProfile: 'Hồ sơ nhân viên riêng tư',
      address: 'Địa chỉ',
      dateOfBirth: 'Ngày sinh',
      gender: 'Giới tính',
      nationalId: 'CCCD/CMND',
      regularHours: 'Giờ thường',
      remaining: 'Còn lại',
      restoreDeletedRecords: 'Khôi phục dữ liệu đã xóa',
      referenceRange: 'Khoảng tham chiếu',
      reportRange: 'Khoảng báo cáo',
      roleExplanation: 'Giải thích vai trò',
      roleFor: 'Vai trò cho',
      roles: 'Vai trò',
      rounds: 'Vòng',
      rule: 'Quy tắc',
      ruleName: 'Tên quy tắc',
      sales: 'Doanh thu',
      salesTrend: 'Xu hướng doanh thu',
      revenueByDayOfWeek: 'Doanh thu theo ngày trong tuần',
      revenueByHour: 'Doanh thu theo giờ',
      searchUsers: 'Tìm người dùng',
      selectedRange: 'Khoảng đã chọn',
      sessions: 'Phiên',
      scheduledHours: 'Giờ đã xếp',
      shiftDate: 'Ngày ca',
      shiftList: 'Danh sách ca',
      shiftRole: 'Vị trí ca',
      scheduleScope: 'Chế độ xem lịch',
      shiftTemplate: 'Mẫu ca',
      sortBy: 'Sắp xếp theo',
      slug: 'Slug',
      standardDay: 'Độ dài ngày chuẩn',
      standardDayHelp: 'Dùng HH:mm. Ví dụ: 07:15 = 7 giờ 15 phút.',
      standardDayPresets: 'Mẫu ngày chuẩn',
      standardBreakMinutes: 'Phút nghỉ chuẩn',
      standardShiftTemplates: 'Mẫu ca chuẩn',
      standardWeek: 'Tuần chuẩn',
      start: 'Bắt đầu',
      startDate: 'Ngày bắt đầu',
      status: 'Trạng thái',
      staffMember: 'Nhân viên',
      socialInsurance: 'Mã BHXH',
      standardMonthlyDays: 'Ngày công chuẩn / tháng',
      standardMonthlyHours: 'Giờ công chuẩn / tháng',
      subtotal: 'Tạm tính',
      summary: 'Tóm tắt',
      taxCodeEmployee: 'Mã số thuế',
      time: 'Giờ',
      ticketBookings: 'Đặt vé',
      ticketType: 'Loại vé',
      total: 'Tổng',
      totalCompanyCost: 'Tổng chi phí công ty',
      totalGross: 'Tổng gross',
      totalNet: 'Tổng net',
      totalPaid: 'Đã thanh toán',
      totalSales: 'Tổng doanh thu',
      type: 'Loại',
      uniqueDiscount: 'Ưu đãi riêng',
      used: 'đã dùng',
      value: 'Giá trị',
      validFrom: 'Hiệu lực từ',
      validUntil: 'Hiệu lực đến',
      validUntilHelp: 'không bắt buộc, mặc định là mãi mãi',
      voucherCodeRequired: 'Mã voucher *',
      vouchers: 'Voucher',
      weeklyRange: 'Tuần',
      weeklySchedule: 'Lịch tuần',
      allDays: 'Tất cả ngày',
      allTicketTypes: 'Tất cả loại vé',
      overtimeHours: 'Giờ tăng ca',
      overtimePay: 'Tiền tăng ca',
      overtimeMonthlyCap: 'Giới hạn tăng ca / tháng',
      overtimeYearlyCap: 'Giới hạn tăng ca / năm',
      normalOvertimeMultiplier: 'Hệ số tăng ca thường',
      nightOvertimeMultiplier: 'Hệ số tăng ca đêm',
      holidayOvertimeMultiplier: 'Hệ số ngày lễ',
      lunchAllowance: 'Phụ cấp ăn trưa / ngày',
      restPeriodHours: 'Nghỉ tối thiểu (giờ)',
      restWarnings: 'Cảnh báo nghỉ',
      employeeContributionRate: 'Tỷ lệ NLĐ đóng %',
      employerContributionRate: 'Tỷ lệ công ty đóng %',
      pitWithholdingRate: 'Tạm khấu trừ TNCN %',
      dependentsCount: 'Người phụ thuộc',
      grossIncome: 'Thu nhập gross',
      netIncome: 'Thu nhập net',
      companyCost: 'Chi phí công ty',
      allowances: 'Phụ cấp',
      bonuses: 'Thưởng',
      advances: 'Tạm ứng',
      deductions: 'Khấu trừ',
      employeeContributions: 'NLĐ đóng',
      employerContributions: 'Công ty đóng',
      pitWithheld: 'TNCN tạm khấu trừ',
      outstandingDebt: 'Nợ còn lại',
      workedHours: 'Giờ làm',
      yes: 'Có',
    },
    loyaltyCalculation: {
      per_booking: 'Theo mỗi đặt chỗ',
      per_player: 'Theo mỗi người chơi',
      per_visit: 'Theo mỗi lượt đến/check-in',
      per_vnd_spent: 'Theo chi tiêu',
    } satisfies Record<StaffLoyaltyRule['calculation_type'], string>,
    messages: {
      clickUploadGamePhoto: 'Bấm để tải ảnh trò chơi',
      accountDeleteBanNote: 'Thông tin cấm sẽ gắn với hồ sơ đã xóa để kiểm tra sau.',
      accountDeleteBody: 'Thao tác này xóa mềm hồ sơ người dùng và gỡ khỏi danh sách đang hoạt động. Phiên chơi, điểm, đơn hàng và nhật ký lịch sử vẫn được giữ.',
      accountDeleteTitle: 'Xóa tài khoản?',
      operationDeleteBody: 'Mục này sẽ biến mất khỏi danh sách Phiên và Tickets. Người chơi liên quan được xóa và đơn hàng liên kết được chuyển sang đã hủy.',
      operationDeleteTitle: 'Xóa phiên hoặc vé này?',
      accountDeleted: 'Đã xóa tài khoản.',
      accountDeleting: 'Đang xóa tài khoản...',
      accountDeleteConfirmationHelp: 'Nhập chính xác DELETE để mở khóa thao tác này.',
      accountantExportHelp: 'Chọn bộ lọc, loại báo cáo và định dạng, rồi tải xuống.',
      accountantExportSourcePending: 'Bảng dữ liệu chi tiết chưa được cấu hình. File này gồm phần tóm tắt báo cáo đang có cho khoảng đã chọn.',
      attendanceIntro: 'Xếp ca, chấm công, nghỉ phép, tăng ca và kiểm tra quy định lao động Việt Nam trong một nơi.',
      attendanceReadOnly: 'Chế độ chỉ xem. Viewer có thể xem chấm công nhưng không thể lưu thay đổi.',
      attendanceRulesSaved: 'Đã lưu quy định chấm công.',
      attendanceSaved: 'Đã lưu chấm công.',
      customerAccountEmailRequired: 'Nhập email khách hàng.',
      customerAccountInvited: 'Đã tạo tài khoản khách hàng. Đã gửi yêu cầu tạo mật khẩu.',
      customerAccountNameRequired: 'Nhập tên khách hàng.',
      achievementAwarded: 'Đã mở khóa thành tựu cho người chơi.',
      achievementAlreadyAwarded: 'Người chơi đã có thành tựu này.',
      achievementAwardSelectPlayer: 'Chọn người chơi trước.',
      discountSaved: 'Đã lưu ưu đãi.',
      draftShiftCreated: 'Đã tạo ca nháp.',
      draftShiftExists: 'Ca nháp này đã tồn tại cho nhân viên và ngày này.',
      employeeProfileIntro: 'Thông tin nhân sự riêng tư được liên kết với chấm công và tính lương. Chỉ vai trò HR nội bộ xem được.',
      employeeProfileSaved: 'Đã lưu hồ sơ nhân viên.',
      hrIntro: 'Trung tâm HR của công ty cho hồ sơ nhân viên, lịch làm, bảng công, lương, phiếu lương, thưởng, tạm ứng và thiết lập.',
      hrSetupUnavailable: 'Áp dụng migration HR để lưu thiết lập HR, thưởng, bảng lương và tài liệu.',
      hrSettingsSaved: 'Đã lưu thiết lập HR.',
      hrSetupOptionSaved: 'Đã lưu tùy chọn HR.',
      adjustmentSaved: 'Đã lưu khoản điều chỉnh HR.',
      adjustmentApproved: 'Đã duyệt khoản điều chỉnh.',
      payrollGenerated: 'Đã tạo bảng lương nháp.',
      payrollApproved: 'Đã duyệt bảng lương.',
      profilePhotoHelp: 'JPG, PNG hoặc WEBP · tối đa 2 MB.',
      cvHelp: 'PDF, DOC hoặc DOCX · tối đa 10 MB.',
      profilePhotoTooLarge: 'Ảnh hồ sơ phải từ 2 MB trở xuống.',
      cvTooLarge: 'CV phải từ 10 MB trở xuống.',
      documentUploaded: 'Đã tải tài liệu.',
      documentUploadFailed: 'Tải tài liệu thất bại.',
      noAdjustments: 'Chưa có khoản điều chỉnh HR trong kỳ này.',
      noPayrollRuns: 'Chưa có bảng lương.',
      noHrDocuments: 'Chưa tải tài liệu HR.',
      noScheduleShifts: 'Chưa có ca làm trong kỳ này.',
      inactiveEmployeePlanningBlocked: 'Nhân viên ngưng làm: bật lại hồ sơ nhân viên trước khi xếp ca mới.',
      gamePhotoSmall: 'Ảnh trò chơi phải từ 2 MB trở xuống.',
      gamePhotoType: 'Ảnh trò chơi phải là JPG, PNG hoặc WEBP.',
      gamePhotoUploaded: 'Đã tải ảnh. Lưu trò chơi để giữ ảnh.',
      gameGuideHelp: 'Chọn ngôn ngữ, rồi sửa tóm tắt, GamePlay và mẹo chỉ cho trò chơi này. Mỗi dòng là một mục GamePlay hoặc mẹo.',
      gameSaved: 'Đã lưu trò chơi.',
      loyaltyIntro: 'Thiết lập cách khách hàng nhận điểm. Đổi điểm sẽ dùng các quy tắc này sau.',
      loyaltyRuleSaved: 'Đã lưu quy tắc điểm.',
      loyaltySingleActiveConfirm: 'Chỉ một quy tắc điểm được active. Lưu quy tắc này sẽ tắt {rule} nhưng vẫn giữ lại để phân tích. Tiếp tục?',
      loyaltyPointsUpdated: 'Đã cập nhật điểm thưởng.',
      loyaltyPointsUpdating: 'Đang cập nhật điểm thưởng...',
      leaveSaved: 'Đã lưu yêu cầu nghỉ phép.',
      leaveUpdated: 'Đã cập nhật yêu cầu nghỉ phép.',
      noAttendanceLogs: 'Chưa có chấm công trong tuần này.',
      noDiscounts: 'Chưa có ưu đãi.',
      noLeaveRequests: 'Chưa có yêu cầu nghỉ phép trong tuần này.',
      noLoyaltyRules: 'Chưa có quy tắc điểm.',
      noOrders: 'Không có đơn trong khoảng này.',
      noSales: 'Chưa có doanh thu trong kỳ này.',
      noShifts: 'Chưa có ca làm trong tuần này.',
      noStaffProfiles: 'Chưa có hồ sơ nhân viên.',
      noSoftDeleted: 'Không có dữ liệu xóa mềm.',
      noVouchers: 'Chưa có voucher.',
      orderConfirmed: 'Đơn {order} đã xác nhận · {total}',
      orderCreating: 'Đang tạo đơn...',
      orderUpdated: 'Đã cập nhật đơn.',
      priceRuleSaved: 'Đã lưu quy tắc giá.',
      readOnlyBooking: 'Chế độ chỉ xem. Viewer có thể xem luồng này nhưng không thể tạo đặt chỗ.',
      readOnlyCommerce: 'Chế độ chỉ xem. Viewer có thể xem quy tắc nhưng không thể lưu thay đổi.',
      readOnlyGames: 'Chế độ chỉ xem. Viewer có thể xem trò chơi nhưng không thể lưu thay đổi.',
      readOnlyPrices: 'Chế độ chỉ xem. Viewer có thể xem quy tắc giá nhưng không thể lưu thay đổi.',
      restoreIntro: 'Chỉ Owner. Khôi phục sẽ xóa deleted_at, deleted_by và delete_reason.',
      restoringRecord: 'Đang khôi phục...',
      recordRestored: 'Đã khôi phục dữ liệu.',
      roleSaveFailed: 'Chưa lưu được vai trò. Hãy chạy SQL Supabase mới nhất rồi thử lại.',
      roleSaveMismatch: 'Chưa lưu được vai trò. Supabase vẫn trả về vai trò khác.',
      roleUpdated: 'Đã cập nhật vai trò.',
      roleUpdating: 'Đang cập nhật vai trò...',
      shiftSaved: 'Đã lưu ca làm.',
      staffTooManyAttempts: 'Quá nhiều lần thử. Vui lòng chờ một chút rồi thử lại.',
      planningConflictDailyLimit: 'Vượt giờ chuẩn trong ngày.',
      planningConflictLeave: 'Có nghỉ phép đã duyệt trong ngày này.',
      planningConflictOverlap: 'Trùng ca khác.',
      planningGridHelp: 'Bấm ô để tạo ca nháp. Kéo thẻ ca để chuyển ngày/người.',
      previousWeekCopied: 'Đã sao chép tuần trước thành ca nháp.',
      previousWeekEmpty: 'Không có ca nào trong tuần trước.',
      previousWeekNoNew: 'Tuần này đã có các ca đó. Không sao chép thêm.',
      weekPublished: 'Đã công bố tuần.',
      uniqueDiscountHelp: 'Ưu đãi dùng một lần cho đặt chỗ này. Không tạo voucher dùng lại.',
      uploadGamePhoto: 'Đang tải ảnh trò chơi...',
      noOperationSessions: 'Không có phiên hoặc đặt vé trong ngày này.',
      operationsIntro: 'Quản lý phiên, đặt vé, sức chứa, thanh toán, check-in, người chơi và kết quả trong một nơi.',
      operationSessionSaved: 'Đã cập nhật phiên.',
      operationParticipantSaved: 'Đã cập nhật người chơi.',
      operationParticipantAdded: 'Đã thêm người chơi.',
      operationParticipantRemoved: 'Đã xóa người chơi.',
      operationSessionDeleted: 'Đã xóa phiên.',
      operationSessionDeleting: 'Đang xóa phiên...',
      voucherCodeRequired: 'Cần nhập mã voucher.',
      voucherSaved: 'Đã lưu voucher.',
    },
    orderStatuses: {
      cancelled: 'đã hủy',
      completed: 'hoàn tất',
      confirmed: 'đã xác nhận',
      draft: 'nháp',
      no_show: 'không đến',
      paid: 'đã thanh toán',
      partially_paid: 'thanh toán một phần',
      refunded: 'đã hoàn tiền',
    } satisfies Record<StaffOrder['order_status'], string>,
    paymentMethods: {
      bank_transfer: 'Chuyển khoản',
      cash: 'Tiền mặt',
    } satisfies Record<StaffPaymentMethod, string>,
    roles: {
      admin: 'Admin',
      cashier: 'Nhân viên văn phòng',
      manager: 'Quản lý',
      owner: 'Owner',
      player: 'Player',
      staff: 'Nhân viên',
      viewer: 'Viewer',
    } satisfies Record<StaffRole, string>,
    roleSorts: {
      created_desc: 'Mới tạo gần đây',
      email_asc: 'E-mail A-Z',
      name_asc: 'Tên A-Z',
      name_desc: 'Tên Z-A',
      role_asc: 'Vai trò thấp-cao',
      role_desc: 'Vai trò cao-thấp',
    } satisfies Record<StaffRoleSort, string>,
    reportRangePresets: {
      today: 'Phiên',
      yesterday: 'Hôm qua',
      this_week: 'Tuần này',
      last_week: 'Tuần trước',
      this_month: 'Tháng này',
      last_month: 'Tháng trước',
      last_30: '30 ngày qua',
      last_60: '60 ngày qua',
      last_90: '90 ngày qua',
    } satisfies Record<StaffReportRangePreset, string>,
    reportWeekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
    roleHelp: [
      { title: 'Owner', body: 'Toàn quyền Staff Console, quản lý vai trò, công cụ khôi phục và mọi tính năng khách hàng.' },
      { title: 'Admin', body: 'Toàn quyền vận hành hằng ngày và quản lý vai trò dưới Owner. Khôi phục chỉ dành cho Owner.' },
      { title: 'Manager', body: 'Quản lý trò chơi, giá, ưu đãi, voucher, điểm thưởng, đặt chỗ, đơn hàng và báo cáo.' },
      { title: 'Staff', body: 'Tạo đặt chỗ tại quầy, xem hôm nay, dùng ưu đãi hoặc voucher, quản lý đơn và xem báo cáo. Trong HR, Staff chỉ thấy hồ sơ nhân viên của chính mình.' },
      { title: 'Office Staff', body: 'Quyền xem như Viewer, được chỉnh báo cáo và toàn quyền chỉnh Chấm công.' },
      { title: 'Viewer', body: 'Dùng app như người chơi, xem toàn bộ Staff Console, chỉnh hoặc tải báo cáo. Dữ liệu staff còn lại chỉ xem.' },
      { title: 'Player', body: 'Chỉ có app khách hàng. Không có quyền Staff Console.' },
    ],
    tabs: {
      clientProfile: 'Hồ sơ khách',
      discounts: 'Ưu đãi',
      attendance: 'Chấm công',
      games: 'Trò chơi',
      hr: 'HR',
      new: 'Đặt chỗ mới',
      orders: 'Đơn hàng',
      prices: 'Giá',
      report: 'Báo cáo ngày',
      restore: 'Khôi phục',
      roles: 'Vai trò',
      today: 'Hôm nay',
    } satisfies Record<StaffTab, string>,
    tabGroups: {
      admin: 'Admin',
      operate: 'Vận hành',
      reports: 'Báo cáo',
      setup: 'Thiết lập',
      team: 'Nhân sự',
    } satisfies Record<StaffTabGroupId, string>,
  },
} as const

type StaffConsoleCopy = (typeof staffConsoleText)[StaffConsoleLanguage]

const accountantExportReports = [
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

const accountantExportFormats: AccountantExportFormat[] = ['excel', 'csv']
const accountantExportLanguages: StaffConsoleLanguage[] = ['vi', 'en']
const accountantExportStores = [
  { id: 'all', label: { en: 'All stores', vi: 'Tất cả cơ sở' } },
  { id: 'vrena-vietnam', label: { en: 'VRena Vietnam', vi: 'VRena Vietnam' } },
] satisfies Array<{ id: string; label: Record<StaffConsoleLanguage, string> }>
const defaultStaffShiftTemplates = [
  { id: 'opening', start_time: '09:00', end_time: '13:00', break_minutes: '0', shift_role: 'Staff' },
  { id: 'afternoon', start_time: '13:00', end_time: '18:00', break_minutes: '30', shift_role: 'Staff' },
  { id: 'evening', start_time: '18:00', end_time: '22:00', break_minutes: '0', shift_role: 'Staff' },
  { id: 'full_day', start_time: '09:00', end_time: '18:00', break_minutes: '60', shift_role: 'Staff' },
] satisfies StaffShiftTemplate[]

function normalizeStaffShiftTemplates(value: unknown, standardBreakMinutes = 60): StaffShiftTemplate[] {
  const source = Array.isArray(value) ? value : []
  return defaultStaffShiftTemplates.map((fallback) => {
    const incoming = source.find((item) => {
      if (!item || typeof item !== 'object') return false
      return (item as Partial<StaffShiftTemplate>).id === fallback.id
    }) as Partial<StaffShiftTemplate> | undefined
    const startTime = normalizeTime(incoming?.start_time) || fallback.start_time
    const endTime = normalizeTime(incoming?.end_time) || fallback.end_time
    const rawBreakMinutes = incoming?.break_minutes ?? fallback.break_minutes ?? standardBreakMinutes
    const parsedBreakMinutes = Number(rawBreakMinutes)
    const fallbackBreakMinutes = Number(fallback.break_minutes)
    const breakMinutes = Number.isFinite(parsedBreakMinutes)
      ? Math.max(0, Math.round(parsedBreakMinutes))
      : Number.isFinite(fallbackBreakMinutes)
        ? Math.max(0, Math.round(fallbackBreakMinutes))
        : Math.max(0, Math.round(Number(standardBreakMinutes) || 0))
    return {
      id: fallback.id,
      start_time: startTime,
      end_time: endTime,
      break_minutes: String(breakMinutes),
      shift_role: 'Staff',
    }
  })
}

function minutesSetting(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback
}

function resolveStaffConsoleLanguage(language?: string): StaffConsoleLanguage {
  return language === 'vi' ? 'vi' : 'en'
}

const todayString = () => {
  const date = new Date()
  return dateInputValue(date)
}

const shortDateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const staffDateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit' })
const staffMonthFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
const staffReportPresetOptions: StaffReportRangePreset[] = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30', 'last_60', 'last_90']

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

function addDays(value: string, days: number) {
  const date = dateFromInput(value)
  date.setDate(date.getDate() + days)
  return dateInputValue(date)
}

function addMonths(value: string, months: number) {
  const date = dateFromInput(value)
  date.setMonth(date.getMonth() + months)
  return dateInputValue(date)
}

function daysBetween(start: string, end: string) {
  return Math.round((dateFromInput(end).getTime() - dateFromInput(start).getTime()) / 86400000)
}

function orderedRange(start: string, end: string) {
  return start <= end ? [start, end] : [end, start]
}

function startOfWeek(value: string) {
  const date = dateFromInput(value)
  const weekday = date.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  date.setDate(date.getDate() + diff)
  return dateInputValue(date)
}

function startOfMonth(value: string) {
  const date = dateFromInput(value)
  return dateInputValue(new Date(date.getFullYear(), date.getMonth(), 1))
}

function endOfMonth(value: string) {
  const date = dateFromInput(value)
  return dateInputValue(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function previousPeriodRange(start: string, end: string) {
  const [from, to] = orderedRange(start, end)
  const periodDays = Math.max(1, daysBetween(from, to) + 1)
  const previousEnd = addDays(from, -1)
  const previousStart = addDays(previousEnd, -(periodDays - 1))
  return [previousStart, previousEnd] as const
}

function reportPresetRange(preset: StaffReportRangePreset, anchor = todayString()) {
  if (preset === 'today') return [anchor, anchor] as const
  if (preset === 'yesterday') {
    const yesterday = addDays(anchor, -1)
    return [yesterday, yesterday] as const
  }
  if (preset === 'this_week') {
    const start = startOfWeek(anchor)
    return [start, addDays(start, 6)] as const
  }
  if (preset === 'last_week') {
    const end = addDays(startOfWeek(anchor), -1)
    return [addDays(end, -6), end] as const
  }
  if (preset === 'this_month') return [startOfMonth(anchor), endOfMonth(anchor)] as const
  if (preset === 'last_month') {
    const previousMonth = addMonths(startOfMonth(anchor), -1)
    return [startOfMonth(previousMonth), endOfMonth(previousMonth)] as const
  }
  if (preset === 'last_60') return [addDays(anchor, -59), anchor] as const
  if (preset === 'last_90') return [addDays(anchor, -89), anchor] as const
  return [addDays(anchor, -29), anchor] as const
}

function monthLabel(value: string) {
  return staffMonthFormatter.format(dateFromInput(value))
}

type StaffReportCalendarCell = {
  date: string
  day: number
  inMonth: boolean
}

function reportCalendarCells(monthValue: string) {
  const monthStart = startOfMonth(monthValue)
  const monthDate = dateFromInput(monthStart)
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstWeekday = (monthDate.getDay() + 6) % 7
  const lastDay = new Date(year, month + 1, 0).getDate()
  const cells: StaffReportCalendarCell[] = []

  for (let index = 0; index < firstWeekday; index += 1) {
    const date = addDays(monthStart, index - firstWeekday)
    cells.push({ date, day: dateFromInput(date).getDate(), inMonth: false })
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const date = dateInputValue(new Date(year, month, day))
    cells.push({ date, day, inMonth: true })
  }

  while (cells.length % 7 !== 0) {
    const previous = cells[cells.length - 1]?.date || monthStart
    const date = addDays(previous, 1)
    cells.push({ date, day: dateFromInput(date).getDate(), inMonth: false })
  }

  return cells
}

function shortDateLabel(value: string) {
  return shortDateFormatter.format(dateFromInput(value))
}

function staffDateLabel(value: string) {
  return value ? staffDateFormatter.format(dateFromInput(value)) : ''
}

function rangeLabel(start: string, end: string) {
  return start === end ? shortDateLabel(start) : `${shortDateLabel(start)} - ${shortDateLabel(end)}`
}

function attendanceWeekRange(anchor: string) {
  const start = startOfWeek(anchor)
  return [start, addDays(start, 6)] as const
}

function attendanceDateRange(start: string, end: string) {
  const normalizedStart = start || todayString()
  const normalizedEnd = end || normalizedStart
  const [orderedStart, orderedEnd] = normalizedStart <= normalizedEnd
    ? [normalizedStart, normalizedEnd]
    : [normalizedEnd, normalizedStart]
  const maxEnd = addDays(orderedStart, 30)
  return [orderedStart, orderedEnd > maxEnd ? maxEnd : orderedEnd] as const
}

function attendanceRangeLength(start: string, end: string) {
  const startTime = dateFromInput(start).getTime()
  const endTime = dateFromInput(end).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 7
  return Math.max(1, Math.min(31, Math.round((endTime - startTime) / 86400000) + 1))
}

function attendanceDateKeys(start: string, end: string) {
  const dayCount = attendanceRangeLength(start, end)
  return Array.from({ length: dayCount }, (_, index) => addDays(start, index))
}

function localDateTimeIso(dateValue: string, timeValue: string) {
  const normalized = normalizeTime(timeValue) || '00:00'
  return new Date(`${dateValue}T${normalized}:00`).toISOString()
}

function timeValueFromIso(value?: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return normalizeTime(value)
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

function parseMinutesTime(value?: string | null) {
  const [hour, minute] = normalizeTime(value).split(':').map(Number)
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : 0
}

function durationTimeValue(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(Number(minutes) || 0)))
  const hours = Math.floor(safeMinutes / 60)
  const minute = safeMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function minutesBetweenTimes(start?: string | null, end?: string | null, breakMinutes = 0) {
  const startMinutes = parseMinutesTime(start)
  let endMinutes = parseMinutesTime(end)
  if (endMinutes < startMinutes) endMinutes += 24 * 60
  return Math.max(0, endMinutes - startMinutes - breakMinutes)
}

function minutesBetween(startIso?: string | null, endIso?: string | null, breakMinutes = 0) {
  if (!startIso || !endIso) return 0
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, Math.round((end - start) / 60000) - breakMinutes)
}

function hoursLabel(minutes: number) {
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`
}

function activeShift(shift: StaffScheduleShift) {
  return shift.status !== 'cancelled'
}

function timeRangesOverlap(
  leftStart: string | null | undefined,
  leftEnd: string | null | undefined,
  rightStart: string | null | undefined,
  rightEnd: string | null | undefined
) {
  const leftStartMinutes = parseMinutesTime(leftStart)
  let leftEndMinutes = parseMinutesTime(leftEnd)
  const rightStartMinutes = parseMinutesTime(rightStart)
  let rightEndMinutes = parseMinutesTime(rightEnd)
  if (leftEndMinutes <= leftStartMinutes) leftEndMinutes += 24 * 60
  if (rightEndMinutes <= rightStartMinutes) rightEndMinutes += 24 * 60
  return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes
}

function shiftConflictWarnings(
  shift: StaffScheduleShift,
  shifts: StaffScheduleShift[],
  requests: StaffLeaveRequest[],
  settings: StaffAttendanceSettings,
  text: StaffConsoleCopy
) {
  if (!activeShift(shift)) return []
  const warnings: string[] = []
  const hasOverlap = shifts.some((item) => (
    item.id !== shift.id
    && activeShift(item)
    && item.staff_profile_id === shift.staff_profile_id
    && item.shift_date === shift.shift_date
    && timeRangesOverlap(shift.start_time, shift.end_time, item.start_time, item.end_time)
  ))
  if (hasOverlap) warnings.push(text.messages.planningConflictOverlap)

  const hasApprovedLeave = requests.some((item) => (
    item.status === 'approved'
    && item.staff_profile_id === shift.staff_profile_id
    && item.start_date <= shift.shift_date
    && item.end_date >= shift.shift_date
  ))
  if (hasApprovedLeave) warnings.push(text.messages.planningConflictLeave)

  const scheduledMinutes = shifts
    .filter((item) => activeShift(item) && item.staff_profile_id === shift.staff_profile_id && item.shift_date === shift.shift_date)
    .reduce((sum, item) => sum + minutesBetweenTimes(item.start_time, item.end_time, item.break_minutes), 0)
  if (settings.standard_daily_minutes > 0 && scheduledMinutes > settings.standard_daily_minutes) {
    warnings.push(text.messages.planningConflictDailyLimit)
  }

  return Array.from(new Set(warnings))
}

function normalizeStaffGender(value: string | null | undefined): StaffGender | '' {
  return staffGenderOptions.includes(value as StaffGender) ? (value as StaffGender) : ''
}

function normalizeStaffContractStatus(value: string | null | undefined): StaffContractStatus {
  return staffContractStatuses.includes(value as StaffContractStatus) ? (value as StaffContractStatus) : 'active'
}

function normalizeHrAdjustmentType(value: string | null | undefined): StaffHrAdjustmentType {
  return staffHrAdjustmentTypes.includes(value as StaffHrAdjustmentType) ? (value as StaffHrAdjustmentType) : 'bonus'
}

function normalizeHrAdjustmentStatus(value: string | null | undefined): StaffHrAdjustmentStatus {
  return staffHrAdjustmentStatuses.includes(value as StaffHrAdjustmentStatus) ? (value as StaffHrAdjustmentStatus) : 'pending'
}

function normalizePayrollStatus(value: string | null | undefined): StaffPayrollStatus {
  return staffPayrollStatuses.includes(value as StaffPayrollStatus) ? (value as StaffPayrollStatus) : 'draft'
}

function normalizePayrollPayCycle(value: string | null | undefined): StaffPayrollPayCycle {
  return staffPayrollPayCycles.includes(value as StaffPayrollPayCycle) ? (value as StaffPayrollPayCycle) : 'monthly'
}

function decimalInput(value: string | number | null | undefined) {
  const amount = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(amount) ? Math.max(0, amount) : 0
}

function isStaffHrSchemaUnavailable(error?: { code?: string; message?: string } | null) {
  if (!error) return false
  const message = (error.message || '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === '42501' ||
    message.includes('permission denied') ||
    message.includes('schema cache') ||
    message.includes('staff_hr_') ||
    message.includes('staff_payroll_')
  )
}

function dateWithinRange(value: string | null | undefined, start: string, end: string) {
  return Boolean(value && value >= start && value <= end)
}

function adjustmentAppliesToPeriod(adjustment: StaffHrAdjustment, start: string, end: string) {
  if (adjustment.period_start && adjustment.period_end) {
    return adjustment.period_start <= end && adjustment.period_end >= start
  }
  return dateWithinRange(adjustment.effective_date, start, end)
}

function employeeRate(value: number | null | undefined, fallback: number) {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : fallback
}

function employeeRestPeriodMinutes(employee: StaffEmployeeProfile | undefined, settings: StaffHrSettings) {
  return Math.max(0, Number(employee?.rest_period_minutes ?? settings.rest_period_minutes) || 0)
}

function shiftStartDateTime(shift: StaffScheduleShift) {
  return new Date(`${shift.shift_date}T${normalizeTime(shift.start_time) || '00:00'}:00`).getTime()
}

function shiftEndDateTime(shift: StaffScheduleShift) {
  const start = shiftStartDateTime(shift)
  const minutes = minutesBetweenTimes(shift.start_time, shift.end_time, 0)
  return start + minutes * 60000
}

function countRestPeriodWarnings(shifts: StaffScheduleShift[], restPeriodMinutes: number) {
  if (restPeriodMinutes <= 0) return 0
  const activeShifts = shifts.filter(activeShift).sort((left, right) => shiftStartDateTime(left) - shiftStartDateTime(right))
  return activeShifts.reduce((count, shift, index) => {
    const previous = activeShifts[index - 1]
    if (!previous) return count
    const gapMinutes = Math.round((shiftStartDateTime(shift) - shiftEndDateTime(previous)) / 60000)
    return gapMinutes >= 0 && gapMinutes < restPeriodMinutes ? count + 1 : count
  }, 0)
}

function calculateStaffPayroll(
  staffProfileId: string,
  employee: StaffEmployeeProfile | undefined,
  shifts: StaffScheduleShift[],
  logs: StaffAttendanceLog[],
  leaves: StaffLeaveRequest[],
  adjustments: StaffHrAdjustment[],
  settings: StaffHrSettings,
  periodStart: string,
  periodEnd: string,
): StaffPayrollCalculation {
  const employeeShifts = shifts.filter((shift) => shift.staff_profile_id === staffProfileId && shift.shift_date >= periodStart && shift.shift_date <= periodEnd && activeShift(shift))
  const employeeLogs = logs.filter((log) => log.staff_profile_id === staffProfileId && log.work_date >= periodStart && log.work_date <= periodEnd)
  const employeeLeaves = leaves.filter((leave) => leave.staff_profile_id === staffProfileId && leave.status === 'approved' && leave.end_date >= periodStart && leave.start_date <= periodEnd)
  const employeeAdjustments = adjustments.filter((adjustment) => (
    adjustment.profile_id === staffProfileId &&
    ['approved', 'paid'].includes(adjustment.status) &&
    adjustmentAppliesToPeriod(adjustment, periodStart, periodEnd)
  ))

  const scheduledMinutes = employeeShifts.reduce((sum, shift) => sum + minutesBetweenTimes(shift.start_time, shift.end_time, shift.break_minutes), 0)
  const workedMinutes = employeeLogs.reduce((sum, log) => sum + minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes), 0)
  const regularMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.regular_minutes) || 0), 0)
  const computedOvertimeMinutes = Math.max(0, workedMinutes - (regularMinutes || Math.min(workedMinutes, scheduledMinutes)))
  const overtimeMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.overtime_minutes) || 0), 0) || computedOvertimeMinutes
  const nightMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.night_minutes) || 0), 0)
  const holidayMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.holiday_minutes) || 0), 0)
  const paidLeaveHours = employeeLeaves.reduce((sum, leave) => sum + Math.max(0, Number(leave.hours) || 0), 0)
  const workedDays = new Set(employeeLogs.filter((log) => minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes) > 0).map((log) => log.work_date)).size
  const annualEntitlement = Math.max(0, Number(employee?.contract_status === 'ended' ? 0 : settings.annual_leave_days) || 0)
  const leaveBalanceDays = Math.max(0, annualEntitlement - (paidLeaveHours / Math.max(1, settings.standard_monthly_hours / settings.standard_monthly_days)))
  const hourlyRate = employee?.hourly_rate_vnd || (employee?.base_salary_vnd ? employee.base_salary_vnd / Math.max(1, settings.standard_monthly_hours) : 0)
  const monthlyBasePay = isMonthlyGrossEmployment(employee?.employment_type) ? Math.max(0, Number(employee?.base_salary_vnd) || 0) : 0
  const hourlyBasePay = monthlyBasePay > 0 ? monthlyBasePay : Math.round((workedMinutes / 60) * Math.max(0, hourlyRate))
  const overtimeMultiplier = employeeRate(employee?.overtime_rate_multiplier, settings.normal_overtime_multiplier)
  const nightMultiplier = employeeRate(employee?.night_rate_multiplier, settings.night_overtime_multiplier)
  const holidayMultiplier = employeeRate(employee?.holiday_rate_multiplier, settings.holiday_overtime_multiplier)
  const overtimePay = Math.round(
    (overtimeMinutes / 60) * hourlyRate * overtimeMultiplier +
    (nightMinutes / 60) * hourlyRate * Math.max(0, nightMultiplier - 1) +
    (holidayMinutes / 60) * hourlyRate * Math.max(0, holidayMultiplier - 1)
  )
  const lunchAllowance = employee?.lunch_allowance_vnd ?? settings.lunch_allowance_vnd
  const autoLunchAllowance = Math.round(Math.max(0, lunchAllowance) * workedDays)
  const allowances = autoLunchAllowance + employeeAdjustments
    .filter((item) => ['allowance', 'lunch_allowance'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const bonuses = employeeAdjustments
    .filter((item) => ['bonus', 'commission'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const advances = employeeAdjustments
    .filter((item) => ['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const deductions = employeeAdjustments
    .filter((item) => item.adjustment_type === 'deduction')
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const basePay = Math.max(0, hourlyBasePay)
  const grossIncome = Math.max(0, basePay + overtimePay + allowances + bonuses)
  const employeeContributionRate = employeeRate(employee?.employee_contribution_rate, settings.employee_contribution_rate)
  const employerContributionRate = employeeRate(employee?.employer_contribution_rate, settings.employer_contribution_rate)
  const pitRate = employeeRate(employee?.pit_withholding_rate, settings.pit_withholding_rate)
  const employeeContributions = Math.round(grossIncome * employeeContributionRate / 100)
  const employerContributions = Math.round(grossIncome * employerContributionRate / 100)
  const taxableIncome = Math.max(0, grossIncome - employeeContributions - deductions - advances)
  const pitWithheld = Math.round(taxableIncome * pitRate / 100)
  const netIncome = Math.max(0, grossIncome - employeeContributions - pitWithheld - deductions - advances)
  const companyCost = Math.max(0, grossIncome + employerContributions)

  return {
    profileId: staffProfileId,
    scheduledMinutes,
    workedMinutes,
    regularMinutes,
    overtimeMinutes,
    nightMinutes,
    holidayMinutes,
    paidLeaveHours,
    leaveBalanceDays,
    restWarningCount: countRestPeriodWarnings(employeeShifts, employeeRestPeriodMinutes(employee, settings)),
    basePay,
    overtimePay,
    allowances,
    bonuses,
    advances,
    deductions,
    employeeContributions,
    employerContributions,
    pitWithheld,
    grossIncome,
    netIncome,
    companyCost,
  }
}

function emptyStaffPayrollCalculation(profileId = ''): StaffPayrollCalculation {
  return {
    profileId,
    scheduledMinutes: 0,
    workedMinutes: 0,
    regularMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
    holidayMinutes: 0,
    paidLeaveHours: 0,
    leaveBalanceDays: 0,
    restWarningCount: 0,
    basePay: 0,
    overtimePay: 0,
    allowances: 0,
    bonuses: 0,
    advances: 0,
    deductions: 0,
    employeeContributions: 0,
    employerContributions: 0,
    pitWithheld: 0,
    grossIncome: 0,
    netIncome: 0,
    companyCost: 0,
  }
}

type StaffPickerFieldProps = {
  ariaLabel: string
  type: 'date' | 'time'
  value: string
  mode?: 'clock' | 'duration'
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
}

const staffTimeOptions = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4)
  const minute = String((index % 4) * 15).padStart(2, '0')
  return `${String(hour).padStart(2, '0')}:${minute}`
})

function normalizeTypedStaffTime(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/[h.]/, ':')
  const colonMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (colonMatch) return `${colonMatch[1].padStart(2, '0')}:${colonMatch[2]}`

  const compactMatch = trimmed.match(/^([01]?\d|2[0-3])([0-5]\d)$/)
  if (compactMatch) return `${compactMatch[1].padStart(2, '0')}:${compactMatch[2]}`

  const hourMatch = trimmed.match(/^([01]?\d|2[0-3])$/)
  if (hourMatch) return `${hourMatch[1].padStart(2, '0')}:00`

  return ''
}

function normalizeTypedStaffDuration(value: string) {
  const trimmed = value.trim().toLowerCase()
  const decimalMatch = trimmed.match(/^(\d{1,2})(?:[.,](\d{1,2}))$/)
  if (decimalMatch) {
    const hours = Number(decimalMatch[1])
    const fraction = Number(`0.${decimalMatch[2]}`)
    if (Number.isFinite(hours) && Number.isFinite(fraction)) {
      return durationTimeValue((hours * 60) + Math.round(fraction * 60))
    }
  }

  return normalizeTypedStaffTime(value)
}

function StaffPickerField({ ariaLabel, type, value, mode = 'clock', placeholder, inputRef, onChange }: StaffPickerFieldProps) {
  const displayValue = type === 'date' ? staffDateLabel(value) : normalizeTime(value)
  const fallback = placeholder || (type === 'date' ? 'Choose date' : 'Choose time')
  const [timeOpen, setTimeOpen] = useState(false)
  const [timeDraft, setTimeDraft] = useState<string | null>(null)
  const timePickerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!timeOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (timePickerRef.current?.contains(event.target as Node)) return
      setTimeOpen(false)
      setTimeDraft(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setTimeOpen(false)
      setTimeDraft(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [timeOpen])

  if (type === 'time') {
    const normalizedTime = normalizeTime(value)
    const manualTime = timeDraft ?? normalizedTime

    const commitManualTime = () => {
      if (timeDraft === null) return
      const normalizedDraft = mode === 'duration'
        ? normalizeTypedStaffDuration(timeDraft)
        : normalizeTypedStaffTime(timeDraft)
      if (normalizedDraft) onChange(normalizedDraft)
      setTimeDraft(null)
      setTimeOpen(false)
    }

    return (
      <span ref={timePickerRef} className={displayValue ? 'staff-picker-shell staff-time-picker' : 'staff-picker-shell staff-time-picker placeholder'}>
        <button
          aria-expanded={timeOpen}
          aria-label={ariaLabel}
          className="staff-time-trigger"
          type="button"
          onClick={() => {
            setTimeOpen((open) => !open)
            setTimeDraft(null)
          }}
        >
          <span className="staff-picker-display">{displayValue || fallback}</span>
        </button>
        {timeOpen ? (
          <span className="staff-time-panel">
            <input
              aria-label={`${ariaLabel}: type a specific time`}
              autoFocus
              className="staff-time-manual"
              inputMode="numeric"
              placeholder="HH:mm"
              value={manualTime}
              onBlur={commitManualTime}
              onChange={(event) => setTimeDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitManualTime()
                }
              }}
            />
            <span aria-label={ariaLabel} className="staff-time-option-list" role="listbox">
              {staffTimeOptions.map((option) => (
                <button
                  aria-selected={normalizedTime === option}
                  className={normalizedTime === option ? 'staff-time-option active' : 'staff-time-option'}
                  key={option}
                  role="option"
                  type="button"
                  onClick={() => {
                    onChange(option)
                    setTimeDraft(null)
                    setTimeOpen(false)
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {option}
                </button>
              ))}
            </span>
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <span className={displayValue ? 'staff-picker-shell' : 'staff-picker-shell placeholder'}>
      <input
        aria-label={ariaLabel}
        className="staff-picker-native"
        ref={inputRef}
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          event.currentTarget.blur()
        }}
      />
      <span className="staff-picker-display">{displayValue || fallback}</span>
    </span>
  )
}

function newPaymentSplit(method: StaffPaymentMethod = 'cash', amount = ''): PaymentSplitDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    payment_method: method,
    amount,
  }
}

const defaultBookingForm = (): BookingForm => ({
  customerId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  gameId: '',
  date: todayString(),
  time: '09:00',
  players: 1,
  arenaId: 'arena-1',
  discountId: '',
  manualDiscountType: '',
  manualDiscountValue: 0,
  paymentSplits: [newPaymentSplit('cash')],
  orderStatus: 'confirmed',
  invoiceRequired: false,
  companyName: '',
  taxCode: '',
  invoiceEmail: '',
  invoiceAddress: '',
  note: '',
})

const defaultCustomerInviteForm = (): CustomerInviteForm => ({
  fullName: '',
  email: '',
  phone: '',
  nickname: '',
})

const defaultGameForm = () => ({
  id: '',
  slug: '',
  name: '',
  game_type: 'shooting' as StaffGame['game_type'],
  duration_minutes: 20,
  max_players_per_arena: 4,
  number_of_rounds: 1,
  escape_chapter_count: 1,
  description: '',
  audience: [] as StaffAudience[],
  guide_language: 'en' as LanguageCode,
  guide_summary: {} as StaffGuideTextMap,
  guide_rules: {} as StaffGuideTextMap,
  guide_tips: {} as StaffGuideTextMap,
  image_url: '',
  active: true,
  available_arena_ids: 'arena-1, arena-2',
})

const defaultPriceForm = () => ({
  id: '',
  rule_name: '',
  game_id: '',
  day_type: 'weekday' as StaffPriceRule['day_type'],
  time_start: '09:00',
  time_end: '18:00',
  price_per_player: '200000',
  price_per_arena_slot: '',
  valid_from: todayString(),
  valid_until: '',
  active: true,
})

const defaultDiscountForm = () => ({
  id: '',
  code: '',
  name: '',
  game_id: '',
  price_rule_id: '',
  min_players: '',
  max_players: '',
  day_scope: 'all' as StaffDiscountDayScope,
  time_start: '',
  time_end: '',
  ticket_type: 'all' as StaffDiscountTicketType,
  min_order_total: 0,
  max_discount_amount: '',
  per_customer_limit: '',
  discount_type: 'percentage' as StaffDiscount['discount_type'],
  value: 10,
  valid_from: todayString(),
  valid_until: '',
  max_uses: '',
  active: true,
})

const defaultLoyaltyForm = () => ({
  id: '',
  rule_name: '',
  game_id: '',
  calculation_type: 'per_vnd_spent' as StaffLoyaltyRule['calculation_type'],
  points_value: 1,
  spend_amount: 100000,
  min_order_total: 0,
  redeem_value_vnd_per_point: 0,
  earn_trigger: 'session_payment_confirmed' as StaffLoyaltyRule['earn_trigger'],
  rounding_rule: 'floor_whole_points' as StaffLoyaltyRule['rounding_rule'],
  point_expiry_days: '365',
  valid_from: todayString(),
  valid_until: '',
  active: true,
  notes: '',
})

const defaultAttendanceSettings = (): StaffAttendanceSettings => ({
  id: 'default',
  location: 'VRena',
  standard_daily_minutes: 480,
  standard_weekly_minutes: 2880,
  standard_break_minutes: 60,
  overtime_monthly_cap_minutes: 2400,
  overtime_yearly_cap_minutes: 12000,
  night_start: '22:00',
  night_end: '06:00',
  annual_leave_days: 12,
  shift_templates: normalizeStaffShiftTemplates(defaultStaffShiftTemplates, 60),
  updated_by: null,
  updated_at: null,
})

function normalizeAttendanceSettings(value?: Partial<StaffAttendanceSettings> | null): StaffAttendanceSettings {
  const fallback = defaultAttendanceSettings()
  const standardBreakMinutes = minutesSetting(value?.standard_break_minutes, fallback.standard_break_minutes)
  return {
    ...fallback,
    ...(value || {}),
    location: String(value?.location || fallback.location),
    standard_daily_minutes: minutesSetting(value?.standard_daily_minutes, fallback.standard_daily_minutes),
    standard_weekly_minutes: minutesSetting(value?.standard_weekly_minutes, fallback.standard_weekly_minutes),
    standard_break_minutes: standardBreakMinutes,
    overtime_monthly_cap_minutes: minutesSetting(value?.overtime_monthly_cap_minutes, fallback.overtime_monthly_cap_minutes),
    overtime_yearly_cap_minutes: minutesSetting(value?.overtime_yearly_cap_minutes, fallback.overtime_yearly_cap_minutes),
    night_start: normalizeTime(value?.night_start) || fallback.night_start,
    night_end: normalizeTime(value?.night_end) || fallback.night_end,
    annual_leave_days: Math.max(0, Number(value?.annual_leave_days ?? fallback.annual_leave_days) || 0),
    shift_templates: normalizeStaffShiftTemplates(value?.shift_templates, standardBreakMinutes),
    updated_by: value?.updated_by ?? fallback.updated_by,
    updated_at: value?.updated_at ?? fallback.updated_at,
  }
}

const defaultHrSettings = (): StaffHrSettings => ({
  id: 'default',
  currency: 'VND',
  standard_monthly_days: 26,
  standard_monthly_hours: 208,
  rest_period_minutes: 660,
  normal_overtime_multiplier: 1.5,
  night_overtime_multiplier: 2,
  holiday_overtime_multiplier: 3,
  lunch_allowance_vnd: 0,
  annual_leave_days: 12,
  employee_contribution_rate: 10.5,
  employer_contribution_rate: 21.5,
  pit_withholding_rate: 10,
  payslip_note: '',
  updated_by: null,
  updated_at: null,
})

function normalizeHrSettings(value?: Partial<StaffHrSettings> | null): StaffHrSettings {
  const fallback = defaultHrSettings()
  return {
    ...fallback,
    ...(value || {}),
    currency: String(value?.currency || fallback.currency),
    standard_monthly_days: Math.max(1, Number(value?.standard_monthly_days ?? fallback.standard_monthly_days) || fallback.standard_monthly_days),
    standard_monthly_hours: Math.max(1, Number(value?.standard_monthly_hours ?? fallback.standard_monthly_hours) || fallback.standard_monthly_hours),
    rest_period_minutes: minutesSetting(value?.rest_period_minutes, fallback.rest_period_minutes),
    normal_overtime_multiplier: Math.max(0, Number(value?.normal_overtime_multiplier ?? fallback.normal_overtime_multiplier) || 0),
    night_overtime_multiplier: Math.max(0, Number(value?.night_overtime_multiplier ?? fallback.night_overtime_multiplier) || 0),
    holiday_overtime_multiplier: Math.max(0, Number(value?.holiday_overtime_multiplier ?? fallback.holiday_overtime_multiplier) || 0),
    lunch_allowance_vnd: Math.max(0, Number(value?.lunch_allowance_vnd ?? fallback.lunch_allowance_vnd) || 0),
    annual_leave_days: Math.max(0, Number(value?.annual_leave_days ?? fallback.annual_leave_days) || 0),
    employee_contribution_rate: Math.max(0, Number(value?.employee_contribution_rate ?? fallback.employee_contribution_rate) || 0),
    employer_contribution_rate: Math.max(0, Number(value?.employer_contribution_rate ?? fallback.employer_contribution_rate) || 0),
    pit_withholding_rate: Math.max(0, Number(value?.pit_withholding_rate ?? fallback.pit_withholding_rate) || 0),
    payslip_note: value?.payslip_note ?? fallback.payslip_note,
    updated_by: value?.updated_by ?? fallback.updated_by,
    updated_at: value?.updated_at ?? fallback.updated_at,
  }
}

const defaultShiftForm = (settings?: StaffAttendanceSettings) => ({
  id: '',
  staff_profile_id: '',
  location: settings?.location || 'VRena',
  shift_role: 'Staff',
  shift_date: todayString(),
  start_time: '09:00',
  end_time: '18:00',
  break_minutes: String(settings?.standard_break_minutes ?? 60),
  status: 'published' as StaffShiftStatus,
  notes: '',
})

const defaultAttendanceLogForm = () => ({
  id: '',
  staff_profile_id: '',
  shift_id: '',
  work_date: todayString(),
  clock_in_time: '09:00',
  clock_out_time: '18:00',
  break_minutes: '60',
  status: 'present' as StaffAttendanceStatus,
  regular_minutes: '8',
  overtime_minutes: '0',
  night_minutes: '0',
  holiday_minutes: '0',
  manager_note: '',
})

const defaultLeaveForm = () => ({
  id: '',
  staff_profile_id: '',
  leave_type: 'annual' as StaffLeaveType,
  start_date: todayString(),
  end_date: todayString(),
  hours: '8',
  reason: '',
})

const defaultEmployeeForm = () => ({
  profile_id: '',
  employee_code: '',
  attendance_number: '',
  legal_name: '',
  personal_phone: '',
  personal_email: '',
  national_id: '',
  date_of_birth: '',
  gender: '',
  address: '',
  department: '',
  job_title: '',
  employment_type: 'part_time' as StaffEmploymentType,
  main_work_location: '',
  payroll_location: '',
  contract_status: 'active' as StaffContractStatus,
  contract_type: '',
  contract_start_date: '',
  contract_end_date: '',
  start_date: '',
  end_date: '',
  base_salary_vnd: '',
  hourly_rate_vnd: '',
  lunch_allowance_vnd: '',
  rest_period_hours: '',
  overtime_rate_multiplier: '',
  night_rate_multiplier: '',
  holiday_rate_multiplier: '',
  employee_contribution_rate: '',
  employer_contribution_rate: '',
  pit_withholding_rate: '',
  dependents_count: '0',
  bank_name: '',
  bank_account_number: '',
  tax_code: '',
  social_insurance_number: '',
  emergency_contact: '',
  payroll_note: '',
  profile_photo_path: '',
  cv_document_path: '',
  active: true,
})

const defaultHrAdjustmentForm = (profileId = '', type: StaffHrAdjustmentType = 'bonus') => ({
  id: '',
  profile_id: profileId,
  adjustment_type: type,
  title: '',
  amount_vnd: '',
  effective_date: todayString(),
  period_start: startOfMonth(todayString()),
  period_end: endOfMonth(todayString()),
  status: 'pending' as StaffHrAdjustmentStatus,
  notes: '',
})

const defaultPayrollRunForm = () => ({
  id: '',
  code: `PAY-${todayString().slice(0, 7).replace('-', '')}`,
  name: `Payroll ${todayString().slice(0, 7)}`,
  pay_cycle: 'monthly' as StaffPayrollPayCycle,
  period_start: startOfMonth(todayString()),
  period_end: endOfMonth(todayString()),
  notes: '',
})

const defaultHrSetupForm = (): Record<StaffHrSetupOptionType, string> => ({
  department: '',
  job_title: '',
  location: '',
  contract_status: '',
  contract_type: '',
  employment_type: '',
})

const paymentMethods = ['cash', 'bank_transfer'] as const
const orderStatuses = ['draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed'] as const
const gameTypes = ['shooting', 'escape', 'tournament', 'other'] as const
const dayTypes = ['weekday', 'weekend', 'holiday', 'custom'] as const
const discountTypes = ['percentage', 'fixed_amount', 'free_ticket', 'birthday', 'resident', 'group'] as const
const loyaltyCalculationTypes = ['per_vnd_spent', 'per_booking', 'per_player', 'per_visit'] as const
const staffCommerceTabs: StaffCommerceTab[] = ['discounts', 'vouchers', 'loyalty']
const staffAttendanceTabs: StaffAttendanceTab[] = ['schedule', 'clock', 'timesheet', 'leave', 'settings']
const staffHrTabs: StaffHrTab[] = ['employees', 'schedule', 'timesheet', 'payroll', 'adjustments', 'advances', 'settings']
const staffShiftStatuses: StaffShiftStatus[] = ['draft', 'published', 'completed', 'cancelled']
const staffAttendanceStatuses: StaffAttendanceStatus[] = ['present', 'late', 'absent', 'no_show', 'leave', 'holiday']
const staffLeaveTypes: StaffLeaveType[] = ['annual', 'sick', 'unpaid', 'personal', 'public_holiday']
const staffEmploymentTypes: StaffEmploymentType[] = ['full_time', 'part_time', 'probation_full_time', 'probation_part_time', 'contractor', 'intern']
const staffGenderOptions: StaffGender[] = ['female', 'male', 'non_binary', 'prefer_not_to_say', 'other']
const staffContractStatuses: StaffContractStatus[] = ['active', 'probation', 'suspended', 'ended', 'draft']
const staffHrSetupOptionTypes: StaffHrSetupOptionType[] = ['location', 'department', 'job_title', 'contract_status', 'contract_type', 'employment_type']
const staffHrAdjustmentTypes: StaffHrAdjustmentType[] = ['bonus', 'commission', 'allowance', 'lunch_allowance', 'deduction', 'advance', 'debt', 'debt_repayment']
const staffHrAdjustmentStatuses: StaffHrAdjustmentStatus[] = ['draft', 'pending', 'approved', 'rejected', 'paid', 'cancelled']
const staffPayrollStatuses: StaffPayrollStatus[] = ['draft', 'pending', 'approved', 'paid', 'cancelled']
const staffPayrollPayCycles: StaffPayrollPayCycle[] = ['monthly', 'semi_monthly', 'weekly', 'custom']
const staffRoleOptions: StaffRole[] = ['owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player']
const roleFilterOptions: Array<StaffRole | 'all'> = ['all', 'owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player']
const roleSortOptions: StaffRoleSort[] = ['name_asc', 'name_desc', 'created_desc', 'role_desc', 'role_asc', 'email_asc']
const staffProfileSelect = 'id, created_at, full_name, nickname, email, phone, role, loyalty_points_total, average_accuracy_override, best_escape_duration_seconds_override, total_projectiles_override, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, anonymous_mode, anonymous_callsign, is_seed_demo, seed_batch'
const staffProfileAvatarSelect = 'id, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, anonymous_mode, anonymous_callsign'
const staffGameImageBucket = 'staff-game-images'
const staffGameImageMaxBytes = 2 * 1024 * 1024
const staffGameImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const staffHrDocumentBucket = 'staff-hr-documents'
const staffProfilePhotoMaxBytes = 2 * 1024 * 1024
const staffCvMaxBytes = 10 * 1024 * 1024
const staffProfilePhotoTypes = ['image/jpeg', 'image/png', 'image/webp']
const staffCvTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

function normalizeStaffEmploymentType(value: StaffEmploymentType | string | null | undefined): StaffEmploymentType {
  if (value === 'probation') return 'probation_part_time'
  return staffEmploymentTypes.includes(value as StaffEmploymentType) ? (value as StaffEmploymentType) : 'part_time'
}

function isMonthlyGrossEmployment(value: StaffEmploymentType | string | null | undefined) {
  const normalizedType = normalizeStaffEmploymentType(value)
  return normalizedType === 'full_time' || normalizedType === 'probation_full_time'
}
const staffAudienceOptions: StaffAudience[] = [
  'family_friendly',
  'scary',
  'fun',
  'quest',
  'teamwork',
  'beginner_friendly',
  'competitive',
]
const staffArenaOptions = [
  { id: 'arena-1', label: 'Arena 1' },
  { id: 'arena-2', label: 'Arena 2' },
]
const defaultStaffArenaIds = staffArenaOptions.map((arena) => arena.id)

function normalizeStaffAudienceToken(value: string): StaffAudience | null {
  const token = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (!token) return null
  if (token === 'familyfriendly' || token === 'family_friendly' || token === 'family') return 'family_friendly'
  if (token === 'beginnerfriendly' || token === 'beginner_friendly' || token === 'beginner') return 'beginner_friendly'
  if (token === 'scary' || token === 'hard') return 'scary'
  if (token === 'fun' || token === 'medium') return 'fun'
  if (token === 'quest') return 'quest'
  if (token === 'teamwork' || token === 'team') return 'teamwork'
  if (token === 'competitive') return 'competitive'
  if (token === 'easy') return 'family_friendly'
  return null
}

function normalizeStaffAudienceItems(value?: StaffAudience[] | string[] | string | null): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value !== 'string') return []

  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return parsed.map((item) => String(item))
    if (typeof parsed === 'string') return [parsed]
  } catch {
    // Postgres array strings and legacy comma text are handled below.
  }

  return trimmed
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeStaffAudience(value?: StaffAudience[] | string[] | string | null, legacyDifficulty?: string | null): StaffAudience[] {
  const validOptions = new Set<StaffAudience>(staffAudienceOptions)
  const selected = normalizeStaffAudienceItems(value).reduce<StaffAudience[]>((items, item) => {
    const audience = normalizeStaffAudienceToken(item)
    if (audience && validOptions.has(audience) && !items.includes(audience)) items.push(audience)
    return items
  }, [])

  if (selected.length) return selected

  const legacyAudience = normalizeStaffAudienceItems(legacyDifficulty).reduce<StaffAudience[]>((items, item) => {
    const audience = normalizeStaffAudienceToken(item)
    if (audience && validOptions.has(audience) && !items.includes(audience)) items.push(audience)
    return items
  }, [])
  if (legacyAudience.length) return legacyAudience

  const legacy = (legacyDifficulty || '').toLowerCase()
  if (legacy.includes('family')) return ['family_friendly']
  if (legacy.includes('scary') || legacy.includes('hard')) return ['scary']
  if (legacy.includes('beginner')) return ['beginner_friendly']
  if (legacy.includes('quest')) return ['quest']
  if (legacy.includes('team')) return ['teamwork']
  if (legacy.includes('competitive')) return ['competitive']
  if (legacy.includes('fun') || legacy.includes('medium')) return ['fun']
  if (legacy.includes('easy')) return ['family_friendly', 'fun']
  return []
}

function staffAudienceLabel(value?: StaffAudience[] | string[] | string | null, legacyDifficulty?: string | null, text: StaffConsoleCopy = staffConsoleText.en) {
  const audience = normalizeStaffAudience(value, legacyDifficulty)
  return audience.map((item) => text.audienceOptions[item]).join(', ')
}

function isMissingStaffAudienceColumnError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('audience') && (normalized.includes('schema cache') || normalized.includes('column'))
}

function normalizeGuideLanguage(value?: string | null): LanguageCode {
  return languageOptions.includes(value as LanguageCode) ? value as LanguageCode : 'en'
}

function normalizeGuideTextMap(value?: unknown): StaffGuideTextMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return languageOptions.reduce<StaffGuideTextMap>((guideText, language) => {
    const item = (value as Record<string, unknown>)[language]
    if (typeof item === 'string' && item.trim()) {
      guideText[language] = item
    }
    return guideText
  }, {})
}

function cleanGuideTextMap(value: StaffGuideTextMap): StaffGuideTextMap {
  return languageOptions.reduce<StaffGuideTextMap>((guideText, language) => {
    const item = value[language]?.trim()
    if (item) guideText[language] = item
    return guideText
  }, {})
}

function guideTextValue(value: StaffGuideTextMap, language: LanguageCode) {
  return value[language] || ''
}

function guideTextForEditing(value: string) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n')
}

function defaultGameGuideMaps(slug: string, gameType: StaffGame['game_type']) {
  const isMiniBlockTowers = slug === 'mini-block-towers'
  const isEscape = gameType === 'escape'

  return languageOptions.reduce<{
    guide_summary: StaffGuideTextMap
    guide_rules: StaffGuideTextMap
    guide_tips: StaffGuideTextMap
  }>((guides, language) => {
    const text = uiText[language]
    const summary = isMiniBlockTowers
      ? text.gameGuideBlockTowersSummary
      : isEscape
        ? text.gameGuideEscapeSummary
        : text.gameGuideFpsSummary
    const rules = isEscape
      ? ''
      : isMiniBlockTowers
        ? text.gameGuideBlockTowersRules
        : text.gameGuideFpsRules
    const tips = isMiniBlockTowers
      ? text.gameGuideBlockTowersTips
      : isEscape
        ? text.gameGuideEscapeTips
        : text.gameGuideFpsTips

    guides.guide_summary[language] = guideTextForEditing(summary)
    if (rules.trim()) guides.guide_rules[language] = guideTextForEditing(rules)
    guides.guide_tips[language] = guideTextForEditing(tips)
    return guides
  }, { guide_summary: {}, guide_rules: {}, guide_tips: {} })
}

function guideTextMapWithDefaults(value: unknown, defaults: StaffGuideTextMap) {
  const savedGuideText = normalizeGuideTextMap(value)
  return languageOptions.reduce<StaffGuideTextMap>((guideText, language) => {
    guideText[language] = savedGuideText[language] || defaults[language] || ''
    return guideText
  }, {})
}

function parseStaffArenaIds(value?: string | null) {
  const knownArenaIds = new Set(defaultStaffArenaIds)
  const arenaIds = (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => knownArenaIds.has(item))

  return arenaIds.length ? arenaIds : defaultStaffArenaIds
}

function roleLabel(role?: string | null, email?: string | null): StaffRole {
  const normalizedRole = role?.toLowerCase()
  const rank = staffRank(role, email)
  if (rank >= 120) return 'owner'
  if (rank >= 100) return 'admin'
  if (rank >= 80) return 'manager'
  if (normalizedRole === 'cashier') return 'cashier'
  if (rank >= 50) return 'staff'
  if (rank >= 20) return 'viewer'
  return 'player'
}

function storedRoleValue(role?: string | null, email?: string | null): StaffRole {
  const normalized = (role || '').toLowerCase()
  if (isOwnerEmail(email)) return 'owner'
  if (isAdminOnlyEmail(email) && (normalized === 'super_admin' || normalized === 'owner')) return 'admin'
  if (normalized === 'super_admin') return 'owner'
  return staffRoleOptions.includes(normalized as StaffRole) ? normalized as StaffRole : 'player'
}

function isDemoProfile(profile: StaffProfile) {
  const email = (profile.email || '').toLowerCase()
  const fullName = (profile.full_name || '').toLowerCase()
  const nickname = (profile.nickname || '').toLowerCase()
  return Boolean(
    profile.is_seed_demo ||
    profile.seed_batch ||
    email.includes('@vrena.demo') ||
    email.includes('.demo') ||
    email.startsWith('softlaunch-') ||
    /^demo(\s|-|_)/.test(fullName) ||
    /^demo(\s|-|_)/.test(nickname)
  )
}

function staffRoleName(role: StaffRole, text: StaffConsoleCopy = staffConsoleText.en) {
  return text.roles[role]
}

function staffRoleSortName(sort: StaffRoleSort, text: StaffConsoleCopy = staffConsoleText.en) {
  return text.roleSorts[sort]
}

function formatVnd(value: number) {
  return `${Math.max(0, Number(value) || 0).toLocaleString('vi-VN')} đ`
}

function formatVndCompact(value: number) {
  const amount = Math.max(0, Number(value) || 0)
  if (amount >= 1000000) {
    const millions = amount / 1000000
    return `${Number(millions.toFixed(millions >= 10 || Number.isInteger(millions) ? 0 : 1)).toLocaleString('vi-VN')}M`
  }
  if (amount >= 1000) return `${Math.round(amount / 1000).toLocaleString('vi-VN')}k`
  return `${amount.toLocaleString('vi-VN')} đ`
}

function dongDigits(value: string | number | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

function parseDong(value: string | number | null | undefined) {
  const digits = dongDigits(value)
  return digits ? Number(digits) : 0
}

function formatDongInput(value: string | number | null | undefined) {
  const amount = parseDong(value)
  return amount > 0 ? formatVnd(amount) : ''
}

function discountValueUnit(type: StaffDiscount['discount_type']): StaffDiscountValueUnit {
  return type === 'fixed_amount' ? 'fixed_amount' : 'percentage'
}

function parsePercentInput(value: string | number | null | undefined) {
  const rawValue = String(value ?? '').replace(/[^\d.]/g, '')
  const amount = Number(rawValue)
  if (!Number.isFinite(amount)) return 0
  return Math.min(100, Math.max(0, amount))
}

function formatPercentInput(value: string | number | null | undefined) {
  const amount = parsePercentInput(value)
  if (amount <= 0) return ''
  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)))
}

function normalizePaymentSplits(splits: PaymentSplitDraft[]): PaymentSplitPayload[] {
  return splits
    .map((split) => ({
      payment_method: split.payment_method,
      amount: parseDong(split.amount),
    }))
    .filter((split) => split.amount > 0)
}

function paymentSplitTotal(splits: PaymentSplitPayload[]) {
  return splits.reduce((sum, split) => sum + split.amount, 0)
}

function paymentStatusFromAmount(total: number, paidTotal: number): StaffOrder['payment_status'] {
  if (total <= 0) return 'paid'
  if (paidTotal <= 0) return 'unpaid'
  return paidTotal >= total ? 'paid' : 'partially_paid'
}

function normalizeTime(value: string | null | undefined) {
  return (value || '').slice(0, 5)
}

function operationBookingKind(session: Pick<StaffOperationSession, 'booking_type'>) {
  return session.booking_type === 'ticket' ? 'ticket' : 'session'
}

function operationSessionChanges(session: StaffOperationSession, patch: Partial<StaffOperationSession>) {
  const rows: Array<[string, unknown, unknown]> = [
    ['Name', session.name, patch.name],
    ['Date', session.date, patch.date],
    ['Time', normalizeTime(session.start_time), patch.start_time ? normalizeTime(patch.start_time) : undefined],
    ['Duration', session.duration_minutes, patch.duration_minutes],
    ['Max players', session.max_players, patch.max_players],
    ['Arena count', session.arena_count, patch.arena_count],
    ['Visibility', session.visibility, patch.visibility],
    ['Status', session.status, patch.status],
    ['Game', session.confirmed_game_id, patch.confirmed_game_id],
  ]

  return rows
    .filter(([, , after]) => after !== undefined)
    .filter(([, before, after]) => String(before ?? '') !== String(after ?? ''))
    .map(([label, before, after]) => ({ label, before: before as string | number | boolean | null, after: after as string | number | boolean | null }))
}

function orderChanges(order: StaffOrder, patch: Partial<StaffOrder>) {
  const rows: Array<[string, unknown, unknown]> = [
    ['Payment status', order.payment_status, patch.payment_status],
    ['Order status', order.order_status, patch.order_status],
    ['Total', order.total, patch.total],
    ['Customer name', order.customer_name, patch.customer_name],
    ['Customer phone', order.customer_phone, patch.customer_phone],
    ['Customer email', order.customer_email, patch.customer_email],
    ['Date', order.booking_date, patch.booking_date],
    ['Time', normalizeTime(order.booking_time), patch.booking_time ? normalizeTime(patch.booking_time) : undefined],
  ]

  return rows
    .filter(([, , after]) => after !== undefined)
    .filter(([, before, after]) => String(before ?? '') !== String(after ?? ''))
    .map(([label, before, after]) => ({ label, before: before as string | number | boolean | null, after: after as string | number | boolean | null }))
}

function parseStaffDuration(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return Math.floor(Number(trimmed))
  const parts = trimmed.split(':').map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null
  if (parts.length === 2) return Math.floor(parts[0] * 60 + parts[1])
  if (parts.length === 3) return Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2])
  return null
}

function formatStaffDuration(value: number | null | undefined) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const wholeSeconds = Math.floor(seconds)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const remainingSeconds = wholeSeconds % 60
  const minuteText = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  return hours > 0
    ? `${hours}:${minuteText}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minuteText}:${String(remainingSeconds).padStart(2, '0')}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `game-${Date.now()}`
}

function safeStorageFileName(value: string) {
  const extension = value.includes('.') ? value.split('.').pop() || '' : ''
  const baseName = value.replace(/\.[^.]+$/, '')
  const safeBase = baseName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'file'
  return extension ? `${safeBase}.${extension.toLowerCase()}` : safeBase
}

function dayTypeFor(dateValue: string): 'weekday' | 'weekend' {
  const day = new Date(`${dateValue}T12:00:00`).getDay()
  return day === 0 || day === 6 ? 'weekend' : 'weekday'
}

function isDateInRange(dateValue: string, from: string, until: string | null) {
  return dateValue >= from && (!until || dateValue <= until)
}

function isTimeInRule(timeValue: string, rule: StaffPriceRule) {
  const time = normalizeTime(timeValue)
  const start = normalizeTime(rule.time_start)
  const end = normalizeTime(rule.time_end)
  return (!start || time >= start) && (!end || time < end)
}

function weekdayScopeFor(dateValue: string): StaffDiscountDayScope {
  const day = new Date(`${dateValue}T12:00:00`).getDay()
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day] as StaffDiscountDayScope
}

function isDayInDiscountScope(dateValue: string, scope: StaffDiscountDayScope) {
  if (scope === 'all') return true
  const weekday = weekdayScopeFor(dateValue)
  if (scope === 'weekday') return !['sun', 'sat'].includes(weekday)
  if (scope === 'weekend') return ['sun', 'sat'].includes(weekday)
  return weekday === scope
}

function isTimeInDiscount(timeValue: string, discount: Pick<StaffDiscount, 'time_start' | 'time_end'>) {
  const time = normalizeTime(timeValue)
  const start = normalizeTime(discount.time_start)
  const end = normalizeTime(discount.time_end)
  if (!start && !end) return true
  if (!time) return false
  if (start && end && start > end) return time >= start || time < end
  return (!start || time >= start) && (!end || time < end)
}

function discountMatchesContext(
  discount: StaffDiscount,
  context: {
    date: string
    gameId: string | null
    players: number
    priceRuleId?: string | null
    subtotal: number
    ticketType?: StaffDiscountTicketType
    time: string
  },
) {
  if (!discount.active) return false
  if (discount.max_uses !== null && discount.used_count >= discount.max_uses) return false
  if (discount.game_id && discount.game_id !== context.gameId) return false
  if (discount.price_rule_id && discount.price_rule_id !== context.priceRuleId) return false
  if (!isDateInRange(context.date, discount.valid_from, discount.valid_until)) return false
  if (!isDayInDiscountScope(context.date, discount.day_scope || 'all')) return false
  if (!isTimeInDiscount(context.time, discount)) return false
  if (discount.min_players !== null && context.players < discount.min_players) return false
  if (discount.max_players !== null && context.players > discount.max_players) return false
  if ((discount.min_order_total ?? 0) > 0 && context.subtotal < discount.min_order_total) return false
  if (discount.ticket_type && discount.ticket_type !== 'all' && discount.ticket_type !== context.ticketType) return false
  return true
}

function selectPricingRule(rules: StaffPriceRule[], gameId: string, dateValue: string, timeValue: string) {
  const dayType = dayTypeFor(dateValue)
  return rules
    .filter((rule) => {
      if (!rule.active) return false
      if (rule.game_id && rule.game_id !== gameId) return false
      if (!isDateInRange(dateValue, rule.valid_from, rule.valid_until)) return false
      if (rule.day_type !== 'custom' && rule.day_type !== 'holiday' && rule.day_type !== dayType) return false
      return isTimeInRule(timeValue, rule)
    })
    .sort((left, right) => {
      if (left.game_id && !right.game_id) return -1
      if (!left.game_id && right.game_id) return 1
      if (left.day_type === 'custom' && right.day_type !== 'custom') return -1
      if (left.day_type !== 'custom' && right.day_type === 'custom') return 1
      return right.valid_from.localeCompare(left.valid_from)
    })[0] || null
}

function calculateDiscount(discount: StaffDiscount | null, subtotal: number, unitPrice: number) {
  if (!discount) return 0
  let amount = 0
  if (discount.discount_type === 'fixed_amount') amount = discount.value
  if (discount.discount_type === 'free_ticket') amount = unitPrice
  if (['percentage', 'birthday', 'resident', 'group'].includes(discount.discount_type)) {
    amount = subtotal * Math.min(discount.value, 100) / 100
  }

  if (discount.max_discount_amount !== null) {
    amount = Math.min(amount, discount.max_discount_amount)
  }

  return Math.min(subtotal, Math.max(0, Math.round(amount)))
}

function formatDiscountRuleValue(discount: Pick<StaffDiscount, 'discount_type' | 'value'>, text: StaffConsoleCopy = staffConsoleText.en) {
  if (discount.discount_type === 'fixed_amount') return formatVnd(discount.value)
  if (discount.discount_type === 'free_ticket') return text.discountTypes.free_ticket
  return `${formatPercentInput(discount.value) || '0'}%`
}

function formatDiscountRuleConditions(
  discount: StaffDiscount,
  gameName: string,
  priceRuleName: string,
  text: StaffConsoleCopy = staffConsoleText.en,
) {
  const conditions = [gameName, priceRuleName]
  if (discount.min_players !== null || discount.max_players !== null) {
    conditions.push(`${discount.min_players ?? 1}-${discount.max_players ?? text.any} ${text.labels.players}`)
  }
  conditions.push(text.discountDayScopes[discount.day_scope || 'all'])
  if (discount.time_start || discount.time_end) {
    conditions.push(`${normalizeTime(discount.time_start) || '00:00'}-${normalizeTime(discount.time_end) || '24:00'}`)
  }
  if (discount.ticket_type && discount.ticket_type !== 'all') {
    conditions.push(text.discountTicketTypes[discount.ticket_type])
  }
  if ((discount.min_order_total ?? 0) > 0) {
    conditions.push(`${text.labels.minimumSpend} ${formatVnd(discount.min_order_total)}`)
  }
  if (discount.max_discount_amount !== null) {
    conditions.push(`${text.labels.maxDiscountAmount} ${formatVnd(discount.max_discount_amount)}`)
  }
  if (discount.per_customer_limit !== null) {
    conditions.push(`${text.labels.perCustomerLimit} ${discount.per_customer_limit}`)
  }
  return conditions.join(' · ')
}

function calculateManualDiscount(type: BookingForm['manualDiscountType'], value: number, subtotal: number) {
  if (!type || value <= 0) return 0
  const amount = type === 'percentage'
    ? subtotal * Math.min(value, 100) / 100
    : value
  return Math.min(subtotal, Math.max(0, Math.round(amount)))
}

function manualDiscountLabel(type: BookingForm['manualDiscountType'], value: number, text: StaffConsoleCopy = staffConsoleText.en) {
  if (!type || value <= 0) return ''
  return type === 'percentage'
    ? `${text.labels.uniqueDiscount} · ${Math.min(value, 100)}%`
    : `${text.labels.uniqueDiscount} · ${formatVnd(value)}`
}

function loyaltyCalculationLabel(type: StaffLoyaltyRule['calculation_type'], text: StaffConsoleCopy = staffConsoleText.en) {
  return text.loyaltyCalculation[type]
}

function customerName(profile: StaffProfile, text: StaffConsoleCopy = staffConsoleText.en) {
  if (profile.anonymous_mode) return profile.nickname || profile.anonymous_callsign || text.customerFallback
  return profile.nickname || profile.full_name || profile.phone || profile.email || text.customerFallback
}

function normalizeStaffSearchValue(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

function customerSearchText(profile: StaffProfile, text: StaffConsoleCopy = staffConsoleText.en) {
  return normalizeStaffSearchValue([
    customerName(profile, text),
    profile.full_name || '',
    profile.nickname || '',
    profile.phone || '',
    profile.email || '',
  ].join(' '))
}

function StaffOperationPlayerSearch({
  disabled,
  onQueryChange,
  onSelect,
  profiles,
  query,
  selectedProfileId,
  text,
}: {
  disabled: boolean
  onQueryChange: (value: string) => void
  onSelect: (profile: StaffProfile | null) => void
  profiles: StaffProfile[]
  query: string
  selectedProfileId: string
  text: StaffConsoleCopy
}) {
  const selectedProfile = selectedProfileId ? profiles.find((profile) => profile.id === selectedProfileId) || null : null
  const normalizedQuery = normalizeStaffSearchValue(query.trim())
  const suggestions = useMemo(() => {
    if (normalizedQuery.length < 1) return []

    return profiles
      .filter((profile) => !isDemoProfile(profile) && customerSearchText(profile, text).includes(normalizedQuery))
      .sort((left, right) => {
        const leftName = normalizeStaffSearchValue(customerName(left, text))
        const rightName = normalizeStaffSearchValue(customerName(right, text))
        const leftStarts = leftName.startsWith(normalizedQuery) ? 0 : 1
        const rightStarts = rightName.startsWith(normalizedQuery) ? 0 : 1
        return leftStarts - rightStarts
          || leftName.localeCompare(rightName)
          || (left.phone || '').localeCompare(right.phone || '')
          || (left.email || '').localeCompare(right.email || '')
      })
      .slice(0, 10)
  }, [normalizedQuery, profiles, text])

  return (
    <div className="staff-operation-add-player-picker">
      <input
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => {
          const nextValue = event.target.value
          onQueryChange(nextValue)
          if (selectedProfile && nextValue !== customerName(selectedProfile, text)) onSelect(null)
        }}
        placeholder={text.labels.customerProfile}
        type="search"
        value={query}
      />
      {normalizedQuery.length >= 1 && (
        <div className="staff-operation-player-results" role="listbox">
          {suggestions.map((profile) => {
            const isSelected = profile.id === selectedProfileId
            return (
              <button
                aria-selected={isSelected}
                className="staff-operation-player-result"
                key={profile.id}
                onClick={() => {
                  onSelect(profile)
                  onQueryChange(customerName(profile, text))
                }}
                role="option"
                type="button"
              >
                <span>{customerName(profile, text)}</span>
                <small>{[profile.phone, profile.email].filter(Boolean).join(' · ') || profile.profile_motto || text.noContact}</small>
              </button>
            )
          })}
          {suggestions.length === 0 && <p className="staff-operation-player-empty">{text.noUsersFound}</p>}
        </div>
      )}
    </div>
  )
}

function staffRoleAvatarInitials(value: string) {
  const cleaned = value.trim()
  if (!cleaned || cleaned === '?') return 'PL'
  const words = cleaned.split(/\s+/).filter(Boolean)
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0] || '').join('')
    : Array.from(cleaned).slice(0, 2).join('')
  return letters.toUpperCase() || 'PL'
}

function shouldSkipStaffImageOptimization(source: string | null | undefined) {
  const normalizedSource = source?.trim().toLowerCase() || ''
  return normalizedSource.startsWith('blob:') || normalizedSource.startsWith('data:') || /\.gif($|\?)/.test(normalizedSource)
}

function StaffRoleAvatar({ profile, text }: { profile: StaffProfile; text: StaffConsoleCopy }) {
  const [failedImageUrl, setFailedImageUrl] = useState('')
  const name = customerName(profile, text)
  const imageUrl = profile.anonymous_mode ? '' : profile.avatar_url?.trim() || ''
  const shouldUseImage = Boolean(imageUrl && failedImageUrl !== imageUrl)
  const emoji = profile.anonymous_mode ? '🎭' : profile.avatar_emoji?.trim()
  const initials = profile.anonymous_mode || profile.avatar_initials?.trim() === '?' ? '' : profile.avatar_initials?.trim()
  const style = {
    background: profile.anonymous_mode ? vrenaPalette.neutral[950] : profile.avatar_color || vrenaPalette.purple[500],
    color: profile.anonymous_mode ? vrenaPalette.white : profile.avatar_text_color || vrenaPalette.white,
  }

  return (
    <span aria-hidden="true" className="player-avatar staff-role-avatar" style={style}>
      {shouldUseImage ? (
        <span
          className="avatar-photo"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <NextImage
            alt=""
            fill
            loading="lazy"
            sizes="64px"
            src={imageUrl}
            style={{
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            unoptimized={shouldSkipStaffImageOptimization(imageUrl)}
            onError={() => setFailedImageUrl(imageUrl)}
          />
        </span>
      ) : (
        <span className={emoji ? 'avatar-emoji' : 'avatar-text'}>
          {emoji || staffRoleAvatarInitials(initials || name)}
        </span>
      )}
    </span>
  )
}

function paymentMethodLabel(value: string, text: StaffConsoleCopy = staffConsoleText.en) {
  if (value === 'split') return text.split
  if (value === 'unpaid') return text.unpaid
  if (value === 'cash' || value === 'bank_transfer') return text.paymentMethods[value]
  return value.replace(/_/g, ' ')
}

function paymentStatusLabel(value: StaffOrder['payment_status'], text: StaffConsoleCopy = staffConsoleText.en) {
  if (value === 'unpaid') return text.unpaid
  if (value === 'paid') return text.orderStatuses.paid
  if (value === 'partially_paid') return text.orderStatuses.partially_paid
  if (value === 'refunded') return text.orderStatuses.refunded
  return value
}

function addMinutesToTime(value: string, minutes: number) {
  const [hours, mins] = normalizeTime(value).split(':').map(Number)
  const total = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(mins) ? mins : 0) + minutes
  const normalized = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

function ticketTypeName(value: string | null | undefined, text: StaffConsoleCopy = staffConsoleText.en) {
  if (value === 'birthday' || value === 'corporate' || value === 'individual') return text.ticketTypes[value]
  return text.labels.ticketBookings
}

function sessionKindLabel(session: StaffOperationSession, text: StaffConsoleCopy = staffConsoleText.en) {
  if (session.booking_type === 'ticket') return `${text.labels.ticketBookings} · ${ticketTypeName(session.ticket_type, text)}`
  if (session.visibility === 'private') return text.labels.privateSession
  return text.labels.communitySession
}

function sessionGameName(session: StaffOperationSession, games: StaffGame[], text: StaffConsoleCopy = staffConsoleText.en) {
  const gameId = session.confirmed_game_id || session.game_options?.[0] || ''
  return games.find((game) => game.slug === gameId || game.id === gameId)?.name || text.gameFallback
}

function sessionStaffGame(session: StaffOperationSession, games: StaffGame[]) {
  const gameId = session.confirmed_game_id || session.game_options?.[0] || ''
  return games.find((game) => game.slug === gameId || game.id === gameId) || null
}

function operationParticipantName(participant: StaffSessionParticipant, text: StaffConsoleCopy = staffConsoleText.en) {
  return participant.display_name || text.customerFallback
}

function sessionBookedPlayers(session: StaffOperationSession, order?: StaffOrder) {
  return Math.max(
    Number(order?.players_count || 0),
    Number(session.ticket_player_count || 0),
    session.session_participants?.length || 0
  )
}

function sessionCapacity(session: StaffOperationSession, order?: StaffOrder) {
  return Math.max(Number(session.max_players || 0), sessionBookedPlayers(session, order))
}

function sessionCheckedInCount(session: StaffOperationSession) {
  return (session.session_participants || []).filter((participant) => participant.checked_in).length
}

async function downloadExcel(filename: string, sections: Array<{ title: string; rows: Array<Record<string, unknown>> }>, text: StaffConsoleCopy = staffConsoleText.en) {
  const { downloadExcelFile } = await import('../lib/staffDownloadFiles')
  downloadExcelFile(filename, sections, text.noData)
}

async function downloadCsv(filename: string, rows: Array<Record<string, unknown>>, text: StaffConsoleCopy = staffConsoleText.en) {
  const { downloadCsvFile } = await import('../lib/staffDownloadFiles')
  downloadCsvFile(filename, rows, text.noData)
}

async function downloadPdf(filename: string, lines: string[], text: StaffConsoleCopy = staffConsoleText.en) {
  const { downloadPdfFile } = await import('../lib/staffDownloadFiles')
  downloadPdfFile(filename, lines, text.reportTitleFallback)
}

function staffReportRows(report: StaffReportSummary, text: StaffConsoleCopy = staffConsoleText.en) {
  return [
    { metric: text.labels.totalSales, value: formatVnd(report.totalSales) },
    { metric: text.labels.totalPaid, value: formatVnd(report.totalPaid) },
    { metric: text.unpaid, value: formatVnd(report.unpaidAmount) },
    { metric: text.labels.cash, value: formatVnd(report.cashTotal) },
    { metric: text.labels.bankTransfer, value: formatVnd(report.bankTransferTotal) },
    { metric: text.labels.bookings, value: report.bookings },
    { metric: text.labels.players, value: report.players },
    { metric: text.labels.cancelled, value: report.cancelled },
    { metric: text.labels.noShows, value: report.noShows },
    { metric: text.labels.discounts, value: formatVnd(report.discounts) },
    { metric: text.labels.bestSellingGame, value: report.bestSellingGame },
  ]
}

function staffOrderPaymentRows(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>) {
  return paymentsByOrderId.get(order.id) || []
}

function orderPaymentLabel(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>, text: StaffConsoleCopy = staffConsoleText.en) {
  const payments = staffOrderPaymentRows(order, paymentsByOrderId)
  if (payments.length === 0) return paymentMethodLabel(order.payment_method, text)
  return payments
    .map((payment) => `${paymentMethodLabel(payment.payment_method, text)} ${formatVnd(payment.amount)}`)
    .join(' + ')
}

function orderPaidAmount(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>) {
  const payments = staffOrderPaymentRows(order, paymentsByOrderId)
  if (payments.length > 0) return payments.reduce((sum, payment) => sum + payment.amount, 0)
  return order.payment_status === 'paid' ? order.total : 0
}

function staffOrderExportRows(orders: StaffOrder[], games: StaffGame[], paymentsByOrderId: Map<string, StaffOrderPayment[]>, text: StaffConsoleCopy = staffConsoleText.en) {
  return orders.map((order) => ({
    order_number: order.order_number,
    date: order.booking_date,
    time: normalizeTime(order.booking_time),
    customer: order.customer_name || order.customer_phone || order.customer_email || text.walkIn,
    game: games.find((game) => game.id === order.game_id)?.name || '',
    players: order.players_count,
    subtotal: formatVnd(order.subtotal),
    discount: formatVnd(order.discount_total),
    total: formatVnd(order.total),
    payment_method: orderPaymentLabel(order, paymentsByOrderId, text),
    paid_amount: formatVnd(orderPaidAmount(order, paymentsByOrderId)),
    payment_status: paymentStatusLabel(order.payment_status, text),
    order_status: text.orderStatuses[order.order_status],
  }))
}

function reportPdfLines(
  title: string,
  report: StaffReportSummary,
  orders: StaffOrder[],
  games: StaffGame[],
  paymentsByOrderId: Map<string, StaffOrderPayment[]>,
  text: StaffConsoleCopy = staffConsoleText.en
) {
  return [
    title,
    ...staffReportRows(report, text).map((row) => `${row.metric}: ${row.value}`),
    '',
    text.labels.orders,
    ...staffOrderExportRows(orders, games, paymentsByOrderId, text).slice(0, 28).map((order) => (
      `${order.order_number} | ${order.date} ${order.time} | ${order.customer} | ${order.game} | ${order.total} | ${order.payment_method}`
    )),
  ]
}

function buildLineChartPath(series: Array<{ sales: number }>, max: number) {
  if (series.length === 0) return ''
  if (series.length === 1) {
    const y = 94 - (series[0].sales / max) * 78
    return `M 6 ${y.toFixed(2)} L 94 ${y.toFixed(2)}`
  }
  return series.map((point, index) => {
    const x = 6 + (index / (series.length - 1)) * 88
    const y = 94 - (point.sales / max) * 78
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function conicStops(items: Array<{ value: number }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return `${vrenaPalette.neutral[300]} 0deg 360deg`
  const colors = [vrenaPalette.cyan[500], vrenaPalette.purple[500], vrenaPalette.neutral[400]]
  let cursor = 0
  return items.map((item, index) => {
    const start = cursor
    cursor += (item.value / total) * 360
    return `${colors[index % colors.length]} ${start.toFixed(1)}deg ${cursor.toFixed(1)}deg`
  }).join(', ')
}

function paymentPieItems(report: StaffReportSummary, text: StaffConsoleCopy = staffConsoleText.en) {
  return [
    { label: text.labels.cash, value: report.cashTotal },
    { label: text.labels.bankTransfer, value: report.bankTransferTotal },
    { label: text.unpaid, value: report.unpaidAmount },
  ]
}

function buildWeekdayRevenue(orders: StaffOrder[], language: StaffConsoleLanguage): StaffWeekdayRevenuePoint[] {
  const labels = staffWeekdayLabels[language]
  const buckets = labels.map((label, index) => ({ key: String(index), label, sales: 0 }))

  orders.forEach((order) => {
    if (!order.booking_date) return
    const day = dateFromInput(order.booking_date).getDay()
    const mondayFirstIndex = day === 0 ? 6 : day - 1
    buckets[mondayFirstIndex].sales += Number(order.total) || 0
  })

  return buckets
}

function buildHourlyRevenue(orders: StaffOrder[]): StaffHourlyRevenuePoint[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${hour}h`, sales: 0 }))

  orders.forEach((order) => {
    const match = String(order.booking_time || '').match(/^(\d{1,2})/)
    const hour = match ? Number(match[1]) : Number.NaN
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return
    buckets[hour].sales += Number(order.total) || 0
  })

  return buckets
}

function buildSmoothLineChartPath(series: Array<{ sales: number }>, max: number) {
  if (series.length === 0) return ''
  const safeMax = Math.max(1, max)
  const points = series.map((point, index) => {
    const x = series.length === 1 ? 50 : 4 + (index / (series.length - 1)) * 92
    const y = 92 - (point.sales / safeMax) * 74
    return { x, y }
  })

  if (points.length === 1) return `M 4 ${points[0].y.toFixed(2)} L 96 ${points[0].y.toFixed(2)}`

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    const previous = points[index - 1]
    const midX = (previous.x + point.x) / 2
    return `${path} C ${midX.toFixed(2)} ${previous.y.toFixed(2)}, ${midX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, '')
}

function buildChartAreaPath(linePath: string) {
  return linePath ? `${linePath} L 96 94 L 4 94 Z` : ''
}

function emptyStaffReport(text: StaffConsoleCopy = staffConsoleText.en): StaffReportSummary {
  return {
    totalSales: 0,
    totalPaid: 0,
    unpaidAmount: 0,
    cashTotal: 0,
    bankTransferTotal: 0,
    bookings: 0,
    players: 0,
    cancelled: 0,
    noShows: 0,
    discounts: 0,
    bestSellingGame: text.noneYet,
  }
}

function buildStaffReport(
  orders: StaffOrder[],
  gameNameById: Map<string, string>,
  paymentsByOrderId: Map<string, StaffOrderPayment[]>,
  text: StaffConsoleCopy = staffConsoleText.en
): StaffReportSummary {
  const totals = orders.reduce((summary, order) => {
    const payments = staffOrderPaymentRows(order, paymentsByOrderId)
    const paidAmount = payments.length > 0
      ? payments.reduce((sum, payment) => sum + payment.amount, 0)
      : order.payment_status === 'paid'
        ? order.total
        : 0
    summary.totalSales += order.total
    summary.players += order.players_count
    summary.discounts += order.discount_total
    summary.totalPaid += paidAmount
    summary.unpaidAmount += Math.max(0, order.total - paidAmount)
    if (payments.length > 0) {
      payments.forEach((payment) => {
        if (payment.payment_method === 'cash') summary.cashTotal += payment.amount
        if (payment.payment_method === 'bank_transfer') summary.bankTransferTotal += payment.amount
      })
    } else {
      if (order.payment_method === 'cash') summary.cashTotal += order.total
      if (order.payment_method === 'bank_transfer') summary.bankTransferTotal += order.total
    }
    if (order.order_status === 'cancelled') summary.cancelled += 1
    if (order.order_status === 'no_show') summary.noShows += 1
    const gameName = order.game_id ? gameNameById.get(order.game_id) || text.unknown : text.unknown
    summary.gameCounts.set(gameName, (summary.gameCounts.get(gameName) || 0) + 1)
    return summary
  }, {
    totalSales: 0,
    totalPaid: 0,
    unpaidAmount: 0,
    cashTotal: 0,
    bankTransferTotal: 0,
    bookings: orders.length,
    players: 0,
    cancelled: 0,
    noShows: 0,
    discounts: 0,
    gameCounts: new Map<string, number>(),
  })
  const bestSellingGame = [...totals.gameCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || text.noneYet

  return {
    totalSales: totals.totalSales,
    totalPaid: totals.totalPaid,
    unpaidAmount: totals.unpaidAmount,
    cashTotal: totals.cashTotal,
    bankTransferTotal: totals.bankTransferTotal,
    bookings: totals.bookings,
    players: totals.players,
    cancelled: totals.cancelled,
    noShows: totals.noShows,
    discounts: totals.discounts,
    bestSellingGame,
  }
}

function buildDailySeries(orders: StaffOrder[], start: string, end: string) {
  const [from, to] = orderedRange(start, end)
  const byDate = new Map<string, StaffDailyPoint>()
  for (let date = from, index = 0; date <= to && index < 45; date = addDays(date, 1), index += 1) {
    byDate.set(date, { date, sales: 0, bookings: 0, players: 0 })
  }
  orders.forEach((order) => {
    const point = byDate.get(order.booking_date)
    if (!point) return
    point.sales += order.total
    point.bookings += 1
    point.players += order.players_count
  })
  return [...byDate.values()]
}

function mergeById<T extends { id: string }>(current: T[], next: T[]) {
  const map = new Map(current.map((item) => [item.id, item]))
  next.forEach((item) => map.set(item.id, item))
  return [...map.values()]
}

function mergeOrderPayments(current: StaffOrderPayment[], orderIds: string[], next: StaffOrderPayment[]) {
  const orderIdSet = new Set(orderIds)
  return [
    ...current.filter((payment) => !orderIdSet.has(payment.order_id)),
    ...next,
  ]
}

function paymentMapFromRows(payments: StaffOrderPayment[]) {
  const map = new Map<string, StaffOrderPayment[]>()
  payments.forEach((payment) => {
    const list = map.get(payment.order_id) || []
    list.push(payment)
    map.set(payment.order_id, list)
  })
  return map
}

function numericReportValue(value: unknown) {
  return Number(value ?? 0) || 0
}

function rpcFunctionMissing(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || ''
  return error?.code === '42883'
    || error?.code === 'PGRST202'
    || message.includes('could not find the function')
    || (message.includes('function') && message.includes('does not exist'))
}

function reportSummaryFromRpc(value: unknown, text: StaffConsoleCopy = staffConsoleText.en): StaffReportSummary {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    totalSales: numericReportValue(row.totalSales ?? row.total_sales),
    totalPaid: numericReportValue(row.totalPaid ?? row.total_paid),
    unpaidAmount: numericReportValue(row.unpaidAmount ?? row.unpaid_amount),
    cashTotal: numericReportValue(row.cashTotal ?? row.cash_total),
    bankTransferTotal: numericReportValue(row.bankTransferTotal ?? row.bank_transfer_total),
    bookings: numericReportValue(row.bookings),
    players: numericReportValue(row.players),
    cancelled: numericReportValue(row.cancelled),
    noShows: numericReportValue(row.noShows ?? row.no_shows),
    discounts: numericReportValue(row.discounts),
    bestSellingGame: String(row.bestSellingGame ?? row.best_selling_game ?? text.noneYet),
  }
}

function dailySeriesFromRpc(value: unknown): StaffDailyPoint[] {
  if (!Array.isArray(value)) return []
  return value.map((point) => {
    const row = (point && typeof point === 'object' ? point : {}) as Record<string, unknown>
    return {
      date: String(row.date || ''),
      sales: numericReportValue(row.sales),
      bookings: numericReportValue(row.bookings),
      players: numericReportValue(row.players),
    }
  }).filter((point) => point.date)
}

function staffReportSnapshotFromRpc(value: unknown, text: StaffConsoleCopy = staffConsoleText.en): StaffReportSnapshot {
  const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const comparisonOrders = payload.comparisonOrders ?? payload.comparison_orders
  return {
    report: reportSummaryFromRpc(payload.report, text),
    comparisonReport: reportSummaryFromRpc(payload.comparisonReport ?? payload.comparison_report, text),
    reportSeries: dailySeriesFromRpc(payload.reportSeries ?? payload.report_series),
    comparisonSeries: dailySeriesFromRpc(payload.comparisonSeries ?? payload.comparison_series),
    orders: Array.isArray(payload.orders) ? payload.orders as StaffOrder[] : [],
    comparisonOrders: Array.isArray(comparisonOrders) ? comparisonOrders as StaffOrder[] : [],
    payments: Array.isArray(payload.payments) ? payload.payments as StaffOrderPayment[] : [],
  }
}

function staffOrdersPageFromRpc(value: unknown) {
  const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    orders: Array.isArray(payload.orders) ? payload.orders as StaffOrder[] : [],
    payments: Array.isArray(payload.payments) ? payload.payments as StaffOrderPayment[] : [],
  }
}

function percentChange(current: number, previous: number, text: StaffConsoleCopy = staffConsoleText.en) {
  if (previous <= 0) return current > 0 ? text.newValue : '0%'
  const value = ((current - previous) / previous) * 100
  return `${value >= 0 ? '+' : ''}${Math.round(value)}%`
}

export default function StaffConsole({ profile, authEmail, language, mode = 'staff', onOpenPlayerProfile, onOpenSessionCalendar }: StaffConsoleProps) {
  const resolvedLanguage = resolveStaffConsoleLanguage(language)
  const text = staffConsoleText[resolvedLanguage]
  const sharedText = uiText[resolvedLanguage]
  const isHrConsole = mode === 'hr'
  const consoleTitle = isHrConsole ? (resolvedLanguage === 'vi' ? 'HR' : 'HR Console') : text.title
  const rank = Math.max(staffRank(profile?.role, profile?.email), staffRank(profile?.role, authEmail))
  const role = roleLabel(profile?.role, staffRank(null, authEmail) > staffRank(null, profile?.email) ? authEmail : profile?.email)
  const canManageConfig = rank >= 80
  const canCreateOrders = rank >= 50
  const canCreateCustomerAccounts = rank >= 50
  const canAwardAchievements = rank >= 50
  const canManageRoles = rank >= 100
  const canRestoreDeleted = rank >= 120
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const isOfficeStaff = role === 'cashier'
  const isStaffOnly = role === 'staff'
  const canManageAttendance = isOwnerOrAdmin || isOfficeStaff
  const canEditAttendance = canManageAttendance
  const canViewAllEmployeeProfiles = canManageAttendance || role === 'manager' || role === 'viewer'
  const canEditEmployeeProfiles = canManageAttendance
  const canViewAttendanceClock = !isStaffOnly
  const canViewAttendanceSettings = !isStaffOnly
  const canOpenRoleProfiles = rank >= 20 && Boolean(onOpenPlayerProfile)
  const currentProfileId = profile?.id || ''
  const [activeTab, setActiveTab] = useState<StaffTab>(isHrConsole ? 'hr' : (rank >= 50 ? 'new' : 'report'))
  const [commerceTab, setCommerceTab] = useState<StaffCommerceTab>('discounts')
  const [attendanceTab, setAttendanceTab] = useState<StaffAttendanceTab>('schedule')
  const [hrTab, setHrTab] = useState<StaffHrTab>('employees')
  const [games, setGames] = useState<StaffGame[]>([])
  const [prices, setPrices] = useState<StaffPriceRule[]>([])
  const [discounts, setDiscounts] = useState<StaffDiscount[]>([])
  const [loyaltyRules, setLoyaltyRules] = useState<StaffLoyaltyRule[]>([])
  const [attendanceShifts, setAttendanceShifts] = useState<StaffScheduleShift[]>([])
  const [attendanceLogs, setAttendanceLogs] = useState<StaffAttendanceLog[]>([])
  const [leaveRequests, setLeaveRequests] = useState<StaffLeaveRequest[]>([])
  const [employeeProfiles, setEmployeeProfiles] = useState<StaffEmployeeProfile[]>([])
  const [attendanceSettings, setAttendanceSettings] = useState<StaffAttendanceSettings>(() => defaultAttendanceSettings())
  const [hrSettings, setHrSettings] = useState<StaffHrSettings>(() => defaultHrSettings())
  const [hrSetupOptions, setHrSetupOptions] = useState<StaffHrSetupOption[]>([])
  const [hrAdjustments, setHrAdjustments] = useState<StaffHrAdjustment[]>([])
  const [payrollRuns, setPayrollRuns] = useState<StaffPayrollRun[]>([])
  const [payrollItems, setPayrollItems] = useState<StaffPayrollItem[]>([])
  const [hrDocuments, setHrDocuments] = useState<StaffHrDocument[]>([])
  const [selectedShiftTemplate, setSelectedShiftTemplate] = useState<StaffShiftTemplateId>('opening')
  const [attendanceScheduleScope, setAttendanceScheduleScope] = useState<StaffScheduleScope>(() => canViewAllEmployeeProfiles ? 'all' : 'department')
  const [draggingShiftId, setDraggingShiftId] = useState('')
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [orderPayments, setOrderPayments] = useState<StaffOrderPayment[]>([])
  const [operationSessions, setOperationSessions] = useState<StaffOperationSession[]>([])
  const [operationSessionScope, setOperationSessionScope] = useState<StaffOperationScope>('today')
  const [expandedOperationSessions, setExpandedOperationSessions] = useState<Record<string, boolean>>({})
  const [operationAddProfileBySession, setOperationAddProfileBySession] = useState<Record<string, string>>({})
  const [operationAddProfileQueryBySession, setOperationAddProfileQueryBySession] = useState<Record<string, string>>({})
  const [operationDeleteDraft, setOperationDeleteDraft] = useState<StaffDeleteSessionDraft | null>(null)
  const [operationDeleteError, setOperationDeleteError] = useState('')
  const [profiles, setProfiles] = useState<StaffProfile[]>([])
  const [achievementAwards, setAchievementAwards] = useState<StaffAchievementAward[]>([])
  const [deletedRecords, setDeletedRecords] = useState<SoftDeletedRecord[]>([])
  const [booking, setBooking] = useState<BookingForm>(() => defaultBookingForm())
  const [customerNameFocused, setCustomerNameFocused] = useState(false)
  const [customerInviteForm, setCustomerInviteForm] = useState<CustomerInviteForm>(() => defaultCustomerInviteForm())
  const [customerInviteStatus, setCustomerInviteStatus] = useState('')
  const [isCustomerInviteSaving, setIsCustomerInviteSaving] = useState(false)
  const [achievementAwardProfileId, setAchievementAwardProfileId] = useState('')
  const [achievementAwardId, setAchievementAwardId] = useState(staffAchievementAwardCatalog[0]?.id || '')
  const [achievementAwardNote, setAchievementAwardNote] = useState('')
  const [achievementAwardStatus, setAchievementAwardStatus] = useState('')
  const [isAchievementAwardSaving, setIsAchievementAwardSaving] = useState(false)
  const [gameForm, setGameForm] = useState(() => defaultGameForm())
  const [priceForm, setPriceForm] = useState(() => defaultPriceForm())
  const [discountForm, setDiscountForm] = useState(() => defaultDiscountForm())
  const [loyaltyForm, setLoyaltyForm] = useState(() => defaultLoyaltyForm())
  const [shiftForm, setShiftForm] = useState(() => defaultShiftForm())
  const [attendanceLogForm, setAttendanceLogForm] = useState(() => defaultAttendanceLogForm())
  const [leaveForm, setLeaveForm] = useState(() => defaultLeaveForm())
  const [employeeForm, setEmployeeForm] = useState(() => defaultEmployeeForm())
  const [hrAdjustmentForm, setHrAdjustmentForm] = useState(() => defaultHrAdjustmentForm())
  const [payrollRunForm, setPayrollRunForm] = useState(() => defaultPayrollRunForm())
  const [hrSetupForm, setHrSetupForm] = useState<Record<StaffHrSetupOptionType, string>>(() => defaultHrSetupForm())
  const [hrSearch, setHrSearch] = useState('')
  const [hrStatusFilter, setHrStatusFilter] = useState<StaffContractStatus | 'all'>('all')
  const [hrDepartmentFilter, setHrDepartmentFilter] = useState('all')
  const [reportStart, setReportStart] = useState(todayString())
  const [reportEnd, setReportEnd] = useState(todayString())
  const [operationsDate, setOperationsDate] = useState(todayString())
  const [attendanceRangeStart, setAttendanceRangeStart] = useState(() => startOfWeek(todayString()))
  const [attendanceRangeEnd, setAttendanceRangeEnd] = useState(() => {
    const start = startOfWeek(todayString())
    return addDays(start, 6)
  })
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareStart, setCompareStart] = useState(() => addDays(todayString(), -1))
  const [compareEnd, setCompareEnd] = useState(() => addDays(todayString(), -1))
  const [reportDatePickerOpen, setReportDatePickerOpen] = useState(false)
  const [reportDatePickerTarget, setReportDatePickerTarget] = useState<'report' | 'compare'>('report')
  const [reportChartMode, setReportChartMode] = useState<StaffReportChartMode>('columns')
  const [accountantExportOpen, setAccountantExportOpen] = useState(false)
  const [accountantExportFormat, setAccountantExportFormat] = useState<AccountantExportFormat>('excel')
  const [accountantExportLanguage, setAccountantExportLanguage] = useState<StaffConsoleLanguage>(() => resolveStaffConsoleLanguage(language))
  const [accountantExportStore, setAccountantExportStore] = useState(accountantExportStores[0].id)
  const [accountantIncludeAttachments, setAccountantIncludeAttachments] = useState(false)
  const [accountantReportId, setAccountantReportId] = useState<AccountantExportReportId>('sales_revenue')
  const [status, setStatus] = useState('')
  const [loadingData, setLoadingData] = useState<Partial<Record<StaffDataKey, boolean>>>({})
  const loadedDataRef = useRef<Partial<Record<StaffDataKey, boolean>>>({})
  const inFlightDataRef = useRef<Partial<Record<StaffDataKey, Promise<void>>>>({})
  const [saving, setSaving] = useState(false)
  const [gameImageUploading, setGameImageUploading] = useState(false)
  const [hrDocumentUploading, setHrDocumentUploading] = useState<StaffHrDocumentType | ''>('')
  const [roleSearch, setRoleSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all')
  const [roleSort, setRoleSort] = useState<StaffRoleSort>('name_asc')
  const [roleHelpOpen, setRoleHelpOpen] = useState(false)
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, StaffRole>>({})
  const [roleSaveFeedback, setRoleSaveFeedback] = useState<Record<string, RoleSaveFeedback>>({})
  const [profileDeleteDraft, setProfileDeleteDraft] = useState<StaffProfileDeleteDraft | null>(null)
  const [reportSnapshot, setReportSnapshot] = useState<StaffReportSnapshot | null>(null)
  const bookingDateInputRef = useRef<HTMLInputElement | null>(null)

  const allowedTabs = useMemo<StaffTab[]>(() => {
    if (isHrConsole) {
      return rank >= 20 ? ['hr'] : ['report']
    }
    const staffTabs: StaffTab[] = [
      'new',
      ...(canCreateCustomerAccounts || canAwardAchievements ? (['clientProfile'] satisfies StaffTab[]) : []),
      'today',
      'orders',
      'report',
      'roles',
      'games',
      'prices',
      'discounts',
    ]
    if (rank >= 120) return [...staffTabs, 'restore']
    if (rank >= 20) return staffTabs
    return ['report']
  }, [canAwardAchievements, canCreateCustomerAccounts, isHrConsole, rank])
  const currentTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0]
  const visibleTabGroups = useMemo(() => staffTabGroups.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => allowedTabs.includes(tab)),
  })).filter((group) => group.tabs.length > 0), [allowedTabs])
  const currentTabGroup = visibleTabGroups.find((group) => group.tabs.includes(currentTab))?.id || visibleTabGroups[0]?.id || 'reports'
  const canEditCommerceTab = commerceTab === 'loyalty' ? canManageConfig : canCreateOrders
  const visibleAttendanceTabs = useMemo(() => staffAttendanceTabs.filter((item) => {
    if (item === 'clock' && !canViewAttendanceClock) return false
    if (item === 'settings' && !canViewAttendanceSettings) return false
    return true
  }), [canViewAttendanceClock, canViewAttendanceSettings])
  const currentAttendanceTab = visibleAttendanceTabs.includes(attendanceTab)
    ? attendanceTab
    : visibleAttendanceTabs[0] || 'schedule'
  const effectiveShiftTemplates = useMemo(
    () => normalizeStaffShiftTemplates(attendanceSettings.shift_templates, attendanceSettings.standard_break_minutes),
    [attendanceSettings.shift_templates, attendanceSettings.standard_break_minutes],
  )

  const activeGames = useMemo(() => games.filter((game) => game.active), [games])
  const discountRules = useMemo(() => discounts.filter((discount) => !discount.code), [discounts])
  const voucherRules = useMemo(() => discounts.filter((discount) => Boolean(discount.code)), [discounts])
  const selectedGame = useMemo(() => activeGames.find((game) => game.id === booking.gameId) || activeGames[0] || null, [activeGames, booking.gameId])
  const selectedRule = useMemo(() => {
    if (!selectedGame) return null
    return selectPricingRule(prices, selectedGame.id, booking.date, booking.time)
  }, [booking.date, booking.time, prices, selectedGame])
  const bookingUnitPrice = selectedRule?.price_per_player || 200000
  const bookingDurationBlocks = Math.max(1, Math.ceil((selectedGame?.duration_minutes || 20) / 20))
  const bookingSubtotal = selectedRule?.price_per_arena_slot
    ? selectedRule.price_per_arena_slot * bookingDurationBlocks
    : bookingUnitPrice * booking.players
  const availableBookingDiscounts = useMemo(() => (
    discounts.filter((discount) => discountMatchesContext(discount, {
      date: booking.date,
      gameId: selectedGame?.id || null,
      players: booking.players,
      priceRuleId: selectedRule?.id || null,
      subtotal: bookingSubtotal,
      ticketType: 'all',
      time: booking.time,
    }))
  ), [booking.date, booking.players, booking.time, bookingSubtotal, discounts, selectedGame, selectedRule])
  const selectedDiscount = useMemo(() => availableBookingDiscounts.find((discount) => discount.id === booking.discountId) || null, [availableBookingDiscounts, booking.discountId])

  const quote = useMemo(() => {
    const subtotal = bookingSubtotal
    const manualDiscountTotal = calculateManualDiscount(booking.manualDiscountType, booking.manualDiscountValue, subtotal)
    const discountTotal = manualDiscountTotal > 0
      ? manualDiscountTotal
      : calculateDiscount(selectedDiscount, subtotal, bookingUnitPrice)
    return {
      unitPrice: bookingUnitPrice,
      subtotal,
      discountTotal,
      discountLabel: manualDiscountTotal > 0
        ? manualDiscountLabel(booking.manualDiscountType, booking.manualDiscountValue, text)
        : selectedDiscount?.name || text.noDiscount,
      total: Math.max(0, subtotal - discountTotal),
      ruleName: selectedRule?.rule_name || text.defaultWalkInRate,
      duration: selectedGame?.duration_minutes || 20,
    }
  }, [booking.manualDiscountType, booking.manualDiscountValue, bookingSubtotal, bookingUnitPrice, selectedDiscount, selectedGame, selectedRule, text])
  const bookingPaymentSplits = useMemo(() => normalizePaymentSplits(booking.paymentSplits), [booking.paymentSplits])
  const bookingPaidTotal = useMemo(() => paymentSplitTotal(bookingPaymentSplits), [bookingPaymentSplits])
  const bookingRemainingTotal = Math.max(0, quote.total - bookingPaidTotal)

  const orderPaymentsByOrderId = useMemo(() => paymentMapFromRows(orderPayments), [orderPayments])
  const operationOrders = useMemo(() => (
    orders
      .filter((order) => order.booking_date === operationsDate)
      .sort((left, right) => left.booking_time.localeCompare(right.booking_time) || left.order_number.localeCompare(right.order_number))
  ), [operationsDate, orders])
  const operationOrderBySessionId = useMemo(() => {
    const map = new Map<string, StaffOrder>()
    operationOrders.forEach((order) => {
      if (order.session_id) map.set(order.session_id, order)
    })
    return map
  }, [operationOrders])
  const unlinkedOperationOrders = useMemo(() => (
    operationOrders.filter((order) => !order.session_id || !operationSessions.some((session) => session.id === order.session_id))
  ), [operationOrders, operationSessions])
  const operationSummary = useMemo(() => {
    const linkedOrderSessionIds = new Set(operationOrders.map((order) => order.session_id).filter(Boolean))
    const sessionOnlyPlayers = operationSessions.reduce((sum, session) => {
      if (linkedOrderSessionIds.has(session.id)) return sum
      return sum + sessionBookedPlayers(session)
    }, 0)
    const sessionOnlyCapacity = operationSessions.reduce((sum, session) => {
      if (linkedOrderSessionIds.has(session.id)) return sum
      return sum + sessionCapacity(session)
    }, 0)
    const orderPlayers = operationOrders.reduce((sum, order) => sum + order.players_count, 0)
    const orderCapacity = operationOrders.reduce((sum, order) => {
      const session = operationSessions.find((item) => item.id === order.session_id)
      return sum + (session ? sessionCapacity(session, order) : order.players_count)
    }, 0)
    const checkedIn = operationSessions.reduce((sum, session) => sum + sessionCheckedInCount(session), 0)
    const paid = operationOrders.reduce((sum, order) => sum + orderPaidAmount(order, orderPaymentsByOrderId), 0)
    const total = operationOrders.reduce((sum, order) => sum + order.total, 0)

    return {
      sessions: operationSessions.length,
      ticketBookings: operationSessions.filter((session) => session.booking_type === 'ticket').length,
      bookedPlayers: orderPlayers + sessionOnlyPlayers,
      capacity: orderCapacity + sessionOnlyCapacity,
      checkedIn,
      checkablePlayers: operationSessions.reduce((sum, session) => sum + Math.max(session.session_participants?.length || 0, sessionCheckedInCount(session)), 0),
      paid,
      unpaid: Math.max(0, total - paid),
    }
  }, [operationOrders, operationSessions, orderPaymentsByOrderId])
  const [attendanceWeekStart, attendanceWeekEnd] = useMemo(
    () => attendanceDateRange(attendanceRangeStart, attendanceRangeEnd),
    [attendanceRangeEnd, attendanceRangeStart]
  )
  const profileById = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles])
  const awardableProfiles = useMemo(() => (
    profiles.filter((item) => !isDemoProfile(item))
  ), [profiles])
  const gameNameById = useMemo(() => new Map(games.map((item) => [item.id, item.name])), [games])
  const priceRuleNameById = useMemo(() => new Map(prices.map((item) => [item.id, item.rule_name])), [prices])
  const employeeProfileById = useMemo(() => new Map(employeeProfiles.map((item) => [item.profile_id, item])), [employeeProfiles])
  const allStaffProfileOptions = useMemo(() => (
    profiles.filter((item) => !isDemoProfile(item) && roleLabel(item.role, item.email) !== 'player')
  ), [profiles])
  const attendanceWeekStaffIds = useMemo(() => {
    const ids = new Set<string>()
    attendanceShifts.forEach((shift) => ids.add(shift.staff_profile_id))
    attendanceLogs.forEach((log) => ids.add(log.staff_profile_id))
    leaveRequests.forEach((leave) => ids.add(leave.staff_profile_id))
    return ids
  }, [attendanceLogs, attendanceShifts, leaveRequests])
  const staffProfileOptions = useMemo(() => (
    allStaffProfileOptions.filter((item) => {
      const employee = employeeProfileById.get(item.id)
      return employee?.active !== false || attendanceWeekStaffIds.has(item.id)
    })
  ), [allStaffProfileOptions, attendanceWeekStaffIds, employeeProfileById])
  const visibleAllStaffProfileOptions = useMemo(() => (
    canViewAllEmployeeProfiles
      ? allStaffProfileOptions
      : allStaffProfileOptions.filter((item) => item.id === currentProfileId)
  ), [allStaffProfileOptions, canViewAllEmployeeProfiles, currentProfileId])
  const visibleStaffProfileOptions = useMemo(() => (
    canViewAllEmployeeProfiles
      ? staffProfileOptions
      : staffProfileOptions.filter((item) => item.id === currentProfileId)
  ), [canViewAllEmployeeProfiles, currentProfileId, staffProfileOptions])
  const visibleAttendanceShifts = useMemo(() => (
    canViewAllEmployeeProfiles
      ? attendanceShifts
      : attendanceShifts.filter((shift) => shift.staff_profile_id === currentProfileId)
  ), [attendanceShifts, canViewAllEmployeeProfiles, currentProfileId])
  const currentEmployeeDepartment = (employeeProfileById.get(currentProfileId)?.department || '').trim()
  const effectiveAttendanceScheduleScope = attendanceScheduleScope === 'all' && !canViewAllEmployeeProfiles
    ? 'department'
    : attendanceScheduleScope
  const attendanceScheduleScopeOptions = useMemo<StaffScheduleScope[]>(() => (
    canViewAllEmployeeProfiles ? ['all', 'department', 'mine'] : ['department', 'mine']
  ), [canViewAllEmployeeProfiles])
  const visibleScheduleStaffProfileOptions = useMemo(() => {
    if (effectiveAttendanceScheduleScope === 'mine') {
      return staffProfileOptions.filter((item) => item.id === currentProfileId)
    }
    if (effectiveAttendanceScheduleScope === 'department') {
      if (!currentEmployeeDepartment) {
        return staffProfileOptions.filter((item) => item.id === currentProfileId)
      }
      return staffProfileOptions.filter((item) => (
        (employeeProfileById.get(item.id)?.department || '').trim() === currentEmployeeDepartment
      ))
    }
    return staffProfileOptions
  }, [currentEmployeeDepartment, currentProfileId, effectiveAttendanceScheduleScope, employeeProfileById, staffProfileOptions])
  const visibleScheduleStaffIds = useMemo(() => new Set(visibleScheduleStaffProfileOptions.map((item) => item.id)), [visibleScheduleStaffProfileOptions])
  const visibleScheduleAttendanceShifts = useMemo(() => (
    attendanceShifts.filter((shift) => visibleScheduleStaffIds.has(shift.staff_profile_id))
  ), [attendanceShifts, visibleScheduleStaffIds])
  const visibleAttendanceLogs = useMemo(() => (
    canViewAllEmployeeProfiles
      ? attendanceLogs
      : attendanceLogs.filter((log) => log.staff_profile_id === currentProfileId)
  ), [attendanceLogs, canViewAllEmployeeProfiles, currentProfileId])
  const visibleLeaveRequests = useMemo(() => (
    canViewAllEmployeeProfiles
      ? leaveRequests
      : leaveRequests.filter((leave) => leave.staff_profile_id === currentProfileId)
  ), [canViewAllEmployeeProfiles, currentProfileId, leaveRequests])
  const firstStaffProfileId = visibleStaffProfileOptions[0]?.id || ''
  const firstScheduleStaffProfileId = visibleScheduleStaffProfileOptions[0]?.id || firstStaffProfileId
  const firstEmployeeStaffProfileId = visibleAllStaffProfileOptions[0]?.id || ''
  const selectedEmployeeStaffId = employeeForm.profile_id || firstEmployeeStaffProfileId
  const selectedEmployeeStaffProfile = selectedEmployeeStaffId
    ? visibleAllStaffProfileOptions.find((item) => item.id === selectedEmployeeStaffId) || null
    : null
  const hrOptionsByType = useMemo(() => {
    const map = new Map<StaffHrSetupOptionType, StaffHrSetupOption[]>()
    staffHrSetupOptionTypes.forEach((type) => map.set(type, []))
    hrSetupOptions
      .filter((option) => option.active)
      .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
      .forEach((option) => {
        const items = map.get(option.option_type) || []
        items.push(option)
        map.set(option.option_type, items)
      })
    return map
  }, [hrSetupOptions])
  const hrDepartmentOptions = hrOptionsByType.get('department') || []
  const hrLocationOptions = hrOptionsByType.get('location') || []
  const hrJobTitleOptions = hrOptionsByType.get('job_title') || []
  const hrContractTypeOptions = hrOptionsByType.get('contract_type') || []
  const filteredHrStaffProfiles = useMemo(() => {
    const query = normalizeStaffSearchValue(hrSearch)
    return visibleAllStaffProfileOptions.filter((staffProfile) => {
      const employee = employeeProfileById.get(staffProfile.id)
      if (hrStatusFilter !== 'all' && normalizeStaffContractStatus(employee?.contract_status) !== hrStatusFilter) return false
      if (hrDepartmentFilter !== 'all' && (employee?.department || '') !== hrDepartmentFilter) return false
      if (!query) return true
      return [
        customerName(staffProfile, text),
        staffProfile.email || '',
        staffProfile.phone || '',
        employee?.employee_code || '',
        employee?.attendance_number || '',
        employee?.legal_name || '',
        employee?.job_title || '',
        employee?.department || '',
        employee?.main_work_location || '',
      ].some((value) => normalizeStaffSearchValue(value).includes(query))
    })
  }, [employeeProfileById, hrDepartmentFilter, hrSearch, hrStatusFilter, text, visibleAllStaffProfileOptions])
  const payrollPeriodStart = payrollRunForm.period_start || startOfMonth(todayString())
  const payrollPeriodEnd = payrollRunForm.period_end || endOfMonth(payrollPeriodStart)
  const staffPayrollCalculations = useMemo(() => {
    const map = new Map<string, StaffPayrollCalculation>()
    visibleStaffProfileOptions.forEach((staffProfile) => {
      map.set(staffProfile.id, calculateStaffPayroll(
        staffProfile.id,
        employeeProfileById.get(staffProfile.id),
        attendanceShifts,
        attendanceLogs,
        leaveRequests,
        hrAdjustments,
        hrSettings,
        payrollPeriodStart,
        payrollPeriodEnd,
      ))
    })
    return map
  }, [attendanceLogs, attendanceShifts, employeeProfileById, hrAdjustments, hrSettings, leaveRequests, payrollPeriodEnd, payrollPeriodStart, visibleStaffProfileOptions])
  const selectedEmployeePayrollSummary = staffPayrollCalculations.get(selectedEmployeeStaffId) || emptyStaffPayrollCalculation(selectedEmployeeStaffId)
  const hrPayrollTotals = useMemo(() => {
    const rows = Array.from(staffPayrollCalculations.values())
    return {
      gross: rows.reduce((sum, row) => sum + row.grossIncome, 0),
      net: rows.reduce((sum, row) => sum + row.netIncome, 0),
      companyCost: rows.reduce((sum, row) => sum + row.companyCost, 0),
      restWarnings: rows.reduce((sum, row) => sum + row.restWarningCount, 0),
    }
  }, [staffPayrollCalculations])
  const selectedEmployeeDocuments = useMemo(() => (
    hrDocuments.filter((document) => document.profile_id === selectedEmployeeStaffId)
  ), [hrDocuments, selectedEmployeeStaffId])
  const periodHrAdjustments = useMemo(() => (
    hrAdjustments.filter((adjustment) => adjustmentAppliesToPeriod(adjustment, payrollPeriodStart, payrollPeriodEnd))
  ), [hrAdjustments, payrollPeriodEnd, payrollPeriodStart])
  const selectedEmployeeOutstandingDebt = useMemo(() => (
    hrAdjustments
      .filter((item) => item.profile_id === selectedEmployeeStaffId && ['advance', 'debt'].includes(item.adjustment_type) && item.status !== 'cancelled' && item.status !== 'rejected')
      .reduce((sum, item) => sum + item.amount_vnd, 0) -
    hrAdjustments
      .filter((item) => item.profile_id === selectedEmployeeStaffId && item.adjustment_type === 'debt_repayment' && item.status !== 'cancelled' && item.status !== 'rejected')
      .reduce((sum, item) => sum + item.amount_vnd, 0)
  ), [hrAdjustments, selectedEmployeeStaffId])
  const customerNameSuggestions = useMemo(() => {
    const query = normalizeStaffSearchValue(booking.customerName.trim())
    if (query.length < 2) return []

    return profiles
      .filter((item) => !isDemoProfile(item) && customerSearchText(item, text).includes(query))
      .sort((left, right) => {
        const leftName = normalizeStaffSearchValue(customerName(left, text))
        const rightName = normalizeStaffSearchValue(customerName(right, text))
        const leftStarts = leftName.startsWith(query) ? 0 : 1
        const rightStarts = rightName.startsWith(query) ? 0 : 1
        return leftStarts - rightStarts
          || leftName.localeCompare(rightName)
          || (left.phone || '').localeCompare(right.phone || '')
          || (left.email || '').localeCompare(right.email || '')
      })
  }, [booking.customerName, profiles, text])
  const showCustomerNameSuggestions = customerNameFocused && customerNameSuggestions.length > 0
  const employeeUsesMonthlyGross = isMonthlyGrossEmployment(employeeForm.employment_type)
  const employeePayrollSummary = selectedEmployeePayrollSummary
  const attendanceWeekDates = useMemo(() => attendanceDateKeys(attendanceWeekStart, attendanceWeekEnd), [attendanceWeekEnd, attendanceWeekStart])
  const attendanceGridStyle = useMemo(() => ({
    gridTemplateColumns: `minmax(156px, 0.75fr) repeat(${attendanceWeekDates.length}, minmax(108px, 1fr))`,
    minWidth: `${156 + attendanceWeekDates.length * 112}px`,
  }), [attendanceWeekDates.length])
  const attendanceShiftsByCell = useMemo(() => {
    const map = new Map<string, StaffScheduleShift[]>()
    visibleScheduleAttendanceShifts.forEach((shift) => {
      const key = `${shift.staff_profile_id}:${shift.shift_date}`
      const shifts = map.get(key) || []
      shifts.push(shift)
      map.set(key, shifts)
    })
    map.forEach((shifts) => {
      shifts.sort((left, right) => left.start_time.localeCompare(right.start_time) || left.end_time.localeCompare(right.end_time))
    })
    return map
  }, [visibleScheduleAttendanceShifts])
  const shiftWarningsById = useMemo(() => {
    const map = new Map<string, string[]>()
    attendanceShifts.forEach((shift) => {
      const warnings = shiftConflictWarnings(shift, attendanceShifts, leaveRequests, attendanceSettings, text)
      if (warnings.length > 0) map.set(shift.id, warnings)
    })
    return map
  }, [attendanceSettings, attendanceShifts, leaveRequests, text])
  const draftShiftCount = useMemo(() => attendanceShifts.filter((shift) => shift.status === 'draft').length, [attendanceShifts])
  const attendanceSummary = useMemo(() => {
    const scheduledMinutes = visibleAttendanceShifts.reduce((sum, shift) => (
      shift.status === 'cancelled'
        ? sum
        : sum + minutesBetweenTimes(shift.start_time, shift.end_time, shift.break_minutes)
    ), 0)
    const workedMinutes = visibleAttendanceLogs.reduce((sum, log) => sum + minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes), 0)
    const regularMinutes = visibleAttendanceLogs.reduce((sum, log) => sum + log.regular_minutes, 0)
    const overtimeMinutes = visibleAttendanceLogs.reduce((sum, log) => sum + log.overtime_minutes, 0)
    const nightMinutes = visibleAttendanceLogs.reduce((sum, log) => sum + log.night_minutes, 0)
    const holidayMinutes = visibleAttendanceLogs.reduce((sum, log) => sum + log.holiday_minutes, 0)
    const leaveHours = visibleLeaveRequests
      .filter((item) => item.status === 'approved')
      .reduce((sum, item) => sum + Number(item.hours || 0), 0)

    return { scheduledMinutes, workedMinutes, regularMinutes, overtimeMinutes, nightMinutes, holidayMinutes, leaveHours }
  }, [visibleAttendanceLogs, visibleAttendanceShifts, visibleLeaveRequests])
  const filteredRoleProfiles = useMemo(() => {
    const query = roleSearch.trim().toLowerCase()
    const rows = profiles.filter((item) => {
      const effectiveRole = roleLabel(item.role, item.email)
      if (roleFilter !== 'all' && effectiveRole !== roleFilter) return false
      if (!query) return true
      return [
        customerName(item, text),
        item.email || '',
        item.phone || '',
        staffRoleName(effectiveRole, text),
      ].some((value) => value.toLowerCase().includes(query))
    })

    return rows.sort((left, right) => {
      const leftName = customerName(left, text).toLowerCase()
      const rightName = customerName(right, text).toLowerCase()
      const leftEmail = (left.email || '').toLowerCase()
      const rightEmail = (right.email || '').toLowerCase()
      const leftRank = staffRank(left.role, left.email)
      const rightRank = staffRank(right.role, right.email)
      const leftCreated = new Date(left.created_at || 0).getTime()
      const rightCreated = new Date(right.created_at || 0).getTime()

      if (roleSort === 'name_desc') return rightName.localeCompare(leftName) || leftEmail.localeCompare(rightEmail)
      if (roleSort === 'created_desc') return rightCreated - leftCreated || leftName.localeCompare(rightName)
      if (roleSort === 'role_desc') return rightRank - leftRank || leftName.localeCompare(rightName)
      if (roleSort === 'role_asc') return leftRank - rightRank || leftName.localeCompare(rightName)
      if (roleSort === 'email_asc') return leftEmail.localeCompare(rightEmail) || leftName.localeCompare(rightName)
      return leftName.localeCompare(rightName) || leftEmail.localeCompare(rightEmail)
    })
  }, [profiles, roleFilter, roleSearch, roleSort, text])

  const emptyReport = useMemo(() => emptyStaffReport(text), [text])
  const reportOrders = reportSnapshot?.orders ?? emptyStaffOrders
  const comparisonOrders = compareEnabled ? reportSnapshot?.comparisonOrders ?? emptyStaffOrders : emptyStaffOrders
  const reportPayments = reportSnapshot?.payments ?? emptyStaffPayments
  const reportPaymentsByOrderId = useMemo(() => paymentMapFromRows(reportPayments), [reportPayments])
  const report = reportSnapshot?.report || emptyReport
  const comparisonReport = compareEnabled ? reportSnapshot?.comparisonReport || emptyReport : emptyReport
  const reportSeries = reportSnapshot?.reportSeries ?? emptyStaffDailySeries
  const comparisonSeries = compareEnabled ? reportSnapshot?.comparisonSeries ?? emptyStaffDailySeries : emptyStaffDailySeries
  const weekdayRevenue = useMemo(() => buildWeekdayRevenue(reportOrders, resolvedLanguage), [reportOrders, resolvedLanguage])
  const comparisonWeekdayRevenue = useMemo(
    () => compareEnabled ? buildWeekdayRevenue(comparisonOrders, resolvedLanguage) : [],
    [compareEnabled, comparisonOrders, resolvedLanguage]
  )
  const weekdayRevenueMax = useMemo(() => Math.max(
    1,
    ...weekdayRevenue.map((point) => point.sales),
    ...comparisonWeekdayRevenue.map((point) => point.sales)
  ), [comparisonWeekdayRevenue, weekdayRevenue])
  const hourlyRevenue = useMemo(() => buildHourlyRevenue(reportOrders), [reportOrders])
  const comparisonHourlyRevenue = useMemo(
    () => compareEnabled ? buildHourlyRevenue(comparisonOrders) : [],
    [compareEnabled, comparisonOrders]
  )
  const hourlyRevenueMax = useMemo(() => Math.max(
    1,
    ...hourlyRevenue.map((point) => point.sales),
    ...comparisonHourlyRevenue.map((point) => point.sales)
  ), [comparisonHourlyRevenue, hourlyRevenue])
  const hourlyLinePath = useMemo(() => buildSmoothLineChartPath(hourlyRevenue, hourlyRevenueMax), [hourlyRevenue, hourlyRevenueMax])
  const comparisonHourlyLinePath = useMemo(
    () => buildSmoothLineChartPath(comparisonHourlyRevenue, hourlyRevenueMax),
    [comparisonHourlyRevenue, hourlyRevenueMax]
  )
  const hourlyAreaPath = useMemo(() => buildChartAreaPath(hourlyLinePath), [hourlyLinePath])
  const comparisonHourlyAreaPath = useMemo(() => buildChartAreaPath(comparisonHourlyLinePath), [comparisonHourlyLinePath])
  const reportChartMax = useMemo(() => Math.max(
    1,
    ...reportSeries.map((point) => point.sales),
    ...comparisonSeries.map((point) => point.sales)
  ), [comparisonSeries, reportSeries])
  const paymentMix = useMemo(() => {
    const items = [
      { label: text.labels.cash, value: report.cashTotal },
      { label: text.labels.bankTransfer, value: report.bankTransferTotal },
      { label: text.unpaid, value: report.unpaidAmount },
    ]
    const total = Math.max(1, items.reduce((sum, item) => sum + item.value, 0))
    return items.map((item) => ({ ...item, share: Math.round((item.value / total) * 100) }))
  }, [report, text])
  const reportLinePath = useMemo(() => buildLineChartPath(reportSeries, reportChartMax), [reportChartMax, reportSeries])
  const comparisonLinePath = useMemo(() => buildLineChartPath(comparisonSeries, reportChartMax), [comparisonSeries, reportChartMax])
  const pieItems = useMemo(() => paymentPieItems(report, text), [report, text])
  const pieStops = useMemo(() => conicStops(pieItems), [pieItems])
  const selectedGameAudiences = useMemo(() => normalizeStaffAudience(gameForm.audience), [gameForm.audience])
  const selectedGameArenaIds = useMemo(() => parseStaffArenaIds(gameForm.available_arena_ids), [gameForm.available_arena_ids])
  const selectedDiscountValueUnit = discountValueUnit(discountForm.discount_type)
  const discountHasHourLimit = Boolean(discountForm.time_start || discountForm.time_end)
  const currentTabLoading = Boolean(
    currentTab === 'new'
      ? loadingData.games || loadingData.prices || loadingData.discounts || loadingData.profiles
    : currentTab === 'clientProfile'
        ? loadingData.profiles || loadingData.achievementAwards
        : currentTab === 'today'
          ? loadingData.games || loadingData.today || loadingData.todaySessions || loadingData.profiles
          : currentTab === 'attendance'
            ? loadingData.profiles || loadingData.attendance
            : currentTab === 'hr'
              ? loadingData.profiles || loadingData.attendance || loadingData.hr
              : currentTab === 'games'
                ? loadingData.games
                : currentTab === 'prices'
                  ? loadingData.games || loadingData.prices
                  : currentTab === 'discounts'
                    ? loadingData.games || loadingData.prices || loadingData.discounts || (commerceTab === 'loyalty' && loadingData.loyalty)
                    : currentTab === 'roles'
                      ? loadingData.profiles
                      : currentTab === 'restore'
                        ? loadingData.restore
                        : currentTab === 'orders'
                          ? loadingData.games || loadingData.orders
                          : loadingData.games || loadingData.report
  )

  useEffect(() => {
    if (currentTab === 'new') {
      void Promise.all([loadGames(), loadPrices(), loadDiscounts(), loadProfiles()])
    } else if (currentTab === 'clientProfile') {
      const loaders: Array<Promise<void>> = []
      if (canAwardAchievements) loaders.push(loadProfiles(), loadAchievementAwards())
      void Promise.all(loaders)
    } else if (currentTab === 'today') {
      void Promise.all([loadGames(), loadProfiles(), loadTodayOrders(true), loadTodaySessions(true)])
    } else if (currentTab === 'attendance') {
      void Promise.all([loadProfiles(), loadAttendanceData(true)])
    } else if (currentTab === 'hr') {
      void Promise.all([loadProfiles(), loadAttendanceData(true), loadHrData(true)])
    } else if (currentTab === 'games') {
      void loadGames()
    } else if (currentTab === 'prices') {
      void Promise.all([loadGames(), loadPrices()])
    } else if (currentTab === 'discounts') {
      const loaders: Array<Promise<void>> = [loadGames(), loadPrices(), loadDiscounts()]
      if (commerceTab === 'loyalty') loaders.push(loadLoyaltyRules())
      void Promise.all(loaders)
    } else if (currentTab === 'roles') {
      void loadProfiles()
    } else if (currentTab === 'restore') {
      void loadDeletedRecords()
    } else if (currentTab === 'orders') {
      void Promise.all([loadGames(), loadRecentOrders()])
    }
    // Loaders are keyed by tab and internally dedupe with refs; adding loader functions would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, commerceTab, operationsDate, operationSessionScope, attendanceWeekEnd, attendanceWeekStart, payrollPeriodEnd, payrollPeriodStart])

  useEffect(() => {
    if (currentTab !== 'report') return
    void Promise.all([loadGames(), loadReportData(true)])
    // Report data is intentionally refreshed only by visible range/filter state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, reportStart, reportEnd, compareEnabled, compareStart, compareEnd])

  async function runStaffLoader(key: StaffDataKey, loader: () => Promise<void>, force = false) {
    if (inFlightDataRef.current[key]) {
      await inFlightDataRef.current[key]
      if (!force) return
    }
    if (!force && loadedDataRef.current[key]) return

    setLoadingData((current) => ({ ...current, [key]: true }))
    const promise = loader()
      .then(() => {
        loadedDataRef.current[key] = true
      })
      .catch((error: unknown) => {
        loadedDataRef.current[key] = false
        setStatus(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        delete inFlightDataRef.current[key]
        setLoadingData((current) => ({ ...current, [key]: false }))
      })
    inFlightDataRef.current[key] = promise
    await promise
  }

  function markStaffDataStale(...keys: StaffDataKey[]) {
    keys.forEach((key) => {
      loadedDataRef.current[key] = false
    })
  }

  async function fetchOrderPayments(orderRows: StaffOrder[]) {
    const orderIds = orderRows.map((order) => order.id)
    if (orderIds.length === 0) return []
    const { data, error } = await supabase
      .from('staff_order_payments')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as StaffOrderPayment[]
  }

  async function loadGames(force = false) {
    await runStaffLoader('games', async () => {
      const { data, error } = await supabase.from('staff_games').select('*').order('name', { ascending: true })
      if (error) throw new Error(error.message)
      setGames((data ?? []) as StaffGame[])
    }, force)
  }

  async function loadPrices(force = false) {
    await runStaffLoader('prices', async () => {
      const { data, error } = await supabase.from('staff_pricing_rules').select('*').order('valid_from', { ascending: false })
      if (error) throw new Error(error.message)
      setPrices((data ?? []) as StaffPriceRule[])
    }, force)
  }

  async function loadDiscounts(force = false) {
    await runStaffLoader('discounts', async () => {
      const { data, error } = await supabase.from('staff_discount_rules').select('*').order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      setDiscounts((data ?? []) as StaffDiscount[])
    }, force)
  }

  async function loadLoyaltyRules(force = false) {
    await runStaffLoader('loyalty', async () => {
      const { data, error } = await supabase.from('staff_loyalty_rules').select('*').order('valid_from', { ascending: false }).order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      setLoyaltyRules((data ?? []) as StaffLoyaltyRule[])
    }, force)
  }

  async function loadProfiles(force = false) {
    await runStaffLoader('profiles', async () => {
      async function hydrateProfileAvatars(rows: StaffProfile[]) {
        const missingAvatarRows = rows.filter((item) => (
          !item.avatar_url
          && !item.avatar_emoji
          && !item.avatar_initials
          && !item.avatar_color
          && !item.avatar_text_color
        ))

        if (missingAvatarRows.length === 0) return rows

        const profileIds = missingAvatarRows.map((item) => item.id).filter(Boolean)
        if (profileIds.length === 0) return rows

        const { data } = await supabase
          .from('profiles')
          .select(staffProfileAvatarSelect)
          .in('id', profileIds)

        const avatarById = new Map((data ?? []).map((item) => [item.id, item as StaffProfile]))
        return rows.map((item) => ({
          ...item,
          ...(avatarById.get(item.id) ?? {}),
        }))
      }

      const rpcResult = await supabase.rpc('profile_search', {
        p_search: null,
        p_limit: 500,
        p_offset: 0,
        p_role: 'all',
        p_include_demo: false,
        p_sort: roleSort,
      })

      if (!rpcResult.error && rpcResult.data) {
        const rows = (rpcResult.data as StaffProfile[]).filter((item) => !isDemoProfile(item))
        setProfiles(await hydrateProfileAvatars(rows))
        setPendingRoleChanges({})
        return
      }

      if (rpcResult.error && !rpcFunctionMissing(rpcResult.error)) {
        throw new Error(rpcResult.error.message)
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(staffProfileSelect)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
        .limit(500)
      if (error) throw new Error(error.message)
      setProfiles(((data ?? []) as StaffProfile[]).filter((item) => !isDemoProfile(item)))
      setPendingRoleChanges({})
    }, force)
  }

  async function loadAchievementAwards(force = false) {
    await runStaffLoader('achievementAwards', async () => {
      if (!canAwardAchievements) {
        setAchievementAwards([])
        return
      }
      const { data, error } = await supabase
        .from('profile_achievement_awards')
        .select('id, profile_id, achievement_id, achievement_kind, title, description, note, awarded_at')
        .is('revoked_at', null)
        .order('awarded_at', { ascending: false })
        .limit(500)
      if (error) throw new Error(error.message)
      setAchievementAwards((data ?? []) as StaffAchievementAward[])
    }, force)
  }

  async function fetchAuditLogs(limit = 60) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_user_id, action, entity_type, entity_id, old_value, new_value, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []) as StaffAuditLog[]
  }

  async function loadDeletedRecords(force = false) {
    await runStaffLoader('restore', async () => {
      if (!canRestoreDeleted) {
        setDeletedRecords([])
        return
      }
      const { data, error } = await supabase.rpc('get_soft_deleted_records', { p_limit: 100 })
      if (error) throw new Error(error.message)
      setDeletedRecords((data ?? []) as SoftDeletedRecord[])
    }, force)
  }

  async function loadOrdersForRange(key: 'today' | 'orders', start: string, end: string, force = false) {
    const [from, to] = orderedRange(start, end)
    await runStaffLoader(key, async () => {
      const rpcResult = await supabase.rpc('staff_orders_page', {
        p_start_date: from,
        p_end_date: to,
        p_limit: key === 'today' ? 120 : 250,
        p_offset: 0,
        p_search: null,
        p_status: null,
      })

      if (!rpcResult.error && rpcResult.data) {
        const { orders: rows, payments } = staffOrdersPageFromRpc(rpcResult.data)
        setOrders((current) => key === 'orders' ? rows : mergeById(current, rows))
        setOrderPayments((current) => key === 'orders'
          ? payments
          : mergeOrderPayments(current, rows.map((order) => order.id), payments))
        return
      }

      if (rpcResult.error && !rpcFunctionMissing(rpcResult.error)) {
        throw new Error(rpcResult.error.message)
      }

      const { data, error } = await supabase
        .from('staff_orders')
        .select('*')
        .gte('booking_date', from)
        .lte('booking_date', to)
        .order('booking_date', { ascending: false })
        .order('booking_time', { ascending: false })
        .limit(key === 'today' ? 120 : 250)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as StaffOrder[]
      const payments = await fetchOrderPayments(rows)
      setOrders((current) => key === 'orders' ? rows : mergeById(current, rows))
      setOrderPayments((current) => key === 'orders'
        ? payments
        : mergeOrderPayments(current, rows.map((order) => order.id), payments))
    }, force)
  }

  async function loadTodayOrders(force = false) {
    if (operationSessionScope !== 'today') {
      setOrders([])
      setOrderPayments([])
      return
    }
    await loadOrdersForRange('today', operationsDate, operationsDate, force)
  }

  async function loadTodaySessions(force = false) {
    await runStaffLoader('todaySessions', async () => {
      const today = todayString()
      let query = supabase
        .from('sessions')
        .select('id, owner_id, name, date, start_time, duration_minutes, max_players, arena_count, game_options, confirmed_game_id, visibility, status, booking_type, ticket_type, ticket_player_count, ticket_total_price, ticket_status, ticket_reference, notes, session_participants(id, profile_id, display_name, deleted_at, checked_in, payment_status, payment_amount, payment_splits, score, accuracy_percent, projectiles_fired, escape_duration_seconds, placement, chapter_times:session_participant_chapter_times(chapter_number, duration_seconds, game_slug))')
        .is('deleted_at', null)

      query = operationSessionScope === 'past'
        ? query.lt('date', today).order('date', { ascending: false }).order('start_time', { ascending: false }).limit(80)
        : query.eq('date', operationsDate).order('start_time', { ascending: true })

      const { data, error } = await query
      if (error) throw new Error(error.message)
      setOperationSessions((data ?? []).map((session) => ({
        ...session,
        session_participants: (session.session_participants ?? []).filter((participant) => !participant.deleted_at),
      })) as StaffOperationSession[])
    }, force)
  }

  async function sendStaffBookingUpdateNotification(
    session: StaffOperationSession | null,
    order: StaffOrder | null,
    payload: {
      action: 'edited' | 'cancelled' | 'deleted'
      title?: string | null
      reference?: string | null
      date?: string | null
      time?: string | null
      total?: number | null
      summary?: string | null
      changes?: Array<{ label: string; before?: string | number | boolean | null; after?: string | number | boolean | null }>
    },
  ) {
    try {
      await notifyBookingUpdateEmail(supabase, {
        action: payload.action,
        bookingKind: session ? operationBookingKind(session) : 'ticket',
        sessionId: session?.id || order?.session_id || null,
        orderId: order?.id || null,
        title: payload.title || session?.name || null,
        reference: payload.reference || order?.order_number || session?.ticket_reference || null,
        date: payload.date || order?.booking_date || session?.date || null,
        time: payload.time || normalizeTime(order?.booking_time || session?.start_time) || null,
        customerName: order?.customer_name || null,
        customerPhone: order?.customer_phone || null,
        customerEmail: order?.customer_email || null,
        total: payload.total ?? order?.total ?? session?.ticket_total_price ?? null,
        summary: payload.summary || null,
        changes: payload.changes || [],
        source: 'Staff Console',
      })
    } catch (error) {
      console.warn('Could not send booking update email.', error)
    }
  }

  async function updateOperationSession(session: StaffOperationSession, patch: Partial<StaffOperationSession>) {
    if (!canCreateOrders) {
      setStatus(text.messages.readOnlyBooking)
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc('staff_update_session_operation', {
      p_session_id: session.id,
      p_name: patch.name ?? null,
      p_date: patch.date ?? null,
      p_start_time: patch.start_time ?? null,
      p_duration_minutes: patch.duration_minutes ?? null,
      p_max_players: patch.max_players ?? null,
      p_arena_count: patch.arena_count ?? null,
      p_visibility: patch.visibility ?? null,
      p_status: patch.status ?? null,
      p_confirmed_game_id: patch.confirmed_game_id ?? null,
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus(text.messages.operationSessionSaved)
    const linkedOrder = orders.find((order) => order.session_id === session.id) || null
    void sendStaffBookingUpdateNotification(session, linkedOrder, {
      action: patch.status === 'cancelled' ? 'cancelled' : 'edited',
      summary: patch.status === 'cancelled'
        ? 'Booking status was changed to cancelled.'
        : 'Booking details were edited.',
      changes: operationSessionChanges(session, patch),
    })
    await loadTodaySessions(true)
  }

  function openOperationDeleteDraft(session: StaffOperationSession, order: StaffOrder | null) {
    setOperationDeleteError('')
    setOperationDeleteDraft({ session, order })
  }

  function closeOperationDeleteDraft() {
    setOperationDeleteError('')
    setOperationDeleteDraft(null)
  }

  async function deleteOperationSession() {
    if (!operationDeleteDraft) return
    if (!canCreateOrders) {
      setStatus(text.messages.readOnlyBooking)
      return
    }

    const draft = operationDeleteDraft
    const deleteReason = 'Deleted from Staff Console'
    setSaving(true)
    setOperationDeleteError('')
    let deleteError = ''

    const { error: rpcError } = await supabase.rpc('staff_delete_session_operation', {
      p_session_id: draft.session.id,
      p_delete_reason: deleteReason,
    })

    if (rpcError) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) {
        deleteError = sessionError?.message || rpcError.message
      } else {
        try {
          const response = await fetch('/api/staff/operations/session/delete', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: draft.session.id,
              deleteReason,
            }),
          })
          const payload = await response.json().catch(() => ({})) as { error?: string }
          if (!response.ok) deleteError = payload.error || rpcError.message
        } catch (error) {
          deleteError = error instanceof Error ? error.message : rpcError.message
        }
      }
    }

    setSaving(false)

    if (deleteError) {
      setOperationDeleteError(deleteError)
      setStatus(deleteError)
      return
    }

    closeOperationDeleteDraft()
    setExpandedOperationSessions((current) => {
      const next = { ...current }
      delete next[draft.session.id]
      return next
    })
    setStatus(text.messages.operationSessionDeleted)
    void sendStaffBookingUpdateNotification(draft.session, draft.order, {
      action: 'deleted',
      summary: 'Booking was deleted from the Staff Console. Linked players were removed and any linked order was marked cancelled.',
    })
    await Promise.all([
      loadTodaySessions(true),
      loadTodayOrders(true),
    ])
  }

  async function updateOperationParticipant(session: StaffOperationSession, participant: StaffSessionParticipant, patch: Partial<StaffSessionParticipant>) {
    if (!canCreateOrders) {
      setStatus(text.messages.readOnlyBooking)
      return
    }

    const patchValue = <K extends keyof StaffSessionParticipant>(key: K) => (
      Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] ?? null : participant[key] ?? null
    )

    setSaving(true)
    const { error } = await supabase.rpc('staff_upsert_session_participant_operation', {
      p_session_id: session.id,
      p_participant_id: participant.id,
      p_profile_id: participant.profile_id,
      p_display_name: participant.display_name ?? null,
      p_checked_in: patch.checked_in ?? participant.checked_in ?? false,
      p_payment_status: patchValue('payment_status'),
      p_payment_amount: patchValue('payment_amount'),
      p_score: patchValue('score'),
      p_accuracy_percent: patchValue('accuracy_percent'),
      p_projectiles_fired: patchValue('projectiles_fired'),
      p_escape_duration_seconds: patchValue('escape_duration_seconds'),
      p_placement: patchValue('placement'),
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus(text.messages.operationParticipantSaved)
    await loadTodaySessions(true)
  }

  async function addOperationParticipant(session: StaffOperationSession) {
    const profileId = operationAddProfileBySession[session.id] || ''
    if (!profileId) return

    setSaving(true)
    const { error } = await supabase.rpc('staff_upsert_session_participant_operation', {
      p_session_id: session.id,
      p_profile_id: profileId,
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setOperationAddProfileBySession((current) => ({ ...current, [session.id]: '' }))
    setOperationAddProfileQueryBySession((current) => ({ ...current, [session.id]: '' }))
    setStatus(text.messages.operationParticipantAdded)
    await loadTodaySessions(true)
  }

  async function removeOperationParticipant(session: StaffOperationSession, participant: StaffSessionParticipant) {
    if (!window.confirm(text.actions.removePlayer)) return

    setSaving(true)
    const { error } = await supabase.rpc('staff_remove_session_participant_operation', {
      p_session_id: session.id,
      p_participant_id: participant.id,
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus(text.messages.operationParticipantRemoved)
    await loadTodaySessions(true)
  }

  async function updateOperationChapterTime(session: StaffOperationSession, participant: StaffSessionParticipant, gameSlug: string, chapterNumber: number, value: string) {
    const durationSeconds = parseStaffDuration(value)
    if (!durationSeconds) return

    setSaving(true)
    const { error } = await supabase.rpc('set_session_participant_chapter_time', {
      p_participant_id: participant.id,
      p_game_slug: gameSlug,
      p_chapter_number: chapterNumber,
      p_duration_seconds: durationSeconds,
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus(text.messages.operationParticipantSaved)
    await loadTodaySessions(true)
  }

  async function loadAttendanceData(force = false) {
    await runStaffLoader('attendance', async () => {
      const [weekStart, weekEnd] = currentTab === 'hr'
        ? orderedRange(payrollPeriodStart, payrollPeriodEnd)
        : [attendanceWeekStart, attendanceWeekEnd]
      const [shiftsResult, logsResult, leaveResult, settingsResult, employeeResult] = await Promise.all([
        supabase
          .from('staff_schedule_shifts')
          .select('*')
          .gte('shift_date', weekStart)
          .lte('shift_date', weekEnd)
          .is('deleted_at', null)
          .order('shift_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('staff_attendance_logs')
          .select('*')
          .gte('work_date', weekStart)
          .lte('work_date', weekEnd)
          .is('deleted_at', null)
          .order('work_date', { ascending: true })
          .order('clock_in_at', { ascending: true }),
        supabase
          .from('staff_leave_requests')
          .select('*')
          .gte('end_date', weekStart)
          .lte('start_date', weekEnd)
          .is('deleted_at', null)
          .order('start_date', { ascending: true }),
        supabase
          .from('staff_attendance_settings')
          .select('*')
          .eq('id', 'default')
          .maybeSingle(),
        supabase
          .from('staff_employee_profiles')
          .select('*')
          .is('deleted_at', null)
          .order('legal_name', { ascending: true }),
      ])

      if (shiftsResult.error) throw new Error(shiftsResult.error.message)
      if (logsResult.error) throw new Error(logsResult.error.message)
      if (leaveResult.error) throw new Error(leaveResult.error.message)
      const settingsUnavailable = Boolean(settingsResult.error && (
        settingsResult.error.code === '42501' ||
        settingsResult.error.message.toLowerCase().includes('permission denied') ||
        settingsResult.error.message.includes('staff_attendance_settings')
      ))
      if (settingsResult.error && !settingsUnavailable) throw new Error(settingsResult.error.message)
      const employeeUnavailable = Boolean(employeeResult.error && (
        employeeResult.error.code === '42P01' ||
        employeeResult.error.code === '42501' ||
        employeeResult.error.message.toLowerCase().includes('permission denied') ||
        employeeResult.error.message.includes('staff_employee_profiles')
      ))
      if (employeeResult.error && !employeeUnavailable) throw new Error(employeeResult.error.message)

      setAttendanceShifts((shiftsResult.data ?? []) as StaffScheduleShift[])
      setAttendanceLogs((logsResult.data ?? []) as StaffAttendanceLog[])
      setLeaveRequests((leaveResult.data ?? []) as StaffLeaveRequest[])
      setAttendanceSettings(settingsUnavailable ? defaultAttendanceSettings() : normalizeAttendanceSettings(settingsResult.data as Partial<StaffAttendanceSettings> | null))
      setEmployeeProfiles(employeeUnavailable ? [] : (employeeResult.data ?? []) as StaffEmployeeProfile[])
    }, force)
  }

  async function loadHrData(force = false) {
    await runStaffLoader('hr', async () => {
      const [settingsResult, optionsResult, adjustmentsResult, payrollRunsResult, payrollItemsResult, documentsResult] = await Promise.all([
        supabase
          .from('staff_hr_settings')
          .select('*')
          .eq('id', 'default')
          .maybeSingle(),
        supabase
          .from('staff_hr_setup_options')
          .select('*')
          .is('deleted_at', null)
          .order('option_type', { ascending: true })
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        supabase
          .from('staff_hr_adjustments')
          .select('*')
          .is('deleted_at', null)
          .order('effective_date', { ascending: false })
          .limit(500),
        supabase
          .from('staff_payroll_runs')
          .select('*')
          .is('deleted_at', null)
          .order('period_start', { ascending: false })
          .limit(50),
        supabase
          .from('staff_payroll_items')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('staff_hr_documents')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(500),
      ])

      const results = [settingsResult, optionsResult, adjustmentsResult, payrollRunsResult, payrollItemsResult, documentsResult]
      const blockingError = results.find((result) => result.error && !isStaffHrSchemaUnavailable(result.error))?.error
      if (blockingError) throw new Error(blockingError.message)

      const hrUnavailable = results.some((result) => result.error && isStaffHrSchemaUnavailable(result.error))
      if (hrUnavailable) {
        setHrSettings(defaultHrSettings())
        setHrSetupOptions([])
        setHrAdjustments([])
        setPayrollRuns([])
        setPayrollItems([])
        setHrDocuments([])
        return
      }

      setHrSettings(normalizeHrSettings(settingsResult.data as Partial<StaffHrSettings> | null))
      setHrSetupOptions((optionsResult.data ?? []) as StaffHrSetupOption[])
      setHrAdjustments((adjustmentsResult.data ?? []) as StaffHrAdjustment[])
      setPayrollRuns((payrollRunsResult.data ?? []) as StaffPayrollRun[])
      setPayrollItems((payrollItemsResult.data ?? []) as StaffPayrollItem[])
      setHrDocuments((documentsResult.data ?? []) as StaffHrDocument[])
    }, force)
  }

  async function loadRecentOrders(force = false) {
    await loadOrdersForRange('orders', addDays(todayString(), -30), addDays(todayString(), 30), force)
  }

  async function loadReportFallback() {
    const gamesResult = await supabase.from('staff_games').select('*').order('name', { ascending: true })
    if (gamesResult.error) throw new Error(gamesResult.error.message)
    const fallbackGames = (gamesResult.data ?? []) as StaffGame[]
    setGames(fallbackGames)
    loadedDataRef.current.games = true
    const fallbackGameNameById = new Map(fallbackGames.map((game) => [game.id, game.name]))
    const [reportFrom, reportTo] = orderedRange(reportStart, reportEnd)
    const [compareFrom, compareTo] = orderedRange(compareStart, compareEnd)
    const reportResult = await supabase
      .from('staff_orders')
      .select('*')
      .gte('booking_date', reportFrom)
      .lte('booking_date', reportTo)
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false })
      .limit(250)
    if (reportResult.error) throw new Error(reportResult.error.message)

    const comparisonResult = compareEnabled
      ? await supabase
        .from('staff_orders')
        .select('*')
        .gte('booking_date', compareFrom)
        .lte('booking_date', compareTo)
        .order('booking_date', { ascending: false })
        .order('booking_time', { ascending: false })
        .limit(250)
      : { data: [], error: null }
    if (comparisonResult.error) throw new Error(comparisonResult.error.message)

    const reportRows = (reportResult.data ?? []) as StaffOrder[]
    const comparisonRows = (comparisonResult.data ?? []) as StaffOrder[]
    const payments = await fetchOrderPayments([...reportRows, ...comparisonRows])
    const paymentsByOrder = paymentMapFromRows(payments)
    setReportSnapshot({
      report: buildStaffReport(reportRows, fallbackGameNameById, paymentsByOrder, text),
      comparisonReport: compareEnabled ? buildStaffReport(comparisonRows, fallbackGameNameById, paymentsByOrder, text) : emptyStaffReport(text),
      reportSeries: buildDailySeries(reportRows, reportFrom, reportTo),
      comparisonSeries: compareEnabled ? buildDailySeries(comparisonRows, compareFrom, compareTo) : [],
      orders: reportRows,
      comparisonOrders: comparisonRows,
      payments,
    })
  }

  async function loadReportData(force = false) {
    await runStaffLoader('report', async () => {
      const withComparisonOrders = async (snapshot: StaffReportSnapshot) => {
        if (!compareEnabled || snapshot.comparisonOrders.length > 0) return snapshot

        const [compareFrom, compareTo] = orderedRange(compareStart, compareEnd)
        const { data, error } = await supabase
          .from('staff_orders')
          .select('*')
          .gte('booking_date', compareFrom)
          .lte('booking_date', compareTo)
          .order('booking_date', { ascending: false })
          .order('booking_time', { ascending: false })
          .limit(500)

        if (error) return snapshot
        return { ...snapshot, comparisonOrders: (data ?? []) as StaffOrder[] }
      }

      const reportArgs = {
        p_start_date: reportStart,
        p_end_date: reportEnd,
        p_compare_start: compareEnabled ? compareStart : null,
        p_compare_end: compareEnabled ? compareEnd : null,
        p_order_limit: 500,
      }
      const { data, error } = await supabase.rpc('staff_report_summary', reportArgs)
      if (!error) {
        const snapshot = await withComparisonOrders(staffReportSnapshotFromRpc(data, text))
        setReportSnapshot(snapshot)
        return
      }

      if (!rpcFunctionMissing(error)) {
        await loadReportFallback()
        return
      }

      const legacyResult = await supabase.rpc('get_staff_daily_report', reportArgs)
      if (legacyResult.error) {
        await loadReportFallback()
        return
      }
      const snapshot = await withComparisonOrders(staffReportSnapshotFromRpc(legacyResult.data, text))
      setReportSnapshot(snapshot)
    }, force)
  }

  async function consumeStaffRateLimit(action: RateLimitAction, subject: string) {
    const rule = RATE_LIMITS[action]
    const { error } = await supabase.rpc('consume_rate_limit', {
      p_action: action,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_subject: subject || null,
    })

    if (error) {
      setStatus(error.message || text.messages.staffTooManyAttempts)
      return false
    }

    return true
  }

  function applyCustomer(profileId: string) {
    const selected = profiles.find((item) => item.id === profileId)
    setBooking((current) => ({
      ...current,
      customerId: profileId,
      customerName: selected ? customerName(selected, text) : current.customerName,
      customerPhone: selected?.phone || current.customerPhone,
      customerEmail: selected?.email || current.customerEmail,
    }))
  }

  function handleCustomerNameChange(value: string) {
    setBooking((current) => ({
      ...current,
      customerId: (() => {
        const selected = current.customerId ? profileById.get(current.customerId) : null
        return selected && customerName(selected, text) === value ? current.customerId : ''
      })(),
      customerName: value,
    }))
  }

  function selectCustomerSuggestion(profileId: string) {
    applyCustomer(profileId)
    setCustomerNameFocused(false)
  }

  async function createOrder() {
    if (!canCreateOrders || !selectedGame) return

    const allowed = await consumeStaffRateLimit('booking_attempt', `${booking.date}:${booking.time}:${selectedGame.id}`)
    if (!allowed) return

    setSaving(true)
    setStatus(text.messages.orderCreating)
    const hasManualDiscount = calculateManualDiscount(booking.manualDiscountType, booking.manualDiscountValue, quote.subtotal) > 0
    const paymentSplits = normalizePaymentSplits(booking.paymentSplits)
    const { data, error } = await supabase.rpc('create_staff_order_with_payments', {
      p_customer_id: booking.customerId || null,
      p_customer_name: booking.customerName || null,
      p_customer_phone: booking.customerPhone || null,
      p_customer_email: booking.customerEmail || null,
      p_game_id: selectedGame.id,
      p_booking_date: booking.date,
      p_booking_time: `${booking.time}:00`,
      p_players_count: booking.players,
      p_arena_id: booking.arenaId || null,
      p_discount_rule_id: hasManualDiscount ? null : selectedDiscount?.id || null,
      p_manual_discount_type: hasManualDiscount ? booking.manualDiscountType : null,
      p_manual_discount_value: hasManualDiscount ? booking.manualDiscountValue : 0,
      p_payment_splits: paymentSplits,
      p_order_status: booking.orderStatus,
      p_invoice_required: booking.invoiceRequired,
      p_company_name: booking.companyName || null,
      p_tax_code: booking.taxCode || null,
      p_invoice_email: booking.invoiceEmail || null,
      p_invoice_address: booking.invoiceAddress || null,
      p_internal_note: booking.note || null,
    })

    if (error) {
      setStatus(error.message)
      setSaving(false)
      return
    }

    const order = data as { order_number?: string; total?: number } | null
    setStatus(text.messages.orderConfirmed
      .replace('{order}', order?.order_number || '')
      .replace('{total}', formatVnd(order?.total || quote.total)))
    setBooking(defaultBookingForm())
    markStaffDataStale('today', 'orders', 'report')
    setSaving(false)
  }

  async function handleGameImageUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!canManageConfig) return

    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!staffGameImageTypes.includes(file.type)) {
      setStatus(text.messages.gamePhotoType)
      return
    }

    if (file.size > staffGameImageMaxBytes) {
      setStatus(text.messages.gamePhotoSmall)
      return
    }

    setGameImageUploading(true)
    setStatus(text.messages.uploadGamePhoto)
    const safeName = file.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const safeGame = slugify(gameForm.slug || gameForm.name || 'game')
    const path = `${profile?.id || 'staff'}/${safeGame}-${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from(staffGameImageBucket).upload(path, file, {
      contentType: file.type,
      upsert: true,
    })

    if (error) {
      setStatus(error.message)
      setGameImageUploading(false)
      return
    }

    const { data } = supabase.storage.from(staffGameImageBucket).getPublicUrl(path)
    setGameForm((current) => ({ ...current, image_url: data.publicUrl }))
    setStatus(text.messages.gamePhotoUploaded)
    setGameImageUploading(false)
  }

  async function saveGame() {
    if (!canManageConfig) return
    const allowed = await consumeStaffRateLimit('staff_config_write', `game:${gameForm.id || gameForm.slug || gameForm.name}`)
    if (!allowed) return
    setSaving(true)
    const audience = normalizeStaffAudience(gameForm.audience)
    const payload = {
      slug: gameForm.slug || slugify(gameForm.name),
      name: gameForm.name.trim(),
      game_type: gameForm.game_type,
      duration_minutes: Number(gameForm.duration_minutes),
      max_players_per_arena: Number(gameForm.max_players_per_arena),
      number_of_rounds: Number(gameForm.number_of_rounds),
      escape_chapter_count: gameForm.game_type === 'escape' ? Math.max(1, Math.min(50, Number(gameForm.escape_chapter_count) || 1)) : 1,
      description: gameForm.description.trim() || null,
      difficulty: audience.join(', ') || null,
      audience,
      guide_language: normalizeGuideLanguage(gameForm.guide_language),
      guide_summary: cleanGuideTextMap(gameForm.guide_summary),
      guide_rules: cleanGuideTextMap(gameForm.guide_rules),
      guide_tips: cleanGuideTextMap(gameForm.guide_tips),
      image_url: gameForm.image_url.trim() || null,
      active: gameForm.active,
      available_arena_ids: parseStaffArenaIds(gameForm.available_arena_ids),
      created_by: profile?.id || null,
    }
    const request = gameForm.id
      ? supabase.from('staff_games').update(payload).eq('id', gameForm.id)
      : supabase.from('staff_games').insert(payload)
    let { error } = await request
    if (error && isMissingStaffAudienceColumnError(error.message)) {
      const legacyPayload = { ...payload }
      delete (legacyPayload as Partial<typeof payload>).audience
      const legacyRequest = gameForm.id
        ? supabase.from('staff_games').update(legacyPayload).eq('id', gameForm.id)
        : supabase.from('staff_games').insert(legacyPayload)
      const legacyResult = await legacyRequest
      error = legacyResult.error
    }
    setStatus(error ? error.message : text.messages.gameSaved)
    if (!error) setGameForm(defaultGameForm())
    if (!error) {
      markStaffDataStale('games', 'report')
      await loadGames(true)
    }
    setSaving(false)
  }

  async function savePrice() {
    if (!canManageConfig) return
    const allowed = await consumeStaffRateLimit('staff_config_write', `price:${priceForm.id || priceForm.rule_name}`)
    if (!allowed) return
    setSaving(true)
    const payload = {
      rule_name: priceForm.rule_name.trim(),
      game_id: priceForm.game_id || null,
      day_type: priceForm.day_type,
      time_start: priceForm.time_start || null,
      time_end: priceForm.time_end || null,
      price_per_player: parseDong(priceForm.price_per_player),
      price_per_arena_slot: parseDong(priceForm.price_per_arena_slot) > 0 ? parseDong(priceForm.price_per_arena_slot) : null,
      valid_from: priceForm.valid_from,
      valid_until: priceForm.valid_until || null,
      active: priceForm.active,
      created_by: profile?.id || null,
    }
    const request = priceForm.id
      ? supabase.from('staff_pricing_rules').update(payload).eq('id', priceForm.id)
      : supabase.from('staff_pricing_rules').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.priceRuleSaved)
    if (!error) setPriceForm(defaultPriceForm())
    if (!error) {
      markStaffDataStale('prices')
      await loadPrices(true)
    }
    setSaving(false)
  }

  async function saveDiscount() {
    if (!canCreateOrders) return
    if (commerceTab === 'vouchers' && !discountForm.code.trim()) {
      setStatus(text.messages.voucherCodeRequired)
      return
    }
    const allowed = await consumeStaffRateLimit('staff_config_write', `discount:${discountForm.id || discountForm.code || discountForm.name}`)
    if (!allowed) return
    setSaving(true)
    const isVoucher = Boolean(discountForm.code.trim())
    const payload = {
      code: discountForm.code.trim() || null,
      name: discountForm.name.trim(),
      game_id: discountForm.game_id || null,
      price_rule_id: discountForm.price_rule_id || null,
      min_players: discountForm.min_players ? Number(discountForm.min_players) : null,
      max_players: discountForm.max_players ? Number(discountForm.max_players) : null,
      day_scope: discountForm.day_scope,
      time_start: discountForm.time_start || null,
      time_end: discountForm.time_end || null,
      ticket_type: discountForm.ticket_type,
      min_order_total: Number(discountForm.min_order_total) || 0,
      max_discount_amount: discountForm.max_discount_amount ? Number(discountForm.max_discount_amount) : null,
      per_customer_limit: discountForm.per_customer_limit ? Number(discountForm.per_customer_limit) : null,
      discount_type: discountForm.discount_type,
      value: Number(discountForm.value) || 0,
      valid_from: discountForm.valid_from,
      valid_until: discountForm.valid_until || null,
      max_uses: discountForm.max_uses ? Number(discountForm.max_uses) : null,
      active: discountForm.active,
      created_by: profile?.id || null,
    }
    const request = discountForm.id
      ? supabase.from('staff_discount_rules').update(payload).eq('id', discountForm.id)
      : supabase.from('staff_discount_rules').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : isVoucher ? text.messages.voucherSaved : text.messages.discountSaved)
    if (!error) setDiscountForm(defaultDiscountForm())
    if (!error) {
      markStaffDataStale('discounts')
      await loadDiscounts(true)
    }
    setSaving(false)
  }

  function updateDiscountType(nextType: StaffDiscount['discount_type']) {
    setDiscountForm((current) => ({
      ...current,
      discount_type: nextType,
      value: nextType === 'free_ticket'
        ? 0
        : discountValueUnit(nextType) === 'percentage'
          ? parsePercentInput(current.value)
          : Number(current.value) || 0,
    }))
  }

  function updateDiscountValueUnit(unit: StaffDiscountValueUnit) {
    setDiscountForm((current) => ({
      ...current,
      discount_type: unit,
      value: unit === 'percentage'
        ? parsePercentInput(current.value)
        : Number(current.value) || 0,
    }))
  }

  function updateDiscountValue(value: string) {
    setDiscountForm((current) => ({
      ...current,
      value: discountValueUnit(current.discount_type) === 'fixed_amount'
        ? parseDong(value)
        : parsePercentInput(value),
    }))
  }

  async function saveLoyaltyRule() {
    if (!canManageConfig) return
    const payload = {
      rule_name: loyaltyForm.rule_name.trim(),
      game_id: loyaltyForm.game_id || null,
      calculation_type: loyaltyForm.calculation_type,
      points_value: Number(loyaltyForm.points_value) || 0,
      spend_amount: Number(loyaltyForm.spend_amount) || 0,
      min_order_total: Number(loyaltyForm.min_order_total) || 0,
      redeem_value_vnd_per_point: Number(loyaltyForm.redeem_value_vnd_per_point) || 0,
      earn_trigger: loyaltyForm.earn_trigger,
      rounding_rule: loyaltyForm.rounding_rule,
      point_expiry_days: loyaltyForm.point_expiry_days ? Number(loyaltyForm.point_expiry_days) : null,
      valid_from: loyaltyForm.valid_from,
      valid_until: loyaltyForm.valid_until || null,
      active: loyaltyForm.active,
      notes: loyaltyForm.notes.trim() || null,
      created_by: profile?.id || null,
    }

    const activeRulesToDeactivate = payload.active
      ? loyaltyRules.filter((rule) => rule.active && rule.id !== loyaltyForm.id)
      : []

    if (activeRulesToDeactivate.length > 0) {
      const ruleNames = activeRulesToDeactivate.map((rule) => rule.rule_name).join(', ')
      const confirmed = window.confirm(text.messages.loyaltySingleActiveConfirm.replace('{rule}', ruleNames))
      if (!confirmed) return
    }

    const allowed = await consumeStaffRateLimit('staff_config_write', `loyalty:${loyaltyForm.id || loyaltyForm.rule_name}`)
    if (!allowed) return

    setSaving(true)
    const request = loyaltyForm.id
      ? supabase.from('staff_loyalty_rules').update(payload).eq('id', loyaltyForm.id)
      : supabase.from('staff_loyalty_rules').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.loyaltyRuleSaved)
    if (!error) setLoyaltyForm(defaultLoyaltyForm())
    if (!error) {
      markStaffDataStale('loyalty')
      await loadLoyaltyRules(true)
    }
    setSaving(false)
  }

  async function saveShift() {
    if (!canManageAttendance) return
    const staffProfileId = shiftForm.staff_profile_id || firstStaffProfileId
    if (!staffProfileId) return
    if (!shiftForm.id && employeeProfileById.get(staffProfileId)?.active === false) {
      setStatus(text.messages.inactiveEmployeePlanningBlocked)
      return
    }
    setSaving(true)
    const payload = {
      staff_profile_id: staffProfileId,
      location: shiftForm.location.trim() || attendanceSettings.location || 'VRena',
      shift_role: 'Staff',
      shift_date: shiftForm.shift_date,
      start_time: normalizeTime(shiftForm.start_time) || '09:00',
      end_time: normalizeTime(shiftForm.end_time) || '18:00',
      break_minutes: Number(shiftForm.break_minutes) || 0,
      status: shiftForm.status,
      notes: shiftForm.notes.trim() || null,
      created_by: profile?.id || null,
    }
    const request = shiftForm.id
      ? supabase.from('staff_schedule_shifts').update(payload).eq('id', shiftForm.id)
      : supabase.from('staff_schedule_shifts').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.shiftSaved)
    if (!error) {
      setShiftForm({ ...defaultShiftForm(attendanceSettings), staff_profile_id: payload.staff_profile_id, location: payload.location })
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function editShift(shift: StaffScheduleShift) {
    setShiftForm({
      id: shift.id,
      staff_profile_id: shift.staff_profile_id,
      location: shift.location,
      shift_role: 'Staff',
      shift_date: shift.shift_date,
      start_time: normalizeTime(shift.start_time),
      end_time: normalizeTime(shift.end_time),
      break_minutes: String(shift.break_minutes),
      status: shift.status,
      notes: shift.notes || '',
    })
    setAttendanceTab('schedule')
  }

  async function updateShiftStatus(shift: StaffScheduleShift, status: StaffShiftStatus) {
    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase.from('staff_schedule_shifts').update({ status }).eq('id', shift.id)
    setStatus(error ? error.message : text.messages.shiftSaved)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function applyShiftTemplate(templateId: StaffShiftTemplateId) {
    const template = effectiveShiftTemplates.find((item) => item.id === templateId) || effectiveShiftTemplates[0] || defaultStaffShiftTemplates[0]
    setSelectedShiftTemplate(template.id)
    setShiftForm((current) => ({
      ...current,
      start_time: template.start_time,
      end_time: template.end_time,
      break_minutes: template.break_minutes,
    }))
  }

  function updateAttendanceShiftTemplate(templateId: StaffShiftTemplateId, patch: Partial<Omit<StaffShiftTemplate, 'id'>>) {
    setAttendanceSettings((current) => {
      const templates = normalizeStaffShiftTemplates(current.shift_templates, current.standard_break_minutes)
      return {
        ...current,
        shift_templates: templates.map((template) => (
          template.id === templateId ? { ...template, ...patch } : template
        )),
      }
    })
  }

  async function startShiftForCell(staffProfileId: string, shiftDate: string) {
    if (!canManageAttendance || saving) return
    if (employeeProfileById.get(staffProfileId)?.active === false) {
      setStatus(text.messages.inactiveEmployeePlanningBlocked)
      return
    }
    const template = effectiveShiftTemplates.find((item) => item.id === selectedShiftTemplate) || effectiveShiftTemplates[0] || defaultStaffShiftTemplates[0]
    const payload = {
      staff_profile_id: staffProfileId,
      location: attendanceSettings.location || 'VRena',
      shift_role: 'Staff',
      shift_date: shiftDate,
      start_time: normalizeTime(template.start_time) || '09:00',
      end_time: normalizeTime(template.end_time) || '18:00',
      break_minutes: Number(template.break_minutes) || 0,
      status: 'draft' as StaffShiftStatus,
      notes: null as string | null,
      created_by: profile?.id || null,
    }

    setShiftForm({
      ...defaultShiftForm(attendanceSettings),
      ...payload,
      break_minutes: String(payload.break_minutes),
      notes: '',
    })
    setAttendanceTab('schedule')

    const duplicate = attendanceShifts.some((shift) => (
      shift.staff_profile_id === staffProfileId &&
      shift.shift_date === shiftDate &&
      normalizeTime(shift.start_time) === payload.start_time &&
      normalizeTime(shift.end_time) === payload.end_time &&
      shift.status !== 'cancelled'
    ))
    if (duplicate) {
      setStatus(text.messages.draftShiftExists)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('staff_schedule_shifts').insert(payload)
    setStatus(error ? error.message : text.messages.draftShiftCreated)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function employeeFormForProfile(staffProfile: StaffProfile, employee?: StaffEmployeeProfile) {
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
      start_date: employee?.start_date || '',
      end_date: employee?.end_date || '',
      base_salary_vnd: employee?.base_salary_vnd ? String(employee.base_salary_vnd) : '',
      hourly_rate_vnd: employee?.hourly_rate_vnd ? String(employee.hourly_rate_vnd) : '',
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
      emergency_contact: employee?.emergency_contact || '',
      payroll_note: employee?.payroll_note || '',
      profile_photo_path: employee?.profile_photo_path || '',
      cv_document_path: employee?.cv_document_path || '',
      active: employee?.active ?? true,
    }
  }

  function editEmployeeProfile(staffProfile: StaffProfile) {
    setEmployeeForm(employeeFormForProfile(staffProfile, employeeProfileById.get(staffProfile.id)))
    setHrTab('employees')
    setActiveTab('hr')
  }

  async function saveEmployeeProfile() {
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
      main_work_location: employeeForm.main_work_location.trim() || null,
      payroll_location: employeeForm.payroll_location.trim() || null,
      contract_status: normalizeStaffContractStatus(employeeForm.contract_status),
      contract_type: employeeForm.contract_type.trim() || null,
      contract_start_date: employeeForm.contract_start_date || null,
      contract_end_date: employeeForm.contract_end_date || null,
      start_date: employeeForm.start_date || null,
      end_date: employeeForm.end_date || null,
      base_salary_vnd: parseDong(employeeForm.base_salary_vnd),
      hourly_rate_vnd: parseDong(employeeForm.hourly_rate_vnd),
      lunch_allowance_vnd: parseDong(employeeForm.lunch_allowance_vnd),
      rest_period_minutes: employeeForm.rest_period_hours ? Math.round(decimalInput(employeeForm.rest_period_hours) * 60) : null,
      overtime_rate_multiplier: employeeForm.overtime_rate_multiplier ? decimalInput(employeeForm.overtime_rate_multiplier) : null,
      night_rate_multiplier: employeeForm.night_rate_multiplier ? decimalInput(employeeForm.night_rate_multiplier) : null,
      holiday_rate_multiplier: employeeForm.holiday_rate_multiplier ? decimalInput(employeeForm.holiday_rate_multiplier) : null,
      employee_contribution_rate: employeeForm.employee_contribution_rate ? decimalInput(employeeForm.employee_contribution_rate) : null,
      employer_contribution_rate: employeeForm.employer_contribution_rate ? decimalInput(employeeForm.employer_contribution_rate) : null,
      pit_withholding_rate: employeeForm.pit_withholding_rate ? decimalInput(employeeForm.pit_withholding_rate) : null,
      dependents_count: Math.max(0, Math.round(Number(employeeForm.dependents_count) || 0)),
      bank_name: employeeForm.bank_name.trim() || null,
      bank_account_number: employeeForm.bank_account_number.trim() || null,
      tax_code: employeeForm.tax_code.trim() || null,
      social_insurance_number: employeeForm.social_insurance_number.trim() || null,
      emergency_contact: employeeForm.emergency_contact.trim() || null,
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

  async function saveHrSettings() {
    if (!canManageAttendance) return
    setSaving(true)
    const payload = {
      id: 'default',
      currency: hrSettings.currency.trim() || 'VND',
      standard_monthly_days: Math.max(1, Number(hrSettings.standard_monthly_days) || 26),
      standard_monthly_hours: Math.max(1, Number(hrSettings.standard_monthly_hours) || 208),
      rest_period_minutes: Math.max(0, Number(hrSettings.rest_period_minutes) || 0),
      normal_overtime_multiplier: Math.max(0, Number(hrSettings.normal_overtime_multiplier) || 0),
      night_overtime_multiplier: Math.max(0, Number(hrSettings.night_overtime_multiplier) || 0),
      holiday_overtime_multiplier: Math.max(0, Number(hrSettings.holiday_overtime_multiplier) || 0),
      lunch_allowance_vnd: Math.max(0, Number(hrSettings.lunch_allowance_vnd) || 0),
      annual_leave_days: Math.max(0, Number(hrSettings.annual_leave_days) || 0),
      employee_contribution_rate: Math.max(0, Number(hrSettings.employee_contribution_rate) || 0),
      employer_contribution_rate: Math.max(0, Number(hrSettings.employer_contribution_rate) || 0),
      pit_withholding_rate: Math.max(0, Number(hrSettings.pit_withholding_rate) || 0),
      payslip_note: hrSettings.payslip_note?.trim() || null,
      updated_by: profile?.id || null,
    }
    const { error } = await supabase.from('staff_hr_settings').upsert(payload, { onConflict: 'id' })
    setStatus(error ? error.message : text.messages.hrSettingsSaved)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function saveHrSetupOption(optionType: StaffHrSetupOptionType) {
    if (!canManageAttendance) return
    const name = hrSetupForm[optionType].trim()
    if (!name) return
    setSaving(true)
    const { error } = await supabase.from('staff_hr_setup_options').insert({
      option_type: optionType,
      name,
      sort_order: (hrSetupOptions.filter((item) => item.option_type === optionType).length + 1) * 10,
      created_by: profile?.id || null,
    })
    setStatus(error ? error.message : text.messages.hrSetupOptionSaved)
    if (!error) {
      setHrSetupForm((current) => ({ ...current, [optionType]: '' }))
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function saveHrAdjustment(kind: 'adjustment' | 'advance' = 'adjustment') {
    if (!canManageAttendance) return
    const profileId = hrAdjustmentForm.profile_id || selectedEmployeeStaffId || firstEmployeeStaffProfileId
    if (!profileId) return
    const adjustmentType = kind === 'advance' && !['advance', 'debt', 'debt_repayment'].includes(hrAdjustmentForm.adjustment_type)
      ? 'advance'
      : normalizeHrAdjustmentType(hrAdjustmentForm.adjustment_type)
    const payload = {
      profile_id: profileId,
      adjustment_type: adjustmentType,
      title: hrAdjustmentForm.title.trim() || text.adjustmentTypes[adjustmentType],
      amount_vnd: parseDong(hrAdjustmentForm.amount_vnd),
      effective_date: hrAdjustmentForm.effective_date || todayString(),
      period_start: hrAdjustmentForm.period_start || null,
      period_end: hrAdjustmentForm.period_end || null,
      status: normalizeHrAdjustmentStatus(hrAdjustmentForm.status),
      notes: hrAdjustmentForm.notes.trim() || null,
      created_by: profile?.id || null,
    }
    setSaving(true)
    const query = hrAdjustmentForm.id
      ? supabase.from('staff_hr_adjustments').update(payload).eq('id', hrAdjustmentForm.id)
      : supabase.from('staff_hr_adjustments').insert(payload)
    const { error } = await query
    setStatus(error ? error.message : text.messages.adjustmentSaved)
    if (!error) {
      setHrAdjustmentForm(defaultHrAdjustmentForm(profileId, kind === 'advance' ? 'advance' : 'bonus'))
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function updateHrAdjustmentStatus(adjustment: StaffHrAdjustment, statusValue: StaffHrAdjustmentStatus) {
    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase
      .from('staff_hr_adjustments')
      .update({
        status: statusValue,
        validated_by: ['approved', 'rejected'].includes(statusValue) ? profile?.id || null : adjustment.validated_by,
        validated_at: ['approved', 'rejected'].includes(statusValue) ? new Date().toISOString() : adjustment.validated_at,
      })
      .eq('id', adjustment.id)
    setStatus(error ? error.message : statusValue === 'approved' ? text.messages.adjustmentApproved : text.messages.adjustmentSaved)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function generatePayrollRun() {
    if (!canManageAttendance) return
    const [periodStart, periodEnd] = orderedRange(payrollRunForm.period_start, payrollRunForm.period_end)
    const calculations = visibleStaffProfileOptions.map((staffProfile) => staffPayrollCalculations.get(staffProfile.id) || emptyStaffPayrollCalculation(staffProfile.id))
    const totals = calculations.reduce((sum, item) => ({
      gross: sum.gross + item.grossIncome,
      net: sum.net + item.netIncome,
      companyCost: sum.companyCost + item.companyCost,
    }), { gross: 0, net: 0, companyCost: 0 })

    setSaving(true)
    const { data: runData, error: runError } = await supabase
      .from('staff_payroll_runs')
      .upsert({
        code: payrollRunForm.code.trim() || `PAY-${periodStart.replace(/-/g, '')}`,
        name: payrollRunForm.name.trim() || `${text.labels.payrollRun} ${rangeLabel(periodStart, periodEnd)}`,
        pay_cycle: normalizePayrollPayCycle(payrollRunForm.pay_cycle),
        period_start: periodStart,
        period_end: periodEnd,
        status: 'draft',
        total_gross_vnd: totals.gross,
        total_net_vnd: totals.net,
        total_company_cost_vnd: totals.companyCost,
        generated_by: profile?.id || null,
        notes: payrollRunForm.notes.trim() || null,
      }, { onConflict: 'code' })
      .select('*')
      .single()

    if (runError || !runData) {
      setStatus(runError?.message || text.messages.hrSetupUnavailable)
      setSaving(false)
      return
    }

    const run = runData as StaffPayrollRun
    const rows = calculations.map((item) => {
      const employee = employeeProfileById.get(item.profileId)
      const staffProfile = profileById.get(item.profileId)
      const payslipNumber = `${run.code}-${employee?.employee_code || item.profileId.slice(0, 6)}`
      return {
        payroll_run_id: run.id,
        profile_id: item.profileId,
        payslip_number: payslipNumber,
        worked_minutes: item.workedMinutes,
        regular_minutes: item.regularMinutes,
        overtime_minutes: item.overtimeMinutes,
        night_minutes: item.nightMinutes,
        holiday_minutes: item.holidayMinutes,
        paid_leave_hours: item.paidLeaveHours,
        rest_warning_count: item.restWarningCount,
        base_salary_vnd: item.basePay,
        overtime_pay_vnd: item.overtimePay,
        allowances_vnd: item.allowances,
        bonuses_vnd: item.bonuses,
        advances_vnd: item.advances,
        deductions_vnd: item.deductions,
        employee_contributions_vnd: item.employeeContributions,
        employer_contributions_vnd: item.employerContributions,
        pit_withholding_vnd: item.pitWithheld,
        gross_income_vnd: item.grossIncome,
        net_income_vnd: item.netIncome,
        company_cost_vnd: item.companyCost,
        status: 'draft',
        payslip_snapshot: {
          employeeCode: employee?.employee_code || null,
          employeeName: employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : ''),
          periodStart,
          periodEnd,
          currency: hrSettings.currency,
          note: hrSettings.payslip_note || null,
        },
      }
    })
    const { error: itemError } = await supabase
      .from('staff_payroll_items')
      .upsert(rows, { onConflict: 'payroll_run_id,profile_id' })

    setStatus(itemError ? itemError.message : text.messages.payrollGenerated)
    if (!itemError) {
      setPayrollRunForm({ ...payrollRunForm, id: run.id })
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function approvePayrollRun(run: StaffPayrollRun) {
    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase
      .from('staff_payroll_runs')
      .update({ status: 'approved', approved_by: profile?.id || null, approved_at: new Date().toISOString() })
      .eq('id', run.id)
    setStatus(error ? error.message : text.messages.payrollApproved)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function handleHrDocumentUpload(event: ChangeEvent<HTMLInputElement>, documentType: Extract<StaffHrDocumentType, 'profile_photo' | 'cv'>) {
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

  async function downloadEmployeePayslip(staffProfileId = selectedEmployeeStaffId) {
    const staffProfile = profileById.get(staffProfileId)
    const employee = employeeProfileById.get(staffProfileId)
    const calculation = staffPayrollCalculations.get(staffProfileId) || emptyStaffPayrollCalculation(staffProfileId)
    const displayName = employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : text.customerFallback)
    const lines = [
      'PHIEU LUONG / PAYSLIP',
      `Company: VRena`,
      `Payroll period: ${staffDateLabel(payrollPeriodStart)} - ${staffDateLabel(payrollPeriodEnd)}`,
      `Employee: ${displayName}`,
      `Employee code: ${employee?.employee_code || '-'}`,
      `Attendance number: ${employee?.attendance_number || '-'}`,
      `Workplace: ${employee?.main_work_location || attendanceSettings.location}`,
      `Contract: ${employee?.contract_type || '-'} / ${text.contractStatuses[normalizeStaffContractStatus(employee?.contract_status)]}`,
      '',
      `${text.labels.workedHours}: ${hoursLabel(calculation.workedMinutes)}`,
      `${text.labels.overtimeHours}: ${hoursLabel(calculation.overtimeMinutes)}`,
      `${text.labels.leaveBalance}: ${Number(calculation.leaveBalanceDays.toFixed(2))} ${text.days}`,
      '',
      `${text.labels.baseSalary}: ${formatVnd(calculation.basePay)}`,
      `${text.labels.overtimePay}: ${formatVnd(calculation.overtimePay)}`,
      `${text.labels.allowances}: ${formatVnd(calculation.allowances)}`,
      `${text.labels.bonuses}: ${formatVnd(calculation.bonuses)}`,
      `${text.labels.grossIncome}: ${formatVnd(calculation.grossIncome)}`,
      `${text.labels.employeeContributions}: ${formatVnd(calculation.employeeContributions)}`,
      `${text.labels.pitWithheld}: ${formatVnd(calculation.pitWithheld)}`,
      `${text.labels.advances}: ${formatVnd(calculation.advances)}`,
      `${text.labels.deductions}: ${formatVnd(calculation.deductions)}`,
      `${text.labels.netIncome}: ${formatVnd(calculation.netIncome)}`,
      `${text.labels.companyCost}: ${formatVnd(calculation.companyCost)}`,
      '',
      hrSettings.payslip_note || '',
    ].filter((line) => line !== '')
    await downloadPdf(`payslip-${employee?.employee_code || staffProfileId.slice(0, 8)}-${payrollPeriodStart}.pdf`, lines, text)
  }

  function setAttendanceRange(start: string, end: string) {
    const [nextStart, nextEnd] = attendanceDateRange(start, end)
    markStaffDataStale('attendance')
    setAttendanceRangeStart(nextStart)
    setAttendanceRangeEnd(nextEnd)
  }

  function shiftAttendanceRange(dayOffset: number) {
    setAttendanceRange(addDays(attendanceWeekStart, dayOffset), addDays(attendanceWeekEnd, dayOffset))
  }

  function resetAttendanceRangeToThisWeek() {
    const [start, end] = attendanceWeekRange(todayString())
    setAttendanceRange(start, end)
  }

  async function copyPreviousAttendanceWeek() {
    if (!canManageAttendance) return
    setSaving(true)
    const rangeDays = attendanceRangeLength(attendanceWeekStart, attendanceWeekEnd)
    const previousStart = addDays(attendanceWeekStart, -rangeDays)
    const previousEnd = addDays(attendanceWeekEnd, -rangeDays)
    const { data, error } = await supabase
      .from('staff_schedule_shifts')
      .select('*')
      .gte('shift_date', previousStart)
      .lte('shift_date', previousEnd)
      .is('deleted_at', null)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      setStatus(error.message)
      setSaving(false)
      return
    }

    const previousShifts = (data ?? []) as StaffScheduleShift[]
    if (previousShifts.length === 0) {
      setStatus(text.messages.previousWeekEmpty)
      setSaving(false)
      return
    }

    const existingKeys = new Set(attendanceShifts.map((shift) => (
      `${shift.staff_profile_id}:${shift.shift_date}:${normalizeTime(shift.start_time)}:${normalizeTime(shift.end_time)}`
    )))
    const rows = previousShifts.flatMap((shift) => {
      const nextDate = addDays(shift.shift_date, rangeDays)
      const key = `${shift.staff_profile_id}:${nextDate}:${normalizeTime(shift.start_time)}:${normalizeTime(shift.end_time)}`
      if (existingKeys.has(key)) return []
      return [{
        staff_profile_id: shift.staff_profile_id,
        location: shift.location || attendanceSettings.location || 'VRena',
        shift_role: 'Staff',
        shift_date: nextDate,
        start_time: normalizeTime(shift.start_time) || '09:00',
        end_time: normalizeTime(shift.end_time) || '18:00',
        break_minutes: shift.break_minutes || 0,
        status: 'draft' as StaffShiftStatus,
        notes: shift.notes,
        created_by: profile?.id || null,
      }]
    })

    if (rows.length === 0) {
      setStatus(text.messages.previousWeekNoNew)
      setSaving(false)
      return
    }

    const insertResult = await supabase.from('staff_schedule_shifts').insert(rows)
    setStatus(insertResult.error ? insertResult.error.message : text.messages.previousWeekCopied)
    if (!insertResult.error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function publishAttendanceWeek() {
    if (!canManageAttendance) return
    const draftIds = attendanceShifts.filter((shift) => shift.status === 'draft').map((shift) => shift.id)
    if (draftIds.length === 0) return
    setSaving(true)
    const { error } = await supabase
      .from('staff_schedule_shifts')
      .update({ status: 'published' })
      .in('id', draftIds)
    setStatus(error ? error.message : text.messages.weekPublished)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function moveShiftToCell(shift: StaffScheduleShift, staffProfileId: string, shiftDate: string) {
    if (!canManageAttendance) return
    if (shift.staff_profile_id === staffProfileId && shift.shift_date === shiftDate) return
    if (employeeProfileById.get(staffProfileId)?.active === false) {
      setStatus(text.messages.inactiveEmployeePlanningBlocked)
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('staff_schedule_shifts')
      .update({ staff_profile_id: staffProfileId, shift_date: shiftDate })
      .eq('id', shift.id)
    setStatus(error ? error.message : text.messages.shiftSaved)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function saveAttendanceLog() {
    if (!canEditAttendance) return
    setSaving(true)
    const clockIn = attendanceLogForm.clock_in_time ? localDateTimeIso(attendanceLogForm.work_date, attendanceLogForm.clock_in_time) : null
    const clockOut = attendanceLogForm.clock_out_time ? localDateTimeIso(attendanceLogForm.work_date, attendanceLogForm.clock_out_time) : null
    const payload = {
      staff_profile_id: attendanceLogForm.staff_profile_id || firstStaffProfileId,
      shift_id: attendanceLogForm.shift_id || null,
      work_date: attendanceLogForm.work_date,
      clock_in_at: clockIn,
      clock_out_at: clockOut,
      break_minutes: Number(attendanceLogForm.break_minutes) || 0,
      status: attendanceLogForm.status,
      regular_minutes: Math.round((Number(attendanceLogForm.regular_minutes) || 0) * 60),
      overtime_minutes: Math.round((Number(attendanceLogForm.overtime_minutes) || 0) * 60),
      night_minutes: Math.round((Number(attendanceLogForm.night_minutes) || 0) * 60),
      holiday_minutes: Math.round((Number(attendanceLogForm.holiday_minutes) || 0) * 60),
      manager_note: attendanceLogForm.manager_note.trim() || null,
      created_by: profile?.id || null,
    }
    const request = attendanceLogForm.id
      ? supabase.from('staff_attendance_logs').update(payload).eq('id', attendanceLogForm.id)
      : supabase.from('staff_attendance_logs').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.attendanceSaved)
    if (!error) {
      setAttendanceLogForm({ ...defaultAttendanceLogForm(), staff_profile_id: payload.staff_profile_id })
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function editAttendanceLog(log: StaffAttendanceLog) {
    setAttendanceLogForm({
      id: log.id,
      staff_profile_id: log.staff_profile_id,
      shift_id: log.shift_id || '',
      work_date: log.work_date,
      clock_in_time: timeValueFromIso(log.clock_in_at),
      clock_out_time: timeValueFromIso(log.clock_out_at),
      break_minutes: String(log.break_minutes),
      status: log.status,
      regular_minutes: String(log.regular_minutes / 60),
      overtime_minutes: String(log.overtime_minutes / 60),
      night_minutes: String(log.night_minutes / 60),
      holiday_minutes: String(log.holiday_minutes / 60),
      manager_note: log.manager_note || '',
    })
    setAttendanceTab('clock')
  }

  async function submitLeaveRequest() {
    if (!canEditAttendance) return
    setSaving(true)
    const payload = {
      staff_profile_id: leaveForm.staff_profile_id || firstStaffProfileId,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      hours: Number(leaveForm.hours) || 0,
      reason: leaveForm.reason.trim() || null,
      requested_by: profile?.id || null,
    }
    const request = leaveForm.id
      ? supabase.from('staff_leave_requests').update(payload).eq('id', leaveForm.id)
      : supabase.from('staff_leave_requests').insert(payload)
    const { error } = await request
    setStatus(error ? error.message : text.messages.leaveSaved)
    if (!error) {
      setLeaveForm({ ...defaultLeaveForm(), staff_profile_id: payload.staff_profile_id })
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  function editLeaveRequest(request: StaffLeaveRequest) {
    setLeaveForm({
      id: request.id,
      staff_profile_id: request.staff_profile_id,
      leave_type: request.leave_type,
      start_date: request.start_date,
      end_date: request.end_date,
      hours: String(request.hours),
      reason: request.reason || '',
    })
    setAttendanceTab('leave')
  }

  async function updateLeaveStatus(request: StaffLeaveRequest, status: StaffLeaveStatus) {
    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase
      .from('staff_leave_requests')
      .update({
        status,
        reviewed_by: profile?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id)
    setStatus(error ? error.message : text.messages.leaveUpdated)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function saveAttendanceSettings() {
    if (!canManageAttendance) return
    setSaving(true)
    const standardBreakMinutes = minutesSetting(attendanceSettings.standard_break_minutes, 60)
    const shiftTemplates = normalizeStaffShiftTemplates(attendanceSettings.shift_templates, standardBreakMinutes)
    const payload = {
      id: 'default',
      location: attendanceSettings.location.trim() || 'VRena',
      standard_daily_minutes: minutesSetting(attendanceSettings.standard_daily_minutes, 480),
      standard_weekly_minutes: minutesSetting(attendanceSettings.standard_weekly_minutes, 2880),
      standard_break_minutes: standardBreakMinutes,
      overtime_monthly_cap_minutes: minutesSetting(attendanceSettings.overtime_monthly_cap_minutes, 2400),
      overtime_yearly_cap_minutes: minutesSetting(attendanceSettings.overtime_yearly_cap_minutes, 12000),
      night_start: normalizeTime(attendanceSettings.night_start) || '22:00',
      night_end: normalizeTime(attendanceSettings.night_end) || '06:00',
      annual_leave_days: attendanceSettings.annual_leave_days,
      shift_templates: shiftTemplates,
      updated_by: profile?.id || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('staff_attendance_settings').upsert(payload, { onConflict: 'id' })
    setStatus(error ? error.message : text.messages.attendanceRulesSaved)
    if (!error) {
      setAttendanceSettings(normalizeAttendanceSettings(payload))
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function updateOrder(order: StaffOrder, patch: Partial<StaffOrder>) {
    if (!canCreateOrders) return
    if (patch.order_status && ['cancelled', 'refunded', 'no_show'].includes(patch.order_status)) {
      const allowed = await consumeStaffRateLimit('admin_destructive', `staff-order:${order.id}:${patch.order_status}`)
      if (!allowed) return
    }
    setSaving(true)
    const { error } = await supabase.from('staff_orders').update(patch).eq('id', order.id)
    setStatus(error ? error.message : text.messages.orderUpdated)
    if (!error) {
      setOrders((items) => items.map((item) => item.id === order.id ? { ...item, ...patch } : item))
      const linkedSession = operationSessions.find((session) => session.id === order.session_id) || null
      const updatedOrder = { ...order, ...patch }
      void sendStaffBookingUpdateNotification(linkedSession, updatedOrder, {
        action: patch.order_status === 'cancelled' ? 'cancelled' : 'edited',
        title: linkedSession?.name || 'Ticket booking',
        reference: order.order_number,
        date: order.booking_date,
        time: normalizeTime(order.booking_time),
        total: updatedOrder.total,
        summary: patch.order_status === 'cancelled'
          ? 'Booking order was changed to cancelled.'
          : 'Booking order details were edited.',
        changes: orderChanges(order, patch),
      })
      markStaffDataStale('today', 'orders', 'report')
      if (currentTab === 'today') await loadTodayOrders(true)
      if (currentTab === 'orders') await loadRecentOrders(true)
      if (currentTab === 'report') await loadReportData(true)
    }
    setSaving(false)
  }

  async function createCustomerAccount() {
    if (!canCreateCustomerAccounts || isCustomerInviteSaving) return

    const fullName = customerInviteForm.fullName.trim()
    const email = customerInviteForm.email.trim()
    if (!fullName) {
      setCustomerInviteStatus(text.messages.customerAccountNameRequired)
      return
    }
    if (!email) {
      setCustomerInviteStatus(text.messages.customerAccountEmailRequired)
      return
    }

    setIsCustomerInviteSaving(true)
    setCustomerInviteStatus('')
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (sessionError || !accessToken) {
      setCustomerInviteStatus(sessionError?.message || text.messages.readOnlyBooking)
      setIsCustomerInviteSaving(false)
      return
    }

    try {
      const response = await fetch('/api/staff/customers/invite', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          email,
          phone: customerInviteForm.phone.trim(),
          nickname: customerInviteForm.nickname.trim(),
        }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not create customer account.')

      setCustomerInviteForm(defaultCustomerInviteForm())
      setCustomerInviteStatus(text.messages.customerAccountInvited)
      setStatus(text.messages.customerAccountInvited)
      markStaffDataStale('profiles')
      await loadProfiles(true)
    } catch (error) {
      setCustomerInviteStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setIsCustomerInviteSaving(false)
    }
  }

  async function awardAchievementToPlayer() {
    if (!canAwardAchievements || isAchievementAwardSaving) return
    const selectedProfileId = achievementAwardProfileId || awardableProfiles[0]?.id || ''
    if (!selectedProfileId) {
      setAchievementAwardStatus(text.messages.achievementAwardSelectPlayer)
      return
    }

    const selectedAchievement = staffAchievementAwardById(achievementAwardId) || staffAchievementAwardCatalog[0]
    if (!selectedAchievement) return

    setIsAchievementAwardSaving(true)
    setAchievementAwardStatus('')
    const { error } = await supabase.rpc('staff_award_profile_achievement', {
      p_profile_id: selectedProfileId,
      p_achievement_id: selectedAchievement.id,
      p_achievement_kind: selectedAchievement.kind,
      p_title: selectedAchievement.title,
      p_description: selectedAchievement.description,
      p_note: achievementAwardNote.trim() || null,
    })

    if (error) {
      setAchievementAwardStatus(error.message)
      setIsAchievementAwardSaving(false)
      return
    }

    setAchievementAwardNote('')
    setAchievementAwardStatus(text.messages.achievementAwarded)
    markStaffDataStale('achievementAwards')
    await loadAchievementAwards(true)
    setIsAchievementAwardSaving(false)
  }

  async function updateProfileRole(profileId: string, nextRole: StaffRole) {
    if (!canManageRoles) return
    setSaving(true)
    setStatus(text.messages.roleUpdating)
    setRoleSaveFeedback((current) => ({
      ...current,
      [profileId]: { tone: 'saving', message: text.messages.roleUpdating },
    }))

    const { data, error } = await supabase.rpc('set_staff_profile_role', {
      p_profile_id: profileId,
      p_role: nextRole,
    })

    const savedRole = storedRoleValue((data as { role?: string | null } | null)?.role || '')
    const saveError = error?.message || ''

    if (saveError) {
      const message = saveError || text.messages.roleSaveFailed
      setStatus(message)
      setRoleSaveFeedback((current) => ({
        ...current,
        [profileId]: { tone: 'error', message },
      }))
    } else if (savedRole !== nextRole) {
      const message = `${text.messages.roleSaveMismatch} ${text.labels.current} ${staffRoleName(savedRole, text)}.`
      setStatus(message)
      setRoleSaveFeedback((current) => ({
        ...current,
        [profileId]: { tone: 'error', message },
      }))
    } else {
      const message = `${text.messages.roleUpdated} ${staffRoleName(savedRole, text)}.`
      setProfiles((items) => items.map((item) => item.id === profileId ? { ...item, role: savedRole } : item))
      setPendingRoleChanges((current) => {
        const next = { ...current }
        delete next[profileId]
        return next
      })
      markStaffDataStale('profiles')
      setStatus(message)
      setRoleSaveFeedback((current) => ({
        ...current,
        [profileId]: { tone: 'success', message },
      }))
    }
    setSaving(false)
  }

  function stageProfileRole(profileId: string, storedRole: StaffRole, nextRole: StaffRole) {
    setPendingRoleChanges((current) => {
      const next = { ...current }
      if (nextRole === storedRole) delete next[profileId]
      else next[profileId] = nextRole
      return next
    })
  }

  function clearStagedProfileRole(profileId: string) {
    setPendingRoleChanges((current) => {
      const next = { ...current }
      delete next[profileId]
      return next
    })
  }

  function canDeleteProfileAccount(item: StaffProfile) {
    if (!canManageRoles) return false
    if (item.id === profile?.id) return false
    const targetRank = staffRank(item.role, item.email)
    return targetRank < 120 || canRestoreDeleted
  }

  function openProfileDeleteDialog(item: StaffProfile) {
    if (!canDeleteProfileAccount(item)) return
    setProfileDeleteDraft({ profile: item, ban: false, reason: '', confirmation: '' })
  }

  async function deleteProfileAccount() {
    if (!profileDeleteDraft || !canDeleteProfileAccount(profileDeleteDraft.profile)) return
    if (profileDeleteDraft.confirmation !== 'DELETE') return

    setSaving(true)
    setStatus(text.messages.accountDeleting)
    const reason = profileDeleteDraft.reason.trim()
    const { error } = await supabase.rpc('staff_delete_profile_account', {
      p_profile_id: profileDeleteDraft.profile.id,
      p_delete_reason: reason || null,
      p_ban: profileDeleteDraft.ban,
      p_ban_reason: profileDeleteDraft.ban ? reason || null : null,
      p_confirmation: profileDeleteDraft.confirmation,
    })

    if (error) {
      setStatus(error.message)
    } else {
      setStatus(text.messages.accountDeleted)
      setProfileDeleteDraft(null)
      setProfiles((items) => items.filter((item) => item.id !== profileDeleteDraft.profile.id))
      markStaffDataStale('profiles', 'restore')
      if (currentTab === 'restore') await loadDeletedRecords(true)
    }
    setSaving(false)
  }

  async function restoreDeletedRecord(record: SoftDeletedRecord) {
    if (!canRestoreDeleted) return
    setSaving(true)
    setStatus(text.messages.restoringRecord)
    const { error } = await supabase.rpc('restore_soft_deleted_record', {
      p_entity_table: record.entity_table,
      p_entity_id: record.entity_id,
    })
    setStatus(error ? error.message : text.messages.recordRestored)
    if (!error) {
      markStaffDataStale('restore', 'profiles')
      await Promise.all([loadDeletedRecords(true), loadProfiles(true)])
    }
    setSaving(false)
  }

  function editGame(game: StaffGame) {
    const defaultGuides = defaultGameGuideMaps(game.slug, game.game_type)
    setGameForm({
      id: game.id,
      slug: game.slug,
      name: game.name,
      game_type: game.game_type,
      duration_minutes: game.duration_minutes,
      max_players_per_arena: game.max_players_per_arena,
      number_of_rounds: game.number_of_rounds,
      escape_chapter_count: Math.max(1, Math.min(50, Number(game.escape_chapter_count ?? 1) || 1)),
      description: game.description || '',
      audience: normalizeStaffAudience(game.audience, game.difficulty),
      guide_language: normalizeGuideLanguage(game.guide_language),
      guide_summary: guideTextMapWithDefaults(game.guide_summary, defaultGuides.guide_summary),
      guide_rules: guideTextMapWithDefaults(game.guide_rules, defaultGuides.guide_rules),
      guide_tips: guideTextMapWithDefaults(game.guide_tips, defaultGuides.guide_tips),
      image_url: game.image_url || '',
      active: game.active,
      available_arena_ids: (game.available_arena_ids || []).join(', '),
    })
  }

  function startNewGame() {
    setGameForm(defaultGameForm())
    setStatus('')
  }

  function updateGameAudience(audience: StaffAudience, checked: boolean) {
    setGameForm((current) => {
      const selected = new Set(normalizeStaffAudience(current.audience))
      if (checked) {
        selected.add(audience)
      } else {
        selected.delete(audience)
      }

      return {
        ...current,
        audience: staffAudienceOptions.filter((option) => selected.has(option)),
      }
    })
  }

  function updateGameGuideText(field: 'guide_summary' | 'guide_rules' | 'guide_tips', value: string) {
    setGameForm((current) => {
      const language = normalizeGuideLanguage(current.guide_language)
      const nextGuideText = { ...normalizeGuideTextMap(current[field]) }
      if (value) {
        nextGuideText[language] = value
      } else {
        delete nextGuideText[language]
      }

      return {
        ...current,
        [field]: nextGuideText,
      }
    })
  }

  function updateGameArena(arenaId: string, checked: boolean) {
    setGameForm((current) => {
      const selected = new Set(parseStaffArenaIds(current.available_arena_ids))
      if (checked) {
        selected.add(arenaId)
      } else if (selected.size > 1) {
        selected.delete(arenaId)
      }

      return {
        ...current,
        available_arena_ids: staffArenaOptions
          .filter((arena) => selected.has(arena.id))
          .map((arena) => arena.id)
          .join(', '),
      }
    })
  }

  function editPrice(rule: StaffPriceRule) {
    setPriceForm({
      id: rule.id,
      rule_name: rule.rule_name,
      game_id: rule.game_id || '',
      day_type: rule.day_type,
      time_start: normalizeTime(rule.time_start),
      time_end: normalizeTime(rule.time_end),
      price_per_player: String(rule.price_per_player),
      price_per_arena_slot: rule.price_per_arena_slot === null ? '' : String(rule.price_per_arena_slot),
      valid_from: rule.valid_from,
      valid_until: rule.valid_until || '',
      active: rule.active,
    })
  }

  function editDiscount(discount: StaffDiscount) {
    setCommerceTab(discount.code ? 'vouchers' : 'discounts')
    setDiscountForm({
      id: discount.id,
      code: discount.code || '',
      name: discount.name,
      game_id: discount.game_id || '',
      price_rule_id: discount.price_rule_id || '',
      min_players: discount.min_players === null ? '' : String(discount.min_players),
      max_players: discount.max_players === null ? '' : String(discount.max_players),
      day_scope: discount.day_scope || 'all',
      time_start: normalizeTime(discount.time_start),
      time_end: normalizeTime(discount.time_end),
      ticket_type: discount.ticket_type || 'all',
      min_order_total: discount.min_order_total ?? 0,
      max_discount_amount: discount.max_discount_amount === null ? '' : String(discount.max_discount_amount),
      per_customer_limit: discount.per_customer_limit === null ? '' : String(discount.per_customer_limit),
      discount_type: discount.discount_type,
      value: discount.value,
      valid_from: discount.valid_from,
      valid_until: discount.valid_until || '',
      max_uses: discount.max_uses === null ? '' : String(discount.max_uses),
      active: discount.active,
    })
  }

  function editLoyaltyRule(rule: StaffLoyaltyRule) {
    setCommerceTab('loyalty')
    setLoyaltyForm({
      id: rule.id,
      rule_name: rule.rule_name,
      game_id: rule.game_id || '',
      calculation_type: rule.calculation_type,
      points_value: rule.points_value,
      spend_amount: rule.spend_amount,
      min_order_total: rule.min_order_total,
      redeem_value_vnd_per_point: rule.redeem_value_vnd_per_point ?? 0,
      earn_trigger: rule.earn_trigger ?? 'session_payment_confirmed',
      rounding_rule: rule.rounding_rule ?? 'floor_whole_points',
      point_expiry_days: rule.point_expiry_days === null ? '' : String(rule.point_expiry_days),
      valid_from: rule.valid_from,
      valid_until: rule.valid_until || '',
      active: rule.active,
      notes: rule.notes || '',
    })
  }

  function applyPreviousPeriodComparison() {
    const [previousStart, previousEnd] = previousPeriodRange(reportStart, reportEnd)
    setCompareStart(previousStart)
    setCompareEnd(previousEnd)
    setCompareEnabled(true)
  }

  function applyReportDateRange(nextStart: string, nextEnd: string, nextCompareEnabled: boolean, nextCompareStart: string, nextCompareEnd: string) {
    const [from, to] = orderedRange(nextStart, nextEnd)
    const [compareFrom, compareTo] = orderedRange(nextCompareStart, nextCompareEnd)
    setReportStart(from)
    setReportEnd(to)
    setCompareEnabled(nextCompareEnabled)
    setCompareStart(compareFrom)
    setCompareEnd(compareTo)
    setReportDatePickerOpen(false)
  }

  async function exportExcelReport() {
    await downloadExcel(`vrena-daily-report-${reportStart}-${reportEnd}.xlsx`, [
      { title: `${text.tabs.report} ${rangeLabel(reportStart, reportEnd)}`, rows: staffReportRows(report, text) },
      { title: text.labels.orders, rows: staffOrderExportRows(reportOrders, games, reportPaymentsByOrderId, text) },
    ], text)
  }

  async function exportPdfReport() {
    await downloadPdf(
      `vrena-daily-report-${reportStart}-${reportEnd}.pdf`,
      reportPdfLines(`${text.tabs.report} ${rangeLabel(reportStart, reportEnd)}`, report, reportOrders, games, reportPaymentsByOrderId, text),
      text
    )
  }

  async function downloadAccountantExport() {
    const reportDefinition = accountantExportReports.find((item) => item.id === accountantReportId) || accountantExportReports[0]
    const storeDefinition = accountantExportStores.find((item) => item.id === accountantExportStore) || accountantExportStores[0]
    const exportText = staffConsoleText[accountantExportLanguage]
    let exportAuditLogs: StaffAuditLog[] = []
    if (reportDefinition.id === 'audit_trail') {
      try {
        exportAuditLogs = await fetchAuditLogs(250)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error))
        return
      }
    }
    const exportContext = {
      report,
      orders: reportOrders,
      games,
      paymentsByOrderId: reportPaymentsByOrderId,
      discounts,
      loyaltyRules,
      auditLogs: exportAuditLogs,
      text: exportText,
      reportStart,
      reportEnd,
      storeLabel: storeDefinition.label[accountantExportLanguage],
      language: accountantExportLanguage,
      includeAttachments: accountantIncludeAttachments,
    }
    const reportTitle = reportDefinition.label[accountantExportLanguage]
    const { accountantExportInfoRows, buildAccountantExportRows } = await import('../lib/staffAccountantExportRows')
    const rows = buildAccountantExportRows(reportDefinition.id, exportContext)
    const suffix = `${reportStart}_${reportEnd}`
    if (accountantExportFormat === 'csv') {
      await downloadCsv(`${reportDefinition.fileBase}_${suffix}.csv`, rows, exportText)
      return
    }
    await downloadExcel(`${reportDefinition.fileBase}_${suffix}.xlsx`, [
      { title: reportTitle, rows },
      {
        title: accountantExportLanguage === 'vi' ? 'Thông tin xuất file' : 'Export info',
        rows: accountantExportInfoRows(reportTitle, exportContext),
      },
    ], exportText)
  }

  function updateBookingPaymentSplit(splitId: string, patch: Partial<PaymentSplitDraft>) {
    setBooking((current) => ({
      ...current,
      paymentSplits: current.paymentSplits.map((split) => (
        split.id === splitId ? { ...split, ...patch } : split
      )),
    }))
  }

  function addBookingPaymentSplit() {
    setBooking((current) => ({
      ...current,
      paymentSplits: [...current.paymentSplits, newPaymentSplit('cash')],
    }))
  }

  function removeBookingPaymentSplit(splitId: string) {
    setBooking((current) => ({
      ...current,
      paymentSplits: current.paymentSplits.length > 1
        ? current.paymentSplits.filter((split) => split.id !== splitId)
        : [newPaymentSplit('cash')],
    }))
  }

  function openCommerceTab(tab: StaffCommerceTab) {
    setCommerceTab(tab)
    setStatus('')
    if (tab === 'loyalty') {
      setLoyaltyForm(defaultLoyaltyForm())
    } else {
      setDiscountForm(defaultDiscountForm())
    }
  }

  const tabButton = (tab: StaffTab, label: string) => (
    allowedTabs.includes(tab) && (
      <button
        aria-selected={currentTab === tab}
        className={currentTab === tab ? 'active' : ''}
        role="tab"
        type="button"
        onClick={() => setActiveTab(tab)}
      >
        {label}
      </button>
    )
  )

  const openTabGroup = (groupId: StaffTabGroupId) => {
    const group = visibleTabGroups.find((item) => item.id === groupId)
    const firstTab = group?.tabs[0]
    if (firstTab) setActiveTab(firstTab)
  }

  const orderRows = (rows: StaffOrder[], paymentsByOrderId = orderPaymentsByOrderId) => (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th>{text.labels.order}</th>
            <th>{text.labels.customer}</th>
            <th>{text.labels.game}</th>
            <th>{text.labels.date}</th>
            <th>{text.labels.total}</th>
            <th>{text.labels.payment}</th>
            <th>{text.labels.status}</th>
            {canCreateOrders && <th>{text.labels.actions}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id}>
              <td><strong>{order.order_number}</strong></td>
              <td>{order.customer_name || order.customer_phone || order.customer_email || text.walkIn}</td>
              <td>{games.find((game) => game.id === order.game_id)?.name || text.gameFallback}</td>
              <td>{staffDateLabel(order.booking_date)} · {normalizeTime(order.booking_time)}</td>
              <td>{formatVnd(order.total)}</td>
              <td>{orderPaymentLabel(order, paymentsByOrderId, text)}<br /><span>{paymentStatusLabel(order.payment_status, text)}</span></td>
              <td>{text.orderStatuses[order.order_status]}</td>
              {canCreateOrders && (
                <td>
                  <div className="staff-row-actions">
                    <button type="button" onClick={() => updateOrder(order, { payment_status: 'paid', order_status: 'paid' })}>
                      <ButtonIconText icon={<CheckCircle2 aria-hidden="true" size={14} />}>{text.actions.paid}</ButtonIconText>
                    </button>
                    <button type="button" onClick={() => updateOrder(order, { order_status: 'completed' })}>
                      <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.done}</ButtonIconText>
                    </button>
                    <button type="button" onClick={() => updateOrder(order, { order_status: 'no_show' })}>
                      <ButtonIconText icon={<UserX aria-hidden="true" size={14} />}>{text.actions.noShow}</ButtonIconText>
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={canCreateOrders ? 8 : 7}>{text.messages.noOrders}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  if (rank < 20) {
    return (
      <section className="section staff-console" data-testid="staff-console">
        <h2>{consoleTitle}</h2>
        <p className="notice">{text.accessRequired}</p>
      </section>
    )
  }

  return (
    <section className="section staff-console" data-testid="staff-console">
      <div className="section-head">
        <div>
          <h2>{consoleTitle}</h2>
        </div>
        <span className="staff-role-pill">{staffRoleName(role, text)}</span>
      </div>

      {!isHrConsole && (
        <div className="staff-console-nav" aria-label={text.aria.staffConsole}>
          <div className="staff-tab-categories" role="tablist" aria-label={text.aria.staffConsole}>
            {visibleTabGroups.map((group) => (
              <button
                aria-selected={currentTabGroup === group.id}
                className={currentTabGroup === group.id ? 'active' : ''}
                key={group.id}
                role="tab"
                type="button"
                onClick={() => openTabGroup(group.id)}
              >
                {text.tabGroups[group.id]}
              </button>
            ))}
          </div>
          <div className="staff-tabs" role="tablist" aria-label={text.aria.staffConsole}>
            {visibleTabGroups.map((group) => (
              <div className={currentTabGroup === group.id ? 'staff-tab-group active' : 'staff-tab-group'} key={group.id}>
                <span className="staff-tab-group-label">{text.tabGroups[group.id]}</span>
                <div className="staff-tab-group-buttons">
                  {group.tabs.map((tab) => (
                    <Fragment key={tab}>{tabButton(tab, text.tabs[tab])}</Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {status && <p className="sr-only" aria-live="polite">{status}</p>}
      {currentTabLoading && <AppLoadingState compact label={text.loading} />}

      {currentTab === 'new' && (
        <div className="staff-grid">
          <div className="staff-card staff-card-wide">
            <div className="staff-card-heading">
              <h3>{text.labels.newBooking}</h3>
              <button
                aria-label={text.aria.openSessionCalendar}
                className="staff-calendar-shortcut"
                type="button"
                onClick={() => {
                  const targetDate = booking.date || todayString()
                  if (onOpenSessionCalendar) {
                    onOpenSessionCalendar(targetDate)
                    return
                  }
                  setOperationsDate(targetDate)
                  setActiveTab('today')
                }}
              >
                <ButtonIconText icon={<CalendarDays aria-hidden="true" size={15} />}>{text.actions.calendar}</ButtonIconText>
              </button>
            </div>
            {!canCreateOrders && <p className="staff-readonly-note">{text.messages.readOnlyBooking}</p>}
            <fieldset className="staff-readonly-fieldset" disabled={!canCreateOrders}>
            <div className="form-grid compact-form-grid">
              <label>
                {text.labels.customerProfile}
                <select value={booking.customerId} onChange={(event) => applyCustomer(event.target.value)}>
                  <option value="">{text.walkIn}</option>
                  {profiles.map((item) => (
                    <option key={item.id} value={item.id}>{customerName(item, text)}</option>
                  ))}
                </select>
              </label>
              <div
                className="staff-customer-name-field"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setCustomerNameFocused(false)
                }}
                onFocus={() => setCustomerNameFocused(true)}
              >
                <label htmlFor="staff-booking-customer-name">{text.labels.customerName}</label>
                <input
                  id="staff-booking-customer-name"
                  aria-autocomplete="list"
                  aria-controls={showCustomerNameSuggestions ? 'staff-customer-name-suggestions' : undefined}
                  aria-expanded={showCustomerNameSuggestions}
                  role="combobox"
                  value={booking.customerName}
                  onChange={(event) => handleCustomerNameChange(event.target.value)}
                />
                {showCustomerNameSuggestions && (
                  <div className="staff-customer-suggestions" id="staff-customer-name-suggestions" role="listbox">
                    {customerNameSuggestions.map((item) => (
                      <button
                        aria-selected={booking.customerId === item.id}
                        className="staff-customer-suggestion"
                        key={item.id}
                        role="option"
                        type="button"
                        onClick={() => selectCustomerSuggestion(item.id)}
                      >
                        <span>{customerName(item, text)}</span>
                        <small>{[item.phone, item.email].filter(Boolean).join(' · ') || text.noContact}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <label>
                {text.labels.phone}
                <PhoneNumberInput
                  buttonLabel={sharedText.countryCode}
                  className="staff-phone-control"
                  inputLabel={text.labels.phone}
                  onChange={(phone) => setBooking({ ...booking, customerPhone: phone })}
                  searchPlaceholder={sharedText.searchCountry}
                  value={booking.customerPhone}
                />
              </label>
              <label>
                {text.labels.email}
                <input value={booking.customerEmail} onChange={(event) => setBooking({ ...booking, customerEmail: event.target.value })} />
              </label>
              <label>
                {text.labels.game}
                <select value={booking.gameId || selectedGame?.id || ''} onChange={(event) => setBooking({ ...booking, gameId: event.target.value })}>
                  {activeGames.map((game) => (
                    <option key={game.id} value={game.id}>{game.name}</option>
                  ))}
                </select>
              </label>
              <label>
                {text.labels.date}
                <StaffPickerField ariaLabel={text.aria.bookingDate} inputRef={bookingDateInputRef} placeholder={text.chooseDate} type="date" value={booking.date} onChange={(value) => setBooking({ ...booking, date: value })} />
              </label>
              <label>
                {text.labels.time}
                <StaffPickerField ariaLabel={text.aria.bookingTime} placeholder={text.chooseTime} type="time" value={booking.time} onChange={(value) => setBooking({ ...booking, time: value })} />
              </label>
              <label>
                {text.labels.players}
                <input min={1} max={64} type="number" value={booking.players} onChange={(event) => setBooking({ ...booking, players: Number(event.target.value) })} />
              </label>
              <label>
                {text.labels.arena}
                <select value={booking.arenaId} onChange={(event) => setBooking({ ...booking, arenaId: event.target.value })}>
                  {(selectedGame?.available_arena_ids?.length ? selectedGame.available_arena_ids : ['arena-1']).map((arena) => (
                    <option key={arena} value={arena}>{arena}</option>
                  ))}
                </select>
              </label>
              <label>
                {text.labels.discountVoucher}
                <select
                  value={booking.discountId}
                  onChange={(event) => setBooking({
                    ...booking,
                    discountId: event.target.value,
                    manualDiscountType: '',
                    manualDiscountValue: 0,
                  })}
                >
                  <option value="">{text.noDiscount}</option>
                  {availableBookingDiscounts.map((discount) => (
                    <option key={discount.id} value={discount.id}>{discount.code ? `${discount.code} · ${discount.name}` : discount.name}</option>
                  ))}
                </select>
              </label>
              <div className="staff-manual-discount full">
                <span className="staff-field-label">{text.labels.uniqueDiscount}</span>
                <div>
                  <select
                    value={booking.manualDiscountType}
                    onChange={(event) => setBooking({
                      ...booking,
                      discountId: '',
                      manualDiscountType: event.target.value as BookingForm['manualDiscountType'],
                      manualDiscountValue: event.target.value ? booking.manualDiscountValue : 0,
                    })}
                  >
                    <option value="">{text.noUniqueDiscount}</option>
                    <option value="fixed_amount">{text.vndAmount}</option>
                    <option value="percentage">{text.discountTypes.percentage}</option>
                  </select>
                  <input
                    disabled={!booking.manualDiscountType}
                    min={0}
                    max={booking.manualDiscountType === 'percentage' ? 100 : undefined}
                    placeholder={booking.manualDiscountType === 'percentage' ? '%' : 'VND'}
                    type="number"
                    value={booking.manualDiscountValue || ''}
                    onChange={(event) => setBooking({
                      ...booking,
                      discountId: '',
                      manualDiscountValue: Number(event.target.value),
                    })}
                  />
                </div>
                <p className="field-help">{text.messages.uniqueDiscountHelp}</p>
              </div>
              <div className="staff-payment-splits full">
                <div className="staff-list-head">
                  <h4>{text.labels.paymentSplits}</h4>
                    <button type="button" onClick={addBookingPaymentSplit}>
                      <ButtonIconText icon={<Plus aria-hidden="true" size={14} />}>{text.actions.addSplit}</ButtonIconText>
                    </button>
                </div>
                <div className="staff-payment-split-list">
                  {booking.paymentSplits.map((split) => (
                    <div className="staff-payment-split-row" key={split.id}>
                      <select
                        aria-label={text.aria.paymentMethod}
                        value={split.payment_method}
                        onChange={(event) => updateBookingPaymentSplit(split.id, { payment_method: event.target.value as StaffPaymentMethod })}
                      >
                        {paymentMethods.map((method) => <option key={method} value={method}>{text.paymentMethods[method]}</option>)}
                      </select>
                      <input
                        aria-label={text.aria.paymentAmount}
                        inputMode="numeric"
                        placeholder="0 đ"
                        value={formatDongInput(split.amount)}
                        onChange={(event) => updateBookingPaymentSplit(split.id, { amount: dongDigits(event.target.value) })}
                      />
                      <button className="secondary" type="button" onClick={() => removeBookingPaymentSplit(split.id)}>
                        <ButtonIconText icon={<Trash2 aria-hidden="true" size={14} />}>{text.actions.remove}</ButtonIconText>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="field-help">
                  {text.labels.paid} {formatVnd(bookingPaidTotal)} · {text.labels.remaining} {formatVnd(bookingRemainingTotal)}
                  {' · '}
                  {text.labels.status} {paymentStatusLabel(paymentStatusFromAmount(quote.total, bookingPaidTotal), text)}
                </p>
              </div>
              <label>
                {text.labels.orderStatus}
                <select value={booking.orderStatus} onChange={(event) => setBooking({ ...booking, orderStatus: event.target.value as BookingForm['orderStatus'] })}>
                  {orderStatuses.map((status) => <option key={status} value={status}>{text.orderStatuses[status]}</option>)}
                </select>
              </label>
            </div>
            <label className="staff-note-field">
              {text.labels.internalNote}
              <textarea value={booking.note} onChange={(event) => setBooking({ ...booking, note: event.target.value })} />
            </label>
            </fieldset>
          </div>

          <div className="staff-card staff-summary-card">
            <h3>{text.labels.summary}</h3>
            <div className="staff-price-lines">
              <span>{text.labels.rule}</span><strong>{quote.ruleName}</strong>
              <span>{text.labels.duration}</span><strong>{quote.duration} min</strong>
              <span>{text.labels.subtotal}</span><strong>{formatVnd(quote.subtotal)}</strong>
              <span>{text.labels.discountType}</span><strong>{quote.discountLabel}</strong>
              <span>{text.labels.discount}</span><strong>-{formatVnd(quote.discountTotal)}</strong>
              <span>{text.labels.total}</span><strong>{formatVnd(quote.total)}</strong>
            </div>
            <button className={saving ? 'primary create-button loading' : 'primary create-button'} disabled={!canCreateOrders || saving || !selectedGame} type="button" onClick={createOrder}>
              {text.actions.confirmBooking}
            </button>
          </div>
        </div>
      )}

      {currentTab === 'today' && (
        <div className="staff-card staff-card-wide staff-operations-card">
          <div className="staff-card-heading">
            <div>
              <h3>{text.labels.operationsCalendar}</h3>
              <p>{text.messages.operationsIntro}</p>
            </div>
            <div className="staff-operations-actions">
              <label>
                <span className="staff-field-label">{text.labels.operationsDate}</span>
                <StaffPickerField
                  ariaLabel={text.labels.operationsDate}
                  placeholder={text.chooseDate}
                  type="date"
                  value={operationsDate}
                  onChange={setOperationsDate}
                />
              </label>
              {onOpenSessionCalendar && (
                <button
                  aria-label={text.aria.openSessionCalendar}
                  className="staff-calendar-shortcut"
                  type="button"
                  onClick={() => onOpenSessionCalendar(operationsDate)}
                >
                  <ButtonIconText icon={<CalendarDays aria-hidden="true" size={15} />}>{text.actions.sessionCalendar}</ButtonIconText>
                </button>
              )}
              <button type="button" onClick={() => setOperationsDate(todayString())}>
                <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>{text.actions.today}</ButtonIconText>
              </button>
              {canCreateOrders && (
                <button
                  className="staff-calendar-shortcut"
                  type="button"
                  onClick={() => {
                    setBooking((current) => ({ ...current, date: operationsDate }))
                    setActiveTab('new')
                  }}
                >
                  <ButtonIconText icon={<Plus aria-hidden="true" size={15} />}>{text.tabs.new}</ButtonIconText>
                </button>
              )}
            </div>
          </div>

          <div className="staff-commerce-switcher staff-operation-scope-tabs" role="tablist" aria-label={text.labels.sessions}>
            {(['today', 'past'] as StaffOperationScope[]).map((scope) => (
              <button
                aria-selected={operationSessionScope === scope}
                className={operationSessionScope === scope ? 'active' : ''}
                key={scope}
                role="tab"
                type="button"
                onClick={() => setOperationSessionScope(scope)}
              >
                {scope === 'today' ? text.actions.today : text.actions.past}
              </button>
            ))}
          </div>

          <div className="staff-summary-grid staff-operations-summary">
            <div><span>{text.labels.sessions}</span><strong>{operationSummary.sessions}</strong></div>
            <div><span>{text.labels.ticketBookings}</span><strong>{operationSummary.ticketBookings}</strong></div>
            <div><span>{text.labels.capacity}</span><strong>{operationSummary.bookedPlayers}/{operationSummary.capacity}</strong></div>
            <div><span>{text.labels.checkIns}</span><strong>{operationSummary.checkedIn}/{operationSummary.checkablePlayers}</strong></div>
            <div><span>{text.labels.totalPaid}</span><strong>{formatVnd(operationSummary.paid)}</strong></div>
            <div><span>{text.unpaid}</span><strong>{formatVnd(operationSummary.unpaid)}</strong></div>
          </div>

          <div className="staff-operations-list">
            {operationSessions.map((session) => {
              const order = operationOrderBySessionId.get(session.id)
              const participants = session.session_participants || []
              const isExpanded = Boolean(expandedOperationSessions[session.id])
              const staffGame = sessionStaffGame(session, games)
              const isEscapeGame = staffGame?.game_type === 'escape'
              const chapterCount = Math.max(1, Math.min(50, Number(staffGame?.escape_chapter_count ?? 1) || 1))
              const addableProfiles = profiles.filter((item) => !isDemoProfile(item) && !participants.some((participant) => participant.profile_id === item.id))
              const paidAmount = order ? orderPaidAmount(order, orderPaymentsByOrderId) : 0
              const totalAmount = order?.total ?? Number(session.ticket_total_price || 0)
              const paymentLabel = order
                ? `${paymentStatusLabel(order.payment_status, text)} · ${formatVnd(paidAmount)}/${formatVnd(order.total)}`
                : totalAmount > 0
                  ? `${session.ticket_status || text.labels.noLinkedOrder} · ${formatVnd(totalAmount)}`
                  : text.labels.noLinkedOrder
              return (
                <article className="staff-operation-session" key={session.id}>
                  <div className="staff-operation-time">
                    <strong>{normalizeTime(session.start_time)}</strong>
                    <span>{addMinutesToTime(session.start_time, session.duration_minutes)}</span>
                  </div>
                  <div className="staff-operation-main">
                    <div className="staff-operation-title-row">
                      <strong>{session.name}</strong>
                      <span>{sessionKindLabel(session, text)}</span>
                    </div>
                    <div className="staff-operation-meta">
                      <span>{sessionGameName(session, games, text)}</span>
                      <span>{session.duration_minutes} min</span>
                      <span>{text.labels.capacity}: {sessionBookedPlayers(session, order)}/{sessionCapacity(session, order)}</span>
                      <span>{text.labels.checkIns}: {sessionCheckedInCount(session)}/{Math.max(participants.length, sessionCheckedInCount(session))}</span>
                      <span>{text.labels.payment}: {paymentLabel}</span>
                    </div>
                    {order && (
                      <div className="staff-operation-order">
                        <span>{order.order_number}</span>
                        <span>{order.customer_name || order.customer_phone || order.customer_email || text.walkIn}</span>
                        <span>{orderPaymentLabel(order, orderPaymentsByOrderId, text)}</span>
                      </div>
                    )}
                  </div>
                  <div className="staff-row-actions staff-operation-actions">
                    <button type="button" onClick={() => setExpandedOperationSessions((current) => ({ ...current, [session.id]: !current[session.id] }))}>
                      {isExpanded ? text.actions.cancel : text.actions.edit}
                    </button>
                    {order && canCreateOrders && (
                      <>
                        <button type="button" onClick={() => updateOrder(order, { payment_status: 'paid', order_status: 'paid' })}>
                          <ButtonIconText icon={<CheckCircle2 aria-hidden="true" size={14} />}>{text.actions.paid}</ButtonIconText>
                        </button>
                        <button type="button" onClick={() => updateOrder(order, { order_status: 'completed' })}>
                          <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.done}</ButtonIconText>
                        </button>
                        <button type="button" onClick={() => updateOrder(order, { order_status: 'no_show' })}>
                          <ButtonIconText icon={<UserX aria-hidden="true" size={14} />}>{text.actions.noShow}</ButtonIconText>
                        </button>
                      </>
                    )}
                    {canCreateOrders && (
                      <button className="danger" disabled={saving} type="button" onClick={() => openOperationDeleteDraft(session, order || null)}>
                        <ButtonIconText icon={<Trash2 aria-hidden="true" size={14} />}>{text.actions.deleteSession}</ButtonIconText>
                      </button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="staff-operation-edit-panel">
                      <div className="staff-operation-edit-section">
                        <strong>{text.labels.sessionFields}</strong>
                        <div className="staff-operation-field-grid">
                          <label>{text.labels.name}<input defaultValue={session.name} disabled={!canCreateOrders || saving} onBlur={(event) => updateOperationSession(session, { name: event.target.value })} /></label>
                          <label>{text.labels.date}<StaffPickerField ariaLabel={text.labels.date} placeholder={text.chooseDate} type="date" value={session.date} onChange={(value) => updateOperationSession(session, { date: value })} /></label>
                          <label>{text.labels.time}<StaffPickerField ariaLabel={text.labels.time} placeholder={text.chooseTime} type="time" value={normalizeTime(session.start_time)} onChange={(value) => updateOperationSession(session, { start_time: value })} /></label>
                          <label>{text.labels.duration}<input defaultValue={session.duration_minutes} disabled={!canCreateOrders || saving} min={20} type="number" onBlur={(event) => updateOperationSession(session, { duration_minutes: Number(event.target.value) || session.duration_minutes })} /></label>
                          <label>{text.labels.maxPlayers}<input defaultValue={session.max_players} disabled={!canCreateOrders || saving} min={1} type="number" onBlur={(event) => updateOperationSession(session, { max_players: Number(event.target.value) || session.max_players })} /></label>
                          <label>{text.labels.arena}<input defaultValue={session.arena_count ?? 1} disabled={!canCreateOrders || saving} min={1} type="number" onBlur={(event) => updateOperationSession(session, { arena_count: Number(event.target.value) || session.arena_count || 1 })} /></label>
                          <label>{text.labels.status}<select defaultValue={session.status} disabled={!canCreateOrders || saving} onChange={(event) => updateOperationSession(session, { status: event.target.value as StaffOperationSession['status'] })}><option value="open">open</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select></label>
                          <label>{text.labels.type}<select defaultValue={session.visibility} disabled={!canCreateOrders || saving} onChange={(event) => updateOperationSession(session, { visibility: event.target.value as StaffOperationSession['visibility'] })}><option value="public">{text.labels.communitySession}</option><option value="private">{text.labels.privateSession}</option></select></label>
                          <label>{text.labels.game}<select defaultValue={session.confirmed_game_id || ''} disabled={!canCreateOrders || saving} onChange={(event) => updateOperationSession(session, { confirmed_game_id: event.target.value })}><option value="">{text.noneYet}</option>{games.map((game) => <option key={game.id} value={game.slug}>{game.name}</option>)}</select></label>
                        </div>
                      </div>

                      <div className="staff-operation-edit-section">
                        <strong>{text.labels.addPlayer}</strong>
                        <div className="staff-operation-add-player">
                          <StaffOperationPlayerSearch
                            disabled={!canCreateOrders || saving}
                            onQueryChange={(value) => setOperationAddProfileQueryBySession((current) => ({ ...current, [session.id]: value }))}
                            onSelect={(profileOption) => setOperationAddProfileBySession((current) => ({ ...current, [session.id]: profileOption?.id || '' }))}
                            profiles={addableProfiles}
                            query={operationAddProfileQueryBySession[session.id] || ''}
                            selectedProfileId={operationAddProfileBySession[session.id] || ''}
                            text={text}
                          />
                          <button disabled={!canCreateOrders || saving || !operationAddProfileBySession[session.id]} type="button" onClick={() => addOperationParticipant(session)}>
                            <ButtonIconText icon={<Plus aria-hidden="true" size={14} />}>{text.labels.addPlayer}</ButtonIconText>
                          </button>
                        </div>
                      </div>

                      <div className="staff-operation-edit-section">
                        <strong>{text.labels.participantResults}</strong>
                        <div className="staff-operation-participants">
                          {participants.map((participant) => {
                            const chapterTimes = new Map((participant.chapter_times || []).map((item) => [Number(item.chapter_number), Number(item.duration_seconds)]))
                            return (
                              <div className="staff-operation-participant" key={participant.id}>
                                <div className="staff-operation-participant-head">
                                  <strong>{operationParticipantName(participant, text)}</strong>
                                  <button disabled={!canCreateOrders || saving} type="button" onClick={() => removeOperationParticipant(session, participant)}>
                                    <ButtonIconText icon={<UserX aria-hidden="true" size={14} />}>{text.actions.removePlayer}</ButtonIconText>
                                  </button>
                                </div>
                                <div className="staff-operation-field-grid compact">
                                  <label>{text.labels.checkIns}<input defaultChecked={Boolean(participant.checked_in)} disabled={!canCreateOrders || saving} type="checkbox" onChange={(event) => updateOperationParticipant(session, participant, { checked_in: event.target.checked })} /></label>
                                  <label>{text.labels.paymentStatus}<select defaultValue={participant.payment_status || ''} disabled={!canCreateOrders || saving} onChange={(event) => updateOperationParticipant(session, participant, { payment_status: event.target.value })}><option value="">{text.unpaid}</option><option value="cash">{text.paymentMethods.cash}</option><option value="bank_transfer">{text.paymentMethods.bank_transfer}</option><option value="paid">{text.actions.paid}</option><option value="free">free</option></select></label>
                                  <label>{text.labels.payment}<input defaultValue={participant.payment_amount ?? ''} disabled={!canCreateOrders || saving} inputMode="numeric" onBlur={(event) => updateOperationParticipant(session, participant, { payment_amount: Number(event.target.value) || null })} /></label>
                                  <label>{text.labels.score}<input defaultValue={participant.score ?? ''} disabled={!canCreateOrders || saving} inputMode="numeric" onBlur={(event) => updateOperationParticipant(session, participant, { score: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                                  <label>{text.labels.place}<input defaultValue={participant.placement ?? ''} disabled={!canCreateOrders || saving} inputMode="numeric" onBlur={(event) => updateOperationParticipant(session, participant, { placement: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                                  <label>{text.labels.accuracy}<input defaultValue={participant.accuracy_percent ?? ''} disabled={!canCreateOrders || saving} inputMode="decimal" onBlur={(event) => updateOperationParticipant(session, participant, { accuracy_percent: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                                  <label>{text.labels.projectiles}<input defaultValue={participant.projectiles_fired ?? ''} disabled={!canCreateOrders || saving} inputMode="numeric" onBlur={(event) => updateOperationParticipant(session, participant, { projectiles_fired: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                                  {isEscapeGame && <label>{text.labels.escapeTime}<input defaultValue={formatStaffDuration(participant.escape_duration_seconds)} disabled={!canCreateOrders || saving} inputMode="text" placeholder="12:34" onBlur={(event) => updateOperationParticipant(session, participant, { escape_duration_seconds: parseStaffDuration(event.target.value) })} /></label>}
                                </div>
                                {isEscapeGame && (
                                  <div className="staff-operation-chapters">
                                    <span>{text.labels.chapterTimes}</span>
                                    {Array.from({ length: chapterCount }, (_, index) => index + 1).map((chapterNumber) => (
                                      <label key={chapterNumber}>
                                        {text.labels.chapter} {chapterNumber}
                                        <input
                                          defaultValue={formatStaffDuration(chapterTimes.get(chapterNumber))}
                                          disabled={!canCreateOrders || saving}
                                          inputMode="text"
                                          placeholder="12:34"
                                          onBlur={(event) => updateOperationChapterTime(session, participant, staffGame?.slug || '', chapterNumber, event.target.value)}
                                        />
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
            {operationSessions.length === 0 && (
              <p className="notice">{text.messages.noOperationSessions}</p>
            )}
          </div>

          {unlinkedOperationOrders.length > 0 && (
            <details className="staff-operations-orders">
              <summary>{text.labels.orders}</summary>
              {orderRows(unlinkedOperationOrders)}
            </details>
          )}
        </div>
      )}

      {currentTab === 'attendance' && (
        <div className="staff-card staff-card-wide staff-attendance-card">
          <div className="staff-card-heading">
            <div className="staff-operations-actions staff-attendance-actions">
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
                  onChange={(value) => setAttendanceRange(value, attendanceWeekEnd)}
                />
              </label>
              <label>
                <span className="staff-field-label">{text.labels.endDate}</span>
                <StaffPickerField
                  ariaLabel={text.labels.endDate}
                  placeholder={text.chooseDate}
                  type="date"
                  value={attendanceWeekEnd}
                  onChange={(value) => setAttendanceRange(attendanceWeekStart, value)}
                />
              </label>
              <button type="button" onClick={resetAttendanceRangeToThisWeek}>
                <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>{text.actions.today}</ButtonIconText>
              </button>
              <button type="button" onClick={() => shiftAttendanceRange(attendanceWeekDates.length)}>
                <ButtonIconText icon={<ChevronRight aria-hidden="true" size={14} />}>{text.actions.nextWeek}</ButtonIconText>
              </button>
            </div>
          </div>

          <p className="staff-attendance-range">{staffDateLabel(attendanceWeekStart)} - {staffDateLabel(attendanceWeekEnd)}</p>
          {!canEditAttendance && <p className="staff-readonly-note">{text.messages.attendanceReadOnly}</p>}

          <div className="staff-summary-grid staff-attendance-summary">
            <div><span>{text.labels.scheduledHours}</span><strong>{hoursLabel(attendanceSummary.scheduledMinutes)}</strong></div>
            <div><span>{text.labels.workedHours}</span><strong>{hoursLabel(attendanceSummary.workedMinutes)}</strong></div>
            <div><span>{text.labels.regularHours}</span><strong>{hoursLabel(attendanceSummary.regularMinutes)}</strong></div>
            <div><span>{text.labels.overtimeHours}</span><strong>{hoursLabel(attendanceSummary.overtimeMinutes)}</strong></div>
            <div><span>{text.labels.nightHours}</span><strong>{hoursLabel(attendanceSummary.nightMinutes)}</strong></div>
            <div><span>{text.labels.leaveHours}</span><strong>{attendanceSummary.leaveHours}h</strong></div>
          </div>

          <div className="staff-commerce-switcher staff-attendance-tabs" role="tablist" aria-label={text.tabs.attendance}>
            {visibleAttendanceTabs.map((item) => (
              <button
                aria-selected={currentAttendanceTab === item}
                className={currentAttendanceTab === item ? 'active' : ''}
                key={item}
                role="tab"
                type="button"
                onClick={() => setAttendanceTab(item)}
              >
                {text.attendanceTabs[item]}
              </button>
            ))}
          </div>

          {visibleStaffProfileOptions.length === 0 ? (
            <p className="notice">{text.messages.noStaffProfiles}</p>
          ) : (
            <>
              {currentAttendanceTab === 'schedule' && (
                <>
                  <section className="staff-planning-panel" aria-label={text.labels.weeklySchedule}>
                    <div className="staff-planning-toolbar">
                      <div className="staff-planning-title">
                        <strong>{text.labels.weeklySchedule}</strong>
                        <span>{text.messages.planningGridHelp}</span>
                      </div>
                      <label>
                        {text.labels.shiftTemplate}
                        <select value={selectedShiftTemplate} onChange={(event) => applyShiftTemplate(event.target.value as StaffShiftTemplateId)} disabled={!canManageAttendance}>
                          {effectiveShiftTemplates.map((template) => <option key={template.id} value={template.id}>{text.shiftTemplates[template.id]}</option>)}
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

                    <div className="staff-planning-grid-shell">
                      <div className="staff-planning-grid" role="grid" aria-label={text.labels.weeklySchedule} style={attendanceGridStyle}>
                        <div className="staff-planning-corner" role="columnheader">{text.labels.staffMember}</div>
                        {attendanceWeekDates.map((dateValue) => (
                          <div className="staff-planning-day" role="columnheader" key={dateValue}>
                            <strong>{shortDateLabel(dateValue)}</strong>
                            <span>{text.reportWeekdays[(dateFromInput(dateValue).getDay() + 6) % 7]}</span>
                          </div>
                        ))}
                        {visibleStaffProfileOptions.map((staffProfile) => {
                          const employee = employeeProfileById.get(staffProfile.id)
                          const isInactiveEmployee = employee?.active === false
                          return (
                          <Fragment key={staffProfile.id}>
                            <div className={`staff-planning-staff ${isInactiveEmployee ? 'inactive' : ''}`} role="rowheader">
                              <StaffRoleAvatar profile={staffProfile} text={text} />
                              <span>
                                <strong>{customerName(staffProfile, text)}</strong>
                                {isInactiveEmployee && <small>{text.labels.inactiveEmployee}</small>}
                              </span>
                            </div>
                            {attendanceWeekDates.map((dateValue) => {
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
                                    const shift = visibleAttendanceShifts.find((item) => item.id === draggingShiftId)
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
                                  {cellShifts.map((shift) => {
                                    const warnings = shiftWarningsById.get(shift.id) || []
                                    return (
                                      <button
                                        className={`staff-shift-chip ${warnings.length > 0 ? 'has-warning' : ''}`}
                                        draggable={canManageAttendance}
                                        key={shift.id}
                                        type="button"
                                        onClick={() => editShift(shift)}
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
                  </section>

                  <div className="staff-attendance-layout">
                    <div className="staff-attendance-list">
                      <h4>{text.labels.shiftList}</h4>
                      {visibleAttendanceShifts.map((shift) => {
                        const staffProfile = profileById.get(shift.staff_profile_id)
                        const warnings = shiftWarningsById.get(shift.id) || []
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
                              {warnings.map((warning) => <span className="staff-warning-text" key={warning}>{warning}</span>)}
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
                      {visibleAttendanceShifts.length === 0 && <p className="notice">{text.messages.noShifts}</p>}
                    </div>

                    <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canManageAttendance}>
                      <h4>{text.labels.weeklySchedule}</h4>
                      <div className="form-grid compact-form-grid">
                        <label>
                          {text.labels.staffMember}
                          <select value={shiftForm.staff_profile_id || firstStaffProfileId} onChange={(event) => setShiftForm({ ...shiftForm, staff_profile_id: event.target.value })}>
                            {visibleStaffProfileOptions.map((item) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                          </select>
                        </label>
                        <label>
                          {text.labels.shiftDate}
                          <StaffPickerField ariaLabel={text.labels.shiftDate} placeholder={text.chooseDate} type="date" value={shiftForm.shift_date} onChange={(value) => setShiftForm({ ...shiftForm, shift_date: value })} />
                        </label>
                        <label>
                          {text.labels.start}
                          <StaffPickerField ariaLabel={text.labels.start} placeholder={text.chooseTime} type="time" value={shiftForm.start_time} onChange={(value) => setShiftForm({ ...shiftForm, start_time: value })} />
                        </label>
                        <label>
                          {text.labels.end}
                          <StaffPickerField ariaLabel={text.labels.end} placeholder={text.chooseTime} type="time" value={shiftForm.end_time} onChange={(value) => setShiftForm({ ...shiftForm, end_time: value })} />
                        </label>
                        <label>{text.labels.breakMinutes}<input min={0} type="number" value={shiftForm.break_minutes} onChange={(event) => setShiftForm({ ...shiftForm, break_minutes: event.target.value })} /></label>
                        <label>{text.labels.location}<input value={shiftForm.location} onChange={(event) => setShiftForm({ ...shiftForm, location: event.target.value })} /></label>
                        <label>{text.labels.status}<select value={shiftForm.status} onChange={(event) => setShiftForm({ ...shiftForm, status: event.target.value as StaffShiftStatus })}>{staffShiftStatuses.map((status) => <option key={status} value={status}>{text.shiftStatuses[status]}</option>)}</select></label>
                        <label className="full">{text.labels.notes}<textarea value={shiftForm.notes} onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })} /></label>
                      </div>
                      <button className="primary" type="button" disabled={saving || !(shiftForm.staff_profile_id || firstStaffProfileId)} onClick={saveShift}>
                        <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveShift}</ButtonIconText>
                      </button>
                    </fieldset>
                  </div>
                </>
              )}

              {currentAttendanceTab === 'clock' && (
                <div className="staff-attendance-layout">
                  <div className="staff-attendance-list">
                    {visibleAttendanceLogs.map((log) => {
                      const staffProfile = profileById.get(log.staff_profile_id)
                      return (
                        <article className="staff-attendance-row" key={log.id}>
                          <div className="staff-attendance-person">
                            {staffProfile && <StaffRoleAvatar profile={staffProfile} text={text} />}
                            <div>
                              <strong>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</strong>
                              <span>{staffDateLabel(log.work_date)} · {timeValueFromIso(log.clock_in_at) || '--:--'}-{timeValueFromIso(log.clock_out_at) || '--:--'}</span>
                            </div>
                          </div>
                          <div className="staff-attendance-meta">
                            <span>{text.attendanceStatuses[log.status]}</span>
                            <span>{text.labels.workedHours}: {hoursLabel(minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes))}</span>
                            <span>{text.labels.overtimeHours}: {hoursLabel(log.overtime_minutes)}</span>
                            <span>{text.labels.nightHours}: {hoursLabel(log.night_minutes)}</span>
                          </div>
                          {canEditAttendance && (
                            <div className="staff-row-actions staff-attendance-row-actions">
                              <button type="button" onClick={() => editAttendanceLog(log)}>
                                <ButtonIconText icon={<Pencil aria-hidden="true" size={14} />}>{text.actions.edit}</ButtonIconText>
                              </button>
                            </div>
                          )}
                        </article>
                      )
                    })}
                    {visibleAttendanceLogs.length === 0 && <p className="notice">{text.messages.noAttendanceLogs}</p>}
                  </div>

                  <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canEditAttendance}>
                    <h4>{text.attendanceTabs.clock}</h4>
                    <div className="form-grid compact-form-grid">
                      <label>
                        {text.labels.staffMember}
                        <select value={attendanceLogForm.staff_profile_id || firstStaffProfileId} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, staff_profile_id: event.target.value })}>
                          {visibleStaffProfileOptions.map((item) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                        </select>
                      </label>
                      <label>
                        {text.labels.shiftList}
                        <select value={attendanceLogForm.shift_id} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, shift_id: event.target.value })}>
                          <option value="">{text.any}</option>
                          {visibleAttendanceShifts
                            .filter((shift) => !(attendanceLogForm.staff_profile_id || firstStaffProfileId) || shift.staff_profile_id === (attendanceLogForm.staff_profile_id || firstStaffProfileId))
                            .map((shift) => <option key={shift.id} value={shift.id}>{staffDateLabel(shift.shift_date)} · {normalizeTime(shift.start_time)}-{normalizeTime(shift.end_time)}</option>)}
                        </select>
                      </label>
                      <label>
                        {text.labels.attendanceDate}
                        <StaffPickerField ariaLabel={text.aria.attendanceDate} placeholder={text.chooseDate} type="date" value={attendanceLogForm.work_date} onChange={(value) => setAttendanceLogForm({ ...attendanceLogForm, work_date: value })} />
                      </label>
                      <label>
                        {text.labels.start}
                        <StaffPickerField ariaLabel={text.aria.clockIn} placeholder={text.chooseTime} type="time" value={attendanceLogForm.clock_in_time} onChange={(value) => setAttendanceLogForm({ ...attendanceLogForm, clock_in_time: value })} />
                      </label>
                      <label>
                        {text.labels.end}
                        <StaffPickerField ariaLabel={text.aria.clockOut} placeholder={text.chooseTime} type="time" value={attendanceLogForm.clock_out_time} onChange={(value) => setAttendanceLogForm({ ...attendanceLogForm, clock_out_time: value })} />
                      </label>
                      <label>{text.labels.breakMinutes}<input min={0} type="number" value={attendanceLogForm.break_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, break_minutes: event.target.value })} /></label>
                      <label>{text.labels.status}<select value={attendanceLogForm.status} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, status: event.target.value as StaffAttendanceStatus })}>{staffAttendanceStatuses.map((status) => <option key={status} value={status}>{text.attendanceStatuses[status]}</option>)}</select></label>
                      <label>{text.labels.regularHours}<input min={0} step="0.25" type="number" value={attendanceLogForm.regular_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, regular_minutes: event.target.value })} /></label>
                      <label>{text.labels.overtimeHours}<input min={0} step="0.25" type="number" value={attendanceLogForm.overtime_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, overtime_minutes: event.target.value })} /></label>
                      <label>{text.labels.nightHours}<input min={0} step="0.25" type="number" value={attendanceLogForm.night_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, night_minutes: event.target.value })} /></label>
                      <label>{text.labels.holidayHours}<input min={0} step="0.25" type="number" value={attendanceLogForm.holiday_minutes} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, holiday_minutes: event.target.value })} /></label>
                      <label className="full">{text.labels.managerNote}<textarea value={attendanceLogForm.manager_note} onChange={(event) => setAttendanceLogForm({ ...attendanceLogForm, manager_note: event.target.value })} /></label>
                    </div>
                    <button className="primary" type="button" disabled={saving || !(attendanceLogForm.staff_profile_id || firstStaffProfileId)} onClick={saveAttendanceLog}>
                      <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveAttendance}</ButtonIconText>
                    </button>
                  </fieldset>
                </div>
              )}

              {currentAttendanceTab === 'timesheet' && (
                <div className="staff-table-wrap">
                  <table className="staff-table staff-attendance-table">
                    <thead>
                      <tr>
                        <th>{text.labels.staffMember}</th>
                        <th>{text.labels.date}</th>
                        <th>{text.labels.status}</th>
                        <th>{text.labels.workedHours}</th>
                        <th>{text.labels.regularHours}</th>
                        <th>{text.labels.overtimeHours}</th>
                        <th>{text.labels.nightHours}</th>
                        <th>{text.labels.holidayHours}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAttendanceLogs.map((log) => {
                        const staffProfile = profileById.get(log.staff_profile_id)
                        return (
                          <tr key={log.id}>
                            <td>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</td>
                            <td>{staffDateLabel(log.work_date)}</td>
                            <td>{text.attendanceStatuses[log.status]}</td>
                            <td>{hoursLabel(minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes))}</td>
                            <td>{hoursLabel(log.regular_minutes)}</td>
                            <td>{hoursLabel(log.overtime_minutes)}</td>
                            <td>{hoursLabel(log.night_minutes)}</td>
                            <td>{hoursLabel(log.holiday_minutes)}</td>
                          </tr>
                        )
                      })}
                      {visibleAttendanceLogs.length === 0 && (
                        <tr>
                          <td colSpan={8}>{text.messages.noAttendanceLogs}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {currentAttendanceTab === 'leave' && (
                <div className="staff-attendance-layout">
                  <div className="staff-attendance-list">
                    {visibleLeaveRequests.map((leave) => {
                      const staffProfile = profileById.get(leave.staff_profile_id)
                      return (
                        <article className="staff-attendance-row" key={leave.id}>
                          <div className="staff-attendance-person">
                            {staffProfile && <StaffRoleAvatar profile={staffProfile} text={text} />}
                            <div>
                              <strong>{staffProfile ? customerName(staffProfile, text) : text.customerFallback}</strong>
                              <span>{staffDateLabel(leave.start_date)} - {staffDateLabel(leave.end_date)}</span>
                            </div>
                          </div>
                          <div className="staff-attendance-meta">
                            <span>{text.leaveTypes[leave.leave_type]}</span>
                            <span>{leave.hours}h</span>
                            <span>{text.leaveStatuses[leave.status]}</span>
                            {leave.reason && <span>{leave.reason}</span>}
                          </div>
                          <div className="staff-row-actions staff-attendance-row-actions">
                            {canEditAttendance && (
                              <button type="button" onClick={() => editLeaveRequest(leave)}>
                                <ButtonIconText icon={<Pencil aria-hidden="true" size={14} />}>{text.actions.edit}</ButtonIconText>
                              </button>
                            )}
                            {canManageAttendance && leave.status === 'requested' && (
                              <button type="button" onClick={() => updateLeaveStatus(leave, 'approved')}>
                                <ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.approve}</ButtonIconText>
                              </button>
                            )}
                            {canManageAttendance && leave.status === 'requested' && (
                              <button type="button" onClick={() => updateLeaveStatus(leave, 'rejected')}>
                                <ButtonIconText icon={<X aria-hidden="true" size={14} />}>{text.actions.reject}</ButtonIconText>
                              </button>
                            )}
                            {canEditAttendance && leave.status !== 'cancelled' && (
                              <button type="button" onClick={() => updateLeaveStatus(leave, 'cancelled')}>
                                <ButtonIconText icon={<Ban aria-hidden="true" size={14} />}>{text.actions.cancel}</ButtonIconText>
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    })}
                    {visibleLeaveRequests.length === 0 && <p className="notice">{text.messages.noLeaveRequests}</p>}
                  </div>

                  <fieldset className="staff-readonly-fieldset staff-attendance-form" disabled={!canEditAttendance}>
                    <h4>{text.attendanceTabs.leave}</h4>
                    <div className="form-grid compact-form-grid">
                      <label>
                        {text.labels.staffMember}
                        <select value={leaveForm.staff_profile_id || firstStaffProfileId} onChange={(event) => setLeaveForm({ ...leaveForm, staff_profile_id: event.target.value })}>
                          {visibleStaffProfileOptions.map((item) => <option key={item.id} value={item.id}>{customerName(item, text)}</option>)}
                        </select>
                      </label>
                      <label>{text.labels.leaveType}<select value={leaveForm.leave_type} onChange={(event) => setLeaveForm({ ...leaveForm, leave_type: event.target.value as StaffLeaveType })}>{staffLeaveTypes.map((type) => <option key={type} value={type}>{text.leaveTypes[type]}</option>)}</select></label>
                      <label>
                        {text.labels.startDate}
                        <StaffPickerField ariaLabel={text.aria.leaveStart} placeholder={text.chooseDate} type="date" value={leaveForm.start_date} onChange={(value) => setLeaveForm({ ...leaveForm, start_date: value })} />
                      </label>
                      <label>
                        {text.labels.endDate}
                        <StaffPickerField ariaLabel={text.aria.leaveEnd} placeholder={text.chooseDate} type="date" value={leaveForm.end_date} onChange={(value) => setLeaveForm({ ...leaveForm, end_date: value })} />
                      </label>
                      <label>{text.labels.hours}<input min={0} step="0.5" type="number" value={leaveForm.hours} onChange={(event) => setLeaveForm({ ...leaveForm, hours: event.target.value })} /></label>
                      <label className="full">{text.labels.deleteReason}<textarea value={leaveForm.reason} onChange={(event) => setLeaveForm({ ...leaveForm, reason: event.target.value })} /></label>
                    </div>
                    <button className="primary" type="button" disabled={saving || !(leaveForm.staff_profile_id || firstStaffProfileId)} onClick={submitLeaveRequest}>{text.actions.submitLeave}</button>
                  </fieldset>
                </div>
              )}

              {currentAttendanceTab === 'settings' && (
                <fieldset className="staff-readonly-fieldset staff-attendance-form staff-attendance-settings" disabled={!canManageAttendance}>
                  <h4>{text.attendanceTabs.settings}</h4>
                  <div className="form-grid compact-form-grid">
                    <label>{text.labels.location}<input value={attendanceSettings.location} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, location: event.target.value })} /></label>
                    <div className="staff-duration-field">
                      <span className="staff-label-line">
                        <span>{text.labels.standardDay}</span>
                        <small>{text.labels.standardDayHelp}</small>
                      </span>
                      <StaffPickerField
                        ariaLabel={text.labels.standardDay}
                        mode="duration"
                        placeholder="08:00"
                        type="time"
                        value={durationTimeValue(attendanceSettings.standard_daily_minutes)}
                        onChange={(value) => setAttendanceSettings({ ...attendanceSettings, standard_daily_minutes: parseMinutesTime(value) })}
                      />
                      <span className="staff-duration-presets" aria-label={text.labels.standardDayPresets}>
                        {['07:15', '08:00', '08:30'].map((preset) => (
                          <button
                            className={durationTimeValue(attendanceSettings.standard_daily_minutes) === preset ? 'active' : ''}
                            key={preset}
                            type="button"
                            onClick={() => setAttendanceSettings({ ...attendanceSettings, standard_daily_minutes: parseMinutesTime(preset) })}
                          >
                            {preset}
                          </button>
                        ))}
                      </span>
                    </div>
                    <label>{text.labels.standardWeek}<input min={0} step="0.25" type="number" value={attendanceSettings.standard_weekly_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, standard_weekly_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                    <label>{text.labels.standardBreakMinutes}<input min={0} step="1" type="number" value={attendanceSettings.standard_break_minutes} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, standard_break_minutes: Math.max(0, Math.round(Number(event.target.value) || 0)) })} /></label>
                    <label>{text.labels.overtimeMonthlyCap}<input min={0} step="0.25" type="number" value={attendanceSettings.overtime_monthly_cap_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_monthly_cap_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                    <label>{text.labels.overtimeYearlyCap}<input min={0} step="0.25" type="number" value={attendanceSettings.overtime_yearly_cap_minutes / 60} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, overtime_yearly_cap_minutes: Math.round((Number(event.target.value) || 0) * 60) })} /></label>
                    <label>
                      {text.aria.nightStart}
                      <StaffPickerField ariaLabel={text.aria.nightStart} placeholder={text.chooseTime} type="time" value={normalizeTime(attendanceSettings.night_start)} onChange={(value) => setAttendanceSettings({ ...attendanceSettings, night_start: value })} />
                    </label>
                    <label>
                      {text.aria.nightEnd}
                      <StaffPickerField ariaLabel={text.aria.nightEnd} placeholder={text.chooseTime} type="time" value={normalizeTime(attendanceSettings.night_end)} onChange={(value) => setAttendanceSettings({ ...attendanceSettings, night_end: value })} />
                    </label>
                    <label>{text.labels.annualLeaveDays}<input min={0} step="0.5" type="number" value={attendanceSettings.annual_leave_days} onChange={(event) => setAttendanceSettings({ ...attendanceSettings, annual_leave_days: Number(event.target.value) || 0 })} /></label>
                  </div>
                  <div className="staff-standard-shifts">
                    <strong>{text.labels.standardShiftTemplates}</strong>
                    {effectiveShiftTemplates.map((template) => (
                      <div className="staff-standard-shift-row" key={template.id}>
                        <strong>{text.shiftTemplates[template.id]}</strong>
                        <label>
                          {text.labels.start}
                          <StaffPickerField
                            ariaLabel={`${text.shiftTemplates[template.id]} ${text.labels.start}`}
                            placeholder={text.chooseTime}
                            type="time"
                            value={template.start_time}
                            onChange={(value) => updateAttendanceShiftTemplate(template.id, { start_time: value })}
                          />
                        </label>
                        <label>
                          {text.labels.end}
                          <StaffPickerField
                            ariaLabel={`${text.shiftTemplates[template.id]} ${text.labels.end}`}
                            placeholder={text.chooseTime}
                            type="time"
                            value={template.end_time}
                            onChange={(value) => updateAttendanceShiftTemplate(template.id, { end_time: value })}
                          />
                        </label>
                        <label>{text.labels.breakMinutes}<input min={0} step="1" type="number" value={template.break_minutes} onChange={(event) => updateAttendanceShiftTemplate(template.id, { break_minutes: event.target.value })} /></label>
                      </div>
                    ))}
                  </div>
                  <button className="primary" type="button" disabled={saving} onClick={saveAttendanceSettings}>
                    <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveRules}</ButtonIconText>
                  </button>
                </fieldset>
              )}
            </>
          )}
        </div>
      )}

      {currentTab === 'hr' && (
        <StaffHrHub
          model={{
            ButtonIconText,
            StaffPickerField,
            StaffRoleAvatar,
            approvePayrollRun,
            applyShiftTemplate,
            attendanceGridStyle,
            attendanceScheduleScopeOptions,
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
            roleLabel,
            saveEmployeeProfile,
            saveHrAdjustment,
            saveHrSettings,
            saveHrSetupOption,
            saveShift,
            saving,
            selectedEmployeeDocuments,
            selectedEmployeeOutstandingDebt,
            selectedEmployeeStaffId,
            selectedEmployeeStaffProfile,
            selectedShiftTemplate,
            setEmployeeForm,
            setAttendanceScheduleScope,
            setAttendanceRange,
            setDraggingShiftId,
            setHrAdjustmentForm,
            setHrDepartmentFilter,
            setHrSearch,
            setHrSettings,
            setHrSetupForm,
            setHrStatusFilter,
            setHrTab,
            setPayrollRunForm,
            setShiftForm,
            sharedText,
            shiftForm,
            shiftAttendanceRange,
            shortDateLabel,
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
            text,
            resetAttendanceRangeToThisWeek,
            updateHrAdjustmentStatus,
            updateShiftStatus,
            visibleAllStaffProfileOptions,
            visibleAttendanceShifts,
            visibleScheduleAttendanceShifts,
            visibleScheduleStaffProfileOptions,
            visibleStaffProfileOptions,
            copyPreviousAttendanceWeek,
            moveShiftToCell,
            publishAttendanceWeek,
          }}
        />
      )}

      {currentTab === 'games' && (
        <div className="staff-grid">
          <div className="staff-card">
            <h3>{gameForm.id ? text.editGame : text.labels.createGame}</h3>
            {!canManageConfig && <p className="staff-readonly-note">{text.messages.readOnlyGames}</p>}
            <fieldset className="staff-readonly-fieldset" disabled={!canManageConfig}>
            <div className="form-grid compact-form-grid">
              <label>{text.labels.name}<input value={gameForm.name} onChange={(event) => setGameForm({ ...gameForm, name: event.target.value })} /></label>
              <label>{text.labels.slug}<input value={gameForm.slug} onChange={(event) => setGameForm({ ...gameForm, slug: event.target.value })} /></label>
              <label>{text.labels.type}<select value={gameForm.game_type} onChange={(event) => setGameForm({ ...gameForm, game_type: event.target.value as StaffGame['game_type'] })}>{gameTypes.map((type) => <option key={type} value={type}>{text.gameTypes[type]}</option>)}</select></label>
              <label>{text.labels.duration}<input type="number" value={gameForm.duration_minutes} onChange={(event) => setGameForm({ ...gameForm, duration_minutes: Number(event.target.value) })} /></label>
              <label>{text.labels.maxPlayersArena}<input type="number" value={gameForm.max_players_per_arena} onChange={(event) => setGameForm({ ...gameForm, max_players_per_arena: Number(event.target.value) })} /></label>
              <label>{text.labels.rounds}<input type="number" value={gameForm.number_of_rounds} onChange={(event) => setGameForm({ ...gameForm, number_of_rounds: Number(event.target.value) })} /></label>
              {gameForm.game_type === 'escape' && (
                <label>{text.labels.escapeChapters}<input min={1} max={50} type="number" value={gameForm.escape_chapter_count} onChange={(event) => setGameForm({ ...gameForm, escape_chapter_count: Number(event.target.value) })} /></label>
              )}
              <div className="full staff-game-media-row">
                <div className="staff-game-photo-field">
                  <span className="staff-field-label">{text.labels.gamePhoto}</span>
                  <label className={gameForm.image_url ? 'staff-game-photo-upload has-image' : 'staff-game-photo-upload'}>
                    {gameForm.image_url ? (
                      <span
                        aria-hidden="true"
                        className="staff-game-photo-preview"
                        style={{ backgroundImage: `url(${gameForm.image_url})` }}
                      />
                    ) : (
                      <span>
                        <strong>{text.messages.clickUploadGamePhoto}</strong>
                        <small>{text.gamePhotoHelp}</small>
                      </span>
                    )}
                    {gameImageUploading && <em>{text.messages.uploadGamePhoto}</em>}
                    <input
                      accept={staffGameImageTypes.join(',')}
                      disabled={gameImageUploading}
                      type="file"
                      onChange={handleGameImageUpload}
                    />
                  </label>
                </div>
                <div className="staff-game-settings-panel">
                  <div>
                    <span className="staff-field-label">{text.labels.audience}</span>
                    <details className="staff-audience-menu">
                      <summary className="staff-audience-summary">
                        <span className="staff-audience-value">
                          {selectedGameAudiences.length ? (
                            selectedGameAudiences.map((audience) => (
                              <span className="staff-audience-chip" key={audience}>{text.audienceOptions[audience]}</span>
                            ))
                          ) : (
                            <span className="staff-audience-placeholder">{text.any}</span>
                          )}
                        </span>
                      </summary>
                      <div className="staff-audience-dropdown">
                        {staffAudienceOptions.map((audience) => {
                          const checked = selectedGameAudiences.includes(audience)
                          return (
                            <label className="staff-audience-option" key={audience}>
                              <input
                                checked={checked}
                                type="checkbox"
                                onChange={(event) => updateGameAudience(audience, event.target.checked)}
                              />
                              <span>{text.audienceOptions[audience]}</span>
                            </label>
                          )
                        })}
                      </div>
                    </details>
                  </div>
                  <div>
                    <span className="staff-field-label">{text.labels.arenaIds}</span>
                    <div className="staff-arena-options">
                      {staffArenaOptions.map((arena) => {
                        const checked = selectedGameArenaIds.includes(arena.id)
                        return (
                          <label className="staff-arena-option" key={arena.id}>
                            <input
                              checked={checked}
                              disabled={checked && selectedGameArenaIds.length <= 1}
                              type="checkbox"
                              onChange={(event) => updateGameArena(arena.id, event.target.checked)}
                            />
                            <span>{arena.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <label className="checkbox-row staff-game-active-toggle">
                    <input type="checkbox" checked={gameForm.active} onChange={(event) => setGameForm({ ...gameForm, active: event.target.checked })} />
                    <span>{text.labels.active}</span>
                  </label>
                </div>
              </div>
              <div className="full staff-game-guide-editor">
                <div className="staff-game-guide-head">
                  <div>
                    <span className="staff-field-label">{text.labels.guideSummary}</span>
                    <small>{text.messages.gameGuideHelp}</small>
                  </div>
                  <label>
                    <span>{text.labels.guideLanguage}</span>
                    <select
                      value={gameForm.guide_language}
                      onChange={(event) => setGameForm({ ...gameForm, guide_language: normalizeGuideLanguage(event.target.value) })}
                    >
                      {languageOptions.map((language) => (
                        <option key={language} value={language}>{language.toUpperCase()}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="staff-game-guide-fields">
                  <label>
                    <span>{text.labels.guideSummary}</span>
                    <textarea
                      value={guideTextValue(gameForm.guide_summary, gameForm.guide_language)}
                      onChange={(event) => updateGameGuideText('guide_summary', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{text.labels.guideGameplay}</span>
                    <textarea
                      value={guideTextValue(gameForm.guide_rules, gameForm.guide_language)}
                      onChange={(event) => updateGameGuideText('guide_rules', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>{text.labels.guideTips}</span>
                    <textarea
                      value={guideTextValue(gameForm.guide_tips, gameForm.guide_language)}
                      onChange={(event) => updateGameGuideText('guide_tips', event.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>
            <button className="primary" type="button" disabled={saving || !gameForm.name.trim()} onClick={saveGame}>
              <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveGame}</ButtonIconText>
            </button>
            </fieldset>
          </div>
          <div className="staff-card">
            <div className="staff-list-head">
              <h3>{text.labels.games}</h3>
              {canManageConfig && <button type="button" onClick={startNewGame}>{text.actions.newGame}</button>}
            </div>
            {games.map((game) => (
              <button className="staff-list-item" key={game.id} type="button" onClick={() => editGame(game)}>
                <strong>{game.name}</strong>
                <span>
                  {[
                    text.gameTypes[game.game_type],
                    `${game.duration_minutes} min`,
                    staffAudienceLabel(game.audience, game.difficulty, text),
                    game.active ? text.active : text.inactive,
                  ].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentTab === 'prices' && (
        <div className="staff-grid">
          <div className="staff-card">
            <h3>{priceForm.id ? text.editPriceRule : text.labels.createPriceRule}</h3>
            {!canManageConfig && <p className="staff-readonly-note">{text.messages.readOnlyPrices}</p>}
            <fieldset className="staff-readonly-fieldset" disabled={!canManageConfig}>
            <div className="form-grid compact-form-grid">
              <label>{text.labels.ruleName}<input value={priceForm.rule_name} onChange={(event) => setPriceForm({ ...priceForm, rule_name: event.target.value })} /></label>
              <label>{text.labels.game}<select value={priceForm.game_id} onChange={(event) => setPriceForm({ ...priceForm, game_id: event.target.value })}><option value="">{text.allGames}</option>{games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
              <label>{text.labels.dayType}<select value={priceForm.day_type} onChange={(event) => setPriceForm({ ...priceForm, day_type: event.target.value as StaffPriceRule['day_type'] })}>{dayTypes.map((type) => <option key={type} value={type}>{text.dayTypes[type]}</option>)}</select></label>
              <label>{text.labels.start}<StaffPickerField ariaLabel={text.aria.priceStartTime} placeholder={text.chooseTime} type="time" value={priceForm.time_start} onChange={(value) => setPriceForm({ ...priceForm, time_start: value })} /></label>
              <label>{text.labels.end}<StaffPickerField ariaLabel={text.aria.priceEndTime} placeholder={text.chooseTime} type="time" value={priceForm.time_end} onChange={(value) => setPriceForm({ ...priceForm, time_end: value })} /></label>
              <label>{text.labels.pricePlayer}<input inputMode="numeric" value={formatDongInput(priceForm.price_per_player)} onChange={(event) => setPriceForm({ ...priceForm, price_per_player: dongDigits(event.target.value) })} /></label>
              <label>{text.labels.priceArenaSlot}<input inputMode="numeric" value={formatDongInput(priceForm.price_per_arena_slot)} onChange={(event) => setPriceForm({ ...priceForm, price_per_arena_slot: dongDigits(event.target.value) })} /></label>
              <label>{text.labels.validFrom}<StaffPickerField ariaLabel={text.aria.priceValidFrom} placeholder={text.chooseDate} type="date" value={priceForm.valid_from} onChange={(value) => setPriceForm({ ...priceForm, valid_from: value })} /></label>
              <label className="staff-valid-until-field">
                <span className="staff-label-line"><span>{text.labels.validUntil}</span><small>{text.labels.validUntilHelp}</small></span>
                <StaffPickerField ariaLabel={text.aria.priceValidUntil} placeholder={text.chooseDate} type="date" value={priceForm.valid_until} onChange={(value) => setPriceForm({ ...priceForm, valid_until: value })} />
              </label>
              <label className="checkbox-row"><input type="checkbox" checked={priceForm.active} onChange={(event) => setPriceForm({ ...priceForm, active: event.target.checked })} /> {text.labels.active}</label>
            </div>
            <button className="primary" type="button" disabled={saving || !priceForm.rule_name.trim()} onClick={savePrice}>
              <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.savePrice}</ButtonIconText>
            </button>
            </fieldset>
          </div>
          <div className="staff-card">
            <h3>{text.labels.priceRules}</h3>
            {prices.map((rule) => (
              <button className="staff-list-item" key={rule.id} type="button" onClick={() => editPrice(rule)}>
                <strong>{rule.rule_name}</strong>
                <span>{text.dayTypes[rule.day_type]} · {normalizeTime(rule.time_start) || text.any}-{normalizeTime(rule.time_end) || text.any} · {formatVnd(rule.price_per_player)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentTab === 'discounts' && (
        <div className="staff-grid">
          <div className="staff-card">
            {!canEditCommerceTab && <p className="staff-readonly-note">{text.messages.readOnlyCommerce}</p>}
            {commerceTab === 'loyalty' ? (
              <>
                <h3>{loyaltyForm.id ? text.editLoyaltyRule : text.labels.createLoyaltyRule}</h3>
                <p className="muted">{text.messages.loyaltyIntro}</p>
                <fieldset className="staff-readonly-fieldset" disabled={!canEditCommerceTab}>
                <div className="form-grid compact-form-grid">
                  <label>{text.labels.ruleName}<input value={loyaltyForm.rule_name} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, rule_name: event.target.value })} /></label>
                  <label>{text.labels.game}<select value={loyaltyForm.game_id} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, game_id: event.target.value })}><option value="">{text.allGames}</option>{games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
                  <label>{text.labels.calculation}<select value={loyaltyForm.calculation_type} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, calculation_type: event.target.value as StaffLoyaltyRule['calculation_type'] })}>{loyaltyCalculationTypes.map((type) => <option key={type} value={type}>{loyaltyCalculationLabel(type, text)}</option>)}</select></label>
                  <label>{text.labels.pointsEarned}<input min={0} step="0.01" type="number" value={loyaltyForm.points_value} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, points_value: Number(event.target.value) })} /></label>
                  <label>{text.labels.perVndSpent}<input disabled={loyaltyForm.calculation_type !== 'per_vnd_spent'} min={0} type="number" value={loyaltyForm.spend_amount} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, spend_amount: Number(event.target.value) })} /></label>
                  <label>{text.labels.minimumSpend}<input min={0} type="number" value={loyaltyForm.min_order_total} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, min_order_total: Number(event.target.value) })} /></label>
                  <label>{text.labels.redeemValue}<input min={0} type="number" value={loyaltyForm.redeem_value_vnd_per_point} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, redeem_value_vnd_per_point: Number(event.target.value) })} /></label>
                  <label>{text.labels.pointsExpireAfterDays}<input min={1} type="number" value={loyaltyForm.point_expiry_days} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, point_expiry_days: event.target.value })} /></label>
                  <label>{text.labels.validFrom}<StaffPickerField ariaLabel={text.aria.loyaltyValidFrom} placeholder={text.chooseDate} type="date" value={loyaltyForm.valid_from} onChange={(value) => setLoyaltyForm({ ...loyaltyForm, valid_from: value })} /></label>
                  <label>{text.labels.validUntil}<StaffPickerField ariaLabel={text.aria.loyaltyValidUntil} placeholder={text.chooseDate} type="date" value={loyaltyForm.valid_until} onChange={(value) => setLoyaltyForm({ ...loyaltyForm, valid_until: value })} /></label>
                  <label className="full">{text.labels.notes}<textarea value={loyaltyForm.notes} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, notes: event.target.value })} /></label>
                  <label className="checkbox-row"><input type="checkbox" checked={loyaltyForm.active} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, active: event.target.checked })} /> {text.labels.active}</label>
                </div>
                <button className="primary" type="button" disabled={saving || !loyaltyForm.rule_name.trim()} onClick={saveLoyaltyRule}>
                  <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveLoyaltyRule}</ButtonIconText>
                </button>
                </fieldset>
              </>
            ) : (
              <>
                <h3>
                  {discountForm.id
                    ? (commerceTab === 'vouchers' ? text.editVoucher : text.editDiscount)
                    : (commerceTab === 'vouchers' ? text.labels.createVoucher : text.labels.createDiscount)}
                </h3>
                <p className="muted">{text.labels.discountRuleHelp}</p>
                <fieldset className="staff-readonly-fieldset" disabled={!canEditCommerceTab}>
                <div className="form-grid compact-form-grid">
                  <label>{commerceTab === 'vouchers' ? text.labels.voucherCodeRequired : text.labels.codeOptional}<input value={discountForm.code} onChange={(event) => setDiscountForm({ ...discountForm, code: event.target.value.toUpperCase() })} /></label>
                  <label>{text.labels.name}<input value={discountForm.name} onChange={(event) => setDiscountForm({ ...discountForm, name: event.target.value })} /></label>
                  <label>{text.labels.game}<select value={discountForm.game_id} onChange={(event) => setDiscountForm({ ...discountForm, game_id: event.target.value })}><option value="">{text.allGames}</option>{games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
                  <label>{text.labels.priceRule}<select value={discountForm.price_rule_id} onChange={(event) => setDiscountForm({ ...discountForm, price_rule_id: event.target.value })}><option value="">{text.allPriceRules}</option>{prices.map((rule) => <option key={rule.id} value={rule.id}>{rule.rule_name}</option>)}</select></label>
                  <label>{text.labels.type}<select value={discountForm.discount_type} onChange={(event) => updateDiscountType(event.target.value as StaffDiscount['discount_type'])}>{discountTypes.map((type) => <option key={type} value={type}>{text.discountTypes[type]}</option>)}</select></label>
                  <label className="staff-discount-value-field">
                    <span className="staff-label-line">
                      <span>{text.labels.value}</span>
                      <small>{formatDiscountRuleValue(discountForm, text)}</small>
                    </span>
                    <span className="staff-discount-value-control">
                      <input
                        disabled={discountForm.discount_type === 'free_ticket'}
                        inputMode={selectedDiscountValueUnit === 'fixed_amount' ? 'numeric' : 'decimal'}
                        max={selectedDiscountValueUnit === 'percentage' ? 100 : undefined}
                        min={0}
                        placeholder={selectedDiscountValueUnit === 'fixed_amount' ? '0 đ' : '%'}
                        value={discountForm.discount_type === 'free_ticket'
                          ? text.discountTypes.free_ticket
                          : selectedDiscountValueUnit === 'fixed_amount'
                            ? formatDongInput(discountForm.value)
                            : formatPercentInput(discountForm.value)}
                        onChange={(event) => updateDiscountValue(event.target.value)}
                      />
                      <select
                        aria-label={text.aria.discountValueUnit}
                        disabled={discountForm.discount_type === 'free_ticket'}
                        value={selectedDiscountValueUnit}
                        onChange={(event) => updateDiscountValueUnit(event.target.value as StaffDiscountValueUnit)}
                      >
                        <option value="percentage">%</option>
                        <option value="fixed_amount">VND</option>
                      </select>
                    </span>
                  </label>
                  <div className="full staff-form-section-label">{text.labels.discountConditions}</div>
                  <label>{text.labels.minPlayers}<input min={1} type="number" value={discountForm.min_players} onChange={(event) => setDiscountForm({ ...discountForm, min_players: event.target.value })} /></label>
                  <label>{text.labels.maxPlayers}<input min={1} type="number" value={discountForm.max_players} onChange={(event) => setDiscountForm({ ...discountForm, max_players: event.target.value })} /></label>
                  <label>{text.labels.dayType}<select value={discountForm.day_scope} onChange={(event) => setDiscountForm({ ...discountForm, day_scope: event.target.value as StaffDiscountDayScope })}>{staffDiscountDayScopes.map((scope) => <option key={scope} value={scope}>{text.discountDayScopes[scope]}</option>)}</select></label>
                  <label>{text.labels.ticketType}<select value={discountForm.ticket_type} onChange={(event) => setDiscountForm({ ...discountForm, ticket_type: event.target.value as StaffDiscountTicketType })}>{staffDiscountTicketTypes.map((ticketType) => <option key={ticketType} value={ticketType}>{text.discountTicketTypes[ticketType]}</option>)}</select></label>
                  <label className="checkbox-row full">
                    <input
                      checked={discountHasHourLimit}
                      type="checkbox"
                      onChange={(event) => setDiscountForm({
                        ...discountForm,
                        time_start: event.target.checked ? (discountForm.time_start || '09:00') : '',
                        time_end: event.target.checked ? (discountForm.time_end || '22:00') : '',
                      })}
                    />
                    {text.labels.limitByHour}
                  </label>
                  {discountHasHourLimit && (
                    <>
                      <label>{text.labels.start}<StaffPickerField ariaLabel={text.aria.discountStartTime} placeholder={text.chooseTime} type="time" value={discountForm.time_start} onChange={(value) => setDiscountForm({ ...discountForm, time_start: value })} /></label>
                      <label>{text.labels.end}<StaffPickerField ariaLabel={text.aria.discountEndTime} placeholder={text.chooseTime} type="time" value={discountForm.time_end} onChange={(value) => setDiscountForm({ ...discountForm, time_end: value })} /></label>
                    </>
                  )}
                  <label>{text.labels.minimumSpend}<input min={0} type="number" value={discountForm.min_order_total} onChange={(event) => setDiscountForm({ ...discountForm, min_order_total: Number(event.target.value) || 0 })} /></label>
                  <label>{text.labels.maxDiscountAmount}<input min={0} type="number" value={discountForm.max_discount_amount} onChange={(event) => setDiscountForm({ ...discountForm, max_discount_amount: event.target.value })} /></label>
                  <label>{text.labels.perCustomerLimit}<input min={1} type="number" value={discountForm.per_customer_limit} onChange={(event) => setDiscountForm({ ...discountForm, per_customer_limit: event.target.value })} /></label>
                  <label>{text.labels.validFrom}<StaffPickerField ariaLabel={text.aria.discountValidFrom} placeholder={text.chooseDate} type="date" value={discountForm.valid_from} onChange={(value) => setDiscountForm({ ...discountForm, valid_from: value })} /></label>
                  <label>{text.labels.validUntil}<StaffPickerField ariaLabel={text.aria.discountValidUntil} placeholder={text.chooseDate} type="date" value={discountForm.valid_until} onChange={(value) => setDiscountForm({ ...discountForm, valid_until: value })} /></label>
                  <label>{text.labels.maxUses}<input type="number" value={discountForm.max_uses} onChange={(event) => setDiscountForm({ ...discountForm, max_uses: event.target.value })} /></label>
                  <label className="checkbox-row"><input type="checkbox" checked={discountForm.active} onChange={(event) => setDiscountForm({ ...discountForm, active: event.target.checked })} /> {text.labels.active}</label>
                </div>
                <button className="primary" type="button" disabled={saving || !discountForm.name.trim()} onClick={saveDiscount}>
                  <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{commerceTab === 'vouchers' ? text.actions.saveVoucher : text.actions.saveDiscount}</ButtonIconText>
                </button>
                </fieldset>
              </>
            )}
          </div>
          <div className="staff-card">
            <div className="staff-commerce-switcher" role="tablist" aria-label={text.tabs.discounts}>
              {staffCommerceTabs.map((item) => (
                <button
                  aria-selected={commerceTab === item}
                  className={commerceTab === item ? 'active' : ''}
                  key={item}
                  role="tab"
                  type="button"
                  onClick={() => openCommerceTab(item)}
                >
                  {text.commerceTabs[item]}
                </button>
              ))}
            </div>

            {commerceTab === 'loyalty' ? (
              <>
                <h3>{text.commerceTabs.loyalty}</h3>
                {loyaltyRules.map((rule) => (
                  <button className="staff-list-item" key={rule.id} type="button" onClick={() => editLoyaltyRule(rule)}>
                    <strong>{rule.rule_name}</strong>
                    <span>
                      {loyaltyCalculationLabel(rule.calculation_type, text)}
                      {' · '}
                      {rule.points_value} pts
                      {rule.calculation_type === 'per_vnd_spent' ? ` / ${formatVnd(rule.spend_amount)}` : ''}
                      {' · '}
                      {text.labels.redeemValue} {formatVnd(rule.redeem_value_vnd_per_point ?? 0)}
                      {' · '}
                      {rule.point_expiry_days ? `${rule.point_expiry_days} ${text.days}` : text.noExpiry}
                      {' · '}
                      {rule.active ? text.active : text.inactive}
                    </span>
                  </button>
                ))}
                {loyaltyRules.length === 0 && <p className="notice">{text.messages.noLoyaltyRules}</p>}
              </>
            ) : (
              <>
                <h3>{commerceTab === 'vouchers' ? text.labels.vouchers : text.labels.discounts}</h3>
                {(commerceTab === 'vouchers' ? voucherRules : discountRules).map((discount) => (
                  <button className="staff-list-item" key={discount.id} type="button" onClick={() => editDiscount(discount)}>
                    <strong>{discount.code ? `${discount.code} · ${discount.name}` : discount.name}</strong>
                    <span>{text.discountTypes[discount.discount_type]} · {formatDiscountRuleValue(discount, text)} · {formatDiscountRuleConditions(discount, discount.game_id ? gameNameById.get(discount.game_id) || text.gameFallback : text.allGames, discount.price_rule_id ? priceRuleNameById.get(discount.price_rule_id) || text.labels.priceRule : text.allPriceRules, text)} · {text.labels.used} {discount.used_count}{discount.max_uses ? `/${discount.max_uses}` : ''}</span>
                  </button>
                ))}
                {commerceTab === 'vouchers' && voucherRules.length === 0 && <p className="notice">{text.messages.noVouchers}</p>}
                {commerceTab === 'discounts' && discountRules.length === 0 && <p className="notice">{text.messages.noDiscounts}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {currentTab === 'clientProfile' && (canCreateCustomerAccounts || canAwardAchievements) && (
        <div className="staff-card staff-card-wide">
          <div className="staff-card-heading">
            <h3>{canAwardAchievements ? text.labels.awardAchievement : text.labels.createCustomerAccount}</h3>
          </div>
          {canAwardAchievements && (
            <StaffAchievementAwardPanel
              awards={achievementAwards}
              canOpenProfiles={canOpenRoleProfiles}
              isSaving={isAchievementAwardSaving}
              note={achievementAwardNote}
              onAward={awardAchievementToPlayer}
              onAchievementChange={setAchievementAwardId}
              onNoteChange={setAchievementAwardNote}
              onOpenProfile={onOpenPlayerProfile}
              onProfileChange={setAchievementAwardProfileId}
              profiles={awardableProfiles}
              selectedAchievementId={achievementAwardId}
              selectedProfileId={achievementAwardProfileId || awardableProfiles[0]?.id || ''}
              status={achievementAwardStatus}
              text={{
                alreadyAwarded: text.messages.achievementAlreadyAwarded,
                awardAchievement: text.labels.awardAchievement,
                awardAchievementHelp: text.labels.awardAchievementHelp,
                awardNote: text.labels.awardNote,
                awardToPlayer: text.labels.awardToPlayer,
                chooseAchievement: text.labels.chooseAchievement,
                choosePlayer: text.labels.choosePlayer,
                grantedAwards: text.labels.grantedAwards,
                noAwardsYet: text.labels.noAwardsYet,
                noPlayersFound: text.labels.noPlayersFound,
                optional: text.labels.optional,
                searchPlayers: text.labels.searchUsers,
                sendAward: text.labels.sendAward,
              }}
            />
          )}
          {canCreateCustomerAccounts && (
          <div className="staff-customer-invite-panel">
            <div className="staff-customer-invite-copy">
              <strong>{text.labels.createCustomerAccount}</strong>
              <span>{text.labels.customerAccountHelp}</span>
            </div>
            <div className="staff-customer-invite-form">
              <label>
                <span className="staff-field-label">{text.labels.name}</span>
                <input
                  autoComplete="name"
                  value={customerInviteForm.fullName}
                  onChange={(event) => setCustomerInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Nguyen Van A"
                />
              </label>
              <label>
                <span className="staff-field-label">{text.labels.email}</span>
                <input
                  autoComplete="email"
                  type="email"
                  value={customerInviteForm.email}
                  onChange={(event) => setCustomerInviteForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="customer@example.com"
                />
              </label>
              <label>
                <span className="staff-field-label">{text.labels.phone}</span>
                <PhoneNumberInput
                  buttonLabel={sharedText.countryCode}
                  className="staff-phone-control"
                  inputLabel={text.labels.phone}
                  onChange={(phone) => setCustomerInviteForm((current) => ({ ...current, phone }))}
                  searchPlaceholder={sharedText.searchCountry}
                  value={customerInviteForm.phone}
                />
              </label>
              <label>
                <span className="staff-field-label">{text.labels.nickname}</span>
                <input
                  value={customerInviteForm.nickname}
                  onChange={(event) => setCustomerInviteForm((current) => ({ ...current, nickname: event.target.value }))}
                  placeholder="Phantom"
                />
              </label>
              <button
                className={isCustomerInviteSaving ? 'primary loading' : 'primary'}
                disabled={isCustomerInviteSaving}
                type="button"
                onClick={createCustomerAccount}
              >
                {text.actions.sendPasswordRequest}
              </button>
            </div>
            {customerInviteStatus && <p className="notice compact-notice">{customerInviteStatus}</p>}
          </div>
          )}
        </div>
      )}

      {currentTab === 'roles' && (
        <div className="staff-card staff-card-wide">
          <div className="staff-card-heading">
            <h3>{text.labels.roles}</h3>
            <button className="staff-link-button" type="button" onClick={() => setRoleHelpOpen(true)}>
              <ButtonIconText icon={<Info aria-hidden="true" size={14} />}>{text.labels.roleExplanation}</ButtonIconText>
            </button>
          </div>
          <div className="staff-role-tools">
            <label>
              <span className="staff-field-label">{text.labels.searchUsers}</span>
              <input
                value={roleSearch}
                onChange={(event) => setRoleSearch(event.target.value)}
                placeholder={`${text.labels.name}, ${text.labels.email}, ${text.labels.phone}`}
              />
            </label>
            <label>
              <span className="staff-field-label">{text.labels.filterByRole}</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as StaffRole | 'all')}>
                {roleFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? text.allRoles : staffRoleName(option, text)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="staff-field-label">{text.labels.sortBy}</span>
              <select value={roleSort} onChange={(event) => setRoleSort(event.target.value as StaffRoleSort)}>
                {roleSortOptions.map((option) => (
                  <option key={option} value={option}>
                    {staffRoleSortName(option, text)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="staff-role-list">
            {filteredRoleProfiles.map((item) => {
              const effectiveRole = roleLabel(item.role, item.email)
              const storedRole = storedRoleValue(item.role, item.email)
              const selectedRole = pendingRoleChanges[item.id] || storedRole
              const hasPendingRoleChange = selectedRole !== storedRole
              const protectedEmail = isAdminEmail(item.email)
              const rowFeedback = roleSaveFeedback[item.id]
              const rolePersonContent = (
                <>
                  <StaffRoleAvatar profile={item} text={text} />
                  <span className="staff-role-person-text">
                    <strong>{customerName(item, text)}</strong>
                    <span>{item.email || item.phone || text.noContact} · {text.labels.current} {staffRoleName(effectiveRole, text)}</span>
                    {protectedEmail && <small>{text.emailOverrideKeepsAdmin}</small>}
                  </span>
                </>
              )
              return (
                <div className="staff-role-row" key={item.id}>
                  {canOpenRoleProfiles ? (
                    <button
                      aria-label={`Open ${customerName(item, text)} player card`}
                      className="staff-role-person"
                      type="button"
                      onClick={() => onOpenPlayerProfile?.(item)}
                    >
                      {rolePersonContent}
                    </button>
                  ) : (
                    <div className="staff-role-person">
                      {rolePersonContent}
                    </div>
                  )}
                  <div className="staff-role-action-cell">
                    <div className="staff-role-primary-actions">
                      <select
                        aria-label={`${text.labels.roleFor} ${customerName(item, text)}`}
                        disabled={!canManageRoles || saving}
                        value={selectedRole}
                        onChange={(event) => stageProfileRole(item.id, storedRole, event.target.value as StaffRole)}
                      >
                        {staffRoleOptions.filter((option) => (
                          canRestoreDeleted || option !== 'owner' || option === storedRole
                        )).map((option) => (
                          <option key={option} value={option}>{staffRoleName(option, text)}</option>
                        ))}
                      </select>
                      {canDeleteProfileAccount(item) && (
                        <button
                          className="danger small-button staff-role-delete-button"
                          disabled={saving}
                          type="button"
                          onClick={() => openProfileDeleteDialog(item)}
                        >
                          <ButtonIconText icon={<Trash2 aria-hidden="true" size={14} />}>{text.actions.deleteAccount}</ButtonIconText>
                        </button>
                      )}
                    </div>
                    {hasPendingRoleChange && (
                      <div className="staff-role-actions">
                        <button
                          className="primary"
                          disabled={!canManageRoles || saving}
                          type="button"
                          onClick={() => updateProfileRole(item.id, selectedRole)}
                        >
                          <ButtonIconText icon={<Save aria-hidden="true" size={14} />}>{text.actions.saveRole}</ButtonIconText>
                        </button>
                        <button
                          className="secondary"
                          disabled={saving}
                          type="button"
                          onClick={() => clearStagedProfileRole(item.id)}
                        >
                          <ButtonIconText icon={<X aria-hidden="true" size={14} />}>{text.actions.cancel}</ButtonIconText>
                        </button>
                      </div>
                    )}
                    {rowFeedback && (
                      <small className={`staff-role-feedback ${rowFeedback.tone}`}>
                        {rowFeedback.message}
                      </small>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredRoleProfiles.length === 0 && <p className="notice">{text.noUsersFound}</p>}
          </div>
        </div>
      )}

      {currentTab === 'restore' && canRestoreDeleted && (
        <div className="staff-card staff-card-wide">
          <h3>{text.labels.restoreDeletedRecords}</h3>
          <p className="muted">{text.messages.restoreIntro}</p>
          <div className="staff-restore-list">
            {deletedRecords.map((record) => (
              <div className="staff-restore-row" key={`${record.entity_table}-${record.entity_id}`}>
                <div>
                  <strong>{record.label || record.entity_id}</strong>
                  <span>{record.entity_table} · {staffDateLabel(record.deleted_at.slice(0, 10))}</span>
                  {record.delete_reason && <small>{record.delete_reason}</small>}
                </div>
                <button className="secondary" disabled={saving} type="button" onClick={() => restoreDeletedRecord(record)}>
                  <ButtonIconText icon={<RotateCcw aria-hidden="true" size={15} />}>{text.actions.restore}</ButtonIconText>
                </button>
              </div>
            ))}
            {deletedRecords.length === 0 && <p className="notice">{text.messages.noSoftDeleted}</p>}
          </div>
        </div>
      )}

      {currentTab === 'orders' && (
        <div className="staff-card">
          <h3>{text.labels.orders}</h3>
          {orderRows(orders)}
        </div>
      )}

      {currentTab === 'report' && (
        <div className="staff-card">
          <div className="staff-report-head">
            <h3>{text.tabs.report}</h3>
            <div className="staff-report-filters">
              <div className="staff-report-filter-row">
                <div className="staff-report-date-actions" aria-label={text.labels.reportRange}>
                  <button type="button" onClick={() => {
                    const [from, to] = reportPresetRange('today')
                    setReportStart(from)
                    setReportEnd(to)
                  }}>
                    <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>{text.actions.today}</ButtonIconText>
                  </button>
                  <button type="button" onClick={() => {
                    const [from, to] = reportPresetRange('yesterday')
                    setReportStart(from)
                    setReportEnd(to)
                  }}>
                    <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>{text.actions.yesterday}</ButtonIconText>
                  </button>
                  <button className="staff-report-range-button" type="button" onClick={() => {
                    setReportDatePickerTarget('report')
                    setReportDatePickerOpen(true)
                  }}>
                    <span><CalendarRange aria-hidden="true" size={14} /> {text.labels.dateRange}</span>
                    <strong>{rangeLabel(reportStart, reportEnd)}</strong>
                  </button>
                </div>
                <div className="staff-report-compare-actions" aria-label={text.labels.compareRange}>
                  <button type="button" onClick={applyPreviousPeriodComparison}>
                    <ButtonIconText icon={<RotateCcw aria-hidden="true" size={14} />}>{text.actions.previousPeriod}</ButtonIconText>
                  </button>
                  <label className={compareEnabled ? 'staff-compare-toggle active' : 'staff-compare-toggle'}>
                    <input type="checkbox" checked={compareEnabled} onChange={(event) => setCompareEnabled(event.target.checked)} />
                    <span className="staff-compare-switch" aria-hidden="true" />
                    <span>{text.labels.compare}</span>
                  </label>
                </div>
                <div className="staff-report-export-actions">
                  <button type="button" onClick={exportExcelReport}>
                    <ButtonIconText icon={<FileSpreadsheet aria-hidden="true" size={14} />}>{text.actions.excel}</ButtonIconText>
                  </button>
                  <button type="button" onClick={exportPdfReport}>
                    <ButtonIconText icon={<FileText aria-hidden="true" size={14} />}>{text.actions.pdf}</ButtonIconText>
                  </button>
                  <div className="staff-accountant-export">
                    <button
                      className={accountantExportOpen ? 'active' : ''}
                      type="button"
                      onClick={() => setAccountantExportOpen((open) => !open)}
                    >
                      <ButtonIconText icon={<Download aria-hidden="true" size={14} />}>{text.labels.accountantExports}</ButtonIconText>
                    </button>
                    {accountantExportOpen && (
                      <div className="staff-accountant-export-panel">
                        <div className="staff-accountant-export-head">
                          <div>
                            <strong>{text.labels.accountantExports}</strong>
                            <span>{text.messages.accountantExportHelp}</span>
                          </div>
                          <button className="staff-accountant-export-close" type="button" aria-label={text.actions.cancel} onClick={() => setAccountantExportOpen(false)}>
                            <X aria-hidden="true" size={16} />
                          </button>
                        </div>
                        <div className="staff-accountant-export-grid">
                          <button className="staff-report-range-button compact" type="button" onClick={() => {
                            setReportDatePickerTarget('report')
                            setReportDatePickerOpen(true)
                          }}>
                            <span><CalendarRange aria-hidden="true" size={14} /> {text.labels.dateRange}</span>
                            <strong>{rangeLabel(reportStart, reportEnd)}</strong>
                          </button>
                          <label>
                            {text.labels.exportStore}
                            <select value={accountantExportStore} onChange={(event) => setAccountantExportStore(event.target.value)}>
                              {accountantExportStores.map((store) => (
                                <option key={store.id} value={store.id}>{store.label[accountantExportLanguage]}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {text.labels.exportFormat}
                            <select value={accountantExportFormat} onChange={(event) => setAccountantExportFormat(event.target.value as AccountantExportFormat)}>
                              {accountantExportFormats.map((format) => (
                                <option key={format} value={format}>{format === 'excel' ? text.actions.excel : 'CSV'}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {text.labels.exportLanguage}
                            <select value={accountantExportLanguage} onChange={(event) => setAccountantExportLanguage(event.target.value as StaffConsoleLanguage)}>
                              {accountantExportLanguages.map((item) => (
                                <option key={item} value={item}>{item === 'vi' ? 'Tiếng Việt' : 'English'}</option>
                              ))}
                            </select>
                          </label>
                          <label className="staff-accountant-export-check">
                            <input
                              type="checkbox"
                              checked={accountantIncludeAttachments}
                              onChange={(event) => setAccountantIncludeAttachments(event.target.checked)}
                            />
                            {text.labels.includeAttachments}
                          </label>
                        </div>
                        <div className="staff-accountant-report-heading">
                          <strong>{text.labels.exportReport}</strong>
                          <span>{accountantExportFormat === 'excel' ? '.xlsx' : '.csv'}</span>
                        </div>
                        <div className="staff-accountant-report-list" role="radiogroup" aria-label={text.labels.exportReport}>
                          {accountantExportReports.map((reportOption) => (
                            <button
                              aria-checked={accountantReportId === reportOption.id}
                              className={accountantReportId === reportOption.id ? 'active' : ''}
                              key={reportOption.id}
                              role="radio"
                              type="button"
                              onClick={() => setAccountantReportId(reportOption.id)}
                            >
                              <strong>{reportOption.label[accountantExportLanguage]}</strong>
                              <span>{reportOption.fileBase}.{accountantExportFormat === 'excel' ? 'xlsx' : 'csv'}</span>
                            </button>
                          ))}
                        </div>
                        <button className="primary staff-accountant-download" type="button" onClick={() => { void downloadAccountantExport() }}>
                          <ButtonIconText icon={<Download aria-hidden="true" size={15} />}>{text.actions.download}</ButtonIconText>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {compareEnabled && (
                <div className="staff-report-compare-row">
                  <span>{text.compareWith}</span>
                  <button className="staff-report-range-button compact" type="button" onClick={() => {
                    setReportDatePickerTarget('compare')
                    setReportDatePickerOpen(true)
                  }}>
                    <span><CalendarRange aria-hidden="true" size={14} /> {text.labels.compareRange}</span>
                    <strong>{rangeLabel(compareStart, compareEnd)}</strong>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="staff-summary-grid">
            <div><span>{text.labels.totalSales}</span><strong>{formatVnd(report.totalSales)}</strong></div>
            <div><span>{text.labels.totalPaid}</span><strong>{formatVnd(report.totalPaid)}</strong></div>
            <div><span>{text.unpaid}</span><strong>{formatVnd(report.unpaidAmount)}</strong></div>
            <div><span>{text.labels.cash}</span><strong>{formatVnd(report.cashTotal)}</strong></div>
            <div><span>{text.labels.bankTransfer}</span><strong>{formatVnd(report.bankTransferTotal)}</strong></div>
            <div><span>{text.labels.bookings}</span><strong>{report.bookings}</strong></div>
            <div><span>{text.labels.players}</span><strong>{report.players}</strong></div>
            <div><span>{text.labels.cancelled}</span><strong>{report.cancelled}</strong></div>
            <div><span>{text.labels.noShows}</span><strong>{report.noShows}</strong></div>
            <div><span>{text.labels.discounts}</span><strong>{formatVnd(report.discounts)}</strong></div>
            <div><span>{text.labels.bestSellingGame}</span><strong>{report.bestSellingGame}</strong></div>
          </div>
          <div className="staff-report-graphics">
            <div className="staff-report-revenue-grid">
              <section className="staff-report-graph staff-report-weekday-graph" aria-label={text.aria.revenueByDayOfWeek}>
                <div className="staff-report-graph-head">
                  <div>
                    <h4>{text.labels.revenueByDayOfWeek}</h4>
                    <span>{rangeLabel(reportStart, reportEnd)}</span>
                  </div>
                  {compareEnabled && <span className="staff-report-compare-label">vs {rangeLabel(compareStart, compareEnd)}</span>}
                </div>
                <div className="staff-weekday-bars">
                  {weekdayRevenue.map((point, index) => {
                    const comparePoint = comparisonWeekdayRevenue[index]
                    const currentHeight = `${Math.round((point.sales / weekdayRevenueMax) * 100)}%`
                    const compareHeight = `${Math.round(((comparePoint?.sales || 0) / weekdayRevenueMax) * 100)}%`

                    return (
                      <div className="staff-weekday-bar-group" key={point.key}>
                        <div className="staff-weekday-bar-track">
                          <div className="staff-weekday-bar-pair">
                            {compareEnabled && (
                              <span
                                className="staff-weekday-bar compare"
                                style={{ height: compareHeight }}
                                title={`${point.label} ${rangeLabel(compareStart, compareEnd)}: ${formatVnd(comparePoint?.sales || 0)}`}
                              />
                            )}
                            <span
                              className="staff-weekday-bar current"
                              style={{ height: currentHeight }}
                              title={`${point.label} ${rangeLabel(reportStart, reportEnd)}: ${formatVnd(point.sales)}`}
                            />
                          </div>
                        </div>
                        <strong>{point.label}</strong>
                        <small>{formatVndCompact(point.sales)}</small>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="staff-report-graph staff-report-hourly-graph" aria-label={text.aria.revenueByHour}>
                <div className="staff-report-graph-head">
                  <div>
                    <h4>{text.labels.revenueByHour}</h4>
                    <span>{rangeLabel(reportStart, reportEnd)}</span>
                  </div>
                  <div className="staff-report-curve-legend">
                    <span><i className="current" /> {rangeLabel(reportStart, reportEnd)}</span>
                    {compareEnabled && <span><i className="hourly-compare" /> {rangeLabel(compareStart, compareEnd)}</span>}
                  </div>
                </div>
                <div className="staff-hourly-chart-wrap">
                  <svg className="staff-hourly-chart" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
                    <defs>
                      <linearGradient id="staffHourlyCurrentArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={vrenaPalette.blue[600]} stopOpacity="0.38" />
                        <stop offset="100%" stopColor={vrenaPalette.blue[600]} stopOpacity="0.08" />
                      </linearGradient>
                      <linearGradient id="staffHourlyCompareArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={vrenaPalette.orange[500]} stopOpacity="0.32" />
                        <stop offset="100%" stopColor={vrenaPalette.orange[500]} stopOpacity="0.07" />
                      </linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = 92 - ratio * 74
                      return (
                        <g key={ratio}>
                          <line className="staff-hourly-grid" x1="4" x2="96" y1={y.toFixed(2)} y2={y.toFixed(2)} />
                          <text className="staff-hourly-grid-label" x="1.1" y={(y + 1.4).toFixed(2)}>
                            {formatVndCompact(hourlyRevenueMax * ratio)}
                          </text>
                        </g>
                      )
                    })}
                    {compareEnabled && comparisonHourlyAreaPath && <path className="staff-hourly-area compare" d={comparisonHourlyAreaPath} />}
                    {hourlyAreaPath && <path className="staff-hourly-area current" d={hourlyAreaPath} />}
                    {compareEnabled && comparisonHourlyLinePath && <path className="staff-hourly-line compare" d={comparisonHourlyLinePath} />}
                    {hourlyLinePath && <path className="staff-hourly-line current" d={hourlyLinePath} />}
                  </svg>
                  <div className="staff-hourly-axis">
                    {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((hour) => <span key={hour}>{hour}h</span>)}
                  </div>
                </div>
              </section>
            </div>

            <section className="staff-report-graph staff-report-sales-graph" aria-label={text.aria.salesByDay}>
              <div className="staff-report-graph-head">
                <div>
                  <h4>{text.labels.salesTrend}</h4>
                  <span>{rangeLabel(reportStart, reportEnd)}</span>
                </div>
                <div className="staff-report-graph-actions">
                  {compareEnabled && <span className="staff-report-compare-label">vs {rangeLabel(compareStart, compareEnd)}</span>}
                  <div className="staff-chart-mode" aria-label={text.aria.graphDisplay} role="group">
                    {[
                      { value: 'columns', label: text.chartModes.columns },
                      { value: 'curves', label: text.chartModes.curves },
                      { value: 'cheese', label: text.chartModes.cheese },
                    ].map((mode) => (
                      <button
                        aria-pressed={reportChartMode === mode.value}
                        className={reportChartMode === mode.value ? 'active' : ''}
                        key={mode.value}
                        type="button"
                        onClick={() => setReportChartMode(mode.value as StaffReportChartMode)}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {reportSeries.length > 0 && reportChartMode === 'columns' ? (
                <div className="staff-report-bars">
                  {reportSeries.map((point, index) => {
                    const comparePoint = comparisonSeries[index]
                    const currentHeight = `${Math.round((point.sales / reportChartMax) * 100)}%`
                    const compareHeight = `${Math.round(((comparePoint?.sales || 0) / reportChartMax) * 100)}%`
                    return (
                      <div className="staff-report-bar-group" key={`${point.date}-${index}`}>
                        <div className="staff-report-bar-track">
                          {compareEnabled && (
                            <span
                              className="staff-report-bar compare"
                              style={{ height: compareHeight }}
                              title={`${comparePoint ? shortDateLabel(comparePoint.date) : text.labels.compare}: ${formatVnd(comparePoint?.sales || 0)}`}
                            />
                          )}
                          <span
                            className="staff-report-bar current"
                            style={{ height: currentHeight }}
                            title={`${shortDateLabel(point.date)}: ${formatVnd(point.sales)}`}
                          />
                        </div>
                        <strong>{shortDateLabel(point.date)}</strong>
                        <small>{formatVnd(point.sales)}</small>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {reportSeries.length > 0 && reportChartMode === 'curves' ? (
                <div className="staff-report-curve-wrap">
                  <svg className="staff-report-curve" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
                    <defs>
                      <linearGradient id="staffReportCurveGradient" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor={vrenaPalette.cyan[500]} />
                        <stop offset="100%" stopColor={vrenaPalette.purple[500]} />
                      </linearGradient>
                    </defs>
                    <path className="staff-report-curve-fill" d={`${reportLinePath} L 94 96 L 6 96 Z`} />
                    {compareEnabled && <path className="staff-report-curve-line compare" d={comparisonLinePath} />}
                    <path className="staff-report-curve-line current" d={reportLinePath} />
                  </svg>
                  <div className="staff-report-curve-legend">
                    <span><i className="current" /> {rangeLabel(reportStart, reportEnd)}</span>
                    {compareEnabled && <span><i className="compare" /> {rangeLabel(compareStart, compareEnd)}</span>}
                  </div>
                </div>
              ) : null}
              {reportSeries.length > 0 && reportChartMode === 'cheese' ? (
                <div className="staff-report-pie-wrap">
                  <div className="staff-report-pie" style={{ background: `conic-gradient(${pieStops})` }}>
                    <span>{formatVnd(report.totalSales)}</span>
                  </div>
                  <div className="staff-payment-mix">
                    {pieItems.map((item) => (
                      <div className="staff-payment-row" key={item.label}>
                        <div>
                          <span>{item.label}</span>
                          <strong>{formatVnd(item.value)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {reportSeries.length === 0 ? (
                <p className="muted">{text.messages.noSales}</p>
              ) : (
                null
              )}
            </section>
            <section className="staff-report-graph" aria-label={text.aria.periodComparison}>
              <div className="staff-report-graph-head">
                <div>
                  <h4>{text.labels.compare}</h4>
                  <span>{compareEnabled ? rangeLabel(compareStart, compareEnd) : text.compareOff}</span>
                </div>
              </div>
              <div className="staff-comparison-list">
                {[
                  { label: text.labels.sales, current: formatVnd(report.totalSales), previous: formatVnd(comparisonReport.totalSales), change: percentChange(report.totalSales, comparisonReport.totalSales, text) },
                  { label: text.labels.bookings, current: report.bookings, previous: comparisonReport.bookings, change: percentChange(report.bookings, comparisonReport.bookings, text) },
                  { label: text.labels.players, current: report.players, previous: comparisonReport.players, change: percentChange(report.players, comparisonReport.players, text) },
                ].map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.current}</strong>
                    <small>{compareEnabled ? `${item.change} vs ${item.previous}` : text.compareOff}</small>
                  </div>
                ))}
              </div>
            </section>
            <section className="staff-report-graph" aria-label={text.aria.paymentMix}>
              <div className="staff-report-graph-head">
                <div>
                  <h4>{text.labels.paymentMix}</h4>
                  <span>{rangeLabel(reportStart, reportEnd)}</span>
                </div>
              </div>
              <div className="staff-payment-mix">
                {paymentMix.map((item) => (
                  <div className="staff-payment-row" key={item.label}>
                    <div>
                      <span>{item.label}</span>
                      <strong>{formatVnd(item.value)}</strong>
                    </div>
                    <div className="staff-payment-track">
                      <span style={{ width: `${item.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          {orderRows(reportOrders, reportPaymentsByOrderId)}
        </div>
      )}

      {reportDatePickerOpen && (
        <StaffReportDateRangeModal
          ButtonIconText={ButtonIconText}
          StaffPickerField={StaffPickerField}
          text={text}
          reportStart={reportStart}
          reportEnd={reportEnd}
          compareEnabled={compareEnabled}
          compareStart={compareStart}
          compareEnd={compareEnd}
          initialRangeTarget={reportDatePickerTarget}
          onApply={applyReportDateRange}
          onClose={() => setReportDatePickerOpen(false)}
        />
      )}

      {operationDeleteDraft && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-operation-delete-title"
          onClick={() => !saving && closeOperationDeleteDraft()}
        >
          <div className="login-modal staff-operation-delete-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label={text.actions.cancel} onClick={closeOperationDeleteDraft} disabled={saving}>
              <X aria-hidden="true" size={20} />
            </button>
            <h3 id="staff-operation-delete-title">{text.messages.operationDeleteTitle}</h3>
            <p>
              <strong>{operationDeleteDraft.session.name}</strong>
              {' · '}
              {shortDateLabel(operationDeleteDraft.session.date)}
              {' · '}
              {normalizeTime(operationDeleteDraft.session.start_time)}
            </p>
            {operationDeleteDraft.order && (
              <p>
                {operationDeleteDraft.order.order_number}
                {' · '}
                {orderPaymentLabel(operationDeleteDraft.order, orderPaymentsByOrderId, text)}
              </p>
            )}
            <p>{text.messages.operationDeleteBody}</p>
            {operationDeleteError && (
              <p className="notice ticket-status-message ticket-status-error">{operationDeleteError}</p>
            )}
            <div className="action-row">
              <button className="danger" disabled={saving} type="button" onClick={deleteOperationSession}>
                <ButtonIconText icon={<Trash2 aria-hidden="true" size={14} />}>
                  {saving ? text.messages.operationSessionDeleting : text.actions.confirmDeleteSession}
                </ButtonIconText>
              </button>
              <button className="secondary" disabled={saving} type="button" onClick={closeOperationDeleteDraft}>
                {text.actions.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileDeleteDraft && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-account-delete-title"
          onClick={() => !saving && setProfileDeleteDraft(null)}
        >
          <div className="login-modal staff-account-delete-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label={text.actions.cancel} onClick={() => setProfileDeleteDraft(null)} disabled={saving}>
              <X aria-hidden="true" size={20} />
            </button>
            <h3 id="staff-account-delete-title">{text.messages.accountDeleteTitle}</h3>
            <p>
              <strong>{customerName(profileDeleteDraft.profile, text)}</strong>
              {' · '}
              {profileDeleteDraft.profile.email || profileDeleteDraft.profile.phone || text.noContact}
            </p>
            <p>{text.messages.accountDeleteBody}</p>
            <label className="checkbox-row staff-account-ban-row">
              <input
                type="checkbox"
                checked={profileDeleteDraft.ban}
                onChange={(event) => setProfileDeleteDraft((current) => current ? { ...current, ban: event.target.checked } : current)}
              />
              {text.labels.banAccount}
            </label>
            {profileDeleteDraft.ban && (
              <p className="staff-account-delete-warning">{text.messages.accountDeleteBanNote}</p>
            )}
            <label className="staff-note-field">
              {text.labels.deleteReason}
              <textarea
                value={profileDeleteDraft.reason}
                onChange={(event) => setProfileDeleteDraft((current) => current ? { ...current, reason: event.target.value } : current)}
                placeholder={text.labels.notes}
              />
            </label>
            <label className="staff-note-field">
              {text.labels.confirmDeleteWord}
              <input
                value={profileDeleteDraft.confirmation}
                onChange={(event) => setProfileDeleteDraft((current) => current ? { ...current, confirmation: event.target.value } : current)}
                placeholder="DELETE"
              />
              <span>{text.messages.accountDeleteConfirmationHelp}</span>
            </label>
            <div className="action-row">
              <button className="danger" disabled={saving || profileDeleteDraft.confirmation !== 'DELETE'} type="button" onClick={deleteProfileAccount}>
                {saving ? text.messages.accountDeleting : text.actions.confirmDeleteAccount}
              </button>
              <button className="secondary" disabled={saving} type="button" onClick={() => setProfileDeleteDraft(null)}>
                {text.actions.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {roleHelpOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-role-help-title"
          onClick={() => setRoleHelpOpen(false)}
        >
          <div className="login-modal staff-role-help-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label={text.closeRoleHelp} onClick={() => setRoleHelpOpen(false)}>
              <X aria-hidden="true" size={20} />
            </button>
            <h3 id="staff-role-help-title">{text.labels.roleExplanation}</h3>
            <div className="staff-role-help-list">
              {text.roleHelp.map((item) => (
                <div className="staff-role-help-item" key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
