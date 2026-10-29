import { expect, test } from '@playwright/test'
import { futureDate, loginAsAdmin } from './support/admin'

test('staff styles load when opening a booking from the public calendar', async ({ page }, info) => {
  await loginAsAdmin(page)
  await page.goto(`/create-session?mode=calendar&date=${futureDate(15)}&venue=ha-do-centrosa`)
  await expect(page.locator('.calendar-panel')).toHaveAttribute('aria-busy', 'false')
  await page.locator('.calendar-slot:not(:disabled)').first().click()
  await expect(page.getByTestId('staff-console')).toBeVisible()
  await expect(page.locator('.staff-tabs')).toHaveCSS('display', 'flex')
  await expect(page.locator('.staff-tabs-shell')).toHaveCSS('display', 'grid')
  const nav = await page.locator('.staff-console-nav').boundingBox()
  expect(nav!.height).toBeLessThan(120)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.locator('.staff-console-nav').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `/tmp/vrena-staff-mobile-fix-${info.project.name}.png`, animations: 'disabled' })
})

test('every public booking view uses the same compact mobile venue selector', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium', 'Mobile selector contract.')
  for (const path of ['/tickets', '/sessions', '/create-session']) {
    await page.goto(path)
    const selector = page.locator('.booking-venue-selector')
    await expect(selector.locator('.booking-venue-mobile-summary')).toBeVisible()
    await expect(selector.locator('.booking-venue-expanded-content')).toBeHidden()
    await expect(selector.locator('.booking-venue-heading > span, .booking-venue-heading > p')).toHaveCount(0)
    await selector.getByRole('button', { name: /change/i }).click()
    await expect(selector.getByRole('radio').first()).toBeVisible()
  }
})

test('ticket experience selector is compact and excludes price and removed age copy', async ({ page }) => {
  await page.route('**/rest/v1/rpc/booking_arena_occupancy', route => route.fulfill({ json: [] }))
  await page.context().addCookies([{ name: 'vrena-cookie-consent', value: 'essential', url: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000' }])
  await page.goto('/tickets')
  const picker = page.locator('.sim-racing-product-picker')
  await expect(picker.getByRole('button')).toHaveText(['VR', 'SIM Racing'])
  const bounds = await picker.boundingBox()
  expect(bounds!.height).toBeLessThan(64)
  const help = page.locator('.ticket-duration-information')
  await expect(help.locator('.ticket-help-content')).toBeHidden()
  await help.locator('summary').click()
  await expect(help.locator('.field-help').first()).toBeVisible()
  await expect(help).toContainText('30-minute blocks')
  await picker.getByRole('button', { name: 'SIM Racing', exact: true }).click()
  await expect(picker.getByRole('button', { name: 'SIM Racing', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await picker.getByRole('button', { name: 'VR', exact: true }).click()
  await expect(picker.getByRole('button', { name: 'VR', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('mobile clubs use inline search without a floating overlay', async ({ page }, info) => {
  test.skip(info.project.name === 'chromium', 'Mobile toolbar contract.')
  await page.goto('/clubs')
  await expect(page.locator('.clubs-section .search-shell .search')).toBeVisible()
  await expect(page.locator('.clubs-section .mobile-search-toggle')).toBeHidden()
  await expect(page.locator('.clubs-section .search-shell')).toHaveCSS('position', 'relative')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
