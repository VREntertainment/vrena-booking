'use client'

import {
  useState
} from 'react'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingRemindersState() {
  const [pushReminderStatus, setPushReminderStatus] = useState('')
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)
  const [isEnablingPush, setIsEnablingPush] = useState(false)
  return { pushReminderStatus, setPushReminderStatus, isPushSubscribed, setIsPushSubscribed, isEnablingPush, setIsEnablingPush }
}
