'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getSupabase } from '../lib/booking/client'
import type { Profile } from '../lib/bookingWidgetDomain'
import type { LanguageCode } from '../lib/i18n/languages'

const copy = {
  en: { package: '3 races · 15 minutes · 1 driver', capacity: 'Hà Đô only · One simulator', pay: '150,000 VND · Pay at the venue', loading: 'Checking available times…', empty: 'No times available. Please choose another date.', book: 'Book SIM Racing', again: 'Book another session', failed: 'Unable to load times. Please try again.', retry: 'Try again', confirmed: 'SIM Racing booking confirmed', busy: 'Booking…' },
  vi: { package: '3 lượt đua · 15 phút · 1 người', capacity: 'Chỉ tại Hà Đô · Một máy đua', pay: '150.000 VND · Thanh toán tại cửa hàng', loading: 'Đang kiểm tra giờ trống…', empty: 'Không còn giờ trống. Vui lòng chọn ngày khác.', book: 'Đặt SIM Racing', again: 'Đặt lượt khác', failed: 'Không tải được giờ trống. Vui lòng thử lại.', retry: 'Thử lại', confirmed: 'Đã xác nhận đặt SIM Racing', busy: 'Đang đặt…' },
  fr: { package: '3 courses · 15 minutes · 1 pilote', capacity: 'Hà Đô uniquement · Un simulateur', pay: '150 000 VND · Paiement sur place', loading: 'Recherche des créneaux…', empty: 'Aucun créneau. Choisissez une autre date.', book: 'Réserver SIM Racing', again: 'Réserver une autre séance', failed: 'Impossible de charger les créneaux. Réessayez.', retry: 'Réessayer', confirmed: 'Réservation SIM Racing confirmée', busy: 'Réservation…' },
  de: { package: '3 Rennen · 15 Minuten · 1 Fahrer', capacity: 'Nur Hà Đô · Ein Simulator', pay: '150.000 VND · Vor Ort bezahlen', loading: 'Verfügbare Zeiten werden geprüft…', empty: 'Keine Zeiten verfügbar. Bitte anderes Datum wählen.', book: 'SIM Racing buchen', again: 'Weitere Sitzung buchen', failed: 'Zeiten konnten nicht geladen werden.', retry: 'Erneut versuchen', confirmed: 'SIM Racing Buchung bestätigt', busy: 'Wird gebucht…' },
  it: { package: '3 gare · 15 minuti · 1 pilota', capacity: 'Solo Hà Đô · Un simulatore', pay: '150.000 VND · Pagamento in sede', loading: 'Verifica disponibilità…', empty: 'Nessun orario disponibile. Scegli un’altra data.', book: 'Prenota SIM Racing', again: 'Prenota un’altra sessione', failed: 'Impossibile caricare gli orari. Riprova.', retry: 'Riprova', confirmed: 'Prenotazione SIM Racing confermata', busy: 'Prenotazione…' },
  ja: { package: '3レース · 15分 · 1名', capacity: 'Hà Đô限定 · シミュレーター1台', pay: '150,000 VND · 現地払い', loading: '空き時間を確認中…', empty: '空きがありません。別の日をお選びください。', book: 'SIM Racingを予約', again: '別のセッションを予約', failed: '空き時間を読み込めませんでした。', retry: '再試行', confirmed: 'SIM Racingの予約が確定しました', busy: '予約中…' },
  ko: { package: '3회 레이스 · 15분 · 1명', capacity: 'Hà Đô 전용 · 시뮬레이터 1대', pay: '150,000 VND · 현장 결제', loading: '예약 가능 시간 확인 중…', empty: '예약 가능한 시간이 없습니다. 다른 날짜를 선택하세요.', book: 'SIM Racing 예약', again: '다른 세션 예약', failed: '시간을 불러올 수 없습니다. 다시 시도하세요.', retry: '다시 시도', confirmed: 'SIM Racing 예약 확정', busy: '예약 중…' },
} satisfies Record<LanguageCode, Record<string, string>>

function venueDate(offset = 0) {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() + offset)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export default function SimRacingBooking({ language, text, profile, onBooked }: {
  language: LanguageCode; text: Record<string, string>; profile: Profile | null; onBooked: () => void
}) {
  const t = copy[language]
  const [date, setDate] = useState(() => venueDate())
  const [time, setTime] = useState('')
  const [times, setTimes] = useState<string[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [confirmation, setConfirmation] = useState<{ reference: string; date: string; time: string } | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const result = await (await getSupabase()).rpc('sim_racing_available_times', { p_date: date })
        if (result.error) throw result.error
        if (!cancelled) {
          const available = (result.data as { start_time: string }[]).map((row) => row.start_time)
          setTimes(available)
          setTime((current) => available.includes(current) ? current : available[0] || '')
        }
      } catch (cause) {
        if (!cancelled) { setTimes([]); setTime(''); setLoadError(true); setError(cause instanceof Error ? cause.message : String((cause as { message?: string })?.message || '')) }
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [date, revision])

  async function book(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || !time || loading || loadError) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const result = await (await getSupabase()).rpc('create_sim_racing_booking', {
        p_date: date, p_start_time: time, p_guest_phone: profile ? null : phone, p_guest_name: profile ? null : name.trim() || null,
      })
      if (result.error) throw new Error(result.error.message)
      setConfirmation({ reference: result.data.ticket_reference, date, time })
      onBooked()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.ticketBookingError)
      setRevision((current) => current + 1)
    } finally { setBusy(false); inFlight.current = false }
  }

  return <section className="section tickets-section sim-racing-booking" aria-labelledby="sim-racing-title">
    <header><p>{t.capacity}</p><h2 id="sim-racing-title">SIM Racing</h2><p>{t.package}</p><strong className="sim-racing-price">{t.pay}</strong></header>
    {confirmation ? <div className="ticket-confirmation" role="status">
      <h3>{t.confirmed}</h3>
      <p>VRena Hà Đô Centrosa</p><p>{new Date(`${confirmation.date}T12:00:00`).toLocaleDateString(language)} · {confirmation.time} (GMT+7)</p>
      <p>{text.bookingReference}: <strong>{confirmation.reference}</strong></p><p>{t.package}</p><p>{t.pay}</p>
      <button type="button" className="secondary" onClick={() => { setConfirmation(null); setRevision((value) => value + 1) }}>{t.again}</button>
    </div> : <form onSubmit={book}>
      <fieldset disabled={busy} className="form-grid sim-racing-fields">
        <label>{text.date}<input required type="date" min={venueDate()} max={venueDate(90)} value={date} onChange={(event) => { setDate(event.target.value); setTime(''); setError('') }} /></label>
        <label>{text.availableTime} (GMT+7)<select required disabled={loading || !times.length} value={time} onChange={(event) => setTime(event.target.value)}>
          {!times.length && <option value="">—</option>}{times.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
        </select></label>
        {!profile && <><label>{text.name} ({text.optional})<input autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>{text.phoneNumber} *<input required type="tel" autoComplete="tel" maxLength={25} value={phone} onChange={(event) => setPhone(event.target.value)} /></label></>}
      </fieldset>
      {loading && <p role="status">{t.loading}</p>}
      {loadError && <p role="alert">{t.failed} <button type="button" className="secondary" onClick={() => { setError(''); setRevision((value) => value + 1) }}>{t.retry}</button></p>}
      {!loading && !loadError && !times.length && <p role="status">{t.empty}</p>}
      {error && <p role="alert" className="notice">{error}</p>}
      <button className="primary" type="submit" disabled={busy || loading || !time || loadError}>{busy ? t.busy : t.book}</button>
    </form>}
  </section>
}
