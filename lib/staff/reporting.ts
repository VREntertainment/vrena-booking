import { staffConsoleText, type StaffConsoleCopy } from './copy.ts'
import { vrenaPalette } from '../theme/vrenaPalette.ts'
import { dateFromInput, addDays, orderedRange } from './dates.ts'
import type { StaffOrder, StaffOrderPayment, StaffReportSummary, StaffDailyPoint, StaffReportSnapshot, StaffWeekdayRevenuePoint, StaffHourlyRevenuePoint, StaffConsoleLanguage } from './types'

export const staffWeekdayLabels = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  vi: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
} satisfies Record<StaffConsoleLanguage, string[]>

export function staffOrderPaymentRows(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>) {
  return paymentsByOrderId.get(order.id) || []
}

export function orderPaidAmount(order: StaffOrder, paymentsByOrderId: Map<string, StaffOrderPayment[]>) {
  const payments = staffOrderPaymentRows(order, paymentsByOrderId)
  if (payments.length > 0) return payments.reduce((sum, payment) => sum + payment.amount, 0)
  return order.payment_status === 'paid' ? order.total : 0
}

export function buildLineChartPath(series: Array<{ sales: number }>, max: number) {
  if (series.length === 0) return ''
  if (series.length === 1) {
    const y = 94 - (series[0].sales / max) * 78
    return `M 6 ${y.toFixed(2)} L 94 ${y.toFixed(2)}`
  }
  return series.map((point, index) => {
    const x = 6 + (index / (series.length - 1)) * 88
    const y = 94 - (point.sales / max) * 78
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

export function conicStops(items: Array<{ value: number }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return `${vrenaPalette.neutral[300]} 0deg 360deg`
  const colors = [vrenaPalette.cyan[500], vrenaPalette.purple[500], vrenaPalette.neutral[400]]
  let cursor = 0
  return items.map((item, index) => {
    const start = cursor
    cursor += (item.value / total) * 360
    return `${colors[index % colors.length]} ${start.toFixed(1)}deg ${cursor.toFixed(1)}deg`
  }).join(', ')
}

export function buildWeekdayRevenue(orders: StaffOrder[], language: StaffConsoleLanguage): StaffWeekdayRevenuePoint[] {
  const labels = staffWeekdayLabels[language]
  const buckets = labels.map((label, index) => ({ key: String(index), label, sales: 0 }))

  orders.forEach((order) => {
    if (!order.booking_date) return
    const day = dateFromInput(order.booking_date).getDay()
    const mondayFirstIndex = day === 0 ? 6 : day - 1
    buckets[mondayFirstIndex].sales += Number(order.total) || 0
  })

  return buckets
}

export function buildHourlyRevenue(orders: StaffOrder[]): StaffHourlyRevenuePoint[] {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, label: `${hour}h`, sales: 0 }))

  orders.forEach((order) => {
    const match = String(order.booking_time || '').match(/^(\d{1,2})/)
    const hour = match ? Number(match[1]) : Number.NaN
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return
    buckets[hour].sales += Number(order.total) || 0
  })

  return buckets
}

export function buildSmoothLineChartPath(series: Array<{ sales: number }>, max: number) {
  if (series.length === 0) return ''
  const safeMax = Math.max(1, max)
  const points = series.map((point, index) => {
    const x = series.length === 1 ? 50 : 4 + (index / (series.length - 1)) * 92
    const y = 92 - (point.sales / safeMax) * 74
    return { x, y }
  })

  if (points.length === 1) return `M 4 ${points[0].y.toFixed(2)} L 96 ${points[0].y.toFixed(2)}`

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    const previous = points[index - 1]
    const midX = (previous.x + point.x) / 2
    return `${path} C ${midX.toFixed(2)} ${previous.y.toFixed(2)}, ${midX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, '')
}

export function buildChartAreaPath(linePath: string) {
  return linePath ? `${linePath} L 96 94 L 4 94 Z` : ''
}

export function emptyStaffReport(text: StaffConsoleCopy = staffConsoleText.en): StaffReportSummary {
  return {
    totalSales: 0,
    totalPaid: 0,
    unpaidAmount: 0,
    cashTotal: 0,
    bankTransferTotal: 0,
    bookings: 0,
    players: 0,
    cancelled: 0,
    noShows: 0,
    discounts: 0,
    bestSellingGame: text.noneYet,
  }
}

export function buildStaffReport(
  orders: StaffOrder[],
  gameNameById: Map<string, string>,
  paymentsByOrderId: Map<string, StaffOrderPayment[]>,
  text: StaffConsoleCopy = staffConsoleText.en
): StaffReportSummary {
  const totals = orders.reduce((summary, order) => {
    const payments = staffOrderPaymentRows(order, paymentsByOrderId)
    const paidAmount = payments.length > 0
      ? payments.reduce((sum, payment) => sum + payment.amount, 0)
      : order.payment_status === 'paid'
        ? order.total
        : 0
    summary.totalSales += order.total
    summary.players += order.players_count
    summary.discounts += order.discount_total
    summary.totalPaid += paidAmount
    summary.unpaidAmount += Math.max(0, order.total - paidAmount)
    if (payments.length > 0) {
      payments.forEach((payment) => {
        if (payment.payment_method === 'cash') summary.cashTotal += payment.amount
        if (payment.payment_method === 'bank_transfer') summary.bankTransferTotal += payment.amount
      })
    } else {
      if (order.payment_method === 'cash') summary.cashTotal += order.total
      if (order.payment_method === 'bank_transfer') summary.bankTransferTotal += order.total
    }
    if (order.order_status === 'cancelled') summary.cancelled += 1
    if (order.order_status === 'no_show') summary.noShows += 1
    const gameName = order.game_id ? gameNameById.get(order.game_id) || text.unknown : text.unknown
    summary.gameCounts.set(gameName, (summary.gameCounts.get(gameName) || 0) + 1)
    return summary
  }, {
    totalSales: 0,
    totalPaid: 0,
    unpaidAmount: 0,
    cashTotal: 0,
    bankTransferTotal: 0,
    bookings: orders.length,
    players: 0,
    cancelled: 0,
    noShows: 0,
    discounts: 0,
    gameCounts: new Map<string, number>(),
  })
  const bestSellingGame = [...totals.gameCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || text.noneYet

  return {
    totalSales: totals.totalSales,
    totalPaid: totals.totalPaid,
    unpaidAmount: totals.unpaidAmount,
    cashTotal: totals.cashTotal,
    bankTransferTotal: totals.bankTransferTotal,
    bookings: totals.bookings,
    players: totals.players,
    cancelled: totals.cancelled,
    noShows: totals.noShows,
    discounts: totals.discounts,
    bestSellingGame,
  }
}

export function buildDailySeries(orders: StaffOrder[], start: string, end: string) {
  const [from, to] = orderedRange(start, end)
  const byDate = new Map<string, StaffDailyPoint>()
  for (let date = from, index = 0; date <= to && index < 45; date = addDays(date, 1), index += 1) {
    byDate.set(date, { date, sales: 0, bookings: 0, players: 0 })
  }
  orders.forEach((order) => {
    const point = byDate.get(order.booking_date)
    if (!point) return
    point.sales += order.total
    point.bookings += 1
    point.players += order.players_count
  })
  return [...byDate.values()]
}

export function mergeOrderPayments(current: StaffOrderPayment[], orderIds: string[], next: StaffOrderPayment[]) {
  const orderIdSet = new Set(orderIds)
  return [
    ...current.filter((payment) => !orderIdSet.has(payment.order_id)),
    ...next,
  ]
}

export function paymentMapFromRows(payments: StaffOrderPayment[]) {
  const map = new Map<string, StaffOrderPayment[]>()
  payments.forEach((payment) => {
    const list = map.get(payment.order_id) || []
    list.push(payment)
    map.set(payment.order_id, list)
  })
  return map
}

export function numericReportValue(value: unknown) {
  return Number(value ?? 0) || 0
}

export function reportSummaryFromRpc(value: unknown, text: StaffConsoleCopy = staffConsoleText.en): StaffReportSummary {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    totalSales: numericReportValue(row.totalSales ?? row.total_sales),
    totalPaid: numericReportValue(row.totalPaid ?? row.total_paid),
    unpaidAmount: numericReportValue(row.unpaidAmount ?? row.unpaid_amount),
    cashTotal: numericReportValue(row.cashTotal ?? row.cash_total),
    bankTransferTotal: numericReportValue(row.bankTransferTotal ?? row.bank_transfer_total),
    bookings: numericReportValue(row.bookings),
    players: numericReportValue(row.players),
    cancelled: numericReportValue(row.cancelled),
    noShows: numericReportValue(row.noShows ?? row.no_shows),
    discounts: numericReportValue(row.discounts),
    bestSellingGame: String(row.bestSellingGame ?? row.best_selling_game ?? text.noneYet),
  }
}

export function dailySeriesFromRpc(value: unknown): StaffDailyPoint[] {
  if (!Array.isArray(value)) return []
  return value.map((point) => {
    const row = (point && typeof point === 'object' ? point : {}) as Record<string, unknown>
    return {
      date: String(row.date || ''),
      sales: numericReportValue(row.sales),
      bookings: numericReportValue(row.bookings),
      players: numericReportValue(row.players),
    }
  }).filter((point) => point.date)
}

export function staffReportSnapshotFromRpc(value: unknown, text: StaffConsoleCopy = staffConsoleText.en): StaffReportSnapshot {
  const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const comparisonOrders = payload.comparisonOrders ?? payload.comparison_orders
  return {
    report: reportSummaryFromRpc(payload.report, text),
    comparisonReport: reportSummaryFromRpc(payload.comparisonReport ?? payload.comparison_report, text),
    reportSeries: dailySeriesFromRpc(payload.reportSeries ?? payload.report_series),
    comparisonSeries: dailySeriesFromRpc(payload.comparisonSeries ?? payload.comparison_series),
    orders: Array.isArray(payload.orders) ? payload.orders as StaffOrder[] : [],
    comparisonOrders: Array.isArray(comparisonOrders) ? comparisonOrders as StaffOrder[] : [],
    payments: Array.isArray(payload.payments) ? payload.payments as StaffOrderPayment[] : [],
  }
}

export function staffOrdersPageFromRpc(value: unknown) {
  const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    orders: Array.isArray(payload.orders) ? payload.orders as StaffOrder[] : [],
    payments: Array.isArray(payload.payments) ? payload.payments as StaffOrderPayment[] : [],
  }
}

export function percentChange(current: number, previous: number, text: StaffConsoleCopy = staffConsoleText.en) {
  if (previous <= 0) return current > 0 ? text.newValue : '0%'
  const value = ((current - previous) / previous) * 100
  return `${value >= 0 ? '+' : ''}${Math.round(value)}%`
}
