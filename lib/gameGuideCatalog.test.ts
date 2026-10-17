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

test('new VR Arena experiences use Thao Dien and do not use broken or unrelated artwork', () => {
  const [game] = mergeStaffGameCatalog([{ slug: 'portal-mafia', image_url: '/games/vrena-shared.svg' }])
  assert.deepEqual(game.venues, ['cafe-des-stagiaires'])
  assert.equal(game.image, '/games/portal-mafia.png')
})

test('age, venue and search filters combine without excluding games suitable for younger players', () => {
  const games = mergeStaffGameCatalog([{ slug: 'portal-zombie', name: 'Portal Zombie' }, { slug: 'portal-mafia', name: 'Portal Mafia' }, { slug: 'snow-battle', name: 'Snow Battle' }])
  assert.deepEqual(filterGuideGames(games, { search: 'PORTAL', venue: 'cafe-des-stagiaires', category: 'all', playerAge: '15' }).map((game) => game.id), ['portal-mafia'])
  assert.deepEqual(filterGuideGames(games, { search: '', venue: 'all', category: 'all', playerAge: '11' }).map((game) => game.id), ['snow-battle'])
  assert.equal(filterGuideGames(games, { search: '', venue: 'all', category: 'all', playerAge: '16' }).length, 3)
})

test('birthday and pop-up categories stay separate from venue inventory', async () => {
  const { withPopUpGuides } = await import('./gameGuideCatalog.ts')
  const source = mergeStaffGameCatalog([{ slug: 'birthday-party' }, { slug: 'party-games' }, { slug: 'portal-zombie' }])
  assert.equal(source.length, 3)
  const catalog = withPopUpGuides(source)
  const filters = { search: '', venue: 'ha-do-centrosa' as const, category: 'Pop-Up event', playerAge: '11' }
  assert.deepEqual(filterGuideGames(catalog, filters).map((game) => game.id), ['laser-limbo'])
  assert.ok(filterGuideGames(catalog, filters).every((game) => game.popUp && game.venues.length === 0))
  assert.equal(filterGuideGames(catalog, { ...filters, venue: 'cafe-des-stagiaires', category: 'Kid birthday' }).length, 2)
  assert.equal(withPopUpGuides(catalog).length, catalog.length)
})

test('search discovers mini-games, maps and modes inside their collections', async () => {
  const { withPopUpGuides } = await import('./gameGuideCatalog.ts')
  const games = withPopUpGuides(mergeStaffGameCatalog([{ slug: 'birthday-party' }, { slug: 'arcade-2-0' }, { slug: 'portal-mafia' }]))
  const search = (value: string) => filterGuideGames(games, { search: value, venue: 'all', category: 'all', playerAge: 'all' }).map((game) => game.id)
  assert.deepEqual(search('Candle Hunt'), ['birthday-party'])
  assert.deepEqual(search('Casino'), ['portal-mafia'])
  assert.deepEqual(search('CyberPunk'), ['arcade-2-0'])
  assert.deepEqual(search('Capture the Flag'), ['spatial-ops'])
})

test('puzzle mode age policy also applies to mode search', async () => {
  const { withPopUpGuides } = await import('./gameGuideCatalog.ts')
  const games = withPopUpGuides([])
  const filters = { search: 'Puzzle Battle', venue: 'all' as const, category: 'all', playerAge: '11' }
  assert.equal(filterGuideGames(games, filters).length, 0)
  assert.deepEqual(filterGuideGames(games, { ...filters, playerAge: '15' }).map((game) => game.id), ['laser-limbo'])
})

test('publisher artwork fills missing images and preserves existing staff artwork', () => {
  const [missing, existing, galactic] = mergeStaffGameCatalog([
    { slug: 'portal-mafia', image_url: '/games/vrena-shared.svg' },
    { slug: 'portal-zombie', image_url: '/games/custom-zombie.webp' },
    { slug: 'orc-kings-arena', name: "Orc King's Arena" },
  ])
  assert.equal(missing.image, '/games/portal-mafia.png')
  assert.equal(existing.image, '/games/custom-zombie.webp')
  assert.equal(galactic.title, 'Galactic Arena')
  assert.equal(galactic.image, '/games/galactic-arena.png')
})


test('Spatial Ops is 12+ in both the label policy and age filter', async () => {
  const { withPopUpGuides, gameMinimumAge } = await import('./gameGuideCatalog.ts')
  const game = withPopUpGuides([]).find((item) => item.id === 'spatial-ops')!
  assert.equal(gameMinimumAge(game), 12)
  const filters = { search: 'Spatial Ops', venue: 'all' as const, category: 'all', playerAge: '11' }
  assert.equal(filterGuideGames([game], filters).length, 0)
  assert.equal(filterGuideGames([game], { ...filters, playerAge: '15' }).length, 1)
  assert.equal(filterGuideGames([game], { ...filters, playerAge: '16' }).length, 1)
})

test('Revolta is available from age twelve, including the sixteen-plus filter', async () => {
  const { gameMinimumAge } = await import('./gameGuideCatalog.ts')
  const [game] = mergeStaffGameCatalog([{ slug: 'revolta' }])
  assert.equal(gameMinimumAge(game), 12)
  const filters = { search: '', venue: 'all' as const, category: 'all', playerAge: '11' }
  assert.equal(filterGuideGames([game], filters).length, 0)
  for (const playerAge of ['12', '15', '16']) {
    assert.equal(filterGuideGames([game], { ...filters, playerAge }).length, 1)
  }
})
