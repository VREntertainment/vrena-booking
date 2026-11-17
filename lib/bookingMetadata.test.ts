import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingCategory, gameAvailableAtVenue, selectedBookingGames, thaoDienGameSlugs } from './bookingMetadata.ts'

test('automatic service defaults and empty choices do not label ticket reservations', () => {
  for (const game of ['laser-tag', 'joller-house', 'office-war']) {
    assert.deepEqual(selectedBookingGames({ booking_type: 'ticket', venue_key: 'cafe-des-stagiaires', game_options: [game] }), [])
    assert.deepEqual(selectedBookingGames({ booking_type: 'ticket', venue_key: 'ha-do-centrosa', game_options: [game], game_selection_explicit: false }), [])
  }
  assert.deepEqual(selectedBookingGames({ game_options: [] }), [])
})
test('manual multi-game choices are deduplicated and restricted to their venue', () => {
  const booking = { booking_type: 'ticket', game_selection_explicit: true, venue_key: 'cafe-des-stagiaires', confirmed_game_id: 'revolta', game_options: ['revolta', 'city-z', 'laser-tag'] }
  assert.deepEqual(selectedBookingGames(booking), ['revolta', 'city-z'])
  assert.deepEqual(selectedBookingGames({ ...booking, venue_key: 'ha-do-centrosa' }), ['revolta', 'city-z', 'laser-tag'])
  assert.deepEqual(selectedBookingGames({ booking_type: 'ticket', confirmed_game_id: 'sim-racing' }), ['sim-racing'])
})
test('parent-game venue rules also govern mini-games and modes', () => {
  for (const slug of thaoDienGameSlugs) assert.equal(gameAvailableAtVenue(slug, 'cafe-des-stagiaires'), true)
  for (const slug of ['joller-house', 'laser-tag', 'snow-battle', 'arc-of-the-covenant']) {
    assert.equal(gameAvailableAtVenue(slug, 'cafe-des-stagiaires'), false)
    assert.equal(gameAvailableAtVenue(slug, 'ha-do-centrosa'), true)
  }
  assert.equal(gameAvailableAtVenue('revolta', ''), false)
})
test('booking category is independent of game, sales channel and pricing type', () => {
  assert.equal(bookingCategory({ ticket_type: 'birthday' }), 'birthday')
  assert.equal(bookingCategory({ ticket_type: 'corporate' }), 'event')
  assert.equal(bookingCategory({ ticket_type: 'individual', booking_category: 'birthday' }), 'birthday')
  assert.equal(bookingCategory({ ticket_type: 'birthday', booking_category: 'standard' }), 'standard')
  assert.equal(bookingCategory({ booking_source: 'zalo' }), 'standard')
})
