'use client'

import { useRef, useState } from 'react'
import {
  addDays,
  todayString
} from '../../lib/staff/dates'
import type {
  StaffDeleteSessionDraft,
  StaffOperationScope,
  StaffOperationSession,
  StaffOrder,
  StaffOrderEditDraft,
  StaffOrderPayment
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffOperationsState() {
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const [ordersRange, setOrdersRange] = useState(() => ({ start: addDays(todayString(), -30), end: addDays(todayString(), 30) }))
  const [ordersQuery, setOrdersQuery] = useState(() => ({ ...ordersRange, page: 0 }))
  const [browsedOrders, setBrowsedOrders] = useState<{ rows: StaffOrder[]; total: number; key: string } | null>(null)
  const ordersRequestRef = useRef(0)
  const [orderPayments, setOrderPayments] = useState<StaffOrderPayment[]>([])
  const [orderEditDraft, setOrderEditDraft] = useState<StaffOrderEditDraft | null>(null)
  const [orderEditError, setOrderEditError] = useState('')
  const [operationSessions, setOperationSessions] = useState<StaffOperationSession[]>([])
  const [operationSessionScope, setOperationSessionScope] = useState<StaffOperationScope>('today')
  const [expandedOperationSessions, setExpandedOperationSessions] = useState<Record<string, boolean>>({})
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [visitFeedback, setVisitFeedback] = useState<Record<string, string>>({})
  const [visitOrderSelection, setVisitOrderSelection] = useState<Record<string, string>>({})
  const [operationAddProfileBySession, setOperationAddProfileBySession] = useState<Record<string, string>>({})
  const [operationAddProfileQueryBySession, setOperationAddProfileQueryBySession] = useState<Record<string, string>>({})
  const [operationDeleteDraft, setOperationDeleteDraft] = useState<StaffDeleteSessionDraft | null>(null)
  const [operationDeleteError, setOperationDeleteError] = useState('')
  const [operationsDate, setOperationsDate] = useState(todayString())
  return {
    orders,
    setOrders,
    ordersRange,
    setOrdersRange,
    ordersQuery,
    setOrdersQuery,
    browsedOrders,
    setBrowsedOrders,
    ordersRequestRef,
    orderPayments,
    setOrderPayments,
    orderEditDraft,
    setOrderEditDraft,
    orderEditError,
    setOrderEditError,
    operationSessions,
    setOperationSessions,
    operationSessionScope,
    setOperationSessionScope,
    expandedOperationSessions,
    setExpandedOperationSessions,
    paymentOrderId,
    setPaymentOrderId,
    visitFeedback,
    setVisitFeedback,
    visitOrderSelection,
    setVisitOrderSelection,
    operationAddProfileBySession,
    setOperationAddProfileBySession,
    operationAddProfileQueryBySession,
    setOperationAddProfileQueryBySession,
    operationDeleteDraft,
    setOperationDeleteDraft,
    operationDeleteError,
    setOperationDeleteError,
    operationsDate,
    setOperationsDate,
  }
}
