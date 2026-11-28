'use client'

import { useState } from 'react'
import type { StaffQrAnalyticsSnapshot } from '../../components/StaffQrAnalytics'
import {
  addDays,
  reportPresetRange,
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
  StaffReportSnapshot,
  StaffReportView
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffReportsState({ language }: { language: string | undefined }) {
  const [reportStart, setReportStart] = useState(() => reportPresetRange('last_30')[0])
  const [reportEnd, setReportEnd] = useState(() => reportPresetRange('last_30')[1])
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareStart, setCompareStart] = useState(() => addDays(todayString(), -1))
  const [compareEnd, setCompareEnd] = useState(() => addDays(todayString(), -1))
  const [reportDatePickerOpen, setReportDatePickerOpen] = useState(false)
  const [reportDatePickerTarget, setReportDatePickerTarget] = useState<'report' | 'compare'>('report')
  const [reportView, setReportView] = useState<StaffReportView>('business')
  const [accountantExportOpen, setAccountantExportOpen] = useState(false)
  const [accountantExportFormat, setAccountantExportFormat] = useState<AccountantExportFormat>('excel')
  const [accountantExportLanguage, setAccountantExportLanguage] = useState<StaffConsoleLanguage>(() => resolveStaffConsoleLanguage(language))
  const [accountantExportStore, setAccountantExportStore] = useState(accountantExportStores[0].id)
  const [accountantIncludeAttachments, setAccountantIncludeAttachments] = useState(false)
  const [accountantReportId, setAccountantReportId] = useState<AccountantExportReportId>('sales_revenue')
  const [reportExporting, setReportExporting] = useState<'excel' | 'powerpoint' | 'accountant' | null>(null)
  const [reportExportFeedback, setReportExportFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [reportSnapshot, setReportSnapshot] = useState<StaffReportSnapshot | null>(null)
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
    qrAnalyticsSnapshot,
    setQrAnalyticsSnapshot,
    qrAnalyticsError,
    setQrAnalyticsError,
  }
}
