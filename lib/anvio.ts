const anvioIds = new Set(['revolta', 'city-z', 'station-zarya'])
export function isAnvioGame(id: string) { return anvioIds.has(id.split(':')[0]) }
export function brandedGameName(id: string, name: string) { return isAnvioGame(id) ? name + ' · Powered by Anvio' : name }
