import assert from 'node:assert/strict'
import { test } from 'node:test'
import { staffBookingHours, validStaffBookingTime } from './staff/bookingHours.ts'

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
