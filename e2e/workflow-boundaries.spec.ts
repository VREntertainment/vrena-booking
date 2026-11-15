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

test('HR feature sections render independently and remain contained', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await loginAsAdmin(page)
  await page.goto('/hr')
  await expect(page.getByTestId('staff-console')).toBeVisible()
  const sections = [
    ['Employee profile', '.staff-hr-employee-layout'],
    ['Calendar', '.staff-hr-schedule-stack'],
    ['Timesheet', '.staff-hr-timesheet-toolbar'],
    ['Payroll', '.staff-hr-accountant-workspace'],
    ['Bonuses', '.staff-attendance-form'],
    ['Debts & advances', '.staff-attendance-form'],
    ['Zalo Mini App', '.staff-zalo-settings'],
    ['HR settings', '.staff-hr-settings-shell'],
  ]
  for (const [name, selector] of sections) {
    const tab = page.locator('.staff-hr-module-rail').getByRole('button', { name: new RegExp(`^${name} `) })
    await tab.click()
    await expect(tab).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.staff-hr-content').locator(selector)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: `/tmp/vrena-workflows-hr-${testInfo.project.name}.png` })
  expect(errors).toEqual([])
})

