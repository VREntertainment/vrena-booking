'use client'
import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase/client'
import { paymentVoucherVenues, voucherExpiryDateInput, voucherExpiryFromDate, type PaymentVoucher } from '../lib/paymentVouchers'

export default function StaffPaymentVoucherActions({ voucher, language, onChanged }: { voucher: PaymentVoucher; language: 'en' | 'vi'; onChanged: () => Promise<void> }) {
  const vi = language === 'vi'
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<{ signature: string; id: string } | null>(null)
  const lock = useRef(false)
  const [mode, setMode] = useState<'modify' | 'delete'>('modify')
  const [venues, setVenues] = useState<string[]>([])
  const [expiryDate, setExpiryDate] = useState('')
  const [noExpiry, setNoExpiry] = useState(true)
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState('')
  function open(nextMode: 'modify' | 'delete') {
    setMode(nextMode); setVenues(voucher.valid_venue_keys ?? [voucher.venue_key])
    setExpiryDate(voucherExpiryDateInput(voucher.expires_at)); setNoExpiry(!voucher.expires_at)
    setReason(''); setConfirmation(''); setError(''); setUncertain(false); request.current = null
    dialog.current?.showModal()
  }
  async function save() {
    if (lock.current) return
    const payload = { p_voucher_id: voucher.id, p_action: mode, p_valid_venue_keys: mode === 'modify' ? venues : null, p_expires_at: mode === 'modify' && !noExpiry ? voucherExpiryFromDate(expiryDate) : null, p_reason: reason.trim() }
    const signature = JSON.stringify(payload)
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() }
    lock.current = true; setBusy(true); setError('')
    let committed = false
    try {
      const { error } = await supabase.rpc('staff_manage_payment_voucher', { ...payload, p_request_id: request.current.id })
      if (error) { setUncertain(!['P0001', '42501'].includes(error.code)); throw new Error(error.message) }
      committed = true; setUncertain(false)
      await onChanged()
      dialog.current?.close()
    } catch (cause) {
      if (committed) dialog.current?.close()
      else setError((cause instanceof Error ? cause.message : 'Unable to save') + (vi ? ' Thử lại cùng yêu cầu hoặc đóng và mở lại để kiểm tra.' : ' Retry the same request, or close and reopen to review.'))
    } finally { lock.current = false; setBusy(false) }
  }
  return <>
    <button type="button" className="secondary" onClick={() => open('modify')}>{vi ? 'Chỉnh sửa' : 'Modify'}</button>
    <button type="button" className="secondary staff-voucher-delete" disabled={voucher.balance !== voucher.amount} title={voucher.balance !== voucher.amount ? (vi ? 'Chỉ có thể xóa voucher chưa sử dụng.' : 'Only unused vouchers can be deleted.') : undefined} onClick={() => open('delete')}>{vi ? 'Xóa' : 'Delete'}</button>
    <dialog ref={dialog} onClose={event => { if (event.target !== event.currentTarget) return; const menu = dialog.current?.closest('details'); if (menu) menu.open = false }} className="staff-voucher-dialog" aria-label={mode === 'modify' ? (vi ? 'Chỉnh sửa voucher' : 'Modify voucher') : (vi ? 'Xóa voucher' : 'Delete voucher')}>
      <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.close()}>{vi ? 'Đóng' : 'Close'}</button>
      <form onSubmit={event => { event.preventDefault(); void save() }}>
        <fieldset disabled={busy}>
          <legend>{mode === 'modify' ? (vi ? 'Chỉnh sửa voucher' : 'Modify voucher') : (vi ? 'Xóa voucher' : 'Delete voucher')}</legend>
          {mode === 'modify' ? <>
            <fieldset disabled={uncertain}>
              <legend>{vi ? 'Địa điểm sử dụng' : 'Valid at venues'}</legend>
              {paymentVoucherVenues.map(venue => <label className="staff-voucher-venue-option" key={venue.key}><input type="checkbox" checked={venues.includes(venue.key)} onChange={event => setVenues(current => event.target.checked ? [...current, venue.key] : current.filter(key => key !== venue.key))} />{venue.name}</label>)}
            </fieldset>
            <label className="staff-voucher-venue-option"><input type="checkbox" disabled={uncertain} checked={noExpiry} onChange={event => setNoExpiry(event.target.checked)} />{vi ? 'Không hết hạn' : 'No expiry'}</label>
            {!noExpiry && <label>{vi ? 'Có hiệu lực đến (giờ Việt Nam)' : 'Valid until (Vietnam time)'}<input type="date" required disabled={uncertain} value={expiryDate} onChange={event => setExpiryDate(event.target.value)} /></label>}
          </> : <>
            <p>{vi ? 'Xóa vĩnh viễn voucher chưa sử dụng. Không hoàn tiền và không cộng lại tiền vào đơn gốc. Lịch sử thanh toán được giữ để đối soát.' : 'Permanently delete this unused voucher. No refund or money restored to the original order. Payment history remains for reconciliation.'}</p>
            <p><strong>{voucher.code}</strong></p>
            <label>{vi ? 'Nhập mã voucher để xác nhận' : 'Type voucher code to confirm'}<input required autoComplete="off" autoCapitalize="characters" disabled={uncertain} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
          </>}
          <label>{vi ? 'Lý do thay đổi' : 'Reason for change'}<textarea required minLength={3} maxLength={1000} disabled={uncertain} value={reason} onChange={event => setReason(event.target.value)} /></label>
          <button className="primary" type="submit" disabled={reason.trim().length < 3 || (mode === 'modify' ? venues.length === 0 : confirmation.trim().toUpperCase() !== voucher.code)}>{mode === 'modify' ? (vi ? 'Lưu thay đổi' : 'Save changes') : (vi ? 'Xóa vĩnh viễn voucher' : 'Permanently delete voucher')}</button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
    </dialog>
  </>
}
