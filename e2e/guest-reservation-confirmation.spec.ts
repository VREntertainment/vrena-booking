import { expect, test } from '@playwright/test'
import { accountFixture } from './support/accountFixture'
import { futureDate } from './support/admin'

for (const venue of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
  test(`${venue}: account creation and closing confirmation never submit a reservation`, async ({ page }) => {
    await accountFixture(page, '', false)
    let writes = 0
    await page.route('**/api/bookings/tickets', async route => {
      writes++
      await route.fulfill({ status: 400, json: { error: { message: 'Unexpected submission' } } })
    })
    await page.goto(`/tickets?venue=${venue}&lang=en`)
    await page.locator('.ticket-control-date input').fill(futureDate(42))
    await page.locator('#ticket-available-time').selectOption(venue === 'ha-do-centrosa' ? '12:00' : '17:10')
    await page.locator('#ticket-player-count').selectOption('2')
    await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Confirm reservation', exact: true })
    await expect(dialog).toContainText('2 players')
    await expect(dialog.locator('#guest-booking-email')).toHaveAttribute('required', '')
    await dialog.getByRole('button', { name: 'Confirm reservation', exact: true }).click()
    expect(writes).toBe(0)
    await dialog.locator('#guest-booking-phone').fill('0981152315')
    await dialog.locator('#guest-booking-email').fill('guest@example.org')
    await dialog.getByRole('button', { name: 'Confirm reservation', exact: true }).click()
    await expect(dialog).toContainText('personal phone number')
    expect(writes).toBe(0)
    await dialog.locator('#guest-booking-phone').fill('098115235')
    await dialog.getByRole('button', { name: 'Confirm reservation', exact: true }).click()
    await expect(dialog).toContainText('valid phone number')
    expect(writes).toBe(0)
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes).toBe(0)
    await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
    await dialog.getByRole('button', { name: 'Create free account', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes).toBe(0)
    await page.goto(`/tickets?venue=${venue}&lang=en`)
    await expect(page.locator('#ticket-player-count')).toBeVisible()
    await expect(page.locator('.ticket-confirmation')).toHaveCount(0)
    expect(writes).toBe(0)
  })
}
