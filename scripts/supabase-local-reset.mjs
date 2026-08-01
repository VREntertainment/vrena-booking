import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localBaseline = resolve(rootDir, 'supabase/local/20260614000000_core_schema_baseline.sql')
const temporaryMigration = resolve(rootDir, 'supabase/migrations/20260614000000_core_schema_baseline.sql')

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  })

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function sameFileContents(pathA, pathB) {
  if (!existsSync(pathA) || !existsSync(pathB)) return false
  return readFileSync(pathA, 'utf8') === readFileSync(pathB, 'utf8')
}

function removeTemporaryMigration() {
  if (!existsSync(temporaryMigration)) return
  if (!sameFileContents(localBaseline, temporaryMigration)) {
    throw new Error(`Refusing to remove ${temporaryMigration}; it does not match the local baseline.`)
  }
  unlinkSync(temporaryMigration)
}

if (!existsSync(localBaseline)) {
  throw new Error(`Missing local baseline: ${localBaseline}`)
}

if (existsSync(temporaryMigration) && !sameFileContents(localBaseline, temporaryMigration)) {
  throw new Error(`Refusing to overwrite existing migration: ${temporaryMigration}`)
}

mkdirSync(dirname(temporaryMigration), { recursive: true })
copyFileSync(localBaseline, temporaryMigration)

try {
  run('supabase', ['stop', '--no-backup'])
  run('supabase', ['start', '--exclude', 'edge-runtime'])
} finally {
  removeTemporaryMigration()
}

