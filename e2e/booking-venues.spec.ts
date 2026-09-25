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
    await expect(page.locator('#ticket-available-time option')).toHaveCount(44)
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


test('Thao Dien calendar offers continuous booking starts across all seven days', async ({ page }) => {
  await keepConsentOutOfTheBookingFlow(page)
  await page.goto(`/create-session?mode=calendar&date=${futureDate(30)}&venue=cafe-des-stagiaires`)
  const calendar = page.locator('.calendar-panel')
  await expect(calendar).toHaveAttribute('aria-busy', 'false')
  await expect(calendar.locator('.calendar-opening-hours')).toHaveText('15:30–23:00')
  const days = calendar.locator('.calendar-day-column')
  await expect(days).toHaveCount(7)
  for (let day = 0; day < 7; day++) {
    const slots = days.nth(day).locator('.calendar-slot')
    await expect(slots).toHaveCount(45)
    await expect(slots.nth(0)).toBeEnabled()
    await expect(slots.nth(1)).toBeEnabled()
    await expect(slots.nth(40)).toBeEnabled()
    await expect(slots.nth(42)).toBeEnabled()
    await expect(slots.nth(43)).toBeDisabled()
  }
  await days.nth(0).locator('.calendar-slot').nth(1).click()
  await expect(page.locator('#ticket-available-time')).toHaveValue('15:40')
  await expectContainedLayout(page)
})

test('booking venue selection: arena choice persists and recommendations follow the group', async ({ page }) => {
  await keepConsentOutOfTheBookingFlow(page)
  await page.goto('/tickets')
  await page.locator('.ticket-control-date input[type="date"]').fill(futureDate(40))
  const arenas = page.locator('#ticket-arena-count')
  const players = page.locator('#ticket-player-count')
  await players.selectOption('2')
  await arenas.selectOption('2')
  await expect(arenas).toHaveValue('2')
  await expect(page.locator('#ticket-arena-recommendation')).toContainText('1 arena is enough')
  await players.selectOption('8')
  await expect(arenas).toHaveValue('2')
  await expect(page.locator('#ticket-arena-recommendation')).toContainText('together across 2 arenas')
  await arenas.selectOption('1')
  await players.selectOption('9')
  await expect(arenas).toHaveValue('1')
  await expect(page.locator('#ticket-arena-recommendation')).toContainText('Choose 2 to reduce waiting')
  await expect(page.locator('.ticket-price-summary')).toContainText('60 min')
  await expect(page.locator('.ticket-price-summary')).toContainText('per VR headset / 30 min')
  await expect(page.locator('.ticket-price-summary .ticket-average-player-price')).toContainText('Average per player:')
  await page.setViewportSize({ width: 375, height: 667 })
  await expectContainedLayout(page)
  await page.locator('#ticket-arena-count').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ticket-arena-choice-mobile.png', animations: 'disabled' })
})
