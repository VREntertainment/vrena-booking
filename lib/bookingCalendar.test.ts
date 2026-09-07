import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarLanes } from './bookingCalendar.ts'

test('calendar lanes keep concurrent bookings visible and reuse the full width afterwards', () => {
  const row = (id: string, start_time: string, duration_minutes: number, date = '2026-09-07') => ({ id, start_time, duration_minutes, date })
  const lanes = calendarLanes([row('a','16:00',60),row('b','16:20',20),row('c','16:40',40),row('d','17:20',20),row('e','16:00',20,'2026-09-08')])
  assert.deepEqual(lanes.get('a'), { lane: 0, lanes: 2 })
  assert.deepEqual(lanes.get('b'), { lane: 1, lanes: 2 })
  assert.deepEqual(lanes.get('c'), { lane: 1, lanes: 2 })
  assert.deepEqual(lanes.get('d'), { lane: 0, lanes: 1 })
  assert.deepEqual(lanes.get('e'), { lane: 0, lanes: 1 })
})
