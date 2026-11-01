'use client'
import { useEffect, useRef, useState } from 'react'
import { CalendarPlus, Check } from 'lucide-react'
import type { LanguageCode } from '../lib/i18n/languages'
import { reservationDetails, reservationCalendarFile, type CalendarReservation } from '../lib/reservationCalendar'
const copy: Record<LanguageCode, { title: string; body: string; later: string; file: string; saved: string }> = {
  en: { title: 'Your booking is confirmed', body: 'Keep your visit handy. Add it to your calendar.', later: 'Not now', file: 'Apple Calendar / Outlook', saved: 'Calendar file downloaded' },
  vi: { title: 'Đặt chỗ đã được xác nhận', body: 'Lưu lịch hẹn để sẵn sàng cho buổi chơi.', later: 'Để sau', file: 'Apple Calendar / Outlook', saved: 'Đã tải tệp lịch' },
  fr: { title: 'Votre réservation est confirmée', body: 'Gardez votre visite en tête. Ajoutez-la à votre agenda.', later: 'Plus tard', file: 'Calendrier Apple / Outlook', saved: 'Fichier calendrier téléchargé' },
  de: { title: 'Deine Buchung ist bestätigt', body: 'Speichere deinen Besuch in deinem Kalender.', later: 'Später', file: 'Apple Kalender / Outlook', saved: 'Kalenderdatei heruntergeladen' },
  it: { title: 'La prenotazione è confermata', body: 'Aggiungi la visita al calendario per averla a portata di mano.', later: 'Non ora', file: 'Calendario Apple / Outlook', saved: 'File calendario scaricato' },
  ja: { title: '予約が確定しました', body: '予定をカレンダーに追加しておきましょう。', later: '後で', file: 'Appleカレンダー / Outlook', saved: 'カレンダーファイルをダウンロードしました' },
  ko: { title: '예약이 확정되었습니다', body: '방문 일정을 캘린더에 추가하세요.', later: '나중에', file: 'Apple 캘린더 / Outlook', saved: '캘린더 파일 다운로드 완료' },
  zh: { title: '预约已确认', body: '将到店安排添加到日历，轻松记住预约。', later: '暂不添加', file: 'Apple 日历 / Outlook', saved: '日历文件已下载' },
}
export default function BookingCalendarDialog({ booking, language }: { booking: CalendarReservation; language: LanguageCode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [downloaded, setDownloaded] = useState(false)
  const t = copy[language]
  const details = reservationDetails(booking)
  const action = { en: 'Add to calendar', vi: 'Thêm vào lịch', fr: 'Ajouter au calendrier', de: 'Zum Kalender hinzufügen', it: 'Aggiungi al calendario', ja: 'カレンダーに追加', ko: '캘린더에 추가', zh: '添加到日历' }[language]
  const reminder = { en: 'Reminder: 1 hour before', vi: 'Nhắc trước 1 giờ', fr: 'Rappel : 1 heure avant', de: 'Erinnerung: 1 Stunde vorher', it: 'Promemoria: 1 ora prima', ja: '1時間前にリマインダー', ko: '1시간 전 알림', zh: '提前 1 小时提醒' }[language]
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); dialog?.querySelector<HTMLButtonElement>('button.primary')?.focus(); return () => dialog?.close() }, [])
  const download = () => {
    const url = URL.createObjectURL(new Blob([reservationCalendarFile(booking)], { type: 'text/calendar;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'vrena-booking.ics'; document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true)
  }
  return <dialog ref={ref} className="booking-calendar-dialog" aria-labelledby={`calendar-title-${booking.id}`}>
    <div className="booking-calendar-content">
      <span className="booking-calendar-icon"><CalendarPlus size={28} aria-hidden="true" /></span>
      <h2 id={`calendar-title-${booking.id}`}>{t.title}</h2><p>{t.body}</p>
      <div className="booking-calendar-summary"><strong>{booking.title}</strong><span>{new Date(`${booking.date}T12:00:00+07:00`).toLocaleDateString(language, { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'short', year: 'numeric' })} · {booking.time.slice(0, 5)} (GMT+7)</span><span>{details.location}</span><a href={details.tel}>{details.phone}</a><a href={details.url}>{details.url}</a><small>{reminder}</small></div>
      <button className="primary booking-calendar-action" type="button" onClick={download}>{downloaded && <Check size={16} aria-hidden="true" />}{action}</button>
      {downloaded && <span role="status">{t.saved}</span>}
      <button className="link-button" type="button" onClick={() => ref.current?.close()}>{t.later}</button>
    </div>
  </dialog>
}
