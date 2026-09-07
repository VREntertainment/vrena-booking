'use client'

import {
  ChangeEvent
} from 'react'
import AvatarNode from '../../components/AvatarNode'
import { ageBandFromBirthday, isUnder13Birthday } from '../../lib/agePolicy'
import { getSupabase } from '../../lib/booking/client'
import { notifyBookingUpdateEmail } from '../../lib/bookingUpdateNotificationClient'
import {
  ANONYMOUS_MASK_COLOR,
  ANONYMOUS_MASK_EMOJI,
  ANONYMOUS_MASK_TEXT_COLOR,
  PROFILE_SELECT,
  Profile,
  anonymousCallsignForId,
  cleanHexColor,
  clubMembers,
  compactDisplayName,
  compactInitials,
  displayName,
  isHexColor,
  limitDisplayName,
  limitMotto,
  normalizeProfileGender,
  resolveCountryCode
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { AVATAR_IMAGE_MAX_BYTES, AVATAR_IMAGE_TYPES } from './shared'

export type ProfilesActionContext = {
  avatarColor: string
  setAvatarColor: React.Dispatch<React.SetStateAction<string>>
  setAvatarColorDraft: React.Dispatch<React.SetStateAction<string>>
  avatarTextColor: string
  setAvatarTextColor: React.Dispatch<React.SetStateAction<string>>
  setAvatarTextColorDraft: React.Dispatch<React.SetStateAction<string>>
  setAvatarMode: React.Dispatch<React.SetStateAction<"photo" | "emoji" | "initials">>
  setAvatarFile: React.Dispatch<React.SetStateAction<File | null>>
  setAvatarPreview: React.Dispatch<React.SetStateAction<string>>
  setFailedAvatarUrls: React.Dispatch<React.SetStateAction<Set<string>>>
  failedAvatarUrls: Set<string>
  setSessions: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Session[]>>
  setClubs: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Club[]>>
  setTournamentData: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TournamentData>>
  setAllProfiles: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Profile[]>>
  setLeaderboardPlayers: React.Dispatch<React.SetStateAction<import("../../components/LeaderboardPanel").LeaderboardPlayer[]>>
  text: TranslationMap
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  userId: string
  setIsSavingAnonymousMode: React.Dispatch<React.SetStateAction<boolean>>
  setProfileStatus: React.Dispatch<React.SetStateAction<string>>
  setAnonymousConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  setProfile: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Profile | null>>
  loadSessions: (options?: { focusDate?: string | undefined }) => Promise<void>
  loadClubs: () => Promise<void>
  networkDataLoadedRef: React.RefObject<boolean>
  loadNetworkData: () => Promise<void>
  refreshLeaderboardIfLoaded: () => void
  setMarketingConsent: React.Dispatch<React.SetStateAction<boolean>>
  profileCountryCode: string
  profilePhone: string
  profileName: string
  profileMotto: string
  profileNickname: string
  setIsSavingProfile: React.Dispatch<React.SetStateAction<boolean>>
  setIsProfileSaveSuccessful: React.Dispatch<React.SetStateAction<boolean>>
  avatarMode: "photo" | "emoji" | "initials"
  avatarEmoji: string
  avatarInitials: string
  effectiveProfileBirthday: string
  profileGender: "" | "female" | "male" | "non_binary" | "prefer_not_to_say" | "self_describe"
  marketingConsent: boolean
  loadTournamentData: (focusSessionId?: string | undefined) => Promise<void>
  setProfileCountryCode: React.Dispatch<React.SetStateAction<string>>
  setProfilePhone: React.Dispatch<React.SetStateAction<string>>
  setProfileBirthday: React.Dispatch<React.SetStateAction<string>>
  setProfileGender: React.Dispatch<React.SetStateAction<"" | "female" | "male" | "non_binary" | "prefer_not_to_say" | "self_describe">>
  showActionToast: (message: string) => void
  profileSaveSuccessTimerRef: React.RefObject<number | null>
  avatarFile: File | null
  setIsDeletingAccount: React.Dispatch<React.SetStateAction<boolean>>
  softDeleteRecord: (entityTable: string, entityId: string, reason: string) => Promise<import("@supabase/postgrest-js").PostgrestSingleResponse<unknown>>
  setUserId: React.Dispatch<React.SetStateAction<string>>
  setAuthEmail: React.Dispatch<React.SetStateAction<string>>
  setNewPassword: React.Dispatch<React.SetStateAction<string>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingProfilesActions(getContext: () => ProfilesActionContext) {
  function updateAvatarColor(value: string) {
    const { avatarColor, setAvatarColor, setAvatarColorDraft } = getContext()

    const normalized = cleanHexColor(value, avatarColor)
    setAvatarColor(normalized)
    setAvatarColorDraft(normalized)
  }

  function updateAvatarColorDraft(value: string) {
    const { setAvatarColorDraft, setAvatarColor } = getContext()

    setAvatarColorDraft(value)
    if (isHexColor(value)) setAvatarColor(value.toLowerCase())
  }

  function updateAvatarTextColor(value: string) {
    const { avatarTextColor, setAvatarTextColor, setAvatarTextColorDraft } = getContext()

    const normalized = cleanHexColor(value, avatarTextColor)
    setAvatarTextColor(normalized)
    setAvatarTextColorDraft(normalized)
  }

  function updateAvatarTextColorDraft(value: string) {
    const { setAvatarTextColorDraft, setAvatarTextColor } = getContext()

    setAvatarTextColorDraft(value)
    if (isHexColor(value)) setAvatarTextColor(value.toLowerCase())
  }

  function chooseAvatarMode(mode: 'photo' | 'emoji' | 'initials') {
    const { setAvatarMode, setAvatarFile, setAvatarPreview } = getContext()

    setAvatarMode(mode)
    if (mode !== 'photo') {
      setAvatarFile(null)
      setAvatarPreview('')
    }
  }

  function rememberFailedAvatarUrl(source: string | null | undefined) {
    const { setFailedAvatarUrls } = getContext()

    const normalizedSource = source?.trim()
    if (!normalizedSource || normalizedSource.startsWith('blob:') || normalizedSource.startsWith('data:')) return
    setFailedAvatarUrls((current) => {
      if (current.has(normalizedSource)) return current
      return new Set([...current, normalizedSource])
    })
  }

  function avatarNode(source: {
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    display_name?: string | null
    full_name?: string | null
    nickname?: string | null
  } | null | undefined, fallback = 'Player') {
    const { failedAvatarUrls } = getContext()

    return (
      <AvatarNode
        failedAvatarUrls={failedAvatarUrls}
        fallback={fallback}
        onFailedAvatarUrl={rememberFailedAvatarUrl}
        source={source}
      />
    )
  }

  function avatarStyle(source: { avatar_color?: string | null; avatar_text_color?: string | null } | null | undefined) {
    if (!source?.avatar_color && !source?.avatar_text_color) return undefined

    return {
      ...(source.avatar_color ? { background: source.avatar_color } : {}),
      ...(source.avatar_text_color ? { color: source.avatar_text_color } : {}),
    }
  }

  function profileAvatarSnapshot(source: Profile) {
    return {
      display_name: displayName(source),
      ...avatarFields(source),
    }
  }

  function mergeCurrentUserAvatar<T extends {
    profile_id: string
    display_name?: string | null
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    profile_motto?: string | null
  }>(item: T, snapshot: ReturnType<typeof profileAvatarSnapshot>, profileId: string): T {
    return item.profile_id === profileId
      ? {
        ...item,
        ...snapshot,
      }
      : item
  }

  function syncProfileEverywhere(updatedProfile: Profile) {
    const { setSessions, setClubs, setTournamentData, setAllProfiles, setLeaderboardPlayers, text } = getContext()

    const nextProfileSnapshot = profileAvatarSnapshot(updatedProfile)

    setSessions((currentSessions) =>
      currentSessions.map((session) => ({
        ...session,
        session_participants: session.session_participants?.map((participant) =>
          mergeCurrentUserAvatar(participant, nextProfileSnapshot, updatedProfile.id)
        ),
        session_waitlist: session.session_waitlist?.map((entry) =>
          mergeCurrentUserAvatar(entry, nextProfileSnapshot, updatedProfile.id)
        ),
      }))
    )

    setClubs((currentClubs) =>
      currentClubs.map((club) => ({
        ...club,
        club_members: clubMembers(club).map((member) =>
          mergeCurrentUserAvatar(member, nextProfileSnapshot, updatedProfile.id)
        ),
      }))
    )

    setTournamentData((currentData) => ({
      ...currentData,
      editors: currentData.editors.map((editor) =>
        mergeCurrentUserAvatar(editor, nextProfileSnapshot, updatedProfile.id)
      ),
    }))

    setAllProfiles((currentProfiles) => {
      const nextProfiles = currentProfiles.map((item) => (item.id === updatedProfile.id ? { ...item, ...updatedProfile } : item))
      return nextProfiles.some((item) => item.id === updatedProfile.id) ? nextProfiles : [...nextProfiles, updatedProfile]
    })

    setLeaderboardPlayers((currentPlayers) =>
      currentPlayers.map((player) => player.profileId === updatedProfile.id
        ? (() => {
          const nextAvatar = avatarFields(updatedProfile)
          return {
            ...player,
            displayName: compactDisplayName(displayName(updatedProfile), text.player),
            avatarUrl: nextAvatar.avatar_url,
            avatarEmoji: nextAvatar.avatar_emoji,
            avatarInitials: nextAvatar.avatar_initials,
            avatarColor: nextAvatar.avatar_color,
            avatarTextColor: nextAvatar.avatar_text_color,
            profileMotto: updatedProfile.profile_motto || null,
          }
        })()
        : player
      )
    )
  }

  function marketingConsentValues(consent: boolean, currentProfile: Profile | null, timestamp = new Date().toISOString()) {
    return {
      marketing_consent: consent,
      marketing_consent_at: consent ? currentProfile?.marketing_consent_at || timestamp : currentProfile?.marketing_consent_at || null,
      marketing_opted_out_at: consent ? null : timestamp,
    }
  }

  async function syncMarketingListForProfile(source: Profile, consent: boolean) {
    const client = await getSupabase()

    if (!consent) {
      const { error } = await client
        .from('marketing_list')
        .delete()
        .eq('profile_id', source.id)
      return error?.message || ''
    }

    const { error } = await client
      .from('marketing_list')
      .upsert({
        profile_id: source.id,
        email: source.email,
        full_name: source.full_name,
        nickname: source.nickname,
        phone: source.phone,
        consented_at: source.marketing_consent_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })

    return error?.message || ''
  }

  async function syncProfilePublicSnapshots(profileId: string) {
    const { error } = await (await getSupabase()).rpc('sync_profile_public_snapshot', { p_profile_id: profileId })
    return error?.message || ''
  }

  async function notifyMinorBookingCreated(kind: 'session' | 'ticket', sessionId: string | null | undefined, sourceProfile: Profile | null) {
    if (!sessionId || !sourceProfile || ageBandFromBirthday(sourceProfile.birthday) !== 'minor') return

    try {
      await notifyBookingUpdateEmail(await getSupabase(), {
        action: 'created',
        bookingKind: kind,
        sessionId,
        source: 'player-app',
      })
    } catch (error) {
      console.warn('Could not send minor booking notice.', error)
    }
  }

  async function updateAnonymousMode(nextMode: boolean) {
    const {
      profile,
      userId,
      setIsSavingAnonymousMode,
      setProfileStatus,
      setAnonymousConfirmOpen,
      setProfile,
      loadSessions,
      loadClubs,
      networkDataLoadedRef,
      loadNetworkData,
      refreshLeaderboardIfLoaded,
      text,
    } = getContext()

    if (!profile || !userId) return

    setIsSavingAnonymousMode(true)
    const nextCallsign = profile.anonymous_callsign || anonymousCallsignForId(userId)
    const { data, error } = await (await getSupabase())
      .from('profiles')
      .update({
        anonymous_mode: nextMode,
        anonymous_callsign: nextCallsign,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    const metadataUpdate = await (await getSupabase()).auth.updateUser({
      data: {
        display_name: displayName(data),
        name: displayName(data),
        anonymous_mode: data.anonymous_mode,
        anonymous_callsign: data.anonymous_callsign,
      },
    })

    if (metadataUpdate.error) {
      setProfileStatus(metadataUpdate.error.message)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    const snapshotError = await syncProfilePublicSnapshots(data.id)
    if (snapshotError) {
      setProfileStatus(snapshotError)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    setProfile(data)
    syncProfileEverywhere(data)
    await loadSessions()
    await loadClubs()
    if (networkDataLoadedRef.current) await loadNetworkData()
    refreshLeaderboardIfLoaded()
    setProfileStatus(nextMode ? text.anonymousModeActivated : text.anonymousModeDeactivated)
    setAnonymousConfirmOpen(false)
    setIsSavingAnonymousMode(false)
  }

  async function updateMarketingConsent(nextConsent: boolean) {
    const { setMarketingConsent, profile, userId, setProfile, setProfileStatus, text } = getContext()

    setMarketingConsent(nextConsent)
    if (!profile || !userId) return

    const previousProfile = profile
    const values = marketingConsentValues(nextConsent, profile)
    const optimisticProfile = { ...profile, ...values }
    setProfile(optimisticProfile)
    setProfileStatus(text.savingProfile)

    const { data, error } = await (await getSupabase())
      .from('profiles')
      .update(values)
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      setMarketingConsent(previousProfile.marketing_consent !== false)
      setProfile(previousProfile)
      setProfileStatus(error.message)
      return
    }

    const listError = await syncMarketingListForProfile(data, nextConsent)
    setProfile(data)
    setProfileStatus(listError || (nextConsent ? text.marketingConsentSaved : text.marketingConsentRemoved))
  }

  async function saveProfile() {
    const {
      userId,
      setProfileStatus,
      text,
      profileCountryCode,
      profilePhone,
      profileName,
      profileMotto,
      profileNickname,
      setIsSavingProfile,
      setIsProfileSaveSuccessful,
      avatarMode,
      profile,
      avatarEmoji,
      avatarInitials,
      avatarColor,
      avatarTextColor,
      effectiveProfileBirthday,
      profileGender,
      marketingConsent,
      setProfile,
      loadSessions,
      loadClubs,
      loadTournamentData,
      setAvatarFile,
      setAvatarPreview,
      setProfileCountryCode,
      setProfilePhone,
      setProfileBirthday,
      setProfileGender,
      showActionToast,
      profileSaveSuccessTimerRef,
    } = getContext()

    if (!userId) {
      setProfileStatus(text.profileLoading)
      return
    }

    const countryCode = resolveCountryCode(profileCountryCode)
    const localPhone = profilePhone.replace(/[^\d\s-]/g, '').trim()
    const fullName = profileName.trim()
    const cleanMotto = limitMotto(profileMotto.trim())
    const nickname = limitDisplayName(profileNickname.trim())

    if (!profilePhone.trim()) {
      setProfileStatus(text.phoneRequired)
      document.getElementById('profile-phone-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      document.getElementById('profile-phone-input')?.focus({ preventScroll: true })
      return
    }

    if (!fullName) {
      setProfileStatus(text.nameRequired)
      document.getElementById('profile-name-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      document.getElementById('profile-name-input')?.focus({ preventScroll: true })
      return
    }

    setIsSavingProfile(true)
    setIsProfileSaveSuccessful(false)
    setProfileStatus(text.savingProfile)

    try {
      const avatarUrl = avatarMode === 'photo' ? await uploadAvatar(userId, profile?.avatar_url || null) : null

      if (avatarUrl === false) return

      const avatarPayload = {
        avatar_url: avatarMode === 'photo' ? avatarUrl : null,
        avatar_emoji: avatarMode === 'emoji' ? avatarEmoji.trim() || '😎' : null,
        avatar_initials: avatarMode === 'initials' ? compactInitials(avatarInitials || displayName(profile) || fullName) : null,
        avatar_color: avatarColor,
        avatar_text_color: avatarTextColor,
      }

      const row = {
        full_name: fullName,
        phone: `${countryCode}${localPhone.replace(/\D/g, '')}`,
        profile_motto: cleanMotto || null,
        nickname: nickname || null,
        birthday: effectiveProfileBirthday || null,
        gender: isUnder13Birthday(effectiveProfileBirthday) ? null : profileGender || null,
        ...marketingConsentValues(marketingConsent, profile),
        ...avatarPayload,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await (await getSupabase())
        .from('profiles')
        .update(row)
        .eq('id', userId)
        .select(PROFILE_SELECT)
        .single()

      if (error) {
        setProfileStatus(error.code === '23505' ? text.profileIdentityTaken : error.message)
        return
      }

      const display = displayName(data)
      const publicAvatar = avatarFields(data)
      const metadataUpdate = await (await getSupabase()).auth.updateUser({
        data: {
          display_name: display,
          full_name: fullName,
          name: display,
          nickname: nickname || null,
          birthday: data.birthday,
          gender: data.gender,
          phone: data.phone,
          avatar_url: publicAvatar.avatar_url,
          avatar_emoji: publicAvatar.avatar_emoji,
          avatar_initials: publicAvatar.avatar_initials,
          avatar_color: publicAvatar.avatar_color,
          avatar_text_color: publicAvatar.avatar_text_color,
          profile_motto: data.profile_motto,
          marketing_consent: data.marketing_consent,
          marketing_consent_at: data.marketing_consent_at,
          marketing_opted_out_at: data.marketing_opted_out_at,
          personal_data_consent: data.personal_data_consent,
          personal_data_consent_at: data.personal_data_consent_at,
          privacy_policy_url: data.privacy_policy_url,
          terms_conditions_url: data.terms_conditions_url,
          consent_waiver_url: data.consent_waiver_url,
          legal_consent_version: data.legal_consent_version,
        },
      })

      if (metadataUpdate.error) {
        setProfileStatus(metadataUpdate.error.message)
        return
      }

      const snapshotError = await syncProfilePublicSnapshots(data.id)
      if (snapshotError) {
        setProfileStatus(snapshotError)
        return
      }

      const marketingListError = await syncMarketingListForProfile(data, data.marketing_consent !== false)
      if (marketingListError) {
        setProfileStatus(marketingListError)
        return
      }

      setProfile(data)
      await loadSessions()
      await loadClubs()
      await loadTournamentData()
      syncProfileEverywhere(data)
      setAvatarFile(null)
      setAvatarPreview('')
      setProfileCountryCode(countryCode)
      setProfilePhone(localPhone)
      setProfileBirthday(data.birthday || '')
      setProfileGender(normalizeProfileGender(data.gender))
      setProfileStatus(text.profileSaved)
      showActionToast(text.profileSaved)
      setIsProfileSaveSuccessful(true)
      if (profileSaveSuccessTimerRef.current !== null) {
        window.clearTimeout(profileSaveSuccessTimerRef.current)
      }
      profileSaveSuccessTimerRef.current = window.setTimeout(() => {
        setIsProfileSaveSuccessful(false)
        profileSaveSuccessTimerRef.current = null
      }, 2600)
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : text.profileSaveError)
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function uploadAvatar(ownerId: string, currentAvatarUrl: string | null) {
    const { avatarFile, setProfileStatus, setIsSavingProfile } = getContext()

    if (!avatarFile) return currentAvatarUrl

    const safeName = avatarFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const path = `${ownerId}/${Date.now()}-${safeName}`
    const upload = await (await getSupabase()).storage.from('avatars').upload(path, avatarFile, {
      contentType: avatarFile.type,
      upsert: true,
    })

    if (upload.error) {
      setProfileStatus(upload.error.message)
      setIsSavingProfile(false)
      return false as const
    }

    const { data } = (await getSupabase()).storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const { setAvatarFile, setAvatarPreview, setProfileStatus, text, setAvatarMode } = getContext()

    const file = event.target.files?.[0] || null

    if (!file) {
      setAvatarFile(null)
      setAvatarPreview('')
      return
    }

    if (!AVATAR_IMAGE_TYPES.includes(file.type)) {
      setProfileStatus(text.avatarPhotoTypeError)
      setAvatarFile(null)
      setAvatarPreview('')
      event.target.value = ''
      return
    }

    if (file.size > AVATAR_IMAGE_MAX_BYTES) {
      setProfileStatus(text.avatarPhotoSizeError)
      setAvatarFile(null)
      setAvatarPreview('')
      event.target.value = ''
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarMode('photo')
    setProfileStatus('')
  }

  async function deleteMyAccount() {
    const {
      profile,
      userId,
      text,
      setIsDeletingAccount,
      setProfileStatus,
      softDeleteRecord,
      setUserId,
      setAuthEmail,
      setProfile,
      setNewPassword,
      loadSessions,
    } = getContext()

    if (!profile || !userId) return

    const confirmed = window.confirm(text.deleteAccountConfirm)
    if (!confirmed) return

    setIsDeletingAccount(true)
    setProfileStatus(text.saving)

    const { error } = await softDeleteRecord('profiles', userId, 'User deleted own account')

    if (error) {
      setProfileStatus(error.message)
      setIsDeletingAccount(false)
      return
    }

    await (await getSupabase()).auth.signOut()
    setUserId('')
    setAuthEmail('')
    setProfile(null)
    setNewPassword('')
    setProfileStatus(text.accountDeleted)
    setIsDeletingAccount(false)
    await loadSessions()
  }

  return {
    updateAvatarColor,
    updateAvatarColorDraft,
    updateAvatarTextColor,
    updateAvatarTextColorDraft,
    chooseAvatarMode,
    rememberFailedAvatarUrl,
    avatarNode,
    avatarStyle,
    avatarFields,
    profileAvatarSnapshot,
    mergeCurrentUserAvatar,
    syncProfileEverywhere,
    marketingConsentValues,
    syncMarketingListForProfile,
    syncProfilePublicSnapshots,
    notifyMinorBookingCreated,
    updateAnonymousMode,
    updateMarketingConsent,
    saveProfile,
    uploadAvatar,
    handleAvatarChange,
    deleteMyAccount,
  }
}

export function avatarFields(source: Profile) {
  if (source.anonymous_mode) {
    return {
      avatar_url: null,
      avatar_emoji: ANONYMOUS_MASK_EMOJI,
      avatar_initials: null,
      avatar_color: ANONYMOUS_MASK_COLOR,
      avatar_text_color: ANONYMOUS_MASK_TEXT_COLOR,
      profile_motto: null,
    }
  }

  return {
    avatar_url: source.avatar_url || null,
    avatar_emoji: source.avatar_emoji || null,
    avatar_initials: source.avatar_initials || null,
    avatar_color: source.avatar_color || null,
    avatar_text_color: source.avatar_text_color || null,
    profile_motto: source.profile_motto || null,
  }
}
