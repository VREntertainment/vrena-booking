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

test('larger groups reserve no more than four arena places at once', () => {
  const pricing = calculateTicketPricing(330_000, 6, 120)

  assert.equal(pricing.chargedPlayersPerBlock, 4)
  assert.equal(pricing.durationBlocks, 6)
  assert.equal(pricing.chargedPlayerSpots, 24)
  assert.equal(pricing.grossPrice, 7_920_000)
  assert.equal(pricing.discountRate, 0.1)
  assert.equal(pricing.totalPrice, 7_128_000)
})

test('keeps the minimum rotation time for larger groups', () => {
  assert.equal(minimumTicketDurationMinutes(4), 20)
  assert.equal(minimumTicketDurationMinutes(5), 40)
  assert.equal(minimumTicketDurationMinutes(9), 60)
  assert.equal(minimumTicketDurationMinutes(16), 60)
})

test('applies the configured 15 percent discount through 16 players', () => {
  const pricing = calculateTicketPricing(330_000, 16, 120)

  assert.equal(pricing.chargedPlayersPerBlock, 4)
  assert.equal(pricing.discountRate, 0.15)
  assert.equal(pricing.totalPrice, 6_732_000)
})
