'use client'

import { getSupabase } from '../../lib/booking/client'
import {
  CLUB_LIST_SELECT,
  CLUB_LIST_SELECT_BASE,
  CLUB_LIST_WITH_MEMBERS_SELECT,
  CLUB_LIST_WITH_MEMBERS_SELECT_BASE,
  CLUB_MEMBER_SELECT,
  CLUB_MEMBER_SELECT_BASE,
  CLUB_MESSAGE_SELECT,
  CLUB_PUBLIC_SELECT
} from '../../lib/bookingStaticData'
import {
  Club,
  ClubListPageRow,
  ClubMember,
  ClubMessage,
  clubMembers,
  mergeClubRecords,
  mergeCurrentUserClubMembership,
  normalizeClubListPageRow
} from '../../lib/bookingWidgetDomain'
import { CLUB_MESSAGE_LIMIT } from './shared'

export type ClubDataActionContext = {
  clubsLoadingRef: React.RefObject<boolean>
  userId: string
  setClubStatus: React.Dispatch<React.SetStateAction<string>>
  clubsLoadedRef: React.RefObject<boolean>
  clubsLoadedForUserIdRef: React.RefObject<string | null>
  setClubs: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Club[]>>
  canUseClubMessages: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => boolean
  loadedClubMessagesRef: React.RefObject<Set<string>>
  setIsLoadingClubMessages: React.Dispatch<React.SetStateAction<boolean>>
  setClubMessageStatus: React.Dispatch<React.SetStateAction<string>>
  sortClubMessages: (messages: import("../../lib/bookingWidgetDomain").ClubMessage[]) => import("../../lib/bookingWidgetDomain").ClubMessage[]
  setClubMessages: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").ClubMessage[]>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingClubDataActions(getContext: () => ClubDataActionContext) {
  async function loadClubs() {
    const { clubsLoadingRef, userId, setClubStatus, clubsLoadedRef, clubsLoadedForUserIdRef, setClubs } = getContext()

    clubsLoadingRef.current = true
    const client = await getSupabase()
    const clubsPageResult = await client.rpc('clubs_list_page')
    let data = Array.isArray(clubsPageResult.data)
      ? (clubsPageResult.data as ClubListPageRow[]).map(normalizeClubListPageRow)
      : null
    let error = clubsPageResult.error
    const publicResult = await client
      .from('clubs')
      .select(CLUB_PUBLIC_SELECT)
      .order('created_at', { ascending: false })

    if (!userId) {
      const publicClubs = publicResult.error ? [] : (publicResult.data ?? []) as Club[]
      const loadedClubs = mergeClubRecords(data ?? [], publicClubs.map((club) => ({ ...club, club_members: [] })))

      if (error && publicResult.error && loadedClubs.length === 0) {
        setClubStatus(error.message || publicResult.error.message)
        clubsLoadingRef.current = false
        return
      }

      clubsLoadedRef.current = true
      clubsLoadedForUserIdRef.current = ''
      clubsLoadingRef.current = false
      setClubs(loadedClubs)
      return
    }

    if (error || !data) {
      const result = await client
        .from('clubs')
        .select(CLUB_LIST_WITH_MEMBERS_SELECT)
        .order('created_at', { ascending: false })
      data = result.data as Club[] | null
      error = result.error

      if (error) {
        const fallbackResult = await client
          .from('clubs')
          .select(CLUB_LIST_WITH_MEMBERS_SELECT_BASE)
          .order('created_at', { ascending: false })
        data = fallbackResult.data as Club[] | null
        error = fallbackResult.error
      }

      if (error) {
        const fallbackResult = await client
          .from('clubs')
          .select(CLUB_LIST_SELECT)
          .order('created_at', { ascending: false })
        data = fallbackResult.data as Club[] | null
        error = fallbackResult.error
      }

      if (error) {
        const fallbackResult = await client
          .from('clubs')
          .select(CLUB_LIST_SELECT_BASE)
          .order('created_at', { ascending: false })
        data = fallbackResult.data as Club[] | null
        error = fallbackResult.error
      }
    }

    const publicClubs = publicResult.error ? [] : (publicResult.data ?? []) as Club[]
    const loadedClubs = mergeClubRecords(data ?? [], publicClubs)

    if (error && publicClubs.length === 0) {
      setClubStatus(error.message)
      clubsLoadingRef.current = false
      return
    }

    const clubIds = loadedClubs.map((club) => club.id)
    const membershipsByClubId = new Map<string, ClubMember[]>()
    loadedClubs.forEach((club) => {
      const members = clubMembers(club)
      if (members.length > 0) membershipsByClubId.set(club.id, members)
    })
    if (clubIds.length > 0) {
      const membersResult = await client
        .from('club_members')
        .select(CLUB_MEMBER_SELECT)
        .in('club_id', clubIds)
        .is('deleted_at', null)

      let membersData = membersResult.data as ClubMember[] | null
      let membersError = membersResult.error

      if (membersError) {
        const fallbackMembersResult = await client
          .from('club_members')
          .select(CLUB_MEMBER_SELECT_BASE)
          .in('club_id', clubIds)
          .is('deleted_at', null)

        membersData = fallbackMembersResult.data as ClubMember[] | null
        membersError = fallbackMembersResult.error
      }

      if (!membersError) {
        const visibleMembers = membersData ?? []
        visibleMembers.forEach((member) => {
          const members = membershipsByClubId.get(member.club_id) ?? []
          if (!members.some((existingMember) => existingMember.id === member.id)) members.push(member)
          membershipsByClubId.set(member.club_id, members)
        })
      }
    }

    let currentUserMemberships: ClubMember[] = []
    if (userId) {
      const membershipResult = await client
        .from('club_members')
        .select(CLUB_MEMBER_SELECT)
        .eq('profile_id', userId)
        .is('deleted_at', null)

      let membershipData = membershipResult.data as ClubMember[] | null
      let membershipError = membershipResult.error

      if (membershipError) {
        const fallbackMembershipResult = await client
          .from('club_members')
          .select(CLUB_MEMBER_SELECT_BASE)
          .eq('profile_id', userId)
          .is('deleted_at', null)

        membershipData = fallbackMembershipResult.data as ClubMember[] | null
        membershipError = fallbackMembershipResult.error
      }

      if (!membershipError) {
        currentUserMemberships = membershipData ?? []
      }
    }

    clubsLoadedRef.current = true
    clubsLoadedForUserIdRef.current = userId
    clubsLoadingRef.current = false
    setClubs(loadedClubs.map((club) => mergeCurrentUserClubMembership({
      ...club,
      club_members: membershipsByClubId.get(club.id) ?? [],
    }, currentUserMemberships)))
  }

  async function loadClubMessages(club: Club, force = false) {
    const { canUseClubMessages, loadedClubMessagesRef, setIsLoadingClubMessages, setClubMessageStatus, sortClubMessages, setClubMessages } = getContext()

    if (!canUseClubMessages(club)) return
    if (!force && loadedClubMessagesRef.current.has(club.id)) return

    setIsLoadingClubMessages(true)
    const { data, error } = await (await getSupabase())
      .from('club_messages')
      .select(CLUB_MESSAGE_SELECT)
      .eq('club_id', club.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(CLUB_MESSAGE_LIMIT)

    setIsLoadingClubMessages(false)

    if (error) {
      setClubMessageStatus(error.message)
      return
    }

    const rows = sortClubMessages((data ?? []) as ClubMessage[])
    loadedClubMessagesRef.current.add(club.id)
    setClubMessages((current) => [
      ...current.filter((message) => message.club_id !== club.id),
      ...rows,
    ])
  }

  return { loadClubs, loadClubMessages }
}
