'use client'

import { getSupabase } from '../../lib/booking/client'
import {
  appRedirectUrl,
  cleanPasswordRecoveryUrl,
  passwordRecoveryUrlParams
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'

export type RecoveryActionContext = {
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  profileEmail: string
  setProfileStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
  currentCaptchaToken: () => string
  setIsResettingPassword: React.Dispatch<React.SetStateAction<boolean>>
  resetCaptcha: () => void
  setActiveView: React.Dispatch<React.SetStateAction<import("../../components/AppSidebar").AppView>>
  setAuthMode: React.Dispatch<React.SetStateAction<import("../../components/ProfileAuthView").AuthMode>>
  setAuthStep: React.Dispatch<React.SetStateAction<"email" | "credentials">>
  setIsRecoveryMode: React.Dispatch<React.SetStateAction<boolean>>
  setUserId: React.Dispatch<React.SetStateAction<string>>
  setProfileEmail: React.Dispatch<React.SetStateAction<string>>
  newPassword: string
  setNewPassword: React.Dispatch<React.SetStateAction<string>>
  loadProfile: (options?: { skipMfaChallenge?: boolean; showAuthLoading?: boolean }) => Promise<import("../../lib/bookingWidgetDomain").Profile | null>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingRecoveryActions(getContext: () => RecoveryActionContext) {
  async function sendPasswordReset() {
    const { profile, profileEmail, setProfileStatus, text, currentCaptchaToken, setIsResettingPassword, resetCaptcha } = getContext()

    const email = (profile?.email || profileEmail).trim().toLowerCase()

    if (!email || !email.includes('@')) {
      setProfileStatus(text.resetPasswordEmailRequired)
      return
    }

    const captchaTokenForReset = profile ? '' : currentCaptchaToken()

    if (!profile && !captchaTokenForReset) {
      setProfileStatus(text.captchaRequired)
      return
    }

    setIsResettingPassword(true)
    const redirectTo = appRedirectUrl()
    const supabase = await getSupabase()
    const { data: sessionData } = await supabase.auth.getSession()
    const response = await fetch('/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify({
        email,
        redirectTo,
        captchaToken: captchaTokenForReset || undefined,
      }),
    })
    const resetResult = (await response.json().catch(() => ({}))) as { error?: string }

    resetCaptcha()

    if (!response.ok) {
      setProfileStatus(resetResult.error || 'Could not send password reset email.')
      setIsResettingPassword(false)
      return
    }

    setProfileStatus(text.resetPasswordSent)
    setIsResettingPassword(false)
  }

  async function preparePasswordRecoveryFromUrl() {
    const { setActiveView, setAuthMode, setAuthStep, setIsRecoveryMode, setProfileStatus, text, setUserId, setProfileEmail, profileEmail } = getContext()

    const recoveryParams = passwordRecoveryUrlParams()
    if (!recoveryParams) return null

    setActiveView('profile')
    setAuthMode('login')
    setAuthStep('email')

    if (recoveryParams.errorDescription) {
      setIsRecoveryMode(false)
      setProfileStatus(recoveryParams.errorDescription)
      cleanPasswordRecoveryUrl()
      return false
    }

    const client = await getSupabase()

    if (recoveryParams.accessToken && recoveryParams.refreshToken) {
      const { error } = await client.auth.setSession({
        access_token: recoveryParams.accessToken,
        refresh_token: recoveryParams.refreshToken,
      })

      if (error) {
        setIsRecoveryMode(false)
        setProfileStatus(error.message)
        cleanPasswordRecoveryUrl()
        return false
      }
    } else if (recoveryParams.code) {
      const { error } = await client.auth.exchangeCodeForSession(recoveryParams.code)

      if (error) {
        setIsRecoveryMode(false)
        setProfileStatus(error.message)
        cleanPasswordRecoveryUrl()
        return false
      }
    } else if (!recoveryParams.code) {
      setIsRecoveryMode(false)
      setProfileStatus(text.resetPasswordSessionRequired)
      cleanPasswordRecoveryUrl()
      return false
    }

    const { data, error } = await client.auth.getSession()
    cleanPasswordRecoveryUrl()

    if (error || !data.session) {
      setIsRecoveryMode(false)
      setProfileStatus(!data.session ? text.resetPasswordSessionRequired : error?.message || text.resetPasswordSessionRequired)
      return false
    }

    setUserId(data.session.user.id)
    setProfileEmail(data.session.user.email || profileEmail)
    setIsRecoveryMode(true)
    setProfileStatus(text.resetPasswordReady)
    return true
  }

  async function updatePasswordFromRecovery() {
    const { newPassword, setProfileStatus, text, setIsResettingPassword, setNewPassword, setIsRecoveryMode, loadProfile } = getContext()

    if (newPassword.length < 6) {
      setProfileStatus(text.passwordRequired)
      return
    }

    setIsResettingPassword(true)
    const client = await getSupabase()
    const { data: sessionData, error: sessionError } = await client.auth.getSession()

    if (sessionError || !sessionData.session) {
      setProfileStatus(!sessionData.session ? text.resetPasswordSessionRequired : sessionError?.message || text.resetPasswordSessionRequired)
      setIsResettingPassword(false)
      return
    }

    const { error } = await client.auth.updateUser({ password: newPassword })

    if (error) {
      setProfileStatus(error.message)
      setIsResettingPassword(false)
      return
    }

    setNewPassword('')
    setIsRecoveryMode(false)
    setProfileStatus(text.passwordUpdated)
    await loadProfile()
    setIsResettingPassword(false)
  }

  return { sendPasswordReset, preparePasswordRecoveryFromUrl, updatePasswordFromRecovery }
}
