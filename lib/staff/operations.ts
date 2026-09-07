import type { StaffConsoleCopy } from './copy.ts'
import { staffConsoleText } from './copy.ts'
import { normalizeTime } from './dates.ts'
import type { StaffGame, StaffOperationSession, StaffOrder, StaffSessionParticipant } from './types.ts'

export function operationBookingKind(session: Pick<StaffOperationSession, 'booking_type'>) {
  return session.booking_type === 'ticket' ? 'ticket' : 'session'
}

export function operationSessionChanges(session: StaffOperationSession, patch: Partial<StaffOperationSession>) {
  const rows: Array<[string, unknown, unknown]> = [
    ['Name', session.name, patch.name],
    ['Date', session.date, patch.date],
    ['Time', normalizeTime(session.start_time), patch.start_time ? normalizeTime(patch.start_time) : undefined],
    ['Duration', session.duration_minutes, patch.duration_minutes],
    ['Max players', session.max_players, patch.max_players],
    ['Arena count', session.arena_count, patch.arena_count],
    ['Visibility', session.visibility, patch.visibility],
    ['Status', session.status, patch.status],
    ['Game', session.confirmed_game_id, patch.confirmed_game_id],
  ]

  return rows
    .filter(([, , after]) => after !== undefined)
    .filter(([, before, after]) => String(before ?? '') !== String(after ?? ''))
    .map(([label, before, after]) => ({ label, before: before as string | number | boolean | null, after: after as string | number | boolean | null }))
}

export function orderChanges(order: StaffOrder, patch: Partial<StaffOrder>, games: StaffGame[] = []) {
  const gameName = (gameId: string | null | undefined) => (
    games.find((game) => game.id === gameId)?.name || gameId || ''
  )
  const rows: Array<[string, unknown, unknown]> = [
    ['Payment status', order.payment_status, patch.payment_status],
    ['Order status', order.order_status, patch.order_status],
    ['Total', order.total, patch.total],
    ['Game', gameName(order.game_id), patch.game_id === undefined ? undefined : gameName(patch.game_id)],
    ['Customer name', order.customer_name, patch.customer_name],
    ['Customer phone', order.customer_phone, patch.customer_phone],
    ['Customer email', order.customer_email, patch.customer_email],
    ['Date', order.booking_date, patch.booking_date],
    ['Time', normalizeTime(order.booking_time), patch.booking_time ? normalizeTime(patch.booking_time) : undefined],
  ]

  return rows
    .filter(([, , after]) => after !== undefined)
    .filter(([, before, after]) => String(before ?? '') !== String(after ?? ''))
    .map(([label, before, after]) => ({ label, before: before as string | number | boolean | null, after: after as string | number | boolean | null }))
}

export function ticketTypeName(value: string | null | undefined, text: StaffConsoleCopy = staffConsoleText.en) {
  if (value === 'birthday' || value === 'corporate' || value === 'individual') return text.ticketTypes[value]
  return text.labels.ticketBookings
}

export function sessionKindLabel(session: StaffOperationSession, text: StaffConsoleCopy = staffConsoleText.en) {
  if (session.booking_type === 'ticket') return `${text.labels.ticketBookings} · ${ticketTypeName(session.ticket_type, text)}`
  if (session.visibility === 'private') return text.labels.privateSession
  return text.labels.communitySession
}

export function sessionGameName(session: StaffOperationSession, games: StaffGame[], text: StaffConsoleCopy = staffConsoleText.en) {
  const gameId = session.confirmed_game_id || session.game_options?.[0] || ''
  return games.find((game) => game.slug === gameId || game.id === gameId)?.name || text.gameFallback
}

export function sessionStaffGame(session: StaffOperationSession, games: StaffGame[]) {
  const gameId = session.confirmed_game_id || session.game_options?.[0] || ''
  return games.find((game) => game.slug === gameId || game.id === gameId) || null
}

export function operationParticipantName(participant: StaffSessionParticipant, text: StaffConsoleCopy = staffConsoleText.en) {
  return participant.display_name || text.customerFallback
}

export function sessionBookedPlayers(session: StaffOperationSession, order?: StaffOrder) {
  return Math.max(
    Number(order?.players_count || 0),
    Number(session.ticket_player_count || 0),
    session.session_participants?.length || 0
  )
}

export function sessionCapacity(session: StaffOperationSession, order?: StaffOrder) {
  return Math.max(Number(session.max_players || 0), sessionBookedPlayers(session, order))
}

export function sessionCheckedInCount(session: StaffOperationSession) {
  return (session.session_participants || []).filter((participant) => participant.checked_in).length
}
