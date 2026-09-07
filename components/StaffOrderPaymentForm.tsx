'use client'
import { useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { paymentMethods } from '../lib/staff/options'
import { staffConsoleText } from '../lib/staff/copy'
import { formatVnd } from '../lib/staff/formatting'
import type { StaffPaymentMethod } from '../lib/staff/types'
import { visitCopy } from '../lib/staffVisit'

export type OrderPaymentEntry = { id: string; method: StaffPaymentMethod; amount: number }
type Split = { id: string; method: StaffPaymentMethod; amount: string }
export default function StaffOrderPaymentForm({ language, balance, disabled, onSave, onCancel }: {
  language: 'en' | 'vi'; balance: number; disabled: boolean
  onSave: (entries: OrderPaymentEntry[]) => Promise<boolean>; onCancel: () => void
}) {
  const text = visitCopy[language]
  const [splits, setSplits] = useState<Split[]>([{ id: 'initial', method: 'cash', amount: String(Math.max(0, balance)) }])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const request = useRef<{ signature: string; entries: OrderPaymentEntry[] } | null>(null)
  const busy = useRef(false)
  const sum = splits.reduce((total, split) => total + Number(split.amount), 0)
  const valid = splits.length > 0 && splits.every((split) => split.amount.trim() !== '' && Number.isSafeInteger(Number(split.amount)) && Number(split.amount) > 0) && sum <= balance
  const patch = (id: string, value: Partial<Split>) => setSplits((rows) => rows.map((row) => row.id === id ? { ...row, ...value } : row))
  return <form className="staff-visit-editor staff-order-payment-editor" aria-label={text.recordPayment} onSubmit={async (event) => {
    event.preventDefault()
    if (busy.current || disabled || !valid) return
    const signature = JSON.stringify(splits)
    if (request.current?.signature !== signature) request.current = { signature, entries: splits.map((split) => ({ id: crypto.randomUUID(), amount: Number(split.amount), method: split.method })) }
    busy.current = true
    setPending(true)
    setError('')
    try {
      if (!await onSave(request.current.entries)) setError(text.paymentError)
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.paymentError) } finally { busy.current = false; setPending(false) }
  }}>
    <fieldset disabled={pending || disabled}>
      <legend>{text.recordPayment}</legend>
      <p>{text.orderPaymentHint}</p>
      <div className="staff-payment-splits">
        <div className="staff-list-head"><strong>{language === 'vi' ? 'Chia thanh toán' : 'Payment splits'}</strong><button className="staff-payment-add secondary" type="button" disabled={Boolean(error) || splits.length >= 10 || balance <= 0} onClick={() => setSplits((rows) => [...rows, { id: crypto.randomUUID(), method: 'cash', amount: String(Math.max(0, balance - sum)) }])}><Plus size={14} />{language === 'vi' ? 'Thêm khoản' : 'Add split'}</button></div>
        <div className="staff-payment-split-list">{splits.map((split, index) => <div className="staff-payment-split-row" key={split.id}>
          <label>{language === 'vi' ? 'Hình thức thanh toán đơn' : 'Order payment method'}<select disabled={Boolean(error)} value={split.method} onChange={(event) => patch(split.id, { method: event.target.value as StaffPaymentMethod })}>{paymentMethods.map((value) => <option key={value} value={value}>{staffConsoleText[language].paymentMethods[value]}</option>)}</select></label>
          <label>{text.amount}<input disabled={Boolean(error)} required type="number" min={1} max={Math.max(1, balance)} step={1} value={split.amount} onChange={(event) => patch(split.id, { amount: event.target.value })} /></label>
          <button className="staff-payment-remove" aria-label={`${language === 'vi' ? 'Xóa khoản' : 'Remove split'} ${index + 1}`} disabled={Boolean(error) || splits.length === 1} type="button" onClick={() => setSplits((rows) => rows.filter((row) => row.id !== split.id))}><Trash2 size={16} /></button>
        </div>)}</div>
      </div>
      <p aria-live="polite">{language === 'vi' ? 'Số dư hiện tại' : 'Current balance'}: {formatVnd(balance)} · {language === 'vi' ? 'Ghi nhận' : 'Recording'}: {formatVnd(sum || 0)} · {language === 'vi' ? 'Còn lại sau khi lưu' : 'Remaining after save'}: {formatVnd(Math.max(0, balance - sum))}</p>
      {sum > balance && <p role="alert">{language === 'vi' ? 'Tổng thanh toán vượt số dư còn lại.' : 'Payments exceed the remaining balance.'}</p>}
      <div className="staff-row-actions"><button className="primary" type="submit" disabled={!valid || balance <= 0}>{text.savePayment}</button><button className="secondary" type="button" onClick={onCancel}>{language === 'vi' ? 'Đóng' : 'Close'}</button></div>
    </fieldset>
    {balance <= 0 && <p>{text.noBalance}</p>}
    {error && <p role="alert">{error} {language === 'vi' ? 'Thử lưu lại hoặc đóng để tải lại đơn trước khi đổi số tiền.' : 'Retry this payment, or close to refresh the order before changing amounts.'}</p>}
  </form>
}
