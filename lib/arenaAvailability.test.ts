import assert from 'node:assert/strict'
import { test } from 'node:test'
import { arenaTimeOptions, vietnamClock } from './booking/arenaAvailability.ts'
const now = new Date('2026-10-12T08:30:00Z')
const row = { venue_key: 'cafe-des-stagiaires', date: '2026-10-13', start_time: '16:00', duration_minutes: 60, arena_number: 1 }
test('Thao Dien hides occupied times and permits exact adjacency', () => {
  const times = arenaTimeOptions(row.venue_key, row.date, 30, 1, [row], now).map(x => x.value)
  assert.ok(times.includes('15:30'))
  assert.ok(!times.includes('15:40'))
  assert.ok(!times.includes('16:30'))
  assert.ok(times.includes('17:00'))
  assert.equal(times.at(-1), '22:30')
  assert.deepEqual(arenaTimeOptions(row.venue_key, row.date, 30, 2, [], now), [])
})
test('Ha Do counts physical arenas once across consecutive bookings', () => {
  const rows = [{ ...row, venue_key:'ha-do-centrosa', start_time:'16:00', duration_minutes:30 }, { ...row, venue_key:'ha-do-centrosa', start_time:'16:30', duration_minutes:30 }]
  assert.equal(arenaTimeOptions('ha-do-centrosa', row.date, 60, 1, rows, now).find(x => x.value === '16:00')?.remaining, 1)
  assert.ok(!arenaTimeOptions('ha-do-centrosa', row.date, 60, 2, rows, now).some(x => x.value === '16:00'))
  assert.ok(!arenaTimeOptions('ha-do-centrosa', row.date, 60, 1, [...rows, { ...rows[0], arena_number:2 }], now).some(x => x.value === '16:00'))
})
test('Vietnam time drives cutoff regardless of browser time zone', () => {
  assert.deepEqual(vietnamClock(now), { date:'2026-10-12', minutes:930 })
  assert.equal(arenaTimeOptions(row.venue_key, '2026-10-12', 30, 1, [], now)[0].value, '15:40')
  assert.deepEqual(arenaTimeOptions(row.venue_key, '2026-10-11', 30, 1, [], now), [])
  assert.deepEqual(vietnamClock(new Date('2026-10-12T17:00:00Z')), { date:'2026-10-13', minutes:0 })
})
