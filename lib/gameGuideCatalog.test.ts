import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeStaffGameCatalog, publicGameGuideCatalog } from './gameGuideCatalog.ts'

test('the public guide lists only active staff games, including ANVIO', () => {
  const games = mergeStaffGameCatalog([
    { slug: 'revolta', name: 'Revolta', duration_minutes: 45, max_players_per_arena: 8 },
    { slug: 'city-z', name: 'City Z', duration_minutes: 45, max_players_per_arena: 6 },
    { slug: 'station-zarya', name: 'Station Zarya', duration_minutes: 45, max_players_per_arena: 6 },
    { slug: 'laser-tag', active: false },
  ])
  assert.deepEqual(games.map((game) => game.id), ['revolta', 'city-z', 'station-zarya'])
  assert.deepEqual(games.map((game) => game.maxPlayersPerArena), [8, 6, 6])
  assert.ok(games.every((game) => game.durationMinutes === 45 && game.venues.includes('cafe-des-stagiaires')))
})

test('staff edits control names, duration, capacity, and audience', () => {
  const [game] = mergeStaffGameCatalog([{ slug: 'revolta', name: 'Revolta updated', duration_minutes: 60,
    max_players_per_arena: 6, audience: ['beginnerFriendly'], image_url: 'https://untrusted.example/a.png' }])
  assert.equal(game.title, 'Revolta updated')
  assert.equal(game.durationMinutes, 60)
  assert.equal(game.maxPlayersPerArena, 6)
  assert.deepEqual(game.audience, ['beginnerFriendly'])
  assert.equal(game.image, '/games/revolta.webp')
})

test('catalog defaults never resurrect a missing or inactive staff game', () => {
  assert.ok(publicGameGuideCatalog.length > 0)
  assert.deepEqual(mergeStaffGameCatalog([]), [])
  assert.deepEqual(mergeStaffGameCatalog([{ slug: 'revolta', active: false }]), [])
})

test('new staff games are published with safe artwork', () => {
  const [game] = mergeStaffGameCatalog([{ slug: 'new-game', name: 'New game', game_type: 'escape',
    image_url: 'https://assets.example/storage/v1/object/public/game.png' }], 'https://assets.example')
  assert.equal(game.id, 'new-game')
  assert.equal(game.category, 'Escape')
  assert.equal(game.image, 'https://assets.example/storage/v1/object/public/game.png')
})
