import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { futureDate, loginAsAdmin, openAdmin, openCreateSession } from './support/admin'

// Fixtures must never be written to a hosted database, even with staging enabled.
function localAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Operations fixtures require local Supabase')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Local fixture key is required')
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

test('operations includes unlinked ticket value and saves every ANVIO game', async ({ page }, info) => {
  if (info.project.name !== 'chromium') await page.setViewportSize({ width: 375, height: 667 })
  const db = localAdmin()
  const ids = [randomUUID(), randomUUID()]
  const name = `Catalog visit ${ids[0].slice(0, 8)}`
  const day = futureDate(info.project.name === 'chromium' ? 75 : info.project.name === 'webkit' ? 77 : 76)
  const { data: user, error } = await db.auth.admin.createUser({ email: `${ids[0]}@operations.test.invalid`, password: randomUUID(), email_confirm: true })
  expect(error).toBeNull()
  const profileId = user.user!.id
  try {
    expect((await db.from('sessions').insert(ids.map((id, index) => ({
      id, owner_id: profileId, name: index ? `${name} pending` : name, date: day, start_time: '10:00',
      max_players: 1, game_options: ['laser-tag'], booking_type: 'ticket', ticket_type: 'individual',
      ticket_player_count: 1, ticket_total_price: index ? 480000 : 660000,
      ticket_status: index ? 'pending' : 'confirmed', venue_key: index ? 'cafe-des-stagiaires' : 'ha-do-centrosa',
    })))).error).toBeNull()
    await loginAsAdmin(page)
    await openAdmin(page)
    await page.getByRole('tab', { name: 'Today', exact: true }).click()
    await page.getByLabel('Operations date', { exact: true }).fill(day)
    const money = page.locator('.staff-operations-money')
    await expect(money.locator('summary')).toContainText('660.000')
    await expect(money.locator('summary')).toContainText('Order reconciliation needed: 1')
    await money.locator('summary').click()
    for (const [label, amount] of [['Confirmed booking value', '660000'], ['Pending requests / drafts', '480000'], ['Bookings needing an order', '660000'], ['Order payments', '0'], ['Order balance due', '0']]) {
      const row = money.locator('.staff-operations-money-grid > div').filter({ has: page.getByText(label, { exact: true }) })
      await expect.poll(async () => (await row.locator('strong').innerText()).replace(/\D/g, '')).toBe(amount)
    }
    await money.locator('summary').click()
    const card = page.locator('article.staff-operation-session').filter({ has: page.getByText(name, { exact: true }) })
    await card.getByRole('button', { name: 'Record visit', exact: true }).click()
    const gameSelect = card.getByRole('combobox', { name: 'Game', exact: true })
    for (const [slug, title] of [['revolta', 'Revolta'], ['city-z', 'City Z'], ['station-zarya', 'Station Zarya']]) {
      await gameSelect.selectOption(slug)
      await expect.poll(async () => (await db.from('sessions').select('confirmed_game_id').eq('id', ids[0]).single()).data?.confirmed_game_id).toBe(slug)
      await expect(card.locator('.staff-operation-meta')).toContainText(title)
      await expect(gameSelect).toBeEnabled()
    }
    await page.reload()
    await page.getByRole('tab', { name: 'Today', exact: true }).click()
    await page.getByLabel('Operations date', { exact: true }).fill(day)
    await expect(card.locator('.staff-operation-meta')).toContainText('Station Zarya')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
    await card.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/vrena-priority-operations-${info.project.name}.png` })
  } finally {
    expect((await db.from('sessions').delete().in('id', ids)).error).toBeNull()
    await db.auth.admin.deleteUser(profileId)
  }
})

test('visit arrival, results, order linkage and receipts survive reload and connection failures', async ({ page }, info) => {
  if (info.project.name === 'webkit') await page.setViewportSize({ width: 375, height: 667 })
  const db = localAdmin()
  const id = randomUUID()
  const orderId = randomUUID()
  const participantId = randomUUID()
  const name = `Local visit ${id.slice(0, 8)}`
  const { data: user, error: userError } = await db.auth.admin.createUser({ email: `${id}@operations.test.invalid`, password: randomUUID(), email_confirm: true })
  expect(userError).toBeNull()
  const profileId = user.user!.id
  try {
    expect((await db.from('sessions').insert({ id, owner_id: profileId, name, date: futureDate(-1), start_time: '10:00', max_players: 1, game_options: ['laser-tag'], confirmed_game_id: 'laser-tag', booking_type: 'community' })).error).toBeNull()
    expect((await db.from('session_participants').insert({ id: participantId, session_id: id, profile_id: profileId, display_name: 'Local visit player', checked_in: false })).error).toBeNull()
    expect((await db.from('staff_orders').insert({ id: orderId, order_number: name, booking_date: futureDate(-1), booking_time: '10:00', players_count: 1, total: 100000, subtotal: 100000 })).error).toBeNull()
    await loginAsAdmin(page)
    await openAdmin(page)
    await page.getByRole('tab', { name: 'Today', exact: true }).click()
    await page.getByLabel('Operations date', { exact: true }).fill(futureDate(-1))
    const card = page.locator('article.staff-operation-session').filter({ hasText: name }).first()
    await card.getByRole('button', { name: 'Record visit', exact: true }).click()
    await expect(card.getByText('Recorded arrivals: 0 / 1', { exact: true })).toBeVisible()
    const orderSelect = card.getByRole('combobox', { name: 'Choose the matching order', exact: true })
    await expect(orderSelect.locator(`option[value="${orderId}"]`)).toHaveCount(1)
    await orderSelect.selectOption(orderId, { timeout: 5000 })
    await card.getByRole('button', { name: 'Link existing order', exact: true }).click()
    await expect(card.getByText('Order linked.', { exact: true })).toBeVisible()
    await card.getByRole('button', { name: 'Done', exact: true }).click()
    expect((await db.from('staff_orders').select('order_status').eq('id', orderId).single()).data?.order_status).toBe('confirmed')
    const editor = card.locator('.staff-operation-participant').filter({ hasText: 'Local visit player' })
    await editor.getByLabel('Player arrived', { exact: true }).check()
    await editor.getByRole('combobox', { name: 'Player payment method', exact: true }).selectOption('cash')
    await editor.getByLabel('Payment amount (VND)', { exact: true }).fill('100000')
    await editor.getByLabel('Score', { exact: true }).fill('0')
    await page.route('**/rest/v1/rpc/staff_upsert_session_participant_result_v2', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Simulated connection failure"}' }), { times: 1 })
    await editor.getByRole('button', { name: 'Save visit record', exact: true }).click()
    await expect(editor.getByText(/Your entries are still here/)).toBeVisible()
    await expect(editor.getByLabel('Score', { exact: true })).toHaveValue('0')
    await editor.getByRole('button', { name: 'Save visit record', exact: true }).click()
    await expect(editor.getByText('Visit record saved.', { exact: true })).toBeVisible()
    await expect(card.getByText('Arrived players with results: 1 / 1', { exact: true })).toBeVisible()

    await card.getByRole('button', { name: 'Record order payment', exact: true }).click()
    const payment = card.getByRole('form', { name: 'Record order payment' })
    // Simulate a committed receipt whose response is lost, then retry the same entry.
    await page.route('**/rest/v1/rpc/staff_record_order_payment', async (route) => {
      const committed = await route.fetch()
      expect(committed.ok()).toBe(true)
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Response lost after commit"}' })
    }, { times: 1 })
    await payment.getByRole('button', { name: 'Save order payment', exact: true }).click()
    await expect(payment.getByRole('alert')).toBeVisible()
    await payment.getByRole('button', { name: 'Save order payment', exact: true }).click()
    await expect(payment).toHaveCount(0)
    const receipts = await db.from('staff_order_payments').select('amount,payment_method').eq('order_id', orderId)
    expect(receipts.data).toEqual([{ amount: 100000, payment_method: 'cash' }])
    await card.getByRole('button', { name: 'Done', exact: true }).click()
    await expect.poll(async () => (await db.from('staff_orders').select('order_status').eq('id', orderId).single()).data?.order_status).toBe('completed')
    await page.reload()
    await page.getByRole('tab', { name: 'Today', exact: true }).click()
    await page.getByLabel('Operations date', { exact: true }).fill(futureDate(-1))
    await card.getByRole('button', { name: 'Record visit', exact: true }).click()
    await expect(editor.getByLabel('Player arrived', { exact: true })).toBeChecked()
    await expect(editor.getByLabel('Score', { exact: true })).toHaveValue('0')
    await expect(editor.getByLabel('Payment amount (VND)', { exact: true })).toHaveValue('100000')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
    await editor.scrollIntoViewIfNeeded()
    await editor.screenshot({ path: `/tmp/vrena-visit-form-${info.project.name}.png` })
    await card.locator('.staff-operation-main').screenshot({ path: `/tmp/vrena-visit-progress-${info.project.name}.png` })
  } finally {
    expect((await db.from('staff_orders').delete().eq('id', orderId)).error).toBeNull()
    await db.from('sessions').delete().eq('id', id)
    await db.auth.admin.deleteUser(profileId)
  }
})

test('order history browses beyond 250 rows and retries a failed range request', async ({ page }, info) => {
  const db = localAdmin()
  const day = info.project.name === 'chromium' ? '2001-01-01' : info.project.name === 'webkit' ? '2001-01-03' : '2001-01-02'
  const batch = randomUUID().slice(0, 8)
  const rows = Array.from({ length: 251 }, (_, index) => ({ id: randomUUID(), order_number: `History ${batch} ${index}`, booking_date: day, booking_time: '10:00', players_count: 1 }))
  try {
    expect((await db.from('staff_orders').insert(rows)).error).toBeNull()
    await loginAsAdmin(page)
    await openAdmin(page)
    await page.getByRole('tab', { name: 'Orders', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Show orders', exact: true })).toBeEnabled()
    await page.getByLabel('Start date', { exact: true }).fill(day)
    await page.getByLabel('End date', { exact: true }).fill(day)
    await page.route('**/rest/v1/staff_orders?**', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"Simulated history outage"}' }), { times: 1 })
    await page.getByRole('button', { name: 'Show orders', exact: true }).click()
    await expect(page.getByRole('alert').getByText(/Couldn’t load this data/)).toBeVisible()
    await expect(page.getByText(/Showing \d/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(page.getByText('Showing 1–50 / 251', { exact: true })).toBeVisible()
    const seen = new Set(await page.locator('.staff-order-row td:first-child strong').allTextContents())
    for (let n = 1; n <= 5; n++) {
      await page.getByRole('button', { name: 'Next page', exact: true }).click()
      await expect(page.getByText(`Showing ${n * 50 + 1}–${Math.min((n + 1) * 50, 251)} / 251`, { exact: true })).toBeVisible()
      for (const number of await page.locator('.staff-order-row td:first-child strong').allTextContents()) {
        expect(seen.has(number)).toBe(false)
        seen.add(number)
      }
    }
    expect(seen.size).toBe(251)
    await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Previous page', exact: true }).click()
    await expect(page.getByText('Showing 201–250 / 251', { exact: true })).toBeVisible()
    await page.screenshot({ path: `/tmp/vrena-orders-${info.project.name}.png` })
  } finally {
    for (let i = 0; i < rows.length; i += 50) expect((await db.from('staff_orders').delete().in('id', rows.slice(i, i + 50).map((row) => row.id))).error).toBeNull()
  }
})

test('sign-in loading, create-session accessible controls, and Vietnamese document language', async ({ page }, info) => {
  await loginAsAdmin(page)
  await page.route('**/rest/v1/profiles?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800))
    await route.continue()
  })
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Checking sign-in…', { exact: true })).toBeVisible()
  await expect(page.getByText('Staff access required', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('staff-console')).toBeVisible()
  await page.unroute('**/rest/v1/profiles?**')
  await openCreateSession(page)
  for (const input of await page.locator('#create-session-form select:visible, #create-session-form input:visible').all()) {
    await expect(input).toHaveAccessibleName(/.+/)
  }
  await page.locator('.session-type-toggle').getByRole('button').nth(1).click()
  for (const input of await page.locator('#create-session-form select:visible, #create-session-form input:visible').all()) await expect(input).toHaveAccessibleName(/.+/)
  await page.getByTestId('create-session-name').focus()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  await page.goto('/games/vi')
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  await expect(page.locator('main')).toHaveAttribute('lang', 'vi')
  await expect(page).toHaveTitle(/Hướng dẫn game/)
  await expect(page.getByRole('heading', { name: 'Hướng dẫn game', exact: true })).toBeVisible()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: `/tmp/vrena-guide-vi-${info.project.name}.png` })
  await page.goto('/games/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
