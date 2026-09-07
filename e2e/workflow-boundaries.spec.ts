import { expect, test } from '@playwright/test'
import { gzipSync } from 'node:zlib'
import { futureDate, loginAsAdmin, openAdmin } from './support/admin'

test('staff draft survives switching independently loaded workflows', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loginAsAdmin(page)
  await openAdmin(page)
  const tabs = page.getByRole('tablist', { name: 'Staff Console', exact: true })
  await tabs.getByRole('tab', { name: 'New Booking', exact: true }).click()
  const draftDate = futureDate(4)
  await page.locator('#staff-booking-customer-name').fill('Unsaved workflow draft')
  await page.locator('.staff-console input[type="date"]').first().fill(draftDate)
  for (const name of ['Today', 'Orders', 'Report']) {
    await tabs.getByRole('tab', { name, exact: true }).click()
    await expect(tabs.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.staff-console')).not.toContainText('Loading VRena')
  }
  await tabs.getByRole('tab', { name: 'New Booking', exact: true }).click()
  await expect(page.locator('#staff-booking-customer-name')).toHaveValue('Unsaved workflow draft')
  await expect(page.locator('.staff-console input[type="date"]').first()).toHaveValue(draftDate)
  expect(errors).toEqual([])
})

test('HR feature sections render independently and remain contained', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loginAsAdmin(page)
  await page.goto('/hr')
  await expect(page.getByTestId('staff-console')).toBeVisible()
  const sections = [
    ['Employee profile', '.staff-hr-employee-layout'],
    ['Calendar', '.staff-hr-schedule-stack'],
    ['Timesheet', '.staff-hr-timesheet-toolbar'],
    ['Payroll', '.staff-hr-accountant-workspace'],
    ['Bonuses', '.staff-attendance-form'],
    ['Debts & advances', '.staff-attendance-form'],
    ['Zalo Mini App', '.staff-zalo-settings'],
    ['HR settings', '.staff-hr-settings-shell'],
  ]
  for (const [name, selector] of sections) {
    const tab = page.locator('.staff-hr-module-rail').getByRole('button', { name: new RegExp(`^${name} `) })
    await tab.click()
    await expect(tab).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.staff-hr-content').locator(selector)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: `/tmp/vrena-workflows-hr-${testInfo.project.name}.png` })
  expect(errors).toEqual([])
})

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
    expect(totals.js).toBeGreaterThan(100_000)
    expect(totals.css).toBeGreaterThan(0)
    if (process.env.E2E_PRODUCTION_BUILD === '1') {
      // Gzip-equivalent JS budgets stay below the pre-refactor 588/622 KB measurements.
      expect(totals.gzipJs).toBeLessThan(route === '/staff' ? 570_000 : 595_000)
    }
    console.log('WORKFLOW_DOWNLOADS', JSON.stringify({ route, ...totals }))
  }
})
