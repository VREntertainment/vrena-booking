import { expect, test } from '@playwright/test'
import { futureDate, stubHCaptcha } from './support/admin'

import { accountFixture } from './support/accountFixture'

for (const venue of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
  for (const phone of ['', '+84900000991']) {
    test(`${venue}: signed-in ${phone ? 'complete' : 'phone-optional'} account books and finds reservation`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      const requests = await accountFixture(page, phone)
      await page.goto(`/tickets?venue=${venue}`)
      await expect(page.locator('.profile-chip')).toContainText('Tester')
      // Dismiss the first-login walkthrough when present.
      const welcome = page.getByRole('dialog', { name: /Welcome to VRena/ })
      if (await welcome.isVisible()) await welcome.getByRole('button', { name: 'Close', exact: true }).click()
      await page.locator('.ticket-control-date input').fill(futureDate(40))
      await page.locator('#ticket-available-time').selectOption(venue === 'ha-do-centrosa' ? '12:00' : '17:10')
      await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
      if (!phone) {
        await expect(page.getByRole('dialog', { name: 'Add your phone number' })).toBeVisible()
        await expect(page.getByRole('textbox', { name: 'Phone Number', exact: true })).toBeFocused()
        await page.locator('#booking-account-phone').fill('900000991')
        await page.screenshot({ path: `/tmp/booking-phone-dialog-${venue}-${test.info().project.name}.png` })
        await page.getByRole('button', { name: 'Save & confirm booking', exact: true }).click()
      }
      await expect(page.locator('.ticket-confirmation')).toContainText('QA-ACCOUNT-991')
      expect(requests).toHaveLength(1)
      expect(requests[0].name).toBe(venue === 'ha-do-centrosa' ? 'create_ticket_booking' : 'create_cafe_ticket_booking_request')
      await page.locator('.profile-chip').click()
      await expect(page.getByRole('button', { name: 'My Bookings', exact: true })).toBeVisible()
      await expect(page.locator('.account-bookings')).toContainText('QA-ACCOUNT-991')
      await expect(page.locator('.account-bookings')).toContainText(venue === 'ha-do-centrosa' ? 'Hà Đô Centrosa' : 'Thảo Điền')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      await expect(page).toHaveTitle(/VRena/i)
      await page.screenshot({ path: `/tmp/account-bookings-${venue}-${phone ? 'complete' : 'phone'}-${test.info().project.name}.png`, fullPage: true })
      await page.reload()
      await expect(page.locator('.account-bookings')).toContainText('QA-ACCOUNT-991')
      await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }
}

for (const passwordLogin of [false, true]) {
  test(`saved checkout resumes after ${passwordLogin ? 'password login' : 'OAuth return'} without replaying a booking`, async ({ page }) => {
    const requests = await accountFixture(page, '+84900000991', !passwordLogin)
    await stubHCaptcha(page)
    const date = futureDate(40)
    await page.addInitScript(({ date }) => {
      sessionStorage.setItem('vrena.ticket.pending-account-booking.v1', JSON.stringify({
        authMode: 'login', createdAt: Date.now(), venue: 'cafe-des-stagiaires', arenaCount: 1,
        ticketType: 'individual', date, time: '17:10', players: 3, duration: 30, specialNote: '',
      }))
    }, { date })
    await page.goto('/profile')
    if (passwordLogin) {
      await page.locator('.login-profile-form .email-field input').fill('booking-regression@vrena.local')
      await page.locator('.login-profile-form .email-field input').press('Enter')
      await page.locator('.login-profile-form input[type="password"]').fill('fixture-password')
      await expect(page.locator('body')).toHaveAttribute('data-e2e-captcha-ready', 'true')
      await page.locator('.profile-auth-section .action-row button.primary').click()
    }
    await expect(page).toHaveURL(/tickets.*venue=cafe-des-stagiaires/)
    await expect(page.locator('#ticket-available-time')).toHaveValue('17:10')
    await expect(page.locator('#ticket-player-count')).toHaveValue('3')
    expect(requests).toHaveLength(0)
    await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
    await expect(page.locator('.ticket-confirmation')).toContainText('QA-ACCOUNT-991')
    expect(requests).toHaveLength(1)
    expect(await page.evaluate(() => sessionStorage.getItem('vrena.ticket.pending-account-booking.v1'))).toBeNull()
  })
}

test('invalid or rejected account phone stays in checkout with the selected venue and time', async ({ page }) => {
  const requests = await accountFixture(page, '')
  await page.route('**/rest/v1/profiles?**', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    return route.fulfill({ status: 409, json: { message: 'This phone cannot be saved.' } })
  })
  await page.goto('/tickets?venue=cafe-des-stagiaires')
  await expect(page.locator('.profile-chip')).toContainText('Tester')
  await page.locator('.ticket-control-date input').fill(futureDate(40))
  await page.locator('#ticket-available-time').selectOption('17:10')
  await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
  await page.locator('#booking-account-phone').fill('123')
  await page.getByRole('button', { name: 'Save & confirm booking', exact: true }).click()
  await expect(page.locator('.tickets-section')).toContainText('Enter a valid phone number.')
  await page.locator('#booking-account-phone').fill('900000991')
  await page.getByRole('button', { name: 'Save & confirm booking', exact: true }).click()
  await expect(page.locator('.tickets-section')).toContainText('This phone cannot be saved.')
  await expect(page).toHaveURL(/tickets.*venue=cafe-des-stagiaires/)
  await expect(page.locator('#ticket-available-time')).toHaveValue('17:10')
  expect(requests).toHaveLength(0)
})

test('closing the required phone dialog preserves the booking and does not submit', async ({ page }) => {
  const requests = await accountFixture(page, '')
  await page.goto('/tickets')
  await expect(page.locator('.profile-chip')).toContainText('Tester')
  await page.locator('.ticket-control-date input').fill(futureDate(40))
  await page.locator('#ticket-available-time').selectOption('12:00')
  await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Save & confirm booking', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Phone number is required.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('#ticket-available-time')).toHaveValue('12:00')
  expect(requests).toHaveLength(0)
})

test('a server-rejected reservation retains the selection and can be retried explicitly', async ({ page }) => {
  const requests = await accountFixture(page, '+84900000991')
  let reject = true
  await page.route('**/api/bookings/tickets', async route => {
    if (!reject) return route.fallback()
    reject = false
    await route.fulfill({ status: 409, json: { data: null, error: { message: 'This slot is no longer available. Please choose another time.' } } })
  })
  await page.goto('/tickets?venue=cafe-des-stagiaires')
  await expect(page.locator('.profile-chip')).toContainText('Tester')
  await page.locator('.ticket-control-date input').fill(futureDate(40))
  await page.locator('#ticket-available-time').selectOption('17:10')
  await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
  await expect(page.locator('.ticket-status-error')).toContainText('no longer available')
  await expect(page.locator('.ticket-confirmation')).toHaveCount(0)
  await expect(page.locator('#ticket-available-time')).toHaveValue('17:10')
  expect(requests).toHaveLength(0)
  await page.locator('#ticket-available-time').selectOption('17:20')
  await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
  await expect(page.locator('.ticket-confirmation')).toContainText('QA-ACCOUNT-991')
  expect(requests).toHaveLength(1)
})

test('My Bookings includes this account’s history from both venues together', async ({ page }) => {
  await accountFixture(page, '+84900000991')
  await page.route('**/rest/v1/sessions?**', async route => {
    if (!new URL(route.request().url()).searchParams.has('or')) return route.fallback()
    await route.fulfill({ json: [
      { id: '00000000-0000-4000-8000-000000000995', ticket_reference: 'QA-HA-DO', name: 'Booking', venue_key: 'ha-do-centrosa', date: futureDate(40), start_time: '12:00', duration_minutes: 30, max_players: 2, status: 'open', ticket_status: 'confirmed' },
      { id: '00000000-0000-4000-8000-000000000996', ticket_reference: 'QA-THAO-DIEN', name: 'Booking', venue_key: 'cafe-des-stagiaires', date: '2025-01-01', start_time: '17:10', duration_minutes: 30, max_players: 3, status: 'closed', ticket_status: 'confirmed' },
    ] })
  })
  await page.goto('/profile')
  await expect(page.locator('.account-bookings')).toContainText('QA-HA-DO')
  await expect(page.locator('.account-bookings')).toContainText('QA-THAO-DIEN')
  await expect(page.locator('.account-bookings')).toContainText('Hà Đô Centrosa')
  await expect(page.locator('.account-bookings')).toContainText('Thảo Điền')
})
