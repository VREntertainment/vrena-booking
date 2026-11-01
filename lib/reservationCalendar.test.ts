import test from 'node:test'
import assert from 'node:assert/strict'
import { reservationCalendarFile, reservationDetails, type CalendarReservation } from './reservationCalendar.ts'
const booking: CalendarReservation = { id: 'test', reference: 'REF1', date: '2026-11-01', time: '23:30', durationMinutes: 120, venue: 'ha-do-centrosa', title: 'VRena · Birthday' }
test('calendar uses Vietnam time, correct duration across midnight and one hour alarm', () => {
  const file = reservationCalendarFile(booking)
  assert.match(file,/DTSTART:20261101T163000Z/)
  assert.match(file,/DTEND:20261101T183000Z/)
  assert.match(file,/TRIGGER:-PT1H/)
  assert.match(file,/0981152315/)
  assert.match(file,/URL:https:\/\/booking.vre-vietnam.com\//)
  for (const line of file.split('\r\n')) assert.ok(new TextEncoder().encode(line).length<=75)
})
test('venue contacts and account links are scoped to the confirmed booking', () => {
  assert.equal(reservationDetails(booking).url,'https://booking.vre-vietnam.com/')
  assert.equal(reservationDetails({...booking,hasAccount:true}).url,'https://booking.vre-vietnam.com/profile')
  const file=reservationCalendarFile({...booking,venue:'cafe-des-stagiaires',durationMinutes:15,title:'Text, with; newline\nEND:VEVENT'})
  assert.match(file,/0981157039/)
  assert.match(file,/DTEND:20261101T164500Z/)
  assert.match(file,/SUMMARY:Text\\, with\\; newline\\nEND:VEVENT/)
  assert.equal(file.split('\r\n').filter(x=>x==='END:VEVENT').length,1)
})
