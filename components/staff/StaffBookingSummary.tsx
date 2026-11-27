import type { RefObject } from 'react'
import { uiText } from '../../lib/i18n/translations'
import { venueContact } from '../../lib/venueContacts'
import { staffBookingCopy } from '../../lib/staff/bookingCopy'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import { dateFromInput } from '../../lib/staff/dates'
import { staffBookingEndTime } from '../../lib/staff/bookingHours'
import { formatVnd } from '../../lib/staff/formatting'
import type { StaffConsoleLanguage } from '../../lib/staff/types'
import type { BookingSummaryDetails, BookingSummaryQuote } from '../../lib/staff/bookingSummary'
import { vatSplit } from '../../lib/staff/vat'

type Props = {
  contentRef: RefObject<HTMLDivElement | null>
  booking: BookingSummaryDetails
  venueName: string
  language: StaffConsoleLanguage
  text: StaffConsoleCopy
  quote: BookingSummaryQuote
  confirmedOrderNumber?: string
}

const copy = {
  en: {
    confirmed: 'Booking Confirmed', confirmedFooter: 'Your booking is confirmed. We look forward to welcoming you.', reference: 'Booking reference', title: 'Your VR experience', proposal: 'Booking proposal', preparedFor: 'Prepared for',
    timing: 'Date & time', localTime: 'Vietnam time', group: 'Your group',
    footer: 'Please contact VRena to confirm your booking.', website: 'vre-vietnam.com',
  },
  vi: {
    confirmed: 'Đặt chỗ đã xác nhận', confirmedFooter: 'Đặt chỗ của bạn đã được xác nhận. VRena hẹn gặp bạn!', reference: 'Mã đặt chỗ', title: 'Trải nghiệm VR của bạn', proposal: 'Đề xuất đặt chỗ', preparedFor: 'Dành cho',
    timing: 'Ngày & giờ', localTime: 'Giờ Việt Nam', group: 'Nhóm của bạn',
    footer: 'Vui lòng liên hệ VRena để xác nhận đặt chỗ.', website: 'vre-vietnam.com',
  },
}

export function StaffBookingSummary({ contentRef, booking, venueName, language, text, quote, confirmedOrderNumber }: Props) {
  const contact = venueContact(booking.venueKey)
  const c = copy[language]
  const labels = staffBookingCopy[language]
  const date = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(dateFromInput(booking.date))
  return <div ref={contentRef} className="staff-summary-export">
    <div className="staff-client-summary staff-price-lines">
      <header className="staff-client-summary-brand">
        {/* Plain same-origin image lets the share renderer embed the official artwork. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/vrena-logo-full-light.svg" width="176" height="36" alt="VRena" loading="eager" />
        <span className="staff-client-summary-badge">{confirmedOrderNumber ? c.confirmed : c.proposal}</span>
      </header>
      <div className="staff-client-summary-title">
        <p>{c.title}</p>
        <h4>{venueName}</h4>
        <p className="staff-client-summary-address">{booking.venueKey === 'cafe-des-stagiaires' ? uiText[language].bookingVenueCafeAddress : uiText[language].bookingVenueHaDoAddress}</p>
        <p className="staff-client-summary-contact">Zalo: {contact.phone}<br />WhatsApp: +{contact.international}</p>
      </div>
      {!booking.guestBooking && booking.customerName.trim() && <div className="staff-client-summary-customer">
        <span>{c.preparedFor}</span><strong>{booking.customerName}</strong>
        {booking.contactName.trim() && <p>{labels.contactName}: {booking.contactName}</p>}
      </div>}
      <div className="staff-client-summary-schedule">
        <span>{c.timing}</span>
        <strong>{date}</strong>
        <p>{booking.time} – {staffBookingEndTime(booking.time, quote.duration)} <small>{c.localTime}</small></p>
      </div>
      <dl className="staff-client-summary-details">
        <div><dt>{text.labels.players}</dt><dd>{booking.players}</dd></div>
        <div><dt>{labels.arenaCount}</dt><dd>{booking.venueKey === 'cafe-des-stagiaires' ? 1 : booking.arenaCount}</dd></div>
        <div><dt>{labels.reservedTime}</dt><dd>{quote.duration} min</dd></div>
      </dl>
      <div className="staff-client-summary-cost">
        <span>{text.labels.subtotal}</span><strong>{formatVnd(quote.subtotal)}</strong>
        {quote.discountTotal > 0 && <><span>{text.labels.discount}</span><strong>−{formatVnd(quote.discountTotal)}</strong></>}
        {booking.bookingKind === 'event' && <><span>{labels.totalBeforeVat}</span><strong>{formatVnd(vatSplit(quote.total).net)}</strong></>}
      </div>
      <div className="staff-client-summary-total"><span>{labels.totalVatIncluded}</span><strong>{formatVnd(quote.total)}</strong></div>
      <footer className="staff-client-summary-footer">{confirmedOrderNumber && <p>{c.reference}: <strong>{confirmedOrderNumber}</strong></p>}<p>{confirmedOrderNumber ? c.confirmedFooter : c.footer}</p><strong>{c.website}</strong></footer>
    </div>
  </div>
}
