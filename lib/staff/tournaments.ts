export type TournamentFormat = 'single_elimination' | 'round_robin'
export type TieBreak = 'difference' | 'scored'
export type TournamentVenue = 'ha-do-centrosa' | 'cafe-des-stagiaires'
export type MatchOutcome = 'score' | 'forfeit' | 'no_show' | 'bye'

export type TeamTournament = {
  id: string
  name: string
  venue_key: TournamentVenue
  game_slug: string
  format: TournamentFormat
  tie_break: TieBreak
  version: number
}
export type TournamentTeam = { id: string; name: string; seed: number; checked_in: boolean; reserve?: boolean }
export type TeamMatch = {
  number: number
  round: number
  team_a: string | null
  team_b: string | null
  feed_a: number | null
  feed_b: number | null
  status: 'scheduled' | 'in_progress' | 'completed'
  match_date: string | null
  start_time: string | null
  arena_number: number | null
  duration: number | null
  score_a: number | null
  score_b: number | null
  winner: string | null
  outcome: MatchOutcome | null
  review: boolean
  started_at?: string | null
}
export type TournamentAudit = {
  id: string
  match_number: number
  action: 'correction' | 'reset'
  reason: string
  actor: string
  changed_at: string
  before: { score_a: number | null; score_b: number | null; outcome: MatchOutcome | null }
  after: { score_a: number | null; score_b: number | null; outcome: MatchOutcome | null }
}
export type TournamentDetail = { tournament: TeamTournament; teams: TournamentTeam[]; matches: TeamMatch[]; audit: TournamentAudit[]; open_byes?: number[] }
export type TournamentOptions = {
  tournaments: TeamTournament[]
  venues: { venue_key: TournamentVenue; name: string }[]
  games: { slug: string; name: string; venue_keys: TournamentVenue[]; arena_ids: string[] | null }[]
}
export type TournamentCommand =
  | { action: 'create'; name: string; venue_key: TournamentVenue; game_slug: string; format: TournamentFormat; tie_break: TieBreak }
  | { action: 'team'; name: string; bye_match?: number; regenerate?: boolean }
  | { action: 'rename_team'; team_id: string; name: string }
  | { action: 'pairing'; match_number: number; team_a: string | null; team_b: string | null }
  | { action: 'remove_team' | 'check_in'; team_id: string; checked_in?: boolean }
  | { action: 'seed'; team_id: string; seed: number }
  | { action: 'rules'; tie_break: TieBreak }
  | { action: 'generate' }
  | { action: 'schedule'; match_number: number; match_date: string; start_time: string; arena_number: number; duration: number }
  | { action: 'unschedule' | 'start'; match_number: number }
  | { action: 'result'; match_number: number; outcome: Exclude<MatchOutcome, 'bye'>; score_a?: number; score_b?: number; winner_side?: 'a' | 'b'; reason?: string }
  | { action: 'reset'; match_number: number; reason: string }

export const venueNames: Record<TournamentVenue, string> = {
  'ha-do-centrosa': 'Hà Đô Centrosa',
  'cafe-des-stagiaires': 'Thảo Điền',
}

export function matchOrder(a: TeamMatch, b: TeamMatch) {
  return (a.match_date ?? '9999').localeCompare(b.match_date ?? '9999')
    || (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99')
    || a.number - b.number
}

export function tournamentStandings(teams: TournamentTeam[], matches: TeamMatch[], tiebreak: TieBreak) {
  const standings = teams.map(team => ({ ...team, played: 0, wins: 0, draws: 0, losses: 0, scored: 0, against: 0, difference: 0, points: 0 }))
  const table = new Map(standings.map(team => [team.id, team]))
  for (const match of matches) {
    if (match.status !== 'completed' || match.review || match.score_a === null || match.score_b === null) continue
    const a = match.team_a && table.get(match.team_a), b = match.team_b && table.get(match.team_b)
    if (!a || !b) continue
    for (const [team, scored, against] of [[a, match.score_a, match.score_b], [b, match.score_b, match.score_a]] as const) {
      team.played++
      team.scored += scored
      team.against += against
      team.difference += scored - against
      if (scored > against) { team.wins++; team.points += 3 }
      else if (scored === against) { team.draws++; team.points++ }
      else team.losses++
    }
  }
  const second = tiebreak === 'difference' ? 'scored' : 'difference'
  return standings.sort((a, b) => b.points - a.points || b[tiebreak] - a[tiebreak] || b[second] - a[second] || a.seed - b.seed)
}
