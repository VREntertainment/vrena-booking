'use client'

import { getSupabase } from '../../lib/booking/client'
import {
  clubThemeColors
} from '../../lib/bookingStaticData'
import {
  Club,
  ClubMember,
  ClubMemberRole,
  DEFAULT_APP_URL,
  cleanHexColor,
  clubMembers,
  displayName,
  generateInviteCode
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'

export type ClubManagementActionContext = {
  clubBannerFile: File | null
  setClubStatus: React.Dispatch<React.SetStateAction<string>>
  canManageClub: (club: import("../../lib/bookingWidgetDomain").Club) => boolean
  clubEditName: string
  text: TranslationMap
  setIsSavingClub: React.Dispatch<React.SetStateAction<boolean>>
  setBusyClubId: React.Dispatch<React.SetStateAction<string>>
  clubEditVisibility: "public" | "private"
  clubEditMotto: string
  clubEditDescription: string
  clubEditThemeColor: string
  clubEditDefaultLanguage: import("../../lib/i18n/languages").LanguageCode
  clubEditRankingCriterion: import("../../components/LeaderboardPanel").LeaderboardCriterion
  loadClubs: () => Promise<void>
  setClubBannerFile: React.Dispatch<React.SetStateAction<File | null>>
  setClubBannerPreview: React.Dispatch<React.SetStateAction<string>>
  manageableRoleOptions: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember) => import("../../lib/bookingWidgetDomain").ClubMemberRole[]
  userId: string
  isAdmin: boolean
  socialAvatarFields: (source: { display_name?: string | null | undefined; avatar_url?: string | null | undefined; avatar_emoji?: string | null | undefined; avatar_initials?: string | null | undefined; avatar_color?: string | null | undefined; avatar_text_color?: string | null | undefined; profile_motto?: string | null | undefined }) => { display_name: string; avatar_url: string | null; avatar_emoji: string | null; avatar_initials: string | null; avatar_color: string | null; avatar_text_color: string | null; profile_motto: string | null }
  networkDataLoadedRef: React.RefObject<boolean>
  loadNetworkData: () => Promise<void>
  requireProfile: () => boolean
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  clubName: string
  setIsCreatingClub: React.Dispatch<React.SetStateAction<boolean>>
  clubVisibility: import("../../components/ClubsView").ClubVisibility
  clubDescription: string
  avatarFields: (source: import("../../lib/bookingWidgetDomain").Profile) => { avatar_url: string | null; avatar_emoji: string | null; avatar_initials: string | null; avatar_color: string | null; avatar_text_color: string | null; profile_motto: string | null }
  setClubName: React.Dispatch<React.SetStateAction<string>>
  setClubDescription: React.Dispatch<React.SetStateAction<string>>
  setClubVisibility: React.Dispatch<React.SetStateAction<import("../../components/ClubsView").ClubVisibility>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingClubManagementActions(getContext: () => ClubManagementActionContext) {
  async function uploadClubBanner(club: Club) {
    const { clubBannerFile, setClubStatus } = getContext()

    if (!clubBannerFile) return club.banner_url || null

    const safeName = clubBannerFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const path = `${club.id}/${Date.now()}-${safeName}`
    const client = await getSupabase()
    const upload = await client.storage.from('club-banners').upload(path, clubBannerFile, {
      contentType: clubBannerFile.type,
      upsert: true,
    })

    if (upload.error) {
      setClubStatus(upload.error.message)
      return false
    }

    const { data } = client.storage.from('club-banners').getPublicUrl(path)
    return data.publicUrl
  }

  async function saveClubSettings(club: Club) {
    const {
      canManageClub,
      clubEditName,
      setClubStatus,
      text,
      setIsSavingClub,
      setBusyClubId,
      clubEditVisibility,
      clubEditMotto,
      clubEditDescription,
      clubEditThemeColor,
      clubEditDefaultLanguage,
      clubEditRankingCriterion,
      loadClubs,
      setClubBannerFile,
      setClubBannerPreview,
    } = getContext()

    if (!canManageClub(club)) return

    const name = clubEditName.trim()
    if (!name) {
      setClubStatus(text.clubRequired)
      return
    }

    setIsSavingClub(true)
    setBusyClubId(club.id)
    setClubStatus(text.saving)

    const bannerUrl = await uploadClubBanner(club)
    if (bannerUrl === false) {
      setIsSavingClub(false)
      setBusyClubId('')
      return
    }

    const nextPinCode = clubEditVisibility === 'private' ? club.pin_code || generateInviteCode() : null
    const { error } = await (await getSupabase())
      .from('clubs')
      .update({
        name,
        motto: clubEditMotto.trim() || null,
        description: clubEditDescription.trim() || null,
        banner_url: bannerUrl,
        theme_color: cleanHexColor(clubEditThemeColor, clubThemeColors[0]),
        visibility: clubEditVisibility,
        pin_code: nextPinCode,
        default_language: clubEditDefaultLanguage,
        ranking_criterion: clubEditRankingCriterion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', club.id)

    if (error) {
      setClubStatus(error.message)
      setIsSavingClub(false)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubBannerFile(null)
    setClubBannerPreview('')
    setClubStatus(text.clubSaved)
    setIsSavingClub(false)
    setBusyClubId('')
  }

  async function regenerateClubInviteCode(club: Club) {
    const { canManageClub, setBusyClubId, setClubStatus, loadClubs, text } = getContext()

    if (!canManageClub(club)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase())
      .from('clubs')
      .update({
        pin_code: generateInviteCode(),
        visibility: 'private',
        updated_at: new Date().toISOString(),
      })
      .eq('id', club.id)

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubInviteRegenerated)
    }
    setBusyClubId('')
  }

  async function shareClubInvite(club: Club) {
    const { text, setClubStatus } = getContext()

    const code = club.pin_code || ''
    const shareBody = club.visibility === 'private'
      ? `${club.name} · ${text.privateCode}: ${code}`
      : `${club.name} · ${DEFAULT_APP_URL}`

    if (navigator.share) {
      await navigator.share({ title: club.name, text: shareBody })
    } else {
      await navigator.clipboard?.writeText(shareBody)
      setClubStatus(text.copied)
    }
  }

  async function updateClubMemberRole(club: Club, member: ClubMember, role: ClubMemberRole) {
    const { manageableRoleOptions, setBusyClubId, setClubStatus, loadClubs, text } = getContext()

    if (!manageableRoleOptions(club, member).includes(role)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase())
      .from('club_members')
      .update({ role, status: 'approved' })
      .eq('id', member.id)

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubRoleUpdated)
    }
    setBusyClubId('')
  }

  async function transferClubOwnership(club: Club, member: ClubMember) {
    const { userId, isAdmin, text, setBusyClubId, setClubStatus, loadClubs } = getContext()

    if (!userId || (!isAdmin && club.owner_id !== userId)) return
    if (!window.confirm(text.transferOwnershipConfirm)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase()).rpc('transfer_club_ownership', {
      p_club_id: club.id,
      p_new_owner_id: member.profile_id,
    })

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubOwnershipTransferred)
    }
    setBusyClubId('')
  }

  async function notifyClubMembersOfSession(club: Club, sessionId: string) {
    const { userId, socialAvatarFields, networkDataLoadedRef, loadNetworkData } = getContext()

    const recipients = clubMembers(club)
      .filter((member) => member.status === 'approved' && member.profile_id !== userId)
      .slice(0, 80)

    if (recipients.length === 0) return

    const payloads = recipients.map((member) => {
      const snapshot = socialAvatarFields(member)
      return {
        session_id: sessionId,
        inviter_id: userId,
        recipient_id: member.profile_id,
        recipient_display_name: snapshot.display_name,
        recipient_avatar_url: snapshot.avatar_url,
        recipient_avatar_emoji: snapshot.avatar_emoji,
        recipient_avatar_initials: snapshot.avatar_initials,
        recipient_avatar_color: snapshot.avatar_color,
        recipient_avatar_text_color: snapshot.avatar_text_color,
        recipient_profile_motto: snapshot.profile_motto,
        status: 'pending',
      }
    })

    const { error } = await (await getSupabase())
      .from('session_invites')
      .upsert(payloads, { onConflict: 'session_id,recipient_id' })

    if (!error && networkDataLoadedRef.current) await loadNetworkData()
  }

  async function createClub() {
    const {
      requireProfile,
      profile,
      clubName,
      setClubStatus,
      text,
      setIsCreatingClub,
      clubVisibility,
      userId,
      clubDescription,
      avatarFields,
      setClubName,
      setClubDescription,
      setClubVisibility,
      loadClubs,
    } = getContext()

    if (!requireProfile()) return

    const activeProfile = profile
    const name = clubName.trim()

    if (!activeProfile) return

    if (!name) {
      setClubStatus(text.clubRequired)
      return
    }

    setIsCreatingClub(true)
    setClubStatus(text.creatingClub)

    const clubPinCode = clubVisibility === 'private' ? generateInviteCode() : null
    let savedClubPinCode = clubPinCode
    const client = await getSupabase()
    const clubPayload = {
      owner_id: userId,
      name,
      description: clubDescription.trim() || null,
      visibility: clubVisibility,
      pin_code: clubPinCode,
    }
    let clubResult = await client
      .from('clubs')
      .insert(clubPayload)
      .select('id')
      .single()

    if (clubResult.error && clubResult.error.message.toLowerCase().includes('pin_code')) {
      savedClubPinCode = null
      const fallbackClubPayload = {
        owner_id: clubPayload.owner_id,
        name: clubPayload.name,
        description: clubPayload.description,
        visibility: clubPayload.visibility,
      }
      clubResult = await client
        .from('clubs')
        .insert(fallbackClubPayload)
        .select('id')
        .single()
    }

    if (clubResult.error || !clubResult.data) {
      setClubStatus(clubResult.error?.message || text.createError)
      setIsCreatingClub(false)
      return
    }

    const memberResult = await client.from('club_members').insert({
      club_id: clubResult.data.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
      status: 'approved',
    })

    if (memberResult.error) {
      setClubStatus(memberResult.error.message)
      setIsCreatingClub(false)
      return
    }

    setClubName('')
    setClubDescription('')
    setClubVisibility('public')
    await loadClubs()
    setClubStatus(savedClubPinCode ? `${text.clubCreated} ${text.privateCode}: ${savedClubPinCode}` : text.clubCreated)
    setIsCreatingClub(false)
  }

  return {
    uploadClubBanner,
    saveClubSettings,
    regenerateClubInviteCode,
    shareClubInvite,
    updateClubMemberRole,
    transferClubOwnership,
    notifyClubMembersOfSession,
    createClub,
  }
}
