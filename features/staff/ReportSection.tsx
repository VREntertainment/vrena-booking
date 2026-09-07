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
  rangeLabel,
  shortDateLabel
} from '../../lib/staff/dates'
import {
  formatVnd,
  formatVndCompact
} from '../../lib/staff/formatting'
import {
  accountantExportFormats,
  accountantExportLanguages,
  accountantExportReports,
  accountantExportStores
} from '../../lib/staff/options'
import {
  percentChange
} from '../../lib/staff/reporting'
import type {
  AccountantExportFormat,
  StaffConsoleLanguage,
  StaffReportChartMode
} from '../../lib/staff/types'
import { vrenaPalette } from '../../lib/theme/vrenaPalette'
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
  report: import("../../lib/staff/types").StaffReportSummary
  weekdayRevenue: import("../../lib/staff/types").StaffWeekdayRevenuePoint[]
  comparisonWeekdayRevenue: import("../../lib/staff/types").StaffWeekdayRevenuePoint[]
  weekdayRevenueMax: number
  hourlyRevenueMax: number
  comparisonHourlyAreaPath: string
  hourlyAreaPath: string
  comparisonHourlyLinePath: string
  hourlyLinePath: string
  reportChartMode: import("../../lib/staff/types").StaffReportChartMode
  setReportChartMode: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffReportChartMode>>
  reportSeries: import("../../lib/staff/types").StaffDailyPoint[]
  comparisonSeries: import("../../lib/staff/types").StaffDailyPoint[]
  reportChartMax: number
  reportLinePath: string
  comparisonLinePath: string
  pieStops: string
  pieItems: ({ label: "Cash" | "Tiền mặt"; value: number } | { label: "Bank transfer" | "Chuyển khoản"; value: number } | { label: "Unpaid" | "Chưa thanh toán"; value: number })[]
  comparisonReport: import("../../lib/staff/types").StaffReportSummary
  paymentMix: ({ share: number; label: "Cash" | "Tiền mặt"; value: number } | { share: number; label: "Bank transfer" | "Chuyển khoản"; value: number } | { share: number; label: "Unpaid" | "Chưa thanh toán"; value: number })[]
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
  weekdayRevenue,
  comparisonWeekdayRevenue,
  weekdayRevenueMax,
  hourlyRevenueMax,
  comparisonHourlyAreaPath,
  hourlyAreaPath,
  comparisonHourlyLinePath,
  hourlyLinePath,
  reportChartMode,
  setReportChartMode,
  reportSeries,
  comparisonSeries,
  reportChartMax,
  reportLinePath,
  comparisonLinePath,
  pieStops,
  pieItems,
  comparisonReport,
  paymentMix,
  orderRows,
  reportOrders,
  reportPaymentsByOrderId,
  playerInsightsSnapshot,
  loadingData,
  qrAnalyticsSnapshot,
  qrAnalyticsError,
}: ReportSectionProps) {
  return (
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
  )
}
