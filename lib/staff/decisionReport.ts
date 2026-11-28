export const reportVenueKeys = ['ha-do-centrosa', 'cafe-des-stagiaires', 'other'] as const
export type ReportVenue = typeof reportVenueKeys[number]
export type ReportVenueFilter = ReportVenue | 'all'
type LinkedSession = { date: string; venue_key: string | null; status?: string }
export type ReportOrderFact = {
  id: string; session_id: string | null; booking_date: string; booking_time: string
  arena_id: string | null; players_count: number; total: number; order_status: string; payment_status: string
  sessions: LinkedSession | null
}
export type ReportNetSale = { sale_date: string; venue_key: string; net_sales: number; gross_sales?: number | null }
export type ReportPlayedFact = {
  session_id: string; game_ids: string[]
  sessions: LinkedSession & { duration_minutes?: number; ticket_player_count?: number | null }
}
export const gameProviders = ['Virtual Arena', 'Anvio', 'Spatial Ops', 'Laser Limbo', 'VR Arena'] as const
type GameProvider = typeof gameProviders[number]

const providerGames: Record<GameProvider, string[]> = {
  'Virtual Arena': ['arc-of-the-covenant', 'castle-unspunnen', 'joller-house', 'laser-tag', 'mini-block-towers', 'office-war', 'paintball', 'snow-battle', 'wild-west'],
  Anvio: ['city-z', 'revolta', 'station-zarya'],
  'Spatial Ops': ['spatial-ops'],
  'Laser Limbo': ['laser-limbo'],
  'VR Arena': ['arcade-2-0', 'birthday-party', 'orc-kings-arena', 'party-games', 'portal-mafia', 'portal-zombie', 'vr-arena-strike'],
}
const providerByGame = new Map(gameProviders.flatMap((provider) => providerGames[provider].map((game) => [game, provider] as const)))
const excluded = new Set(['draft', 'cancelled', 'refunded'])

export function reportVenue(key: string | null | undefined, arena?: string | null): ReportVenue {
  if (key) return key === 'ha-do-centrosa' || key === 'cafe-des-stagiaires' ? key : 'other'
  if (arena === 'cafe:arena-1') return 'cafe-des-stagiaires'
  return arena && ['arena-1', 'arena-2', 'sim-racing-1', 'sim-racing-2'].includes(arena) ? 'ha-do-centrosa' : 'other'
}

export function reportProviderMinutes(start: string, end: string, orders: ReportOrderFact[], played: ReportPlayedFact[], venues: readonly ReportVenue[]) {
  const playersBySession = new Map<string, number>()
  for (const order of orders) {
    if (!order.session_id) continue
    const players = playersBySession.get(order.session_id) ?? 0
    const eligible = !excluded.has(order.order_status) && order.order_status !== 'no_show' && order.payment_status !== 'refunded'
    playersBySession.set(order.session_id, players + (eligible ? Number(order.players_count) || 0 : 0))
  }

  const minutes = new Map(gameProviders.map((provider) => [provider, { 'ha-do-centrosa': 0, 'cafe-des-stagiaires': 0, other: 0 }]))
  let counted = 0
  let mixed = 0
  let omitted = 0
  for (const record of played) {
    const { sessions: session, session_id: id, game_ids: games } = record
    const venue = reportVenue(session.venue_key)
    if (!venues.includes(venue) || session.date < start || session.date > end || session.status === 'cancelled' || !games.length) continue
    const orderPlayers = playersBySession.get(id)
    if (orderPlayers === 0) continue

    // Modes and maps use their parent game's slug before the first colon.
    const providers = new Set(games.map((game) => providerByGame.get(game.split(':')[0])))
    const players = Number(session.ticket_player_count) || orderPlayers || 0
    const duration = Number(session.duration_minutes)
    if (providers.has(undefined) || !Number.isFinite(duration) || duration <= 0 || players <= 0) {
      omitted++
      continue
    }

    counted++
    if (providers.size > 1) mixed++
    const share = players * duration / providers.size
    for (const provider of providers) {
      const totals = provider && minutes.get(provider)
      if (totals) totals[venue] += share
    }
  }
  return { minutes, counted, mixed, omitted }
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
    sales, netSales: netTotal, grossSales: grossTotal, bookings, players, paidPlayers, cancelled, noShows, byVenue, buckets, games, weekdays, times, hours,
    recordedSessions: recordedSessions.size,
    playersPerDay: players / days,
    playersPerSession: reservedSessions.size ? players / reservedSessions.size : null,
    sessions: reservedSessions.size,
  }
}
