'use client'

import {
  Activity,
  CircleCheck,
  QrCode,
  ShieldCheck,
  Trophy,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { ReportPanel, ReportRanking, ReportTrend, reportNumber } from '../features/staff/reportCharts'
import chartStyles from '../features/staff/ReportCharts.module.css'

export type StaffQrAnalyticsSummary = {
  activeCodes: number
  latestScanAt: string | null
  topQrCode: string | null
  trackedCodes: number
  totalCodes: number
  totalScans: number
}

export type StaffQrAnalyticsSnapshot = {
  comparisonSummary: StaffQrAnalyticsSummary
  deviceMix: Array<{ deviceClass: 'mobile' | 'tablet' | 'desktop' | 'unknown'; scans: number }>
  qrCodes: Array<{
    active: boolean
    id: string
    lastScanAt: string | null
    name: string
    scans: number
    shortUrl: string
    slug: string
    targetUrl: string
  }>
  scanSeries: Array<{ date: string; scans: number }>
  summary: StaffQrAnalyticsSummary
  timezone: 'Asia/Ho_Chi_Minh'
}

type StaffQrAnalyticsProps = {
  compareEnabled: boolean
  compareLabel: string
  data: StaffQrAnalyticsSnapshot | null
  error: string
  language: 'en' | 'vi'
  loading: boolean
  rangeLabel: string
}

const emptySummary: StaffQrAnalyticsSummary = {
  activeCodes: 0,
  latestScanAt: null,
  topQrCode: null,
  trackedCodes: 0,
  totalCodes: 0,
  totalScans: 0,
}

const copy = {
  en: {
    title: 'QR analytics',
    subtitle: 'Real scans from standard Content Studio QR links.',
    totalScans: 'Total scans',
    totalScansHelp: 'Successful QR redirects recorded in this period.',
    trackedCodes: 'QR codes scanned',
    trackedCodesHelp: 'Standard QR codes with at least one scan.',
    topQr: 'Top QR code',
    topQrHelp: 'The most-scanned QR code in this period.',
    activeCodes: 'Active QR codes',
    activeCodesHelp: 'Standard QR links currently available to scan.',
    newValue: 'New',
    vs: 'vs',
    trend: 'Scan trend',
    trendHelp: 'Successful redirects by day',
    deviceMix: 'Device mix',
    deviceMixHelp: 'Broad device class only; raw user agents are not stored.',
    mobile: 'Mobile',
    tablet: 'Tablet',
    desktop: 'Desktop',
    unknown: 'Unknown',
    qrPerformance: 'QR code performance',
    qrPerformanceHelp: 'Every standard Content Studio QR code appears here, including new codes with zero scans.',
    qrCode: 'QR code',
    shortLink: 'Short link',
    destination: 'Destination',
    status: 'Status',
    scans: 'Scans',
    lastScan: 'Last scan',
    active: 'Active',
    inactive: 'Inactive',
    never: 'Never',
    none: 'None yet',
    empty: 'No QR scans are recorded in this range yet.',
    scopeTitle: 'Automatic, privacy-safe tracking',
    scopeBody: 'All existing and future standard Content Studio QR links are tracked automatically when their short link redirects.',
    tracked: 'Tracked',
    trackedBody: 'scan time · QR code · broad device class',
    excluded: 'Excluded',
    excludedBody: 'Wi-Fi QR codes · raw IP addresses · raw user-agent strings · bots and link previews',
  },
  vi: {
    title: 'Phân tích mã QR',
    subtitle: 'Lượt quét thực tế từ các liên kết QR tiêu chuẩn của Content Studio.',
    totalScans: 'Tổng lượt quét',
    totalScansHelp: 'Lượt chuyển hướng QR thành công trong kỳ.',
    trackedCodes: 'Mã QR đã được quét',
    trackedCodesHelp: 'Mã QR tiêu chuẩn có ít nhất một lượt quét.',
    topQr: 'Mã QR hàng đầu',
    topQrHelp: 'Mã QR được quét nhiều nhất trong kỳ.',
    activeCodes: 'Mã QR đang hoạt động',
    activeCodesHelp: 'Liên kết QR tiêu chuẩn hiện có thể quét.',
    newValue: 'Mới',
    vs: 'so với',
    trend: 'Xu hướng lượt quét',
    trendHelp: 'Lượt chuyển hướng thành công theo ngày',
    deviceMix: 'Thiết bị',
    deviceMixHelp: 'Chỉ lưu nhóm thiết bị; không lưu chuỗi nhận diện trình duyệt.',
    mobile: 'Điện thoại',
    tablet: 'Máy tính bảng',
    desktop: 'Máy tính',
    unknown: 'Không xác định',
    qrPerformance: 'Hiệu suất mã QR',
    qrPerformanceHelp: 'Mọi mã QR tiêu chuẩn trong Content Studio đều xuất hiện, kể cả mã mới chưa có lượt quét.',
    qrCode: 'Mã QR',
    shortLink: 'Liên kết ngắn',
    destination: 'Điểm đến',
    status: 'Trạng thái',
    scans: 'Lượt quét',
    lastScan: 'Lần quét cuối',
    active: 'Hoạt động',
    inactive: 'Tạm dừng',
    never: 'Chưa có',
    none: 'Chưa có',
    empty: 'Chưa ghi nhận lượt quét QR trong khoảng này.',
    scopeTitle: 'Theo dõi tự động, bảo vệ quyền riêng tư',
    scopeBody: 'Mọi liên kết QR tiêu chuẩn hiện tại và được tạo sau này trong Content Studio đều tự động được theo dõi khi chuyển hướng.',
    tracked: 'Đang theo dõi',
    trackedBody: 'thời gian quét · mã QR · nhóm thiết bị',
    excluded: 'Không theo dõi',
    excludedBody: 'QR Wi-Fi · địa chỉ IP thô · chuỗi nhận diện trình duyệt thô · bot và bản xem trước liên kết',
  },
} as const

function changeLabel(current: number, previous: number, newValue: string) {
  if (previous <= 0) return current > 0 ? newValue : '0%'
  const change = Math.round(((current - previous) / previous) * 100)
  return `${change >= 0 ? '+' : ''}${change}%`
}

function dateLabel(value: string, language: 'en' | 'vi') {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function timeLabel(value: string | null, language: 'en' | 'vi', fallback: string) {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date)
}

function InsightCard({ help, icon, label, note, value }: {
  help: string
  icon: ReactNode
  label: string
  note: string | null
  value: number | string
}) {
  return (
    <article className="staff-insight-kpi">
      <div className="staff-insight-kpi-head">
        <span className="staff-insight-kpi-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
      <p>{help}</p>
    </article>
  )
}

export default function StaffQrAnalytics({
  compareEnabled,
  compareLabel,
  data,
  error,
  language,
  loading,
  rangeLabel,
}: StaffQrAnalyticsProps) {
  const text = copy[language]
  const summary = { ...emptySummary, ...(data?.summary ?? {}) }
  const comparison = { ...emptySummary, ...(data?.comparisonSummary ?? {}) }
  const count = (value: number) => reportNumber(language, value)
  const daily = data?.scanSeries ?? []
  const comparisonNote = compareEnabled
    ? `${changeLabel(summary.totalScans, comparison.totalScans, text.newValue)} ${text.vs} ${compareLabel}`
    : null

  return (
    <div className={loading ? 'staff-player-insights staff-qr-analytics loading' : 'staff-player-insights staff-qr-analytics'}>
      <div className="staff-insight-kpi-grid staff-qr-kpi-grid">
        <InsightCard
          help={text.totalScansHelp}
          icon={<Activity aria-hidden="true" size={18} />}
          label={text.totalScans}
          note={comparisonNote}
          value={summary.totalScans.toLocaleString()}
        />
        <InsightCard
          help={text.trackedCodesHelp}
          icon={<QrCode aria-hidden="true" size={18} />}
          label={text.trackedCodes}
          note={null}
          value={`${summary.trackedCodes}/${summary.totalCodes}`}
        />
        <InsightCard
          help={text.topQrHelp}
          icon={<Trophy aria-hidden="true" size={18} />}
          label={text.topQr}
          note={null}
          value={summary.topQrCode || text.none}
        />
        <InsightCard
          help={text.activeCodesHelp}
          icon={<CircleCheck aria-hidden="true" size={18} />}
          label={text.activeCodes}
          note={null}
          value={summary.activeCodes}
        />
      </div>

      {error ? <p className="staff-insights-empty error" role="alert">{error}</p> : null}
      {!error && summary.totalScans === 0 ? <p className="staff-insights-empty">{text.empty}</p> : null}

      <div className={chartStyles.grid}>
        <ReportPanel title={text.trend} description={`${text.trendHelp} · ${rangeLabel}`} wide>
          <ReportTrend label={text.trend} language={language} labels={daily.map((point) => dateLabel(point.date, language))}
            series={[{ label: text.scans, color: 'primary', values: daily.map((point) => point.scans) }]} valueLabel={count} />
        </ReportPanel>
        <ReportPanel title={text.deviceMix} description={text.deviceMixHelp}>
          <ReportRanking rows={(data?.deviceMix ?? []).map((item) => ({ label: text[item.deviceClass], value: item.scans }))
            .sort((a, b) => b.value - a.value)} valueLabel={count} empty={text.empty} />
        </ReportPanel>
        <ReportPanel title={language === 'vi' ? 'Mã QR hàng đầu' : 'Top QR codes'} description={rangeLabel}>
          <ReportRanking rows={(data?.qrCodes ?? []).filter((item) => item.scans > 0)
            .map((item) => ({ id: item.id, label: item.name, value: item.scans, detail: `/q/${item.slug}` }))
            .sort((a, b) => b.value - a.value).slice(0, 8)} valueLabel={count} empty={text.empty} />
        </ReportPanel>
      </div>

      <section className="staff-insight-panel staff-qr-table-panel" aria-label={text.qrPerformance}>
        <div className="staff-insight-panel-head">
          <div>
            <h5>{text.qrPerformance}</h5>
            <span>{text.qrPerformanceHelp}</span>
          </div>
        </div>
        <div className="staff-insight-player-table-wrap">
          <table className="staff-insight-player-table staff-qr-table">
            <thead>
              <tr>
                <th>{text.qrCode}</th>
                <th>{text.shortLink}</th>
                <th>{text.destination}</th>
                <th>{text.status}</th>
                <th>{text.scans}</th>
                <th>{text.lastScan}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.qrCodes ?? []).map((qrCode) => (
                <tr key={qrCode.id}>
                  <td><strong>{qrCode.name}</strong></td>
                  <td><a href={qrCode.shortUrl} rel="noreferrer" target="_blank">/q/{qrCode.slug}</a></td>
                  <td><span className="staff-qr-destination" title={qrCode.targetUrl}>{qrCode.targetUrl}</span></td>
                  <td><span className={qrCode.active ? 'staff-qr-status active' : 'staff-qr-status'}>{qrCode.active ? text.active : text.inactive}</span></td>
                  <td><strong>{qrCode.scans.toLocaleString()}</strong></td>
                  <td>{timeLabel(qrCode.lastScanAt, language, text.never)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="staff-insights-scope">
        <div>
          <span className="staff-insights-scope-icon"><ShieldCheck aria-hidden="true" size={18} /></span>
          <div>
            <strong>{text.scopeTitle}</strong>
            <p>{text.scopeBody}</p>
          </div>
        </div>
        <div className="staff-insights-scope-columns">
          <div><strong>{text.tracked}</strong><p>{text.trackedBody}</p></div>
          <div><strong>{text.excluded}</strong><p>{text.excludedBody}</p></div>
        </div>
      </section>
    </div>
  )
}
