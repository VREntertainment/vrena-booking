'use client'

import { getSupabase } from '../../lib/booking/client'
import {
  CLUB_MEMBER_SELECT,
  CLUB_MEMBER_SELECT_BASE
} from '../../lib/bookingStaticData'
import {
  Club,
  ClubMember,
  clubMembers,
  displayName
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'

export type ClubMembershipActionContext = {
  requireProfile: () => boolean
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  userId: string
  setClubStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
  showActionToast: (message: string) => void
  setBusyClubId: React.Dispatch<React.SetStateAction<string>>
  loadClubs: () => Promise<void>
  avatarFields: (source: import("../../lib/bookingWidgetDomain").Profile) => { avatar_url: string | null; avatar_emoji: string | null; avatar_initials: string | null; avatar_color: string | null; avatar_text_color: string | null; profile_motto: string | null }
  isDuplicateClubMembershipError: (error: { code?: string | undefined; message?: string | undefined } | null | undefined) => boolean
  clubs: import("../../lib/bookingWidgetDomain").Club[]
  canModerateClubMembers: (club: import("../../lib/bookingWidgetDomain").Club) => boolean
  canManageClubMember: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember) => boolean
  softDeleteRecord: (entityTable: string, entityId: string, reason: string) => Promise<import("@supabase/postgrest-js").PostgrestSingleResponse<unknown>>
  leaveClubConfirmText: string
  leftClubText: string
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingClubMembershipActions(getContext: () => ClubMembershipActionContext) {
  async function joinClub(club: Club) {
    const {
      requireProfile,
      profile,
      userId,
      setClubStatus,
      text,
      showActionToast,
      setBusyClubId,
      loadClubs,
      avatarFields,
      isDuplicateClubMembershipError,
    } = getContext()

    if (!requireProfile()) return

    const activeProfile = profile
    if (!activeProfile) return

    const currentMembership = clubMembers(club).find((member) => member.profile_id === userId)
    if (currentMembership) {
      setClubStatus(currentMembership.status === 'pending' ? text.requestSent : text.joinedClub)
      showActionToast(currentMembership.status === 'pending' ? text.requestSent : text.joinedClub)
      return
    }

    setBusyClubId(club.id)
    const client = await getSupabase()
    const desiredStatus = club.visibility === 'private' ? 'pending' : 'approved'
    const existingMembershipResult = await client
      .from('club_members')
      .select(CLUB_MEMBER_SELECT)
      .eq('club_id', club.id)
      .eq('profile_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingMembershipResult.error) {
      const fallbackMembershipResult = await client
        .from('club_members')
        .select(CLUB_MEMBER_SELECT_BASE)
        .eq('club_id', club.id)
        .eq('profile_id', userId)
        .is('deleted_at', null)
        .maybeSingle()

      if (fallbackMembershipResult.error) {
        setClubStatus(fallbackMembershipResult.error.message)
        setBusyClubId('')
        return
      }

      if (fallbackMembershipResult.data) {
        await loadClubs()
        setClubStatus(fallbackMembershipResult.data.status === 'pending' ? text.requestSent : text.joinedClub)
        showActionToast(fallbackMembershipResult.data.status === 'pending' ? text.requestSent : text.joinedClub)
        setBusyClubId('')
        return
      }
    } else if (existingMembershipResult.data) {
      await loadClubs()
      setClubStatus(existingMembershipResult.data.status === 'pending' ? text.requestSent : text.joinedClub)
      showActionToast(existingMembershipResult.data.status === 'pending' ? text.requestSent : text.joinedClub)
      setBusyClubId('')
      return
    }

    const { error } = await client.from('club_members').insert({
      club_id: club.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
      status: desiredStatus,
    })

    if (error) {
      if (isDuplicateClubMembershipError(error)) {
        await loadClubs()
        setClubStatus(desiredStatus === 'pending' ? text.requestSent : text.joinedClub)
        showActionToast(desiredStatus === 'pending' ? text.requestSent : text.joinedClub)
      } else {
        setClubStatus(error.message)
      }
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(club.visibility === 'private' ? text.requestSent : text.joinedClub)
    showActionToast(club.visibility === 'private' ? text.requestSent : text.joinedClub)
    setBusyClubId('')
  }

  async function approveClubMember(member: ClubMember) {
    const { clubs, canModerateClubMembers, setBusyClubId, setClubStatus, loadClubs, text } = getContext()

    const club = clubs.find((item) => item.id === member.club_id)
    if (!club || !canModerateClubMembers(club)) return

    setBusyClubId(member.club_id)
    const { error } = await (await getSupabase()).from('club_members').update({ status: 'approved', role: 'member' }).eq('id', member.id)

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(text.memberApproved)
    setBusyClubId('')
  }

  async function removeClubMember(club: Club, member: ClubMember) {
    const { canManageClubMember, text, setBusyClubId, softDeleteRecord, setClubStatus, loadClubs } = getContext()

    if (!canManageClubMember(club, member)) return

    if (!window.confirm(text.removeMemberConfirm)) return

    setBusyClubId(club.id)
    const { error } = await softDeleteRecord('club_members', member.id, 'Removed from club')

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(text.memberRemoved)
    setBusyClubId('')
  }

  async function leaveClub(club: Club, member: ClubMember) {
    const { userId, leaveClubConfirmText, setBusyClubId, softDeleteRecord, setClubStatus, loadClubs, leftClubText } = getContext()

    if (!userId || member.profile_id !== userId || club.owner_id === userId) return

    if (!window.confirm(leaveClubConfirmText)) return

    setBusyClubId(club.id)
    const { error } = await softDeleteRecord('club_members', member.id, 'User left club')

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(leftClubText)
    setBusyClubId('')
  }

  return { joinClub, approveClubMember, removeClubMember, leaveClub }
}
