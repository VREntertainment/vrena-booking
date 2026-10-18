import test from 'node:test'
import assert from 'node:assert/strict'
import { isAnvioGame, brandedGameName } from './anvio.ts'
test('Anvio attribution follows publisher IDs without changing other game names', () => {
  for (const id of ['revolta', 'city-z', 'station-zarya']) {
    assert.equal(isAnvioGame(id), true)
    assert.match(brandedGameName(id, id), /Powered by Anvio$/)
  }
  assert.equal(brandedGameName('party-games', 'Party Games'), 'Party Games')
})
