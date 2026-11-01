import { vrenaPalette } from './theme/vrenaPalette.ts'
/** Shared, email-client-safe layout. The Apps Script copy is generated from this file. */
export type BookingEmailSnapshot = {
  venue: string; reference: string; status: string; date: string; time: string
  players: string; total: string; source: string; customerName: string
  customerPhone: string; customerEmail: string; notes: string
}

export function bookingSourceLabel(value: unknown) {
  const source = String(value ?? '').trim()
  const labels: Record<string, string> = { website: 'Online', online: 'Online', walk_in: 'Walk-in', phone: 'Phone', zalo: 'Zalo', whatsapp: 'WhatsApp', other: 'Other' }
  return labels[source.toLowerCase()] || source || 'Unspecified'
}

export function bookingMoney(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')} ₫` : '—'
}

export function bookingStatus(value: unknown) {
  const status = String(value ?? '')
  if (status === 'open' || status === 'confirmed' || status === 'paid') return 'Confirmed'
  if (status === 'pending') return 'Awaiting confirmation'
  return status ? status[0].toUpperCase() + status.slice(1) : 'Unspecified'
}

export function bookingEscape(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function renderBookingEmail(current: BookingEmailSnapshot, previous?: Partial<BookingEmailSnapshot> | null, action = 'created', notice = '') {
  const heading = action === 'created' ? 'New booking' : action === 'cancelled' ? 'Booking cancelled' : action === 'deleted' ? 'Booking deleted' : 'Booking modified'
  const changed = (key: keyof BookingEmailSnapshot) => Boolean(previous && Object.hasOwn(previous, key) && previous[key] !== current[key])
  const plain = (key: keyof BookingEmailSnapshot) => changed(key) ? `${previous?.[key] || '—'} → ${current[key] || '—'}` : current[key] || '—'
  const value = (key: keyof BookingEmailSnapshot, input: string) => {
    const escaped = bookingEscape(input || '—').replace(/\n/g, '<br>')
    if (key === 'customerPhone' && /^[+\d\s().-]+$/.test(input) && /\d/.test(input)) return `<a style="color:inherit;text-decoration:underline" href="tel:${bookingEscape(input.replace(/[^+\d]/g, ''))}">${escaped}</a>`
    if (key === 'customerEmail' && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(input)) return `<a style="color:inherit;text-decoration:underline" href="mailto:${bookingEscape(input)}">${escaped}</a>`
    return escaped
  }
  const field = (key: keyof BookingEmailSnapshot) => changed(key)
    ? `<del style="color:${vrenaPalette.neutral[600]};font-weight:400">${bookingEscape(previous?.[key] || '—').replace(/\n/g, '<br>')}</del><br><strong>${value(key, current[key])}</strong>`
    : value(key, current[key])
  const rows: Array<[string, keyof BookingEmailSnapshot]> = [['Date', 'date'], ['Time', 'time'], ['Players', 'players'], ['Total price', 'total'], ['Booking source', 'source']]
  const notes = current.notes || (changed('notes') && previous?.notes)
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:${vrenaPalette.neutral[100]};color:${vrenaPalette.neutral[950]};font-family:Inter,Arial,sans-serif">
<div style="max-width:560px;margin:auto;padding:28px 24px;background:${vrenaPalette.white};border-top:4px solid ${vrenaPalette.purple[500]}">
<img src="https://booking.vre-vietnam.com/brand/vrena-logo-full-light.png" alt="VRena" width="176" style="display:block;width:176px;height:auto;border:0;margin:0 0 24px">
<p style="font-size:13px;color:${vrenaPalette.purple[700]};margin:0 0 10px">Status: ${field('status')}</p>
<h1 style="font-family:'League Spartan',Inter,Arial,sans-serif;font-size:28px;line-height:1.2;margin:0 0 18px">${heading}</h1>
<h2 style="font-size:19px;margin:0 0 6px">${field('venue')}</h2><p style="font-size:13px;color:${vrenaPalette.neutral[600]};margin:0 0 20px">${field('reference')}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px;line-height:1.5">${rows.map(([label,key]) => `<tr><td valign="top" width="36%" style="padding:9px 12px 9px 0;border-top:1px solid ${vrenaPalette.neutral[200]};color:${vrenaPalette.neutral[600]}">${label}</td><td valign="top" style="padding:9px 0;border-top:1px solid ${vrenaPalette.neutral[200]};overflow-wrap:anywhere">${field(key)}</td></tr>`).join('')}</table>
<div style="border-top:1px solid ${vrenaPalette.neutral[200]};margin-top:16px;padding-top:20px;line-height:1.6;overflow-wrap:anywhere"><h2 style="font-size:19px;margin:0 0 6px">${field('customerName')}</h2>${current.customerPhone || changed('customerPhone') ? `<p style="margin:2px 0">${field('customerPhone')}</p>` : ''}${current.customerEmail || changed('customerEmail') ? `<p style="margin:2px 0">${field('customerEmail')}</p>` : ''}</div>
${notes ? `<div style="border-top:1px solid ${vrenaPalette.neutral[200]};margin-top:20px;padding-top:16px;font-size:14px;line-height:1.6;overflow-wrap:anywhere"><p style="color:${vrenaPalette.neutral[600]};margin:0 0 4px">Notes</p>${field('notes')}</div>` : ''}
${notice ? `<p style="font-size:13px;line-height:1.5">${bookingEscape(notice)}</p>` : ''}
<p style="font-size:11px;color:${vrenaPalette.neutral[600]};margin:24px 0 0">Vietnam time (UTC+7)</p></div></body></html>`
  const text = [heading, `Status: ${plain('status')}`, `Venue: ${plain('venue')}`, `Reference: ${plain('reference')}`, '', ...rows.map(([label,key]) => `${label}: ${plain(key)}`), '', `Customer: ${plain('customerName')}`, current.customerPhone || changed('customerPhone') ? `Phone: ${plain('customerPhone')}` : '', current.customerEmail || changed('customerEmail') ? `Email: ${plain('customerEmail')}` : '', notes ? `\nNotes: ${plain('notes')}` : '', notice, '\nVietnam time (UTC+7)'].filter(Boolean).join('\n')
  return { html, text, heading }
}
