import { venueContact } from './venueContacts.ts'
export type CalendarReservation = {
  hasAccount?: boolean; id: string; reference: string; date: string; time: string; durationMinutes: number
  venue: 'ha-do-centrosa' | 'cafe-des-stagiaires'; title: string
}
const venues = {
  'ha-do-centrosa': 'VRena Hà Đô Centrosa, Iris 4, Hà Đô Centrosa, District 10, Ho Chi Minh City',
  'cafe-des-stagiaires': 'VRena Thảo Điền, 8–10 Street 54, An Khánh, Ho Chi Minh City',
}
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
function times(booking: CalendarReservation) {
  const start = new Date(`${booking.date}T${booking.time.slice(0, 5)}:00+07:00`)
  return [stamp(start), stamp(new Date(start.getTime() + booking.durationMinutes * 60000))]
}
export function reservationDetails(booking: CalendarReservation) {
  return { location: venues[booking.venue], phone: venueContact(booking.venue).phone, tel: venueContact(booking.venue).tel, url: `https://booking.vre-vietnam.com${booking.hasAccount ? '/profile' : '/'}` }
}
export function reservationCalendarFile(booking: CalendarReservation, now = new Date()) {
  const [start, end] = times(booking)
  const details = reservationDetails(booking)
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//VRena//Reservations//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:vrena-${escape(booking.id)}@vrena-booking`,`DTSTAMP:${stamp(now)}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${escape(booking.title)}`,`LOCATION:${escape(venues[booking.venue])}`,`DESCRIPTION:${escape(`Booking reference: ${booking.reference}\nPhone: ${details.phone}\n${details.url}`)}`,`URL:${details.url}`,'BEGIN:VALARM','TRIGGER:-PT1H','ACTION:DISPLAY',`DESCRIPTION:${escape(booking.title)}`,'END:VALARM','END:VEVENT','END:VCALENDAR']
  // Fold by UTF-8 octets so Vietnamese addresses remain valid in calendar apps.
  return lines.map(line => {
    const chunks: string[] = []; let chunk = ''; let bytes = 0
    for (const character of line) {
      const size = new TextEncoder().encode(character).length
      if (bytes + size > 75) { chunks.push(chunk); chunk = ' '; bytes = 1 }
      chunk += character; bytes += size
    }
    chunks.push(chunk); return chunks.join('\r\n')
  }).join('\r\n') + '\r\n'
}
