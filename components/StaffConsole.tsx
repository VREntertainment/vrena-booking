'use client'

import dynamic from 'next/dynamic'
import StaffOrderStatusConfirmation, { type OrderStatusChange } from './staff/StaffOrderStatusConfirmation'

const StaffCalendarBookingDialog = dynamic(() => import('./StaffCalendarBookingDialog'), { ssr: false })
const NewSection = dynamic(() => import('../features/staff/NewSection'), { ssr: false })
const TodaySection = dynamic(() => import('../features/staff/TodaySection'), { ssr: false })
const AttendanceSection = dynamic(() => import('../features/staff/AttendanceSection'), { ssr: false })
const HrSection = dynamic(() => import('../features/staff/HrSection'), { ssr: false })
const GamesSection = dynamic(() => import('../features/staff/GamesSection'), { ssr: false })
const DiscountsSection = dynamic(() => import('../features/staff/DiscountsSection'), { ssr: false })
const ClientProfileSection = dynamic(() => import('../features/staff/ClientProfileSection'), { ssr: false })
const RolesSection = dynamic(() => import('../features/staff/RolesSection'), { ssr: false })
const ReportSection = dynamic(() => import('../features/staff/ReportSection'), { ssr: false })


import { useStaffBookingState } from '../features/staff/useStaffBookingState'
import { useStaffClientsState } from '../features/staff/useStaffClientsState'
import { useStaffCommerceState } from '../features/staff/useStaffCommerceState'
import { useStaffEmployeesState } from '../features/staff/useStaffEmployeesState'
import { useStaffLoadingState } from '../features/staff/useStaffLoadingState'
import { useStaffOperationsState } from '../features/staff/useStaffOperationsState'
import { useStaffPayrollState } from '../features/staff/useStaffPayrollState'
import { useStaffReportsState } from '../features/staff/useStaffReportsState'
import { useStaffSchedulingState } from '../features/staff/useStaffSchedulingState'
import { useStaffSettingsState } from '../features/staff/useStaffSettingsState'

import { isStaffGroupDiscount } from '../lib/staff/pricing'
import { createStaffBookingActions } from '../features/staff/booking.actions'
import { createStaffClientsActions } from '../features/staff/clients.actions'
import { createStaffCommerceActions } from '../features/staff/commerce.actions'
import { createStaffEmployeesActions } from '../features/staff/employees.actions'
import { createStaffPayrollExportActions } from '../features/staff/lazyPayrollExport'
import { createStaffLoadingActions } from '../features/staff/loading.actions'
import { createStaffOperationsActions } from '../features/staff/operations.actions'
import { createStaffOrdersActions } from '../features/staff/orders.actions'
import { createStaffPayrollActions } from '../features/staff/payroll.actions'
import { createStaffReportsActions } from '../features/staff/reports.actions'
import { createStaffSchedulingActions } from '../features/staff/scheduling.actions'
import { createStaffSettingsActions } from '../features/staff/settings.actions'
import { ButtonIconText, StaffReportDateRangeModal } from '../features/staff/shared'


import { publicGameGuideCatalog } from '../lib/gameGuideCatalog'
import { staffBookingCopy } from '../lib/staff/bookingCopy'
import { individualTicketUnitPrice } from '../lib/ticketTariffs'

import {
  normalizeStaffAudience,
  parseStaffArenaIds
} from '../lib/staff/catalog'
import {
  attendanceDateKeys,
  attendanceDateRange,
  endOfMonth,
  minutesBetween,
  minutesBetweenTimes,
  normalizeTime,
  previousPeriodRange,
  reportPresetRange,
  shortDateLabel,
  staffDateLabel,
  startOfMonth,
  todayString
} from '../lib/staff/dates'
import {
  dongDigits,
  formatDongInput,
  formatVnd,
  resolveStaffConsoleLanguage
} from '../lib/staff/formatting'
import { defaultDiscountForm, defaultLoyaltyForm } from '../lib/staff/forms'
import {
  normalizeStaffShiftTemplates
} from '../lib/staff/hrSettings'
import {
  sessionBookedPlayers,
  sessionCapacity,
  sessionCheckedInCount
} from '../lib/staff/operations'
import {
  dayTypes,
  emptyStaffDailySeries,
  emptyStaffOrders,
  emptyStaffPayments,
  staffAttendanceTabs,
  staffHrSetupOptionTypes,
  staffTabGroups
} from '../lib/staff/options'
import { normalizePaymentSplits, paymentSplitTotal, paymentStatusLabel, paymentMethodLabel } from '../lib/staff/payments'
import {
  adjustmentAppliesToPeriod,
  calculateStaffPayroll,
  emptyStaffPayrollCalculation
} from '../lib/staff/payroll'
import {
  calculateDiscount,
  calculateManualDiscount,
  discountMatchesContext,
  discountValueUnit,
  manualDiscountLabel,
  selectPricingRule
} from '../lib/staff/pricing'
import {
  customerName,
  customerSearchText,
  deletedRecordActorLabel,
  isDemoProfile,
  normalizeStaffSearchValue,
  roleLabel,
  staffProfileFromEmployee,
  staffRoleName
} from '../lib/staff/profiles'
import {
  orderPaymentLabel,
  paymentPieItems
} from '../lib/staff/reportExports'
import { shiftConflictWarnings } from '../lib/staff/scheduling'
import { StaffPickerField } from './staff/StaffPickerField'


import { orderedRange } from '../lib/staff/dates'
import {
  buildChartAreaPath,
  buildHourlyRevenue,
  buildLineChartPath,
  buildSmoothLineChartPath,
  buildWeekdayRevenue,
  conicStops,
  emptyStaffReport,
  orderPaidAmount,
  paymentMapFromRows
} from '../lib/staff/reporting'
import { visitCopy } from '../lib/staffVisit'

import { staffConsoleText } from '../lib/staff/copy'
import type {
  StaffCommerceTab,
  StaffConsoleProps,
  StaffDataKey,
  StaffHrSetupOption,
  StaffHrSetupOptionType,
  StaffHrTab,
  StaffOrder,
  StaffPayrollCalculation,
  StaffPriceRule,
  StaffReportRangePreset,
  StaffScheduleScope,
  StaffScheduleShift,
  StaffTab
} from '../lib/staff/types'
export type { StaffProfile } from '../lib/staff/types'

import {
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  RotateCcw,
  Save,
  Trash2,
  UserRound,
  X
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { uiText } from '../lib/i18n/translations'
import type { RateLimitAction } from '../lib/security/rateLimit'
import { allocateStaffCompanyCost } from '../lib/staffCostAllocation'
import { canAccessCoreHrSettings, canAccessZaloHrSettings } from '../lib/staffKioskScope'
import { summarizeOperationMoney } from '../lib/staffOperationMoney'
import { staffConsoleRoleRank as staffRank } from '../lib/staffRoles'
import { supabase } from '../lib/supabase/client'
import AppLoadingState from './AppLoadingState'
import { staffKioskCopy } from './StaffKioskGate'

export default function StaffConsole({ profile, authEmail, language, mode = 'staff', kioskOperator, onKioskLock, onOpenPlayerProfile, onOpenSessionCalendar, initialBooking, onBookingCreated }: StaffConsoleProps) {

  const resolvedLanguage = resolveStaffConsoleLanguage(language)
  const text = staffConsoleText[resolvedLanguage]
  const sharedText = uiText[resolvedLanguage]
  const kioskText = staffKioskCopy(language)
  const isHrConsole = mode === 'hr'
  const consoleTitle = isHrConsole ? (resolvedLanguage === 'vi' ? 'HR' : 'HR Console') : text.title
  const kioskRoleRank = kioskOperator?.accessRole === 'manager' ? 80 : kioskOperator?.accessRole === 'staff' ? 50 : 0
  const rank = kioskOperator
    ? kioskRoleRank
    : Math.max(staffRank(profile?.role, profile?.email), staffRank(profile?.role, authEmail))
  const role = kioskOperator?.accessRole
    || roleLabel(profile?.role, staffRank(null, authEmail) > staffRank(null, profile?.email) ? authEmail : profile?.email)
  const canManageConfig = rank >= 80
  const canCreateOrders = rank >= 50
  const canCreateCustomerAccounts = rank >= 50
  const canAwardAchievements = rank >= 50
  const canManageRoles = rank >= 100
  const canRestoreDeleted = rank >= 120
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const isOfficeStaff = role === 'cashier'
  const isStaffOnly = role === 'staff'
  const canManageAttendance = isOwnerOrAdmin || role === 'manager' || isOfficeStaff
  const canEditAttendance = canManageAttendance
  const canViewAllEmployeeProfiles = isOwnerOrAdmin
  const canEditEmployeeProfiles = isOwnerOrAdmin
  const canManageEmployeeKioskPins = isOwnerOrAdmin && !kioskOperator
  const canRevealEmployeeKioskPin = (isOwnerOrAdmin || isOfficeStaff) && !kioskOperator
  const hrAccessContext = { authEmail: authEmail || profile?.email, role, roleRank: rank }
  const canAccessHrSettings = canAccessCoreHrSettings(hrAccessContext)
  const canAccessZaloSettings = canAccessZaloHrSettings(hrAccessContext)
  const canViewAttendanceClock = !isStaffOnly
  const canViewAttendanceSettings = !isStaffOnly
  const canOpenRoleProfiles = rank >= 20 && Boolean(onOpenPlayerProfile)
  const currentProfileId = profile?.id || ''
  const [activeTab, setActiveTab] = useState<StaffTab>(isHrConsole ? 'hr' : (rank >= 50 ? 'new' : 'report'))
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null)
  const [orderStatusConfirm, setOrderStatusConfirm] = useState<{ orderId: string; status: OrderStatusChange } | null>(null)
  const [ordersShop, setOrdersShop] = useState('all')
  const [commerceTab, setCommerceTab] = useState<StaffCommerceTab>('discounts')
  const {
    attendanceTab,
    setAttendanceTab,
    attendanceShifts,
    setAttendanceShifts,
    attendanceLogs,
    setAttendanceLogs,
    leaveRequests,
    setLeaveRequests,
    attendanceSettings,
    setAttendanceSettings,
    selectedShiftTemplate,
    setSelectedShiftTemplate,
    attendanceScheduleScope,
    setAttendanceScheduleScope,
    draggingShiftId,
    setDraggingShiftId,
    shiftForm,
    setShiftForm,
    attendanceLogForm,
    setAttendanceLogForm,
    leaveForm,
    setLeaveForm,
    attendanceRangeStart,
    setAttendanceRangeStart,
    attendanceRangeEnd,
    setAttendanceRangeEnd,
  } = useStaffSchedulingState({ canViewAllEmployeeProfiles })
  const [hrTab, setHrTab] = useState<StaffHrTab>('employees')
  const {
    games,
    setGames,
    prices,
    setPrices,
    discounts,
    setDiscounts,
    loyaltyRules,
    setLoyaltyRules,
    gameForm,
    setGameForm,
    priceForm,
    setPriceForm,
    discountForm,
    setDiscountForm,
    loyaltyForm,
    setLoyaltyForm,
    gameImageUploading,
    setGameImageUploading,
  } = useStaffCommerceState()
  const {
    costAssignments,
    setCostAssignments,
    hrAdjustments,
    setHrAdjustments,
    payrollRuns,
    setPayrollRuns,
    payrollItems,
    setPayrollItems,
    payrollSourceSnapshots,
    setPayrollSourceSnapshots,
    hrAdjustmentForm,
    setHrAdjustmentForm,
    payrollRunForm,
    setPayrollRunForm,
  } = useStaffPayrollState()
  const {
    employeeProfiles,
    setEmployeeProfiles,
    employeePhotoUrls,
    setEmployeePhotoUrls,
    hrDocuments,
    setHrDocuments,
    employeeForm,
    setEmployeeForm,
    employeeKioskPin,
    setEmployeeKioskPin,
    employeeKioskPinConfirm,
    setEmployeeKioskPinConfirm,
    employeeKioskAccessRole,
    setEmployeeKioskAccessRole,
    employeeKioskPinSaveConfirmation,
    setEmployeeKioskPinSaveConfirmation,
    employeeKioskPinVisibleValue,
    setEmployeeKioskPinVisibleValue,
    employeeKioskPinLoading,
    setEmployeeKioskPinLoading,
    employeeKioskPinEmailState,
    setEmployeeKioskPinEmailState,
    employeeKioskPinEmailRecipient,
    setEmployeeKioskPinEmailRecipient,
    employeeKioskPinProfileRef,
    employeeKioskPinConfirmationTimerRef,
    employeeKioskPinEmailTimerRef,
    hrDocumentUploading,
    setHrDocumentUploading,
  } = useStaffEmployeesState()
  const { hrSettings, setHrSettings, hrSetupOptions, setHrSetupOptions, hrSetupForm, setHrSetupForm } = useStaffSettingsState()
  const {
    orders,
    setOrders,
    ordersRange,
    setOrdersRange,
    ordersQuery,
    setOrdersQuery,
    browsedOrders,
    setBrowsedOrders,
    ordersRequestRef,
    orderPayments,
    setOrderPayments,
    orderEditDraft,
    setOrderEditDraft,
    orderEditError,
    setOrderEditError,
    operationSessions,
    setOperationSessions,
    operationSessionScope,
    setOperationSessionScope,
    expandedOperationSessions,
    setExpandedOperationSessions,
    paymentOrderId,
    setPaymentOrderId,
    visitFeedback,
    setVisitFeedback,
    visitOrderSelection,
    setVisitOrderSelection,
    operationAddProfileBySession,
    setOperationAddProfileBySession,
    operationAddProfileQueryBySession,
    setOperationAddProfileQueryBySession,
    operationDeleteDraft,
    setOperationDeleteDraft,
    operationDeleteError,
    setOperationDeleteError,
    operationsDate,
    setOperationsDate,
  } = useStaffOperationsState()
  const ordersPageSize = 50
  const ordersQueryKey = JSON.stringify(ordersQuery)
  const visitText = visitCopy[resolvedLanguage]
  const {
    profiles,
    setProfiles,
    achievementAwards,
    setAchievementAwards,
    deletedRecords,
    setDeletedRecords,
    customerInviteForm,
    setCustomerInviteForm,
    customerInviteStatus,
    setCustomerInviteStatus,
    customerTemporaryAccess,
    setCustomerTemporaryAccess,
    isCustomerInviteSaving,
    setIsCustomerInviteSaving,
    clientProfileDirty,
    setClientProfileDirty,
    roleSearch,
    setRoleSearch,
    roleFilter,
    setRoleFilter,
    roleSort,
    setRoleSort,
    roleHelpOpen,
    setRoleHelpOpen,
    pendingRoleChanges,
    setPendingRoleChanges,
    roleSaveFeedback,
    setRoleSaveFeedback,
    profileDeleteDraft,
    setProfileDeleteDraft,
  } = useStaffClientsState()
  const { booking, setBooking, customerNameFocused, setCustomerNameFocused, customerSuggestionIndex, setCustomerSuggestionIndex, bookingSubmitRef } = useStaffBookingState({ initialBooking })
  const bookingText = staffBookingCopy[resolvedLanguage]
  const {
    reportStart,
    setReportStart,
    reportEnd,
    setReportEnd,
    compareEnabled,
    setCompareEnabled,
    compareStart,
    setCompareStart,
    compareEnd,
    setCompareEnd,
    reportDatePickerOpen,
    setReportDatePickerOpen,
    reportDatePickerTarget,
    setReportDatePickerTarget,
    reportChartMode,
    setReportChartMode,
    reportView,
    setReportView,
    accountantExportOpen,
    setAccountantExportOpen,
    accountantExportFormat,
    setAccountantExportFormat,
    accountantExportLanguage,
    setAccountantExportLanguage,
    accountantExportStore,
    setAccountantExportStore,
    accountantIncludeAttachments,
    setAccountantIncludeAttachments,
    accountantReportId,
    setAccountantReportId,
    reportExporting,
    setReportExporting,
    reportExportFeedback,
    setReportExportFeedback,
    reportSnapshot,
    setReportSnapshot,
    playerInsightsSnapshot,
    setPlayerInsightsSnapshot,
    qrAnalyticsSnapshot,
    setQrAnalyticsSnapshot,
    qrAnalyticsError,
    setQrAnalyticsError,
  } = useStaffReportsState({ language })

  useEffect(() => () => {
    if (employeeKioskPinConfirmationTimerRef.current !== null) {
      window.clearTimeout(employeeKioskPinConfirmationTimerRef.current)
    }
    if (employeeKioskPinEmailTimerRef.current !== null) {
      window.clearTimeout(employeeKioskPinEmailTimerRef.current)
    }
  }, [employeeKioskPinConfirmationTimerRef, employeeKioskPinEmailTimerRef])
  const {
    status,
    setStatus,
    dataErrors,
    setDataErrors,
    dataRetry,
    setDataRetry,
    loadingData,
    setLoadingData,
    loadedDataRef,
    inFlightDataRef,
    saving,
    setSaving,
  } = useStaffLoadingState()
  const bookingDateInputRef = useRef<HTMLInputElement | null>(null)
  const staffTabsRef = useRef<HTMLDivElement | null>(null)
  const [canScrollStaffTabsBack, setCanScrollStaffTabsBack] = useState(false)
  const [canScrollStaffTabsForward, setCanScrollStaffTabsForward] = useState(false)

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

  useEffect(() => {
    const rail = staffTabsRef.current
    if (!rail) return

    const updateScrollControls = () => {
      const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
      setCanScrollStaffTabsBack(rail.scrollLeft > 4)
      setCanScrollStaffTabsForward(rail.scrollLeft < maxScrollLeft - 4)
    }

    updateScrollControls()
    rail.addEventListener('scroll', updateScrollControls, { passive: true })
    const resizeObserver = new ResizeObserver(updateScrollControls)
    resizeObserver.observe(rail)

    return () => {
      rail.removeEventListener('scroll', updateScrollControls)
      resizeObserver.disconnect()
    }
  }, [visibleTabGroups])

  useEffect(() => {
    const rail = staffTabsRef.current
    const activeButton = rail?.querySelector<HTMLElement>(`[data-staff-tab="${currentTab}"]`)
    if (!rail || !activeButton) return

    activeButton.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [currentTab])
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
  const bookingGames = useMemo(() => activeGames.filter((game) => {
    const venues = publicGameGuideCatalog.find((item) => item.id === game.slug)?.venues || ['ha-do-centrosa']
    return venues.includes(booking.venueKey)
  }), [activeGames, booking.venueKey])
  const selectedGame = useMemo(() => bookingGames.find((game) => game.id === booking.gameId) || bookingGames[0] || null, [bookingGames, booking.gameId])
  const bookingArenas = booking.venueKey === 'cafe-des-stagiaires'
    ? ['cafe:arena-1']
    : selectedGame?.available_arena_ids?.length ? selectedGame.available_arena_ids : ['arena-1']
  const selectedBookingArena = bookingArenas.includes(booking.arenaId) ? booking.arenaId : bookingArenas[0]
  const bookingVenueName = booking.venueKey === 'cafe-des-stagiaires' ? 'VRena Café des Stagiaires' : 'VRena Hà Đô Centrosa'
  const selectedRule = useMemo(() => {
    if (!selectedGame || booking.venueKey === 'cafe-des-stagiaires') return null
    return selectPricingRule(prices, selectedGame.id, booking.date, booking.time)
  }, [booking.date, booking.time, booking.venueKey, prices, selectedGame])
  const bookingUnitPrice = booking.venueKey === 'cafe-des-stagiaires'
    ? individualTicketUnitPrice(booking.date, booking.time, booking.venueKey)
    : selectedRule?.price_per_player ?? 200000
  const bookingDurationBlocks = Math.max(1, Math.ceil((selectedGame?.duration_minutes || 20) / 20))
  const bookingSubtotal = selectedRule?.price_per_arena_slot != null
    ? selectedRule.price_per_arena_slot * bookingDurationBlocks
    : bookingUnitPrice * booking.players
  const availableBookingDiscounts = useMemo(() => (
    discounts.filter((discount) => !/^VR_/i.test(discount.code || '') && discountMatchesContext(discount, {
      date: booking.date,
      gameId: selectedGame?.id || null,
      players: booking.players,
      priceRuleId: selectedRule?.id || null,
      subtotal: bookingSubtotal,
      ticketType: discount.ticket_type === 'birthday' ? 'birthday' : 'individual',
      time: booking.time,
    }))
  ), [booking.date, booking.players, booking.time, bookingSubtotal, discounts, selectedGame, selectedRule])
  const selectedDiscount = useMemo(() => {
    if (booking.discountId) return availableBookingDiscounts.find((discount) => discount.id === booking.discountId) || null
    if (calculateManualDiscount(booking.manualDiscountType, booking.manualDiscountValue, bookingSubtotal) > 0) return null
    return availableBookingDiscounts.filter(isStaffGroupDiscount).sort((a, b) => calculateDiscount(b, bookingSubtotal, bookingUnitPrice) - calculateDiscount(a, bookingSubtotal, bookingUnitPrice) || a.id.localeCompare(b.id))[0] || null
  }, [availableBookingDiscounts, booking.discountId, booking.manualDiscountType, booking.manualDiscountValue, bookingSubtotal, bookingUnitPrice])

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
      total: booking.overrideTotalEnabled && booking.overrideTotal.trim() !== '' && Number.isFinite(Number(booking.overrideTotal)) ? Math.max(0, Number(booking.overrideTotal)) : Math.max(0, subtotal - discountTotal),
      ruleName: selectedRule?.rule_name || (booking.venueKey === 'cafe-des-stagiaires' ? bookingVenueName : text.defaultWalkInRate),
      duration: selectedGame?.duration_minutes || 20,
    }
  }, [booking.overrideTotalEnabled, booking.overrideTotal, booking.manualDiscountType, booking.manualDiscountValue, bookingSubtotal, bookingUnitPrice, selectedDiscount, selectedGame, selectedRule, text, booking.venueKey, bookingVenueName])
  const bookingPaymentSplits = useMemo(() => normalizePaymentSplits(booking.paymentSplits), [booking.paymentSplits])
  const bookingPaidTotal = useMemo(() => paymentSplitTotal(bookingPaymentSplits), [bookingPaymentSplits])
  const bookingRemainingTotal = Math.max(0, quote.total - bookingPaidTotal)

  const orderPaymentsByOrderId = useMemo(() => paymentMapFromRows(orderPayments), [orderPayments])
  const operationOrders = useMemo(() => (
    orders
      .filter((order) => operationSessionScope === 'past'
        ? operationSessions.some((session) => session.id === order.session_id)
        : order.booking_date === operationsDate)
      .sort((left, right) => left.booking_time.localeCompare(right.booking_time) || left.order_number.localeCompare(right.order_number))
  ), [operationsDate, operationSessionScope, operationSessions, orders])
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
    const money = summarizeOperationMoney(operationSessions, operationOrders.map((order) => ({
      ...order, paidAmount: orderPaidAmount(order, orderPaymentsByOrderId),
    })))

    return {
      sessions: operationSessions.length,
      ticketBookings: operationSessions.filter((session) => session.booking_type === 'ticket').length,
      bookedPlayers: orderPlayers + sessionOnlyPlayers,
      capacity: orderCapacity + sessionOnlyCapacity,
      checkedIn,
      checkablePlayers: operationSessions.reduce((sum, session) => sum + Math.max(session.session_participants?.length || 0, sessionCheckedInCount(session)), 0),
      money,
    }
  }, [operationOrders, operationSessions, orderPaymentsByOrderId])
  const [attendanceWeekStart, attendanceWeekEnd] = useMemo(
    () => attendanceDateRange(attendanceRangeStart, attendanceRangeEnd),
    [attendanceRangeEnd, attendanceRangeStart]
  )
  const employeeStaffProfiles = useMemo(() => (
    employeeProfiles.map((employee) => staffProfileFromEmployee(employee, employeePhotoUrls[employee.profile_id]))
  ), [employeePhotoUrls, employeeProfiles])
  const profileById = useMemo(() => new Map(
    [...profiles, ...employeeStaffProfiles].map((item) => [item.id, item])
  ), [employeeStaffProfiles, profiles])
  const awardableProfiles = useMemo(() => (
    profiles.filter((item) => !isDemoProfile(item) && roleLabel(item.role, item.email) === 'player')
  ), [profiles])
  const gameNameById = useMemo(() => new Map(games.map((item) => [item.id, item.name])), [games])
  const priceRuleNameById = useMemo(() => new Map(prices.map((item) => [item.id, item.rule_name])), [prices])
  const employeeProfileById = useMemo(() => new Map(employeeProfiles.map((item) => [item.profile_id, item])), [employeeProfiles])
  const allStaffProfileOptions = employeeStaffProfiles
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
  const payrollPeriodStart = payrollRunForm.period_start || startOfMonth(todayString())
  const payrollPeriodEnd = payrollRunForm.period_end || endOfMonth(payrollPeriodStart)
  const staffPayrollCalculations = useMemo(() => {
    const map = new Map<string, StaffPayrollCalculation>()
    visibleStaffProfileOptions.forEach((staffProfile) => {
      const employee = employeeProfileById.get(staffProfile.id)
      const periodReference = payrollSourceSnapshots.find((snapshot) => (
        snapshot.employee_code === employee?.employee_code &&
        snapshot.period_start === payrollPeriodStart &&
        snapshot.period_end === payrollPeriodEnd
      ))
      map.set(staffProfile.id, calculateStaffPayroll(
        staffProfile.id,
        employee,
        attendanceShifts,
        attendanceLogs,
        leaveRequests,
        hrAdjustments,
        hrSettings,
        attendanceSettings,
        payrollPeriodStart,
        payrollPeriodEnd,
        periodReference,
      ))
    })
    return map
  }, [attendanceLogs, attendanceSettings, attendanceShifts, employeeProfileById, hrAdjustments, hrSettings, leaveRequests, payrollPeriodEnd, payrollPeriodStart, payrollSourceSnapshots, visibleStaffProfileOptions])
  const staffCostAllocations = useMemo(() => new Map(visibleStaffProfileOptions.map((staffProfile) => {
    const employee = employeeProfileById.get(staffProfile.id)
    const calculation = staffPayrollCalculations.get(staffProfile.id)
    return [staffProfile.id, allocateStaffCompanyCost({
      profileId: staffProfile.id,
      homeLocation: employee?.payroll_location || employee?.main_work_location || '',
      periodStart: payrollPeriodStart, periodEnd: payrollPeriodEnd,
      companyCost: calculation?.companyCost || 0,
      paidLeaveMinutes: Math.round((calculation?.paidLeaveHours || 0) * 60),
      assignments: costAssignments, attendance: attendanceLogs,
    })]
  })), [attendanceLogs, costAssignments, employeeProfileById, payrollPeriodEnd, payrollPeriodStart, staffPayrollCalculations, visibleStaffProfileOptions])
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
  const showCustomerNameSuggestions = !booking.guestBooking && customerNameFocused
  const visibleCustomerSuggestions = customerNameSuggestions.slice(0, 50)
  const canOfferNewCustomer = Boolean(booking.customerName.trim()) && !booking.customerId
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
  const [todayReportStart, todayReportEnd] = reportPresetRange('today')
  const secondaryReportPreset: StaffReportRangePreset = reportView === 'business' ? 'yesterday' : 'last_30'
  const [secondaryReportStart, secondaryReportEnd] = reportPresetRange(secondaryReportPreset)
  const activeReportPreset = reportStart === todayReportStart && reportEnd === todayReportEnd
    ? 'today'
    : reportStart === secondaryReportStart && reportEnd === secondaryReportEnd
      ? secondaryReportPreset
      : 'custom'
  const [previousReportStart, previousReportEnd] = previousPeriodRange(reportStart, reportEnd)
  const isPreviousPeriodComparison = compareEnabled
    && compareStart === previousReportStart
    && compareEnd === previousReportEnd
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
      { label: text.paymentMethods.card_manual, value: report.cardTotal },
      { label: text.paymentMethods.momo_manual, value: report.momoTotal },
      { label: text.paymentMethods.vnpay, value: report.vnpayTotal },
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
  const currentDataKeys: StaffDataKey[] = currentTab === 'new' ? ['games', 'prices', 'discounts', 'profiles']
    : currentTab === 'clientProfile' ? (canAwardAchievements ? ['profiles', 'achievementAwards'] : [])
      : currentTab === 'today' ? ['games', 'today', 'todaySessions', 'profiles'].filter((key) => operationSessionScope !== 'past' || key !== 'today') as StaffDataKey[]
        : currentTab === 'attendance' ? ['profiles', 'attendance']
          : currentTab === 'hr' ? ['profiles', 'attendance', 'hr']
            : currentTab === 'games' ? ['games']
              : currentTab === 'prices' ? ['games', 'prices']
                : currentTab === 'discounts' ? ['games', 'prices', 'discounts', ...(commerceTab === 'loyalty' ? ['loyalty' as const] : [])]
                  : currentTab === 'roles' ? ['profiles']
                    : currentTab === 'restore' ? ['restore']
                      : currentTab === 'orders' ? ['games', 'orders']
                        : reportView === 'qr' ? ['qrReport'] : ['games', 'report']
  const currentTabError = currentDataKeys.map((key) => dataErrors[key]).filter(Boolean).join(' · ')
  const currentTabLoading = currentDataKeys.some((key) => loadingData[key] || (!loadedDataRef.current[key] && !dataErrors[key]))
    || (currentTab === 'orders' && browsedOrders?.key !== ordersQueryKey && !dataErrors.orders)
  const currentTabReady = !currentTabLoading && !currentTabError

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
  }, [currentTab, commerceTab, operationsDate, operationSessionScope, attendanceWeekEnd, attendanceWeekStart, payrollPeriodEnd, payrollPeriodStart, ordersQuery, dataRetry])

  useEffect(() => {
    if (currentTab !== 'report') return
    if (reportView === 'qr') {
      void loadQrAnalytics(true)
      return
    }
    void Promise.all([loadGames(), loadReportData(true)])
    // Report data is intentionally refreshed only by visible range/filter state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, reportView, reportStart, reportEnd, compareEnabled, compareStart, compareEnd, dataRetry])

  async function consumeStaffRateLimit(action: RateLimitAction, subject: string) {
    const { error } = action === 'booking_attempt'
      ? await supabase.rpc('consume_booking_attempt_rate_limit', { p_subject: subject || null })
      : await supabase.rpc('consume_user_action_rate_limit', {
        p_action: action,
        p_subject: subject || null,
      })

    if (error) {
      setStatus(error.message || text.messages.staffTooManyAttempts)
      return false
    }

    return true
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

  function openStaffTab(tab: StaffTab) {
    if (tab === currentTab) return
    if (
      currentTab === 'clientProfile'
      && clientProfileDirty
      && !window.confirm('You have unsaved customer profile changes. Discard them and leave this page?')
    ) return
    setClientProfileDirty(false)
    setActiveTab(tab)
  }

  function scrollStaffTabs(direction: -1 | 1) {
    const rail = staffTabsRef.current
    if (!rail) return
    rail.scrollBy({
      left: direction * Math.max(240, rail.clientWidth * 0.72),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  const tabButton = (tab: StaffTab, label: string) => (
    allowedTabs.includes(tab) && (
      <button
        aria-selected={currentTab === tab}
        className={currentTab === tab ? 'active' : ''}
        data-staff-tab={tab}
        role="tab"
        tabIndex={currentTab === tab ? 0 : -1}
        type="button"
        onClick={() => openStaffTab(tab)}
      >
        {label}
      </button>
    )
  )

  const orderRows = (rows: StaffOrder[], paymentsByOrderId = orderPaymentsByOrderId) => (
    <div className="staff-table-wrap staff-orders-table-wrap">
      <table className="staff-table staff-orders-table">
        <thead><tr>{[text.labels.order, resolvedLanguage === 'vi' ? 'Đặt chỗ' : 'Booking', text.labels.total, text.labels.payment, text.labels.status, ...(canCreateOrders ? [text.labels.actions] : [])].map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((order) => {
          const draft = orderEditDraft?.orderId === order.id ? orderEditDraft : null
          const payments = paymentsByOrderId.get(order.id) || []
          const paid = orderPaidAmount(order, paymentsByOrderId)
          const balance = Math.max(0, order.total - paid)
          const terminal = ['cancelled', 'refunded', 'no_show', 'completed'].includes(order.order_status)
          const canPay = balance > 0 && !['cancelled', 'refunded', 'no_show'].includes(order.order_status) && order.payment_status !== 'refunded' && !(payments.length === 0 && order.payment_status === 'partially_paid')
          const venue = order.arena_id?.startsWith('cafe:') ? 'cafe-des-stagiaires' : order.arena_id ? 'ha-do-centrosa' : null
          return <Fragment key={order.id}>
            <tr className="staff-order-row">
              <td data-label={text.labels.order}><div><strong>{order.order_number}</strong><p>{order.customer_name || order.customer_phone || order.customer_email || text.walkIn}</p></div></td>
              <td data-label={resolvedLanguage === 'vi' ? 'Đặt chỗ' : 'Booking'}><div><span className={`staff-order-shop ${venue === 'cafe-des-stagiaires' ? 'cafe' : ''}`}>{venue === 'cafe-des-stagiaires' ? 'Café des Stagiaires' : venue ? 'Hà Đô Centrosa' : (resolvedLanguage === 'vi' ? 'Chưa xác định' : 'Unspecified')}</span><p>{games.find((game) => game.id === order.game_id)?.name || text.gameFallback}</p>{staffDateLabel(order.booking_date)} · {normalizeTime(order.booking_time)}<p>{text.labels.players}: {order.players_count}</p></div></td>
              <td data-label={text.labels.total}>{formatVnd(order.total)}</td>
              <td data-label={text.labels.payment}>
                <div>{paymentStatusLabel(order.payment_status, text)}<br />{resolvedLanguage === 'vi' ? 'Đã trả' : 'Paid'}: {payments.length === 0 && order.payment_status === 'partially_paid' ? '—' : formatVnd(paid)}<br />{resolvedLanguage === 'vi' ? 'Còn lại' : 'Balance'}: {payments.length === 0 && order.payment_status === 'partially_paid' ? '—' : formatVnd(balance)}
                  <details className="staff-order-receipts"><summary>{resolvedLanguage === 'vi' ? 'Chi tiết thanh toán' : 'Payment details'}</summary>
                    {payments.length ? <ul>{payments.map((payment) => <li key={payment.id}>{paymentMethodLabel(payment.payment_method, text)} · {formatVnd(payment.amount)}<small>{new Date(payment.created_at).toLocaleString(resolvedLanguage === 'vi' ? 'vi-VN' : 'en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })}</small></li>)}</ul> : <p>{order.payment_status === 'unpaid' ? (resolvedLanguage === 'vi' ? 'Chưa ghi nhận thanh toán.' : 'No payments recorded.') : (resolvedLanguage === 'vi' ? 'Thiếu biên nhận cũ. Kiểm tra trước khi thay đổi thanh toán.' : 'Historical receipts are missing. Review the existing payment record before making changes.')}</p>}
                    {order.price_override_reason && <p>{resolvedLanguage === 'vi' ? 'Lý do điều chỉnh giá' : 'Price adjustment reason'}: {order.price_override_reason}</p>}
                    {order.internal_note && <p>{text.labels.internalNote}: {order.internal_note}</p>}
                  </details>
                </div>
              </td>
              <td data-label={text.labels.status}>{text.orderStatuses[order.order_status]}</td>
              {canCreateOrders && <td data-label={text.labels.actions}><div className="staff-row-actions staff-order-actions">
                <button className="primary" type="button" disabled={saving || !canPay} onClick={() => { setOrderEditDraft(null); setPaymentOrderId(order.id) }}>{text.labels.payment}</button>
                {order.session_id ? <button className="secondary" type="button" disabled={saving} onClick={() => setEditingBookingId(order.session_id)}>{resolvedLanguage === 'vi' ? 'Sửa đặt chỗ / Chuyển cửa hàng' : 'Edit booking / Move shop'}</button> : <small>{resolvedLanguage === 'vi' ? 'Liên kết lịch đặt chỗ trong Hôm nay để chuyển cửa hàng.' : 'Link a calendar booking in Today to move shops.'}</small>}
                <button className="staff-order-tertiary" type="button" disabled={saving || terminal} onClick={() => { setPaymentOrderId(null); beginOrderEdit(order) }}>{resolvedLanguage === 'vi' ? 'Điều chỉnh tổng tiền' : 'Adjust total'}</button>
                <button className="staff-order-tertiary" type="button" disabled={saving || terminal} onClick={() => setOrderStatusConfirm({ orderId: order.id, status: 'completed' })}>{text.actions.done}</button>
                <button className="staff-order-tertiary" type="button" disabled={saving || terminal} onClick={() => setOrderStatusConfirm({ orderId: order.id, status: 'no_show' })}>{text.actions.noShow}</button>
              </div></td>}
            </tr>
            {paymentOrderId === order.id && <tr className="staff-order-detail-row"><td colSpan={6}>{orderPaymentForm(order, paymentsByOrderId)}</td></tr>}
            {draft && <tr className="staff-order-detail-row"><td colSpan={6}><form className="staff-visit-editor" onSubmit={(event) => { event.preventDefault(); void saveOrderEdit(order) }}>
              <fieldset disabled={saving}><legend>{resolvedLanguage === 'vi' ? 'Điều chỉnh tổng tiền' : 'Adjust total'} · {order.order_number}</legend><p>{resolvedLanguage === 'vi' ? 'Các khoản đã thanh toán được giữ nguyên. Tổng mới không được thấp hơn số tiền đã trả.' : 'Recorded payments are retained. The new total cannot be lower than the amount already paid.'}</p>
                <label>{text.labels.total}<input required min={paid} step={1} type="number" value={draft.total} onChange={(event) => patchOrderEditDraft({ total: event.target.value })} /></label>
                <label>{resolvedLanguage === 'vi' ? 'Lý do điều chỉnh giá' : 'Reason for price adjustment'}<textarea required maxLength={1000} value={draft.reason} onChange={(event) => patchOrderEditDraft({ reason: event.target.value })} /></label>
                <div className="staff-row-actions"><button className="primary" type="submit" disabled={!draft.reason.trim()}>{text.actions.save}</button><button className="secondary" type="button" onClick={cancelOrderEdit}>{text.actions.cancel}</button></div>
              </fieldset>{orderEditError && <p role="alert">{orderEditError}</p>}
            </form></td></tr>}
            {orderStatusConfirm?.orderId === order.id && <tr className="staff-order-detail-row"><td colSpan={6}><StaffOrderStatusConfirmation order={order} status={orderStatusConfirm.status} balance={payments.length === 0 && order.payment_status === 'partially_paid' ? null : balance} language={resolvedLanguage} disabled={saving} onConfirm={async () => { await updateOrder(order, { order_status: orderStatusConfirm.status }); setOrderStatusConfirm(null) }} onCancel={() => setOrderStatusConfirm(null)} /></td></tr>}
          </Fragment>
        })}{rows.length === 0 && <tr><td colSpan={canCreateOrders ? 6 : 5}>{text.messages.noOrders}</td></tr>}</tbody>
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
  const {
    setGuestBooking,
    handleCustomerNameChange,
    selectCustomerSuggestion,
    createOrder,
    updateBookingPaymentSplit,
    addBookingPaymentSplit,
    removeBookingPaymentSplit,
  } = createStaffBookingActions(() => ({
    profiles,
    setBooking,
    text,
    setCustomerNameFocused,
    profileById,
    setCustomerSuggestionIndex,
    canCreateOrders,
    selectedGame,
    bookingSubmitRef,
    booking,
    setStatus,
    bookingText,
    selectedDiscount,
    setSaving,
    consumeStaffRateLimit,
    quote,
    selectedBookingArena,
    markStaffDataStale,
    onBookingCreated,
    loadProfiles,
  }))
  const {
    loadTodayOrders,
    loadTodaySessions,
    updateOperationSession,
    openOperationDeleteDraft,
    closeOperationDeleteDraft,
    deleteOperationSession,
    updateOperationParticipant,
    linkVisitOrder,
    addOperationParticipant,
    removeOperationParticipant,
    updateOperationChapterTime,
    orderPaymentForm,
    updateOrder,
    beginOrderEdit,
    patchOrderEditDraft,
    cancelOrderEdit,
    saveOrderEdit,
  } = createStaffOperationsActions(() => ({
    runStaffLoader,
    fetchOrderPayments,
    setOrders,
    setOrderPayments,
    operationSessionScope,
    operationsDate,
    setOperationSessions,
    canCreateOrders,
    setStatus,
    text,
    setSaving,
    orders,
    setOperationDeleteError,
    setOperationDeleteDraft,
    operationDeleteDraft,
    setExpandedOperationSessions,
    setVisitFeedback,
    visitText,
    visitOrderSelection,
    saving,
    markStaffDataStale,
    operationAddProfileBySession,
    setOperationAddProfileBySession,
    setOperationAddProfileQueryBySession,
    setBrowsedOrders,
    setPaymentOrderId,
    resolvedLanguage,
    orderPaymentsByOrderId,
    consumeStaffRateLimit,
    operationSessions,
    games,
    currentTab,
    loadRecentOrders,
    loadReportData,
    setOrderEditDraft,
    setOrderEditError,
    orderEditDraft,
  }))
  const {
    loadReportData,
    loadQrAnalytics,
    applyPreviousPeriodComparison,
    selectReportView,
    applyReportDateRange,
    exportExcelReport,
    exportPdfReport,
    runReportExport,
    downloadAccountantExport,
  } = createStaffReportsActions(() => ({
    setGames,
    loadedDataRef,
    reportStart,
    reportEnd,
    compareStart,
    compareEnd,
    compareEnabled,
    fetchOrderPayments,
    setReportSnapshot,
    text,
    runStaffLoader,
    setPlayerInsightsSnapshot,
    setQrAnalyticsError,
    setQrAnalyticsSnapshot,
    setCompareStart,
    setCompareEnd,
    setCompareEnabled,
    setReportView,
    setReportStart,
    setReportEnd,
    setReportDatePickerOpen,
    report,
    reportOrders,
    games,
    reportPaymentsByOrderId,
    reportExporting,
    setReportExporting,
    setReportExportFeedback,
    accountantReportId,
    accountantExportStore,
    accountantExportLanguage,
    fetchAuditLogs,
    discounts,
    loyaltyRules,
    accountantIncludeAttachments,
    accountantExportFormat,
  }))
  const {
    employeeFormForProfile,
    editEmployeeProfile,
    revealEmployeeKioskPin,
    sendEmployeeKioskPinEmail,
    configureEmployeeKioskPin,
    generateEmployeeKioskPin,
    saveEmployeeProfile,
    createEmployeeRecord,
    handleHrDocumentUpload,
  } = createStaffEmployeesActions(() => ({
    text,
    employeeProfileById,
    setEmployeeForm,
    setEmployeeKioskPin,
    setEmployeeKioskPinConfirm,
    setEmployeeKioskPinSaveConfirmation,
    setEmployeeKioskPinVisibleValue,
    setEmployeeKioskPinEmailState,
    setEmployeeKioskPinEmailRecipient,
    employeeKioskPinProfileRef,
    employeeKioskPinConfirmationTimerRef,
    employeeKioskPinEmailTimerRef,
    setEmployeeKioskAccessRole,
    setHrTab,
    setActiveTab,
    canRevealEmployeeKioskPin,
    setEmployeeKioskPinLoading,
    setStatus,
    employeeKioskPinEmailState,
    resolvedLanguage,
    canManageEmployeeKioskPins,
    employeeForm,
    firstEmployeeStaffProfileId,
    employeeKioskPin,
    employeeKioskPinConfirm,
    kioskText,
    setSaving,
    employeeKioskAccessRole,
    markStaffDataStale,
    loadAttendanceData,
    canEditEmployeeProfiles,
    visibleAllStaffProfileOptions,
    profile,
    loadHrData,
    isOwnerOrAdmin,
    saving,
    selectedEmployeeStaffId,
    setHrDocumentUploading,
  }))
  const {
    loadAttendanceData,
    saveShift,
    editShift,
    updateShiftStatus,
    applyShiftTemplate,
    updateAttendanceShiftTemplate,
    startShiftForCell,
    approveAttendancePeriod,
    setAttendanceRange,
    shiftAttendanceRange,
    resetAttendanceRangeToThisWeek,
    copyPreviousAttendanceWeek,
    publishAttendanceWeek,
    moveShiftToCell,
    saveAttendanceLog,
    editAttendanceLog,
    submitLeaveRequest,
    editLeaveRequest,
    updateLeaveStatus,
    saveAttendanceSettings,
  } = createStaffSchedulingActions(() => ({
    runStaffLoader,
    currentTab,
    payrollPeriodStart,
    payrollPeriodEnd,
    attendanceWeekStart,
    attendanceWeekEnd,
    canViewAllEmployeeProfiles,
    setAttendanceShifts,
    setAttendanceLogs,
    setLeaveRequests,
    setAttendanceSettings,
    setEmployeeProfiles,
    setEmployeePhotoUrls,
    employeeForm,
    setEmployeeForm,
    employeeFormForProfile,
    setEmployeeKioskPin,
    setEmployeeKioskPinConfirm,
    setEmployeeKioskPinSaveConfirmation,
    setEmployeeKioskPinVisibleValue,
    setEmployeeKioskPinEmailState,
    setEmployeeKioskPinEmailRecipient,
    setEmployeeKioskAccessRole,
    employeeKioskPinProfileRef,
    canRevealEmployeeKioskPin,
    revealEmployeeKioskPin,
    canManageAttendance,
    shiftForm,
    firstStaffProfileId,
    employeeProfileById,
    setStatus,
    text,
    setSaving,
    attendanceSettings,
    profile,
    setShiftForm,
    markStaffDataStale,
    setAttendanceTab,
    effectiveShiftTemplates,
    setSelectedShiftTemplate,
    saving,
    selectedShiftTemplate,
    attendanceShifts,
    isOwnerOrAdmin,
    resolvedLanguage,
    setAttendanceRangeStart,
    setAttendanceRangeEnd,
    canEditAttendance,
    attendanceLogForm,
    setAttendanceLogForm,
    leaveForm,
    setLeaveForm,
  }))
  const { loadHrData, saveHrSettings, saveHrSetupOption, updateHrSetupOption, setHrSetupOptionActive } = createStaffSettingsActions(() => ({
    runStaffLoader,
    canAccessHrSettings,
    setHrSettings,
    setHrSetupOptions,
    setHrAdjustments,
    setPayrollRuns,
    setPayrollItems,
    setPayrollSourceSnapshots,
    setHrDocuments,
    setCostAssignments,
    canManageAttendance,
    setSaving,
    hrSettings,
    profile,
    setStatus,
    text,
    markStaffDataStale,
    hrSetupForm,
    setHrSetupForm,
    loadAttendanceData,
  }))
  const { syncPayrollDraft, saveHrAdjustment, updateHrAdjustmentStatus, generatePayrollRun, approvePayrollRun, downloadEmployeePayslip } = createStaffPayrollActions(() => ({
    isOwnerOrAdmin,
    setSaving,
    setStatus,
    resolvedLanguage,
    markStaffDataStale,
    loadHrData,
    canManageAttendance,
    hrAdjustmentForm,
    selectedEmployeeStaffId,
    firstEmployeeStaffProfileId,
    text,
    profile,
    setHrAdjustmentForm,
    payrollRunForm,
    visibleStaffProfileOptions,
    staffPayrollCalculations,
    employeeProfileById,
    profileById,
    hrSettings,
    staffCostAllocations,
    costAssignments,
    setPayrollRunForm,
    payrollPeriodStart,
    payrollPeriodEnd,
    attendanceSettings,
  }))
  const { downloadPayrollExcel } = createStaffPayrollExportActions(() => ({
    payrollPeriodStart,
    payrollPeriodEnd,
    payrollSourceSnapshots,
    visibleStaffProfileOptions,
    employeeProfileById,
    staffPayrollCalculations,
    text,
    attendanceLogs,
    profileById,
    leaveRequests,
    hrAdjustments,
    hrSettings,
    attendanceSettings,
    setStatus,
  }))
  const {
    loadGames,
    loadPrices,
    loadDiscounts,
    loadLoyaltyRules,
    handleGameImageUpload,
    saveGame,
    savePrice,
    saveDiscount,
    updateDiscountType,
    updateDiscountValueUnit,
    updateDiscountValue,
    saveLoyaltyRule,
    editGame,
    startNewGame,
    updateGameAudience,
    updateGameGuideText,
    updateGameArena,
    editPrice,
    editDiscount,
    editLoyaltyRule,
  } = createStaffCommerceActions(() => ({
    runStaffLoader,
    setGames,
    setPrices,
    setDiscounts,
    setLoyaltyRules,
    canManageConfig,
    setStatus,
    text,
    setGameImageUploading,
    gameForm,
    profile,
    setGameForm,
    consumeStaffRateLimit,
    setSaving,
    markStaffDataStale,
    priceForm,
    setPriceForm,
    canCreateOrders,
    commerceTab,
    discountForm,
    setDiscountForm,
    loyaltyForm,
    loyaltyRules,
    setLoyaltyForm,
    setCommerceTab,
  }))
  const {
    loadProfiles,
    loadAchievementAwards,
    fetchAuditLogs,
    loadDeletedRecords,
    createCustomerAccount,
    updateProfileRole,
    stageProfileRole,
    clearStagedProfileRole,
    canDeleteProfileAccount,
    openProfileDeleteDialog,
    deleteProfileAccount,
    restoreDeletedRecord,
  } = createStaffClientsActions(() => ({
    runStaffLoader,
    roleSort,
    setProfiles,
    setPendingRoleChanges,
    canAwardAchievements,
    setAchievementAwards,
    canRestoreDeleted,
    setDeletedRecords,
    canCreateCustomerAccounts,
    isCustomerInviteSaving,
    customerInviteForm,
    setCustomerInviteStatus,
    text,
    setIsCustomerInviteSaving,
    setCustomerTemporaryAccess,
    setCustomerInviteForm,
    setStatus,
    markStaffDataStale,
    canManageRoles,
    setSaving,
    setRoleSaveFeedback,
    profile,
    setProfileDeleteDraft,
    profileDeleteDraft,
    currentTab,
  }))
  const { fetchOrderPayments, loadRecentOrders } = createStaffOrdersActions(() => ({ ordersRequestRef, ordersQueryKey, ordersQuery, runStaffLoader, ordersPageSize, setBrowsedOrders, setOrderPayments }))
  const { retryCurrentData, runStaffLoader, markStaffDataStale } = createStaffLoadingActions(() => ({ currentDataKeys, setDataErrors, setDataRetry, inFlightDataRef, loadedDataRef, setLoadingData, setStatus }))


  return (
    <section className={`section staff-console ${isHrConsole ? 'staff-hr-route' : ''}`} data-testid="staff-console">
      {kioskOperator && onKioskLock && (
        <div className="staff-kiosk-operator-bar">
          <div>
            <span className="staff-kiosk-operator-bar-avatar" style={{ background: kioskOperator.avatarColor || undefined, color: kioskOperator.avatarTextColor || undefined }}>
              {kioskOperator.avatarEmoji || kioskOperator.avatarInitials || <UserRound aria-hidden="true" size={18} />}
            </span>
            <span><small>{kioskText.secured}</small><strong>{kioskOperator.name} · {kioskOperator.accessRole === 'manager' ? kioskText.manager : kioskText.staff}</strong></span>
          </div>
          <button className="secondary" type="button" onClick={onKioskLock}>
            <LockKeyhole aria-hidden="true" size={17} /> {kioskText.lock}
          </button>
        </div>
      )}
      {!isHrConsole && (
        <div className="staff-console-nav" aria-label={text.aria.staffConsole}>
          <div className="staff-tabs-shell">
            <button
              aria-label={resolvedLanguage === 'vi' ? 'Cuộn menu sang trái' : 'Scroll menu left'}
              className="staff-tabs-scroll-button"
              disabled={!canScrollStaffTabsBack}
              type="button"
              onClick={() => scrollStaffTabs(-1)}
            >
              <ChevronLeft aria-hidden="true" size={18} strokeWidth={2.4} />
            </button>
            <div className="staff-tabs" ref={staffTabsRef} role="tablist" aria-label={text.aria.staffConsole}>
              {visibleTabGroups.map((group) => (
                <div className={currentTabGroup === group.id ? 'staff-tab-group active' : 'staff-tab-group'} key={group.id} role="presentation">
                  <span aria-hidden="true" className="staff-tab-group-label">{text.tabGroups[group.id]}</span>
                  <div className="staff-tab-group-buttons" role="presentation">
                    {group.tabs.map((tab) => (
                      <Fragment key={tab}>{tabButton(tab, text.tabs[tab])}</Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              aria-label={resolvedLanguage === 'vi' ? 'Cuộn menu sang phải' : 'Scroll menu right'}
              className="staff-tabs-scroll-button"
              disabled={!canScrollStaffTabsForward}
              type="button"
              onClick={() => scrollStaffTabs(1)}
            >
              <ChevronRight aria-hidden="true" size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}

      {status && <p className="sr-only" aria-live="polite">{status}</p>}
      {currentTabLoading && <AppLoadingState compact label={text.loading} />}
      {currentTabError && <div className="notice" role="alert"><p>{resolvedLanguage === 'vi' ? 'Không thể tải dữ liệu. Vui lòng thử lại.' : 'Couldn’t load this data. Please try again.'}</p><button type="button" disabled={currentTabLoading} onClick={retryCurrentData}>{resolvedLanguage === 'vi' ? 'Thử lại' : 'Try again'}</button></div>}

      {currentTabReady && currentTab === 'new' && (<NewSection
        text={text}
        booking={booking}
        onOpenSessionCalendar={onOpenSessionCalendar}
        setOperationsDate={setOperationsDate}
        setActiveTab={setActiveTab}
        canCreateOrders={canCreateOrders}
        saving={saving}
        bookingText={bookingText}
        setBooking={setBooking}
        setGuestBooking={setGuestBooking}
        setCustomerNameFocused={setCustomerNameFocused}
        showCustomerNameSuggestions={showCustomerNameSuggestions}
        customerSuggestionIndex={customerSuggestionIndex}
        handleCustomerNameChange={handleCustomerNameChange}
        setCustomerSuggestionIndex={setCustomerSuggestionIndex}
        visibleCustomerSuggestions={visibleCustomerSuggestions}
        canOfferNewCustomer={canOfferNewCustomer}
        selectCustomerSuggestion={selectCustomerSuggestion}
        sharedText={sharedText}
        bookingGames={bookingGames}
        selectedGame={selectedGame}
        bookingDateInputRef={bookingDateInputRef}
        selectedBookingArena={selectedBookingArena}
        bookingArenas={bookingArenas}
        selectedDiscount={selectedDiscount}
        availableBookingDiscounts={availableBookingDiscounts}
        addBookingPaymentSplit={addBookingPaymentSplit}
        updateBookingPaymentSplit={updateBookingPaymentSplit}
        removeBookingPaymentSplit={removeBookingPaymentSplit}
        bookingPaidTotal={bookingPaidTotal}
        bookingRemainingTotal={bookingRemainingTotal}
        quote={quote}
        bookingVenueName={bookingVenueName}
        resolvedLanguage={resolvedLanguage}
        status={status}
        createOrder={createOrder}
      />)}

      {currentTabReady && currentTab === 'today' && (<TodaySection
        text={text}
        operationsDate={operationsDate}
        setOperationsDate={setOperationsDate}
        onOpenSessionCalendar={onOpenSessionCalendar}
        canCreateOrders={canCreateOrders}
        setBooking={setBooking}
        setActiveTab={setActiveTab}
        operationSessionScope={operationSessionScope}
        setOperationSessionScope={setOperationSessionScope}
        operationSummary={operationSummary}
        operationSessions={operationSessions}
        operationOrderBySessionId={operationOrderBySessionId}
        expandedOperationSessions={expandedOperationSessions}
        games={games}
        profiles={profiles}
        orderPaymentsByOrderId={orderPaymentsByOrderId}
        visitText={visitText}
        visitFeedback={visitFeedback}
        setExpandedOperationSessions={setExpandedOperationSessions}
        saving={saving}
        setPaymentOrderId={setPaymentOrderId}
        setVisitFeedback={setVisitFeedback}
        updateOrder={updateOrder}
        openOperationDeleteDraft={openOperationDeleteDraft}
        paymentOrderId={paymentOrderId}
        onEditBooking={setEditingBookingId}
        orderPaymentForm={orderPaymentForm}
        resolvedLanguage={resolvedLanguage}
        visitOrderSelection={visitOrderSelection}
        setVisitOrderSelection={setVisitOrderSelection}
        orders={orders}
        linkVisitOrder={linkVisitOrder}
        updateOperationSession={updateOperationSession}
        setOperationAddProfileQueryBySession={setOperationAddProfileQueryBySession}
        setOperationAddProfileBySession={setOperationAddProfileBySession}
        operationAddProfileQueryBySession={operationAddProfileQueryBySession}
        operationAddProfileBySession={operationAddProfileBySession}
        addOperationParticipant={addOperationParticipant}
        removeOperationParticipant={removeOperationParticipant}
        updateOperationParticipant={updateOperationParticipant}
        updateOperationChapterTime={updateOperationChapterTime}
        unlinkedOperationOrders={unlinkedOperationOrders}
        orderRows={orderRows}
      />)}

      {currentTabReady && currentTab === 'attendance' && (<AttendanceSection
        shiftAttendanceRange={shiftAttendanceRange}
        attendanceWeekDates={attendanceWeekDates}
        text={text}
        attendanceWeekStart={attendanceWeekStart}
        setAttendanceRange={setAttendanceRange}
        attendanceWeekEnd={attendanceWeekEnd}
        resetAttendanceRangeToThisWeek={resetAttendanceRangeToThisWeek}
        canEditAttendance={canEditAttendance}
        attendanceSummary={attendanceSummary}
        visibleAttendanceTabs={visibleAttendanceTabs}
        currentAttendanceTab={currentAttendanceTab}
        setAttendanceTab={setAttendanceTab}
        visibleStaffProfileOptions={visibleStaffProfileOptions}
        selectedShiftTemplate={selectedShiftTemplate}
        applyShiftTemplate={applyShiftTemplate}
        canManageAttendance={canManageAttendance}
        effectiveShiftTemplates={effectiveShiftTemplates}
        copyPreviousAttendanceWeek={copyPreviousAttendanceWeek}
        saving={saving}
        publishAttendanceWeek={publishAttendanceWeek}
        draftShiftCount={draftShiftCount}
        attendanceGridStyle={attendanceGridStyle}
        employeeProfileById={employeeProfileById}
        attendanceShiftsByCell={attendanceShiftsByCell}
        visibleAttendanceShifts={visibleAttendanceShifts}
        draggingShiftId={draggingShiftId}
        moveShiftToCell={moveShiftToCell}
        setDraggingShiftId={setDraggingShiftId}
        startShiftForCell={startShiftForCell}
        shiftWarningsById={shiftWarningsById}
        editShift={editShift}
        profileById={profileById}
        updateShiftStatus={updateShiftStatus}
        shiftForm={shiftForm}
        firstStaffProfileId={firstStaffProfileId}
        setShiftForm={setShiftForm}
        saveShift={saveShift}
        visibleAttendanceLogs={visibleAttendanceLogs}
        editAttendanceLog={editAttendanceLog}
        attendanceLogForm={attendanceLogForm}
        setAttendanceLogForm={setAttendanceLogForm}
        saveAttendanceLog={saveAttendanceLog}
        visibleLeaveRequests={visibleLeaveRequests}
        editLeaveRequest={editLeaveRequest}
        updateLeaveStatus={updateLeaveStatus}
        leaveForm={leaveForm}
        setLeaveForm={setLeaveForm}
        submitLeaveRequest={submitLeaveRequest}
        attendanceSettings={attendanceSettings}
        setAttendanceSettings={setAttendanceSettings}
        updateAttendanceShiftTemplate={updateAttendanceShiftTemplate}
        saveAttendanceSettings={saveAttendanceSettings}
      />)}

      {currentTabReady && currentTab === 'hr' && (<HrSection
        approvePayrollRun={approvePayrollRun}
        downloadEmployeePayslip={downloadEmployeePayslip}
        downloadPayrollExcel={downloadPayrollExcel}
        generatePayrollRun={generatePayrollRun}
        hrAdjustmentForm={hrAdjustmentForm}
        hrPayrollTotals={hrPayrollTotals}
        leaveRequests={leaveRequests}
        payrollItems={payrollItems}
        payrollPeriodEnd={payrollPeriodEnd}
        payrollPeriodStart={payrollPeriodStart}
        payrollRunForm={payrollRunForm}
        payrollRuns={payrollRuns}
        periodHrAdjustments={periodHrAdjustments}
        profileById={profileById}
        costAssignments={costAssignments}
        loadHrData={loadHrData}
        staffCostAllocations={staffCostAllocations}
        saveHrAdjustment={saveHrAdjustment}
        setHrAdjustmentForm={setHrAdjustmentForm}
        setPayrollRunForm={setPayrollRunForm}
        staffPayrollCalculations={staffPayrollCalculations}
        updateHrAdjustmentStatus={updateHrAdjustmentStatus}
        visibleStaffProfileOptions={visibleStaffProfileOptions}
        approveAttendancePeriod={approveAttendancePeriod}
        applyShiftTemplate={applyShiftTemplate}
        attendanceLogs={attendanceLogs}
        attendanceScheduleScopeOptions={attendanceScheduleScopeOptions}
        attendanceSettings={attendanceSettings}
        attendanceShiftsByCell={attendanceShiftsByCell}
        attendanceWeekEnd={attendanceWeekEnd}
        attendanceWeekDates={attendanceWeekDates}
        attendanceWeekStart={attendanceWeekStart}
        draggingShiftId={draggingShiftId}
        draftShiftCount={draftShiftCount}
        effectiveAttendanceScheduleScope={effectiveAttendanceScheduleScope}
        effectiveShiftTemplates={effectiveShiftTemplates}
        editShift={editShift}
        firstScheduleStaffProfileId={firstScheduleStaffProfileId}
        saveAttendanceSettings={saveAttendanceSettings}
        saveShift={saveShift}
        selectedShiftTemplate={selectedShiftTemplate}
        setAttendanceScheduleScope={setAttendanceScheduleScope}
        setAttendanceSettings={setAttendanceSettings}
        setAttendanceRange={setAttendanceRange}
        setDraggingShiftId={setDraggingShiftId}
        setShiftForm={setShiftForm}
        shiftForm={shiftForm}
        shiftAttendanceRange={shiftAttendanceRange}
        shiftWarningsById={shiftWarningsById}
        startShiftForCell={startShiftForCell}
        resetAttendanceRangeToThisWeek={resetAttendanceRangeToThisWeek}
        updateShiftStatus={updateShiftStatus}
        visibleScheduleAttendanceShifts={visibleScheduleAttendanceShifts}
        visibleScheduleStaffProfileOptions={visibleScheduleStaffProfileOptions}
        copyPreviousAttendanceWeek={copyPreviousAttendanceWeek}
        moveShiftToCell={moveShiftToCell}
        publishAttendanceWeek={publishAttendanceWeek}
        canEditEmployeeProfiles={canEditEmployeeProfiles}
        canAccessHrSettings={canAccessHrSettings}
        canAccessZaloSettings={canAccessZaloSettings}
        canManageEmployeeKioskPins={canManageEmployeeKioskPins}
        canManageAttendance={canManageAttendance}
        isOwnerOrAdmin={isOwnerOrAdmin}
        canRevealEmployeeKioskPin={canRevealEmployeeKioskPin}
        editEmployeeProfile={editEmployeeProfile}
        configureEmployeeKioskPin={configureEmployeeKioskPin}
        createEmployeeRecord={createEmployeeRecord}
        employeeForm={employeeForm}
        employeeKioskAccessRole={employeeKioskAccessRole}
        employeeKioskPin={employeeKioskPin}
        employeeKioskPinConfirm={employeeKioskPinConfirm}
        employeeKioskPinEmailRecipient={employeeKioskPinEmailRecipient}
        employeeKioskPinEmailState={employeeKioskPinEmailState}
        employeeKioskPinSaveConfirmation={employeeKioskPinSaveConfirmation}
        employeeKioskPinLoading={employeeKioskPinLoading}
        employeeKioskPinVisibleValue={employeeKioskPinVisibleValue}
        employeePayrollSummary={employeePayrollSummary}
        employeeProfileById={employeeProfileById}
        firstEmployeeStaffProfileId={firstEmployeeStaffProfileId}
        generateEmployeeKioskPin={generateEmployeeKioskPin}
        handleHrDocumentUpload={handleHrDocumentUpload}
        hrDocumentUploading={hrDocumentUploading}
        saveEmployeeProfile={saveEmployeeProfile}
        sendEmployeeKioskPinEmail={sendEmployeeKioskPinEmail}
        selectedEmployeeDocuments={selectedEmployeeDocuments}
        selectedEmployeeOutstandingDebt={selectedEmployeeOutstandingDebt}
        selectedEmployeeStaffId={selectedEmployeeStaffId}
        selectedEmployeeStaffProfile={selectedEmployeeStaffProfile}
        setEmployeeForm={setEmployeeForm}
        setEmployeeKioskAccessRole={setEmployeeKioskAccessRole}
        setEmployeeKioskPin={setEmployeeKioskPin}
        setEmployeeKioskPinConfirm={setEmployeeKioskPinConfirm}
        visibleAllStaffProfileOptions={visibleAllStaffProfileOptions}
        hrContractTypeOptions={hrContractTypeOptions}
        hrDepartmentOptions={hrDepartmentOptions}
        hrJobTitleOptions={hrJobTitleOptions}
        hrLocationOptions={hrLocationOptions}
        hrOptionsByType={hrOptionsByType}
        hrSettings={hrSettings}
        hrSetupForm={hrSetupForm}
        hrSetupOptions={hrSetupOptions}
        saveHrSettings={saveHrSettings}
        saveHrSetupOption={saveHrSetupOption}
        updateHrSetupOption={updateHrSetupOption}
        setHrSetupOptionActive={setHrSetupOptionActive}
        setHrSettings={setHrSettings}
        setHrSetupForm={setHrSetupForm}
        syncPayrollDraft={syncPayrollDraft}
        hrTab={hrTab}
        resolvedLanguage={resolvedLanguage}
        saving={saving}
        setHrTab={setHrTab}
        setStatus={setStatus}
        sharedText={sharedText}
        text={text}
      />)}

      {currentTabReady && currentTab === 'games' && (<GamesSection
        gameForm={gameForm}
        text={text}
        canManageConfig={canManageConfig}
        setGameForm={setGameForm}
        gameImageUploading={gameImageUploading}
        handleGameImageUpload={handleGameImageUpload}
        selectedGameAudiences={selectedGameAudiences}
        updateGameAudience={updateGameAudience}
        selectedGameArenaIds={selectedGameArenaIds}
        updateGameArena={updateGameArena}
        updateGameGuideText={updateGameGuideText}
        saving={saving}
        saveGame={saveGame}
        startNewGame={startNewGame}
        games={games}
        editGame={editGame}
      />)}

      {currentTabReady && currentTab === 'prices' && (
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

      {currentTabReady && currentTab === 'discounts' && (<DiscountsSection
        canEditCommerceTab={canEditCommerceTab}
        text={text}
        commerceTab={commerceTab}
        loyaltyForm={loyaltyForm}
        setLoyaltyForm={setLoyaltyForm}
        games={games}
        saving={saving}
        saveLoyaltyRule={saveLoyaltyRule}
        discountForm={discountForm}
        setDiscountForm={setDiscountForm}
        prices={prices}
        updateDiscountType={updateDiscountType}
        selectedDiscountValueUnit={selectedDiscountValueUnit}
        updateDiscountValue={updateDiscountValue}
        updateDiscountValueUnit={updateDiscountValueUnit}
        discountHasHourLimit={discountHasHourLimit}
        saveDiscount={saveDiscount}
        openCommerceTab={openCommerceTab}
        loyaltyRules={loyaltyRules}
        editLoyaltyRule={editLoyaltyRule}
        voucherRules={voucherRules}
        discountRules={discountRules}
        editDiscount={editDiscount}
        gameNameById={gameNameById}
        priceRuleNameById={priceRuleNameById}
      />)}

      {currentTabReady && currentTab === 'clientProfile' && (canCreateCustomerAccounts || canAwardAchievements) && (<ClientProfileSection
        canCreateCustomerAccounts={canCreateCustomerAccounts}
        text={text}
        customerInviteForm={customerInviteForm}
        setCustomerInviteForm={setCustomerInviteForm}
        sharedText={sharedText}
        isCustomerInviteSaving={isCustomerInviteSaving}
        createCustomerAccount={createCustomerAccount}
        customerInviteStatus={customerInviteStatus}
        customerTemporaryAccess={customerTemporaryAccess}
        resolvedLanguage={resolvedLanguage}
        setCustomerInviteStatus={setCustomerInviteStatus}
        canAwardAchievements={canAwardAchievements}
        achievementAwards={achievementAwards}
        setClientProfileDirty={setClientProfileDirty}
        markStaffDataStale={markStaffDataStale}
        loadAchievementAwards={loadAchievementAwards}
        awardableProfiles={awardableProfiles}
        loadingData={loadingData}
      />)}

      {currentTabReady && currentTab === 'roles' && (<RolesSection
        text={text}
        setRoleHelpOpen={setRoleHelpOpen}
        roleSearch={roleSearch}
        setRoleSearch={setRoleSearch}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        roleSort={roleSort}
        setRoleSort={setRoleSort}
        filteredRoleProfiles={filteredRoleProfiles}
        pendingRoleChanges={pendingRoleChanges}
        roleSaveFeedback={roleSaveFeedback}
        canOpenRoleProfiles={canOpenRoleProfiles}
        onOpenPlayerProfile={onOpenPlayerProfile}
        canManageRoles={canManageRoles}
        saving={saving}
        stageProfileRole={stageProfileRole}
        canRestoreDeleted={canRestoreDeleted}
        canDeleteProfileAccount={canDeleteProfileAccount}
        openProfileDeleteDialog={openProfileDeleteDialog}
        updateProfileRole={updateProfileRole}
        clearStagedProfileRole={clearStagedProfileRole}
      />)}

      {currentTabReady && currentTab === 'restore' && canRestoreDeleted && (
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
                  {record.deleted_by && (
                    <small className="staff-restore-actor">
                      {text.labels.deletedBy}: {deletedRecordActorLabel(record)}
                    </small>
                  )}
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

      {editingBookingId && canCreateOrders && <StaffCalendarBookingDialog key={editingBookingId} sessionId={editingBookingId} language={resolvedLanguage} onClose={() => setEditingBookingId(null)} onSaved={() => {
        setEditingBookingId(null)
        setPaymentOrderId(null)
        setOrderEditDraft(null)
        markStaffDataStale('today', 'orders', 'report')
        if (currentTab === 'orders') void loadRecentOrders()
        if (currentTab === 'today') void Promise.all([loadTodayOrders(true), loadTodaySessions(true)])
        if (currentTab === 'report') void loadReportData(true)
        setStatus(text.messages.orderUpdated)
      }} />}

      {currentTab === 'orders' && (
        <div className="staff-card">
          <h3>{text.labels.orders}</h3>
          <p>{resolvedLanguage === 'vi' ? 'Dùng Sửa đặt chỗ / Chuyển cửa hàng để đổi cửa hàng, trò chơi hoặc giờ. Lịch và Hôm nay cũng có chức năng này.' : 'Use Edit booking / Move shop to change the shop, game or time. The same editor is available in Calendar and Today.'}</p>
          <form className="staff-orders-filters staff-operation-field-grid" onSubmit={(event) => {
            event.preventDefault()
            if (!ordersRange.start || !ordersRange.end) return
            const [start, end] = orderedRange(ordersRange.start, ordersRange.end)
            setOrdersQuery({ start, end, page: 0, shop: ordersShop })
          }}>
            <label>{text.labels.startDate}<input required type="date" value={ordersRange.start} onChange={(event) => setOrdersRange((current) => ({ ...current, start: event.target.value }))} /></label>
            <label>{resolvedLanguage === 'vi' ? 'Ngày kết thúc' : 'End date'}<input required type="date" value={ordersRange.end} onChange={(event) => setOrdersRange((current) => ({ ...current, end: event.target.value }))} /></label>
            <label>{bookingText.shop}<select value={ordersShop} onChange={(event) => setOrdersShop(event.target.value)}><option value="all">{resolvedLanguage === 'vi' ? 'Tất cả cửa hàng' : 'All shops'}</option><option value="ha-do-centrosa">Hà Đô Centrosa</option><option value="cafe-des-stagiaires">Café des Stagiaires</option></select></label>
            <button className="secondary" type="submit" disabled={currentTabLoading || saving}>{resolvedLanguage === 'vi' ? 'Xem đơn hàng' : 'Show orders'}</button>
          </form>
          <p>{resolvedLanguage === 'vi' ? 'Ngày đặt chỗ' : 'Booking dates'}: {ordersQuery.start} — {ordersQuery.end}. {resolvedLanguage === 'vi' ? '50 đơn mỗi trang. Có thể xem bất kỳ khoảng ngày nào.' : '50 orders per page. Choose any date range to browse the full history.'}</p>
          {currentTabReady && browsedOrders && <>
            <p role="status">{resolvedLanguage === 'vi' ? 'Đang hiển thị' : 'Showing'} {browsedOrders.rows.length ? ordersQuery.page * ordersPageSize + 1 : 0}–{ordersQuery.page * ordersPageSize + browsedOrders.rows.length} / {browsedOrders.total}</p>
            {orderRows(browsedOrders.rows)}
          </>}
          <nav className="staff-row-actions" aria-label={resolvedLanguage === 'vi' ? 'Trang đơn hàng' : 'Order pages'}>
            <button type="button" disabled={currentTabLoading || saving || ordersQuery.page === 0} onClick={() => setOrdersQuery((query) => ({ ...query, page: query.page - 1 }))}>{resolvedLanguage === 'vi' ? 'Trang trước' : 'Previous page'}</button>
            <button type="button" disabled={!currentTabReady || saving || !browsedOrders || (ordersQuery.page + 1) * ordersPageSize >= browsedOrders.total} onClick={() => setOrdersQuery((query) => ({ ...query, page: query.page + 1 }))}>{resolvedLanguage === 'vi' ? 'Trang sau' : 'Next page'}</button>
          </nav>
        </div>
      )}

      {currentTabReady && currentTab === 'report' && (<ReportSection
        resolvedLanguage={resolvedLanguage}
        reportView={reportView}
        selectReportView={selectReportView}
        text={text}
        reportStart={reportStart}
        reportEnd={reportEnd}
        activeReportPreset={activeReportPreset}
        setReportStart={setReportStart}
        todayReportStart={todayReportStart}
        setReportEnd={setReportEnd}
        todayReportEnd={todayReportEnd}
        secondaryReportPreset={secondaryReportPreset}
        secondaryReportStart={secondaryReportStart}
        secondaryReportEnd={secondaryReportEnd}
        setReportDatePickerTarget={setReportDatePickerTarget}
        setReportDatePickerOpen={setReportDatePickerOpen}
        compareEnabled={compareEnabled}
        compareStart={compareStart}
        compareEnd={compareEnd}
        isPreviousPeriodComparison={isPreviousPeriodComparison}
        applyPreviousPeriodComparison={applyPreviousPeriodComparison}
        setCompareEnabled={setCompareEnabled}
        reportExporting={reportExporting}
        runReportExport={runReportExport}
        exportExcelReport={exportExcelReport}
        exportPdfReport={exportPdfReport}
        accountantExportOpen={accountantExportOpen}
        setAccountantExportOpen={setAccountantExportOpen}
        accountantExportStore={accountantExportStore}
        setAccountantExportStore={setAccountantExportStore}
        accountantExportLanguage={accountantExportLanguage}
        accountantExportFormat={accountantExportFormat}
        setAccountantExportFormat={setAccountantExportFormat}
        setAccountantIncludeAttachments={setAccountantIncludeAttachments}
        setAccountantExportLanguage={setAccountantExportLanguage}
        accountantIncludeAttachments={accountantIncludeAttachments}
        accountantReportId={accountantReportId}
        setAccountantReportId={setAccountantReportId}
        downloadAccountantExport={downloadAccountantExport}
        reportExportFeedback={reportExportFeedback}
        report={report}
        weekdayRevenue={weekdayRevenue}
        comparisonWeekdayRevenue={comparisonWeekdayRevenue}
        weekdayRevenueMax={weekdayRevenueMax}
        hourlyRevenueMax={hourlyRevenueMax}
        comparisonHourlyAreaPath={comparisonHourlyAreaPath}
        hourlyAreaPath={hourlyAreaPath}
        comparisonHourlyLinePath={comparisonHourlyLinePath}
        hourlyLinePath={hourlyLinePath}
        reportChartMode={reportChartMode}
        setReportChartMode={setReportChartMode}
        reportSeries={reportSeries}
        comparisonSeries={comparisonSeries}
        reportChartMax={reportChartMax}
        reportLinePath={reportLinePath}
        comparisonLinePath={comparisonLinePath}
        pieStops={pieStops}
        pieItems={pieItems}
        comparisonReport={comparisonReport}
        paymentMix={paymentMix}
        orderRows={orderRows}
        reportOrders={reportOrders}
        reportPaymentsByOrderId={reportPaymentsByOrderId}
        playerInsightsSnapshot={playerInsightsSnapshot}
        loadingData={loadingData}
        qrAnalyticsSnapshot={qrAnalyticsSnapshot}
        qrAnalyticsError={qrAnalyticsError}
      />)}

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
