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

test('ticket notification is sent only to the shared contact address', () => {
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
  assert.match(withGame, /laser-tag/)
})

for (const [venueKey, shop] of [
  ['ha-do-centrosa', 'VRena Hà Đô Centrosa'],
  ['cafe-des-stagiaires', 'VRena Café des Stagiaires'],
]) {
  test(`notification identifies ${shop} in HTML and plain text`, () => {
    const { context, sentEmail } = loadScript()
    context.sendNotificationEmail({
      event_type: 'ticket_booked',
      session: { venue_key: venueKey, ticket_reference: 'TEST', game_options: [] },
    }, new Date())
    assert.ok(sentEmail().body.includes(`Shop: ${shop}`))
    assert.ok(sentEmail().htmlBody.includes(`<th>Shop</th><td>${shop}</td>`))
  })
}

test('shop uses the raw database venue when the older webhook omits it from session', () => {
  const { context } = loadScript()
  assert.equal(context.bookingShopName({ session: {}, raw_session: { venue_key: 'cafe-des-stagiaires' } }), 'VRena Café des Stagiaires')
  assert.equal(context.bookingShopName({ session: { venue_key: 'unexpected-shop' } }), 'Unknown shop (unexpected-shop)')
})
