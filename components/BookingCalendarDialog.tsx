'use client'
import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { LanguageCode } from '../lib/i18n/languages'
import { reservationCalendarFile, type CalendarReservation } from '../lib/reservationCalendar'
const copy: Record<LanguageCode, { title: string; body: string; later: string; file: string; saved: string }> = {
  en: { title: 'Your booking is confirmed', body: 'Congratulations!', later: 'Not now', file: 'Apple Calendar / Outlook', saved: 'Calendar file downloaded' },
  vi: { title: 'Đặt chỗ đã được xác nhận', body: 'Chúc mừng bạn!', later: 'Để sau', file: 'Apple Calendar / Outlook', saved: 'Đã tải tệp lịch' },
  fr: { title: 'Votre réservation est confirmée', body: 'Félicitations !', later: 'Plus tard', file: 'Calendrier Apple / Outlook', saved: 'Fichier calendrier téléchargé' },
  de: { title: 'Deine Buchung ist bestätigt', body: 'Herzlichen Glückwunsch!', later: 'Später', file: 'Apple Kalender / Outlook', saved: 'Kalenderdatei heruntergeladen' },
  it: { title: 'La prenotazione è confermata', body: 'Congratulazioni!', later: 'Non ora', file: 'Calendario Apple / Outlook', saved: 'File calendario scaricato' },
  ja: { title: '予約が確定しました', body: 'おめでとうございます！', later: '後で', file: 'Appleカレンダー / Outlook', saved: 'カレンダーファイルをダウンロードしました' },
  ko: { title: '예약이 확정되었습니다', body: '축하합니다!', later: '나중에', file: 'Apple 캘린더 / Outlook', saved: '캘린더 파일 다운로드 완료' },
  zh: { title: '预约已确认', body: '恭喜您！', later: '暂不添加', file: 'Apple 日历 / Outlook', saved: '日历文件已下载' },
}
export default function BookingCalendarDialog({ booking, language }: { booking: CalendarReservation; language: LanguageCode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [downloaded, setDownloaded] = useState(false)
  const t = copy[language]
  const action = { en: 'Add to calendar', vi: 'Thêm vào lịch', fr: 'Ajouter au calendrier', de: 'Zum Kalender hinzufügen', it: 'Aggiungi al calendario', ja: 'カレンダーに追加', ko: '캘린더에 추가', zh: '添加到日历' }[language]
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); dialog?.querySelector<HTMLButtonElement>('button.primary')?.focus(); return () => dialog?.close() }, [])
  const download = () => {
    const url = URL.createObjectURL(new Blob([reservationCalendarFile(booking)], { type: 'text/calendar;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'vrena-booking.ics'; document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true)
  }
  return <dialog ref={ref} className="booking-calendar-dialog" aria-labelledby={`calendar-title-${booking.id}`}>
    <div className="booking-calendar-content">
      <picture className="booking-calendar-logo">
        <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-logo-full-dark.svg" />
        <img src="/brand/vrena-logo-full-light.svg" alt="VRena" width="4886" height="1000" />
      </picture>
      <h2 id={`calendar-title-${booking.id}`}>{t.title}</h2><p>{t.body}</p>
      <button className="primary booking-calendar-action" type="button" onClick={download}>{downloaded && <Check size={16} aria-hidden="true" />}{action}</button>
      {downloaded && <span role="status">{t.saved}</span>}
      <button className="link-button" type="button" onClick={() => ref.current?.close()}>{t.later}</button>
    </div>
  </dialog>
}
