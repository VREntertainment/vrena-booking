'use client'
import { useRef, useState } from 'react'
import { visitCopy } from '../lib/staffVisit'

export type OrderPaymentEntry = { id: string; method: 'cash' | 'bank_transfer'; amount: number }
export default function StaffOrderPaymentForm({ language, balance, disabled, onSave, onCancel }: {
  language: 'en' | 'vi'; balance: number; disabled: boolean
  onSave: (entry: OrderPaymentEntry) => Promise<boolean>; onCancel: () => void
}) {
  const text = visitCopy[language]
  const [amount, setAmount] = useState(String(Math.max(0, balance)))
  const [method, setMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const request = useRef<OrderPaymentEntry | null>(null)
  return <form className="staff-visit-editor" aria-label={text.recordPayment} onSubmit={async (event) => {
    event.preventDefault()
    if (pending || disabled) return
    if (!request.current || request.current.amount !== Number(amount) || request.current.method !== method) {
      request.current = { id: crypto.randomUUID(), amount: Number(amount), method }
    }
    setPending(true)
    setError('')
    try {
      if (!await onSave(request.current)) setError(text.paymentError)
    } catch { setError(text.paymentError) } finally { setPending(false) }
  }}>
    <fieldset disabled={pending || disabled}>
      <legend>{text.recordPayment}</legend>
      <p>{text.orderPaymentHint}</p>
      <div className="staff-operation-field-grid">
        <label>{language === 'vi' ? 'Hình thức thanh toán đơn' : 'Order payment method'}<select value={method} onChange={(event) => setMethod(event.target.value as 'cash' | 'bank_transfer')}><option value="cash">{text.cash}</option><option value="bank_transfer">{text.bank}</option></select></label>
        <label>{text.amount}<input required type="number" min={1} max={Math.max(1, balance)} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      </div>
      <div className="staff-row-actions"><button type="submit" disabled={balance <= 0}>{text.savePayment}</button><button type="button" onClick={onCancel}>{language === 'vi' ? 'Đóng' : 'Close'}</button></div>
    </fieldset>
    {balance <= 0 && <p>{text.noBalance}</p>}
    {error && <p role="alert">{error}</p>}
  </form>
}
