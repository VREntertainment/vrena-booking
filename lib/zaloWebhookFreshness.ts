const ZALO_WEBHOOK_MAX_AGE_MS = 10 * 60 * 1000

export function zaloWebhookTimestampMs(value: number) {
  return value >= 1_000_000_000_000 ? value : value * 1000
}

export function isFreshZaloWebhookTimestamp(value: number | undefined, now = Date.now()) {
  if (value === undefined || !Number.isFinite(value)) return false
  return Math.abs(now - zaloWebhookTimestampMs(value)) <= ZALO_WEBHOOK_MAX_AGE_MS
}
