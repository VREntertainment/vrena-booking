import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { staffCustomerAccessResponse, staffCustomerCreationLocations } from './staffCustomerScope.ts'

function caller(result: { data: unknown; error: unknown }, calls: unknown[][] = []) {
  return { rpc: async (...args: unknown[]) => { calls.push(args); return result } } as unknown as Pick<SupabaseClient, 'rpc'>
}

test('customer access requires explicit database authorization for the exact target', async () => {
  const calls: unknown[][] = []
  assert.equal(await staffCustomerAccessResponse(caller({ data: true, error: null }, calls), 'customer-id'), null)
  assert.deepEqual(calls, [['staff_customer_profile_allowed', { p_profile_id: 'customer-id' }]])
  for (const data of [false, null, undefined, 'true', 1, {}]) {
    assert.equal((await staffCustomerAccessResponse(caller({ data, error: null }), 'other-venue'))?.status, 403)
  }
})

test('customer guard fails closed during unavailable or failed authorization RPC', async () => {
  assert.equal((await staffCustomerAccessResponse(caller({ data: true, error: { message: 'unavailable' } }), 'customer-id'))?.status, 503)
  await assert.rejects(staffCustomerAccessResponse({ rpc: async () => { throw new Error('network failure') } } as unknown as Pick<SupabaseClient, 'rpc'>, 'customer-id'))
})

test('creation keeps only the caller returned venue keys and rejects empty or failed scope', async () => {
  const allowed = await staffCustomerCreationLocations(caller({ data: [{ venue_key: 'ha-do-centrosa' }], error: null }))
  assert.equal(allowed.response, null)
  assert.deepEqual(allowed.locations, ['ha-do-centrosa'])
  for (const data of [[], null, {}, [{ venue_key: 123 }]]) {
    assert.equal((await staffCustomerCreationLocations(caller({ data, error: null }))).response?.status, 403)
  }
  assert.equal((await staffCustomerCreationLocations(caller({ data: [{ venue_key: 'ha-do-centrosa' }], error: {} }))).response?.status, 503)
})
