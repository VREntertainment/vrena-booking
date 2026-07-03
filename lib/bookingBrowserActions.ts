import { formatShortDate, icsDate, icsText, sessionEndDate, sessionStartDate } from './bookingWidgetDomain'
import type { LanguageCode } from './i18n/languages'

type CalendarSession = {
  id: string
  name: string
  date: string
  start_time: string
  duration_minutes: number
  notes?: string | null
}

export async function shareBookingLink({
  key,
  title,
  path = '',
  linkCopiedText,
  onCreateStatus,
  onSharedKey,
}: {
  key: string
  title: string
  path?: string
  linkCopiedText: string
  onCreateStatus: (status: string) => void
  onSharedKey: (updater: string | ((current: string) => string)) => void
}) {
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}${path}`

  try {
    if (navigator.share) {
      await navigator.share({ title, text: title, url })
    } else {
      await navigator.clipboard?.writeText(url)
    }
    onSharedKey(key)
    onCreateStatus(linkCopiedText)
    window.setTimeout(() => onSharedKey((current) => (current === key ? '' : current)), 1400)
  } catch {
    // Native share is often cancelled by users; no error message needed.
  }
}

export function notifyBookingSession(session: CalendarSession, message: string, language: LanguageCode) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

  new Notification('VRena', {
    body: `${message}: ${session.name} · ${formatShortDate(session.date, language)} ${session.start_time.slice(0, 5)}`,
    tag: `vrena-${session.id}-${message}`,
  })
}

export function notifyBookingInvite(session: CalendarSession, invitationReceivedText: string, language: LanguageCode) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

  new Notification('VRena', {
    body: `${invitationReceivedText}: ${session.name} · ${formatShortDate(session.date, language)} ${session.start_time.slice(0, 5)}`,
    tag: `vrena-invite-${session.id}`,
  })
}

export async function requestBrowserReminderPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  return (await Notification.requestPermission()) === 'granted'
}

export function canUseWebPush() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

export function registerReminderServiceWorker() {
  return navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  })
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}

export function downloadSessionCalendarFile(session: CalendarSession) {
  if (typeof window === 'undefined') return

  const start = sessionStartDate(session)
  const end = sessionEndDate(session)
  const title = icsText(`VRena: ${session.name}`)
  const description = icsText(session.notes || 'VRena session')
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VRena//Booking//EN',
    'BEGIN:VEVENT',
    `UID:vrena-${session.id}@vrena-booking`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${session.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'vrena-session'}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
