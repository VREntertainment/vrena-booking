'use client'

import { getSupabase } from '../../lib/booking/client'
import {
  canUseWebPush,
  downloadSessionCalendarFile,
  notifyBookingInvite,
  notifyBookingSession,
  registerReminderServiceWorker,
  requestBrowserReminderPermission,
  urlBase64ToUint8Array
} from '../../lib/bookingBrowserActions'
import {
  Session
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { VAPID_PUBLIC_KEY } from './shared'

export type RemindersActionContext = {
  language: import("../../lib/i18n/languages").LanguageCode
  invitationReceivedText: string
  requireProfile: () => boolean
  setPushReminderStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
  setIsEnablingPush: React.Dispatch<React.SetStateAction<boolean>>
  userId: string
  setIsPushSubscribed: React.Dispatch<React.SetStateAction<boolean>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingRemindersActions(getContext: () => RemindersActionContext) {
  function notifySession(session: Session, message: string) {
    const { language } = getContext()

    notifyBookingSession(session, message, language)
  }

  function notifyInvite(session: Session) {
    const { invitationReceivedText, language } = getContext()

    notifyBookingInvite(session, invitationReceivedText, language)
  }

  async function enablePushReminders() {
    const { requireProfile, setPushReminderStatus, text, setIsEnablingPush, userId, setIsPushSubscribed } = getContext()

    if (!requireProfile()) return false
    if (!VAPID_PUBLIC_KEY) {
      setPushReminderStatus(text.pushMissingConfig)
      return false
    }
    if (!canUseWebPush()) {
      setPushReminderStatus(text.pushUnsupported)
      return false
    }

    setIsEnablingPush(true)
    setPushReminderStatus('')

    try {
      const hasPermission = await requestBrowserReminderPermission()
      if (!hasPermission) {
        setPushReminderStatus(text.pushPermissionDenied)
        setIsEnablingPush(false)
        return false
      }

      const registration = await registerReminderServiceWorker()
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const serialized = subscription.toJSON()
      const keys = serialized.keys || {}
      if (!keys.p256dh || !keys.auth) {
        setPushReminderStatus(text.pushSaveError)
        setIsEnablingPush(false)
        return false
      }

      const { error } = await (await getSupabase())
        .from('push_subscriptions')
        .upsert({
          profile_id: userId,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent,
          disabled_at: null,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' })

      if (error) {
        setPushReminderStatus(error.message)
        setIsEnablingPush(false)
        return false
      }

      setIsPushSubscribed(true)
      setPushReminderStatus(text.pushEnabled)
      setIsEnablingPush(false)
      return true
    } catch (error) {
      setPushReminderStatus(error instanceof Error ? error.message : text.pushSaveError)
      setIsEnablingPush(false)
      return false
    }
  }

  async function scheduleReturnReminder() {
    const { text } = getContext()

    const hasPermission = await enablePushReminders()
    if (!hasPermission) {
      return { ok: false, message: text.pushSaveError }
    }

    const client = await getSupabase()
    const { data: { session } } = await client.auth.getSession()
    if (!session?.access_token) {
      return { ok: false, message: text.pushSaveError }
    }

    const response = await fetch('/api/profile/return-reminder', {
      headers: {
        authorization: `Bearer ${session.access_token}`,
      },
      method: 'POST',
    })
    const payload = await response.json().catch(() => ({})) as { error?: string; scheduledFor?: string }
    if (!response.ok || !payload.scheduledFor) {
      return { ok: false, message: payload.error || text.pushSaveError }
    }

    return { ok: true, scheduledFor: payload.scheduledFor }
  }

  async function prepareJoinedSessionReminders(session: Session) {
    const { text } = getContext()

    downloadSessionCalendar(session)
    const hasPermission = await enablePushReminders()
    if (hasPermission) notifySession(session, text.reminderJoined)
  }

  return { notifySession, notifyInvite, enablePushReminders, scheduleReturnReminder, downloadSessionCalendar, prepareJoinedSessionReminders }
}

export function downloadSessionCalendar(session: Session) {
  downloadSessionCalendarFile(session)
}
