import { publicGameGuideCatalog } from './gameGuideCatalog.ts'

const defaultGameNames = [...publicGameGuideCatalog.map((game) => game.title), 'SIM Racing']
const clientBookingPrefixes = ['Ticket booking', 'Cafe soft-opening request', 'VRena Café des Stagiaires', 'Vrena Thao Dien', 'VRena Thao Dien']

/** Normalize known generated names while retaining customer/event names verbatim. */
export function staffBookingName(name: string, gameNames: readonly string[] = defaultGameNames): string {
  if (clientBookingPrefixes.some((prefix) => ['Individual', 'Birthday', 'Corporate'].some((type) => name === `${prefix} - ${type}`))) return 'Client booking'
  return [...defaultGameNames, ...gameNames].some((game) => name === `Staff booking - ${game}`) ? 'Staff booking' : name
}
