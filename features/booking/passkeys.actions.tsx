'use client'

import { getSupabase } from '../../lib/booking/client'
import { passkeysAvailable } from '../../lib/hcaptcha'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { requiresStaffKioskPin } from '../../lib/staffKioskScope'

export type PasskeysActionContext = {
  setProfileStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
  setIsPasskeyLoading: React.Dispatch<React.SetStateAction<boolean>>
  restorePasskeyDocumentFocus: () => Promise<void>
  warmedSupabaseClientRef: React.RefObject<Awaited<ReturnType<typeof import("../../lib/booking/client").getSupabase>> | null>
  setUserId: React.Dispatch<React.SetStateAction<string>>
  prepareMfaChallengeIfNeeded: () => Promise<boolean>
  loadProfile: (options?: { skipMfaChallenge?: boolean; showAuthLoading?: boolean }) => Promise<import("../../lib/bookingWidgetDomain").Profile | null>
  completePendingTicketAuth: (activeProfile: import("../../lib/bookingWidgetDomain").Profile | null) => Promise<boolean>
  setActiveView: React.Dispatch<React.SetStateAction<import("../../components/AppSidebar").AppView>>
  profile: import("../../lib/bookingWidgetDomain").Profile | null
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingPasskeysActions(getContext: () => PasskeysActionContext) {
  function isDocumentFocusPasskeyError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '')
    return message.toLowerCase().includes('document is not focused')
  }

  async function signInWithPasskey() {
    const {
      setProfileStatus,
      text,
      setIsPasskeyLoading,
      restorePasskeyDocumentFocus,
      warmedSupabaseClientRef,
      setUserId,
      prepareMfaChallengeIfNeeded,
      loadProfile,
      completePendingTicketAuth,
      setActiveView,
    } = getContext()

    if (!passkeysAvailable()) {
      setProfileStatus(text.passkeyUnavailable)
      return
    }

    try {
      setIsPasskeyLoading(true)
      setProfileStatus(text.passkeyStarting)
      await restorePasskeyDocumentFocus()

      const client = warmedSupabaseClientRef.current || await getSupabase()
      warmedSupabaseClientRef.current = client
      let { data, error } = await client.auth.signInWithPasskey()

      if (error && isDocumentFocusPasskeyError(error)) {
        await restorePasskeyDocumentFocus()
        const retryResult = await client.auth.signInWithPasskey()
        data = retryResult.data
        error = retryResult.error
      }

      if (error) {
        setProfileStatus(error.message)
        setIsPasskeyLoading(false)
        return
      }

      if (!data) {
        setProfileStatus(text.passkeyUnavailable)
        setIsPasskeyLoading(false)
        return
      }

      const nextUserId = data.user?.id || data.session?.user.id || ''
      if (nextUserId) setUserId(nextUserId)
      const needsMfa = await prepareMfaChallengeIfNeeded()
      if (needsMfa) {
        setIsPasskeyLoading(false)
        return
      }
      const loadedProfile = await loadProfile()
      const completedTicketAuth = await completePendingTicketAuth(loadedProfile)
      if (!completedTicketAuth) {
        setProfileStatus('')
        const loginEmail = data.user?.email || data.session?.user.email || ''
        setActiveView(requiresStaffKioskPin(loginEmail) ? 'staff' : 'leaderboard')
      }
      setIsPasskeyLoading(false)
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsPasskeyLoading(false)
    }
  }

  async function registerPasskey() {
    const { profile, setProfileStatus, text, setIsPasskeyLoading } = getContext()

    if (!profile) return

    if (!passkeysAvailable()) {
      setProfileStatus(text.passkeyUnavailable)
      return
    }

    try {
      setIsPasskeyLoading(true)
      setProfileStatus(text.passkeyStarting)
      const { error } = await (await getSupabase()).auth.registerPasskey()

      if (error) {
        setProfileStatus(error.message)
        setIsPasskeyLoading(false)
        return
      }

      setProfileStatus(text.passkeyAdded)
      setIsPasskeyLoading(false)
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsPasskeyLoading(false)
    }
  }

  return { isDocumentFocusPasskeyError, signInWithPasskey, registerPasskey }
}
