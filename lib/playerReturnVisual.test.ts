import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPlayerReturnVisualPool,
  playerReturnVisualDayKey,
  selectPlayerReturnVisual,
} from './playerReturnVisual.ts'

test('builds the visual pool only from unlocked collection and Trickster rewards', () => {
  const pool = buildPlayerReturnVisualPool(
    [
      { game: { id: 'laser-tag', title: 'Laser Tag' }, state: 'unlocked', tier: 'bronze' },
      { game: { id: 'wild-west', title: 'Wild West' }, state: 'locked', tier: 'none' },
    ],
    [
      { id: 'weekly-warrior', state: 'unlocked', title: 'Weekly Warrior' },
      { id: 'arena-regular', state: 'locked', title: 'Arena Regular' },
    ],
  )

  assert.deepEqual(pool.map((visual) => visual.id), [
    'achievement:laser-tag',
    'trickster:weekly-warrior',
  ])
})

test('keeps the same selection for the same player and day', () => {
  const candidates = buildPlayerReturnVisualPool(
    [
      { game: { id: 'laser-tag', title: 'Laser Tag' }, state: 'unlocked', tier: 'bronze' },
      { game: { id: 'snow-battle', title: 'Snow Battle' }, state: 'unlocked', tier: 'silver' },
    ],
    [{ id: 'weekly-warrior', state: 'unlocked', title: 'Weekly Warrior' }],
  )
  const options = {
    candidates,
    dayKey: '2026-08-06',
    userId: 'player-1',
  }

  assert.equal(selectPlayerReturnVisual(options).id, selectPlayerReturnVisual(options).id)
})

test('prioritizes a newly unlocked reward while its celebration is pending', () => {
  const candidates = buildPlayerReturnVisualPool(
    [{ game: { id: 'laser-tag', title: 'Laser Tag' }, state: 'unlocked', tier: 'bronze' }],
    [{ id: 'weekly-warrior', state: 'unlocked', title: 'Weekly Warrior' }],
  )
  const selected = selectPlayerReturnVisual({
    candidates,
    dayKey: '2026-08-06',
    featuredUnlock: {
      id: 'weekly-warrior',
      kind: 'retention',
    },
    userId: 'player-1',
  })

  assert.equal(selected.id, 'trickster:weekly-warrior')
})

test('uses the fallback character when the player has no unlocked rewards', () => {
  const selected = selectPlayerReturnVisual({
    candidates: [],
    dayKey: '2026-08-06',
    userId: 'new-player',
  })

  assert.equal(selected.id, 'fallback:wild-west')
  assert.equal(selected.source, 'fallback')
})

test('uses the Vietnam calendar date for daily rotation', () => {
  assert.equal(playerReturnVisualDayKey(new Date('2026-08-05T17:30:00Z')), '2026-08-06')
})
