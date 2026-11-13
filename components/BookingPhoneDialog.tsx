'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, X } from 'lucide-react'
import { PhoneNumberInput } from './CountryCodePicker'
import { validateGuestTicketContact } from '../lib/guestTicketBooking'
import { needsBookingEmail } from '../lib/bookingAccountContact'
import type { LanguageCode } from '../lib/i18n/languages'

const copy = {
  zh: {"title": "添加电话号码", "body": "确认预约需要电话号码，我们会将其保存至您的账户，方便下次预约。", "confirm": "保存并确认预约"},
  en: { title: 'Add your phone number', body: 'A phone number is required to confirm your booking. We’ll save it to your account for next time.', confirm: 'Save & confirm booking' },
  vi: { title: 'Thêm số điện thoại', body: 'Cần số điện thoại để xác nhận đặt chỗ. Số này sẽ được lưu vào tài khoản cho lần sau.', confirm: 'Lưu và xác nhận đặt chỗ' },
  ko: { title: '전화번호 추가', body: '예약 확정을 위해 전화번호가 필요합니다. 다음 예약을 위해 계정에 저장됩니다.', confirm: '저장하고 예약 확정' },
  ja: { title: '電話番号を追加', body: '予約の確定には電話番号が必要です。次回のためにアカウントに保存します。', confirm: '保存して予約を確定' },
  fr: { title: 'Ajoutez votre numéro', body: 'Un numéro de téléphone est nécessaire pour confirmer la réservation. Il sera enregistré dans votre compte.', confirm: 'Enregistrer et confirmer' },
  de: { title: 'Telefonnummer hinzufügen', body: 'Zur Buchungsbestätigung ist eine Telefonnummer erforderlich. Wir speichern sie in Ihrem Konto.', confirm: 'Speichern und Buchung bestätigen' },
  it: { title: 'Aggiungi il tuo numero', body: 'Il numero di telefono è necessario per confermare la prenotazione. Lo salveremo nel tuo account.', confirm: 'Salva e conferma prenotazione' },
}

const contactCopy = {
  en: ['Complete your contact details', 'Add the missing details to confirm your booking. We’ll save them to your account. Your booking selections stay here.'],
  vi: ['Hoàn tất thông tin liên hệ', 'Bổ sung thông tin còn thiếu để xác nhận đặt chỗ. Thông tin sẽ được lưu vào tài khoản. Các lựa chọn đặt chỗ được giữ nguyên.'],
  fr: ['Complétez vos coordonnées', 'Ajoutez les informations manquantes pour confirmer. Elles seront enregistrées dans votre compte. Vos choix de réservation sont conservés.'],
  de: ['Kontaktdaten vervollständigen', 'Ergänzen Sie die fehlenden Angaben zur Bestätigung. Wir speichern sie in Ihrem Konto. Ihre Buchungsauswahl bleibt erhalten.'],
  it: ['Completa i tuoi recapiti', 'Aggiungi i dati mancanti per confermare. Li salveremo nel tuo account. Le tue scelte di prenotazione restano qui.'],
  ko: ['연락처를 완성해 주세요', '예약 확정을 위해 누락된 정보를 입력해 주세요. 계정에 저장되며 예약 선택 사항은 유지됩니다.'],
  ja: ['連絡先情報を入力', '予約確定に必要な情報を入力してください。アカウントに保存され、予約内容は保持されます。'],
  zh: ['完善联系信息', '请补充缺失的信息以确认预约。信息将保存至您的账户，已选择的预约内容将保留。'],
}

export default function BookingPhoneDialog({ language, text, phone, onPhoneChange, email, onEmailChange, needsPhone: phoneRequired, needsEmail: emailRequired, onConfirm, onClose, busy, error }: {
  language: LanguageCode
  text: Record<string, string>
  needsPhone: boolean
  needsEmail: boolean
  email: string
  onEmailChange: (email: string) => void
  phone: string
  onPhoneChange: (phone: string) => void
  onConfirm: () => Promise<boolean>
  onClose: () => void
  busy: boolean
  error: string
}) {
  const [needsPhone] = useState(phoneRequired)
  const [needsEmail] = useState(emailRequired)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const [validationError, setValidationError] = useState('')
  const labels = copy[language]
  useEffect(() => {
    const dialog = dialogRef.current!
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('input[type="tel"], input[type="email"]')?.focus()
    return () => dialog.close()
  }, [])
  const message = validationError || error
  return <dialog ref={dialogRef} className="login-modal booking-phone-dialog" aria-labelledby="booking-phone-title" aria-describedby="booking-phone-body"
    onCancel={event => { event.preventDefault(); if (!busy && !inFlight.current) onClose() }}>
    <button type="button" className="modal-close" aria-label={text.close} disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button>
    <form noValidate onSubmit={async event => {
      event.preventDefault()
      if (busy || inFlight.current) return
      const validation = needsPhone ? validateGuestTicketContact({ name: '', phone }, text) : { error: '' }
      if (!validation.error && needsEmail && needsBookingEmail(email)) validation.error = text.emailRequired
      setValidationError(validation.error)
      if (validation.error) { dialogRef.current?.querySelector<HTMLInputElement>(validation.error === text.emailRequired ? 'input[type="email"]' : 'input[type="tel"]')?.focus(); return }
      inFlight.current = true
      try { if (await onConfirm()) onClose() } finally { inFlight.current = false }
    }}>
      <span className="booking-phone-icon"><Phone size={24} aria-hidden="true" /></span>
      <h2 id="booking-phone-title">{needsEmail ? contactCopy[language][0] : labels.title}</h2>
      <p id="booking-phone-body">{needsEmail ? contactCopy[language][1] : labels.body}</p>
      {needsPhone && <><label className="booking-phone-label" htmlFor="booking-account-phone">{text.phoneNumber} <span aria-hidden="true">*</span></label>
      <PhoneNumberInput inputId="booking-account-phone" required invalid={Boolean(message)} describedBy={message ? 'booking-phone-error' : undefined}
        autoComplete="tel-national" buttonLabel={text.countryCode} inputLabel={text.phoneNumber} searchPlaceholder={text.searchCountry}
        value={phone} disabled={busy} onChange={value => { setValidationError(''); onPhoneChange(value) }} /></>}
      {needsEmail && <>
        <label className="booking-phone-label" htmlFor="booking-account-email">{text.email} <span aria-hidden="true">*</span></label>
        <input id="booking-account-email" type="email" autoComplete="email" inputMode="email" required maxLength={254}
          value={email} disabled={busy} aria-invalid={Boolean(message)} aria-describedby={message ? 'booking-phone-error' : undefined}
          onChange={event => { setValidationError(''); onEmailChange(event.target.value) }} />
      </>}
      {message && <p id="booking-phone-error" className="notice ticket-status-error" role="alert">{message}</p>}
      <button className="primary create-button" type="submit" disabled={busy}>{busy ? text.bookingTickets : labels.confirm}</button>
    </form>
  </dialog>
}
