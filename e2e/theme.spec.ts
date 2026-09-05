import { test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

test('public routes and profile fixtures fit light and dark phone, tablet, and desktop layouts', async ({ baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'The theme runner covers all three viewport sizes itself.')
  test.setTimeout(180_000)
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/verify-theme-surfaces.mjs'], {
    env: { ...process.env, THEME_AUDIT_BASE_URL: baseURL },
    timeout: 170_000,
  })
  await testInfo.attach('theme-checks.json', { body: stdout, contentType: 'application/json' })
})
