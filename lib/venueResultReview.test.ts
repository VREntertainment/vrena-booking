import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isVenueResultReviewReason,
  venueResultReviewReasons,
} from './venueResultReview.ts'

test('accepts every review reason emitted by the Windows capture app', () => {
  assert.deepEqual(venueResultReviewReasons, [
    'game_not_recognized',
    'players_not_recognized',
    'escape_time_not_recognized',
    'player_rows_conflict',
    'player_rows_incomplete',
    'player_count_invalid',
  ])

  for (const reason of venueResultReviewReasons) {
    assert.equal(isVenueResultReviewReason(reason), true)
  }
})

test('rejects ignored and unknown review reasons', () => {
  assert.equal(isVenueResultReviewReason('game_ignored'), false)
  assert.equal(isVenueResultReviewReason('unknown_reason'), false)
  assert.equal(isVenueResultReviewReason(''), false)
})
