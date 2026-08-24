import assert from 'node:assert/strict'
import test from 'node:test'
import { isFreshZaloWebhookTimestamp } from './zaloWebhookFreshness.ts'

test('accepts fresh second and millisecond timestamps', () => {
  const now = Date.UTC(2026, 7, 24, 12, 0, 0)
  assert.equal(isFreshZaloWebhookTimestamp(now, now), true)
  assert.equal(isFreshZaloWebhookTimestamp(now / 1000, now), true)
})

test('rejects missing, stale, and excessively future timestamps', () => {
  const now = Date.UTC(2026, 7, 24, 12, 0, 0)
  assert.equal(isFreshZaloWebhookTimestamp(undefined, now), false)
  assert.equal(isFreshZaloWebhookTimestamp(now - 11 * 60 * 1000, now), false)
  assert.equal(isFreshZaloWebhookTimestamp(now + 11 * 60 * 1000, now), false)
})
