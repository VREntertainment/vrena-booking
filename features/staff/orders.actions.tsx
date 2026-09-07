'use client'

import { orderedRange } from '../../lib/staff/dates'
import {
  mergeOrderPayments
} from '../../lib/staff/reporting'
import type {
  StaffOrder,
  StaffOrderPayment
} from '../../lib/staff/types'
import { supabase } from '../../lib/supabase/client'

export type OrdersActionContext = {
  ordersRequestRef: React.RefObject<number>
  ordersQueryKey: string
  ordersQuery: { page: number; start: string; end: string }
  runStaffLoader: (key: import("../../lib/staff/types").StaffDataKey, loader: () => Promise<void>, force?: boolean) => Promise<void>
  ordersPageSize: 50
  setBrowsedOrders: React.Dispatch<React.SetStateAction<{ rows: import("../../lib/staff/types").StaffOrder[]; total: number; key: string } | null>>
  setOrderPayments: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffOrderPayment[]>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffOrdersActions(getContext: () => OrdersActionContext) {
  async function fetchOrderPayments(orderRows: StaffOrder[]) {
    const orderIds = orderRows.map((order) => order.id)
    if (orderIds.length === 0) return []
    const { data, error } = await supabase
      .from('staff_order_payments')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return (data ?? []) as StaffOrderPayment[]
  }

  async function loadRecentOrders() {
    const { ordersRequestRef, ordersQueryKey, ordersQuery, runStaffLoader, ordersPageSize, setBrowsedOrders, setOrderPayments } = getContext()

    const request = ++ordersRequestRef.current
    const queryKey = ordersQueryKey
    const [from, to] = orderedRange(ordersQuery.start, ordersQuery.end)
    await runStaffLoader('orders', async () => {
      const offset = ordersQuery.page * ordersPageSize
      const { data, count, error } = await supabase.from('staff_orders').select('*', { count: 'exact' })
        .gte('booking_date', from).lte('booking_date', to)
        .order('booking_date', { ascending: false }).order('booking_time', { ascending: false })
        .order('id', { ascending: true }).range(offset, offset + ordersPageSize - 1)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as StaffOrder[]
      const payments = await fetchOrderPayments(rows)
      if (request !== ordersRequestRef.current) return
      setBrowsedOrders({ rows, total: count ?? rows.length, key: queryKey })
      setOrderPayments((current) => mergeOrderPayments(current, rows.map((row) => row.id), payments))
    }, true)
  }

  return { fetchOrderPayments, loadRecentOrders }
}
