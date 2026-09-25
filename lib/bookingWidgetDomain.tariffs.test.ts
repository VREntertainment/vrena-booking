import assert from 'node:assert/strict'
import test from 'node:test'
import {
  individualTicketUnitPrice,
  ticketPriceBlockMinutesForDate,
} from './ticketTariffs.ts'
import { calculateTicketPricing, minimumTicketDurationMinutes, ticketArenaCapacityForVenue } from './ticketPricing.ts'

test('keeps the legacy tariff and 20-minute block before August 31', () => {
  assert.equal(ticketPriceBlockMinutesForDate('2026-08-30'), 20)
  assert.equal(individualTicketUnitPrice('2026-08-30', '12:00', 'ha-do-centrosa'), 330_000)
})

test('uses the new Hà Đô weekday tariff periods from August 31', () => {
  assert.equal(ticketPriceBlockMinutesForDate('2026-08-31'), 45)
  assert.equal(individualTicketUnitPrice('2026-08-31', '09:00', 'ha-do-centrosa'), 220_000)
  assert.equal(individualTicketUnitPrice('2026-08-31', '16:00', 'ha-do-centrosa'), 260_000)
  assert.equal(individualTicketUnitPrice('2026-08-31', '20:00', 'ha-do-centrosa'), 290_000)
})

test('uses the new Hà Đô weekend daytime and evening tariffs', () => {
  assert.equal(individualTicketUnitPrice('2026-09-05', '19:40', 'ha-do-centrosa'), 330_000)
  assert.equal(individualTicketUnitPrice('2026-09-05', '20:00', 'ha-do-centrosa'), 390_000)
})

test('uses the CS 4pm and 8pm tariff boundary every day', () => {
  assert.equal(individualTicketUnitPrice('2026-08-31', '16:00', 'cafe-des-stagiaires'), 240_000)
  assert.equal(individualTicketUnitPrice('2026-08-31', '20:00', 'cafe-des-stagiaires'), 290_000)
  assert.equal(individualTicketUnitPrice('2026-09-05', '16:00', 'cafe-des-stagiaires'), 240_000)
  assert.equal(individualTicketUnitPrice('2026-09-05', '20:00', 'cafe-des-stagiaires'), 290_000)
})

test('prices each player for every 45-minute session', () => {
  const pricing = calculateTicketPricing(260_000, 4, 90, 45, 4, 1)

  assert.equal(pricing.durationBlocks, 2)
  assert.equal(pricing.grossPrice, 2_080_000)
  assert.equal(pricing.totalPrice, 1_976_000)
})

test('uses 45-minute capacity steps for larger groups', () => {
  assert.equal(minimumTicketDurationMinutes(4, 45, 4, 1), 45)
  assert.equal(minimumTicketDurationMinutes(5, 45, 4, 1), 45)
  assert.equal(minimumTicketDurationMinutes(9, 45, 4, 1), 90)
  assert.equal(minimumTicketDurationMinutes(16, 45, 4, 1), 90)
  assert.equal(minimumTicketDurationMinutes(8, 45, 4, 2), 45)
  assert.equal(minimumTicketDurationMinutes(16, 45, 4, 2), 45)
})

test('fits up to eight simultaneous players in the Cafe single arena', () => {
  assert.equal(minimumTicketDurationMinutes(8, 45, 8, 1), 45)
  assert.equal(minimumTicketDurationMinutes(9, 45, 8, 1), 45)
  assert.equal(minimumTicketDurationMinutes(16, 45, 8, 1), 45)
})


test('venue capacity used by the booking form covers the Cafe five-to-nine player boundary', () => {
  const cafe = ticketArenaCapacityForVenue('cafe-des-stagiaires')
  const hado = ticketArenaCapacityForVenue('ha-do-centrosa')
  assert.equal(cafe, 8)
  assert.equal(hado, 4)
  for (const count of [5, 6, 7, 8]) {
    assert.equal(minimumTicketDurationMinutes(count, 45, cafe, 1), 45)
  }
  assert.equal(minimumTicketDurationMinutes(9, 45, cafe, 1), 45)
  assert.equal(minimumTicketDurationMinutes(5, 45, hado, 1), 45)
  assert.equal(calculateTicketPricing(240_000, 5, 45, 45, cafe, 1).totalPrice, 1_140_000)
})


test('caps billed players and bases discounts on total paid player-slots', () => {
  for (const [capacity, arenas, guests, billed] of [
    [4,1,1,1], [4,1,4,4], [4,1,5,4], [4,1,8,4],
    [4,2,8,8], [4,2,9,8], [4,2,16,8],
    [8,1,5,5], [8,1,8,8], [8,1,9,8], [8,1,16,8],
  ]) {
    for (const duration of [45,90,135,180]) {
      const price=calculateTicketPricing(240000,guests,duration,45,capacity,arenas)
      const slots=billed*(duration/45)
      const rate=slots>=9&&slots<=16?0.05:slots>=5&&slots<=8?0.05:0
      assert.equal(price.chargedPlayersPerBlock,billed)
      assert.equal(price.discountRate,rate)
      assert.equal(price.totalPrice,Math.round(240000*slots*(1-rate)))
    }
  }
  assert.equal(calculateTicketPricing(220000,8,45,45,4,1).totalPrice,880000)
  assert.equal(calculateTicketPricing(220000,8,90,45,4,1).totalPrice,1672000)
  assert.equal(calculateTicketPricing(220000,8,135,45,4,1).totalPrice,2508000)
})
