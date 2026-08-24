import assert from 'node:assert/strict'
import test from 'node:test'
import { isSameOriginRequest } from './requestOrigin.ts'

test('accepts an exact browser origin', () => {
  assert.equal(isSameOriginRequest(new Headers({ origin: 'https://booking.vre-vietnam.com', 'sec-fetch-site': 'same-origin' }), 'https://booking.vre-vietnam.com'), true)
})

test('rejects missing, malformed, and cross-site origins', () => {
  assert.equal(isSameOriginRequest(new Headers(), 'https://booking.vre-vietnam.com'), false)
  assert.equal(isSameOriginRequest(new Headers({ origin: 'not a url' }), 'https://booking.vre-vietnam.com'), false)
  assert.equal(isSameOriginRequest(new Headers({ origin: 'https://evil.example' }), 'https://booking.vre-vietnam.com'), false)
  assert.equal(isSameOriginRequest(new Headers({ origin: 'https://booking.vre-vietnam.com', 'sec-fetch-site': 'cross-site' }), 'https://booking.vre-vietnam.com'), false)
})
