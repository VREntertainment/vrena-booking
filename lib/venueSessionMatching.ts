type VenueSessionGame = {
  confirmed_game_id: string | null
  game_options: string[] | null
}

export function venueSessionMatchesGame(session: VenueSessionGame, gameSlug: string) {
  return session.confirmed_game_id === gameSlug || (session.game_options ?? []).includes(gameSlug)
}

export function venueCandidatesForGame<T extends { sessions: VenueSessionGame | null }>(candidates: T[], gameSlug: string) {
  return candidates.filter((candidate) => candidate.sessions && venueSessionMatchesGame(candidate.sessions, gameSlug))
}
