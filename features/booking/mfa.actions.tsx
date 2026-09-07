'use client'

import { getSupabase } from '../../lib/booking/client'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { isPhonePasswordLoginEmail } from '../../lib/phonePasswordAccount'

export type MfaActionContext = {
  setMfaStatus: React.Dispatch<React.SetStateAction<string>>
  setMfaFactors: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TotpFactor[]>>
  mfaChallenge: { factorId: string; challengeId: string } | null
  setMfaAssuranceLevel: React.Dispatch<React.SetStateAction<"aal1" | "aal2" | null>>
  text: TranslationMap
  setProfileStatus: React.Dispatch<React.SetStateAction<string>>
  setMfaChallenge: React.Dispatch<React.SetStateAction<{ factorId: string; challengeId: string } | null>>
  setMfaChallengeCode: React.Dispatch<React.SetStateAction<string>>
  setMfaRequired: React.Dispatch<React.SetStateAction<boolean>>
  setActiveView: React.Dispatch<React.SetStateAction<import("../../components/AppSidebar").AppView>>
  mfaChallengeCode: string
  mfaVerificationInFlightRef: React.RefObject<boolean>
  setIsMfaLoading: React.Dispatch<React.SetStateAction<boolean>>
  setUserId: React.Dispatch<React.SetStateAction<string>>
  setAuthEmail: React.Dispatch<React.SetStateAction<string>>
  loadProfile: (options?: { skipMfaChallenge?: boolean; showAuthLoading?: boolean }) => Promise<import("../../lib/bookingWidgetDomain").Profile | null>
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  setMfaVerifyCode: React.Dispatch<React.SetStateAction<string>>
  setMfaEnrollment: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TotpEnrollment | null>>
  mfaEnrollment: import("../../lib/bookingWidgetDomain").TotpEnrollment | null
  mfaVerifyCode: string
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingMfaActions(getContext: () => MfaActionContext) {
  async function refreshMfaFactors() {
    const { setMfaStatus, setMfaFactors } = getContext()

    const { data, error } = await (await getSupabase()).auth.mfa.listFactors()

    if (error) {
      setMfaStatus(error.message)
      return []
    }

    const factors = (data?.totp ?? [])
      .filter((factor) => Boolean(factor?.id))
      .map((factor) => ({
        id: factor.id,
        friendly_name: factor.friendly_name,
        factor_type: factor.factor_type,
        status: factor.status,
        created_at: factor.created_at,
        updated_at: factor.updated_at,
      }))
    setMfaFactors(factors)
    return factors
  }

  async function prepareMfaChallengeIfNeeded() {
    const {
      mfaChallenge,
      setMfaAssuranceLevel,
      setMfaStatus,
      text,
      setProfileStatus,
      setMfaChallenge,
      setMfaChallengeCode,
      setMfaRequired,
      setActiveView,
    } = getContext()

    if (mfaChallenge) return true

    const assurance = await (await getSupabase()).auth.mfa.getAuthenticatorAssuranceLevel()

    if (assurance.error) {
      setMfaAssuranceLevel(null)
      setMfaStatus(assurance.error.message)
      return false
    }

    setMfaAssuranceLevel(assurance.data?.currentLevel === 'aal2' ? 'aal2' : 'aal1')

    if (assurance.data?.currentLevel === 'aal1' && assurance.data.nextLevel === 'aal2') {
      const factors = await refreshMfaFactors()
      const factor = factors.find((item) => item.status === 'verified') || factors[0]

      if (!factor) {
        setMfaStatus(text.mfaChallengeError)
        setProfileStatus(text.mfaChallengeError)
        return false
      }

      const challenge = await (await getSupabase()).auth.mfa.challenge({ factorId: factor.id })

      if (challenge.error || !challenge.data) {
        setMfaStatus(challenge.error?.message || text.mfaChallengeError)
        setProfileStatus(challenge.error?.message || text.mfaChallengeError)
        return true
      }

      setMfaChallenge({ factorId: factor.id, challengeId: challenge.data.id })
      setMfaChallengeCode('')
      setMfaRequired(true)
      setActiveView('profile')
      setProfileStatus(text.mfaRequired)
      return true
    }

    setMfaChallenge(null)
    setMfaRequired(false)
    return false
  }

  async function verifyMfaChallenge(codeOverride?: string) {
    const {
      mfaChallengeCode,
      mfaChallenge,
      setProfileStatus,
      text,
      mfaVerificationInFlightRef,
      setIsMfaLoading,
      setMfaChallenge,
      setMfaChallengeCode,
      setMfaRequired,
      setMfaAssuranceLevel,
      setUserId,
      setAuthEmail,
      loadProfile,
      setActiveView,
    } = getContext()

    const code = typeof codeOverride === 'string' ? codeOverride.trim() : mfaChallengeCode.trim()

    if (!mfaChallenge || !code) {
      setProfileStatus(text.mfaCodeRequired)
      return
    }

    if (mfaVerificationInFlightRef.current) return

    mfaVerificationInFlightRef.current = true
    setIsMfaLoading(true)
    try {
      const { data, error } = await (await getSupabase()).auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: mfaChallenge.challengeId,
        code,
      })

      if (error) {
        setProfileStatus(error.message)
        return
      }

      setMfaChallenge(null)
      setMfaChallengeCode('')
      setMfaRequired(false)
      setMfaAssuranceLevel('aal2')
      if (data?.user) {
        setUserId(data.user.id)
        setAuthEmail(isPhonePasswordLoginEmail(data.user.email) ? '' : data.user.email?.toLowerCase() || '')
      }
      setProfileStatus('')
      await refreshMfaFactors()
      await loadProfile({ skipMfaChallenge: true })
      setActiveView('leaderboard')
    } finally {
      mfaVerificationInFlightRef.current = false
      setIsMfaLoading(false)
    }
  }

  async function beginTotpEnrollment() {
    const { profile, setIsMfaLoading, setMfaStatus, setMfaVerifyCode, text, setMfaEnrollment } = getContext()

    if (!profile) return

    setIsMfaLoading(true)
    setMfaStatus('')
    setMfaVerifyCode('')
    const { data, error } = await (await getSupabase()).auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'VRena',
      issuer: 'VRena',
    })

    if (error || !data) {
      setMfaStatus(error?.message || text.mfaEnrollError)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment({
      id: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    })
    setIsMfaLoading(false)
  }

  async function confirmTotpEnrollment() {
    const { mfaEnrollment, mfaVerifyCode, setMfaStatus, text, setIsMfaLoading, setMfaEnrollment, setMfaVerifyCode, setMfaAssuranceLevel } = getContext()

    if (!mfaEnrollment || !mfaVerifyCode.trim()) {
      setMfaStatus(text.mfaCodeRequired)
      return
    }

    setIsMfaLoading(true)
    setMfaStatus('')
    const challenge = await (await getSupabase()).auth.mfa.challenge({ factorId: mfaEnrollment.id })

    if (challenge.error || !challenge.data) {
      setMfaStatus(challenge.error?.message || text.mfaVerifyError)
      setIsMfaLoading(false)
      return
    }

    const { error } = await (await getSupabase()).auth.mfa.verify({
      factorId: mfaEnrollment.id,
      challengeId: challenge.data.id,
      code: mfaVerifyCode.trim(),
    })

    if (error) {
      setMfaStatus(error.message)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment(null)
    setMfaVerifyCode('')
    setMfaAssuranceLevel('aal2')
    setMfaStatus(text.mfaEnabled)
    await refreshMfaFactors()
    setIsMfaLoading(false)
  }

  async function removeTotpFactor(factorId: string) {
    const { text, setIsMfaLoading, setMfaStatus, setMfaEnrollment, setMfaVerifyCode, setMfaAssuranceLevel } = getContext()

    if (typeof window !== 'undefined' && !window.confirm(text.mfaDisableConfirm)) return

    setIsMfaLoading(true)
    setMfaStatus('')
    const { error } = await (await getSupabase()).auth.mfa.unenroll({ factorId })

    if (error) {
      setMfaStatus(error.message)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment(null)
    setMfaVerifyCode('')
    setMfaAssuranceLevel('aal1')
    setMfaStatus(text.mfaDisabled)
    await refreshMfaFactors()
    setIsMfaLoading(false)
  }

  return { refreshMfaFactors, prepareMfaChallengeIfNeeded, verifyMfaChallenge, beginTotpEnrollment, confirmTotpEnrollment, removeTotpFactor }
}
