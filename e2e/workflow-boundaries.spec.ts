import { expect, test } from '@playwright/test'
import { futureDate, loginAsAdmin, openAdmin } from './support/admin'

test('staff draft survives switching independently loaded workflows', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loginAsAdmin(page)
  await openAdmin(page)
  const tabs = page.getByRole('tablist', { name: 'Staff Console', exact: true })
  await tabs.getByRole('tab', { name: 'New Booking', exact: true }).click()
  const draftDate = futureDate(4)
  await page.locator('#staff-booking-customer-name').fill('Unsaved workflow draft')
  await page.locator('.staff-console input[type="date"]').first().fill(draftDate)
  for (const name of ['Today', 'Orders', 'Report']) {
    await tabs.getByRole('tab', { name, exact: true }).click()
    await expect(tabs.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.staff-console')).not.toContainText('Loading VRena')
  }
  await tabs.getByRole('tab', { name: 'New Booking', exact: true }).click()
  await expect(page.locator('#staff-booking-customer-name')).toHaveValue('Unsaved workflow draft')
  await expect(page.locator('.staff-console input[type="date"]').first()).toHaveValue(draftDate)
  expect(errors).toEqual([])
})

test('employee access shows the access fields and keeps Zalo settings available', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loginAsAdmin(page)
  await page.goto('/hr')
  await expect(page.getByRole('heading', { name: 'Employee Access', exact: true })).toBeVisible()
  await expect(page.getByLabel('Full name', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Contract end date and PIN expiry', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Store access level', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Payroll', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Zalo Mini App', exact: true }).click()
  await expect(page.locator('.staff-zalo-settings')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})
