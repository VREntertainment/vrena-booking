import assert from 'node:assert/strict'
import test from 'node:test'
import {
  individualTicketUnitPrice,
  ticketPriceBlockMinutesForDate,
} from './ticketTariffs.ts'
import { calculateTicketPricing, minimumTicketDurationMinutes } from './ticketPricing.ts'

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
  assert.equal(pricing.totalPrice, 2_080_000)
})

test('uses 45-minute capacity steps for larger groups', () => {
  assert.equal(minimumTicketDurationMinutes(4, 45, 4, 1), 45)
  assert.equal(minimumTicketDurationMinutes(5, 45, 4, 1), 90)
  assert.equal(minimumTicketDurationMinutes(9, 45, 4, 1), 135)
  assert.equal(minimumTicketDurationMinutes(16, 45, 4, 1), 180)
  assert.equal(minimumTicketDurationMinutes(8, 45, 4, 2), 45)
  assert.equal(minimumTicketDurationMinutes(16, 45, 4, 2), 90)
})
