import { defineConfig, devices } from '@playwright/test'
import { assertNonProductionUrl } from './e2e/support/env'

const localBaseURL = process.env.E2E_LOCAL_HOST === 'localhost' ? 'http://localhost:3000' : 'http://127.0.0.1:3000'
const baseURL = process.env.E2E_BASE_URL || localBaseURL
const bookingDeviceMatrix = process.env.E2E_BOOKING_DEVICE_MATRIX === '1'
const enableWebKit = process.env.E2E_ENABLE_WEBKIT === '1'
assertNonProductionUrl(baseURL)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  // The local suite shares one MFA account. Concurrent AAL1 -> AAL2 logins
  // can revoke each other's pending sessions inside GoTrue. Keep real MFA enabled
  // and serialize the browser tests instead of bypassing authentication.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  outputDir: process.env.E2E_OUTPUT_DIR || '/tmp/vrena-e2e-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: process.env.E2E_REPORT_DIR || '/tmp/vrena-e2e-report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
      command: process.env.E2E_PRODUCTION_BUILD === '1'
        ? 'npm run start -- --hostname 127.0.0.1 --port 3000'
        : 'npm run dev -- --hostname 127.0.0.1 --port 3000',
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  projects: bookingDeviceMatrix ? [
    { name: 'windows-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'macos-safari', use: { ...devices['Desktop Safari'] } },
    { name: 'ipados-safari', use: { ...devices['iPad Pro 11'] } },
    { name: 'ios-safari', use: { ...devices['iPhone 13'] } },
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'samsung-a26', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 892 }, deviceScaleFactor: 2.625 } },
    { name: 'samsung-a26-compact', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 }, deviceScaleFactor: 3 } },
    { name: 'samsung-a26-landscape', use: { ...devices['Pixel 7'], viewport: { width: 892, height: 412 }, deviceScaleFactor: 2.625 } },
    { name: 'galaxy-fold-cover', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 872 } } },
    { name: 'galaxy-fold-open', use: { ...devices['Pixel 7'], viewport: { width: 768, height: 900 } } },
  ] : [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile-chrome-android',
      use: {
        ...devices['Pixel 7'],
      },
    },
    ...(enableWebKit
      ? [{
        name: 'webkit',
        use: {
          ...devices['Desktop Safari'],
        },
      }]
      : []),
  ],
})
