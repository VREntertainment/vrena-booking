'use client'
import { useEffect, useState } from 'react'
import { getSupabase } from '../lib/booking/client'
import { formatVnd } from '../lib/staff/formatting'

export default function PaymentVoucherCheckout({ code, onChange, venue, total, language }: { code: string; onChange: (code: string) => void; venue: string; total: number; language: string }) {
  const [quote, setQuote] = useState<{ code: string; venue: string; balance: number } | null>(null)
  const [error, setError] = useState('')
  const vi = language === 'vi'
  useEffect(() => {
    if (code.length !== 8) return
    let active = true
    const timer = setTimeout(() => {
      void getSupabase().then(client => client.rpc('payment_voucher_quote', { p_code: code, p_venue: venue })).then(({ data, error }) => {
        if (!active) return
        setQuote(!error && data?.balance > 0 ? { code, venue, balance: data.balance } : null)
        setError(error?.message || data?.error || '')
      }).catch(() => { if (active) setError(vi ? 'Không thể kiểm tra voucher.' : 'Unable to check voucher.') })
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [code, venue, vi])
  const current = quote?.code === code && quote.venue === venue ? quote : null
  const applied = current ? Math.min(current.balance, total) : 0
  return <details className="ticket-voucher-details">
    <summary>{vi ? 'Voucher thanh toán (8 ký tự)' : 'Payment voucher (8 characters)'}{code ? ` · ${code}` : ''}</summary>
    <label className="ticket-discount-code-field"><span>{vi ? 'Mã voucher 8 ký tự' : '8-character voucher code'}</span>
      <input maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false} value={code} onChange={event => { onChange(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8)); setError('') }} placeholder="ABCDEFGH" />
    </label>
    {code.length > 0 && code.length < 8 && <p>{vi ? 'Nhập đủ 8 ký tự.' : 'Enter all 8 characters.'}</p>}
    {code.length === 8 && (current ? <p role="status">{vi ? 'Voucher sẽ thanh toán' : 'Voucher will pay'}: <strong>{formatVnd(applied)}</strong><br />{vi ? 'Còn phải trả tại cửa hàng' : 'Remaining to pay at venue'}: <strong>{formatVnd(Math.max(0, total - applied))}</strong><br />{vi ? 'Số dư voucher sau đặt chỗ' : 'Voucher balance after booking'}: {formatVnd(current.balance - applied)}</p> : <p role={error ? 'alert' : 'status'}>{error || (vi ? 'Đang kiểm tra…' : 'Checking…')}</p>)}
  </details>
}
