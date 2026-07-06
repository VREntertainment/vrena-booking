import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = new URL('..', import.meta.url)
const css = await readFile(new URL('app/globals.css', root), 'utf8')
const outputDir = process.env.THEME_AUDIT_OUTPUT_DIR || '/tmp/vrena-theme-audit'
const baseUrl = process.env.THEME_AUDIT_BASE_URL || ''

const devices = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 720 },
]

const themes = ['light', 'dark']
const routePaths = ['/', '/profile', '/tickets', '/sessions', '/clubs', '/hall-of-fame']

const fixture = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${css}</style>
  </head>
  <body>
    <div class="app">
      <section class="section profile-account-section profile-account-section-unframed">
        <form class="profile-form profile-account-form">
          <div class="profile-account-hero">
            <div class="profile-photo-preview"></div>
            <div class="profile-identity-copy">
              <strong>Theme Audit Player</strong>
              <span>Reusable signed-in profile fixture</span>
            </div>
          </div>
          <div class="country-phone-field">
            <label class="country-phone-label">Phone Number <span class="required">*</span></label>
            <div class="country-field">
              <div class="country-picker">
                <button class="country-button" type="button">+84</button>
                <div class="country-menu">
                  <input placeholder="Search country">
                  <div class="country-list">
                    <button type="button"><span>+84</span><strong>Vietnam</strong></button>
                  </div>
                </div>
              </div>
            </div>
            <div class="phone-field"><input aria-label="Phone Number" value="0981152315"></div>
          </div>
          <div class="email-field"><label>E-mail</label><input type="email" value="theme@vrena.local"></div>
          <div class="name-field"><label>Name</label><input value="Theme Audit Player"></div>
          <div class="birthday-field">
            <label>Birthday</label>
            <div class="date-input-shell">
              <input class="date-input-native" type="date" value="1990-01-01">
              <span class="date-input-display">01/01/1990</span>
            </div>
          </div>
          <div class="motto-field"><label>Mantra / Mood</label><input value="Future Champion"></div>
          <div class="marketing-consent-field"><strong>Marketing</strong><small>Optional updates</small></div>
        </form>
        <div class="profile-security-panel">
          <div class="profile-card-section-title">Security</div>
          <div class="account-links">
            <a class="link-button" href="#">Privacy</a>
            <a class="link-button danger-link" href="#">Delete</a>
          </div>
        </div>
      </section>
      <section class="section tickets-section">
        <div class="ticket-price-summary">
          <div><span>Subtotal</span><strong>100,000 VND</strong></div>
          <div><span>Total</span><strong>100,000 VND</strong></div>
        </div>
        <div class="rich-note-editor" contenteditable="true" data-placeholder="Notes"></div>
      </section>
      <section class="section sessions-section">
        <div class="session-retention-card">
          <div class="session-retention-card-icon">VR</div>
          <div class="session-retention-card-copy">
            <strong>Upcoming session</strong>
            <span>Check day chips, cards, fields, and action controls.</span>
          </div>
          <button class="session-retention-card-cta" type="button">Open</button>
        </div>
      </section>
    </div>
  </body>
</html>`

async function auditFixture(page, theme, device) {
  await page.setViewportSize({ width: device.width, height: device.height })
  await page.emulateMedia({ colorScheme: theme })
  await page.setContent(fixture, { waitUntil: 'domcontentloaded' })

  const result = await page.evaluate((currentTheme) => {
    const watchedSelectors = [
      '.profile-account-form .country-phone-field',
      '.profile-account-form .country-button',
      '.profile-account-form .country-menu',
      '.profile-account-form input',
      '.profile-account-form .date-input-shell',
      '.profile-security-panel',
      '.profile-security-panel .link-button',
      '.ticket-price-summary > div',
      '.rich-note-editor',
      '.session-retention-card-cta',
    ]

    const watched = watchedSelectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).map((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return {
          selector,
          background: style.backgroundColor,
          color: style.color,
          borderColor: style.borderColor,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      })
    )

    const darkLightLeaks = currentTheme === 'dark'
      ? watched.filter((item) => [
          'rgb(255, 255, 255)',
          'rgb(248, 250, 251)',
          'rgb(246, 248, 250)',
          'rgb(240, 244, 246)',
        ].includes(item.background))
      : []

    return {
      viewport: { width: innerWidth, height: innerHeight },
      overflow: document.documentElement.scrollWidth > innerWidth,
      darkLightLeaks,
      watched,
    }
  }, theme)

  const screenshot = path.join(outputDir, `fixture-${device.name}-${theme}.png`)
  await writeFile(screenshot, await page.screenshot({ fullPage: false }))

  return {
    name: `fixture:${device.name}:${theme}`,
    screenshot,
    ...result,
    ok: !result.overflow && result.darkLightLeaks.length === 0,
  }
}

async function auditRoute(page, theme, device, routePath) {
  const url = new URL(routePath, baseUrl).toString()
  await page.setViewportSize({ width: device.width, height: device.height })
  await page.emulateMedia({ colorScheme: theme })
  await page.goto(url, { waitUntil: 'domcontentloaded' })

  const result = await page.evaluate(() => {
    const bodyText = document.body.innerText.trim()
    const overlay = document.body.innerText.includes('Unhandled Runtime Error') ||
      document.body.innerText.includes('Build Error') ||
      document.querySelector('[data-nextjs-dialog-overlay]') !== null

    return {
      title: document.title,
      bodyTextLength: bodyText.length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      overlay,
      firstHeading: document.querySelector('h1, h2')?.textContent?.trim() || '',
    }
  })

  return {
    name: `route:${routePath}:${device.name}:${theme}`,
    url,
    ...result,
    ok: result.bodyTextLength > 0 && !result.overflow && !result.overlay,
  }
}

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const results = []

for (const device of devices) {
  for (const theme of themes) {
    results.push(await auditFixture(page, theme, device))
  }
}

if (baseUrl) {
  for (const routePath of routePaths) {
    for (const device of devices) {
      for (const theme of themes) {
        results.push(await auditRoute(page, theme, device, routePath))
      }
    }
  }
}

await browser.close()

const failures = results.filter((result) => !result.ok)
const summary = {
  command: baseUrl
    ? `THEME_AUDIT_BASE_URL=${baseUrl} npm run verify:theme`
    : 'npm run verify:theme',
  outputDir,
  checked: results.length,
  failures: failures.map((failure) => ({
    name: failure.name,
    overflow: failure.overflow,
    darkLightLeaks: failure.darkLightLeaks?.map((item) => ({
      selector: item.selector,
      background: item.background,
    })),
    overlay: failure.overlay,
    bodyTextLength: failure.bodyTextLength,
  })),
}

console.log(JSON.stringify(summary, null, 2))

if (failures.length > 0) {
  process.exitCode = 1
}
