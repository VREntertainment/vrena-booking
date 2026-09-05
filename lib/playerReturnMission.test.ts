import assert from 'node:assert/strict'
import test from 'node:test'
// Node's type-stripping test runner requires the explicit TypeScript extension.
import {
  buildPlayerReturnMission,
  longestWeeklyRunWithGrace,
  nextVrenaWeekendReminderAt,
  playerReturnGraceState,
  returnReminderDateKey,
} from './playerReturnMission.ts'

function session(date: string) {
  return { date, start_time: '18:00:00' }
}

test('keeps one missed week as a grace week', () => {
  const sessions = [session('2026-07-20'), session('2026-08-03')]
  assert.equal(longestWeeklyRunWithGrace(sessions), 2)

  const mission = buildPlayerReturnMission(sessions, new Date('2026-08-06T12:00:00'))
  assert.equal(mission.activeWeeks, 2)
  assert.equal(mission.graceUsed, true)
  assert.equal(mission.graceAvailable, false)
  assert.equal(mission.targetWeeks, 4)
})

test('does not preserve a run across two missed weeks', () => {
  const sessions = [session('2026-07-13'), session('2026-08-03')]
  assert.equal(longestWeeklyRunWithGrace(sessions), 1)
})

test('recognizes a current-week visit and the next achievement target', () => {
  const mission = buildPlayerReturnMission([
    session('2026-07-27'),
    session('2026-08-05'),
  ], new Date('2026-08-06T12:00:00'))

  assert.equal(mission.currentWeekVisits, 1)
  assert.equal(mission.activeWeeks, 2)
  assert.equal(mission.graceAvailable, true)
  assert.equal(mission.targetWeeks, 4)
  assert.equal(mission.latestSession?.date, '2026-08-05')
})

test('returns a ready-to-start mission before the first checked-in visit', () => {
  const mission = buildPlayerReturnMission([], new Date('2026-08-06T12:00:00'))

  assert.equal(mission.latestSession, null)
  assert.equal(mission.activeWeeks, 0)
  assert.equal(mission.currentWeekVisits, 0)
  assert.equal(mission.graceAvailable, true)
  assert.equal(mission.targetWeeks, 2)
  assert.equal(playerReturnGraceState(mission), 'hidden')
})

test('offers grace outside the play-week path and activates it only after a missed week', () => {
  const available = buildPlayerReturnMission([
    session('2026-08-03'),
  ], new Date('2026-08-06T12:00:00'))
  assert.equal(playerReturnGraceState(available), 'available')

  const protecting = buildPlayerReturnMission([
    session('2026-07-27'),
  ], new Date('2026-08-10T12:00:00'))
  assert.equal(protecting.currentWeekVisits, 0)
  assert.equal(playerReturnGraceState(protecting), 'protecting')

  const used = buildPlayerReturnMission([
    session('2026-07-20'),
    session('2026-08-03'),
  ], new Date('2026-08-06T12:00:00'))
  assert.equal(used.currentWeekVisits, 1)
  assert.equal(playerReturnGraceState(used), 'used')
})

test('schedules the reminder for Saturday morning in Vietnam', () => {
  const reminder = nextVrenaWeekendReminderAt(new Date('2026-08-06T03:00:00.000Z'))
  assert.equal(reminder.toISOString(), '2026-08-08T03:00:00.000Z')
  assert.equal(returnReminderDateKey(reminder), '2026-08-08')
})

test('rolls a Saturday reminder to the following weekend after 10:00', () => {
  const reminder = nextVrenaWeekendReminderAt(new Date('2026-08-08T04:00:00.000Z'))
  assert.equal(reminder.toISOString(), '2026-08-15T03:00:00.000Z')
})
