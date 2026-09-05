import { chromium, devices } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.PERFORMANCE_BASE_URL || 'http://127.0.0.1:3000'
const output = process.env.PERFORMANCE_OUTPUT || '/tmp/vrena-browser-performance.json'
const browser = await chromium.launch()
const measurements = []
try {
  for (const route of ['/tickets', '/sessions']) {
    for (let sample = 1; sample <= 3; sample += 1) {
      const context = await browser.newContext({ ...devices['Pixel 7'] })
      await context.addCookies([{ name: 'vrena-cookie-consent', value: 'essential', url: baseUrl }])
      const page = await context.newPage()
      const session = await context.newCDPSession(page)
      await session.send('Network.enable')
      await session.send('Network.setCacheDisabled', { cacheDisabled: true })
      await session.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8,
      })
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'load', timeout: 90_000 })
      await page.locator(route === '/tickets' ? '.ticket-form-panel' : '.sessions-section').waitFor({ state: 'visible' })
      // Observe the rendered first viewport after its initial images settle.
      await page.waitForFunction(() => [...document.images].filter((image) => {
        const rect = image.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < innerHeight
      }).every((image) => image.complete))
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0]
        const resources = performance.getEntriesByType('resource')
        return {
          responseStartMs: Math.round(nav.responseStart),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
          loadMs: Math.round(nav.loadEventEnd),
          firstContentfulPaintMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0),
          scriptTransferBytes: resources.filter((entry) => entry.initiatorType === 'script').reduce((sum, entry) => sum + entry.transferSize, 0),
          styleTransferBytes: resources.filter((entry) => entry.name.includes('.css')).reduce((sum, entry) => sum + entry.transferSize, 0),
          requestCount: resources.length,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        }
      })
      measurements.push({ route, sample, status: response?.status(), ...metrics })
      await context.close()
    }
  }
} finally {
  await browser.close()
}
const report = { baseUrl, measuredAt: new Date().toISOString(), conditions: 'Cold browser cache, Pixel 7 viewport, 4x CPU slowdown, 1.6 Mbps down, 150 ms latency; synthetic measurements, not field Core Web Vitals.', measurements }
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
