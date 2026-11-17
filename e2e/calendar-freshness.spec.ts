import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { futureDate, loginAsAdmin } from './support/admin'

for (const venue of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
  test(`calendar resumes, reconnects and recovers without losing bookings: ${venue}`, async ({ page, context }) => {
    test.setTimeout(90_000)
    if (process.env.SUPABASE_URL !== 'http://127.0.0.1:56431') throw new Error('Calendar fixtures require isolated services.')
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const owner = await admin.from('profiles').select('id').eq('email', process.env.E2E_ADMIN_EMAIL!).single()
    if (owner.error) throw owner.error
    const id = crypto.randomUUID()
    const date = futureDate(1)
    const name = `Fresh calendar ${id}`
    const inserted = await admin.from('sessions').insert({
      id, owner_id: owner.data.id, name, date, start_time: venue === 'ha-do-centrosa' ? '09:00' : '15:30',
      duration_minutes: 30, max_players: 4, arena_count: 1, game_options: [], game_votes: {},
      visibility: 'private', status: 'open', booking_type: 'ticket', ticket_type: 'individual',
      ticket_player_count: 4, ticket_status: 'confirmed', venue_key: venue,
    })
    if (inserted.error) throw inserted.error
    try {
      await loginAsAdmin(page)
      await page.clock.install()
      let published = false
      let fail = false
      let calendarReads = 0
      await page.route('**/rest/v1/rpc/booking_calendar_list_page', async route => {
        const args = route.request().postDataJSON()
        if (args.p_limit === 250) {
          calendarReads++
          if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'temporary test failure' }) })
        }
        const response = await route.fetch()
        const payload = await response.json()
        if (!published && Array.isArray(payload.sessions)) payload.sessions = payload.sessions.filter((row: { id: string }) => row.id !== id)
        await route.fulfill({ response, json: payload })
      })
      await page.goto(`/create-session?mode=calendar&date=${date}&venue=${venue}&lang=en`)
      const panel = page.locator('.calendar-panel')
      const card = page.locator('.calendar-session-block').filter({ hasText: name })
      await expect(panel).toHaveAttribute('aria-busy', 'false')
      await expect(card).toHaveCount(0)
      // No socket event: a booking made elsewhere appears when Android resumes.
      published = true
      let reads = calendarReads
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await expect.poll(() => calendarReads).toBeGreaterThan(reads)
      await expect(card).toBeAttached()
      await expect(card).toHaveAttribute('data-calendar-density', 'time-only')
      const selectedWeek = await page.locator('input[type="date"]').inputValue()
      // Temporary errors preserve the last complete week and provide an explicit retry.
      fail = true
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(panel.getByRole('alert')).toContainText('Could not refresh bookings')
      await expect(card).toBeAttached()
      fail = false
      await panel.getByRole('button', { name: 'Retry', exact: true }).click()
      await expect(panel.getByRole('alert')).toHaveCount(0)
      await expect(card).toBeAttached()
      // Reconnect does not require closing/reinstalling the PWA or navigating weeks.
      await context.setOffline(true)
      await page.evaluate(() => window.dispatchEvent(new Event('offline')))
      await expect(panel.getByRole('alert')).toBeVisible()
      await expect(card).toBeAttached()
      await context.setOffline(false)
      await page.evaluate(() => window.dispatchEvent(new Event('online')))
      await expect(panel.getByRole('alert')).toHaveCount(0)
      // The visible calendar also polls, covering a silently disconnected realtime socket.
      reads = calendarReads
      await page.clock.fastForward(30_100)
      await expect.poll(() => calendarReads).toBeGreaterThan(reads)
      await expect(card).toBeAttached()
      await expect(page.locator('input[type="date"]')).toHaveValue(selectedWeek)
    } finally {
      await context.setOffline(false)
      const deleted = await admin.from('sessions').delete().eq('id', id)
      if (deleted.error) throw deleted.error
    }
  })
}
