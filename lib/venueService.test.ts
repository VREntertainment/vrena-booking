import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextRequest } from 'next/server'
import { authorizedVenuePrincipal, configuredVenueCredentials } from './venueService.ts'

const originalToken = process.env.VRENA_RESULTS_INGEST_TOKEN
const originalTokens = process.env.VRENA_RESULTS_INGEST_TOKENS
const originalVenue = process.env.VRENA_RESULTS_DEFAULT_VENUE_KEY

test.afterEach(() => {
  if (originalToken === undefined) delete process.env.VRENA_RESULTS_INGEST_TOKEN
  else process.env.VRENA_RESULTS_INGEST_TOKEN = originalToken
  if (originalTokens === undefined) delete process.env.VRENA_RESULTS_INGEST_TOKENS
  else process.env.VRENA_RESULTS_INGEST_TOKENS = originalTokens
  if (originalVenue === undefined) delete process.env.VRENA_RESULTS_DEFAULT_VENUE_KEY
  else process.env.VRENA_RESULTS_DEFAULT_VENUE_KEY = originalVenue
})

function requestFor(token: string) {
  return { headers: new Headers({ authorization: `Bearer ${token}` }) } as NextRequest
}

test('maps the legacy production token to the explicit default venue', () => {
  delete process.env.VRENA_RESULTS_INGEST_TOKENS
  process.env.VRENA_RESULTS_INGEST_TOKEN = 'a'.repeat(32)
  process.env.VRENA_RESULTS_DEFAULT_VENUE_KEY = 'ha-do-centrosa'
  assert.deepEqual(authorizedVenuePrincipal(requestFor('a'.repeat(32))), { venueKey: 'ha-do-centrosa' })
})

test('supports independently revocable tokens for multiple venues', () => {
  process.env.VRENA_RESULTS_INGEST_TOKENS = JSON.stringify({
    'ha-do-centrosa': 'a'.repeat(32),
    'cafe-des-stagiaires': 'b'.repeat(32),
  })
  assert.equal(configuredVenueCredentials().length, 2)
  assert.deepEqual(authorizedVenuePrincipal(requestFor('b'.repeat(32))), { venueKey: 'cafe-des-stagiaires' })
  assert.equal(authorizedVenuePrincipal(requestFor('c'.repeat(32))), null)
})
