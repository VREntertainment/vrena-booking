/**
 * VRena Google Sheets webhook receiver.
 *
 * Deploy this as a Google Apps Script Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 *
 * Then put the Web App URL and shared secret into Supabase:
 *
 * insert into private.integration_settings (key, value)
 * values
 *   ('google_sheets_webhook_url', 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'),
 *   ('google_sheets_webhook_secret', 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET')
 * on conflict (key) do update
 * set value = excluded.value,
 *     updated_at = now();
 */

const CONFIG = {
  SPREADSHEET_ID: '', // Leave blank when this script is bound to the Google Sheet.
  WEBHOOK_SECRET: 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET',
  EMAIL_RECIPIENTS_BY_VENUE: {
    'ha-do-centrosa': ['contact@vre-vietnam.com'],
    'cafe-des-stagiaires': ['vrena-thaodien@vre-vietnam.com', 'emile@vre-vietnam.com'],
  },
  SHEETS: {
    ticket_booked: 'Tickets',
    session_created: 'Sessions',
    raw: 'Webhook Raw',
  },
}

const MAIN_HEADERS = [
  'Received at',
  'Event',
  'Session ID',
  'Booking type',
  'Name',
  'Date',
  'Start time',
  'Duration min',
  'Max players',
  'Arena count',
  'Session type',
  'Visibility',
  'Status',
  'Game options',
  'Confirmed game',
  'Invite code',
  'Notes',
  'Owner name',
  'Owner email',
  'Owner phone',
  'Customer name',
  'Customer email',
  'Customer phone',
  'Ticket type',
  'Ticket players',
  'Ticket unit price',
  'Ticket total price',
  'Ticket status',
  'Ticket reference',
  'App URL',
]

const RAW_HEADERS = ['Received at', 'Event', 'Session ID', 'Raw JSON']

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Google Apps Script invokes this web-app entrypoint by name.
function doPost(event) {
  try {
    assertConfigured()
    const payload = parsePayload(event)
    verifySecret(payload)

    const receivedAt = new Date()
    appendEventRow(payload, receivedAt)
    appendRawRow(payload, receivedAt)
    sendNotificationEmail(payload, receivedAt)

    return jsonResponse({ ok: true })
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) })
  }
}

function assertConfigured() {
  if (!CONFIG.WEBHOOK_SECRET || CONFIG.WEBHOOK_SECRET === 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET') {
    throw new Error('WEBHOOK_SECRET is not configured in Apps Script.')
  }
}

function parsePayload(event) {
  const contents = event && event.postData && event.postData.contents
  if (!contents) throw new Error('Missing request body.')
  return JSON.parse(contents)
}

function verifySecret(payload) {
  if (payload.secret !== CONFIG.WEBHOOK_SECRET) {
    throw new Error('Invalid webhook secret.')
  }
}

function appendEventRow(payload, receivedAt) {
  const sheetName = payload.event_type === 'ticket_booked'
    ? CONFIG.SHEETS.ticket_booked
    : CONFIG.SHEETS.session_created
  const sheet = getOrCreateSheet(sheetName, MAIN_HEADERS)
  sheet.appendRow(buildMainRow(payload, receivedAt))
}

function appendRawRow(payload, receivedAt) {
  const sheet = getOrCreateSheet(CONFIG.SHEETS.raw, RAW_HEADERS)
  sheet.appendRow([
    receivedAt,
    payload.event_type || '',
    getSession(payload).id || '',
    JSON.stringify(payload),
  ])
}

function buildMainRow(payload, receivedAt) {
  const session = getSession(payload)
  const owner = payload.owner || {}
  const customer = payload.customer || {}

  return [
    receivedAt,
    payload.event_type || '',
    session.id || '',
    session.booking_type || '',
    session.name || '',
    session.date || '',
    session.start_time || '',
    session.duration_minutes || '',
    session.max_players || '',
    session.arena_count || '',
    session.session_type || '',
    session.visibility || '',
    session.status || '',
    Array.isArray(session.game_options) ? session.game_options.join(', ') : stringifyCell(session.game_options),
    session.confirmed_game_id || '',
    session.invite_code || '',
    session.notes || '',
    owner.name || '',
    owner.email || '',
    owner.phone || '',
    customer.name || '',
    customer.email || '',
    customer.phone || '',
    session.ticket_type || '',
    session.ticket_player_count || '',
    session.ticket_unit_price || '',
    session.ticket_total_price || '',
    session.ticket_status || '',
    session.ticket_reference || '',
    payload.app_url || '',
  ]
}

function sendNotificationEmail(payload, receivedAt) {
  const details = bookingEmailDetails(payload, receivedAt)
  const venueMessage = {
    to: bookingEmailRecipients(payload)[0],
    ...(bookingEmailRecipients(payload)[0] === 'vrena-thaodien@vre-vietnam.com'
      ? { bcc: 'emile@vre-vietnam.com' } : {}),
    subject: `[${details.venue}] ${details.heading}${details.reference ? ' · ' + details.reference : ''}`,
    body: buildEmailText(payload, receivedAt),
    htmlBody: buildEmailHtml(payload, receivedAt),
  }
  sendBookingEmailOnce(payload, 'venue', () => MailApp.sendEmail(venueMessage))
  const customerEmail = bookingCustomerEmail(payload)
  if (customerEmail) {
    const customerDetails = bookingEmailDetails(payload, receivedAt, true)
    const customerMessage = {
      to: customerEmail,
      replyTo: bookingEmailRecipients(payload)[0],
      name: customerDetails.venue,
      subject: `[${customerDetails.venue}] ${customerDetails.heading}${customerDetails.reference ? ' · ' + customerDetails.reference : ''}`,
      body: buildEmailText(payload, receivedAt, true),
      htmlBody: buildEmailHtml(payload, receivedAt, true),
    }
    sendBookingEmailOnce(payload, 'customer', () => GmailApp.sendEmail(customerMessage.to, customerMessage.subject, customerMessage.body, {
      from: customerMessage.replyTo,
      replyTo: customerMessage.replyTo,
      name: customerMessage.name,
      htmlBody: customerMessage.htmlBody,
    }))
  }
}

// Keep a durable receipt per booking and audience. Reserve before sending so a
// timeout with an unknown mail outcome cannot cause a second copy on retry.
function sendBookingEmailOnce(payload, audience, send) {
  if (!['ticket_booked', 'session_created'].includes(payload.event_type)) {
    send()
    return
  }
  const session = getSession(payload)
  const identity = session.id || session.ticket_reference
  if (!identity) throw new Error('Missing booking identity for email deduplication.')
  const key = 'booking-created:' + identity + ':' + audience
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const sheet = getOrCreateSheet('Email Deliveries', ['Delivery key', 'Status', 'Updated at'])
    const match = sheet.getRange(1, 1, sheet.getLastRow(), 1)
      .createTextFinder(key).matchEntireCell(true).useRegularExpression(false).findNext()
    if (match) {
      const status = sheet.getRange(match.getRow(), 2).getValue()
      if (status === 'sent') return
      throw new Error('Email delivery requires review before retry: ' + key)
    }
    sheet.appendRow([key, 'sending', new Date()])
    const row = sheet.getLastRow()
    SpreadsheetApp.flush()
    send()
    sheet.getRange(row, 2, 1, 2).setValues([['sent', new Date()]])
    SpreadsheetApp.flush()
  } finally {
    lock.releaseLock()
  }
}

function bookingCustomerEmail(payload) {
  // Only creation confirmations; never use the staff/owner address as a fallback.
  if (!['ticket_booked', 'session_created'].includes(payload.event_type)) return ''
  const email = String((payload.customer || {}).email || '').trim()
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) return ''
  if (/\.(invalid|local)$/i.test(email)) return ''
  // Shared venue inboxes receive the venue notice, never a customer confirmation.
  const venueInboxes = Object.values(CONFIG.EMAIL_RECIPIENTS_BY_VENUE).map((recipients) => recipients[0].toLowerCase())
  if (venueInboxes.includes(email.toLowerCase())) return ''
  return email
}

function bookingEmailRecipients(payload) {
  const session = getSession(payload)
  const venueKey = session.venue_key || (payload.raw_session || {}).venue_key
    || (/^(?:TD|CS)-/.test(String(session.ticket_reference || '')) ? 'cafe-des-stagiaires' : 'ha-do-centrosa')
  const recipients = CONFIG.EMAIL_RECIPIENTS_BY_VENUE[venueKey]
  if (!recipients) throw new Error('Unknown booking venue: ' + venueKey)
  return recipients
}

function bookingShopName(payload) {
  const session = getSession(payload)
  const venueKey = session.venue_key || (payload.raw_session || {}).venue_key
  if (venueKey === 'ha-do-centrosa') return 'VRena Hà Đô Centrosa'
  if (venueKey === 'cafe-des-stagiaires') return 'VRena Thao Dien'
  if (venueKey) return 'Unknown shop (' + venueKey + ')'
  // Earlier webhook versions omitted the venue but retained the venue-specific reference.
  return /^(?:TD|CS)-/.test(String(session.ticket_reference || ''))
    ? 'VRena Thao Dien'
    : 'VRena Hà Đô Centrosa'
}

function readableLabel(value) {
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function visitDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return value || ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`
}

function bookingEmailDetails(payload, receivedAt, forCustomer) {
  const session = getSession(payload)
  const owner = payload.owner || {}
  const customer = payload.customer || owner
  const venue = bookingShopName(payload)
  const event = String(payload.event_type || '')
  const isTicket = event.startsWith('ticket_') || session.booking_type === 'ticket'
  let heading = event.includes('cancelled') ? 'Booking cancelled'
    : event.includes('deleted') ? 'Booking deleted'
      : event.includes('updated') ? 'Booking updated'
        : isTicket ? 'New ticket booking' : 'New session booking'
  const status = session.ticket_status || session.status || ''
  const statusLabel = status === 'pending' ? 'Awaiting confirmation' : readableLabel(status)
  const customerMessage = status === 'pending'
    ? 'We have received your booking request. Your booking is awaiting confirmation from our team.'
    : status === 'confirmed' ? 'Your booking is confirmed. We look forward to welcoming you.'
      : 'We have received your booking. Please check the status and visit details below.'
  if (forCustomer) heading = status === 'pending' ? 'Booking request received' : status === 'confirmed' ? 'Booking confirmed' : 'Booking received'
  const gameOptions = Array.isArray(session.game_options)
    ? session.game_options.filter(Boolean).map(readableLabel).join(', ')
    : readableLabel(session.game_options)
  const notes = String(session.notes || '')
    .replace(/(?:VRena\s+)?Caf[eé] des Stagiaires|Vrena Thao Dien/gi, 'VRena Thao Dien')
  const reference = String(session.ticket_reference || '').replace(/^CS-/, 'TD-')
  const name = /^Cafe soft-opening request\s*-/i.test(session.name || '')
    ? venue : session.name || ''
  let sections = [
    ['Your visit', [
      ['Venue', venue],
      ['Booking', name && name !== venue ? name : ''],
      ['Date & time', [visitDate(session.date), String(session.start_time || '').slice(0, 5)].filter(Boolean).join(' · ')],
      ['Duration', session.duration_minutes ? `${session.duration_minutes} minutes` : ''],
      ['Players', session.ticket_player_count || session.max_players || ''],
      ['Game options', gameOptions],
      ['Ticket', readableLabel(session.ticket_type)],
    ]],
    ['Customer', [
      ['Name', customer.name || ''],
      ['Phone', customer.phone || ''],
      ['Email', customer.email || ''],
      ['Booked by', compactContact(owner) !== compactContact(customer) ? compactContact(owner) : ''],
    ]],
    ['Price', [
      ['Per player', formatVnd(session.ticket_unit_price)],
      ['Booking total', formatVnd(session.ticket_total_price)],
    ]],
    ['Notes & requests', [['Notes', notes], ['Player notice', payload.minor_warning || '']]],
    ['Booking details', [
      ['Reference', reference],
      ['Status', statusLabel],
      ['Invite code', session.invite_code || ''],
      ['Visibility', readableLabel(session.visibility)],
      ['Changes', Array.isArray(payload.changed_fields) ? payload.changed_fields.map(readableLabel).join(', ') : ''],
      ['Received', formatDateTime(receivedAt) + ' (Vietnam time)'],
      ['Internal session ID', session.id || ''],
    ]],
  ].map(([title, rows]) => [title, rows.filter((row) => row[1] !== '' && row[1] !== null && row[1] !== undefined)])
    .filter((section) => section[1].length)
  if (forCustomer) {
    // Explicit allowlist prevents staff notes, ownership, IDs and audit metadata leaking to customers.
    const allowed = {
      'Your visit': ['Venue', 'Booking', 'Date & time', 'Duration', 'Players', 'Game options', 'Ticket'],
      'Customer': ['Name', 'Phone', 'Email'],
      'Price': ['Per player', 'Booking total'],
      'Booking details': ['Reference', 'Status'],
    }
    sections = sections.filter(([title]) => allowed[title])
      .map(([title, rows]) => [title, rows.filter(([label]) => allowed[title].includes(label))])
      .filter((section) => section[1].length)
  }
  return { venue, heading, statusLabel, reference, sections, customerMessage }
}

function buildEmailText(payload, receivedAt, forCustomer) {
  const details = bookingEmailDetails(payload, receivedAt, forCustomer)
  return [details.venue, details.heading, details.statusLabel, forCustomer ? details.customerMessage : '', '',
    ...details.sections.flatMap(([title, rows]) => [title.toUpperCase(), ...rows.map(([label, value]) => `${label}: ${value}`), '']),
    'All visit times are Vietnam time (UTC+7).',
    forCustomer ? 'Questions? Reply to this email to contact the venue team.' : 'Open booking webapp: https://booking.vre-vietnam.com',
  ].join('\n')
}

function buildEmailHtml(payload, receivedAt, forCustomer) {
  const details = bookingEmailDetails(payload, receivedAt, forCustomer)
  const sections = details.sections.map(([title, rows]) => `
    <h2 style="font-family:'League Spartan',Arial,sans-serif;font-size:18px;margin:26px 0 8px;color:#020E0E">${escapeHtml(title)}</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse;font-size:14px;line-height:1.6">
      ${rows.map(([label, value]) => `<tr><th align="left" valign="top" width="32%" style="padding:7px 12px 7px 0;font-weight:400;color:#5F6D6D;border-bottom:1px solid #EEEEEE">${escapeHtml(label)}</th><td valign="top" style="padding:7px 0;border-bottom:1px solid #EEEEEE;overflow-wrap:anywhere;word-break:break-word;${label === 'Booking total' ? 'font-size:20px;font-weight:700;' : ''}">${escapeHtml(value)}</td></tr>`).join('')}
    </table>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#F5F7F7;color:#020E0E;font-family:Inter,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-top:5px solid #525BFD;padding:24px 20px">
      <img src="https://booking.vre-vietnam.com/brand/vrena-logo-full-light.png" alt="VRena" width="176" height="36" style="display:block;width:176px;height:auto;max-width:100%;border:0;margin:0 0 28px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#332CD6">${escapeHtml(details.venue)}</p>
      <h1 style="font-family:'League Spartan',Arial,sans-serif;font-size:27px;line-height:1.2;margin:0 0 12px">${escapeHtml(details.heading)}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6">${escapeHtml(details.statusLabel)}${details.reference ? '<br>Reference: <strong>' + escapeHtml(details.reference) + '</strong>' : ''}</p>
      ${forCustomer ? '<p style="font-size:15px;line-height:1.6;margin:18px 0 0">' + escapeHtml(details.customerMessage) + '</p>' : ''}
      ${sections}
      <p style="margin:24px 0 12px"><a href="https://booking.vre-vietnam.com" style="display:inline-block;background:#332CD6;color:#FFFFFF;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:700;font-size:14px">${forCustomer ? 'Visit VRena booking' : 'Open booking webapp'}</a></p>
      <p style="font-size:12px;line-height:1.5;color:#5F6D6D;margin:0">All visit times are Vietnam time (UTC+7).${forCustomer ? '<br>Questions? Reply to this email to contact the venue team.' : ''}</p>
    </div></body></html>`
}

function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
  return SpreadsheetApp.getActiveSpreadsheet()
}

function getOrCreateSheet(name, headers) {
  const spreadsheet = getSpreadsheet()
  let sheet = spreadsheet.getSheetByName(name)
  if (!sheet) sheet = spreadsheet.insertSheet(name)

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers)
    sheet.setFrozenRows(1)
  }

  return sheet
}

function getSession(payload) {
  return payload.session || {}
}

function compactContact(contact) {
  return [contact.name, contact.email, contact.phone].filter(Boolean).join(' · ')
}

function stringifyCell(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function formatVnd(value) {
  const number = Number(value || 0)
  if (!number) return ''
  return `${number.toLocaleString('vi-VN')} ₫`
}

function formatDateTime(date) {
  return Utilities.formatDate(date, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss')
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
}
