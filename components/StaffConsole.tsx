'use client'

import {
  buildStaffReport,
  buildDailySeries,
  emptyStaffReport,
  buildWeekdayRevenue,
  buildHourlyRevenue,
  buildSmoothLineChartPath,
  buildChartAreaPath,
  buildLineChartPath,
  conicStops,
  staffReportSnapshotFromRpc,
  staffOrdersPageFromRpc,
  percentChange,
  mergeOrderPayments,
  paymentMapFromRows,
  staffOrderPaymentRows,
  orderPaidAmount,
} from '../lib/staff/reporting'
import {
  dateInputValue,
  dateFromInput,
  addDays,
  orderedRange,
} from '../lib/staff/dates'

import type {
  StaffTab,
  StaffTabGroupId,
  StaffCommerceTab,
  StaffAttendanceTab,
  StaffHrTab,
  StaffScheduleScope,
  StaffOperationScope,
  StaffRole,
  StaffRoleSort,
  StaffReportChartMode,
  StaffReportView,
  StaffReportRangePreset,
  AccountantExportFormat,
  StaffShiftTemplateId,
  StaffShiftTemplate,
  StaffEmploymentType,
  AccountantExportReportId,
  StaffPaymentMethod,
  StaffDiscountValueUnit,
  StaffDiscountDayScope,
  StaffDiscountTicketType,
  StaffAudience,
  StaffGuideTextMap,
  PaymentSplitDraft,
  PaymentSplitPayload,
  StaffProfile,
  StaffGame,
  StaffPriceRule,
  StaffDiscount,
  StaffLoyaltyRule,
  StaffShiftStatus,
  StaffAttendanceStatus,
  StaffLeaveType,
  StaffLeaveStatus,
  StaffGender,
  StaffContractStatus,
  StaffHrSetupOptionType,
  StaffHrAdjustmentType,
  StaffHrAdjustmentStatus,
  StaffPayrollStatus,
  StaffPayrollPayCycle,
  StaffHrDocumentType,
  StaffScheduleShift,
  StaffAttendanceLog,
  StaffLeaveRequest,
  StaffEmployeeProfile,
  StaffAttendanceSettings,
  StaffHrSettings,
  StaffHrSetupOption,
  StaffHrAdjustment,
  StaffPayrollRun,
  StaffPayrollItem,
  StaffPayrollSourceSnapshot,
  StaffHrDocument,
  StaffPayrollCalculation,
  StaffOrder,
  StaffOrderEditDraft,
  StaffOrderPayment,
  StaffSessionParticipant,
  StaffOperationSession,
  StaffDeleteSessionDraft,
  RoleSaveFeedback,
  StaffProfileDeleteDraft,
  StaffAuditLog,
  SoftDeletedRecord,
  StaffDataKey,
  StaffReportSummary,
  StaffDailyPoint,
  StaffReportSnapshot,
  BookingForm,
  CustomerInviteForm,
  CustomerTemporaryAccess,
  StaffConsoleProps,
  StaffConsoleLanguage,
  StaffPickerFieldProps,
} from '../lib/staff/types'
export type { StaffProfile } from '../lib/staff/types'
import {
  staffConsoleText,
  type StaffConsoleCopy,
} from '../lib/staff/copy'

import { summarizeOperationMoney } from '../lib/staffOperationMoney'
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
  LockKeyhole,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  UserRound,
  UserX,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { languageOptions, type LanguageCode } from '../lib/i18n/languages'
import { uiText } from '../lib/i18n/translations'
import { normalizePhonePasswordIdentifier } from '../lib/phonePasswordAccount'
import type { RateLimitAction } from '../lib/security/rateLimit'
import { isStaffAdminEmail as isAdminEmail, isStaffAdminOnlyEmail as isAdminOnlyEmail, isStaffOwnerEmail as isOwnerEmail, staffConsoleRoleRank as staffRank } from '../lib/staffRoles'
import { allocateStaffCompanyCost, employeeHomeLocation, type StaffCostAssignment } from '../lib/staffCostAllocation'
import { getStaffKioskOperatorToken, STAFF_KIOSK_HEADER, supabase } from '../lib/supabase/client'
import { notifyBookingUpdateEmail } from '../lib/bookingUpdateNotificationClient'
import type { StaffEmployeeRecordEmploymentType } from '../lib/staffEmployeeRecord'
import { isStaffKioskEligibleDepartment } from '../lib/staffKioskDirectory'
import { calculatePayrollTaxBases, calculateProgressivePit, progressivePitExcelFormula } from '../lib/hrPayrollPolicy'
import { hasCompleteHistoricalAccountantLayout, historicalAccountantCategory, historicalAccountantPlacement, sortHistoricalAccountantRows } from '../lib/historicalAccountantPayroll'
import { employeeBonusPercentageForPeriod, employeeSalaryPercentageForPeriod } from '../lib/staffPayrollProbation'
import { calculateTimesheetBasePay, isMealAllowanceEligible, payrollFallbackPeriodBasis, resolveEmployeePayrollCalendar } from '../lib/staffPayrollPeriod'
import { canAccessCoreHrSettings, canAccessZaloHrSettings, requiresStaffKioskPin } from '../lib/staffKioskScope'
import { vrenaPalette } from '../lib/theme/vrenaPalette'
import type { StaffAchievementAward } from './StaffAchievementAwardPanel'
import type { StaffPlayerInsightsSnapshot } from './StaffPlayerInsights'
import type { StaffQrAnalyticsSnapshot } from './StaffQrAnalytics'
import AppLoadingState from './AppLoadingState'
import { PhoneNumberInput } from './CountryCodePicker'
import StaffPlayerAchievementProfile from './StaffPlayerAchievementProfile'
import { staffKioskCopy } from './StaffKioskGate'

const StaffReportDateRangeModal = dynamic(() => import('./StaffReportDateRangeModal'), {
  ssr: false,
})

const StaffHrHub = dynamic(() => import('./StaffHrHub'), {
  ssr: false,
})

const StaffPlayerInsights = dynamic(() => import('./StaffPlayerInsights'), {
  ssr: false,
})

const StaffQrAnalytics = dynamic(() => import('./StaffQrAnalytics'), {
  ssr: false,
})

function ButtonIconText({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <span className="button-icon-text">
      {icon}
      <span>{children}</span>
    </span>
  )
}

const staffTabGroups: Array<{ id: StaffTabGroupId; tabs: StaffTab[] }> = [
  { id: 'operate', tabs: ['new', 'clientProfile', 'today', 'orders'] },
  { id: 'reports', tabs: ['report'] },
  { id: 'team', tabs: ['attendance', 'hr', 'roles'] },
  { id: 'setup', tabs: ['games', 'prices', 'discounts'] },
  { id: 'admin', tabs: ['restore'] },
]

const emptyStaffOrders: StaffOrder[] = []
const emptyStaffPayments: StaffOrderPayment[] = []
const emptyStaffDailySeries: StaffDailyPoint[] = []

const staffDiscountDayScopes: StaffDiscountDayScope[] = ['all', 'weekday', 'weekend', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const staffDiscountTicketTypes: StaffDiscountTicketType[] = ['all', 'individual', 'birthday', 'corporate']

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

function addMonths(value: string, months: number) {
  const date = dateFromInput(value)
  date.setMonth(date.getMonth() + months)
  return dateInputValue(date)
}

function daysBetween(start: string, end: string) {
  return Math.round((dateFromInput(end).getTime() - dateFromInput(start).getTime()) / 86400000)
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
    message.includes('schema cache')
  )
}

function isStaffHrPermissionDenied(error?: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42501' || (error.message || '').toLowerCase().includes('permission denied')
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
  return Math.max(0, Number(settings.rest_period_minutes) || 0)
}

function normalizeEmployeePayrollType(value: string | null | undefined): 'hourly' | 'monthly' | 'manager' {
  return value === 'monthly' || value === 'manager' ? value : 'hourly'
}

function employeePayrollTypeForPeriod(employee: StaffEmployeeProfile | undefined, periodEnd: string) {
  const probationEnd = employee?.probation_end_date || ''
  const laborStart = employee?.labor_start_date || ''
  const probationApplies = Boolean(
    (employee?.probation_start_date && periodEnd >= employee.probation_start_date) &&
    (!probationEnd || periodEnd <= probationEnd) &&
    (!laborStart || periodEnd < laborStart)
  )
  return probationApplies
    ? normalizeEmployeePayrollType(employee?.probation_payroll_type)
    : normalizeEmployeePayrollType(employee?.labor_payroll_type)
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

function leaveHoursInsidePeriod(leave: StaffLeaveRequest, periodStart: string, periodEnd: string) {
  const overlapStart = leave.start_date > periodStart ? leave.start_date : periodStart
  const overlapEnd = leave.end_date < periodEnd ? leave.end_date : periodEnd
  if (overlapStart > overlapEnd) return 0
  const requestDays = Math.max(1, daysBetween(leave.start_date, leave.end_date) + 1)
  const overlapDays = Math.max(1, daysBetween(overlapStart, overlapEnd) + 1)
  return Math.max(0, Number(leave.hours) || 0) * overlapDays / requestDays
}

function leaveSalaryUnitsInsidePeriod(
  leave: StaffLeaveRequest,
  employee: StaffEmployeeProfile | undefined,
  periodStart: string,
  periodEnd: string,
  standardDailyHours: number,
) {
  const overlapStart = leave.start_date > periodStart ? leave.start_date : periodStart
  const overlapEnd = leave.end_date < periodEnd ? leave.end_date : periodEnd
  if (overlapStart > overlapEnd) return 0
  const requestDays = Math.max(1, daysBetween(leave.start_date, leave.end_date) + 1)
  const paidDayFraction = (Math.max(0, Number(leave.hours) || 0) / requestDays) / Math.max(1, standardDailyHours)
  let salaryUnits = 0
  let date = overlapStart
  while (date <= overlapEnd) {
    salaryUnits += paidDayFraction * employeeSalaryPercentageForPeriod(employee, date)
    date = addDays(date, 1)
  }
  return salaryUnits
}

function isPaidLeaveForEmployee(leave: StaffLeaveRequest, employee: StaffEmployeeProfile | undefined) {
  if (employeePayrollTypeForPeriod(employee, leave.end_date) === 'hourly') return false
  return leave.leave_type === 'annual' || leave.leave_type === 'public_holiday'
}

function approvedAttendanceMinutes(log: StaffAttendanceLog) {
  const approvedMinutes = Math.max(0, Number(log.regular_minutes) || 0) + Math.max(0, Number(log.overtime_minutes) || 0)
  if (approvedMinutes > 0) return approvedMinutes
  return minutesBetween(log.clock_in_at, log.clock_out_at, log.break_minutes)
}

function calculateStaffPayroll(
  staffProfileId: string,
  employee: StaffEmployeeProfile | undefined,
  shifts: StaffScheduleShift[],
  logs: StaffAttendanceLog[],
  leaves: StaffLeaveRequest[],
  adjustments: StaffHrAdjustment[],
  settings: StaffHrSettings,
  attendanceSettings: StaffAttendanceSettings,
  periodStart: string,
  periodEnd: string,
  periodReference?: StaffPayrollSourceSnapshot,
): StaffPayrollCalculation {
  const employeeShifts = shifts.filter((shift) => (
    shift.staff_profile_id === staffProfileId &&
    shift.shift_date >= periodStart &&
    shift.shift_date <= periodEnd &&
    ['published', 'completed'].includes(shift.status)
  ))
  const employeeLogs = logs.filter((log) => (
    log.staff_profile_id === staffProfileId &&
    log.work_date >= periodStart &&
    log.work_date <= periodEnd &&
    log.approval_status === 'approved'
  ))
  const employeeLeaves = leaves.filter((leave) => (
    leave.staff_profile_id === staffProfileId &&
    leave.status === 'approved' &&
    leave.end_date >= periodStart &&
    leave.start_date <= periodEnd &&
    isPaidLeaveForEmployee(leave, employee)
  ))
  const employeeAdjustments = adjustments.filter((adjustment) => (
    adjustment.profile_id === staffProfileId &&
    ['approved', 'paid'].includes(adjustment.status) &&
    adjustmentAppliesToPeriod(adjustment, periodStart, periodEnd)
  ))

  const scheduledMinutes = employeeShifts.reduce((sum, shift) => sum + minutesBetweenTimes(shift.start_time, shift.end_time, shift.break_minutes), 0)
  const workedMinutes = employeeLogs.reduce((sum, log) => sum + approvedAttendanceMinutes(log), 0)
  const regularMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.regular_minutes) || 0), 0)
  const computedOvertimeMinutes = scheduledMinutes > 0
    ? Math.max(0, workedMinutes - (regularMinutes || Math.min(workedMinutes, scheduledMinutes)))
    : 0
  const overtimeMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.overtime_minutes) || 0), 0) || computedOvertimeMinutes
  const nightMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.night_minutes) || 0), 0)
  const holidayMinutes = employeeLogs.reduce((sum, log) => sum + Math.max(0, Number(log.holiday_minutes) || 0), 0)
  const paidLeaveHours = employeeLeaves.reduce((sum, leave) => sum + leaveHoursInsidePeriod(leave, periodStart, periodEnd), 0)
  const workedDates = Array.from(new Set(employeeLogs.filter((log) => approvedAttendanceMinutes(log) > 0).map((log) => log.work_date)))
  const workedDays = workedDates.length
  const payrollType = employeePayrollTypeForPeriod(employee, periodEnd)
  const companyStandardDailyMinutes = Math.max(
    1,
    Math.round((Math.max(0, settings.standard_monthly_hours) * 60) / Math.max(1, settings.standard_monthly_days)),
  )
  const employeePayrollCalendar = resolveEmployeePayrollCalendar({
    department: employee?.department,
    payrollType,
    companyWeeklyRestDays: attendanceSettings.weekly_rest_days,
    companyStandardDailyMinutes,
  })
  const fallbackPeriodBasis = payrollFallbackPeriodBasis({
    periodStart,
    periodEnd,
    standardMonthlyDays: settings.standard_monthly_days,
    standardMonthlyHours: settings.standard_monthly_hours,
    weeklyRestDays: employeePayrollCalendar.weeklyRestDays,
    standardDailyMinutes: employeePayrollCalendar.standardDailyMinutes,
  })
  const standardDailyHours = fallbackPeriodBasis.standardDailyMinutes / 60
  const paidLeaveDays = paidLeaveHours / standardDailyHours
  const annualEntitlement = Math.max(0, Number(employee?.contract_status === 'ended' ? 0 : settings.annual_leave_days) || 0)
  const leaveBalanceDays = Math.max(0, annualEntitlement - paidLeaveDays)
  const periodStandardDays = Math.max(1, fallbackPeriodBasis.workingDays)
  const periodStandardMinutes = Math.max(1, fallbackPeriodBasis.standardMinutes)
  const payrollBasis = 'working_calendar'
  const payPercentage = employeeSalaryPercentageForPeriod(employee, periodEnd)
  const bonusPercentage = employeeBonusPercentageForPeriod(employee, periodEnd)
  const hourlyRate = (employee?.hourly_rate_vnd || (employee?.base_salary_vnd ? employee.base_salary_vnd / Math.max(1, periodStandardMinutes / 60) : 0)) * payPercentage
  const monthlyBasePay = payrollType !== 'hourly' ? Math.max(0, Number(employee?.base_salary_vnd) || 0) : 0
  const baseWorkedMinutes = regularMinutes > 0 ? regularMinutes : Math.max(0, workedMinutes - overtimeMinutes)
  const salaryPaidDays = Math.min(periodStandardDays, workedDays + paidLeaveDays)
  const rawSalaryPaidDays = workedDays + paidLeaveDays
  const weightedWorkedDays = workedDates.reduce(
    (sum, workDate) => sum + employeeSalaryPercentageForPeriod(employee, workDate),
    0,
  )
  const weightedLeaveDays = employeeLeaves.reduce(
    (sum, leave) => sum + leaveSalaryUnitsInsidePeriod(leave, employee, periodStart, periodEnd, standardDailyHours),
    0,
  )
  const weightedSalaryPaidDays = (weightedWorkedDays + weightedLeaveDays) * Math.min(
    1,
    periodStandardDays / Math.max(1, rawSalaryPaidDays),
  )
  const salaryPaidMinutes = monthlyBasePay > 0
    ? Math.round(weightedSalaryPaidDays * periodStandardMinutes / periodStandardDays)
    : baseWorkedMinutes + Math.round(paidLeaveHours * 60)
  const hourlyBasePay = calculateTimesheetBasePay({
    payrollType,
    monthlyBasePay,
    hourlyRate,
    periodStandardDays,
    salaryPaidDays,
    weightedSalaryPaidDays,
    baseWorkedMinutes,
  })
  const overtimeMultiplier = Math.max(0, Number(settings.normal_overtime_multiplier) || 0)
  const nightMultiplier = Math.max(0, Number(settings.night_overtime_multiplier) || 0)
  const holidayMultiplier = Math.max(0, Number(settings.holiday_overtime_multiplier) || 0)
  const categorizedHolidayMinutes = Math.min(holidayMinutes, overtimeMinutes)
  const categorizedNightMinutes = Math.min(nightMinutes, Math.max(0, overtimeMinutes - categorizedHolidayMinutes))
  const categorizedRegularOvertimeMinutes = Math.max(0, overtimeMinutes - categorizedHolidayMinutes - categorizedNightMinutes)
  const legalNightOvertimeMultiplier = overtimeMultiplier + settings.night_work_bonus_rate / 100 + settings.night_overtime_extra_rate / 100
  const overtimePay = Math.round(
    (categorizedRegularOvertimeMinutes / 60) * hourlyRate * overtimeMultiplier +
    (categorizedNightMinutes / 60) * hourlyRate * (legalNightOvertimeMultiplier || nightMultiplier) +
    (categorizedHolidayMinutes / 60) * hourlyRate * holidayMultiplier
  )
  const lunchAllowance = settings.lunch_allowance_vnd
  const mealDays = new Set(employeeLogs
    .filter((log) => isMealAllowanceEligible(payrollType, approvedAttendanceMinutes(log), employeePayrollCalendar.standardDailyMinutes))
    .map((log) => log.work_date)).size
  const autoLunchAllowance = Math.round(Math.max(0, lunchAllowance) * mealDays)
  const otherAllowances = employeeAdjustments
    .filter((item) => ['allowance', 'lunch_allowance'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const allowances = autoLunchAllowance + otherAllowances
  const recurringBonus = Math.round(Math.max(0, Number(employee?.monthly_bonus_vnd) || 0) * bonusPercentage)
  const bonuses = recurringBonus + employeeAdjustments
    .filter((item) => ['bonus', 'commission'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + Math.round(item.amount_vnd * bonusPercentage), 0)
  const advances = employeeAdjustments
    .filter((item) => ['advance', 'debt', 'debt_repayment'].includes(item.adjustment_type))
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const deductions = employeeAdjustments
    .filter((item) => item.adjustment_type === 'deduction')
    .reduce((sum, item) => sum + item.amount_vnd, 0)
  const basePay = Math.max(0, hourlyBasePay)
  const grossIncome = Math.max(0, basePay + overtimePay + allowances + bonuses)
  const employeeContributionRate = Math.max(0,
    Number(settings.employee_social_insurance_rate) +
    Number(settings.employee_health_insurance_rate) +
    Number(settings.employee_unemployment_insurance_rate),
  )
  const employerContributionRate = Math.max(0,
    Number(settings.employer_social_insurance_rate) +
    Number(settings.employer_health_insurance_rate) +
    Number(settings.employer_unemployment_insurance_rate) +
    Number(settings.employer_trade_union_rate),
  )
  const contributionBase = settings.social_insurance_enabled && employee?.social_insurance_enrolled && normalizeStaffContractStatus(employee?.contract_status) === 'active'
    ? Math.max(0, Number(employee?.social_insurance_salary_vnd) || Number(employee?.base_salary_vnd) || 0)
    : 0
  const calculatedEmployeeContributions = Math.round(contributionBase * employeeContributionRate / 100)
  const employeeContributions = periodReference
    ? Math.max(0, Number(periodReference.employee_insurance_vnd) || 0)
    : calculatedEmployeeContributions
  const employerContributions = Math.round(contributionBase * employerContributionRate / 100)
  const taxBases = calculatePayrollTaxBases({
    grossIncome,
    mealAllowance: autoLunchAllowance,
    overtimePay,
    employeeContributions,
    personalDeduction: settings.personal_deduction_vnd,
    dependentDeduction: Math.max(0, Number(employee?.dependents_count) || 0) * settings.dependent_deduction_vnd,
  })
  const employeePitRate = Math.max(
    0,
    Number(periodReference?.source_payload?.pit_rate_percent) || Number(employee?.pit_withholding_rate) || 0,
  )
  const pitWithheld = !settings.personal_income_tax_enabled
    ? 0
    : employeePitRate > 0
      ? Math.round(taxBases.shortTermWithholdingBase * employeePitRate / 100)
      : calculateProgressivePit(taxBases.progressiveTaxableIncome, settings.pit_brackets)
  const netIncome = Math.max(0, grossIncome - employeeContributions - pitWithheld - deductions - advances)
  const companyCost = Math.max(0, grossIncome + employerContributions)

  return {
    profileId: staffProfileId,
    scheduledMinutes,
    periodStandardMinutes,
    periodStandardDays,
    payrollBasis,
    workedMinutes,
    workedDays,
    mealDays,
    salaryPaidDays,
    regularMinutes,
    salaryPaidMinutes,
    overtimeMinutes,
    nightMinutes,
    holidayMinutes,
    paidLeaveHours,
    paidLeaveDays,
    leaveBalanceDays,
    restWarningCount: countRestPeriodWarnings(employeeShifts, employeeRestPeriodMinutes(employee, settings)),
    hourlyRate,
    basePay,
    overtimePay,
    mealAllowance: autoLunchAllowance,
    otherAllowances,
    allowances,
    bonuses,
    advances,
    deductions,
    contributionBase,
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
    periodStandardMinutes: 0,
    periodStandardDays: 0,
    payrollBasis: 'working_calendar',
    workedMinutes: 0,
    workedDays: 0,
    mealDays: 0,
    salaryPaidDays: 0,
    regularMinutes: 0,
    salaryPaidMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
    holidayMinutes: 0,
    paidLeaveHours: 0,
    paidLeaveDays: 0,
    leaveBalanceDays: 0,
    restWarningCount: 0,
    hourlyRate: 0,
    basePay: 0,
    overtimePay: 0,
    mealAllowance: 0,
    otherAllowances: 0,
    allowances: 0,
    bonuses: 0,
    advances: 0,
    deductions: 0,
    contributionBase: 0,
    employeeContributions: 0,
    employerContributions: 0,
    pitWithheld: 0,
    grossIncome: 0,
    netIncome: 0,
    companyCost: 0,
  }
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
  guestBooking: true,
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
  half_day_enabled: true,
  half_day_min_minutes: 0,
  half_day_max_minutes: 270,
  count_late_early_on_half_day: false,
  late_arrival_enabled: true,
  late_after_minutes: 5,
  early_leave_enabled: true,
  early_leave_before_minutes: 5,
  overtime_before_shift_enabled: false,
  overtime_before_shift_minutes: 10,
  overtime_after_shift_enabled: false,
  overtime_after_shift_minutes: 10,
  single_clock_for_consecutive_shifts: true,
  work_week_start: 1,
  weekly_rest_days: [0],
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
    half_day_enabled: value?.half_day_enabled ?? fallback.half_day_enabled,
    half_day_min_minutes: minutesSetting(value?.half_day_min_minutes, fallback.half_day_min_minutes),
    half_day_max_minutes: minutesSetting(value?.half_day_max_minutes, fallback.half_day_max_minutes),
    count_late_early_on_half_day: value?.count_late_early_on_half_day ?? fallback.count_late_early_on_half_day,
    late_arrival_enabled: value?.late_arrival_enabled ?? fallback.late_arrival_enabled,
    late_after_minutes: minutesSetting(value?.late_after_minutes, fallback.late_after_minutes),
    early_leave_enabled: value?.early_leave_enabled ?? fallback.early_leave_enabled,
    early_leave_before_minutes: minutesSetting(value?.early_leave_before_minutes, fallback.early_leave_before_minutes),
    overtime_before_shift_enabled: value?.overtime_before_shift_enabled ?? fallback.overtime_before_shift_enabled,
    overtime_before_shift_minutes: minutesSetting(value?.overtime_before_shift_minutes, fallback.overtime_before_shift_minutes),
    overtime_after_shift_enabled: value?.overtime_after_shift_enabled ?? fallback.overtime_after_shift_enabled,
    overtime_after_shift_minutes: minutesSetting(value?.overtime_after_shift_minutes, fallback.overtime_after_shift_minutes),
    single_clock_for_consecutive_shifts: value?.single_clock_for_consecutive_shifts ?? fallback.single_clock_for_consecutive_shifts,
    work_week_start: Math.min(6, Math.max(0, Math.round(Number(value?.work_week_start ?? fallback.work_week_start) || 0))),
    weekly_rest_days: Array.isArray(value?.weekly_rest_days)
      ? value.weekly_rest_days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : fallback.weekly_rest_days,
    shift_templates: normalizeStaffShiftTemplates(value?.shift_templates, standardBreakMinutes),
    updated_by: value?.updated_by ?? fallback.updated_by,
    updated_at: value?.updated_at ?? fallback.updated_at,
  }
}

const defaultHrSettings = (): StaffHrSettings => ({
  id: 'default',
  currency: 'VND',
  standard_monthly_days: 26,
  standard_monthly_hours: 169,
  rest_period_minutes: 660,
  normal_overtime_multiplier: 1.5,
  night_overtime_multiplier: 2,
  holiday_overtime_multiplier: 3,
  lunch_allowance_vnd: 35000,
  annual_leave_days: 12,
  employee_contribution_rate: 10.5,
  employer_contribution_rate: 21.5,
  pit_withholding_rate: 10,
  policy_version: 'VN-2026.1',
  effective_from: '2026-01-01',
  policy_status: 'active',
  legal_source_url: 'https://vanban.chinhphu.vn/?classid=1&docid=198540&pageid=27160&typegroupid=3',
  legal_reviewed_on: '2026-08-05',
  personal_deduction_vnd: 15500000,
  dependent_deduction_vnd: 6200000,
  short_term_pit_rate: 10,
  pit_brackets: [
    { up_to: 10000000, rate: 5 },
    { up_to: 30000000, rate: 10 },
    { up_to: 60000000, rate: 20 },
    { up_to: 100000000, rate: 30 },
    { up_to: null, rate: 35 },
  ],
  employee_social_insurance_rate: 8,
  employee_health_insurance_rate: 1.5,
  employee_unemployment_insurance_rate: 1,
  employer_social_insurance_rate: 17.5,
  employer_health_insurance_rate: 3,
  employer_unemployment_insurance_rate: 1,
  employer_trade_union_rate: 2,
  night_work_bonus_rate: 30,
  night_overtime_extra_rate: 20,
  leave_accrual_days_per_month: 1,
  leave_qualifying_worked_days: 16,
  leave_join_cutoff_day: 15,
  leave_exit_cutoff_day: 17,
  leave_carry_forward_month: 3,
  leave_carry_forward_day: 31,
  pay_period_start_day: 1,
  auto_create_payroll_runs: false,
  auto_update_payroll_daily: false,
  personal_income_tax_enabled: true,
  social_insurance_enabled: true,
  last_auto_payroll_sync_on: null,
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
    policy_version: String(value?.policy_version || fallback.policy_version),
    effective_from: String(value?.effective_from || fallback.effective_from),
    policy_status: ['draft', 'active', 'retired'].includes(String(value?.policy_status)) ? value?.policy_status as StaffHrSettings['policy_status'] : fallback.policy_status,
    legal_source_url: value?.legal_source_url ?? fallback.legal_source_url,
    legal_reviewed_on: value?.legal_reviewed_on ?? fallback.legal_reviewed_on,
    personal_deduction_vnd: Math.max(0, Number(value?.personal_deduction_vnd ?? fallback.personal_deduction_vnd) || 0),
    dependent_deduction_vnd: Math.max(0, Number(value?.dependent_deduction_vnd ?? fallback.dependent_deduction_vnd) || 0),
    short_term_pit_rate: Math.max(0, Number(value?.short_term_pit_rate ?? fallback.short_term_pit_rate) || 0),
    pit_brackets: Array.isArray(value?.pit_brackets) && value.pit_brackets.length > 0
      ? value.pit_brackets.map((bracket) => ({ up_to: bracket.up_to == null ? null : Math.max(0, Number(bracket.up_to) || 0), rate: Math.max(0, Number(bracket.rate) || 0) }))
      : fallback.pit_brackets,
    employee_social_insurance_rate: Math.max(0, Number(value?.employee_social_insurance_rate ?? fallback.employee_social_insurance_rate) || 0),
    employee_health_insurance_rate: Math.max(0, Number(value?.employee_health_insurance_rate ?? fallback.employee_health_insurance_rate) || 0),
    employee_unemployment_insurance_rate: Math.max(0, Number(value?.employee_unemployment_insurance_rate ?? fallback.employee_unemployment_insurance_rate) || 0),
    employer_social_insurance_rate: Math.max(0, Number(value?.employer_social_insurance_rate ?? fallback.employer_social_insurance_rate) || 0),
    employer_health_insurance_rate: Math.max(0, Number(value?.employer_health_insurance_rate ?? fallback.employer_health_insurance_rate) || 0),
    employer_unemployment_insurance_rate: Math.max(0, Number(value?.employer_unemployment_insurance_rate ?? fallback.employer_unemployment_insurance_rate) || 0),
    employer_trade_union_rate: Math.max(0, Number(value?.employer_trade_union_rate ?? fallback.employer_trade_union_rate) || 0),
    night_work_bonus_rate: Math.max(0, Number(value?.night_work_bonus_rate ?? fallback.night_work_bonus_rate) || 0),
    night_overtime_extra_rate: Math.max(0, Number(value?.night_overtime_extra_rate ?? fallback.night_overtime_extra_rate) || 0),
    leave_accrual_days_per_month: Math.max(0, Number(value?.leave_accrual_days_per_month ?? fallback.leave_accrual_days_per_month) || 0),
    leave_qualifying_worked_days: Math.max(0, Math.round(Number(value?.leave_qualifying_worked_days ?? fallback.leave_qualifying_worked_days) || 0)),
    leave_join_cutoff_day: Math.min(31, Math.max(1, Math.round(Number(value?.leave_join_cutoff_day ?? fallback.leave_join_cutoff_day) || 1))),
    leave_exit_cutoff_day: Math.min(31, Math.max(1, Math.round(Number(value?.leave_exit_cutoff_day ?? fallback.leave_exit_cutoff_day) || 1))),
    leave_carry_forward_month: Math.min(12, Math.max(1, Math.round(Number(value?.leave_carry_forward_month ?? fallback.leave_carry_forward_month) || 1))),
    leave_carry_forward_day: Math.min(31, Math.max(1, Math.round(Number(value?.leave_carry_forward_day ?? fallback.leave_carry_forward_day) || 1))),
    pay_period_start_day: Math.min(28, Math.max(1, Math.round(Number(value?.pay_period_start_day ?? fallback.pay_period_start_day) || 1))),
    auto_create_payroll_runs: value?.auto_create_payroll_runs ?? fallback.auto_create_payroll_runs,
    auto_update_payroll_daily: value?.auto_update_payroll_daily ?? fallback.auto_update_payroll_daily,
    personal_income_tax_enabled: value?.personal_income_tax_enabled ?? fallback.personal_income_tax_enabled,
    social_insurance_enabled: value?.social_insurance_enabled ?? fallback.social_insurance_enabled,
    last_auto_payroll_sync_on: value?.last_auto_payroll_sync_on ?? fallback.last_auto_payroll_sync_on,
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
  probation_payroll_type: 'hourly' as 'hourly' | 'monthly' | 'manager',
  labor_payroll_type: 'hourly' as 'hourly' | 'monthly' | 'manager',
  probation_salary_percentage: '85',
  probation_bonus_percentage: '100',
  probation_start_date: '',
  probation_end_date: '',
  labor_start_date: '',
  labor_end_date: '',
  start_date: '',
  end_date: '',
  base_salary_vnd: '',
  hourly_rate_vnd: '',
  monthly_bonus_vnd: '',
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
  social_insurance_enrolled: false,
  social_insurance_salary_vnd: '',
  emergency_contact: '',
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_phone: '',
  google_drive_folder_url: '',
  payroll_note: '',
  profile_photo_path: '',
  cv_document_path: '',
  active: true,
  kiosk_access_role: '' as '' | 'manager' | 'staff',
  kiosk_pin_configured_at: '',
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
  payroll_template: '',
  allowance: '',
  deduction: '',
})

const paymentMethods = ['cash', 'bank_transfer'] as const
const orderStatuses = ['draft', 'confirmed', 'paid', 'partially_paid', 'cancelled', 'refunded', 'no_show', 'completed'] as const
const gameTypes = ['shooting', 'escape', 'tournament', 'other'] as const
const dayTypes = ['weekday', 'weekend', 'holiday', 'custom'] as const
const discountTypes = ['percentage', 'fixed_amount', 'free_ticket', 'birthday', 'resident', 'group'] as const
const loyaltyCalculationTypes = ['per_vnd_spent', 'per_booking', 'per_player', 'per_visit'] as const
const staffCommerceTabs: StaffCommerceTab[] = ['discounts', 'vouchers', 'loyalty']
const staffAttendanceTabs: StaffAttendanceTab[] = ['schedule', 'clock', 'timesheet', 'leave', 'settings']
const staffHrTabs: StaffHrTab[] = ['employees', 'schedule', 'timesheet', 'payroll', 'adjustments', 'advances', 'zalo', 'settings']
const staffShiftStatuses: StaffShiftStatus[] = ['draft', 'published', 'completed', 'cancelled']
const staffAttendanceStatuses: StaffAttendanceStatus[] = ['present', 'late', 'absent', 'no_show', 'leave', 'holiday']
const staffLeaveTypes: StaffLeaveType[] = ['annual', 'sick', 'unpaid', 'personal', 'public_holiday']
const staffEmploymentTypes: StaffEmploymentType[] = ['full_time', 'part_time', 'probation_full_time', 'probation_part_time', 'contractor', 'intern']
const staffGenderOptions: StaffGender[] = ['female', 'male', 'non_binary', 'prefer_not_to_say', 'other']
const staffContractStatuses: StaffContractStatus[] = ['active', 'probation', 'suspended', 'ended', 'draft']
const staffHrSetupOptionTypes: StaffHrSetupOptionType[] = ['location', 'department', 'job_title', 'contract_status', 'contract_type', 'employment_type', 'payroll_template', 'allowance', 'deduction']
const staffHrAdjustmentTypes: StaffHrAdjustmentType[] = ['bonus', 'commission', 'allowance', 'lunch_allowance', 'deduction', 'advance', 'debt', 'debt_repayment']
const staffHrAdjustmentStatuses: StaffHrAdjustmentStatus[] = ['draft', 'pending', 'approved', 'rejected', 'paid', 'cancelled']
const staffPayrollStatuses: StaffPayrollStatus[] = ['draft', 'pending', 'approved', 'paid', 'cancelled']
const staffPayrollPayCycles: StaffPayrollPayCycle[] = ['monthly', 'semi_monthly', 'weekly', 'custom']
const assignableWebAppRoleOptions: StaffRole[] = ['owner', 'admin', 'cashier', 'viewer', 'player']
const roleFilterOptions: Array<StaffRole | 'all'> = ['all', 'owner', 'admin', 'cashier', 'viewer', 'employee', 'player']
const roleSortOptions: StaffRoleSort[] = ['name_asc', 'name_desc', 'created_desc', 'role_desc', 'role_asc', 'email_asc']
const staffProfileSelect = 'id, created_at, full_name, nickname, email, phone, role, loyalty_points_total, average_accuracy_override, best_escape_duration_seconds_override, total_projectiles_override, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, anonymous_mode, anonymous_callsign, birthday, is_seed_demo, seed_batch'
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
  if (normalizedRole === 'employee' || normalizedRole === 'manager' || normalizedRole === 'staff') return 'employee'
  const rank = staffRank(role, email)
  if (rank >= 120) return 'owner'
  if (rank >= 100) return 'admin'
  if (normalizedRole === 'cashier') return 'cashier'
  if (rank >= 20) return 'viewer'
  return 'player'
}

function storedRoleValue(role?: string | null, email?: string | null): StaffRole {
  const normalized = (role || '').toLowerCase()
  if (isOwnerEmail(email)) return 'owner'
  if (isAdminOnlyEmail(email) && (normalized === 'super_admin' || normalized === 'owner')) return 'admin'
  if (normalized === 'super_admin') return 'owner'
  if (normalized === 'manager' || normalized === 'staff') return 'employee'
  if (normalized === 'employee') return 'employee'
  return assignableWebAppRoleOptions.includes(normalized as StaffRole) ? normalized as StaffRole : 'player'
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

function staffOrderEditDraft(order: StaffOrder): StaffOrderEditDraft {
  return {
    orderId: order.id,
    gameId: order.game_id || '',
    bookingDate: order.booking_date,
    bookingTime: normalizeTime(order.booking_time),
    total: String(order.total),
  }
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

function orderChanges(order: StaffOrder, patch: Partial<StaffOrder>, games: StaffGame[] = []) {
  const gameName = (gameId: string | null | undefined) => (
    games.find((game) => game.id === gameId)?.name || gameId || ''
  )
  const rows: Array<[string, unknown, unknown]> = [
    ['Payment status', order.payment_status, patch.payment_status],
    ['Order status', order.order_status, patch.order_status],
    ['Total', order.total, patch.total],
    ['Game', gameName(order.game_id), patch.game_id === undefined ? undefined : gameName(patch.game_id)],
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

function staffProfileFromEmployee(employee: StaffEmployeeProfile, profilePhotoUrl = ''): StaffProfile {
  const fullName = employee.legal_name?.trim() || employee.employee_code?.trim() || 'Employee'
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return {
    id: employee.profile_id,
    created_at: employee.created_at,
    full_name: fullName,
    email: employee.personal_email,
    phone: employee.personal_phone,
    avatar_url: profilePhotoUrl || null,
    avatar_initials: initials || 'E',
    avatar_color: employee.kiosk_access_role === 'manager' ? vrenaPalette.purple[100] : vrenaPalette.cyan[50],
    avatar_text_color: employee.kiosk_access_role === 'manager' ? vrenaPalette.purple[700] : vrenaPalette.cyan[800],
    role: employee.kiosk_access_role === 'manager' ? 'manager' : 'staff',
  }
}

function deletedRecordActorLabel(record: SoftDeletedRecord) {
  const name = record.deleted_by_name?.trim() || ''
  const contact = record.deleted_by_email?.trim() || record.deleted_by_phone?.trim() || ''
  if (name && contact && name !== contact) return `${name} · ${contact}`
  return name || contact || record.deleted_by || ''
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
  return normalizedSource.startsWith('blob:') || normalizedSource.startsWith('data:') || normalizedSource.includes('/storage/v1/object/sign/') || /\.gif($|\?)/.test(normalizedSource)
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

async function downloadExcel(filename: string, sections: Array<{ title: string; rows: Array<Record<string, unknown>>; description?: string }>, text: StaffConsoleCopy = staffConsoleText.en) {
  const { downloadExcelFile } = await import('../lib/staffDownloadFiles')
  downloadExcelFile(filename, sections, text.noData)
}

function accountantFormula(formula: string, result: string | number = '', numberFormat?: 'currency' | 'decimal' | 'integer' | 'percent') {
  return { __xlsxFormula: true, formula: formula.replace(/^=/, ''), result, numberFormat }
}

function excelColumnName(index: number) {
  let column = ''
  let value = index
  while (value > 0) {
    const remainder = (value - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    value = Math.floor((value - 1) / 26)
  }
  return column
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

function orderPaymentLabel(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>, text: StaffConsoleCopy = staffConsoleText.en) {
  const payments = staffOrderPaymentRows(order, paymentsByOrderId)
  if (payments.length === 0) return paymentMethodLabel(order.payment_method, text)
  return payments
    .map((payment) => `${paymentMethodLabel(payment.payment_method, text)} ${formatVnd(payment.amount)}`)
    .join(' + ')
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

function paymentPieItems(report: StaffReportSummary, text: StaffConsoleCopy = staffConsoleText.en) {
  return [
    { label: text.labels.cash, value: report.cashTotal },
    { label: text.labels.bankTransfer, value: report.bankTransferTotal },
    { label: text.unpaid, value: report.unpaidAmount },
  ]
}

function rpcFunctionMissing(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() || ''
  return error?.code === '42883'
    || error?.code === 'PGRST202'
    || message.includes('could not find the function')
    || (message.includes('function') && message.includes('does not exist'))
}

export default function StaffConsole({ profile, authEmail, language, mode = 'staff', kioskOperator, onKioskLock, onOpenPlayerProfile, onOpenSessionCalendar }: StaffConsoleProps) {
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
  const [costAssignments, setCostAssignments] = useState<StaffCostAssignment[]>([])
  const [employeeProfiles, setEmployeeProfiles] = useState<StaffEmployeeProfile[]>([])
  const [employeePhotoUrls, setEmployeePhotoUrls] = useState<Record<string, string>>({})
  const [attendanceSettings, setAttendanceSettings] = useState<StaffAttendanceSettings>(() => defaultAttendanceSettings())
  const [hrSettings, setHrSettings] = useState<StaffHrSettings>(() => defaultHrSettings())
  const [hrSetupOptions, setHrSetupOptions] = useState<StaffHrSetupOption[]>([])
  const [hrAdjustments, setHrAdjustments] = useState<StaffHrAdjustment[]>([])
  const [payrollRuns, setPayrollRuns] = useState<StaffPayrollRun[]>([])
  const [payrollItems, setPayrollItems] = useState<StaffPayrollItem[]>([])
  const [payrollSourceSnapshots, setPayrollSourceSnapshots] = useState<StaffPayrollSourceSnapshot[]>([])
  const [hrDocuments, setHrDocuments] = useState<StaffHrDocument[]>([])
  const [selectedShiftTemplate, setSelectedShiftTemplate] = useState<StaffShiftTemplateId>('opening')
  const [attendanceScheduleScope, setAttendanceScheduleScope] = useState<StaffScheduleScope>(() => canViewAllEmployeeProfiles ? 'all' : 'department')
  const [draggingShiftId, setDraggingShiftId] = useState('')
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [orderPayments, setOrderPayments] = useState<StaffOrderPayment[]>([])
  const [orderEditDraft, setOrderEditDraft] = useState<StaffOrderEditDraft | null>(null)
  const [orderEditError, setOrderEditError] = useState('')
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
  const [customerTemporaryAccess, setCustomerTemporaryAccess] = useState<CustomerTemporaryAccess | null>(null)
  const [isCustomerInviteSaving, setIsCustomerInviteSaving] = useState(false)
  const [clientProfileDirty, setClientProfileDirty] = useState(false)
  const [gameForm, setGameForm] = useState(() => defaultGameForm())
  const [priceForm, setPriceForm] = useState(() => defaultPriceForm())
  const [discountForm, setDiscountForm] = useState(() => defaultDiscountForm())
  const [loyaltyForm, setLoyaltyForm] = useState(() => defaultLoyaltyForm())
  const [shiftForm, setShiftForm] = useState(() => defaultShiftForm())
  const [attendanceLogForm, setAttendanceLogForm] = useState(() => defaultAttendanceLogForm())
  const [leaveForm, setLeaveForm] = useState(() => defaultLeaveForm())
  const [employeeForm, setEmployeeForm] = useState(() => defaultEmployeeForm())
  const [employeeKioskPin, setEmployeeKioskPin] = useState('')
  const [employeeKioskPinConfirm, setEmployeeKioskPinConfirm] = useState('')
  const [employeeKioskAccessRole, setEmployeeKioskAccessRole] = useState<'manager' | 'staff'>('staff')
  const [employeeKioskPinSaveConfirmation, setEmployeeKioskPinSaveConfirmation] = useState<'' | 'created' | 'replaced'>('')
  const [employeeKioskPinVisibleValue, setEmployeeKioskPinVisibleValue] = useState('')
  const [employeeKioskPinLoading, setEmployeeKioskPinLoading] = useState(false)
  const [employeeKioskPinEmailState, setEmployeeKioskPinEmailState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [employeeKioskPinEmailRecipient, setEmployeeKioskPinEmailRecipient] = useState('')
  const employeeKioskPinProfileRef = useRef('')
  const employeeKioskPinConfirmationTimerRef = useRef<number | null>(null)
  const employeeKioskPinEmailTimerRef = useRef<number | null>(null)
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

  useEffect(() => () => {
    if (employeeKioskPinConfirmationTimerRef.current !== null) {
      window.clearTimeout(employeeKioskPinConfirmationTimerRef.current)
    }
    if (employeeKioskPinEmailTimerRef.current !== null) {
      window.clearTimeout(employeeKioskPinEmailTimerRef.current)
    }
  }, [])
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareStart, setCompareStart] = useState(() => addDays(todayString(), -1))
  const [compareEnd, setCompareEnd] = useState(() => addDays(todayString(), -1))
  const [reportDatePickerOpen, setReportDatePickerOpen] = useState(false)
  const [reportDatePickerTarget, setReportDatePickerTarget] = useState<'report' | 'compare'>('report')
  const [reportChartMode, setReportChartMode] = useState<StaffReportChartMode>('columns')
  const [reportView, setReportView] = useState<StaffReportView>('business')
  const [accountantExportOpen, setAccountantExportOpen] = useState(false)
  const [accountantExportFormat, setAccountantExportFormat] = useState<AccountantExportFormat>('excel')
  const [accountantExportLanguage, setAccountantExportLanguage] = useState<StaffConsoleLanguage>(() => resolveStaffConsoleLanguage(language))
  const [accountantExportStore, setAccountantExportStore] = useState(accountantExportStores[0].id)
  const [accountantIncludeAttachments, setAccountantIncludeAttachments] = useState(false)
  const [accountantReportId, setAccountantReportId] = useState<AccountantExportReportId>('sales_revenue')
  const [reportExporting, setReportExporting] = useState<'excel' | 'pdf' | 'accountant' | null>(null)
  const [reportExportFeedback, setReportExportFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
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
  const [playerInsightsSnapshot, setPlayerInsightsSnapshot] = useState<StaffPlayerInsightsSnapshot | null>(null)
  const [qrAnalyticsSnapshot, setQrAnalyticsSnapshot] = useState<StaffQrAnalyticsSnapshot | null>(null)
  const [qrAnalyticsError, setQrAnalyticsError] = useState('')
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
  const selectedGame = useMemo(() => activeGames.find((game) => game.id === booking.gameId) || activeGames[0] || null, [activeGames, booking.gameId])
  const selectedRule = useMemo(() => {
    if (!selectedGame) return null
    return selectPricingRule(prices, selectedGame.id, booking.date, booking.time)
  }, [booking.date, booking.time, prices, selectedGame])
  const bookingUnitPrice = selectedRule?.price_per_player || 220000
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
                          : reportView === 'qr'
                            ? loadingData.qrReport
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
    if (reportView === 'qr') {
      void loadQrAnalytics(true)
      return
    }
    void Promise.all([loadGames(), loadReportData(true)])
    // Report data is intentionally refreshed only by visible range/filter state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, reportView, reportStart, reportEnd, compareEnabled, compareStart, compareEnd])

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
        const profileIds = rows.map((item) => item.id).filter(Boolean)
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
      const actorResult = await supabase.rpc('get_soft_deleted_records_v2', { p_limit: 100 })
      if (!actorResult.error) {
        setDeletedRecords((actorResult.data ?? []) as SoftDeletedRecord[])
        return
      }
      if (!rpcFunctionMissing(actorResult.error)) throw new Error(actorResult.error.message)

      const fallbackResult = await supabase.rpc('get_soft_deleted_records', { p_limit: 100 })
      if (fallbackResult.error) throw new Error(fallbackResult.error.message)
      setDeletedRecords((fallbackResult.data ?? []) as SoftDeletedRecord[])
    }, force)
  }

  async function loadOrdersForRange(key: 'today' | 'orders', start: string, end: string, force = false) {
    const [from, to] = orderedRange(start, end)
    await runStaffLoader(key, async () => {
      const pageSize = key === 'today' ? 120 : 250
      const rows: StaffOrder[] = []
      const payments: StaffOrderPayment[] = []
      let useFallback = false
      for (let offset = 0; ; offset += pageSize) {
        const rpcResult = await supabase.rpc('staff_orders_page', {
          p_start_date: from, p_end_date: to, p_limit: pageSize,
          p_offset: offset, p_search: null, p_status: null,
        })
        if (rpcResult.error || !rpcResult.data) {
          if (rpcResult.error && !rpcFunctionMissing(rpcResult.error)) throw new Error(rpcResult.error.message)
          useFallback = true
          break
        }
        const page = staffOrdersPageFromRpc(rpcResult.data)
        rows.push(...page.orders)
        payments.push(...page.payments)
        if (key !== 'today' || page.orders.length < pageSize) break
      }
      if (useFallback) {
        rows.length = 0
        payments.length = 0
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase.from('staff_orders').select('*')
            .gte('booking_date', from).lte('booking_date', to)
            .order('booking_date', { ascending: false }).order('booking_time', { ascending: false })
            .order('id', { ascending: true }).range(offset, offset + pageSize - 1)
          if (error) throw new Error(error.message)
          const page = (data ?? []) as StaffOrder[]
          rows.push(...page)
          payments.push(...await fetchOrderPayments(page))
          if (key !== 'today' || page.length < pageSize) break
        }
      }
      // Refresh the whole date range, including removal of deleted orders.
      setOrders((current) => key === 'orders' ? rows : [
        ...current.filter((order) => order.booking_date < from || order.booking_date > to), ...rows,
      ])
      setOrderPayments((current) => key === 'orders'
        ? payments : mergeOrderPayments(current, rows.map((order) => order.id), payments))
    }, force)
  }

  async function loadTodayOrders(force = false) {
    if (operationSessionScope !== 'today') return
    await loadOrdersForRange('today', operationsDate, operationsDate, force)
  }

  async function loadTodaySessions(force = false) {
    await runStaffLoader('todaySessions', async () => {
      const today = todayString()
      let query = supabase
        .from('sessions')
        .select('id, venue_key, owner_id, name, date, start_time, duration_minutes, max_players, arena_count, game_options, confirmed_game_id, visibility, status, booking_type, ticket_type, ticket_player_count, ticket_total_price, ticket_status, ticket_reference, notes, session_participants(id, profile_id, display_name, deleted_at, checked_in, payment_status, payment_amount, payment_splits, score, accuracy_percent, hits, movement_meters, projectiles_fired, escape_duration_seconds, placement, chapter_times:session_participant_chapter_times(chapter_number, duration_seconds, game_slug))')
        .is('deleted_at', null)

      query = operationSessionScope === 'past'
        ? query.lt('date', today).order('date', { ascending: false }).order('start_time', { ascending: false }).limit(80)
        : query.eq('date', operationsDate).order('start_time', { ascending: true })

      const { data, error } = await query
      if (error) throw new Error(error.message)
      const sessions = (data ?? []).map((session) => ({
        ...session,
        session_participants: (session.session_participants ?? []).filter((participant) => !participant.deleted_at),
      })) as StaffOperationSession[]
      // Past sessions must load their own orders; today's ledger cannot explain them.
      if (operationSessionScope === 'past' && sessions.length > 0) {
        const { data: linkedOrders, error: ordersError } = await supabase.from('staff_orders')
          .select('*').in('session_id', sessions.map((session) => session.id))
        if (ordersError) throw new Error(ordersError.message)
        const rows = (linkedOrders ?? []) as StaffOrder[]
        const payments = await fetchOrderPayments(rows)
        setOrders(rows)
        setOrderPayments(payments)
      }
      setOperationSessions(sessions)
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
              ...(getStaffKioskOperatorToken() ? { [STAFF_KIOSK_HEADER]: getStaffKioskOperatorToken() } : {}),
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
    const { error } = await supabase.rpc('staff_upsert_session_participant_result_v2', {
      p_session_id: session.id,
      p_participant_id: participant.id,
      p_profile_id: participant.profile_id,
      p_display_name: participant.display_name ?? null,
      p_checked_in: patch.checked_in ?? participant.checked_in ?? false,
      p_payment_status: patchValue('payment_status'),
      p_payment_amount: patchValue('payment_amount'),
      p_score: patchValue('score'),
      p_accuracy_percent: patchValue('accuracy_percent'),
      p_hits: patchValue('hits'),
      p_movement_meters: patchValue('movement_meters'),
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
    const { error } = await supabase.rpc('staff_upsert_session_participant_result_v2', {
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
      const employeeRequest = canViewAllEmployeeProfiles
        ? supabase
          .from('staff_employee_profiles')
          .select('*')
          .is('deleted_at', null)
          .order('legal_name', { ascending: true })
        : supabase.rpc('staff_employee_directory')
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
        employeeRequest,
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
      const nextEmployeeProfiles = employeeUnavailable ? [] : (employeeResult.data ?? []) as StaffEmployeeProfile[]
      setEmployeeProfiles(nextEmployeeProfiles)
      const employeePhotoEntries = await Promise.all(
        nextEmployeeProfiles
          .filter((employee) => Boolean(employee.profile_photo_path))
          .map(async (employee) => {
            const { data, error } = await supabase.storage
              .from(staffHrDocumentBucket)
              .createSignedUrl(employee.profile_photo_path as string, 60 * 60)
            return [employee.profile_id, error ? '' : data?.signedUrl || ''] as const
          })
      )
      setEmployeePhotoUrls(Object.fromEntries(employeePhotoEntries.filter((entry) => Boolean(entry[1]))))

      if (nextEmployeeProfiles.length > 0 && !nextEmployeeProfiles.some((employee) => employee.profile_id === employeeForm.profile_id)) {
        const employee = nextEmployeeProfiles[0]
        const staffProfile = staffProfileFromEmployee(employee)
        setEmployeeForm(employeeFormForProfile(staffProfile, employee))
        setEmployeeKioskPin('')
        setEmployeeKioskPinConfirm('')
        setEmployeeKioskPinSaveConfirmation('')
        setEmployeeKioskPinVisibleValue('')
        setEmployeeKioskPinEmailState('idle')
        setEmployeeKioskPinEmailRecipient('')
        setEmployeeKioskAccessRole(employee.kiosk_access_role === 'manager' ? 'manager' : 'staff')
        employeeKioskPinProfileRef.current = employee.profile_id
        if (canRevealEmployeeKioskPin && isStaffKioskEligibleDepartment(employee.department)) {
          void revealEmployeeKioskPin(employee.profile_id)
        }
      }
    }, force)
  }

  async function loadHrData(force = false) {
    await runStaffLoader('hr', async () => {
      if (!canAccessHrSettings) {
        setHrSettings(defaultHrSettings())
        setHrSetupOptions([])
        setHrAdjustments([])
        setPayrollRuns([])
        setPayrollItems([])
        setPayrollSourceSnapshots([])
        setHrDocuments([])
        setCostAssignments([])
        return
      }
      const [settingsResult, optionsResult, adjustmentsResult, payrollRunsResult, payrollItemsResult, sourceSnapshotsResult, documentsResult, costAssignmentsResult] = await Promise.all([
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
          .from('staff_payroll_source_snapshots')
          .select('*')
          .order('period_start', { ascending: false })
          .order('employee_code', { ascending: true })
          .limit(500),
        supabase
          .from('staff_hr_documents')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('staff_cost_assignments').select('*').is('cancelled_at', null).order('start_date', { ascending: false }),
      ])

      const coreResults = [settingsResult, optionsResult, adjustmentsResult, payrollRunsResult, payrollItemsResult, documentsResult, costAssignmentsResult]
      const blockingError = coreResults.find((result) => result.error && !isStaffHrSchemaUnavailable(result.error))?.error
        ?? (sourceSnapshotsResult.error && !isStaffHrSchemaUnavailable(sourceSnapshotsResult.error) && !isStaffHrPermissionDenied(sourceSnapshotsResult.error)
          ? sourceSnapshotsResult.error
          : null)
      if (blockingError) throw new Error(blockingError.message)

      const hrUnavailable = coreResults.some((result) => result.error && isStaffHrSchemaUnavailable(result.error))
      if (hrUnavailable) {
        setHrSettings(defaultHrSettings())
        setHrSetupOptions([])
        setHrAdjustments([])
        setPayrollRuns([])
        setPayrollItems([])
        setPayrollSourceSnapshots([])
        setHrDocuments([])
        setCostAssignments([])
        return
      }

      setHrSettings(normalizeHrSettings(settingsResult.data as Partial<StaffHrSettings> | null))
      setHrSetupOptions((optionsResult.data ?? []) as StaffHrSetupOption[])
      setHrAdjustments((adjustmentsResult.data ?? []) as StaffHrAdjustment[])
      setPayrollRuns((payrollRunsResult.data ?? []) as StaffPayrollRun[])
      setPayrollItems((payrollItemsResult.data ?? []) as StaffPayrollItem[])
      setPayrollSourceSnapshots(sourceSnapshotsResult.error ? [] : (sourceSnapshotsResult.data ?? []) as StaffPayrollSourceSnapshot[])
      setHrDocuments((documentsResult.data ?? []) as StaffHrDocument[])
      setCostAssignments((costAssignmentsResult.data ?? []) as StaffCostAssignment[])
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
      const playerInsightsPromise = supabase.rpc('staff_player_behavior_report', {
        p_start_date: reportStart,
        p_end_date: reportEnd,
        p_compare_start: compareEnabled ? compareStart : null,
        p_compare_end: compareEnabled ? compareEnd : null,
        p_player_limit: 16,
      })
      const productAnalyticsPromise = supabase.rpc('staff_product_analytics_report', {
        p_start_date: reportStart,
        p_end_date: reportEnd,
        p_compare_start: compareEnabled ? compareStart : null,
        p_compare_end: compareEnabled ? compareEnd : null,
      })
      const updatePlayerInsights = async () => {
        const [playerResult, productResult] = await Promise.all([playerInsightsPromise, productAnalyticsPromise])
        if (!playerResult.error) {
          setPlayerInsightsSnapshot({
            ...(playerResult.data as StaffPlayerInsightsSnapshot),
            productAnalytics: productResult.error ? null : productResult.data,
          } as StaffPlayerInsightsSnapshot)
        } else if (!rpcFunctionMissing(playerResult.error)) {
          setPlayerInsightsSnapshot(null)
        }
      }
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
        await updatePlayerInsights()
        return
      }

      if (!rpcFunctionMissing(error)) {
        await Promise.all([loadReportFallback(), updatePlayerInsights()])
        return
      }

      const legacyResult = await supabase.rpc('get_staff_daily_report', reportArgs)
      if (legacyResult.error) {
        await Promise.all([loadReportFallback(), updatePlayerInsights()])
        return
      }
      const snapshot = await withComparisonOrders(staffReportSnapshotFromRpc(legacyResult.data, text))
      setReportSnapshot(snapshot)
      await updatePlayerInsights()
    }, force)
  }

  async function loadQrAnalytics(force = false) {
    await runStaffLoader('qrReport', async () => {
      setQrAnalyticsError('')
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')

        const params = new URLSearchParams({ start: reportStart, end: reportEnd })
        if (compareEnabled) {
          params.set('compareStart', compareStart)
          params.set('compareEnd', compareEnd)
        }
        const operatorToken = getStaffKioskOperatorToken()
        const response = await fetch(`/api/staff/reports/qr-analytics?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            authorization: `Bearer ${accessToken}`,
            ...(operatorToken ? { [STAFF_KIOSK_HEADER]: operatorToken } : {}),
          },
        })
        const payload = await response.json().catch(() => ({})) as StaffQrAnalyticsSnapshot & { error?: string }
        if (!response.ok) throw new Error(payload.error || 'Could not load QR analytics.')
        setQrAnalyticsSnapshot(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load QR analytics.'
        setQrAnalyticsSnapshot(null)
        setQrAnalyticsError(message)
        throw error
      }
    }, force)
  }

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

  function applyCustomer(profileId: string) {
    const selected = profiles.find((item) => item.id === profileId)
    setBooking((current) => ({
      ...current,
      guestBooking: false,
      customerId: profileId,
      customerName: selected ? customerName(selected, text) : current.customerName,
      customerPhone: selected?.phone || current.customerPhone,
      customerEmail: selected?.email || current.customerEmail,
    }))
  }

  function setGuestBooking(enabled: boolean) {
    setCustomerNameFocused(false)
    setBooking((current) => ({
      ...current,
      guestBooking: enabled,
      ...(enabled ? {
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
      } : {}),
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
    const guestCustomer = booking.guestBooking
    const hasManualDiscount = calculateManualDiscount(booking.manualDiscountType, booking.manualDiscountValue, quote.subtotal) > 0
    const paymentSplits = normalizePaymentSplits(booking.paymentSplits)
    const { data, error } = await supabase.rpc('create_staff_order_with_payments', {
      p_customer_id: guestCustomer ? null : booking.customerId || null,
      p_customer_name: guestCustomer ? null : booking.customerName || null,
      p_customer_phone: guestCustomer ? null : booking.customerPhone || null,
      p_customer_email: guestCustomer ? null : booking.customerEmail || null,
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
      probation_payroll_type: normalizeEmployeePayrollType(employee?.probation_payroll_type),
      labor_payroll_type: normalizeEmployeePayrollType(employee?.labor_payroll_type),
      probation_salary_percentage: String(employee?.probation_salary_percentage || 85),
      probation_bonus_percentage: String(employee?.probation_bonus_percentage || 100),
      probation_start_date: employee?.probation_start_date || '',
      probation_end_date: employee?.probation_end_date || '',
      labor_start_date: employee?.labor_start_date || employee?.contract_start_date || '',
      labor_end_date: employee?.labor_end_date || employee?.contract_end_date || '',
      start_date: employee?.start_date || '',
      end_date: employee?.end_date || '',
      base_salary_vnd: employee?.base_salary_vnd ? String(employee.base_salary_vnd) : '',
      hourly_rate_vnd: employee?.hourly_rate_vnd ? String(employee.hourly_rate_vnd) : '',
      monthly_bonus_vnd: employee?.monthly_bonus_vnd ? String(employee.monthly_bonus_vnd) : '',
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
      social_insurance_enrolled: employee?.social_insurance_enrolled ?? false,
      social_insurance_salary_vnd: employee?.social_insurance_salary_vnd ? String(employee.social_insurance_salary_vnd) : '',
      emergency_contact: employee?.emergency_contact || '',
      emergency_contact_name: employee?.emergency_contact_name || employee?.emergency_contact || '',
      emergency_contact_relationship: employee?.emergency_contact_relationship || '',
      emergency_contact_phone: employee?.emergency_contact_phone || '',
      google_drive_folder_url: employee?.google_drive_folder_url || '',
      payroll_note: employee?.payroll_note || '',
      profile_photo_path: employee?.profile_photo_path || '',
      cv_document_path: employee?.cv_document_path || '',
      active: employee?.active ?? true,
      kiosk_access_role: employee?.kiosk_access_role === 'manager'
        ? 'manager' as const
        : employee?.kiosk_access_role === 'staff' ? 'staff' as const : '' as const,
      kiosk_pin_configured_at: employee?.kiosk_pin_configured_at || '',
    }
  }

  function editEmployeeProfile(staffProfile: StaffProfile) {
    const employee = employeeProfileById.get(staffProfile.id)
    setEmployeeForm(employeeFormForProfile(staffProfile, employee))
    setEmployeeKioskPin('')
    setEmployeeKioskPinConfirm('')
    setEmployeeKioskPinSaveConfirmation('')
    setEmployeeKioskPinVisibleValue('')
    setEmployeeKioskPinEmailState('idle')
    setEmployeeKioskPinEmailRecipient('')
    employeeKioskPinProfileRef.current = staffProfile.id
    if (employeeKioskPinConfirmationTimerRef.current !== null) {
      window.clearTimeout(employeeKioskPinConfirmationTimerRef.current)
      employeeKioskPinConfirmationTimerRef.current = null
    }
    if (employeeKioskPinEmailTimerRef.current !== null) {
      window.clearTimeout(employeeKioskPinEmailTimerRef.current)
      employeeKioskPinEmailTimerRef.current = null
    }
    setEmployeeKioskAccessRole(employee?.kiosk_access_role === 'manager' ? 'manager' : 'staff')
    setHrTab('employees')
    setActiveTab('hr')
    if (canRevealEmployeeKioskPin && isStaffKioskEligibleDepartment(employee?.department)) {
      void revealEmployeeKioskPin(staffProfile.id)
    }
  }

  async function revealEmployeeKioskPin(staffProfileId: string) {
    if (!canRevealEmployeeKioskPin || !staffProfileId) return
    setEmployeeKioskPinLoading(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')
      const response = await fetch(`/api/staff/kiosk/pin?profileId=${encodeURIComponent(staffProfileId)}`, {
        headers: { authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; pin?: string | null }
      if (!response.ok) throw new Error(payload.error || 'Could not load employee PIN.')
      if (employeeKioskPinProfileRef.current === staffProfileId) {
        setEmployeeKioskPinVisibleValue(typeof payload.pin === 'string' ? payload.pin : '')
      }
    } catch (pinError) {
      if (employeeKioskPinProfileRef.current === staffProfileId) {
        setEmployeeKioskPinVisibleValue('')
        setStatus(pinError instanceof Error ? pinError.message : String(pinError))
      }
    } finally {
      if (employeeKioskPinProfileRef.current === staffProfileId) setEmployeeKioskPinLoading(false)
    }
  }

  async function sendEmployeeKioskPinEmail(staffProfileId: string) {
    if (!canRevealEmployeeKioskPin || !staffProfileId || employeeKioskPinEmailState === 'sending') return
    setEmployeeKioskPinEmailState('sending')
    setEmployeeKioskPinEmailRecipient('')
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')
      const response = await fetch('/api/staff/kiosk/pin/email', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ profileId: staffProfileId }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; recipient?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not send employee PIN email.')
      if (employeeKioskPinProfileRef.current !== staffProfileId) return

      const recipient = payload.recipient || ''
      setEmployeeKioskPinEmailRecipient(recipient)
      setEmployeeKioskPinEmailState('sent')
      setStatus(resolvedLanguage === 'vi'
        ? `Đã gửi PIN qua email${recipient ? ` tới ${recipient}` : ''}.`
        : `PIN emailed${recipient ? ` to ${recipient}` : ''}.`)
      if (employeeKioskPinEmailTimerRef.current !== null) {
        window.clearTimeout(employeeKioskPinEmailTimerRef.current)
      }
      employeeKioskPinEmailTimerRef.current = window.setTimeout(() => {
        if (employeeKioskPinProfileRef.current === staffProfileId) setEmployeeKioskPinEmailState('idle')
        employeeKioskPinEmailTimerRef.current = null
      }, 5000)
    } catch (pinEmailError) {
      if (employeeKioskPinProfileRef.current === staffProfileId) {
        setEmployeeKioskPinEmailState('idle')
        setStatus(pinEmailError instanceof Error ? pinEmailError.message : String(pinEmailError))
      }
    }
  }

  async function configureEmployeeKioskPin() {
    if (!canManageEmployeeKioskPins) return
    const staffProfileId = employeeForm.profile_id || firstEmployeeStaffProfileId
    if (!staffProfileId) return
    if (!/^\d{6}$/.test(employeeKioskPin) || employeeKioskPin !== employeeKioskPinConfirm) {
      setStatus(kioskText.mismatch)
      return
    }

    const pinWasConfigured = Boolean(employeeForm.kiosk_pin_configured_at)
    const pinToSave = employeeKioskPin
    setEmployeeKioskPinSaveConfirmation('')
    setEmployeeKioskPinVisibleValue('')
    setEmployeeKioskPinEmailState('idle')
    setEmployeeKioskPinEmailRecipient('')
    setSaving(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')
      const response = await fetch('/api/staff/kiosk/pin', {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          profileId: staffProfileId,
          pin: employeeKioskPin,
          accessRole: employeeKioskAccessRole,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Could not save employee PIN.')
      setEmployeeKioskPin('')
      setEmployeeKioskPinConfirm('')
      setEmployeeForm((current) => current.profile_id === staffProfileId
        ? {
            ...current,
            kiosk_access_role: employeeKioskAccessRole,
            kiosk_pin_configured_at: new Date().toISOString(),
          }
        : current)
      setEmployeeKioskPinSaveConfirmation(pinWasConfigured ? 'replaced' : 'created')
      setEmployeeKioskPinVisibleValue(pinToSave)
      if (employeeKioskPinConfirmationTimerRef.current !== null) {
        window.clearTimeout(employeeKioskPinConfirmationTimerRef.current)
      }
      employeeKioskPinConfirmationTimerRef.current = window.setTimeout(() => {
        setEmployeeKioskPinSaveConfirmation('')
        employeeKioskPinConfirmationTimerRef.current = null
      }, 5000)
      setStatus(resolvedLanguage === 'vi' ? 'Đã lưu PIN nhân viên.' : 'Employee PIN saved.')
      markStaffDataStale('attendance', 'hr')
      await loadAttendanceData(true)
    } catch (pinError) {
      setStatus(pinError instanceof Error ? pinError.message : String(pinError))
    } finally {
      setSaving(false)
    }
  }

  function generateEmployeeKioskPin() {
    const randomValue = new Uint32Array(1)
    const range = 900000
    const unbiasedLimit = Math.floor(0x100000000 / range) * range
    let value = unbiasedLimit

    while (value >= unbiasedLimit) {
      window.crypto.getRandomValues(randomValue)
      value = randomValue[0]
    }

    const pin = String(100000 + (value % range))
    setEmployeeKioskPin(pin)
    setEmployeeKioskPinConfirm(pin)
    setEmployeeKioskPinSaveConfirmation('')
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
      main_work_location: employeeHomeLocation(employeeForm.department) || employeeForm.main_work_location.trim() || null,
      payroll_location: employeeForm.payroll_location.trim() || null,
      contract_status: normalizeStaffContractStatus(employeeForm.contract_status),
      contract_type: employeeForm.contract_type.trim() || null,
      contract_start_date: employeeForm.labor_start_date || null,
      contract_end_date: employeeForm.labor_end_date || null,
      probation_payroll_type: normalizeEmployeePayrollType(employeeForm.probation_payroll_type),
      labor_payroll_type: normalizeEmployeePayrollType(employeeForm.labor_payroll_type),
      probation_salary_percentage: employeeForm.probation_salary_percentage === '100' ? 100 : 85,
      probation_bonus_percentage: employeeForm.probation_bonus_percentage === '85' ? 85 : 100,
      probation_start_date: employeeForm.probation_start_date || null,
      probation_end_date: employeeForm.probation_end_date || null,
      labor_start_date: employeeForm.labor_start_date || null,
      labor_end_date: employeeForm.labor_end_date || null,
      start_date: employeeForm.probation_start_date || employeeForm.labor_start_date || null,
      end_date: employeeForm.active ? null : (employeeForm.labor_end_date || employeeForm.probation_end_date || null),
      base_salary_vnd: parseDong(employeeForm.base_salary_vnd),
      hourly_rate_vnd: parseDong(employeeForm.hourly_rate_vnd),
      monthly_bonus_vnd: parseDong(employeeForm.monthly_bonus_vnd),
      lunch_allowance_vnd: 0,
      rest_period_minutes: null,
      overtime_rate_multiplier: null,
      night_rate_multiplier: null,
      holiday_rate_multiplier: null,
      employee_contribution_rate: null,
      employer_contribution_rate: null,
      pit_withholding_rate: employeeForm.pit_withholding_rate ? decimalInput(employeeForm.pit_withholding_rate) : null,
      dependents_count: Math.max(0, Math.round(Number(employeeForm.dependents_count) || 0)),
      bank_name: employeeForm.bank_name.trim() || null,
      bank_account_number: employeeForm.bank_account_number.trim() || null,
      tax_code: employeeForm.tax_code.trim() || null,
      social_insurance_number: employeeForm.social_insurance_number.trim() || null,
      social_insurance_enrolled: employeeForm.social_insurance_enrolled,
      social_insurance_salary_vnd: parseDong(employeeForm.social_insurance_salary_vnd),
      emergency_contact: employeeForm.emergency_contact_name.trim() || null,
      emergency_contact_name: employeeForm.emergency_contact_name.trim() || null,
      emergency_contact_relationship: employeeForm.emergency_contact_relationship.trim() || null,
      emergency_contact_phone: employeeForm.emergency_contact_phone.trim() || null,
      google_drive_folder_url: employeeForm.google_drive_folder_url.trim() || null,
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

  async function createEmployeeRecord(input: {
    email: string
    employmentType: StaffEmployeeRecordEmploymentType
    fullName: string
    phone: string
  }) {
    if (!isOwnerOrAdmin || saving) throw new Error(text.accessRequired)

    setSaving(true)
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')

      const response = await fetch('/api/staff/employees/record', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      })
      const payload = await response.json().catch(() => ({})) as {
        employee?: StaffEmployeeProfile
        error?: string
        warning?: string
      }
      if (!response.ok || !payload.employee) {
        throw new Error(payload.error || 'Could not create the employee HR record.')
      }

      const employeeStaffProfile = staffProfileFromEmployee(payload.employee)
      setEmployeeForm(employeeFormForProfile(employeeStaffProfile, payload.employee))
      setEmployeeKioskPin('')
      setEmployeeKioskPinConfirm('')
      setEmployeeKioskPinSaveConfirmation('')
      setEmployeeKioskPinVisibleValue('')
      setEmployeeKioskPinEmailState('idle')
      setEmployeeKioskPinEmailRecipient('')
      setEmployeeKioskAccessRole(payload.employee.kiosk_access_role === 'manager' ? 'manager' : 'staff')
      employeeKioskPinProfileRef.current = payload.employee.profile_id
      setStatus(payload.warning || (resolvedLanguage === 'vi' ? 'Đã tạo hồ sơ HR. Hãy cấp PIN 6 số.' : 'HR record created. Assign the six-digit PIN.'))
      markStaffDataStale('attendance', 'hr')
      await Promise.all([loadAttendanceData(true), loadHrData(true)])
      return { warning: payload.warning || '' }
    } finally {
      setSaving(false)
    }
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
      policy_version: hrSettings.policy_version.trim() || 'VN-2026.1',
      effective_from: hrSettings.effective_from || todayString(),
      policy_status: hrSettings.policy_status,
      legal_source_url: hrSettings.legal_source_url?.trim() || null,
      legal_reviewed_on: hrSettings.legal_reviewed_on || null,
      personal_deduction_vnd: Math.max(0, Number(hrSettings.personal_deduction_vnd) || 0),
      dependent_deduction_vnd: Math.max(0, Number(hrSettings.dependent_deduction_vnd) || 0),
      short_term_pit_rate: Math.max(0, Number(hrSettings.short_term_pit_rate) || 0),
      pit_brackets: hrSettings.pit_brackets,
      employee_social_insurance_rate: Math.max(0, Number(hrSettings.employee_social_insurance_rate) || 0),
      employee_health_insurance_rate: Math.max(0, Number(hrSettings.employee_health_insurance_rate) || 0),
      employee_unemployment_insurance_rate: Math.max(0, Number(hrSettings.employee_unemployment_insurance_rate) || 0),
      employer_social_insurance_rate: Math.max(0, Number(hrSettings.employer_social_insurance_rate) || 0),
      employer_health_insurance_rate: Math.max(0, Number(hrSettings.employer_health_insurance_rate) || 0),
      employer_unemployment_insurance_rate: Math.max(0, Number(hrSettings.employer_unemployment_insurance_rate) || 0),
      employer_trade_union_rate: Math.max(0, Number(hrSettings.employer_trade_union_rate) || 0),
      night_work_bonus_rate: Math.max(0, Number(hrSettings.night_work_bonus_rate) || 0),
      night_overtime_extra_rate: Math.max(0, Number(hrSettings.night_overtime_extra_rate) || 0),
      leave_accrual_days_per_month: Math.max(0, Number(hrSettings.leave_accrual_days_per_month) || 0),
      leave_qualifying_worked_days: Math.max(0, Math.round(Number(hrSettings.leave_qualifying_worked_days) || 0)),
      leave_join_cutoff_day: Math.min(31, Math.max(1, Math.round(Number(hrSettings.leave_join_cutoff_day) || 1))),
      leave_exit_cutoff_day: Math.min(31, Math.max(1, Math.round(Number(hrSettings.leave_exit_cutoff_day) || 1))),
      leave_carry_forward_month: Math.min(12, Math.max(1, Math.round(Number(hrSettings.leave_carry_forward_month) || 1))),
      leave_carry_forward_day: Math.min(31, Math.max(1, Math.round(Number(hrSettings.leave_carry_forward_day) || 1))),
      pay_period_start_day: Math.min(28, Math.max(1, Math.round(Number(hrSettings.pay_period_start_day) || 1))),
      auto_create_payroll_runs: Boolean(hrSettings.auto_create_payroll_runs),
      auto_update_payroll_daily: Boolean(hrSettings.auto_update_payroll_daily),
      personal_income_tax_enabled: Boolean(hrSettings.personal_income_tax_enabled),
      social_insurance_enabled: Boolean(hrSettings.social_insurance_enabled),
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

  async function syncPayrollDraft() {
    if (!isOwnerOrAdmin) return
    setSaving(true)
    const { data, error } = await supabase.rpc('staff_sync_payroll_draft', {
      p_run_date: todayString(),
      p_force: true,
    })
    setStatus(error
      ? error.message
      : resolvedLanguage === 'vi'
        ? `Đã đồng bộ bảng lương tự động (${Number(data?.item_count) || 0} nhân viên).`
        : `Automatic payroll synchronized (${Number(data?.item_count) || 0} employees).`)
    if (!error) {
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function approveAttendancePeriod() {
    if (!isOwnerOrAdmin) return
    const [periodStart, periodEnd] = orderedRange(payrollPeriodStart, payrollPeriodEnd)
    setSaving(true)
    const { data, error } = await supabase.rpc('staff_approve_attendance_period', {
      p_period_start: periodStart,
      p_period_end: periodEnd,
    })
    setStatus(error
      ? error.message
      : resolvedLanguage === 'vi'
        ? `Đã duyệt ${Number(data?.approved_log_count) || 0} bản ghi chấm công.`
        : `Approved ${Number(data?.approved_log_count) || 0} attendance records.`)
    if (!error) {
      markStaffDataStale('attendance')
      await loadAttendanceData(true)
    }
    setSaving(false)
  }

  async function saveHrSetupOption(optionType: StaffHrSetupOptionType) {
    if (!canManageAttendance) return
    const name = hrSetupForm[optionType].trim()
    if (!name) return
    setSaving(true)
    const { error } = await supabase.rpc('staff_upsert_hr_setup_option', {
      p_option_type: optionType,
      p_name: name,
    })
    setStatus(error ? error.message : text.messages.hrSetupOptionSaved)
    if (!error) {
      setHrSetupForm((current) => ({ ...current, [optionType]: '' }))
      markStaffDataStale('hr')
      await loadHrData(true)
    }
    setSaving(false)
  }

  async function updateHrSetupOption(optionId: string, name: string) {
    if (!canManageAttendance || !optionId || !name.trim()) return false
    setSaving(true)
    const { error } = await supabase.rpc('staff_update_hr_setup_option', {
      p_option_id: optionId,
      p_name: name.trim(),
    })
    setStatus(error ? error.message : text.messages.hrSetupOptionSaved)
    if (!error) {
      markStaffDataStale('attendance', 'hr')
      await Promise.all([loadAttendanceData(true), loadHrData(true)])
    }
    setSaving(false)
    return !error
  }

  async function setHrSetupOptionActive(optionId: string, active: boolean) {
    if (!canManageAttendance) return
    setSaving(true)
    const { error } = await supabase.rpc('staff_set_hr_setup_option_active', {
      p_option_id: optionId,
      p_active: active,
    })
    setStatus(error ? error.message : text.messages.hrSetupOptionSaved)
    if (!error) {
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
          workedDays: item.workedDays,
          periodStandardMinutes: item.periodStandardMinutes,
          salaryPaidMinutes: item.salaryPaidMinutes,
          paidLeaveDays: item.paidLeaveDays,
          payrollHourlyRateVnd: item.hourlyRate,
          mealAllowanceVnd: item.mealAllowance,
          otherAllowancesVnd: item.otherAllowances,
          probationBonusPercentage: Number(employee?.probation_bonus_percentage) === 85 ? 85 : 100,
          probationBonusApplied: true,
          contributionBaseVnd: item.contributionBase,
          costAllocation: staffCostAllocations.get(item.profileId),
          costAssignments: costAssignments.filter((row) => row.profile_id === item.profileId && !row.cancelled_at && row.start_date <= periodEnd && row.end_date >= periodStart),
          mainWorkLocation: employee?.main_work_location || null,
          payrollLocation: employee?.payroll_location || null,
          policyReference: 'VR_ Payroll July - 260805.xlsx · HR Employee Master',
        },
      }
    })
    const { error: itemError } = await supabase
      .from('staff_payroll_items')
      .upsert(rows, { onConflict: 'payroll_run_id,profile_id' })

    const correctionResults = itemError ? [] : await Promise.all(rows.map((row) => (
      supabase
        .from('staff_payroll_items')
        .update({
          base_salary_vnd: row.base_salary_vnd,
          overtime_pay_vnd: row.overtime_pay_vnd,
          allowances_vnd: row.allowances_vnd,
          employee_contributions_vnd: row.employee_contributions_vnd,
          employer_contributions_vnd: row.employer_contributions_vnd,
          pit_withholding_vnd: row.pit_withholding_vnd,
          net_income_vnd: row.net_income_vnd,
          company_cost_vnd: row.company_cost_vnd,
          payslip_snapshot: row.payslip_snapshot,
        })
        .eq('payroll_run_id', row.payroll_run_id)
        .eq('profile_id', row.profile_id)
    )))
    const correctionError = correctionResults.find((result) => result.error)?.error

    setStatus(itemError?.message || correctionError?.message || text.messages.payrollGenerated)
    if (!itemError && !correctionError) {
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
      `Paid leave: ${Number(calculation.paidLeaveDays.toFixed(2))} ${text.days} / ${Number(calculation.paidLeaveHours.toFixed(2))}h`,
      `Payroll basis: ${calculation.payrollBasis === 'published_schedule' ? 'published schedule' : 'working calendar'} (${Number(calculation.periodStandardDays.toFixed(2))} days)`,
      `Salary-paid days: ${Number(calculation.salaryPaidDays.toFixed(2))}`,
      `Salary-paid hours: ${hoursLabel(calculation.salaryPaidMinutes)}`,
      `${text.labels.overtimeHours}: ${hoursLabel(calculation.overtimeMinutes)}`,
      `${text.labels.leaveBalance}: ${Number(calculation.leaveBalanceDays.toFixed(2))} ${text.days}`,
      '',
      `${text.labels.baseSalary}: ${formatVnd(calculation.basePay)}`,
      `${text.labels.overtimePay}: ${formatVnd(calculation.overtimePay)}`,
      `Meal allowance: ${formatVnd(calculation.mealAllowance)}`,
      `${text.labels.allowances}: ${formatVnd(calculation.otherAllowances)}`,
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

  async function downloadPayrollExcel() {
    const [periodStart, periodEnd] = orderedRange(payrollPeriodStart, payrollPeriodEnd)
    const accountantClassificationForEmployee = (employee: StaffEmployeeProfile | undefined) => {
      const employmentType = normalizeStaffEmploymentType(employee?.employment_type)
      const contractStatus = normalizeStaffContractStatus(employee?.contract_status)
      const payrollType = employeePayrollTypeForPeriod(employee, periodEnd)
      const probationEnd = employee?.probation_end_date || ''
      const laborStart = employee?.labor_start_date || ''
      const probationApplies = Boolean(
        (employee?.probation_start_date && periodEnd >= employee.probation_start_date) &&
        (!probationEnd || periodEnd <= probationEnd) &&
        (!laborStart || periodEnd < laborStart)
      )
      const probation = probationApplies || contractStatus === 'probation' || employmentType.startsWith('probation')
      if (payrollType === 'manager') return { category: 'manager', probation }
      if (probation) {
        if (payrollType === 'hourly' || employmentType === 'probation_part_time') return { category: 'probation_part_time', probation }
        return { category: 'probation_monthly', probation }
      }
      if (payrollType === 'hourly') {
        return { category: employmentType === 'part_time' || employmentType === 'contractor' ? 'part_time' : 'official_hourly', probation }
      }
      return { category: 'monthly', probation }
    }
    const historicalSnapshots = payrollSourceSnapshots.filter((snapshot) => (
      snapshot.period_start === periodStart && snapshot.period_end === periodEnd
    ))
    const candidateHistoricalSourceKey = historicalSnapshots.length === 15
      && historicalSnapshots.every((snapshot) => snapshot.source_key === historicalSnapshots[0]?.source_key)
      ? historicalSnapshots[0]?.source_key || ''
      : ''
    const historicalSourceKey = hasCompleteHistoricalAccountantLayout(
      candidateHistoricalSourceKey,
      historicalSnapshots.map((snapshot) => snapshot.employee_code),
    ) ? candidateHistoricalSourceKey : ''
    const orderedHistoricalSnapshots = historicalSourceKey
      ? sortHistoricalAccountantRows(historicalSourceKey, historicalSnapshots)
      : historicalSnapshots
    const calculatedPayrollRows: Array<Record<string, unknown>> = visibleStaffProfileOptions.map((staffProfile) => {
      const employee = employeeProfileById.get(staffProfile.id)
      const calculation = staffPayrollCalculations.get(staffProfile.id) || emptyStaffPayrollCalculation(staffProfile.id)
      const payrollType = employeePayrollTypeForPeriod(employee, periodEnd)
      const accountantClassification = accountantClassificationForEmployee(employee)
      return {
        __accountantCategory: accountantClassification.category,
        __accountantProbation: accountantClassification.probation,
        'Employee code': employee?.employee_code || '',
        Employee: employee?.legal_name || customerName(staffProfile, text),
        Department: employee?.department || '',
        'Employment type': text.employmentTypes[normalizeStaffEmploymentType(employee?.employment_type)],
        'Contract status': text.contractStatuses[normalizeStaffContractStatus(employee?.contract_status)],
        'Bank name': employee?.bank_name || '',
        'Bank account': employee?.bank_account_number || '',
        'Contract salary (VND)': payrollType === 'hourly' ? 0 : Math.max(0, Number(employee?.base_salary_vnd) || 0),
        'Configured hourly rate (VND)': Math.max(0, Number(employee?.hourly_rate_vnd) || 0),
        'Recurring monthly bonus (VND)': Math.max(0, Number(employee?.monthly_bonus_vnd) || 0),
        'Payroll hourly rate (VND)': Math.round(calculation.hourlyRate),
        'Period standard hours': Number((calculation.periodStandardMinutes / 60).toFixed(2)),
        'Scheduled hours': Number((calculation.scheduledMinutes / 60).toFixed(2)),
        'Worked hours': Number((calculation.workedMinutes / 60).toFixed(2)),
        'Worked days': calculation.workedDays,
        'Meal days': calculation.mealDays,
        'Paid leave hours': Number(calculation.paidLeaveHours.toFixed(2)),
        'Paid leave days': Number(calculation.paidLeaveDays.toFixed(2)),
        'Salary-paid hours': Number((calculation.salaryPaidMinutes / 60).toFixed(2)),
        'Overtime hours': Number((calculation.overtimeMinutes / 60).toFixed(2)),
        'Night hours': Number((calculation.nightMinutes / 60).toFixed(2)),
        'Holiday hours': Number((calculation.holidayMinutes / 60).toFixed(2)),
        'Base pay (VND)': calculation.basePay,
        'Meal allowance (VND)': calculation.mealAllowance,
        'Other allowances (VND)': calculation.otherAllowances,
        'Overtime pay (VND)': calculation.overtimePay,
        'Bonuses (VND)': calculation.bonuses,
        'Gross income (VND)': calculation.grossIncome,
        'Insurance base (VND)': calculation.contributionBase,
        'Employee insurance (VND)': calculation.employeeContributions,
        'PIT withheld (VND)': calculation.pitWithheld,
        'Advances (VND)': calculation.advances,
        'Deductions (VND)': calculation.deductions,
        'Net payable (VND)': calculation.netIncome,
        'Employer insurance (VND)': calculation.employerContributions,
        'Company cost (VND)': calculation.companyCost,
        'Rest alerts': calculation.restWarningCount,
        Notes: employee?.payroll_note || '',
        'Payroll basis': calculation.payrollBasis === 'published_schedule' ? 'Published schedule' : 'Working calendar',
        'Period standard days': Number(calculation.periodStandardDays.toFixed(2)),
        'Salary-paid days': Number(calculation.salaryPaidDays.toFixed(2)),
      }
    })
    const historicalSnapshotNumber = (snapshot: StaffPayrollSourceSnapshot, key: string, fallback = 0) => {
      const value = Number(snapshot.source_payload?.[key])
      return Number.isFinite(value) ? value : fallback
    }
    const historicalPayrollRows: Array<Record<string, unknown>> = orderedHistoricalSnapshots.map((snapshot) => {
      const standardHoursPerDay = snapshot.employment_status?.toLowerCase().includes('office') ? 8 : 6.5
      const insuranceBase = historicalSnapshotNumber(
        snapshot,
        'insurance_base_vnd',
        snapshot.employee_insurance_vnd > 0 ? snapshot.contract_rate_vnd : 0,
      )
      const placement = historicalAccountantPlacement(historicalSourceKey, snapshot.employee_code)
      const accountantCategory = historicalAccountantCategory(
        historicalSourceKey,
        snapshot.employee_code,
        String(snapshot.source_payload?.category || snapshot.employment_status || ''),
      )
      const bankAdjustment = historicalSnapshotNumber(snapshot, 'difference_vnd')
      const bankTransfer = snapshot.net_payable_vnd + bankAdjustment
      const employeeInsuranceDeducted = Math.max(0, snapshot.gross_income_vnd - snapshot.pit_withheld_vnd - snapshot.net_payable_vnd)
      const employeeInsuranceRate = insuranceBase > 0 ? snapshot.employee_insurance_vnd / insuranceBase * 100 : 0
      const employerInsuranceRate = insuranceBase > 0 && snapshot.employee_insurance_vnd > 0 ? 21.5 : 0
      const employerInsurance = Math.round(insuranceBase * employerInsuranceRate / 100)
      const standardDays = snapshot.basic_days ?? 0
      const salaryPaidDays = accountantCategory === 'official_hourly' || accountantCategory === 'part_time'
        ? snapshot.worked_days ?? 0
        : snapshot.contract_rate_vnd > 0 && standardDays > 0
          ? Number((snapshot.base_pay_vnd / snapshot.contract_rate_vnd * standardDays).toFixed(6))
          : 0
      const payrollHourlyRate = accountantCategory === 'official_hourly' || accountantCategory === 'part_time'
        ? snapshot.contract_rate_vnd
        : standardDays > 0
          ? snapshot.contract_rate_vnd / standardDays / standardHoursPerDay
          : 0
      return {
        __accountantHistoricalSource: true,
        __accountantCategory: accountantCategory,
        __accountantProbation: accountantCategory === 'probation_monthly' || accountantCategory === 'probation_part_time',
        __accountantPlacement: placement || undefined,
        __accountantSkipTimesheet: snapshot.employee_code === 'NV03',
        'Employee code': snapshot.employee_code,
        Employee: snapshot.employee_name,
        Department: snapshot.division || '',
        'Employment type': snapshot.employment_status || '',
        'Contract status': snapshot.employment_status || '',
        'Bank name': snapshot.bank_name || '',
        'Bank account': snapshot.bank_account_number || '',
        'Contract salary (VND)': snapshot.contract_rate_vnd,
        'Configured hourly rate (VND)': snapshot.employment_status?.toLowerCase().includes('hourly') ? snapshot.contract_rate_vnd : 0,
        'Payroll hourly rate (VND)': payrollHourlyRate,
        'Period standard hours': snapshot.basic_days === null ? '' : Number((snapshot.basic_days * standardHoursPerDay).toFixed(2)),
        'Scheduled hours': '',
        'Worked hours': snapshot.worked_minutes === null ? '' : Number((snapshot.worked_minutes / 60).toFixed(2)),
        'Worked days': snapshot.worked_days ?? '',
        'Meal days': snapshot.meal_days,
        'Paid leave hours': snapshot.worked_minutes === null ? '' : Number(((snapshot.salary_paid_minutes - snapshot.worked_minutes) / 60).toFixed(2)),
        'Paid leave days': snapshot.paid_leave_days,
        'Salary-paid hours': Number((snapshot.salary_paid_minutes / 60).toFixed(2)),
        'Overtime hours': Number((snapshot.overtime_minutes / 60).toFixed(2)),
        'Night hours': 0,
        'Holiday hours': 0,
        'Base pay (VND)': snapshot.base_pay_vnd,
        'Meal allowance (VND)': snapshot.meal_allowance_vnd,
        'Other allowances (VND)': historicalSnapshotNumber(snapshot, 'other_income_vnd'),
        'Overtime pay (VND)': snapshot.overtime_pay_vnd,
        'Bonuses (VND)': 0,
        'Gross income (VND)': snapshot.gross_income_vnd,
        'Insurance base (VND)': insuranceBase,
        'Employee insurance (VND)': snapshot.employee_insurance_vnd,
        'Employee insurance %': employeeInsuranceRate,
        'Taxable income (VND)': snapshot.taxable_income_vnd,
        'PIT withheld (VND)': snapshot.pit_withheld_vnd,
        'Advances (VND)': 0,
        'Deductions (VND)': 0,
        'Net payable (VND)': snapshot.net_payable_vnd,
        'Net before adjustment (VND)': snapshot.net_payable_vnd,
        'Employee insurance deducted (VND)': employeeInsuranceDeducted,
        'Employer insurance %': employerInsuranceRate,
        'Employer insurance (VND)': employerInsurance,
        'Company cost (VND)': snapshot.gross_income_vnd + employerInsurance,
        'Bank adjustment (VND)': bankAdjustment,
        'Bank transfer (VND)': bankTransfer,
        'Rest alerts': '',
        Notes: snapshot.details || '',
        'Period standard days': standardDays,
        'Salary-paid days': salaryPaidDays,
      }
    })
    const payrollRows = historicalSourceKey ? historicalPayrollRows : calculatedPayrollRows

    const attendanceRows = attendanceLogs
      .filter((log) => log.work_date >= periodStart && log.work_date <= periodEnd)
      .sort((left, right) => left.work_date.localeCompare(right.work_date))
      .map((log) => {
        const staffProfile = profileById.get(log.staff_profile_id)
        const employee = employeeProfileById.get(log.staff_profile_id)
        return {
          'Employee code': employee?.employee_code || '',
          Employee: employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : log.staff_profile_id),
          Date: log.work_date,
          'Clock in': log.clock_in_at || '',
          'Clock out': log.clock_out_at || '',
          'Break minutes': Math.max(0, Number(log.break_minutes) || 0),
          'Worked hours': Number((approvedAttendanceMinutes(log) / 60).toFixed(2)),
          'Regular hours': Number((Math.max(0, Number(log.regular_minutes) || 0) / 60).toFixed(2)),
          'Overtime hours': Number((Math.max(0, Number(log.overtime_minutes) || 0) / 60).toFixed(2)),
          'Night hours': Number((Math.max(0, Number(log.night_minutes) || 0) / 60).toFixed(2)),
          'Holiday hours': Number((Math.max(0, Number(log.holiday_minutes) || 0) / 60).toFixed(2)),
          Status: log.status,
          Approval: log.approval_status,
          'Manager note': log.manager_note || '',
        }
      })

    const paidLeaveRows = leaveRequests
      .filter((leave) => leave.end_date >= periodStart && leave.start_date <= periodEnd)
      .map((leave) => {
        const staffProfile = profileById.get(leave.staff_profile_id)
        const employee = employeeProfileById.get(leave.staff_profile_id)
        const paidInPayroll = leave.status === 'approved' && isPaidLeaveForEmployee(leave, employee)
        return {
          'Employee code': employee?.employee_code || '',
          Employee: employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : leave.staff_profile_id),
          'Leave type': leave.leave_type,
          'Request start': leave.start_date,
          'Request end': leave.end_date,
          'Requested hours': Math.max(0, Number(leave.hours) || 0),
          'Hours inside selected period': Number(leaveHoursInsidePeriod(leave, periodStart, periodEnd).toFixed(2)),
          Status: leave.status,
          'Paid in payroll': paidInPayroll ? 'Yes' : 'No',
          Reason: leave.reason || '',
        }
      })

    const adjustmentRows = hrAdjustments
      .filter((adjustment) => adjustmentAppliesToPeriod(adjustment, periodStart, periodEnd))
      .map((adjustment) => {
        const staffProfile = profileById.get(adjustment.profile_id)
        const employee = employeeProfileById.get(adjustment.profile_id)
        return {
          'Employee code': employee?.employee_code || '',
          Employee: employee?.legal_name || (staffProfile ? customerName(staffProfile, text) : adjustment.profile_id),
          Type: adjustment.adjustment_type,
          Title: adjustment.title,
          'Amount (VND)': adjustment.amount_vnd,
          'Effective date': adjustment.effective_date,
          'Period start': adjustment.period_start || '',
          'Period end': adjustment.period_end || '',
          Status: adjustment.status,
          Notes: adjustment.notes || '',
        }
      })

    const calculationBasisRows = [
      { Setting: 'Report period', Value: `${periodStart} to ${periodEnd}`, Notes: 'Selected in the Payroll tab' },
      { Setting: 'Payroll data source', Value: historicalSourceKey ? 'Protected historical payroll source' : 'Live HR attendance and payroll data', Notes: historicalSourceKey ? 'The workbook is regenerated from the signed-off employee-level source snapshot, including historical reconciliation adjustments.' : 'Calculated when the Excel file is generated.' },
      { Setting: 'Reference workbook', Value: 'VR_Payroll_July_2026_Emile_V2 · HR Employee Master', Notes: 'HR Employee Master is authoritative for employee status, contract periods, payroll type, salary, and insurance enrollment. Reconcile remains authoritative for the July historical snapshot.' },
      { Setting: 'Reference workbook URL', Value: 'https://docs.google.com/spreadsheets/d/1UbmITiVHdogTU8zOhHRFS4NmZn6unL_XsZms16zIZfA', Notes: '' },
      { Setting: 'Monthly payroll denominator', Value: 'Published employee schedule for the selected period', Notes: 'Changes with each month. Approved attendance and paid leave are the payable numerator.' },
      { Setting: 'Fallback daily hours', Value: Number((hrSettings.standard_monthly_hours / Math.max(1, hrSettings.standard_monthly_days)).toFixed(2)), Notes: `Applied to the selected period's working-calendar days when an employee has no published schedule. Weekly rest days: ${attendanceSettings.weekly_rest_days.join(', ')} (0 = Sunday).` },
      { Setting: 'Meal allowance per worked day (VND)', Value: hrSettings.lunch_allowance_vnd, Notes: 'July reference: 35,000 VND per worked day' },
      { Setting: 'Normal overtime multiplier', Value: hrSettings.normal_overtime_multiplier, Notes: 'July reference: 150%' },
      { Setting: 'Night overtime multiplier', Value: hrSettings.normal_overtime_multiplier + hrSettings.night_work_bonus_rate / 100 + hrSettings.night_overtime_extra_rate / 100, Notes: 'Ordinary OT multiplier plus night-work and night-OT premiums' },
      { Setting: 'Holiday overtime multiplier', Value: hrSettings.holiday_overtime_multiplier, Notes: 'July reference: up to 300%' },
      { Setting: 'Paid leave policy', Value: 'Approved annual/public-holiday leave for monthly full-time payroll', Notes: 'Part-time staff do not receive paid annual leave under the July policy' },
      { Setting: 'Leave accrual per qualifying month', Value: hrSettings.leave_accrual_days_per_month, Notes: `Qualifies from ${hrSettings.leave_qualifying_worked_days} worked days` },
      { Setting: 'Join / exit cutoff days', Value: `${hrSettings.leave_join_cutoff_day} / ${hrSettings.leave_exit_cutoff_day}`, Notes: 'July HR Employee Master leave-balance policy' },
      { Setting: 'Carry-forward expiry', Value: `${String(hrSettings.leave_carry_forward_day).padStart(2, '0')}/${String(hrSettings.leave_carry_forward_month).padStart(2, '0')}`, Notes: 'Unused prior-year balance expiry' },
      { Setting: 'Social insurance', Value: hrSettings.social_insurance_enabled ? 'Enabled' : 'Disabled', Notes: 'Applied to active full-time contract salary, excluding meal allowance and overtime' },
      { Setting: 'Employee insurance rate', Value: hrSettings.employee_social_insurance_rate + hrSettings.employee_health_insurance_rate + hrSettings.employee_unemployment_insurance_rate, Notes: `SI ${hrSettings.employee_social_insurance_rate}% · HI ${hrSettings.employee_health_insurance_rate}% · UI ${hrSettings.employee_unemployment_insurance_rate}%` },
      { Setting: 'Employer insurance and union rate', Value: hrSettings.employer_social_insurance_rate + hrSettings.employer_health_insurance_rate + hrSettings.employer_unemployment_insurance_rate + hrSettings.employer_trade_union_rate, Notes: `SI ${hrSettings.employer_social_insurance_rate}% · HI ${hrSettings.employer_health_insurance_rate}% · UI ${hrSettings.employer_unemployment_insurance_rate}% · union ${hrSettings.employer_trade_union_rate}%` },
      { Setting: 'Personal income tax', Value: hrSettings.personal_income_tax_enabled ? 'Enabled' : 'Disabled', Notes: `Progressive calculation; employee-specific fixed withholding is used only when explicitly configured.` },
      { Setting: 'PIT self deduction (VND)', Value: hrSettings.personal_deduction_vnd, Notes: `Policy ${hrSettings.policy_version}, effective ${hrSettings.effective_from}` },
      { Setting: 'PIT dependent deduction (VND)', Value: hrSettings.dependent_deduction_vnd, Notes: 'Per registered dependent per month' },
      { Setting: 'Progressive PIT bands', Value: hrSettings.pit_brackets.map((bracket) => `${bracket.rate}%`).join(' / '), Notes: hrSettings.pit_brackets.map((bracket) => bracket.up_to == null ? 'above final threshold' : formatVndCompact(bracket.up_to)).join(' / ') },
      { Setting: 'Legal source', Value: hrSettings.legal_source_url || '', Notes: `Reviewed ${hrSettings.legal_reviewed_on || 'not recorded'}` },
    ]

    const employeeByCode = new Map(Array.from(employeeProfileById.values()).map((employee) => [employee.employee_code || '', employee]))
    const employeeMasterRows = visibleStaffProfileOptions.map((staffProfile) => {
      const employee = employeeProfileById.get(staffProfile.id)
      const accountantClassification = accountantClassificationForEmployee(employee)
      return {
        __accountantCategory: accountantClassification.category,
        __accountantProbation: accountantClassification.probation,
        'Employee code': employee?.employee_code || '',
        'Legal name': employee?.legal_name || customerName(staffProfile, text),
        'Employment status': employee?.active === false ? 'Inactive' : text.contractStatuses[normalizeStaffContractStatus(employee?.contract_status)],
        'Employment type': text.employmentTypes[normalizeStaffEmploymentType(employee?.employment_type)],
        Position: employee?.job_title || '',
        Division: employee?.department || '',
        Workplace: employee?.main_work_location || '',
        Phone: employee?.personal_phone || '',
        Email: employee?.personal_email || '',
        'Date of birth': employee?.date_of_birth || '',
        'National ID': employee?.national_id || '',
        Address: employee?.address || '',
        'Employment start': employee?.start_date || '',
        'Employment end': employee?.end_date || '',
        'Contract type': employee?.contract_type || '',
        'Contract start': employee?.contract_start_date || '',
        'Contract end': employee?.contract_end_date || '',
        'Monthly salary (VND)': Math.max(0, Number(employee?.base_salary_vnd) || 0),
        'Hourly rate (VND)': Math.max(0, Number(employee?.hourly_rate_vnd) || 0),
        'Recurring monthly bonus (VND)': Math.max(0, Number(employee?.monthly_bonus_vnd) || 0),
        'Meal / worked day (VND)': hrSettings.lunch_allowance_vnd,
        'OT multiplier': hrSettings.normal_overtime_multiplier,
        'Night multiplier': hrSettings.normal_overtime_multiplier + hrSettings.night_work_bonus_rate / 100 + hrSettings.night_overtime_extra_rate / 100,
        'Holiday multiplier': hrSettings.holiday_overtime_multiplier,
        'Employee insurance %': hrSettings.employee_social_insurance_rate + hrSettings.employee_health_insurance_rate + hrSettings.employee_unemployment_insurance_rate,
        'Employer insurance & union %': hrSettings.employer_social_insurance_rate + hrSettings.employer_health_insurance_rate + hrSettings.employer_unemployment_insurance_rate + hrSettings.employer_trade_union_rate,
        'Configured PIT %': employeeRate(employee?.pit_withholding_rate, hrSettings.pit_withholding_rate),
        Dependents: Math.max(0, Number(employee?.dependents_count) || 0),
        'Tax code': employee?.tax_code || '',
        'Social insurance number': employee?.social_insurance_number || '',
        Bank: employee?.bank_name || '',
        'Bank account': employee?.bank_account_number || '',
        'Profile photo': employee?.profile_photo_path ? 'Available' : 'Missing',
        CV: employee?.cv_document_path ? 'Available' : 'Missing',
        Notes: employee?.payroll_note || '',
        'Probation payroll type': normalizeEmployeePayrollType(employee?.probation_payroll_type),
        'Labor payroll type': normalizeEmployeePayrollType(employee?.labor_payroll_type),
        'Probation salary %': Math.max(0, Number(employee?.probation_salary_percentage) || 85),
        'Probation bonus %': Number(employee?.probation_bonus_percentage) === 85 ? 85 : 100,
        'Probation start': employee?.probation_start_date || '',
        'Probation end': employee?.probation_end_date || '',
        'Labor start': employee?.labor_start_date || '',
        'Labor end': employee?.labor_end_date || '',
        'Insurance enrolled': employee?.social_insurance_enrolled ? 'Yes' : 'No',
        'Insurance salary base (VND)': Math.max(0, Number(employee?.social_insurance_salary_vnd) || 0),
        'Emergency contact name': employee?.emergency_contact_name || '',
        'Emergency contact relationship': employee?.emergency_contact_relationship || '',
        'Emergency contact phone': employee?.emergency_contact_phone || '',
        'Google Drive employee folder': employee?.google_drive_folder_url || '',
      }
    })
    const currentEmployeeRowByCode = new Map<string, Record<string, unknown>>(employeeMasterRows.map((employee) => [String(employee['Employee code'] || ''), employee]))
    const historicalPayrollRowByCode = new Map<string, Record<string, unknown>>(historicalPayrollRows.map((payroll) => [String(payroll['Employee code'] || ''), payroll]))
    const exportEmployeeRows: Array<Record<string, unknown>> = historicalSourceKey
      ? orderedHistoricalSnapshots.map((snapshot) => {
          const payroll = historicalPayrollRowByCode.get(snapshot.employee_code) || {}
          const current = currentEmployeeRowByCode.get(snapshot.employee_code) || {}
          const category = String(payroll.__accountantCategory || '')
          const hourly = category === 'official_hourly' || category === 'part_time' || category === 'probation_part_time'
          return {
            ...current,
            __accountantCategory: payroll.__accountantCategory,
            __accountantProbation: payroll.__accountantProbation,
            'Employee code': snapshot.employee_code,
            'Legal name': snapshot.employee_name,
            'Employment status': snapshot.employment_status || current['Employment status'] || '',
            'Employment type': snapshot.employment_status || current['Employment type'] || '',
            Division: snapshot.division || current.Division || '',
            'Monthly salary (VND)': hourly ? 0 : snapshot.contract_rate_vnd,
            'Hourly rate (VND)': hourly ? snapshot.contract_rate_vnd : 0,
            'Configured hourly rate (VND)': hourly ? snapshot.contract_rate_vnd : 0,
            'Meal / worked day (VND)': snapshot.meal_days > 0 ? snapshot.meal_allowance_vnd / snapshot.meal_days : hrSettings.lunch_allowance_vnd,
            'Employee insurance %': Number(payroll['Employee insurance %']) || 0,
            'Employer insurance & union %': Number(payroll['Employer insurance %']) || 0,
            Bank: snapshot.bank_name || '',
            'Bank account': snapshot.bank_account_number || '',
            Notes: snapshot.details || '',
          }
        })
      : employeeMasterRows

    const contractCheckRows = exportEmployeeRows.map((employee, index) => {
      const row = index + 5
      const employeeRow = row
      const statusFormula = `IF(OR('Employee Master'!A${employeeRow}="",'Employee Master'!B${employeeRow}=""),"MISSING IDENTITY",IF(AND('Employee Master'!R${employeeRow}=0,'Employee Master'!S${employeeRow}=0),"MISSING PAY RATE",IF(OR('Employee Master'!AD${employeeRow}="",'Employee Master'!AE${employeeRow}=""),"MISSING BANK",IF(AND('Employee Master'!P${employeeRow}<>"",'Employee Master'!Q${employeeRow}<>"",'Employee Master'!Q${employeeRow}<'Employee Master'!P${employeeRow}),"CHECK CONTRACT DATES","OK"))))`
      return {
        'Employee code': accountantFormula(`'Employee Master'!A${employeeRow}`, String(employee['Employee code'] || '')),
        Employee: accountantFormula(`'Employee Master'!B${employeeRow}`, String(employee['Legal name'] || '')),
        Division: accountantFormula(`'Employee Master'!F${employeeRow}`, String(employee.Division || '')),
        'Contract type': accountantFormula(`'Employee Master'!O${employeeRow}`, String(employee['Contract type'] || '')),
        'Contract start': accountantFormula(`'Employee Master'!P${employeeRow}`, String(employee['Contract start'] || '')),
        'Contract end': accountantFormula(`'Employee Master'!Q${employeeRow}`, String(employee['Contract end'] || '')),
        'Monthly salary (VND)': accountantFormula(`'Employee Master'!R${employeeRow}`, Number(employee['Monthly salary (VND)']) || 0, 'currency'),
        'Hourly rate (VND)': accountantFormula(`'Employee Master'!S${employeeRow}`, Number(employee['Hourly rate (VND)']) || 0, 'currency'),
        'Bank status': accountantFormula(`IF(OR('Employee Master'!AD${employeeRow}="",'Employee Master'!AE${employeeRow}=""),"MISSING","OK")`, employee.Bank && employee['Bank account'] ? 'OK' : 'MISSING'),
        Check: accountantFormula(statusFormula, employee['Employee code'] && employee['Legal name'] && (Number(employee['Monthly salary (VND)']) > 0 || Number(employee['Hourly rate (VND)']) > 0) && employee.Bank && employee['Bank account'] ? 'OK' : 'REVIEW'),
      }
    })

    const payrollFormulaRows: Array<Record<string, unknown>> = payrollRows.map((source, index) => {
      const row = index + 5
      const employee = employeeByCode.get(String(source['Employee code'] || ''))
      const calculation = employee ? staffPayrollCalculations.get(employee.profile_id) : undefined
      const sourceEmployeeCode = String(source['Employee code'] || '')
      const periodReference = historicalSnapshots.find((snapshot) => snapshot.employee_code === sourceEmployeeCode)
      const sourceMealDays = Math.max(0, Number(source['Meal days']) || 0)
      const mealPerDay = sourceMealDays > 0
        ? Math.max(0, Number(source['Meal allowance (VND)']) || 0) / sourceMealDays
        : hrSettings.lunch_allowance_vnd
      const insuranceBaseValue = Math.max(0, Number(source['Insurance base (VND)']) || 0)
      const employeeRateValue = periodReference
        ? insuranceBaseValue > 0
          ? periodReference.employee_insurance_vnd / insuranceBaseValue * 100
          : 0
        : hrSettings.employee_social_insurance_rate + hrSettings.employee_health_insurance_rate + hrSettings.employee_unemployment_insurance_rate
      const sourceEmployerRateValue = Number(source['Employer insurance %'])
      const employerRateValue = Number.isFinite(sourceEmployerRateValue)
        ? Math.max(0, sourceEmployerRateValue)
        : hrSettings.employer_social_insurance_rate + hrSettings.employer_health_insurance_rate + hrSettings.employer_unemployment_insurance_rate + hrSettings.employer_trade_union_rate
      const pitRateValue = Math.max(
        0,
        Number(periodReference?.source_payload?.pit_rate_percent) || Number(employee?.pit_withholding_rate) || 0,
      )
      const basePay = Number(source['Base pay (VND)']) || 0
      const mealAllowance = Number(source['Meal allowance (VND)']) || 0
      const overtimePay = Number(source['Overtime pay (VND)']) || 0
      const gross = Number(source['Gross income (VND)']) || 0
      const employeeInsurance = Number(source['Employee insurance (VND)']) || 0
      const pit = Number(source['PIT withheld (VND)']) || 0
      const advances = Number(source['Advances (VND)']) || 0
      const deductions = Number(source['Deductions (VND)']) || 0
      const net = Number(source['Net payable (VND)']) || 0
      const employerInsurance = Number(source['Employer insurance (VND)']) || 0
      const companyCost = Number(source['Company cost (VND)']) || gross + employerInsurance
      const taxBases = calculatePayrollTaxBases({
        grossIncome: gross,
        employeeContributions: employeeInsurance,
        mealAllowance,
        overtimePay,
        personalDeduction: hrSettings.personal_deduction_vnd,
        dependentDeduction: Math.max(0, Number(employee?.dependents_count) || 0) * hrSettings.dependent_deduction_vnd,
      })
      const sourceTaxableIncomeValue = Number(source['Taxable income (VND)'])
      const taxableIncome = source.__accountantHistoricalSource && Number.isFinite(sourceTaxableIncomeValue)
        ? Math.max(0, sourceTaxableIncomeValue)
        : taxBases.progressiveTaxableIncome
      const sourceBankTransferValue = Number(source['Bank transfer (VND)'])
      const bankTransfer = Number.isFinite(sourceBankTransferValue) ? sourceBankTransferValue : net
      const sourceBankAdjustmentValue = Number(source['Bank adjustment (VND)'])
      const bankAdjustment = Number.isFinite(sourceBankAdjustmentValue) ? sourceBankAdjustmentValue : -(advances + deductions)
      const bankTransferCheck = !source['Bank name'] || !source['Bank account']
        ? 'MISSING BANK'
        : Math.abs(bankTransfer - (net + bankAdjustment)) > 1
          ? 'CHECK TRANSFER'
          : 'OK'
      return {
        __accountantHistoricalSource: source.__accountantHistoricalSource,
        __accountantCategory: source.__accountantCategory,
        __accountantProbation: source.__accountantProbation,
        __accountantPlacement: source.__accountantPlacement,
        __accountantSkipTimesheet: source.__accountantSkipTimesheet,
        'Employee code': source['Employee code'], Employee: source.Employee, Division: source.Department,
        'Employment type': source['Employment type'], 'Contract status': source['Contract status'], Bank: source['Bank name'], 'Bank account': source['Bank account'],
        'Contract salary (VND)': source['Contract salary (VND)'], 'Configured hourly rate (VND)': source['Configured hourly rate (VND)'],
        'Payroll hourly rate (VND)': accountantFormula(`IF(I${row}>0,I${row},IF(H${row}>0,H${row}/MAX(1,K${row}),0))`, Number(source['Payroll hourly rate (VND)']) || 0, 'currency'),
        'Period standard hours': source['Period standard hours'], 'Worked hours': source['Worked hours'], 'Worked days': source['Worked days'],
        'Paid leave hours': source['Paid leave hours'], 'Paid leave days': source['Paid leave days'], 'Salary-paid hours': source['Salary-paid hours'],
        'Overtime hours': source['Overtime hours'], 'Night hours': source['Night hours'], 'Holiday hours': source['Holiday hours'],
        'Meal / worked day (VND)': mealPerDay, 'Other allowances (VND)': source['Other allowances (VND)'], 'Bonuses (VND)': source['Bonuses (VND)'],
        'Advances (VND)': advances, 'Deductions (VND)': deductions, 'Employee insurance %': employeeRateValue,
        'Employer insurance %': employerRateValue, 'PIT method': pitRateValue > 0 ? 'Employee fixed withholding' : 'Progressive PIT', 'PIT rate %': pitRateValue,
        Dependents: Math.max(0, Number(employee?.dependents_count) || 0), 'OT multiplier': hrSettings.normal_overtime_multiplier,
        'Night multiplier': hrSettings.normal_overtime_multiplier + hrSettings.night_work_bonus_rate / 100 + hrSettings.night_overtime_extra_rate / 100, 'Holiday multiplier': hrSettings.holiday_overtime_multiplier,
        'Base pay (VND)': accountantFormula(`IF(H${row}>0,ROUND(H${row}*MIN(1,P${row}/MAX(1,K${row})),0),ROUND(P${row}*J${row},0))`, basePay, 'currency'),
        'Meal days': sourceMealDays,
        'Meal allowance (VND)': accountantFormula(`ROUND(${sourceMealDays || calculation?.mealDays || 0}*T${row},0)`, mealAllowance, 'currency'),
        'Overtime pay (VND)': accountantFormula(`ROUND(MAX(0,Q${row}-R${row}-S${row})*J${row}*AD${row}+R${row}*J${row}*(AD${row}+${hrSettings.night_work_bonus_rate / 100}+${hrSettings.night_overtime_extra_rate / 100})+S${row}*J${row}*AF${row},0)`, overtimePay, 'currency'),
        'Gross income (VND)': accountantFormula(`MAX(0,SUM(AG${row}:AI${row})+U${row}+V${row})`, gross, 'currency'),
        'Insurance base (VND)': source['Insurance base (VND)'],
        'Employee insurance (VND)': accountantFormula(`ROUND(AK${row}*Y${row}/100,0)`, employeeInsurance, 'currency'),
        'Taxable income (VND)': accountantFormula(`MAX(0,AJ${row}-AL${row}-AH${row}-AI${row}-${hrSettings.personal_deduction_vnd}-AC${row}*${hrSettings.dependent_deduction_vnd})`, taxableIncome, 'currency'),
        'PIT withheld (VND)': accountantFormula(`IF('${hrSettings.personal_income_tax_enabled ? 'yes' : 'no'}'<>"yes",0,IF(AB${row}>0,ROUND(MAX(0,AJ${row}-AL${row}-AI${row})*AB${row}/100,0),ROUND(${progressivePitExcelFormula(`AM${row}`, hrSettings.pit_brackets)},0)))`, pit, 'currency'),
        'Net payable (VND)': accountantFormula(`MAX(0,AJ${row}-AL${row}-AN${row}-X${row}-W${row})`, net, 'currency'),
        'Net before adjustment (VND)': source['Net before adjustment (VND)'] ?? net,
        'Employee insurance deducted (VND)': source['Employee insurance deducted (VND)'] ?? employeeInsurance,
        'Employer insurance (VND)': accountantFormula(`ROUND(AK${row}*Z${row}/100,0)`, employerInsurance, 'currency'),
        'Company cost (VND)': accountantFormula(`MAX(0,AJ${row}+AP${row})`, companyCost, 'currency'),
        'Bank adjustment (VND)': bankAdjustment,
        'Bank transfer (VND)': accountantFormula(`AO${row}`, bankTransfer, 'currency'),
        Check: accountantFormula(`IF(OR(A${row}="",B${row}=""),"MISSING EMPLOYEE",IF(OR(F${row}="",G${row}=""),"MISSING BANK",IF(ABS(AR${row}-AO${row})>1,"CHECK TRANSFER","OK")))`, bankTransferCheck),
        Notes: source.Notes,
        'Payroll basis': source['Payroll basis'] || '',
        'Period standard days': source['Period standard days'] ?? '',
        'Salary-paid days': source['Salary-paid days'] ?? '',
      }
    })
    const payrollFirstRow = 5
    const payrollLastRow = payrollFirstRow + payrollFormulaRows.length - 1
    const formulaHeaders = Object.keys(payrollFormulaRows[0] || {})
    const payrollTotalRow = formulaHeaders.reduce<Record<string, unknown>>((row, header, index) => {
      if (header === 'Employee') row[header] = 'TOTAL'
      else if (header === 'Employee code') row[header] = ''
      else if (/hours|days|VND|income|insurance|PIT|cost|transfer|allowance|pay/i.test(header) && payrollFormulaRows.length > 0) {
        const column = excelColumnName(index + 1)
        row[header] = accountantFormula(`SUM(${column}${payrollFirstRow}:${column}${payrollLastRow})`, payrollFormulaRows.reduce((sum, item) => sum + Number((item[header] as { result?: number })?.result ?? item[header] ?? 0), 0), /VND|income|insurance|PIT|cost|transfer|allowance|pay/i.test(header) ? 'currency' : 'decimal')
      } else row[header] = ''
      return row
    }, { __xlsxRowStyle: 'total' })

    const payrollFormulaRowByEmployeeCode = new Map(
      payrollFormulaRows.map((row, index) => [String(row['Employee code'] || ''), index + payrollFirstRow]),
    )
    const historicalComparisonRows = historicalSnapshots.map((snapshot, index) => {
      const row = index + payrollFirstRow
      const payrollRow = payrollFormulaRowByEmployeeCode.get(snapshot.employee_code)
      const sourceBankTransfer = historicalSnapshotNumber(snapshot, 'bank_transfer_vnd', snapshot.net_payable_vnd)
      const calculatedGross = payrollRow ? Number((payrollFormulaRows[payrollRow - payrollFirstRow]?.['Gross income (VND)'] as { result?: number })?.result || 0) : 0
      const calculatedNet = payrollRow ? Number((payrollFormulaRows[payrollRow - payrollFirstRow]?.['Net payable (VND)'] as { result?: number })?.result || 0) : 0
      return {
        'Employee code': snapshot.employee_code,
        Employee: snapshot.employee_name,
        'Source basic days': snapshot.basic_days ?? '',
        'Source worked days': snapshot.worked_days ?? '',
        'Source worked hours': snapshot.worked_minutes === null ? '' : Number((snapshot.worked_minutes / 60).toFixed(2)),
        'Source gross (VND)': snapshot.gross_income_vnd,
        'Calculated gross (VND)': payrollRow ? accountantFormula(`'Payroll Formulas'!AJ${payrollRow}`, calculatedGross, 'currency') : 0,
        'Gross difference (VND)': accountantFormula(`G${row}-F${row}`, calculatedGross - snapshot.gross_income_vnd, 'currency'),
        'Source employee insurance (VND)': snapshot.employee_insurance_vnd,
        'Source PIT (VND)': snapshot.pit_withheld_vnd,
        'Source net (VND)': snapshot.net_payable_vnd,
        'Calculated net (VND)': payrollRow ? accountantFormula(`'Payroll Formulas'!AO${payrollRow}`, calculatedNet, 'currency') : 0,
        'Net difference (VND)': accountantFormula(`L${row}-K${row}`, calculatedNet - snapshot.net_payable_vnd, 'currency'),
        'Source bank transfer (VND)': sourceBankTransfer,
        Check: accountantFormula(`IF(ABS(H${row})<=1,"GROSS MATCH",IF(ABS(M${row})<=1,"NET MATCH","REVIEW"))`, Math.abs(calculatedGross - snapshot.gross_income_vnd) <= 1 ? 'GROSS MATCH' : Math.abs(calculatedNet - snapshot.net_payable_vnd) <= 1 ? 'NET MATCH' : 'REVIEW'),
        Notes: snapshot.details || '',
      }
    })

    const summaryRows = [
      { Metric: 'Payroll period', Value: `${periodStart} to ${periodEnd}`, Status: historicalPayrollRows.length > 0 ? 'Live calculation with imported source comparison' : 'Live HR data' },
      { Metric: 'Headcount', Value: accountantFormula(`COUNTA('Payroll Formulas'!A${payrollFirstRow}:A${payrollLastRow})`, payrollFormulaRows.length, 'integer'), Status: 'Employees included' },
      { Metric: 'Gross pay (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AJ${payrollFirstRow}:AJ${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Gross income (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'Employee insurance (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AL${payrollFirstRow}:AL${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Employee insurance (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'PIT withheld (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AN${payrollFirstRow}:AN${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['PIT withheld (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'Net payable (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AO${payrollFirstRow}:AO${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Net payable (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'Employer insurance (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AP${payrollFirstRow}:AP${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Employer insurance (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
      { Metric: 'Company cost (VND)', Value: accountantFormula(`SUM('Payroll Formulas'!AQ${payrollFirstRow}:AQ${payrollLastRow})`, payrollFormulaRows.reduce((sum, row) => sum + Number((row['Company cost (VND)'] as { result?: number }).result || 0), 0), 'currency'), Status: 'Formula total' },
    ]

    const leaveBalanceRows = payrollRows.map((source, index) => {
      const row = index + 5
      const employee = employeeByCode.get(String(source['Employee code'] || ''))
      const entitlement = employee?.contract_status === 'ended' ? 0 : hrSettings.annual_leave_days
      const used = Number(source['Paid leave days']) || 0
      return {
        'Employee code': source['Employee code'], Employee: source.Employee, Division: source.Department,
        'Employment type': source['Employment type'], 'Employment start': employee?.start_date || '', 'Contract end': employee?.contract_end_date || employee?.end_date || '',
        'Annual entitlement': entitlement, 'Paid leave used': used,
        'Closing balance': accountantFormula(`MAX(0,G${row}-H${row})`, Math.max(0, entitlement - used), 'decimal'),
        'Leave payout due (VND)': accountantFormula(`IF(F${row}<>"",ROUND(I${row}*IFERROR(VLOOKUP(A${row},'Employee Master'!A:R,18,FALSE)/${Math.max(1, Number(hrSettings.standard_monthly_days) || 26)},0),0),0)`, 0, 'currency'),
        Check: accountantFormula(`IF(A${row}="","MISSING EMPLOYEE",IF(I${row}<0,"CHECK BALANCE","OK"))`, 'OK'),
      }
    })

    const bankTransferRows = payrollFormulaRows.map((source, index) => {
      const row = index + 5
      return {
        'Employee code': accountantFormula(`'Payroll Formulas'!A${row}`, String(source['Employee code'] || '')),
        Employee: accountantFormula(`'Payroll Formulas'!B${row}`, String(source.Employee || '')),
        Bank: accountantFormula(`'Payroll Formulas'!F${row}`, String(source.Bank || '')),
        'Bank account': accountantFormula(`'Payroll Formulas'!G${row}`, String(source['Bank account'] || '')),
        'Transfer amount (VND)': accountantFormula(`'Payroll Formulas'!AR${row}`, Number((source['Bank transfer (VND)'] as { result?: number }).result || 0), 'currency'),
        Status: accountantFormula(`IF(OR(C${row}="",D${row}=""),"MISSING BANK",IF(E${row}<=0,"CHECK AMOUNT","READY"))`, source.Bank && source['Bank account'] ? 'READY' : 'MISSING BANK'),
      }
    })

    const reconciliationRows = payrollFormulaRows.map((source, index) => {
      const row = index + 5
      const net = Number((source['Net payable (VND)'] as { result?: number }).result || 0)
      return {
        'Employee code': accountantFormula(`'Payroll Formulas'!A${row}`, String(source['Employee code'] || '')),
        Employee: accountantFormula(`'Payroll Formulas'!B${row}`, String(source.Employee || '')),
        'Gross income (VND)': accountantFormula(`'Payroll Formulas'!AJ${row}`, Number((source['Gross income (VND)'] as { result?: number }).result || 0), 'currency'),
        'Employee insurance (VND)': accountantFormula(`'Payroll Formulas'!AL${row}`, Number((source['Employee insurance (VND)'] as { result?: number }).result || 0), 'currency'),
        'PIT withheld (VND)': accountantFormula(`'Payroll Formulas'!AN${row}`, Number((source['PIT withheld (VND)'] as { result?: number }).result || 0), 'currency'),
        'Net payable (VND)': accountantFormula(`'Payroll Formulas'!AO${row}`, net, 'currency'),
        'Bank transfer (VND)': accountantFormula(`'Bank Transfer'!E${row}`, net, 'currency'),
        'Difference (VND)': accountantFormula(`G${row}-F${row}`, 0, 'currency'),
        Check: accountantFormula(`IF(ABS(H${row})>1,"CHECK",IF('Bank Transfer'!F${row}<>"READY","CHECK BANK","OK"))`, source.Bank && source['Bank account'] ? 'OK' : 'CHECK BANK'),
      }
    })

    const payslipRows = payrollFormulaRows.map((source, index) => {
      const row = index + 5
      return {
        'Employee code': accountantFormula(`'Payroll Formulas'!A${row}`, String(source['Employee code'] || '')),
        Employee: accountantFormula(`'Payroll Formulas'!B${row}`, String(source.Employee || '')),
        Period: `${periodStart} to ${periodEnd}`,
        'Base pay (VND)': accountantFormula(`'Payroll Formulas'!AG${row}`, Number((source['Base pay (VND)'] as { result?: number }).result || 0), 'currency'),
        'Meal allowance (VND)': accountantFormula(`'Payroll Formulas'!AH${row}`, Number((source['Meal allowance (VND)'] as { result?: number }).result || 0), 'currency'),
        'Overtime pay (VND)': accountantFormula(`'Payroll Formulas'!AI${row}`, Number((source['Overtime pay (VND)'] as { result?: number }).result || 0), 'currency'),
        'Gross income (VND)': accountantFormula(`'Payroll Formulas'!AJ${row}`, Number((source['Gross income (VND)'] as { result?: number }).result || 0), 'currency'),
        'Employee insurance (VND)': accountantFormula(`'Payroll Formulas'!AL${row}`, Number((source['Employee insurance (VND)'] as { result?: number }).result || 0), 'currency'),
        'PIT withheld (VND)': accountantFormula(`'Payroll Formulas'!AN${row}`, Number((source['PIT withheld (VND)'] as { result?: number }).result || 0), 'currency'),
        'Net payable (VND)': accountantFormula(`'Payroll Formulas'!AO${row}`, Number((source['Net payable (VND)'] as { result?: number }).result || 0), 'currency'),
      }
    })

    const instructionRows = [
      { Step: '1', Action: 'Complete employee records', Details: 'Legal identity, contract dates, salary/rate, tax, insurance, bank, and documents are maintained in HR > Employee profiles.' },
      { Step: '2', Action: 'Publish schedules and approve attendance', Details: 'Payroll uses the selected period. Review worked time, paid leave, overtime, and missing clock-outs before export.' },
      { Step: '3', Action: 'Review payroll policy', Details: `Company policy ${hrSettings.policy_version} is effective ${hrSettings.effective_from}. Confirm legal-source and review dates in Calculation Basis before approval.` },
      { Step: '4', Action: 'Reconcile', Details: 'Contract Checks, Bank Transfer, and Reconciliation must show OK before sending the workbook.' },
      { Step: '5', Action: 'Send to accountant', Details: 'Open in Microsoft Excel and allow recalculation. Blue headers are inputs/identifiers; calculated payroll values contain live formulas.' },
      { Step: 'Policy', Action: '2026 Vietnam PIT', Details: 'Progressive bands: 5% to 10M, 10% to 30M, 20% to 60M, 30% to 100M, 35% above 100M; self deduction 15.5M and dependent deduction 6.2M.' },
      { Step: 'Control', Action: 'Source workbook', Details: 'Functional specification: VR_Payroll_July_2026_Emile_V2. The app export is normalized for human HR and accountant review.' },
    ]

    const historicalComparisonSheets = historicalSnapshots.length > 0
      ? [
          { title: 'Source Payroll', description: 'Protected source payroll imported from the authoritative workbook. These values are reference inputs, not the live calculation.', rows: historicalPayrollRows },
          { title: 'Source Comparison', description: 'Employee-by-employee comparison between the timesheet-based live calculation and the authoritative source payroll.', rows: historicalComparisonRows },
        ]
      : []

    // Keep the normalized audit tables available while the exact accountant-template
    // export is the active download path. They remain useful for parity checks and a
    // controlled fallback without changing the workbook handed to the accountant.
    void [paidLeaveRows, adjustmentRows, contractCheckRows, payrollTotalRow, summaryRows, leaveBalanceRows, bankTransferRows, reconciliationRows, payslipRows, instructionRows, historicalComparisonSheets]

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const accessToken = sessionData.session?.access_token || ''
      const { submitAccountantPayrollDownload } = await import('../lib/accountantPayrollBrowserDownload')
      submitAccountantPayrollDownload({
        accessToken,
        operatorToken: getStaffKioskOperatorToken(),
        filename: `vrena-payroll-${periodStart}-${periodEnd}.xlsx`,
        input: {
          periodStart,
          periodEnd,
          ...(historicalSourceKey ? {
            sourceWorkbookKey: historicalSourceKey,
            sourceWorkbookRowCount: historicalSnapshots.length,
          } : {}),
          payrollRows: payrollFormulaRows,
          employeeRows: exportEmployeeRows,
          attendanceRows,
          calculationBasisRows,
        },
      })
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
      return false
    }
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
      half_day_enabled: Boolean(attendanceSettings.half_day_enabled),
      half_day_min_minutes: minutesSetting(attendanceSettings.half_day_min_minutes, 0),
      half_day_max_minutes: Math.max(
        minutesSetting(attendanceSettings.half_day_min_minutes, 0),
        minutesSetting(attendanceSettings.half_day_max_minutes, 270),
      ),
      count_late_early_on_half_day: Boolean(attendanceSettings.count_late_early_on_half_day),
      late_arrival_enabled: Boolean(attendanceSettings.late_arrival_enabled),
      late_after_minutes: Math.min(240, minutesSetting(attendanceSettings.late_after_minutes, 5)),
      early_leave_enabled: Boolean(attendanceSettings.early_leave_enabled),
      early_leave_before_minutes: Math.min(240, minutesSetting(attendanceSettings.early_leave_before_minutes, 5)),
      overtime_before_shift_enabled: Boolean(attendanceSettings.overtime_before_shift_enabled),
      overtime_before_shift_minutes: Math.min(240, minutesSetting(attendanceSettings.overtime_before_shift_minutes, 10)),
      overtime_after_shift_enabled: Boolean(attendanceSettings.overtime_after_shift_enabled),
      overtime_after_shift_minutes: Math.min(240, minutesSetting(attendanceSettings.overtime_after_shift_minutes, 10)),
      single_clock_for_consecutive_shifts: Boolean(attendanceSettings.single_clock_for_consecutive_shifts),
      work_week_start: Math.min(6, Math.max(0, Math.round(Number(attendanceSettings.work_week_start) || 0))),
      weekly_rest_days: attendanceSettings.weekly_rest_days,
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
        date: updatedOrder.booking_date,
        time: normalizeTime(updatedOrder.booking_time),
        total: updatedOrder.total,
        summary: patch.order_status === 'cancelled'
          ? 'Booking order was changed to cancelled.'
          : 'Booking order details were edited.',
        changes: orderChanges(order, patch, games),
      })
      markStaffDataStale('today', 'orders', 'report')
      if (currentTab === 'today') await loadTodayOrders(true)
      if (currentTab === 'orders') await loadRecentOrders(true)
      if (currentTab === 'report') await loadReportData(true)
    }
    setSaving(false)
  }

  function beginOrderEdit(order: StaffOrder) {
    if (!canCreateOrders || saving) return
    setOrderEditDraft(staffOrderEditDraft(order))
    setOrderEditError('')
    setStatus('')
  }

  function patchOrderEditDraft(patch: Partial<StaffOrderEditDraft>) {
    setOrderEditDraft((current) => current ? { ...current, ...patch } : current)
    setOrderEditError('')
  }

  function cancelOrderEdit() {
    if (saving) return
    setOrderEditDraft(null)
    setOrderEditError('')
  }

  async function saveOrderEdit(order: StaffOrder) {
    if (!canCreateOrders || saving || orderEditDraft?.orderId !== order.id) return

    const selectedGame = games.find((game) => game.id === orderEditDraft.gameId)
    const nextTotal = Number(orderEditDraft.total)
    if (
      !selectedGame
      || !orderEditDraft.bookingDate
      || !orderEditDraft.bookingTime
      || !Number.isInteger(nextTotal)
      || nextTotal < 0
    ) {
      setOrderEditError(text.messages.orderEditInvalid)
      return
    }

    setSaving(true)
    setOrderEditError('')
    setStatus('')

    try {
      const { data, error } = await supabase.rpc('staff_update_order_operation', {
        p_booking_date: orderEditDraft.bookingDate,
        p_booking_time: orderEditDraft.bookingTime,
        p_game_id: selectedGame.id,
        p_order_id: order.id,
        p_total: nextTotal,
      })
      if (error) throw error

      const patch: Partial<StaffOrder> = {
        booking_date: orderEditDraft.bookingDate,
        booking_time: orderEditDraft.bookingTime,
        game_id: selectedGame.id,
        subtotal: nextTotal + order.discount_total,
        total: nextTotal,
      }
      const returnedOrder = data && typeof data === 'object' && !Array.isArray(data)
        ? data as Partial<StaffOrder>
        : null
      const updatedOrder = { ...order, ...patch, ...(returnedOrder || {}) }

      setOrders((items) => items.map((item) => item.id === order.id ? updatedOrder : item))
      if (order.session_id) {
        setOperationSessions((items) => items.map((session) => session.id === order.session_id
          ? {
              ...session,
              confirmed_game_id: selectedGame.slug,
              date: orderEditDraft.bookingDate,
              start_time: orderEditDraft.bookingTime,
              ticket_total_price: session.booking_type === 'ticket' ? nextTotal : session.ticket_total_price,
            }
          : session))
      }

      setOrderEditDraft(null)
      setStatus(text.messages.orderUpdated)
      const linkedSession = operationSessions.find((session) => session.id === order.session_id) || null
      void sendStaffBookingUpdateNotification(linkedSession, updatedOrder, {
        action: 'edited',
        title: linkedSession?.name || 'Ticket booking',
        reference: order.order_number,
        date: updatedOrder.booking_date,
        time: normalizeTime(updatedOrder.booking_time),
        total: updatedOrder.total,
        summary: 'Booking order game, schedule, or total was edited.',
        changes: orderChanges(order, patch, games),
      })
      markStaffDataStale('today', 'orders', 'report')
      if (currentTab === 'today') await Promise.all([loadTodayOrders(true), loadTodaySessions(true)])
      if (currentTab === 'orders') await loadRecentOrders(true)
      if (currentTab === 'report') await loadReportData(true)
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : String(error)
      setOrderEditError(message)
      setStatus(message)
    } finally {
      setSaving(false)
    }
  }

  async function createCustomerAccount() {
    if (!canCreateCustomerAccounts || isCustomerInviteSaving) return

    const fullName = customerInviteForm.fullName.trim()
    const email = customerInviteForm.email.trim()
    const nickname = customerInviteForm.nickname.trim()
    const phone = normalizePhonePasswordIdentifier(customerInviteForm.phone)
    const phoneAccount = !email
    if (!fullName) {
      setCustomerInviteStatus(text.messages.customerAccountNameRequired)
      return
    }
    if (phoneAccount && !phone) {
      setCustomerInviteStatus(text.messages.customerAccountPhoneRequired)
      return
    }
    if (!nickname) {
      setCustomerInviteStatus(text.messages.customerAccountNicknameRequired)
      return
    }
    setIsCustomerInviteSaving(true)
    setCustomerInviteStatus('')
    setCustomerTemporaryAccess(null)
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
          ...(getStaffKioskOperatorToken() ? { [STAFF_KIOSK_HEADER]: getStaffKioskOperatorToken() } : {}),
        },
        body: JSON.stringify({
          fullName,
          email: email || null,
          phone: phone || customerInviteForm.phone.trim(),
          nickname,
        }),
      })
      const payload = await response.json().catch(() => ({})) as {
        error?: string
        message?: string
        temporaryPassword?: string | null
        temporaryPasswordExpiresAt?: string | null
      }
      if (!response.ok) {
        const message = response.status === 409 && /nickname/i.test(payload.error || '')
          ? text.messages.customerAccountNicknameTaken
          : payload.error || 'Could not create customer account.'
        throw new Error(message)
      }

      if (phoneAccount && payload.temporaryPassword && payload.temporaryPasswordExpiresAt) {
        setCustomerTemporaryAccess({
          expiresAt: payload.temporaryPasswordExpiresAt,
          password: payload.temporaryPassword,
          phone,
        })
      }

      setCustomerInviteForm(defaultCustomerInviteForm())
      const successMessage = phoneAccount
        ? text.messages.customerAccountPhoneCreated
        : text.messages.customerAccountInvited
      setCustomerInviteStatus(successMessage)
      setStatus(successMessage)
      markStaffDataStale('profiles')
      await loadProfiles(true)
    } catch (error) {
      setCustomerInviteStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setIsCustomerInviteSaving(false)
    }
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

  function selectReportView(nextView: StaffReportView) {
    setReportView(nextView)
    if (nextView !== 'business' && reportStart === todayString() && reportEnd === todayString()) {
      setReportStart(addDays(todayString(), -29))
      setReportEnd(todayString())
    }
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

  async function runReportExport(kind: 'excel' | 'pdf' | 'accountant', task: () => Promise<void>) {
    if (reportExporting) return
    setReportExporting(kind)
    setReportExportFeedback(null)
    try {
      await task()
      setReportExportFeedback({ message: text.messages.reportDownloadStarted, tone: 'success' })
    } catch (error) {
      console.error('Staff report export failed', error)
      setReportExportFeedback({ message: text.messages.reportDownloadFailed, tone: 'error' })
    } finally {
      setReportExporting(null)
    }
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
        throw error
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
    const { accountantAttachmentRows, accountantExportInfoRows, buildAccountantExportRows } = await import('../lib/staffAccountantExportRows')
    const rows = buildAccountantExportRows(reportDefinition.id, exportContext)
    const suffix = `${reportStart}_${reportEnd}`
    if (accountantExportFormat === 'csv') {
      await downloadCsv(`${reportDefinition.fileBase}_${suffix}.csv`, rows, exportText)
      return
    }
    const workbookSections = [
      { title: reportTitle, rows },
      {
        title: accountantExportLanguage === 'vi' ? 'Thông tin xuất file' : 'Export info',
        rows: accountantExportInfoRows(reportTitle, exportContext),
      },
    ]
    if (accountantIncludeAttachments) {
      workbookSections.push({
        title: exportText.labels.attachmentList,
        rows: accountantAttachmentRows(exportContext),
      })
    }
    await downloadExcel(`${reportDefinition.fileBase}_${suffix}.xlsx`, workbookSections, exportText)
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
          {rows.map((order) => {
            const draft = orderEditDraft?.orderId === order.id ? orderEditDraft : null
            const isEditing = Boolean(draft)
            const gameName = games.find((game) => game.id === order.game_id)?.name || text.gameFallback
            return (
              <Fragment key={order.id}>
                <tr className={isEditing ? 'staff-order-row editing' : 'staff-order-row'}>
                  <td><strong>{order.order_number}</strong></td>
                  <td>{order.customer_name || order.customer_phone || order.customer_email || text.walkIn}</td>
                  <td className="staff-order-editable-cell">
                    {draft ? (
                      <select
                        aria-label={text.labels.game}
                        disabled={saving}
                        value={draft.gameId}
                        onChange={(event) => patchOrderEditDraft({ gameId: event.target.value })}
                      >
                        <option value="">{text.noneYet}</option>
                        {games.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
                      </select>
                    ) : canCreateOrders ? (
                      <button
                        aria-label={`${text.actions.edit} ${text.labels.game}: ${gameName}`}
                        className="staff-order-edit-trigger"
                        type="button"
                        onClick={() => beginOrderEdit(order)}
                      >
                        {gameName}
                        <Pencil aria-hidden="true" size={12} />
                      </button>
                    ) : gameName}
                  </td>
                  <td className="staff-order-editable-cell staff-order-date-cell">
                    {draft ? (
                      <div className="staff-order-date-fields">
                        <input
                          aria-label={text.aria.bookingDate}
                          disabled={saving}
                          type="date"
                          value={draft.bookingDate}
                          onChange={(event) => patchOrderEditDraft({ bookingDate: event.target.value })}
                        />
                        <input
                          aria-label={text.aria.bookingTime}
                          disabled={saving}
                          type="time"
                          value={draft.bookingTime}
                          onChange={(event) => patchOrderEditDraft({ bookingTime: event.target.value })}
                        />
                      </div>
                    ) : canCreateOrders ? (
                      <button
                        aria-label={`${text.actions.edit} ${text.labels.date}: ${staffDateLabel(order.booking_date)} ${normalizeTime(order.booking_time)}`}
                        className="staff-order-edit-trigger"
                        type="button"
                        onClick={() => beginOrderEdit(order)}
                      >
                        {staffDateLabel(order.booking_date)} · {normalizeTime(order.booking_time)}
                        <Pencil aria-hidden="true" size={12} />
                      </button>
                    ) : `${staffDateLabel(order.booking_date)} · ${normalizeTime(order.booking_time)}`}
                  </td>
                  <td className="staff-order-editable-cell">
                    {draft ? (
                      <label className="staff-order-total-field">
                        <input
                          aria-label={text.labels.total}
                          disabled={saving}
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          type="number"
                          value={draft.total}
                          onChange={(event) => patchOrderEditDraft({ total: event.target.value })}
                        />
                        <span>₫</span>
                      </label>
                    ) : canCreateOrders ? (
                      <button
                        aria-label={`${text.actions.edit} ${text.labels.total}: ${formatVnd(order.total)}`}
                        className="staff-order-edit-trigger"
                        type="button"
                        onClick={() => beginOrderEdit(order)}
                      >
                        {formatVnd(order.total)}
                        <Pencil aria-hidden="true" size={12} />
                      </button>
                    ) : formatVnd(order.total)}
                  </td>
                  <td>{orderPaymentLabel(order, paymentsByOrderId, text)}<br /><span>{paymentStatusLabel(order.payment_status, text)}</span></td>
                  <td>{text.orderStatuses[order.order_status]}</td>
                  {canCreateOrders && (
                    <td>
                      <div className="staff-row-actions">
                        {isEditing ? (
                          <>
                            <button className="primary" disabled={saving} type="button" onClick={() => saveOrderEdit(order)}>
                              <ButtonIconText icon={<Save aria-hidden="true" size={14} />}>{text.actions.save}</ButtonIconText>
                            </button>
                            <button className="secondary" disabled={saving} type="button" onClick={cancelOrderEdit}>
                              <ButtonIconText icon={<X aria-hidden="true" size={14} />}>{text.actions.cancel}</ButtonIconText>
                            </button>
                          </>
                        ) : (
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
                      </div>
                    </td>
                  )}
                </tr>
                {isEditing && orderEditError && (
                  <tr className="staff-order-edit-error-row">
                    <td colSpan={canCreateOrders ? 8 : 7}>{orderEditError}</td>
                  </tr>
                )}
              </Fragment>
            )
          })}
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
              <label className="checkbox-row staff-guest-booking-toggle full">
                <input
                  checked={booking.guestBooking}
                  type="checkbox"
                  onChange={(event) => setGuestBooking(event.target.checked)}
                />
                <span className="staff-guest-booking-copy">
                  <strong>{text.labels.guestBooking}</strong>
                  <small>{text.messages.guestBookingHelp}</small>
                </span>
              </label>
              <label>
                {text.labels.customerProfile}
                <select disabled={booking.guestBooking} value={booking.customerId} onChange={(event) => applyCustomer(event.target.value)}>
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
                  aria-controls={!booking.guestBooking && showCustomerNameSuggestions ? 'staff-customer-name-suggestions' : undefined}
                  aria-expanded={!booking.guestBooking && showCustomerNameSuggestions}
                  disabled={booking.guestBooking}
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
                  disabled={booking.guestBooking}
                  inputLabel={text.labels.phone}
                  onChange={(phone) => setBooking({ ...booking, customerPhone: phone })}
                  searchPlaceholder={sharedText.searchCountry}
                  value={booking.customerPhone}
                />
              </label>
              <label>
                {text.labels.email}
                <input disabled={booking.guestBooking} value={booking.customerEmail} onChange={(event) => setBooking({ ...booking, customerEmail: event.target.value })} />
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
              <span>{text.labels.customer}</span><strong>{booking.guestBooking ? text.labels.guestBooking : booking.customerName || text.walkIn}</strong>
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

          </div>

          <details className="staff-operations-money">
            <summary>
              <strong>{text.operationsMoney.title}: {formatVnd(operationSummary.money.bookingValue)}</strong>
              <span>{operationSummary.money.unlinkedCount > 0
                ? `${text.operationsMoney.needsOrder}: ${operationSummary.money.unlinkedCount}`
                : text.operationsMoney.clear}</span>
            </summary>
            <div className="staff-summary-grid staff-operations-money-grid">
              {(['bookingValue', 'orderTotal', 'orderPaid', 'orderBalance', 'pendingValue', 'unlinkedValue'] as const).map((key) => (
                <div key={key}><span>{text.operationsMoney[key]}</span><strong>{formatVnd(operationSummary.money[key])}</strong></div>
              ))}
            </div>
            <p>{text.operationsMoney.hint}</p>
            {operationSessionScope === 'past' && <p>{text.operationsMoney.past}</p>}
          </details>

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
                      {session.venue_key === 'cafe-des-stagiaires' && <span>VRena Café des Stagiaires</span>}
                    </div>
                    <div className="staff-operation-meta">
                      <span>{sessionGameName(session, games, text)}</span>
                      <span>{session.duration_minutes} min</span>
                      <span>{text.labels.capacity}: {sessionBookedPlayers(session, order)}/{sessionCapacity(session, order)}</span>
                      <span>{text.labels.checkIns}: {sessionCheckedInCount(session)}/{Math.max(participants.length, sessionCheckedInCount(session))}</span>
                      <span>{text.labels.payment}: {paymentLabel}</span>
                      {!order && operationSummary.money.unlinkedSessionIds.includes(session.id) && (
                        <strong className="staff-operation-reconcile">{text.operationsMoney.needsOrder}</strong>
                      )}
                      {!order && session.ticket_status === 'pending' && (
                        <strong>{text.operationsMoney.pending}</strong>
                      )}
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
                                  <label>{text.labels.projectiles}<input defaultValue={participant.hits ?? participant.projectiles_fired ?? ''} disabled={!canCreateOrders || saving} inputMode="numeric" onBlur={(event) => updateOperationParticipant(session, participant, { hits: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                                  <label>{text.labels.movement}<input defaultValue={participant.movement_meters ?? ''} disabled={!canCreateOrders || saving} inputMode="decimal" onBlur={(event) => updateOperationParticipant(session, participant, { movement_meters: event.target.value === '' ? null : Number(event.target.value) })} /></label>
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
            approveAttendancePeriod,
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
            canAccessHrSettings,
            canAccessZaloSettings,
            canManageEmployeeKioskPins,
            canManageAttendance,
            customerName,
            dateFromInput,
            dongDigits,
            downloadEmployeePayslip,
            downloadPayrollExcel,
            draggingShiftId,
            draftShiftCount,
            effectiveAttendanceScheduleScope,
            effectiveShiftTemplates,
            editEmployeeProfile,
            editShift,
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
            employeeFormForProfile,
            employeePayrollSummary,
            employeeProfileById,
            emptyStaffPayrollCalculation,
            filteredHrStaffProfiles,
            firstEmployeeStaffProfileId,
            firstScheduleStaffProfileId,
            formatDongInput,
            formatVnd,
            formatVndCompact,
            generateEmployeeKioskPin,
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
            hrSetupOptions,
            hrStatusFilter,
            hrTab,
            isOwnerOrAdmin,
            isPaidLeaveForEmployee,
            canRevealEmployeeKioskPin,
            leaveHoursInsidePeriod,
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
            costAssignments,
            reloadCostAssignments: () => loadHrData(true),
            staffCostAllocations,
            saveEmployeeProfile,
            saveHrAdjustment,
            saveHrSettings,
            saveHrSetupOption,
            updateHrSetupOption,
            setHrSetupOptionActive,
            saveAttendanceSettings,
            saveShift,
            saving,
            sendEmployeeKioskPinEmail,
            selectedEmployeeDocuments,
            selectedEmployeeOutstandingDebt,
            selectedEmployeeStaffId,
            selectedEmployeeStaffProfile,
            selectedShiftTemplate,
            setEmployeeForm,
            setEmployeeKioskAccessRole,
            setEmployeeKioskPin,
            setEmployeeKioskPinConfirm,
            setAttendanceScheduleScope,
            setAttendanceSettings,
            setAttendanceRange,
            setDraggingShiftId,
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
            syncPayrollDraft,
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
        <div className="staff-client-profile-page">
          {canCreateCustomerAccounts && (
          <div className="staff-card staff-card-wide staff-customer-invite-panel">
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
                <span className="staff-field-label">{text.labels.email} ({text.labels.optional})</span>
                <input
                  autoComplete="email"
                  type="email"
                  value={customerInviteForm.email}
                  onChange={(event) => setCustomerInviteForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="customer@example.com"
                />
              </label>
              <label>
                <span className="staff-field-label">
                  {text.labels.phone}{!customerInviteForm.email.trim() ? ' *' : ` (${text.labels.optional})`}
                </span>
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
                <span className="staff-field-label">{text.labels.nickname} *</span>
                <input
                  value={customerInviteForm.nickname}
                  onChange={(event) => setCustomerInviteForm((current) => ({ ...current, nickname: event.target.value }))}
                  placeholder="Phantom"
                />
              </label>
              {!customerInviteForm.email.trim() && (
                <div className="staff-customer-phone-account-setup">
                  <p>{text.labels.customerAccountPhonePasswordHelp}</p>
                </div>
              )}
              <button
                className={isCustomerInviteSaving ? 'primary loading' : 'primary'}
                disabled={isCustomerInviteSaving}
                type="button"
                onClick={createCustomerAccount}
              >
                {customerInviteForm.email.trim()
                  ? text.actions.sendPasswordRequest
                  : text.actions.createPhoneAccount}
              </button>
            </div>
            {customerInviteStatus && <p className="notice compact-notice">{customerInviteStatus}</p>}
            {customerTemporaryAccess && (
              <div className="staff-customer-temporary-access" role="status">
                <span>{text.labels.customerTemporaryPassword}</span>
                <strong>{customerTemporaryAccess.password}</strong>
                <small>{customerTemporaryAccess.phone} · {new Date(customerTemporaryAccess.expiresAt).toLocaleString(resolvedLanguage)}</small>
                <p>{text.labels.customerTemporaryPasswordHelp}</p>
                <button
                  className="secondary small-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(customerTemporaryAccess.password)
                      setCustomerInviteStatus(text.messages.customerTemporaryPasswordCopied)
                    } catch {
                      setCustomerInviteStatus(customerTemporaryAccess.password)
                    }
                  }}
                  type="button"
                >
                  {text.actions.copyTemporaryPassword}
                </button>
              </div>
            )}
          </div>
          )}
          {canAwardAchievements && (
            <div className="staff-card staff-card-wide">
              <StaffPlayerAchievementProfile
                awards={achievementAwards}
                language={resolvedLanguage}
                onDirtyChange={setClientProfileDirty}
                onRefreshAwards={async () => {
                  markStaffDataStale('achievementAwards')
                  await loadAchievementAwards(true)
                }}
                profiles={awardableProfiles}
                profilesLoading={Boolean(loadingData.profiles)}
                text={sharedText}
              />
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
              const sharedKioskAccount = requiresStaffKioskPin(item.email)
              const rowFeedback = roleSaveFeedback[item.id]
              const rolePersonContent = (
                <>
                  <StaffRoleAvatar profile={item} text={text} />
                  <span className="staff-role-person-text">
                    <strong>{customerName(item, text)}</strong>
                    <span>{item.email || item.phone || text.noContact} · {text.labels.current} {staffRoleName(effectiveRole, text)}</span>
                    {protectedEmail && <small>{text.emailOverrideKeepsAdmin}</small>}
                    {sharedKioskAccount && <small>{text.sharedKioskRoleProtected}</small>}
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
                        disabled={!canManageRoles || saving || sharedKioskAccount}
                        value={selectedRole}
                        onChange={(event) => stageProfileRole(item.id, storedRole, event.target.value as StaffRole)}
                      >
                        {([
                          ...(storedRole === 'employee' ? ['employee' as StaffRole] : []),
                          ...assignableWebAppRoleOptions,
                        ]).filter((option) => (
                          canRestoreDeleted || option !== 'owner' || option === storedRole
                        )).map((option) => (
                          <option disabled={option === 'employee'} key={option} value={option}>{staffRoleName(option, text)}</option>
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

      {currentTab === 'orders' && (
        <div className="staff-card">
          <h3>{text.labels.orders}</h3>
          {orderRows(orders)}
        </div>
      )}

      {currentTab === 'report' && (
        <div className="staff-card staff-report-workspace">
          <div className="staff-report-head">
            <div className="staff-report-view-tabs" role="tablist" aria-label={resolvedLanguage === 'vi' ? 'Chế độ báo cáo' : 'Report view'}>
              <button
                aria-selected={reportView === 'business'}
                className={reportView === 'business' ? 'active' : ''}
                role="tab"
                type="button"
                onClick={() => selectReportView('business')}
              >
                {resolvedLanguage === 'vi' ? 'Kinh doanh' : 'Business performance'}
              </button>
              <button
                aria-selected={reportView === 'players'}
                className={reportView === 'players' ? 'active' : ''}
                role="tab"
                type="button"
                onClick={() => selectReportView('players')}
              >
                {resolvedLanguage === 'vi' ? 'Hành vi người chơi' : 'Player behavior'}
              </button>
              <button
                aria-selected={reportView === 'qr'}
                className={reportView === 'qr' ? 'active' : ''}
                role="tab"
                type="button"
                onClick={() => selectReportView('qr')}
              >
                {resolvedLanguage === 'vi' ? 'Phân tích QR' : 'QR analytics'}
              </button>
            </div>
            <div className="staff-report-filters">
              <div className="staff-report-filter-row">
                <section className="staff-report-control-group staff-report-range-group" aria-label={text.labels.reportRange}>
                  <header className="staff-report-control-head">
                    <span className="staff-report-control-title">
                      <CalendarRange aria-hidden="true" size={15} />
                      {text.labels.reportRange}
                    </span>
                    <strong>{rangeLabel(reportStart, reportEnd)}</strong>
                  </header>
                  <div className="staff-report-date-actions">
                    <button
                      aria-pressed={activeReportPreset === 'today'}
                      className={activeReportPreset === 'today' ? 'active' : ''}
                      type="button"
                      onClick={() => {
                        setReportStart(todayReportStart)
                        setReportEnd(todayReportEnd)
                      }}
                    >
                      <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>{text.actions.today}</ButtonIconText>
                    </button>
                    <button
                      aria-pressed={activeReportPreset === secondaryReportPreset}
                      className={activeReportPreset === secondaryReportPreset ? 'active' : ''}
                      type="button"
                      onClick={() => {
                        setReportStart(secondaryReportStart)
                        setReportEnd(secondaryReportEnd)
                      }}
                    >
                      <ButtonIconText icon={<CalendarDays aria-hidden="true" size={14} />}>
                        {reportView === 'business' ? text.actions.yesterday : text.reportRangePresets.last_30}
                      </ButtonIconText>
                    </button>
                    <button
                      aria-pressed={activeReportPreset === 'custom'}
                      className={activeReportPreset === 'custom' ? 'staff-report-range-button active' : 'staff-report-range-button'}
                      type="button"
                      onClick={() => {
                        setReportDatePickerTarget('report')
                        setReportDatePickerOpen(true)
                      }}
                    >
                      <span><CalendarRange aria-hidden="true" size={14} /> {text.labels.dateRange}</span>
                      <strong>{rangeLabel(reportStart, reportEnd)}</strong>
                    </button>
                  </div>
                </section>
                <section className={compareEnabled ? 'staff-report-control-group staff-report-comparison-group active' : 'staff-report-control-group staff-report-comparison-group'} aria-label={text.labels.compareRange}>
                  <header className="staff-report-control-head">
                    <span className="staff-report-control-title">
                      <RotateCcw aria-hidden="true" size={15} />
                      {text.labels.compare}
                    </span>
                    <strong>{compareEnabled ? rangeLabel(compareStart, compareEnd) : text.compareOff}</strong>
                  </header>
                  <div className="staff-report-compare-actions">
                    <button
                      aria-pressed={isPreviousPeriodComparison}
                      className={isPreviousPeriodComparison ? 'active' : ''}
                      type="button"
                      onClick={applyPreviousPeriodComparison}
                    >
                      <ButtonIconText icon={<RotateCcw aria-hidden="true" size={14} />}>{text.actions.previousPeriod}</ButtonIconText>
                    </button>
                    <label className={compareEnabled ? 'staff-compare-toggle active' : 'staff-compare-toggle'}>
                      <input type="checkbox" checked={compareEnabled} onChange={(event) => setCompareEnabled(event.target.checked)} />
                      <span className="staff-compare-switch" aria-hidden="true" />
                      <span>{text.labels.compare}</span>
                    </label>
                  </div>
                </section>
                {reportView === 'business' && <div className="staff-report-export-actions">
                  <button
                    aria-busy={reportExporting === 'excel'}
                    disabled={reportExporting !== null}
                    type="button"
                    onClick={() => { void runReportExport('excel', exportExcelReport) }}
                  >
                    <ButtonIconText icon={<FileSpreadsheet aria-hidden="true" size={14} />}>{reportExporting === 'excel' ? text.actions.preparingDownload : text.actions.excel}</ButtonIconText>
                  </button>
                  <button
                    aria-busy={reportExporting === 'pdf'}
                    disabled={reportExporting !== null}
                    type="button"
                    onClick={() => { void runReportExport('pdf', exportPdfReport) }}
                  >
                    <ButtonIconText icon={<FileText aria-hidden="true" size={14} />}>{reportExporting === 'pdf' ? text.actions.preparingDownload : text.actions.pdf}</ButtonIconText>
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
                            <select value={accountantExportFormat} onChange={(event) => {
                              const nextFormat = event.target.value as AccountantExportFormat
                              setAccountantExportFormat(nextFormat)
                              if (nextFormat === 'csv') setAccountantIncludeAttachments(false)
                            }}>
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
                              disabled={accountantExportFormat === 'csv'}
                              onChange={(event) => setAccountantIncludeAttachments(event.target.checked)}
                            />
                            <span>
                              {text.labels.includeAttachments}
                              {accountantExportFormat === 'csv' && <small>{text.messages.accountantAttachmentsExcelOnly}</small>}
                            </span>
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
                        <button
                          aria-busy={reportExporting === 'accountant'}
                          className="primary staff-accountant-download"
                          disabled={reportExporting !== null}
                          type="button"
                          onClick={() => { void runReportExport('accountant', downloadAccountantExport) }}
                        >
                          <ButtonIconText icon={<Download aria-hidden="true" size={15} />}>{reportExporting === 'accountant' ? text.actions.preparingDownload : text.actions.download}</ButtonIconText>
                        </button>
                      </div>
                    )}
                  </div>
                  {reportExportFeedback && (
                    <span className={`staff-report-export-feedback ${reportExportFeedback.tone}`} role="status">
                      {reportExportFeedback.message}
                    </span>
                  )}
                </div>}
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
          {reportView === 'business' ? (
          <>
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
          </>
          ) : reportView === 'players' ? (
            <StaffPlayerInsights
              compareEnabled={compareEnabled}
              compareLabel={rangeLabel(compareStart, compareEnd)}
              data={playerInsightsSnapshot}
              language={resolvedLanguage}
              loading={Boolean(loadingData.report)}
              rangeLabel={rangeLabel(reportStart, reportEnd)}
            />
          ) : (
            <StaffQrAnalytics
              compareEnabled={compareEnabled}
              compareLabel={rangeLabel(compareStart, compareEnd)}
              data={qrAnalyticsSnapshot}
              error={qrAnalyticsError}
              language={resolvedLanguage}
              loading={Boolean(loadingData.qrReport)}
              rangeLabel={rangeLabel(reportStart, reportEnd)}
            />
          )}
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
