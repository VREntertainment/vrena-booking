import { expect, test } from '@playwright/test'
import { accountFixture } from './support/accountFixture'

for (const route of ['/sessions', '/hall-of-fame', '/clubs']) {
  test(`paused social route ${route} leads directly to booking at the selected venue`, async ({ page }) => {
    await accountFixture(page, '+84900000991', false)
    await page.goto(`${route}?venue=cafe-des-stagiaires`)
    await expect(page).toHaveURL(/tickets\?venue=cafe-des-stagiaires/)
    await expect(page.getByRole('button', { name: 'Reserve your slot', exact: true })).toBeVisible()
    await expect(page.locator('.booking-focused-tabs a')).toHaveText(['Book now', 'My account'])
    await expect(page.locator('.sessions-section, .clubs-section, .leaderboard-section, .app-share')).toHaveCount(0)
  })
}

test('account keeps history, loyalty and consent controls without social distractions', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await accountFixture(page, '+84900000991')
  // Even outdated published marketing copy must not advertise paused features.
  await page.route('**/api/content-studio/published-copy?*', route => route.fulfill({ json: { copy: { tagline: 'Join clubs and challenge friends', authWelcomeBody: 'Join the Hall of Fame' } } }))
  await page.goto('/profile')
  await expect(page.locator('.account-bookings')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Achievements', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Loyalty', exact: true }).click()
  await expect(page.locator('.profile-sub-tabs .active')).toHaveText('Loyalty')
  await expect(page.locator('.account-loyalty-balance')).toHaveText('1,250')
  await expect(page.locator('.account-loyalty')).toContainText('after payment is confirmed')
  await page.screenshot({ path: `/tmp/booking-focused-loyalty-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.locator('#profile-phone-input')).toBeVisible()
  await expect(page.locator('.profile-consent-panel')).toBeVisible()
  const consent = page.locator('.profile-consent-panel input[type="checkbox"]').first()
  await expect(consent).not.toBeChecked()
  await consent.check()
  await expect(consent).toBeChecked()
  await consent.uncheck()
  await expect(consent).not.toBeChecked()
  await expect(page.locator('.profile-photo-panel, .nickname-field, .motto-field, .gender-field, .profile-completion-card, .driver-popover')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete my account', exact: true })).toBeVisible()
  await page.screenshot({ path: `/tmp/booking-focused-settings-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' })
  await page.locator('.account-booking-heading').getByRole('button', { name: 'Book now' }).click()
  await expect(page.getByRole('button', { name: 'Reserve your slot', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await expect(page).toHaveTitle(/VRena/)
  expect(errors).toEqual([])
})

test('an old saved community view cannot reopen social features', async ({ page }) => {
  await accountFixture(page, '+84900000991', false)
  await page.addInitScript(() => localStorage.setItem('vrena.booking.activeView', 'clubs'))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Reserve your slot', exact: true })).toBeVisible()
  await expect(page.locator('.booking-focused-tabs')).toHaveText(/Book now.*My account/)
  await page.screenshot({ path: `/tmp/booking-focused-checkout-${test.info().project.name}.png`, fullPage: true, animations: 'disabled' })
})
