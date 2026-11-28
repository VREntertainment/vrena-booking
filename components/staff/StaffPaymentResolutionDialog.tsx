'use client'

import { useEffect, useId, useRef, useState } from 'react'
import PaymentVoucherCard from '../PaymentVoucherCard'
import type { PaymentVoucher } from '../../lib/paymentVouchers'
import { formatVnd } from '../../lib/staff/formatting'
import type { StaffOrder } from '../../lib/staff/types'
import { supabase } from '../../lib/supabase/client'

export type BookingPaymentAction = 'keep' | 'cancel' | 'delete'

export default function StaffPaymentResolutionDialog({ order, bookingAction, language, onClose }: {
  order: StaffOrder
  bookingAction: BookingPaymentAction
  language: 'en' | 'vi'
  onClose: (resolved: boolean) => void
}) {
  const vi = language === 'vi'
  const dialog = useRef<HTMLDialogElement>(null)
  const pending = useRef(false)
  const titleId = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PaymentVoucher[] | null>(null)
  const paymentOnly = bookingAction === 'keep'
  const title = paymentOnly ? (vi ? 'Hủy thanh toán' : 'Cancel payment')
    : bookingAction === 'delete' ? (vi ? 'Xóa đặt chỗ đã thanh toán' : 'Delete paid booking')
      : (vi ? 'Hủy đặt chỗ đã thanh toán' : 'Cancel paid booking')
  const close = () => { if (!pending.current) onClose(result !== null) }

  useEffect(() => {
    const focused = document.activeElement
    dialog.current?.showModal()
    return () => { if (focused instanceof HTMLElement && focused.isConnected) focused.focus() }
  }, [])

  async function resolve(action: 'voucher' | 'void') {
    if (pending.current || reason.trim().length < 3) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('staff_resolve_booking_payment', {
        p_order_id: order.id,
        p_expected_updated_at: order.updated_at,
        p_action: action,
        p_booking_action: bookingAction,
        p_reason: reason.trim(),
      })
      if (error) throw new Error(error.message)
      setResult(data.vouchers)
      window.dispatchEvent(new Event('staff-payment-vouchers-updated'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const done = result !== null
  const voucherTotal = result?.reduce((sum, voucher) => sum + voucher.amount, 0) ?? 0
  const issueVoucher = vi ? 'Tạo voucher và chia sẻ' : 'Create voucher to share'
  const voidPayment = paymentOnly ? (vi ? 'Xác nhận hủy thanh toán' : 'Confirm payment cancellation')
    : (vi ? 'Hủy cả thanh toán' : 'Cancel payment as well')
  return <dialog ref={dialog} aria-labelledby={titleId} className="staff-voucher-dialog"
    onCancel={event => { event.preventDefault(); close() }}>
    <div className="staff-voucher-dialog-header"><h2 id={titleId}>{title}</h2>
      <button type="button" className="secondary" disabled={busy} onClick={close}>{vi ? 'Đóng' : 'Close'}</button>
    </div>
    <div className="staff-voucher-editor">
      <strong>{order.order_number}</strong>
      {done ? <>
        <p role="status">{voucherTotal > 0
          ? (vi ? `Đã tạo voucher trị giá ${formatVnd(voucherTotal)}. Chọn chia sẻ để gửi cho khách.` : `Voucher credit of ${formatVnd(voucherTotal)} created. Use Share image to send it to the client.`)
          : (vi ? 'Đã hủy bản ghi thanh toán trong VRena.' : 'The payment record was voided in VRena.')}</p>
        {result.map(voucher => <PaymentVoucherCard key={voucher.id} voucher={voucher} language={language} />)}
      </> : <>
        <p>{paymentOnly
          ? (vi ? 'Hủy bản ghi thanh toán và giữ nguyên đặt chỗ.' : 'Void the recorded payment and keep the booking.')
          : (vi ? 'Chọn cách xử lý khoản đã thanh toán trước khi giải phóng khung giờ.' : 'Choose what to do with the recorded payment before releasing the calendar slot.')}</p>
        <p>{vi ? 'Thao tác hủy chỉ cập nhật VRena. Hoàn tiền cho khách qua phương thức thanh toán ban đầu.' : 'Voiding updates VRena only. Return any money to the client separately through the original payment method.'}</p>
        {order.invoice_status === 'issued' && <p>{vi ? 'Đơn đã có hóa đơn. Cần đối soát điều chỉnh hóa đơn.' : 'An invoice has been issued for this order. Reconcile any invoice adjustment separately.'}</p>}
        <label>{vi ? 'Lý do' : 'Reason'}<textarea minLength={3} maxLength={1000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <div className="staff-row-actions">
          {!paymentOnly && <button type="button" className="primary" disabled={busy || reason.trim().length < 3} onClick={() => void resolve('voucher')}>{issueVoucher}</button>}
          <button type="button" className="danger" disabled={busy || reason.trim().length < 3} onClick={() => void resolve('void')}>{voidPayment}</button>
        </div>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>
  </dialog>
}
