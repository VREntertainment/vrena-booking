import test from 'node:test'
import assert from 'node:assert/strict'
import { birthdayPackageById, birthdayPackages, birthdayPackageSelection, selectedBirthdayPackage, withoutBirthdayPackageNote } from './birthdayPackages.ts'
import { buildTicketBookingRequest } from './ticketBookingRequest.ts'

test('only known package IDs can select a package; URL prices and player counts cannot override it', () => {
  assert.equal(birthdayPackageById('birthday-squad')?.price, 3600000)
  for (const id of ['', undefined, 'custom', '__proto__', 'mini-mission&price=1']) assert.equal(birthdayPackageById(id), null)
})

test('each package carries the correct players and duration, respecting venue arena capacity', () => {
  assert.deepEqual(birthdayPackages.map(p => [p.players, p.price, p.arenas]), [[4, 1900000, 1], [8, 3600000, 1], [12, 4500000, 2]])
  for (const item of birthdayPackages) {
    const haDo = birthdayPackageSelection(item.id, 'ha-do-centrosa')!
    const thaoDien = birthdayPackageSelection(item.id, 'cafe-des-stagiaires')!
    assert.equal(haDo.arenas, item.arenas)
    assert.equal(thaoDien.arenas, 1)
    assert.equal(haDo.duration, 120)
    assert.equal(haDo.players, item.players)
    assert.equal(selectedBirthdayPackage('birthday', item.players, 120, haDo.note)?.id, item.id)
  }
})

test('customized counts, durations and other ticket types do not retain a fixed package price', () => {
  const preset = birthdayPackageSelection('mini-mission', 'ha-do-centrosa')!
  assert.equal(selectedBirthdayPackage('birthday', 8, 120, preset.note), null)
  assert.equal(selectedBirthdayPackage('birthday', 4, 150, preset.note), null)
  assert.equal(selectedBirthdayPackage('individual', 4, 120, preset.note), null)
  assert.equal(withoutBirthdayPackageNote(`${preset.note}\nExtra time please`), 'Extra time please')
})

test('package request survives all guest and account RPC paths without trusting a client price', () => {
  for (const item of birthdayPackages) for (const isHaDo of [true, false]) for (const authenticated of [true, false]) {
    const preset = birthdayPackageSelection(item.id, isHaDo ? 'ha-do-centrosa' : 'cafe-des-stagiaires')!
    const request = buildTicketBookingRequest({
      isHaDo, authenticated, ticketType: 'birthday', date: '2026-11-10', time: '16:00',
      durationMinutes: preset.duration, players: preset.players, arenaCount: preset.arenas,
      defaultGame: 'joller-house', unitPrice: 1, totalPrice: 1, special: true,
      note: preset.note, loyaltyPoints: 100, discountCode: 'TEST', guestName: 'Guest', guestPhone: '+84900000999',
    })
    assert.equal(request.args.p_player_count, item.players)
    assert.equal(request.args.p_duration_minutes, 120)
    const note = 'p_guest_note' in request.args ? request.args.p_guest_note : 'p_special_note' in request.args ? request.args.p_special_note : null
    assert.equal(note, preset.note)
    if ('p_total_price' in request.args) assert.equal(request.args.p_total_price, 0)
  }
})
