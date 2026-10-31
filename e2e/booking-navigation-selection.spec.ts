import { expect, test } from '@playwright/test'
import { accountFixture } from './support/accountFixture'

for (const colorScheme of ['light', 'dark'] as const) for (const device of [
  { name: 'mobile', width: 393, height: 852 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'laptop', width: 1440, height: 900 },
]) {
  test(`${colorScheme} ${device.name}: only the current navigation destination is highlighted`, async ({ page }) => {
    await accountFixture(page, '+84900000991')
    await page.setViewportSize(device)
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto('/profile')
    const nav = page.locator('.booking-focused-tabs')
    const book = nav.getByRole('link', { name: 'Book now', exact: true })
    const account = nav.getByRole('link', { name: 'My account', exact: true })
    await expect(nav.locator('[aria-current="page"]')).toHaveText('My account')
    await expect(account).toHaveClass(/active/)
    await expect(book).not.toHaveClass(/active/)
    await expect(book).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(book).toHaveCSS('box-shadow', 'none')
    expect(await account.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
    await expect(page.locator('.account-booking-heading button.primary')).toBeVisible()
    await page.screenshot({ path: `/tmp/booking-navigation-${colorScheme}-${device.name}.png`, fullPage: true, animations: 'disabled' })
    await book.click()
    await expect(nav.locator('[aria-current="page"]')).toHaveText('Book now')
    await expect(account).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(account).toHaveCSS('box-shadow', 'none')
    await expect(page.getByRole('button', { name: 'Reserve your slot', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}
