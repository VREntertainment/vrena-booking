import { expect, test } from '@playwright/test'
import { loginAsAdmin, openAdmin } from './support/admin'

test('staff touch controls and payment splits fit phone and tablet widths', async ({ page }) => {
  await loginAsAdmin(page)
  await openAdmin(page)
  const staff = page.getByTestId('staff-console')
  for (const width of [320, 360, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(staff.getByRole('button', { name: 'Add split', exact: true })).toBeVisible()
    await staff.getByRole('button', { name: 'Add split', exact: true }).click()
    const remove = staff.locator('.staff-payment-remove').last()
    const controls = staff.locator('.staff-tabs-scroll-button, .staff-payment-add, .staff-payment-remove, .staff-phone-control .country-button')
    for (const control of await controls.all()) {
      const rect = await control.boundingBox()
      expect(rect?.width, `${width}px target width`).toBeGreaterThanOrEqual(44)
      expect(rect?.height, `${width}px target height`).toBeGreaterThanOrEqual(44)
    }
    await remove.click()
    const phone = staff.getByRole('textbox', { name: 'Phone', exact: true })
    await expect(phone).toHaveCSS('font-size', '16px')
    expect((await phone.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await staff.getByRole('button', { name: 'Booking time', exact: true }).click()
    const time = staff.getByRole('textbox', { name: 'Booking time: type a specific time', exact: true })
    await expect(time).toHaveCSS('font-size', '16px')
    await time.fill('10:30')
    await time.press('Enter')
    await expect(staff.getByRole('button', { name: 'Booking time', exact: true })).toHaveText('10:30')
  }
})
