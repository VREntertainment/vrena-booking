import { defineConfig, devices } from '@playwright/test'
import { assertNonProductionUrl } from './e2e/support/env'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
const enableWebKit = process.env.E2E_ENABLE_WEBKIT === '1'
assertNonProductionUrl(baseURL)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 2,
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
  projects: [
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
