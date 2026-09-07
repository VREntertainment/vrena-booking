'use client'

import { getSupabase } from '../../lib/booking/client'
import {
  SESSION_CARD_SELECT,
  SESSION_CARD_SELECT_BASE,
  SESSION_SELECT,
  SESSION_SELECT_BASE,
  WAITLIST_POSITION_SELECT,
  WAITLIST_SELECT
} from '../../lib/bookingStaticData'
import {
  BlockedTime,
  Profile,
  SESSION_LOAD_BATCH_DAYS,
  Session,
  SessionInvite,
  SessionListPageResult,
  WaitlistEntry,
  addDaysToDateValue,
  isPastSession,
  isUpcomingSession,
  localDateString,
  maxDateValue,
  sortSessionsByStart,
  upcomingBatchEndForDate
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'

export type SessionLoadingActionContext = {
  sessionDetailsLoadedRef: React.RefObject<Set<string>>
  sessions: import("../../lib/bookingWidgetDomain").Session[]
  sessionDetailsLoadingRef: React.RefObject<Set<string>>
  setLoadingSessionDetailIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  sessionDetailFromRpcPayload: (value: unknown) => { session: import("../../lib/bookingWidgetDomain").Session | null; invites: import("../../lib/bookingWidgetDomain").SessionInvite[]; scoreAdjustments: { [k: string]: number } }
  setSessions: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").Session[]>>
  setSessionInvites: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").SessionInvite[]>>
  setProfileScoreAdjustments: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setLoadedSessionDetailIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  optionalSessionMetadataMissing: (error: { message?: string | undefined } | null | undefined) => boolean
  setCreateStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
  normalizeSessionRow: (session: import("../../lib/bookingWidgetDomain").Session) => import("../../lib/bookingWidgetDomain").Session
  userId: string
  sessionPageFromRpcPayload: (value: unknown) => import("../../lib/bookingWidgetDomain").SessionListPageResult
  loadingSessionRangeRef: React.RefObject<boolean>
  sessionsLoadedRef: React.RefObject<boolean>
  loadExpandedSessionDetails: () => void
  setBlockedTimes: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").BlockedTime[]>>
  setHasMoreUpcomingSessions: React.Dispatch<React.SetStateAction<boolean>>
  upcomingSessionsThroughRef: React.RefObject<string>
  isLoadingMoreSessions: boolean
  hasMoreUpcomingSessions: boolean
  setIsLoadingMoreSessions: React.Dispatch<React.SetStateAction<boolean>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingSessionLoadingActions(getContext: () => SessionLoadingActionContext) {
  async function loadSessionDetail(sessionId: string, options: { force?: boolean } = {}) {
    const {
      sessionDetailsLoadedRef,
      sessions,
      sessionDetailsLoadingRef,
      setLoadingSessionDetailIds,
      sessionDetailFromRpcPayload,
      setSessions,
      setSessionInvites,
      setProfileScoreAdjustments,
      setLoadedSessionDetailIds,
      optionalSessionMetadataMissing,
      setCreateStatus,
      text,
      normalizeSessionRow,
      userId,
    } = getContext()

    if (!sessionId) return null
    if (!options.force && sessionDetailsLoadedRef.current.has(sessionId)) {
      return sessions.find((session) => session.id === sessionId) ?? null
    }
    if (sessionDetailsLoadingRef.current.has(sessionId)) return null

    sessionDetailsLoadingRef.current.add(sessionId)
    setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: true }))

    const client = await getSupabase()
    const rpcDetailResult = await client.rpc('session_detail', { p_session_id: sessionId })

    if (!rpcDetailResult.error && rpcDetailResult.data) {
      const { session: detailSession, invites: inviteRows, scoreAdjustments } = sessionDetailFromRpcPayload(rpcDetailResult.data)

      if (detailSession) {
        setSessions((currentSessions) => {
          const sessionsById = new Map(currentSessions.map((session) => [session.id, session]))
          sessionsById.set(sessionId, detailSession)
          return sortSessionsByStart(Array.from(sessionsById.values()))
        })
        setSessionInvites((current) => [
          ...current.filter((invite) => invite.session_id !== sessionId),
          ...inviteRows,
        ])
        if (Object.keys(scoreAdjustments).length > 0) {
          setProfileScoreAdjustments((current) => ({
            ...current,
            ...scoreAdjustments,
          }))
        }

        sessionDetailsLoadedRef.current.add(sessionId)
        sessionDetailsLoadingRef.current.delete(sessionId)
        setLoadedSessionDetailIds((current) => ({ ...current, [sessionId]: true }))
        setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
        return detailSession
      }
    }

    let detailResult = await client
      .from('sessions')
      .select(SESSION_SELECT)
      .eq('id', sessionId)
      .is('deleted_at', null)
      .is('session_participants.deleted_at', null)
      .neq('status', 'cancelled')
      .single()

    if (optionalSessionMetadataMissing(detailResult.error)) {
      detailResult = await client
        .from('sessions')
        .select(SESSION_SELECT_BASE)
        .eq('id', sessionId)
        .is('deleted_at', null)
        .is('session_participants.deleted_at', null)
        .neq('status', 'cancelled')
        .single()
    }

    if (detailResult.error || !detailResult.data) {
      setCreateStatus(detailResult.error?.message || text.noMatchingSessions)
      sessionDetailsLoadingRef.current.delete(sessionId)
      setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
      return null
    }

    const detailSession = normalizeSessionRow(detailResult.data as Session)
    const participantIds = Array.from(new Set((detailSession.session_participants ?? []).map((participant) => participant.profile_id)))

    const [waitlistResult, invitesResult, adjustmentResult] = await Promise.all([
      client
        .from('session_waitlist')
        .select(WAITLIST_SELECT)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      userId
        ? client
          .from('session_invites')
          .select('id, session_id, inviter_id, recipient_id, recipient_display_name, recipient_avatar_url, recipient_avatar_emoji, recipient_avatar_initials, recipient_avatar_color, recipient_avatar_text_color, recipient_profile_motto, status, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      participantIds.length > 0
        ? client
          .from('profiles')
          .select('id, score_adjustment')
          .is('deleted_at', null)
          .in('id', participantIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const waitlistRows = waitlistResult.error ? [] : (waitlistResult.data ?? []) as WaitlistEntry[]
    const inviteRows = invitesResult.error ? [] : (invitesResult.data ?? []) as SessionInvite[]
    const adjustmentRows = adjustmentResult.error ? [] : (adjustmentResult.data ?? []) as Array<Pick<Profile, 'id' | 'score_adjustment'>>

    const hydratedDetailSession = {
      ...detailSession,
      session_waitlist: waitlistRows,
    }

    setSessions((currentSessions) => {
      const sessionsById = new Map(currentSessions.map((session) => [session.id, session]))
      sessionsById.set(sessionId, hydratedDetailSession)
      return sortSessionsByStart(Array.from(sessionsById.values()))
    })
    if (!invitesResult.error) {
      setSessionInvites((current) => [
        ...current.filter((invite) => invite.session_id !== sessionId),
        ...inviteRows,
      ])
    }
    if (adjustmentRows.length > 0) {
      setProfileScoreAdjustments((current) => ({
        ...current,
        ...Object.fromEntries(adjustmentRows.map((row) => {
          const adjustment = Number(row.score_adjustment ?? 0)
          return [row.id, Number.isFinite(adjustment) ? adjustment : 0]
        })),
      }))
    }

    sessionDetailsLoadedRef.current.add(sessionId)
    sessionDetailsLoadingRef.current.delete(sessionId)
    setLoadedSessionDetailIds((current) => ({ ...current, [sessionId]: true }))
    setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
    return hydratedDetailSession
  }

  async function loadSessionRows(startDate?: string, endDate?: string, includeBlockedTimes = false) {
    const { sessionPageFromRpcPayload, optionalSessionMetadataMissing, setCreateStatus, normalizeSessionRow } = getContext()

    const client = await getSupabase()
    const rpcResult = await client.rpc('sessions_list_page', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: 500,
      p_offset: 0,
      p_include_blocked_times: includeBlockedTimes,
    })

    if (!rpcResult.error && rpcResult.data) {
      return sessionPageFromRpcPayload(rpcResult.data)
    }

    let sessionQuery = client
      .from('sessions')
      .select(SESSION_CARD_SELECT)
      .is('deleted_at', null)
      .is('session_participants.deleted_at', null)
      .neq('status', 'cancelled')

    if (startDate) sessionQuery = sessionQuery.gte('date', startDate)
    if (endDate) sessionQuery = sessionQuery.lte('date', endDate)

    const sessionResult = await sessionQuery
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    let sessionRowsData: unknown[] | null = sessionResult.data as unknown[] | null
    let sessionError = sessionResult.error

    if (optionalSessionMetadataMissing(sessionResult.error)) {
      let fallbackSessionQuery = client
        .from('sessions')
        .select(SESSION_CARD_SELECT_BASE)
        .is('deleted_at', null)
        .is('session_participants.deleted_at', null)
        .neq('status', 'cancelled')

      if (startDate) fallbackSessionQuery = fallbackSessionQuery.gte('date', startDate)
      if (endDate) fallbackSessionQuery = fallbackSessionQuery.lte('date', endDate)

      const fallbackSessionResult = await fallbackSessionQuery
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      sessionRowsData = fallbackSessionResult.data
      sessionError = fallbackSessionResult.error
    }

    if (sessionError) {
      setCreateStatus(sessionError.message)
      return null
    }

    return {
      sessions: ((sessionRowsData ?? []) as Session[]).map(normalizeSessionRow),
      scoreAdjustments: {},
      blockedTimes: [],
      hasMoreAfter: null,
      source: 'select',
    } satisfies SessionListPageResult
  }

  async function hasFutureSessionsAfter(dateValue: string) {
    const { data, error } = await (await getSupabase())
      .from('sessions')
      .select('id')
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .gt('date', dateValue)
      .limit(1)

    if (error) return true
    return (data ?? []).length > 0
  }

  async function loadSessionRange(
    startDate: string | undefined,
    endDate: string | undefined,
    mode: 'replace-upcoming' | 'replace-past' | 'merge',
    options: { includeBlockedTimes?: boolean; updateUpcomingPagination?: boolean } = {}
  ) {
    const {
      loadingSessionRangeRef,
      setProfileScoreAdjustments,
      sessionDetailsLoadedRef,
      sessionsLoadedRef,
      setSessions,
      loadExpandedSessionDetails,
      setBlockedTimes,
      setHasMoreUpcomingSessions,
    } = getContext()

    if (loadingSessionRangeRef.current) return false

    loadingSessionRangeRef.current = true
    const sessionPage = await loadSessionRows(startDate, endDate, Boolean(options.includeBlockedTimes))

    if (!sessionPage) {
      loadingSessionRangeRef.current = false
      return false
    }

    const sessionRows = sessionPage.sessions
    const sessionIds = sessionRows.map((session) => session.id)
    const profileIds = Array.from(new Set(sessionRows.flatMap((session) => (session.session_participants ?? []).map((participant) => participant.profile_id))))
    const client = await getSupabase()
    const needsSupplementalListData = sessionPage.source !== 'rpc'
    const [waitlistResult, adjustmentResult] = needsSupplementalListData ? await Promise.all([
      sessionIds.length > 0
        ? client
          .from('session_waitlist')
          .select(WAITLIST_POSITION_SELECT)
          .in('session_id', sessionIds)
          .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      profileIds.length > 0
        ? client
          .from('profiles')
          .select('id, score_adjustment')
          .is('deleted_at', null)
          .in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]) : [
      { data: [], error: null },
      { data: [], error: null },
    ]

    const waitlistRows = needsSupplementalListData
      ? waitlistResult.error ? [] : (waitlistResult.data ?? []) as WaitlistEntry[]
      : sessionRows.flatMap((session) => session.session_waitlist ?? [])
    const adjustmentRows = adjustmentResult.error ? [] : (adjustmentResult.data ?? [])
    const scoreAdjustments = needsSupplementalListData ? Object.fromEntries(adjustmentRows.map((row) => {
      const adjustment = Number((row as Pick<Profile, 'score_adjustment'>).score_adjustment ?? 0)
      return [(row as Pick<Profile, 'id'>).id, Number.isFinite(adjustment) ? adjustment : 0]
    })) : sessionPage.scoreAdjustments

    if (Object.keys(scoreAdjustments).length > 0) {
      setProfileScoreAdjustments((current) => ({
        ...current,
        ...scoreAdjustments,
      }))
    }
    const hydratedSessions = sessionRows.map((session) => ({
      ...session,
      session_waitlist: waitlistRows.filter((entry) => entry.session_id === session.id),
    }))
    hydratedSessions.forEach((session) => {
      sessionDetailsLoadedRef.current.delete(session.id)
    })

    sessionsLoadedRef.current = true
    setSessions((currentSessions) => {
      const retainedSessions = mode === 'replace-upcoming'
        ? currentSessions.filter((session) => isPastSession(session))
        : mode === 'replace-past'
          ? currentSessions.filter((session) => isUpcomingSession(session))
          : currentSessions
      const sessionsById = new Map(retainedSessions.map((session) => [session.id, session]))
      hydratedSessions.forEach((session) => sessionsById.set(session.id, session))
      return sortSessionsByStart(Array.from(sessionsById.values()))
    })
    loadExpandedSessionDetails()

    if (options.includeBlockedTimes) {
      if (sessionPage.source === 'rpc') {
        setBlockedTimes(sessionPage.blockedTimes)
      } else {
        const blockedResult = await client.from('blocked_times').select('date, start_time, end_time, arenas_used')
        setBlockedTimes((blockedResult.data ?? []) as BlockedTime[])
      }
    }

    if (options.updateUpcomingPagination !== false && endDate && endDate >= localDateString()) {
      setHasMoreUpcomingSessions(typeof sessionPage.hasMoreAfter === 'boolean'
        ? sessionPage.hasMoreAfter
        : await hasFutureSessionsAfter(endDate))
    }

    loadingSessionRangeRef.current = false
    return true
  }

  async function loadSessions(options: { focusDate?: string } = {}) {
    const { upcomingSessionsThroughRef } = getContext()

    const today = localDateString()
    const defaultEndDate = addDaysToDateValue(today, SESSION_LOAD_BATCH_DAYS - 1)
    const focusEndDate = options.focusDate && options.focusDate >= today ? upcomingBatchEndForDate(options.focusDate) : ''
    const nextEndDate = maxDateValue(defaultEndDate, upcomingSessionsThroughRef.current, focusEndDate)

    const previousEndDate = upcomingSessionsThroughRef.current
    upcomingSessionsThroughRef.current = nextEndDate
    const loaded = await loadSessionRange(today, nextEndDate, 'replace-upcoming', { includeBlockedTimes: true })
    if (!loaded) upcomingSessionsThroughRef.current = previousEndDate
  }

  async function loadMoreUpcomingSessions() {
    const { isLoadingMoreSessions, loadingSessionRangeRef, hasMoreUpcomingSessions, upcomingSessionsThroughRef, setIsLoadingMoreSessions } = getContext()

    if (isLoadingMoreSessions || loadingSessionRangeRef.current || !hasMoreUpcomingSessions) return

    const today = localDateString()
    const currentEndDate = upcomingSessionsThroughRef.current || addDaysToDateValue(today, SESSION_LOAD_BATCH_DAYS - 1)
    const nextStartDate = addDaysToDateValue(currentEndDate, 1)
    const nextEndDate = addDaysToDateValue(nextStartDate, SESSION_LOAD_BATCH_DAYS - 1)

    setIsLoadingMoreSessions(true)
    const previousEndDate = upcomingSessionsThroughRef.current
    upcomingSessionsThroughRef.current = nextEndDate
    const loaded = await loadSessionRange(nextStartDate, nextEndDate, 'merge')
    if (!loaded) upcomingSessionsThroughRef.current = previousEndDate
    setIsLoadingMoreSessions(false)
  }

  return { loadSessionDetail, loadSessionRows, hasFutureSessionsAfter, loadSessionRange, loadSessions, loadMoreUpcomingSessions }
}
