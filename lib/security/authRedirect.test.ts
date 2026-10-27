import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTrustedAppRedirect } from './authRedirect.ts'

test('auth redirects stay on the configured origin after URL normalization', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_SITE_URL = 'https://booking.vre-vietnam.com'
  try {
    for (const candidate of ['/\\evil.example/reset', '//evil.example', '/\t/evil.example', 'https://evil.example', 'https://user@booking.vre-vietnam.com/']) {
      assert.equal(resolveTrustedAppRedirect(candidate).ok, false, candidate)
    }
    for (const candidate of ['/login?next=home#reset', 'https://booking.vre-vietnam.com//login', '']) {
      const result = resolveTrustedAppRedirect(candidate)
      assert.equal(result.ok, true)
      if (result.ok) assert.equal(new URL(result.url).origin, 'https://booking.vre-vietnam.com')
    }
    assert.equal(resolveTrustedAppRedirect('', '//evil.example').ok, false)
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = previous
  }
})
