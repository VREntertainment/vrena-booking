import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { globSync } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

console.log(`Palette usage check passed across ${files.length} files.`)
