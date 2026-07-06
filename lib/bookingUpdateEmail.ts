import type { BookingUpdateEmailChange, BookingUpdateEmailPayload } from './bookingUpdateEmailTypes'

const DEFAULT_TO_EMAIL = 'contact@vre-vietnam.com'
const DEFAULT_FROM_EMAIL = 'VRena Booking <bookings@vre-vietnam.com>'

function cleanText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function valueText(value: unknown) {
  const text = cleanText(value)
  return text || '-'
}

function formatVnd(value: number | null | undefined) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return `${amount.toLocaleString('vi-VN')} đ`
}

function changeLine(change: BookingUpdateEmailChange) {
  return `- ${change.label}: ${valueText(change.before)} -> ${valueText(change.after)}`
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

function buildBody(payload: BookingUpdateEmailPayload & { actorEmail?: string | null }) {
  const lines = [
    payload.action === 'created' ? 'New booking notice' : 'Existing booking update',
    '',
    payload.action === 'created'
      ? 'This VRena booking was created by a player account that needs staff attention.'
      : 'This is an update to an existing VRena booking. It is not a new booking confirmation.',
    '',
    `Action: ${subjectAction(payload.action)}`,
    `Booking type: ${bookingKindLabel(payload.bookingKind)}`,
    `Title: ${valueText(payload.title)}`,
    `Reference: ${valueText(payload.reference)}`,
    `Date/time: ${[payload.date, payload.time].map(cleanText).filter(Boolean).join(' ') || '-'}`,
    `Customer: ${[payload.customerName, payload.customerPhone, payload.customerEmail].map(cleanText).filter(Boolean).join(' | ') || '-'}`,
    `Total: ${formatVnd(payload.total) || '-'}`,
    `Source: ${valueText(payload.source)}`,
    `Updated by: ${valueText(payload.actorEmail)}`,
  ]

  if (payload.minorWarning) {
    lines.splice(3, 0, cleanText(payload.minorWarning), '')
  }

  if (payload.summary) {
    lines.push('', 'Summary:', cleanText(payload.summary))
  }

  const changes = (payload.changes || []).filter((change) => cleanText(change.label))
  if (changes.length > 0) {
    lines.push('', 'Changes:', ...changes.map(changeLine))
  }

  lines.push('', 'Identifiers:')
  if (payload.sessionId) lines.push(`- Session ID: ${payload.sessionId}`)
  if (payload.orderId) lines.push(`- Order ID: ${payload.orderId}`)

  return lines.join('\n')
}

export async function sendBookingUpdateEmail(payload: BookingUpdateEmailPayload & { actorEmail?: string | null }) {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.BOOKING_UPDATE_EMAIL_TO || DEFAULT_TO_EMAIL
  const from = process.env.BOOKING_UPDATE_EMAIL_FROM
    || process.env.BOOKING_EMAIL_FROM
    || process.env.RESEND_FROM_EMAIL
    || DEFAULT_FROM_EMAIL

  if (!apiKey) {
    console.warn('Booking update email skipped: RESEND_API_KEY is not configured.')
    return { sent: false, skipped: true }
  }

  const kind = bookingKindLabel(payload.bookingKind)
  const reference = cleanText(payload.reference)
  const title = cleanText(payload.title)
  const dateTime = [payload.date, payload.time].map(cleanText).filter(Boolean).join(' ')
  const subjectParts = [
    '[VRena booking update]',
    subjectAction(payload.action),
    reference || title || kind,
    dateTime,
  ].filter(Boolean)
  const text = buildBody(payload)
  const escapedMinorWarning = payload.minorWarning
    ? cleanText(payload.minorWarning).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : ''
  const htmlBody = text
    .split('\n')
    .map((line) => line ? line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '<br>')
    .join('<br>')
  const html = escapedMinorWarning
    ? htmlBody.replace(escapedMinorWarning, `<span style="color:#b00020;font-weight:800">${escapedMinorWarning}</span>`)
    : htmlBody

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
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
