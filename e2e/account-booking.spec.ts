import { expect, test, type Page } from '@playwright/test'
import { futureDate, stubHCaptcha } from './support/admin'

const userId = '00000000-0000-4000-8000-000000000991'
const bookingId = '00000000-0000-4000-8000-000000000992'

async function accountFixture(page: Page, phone: string, signedIn = true) {
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'booking-regression@vrena.local', app_metadata: {}, user_metadata: {}, factors: [] }
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now()/1000)+3600, aal: 'aal1', amr: [] })).toString('base64url'), 'fixture'].join('.')
  let profile = { id: userId, phone, full_name: 'Booking Tester', email: user.email, birthday: '1990-01-01', role: 'player', nickname: 'Tester', marketing_consent: false, onboarding_tour_completed_at: '2026-01-01T00:00:00Z' }
  const requests: Array<{ name: string; args: Record<string, unknown> }> = []
  let bookings: Record<string, unknown>[] = []
  await page.context().addCookies([{ name: 'vrena-cookie-consent', value: 'essential', url: 'http://127.0.0.1:3000' }])
  if (signedIn) await page.addInitScript(({ user, token }) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user }))
  }, { user, token })
  await page.route(`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}/**`, async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/auth/v1/token') return route.fulfill({ json: { access_token: token, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } })
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user })
    if (url.pathname === '/rest/v1/profiles' && url.searchParams.get('id') === `eq.${userId}`) {
      if (route.request().method() === 'PATCH') profile = { ...profile, ...route.request().postDataJSON() }
      return route.fulfill({ json: profile })
    }
    if (url.pathname === '/rest/v1/sessions' && url.searchParams.has('or')) {
      expect(url.searchParams.get('or')).toContain(`owner_id.eq.${userId}`)
      expect(url.searchParams.get('or')).toContain(`ticket_customer_id.eq.${userId}`)
      return route.fulfill({ json: bookings })
    }
    if (url.pathname.endsWith('/sessions_list_page')) return route.fulfill({ json: { sessions: [], has_more_after: false } })
    if (url.pathname.includes('rate_limit')) return route.fulfill({ json: { allowed: true } })
    return route.fulfill({ json: [] })
  })
  await page.route('**/api/bookings/tickets', async route => {
    const request = route.request().postDataJSON()
    requests.push(request)
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`)
    expect(profile.phone).toBe('+84900000991')
    bookings = [{ id: bookingId, owner_id: userId, ticket_customer_id: userId, venue_key: request.name === 'create_cafe_ticket_booking_request' ? 'cafe-des-stagiaires' : 'ha-do-centrosa', name: 'Account reservation', date: request.args.p_date, start_time: request.args.p_start_time, duration_minutes: 30, max_players: 2, arena_count: 1, game_options: [], status: 'open', ticket_status: 'confirmed', booking_type: 'ticket', ticket_reference: 'QA-ACCOUNT-991', ticket_total_price: 440000, session_participants: [] }]
    return route.fulfill({ json: { data: { session_id: bookingId, ticket_reference: 'QA-ACCOUNT-991', ticket_status: 'confirmed' }, error: null } })
  })
  return requests
}

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
