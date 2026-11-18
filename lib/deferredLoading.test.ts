import assert from 'node:assert/strict'
import test from 'node:test'
import { createDeferredLoading } from './booking/deferredLoading.ts'

function fixture() {
  const states: boolean[] = []
  let start!: () => void
  let cancellations = 0
  const loading = createDeferredLoading(value => states.push(value), callback => {
    start = callback
    return () => { cancellations++ }
  })
  return { loading, states, start: () => start(), cancelled: () => cancellations }
}

test('a response finishing before the loading task cannot leave checkout busy', () => {
  const request = fixture()
  request.loading.finish()
  request.start() // Also safe if a callback was already queued when cancelled.
  assert.deepEqual(request.states, [false])
  assert.equal(request.cancelled(), 1)
})

test('a pending request shows loading and clears it when finished', () => {
  const request = fixture()
  request.start()
  assert.deepEqual(request.states, [true])
  request.loading.finish()
  assert.deepEqual(request.states, [true, false])
})

test('a superseded request cannot change the next request’s loading state', () => {
  const request = fixture()
  request.loading.cancel()
  request.start()
  request.loading.finish()
  assert.deepEqual(request.states, [])
  assert.equal(request.cancelled(), 1)
})
