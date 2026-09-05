import { expect, type Page } from '@playwright/test'
import { e2eConfig } from './env'
import { totpCode } from './totp'

export const uniqueSessionName = () => `E2E Admin Session ${Date.now()}`

export function futureDate(daysFromToday = 14) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

export async function stubHCaptcha(page: Page) {
  await page.route(/https:\/\/(js\.)?hcaptcha\.com\/1\/api\.js\?render=explicit/, async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        var hcaptchaToken = 'e2e-hcaptcha-token';
        window.hcaptcha = {
          render: function (_container, options) {
            setTimeout(function () {
              if (options && typeof options.callback === 'function') {
                options.callback(hcaptchaToken);
              }
            }, 0);
            return 'e2e-hcaptcha-widget';
          },
          execute: function () {
            return Promise.resolve(hcaptchaToken);
          },
          getResponse: function () {
            return hcaptchaToken;
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
  await page.context().addCookies([{ name: 'vrena-cookie-consent', value: 'essential', url: e2eConfig().baseURL }])
  await page.goto('/profile')
  await page.locator('.login-profile-form .email-field input').fill(adminEmail)
  await page.locator('.login-profile-form .email-field input').press('Enter')
  await page.locator('.login-profile-form input[type="password"]').fill(adminPassword)
  await page.locator('.profile-auth-section .action-row button.primary').click()
  await expect(page.locator('.mfa-code-row input')).toBeVisible()
  const secret = process.env.E2E_ADMIN_TOTP_SECRET
  if (!secret) throw new Error('E2E_ADMIN_TOTP_SECRET is required for the dedicated test authenticator.')
  await page.locator('.mfa-code-row input').fill(totpCode(secret))
  await expect(page.locator('.mfa-code-row input')).toHaveCount(0)
  const welcome = page.getByRole('dialog', { name: /Welcome to VRena/ })
  await expect(welcome).toBeVisible()
  await welcome.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('button', { name: /log out/i })).toBeVisible()

}

export async function openAdmin(page: Page) {
  await page.goto('/admin')
  await expect(page.getByTestId('staff-console')).toBeVisible()
  await expect(page.getByRole('tablist', { name: /staff console/i })).toBeVisible()
}

export async function openCreateSession(page: Page) {
  await page.goto('/create-session')
  await expect(page.getByTestId('create-session-name')).toBeVisible()
}

export async function chooseCafeVenue(page: Page) {
  const selector = page.locator('.booking-venue-selector')
  await expect(selector).toBeVisible()
  const change = selector.getByRole('button', { name: /change/i })
  if (await change.isVisible()) await change.click()
  await selector.getByRole('radio').filter({ hasText: 'VRena Café des Stagiaires' }).click()
}
