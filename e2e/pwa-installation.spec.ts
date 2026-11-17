import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './support/admin'

test('public and staff pages advertise the correct online-only install entry', async ({ page, request }) => {
  await loginAsAdmin(page)
  for (const [path, manifestPath, start] of [
    ['/tickets', '/manifest.webmanifest', '/tickets'],
    ['/staff', '/staff.webmanifest', '/staff'],
    ['/create-session?mode=calendar', '/staff.webmanifest', '/staff'],
  ]) {
    await page.goto(path)
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', manifestPath)
    const response = await request.get(manifestPath)
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('manifest')
    const manifest = await response.json()
    expect(manifest.start_url).toBe(start)
    expect(manifest.display).toBe('standalone')
    expect(manifest.scope).toBe('/')
    for (const icon of manifest.icons) {
      const image = await request.get(icon.src)
      expect(image.ok()).toBe(true)
      const png = await image.body()
      expect(png.readUInt32BE(16)).toBe(Number(icon.sizes.split('x')[0]))
    }
  }
})

test('installation does not supply an offline booking application', async ({ page, context }) => {
  await page.goto('/tickets')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await context.setOffline(true)
  try {
    let failed = false
    try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }) } catch { failed = true }
    expect(failed).toBe(true)
  } finally { await context.setOffline(false) }
})
