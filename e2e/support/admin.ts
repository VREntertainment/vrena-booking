import { expect, type Page } from '@playwright/test'
import { e2eConfig } from './env'

export const uniqueSessionName = () => `E2E Admin Session ${Date.now()}`

export function futureDate(daysFromToday = 14) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

export async function stubHCaptcha(page: Page) {
  await page.route('https://js.hcaptcha.com/1/api.js?render=explicit', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.hcaptcha = {
          render: function (_container, options) {
            setTimeout(function () {
              if (options && typeof options.callback === 'function') {
                options.callback('e2e-hcaptcha-token');
              }
            }, 0);
            return 'e2e-hcaptcha-widget';
          },
          reset: function () {},
          remove: function () {}
        };
      `,
    })
  })
}

export async function loginAsAdmin(page: Page) {
  const { adminEmail, adminPassword } = e2eConfig()

  await stubHCaptcha(page)
  await page.goto('/book')

  await page.locator('.profile-chip').click()
  const profileSection = page.locator('section').filter({ has: page.getByRole('heading', { name: /profile/i }) }).first()
  await expect(profileSection).toBeVisible()
  await expect(profileSection.locator('.captcha-box')).toBeVisible()
  await page.waitForFunction(() => Boolean((window as Window & { hcaptcha?: unknown }).hcaptcha))

  await profileSection.locator('input[type="email"]').fill(adminEmail)
  await profileSection.locator('input[type="password"]').fill(adminPassword)
  await profileSection.getByRole('button', { name: /^Log In$/i }).last().click()

  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()
}

export async function openAdmin(page: Page) {
  await page.goto('/admin')
  await expect(page.getByTestId('staff-console')).toBeVisible()
  await expect(page.getByRole('heading', { name: /staff console/i })).toBeVisible()
}

export async function openCreateSession(page: Page) {
  await page.goto('/book')
  await page.getByRole('button', { name: /^Sessions$/i }).click()
  await page.getByRole('button', { name: /^Create Session$/i }).click()
  await expect(page.getByRole('heading', { name: /^Create Session$/i })).toBeVisible()
}
