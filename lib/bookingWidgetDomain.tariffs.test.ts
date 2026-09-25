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
  assert.equal(ticketPriceBlockMinutesForDate('2026-09-24'), 45)
  assert.equal(individualTicketUnitPrice('2026-08-31', '09:00', 'ha-do-centrosa'), 220_000)
  assert.equal(individualTicketUnitPrice('2026-08-31', '16:00', 'ha-do-centrosa'), 260_000)
  assert.equal(individualTicketUnitPrice('2026-08-31', '20:00', 'ha-do-centrosa'), 290_000)
})

test('uses 30-minute ticket blocks from September 25', () => {
  assert.equal(ticketPriceBlockMinutesForDate('2026-09-25'), 30)
})

test('uses the new Hà Đô weekend daytime and evening tariffs', () => {
  assert.equal(individualTicketUnitPrice('2026-09-05', '19:40', 'ha-do-centrosa'), 330_000)
  assert.equal(individualTicketUnitPrice('2026-09-05', '20:00', 'ha-do-centrosa'), 290_000)
})

test('uses the CS 4pm and 8pm tariff boundary every day', () => {
  assert.equal(individualTicketUnitPrice('2026-08-31', '16:00', 'cafe-des-stagiaires'), 240_000)
  assert.equal(individualTicketUnitPrice('2026-08-31', '20:00', 'cafe-des-stagiaires'), 290_000)
  assert.equal(individualTicketUnitPrice('2026-09-05', '16:00', 'cafe-des-stagiaires'), 240_000)
  assert.equal(individualTicketUnitPrice('2026-09-05', '20:00', 'cafe-des-stagiaires'), 290_000)
})

test('prices each player for every 30-minute session', () => {
  const pricing = calculateTicketPricing(260_000, 4, 60, 30, 4, 1)

  assert.equal(pricing.durationBlocks, 2)
  assert.equal(pricing.grossPrice, 2_080_000)
  assert.equal(pricing.totalPrice, 1_976_000)
})

test('uses 30-minute capacity steps for larger groups', () => {
  assert.equal(minimumTicketDurationMinutes(4, 30, 4, 1), 30)
  assert.equal(minimumTicketDurationMinutes(5, 30, 4, 1), 30)
  assert.equal(minimumTicketDurationMinutes(9, 30, 4, 1), 60)
  assert.equal(minimumTicketDurationMinutes(16, 30, 4, 1), 60)
  assert.equal(minimumTicketDurationMinutes(8, 30, 4, 2), 30)
  assert.equal(minimumTicketDurationMinutes(16, 30, 4, 2), 30)
})

test('fits up to sixteen billed players in one 30-minute Cafe ticket block', () => {
  assert.equal(minimumTicketDurationMinutes(8, 30, 8, 1), 30)
  assert.equal(minimumTicketDurationMinutes(9, 30, 8, 1), 30)
  assert.equal(minimumTicketDurationMinutes(16, 30, 8, 1), 30)
})


test('venue capacity used by the booking form covers the Cafe five-to-nine player boundary', () => {
  const cafe = ticketArenaCapacityForVenue('cafe-des-stagiaires')
  const hado = ticketArenaCapacityForVenue('ha-do-centrosa')
  assert.equal(cafe, 8)
  assert.equal(hado, 4)
  for (const count of [5, 6, 7, 8]) {
    assert.equal(minimumTicketDurationMinutes(count, 30, cafe, 1), 30)
  }
  assert.equal(minimumTicketDurationMinutes(9, 30, cafe, 1), 30)
  assert.equal(minimumTicketDurationMinutes(5, 30, hado, 1), 30)
  assert.equal(calculateTicketPricing(240_000, 5, 30, 30, cafe, 1).totalPrice, 1_140_000)
})


test('caps billed players and bases discounts on total paid player-slots', () => {
  for (const [capacity, arenas, guests, billed] of [
    [4,1,1,1], [4,1,4,4], [4,1,5,4], [4,1,8,4],
    [4,2,8,8], [4,2,9,8], [4,2,16,8],
    [8,1,5,5], [8,1,8,8], [8,1,9,8], [8,1,16,8],
  ]) {
    for (const duration of [30,60,90,120]) {
      const price=calculateTicketPricing(240000,guests,duration,30,capacity,arenas)
      const slots=billed*(duration/30)
      const rate=slots>=9&&slots<=16?0.05:slots>=5&&slots<=8?0.05:0
      assert.equal(price.chargedPlayersPerBlock,billed)
      assert.equal(price.discountRate,rate)
      assert.equal(price.totalPrice,Math.round(240000*slots*(1-rate)))
    }
  }
  assert.equal(calculateTicketPricing(220000,8,30,30,4,1).totalPrice,880000)
  assert.equal(calculateTicketPricing(220000,8,60,30,4,1).totalPrice,1672000)
  assert.equal(calculateTicketPricing(220000,8,90,30,4,1).totalPrice,2508000)
})
