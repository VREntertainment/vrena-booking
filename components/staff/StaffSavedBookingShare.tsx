'use client'

import { useEffect, useRef, useState } from 'react'
import { Share2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase/client'
import { uiText } from '../../lib/i18n/translations'
import { staffConsoleText } from '../../lib/staff/copy'
import { savedBookingSummary } from '../../lib/staff/bookingSummary'
import { StaffBookingSummary } from './StaffBookingSummary'
import { StaffBookingShareButton } from './StaffBookingShareButton'

export function StaffSavedBookingShare({ sessionId, orderId, language, disabled = false }: {
  sessionId?: string | null; orderId?: string; language: 'en' | 'vi'; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return <>
    <button className="secondary" type="button" disabled={disabled} onClick={() => setOpen(true)}>
      <Share2 size={16} aria-hidden="true" /> {language === 'vi' ? 'Chia sẻ' : 'Share'}
    </button>
    {open && <SavedBookingShareDialog sessionId={sessionId} orderId={orderId} language={language} onClose={() => setOpen(false)} />}
  </>
}

function SavedBookingShareDialog({ sessionId, orderId, language, onClose }: {
  sessionId?: string | null; orderId?: string; language: 'en' | 'vi'; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [snapshot, setSnapshot] = useState<ReturnType<typeof savedBookingSummary>>(null)
  const [failed, setFailed] = useState(false)
  const title = language === 'vi' ? 'Chia sẻ đặt chỗ' : 'Share booking'
  useEffect(() => {
    const previousFocus = document.activeElement
    dialog.current?.showModal()
    const controller = new AbortController()
    void (async () => {
      try {
        const query = supabase.from('staff_orders').select('*')
        const orders = await (orderId ? query.eq('id', orderId) : query.eq('session_id', sessionId!)).abortSignal(controller.signal)
        if (orders.error) throw orders.error
        // Multiple linked orders cannot safely be represented as one customer's confirmation.
        if ((orders.data?.length || 0) > 1 || (orderId && !orders.data?.length)) throw new Error('Ambiguous order')
        const order = orders.data?.[0] || null
        const id = order?.session_id || sessionId
        if (!id) throw new Error('Missing saved session')
        const session = await supabase.from('sessions').select('*').eq('id', id).is('deleted_at', null).abortSignal(controller.signal).single()
        if (session.error) throw session.error
        const value = savedBookingSummary(session.data, order)
        if (!value) throw new Error('Incomplete booking')
        if (!controller.signal.aborted) setSnapshot(value)
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    })()
    return () => { controller.abort(); if (previousFocus instanceof HTMLElement) previousFocus.focus() }
  }, [sessionId, orderId])
  const venueName = snapshot?.booking.venueKey === 'cafe-des-stagiaires' ? uiText[language].bookingVenueCafeName : uiText[language].bookingVenueHaDoName
  return <dialog ref={dialog} className="calendar-booking-dialog staff-saved-share-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose() }}>
    <div className="calendar-dialog-heading"><h2>{title}</h2><button className="calendar-dialog-close" type="button" aria-label={language === 'vi' ? 'Đóng' : 'Close'} onClick={onClose}><X size={20} /></button></div>
    {failed ? <p role="alert">{language === 'vi' ? 'Không thể tải bản đặt chỗ để chia sẻ. Kiểm tra thông tin đặt chỗ đã lưu rồi thử lại.' : 'Unable to load this booking for sharing. Check the saved booking details and try again.'}</p> : !snapshot ? <p role="status">{language === 'vi' ? 'Đang tải đặt chỗ…' : 'Loading booking…'}</p> : <>
      <StaffBookingShareButton contentRef={content} snapshotKey={JSON.stringify([snapshot, language])} date={snapshot.booking.date} language={language} />
      <StaffBookingSummary contentRef={content} booking={snapshot.booking} quote={snapshot.quote} venueName={venueName} language={language} text={staffConsoleText[language]} confirmedOrderNumber={snapshot.orderNumber || undefined} />
    </>}
  </dialog>
}
