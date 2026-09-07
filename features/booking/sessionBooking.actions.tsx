'use client'

import { ageBandFromBirthday } from '../../lib/agePolicy'
import { getSupabase } from '../../lib/booking/client'
import {
  games,
  type GameId
} from '../../lib/bookingStaticData'
import {
  Participant,
  Session,
  displayName,
  generateInviteCode,
  isChallengeSession,
  isPastSession,
  isTicketSession
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'

export type SessionBookingActionContext = {
  isHaDoBookingVenue: boolean
  setCreateStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
  setIsCreating: React.Dispatch<React.SetStateAction<boolean>>
  requireProfile: () => boolean
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  sessionName: string
  sessionDate: string
  sessionTime: string
  sessionClubId: string
  clubs: import("../../lib/bookingWidgetDomain").Club[]
  canCreateClubSession: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => boolean
  consumeAppRateLimit: (action: "login_attempt" | "otp_request" | "join_leave" | "booking_attempt" | "admin_destructive" | "password_reset" | "invite_player" | "session_message" | "customer_invite" | "voucher_quote" | "staff_config_write", subject: string, setStatus?: (message: string) => void) => Promise<boolean>
  sessionVisibility: "public" | "private"
  userId: string
  sessionType: "tournament" | "game"
  sessionDuration: number
  sessionMaxPlayers: number
  sessionArenaCount: number
  selectedGames: import("../../lib/bookingStaticData").GameId[]
  sessionNotes: string
  tournamentFormat: import("../../lib/bookingWidgetDomain").TournamentFormat
  tournamentBestOf: 1 | 5 | 3
  tournamentRoundsPerMatch: number
  tournamentRequirePayment: boolean
  tournamentQualificationRule: import("../../lib/bookingWidgetDomain").QualificationRule
  tournamentCustomQualifiers: number
  tournamentThirdPlace: boolean
  tournamentFirstPrize: string
  tournamentSecondPrize: string
  tournamentThirdPrize: string
  avatarFields: (source: import("../../lib/bookingWidgetDomain").Profile) => { avatar_url: string | null; avatar_emoji: string | null; avatar_initials: string | null; avatar_color: string | null; avatar_text_color: string | null; profile_motto: string | null }
  notifyClubMembersOfSession: (club: import("../../lib/bookingWidgetDomain").Club, sessionId: string) => Promise<void>
  notifyMinorBookingCreated: (kind: "ticket" | "session", sessionId: string | null | undefined, sourceProfile: import("../../lib/bookingWidgetDomain").Profile | null) => Promise<void>
  showActionToast: (message: string) => void
  setSessionName: React.Dispatch<React.SetStateAction<string>>
  setSessionNotes: React.Dispatch<React.SetStateAction<string>>
  setSessionTime: React.Dispatch<React.SetStateAction<string>>
  setSessionDuration: React.Dispatch<React.SetStateAction<number>>
  setSessionMaxPlayers: React.Dispatch<React.SetStateAction<number>>
  setSessionArenaCount: React.Dispatch<React.SetStateAction<number>>
  setSessionClubId: React.Dispatch<React.SetStateAction<string>>
  setSessionType: React.Dispatch<React.SetStateAction<"tournament" | "game">>
  setTournamentFormat: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TournamentFormat>>
  setTournamentBestOf: React.Dispatch<React.SetStateAction<1 | 5 | 3>>
  setTournamentRoundsPerMatch: React.Dispatch<React.SetStateAction<number>>
  setTournamentRequirePayment: React.Dispatch<React.SetStateAction<boolean>>
  setTournamentQualificationRule: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").QualificationRule>>
  setTournamentCustomQualifiers: React.Dispatch<React.SetStateAction<number>>
  setTournamentThirdPlace: React.Dispatch<React.SetStateAction<boolean>>
  setTournamentFirstPrize: React.Dispatch<React.SetStateAction<string>>
  setTournamentSecondPrize: React.Dispatch<React.SetStateAction<string>>
  setTournamentThirdPrize: React.Dispatch<React.SetStateAction<string>>
  setSelectedGames: React.Dispatch<React.SetStateAction<import("../../lib/bookingStaticData").GameId[]>>
  setSessionVisibility: React.Dispatch<React.SetStateAction<"public" | "private">>
  loadSessions: (options?: { focusDate?: string | undefined }) => Promise<void>
  setActiveView: React.Dispatch<React.SetStateAction<import("../../components/AppSidebar").AppView>>
  hasSessionInvite: (sessionId: string, profileId: string) => boolean
  sessionClubFor: (session: import("../../lib/bookingWidgetDomain").Session) => import("../../lib/bookingWidgetDomain").Club | undefined
  canAccessClubSession: (session: import("../../lib/bookingWidgetDomain").Session) => boolean
  joinCodes: Record<string, string>
  setBusySessionId: React.Dispatch<React.SetStateAction<string>>
  fetchCurrentUserSessionParticipant: (sessionId: string) => Promise<import("../../lib/bookingWidgetDomain").Participant | null>
  mergeJoinedParticipantIntoSession: (sessionId: string, participant: import("../../lib/bookingWidgetDomain").Participant | null) => void
  loadSessionDetail: (sessionId: string, options?: { force?: boolean | undefined }) => Promise<import("../../lib/bookingWidgetDomain").Session | null>
  loadNetworkData: () => Promise<void>
  prepareJoinedSessionReminders: (session: import("../../lib/bookingWidgetDomain").Session) => Promise<void>
  waitlistPosition: (session: import("../../lib/bookingWidgetDomain").Session, profileId: string) => number | null
  softDeleteRecord: (entityTable: string, entityId: string, reason: string) => Promise<import("@supabase/postgrest-js").PostgrestSingleResponse<unknown>>
  canManageSession: (session: import("../../lib/bookingWidgetDomain").Session) => boolean
  setBusyVoteKey: React.Dispatch<React.SetStateAction<string>>
  confirmedGameDrafts: Record<string, string>
  setSessions: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Session[]>>
  setConfirmedGameDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingSessionBookingActions(getContext: () => SessionBookingActionContext) {
  async function createSession() {
    const {
      isHaDoBookingVenue,
      setCreateStatus,
      text,
      setIsCreating,
      requireProfile,
      profile,
      sessionName,
      sessionDate,
      sessionTime,
      sessionClubId,
      clubs,
      canCreateClubSession,
      consumeAppRateLimit,
      sessionVisibility,
      userId,
      sessionType,
      sessionDuration,
      sessionMaxPlayers,
      sessionArenaCount,
      selectedGames,
      sessionNotes,
      tournamentFormat,
      tournamentBestOf,
      tournamentRoundsPerMatch,
      tournamentRequirePayment,
      tournamentQualificationRule,
      tournamentCustomQualifiers,
      tournamentThirdPlace,
      tournamentFirstPrize,
      tournamentSecondPrize,
      tournamentThirdPrize,
      avatarFields,
      notifyClubMembersOfSession,
      notifyMinorBookingCreated,
      showActionToast,
      setSessionName,
      setSessionNotes,
      setSessionTime,
      setSessionDuration,
      setSessionMaxPlayers,
      setSessionArenaCount,
      setSessionClubId,
      setSessionType,
      setTournamentFormat,
      setTournamentBestOf,
      setTournamentRoundsPerMatch,
      setTournamentRequirePayment,
      setTournamentQualificationRule,
      setTournamentCustomQualifiers,
      setTournamentThirdPlace,
      setTournamentFirstPrize,
      setTournamentSecondPrize,
      setTournamentThirdPrize,
      setSelectedGames,
      setSessionVisibility,
      loadSessions,
      setActiveView,
    } = getContext()

    if (!isHaDoBookingVenue) {
      setCreateStatus(text.bookingVenueCafeComingSoonBody)
      setIsCreating(false)
      return
    }

    if (!requireProfile()) {
      setIsCreating(false)
      return
    }

    const activeProfile = profile

    if (!activeProfile) {
      setIsCreating(false)
      return
    }

    if (ageBandFromBirthday(activeProfile.birthday) === 'under13') {
      setCreateStatus(text.under13CreateBlocked)
      setIsCreating(false)
      return
    }

    if (!sessionName.trim() || !sessionDate || !sessionTime) {
      setCreateStatus(text.sessionRequired)
      setIsCreating(false)
      return
    }

    const selectedSessionClub = sessionClubId ? clubs.find((club) => club.id === sessionClubId) : undefined

    if (selectedSessionClub && !canCreateClubSession(selectedSessionClub)) {
      setCreateStatus(text.clubMembershipRequired)
      setIsCreating(false)
      return
    }

    const allowed = await consumeAppRateLimit('booking_attempt', `${sessionDate}:${sessionTime}`)
    if (!allowed) {
      setIsCreating(false)
      return
    }

    setIsCreating(true)
    setCreateStatus(text.creating)

    const effectiveVisibility = selectedSessionClub ? 'public' : sessionVisibility
    const inviteCode = effectiveVisibility === 'private' ? generateInviteCode() : null

    const { data: created, error } = await (await getSupabase())
      .from('sessions')
      .insert({
        owner_id: userId,
        club_id: sessionClubId || null,
        session_type: sessionType,
        name: sessionName.trim(),
        date: sessionDate,
        start_time: `${sessionTime}:00`,
        duration_minutes: sessionDuration,
        max_players: sessionMaxPlayers,
        arena_count: sessionArenaCount,
        game_options: selectedGames,
        game_votes: { [userId]: selectedGames[0] },
        confirmed_game_id: null,
        visibility: effectiveVisibility,
        invite_code: inviteCode,
        notes: sessionNotes.trim() || null,
        status: 'open',
        tournament_format: sessionType === 'tournament' ? tournamentFormat : null,
        best_of: sessionType === 'tournament' ? tournamentBestOf : 1,
        rounds_per_match: sessionType === 'tournament' ? tournamentRoundsPerMatch : null,
        require_payment: sessionType === 'tournament' ? tournamentRequirePayment : false,
        qualification_rule: sessionType === 'tournament' ? tournamentQualificationRule : null,
        custom_qualifiers: sessionType === 'tournament' ? tournamentCustomQualifiers : null,
        enable_third_place_match: sessionType === 'tournament' ? tournamentThirdPlace : false,
        first_prize: sessionType === 'tournament' ? tournamentFirstPrize.trim() || null : null,
        second_prize: sessionType === 'tournament' ? tournamentSecondPrize.trim() || null : null,
        third_prize: sessionType === 'tournament' ? tournamentThirdPrize.trim() || null : null,
        tournament_locked: false,
      })
      .select('id')
      .single()

    if (error || !created) {
      setCreateStatus(error?.message || text.createError)
      setIsCreating(false)
      return
    }

    await (await getSupabase()).from('session_participants').insert({
      session_id: created.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
    })

    if (selectedSessionClub) {
      await notifyClubMembersOfSession(selectedSessionClub, created.id)
    }

    await notifyMinorBookingCreated('session', created.id, activeProfile)

    setCreateStatus(
      sessionVisibility === 'private'
        ? `${text.privateCreated} ${inviteCode}`
        : text.sessionCreated
    )
    showActionToast(sessionVisibility === 'private' ? text.privateCreated : text.sessionCreated)

    setSessionName('')
    setSessionNotes('')
    setSessionTime('')
    setSessionDuration(20)
    setSessionMaxPlayers(4)
    setSessionArenaCount(1)
    setSessionClubId('')
    setSessionType('game')
    setTournamentFormat('pool_to_final')
    setTournamentBestOf(1)
    setTournamentRoundsPerMatch(1)
    setTournamentRequirePayment(false)
    setTournamentQualificationRule('top_1')
    setTournamentCustomQualifiers(2)
    setTournamentThirdPlace(true)
    setTournamentFirstPrize('')
    setTournamentSecondPrize('')
    setTournamentThirdPrize('')
    setSelectedGames(['laser-tag'])
    setSessionVisibility('public')
    await loadSessions({ focusDate: sessionDate })
    setActiveView('sessions')
    setIsCreating(false)
  }

  async function joinSession(session: Session) {
    const {
      requireProfile,
      setCreateStatus,
      text,
      userId,
      hasSessionInvite,
      profile,
      sessionClubFor,
      canAccessClubSession,
      joinCodes,
      consumeAppRateLimit,
      setBusySessionId,
      avatarFields,
      fetchCurrentUserSessionParticipant,
      mergeJoinedParticipantIntoSession,
      loadSessions,
      loadSessionDetail,
      loadNetworkData,
      showActionToast,
      prepareJoinedSessionReminders,
    } = getContext()

    if (!requireProfile()) return

    if (isTicketSession(session)) {
      setCreateStatus(text.privateTicketSession)
      return
    }

    if (isChallengeSession(session) && session.challenge_target_id !== userId && !hasSessionInvite(session.id, userId)) {
      setCreateStatus(text.challengeInviteOnly)
      return
    }

    const activeProfile = profile

    if (!activeProfile) return

    const sessionClub = sessionClubFor(session)
    if (sessionClub && !canAccessClubSession(session)) {
      setCreateStatus(text.clubMembershipRequired)
      return
    }

    const joinsWithPrivateCode = session.visibility === 'private' && !hasSessionInvite(session.id, userId)

    if (joinsWithPrivateCode) {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (!typedCode) {
        setCreateStatus(text.privateIncorrect)
        return
      }
    }

    const participants = session.session_participants ?? []
    if (participants.some((participant) => participant.profile_id === userId)) return

    if (participants.length >= session.max_players) {
      setCreateStatus(text.sessionFull)
      return
    }

    const allowed = await consumeAppRateLimit('join_leave', `join:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)

    const avatarPayload = avatarFields(activeProfile)
    const client = await getSupabase()
    let joinedParticipant: Participant | null = null
    const joinResult = joinsWithPrivateCode
      ? await client.rpc('join_private_session_with_code', {
        p_session_id: session.id,
        p_invite_code: (joinCodes[session.id] || '').trim().toUpperCase(),
        p_display_name: displayName(activeProfile),
        p_avatar_url: avatarPayload.avatar_url,
        p_avatar_emoji: avatarPayload.avatar_emoji,
        p_avatar_initials: avatarPayload.avatar_initials,
        p_avatar_color: avatarPayload.avatar_color,
        p_avatar_text_color: avatarPayload.avatar_text_color,
        p_profile_motto: avatarPayload.profile_motto,
      })
      : await client.from('session_participants').insert({
        session_id: session.id,
        profile_id: userId,
        display_name: displayName(activeProfile),
        ...avatarPayload,
      })

    if (joinResult.error) {
      setCreateStatus(joinResult.error.message)
      setBusySessionId('')
      return
    }

    joinedParticipant = await fetchCurrentUserSessionParticipant(session.id)

    mergeJoinedParticipantIntoSession(session.id, joinedParticipant)

    await client
      .from('session_waitlist')
      .delete()
      .eq('session_id', session.id)
      .eq('profile_id', userId)

    await client
      .from('session_invites')
      .update({ status: 'accepted' })
      .eq('session_id', session.id)
      .eq('recipient_id', userId)

    await loadSessions({ focusDate: session.date })
    await loadSessionDetail(session.id, { force: true })
    mergeJoinedParticipantIntoSession(session.id, joinedParticipant)
    await loadNetworkData()
    setBusySessionId('')
    setCreateStatus(text.joinedSession)
    showActionToast(text.joinedSession)
    await prepareJoinedSessionReminders(session)
  }

  async function joinWaitlist(session: Session) {
    const {
      requireProfile,
      setCreateStatus,
      text,
      profile,
      sessionClubFor,
      canAccessClubSession,
      hasSessionInvite,
      userId,
      joinCodes,
      waitlistPosition,
      consumeAppRateLimit,
      setBusySessionId,
      avatarFields,
      loadSessions,
    } = getContext()

    if (!requireProfile()) return

    if (isTicketSession(session)) {
      setCreateStatus(text.privateTicketSession)
      return
    }

    if (isChallengeSession(session)) {
      setCreateStatus(text.challengeInviteOnly)
      return
    }

    const activeProfile = profile
    if (!activeProfile) return

    const sessionClub = sessionClubFor(session)
    if (sessionClub && !canAccessClubSession(session)) {
      setCreateStatus(text.clubMembershipRequired)
      return
    }

    const waitlistsWithPrivateCode = session.visibility === 'private' && !hasSessionInvite(session.id, userId)

    if (waitlistsWithPrivateCode) {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (!typedCode) {
        setCreateStatus(text.privateIncorrect)
        return
      }
    }

    const participants = session.session_participants ?? []
    if (participants.some((participant) => participant.profile_id === userId)) return
    if (waitlistPosition(session, userId)) return

    const allowed = await consumeAppRateLimit('join_leave', `waitlist:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)

    const avatarPayload = avatarFields(activeProfile)
    const waitlistResult = waitlistsWithPrivateCode
      ? await (await getSupabase()).rpc('join_private_session_waitlist_with_code', {
        p_session_id: session.id,
        p_invite_code: (joinCodes[session.id] || '').trim().toUpperCase(),
        p_display_name: displayName(activeProfile),
        p_avatar_url: avatarPayload.avatar_url,
        p_avatar_emoji: avatarPayload.avatar_emoji,
        p_avatar_initials: avatarPayload.avatar_initials,
        p_avatar_color: avatarPayload.avatar_color,
        p_avatar_text_color: avatarPayload.avatar_text_color,
        p_profile_motto: avatarPayload.profile_motto,
      })
      : await (await getSupabase()).from('session_waitlist').insert({
        session_id: session.id,
        profile_id: userId,
        display_name: displayName(activeProfile),
        ...avatarPayload,
      })

    if (waitlistResult.error) {
      setCreateStatus(waitlistResult.error.message)
      setBusySessionId('')
      return
    }

    await loadSessions({ focusDate: session.date })
    setCreateStatus(text.waitlistJoined)
    setBusySessionId('')
  }

  async function leaveSession(session: Session) {
    const { requireProfile, userId, setCreateStatus, text, consumeAppRateLimit, setBusySessionId, softDeleteRecord, loadSessions } = getContext()

    if (!requireProfile()) return

    if (session.owner_id === userId) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.leaveConfirmPrefix} "${session.name}"? ${text.leaveConfirmSuffix}`)
    if (!confirmed) return

    const participant = (session.session_participants ?? []).find((item) => item.profile_id === userId)
    if (!participant) return

    const allowed = await consumeAppRateLimit('join_leave', `leave:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)
    const { error } = await softDeleteRecord('session_participants', participant.id, 'User left session')

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.leftSession)
    setBusySessionId('')
  }

  async function voteForGame(session: Session, gameId: GameId) {
    const { requireProfile, canManageSession, setBusyVoteKey, userId, setCreateStatus, loadSessions, text } = getContext()

    if (!requireProfile()) return
    if (isPastSession(session) && !canManageSession(session)) return

    const voteKey = `${session.id}-${gameId}`
    setBusyVoteKey(voteKey)
    const votes = { ...(session.game_votes || {}), [userId]: gameId }
    const { error } = await (await getSupabase()).from('sessions').update({ game_votes: votes }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusyVoteKey('')
      return
    }

    await loadSessions()
    setCreateStatus(text.voteSaved)
    setBusyVoteKey('')
  }

  async function confirmPlayedGame(session: Session) {
    const { canManageSession, setCreateStatus, text, confirmedGameDrafts, setBusySessionId, setSessions, setConfirmedGameDrafts, loadSessions } = getContext()

    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyEdit)
      return
    }

    const selectedGameId = confirmedGameDrafts[session.id] || session.confirmed_game_id || ''
    const validGameId = games.some((game) => game.id === selectedGameId) ? selectedGameId : null

    setBusySessionId(session.id)
    const { error } = await (await getSupabase())
      .from('sessions')
      .update({ confirmed_game_id: validGameId })
      .eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    setSessions((current) =>
      current.map((item) =>
        item.id === session.id
          ? { ...item, confirmed_game_id: validGameId as GameId | null }
          : item
      )
    )
    setConfirmedGameDrafts((current) => ({ ...current, [session.id]: validGameId || '' }))
    await loadSessions()
    setCreateStatus(text.confirmedPlayedGame)
    setBusySessionId('')
  }

  return { createSession, joinSession, joinWaitlist, leaveSession, voteForGame, confirmPlayedGame }
}
