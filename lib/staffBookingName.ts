import { publicGameGuideCatalog } from './gameGuideCatalog.ts'

const defaultGameNames = [...publicGameGuideCatalog.map((game) => game.title), 'SIM Racing']

/** Remove only known auto-generated game suffixes; retain customer/event names verbatim. */
export function staffBookingName(name: string, gameNames: readonly string[] = defaultGameNames): string {
  return [...defaultGameNames, ...gameNames].some((game) => name === `Staff booking - ${game}`) ? 'Staff booking' : name
}
