import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { futureDate, loginAsAdmin, openAdmin } from './support/admin'

test('staff booking: inline client, shop games, discounts and responsive summary', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Create isolated fixture records once; validate desktop and mobile in the same flow.')
  const backendUrl = process.env.SUPABASE_URL || ''
  if (backendUrl !== 'http://127.0.0.1:56431') throw new Error('The booking write fixture requires the dedicated local service.')
  const fixtureAdmin = createClient(backendUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: existingSessions, error: fixtureError } = await fixtureAdmin.from('sessions').select('date').eq('venue_key', 'cafe-des-stagiaires').gte('date', futureDate(35))
  if (fixtureError) throw fixtureError
  let bookingDay = 35
  while (existingSessions?.some((session) => session.date === futureDate(bookingDay))) bookingDay += 1
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loginAsAdmin(page)
  await openAdmin(page)
  await page.setViewportSize({ width: 1142, height: 894 })
  await expect(page.getByRole('combobox', { name: 'Booking type', exact: true })).toHaveValue('customer')
  const name = page.getByRole('combobox', { name: 'Customer name', exact: true })
  await name.click()
  await expect(page.getByRole('listbox')).toBeVisible()
  const client = `Inline client ${Date.now()}`
  await name.fill(client)
  await expect(page.getByRole('option', { name: new RegExp(`Create profile for.*${client}`) })).toBeVisible()
  await name.press('ArrowDown')
  await name.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Shop', exact: true }).selectOption('cafe-des-stagiaires')
  await expect(page.getByRole('combobox', { name: 'Game', exact: true }).locator('option')).toHaveText(['City Z', 'Revolta', 'Station Zarya'])
  await expect(page.getByRole('button', { name: 'Booking time', exact: true })).toHaveText('16:00')
  await expect(page.getByRole('combobox', { name: 'Arena', exact: true })).toHaveValue('cafe:arena-1')
  await page.getByLabel('Booking date', { exact: true }).fill(futureDate(bookingDay))
  await page.getByRole('combobox', { name: 'Unique discount', exact: true }).selectOption('percentage')
  await page.getByLabel('Unique discount value', { exact: true }).fill('10')
  await expect(page.locator('.staff-price-lines')).toContainText('216.000')
  await page.screenshot({ path: '/tmp/staff-booking-desktop.png' })
  await page.setViewportSize({ width: 375, height: 667 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(await page.locator('.staff-readonly-fieldset input, .staff-readonly-fieldset select, .staff-price-lines').evaluateAll((controls) => controls.every((control) => {
    const bounds = control.getBoundingClientRect()
    return bounds.width === 0 || (bounds.left >= 0 && bounds.right <= innerWidth)
  }))).toBe(true)
  const overlaps = await page.locator('.staff-price-lines').evaluate((grid) => {
    const children = [...grid.children]
    return children.some((child, index) => index % 2 === 0 && child.getBoundingClientRect().right > children[index + 1].getBoundingClientRect().left)
  })
  expect(overlaps).toBe(false)
  await page.screenshot({ path: '/tmp/staff-booking-mobile.png' })
  await page.setViewportSize({ width: 1142, height: 894 })
  let writes = 0
  page.on('request', (request) => { if (request.url().endsWith('/rpc/create_staff_order_with_payments')) writes += 1 })
  const createdResponse = page.waitForResponse((response) => response.url().endsWith('/rpc/create_staff_order_with_payments'))
  await page.getByRole('button', { name: 'Confirm booking', exact: true }).click()
  const created = await (await createdResponse).json() as { session_id: string; customer_id: string }
  testInfo.annotations.push({ type: 'local-fixture', description: created.session_id || 'creation failed' })
  await expect(page.locator('.staff-summary-card .notice')).toContainText(/confirmed/i)
  expect(writes).toBe(1)
  await name.fill(client)
  await expect(page.getByRole('option').filter({ hasText: client }).first()).toBeVisible()
  await page.getByRole('option').filter({ hasText: client }).first().click()
  await expect(page.getByText('Existing profile selected.', { exact: false })).toBeVisible()
  await page.getByRole('combobox', { name: 'Booking type', exact: true }).selectOption('guest')
  await expect(name).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Shop', exact: true }).selectOption('cafe-des-stagiaires')
  await expect(page.getByRole('combobox', { name: 'Arena', exact: true }).locator('option')).toHaveCount(1)
  await page.getByRole('combobox', { name: 'Shop', exact: true }).selectOption('ha-do-centrosa')
  await expect(page.getByRole('combobox', { name: 'Game', exact: true }).locator('option')).toHaveCount(12)
  await expect(page.getByRole('combobox', { name: 'Arena', exact: true })).toHaveValue('arena-1')
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
  expect(errors).toEqual([])
  const cleanupSession = await fixtureAdmin.from('sessions').delete().eq('id', created.session_id)
  if (cleanupSession.error) throw cleanupSession.error
  // Guest-style identities are SQL records without a GoTrue login; clean up through the isolated database.
  if (!/^[0-9a-f-]{36}$/.test(created.customer_id)) throw new Error('Missing fixture customer id')
  execFileSync('docker', ['exec', '-i', 'supabase_db_vrena-health-ci', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: `delete from auth.users where id = '${created.customer_id}'::uuid;`, stdio: ['pipe', 'ignore', 'pipe'],
  })
})

test('staff booking: repeated confirmation clicks recover after a failed check', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Exercise the request lock once.')
  await loginAsAdmin(page)
  await openAdmin(page)
  await page.getByRole('combobox', { name: 'Booking type', exact: true }).selectOption('guest')
  let rateChecks = 0
  let writes = 0
  await page.route('**/rest/v1/rpc/consume_booking_attempt_rate_limit', async (route) => {
    rateChecks += 1
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill(rateChecks === 1 ? { status: 429, json: { message: 'QA temporary check failure' } } : { json: null })
  })
  await page.route('**/rest/v1/rpc/create_staff_order_with_payments', async (route) => {
    writes += 1
    await route.fulfill({ json: { order_number: 'QA-SINGLE-BOOKING', total: 220000 } })
  })
  const confirm = page.getByRole('button', { name: 'Confirm booking', exact: true })
  await confirm.dblclick()
  await expect(page.locator('.staff-summary-card .notice')).toContainText('QA temporary check failure')
  expect(rateChecks).toBe(1)
  expect(writes).toBe(0)
  await confirm.dblclick()
  await expect(page.locator('.staff-summary-card .notice')).toContainText('QA-SINGLE-BOOKING')
  expect(rateChecks).toBe(2)
  expect(writes).toBe(1)
})

test('staff booking: client contacts and available discounts follow the selection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Exercise the conditional form states once.')
  await loginAsAdmin(page)
  await page.route('**/rest/v1/rpc/profile_search', async (route) => route.fulfill({ json: [
    { id: '85000000-0000-4000-8000-000000000041', full_name: 'Client Alpha', phone: '+84900000111', email: 'alpha@example.invalid', role: 'player' },
    { id: '85000000-0000-4000-8000-000000000042', full_name: 'Client Beta', phone: null, email: null, role: 'player' },
  ] }))
  await page.route('**/rest/v1/staff_discount_rules*', async (route) => route.fulfill({ json: [{
    id: '85000000-0000-4000-8000-000000000043', code: 'PAIR10', name: 'Pair offer',
    active: true, game_id: null, price_rule_id: null, min_players: 2, max_players: null,
    day_scope: 'all', time_start: null, time_end: null, ticket_type: 'individual',
    min_order_total: 0, max_discount_amount: null, per_customer_limit: null,
    discount_type: 'percentage', value: 10, valid_from: '2020-01-01', valid_until: null,
    max_uses: null, used_count: 0,
  }] }))
  let writes = 0
  await page.route('**/rest/v1/rpc/create_staff_order_with_payments', async (route) => { writes += 1; await route.abort() })
  await openAdmin(page)
  const name = page.getByRole('combobox', { name: 'Customer name', exact: true })
  await name.click()
  await page.getByRole('option').filter({ hasText: 'Client Alpha' }).click()
  await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveValue('alpha@example.invalid')
  await name.fill('Client B')
  await page.getByRole('option').filter({ hasText: 'Client Beta' }).click()
  await expect(page.getByRole('textbox', { name: 'Phone', exact: true })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'E-mail', exact: true })).toHaveValue('')
  await page.getByRole('spinbutton', { name: 'Players', exact: true }).fill('2')
  const discount = page.getByRole('combobox', { name: 'Discount / voucher', exact: true })
  await expect(discount.locator('option')).toContainText(['No discount', 'PAIR10 · Pair offer · 10%'])
  await discount.selectOption('85000000-0000-4000-8000-000000000043')
  await expect(page.locator('.staff-price-lines')).toContainText('Pair offer')
  await page.getByRole('spinbutton', { name: 'Players', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Confirm booking', exact: true }).click()
  await expect(page.locator('.staff-summary-card .notice')).toContainText('This discount no longer applies')
  expect(writes).toBe(0)
  await discount.selectOption('')
  await expect(page.locator('.staff-price-lines')).toContainText('No discount')
})
