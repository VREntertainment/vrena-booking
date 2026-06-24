'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import { languageOptions, uiText, type LanguageCode } from '../lib/i18n'
import { RATE_LIMITS, type RateLimitAction } from '../lib/security/rateLimit'
import { supabase } from '../lib/supabase/client'

type StaffTab = 'new' | 'today' | 'games' | 'prices' | 'discounts' | 'roles' | 'restore' | 'orders' | 'report'
type StaffCommerceTab = 'discounts' | 'vouchers' | 'loyalty'
type StaffRole = 'owner' | 'admin' | 'manager' | 'staff' | 'cashier' | 'viewer' | 'player'
type StaffRoleSort = 'name_asc' | 'name_desc' | 'role_desc' | 'role_asc' | 'email_asc'
type StaffReportChartMode = 'columns' | 'curves' | 'cheese'
type StaffReportRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_30' | 'last_60' | 'last_90'
type AccountantExportFormat = 'excel' | 'csv'
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

type StaffProfile = {
  id: string
  full_name?: string | null
  nickname?: string | null
  email?: string | null
  phone?: string | null
  role?: string | null
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
  point_expiry_days: number | null
  valid_from: string
  valid_until: string | null
  active: boolean
  notes: string | null
}

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
  checked_in?: boolean | null
  payment_status?: string | null
  payment_amount?: number | null
  payment_splits?: unknown
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
  session_participants?: StaffSessionParticipant[]
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

type StaffDataKey = 'games' | 'prices' | 'discounts' | 'loyalty' | 'today' | 'todaySessions' | 'orders' | 'profiles' | 'audit' | 'restore' | 'report'

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
  payments: StaffOrderPayment[]
}

const emptyStaffOrders: StaffOrder[] = []
const emptyStaffPayments: StaffOrderPayment[] = []
const emptyStaffDailySeries: StaffDailyPoint[] = []

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

type StaffConsoleProps = {
  profile: StaffProfile | null
  authEmail?: string
  language?: string
  onOpenSessionCalendar?: (dateValue: string) => void
}

type StaffConsoleLanguage = 'en' | 'vi'

const staffConsoleText = {
  en: {
    accessRequired: 'Staff access required.',
    active: 'active',
    inactive: 'inactive',
    allGames: 'All games',
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
      confirmBooking: 'Confirm booking',
      done: 'Done',
      excel: 'Excel',
      newGame: 'New game',
      noShow: 'No-show',
      paid: 'Paid',
      pdf: 'PDF',
      remove: 'Remove',
      restore: 'Restore',
      cancel: 'Cancel',
      confirmDeleteAccount: 'Delete account',
      deleteAccount: 'Delete account',
      download: 'Download',
      saveDiscount: 'Save discount',
      saveGame: 'Save game',
      saveLoyaltyRule: 'Save loyalty rule',
      savePrice: 'Save price',
      saveRole: 'Save role',
      saveVoucher: 'Save voucher',
      sessionCalendar: 'Session Calendar',
      today: 'Today',
      yesterday: 'Yesterday',
      previousPeriod: 'Previous period',
    },
    aria: {
      bookingDate: 'Booking date',
      bookingTime: 'Booking time',
      closeReportCalendar: 'Close report calendar',
      openBookingCalendar: 'Open booking calendar',
      openSessionCalendar: 'Open session calendar',
      compareEndDate: 'Compare end date',
      compareStartDate: 'Compare start date',
      discountValueUnit: 'Discount value unit',
      discountValidFrom: 'Discount valid from',
      discountValidUntil: 'Discount valid until',
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
    dayTypes: {
      custom: 'custom',
      holiday: 'holiday',
      weekday: 'weekday',
      weekend: 'weekend',
    } satisfies Record<StaffPriceRule['day_type'], string>,
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
      accountantExports: 'Accountant exports',
      arena: 'Arena',
      arenaIds: 'Arena IDs',
      attachmentList: 'Attachment list',
      bankTransfer: 'Bank transfer',
      bestSellingGame: 'Best-selling game',
      bookings: 'Bookings',
      calculation: 'Calculation',
      cancelled: 'Cancelled',
      cash: 'Cash',
      capacity: 'Capacity',
      checkIns: 'Check-ins',
      codeOptional: 'Code (optional)',
      banAccount: 'Ban this account too',
      compare: 'Compare',
      compareRange: 'Compare range',
      confirmDeleteWord: 'Type DELETE to confirm',
      createDiscount: 'Create discount',
      createGame: 'Create game',
      createLoyaltyRule: 'Create loyalty rule',
      createPriceRule: 'Create price rule',
      createVoucher: 'Create voucher',
      current: 'current',
      communitySession: 'Community session',
      customer: 'Customer',
      customerName: 'Customer name',
      customerProfile: 'Customer profile',
      date: 'Date',
      dateRange: 'Date range',
      dayType: 'Day type',
      deleteReason: 'Reason',
      description: 'Description',
      audience: 'Audience',
      discount: 'Discount',
      discountType: 'Discount type',
      discountVoucher: 'Discount / voucher',
      discounts: 'Discounts',
      duration: 'Duration',
      email: 'E-mail',
      end: 'End',
      endDate: 'End date',
      exportFormat: 'Format',
      exportLanguage: 'Language',
      exportReport: 'Report',
      exportStore: 'Store / location',
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
      maxPlayersArena: 'Max players / arena',
      maxUses: 'Max uses',
      minimumSpend: 'Minimum spend',
      name: 'Name',
      newBooking: 'New booking',
      noLinkedOrder: 'No linked order',
      no: 'No',
      noShows: 'No-shows',
      notes: 'Notes',
      order: 'Order',
      orderStatus: 'Order status',
      orders: 'Orders',
      operationsCalendar: 'Operations calendar',
      operationsDate: 'Operations date',
      paid: 'Paid',
      payment: 'Payment',
      paymentSplits: 'Payment splits',
      paymentStatus: 'Payment status',
      paymentMix: 'Payment mix',
      perVndSpent: 'Per VND spent',
      phone: 'Phone',
      players: 'Players',
      pointsEarned: 'Points earned',
      pointsExpireAfterDays: 'Points expire after days',
      privateSession: 'Private session',
      priceArenaSlot: 'Price / arena slot (đ)',
      pricePlayer: 'Price / player (đ)',
      priceRules: 'Price rules',
      recentAuditLog: 'Recent audit log',
      remaining: 'Remaining',
      restoreDeletedRecords: 'Restore deleted records',
      reportRange: 'Report range',
      roleExplanation: 'Role explanation',
      roleFor: 'Role for',
      roles: 'Roles',
      rounds: 'Rounds',
      rule: 'Rule',
      ruleName: 'Rule name',
      sales: 'Sales',
      salesTrend: 'Sales trend',
      searchUsers: 'Search users',
      selectedRange: 'Selected range',
      sessions: 'Sessions',
      sortBy: 'Sort by',
      slug: 'Slug',
      start: 'Start',
      startDate: 'Start date',
      status: 'Status',
      subtotal: 'Subtotal',
      summary: 'Summary',
      time: 'Time',
      ticketBookings: 'Ticket bookings',
      total: 'Total',
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
      accountDeleted: 'Account deleted.',
      accountDeleting: 'Deleting account...',
      accountDeleteConfirmationHelp: 'Write DELETE exactly to unlock this action.',
      accountantExportHelp: 'Choose filters, report type, and format, then download.',
      accountantExportSourcePending: 'Detailed source table is not configured yet. This export includes the available report summary for the selected range.',
      discountSaved: 'Discount saved.',
      gamePhotoSmall: 'Game photo must be 2 MB or smaller.',
      gamePhotoType: 'Game photo must be JPG, PNG, or WEBP.',
      gamePhotoUploaded: 'Game photo uploaded. Save the game to keep it.',
      gameGuideHelp: 'Select a language, then edit the summary, GamePlay, and tips for this game only. Use one line per GamePlay item or tip.',
      gameSaved: 'Game saved.',
      loyaltyIntro: 'Define how customers earn points. Redemption will use these rules later.',
      loyaltyRuleSaved: 'Loyalty rule saved.',
      noDiscounts: 'No discounts yet.',
      noLoyaltyRules: 'No loyalty rules yet.',
      noOrders: 'No orders in this range.',
      noSales: 'No sales in this period yet.',
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
      staffTooManyAttempts: 'Too many attempts. Please wait a moment and try again.',
      uniqueDiscountHelp: 'One-off discount for this booking only. It does not create a reusable voucher.',
      uploadGamePhoto: 'Uploading game photo...',
      noOperationSessions: 'No sessions or ticket bookings for this day.',
      operationsIntro: 'Today at the counter: sessions, ticket bookings, capacity, payments, and check-ins in one place.',
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
      cashier: 'Cashier',
      manager: 'Manager',
      owner: 'Owner',
      player: 'Player',
      staff: 'Staff',
      viewer: 'Viewer',
    } satisfies Record<StaffRole, string>,
    roleSorts: {
      email_asc: 'E-mail A-Z',
      name_asc: 'Name A-Z',
      name_desc: 'Name Z-A',
      role_asc: 'Role low-high',
      role_desc: 'Role high-low',
    } satisfies Record<StaffRoleSort, string>,
    reportRangePresets: {
      today: 'Today',
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
      { title: 'Staff / Cashier', body: 'Can create counter bookings, check today, use discounts or vouchers, manage orders, and view reports.' },
      { title: 'Viewer', body: 'Can use the normal player app, view the whole Staff Console, and adjust or download reports. All other staff data is read-only.' },
      { title: 'Player', body: 'Client app only. No Staff Console access.' },
    ],
    tabs: {
      discounts: 'Discounts / Vouchers',
      games: 'Games',
      new: 'New Booking',
      orders: 'Orders',
      prices: 'Prices',
      report: 'Daily Report',
      restore: 'Restore',
      roles: 'Roles',
      today: 'Today',
    } satisfies Record<StaffTab, string>,
  },
  vi: {
    accessRequired: 'Cần quyền nhân viên.',
    active: 'đang bật',
    inactive: 'đã tắt',
    allGames: 'Tất cả trò chơi',
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
      confirmBooking: 'Xác nhận đặt chỗ',
      done: 'Hoàn tất',
      excel: 'Excel',
      newGame: 'Trò chơi mới',
      noShow: 'Không đến',
      paid: 'Đã thanh toán',
      pdf: 'PDF',
      remove: 'Xóa',
      restore: 'Khôi phục',
      cancel: 'Hủy',
      confirmDeleteAccount: 'Xóa tài khoản',
      deleteAccount: 'Xóa tài khoản',
      download: 'Tải xuống',
      saveDiscount: 'Lưu ưu đãi',
      saveGame: 'Lưu trò chơi',
      saveLoyaltyRule: 'Lưu quy tắc điểm',
      savePrice: 'Lưu giá',
      saveRole: 'Lưu vai trò',
      saveVoucher: 'Lưu voucher',
      sessionCalendar: 'Lịch phiên',
      today: 'Hôm nay',
      yesterday: 'Hôm qua',
      previousPeriod: 'Kỳ trước',
    },
    aria: {
      bookingDate: 'Ngày đặt chỗ',
      bookingTime: 'Giờ đặt chỗ',
      closeReportCalendar: 'Đóng lịch báo cáo',
      openBookingCalendar: 'Mở lịch đặt chỗ',
      openSessionCalendar: 'Mở lịch phiên',
      compareEndDate: 'Ngày kết thúc so sánh',
      compareStartDate: 'Ngày bắt đầu so sánh',
      discountValueUnit: 'Đơn vị ưu đãi',
      discountValidFrom: 'Ưu đãi hiệu lực từ',
      discountValidUntil: 'Ưu đãi hiệu lực đến',
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
    dayTypes: {
      custom: 'tùy chỉnh',
      holiday: 'ngày lễ',
      weekday: 'ngày thường',
      weekend: 'cuối tuần',
    } satisfies Record<StaffPriceRule['day_type'], string>,
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
      accountantExports: 'Xuất kế toán',
      arena: 'Arena',
      arenaIds: 'Mã arena',
      attachmentList: 'Danh sách chứng từ',
      bankTransfer: 'Chuyển khoản',
      bestSellingGame: 'Trò chơi bán chạy nhất',
      bookings: 'Đặt chỗ',
      calculation: 'Cách tính',
      cancelled: 'Đã hủy',
      cash: 'Tiền mặt',
      capacity: 'Sức chứa',
      checkIns: 'Check-in',
      codeOptional: 'Mã (không bắt buộc)',
      banAccount: 'Cấm tài khoản này luôn',
      compare: 'So sánh',
      compareRange: 'Khoảng so sánh',
      confirmDeleteWord: 'Nhập DELETE để xác nhận',
      createDiscount: 'Tạo ưu đãi',
      createGame: 'Tạo trò chơi',
      createLoyaltyRule: 'Tạo quy tắc điểm',
      createPriceRule: 'Tạo quy tắc giá',
      createVoucher: 'Tạo voucher',
      current: 'hiện tại',
      communitySession: 'Phiên cộng đồng',
      customer: 'Khách hàng',
      customerName: 'Tên khách hàng',
      customerProfile: 'Hồ sơ khách',
      date: 'Ngày',
      dateRange: 'Khoảng ngày',
      dayType: 'Loại ngày',
      deleteReason: 'Lý do',
      description: 'Mô tả',
      audience: 'Đối tượng',
      discount: 'Ưu đãi',
      discountType: 'Loại ưu đãi',
      discountVoucher: 'Ưu đãi / voucher',
      discounts: 'Ưu đãi',
      duration: 'Thời lượng',
      email: 'E-mail',
      end: 'Kết thúc',
      endDate: 'Ngày kết thúc',
      exportFormat: 'Định dạng',
      exportLanguage: 'Ngôn ngữ',
      exportReport: 'Báo cáo',
      exportStore: 'Cơ sở',
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
      maxPlayersArena: 'Số người tối đa / arena',
      maxUses: 'Số lần dùng tối đa',
      minimumSpend: 'Chi tiêu tối thiểu',
      name: 'Tên',
      newBooking: 'Đặt chỗ mới',
      noLinkedOrder: 'Chưa có đơn liên kết',
      no: 'Không',
      noShows: 'Không đến',
      notes: 'Ghi chú',
      order: 'Đơn',
      orderStatus: 'Trạng thái đơn',
      orders: 'Đơn hàng',
      operationsCalendar: 'Lịch vận hành',
      operationsDate: 'Ngày vận hành',
      paid: 'Đã trả',
      payment: 'Thanh toán',
      paymentSplits: 'Tách thanh toán',
      paymentStatus: 'Trạng thái thanh toán',
      paymentMix: 'Cơ cấu thanh toán',
      perVndSpent: 'Theo VND chi tiêu',
      phone: 'Điện thoại',
      players: 'Người chơi',
      pointsEarned: 'Điểm nhận được',
      pointsExpireAfterDays: 'Điểm hết hạn sau số ngày',
      privateSession: 'Phiên riêng tư',
      priceArenaSlot: 'Giá / slot arena (đ)',
      pricePlayer: 'Giá / người (đ)',
      priceRules: 'Quy tắc giá',
      recentAuditLog: 'Nhật ký gần đây',
      remaining: 'Còn lại',
      restoreDeletedRecords: 'Khôi phục dữ liệu đã xóa',
      reportRange: 'Khoảng báo cáo',
      roleExplanation: 'Giải thích vai trò',
      roleFor: 'Vai trò cho',
      roles: 'Vai trò',
      rounds: 'Vòng',
      rule: 'Quy tắc',
      ruleName: 'Tên quy tắc',
      sales: 'Doanh thu',
      salesTrend: 'Xu hướng doanh thu',
      searchUsers: 'Tìm người dùng',
      selectedRange: 'Khoảng đã chọn',
      sessions: 'Phiên',
      sortBy: 'Sắp xếp theo',
      slug: 'Slug',
      start: 'Bắt đầu',
      startDate: 'Ngày bắt đầu',
      status: 'Trạng thái',
      subtotal: 'Tạm tính',
      summary: 'Tóm tắt',
      time: 'Giờ',
      ticketBookings: 'Đặt vé',
      total: 'Tổng',
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
      accountDeleted: 'Đã xóa tài khoản.',
      accountDeleting: 'Đang xóa tài khoản...',
      accountDeleteConfirmationHelp: 'Nhập chính xác DELETE để mở khóa thao tác này.',
      accountantExportHelp: 'Chọn bộ lọc, loại báo cáo và định dạng, rồi tải xuống.',
      accountantExportSourcePending: 'Bảng dữ liệu chi tiết chưa được cấu hình. File này gồm phần tóm tắt báo cáo đang có cho khoảng đã chọn.',
      discountSaved: 'Đã lưu ưu đãi.',
      gamePhotoSmall: 'Ảnh trò chơi phải từ 2 MB trở xuống.',
      gamePhotoType: 'Ảnh trò chơi phải là JPG, PNG hoặc WEBP.',
      gamePhotoUploaded: 'Đã tải ảnh. Lưu trò chơi để giữ ảnh.',
      gameGuideHelp: 'Chọn ngôn ngữ, rồi sửa tóm tắt, GamePlay và mẹo chỉ cho trò chơi này. Mỗi dòng là một mục GamePlay hoặc mẹo.',
      gameSaved: 'Đã lưu trò chơi.',
      loyaltyIntro: 'Thiết lập cách khách hàng nhận điểm. Đổi điểm sẽ dùng các quy tắc này sau.',
      loyaltyRuleSaved: 'Đã lưu quy tắc điểm.',
      noDiscounts: 'Chưa có ưu đãi.',
      noLoyaltyRules: 'Chưa có quy tắc điểm.',
      noOrders: 'Không có đơn trong khoảng này.',
      noSales: 'Chưa có doanh thu trong kỳ này.',
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
      staffTooManyAttempts: 'Quá nhiều lần thử. Vui lòng chờ một chút rồi thử lại.',
      uniqueDiscountHelp: 'Ưu đãi dùng một lần cho đặt chỗ này. Không tạo voucher dùng lại.',
      uploadGamePhoto: 'Đang tải ảnh trò chơi...',
      noOperationSessions: 'Không có phiên hoặc đặt vé trong ngày này.',
      operationsIntro: 'Tại quầy hôm nay: phiên chơi, đặt vé, sức chứa, thanh toán và check-in trong một nơi.',
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
      cashier: 'Thu ngân',
      manager: 'Quản lý',
      owner: 'Owner',
      player: 'Player',
      staff: 'Nhân viên',
      viewer: 'Viewer',
    } satisfies Record<StaffRole, string>,
    roleSorts: {
      email_asc: 'E-mail A-Z',
      name_asc: 'Tên A-Z',
      name_desc: 'Tên Z-A',
      role_asc: 'Vai trò thấp-cao',
      role_desc: 'Vai trò cao-thấp',
    } satisfies Record<StaffRoleSort, string>,
    reportRangePresets: {
      today: 'Hôm nay',
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
      { title: 'Staff / Cashier', body: 'Tạo đặt chỗ tại quầy, xem hôm nay, dùng ưu đãi hoặc voucher, quản lý đơn và xem báo cáo.' },
      { title: 'Viewer', body: 'Dùng app như người chơi, xem toàn bộ Staff Console, chỉnh hoặc tải báo cáo. Dữ liệu staff còn lại chỉ xem.' },
      { title: 'Player', body: 'Chỉ có app khách hàng. Không có quyền Staff Console.' },
    ],
    tabs: {
      discounts: 'Ưu đãi / Voucher',
      games: 'Trò chơi',
      new: 'Đặt chỗ mới',
      orders: 'Đơn hàng',
      prices: 'Giá',
      report: 'Báo cáo ngày',
      restore: 'Khôi phục',
      roles: 'Vai trò',
      today: 'Hôm nay',
    } satisfies Record<StaffTab, string>,
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

type StaffPickerFieldProps = {
  ariaLabel: string
  type: 'date' | 'time'
  value: string
  placeholder?: string
  inputRef?: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
}

function StaffPickerField({ ariaLabel, type, value, placeholder, inputRef, onChange }: StaffPickerFieldProps) {
  const displayValue = type === 'date' ? staffDateLabel(value) : normalizeTime(value)
  const fallback = placeholder || (type === 'date' ? 'Choose date' : 'Choose time')

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

type StaffReportDateRangeModalProps = {
  text: StaffConsoleCopy
  reportStart: string
  reportEnd: string
  compareEnabled: boolean
  compareStart: string
  compareEnd: string
  initialRangeTarget: 'report' | 'compare'
  onApply: (reportStart: string, reportEnd: string, compareEnabled: boolean, compareStart: string, compareEnd: string) => void
  onClose: () => void
}

function StaffReportDateRangeModal({
  text,
  reportStart,
  reportEnd,
  compareEnabled,
  compareStart,
  compareEnd,
  initialRangeTarget,
  onApply,
  onClose,
}: StaffReportDateRangeModalProps) {
  const [draftStart, setDraftStart] = useState(reportStart)
  const [draftEnd, setDraftEnd] = useState(reportEnd)
  const [draftCompareEnabled, setDraftCompareEnabled] = useState(compareEnabled)
  const [draftCompareStart, setDraftCompareStart] = useState(compareStart)
  const [draftCompareEnd, setDraftCompareEnd] = useState(compareEnd)
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(reportStart))
  const [rangeTarget, setRangeTarget] = useState<'report' | 'compare'>(initialRangeTarget)
  const nextMonth = addMonths(visibleMonth, 1)
  const [orderedStart, orderedEnd] = orderedRange(draftStart, draftEnd)
  const [orderedCompareStart, orderedCompareEnd] = orderedRange(draftCompareStart, draftCompareEnd)

  function updateReportRange(start: string, end: string) {
    const [from, to] = orderedRange(start, end)
    setDraftStart(from)
    setDraftEnd(to)
    const [previousStart, previousEnd] = previousPeriodRange(from, to)
    setDraftCompareStart(previousStart)
    setDraftCompareEnd(previousEnd)
  }

  function selectDate(date: string) {
    if (rangeTarget === 'compare') {
      if (date < orderedCompareStart || draftCompareStart !== draftCompareEnd) {
        setDraftCompareStart(date)
        setDraftCompareEnd(date)
      } else {
        const [from, to] = orderedRange(draftCompareStart, date)
        setDraftCompareStart(from)
        setDraftCompareEnd(to)
      }
      return
    }

    if (date < orderedStart || draftStart !== draftEnd) {
      updateReportRange(date, date)
    } else {
      updateReportRange(draftStart, date)
    }
  }

  function applyPreset(preset: StaffReportRangePreset) {
    const [from, to] = reportPresetRange(preset)
    updateReportRange(from, to)
    setVisibleMonth(startOfMonth(from))
    setRangeTarget('report')
  }

  function renderCalendarMonth(monthValue: string) {
    return (
      <div className="staff-report-calendar-month" key={monthValue}>
        <h4>{monthLabel(monthValue)}</h4>
        <div className="staff-report-calendar-weekdays" aria-hidden="true">
          {text.reportWeekdays.map((weekday) => (
            <span key={`${monthValue}-${weekday}`}>{weekday}</span>
          ))}
        </div>
        <div className="staff-report-calendar-days">
          {reportCalendarCells(monthValue).map((cell) => {
            const inReportRange = cell.date >= orderedStart && cell.date <= orderedEnd
            const isReportEdge = cell.date === orderedStart || cell.date === orderedEnd
            const inCompareRange = draftCompareEnabled && cell.date >= orderedCompareStart && cell.date <= orderedCompareEnd
            const isCompareEdge = draftCompareEnabled && (cell.date === orderedCompareStart || cell.date === orderedCompareEnd)
            return (
              <button
                className={[
                  'staff-report-calendar-day',
                  cell.inMonth ? '' : 'outside',
                  inReportRange ? 'in-range' : '',
                  isReportEdge ? 'range-edge' : '',
                  inCompareRange ? 'compare-range' : '',
                  isCompareEdge ? 'compare-edge' : '',
                ].filter(Boolean).join(' ')}
                key={cell.date}
                type="button"
                onClick={() => selectDate(cell.date)}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="staff-report-date-modal-title" onClick={onClose}>
      <div className="login-modal staff-report-date-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label={text.aria.closeReportCalendar} onClick={onClose}>
          ×
        </button>
        <div className="staff-report-date-modal-head">
          <div>
            <h3 id="staff-report-date-modal-title">{text.labels.reportRange}</h3>
            <p>{text.labels.selectedRange}: {rangeLabel(orderedStart, orderedEnd)}</p>
          </div>
          <button className="staff-report-range-button" type="button" onClick={() => setRangeTarget('report')}>
            <span>{text.labels.dateRange}</span>
            <strong>{rangeLabel(orderedStart, orderedEnd)}</strong>
          </button>
        </div>

        <div className="staff-report-date-modal-body">
          <div className="staff-report-date-presets">
            {staffReportPresetOptions.map((preset) => {
              const [from, to] = reportPresetRange(preset)
              const active = from === orderedStart && to === orderedEnd
              return (
                <button className={active ? 'active' : ''} key={preset} type="button" onClick={() => applyPreset(preset)}>
                  {text.reportRangePresets[preset]}
                </button>
              )
            })}
          </div>
          <div className="staff-report-date-main">
            <div className="staff-report-date-inputs">
              <label>
                <span>{text.labels.startDate}</span>
                <StaffPickerField ariaLabel={text.aria.reportStartDate} placeholder={text.chooseDate} type="date" value={draftStart} onChange={(value) => updateReportRange(value, draftEnd)} />
              </label>
              <label>
                <span>{text.labels.endDate}</span>
                <StaffPickerField ariaLabel={text.aria.reportEndDate} placeholder={text.chooseDate} type="date" value={draftEnd} onChange={(value) => updateReportRange(draftStart, value)} />
              </label>
            </div>
            <div className="staff-report-calendar-nav">
              <button type="button" aria-label={text.aria.previousReportMonth} onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}>‹</button>
              <span>{monthLabel(visibleMonth)} / {monthLabel(nextMonth)}</span>
              <button type="button" aria-label={text.aria.nextReportMonth} onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}>›</button>
            </div>
            <div className="staff-report-calendar-months">
              {renderCalendarMonth(visibleMonth)}
              {renderCalendarMonth(nextMonth)}
            </div>
            <div className="staff-report-date-compare">
              <label className="staff-compare-toggle">
                <input
                  type="checkbox"
                  checked={draftCompareEnabled}
                  onChange={(event) => {
                    setDraftCompareEnabled(event.target.checked)
                    if (event.target.checked) setRangeTarget('compare')
                  }}
                />
                {text.labels.compare}
              </label>
              {draftCompareEnabled && (
                <div className="staff-report-date-compare-fields">
                  <button className="staff-report-range-button compact" type="button" onClick={() => setRangeTarget('compare')}>
                    <span>{text.labels.compareRange}</span>
                    <strong>{rangeLabel(orderedCompareStart, orderedCompareEnd)}</strong>
                  </button>
                  <label>
                    <span>{text.labels.startDate}</span>
                    <StaffPickerField ariaLabel={text.aria.compareStartDate} placeholder={text.chooseDate} type="date" value={draftCompareStart} onChange={setDraftCompareStart} />
                  </label>
                  <label>
                    <span>{text.labels.endDate}</span>
                    <StaffPickerField ariaLabel={text.aria.compareEndDate} placeholder={text.chooseDate} type="date" value={draftCompareEnd} onChange={setDraftCompareEnd} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="staff-report-date-modal-actions">
          <button className="secondary" type="button" onClick={onClose}>{text.actions.cancel}</button>
          <button
            className="primary"
            type="button"
            onClick={() => onApply(orderedStart, orderedEnd, draftCompareEnabled, orderedCompareStart, orderedCompareEnd)}
          >
            {text.actions.apply}
          </button>
        </div>
      </div>
    </div>
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

const defaultGameForm = () => ({
  id: '',
  slug: '',
  name: '',
  game_type: 'shooting' as StaffGame['game_type'],
  duration_minutes: 20,
  max_players_per_arena: 4,
  number_of_rounds: 1,
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
  point_expiry_days: '365',
  valid_from: todayString(),
  valid_until: '',
  active: true,
  notes: '',
})

const paymentMethods = ['cash', 'bank_transfer'] as const
const orderStatuses = ['draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed'] as const
const gameTypes = ['shooting', 'escape', 'tournament', 'other'] as const
const dayTypes = ['weekday', 'weekend', 'holiday', 'custom'] as const
const discountTypes = ['percentage', 'fixed_amount', 'free_ticket', 'birthday', 'resident', 'group'] as const
const loyaltyCalculationTypes = ['per_vnd_spent', 'per_booking', 'per_player', 'per_visit'] as const
const staffCommerceTabs: StaffCommerceTab[] = ['discounts', 'vouchers', 'loyalty']
const ownerEmails = ['emilejacquet@icloud.com']
const adminOnlyEmails = ['emile@vre-vietnam.com', 'contact@vre-vietnam.com']
const adminEmails = [...ownerEmails, ...adminOnlyEmails]
const staffRoleOptions: StaffRole[] = ['owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player']
const roleFilterOptions: Array<StaffRole | 'all'> = ['all', 'owner', 'admin', 'manager', 'staff', 'cashier', 'viewer', 'player']
const roleSortOptions: StaffRoleSort[] = ['name_asc', 'name_desc', 'role_desc', 'role_asc', 'email_asc']
const staffGameImageBucket = 'staff-game-images'
const staffGameImageMaxBytes = 2 * 1024 * 1024
const staffGameImageTypes = ['image/jpeg', 'image/png', 'image/webp']
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

function isOwnerEmail(email?: string | null) {
  return Boolean(email && ownerEmails.includes(email.toLowerCase()))
}

function isAdminOnlyEmail(email?: string | null) {
  return Boolean(email && adminOnlyEmails.includes(email.toLowerCase()))
}

function staffRank(role?: string | null, email?: string | null) {
  const normalizedEmail = email?.toLowerCase() || ''
  const normalizedRole = role?.toLowerCase() || ''
  if (isOwnerEmail(normalizedEmail)) return 120
  if (isAdminOnlyEmail(normalizedEmail)) return 100
  if (normalizedRole === 'super_admin' || normalizedRole === 'owner') return 120
  if (normalizedRole === 'admin') return 100
  if (normalizedRole === 'manager') return 80
  if (normalizedRole === 'staff' || normalizedRole === 'cashier') return 50
  if (normalizedRole === 'viewer') return 20
  return 0
}

function roleLabel(role?: string | null, email?: string | null): StaffRole {
  const rank = staffRank(role, email)
  if (rank >= 120) return 'owner'
  if (rank >= 100) return 'admin'
  if (rank >= 80) return 'manager'
  if (rank >= 50) return role?.toLowerCase() === 'cashier' ? 'cashier' : 'staff'
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

function shouldFallbackRoleUpdate(error: { code?: string; message?: string } | null, savedRole: StaffRole, nextRole: StaffRole) {
  if (!error && savedRole !== nextRole) return true
  const message = (error?.message || '').toLowerCase()
  return Boolean(error && (
    error.code === 'PGRST202'
    || message.includes('schema cache')
    || message.includes('could not find the function')
    || (message.includes('digest(') && message.includes('does not exist'))
    || message.includes('set_staff_profile_role')
  ))
}

function normalizeTime(value: string | null | undefined) {
  return (value || '').slice(0, 5)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `game-${Date.now()}`
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
  if (!discount || !discount.active) return 0
  if (discount.max_uses !== null && discount.used_count >= discount.max_uses) return 0

  let amount = 0
  if (discount.discount_type === 'fixed_amount') amount = discount.value
  if (discount.discount_type === 'free_ticket') amount = unitPrice
  if (['percentage', 'birthday', 'resident', 'group'].includes(discount.discount_type)) {
    amount = subtotal * Math.min(discount.value, 100) / 100
  }

  return Math.min(subtotal, Math.max(0, Math.round(amount)))
}

function formatDiscountRuleValue(discount: Pick<StaffDiscount, 'discount_type' | 'value'>, text: StaffConsoleCopy = staffConsoleText.en) {
  if (discount.discount_type === 'fixed_amount') return formatVnd(discount.value)
  if (discount.discount_type === 'free_ticket') return text.discountTypes.free_ticket
  return `${formatPercentInput(discount.value) || '0'}%`
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
  return profile.nickname || profile.full_name || profile.phone || profile.email || text.customerFallback
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

function downloadBlob(filename: string, type: string, content: BlobPart) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function xmlCell(value: unknown) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xlsxColumnName(index: number) {
  let column = ''
  let value = index
  while (value > 0) {
    const remainder = (value - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    value = Math.floor((value - 1) / 26)
  }
  return column
}

function xlsxSafeSheetName(name: string, usedNames: Set<string>) {
  const cleaned = (name || 'Report').replace(/[\[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Report'
  const base = cleaned.slice(0, 31)
  let candidate = base
  let counter = 2
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` ${counter}`
    candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    counter += 1
  }
  usedNames.add(candidate.toLowerCase())
  return candidate
}

function xlsxFilename(filename: string) {
  return filename.replace(/\.(xls|xlsx)$/i, '') + '.xlsx'
}

function xlsxCellXml(value: unknown, rowIndex: number, columnIndex: number, styleId = 0) {
  const reference = `${xlsxColumnName(columnIndex)}${rowIndex}`
  const style = styleId > 0 ? ` s="${styleId}"` : ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"${style}><v>${value}</v></c>`
  }
  return `<c r="${reference}" t="inlineStr"${style}><is><t>${xmlCell(value)}</t></is></c>`
}

function xlsxWorksheetXml(rows: Array<Record<string, unknown>>, text: StaffConsoleCopy) {
  const sourceRows = rows.length > 0 ? rows : [{ note: text.noData }]
  const sourceHeaders = Array.from(sourceRows.reduce<Set<string>>((keys, row) => {
    Object.keys(row).forEach((key) => keys.add(key))
    return keys
  }, new Set<string>()))
  const safeRows = sourceHeaders.length > 0 ? sourceRows : [{ note: text.noData }]
  const headers = sourceHeaders.length > 0 ? sourceHeaders : ['note']
  const headerRow = `<row r="1">${headers.map((header, index) => xlsxCellXml(header, 1, index + 1, 1)).join('')}</row>`
  const dataRows = safeRows.map((row, rowIndex) => {
    const excelRow = rowIndex + 2
    return `<row r="${excelRow}">${headers.map((header, columnIndex) => xlsxCellXml(row[header], excelRow, columnIndex + 1)).join('')}</row>`
  }).join('')
  const columnWidths = headers.map((header, index) => {
    const maxWidth = Math.min(46, Math.max(
      String(header).length,
      ...safeRows.map((row) => String(row[header] ?? '').length)
    ) + 2)
    return `<col min="${index + 1}" max="${index + 1}" width="${Math.max(12, maxWidth)}" customWidth="1"/>`
  }).join('')
  const filterRef = `A1:${xlsxColumnName(headers.length)}${safeRows.length + 1}`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columnWidths}</cols>
  <sheetData>${headerRow}${dataRows}</sheetData>
  <autoFilter ref="${filterRef}"/>
</worksheet>`
}

function xlsxWorkbookXml(sheetNames: string[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNames.map((name, index) => `<sheet name="${xmlCell(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>
</workbook>`
}

function xlsxWorkbookRels(sheetCount: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${Array.from({ length: sheetCount }, (_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('')}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function xlsxContentTypes(sheetCount: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${Array.from({ length: sheetCount }, (_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('')}
</Types>`
}

function xlsxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><name val="Arial"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF4F7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
}

const xlsxCrcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let crc = index
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1)
    }
    table[index] = crc >>> 0
  }
  return table
})()

function xlsxCrc32(bytes: Uint8Array) {
  let crc = 0xFFFFFFFF
  bytes.forEach((byte) => {
    crc = xlsxCrcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  })
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function xlsxUint16(value: number) {
  return Uint8Array.of(value & 0xFF, (value >>> 8) & 0xFF)
}

function xlsxUint32(value: number) {
  return Uint8Array.of(value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF)
}

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(totalLength)
  let offset = 0
  chunks.forEach((chunk) => {
    output.set(chunk, offset)
    offset += chunk.length
  })
  return output
}

function buildZipFile(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder()
  const localFiles: Uint8Array[] = []
  const centralFiles: Uint8Array[] = []
  let offset = 0

  files.forEach((file) => {
    const name = encoder.encode(file.path)
    const content = encoder.encode(file.content)
    const crc = xlsxCrc32(content)
    const localHeader = concatBytes([
      xlsxUint32(0x04034B50),
      xlsxUint16(20),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint32(crc),
      xlsxUint32(content.length),
      xlsxUint32(content.length),
      xlsxUint16(name.length),
      xlsxUint16(0),
      name,
      content,
    ])
    localFiles.push(localHeader)
    centralFiles.push(concatBytes([
      xlsxUint32(0x02014B50),
      xlsxUint16(20),
      xlsxUint16(20),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint32(crc),
      xlsxUint32(content.length),
      xlsxUint32(content.length),
      xlsxUint16(name.length),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint16(0),
      xlsxUint32(0),
      xlsxUint32(offset),
      name,
    ]))
    offset += localHeader.length
  })

  const centralDirectory = concatBytes(centralFiles)
  const endRecord = concatBytes([
    xlsxUint32(0x06054B50),
    xlsxUint16(0),
    xlsxUint16(0),
    xlsxUint16(files.length),
    xlsxUint16(files.length),
    xlsxUint32(centralDirectory.length),
    xlsxUint32(offset),
    xlsxUint16(0),
  ])

  return concatBytes([...localFiles, centralDirectory, endRecord])
}

function buildXlsxWorkbook(sections: Array<{ title: string; rows: Array<Record<string, unknown>> }>, text: StaffConsoleCopy) {
  const usedSheetNames = new Set<string>()
  const sheets = sections.length > 0 ? sections : [{ title: 'Report', rows: [{ note: text.noData }] }]
  const sheetNames = sheets.map((section) => xlsxSafeSheetName(section.title, usedSheetNames))
  const files: Array<{ path: string; content: string }> = [
    { path: '[Content_Types].xml', content: xlsxContentTypes(sheets.length) },
    { path: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { path: 'xl/workbook.xml', content: xlsxWorkbookXml(sheetNames) },
    { path: 'xl/_rels/workbook.xml.rels', content: xlsxWorkbookRels(sheets.length) },
    { path: 'xl/styles.xml', content: xlsxStylesXml() },
    ...sheets.map((section, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: xlsxWorksheetXml(section.rows, text),
    })),
  ]
  return buildZipFile(files)
}

function downloadExcel(filename: string, sections: Array<{ title: string; rows: Array<Record<string, unknown>> }>, text: StaffConsoleCopy = staffConsoleText.en) {
  downloadBlob(
    xlsxFilename(filename),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buildXlsxWorkbook(sections, text)
  )
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ')
  if (/[",]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>, text: StaffConsoleCopy = staffConsoleText.en) {
  const safeRows = rows.length > 0 ? rows : [{ note: text.noData }]
  const headers = Array.from(safeRows.reduce<Set<string>>((keys, row) => {
    Object.keys(row).forEach((key) => keys.add(key))
    return keys
  }, new Set<string>()))
  const csv = [
    headers.map(csvCell).join(','),
    ...safeRows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n')
  downloadBlob(filename, 'text/csv;charset=utf-8;', `\uFEFF${csv}`)
}

function pdfSafeText(value: unknown) {
  return String(value ?? '')
    .replace(/[đ₫]/gi, 'VND')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function buildSimplePdf(lines: string[], text: StaffConsoleCopy = staffConsoleText.en) {
  const streamLines = [
    'BT',
    '/F1 18 Tf',
    '42 792 Td',
    `(${pdfSafeText(lines[0] || text.reportTitleFallback)}) Tj`,
    '/F1 10 Tf',
    ...lines.slice(1, 48).flatMap((line) => ['0 -16 Td', `(${pdfSafeText(line)}) Tj`]),
    'ET',
  ]
  const stream = streamLines.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  const chunks = ['%PDF-1.4\n']
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(chunks.join('').length)
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`)
  })
  const xrefOffset = chunks.join('').length
  chunks.push(`xref\n0 ${objects.length + 1}\n`)
  chunks.push('0000000000 65535 f \n')
  offsets.slice(1).forEach((offset) => chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`))
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  return chunks.join('')
}

function downloadPdf(filename: string, lines: string[], text: StaffConsoleCopy = staffConsoleText.en) {
  downloadBlob(filename, 'application/pdf', buildSimplePdf(lines, text))
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

type AccountantExportContext = {
  report: StaffReportSummary
  orders: StaffOrder[]
  games: StaffGame[]
  paymentsByOrderId: Map<string, StaffOrderPayment[]>
  discounts: StaffDiscount[]
  loyaltyRules: StaffLoyaltyRule[]
  auditLogs: StaffAuditLog[]
  text: StaffConsoleCopy
  reportStart: string
  reportEnd: string
  storeLabel: string
  language: StaffConsoleLanguage
  includeAttachments: boolean
}

function accountantCustomer(order: StaffOrder, text: StaffConsoleCopy) {
  return order.customer_name || order.customer_phone || order.customer_email || text.walkIn
}

function accountantGameName(order: StaffOrder, games: StaffGame[]) {
  return games.find((game) => game.id === order.game_id)?.name || ''
}

function accountantDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${dateInputValue(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function accountantJsonValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function accountantFirstPayment(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>) {
  return [...staffOrderPaymentRows(order, paymentsByOrderId)].sort((left, right) => (
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  ))[0] || null
}

function accountantPaymentDate(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>) {
  return (accountantFirstPayment(order, paymentsByOrderId)?.created_at || order.created_at).slice(0, 10)
}

function accountantIsRecognized(order: StaffOrder) {
  return order.order_status === 'completed' || order.booking_date <= todayString()
}

function accountantVatSplit(total: number) {
  const net = Math.round(total / 1.08)
  return { net, vat: Math.max(total - net, 0) }
}

function accountantSourcePendingRow(columns: string[], context: AccountantExportContext) {
  const noteColumn = columns.includes('Notes') ? 'Notes' : columns[columns.length - 1]
  return columns.reduce<Record<string, unknown>>((row, column, index) => {
    row[column] = column === noteColumn || (index === 0 && !noteColumn)
      ? context.text.messages.accountantExportSourcePending
      : ''
    return row
  }, {})
}

function accountantExportInfoRows(reportTitle: string, context: AccountantExportContext) {
  return [
    { Field: 'Report', Value: reportTitle },
    { Field: 'Period', Value: rangeLabel(context.reportStart, context.reportEnd) },
    { Field: 'Store / location', Value: context.storeLabel },
    { Field: 'Language', Value: context.language.toUpperCase() },
    { Field: 'Attachments list included', Value: context.includeAttachments ? context.text.labels.yes : context.text.labels.no },
    { Field: 'Exported at', Value: accountantDateTime(new Date().toISOString()) },
  ]
}

function buildAccountantExportRows(reportId: AccountantExportReportId, context: AccountantExportContext) {
  if (reportId === 'sales_revenue') {
    return context.orders.map((order) => {
      const paid = orderPaidAmount(order, context.paymentsByOrderId)
      return {
        Date: order.booking_date,
        'Order number': order.order_number,
        Customer: accountantCustomer(order, context.text),
        Game: accountantGameName(order, context.games),
        Players: order.players_count,
        Subtotal: order.subtotal,
        Discount: order.discount_total,
        'Total revenue': order.total,
        'Paid amount': paid,
        'Unpaid amount': Math.max(order.total - paid, 0),
        'Payment method': orderPaymentLabel(order, context.paymentsByOrderId, context.text),
        'Payment status': paymentStatusLabel(order.payment_status, context.text),
        'Order status': context.text.orderStatuses[order.order_status],
        Ref: order.order_number,
      }
    })
  }

  if (reportId === 'einvoice_reconciliation') {
    return context.orders.map((order) => ({
      Date: order.booking_date,
      'Order number': order.order_number,
      Customer: accountantCustomer(order, context.text),
      'Company name': order.company_name || '',
      'Tax code': order.tax_code || '',
      'Invoice email': order.invoice_email || '',
      'Invoice address': order.invoice_address || '',
      'Invoice required?': order.invoice_required ? context.text.labels.yes : context.text.labels.no,
      'Invoice status': order.invoice_status,
      'External invoice ID': order.external_invoice_id || '',
      Total: order.total,
      Ref: order.order_number,
    }))
  }

  if (reportId === 'payments_reconciliation') {
    return context.orders.flatMap((order) => {
      const payments = staffOrderPaymentRows(order, context.paymentsByOrderId)
      if (payments.length > 0) {
        return payments.map((payment) => ({
          'Payment date/time': accountantDateTime(payment.created_at),
          'Order number': order.order_number,
          Customer: accountantCustomer(order, context.text),
          Method: paymentMethodLabel(payment.payment_method, context.text),
          Amount: payment.amount,
          'Order total': order.total,
          'Payment status': paymentStatusLabel(order.payment_status, context.text),
          'Remaining balance': Math.max(order.total - orderPaidAmount(order, context.paymentsByOrderId), 0),
          Ref: payment.id,
        }))
      }
      const paid = orderPaidAmount(order, context.paymentsByOrderId)
      return [{
        'Payment date/time': accountantDateTime(order.created_at),
        'Order number': order.order_number,
        Customer: accountantCustomer(order, context.text),
        Method: paymentMethodLabel(order.payment_method, context.text),
        Amount: paid,
        'Order total': order.total,
        'Payment status': paymentStatusLabel(order.payment_status, context.text),
        'Remaining balance': Math.max(order.total - paid, 0),
        Ref: order.order_number,
      }]
    })
  }

  if (reportId === 'refunds_adjustments') {
    return context.orders
      .filter((order) => (
        order.order_status === 'cancelled'
        || order.order_status === 'refunded'
        || order.order_status === 'no_show'
        || order.payment_status === 'refunded'
        || order.discount_total > 0
      ))
      .map((order) => ({
        'Date/time': accountantDateTime(order.updated_at || order.created_at),
        'Order number': order.order_number,
        Customer: accountantCustomer(order, context.text),
        Action: order.payment_status === 'refunded' || order.order_status === 'refunded'
          ? 'Refund'
          : order.order_status === 'cancelled'
            ? 'Cancellation'
            : order.discount_total > 0
              ? 'Discount adjustment'
              : context.text.orderStatuses[order.order_status],
        Before: order.subtotal,
        Adjustment: order.discount_total > 0 ? -order.discount_total : 0,
        After: order.total,
        'Payment status': paymentStatusLabel(order.payment_status, context.text),
        'Order status': context.text.orderStatuses[order.order_status],
        Reason: order.internal_note || '',
        Ref: order.order_number,
      }))
  }

  if (reportId === 'discounts_vouchers') {
    const discountRows = context.discounts.map((discount) => ({
      Source: 'Discount / voucher rule',
      Code: discount.code || '',
      Name: discount.name,
      Type: context.text.discountTypes[discount.discount_type],
      Value: discount.value,
      'Value unit': discount.discount_type === 'fixed_amount' ? 'VND' : '%',
      'Used count': discount.used_count,
      'Max uses': discount.max_uses ?? '',
      'Valid from': discount.valid_from,
      'Valid until': discount.valid_until || '',
      Active: discount.active ? context.text.active : context.text.inactive,
      'Order number': '',
      'Discount amount': '',
      'Order total': '',
    }))
    const orderDiscountRows = context.orders
      .filter((order) => order.discount_total > 0 || order.discount_code)
      .map((order) => ({
        Source: 'Applied discount',
        Code: order.discount_code || '',
        Name: '',
        Type: '',
        Value: '',
        'Value unit': '',
        'Used count': '',
        'Max uses': '',
        'Valid from': '',
        'Valid until': '',
        Active: '',
        'Order number': order.order_number,
        'Discount amount': order.discount_total,
        'Order total': order.total,
      }))
    return [...discountRows, ...orderDiscountRows]
  }

  if (reportId === 'daily_cash_closing') {
    return [{
      Date: rangeLabel(context.reportStart, context.reportEnd),
      Store: context.storeLabel,
      'Cash sales': context.report.cashTotal,
      'Bank transfer': context.report.bankTransferTotal,
      'Total paid': context.report.totalPaid,
      Unpaid: context.report.unpaidAmount,
      Discounts: context.report.discounts,
      Bookings: context.report.bookings,
      Players: context.report.players,
      Cancelled: context.report.cancelled,
      'No-shows': context.report.noShows,
      'Best-selling game': context.report.bestSellingGame,
      'Cash counted': '',
      Difference: '',
      'Closed by': '',
    }]
  }

  if (reportId === 'expenses_purchases') {
    return [accountantSourcePendingRow([
      'Expense date',
      'Supplier',
      'Category',
      'Description',
      'Amount',
      'Input VAT',
      'Payment method',
      'Paid by',
      'Receipt / attachment',
      'Notes',
    ], context)]
  }

  if (reportId === 'vat_input_output') {
    return context.orders.map((order) => {
      const { net, vat } = accountantVatSplit(order.total)
      return {
        Date: order.booking_date,
        Type: 'Output VAT',
        'Order number': order.order_number,
        Customer: accountantCustomer(order, context.text),
        'Tax code': order.tax_code || '',
        'Net amount': net,
        'VAT amount': vat,
        'Gross total': order.total,
        'Invoice status': order.invoice_status,
        Ref: order.external_invoice_id || order.order_number,
      }
    })
  }

  if (reportId === 'payroll_staff') {
    return [accountantSourcePendingRow([
      'Staff',
      'Role',
      'Work date',
      'Hours',
      'Rate',
      'Gross pay',
      'Bonus',
      'Deductions',
      'Net pay',
      'Notes',
    ], context)]
  }

  if (reportId === 'inventory_movement') {
    return [accountantSourcePendingRow([
      'SKU',
      'Product',
      'Opening stock',
      'Stock in',
      'Stock out sold',
      'Stock out gift',
      'Damaged/lost',
      'Closing stock',
      'Unit cost',
      'Stock value',
      'Notes',
    ], context)]
  }

  if (reportId === 'deferred_revenue_bookings') {
    return context.orders
      .filter((order) => orderPaidAmount(order, context.paymentsByOrderId) > 0 || order.booking_date > todayString())
      .map((order) => {
        const paid = orderPaidAmount(order, context.paymentsByOrderId)
        const recognized = accountantIsRecognized(order)
        return {
          'Booking ID': order.order_number,
          'Payment date': accountantPaymentDate(order, context.paymentsByOrderId),
          'Play date': order.booking_date,
          'Amount paid': paid,
          'Revenue recognized?': recognized ? context.text.labels.yes : context.text.labels.no,
          'Recognized date': recognized ? order.booking_date : '',
          Status: context.text.orderStatuses[order.order_status],
          'Liability balance': recognized ? 0 : paid,
        }
      })
  }

  if (reportId === 'accountant_journal') {
    return context.orders.flatMap((order) => {
      const { net, vat } = accountantVatSplit(order.total)
      const payments = staffOrderPaymentRows(order, context.paymentsByOrderId)
      const paidRows = payments.length > 0
        ? payments.map((payment) => ({
          Date: payment.created_at.slice(0, 10),
          'Journal type': 'Sales',
          'Account code': payment.payment_method === 'bank_transfer' ? 'Bank' : 'Cash',
          Debit: payment.amount,
          Credit: '',
          Description: `VR ticket sale - ${accountantGameName(order, context.games)}`,
          Ref: order.order_number,
        }))
        : [{
          Date: order.created_at.slice(0, 10),
          'Journal type': 'Sales',
          'Account code': order.payment_method === 'bank_transfer' ? 'Bank' : 'Cash',
          Debit: orderPaidAmount(order, context.paymentsByOrderId),
          Credit: '',
          Description: `VR ticket sale - ${accountantGameName(order, context.games)}`,
          Ref: order.order_number,
        }]
      return [
        ...paidRows,
        {
          Date: order.booking_date,
          'Journal type': 'Sales',
          'Account code': 'Revenue',
          Debit: '',
          Credit: net,
          Description: `VR ticket sale - ${accountantGameName(order, context.games)}`,
          Ref: order.order_number,
        },
        {
          Date: order.booking_date,
          'Journal type': 'Sales',
          'Account code': 'Output VAT',
          Debit: '',
          Credit: vat,
          Description: 'VAT',
          Ref: order.external_invoice_id || order.order_number,
        },
      ]
    })
  }

  if (reportId === 'audit_trail') {
    return context.auditLogs.map((log) => ({
      'Date/time': accountantDateTime(log.created_at),
      User: log.actor_user_id || '',
      Role: '',
      Action: log.action,
      Before: accountantJsonValue(log.old_value),
      After: accountantJsonValue(log.new_value),
      'Reason required?': /delete|refund|cancel|price|discount|role/i.test(log.action) ? context.text.labels.yes : context.text.labels.no,
      Approval: 'Recorded',
      'IP/device': '',
    }))
  }

  return []
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
  if (total <= 0) return '#dfe7eb 0deg 360deg'
  const colors = ['#00aeb3', '#3059ff', '#b8c3c8']
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
  return {
    report: reportSummaryFromRpc(payload.report, text),
    comparisonReport: reportSummaryFromRpc(payload.comparisonReport ?? payload.comparison_report, text),
    reportSeries: dailySeriesFromRpc(payload.reportSeries ?? payload.report_series),
    comparisonSeries: dailySeriesFromRpc(payload.comparisonSeries ?? payload.comparison_series),
    orders: Array.isArray(payload.orders) ? payload.orders as StaffOrder[] : [],
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

export default function StaffConsole({ profile, authEmail, language, onOpenSessionCalendar }: StaffConsoleProps) {
  const text = staffConsoleText[resolveStaffConsoleLanguage(language)]
  const rank = Math.max(staffRank(profile?.role, profile?.email), staffRank(profile?.role, authEmail))
  const role = roleLabel(profile?.role, staffRank(null, authEmail) > staffRank(null, profile?.email) ? authEmail : profile?.email)
  const canManageConfig = rank >= 80
  const canCreateOrders = rank >= 50
  const canManageRoles = rank >= 100
  const canRestoreDeleted = rank >= 120
  const [activeTab, setActiveTab] = useState<StaffTab>(rank >= 50 ? 'new' : 'report')
  const [commerceTab, setCommerceTab] = useState<StaffCommerceTab>('discounts')
  const [games, setGames] = useState<StaffGame[]>([])
  const [prices, setPrices] = useState<StaffPriceRule[]>([])
  const [discounts, setDiscounts] = useState<StaffDiscount[]>([])
  const [loyaltyRules, setLoyaltyRules] = useState<StaffLoyaltyRule[]>([])
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [orderPayments, setOrderPayments] = useState<StaffOrderPayment[]>([])
  const [operationSessions, setOperationSessions] = useState<StaffOperationSession[]>([])
  const [profiles, setProfiles] = useState<StaffProfile[]>([])
  const [auditLogs, setAuditLogs] = useState<StaffAuditLog[]>([])
  const [deletedRecords, setDeletedRecords] = useState<SoftDeletedRecord[]>([])
  const [booking, setBooking] = useState<BookingForm>(() => defaultBookingForm())
  const [gameForm, setGameForm] = useState(() => defaultGameForm())
  const [priceForm, setPriceForm] = useState(() => defaultPriceForm())
  const [discountForm, setDiscountForm] = useState(() => defaultDiscountForm())
  const [loyaltyForm, setLoyaltyForm] = useState(() => defaultLoyaltyForm())
  const [reportStart, setReportStart] = useState(todayString())
  const [reportEnd, setReportEnd] = useState(todayString())
  const [operationsDate, setOperationsDate] = useState(todayString())
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
    const staffTabs: StaffTab[] = ['new', 'today', 'games', 'prices', 'discounts', 'roles', 'orders', 'report']
    if (rank >= 120) return ['new', 'today', 'games', 'prices', 'discounts', 'roles', 'restore', 'orders', 'report']
    if (rank >= 20) return staffTabs
    return ['report']
  }, [rank])
  const currentTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0]
  const canEditCommerceTab = commerceTab === 'loyalty' ? canManageConfig : canCreateOrders

  const activeGames = useMemo(() => games.filter((game) => game.active), [games])
  const discountRules = useMemo(() => discounts.filter((discount) => !discount.code), [discounts])
  const voucherRules = useMemo(() => discounts.filter((discount) => Boolean(discount.code)), [discounts])
  const selectedGame = useMemo(() => activeGames.find((game) => game.id === booking.gameId) || activeGames[0] || null, [activeGames, booking.gameId])
  const selectedDiscount = useMemo(() => discounts.find((discount) => discount.id === booking.discountId) || null, [booking.discountId, discounts])
  const selectedRule = useMemo(() => {
    if (!selectedGame) return null
    return selectPricingRule(prices, selectedGame.id, booking.date, booking.time)
  }, [booking.date, booking.time, prices, selectedGame])

  const quote = useMemo(() => {
    const unitPrice = selectedRule?.price_per_player || 200000
    const durationBlocks = Math.max(1, Math.ceil((selectedGame?.duration_minutes || 20) / 20))
    const subtotal = selectedRule?.price_per_arena_slot
      ? selectedRule.price_per_arena_slot * durationBlocks
      : unitPrice * booking.players
    const manualDiscountTotal = calculateManualDiscount(booking.manualDiscountType, booking.manualDiscountValue, subtotal)
    const discountTotal = manualDiscountTotal > 0
      ? manualDiscountTotal
      : calculateDiscount(selectedDiscount, subtotal, unitPrice)
    return {
      unitPrice,
      subtotal,
      discountTotal,
      discountLabel: manualDiscountTotal > 0
        ? manualDiscountLabel(booking.manualDiscountType, booking.manualDiscountValue, text)
        : selectedDiscount?.name || text.noDiscount,
      total: Math.max(0, subtotal - discountTotal),
      ruleName: selectedRule?.rule_name || text.defaultWalkInRate,
      duration: selectedGame?.duration_minutes || 20,
    }
  }, [booking.manualDiscountType, booking.manualDiscountValue, booking.players, selectedDiscount, selectedGame, selectedRule, text])
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

      if (roleSort === 'name_desc') return rightName.localeCompare(leftName) || leftEmail.localeCompare(rightEmail)
      if (roleSort === 'role_desc') return rightRank - leftRank || leftName.localeCompare(rightName)
      if (roleSort === 'role_asc') return leftRank - rightRank || leftName.localeCompare(rightName)
      if (roleSort === 'email_asc') return leftEmail.localeCompare(rightEmail) || leftName.localeCompare(rightName)
      return leftName.localeCompare(rightName) || leftEmail.localeCompare(rightEmail)
    })
  }, [profiles, roleFilter, roleSearch, roleSort, text])

  const emptyReport = useMemo(() => emptyStaffReport(text), [text])
  const reportOrders = reportSnapshot?.orders ?? emptyStaffOrders
  const reportPayments = reportSnapshot?.payments ?? emptyStaffPayments
  const reportPaymentsByOrderId = useMemo(() => paymentMapFromRows(reportPayments), [reportPayments])
  const report = reportSnapshot?.report || emptyReport
  const comparisonReport = compareEnabled ? reportSnapshot?.comparisonReport || emptyReport : emptyReport
  const reportSeries = reportSnapshot?.reportSeries ?? emptyStaffDailySeries
  const comparisonSeries = compareEnabled ? reportSnapshot?.comparisonSeries ?? emptyStaffDailySeries : emptyStaffDailySeries
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
  const currentTabLoading = Boolean(
    currentTab === 'new'
      ? loadingData.games || loadingData.prices || loadingData.discounts || loadingData.profiles
      : currentTab === 'today'
        ? loadingData.games || loadingData.today || loadingData.todaySessions
        : currentTab === 'games'
          ? loadingData.games
          : currentTab === 'prices'
            ? loadingData.games || loadingData.prices
            : currentTab === 'discounts'
              ? loadingData.discounts || (commerceTab === 'loyalty' && (loadingData.games || loadingData.loyalty))
              : currentTab === 'roles'
                ? loadingData.profiles
                : currentTab === 'restore'
                  ? loadingData.restore
                  : currentTab === 'orders'
                    ? loadingData.games || loadingData.orders
                    : loadingData.games || loadingData.audit || loadingData.report
  )

  useEffect(() => {
    if (currentTab === 'new') {
      void Promise.all([loadGames(), loadPrices(), loadDiscounts(), loadProfiles()])
    } else if (currentTab === 'today') {
      void Promise.all([loadGames(), loadTodayOrders(true), loadTodaySessions(true)])
    } else if (currentTab === 'games') {
      void loadGames()
    } else if (currentTab === 'prices') {
      void Promise.all([loadGames(), loadPrices()])
    } else if (currentTab === 'discounts') {
      const loaders: Array<Promise<void>> = [loadDiscounts()]
      if (commerceTab === 'loyalty') loaders.push(loadGames(), loadLoyaltyRules())
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
  }, [currentTab, commerceTab, operationsDate])

  useEffect(() => {
    if (currentTab !== 'report') return
    void Promise.all([loadGames(), loadAuditLogs(), loadReportData(true)])
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
      const rpcResult = await supabase.rpc('profile_search', {
        p_search: null,
        p_limit: 500,
        p_offset: 0,
        p_role: 'all',
        p_include_demo: false,
        p_sort: roleSort,
      })

      if (!rpcResult.error && rpcResult.data) {
        setProfiles((rpcResult.data as StaffProfile[]).filter((item) => !isDemoProfile(item)))
        setPendingRoleChanges({})
        return
      }

      if (rpcResult.error && !rpcFunctionMissing(rpcResult.error)) {
        throw new Error(rpcResult.error.message)
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, nickname, email, phone, role, is_seed_demo, seed_batch')
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
        .limit(500)
      if (error) throw new Error(error.message)
      setProfiles(((data ?? []) as StaffProfile[]).filter((item) => !isDemoProfile(item)))
      setPendingRoleChanges({})
    }, force)
  }

  async function loadAuditLogs(force = false) {
    await runStaffLoader('audit', async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, actor_user_id, action, entity_type, entity_id, old_value, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(60)
      if (error) throw new Error(error.message)
      setAuditLogs((data ?? []) as StaffAuditLog[])
    }, force)
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
    await loadOrdersForRange('today', operationsDate, operationsDate, force)
  }

  async function loadTodaySessions(force = false) {
    await runStaffLoader('todaySessions', async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, owner_id, name, date, start_time, duration_minutes, max_players, arena_count, game_options, confirmed_game_id, visibility, status, booking_type, ticket_type, ticket_player_count, ticket_total_price, ticket_status, ticket_reference, session_participants(id, profile_id, display_name, checked_in, payment_status, payment_amount, payment_splits)')
        .eq('date', operationsDate)
        .is('session_participants.deleted_at', null)
        .order('start_time', { ascending: true })

      if (error) throw new Error(error.message)
      setOperationSessions((data ?? []) as StaffOperationSession[])
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
      payments,
    })
  }

  async function loadReportData(force = false) {
    await runStaffLoader('report', async () => {
      const reportArgs = {
        p_start_date: reportStart,
        p_end_date: reportEnd,
        p_compare_start: compareEnabled ? compareStart : null,
        p_compare_end: compareEnabled ? compareEnd : null,
        p_order_limit: 120,
      }
      const { data, error } = await supabase.rpc('staff_report_summary', reportArgs)
      if (!error) {
        setReportSnapshot(staffReportSnapshotFromRpc(data, text))
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
      setReportSnapshot(staffReportSnapshotFromRpc(legacyResult.data, text))
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
      p_discount_rule_id: hasManualDiscount ? null : booking.discountId || null,
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
    markStaffDataStale('today', 'orders', 'report', 'audit')
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
    setSaving(true)
    const audience = normalizeStaffAudience(gameForm.audience)
    const payload = {
      slug: gameForm.slug || slugify(gameForm.name),
      name: gameForm.name.trim(),
      game_type: gameForm.game_type,
      duration_minutes: Number(gameForm.duration_minutes),
      max_players_per_arena: Number(gameForm.max_players_per_arena),
      number_of_rounds: Number(gameForm.number_of_rounds),
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
    setSaving(true)
    const isVoucher = Boolean(discountForm.code.trim())
    const payload = {
      code: discountForm.code.trim() || null,
      name: discountForm.name.trim(),
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
    setSaving(true)
    const payload = {
      rule_name: loyaltyForm.rule_name.trim(),
      game_id: loyaltyForm.game_id || null,
      calculation_type: loyaltyForm.calculation_type,
      points_value: Number(loyaltyForm.points_value) || 0,
      spend_amount: Number(loyaltyForm.spend_amount) || 0,
      min_order_total: Number(loyaltyForm.min_order_total) || 0,
      point_expiry_days: loyaltyForm.point_expiry_days ? Number(loyaltyForm.point_expiry_days) : null,
      valid_from: loyaltyForm.valid_from,
      valid_until: loyaltyForm.valid_until || null,
      active: loyaltyForm.active,
      notes: loyaltyForm.notes.trim() || null,
      created_by: profile?.id || null,
    }
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
      markStaffDataStale('today', 'orders', 'report', 'audit')
      if (currentTab === 'today') await loadTodayOrders(true)
      if (currentTab === 'orders') await loadRecentOrders(true)
      if (currentTab === 'report') await Promise.all([loadReportData(true), loadAuditLogs(true)])
    }
    setSaving(false)
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

    let savedRole = storedRoleValue((data as { role?: string | null } | null)?.role || '')
    let saveError = error?.message || ''

    if (shouldFallbackRoleUpdate(error, savedRole, nextRole)) {
      const directUpdate = await supabase
        .from('profiles')
        .update({ role: nextRole, updated_at: new Date().toISOString() })
        .eq('id', profileId)
        .is('deleted_at', null)
        .select('id, role')
        .maybeSingle()

      if (directUpdate.error) {
        saveError = `${error?.message ? `${error.message} ` : ''}${directUpdate.error.message}`.trim()
      } else {
        savedRole = storedRoleValue(directUpdate.data?.role || '')
        saveError = ''
      }
    }

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
      markStaffDataStale('profiles', 'audit')
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
      markStaffDataStale('profiles', 'restore', 'audit')
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
      markStaffDataStale('restore', 'profiles', 'audit')
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

  function exportExcelReport() {
    downloadExcel(`vrena-daily-report-${reportStart}-${reportEnd}.xlsx`, [
      { title: `${text.tabs.report} ${rangeLabel(reportStart, reportEnd)}`, rows: staffReportRows(report, text) },
      { title: text.labels.orders, rows: staffOrderExportRows(reportOrders, games, reportPaymentsByOrderId, text) },
    ], text)
  }

  function exportPdfReport() {
    downloadPdf(
      `vrena-daily-report-${reportStart}-${reportEnd}.pdf`,
      reportPdfLines(`${text.tabs.report} ${rangeLabel(reportStart, reportEnd)}`, report, reportOrders, games, reportPaymentsByOrderId, text),
      text
    )
  }

  function downloadAccountantExport() {
    const reportDefinition = accountantExportReports.find((item) => item.id === accountantReportId) || accountantExportReports[0]
    const storeDefinition = accountantExportStores.find((item) => item.id === accountantExportStore) || accountantExportStores[0]
    const exportText = staffConsoleText[accountantExportLanguage]
    const exportContext: AccountantExportContext = {
      report,
      orders: reportOrders,
      games,
      paymentsByOrderId: reportPaymentsByOrderId,
      discounts,
      loyaltyRules,
      auditLogs,
      text: exportText,
      reportStart,
      reportEnd,
      storeLabel: storeDefinition.label[accountantExportLanguage],
      language: accountantExportLanguage,
      includeAttachments: accountantIncludeAttachments,
    }
    const reportTitle = reportDefinition.label[accountantExportLanguage]
    const rows = buildAccountantExportRows(reportDefinition.id, exportContext)
    const suffix = `${reportStart}_${reportEnd}`
    if (accountantExportFormat === 'csv') {
      downloadCsv(`${reportDefinition.fileBase}_${suffix}.csv`, rows, exportText)
      return
    }
    downloadExcel(`${reportDefinition.fileBase}_${suffix}.xlsx`, [
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
      <button className={currentTab === tab ? 'active' : ''} type="button" onClick={() => setActiveTab(tab)}>
        {label}
      </button>
    )
  )

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
                    <button type="button" onClick={() => updateOrder(order, { payment_status: 'paid', order_status: 'paid' })}>{text.actions.paid}</button>
                    <button type="button" onClick={() => updateOrder(order, { order_status: 'completed' })}>{text.actions.done}</button>
                    <button type="button" onClick={() => updateOrder(order, { order_status: 'no_show' })}>{text.actions.noShow}</button>
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
      <section className="section staff-console">
        <h2>{text.title}</h2>
        <p className="notice">{text.accessRequired}</p>
      </section>
    )
  }

  return (
    <section className="section staff-console">
      <div className="section-head">
        <div>
          <h2>{text.title}</h2>
        </div>
        <span className="staff-role-pill">{staffRoleName(role, text)}</span>
      </div>

      <div className="staff-tabs" role="tablist" aria-label={text.aria.staffConsole}>
        {tabButton('new', text.tabs.new)}
        {tabButton('today', text.tabs.today)}
        {tabButton('games', text.tabs.games)}
        {tabButton('prices', text.tabs.prices)}
        {tabButton('discounts', text.tabs.discounts)}
        {tabButton('roles', text.tabs.roles)}
        {tabButton('restore', text.tabs.restore)}
        {tabButton('orders', text.tabs.orders)}
        {tabButton('report', text.tabs.report)}
      </div>

      {status && <p className="sr-only" aria-live="polite">{status}</p>}
      {currentTabLoading && <p className="notice" aria-busy="true">{text.loading}</p>}

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
                {text.actions.calendar}
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
              <label>
                {text.labels.customerName}
                <input value={booking.customerName} onChange={(event) => setBooking({ ...booking, customerName: event.target.value })} />
              </label>
              <label>
                {text.labels.phone}
                <input value={booking.customerPhone} onChange={(event) => setBooking({ ...booking, customerPhone: event.target.value })} />
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
                  {discounts.filter((discount) => discount.active).map((discount) => (
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
                  <button type="button" onClick={addBookingPaymentSplit}>{text.actions.addSplit}</button>
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
                      <button className="secondary" type="button" onClick={() => removeBookingPaymentSplit(split.id)}>{text.actions.remove}</button>
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
                  {text.actions.sessionCalendar}
                </button>
              )}
              <button type="button" onClick={() => setOperationsDate(todayString())}>{text.actions.today}</button>
              {canCreateOrders && (
                <button
                  className="staff-calendar-shortcut"
                  type="button"
                  onClick={() => {
                    setBooking((current) => ({ ...current, date: operationsDate }))
                    setActiveTab('new')
                  }}
                >
                  {text.tabs.new}
                </button>
              )}
            </div>
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
                  {order && canCreateOrders && (
                    <div className="staff-row-actions staff-operation-actions">
                      <button type="button" onClick={() => updateOrder(order, { payment_status: 'paid', order_status: 'paid' })}>{text.actions.paid}</button>
                      <button type="button" onClick={() => updateOrder(order, { order_status: 'completed' })}>{text.actions.done}</button>
                      <button type="button" onClick={() => updateOrder(order, { order_status: 'no_show' })}>{text.actions.noShow}</button>
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
            <button className="primary" type="button" disabled={saving || !gameForm.name.trim()} onClick={saveGame}>{text.actions.saveGame}</button>
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
            <button className="primary" type="button" disabled={saving || !priceForm.rule_name.trim()} onClick={savePrice}>{text.actions.savePrice}</button>
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
                  <label>{text.labels.pointsExpireAfterDays}<input min={1} type="number" value={loyaltyForm.point_expiry_days} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, point_expiry_days: event.target.value })} /></label>
                  <label>{text.labels.validFrom}<StaffPickerField ariaLabel={text.aria.loyaltyValidFrom} placeholder={text.chooseDate} type="date" value={loyaltyForm.valid_from} onChange={(value) => setLoyaltyForm({ ...loyaltyForm, valid_from: value })} /></label>
                  <label>{text.labels.validUntil}<StaffPickerField ariaLabel={text.aria.loyaltyValidUntil} placeholder={text.chooseDate} type="date" value={loyaltyForm.valid_until} onChange={(value) => setLoyaltyForm({ ...loyaltyForm, valid_until: value })} /></label>
                  <label className="full">{text.labels.notes}<textarea value={loyaltyForm.notes} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, notes: event.target.value })} /></label>
                  <label className="checkbox-row"><input type="checkbox" checked={loyaltyForm.active} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, active: event.target.checked })} /> {text.labels.active}</label>
                </div>
                <button className="primary" type="button" disabled={saving || !loyaltyForm.rule_name.trim()} onClick={saveLoyaltyRule}>{text.actions.saveLoyaltyRule}</button>
                </fieldset>
              </>
            ) : (
              <>
                <h3>
                  {discountForm.id
                    ? (commerceTab === 'vouchers' ? text.editVoucher : text.editDiscount)
                    : (commerceTab === 'vouchers' ? text.labels.createVoucher : text.labels.createDiscount)}
                </h3>
                <fieldset className="staff-readonly-fieldset" disabled={!canEditCommerceTab}>
                <div className="form-grid compact-form-grid">
                  <label>{commerceTab === 'vouchers' ? text.labels.voucherCodeRequired : text.labels.codeOptional}<input value={discountForm.code} onChange={(event) => setDiscountForm({ ...discountForm, code: event.target.value.toUpperCase() })} /></label>
                  <label>{text.labels.name}<input value={discountForm.name} onChange={(event) => setDiscountForm({ ...discountForm, name: event.target.value })} /></label>
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
                  <label>{text.labels.validFrom}<StaffPickerField ariaLabel={text.aria.discountValidFrom} placeholder={text.chooseDate} type="date" value={discountForm.valid_from} onChange={(value) => setDiscountForm({ ...discountForm, valid_from: value })} /></label>
                  <label>{text.labels.validUntil}<StaffPickerField ariaLabel={text.aria.discountValidUntil} placeholder={text.chooseDate} type="date" value={discountForm.valid_until} onChange={(value) => setDiscountForm({ ...discountForm, valid_until: value })} /></label>
                  <label>{text.labels.maxUses}<input type="number" value={discountForm.max_uses} onChange={(event) => setDiscountForm({ ...discountForm, max_uses: event.target.value })} /></label>
                  <label className="checkbox-row"><input type="checkbox" checked={discountForm.active} onChange={(event) => setDiscountForm({ ...discountForm, active: event.target.checked })} /> {text.labels.active}</label>
                </div>
                <button className="primary" type="button" disabled={saving || !discountForm.name.trim()} onClick={saveDiscount}>
                  {commerceTab === 'vouchers' ? text.actions.saveVoucher : text.actions.saveDiscount}
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
                    <span>{text.discountTypes[discount.discount_type]} · {formatDiscountRuleValue(discount, text)} · {text.labels.used} {discount.used_count}{discount.max_uses ? `/${discount.max_uses}` : ''}</span>
                  </button>
                ))}
                {commerceTab === 'vouchers' && voucherRules.length === 0 && <p className="notice">{text.messages.noVouchers}</p>}
                {commerceTab === 'discounts' && discountRules.length === 0 && <p className="notice">{text.messages.noDiscounts}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {currentTab === 'roles' && (
        <div className="staff-card staff-card-wide">
          <div className="staff-card-heading">
            <h3>{text.labels.roles}</h3>
            <button className="staff-link-button" type="button" onClick={() => setRoleHelpOpen(true)}>
              {text.labels.roleExplanation}
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
              const protectedEmail = adminEmails.includes((item.email || '').toLowerCase())
              const rowFeedback = roleSaveFeedback[item.id]
              return (
                <div className="staff-role-row" key={item.id}>
                  <div>
                    <strong>{customerName(item, text)}</strong>
                    <span>{item.email || item.phone || text.noContact} · {text.labels.current} {staffRoleName(effectiveRole, text)}</span>
                    {protectedEmail && <small>{text.emailOverrideKeepsAdmin}</small>}
                  </div>
                  <div className="staff-role-action-cell">
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
                    {hasPendingRoleChange && (
                      <div className="staff-role-actions">
                        <button
                          className="primary"
                          disabled={!canManageRoles || saving}
                          type="button"
                          onClick={() => updateProfileRole(item.id, selectedRole)}
                        >
                          {text.actions.saveRole}
                        </button>
                        <button
                          className="secondary"
                          disabled={saving}
                          type="button"
                          onClick={() => clearStagedProfileRole(item.id)}
                        >
                          {text.actions.cancel}
                        </button>
                      </div>
                    )}
                    {canDeleteProfileAccount(item) && (
                      <button
                        className="danger small-button staff-role-delete-button"
                        disabled={saving}
                        type="button"
                        onClick={() => openProfileDeleteDialog(item)}
                      >
                        {text.actions.deleteAccount}
                      </button>
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
                  {text.actions.restore}
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
                <button type="button" onClick={() => {
                  const [from, to] = reportPresetRange('today')
                  setReportStart(from)
                  setReportEnd(to)
                }}>{text.actions.today}</button>
                <button type="button" onClick={() => {
                  const [from, to] = reportPresetRange('yesterday')
                  setReportStart(from)
                  setReportEnd(to)
                }}>{text.actions.yesterday}</button>
                <button className="staff-report-range-button" type="button" onClick={() => {
                  setReportDatePickerTarget('report')
                  setReportDatePickerOpen(true)
                }}>
                  <span>{text.labels.dateRange}</span>
                  <strong>{rangeLabel(reportStart, reportEnd)}</strong>
                </button>
                <button type="button" onClick={applyPreviousPeriodComparison}>{text.actions.previousPeriod}</button>
                <label className="staff-compare-toggle">
                  <input type="checkbox" checked={compareEnabled} onChange={(event) => setCompareEnabled(event.target.checked)} />
                  {text.labels.compare}
                </label>
                <div className="staff-report-export-actions">
                  <button type="button" onClick={exportExcelReport}>{text.actions.excel}</button>
                  <button type="button" onClick={exportPdfReport}>{text.actions.pdf}</button>
                  <div className="staff-accountant-export">
                    <button
                      className={accountantExportOpen ? 'active' : ''}
                      type="button"
                      onClick={() => setAccountantExportOpen((open) => !open)}
                    >
                      {text.labels.accountantExports}
                    </button>
                    {accountantExportOpen && (
                      <div className="staff-accountant-export-panel">
                        <div className="staff-accountant-export-head">
                          <div>
                            <strong>{text.labels.accountantExports}</strong>
                            <span>{text.messages.accountantExportHelp}</span>
                          </div>
                          <button className="staff-accountant-export-close" type="button" aria-label={text.actions.cancel} onClick={() => setAccountantExportOpen(false)}>×</button>
                        </div>
                        <div className="staff-accountant-export-grid">
                          <button className="staff-report-range-button compact" type="button" onClick={() => {
                            setReportDatePickerTarget('report')
                            setReportDatePickerOpen(true)
                          }}>
                            <span>{text.labels.dateRange}</span>
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
                        <button className="primary staff-accountant-download" type="button" onClick={downloadAccountantExport}>
                          {text.actions.download}
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
                    <span>{text.labels.compareRange}</span>
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
                        <stop offset="0%" stopColor="#00aeb3" />
                        <stop offset="100%" stopColor="#3059ff" />
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
          <h3 className="staff-audit-title">{text.labels.recentAuditLog}</h3>
          <div className="staff-audit-list">
            {auditLogs.map((log) => (
              <span key={log.id}>{new Date(log.created_at).toLocaleString()} · {log.action} · {log.entity_type}</span>
            ))}
          </div>
        </div>
      )}

      {reportDatePickerOpen && (
        <StaffReportDateRangeModal
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
              ×
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
              ×
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
