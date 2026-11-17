import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('install manifests use existing routes and correctly sized brand icons', () => {
  for (const file of ['manifest.webmanifest', 'staff.webmanifest']) {
    const manifest = JSON.parse(readFileSync(new URL('../public/' + file, import.meta.url), 'utf8'))
    assert.equal(manifest.display, 'standalone')
    assert.equal(manifest.scope, '/')
    assert.equal(manifest.prefer_related_applications, false)
    assert.deepEqual(manifest.icons.map((icon: { sizes: string }) => icon.sizes), ['192x192', '512x512'])
    for (const icon of manifest.icons) {
      const png = readFileSync(new URL('../public' + icon.src, import.meta.url))
      const size = Number(icon.sizes.split('x')[0])
      assert.equal(png.readUInt32BE(16), size)
      assert.equal(png.readUInt32BE(20), size)
    }
    assert.equal(manifest.start_url, file === 'staff.webmanifest' ? '/staff' : '/tickets')
  }
  const staff = JSON.parse(readFileSync(new URL('../public/staff.webmanifest', import.meta.url), 'utf8'))
  assert.equal(staff.id, '/staff-app')
  assert.deepEqual(staff.shortcuts.map((item: { url: string }) => item.url), ['/staff', '/create-session?mode=calendar'])
})

test('installation adds no offline interception or booking queue to the notification worker', () => {
  const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(worker, /addEventListener\('push'/)
  assert.match(worker, /addEventListener\('notificationclick'/)
  assert.doesNotMatch(worker, /addEventListener\(['"](?:fetch|sync|periodicsync)['"]|caches\.|indexedDB/)
})
