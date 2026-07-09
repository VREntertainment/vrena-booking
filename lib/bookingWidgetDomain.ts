import {
  countries,
  dateLocales,
  games,
  individualTicketPrices,
  monthAbbreviations,
  selectedTicketService,
  ticketArenaCapacityPerSlot,
  ticketArenaCount,
  ticketPriceBlockMinutes,
  type GameId,
  type TicketType,
} from './bookingStaticData'
import type { LanguageCode } from './i18n/languages'
import type { LeaderboardCriterion, LeaderboardPlayer } from '../components/LeaderboardPanel'
import type { StaffProfile } from '../components/StaffConsole'

export const ARENA_COUNT = 2
export const OPEN_MINUTES = 9 * 60
export const CLOSE_MINUTES = 22 * 60
export const TIME_STEP_MINUTES = 20
export const SESSION_LOAD_BATCH_DAYS = 7
export const LEADERBOARD_PAGE_SIZE = 20
export const DEFAULT_APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vrena-booking.vercel.app'
export const MAX_DISPLAY_NAME_LENGTH = 10

export type TicketStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type BookingType = 'community' | 'ticket' | 'challenge'
export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
export type ClubRole = 'owner' | 'admin' | 'moderator' | 'member'
export type ClubMemberRole = Exclude<ClubRole, 'owner'>
export type ClubTab = 'hall' | 'members' | 'sessions' | 'messages' | 'settings'
export type ClubSessionScope = 'upcoming' | 'past'
export type ParticipantPaymentMethod = 'cash' | 'bank_transfer'
export type ParticipantPaymentSplit = {
  payment_method: ParticipantPaymentMethod
  amount: number
}
export type ParticipantPaymentSplitDraft = {
  id: string
  payment_method: ParticipantPaymentMethod
  amount: string
}

export type StaffGameGuideText = Partial<Record<LanguageCode, string>>

export type StaffGameGuide = {
  slug: string
  game_type?: string | null
  escape_chapter_count?: number | null
  guide_language?: string | null
  guide_summary?: StaffGameGuideText | null
  guide_rules?: StaffGameGuideText | null
  guide_tips?: StaffGameGuideText | null
}

export type TicketBookingConfirmation = {
  sessionId: string
  reference: string
  ticketType: TicketType
  ticketLabel: string
  date: string
  time: string
  players: number
  totalPrice: number
  guestPhone?: string
  guestName?: string
  loyaltyPointsRedeemed?: number
  loyaltyDiscountAmount?: number
  discountCode?: string
  discountAmount?: number
}

export type Profile = {
  id: string
  phone: string
  full_name: string | null
  nickname: string | null
  email: string | null
  birthday?: string | null
  gender?: ProfileGender | null
  avatar_url: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
  avatar_color?: string | null
  avatar_text_color?: string | null
  profile_motto?: string | null
  role?: string | null
  score_adjustment?: number | null
  loyalty_points_total?: number | null
  average_accuracy_override?: number | null
  best_escape_duration_seconds_override?: number | null
  total_projectiles_override?: number | null
  anonymous_mode?: boolean | null
  anonymous_callsign?: string | null
  marketing_consent?: boolean | null
  marketing_consent_at?: string | null
  marketing_opted_out_at?: string | null
  personal_data_consent?: boolean | null
  personal_data_consent_at?: string | null
  privacy_policy_url?: string | null
  terms_conditions_url?: string | null
  consent_waiver_url?: string | null
  legal_consent_version?: string | null
}

export type StaffPlayerEditDraft = {
  fullName: string
  nickname: string
  phoneCountryCode: string
  phoneLocalNumber: string
  birthday: string
  gender: ProfileGender | ''
  profileMotto: string
  totalScore: string
}

export type TotpFactor = {
  id: string
  friendly_name?: string
  factor_type?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export type TotpEnrollment = {
  id: string
  qrCode: string
  secret: string
}

export type TicketLoyaltyRedemption = {
  loyalty_points_total: number
  redeem_value_vnd_per_point: number
}

export type TicketLoyaltyEarnQuote = {
  estimated_points: number
  estimated_reduction_vnd: number
  redeem_value_vnd_per_point: number
}

export type TicketDiscountQuote = {
  discount_rule_id?: string
  discount_code?: string
  discount_name: string
  discount_amount: number
}

export const ANONYMOUS_MASK_EMOJI = '🎭'
export const ANONYMOUS_MASK_COLOR = '#11181b'
export const ANONYMOUS_MASK_TEXT_COLOR = '#ffffff'
export const ANONYMOUS_CALLSIGN_PREFIXES = ['ECHO', 'NOVA', 'ORION', 'CIPHER', 'PHANTOM', 'VORTEX', 'NEON', 'PULSE']
export const PROFILE_GENDER_VALUES = ['male', 'female', 'non_binary', 'prefer_not_to_say', 'self_describe'] as const
export type ProfileGender = typeof PROFILE_GENDER_VALUES[number]
export const PROFILE_SELECT = 'id, phone, full_name, nickname, email, birthday, gender, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role, score_adjustment, loyalty_points_total, average_accuracy_override, best_escape_duration_seconds_override, total_projectiles_override, anonymous_mode, anonymous_callsign, marketing_consent, marketing_consent_at, marketing_opted_out_at, personal_data_consent, personal_data_consent_at, privacy_policy_url, terms_conditions_url, consent_waiver_url, legal_consent_version'

export function defaultStaffPlayerEditDraft(): StaffPlayerEditDraft {
  return {
    fullName: '',
    nickname: '',
    phoneCountryCode: '+84',
    phoneLocalNumber: '',
    birthday: '',
    gender: '',
    profileMotto: '',
    totalScore: '',
  }
}

export function normalizeProfileGender(value: unknown): ProfileGender | '' {
  return typeof value === 'string' && PROFILE_GENDER_VALUES.includes(value as ProfileGender) ? value as ProfileGender : ''
}

export function normalizePrivateCode(value: string | null | undefined) {
  return (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export type Participant = {
  id: string
  profile_id: string
  display_name: string | null
  avatar_url: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
  avatar_color?: string | null
  avatar_text_color?: string | null
  profile_motto?: string | null
  checked_in?: boolean | null
  payment_status?: 'cash' | 'bank_transfer' | 'free' | null
  payment_amount?: number | null
  payment_splits?: ParticipantPaymentSplit[] | null
  score?: number | null
  accuracy_percent?: number | null
  projectiles_fired?: number | null
  escape_duration_seconds?: number | null
  placement?: number | null
  chapter_times?: ParticipantChapterTime[] | null
  prize_claimed?: boolean | null
  prize_claimed_at?: string | null
}

export type ParticipantChapterTime = {
  id: string
  session_id: string
  participant_id: string
  profile_id: string
  game_slug: string
  chapter_number: number
  duration_seconds: number
  created_at?: string | null
  updated_at?: string | null
}

export type WaitlistEntry = {
  id: string
  session_id: string
  profile_id: string
  display_name: string | null
  avatar_url: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
  avatar_color?: string | null
  avatar_text_color?: string | null
  profile_motto?: string | null
  created_at?: string | null
}

export type FriendConnection = {
  id: string
  follower_id: string
  following_id: string
  display_name: string | null
  avatar_url: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
  avatar_color?: string | null
  avatar_text_color?: string | null
  profile_motto?: string | null
  created_at?: string | null
}

export type SessionInvite = {
  id: string
  session_id: string
  inviter_id: string
  recipient_id: string
  recipient_display_name: string | null
  recipient_avatar_url: string | null
  recipient_avatar_emoji?: string | null
  recipient_avatar_initials?: string | null
  recipient_avatar_color?: string | null
  recipient_avatar_text_color?: string | null
  recipient_profile_motto?: string | null
  status: 'pending' | 'accepted' | 'declined'
  created_at?: string | null
}

export type SessionMessage = {
  id: string
  session_id: string
  author_id: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_avatar_emoji?: string | null
  author_avatar_initials?: string | null
  author_avatar_color?: string | null
  author_avatar_text_color?: string | null
  author_profile_motto?: string | null
  message_type: 'announcement' | 'comment'
  body: string
  moderation_status?: 'approved' | 'pending_review' | 'rejected' | null
  moderation_reason?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  moderation_categories?: Record<string, unknown> | null
  moderation_score?: number | null
  created_at?: string | null
}

export type SessionMessagePageState = {
  loaded: boolean
  loading: boolean
  hasMore: boolean
  oldestCreatedAt: string | null
}

export type ClubMessage = {
  id: string
  club_id: string
  author_id: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_avatar_emoji?: string | null
  author_avatar_initials?: string | null
  author_avatar_color?: string | null
  author_avatar_text_color?: string | null
  author_profile_motto?: string | null
  message_type: 'public' | 'admin_private'
  body: string
  created_at?: string | null
}

export type MessageTranslationResponse = {
  sourceLanguage?: string | null
  translatedText?: string
  changed?: boolean
}

export type TournamentFormat = 'pool_only' | 'pool_to_semifinal' | 'pool_to_final' | 'single_elimination' | 'double_elimination' | 'leaderboard'
export type QualificationRule = 'top_1' | 'top_2' | 'top_4' | 'custom'
export type MatchStage = 'pool' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final' | 'third_place' | 'leaderboard' | 'custom'
export type MatchStatus = 'waiting' | 'next' | 'live' | 'completed' | 'pending'
export type RealtimeRefreshTask = 'profile' | 'sessions' | 'leaderboard' | 'clubs' | 'tournament' | 'network' | 'expandedDetails' | 'expandedMessages'

export type Session = {
  id: string
  owner_id: string
  club_id: string | null
  session_type: 'game' | 'tournament'
  name: string
  date: string
  start_time: string
  duration_minutes: number
  max_players: number
  arena_count: number | null
  game_options: GameId[]
  game_votes: Record<string, GameId>
  confirmed_game_id?: GameId | null
  visibility: 'public' | 'private'
  invite_code: string | null
  notes: string | null
  status: 'open' | 'cancelled' | 'completed'
  tournament_format?: TournamentFormat | null
  best_of?: 1 | 3 | 5 | null
  rounds_per_match?: number | null
  require_payment?: boolean | null
  qualification_rule?: QualificationRule | null
  custom_qualifiers?: number | null
  enable_third_place_match?: boolean | null
  first_prize?: string | null
  second_prize?: string | null
  third_prize?: string | null
  tournament_locked?: boolean | null
  seeded?: boolean | null
  seed_label?: string | null
  seed_batch?: string | null
  booking_type?: BookingType | null
  ticket_type?: TicketType | null
  ticket_player_count?: number | null
  ticket_total_price?: number | null
  ticket_unit_price?: number | null
  ticket_status?: TicketStatus | null
  ticket_reference?: string | null
  ticket_customer_id?: string | null
  challenge_target_id?: string | null
  challenge_status?: ChallengeStatus | null
  challenge_accepted_at?: string | null
  challenge_declined_at?: string | null
  session_participants?: Participant[]
  session_waitlist?: WaitlistEntry[]
}

export type BlockedTime = {
  date: string
  start_time: string
  end_time: string
  arenas_used: number
}

export type SessionListPageResult = {
  sessions: Session[]
  scoreAdjustments: Record<string, number>
  blockedTimes: BlockedTime[]
  hasMoreAfter: boolean | null
  source: 'rpc' | 'select'
}

export type ClubMember = {
  id: string
  club_id: string
  profile_id: string
  display_name: string | null
  avatar_url: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
  avatar_color?: string | null
  avatar_text_color?: string | null
  profile_motto?: string | null
  status: 'pending' | 'approved'
  role?: ClubMemberRole | null
  created_at?: string | null
  deleted_at?: string | null
}

export type Club = {
  id: string
  owner_id: string
  name: string
  motto?: string | null
  description: string | null
  banner_url?: string | null
  theme_color?: string | null
  default_language?: LanguageCode | string | null
  ranking_criterion?: LeaderboardCriterion | string | null
  visibility: 'public' | 'private'
  pin_code?: string | null
  member_count: number | null
  created_at: string
  club_members?: ClubMember[]
}

export type ClubListPageRow = Omit<Club, 'club_members'> & {
  club_members?: ClubMember[] | null
}

export function clubMembers(club: Club | undefined): ClubMember[] {
  if (!Array.isArray(club?.club_members)) return []
  return club.club_members.filter((member) => Boolean(member?.id && member.profile_id && !member.deleted_at))
}

export function normalizeClubListPageRow(row: ClubListPageRow): Club {
  return {
    ...row,
    club_members: Array.isArray(row.club_members) ? row.club_members : [],
  }
}

export function mergeCurrentUserClubMembership(club: Club, memberships: ClubMember[]): Club {
  const currentUserMemberships = memberships.filter((member) => member.club_id === club.id && !member.deleted_at)
  if (currentUserMemberships.length === 0) return club

  const mergedMembers = new Map<string, ClubMember>()
  clubMembers(club).forEach((member) => mergedMembers.set(member.id, member))
  currentUserMemberships.forEach((member) => mergedMembers.set(member.id, member))
  return { ...club, club_members: Array.from(mergedMembers.values()) }
}

export function mergeClubRecords(primaryClubs: Club[], fallbackClubs: Club[]): Club[] {
  const clubsById = new Map<string, Club>()
  fallbackClubs.forEach((club) => clubsById.set(club.id, club))
  primaryClubs.forEach((club) => clubsById.set(club.id, {
    ...clubsById.get(club.id),
    ...club,
  }))

  return Array.from(clubsById.values()).sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
    return rightTime - leftTime || left.name.localeCompare(right.name)
  })
}

export function clubRoleForProfile(club: Club, profileId: string | undefined): ClubRole {
  if (!profileId) return 'member'
  if (club.owner_id === profileId) return 'owner'
  const member = clubMembers(club).find((item) => item.profile_id === profileId)
  if (member?.status !== 'approved') return 'member'
  return member.role || 'member'
}

export function clubMemberCount(club: Club): number {
  return club.member_count ?? clubMembers(club).filter((member) => member.status === 'approved').length
}

export type TournamentEditor = {
  id: string
  session_id: string
  profile_id: string
  display_name: string | null
  avatar_url: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
  avatar_color?: string | null
  avatar_text_color?: string | null
  profile_motto?: string | null
}

export type TournamentPool = {
  id: string
  session_id: string
  name: string
  sort_order: number
}

export type TournamentPoolEntry = {
  id: string
  session_id: string
  pool_id: string
  participant_id: string
  profile_id: string
  seed: number | null
  team_label?: string | null
}

export type TournamentMatch = {
  id: string
  session_id: string
  pool_id: string | null
  stage: MatchStage
  round: number
  match_number: number
  participant_a_id: string | null
  participant_b_id: string | null
  score_a: number | null
  score_b: number | null
  wins_a?: number | null
  wins_b?: number | null
  winner_participant_id: string | null
  loser_participant_id?: string | null
  status: MatchStatus
  arena_number?: number | null
  queue_position?: number | null
  best_of?: 1 | 3 | 5 | null
}

export type TournamentData = {
  editors: TournamentEditor[]
  pools: TournamentPool[]
  poolEntries: TournamentPoolEntry[]
  matches: TournamentMatch[]
  auditLogs: TournamentAuditLog[]
}

export type TournamentAuditLog = {
  id: string
  session_id: string
  user_id: string | null
  action: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

export type PoolStanding = {
  participantId: string
  profileId: string
  displayName: string
  matchesPlayed: number
  wins: number
  losses: number
  scoreFor: number
  scoreAgainst: number
  scoreDifference: number
  points: number
  tieBreakNote: string
}

export type TournamentMatchInsert = {
  session_id: string
  pool_id: string | null
  stage: MatchStage
  round: number
  match_number: number
  participant_a_id: string | null
  participant_b_id: string | null
  status: MatchStatus
  winner_participant_id?: string | null
  loser_participant_id?: string | null
  arena_number?: number | null
  queue_position?: number | null
  best_of?: 1 | 3 | 5 | number | null
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

export function arenasUsedBySession(session: Pick<Session, 'max_players' | 'arena_count'>) {
  return session.arena_count || (session.max_players > 7 ? 2 : 1)
}

export function isTicketSession(session: Pick<Session, 'booking_type'>) {
  return session.booking_type === 'ticket'
}

export function isChallengeSession(session: Pick<Session, 'booking_type'>) {
  return session.booking_type === 'challenge'
}

export function ticketTypeLabel(ticketType: TicketType, text: Record<string, string>) {
  if (ticketType === 'birthday') return text.birthdayTicket
  if (ticketType === 'corporate') return text.corporateTicket
  return text.individualTicket
}

export function ticketTypeDescription(ticketType: TicketType, text: Record<string, string>) {
  if (ticketType === 'birthday') return text.birthdayTicketDescription
  if (ticketType === 'corporate') return text.corporateTicketDescription
  return text.individualTicketDescription
}

export function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value))
}

export function formatTicketFormulaPrice(value: number) {
  return `${Math.max(0, value).toLocaleString('vi-VN')} đ`
}

export function newParticipantPaymentSplit(method: ParticipantPaymentMethod = 'cash', amount = ''): ParticipantPaymentSplitDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    payment_method: method,
    amount,
  }
}

export function normalizeParticipantPaymentSplits(splits: ParticipantPaymentSplitDraft[]): ParticipantPaymentSplit[] {
  return splits
    .map((split) => ({
      payment_method: split.payment_method,
      amount: Number(String(split.amount || '').replace(/[^\d]/g, '')),
    }))
    .filter((split) => split.amount > 0)
}

export function participantPaymentSplitTotal(splits: ParticipantPaymentSplit[] | null | undefined) {
  return (splits ?? []).reduce((sum, split) => sum + split.amount, 0)
}

export function paymentSplitsFromParticipant(participant: Participant): ParticipantPaymentSplitDraft[] {
  const savedSplits = Array.isArray(participant.payment_splits)
    ? participant.payment_splits.filter((split) => (
      (split.payment_method === 'cash' || split.payment_method === 'bank_transfer')
      && Number(split.amount) > 0
    ))
    : []

  if (savedSplits.length > 0) {
    return savedSplits.map((split) => newParticipantPaymentSplit(split.payment_method, String(split.amount)))
  }

  if ((participant.payment_status === 'cash' || participant.payment_status === 'bank_transfer') && Number(participant.payment_amount) > 0) {
    return [newParticipantPaymentSplit(participant.payment_status, String(participant.payment_amount))]
  }

  return [newParticipantPaymentSplit('cash')]
}

export function participantPaymentMethodSummary(participant: Participant, text: Record<string, string>) {
  const savedSplits = Array.isArray(participant.payment_splits)
    ? participant.payment_splits.filter((split) => Number(split.amount) > 0)
    : []

  if (savedSplits.length > 0) {
    return savedSplits
      .map((split) => split.payment_method === 'cash' ? text.cash : text.bankTransfer)
      .filter((label, index, labels) => labels.indexOf(label) === index)
      .join(' + ')
  }

  if (participant.payment_status === 'cash') return text.cash
  if (participant.payment_status === 'bank_transfer') return text.bankTransfer
  if (participant.payment_status === 'free') return text.free
  return ''
}

export function participantPaymentAmountSummary(participant: Participant) {
  const splitTotal = participantPaymentSplitTotal(participant.payment_splits)
  return splitTotal || participant.payment_amount || 0
}

export function individualTicketUnitPrice(dateValue: string, timeValue: string) {
  if (!dateValue) return individualTicketPrices.weekdayDay
  const day = new Date(`${dateValue}T12:00:00`).getDay()
  if (day === 0 || day === 6) return individualTicketPrices.weekend
  const minutes = timeValue ? timeToMinutes(timeValue) : 12 * 60
  return minutes >= 18 * 60 ? individualTicketPrices.weekdayEvening : individualTicketPrices.weekdayDay
}

export function ticketUnitPrice(_ticketType: TicketType, dateValue: string, timeValue: string) {
  return individualTicketUnitPrice(dateValue, timeValue)
}

export function ticketRequiredSlots(players: number) {
  return Math.max(1, Math.ceil(Math.max(1, players) / ticketArenaCapacityPerSlot))
}

export function ticketMinimumDurationBlocks(players: number) {
  if (players > 12) return 3
  return ticketRequiredSlots(players)
}

export function ticketBillablePlayersPerBlock(players: number) {
  const playerCount = Math.max(1, players)
  if (playerCount <= ticketArenaCapacityPerSlot) return playerCount
  return ticketArenaCapacityPerSlot
}

export function ticketPricingSummary(
  ticketType: TicketType,
  dateValue: string,
  timeValue: string,
  players: number,
  durationMinutes: number
) {
  const baseUnitPrice = ticketUnitPrice(ticketType, dateValue, timeValue)
  const requiredSlots = ticketMinimumDurationBlocks(players)
  const durationBlocks = Math.max(1, Math.ceil(durationMinutes / ticketPriceBlockMinutes))
  const chargedPlayersPerBlock = ticketBillablePlayersPerBlock(players)
  const chargedPlayerSpots = durationBlocks * chargedPlayersPerBlock
  const unitPrice = baseUnitPrice
  const grossPrice = baseUnitPrice * chargedPlayerSpots
  const discountRate = players >= 9 && players <= 12
    ? 0.15
    : players >= 5 && players <= 8
      ? 0.1
      : 0
  const discountAmount = Math.round(grossPrice * discountRate)

  return {
    baseUnitPrice,
    unitPrice,
    requiredSlots,
    durationBlocks,
    chargedPlayersPerBlock,
    chargedPlayerSpots,
    grossPrice,
    discountRate,
    discountAmount,
    totalPrice: grossPrice - discountAmount,
  }
}

export function ticketDurationForPlayers(ticketType: TicketType, players: number) {
  return Math.max(selectedTicketService(ticketType).duration, ticketMinimumDurationBlocks(players) * ticketPriceBlockMinutes)
}

export function ticketArenaCountForPlayers() {
  return ticketArenaCount
}

export function ticketUnitFormulaText(text: Record<string, string>, unitPrice: number, players: number) {
  const playerCount = Math.max(1, players >= ticketArenaCapacityPerSlot ? ticketArenaCapacityPerSlot : players)
  const playerWord = playerCount === 1 ? text.ticketFormulaPlayer : text.ticketFormulaPlayers

  return text.ticketUnitFormula
    .replace('{price}', formatTicketFormulaPrice(unitPrice))
    .replace('{players}', String(playerCount))
    .replace('{playerWord}', playerWord)
}

export function clampTicketLoyaltyRedemption(points: number, balance: number, redeemValue: number, subtotal: number) {
  if (!Number.isFinite(points) || !Number.isFinite(balance) || !Number.isFinite(redeemValue) || !Number.isFinite(subtotal)) return 0
  if (redeemValue <= 0 || subtotal <= 0) return 0
  const maxByBalance = Math.max(0, Math.floor(balance))
  const maxByPrice = Math.floor(Math.max(0, subtotal) / redeemValue)
  return Math.max(0, Math.min(Math.floor(points), maxByBalance, maxByPrice))
}

export function isBirthdayToday(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return false

  const today = new Date()
  return today.getMonth() + 1 === month && today.getDate() === day
}

export function resolveCountryCode(input: string) {
  const normalized = input.trim().toLowerCase()
  const explicitCode = normalized.match(/\+\d{1,4}/)?.[0]
  if (explicitCode) return explicitCode

  const country = countries.find((item) => item.name.toLowerCase().includes(normalized))
  return country?.code || '+84'
}

export function splitPhoneNumber(phone: string) {
  const cleaned = phone.trim()
  const country = [...countries]
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => cleaned.startsWith(item.code))

  if (!country) {
    return { countryInput: '+84', localPhone: cleaned }
  }

  return {
    countryInput: country.code,
    localPhone: cleaned.slice(country.code.length).trim(),
  }
}

export function displayName(profile: Profile | null) {
  if (!profile) return 'Player'
  if (profile.anonymous_mode) return anonymousProfileName(profile)
  return compactDisplayName(profile.nickname || profile.full_name || profile.phone)
}

export function limitDisplayName(value: string) {
  return Array.from(value).slice(0, MAX_DISPLAY_NAME_LENGTH).join('')
}

export function compactDisplayName(value: string | null | undefined, fallback = 'Player') {
  const cleaned = (value || fallback).trim() || fallback
  return limitDisplayName(cleaned)
}

export function playerCardLabel(value: string | null | undefined, fallback = 'Player') {
  return `Open ${compactDisplayName(value, fallback)} player card`
}

export function anonymousCallsignForId(profileId: string | null | undefined) {
  const value = profileId || 'private-player'
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  const prefix = ANONYMOUS_CALLSIGN_PREFIXES[hash % ANONYMOUS_CALLSIGN_PREFIXES.length]
  const number = String((hash % 900) + 100).padStart(3, '0')
  return `${prefix}-${number}`
}

export function anonymousProfileName(profile: Pick<Profile, 'id' | 'nickname' | 'anonymous_callsign'>) {
  return compactDisplayName(profile.nickname || profile.anonymous_callsign || anonymousCallsignForId(profile.id), 'CIPHER-291')
}

export function finiteNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

export function leaderboardPlayerFromStaffProfile(profile: StaffProfile, fallbackName: string): LeaderboardPlayer {
  const isAnonymous = Boolean(profile.anonymous_mode)
  const averageAccuracyOverride = Number(profile.average_accuracy_override)
  const bestEscapeDurationSecondsOverride = Number(profile.best_escape_duration_seconds_override)
  const totalProjectilesOverride = Number(profile.total_projectiles_override)
  const name = isAnonymous
    ? anonymousProfileName({
      id: profile.id,
      nickname: profile.nickname || null,
      anonymous_callsign: profile.anonymous_callsign || null,
    })
    : compactDisplayName(profile.nickname || profile.full_name || profile.phone || profile.email, fallbackName)

  return {
    profileId: profile.id,
    displayName: name,
    avatarUrl: isAnonymous ? null : profile.avatar_url || null,
    avatarEmoji: isAnonymous ? ANONYMOUS_MASK_EMOJI : profile.avatar_emoji || null,
    avatarInitials: isAnonymous ? null : profile.avatar_initials || null,
    avatarColor: isAnonymous ? ANONYMOUS_MASK_COLOR : profile.avatar_color || null,
    avatarTextColor: isAnonymous ? ANONYMOUS_MASK_TEXT_COLOR : profile.avatar_text_color || null,
    profileMotto: isAnonymous ? null : profile.profile_motto || null,
    sessionsJoined: 0,
    gamesJoined: 0,
    wins: 0,
    bestPerformerCount: 0,
    baseTotalScore: 0,
        totalScore: 0,
        scoreAdjustment: 0,
    loyaltyPoints: Math.max(0, Math.floor(Number(profile.loyalty_points_total ?? 0) || 0)),
        totalAccuracy: 0,
    accuracyCount: 0,
    totalProjectiles: Number.isFinite(totalProjectilesOverride) ? Math.max(0, Math.floor(totalProjectilesOverride)) : 0,
    averageAccuracy: Number.isFinite(averageAccuracyOverride) ? averageAccuracyOverride : null,
    reliabilityScore: 0,
    bestEscapeDurationSeconds: Number.isFinite(bestEscapeDurationSecondsOverride) && bestEscapeDurationSecondsOverride > 0 ? bestEscapeDurationSecondsOverride : null,
    bestByGame: [],
  }
}

export function compactInitials(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return ''
  const words = cleaned.split(/\s+/).filter(Boolean)
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0] || '').join('')
    : Array.from(cleaned).slice(0, 2).join('')
  return letters.toUpperCase()
}

export function validAvatarInitials(value: string | null | undefined) {
  const initials = compactInitials(value || '')
  return initials && initials !== '?' ? initials : ''
}

export function limitMotto(value: string) {
  return Array.from(value).slice(0, 20).join('')
}

export function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim())
}

export function cleanHexColor(value: string, fallback: string) {
  const trimmed = value.trim()
  return isHexColor(trimmed) ? trimmed.toLowerCase() : fallback
}

export function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

export function dateValueToLocalDate(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`)
}

export function addDaysToDateValue(dateValue: string, days: number) {
  return localDateString(addDays(dateValueToLocalDate(dateValue), days))
}

export function daysBetweenDateValues(startDate: string, endDate: string) {
  const start = dateValueToLocalDate(startDate).getTime()
  const end = dateValueToLocalDate(endDate).getTime()
  return Math.round((end - start) / (24 * 60 * 60 * 1000))
}

export function maxDateValue(...dateValues: Array<string | undefined | null>) {
  const sortedDates = dateValues.filter((dateValue): dateValue is string => Boolean(dateValue)).sort()
  return sortedDates.length ? sortedDates[sortedDates.length - 1] : ''
}

export function upcomingBatchEndForDate(dateValue: string) {
  const today = localDateString()
  const daysFromToday = Math.max(0, daysBetweenDateValues(today, dateValue))
  const batchIndex = Math.floor(daysFromToday / SESSION_LOAD_BATCH_DAYS)
  return addDaysToDateValue(today, (batchIndex + 1) * SESSION_LOAD_BATCH_DAYS - 1)
}

export function startOfWeekDateValue(dateValue: string) {
  const date = dateValueToLocalDate(dateValue)
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return localDateString(addDays(date, mondayOffset))
}

export function weekDaysFromStart(startDate: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysToDateValue(startDate, index))
}

export function formatDayButton(dateValue: string, language: LanguageCode) {
  const date = new Date(`${dateValue}T12:00:00`)
  const locale = dateLocales[language]
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
    day: formatShortDate(dateValue, language),
  }
}

export function formatShortDate(dateValue: string, language: LanguageCode) {
  if (!dateValue) return ''
  void language
  const date = new Date(`${dateValue}T12:00:00`)
  const day = String(date.getDate()).padStart(2, '0')
  const month = monthAbbreviations[date.getMonth()]
  return `${day} ${month}`
}

export function formatCalendarWeekRange(startDate: string, language: LanguageCode) {
  const endDate = addDaysToDateValue(startDate, 6)
  return `${formatShortDate(startDate, language)} - ${formatShortDate(endDate, language)}`
}

export function sessionStartDate(session: Pick<Session, 'date' | 'start_time'>) {
  return new Date(`${session.date}T${session.start_time}`)
}

export function sessionEndDate(session: Pick<Session, 'date' | 'start_time' | 'duration_minutes'>) {
  return new Date(sessionStartDate(session).getTime() + session.duration_minutes * 60 * 1000)
}

export function isPastSession(session: Session) {
  return session.status === 'completed' || sessionEndDate(session).getTime() < Date.now()
}

export function isUpcomingSession(session: Session) {
  return !isPastSession(session)
}

export function sortSessionsByStart(sessionsToSort: Session[]) {
  return [...sessionsToSort].sort((left, right) => {
    const leftStart = `${left.date}T${left.start_time}`
    const rightStart = `${right.date}T${right.start_time}`
    return leftStart.localeCompare(rightStart) || left.name.localeCompare(right.name)
  })
}

export function seatsLeft(session: Pick<Session, 'max_players' | 'session_participants'>) {
  return Math.max(0, session.max_players - (session.session_participants ?? []).length)
}

export function mostVotedGameId(session: Pick<Session, 'game_options' | 'game_votes'>) {
  const voteCounts = new Map<GameId, number>()
  Object.values(session.game_votes || {}).forEach((gameId) => {
    if (games.some((game) => game.id === gameId)) {
      voteCounts.set(gameId, (voteCounts.get(gameId) || 0) + 1)
    }
  })

  let winner: GameId | null = null
  let winnerVotes = 0
  voteCounts.forEach((count, gameId) => {
    if (count > winnerVotes) {
      winner = gameId
      winnerVotes = count
    }
  })

  return winner
}

export function sessionCoverGame(session: Pick<Session, 'game_options' | 'game_votes' | 'confirmed_game_id'>) {
  const confirmedGame = games.find((game) => game.id === session.confirmed_game_id)
  if (confirmedGame) return confirmedGame

  const votedGameId = mostVotedGameId(session)
  const votedGame = games.find((game) => game.id === votedGameId)
  if (votedGame) return votedGame

  return games.find((game) => game.id === session.game_options?.[0]) || games[0]
}

export function isInteractiveClickTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button, input, select, textarea, a, label, summary, details'))
}

export function rankEmoji(placement?: number | null) {
  if (placement === 1) return '🥇'
  if (placement === 2) return '🥈'
  if (placement === 3) return '🥉'
  return ''
}

export function participantScore(participant: Participant) {
  if (participant.score === null || participant.score === undefined) return null

  const score = Number(participant.score)
  return Number.isFinite(score) ? score : null
}

export function sessionBestPerformer(session: Session) {
  const participants = session.session_participants ?? []
  const scoredParticipants = participants
    .map((participant) => ({ participant, score: participantScore(participant) }))
    .filter((item): item is { participant: Participant; score: number } => item.score !== null)

  if (participants.length < 2 || scoredParticipants.length !== participants.length) return null

  const bestScore = Math.max(...scoredParticipants.map((item) => item.score))
  const leaders = scoredParticipants.filter((item) => item.score === bestScore)

  if (leaders.length !== 1) return null

  return leaders[0]
}

export function isBestSessionPerformer(session: Session, participant: Participant) {
  return sessionBestPerformer(session)?.participant.id === participant.id
}

export function percentValue(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

export function formatSpeedrunDuration(value: number | null | undefined) {
  if (!Number.isFinite(value) || Number(value) <= 0) return '-'

  const totalSeconds = Math.round(Number(value))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function parseSpeedrunDuration(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null

  const textValue = String(value).trim()
  if (!textValue) return null

  if (textValue.includes(':')) {
    const parts = textValue.split(':').map((part) => Number(part.trim()))
    if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) return Number.NaN

    const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]]
    return Math.round((hours * 3600) + (minutes * 60) + seconds)
  }

  const seconds = Number(textValue)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : Number.NaN
}

export async function loadCanvasImage(src: string) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('image failed'))
    image.src = src
  })
  return image
}

export function bestOfLabel(value?: number | null) {
  return `BO${value || 1}`
}

export function authDebug(label: string, payload?: unknown) {
  if (typeof console === 'undefined') return
  console.groupCollapsed(`[VRena auth] ${label}`)
  if (payload !== undefined) console.log(payload)
  console.groupEnd()
}

export function winsNeeded(bestOf?: number | null) {
  return Math.floor((bestOf || 1) / 2) + 1
}

export function isPaidParticipant(participant: Participant) {
  return Boolean(participant.payment_status && participant.payment_status !== null)
}

export function eligibleTournamentParticipants(session: Session) {
  return (session.session_participants ?? [])
    .filter((participant) => participant.checked_in)
    .filter((participant) => !session.require_payment || isPaidParticipant(participant))
}

export function shuffleItems<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item)
}

export function matchWinnerFromSeries(match: Pick<TournamentMatch, 'participant_a_id' | 'participant_b_id' | 'wins_a' | 'wins_b' | 'score_a' | 'score_b' | 'best_of'>) {
  const needed = winsNeeded(match.best_of)
  const winsA = Number(match.wins_a ?? 0)
  const winsB = Number(match.wins_b ?? 0)

  if (match.participant_a_id && winsA >= needed && winsA > winsB) return match.participant_a_id
  if (match.participant_b_id && winsB >= needed && winsB > winsA) return match.participant_b_id

  if ((match.best_of || 1) === 1 && match.score_a !== null && match.score_b !== null && match.score_a !== match.score_b) {
    return Number(match.score_a) > Number(match.score_b) ? match.participant_a_id : match.participant_b_id
  }

  return null
}

export function matchLoser(match: Pick<TournamentMatch, 'participant_a_id' | 'participant_b_id'>, winnerId: string | null) {
  if (!winnerId) return null
  if (winnerId === match.participant_a_id) return match.participant_b_id
  if (winnerId === match.participant_b_id) return match.participant_a_id
  return null
}

export function hasDuplicateMatchPlayers(match: Pick<TournamentMatch, 'participant_a_id' | 'participant_b_id'>) {
  return Boolean(match.participant_a_id && match.participant_b_id && match.participant_a_id === match.participant_b_id)
}

export function knockoutStageForCount(count: number): MatchStage {
  if (count <= 2) return 'final'
  if (count <= 4) return 'semifinal'
  if (count <= 8) return 'quarterfinal'
  if (count <= 16) return 'round_of_16'
  return 'custom'
}

export function qualificationCount(rule?: QualificationRule | null, custom = 2) {
  if (rule === 'top_1') return 1
  if (rule === 'top_2') return 2
  if (rule === 'top_4') return 4
  return Math.max(1, custom || 1)
}

export function calculatePoolStandings(session: Session, pool: TournamentPool, entries: TournamentPoolEntry[], matches: TournamentMatch[]): PoolStanding[] {
  const participants = session.session_participants ?? []
  const standings = new Map<string, PoolStanding>()

  entries
    .filter((entry) => entry.pool_id === pool.id)
    .forEach((entry) => {
      const participant = participants.find((item) => item.id === entry.participant_id)
      standings.set(entry.participant_id, {
        participantId: entry.participant_id,
        profileId: entry.profile_id,
        displayName: compactDisplayName(participant?.display_name, 'Player'),
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifference: 0,
        points: 0,
        tieBreakNote: 'Points, then head-to-head, score difference, total score, random draw.',
      })
    })

  matches
    .filter((match) => match.pool_id === pool.id && match.stage === 'pool' && match.status === 'completed')
    .forEach((match) => {
      if (!match.participant_a_id || !match.participant_b_id) return
      const a = standings.get(match.participant_a_id)
      const b = standings.get(match.participant_b_id)
      if (!a || !b) return

      const scoreA = Number(match.score_a ?? match.wins_a ?? 0)
      const scoreB = Number(match.score_b ?? match.wins_b ?? 0)
      a.matchesPlayed += 1
      b.matchesPlayed += 1
      a.scoreFor += scoreA
      a.scoreAgainst += scoreB
      b.scoreFor += scoreB
      b.scoreAgainst += scoreA

      const winner = match.winner_participant_id || matchWinnerFromSeries(match)
      if (winner === a.participantId) {
        a.wins += 1
        a.points += 3
        b.losses += 1
      } else if (winner === b.participantId) {
        b.wins += 1
        b.points += 3
        a.losses += 1
      }
    })

  const poolMatches = matches.filter((match) => match.pool_id === pool.id)
  return Array.from(standings.values())
    .map((standing) => ({
      ...standing,
      scoreDifference: standing.scoreFor - standing.scoreAgainst,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points

      const direct = poolMatches.find((match) =>
        match.status === 'completed'
        && ((match.participant_a_id === a.participantId && match.participant_b_id === b.participantId)
          || (match.participant_a_id === b.participantId && match.participant_b_id === a.participantId))
      )

      if (direct?.winner_participant_id === a.participantId) return -1
      if (direct?.winner_participant_id === b.participantId) return 1
      if (b.scoreDifference !== a.scoreDifference) return b.scoreDifference - a.scoreDifference
      if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor
      return a.participantId.localeCompare(b.participantId)
    })
}

export function queueLabel(status: MatchStatus, index: number) {
  if (status === 'live') return 'LIVE NOW'
  if (status === 'next') return 'NEXT MATCH'
  if (index < 4) return 'ON DECK'
  if (status === 'completed') return 'COMPLETED'
  return 'WAITING'
}

export function buildKnockoutRows(sessionId: string, participantIds: string[], stage: MatchStage, round: number, bestOf: 1 | 3 | 5 | number): TournamentMatchInsert[] {
  const uniqueIds = Array.from(new Set(participantIds.filter(Boolean)))
  const rows: TournamentMatchInsert[] = []

  for (let index = 0; index < uniqueIds.length; index += 2) {
    const participantA = uniqueIds[index] || null
    const participantB = uniqueIds[index + 1] || null
    if (participantA && participantB && participantA === participantB) continue

    rows.push({
      session_id: sessionId,
      pool_id: null,
      stage,
      round,
      match_number: Math.floor(index / 2) + 1,
      participant_a_id: participantA,
      participant_b_id: participantB,
      status: participantB ? 'waiting' : 'completed',
      winner_participant_id: participantB ? null : participantA,
      loser_participant_id: null,
      arena_number: null,
      queue_position: Math.floor(index / 2) + 1,
      best_of: bestOf,
    })
  }

  return rows
}

export function appRedirectUrl() {
  if (typeof window === 'undefined') return DEFAULT_APP_URL

  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return DEFAULT_APP_URL
  }

  return window.location.origin
}

export function passwordRecoveryUrlParams() {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  const hashParams = new URLSearchParams(hash)
  const searchParams = url.searchParams
  const type = hashParams.get('type') || searchParams.get('type')
  const code = searchParams.get('code') || hashParams.get('code')
  const accessToken = hashParams.get('access_token') || searchParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token')
  const errorDescription = hashParams.get('error_description') || searchParams.get('error_description')
  const isRecovery = type === 'recovery' || type === 'invite' || Boolean(accessToken && refreshToken) || Boolean(code)

  if (!isRecovery && !errorDescription) return null

  return {
    accessToken,
    code,
    errorDescription,
    refreshToken,
  }
}

export function cleanPasswordRecoveryUrl() {
  if (typeof window === 'undefined') return
  window.history.replaceState(null, '', window.location.pathname)
}

export function icsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function icsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function scheduleDeferredWork(callback: () => void) {
  if (typeof window === 'undefined') return () => {}

  const idleWindow = window as unknown as {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 2500 })
    return () => idleWindow.cancelIdleCallback?.(handle)
  }

  const handle = window.setTimeout(callback, 900)
  return () => window.clearTimeout(handle)
}

export function schedulePostEffectStateUpdate(callback: () => void) {
  if (typeof window === 'undefined') return () => {}

  const handle = window.setTimeout(callback, 0)
  return () => window.clearTimeout(handle)
}
