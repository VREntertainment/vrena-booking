'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase/client'
export type StaffVoucherSummary = { count: number; balance: number }
export function useStaffVoucherSummaries(orderIds: string[], enabled: boolean) {
  const [summaries, setSummaries] = useState<Record<string, StaffVoucherSummary>>({})
  useEffect(() => {
    if (!enabled || !orderIds.length) return
    let active = true
    async function refresh() {
      const ids = orderIds
      const pages = await Promise.all(Array.from({ length: Math.ceil(ids.length / 100) }, (_, page) => supabase.from('payment_vouchers').select('source_order_id,balance').in('source_order_id', ids.slice(page * 100, (page + 1) * 100))))
      if (!active || pages.some(page => page.error)) return
      const next: Record<string, StaffVoucherSummary> = {}
      for (const page of pages) for (const voucher of page.data ?? []) {
        const value = next[voucher.source_order_id] ??= { count: 0, balance: 0 }
        value.count++; value.balance += voucher.balance
      }
      setSummaries(next)
    }
    void refresh()
    window.addEventListener('staff-payment-vouchers-updated', refresh)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('staff-payment-vouchers-updated', refresh); window.removeEventListener('focus', refresh) }
  }, [orderIds, enabled])
  return summaries
}
