'use client'

import { useEffect, useRef, useState } from 'react'
import { Phone, X } from 'lucide-react'
import { PhoneNumberInput } from './CountryCodePicker'
import { validateGuestTicketContact } from '../lib/guestTicketBooking'
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

export default function BookingPhoneDialog({ language, text, phone, onPhoneChange, onConfirm, onClose, busy, error }: {
  language: LanguageCode
  text: Record<string, string>
  phone: string
  onPhoneChange: (phone: string) => void
  onConfirm: () => Promise<boolean>
  onClose: () => void
  busy: boolean
  error: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const [validationError, setValidationError] = useState('')
  const labels = copy[language]
  useEffect(() => {
    const dialog = dialogRef.current!
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('input[type="tel"]')?.focus()
    return () => dialog.close()
  }, [])
  const message = validationError || error
  return <dialog ref={dialogRef} className="login-modal booking-phone-dialog" aria-labelledby="booking-phone-title" aria-describedby="booking-phone-body"
    onCancel={event => { event.preventDefault(); if (!busy && !inFlight.current) onClose() }}>
    <button type="button" className="modal-close" aria-label={text.close} disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button>
    <form noValidate onSubmit={async event => {
      event.preventDefault()
      if (busy || inFlight.current) return
      const validation = validateGuestTicketContact({ name: '', phone }, text)
      setValidationError(validation.error)
      if (validation.error) { dialogRef.current?.querySelector<HTMLInputElement>('input[type="tel"]')?.focus(); return }
      inFlight.current = true
      try { if (await onConfirm()) onClose() } finally { inFlight.current = false }
    }}>
      <span className="booking-phone-icon"><Phone size={24} aria-hidden="true" /></span>
      <h2 id="booking-phone-title">{labels.title}</h2>
      <p id="booking-phone-body">{labels.body}</p>
      <label className="booking-phone-label" htmlFor="booking-account-phone">{text.phoneNumber} <span aria-hidden="true">*</span></label>
      <PhoneNumberInput inputId="booking-account-phone" required invalid={Boolean(message)} describedBy={message ? 'booking-phone-error' : undefined}
        autoComplete="tel-national" buttonLabel={text.countryCode} inputLabel={text.phoneNumber} searchPlaceholder={text.searchCountry}
        value={phone} disabled={busy} onChange={value => { setValidationError(''); onPhoneChange(value) }} />
      {message && <p id="booking-phone-error" className="notice ticket-status-error" role="alert">{message}</p>}
      <button className="primary create-button" type="submit" disabled={busy}>{busy ? text.bookingTickets : labels.confirm}</button>
    </form>
  </dialog>
}
