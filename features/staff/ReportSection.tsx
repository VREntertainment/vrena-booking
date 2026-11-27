'use client'

import { type ReactNode } from 'react'
import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  X
} from 'lucide-react'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  previousPeriodRange, rangeLabel, reportPresetRange
} from '../../lib/staff/dates'
import {
  accountantExportFormats,
  accountantExportLanguages,
  accountantExportReports,
  accountantExportStores
} from '../../lib/staff/options'
import type {
  AccountantExportFormat,
  StaffConsoleLanguage, StaffReportRangePreset
} from '../../lib/staff/types'
import BusinessReport from './BusinessReport'
import { ReportToolbarMenu } from './ReportToolbarMenu'
import styles from './ReportCharts.module.css'
import { ButtonIconText, StaffQrAnalytics } from './shared'

export type ReportSectionProps = {
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  reportView: import("../../lib/staff/types").StaffReportView
  selectReportView: (nextView: import("../../lib/staff/types").StaffReportView) => void
  text: StaffConsoleCopy
  reportStart: string
  reportEnd: string
  setReportDatePickerTarget: React.Dispatch<React.SetStateAction<"report" | "compare">>
  setReportDatePickerOpen: React.Dispatch<React.SetStateAction<boolean>>
  compareEnabled: boolean
  compareStart: string
  compareEnd: string
  applyReportDateRange: (start: string, end: string, compare: boolean, compareStart: string, compareEnd: string) => void
  applyPreviousPeriodComparison: () => void
  setCompareEnabled: React.Dispatch<React.SetStateAction<boolean>>
  reportExporting: "excel" | "pdf" | "accountant" | null
  runReportExport: (kind: "excel" | "pdf" | "accountant", task: () => Promise<void>) => Promise<void>
  exportExcelReport: () => Promise<void>
  exportPdfReport: () => Promise<void>
  accountantExportOpen: boolean
  setAccountantExportOpen: React.Dispatch<React.SetStateAction<boolean>>
  accountantExportStore: string
  setAccountantExportStore: React.Dispatch<React.SetStateAction<string>>
  accountantExportLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  accountantExportFormat: import("../../lib/staff/types").AccountantExportFormat
  setAccountantExportFormat: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").AccountantExportFormat>>
  setAccountantIncludeAttachments: React.Dispatch<React.SetStateAction<boolean>>
  setAccountantExportLanguage: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffConsoleLanguage>>
  accountantIncludeAttachments: boolean
  accountantReportId: import("../../lib/staff/types").AccountantExportReportId
  setAccountantReportId: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").AccountantExportReportId>>
  downloadAccountantExport: () => Promise<void>
  reportExportFeedback: { message: string; tone: "error" | "success" } | null
  reportReady: boolean
  report: import("../../lib/staff/types").StaffReportSummary
  orderRows: (rows: import("../../lib/staff/types").StaffOrder[], paymentsByOrderId?: Map<string, import("../../lib/staff/types").StaffOrderPayment[]>) => React.JSX.Element
  reportOrders: import("../../lib/staff/types").StaffOrder[]
  reportPaymentsByOrderId: Map<string, import("../../lib/staff/types").StaffOrderPayment[]>
  loadingData: Partial<Record<import("../../lib/staff/types").StaffDataKey, boolean>>
  qrAnalyticsSnapshot: import("../../components/StaffQrAnalytics").StaffQrAnalyticsSnapshot | null
  qrAnalyticsError: string
}

export default function ReportSection({
  resolvedLanguage,
  reportView,
  selectReportView,
  text,
  reportStart,
  reportEnd,
  setReportDatePickerTarget,
  setReportDatePickerOpen,
  compareEnabled,
  compareStart,
  compareEnd,
  applyReportDateRange,
  applyPreviousPeriodComparison,
  setCompareEnabled,
  reportExporting,
  runReportExport,
  exportExcelReport,
  exportPdfReport,
  accountantExportOpen,
  setAccountantExportOpen,
  accountantExportStore,
  setAccountantExportStore,
  accountantExportLanguage,
  accountantExportFormat,
  setAccountantExportFormat,
  setAccountantIncludeAttachments,
  setAccountantExportLanguage,
  accountantIncludeAttachments,
  accountantReportId,
  setAccountantReportId,
  downloadAccountantExport,
  reportExportFeedback,
  report,
  reportReady,
  orderRows,
  reportOrders,
  reportPaymentsByOrderId,
  loadingData,
  qrAnalyticsSnapshot,
  qrAnalyticsError,
}: ReportSectionProps) {
  const vi = resolvedLanguage === 'vi'
  const [previousStart, previousEnd] = previousPeriodRange(reportStart, reportEnd)
  const isPrevious = compareEnabled && compareStart === previousStart && compareEnd === previousEnd
  const datePresets = ['today', 'this_week', 'last_week', 'this_month', 'last_30'] as const satisfies readonly StaffReportRangePreset[]
  const activePreset = datePresets.find((preset) => {
    const [start, end] = reportPresetRange(preset)
    return reportStart === start && reportEnd === end
  })
  const customLabel = vi ? 'Khoảng ngày tùy chọn' : 'Custom range'
  const presetLabel = (preset: StaffReportRangePreset) => preset === 'today' ? text.actions.today : text.reportRangePresets[preset]
  const periodLabel = (start: string, end: string) => rangeLabel(start, end).replace(' - ', '–')
  const openCustomRange = () => {
    setReportDatePickerTarget('report')
    setReportDatePickerOpen(true)
  }
  const selectPreset = (preset: StaffReportRangePreset) => {
    const [start, end] = reportPresetRange(preset)
    const [priorStart, priorEnd] = isPrevious ? previousPeriodRange(start, end) : [compareStart, compareEnd]
    applyReportDateRange(start, end, compareEnabled, priorStart, priorEnd)
  }
  const off = vi ? 'Tắt' : 'Off'
  const exportLabel = vi ? 'Xuất báo cáo' : 'Export'
  const toolbar = (venueControl?: ReactNode) => (
    <div className={styles.reportToolbar} role="group" aria-label={vi ? 'Bộ lọc báo cáo' : 'Report controls'}>
      <ReportToolbarMenu label={text.labels.dateRange} icon={<CalendarRange size={15} aria-hidden="true" />}
        value={activePreset ? presetLabel(activePreset) : customLabel} detail={periodLabel(reportStart, reportEnd)}>
        {datePresets.map((preset) => <button key={preset} type="button" aria-pressed={activePreset === preset}
          onClick={() => selectPreset(preset)}>{presetLabel(preset)}</button>)}
        <button type="button" aria-pressed={!activePreset} onClick={openCustomRange}>{customLabel}</button>
      </ReportToolbarMenu>
      {venueControl}
      <ReportToolbarMenu label={vi ? 'So sánh' : 'Comparison'} icon={<RotateCcw size={15} aria-hidden="true" />}
        value={compareEnabled ? (isPrevious ? text.actions.previousPeriod : customLabel) : off}
        detail={compareEnabled ? periodLabel(compareStart, compareEnd) : undefined}>
        <button type="button" aria-pressed={!compareEnabled} onClick={() => setCompareEnabled(false)}>{off}</button>
        <button type="button" aria-pressed={isPrevious} onClick={applyPreviousPeriodComparison}>{text.actions.previousPeriod}</button>
      </ReportToolbarMenu>
      {reportView === 'business' && <>
        <div className={styles.exportControl}>
          <ReportToolbarMenu label={exportLabel} icon={<Download size={15} aria-hidden="true" />}>
            <button type="button" aria-busy={reportExporting === 'excel'} disabled={reportExporting !== null}
              onClick={() => { void runReportExport('excel', exportExcelReport) }}>
              <ButtonIconText icon={<FileSpreadsheet aria-hidden="true" size={14} />}>{text.actions.excel}</ButtonIconText>
            </button>
            <button type="button" aria-busy={reportExporting === 'pdf'} disabled={reportExporting !== null}
              onClick={() => { void runReportExport('pdf', exportPdfReport) }}>
              <ButtonIconText icon={<FileText aria-hidden="true" size={14} />}>{text.actions.pdf}</ButtonIconText>
            </button>
            <button type="button" onClick={() => setAccountantExportOpen((open) => !open)}>{text.labels.accountantExports}</button>
          </ReportToolbarMenu>
        </div>
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
        {reportExportFeedback && <span className={`staff-report-export-feedback ${reportExportFeedback.tone}`} role="status">
          {reportExportFeedback.message}
        </span>}
      </>}
    </div>
  )
  const tabs = [
    ['business', vi ? 'Kinh doanh' : 'Business performance'],
    ['qr', vi ? 'Phân tích QR' : 'QR analytics'],
  ] as const
  return (
    <div className={`staff-card staff-report-workspace ${styles.dashboard}`}>
      <div className={styles.reportTabs} role="tablist" aria-label={vi ? 'Chế độ báo cáo' : 'Report view'}>
        {tabs.map(([view, title], index) => <button key={view} role="tab" type="button"
          id={`report-tab-${view}`} aria-controls="staff-report-panel" aria-selected={reportView === view}
          tabIndex={reportView === view ? 0 : -1} onClick={() => selectReportView(view)}
          onKeyDown={(event) => {
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
              : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (next < 0) return
            event.preventDefault()
            const target = tabs[next][0]
            selectReportView(target)
            document.getElementById(`report-tab-${target}`)?.focus()
          }}>{title}</button>)}
      </div>
      <div className={styles.reportTabPanel} id="staff-report-panel" role="tabpanel" aria-labelledby={`report-tab-${reportView}`}>
      {reportView !== 'business' && toolbar()}
      {reportView === 'business' ? (
        <>
          <BusinessReport start={reportStart} end={reportEnd} compareStart={compareStart} compareEnd={compareEnd}
            compare={compareEnabled} language={resolvedLanguage} text={text} financial={reportReady ? report : null} toolbar={toolbar} />
          {reportReady && orderRows(reportOrders, reportPaymentsByOrderId)}
        </>
      ) : (
        <StaffQrAnalytics
          compareEnabled={compareEnabled}
          compareLabel={rangeLabel(compareStart, compareEnd)}
          data={reportReady ? qrAnalyticsSnapshot : null}
          error={qrAnalyticsError}
          language={resolvedLanguage}
          loading={Boolean(loadingData.qrReport)}
          rangeLabel={rangeLabel(reportStart, reportEnd)}
        />
      )}
      </div>
    </div>
  )
}
