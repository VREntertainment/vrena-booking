import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const scriptSource = readFileSync(
  new URL('./google-sheets-session-ticket-appscript.js', import.meta.url),
  'utf8'
)

function loadScript(testOptions = {}) {
  const sheets = testOptions.sheets || new Map()
  let locked = false
  let sequence = 0
  let sentEmail = null
  const sentEmails = []
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name),
    insertSheet(name) {
      const rows = []
      const sheet = {
        rows,
        appendRow: (row) => rows.push(row),
        setFrozenRows() {},
        getLastRow: () => rows.length,
        getRange(row, column) {
          return {
            getValue: () => rows[row - 1][column - 1],
            setValues: (values) => values[0].forEach((v, i) => { rows[row - 1][column - 1 + i] = v }),
            createTextFinder(key) {
              return {
                matchEntireCell() { return this },
                useRegularExpression() { return this },
                findNext() {
                  const index = rows.findIndex((r) => r[0] === key)
                  return index < 0 ? null : { getRow: () => index + 1 }
                },
              }
            },
          }
        },
      }
      sheets.set(name, sheet)
      return sheet
    },
  }
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({
      waitLock() { if (locked) throw new Error('Lock unavailable'); locked = true },
      releaseLock() { locked = false },
    }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush() {} },
    MailApp: {
      sendEmail(options) {
        sentEmail = options
        sentEmails.push(options)
      },
    },
    GmailApp: {
      sendEmail(to, subject, body, options) {
        sentEmail = { to, subject, body, ...options }
        sentEmails.push(sentEmail)
        if (testOptions.customerSendThrows) throw new Error('Ambiguous mail failure')
      },
    },
    Utilities: {
      formatDate() {
        return '2026-08-04 13:14:02'
      },
    },
  })
  vm.runInContext(scriptSource, context)
  // Give older formatting fixtures a booking identity; production payloads have one.
  const send = context.sendNotificationEmail
  context.sendNotificationEmail = (payload, date) => {
    payload.session ||= {}
    payload.session.id ||= 'fixture-' + (++sequence)
    return send(payload, date)
  }
  return { context, sentEmail: () => sentEmail, sentEmails, sheets }
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
        ? 'vrena-thaodien@vre-vietnam.com'
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
  const { context, sentEmails } = loadScript()
  const payload = { event_type: 'ticket_booked', session: {
    venue_key: 'cafe-des-stagiaires', name: 'Cafe soft-opening request - Individual',
    date: '2026-09-29', start_time: '15:50:00', duration_minutes: 30,
    ticket_status: 'pending', ticket_reference: 'CS-TEST', ticket_total_price: 190000,
    game_options: ['laser-tag'], id: 'internal-id',
  }, customer: { name: 'Test Guest', email: 'test@example.com' }, owner: { name: 'Test Guest', email: 'test@example.com' } }
  context.sendNotificationEmail(payload, new Date())
  const email = sentEmails[0]
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


test('Thao Dien email references use TD even for legacy payloads', () => {
  const { context, sentEmail } = loadScript()
  context.sendNotificationEmail({ event_type: 'ticket_booked', session: {
    venue_key: 'cafe-des-stagiaires', ticket_reference: 'CS-260929-ABC123',
    name: 'Cafe soft-opening request - Individual', notes: 'Cafe des Stagiaires',
  } }, new Date())
  assert.match(sentEmail().subject, /TD-260929-ABC123/)
  assert.match(sentEmail().body, /TD-260929-ABC123/)
  assert.doesNotMatch(sentEmail().subject + sentEmail().body + sentEmail().htmlBody, /CS-|cafe des stagiaires/i)
  assert.equal(context.bookingEmailRecipients({ session: { ticket_reference: 'TD-260929-ABC123' } }).join(','), 'vrena-thaodien@vre-vietnam.com,emile@vre-vietnam.com')
})


for (const venueKey of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
  test(`separate branded customer confirmation for ${venueKey} excludes staff details`, () => {
    const { context, sentEmails } = loadScript()
    context.sendNotificationEmail({ event_type: 'ticket_booked', session: {
      venue_key: venueKey, ticket_reference: 'TD-TEST', ticket_status: 'pending',
      id: 'PRIVATE-INTERNAL-ID', notes: 'PRIVATE-STAFF-NOTE', invite_code: 'PRIVATE-CODE',
    }, customer: { name: 'Guest', email: 'guest@example.com' }, owner: { name: 'PRIVATE-STAFF' } }, new Date())
    assert.equal(sentEmails.length, 2)
    assert.equal(sentEmails[1].to, 'guest@example.com')
    assert.equal(sentEmails[1].bcc, undefined)
    assert.equal(sentEmails[0].bcc, venueKey === 'cafe-des-stagiaires' ? 'emile@vre-vietnam.com' : undefined)
    assert.equal(sentEmails[1].cc, undefined)
    assert.equal(sentEmails[1].from, venueKey === 'ha-do-centrosa' ? 'contact@vre-vietnam.com' : 'vrena-thaodien@vre-vietnam.com')
    assert.equal(sentEmails[1].name, venueKey === 'ha-do-centrosa' ? 'VRena Hà Đô Centrosa' : 'VRena Thao Dien')
    assert.equal(sentEmails[1].replyTo, venueKey === 'cafe-des-stagiaires' ? 'vrena-thaodien@vre-vietnam.com' : 'contact@vre-vietnam.com')
    assert.match(sentEmails[1].subject, /Booking request received/)
    assert.match(sentEmails[1].htmlBody, /vrena-logo-full-light.png/)
    assert.doesNotMatch(sentEmails[1].htmlBody + sentEmails[1].body, /PRIVATE-|Internal session|Received:|Booked by/)
    assert.match(sentEmails[1].body, /awaiting confirmation/)
    assert.match(sentEmails[0].htmlBody, /vrena-logo-full-light.png/)
  })
}

test('customer emails skip absent, synthetic, malformed, and update addresses', () => {
  const { context } = loadScript()
  for (const email of ['', 'invalid', 'a@phone-login.vrena.invalid', 'a@b.local', 'a@b.com,c@d.com', 'a@b.com\nBcc:evil@example.com']) {
    assert.equal(context.bookingCustomerEmail({event_type:'ticket_booked', customer:{email}}), '')
  }
  assert.equal(context.bookingCustomerEmail({event_type:'ticket_updated', customer:{email:'guest@example.com'}}), '')
  assert.equal(context.bookingCustomerEmail({event_type:'ticket_booked', owner:{email:'staff@example.com'}}), '')
})

test('confirmed customer booking is clearly confirmed', () => {
  const { context } = loadScript()
  assert.match(context.buildEmailText({event_type:'ticket_booked',session:{venue_key:'ha-do-centrosa',ticket_status:'confirmed'}},new Date(),true), /Your booking is confirmed/)
})

for (const venue of ['ha-do-centrosa', 'cafe-des-stagiaires']) {
  for (const email of ['contact@vre-vietnam.com', ' CONTACT@VRE-VIETNAM.COM ', 'vrena-thaodien@vre-vietnam.com']) {
    test(`${venue}: shared client address ${email} receives only the venue notice`, () => {
      const { context, sentEmails } = loadScript()
      const payload = {event_type: 'ticket_booked', session: {id: 'booking-1', venue_key: venue}, customer: {email}}
      context.sendNotificationEmail(payload, new Date())
      context.sendNotificationEmail(payload, new Date())
      assert.equal(sentEmails.length, 1)
      assert.equal(sentEmails[0].to, venue === 'cafe-des-stagiaires' ? 'vrena-thaodien@vre-vietnam.com' : 'contact@vre-vietnam.com')
      assert.match(sentEmails[0].subject, /New ticket booking/)
    })
  }
}

test('repeated creation events send one venue notice and one real customer confirmation across executions', () => {
  const first = loadScript()
  const payload = {event_type: 'ticket_booked', session: {id: 'booking-2', venue_key: 'cafe-des-stagiaires'}, customer: {email: 'guest@example.com'}}
  first.context.sendNotificationEmail(payload, new Date())
  const retry = loadScript({sheets: first.sheets})
  retry.context.sendNotificationEmail({...payload, created_at: 'later', event_type: 'session_created'}, new Date())
  assert.equal(first.sentEmails.length, 2)
  assert.equal(retry.sentEmails.length, 0)
  retry.context.sendNotificationEmail({...payload, session: {...payload.session, id: 'another-booking'}}, new Date())
  assert.equal(retry.sentEmails.length, 2)
})

test('ambiguous customer send does not resend either audience on retry', () => {
  const first = loadScript({customerSendThrows: true})
  const payload = {event_type: 'ticket_booked', session: {id: 'booking-3', venue_key: 'cafe-des-stagiaires'}, customer: {email: 'guest@example.com'}}
  assert.throws(() => first.context.sendNotificationEmail(payload, new Date()), /Ambiguous mail failure/)
  const retry = loadScript({sheets: first.sheets})
  assert.throws(() => retry.context.sendNotificationEmail(payload, new Date()), /requires review/)
  assert.equal(retry.sentEmails.length, 0)
})

test('missing creation identity fails before sending', () => {
  const {context, sentEmails} = loadScript()
  assert.throws(() => context.sendBookingEmailOnce({event_type: 'ticket_booked', session: {}}, 'venue', () => {}), /Missing booking identity/)
  assert.equal(sentEmails.length, 0)
})
