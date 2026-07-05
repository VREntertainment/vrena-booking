import type { LanguageCode } from './i18n/languages'

export const SESSION_PARTICIPANT_CHAPTER_TIME_SELECT = 'id, session_id, participant_id, profile_id, game_slug, chapter_number, duration_seconds, created_at, updated_at'
export const SESSION_PARTICIPANT_SELECT = `id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, checked_in, payment_status, payment_amount, payment_splits, score, accuracy_percent, projectiles_fired, escape_duration_seconds, placement, prize_claimed, prize_claimed_at, chapter_times:session_participant_chapter_times(${SESSION_PARTICIPANT_CHAPTER_TIME_SELECT})`
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
export const CLUB_LIST_WITH_MEMBERS_SELECT_BASE = `${CLUB_LIST_SELECT_BASE}, club_members(${CLUB_MEMBER_SELECT_BASE})`
export const CLUB_LIST_WITH_MEMBERS_SELECT = `${CLUB_LIST_SELECT}, club_members(${CLUB_MEMBER_SELECT})`
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
  { code: '+93', name: 'Afghanistan' },
  { code: '+358', name: 'Aland Islands' },
  { code: '+355', name: 'Albania' },
  { code: '+213', name: 'Algeria' },
  { code: '+1', name: 'American Samoa' },
  { code: '+376', name: 'Andorra' },
  { code: '+244', name: 'Angola' },
  { code: '+1', name: 'Anguilla' },
  { code: '+1', name: 'Antigua and Barbuda' },
  { code: '+54', name: 'Argentina' },
  { code: '+374', name: 'Armenia' },
  { code: '+297', name: 'Aruba' },
  { code: '+247', name: 'Ascension Island' },
  { code: '+61', name: 'Australia' },
  { code: '+43', name: 'Austria' },
  { code: '+994', name: 'Azerbaijan' },
  { code: '+1', name: 'Bahamas' },
  { code: '+973', name: 'Bahrain' },
  { code: '+880', name: 'Bangladesh' },
  { code: '+1', name: 'Barbados' },
  { code: '+375', name: 'Belarus' },
  { code: '+32', name: 'Belgium' },
  { code: '+501', name: 'Belize' },
  { code: '+229', name: 'Benin' },
  { code: '+1', name: 'Bermuda' },
  { code: '+975', name: 'Bhutan' },
  { code: '+591', name: 'Bolivia' },
  { code: '+387', name: 'Bosnia and Herzegovina' },
  { code: '+267', name: 'Botswana' },
  { code: '+55', name: 'Brazil' },
  { code: '+246', name: 'British Indian Ocean Territory' },
  { code: '+1', name: 'British Virgin Islands' },
  { code: '+673', name: 'Brunei' },
  { code: '+359', name: 'Bulgaria' },
  { code: '+226', name: 'Burkina Faso' },
  { code: '+257', name: 'Burundi' },
  { code: '+855', name: 'Cambodia' },
  { code: '+237', name: 'Cameroon' },
  { code: '+1', name: 'Canada' },
  { code: '+238', name: 'Cape Verde' },
  { code: '+599', name: 'Caribbean Netherlands' },
  { code: '+1', name: 'Cayman Islands' },
  { code: '+236', name: 'Central African Republic' },
  { code: '+235', name: 'Chad' },
  { code: '+56', name: 'Chile' },
  { code: '+86', name: 'China' },
  { code: '+61', name: 'Christmas Island' },
  { code: '+61', name: 'Cocos Islands' },
  { code: '+57', name: 'Colombia' },
  { code: '+269', name: 'Comoros' },
  { code: '+242', name: 'Congo' },
  { code: '+243', name: 'Congo DR' },
  { code: '+682', name: 'Cook Islands' },
  { code: '+506', name: 'Costa Rica' },
  { code: '+225', name: 'Cote d Ivoire' },
  { code: '+385', name: 'Croatia' },
  { code: '+53', name: 'Cuba' },
  { code: '+599', name: 'Curacao' },
  { code: '+357', name: 'Cyprus' },
  { code: '+420', name: 'Czech Republic' },
  { code: '+45', name: 'Denmark' },
  { code: '+253', name: 'Djibouti' },
  { code: '+1', name: 'Dominica' },
  { code: '+1', name: 'Dominican Republic' },
  { code: '+593', name: 'Ecuador' },
  { code: '+20', name: 'Egypt' },
  { code: '+503', name: 'El Salvador' },
  { code: '+240', name: 'Equatorial Guinea' },
  { code: '+291', name: 'Eritrea' },
  { code: '+372', name: 'Estonia' },
  { code: '+268', name: 'Eswatini' },
  { code: '+251', name: 'Ethiopia' },
  { code: '+500', name: 'Falkland Islands' },
  { code: '+298', name: 'Faroe Islands' },
  { code: '+679', name: 'Fiji' },
  { code: '+358', name: 'Finland' },
  { code: '+33', name: 'France' },
  { code: '+594', name: 'French Guiana' },
  { code: '+689', name: 'French Polynesia' },
  { code: '+241', name: 'Gabon' },
  { code: '+220', name: 'Gambia' },
  { code: '+995', name: 'Georgia' },
  { code: '+49', name: 'Germany' },
  { code: '+233', name: 'Ghana' },
  { code: '+350', name: 'Gibraltar' },
  { code: '+30', name: 'Greece' },
  { code: '+299', name: 'Greenland' },
  { code: '+1', name: 'Grenada' },
  { code: '+590', name: 'Guadeloupe' },
  { code: '+1', name: 'Guam' },
  { code: '+502', name: 'Guatemala' },
  { code: '+44', name: 'Guernsey' },
  { code: '+224', name: 'Guinea' },
  { code: '+245', name: 'Guinea-Bissau' },
  { code: '+592', name: 'Guyana' },
  { code: '+509', name: 'Haiti' },
  { code: '+504', name: 'Honduras' },
  { code: '+852', name: 'Hong Kong' },
  { code: '+36', name: 'Hungary' },
  { code: '+354', name: 'Iceland' },
  { code: '+91', name: 'India' },
  { code: '+62', name: 'Indonesia' },
  { code: '+98', name: 'Iran' },
  { code: '+964', name: 'Iraq' },
  { code: '+353', name: 'Ireland' },
  { code: '+44', name: 'Isle of Man' },
  { code: '+972', name: 'Israel' },
  { code: '+39', name: 'Italy' },
  { code: '+1', name: 'Jamaica' },
  { code: '+81', name: 'Japan' },
  { code: '+44', name: 'Jersey' },
  { code: '+962', name: 'Jordan' },
  { code: '+7', name: 'Kazakhstan' },
  { code: '+254', name: 'Kenya' },
  { code: '+686', name: 'Kiribati' },
  { code: '+383', name: 'Kosovo' },
  { code: '+965', name: 'Kuwait' },
  { code: '+996', name: 'Kyrgyzstan' },
  { code: '+856', name: 'Laos' },
  { code: '+371', name: 'Latvia' },
  { code: '+961', name: 'Lebanon' },
  { code: '+266', name: 'Lesotho' },
  { code: '+231', name: 'Liberia' },
  { code: '+218', name: 'Libya' },
  { code: '+423', name: 'Liechtenstein' },
  { code: '+370', name: 'Lithuania' },
  { code: '+352', name: 'Luxembourg' },
  { code: '+853', name: 'Macau' },
  { code: '+261', name: 'Madagascar' },
  { code: '+265', name: 'Malawi' },
  { code: '+60', name: 'Malaysia' },
  { code: '+960', name: 'Maldives' },
  { code: '+223', name: 'Mali' },
  { code: '+356', name: 'Malta' },
  { code: '+692', name: 'Marshall Islands' },
  { code: '+596', name: 'Martinique' },
  { code: '+222', name: 'Mauritania' },
  { code: '+230', name: 'Mauritius' },
  { code: '+262', name: 'Mayotte' },
  { code: '+52', name: 'Mexico' },
  { code: '+691', name: 'Micronesia' },
  { code: '+373', name: 'Moldova' },
  { code: '+377', name: 'Monaco' },
  { code: '+976', name: 'Mongolia' },
  { code: '+382', name: 'Montenegro' },
  { code: '+1', name: 'Montserrat' },
  { code: '+212', name: 'Morocco' },
  { code: '+258', name: 'Mozambique' },
  { code: '+95', name: 'Myanmar' },
  { code: '+264', name: 'Namibia' },
  { code: '+674', name: 'Nauru' },
  { code: '+977', name: 'Nepal' },
  { code: '+31', name: 'Netherlands' },
  { code: '+687', name: 'New Caledonia' },
  { code: '+64', name: 'New Zealand' },
  { code: '+505', name: 'Nicaragua' },
  { code: '+227', name: 'Niger' },
  { code: '+234', name: 'Nigeria' },
  { code: '+683', name: 'Niue' },
  { code: '+672', name: 'Norfolk Island' },
  { code: '+672', name: 'Antarctica' },
  { code: '+850', name: 'North Korea' },
  { code: '+389', name: 'North Macedonia' },
  { code: '+1', name: 'Northern Mariana Islands' },
  { code: '+47', name: 'Norway' },
  { code: '+968', name: 'Oman' },
  { code: '+92', name: 'Pakistan' },
  { code: '+680', name: 'Palau' },
  { code: '+970', name: 'Palestine' },
  { code: '+507', name: 'Panama' },
  { code: '+675', name: 'Papua New Guinea' },
  { code: '+595', name: 'Paraguay' },
  { code: '+51', name: 'Peru' },
  { code: '+63', name: 'Philippines' },
  { code: '+64', name: 'Pitcairn Islands' },
  { code: '+48', name: 'Poland' },
  { code: '+351', name: 'Portugal' },
  { code: '+1', name: 'Puerto Rico' },
  { code: '+974', name: 'Qatar' },
  { code: '+262', name: 'Reunion' },
  { code: '+40', name: 'Romania' },
  { code: '+7', name: 'Russia' },
  { code: '+250', name: 'Rwanda' },
  { code: '+590', name: 'Saint Barthelemy' },
  { code: '+290', name: 'Saint Helena' },
  { code: '+1', name: 'Saint Kitts and Nevis' },
  { code: '+1', name: 'Saint Lucia' },
  { code: '+590', name: 'Saint Martin' },
  { code: '+508', name: 'Saint Pierre and Miquelon' },
  { code: '+1', name: 'Saint Vincent and the Grenadines' },
  { code: '+685', name: 'Samoa' },
  { code: '+378', name: 'San Marino' },
  { code: '+239', name: 'Sao Tome and Principe' },
  { code: '+966', name: 'Saudi Arabia' },
  { code: '+221', name: 'Senegal' },
  { code: '+381', name: 'Serbia' },
  { code: '+248', name: 'Seychelles' },
  { code: '+232', name: 'Sierra Leone' },
  { code: '+65', name: 'Singapore' },
  { code: '+1', name: 'Sint Maarten' },
  { code: '+421', name: 'Slovakia' },
  { code: '+386', name: 'Slovenia' },
  { code: '+677', name: 'Solomon Islands' },
  { code: '+252', name: 'Somalia' },
  { code: '+27', name: 'South Africa' },
  { code: '+82', name: 'South Korea' },
  { code: '+500', name: 'South Georgia and the South Sandwich Islands' },
  { code: '+211', name: 'South Sudan' },
  { code: '+34', name: 'Spain' },
  { code: '+94', name: 'Sri Lanka' },
  { code: '+249', name: 'Sudan' },
  { code: '+597', name: 'Suriname' },
  { code: '+47', name: 'Svalbard and Jan Mayen' },
  { code: '+46', name: 'Sweden' },
  { code: '+41', name: 'Switzerland' },
  { code: '+963', name: 'Syria' },
  { code: '+886', name: 'Taiwan' },
  { code: '+992', name: 'Tajikistan' },
  { code: '+255', name: 'Tanzania' },
  { code: '+66', name: 'Thailand' },
  { code: '+670', name: 'Timor-Leste' },
  { code: '+228', name: 'Togo' },
  { code: '+690', name: 'Tokelau' },
  { code: '+676', name: 'Tonga' },
  { code: '+1', name: 'Trinidad and Tobago' },
  { code: '+290', name: 'Tristan da Cunha' },
  { code: '+216', name: 'Tunisia' },
  { code: '+90', name: 'Turkey' },
  { code: '+993', name: 'Turkmenistan' },
  { code: '+1', name: 'Turks and Caicos Islands' },
  { code: '+688', name: 'Tuvalu' },
  { code: '+1', name: 'U.S. Virgin Islands' },
  { code: '+256', name: 'Uganda' },
  { code: '+380', name: 'Ukraine' },
  { code: '+971', name: 'United Arab Emirates' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+1', name: 'United States' },
  { code: '+598', name: 'Uruguay' },
  { code: '+998', name: 'Uzbekistan' },
  { code: '+678', name: 'Vanuatu' },
  { code: '+39', name: 'Vatican City' },
  { code: '+58', name: 'Venezuela' },
  { code: '+681', name: 'Wallis and Futuna' },
  { code: '+212', name: 'Western Sahara' },
  { code: '+967', name: 'Yemen' },
  { code: '+260', name: 'Zambia' },
  { code: '+263', name: 'Zimbabwe' },
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
