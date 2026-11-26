'use client'

import {
  CalendarDays,
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  X
} from 'lucide-react'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  rangeLabel
} from '../../lib/staff/dates'
import {
  accountantExportFormats,
  accountantExportLanguages,
  accountantExportReports,
  accountantExportStores
} from '../../lib/staff/options'
import type {
  AccountantExportFormat,
  StaffConsoleLanguage
} from '../../lib/staff/types'
import BusinessReport from './BusinessReport'
import styles from './ReportCharts.module.css'
import { ButtonIconText, StaffPlayerInsights, StaffQrAnalytics } from './shared'

export type ReportSectionProps = {
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  reportView: import("../../lib/staff/types").StaffReportView
  selectReportView: (nextView: import("../../lib/staff/types").StaffReportView) => void
  text: StaffConsoleCopy
  reportStart: string
  reportEnd: string
  activeReportPreset: "custom" | "today" | "yesterday" | "last_30"
  setReportStart: React.Dispatch<React.SetStateAction<string>>
  todayReportStart: string
  setReportEnd: React.Dispatch<React.SetStateAction<string>>
  todayReportEnd: string
  secondaryReportPreset: import("../../lib/staff/types").StaffReportRangePreset
  secondaryReportStart: string
  secondaryReportEnd: string
  setReportDatePickerTarget: React.Dispatch<React.SetStateAction<"report" | "compare">>
  setReportDatePickerOpen: React.Dispatch<React.SetStateAction<boolean>>
  compareEnabled: boolean
  compareStart: string
  compareEnd: string
  isPreviousPeriodComparison: boolean
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
  playerInsightsSnapshot: import("../../components/StaffPlayerInsights").StaffPlayerInsightsSnapshot | null
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
  activeReportPreset,
  setReportStart,
  todayReportStart,
  setReportEnd,
  todayReportEnd,
  secondaryReportPreset,
  secondaryReportStart,
  secondaryReportEnd,
  setReportDatePickerTarget,
  setReportDatePickerOpen,
  compareEnabled,
  compareStart,
  compareEnd,
  isPreviousPeriodComparison,
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
  playerInsightsSnapshot,
  loadingData,
  qrAnalyticsSnapshot,
  qrAnalyticsError,
}: ReportSectionProps) {
  return (
    <div className={`staff-card staff-report-workspace ${styles.dashboard}`}>
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
                    {text.reportRangePresets.last_30}
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
          <BusinessReport start={reportStart} end={reportEnd} compareStart={compareStart} compareEnd={compareEnd}
            compare={compareEnabled} language={resolvedLanguage} text={text} financial={reportReady ? report : null} />
          {reportReady && orderRows(reportOrders, reportPaymentsByOrderId)}
        </>
      ) : reportView === 'players' ? (
        <StaffPlayerInsights
          compareEnabled={compareEnabled}
          compareLabel={rangeLabel(compareStart, compareEnd)}
          data={reportReady ? playerInsightsSnapshot : null}
          language={resolvedLanguage}
          loading={Boolean(loadingData.report)}
          rangeLabel={rangeLabel(reportStart, reportEnd)}
        />
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
  )
}
