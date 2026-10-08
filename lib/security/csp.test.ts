import assert from 'node:assert/strict'
import test from 'node:test'
import { buildContentSecurityPolicy } from './csp.ts'

function sources(policy: string, directive: string) {
  return policy.split('; ').find((part) => part.startsWith(`${directive} `))?.split(' ').slice(1) || []
}

test('public booking policy permits the GA script and regional collection endpoints', () => {
  const policy = buildContentSecurityPolicy({ isDev: false, allowGoogleAnalytics: true })
  assert.ok(sources(policy, 'script-src').includes('https://www.googletagmanager.com'))
  assert.ok(sources(policy, 'connect-src').includes('https://*.google-analytics.com'))
  assert.ok(sources(policy, 'connect-src').includes('https://www.google-analytics.com'))
  assert.ok(sources(policy, 'img-src').includes('https://*.google-analytics.com'))
  for (const directive of ['script-src', 'connect-src', 'img-src']) {
    assert.ok(!sources(policy, directive).includes('*'))
    assert.ok(!sources(policy, directive).includes('https:'))
  }
  assert.ok(policy.includes("object-src 'none'"))
  assert.ok(!policy.includes("'unsafe-eval'"))
})

test('staff nonce policy remains strict and does not opt into analytics endpoints', () => {
  const policy = buildContentSecurityPolicy({ isDev: false, nonce: 'test-nonce' })
  assert.ok(policy.includes("'nonce-test-nonce' 'strict-dynamic'"))
  assert.ok(!policy.includes('googletagmanager.com'))
  assert.ok(!policy.includes('google-analytics.com'))
  assert.ok(!policy.includes("'unsafe-inline' https://"))
})
