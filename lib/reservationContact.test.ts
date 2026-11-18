import { getCountries, getExampleNumber, parsePhoneNumberFromString } from 'libphonenumber-js/max'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reservationPhone, officialReservationContact, guestEmailIsValid } from './reservationContact.ts'

test('normalizes trunk zeros before checking official phones', () => {
  for (const phone of ['0981152315', '+840981152315', '+84981152315', '00840981152315', '+84 (0) 981 152 315']) {
    assert.equal(reservationPhone(phone), '+84981152315')
    assert.equal(officialReservationContact('personal@gmail.com', phone), true)
  }
  assert.equal(officialReservationContact('EMILE@VRE-VIETNAM.COM', '+84901234567'), true)
})
test('validates country-specific lengths and prefixes', () => {
  for (const phone of ['+84098115235', '+8490123456', '+3361234567', '+1650253000', '+849012345678']) assert.equal(reservationPhone(phone), null, phone)
  for (const phone of ['+840901234567', '+33612345678', '+16502530000', '+39066982', '+442079460018', '+819012345678']) assert.ok(reservationPhone(phone), phone)
})
test('guest email cannot be absent, malformed or synthetic', () => {
  for (const email of [undefined, '', 'abc', 'a@b', 'guest@vrena.guest.invalid']) assert.equal(guestEmailIsValid(email), false)
  assert.equal(guestEmailIsValid(' visitor@gmail.com '), true)
})

test('compact full-pattern validator agrees with country examples and rejects truncated numbers', () => {
  const examples = createRequire(import.meta.url)('libphonenumber-js/examples.mobile.json')
  let checked = 0
  for (const country of getCountries()) {
    const phone = getExampleNumber(country, examples)
    if (!phone?.isValid()) continue
    checked++
    assert.equal(reservationPhone(phone.number), phone.number, country)
    const short = phone.number.slice(0, -1)
    if (!parsePhoneNumberFromString(short)?.isValid()) assert.equal(reservationPhone(short), null, country + ' missing digit')
  }
  assert.ok(checked > 200)
})
