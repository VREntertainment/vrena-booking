'use client'

import { useState } from 'react'
import type { StaffPlayerInsightsSnapshot } from '../../components/StaffPlayerInsights'
import type { StaffQrAnalyticsSnapshot } from '../../components/StaffQrAnalytics'
import {
  addDays,
  todayString
} from '../../lib/staff/dates'
import {
  resolveStaffConsoleLanguage
} from '../../lib/staff/formatting'
import {
  accountantExportStores
} from '../../lib/staff/options'
import type {
  AccountantExportFormat,
  AccountantExportReportId,
  StaffConsoleLanguage,
  StaffReportChartMode,
  StaffReportSnapshot,
  StaffReportView
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffReportsState({ language }: { language: string | undefined }) {
  const [reportStart, setReportStart] = useState(todayString())
  const [reportEnd, setReportEnd] = useState(todayString())
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
  const [reportSnapshot, setReportSnapshot] = useState<StaffReportSnapshot | null>(null)
  const [playerInsightsSnapshot, setPlayerInsightsSnapshot] = useState<StaffPlayerInsightsSnapshot | null>(null)
  const [qrAnalyticsSnapshot, setQrAnalyticsSnapshot] = useState<StaffQrAnalyticsSnapshot | null>(null)
  const [qrAnalyticsError, setQrAnalyticsError] = useState('')
  return {
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
  }
}
