import type { TournamentCommand, TournamentDetail, TournamentOptions } from '../../../lib/staff/tournaments'

export type TournamentGateway = {
  list: () => Promise<TournamentOptions>
  detail: (id: string) => Promise<TournamentDetail>
  write: (id: string | null, version: number | null, command: TournamentCommand) => Promise<TournamentDetail>
}
