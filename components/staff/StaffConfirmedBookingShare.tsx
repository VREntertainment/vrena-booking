'use client'

import { uiText } from '../../lib/i18n/translations'
import type { ConfirmedBookingSummary } from '../../lib/staff/bookingSummary'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import type { StaffConsoleLanguage } from '../../lib/staff/types'
import { StaffBookingSummary } from './StaffBookingSummary'
import { StaffBookingShareButton } from './StaffBookingShareButton'

export function StaffConfirmedBookingShare({ snapshot, language, text, onClose }: {
  snapshot: ConfirmedBookingSummary; language: StaffConsoleLanguage; text: StaffConsoleCopy; onClose: () => void
}) {
  const title = language === 'vi' ? 'Đặt chỗ đã xác nhận' : 'Booking Confirmed'
  const venueName = snapshot.booking.venueKey === 'cafe-des-stagiaires' ? uiText[language].bookingVenueCafeName : uiText[language].bookingVenueHaDoName
  return <section className="staff-card staff-confirmed-share" aria-label={title}>
    <div className="staff-card-heading"><h3>{title}</h3><StaffBookingShareButton details={snapshot} language={language} /></div>
    <StaffBookingSummary booking={snapshot.booking} quote={snapshot.quote} venueName={venueName} language={language} text={text} confirmedOrderNumber={snapshot.orderNumber} />
    <button type="button" className="secondary" onClick={onClose}>{language === 'vi' ? 'Đóng bản xác nhận' : 'Dismiss confirmation'}</button>
  </section>
}
