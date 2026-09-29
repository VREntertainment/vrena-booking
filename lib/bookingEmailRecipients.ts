/** Venue routing is explicit so a global environment override cannot leak bookings across shops. */
export function bookingEmailRecipients(venueKey?: string | null, reference?: string | null): string[] {
  const venue = venueKey || (/^(?:TD|CS)-/.test(reference || '') ? 'cafe-des-stagiaires' : 'ha-do-centrosa')
  if (venue === 'cafe-des-stagiaires') return ['vrena-thaodien@vre-vietnam.com', 'emile@vre-vietnam.com']
  if (venue === 'ha-do-centrosa') return ['contact@vre-vietnam.com']
  throw new Error(`Unknown booking venue: ${venue}`)
}
