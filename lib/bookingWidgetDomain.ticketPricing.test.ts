import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateTicketPricing,
  minimumTicketDurationMinutes,
} from './ticketPricing.ts'

test('uses the same four-player formula for every tariff', () => {
  const weekdayDay = calculateTicketPricing(200_000, 4, 120)
  const weekdayEvening = calculateTicketPricing(250_000, 4, 120)
  const weekend = calculateTicketPricing(330_000, 4, 120)

  assert.equal(weekdayDay.totalPrice, 4_800_000)
  assert.equal(weekdayEvening.totalPrice, 6_000_000)
  assert.equal(weekend.totalPrice, 7_920_000)
})

test('charges every player at full price for every booked block', () => {
  const pricing = calculateTicketPricing(330_000, 6, 120)

  assert.equal(pricing.chargedPlayersPerBlock, 6)
  assert.equal(pricing.durationBlocks, 6)
  assert.equal(pricing.chargedPlayerSpots, 36)
  assert.equal(pricing.grossPrice, 11_880_000)
  assert.equal(pricing.discountRate, 0.1)
  assert.equal(pricing.totalPrice, 10_692_000)
})

test('keeps the minimum rotation time for larger groups', () => {
  assert.equal(minimumTicketDurationMinutes(4), 20)
  assert.equal(minimumTicketDurationMinutes(5), 40)
  assert.equal(minimumTicketDurationMinutes(9), 60)
  assert.equal(minimumTicketDurationMinutes(16), 80)
})

test('applies the configured 15 percent discount through 16 players', () => {
  const pricing = calculateTicketPricing(330_000, 16, 120)

  assert.equal(pricing.chargedPlayersPerBlock, 16)
  assert.equal(pricing.discountRate, 0.15)
  assert.equal(pricing.totalPrice, 26_928_000)
})

test('two arenas charge the same full player price', () => {
  const pricing = calculateTicketPricing(330_000, 6, 120, 20, 4, 2)

  assert.equal(pricing.arenaCount, 2)
  assert.equal(pricing.chargedPlayersPerBlock, 6)
  assert.equal(pricing.chargedPlayerSpots, 36)
  assert.equal(pricing.grossPrice, 11_880_000)
  assert.equal(pricing.discountRate, 0.1)
  assert.equal(pricing.totalPrice, 10_692_000)
})

test('two arenas reduce the minimum rotation time', () => {
  assert.equal(minimumTicketDurationMinutes(8, 20, 4, 2), 20)
  assert.equal(minimumTicketDurationMinutes(9, 20, 4, 2), 40)
  assert.equal(minimumTicketDurationMinutes(16, 20, 4, 2), 40)
})

test('weekend totals increase with every additional person for one arena', () => {
  const expectedTotals = new Map([
    [4, 7_920_000],
    [5, 8_910_000],
    [6, 10_692_000],
    [8, 14_256_000],
    [9, 15_147_000],
    [16, 26_928_000],
  ])

  for (let players = 1; players <= 16; players += 1) {
    const current = calculateTicketPricing(330_000, players, 120, 20, 4, 1)
    const previous = players === 1 ? null : calculateTicketPricing(330_000, players - 1, 120, 20, 4, 1)

    if (previous) assert.ok(current.totalPrice > previous.totalPrice)
    if (expectedTotals.has(players)) assert.equal(current.totalPrice, expectedTotals.get(players))
  }
})

test('weekend totals increase with every additional person for two arenas', () => {
  const expectedTotals = new Map([
    [5, 8_910_000],
    [6, 10_692_000],
    [8, 14_256_000],
    [9, 15_147_000],
    [16, 26_928_000],
  ])

  for (let players = 5; players <= 16; players += 1) {
    const current = calculateTicketPricing(330_000, players, 120, 20, 4, 2)
    const previous = players === 5 ? null : calculateTicketPricing(330_000, players - 1, 120, 20, 4, 2)

    if (previous) assert.ok(current.totalPrice > previous.totalPrice)
    if (expectedTotals.has(players)) assert.equal(current.totalPrice, expectedTotals.get(players))
  }
})

test('arena count changes capacity but not price for the same group and duration', () => {
  const oneArena = calculateTicketPricing(330_000, 9, 120, 20, 4, 1)
  const twoArenas = calculateTicketPricing(330_000, 9, 120, 20, 4, 2)

  assert.equal(oneArena.totalPrice, 15_147_000)
  assert.equal(twoArenas.totalPrice, oneArena.totalPrice)
})

test('group discount depends on people, not the number of time blocks', () => {
  const shortBooking = calculateTicketPricing(330_000, 6, 40, 20, 4, 1)
  const longBooking = calculateTicketPricing(330_000, 6, 120, 20, 4, 1)

  assert.equal(shortBooking.discountRate, 0.1)
  assert.equal(longBooking.discountRate, 0.1)
  assert.equal(longBooking.durationBlocks, shortBooking.durationBlocks * 3)
  assert.equal(longBooking.grossPrice, shortBooking.grossPrice * 3)
})
