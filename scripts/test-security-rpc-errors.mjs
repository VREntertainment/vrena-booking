import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'

// Never accepts a hosted URL or credentials. These tests create disposable users
// and records only in the fixed, isolated local services used by release CI.
const services = JSON.parse(execFileSync('supabase', ['status', '--workdir', 'e2e', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
assert.equal(services.API_URL, 'http://127.0.0.1:56431')
const admin = createClient(services.API_URL, services.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const sql = (input) => execFileSync('docker', ['exec', '-i', 'supabase_db_vrena-health-ci', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()

async function fixture(run) {
  const email = `rpc-security-${randomUUID()}@example.invalid`
  const password = randomBytes(24).toString('base64url')
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(created.error)
  const id = created.data.user.id
  const sessionId = randomUUID()
  const phone = '+84998765432'
  try {
    sql(`select set_config('request.jwt.claims','{"role":"service_role","sub":"${id}"}',false);
      insert into public.profiles (id,email,full_name) values ('${id}','${email}','Local RPC security fixture') on conflict (id) do nothing;
      insert into public.sessions (id,owner_id,name,date,start_time,max_players,visibility,invite_code,booking_type)
      values ('${sessionId}','${id}','Local RPC security fixture',current_date + 60,'10:00',4,'private','SECURE-CODE','community');`)
    const client = createClient(services.API_URL, services.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    assert.ifError((await client.auth.signInWithPassword({ email, password })).error)
    const count = (subject) => Number(sql(`select coalesce(max(attempt_count),0) from public.security_rate_limits where reset_at > now() and subject_hash = encode(extensions.digest('booking_attempt:${id}:${subject.toLowerCase()}','sha256'),'hex');`))
    await run({ client, id, sessionId, phone, count })
    assert.equal(sql('select count(*) from private.guest_ticket_claim_context;'), '0', 'Claim authorizations must never survive their operation')
  } finally {
    // Remove only this fixture; local rate-limit rows expire normally.
    sql(`delete from public.sessions where id = '${sessionId}';`)
    await admin.auth.admin.deleteUser(id)
  }
}

const joinArgs = (sessionId, code) => ({ p_session_id: sessionId, p_invite_code: code, p_display_name: 'Local RPC security fixture' })
const expectError = (result, message) => {
  assert.equal(result.status, 400)
  assert.equal(result.data, null, 'Supabase must report failure to existing clients')
  assert.equal(result.error?.message, message)
}

test('wrong private codes persist and share a limit across join and waitlist endpoints', async () => {
  await fixture(async ({ client, id, sessionId, count }) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const rpc = attempt % 2 ? 'join_private_session_with_code' : 'join_private_session_waitlist_with_code'
      const result = await client.rpc(rpc, joinArgs(sessionId, attempt % 2 ? 'WRONG' : ' wrong '))
      expectError(result, 'Incorrect private session code.')
      assert.equal(count(`private-code:session:${sessionId}`), attempt, 'Rejected guesses must not undo the counter')
    }
    expectError(await client.rpc('join_private_session_with_code', joinArgs(sessionId, 'SECURE-CODE')), 'Too many attempts. Please wait a moment and try again.')
    assert.equal(sql(`select count(*) from public.session_participants where session_id='${sessionId}' and profile_id='${id}';`), '0')
    assert.equal(sql(`select count(*) from public.session_waitlist where session_id='${sessionId}' and profile_id='${id}';`), '0')
  })
})

test('a correct private code still joins and adds the caller to the waitlist', async () => {
  await fixture(async ({ client, id, sessionId }) => {
    assert.ifError((await client.rpc('join_private_session_waitlist_with_code', joinArgs(sessionId, ' secure-code '))).error)
    assert.equal(sql(`select count(*) from public.session_waitlist where session_id='${sessionId}' and profile_id='${id}';`), '1')
    assert.ifError((await client.rpc('join_private_session_with_code', joinArgs(sessionId, ' secure-code '))).error)
    assert.equal(sql(`select count(*) from public.session_participants where session_id='${sessionId}' and profile_id='${id}' and deleted_at is null;`), '1')
  })
})

test('failed guest claims persist the limit and roll back intermediate profile changes', async () => {
  await fixture(async ({ client, id, phone, count }) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      expectError(await client.rpc('claim_guest_ticket_booking', { p_guest_phone: phone, p_ticket_reference: 'MISSING-LOCAL-BOOKING' }), 'Ticket booking not found.')
      assert.equal(count('guest-claim:actor-global'), attempt)
      assert.equal(sql(`select coalesce(phone,'') from public.profiles where id='${id}';`), '', 'Failed claims must roll back their profile edits')
    }
    expectError(await client.rpc('claim_guest_ticket_booking', { p_guest_phone: phone, p_ticket_reference: 'MISSING-LOCAL-BOOKING' }), 'Too many attempts. Please wait a moment and try again.')
    assert.equal(count('guest-claim:actor-global'), 3)
  })
})

test('parallel wrong guesses cannot race past the shared private-code limit', async () => {
  await fixture(async ({ client, sessionId, count }) => {
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => client.rpc(
      i % 2 ? 'join_private_session_with_code' : 'join_private_session_waitlist_with_code', joinArgs(sessionId, 'WRONG'))))
    assert.equal(results.filter(r => r.error?.message === 'Incorrect private session code.').length, 5)
    assert.equal(results.filter(r => r.error?.message === 'Too many attempts. Please wait a moment and try again.').length, 1)
    assert.equal(count(`private-code:session:${sessionId}`), 5)
  })
})

test('equivalent phone formatting shares the same guest-claim pair allowance', async () => {
  await fixture(async ({ client, count }) => {
    for (const phone of ['+84998765432', '+84 998 765 432', '+84(998)-765-432']) {
      expectError(await client.rpc('claim_guest_ticket_booking', { p_guest_phone: phone, p_ticket_reference: 'MISSING-LOCAL-BOOKING' }), 'Ticket booking not found.')
    }
    expectError(await client.rpc('claim_guest_ticket_booking', { p_guest_phone: '+84.998.765.432', p_ticket_reference: ' missing-local-booking ' }), 'Too many attempts. Please wait a moment and try again.')
    assert.equal(count('guest-claim:actor-global'), 3)
  })
})

test('rotating private-session identifiers cannot bypass the account-wide limit', async () => {
  await fixture(async ({ client, sessionId, count }) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      expectError(await client.rpc('join_private_session_with_code', joinArgs(randomUUID(), 'WRONG')), 'Private session not found.')
    }
    assert.equal(count('private-code:actor-global'), 20)
    expectError(await client.rpc('join_private_session_waitlist_with_code', joinArgs(sessionId, 'SECURE-CODE')), 'Too many attempts. Please wait a moment and try again.')
  })
})

test('rotating claim references and phone formatting cannot bypass the account-wide limit', async () => {
  await fixture(async ({ client, phone, count }) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      expectError(await client.rpc('claim_guest_ticket_booking', {
        p_guest_phone: attempt % 2 ? '+84 998 765 432' : phone,
        p_ticket_reference: `MISSING-LOCAL-${attempt}`,
      }), 'Ticket booking not found.')
    }
    assert.equal(count('guest-claim:actor-global'), 10)
    expectError(await client.rpc('claim_guest_ticket_booking', { p_guest_phone: phone, p_ticket_reference: 'ANOTHER-MISSING-LOCAL' }), 'Too many attempts. Please wait a moment and try again.')
  })
})

test('valid guest claims remain successful and idempotent', async () => {
  await fixture(async ({ client, id, sessionId, phone }) => {
    const guestId = sql(`select id from public.ensure_guest_ticket_profile('${phone}','Local guest claim fixture');`)
    assert.match(guestId, /^[0-9a-f-]{36}$/)
    const reference = `LOCAL-${randomBytes(5).toString('hex').toUpperCase()}`
    const orderId = randomUUID()
    try {
      sql(`select set_config('request.jwt.claims','{"role":"service_role","sub":"${id}"}',false);
        update public.sessions set booking_type='ticket',ticket_status='confirmed',ticket_reference='${reference}',owner_id='${guestId}',ticket_customer_id='${guestId}',ticket_total_price=100000,ticket_unit_price=100000 where id='${sessionId}';
        insert into public.session_participants (session_id,profile_id,display_name,payment_amount,payment_status) values ('${sessionId}','${guestId}','Local guest',100000,'cash');
        insert into public.staff_orders (id,order_number,customer_id,session_id,booking_date,booking_time,players_count,subtotal,total,payment_method,payment_status)
        values ('${orderId}','${reference}','${guestId}','${sessionId}',current_date+60,'10:00',1,100000,100000,'cash','paid');`)
      expectError(await client.rpc('claim_guest_ticket_booking', { p_guest_phone: '+84998000000', p_ticket_reference: reference }), 'Ticket booking does not match this phone number.')
      assert.equal(sql(`select customer_id::text from public.staff_orders where id='${orderId}';`), guestId)
      assert.equal(sql(`select coalesce(phone,'') from public.profiles where id='${id}';`), '')
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await client.rpc('claim_guest_ticket_booking', { p_guest_phone: phone, p_ticket_reference: reference.toLowerCase() })
        assert.ifError(result.error)
        assert.equal(result.data.claimed, true)
        assert.equal(result.data.session_id, sessionId)
        assert.equal(sql(`select owner_id::text || ':' || ticket_customer_id::text from public.sessions where id='${sessionId}';`), `${id}:${id}`)
        assert.equal(sql(`select profile_id::text || ':' || payment_amount::text || ':' || payment_status from public.session_participants where session_id='${sessionId}';`), `${id}:100000:cash`)
        assert.equal(sql(`select customer_id::text || ':' || total::text || ':' || payment_status from public.staff_orders where id='${orderId}';`), `${id}:100000:paid`)
        assert.equal(sql(`select ticket_total_price::text || ':' || ticket_status from public.sessions where id='${sessionId}';`), '100000:confirmed')
        assert.equal((await client.auth.getUser()).data.user?.id, id)
      }
      for (const payload of [{ ticket_total_price: 1 }, { ticket_status: 'pending' }, { owner_id: guestId }, { ticket_customer_id: guestId }]) {
        await client.from('sessions').update(payload).eq('id', sessionId)
        assert.equal(sql(`select owner_id::text || ':' || ticket_customer_id::text || ':' || ticket_total_price::text || ':' || ticket_status from public.sessions where id='${sessionId}';`), `${id}:${id}:100000:confirmed`, 'Direct browser edits remain blocked')
      }
    } finally {
      sql(`delete from public.staff_orders where id='${orderId}'; delete from public.sessions where id='${sessionId}';`)
      // A successful claim already removes its obsolete guest Auth shell.
      sql(`delete from auth.users where id='${guestId}';`)
    }
  })
})
