import type { LanguageCode } from './i18n/languages'

export const SESSION_PARTICIPANT_SELECT = 'id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, checked_in, payment_status, payment_amount, payment_splits, score, accuracy_percent, projectiles_fired, escape_duration_seconds, placement, prize_claimed, prize_claimed_at'
export const SESSION_CARD_PARTICIPANT_SELECT = 'id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, checked_in'
export const SESSION_SELECT_BASE = `id, owner_id, club_id, session_type, name, date, start_time, duration_minutes, max_players, arena_count, game_options, game_votes, confirmed_game_id, visibility, invite_code, notes, status, tournament_format, best_of, rounds_per_match, require_payment, qualification_rule, custom_qualifiers, enable_third_place_match, first_prize, second_prize, third_prize, tournament_locked, session_participants(${SESSION_PARTICIPANT_SELECT})`
export const SESSION_SELECT = `id, owner_id, club_id, session_type, name, date, start_time, duration_minutes, max_players, arena_count, game_options, game_votes, confirmed_game_id, visibility, invite_code, notes, status, tournament_format, best_of, rounds_per_match, require_payment, qualification_rule, custom_qualifiers, enable_third_place_match, first_prize, second_prize, third_prize, tournament_locked, seeded, seed_label, seed_batch, booking_type, ticket_type, ticket_player_count, ticket_total_price, ticket_unit_price, ticket_status, ticket_reference, ticket_customer_id, challenge_target_id, challenge_status, challenge_accepted_at, challenge_declined_at, session_participants(${SESSION_PARTICIPANT_SELECT})`
export const SESSION_CARD_SELECT_BASE = `id, owner_id, club_id, session_type, name, date, start_time, duration_minutes, max_players, arena_count, game_options, confirmed_game_id, visibility, invite_code, status, rounds_per_match, session_participants(${SESSION_CARD_PARTICIPANT_SELECT})`
export const SESSION_CARD_SELECT = `id, owner_id, club_id, session_type, name, date, start_time, duration_minutes, max_players, arena_count, game_options, confirmed_game_id, visibility, invite_code, status, rounds_per_match, seeded, seed_label, booking_type, ticket_type, ticket_player_count, challenge_target_id, challenge_status, session_participants(${SESSION_CARD_PARTICIPANT_SELECT})`
export const OPTIONAL_SESSION_METADATA_COLUMNS = [
  'seeded',
  'seed_label',
  'seed_batch',
  'booking_type',
  'ticket_type',
  'ticket_player_count',
  'ticket_total_price',
  'ticket_unit_price',
  'ticket_status',
  'ticket_reference',
  'ticket_customer_id',
  'challenge_target_id',
  'challenge_status',
  'challenge_accepted_at',
  'challenge_declined_at',
]
export const WAITLIST_SELECT = 'id, session_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, created_at'
export const WAITLIST_POSITION_SELECT = 'id, session_id, profile_id, created_at'
export const CLUB_MEMBER_SELECT_BASE = 'id, club_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, status, deleted_at'
export const CLUB_MEMBER_SELECT = `${CLUB_MEMBER_SELECT_BASE}, role, created_at`
export const CLUB_LIST_SELECT_BASE = 'id, owner_id, name, description, visibility, pin_code, member_count, created_at'
export const CLUB_LIST_SELECT = 'id, owner_id, name, motto, description, banner_url, theme_color, default_language, ranking_criterion, visibility, pin_code, member_count, created_at'
export const CLUB_PUBLIC_SELECT = 'id, owner_id, name, motto, description, banner_url, theme_color, default_language, ranking_criterion, visibility, member_count, created_at'
export const CLUB_MESSAGE_SELECT = 'id, club_id, author_id, author_display_name, author_avatar_url, author_avatar_emoji, author_avatar_initials, author_avatar_color, author_avatar_text_color, author_profile_motto, message_type, body, created_at'
export const SESSION_MESSAGE_SELECT = 'id, session_id, author_id, author_display_name, author_avatar_url, author_avatar_emoji, author_avatar_initials, author_avatar_color, author_avatar_text_color, author_profile_motto, message_type, body, moderation_status, moderation_reason, reviewed_by, reviewed_at, moderation_categories, moderation_score, created_at'

export type GameId =
  | 'laser-tag'
  | 'mini-block-towers'
  | 'office-war'
  | 'paintball'
  | 'snow-battle'
  | 'castle-unspunnen'
  | 'wild-west'
  | 'arc-of-the-covenant'
  | 'joller-house'

export type TicketType = 'individual' | 'birthday' | 'corporate'

export type GameAudience =
  | 'familyFriendly'
  | 'scary'
  | 'fun'
  | 'quest'
  | 'teamwork'
  | 'beginnerFriendly'
  | 'competitive'

export type GameInfo = {
  id: GameId
  title: string
  category: 'FPS / PVP' | 'Escape'
  image: string
  durationMinutes: number
  maxPlayersPerArena: number
  audience: GameAudience[]
}

export const games: GameInfo[] = [
  {
    id: 'laser-tag',
    title: 'Laser Tag',
    category: 'FPS / PVP',
    image: '/games/laser-tag.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'teamwork', 'beginnerFriendly', 'fun'],
  },
  {
    id: 'mini-block-towers',
    title: 'Mini Block Towers',
    category: 'FPS / PVP',
    image: '/games/mini-block-towers.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['familyFriendly', 'beginnerFriendly', 'fun'],
  },
  {
    id: 'office-war',
    title: 'Office War',
    category: 'FPS / PVP',
    image: '/games/office-war.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['fun', 'teamwork', 'beginnerFriendly'],
  },
  {
    id: 'paintball',
    title: 'Paintball',
    category: 'FPS / PVP',
    image: '/games/paintball.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'teamwork', 'fun'],
  },
  {
    id: 'snow-battle',
    title: 'Snow Battle',
    category: 'FPS / PVP',
    image: '/games/snow-battle.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['familyFriendly', 'beginnerFriendly', 'fun'],
  },
  {
    id: 'castle-unspunnen',
    title: 'Castle Unspunnen',
    category: 'FPS / PVP',
    image: '/games/castle-unspunnen.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['quest', 'teamwork', 'competitive'],
  },
  {
    id: 'wild-west',
    title: 'Wild West',
    category: 'FPS / PVP',
    image: '/games/wild-west.png',
    durationMinutes: 20,
    maxPlayersPerArena: 4,
    audience: ['competitive', 'fun'],
  },
  {
    id: 'arc-of-the-covenant',
    title: 'The Secret of the Arc',
    category: 'Escape',
    image: '/games/arc-of-the-covenant.png',
    durationMinutes: 40,
    maxPlayersPerArena: 4,
    audience: ['quest', 'teamwork'],
  },
  {
    id: 'joller-house',
    title: 'Joller House',
    category: 'Escape',
    image: '/games/joller-house.png',
    durationMinutes: 40,
    maxPlayersPerArena: 4,
    audience: ['scary', 'quest', 'teamwork'],
  },
]

export function isEscapeGameId(gameId: string | null | undefined) {
  return games.some((game) => game.id === gameId && game.category === 'Escape')
}

export function isEscapeSession(session: { confirmed_game_id?: GameId | string | null; game_options?: Array<GameId | string> | null } | null | undefined) {
  if (!session) return false
  return isEscapeGameId(session.confirmed_game_id) || (session.game_options ?? []).some((gameId) => isEscapeGameId(gameId))
}

export const ticketServices: Array<{
  id: TicketType
  duration: number
  minPlayers: number
  maxPlayers: number
  arenaCount: 1 | 2
  defaultGame: GameId
}> = [
  {
    id: 'individual',
    duration: 20,
    minPlayers: 1,
    maxPlayers: 16,
    arenaCount: 1,
    defaultGame: 'laser-tag',
  },
  {
    id: 'birthday',
    duration: 20,
    minPlayers: 4,
    maxPlayers: 16,
    arenaCount: 1,
    defaultGame: 'joller-house',
  },
  {
    id: 'corporate',
    duration: 20,
    minPlayers: 6,
    maxPlayers: 16,
    arenaCount: 1,
    defaultGame: 'office-war',
  },
]

export function selectedTicketService(ticketType: TicketType) {
  return ticketServices.find((service) => service.id === ticketType) || ticketServices[0]
}

export const individualTicketPrices = {
  weekdayDay: 200000,
  weekdayEvening: 250000,
  weekend: 330000,
}
export const ticketPriceBlockMinutes = 20
export const ticketArenaCount = 1
export const ticketArenaCapacityPerSlot = 4
export const ticketMaxCustomerDurationMinutes = 120

export const countries = [
  { code: '+84', name: 'Vietnam' },
  { code: '+33', name: 'France' },
  { code: '+1', name: 'United States / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+61', name: 'Australia' },
  { code: '+65', name: 'Singapore' },
  { code: '+66', name: 'Thailand' },
  { code: '+60', name: 'Malaysia' },
  { code: '+62', name: 'Indonesia' },
  { code: '+63', name: 'Philippines' },
  { code: '+81', name: 'Japan' },
  { code: '+82', name: 'South Korea' },
  { code: '+86', name: 'China' },
  { code: '+852', name: 'Hong Kong' },
  { code: '+886', name: 'Taiwan' },
  { code: '+49', name: 'Germany' },
  { code: '+39', name: 'Italy' },
  { code: '+34', name: 'Spain' },
  { code: '+31', name: 'Netherlands' },
  { code: '+41', name: 'Switzerland' },
]

export const avatarColors = ['#3059ff', '#00b5b8', '#f59e0b', '#ef4444', '#7c3aed', '#0f766e', '#111827']
export const avatarTextColors = ['#ffffff', '#071112', '#fef3c7', '#cffafe', '#fce7f3', '#dcfce7']
export const avatarEmojis = ['😎', '🔥', '⚡', '🎮', '🚀', '🌀', '🎯', '🕹️', '👾', '🤖', '🧠', '💥', '🛡️', '🧩', '🏆', '✨']
export const clubThemeColors = ['#3059ff', '#00b5b8', '#0f766e', '#f59e0b', '#ef4444', '#7c3aed', '#111827']

export const dateLocales: Record<LanguageCode, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  ko: 'ko-KR',
  ja: 'ja-JP',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
}

export const monthAbbreviations = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
