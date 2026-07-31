'use client'

import {
  Activity,
  CalendarCheck2,
  CircleAlert,
  Gamepad2,
  Gauge,
  MessageCircle,
  Repeat2,
  ShieldCheck,
  Target,
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
    noComparison: 'Comparison off',
    newValue: 'New',
    activityTitle: 'Engagement trend',
    activitySubtitle: 'Daily reservations and completed visits',
    reservations: 'Reservations',
    checkIns: 'Check-ins',
    peakTitle: 'When players visit',
    peakSubtitle: 'Check-ins by weekday and daypart',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
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
    scopeBody: 'It measures real records created by the app and venue team. It does not infer intent or silently track navigation.',
    tracked: 'Tracked now',
    trackedBody: 'reservations · check-ins · scores · accuracy · session messages · club joins',
    missing: 'Not tracked yet',
    missingBody: 'Page views, click paths, searches, time in app, device and acquisition source need a consent-aware product analytics layer.',
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
    noComparison: 'Chưa bật so sánh',
    newValue: 'Mới',
    activityTitle: 'Xu hướng tương tác',
    activitySubtitle: 'Đặt chỗ và lượt chơi hoàn tất theo ngày',
    reservations: 'Đặt chỗ',
    checkIns: 'Check-in',
    peakTitle: 'Thời điểm người chơi ghé',
    peakSubtitle: 'Check-in theo ngày và buổi',
    morning: 'Sáng',
    afternoon: 'Chiều',
    evening: 'Tối',
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
    scopeBody: 'Báo cáo dùng dữ liệu thật do app và đội ngũ cơ sở tạo ra. Không suy đoán ý định hoặc âm thầm theo dõi điều hướng.',
    tracked: 'Đang theo dõi',
    trackedBody: 'đặt chỗ · check-in · điểm số · độ chính xác · tin nhắn phiên · tham gia câu lạc bộ',
    missing: 'Chưa theo dõi',
    missingBody: 'Lượt xem trang, đường dẫn click, tìm kiếm, thời gian trong app, thiết bị và nguồn truy cập cần lớp phân tích có cơ chế đồng ý.',
    empty: 'Không có hoạt động người chơi trong khoảng này. Hãy thử 30 hoặc 90 ngày gần nhất.',
    freshness: 'Cập nhật',
  },
} as const

function numberValue(value: unknown) {
  return Number(value ?? 0) || 0
}

function percent(value: number) {
  return `${Math.round(value)}%`
}

function changeLabel(current: number, previous: number, newValue: string) {
  if (previous <= 0) return current > 0 ? newValue : '0%'
  const change = Math.round(((current - previous) / previous) * 100)
  return `${change >= 0 ? '+' : ''}${change}%`
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
  comparison: string
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
      <small>{comparison}</small>
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
  const summary = { ...emptySummary, ...(data?.summary ?? {}) }
  const comparison = { ...emptySummary, ...(data?.comparisonSummary ?? {}) }
  const maxActivity = Math.max(1, ...(data?.activitySeries ?? []).flatMap((point) => [point.reservations, point.checkIns]))
  const maxPeak = Math.max(1, ...(data?.peakTimes ?? []).map((point) => point.visits))
  const maxGame = Math.max(1, ...(data?.gameDemand ?? []).map((game) => game.reservations))
  const weekdayLabels = language === 'vi' ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayparts = ['morning', 'afternoon', 'evening'] as const
  const sourceFreshness = timeLabel(summary.latestSourceAt, language)
  const comparisonFor = (current: number, previous: number) => compareEnabled
    ? `${changeLabel(current, previous, text.newValue)} ${text.vs} ${compareLabel}`
    : text.noComparison

  return (
    <div className={loading ? 'staff-player-insights loading' : 'staff-player-insights'}>
      <header className="staff-insights-hero">
        <div>
          <span className="staff-insights-eyebrow"><Activity aria-hidden="true" size={15} /> {text.liveSources}</span>
          <h4>{text.title}</h4>
          <p>{text.subtitle}</p>
        </div>
        <div className="staff-insights-hero-meta">
          <strong>{rangeLabel}</strong>
          <span className={summary.resultCoverage >= 75 ? 'good' : 'caution'}>
            {summary.resultCoverage >= 75 ? <ShieldCheck aria-hidden="true" size={14} /> : <CircleAlert aria-hidden="true" size={14} />}
            {summary.resultCoverage >= 75 ? text.strongCoverage : text.lowCoverage} · {percent(summary.resultCoverage)}
          </span>
          {sourceFreshness && <small>{text.freshness} {sourceFreshness}</small>}
        </div>
      </header>

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
          <div className="staff-insight-activity-chart">
            {(data?.activitySeries ?? []).map((point) => (
              <div className="staff-insight-activity-day" key={point.date} title={`${dateLabel(point.date, language)} · ${text.reservations} ${point.reservations} · ${text.checkIns} ${point.checkIns}`}>
                <div className="staff-insight-activity-track">
                  <span className="reservations" style={{ height: `${Math.max(3, (point.reservations / maxActivity) * 100)}%` }} />
                  <span className="check-ins" style={{ height: `${Math.max(3, (point.checkIns / maxActivity) * 100)}%` }} />
                </div>
                <small>{dateLabel(point.date, language)}</small>
              </div>
            ))}
          </div>
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
