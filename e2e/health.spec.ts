import { expect, test } from '@playwright/test'

test('service readiness includes database and authentication', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok', checks: { database: 'ok', auth: 'ok' } })
})

test('public pages hydrate without browser errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|cannot contain|cannot be a child/i.test(message.text())) errors.push(message.text())
  })
  for (const route of ['/tickets', '/sessions', '/profile']) {
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('.app')).toBeVisible()
  }
  expect(errors).toEqual([])
})
