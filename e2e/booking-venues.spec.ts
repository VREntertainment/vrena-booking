import { expect, test, type Page } from '@playwright/test'

const BOOKING_ROUTES = [
  { path: '/sessions', activeSurface: '.sessions-section' },
  { path: '/create-session', activeSurface: '.create-session-section' },
  { path: '/tickets', activeSurface: '.ticket-form-panel' },
] as const

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
  for (const route of BOOKING_ROUTES) {
    test(`${route.path} keeps Ha Do bookable and Cafe gated as coming soon`, async ({ page }) => {
      await keepConsentOutOfTheBookingFlow(page)
      await page.goto(route.path)

      const venueSelector = page.locator('.booking-venue-selector')
      const haDo = venueSelector.getByRole('radio').filter({ hasText: 'Hà Đô Centrosa' })
      const cafe = venueSelector.getByRole('radio').filter({ hasText: 'Café des Stagiaires' })

      await expect(venueSelector).toBeVisible()
      await expect(venueSelector.getByRole('radio')).toHaveCount(2)
      await expect(haDo).toHaveAttribute('aria-checked', 'true')
      await expect(page.locator(route.activeSurface)).toBeVisible()
      await expectContainedLayout(page)

      await cafe.click()

      await expect(cafe).toHaveAttribute('aria-checked', 'true')
      await expect(page.locator(route.activeSurface)).toHaveCount(0)
      await expect(page.locator('.booking-venue-coming-soon')).toContainText('Café des Stagiaires')
      await expect(page.locator('.booking-venue-coming-soon')).toContainText('Sessions and tickets are not open yet.')
      await expectContainedLayout(page)

      await page.getByRole('button', { name: 'Book at Hà Đô Centrosa' }).click()

      await expect(haDo).toHaveAttribute('aria-checked', 'true')
      await expect(page.locator(route.activeSurface)).toBeVisible()
      await expectContainedLayout(page)
    })
  }
})
