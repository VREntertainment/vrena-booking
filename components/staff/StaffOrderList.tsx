'use client'

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { ChevronDown, Ellipsis, Wallet } from 'lucide-react'
import { staffDateLabel, normalizeTime } from '../../lib/staff/dates'
import { formatVnd } from '../../lib/staff/formatting'
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

export function StaffOrderList({ language, children, empty }: { language: Language; children: ReactNode; empty: boolean }) {
  const labels = copy[language]
  const text = staffConsoleText[language]
  return <div className={styles.frame}>
    <table className={styles.table} role="table" aria-label={text.tabs.orders}>
      <thead role="rowgroup"><tr role="row">
        {[labels.order, labels.venue, labels.when, text.labels.players, labels.total, labels.balance, labels.payment, labels.booking, labels.actions].map((label, index) =>
          <th key={label} scope="col" className={index >= 3 && index <= 5 ? styles.number : undefined}>{label}</th>
        )}
      </tr></thead>
      <tbody role="rowgroup">{empty ? <tr><td className={styles.empty} colSpan={compactOrderColumnCount}>{text.messages.noOrders}</td></tr> : children}</tbody>
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
  const venue = order.arena_id?.startsWith('cafe:') ? 'cafe' : order.arena_id ? 'hado' : undefined
  const venueName = venue === 'cafe' ? 'Vrena Thao Dien' : venue === 'hado' ? 'Hà Đô Centrosa' : labels.unspecified
  const name = order.customer_name || order.customer_phone || order.customer_email || text.walkIn
  const paymentLabel = paymentStatusLabel(order.payment_status, text)
  const statusLabel = text.orderStatuses[order.order_status]
  const hasBalance = balance !== null && balance > 0
  return <>
    <tr role="row" className={`${styles.row}${highlighted ? ' staff-order-just-created' : ''}`}
      data-order-status={order.order_status} tabIndex={highlighted ? -1 : undefined} ref={rowRef}>
      <td role="cell" className={styles.identity}><strong>{name}</strong><small data-order-number>{order.order_number}</small></td>
      <td role="cell" className={styles.venue}><span data-venue={venue}>{venueName}</span></td>
      <td role="cell" className={styles.when}>
        <span className={styles.mobileLabel} aria-hidden="true">{labels.when}</span>
        <time dateTime={`${order.booking_date}T${normalizeTime(order.booking_time)}`}><strong>{normalizeTime(order.booking_time)}</strong><small>{staffDateLabel(order.booking_date)}</small></time>
      </td>
      <td role="cell" className={`${styles.players} ${styles.number}`}>
        <span className={styles.mobileLabel} aria-hidden="true">{text.labels.players} </span>{order.players_count}
      </td>
      <td role="cell" className={`${styles.total} ${styles.number}`}>
        <span className={styles.mobileLabel} aria-hidden="true">{labels.total} </span>{formatVnd(order.total)}
      </td>
      <td role="cell" className={`${styles.balance} ${styles.number}`} data-due={hasBalance || undefined}>
        <span className={styles.mobileLabel} aria-hidden="true">{labels.balance}</span>
        <strong>{balance === null ? '—' : formatVnd(balance)}</strong>
      </td>
      <td role="cell" className={styles.payment}><span className={styles.badge} data-state={order.payment_status}>{paymentLabel}</span></td>
      <td role="cell" className={styles.booking}><span className={styles.badge} data-state={order.order_status}>{statusLabel}</span></td>
      <td role="cell" className={styles.actions}>
        <div className={styles.actionBar}>
          {recordPayment && <button className={styles.record} type="button" disabled={disabled} onClick={recordPayment}>
            <Wallet size={14} aria-hidden="true" />{labels.record}
          </button>}
          <button className={styles.disclosure} type="button" aria-label={labels.details} title={labels.details}
            aria-expanded={details} aria-controls={detailsId} onClick={() => setDetails((value) => !value)}>
            <ChevronDown size={16} aria-hidden="true" />
            <span className={styles.mobileOnly}>{labels.details}</span>
          </button>
          {actions && <OrderActions label={labels.more}>{actions}</OrderActions>}
        </div>
      </td>
    </tr>
    <tr className={styles.detailRow} hidden={!details} id={detailsId}>
      <td colSpan={compactOrderColumnCount}>
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
      </td>
    </tr>
  </>
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
