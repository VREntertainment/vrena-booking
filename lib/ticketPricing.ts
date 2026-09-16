export function ticketArenaCapacityForVenue(venue: 'ha-do-centrosa' | 'cafe-des-stagiaires' = 'ha-do-centrosa') {
  return venue === 'cafe-des-stagiaires' ? 8 : 4
}

export function minimumTicketDurationMinutes(
  players: number,
  priceBlockMinutes = 20,
  arenaCapacity = 4,
  arenaCount = 1
) {
  const playerCount = Math.max(1, players)
  const selectedArenaCount = Math.max(1, arenaCount)
  const bookingCapacity = priceBlockMinutes === 45 ? arenaCapacity * 2 : arenaCapacity
  const requiredBlocks = Math.ceil(playerCount / (bookingCapacity * selectedArenaCount))

  return requiredBlocks * priceBlockMinutes
}

export function calculateTicketPricing(
  baseUnitPrice: number,
  players: number,
  durationMinutes: number,
  priceBlockMinutes = 20,
  arenaCapacity = 4,
  arenaCount = 1
) {
  const playerCount = Math.max(1, players)
  const selectedArenaCount = Math.max(1, arenaCount)
  const durationBlocks = Math.max(1, Math.ceil(durationMinutes / priceBlockMinutes))
  const chargedPlayersPerBlock = priceBlockMinutes === 45
    ? Math.min(playerCount, arenaCapacity * selectedArenaCount)
    : playerCount
  const chargedPlayerSpots = durationBlocks * chargedPlayersPerBlock
  const grossPrice = Math.round(baseUnitPrice * chargedPlayerSpots)
  const discountPlayers = priceBlockMinutes === 45 ? chargedPlayerSpots : playerCount
  const discountRate = discountPlayers >= 9 && discountPlayers <= 16
    ? 0.15
    : discountPlayers >= 5 && discountPlayers <= 8
      ? 0.1
      : 0
  const discountAmount = Math.round(grossPrice * discountRate)

  return {
    arenaCount: selectedArenaCount,
    durationBlocks,
    chargedPlayersPerBlock,
    chargedPlayerSpots,
    grossPrice,
    discountRate,
    discountAmount,
    totalPrice: grossPrice - discountAmount,
  }
}
