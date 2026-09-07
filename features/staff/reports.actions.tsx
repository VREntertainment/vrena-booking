'use client'

import type { StaffPlayerInsightsSnapshot } from '../../components/StaffPlayerInsights'
import type { StaffQrAnalyticsSnapshot } from '../../components/StaffQrAnalytics'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import { staffConsoleText } from '../../lib/staff/copy'
import {
  addDays,
  orderedRange,
  previousPeriodRange,
  rangeLabel,
  todayString
} from '../../lib/staff/dates'
import { rpcFunctionMissing } from '../../lib/staff/errors'
import {
  accountantExportReports,
  accountantExportStores
} from '../../lib/staff/options'
import {
  downloadCsv,
  downloadExcel,
  downloadPdf,
  reportPdfLines,
  staffOrderExportRows,
  staffReportRows
} from '../../lib/staff/reportExports'
import {
  buildDailySeries,
  buildStaffReport,
  emptyStaffReport,
  paymentMapFromRows,
  staffReportSnapshotFromRpc
} from '../../lib/staff/reporting'
import type {
  StaffAuditLog,
  StaffGame,
  StaffOrder,
  StaffReportSnapshot,
  StaffReportView
} from '../../lib/staff/types'
import { getStaffKioskOperatorToken, STAFF_KIOSK_HEADER, supabase } from '../../lib/supabase/client'

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
  setPlayerInsightsSnapshot: React.Dispatch<React.SetStateAction<import("../../components/StaffPlayerInsights").StaffPlayerInsightsSnapshot | null>>
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
    const { setGames, loadedDataRef, reportStart, reportEnd, compareStart, compareEnd, compareEnabled, fetchOrderPayments, setReportSnapshot, text } = getContext()

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
    const { runStaffLoader, reportStart, reportEnd, compareEnabled, compareStart, compareEnd, setPlayerInsightsSnapshot, text, setReportSnapshot } = getContext()

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
    const { runStaffLoader, setQrAnalyticsError, reportStart, reportEnd, compareEnabled, compareStart, compareEnd, setQrAnalyticsSnapshot } = getContext()

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
    const { reportStart, reportEnd, text, report, reportOrders, games, reportPaymentsByOrderId } = getContext()

    await downloadExcel(`vrena-daily-report-${reportStart}-${reportEnd}.xlsx`, [
      { title: `${text.tabs.report} ${rangeLabel(reportStart, reportEnd)}`, rows: staffReportRows(report, text) },
      { title: text.labels.orders, rows: staffOrderExportRows(reportOrders, games, reportPaymentsByOrderId, text) },
    ], text)
  }

  async function exportPdfReport() {
    const { reportStart, reportEnd, text, report, reportOrders, games, reportPaymentsByOrderId } = getContext()

    await downloadPdf(
      `vrena-daily-report-${reportStart}-${reportEnd}.pdf`,
      reportPdfLines(`${text.tabs.report} ${rangeLabel(reportStart, reportEnd)}`, report, reportOrders, games, reportPaymentsByOrderId, text),
      text
    )
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
    const {
      accountantReportId,
      accountantExportStore,
      accountantExportLanguage,
      fetchAuditLogs,
      report,
      reportOrders,
      games,
      reportPaymentsByOrderId,
      discounts,
      loyaltyRules,
      reportStart,
      reportEnd,
      accountantIncludeAttachments,
      accountantExportFormat,
    } = getContext()

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
    const { accountantAttachmentRows, accountantExportInfoRows, buildAccountantExportRows } = await import('../../lib/staffAccountantExportRows')
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
