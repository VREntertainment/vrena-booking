import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { globSync } from 'node:fs'
import { createHash } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const officialPaletteFile = 'docs/brand/vrena-ui-color-palette-official.svg'
const officialPaletteChecksum = 'ee18f5f6a58d239faf2156a9dae0988ca26b9b8b268ad802f288b56531e4e0a7'
const requiredOfficialTokens = [
  '--vrena-cta-gradient-cool: linear-gradient(90deg, #00ffea 0%, #109fff 100%)',
  '--vrena-cta-gradient-warm: linear-gradient(90deg, #ffb800 0%, #fd5901 100%)',
  '--vrena-cta-primary: var(--vrena-purple-500)',
  '--vrena-cta-primary-hover: color-mix(in srgb, var(--vrena-purple-500) 92%, var(--vrena-neutral-950))',
  '--vrena-cta-primary-pressed: color-mix(in srgb, var(--vrena-purple-500) 84%, var(--vrena-neutral-950))',
  '--vrena-cta-primary-ink: var(--vrena-white)',
  '--vrena-cta-primary: var(--vrena-orange-600)',
  '--vrena-cta-primary-hover: color-mix(in srgb, var(--vrena-orange-600) 92%, var(--vrena-neutral-950))',
  '--vrena-cta-primary-pressed: color-mix(in srgb, var(--vrena-orange-600) 84%, var(--vrena-neutral-950))',
  '--vrena-cta-primary-ink: var(--vrena-neutral-950)',
  '--vrena-mode-accent: var(--vrena-purple-500)',
  '--vrena-selection-bg: var(--vrena-purple-50)',
  '--vrena-selection-indicator: var(--vrena-purple-500)',
  '--vrena-decorative-gradient: var(--vrena-logo-gradient-cool)',
  '--vrena-status-warning-bg: var(--vrena-yellow-50)',
  '--vrena-cta-secondary-ink: var(--vrena-purple-600)',
  '--vrena-cta-tertiary-ink: var(--vrena-purple-600)',
  '--vrena-focus-halo: var(--vrena-cyan-700)',
]

const retiredTokenPatterns = [
  /--vrena-brand-cyan\b/,
  /--vrena-brand-deep\b/,
  /--vrena-brand-gradient(?:-reverse)?\b/,
  /var\(--vrena-cta\)/,
  /var\(--vrena-cta-ink\)/,
]

const officialPaletteSource = await readFile(path.join(root, officialPaletteFile))
const actualPaletteChecksum = createHash('sha256').update(officialPaletteSource).digest('hex')
if (actualPaletteChecksum !== officialPaletteChecksum) {
  console.error(`Official palette checksum mismatch for ${officialPaletteFile}.`)
  console.error(`Expected ${officialPaletteChecksum}, received ${actualPaletteChecksum}.`)
  process.exit(1)
}

const tokenSource = await readFile(path.join(root, 'styles/vrena-tokens.css'), 'utf8')
const missingOfficialTokens = requiredOfficialTokens.filter((token) => !tokenSource.includes(token))
if (missingOfficialTokens.length > 0) {
  console.error('Official VRena CTA tokens are missing or have drifted.')
  console.error(missingOfficialTokens.join('\n'))
  process.exit(1)
}

const retiredTokens = retiredTokenPatterns.filter((pattern) => pattern.test(tokenSource))
if (retiredTokens.length > 0) {
  console.error('Retired VRena palette aliases must not be restored.')
  console.error(retiredTokens.map((pattern) => pattern.source).join('\n'))
  process.exit(1)
}

const paletteFiles = new Set([
  'styles/vrena-tokens.css',
  'lib/theme/vrenaPalette.ts',
  'scripts/verify-palette-usage.mjs',
])

const scanGlobs = [
  'app/**/*.{css,ts,tsx,js,mjs}',
  'components/**/*.{css,ts,tsx,js,mjs}',
  'lib/**/*.{css,ts,tsx,js,mjs}',
  'scripts/**/*.{css,ts,tsx,js,mjs}',
]

const ignoredPathParts = [
  '/node_modules/',
  '/.next/',
  '/public/',
  '/supabase/',
]

const vendorHexByFile = new Map([
  ['components/BookingProfileView.tsx', new Set(['#4285f4', '#34a853', '#fbbc05', '#ea4335'])],
])

const functionalColorFixtureFiles = new Set([
  'scripts/verify-theme-surfaces.mjs',
])

const hexPattern = /(?:#|%23)[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/g
const rawFunctionalColorPattern = /rgba?\(\s*\d/gi

const files = [
  ...new Set(scanGlobs.flatMap((pattern) => globSync(pattern, { cwd: root, nodir: true }))),
].filter((file) => !ignoredPathParts.some((part) => `/${file}`.includes(part)))

const violations = []

for (const file of files) {
  if (paletteFiles.has(file)) continue

  const text = await readFile(path.join(root, file), 'utf8')
  const vendorHexes = vendorHexByFile.get(file) ?? new Set()

  for (const pattern of retiredTokenPatterns) {
    const match = pattern.exec(text)
    if (!match) continue
    const line = text.slice(0, match.index).split('\n').length
    violations.push(`${file}:${line} ${match[0]}`)
  }

  if (!functionalColorFixtureFiles.has(file)) {
    for (const match of text.matchAll(rawFunctionalColorPattern)) {
      const line = text.slice(0, match.index).split('\n').length
      violations.push(`${file}:${line} ${match[0]}`)
    }
  }

  for (const match of text.matchAll(hexPattern)) {
    const rawHex = match[0]
    const hex = rawHex.startsWith('%23') ? `#${rawHex.slice(3).toLowerCase()}` : rawHex.toLowerCase()
    const previous = text[match.index - 1]
    if (rawHex.startsWith('#') && previous === '&') continue
    if (vendorHexes.has(hex)) continue

    const line = text.slice(0, match.index).split('\n').length
    violations.push(`${file}:${line} ${rawHex}`)
  }
}

if (violations.length > 0) {
  console.error('Raw color literals must use styles/vrena-tokens.css or lib/theme/vrenaPalette.ts.')
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log(`Official palette checksum, semantic tokens, and raw palette usage passed across ${files.length} files.`)
