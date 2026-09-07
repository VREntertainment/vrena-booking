'use client'

import { ageBandFromBirthday } from '../../lib/agePolicy'
import { getSupabase } from '../../lib/booking/client'
import {
  CLUB_MESSAGE_SELECT
} from '../../lib/bookingStaticData'
import {
  Club,
  ClubMessage
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { CLUB_MESSAGE_MAX_LENGTH } from './shared'

export type ClubMessagesActionContext = {
  requireProfile: () => boolean
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  setClubMessageStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
  clubPublicMessageDrafts: Record<string, string>
  clubAdminMessageDrafts: Record<string, string>
  setBusyMessageKey: React.Dispatch<React.SetStateAction<string>>
  profileAvatarSnapshot: (source: import("../../lib/bookingWidgetDomain").Profile) => { avatar_url: string | null; avatar_emoji: string | null; avatar_initials: string | null; avatar_color: string | null; avatar_text_color: string | null; profile_motto: string | null; display_name: string }
  userId: string
  setClubPublicMessageDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setClubAdminMessageDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  loadedClubMessagesRef: React.RefObject<Set<string>>
  setClubMessages: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").ClubMessage[]>>
  canManageClub: (club: import("../../lib/bookingWidgetDomain").Club) => boolean
  approvedClubMember: (club: import("../../lib/bookingWidgetDomain").Club, profileId?: string) => boolean
  clubMessages: import("../../lib/bookingWidgetDomain").ClubMessage[]
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingClubMessagesActions(getContext: () => ClubMessagesActionContext) {
  async function postClubMessage(club: Club, messageType: ClubMessage['message_type']) {
    const {
      requireProfile,
      profile,
      setClubMessageStatus,
      text,
      clubPublicMessageDrafts,
      clubAdminMessageDrafts,
      setBusyMessageKey,
      profileAvatarSnapshot,
      userId,
      setClubPublicMessageDrafts,
      setClubAdminMessageDrafts,
      loadedClubMessagesRef,
    } = getContext()

    if (!requireProfile() || !profile) return
    if (ageBandFromBirthday(profile.birthday) === 'under13') {
      setClubMessageStatus(text.under13MessageBlocked)
      return
    }
    if (!canUseClubMessages(club)) {
      setClubMessageStatus(text.clubMessageLoginRequired)
      return
    }

    const drafts = messageType === 'public' ? clubPublicMessageDrafts : clubAdminMessageDrafts
    const body = (drafts[club.id] || '').trim()
    if (!body) return

    if (Array.from(body).length > CLUB_MESSAGE_MAX_LENGTH) {
      setClubMessageStatus(text.clubMessageTooLong)
      return
    }

    const messageKey = `${club.id}-${messageType}`
    setBusyMessageKey(messageKey)
    setClubMessageStatus('')

    const avatarSnapshot = profileAvatarSnapshot(profile)
    const { data, error } = await (await getSupabase())
      .from('club_messages')
      .insert({
        club_id: club.id,
        author_id: userId,
        author_display_name: avatarSnapshot.display_name,
        author_avatar_url: avatarSnapshot.avatar_url,
        author_avatar_emoji: avatarSnapshot.avatar_emoji,
        author_avatar_initials: avatarSnapshot.avatar_initials,
        author_avatar_color: avatarSnapshot.avatar_color,
        author_avatar_text_color: avatarSnapshot.avatar_text_color,
        author_profile_motto: avatarSnapshot.profile_motto || null,
        message_type: messageType,
        body,
      })
      .select(CLUB_MESSAGE_SELECT)
      .single()

    if (error) {
      setClubMessageStatus(error.message)
    } else {
      if (messageType === 'public') {
        setClubPublicMessageDrafts((current) => ({ ...current, [club.id]: '' }))
      } else {
        setClubAdminMessageDrafts((current) => ({ ...current, [club.id]: '' }))
      }
      if (data) mergeClubMessage(data as ClubMessage)
      loadedClubMessagesRef.current.add(club.id)
      setClubMessageStatus(text.clubMessagePosted)
    }

    setBusyMessageKey('')
  }

  function sortClubMessages(messages: ClubMessage[]) {
    return [...messages].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0
      const right = b.created_at ? new Date(b.created_at).getTime() : 0
      return left - right || a.id.localeCompare(b.id)
    })
  }

  function mergeClubMessage(message: ClubMessage) {
    const { setClubMessages } = getContext()

    setClubMessages((current) => sortClubMessages([
      ...current.filter((item) => item.id !== message.id),
      message,
    ]))
  }

  function canUseClubMessages(club: Club | undefined) {
    const { userId, canManageClub, approvedClubMember } = getContext()

    if (!club || !userId) return false
    return canManageClub(club) || club.owner_id === userId || approvedClubMember(club)
  }

  function canSeeClubAdminMessage(club: Club, message: ClubMessage) {
    const { userId, canManageClub } = getContext()

    return message.message_type === 'public' || message.author_id === userId || canManageClub(club)
  }

  function messagesForClub(club: Club, messageType: ClubMessage['message_type']) {
    const { clubMessages } = getContext()

    return sortClubMessages(clubMessages.filter((message) => (
      message.club_id === club.id
      && message.message_type === messageType
      && canSeeClubAdminMessage(club, message)
    )))
  }

  return { postClubMessage, sortClubMessages, mergeClubMessage, canUseClubMessages, canSeeClubAdminMessage, messagesForClub }
}
