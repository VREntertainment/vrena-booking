import { expect, test } from '@playwright/test'
import { futureDate, loginAsAdmin, openAdmin, openCreateSession, uniqueSessionName } from './support/admin'

test.describe('admin flows', () => {
  test('admin login', async ({ page }) => {
    await loginAsAdmin(page)

    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
  })

  test('access to /admin', async ({ page }) => {
    await loginAsAdmin(page)
    await openAdmin(page)

    await expect(page.getByRole('tablist', { name: /staff console/i })).toBeVisible()
  })

  test('creating and editing a session', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Run the data-mutating session flow once on desktop Chromium.')

    const sessionName = uniqueSessionName()
    const editedSessionName = `${sessionName} Edited`

    await loginAsAdmin(page)
    await openCreateSession(page)

    await page.getByTestId('create-session-name').fill(sessionName)
    await page.locator('#create-session-form input[type="date"][aria-label="Date"]').fill(futureDate(2))

    const timeSelect = page.getByTestId('create-session-time')
    await expect(timeSelect.locator('option:not([value=""])').first()).toBeAttached()
    const firstAvailableTime = await timeSelect.locator('option:not([value=""])').first().getAttribute('value')
    expect(firstAvailableTime).toBeTruthy()

    await timeSelect.selectOption(firstAvailableTime!)
    await page.getByTestId('create-session-duration').selectOption('40')
    await page.getByTestId('create-session-max-players').selectOption('6')
    await page.getByTestId('create-session-submit').click()

    await expect(page.getByRole('heading', { name: sessionName })).toBeVisible()

    // Session management is intentionally available only in the staff workspace.
    await openAdmin(page)
    await page.getByRole('tablist', { name: 'Staff Console', exact: true }).getByRole('tab', { name: 'Today', exact: true }).click()
    await page.getByLabel('Operations date', { exact: true }).fill(futureDate(2))
    const sessionCard = page.locator('article.staff-operation-session').filter({ hasText: sessionName }).first()
    await sessionCard.getByRole('button', { name: 'Edit', exact: true }).click()
    await sessionCard.getByLabel('Name', { exact: true }).fill(editedSessionName)
    await sessionCard.getByLabel('Name', { exact: true }).press('Tab')
    await expect(page.locator('.staff-operation-title-row').getByText(editedSessionName, { exact: true })).toBeVisible()
    await page.reload()
    await page.getByRole('tablist', { name: 'Staff Console', exact: true }).getByRole('tab', { name: 'Today', exact: true }).click()
    await page.getByLabel('Operations date', { exact: true }).fill(futureDate(2))
    await expect(page.locator('.staff-operation-title-row').getByText(editedSessionName, { exact: true })).toBeVisible()
  })

  test('staff and admin-only UI is visible for admin', async ({ page }) => {
    await loginAsAdmin(page)
    await openAdmin(page)

    const staffConsole = page.getByTestId('staff-console')
    await expect(staffConsole.getByRole('tab', { name: /New Booking/i })).toBeVisible()
    await expect(staffConsole.getByRole('tab', { name: /Roles/i })).toBeVisible()
    await expect(staffConsole.getByRole('tab', { name: /Prices/i })).toBeVisible()
  })

  test('mobile Android admin pages are readable and contained', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome-android', 'Android viewport check runs on the mobile Chrome project.')

    await loginAsAdmin(page)
    await openAdmin(page)

    await expect(page.getByTestId('staff-console')).toBeVisible()
    await expect(page.getByRole('tablist', { name: /Staff Console/i })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('reporting and typed HR screens load without browser errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await loginAsAdmin(page)
    await openAdmin(page)
    await page.getByRole('tab', { name: 'Report', exact: true }).click()
    await expect(page.locator('.staff-report-workspace')).toBeVisible()
    await page.goto('/hr')
    await expect(page.getByTestId('staff-console')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Employee profile/ })).toBeVisible()
    await page.getByRole('button', { name: /^HR settings/ }).click()
    await expect(page.getByRole('button', { name: /^HR settings/ })).toHaveClass(/active/)
    expect(errors).toEqual([])
    await page.screenshot({ path: `/tmp/vrena-hr-${test.info().project.name}.png` })
  })
})
