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
  '--vrena-cta-secondary-ink: var(--vrena-purple-600)',
  '--vrena-cta-tertiary-ink: var(--vrena-purple-600)',
  '--vrena-focus-halo: var(--vrena-cyan-700)',
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

const hexPattern = /(?:#|%23)[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/g

const files = [
  ...new Set(scanGlobs.flatMap((pattern) => globSync(pattern, { cwd: root, nodir: true }))),
].filter((file) => !ignoredPathParts.some((part) => `/${file}`.includes(part)))

const violations = []

for (const file of files) {
  if (paletteFiles.has(file)) continue

  const text = await readFile(path.join(root, file), 'utf8')
  const vendorHexes = vendorHexByFile.get(file) ?? new Set()

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

console.log(`Official palette checksum and CTA tokens verified; raw palette usage passed across ${files.length} files.`)
