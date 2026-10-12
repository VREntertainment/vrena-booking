import assert from 'node:assert/strict'
import test from 'node:test'
import { staffBookingName } from './staffBookingName.ts'

test('removes game names from generated booking titles even after the game changes', () => {
  assert.equal(staffBookingName('Staff booking - City Z'), 'Staff booking')
  assert.equal(staffBookingName('Staff booking - Revolta'), 'Staff booking')
})
test('preserves custom booking names', () => {
  for (const name of ['Alain birthday', 'City Z fans party', 'Staff booking - School group', 'Staff booking']) assert.equal(staffBookingName(name), name)
})
test('recognizes staff catalog game names', () => {
  assert.equal(staffBookingName('Staff booking - New game', ['New game']), 'Staff booking')
})

test('identifies generated client bookings without changing custom names', () => {
  for (const name of ['VRena Thao Dien - Individual', 'Vrena Thao Dien - Individual', 'Ticket booking - Individual', 'Ticket booking - Birthday', 'Cafe soft-opening request - Corporate']) {
    assert.equal(staffBookingName(name), 'Client booking')
  }
  assert.equal(staffBookingName('VRena Thao Dien - School visit'), 'VRena Thao Dien - School visit')
})
