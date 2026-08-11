export const venueResultReviewReasons = [
  'game_not_recognized',
  'players_not_recognized',
  'escape_time_not_recognized',
  'player_rows_conflict',
  'player_rows_incomplete',
  'player_count_invalid',
] as const

export type VenueResultReviewReason = (typeof venueResultReviewReasons)[number]

const venueResultReviewReasonSet = new Set<string>(venueResultReviewReasons)

export function isVenueResultReviewReason(value: string): value is VenueResultReviewReason {
  return venueResultReviewReasonSet.has(value)
}
