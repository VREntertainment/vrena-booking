import assert from 'node:assert/strict'
import { test } from 'node:test'
import { staffBookingEndTime, staffBookingHours, validStaffBookingTime } from './staff/bookingHours.ts'

test('staff time limits share client shop hours and allow enough time to finish', () => {
  assert.deepEqual(staffBookingHours('ha-do-centrosa', 20), { min: '09:00', max: '21:40', close: '22:00' })
  assert.deepEqual(staffBookingHours('cafe-des-stagiaires', 45), { min: '15:30', max: '22:15', close: '23:00' })
  assert.equal(validStaffBookingTime('cafe-des-stagiaires', 45, '15:29'), false)
  assert.equal(validStaffBookingTime('cafe-des-stagiaires', 45, '15:30'), true)
  assert.equal(validStaffBookingTime('cafe-des-stagiaires', 45, '22:15'), true)
  assert.equal(validStaffBookingTime('cafe-des-stagiaires', 45, '22:16'), false)
  assert.equal(validStaffBookingTime('ha-do-centrosa', 20, '08:59'), false)
  assert.equal(validStaffBookingTime('ha-do-centrosa', 20, '09:00'), true)
  assert.equal(validStaffBookingTime('ha-do-centrosa', 20, '22:00'), false)
})

test('events use exact durations and explicit outside-hours permission', () => {
  assert.equal(validStaffBookingTime('cafe-des-stagiaires', 127, '10:13'), false)
  assert.equal(validStaffBookingTime('cafe-des-stagiaires', 127, '10:13', true), true)
  assert.equal(staffBookingEndTime('10:13', 127), '12:20')
  assert.equal(validStaffBookingTime('cafe-des-stagiaires', 60, '23:00', true), true)
  assert.equal(staffBookingEndTime('23:00', 60), '24:00')
  assert.equal(validStaffBookingTime('cafe-des-stagiaires', 61, '23:00', true), false)
  for (const duration of [0, -1, 1.5, NaN, Infinity, 1441]) {
    assert.equal(validStaffBookingTime('cafe-des-stagiaires', duration, '10:00', true), false)
  }
})
