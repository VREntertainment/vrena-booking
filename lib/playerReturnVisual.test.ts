import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPlayerReturnVisualPool,
  playerReturnVisualDayKey,
  selectPlayerReturnVisual,
} from './playerReturnVisual.ts'

test('builds the visual pool from the complete collection and Trickster catalog', () => {
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
    'achievement:wild-west',
    'trickster:weekly-warrior',
    'trickster:arena-regular',
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

test('lets every distinct character appear without requiring unlocks', () => {
  const candidates = buildPlayerReturnVisualPool(
    [
      { game: { id: 'arc-of-the-covenant', title: 'Arc of the Covenant' }, state: 'locked', tier: 'none' },
      { game: { id: 'castle-unspunnen', title: 'Castle Unspunnen' }, state: 'locked', tier: 'none' },
      { game: { id: 'laser-tag', title: 'Laser Tag' }, state: 'locked', tier: 'none' },
      { game: { id: 'mini-block-towers', title: 'Mini Block Towers' }, state: 'locked', tier: 'none' },
      { game: { id: 'wild-west', title: 'Wild West' }, state: 'locked', tier: 'none' },
    ],
    [{ id: 'weekly-warrior', state: 'locked', title: 'Weekly Warrior' }],
  )
  const selectedImages = new Set<string>()

  for (let index = 0; index < 200; index += 1) {
    selectedImages.add(selectPlayerReturnVisual({
      candidates,
      dayKey: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
      userId: `player-${index}`,
    }).imageSrc)
  }

  assert.deepEqual(selectedImages, new Set([
    '/retention/alpine-sentinel.png',
    '/retention/arena-builder.png',
    '/retention/arena-laser-champion.png',
    '/retention/escape-investigator.png',
    '/retention/trickster-host.png',
    '/retention/wild-west-cowboy.png',
  ]))
})

test('uses the fallback character when the visual catalog is unavailable', () => {
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
