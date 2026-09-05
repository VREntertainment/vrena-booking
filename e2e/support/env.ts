const productionHostPatterns = [
  /(^|\.)vrena-booking\.vercel\.app$/i,
  /(^|\.)vre-vietnam\.com$/i,
]

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required for E2E tests. Use a dedicated staging/test admin account.`)
  }
  return value
}

export function e2eConfig() {
  const baseURL = process.env.E2E_BASE_URL?.trim() || 'http://127.0.0.1:3000'
  assertNonProductionUrl(baseURL)
  const adminEmail = requiredEnv('E2E_ADMIN_EMAIL')
  const adminPassword = requiredEnv('E2E_ADMIN_PASSWORD')

  if (adminEmail.endsWith('@example.com') || ['password', 'changeme', 'example'].includes(adminPassword.toLowerCase())) {
    throw new Error('E2E admin credentials look like placeholders. Use a dedicated non-production admin user.')
  }

  return { adminEmail, adminPassword, baseURL }
}

export function assertNonProductionUrl(baseURL: string) {
  const url = new URL(baseURL)

  if (productionHostPatterns.some((pattern) => pattern.test(url.hostname))) {
    throw new Error(`E2E_BASE_URL points to a production host (${url.hostname}). Use local, preview, or staging only.`)
  }

  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && process.env.E2E_ALLOW_REMOTE_STAGING !== '1') {
    throw new Error('Remote browser tests require E2E_ALLOW_REMOTE_STAGING=1 and a dedicated staging backend.')
  }
}
