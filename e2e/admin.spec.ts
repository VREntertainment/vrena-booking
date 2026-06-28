import { expect, test } from '@playwright/test'
import { futureDate, loginAsAdmin, openAdmin, openCreateSession, uniqueSessionName } from './support/admin'

test.describe('admin flows', () => {
  test('admin login', async ({ page }) => {
    await loginAsAdmin(page)

    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /staff/i })).toBeVisible()
  })

  test('access to /admin', async ({ page }) => {
    await loginAsAdmin(page)
    await openAdmin(page)

    await expect(page.getByTestId('staff-console')).toContainText(/Staff Console/i)
  })

  test('creating and editing a session', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Run the data-mutating session flow once on desktop Chromium.')

    const sessionName = uniqueSessionName()
    const editedSessionName = `${sessionName} Edited`

    await loginAsAdmin(page)
    await openCreateSession(page)

    await page.getByTestId('create-session-name').fill(sessionName)
    await page.locator('#create-session-form input[type="date"][aria-label="Date"]').fill(futureDate())

    const timeSelect = page.getByTestId('create-session-time')
    await expect(timeSelect.locator('option:not([value=""])').first()).toBeAttached()
    const firstAvailableTime = await timeSelect.locator('option:not([value=""])').first().getAttribute('value')
    expect(firstAvailableTime).toBeTruthy()

    await timeSelect.selectOption(firstAvailableTime!)
    await page.getByTestId('create-session-duration').selectOption('40')
    await page.getByTestId('create-session-max-players').selectOption('6')
    await page.getByTestId('create-session-submit').click()

    await expect(page.getByText(/Session created/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: sessionName })).toBeVisible()

    const sessionCard = page.locator('article.session').filter({ hasText: sessionName }).first()
    await sessionCard.getByRole('button', { name: /Expand/i }).click()
    await sessionCard.getByRole('button', { name: /Edit Session/i }).click()
    await sessionCard.getByTestId('edit-session-name').fill(editedSessionName)
    await sessionCard.getByTestId('edit-session-submit').click()

    await expect(page.getByText(/Session updated/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: editedSessionName })).toBeVisible()
  })

  test('staff and admin-only UI is visible for admin', async ({ page }) => {
    await loginAsAdmin(page)
    await openAdmin(page)

    const staffConsole = page.getByTestId('staff-console')
    await expect(staffConsole.getByRole('button', { name: /New Booking/i })).toBeVisible()
    await expect(staffConsole.getByRole('button', { name: /Roles/i })).toBeVisible()
    await expect(staffConsole.getByRole('button', { name: /Prices/i })).toBeVisible()
  })

  test('mobile Android admin pages are readable and contained', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome-android', 'Android viewport check runs on the mobile Chrome project.')

    await loginAsAdmin(page)
    await openAdmin(page)

    await expect(page.getByTestId('staff-console')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Staff Console/i })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(hasHorizontalOverflow).toBe(false)
  })
})
