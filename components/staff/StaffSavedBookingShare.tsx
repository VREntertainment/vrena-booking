'use client'

import { useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'
import { supabase } from '../../lib/supabase/client'
import { ShareLanguageButton } from '../ShareLanguageButton'
import { BookingShareOptions } from './StaffBookingShareButton'
import { savedBookingSummary } from '../../lib/staff/bookingSummary'

export function StaffSavedBookingShare({ sessionId, orderId, language, disabled = false }: {
  sessionId?: string | null; orderId?: string; language: 'en' | 'vi'; disabled?: boolean
}) {
  return <ShareLanguageButton className="secondary" language={language} disabled={disabled}
    renderOptions={(close) => <SavedBookingShareOptions sessionId={sessionId} orderId={orderId} language={language} close={close} />}>
    <Share2 size={16} aria-hidden="true" /> {language === 'vi' ? 'Chia sẻ' : 'Share'}
  </ShareLanguageButton>
}

function SavedBookingShareOptions({ sessionId, orderId, language, close }: {
  sessionId?: string | null; orderId?: string; language: 'en' | 'vi'; close: () => void
}) {
  const [snapshot, setSnapshot] = useState<ReturnType<typeof savedBookingSummary>>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
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
    return () => controller.abort()
  }, [sessionId, orderId])
  if (failed) return <p role="alert">{language === 'vi' ? 'Không thể tải đặt chỗ. Đóng và thử lại.' : 'Unable to load booking. Close and try again.'}</p>
  if (!snapshot) return <p role="status">{language === 'vi' ? 'Đang tải đặt chỗ…' : 'Loading booking…'}</p>
  return <BookingShareOptions details={snapshot} language={language} close={close} />
}
