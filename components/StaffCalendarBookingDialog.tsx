'use client'

import { useStaffLocations } from '../hooks/useStaffLocations'

import StaffGamesPlayed, { type PlayedGamesDraft } from './staff/StaffGamesPlayed'

import { staffBookingName } from '../lib/staffBookingName'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { StaffSavedBookingShare } from './staff/StaffSavedBookingShare'
import { Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase/client'
import { bookingCategory, bookingCategoryCopy, gameAvailableAtVenue, selectedBookingGames, type BookingCategory } from '../lib/bookingMetadata'
import { staffBookingHours, validStaffBookingTime } from '../lib/staff/bookingHours'
import { staffBookingCopy } from '../lib/staff/bookingCopy'
import type { BookingForm, StaffGame, StaffOrder } from '../lib/staff/types'
import type { Session } from '../lib/bookingWidgetDomain'
import { notifyBookingUpdateEmail } from '../lib/bookingUpdateNotificationClient'

type Draft = {
  category: BookingCategory; name: string; date: string; time: string; venue: BookingForm['venueKey']; game: string
  players: number; duration: number; arenaIds: string[]; notes: string; source: string; clientConfirmed: boolean; allowOutsideHours: boolean
}
type BookingClient = { name: string | null; email: string | null; phone: string | null; loyalty_points: number | null }

const contactFields = ['name', 'email', 'phone'] as const
type ContactDetails = Pick<BookingClient, typeof contactFields[number]>

const bookingTime = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh', hourCycle: 'h23',
})

function venueArenas(venue: Draft['venue']) {
  return venue === 'cafe-des-stagiaires' ? ['cafe:arena-1'] : ['arena-1', 'arena-2']
}

const copy = {
  en: { client: 'Client details', editClient: 'Edit client details', clientName: 'Name', email: 'Email', phone: 'Phone', points: 'Loyalty points', gamesPlayed: 'Record games played', invalidPrice: 'Enter a whole VND amount at least equal to recorded payments.', reservedBy: 'Reserved by', notRecorded: 'Not recorded', clientConfirmed: 'Confirmed with client', title: 'Edit booking', shop: 'Shop', name: 'Booking name', date: 'Date', time: 'Time', game: 'Game', players: 'Players', duration: 'Duration (minutes)', arenas: 'Arenas', arena: 'Arena', status: 'Status', notes: 'Internal note', save: 'Save changes', close: 'Close', remove: 'Delete booking', confirm: 'Confirm deletion', keep: 'Keep booking', loading: 'Loading booking…', outsideHours: 'Reserve outside opening hours', reason: 'Reason for price change', paid: 'Recorded payments', due: 'Remaining to pay', invalidTime: 'Choose a time that ends on the same day and is within opening hours, or allow an outside-hours reservation.', savedPrice: 'Recorded payments stay unchanged. Enter a reason when changing the agreed total.', deleteHelp: 'This removes only this booking from the calendar and cancels its linked order. Recorded payments are retained; refunds are handled separately.', unspecified: 'Unspecified', open: 'Confirmed / open', completed: 'Completed', cancelled: 'Cancelled', total: 'Agreed total', conflict: 'This booking has changed. Close and reopen it before saving.' },
  vi: { client: 'Thông tin khách hàng', editClient: 'Sửa thông tin khách hàng', clientName: 'Tên', email: 'Email', phone: 'Điện thoại', points: 'Điểm thưởng', gamesPlayed: 'Ghi nhận trò chơi đã chơi', invalidPrice: 'Nhập số tiền VND nguyên không thấp hơn số tiền đã thanh toán.', reservedBy: 'Người tạo đặt chỗ', notRecorded: 'Chưa ghi nhận', clientConfirmed: 'Đã xác nhận với khách', title: 'Sửa đặt chỗ', shop: 'Cửa hàng', name: 'Tên đặt chỗ', date: 'Ngày', time: 'Giờ', game: 'Trò chơi', players: 'Số người', duration: 'Thời lượng (phút)', arenas: 'Số arena', arena: 'Arena', status: 'Trạng thái', notes: 'Ghi chú nội bộ', save: 'Lưu thay đổi', close: 'Đóng', remove: 'Xóa đặt chỗ', confirm: 'Xác nhận xóa', keep: 'Giữ đặt chỗ', loading: 'Đang tải đặt chỗ…', outsideHours: 'Đặt chỗ ngoài giờ mở cửa', reason: 'Lý do thay đổi giá', paid: 'Đã thanh toán', due: 'Còn phải thanh toán', invalidTime: 'Chọn giờ kết thúc trong cùng ngày và trong giờ mở cửa, hoặc cho phép đặt ngoài giờ.', savedPrice: 'Giữ nguyên các khoản đã thanh toán. Nhập lý do khi thay đổi tổng tiền đã thỏa thuận.', deleteHelp: 'Chỉ xóa lượt đặt chỗ này khỏi lịch và hủy đơn liên kết. Các khoản đã thanh toán vẫn được giữ; hoàn tiền được xử lý riêng.', unspecified: 'Chưa xác định', open: 'Đã xác nhận / mở', completed: 'Hoàn tất', cancelled: 'Đã hủy', total: 'Tổng tiền đã thỏa thuận', conflict: 'Đặt chỗ đã thay đổi. Đóng và mở lại trước khi lưu.' },
}

export default function StaffCalendarBookingDialog({ sessionId, language, onClose, onSaved }: {
  sessionId: string; language: 'en' | 'vi'; onClose: () => void; onSaved: (date: string, deleted: boolean, venue: BookingForm['venueKey']) => void
}) {
  const text = copy[language]
  const bookingText = staffBookingCopy[language]
  const dialog = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const gamesPlayedDraft = useRef<PlayedGamesDraft | null>(null)
  const originalDraft = useRef<Draft | null>(null)
  const { locations } = useStaffLocations()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [creator, setCreator] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [client, setClient] = useState<BookingClient | null>(null)
  const [contactDraft, setContactDraft] = useState<ContactDetails | null>(null)
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
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
          supabase.rpc('staff_get_booking_details', { p_session_id: sessionId }).abortSignal(controller.signal),
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
        setCreator(record.booking_creator_name || null)
        setCreatedAt(record.created_at ?? null)
        setClient(record.booking_client ?? null)
        setContactDraft(null)
        setSession(record as Session)
        const order = linked.data?.[0]
        const venue = record.venue_key || 'ha-do-centrosa'
        const arenaChoices = venueArenas(venue)
        const savedArenas = Array.isArray(record.booking_arena_ids)
          ? arenaChoices.filter((id) => record.booking_arena_ids.includes(id))
          : []
        const arenaIds = record.arena_count === 0 ? []
          : savedArenas.length ? savedArenas
          : record.arena_count === 2 ? arenaChoices
          : [order?.arena_id && arenaChoices.includes(order.arena_id) ? order.arena_id : arenaChoices[0]]
        const activeGames = (catalog.data || []) as StaffGame[]
        setGames(activeGames)
        setOrders(linked.data || [])
        setVersion(record.updated_at)
        setPersisted({ name: staffBookingName(record.name, activeGames.map((item) => item.name)), venue: record.venue_key || 'ha-do-centrosa', date: record.date, time: record.start_time.slice(0, 5) })
        const initialDraft: Draft = { category: bookingCategory(record), name: staffBookingName(record.name, activeGames.map((item) => item.name)), date: record.date, time: record.start_time.slice(0, 5), venue: record.venue_key || 'ha-do-centrosa',
          game: selectedBookingGames(record)[0] || '', players: record.ticket_player_count || record.max_players,
          duration: record.duration_minutes, arenaIds,
          clientConfirmed: record.client_confirmed === true, notes: record.notes || '', source: record.booking_source ?? order?.booking_source ?? '',
          allowOutsideHours: !validStaffBookingTime(record.venue_key || 'ha-do-centrosa', record.duration_minutes, record.start_time.slice(0, 5)),
        }
        originalDraft.current = initialDraft
        setDraft(initialDraft)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
      }
    })()
    return () => { controller.abort(); if (previousFocus instanceof HTMLElement) previousFocus.focus() }
  }, [sessionId])

  const availableGames = games.filter((game) => gameAvailableAtVenue(game.slug, draft?.venue || 'ha-do-centrosa'))
  const game = availableGames.find((item) => item.slug === draft?.game)
  const isSimRacing = session?.confirmed_game_id === 'sim-racing'
  const isFreeTrial = session?.booking_category === 'free_trial'
  const arenas = venueArenas(draft?.venue || 'ha-do-centrosa')
  const selectedCompatibleArenas = draft?.arenaIds.filter((id) => !game?.available_arena_ids?.length || game.available_arena_ids.includes(id)) || []
  const originalPrimaryArena = orders[0]?.arena_id
  const primaryArena = originalPrimaryArena && selectedCompatibleArenas.includes(originalPrimaryArena)
    ? originalPrimaryArena : selectedCompatibleArenas[0] || draft?.arenaIds[0]
  const patch = (value: Partial<Draft>) => setDraft((current) => current ? { ...current, ...value } : current)

  async function mutate(deleted: boolean, form?: HTMLFormElement) {
    if (!draft || !session || busy.current) return
    const played = deleted ? null : gamesPlayedDraft.current
    if (played && (played.blocked || draft.venue !== session.venue_key)) {
      setError(language === 'vi' ? 'Kiểm tra các trò chơi đã chọn trước khi lưu.' : 'Review the selected games before saving.')
      return
    }
    const changedContact = contactDraft ? Object.fromEntries(contactFields.flatMap((field) => {
      const value = contactDraft[field]?.trim() || null
      return value === (client?.[field] ?? null) ? [] : [[field, value]]
    })) : {}
    const orderAdjustments = orders.filter((order) => prices[order.id] && Number(prices[order.id].total) !== order.total)
    const gamesOnly = played && JSON.stringify(draft) === JSON.stringify(originalDraft.current)
      && !Object.keys(changedContact).length && !orderAdjustments.length
    if (!deleted && !gamesOnly) {
      if (form && !form.reportValidity()) return
      if (!validStaffBookingTime(draft.venue, draft.duration, draft.time, draft.allowOutsideHours)) { setError(text.invalidTime); return }
      if (orderAdjustments.some((order) => {
        const price = prices[order.id]
        return !price.total || Number(price.total) < price.paid || Number(price.total) > 2147483647
      })) {
        setError(text.invalidPrice)
        return
      }
    }
    busy.current = true
    setSaving(true)
    setError('')
    try {
      if (gamesOnly) {
        const result = await supabase.rpc('staff_confirm_games_played', {
          p_session_id: sessionId, p_game_ids: played.gameIds, p_expected_updated_at: played.expectedUpdatedAt,
        })
        if (result.error) throw new Error(result.error.message)
        onSaved(draft.date, false, draft.venue)
        return
      }
      const result = deleted
        ? await supabase.rpc('staff_delete_session_operation', { p_session_id: session.id, p_delete_reason: 'Deleted from shared booking calendar' })
        : await supabase.rpc(isSimRacing ? 'staff_update_sim_racing_booking' : 'staff_update_booking_details', { p_session_id: session.id, p_booking: {
          ...(Object.keys(changedContact).length ? { booking_client_contact: changedContact } : {}),
          ...(played ? { games_played: { game_ids: played.gameIds, expected_updated_at: played.expectedUpdatedAt } } : {}),
          expected_updated_at: version, name: draft.name.trim(), date: draft.date, start_time: draft.time,
          venue_key: draft.venue, game_slug: draft.game, players: draft.players, duration_minutes: draft.duration,
          arena_count: draft.arenaIds.length, arena_id: isSimRacing ? 'sim-racing-1' : primaryArena, status: session.status, notes: draft.notes,
          booking_category: draft.category === 'free_trial' ? undefined : draft.category, game_changed: draft.game !== (selectedBookingGames(session)[0] || ''),
          client_confirmed: draft.clientConfirmed, booking_source: draft.source || null, allow_outside_hours: draft.allowOutsideHours,
          order_adjustments: orderAdjustments.map((order) => ({ order_id: order.id, total: Number(prices[order.id].total), reason: prices[order.id].reason.trim(), expected_updated_at: order.updated_at })),
        } })
      if (result.error) throw new Error(result.error.message)
      void notifyBookingUpdateEmail(supabase, {
        action: deleted ? 'deleted' : 'edited',
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

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void mutate(false, event.currentTarget) }

  return <dialog ref={dialog} className="calendar-booking-dialog" aria-labelledby="calendar-edit-title" onCancel={(event) => { event.preventDefault(); if (!busy.current) onClose() }}>
    <div className="calendar-dialog-heading"><h2 id="calendar-edit-title">{confirmDelete ? text.remove : text.title}</h2><button aria-label={text.close} className="calendar-dialog-close" disabled={saving} onClick={onClose} type="button"><X size={20} /></button></div>
    {error && <p role="alert" className="notice">{error}</p>}
    {!draft && !error && <p>{text.loading}</p>}
    {draft && (confirmDelete ? <div className="calendar-delete-confirm">
      <strong>{persisted?.name || draft.name}</strong><p>{(persisted?.venue || draft.venue) === 'ha-do-centrosa' ? 'VRena Hà Đô Centrosa' : 'Vrena Thao Dien'} · {persisted?.date || draft.date} · {persisted?.time || draft.time}</p>
      <p>{text.deleteHelp}</p><div className="action-row"><button className="danger" disabled={saving} onClick={() => void mutate(true)} type="button">{text.confirm}</button><button className="secondary" disabled={saving} onClick={() => setConfirmDelete(false)} type="button">{text.keep}</button></div>
    </div> : <form noValidate onSubmit={submit}>
      <fieldset disabled={saving} className="calendar-edit-fields">
        <p className="full calendar-booking-creator">{text.reservedBy}: <strong>{creator || text.notRecorded}</strong>{createdAt && <> · <time dateTime={createdAt}>{bookingTime.format(new Date(createdAt))}</time></>}</p>
        <section className="full calendar-client-details" aria-labelledby="calendar-client-title">
          <h3 id="calendar-client-title">{text.client}</h3>
          {contactDraft ? <div className="calendar-client-contact-fields">
            <label>{text.clientName}<input autoComplete="off" maxLength={120} value={contactDraft.name ?? ''} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} /></label>
            <label>{text.email}<input type="email" autoComplete="off" maxLength={254} value={contactDraft.email ?? ''} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} /></label>
            <label>{text.phone}<input type="tel" autoComplete="off" maxLength={32} value={contactDraft.phone ?? ''} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} /></label>
            <dl><div><dt>{text.points}</dt><dd>{client?.loyalty_points ?? text.notRecorded}</dd></div></dl>
          </div> : <>
            <dl>
              <div><dt>{text.clientName}</dt><dd>{client?.name || text.notRecorded}</dd></div>
              <div><dt>{text.points}</dt><dd>{client?.loyalty_points ?? text.notRecorded}</dd></div>
              <div><dt>{text.email}</dt><dd>{client?.email || text.notRecorded}</dd></div>
              <div><dt>{text.phone}</dt><dd>{client?.phone || text.notRecorded}</dd></div>
            </dl>
            <button type="button" className="secondary calendar-client-edit" onClick={() => setContactDraft({
              name: client?.name ?? null, email: client?.email ?? null, phone: client?.phone ?? null,
            })}>{text.editClient}</button>
          </>}
        </section>
        <label className="full calendar-outside-hours"><input type="checkbox" checked={draft.clientConfirmed} onChange={(event) => patch({ clientConfirmed: event.target.checked })} /><span>{text.clientConfirmed}</span></label>
        <label className="full">{text.name}<input disabled={isSimRacing} required maxLength={120} value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
        <label>{text.shop}<select disabled={isSimRacing} value={draft.venue} onChange={(event) => {
          const venue = event.target.value as Draft['venue']
          const choices = games.filter((item) => gameAvailableAtVenue(item.slug, venue))
          const nextGame = choices.find((item) => item.slug === draft.game)
          patch({ venue, game: nextGame?.slug || '', duration: nextGame?.slug === draft.game ? draft.duration : nextGame?.duration_minutes || draft.duration, arenaIds: [venue === 'cafe-des-stagiaires' ? 'cafe:arena-1' : nextGame?.available_arena_ids?.[0] || 'arena-1'], time: !draft.allowOutsideHours && venue === 'cafe-des-stagiaires' && draft.time < '15:30' ? '15:30' : draft.time })
        }}>{locations.map((location) => <option key={location.venue_key} value={location.venue_key}>{location.name}</option>)}</select></label>
        <label>{bookingText.bookingSource}<select value={draft.source} disabled={isSimRacing} onChange={(event) => patch({ source: event.target.value })}><option value="">{text.unspecified}</option>{Object.entries(bookingText.sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{bookingCategoryCopy[language].label}<select disabled={isSimRacing || isFreeTrial} value={draft.category} onChange={(event) => patch({ category: event.target.value as BookingCategory })}>{(isFreeTrial ? ['free_trial'] as const : ['standard', 'birthday', 'event'] as const).map((value) => <option key={value} value={value}>{bookingCategoryCopy[language][value]}</option>)}</select></label>
        <label>{text.date}<input required type="date" value={draft.date} onChange={(event) => patch({ date: event.target.value })} /></label>
        <label>{text.time}<input required type="time" min={draft.allowOutsideHours ? '00:00' : staffBookingHours(draft.venue, draft.duration).min} max={draft.allowOutsideHours ? '23:59' : staffBookingHours(draft.venue, draft.duration).max} value={draft.time} onChange={(event) => patch({ time: event.target.value })} /></label>
        <label className="full calendar-outside-hours"><input type="checkbox" checked={draft.allowOutsideHours} onChange={(event) => patch({ allowOutsideHours: event.target.checked })} /><span>{text.outsideHours}</span></label>
        <details className="full calendar-games-details">
          <summary>{text.gamesPlayed}</summary>
          <StaffGamesPlayed draftRef={gamesPlayedDraft} sessionId={sessionId} language={language} disabled={saving || draft.venue !== session?.venue_key} />
          {draft.venue !== session?.venue_key && <p className="field-help">{language === 'vi' ? 'Lưu địa điểm mới trước khi sửa trò chơi đã chơi.' : 'Save the new venue before editing games played.'}</p>}
        </details>
        <label>{text.players}<input disabled={isSimRacing} required min={1} max={64} type="number" value={draft.players} onChange={(event) => patch({ players: Number(event.target.value) })} /></label>
        <label>{text.duration}<input disabled={isSimRacing} required min={isFreeTrial ? 1 : isSimRacing ? 15 : 20} max={isFreeTrial ? 1440 : 240} type="number" value={draft.duration} onChange={(event) => patch({ duration: Number(event.target.value) })} /></label>
        <fieldset className="full calendar-arena-options">
          <legend>{text.arenas}</legend>
          {isSimRacing ? <span>SIM Racing</span> : arenas.map((id, index) => {
            const checked = draft.arenaIds.includes(id)
            const cannotRemove = checked && (draft.arenaIds.length === 1 || (Boolean(game?.available_arena_ids?.length) && !draft.arenaIds.some((arena) => arena !== id && game?.available_arena_ids?.includes(arena))))
            const otherGameArena = !checked && Boolean(game?.available_arena_ids?.length) && !game?.available_arena_ids?.includes(id)
            const canUseBoth = arenas.length === 2 && draft.arenaIds.some((arena) => game?.available_arena_ids?.includes(arena))
            return <label key={id}><input type="checkbox" checked={checked} disabled={cannotRemove || (otherGameArena && !canUseBoth)} onChange={() => patch({
              arenaIds: checked ? draft.arenaIds.filter((arena) => arena !== id) : [...draft.arenaIds, id],
            })} /><span>{text.arena} {index + 1}</span></label>
          })}
        </fieldset>
        <label className="full">{text.notes}<textarea value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
        {orders.map((order) => {
          const price = prices[order.id]
          if (!price) return null
          const canReprice = !['cancelled', 'refunded', 'no_show', 'completed'].includes(order.order_status) && order.payment_status !== 'refunded'
          return <div key={order.id} className="full calendar-order-price">
            <p>{order.order_number} · {order.customer_name || 'Guest'}</p>
            <label>{text.total} (VND)<input required disabled={!canReprice} type="text" inputMode="numeric"
              value={editingPrice === order.id || !price.total ? price.total : Number(price.total).toLocaleString('vi-VN')}
              onFocus={(event) => { setEditingPrice(order.id); event.target.select() }}
              onBlur={() => setEditingPrice(null)}
              onChange={(event) => {
                const total = event.target.value.replace(/[.\s,]/g, '')
                if (/^\d{0,10}$/.test(total)) setPrices((current) => ({ ...current, [order.id]: { ...current[order.id], total } }))
              }} /></label>
            <p className="field-help">{text.paid}: {price.paid.toLocaleString('vi-VN')} đ · {text.due}: {Math.max(0, Number(price.total) - price.paid).toLocaleString('vi-VN')} đ</p>
            {Number(price.total) !== order.total && <label>{text.reason}<input required maxLength={1000} value={price.reason} onChange={(event) => setPrices((current) => ({ ...current, [order.id]: { ...current[order.id], reason: event.target.value } }))} /></label>}
          </div>
        })}
      </fieldset>
      <p className="field-help">{text.savedPrice}</p>
      <div className="calendar-dialog-actions">
        <button className="calendar-delete-action" disabled={saving} type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} aria-hidden="true" />{text.remove}</button>
        <button className="secondary" disabled={saving} onClick={onClose} type="button">{text.close}</button>
        <StaffSavedBookingShare sessionId={sessionId} language={language} disabled={saving || session?.status === 'cancelled'} />
        <button className="primary" disabled={saving} type="submit">{text.save}</button>
      </div>
    </form>)}
  </dialog>
}
