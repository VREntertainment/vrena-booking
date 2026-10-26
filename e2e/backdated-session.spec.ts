import { expect, test } from '@playwright/test'
import { futureDate, loginAsAdmin, openCreateSession, uniqueSessionName } from './support/admin'

test('Create Session saves a past date without requesting an insert representation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Run the data-mutating flow once.')
  await loginAsAdmin(page)
  await openCreateSession(page)
  await page.getByTestId('create-session-name').fill(uniqueSessionName())
  await page.locator('#create-session-form input[type="date"][aria-label="Date"]').fill(futureDate(-20))
  const time = page.getByTestId('create-session-time')
  await expect(time.locator('option:not([value=""])').first()).toBeAttached()
  await time.selectOption((await time.locator('option:not([value=""])').first().getAttribute('value'))!)
  const saved = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/rest/v1/sessions')
  await page.getByTestId('create-session-submit').click()
  const response = await saved
  expect(response.status()).toBe(201)
  expect(new URL(response.url()).searchParams.has('select')).toBe(false)
  expect(response.request().headers().prefer || '').not.toContain('return=representation')
  expect(response.request().postDataJSON().id).toMatch(/^[0-9a-f-]{36}$/)
  await expect(page.getByTestId('create-session-submit')).toHaveCount(0)
})
