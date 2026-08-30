'use client'

import {
  Activity,
  CircleCheck,
  Monitor,
  QrCode,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trophy,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

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

function DeviceIcon({ deviceClass }: { deviceClass: StaffQrAnalyticsSnapshot['deviceMix'][number]['deviceClass'] }) {
  if (deviceClass === 'mobile') return <Smartphone aria-hidden="true" size={15} />
  if (deviceClass === 'tablet') return <Tablet aria-hidden="true" size={15} />
  return <Monitor aria-hidden="true" size={15} />
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
  const maxScans = Math.max(1, ...(data?.scanSeries ?? []).map((point) => point.scans))
  const totalDeviceScans = Math.max(1, (data?.deviceMix ?? []).reduce((total, item) => total + item.scans, 0))
  const chartStyle = { '--qr-point-count': Math.max(data?.scanSeries.length ?? 0, 1) } as CSSProperties
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

      <div className="staff-insights-grid staff-qr-grid">
        <section className="staff-insight-panel staff-qr-trend-panel" aria-label={text.trend}>
          <div className="staff-insight-panel-head">
            <div>
              <h5>{text.trend}</h5>
              <span>{text.trendHelp} · {rangeLabel}</span>
            </div>
          </div>
          <div className="staff-qr-chart-scroll">
            <div className="staff-qr-chart" style={chartStyle}>
              {(data?.scanSeries ?? []).map((point, index, points) => (
                <div className="staff-qr-chart-day" key={point.date} title={`${dateLabel(point.date, language)}: ${point.scans}`}>
                  <div className="staff-qr-chart-track">
                    <span style={{ height: point.scans > 0 ? `${Math.max(4, (point.scans / maxScans) * 100)}%` : '0%' }} />
                  </div>
                  {(index === 0 || index === points.length - 1) ? <small>{dateLabel(point.date, language)}</small> : <small aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="staff-insight-panel" aria-label={text.deviceMix}>
          <div className="staff-insight-panel-head">
            <div>
              <h5>{text.deviceMix}</h5>
              <span>{text.deviceMixHelp}</span>
            </div>
          </div>
          <div className="staff-qr-device-list">
            {(data?.deviceMix ?? []).map((item) => (
              <div key={item.deviceClass}>
                <div>
                  <span><DeviceIcon deviceClass={item.deviceClass} /> {text[item.deviceClass]}</span>
                  <strong>{item.scans.toLocaleString()}</strong>
                </div>
                <div className="staff-payment-track">
                  <span style={{ width: `${Math.round((item.scans / totalDeviceScans) * 100)}%` }} />
                </div>
              </div>
            ))}
            {(data?.deviceMix.length ?? 0) === 0 ? <p className="notice">{text.empty}</p> : null}
          </div>
        </section>
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
