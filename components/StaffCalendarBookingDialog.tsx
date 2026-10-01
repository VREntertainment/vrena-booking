'use client'

import { staffBookingName } from '../lib/staffBookingName'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { StaffSavedBookingShare } from './staff/StaffSavedBookingShare'
import { Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase/client'
import { publicGameGuideCatalog } from '../lib/gameGuideCatalog'
import { staffBookingHours, validStaffBookingTime } from '../lib/staff/bookingHours'
import { staffBookingCopy } from '../lib/staff/bookingCopy'
import type { BookingForm, StaffGame, StaffOrder } from '../lib/staff/types'
import type { Session } from '../lib/bookingWidgetDomain'
import { notifyBookingUpdateEmail } from '../lib/bookingUpdateNotificationClient'

type Draft = {
  name: string; date: string; time: string; venue: BookingForm['venueKey']; game: string
  players: number; duration: number; arenas: number; arenaId: string; status: string; notes: string; source: string; allowOutsideHours: boolean
}
const copy = {
  en: { title: 'Edit booking', shop: 'Shop', name: 'Booking name', date: 'Date', time: 'Time', game: 'Game', players: 'Players', duration: 'Duration (minutes)', arenas: 'Arenas', arena: 'Arena', status: 'Status', notes: 'Internal note', save: 'Save changes', close: 'Close', remove: 'Delete booking', confirm: 'Confirm deletion', keep: 'Keep booking', loading: 'Loading booking…', outsideHours: 'Reserve outside opening hours', reason: 'Reason for price change', paid: 'Recorded payments', due: 'Remaining to pay', invalidTime: 'Choose a time that ends on the same day and is within opening hours, or allow an outside-hours reservation.', savedPrice: 'Recorded payments stay unchanged. Enter a reason when changing the agreed total.', deleteHelp: 'This removes only this booking from the calendar and cancels its linked order. Recorded payments are retained; refunds are handled separately.', unspecified: 'Unspecified', open: 'Confirmed / open', completed: 'Completed', cancelled: 'Cancelled', total: 'Agreed total', conflict: 'This booking has changed. Close and reopen it before saving.' },
  vi: { title: 'Sửa đặt chỗ', shop: 'Cửa hàng', name: 'Tên đặt chỗ', date: 'Ngày', time: 'Giờ', game: 'Trò chơi', players: 'Số người', duration: 'Thời lượng (phút)', arenas: 'Số arena', arena: 'Arena', status: 'Trạng thái', notes: 'Ghi chú nội bộ', save: 'Lưu thay đổi', close: 'Đóng', remove: 'Xóa đặt chỗ', confirm: 'Xác nhận xóa', keep: 'Giữ đặt chỗ', loading: 'Đang tải đặt chỗ…', outsideHours: 'Đặt chỗ ngoài giờ mở cửa', reason: 'Lý do thay đổi giá', paid: 'Đã thanh toán', due: 'Còn phải thanh toán', invalidTime: 'Chọn giờ kết thúc trong cùng ngày và trong giờ mở cửa, hoặc cho phép đặt ngoài giờ.', savedPrice: 'Giữ nguyên các khoản đã thanh toán. Nhập lý do khi thay đổi tổng tiền đã thỏa thuận.', deleteHelp: 'Chỉ xóa lượt đặt chỗ này khỏi lịch và hủy đơn liên kết. Các khoản đã thanh toán vẫn được giữ; hoàn tiền được xử lý riêng.', unspecified: 'Chưa xác định', open: 'Đã xác nhận / mở', completed: 'Hoàn tất', cancelled: 'Đã hủy', total: 'Tổng tiền đã thỏa thuận', conflict: 'Đặt chỗ đã thay đổi. Đóng và mở lại trước khi lưu.' },
}

export default function StaffCalendarBookingDialog({ sessionId, language, onClose, onSaved }: {
  sessionId: string; language: 'en' | 'vi'; onClose: () => void; onSaved: (date: string, deleted: boolean, venue: BookingForm['venueKey']) => void
}) {
  const text = copy[language]
  const bookingText = staffBookingCopy[language]
  const dialog = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [version, setVersion] = useState('')
  const [persisted, setPersisted] = useState<{ name: string; venue: string; date: string; time: string } | null>(null)
  const [games, setGames] = useState<StaffGame[]>([])
  const [orders, setOrders] = useState<Array<StaffOrder & { booking_source?: string | null }>>([])
  const [prices, setPrices] = useState<Record<string, { total: string; reason: string; paid: number }>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const previousFocus = document.activeElement
    dialog.current?.showModal()
    const controller = new AbortController()
    void (async () => {
      try {
        const [booking, linked, catalog] = await Promise.all([
          supabase.from('sessions').select('*').eq('id', sessionId).is('deleted_at', null).abortSignal(controller.signal).single(),
          supabase.from('staff_orders').select('*').eq('session_id', sessionId).abortSignal(controller.signal),
          supabase.from('staff_games').select('*').eq('active', true).order('name').abortSignal(controller.signal),
        ])
        if (controller.signal.aborted) return
        const failure = booking.error || linked.error || catalog.error
        if (failure) throw new Error(failure.message)
        const linkedOrders = linked.data || []
        const payments = linkedOrders.length ? await supabase.from('staff_order_payments').select('order_id,amount').in('order_id', linkedOrders.map((item) => item.id)).abortSignal(controller.signal) : { data: [], error: null }
        if (controller.signal.aborted) return
        if (payments.error) throw new Error(payments.error.message)
        setPrices(Object.fromEntries(linkedOrders.map((item) => [item.id, { total: String(item.total), reason: '', paid: (payments.data || []).filter((payment) => payment.order_id === item.id).reduce((sum, payment) => sum + payment.amount, 0) }])))
        const record = booking.data!
        setSession(record as Session)
        const order = linked.data?.[0]
        const activeGames = (catalog.data || []) as StaffGame[]
        setGames(activeGames)
        setOrders(linked.data || [])
        setVersion(record.updated_at)
        setPersisted({ name: staffBookingName(record.name, activeGames.map((item) => item.name)), venue: record.venue_key || 'ha-do-centrosa', date: record.date, time: record.start_time.slice(0, 5) })
        setDraft({ name: staffBookingName(record.name, activeGames.map((item) => item.name)), date: record.date, time: record.start_time.slice(0, 5), venue: record.venue_key || 'ha-do-centrosa',
          game: record.confirmed_game_id || record.game_options?.[0] || '', players: record.ticket_player_count || record.max_players,
          duration: record.duration_minutes, arenas: record.arena_count ?? 1, arenaId: order?.arena_id || '', status: record.status,
          notes: record.notes || '', source: order?.booking_source || '',
          allowOutsideHours: !validStaffBookingTime(record.venue_key || 'ha-do-centrosa', record.duration_minutes, record.start_time.slice(0, 5)),
        })
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
      }
    })()
    return () => { controller.abort(); if (previousFocus instanceof HTMLElement) previousFocus.focus() }
  }, [sessionId])

  const availableGames = games.filter((game) => (publicGameGuideCatalog.find((item) => item.id === game.slug)?.venues || ['ha-do-centrosa']).includes(draft?.venue || 'ha-do-centrosa'))
  const game = availableGames.find((item) => item.slug === draft?.game)
  const isSimRacing = session?.confirmed_game_id === 'sim-racing'
  const arenas = isSimRacing ? ['sim-racing-1'] : draft?.venue === 'cafe-des-stagiaires' ? ['cafe:arena-1'] : (game?.available_arena_ids?.length ? game.available_arena_ids : ['arena-1', 'arena-2'])
  const patch = (value: Partial<Draft>) => setDraft((current) => current ? { ...current, ...value } : current)

  async function mutate(deleted: boolean) {
    if (!draft || !session || busy.current) return
    if (!deleted && !validStaffBookingTime(draft.venue, draft.duration, draft.time, draft.allowOutsideHours)) { setError(text.invalidTime); return }
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const result = deleted
        ? await supabase.rpc('staff_delete_session_operation', { p_session_id: session.id, p_delete_reason: 'Deleted from shared booking calendar' })
        : await supabase.rpc(isSimRacing ? 'staff_update_sim_racing_booking' : 'staff_update_calendar_booking', { p_session_id: session.id, p_booking: {
          expected_updated_at: version, name: draft.name.trim(), date: draft.date, start_time: draft.time,
          venue_key: draft.venue, game_slug: draft.game, players: draft.players, duration_minutes: draft.duration,
          arena_count: draft.arenas, arena_id: draft.arenaId || arenas[0], status: draft.status, notes: draft.notes,
          booking_source: draft.source || null, allow_outside_hours: draft.allowOutsideHours,
          order_adjustments: orders.filter((order) => prices[order.id] && Number(prices[order.id].total) !== order.total).map((order) => ({ order_id: order.id, total: Number(prices[order.id].total), reason: prices[order.id].reason.trim(), expected_updated_at: order.updated_at })),
        } })
      if (result.error) throw new Error(result.error.message)
      void notifyBookingUpdateEmail(supabase, {
        action: deleted ? 'deleted' : draft.status === 'cancelled' ? 'cancelled' : 'edited',
        bookingKind: session.booking_type === 'ticket' ? 'ticket' : 'session', sessionId: session.id,
        orderId: orders[0]?.id || null, title: draft.name, date: draft.date, time: draft.time,
        total: orders[0] ? Number(prices[orders[0].id]?.total ?? orders[0].total) : session.ticket_total_price ?? null, source: 'Shared booking calendar',
        summary: deleted ? 'Booking deleted from the shared calendar.' : 'Existing booking updated from the shared calendar. Recorded payments are unchanged.',
      }).catch(() => {})
      onSaved(deleted ? session.date : draft.date, deleted, draft.venue)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally { busy.current = false; setSaving(false) }
  }

  function submit(event: FormEvent) { event.preventDefault(); void mutate(false) }

  return <dialog ref={dialog} className="calendar-booking-dialog" aria-labelledby="calendar-edit-title" onCancel={(event) => { event.preventDefault(); if (!busy.current) onClose() }}>
    <div className="calendar-dialog-heading"><h2 id="calendar-edit-title">{confirmDelete ? text.remove : text.title}</h2><button aria-label={text.close} className="calendar-dialog-close" disabled={saving} onClick={onClose} type="button"><X size={20} /></button></div>
    {error && <p role="alert" className="notice">{error}</p>}
    {!draft && !error && <p>{text.loading}</p>}
    {draft && (confirmDelete ? <div className="calendar-delete-confirm">
      <strong>{persisted?.name || draft.name}</strong><p>{(persisted?.venue || draft.venue) === 'ha-do-centrosa' ? 'VRena Hà Đô Centrosa' : 'Vrena Thao Dien'} · {persisted?.date || draft.date} · {persisted?.time || draft.time}</p>
      <p>{text.deleteHelp}</p><div className="action-row"><button className="danger" disabled={saving} onClick={() => void mutate(true)} type="button">{text.confirm}</button><button className="secondary" disabled={saving} onClick={() => setConfirmDelete(false)} type="button">{text.keep}</button></div>
    </div> : <form onSubmit={submit}>
      <fieldset disabled={saving} className="calendar-edit-fields">
        <label className="full">{text.name}<input disabled={isSimRacing} required maxLength={120} value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
        <label>{text.shop}<select disabled={isSimRacing} value={draft.venue} onChange={(event) => {
          const venue = event.target.value as Draft['venue']
          const choices = games.filter((item) => (publicGameGuideCatalog.find((guide) => guide.id === item.slug)?.venues || ['ha-do-centrosa']).includes(venue))
          const nextGame = choices.find((item) => item.slug === draft.game) || choices[0]
          patch({ venue, game: nextGame?.slug || '', duration: nextGame?.slug === draft.game ? draft.duration : nextGame?.duration_minutes || draft.duration, arenaId: venue === 'cafe-des-stagiaires' ? 'cafe:arena-1' : nextGame?.available_arena_ids?.[0] || 'arena-1', arenas: 1, time: !draft.allowOutsideHours && venue === 'cafe-des-stagiaires' && draft.time < '15:30' ? '15:30' : draft.time })
        }}><option value="ha-do-centrosa">VRena Hà Đô Centrosa</option><option value="cafe-des-stagiaires">Vrena Thao Dien</option></select></label>
        <label>{bookingText.bookingSource}<select value={draft.source} disabled={isSimRacing || !orders.length} onChange={(event) => patch({ source: event.target.value })}><option value="">{text.unspecified}</option>{Object.entries(bookingText.sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{text.date}<input required type="date" value={draft.date} onChange={(event) => patch({ date: event.target.value })} /></label>
        <label>{text.time}<input required type="time" min={draft.allowOutsideHours ? '00:00' : staffBookingHours(draft.venue, draft.duration).min} max={draft.allowOutsideHours ? '23:59' : staffBookingHours(draft.venue, draft.duration).max} value={draft.time} onChange={(event) => patch({ time: event.target.value })} /></label>
        <label className="full calendar-outside-hours"><input type="checkbox" checked={draft.allowOutsideHours} onChange={(event) => patch({ allowOutsideHours: event.target.checked })} /><span>{text.outsideHours}</span></label>
        <label>{text.game}<select disabled={isSimRacing} required value={draft.game} onChange={(event) => patch({ game: event.target.value, arenaId: '' })}>{!game && <option value={draft.game}>{isSimRacing ? 'SIM Racing' : draft.game || text.unspecified}</option>}{availableGames.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
        <label>{text.players}<input disabled={isSimRacing} required min={1} max={64} type="number" value={draft.players} onChange={(event) => patch({ players: Number(event.target.value) })} /></label>
        <label>{text.duration}<input disabled={isSimRacing} required min={isSimRacing ? 15 : 20} max={240} type="number" value={draft.duration} onChange={(event) => patch({ duration: Number(event.target.value) })} /></label>
        <label>{text.arenas}<select disabled={isSimRacing} value={draft.arenas} onChange={(event) => patch({ arenas: Number(event.target.value) })}>{isSimRacing && <option value={0}>SIM Racing</option>}<option value={1}>1</option>{draft.venue === 'ha-do-centrosa' && <option value={2}>2</option>}</select></label>
        <label>{text.arena}<select disabled={isSimRacing} value={draft.arenaId || arenas[0]} onChange={(event) => patch({ arenaId: event.target.value })}>{arenas.map((id, index) => <option value={id} key={id}>{isSimRacing ? 'SIM Racing' : `${text.arena} ${index + 1}`}</option>)}</select></label>
        <label>{text.status}<select value={draft.status} onChange={(event) => patch({ status: event.target.value })}><option value="open">{text.open}</option><option value="completed">{text.completed}</option><option value="cancelled">{text.cancelled}</option></select></label>
        <label className="full">{text.notes}<textarea value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
        {orders.map((order) => {
          const price = prices[order.id]
          if (!price) return null
          const canReprice = !['cancelled', 'refunded', 'no_show', 'completed'].includes(order.order_status) && order.payment_status !== 'refunded'
          return <div key={order.id} className="full calendar-order-price">
            <p>{order.order_number} · {order.customer_name || 'Guest'}</p>
            <label>{text.total} (VND)<input required disabled={!canReprice} type="number" inputMode="numeric" min={price.paid} max={2147483647} step={1} value={price.total} onChange={(event) => setPrices((current) => ({ ...current, [order.id]: { ...current[order.id], total: event.target.value } }))} /></label>
            <p className="field-help">{text.paid}: {price.paid.toLocaleString('vi-VN')} đ · {text.due}: {Math.max(0, Number(price.total) - price.paid).toLocaleString('vi-VN')} đ</p>
            {Number(price.total) !== order.total && <label>{text.reason}<input required maxLength={1000} value={price.reason} onChange={(event) => setPrices((current) => ({ ...current, [order.id]: { ...current[order.id], reason: event.target.value } }))} /></label>}
          </div>
        })}
      </fieldset>
      <p className="field-help">{text.savedPrice}</p>
      <div className="calendar-dialog-actions"><StaffSavedBookingShare sessionId={sessionId} language={language} disabled={saving || session?.status === 'cancelled'} /><button className="calendar-delete-action" disabled={saving} type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />{text.remove}</button><button className="secondary" disabled={saving} onClick={onClose} type="button">{text.close}</button><button className="primary" disabled={saving || (!game && !isSimRacing)} type="submit">{text.save}</button></div>
    </form>)}
  </dialog>
}
