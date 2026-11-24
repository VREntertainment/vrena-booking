import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { futureDate, loginAsAdmin } from './support/admin'

async function fitsPage(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}
test('public booking inputs remain readable and within the viewport', async ({ page }, info) => {
  await page.goto('/tickets?venue=ha-do-centrosa&lang=en')
  await expect(page.locator('.ticket-control select').first()).toBeVisible()
  await fitsPage(page)
  if (page.viewportSize()!.width <= 760) {
    const sizes = await page.locator('.ticket-control input, .ticket-control select, .ticket-special-note-field textarea').evaluateAll(els => els.filter(el => el.getBoundingClientRect().width > 0).map(el => parseFloat(getComputedStyle(el).fontSize)))
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16)
  }
  await page.screenshot({ path: `/tmp/vrena-e2e-results/public-booking-${info.project.name}.png` })
  // The unused SIM form is deferred, but must still open normally when selected.
  await page.goto('/tickets?venue=ha-do-centrosa&lang=en#sim-racing')
  await expect(page.getByRole('heading', { name: 'SIM Racing', exact: true })).toBeVisible()
  await expect(page.locator('.sim-racing-booking input[type="tel"]')).toBeVisible()
  await fitsPage(page)
})
for (const venue of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
  test(`responsive calendar, details and staff form: ${venue}`, async ({ page }, info) => {
    if (process.env.SUPABASE_URL !== 'http://127.0.0.1:56431') throw new Error('Responsive fixtures require isolated services.')
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const owner = await admin.from('profiles').select('id,full_name').eq('email', process.env.E2E_ADMIN_EMAIL!).single()
    if (owner.error) throw owner.error
    const id = crypto.randomUUID()
    const date = futureDate(247)
    const name = `Responsive calendar ${venue}`
    const fixture = {
      id, owner_id: owner.data.id, name, date, start_time: '16:30', duration_minutes: 30,
      max_players: 4, arena_count: 1, game_options: [], game_votes: {}, visibility: 'private',
      status: 'open', booking_type: 'ticket', ticket_type: 'individual', ticket_player_count: 4,
      ticket_status: 'confirmed', venue_key: venue,
    }
    const inserted = await admin.from('sessions').insert(fixture)
    if (inserted.error) throw inserted.error
    const employee = await admin.from('staff_employee_profiles').select('legal_name').eq('profile_id', owner.data.id).maybeSingle()
    if (employee.error) throw employee.error
    const creatorText = venue === 'ha-do-centrosa' ? employee.data?.legal_name || owner.data.full_name : 'Not recorded'
    const cleanupIds = [id]
    if (venue === 'ha-do-centrosa') {
      const parallelId = crypto.randomUUID()
      const parallel = await admin.from('sessions').insert({ ...fixture, id: parallelId, name: 'Parallel readability reservation' })
      if (parallel.error) throw parallel.error
      cleanupIds.push(parallelId)
    }
    try {
      if (venue === 'ha-do-centrosa') {
        const audit = await admin.from('audit_logs').insert({ actor_user_id: owner.data.id, operator_session_id: crypto.randomUUID(), action: 'kiosk_insert', entity_type: 'sessions', entity_id: id, new_value: { booking_operator_profile_id: owner.data.id } })
        if (audit.error) throw audit.error
      }
      await loginAsAdmin(page)
      await page.goto(`/create-session?mode=calendar&date=${date}&venue=${venue}&lang=en`)
      await expect(page.locator('.calendar-panel')).toHaveAttribute('aria-busy', 'false')
      await fitsPage(page)
      const card = page.locator('.calendar-session-block').filter({ hasText: name })
      const readable = await card.locator('.calendar-session-compact').evaluate(el => {
        const parent = el.closest('button')!.getBoundingClientRect()
        return [...el.children].filter(row => getComputedStyle(row).display !== 'none').every(row => {
          const box = row.getBoundingClientRect()
          const font = parseFloat(getComputedStyle(row).fontSize)
          return box.height >= font && box.bottom <= parent.bottom - 2
        })
      })
      expect(readable).toBe(true)
      await expect(card).toHaveAttribute('data-calendar-density', 'time-only')
      await expect(card.locator('.calendar-session-compact > strong')).toBeHidden()
      await expect(card.locator('.calendar-booking-category')).toBeHidden()
      await expect(card.locator('.calendar-session-compact > small')).toBeHidden()
      expect(await card.locator('.calendar-session-time-range').first().evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      const controls = page.locator('.calendar-booking-controls')
      const arrows = controls.locator('.calendar-nav button')
      const bounds = await controls.locator('button').evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect()
        return { x: r.x, right: r.right, y: r.y + r.height / 2, width: r.width, height: r.height }
      }))
      expect(Math.max(...bounds.map(r => r.y)) - Math.min(...bounds.map(r => r.y))).toBeLessThan(2)
      if (page.viewportSize()!.width <= 600) {
        for (const r of bounds) { expect(r.height).toBeGreaterThanOrEqual(44); expect(r.right).toBeLessThanOrEqual(page.viewportSize()!.width) }
        for (const r of bounds.slice(-2)) expect(r.width).toBeGreaterThanOrEqual(44)
      }
      // Exercise both week arrows, then reopen the fixture week.
      await arrows.last().click()
      await expect(page.locator('.calendar-panel')).toHaveAttribute('aria-busy', 'false')
      await arrows.first().click()
      await expect(page.locator('.calendar-session-block').filter({ hasText: name })).toBeVisible()
      const grid = page.locator('.calendar-scroll')
      await grid.evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = 120 })
      await fitsPage(page)
      const fixedTime = await page.locator('.calendar-time-column').boundingBox()
      const gridBounds = await grid.boundingBox()
      expect(Math.abs(fixedTime!.x - gridBounds!.x)).toBeLessThan(3)
      await grid.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0 })
      await page.locator('.calendar-session-block').filter({ hasText: name }).click()
      await expect(page.locator('.calendar-booking-creator strong')).toHaveText(creatorText)
      await expect(page.locator('.calendar-booking-creator time')).toHaveAttribute('datetime', /T/)
      const dialog = page.getByRole('dialog', { name: 'Edit booking', exact: true })
      await expect(dialog.getByRole('checkbox', { name: 'Confirmed with client', exact: true })).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
      expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
      await dialog.getByRole('checkbox', { name: 'Confirmed with client', exact: true }).check()
      await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
      // Unsaved dialog edits must not silently persist.
      await page.locator('.calendar-session-block').filter({ hasText: name }).click()
      await expect(page.locator('.calendar-booking-creator strong')).toHaveText(creatorText)
      await expect(page.locator('.calendar-booking-creator time')).toHaveAttribute('datetime', /T/)
      await expect(dialog.getByRole('checkbox', { name: 'Confirmed with client', exact: true })).not.toBeChecked()
      await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
      await card.click()
      await dialog.getByRole('checkbox', { name: 'Confirmed with client', exact: true }).check()
      await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
      await expect(dialog).not.toBeVisible()
      await expect(card.locator('.calendar-client-confirmed')).toBeVisible()
      expect(await card.locator('.calendar-session-time-range').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      await page.locator('.language-picker > button').click()
      await page.getByRole('button', { name: 'VI', exact: true }).click()
      await fitsPage(page)
      await controls.locator('button').first().click()
      await expect(page.getByTestId('staff-console')).toBeVisible()
      await fitsPage(page)
      const shop = page.getByRole('combobox', { name: /^(Shop|Cửa hàng)$/ })
      await expect(shop).toHaveValue(venue)
      await shop.selectOption('cafe-des-stagiaires')
      await expect(page.getByRole('combobox', { name: /^(Game|Trò chơi)$/ }).getByRole('option', { name: 'Laser Tag', exact: true })).toHaveCount(0)
      const country = page.locator('.staff-phone-control .country-button')
      if (page.viewportSize()!.width <= 760) {
        expect((await country.boundingBox())!.height).toBeGreaterThanOrEqual(44)
        expect(await shop.evaluate(el => getComputedStyle(el).fontSize)).toBe('16px')
      }
      await country.click()
      await expect(page.locator('.country-menu')).toBeVisible()
      const menu = await page.locator('.country-menu').boundingBox()
      expect(menu!.x).toBeGreaterThanOrEqual(0)
      expect(menu!.x + menu!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
      await page.locator('.country-menu input').fill('Vietnam')
      await page.locator('.country-list button').first().click()
      await fitsPage(page)
      if (page.viewportSize()!.width <= 960) {
        // Scroll for the mobile sticky-navigation assertion; desktop needs no scroll.
        await page.locator('.staff-summary-export').scrollIntoViewIfNeeded()
        const nav = await page.locator('.staff-console-nav').boundingBox()
        const header = await page.locator('aside').boundingBox()
        expect(nav!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1)
      }
      await page.screenshot({ path: `/tmp/vrena-e2e-results/responsive-${venue}-${info.project.name}.png` })
    } finally {
      await admin.from('audit_logs').delete().in('entity_id', cleanupIds)
      const removed = await admin.from('sessions').delete().in('id', cleanupIds)
      if (removed.error) throw removed.error
    }
  })
}
