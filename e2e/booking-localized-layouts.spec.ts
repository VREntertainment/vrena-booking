import { expect, test, type Page } from '@playwright/test'
import { accountFixture } from './support/accountFixture'
import { futureDate } from './support/admin'
import { bookingExperienceCopy } from '../lib/bookingExperienceCopy'
import { languageOptions } from '../lib/i18n/languages'
import { loadTranslation } from '../lib/i18n/loadTranslation'

async function contained(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
}

for (const language of languageOptions) {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const device of [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'tablet', width: 820, height: 1180 },
      { name: 'laptop', width: 1440, height: 900 },
    ]) {
      test(`${language} ${colorScheme} ${device.name}: booking, phone, history, loyalty and preferences`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'This matrix sets each viewport and theme explicitly.')
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.message))
        const text = await loadTranslation(language)
        const copy = bookingExperienceCopy(language)
        await page.setViewportSize(device)
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
        await accountFixture(page, '')
        await page.addInitScript(lang => localStorage.setItem('vrena-language', lang), language)
        const venue = colorScheme === 'dark' ? 'cafe-des-stagiaires' : 'ha-do-centrosa'
        const stem = `/tmp/booking-matrix-${language}-${colorScheme}-${device.name}`
        await page.goto(`/tickets?venue=${venue}`)
        await expect(page.locator('html')).toHaveAttribute('lang', language)
        await expect(page.locator('.booking-focused-tabs a')).toHaveText([copy.book, copy.account])
        await page.locator('.ticket-control-date input').fill(futureDate(40))
        await page.locator('#ticket-available-time').selectOption(venue === 'ha-do-centrosa' ? '12:00' : '17:10')
        await contained(page)
        await page.screenshot({ path: `${stem}-booking.png`, fullPage: true, animations: 'disabled' })
        await page.getByRole('button', { name: text.bookTickets, exact: true }).click()
        await expect(page.locator('.booking-phone-dialog')).toBeVisible()
        await expect(page.locator('#booking-account-phone')).toBeFocused()
        await page.locator('#booking-account-phone').fill('123')
        await page.locator('.booking-phone-dialog button[type="submit"]').click()
        await expect(page.locator('.booking-phone-dialog [role="alert"]')).toBeVisible()
        await page.locator('#booking-account-phone').fill('900000991')
        await page.screenshot({ path: `${stem}-phone.png`, animations: 'disabled' })
        await page.locator('.booking-phone-dialog button[type="submit"]').click()
        await expect(page.locator('.ticket-confirmation')).toContainText('QA-ACCOUNT-991')
        await page.locator('.booking-focused-tabs').getByRole('link', { name: copy.account, exact: true }).click()
        await expect(page.locator('.account-bookings')).toContainText('QA-ACCOUNT-991')
        await page.locator('.profile-sub-tabs button').nth(1).click()
        await expect(page.locator('.profile-sub-tabs button[aria-pressed="true"]')).toHaveText(copy.loyalty)
        await expect(page.locator('.profile-sub-tabs .active')).toHaveText(copy.loyalty)
        await expect(page.locator('.account-loyalty-balance')).toHaveText((1250).toLocaleString(language))
        await contained(page)
        await page.screenshot({ path: `${stem}-loyalty.png`, fullPage: true, animations: 'disabled' })
        await page.locator('.profile-sub-tabs button').nth(2).click()
        await expect(page.locator('.profile-consent-panel')).toContainText(text.marketingConsent)
        await expect(page.locator('.profile-legal-panel a')).toHaveCount(3)
        await expect(page.locator('.profile-photo-panel, .driver-popover')).toHaveCount(0)
        await contained(page)
        await page.screenshot({ path: `${stem}-settings.png`, fullPage: true, animations: 'disabled' })
        expect(errors).toEqual([])
      })
    }
  }

  test(`${language}: guest can book without creating an account`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Guest language coverage uses one project.')
    const text = await loadTranslation(language)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await accountFixture(page, '', false)
    await page.addInitScript(lang => localStorage.setItem('vrena-language', lang), language)
    let writes = 0
    await page.route('**/api/bookings/tickets', async route => {
      writes++
      expect(route.request().headers().authorization).toBeUndefined()
      await route.fulfill({ json: { data: { session_id: '00000000-0000-4000-8000-000000000994', ticket_reference: 'QA-GUEST-LANGUAGE', ticket_total_price: 440000, ticket_status: 'confirmed' }, error: null } })
    })
    await page.goto('/tickets?venue=cafe-des-stagiaires')
    await page.locator('.ticket-control-date input').fill(futureDate(40))
    await page.locator('#ticket-available-time').selectOption('17:10')
    await page.getByRole('button', { name: text.bookTickets, exact: true }).click()
    await page.getByPlaceholder('0981152315').fill('0900000994')
    await page.locator('.guest-ticket-modal').getByRole('button', { name: text.guestTicketBookWithoutAccountCta, exact: true }).click()
    await page.locator('.guest-ticket-account-confirmation .secondary').first().click()
    await expect(page.locator('.ticket-confirmation')).toContainText('QA-GUEST-LANGUAGE')
    expect(writes).toBe(1)
    await contained(page)
  })
}
