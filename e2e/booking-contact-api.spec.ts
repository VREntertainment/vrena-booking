import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

test('contact API fills only the caller’s missing fields without changing credentials or privileges', async ({ request, baseURL }) => {
  const url = process.env.SUPABASE_URL || ''
  test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Requires the isolated local backend')
  expect(new URL(url).hostname).toBe('127.0.0.1')
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const password = randomUUID()
  const phone = `+84${Date.now().toString().slice(-9)}`
  const loginEmail = `contact-${randomUUID()}@example.invalid`
  const created = await admin.auth.admin.createUser({ email: loginEmail, password, email_confirm: true })
  expect(created.error).toBeNull()
  const id = created.data.user!.id
  try {
    const seeded = await admin.from('profiles').upsert({ id, full_name: 'Contact API test', phone: null, email: null, role: 'player' })
    expect(seeded.error).toBeNull()
    const signed = await client.auth.signInWithPassword({ email: loginEmail, password })
    expect(signed.error).toBeNull()
    const headers = { Origin: baseURL!.replace('127.0.0.1', 'localhost'), Authorization: `Bearer ${signed.data.session!.access_token}` }
    const post = (data: unknown, customHeaders = headers) => request.post('/api/profile/booking-contact', { headers: customHeaders, data })
    expect((await post({}, { Origin: headers.Origin, Authorization: '' })).status()).toBe(401)
    expect((await post({}, { ...headers, Origin: 'https://other.example' })).status()).toBe(403)
    expect((await post({ phone: '123', email: 'customer@example.com' })).status()).toBe(400)
    expect((await post({ phone, email: 'bad' })).status()).toBe(400)
    expect((await post({ phone, email: 'emile@vre-vietnam.com' })).status()).toBe(400)
    const contactEmail = `contact-${randomUUID()}@example.com`
    const saved = await post({ phone, email: contactEmail, role: 'owner', id: randomUUID() })
    expect(saved.status()).toBe(200)
    expect((await saved.json()).data).toEqual({ phone, email: contactEmail })
    // Replayed or stale requests cannot change completed contact fields.
    const replay = await post({ phone: '+84911111111', email: 'different@example.com' })
    expect(replay.status()).toBe(200)
    expect((await replay.json()).data.email).toBe(contactEmail)
    const profile = await admin.from('profiles').select('phone,email,role').eq('id', id).single()
    expect(profile.data).toEqual({ phone, email: contactEmail, role: 'player' })
    const auth = await admin.auth.admin.getUserById(id)
    expect(auth.data.user!.email).toBe(loginEmail)
  } finally {
    await client.auth.signOut()
    await admin.auth.admin.deleteUser(id)
  }
})
