'use client'

import { brandedGameName } from '../../lib/anvio'

import StaffGamesPlayed from '../../components/staff/StaffGamesPlayed'

import { StaffOrderDetailRow, StaffOrderList, StaffOrderPaymentDetails, StaffOrderTableRow } from '../../components/staff/StaffOrderList'
import type { BookingPaymentAction } from '../../components/staff/StaffPaymentResolutionDialog'

import { useState } from 'react'
import { reportVenue } from '../../lib/staff/decisionReport'
import { ReportToolbarMenu } from './ReportToolbarMenu'
import reportStyles from './ReportCharts.module.css'
import StaffOrderStatusConfirmation, { type OrderStatusChange } from '../../components/staff/StaffOrderStatusConfirmation'
import {
  CalendarDays,
  Check,
  ListFilter,
  Plus,
  Trash2,
  UserX
} from 'lucide-react'
import { StaffOperationPlayerSearch } from '../../components/staff/StaffOperationPlayerSearch'
import { StaffPickerField } from '../../components/staff/StaffPickerField'
import StaffVisitParticipantEditor from '../../components/StaffVisitParticipantEditor'
import {
  formatStaffDuration
} from '../../lib/staff/catalog'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  addMinutesToTime,
  normalizeTime,
  todayString
} from '../../lib/staff/dates'
import {
  formatVnd
} from '../../lib/staff/formatting'
import {
  operationParticipantName,
  sessionBookedPlayers,
  sessionCapacity,
  sessionCheckedInCount,
  sessionGameName,
  sessionKindLabel,
  sessionStaffGame
} from '../../lib/staff/operations'
import { hasRecordedOrderPayment, paymentStatusLabel } from '../../lib/staff/payments'
import {
  isDemoProfile
} from '../../lib/staff/profiles'
import {
  orderPaidAmount
} from '../../lib/staff/reporting'
import type {
  StaffOperationSession
} from '../../lib/staff/types'
import { visitCopy, visitProgress } from '../../lib/staffVisit'
import { ButtonIconText } from './shared'

export type TodaySectionProps = {
  onEditBooking: (sessionId: string) => void
  resolveBookingPayment: (order: import('../../lib/staff/types').StaffOrder, action: BookingPaymentAction) => void
  text: StaffConsoleCopy
  operationsDate: string
  setOperationsDate: React.Dispatch<React.SetStateAction<string>>
  onOpenSessionCalendar: ((dateValue: string, venueKey?: "ha-do-centrosa" | "cafe-des-stagiaires" | undefined) => void) | undefined
  canCreateOrders: boolean
  setBooking: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").BookingForm>>
  setActiveTab: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffTab>>
  operationSessionScope: import("../../lib/staff/types").StaffOperationScope
  setOperationSessionScope: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffOperationScope>>
  operationSummary: { sessions: number; ticketBookings: number; bookedPlayers: number; capacity: number; checkedIn: number; checkablePlayers: number; money: { bookingValue: number; orderTotal: number; orderPaid: number; orderBalance: number; pendingValue: number; pendingCount: number; unlinkedValue: number; unlinkedCount: number; unlinkedSessionIds: string[] } }
  operationSessions: import("../../lib/staff/types").StaffOperationSession[]
  operationOrderBySessionId: Map<string, import("../../lib/staff/types").StaffOrder>
  expandedOperationSessions: Record<string, boolean>
  games: import("../../lib/staff/types").StaffGame[]
  profiles: import("../../lib/staff/types").StaffProfile[]
  orderPaymentsByOrderId: Map<string, import("../../lib/staff/types").StaffOrderPayment[]>
  visitText: (typeof visitCopy)["en" | "vi"]
  visitFeedback: Record<string, string>
  setExpandedOperationSessions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  saving: boolean
  setPaymentOrderId: React.Dispatch<React.SetStateAction<string | null>>
  setVisitFeedback: React.Dispatch<React.SetStateAction<Record<string, string>>>
  updateOrder: (order: import("../../lib/staff/types").StaffOrder, patch: Partial<import("../../lib/staff/types").StaffOrder>) => Promise<void>
  openOperationDeleteDraft: (session: import("../../lib/staff/types").StaffOperationSession, order: import("../../lib/staff/types").StaffOrder | null) => void
  paymentOrderId: string | null
  orderPaymentForm: (order: import("../../lib/staff/types").StaffOrder) => React.JSX.Element
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  visitOrderSelection: Record<string, string>
  setVisitOrderSelection: React.Dispatch<React.SetStateAction<Record<string, string>>>
  orders: import("../../lib/staff/types").StaffOrder[]
  linkVisitOrder: (session: import("../../lib/staff/types").StaffOperationSession) => Promise<void>
  updateOperationSession: (session: import("../../lib/staff/types").StaffOperationSession, patch: Partial<import("../../lib/staff/types").StaffOperationSession>) => Promise<void>
  setOperationAddProfileQueryBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setOperationAddProfileBySession: React.Dispatch<React.SetStateAction<Record<string, string>>>
  operationAddProfileQueryBySession: Record<string, string>
  operationAddProfileBySession: Record<string, string>
  addOperationParticipant: (session: import("../../lib/staff/types").StaffOperationSession) => Promise<void>
  removeOperationParticipant: (session: import("../../lib/staff/types").StaffOperationSession, participant: import("../../lib/staff/types").StaffSessionParticipant) => Promise<void>
  updateOperationParticipant: (session: import("../../lib/staff/types").StaffOperationSession, participant: import("../../lib/staff/types").StaffSessionParticipant, patch: Partial<import("../../lib/staff/types").StaffSessionParticipant>) => Promise<boolean>
  updateOperationChapterTime: (session: import("../../lib/staff/types").StaffOperationSession, participant: import("../../lib/staff/types").StaffSessionParticipant, gameSlug: string, chapterNumber: number, value: string) => Promise<void>
  unlinkedOperationOrders: import("../../lib/staff/types").StaffOrder[]
  orderRows: (rows: import("../../lib/staff/types").StaffOrder[], paymentsByOrderId?: Map<string, import("../../lib/staff/types").StaffOrderPayment[]>) => React.JSX.Element
}

export default function TodaySection({
  text,
  operationsDate,
  setOperationsDate,
  onOpenSessionCalendar,
  onEditBooking,
  resolveBookingPayment,
  canCreateOrders,
  setBooking,
  setActiveTab,
  operationSessionScope,
  setOperationSessionScope,
  operationSummary,
  operationSessions,
  operationOrderBySessionId,
  expandedOperationSessions,
  games,
  profiles,
  orderPaymentsByOrderId,
  visitText,
  visitFeedback,
  setExpandedOperationSessions,
  saving,
  setPaymentOrderId,
  setVisitFeedback,
  updateOrder,
  openOperationDeleteDraft,
  paymentOrderId,
  orderPaymentForm,
  resolvedLanguage,
  visitOrderSelection,
  setVisitOrderSelection,
  orders,
  linkVisitOrder,
  updateOperationSession,
  setOperationAddProfileQueryBySession,
  setOperationAddProfileBySession,
  operationAddProfileQueryBySession,
  operationAddProfileBySession,
  addOperationParticipant,
  removeOperationParticipant,
  updateOperationParticipant,
  updateOperationChapterTime,
  unlinkedOperationOrders,
  orderRows,
}: TodaySectionProps) {
  const [statusConfirmation, setStatusConfirmation] = useState<{ id: string; status: OrderStatusChange } | null>(null)
  const vi = resolvedLanguage === 'vi'
  return (
    <div className={`staff-card staff-card-wide staff-operations-card ${reportStyles.dashboard}`}>
      <div className={reportStyles.reportToolbar} role="group" aria-label={text.labels.operationsCalendar}>
        <label className={reportStyles.toolbarControl}>
          <span className={reportStyles.toolbarLabel}>{text.labels.date}</span>
          <StaffPickerField ariaLabel={text.labels.operationsDate} placeholder={text.chooseDate}
            type="date" value={operationsDate} onChange={setOperationsDate} />
        </label>
        <ReportToolbarMenu label={text.labels.sessions} icon={<ListFilter aria-hidden="true" size={15} />}
          value={operationSessionScope === 'past' ? text.actions.past : text.actions.today}>
          <button type="button" aria-pressed={operationSessionScope === 'today'} onClick={() => {
            setOperationsDate(todayString())
            setOperationSessionScope('today')
          }}>{text.actions.today}</button>
          <button type="button" aria-pressed={operationSessionScope === 'past'} onClick={() => setOperationSessionScope('past')}>{text.actions.past}</button>
        </ReportToolbarMenu>
        <div className={reportStyles.toolbarActions}>
          {onOpenSessionCalendar && <button aria-label={text.aria.openSessionCalendar} type="button"
            onClick={() => onOpenSessionCalendar(operationsDate)}>
            <ButtonIconText icon={<CalendarDays aria-hidden="true" size={15} />}>{text.actions.sessionCalendar}</ButtonIconText>
          </button>}
          {canCreateOrders && <button type="button" onClick={() => {
            setBooking((current) => ({ ...current, date: operationsDate }))
            setActiveTab('new')
          }}><ButtonIconText icon={<Plus aria-hidden="true" size={15} />}>{text.tabs.new}</ButtonIconText></button>}
        </div>
      </div>

      <div className="staff-summary-grid staff-operations-summary">
        <div><span>{text.labels.sessions}</span><strong>{operationSummary.sessions}</strong></div>
        <div><span>{text.labels.ticketBookings}</span><strong>{operationSummary.ticketBookings}</strong></div>
        <div><span>{text.labels.capacity}</span><strong>{operationSummary.bookedPlayers}/{operationSummary.capacity}</strong></div>
        <div><span>{text.labels.checkIns}</span><strong>{operationSummary.checkedIn}/{operationSummary.checkablePlayers}</strong></div>

      </div>

      <details className="staff-operations-money">
        <summary>
          <strong>{text.operationsMoney.title}: {formatVnd(operationSummary.money.bookingValue)}</strong>
          <span>{operationSummary.money.unlinkedCount > 0
            ? `${text.operationsMoney.needsOrder}: ${operationSummary.money.unlinkedCount}`
            : text.operationsMoney.clear}</span>
        </summary>
        <div className="staff-summary-grid staff-operations-money-grid">
          {(['bookingValue', 'orderTotal', 'orderPaid', 'orderBalance', 'pendingValue', 'unlinkedValue'] as const).map((key) => (
            <div key={key}><span>{text.operationsMoney[key]}</span><strong>{formatVnd(operationSummary.money[key])}</strong></div>
          ))}
        </div>
        <p>{text.operationsMoney.hint}</p>
        {operationSessionScope === 'past' && <p>{text.operationsMoney.past}</p>}
      </details>

      <StaffOrderList language={resolvedLanguage} grouped label={text.labels.sessions}
        empty={operationSessions.length === 0} emptyMessage={text.messages.noOperationSessions}>
        {operationSessions.map((session) => {
          const order = operationOrderBySessionId.get(session.id)
          const progress = visitProgress(session, order)
          const participants = session.session_participants || []
          const isExpanded = Boolean(expandedOperationSessions[session.id])
          const staffGame = sessionStaffGame(session, games)
          const isEscapeGame = staffGame?.game_type === 'escape'
          const chapterCount = Math.max(1, Math.min(50, Number(staffGame?.escape_chapter_count ?? 1) || 1))
          const addableProfiles = profiles.filter((item) => !isDemoProfile(item) && !participants.some((participant) => participant.profile_id === item.id))
          const payments = order ? orderPaymentsByOrderId.get(order.id) || [] : []
          const hasPayment = Boolean(order && hasRecordedOrderPayment(order, payments))
          const paidAmount = order ? orderPaidAmount(order, orderPaymentsByOrderId) : 0
          const totalAmount = order?.total ?? session.ticket_total_price ?? null
          const balance = order && !(order.payment_status === 'partially_paid' && payments.length === 0)
            ? Math.max(0, order.total - paidAmount) : null
          const canCollect = canCreateOrders && order && balance !== null && balance > 0
            && order.payment_status !== 'refunded' && !['cancelled', 'refunded', 'no_show'].includes(order.order_status)
          const terminal = order && ['cancelled', 'refunded', 'no_show', 'completed'].includes(order.order_status)
          const detailsId = `visit-details-${session.id}`
          const detailLabel = vi ? 'Chi tiết lượt chơi' : 'Visit details'
          const gameName = sessionGameName(session, games, text)
          const setExpanded = (expanded: boolean) => setExpandedOperationSessions((current) => ({ ...current, [session.id]: expanded }))
          const showStatusConfirmation = order && statusConfirmation?.id === session.id
          const showPayment = order && paymentOrderId === order.id
          return (
            <tbody key={session.id} role="rowgroup" data-operation-session>
              <StaffOrderTableRow language={resolvedLanguage} name={session.name} reference={order?.order_number || session.ticket_reference || undefined}
                venue={reportVenue(session.venue_key, order?.arena_id)} date={session.date} time={session.start_time}
                endTime={addMinutesToTime(session.start_time, session.duration_minutes)}
                players={sessionBookedPlayers(session, order)} total={totalAmount} balance={balance}
                payment={{ state: order?.payment_status, label: order ? paymentStatusLabel(order.payment_status, text)
                  : session.ticket_status === 'pending' ? text.operationsMoney.pending
                    : operationSummary.money.unlinkedSessionIds.includes(session.id) ? text.operationsMoney.needsOrder : text.labels.noLinkedOrder }}
                status={{ state: order?.order_status || session.status, label: order ? text.orderStatuses[order.order_status]
                  : session.status === 'open' ? (vi ? 'Đang mở' : 'Open') : text.orderStatuses[session.status] }}
                disclosure={{ label: detailLabel, expanded: isExpanded, id: detailsId, toggle: () => setExpanded(!isExpanded) }}
                recordPayment={canCollect ? () => setPaymentOrderId(order.id) : undefined} disabled={saving}
                actions={<>
                  {canCreateOrders && <button type="button" data-close-order-menu onClick={() => setExpanded(true)}>{visitText.record}</button>}
                  {canCreateOrders && <button type="button" data-close-order-menu disabled={saving} onClick={() => onEditBooking(session.id)}>{vi ? 'Sửa chi tiết đặt chỗ' : 'Edit booking details'}</button>}
                  {order && canCreateOrders && !terminal && <>
                    <button type="button" data-close-order-menu disabled={saving} onClick={() => {
                      if (!progress.recorded) {
                        setExpanded(true)
                        setVisitFeedback((current) => ({ ...current, [session.id]: visitText.hint }))
                        return
                      }
                      setStatusConfirmation({ id: session.id, status: 'completed' })
                    }}><ButtonIconText icon={<Check aria-hidden="true" size={14} />}>{text.actions.done}</ButtonIconText></button>
                    <button type="button" data-close-order-menu data-negative disabled={saving} onClick={() => setStatusConfirmation({ id: session.id, status: 'no_show' })}>
                      <ButtonIconText icon={<UserX aria-hidden="true" size={14} />}>{text.actions.noShow}</ButtonIconText>
                    </button>
                    <button type="button" data-close-order-menu data-negative disabled={saving} onClick={() => hasPayment ? resolveBookingPayment(order, 'cancel') : setStatusConfirmation({ id: session.id, status: 'cancelled' })}>
                      {vi ? 'Hủy đặt chỗ' : 'Cancel booking'}
                    </button>
                  </>}
                  {order && hasPayment && canCreateOrders && <button type="button" data-close-order-menu data-negative disabled={saving} onClick={() => resolveBookingPayment(order, 'keep')}>
                    {vi ? 'Hủy thanh toán' : 'Cancel payment'}
                  </button>}
                  {canCreateOrders && <button type="button" data-close-order-menu data-negative disabled={saving} onClick={() => order && hasPayment ? resolveBookingPayment(order, 'delete') : openOperationDeleteDraft(session, order || null)}>
                    <ButtonIconText icon={<Trash2 aria-hidden="true" size={14} />}>{text.actions.deleteSession}</ButtonIconText>
                  </button>}
                </>}
              />
              {showStatusConfirmation && <StaffOrderDetailRow>
                <StaffOrderStatusConfirmation order={order} status={statusConfirmation.status} balance={balance} language={resolvedLanguage} disabled={saving}
                  onConfirm={async () => { await updateOrder(order, { order_status: statusConfirmation.status }); setStatusConfirmation(null) }}
                  onCancel={() => setStatusConfirmation(null)} />
              </StaffOrderDetailRow>}
              {showPayment && <StaffOrderDetailRow><div className="staff-operation-edit-panel">{orderPaymentForm(order)}</div></StaffOrderDetailRow>}
              {visitFeedback[session.id] && !isExpanded && <StaffOrderDetailRow><p role="status">{visitFeedback[session.id]}</p></StaffOrderDetailRow>}
              <StaffOrderDetailRow id={detailsId} hidden={!isExpanded}>
              {isExpanded && (
                <div className="staff-operation-edit-panel">
                  <div className="staff-operation-main">
                    <strong>{gameName}</strong>
                    <div className="staff-operation-meta">
                      <span>{sessionKindLabel(session, text)}</span>
                      <span>{session.duration_minutes} min</span>
                      <span>{text.labels.capacity}: {sessionBookedPlayers(session, order)}/{sessionCapacity(session, order)}</span>
                      <span>{text.labels.checkIns}: {sessionCheckedInCount(session)}/{Math.max(participants.length, sessionCheckedInCount(session))}</span>
                    </div>
                    <div className="staff-visit-checklist" aria-label={visitText.title}>
                      <strong>{visitText.title}</strong>
                      <span>{visitText.arrived}: {progress.arrived} / {progress.expected}</span>
                      <span>{visitText.results}: {progress.withResults} / {progress.arrived}</span>
                      <span>{visitText.payment}: {order ? paymentStatusLabel(order.payment_status, text) : text.labels.noLinkedOrder}</span>
                      {progress.missingPlayers > 0 && <span>{visitText.missing}: {progress.missingPlayers}</span>}
                    </div>
                    {order && <p>{order.customer_name || order.customer_phone || order.customer_email || text.walkIn}</p>}
                    {visitFeedback[session.id] && <p role="status">{visitFeedback[session.id]}</p>}
                  </div>
                  {order && <StaffOrderPaymentDetails order={order} language={resolvedLanguage} payments={payments} paid={paidAmount} balance={balance} />}
                  <p>{visitText.hint}</p>
                  {!order && <div className="staff-operation-edit-section">
                    <p>{visitText.noOrder}</p>
                    {operationSessionScope === 'past' && <button type="button" onClick={() => { setOperationsDate(session.date); setOperationSessionScope('today') }}>{resolvedLanguage === 'vi' ? 'Mở ngày này để liên kết đơn' : 'Open this date to link an order'}</button>}
                    <div className="staff-operation-field-grid">
                      <label>{visitText.choose}<select value={visitOrderSelection[session.id] || ''} disabled={!canCreateOrders || saving} onChange={(event) => setVisitOrderSelection((current) => ({ ...current, [session.id]: event.target.value }))}>
                        <option value="">{visitText.choose}</option>
                        {orders.filter((item) => !item.session_id && item.booking_date === session.date && !['cancelled', 'refunded', 'no_show'].includes(item.order_status)).map((item) => <option key={item.id} value={item.id}>{item.order_number} · {normalizeTime(item.booking_time)} · {item.customer_name || text.walkIn} · {formatVnd(item.total)}</option>)}
                      </select></label>
                      <button type="button" disabled={!canCreateOrders || saving || !visitOrderSelection[session.id]} onClick={() => linkVisitOrder(session)}>{visitText.link}</button>
                    </div>
                  </div>}
                  <div className="staff-operation-edit-section">
                    <strong>{text.labels.sessionFields}</strong>
                    <div className="staff-operation-field-grid">
                      <label>{text.labels.name}<input defaultValue={session.name} disabled={!canCreateOrders || saving} onBlur={(event) => updateOperationSession(session, { name: event.target.value })} /></label>
                      <label>{text.labels.date}<StaffPickerField ariaLabel={text.labels.date} placeholder={text.chooseDate} type="date" value={session.date} onChange={(value) => updateOperationSession(session, { date: value })} /></label>
                      <label>{text.labels.time}<StaffPickerField ariaLabel={text.labels.time} placeholder={text.chooseTime} type="time" value={normalizeTime(session.start_time)} onChange={(value) => updateOperationSession(session, { start_time: value })} /></label>
                      <label>{text.labels.duration}<input defaultValue={session.duration_minutes} disabled={!canCreateOrders || saving} min={20} type="number" onBlur={(event) => updateOperationSession(session, { duration_minutes: Number(event.target.value) || session.duration_minutes })} /></label>
                      <label>{text.labels.maxPlayers}<input defaultValue={session.max_players} disabled={!canCreateOrders || saving} min={1} type="number" onBlur={(event) => updateOperationSession(session, { max_players: Number(event.target.value) || session.max_players })} /></label>
                      <label>{text.labels.arena}<input defaultValue={session.arena_count ?? 1} disabled={!canCreateOrders || saving} min={1} type="number" onBlur={(event) => updateOperationSession(session, { arena_count: Number(event.target.value) || session.arena_count || 1 })} /></label>
                      <label>{text.labels.status}<select defaultValue={session.status} disabled={!canCreateOrders || saving} onChange={(event) => updateOperationSession(session, { status: event.target.value as StaffOperationSession['status'] })}><option value="open">open</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select></label>
                      <label>{text.labels.type}<select defaultValue={session.visibility} disabled={!canCreateOrders || saving} onChange={(event) => updateOperationSession(session, { visibility: event.target.value as StaffOperationSession['visibility'] })}><option value="public">{text.labels.communitySession}</option><option value="private">{text.labels.privateSession}</option></select></label>
                      <StaffGamesPlayed sessionId={session.id} language={resolvedLanguage} disabled={!canCreateOrders || saving} />
                      <label>{text.labels.game}<select defaultValue={session.confirmed_game_id || ''} disabled={!canCreateOrders || saving} onChange={(event) => updateOperationSession(session, { confirmed_game_id: event.target.value })}><option value="">{text.noneYet}</option>{games.map((game) => <option key={game.id} value={game.slug}>{brandedGameName(game.slug, game.name)}</option>)}</select></label>
                    </div>
                  </div>

                  <div className="staff-operation-edit-section">
                    <strong>{text.labels.addPlayer}</strong>
                    <div className="staff-operation-add-player">
                      <StaffOperationPlayerSearch
                        disabled={!canCreateOrders || saving}
                        onQueryChange={(value) => setOperationAddProfileQueryBySession((current) => ({ ...current, [session.id]: value }))}
                        onSelect={(profileOption) => setOperationAddProfileBySession((current) => ({ ...current, [session.id]: profileOption?.id || '' }))}
                        profiles={addableProfiles}
                        query={operationAddProfileQueryBySession[session.id] || ''}
                        selectedProfileId={operationAddProfileBySession[session.id] || ''}
                        text={text}
                      />
                      <button disabled={!canCreateOrders || saving || !operationAddProfileBySession[session.id]} type="button" onClick={() => addOperationParticipant(session)}>
                        <ButtonIconText icon={<Plus aria-hidden="true" size={14} />}>{text.labels.addPlayer}</ButtonIconText>
                      </button>
                    </div>
                  </div>

                  <div className="staff-operation-edit-section">
                    <strong>{text.labels.participantResults}</strong>
                    <div className="staff-operation-participants">
                      {participants.map((participant) => {
                        const chapterTimes = new Map((participant.chapter_times || []).map((item) => [Number(item.chapter_number), Number(item.duration_seconds)]))
                        return (
                          <div className="staff-operation-participant" key={participant.id}>
                            <div className="staff-operation-participant-head">
                              <strong>{operationParticipantName(participant, text)}</strong>
                              <button disabled={!canCreateOrders || saving} type="button" onClick={() => removeOperationParticipant(session, participant)}>
                                <ButtonIconText icon={<UserX aria-hidden="true" size={14} />}>{text.actions.removePlayer}</ButtonIconText>
                              </button>
                            </div>
                            <StaffVisitParticipantEditor
                              participant={participant} language={resolvedLanguage} disabled={!canCreateOrders || saving}
                              future={session.date > todayString()} isEscape={Boolean(isEscapeGame)}
                              onSave={(patch) => updateOperationParticipant(session, participant, patch)}
                            />
                            {isEscapeGame && (
                              <div className="staff-operation-chapters">
                                <span>{text.labels.chapterTimes}</span>
                                {Array.from({ length: chapterCount }, (_, index) => index + 1).map((chapterNumber) => (
                                  <label key={chapterNumber}>
                                    {text.labels.chapter} {chapterNumber}
                                    <input
                                      defaultValue={formatStaffDuration(chapterTimes.get(chapterNumber))}
                                      disabled={!canCreateOrders || saving}
                                      inputMode="text"
                                      placeholder="12:34"
                                      onBlur={(event) => updateOperationChapterTime(session, participant, staffGame?.slug || '', chapterNumber, event.target.value)}
                                    />
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              </StaffOrderDetailRow>
            </tbody>
          )
        })}
      </StaffOrderList>

      {unlinkedOperationOrders.length > 0 && (
        <details className="staff-operations-orders">
          <summary>{text.labels.orders}</summary>
          {orderRows(unlinkedOperationOrders)}
        </details>
      )}
    </div>
  )
}
