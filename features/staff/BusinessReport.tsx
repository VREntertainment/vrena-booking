'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Banknote, MapPin } from 'lucide-react'
import { ReportToolbarMenu } from './ReportToolbarMenu'
import { brandedGameName } from '../../lib/anvio'
import { orderedRange, previousPeriodRange } from '../../lib/staff/dates'
import { decisionPeriod, reportDayCount, reportVenue, reportVenueKeys, type ReportVenue, type ReportVenueFilter } from '../../lib/staff/decisionReport'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import type { StaffReportSummary } from '../../lib/staff/types'
import { supabase } from '../../lib/supabase/client'
import { bookingSourceLabel } from '../../lib/staff/reportDisplay'
import { loadDecisionReport } from './decisionReportData'
import { ReportHeatmap, ReportPanel, ReportRanking, ReportTrend, ReportVenueBars, ReportVenueLegend, reportNumber, type ChartColor } from './reportCharts'
import styles from './ReportCharts.module.css'

type Props = {
  start: string; end: string; compareStart: string; compareEnd: string; compare: boolean
  language: 'en' | 'vi'; text: StaffConsoleCopy; financial: StaffReportSummary | null
  toolbar: (venueControl: ReactNode) => ReactNode
}
type VenueMetric = 'revenue' | 'bookings' | 'players' | 'paidPlayers'
type Facts = Awaited<ReturnType<typeof loadDecisionReport>>
type CatalogEntry = { id: string; title: string; parent_slug: string; kind: string }
type Snapshot = { key: string; current: Facts; previous: Facts | null; locations: string[]; games: CatalogEntry[] }
const colors: Record<ReportVenue, ChartColor> = { 'ha-do-centrosa': 'hado', 'cafe-des-stagiaires': 'thao', other: 'other' }
const wholeDate = (date: string) => new Date(`${date}T00:00:00Z`)
const labelDate = (date: string, language: string) => new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
}).format(wholeDate(date))

const labels = {
  en: {
    venue: 'Venue', all: 'All accessible venues', other: 'Unassigned venue',
    sales: 'Booked sales', revenue: 'Revenue', net: 'Net sales', gross: 'Gross sales', grossUnavailable: 'Gross sales are unavailable for part of this period.', bookings: 'Bookings', players: 'Booked players', paid: 'Paid players',
    perDay: 'Players per day', perSession: 'Players per session',
    trend: 'Booking trend', trendDescription: 'Compare the same day or interval within each selected period.',
    day: 'Bookings by weekday', time: 'Bookings by start hour', heat: 'Peak booking slots',
    heatDescription: 'Bookings by weekday and local start hour. Cell values are bookings.',
    games: 'Most-played games', gameDescription: 'Sessions where staff recorded each game as played. A session can count toward multiple games.',
    previous: 'Comparison', current: 'Selected period', noData: 'No data for this period.', load: 'Loading venue and booking metrics…',
    missing: 'The booking metrics could not load.', gameMissing: 'Recorded gameplay data could not load.',
    gameEmpty: 'No recorded games are available for this selection.', gameCoverage: 'sessions with recorded gameplay',
    venueComparison: 'Venue Comparison', millionVnd: 'million VND', paidPlayerCount: (formatted: string, value: number) => `${formatted} paid ${value === 1 ? 'player' : 'players'}`, viewVenueData: 'View venue data', priorUnavailable: 'Previous-period data could not load.',
    peak: 'Busiest', cancelled: 'Cancelled', noShows: 'No-shows', retry: 'Retry', metric: 'Metric', period: 'Period',
    mix: 'Payment mix',
    more: 'More games', less: 'Show fewer games',
  },
  vi: {
    venue: 'Địa điểm', all: 'Tất cả địa điểm được phép', other: 'Chưa xác định địa điểm',
    sales: 'Doanh số đặt chỗ', revenue: 'Doanh thu', net: 'Doanh thu thuần', gross: 'Doanh thu gộp', grossUnavailable: 'Thiếu dữ liệu doanh thu gộp cho một phần của kỳ này.', bookings: 'Lượt đặt', players: 'Người chơi đã đặt', paid: 'Người chơi đã thanh toán',
    perDay: 'Người chơi mỗi ngày', perSession: 'Người chơi mỗi phiên',
    trend: 'Xu hướng đặt chỗ', trendDescription: 'So sánh theo cùng vị trí ngày hoặc khoảng thời gian trong mỗi kỳ.',
    day: 'Lượt đặt theo ngày trong tuần', time: 'Lượt đặt theo giờ bắt đầu', heat: 'Khung giờ được đặt nhiều nhất',
    heatDescription: 'Lượt đặt theo ngày trong tuần và giờ bắt đầu tại Việt Nam.',
    games: 'Trò chơi được chơi nhiều nhất', gameDescription: 'Số phiên mà nhân viên ghi nhận trò chơi đã được chơi. Một phiên có thể tính cho nhiều trò chơi.',
    previous: 'Kỳ so sánh', current: 'Kỳ đã chọn', noData: 'Không có dữ liệu trong kỳ này.', load: 'Đang tải số liệu địa điểm và đặt chỗ…',
    missing: 'Không thể tải số liệu đặt chỗ.', gameMissing: 'Không thể tải dữ liệu trò chơi đã chơi.',
    gameEmpty: 'Chưa ghi nhận trò chơi nào cho lựa chọn này.', gameCoverage: 'phiên đã ghi nhận trò chơi',
    venueComparison: 'So sánh địa điểm', millionVnd: 'triệu đồng', paidPlayerCount: (formatted: string) => `${formatted} người chơi đã thanh toán`, viewVenueData: 'Xem dữ liệu địa điểm', priorUnavailable: 'Không tải được dữ liệu kỳ trước.',
    peak: 'Cao nhất', cancelled: 'Đã hủy', noShows: 'Không đến', retry: 'Thử lại', metric: 'Chỉ số', period: 'Kỳ',
    mix: 'Cơ cấu thanh toán',
    more: 'Thêm trò chơi', less: 'Thu gọn',
  },
}

function gameLabel(id: string, catalog: Map<string, CatalogEntry>) {
  const game = catalog.get(id)
  if (!game) return id
  if (game.kind === 'game') return brandedGameName(game.parent_slug, game.title)
  return `${catalog.get(game.parent_slug)?.title || game.parent_slug} — ${game.title}`
}

export default function BusinessReport({ start, end, compareStart, compareEnd, compare, language, text, financial, toolbar }: Props) {
  const [selectedVenues, setSelectedVenues] = useState<ReadonlySet<ReportVenue> | null>(null)
  const [revenueBasis, setRevenueBasis] = useState<'net' | 'gross'>('net')
  const [metric, setMetric] = useState<'revenue' | 'sales' | 'bookings' | 'players' | 'paidPlayers'>('revenue')
  const [showGames, setShowGames] = useState(false)
  const [heatComparison, setHeatComparison] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [failed, setFailed] = useState('')
  const [retry, setRetry] = useState(0)
  const [from, to] = orderedRange(start, end)
  const [compareFrom, compareTo] = compare ? orderedRange(compareStart, compareEnd) : previousPeriodRange(from, to)
  const key = `${from}/${to}/${compare ? `${compareFrom}/${compareTo}` : ''}/${retry}`
  const t = labels[language]

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    async function load() {
      try {
        const [current, previous, venues, games] = await Promise.all([
          loadDecisionReport({ start: from, end: to }, signal),
          loadDecisionReport({ start: compareFrom, end: compareTo }, signal).catch((error: unknown) => {
            if (compare) throw error
            return null
          }),
          supabase.rpc('staff_access_locations').abortSignal(signal),
          supabase.from('staff_playable_games').select('id,title,parent_slug,kind').abortSignal(signal),
        ])
        if (!signal.aborted) setSnapshot({
          key, current, previous,
          locations: (venues.data ?? []).map((row: { venue_key: string }) => row.venue_key),
          games: (games.data ?? []) as CatalogEntry[],
        })
      } catch {
        if (!signal.aborted) setFailed(key)
      }
    }
    void load()
    return () => controller.abort()
  }, [from, to, compare, compareFrom, compareTo, key])

  const loaded = snapshot?.key === key ? snapshot : null
  const venueNames = { 'ha-do-centrosa': 'Hà Đô Centrosa', 'cafe-des-stagiaires': 'Thảo Điền', other: t.other }
  const locations = reportVenueKeys.filter((item) => snapshot?.locations.includes(item) || snapshot?.current.orders.some((order) =>
    item === reportVenue(order.sessions?.venue_key, order.arena_id)))
  const selected = selectedVenues ? locations.filter((item) => selectedVenues.has(item)) : locations
  const filter = selectedVenues === null ? 'all' : new Set(selected)
  const allSelected = selectedVenues === null || selected.length === locations.length && locations.length > 0
  const venueControl = <ReportToolbarMenu label={t.venue} hideLabel icon={<MapPin size={15} aria-hidden="true" />}
    value={allSelected ? t.all : selected.length ? selected.map((item) => venueNames[item]).join(', ') : language === 'vi' ? 'Chưa chọn địa điểm' : 'No venues selected'}>
    <label><input type="checkbox" checked={allSelected} disabled={!locations.length}
      ref={(node) => { if (node) node.indeterminate = !allSelected && selected.length > 0 }}
      onChange={(event) => setSelectedVenues(event.target.checked ? null : new Set())} />{t.all}</label>
    {locations.map((item) => <label key={item}>
      <input type="checkbox" checked={selected.includes(item)} onChange={(event) => {
        const next = new Set(selected)
        if (event.target.checked) next.add(item)
        else next.delete(item)
        setSelectedVenues(next.size === locations.length ? null : next)
      }} />
      <span className="venue-indicator" data-venue={item}>{venueNames[item]}</span>
    </label>)}
  </ReportToolbarMenu>

  const grossAvailable = Boolean(loaded?.current.posThrough && loaded.current.netSales.every((sale) => sale.gross_sales != null)
    && (!compare || loaded.previous?.netSales.every((sale) => sale.gross_sales != null)))
  const useGross = revenueBasis === 'gross' && grossAvailable
  const revenueKey = useGross ? 'grossSales' : 'netSales'
  const revenueLabel = useGross ? t.gross : t.net
  const controls = <>{venueControl}
    <ReportToolbarMenu label={t.revenue} hideLabel icon={<Banknote size={15} aria-hidden="true" />} value={revenueLabel}>
      <button type="button" aria-pressed={!useGross} onClick={() => setRevenueBasis('net')}>{t.net}</button>
      <button type="button" aria-pressed={useGross} disabled={!grossAvailable}
        title={grossAvailable ? undefined : t.grossUnavailable} onClick={() => setRevenueBasis('gross')}>{t.gross}</button>
    </ReportToolbarMenu>
  </>

  const days = Math.max(reportDayCount(from, to), compare ? reportDayCount(compareFrom, compareTo) : 0)
  const binDays = days > 62 ? Math.ceil(days / (62 * 7)) * 7 : 1
  const periods = loaded ? {
    current: decisionPeriod(from, to, loaded.current.orders, loaded.current.played ?? [], filter, binDays, loaded.current.netSales),
    previous: compare && loaded.previous ? decisionPeriod(compareFrom, compareTo, loaded.previous.orders, loaded.previous.played ?? [], filter, binDays, loaded.previous.netSales) : null,
  } : null
  const byLocation = periods && loaded ? selected.flatMap((item) =>
    periods.current.byVenue[item].bookings || periods.previous?.byVenue[item].bookings ||
    periods.current.byVenue[item][revenueKey] || periods.previous?.byVenue[item][revenueKey] ? [{
      item,
      current: decisionPeriod(from, to, loaded.current.orders, [], item, binDays, loaded.current.netSales).buckets,
      previous: compare && loaded.previous ? decisionPeriod(compareFrom, compareTo, loaded.previous.orders, [], item, binDays, loaded.previous.netSales).buckets : [],
    }] : []) : []

  const count = (value: number) => reportNumber(language, value)
  const money = (value: number) => `${count(value)} ₫`
  const shortMoney = (value: number) => {
    const absolute = Math.abs(value)
    return absolute >= 1e9 ? `${reportNumber(language, value / 1e9, 1)}B`
      : absolute >= 1e6 ? `${reportNumber(language, value / 1e6, 1)}M`
        : absolute >= 1e3 ? `${reportNumber(language, value / 1e3, 1)}k` : count(value)
  }
  if (!periods || !loaded) return <>{toolbar(controls)}<div className={styles.dashboard}>
    {failed === key
      ? <p role="alert">{t.missing} <button type="button" onClick={() => setRetry((value) => value + 1)}>{t.retry}</button></p>
      : <p role="status" className={styles.note}>{t.load}</p>}
  </div></>

  const { current, previous } = periods
  const venueMetrics = { revenue: revenueLabel, bookings: t.bookings, players: t.players, paidPlayers: t.paid }
  const metrics = { ...venueMetrics, sales: t.sales }
  const moneyMetric = metric === 'sales' || metric === 'revenue'
  const chartKey = metric === 'revenue' ? revenueKey : metric
  const displayMetric = moneyMetric ? money : count
  const dotColor = selected.length === 1 ? colors[selected[0]] : 'primary'
  const describeBin = (point: typeof current.buckets[number]) => point.from === point.to
    ? labelDate(point.from, language) : `${labelDate(point.from, language)}–${labelDate(point.to, language)}`
  const axis = Array.from({ length: Math.max(current.buckets.length, previous?.buckets.length ?? 0) }, (_, i) =>
    current.buckets[i] ? labelDate(current.buckets[i].from, language) : previous?.buckets[i] ? labelDate(previous.buckets[i].from, language) : '')
  const trendVenues: { item: ReportVenueFilter; current: typeof current.buckets; previous: typeof current.buckets }[] = byLocation.length
    ? byLocation : [{ item: selected.length === 1 ? selected[0] : 'all', current: current.buckets, previous: previous?.buckets ?? [] }]
  const trendSeries = trendVenues
    .flatMap(({ item, current: primary, previous: secondary }) => {
      const color = item === 'all' ? dotColor : colors[item]
      const venueName = item === 'all' ? '' : `${venueNames[item]} · `
      return [
        { label: `${venueName}${compare ? t.current : ''}`.replace(/ · $/, '') || t.current, color, values: primary.map((point) => point[chartKey]), dates: primary.map(describeBin) },
        ...(previous ? [{ label: `${venueName}${t.previous}`, color, values: secondary.map((point) => point[chartKey]), dates: secondary.map(describeBin), comparison: true }] : []),
      ]
    })
  const weekdayDates = [4, 5, 6, 7, 8, 9, 10]
  const weekdays = weekdayDates.map((date) => new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, 0, date + 1))))
  const hourText = (hour: number) => `${String(hour).padStart(2, '0')}:00`
  const hourIndices = current.times.map((_, hour) => hour).filter((hour) => hour >= 9 && hour <= 22 || current.times[hour] || previous?.times[hour])
  const heat = heatComparison && previous ? previous : current
  const peakDay = current.weekdays.indexOf(Math.max(...current.weekdays))
  const peakHour = current.times.indexOf(Math.max(...current.times))
  const catalog = new Map(loaded.games.map((game) => [game.id, game]))
  const games = [...new Set([...current.games.keys(), ...(previous ? [...previous.games.keys()] : [])])].map((id) => {
    const totals = current.games.get(id)
    const former = previous?.games.get(id)
    const parts = reportVenueKeys.map((item) => ({ label: venueNames[item], value: totals?.[item] ?? 0, color: colors[item] })).filter((item) => item.value)
    const value = parts.reduce((total, entry) => total + entry.value, 0)
    const before = reportVenueKeys.reduce((total, item) => total + (former?.[item] ?? 0), 0)
    const detail = [...parts.map((part) => `${part.label} ${count(part.value)}`), ...(previous ? [`${t.previous} ${count(before)}`] : [])].join(' · ')
    return { id, label: gameLabel(id, catalog), value, detail, parts }
  }).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  const venueTotals = reportVenueKeys.filter((item) => locations.includes(item) || current.byVenue[item].bookings || previous?.byVenue[item].bookings)
  const venuePrevious = previous ?? (loaded.previous
    ? decisionPeriod(compareFrom, compareTo, loaded.previous.orders, [], filter, binDays, loaded.previous.netSales) : null)
  const venuePeriods = [venuePrevious, current]
  const venueMetricKeys = Object.keys(venueMetrics) as VenueMetric[]
  const priorGrossAvailable = Boolean(loaded.previous?.posThrough && loaded.previous.netSales.every((sale) => sale.gross_sales != null))
  const periodDate = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
  const dateRange = (first: string, last: string) => periodDate.formatRange(wholeDate(first), wholeDate(last))
  const currentDates = dateRange(from, to)
  const previousDates = previous ? dateRange(compareFrom, compareTo) : null
  const comparedDates = previousDates ? `${currentDates} ${language === 'vi' ? 'so với' : 'vs.'} ${previousDates}` : currentDates
  const venueSeriesPeriods = [
    { label: t.previous, dates: dateRange(compareFrom, compareTo), comparison: true },
    { label: t.current, dates: currentDates },
  ]
  const venueValue = (period: typeof current | null, item: ReportVenue, metricKey: VenueMetric) =>
    !period || period === venuePrevious && metricKey === 'revenue' && useGross && !priorGrossAvailable
      ? null
      : period.byVenue[item][metricKey === 'revenue' ? revenueKey : metricKey]
  const formatVenueValue = (value: number | null, metricKey: VenueMetric) =>
    value === null ? '—' : (metricKey === 'revenue' ? money : count)(value)
  const summary = [
    { label: revenueLabel, value: current[revenueKey], previous: previous?.[revenueKey], format: money },
    { label: t.bookings, value: current.bookings, previous: previous?.bookings, format: count },
    { label: t.players, value: current.players, previous: previous?.players, format: count },
    { label: t.paid, value: current.paidPlayers, previous: previous?.paidPlayers, format: count },
    { label: t.perDay, value: current.playersPerDay, previous: previous?.playersPerDay, format: (value: number) => reportNumber(language, value, 1) },
    { label: t.perSession, value: current.playersPerSession, previous: previous?.playersPerSession, format: (value: number) => reportNumber(language, value, 1) },
    { label: t.cancelled, value: current.cancelled, previous: previous?.cancelled, format: count },
    { label: t.noShows, value: current.noShows, previous: previous?.noShows, format: count },
  ]
  const payments = financial ? [
    { label: text.labels.cash, value: financial.cashTotal },
    { label: text.labels.bankTransfer, value: financial.bankTransferTotal },
    { label: text.paymentMethods.card_manual, value: financial.cardTotal },
    { label: text.paymentMethods.momo_manual, value: financial.momoTotal },
    { label: text.paymentMethods.vnpay, value: financial.vnpayTotal },
    { label: text.unpaid, value: financial.unpaidAmount },
  ].sort((a, b) => b.value - a.value) : []
  return <>{toolbar(controls)}<div className={styles.dashboard}>
    <dl className={styles.metrics}>{summary.map((item) => <div key={item.label}>
      <dt>{item.label}</dt><dd>{item.value == null ? '—' : item.format(item.value)}</dd>
      {previous && <small>{t.previous} · {item.previous == null ? '—' : item.format(item.previous)}</small>}
    </div>)}</dl>
    <div className={styles.grid}>
      <ReportPanel title={t.trend} period={comparedDates} description={t.trendDescription} wide actions={<div className={styles.controls}>
        <label>{t.metric}<select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}>
          {Object.entries(metrics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>}>
        <ReportTrend label={metrics[metric]} labels={axis} series={trendSeries} valueLabel={displayMetric}
          tickLabel={moneyMetric ? shortMoney : count} language={language} />
      </ReportPanel>
      {venueTotals.length > 1 && <ReportPanel title={t.venueComparison} wide>
        <ReportVenueLegend periods={venueSeriesPeriods} />
        {!venuePrevious && <p className={styles.note} role="status">
          {t.priorUnavailable} <button type="button" onClick={() => setRetry((value) => value + 1)}>{t.retry}</button>
        </p>}
        <div className={styles.venueChartGrid}>
          {venueMetricKeys.filter((metricKey) => metricKey !== 'paidPlayers').map((metricKey) => (
            <ReportVenueBars key={metricKey} label={venueMetrics[metricKey]} periods={venueSeriesPeriods}
              venues={venueTotals.map((item) => ({
                id: item,
                name: venueNames[item],
                color: colors[item],
                values: venuePeriods.map((period) => venueValue(period, item, metricKey)),
                details: metricKey === 'revenue' ? venuePeriods.map((period) => {
                  const players = period?.byVenue[item].paidPlayers
                  return players == null ? '' : t.paidPlayerCount(count(players), players)
                }) : undefined,
              }))}
              axisLabel={metricKey === 'revenue' ? `${revenueLabel} (${t.millionVnd})` : undefined}
              formatValue={(value) => metricKey === 'revenue' && value !== null
                ? reportNumber(language, value / 1e6, Math.abs(value) < 10_000 ? 6 : 2)
                : formatVenueValue(value, metricKey)}
              formatTick={(value) => reportNumber(language, metricKey === 'revenue' ? value / 1e6 : value, metricKey === 'revenue' ? 6 : 1)} />
          ))}
        </div>
        <details className={`${styles.details} ${styles.venueData}`}>
          <summary>{t.viewVenueData}</summary>
          <div className={styles.tableWrap}><table className={styles.venueTable} role="table" aria-label={t.venueComparison}><thead><tr><th scope="col">{t.venue}</th><th scope="col">{t.period}</th>
          {Object.values(venueMetrics).map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{venueTotals.map((item) => venuePeriods.map((period, index) => <tr key={`${item}-${index}`}>
            <th scope="row" className={styles.venueLabel} data-color={colors[item]}>{venueNames[item]}</th>
            <td className={styles.venuePeriod}>{venueSeriesPeriods[index].label}</td>
            {venueMetricKeys.map((key) => (
              <td key={key} className={styles.venueMetric}>
                <span className={styles.mobileMetricLabel} aria-hidden="true">{metrics[key]}</span>
                <span>{formatVenueValue(venueValue(period, item, key), key)}</span>
              </td>
            ))}
          </tr>))}</tbody>
          </table></div>
        </details>
      </ReportPanel>}
      <ReportPanel title={t.day} period={comparedDates} description={current.weekdays[peakDay] ? `${t.peak} · ${weekdays[peakDay]} · ${count(current.weekdays[peakDay])}` : t.noData}>
        <ReportTrend label={t.day} labels={weekdays} mode="columns" series={[
          { label: t.current, color: dotColor, values: current.weekdays },
          ...(previous ? [{ label: t.previous, color: dotColor, values: previous.weekdays, comparison: true }] : []),
        ]} valueLabel={count} language={language} />
      </ReportPanel>
      <ReportPanel title={t.time} period={comparedDates} description={current.times[peakHour] ? `${t.peak} · ${hourText(peakHour)} · ${count(current.times[peakHour])}` : t.noData}>
        <ReportTrend label={t.time} labels={hourIndices.map(hourText)} mode="columns" series={[
          { label: t.current, color: dotColor, values: hourIndices.map((hour) => current.times[hour]) },
          ...(previous ? [{ label: t.previous, color: dotColor, values: hourIndices.map((hour) => previous.times[hour]), comparison: true }] : []),
        ]} valueLabel={count} language={language} />
      </ReportPanel>
      <ReportPanel title={t.heat} period={heat === previous && previousDates ? previousDates : currentDates} description={t.heatDescription} wide actions={previous && <div className={styles.controls}>
        <label>{t.period}<select value={heatComparison ? 'previous' : 'current'} onChange={(event) => setHeatComparison(event.target.value === 'previous')}>
          <option value="current">{t.current}</option><option value="previous">{t.previous}</option>
        </select></label>
      </div>}>
        <ReportHeatmap rows={weekdays} columns={hourIndices.map(hourText)} values={heat.hours.map((hours) => hourIndices.map((hour) => hours[hour]))}
          label={t.heat} legend={['0', count(Math.max(...heat.hours.flat()))]} language={language} />
      </ReportPanel>
      <ReportPanel title={t.games} period={comparedDates} description={t.gameDescription} wide>
        <p className={styles.note}>{loaded.current.played ? `${count(current.recordedSessions)} ${t.gameCoverage}` : t.gameMissing}</p>
        <div className={styles.legend}>{venueTotals.map((item) => <span key={item}><i data-color={colors[item]} />{venueNames[item]}</span>)}</div>
        <ReportRanking rows={showGames ? games : games.slice(0, 8)} valueLabel={count} empty={loaded.current.played ? t.gameEmpty : t.gameMissing} />
        {games.length > 8 && <button type="button" className="secondary" onClick={() => setShowGames(!showGames)}>{showGames ? t.less : t.more}</button>}
      </ReportPanel>
      {financial && <>
      <ReportPanel title={t.mix} period={currentDates} description={t.all}>
        <p className={styles.note}>{text.labels.totalPaid} <strong>{money(financial.totalPaid)}</strong> · {text.labels.discounts} <strong>{money(financial.discounts)}</strong></p>
        <ReportRanking rows={payments} valueLabel={money} empty={t.noData} />
      </ReportPanel>
      <ReportPanel title={language === 'vi' ? 'Nguồn đặt chỗ' : 'Booking sources'} period={currentDates} description={t.all}>
        <ReportRanking rows={(financial.bookingSources ?? []).map((item) => ({
          label: bookingSourceLabel(item.source, text), value: item.bookings, detail: money(item.sales),
        })).sort((a, b) => b.value - a.value)} valueLabel={count} empty={t.noData} />
      </ReportPanel>
      </>}
    </div>
  </div></>
}
