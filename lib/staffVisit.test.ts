import assert from 'node:assert/strict'
import test from 'node:test'
import { hasVisitResult, visitProgress } from './staffVisit.ts'
import type { StaffOperationSession, StaffSessionParticipant, StaffOrder } from './staff/types.ts'

const player = (patch: Partial<StaffSessionParticipant> = {}) => ({ id: 'p', profile_id: 'profile', checked_in: false, ...patch }) as StaffSessionParticipant
const session = (players: StaffSessionParticipant[]) => ({ session_participants: players, ticket_player_count: 2, status: 'completed' }) as StaffOperationSession

test('order completion and payment do not invent attendance or results', () => {
  const progress = visitProgress(session([player({ payment_status: 'cash', payment_amount: 100000 })]), { players_count: 2, order_status: 'completed' } as StaffOrder)
  assert.equal(progress.recorded, false)
  assert.equal(progress.arrived, 0)
  assert.equal(progress.missingPlayers, 1)
})
test('zero is a recorded score; missing and deleted records are not results', () => {
  assert.equal(hasVisitResult(player()), false)
  assert.equal(hasVisitResult(player({ score: 0 })), true)
  const progress = visitProgress(session([player({ checked_in: true, score: 0 }), player({ deleted_at: '2026-01-01', checked_in: true, score: 4 })]))
  assert.equal(progress.players, 1)
  assert.equal(progress.withResults, 1)
  assert.equal(progress.recorded, true)
})
test('each arrived player needs a result while absent players stay absent', () => {
  const progress = visitProgress(session([player({ checked_in: true, score: 12 }), player({ checked_in: true }), player()]))
  assert.equal(progress.arrived, 2)
  assert.equal(progress.needsResults, true)
  assert.equal(progress.recorded, false)
  assert.equal(hasVisitResult(player({ chapter_times: [{ chapter_number: 1, duration_seconds: 60, game_slug: 'escape' }] })), true)
})
