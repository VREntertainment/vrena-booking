import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { futureDate, loginAsAdmin } from './support/admin'

test('staff selects the next free time, explains disabled confirmation, and highlights the saved order', async ({ page }, info) => {
  if (process.env.SUPABASE_URL !== 'http://127.0.0.1:56431') throw new Error('Isolated local test services required')
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const actor = await admin.from('profiles').select('id').eq('email', process.env.E2E_ADMIN_EMAIL!).single()
  if (actor.error) throw actor.error
  const blocked = randomUUID()
  const date = futureDate(53)
  let createdId = ''
  const fixture = await admin.from('sessions').insert({ id: blocked, owner_id: actor.data.id, name: 'Availability regression fixture', date, start_time: '09:00:00', duration_minutes: 70, max_players: 4, arena_count: 2, game_options: [], game_votes: {}, visibility: 'private', status: 'open', booking_type: 'ticket', ticket_type: 'individual', ticket_status: 'confirmed', venue_key: 'ha-do-centrosa' })
  if (fixture.error) throw fixture.error
  try {
    await loginAsAdmin(page)
    await page.goto('/staff?lang=en')
    await page.getByRole('tab', { name: 'New Booking', exact: true }).click()
    const confirm = page.getByRole('button', { name: 'Confirm booking', exact: true })
    await expect(confirm).toBeDisabled()
    await expect(page.locator('#staff-booking-disabled-reason')).toContainText('customer name')
    await expect(confirm).toHaveAttribute('title', /customer name/)
    await page.getByRole('checkbox', { name: 'Guest booking', exact: true }).check()
    await page.getByLabel('Booking date', { exact: true }).fill(date)
    const time = page.getByRole('button', { name: 'Booking time', exact: true })
    await expect(time).toHaveText('10:10')
    await time.click()
    await expect(page.getByRole('option', { name: '09:00', exact: true })).toBeDisabled()
    await expect(page.getByRole('option', { name: '10:10', exact: true })).toBeEnabled()
    await page.getByRole('option', { name: '10:10', exact: true }).click()
    await expect(confirm).toBeEnabled()
    const response = page.waitForResponse(res => res.url().endsWith('/rpc/staff_create_booking_with_metadata'))
    await confirm.click()
    const saved = await (await response).json()
    createdId = saved.session_id
    expect(createdId).toBeTruthy()
    await expect(page.getByRole('tab', { name: 'Orders', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.staff-order-just-created')).toContainText(saved.order_number)
    await expect(page.locator('.staff-summary-card')).toHaveCount(0)
    await expect(page.locator('.staff-booking-success')).toContainText(saved.order_number)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await page.screenshot({ path: `/tmp/vrena-e2e-results/staff-confirmed-order-${info.project.name}.png` })
    await page.locator('.staff-booking-success').getByRole('button', { name: 'New booking', exact: true }).click()
    await expect(page.getByRole('tab', { name: 'New Booking', exact: true })).toHaveAttribute('aria-selected', 'true')
  } finally {
    if (createdId) {
      await admin.from('staff_orders').delete().eq('session_id', createdId)
      await admin.from('sessions').delete().eq('id', createdId)
    }
    await admin.from('sessions').delete().eq('id', blocked)
  }
})
