import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTournamentActions, type TournamentActionsContext } from './booking/tournamentActions.ts'
import { buildKnockoutRows, matchLoser, matchWinnerFromSeries, qualificationCount } from './booking/tournamentRules.ts'
import type { Session, TournamentMatch } from './bookingWidgetDomain'

function blockedContext(statuses: string[]): TournamentActionsContext {
  const unexpected = () => { throw new Error('A blocked tournament command reached a write or refresh dependency') }
  return {
    text: { tournamentControlOnly: 'Host only', editorNotFound: 'Missing editor', profileSaved: 'Saved', tournamentLockedAction: 'Locked', noTournamentData: 'No data', createError: 'Error', tournamentSetup: 'Ready', tournamentGenerateMatches: 'Generated', duplicateMatchPlayer: 'Duplicate player', tournamentPoolFinal: 'Final', tournamentNextRound: 'Next', tournamentFinishNeedsFinal: 'Missing final', tournamentFinished: 'Finished' },
    tournamentEditorEmail: 'player@example.test', tournamentPoolSize: 4,
    isSessionCreator: () => false, tournamentLocked: () => false, canEditTournamentSession: () => false,
    tournamentForSession: unexpected, poolStandingsForSession: unexpected, editorDisplayName: unexpected, avatarFields: unexpected,
    softDeleteTournamentRecords: unexpected, loadTournamentData: unexpected, loadSessions: unexpected, logTournamentAudit: unexpected,
    setCreateStatus: (message) => statuses.push(message), setBusyTournamentId: unexpected,
    setTournamentEditorEmail: unexpected, setTournamentEditorResults: unexpected,
  }
}

test('extracted tournament commands retain host checks before starting any work', async () => {
  const statuses: string[] = []
  const commands = createTournamentActions(blockedContext(statuses))
  // The denied commands may not read any other session fields or reach the lazy database client.
  const session = { id: 'blocked-session' } as Session
  await commands.addTournamentEditor(session)
  await commands.setupTournamentPools(session)
  await commands.generateTournamentMatches(session)
  await commands.advanceTournamentRound(session)
  await commands.finishTournament(session)
  await commands.createThirdPlaceMatch(session)
  assert.deepEqual(statuses, Array(5).fill('Host only'))
})

test('locked brackets and duplicate match participants are rejected before writes', async () => {
  const statuses: string[] = []
  const commands = createTournamentActions({ ...blockedContext(statuses), tournamentLocked: () => true })
  const session = { id: 'locked-session' } as Session
  await commands.setupTournamentPools(session)
  await commands.generateTournamentMatches(session)
  await commands.advanceTournamentRound(session)
  await commands.updateTournamentMatch({ participant_a_id: 'same', participant_b_id: 'same' } as TournamentMatch, {})
  assert.deepEqual(statuses, ['Locked', 'Locked', 'Locked', 'Duplicate player'])
})

test('knockout seeding removes duplicate participants and advances a bye exactly once', () => {
  const rows = buildKnockoutRows('session', ['a', 'b', 'b', '', 'c'], 'semifinal', 2, 3)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => [row.participant_a_id, row.participant_b_id]), [['a', 'b'], ['c', null]])
  assert.equal(rows[0].status, 'waiting')
  assert.equal(rows[1].status, 'completed')
  assert.equal(rows[1].winner_participant_id, 'c')
  assert.deepEqual(rows.map(row => row.queue_position), [1, 2])
})

test('series winners require enough wins and ties remain unresolved', () => {
  const match = { participant_a_id: 'a', participant_b_id: 'b', best_of: 3 as const, wins_a: 1, wins_b: 0, score_a: 50, score_b: 10 }
  assert.equal(matchWinnerFromSeries(match), null)
  assert.equal(matchWinnerFromSeries({ ...match, wins_a: 2 }), 'a')
  assert.equal(matchWinnerFromSeries({ ...match, best_of: 1, score_a: 20, score_b: 20, wins_a: 0 }), null)
  assert.equal(matchLoser(match, 'a'), 'b')
  assert.equal(qualificationCount('top_4'), 4)
  assert.equal(qualificationCount(null, 0), 1)
})
