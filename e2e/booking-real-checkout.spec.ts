import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { futureDate } from './support/admin'

for (const venue of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
  for (const signedIn of [false, true]) {
    test(`${venue}: real ${signedIn ? 'incomplete account' : 'guest without registration'} checkout and cleanup`, async ({ page, baseURL }) => {
      const url = process.env.SUPABASE_URL || ''
      test.skip(process.env.E2E_LOCAL_HOST !== 'localhost' || !process.env.SUPABASE_SERVICE_ROLE_KEY, 'Requires isolated local services')
      expect(new URL(url).hostname).toBe('127.0.0.1')
      const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
      const suffix = randomUUID()
      const phone = `+84${Date.now().toString().slice(-9)}`
      const email = `checkout-${suffix}@example.com`
      const ids = new Set<string>()
      let reservationId = ''
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      expect((await admin.from('profiles').select('id').eq('phone', phone)).data).toEqual([])
      await page.context().addCookies([{ name: 'vrena-cookie-consent', value: 'essential', url: baseURL! }])
      try {
        if (signedIn) {
          const password = randomUUID()
          const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
          expect(created.error).toBeNull()
          const id = created.data.user!.id
          ids.add(id)
          expect((await admin.from('profiles').upsert({ id, full_name: 'Matrix Tester', nickname: `Matrix-${suffix.slice(0, 8)}`, role: 'player', birthday: '1990-01-01', phone: null, email: null, onboarding_tour_completed_at: new Date().toISOString() })).error).toBeNull()
          const login = await client.auth.signInWithPassword({ email, password })
          expect(login.error).toBeNull()
          await page.addInitScript(({ session, key }) => localStorage.setItem(key, JSON.stringify(session)), {
            session: login.data.session,
            key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`,
          })
        }
        await page.goto(`/tickets?venue=${venue}`)
        if (signedIn) await expect(page.locator('.profile-chip')).toContainText('Matrix')
        const date = futureDate(68)
        const time = venue === 'ha-do-centrosa' ? '12:00' : '17:10'
        await page.locator('.ticket-control-date input').fill(date)
        await page.locator('#ticket-available-time').selectOption(time)
        await page.locator('#ticket-player-count').selectOption('2')
        await page.getByRole('button', { name: 'Reserve your slot', exact: true }).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toBeVisible()
        if (signedIn) {
          await dialog.locator('#booking-account-phone').fill(phone.slice(3))
          await dialog.locator('#booking-account-email').fill(email)
        } else {
          await dialog.locator('#guest-booking-phone').fill(phone.slice(3))
          await expect(dialog.locator('input[type=email], input[type=password]')).toHaveCount(0)
        }
        const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/bookings/tickets') && response.request().method() === 'POST')
        await dialog.getByRole('button', { name: signedIn ? 'Save & confirm booking' : 'Book without an account', exact: true }).click()
        const response = await responsePromise
        const result = await response.json()
        reservationId = result.data?.session_id || ''
        expect(response.ok(), JSON.stringify(result)).toBe(true)
        expect(result.data.ticket_status).toBe('confirmed')
        expect(reservationId).not.toBe('')
        if (!signedIn) expect(response.request().headers().authorization).toBeUndefined()
        await expect(page.locator('.ticket-confirmation')).toContainText(result.data.ticket_reference)
        await expect(page.getByRole('dialog', { name: 'Your booking is confirmed' })).toBeVisible()
        await page.getByRole('button', { name: 'Not now', exact: true }).click()
        const stored = await admin.from('sessions').select('ticket_status,date,start_time,ticket_player_count,venue_key').eq('id', reservationId).single()
        expect(stored.error).toBeNull()
        expect(stored.data).toMatchObject({ ticket_status: 'confirmed', date, start_time: `${time}:00`, ticket_player_count: 2, venue_key: venue })
        if (signedIn) {
          const saved = await admin.from('profiles').select('phone,email,role').eq('id', [...ids][0]).single()
          expect(saved.data).toEqual({ phone, email, role: 'player' })
        } else {
          expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.endsWith('-auth-token') && Boolean(localStorage.getItem(key))))).toBe(false)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
        expect(errors).toEqual([])
        await page.screenshot({ path: `/tmp/vrena-e2e-results/real-checkout-${venue}-${signedIn}-${test.info().project.name}.png`, fullPage: true })
      } finally {
        const guestProfiles = await admin.from('profiles').select('id').eq('phone', phone)
        for (const profile of guestProfiles.data || []) ids.add(profile.id)
        if (reservationId) expect((await admin.from('sessions').delete().eq('id', reservationId)).error).toBeNull()
        for (const id of ids) {
          // Guest shells may own more than one internally linked record.
          await admin.from('sessions').delete().or(`owner_id.eq.${id},ticket_customer_id.eq.${id}`)
          expect((await admin.auth.admin.deleteUser(id)).error).toBeNull()
        }
        for (const id of ids) expect((await admin.auth.admin.getUserById(id)).data.user).toBeNull()
      }
    })
  }
}
