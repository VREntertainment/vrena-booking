import { expect, test, type Page } from '@playwright/test'
import { chooseCafeVenue, futureDate } from './support/admin'

async function expectContainedLayout(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )

  expect(hasHorizontalOverflow).toBe(false)
  await expect(page.locator('[data-nextjs-dialog], #webpack-dev-server-client-overlay')).toHaveCount(0)
}

async function keepConsentOutOfTheBookingFlow(page: Page) {
  await page.context().addCookies([{
    name: 'vrena-cookie-consent',
    value: 'essential',
    url: process.env.E2E_BASE_URL || 'http://127.0.0.1:3000',
  }])
}

test.describe('booking venue selection', () => {
  for (const route of [
    { path: '/sessions', activeSurface: '.sessions-section' },
    { path: '/create-session', activeSurface: '.create-session-section' },
  ] as const) {
    test(`${route.path} keeps Cafe community flows closed without redirecting to Ha Do`, async ({ page }) => {
      await keepConsentOutOfTheBookingFlow(page)
      await page.goto(route.path)

      const venueSelector = page.locator('.booking-venue-selector')

      await expect(page.locator(route.activeSurface)).toBeVisible()
      await chooseCafeVenue(page)

      await expect(venueSelector).toContainText('Vrena Thao Dien')
      await expect(page.locator(route.activeSurface)).toHaveCount(0)
      await expect(page.locator('.booking-venue-coming-soon')).toContainText('Community sessions are not available yet')
      await expect(page.getByRole('button', { name: 'Book at Hà Đô Centrosa' })).toHaveCount(0)
      await expectContainedLayout(page)
    })
  }

  test('Cafe tickets stay bookable without the removed soft-opening notices', async ({ page }) => {
    await keepConsentOutOfTheBookingFlow(page)
    await page.goto('/tickets')

    const venueSelector = page.locator('.booking-venue-selector')

    await chooseCafeVenue(page)

    await expect(venueSelector).toContainText('Vrena Thao Dien')
    await expect(page.locator('.ticket-form-panel')).toBeVisible()
    await expect(page.locator('.cafe-booking-notice')).toHaveCount(0)
    await expect(page.locator('.ticket-confirmation-requirement')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Send booking request' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Book at Hà Đô Centrosa' })).toHaveCount(0)
    await page.locator('.ticket-control-date input[type="date"]').fill(futureDate())
    await expect(page.locator('#ticket-available-time option')).toHaveCount(42)
    for (const eventIndex of [0, 1]) {
      await page.locator('.ticket-service-card').nth(eventIndex).click()
      await expect(page.locator('#ticket-player-count option').last()).toHaveAttribute('value', '16')
      await expect(page.locator('#ticket-player-count option[value="17"]')).toHaveCount(0)
      await expect(page.locator('#ticket-arena-count')).toHaveValue('1')
      await expect(page.locator('#ticket-arena-count')).toBeDisabled()
    }
    await expectContainedLayout(page)
  })
})
