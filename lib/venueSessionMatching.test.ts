import assert from 'node:assert/strict'
import test from 'node:test'
import { venueCandidatesForGame } from './venueSessionMatching.ts'

const candidate = (confirmedGame: string | null, options: string[] = []) => ({
  id: confirmedGame || options.join(','),
  sessions: { confirmed_game_id: confirmedGame, game_options: options },
})

test('rejects a sole time-matched session booked for another game', () => {
  assert.deepEqual(venueCandidatesForGame([candidate('tower-tag')], 'mini-block-towers'), [])
})

test('preserves sole and multiple legitimate game matches', () => {
  const direct = candidate('mini-block-towers')
  const option = candidate(null, ['mini-block-towers'])
  assert.deepEqual(venueCandidatesForGame([direct], 'mini-block-towers'), [direct])
  assert.deepEqual(venueCandidatesForGame([direct, option], 'mini-block-towers'), [direct, option])
})
