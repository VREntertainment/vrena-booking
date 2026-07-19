import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedWebPushEndpoint } from './webPushEndpoint.ts'

test('allows recognized browser Web Push services', () => {
  assert.equal(isAllowedWebPushEndpoint('https://web.push.apple.com/QPUSH-TOKEN'), true)
  assert.equal(isAllowedWebPushEndpoint('https://fcm.googleapis.com/fcm/send/TOKEN'), true)
  assert.equal(isAllowedWebPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/TOKEN'), true)
  assert.equal(isAllowedWebPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=TOKEN'), true)
})

test('rejects arbitrary or ambiguous HTTPS destinations', () => {
  assert.equal(isAllowedWebPushEndpoint('https://example.com/push'), false)
  assert.equal(isAllowedWebPushEndpoint('https://127.0.0.1/push'), false)
  assert.equal(isAllowedWebPushEndpoint('https://169.254.169.254/latest/meta-data'), false)
  assert.equal(isAllowedWebPushEndpoint('https://web.push.apple.com.evil.example/push'), false)
  assert.equal(isAllowedWebPushEndpoint('https://web.push.apple.com@evil.example/push'), false)
  assert.equal(isAllowedWebPushEndpoint('https://web.push.apple.com:8443/push'), false)
  assert.equal(isAllowedWebPushEndpoint('http://web.push.apple.com/push'), false)
  assert.equal(isAllowedWebPushEndpoint('not-a-url'), false)
})
