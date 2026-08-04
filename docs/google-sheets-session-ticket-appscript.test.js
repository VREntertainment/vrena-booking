const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const test = require('node:test')
const vm = require('node:vm')

const scriptSource = readFileSync(
  new URL('./google-sheets-session-ticket-appscript.js', `file://${__dirname}/`),
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
