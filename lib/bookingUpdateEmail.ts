import type { BookingUpdateEmailPayload } from './bookingUpdateEmailTypes'
import { bookingMoney, bookingSourceLabel, bookingStatus, renderBookingEmail, type BookingEmailSnapshot } from './bookingEmailTemplate.ts'
import { bookingEmailRecipients, bookingEmailSender } from './bookingEmailRecipients'


function cleanText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function subjectAction(action: BookingUpdateEmailPayload['action']) {
  if (action === 'created') return 'Created'
  if (action === 'deleted') return 'Deleted'
  if (action === 'cancelled') return 'Cancelled'
  return 'Updated'
}

function bookingKindLabel(kind: BookingUpdateEmailPayload['bookingKind']) {
  return kind === 'ticket' ? 'ticket booking' : 'session booking'
}

export function buildBookingUpdateEmail(payload: BookingUpdateEmailPayload) {
  const current: BookingEmailSnapshot = {
    venue: payload.venueKey === 'cafe-des-stagiaires' ? 'VRena Thảo Điền' : 'VRena Hà Đô Centrosa',
    reference: cleanText(payload.reference).replace(/^CS-/, 'TD-'), status: bookingStatus(payload.status || (payload.action === 'cancelled' ? 'cancelled' : payload.action === 'deleted' ? 'deleted' : '')),
    date: cleanText(payload.date), time: cleanText(payload.time), players: String(payload.players ?? '—'), total: bookingMoney(payload.total),
    source: bookingSourceLabel(payload.source), customerName: cleanText(payload.customerName), customerPhone: cleanText(payload.customerPhone), customerEmail: cleanText(payload.customerEmail), notes: cleanText(payload.notes),
  }
  const previous: Partial<BookingEmailSnapshot> = {}
  const fields: Record<string, keyof BookingEmailSnapshot> = { Date: 'date', Time: 'time', Players: 'players', 'Total price': 'total', Total: 'total', 'Booking source': 'source', 'Customer name': 'customerName', Phone: 'customerPhone', Email: 'customerEmail', Notes: 'notes', Status: 'status' }
  for (const change of payload.changes || []) {
    const field = fields[change.label]
    if (field) previous[field] = field === 'total' ? bookingMoney(change.before) : field === 'source' ? bookingSourceLabel(change.before) : cleanText(change.before)
  }
  return renderBookingEmail(current, previous, payload.action, payload.minorWarning || '')
}

export async function sendBookingUpdateEmail(payload: BookingUpdateEmailPayload & { actorEmail?: string | null }) {
  const apiKey = process.env.RESEND_API_KEY
  const to = bookingEmailRecipients(payload.venueKey, payload.reference)
  const sender = bookingEmailSender(payload.venueKey, payload.reference)
  const from = sender.from

  if (!apiKey) {
    console.warn('Booking update email skipped: RESEND_API_KEY is not configured.')
    return { sent: false, skipped: true }
  }

  const kind = bookingKindLabel(payload.bookingKind)
  const reference = cleanText(payload.reference).replace(/^CS-/, 'TD-')
  const title = cleanText(payload.title)
  const dateTime = [payload.date, payload.time].map(cleanText).filter(Boolean).join(' ')
  const subjectParts = [
    '[VRena booking update]',
    subjectAction(payload.action),
    reference || title || kind,
    dateTime,
  ].filter(Boolean)
  const { text, html } = buildBookingUpdateEmail(payload)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      reply_to: sender.email,
      to,
      subject: subjectParts.join(' · '),
      text,
      html,
    }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || `Could not send booking update email (${response.status}).`)
  }

  return { sent: true, skipped: false }
}
