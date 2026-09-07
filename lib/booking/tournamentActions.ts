import type {
  MatchStage,
  Participant,
  PoolStanding,
  Profile,
  Session,
  TournamentData,
  TournamentMatch,
  TournamentMatchInsert,
  TournamentPool,
  TournamentPoolEntry,
} from '../bookingWidgetDomain'
import type { TranslationMap } from '../i18n/loadTranslation'
import { getSupabase } from './client.ts'
import {
  buildKnockoutRows,
  eligibleTournamentParticipants,
  hasDuplicateMatchPlayers,
  knockoutStageForCount,
  matchLoser,
  matchWinnerFromSeries,
  qualificationCount,
  shuffleItems,
} from './tournamentRules.ts'

export type TournamentActionsContext = {
  text: Pick<TranslationMap, 'tournamentControlOnly' | 'editorNotFound' | 'profileSaved' | 'tournamentLockedAction' | 'noTournamentData' | 'createError' | 'tournamentSetup' | 'tournamentGenerateMatches' | 'duplicateMatchPlayer' | 'tournamentPoolFinal' | 'tournamentNextRound' | 'tournamentFinishNeedsFinal' | 'tournamentFinished'>
  tournamentEditorEmail: string
  tournamentPoolSize: number
  isSessionCreator: (session: Session) => boolean
  tournamentLocked: (session: Session) => boolean
  canEditTournamentSession: (session: Session) => boolean
  tournamentForSession: (sessionId: string) => TournamentData
  poolStandingsForSession: (session: Session, pool: TournamentPool) => PoolStanding[]
  editorDisplayName: (profile: Profile) => string
  avatarFields: (profile: Profile) => Pick<Profile, 'avatar_url' | 'avatar_emoji' | 'avatar_initials' | 'avatar_color' | 'avatar_text_color' | 'profile_motto'>
  softDeleteTournamentRecords: (sessionId: string, includePools: boolean, reason: string) => Promise<{ error: { message: string } | null }>
  loadTournamentData: () => Promise<void>
  loadSessions: () => Promise<void>
  logTournamentAudit: (sessionId: string, action: string, oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) => Promise<void>
  setCreateStatus: (message: string) => void
  setBusyTournamentId: (id: string) => void
  setTournamentEditorEmail: (email: string) => void
  setTournamentEditorResults: (profiles: Profile[]) => void
}

/** Tournament commands retain the screen's actor checks and use the shared lazy client. */
export function createTournamentActions({
  text,
  tournamentEditorEmail,
  tournamentPoolSize,
  isSessionCreator,
  tournamentLocked,
  canEditTournamentSession,
  tournamentForSession,
  poolStandingsForSession,
  editorDisplayName,
  avatarFields,
  softDeleteTournamentRecords,
  loadTournamentData,
  loadSessions,
  logTournamentAudit,
  setCreateStatus,
  setBusyTournamentId,
  setTournamentEditorEmail,
  setTournamentEditorResults
}: TournamentActionsContext) {
  async function addTournamentEditor(session: Session, selectedEditor?: Profile) {
    if (!isSessionCreator(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const email = tournamentEditorEmail.trim().toLowerCase()
    if (!email && !selectedEditor) return

    setBusyTournamentId(session.id)
    const profileLookup = selectedEditor
      ? { data: selectedEditor, error: null }
      : await (await getSupabase()).rpc('public_profile_search', {
        p_search: email,
        p_limit: 1,
      }).then(({ data, error }) => ({ data: (data ?? [])[0] as Profile | undefined, error }))

    const editorProfile = profileLookup.data
    if (profileLookup.error || !editorProfile) {
      setCreateStatus(profileLookup.error?.message || text.editorNotFound)
      setBusyTournamentId('')
      return
    }

    const display = editorDisplayName(editorProfile)
    const { error } = await (await getSupabase()).from('tournament_editors').upsert({
      session_id: session.id,
      profile_id: editorProfile.id,
      display_name: display,
      ...avatarFields(editorProfile),
    }, { onConflict: 'session_id,profile_id' })

    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    setTournamentEditorEmail('')
    setTournamentEditorResults([])
    await loadTournamentData()
    setCreateStatus(text.profileSaved)
    setBusyTournamentId('')
  }

  async function setupTournamentPools(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const participants = eligibleTournamentParticipants(session)
    if (participants.length < 2) {
      setCreateStatus(text.noTournamentData)
      return
    }

    setBusyTournamentId(session.id)
    const softDeleteResult = await softDeleteTournamentRecords(session.id, true, 'Tournament pools regenerated')
    if (softDeleteResult.error) {
      setCreateStatus(softDeleteResult.error.message)
      setBusyTournamentId('')
      return
    }

    const format = session.tournament_format || 'pool_to_final'
    const seededParticipants = shuffleItems(participants)
    const poolCount = format === 'single_elimination'
      ? 1
      : Math.max(1, Math.ceil(seededParticipants.length / tournamentPoolSize))
    const poolRows = Array.from({ length: poolCount }, (_, index) => ({
      session_id: session.id,
      name: format === 'single_elimination' ? 'Knockout' : `Pool ${String.fromCharCode(65 + index)}`,
      sort_order: index + 1,
    }))

    const { data: pools, error: poolError } = await (await getSupabase())
      .from('tournament_pools')
      .insert(poolRows)
      .select('id, session_id, name, sort_order')

    if (poolError || !pools) {
      setCreateStatus(poolError?.message || text.createError)
      setBusyTournamentId('')
      return
    }

    const entries = seededParticipants.map((participant, index) => {
      const pool = pools[index % pools.length]
      return {
        session_id: session.id,
        pool_id: pool.id,
        participant_id: participant.id,
        profile_id: participant.profile_id,
        seed: index + 1,
      }
    })

    const { error } = await (await getSupabase()).from('tournament_pool_entries').insert(entries)
    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    await loadTournamentData()
    setCreateStatus(text.tournamentSetup)
    setBusyTournamentId('')
  }

  async function generateTournamentMatches(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    if (!data.pools.length || !data.poolEntries.length) {
      setCreateStatus(text.noTournamentData)
      return
    }

    setBusyTournamentId(session.id)
    const softDeleteResult = await softDeleteTournamentRecords(session.id, false, 'Tournament matches regenerated')
    if (softDeleteResult.error) {
      setCreateStatus(softDeleteResult.error.message)
      setBusyTournamentId('')
      return
    }

    const bestOf = session.best_of || 1
    const format = session.tournament_format || 'pool_to_final'
    const matchRows: TournamentMatchInsert[] = format === 'single_elimination'
      ? buildKnockoutRows(session.id, data.poolEntries.map((entry) => entry.participant_id), 'custom', 1, bestOf)
      : data.pools.flatMap((pool) => {
      const poolEntries = data.poolEntries.filter((entry) => entry.pool_id === pool.id)
      const rows: TournamentMatchInsert[] = []
      let matchNumber = 1

      for (let i = 0; i < poolEntries.length; i += 1) {
        for (let j = i + 1; j < poolEntries.length; j += 1) {
          rows.push({
            session_id: session.id,
            pool_id: pool.id,
            stage: 'pool',
            round: 1,
            match_number: matchNumber,
            participant_a_id: poolEntries[i].participant_id,
            participant_b_id: poolEntries[j].participant_id,
            status: 'waiting',
            arena_number: null,
            queue_position: matchNumber,
            best_of: bestOf,
          })
          matchNumber += 1
        }
      }

      return rows
    })

    if (!matchRows.length) {
      setCreateStatus(text.noTournamentData)
      setBusyTournamentId('')
      return
    }

    const { error } = await (await getSupabase()).from('tournament_matches').insert(matchRows)
    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    await logTournamentAudit(session.id, 'Tournament matches generated', null, { format, bestOf, matchCount: matchRows.length })
    await loadTournamentData()
    setCreateStatus(text.tournamentGenerateMatches)
    setBusyTournamentId('')
  }

  async function updateTournamentPoolEntry(entry: TournamentPoolEntry, changes: Partial<TournamentPoolEntry>) {
    const { error } = await (await getSupabase())
      .from('tournament_pool_entries')
      .update({
        pool_id: changes.pool_id ?? entry.pool_id,
        team_label: changes.team_label ?? entry.team_label ?? null,
      })
      .eq('id', entry.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(entry.session_id, 'Pool entry edited', entry as unknown as Record<string, unknown>, changes as Record<string, unknown>)
    await loadTournamentData()
  }

  async function updateTournamentMatch(match: TournamentMatch, changes: Partial<TournamentMatch>) {
    const nextA = changes.participant_a_id ?? match.participant_a_id
    const nextB = changes.participant_b_id ?? match.participant_b_id
    if (hasDuplicateMatchPlayers({ participant_a_id: nextA, participant_b_id: nextB })) {
      setCreateStatus(text.duplicateMatchPlayer)
      return
    }

    const scoreA = changes.score_a ?? match.score_a
    const scoreB = changes.score_b ?? match.score_b
    const draft = {
      ...match,
      ...changes,
      participant_a_id: nextA,
      participant_b_id: nextB,
      score_a: scoreA,
      score_b: scoreB,
      wins_a: changes.wins_a ?? match.wins_a,
      wins_b: changes.wins_b ?? match.wins_b,
      best_of: changes.best_of ?? match.best_of,
    }
    const autoWinner = matchWinnerFromSeries(draft)
    const winner = changes.winner_participant_id ?? autoWinner ?? match.winner_participant_id
    const loser = matchLoser(draft, winner || null)
    const { error } = await (await getSupabase())
      .from('tournament_matches')
      .update({
        participant_a_id: nextA,
        participant_b_id: nextB,
        score_a: scoreA,
        score_b: scoreB,
        wins_a: changes.wins_a ?? match.wins_a ?? null,
        wins_b: changes.wins_b ?? match.wins_b ?? null,
        winner_participant_id: winner || null,
        loser_participant_id: loser || null,
        status: changes.status ?? (winner ? 'completed' : match.status === 'completed' ? 'waiting' : match.status),
        arena_number: changes.arena_number ?? match.arena_number ?? null,
        queue_position: changes.queue_position ?? match.queue_position ?? null,
      })
      .eq('id', match.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(match.session_id, 'Match edited', match as unknown as Record<string, unknown>, changes as Record<string, unknown>)
    await loadTournamentData()
  }

  async function advanceTournamentRound(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    const format = session.tournament_format || 'pool_to_final'
    const bestOf = session.best_of || 1
    let qualified: string[] = []

    if (format === 'pool_to_final' || format === 'pool_to_semifinal' || format === 'pool_only' || format === 'leaderboard') {
      const perPool = qualificationCount(session.qualification_rule, session.custom_qualifiers || 2)
      qualified = data.pools.flatMap((pool) => poolStandingsForSession(session, pool).slice(0, perPool).map((standing) => standing.participantId))
      if (format === 'pool_only' || format === 'leaderboard') {
        setCreateStatus(text.tournamentPoolFinal)
        return
      }
    } else {
      const latestRound = Math.max(1, ...data.matches.map((match) => match.round))
      qualified = data.matches
        .filter((match) => match.round === latestRound && match.winner_participant_id)
        .map((match) => match.winner_participant_id as string)
    }

    qualified = Array.from(new Set(qualified)).filter(Boolean)

    if (qualified.length < 2) {
      setCreateStatus(text.noTournamentData)
      return
    }

    const existingKnockout = data.matches.some((match) => match.stage !== 'pool')
    const nextRound = existingKnockout ? Math.max(1, ...data.matches.map((match) => match.round)) + 1 : 2
    const desired = format === 'pool_to_final' ? qualified.slice(0, 2) : qualified
    const stage: MatchStage = format === 'pool_to_final' ? 'final' : knockoutStageForCount(desired.length)
    const matchRows = buildKnockoutRows(session.id, desired, stage, nextRound, bestOf)

    const { error } = await (await getSupabase()).from('tournament_matches').insert(matchRows)
    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(session.id, 'Round advanced', null, { qualified: desired, stage, round: nextRound })
    await loadTournamentData()
    setCreateStatus(text.tournamentNextRound)
  }

  async function finishTournament(session: Session) {
    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    const finalMatch = [...data.matches].reverse().find((match) => match.stage === 'final' && match.winner_participant_id)
    const thirdMatch = [...data.matches].reverse().find((match) => match.stage === 'third_place' && match.winner_participant_id)
    const semifinalLosers = data.matches
      .filter((match) => match.stage === 'semifinal' && match.loser_participant_id)
      .map((match) => match.loser_participant_id as string)

    const standingsPodium = data.pools
      .flatMap((pool) => poolStandingsForSession(session, pool))
      .sort((a, b) => b.points - a.points || b.scoreDifference - a.scoreDifference || b.scoreFor - a.scoreFor)
      .map((standing) => standing.participantId)

    const first = finalMatch?.winner_participant_id || standingsPodium[0] || null
    const second = finalMatch ? matchLoser(finalMatch, first) : standingsPodium.find((id) => id !== first) || null
    const third = thirdMatch?.winner_participant_id || semifinalLosers.find((id) => id !== second && id !== first) || standingsPodium.find((id) => id !== first && id !== second) || null

    if (!first) {
      setCreateStatus(text.tournamentFinishNeedsFinal)
      return
    }

    if (first) await (await getSupabase()).from('session_participants').update({ placement: 1 }).eq('id', first)
    if (second) await (await getSupabase()).from('session_participants').update({ placement: 2 }).eq('id', second)
    if (third) await (await getSupabase()).from('session_participants').update({ placement: 3 }).eq('id', third)
    await (await getSupabase()).from('sessions').update({ status: 'completed', tournament_locked: true }).eq('id', session.id)

    await logTournamentAudit(session.id, 'Tournament finished', null, { first, second, third })
    await loadSessions()
    await loadTournamentData()
    setCreateStatus(text.tournamentFinished)
  }

  async function createThirdPlaceMatch(session: Session) {
    if (!canEditTournamentSession(session) || !session.enable_third_place_match) return
    const data = tournamentForSession(session.id)
    if (data.matches.some((match) => match.stage === 'third_place')) return

    const losers = data.matches
      .filter((match) => match.stage === 'semifinal' && match.loser_participant_id)
      .map((match) => match.loser_participant_id as string)

    if (losers.length < 2 || new Set(losers).size < 2) return

    const { error } = await (await getSupabase()).from('tournament_matches').insert({
      session_id: session.id,
      pool_id: null,
      stage: 'third_place',
      round: Math.max(1, ...data.matches.map((match) => match.round)) + 1,
      match_number: 1,
      participant_a_id: losers[0],
      participant_b_id: losers[1],
      status: 'waiting',
      queue_position: 99,
      best_of: session.best_of || 1,
    })

    if (!error) {
      await logTournamentAudit(session.id, 'Bronze match created', null, { participants: losers.slice(0, 2) })
      await loadTournamentData()
    }
  }

  async function claimPrize(participant: Participant, claimed: boolean) {
    const { error } = await (await getSupabase())
      .from('session_participants')
      .update({
        prize_claimed: claimed,
        prize_claimed_at: claimed ? new Date().toISOString() : null,
      })
      .eq('id', participant.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await loadSessions()
  }

  return { addTournamentEditor, setupTournamentPools, generateTournamentMatches, updateTournamentPoolEntry, updateTournamentMatch, advanceTournamentRound, finishTournament, createThirdPlaceMatch, claimPrize }
}
