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
  EMAIL_RECIPIENTS: ['contact@vre-vietnam.com', 'emile@vre-vietnam.com'],
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
  const session = getSession(payload)
  const customer = payload.customer || {}
  const isTicket = payload.event_type === 'ticket_booked'
  const subject = isTicket
    ? `[VRena] New ticket booking ${session.ticket_reference || ''}`.trim()
    : `[VRena] New session created: ${session.name || 'Untitled session'}`

  const lines = [
    isTicket ? 'A new ticket booking was created.' : 'A new community session was created.',
    '',
    `Received: ${formatDateTime(receivedAt)}`,
    `Name: ${session.name || ''}`,
    `Date: ${session.date || ''}`,
    `Time: ${session.start_time || ''}`,
    `Duration: ${session.duration_minutes || ''} min`,
    `Players: ${session.ticket_player_count || session.max_players || ''}`,
    `Customer: ${customer.name || ''}`,
    `Customer email: ${customer.email || ''}`,
    `Customer phone: ${customer.phone || ''}`,
    `Ticket type: ${session.ticket_type || ''}`,
    `Ticket reference: ${session.ticket_reference || ''}`,
    `Total price: ${formatVnd(session.ticket_total_price)}`,
    `Session ID: ${session.id || ''}`,
  ]

  MailApp.sendEmail({
    to: CONFIG.EMAIL_RECIPIENTS.join(','),
    subject,
    body: lines.join('\n'),
    htmlBody: buildEmailHtml(payload, receivedAt),
  })
}

function buildEmailHtml(payload, receivedAt) {
  const session = getSession(payload)
  const owner = payload.owner || {}
  const customer = payload.customer || {}
  const rows = [
    ['Received', formatDateTime(receivedAt)],
    ['Event', payload.event_type || ''],
    ['Session ID', session.id || ''],
    ['Name', session.name || ''],
    ['Date', session.date || ''],
    ['Time', session.start_time || ''],
    ['Duration', session.duration_minutes ? `${session.duration_minutes} min` : ''],
    ['Players', session.ticket_player_count || session.max_players || ''],
    ['Booking type', session.booking_type || ''],
    ['Ticket type', session.ticket_type || ''],
    ['Ticket reference', session.ticket_reference || ''],
    ['Ticket status', session.ticket_status || ''],
    ['Unit price', formatVnd(session.ticket_unit_price)],
    ['Total price', formatVnd(session.ticket_total_price)],
    ['Visibility', session.visibility || ''],
    ['Invite code', session.invite_code || ''],
    ['Game options', Array.isArray(session.game_options) ? session.game_options.join(', ') : stringifyCell(session.game_options)],
    ['Owner', compactContact(owner)],
    ['Customer', compactContact(customer)],
    ['Notes', session.notes || ''],
    ['App', payload.app_url || ''],
  ]

  const tableRows = rows
    .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('')

  return `
    <div style="font-family:Arial,sans-serif;color:#071112">
      <h2 style="margin:0 0 12px">${payload.event_type === 'ticket_booked' ? 'New ticket booking' : 'New session created'}</h2>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #d9e1e5">
        ${tableRows}
      </table>
    </div>
  `
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
