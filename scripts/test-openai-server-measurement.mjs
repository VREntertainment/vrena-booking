import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const calls = [], tasks = [], logs = []
let rpcResult = { data: null, error: null }
let clientOptions
const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test', OPENAI_ADS_CAPI_KEY: 'test-only', NEXT_PUBLIC_SITE_URL: 'https://booking.vre-vietnam.com', TRUSTED_CLIENT_IP_HEADER: 'x-vercel-forwarded-for' }
const context = vm.createContext({ URL, Headers, Response, AbortSignal, Date, Set, Promise,
  setTimeout: fn => setTimeout(fn, 0), fetch: async (...args) => { calls.push(args); return new Response('{}') },
  process: { env }, console: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
})
const modules = new Map()
function load(file) {
  file = resolve(file)
  if (modules.has(file)) return modules.get(file)
  const exports = {}; modules.set(file, exports)
  const require = name => {
    if (name === 'server-only') return {}
    if (name === 'node:net') return { isIP: value => value === '203.0.113.1' ? 4 : 0 }
    if (name === 'next/server') return { after: task => tasks.push(task), NextResponse: { json: (body, options) => Response.json(body, options) } }
    if (name === '@supabase/supabase-js') return { createClient: (_url, key, options) => {
      assert.equal(key, 'test'); clientOptions = options
      return { rpc: async (name, args) => { calls.push({ name, args }); return rpcResult } }
    } }
    return load((name.startsWith('@/') ? resolve(name.slice(2)) : resolve(dirname(file), name)) + '.ts')
  }
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInContext('(function(exports, require) {' + source + '\n})', context)(exports, require)
  return exports
}
const { POST } = load('app/api/bookings/tickets/route.ts')
const { sendOpenAiBooking } = load('lib/server/openAiConversions.ts')
const booking = { session_id: '00000000-0000-4000-8000-000000000993', ticket_reference: 'QA-UNIT', ticket_status: 'confirmed' }
function request(name, consent = 'all', extras = {}) {
  const headers = new Headers({ origin: 'https://booking.vre-vietnam.com', cookie: `vrena-cookie-consent=${consent}; __oppref=opaque%2Fvalue; __obref=browser-ref`, 'user-agent': 'QA', authorization: 'Bearer user-jwt', 'x-vercel-forwarded-for': '203.0.113.1', ...extras })
  return { headers, nextUrl: new URL('https://booking.vre-vietnam.com/api/bookings/tickets'), text: async () => JSON.stringify({ name, args: { p_player_count: 2 }, sourceUrl: 'https://booking.vre-vietnam.com/tickets?phone=secret#private' }) }
}
for (const [rpc, venue] of [['create_guest_ticket_booking','ha_do_centrosa'], ['create_ticket_booking','ha_do_centrosa'], ['create_cafe_ticket_booking_request','thao_dien']]) {
  for (const result of [{data:null,error:{message:'capacity unavailable'}}, {data:{...booking,ticket_status:'pending'},error:null}, {data:{...booking,session_id:''},error:null}, {data:{...booking,ticket_reference:''},error:null}]) {
    tasks.length = 0; rpcResult = result
    await POST(request(rpc))
    assert.equal(tasks.length, 0, 'failed or unconfirmed bookings never schedule CAPI')
  }
  for (const consent of ['essential','analytics','all']) {
    tasks.length = 0; calls.length = 0; rpcResult = {data:booking,error:null}
    const result = await POST(request(rpc, consent))
    assert.deepEqual((await result.json()).data, booking)
    assert.equal(calls.length,1,'booking response does not wait for conversion HTTP')
    assert.equal(clientOptions.global.headers.Authorization,'Bearer user-jwt')
    await tasks[0]()
    assert.equal(calls.length,consent === 'all' ? 2 : 1)
    if (consent === 'all') {
      const payload = JSON.parse(calls[1][1].body)
      const event = payload.events[0]
      assert.equal(event.id, `booking:${venue}:${booking.session_id}`)
      assert.equal(event.source_url,'https://booking.vre-vietnam.com/tickets')
      assert.equal(event.oppref,'opaque%2Fvalue')
      assert.equal(event.user.obref,'browser-ref')
      assert.equal(event.type,'appointment_scheduled')
      assert.equal(event.user.ip_address,'203.0.113.1')
      assert.equal(payload.validate_only,undefined)
    }
  }
}
calls.length = 0
assert.equal((await POST(request('delete_session'))).status,400)
assert.equal((await POST(request('create_ticket_booking','all',{origin:'https://evil.invalid'}))).status,403)
assert.equal(calls.length,0)
const input = { bookingId: booking.session_id, venue: 'thao_dien', timestampMs: Date.now(), headers:request('').headers, requestOrigin:'https://vrena-booking.vercel.app', sourceUrl:'https://evil.invalid/tickets?token=x' }
let attempts = []
await sendOpenAiBooking(input, async (_url, options) => { attempts.push(JSON.parse(options.body)); return new Response('{}', {status: attempts.length < 3 ? 503 : 200}) })
assert.equal(attempts.length,3)
assert.equal(JSON.stringify(attempts[0]),JSON.stringify(attempts[2]),'retries reuse event ID and timestamp')
assert.equal(attempts[0].events[0].source_url,'https://booking.vre-vietnam.com/tickets')
attempts = []
await sendOpenAiBooking(input, async () => { attempts.push(1); return new Response('{}',{status:401}) })
assert.equal(attempts.length,1,'auth rejection is not retried')
await assert.doesNotReject(sendOpenAiBooking(input,async()=>{throw Error('network failure')}))
env.OPENAI_ADS_CAPI_KEY = ''
await sendOpenAiBooking(input,async()=>{assert.fail('missing credential must skip')})
assert.equal(JSON.stringify(logs).includes('opaque'),false)
assert.equal(JSON.stringify(logs).includes('test-only'),false)
console.log('PASS: both venues, guest/account auth, committed-only dispatch, consent, matching, source sanitization, retry dedupe, failure isolation, RPC allowlist, origin protection')
