import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkServiceHealth } from './serviceHealth.ts'

const options = { url: 'http://127.0.0.1:56431', anonKey: 'local-test-key' }

test('readiness requires both authentication and database access', async () => {
  const requests: string[] = []
  const health = await checkServiceHealth({ ...options, fetcher: async (input, init) => {
    requests.push(String(input))
    assert.equal(init?.cache, 'no-store')
    assert.ok(init?.signal)
    return new Response('[]')
  } })
  assert.deepEqual(health, { status: 'ok', checks: { database: 'ok', auth: 'ok' } })
  assert.equal(requests.length, 2)
  assert.ok(requests.some((url) => url.endsWith('staff_games?select=id&limit=1')))
})

test('dependency failures and timeouts become unavailable without exposing error details', async () => {
  const health = await checkServiceHealth({ ...options, fetcher: async (input) => {
    if (String(input).includes('/auth/')) throw new Error('Private upstream details')
    return new Response('private error', { status: 503 })
  } })
  assert.deepEqual(health, { status: 'unavailable', checks: { database: 'unavailable', auth: 'unavailable' } })
})

test('missing configuration fails closed without making network requests', async () => {
  const health = await checkServiceHealth({ fetcher: async () => { throw new Error('Must not fetch') } })
  assert.equal(health.status, 'unavailable')
})
