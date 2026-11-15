'use client'

import type { ReportsActionContext } from './reports.actions'
import type { StaffPlayerInsightsSnapshot } from '../../components/StaffPlayerInsights'
import type { StaffQrAnalyticsSnapshot } from '../../components/StaffQrAnalytics'
import { orderedRange } from '../../lib/staff/dates'
import { rpcFunctionMissing } from '../../lib/staff/errors'
import { buildDailySeries, buildStaffReport, emptyStaffReport, paymentMapFromRows, staffReportSnapshotFromRpc } from '../../lib/staff/reporting'
import type { StaffGame, StaffOrder, StaffReportSnapshot } from '../../lib/staff/types'
import { getStaffKioskOperatorToken, STAFF_KIOSK_HEADER, supabase } from '../../lib/supabase/client'

/** Report transport and fallback calculations load only when reports are opened. */
export function createStaffReportLoadActions(getContext: () => ReportsActionContext) {
  async function loadReportFallback() {
    const { setGames, loadedDataRef, reportStart, reportEnd, compareStart, compareEnd, compareEnabled, fetchOrderPayments, setReportSnapshot, text } = getContext()

    const gamesResult = await supabase.from('staff_games').select('*').order('name', { ascending: true })
    if (gamesResult.error) throw new Error(gamesResult.error.message)
    const fallbackGames = (gamesResult.data ?? []) as StaffGame[]
    setGames(fallbackGames)
    loadedDataRef.current.games = true
    const fallbackGameNameById = new Map(fallbackGames.map((game) => [game.id, game.name]))
    const [reportFrom, reportTo] = orderedRange(reportStart, reportEnd)
    const [compareFrom, compareTo] = orderedRange(compareStart, compareEnd)
    const reportResult = await supabase
      .from('staff_orders')
      .select('*')
      .gte('booking_date', reportFrom)
      .lte('booking_date', reportTo)
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false })
      .limit(250)
    if (reportResult.error) throw new Error(reportResult.error.message)

    const comparisonResult = compareEnabled
      ? await supabase
        .from('staff_orders')
        .select('*')
        .gte('booking_date', compareFrom)
        .lte('booking_date', compareTo)
        .order('booking_date', { ascending: false })
        .order('booking_time', { ascending: false })
        .limit(250)
      : { data: [], error: null }
    if (comparisonResult.error) throw new Error(comparisonResult.error.message)

    const reportRows = (reportResult.data ?? []) as StaffOrder[]
    const comparisonRows = (comparisonResult.data ?? []) as StaffOrder[]
    const payments = await fetchOrderPayments([...reportRows, ...comparisonRows])
    const paymentsByOrder = paymentMapFromRows(payments)
    setReportSnapshot({
      report: buildStaffReport(reportRows, fallbackGameNameById, paymentsByOrder, text),
      comparisonReport: compareEnabled ? buildStaffReport(comparisonRows, fallbackGameNameById, paymentsByOrder, text) : emptyStaffReport(text),
      reportSeries: buildDailySeries(reportRows, reportFrom, reportTo),
      comparisonSeries: compareEnabled ? buildDailySeries(comparisonRows, compareFrom, compareTo) : [],
      orders: reportRows,
      comparisonOrders: comparisonRows,
      payments,
    })
  }

  async function loadReportData(force = false) {
    const { runStaffLoader, reportStart, reportEnd, compareEnabled, compareStart, compareEnd, setPlayerInsightsSnapshot, text, setReportSnapshot } = getContext()

    await runStaffLoader('report', async () => {
      const playerInsightsPromise = supabase.rpc('staff_player_behavior_report', {
        p_start_date: reportStart,
        p_end_date: reportEnd,
        p_compare_start: compareEnabled ? compareStart : null,
        p_compare_end: compareEnabled ? compareEnd : null,
        p_player_limit: 16,
      })
      const productAnalyticsPromise = supabase.rpc('staff_product_analytics_report', {
        p_start_date: reportStart,
        p_end_date: reportEnd,
        p_compare_start: compareEnabled ? compareStart : null,
        p_compare_end: compareEnabled ? compareEnd : null,
      })
      const updatePlayerInsights = async () => {
        const [playerResult, productResult] = await Promise.all([playerInsightsPromise, productAnalyticsPromise])
        if (!playerResult.error) {
          setPlayerInsightsSnapshot({
            ...(playerResult.data as StaffPlayerInsightsSnapshot),
            productAnalytics: productResult.error ? null : productResult.data,
          } as StaffPlayerInsightsSnapshot)
        } else if (!rpcFunctionMissing(playerResult.error)) {
          setPlayerInsightsSnapshot(null)
        }
      }
      const withComparisonOrders = async (snapshot: StaffReportSnapshot) => {
        if (!compareEnabled || snapshot.comparisonOrders.length > 0) return snapshot

        const [compareFrom, compareTo] = orderedRange(compareStart, compareEnd)
        const { data, error } = await supabase
          .from('staff_orders')
          .select('*')
          .gte('booking_date', compareFrom)
          .lte('booking_date', compareTo)
          .order('booking_date', { ascending: false })
          .order('booking_time', { ascending: false })
          .limit(500)

        if (error) return snapshot
        return { ...snapshot, comparisonOrders: (data ?? []) as StaffOrder[] }
      }

      const reportArgs = {
        p_start_date: reportStart,
        p_end_date: reportEnd,
        p_compare_start: compareEnabled ? compareStart : null,
        p_compare_end: compareEnabled ? compareEnd : null,
        p_order_limit: 500,
      }
      const { data, error } = await supabase.rpc('staff_report_summary', reportArgs)
      if (!error) {
        const snapshot = await withComparisonOrders(staffReportSnapshotFromRpc(data, text))
        setReportSnapshot(snapshot)
        await updatePlayerInsights()
        return
      }

      if (!rpcFunctionMissing(error)) {
        await Promise.all([loadReportFallback(), updatePlayerInsights()])
        return
      }

      const legacyResult = await supabase.rpc('get_staff_daily_report', reportArgs)
      if (legacyResult.error) {
        await Promise.all([loadReportFallback(), updatePlayerInsights()])
        return
      }
      const snapshot = await withComparisonOrders(staffReportSnapshotFromRpc(legacyResult.data, text))
      setReportSnapshot(snapshot)
      await updatePlayerInsights()
    }, force)
  }

  async function loadQrAnalytics(force = false) {
    const { runStaffLoader, setQrAnalyticsError, reportStart, reportEnd, compareEnabled, compareStart, compareEnd, setQrAnalyticsSnapshot } = getContext()

    await runStaffLoader('qrReport', async () => {
      setQrAnalyticsError('')
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (sessionError || !accessToken) throw new Error(sessionError?.message || 'Staff session required.')

        const params = new URLSearchParams({ start: reportStart, end: reportEnd })
        if (compareEnabled) {
          params.set('compareStart', compareStart)
          params.set('compareEnd', compareEnd)
        }
        const operatorToken = getStaffKioskOperatorToken()
        const response = await fetch(`/api/staff/reports/qr-analytics?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            authorization: `Bearer ${accessToken}`,
            ...(operatorToken ? { [STAFF_KIOSK_HEADER]: operatorToken } : {}),
          },
        })
        const payload = await response.json().catch(() => ({})) as StaffQrAnalyticsSnapshot & { error?: string }
        if (!response.ok) throw new Error(payload.error || 'Could not load QR analytics.')
        setQrAnalyticsSnapshot(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load QR analytics.'
        setQrAnalyticsSnapshot(null)
        setQrAnalyticsError(message)
        throw error
      }
    }, force)
  }

  return { loadReportFallback, loadReportData, loadQrAnalytics }
}
