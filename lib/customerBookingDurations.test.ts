import assert from 'node:assert/strict'
import test from 'node:test'
import { customerBookingDurations } from './customerBookingDurations.ts'
import { ticketMaxCustomerDurationMinutes } from './ticketTariffs.ts'
import { ticketPriceBlockMinutesForDate } from './ticketTariffs.ts'

test('customer duration choices follow each booking tariff period and the shared maximum', () => {
  for (const date of ['2026-08-30', '2026-09-10', '2026-10-27']) {
    const block = ticketPriceBlockMinutesForDate(date)
    const durations = customerBookingDurations(date)
    assert.equal(durations[0], block)
    assert.ok(durations.every(duration => duration % block === 0 && duration <= ticketMaxCustomerDurationMinutes))
    assert.ok(durations.at(-1)! + block > ticketMaxCustomerDurationMinutes)
  }
  assert.deepEqual(customerBookingDurations('2026-10-27'), [30, 60, 90, 120, 150, 180])
})
