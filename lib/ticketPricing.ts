export function minimumTicketDurationMinutes(
  players: number,
  priceBlockMinutes = 20,
  arenaCapacity = 4,
  arenaCount = 1
) {
  const playerCount = Math.max(1, players)
  const selectedArenaCount = Math.max(1, arenaCount)
  const requiredBlocks = Math.ceil(playerCount / (arenaCapacity * selectedArenaCount))

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
  const chargedPlayersPerBlock = Math.min(playerCount, arenaCapacity * selectedArenaCount)
  const chargedPlayerSpots = durationBlocks * chargedPlayersPerBlock
  const grossPrice = baseUnitPrice * chargedPlayerSpots
  const discountRate = playerCount >= 9 && playerCount <= 16
    ? 0.15
    : playerCount >= 5 && playerCount <= 8
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
