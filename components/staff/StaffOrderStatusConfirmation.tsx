'use client'
import { formatVnd } from '../../lib/staff/formatting'
import type { StaffOrder } from '../../lib/staff/types'

export type OrderStatusChange = 'completed' | 'no_show'
export default function StaffOrderStatusConfirmation({ order, status, balance, language, disabled, onConfirm, onCancel }: {
  order: StaffOrder; status: OrderStatusChange; balance: number | null; language: 'en' | 'vi'; disabled: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  const completed = status === 'completed'
  const title = completed ? (language === 'vi' ? 'Đánh dấu hoàn tất' : 'Mark completed') : (language === 'vi' ? 'Khách không đến' : 'No-show')
  return <div className="staff-visit-editor" role="group" aria-label={title}>
    <strong>{order.order_number} · {order.booking_date} · {order.booking_time.slice(0, 5)}</strong>
    <p>{completed
      ? (language === 'vi' ? 'Đánh dấu lượt đặt chỗ và đơn hàng đã hoàn tất sau khi khách chơi xong. Thao tác này không ghi nhận thanh toán.' : 'Mark the booking and order as completed after the visit. This does not record a payment.')
      : (language === 'vi' ? 'Đánh dấu khách không đến và giải phóng lịch đặt chỗ. Các khoản đã trả được giữ nguyên.' : 'Mark this booking as a no-show and release its calendar slot. Recorded payments will be retained.')}</p>
    <p>{language === 'vi' ? 'Số tiền còn phải trả' : 'Outstanding balance'}: {balance === null ? (language === 'vi' ? 'Cần kiểm tra biên nhận cũ' : 'Review historical receipts') : formatVnd(balance)}</p>
    <div className="staff-row-actions"><button className={completed ? 'primary' : 'danger'} type="button" disabled={disabled} onClick={onConfirm}>{completed ? (language === 'vi' ? 'Xác nhận hoàn tất' : 'Confirm completion') : (language === 'vi' ? 'Xác nhận không đến' : 'Confirm no-show')}</button><button className="secondary" type="button" disabled={disabled} onClick={onCancel}>{language === 'vi' ? 'Hủy' : 'Cancel'}</button></div>
  </div>
}
