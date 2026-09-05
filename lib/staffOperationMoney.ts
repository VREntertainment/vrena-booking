type OperationSession = {
  id: string
  status: string
  booking_type?: string | null
  ticket_status?: string | null
  ticket_total_price?: number | null
}

type OperationOrder = {
  session_id?: string | null
  order_status: string
  payment_status: string
  total: number
  paidAmount: number
}

const amount = (value: number | null | undefined) => Math.max(0, Number(value) || 0)

/** Booking value is not a payment ledger. Unlinked tickets stay visible for
 * reconciliation; pending requests never become an order receivable here. */
export function summarizeOperationMoney(sessions: OperationSession[], orders: OperationOrder[]) {
  const linkedIds = new Set(orders.map((order) => order.session_id).filter(Boolean))
  const activeOrders = orders.filter((order) => !['cancelled', 'refunded'].includes(order.order_status)
    && order.payment_status !== 'refunded')
  const confirmedOrders = activeOrders.filter((order) => order.order_status !== 'draft')
  const unlinkedTickets = sessions.filter((session) => session.booking_type === 'ticket'
    && session.status !== 'cancelled' && session.ticket_status !== 'cancelled'
    && !linkedIds.has(session.id))
  const pendingTickets = unlinkedTickets.filter((session) => session.ticket_status === 'pending')
  const confirmedTickets = unlinkedTickets.filter((session) => ['confirmed', 'completed'].includes(session.ticket_status || ''))
  const orderTotal = confirmedOrders.reduce((sum, order) => sum + amount(order.total), 0)
  const unlinkedValue = confirmedTickets.reduce((sum, session) => sum + amount(session.ticket_total_price), 0)

  return {
    bookingValue: orderTotal + unlinkedValue,
    orderTotal,
    orderPaid: confirmedOrders.reduce((sum, order) => sum + amount(order.paidAmount), 0),
    // Cap each order separately: an overpayment must not settle another order.
    orderBalance: confirmedOrders.reduce((sum, order) => sum + Math.max(0, amount(order.total) - amount(order.paidAmount)), 0),
    pendingValue: pendingTickets.reduce((sum, session) => sum + amount(session.ticket_total_price), 0)
      + activeOrders.filter((order) => order.order_status === 'draft').reduce((sum, order) => sum + amount(order.total), 0),
    pendingCount: pendingTickets.length + activeOrders.filter((order) => order.order_status === 'draft').length,
    unlinkedValue,
    unlinkedCount: confirmedTickets.length,
    unlinkedSessionIds: confirmedTickets.map((session) => session.id),
  }
}
