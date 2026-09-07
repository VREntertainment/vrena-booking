'use client'

import type { LeaderboardCriterion } from '../../components/LeaderboardPanel'
import {
  clubThemeColors
} from '../../lib/bookingStaticData'
import {
  Club,
  ClubMember,
  ClubMemberRole,
  ClubRole,
  Session,
  cleanHexColor,
  clubMembers,
  clubRoleForProfile
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import {
  isLeaderboardCriterion
} from '../../lib/leaderboard'

export type ClubAccessActionContext = {
  userId: string
  text: TranslationMap
  isAdmin: boolean
  unlockedClubIds: Record<string, boolean>
  clubs: import("../../lib/bookingWidgetDomain").Club[]
}

/** Pure access decisions use the current authenticated render; server authorization remains authoritative. */
export function createBookingClubAccessActions(context: ClubAccessActionContext) {
  function clubRoleFor(club: Club, profileId = context.userId): ClubRole {

    return clubRoleForProfile(club, profileId)
  }

  function clubRoleLabel(role: ClubRole) {
    const { text } = context

    if (role === 'owner') return text.ownerRole
    if (role === 'admin') return text.adminRole
    if (role === 'moderator') return text.moderatorRole
    return text.memberRole
  }

  function canManageClub(club: Club) {
    const { userId, isAdmin } = context

    const role = clubRoleFor(club)
    return Boolean(userId && (isAdmin || role === 'owner' || role === 'admin'))
  }

  function canModerateClubMembers(club: Club) {
    const { userId, isAdmin } = context

    const role = clubRoleFor(club)
    return Boolean(userId && (isAdmin || role === 'owner' || role === 'admin' || role === 'moderator'))
  }

  function canManageClubMember(club: Club, member: ClubMember) {
    const { userId, isAdmin } = context

    if (!userId) return false
    if (member.profile_id === club.owner_id) return false
    if (isAdmin) return true

    const actorRole = clubRoleFor(club)
    const targetRole = clubRoleFor(club, member.profile_id)

    if (actorRole === 'owner') return true
    if (actorRole === 'admin') return targetRole === 'moderator' || targetRole === 'member'
    if (actorRole === 'moderator') return targetRole === 'member'
    return false
  }

  function manageableRoleOptions(club: Club, member: ClubMember): ClubMemberRole[] {
    const { isAdmin } = context

    if (!canManageClubMember(club, member)) return []
    if (isAdmin || clubRoleFor(club) === 'owner') return ['admin', 'moderator', 'member']
    if (clubRoleFor(club) === 'admin') return ['moderator', 'member']
    return ['member']
  }

  function clubThemeStyle(club: Club | undefined) {
    const color = clubTheme(club)
    return {
      '--club-theme': color,
      '--club-theme-soft': `${color}24`,
      '--club-theme-faint': `${color}12`,
    } as Record<string, string>
  }

  function isDuplicateClubMembershipError(error: { code?: string; message?: string } | null | undefined) {
    const message = error?.message?.toLowerCase() || ''
    return error?.code === '23505' || message.includes('club_members_active_club_profile_key')
  }

  function approvedClubMember(club: Club, profileId = context.userId) {

    return clubMembers(club).some((member) => member.profile_id === profileId && member.status === 'approved')
  }

  function canEnterPrivateClubPage(club: Club | undefined) {
    const { userId, unlockedClubIds } = context

    if (!club) return false
    if (club.visibility !== 'private') return true
    if (!userId) return false
    return club.owner_id === userId || approvedClubMember(club) || Boolean(unlockedClubIds[club.id])
  }

  function canSeeClubPrivateData(club: Club | undefined) {
    if (!club) return true
    if (club.visibility === 'public') return true
    return canEnterPrivateClubPage(club) || canManageClub(club)
  }

  function canOpenClubPage(club: Club | undefined) {
    const { userId } = context

    if (!club) return false
    if (!userId) return false
    if (club.visibility === 'private') return canEnterPrivateClubPage(club)
    return canSeeClubPrivateData(club)
  }

  function canCreateClubSession(club: Club | undefined) {
    if (!club) return false
    return canManageClub(club) || approvedClubMember(club)
  }

  function sessionClubFor(session: Session) {
    const { clubs } = context

    return session.club_id ? clubs.find((club) => club.id === session.club_id) : undefined
  }

  function clubMembershipFor(club: Club | undefined, profileId = context.userId) {

    if (!club || !profileId) return undefined
    return clubMembers(club).find((member) => member.profile_id === profileId)
  }

  function canAccessClubSession(session: Session) {
    const club = sessionClubFor(session)
    if (!club) return true
    return canSeeClubPrivateData(club)
  }

  return {
    clubRoleFor,
    clubRoleLabel,
    canManageClub,
    canModerateClubMembers,
    canManageClubMember,
    manageableRoleOptions,
    clubTheme,
    clubRankingCriterion,
    clubThemeStyle,
    isDuplicateClubMembershipError,
    approvedClubMember,
    canEnterPrivateClubPage,
    canSeeClubPrivateData,
    canOpenClubPage,
    canCreateClubSession,
    sessionClubFor,
    clubMembershipFor,
    canAccessClubSession,
  }
}

export function clubRankingCriterion(club: Club | undefined): LeaderboardCriterion {
  const criterion = club?.ranking_criterion
  if (criterion === 'projectiles') return 'hits'
  return isLeaderboardCriterion(criterion) ? criterion : 'totalScore'
}

export function clubTheme(club: Club | undefined) {
  return cleanHexColor(club?.theme_color || '', clubThemeColors[0])
}
