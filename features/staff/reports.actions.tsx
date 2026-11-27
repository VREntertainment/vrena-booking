'use client'

import type { StaffReportView } from '../../lib/staff/types'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  addDays,
  orderedRange,
  previousPeriodRange,
  todayString
} from '../../lib/staff/dates'

export type ReportsActionContext = {
  setGames: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffGame[]>>
  loadedDataRef: React.RefObject<Partial<Record<import("../../lib/staff/types").StaffDataKey, boolean>>>
  reportStart: string
  reportEnd: string
  compareStart: string
  compareEnd: string
  compareEnabled: boolean
  fetchOrderPayments: (orderRows: import("../../lib/staff/types").StaffOrder[]) => Promise<import("../../lib/staff/types").StaffOrderPayment[]>
  setReportSnapshot: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffReportSnapshot | null>>
  text: StaffConsoleCopy
  runStaffLoader: (key: import("../../lib/staff/types").StaffDataKey, loader: () => Promise<void>, force?: boolean) => Promise<void>
  setQrAnalyticsError: React.Dispatch<React.SetStateAction<string>>
  setQrAnalyticsSnapshot: React.Dispatch<React.SetStateAction<import("../../components/StaffQrAnalytics").StaffQrAnalyticsSnapshot | null>>
  setCompareStart: React.Dispatch<React.SetStateAction<string>>
  setCompareEnd: React.Dispatch<React.SetStateAction<string>>
  setCompareEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setReportView: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffReportView>>
  setReportStart: React.Dispatch<React.SetStateAction<string>>
  setReportEnd: React.Dispatch<React.SetStateAction<string>>
  setReportDatePickerOpen: React.Dispatch<React.SetStateAction<boolean>>
  report: import("../../lib/staff/types").StaffReportSummary
  reportOrders: import("../../lib/staff/types").StaffOrder[]
  games: import("../../lib/staff/types").StaffGame[]
  reportPaymentsByOrderId: Map<string, import("../../lib/staff/types").StaffOrderPayment[]>
  reportExporting: "excel" | "pdf" | "accountant" | null
  setReportExporting: React.Dispatch<React.SetStateAction<"excel" | "pdf" | "accountant" | null>>
  setReportExportFeedback: React.Dispatch<React.SetStateAction<{ message: string; tone: "error" | "success" } | null>>
  accountantReportId: import("../../lib/staff/types").AccountantExportReportId
  accountantExportStore: string
  accountantExportLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  fetchAuditLogs: (limit?: number) => Promise<import("../../lib/staff/types").StaffAuditLog[]>
  discounts: import("../../lib/staff/types").StaffDiscount[]
  loyaltyRules: import("../../lib/staff/types").StaffLoyaltyRule[]
  accountantIncludeAttachments: boolean
  accountantExportFormat: import("../../lib/staff/types").AccountantExportFormat
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffReportsActions(getContext: () => ReportsActionContext) {
  async function loadReportFallback() {
    const context = getContext()
    const { createStaffReportLoadActions } = await import('./reportLoad.actions')
    await createStaffReportLoadActions(() => context).loadReportFallback()
  }

  async function loadReportData(force = false) {
    const context = getContext()
    const { createStaffReportLoadActions } = await import('./reportLoad.actions')
    await createStaffReportLoadActions(() => context).loadReportData(force)
  }

  async function loadQrAnalytics(force = false) {
    const context = getContext()
    const { createStaffReportLoadActions } = await import('./reportLoad.actions')
    await createStaffReportLoadActions(() => context).loadQrAnalytics(force)
  }

  function applyPreviousPeriodComparison() {
    const { reportStart, reportEnd, setCompareStart, setCompareEnd, setCompareEnabled } = getContext()

    const [previousStart, previousEnd] = previousPeriodRange(reportStart, reportEnd)
    setCompareStart(previousStart)
    setCompareEnd(previousEnd)
    setCompareEnabled(true)
  }

  function selectReportView(nextView: StaffReportView) {
    const { setReportView, reportStart, reportEnd, setReportStart, setReportEnd } = getContext()

    setReportView(nextView)
    if (nextView !== 'business' && reportStart === todayString() && reportEnd === todayString()) {
      setReportStart(addDays(todayString(), -29))
      setReportEnd(todayString())
    }
  }

  function applyReportDateRange(nextStart: string, nextEnd: string, nextCompareEnabled: boolean, nextCompareStart: string, nextCompareEnd: string) {
    const { setReportStart, setReportEnd, setCompareEnabled, setCompareStart, setCompareEnd, setReportDatePickerOpen } = getContext()

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
    const context = getContext()
    const { exportExcelReport: download } = await import('./reportDownload.actions')
    await download(context)
  }

  async function exportPdfReport() {
    const context = getContext()
    const { exportPdfReport: download } = await import('./reportDownload.actions')
    await download(context)
  }

  async function runReportExport(kind: 'excel' | 'pdf' | 'accountant', task: () => Promise<void>) {
    const { reportExporting, setReportExporting, setReportExportFeedback, text } = getContext()

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
    const context = getContext()
    const { downloadAccountantExport: download } = await import('./reportDownload.actions')
    await download(context)
  }

  return {
    loadReportFallback,
    loadReportData,
    loadQrAnalytics,
    applyPreviousPeriodComparison,
    selectReportView,
    applyReportDateRange,
    exportExcelReport,
    exportPdfReport,
    runReportExport,
    downloadAccountantExport,
  }
}
