'use client'

import { ageBandFromBirthday } from '../../lib/agePolicy'
import { getSupabase } from '../../lib/booking/client'
import {
  appRedirectUrl,
  authDebug,
  compactDisplayName,
  limitDisplayName,
  resolveCountryCode
} from '../../lib/bookingWidgetDomain'
import { getHCaptcha } from '../../lib/hcaptcha'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { isPendingPhoneAccountSetup, normalizePhoneSetupEmail } from '../../lib/phoneAccountSetup'
import { normalizePhonePasswordIdentifier } from '../../lib/phonePasswordAccount'
import { requiresStaffKioskPin } from '../../lib/staffKioskScope'
import { isStaffAdminEmail as isAdminEmail } from '../../lib/staffRoles'
import { CONSENT_WAIVER_URL, LEGAL_CONSENT_VERSION, PRIVACY_POLICY_URL, TERMS_CONDITIONS_URL } from './shared'

export type AuthCredentialsActionContext = {
  captchaTokenRef: React.RefObject<string>
  setCaptchaToken: React.Dispatch<React.SetStateAction<string>>
  captchaToken: string
  captchaWidgetId: React.RefObject<string | null>
  warmedSupabaseClientRef: React.RefObject<Awaited<ReturnType<typeof import("../../lib/booking/client").getSupabase>> | null>
  passkeyButtonRef: React.RefObject<HTMLButtonElement | null>
  setAuthMode: React.Dispatch<React.SetStateAction<import("../../components/ProfileAuthView").AuthMode>>
  setAuthStep: React.Dispatch<React.SetStateAction<"email" | "credentials">>
  setProfilePassword: React.Dispatch<React.SetStateAction<string>>
  setProfileStatus: React.Dispatch<React.SetStateAction<string>>
  profileEmail: string
  authMode: import("../../components/ProfileAuthView").AuthMode
  text: TranslationMap
  setProfileEmail: React.Dispatch<React.SetStateAction<string>>
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  isRecoveryMode: boolean
  authStep: "email" | "credentials"
  profilePhone: string
  profileName: string
  profilePassword: string
  profileBirthday: string
  personalDataConsent: boolean
  setIsSavingProfile: React.Dispatch<React.SetStateAction<boolean>>
  profileNickname: string
  profileCountryCode: string
  profileGender: "" | "female" | "male" | "non_binary" | "prefer_not_to_say" | "self_describe"
  marketingConsent: boolean
  setUserId: React.Dispatch<React.SetStateAction<string>>
  setPersonalDataConsent: React.Dispatch<React.SetStateAction<boolean>>
  loadProfile: (options?: { skipMfaChallenge?: boolean; showAuthLoading?: boolean }) => Promise<import("../../lib/bookingWidgetDomain").Profile | null>
  completePendingTicketAuth: (activeProfile: import("../../lib/bookingWidgetDomain").Profile | null) => Promise<boolean>
  setActiveView: React.Dispatch<React.SetStateAction<import("../../components/AppSidebar").AppView>>
  prepareMfaChallengeIfNeeded: () => Promise<boolean>
  isPhoneSetupSaving: boolean
  phoneSetupEmail: string
  setIsPhoneSetupSaving: React.Dispatch<React.SetStateAction<boolean>>
  setPhoneSetupEmail: React.Dispatch<React.SetStateAction<string>>
  setPhoneSetupSentTo: React.Dispatch<React.SetStateAction<string>>
  setIsOAuthLoading: React.Dispatch<React.SetStateAction<boolean>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingAuthCredentialsActions(getContext: () => AuthCredentialsActionContext) {
  function updateCaptchaToken(token: string) {
    return updateCaptchaTokenState(getContext(), token)
  }

  function currentCaptchaToken() {
    const { captchaToken, captchaTokenRef, captchaWidgetId } = getContext()

    const tokenFromState = captchaToken || captchaTokenRef.current
    if (tokenFromState) return tokenFromState

    const hcaptcha = getHCaptcha()
    const widgetId = captchaWidgetId.current || undefined
    const tokenFromWidget = hcaptcha?.getResponse?.(widgetId)

    if (tokenFromWidget) {
      updateCaptchaToken(tokenFromWidget)
      return tokenFromWidget
    }

    return ''
  }

  function resetCaptcha() {
    const { captchaWidgetId } = getContext()

    updateCaptchaToken('')

    const hcaptcha = getHCaptcha()

    if (hcaptcha && captchaWidgetId.current) {
      hcaptcha.reset(captchaWidgetId.current)
    }
  }

  function warmSupabaseClient() {
    return warmSupabaseClientState(getContext())
  }

  function focusPasskeyDocument() {
    const { passkeyButtonRef } = getContext()

    if (typeof window === 'undefined' || typeof document === 'undefined') return true

    window.focus()
    passkeyButtonRef.current?.focus({ preventScroll: true })

    return document.hasFocus()
  }

  async function restorePasskeyDocumentFocus() {
    if (focusPasskeyDocument()) return

    await new Promise<void>((resolve) => {
      let settled = false
      let timeoutId: number | null = null
      const settle = () => {
        if (settled) return
        settled = true
        if (timeoutId) window.clearTimeout(timeoutId)
        window.removeEventListener('focus', settle)
        document.removeEventListener('visibilitychange', settle)
        resolve()
      }

      window.addEventListener('focus', settle, { once: true })
      document.addEventListener('visibilitychange', settle, { once: true })
      timeoutId = window.setTimeout(settle, 800)
    })

    focusPasskeyDocument()
  }

  function updateAuthMode(nextMode: 'login' | 'create') {
    const { setAuthMode, setAuthStep, setProfilePassword, setProfileStatus } = getContext()

    setAuthMode(nextMode)
    setAuthStep('email')
    setProfilePassword('')
    setProfileStatus('')
    resetCaptcha()
  }

  function continueAuthFromEmail() {
    const { profileEmail, authMode, setProfileStatus, text, setProfileEmail, setAuthStep } = getContext()

    const submittedIdentifier = profileEmail.trim()
    const loginEmail = submittedIdentifier.toLowerCase()
    const loginPhone = authMode === 'login' && !loginEmail.includes('@')
      ? normalizePhonePasswordIdentifier(submittedIdentifier)
      : ''

    if (authMode === 'login' ? (!loginEmail.includes('@') && !loginPhone) : (!loginEmail || !loginEmail.includes('@'))) {
      setProfileStatus(authMode === 'login' ? text.emailOrPhoneRequired : text.emailRequired)
      return
    }

    setProfileEmail(loginPhone || loginEmail)
    setProfileStatus('')
    resetCaptcha()
    setAuthStep('credentials')
  }

  function editAuthEmail() {
    const { setAuthStep, setProfilePassword, setProfileStatus } = getContext()

    setAuthStep('email')
    setProfilePassword('')
    setProfileStatus('')
    resetCaptcha()
  }

  async function handleAuth() {
    const {
      profile,
      isRecoveryMode,
      authMode,
      authStep,
      profilePhone,
      profileEmail,
      profileName,
      setProfileStatus,
      text,
      profilePassword,
      profileBirthday,
      personalDataConsent,
      setIsSavingProfile,
      profileNickname,
      profileCountryCode,
      profileGender,
      marketingConsent,
      setAuthMode,
      setAuthStep,
      setUserId,
      setPersonalDataConsent,
      setProfilePassword,
      loadProfile,
      completePendingTicketAuth,
      setActiveView,
      prepareMfaChallengeIfNeeded,
    } = getContext()

    try {
      if (!profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'email') {
        continueAuthFromEmail()
        return
      }

      const localPhone = profilePhone.replace(/\D/g, '')
      const submittedIdentifier = profileEmail.trim()
      const phoneLogin = authMode === 'login' && !submittedIdentifier.includes('@')
      const loginPhone = phoneLogin ? normalizePhonePasswordIdentifier(submittedIdentifier) : ''
      const loginEmail = phoneLogin ? '' : submittedIdentifier.toLowerCase()
      const fullName = profileName.trim()

      authDebug('handleAuth:attempt', {
        mode: authMode,
        identifierType: phoneLogin ? 'phone' : 'email',
        isAdminEmail: isAdminEmail(loginEmail),
        hasCaptcha: Boolean(currentCaptchaToken()),
        localPhoneLength: localPhone.length,
        hasFullName: Boolean(fullName),
      })

      if (phoneLogin ? !loginPhone : (!loginEmail || !loginEmail.includes('@'))) {
        setProfileStatus(authMode === 'login' ? text.emailOrPhoneRequired : text.emailRequired)
        return
      }

      if (profilePassword.length < 6) {
        setProfileStatus(text.passwordRequired)
        return
      }

      const signupAgeBand = ageBandFromBirthday(profileBirthday)

      if (authMode === 'create' && signupAgeBand === 'unknown') {
        setProfileStatus(text.birthdayRequired)
        return
      }

      if (authMode === 'create' && signupAgeBand === 'adult' && !personalDataConsent) {
        setProfileStatus(text.consentRequired)
        return
      }

      const captchaTokenForAuth = authMode === 'create' || authMode === 'login' ? currentCaptchaToken() : ''

      if ((authMode === 'create' || authMode === 'login') && !captchaTokenForAuth) {
        setProfileStatus(text.captchaRequired)
        return
      }

      setIsSavingProfile(true)
      setProfileStatus(authMode === 'login' ? text.loggingIn : text.creating)

      const nickname = limitDisplayName(profileNickname.trim())
      const display = nickname || compactDisplayName(fullName || loginEmail.split('@')[0])
      const consentAt = new Date().toISOString()
      const countryCode = resolveCountryCode(profileCountryCode)
      const normalizedProfilePhone = localPhone ? `${countryCode}${localPhone}` : ''
      const legalConsentAccepted = authMode === 'create' && signupAgeBand === 'adult' && personalDataConsent

      if (authMode === 'create') {
        const signUpResult = await (await getSupabase()).auth.signUp({
          email: loginEmail,
          password: profilePassword,
          options: {
            data: {
              display_name: display,
              full_name: fullName || display,
              name: display,
              phone: normalizedProfilePhone || null,
              birthday: profileBirthday || null,
              gender: signupAgeBand === 'under13' ? null : profileGender || null,
              marketing_consent: marketingConsent,
              marketing_consent_at: marketingConsent ? consentAt : null,
              marketing_opted_out_at: marketingConsent ? null : consentAt,
              personal_data_consent: legalConsentAccepted,
              personal_data_consent_at: legalConsentAccepted ? consentAt : null,
              privacy_policy_url: PRIVACY_POLICY_URL,
              terms_conditions_url: TERMS_CONDITIONS_URL,
              consent_waiver_url: CONSENT_WAIVER_URL,
              legal_consent_version: LEGAL_CONSENT_VERSION,
            },
            captchaToken: captchaTokenForAuth,
          },
        })

        authDebug('handleAuth:signUpResponse', {
          error: signUpResult.error,
          hasSession: Boolean(signUpResult.data.session),
          user: signUpResult.data.user ? {
            id: signUpResult.data.user.id,
            email: signUpResult.data.user.email,
            emailConfirmedAt: signUpResult.data.user.email_confirmed_at,
            appMetadata: signUpResult.data.user.app_metadata,
            userMetadata: signUpResult.data.user.user_metadata,
          } : null,
        })

        resetCaptcha()

        if (signUpResult.error) {
          setProfileStatus(signUpResult.error.message)
          setIsSavingProfile(false)
          return
        }

        if (!signUpResult.data.user) {
          setProfileStatus(text.loginRequired)
          setAuthMode('login')
          setAuthStep('credentials')
          setIsSavingProfile(false)
          return
        }

        setUserId(signUpResult.data.user.id)
        setPersonalDataConsent(false)
        setProfilePassword('')
        const loadedProfile = await loadProfile()
        const completedTicketAuth = await completePendingTicketAuth(loadedProfile)
        if (!completedTicketAuth) {
          setProfileStatus(text.accountCreated)
          setActiveView('profile')
        }
        setIsSavingProfile(false)
        return
      }

      authDebug('handleAuth:signInWithPassword:start', {
        identifierType: phoneLogin ? 'phone' : 'email',
        isAdminEmail: isAdminEmail(loginEmail),
      })

      const authClient = await getSupabase()
      const signInResult = phoneLogin
        ? await (async () => {
          const response = await fetch('/api/auth/phone-password-login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              captchaToken: captchaTokenForAuth,
              password: profilePassword,
              phone: loginPhone,
            }),
          })
          const payload = await response.json().catch(() => ({})) as {
            accessToken?: string
            error?: string
            refreshToken?: string
          }
          if (!response.ok || !payload.accessToken || !payload.refreshToken) {
            throw new Error(payload.error || 'Invalid phone number or password.')
          }
          return authClient.auth.setSession({
            access_token: payload.accessToken,
            refresh_token: payload.refreshToken,
          })
        })()
        : await authClient.auth.signInWithPassword({
          email: loginEmail,
          password: profilePassword,
          options: { captchaToken: captchaTokenForAuth },
        })

      authDebug('handleAuth:signInWithPassword:response', {
        error: signInResult.error,
        hasSession: Boolean(signInResult.data.session),
        user: signInResult.data.user ? {
          id: signInResult.data.user.id,
          email: signInResult.data.user.email,
          emailConfirmedAt: signInResult.data.user.email_confirmed_at,
          lastSignInAt: signInResult.data.user.last_sign_in_at,
          appMetadata: signInResult.data.user.app_metadata,
          userMetadata: signInResult.data.user.user_metadata,
        } : null,
      })

      resetCaptcha()

      if (signInResult.error) {
        setProfileStatus(signInResult.error.message)
        setIsSavingProfile(false)
        return
      }

      if (!signInResult.data.user) {
        setProfileStatus(text.loginRequired)
        setAuthMode('login')
        setAuthStep('credentials')
        setIsSavingProfile(false)
        return
      }

      setUserId(signInResult.data.user.id)
      setProfilePassword('')
      const requiresPhoneSetup = isPendingPhoneAccountSetup(signInResult.data.user.app_metadata)
      const needsMfa = await prepareMfaChallengeIfNeeded()
      if (needsMfa) {
        setIsSavingProfile(false)
        return
      }
      const loadedProfile = await loadProfile()
      if (requiresPhoneSetup) {
        setProfileStatus('')
        setActiveView('profile')
        setIsSavingProfile(false)
        return
      }
      const completedTicketAuth = await completePendingTicketAuth(loadedProfile)
      if (!completedTicketAuth) {
        setProfileStatus('')
        setActiveView(requiresStaffKioskPin(loginEmail) ? 'staff' : 'leaderboard')
      }
      setIsSavingProfile(false)
    } catch (error) {
      authDebug('handleAuth:thrown', error)
      resetCaptcha()
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsSavingProfile(false)
    }
  }

  async function sendPhoneSetupEmail() {
    const { isPhoneSetupSaving, phoneSetupEmail, setProfileStatus, text, setIsPhoneSetupSaving, setPhoneSetupEmail, setPhoneSetupSentTo } = getContext()

    if (isPhoneSetupSaving) return
    const email = normalizePhoneSetupEmail(phoneSetupEmail)
    if (!email) {
      setProfileStatus(text.emailRequired)
      return
    }

    setIsPhoneSetupSaving(true)
    setProfileStatus('')
    try {
      const client = await getSupabase()
      const { data, error } = await client.auth.getSession()
      if (error || !data.session?.access_token) throw new Error(text.loginRequired)

      const response = await fetch('/api/auth/phone-account-setup/start', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${data.session.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; maskedEmail?: string }
      if (!response.ok || !payload.maskedEmail) throw new Error(payload.error || 'Could not send the verification email.')

      setPhoneSetupEmail(email)
      setPhoneSetupSentTo(payload.maskedEmail)
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : 'Could not send the verification email.')
    } finally {
      setIsPhoneSetupSaving(false)
    }
  }

  async function signInWithGoogle() {
    const { setIsOAuthLoading, setProfileStatus, text } = getContext()

    try {
      setIsOAuthLoading(true)
      setProfileStatus(text.loggingIn)
      const { error } = await (await getSupabase()).auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appRedirectUrl(),
        },
      })

      if (error) {
        setProfileStatus(error.message)
        setIsOAuthLoading(false)
      }
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsOAuthLoading(false)
    }
  }

  return {
    updateCaptchaToken,
    currentCaptchaToken,
    resetCaptcha,
    warmSupabaseClient,
    focusPasskeyDocument,
    restorePasskeyDocumentFocus,
    updateAuthMode,
    continueAuthFromEmail,
    editAuthEmail,
    handleAuth,
    sendPhoneSetupEmail,
    signInWithGoogle,
  }
}

export function warmSupabaseClientState(context: Pick<AuthCredentialsActionContext, 'warmedSupabaseClientRef'>) {
  const { warmedSupabaseClientRef } = context

  void getSupabase().then((client) => {
    warmedSupabaseClientRef.current = client
  }).catch(() => { })
}

export function updateCaptchaTokenState(context: Pick<AuthCredentialsActionContext, 'captchaTokenRef' | 'setCaptchaToken'>, token: string) {
  const { captchaTokenRef, setCaptchaToken } = context

  captchaTokenRef.current = token
  setCaptchaToken(token)
}
