import { expect, test } from '@playwright/test'
import { accountFixture } from './support/accountFixture'
import { loadTranslation } from '../lib/i18n/loadTranslation'

for (const language of ['en', 'vi', 'fr', 'ja', 'ko', 'zh'] as const) for (const venue of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
  test(`${language} ${venue}: website language overrides an older saved preference`, async ({ page }) => {
    await accountFixture(page, '', false)
    await page.addInitScript(() => localStorage.setItem('vrena-language', 'de'))
    const text = await loadTranslation(language)
    await page.goto(`/tickets?venue=${venue}&lang=${language === 'zh' ? 'zh-CN' : language}`)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.getByRole('button', { name: text.bookTickets, exact: true })).toBeVisible()
    await expect(page.locator('.booking-venue-option.active')).toContainText(venue === 'ha-do-centrosa' ? text.bookingVenueHaDoName : text.bookingVenueCafeName)
    expect(await page.evaluate(() => localStorage.getItem('vrena-language'))).toBe(language)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(new URL(page.url()).searchParams.get('venue')).toBe(venue)
  })
}

test('language can still be changed explicitly and persists through navigation', async ({ page }) => {
  await accountFixture(page, '', false)
  await page.goto('/tickets?venue=cafe-des-stagiaires&lang=fr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await page.locator('.language-picker > button').click()
  await page.locator('.language-menu').getByRole('button', { name: 'VI', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  await expect.poll(() => new URL(page.url()).searchParams.get('lang')).toBe('vi')
  await page.goto('/profile')
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
})

test('unsupported incoming language falls back safely to the saved selection', async ({ page }) => {
  await accountFixture(page, '', false)
  await page.addInitScript(() => localStorage.setItem('vrena-language', 'ja'))
  await page.goto('/tickets?venue=cafe-des-stagiaires&lang=not-a-language')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
})
