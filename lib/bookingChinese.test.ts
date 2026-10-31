import assert from 'node:assert/strict'
import test from 'node:test'
import { en, type TranslationKey } from './i18n/base.ts'
import { zh } from './i18n/locales/zh.ts'

test('Chinese booking copy preserves every dynamic value used by the UI', () => {
  for (const key of Object.keys(en) as TranslationKey[]) {
    const placeholders = (value: string) => [...new Set(value.match(/\{\w+\}/g) || [])].sort()
    assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), key)
    assert.ok(zh[key].trim(), key)
  }
})

test('Chinese checkout, validation, confirmation and account actions are translated', () => {
  for (const key of ['bookTickets', 'bookingConfirmed', 'guestTicketTitle', 'guestTicketPhoneInvalid', 'guestTicketBookWithoutAccountCta', 'phoneRequired', 'ticketPlayersInvalid', 'ticketRequired', 'bookingVenueTitle', 'date', 'chooseTime', 'numberOfPlayers', 'logIn', 'createAccount', 'saveProfile', 'deleteAccount', 'marketingConsent', 'ticketLoyaltyBalance'] as const) {
    assert.notEqual(zh[key], en[key], key)
    assert.match(zh[key], /\p{Script=Han}/u, key)
  }
})
