import assert from 'node:assert/strict'
import test from 'node:test'
import { calendarRange } from './calendarRange.ts'

test('staff calendar expands to include early and late reservations in the selected week', () => {
  assert.deepEqual(calendarRange(930, 1380, 10, [{ start_time: '08:05:00', duration_minutes: 90 }, { start_time: '23:10', duration_minutes: 45 }], true), [480, 1440])
  assert.deepEqual(calendarRange(540, 1320, 30, [{ start_time: '08:05', duration_minutes: 60 }, { start_time: '22:15', duration_minutes: 30 }], true), [480, 1380])
})
test('editing or removing outside-hours reservations recalculates the displayed period', () => {
  assert.deepEqual(calendarRange(930, 1380, 10, [{ start_time: '14:00', duration_minutes: 60 }], true), [840, 1380])
  assert.deepEqual(calendarRange(930, 1380, 10, [{ start_time: '16:00', duration_minutes: 60 }], true), [930, 1380])
  assert.deepEqual(calendarRange(930, 1380, 10, [], true), [930, 1380])
})
test('public calendar retains normal opening hours', () => {
  assert.deepEqual(calendarRange(930, 1380, 10, [{ start_time: '08:00', duration_minutes: 60 }], false), [930, 1380])
})
