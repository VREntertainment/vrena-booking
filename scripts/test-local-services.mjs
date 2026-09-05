import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { totpCode } from '../e2e/support/totp.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const container = 'supabase_db_vrena-health-ci'
const baseline = '20260905011752'
const cli = (args) => execFileSync('supabase', [...args, '--workdir', 'e2e'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const sql = (input) => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })

// Deliberately fixed to a dedicated local Docker project. No linked project or production URL is accepted.
console.log('Starting the isolated local test services…')
cli(['start', '--exclude', 'analytics,vector,studio,postgres-meta,realtime,storage-api,imgproxy,edge-runtime'])
if (!sql("select to_regclass('public.profiles');").trim()) {
  sql('create extension if not exists unaccent with schema extensions; create extension if not exists btree_gist with schema extensions;')
  sql(readFileSync('e2e/supabase/schema.sql', 'utf8'))
}
sql('create table if not exists private.e2e_migrations (version text primary key);')
const applied = new Set(sql('select version from private.e2e_migrations;').trim().split('\n'))
for (const file of readdirSync('supabase/migrations').filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
  const version = file.split('_')[0]
  if (version <= baseline || applied.has(version)) continue
  sql(readFileSync(path.join('supabase/migrations', file), 'utf8'))
  sql(`insert into private.e2e_migrations values ('${version}');`)
}
sql(readFileSync('e2e/supabase/seed.sql', 'utf8'))
sql(readFileSync('supabase/e2e/create-admin-user.sql', 'utf8'))
sql("notify pgrst, 'reload schema';")

const services = JSON.parse(cli(['status', '--output', 'json']))
if (new URL(services.API_URL).hostname !== '127.0.0.1' || !services.API_URL.endsWith(':56431')) {
  throw new Error('Refusing to run tests against a non-local backend.')
}
const email = `e2e-${randomBytes(5).toString('hex')}@vrena.local`
const password = randomBytes(24).toString('base64url')
const admin = createClient(services.API_URL, services.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
let prepared
for (let attempt = 0; attempt < 20; attempt += 1) {
  prepared = await admin.rpc('vrena_e2e_prepare_admin', { p_email: email, p_password: password, p_allow_non_production: true })
  if (!prepared.error || prepared.error.code !== 'PGRST202') break
  await new Promise((resolve) => setTimeout(resolve, 250))
}
if (prepared.error) throw prepared.error
const employee = await admin.from('staff_employee_profiles').upsert({
  profile_id: prepared.data.profile_id,
  legal_name: 'Local test employee',
  employment_type: 'part_time',
  department: 'VRena',
  main_work_location: 'HaDo',
  payroll_location: 'HaDo',
  hourly_rate_vnd: 30000,
  active: true,
})
if (employee.error) throw employee.error
const client = createClient(services.API_URL, services.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const signedIn = await client.auth.signInWithPassword({ email, password })
if (signedIn.error) throw signedIn.error
const enrolled = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Local E2E authenticator' })
if (enrolled.error) throw enrolled.error
const verified = await client.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: totpCode(enrolled.data.totp.secret) })
if (verified.error) throw verified.error

console.log(cli(['test', 'db', ...[
  'booking_review_fixes_test.sql', 'ticket_tariffs_20260831_test.sql',
  'minor_birthday_lock_test.sql', 'security_hardening_20260824_test.sql',
  'staff_kiosk_concurrent_sessions_test.sql', 'staff_player_achievement_profile_workflow_test.sql',
].map((file) => path.join(root, 'supabase/tests', file))]))

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: services.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: services.ANON_KEY,
  SUPABASE_URL: services.API_URL,
  SUPABASE_SERVICE_ROLE_KEY: services.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY: '10000000-ffff-ffff-ffff-000000000001',
  E2E_ADMIN_EMAIL: email,
  E2E_ADMIN_PASSWORD: password,
  E2E_ADMIN_TOTP_SECRET: enrolled.data.totp.secret,
  E2E_BASE_URL: '',
}
const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { env, stdio: 'inherit' })
  child.on('error', reject)
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)))
})
try {
  if (process.env.E2E_PRODUCTION_BUILD === '1') await run('npm', ['run', 'build'])
  await run('npx', ['playwright', 'test', ...process.argv.slice(2)])
} finally {
  await admin.auth.admin.deleteUser(prepared.data.profile_id)
}
