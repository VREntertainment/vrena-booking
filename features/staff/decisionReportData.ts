'use client'

import { supabase } from '../../lib/supabase/client'
import type { ReportNetSale, ReportOrderFact, ReportPlayedFact } from '../../lib/staff/decisionReport'

type Range = { start: string; end: string }
const pageSize = 500

type Page<T> = { data: T[] | null; error: { message: string } | null }

async function allPages<T>(load: (cursor: string | undefined) => PromiseLike<Page<T>>, id: (row: T) => string) {
  const rows: T[] = []
  let cursor: string | undefined
  for (;;) {
    const { data, error } = await load(cursor)
    if (error) throw new Error(error.message)
    if (!data?.length) return rows
    rows.push(...data)
    if (data.length < pageSize) return rows
    cursor = id(data[data.length - 1])
  }
}

export async function loadDecisionReport(range: Range, signal: AbortSignal) {
  const orders = allPages<ReportOrderFact>((cursor) => {
    let query = supabase.from('staff_orders').select(
      'id,session_id,booking_date,booking_time,arena_id,players_count,total,order_status,payment_status,sessions(date,venue_key)'
    ).gte('booking_date', range.start).lte('booking_date', range.end).order('id').limit(pageSize)
    if (cursor) query = query.gt('id', cursor)
    return query.abortSignal(signal).returns<ReportOrderFact[]>()
  }, (order) => order.id)

  const played = allPages<ReportPlayedFact>((cursor) => {
    let query = supabase.from('staff_session_games_played').select('session_id,game_ids,sessions!inner(date,venue_key,status,duration_minutes,ticket_player_count)')
      .gte('sessions.date', range.start).lte('sessions.date', range.end).order('session_id').limit(pageSize)
    if (cursor) query = query.gt('session_id', cursor)
    return query.abortSignal(signal).returns<ReportPlayedFact[]>()
  }, (row) => row.session_id).catch(() => null)

  const netSales = supabase.rpc('staff_business_net_sales', {
    p_start_date: range.start, p_end_date: range.end,
  }).abortSignal(signal)

  const [orderRows, playedRows, sales] = await Promise.all([orders, played, netSales])
  const summary = sales.data as unknown as { days: ReportNetSale[]; posThrough: string | null } | null
  if (sales.error || !Array.isArray(summary?.days)) throw new Error(sales.error?.message || 'Net sales are unavailable.')
  return { orders: orderRows, played: playedRows, netSales: summary.days, posThrough: summary.posThrough }
}
