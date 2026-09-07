import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { chooseCafeVenue, futureDate, loginAsAdmin, openAdmin } from './support/admin'

test('staff booking: electronic payments, automatic offers, required override reason and country menu', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Use the isolated service once.')
  if (process.env.SUPABASE_URL !== 'http://127.0.0.1:56431') throw new Error('Staff booking write tests require isolated services.')
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const suffix = Date.now()
  const { data: offers, error } = await admin.from('staff_discount_rules').insert([
    { name: `QA Group five ${suffix}`, discount_type: 'percentage', value: 10, min_players: 5, max_players: 8, ticket_type: 'all', valid_from: '2020-01-01', active: true },
    { name: `QA Group nine ${suffix}`, discount_type: 'percentage', value: 15, min_players: 9, max_players: 16, ticket_type: 'all', valid_from: '2020-01-01', active: true },
    { name: `QA Birthday ${suffix}`, discount_type: 'percentage', value: 10, ticket_type: 'birthday', valid_from: '2020-01-01', active: true },
    { name: `QA Affiliate ${suffix}`, code: `VR_QA_${suffix}`, discount_type: 'percentage', value: 10, ticket_type: 'all', valid_from: '2020-01-01', active: true },
  ]).select('id,name')
  if (error) throw error
  let sessionId: string | undefined
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await loginAsAdmin(page)
    await openAdmin(page)
    await page.setViewportSize({ width: 1142, height: 894 })
    const phoneHeight = await page.getByRole('textbox', { name: 'Phone', exact: true }).evaluate((el) => el.getBoundingClientRect().height)
    const countryHeight = await page.getByRole('button', { name: 'Country Code', exact: true }).evaluate((el) => el.getBoundingClientRect().height)
    expect(Math.abs(phoneHeight - countryHeight)).toBeLessThanOrEqual(1)
    await page.getByRole('button', { name: 'Country Code', exact: true }).click()
    await expect(page.getByPlaceholder('Search country or code')).toBeVisible()
    expect(await page.locator('.country-menu').evaluate((menu) => {
      const rect = menu.getBoundingClientRect()
      return Boolean(document.elementFromPoint(rect.left + 30, Math.min(innerHeight - 10, rect.bottom - 30))?.closest('.country-menu'))
    })).toBe(true)
    await page.getByPlaceholder('Search country or code').fill('Vietnam')
    await page.locator('.country-list button').first().click()
    await page.getByRole('button', { name: 'Booking time', exact: true }).click()
    const timeList = page.getByRole('listbox', { name: 'Booking time', exact: true })
    await expect(timeList.getByRole('option').first()).toHaveText('09:00')
    await timeList.getByRole('option').first().click()
    await page.getByRole('checkbox', { name: 'Guest booking', exact: true }).check()
    await page.getByRole('combobox', { name: 'Shop', exact: true }).selectOption('cafe-des-stagiaires')
    await page.getByRole('button', { name: 'Booking time', exact: true }).click()
    await expect(timeList.getByRole('option').first()).toHaveText('16:00')
    await expect(timeList.getByRole('option').last()).toHaveText('21:15')
    await page.getByRole('textbox', { name: 'Booking time: type a specific time', exact: true }).fill('15:00')
    await page.getByRole('textbox', { name: 'Booking time: type a specific time', exact: true }).press('Enter')
    await expect(page.getByRole('button', { name: 'Booking time', exact: true })).toHaveText('16:00')
    await page.getByLabel('Booking date', { exact: true }).fill(futureDate(181))
    const players = page.getByRole('spinbutton', { name: 'Players', exact: true })
    await players.fill('5')
    await expect(page.locator('.staff-price-lines')).toContainText('1.080.000')
    await players.fill('9')
    await expect(page.locator('.staff-price-lines')).toContainText('1.836.000')
    await players.fill('4')
    await expect(page.locator('.staff-price-lines')).toContainText('960.000')
    const discount = page.getByRole('combobox', { name: 'Discount / voucher', exact: true })
    await expect(discount.locator('option')).not.toContainText([`QA Affiliate ${suffix}`])
    await discount.selectOption(offers!.find((offer) => offer.name === `QA Birthday ${suffix}`)!.id)
    await expect(page.locator('.staff-price-lines')).toContainText('864.000')
    await page.getByRole('checkbox', { name: 'Override total', exact: true }).check()
    await page.getByRole('spinbutton', { name: 'Final total (VND)', exact: true }).fill('900000')
    await expect(page.getByRole('button', { name: 'Confirm booking', exact: true })).toBeDisabled()
    await page.getByRole('textbox', { name: 'Reason for price override', exact: true }).fill('Agreed birthday package')
    const method = page.getByRole('combobox', { name: 'Payment method', exact: true })
    await expect(method.locator('option')).toHaveText(['Cash', 'Bank Transfer', 'Credit/Debit Card', 'Momo', 'VNPAY'])
    for (const [index, value] of ['card_manual', 'momo_manual', 'vnpay'].entries()) {
      if (index) await page.getByRole('button', { name: 'Add split', exact: true }).click()
      await method.nth(index).selectOption(value)
      await page.getByRole('textbox', { name: 'Payment amount', exact: true }).nth(index).fill('300000')
    }
    await page.setViewportSize({ width: 375, height: 667 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('heading', { name: 'Payment splits', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/staff-new-payments-mobile.png', animations: 'disabled' })
    await page.setViewportSize({ width: 1142, height: 894 })
    const response = page.waitForResponse((res) => res.url().endsWith('/rpc/staff_create_booking'))
    await page.getByRole('button', { name: 'Confirm booking', exact: true }).click()
    const body = await (await response).json()
    sessionId = body.session_id
    expect(body.total).toBe(900000)
    const saved = await admin.from('staff_orders').select('total,payment_status,payment_method,price_override_original_total,price_override_reason,staff_order_payments(payment_method,amount)').eq('id', body.order_id).single()
    expect(saved.error).toBeNull()
    expect(saved.data).toMatchObject({ total: 900000, payment_status: 'paid', payment_method: 'split', price_override_original_total: 864000, price_override_reason: 'Agreed birthday package' })
    expect(saved.data!.staff_order_payments).toHaveLength(3)
    expect(errors).toEqual([])
  } finally {
    if (sessionId) await admin.from('sessions').delete().eq('id', sessionId)
    await admin.from('staff_discount_rules').delete().in('id', offers!.map((offer) => offer.id))
  }
})

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
  await expect(page.getByRole('combobox', { name: 'Booking source', exact: true })).toHaveValue('walk_in')
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
  page.on('request', (request) => { if (request.url().endsWith('/rpc/staff_create_booking')) writes += 1 })
  const createdResponse = page.waitForResponse((response) => response.url().endsWith('/rpc/staff_create_booking'))
  await page.getByRole('button', { name: 'Confirm booking', exact: true }).click()
  const created = await (await createdResponse).json() as { session_id: string; customer_id: string }
  testInfo.annotations.push({ type: 'local-fixture', description: created.session_id || 'creation failed' })
  await expect(page.locator('.staff-summary-card .notice')).toContainText(/confirmed/i)
  expect(writes).toBe(1)
  await name.fill(client)
  await expect(page.getByRole('option').filter({ hasText: client }).first()).toBeVisible()
  await page.getByRole('option').filter({ hasText: client }).first().click()
  await expect(page.getByText('Existing profile selected.', { exact: false })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Guest booking', exact: true }).check()
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
  await page.getByRole('checkbox', { name: 'Guest booking', exact: true }).check()
  let rateChecks = 0
  let writes = 0
  await page.route('**/rest/v1/rpc/consume_booking_attempt_rate_limit', async (route) => {
    rateChecks += 1
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill(rateChecks === 1 ? { status: 429, json: { message: 'QA temporary check failure' } } : { json: null })
  })
  await page.route('**/rest/v1/rpc/staff_create_booking', async (route) => {
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
  await page.route('**/rest/v1/rpc/staff_create_booking', async (route) => { writes += 1; await route.abort() })
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
  await expect(discount.locator('option')).toContainText(['Automatic group discount', 'PAIR10 · Pair offer · 10%'])
  await discount.selectOption('85000000-0000-4000-8000-000000000043')
  await expect(page.locator('.staff-price-lines')).toContainText('Pair offer')
  await page.getByRole('spinbutton', { name: 'Players', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Confirm booking', exact: true }).click()
  await expect(page.locator('.staff-summary-card .notice')).toContainText('This discount no longer applies')
  expect(writes).toBe(0)
  await discount.selectOption('')
  await expect(page.locator('.staff-price-lines')).toContainText('No discount')
})

test('staff calendar: shared calendar supports source-aware creation, edit, deletion and mobile payments', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Run the isolated write flow once; cover desktop and mobile together.')
  if (process.env.SUPABASE_URL !== 'http://127.0.0.1:56431') throw new Error('Calendar write tests require isolated local services.')
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  await page.route('**/api/bookings/update-email', (route) => route.fulfill({ json: { ok: true } }))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loginAsAdmin(page)
  await openAdmin(page)
  await page.setViewportSize({ width: 1142, height: 894 })
  await expect(page.getByRole('combobox', { name: 'Booking source', exact: true }).locator('option')).toHaveText(['Walk-in','Zalo','WhatsApp','Phone','Website','Other'])
  await page.getByRole('button', { name: 'Add split', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Payment amount', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Remove payment split 2', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Payment amount', exact: true })).toHaveCount(1)
  await page.setViewportSize({ width: 375, height: 667 })
  const hierarchy = await page.locator('.staff-payment-remove').evaluate((button) => {
    const rect = button.getBoundingClientRect()
    const input = button.previousElementSibling!.getBoundingClientRect()
    return { inline: Math.abs(rect.top + rect.height / 2 - input.top - input.height / 2) < 2, width: rect.width, background: getComputedStyle(button).backgroundColor }
  })
  expect(hierarchy.inline).toBe(true)
  expect(hierarchy.width).toBe(36)
  await expect(page.locator('.staff-payment-remove svg')).toBeVisible()
  expect(await page.locator('.staff-payment-add').evaluate((button) => getComputedStyle(button).borderTopWidth)).toBe('0px')
  await page.getByRole('heading', { name: 'Payment splits', exact: true }).scrollIntoViewIfNeeded()
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.locator('.staff-payment-splits').screenshot({ path: '/tmp/staff-payment-controls.png', animations: 'disabled' })
  await page.screenshot({ path: '/tmp/staff-payment-hierarchy-mobile.png', animations: 'disabled' })
  await page.setViewportSize({ width: 1142, height: 894 })
  await page.getByRole('combobox', { name: 'Shop', exact: true }).selectOption('cafe-des-stagiaires')
  await page.getByLabel('Booking date', { exact: true }).fill(futureDate(120))
  await page.getByRole('button', { name: 'Open session calendar', exact: true }).click()
  await expect(page).toHaveURL(/mode=calendar/)
  const calendar = page.locator('.calendar-panel')
  await expect(calendar).toHaveAttribute('aria-busy', 'false')
  await expect(calendar.locator('.calendar-shop-badge')).toHaveText('VRena Café des Stagiaires')
  await expect(page.getByTestId('staff-console')).toHaveCount(0)
  // Existing weekly grid is shared by both audiences, and the shop remains selected.
  await expect(calendar.locator('.calendar-day-column')).toHaveCount(7)
  await calendar.locator('.calendar-slot:not([disabled])').first().click()
  await expect(page.getByTestId('staff-console')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Shop', exact: true })).toHaveValue('cafe-des-stagiaires')
  await expect(page.getByRole('button', { name: 'Booking time', exact: true })).toHaveText('16:00')
  await page.getByRole('checkbox', { name: 'Guest booking', exact: true }).check()
  await page.getByRole('combobox', { name: 'Booking source', exact: true }).selectOption('zalo')
  const createdResponse = page.waitForResponse((response) => response.url().endsWith('/rpc/staff_create_booking'))
  await page.getByRole('button', { name: 'Confirm booking', exact: true }).click()
  const created = await (await createdResponse).json() as { session_id: string; order_id: string }
  expect(created.session_id).toBeTruthy()
  try {
    await expect(calendar).toBeVisible()
    await expect(calendar).toHaveAttribute('aria-busy', 'false')
    const saved = await admin.from('sessions').select('name,date,start_time,venue_key').eq('id', created.session_id).single()
    if (saved.error) throw saved.error
    const block = calendar.getByRole('button').filter({ hasText: saved.data.name })
    await expect(block).toHaveCount(1)
    await block.click()
    const dialog = page.getByRole('dialog', { name: 'Edit booking', exact: true })
    await expect(dialog.getByRole('combobox', { name: 'Booking source', exact: true })).toHaveValue('zalo')
    await dialog.getByRole('combobox', { name: 'Shop', exact: true }).selectOption('ha-do-centrosa')
    await dialog.getByRole('textbox', { name: 'Booking name', exact: true }).fill('Calendar updated fixture')
    await dialog.getByLabel('Time', { exact: true }).fill('17:00')
    await dialog.getByRole('spinbutton', { name: 'Players', exact: true }).fill('2')
    await dialog.getByRole('combobox', { name: 'Booking source', exact: true }).selectOption('whatsapp')
    await page.setViewportSize({ width: 375, height: 667 })
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: '/tmp/staff-calendar-editor-mobile.png' })
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(calendar).toHaveAttribute('aria-busy', 'false')
    await expect(calendar.locator('.calendar-shop-badge')).toHaveText('VRena Hà Đô Centrosa')
    const order = await admin.from('staff_orders').select('booking_time,players_count,booking_source,total').eq('id', created.order_id).single()
    expect(order.data).toMatchObject({ booking_time: '17:00:00', players_count: 2, booking_source: 'whatsapp', total: 240000 })
    await page.setViewportSize({ width: 1142, height: 894 })
    await calendar.getByRole('button').filter({ hasText: 'Calendar updated fixture' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: '/tmp/staff-calendar-desktop.png' })
    await calendar.getByRole('button').filter({ hasText: 'Calendar updated fixture' }).click()
    await dialog.getByRole('button', { name: 'Delete booking', exact: true }).click()
    const confirmation = page.getByRole('dialog', { name: 'Delete booking', exact: true })
    await expect(confirmation).toContainText('VRena Hà Đô Centrosa')
    await confirmation.getByRole('button', { name: 'Keep booking', exact: true }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete booking', exact: true }).click()
    await confirmation.getByRole('button', { name: 'Confirm deletion', exact: true }).click()
    await expect(confirmation).toHaveCount(0)
    await expect(calendar.getByRole('button').filter({ hasText: 'Calendar updated fixture' })).toHaveCount(0)
    const deleted = await admin.from('sessions').select('deleted_at').eq('id', created.session_id).single()
    expect(deleted.data?.deleted_at).toBeTruthy()
    expect(errors).toEqual([])
    const anonymous = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 375, height: 667 } })
    await anonymous.addCookies([{ name: 'vrena-cookie-consent', value: 'essential', url: new URL(page.url()).origin }])
    const clientPage = await anonymous.newPage()
    await clientPage.goto('/create-session')
    await clientPage.getByRole('button', { name: 'Calendar', exact: true }).click()
    await expect(clientPage.locator('.calendar-panel')).toHaveAttribute('aria-busy', 'false')
    await chooseCafeVenue(clientPage)
    await expect(clientPage.locator('.calendar-shop-badge')).toHaveText('VRena Café des Stagiaires')
    await expect(clientPage.getByRole('button', { name: 'New booking', exact: true })).toHaveCount(0)
    await expect(clientPage.getByRole('button', { name: 'Delete booking', exact: true })).toHaveCount(0)
    await expect(clientPage.locator('.calendar-day-column')).toHaveCount(7)
    expect(await clientPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await anonymous.close()
  } finally {
    await admin.from('sessions').delete().eq('id', created.session_id)
  }
})
