'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase/client'
import { publicGameGuideCatalog } from '../lib/gameGuideCatalog'
import { staffBookingCopy } from '../lib/staff/bookingCopy'
import type { BookingForm, StaffGame, StaffOrder } from '../lib/staff/types'
import type { Session } from '../lib/bookingWidgetDomain'
import { notifyBookingUpdateEmail } from '../lib/bookingUpdateNotificationClient'

type Draft = {
  name: string; date: string; time: string; venue: BookingForm['venueKey']; game: string
  players: number; duration: number; arenas: number; arenaId: string; status: string; notes: string; source: string
}
const copy = {
  en: { title: 'Edit booking', shop: 'Shop', name: 'Booking name', date: 'Date', time: 'Time', game: 'Game', players: 'Players', duration: 'Duration (minutes)', arenas: 'Arenas', arena: 'Arena', status: 'Status', notes: 'Internal note', save: 'Save changes', close: 'Close', remove: 'Delete booking', confirm: 'Confirm deletion', keep: 'Keep booking', loading: 'Loading booking…', savedPrice: 'The agreed price and recorded payments stay unchanged. Review the order if the change requires a different price.', deleteHelp: 'This removes only this booking from the calendar and cancels its linked order. Recorded payments are retained; refunds are handled separately.', unspecified: 'Unspecified', open: 'Confirmed / open', completed: 'Completed', cancelled: 'Cancelled', total: 'Agreed total', conflict: 'This booking has changed. Close and reopen it before saving.' },
  vi: { title: 'Sửa đặt chỗ', shop: 'Cửa hàng', name: 'Tên đặt chỗ', date: 'Ngày', time: 'Giờ', game: 'Trò chơi', players: 'Số người', duration: 'Thời lượng (phút)', arenas: 'Số arena', arena: 'Arena', status: 'Trạng thái', notes: 'Ghi chú nội bộ', save: 'Lưu thay đổi', close: 'Đóng', remove: 'Xóa đặt chỗ', confirm: 'Xác nhận xóa', keep: 'Giữ đặt chỗ', loading: 'Đang tải đặt chỗ…', savedPrice: 'Giữ nguyên giá đã thỏa thuận và các khoản đã thanh toán. Kiểm tra đơn hàng nếu thay đổi cần điều chỉnh giá.', deleteHelp: 'Chỉ xóa lượt đặt chỗ này khỏi lịch và hủy đơn liên kết. Các khoản đã thanh toán vẫn được giữ; hoàn tiền được xử lý riêng.', unspecified: 'Chưa xác định', open: 'Đã xác nhận / mở', completed: 'Hoàn tất', cancelled: 'Đã hủy', total: 'Tổng tiền đã thỏa thuận', conflict: 'Đặt chỗ đã thay đổi. Đóng và mở lại trước khi lưu.' },
}

export default function StaffCalendarBookingDialog({ session, language, onClose, onSaved }: {
  session: Session; language: 'en' | 'vi'; onClose: () => void; onSaved: (date: string, deleted: boolean, venue: BookingForm['venueKey']) => void
}) {
  const text = copy[language]
  const bookingText = staffBookingCopy[language]
  const dialog = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [version, setVersion] = useState('')
  const [persisted, setPersisted] = useState<{ name: string; venue: string; date: string; time: string } | null>(null)
  const [games, setGames] = useState<StaffGame[]>([])
  const [orders, setOrders] = useState<Array<StaffOrder & { booking_source?: string | null }>>([])
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
          supabase.from('sessions').select('*').eq('id', session.id).is('deleted_at', null).abortSignal(controller.signal).single(),
          supabase.from('staff_orders').select('*').eq('session_id', session.id).abortSignal(controller.signal),
          supabase.from('staff_games').select('*').eq('active', true).order('name').abortSignal(controller.signal),
        ])
        if (controller.signal.aborted) return
        const failure = booking.error || linked.error || catalog.error
        if (failure) throw new Error(failure.message)
        const record = booking.data!
        const order = linked.data?.[0]
        const activeGames = (catalog.data || []) as StaffGame[]
        setGames(activeGames)
        setOrders(linked.data || [])
        setVersion(record.updated_at)
        setPersisted({ name: record.name, venue: record.venue_key || 'ha-do-centrosa', date: record.date, time: record.start_time.slice(0, 5) })
        setDraft({ name: record.name, date: record.date, time: record.start_time.slice(0, 5), venue: record.venue_key || 'ha-do-centrosa',
          game: record.confirmed_game_id || record.game_options?.[0] || '', players: record.ticket_player_count || record.max_players,
          duration: record.duration_minutes, arenas: record.arena_count || 1, arenaId: order?.arena_id || '', status: record.status,
          notes: record.notes || '', source: order?.booking_source || '',
        })
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
      }
    })()
    return () => { controller.abort(); if (previousFocus instanceof HTMLElement) previousFocus.focus() }
  }, [session.id])

  const availableGames = games.filter((game) => (publicGameGuideCatalog.find((item) => item.id === game.slug)?.venues || ['ha-do-centrosa']).includes(draft?.venue || 'ha-do-centrosa'))
  const game = availableGames.find((item) => item.slug === draft?.game)
  const arenas = draft?.venue === 'cafe-des-stagiaires' ? ['cafe:arena-1'] : (game?.available_arena_ids?.length ? game.available_arena_ids : ['arena-1', 'arena-2'])
  const patch = (value: Partial<Draft>) => setDraft((current) => current ? { ...current, ...value } : current)

  async function mutate(deleted: boolean) {
    if (!draft || busy.current) return
    busy.current = true
    setSaving(true)
    setError('')
    try {
      const result = deleted
        ? await supabase.rpc('staff_delete_session_operation', { p_session_id: session.id, p_delete_reason: 'Deleted from shared booking calendar' })
        : await supabase.rpc('staff_update_calendar_booking', { p_session_id: session.id, p_booking: {
          expected_updated_at: version, name: draft.name.trim(), date: draft.date, start_time: draft.time,
          venue_key: draft.venue, game_slug: draft.game, players: draft.players, duration_minutes: draft.duration,
          arena_count: draft.arenas, arena_id: draft.arenaId || arenas[0], status: draft.status, notes: draft.notes,
          booking_source: draft.source || null,
        } })
      if (result.error) throw new Error(result.error.message)
      void notifyBookingUpdateEmail(supabase, {
        action: deleted ? 'deleted' : draft.status === 'cancelled' ? 'cancelled' : 'edited',
        bookingKind: session.booking_type === 'ticket' ? 'ticket' : 'session', sessionId: session.id,
        orderId: orders[0]?.id || null, title: draft.name, date: draft.date, time: draft.time,
        total: orders[0]?.total ?? session.ticket_total_price ?? null, source: 'Shared booking calendar',
        summary: deleted ? 'Booking deleted from the shared calendar.' : 'Existing booking updated from the shared calendar. Agreed price and recorded payments are unchanged.',
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
      <strong>{persisted?.name || draft.name}</strong><p>{(persisted?.venue || draft.venue) === 'ha-do-centrosa' ? 'VRena Hà Đô Centrosa' : 'VRena Café des Stagiaires'} · {persisted?.date || draft.date} · {persisted?.time || draft.time}</p>
      <p>{text.deleteHelp}</p><div className="action-row"><button className="danger" disabled={saving} onClick={() => void mutate(true)} type="button">{text.confirm}</button><button className="secondary" disabled={saving} onClick={() => setConfirmDelete(false)} type="button">{text.keep}</button></div>
    </div> : <form onSubmit={submit}>
      <fieldset disabled={saving} className="calendar-edit-fields">
        <label className="full">{text.name}<input required maxLength={120} value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
        <label>{text.shop}<select value={draft.venue} onChange={(event) => {
          const venue = event.target.value as Draft['venue']
          const firstGame = games.find((item) => (publicGameGuideCatalog.find((guide) => guide.id === item.slug)?.venues || ['ha-do-centrosa']).includes(venue))
          patch({ venue, game: firstGame?.slug || '', arenaId: venue === 'cafe-des-stagiaires' ? 'cafe:arena-1' : 'arena-1', arenas: 1, time: venue === 'cafe-des-stagiaires' && draft.time < '16:00' ? '16:00' : draft.time })
        }}><option value="ha-do-centrosa">VRena Hà Đô Centrosa</option><option value="cafe-des-stagiaires">VRena Café des Stagiaires</option></select></label>
        <label>{bookingText.bookingSource}<select value={draft.source} disabled={!orders.length} onChange={(event) => patch({ source: event.target.value })}><option value="">{text.unspecified}</option>{Object.entries(bookingText.sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{text.date}<input required type="date" value={draft.date} onChange={(event) => patch({ date: event.target.value })} /></label>
        <label>{text.time}<input required type="time" value={draft.time} onChange={(event) => patch({ time: event.target.value })} /></label>
        <label>{text.game}<select required value={draft.game} onChange={(event) => patch({ game: event.target.value, arenaId: '' })}>{!game && <option value={draft.game}>{draft.game || text.unspecified}</option>}{availableGames.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
        <label>{text.players}<input required min={1} max={64} type="number" value={draft.players} onChange={(event) => patch({ players: Number(event.target.value) })} /></label>
        <label>{text.duration}<input required min={20} max={240} type="number" value={draft.duration} onChange={(event) => patch({ duration: Number(event.target.value) })} /></label>
        <label>{text.arenas}<select value={draft.arenas} onChange={(event) => patch({ arenas: Number(event.target.value) })}><option value={1}>1</option>{draft.venue === 'ha-do-centrosa' && <option value={2}>2</option>}</select></label>
        <label>{text.arena}<select value={draft.arenaId || arenas[0]} onChange={(event) => patch({ arenaId: event.target.value })}>{arenas.map((id, index) => <option value={id} key={id}>{text.arena} {index + 1}</option>)}</select></label>
        <label>{text.status}<select value={draft.status} onChange={(event) => patch({ status: event.target.value })}><option value="open">{text.open}</option><option value="completed">{text.completed}</option><option value="cancelled">{text.cancelled}</option></select></label>
        <label className="full">{text.notes}<textarea value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
      </fieldset>
      {orders.map((order) => <p key={order.id}>{order.order_number} · {order.customer_name || 'Guest'} · {text.total}: {order.total.toLocaleString('vi-VN')} đ</p>)}
      <p className="field-help">{text.savedPrice}</p>
      <div className="calendar-dialog-actions"><button className="calendar-delete-action" disabled={saving} type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />{text.remove}</button><button className="secondary" disabled={saving} onClick={onClose} type="button">{text.close}</button><button disabled={saving || !game} type="submit">{text.save}</button></div>
    </form>)}
  </dialog>
}
