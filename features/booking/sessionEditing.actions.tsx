'use client'

import { getSupabase } from '../../lib/booking/client'
import {
  type GameId
} from '../../lib/bookingStaticData'
import { notifyBookingUpdateEmail } from '../../lib/bookingUpdateNotificationClient'
import {
  Participant,
  Session,
  arenasUsedBySession,
  generateInviteCode,
  ticketArenaCountForPlayers,
  ticketPricingSummary
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { bookingUpdateChanges, bookingUpdateKind } from './shared'

export type SessionEditingActionContext = {
  setEditSelectedGames: React.Dispatch<React.SetStateAction<import("../../lib/bookingStaticData").GameId[]>>
  isAdmin: boolean
  ensureAllProfilesLoaded: () => void
  sessionDetailsLoadedRef: React.RefObject<Set<string>>
  loadSessionDetail: (sessionId: string, options?: { force?: boolean | undefined }) => Promise<import("../../lib/bookingWidgetDomain").Session | null>
  setEditingSessionId: React.Dispatch<React.SetStateAction<string>>
  setEditSessionName: React.Dispatch<React.SetStateAction<string>>
  setEditSessionDate: React.Dispatch<React.SetStateAction<string>>
  setEditSessionTime: React.Dispatch<React.SetStateAction<string>>
  setEditSessionDuration: React.Dispatch<React.SetStateAction<number>>
  setEditSessionMaxPlayers: React.Dispatch<React.SetStateAction<number>>
  setEditSessionArenaCount: React.Dispatch<React.SetStateAction<number>>
  setEditSessionVisibility: React.Dispatch<React.SetStateAction<"public" | "private">>
  setEditSessionNotes: React.Dispatch<React.SetStateAction<string>>
  setEditBookingType: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").BookingType>>
  setEditTicketCustomerId: React.Dispatch<React.SetStateAction<string>>
  setEditTicketType: React.Dispatch<React.SetStateAction<import("../../lib/bookingStaticData").TicketType>>
  setEditTicketTotalPrice: React.Dispatch<React.SetStateAction<string>>
  setEditTicketStatus: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TicketStatus>>
  setEditTournamentFormat: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").TournamentFormat>>
  setEditTournamentBestOf: React.Dispatch<React.SetStateAction<1 | 5 | 3>>
  setEditTournamentRoundsPerMatch: React.Dispatch<React.SetStateAction<number>>
  setEditTournamentRequirePayment: React.Dispatch<React.SetStateAction<boolean>>
  setEditTournamentQualificationRule: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").QualificationRule>>
  setEditTournamentCustomQualifiers: React.Dispatch<React.SetStateAction<number>>
  setEditTournamentThirdPlace: React.Dispatch<React.SetStateAction<boolean>>
  setEditTournamentFirstPrize: React.Dispatch<React.SetStateAction<string>>
  setEditTournamentSecondPrize: React.Dispatch<React.SetStateAction<string>>
  setEditTournamentThirdPrize: React.Dispatch<React.SetStateAction<string>>
  setCreateStatus: React.Dispatch<React.SetStateAction<string>>
  setIsUpdatingSession: React.Dispatch<React.SetStateAction<boolean>>
  canManageSession: (session: import("../../lib/bookingWidgetDomain").Session) => boolean
  text: TranslationMap
  editSessionName: string
  editSessionDate: string
  editSessionTime: string
  editSessionMaxPlayers: number
  editBookingType: import("../../lib/bookingWidgetDomain").BookingType
  editSessionVisibility: "public" | "private"
  tournamentForSession: (sessionId: string) => { editors: import("../../lib/bookingWidgetDomain").TournamentEditor[]; pools: import("../../lib/bookingWidgetDomain").TournamentPool[]; poolEntries: import("../../lib/bookingWidgetDomain").TournamentPoolEntry[]; matches: import("../../lib/bookingWidgetDomain").TournamentMatch[]; auditLogs: import("../../lib/bookingWidgetDomain").TournamentAuditLog[] }
  editSessionDuration: number
  editSessionArenaCount: number
  editTicketType: import("../../lib/bookingStaticData").TicketType
  editTicketTotalPrice: string
  editTicketCustomerId: string
  editSelectedGames: import("../../lib/bookingStaticData").GameId[]
  editSessionNotes: string
  editTicketStatus: import("../../lib/bookingWidgetDomain").TicketStatus
  editTournamentFormat: import("../../lib/bookingWidgetDomain").TournamentFormat
  editTournamentBestOf: 1 | 5 | 3
  editTournamentRoundsPerMatch: number
  editTournamentRequirePayment: boolean
  editTournamentQualificationRule: import("../../lib/bookingWidgetDomain").QualificationRule
  editTournamentCustomQualifiers: number
  editTournamentThirdPlace: boolean
  editTournamentFirstPrize: string
  editTournamentSecondPrize: string
  editTournamentThirdPrize: string
  loadSessions: (options?: { focusDate?: string | undefined }) => Promise<void>
  consumeAppRateLimit: (action: "login_attempt" | "otp_request" | "join_leave" | "booking_attempt" | "admin_destructive" | "password_reset" | "invite_player" | "session_message" | "customer_invite" | "voucher_quote" | "staff_config_write", subject: string, setStatus?: (message: string) => void) => Promise<boolean>
  setBusySessionId: React.Dispatch<React.SetStateAction<string>>
  softDeleteRecord: (entityTable: string, entityId: string, reason: string) => Promise<import("@supabase/postgrest-js").PostgrestSingleResponse<unknown>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingSessionEditingActions(getContext: () => SessionEditingActionContext) {
  function toggleEditGame(gameId: GameId) {
    const { setEditSelectedGames } = getContext()

    setEditSelectedGames((current) => {
      if (current.includes(gameId)) {
        return current.length === 1 ? current : current.filter((id) => id !== gameId)
      }
      return [...current, gameId]
    })
  }

  async function startEditingSession(session: Session) {
    const {
      isAdmin,
      ensureAllProfilesLoaded,
      sessionDetailsLoadedRef,
      loadSessionDetail,
      setEditingSessionId,
      setEditSessionName,
      setEditSessionDate,
      setEditSessionTime,
      setEditSessionDuration,
      setEditSessionMaxPlayers,
      setEditSessionArenaCount,
      setEditSessionVisibility,
      setEditSessionNotes,
      setEditSelectedGames,
      setEditBookingType,
      setEditTicketCustomerId,
      setEditTicketType,
      setEditTicketTotalPrice,
      setEditTicketStatus,
      setEditTournamentFormat,
      setEditTournamentBestOf,
      setEditTournamentRoundsPerMatch,
      setEditTournamentRequirePayment,
      setEditTournamentQualificationRule,
      setEditTournamentCustomQualifiers,
      setEditTournamentThirdPlace,
      setEditTournamentFirstPrize,
      setEditTournamentSecondPrize,
      setEditTournamentThirdPrize,
      setCreateStatus,
    } = getContext()

    if (isAdmin) ensureAllProfilesLoaded()
    const fullSession = sessionDetailsLoadedRef.current.has(session.id)
      ? session
      : (await loadSessionDetail(session.id)) || session

    setEditingSessionId(session.id)
    setEditSessionName(fullSession.name)
    setEditSessionDate(fullSession.date)
    setEditSessionTime(fullSession.start_time.slice(0, 5))
    setEditSessionDuration(fullSession.duration_minutes)
    setEditSessionMaxPlayers(fullSession.max_players)
    setEditSessionArenaCount(arenasUsedBySession(fullSession))
    setEditSessionVisibility(fullSession.visibility)
    setEditSessionNotes(fullSession.notes || '')
    setEditSelectedGames(fullSession.game_options?.length ? fullSession.game_options : ['laser-tag'])
    setEditBookingType(fullSession.booking_type || 'community')
    setEditTicketCustomerId(fullSession.ticket_customer_id || fullSession.owner_id)
    setEditTicketType(fullSession.ticket_type || 'individual')
    setEditTicketTotalPrice(String(fullSession.ticket_total_price ?? ''))
    setEditTicketStatus(fullSession.ticket_status || 'confirmed')
    setEditTournamentFormat(fullSession.tournament_format || 'pool_to_final')
    setEditTournamentBestOf((fullSession.best_of || 1) as 1 | 3 | 5)
    setEditTournamentRoundsPerMatch(fullSession.rounds_per_match || 1)
    setEditTournamentRequirePayment(Boolean(fullSession.require_payment))
    setEditTournamentQualificationRule(fullSession.qualification_rule || 'top_1')
    setEditTournamentCustomQualifiers(fullSession.custom_qualifiers || 2)
    setEditTournamentThirdPlace(Boolean(fullSession.enable_third_place_match))
    setEditTournamentFirstPrize(fullSession.first_prize || '')
    setEditTournamentSecondPrize(fullSession.second_prize || '')
    setEditTournamentThirdPrize(fullSession.third_prize || '')
    setCreateStatus('')
  }

  function stopEditingSession() {
    const { setEditingSessionId, setIsUpdatingSession } = getContext()

    setEditingSessionId('')
    setIsUpdatingSession(false)
  }

  async function sendSessionUpdateNotification(
    session: Session,
    payload: {
      action: 'edited' | 'cancelled' | 'deleted'
      summary: string
      changes?: Array<{ label: string; before?: string | number | boolean | null; after?: string | number | boolean | null }>
    },
  ) {
    try {
      await notifyBookingUpdateEmail(await getSupabase(), {
        action: payload.action,
        bookingKind: bookingUpdateKind(session),
        sessionId: session.id,
        title: session.name,
        reference: session.ticket_reference || null,
        date: session.date,
        time: session.start_time.slice(0, 5),
        total: session.ticket_total_price ?? null,
        summary: payload.summary,
        changes: payload.changes || [],
        source: 'Player booking flow',
      })
    } catch (error) {
      console.warn('Could not send booking update email.', error)
    }
  }

  async function updateSession(session: Session) {
    const {
      canManageSession,
      setCreateStatus,
      text,
      editSessionName,
      editSessionDate,
      editSessionTime,
      editSessionMaxPlayers,
      setIsUpdatingSession,
      editBookingType,
      editSessionVisibility,
      tournamentForSession,
      editSessionDuration,
      editSessionArenaCount,
      editTicketType,
      editTicketTotalPrice,
      isAdmin,
      editTicketCustomerId,
      editSelectedGames,
      editSessionNotes,
      editTicketStatus,
      editTournamentFormat,
      editTournamentBestOf,
      editTournamentRoundsPerMatch,
      editTournamentRequirePayment,
      editTournamentQualificationRule,
      editTournamentCustomQualifiers,
      editTournamentThirdPlace,
      editTournamentFirstPrize,
      editTournamentSecondPrize,
      editTournamentThirdPrize,
      loadSessions,
    } = getContext()

    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyEdit)
      return
    }

    const participants = session.session_participants ?? []

    if (!editSessionName.trim() || !editSessionDate || !editSessionTime) {
      setCreateStatus(text.sessionRequired)
      return
    }

    if (editSessionMaxPlayers < participants.length) {
      setCreateStatus(text.maxPlayersBelowJoined)
      return
    }

    setIsUpdatingSession(true)
    setCreateStatus(text.savingSession)

    const effectiveEditVisibility = session.club_id ? 'public' : editBookingType === 'ticket' || editBookingType === 'challenge' ? 'private' : editSessionVisibility
    const inviteCode =
      effectiveEditVisibility === 'private'
        ? session.invite_code || generateInviteCode()
        : null
    const tournament = tournamentForSession(session.id)
    const hasTournamentBracket = tournament.pools.length > 0 || tournament.matches.length > 0
    const ticketEditDuration = editSessionDuration
    const ticketEditArenaCount = editBookingType === 'ticket'
      ? ticketArenaCountForPlayers(editSessionArenaCount)
      : editSessionArenaCount
    const ticketEditPricing = ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, editSessionMaxPlayers, ticketEditDuration, ticketEditArenaCount)
    const sanitizedTicketTotal = Math.max(0, Math.round(Number(editTicketTotalPrice) || ticketEditPricing.totalPrice))

    const { error } = await (await getSupabase())
      .from('sessions')
      .update({
        name: editSessionName.trim(),
        ...(isAdmin && editBookingType === 'ticket' && editTicketCustomerId ? { owner_id: editTicketCustomerId } : {}),
        date: editSessionDate,
        start_time: `${editSessionTime}:00`,
        duration_minutes: ticketEditDuration,
        max_players: editSessionMaxPlayers,
        arena_count: ticketEditArenaCount,
        game_options: editSelectedGames,
        visibility: effectiveEditVisibility,
        invite_code: inviteCode,
        notes: editSessionNotes.trim() || null,
        ...(isAdmin
          ? {
            booking_type: editBookingType,
            ticket_customer_id: editBookingType === 'ticket' ? editTicketCustomerId || null : null,
            ticket_type: editBookingType === 'ticket' ? editTicketType : null,
            ticket_player_count: editBookingType === 'ticket' ? editSessionMaxPlayers : null,
            ticket_total_price: editBookingType === 'ticket' ? sanitizedTicketTotal : null,
            ticket_unit_price: editBookingType === 'ticket' ? ticketEditPricing.baseUnitPrice : null,
            ticket_status: editBookingType === 'ticket' ? editTicketStatus : null,
          }
          : {}),
        ...(session.session_type === 'tournament'
          ? {
            tournament_format: hasTournamentBracket ? session.tournament_format : editTournamentFormat,
            best_of: hasTournamentBracket ? session.best_of : editTournamentBestOf,
            rounds_per_match: editTournamentRoundsPerMatch,
            require_payment: editTournamentRequirePayment,
            qualification_rule: hasTournamentBracket ? session.qualification_rule : editTournamentQualificationRule,
            custom_qualifiers: hasTournamentBracket ? session.custom_qualifiers : editTournamentCustomQualifiers,
            enable_third_place_match: editTournamentThirdPlace,
            first_prize: editTournamentFirstPrize.trim() || null,
            second_prize: editTournamentSecondPrize.trim() || null,
            third_prize: editTournamentThirdPrize.trim() || null,
          }
          : {}),
      })
      .eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setIsUpdatingSession(false)
      return
    }

    await loadSessions({ focusDate: editSessionDate })
    void sendSessionUpdateNotification(session, {
      action: editBookingType === 'ticket' && editTicketStatus === 'cancelled' ? 'cancelled' : 'edited',
      summary: editBookingType === 'ticket' && editTicketStatus === 'cancelled'
        ? 'Booking status was changed to cancelled.'
        : 'Booking details were edited.',
      changes: bookingUpdateChanges([
        ['Name', session.name, editSessionName.trim()],
        ['Date', session.date, editSessionDate],
        ['Time', session.start_time.slice(0, 5), editSessionTime],
        ['Duration', session.duration_minutes, ticketEditDuration],
        ['Max players', session.max_players, editSessionMaxPlayers],
        ['Visibility', session.visibility, effectiveEditVisibility],
        ['Ticket status', session.ticket_status, editBookingType === 'ticket' ? editTicketStatus : session.ticket_status],
        ['Total', session.ticket_total_price, editBookingType === 'ticket' ? sanitizedTicketTotal : session.ticket_total_price],
      ]),
    })
    setCreateStatus(effectiveEditVisibility === 'private' ? `${text.privateUpdated} ${inviteCode}` : text.sessionUpdated)
    stopEditingSession()
  }

  async function cancelSession(session: Session) {
    const { canManageSession, setCreateStatus, text, consumeAppRateLimit, setBusySessionId, loadSessions } = getContext()

    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyCancel)
      return
    }

    const confirmed = window.confirm(`${text.cancelConfirmPrefix} "${session.name}"? ${text.cancelConfirmSuffix}`)
    if (!confirmed) return

    const allowed = await consumeAppRateLimit('admin_destructive', `cancel-session:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)
    const { error } = await (await getSupabase()).from('sessions').update({ status: 'cancelled' }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    void sendSessionUpdateNotification(session, {
      action: 'cancelled',
      summary: 'Booking status was changed to cancelled.',
      changes: [{ label: 'Status', before: session.status, after: 'cancelled' }],
    })
    setCreateStatus(text.sessionCancelled)
    setBusySessionId('')
  }

  async function removeParticipant(session: Session, participant: Participant) {
    const { canManageSession, setCreateStatus, text, setBusySessionId, softDeleteRecord, loadSessions } = getContext()

    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyRemove)
      return
    }

    if (participant.profile_id === session.owner_id) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.removeConfirmPrefix} ${participant.display_name || text.removeConfirmFallback} ${text.fromSession} "${session.name}"?`)
    if (!confirmed) return

    setBusySessionId(session.id)
    const { error } = await softDeleteRecord('session_participants', participant.id, 'Removed from session')

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.playerRemoved)
    setBusySessionId('')
  }

  return { toggleEditGame, startEditingSession, stopEditingSession, sendSessionUpdateNotification, updateSession, cancelSession, removeParticipant }
}
