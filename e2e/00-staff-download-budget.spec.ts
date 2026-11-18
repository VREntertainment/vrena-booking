import { expect, test } from '@playwright/test'
import { gzipSync } from 'node:zlib'
import { loginAsAdmin } from './support/admin'

test('staff and HR initial downloads stay within production budgets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Download measurements use one fixed desktop browser.')
  await loginAsAdmin(page)
  for (const route of ['/staff', '/hr']) {
    const assets = new Map<string, { type: string; bytes: number; gzip: number }>()
    const pending: Promise<void>[] = []
    const onResponse = (response: import('@playwright/test').Response) => {
      const type = response.request().resourceType()
      if (!['script', 'stylesheet'].includes(type) || !response.url().includes('/_next/static/')) return
      pending.push(response.body().then((body) => { assets.set(new URL(response.url()).pathname, { type, bytes: body.length, gzip: gzipSync(body).length }) }).catch(() => {}))
    }
    page.on('response', onResponse)
    await page.goto(route)
    await expect(page.getByTestId('staff-console')).toBeVisible()
    await expect(page.getByRole('heading', { name: route === '/staff' ? 'New booking' : 'Employee profiles', exact: true })).toBeVisible()
    // Bound the measurement to the first settled screen, including its deferred view.
    await page.waitForTimeout(1500)
    await Promise.all(pending)
    page.off('response', onResponse)
    const totals = [...assets.values()].reduce((out, asset) => {
      if (asset.type === 'script') { out.js += asset.bytes; out.gzipJs += asset.gzip }
      else { out.css += asset.bytes; out.gzipCss += asset.gzip }
      return out
    }, { js: 0, css: 0, gzipJs: 0, gzipCss: 0 })
    await testInfo.attach(`downloads-${route.slice(1)}`, { body: JSON.stringify({ route, ...totals, assets: Object.fromEntries(assets) }, null, 2), contentType: 'application/json' })
    console.log('WORKFLOW_DOWNLOADS', JSON.stringify({ route, ...totals }))
    expect(totals.js).toBeGreaterThan(100_000)
    expect(totals.css).toBeGreaterThan(0)
    if (process.env.E2E_PRODUCTION_BUILD === '1') {
      // Full country phone validation adds ~21 KB gzip with compact generated patterns.
      // Keep initial JS bounded below the documented pre-refactor 588/622 KB sizes.
      expect(totals.gzipJs).toBeLessThan(route === '/staff' ? 588_000 : 622_000)
    }
  }
})
