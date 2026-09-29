import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const scriptSource = readFileSync(
  new URL('./google-sheets-session-ticket-appscript.js', import.meta.url),
  'utf8'
)

function loadScript() {
  let sentEmail = null
  const context = vm.createContext({
    MailApp: {
      sendEmail(options) {
        sentEmail = options
      },
    },
    Utilities: {
      formatDate() {
        return '2026-08-04 13:14:02'
      },
    },
  })
  vm.runInContext(scriptSource, context)
  return { context, sentEmail: () => sentEmail }
}

test('legacy Ha Do ticket notification is sent only to the contact address', () => {
  const { context, sentEmail } = loadScript()
  context.sendNotificationEmail({
    event_type: 'ticket_booked',
    session: { ticket_reference: 'TKT-TEST', game_options: [] },
  }, new Date('2026-08-04T06:14:02Z'))

  assert.equal(sentEmail().to, 'contact@vre-vietnam.com')
})

test('email only shows game options when the payload contains a real selection', () => {
  const { context } = loadScript()
  const withoutGame = context.buildEmailHtml({
    event_type: 'ticket_booked',
    session: { game_options: [] },
  }, new Date('2026-08-04T06:14:02Z'))
  const withGame = context.buildEmailHtml({
    event_type: 'session_created',
    session: { game_options: ['laser-tag'] },
  }, new Date('2026-08-04T06:14:02Z'))

  assert.doesNotMatch(withoutGame, /Game options/)
  assert.match(withGame, /Game options/)
  assert.match(withGame, /Laser Tag/)
})

for (const [venueKey, shop] of [
  ['ha-do-centrosa', 'VRena Hà Đô Centrosa'],
  ['cafe-des-stagiaires', 'VRena Thao Dien'],
]) {
  test(`notification identifies ${shop} in HTML and plain text`, () => {
    const { context, sentEmail } = loadScript()
    context.sendNotificationEmail({
      event_type: 'ticket_booked',
      session: { venue_key: venueKey, ticket_reference: 'TEST', game_options: [] },
    }, new Date())
    assert.ok(sentEmail().body.includes(`Venue: ${shop}`))
    assert.ok(sentEmail().htmlBody.includes(shop))
  })
}

test('shop uses the raw database venue when the older webhook omits it from session', () => {
  const { context } = loadScript()
  assert.equal(context.bookingShopName({ session: {}, raw_session: { venue_key: 'cafe-des-stagiaires' } }), 'VRena Thao Dien')
  assert.equal(context.bookingShopName({ session: { venue_key: 'unexpected-shop' } }), 'Unknown shop (unexpected-shop)')
})

for (const eventType of ['ticket_booked', 'session_created', 'ticket_updated', 'session_cancelled']) {
  for (const venueKey of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
    test(`${eventType} routes ${venueKey} to its own recipients`, () => {
      const { context, sentEmail } = loadScript()
      context.sendNotificationEmail({ event_type: eventType, session: { venue_key: venueKey } }, new Date())
      assert.equal(sentEmail().to, venueKey === 'cafe-des-stagiaires'
        ? 'vrena-thaodien@vre-vietnam.com,emile@vre-vietnam.com'
        : 'contact@vre-vietnam.com')
    })
  }
}

test('legacy Thao Dien payloads use raw venue or CS reference without reaching Ha Do', () => {
  const { context } = loadScript()
  for (const payload of [
    { session: {}, raw_session: { venue_key: 'cafe-des-stagiaires' } },
    { session: { ticket_reference: 'CS-TEST' } },
  ]) {
    assert.equal(context.bookingEmailRecipients(payload).join(','), 'vrena-thaodien@vre-vietnam.com,emile@vre-vietnam.com')
  }
  assert.throws(() => context.bookingEmailRecipients({ session: { venue_key: 'unknown' } }), /Unknown booking venue/)
})


test('confirmation leads with the venue and visit instead of internal labels', () => {
  const { context, sentEmail } = loadScript()
  const payload = { event_type: 'ticket_booked', session: {
    venue_key: 'cafe-des-stagiaires', name: 'Cafe soft-opening request - Individual',
    date: '2026-09-29', start_time: '15:50:00', duration_minutes: 30,
    ticket_status: 'pending', ticket_reference: 'CS-TEST', ticket_total_price: 190000,
    game_options: ['laser-tag'], id: 'internal-id',
  }, customer: { name: 'Test Guest', email: 'test@example.com' }, owner: { name: 'Test Guest', email: 'test@example.com' } }
  context.sendNotificationEmail(payload, new Date())
  const email = sentEmail()
  assert.match(email.subject, /^\[VRena Thao Dien\]/)
  assert.match(email.htmlBody, /Awaiting confirmation/)
  assert.match(email.body, /29 Sep 2026 · 15:50/)
  assert.doesNotMatch(email.htmlBody, /Cafe soft-opening|ticket_booked|Booked by/)
  assert.ok(email.htmlBody.indexOf('Your visit') < email.htmlBody.indexOf('Internal session ID'))
  assert.match(email.htmlBody, /Booking total/)
})

test('update labels and untrusted content remain clear and escaped', () => {
  const { context } = loadScript()
  const html = context.buildEmailHtml({ event_type: 'ticket_cancelled', session: {
    venue_key: 'ha-do-centrosa', name: '<script>alert(1)</script>', ticket_status: 'cancelled',
  }, minor_warning: 'Parent confirmation required' }, new Date())
  assert.match(html, /Booking cancelled/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /Parent confirmation required/)
})
