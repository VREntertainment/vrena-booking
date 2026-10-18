const anvioIds = new Set(['revolta', 'city-z', 'station-zarya'])
export function isAnvioGame(id: string) { return anvioIds.has(id.split(':')[0]) }
export function brandedGameName(id: string, name: string) {
  const knownName = name.trim().toLowerCase().replace(/\s+/g, '-')
  return (isAnvioGame(id) || isAnvioGame(knownName)) && !/powered by anvio/i.test(name) ? name + ' · Powered by Anvio' : name
}
