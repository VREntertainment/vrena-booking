type AccountantOrder = {
  booking_date: string
  company_name: string | null
  created_at: string
  created_by: string | null
  customer_email: string | null
  customer_name: string | null
  customer_phone: string | null
  discount_code: string | null
  discount_rule_id: string | null
  discount_total: number
  external_invoice_id: string | null
  game_id: string | null
  id: string
  internal_note: string | null
  invoice_address: string | null
  invoice_status: string
  order_number: string
  order_status: 'draft' | 'confirmed' | 'paid' | 'partially_paid' | 'cancelled' | 'refunded' | 'no_show' | 'completed'
  payment_method: string
  payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'refunded'
  players_count: number
  subtotal: number
  tax_code: string | null
  total: number
  updated_at: string
}

type AccountantPayment = {
  amount: number
  created_at: string
  created_by: string | null
  id: string
  payment_method: string
}

type AccountantText = {
  discountTypes: Readonly<Record<string, string>>
  labels: {
    no: string
    yes: string
  }
  messages: {
    accountantExportSourcePending: string
  }
  orderStatuses: Readonly<Record<string, string>>
  paymentMethods: Readonly<Record<string, string>>
  split: string
  unpaid: string
  walkIn: string
}

type AccountantExportContext = {
  auditLogs: Array<{
    action: string
    actor_user_id: string | null
    created_at: string
    new_value?: unknown
    old_value?: unknown
  }>
  discounts: Array<{
    code: string | null
    discount_type: string
    id: string
    name: string
  }>
  games: Array<{
    id: string
    name: string
  }>
  includeAttachments: boolean
  language: string
  orders: AccountantOrder[]
  paymentsByOrderId: Map<string, AccountantPayment[]>
  report: {
    cashTotal: number
  }
  reportEnd: string
  reportStart: string
  storeLabel: string
  text: AccountantText
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayString() {
  return dateInputValue(new Date())
}

function rangeLabel(start: string, end: string) {
  return start === end ? start : `${start} - ${end}`
}

function paymentMethodLabel(value: string, text: AccountantText) {
  if (value === 'split') return text.split
  if (value === 'unpaid') return text.unpaid
  if (value === 'cash' || value === 'bank_transfer') return text.paymentMethods[value]
  return value.replace(/_/g, ' ')
}

function paymentStatusLabel(value: string, text: AccountantText) {
  if (value === 'unpaid') return text.unpaid
  if (value === 'paid') return text.orderStatuses.paid
  if (value === 'partially_paid') return text.orderStatuses.partially_paid
  if (value === 'refunded') return text.orderStatuses.refunded
  return value
}

function staffOrderPaymentRows(order: AccountantOrder, paymentsByOrderId: Map<string, AccountantPayment[]>) {
  return paymentsByOrderId.get(order.id) || []
}

function orderPaymentLabel(order: AccountantOrder, paymentsByOrderId: Map<string, AccountantPayment[]>, text: AccountantText) {
  const payments = staffOrderPaymentRows(order, paymentsByOrderId)
  if (payments.length === 0) return paymentMethodLabel(order.payment_method, text)
  return payments
    .map((payment) => `${paymentMethodLabel(payment.payment_method, text)} ${formatVnd(payment.amount)}`)
    .join(' + ')
}

function orderPaidAmount(order: AccountantOrder, paymentsByOrderId: Map<string, AccountantPayment[]>) {
  const payments = staffOrderPaymentRows(order, paymentsByOrderId)
  if (payments.length > 0) return payments.reduce((sum, payment) => sum + payment.amount, 0)
  return order.payment_status === 'paid' ? order.total : 0
}

function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0)
}

function accountantCustomer(order: AccountantOrder, text: AccountantText) {
  return order.customer_name || order.customer_phone || order.customer_email || text.walkIn
}

function accountantGameName(order: AccountantOrder, games: AccountantExportContext['games']) {
  return games.find((game) => game.id === order.game_id)?.name || ''
}

function accountantDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${dateInputValue(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function accountantJsonValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function accountantFirstPayment(order: AccountantOrder, paymentsByOrderId: Map<string, AccountantPayment[]>) {
  return [...staffOrderPaymentRows(order, paymentsByOrderId)].sort((left, right) => (
    new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  ))[0] || null
}

function accountantPaymentDate(order: AccountantOrder, paymentsByOrderId: Map<string, AccountantPayment[]>) {
  return (accountantFirstPayment(order, paymentsByOrderId)?.created_at || order.created_at).slice(0, 10)
}

function accountantIsRecognized(order: AccountantOrder) {
  return order.order_status === 'completed' || order.booking_date <= todayString()
}

function accountantVatSplit(total: number) {
  const net = Math.round(total / 1.08)
  return { net, vat: Math.max(total - net, 0) }
}

function accountantSourcePendingRow(columns: string[], context: AccountantExportContext) {
  const noteColumn = columns.includes('Notes') ? 'Notes' : columns[columns.length - 1]
  return columns.reduce<Record<string, unknown>>((row, column, index) => {
    row[column] = column === noteColumn || (index === 0 && !noteColumn)
      ? context.text.messages.accountantExportSourcePending
      : ''
    return row
  }, {})
}

function accountantBlankRow(columns: string[]) {
  return columns.reduce<Record<string, unknown>>((row, column) => {
    row[column] = ''
    return row
  }, {})
}

function accountantRowsOrBlank(rows: Array<Record<string, unknown>>, columns: string[]) {
  return rows.length > 0 ? rows : [accountantBlankRow(columns)]
}

export function accountantExportInfoRows(reportTitle: string, context: AccountantExportContext): Array<Record<string, unknown>> {
  return [
    { Field: 'Report', Value: reportTitle },
    { Field: 'Period', Value: rangeLabel(context.reportStart, context.reportEnd) },
    { Field: 'Store / location', Value: context.storeLabel },
    { Field: 'Language', Value: context.language.toUpperCase() },
    { Field: 'Attachments list included', Value: context.includeAttachments ? context.text.labels.yes : context.text.labels.no },
    { Field: 'Exported at', Value: accountantDateTime(new Date().toISOString()) },
  ]
}

export function buildAccountantExportRows(reportId: string, context: AccountantExportContext): Array<Record<string, unknown>> {
  const eInvoiceColumns = [
    'Sale ID',
    'Invoice issued?',
    'E-invoice number',
    'Invoice series/template',
    'Invoice date',
    'Buyer legal name',
    'Buyer tax code',
    'Buyer address',
    'VAT rate',
    'Invoice total',
    'Tax authority code / QR ref',
    'Invoice status',
    'Difference vs app sale',
  ]
  const paymentColumns = [
    'Payment ID',
    'Sale/Booking ID',
    'Payment date',
    'Amount',
    'Method',
    'Bank account / wallet',
    'Transaction reference',
    'Office staff',
    'Reconciliation status',
    'Bank fee',
    'Net received',
  ]
  const refundColumns = [
    'Original sale ID',
    'Refund ID',
    'Refund date',
    'Refund reason',
    'Amount refunded',
    'Method',
    'Approved by',
    'Related invoice correction?',
    'Corrected invoice number',
    'Notes',
  ]
  const discountColumns = [
    'Sale ID',
    'Promotion name',
    'Voucher code',
    'Discount type',
    'Discount amount',
    'Approved automatically?',
    'Manual override by',
    'Reason',
  ]
  const dailyCashColumns = [
    'Date',
    'Store',
    'Opening cash',
    'Cash sales',
    'Cash refunds',
    'Cash expenses paid from drawer',
    'Expected closing cash',
    'Actual counted cash',
    'Difference',
    'Closed by',
    'Approved by',
  ]
  const vatInputColumns = [
    'Supplier tax code',
    'Supplier name',
    'Invoice number',
    'Invoice date',
    'Pre-VAT amount',
    'VAT rate',
    'VAT amount',
    'Total',
    'Paid by bank?',
    'Eligible for VAT credit?',
    'Issue flag',
  ]
  const payrollColumns = [
    'Employee name',
    'Role',
    'Month',
    'Working days',
    'Hours worked',
    'Gross salary',
    'Allowance',
    'Bonus / commission',
    'Deductions',
    'PIT withheld',
    'Net salary',
    'Payment date',
    'Bank account',
  ]
  const inventoryColumns = [
    'SKU',
    'Product',
    'Opening stock',
    'Stock in',
    'Stock out sold',
    'Stock out gift',
    'Damaged/lost',
    'Closing stock',
    'Unit cost',
    'Stock value',
  ]

  if (reportId === 'sales_revenue') {
    return context.orders.map((order) => {
      const paid = orderPaidAmount(order, context.paymentsByOrderId)
      return {
        Date: order.booking_date,
        'Order number': order.order_number,
        Customer: accountantCustomer(order, context.text),
        Game: accountantGameName(order, context.games),
        Players: order.players_count,
        Subtotal: order.subtotal,
        Discount: order.discount_total,
        'Total revenue': order.total,
        'Paid amount': paid,
        'Unpaid amount': Math.max(order.total - paid, 0),
        'Payment method': orderPaymentLabel(order, context.paymentsByOrderId, context.text),
        'Payment status': paymentStatusLabel(order.payment_status, context.text),
        'Order status': context.text.orderStatuses[order.order_status],
        Ref: order.order_number,
      }
    })
  }

  if (reportId === 'einvoice_reconciliation') {
    return accountantRowsOrBlank(context.orders.map((order) => {
      const invoiceIssued = Boolean(order.external_invoice_id) || order.invoice_status === 'issued'
      return {
        'Sale ID': order.order_number,
        'Invoice issued?': invoiceIssued ? context.text.labels.yes : context.text.labels.no,
        'E-invoice number': order.external_invoice_id || '',
        'Invoice series/template': '',
        'Invoice date': invoiceIssued ? order.booking_date : '',
        'Buyer legal name': order.company_name || accountantCustomer(order, context.text),
        'Buyer tax code': order.tax_code || '',
        'Buyer address': order.invoice_address || '',
        'VAT rate': '8%',
        'Invoice total': order.total,
        'Tax authority code / QR ref': '',
        'Invoice status': order.invoice_status,
        'Difference vs app sale': 0,
      }
    }), eInvoiceColumns)
  }

  if (reportId === 'payments_reconciliation') {
    return accountantRowsOrBlank(context.orders.flatMap((order) => {
      const payments = staffOrderPaymentRows(order, context.paymentsByOrderId)
      if (payments.length > 0) {
        const paidTotal = orderPaidAmount(order, context.paymentsByOrderId)
        return payments.map((payment) => ({
          'Payment ID': payment.id,
          'Sale/Booking ID': order.order_number,
          'Payment date': payment.created_at.slice(0, 10),
          Amount: payment.amount,
          Method: paymentMethodLabel(payment.payment_method, context.text),
          'Bank account / wallet': payment.payment_method === 'bank_transfer' ? 'Bank transfer' : 'Cash drawer',
          'Transaction reference': '',
          'Office staff': payment.created_by || '',
          'Reconciliation status': paidTotal === order.total ? 'Matched' : 'Partial',
          'Bank fee': '',
          'Net received': payment.amount,
        }))
      }
      const paid = orderPaidAmount(order, context.paymentsByOrderId)
      return [{
        'Payment ID': order.order_number ? `PAY-${order.order_number}` : '',
        'Sale/Booking ID': order.order_number,
        'Payment date': order.created_at.slice(0, 10),
        Amount: paid,
        Method: paymentMethodLabel(order.payment_method, context.text),
        'Bank account / wallet': order.payment_method === 'bank_transfer' ? 'Bank transfer' : 'Cash drawer',
        'Transaction reference': '',
        'Office staff': order.created_by || '',
        'Reconciliation status': paid === order.total && paid > 0 ? 'Matched' : paid > 0 ? 'Partial' : 'Unmatched',
        'Bank fee': '',
        'Net received': paid,
      }]
    }), paymentColumns)
  }

  if (reportId === 'refunds_adjustments') {
    return accountantRowsOrBlank(context.orders
      .filter((order) => (
        order.order_status === 'cancelled'
        || order.order_status === 'refunded'
        || order.order_status === 'no_show'
        || order.payment_status === 'refunded'
      ))
      .map((order) => ({
        'Original sale ID': order.order_number,
        'Refund ID': `RF-${order.order_number}`,
        'Refund date': (order.updated_at || order.created_at).slice(0, 10),
        'Refund reason': order.internal_note || context.text.orderStatuses[order.order_status],
        'Amount refunded': orderPaidAmount(order, context.paymentsByOrderId) || order.total,
        Method: orderPaymentLabel(order, context.paymentsByOrderId, context.text),
        'Approved by': '',
        'Related invoice correction?': order.external_invoice_id ? context.text.labels.yes : context.text.labels.no,
        'Corrected invoice number': '',
        Notes: paymentStatusLabel(order.payment_status, context.text),
      })), refundColumns)
  }

  if (reportId === 'discounts_vouchers') {
    return accountantRowsOrBlank(context.orders
      .filter((order) => order.discount_total > 0 || order.discount_code)
      .map((order) => {
        const discountRule = context.discounts.find((discount) => discount.id === order.discount_rule_id)
        return {
          'Sale ID': order.order_number,
          'Promotion name': discountRule?.name || order.discount_code || '',
          'Voucher code': order.discount_code || discountRule?.code || '',
          'Discount type': discountRule ? context.text.discountTypes[discountRule.discount_type] : 'Manual discount',
          'Discount amount': order.discount_total,
          'Approved automatically?': order.discount_rule_id ? context.text.labels.yes : context.text.labels.no,
          'Manual override by': order.discount_rule_id ? '' : order.created_by || '',
          Reason: order.internal_note || '',
        }
      }), discountColumns)
  }

  if (reportId === 'daily_cash_closing') {
    const cashRefunds = context.orders
      .filter((order) => order.payment_status === 'refunded' || order.order_status === 'refunded')
      .reduce((sum, order) => {
        const payments = staffOrderPaymentRows(order, context.paymentsByOrderId)
        if (payments.length > 0) {
          return sum + payments
            .filter((payment) => payment.payment_method === 'cash')
            .reduce((paymentSum, payment) => paymentSum + payment.amount, 0)
        }
        return sum + (order.payment_method === 'cash' ? order.total : 0)
      }, 0)
    return accountantRowsOrBlank([{
      Date: rangeLabel(context.reportStart, context.reportEnd),
      Store: context.storeLabel,
      'Opening cash': '',
      'Cash sales': context.report.cashTotal,
      'Cash refunds': cashRefunds,
      'Cash expenses paid from drawer': '',
      'Expected closing cash': Math.max(context.report.cashTotal - cashRefunds, 0),
      'Actual counted cash': '',
      Difference: '',
      'Closed by': '',
      'Approved by': '',
    }], dailyCashColumns)
  }

  if (reportId === 'expenses_purchases') {
    return [accountantSourcePendingRow([
      'Expense date',
      'Supplier',
      'Category',
      'Description',
      'Amount',
      'Input VAT',
      'Payment method',
      'Paid by',
      'Receipt / attachment',
      'Notes',
    ], context)]
  }

  if (reportId === 'vat_input_output') {
    return [accountantBlankRow(vatInputColumns)]
  }

  if (reportId === 'payroll_staff') {
    return [accountantBlankRow(payrollColumns)]
  }

  if (reportId === 'inventory_movement') {
    return [accountantBlankRow(inventoryColumns)]
  }

  if (reportId === 'deferred_revenue_bookings') {
    return context.orders
      .filter((order) => orderPaidAmount(order, context.paymentsByOrderId) > 0 || order.booking_date > todayString())
      .map((order) => {
        const paid = orderPaidAmount(order, context.paymentsByOrderId)
        const recognized = accountantIsRecognized(order)
        return {
          'Booking ID': order.order_number,
          'Payment date': accountantPaymentDate(order, context.paymentsByOrderId),
          'Play date': order.booking_date,
          'Amount paid': paid,
          'Revenue recognized?': recognized ? context.text.labels.yes : context.text.labels.no,
          'Recognized date': recognized ? order.booking_date : '',
          Status: context.text.orderStatuses[order.order_status],
          'Liability balance': recognized ? 0 : paid,
        }
      })
  }

  if (reportId === 'accountant_journal') {
    return context.orders.flatMap((order) => {
      const { net, vat } = accountantVatSplit(order.total)
      const payments = staffOrderPaymentRows(order, context.paymentsByOrderId)
      const paidRows = payments.length > 0
        ? payments.map((payment) => ({
          Date: payment.created_at.slice(0, 10),
          'Journal type': 'Sales',
          'Account code': payment.payment_method === 'bank_transfer' ? 'Bank' : 'Cash',
          Debit: payment.amount,
          Credit: '',
          Description: `VR ticket sale - ${accountantGameName(order, context.games)}`,
          Ref: order.order_number,
        }))
        : [{
          Date: order.created_at.slice(0, 10),
          'Journal type': 'Sales',
          'Account code': order.payment_method === 'bank_transfer' ? 'Bank' : 'Cash',
          Debit: orderPaidAmount(order, context.paymentsByOrderId),
          Credit: '',
          Description: `VR ticket sale - ${accountantGameName(order, context.games)}`,
          Ref: order.order_number,
        }]
      return [
        ...paidRows,
        {
          Date: order.booking_date,
          'Journal type': 'Sales',
          'Account code': 'Revenue',
          Debit: '',
          Credit: net,
          Description: `VR ticket sale - ${accountantGameName(order, context.games)}`,
          Ref: order.order_number,
        },
        {
          Date: order.booking_date,
          'Journal type': 'Sales',
          'Account code': 'Output VAT',
          Debit: '',
          Credit: vat,
          Description: 'VAT',
          Ref: order.external_invoice_id || order.order_number,
        },
      ]
    })
  }

  if (reportId === 'audit_trail') {
    return context.auditLogs.map((log) => ({
      'Date/time': accountantDateTime(log.created_at),
      User: log.actor_user_id || '',
      Role: '',
      Action: log.action,
      Before: accountantJsonValue(log.old_value),
      After: accountantJsonValue(log.new_value),
      'Reason required?': /delete|refund|cancel|price|discount|role/i.test(log.action) ? context.text.labels.yes : context.text.labels.no,
      Approval: 'Recorded',
      'IP/device': '',
    }))
  }

  return []
}
