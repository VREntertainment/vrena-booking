import { expect, test } from '@playwright/test'
import { CUSTOMER_SOCIAL_FEATURES_ENABLED } from '../lib/customerExperience'
import { customerBookingDurations } from '../lib/customerBookingDurations'
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
    await page.getByTestId('create-session-duration').selectOption(String(customerBookingDurations(futureDate(2))[1]))
    await page.getByTestId('create-session-max-players').selectOption('6')
    await page.getByTestId('create-session-submit').click()

    if (CUSTOMER_SOCIAL_FEATURES_ENABLED) await expect(page.getByRole('heading', { name: sessionName })).toBeVisible()
    else await expect(page.getByTestId('staff-console')).toBeVisible()

    // Session management is intentionally available only in the staff workspace.
    await openAdmin(page)
    await page.getByRole('tablist', { name: 'Staff Console', exact: true }).getByRole('tab', { name: 'Today', exact: true }).click()
    await page.getByLabel('Operations date', { exact: true }).fill(futureDate(2))
    await expect(page.getByRole('table', { name: 'Sessions', exact: true }).getByRole('columnheader', { name: 'Balance due' })).toBeAttached()
    const scope = page.getByLabel(/^Sessions ·/)
    await scope.click()
    await expect(page.getByRole('button', { name: 'Past', exact: true })).toBeVisible()
    await scope.press('Escape')
    const sessionCard = page.locator('[data-operation-session]').filter({ hasText: sessionName }).first()
    await sessionCard.getByRole('button', { name: 'Visit details', exact: true }).click()
    await sessionCard.getByLabel('Name', { exact: true }).fill(editedSessionName)
    await sessionCard.getByLabel('Name', { exact: true }).press('Tab')
    await expect(page.locator('[data-operation-session]').getByText(editedSessionName, { exact: true })).toBeVisible()
    await page.reload()
    await page.getByRole('tablist', { name: 'Staff Console', exact: true }).getByRole('tab', { name: 'Today', exact: true }).click()
    await page.getByLabel('Operations date', { exact: true }).fill(futureDate(2))
    await expect(page.locator('[data-operation-session]').getByText(editedSessionName, { exact: true })).toBeVisible()
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

  test('reporting and employee access screens load without browser errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await loginAsAdmin(page)
    await openAdmin(page)
    await page.getByRole('tab', { name: 'Report', exact: true }).click()
    const report = page.locator('.staff-report-workspace')
    await expect(report.getByRole('tab', { name: 'Business performance' })).toHaveAttribute('aria-selected', 'true')
    await expect(report.getByRole('heading', { name: 'Business performance' })).toHaveCount(0)
    await expect(report.getByRole('tab', { name: 'Player behavior', exact: true })).toHaveCount(0)
    const dateMenu = report.getByLabel(/^Date range ·/)
    await dateMenu.click()
    for (const name of ['Today', 'This week', 'Last week', 'This month', 'Last 30 days', 'Custom range']) {
      await expect(report.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await dateMenu.press('Escape')
    await expect(report.getByRole('heading', { name: 'Peak booking slots' })).toBeVisible()
    await expect(report.getByRole('heading', { name: 'Most-played games' })).toBeVisible()
    const orders = report.getByRole('table', { name: 'Orders', exact: true })
    await expect(orders.getByRole('columnheader', { name: 'Balance due', exact: true })).toBeAttached()
    await expect(orders.getByRole('columnheader', { name: 'Session time', exact: true })).toBeAttached()
    const venues = report.getByLabel(/^Venue ·/)
    await venues.click()
    await expect(report.getByRole('checkbox', { name: 'All accessible venues' })).toBeVisible()
    await report.getByRole('checkbox', { name: 'All accessible venues' }).uncheck()
    await report.getByRole('checkbox', { name: 'Hà Đô Centrosa' }).check()
    await expect(report.getByLabel('Venue · Hà Đô Centrosa', { exact: true })).toBeVisible()
    await venues.press('Escape')
    await report.getByLabel('Metric', { exact: true }).selectOption('paidPlayers')
    await expect(report.getByRole('slider', { name: 'Paid players', exact: true })).toBeVisible()
    const desktop = page.viewportSize()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(report.getByRole('heading', { name: 'Venue comparison' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (desktop) await page.setViewportSize(desktop)
    await page.emulateMedia({ colorScheme: null })
    const summary = { activeCodes: 0, latestScanAt: null, topQrCode: null, trackedCodes: 0, totalCodes: 0, totalScans: 0 }
    await page.route('**/api/staff/reports/qr-analytics?*', route => route.fulfill({ json: {
      summary, comparisonSummary: summary, qrCodes: [], scanSeries: [], deviceMix: [], timezone: 'Asia/Ho_Chi_Minh',
    } }))
    await report.getByRole('tab', { name: 'QR analytics', exact: true }).click()
    await expect(report.getByRole('heading', { name: 'Scan trend', exact: true })).toBeVisible()
    await expect(report.locator('.staff-qr-analytics:not(.loading)')).toBeVisible()
    await page.goto('/hr')
    await expect(page.getByTestId('staff-console')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Employee Access', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add employee', exact: true })).toBeVisible()
    expect(errors).toEqual([])
    await page.screenshot({ path: `/tmp/vrena-hr-${test.info().project.name}.png` })
  })
})
