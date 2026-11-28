'use client'
import { formatVnd } from '../../lib/staff/formatting'
import type { StaffOrder } from '../../lib/staff/types'

const confirmationCopy = {
  completed: {
    en: ['Mark completed', 'Mark the booking and order as completed after the visit. This does not record a payment.', 'Confirm completion'],
    vi: ['Đánh dấu hoàn tất', 'Đánh dấu lượt đặt chỗ và đơn hàng đã hoàn tất sau khi khách chơi xong. Thao tác này không ghi nhận thanh toán.', 'Xác nhận hoàn tất'],
  },
  no_show: {
    en: ['No-show', 'Mark this booking as a no-show and release its calendar slot. Recorded payments will be retained.', 'Confirm no-show'],
    vi: ['Khách không đến', 'Đánh dấu khách không đến và giải phóng lịch đặt chỗ. Các khoản đã trả được giữ nguyên.', 'Xác nhận không đến'],
  },
  cancelled: {
    en: ['Cancel booking', 'Cancel this booking and release its calendar slot. Recorded payments are kept. Handle any refund separately.', 'Confirm cancellation'],
    vi: ['Hủy đặt chỗ', 'Hủy lượt đặt chỗ này và giải phóng khung giờ trên lịch. Các khoản đã thanh toán được giữ lại. Hoàn tiền được xử lý riêng.', 'Xác nhận hủy đặt chỗ'],
  },
}

export type OrderStatusChange = keyof typeof confirmationCopy
export default function StaffOrderStatusConfirmation({ order, status, balance, language, disabled, onConfirm, onCancel }: {
  order: StaffOrder; status: OrderStatusChange; balance: number | null; language: 'en' | 'vi'; disabled: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  const completed = status === 'completed'
  const [title, description, confirm] = confirmationCopy[status][language]
  return <div className="staff-visit-editor" role="group" aria-label={title}>
    <strong>{order.order_number} · {order.booking_date} · {order.booking_time.slice(0, 5)}</strong>
    <p>{description}</p>
    <p>{language === 'vi' ? 'Số tiền còn phải trả' : 'Outstanding balance'}: {balance === null ? (language === 'vi' ? 'Cần kiểm tra biên nhận cũ' : 'Review historical receipts') : formatVnd(balance)}</p>
    <div className="staff-row-actions"><button className={completed ? 'primary' : 'danger'} type="button" disabled={disabled} onClick={onConfirm}>{confirm}</button><button className="secondary" type="button" disabled={disabled} onClick={onCancel}>{status === 'cancelled' ? (language === 'vi' ? 'Giữ đặt chỗ' : 'Keep booking') : (language === 'vi' ? 'Hủy' : 'Cancel')}</button></div>
  </div>
}
