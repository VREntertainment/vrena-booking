import { expect, test, type Page } from '@playwright/test'

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
      const cafe = venueSelector.getByRole('radio').filter({ hasText: 'Café des Stagiaires' })

      await expect(page.locator(route.activeSurface)).toBeVisible()
      await cafe.click()

      await expect(cafe).toHaveAttribute('aria-checked', 'true')
      await expect(page.locator(route.activeSurface)).toHaveCount(0)
      await expect(page.locator('.booking-venue-coming-soon')).toContainText('Community sessions are not available yet')
      await expect(page.getByRole('button', { name: 'Book at Hà Đô Centrosa' })).toHaveCount(0)
      await expectContainedLayout(page)
    })
  }

  test('Cafe tickets stay bookable and explain Zalo-only confirmation in the right panel', async ({ page }) => {
    await keepConsentOutOfTheBookingFlow(page)
    await page.goto('/tickets')

    const venueSelector = page.locator('.booking-venue-selector')
    const cafe = venueSelector.getByRole('radio').filter({ hasText: 'Café des Stagiaires' })

    await cafe.click()

    await expect(cafe).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('.ticket-form-panel')).toBeVisible()
    await expect(page.locator('.cafe-booking-notice')).toBeVisible()
    await expect(page.locator('.cafe-booking-notice')).toContainText('Your booking is confirmed only after the team replies on Zalo or WhatsApp.')
    await expect(page.locator('.cafe-booking-notice')).toContainText('Daily 16:00–00:00')
    const zaloLink = page.locator('.cafe-booking-notice').getByRole('link', { name: /Zalo/ })
    const whatsappLink = page.locator('.cafe-booking-notice').getByRole('link', { name: /WhatsApp/ })
    await expect(zaloLink).toHaveAttribute('href', 'https://zalo.me/84981152315')
    await expect(zaloLink.locator('img')).toHaveCount(1)
    await expect(whatsappLink).toHaveAttribute('href', 'https://wa.me/84981152315')
    await expect(whatsappLink.locator('img')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Send booking request' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Book at Hà Đô Centrosa' })).toHaveCount(0)
    await expect(page.locator('#ticket-available-time option')).toHaveCount(25)
    if (test.info().project.name === 'chromium') {
      const noticeHeight = await page.locator('.cafe-booking-notice').evaluate((element) => element.getBoundingClientRect().height)
      expect(noticeHeight).toBeLessThan(620)
    }
    await expectContainedLayout(page)
  })
})
