import { bookingSourceLabel, orderPaymentLabel } from './reportDisplay.ts'
export { bookingSourceLabel, orderPaymentLabel, paymentPieItems } from './reportDisplay.ts'
import type { StaffConsoleCopy } from './copy.ts'
import { staffConsoleText } from './copy.ts'
import { normalizeTime } from './dates.ts'
import { formatVnd } from './formatting.ts'
import { paymentStatusLabel } from './payments.ts'
import { orderPaidAmount } from './reporting.ts'
import type { StaffGame, StaffOrder, StaffOrderPayment, StaffReportSummary } from './types.ts'

export async function downloadExcel(filename: string, sections: Array<{ title: string; rows: Array<Record<string, unknown>>; description?: string }>, text: StaffConsoleCopy = staffConsoleText.en) {
  const { downloadExcelFile } = await import('../staffDownloadFiles')
  downloadExcelFile(filename, sections, text.noData)
}

export function accountantFormula(formula: string, result: string | number = '', numberFormat?: 'currency' | 'decimal' | 'integer' | 'percent') {
  return { __xlsxFormula: true, formula: formula.replace(/^=/, ''), result, numberFormat }
}

export function excelColumnName(index: number) {
  let column = ''
  let value = index
  while (value > 0) {
    const remainder = (value - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    value = Math.floor((value - 1) / 26)
  }
  return column
}

export async function downloadCsv(filename: string, rows: Array<Record<string, unknown>>, text: StaffConsoleCopy = staffConsoleText.en) {
  const { downloadCsvFile } = await import('../staffDownloadFiles')
  downloadCsvFile(filename, rows, text.noData)
}

export async function downloadPdf(filename: string, lines: string[], text: StaffConsoleCopy = staffConsoleText.en) {
  const { downloadPdfFile } = await import('../staffDownloadFiles')
  downloadPdfFile(filename, lines, text.reportTitleFallback)
}

export function staffReportRows(report: StaffReportSummary, text: StaffConsoleCopy = staffConsoleText.en) {
  return [
    { metric: text.labels.totalSales, value: formatVnd(report.totalSales) },
    { metric: text.labels.totalPaid, value: formatVnd(report.totalPaid) },
    { metric: text.unpaid, value: formatVnd(report.unpaidAmount) },
    { metric: text.labels.cash, value: formatVnd(report.cashTotal) },
    { metric: text.labels.bankTransfer, value: formatVnd(report.bankTransferTotal) },
    { metric: text.paymentMethods.card_manual, value: formatVnd(report.cardTotal) },
    { metric: text.paymentMethods.momo_manual, value: formatVnd(report.momoTotal) },
    { metric: text.paymentMethods.vnpay, value: formatVnd(report.vnpayTotal) },
    { metric: text.labels.bookings, value: report.bookings },
    { metric: text.labels.players, value: report.players },
    { metric: text.labels.cancelled, value: report.cancelled },
    { metric: text.labels.noShows, value: report.noShows },
    { metric: text.labels.discounts, value: formatVnd(report.discounts) },
    { metric: text.labels.bestSellingGame, value: report.bestSellingGame },
    ...(report.bookingSources || []).flatMap(row => [
      { metric: `${bookingSourceLabel(row.source, text)} — ${text.labels.bookings}`, value: row.bookings },
      { metric: `${bookingSourceLabel(row.source, text)} — ${text.labels.totalSales}`, value: formatVnd(row.sales) },
    ]),
  ]
}

export function staffOrderExportRows(orders: StaffOrder[], games: StaffGame[], paymentsByOrderId: Map<string, StaffOrderPayment[]>, text: StaffConsoleCopy = staffConsoleText.en) {
  return orders.map((order) => ({
    order_number: order.order_number,
    booking_source: bookingSourceLabel(order.booking_source, text),
    date: order.booking_date,
    time: normalizeTime(order.booking_time),
    customer: order.customer_name || order.customer_phone || order.customer_email || text.walkIn,
    game: games.find((game) => game.id === order.game_id)?.name || '',
    players: order.players_count,
    subtotal: formatVnd(order.subtotal),
    discount: formatVnd(order.discount_total),
    total: formatVnd(order.total),
    payment_method: orderPaymentLabel(order, paymentsByOrderId, text),
    paid_amount: formatVnd(orderPaidAmount(order, paymentsByOrderId)),
    payment_status: paymentStatusLabel(order.payment_status, text),
    order_status: text.orderStatuses[order.order_status],
  }))
}

export function reportPdfLines(
  title: string,
  report: StaffReportSummary,
  orders: StaffOrder[],
  games: StaffGame[],
  paymentsByOrderId: Map<string, StaffOrderPayment[]>,
  text: StaffConsoleCopy = staffConsoleText.en
) {
  return [
    title,
    ...staffReportRows(report, text).map((row) => `${row.metric}: ${row.value}`),
    '',
    text.labels.orders,
    ...staffOrderExportRows(orders, games, paymentsByOrderId, text).slice(0, 28).map((order) => (
      `${order.order_number} | ${order.date} ${order.time} | ${order.customer} | ${order.booking_source} | ${order.game} | ${order.total} | ${order.payment_method}`
    )),
  ]
}
