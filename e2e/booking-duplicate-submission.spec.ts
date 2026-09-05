import { expect, test } from '@playwright/test'
import { chooseCafeVenue } from './support/admin'

for (const venue of ['ha-do-centrosa', 'cafe-des-stagiaires'] as const) {
  test(`${venue}: repeated guest clicks send one booking and recover after a failed check`, async ({ page }) => {
    let rateChecks = 0
    let bookingRequests = 0
    let failNextCheck = true
    const appUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
    await page.context().addCookies([{ name: 'vrena-cookie-consent', value: 'essential', url: appUrl }])
    // Intercept all booking writes: this regression never creates a real reservation.
    await page.route('**/rest/v1/rpc/create_*', async (route) => {
      bookingRequests += 1
      await route.fulfill({ json: { session_id: '00000000-0000-4000-8000-000000000993', ticket_reference: 'QA-SINGLE-BOOKING', ticket_total_price: 440000 } })
    })
    await page.route('**/rest/v1/rpc/consume_booking_attempt_rate_limit', async (route) => {
      rateChecks += 1
      await new Promise((resolve) => setTimeout(resolve, 600))
      if (failNextCheck) {
        failNextCheck = false
        await route.fulfill({ status: 429, json: { message: 'QA temporary booking check failure' } })
      } else {
        await route.fulfill({ json: { allowed: true } })
      }
    })
    await page.goto('/tickets')
    if (venue === 'cafe-des-stagiaires') {
      await chooseCafeVenue(page)
    }
    await page.locator('.ticket-control-date input[type="date"]').fill(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
    await page.locator('#ticket-available-time').selectOption(venue === 'cafe-des-stagiaires' ? '17:00' : '12:00')
    await page.getByRole('button', { name: venue === 'cafe-des-stagiaires' ? 'Send booking request' : 'Reserve your slot', exact: true }).click()
    await page.getByPlaceholder('0981152315').fill('0900000993')
    await page.getByRole('button', { name: 'Book without an account', exact: true }).click()
    const confirm = page.getByRole('button', { name: 'Continue as guest', exact: true })
    await confirm.dblclick()
    await expect(page.getByRole('dialog').getByText('QA temporary booking check failure', { exact: true })).toBeVisible()
    expect(rateChecks).toBe(1)
    expect(bookingRequests).toBe(0)
    await expect(confirm).toBeEnabled()
    await confirm.dblclick()
    await expect(page.getByText('QA-SINGLE-BOOKING', { exact: true })).toBeVisible()
    expect(rateChecks).toBe(2)
    expect(bookingRequests).toBe(1)
    await expect(page.locator('.guest-ticket-modal')).toHaveCount(0)
    await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
    await page.screenshot({ path: `/tmp/booking-dedupe-${venue}-${test.info().project.name}.png` })
  })
}
