'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '../lib/booking/client'
import { formatShortDate, type Session } from '../lib/bookingWidgetDomain'
import type { LanguageCode } from '../lib/i18n/languages'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

type AccountBooking = Pick<Session, 'id' | 'name' | 'venue_key' | 'date' | 'start_time' | 'duration_minutes' | 'status' | 'ticket_status' | 'ticket_reference' | 'max_players'>
const ACCOUNT_BOOKING_SELECT = 'id,name,venue_key,date,start_time,duration_minutes,status,ticket_status,ticket_reference,max_players'

export const accountBookingLabels: Record<LanguageCode, string> = {
  zh: "我的预约",
  en: 'My Bookings', vi: 'Đặt chỗ của tôi', ko: '내 예약', ja: '予約一覧',
  fr: 'Mes réservations', de: 'Meine Buchungen', it: 'Le mie prenotazioni',
}

export default function AccountBookings({ userId, language, text }: {
  userId: string
  language: LanguageCode
  text: TranslationMap
}) {
  const [result, setResult] = useState<{ userId: string; rows: AccountBooking[]; error: string } | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const client = await getSupabase()
        const rows: AccountBooking[] = []
        // Query this account independently of the public calendar's date window
        // and cache. The caller's JWT and existing row-level policies still apply.
        for (let offset = 0; ; offset += 100) {
          const { data, error } = await client.from('sessions').select(ACCOUNT_BOOKING_SELECT)
            .or(`owner_id.eq.${userId},ticket_customer_id.eq.${userId}`)
            .is('deleted_at', null)
            .order('date', { ascending: false }).order('start_time', { ascending: false })
            .order('id').range(offset, offset + 99)
          if (!active) return
          if (error) throw error
          rows.push(...(data || []) as AccountBooking[])
          if (!data || data.length < 100) break
        }
        if (active) setResult({ userId, rows, error: '' })
      } catch (error) {
        if (active) setResult({ userId, rows: [], error: error instanceof Error ? error.message : String((error as { message?: string }).message || error) })
      }
    })()
    return () => { active = false }
  }, [userId, revision])
  const current = result?.userId === userId ? result : null
  return <section className="account-bookings" aria-label={accountBookingLabels[language]}>
    <h2>{accountBookingLabels[language]}</h2>
    {!current && <p role="status">{text.profileLoading}</p>}
    {current?.error && <p role="alert">{current.error}</p>}
    {current && !current.error && current.rows.length === 0 && <p>{({ zh: '预约确认后将在此显示。', en: 'Your bookings will appear here after confirmation.', vi: 'Đặt chỗ sẽ xuất hiện ở đây sau khi được xác nhận.', ko: '확정된 예약이 여기에 표시됩니다.', ja: '確定した予約がここに表示されます。', fr: 'Vos réservations apparaîtront ici après confirmation.', de: 'Deine Buchungen erscheinen hier nach der Bestätigung.', it: 'Le prenotazioni appariranno qui dopo la conferma.' })[language]}</p>}
    {current?.rows.map(session => <article className="profile-completion-card" key={session.id}>
      <strong>{session.ticket_reference || session.name}</strong>
      <p>{session.venue_key === 'cafe-des-stagiaires' ? 'VRena Thảo Điền' : 'VRena Hà Đô Centrosa'}</p>
      <p>{formatShortDate(session.date, language)} · {session.start_time.slice(0, 5)} · {session.duration_minutes} {language === 'zh' ? '分钟' : 'min'}</p>
      <p>{session.max_players} {text.players}</p>
      <p>{session.status === 'cancelled' ? text.sessionCancelled : session.ticket_status === 'confirmed' ? text.bookingConfirmed : session.name}</p>
    </article>)}
    <button type="button" className="secondary" onClick={() => setRevision(value => value + 1)}>{({ zh: '刷新', en: 'Refresh', vi: 'Làm mới', ko: '새로고침', ja: '更新', fr: 'Actualiser', de: 'Aktualisieren', it: 'Aggiorna' })[language]}</button>
  </section>
}
