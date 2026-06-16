import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_BATCH = 'soft-launch-2026-06-16'

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const rawValue = trimmed.slice(separator + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

loadEnvFile(resolve(process.cwd(), '.env.local'))

if (process.env.ALLOW_PRODUCTION_SEED !== 'true') {
  throw new Error('Refusing to reset/seed sessions. Set ALLOW_PRODUCTION_SEED=true to run this one-time launch script.')
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.')
}

const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const seedBatch = process.env.SEED_BATCH || DEFAULT_BATCH

console.log('[soft-launch-seed] Safety guard enabled: ALLOW_PRODUCTION_SEED=true')
console.log(`[soft-launch-seed] Target Supabase URL: ${supabaseUrl}`)
console.log(`[soft-launch-seed] Seed batch: ${seedBatch}`)
console.log('[soft-launch-seed] Deleting existing session-related data only. Auth users and real profiles are not deleted.')

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const { data, error } = await supabase.rpc('vrena_soft_launch_reset_seed_with_demo_auth', {
  p_allow_production_seed: true,
  p_seed_batch: seedBatch,
})

if (error) {
  console.error('[soft-launch-seed] Failed. Database transaction was rolled back by Postgres.')
  throw error
}

console.log('[soft-launch-seed] Completed successfully.')
console.log('[soft-launch-seed] Database result:')
console.log(JSON.stringify(data, null, 2))
