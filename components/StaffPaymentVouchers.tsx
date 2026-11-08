'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase/client'
import { availablePaymentCredit, voucherAmount, voucherMoneyInput, paymentVoucherVenues, type PaymentVoucher } from '../lib/paymentVouchers'
import type { StaffOrder, StaffOrderPayment } from '../lib/staff/types'
import { formatVnd } from '../lib/staff/formatting'
import { paymentMethodLabel } from '../lib/staff/payments'
import { staffConsoleText } from '../lib/staff/copy'
import PaymentVoucherCard from './PaymentVoucherCard'
import StaffPaymentVoucherActions from './StaffPaymentVoucherActions'

type Props = { order: StaffOrder; payments: StaffOrderPayment[]; language: 'en' | 'vi'; onChanged: () => Promise<void>; onClosed?: () => void; summary?: { count: number; balance: number } }
export default function StaffPaymentVouchers({ order, payments, language, onChanged, onClosed, summary }: Props) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  return <div className="staff-voucher-action">
    <button type="button" className="secondary" aria-expanded={open} onClick={() => { setOpen(true); dialog.current?.showModal() }}>{language === 'vi' ? 'Voucher' : 'Vouchers'}{summary && summary.count > 0 && <span className="staff-voucher-summary">{summary.count} · {formatVnd(summary.balance)}</span>}</button>
    <dialog ref={dialog} className="staff-voucher-dialog" aria-label={language === 'vi' ? 'Voucher thanh toán' : 'Payment vouchers'} onClose={event => { if (event.target !== event.currentTarget) return; setOpen(false); onClosed?.() }}>
      <div className="staff-voucher-dialog-header"><h2>{language === 'vi' ? 'Voucher thanh toán' : 'Payment vouchers'}</h2><button type="button" className="secondary" onClick={() => dialog.current?.close()}>{language === 'vi' ? 'Đóng' : 'Close'}</button></div>
      {open && <VoucherEditor order={order} payments={payments} language={language} onChanged={onChanged} />}
    </dialog>
  </div>
}
function VoucherEditor({ order, payments, language, onChanged }: Props) {
  const vi = language === 'vi'
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([])
  const [deletedCredits, setDeletedCredits] = useState<Record<string, number>>({})
  const [receipt, setReceipt] = useState(payments.find(p => p.amount > 0)?.id || '')
  const [amount, setAmount] = useState('')
  const [validDays, setValidDays] = useState('')
  const [validVenues, setValidVenues] = useState<string[]>([order.arena_id === 'cafe:arena-1' ? 'cafe-des-stagiaires' : 'ha-do-centrosa'])
  const [reason, setReason] = useState('')
  const [showConvert, setShowConvert] = useState(false)
  const [code, setCode] = useState('')
  const [redeemAmount, setRedeemAmount] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [version, setVersion] = useState(0)
  const lock = useRef(false)
  const request = useRef<{ signature: string; id: string } | null>(null)
  const [uncertain, setUncertain] = useState<'convert' | 'redeem' | null>(null)
  useEffect(() => {
    let active = true
    void Promise.all([
      supabase.from('payment_vouchers').select('id,code,source_order_id,source_payment_id,customer_id,venue_key,amount,balance,created_at,expires_at,valid_venue_keys').eq('source_order_id', order.id).order('created_at'),
      supabase.rpc('staff_payment_voucher_deleted_credits', { p_order_id: order.id }),
    ]).then(([voucherResult, deletedResult]) => {
      if (!active) return
      const error = voucherResult.error ?? deletedResult.error
      setError(error?.message || ''); setVouchers(voucherResult.data || []); setDeletedCredits(deletedResult.data ?? {}); setLoaded(!error)
    })
    return () => { active = false }
  }, [order.id, version])
  const selected = payments.find(p => p.id === receipt)
  const historical = payments.length === 0 && order.payment_status === 'paid' && ['cash','bank_transfer','card_manual','momo_manual','vnpay'].includes(order.payment_method)
  const available = selected ? Math.min(order.total, Math.max(0, availablePaymentCredit(selected.id, selected.amount, vouchers) - Number(deletedCredits[selected.id] ?? 0))) : historical ? order.total : 0
  const paid = payments.length ? payments.reduce((sum, p) => sum + p.amount, 0) : order.payment_status === 'paid' ? order.total : 0
  const due = Math.max(0, order.total - paid)
  const convertValue = voucherAmount(amount)
  const redeemValue = voucherAmount(redeemAmount)
  async function submit(kind: 'convert' | 'redeem') {
    if (lock.current) return
    const payload = kind === 'convert' ? { p_order_id: order.id, p_payment_id: receipt || null, p_amount: convertValue, p_reason: reason.trim(), p_valid_days: validDays ? Number(validDays) : null, p_valid_venue_keys: validVenues } : { p_order_id: order.id, p_code: code.trim(), p_amount: redeemValue }
    const signature = JSON.stringify({ kind, payload })
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() }
    lock.current = true; setBusy(true); setError(''); setMessage('')
    let committed = false
    try {
      const { data, error } = await supabase.rpc(kind === 'convert' ? 'staff_convert_payment_to_voucher' : 'staff_redeem_payment_voucher', { ...payload, p_request_id: request.current.id })
      if (error) throw new Error(error.message)
      committed = true
      if (kind === 'convert') { setVouchers(current => [...current.filter(v => v.id !== data.id), data]); setShowConvert(false) }
      setUncertain(null); request.current = null
      window.dispatchEvent(new Event('staff-payment-vouchers-updated'))
      setMessage(vi ? 'Đã lưu. Số dư đã được cập nhật.' : 'Saved. Balances updated.')
      setAmount(''); setRedeemAmount(''); setReason('')
      await onChanged(); setVersion(v => v + 1)
    } catch (cause) {
      setUncertain(committed ? null : kind)
      setError((cause instanceof Error ? cause.message : 'Unable to save') + (committed ? (vi ? ' Đã lưu giao dịch; đóng và mở lại để làm mới.' : ' Transaction saved; close and reopen to refresh.') : vi ? ' Thử lại cùng giao dịch hoặc đóng và mở lại để kiểm tra.' : ' Retry the same request, or close and reopen to review.'))
    } finally { lock.current = false; setBusy(false) }
  }
  return <div className="staff-voucher-editor">
    {vouchers.map(v => <PaymentVoucherCard key={v.id} voucher={v} language={language} management={<StaffPaymentVoucherActions voucher={v} language={language} onChanged={async () => { setVersion(version => version + 1); window.dispatchEvent(new Event('staff-payment-vouchers-updated')); await onChanged() }} />} />)}
    {!loaded && !error && <p role="status">{vi ? 'Đang tải voucher…' : 'Loading vouchers…'}</p>}
    {((available > 0 && loaded) || uncertain === 'convert') && <details className="staff-voucher-form-panel" open={vouchers.length === 0 || showConvert || uncertain === 'convert'} onToggle={event => setShowConvert(event.currentTarget.open)}>
      <summary>{vi ? 'Chuyển thanh toán thành voucher' : 'Convert another payment'}</summary>
    <form onSubmit={event => { event.preventDefault(); void submit('convert') }}>
      <fieldset disabled={busy || !loaded || uncertain === 'redeem'}>
        <legend>{vi ? 'Chuyển thanh toán thành voucher' : 'Convert payment to voucher'}</legend>
        <p>{vi ? 'Giảm giá trị đơn gốc và chuyển cùng số tiền sang voucher. Không hoàn tiền mặt, không hủy lịch đặt. Voucher được lưu vào hồ sơ khách đã liên kết.' : 'Credit the original order and move the same amount into a voucher. No cash refund or booking cancellation. Saved automatically to the linked customer profile.'}</p>
        <label>{vi ? 'Khoản thanh toán' : 'Receipt'}<select disabled={!!uncertain} value={receipt} onChange={e => { setReceipt(e.target.value); setAmount('') }}>
          {historical && <option value="">{vi ? 'Thanh toán cũ đã hoàn tất' : 'Historical completed payment'} · {formatVnd(order.total)}</option>}
          {!payments.some(p => p.amount > 0) && !historical && <option value="">{vi ? 'Chưa có biên nhận đủ điều kiện' : 'No eligible receipt'}</option>}
          {payments.filter(p => p.amount > 0).map(p => <option key={p.id} value={p.id}>{paymentMethodLabel(p.payment_method, staffConsoleText[language])} · {formatVnd(p.amount)}</option>)}
        </select></label>
        <p>{vi ? 'Có thể chuyển' : 'Available to convert'}: {formatVnd(available)}</p>
        <label>{vi ? 'Số tiền chuyển (VND)' : 'Conversion amount (VND)'}<input required inputMode="numeric" pattern="[0-9,]+" disabled={!!uncertain} value={voucherMoneyInput(amount)} onChange={e => setAmount(e.target.value.replaceAll(',', ''))} /></label>
        <button type="button" className="secondary" disabled={!!uncertain || available <= 0} onClick={() => setAmount(String(available))}>{vi ? 'Toàn bộ số còn lại' : 'Use full remaining amount'}</button>
        <fieldset disabled={!!uncertain}>
          <legend>{vi ? 'Địa điểm sử dụng' : 'Valid at venues'}</legend>
          <p>{vi ? 'Chọn một hoặc cả hai địa điểm.' : 'Select one or both venues.'}</p>
          {paymentVoucherVenues.map(venue => <label className="staff-voucher-venue-option" key={venue.key}><input type="checkbox" checked={validVenues.includes(venue.key)} onChange={event => setValidVenues(current => event.target.checked ? [...current, venue.key] : current.filter(key => key !== venue.key))} />{venue.name}</label>)}
          {validVenues.length === 0 && <p role="status">{vi ? 'Vui lòng chọn ít nhất một địa điểm.' : 'Select at least one venue.'}</p>}
        </fieldset>
        <label>{vi ? 'Thời hạn sử dụng' : 'Voucher validity'}<select disabled={!!uncertain} value={validDays} onChange={e => setValidDays(e.target.value)}>
          <option value="">{vi ? 'Không hết hạn' : 'No expiry'}</option>
          {[30, 60, 90, 180, 365].map(days => <option key={days} value={days}>{days} {vi ? 'ngày' : 'days'}</option>)}
        </select></label>
        <label>{vi ? 'Lý do chuyển' : 'Conversion reason'}<textarea required minLength={3} maxLength={1000} disabled={!!uncertain} value={reason} onChange={e => setReason(e.target.value)} /></label>
        {order.invoice_status === 'issued' && <p>{vi ? 'Đơn có hóa đơn: cần đối soát điều chỉnh hóa đơn.' : 'This order has an issued invoice: reconcile the credit against that invoice.'}</p>}
        <button className="primary" type="submit" disabled={validVenues.length === 0 || !convertValue || convertValue>available || reason.trim().length<3 || order.payment_status==='refunded' || order.order_status==='refunded'}>{vi ? 'Xác nhận chuyển thành voucher' : 'Confirm conversion to voucher'}</button>
      </fieldset>
    </form></details>}
    {loaded && vouchers.length === 0 && available <= 0 && <p>{vi ? 'Chưa có voucher cho đơn này.' : 'No vouchers for this order yet.'}</p>}
    {due > 0 && !['cancelled','refunded','no_show'].includes(order.order_status) && <form onSubmit={event => { event.preventDefault(); void submit('redeem') }}>
      <fieldset disabled={busy || uncertain === 'convert'}><legend>{vi ? 'Thanh toán bằng voucher' : 'Pay with a voucher'}</legend>
        <label>{vi ? 'Mã voucher' : 'Voucher code'}<input required autoCapitalize="characters" autoComplete="off" disabled={!!uncertain} value={code} onChange={e => setCode(e.target.value)} /></label>
        <label>{vi ? 'Số tiền sử dụng (VND)' : 'Redemption amount (VND)'}<input required inputMode="numeric" pattern="[0-9,]+" disabled={!!uncertain} value={voucherMoneyInput(redeemAmount)} onChange={e => setRedeemAmount(e.target.value.replaceAll(',', ''))} /></label>
        <p>{vi ? 'Còn phải trả' : 'Order balance'}: {formatVnd(due)}</p>
        <button className="primary" type="submit" disabled={!code.trim() || !redeemValue || redeemValue>due}>{vi ? 'Xác nhận sử dụng voucher' : 'Confirm voucher redemption'}</button>
      </fieldset>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}

  </div>
}
