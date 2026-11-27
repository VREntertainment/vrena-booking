'use client'

import { useCallback, useRef } from 'react'
import { Share2 } from 'lucide-react'
import { uiText } from '../../lib/i18n/translations'
import { shareImageFile } from '../../lib/shareFiles'
import type { BookingSummaryDetails, BookingSummaryQuote } from '../../lib/staff/bookingSummary'
import { staffConsoleText } from '../../lib/staff/copy'
import { vrenaPalette } from '../../lib/theme/vrenaPalette'
import { ShareLanguageButton, ShareLanguageOptions, type PrepareShare, type ShareLanguage } from '../ShareLanguageButton'
import { StaffBookingSummary } from './StaffBookingSummary'

export type BookingShareDetails = { booking: BookingSummaryDetails; quote: BookingSummaryQuote; orderNumber?: string | null }

export function StaffBookingShareButton({ details, language }: { details: BookingShareDetails; language: ShareLanguage }) {
  return <div className="staff-summary-share">
    <ShareLanguageButton className="secondary" language={language}
      renderOptions={(close) => <BookingShareOptions details={details} language={language} close={close} />}>
      <Share2 size={16} aria-hidden="true" /> {language === 'vi' ? 'Chia sẻ' : 'Share'}
    </ShareLanguageButton>
  </div>
}

export function BookingShareOptions({ details, language, close }: {
  details: BookingShareDetails
  language: ShareLanguage
  close: () => void
}) {
  const enRef = useRef<HTMLDivElement>(null)
  const viRef = useRef<HTMLDivElement>(null)
  const date = details.booking.date
  const prepare = useCallback<PrepareShare>(async (locale, signal) => {
    const content = (locale === 'vi' ? viRef : enRef).current
    if (!content) throw new Error('Missing share content')
    const { toCanvas } = await import('html-to-image')
    await document.fonts.ready
    await Promise.all(Array.from(content.querySelectorAll('img'), (image) => image.decode()))
    signal.throwIfAborted()
    const canvas = await toCanvas(content, { pixelRatio: 3, backgroundColor: vrenaPalette.white })
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image export failed')), 'image/jpeg', 0.95)
    })
    const file = new File([blob], `VRena-booking-${date}-${locale}.jpg`, { type: 'image/jpeg' })
    return () => shareImageFile(file, 'VRena')
  }, [date])

  return <>
    <ShareLanguageOptions language={language} prepare={prepare} close={close} />
    <div className="staff-share-artwork" aria-hidden="true" inert>
      {(['en', 'vi'] as const).map((locale) => <StaffBookingSummary key={locale} contentRef={locale === 'vi' ? viRef : enRef}
        booking={details.booking} quote={details.quote} confirmedOrderNumber={details.orderNumber || undefined}
        venueName={details.booking.venueKey === 'cafe-des-stagiaires' ? uiText[locale].bookingVenueCafeName : uiText[locale].bookingVenueHaDoName}
        language={locale} text={staffConsoleText[locale]} />)}
    </div>
  </>
}
