'use client'

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { ChevronDown, Ellipsis, Wallet } from 'lucide-react'
import { staffDateLabel, normalizeTime } from '../../lib/staff/dates'
import { formatVnd } from '../../lib/staff/formatting'
import { reportVenue, type ReportVenue } from '../../lib/staff/decisionReport'
import { paymentMethodLabel, paymentStatusLabel } from '../../lib/staff/payments'
import { staffConsoleText } from '../../lib/staff/copy'
import type { StaffOrder, StaffOrderPayment } from '../../lib/staff/types'
import styles from './StaffOrderList.module.css'

type Language = 'en' | 'vi'
const copy = {
  en: {
    order: 'Customer / order', venue: 'Venue', when: 'Session time', total: 'Total', balance: 'Balance due',
    payment: 'Payment', booking: 'Booking status', actions: 'Actions', record: 'Record payment', more: 'More actions',
    details: 'Payment details', paid: 'Paid', history: 'Payment history', unspecified: 'Unspecified',
    noReceipts: 'No payments recorded.', missing: 'Historical receipts are missing. Review the existing payment record before making changes.',
    reason: 'Price adjustment reason',
  },
  vi: {
    order: 'Khách hàng / đơn', venue: 'Địa điểm', when: 'Giờ chơi', total: 'Tổng tiền', balance: 'Còn phải trả',
    payment: 'Thanh toán', booking: 'Trạng thái đặt chỗ', actions: 'Thao tác', record: 'Ghi nhận thanh toán', more: 'Thao tác khác',
    details: 'Chi tiết thanh toán', paid: 'Đã trả', history: 'Lịch sử thanh toán', unspecified: 'Chưa xác định',
    noReceipts: 'Chưa ghi nhận thanh toán.', missing: 'Thiếu biên nhận cũ. Kiểm tra trước khi thay đổi thanh toán.',
    reason: 'Lý do điều chỉnh giá',
  },
}

export const compactOrderColumnCount = 9

export function StaffOrderList({ language, children, empty, label, emptyMessage, grouped }: {
  language: Language
  children: ReactNode
  empty: boolean
  label?: string
  emptyMessage?: string
  grouped?: boolean
}) {
  const labels = copy[language]
  const text = staffConsoleText[language]
  return <div className={styles.frame}>
    <table className={styles.table} role="table" aria-label={label || text.tabs.orders}>
      <thead role="rowgroup"><tr role="row">
        {[labels.order, labels.venue, labels.when, text.labels.players, labels.total, labels.balance, labels.payment, labels.booking, labels.actions].map((label, index) =>
          <th key={label} scope="col" className={index >= 3 && index <= 5 ? styles.number : undefined}>{label}</th>
        )}
      </tr></thead>
      {grouped && !empty ? children : <tbody role="rowgroup">
        {empty ? <tr><td className={styles.empty} colSpan={compactOrderColumnCount}>{emptyMessage || text.messages.noOrders}</td></tr> : children}
      </tbody>}
    </table>
  </div>
}

type RowProps = {
  language: Language; order: StaffOrder; payments: StaffOrderPayment[]; paid: number; balance: number | null;
  gameName?: string; recordPayment?: () => void; actions?: ReactNode; disabled?: boolean;
  highlighted?: boolean; rowRef?: Ref<HTMLTableRowElement>;
}

export function StaffOrderListEntry({ order, language, payments, paid, balance, gameName, recordPayment, actions, disabled, highlighted, rowRef }: RowProps) {
  const text = staffConsoleText[language]
  const labels = copy[language]
  const [details, setDetails] = useState(false)
  const detailsId = useId()
  return <>
    <StaffOrderTableRow language={language}
      name={order.customer_name || order.customer_phone || order.customer_email || text.walkIn}
      reference={order.order_number} venue={reportVenue(null, order.arena_id)}
      date={order.booking_date} time={order.booking_time} players={order.players_count}
      total={order.total} balance={balance}
      payment={{ state: order.payment_status, label: paymentStatusLabel(order.payment_status, text) }}
      status={{ state: order.order_status, label: text.orderStatuses[order.order_status] }}
      recordPayment={recordPayment} actions={actions} disabled={disabled} highlighted={highlighted} rowRef={rowRef}
      disclosure={{ label: labels.details, expanded: details, id: detailsId, toggle: () => setDetails((value) => !value) }}
    />
    <StaffOrderDetailRow hidden={!details} id={detailsId}>
      <StaffOrderPaymentDetails order={order} language={language} payments={payments} paid={paid} balance={balance} gameName={gameName} />
    </StaffOrderDetailRow>
  </>
}

type TableRowProps = {
  language: Language
  name: string
  reference?: string
  venue: ReportVenue
  date: string
  time: string
  endTime?: string
  players: number
  total: number | null
  balance: number | null
  payment: { state?: string; label: string }
  status: { state: string; label: string }
  disclosure?: { label: string; expanded: boolean; id: string; toggle: () => void }
} & Pick<RowProps, 'recordPayment' | 'actions' | 'disabled' | 'highlighted' | 'rowRef'>

export function StaffOrderTableRow({
  language, name, reference, venue, date, time, endTime, players, total, balance, payment, status,
  disclosure, recordPayment, actions, disabled, highlighted, rowRef,
}: TableRowProps) {
  const labels = copy[language]
  const text = staffConsoleText[language]
  const venueName = venue === 'cafe-des-stagiaires' ? 'Vrena Thao Dien' : venue === 'ha-do-centrosa' ? 'Hà Đô Centrosa' : labels.unspecified
  const hasBalance = balance !== null && balance > 0
  return (
    <tr role="row" className={`${styles.row}${highlighted ? ' staff-order-just-created' : ''}`}
      data-order-status={status.state} tabIndex={highlighted ? -1 : undefined} ref={rowRef}>
      <td role="cell" className={styles.identity}><strong>{name}</strong>{reference && <small data-order-number>{reference}</small>}</td>
      <td role="cell" className={styles.venue}><span className="venue-indicator" data-venue={venue}>{venueName}</span></td>
      <td role="cell" className={styles.when}>
        <span className={styles.mobileLabel} aria-hidden="true">{labels.when}</span>
        <time dateTime={`${date}T${normalizeTime(time)}`}><strong>{normalizeTime(time)}</strong><small>{staffDateLabel(date)}{endTime && ` · ${endTime}`}</small></time>
      </td>
      <td role="cell" className={`${styles.players} ${styles.number}`}>
        <span className={styles.mobileLabel} aria-hidden="true">{text.labels.players} </span>{players}
      </td>
      <td role="cell" className={`${styles.total} ${styles.number}`}>
        <span className={styles.mobileLabel} aria-hidden="true">{labels.total} </span>{total === null ? '—' : formatVnd(total)}
      </td>
      <td role="cell" className={`${styles.balance} ${styles.number}`} data-due={hasBalance || undefined}>
        <span className={styles.mobileLabel} aria-hidden="true">{labels.balance}</span>
        <strong>{balance === null ? '—' : formatVnd(balance)}</strong>
      </td>
      <td role="cell" className={styles.payment}><span className={styles.badge} data-state={payment.state}>{payment.label}</span></td>
      <td role="cell" className={styles.booking}><span className={styles.badge} data-state={status.state}>{status.label}</span></td>
      <td role="cell" className={styles.actions}>
        <div className={styles.actionBar}>
          {recordPayment && <button className={styles.record} type="button" disabled={disabled} onClick={recordPayment}>
            <Wallet size={14} aria-hidden="true" />{labels.record}
          </button>}
          {disclosure && <button className={styles.disclosure} type="button" aria-label={disclosure.label} title={disclosure.label}
            aria-expanded={disclosure.expanded} aria-controls={disclosure.id} onClick={disclosure.toggle}>
            <ChevronDown size={16} aria-hidden="true" />
            <span className={styles.mobileOnly}>{disclosure.label}</span>
          </button>}
          {actions && <OrderActions label={labels.more}>{actions}</OrderActions>}
        </div>
      </td>
    </tr>
  )
}

export function StaffOrderDetailRow({ children, id, hidden }: { children: ReactNode; id?: string; hidden?: boolean }) {
  return <tr className={styles.detailRow} id={id} hidden={hidden}>
    <td colSpan={compactOrderColumnCount}>{children}</td>
  </tr>
}

export function StaffOrderPaymentDetails({ order, language, payments, paid, balance, gameName }: Pick<RowProps, 'order' | 'language' | 'payments' | 'paid' | 'balance' | 'gameName'>) {
  const text = staffConsoleText[language]
  const labels = copy[language]
  return (
    <section className={styles.details} aria-label={`${labels.details} · ${order.order_number}`}>
      <div><strong>{labels.paid}: {balance === null ? '—' : formatVnd(paid)}</strong>{gameName && <p>{text.labels.game}: {gameName}</p>}
        {order.price_override_reason && <p>{labels.reason}: {order.price_override_reason}</p>}
        {order.internal_note && <p>{text.labels.internalNote}: {order.internal_note}</p>}
      </div>
      <div><strong>{labels.history}</strong>{payments.length ? <ul>{payments.map((payment) => <li key={payment.id}>
        <span>{paymentMethodLabel(payment.payment_method, text)} · {formatVnd(payment.amount)}</span>
        <small>{new Date(payment.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })}</small>
      </li>)}</ul> : <p>{order.payment_status === 'unpaid' ? labels.noReceipts : labels.missing}</p>}</div>
    </section>
  )
}

/** A disclosure keeps the existing modal launchers mounted and preserves their focus return. */
function OrderActions({ label, children }: { label: string; children: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null)
  const trigger = useRef<HTMLElement>(null)
  const [above, setAbove] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const handleOutside = (event: PointerEvent) => {
      const node = root.current
      if (node?.open && event.target instanceof Node && !node.contains(event.target)) node.open = false
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [open])

  return <details ref={root} className={styles.menu} data-above={above || undefined}
    onToggle={(event) => {
      setOpen(event.currentTarget.open)
      if (event.currentTarget.open) {
        const edge = event.currentTarget.getBoundingClientRect()
        const panel = event.currentTarget.querySelector<HTMLElement>('[data-order-action-panel]')
        setAbove(Boolean(panel && window.innerHeight - edge.bottom < panel.offsetHeight && edge.top > window.innerHeight - edge.bottom))
      }
    }}
    onBlur={(event) => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
    }}
    onKeyDown={(event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || (event.target as HTMLElement).closest('dialog')) return
      if (!event.currentTarget.open) return
      event.preventDefault()
      event.currentTarget.open = false
      trigger.current?.focus()
    }}>
    <summary ref={trigger} className={styles.more} aria-label={label} title={label}>
      <Ellipsis size={18} aria-hidden="true" />
    </summary>
    <div className={styles.menuPanel} data-order-action-panel
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('[data-close-order-menu]')) return
        if (root.current) root.current.open = false
        trigger.current?.focus()
      }}>
      {children}
    </div>
  </details>
}
