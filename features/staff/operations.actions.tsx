'use client'

import StaffOrderPaymentForm, { type OrderPaymentEntry } from '../../components/StaffOrderPaymentForm'
import { notifyBookingUpdateEmail } from '../../lib/bookingUpdateNotificationClient'
import {
  parseStaffDuration
} from '../../lib/staff/catalog'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  normalizeTime,
  orderedRange,
  todayString
} from '../../lib/staff/dates'
import { rpcFunctionMissing } from '../../lib/staff/errors'
import {
  operationBookingKind,
  operationSessionChanges,
  orderChanges
} from '../../lib/staff/operations'
import { staffOrderEditDraft } from '../../lib/staff/payments'
import {
  mergeOrderPayments,
  orderPaidAmount,
  staffOrdersPageFromRpc
} from '../../lib/staff/reporting'
import type {
  StaffOperationSession,
  StaffOrder,
  StaffOrderEditDraft,
  StaffOrderPayment,
  StaffSessionParticipant
} from '../../lib/staff/types'
import { getStaffKioskOperatorToken, STAFF_KIOSK_HEADER, supabase } from '../../lib/supabase/client'

export type OperationsActionContext = {
  runStaffLoader: (key: import("../../lib/staff/types").StaffDataKey, loader: () => Promise<void>, force?: boolean) => Promise<void>
  fetchOrderPayments: (orderRows: import("../../lib/staff/types").StaffOrder[]) => Promise<import("../../lib/staff/types").StaffOrderPayment[]>
  setOrders: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffOrder[]>>
  setOrderPayments: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffOrderPayment[]>>
  operationSessionScope: import("../../lib/staff/types").StaffOperationScope
  operationsDate: string
  setOperationSessions: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffOperationSession[]>>
  canCreateOrders: boolean
  setStatus: React.Dispatch<React.SetStateAction<string>>
  text: StaffConsoleCopy
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  orders: import("../../lib/staff/types").StaffOrder[]
  setOperationDeleteError: React.Dispatch<React.SetStateAction<string>>
  setOperationDeleteDraft: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffDeleteSessionDraft | null>>
  operationDeleteDraft: import("../../lib/staff/types").StaffDeleteSessionDraft | null
  setExpandedOperationSessions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setVisitFeedback: React.Dispatch<React.SetStateAction<Record<string, string>>>
  visitText: { savePayment: string; noBalance: string; orderPaymentHint: string; paymentError: string; recordPayment: string; title: string; record: string; arrival: string; save: string; hint: string; missing: string; results: string; arrived: string; payment: string; link: string; choose: string; noOrder: string; linkError: string; linked: string; saved: string; error: string; amount: string; method: string; none: string; cash: string; bank: string; free: string; score: string; accuracy: string; hits: string; movement: string; escape: string; place: string; missingAmount: string; future: string } | { savePayment: string; noBalance: string; orderPaymentHint: string; paymentError: string; recordPayment: string; title: string; record: string; arrival: string; save: string; hint: string; missing: string; results: string; arrived: string; payment: string; link: string; choose: string; noOrder: string; linkError: string; linked: string; saved: string; error: string; amount: string; method: string; none: string; cash: string; bank: string; free: string; score: string; accuracy: string; hits: string; movement: string; escape: string; place: string; missingAmount: string; future: string }
  visitOrderSelection: Record<string, string>
  saving: boolean
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  operationAddProfileBySession: Record<string, string>
  setOperationAddProfileBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setOperationAddProfileQueryBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setBrowsedOrders: React.Dispatch<React.SetStateAction<{ rows: import("../../lib/staff/types").StaffOrder[]; total: number; key: string } | null>>
  setPaymentOrderId: React.Dispatch<React.SetStateAction<string | null>>
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  orderPaymentsByOrderId: Map<string, import("../../lib/staff/types").StaffOrderPayment[]>
  consumeStaffRateLimit: (action: "login_attempt" | "otp_request" | "join_leave" | "booking_attempt" | "admin_destructive" | "password_reset" | "invite_player" | "session_message" | "customer_invite" | "voucher_quote" | "staff_config_write", subject: string) => Promise<boolean>
  operationSessions: import("../../lib/staff/types").StaffOperationSession[]
  games: import("../../lib/staff/types").StaffGame[]
  currentTab: import("../../lib/staff/types").StaffTab
  loadRecentOrders: () => Promise<void>
  loadReportData: (force?: boolean) => Promise<void>
  setOrderEditDraft: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffOrderEditDraft | null>>
  setOrderEditError: React.Dispatch<React.SetStateAction<string>>
  orderEditDraft: import("../../lib/staff/types").StaffOrderEditDraft | null
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffOperationsActions(getContext: () => OperationsActionContext) {
  async function loadOrdersForRange(key: 'today' | 'orders', start: string, end: string, force = false) {
    const { runStaffLoader, fetchOrderPayments, setOrders, setOrderPayments } = getContext()

    const [from, to] = orderedRange(start, end)
    await runStaffLoader(key, async () => {
      const pageSize = key === 'today' ? 120 : 250
      const rows: StaffOrder[] = []
      const payments: StaffOrderPayment[] = []
      let useFallback = false
      for (let offset = 0; ; offset += pageSize) {
        const rpcResult = await supabase.rpc('staff_orders_page', {
          p_start_date: from, p_end_date: to, p_limit: pageSize,
          p_offset: offset, p_search: null, p_status: null,
        })
        if (rpcResult.error || !rpcResult.data) {
          if (rpcResult.error && !rpcFunctionMissing(rpcResult.error)) throw new Error(rpcResult.error.message)
          useFallback = true
          break
        }
        const page = staffOrdersPageFromRpc(rpcResult.data)
        rows.push(...page.orders)
        payments.push(...page.payments)
        if (key !== 'today' || page.orders.length < pageSize) break
      }
      if (useFallback) {
        rows.length = 0
        payments.length = 0
        for (let offset = 0; ; offset += pageSize) {
          const { data, error } = await supabase.from('staff_orders').select('*')
            .gte('booking_date', from).lte('booking_date', to)
            .order('booking_date', { ascending: false }).order('booking_time', { ascending: false })
            .order('id', { ascending: true }).range(offset, offset + pageSize - 1)
          if (error) throw new Error(error.message)
          const page = (data ?? []) as StaffOrder[]
          rows.push(...page)
          payments.push(...await fetchOrderPayments(page))
          if (key !== 'today' || page.length < pageSize) break
        }
      }
      // Refresh the whole date range, including removal of deleted orders.
      setOrders((current) => key === 'orders' ? rows : [
        ...current.filter((order) => order.booking_date < from || order.booking_date > to), ...rows,
      ])
      setOrderPayments((current) => key === 'orders'
        ? payments : mergeOrderPayments(current, rows.map((order) => order.id), payments))
    }, force)
  }

  async function loadTodayOrders(force = false) {
    const { operationSessionScope, operationsDate } = getContext()

    if (operationSessionScope !== 'today') return
    await loadOrdersForRange('today', operationsDate, operationsDate, force)
  }

  async function loadTodaySessions(force = false) {
    const { runStaffLoader, operationSessionScope, operationsDate, fetchOrderPayments, setOrders, setOrderPayments, setOperationSessions } = getContext()

    await runStaffLoader('todaySessions', async () => {
      const today = todayString()
      let query = supabase
        .from('sessions')
        .select('id, venue_key, owner_id, name, date, start_time, duration_minutes, max_players, arena_count, game_options, confirmed_game_id, visibility, status, booking_type, ticket_type, ticket_player_count, ticket_total_price, ticket_status, ticket_reference, notes, session_participants(id, profile_id, display_name, deleted_at, checked_in, payment_status, payment_amount, payment_splits, score, accuracy_percent, hits, movement_meters, projectiles_fired, escape_duration_seconds, placement, chapter_times:session_participant_chapter_times(chapter_number, duration_seconds, game_slug))')
        .is('deleted_at', null)

      query = operationSessionScope === 'past'
        ? query.lt('date', today).order('date', { ascending: false }).order('start_time', { ascending: false }).limit(80)
        : query.eq('date', operationsDate).order('start_time', { ascending: true })

      const { data, error } = await query
      if (error) throw new Error(error.message)
      const sessions = (data ?? []).map((session) => ({
        ...session,
        session_participants: (session.session_participants ?? []).filter((participant) => !participant.deleted_at),
      })) as StaffOperationSession[]
      // Past sessions must load their own orders; today's ledger cannot explain them.
      if (operationSessionScope === 'past' && sessions.length > 0) {
        const { data: linkedOrders, error: ordersError } = await supabase.from('staff_orders')
          .select('*').in('session_id', sessions.map((session) => session.id))
        if (ordersError) throw new Error(ordersError.message)
        const rows = (linkedOrders ?? []) as StaffOrder[]
        const payments = await fetchOrderPayments(rows)
        setOrders(rows)
        setOrderPayments(payments)
      }
      setOperationSessions(sessions)
    }, force)
  }

  async function sendStaffBookingUpdateNotification(
    session: StaffOperationSession | null,
    order: StaffOrder | null,
    payload: {
      action: 'edited' | 'cancelled' | 'deleted'
      title?: string | null
      reference?: string | null
      date?: string | null
      time?: string | null
      total?: number | null
      summary?: string | null
      changes?: Array<{ label: string; before?: string | number | boolean | null; after?: string | number | boolean | null }>
    },
  ) {
    try {
      await notifyBookingUpdateEmail(supabase, {
        action: payload.action,
        bookingKind: session ? operationBookingKind(session) : 'ticket',
        sessionId: session?.id || order?.session_id || null,
        orderId: order?.id || null,
        title: payload.title || session?.name || null,
        reference: payload.reference || order?.order_number || session?.ticket_reference || null,
        date: payload.date || order?.booking_date || session?.date || null,
        time: payload.time || normalizeTime(order?.booking_time || session?.start_time) || null,
        customerName: order?.customer_name || null,
        customerPhone: order?.customer_phone || null,
        customerEmail: order?.customer_email || null,
        total: payload.total ?? order?.total ?? session?.ticket_total_price ?? null,
        summary: payload.summary || null,
        changes: payload.changes || [],
        source: 'Staff Console',
      })
    } catch (error) {
      console.warn('Could not send booking update email.', error)
    }
  }

  async function updateOperationSession(session: StaffOperationSession, patch: Partial<StaffOperationSession>) {
    const { canCreateOrders, setStatus, text, setSaving, orders } = getContext()

    if (!canCreateOrders) {
      setStatus(text.messages.readOnlyBooking)
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc('staff_update_session_operation', {
      p_session_id: session.id,
      p_name: patch.name ?? null,
      p_date: patch.date ?? null,
      p_start_time: patch.start_time ?? null,
      p_duration_minutes: patch.duration_minutes ?? null,
      p_max_players: patch.max_players ?? null,
      p_arena_count: patch.arena_count ?? null,
      p_visibility: patch.visibility ?? null,
      p_status: patch.status ?? null,
      p_confirmed_game_id: patch.confirmed_game_id ?? null,
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus(text.messages.operationSessionSaved)
    const linkedOrder = orders.find((order) => order.session_id === session.id) || null
    void sendStaffBookingUpdateNotification(session, linkedOrder, {
      action: patch.status === 'cancelled' ? 'cancelled' : 'edited',
      summary: patch.status === 'cancelled'
        ? 'Booking status was changed to cancelled.'
        : 'Booking details were edited.',
      changes: operationSessionChanges(session, patch),
    })
    await loadTodaySessions(true)
  }

  function openOperationDeleteDraft(session: StaffOperationSession, order: StaffOrder | null) {
    const { setOperationDeleteError, setOperationDeleteDraft } = getContext()

    setOperationDeleteError('')
    setOperationDeleteDraft({ session, order })
  }

  function closeOperationDeleteDraft() {
    const { setOperationDeleteError, setOperationDeleteDraft } = getContext()

    setOperationDeleteError('')
    setOperationDeleteDraft(null)
  }

  async function deleteOperationSession() {
    const { operationDeleteDraft, canCreateOrders, setStatus, text, setSaving, setOperationDeleteError, setExpandedOperationSessions } = getContext()

    if (!operationDeleteDraft) return
    if (!canCreateOrders) {
      setStatus(text.messages.readOnlyBooking)
      return
    }

    const draft = operationDeleteDraft
    const deleteReason = 'Deleted from Staff Console'
    setSaving(true)
    setOperationDeleteError('')
    let deleteError = ''

    const { error: rpcError } = await supabase.rpc('staff_delete_session_operation', {
      p_session_id: draft.session.id,
      p_delete_reason: deleteReason,
    })

    if (rpcError) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError || !accessToken) {
        deleteError = sessionError?.message || rpcError.message
      } else {
        try {
          const response = await fetch('/api/staff/operations/session/delete', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
              ...(getStaffKioskOperatorToken() ? { [STAFF_KIOSK_HEADER]: getStaffKioskOperatorToken() } : {}),
            },
            body: JSON.stringify({
              sessionId: draft.session.id,
              deleteReason,
            }),
          })
          const payload = await response.json().catch(() => ({})) as { error?: string }
          if (!response.ok) deleteError = payload.error || rpcError.message
        } catch (error) {
          deleteError = error instanceof Error ? error.message : rpcError.message
        }
      }
    }

    setSaving(false)

    if (deleteError) {
      setOperationDeleteError(deleteError)
      setStatus(deleteError)
      return
    }

    closeOperationDeleteDraft()
    setExpandedOperationSessions((current) => {
      const next = { ...current }
      delete next[draft.session.id]
      return next
    })
    setStatus(text.messages.operationSessionDeleted)
    void sendStaffBookingUpdateNotification(draft.session, draft.order, {
      action: 'deleted',
      summary: 'Booking was deleted from the Staff Console. Linked players were removed and any linked order was marked cancelled.',
    })
    await Promise.all([
      loadTodaySessions(true),
      loadTodayOrders(true),
    ])
  }

  async function updateOperationParticipant(session: StaffOperationSession, participant: StaffSessionParticipant, patch: Partial<StaffSessionParticipant>): Promise<boolean> {
    const { canCreateOrders, setSaving, setOperationSessions, setVisitFeedback, visitText } = getContext()

    if (!canCreateOrders) return false
    const patchValue = <K extends keyof StaffSessionParticipant>(key: K) => (
      Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] ?? null : participant[key] ?? null
    )
    setSaving(true)
    try {
      const { error } = await supabase.rpc('staff_upsert_session_participant_result_v2', {
        p_session_id: session.id,
        p_participant_id: participant.id,
        p_profile_id: participant.profile_id,
        p_display_name: participant.display_name ?? null,
        p_checked_in: patch.checked_in ?? participant.checked_in ?? false,
        p_payment_status: patchValue('payment_status'),
        p_payment_amount: patchValue('payment_amount'),
        p_score: patchValue('score'),
        p_accuracy_percent: patchValue('accuracy_percent'),
        p_hits: patchValue('hits'),
        p_movement_meters: patchValue('movement_meters'),
        p_escape_duration_seconds: patchValue('escape_duration_seconds'),
        p_placement: patchValue('placement'),
      })
      if (error) throw error
      // Keep the editor mounted so other unsaved player entries survive this save.
      setOperationSessions((items) => items.map((item) => item.id !== session.id ? item : {
        ...item, session_participants: item.session_participants?.map((player) => player.id === participant.id ? { ...player, ...patch } : player),
      }))
      setVisitFeedback((current) => ({ ...current, [session.id]: visitText.saved }))
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  async function linkVisitOrder(session: StaffOperationSession) {
    const { visitOrderSelection, canCreateOrders, saving, setSaving, setOrders, markStaffDataStale, setVisitFeedback, visitText } = getContext()

    const orderId = visitOrderSelection[session.id]
    if (!canCreateOrders || !orderId || saving) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('staff_orders')
        .update({ session_id: session.id }).eq('id', orderId)
        .eq('booking_date', session.date).is('session_id', null).not('order_status', 'in', '(cancelled,refunded,no_show)').select('id').maybeSingle()
      if (error || !data) throw error || new Error('Order changed')
      setOrders((items) => items.map((item) => item.id === orderId ? { ...item, session_id: session.id } : item))
      markStaffDataStale('orders', 'report')
      setVisitFeedback((current) => ({ ...current, [session.id]: visitText.linked }))
    } catch {
      setVisitFeedback((current) => ({ ...current, [session.id]: visitText.linkError }))
    } finally {
      setSaving(false)
    }
  }

  async function addOperationParticipant(session: StaffOperationSession) {
    const { operationAddProfileBySession, setSaving, setStatus, setOperationAddProfileBySession, setOperationAddProfileQueryBySession, text } = getContext()

    const profileId = operationAddProfileBySession[session.id] || ''
    if (!profileId) return

    setSaving(true)
    const { error } = await supabase.rpc('staff_upsert_session_participant_result_v2', {
      p_session_id: session.id,
      p_profile_id: profileId,
      p_checked_in: false,
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setOperationAddProfileBySession((current) => ({ ...current, [session.id]: '' }))
    setOperationAddProfileQueryBySession((current) => ({ ...current, [session.id]: '' }))
    setStatus(text.messages.operationParticipantAdded)
    await loadTodaySessions(true)
  }

  async function removeOperationParticipant(session: StaffOperationSession, participant: StaffSessionParticipant) {
    const { text, setSaving, setStatus } = getContext()

    if (!window.confirm(text.actions.removePlayer)) return

    setSaving(true)
    const { error } = await supabase.rpc('staff_remove_session_participant_operation', {
      p_session_id: session.id,
      p_participant_id: participant.id,
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus(text.messages.operationParticipantRemoved)
    await loadTodaySessions(true)
  }

  async function updateOperationChapterTime(session: StaffOperationSession, participant: StaffSessionParticipant, gameSlug: string, chapterNumber: number, value: string) {
    const { setSaving, setStatus, text } = getContext()

    const durationSeconds = parseStaffDuration(value)
    if (!durationSeconds) return

    setSaving(true)
    const { error } = await supabase.rpc('set_session_participant_chapter_time', {
      p_participant_id: participant.id,
      p_game_slug: gameSlug,
      p_chapter_number: chapterNumber,
      p_duration_seconds: durationSeconds,
    })
    setSaving(false)

    if (error) {
      setStatus(error.message)
      return
    }

    setStatus(text.messages.operationParticipantSaved)
    await loadTodaySessions(true)
  }

  async function recordOrderPayment(order: StaffOrder, entry: OrderPaymentEntry): Promise<boolean> {
    const { canCreateOrders, saving, setSaving, setOrders, setBrowsedOrders, setOrderPayments, markStaffDataStale, setPaymentOrderId } = getContext()

    if (!canCreateOrders || saving) return false
    setSaving(true)
    try {
      const { data, error } = await supabase.rpc('staff_record_order_payment', {
        p_order_id: order.id, p_payment_id: entry.id, p_payment_method: entry.method, p_amount: entry.amount,
      })
      if (error || !data?.order || !data?.payment) return false
      const updated = data.order as StaffOrder
      setOrders((items) => items.map((item) => item.id === order.id ? updated : item))
      setBrowsedOrders((current) => current ? { ...current, rows: current.rows.map((item) => item.id === order.id ? updated : item) } : null)
      setOrderPayments((items) => [...items.filter((item) => item.id !== data.payment.id), data.payment])
      markStaffDataStale('report')
      setPaymentOrderId(null)
      return true
    } finally { setSaving(false) }
  }

  function orderPaymentForm(order: StaffOrder) {
    const { resolvedLanguage, saving, orderPaymentsByOrderId, setPaymentOrderId } = getContext()

    return <StaffOrderPaymentForm language={resolvedLanguage} disabled={saving}
      balance={Math.max(0, order.total - orderPaidAmount(order, orderPaymentsByOrderId))}
      onCancel={() => setPaymentOrderId(null)} onSave={(entry) => recordOrderPayment(order, entry)} />
  }

  async function updateOrder(order: StaffOrder, patch: Partial<StaffOrder>) {
    const {
      canCreateOrders,
      consumeStaffRateLimit,
      setSaving,
      setStatus,
      text,
      setOrders,
      operationSessions,
      games,
      markStaffDataStale,
      currentTab,
      loadRecentOrders,
      loadReportData,
    } = getContext()

    if (!canCreateOrders) return
    if (patch.order_status && ['cancelled', 'refunded', 'no_show'].includes(patch.order_status)) {
      const allowed = await consumeStaffRateLimit('admin_destructive', `staff-order:${order.id}:${patch.order_status}`)
      if (!allowed) return
    }
    setSaving(true)
    const { error } = await supabase.from('staff_orders').update(patch).eq('id', order.id)
    setStatus(error ? error.message : text.messages.orderUpdated)
    if (!error) {
      setOrders((items) => items.map((item) => item.id === order.id ? { ...item, ...patch } : item))
      const linkedSession = operationSessions.find((session) => session.id === order.session_id) || null
      const updatedOrder = { ...order, ...patch }
      void sendStaffBookingUpdateNotification(linkedSession, updatedOrder, {
        action: patch.order_status === 'cancelled' ? 'cancelled' : 'edited',
        title: linkedSession?.name || 'Ticket booking',
        reference: order.order_number,
        date: updatedOrder.booking_date,
        time: normalizeTime(updatedOrder.booking_time),
        total: updatedOrder.total,
        summary: patch.order_status === 'cancelled'
          ? 'Booking order was changed to cancelled.'
          : 'Booking order details were edited.',
        changes: orderChanges(order, patch, games),
      })
      markStaffDataStale('today', 'orders', 'report')
      if (currentTab === 'today') await loadTodayOrders(true)
      if (currentTab === 'orders') await loadRecentOrders()
      if (currentTab === 'report') await loadReportData(true)
    }
    setSaving(false)
  }

  function beginOrderEdit(order: StaffOrder) {
    const { canCreateOrders, saving, setOrderEditDraft, setOrderEditError, setStatus } = getContext()

    if (!canCreateOrders || saving) return
    setOrderEditDraft(staffOrderEditDraft(order))
    setOrderEditError('')
    setStatus('')
  }

  function patchOrderEditDraft(patch: Partial<StaffOrderEditDraft>) {
    const { setOrderEditDraft, setOrderEditError } = getContext()

    setOrderEditDraft((current) => current ? { ...current, ...patch } : current)
    setOrderEditError('')
  }

  function cancelOrderEdit() {
    const { saving, setOrderEditDraft, setOrderEditError } = getContext()

    if (saving) return
    setOrderEditDraft(null)
    setOrderEditError('')
  }

  async function saveOrderEdit(order: StaffOrder) {
    const {
      canCreateOrders,
      saving,
      orderEditDraft,
      games,
      setOrderEditError,
      text,
      setSaving,
      setStatus,
      setOrders,
      setOperationSessions,
      setOrderEditDraft,
      operationSessions,
      markStaffDataStale,
      currentTab,
      loadRecentOrders,
      loadReportData,
    } = getContext()

    if (!canCreateOrders || saving || orderEditDraft?.orderId !== order.id) return

    const selectedGame = games.find((game) => game.id === orderEditDraft.gameId)
    const nextTotal = Number(orderEditDraft.total)
    if (
      !selectedGame
      || !orderEditDraft.bookingDate
      || !orderEditDraft.bookingTime
      || !Number.isInteger(nextTotal)
      || nextTotal < 0
    ) {
      setOrderEditError(text.messages.orderEditInvalid)
      return
    }

    setSaving(true)
    setOrderEditError('')
    setStatus('')

    try {
      const { data, error } = await supabase.rpc('staff_update_order_operation', {
        p_booking_date: orderEditDraft.bookingDate,
        p_booking_time: orderEditDraft.bookingTime,
        p_game_id: selectedGame.id,
        p_order_id: order.id,
        p_total: nextTotal,
      })
      if (error) throw error

      const patch: Partial<StaffOrder> = {
        booking_date: orderEditDraft.bookingDate,
        booking_time: orderEditDraft.bookingTime,
        game_id: selectedGame.id,
        subtotal: nextTotal + order.discount_total,
        total: nextTotal,
      }
      const returnedOrder = data && typeof data === 'object' && !Array.isArray(data)
        ? data as Partial<StaffOrder>
        : null
      const updatedOrder = { ...order, ...patch, ...(returnedOrder || {}) }

      setOrders((items) => items.map((item) => item.id === order.id ? updatedOrder : item))
      if (order.session_id) {
        setOperationSessions((items) => items.map((session) => session.id === order.session_id
          ? {
            ...session,
            confirmed_game_id: selectedGame.slug,
            date: orderEditDraft.bookingDate,
            start_time: orderEditDraft.bookingTime,
            ticket_total_price: session.booking_type === 'ticket' ? nextTotal : session.ticket_total_price,
          }
          : session))
      }

      setOrderEditDraft(null)
      setStatus(text.messages.orderUpdated)
      const linkedSession = operationSessions.find((session) => session.id === order.session_id) || null
      void sendStaffBookingUpdateNotification(linkedSession, updatedOrder, {
        action: 'edited',
        title: linkedSession?.name || 'Ticket booking',
        reference: order.order_number,
        date: updatedOrder.booking_date,
        time: normalizeTime(updatedOrder.booking_time),
        total: updatedOrder.total,
        summary: 'Booking order game, schedule, or total was edited.',
        changes: orderChanges(order, patch, games),
      })
      markStaffDataStale('today', 'orders', 'report')
      if (currentTab === 'today') await Promise.all([loadTodayOrders(true), loadTodaySessions(true)])
      if (currentTab === 'orders') await loadRecentOrders()
      if (currentTab === 'report') await loadReportData(true)
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message || '')
        : String(error)
      setOrderEditError(message)
      setStatus(message)
    } finally {
      setSaving(false)
    }
  }

  return {
    loadOrdersForRange,
    loadTodayOrders,
    loadTodaySessions,
    sendStaffBookingUpdateNotification,
    updateOperationSession,
    openOperationDeleteDraft,
    closeOperationDeleteDraft,
    deleteOperationSession,
    updateOperationParticipant,
    linkVisitOrder,
    addOperationParticipant,
    removeOperationParticipant,
    updateOperationChapterTime,
    recordOrderPayment,
    orderPaymentForm,
    updateOrder,
    beginOrderEdit,
    patchOrderEditDraft,
    cancelOrderEdit,
    saveOrderEdit,
  }
}
