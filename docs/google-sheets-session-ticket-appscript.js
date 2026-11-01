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
    JSON.stringify({ ...payload, secret: '[REDACTED]' }),
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
  const venueMessage = { replyTo: bookingEmailRecipients(payload)[0], name: details.venue,
    to: bookingEmailRecipients(payload)[0],
    ...(bookingEmailRecipients(payload)[0] === 'vrena-thaodien@vre-vietnam.com'
      ? { bcc: 'emile@vre-vietnam.com' } : {}),
    subject: `[${details.venue}] ${details.heading}${details.reference ? ' · ' + details.reference : ''}`,
    body: buildEmailText(payload, receivedAt),
    htmlBody: buildEmailHtml(payload, receivedAt),
  }
  sendBookingEmailOnce(payload, 'venue', () => GmailApp.sendEmail(venueMessage.to, venueMessage.subject, venueMessage.body, {from: venueMessage.replyTo, replyTo: venueMessage.replyTo, name: venueMessage.name, ...(venueMessage.bcc ? {bcc: venueMessage.bcc} : {}), htmlBody: venueMessage.htmlBody}))
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
  if (!['ticket_booked', 'session_created'].includes(payload.event_type) && !payload.event_id) {
    send()
    return
  }
  const session = getSession(payload)
  const identity = session.id || session.ticket_reference
  if (!identity) throw new Error('Missing booking identity for email deduplication.')
  const key = (['ticket_booked', 'session_created'].includes(payload.event_type) ? 'booking-created:' + identity : 'booking-event:' + payload.event_id) + ':' + audience
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
  if (venueKey === 'cafe-des-stagiaires') return 'VRena Thảo Điền'
  if (venueKey) return 'Unknown shop (' + venueKey + ')'
  // Earlier webhook versions omitted the venue but retained the venue-specific reference.
  return /^(?:TD|CS)-/.test(String(session.ticket_reference || ''))
    ? 'VRena Thảo Điền'
    : 'VRena Hà Đô Centrosa'
}

function visitDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return value || ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`
}

function bookingSnapshot(payload, previous, forCustomer) {
  const session = previous ? payload.previous_session || {} : getSession(payload)
  const order = previous ? payload.previous_order || {} : payload.order || {}
  const customer = previous ? payload.previous_customer || {} : payload.customer || {}
  const venuePayload = { session, raw_session: previous ? payload.previous_raw_session : payload.raw_session }
  return {
    venue: bookingShopName(venuePayload),
    reference: String(order.order_number || session.ticket_reference || '').replace(/^CS-/, 'TD-'),
    status: session.deleted_at ? 'Deleted' : bookingStatus(session.status === 'cancelled' || order.order_status === 'cancelled' ? 'cancelled' : session.ticket_status || session.status),
    date: visitDate(session.date || order.booking_date),
    time: String(session.start_time || order.booking_time || '').slice(0, 5),
    players: String(session.ticket_player_count ?? session.max_players ?? order.players_count ?? '—'),
    total: bookingMoney(order.total ?? session.ticket_total_price),
    source: bookingSourceLabel(order.booking_source || session.booking_source),
    customerName: String(customer.name || ''), customerPhone: String(customer.phone || ''), customerEmail: String(customer.email || ''),
    // Session notes are internal in the current application. Keep them staff-only.
    notes: forCustomer ? '' : String(session.notes || '').replace(/(?:VRena\s+)?Caf[eé] des Stagiaires|Vrena Thao Dien/gi, 'VRena Thảo Điền'),
  }
}

function bookingEmailDetails(payload, receivedAt, forCustomer) {
  const current = bookingSnapshot(payload, false, forCustomer)
  let previous = payload.previous_session ? bookingSnapshot(payload, true, forCustomer) : null
  if (previous && !payload.previous_customer) {
    // Legacy payloads contain no old contact/source: do not invent changes.
    previous.customerName = current.customerName
    previous.customerPhone = current.customerPhone
    previous.customerEmail = current.customerEmail
    if (!payload.previous_order) previous.source = current.source
  }
  const event = String(payload.event_type || '')
  const action = event.includes('deleted') ? 'deleted' : event.includes('cancelled') ? 'cancelled' : event.includes('updated') ? 'edited' : 'created'
  const rendered = renderBookingEmail(current, previous, action, forCustomer ? '' : payload.minor_warning || '')
  return { ...rendered, venue: current.venue, reference: current.reference, statusLabel: current.status }
}

function buildEmailText(payload, receivedAt, forCustomer) {
  return bookingEmailDetails(payload, receivedAt, forCustomer).text
}

function buildEmailHtml(payload, receivedAt, forCustomer) {
  return bookingEmailDetails(payload, receivedAt, forCustomer).html
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

function stringifyCell(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
}

// BEGIN GENERATED BOOKING EMAIL TEMPLATE
const vrenaPalette = {
    white: '#ffffff',
    purple: {
        50: '#edf2ff',
        100: '#dde6ff',
        200: '#c2d0ff',
        300: '#9eb2ff',
        400: '#7788ff',
        500: '#525bfd',
        600: '#3d38f3',
        700: '#332cd6',
        800: '#2a26ad',
        900: '#272788',
        950: '#19174f',
    },
    cyan: {
        50: '#ebfffd',
        100: '#cefffd',
        200: '#a2fffd',
        300: '#63fdfb',
        400: '#1cf3f4',
        500: '#00e9ed',
        600: '#03abb7',
        700: '#0a8894',
        800: '#126d78',
        900: '#145965',
        950: '#063c46',
    },
    orange: {
        50: '#fff7ec',
        100: '#ffecd3',
        200: '#ffd6a6',
        300: '#ffb96d',
        400: '#ff9033',
        500: '#ff710b',
        600: '#fd5901',
        700: '#cb3f03',
        800: '#a1320b',
        900: '#812b0d',
        950: '#461304',
    },
    yellow: {
        50: '#fffdea',
        100: '#fff9c5',
        200: '#fff285',
        300: '#ffe546',
        400: '#ffd51b',
        500: '#ffb800',
        600: '#e28e00',
        700: '#bb6302',
        800: '#984c08',
        900: '#7c3e0b',
        950: '#482000',
    },
    green: {
        50: '#f4fef6',
        100: '#eafdef',
        200: '#d6fce2',
        300: '#b9facf',
        400: '#87f8b9',
        500: '#49f59f',
        600: '#16d07b',
        700: '#12b469',
        800: '#0d9458',
        900: '#097f4e',
        950: '#0d4f34',
    },
    blue: {
        50: '#f0f8fe',
        100: '#e2f1fd',
        200: '#cae4fd',
        300: '#a8d4fc',
        400: '#7cbdfd',
        500: '#47a8fc',
        600: '#0d8ce1',
        700: '#0979c2',
        800: '#0663a2',
        900: '#1b5486',
        950: '#173251',
    },
    red: {
        50: '#fff1f0',
        100: '#ffe4e3',
        200: '#feccc9',
        300: '#feaba6',
        400: '#fc7c75',
        500: '#f5454a',
        600: '#dc0e31',
        700: '#be0a29',
        800: '#9d071f',
        900: '#82181c',
        950: '#4d120e',
    },
    neutral: {
        50: '#fafbfb',
        100: '#f5f7f7',
        200: '#eeeeee',
        300: '#d8dede',
        400: '#b8c3c3',
        500: '#879595',
        600: '#5f6d6d',
        700: '#3b4a4a',
        800: '#1b2929',
        900: '#0b1717',
        950: '#020e0e',
    },
};
function bookingSourceLabel(value) {
    const source = String(value ?? '').trim();
    const labels = { website: 'Online', online: 'Online', walk_in: 'Walk-in', phone: 'Phone', zalo: 'Zalo', whatsapp: 'WhatsApp', other: 'Other' };
    return labels[source.toLowerCase()] || source || 'Unspecified';
}
function bookingMoney(value) {
    if (value === null || value === undefined || value === '')
        return '—';
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')} ₫` : '—';
}
function bookingStatus(value) {
    const status = String(value ?? '');
    if (status === 'open' || status === 'confirmed' || status === 'paid')
        return 'Confirmed';
    if (status === 'pending')
        return 'Awaiting confirmation';
    return status ? status[0].toUpperCase() + status.slice(1) : 'Unspecified';
}
function bookingEscape(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function renderBookingEmail(current, previous, action = 'created', notice = '') {
    const heading = action === 'created' ? 'New booking' : action === 'cancelled' ? 'Booking cancelled' : action === 'deleted' ? 'Booking deleted' : 'Booking modified';
    const changed = (key) => Boolean(previous && Object.hasOwn(previous, key) && previous[key] !== current[key]);
    const plain = (key) => changed(key) ? `${previous?.[key] || '—'} → ${current[key] || '—'}` : current[key] || '—';
    const value = (key, input) => {
        const escaped = bookingEscape(input || '—').replace(/\n/g, '<br>');
        if (key === 'customerPhone' && /^[+\d\s().-]+$/.test(input) && /\d/.test(input))
            return `<a style="color:inherit;text-decoration:underline" href="tel:${bookingEscape(input.replace(/[^+\d]/g, ''))}">${escaped}</a>`;
        if (key === 'customerEmail' && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(input))
            return `<a style="color:inherit;text-decoration:underline" href="mailto:${bookingEscape(input)}">${escaped}</a>`;
        return escaped;
    };
    const field = (key) => changed(key)
        ? `<del style="color:${vrenaPalette.neutral[600]};font-weight:400">${bookingEscape(previous?.[key] || '—').replace(/\n/g, '<br>')}</del><br><strong>${value(key, current[key])}</strong>`
        : value(key, current[key]);
    const rows = [['Date', 'date'], ['Time', 'time'], ['Players', 'players'], ['Total price', 'total'], ['Booking source', 'source']];
    const notes = current.notes || (changed('notes') && previous?.notes);
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:${vrenaPalette.neutral[100]};color:${vrenaPalette.neutral[950]};font-family:Inter,Arial,sans-serif">
<div style="max-width:560px;margin:auto;padding:28px 24px;background:${vrenaPalette.white};border-top:4px solid ${vrenaPalette.purple[500]}">
<img src="https://booking.vre-vietnam.com/brand/vrena-logo-full-light.png" alt="VRena" width="176" style="display:block;width:176px;height:auto;border:0;margin:0 0 24px">
<p style="font-size:13px;color:${vrenaPalette.purple[700]};margin:0 0 10px">Status: ${field('status')}</p>
<h1 style="font-family:'League Spartan',Inter,Arial,sans-serif;font-size:28px;line-height:1.2;margin:0 0 18px">${heading}</h1>
<h2 style="font-size:19px;margin:0 0 6px">${field('venue')}</h2><p style="font-size:13px;color:${vrenaPalette.neutral[600]};margin:0 0 20px">${field('reference')}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px;line-height:1.5">${rows.map(([label, key]) => `<tr><td valign="top" width="36%" style="padding:9px 12px 9px 0;border-top:1px solid ${vrenaPalette.neutral[200]};color:${vrenaPalette.neutral[600]}">${label}</td><td valign="top" style="padding:9px 0;border-top:1px solid ${vrenaPalette.neutral[200]};overflow-wrap:anywhere">${field(key)}</td></tr>`).join('')}</table>
<div style="border-top:1px solid ${vrenaPalette.neutral[200]};margin-top:16px;padding-top:20px;line-height:1.6;overflow-wrap:anywhere"><h2 style="font-size:19px;margin:0 0 6px">${field('customerName')}</h2>${current.customerPhone || changed('customerPhone') ? `<p style="margin:2px 0">${field('customerPhone')}</p>` : ''}${current.customerEmail || changed('customerEmail') ? `<p style="margin:2px 0">${field('customerEmail')}</p>` : ''}</div>
${notes ? `<div style="border-top:1px solid ${vrenaPalette.neutral[200]};margin-top:20px;padding-top:16px;font-size:14px;line-height:1.6;overflow-wrap:anywhere"><p style="color:${vrenaPalette.neutral[600]};margin:0 0 4px">Notes</p>${field('notes')}</div>` : ''}
${notice ? `<p style="font-size:13px;line-height:1.5">${bookingEscape(notice)}</p>` : ''}
<p style="font-size:11px;color:${vrenaPalette.neutral[600]};margin:24px 0 0">Vietnam time (UTC+7)</p></div></body></html>`;
    const text = [heading, `Status: ${plain('status')}`, `Venue: ${plain('venue')}`, `Reference: ${plain('reference')}`, '', ...rows.map(([label, key]) => `${label}: ${plain(key)}`), '', `Customer: ${plain('customerName')}`, current.customerPhone || changed('customerPhone') ? `Phone: ${plain('customerPhone')}` : '', current.customerEmail || changed('customerEmail') ? `Email: ${plain('customerEmail')}` : '', notes ? `\nNotes: ${plain('notes')}` : '', notice, '\nVietnam time (UTC+7)'].filter(Boolean).join('\n');
    return { html, text, heading };
}
