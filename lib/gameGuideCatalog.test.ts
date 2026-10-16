import assert from 'node:assert/strict'
import test from 'node:test'
import { filterGuideGames, mergeStaffGameCatalog, publicGameGuideCatalog } from './gameGuideCatalog.ts'

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

test('the guide retains every active game when a catalog grows beyond thirty titles', () => {
  const source = Array.from({ length: 37 }, (_, index) => ({ slug: `game-${index}`, name: `Game ${index}`, active: index !== 3 }))
  const catalog = mergeStaffGameCatalog(source)
  assert.equal(catalog.length, 36)
  assert.ok(catalog.some((game) => game.id === 'game-36'))
  assert.ok(!catalog.some((game) => game.id === 'game-3'))
})

test('shared experiences retain both venues and do not use broken or unrelated artwork', () => {
  const [game] = mergeStaffGameCatalog([{ slug: 'portal-mafia', image_url: '/games/vrena-shared.svg' }])
  assert.deepEqual(game.venues, ['ha-do-centrosa', 'cafe-des-stagiaires'])
  assert.equal(game.image, '/brand/vrena-mark-light.svg')
})

test('age, venue and search filters combine without excluding games suitable for younger players', () => {
  const games = mergeStaffGameCatalog([{ slug: 'portal-zombie', name: 'Portal Zombie' }, { slug: 'portal-mafia', name: 'Portal Mafia' }, { slug: 'snow-battle', name: 'Snow Battle' }])
  assert.deepEqual(filterGuideGames(games, { search: 'PORTAL', venue: 'cafe-des-stagiaires', category: 'all', playerAge: '15' }).map((game) => game.id), ['portal-mafia'])
  assert.deepEqual(filterGuideGames(games, { search: '', venue: 'all', category: 'all', playerAge: '11' }).map((game) => game.id), ['snow-battle'])
  assert.equal(filterGuideGames(games, { search: '', venue: 'all', category: 'all', playerAge: '16' }).length, 3)
})
