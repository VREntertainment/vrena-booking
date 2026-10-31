import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { accountFixture } from './support/accountFixture'

const png = readFileSync('public/games/laser-tag.png')

test('name, surname, nickname and photo save and survive reload', async ({ page }) => {
  await accountFixture(page, '+84900000991')
  const writes: Record<string, unknown>[] = []
  page.on('request', request => {
    if (request.url().includes('/rest/v1/profiles?') && request.method() === 'PATCH') writes.push(request.postDataJSON())
  })
  let uploads = 0
  await page.route('**/storage/v1/object/avatars/**', route => {
    uploads++
    return route.fulfill({ json: { Key: 'avatars/fixture.png' } })
  })
  await page.route('**/_next/image?**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/storage/v1/object/public/avatars/**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.locator('#profile-name-input')).toHaveValue('Booking Tester')
  await expect(page.locator('#profile-surname-input')).toHaveValue('')
  await page.locator('#profile-name-input').fill('Émilie')
  await page.locator('#profile-surname-input').fill('Nguyễn')
  await page.locator('#profile-nickname-input').fill('Emi')
  await page.getByLabel('Change photo', { exact: true }).setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('.account-photo-preview img')).toHaveAttribute('src', /^blob:/)
  await page.locator('.profile-save-button').click()
  await expect(page.locator('.profile-save-button')).toHaveClass(/save-success/)
  expect(uploads).toBe(1)
  expect(writes.at(-1)).toMatchObject({ first_name: 'Émilie', last_name: 'Nguyễn', full_name: 'Émilie Nguyễn', nickname: 'Emi' })
  expect(writes.at(-1)?.avatar_url).toContain('/storage/v1/object/public/avatars/')
  await page.reload()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.locator('#profile-name-input')).toHaveValue('Émilie')
  await expect(page.locator('#profile-surname-input')).toHaveValue('Nguyễn')
  await expect(page.locator('#profile-nickname-input')).toHaveValue('Emi')
  await expect(page.locator('.account-photo-preview img')).toHaveAttribute('src', /avatars/)
  expect(await page.locator('.account-photo-preview img').evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: `/tmp/account-details-${test.info().project.name}.png`, fullPage: true })
})

test('photo upload failure preserves draft and allows retry', async ({ page }) => {
  await accountFixture(page, '+84900000991')
  let fail = true
  let writes = 0
  page.on('request', request => { if (request.url().includes('/rest/v1/profiles?') && request.method() === 'PATCH') writes++ })
  await page.route('**/storage/v1/object/avatars/**', route => fail
    ? route.fulfill({ status: 400, json: { message: 'Photo upload unavailable', error: 'Upload failed', statusCode: '400' } })
    : route.fulfill({ json: { Key: 'avatars/fixture.png' } }))
  await page.route('**/_next/image?**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/storage/v1/object/public/avatars/**', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Change photo', { exact: true }).setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: png })
  await page.locator('.profile-save-button').click()
  await expect(page.locator('#profile-save-status')).toContainText('Photo upload unavailable')
  expect(writes).toBe(0)
  await expect(page.locator('.account-photo-preview img')).toHaveAttribute('src', /^blob:/)
  fail = false
  await page.locator('.profile-save-button').click()
  await expect(page.locator('.profile-save-button')).toHaveClass(/save-success/)
  expect(writes).toBe(1)
})

test('invalid photos are rejected before upload', async ({ page }) => {
  await accountFixture(page, '+84900000991')
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Change photo', { exact: true }).setInputFiles({ name: 'script.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(page.locator('#profile-save-status')).not.toBeEmpty()
  await expect(page.locator('.account-photo-preview img')).toHaveCount(0)
  await expect(page.getByLabel('Change photo', { exact: true })).toHaveValue('')
})
