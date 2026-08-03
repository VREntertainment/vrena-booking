import { expect, test, type Page } from '@playwright/test'

const TEST_EMAIL = 'player-login-interaction@vrena.local'
const TEST_PASSWORD = 'not-a-real-password'
const TEST_CAPTCHA_TOKEN = 'e2e-login-interaction-token'

async function stubDeferredHCaptcha(page: Page) {
  await page.route(/https:\/\/(js\.)?hcaptcha\.com\/1\/api\.js\?render=explicit/, async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        var hcaptchaToken = '';
        window.hcaptcha = {
          render: function (_container, options) {
            window.completeLoginInteractionCaptcha = function () {
              hcaptchaToken = '${TEST_CAPTCHA_TOKEN}';
              options.callback(hcaptchaToken);
            };
            return 'e2e-login-interaction-widget';
          },
          getResponse: function () {
            return hcaptchaToken;
          },
          reset: function () {
            hcaptchaToken = '';
          },
          remove: function () {}
        };
      `,
    })
  })
}

async function openPasswordStep(page: Page) {
  await page.goto('/profile')

  const emailInput = page.locator('.login-profile-form input[type="email"]')
  await emailInput.fill(TEST_EMAIL)
  await emailInput.press('Enter')

  await expect(page.locator('.auth-email-review')).toContainText(TEST_EMAIL)
  await expect(page.locator('.login-profile-form input[type="password"]')).toBeVisible()
  await page.waitForFunction(() => typeof (window as Window & { completeLoginInteractionCaptcha?: unknown }).completeLoginInteractionCaptcha === 'function')
}

async function completeCaptcha(page: Page) {
  await page.evaluate(() => {
    const complete = (window as Window & { completeLoginInteractionCaptcha?: () => void }).completeLoginInteractionCaptcha
    if (!complete) throw new Error('The deferred hCaptcha test callback is unavailable.')
    complete()
  })
}

function capturePasswordRequests(page: Page) {
  const bodies: Array<Record<string, unknown>> = []

  return page.route('**/auth/v1/token?grant_type=password', async (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      contentType: 'application/json',
      status: 400,
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'Expected test rejection.' }),
    })
  }).then(() => bodies)
}

test.describe('profile login interactions', () => {
  test('Enter advances the email step and submits a verified password', async ({ page }) => {
    await stubDeferredHCaptcha(page)
    const passwordRequests = await capturePasswordRequests(page)
    await openPasswordStep(page)

    await completeCaptcha(page)
    const passwordInput = page.locator('.login-profile-form input[type="password"]')
    await passwordInput.fill(TEST_PASSWORD)
    await passwordInput.press('Enter')

    await expect.poll(() => passwordRequests.length).toBe(1)
    expect(passwordRequests[0]?.gotrue_meta_security).toEqual({ captcha_token: TEST_CAPTCHA_TOKEN })
  })

  test('CAPTCHA completion submits when the password is already ready', async ({ page }) => {
    await stubDeferredHCaptcha(page)
    const passwordRequests = await capturePasswordRequests(page)
    await openPasswordStep(page)

    await page.locator('.login-profile-form input[type="password"]').fill(TEST_PASSWORD)
    await completeCaptcha(page)

    await expect.poll(() => passwordRequests.length).toBe(1)
    expect(passwordRequests[0]?.gotrue_meta_security).toEqual({ captcha_token: TEST_CAPTCHA_TOKEN })
  })
})
