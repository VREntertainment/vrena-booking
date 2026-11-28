export const reportVenueKeys = ['ha-do-centrosa', 'cafe-des-stagiaires', 'other'] as const
export type ReportVenue = typeof reportVenueKeys[number]
export type ReportVenueFilter = ReportVenue | 'all'
type LinkedSession = { date: string; venue_key: string | null; status?: string; booking_category?: string | null; deleted_at?: string | null }
export type ReportOrderFact = {
  id: string; session_id: string | null; booking_date: string; booking_time: string
  arena_id: string | null; players_count: number; total: number; order_status: string; payment_status: string
  discount_total?: number; payment_method?: string; booking_source?: string | null
  sessions: LinkedSession | null
}
export type ReportNetSale = { sale_date: string; venue_key: string; net_sales: number; gross_sales?: number | null }
export type ReportPlayedFact = { session_id: string; game_ids: string[]; sessions: LinkedSession }
const excluded = new Set(['draft', 'cancelled', 'refunded'])

export function reportVenue(key: string | null | undefined, arena?: string | null): ReportVenue {
  if (key) return key === 'ha-do-centrosa' || key === 'cafe-des-stagiaires' ? key : 'other'
  if (arena === 'cafe:arena-1') return 'cafe-des-stagiaires'
  return arena && ['arena-1', 'arena-2', 'sim-racing-1', 'sim-racing-2'].includes(arena) ? 'ha-do-centrosa' : 'other'
}

const dayMs = 86400000
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / dayMs
const dateString = (days: number) => new Date(days * dayMs).toISOString().slice(0, 10)
export const reportDayCount = (start: string, end: string) => Math.max(1, dayNumber(end) - dayNumber(start) + 1)

export function decisionPeriod(start: string, end: string, orders: ReportOrderFact[], played: ReportPlayedFact[], venue: ReportVenueFilter | ReadonlySet<ReportVenue>, binDays: number, netSales: ReportNetSale[] = []) {
  const includesVenue = (key: ReportVenue) => typeof venue === 'string' ? venue === 'all' || venue === key : venue.has(key)
  const days = reportDayCount(start, end)
  const first = dayNumber(start)
  const buckets = Array.from({ length: Math.ceil(days / binDays) }, (_, i) => ({
    from: dateString(first + i * binDays),
    to: dateString(Math.min(first + (i + 1) * binDays - 1, dayNumber(end))),
    sales: 0, netSales: 0, grossSales: 0, bookings: 0, players: 0, paidPlayers: 0,
  }))
  const hours = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  const weekdays = Array<number>(7).fill(0)
  const times = Array<number>(24).fill(0)
  const byVenue = Object.fromEntries(reportVenueKeys.map((key) => [key, { sales: 0, netSales: 0, grossSales: 0, bookings: 0, players: 0, paidPlayers: 0 }])) as Record<ReportVenue, {
    sales: number; netSales: number; grossSales: number; bookings: number; players: number; paidPlayers: number
  }>
  const games = new Map<string, Record<ReportVenue, number>>()
  const recordedSessions = new Set<string>()
  const reservedSessions = new Set<string>()
  const freeTrialSessions = new Set<string>()
  let sales = 0, bookings = 0, players = 0, paidPlayers = 0, cancelled = 0, noShows = 0
  for (const order of orders) {
    const date = dayNumber(order.booking_date)
    const orderVenue = reportVenue(order.sessions?.venue_key, order.arena_id)
    if (!Number.isFinite(date) || date < first || date > dayNumber(end)) continue
    const selected = includesVenue(orderVenue)
    if (selected && order.order_status === 'cancelled') cancelled++
    if (excluded.has(order.order_status) || order.payment_status === 'refunded') continue
    const count = Number(order.players_count) || 0
    const total = Number(order.total) || 0
    const paid = order.payment_status === 'paid' ? count : 0
    const location = byVenue[orderVenue]
    location.sales += total
    location.bookings++
    location.players += count
    location.paidPlayers += paid
    if (!selected) continue

    bookings++
    sales += total
    players += count
    paidPlayers += paid
    if (order.order_status === 'no_show') noShows++
    if (order.session_id && order.sessions?.booking_category === 'free_trial'
      && order.order_status !== 'no_show' && order.sessions.status !== 'cancelled' && !order.sessions.deleted_at) {
      freeTrialSessions.add(order.session_id)
    }
    reservedSessions.add(order.session_id ?? order.id)
    const bucket = buckets[Math.floor((date - first) / binDays)]
    bucket.sales += total
    bucket.bookings++
    bucket.players += count
    bucket.paidPlayers += paid
    const weekday = (new Date(date * dayMs).getUTCDay() + 6) % 7
    weekdays[weekday]++
    const hour = Number(order.booking_time?.split(':')[0] || NaN)
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
      times[hour]++
      hours[weekday][hour]++
    }
  }

  let netTotal = 0
  let grossTotal = 0
  for (const sale of netSales) {
    const date = dayNumber(sale.sale_date)
    if (!Number.isFinite(date) || date < first || date >= first + days) continue
    const venue = reportVenue(sale.venue_key)
    const net = Number(sale.net_sales)
    const gross = Number(sale.gross_sales ?? 0)
    byVenue[venue].netSales += net
    byVenue[venue].grossSales += gross
    if (!includesVenue(venue)) continue
    netTotal += net
    grossTotal += gross
    const bucket = buckets[Math.floor((date - first) / binDays)]
    bucket.netSales += net
    bucket.grossSales += gross
  }

  for (const record of played) {
    const gameVenue = reportVenue(record.sessions.venue_key)
    if (!includesVenue(gameVenue) || record.sessions.date < start || record.sessions.date > end
      || record.sessions.status === 'cancelled' || !record.game_ids.length) continue
    recordedSessions.add(record.session_id)
    for (const id of new Set(record.game_ids)) {
      const tally = games.get(id) ?? { 'ha-do-centrosa': 0, 'cafe-des-stagiaires': 0, other: 0 }
      tally[gameVenue]++
      games.set(id, tally)
    }
  }

  return {
    sales, netSales: netTotal, grossSales: grossTotal, bookings, players, paidPlayers, cancelled, freeTrials: freeTrialSessions.size, noShows, byVenue, buckets, games, weekdays, times, hours,
    recordedSessions: recordedSessions.size,
    playersPerDay: players / days,
    playersPerSession: reservedSessions.size ? players / reservedSessions.size : null,
    sessions: reservedSessions.size,
  }
}

export type ReportReceipt = { order_id: string; payment_method: string; amount: number }

export function decisionFinancial(orders: ReportOrderFact[], receipts: ReportReceipt[], venue: ReportVenueFilter | ReadonlySet<ReportVenue>, yesterday: string) {
  const paymentByOrder = new Map<string, ReportReceipt[]>()
  for (const receipt of receipts) {
    const group = paymentByOrder.get(receipt.order_id) ?? []
    group.push(receipt)
    paymentByOrder.set(receipt.order_id, group)
  }
  const methodTotals = { cash: 0, bank_transfer: 0, card_manual: 0, momo_manual: 0, vnpay: 0 }
  function recordMethod(method: string, amount: number) {
    if (Object.hasOwn(methodTotals, method)) methodTotals[method as keyof typeof methodTotals] += amount
  }
  const bookingSources = new Map<string, { source: string; bookings: number; sales: number }>()
  let totalPaid = 0
  let unpaidAmount = 0
  let discounts = 0
  for (const order of orders) {
    const location = reportVenue(order.sessions?.venue_key, order.arena_id)
    if (typeof venue === 'string' ? venue !== 'all' && venue !== location : !venue.has(location)) continue
    const payments = paymentByOrder.get(order.id)
    const paid = payments?.reduce((sum, payment) => sum + payment.amount, 0) ?? (order.payment_status === 'paid' ? order.total : 0)
    totalPaid += paid
    discounts += order.discount_total ?? 0
    if (order.booking_date <= yesterday && !excluded.has(order.order_status) && order.order_status !== 'no_show' && order.payment_status !== 'refunded') {
      unpaidAmount += Math.max(0, order.total - paid)
    }
    if (payments) for (const payment of payments) recordMethod(payment.payment_method, payment.amount)
    else if (order.payment_status === 'paid') recordMethod(order.payment_method ?? '', order.total)

    const source = order.booking_source || 'unspecified'
    const bucket = bookingSources.get(source) ?? { source, bookings: 0, sales: 0 }
    bucket.bookings++
    bucket.sales += order.total
    bookingSources.set(source, bucket)
  }
  return { totalPaid, unpaidAmount, discounts, methodTotals, bookingSources: [...bookingSources.values()] }
}
