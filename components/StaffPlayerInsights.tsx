'use client'

import {
  Activity,
  CalendarCheck2,
  Gamepad2,
  Gauge,
  MessageCircle,
  MonitorSmartphone,
  MousePointerClick,
  Repeat2,
  Route,
  Search,
  ShieldCheck,
  Target,
  Timer,
  UsersRound,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export type StaffPlayerInsightsSummary = {
  engagedPlayers: number
  checkedInPlayers: number
  reservations: number
  dueReservations: number
  completedVisits: number
  returningPlayers: number
  firstTimePlayers: number
  repeatPlayers: number
  attendanceRate: number
  repeatRate: number
  averageVisitsPerPlayer: number
  averageScore: number
  averageAccuracy: number
  resultRows: number
  resultCoverage: number
  messages: number
  clubJoins: number
  socialActions: number
  latestSourceAt: string | null
}

export type StaffProductAnalyticsSummary = {
  sessions: number
  visitors: number
  signedInVisitors: number
  pageViews: number
  searches: number
  engagementSeconds: number
  averageSessionSeconds: number
  pagesPerSession: number
  searchRate: number
  signedInShare: number
  latestEventAt: string | null
}

export type StaffProductAnalyticsSnapshot = {
  summary: StaffProductAnalyticsSummary
  comparisonSummary: StaffProductAnalyticsSummary
  activitySeries: Array<{ date: string; pageViews: number; sessions: number; searches: number }>
  topPages: Array<{ path: string; pageViews: number; visitors: number; engagementSeconds: number }>
  transitions: Array<{ fromPath: string; toPath: string; transitions: number }>
  deviceMix: Array<{ deviceClass: 'mobile' | 'tablet' | 'desktop'; sessions: number }>
  acquisitionMix: Array<{ source: string; medium: string; sessions: number }>
  searchSurfaces: Array<{ surface: string; searches: number; averageQueryLength: number; averageResults: number | null }>
  dataQuality: {
    timezone: string
    seriesCappedAtDays: number
    collectionStartedAt: string | null
    consentModel: string
    privacyBoundaries: string[]
  }
}

export type StaffPlayerInsightsSnapshot = {
  summary: StaffPlayerInsightsSummary
  comparisonSummary: StaffPlayerInsightsSummary
  activitySeries: Array<{
    date: string
    reservations: number
    checkIns: number
    engagedPlayers: number
  }>
  peakTimes: Array<{
    weekday: number
    daypart: 'morning' | 'afternoon' | 'evening'
    visits: number
  }>
  gameDemand: Array<{
    gameKey: string
    gameName: string
    reservations: number
    visits: number
    sessions: number
  }>
  players: Array<{
    profileId: string
    displayName: string
    reservations: number
    checkIns: number
    firstVisit: string | null
    lastVisit: string | null
    averageScore: number
    averageAccuracy: number
    favoriteGame: string
    segment: 'loyal' | 'repeat' | 'returning' | 'new' | 'booked'
  }>
  dataQuality: {
    timezone: string
    seriesCappedAtDays: number
    sources: string[]
    trackedSignals: string[]
    untrackedSignals: string[]
  }
  productAnalytics?: StaffProductAnalyticsSnapshot | null
}

type StaffPlayerInsightsProps = {
  compareEnabled: boolean
  compareLabel: string
  data: StaffPlayerInsightsSnapshot | null
  language: 'en' | 'vi'
  loading: boolean
  rangeLabel: string
}

const emptySummary: StaffPlayerInsightsSummary = {
  engagedPlayers: 0,
  checkedInPlayers: 0,
  reservations: 0,
  dueReservations: 0,
  completedVisits: 0,
  returningPlayers: 0,
  firstTimePlayers: 0,
  repeatPlayers: 0,
  attendanceRate: 0,
  repeatRate: 0,
  averageVisitsPerPlayer: 0,
  averageScore: 0,
  averageAccuracy: 0,
  resultRows: 0,
  resultCoverage: 0,
  messages: 0,
  clubJoins: 0,
  socialActions: 0,
  latestSourceAt: null,
}

const emptyProductSummary: StaffProductAnalyticsSummary = {
  sessions: 0,
  visitors: 0,
  signedInVisitors: 0,
  pageViews: 0,
  searches: 0,
  engagementSeconds: 0,
  averageSessionSeconds: 0,
  pagesPerSession: 0,
  searchRate: 0,
  signedInShare: 0,
  latestEventAt: null,
}

const PAID_ACQUISITION_MEDIUM = /(paid|cpc|ppc)/
const ORGANIC_SOCIAL_MEDIA = new Set(['social', 'organic', 'organic social', 'organic_social'])

const copy = {
  en: {
    title: 'Player behavior',
    subtitle: 'Real venue engagement from reservations, check-ins, game results and social activity.',
    liveSources: 'Live operational data',
    lowCoverage: 'Limited results coverage',
    strongCoverage: 'Strong results coverage',
    engagedPlayers: 'Engaged players',
    engagedHelp: 'Unique players with a reservation in this period.',
    completedVisits: 'Completed visits',
    visitsHelp: 'Participant check-ins recorded by the venue team.',
    returningPlayers: 'Returning players',
    returningHelp: 'Checked-in players who also visited before this period.',
    attendance: 'Attendance rate',
    attendanceHelp: 'Check-ins divided by reservations whose session has already started.',
    repeatRate: 'Repeat rate',
    repeatHelp: 'Checked-in players with at least two visits in this period.',
    visitFrequency: 'Visit frequency',
    frequencyHelp: 'Average completed visits per checked-in player.',
    vs: 'vs',
    newValue: 'New',
    activityTitle: 'Engagement trend',
    activitySubtitle: 'Daily reservations and completed visits',
    reservations: 'Reservations',
    checkIns: 'Check-ins',
    peakTitle: 'When players visit',
    peakSubtitle: 'Check-ins by weekday and time range',
    morning: '00:00–11:59',
    afternoon: '12:00–16:59',
    evening: '17:00–23:59',
    gameTitle: 'Game demand',
    gameSubtitle: 'Sessions selected by booked players',
    visits: 'visits',
    bookings: 'bookings',
    socialTitle: 'Community activity',
    messages: 'Session messages',
    clubJoins: 'Club joins',
    performanceTitle: 'Result quality',
    averageScore: 'Average score',
    averageAccuracy: 'Average accuracy',
    coverage: 'Results captured',
    playersTitle: 'Player activity',
    player: 'Player',
    segment: 'Segment',
    favoriteGame: 'Game signal',
    lastVisit: 'Last visit',
    noVisits: 'No completed visit',
    loyal: 'Loyal',
    repeat: 'Repeat',
    returning: 'Returning',
    new: 'New',
    booked: 'Booked',
    scopeTitle: 'What this report knows',
    scopeBody: 'It combines real venue records with aggregate product analytics from public player routes. It does not infer player intent.',
    tracked: 'Tracked now',
    trackedBody: 'reservations · check-ins · results · page journeys · searches · engaged time · device · acquisition',
    missing: 'Privacy boundaries',
    missingBody: 'No raw IP, search text or query strings. Staff profiles and internal routes are excluded, and digital reporting stays aggregated.',
    empty: 'No player activity is recorded in this range. Try the last 30 or 90 days.',
    freshness: 'Updated',
  },
  vi: {
    title: 'Hành vi người chơi',
    subtitle: 'Mức độ tương tác thực tế từ đặt chỗ, check-in, kết quả trò chơi và hoạt động cộng đồng.',
    liveSources: 'Dữ liệu vận hành trực tiếp',
    lowCoverage: 'Kết quả còn thiếu',
    strongCoverage: 'Độ phủ kết quả tốt',
    engagedPlayers: 'Người chơi tương tác',
    engagedHelp: 'Số người chơi duy nhất có đặt chỗ trong kỳ.',
    completedVisits: 'Lượt chơi hoàn tất',
    visitsHelp: 'Các lượt check-in được đội ngũ tại cơ sở ghi nhận.',
    returningPlayers: 'Người chơi quay lại',
    returningHelp: 'Người đã check-in trong kỳ và từng đến trước đó.',
    attendance: 'Tỷ lệ tham dự',
    attendanceHelp: 'Check-in chia cho đặt chỗ của các phiên đã bắt đầu.',
    repeatRate: 'Tỷ lệ chơi lại',
    repeatHelp: 'Người check-in ít nhất hai lần trong kỳ.',
    visitFrequency: 'Tần suất ghé chơi',
    frequencyHelp: 'Số lượt hoàn tất trung bình trên mỗi người đã check-in.',
    vs: 'so với',
    newValue: 'Mới',
    activityTitle: 'Xu hướng tương tác',
    activitySubtitle: 'Đặt chỗ và lượt chơi hoàn tất theo ngày',
    reservations: 'Đặt chỗ',
    checkIns: 'Check-in',
    peakTitle: 'Thời điểm người chơi ghé',
    peakSubtitle: 'Check-in theo ngày và khung giờ',
    morning: '00:00–11:59',
    afternoon: '12:00–16:59',
    evening: '17:00–23:59',
    gameTitle: 'Nhu cầu trò chơi',
    gameSubtitle: 'Trò chơi được chọn trong phiên có đặt chỗ',
    visits: 'lượt chơi',
    bookings: 'đặt chỗ',
    socialTitle: 'Hoạt động cộng đồng',
    messages: 'Tin nhắn phiên',
    clubJoins: 'Tham gia câu lạc bộ',
    performanceTitle: 'Chất lượng kết quả',
    averageScore: 'Điểm trung bình',
    averageAccuracy: 'Độ chính xác TB',
    coverage: 'Đã ghi kết quả',
    playersTitle: 'Hoạt động người chơi',
    player: 'Người chơi',
    segment: 'Phân nhóm',
    favoriteGame: 'Tín hiệu trò chơi',
    lastVisit: 'Lần gần nhất',
    noVisits: 'Chưa có lượt hoàn tất',
    loyal: 'Trung thành',
    repeat: 'Chơi lại',
    returning: 'Quay lại',
    new: 'Mới',
    booked: 'Đã đặt',
    scopeTitle: 'Báo cáo này biết gì',
    scopeBody: 'Báo cáo kết hợp dữ liệu cơ sở thực tế với phân tích sản phẩm tổng hợp từ các trang công khai dành cho người chơi. Không suy đoán ý định người chơi.',
    tracked: 'Đang theo dõi',
    trackedBody: 'đặt chỗ · check-in · kết quả · hành trình trang · tìm kiếm · thời gian tương tác · thiết bị · nguồn truy cập',
    missing: 'Giới hạn quyền riêng tư',
    missingBody: 'Không lưu IP thô, nội dung tìm kiếm hoặc chuỗi truy vấn. Loại trừ hồ sơ nhân viên và các trang nội bộ; chỉ báo cáo tổng hợp.',
    empty: 'Không có hoạt động người chơi trong khoảng này. Hãy thử 30 hoặc 90 ngày gần nhất.',
    freshness: 'Cập nhật',
  },
} as const

const productCopy = {
  en: {
    eyebrow: 'Player digital behavior',
    title: 'Digital journey',
    subtitle: 'How players discover, explore and search the app before and between venue visits.',
    privacy: 'Aggregate only · Staff excluded',
    coverage: 'All public visitors included',
    sessions: 'App sessions',
    sessionsHelp: 'Distinct player browsing sessions.',
    visitors: 'Visitors',
    visitorsHelp: 'Player browsers across public app routes.',
    pagesPerSession: 'Pages / session',
    pagesHelp: 'Average player-facing pages viewed per session.',
    engagedTime: 'Avg engaged time',
    timeHelp: 'Visible, active time per session.',
    searches: 'Searches',
    searchesHelp: 'Search actions without storing the typed text.',
    searchRate: 'Search rate',
    searchRateHelp: 'Search actions divided by app sessions.',
    trendTitle: 'Digital engagement trend',
    trendSubtitle: 'Daily page views and app sessions',
    pageViews: 'Page views',
    topPages: 'Top destinations',
    topPagesSubtitle: 'Player-facing pages ranked by views',
    journeys: 'Common journeys',
    journeysSubtitle: 'Most frequent page-to-page transitions',
    devices: 'Device mix',
    devicesSubtitle: 'Sessions by device class',
    acquisition: 'Acquisition',
    acquisitionSubtitle: 'First-touch source. Organic/social are grouped; UTM-tagged ads appear separately.',
    searchIntent: 'Search activity',
    searchIntentSubtitle: 'Search surfaces; typed text is never stored',
    views: 'views',
    sessionUnit: 'sessions',
    transitionUnit: 'journeys',
    averageResults: 'avg results',
  },
  vi: {
    eyebrow: 'Hành vi số của người chơi',
    title: 'Hành trình số',
    subtitle: 'Cách người chơi khám phá, duyệt và tìm kiếm trong app trước và giữa các lượt ghé cơ sở.',
    privacy: 'Chỉ tổng hợp · Loại trừ nhân viên',
    coverage: 'Bao gồm mọi khách truy cập trang công khai',
    sessions: 'Phiên dùng app',
    sessionsHelp: 'Số phiên duyệt khác nhau của người chơi.',
    visitors: 'Khách truy cập',
    visitorsHelp: 'Trình duyệt người chơi trên các trang công khai của app.',
    pagesPerSession: 'Trang / phiên',
    pagesHelp: 'Số trang dành cho người chơi trung bình mỗi phiên.',
    engagedTime: 'TG tương tác TB',
    timeHelp: 'Thời gian trang hiển thị và được sử dụng trong mỗi phiên.',
    searches: 'Lượt tìm kiếm',
    searchesHelp: 'Hành động tìm kiếm mà không lưu nội dung đã nhập.',
    searchRate: 'Tỷ lệ tìm kiếm',
    searchRateHelp: 'Lượt tìm kiếm chia cho số phiên dùng app.',
    trendTitle: 'Xu hướng tương tác số',
    trendSubtitle: 'Lượt xem trang và phiên dùng app theo ngày',
    pageViews: 'Lượt xem trang',
    topPages: 'Điểm đến hàng đầu',
    topPagesSubtitle: 'Trang người chơi được xếp theo lượt xem',
    journeys: 'Hành trình phổ biến',
    journeysSubtitle: 'Chuyển tiếp trang-đến-trang thường gặp nhất',
    devices: 'Thiết bị',
    devicesSubtitle: 'Phiên theo loại thiết bị',
    acquisition: 'Nguồn truy cập',
    acquisitionSubtitle: 'Nguồn chạm đầu tiên. Gộp organic/social; quảng cáo gắn UTM hiển thị riêng.',
    searchIntent: 'Hoạt động tìm kiếm',
    searchIntentSubtitle: 'Khu vực tìm kiếm; không bao giờ lưu nội dung đã nhập',
    views: 'lượt xem',
    sessionUnit: 'phiên',
    transitionUnit: 'hành trình',
    averageResults: 'kết quả TB',
  },
} as const

function numberValue(value: unknown) {
  return Number(value ?? 0) || 0
}

function percent(value: number) {
  return `${Math.round(value)}%`
}

function durationLabel(value: number) {
  const seconds = Math.max(0, Math.round(value))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return remaining ? `${minutes}m ${remaining}s` : `${minutes}m`
}

function changeLabel(current: number, previous: number, newValue: string) {
  if (previous <= 0) return current > 0 ? newValue : '0%'
  const change = Math.round(((current - previous) / previous) * 100)
  return `${change >= 0 ? '+' : ''}${change}%`
}

function activityChartScale(values: number[]) {
  const rawMax = Math.max(0, ...values)
  if (rawMax === 0) return { height: 112, max: 1, ticks: [1, 0] }

  const roughStep = Math.max(1, rawMax / 4)
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalizedStep = roughStep / magnitude
  const stepFactor = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10
  const step = Math.max(1, stepFactor * magnitude)
  const max = Math.ceil(rawMax / step) * step
  const ticks: number[] = []
  for (let value = max; value >= 0; value -= step) ticks.push(value)
  const height = Math.min(238, 112 + Math.ceil(Math.log2(max + 1)) * 14)
  return { height, max, ticks }
}

function normalizedAcquisitionMix(rows: StaffProductAnalyticsSnapshot['acquisitionMix']) {
  const grouped = new Map<string, { source: string; medium: string; sessions: number }>()

  for (const row of rows) {
    const sourceKey = row.source.trim().toLowerCase()
    const mediumKey = row.medium.trim().toLowerCase()
    const paid = PAID_ACQUISITION_MEDIUM.test(mediumKey)
    const platform = sourceKey === 'google' || sourceKey === 'google ads' || sourceKey === 'adwords'
      ? 'Google'
      : sourceKey === 'facebook' || sourceKey === 'fb' || sourceKey === 'meta'
        ? 'Facebook'
        : sourceKey === 'instagram'
          ? 'Instagram'
          : sourceKey === 'tiktok' || sourceKey === 'tik tok'
            ? 'TikTok'
            : null
    const source = platform ? `${platform}${paid ? ' Ads' : ''}` : row.source
    const medium = ORGANIC_SOCIAL_MEDIA.has(mediumKey)
      ? 'Organic social'
      : paid
        ? platform === 'Google' ? 'Paid search' : 'Paid social'
        : row.medium
    const key = `${source.toLowerCase()}\u0000${medium.toLowerCase()}`
    const existing = grouped.get(key)
    grouped.set(key, { source, medium, sessions: row.sessions + (existing?.sessions ?? 0) })
  }

  return [...grouped.values()].sort((left, right) => right.sessions - left.sessions || left.source.localeCompare(right.source))
}

type ActivityChartPoint = {
  first: number
  key: string
  label: string | null
  second: number
  title: string
}

function ActivityChart({
  firstClass,
  points,
  secondClass,
}: {
  firstClass: string
  points: ActivityChartPoint[]
  secondClass: string
}) {
  const scale = activityChartScale(points.flatMap((point) => [point.first, point.second]))
  const plotTop = 6
  const chartStyle = {
    '--activity-chart-height': `${scale.height}px`,
    '--activity-point-count': Math.max(points.length, 1),
    '--activity-plot-top': `${plotTop}px`,
  } as CSSProperties
  const barHeight = (value: number) => value > 0 ? `${Math.max(3, (value / scale.max) * 100)}%` : '0%'
  const showsLabel = (index: number, targetCount: number) => {
    if (points.length <= targetCount) return true
    const step = Math.ceil((points.length - 1) / (targetCount - 1))
    return index === 0 || index === points.length - 1 || index % step === 0
  }

  return (
    <div className="staff-insight-activity-chart" style={chartStyle}>
      {scale.ticks.map((tick) => (
        <span
          aria-hidden="true"
          className="staff-insight-activity-gridline"
          key={tick}
          style={{ top: `${plotTop + ((1 - (tick / scale.max)) * scale.height)}px` }}
        >
          <small>{tick.toLocaleString()}</small>
        </span>
      ))}
      <div className="staff-insight-activity-days">
        {points.map((point, index) => (
          <div className="staff-insight-activity-day" key={point.key} title={point.title}>
            <div className="staff-insight-activity-track">
              <span className={firstClass} style={{ height: barHeight(point.first) }} />
              <span className={secondClass} style={{ height: barHeight(point.second) }} />
            </div>
            <small className={showsLabel(index, 8) ? 'activity-label-desktop' : 'activity-label-desktop is-hidden'}>{point.label}</small>
            <small className={showsLabel(index, 5) ? 'activity-label-mobile' : 'activity-label-mobile is-hidden'}>{point.label}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

function dateLabel(value: string | null, language: 'en' | 'vi') {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en', { month: 'short', day: 'numeric' }).format(date)
}

function timeLabel(value: string | null, language: 'en' | 'vi') {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function InsightCard({
  comparison,
  help,
  icon,
  label,
  value,
}: {
  comparison: string | null
  help: string
  icon: ReactNode
  label: string
  value: string | number
}) {
  return (
    <article className="staff-insight-kpi">
      <div className="staff-insight-kpi-head">
        <span className="staff-insight-kpi-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {comparison ? <small>{comparison}</small> : null}
      <p>{help}</p>
    </article>
  )
}

export default function StaffPlayerInsights({
  compareEnabled,
  compareLabel,
  data,
  language,
  loading,
  rangeLabel,
}: StaffPlayerInsightsProps) {
  const text = copy[language]
  const digitalText = productCopy[language]
  const summary = { ...emptySummary, ...(data?.summary ?? {}) }
  const comparison = { ...emptySummary, ...(data?.comparisonSummary ?? {}) }
  const productSummary = { ...emptyProductSummary, ...(data?.productAnalytics?.summary ?? {}) }
  const productComparison = { ...emptyProductSummary, ...(data?.productAnalytics?.comparisonSummary ?? {}) }
  const maxPeak = Math.max(1, ...(data?.peakTimes ?? []).map((point) => point.visits))
  const maxGame = Math.max(1, ...(data?.gameDemand ?? []).map((game) => game.reservations))
  const maxTopPage = Math.max(1, ...(data?.productAnalytics?.topPages ?? []).map((page) => page.pageViews))
  const maxTransition = Math.max(1, ...(data?.productAnalytics?.transitions ?? []).map((transition) => transition.transitions))
  const maxSearchSurface = Math.max(1, ...(data?.productAnalytics?.searchSurfaces ?? []).map((surface) => surface.searches))
  const totalDeviceSessions = (data?.productAnalytics?.deviceMix ?? []).reduce((sum, item) => sum + item.sessions, 0)
  const acquisitionMix = normalizedAcquisitionMix(data?.productAnalytics?.acquisitionMix ?? [])
  const weekdayLabels = language === 'vi' ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayparts = ['morning', 'afternoon', 'evening'] as const
  const productFreshness = timeLabel(productSummary.latestEventAt, language)
  const comparisonFor = (current: number, previous: number) => compareEnabled
    ? `${changeLabel(current, previous, text.newValue)} ${text.vs} ${compareLabel}`
    : null

  return (
    <div className={loading ? 'staff-player-insights loading' : 'staff-player-insights'}>
      <div className="staff-insight-kpi-grid">
        <InsightCard
          comparison={comparisonFor(summary.engagedPlayers, comparison.engagedPlayers)}
          help={text.engagedHelp}
          icon={<UsersRound aria-hidden="true" size={18} />}
          label={text.engagedPlayers}
          value={summary.engagedPlayers}
        />
        <InsightCard
          comparison={comparisonFor(summary.completedVisits, comparison.completedVisits)}
          help={text.visitsHelp}
          icon={<CalendarCheck2 aria-hidden="true" size={18} />}
          label={text.completedVisits}
          value={summary.completedVisits}
        />
        <InsightCard
          comparison={comparisonFor(summary.returningPlayers, comparison.returningPlayers)}
          help={text.returningHelp}
          icon={<Repeat2 aria-hidden="true" size={18} />}
          label={text.returningPlayers}
          value={summary.returningPlayers}
        />
        <InsightCard
          comparison={comparisonFor(summary.attendanceRate, comparison.attendanceRate)}
          help={text.attendanceHelp}
          icon={<Target aria-hidden="true" size={18} />}
          label={text.attendance}
          value={percent(summary.attendanceRate)}
        />
        <InsightCard
          comparison={comparisonFor(summary.repeatRate, comparison.repeatRate)}
          help={text.repeatHelp}
          icon={<Activity aria-hidden="true" size={18} />}
          label={text.repeatRate}
          value={percent(summary.repeatRate)}
        />
        <InsightCard
          comparison={comparisonFor(summary.averageVisitsPerPlayer, comparison.averageVisitsPerPlayer)}
          help={text.frequencyHelp}
          icon={<Gauge aria-hidden="true" size={18} />}
          label={text.visitFrequency}
          value={numberValue(summary.averageVisitsPerPlayer).toFixed(1)}
        />
      </div>

      {summary.engagedPlayers === 0 ? <p className="staff-insights-empty">{text.empty}</p> : null}

      <div className="staff-insights-grid">
        <section className="staff-insight-panel staff-insight-activity-panel" aria-label={text.activityTitle}>
          <div className="staff-insight-panel-head">
            <div>
              <h5>{text.activityTitle}</h5>
              <span>{text.activitySubtitle}</span>
            </div>
            <div className="staff-insight-legend" aria-hidden="true">
              <span><i className="reservations" />{text.reservations}</span>
              <span><i className="check-ins" />{text.checkIns}</span>
            </div>
          </div>
          <ActivityChart
            firstClass="reservations"
            points={(data?.activitySeries ?? []).map((point) => ({
              first: point.reservations,
              key: point.date,
              label: dateLabel(point.date, language),
              second: point.checkIns,
              title: `${dateLabel(point.date, language)} · ${text.reservations} ${point.reservations} · ${text.checkIns} ${point.checkIns}`,
            }))}
            secondClass="check-ins"
          />
        </section>

        <section className="staff-insight-panel" aria-label={text.peakTitle}>
          <div className="staff-insight-panel-head">
            <div>
              <h5>{text.peakTitle}</h5>
              <span>{text.peakSubtitle}</span>
            </div>
          </div>
          <div className="staff-insight-heatmap">
            <span />
            {dayparts.map((daypart) => <strong key={daypart}>{text[daypart]}</strong>)}
            {weekdayLabels.map((weekday, weekdayIndex) => (
              <div className="staff-insight-heatmap-row" key={weekday}>
                <strong>{weekday}</strong>
                {dayparts.map((daypart) => {
                  const point = data?.peakTimes.find((item) => item.weekday === weekdayIndex + 1 && item.daypart === daypart)
                  const intensity = point?.visits ? Math.round((point.visits / maxPeak) * 82) + 12 : 5
                  return (
                    <span
                      key={daypart}
                      style={{ '--heat-intensity': `${intensity}%` } as CSSProperties}
                      title={`${weekday} · ${text[daypart]} · ${point?.visits ?? 0} ${text.visits}`}
                    >
                      {point?.visits ?? 0}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="staff-insight-panel" aria-label={text.gameTitle}>
          <div className="staff-insight-panel-head">
            <div>
              <h5>{text.gameTitle}</h5>
              <span>{text.gameSubtitle}</span>
            </div>
            <Gamepad2 aria-hidden="true" size={18} />
          </div>
          <div className="staff-insight-ranking">
            {(data?.gameDemand ?? []).map((game, index) => (
              <div className="staff-insight-ranking-row" key={game.gameKey}>
                <span>{index + 1}</span>
                <div>
                  <strong>{game.gameName}</strong>
                  <small>{game.visits} {text.visits} · {game.reservations} {text.bookings}</small>
                  <div><i style={{ width: `${Math.max(4, (game.reservations / maxGame) * 100)}%` }} /></div>
                </div>
              </div>
            ))}
            {(data?.gameDemand.length ?? 0) === 0 ? <p>{text.empty}</p> : null}
          </div>
        </section>

        <section className="staff-insight-panel staff-insight-signal-panel">
          <div className="staff-insight-panel-head">
            <div>
              <h5>{text.socialTitle}</h5>
              <span>{rangeLabel}</span>
            </div>
            <MessageCircle aria-hidden="true" size={18} />
          </div>
          <div className="staff-insight-signal-grid">
            <div><span>{text.messages}</span><strong>{summary.messages}</strong></div>
            <div><span>{text.clubJoins}</span><strong>{summary.clubJoins}</strong></div>
          </div>
          <div className="staff-insight-panel-head staff-insight-performance-head">
            <div>
              <h5>{text.performanceTitle}</h5>
              <span>{summary.resultRows} / {summary.completedVisits} {text.coverage.toLowerCase()}</span>
            </div>
            <Target aria-hidden="true" size={18} />
          </div>
          <div className="staff-insight-signal-grid three">
            <div><span>{text.averageScore}</span><strong>{Math.round(summary.averageScore).toLocaleString()}</strong></div>
            <div><span>{text.averageAccuracy}</span><strong>{percent(summary.averageAccuracy)}</strong></div>
            <div><span>{text.coverage}</span><strong>{percent(summary.resultCoverage)}</strong></div>
          </div>
        </section>
      </div>

      <section className="staff-digital-journey" aria-label={digitalText.title}>
        <header className="staff-digital-journey-head">
          <div>
            <span className="staff-insights-eyebrow"><Route aria-hidden="true" size={15} /> {digitalText.eyebrow}</span>
            <h4>{digitalText.title}</h4>
            <p>{digitalText.subtitle}</p>
          </div>
          <div className="staff-digital-journey-meta">
            <span><ShieldCheck aria-hidden="true" size={14} /> {digitalText.privacy}</span>
            <small>{digitalText.coverage}</small>
            {productFreshness && <small>{text.freshness} {productFreshness}</small>}
          </div>
        </header>

        <div className="staff-insight-kpi-grid staff-digital-kpi-grid">
          <InsightCard
            comparison={comparisonFor(productSummary.sessions, productComparison.sessions)}
            help={digitalText.sessionsHelp}
            icon={<Route aria-hidden="true" size={18} />}
            label={digitalText.sessions}
            value={productSummary.sessions}
          />
          <InsightCard
            comparison={comparisonFor(productSummary.visitors, productComparison.visitors)}
            help={digitalText.visitorsHelp}
            icon={<UsersRound aria-hidden="true" size={18} />}
            label={digitalText.visitors}
            value={productSummary.visitors}
          />
          <InsightCard
            comparison={comparisonFor(productSummary.pagesPerSession, productComparison.pagesPerSession)}
            help={digitalText.pagesHelp}
            icon={<MousePointerClick aria-hidden="true" size={18} />}
            label={digitalText.pagesPerSession}
            value={numberValue(productSummary.pagesPerSession).toFixed(1)}
          />
          <InsightCard
            comparison={comparisonFor(productSummary.averageSessionSeconds, productComparison.averageSessionSeconds)}
            help={digitalText.timeHelp}
            icon={<Timer aria-hidden="true" size={18} />}
            label={digitalText.engagedTime}
            value={durationLabel(productSummary.averageSessionSeconds)}
          />
          <InsightCard
            comparison={comparisonFor(productSummary.searches, productComparison.searches)}
            help={digitalText.searchesHelp}
            icon={<Search aria-hidden="true" size={18} />}
            label={digitalText.searches}
            value={productSummary.searches}
          />
          <InsightCard
            comparison={comparisonFor(productSummary.searchRate, productComparison.searchRate)}
            help={digitalText.searchRateHelp}
            icon={<Target aria-hidden="true" size={18} />}
            label={digitalText.searchRate}
            value={percent(productSummary.searchRate)}
          />
        </div>

        {productSummary.sessions > 0 ? (
          <div className="staff-digital-grid">
            <section className="staff-insight-panel staff-digital-trend-panel" aria-label={digitalText.trendTitle}>
              <div className="staff-insight-panel-head">
                <div><h5>{digitalText.trendTitle}</h5><span>{digitalText.trendSubtitle}</span></div>
                <div className="staff-insight-legend" aria-hidden="true">
                  <span><i className="digital-views" />{digitalText.pageViews}</span>
                  <span><i className="digital-sessions" />{digitalText.sessions}</span>
                </div>
              </div>
              <ActivityChart
                firstClass="digital-views"
                points={(data?.productAnalytics?.activitySeries ?? []).map((point) => ({
                  first: point.pageViews,
                  key: point.date,
                  label: dateLabel(point.date, language),
                  second: point.sessions,
                  title: `${dateLabel(point.date, language)} · ${point.pageViews} ${digitalText.views} · ${point.sessions} ${digitalText.sessionUnit}`,
                }))}
                secondClass="digital-sessions"
              />
            </section>

            <section className="staff-insight-panel" aria-label={digitalText.topPages}>
              <div className="staff-insight-panel-head">
                <div><h5>{digitalText.topPages}</h5><span>{digitalText.topPagesSubtitle}</span></div>
                <MousePointerClick aria-hidden="true" size={18} />
              </div>
              <div className="staff-insight-ranking">
                {(data?.productAnalytics?.topPages ?? []).map((page, index) => (
                  <div className="staff-insight-ranking-row" key={page.path}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{page.path}</strong>
                      <small>{page.pageViews} {digitalText.views} · {page.visitors} {digitalText.visitors.toLowerCase()} · {durationLabel(page.engagementSeconds)}</small>
                      <div><i style={{ width: `${Math.max(4, (page.pageViews / maxTopPage) * 100)}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="staff-insight-panel" aria-label={digitalText.journeys}>
              <div className="staff-insight-panel-head">
                <div><h5>{digitalText.journeys}</h5><span>{digitalText.journeysSubtitle}</span></div>
                <Route aria-hidden="true" size={18} />
              </div>
              <div className="staff-insight-ranking staff-digital-journeys">
                {(data?.productAnalytics?.transitions ?? []).map((transition, index) => (
                  <div className="staff-insight-ranking-row" key={`${transition.fromPath}-${transition.toPath}`}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{transition.fromPath} <b aria-hidden="true">→</b> {transition.toPath}</strong>
                      <small>{transition.transitions} {digitalText.transitionUnit}</small>
                      <div><i style={{ width: `${Math.max(4, (transition.transitions / maxTransition) * 100)}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="staff-insight-panel staff-digital-audience" aria-label={digitalText.devices}>
              <div className="staff-digital-breakdown">
                <div>
                  <div className="staff-insight-panel-head">
                    <div><h5>{digitalText.devices}</h5><span>{digitalText.devicesSubtitle}</span></div>
                    <MonitorSmartphone aria-hidden="true" size={18} />
                  </div>
                  <div className="staff-digital-mix-list">
                    {(data?.productAnalytics?.deviceMix ?? []).map((device) => (
                      <div key={device.deviceClass}>
                        <span><strong>{device.deviceClass}</strong><small>{device.sessions} {digitalText.sessionUnit}</small></span>
                        <i><b style={{ width: `${totalDeviceSessions ? (device.sessions / totalDeviceSessions) * 100 : 0}%` }} /></i>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="staff-insight-panel-head">
                    <div><h5>{digitalText.acquisition}</h5><span>{digitalText.acquisitionSubtitle}</span></div>
                  </div>
                  <div className="staff-digital-source-list">
                    {acquisitionMix.map((source) => (
                      <div key={`${source.source}-${source.medium}`}><span><strong>{source.source}</strong><small>{source.medium}</small></span><b>{source.sessions}</b></div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="staff-insight-panel staff-digital-search-panel" aria-label={digitalText.searchIntent}>
              <div className="staff-insight-panel-head">
                <div><h5>{digitalText.searchIntent}</h5><span>{digitalText.searchIntentSubtitle}</span></div>
                <Search aria-hidden="true" size={18} />
              </div>
              <div className="staff-insight-ranking">
                {(data?.productAnalytics?.searchSurfaces ?? []).map((surface, index) => (
                  <div className="staff-insight-ranking-row" key={surface.surface}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{surface.surface}</strong>
                      <small>{surface.searches} {digitalText.searches.toLowerCase()}{surface.averageResults === null ? '' : ` · ${surface.averageResults} ${digitalText.averageResults}`}</small>
                      <div><i style={{ width: `${Math.max(4, (surface.searches / maxSearchSurface) * 100)}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>

      <section className="staff-insight-panel staff-insight-player-panel" aria-label={text.playersTitle}>
        <div className="staff-insight-panel-head">
          <div>
            <h5>{text.playersTitle}</h5>
            <span>{rangeLabel}</span>
          </div>
          <UsersRound aria-hidden="true" size={18} />
        </div>
        <div className="staff-insight-player-table-wrap">
          <table className="staff-insight-player-table">
            <thead>
              <tr>
                <th>{text.player}</th>
                <th>{text.segment}</th>
                <th>{text.reservations}</th>
                <th>{text.checkIns}</th>
                <th>{text.favoriteGame}</th>
                <th>{text.lastVisit}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.players ?? []).map((player) => (
                <tr key={player.profileId}>
                  <td><strong>{player.displayName}</strong></td>
                  <td><span className={`staff-insight-segment ${player.segment}`}>{text[player.segment]}</span></td>
                  <td>{player.reservations}</td>
                  <td>{player.checkIns}</td>
                  <td>{player.favoriteGame}</td>
                  <td>{dateLabel(player.lastVisit, language) ?? text.noVisits}</td>
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
            <h5>{text.scopeTitle}</h5>
            <p>{text.scopeBody}</p>
          </div>
        </div>
        <div className="staff-insights-scope-columns">
          <div>
            <strong>{text.tracked}</strong>
            <p>{text.trackedBody}</p>
          </div>
          <div>
            <strong>{text.missing}</strong>
            <p>{text.missingBody}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
