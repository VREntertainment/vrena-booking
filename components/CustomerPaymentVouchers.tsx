'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase/client'
import type { PaymentVoucher } from '../lib/paymentVouchers'
import PaymentVoucherCard from './PaymentVoucherCard'

export default function CustomerPaymentVouchers({ customerId, language }: { customerId: string; language: string }) {
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    void supabase.from('payment_vouchers').select('id,code,source_order_id,source_payment_id,customer_id,venue_key,amount,balance,created_at,expires_at').eq('customer_id', customerId).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return
      setError(error?.message || ''); setVouchers(data || []); setLoading(false)
    })
    return () => { active = false }
  }, [customerId, version])
  return <section aria-label={language === 'vi' ? 'Voucher của khách hàng' : 'Customer vouchers'}>
    <h3>{language === 'vi' ? 'Voucher của bạn' : 'Your vouchers'}</h3>
    <button type="button" className="secondary" onClick={() => { setLoading(true); setVersion(v => v + 1) }}>{language === 'vi' ? 'Làm mới số dư' : 'Refresh balances'}</button>
    {loading ? <p role="status">{language === 'vi' ? 'Đang tải…' : 'Loading…'}</p> : error ? <p role="alert">{error}</p> : vouchers.length ? vouchers.map(v => <PaymentVoucherCard key={v.id} voucher={v} language={language} />) : <p>{language === 'vi' ? 'Chưa có voucher.' : 'No vouchers yet.'}</p>}
  </section>
}
