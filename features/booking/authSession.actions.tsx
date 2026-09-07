'use client'

import { ageBandFromBirthday } from '../../lib/agePolicy'
import { getSupabase } from '../../lib/booking/client'
import {
  avatarColors,
  avatarTextColors
} from '../../lib/bookingStaticData'
import {
  PROFILE_SELECT,
  Profile,
  authDebug,
  limitDisplayName,
  limitMotto,
  normalizeProfileGender,
  splitPhoneNumber,
  validAvatarInitials
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { isPendingPhoneAccountSetup } from '../../lib/phoneAccountSetup'
import { isPhonePasswordLoginEmail } from '../../lib/phonePasswordAccount'
import { defaultStaffRoleForEmail as defaultRoleForEmail, isStaffAdminEmail as isAdminEmail } from '../../lib/staffRoles'

export type AuthSessionActionContext = {
  isProfileAuthLoading: boolean
  profileAuthLoadSeqRef: React.RefObject<number>
  setIsProfileAuthLoading: React.Dispatch<React.SetStateAction<boolean>>
  setUserId: React.Dispatch<React.SetStateAction<string>>
  setAuthEmail: React.Dispatch<React.SetStateAction<string>>
  setProfile: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Profile | null>>
  setPhoneSetupRequired: React.Dispatch<React.SetStateAction<boolean>>
  setProfileStatus: React.Dispatch<React.SetStateAction<string>>
  setActiveView: React.Dispatch<React.SetStateAction<import("../../components/AppSidebar").AppView>>
  prepareMfaChallengeIfNeeded: () => Promise<boolean>
  refreshMfaFactors: () => Promise<{ id: string; friendly_name: string | undefined; factor_type: "totp"; status: "verified"; created_at: string; updated_at: string }[]>
  setProfileCountryCode: React.Dispatch<React.SetStateAction<string>>
  setProfilePhone: React.Dispatch<React.SetStateAction<string>>
  setProfileName: React.Dispatch<React.SetStateAction<string>>
  setProfileMotto: React.Dispatch<React.SetStateAction<string>>
  setProfileNickname: React.Dispatch<React.SetStateAction<string>>
  setProfileEmail: React.Dispatch<React.SetStateAction<string>>
  setProfileBirthday: React.Dispatch<React.SetStateAction<string>>
  setProfileGender: React.Dispatch<React.SetStateAction<"" | "female" | "male" | "non_binary" | "prefer_not_to_say" | "self_describe">>
  setMarketingConsent: React.Dispatch<React.SetStateAction<boolean>>
  setAvatarMode: React.Dispatch<React.SetStateAction<"photo" | "emoji" | "initials">>
  setAvatarEmoji: React.Dispatch<React.SetStateAction<string>>
  setAvatarInitials: React.Dispatch<React.SetStateAction<string>>
  setAvatarColor: React.Dispatch<React.SetStateAction<string>>
  setAvatarColorDraft: React.Dispatch<React.SetStateAction<string>>
  setAvatarTextColor: React.Dispatch<React.SetStateAction<string>>
  setAvatarTextColorDraft: React.Dispatch<React.SetStateAction<string>>
  setProfilePassword: React.Dispatch<React.SetStateAction<string>>
  setPhoneSetupEmail: React.Dispatch<React.SetStateAction<string>>
  setPhoneSetupSentTo: React.Dispatch<React.SetStateAction<string>>
  setAuthStep: React.Dispatch<React.SetStateAction<"email" | "credentials">>
  setNewPassword: React.Dispatch<React.SetStateAction<string>>
  setIsRecoveryMode: React.Dispatch<React.SetStateAction<boolean>>
  setMfaFactors: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TotpFactor[]>>
  setMfaEnrollment: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TotpEnrollment | null>>
  setMfaChallenge: React.Dispatch<React.SetStateAction<{ factorId: string; challengeId: string } | null>>
  setMfaChallengeCode: React.Dispatch<React.SetStateAction<string>>
  setMfaVerifyCode: React.Dispatch<React.SetStateAction<string>>
  setMfaRequired: React.Dispatch<React.SetStateAction<boolean>>
  setMfaAssuranceLevel: React.Dispatch<React.SetStateAction<"aal1" | "aal2" | null>>
  setMfaStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingAuthSessionActions(getContext: () => AuthSessionActionContext) {
  async function loadProfile(options: { skipMfaChallenge?: boolean; showAuthLoading?: boolean } = {}) {
    const {
      isProfileAuthLoading,
      profileAuthLoadSeqRef,
      setIsProfileAuthLoading,
      setUserId,
      setAuthEmail,
      setProfile,
      setPhoneSetupRequired,
      setProfileStatus,
      setActiveView,
      prepareMfaChallengeIfNeeded,
      refreshMfaFactors,
      setProfileCountryCode,
      setProfilePhone,
      setProfileName,
      setProfileMotto,
      setProfileNickname,
      setProfileEmail,
      setProfileBirthday,
      setProfileGender,
      setMarketingConsent,
      setAvatarMode,
      setAvatarEmoji,
      setAvatarInitials,
      setAvatarColor,
      setAvatarColorDraft,
      setAvatarTextColor,
      setAvatarTextColorDraft,
    } = getContext()

    const shouldShowAuthLoading = options.showAuthLoading ?? isProfileAuthLoading
    const authLoadSeq = shouldShowAuthLoading ? profileAuthLoadSeqRef.current + 1 : profileAuthLoadSeqRef.current
    if (shouldShowAuthLoading) {
      profileAuthLoadSeqRef.current = authLoadSeq
      setIsProfileAuthLoading(true)
    }

    try {
      authDebug('loadProfile:start')
      const { data: userData, error: userError } = await (await getSupabase()).auth.getUser()
      const authUser = userData.user
      authDebug('loadProfile:getUser', {
        error: userError,
        user: authUser ? {
          id: authUser.id,
          email: authUser.email,
          emailConfirmedAt: authUser.email_confirmed_at,
          lastSignInAt: authUser.last_sign_in_at,
          appMetadata: authUser.app_metadata,
          userMetadata: authUser.user_metadata,
        } : null,
      })

      if (userError) {
        setUserId('')
        setAuthEmail('')
        setProfile(null)
        setPhoneSetupRequired(false)
        if (/auth session missing/i.test(userError.message)) {
          setProfileStatus('')
          return null
        }
        setProfileStatus(userError.message)
        return null
      }

      if (!authUser) {
        setUserId('')
        setAuthEmail('')
        setProfile(null)
        setPhoneSetupRequired(false)
        return null
      }

      setUserId(authUser.id)
      setAuthEmail(isPhonePasswordLoginEmail(authUser.email) ? '' : authUser.email?.toLowerCase() || '')

      const requiresPhoneSetup = isPendingPhoneAccountSetup(authUser.app_metadata)
      setPhoneSetupRequired(requiresPhoneSetup)
      if (requiresPhoneSetup) {
        setProfile(null)
        setActiveView('profile')
        return null
      }

      if (!options.skipMfaChallenge) {
        const needsMfa = await prepareMfaChallengeIfNeeded()
        if (needsMfa) {
          setProfile(null)
          return null
        }
      }

      await refreshMfaFactors()

      const { data: profileRow, error: profileError, status: profileStatusCode } = await (await getSupabase())
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', authUser.id)
        .is('deleted_at', null)
        .maybeSingle()

      authDebug('loadProfile:profileQuery', {
        status: profileStatusCode,
        error: profileError,
        profile: profileRow,
        role: profileRow?.role,
        isAdminEmail: isAdminEmail(authUser.email),
      })

      if (profileError) {
        setProfileStatus(profileError.message)
        return null
      }

      if (profileRow) {
        const profileInitials = validAvatarInitials(profileRow.avatar_initials)
        const phoneParts = splitPhoneNumber(profileRow.phone || '')
        setProfile(profileRow)
        setProfileCountryCode(phoneParts.countryInput)
        setProfilePhone(phoneParts.localPhone)
        setProfileName(profileRow.full_name || '')
        setProfileMotto(limitMotto(profileRow.profile_motto || ''))
        setProfileNickname(limitDisplayName(profileRow.nickname || ''))
        setProfileEmail(profileRow.email || '')
        setProfileBirthday(profileRow.birthday || '')
        setProfileGender(normalizeProfileGender(profileRow.gender))
        setMarketingConsent(profileRow.marketing_consent !== false)
        setAvatarMode(profileRow.avatar_url ? 'photo' : profileRow.avatar_emoji ? 'emoji' : profileInitials ? 'initials' : 'photo')
        setAvatarEmoji(profileRow.avatar_emoji || '😎')
        setAvatarInitials(profileInitials)
        setAvatarColor(profileRow.avatar_color || avatarColors[0])
        setAvatarColorDraft(profileRow.avatar_color || avatarColors[0])
        setAvatarTextColor(profileRow.avatar_text_color || avatarTextColors[0])
        setAvatarTextColorDraft(profileRow.avatar_text_color || avatarTextColors[0])
        return profileRow
      }

      const email = isPhonePasswordLoginEmail(authUser.email) ? '' : authUser.email?.toLowerCase() || ''
      const fullName = (
        typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name :
          typeof authUser.user_metadata?.name === 'string' ? authUser.user_metadata.name :
            typeof authUser.user_metadata?.display_name === 'string' ? authUser.user_metadata.display_name :
              ''
      )
      const nickname = typeof authUser.user_metadata?.nickname === 'string' ? limitDisplayName(authUser.user_metadata.nickname) : ''
      const profileMottoValue = typeof authUser.user_metadata?.profile_motto === 'string' ? limitMotto(authUser.user_metadata.profile_motto) : ''
      const birthdayValue = typeof authUser.user_metadata?.birthday === 'string' ? authUser.user_metadata.birthday : ''
      const genderValue = ageBandFromBirthday(birthdayValue) === 'under13' ? '' : normalizeProfileGender(authUser.user_metadata?.gender)
      const personalDataConsentValue = authUser.user_metadata?.personal_data_consent === true
      const phone = typeof authUser.user_metadata?.phone === 'string' ? authUser.user_metadata.phone : ''
      const metadataAvatarUrl = (
        typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url :
          typeof authUser.user_metadata?.picture === 'string' ? authUser.user_metadata.picture :
            ''
      )
      const metadataInitials = validAvatarInitials(typeof authUser.user_metadata?.avatar_initials === 'string' ? authUser.user_metadata.avatar_initials : '')
      const fallbackProfile: Profile = {
        id: authUser.id,
        phone,
        full_name: fullName || null,
        nickname: nickname || null,
        email,
        birthday: birthdayValue || null,
        gender: genderValue || null,
        avatar_url: metadataAvatarUrl || null,
        avatar_emoji: typeof authUser.user_metadata?.avatar_emoji === 'string' ? authUser.user_metadata.avatar_emoji : null,
        avatar_initials: metadataInitials || null,
        avatar_color: typeof authUser.user_metadata?.avatar_color === 'string' ? authUser.user_metadata.avatar_color : null,
        avatar_text_color: typeof authUser.user_metadata?.avatar_text_color === 'string' ? authUser.user_metadata.avatar_text_color : null,
        profile_motto: profileMottoValue || null,
        role: defaultRoleForEmail(email),
        anonymous_mode: Boolean(authUser.user_metadata?.anonymous_mode),
        anonymous_callsign: typeof authUser.user_metadata?.anonymous_callsign === 'string' ? authUser.user_metadata.anonymous_callsign : null,
        marketing_consent: authUser.user_metadata?.marketing_consent === false ? false : true,
        marketing_consent_at: typeof authUser.user_metadata?.marketing_consent_at === 'string' ? authUser.user_metadata.marketing_consent_at : null,
        marketing_opted_out_at: typeof authUser.user_metadata?.marketing_opted_out_at === 'string' ? authUser.user_metadata.marketing_opted_out_at : null,
        personal_data_consent: personalDataConsentValue,
        personal_data_consent_at: typeof authUser.user_metadata?.personal_data_consent_at === 'string' ? authUser.user_metadata.personal_data_consent_at : null,
        privacy_policy_url: typeof authUser.user_metadata?.privacy_policy_url === 'string' ? authUser.user_metadata.privacy_policy_url : null,
        terms_conditions_url: typeof authUser.user_metadata?.terms_conditions_url === 'string' ? authUser.user_metadata.terms_conditions_url : null,
        consent_waiver_url: typeof authUser.user_metadata?.consent_waiver_url === 'string' ? authUser.user_metadata.consent_waiver_url : null,
        legal_consent_version: typeof authUser.user_metadata?.legal_consent_version === 'string' ? authUser.user_metadata.legal_consent_version : null,
      }

      authDebug('loadProfile:missingProfileFallback', fallbackProfile)
      setProfile(fallbackProfile)
      setProfileCountryCode('+84')
      setProfilePhone(phone.replace(/^\+?84/, ''))
      setProfileName(fullName)
      setProfileMotto(profileMottoValue)
      setProfileNickname(nickname)
      setProfileEmail(email)
      setProfileBirthday(birthdayValue)
      setProfileGender(genderValue)
      setMarketingConsent(fallbackProfile.marketing_consent !== false)
      setAvatarMode(fallbackProfile.avatar_url ? 'photo' : fallbackProfile.avatar_emoji ? 'emoji' : metadataInitials ? 'initials' : 'photo')
      setAvatarEmoji(fallbackProfile.avatar_emoji || '😎')
      setAvatarInitials(metadataInitials)
      setAvatarColor(fallbackProfile.avatar_color || avatarColors[0])
      setAvatarColorDraft(fallbackProfile.avatar_color || avatarColors[0])
      setAvatarTextColor(fallbackProfile.avatar_text_color || avatarTextColors[0])
      setAvatarTextColorDraft(fallbackProfile.avatar_text_color || avatarTextColors[0])

      const repairResult = await (await getSupabase()).from('profiles').insert({
        id: authUser.id,
        phone: phone || null,
        full_name: fullName || null,
        nickname: nickname || null,
        email,
        birthday: fallbackProfile.birthday,
        gender: fallbackProfile.gender,
        avatar_url: fallbackProfile.avatar_url,
        avatar_emoji: fallbackProfile.avatar_emoji,
        avatar_initials: fallbackProfile.avatar_initials,
        avatar_color: fallbackProfile.avatar_color,
        avatar_text_color: fallbackProfile.avatar_text_color,
        profile_motto: fallbackProfile.profile_motto,
        anonymous_mode: fallbackProfile.anonymous_mode || false,
        anonymous_callsign: fallbackProfile.anonymous_callsign || null,
        marketing_consent: fallbackProfile.marketing_consent !== false,
        marketing_consent_at: fallbackProfile.marketing_consent_at || new Date().toISOString(),
        marketing_opted_out_at: fallbackProfile.marketing_opted_out_at || null,
        personal_data_consent: fallbackProfile.personal_data_consent || false,
        personal_data_consent_at: fallbackProfile.personal_data_consent_at || null,
        privacy_policy_url: fallbackProfile.privacy_policy_url || null,
        terms_conditions_url: fallbackProfile.terms_conditions_url || null,
        consent_waiver_url: fallbackProfile.consent_waiver_url || null,
        legal_consent_version: fallbackProfile.legal_consent_version || null,
        updated_at: new Date().toISOString(),
      })

      authDebug('loadProfile:profileRepairUpsert', repairResult)
      return fallbackProfile
    } catch (error) {
      authDebug('loadProfile:thrown', error)
      setProfileStatus(error instanceof Error ? error.message : String(error))
      return null
    } finally {
      if (shouldShowAuthLoading && profileAuthLoadSeqRef.current === authLoadSeq) {
        setIsProfileAuthLoading(false)
      }
    }
  }

  async function logout() {
    const {
      setUserId,
      setAuthEmail,
      setProfile,
      setProfilePassword,
      setPhoneSetupRequired,
      setPhoneSetupEmail,
      setPhoneSetupSentTo,
      setAuthStep,
      setNewPassword,
      setIsRecoveryMode,
      setMfaFactors,
      setMfaEnrollment,
      setMfaChallenge,
      setMfaChallengeCode,
      setMfaVerifyCode,
      setMfaRequired,
      setMfaAssuranceLevel,
      setMfaStatus,
      setProfileStatus,
      text,
    } = getContext()

    await (await getSupabase()).auth.signOut()
    setUserId('')
    setAuthEmail('')
    setProfile(null)
    setProfilePassword('')
    setPhoneSetupRequired(false)
    setPhoneSetupEmail('')
    setPhoneSetupSentTo('')
    setAuthStep('email')
    setNewPassword('')
    setIsRecoveryMode(false)
    setMfaFactors([])
    setMfaEnrollment(null)
    setMfaChallenge(null)
    setMfaChallengeCode('')
    setMfaVerifyCode('')
    setMfaRequired(false)
    setMfaAssuranceLevel(null)
    setMfaStatus('')
    setProfileStatus(text.loggedOut)
  }

  async function logoutStaffKiosk() {
    const { setActiveView } = getContext()

    await logout()
    setActiveView('profile')
  }

  return { loadProfile, logout, logoutStaffKiosk }
}
