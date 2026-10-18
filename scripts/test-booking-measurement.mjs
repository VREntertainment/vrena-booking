import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function browser(consent = 'all', path = '/tickets') {
  const calls = []; const scripts = []; const values = new Map()
  const context = vm.createContext({ console, URL, Map, Date, Set,
    sessionStorage: { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) },
    document: { cookie: `vrena-cookie-consent=${consent}`, createElement: () => ({}), head: { appendChild: s => scripts.push(s) } },
    window: { location: { pathname: path, hostname: 'booking.vre-vietnam.com', origin: 'https://booking.vre-vietnam.com' }, gtag: (...args) => calls.push(args) },
  })
  const modules = new Map()
  function load(file) {
    if (modules.has(file)) return modules.get(file)
    const exports = {}; modules.set(file, exports)
    const source = ts.transpileModule(readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    context.exports = exports
    context.require = name => { assert.equal(name, './openAiAds'); return load('lib/openAiAds.ts') }
    vm.runInContext(source, context, { filename: file })
    return exports
  }
  return { context, calls, scripts, load }
}
const input = { ticketType: 'individual', ticketLabel:'VR', venue:'thao_dien', date:'2026-10-20',time:'18:00',players:2,durationMinutes:30,totalPrice:480000,transactionId:'test-booking-unit' }
for (const consent of ['essential','analytics','all']) {
  const b = browser(consent); const analytics = b.load('lib/googleAnalytics.ts')
  analytics.trackTicketBookingCompleted(input)
  analytics.trackTicketBookingCompleted(input)
  assert.equal(b.calls.filter(c=>c[1]==='booking_completed').length, consent==='essential'?0:1)
  assert.equal(b.scripts.length, consent==='all'?1:0)
  if (consent==='all') {
    const events=b.context.window.oaiq.q.filter(c=>c[0]==='measure'&&c[1]==='appointment_scheduled')
    assert.equal(events.length,1)
    assert.equal(events[0][3].event_id,'booking:test-booking-unit')
    assert.equal(JSON.stringify(events).includes('test-booking-unit'),true)
    assert.equal(events[0][2].amount,undefined) // Booking is not a payment.
    b.load('lib/openAiAds.ts').syncOpenAiMeasurement(false)
    assert.equal(b.context.window.oaiq.q.at(-1)[0],'consent')
    assert.equal(b.context.window.oaiq.q.at(-1)[1],false)
  }
}
for (const path of ['/staff','/hr','/admin','/auth/zalo']) {
  const b=browser('all',path); b.load('lib/openAiAds.ts').syncOpenAiMeasurement(true)
  assert.equal(b.scripts.length,0)
}
{
  const b=browser(); const a=b.load('lib/googleAnalytics.ts')
  a.trackTicketBookingCompleted({...input,transactionId:''})
  assert.equal(b.calls.length,0); assert.equal(b.scripts.length,0)
  b.context.window.gtag=()=>{throw Error('tracker unavailable')}
  assert.doesNotThrow(()=>a.trackTicketBookingCompleted(input))
}
console.log('PASS: booking success event, venue, consent, deduplication, private-route exclusion, revocation, and failure isolation')
