import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const pluginPath = require.resolve('@next/eslint-plugin-next')
const { getRootDirs } = await import(pathToFileURL(join(dirname(pluginPath), 'utils/get-root-dirs.js')).href)

test('Next lint root discovery retains string and array globs with the safe glob replacement', () => {
  const root = mkdtempSync(join(tmpdir(), 'vrena-lint-roots-'))
  try {
    mkdirSync(join(root, 'apps', 'booking'), { recursive: true })
    mkdirSync(join(root, 'apps', 'staff'), { recursive: true })
    writeFileSync(join(root, 'apps', 'ignore.txt'), '')
    const context = (rootDir?: string | string[]) => ({ cwd: root, settings: { next: { rootDir } } })
    const normalized = (rows: string[]) => rows.map(row => resolve(row)).sort()
    const expected = ['booking', 'staff'].map(name => join(root, 'apps', name)).sort()
    assert.deepEqual(getRootDirs(context()), [root])
    assert.deepEqual(normalized(getRootDirs(context(join(root, 'apps', '*')))), expected)
    assert.deepEqual(normalized(getRootDirs(context([join(root, 'apps', 'booking'), join(root, 'apps', 'staff')]))), expected)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
