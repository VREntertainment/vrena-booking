'use client'

import dynamic from 'next/dynamic'
import NextImage from 'next/image'
import {
  Bold,
  Bell,
  CalendarPlus,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crown,
  Eye,
  EyeOff,
  Italic,
  KeyRound,
  LockKeyhole,
  Languages,
  Mail,
  Phone,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  Share,
  ShieldCheck,
  Strikethrough,
  Trash2,
  Underline,
  UserCheck,
  UserMinus,
  UserRound,
  X,
} from 'lucide-react'
import { Component, ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { getInitialLanguage, isLanguageCode, languageOptions, storeLanguage, type LanguageCode, type TranslationMap, uiText } from '../lib/i18n'
import { RATE_LIMITS, type RateLimitAction } from '../lib/security/rateLimit'
import type { LeaderboardCriterion, LeaderboardPlayer } from './LeaderboardPanel'
import type { StaffProfile } from './StaffConsole'

const ARENA_COUNT = 2
const OPEN_MINUTES = 9 * 60
const CLOSE_MINUTES = 22 * 60
const TIME_STEP_MINUTES = 20
const SESSION_LOAD_BATCH_DAYS = 7
const LEADERBOARD_PAGE_SIZE = 20
const REALTIME_REFRESH_DEBOUNCE_MS = 650
const OWNER_EMAILS = ['emilejacquet@icloud.com']
const ADMIN_ONLY_EMAILS = ['emile@vre-vietnam.com', 'contact@vre-vietnam.com']
const ADMIN_EMAILS = [...OWNER_EMAILS, ...ADMIN_ONLY_EMAILS]
const DEFAULT_APP_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vrena-booking.vercel.app'
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || 'a4be4d0e-2570-4642-a1a6-a44c02fa0d46'
const HCAPTCHA_READY_CALLBACK = '__vrenaHcaptchaReady'
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const PRIVACY_POLICY_URL = 'https://www.vre-vietnam.com'
const MAX_DISPLAY_NAME_LENGTH = 10
const SESSION_PARTICIPANT_SELECT = 'id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, checked_in, payment_status, payment_amount, payment_splits, score, accuracy_percent, projectiles_fired, escape_duration_seconds, placement, prize_claimed, prize_claimed_at'
const SESSION_CARD_PARTICIPANT_SELECT = 'id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, checked_in'
const SESSION_SELECT_BASE = `id, owner_id, club_id, session_type, name, date, start_time, duration_minutes, max_players, arena_count, game_options, game_votes, confirmed_game_id, visibility, invite_code, notes, status, tournament_format, best_of, rounds_per_match, require_payment, qualification_rule, custom_qualifiers, enable_third_place_match, first_prize, second_prize, third_prize, tournament_locked, session_participants(${SESSION_PARTICIPANT_SELECT})`
const SESSION_SELECT = `id, owner_id, club_id, session_type, name, date, start_time, duration_minutes, max_players, arena_count, game_options, game_votes, confirmed_game_id, visibility, invite_code, notes, status, tournament_format, best_of, rounds_per_match, require_payment, qualification_rule, custom_qualifiers, enable_third_place_match, first_prize, second_prize, third_prize, tournament_locked, seeded, seed_label, seed_batch, booking_type, ticket_type, ticket_player_count, ticket_total_price, ticket_unit_price, ticket_status, ticket_reference, ticket_customer_id, challenge_target_id, challenge_status, challenge_accepted_at, challenge_declined_at, session_participants(${SESSION_PARTICIPANT_SELECT})`
const SESSION_CARD_SELECT_BASE = `id, owner_id, club_id, session_type, name, date, start_time, duration_minutes, max_players, arena_count, game_options, confirmed_game_id, visibility, invite_code, status, rounds_per_match, session_participants(${SESSION_CARD_PARTICIPANT_SELECT})`
const SESSION_CARD_SELECT = `id, owner_id, club_id, session_type, name, date, start_time, duration_minutes, max_players, arena_count, game_options, confirmed_game_id, visibility, invite_code, status, rounds_per_match, seeded, seed_label, booking_type, ticket_type, ticket_player_count, challenge_target_id, challenge_status, session_participants(${SESSION_CARD_PARTICIPANT_SELECT})`
const OPTIONAL_SESSION_METADATA_COLUMNS = [
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
const WAITLIST_SELECT = 'id, session_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, created_at'
const WAITLIST_POSITION_SELECT = 'id, session_id, profile_id, created_at'
const CLUB_MEMBER_SELECT_BASE = 'id, club_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, status, deleted_at'
const CLUB_MEMBER_SELECT = `${CLUB_MEMBER_SELECT_BASE}, role, created_at`
const CLUB_SELECT_BASE = `id, owner_id, name, description, visibility, pin_code, member_count, created_at, club_members(${CLUB_MEMBER_SELECT_BASE})`
const CLUB_SELECT = `id, owner_id, name, motto, description, banner_url, theme_color, default_language, ranking_criterion, visibility, pin_code, member_count, created_at, club_members(${CLUB_MEMBER_SELECT})`
const CLUB_PUBLIC_SELECT = 'id, owner_id, name, motto, description, banner_url, theme_color, default_language, ranking_criterion, visibility, member_count, created_at'
const CLUB_MESSAGE_SELECT = 'id, club_id, author_id, author_display_name, author_avatar_url, author_avatar_emoji, author_avatar_initials, author_avatar_color, author_avatar_text_color, author_profile_motto, message_type, body, created_at'
const SESSION_MESSAGE_SELECT = 'id, session_id, author_id, author_display_name, author_avatar_url, author_avatar_emoji, author_avatar_initials, author_avatar_color, author_avatar_text_color, author_profile_motto, message_type, body, moderation_status, moderation_reason, reviewed_by, reviewed_at, moderation_categories, moderation_score, created_at'
const CLUB_BANNER_MAX_BYTES = 2 * 1024 * 1024
const CLUB_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_IMAGE_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const CLUB_MESSAGE_MAX_LENGTH = 150
const CLUB_MESSAGE_LIMIT = 30

function ShareSymbol() {
  return <Share aria-hidden="true" className="share-symbol-icon" size={26} strokeWidth={2.2} />
}

function ButtonIconText({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <span className="button-icon-text">
      {icon}
      <span>{children}</span>
    </span>
  )
}

function MessageBodyText({
  body,
  messageId,
  messageKind,
  onToggleOriginal,
  onRequestTranslation,
  targetLanguage,
  text,
  translation,
}: {
  body: string
  messageId: string
  messageKind: 'club' | 'session'
  onToggleOriginal: () => void
  onRequestTranslation: (messageKind: 'club' | 'session', messageId: string, body: string, targetLanguage: LanguageCode) => void
  targetLanguage: LanguageCode
  text: TranslationMap
  translation?: MessageTranslationState
}) {
  useEffect(() => {
    if (translation?.loading || translation?.translatedText || translation?.error) return
    onRequestTranslation(messageKind, messageId, body, targetLanguage)
  }, [body, messageId, messageKind, onRequestTranslation, targetLanguage, translation?.error, translation?.loading, translation?.translatedText])

  const hasTranslation = Boolean(translation?.changed && translation.translatedText)
  const showingOriginal = Boolean(translation?.showOriginal)
  const displayBody = hasTranslation && !showingOriginal ? translation?.translatedText || body : body

  return (
    <>
      <p>{displayBody}</p>
      {hasTranslation && (
        <div className="message-translation-row">
          <span className="message-translation-status">
            <Languages aria-hidden="true" size={13} strokeWidth={2.4} />
            <span>{text.messageTranslated}</span>
          </span>
          <button className="message-translation-toggle" type="button" onClick={onToggleOriginal}>
            {showingOriginal ? text.showTranslatedMessage : text.showOriginalMessage}
          </button>
        </div>
      )}
      {translation?.loading && !hasTranslation && (
        <div className="message-translation-row loading">
          <span className="message-translation-status">
            <Languages aria-hidden="true" size={13} strokeWidth={2.4} />
            <span>{text.translatingMessage}</span>
          </span>
        </div>
      )}
    </>
  )
}
const SESSION_MESSAGE_PAGE_SIZE = 30

let supabaseClientPromise: Promise<typeof import('../lib/supabase/client').supabase> | null = null

function getSupabase() {
  supabaseClientPromise ??= import('../lib/supabase/client').then((module) => module.supabase)
  return supabaseClientPromise
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}

function shouldSkipImageOptimization(source: string | null | undefined) {
  const normalizedSource = source?.trim().toLowerCase() || ''
  return normalizedSource.startsWith('blob:') || normalizedSource.startsWith('data:') || /\.gif($|\?)/.test(normalizedSource)
}

const RichNotesEditor = dynamic(() => import('./RichNotesEditor'), { ssr: false })
const ShortDateInput = dynamic(() => import('./ShortDateInput'), { ssr: false })
const TicketBookingView = dynamic(() => import('./TicketBookingView'), {
  ssr: false,
  loading: () => (
    <section className="section tickets-section">
      <p className="notice" aria-busy="true">...</p>
    </section>
  ),
})
const GameGuideModal = dynamic(() => import('./GameGuideModal'), { ssr: false })
const StaffConsole = dynamic(() => import('./StaffConsole'), {
  ssr: false,
  loading: () => (
    <section className="section staff-console">
      <p className="notice" aria-busy="true">Loading Staff Console...</p>
    </section>
  ),
})
const LoginPromptModal = dynamic(() => import('./SessionModals').then((module) => module.LoginPromptModal), { ssr: false })
const InvitePopupModal = dynamic(() => import('./SessionModals').then((module) => module.InvitePopupModal), { ssr: false })
const ChampionLoginModal = dynamic(() => import('./SessionModals').then((module) => module.ChampionLoginModal), { ssr: false })
const BirthdayPopupModal = dynamic(() => import('./SessionModals').then((module) => module.BirthdayPopupModal), { ssr: false })
const TariffPaymentModal = dynamic(() => import('./SessionModals').then((module) => module.TariffPaymentModal), { ssr: false })
const CheckInModal = dynamic(() => import('./SessionModals').then((module) => module.CheckInModal), { ssr: false })
const PlayerProfileModal = dynamic(() => import('./SessionModals').then((module) => module.PlayerProfileModal), { ssr: false })
const LeaderboardPanel = dynamic(() => import('./LeaderboardPanel'), {
  ssr: false,
  loading: () => (
    <section aria-busy="true" className="section leaderboard-section">
      <p className="notice">...</p>
    </section>
  ),
})

type LocalErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
  resetKey: string
}

type LocalErrorBoundaryState = {
  hasError: boolean
}

class LocalErrorBoundary extends Component<LocalErrorBoundaryProps, LocalErrorBoundaryState> {
  state: LocalErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previousProps: LocalErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(error, info)
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

type HCaptchaApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      size?: 'invisible'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    }
  ) => string
  execute?: (
    widgetId?: string,
    options?: { async?: boolean }
  ) => void | Promise<string | { response?: string }>
  reset: (widgetId?: string) => void
  remove?: (widgetId: string) => void
}

type GameId =
  | 'laser-tag'
  | 'mini-block-towers'
  | 'office-war'
  | 'paintball'
  | 'snow-battle'
  | 'castle-unspunnen'
  | 'wild-west'
  | 'arc-of-the-covenant'
  | 'joller-house'

type TicketType = 'individual' | 'birthday' | 'corporate'
type TicketStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
type BookingType = 'community' | 'ticket' | 'challenge'
type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
type ClubRole = 'owner' | 'admin' | 'moderator' | 'member'
type ClubMemberRole = Exclude<ClubRole, 'owner'>
type ClubTab = 'hall' | 'members' | 'sessions' | 'messages' | 'settings'
type ClubSessionScope = 'upcoming' | 'past'
type ParticipantPaymentMethod = 'cash' | 'bank_transfer'
type ParticipantPaymentSplit = {
  payment_method: ParticipantPaymentMethod
  amount: number
}
type ParticipantPaymentSplitDraft = {
  id: string
  payment_method: ParticipantPaymentMethod
  amount: string
}

type GameAudience =
  | 'familyFriendly'
  | 'scary'
  | 'fun'
  | 'quest'
  | 'teamwork'
  | 'beginnerFriendly'
  | 'competitive'

type GameInfo = {
  id: GameId
  title: string
  category: 'FPS / PVP' | 'Escape'
  image: string
  durationMinutes: number
  maxPlayersPerArena: number
  audience: GameAudience[]
}

type StaffGameGuideText = Partial<Record<LanguageCode, string>>

type StaffGameGuide = {
  slug: string
  guide_language?: string | null
  guide_summary?: StaffGameGuideText | null
  guide_rules?: StaffGameGuideText | null
  guide_tips?: StaffGameGuideText | null
}

type TicketBookingConfirmation = {
  sessionId: string
  reference: string
  ticketType: TicketType
  ticketLabel: string
  date: string
  time: string
  players: number
  totalPrice: number
  loyaltyPointsRedeemed?: number
  loyaltyDiscountAmount?: number
  discountCode?: string
  discountAmount?: number
}

type Profile = {
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
  anonymous_mode?: boolean | null
  anonymous_callsign?: string | null
  marketing_consent?: boolean | null
  marketing_consent_at?: string | null
  marketing_opted_out_at?: string | null
}

type TotpFactor = {
  id: string
  friendly_name?: string
  factor_type?: string
  status?: string
  created_at?: string
  updated_at?: string
}

type TotpEnrollment = {
  id: string
  qrCode: string
  secret: string
}

type TicketLoyaltyRedemption = {
  loyalty_points_total: number
  redeem_value_vnd_per_point: number
}

type TicketLoyaltyEarnQuote = {
  estimated_points: number
  estimated_reduction_vnd: number
  redeem_value_vnd_per_point: number
}

type TicketDiscountQuote = {
  discount_rule_id?: string
  discount_code?: string
  discount_name: string
  discount_amount: number
}

type LeaderboardRpcRow = {
  profile_id: string
  display_name: string | null
  avatar_url: string | null
  avatar_emoji: string | null
  avatar_initials: string | null
  avatar_color: string | null
  avatar_text_color: string | null
  profile_motto: string | null
  sessions_joined: number | null
  games_joined: number | null
  wins: number | null
  best_performer_count: number | null
  base_total_score: number | null
  total_score: number | null
  score_adjustment: number | null
  total_accuracy: number | null
  accuracy_count: number | null
  total_projectiles: number | null
  average_accuracy: number | null
  reliability_score: number | null
  best_by_game: unknown
  leaderboard_rank?: number | null
  leaderboard_distinct_rank?: number | null
  leaderboard_higher_metric_value?: number | null
  leaderboard_metric_value?: number | null
  leaderboard_total_count?: number | null
}

const ANONYMOUS_MASK_EMOJI = '🎭'
const ANONYMOUS_MASK_COLOR = '#11181b'
const ANONYMOUS_MASK_TEXT_COLOR = '#ffffff'
const ANONYMOUS_CALLSIGN_PREFIXES = ['ECHO', 'NOVA', 'ORION', 'CIPHER', 'PHANTOM', 'VORTEX', 'NEON', 'PULSE']
const PROFILE_GENDER_VALUES = ['male', 'female', 'non_binary', 'prefer_not_to_say', 'self_describe'] as const
type ProfileGender = typeof PROFILE_GENDER_VALUES[number]
const PROFILE_SELECT = 'id, phone, full_name, nickname, email, birthday, gender, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role, score_adjustment, loyalty_points_total, anonymous_mode, anonymous_callsign, marketing_consent, marketing_consent_at, marketing_opted_out_at'

function normalizeProfileGender(value: unknown): ProfileGender | '' {
  return typeof value === 'string' && PROFILE_GENDER_VALUES.includes(value as ProfileGender) ? value as ProfileGender : ''
}

function isAdminEmail(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()))
}

function isOwnerEmail(email?: string | null) {
  return Boolean(email && OWNER_EMAILS.includes(email.toLowerCase()))
}

function isAdminOnlyEmail(email?: string | null) {
  return Boolean(email && ADMIN_ONLY_EMAILS.includes(email.toLowerCase()))
}

function defaultRoleForEmail(email?: string | null) {
  const normalizedEmail = email?.toLowerCase() || ''
  if (OWNER_EMAILS.includes(normalizedEmail)) return 'owner'
  if (isAdminEmail(normalizedEmail)) return 'admin'
  return 'player'
}

function isAdminRole(role?: string | null) {
  const normalizedRole = role?.toLowerCase()
  return normalizedRole === 'super_admin' || normalizedRole === 'owner' || normalizedRole === 'admin'
}

function staffConsoleRank(role?: string | null, email?: string | null) {
  const normalizedEmail = email?.toLowerCase() || ''
  const normalizedRole = role?.toLowerCase() || ''
  if (isOwnerEmail(normalizedEmail)) return 120
  if (isAdminOnlyEmail(normalizedEmail)) return 100
  if (normalizedRole === 'super_admin' || normalizedRole === 'owner') return 120
  if (normalizedRole === 'admin') return 100
  if (normalizedRole === 'manager') return 80
  if (normalizedRole === 'staff' || normalizedRole === 'cashier') return 50
  if (normalizedRole === 'viewer') return 20
  return 0
}

function isLeaderboardCriterion(value: string | null | undefined): value is LeaderboardCriterion {
  return value === 'totalScore'
    || value === 'wins'
    || value === 'winRate'
    || value === 'accuracy'
    || value === 'reliability'
    || value === 'projectiles'
    || value === 'gamesPlayed'
    || value === 'escapeTime'
}

function initialLeaderboardQuery(): LeaderboardQuery {
  return {
    clubId: '',
    clubPin: '',
    criterion: 'totalScore',
    search: '',
  }
}

function leaderboardRpcArgs(query: LeaderboardQuery, offset: number, limit: number, profileId = '') {
  return {
    p_club_id: query.clubId || null,
    p_club_pin: query.clubPin || null,
    p_limit: limit,
    p_offset: offset,
    p_profile_id: profileId || null,
    p_rank_by: query.criterion,
    p_search: query.search.trim() || null,
  }
}

function normalizePrivateCode(value: string | null | undefined) {
  return (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

type Participant = {
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
  prize_claimed?: boolean | null
  prize_claimed_at?: string | null
}

type WaitlistEntry = {
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

type FriendConnection = {
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

type SessionInvite = {
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

type SessionMessage = {
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

type SessionMessagePageState = {
  loaded: boolean
  loading: boolean
  hasMore: boolean
  oldestCreatedAt: string | null
}

type ClubMessage = {
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

type MessageTranslationState = {
  loading?: boolean
  translatedText?: string
  sourceLanguage?: string | null
  changed?: boolean
  error?: string
  showOriginal?: boolean
}

type MessageTranslationResponse = {
  sourceLanguage?: string | null
  translatedText?: string
  changed?: boolean
}

type TournamentFormat = 'pool_only' | 'pool_to_semifinal' | 'pool_to_final' | 'single_elimination' | 'double_elimination' | 'leaderboard'
type QualificationRule = 'top_1' | 'top_2' | 'top_4' | 'custom'
type MatchStage = 'pool' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final' | 'third_place' | 'leaderboard' | 'custom'
type MatchStatus = 'waiting' | 'next' | 'live' | 'completed' | 'pending'
type RealtimeRefreshTask = 'profile' | 'sessions' | 'leaderboard' | 'clubs' | 'tournament' | 'network' | 'expandedDetails' | 'expandedMessages'

type Session = {
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

type BlockedTime = {
  date: string
  start_time: string
  end_time: string
  arenas_used: number
}

type SessionListPageResult = {
  sessions: Session[]
  scoreAdjustments: Record<string, number>
  blockedTimes: BlockedTime[]
  hasMoreAfter: boolean | null
  source: 'rpc' | 'select'
}

type ClubMember = {
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

type Club = {
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

type TournamentEditor = {
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

type TournamentPool = {
  id: string
  session_id: string
  name: string
  sort_order: number
}

type TournamentPoolEntry = {
  id: string
  session_id: string
  pool_id: string
  participant_id: string
  profile_id: string
  seed: number | null
  team_label?: string | null
}

type TournamentMatch = {
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

type TournamentData = {
  editors: TournamentEditor[]
  pools: TournamentPool[]
  poolEntries: TournamentPoolEntry[]
  matches: TournamentMatch[]
  auditLogs: TournamentAuditLog[]
}

type TournamentAuditLog = {
  id: string
  session_id: string
  user_id: string | null
  action: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

type PoolStanding = {
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

type TournamentMatchInsert = {
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

const games: GameInfo[] = [
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

function isEscapeGameId(gameId: string | null | undefined) {
  return games.some((game) => game.id === gameId && game.category === 'Escape')
}

function isEscapeSession(session: Pick<Session, 'confirmed_game_id' | 'game_options'> | null | undefined) {
  if (!session) return false
  return isEscapeGameId(session.confirmed_game_id) || (session.game_options ?? []).some((gameId) => isEscapeGameId(gameId))
}

const ticketServices: Array<{
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

const individualTicketPrices = {
  weekdayDay: 200000,
  weekdayEvening: 250000,
  weekend: 330000,
}
const ticketPriceBlockMinutes = 20
const ticketArenaCount = 1
const ticketArenaCapacityPerSlot = 4
const ticketMaxCustomerDurationMinutes = 120

const countries = [
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

const avatarColors = ['#3059ff', '#00b5b8', '#f59e0b', '#ef4444', '#7c3aed', '#0f766e', '#111827']
const avatarTextColors = ['#ffffff', '#071112', '#fef3c7', '#cffafe', '#fce7f3', '#dcfce7']
const avatarEmojis = ['😎', '🔥', '⚡', '🎮', '🚀', '🌀', '🎯', '🕹️', '👾', '🤖', '🧠', '💥', '🛡️', '🧩', '🏆', '✨']
const clubThemeColors = ['#3059ff', '#00b5b8', '#0f766e', '#f59e0b', '#ef4444', '#7c3aed', '#111827']


function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA
}

function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function arenasUsedBySession(session: Pick<Session, 'max_players' | 'arena_count'>) {
  return session.arena_count || (session.max_players > 7 ? 2 : 1)
}

function isTicketSession(session: Pick<Session, 'booking_type'>) {
  return session.booking_type === 'ticket'
}

function isChallengeSession(session: Pick<Session, 'booking_type'>) {
  return session.booking_type === 'challenge'
}

function selectedTicketService(ticketType: TicketType) {
  return ticketServices.find((service) => service.id === ticketType) || ticketServices[0]
}

function ticketTypeLabel(ticketType: TicketType, text: Record<string, string>) {
  if (ticketType === 'birthday') return text.birthdayTicket
  if (ticketType === 'corporate') return text.corporateTicket
  return text.individualTicket
}

function ticketTypeDescription(ticketType: TicketType, text: Record<string, string>) {
  if (ticketType === 'birthday') return text.birthdayTicketDescription
  if (ticketType === 'corporate') return text.corporateTicketDescription
  return text.individualTicketDescription
}

function formatVnd(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Math.max(0, value))
}

function formatTicketFormulaPrice(value: number) {
  return `${Math.max(0, value).toLocaleString('vi-VN')} đ`
}

function newParticipantPaymentSplit(method: ParticipantPaymentMethod = 'cash', amount = ''): ParticipantPaymentSplitDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    payment_method: method,
    amount,
  }
}

function normalizeParticipantPaymentSplits(splits: ParticipantPaymentSplitDraft[]): ParticipantPaymentSplit[] {
  return splits
    .map((split) => ({
      payment_method: split.payment_method,
      amount: Number(String(split.amount || '').replace(/[^\d]/g, '')),
    }))
    .filter((split) => split.amount > 0)
}

function participantPaymentSplitTotal(splits: ParticipantPaymentSplit[] | null | undefined) {
  return (splits ?? []).reduce((sum, split) => sum + split.amount, 0)
}

function paymentSplitsFromParticipant(participant: Participant): ParticipantPaymentSplitDraft[] {
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

function participantPaymentMethodSummary(participant: Participant, text: Record<string, string>) {
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

function participantPaymentAmountSummary(participant: Participant) {
  const splitTotal = participantPaymentSplitTotal(participant.payment_splits)
  return splitTotal || participant.payment_amount || 0
}

function individualTicketUnitPrice(dateValue: string, timeValue: string) {
  if (!dateValue) return individualTicketPrices.weekdayDay
  const day = new Date(`${dateValue}T12:00:00`).getDay()
  if (day === 0 || day === 6) return individualTicketPrices.weekend
  const minutes = timeValue ? timeToMinutes(timeValue) : 12 * 60
  return minutes >= 18 * 60 ? individualTicketPrices.weekdayEvening : individualTicketPrices.weekdayDay
}

function ticketUnitPrice(_ticketType: TicketType, dateValue: string, timeValue: string) {
  return individualTicketUnitPrice(dateValue, timeValue)
}

function ticketRequiredSlots(players: number) {
  return Math.max(1, Math.ceil(Math.max(1, players) / ticketArenaCapacityPerSlot))
}

function ticketMinimumDurationBlocks(players: number) {
  if (players > 12) return 3
  return ticketRequiredSlots(players)
}

function ticketBillablePlayersPerBlock(players: number) {
  const playerCount = Math.max(1, players)
  if (playerCount <= ticketArenaCapacityPerSlot) return playerCount
  return ticketArenaCapacityPerSlot
}

function ticketPricingSummary(
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
  const discountRate = 0
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

function ticketDurationForPlayers(ticketType: TicketType, players: number) {
  return Math.max(selectedTicketService(ticketType).duration, ticketMinimumDurationBlocks(players) * ticketPriceBlockMinutes)
}

function ticketArenaCountForPlayers() {
  return ticketArenaCount
}

function ticketUnitFormulaText(text: Record<string, string>, unitPrice: number, players: number) {
  const playerCount = Math.max(1, players >= ticketArenaCapacityPerSlot ? ticketArenaCapacityPerSlot : players)
  const playerWord = playerCount === 1 ? text.ticketFormulaPlayer : text.ticketFormulaPlayers

  return text.ticketUnitFormula
    .replace('{price}', formatTicketFormulaPrice(unitPrice))
    .replace('{players}', String(playerCount))
    .replace('{playerWord}', playerWord)
}

function clampTicketLoyaltyRedemption(points: number, balance: number, redeemValue: number, subtotal: number) {
  if (!Number.isFinite(points) || !Number.isFinite(balance) || !Number.isFinite(redeemValue) || !Number.isFinite(subtotal)) return 0
  if (redeemValue <= 0 || subtotal <= 0) return 0
  const maxByBalance = Math.max(0, Math.floor(balance))
  const maxByPrice = Math.floor(Math.max(0, subtotal) / redeemValue)
  return Math.max(0, Math.min(Math.floor(points), maxByBalance, maxByPrice))
}

function isBirthdayToday(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return false

  const today = new Date()
  return today.getMonth() + 1 === month && today.getDate() === day
}

function resolveCountryCode(input: string) {
  const normalized = input.trim().toLowerCase()
  const explicitCode = normalized.match(/\+\d{1,4}/)?.[0]
  if (explicitCode) return explicitCode

  const country = countries.find((item) => item.name.toLowerCase().includes(normalized))
  return country?.code || '+84'
}

function splitPhoneNumber(phone: string) {
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

function displayName(profile: Profile | null) {
  if (!profile) return 'Player'
  if (profile.anonymous_mode) return anonymousProfileName(profile)
  return compactDisplayName(profile.nickname || profile.full_name || profile.phone)
}

function limitDisplayName(value: string) {
  return Array.from(value).slice(0, MAX_DISPLAY_NAME_LENGTH).join('')
}

function compactDisplayName(value: string | null | undefined, fallback = 'Player') {
  const cleaned = (value || fallback).trim() || fallback
  return limitDisplayName(cleaned)
}

function playerCardLabel(value: string | null | undefined, fallback = 'Player') {
  return `Open ${compactDisplayName(value, fallback)} player card`
}

function anonymousCallsignForId(profileId: string | null | undefined) {
  const value = profileId || 'private-player'
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  const prefix = ANONYMOUS_CALLSIGN_PREFIXES[hash % ANONYMOUS_CALLSIGN_PREFIXES.length]
  const number = String((hash % 900) + 100).padStart(3, '0')
  return `${prefix}-${number}`
}

function anonymousProfileName(profile: Pick<Profile, 'id' | 'nickname' | 'anonymous_callsign'>) {
  return compactDisplayName(profile.nickname || profile.anonymous_callsign || anonymousCallsignForId(profile.id), 'CIPHER-291')
}

function finiteNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function leaderboardPlayerFromRpcRow(row: LeaderboardRpcRow, fallbackName: string): LeaderboardPlayer {
  const bestByGameRows = Array.isArray(row.best_by_game) ? row.best_by_game : []
  const baseTotalScore = finiteNumber(row.base_total_score)
  const scoreAdjustment = finiteNumber(row.score_adjustment)
  const bestEscapeDurationSeconds = bestByGameRows.reduce<number | null>((best, item) => {
    if (!item || typeof item !== 'object') return best
    const duration = finiteNumber('escapeDurationSeconds' in item ? item.escapeDurationSeconds : null, Number.NaN)
    if (!Number.isFinite(duration) || duration <= 0) return best
    return best === null || duration < best ? duration : best
  }, null)

  return {
    profileId: row.profile_id,
    displayName: compactDisplayName(row.display_name, fallbackName),
    avatarUrl: row.avatar_url || null,
    avatarEmoji: row.avatar_emoji || null,
    avatarInitials: row.avatar_initials || null,
    avatarColor: row.avatar_color || null,
    avatarTextColor: row.avatar_text_color || null,
    profileMotto: row.profile_motto || null,
    sessionsJoined: finiteNumber(row.sessions_joined),
    gamesJoined: finiteNumber(row.games_joined),
    wins: finiteNumber(row.wins),
    bestPerformerCount: finiteNumber(row.best_performer_count),
    baseTotalScore,
    totalScore: finiteNumber(row.total_score, baseTotalScore + scoreAdjustment),
    scoreAdjustment,
    totalAccuracy: finiteNumber(row.total_accuracy),
    accuracyCount: finiteNumber(row.accuracy_count),
    totalProjectiles: finiteNumber(row.total_projectiles),
    averageAccuracy: row.average_accuracy === null || row.average_accuracy === undefined ? null : finiteNumber(row.average_accuracy),
    reliabilityScore: finiteNumber(row.reliability_score),
    bestEscapeDurationSeconds,
    leaderboardRank: row.leaderboard_rank === null || row.leaderboard_rank === undefined ? undefined : finiteNumber(row.leaderboard_rank),
    leaderboardDistinctRank: row.leaderboard_distinct_rank === null || row.leaderboard_distinct_rank === undefined
      ? null
      : finiteNumber(row.leaderboard_distinct_rank),
    leaderboardHigherMetricValue: row.leaderboard_higher_metric_value === null || row.leaderboard_higher_metric_value === undefined
      ? null
      : finiteNumber(row.leaderboard_higher_metric_value),
    leaderboardMetricValue: row.leaderboard_metric_value === null || row.leaderboard_metric_value === undefined
      ? null
      : finiteNumber(row.leaderboard_metric_value),
    leaderboardTotalCount: row.leaderboard_total_count === null || row.leaderboard_total_count === undefined
      ? undefined
      : finiteNumber(row.leaderboard_total_count),
    bestByGame: bestByGameRows.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const gameValue = 'game' in item ? String(item.game || '') : ''
      const score = finiteNumber('score' in item ? item.score : null, Number.NaN)
      const escapeDurationSeconds = finiteNumber('escapeDurationSeconds' in item ? item.escapeDurationSeconds : null, Number.NaN)
      if (!gameValue || !Number.isFinite(score)) return []

      const game = games.find((candidate) => candidate.id === gameValue)
      return [{ game: game?.title || gameValue, score, escapeDurationSeconds: Number.isFinite(escapeDurationSeconds) ? escapeDurationSeconds : null }]
    }),
  }
}

function leaderboardPlayerFromStaffProfile(profile: StaffProfile, fallbackName: string): LeaderboardPlayer {
  const isAnonymous = Boolean(profile.anonymous_mode)
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
    totalProjectiles: 0,
    averageAccuracy: null,
    reliabilityScore: 0,
    bestEscapeDurationSeconds: null,
    bestByGame: [],
  }
}

function compactInitials(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return ''
  const words = cleaned.split(/\s+/).filter(Boolean)
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0] || '').join('')
    : Array.from(cleaned).slice(0, 2).join('')
  return letters.toUpperCase()
}

function validAvatarInitials(value: string | null | undefined) {
  const initials = compactInitials(value || '')
  return initials && initials !== '?' ? initials : ''
}

function limitMotto(value: string) {
  return Array.from(value).slice(0, 20).join('')
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim())
}

function cleanHexColor(value: string, fallback: string) {
  const trimmed = value.trim()
  return isHexColor(trimmed) ? trimmed.toLowerCase() : fallback
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function dateValueToLocalDate(dateValue: string) {
  return new Date(`${dateValue}T12:00:00`)
}

function addDaysToDateValue(dateValue: string, days: number) {
  return localDateString(addDays(dateValueToLocalDate(dateValue), days))
}

function daysBetweenDateValues(startDate: string, endDate: string) {
  const start = dateValueToLocalDate(startDate).getTime()
  const end = dateValueToLocalDate(endDate).getTime()
  return Math.round((end - start) / (24 * 60 * 60 * 1000))
}

function maxDateValue(...dateValues: Array<string | undefined | null>) {
  const sortedDates = dateValues.filter((dateValue): dateValue is string => Boolean(dateValue)).sort()
  return sortedDates.length ? sortedDates[sortedDates.length - 1] : ''
}

function upcomingBatchEndForDate(dateValue: string) {
  const today = localDateString()
  const daysFromToday = Math.max(0, daysBetweenDateValues(today, dateValue))
  const batchIndex = Math.floor(daysFromToday / SESSION_LOAD_BATCH_DAYS)
  return addDaysToDateValue(today, (batchIndex + 1) * SESSION_LOAD_BATCH_DAYS - 1)
}

function startOfWeekDateValue(dateValue: string) {
  const date = dateValueToLocalDate(dateValue)
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return localDateString(addDays(date, mondayOffset))
}

function weekDaysFromStart(startDate: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysToDateValue(startDate, index))
}

const dateLocales: Record<LanguageCode, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  ko: 'ko-KR',
  ja: 'ja-JP',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
}

const monthAbbreviations = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDayButton(dateValue: string, language: LanguageCode) {
  const date = new Date(`${dateValue}T12:00:00`)
  const locale = dateLocales[language]
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
    day: formatShortDate(dateValue, language),
  }
}

function formatShortDate(dateValue: string, language: LanguageCode) {
  if (!dateValue) return ''
  void language
  const date = new Date(`${dateValue}T12:00:00`)
  const day = String(date.getDate()).padStart(2, '0')
  const month = monthAbbreviations[date.getMonth()]
  return `${day} ${month}`
}

function formatCalendarWeekRange(startDate: string, language: LanguageCode) {
  const endDate = addDaysToDateValue(startDate, 6)
  return `${formatShortDate(startDate, language)} - ${formatShortDate(endDate, language)}`
}

function sessionStartDate(session: Pick<Session, 'date' | 'start_time'>) {
  return new Date(`${session.date}T${session.start_time}`)
}

function sessionEndDate(session: Pick<Session, 'date' | 'start_time' | 'duration_minutes'>) {
  return new Date(sessionStartDate(session).getTime() + session.duration_minutes * 60 * 1000)
}

function isPastSession(session: Session) {
  return session.status === 'completed' || sessionEndDate(session).getTime() < Date.now()
}

function isUpcomingSession(session: Session) {
  return !isPastSession(session)
}

function sortSessionsByStart(sessionsToSort: Session[]) {
  return [...sessionsToSort].sort((left, right) => {
    const leftStart = `${left.date}T${left.start_time}`
    const rightStart = `${right.date}T${right.start_time}`
    return leftStart.localeCompare(rightStart) || left.name.localeCompare(right.name)
  })
}

function seatsLeft(session: Pick<Session, 'max_players' | 'session_participants'>) {
  return Math.max(0, session.max_players - (session.session_participants ?? []).length)
}

function mostVotedGameId(session: Pick<Session, 'game_options' | 'game_votes'>) {
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

function sessionCoverGame(session: Pick<Session, 'game_options' | 'game_votes' | 'confirmed_game_id'>) {
  const confirmedGame = games.find((game) => game.id === session.confirmed_game_id)
  if (confirmedGame) return confirmedGame

  const votedGameId = mostVotedGameId(session)
  const votedGame = games.find((game) => game.id === votedGameId)
  if (votedGame) return votedGame

  return games.find((game) => game.id === session.game_options?.[0]) || games[0]
}

function isInteractiveClickTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button, input, select, textarea, a, label, summary, details'))
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatNotesHtml(value: string) {
  if (/<\/?(strong|b|em|i|u|s|strike|br|div|p)\b/i.test(value)) {
    return value
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(\/?)(strong|b|em|i|u|s|strike|br|div|p)(?:\s[^>]*)?>/gi, '<$1$2>')
      .replace(/<(?!\/?(strong|b|em|i|u|s|strike|br|div|p)\b)[^>]*>/gi, '')
  }

  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*(?!\*)(.+?)\*/g, '$1<em>$2</em>')
}

function rankEmoji(placement?: number | null) {
  if (placement === 1) return '🥇'
  if (placement === 2) return '🥈'
  if (placement === 3) return '🥉'
  return ''
}

function participantScore(participant: Participant) {
  if (participant.score === null || participant.score === undefined) return null

  const score = Number(participant.score)
  return Number.isFinite(score) ? score : null
}

function sessionBestPerformer(session: Session) {
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

function isBestSessionPerformer(session: Session, participant: Participant) {
  return sessionBestPerformer(session)?.participant.id === participant.id
}

function percentValue(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

function formatWholePercent(value: number | null | undefined) {
  return Number.isFinite(value) ? `${Math.round(Number(value))}%` : '-%'
}

function formatSpeedrunDuration(value: number | null | undefined) {
  if (!Number.isFinite(value) || Number(value) <= 0) return '-'

  const totalSeconds = Math.round(Number(value))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function parseSpeedrunDuration(value: string | number | null | undefined) {
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

async function loadCanvasImage(src: string) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('image failed'))
    image.src = src
  })
  return image
}

function drawCanvasRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

function hasShareablePlayerStats(stats: LeaderboardPlayer | null | undefined) {
  return Boolean(stats && (
    stats.gamesJoined > 0
    || stats.sessionsJoined > 0
    || stats.wins > 0
    || stats.bestPerformerCount > 0
    || stats.totalScore > 0
    || stats.totalProjectiles > 0
    || Number(stats.averageAccuracy) > 0
  ))
}

function safeDownloadSlug(value: string, fallback: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || fallback
}

function bestOfLabel(value?: number | null) {
  return `BO${value || 1}`
}

function authDebug(label: string, payload?: unknown) {
  if (typeof console === 'undefined') return
  console.groupCollapsed(`[VRena auth] ${label}`)
  if (payload !== undefined) console.log(payload)
  console.groupEnd()
}

function winsNeeded(bestOf?: number | null) {
  return Math.floor((bestOf || 1) / 2) + 1
}

function isPaidParticipant(participant: Participant) {
  return Boolean(participant.payment_status && participant.payment_status !== null)
}

function eligibleTournamentParticipants(session: Session) {
  return (session.session_participants ?? [])
    .filter((participant) => participant.checked_in)
    .filter((participant) => !session.require_payment || isPaidParticipant(participant))
}

function shuffleItems<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item)
}

function matchWinnerFromSeries(match: Pick<TournamentMatch, 'participant_a_id' | 'participant_b_id' | 'wins_a' | 'wins_b' | 'score_a' | 'score_b' | 'best_of'>) {
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

function matchLoser(match: Pick<TournamentMatch, 'participant_a_id' | 'participant_b_id'>, winnerId: string | null) {
  if (!winnerId) return null
  if (winnerId === match.participant_a_id) return match.participant_b_id
  if (winnerId === match.participant_b_id) return match.participant_a_id
  return null
}

function hasDuplicateMatchPlayers(match: Pick<TournamentMatch, 'participant_a_id' | 'participant_b_id'>) {
  return Boolean(match.participant_a_id && match.participant_b_id && match.participant_a_id === match.participant_b_id)
}

function knockoutStageForCount(count: number): MatchStage {
  if (count <= 2) return 'final'
  if (count <= 4) return 'semifinal'
  if (count <= 8) return 'quarterfinal'
  if (count <= 16) return 'round_of_16'
  return 'custom'
}

function qualificationCount(rule?: QualificationRule | null, custom = 2) {
  if (rule === 'top_1') return 1
  if (rule === 'top_2') return 2
  if (rule === 'top_4') return 4
  return Math.max(1, custom || 1)
}

function calculatePoolStandings(session: Session, pool: TournamentPool, entries: TournamentPoolEntry[], matches: TournamentMatch[]): PoolStanding[] {
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

function queueLabel(status: MatchStatus, index: number) {
  if (status === 'live') return 'LIVE NOW'
  if (status === 'next') return 'NEXT MATCH'
  if (index < 4) return 'ON DECK'
  if (status === 'completed') return 'COMPLETED'
  return 'WAITING'
}

function buildKnockoutRows(sessionId: string, participantIds: string[], stage: MatchStage, round: number, bestOf: 1 | 3 | 5 | number): TournamentMatchInsert[] {
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

function appRedirectUrl() {
  if (typeof window === 'undefined') return DEFAULT_APP_URL

  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return DEFAULT_APP_URL
  }

  return window.location.origin
}

function passwordRecoveryUrlParams() {
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

function cleanPasswordRecoveryUrl() {
  if (typeof window === 'undefined') return
  window.history.replaceState(null, '', window.location.pathname)
}

function icsDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function icsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function getHCaptcha() {
  if (typeof window === 'undefined') return undefined

  return (window as unknown as { hcaptcha?: HCaptchaApi }).hcaptcha
}

function scheduleDeferredWork(callback: () => void) {
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

function schedulePostEffectStateUpdate(callback: () => void) {
  if (typeof window === 'undefined') return () => {}

  const handle = window.setTimeout(callback, 0)
  return () => window.clearTimeout(handle)
}

type BookingWidgetView = 'sessions' | 'tickets' | 'create' | 'leaderboard' | 'clubs' | 'profile' | 'staff'

type BookingWidgetProps = {
  embedded?: boolean
  externalLanguage?: LanguageCode
  initialSelectedPlayerId?: string
  initialSelectedPlayerSessionId?: string
  initialView?: BookingWidgetView
  onActiveViewChange?: (view: BookingWidgetView) => void
  onProfileChange?: (profile: Profile | null) => void
}

type LeaderboardQuery = {
  clubId: string
  clubPin: string
  criterion: LeaderboardCriterion
  search: string
}

export default function WidgetPage({
  embedded = false,
  externalLanguage,
  initialSelectedPlayerId = '',
  initialSelectedPlayerSessionId = '',
  initialView = 'leaderboard',
  onActiveViewChange,
  onProfileChange,
}: BookingWidgetProps = {}) {
  const [activeView, setActiveView] = useState<BookingWidgetView>(initialView)
  const [sessions, setSessions] = useState<Session[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<LeaderboardPlayer[]>([])
  const [currentUserRankPlayer, setCurrentUserRankPlayer] = useState<LeaderboardPlayer | null>(null)
  const [hasMoreLeaderboardPlayers, setHasMoreLeaderboardPlayers] = useState(false)
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false)
  const [isLoadingMoreLeaderboardPlayers, setIsLoadingMoreLeaderboardPlayers] = useState(false)
  const [leaderboardStatus, setLeaderboardStatus] = useState('')
  const [friendConnections, setFriendConnections] = useState<FriendConnection[]>([])
  const [sessionInvites, setSessionInvites] = useState<SessionInvite[]>([])
  const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([])
  const [sessionMessagePages, setSessionMessagePages] = useState<Record<string, SessionMessagePageState>>({})
  const [loadedSessionDetailIds, setLoadedSessionDetailIds] = useState<Record<string, boolean>>({})
  const [loadingSessionDetailIds, setLoadingSessionDetailIds] = useState<Record<string, boolean>>({})
  const [clubMessages, setClubMessages] = useState<ClubMessage[]>([])
  const [isLoadingClubMessages, setIsLoadingClubMessages] = useState(false)
  const [clubMessageStatus, setClubMessageStatus] = useState('')
  const [messageTranslations, setMessageTranslations] = useState<Record<string, MessageTranslationState>>({})
  const [networkTablesReady, setNetworkTablesReady] = useState(false)
  const [tournamentData, setTournamentData] = useState<TournamentData>({
    editors: [],
    pools: [],
    poolEntries: [],
    matches: [],
    auditLogs: [],
  })
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedSessionDate, setSelectedSessionDate] = useState('')
  const [clubSearch, setClubSearch] = useState('')
  const [isClubSearchOpen, setIsClubSearchOpen] = useState(false)
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({})

  const [authMode, setAuthMode] = useState<'login' | 'create' | 'reset'>('login')
  const [authStep, setAuthStep] = useState<'email' | 'credentials'>('email')
  const [profileCountryCode, setProfileCountryCode] = useState('+84')
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [rememberLogin, setRememberLogin] = useState(true)
  const [captchaToken, setCaptchaToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileMotto, setProfileMotto] = useState('')
  const [profileNickname, setProfileNickname] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileBirthday, setProfileBirthday] = useState('')
  const [profileGender, setProfileGender] = useState<ProfileGender | ''>('')
  const [personalDataConsent, setPersonalDataConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(true)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarMode, setAvatarMode] = useState<'photo' | 'emoji' | 'initials'>('photo')
  const [avatarEmoji, setAvatarEmoji] = useState('😎')
  const [avatarInitials, setAvatarInitials] = useState('')
  const [avatarColor, setAvatarColor] = useState(avatarColors[0])
  const [avatarColorDraft, setAvatarColorDraft] = useState(avatarColors[0])
  const [avatarTextColor, setAvatarTextColor] = useState(avatarTextColors[0])
  const [avatarTextColorDraft, setAvatarTextColorDraft] = useState(avatarTextColors[0])
  const [profileStatus, setProfileStatus] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [isPasskeyCaptchaReady, setIsPasskeyCaptchaReady] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [mfaFactors, setMfaFactors] = useState<TotpFactor[]>([])
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollment | null>(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaChallengeCode, setMfaChallengeCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [isMfaLoading, setIsMfaLoading] = useState(false)
  const [mfaStatus, setMfaStatus] = useState('')
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)

  const [sessionVisibility, setSessionVisibility] = useState<'public' | 'private'>('public')
  const [sessionType, setSessionType] = useState<'game' | 'tournament'>('game')
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>('pool_to_final')
  const [tournamentBestOf, setTournamentBestOf] = useState<1 | 3 | 5>(1)
  const [tournamentRoundsPerMatch, setTournamentRoundsPerMatch] = useState(1)
  const [tournamentRequirePayment, setTournamentRequirePayment] = useState(false)
  const [tournamentQualificationRule, setTournamentQualificationRule] = useState<QualificationRule>('top_1')
  const [tournamentCustomQualifiers, setTournamentCustomQualifiers] = useState(2)
  const [tournamentThirdPlace, setTournamentThirdPlace] = useState(true)
  const [tournamentFirstPrize, setTournamentFirstPrize] = useState('')
  const [tournamentSecondPrize, setTournamentSecondPrize] = useState('')
  const [tournamentThirdPrize, setTournamentThirdPrize] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState(localDateString())
  const [sessionTime, setSessionTime] = useState('')
  const [sessionDuration, setSessionDuration] = useState(20)
  const [sessionMaxPlayers, setSessionMaxPlayers] = useState(4)
  const [sessionArenaCount, setSessionArenaCount] = useState(1)
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionClubId, setSessionClubId] = useState('')
  const [selectedGames, setSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [createStatus, setCreateStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [pushReminderStatus, setPushReminderStatus] = useState('')
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)
  const [isEnablingPush, setIsEnablingPush] = useState(false)
  const [createSessionMode, setCreateSessionMode] = useState<'calendar' | 'form'>('form')
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeekDateValue(localDateString()))
  const [ticketType, setTicketType] = useState<TicketType>('individual')
  const [ticketDate, setTicketDate] = useState(localDateString())
  const [ticketTime, setTicketTime] = useState('')
  const [ticketPlayers, setTicketPlayers] = useState(1)
  const [ticketDuration, setTicketDuration] = useState(20)
  const [ticketStatus, setTicketStatus] = useState('')
  const [isBookingTickets, setIsBookingTickets] = useState(false)
  const [ticketConfirmation, setTicketConfirmation] = useState<TicketBookingConfirmation | null>(null)
  const [ticketUseLoyaltyPoints, setTicketUseLoyaltyPoints] = useState(false)
  const [ticketLoyaltyPointsToRedeem, setTicketLoyaltyPointsToRedeem] = useState('')
  const [ticketLoyaltyRedemption, setTicketLoyaltyRedemption] = useState<TicketLoyaltyRedemption | null>(null)
  const [ticketLoyaltyEarnQuote, setTicketLoyaltyEarnQuote] = useState<TicketLoyaltyEarnQuote | null>(null)
  const [isLoadingTicketLoyalty, setIsLoadingTicketLoyalty] = useState(false)
  const [ticketDiscountCode, setTicketDiscountCode] = useState('')
  const [ticketDiscountQuote, setTicketDiscountQuote] = useState<TicketDiscountQuote | null>(null)
  const [ticketAutomaticDiscountQuote, setTicketAutomaticDiscountQuote] = useState<TicketDiscountQuote | null>(null)
  const [ticketDiscountStatus, setTicketDiscountStatus] = useState('')
  const [isCheckingTicketDiscount, setIsCheckingTicketDiscount] = useState(false)
  const [gameGuideOpen, setGameGuideOpen] = useState(false)
  const [gameGuideGameId, setGameGuideGameId] = useState<GameId | null>(null)
  const [staffGameGuides, setStaffGameGuides] = useState<Partial<Record<GameId, StaffGameGuide>>>({})
  const staffGameGuidesLoadedRef = useRef(false)
  const staffGameGuidesLoadingRef = useRef(false)
  const [challengeTargetId, setChallengeTargetId] = useState('')
  const [challengeGameId, setChallengeGameId] = useState<GameId>('laser-tag')
  const [challengeDate, setChallengeDate] = useState(localDateString())
  const [challengeTime, setChallengeTime] = useState('')
  const [challengeDuration, setChallengeDuration] = useState(20)
  const [challengeStatus, setChallengeStatus] = useState('')
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false)
  const [busySessionId, setBusySessionId] = useState('')
  const [busyVoteKey, setBusyVoteKey] = useState('')
  const [copiedInviteId, setCopiedInviteId] = useState('')
  const [sharedKey, setSharedKey] = useState('')
  const [editingSessionId, setEditingSessionId] = useState('')
  const [editSessionName, setEditSessionName] = useState('')
  const [editSessionDate, setEditSessionDate] = useState(localDateString())
  const [editSessionTime, setEditSessionTime] = useState('')
  const [editSessionDuration, setEditSessionDuration] = useState(20)
  const [editSessionMaxPlayers, setEditSessionMaxPlayers] = useState(4)
  const [editSessionArenaCount, setEditSessionArenaCount] = useState(1)
  const [editSessionVisibility, setEditSessionVisibility] = useState<'public' | 'private'>('public')
  const [editSessionNotes, setEditSessionNotes] = useState('')
  const [editSelectedGames, setEditSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [editBookingType, setEditBookingType] = useState<BookingType>('community')
  const [editTicketCustomerId, setEditTicketCustomerId] = useState('')
  const [editTicketType, setEditTicketType] = useState<TicketType>('individual')
  const [editTicketTotalPrice, setEditTicketTotalPrice] = useState('')
  const [editTicketStatus, setEditTicketStatus] = useState<TicketStatus>('confirmed')
  const [editTournamentFormat, setEditTournamentFormat] = useState<TournamentFormat>('pool_to_final')
  const [editTournamentBestOf, setEditTournamentBestOf] = useState<1 | 3 | 5>(1)
  const [editTournamentRoundsPerMatch, setEditTournamentRoundsPerMatch] = useState(1)
  const [editTournamentRequirePayment, setEditTournamentRequirePayment] = useState(false)
  const [editTournamentQualificationRule, setEditTournamentQualificationRule] = useState<QualificationRule>('top_1')
  const [editTournamentCustomQualifiers, setEditTournamentCustomQualifiers] = useState(2)
  const [editTournamentThirdPlace, setEditTournamentThirdPlace] = useState(true)
  const [editTournamentFirstPrize, setEditTournamentFirstPrize] = useState('')
  const [editTournamentSecondPrize, setEditTournamentSecondPrize] = useState('')
  const [editTournamentThirdPrize, setEditTournamentThirdPrize] = useState('')
  const [isUpdatingSession, setIsUpdatingSession] = useState(false)
  const [clubVisibility, setClubVisibility] = useState<'public' | 'private'>('public')
  const [clubName, setClubName] = useState('')
  const [clubDescription, setClubDescription] = useState('')
  const [clubStatus, setClubStatus] = useState('')
  const [isCreatingClub, setIsCreatingClub] = useState(false)
  const [busyClubId, setBusyClubId] = useState('')
  const [selectedClubId, setSelectedClubId] = useState('')
  const [selectedClubDate, setSelectedClubDate] = useState('')
  const [selectedClubTab, setSelectedClubTab] = useState<ClubTab>('hall')
  const [selectedClubSessionScope, setSelectedClubSessionScope] = useState<ClubSessionScope>('upcoming')
  const [clubUnlockTargetId, setClubUnlockTargetId] = useState('')
  const [clubUnlockCode, setClubUnlockCode] = useState('')
  const [clubUnlockStatus, setClubUnlockStatus] = useState('')
  const [unlockedClubIds, setUnlockedClubIds] = useState<Record<string, boolean>>({})
  const [clubEditName, setClubEditName] = useState('')
  const [clubEditMotto, setClubEditMotto] = useState('')
  const [clubEditDescription, setClubEditDescription] = useState('')
  const [clubEditVisibility, setClubEditVisibility] = useState<'public' | 'private'>('public')
  const [clubEditThemeColor, setClubEditThemeColor] = useState(clubThemeColors[0])
  const [clubEditThemeColorDraft, setClubEditThemeColorDraft] = useState(clubThemeColors[0])
  const [clubEditDefaultLanguage, setClubEditDefaultLanguage] = useState<LanguageCode>('en')
  const [clubEditRankingCriterion, setClubEditRankingCriterion] = useState<LeaderboardCriterion>('totalScore')
  const [clubBannerFile, setClubBannerFile] = useState<File | null>(null)
  const [clubBannerPreview, setClubBannerPreview] = useState('')
  const [isSavingClub, setIsSavingClub] = useState(false)
  const [tournamentPoolSize, setTournamentPoolSize] = useState(4)
  const [tournamentEditorEmail, setTournamentEditorEmail] = useState('')
  const [tournamentEditorResults, setTournamentEditorResults] = useState<Profile[]>([])
  const [busyTournamentId, setBusyTournamentId] = useState('')
  const [drawerTouchStart, setDrawerTouchStart] = useState<number | null>(null)
  const [checkInTarget, setCheckInTarget] = useState<{ sessionId: string; participantId: string } | null>(null)
  const [checkInPaymentSplits, setCheckInPaymentSplits] = useState<ParticipantPaymentSplitDraft[]>(() => [newParticipantPaymentSplit('cash')])
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialSelectedPlayerId)
  const [selectedPlayerSessionId, setSelectedPlayerSessionId] = useState(initialSelectedPlayerSessionId)
  const [selectedPlayerStatsOverride, setSelectedPlayerStatsOverride] = useState<LeaderboardPlayer | null>(null)
  const [selectedPlayerScoreEdit, setSelectedPlayerScoreEdit] = useState<'session' | 'total' | 'accuracy' | 'projectiles' | 'escapeDuration' | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [highlightedSessionId, setHighlightedSessionId] = useState('')
  const [profileUpcomingExpanded, setProfileUpcomingExpanded] = useState(false)
  const [profilePastExpanded, setProfilePastExpanded] = useState(false)
  const [profileInvitesExpanded, setProfileInvitesExpanded] = useState(false)
  const [invitePopupInviteId, setInvitePopupInviteId] = useState('')
  const [inviteModalSessionId, setInviteModalSessionId] = useState('')
  const [inviteSearch, setInviteSearch] = useState('')
  const [birthdayPopupOpen, setBirthdayPopupOpen] = useState(false)
  const [tariffPaymentOpen, setTariffPaymentOpen] = useState(false)
  const [anonymousConfirmOpen, setAnonymousConfirmOpen] = useState(false)
  const [isSavingAnonymousMode, setIsSavingAnonymousMode] = useState(false)
  const [sessionTimeScope, setSessionTimeScope] = useState<'upcoming' | 'past'>('upcoming')
  const [hasMoreUpcomingSessions, setHasMoreUpcomingSessions] = useState(true)
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false)
  const [isLoadingPastSessions, setIsLoadingPastSessions] = useState(false)
  const [confirmedGameDrafts, setConfirmedGameDrafts] = useState<Record<string, string>>({})
  const [announcementDrafts, setAnnouncementDrafts] = useState<Record<string, string>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [clubPublicMessageDrafts, setClubPublicMessageDrafts] = useState<Record<string, string>>({})
  const [clubAdminMessageDrafts, setClubAdminMessageDrafts] = useState<Record<string, string>>({})
  const [profileScoreAdjustments, setProfileScoreAdjustments] = useState<Record<string, number>>({})
  const [busyInviteKey, setBusyInviteKey] = useState('')
  const [busyFriendId, setBusyFriendId] = useState('')
  const [busyMessageKey, setBusyMessageKey] = useState('')
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [championLoginOpen, setChampionLoginOpen] = useState(false)
  const [language, setLanguage] = useState<LanguageCode>(() => externalLanguage ?? getInitialLanguage())
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const dayStripRef = useRef<HTMLDivElement | null>(null)
  const clubSearchShellRef = useRef<HTMLDivElement | null>(null)
  const captchaContainerRef = useRef<HTMLDivElement | null>(null)
  const captchaWidgetId = useRef<string | null>(null)
  const passkeyCaptchaContainerRef = useRef<HTMLDivElement | null>(null)
  const passkeyCaptchaWidgetId = useRef<string | null>(null)
  const passkeyCaptchaResolveRef = useRef<((token: string) => void) | null>(null)
  const passkeyCaptchaRejectRef = useRef<((error: Error) => void) | null>(null)
  const passkeyButtonRef = useRef<HTMLButtonElement | null>(null)
  const notifiedReminderKeys = useRef<Set<string>>(new Set())
  const clubsLoadedRef = useRef(false)
  const clubsLoadingRef = useRef(false)
  const loadedClubMessagesRef = useRef<Set<string>>(new Set())
  const tournamentDataLoadedRef = useRef(false)
  const tournamentDataLoadingRef = useRef(false)
  const networkDataLoadedRef = useRef(false)
  const networkDataLoadingRef = useRef(false)
  const allProfilesLoadedRef = useRef(false)
  const allProfilesLoadingRef = useRef(false)
  const selectedPlayerIdRef = useRef(initialSelectedPlayerId)
  const selectedPlayerStatsFetchedRef = useRef<Set<string>>(new Set())
  const selectedPlayerStatsLoadingRef = useRef<Set<string>>(new Set())
  const sessionDetailsLoadedRef = useRef<Set<string>>(new Set())
  const sessionDetailsLoadingRef = useRef<Set<string>>(new Set())
  const sessionMessagesLoadedRef = useRef<Set<string>>(new Set())
  const sessionMessagesLoadingRef = useRef<Set<string>>(new Set())
  const expandedSessionIdsRef = useRef<Set<string>>(new Set())
  const realtimeRefreshQueueRef = useRef<Set<RealtimeRefreshTask>>(new Set())
  const realtimeRefreshTimerRef = useRef<number | null>(null)
  const queueRealtimeRefreshRef = useRef((tasks: RealtimeRefreshTask[]) => {
    void tasks
  })
  const leaderboardLoadedRef = useRef(false)
  const leaderboardLoadingRef = useRef(false)
  const leaderboardLoadedCountRef = useRef(0)
  const leaderboardQueryRef = useRef<LeaderboardQuery>(initialLeaderboardQuery())
  const leaderboardSearchReloadTimeoutRef = useRef<number | null>(null)
  const highlightedSessionTimeoutRef = useRef<number | null>(null)
  const sessionsLoadedRef = useRef(false)
  const upcomingSessionsThroughRef = useRef('')
  const loadingSessionRangeRef = useRef(false)
  const pastSessionsLoadedRef = useRef(false)
  const pastSessionsLoadingRef = useRef(false)
  const ensureClubsLoadedRef = useRef(ensureClubsLoaded)
  const ensureLeaderboardLoadedRef = useRef(ensureLeaderboardLoaded)
  const ensureNetworkDataLoadedRef = useRef(ensureNetworkDataLoaded)
  const ensurePastSessionsLoadedRef = useRef(ensurePastSessionsLoaded)
  const ensureSessionsLoadedRef = useRef(ensureSessionsLoaded)
  const ensureTournamentDataLoadedRef = useRef(ensureTournamentDataLoaded)
  const ensureUpcomingSessionsThroughDateRef = useRef(ensureUpcomingSessionsThroughDate)
  const loadClubMessagesRef = useRef(loadClubMessages)
  const loadClubsRef = useRef(loadClubs)
  const loadExpandedSessionDetailsRef = useRef(loadExpandedSessionDetails)
  const loadExpandedSessionMessagesRef = useRef(loadExpandedSessionMessages)
  const loadLeaderboardPlayersRef = useRef(loadLeaderboardPlayers)
  const loadMoreUpcomingSessionsRef = useRef(loadMoreUpcomingSessions)
  const loadNetworkDataRef = useRef(loadNetworkData)
  const loadProfileRef = useRef(loadProfile)
  const loadSessionDetailRef = useRef(loadSessionDetail)
  const loadSessionMessagesRef = useRef(loadSessionMessages)
  const loadTournamentDataRef = useRef(loadTournamentData)
  const notifyInviteRef = useRef(notifyInvite)
  const notifySessionRef = useRef(notifySession)
  const preparePasswordRecoveryFromUrlRef = useRef(preparePasswordRecoveryFromUrl)
  const refreshLeaderboardIfLoadedRef = useRef(refreshLeaderboardIfLoaded)
  const refreshSessionsIfLoadedRef = useRef(refreshSessionsIfLoaded)
  const syncProfileEverywhereRef = useRef(syncProfileEverywhere)
  const text = uiText[language]
  const resetPasswordReadyTextRef = useRef(text.resetPasswordReady)
  const looseText = text as Record<string, string>
  const leaveClubText = looseText.leaveClub || 'Leave Club'
  const leaveClubConfirmText = looseText.leaveClubConfirm || 'Leave this club?'
  const leftClubText = looseText.leftClub || text.memberRemoved
  const bestPerformerText = looseText.bestPerformer || 'Best Performer'
  const bestPerformerCountText = looseText.bestPerformerCount || 'Best Performer count'
  const sessionScoreText = looseText.sessionScore || 'Session score'
  const averageAccuracyText = looseText.averageAccuracy || 'Average'
  const totalShotsText = looseText.totalShots || 'Total Shots'
  const escapeBestTimeText = looseText.escapeBestTime || 'Best escape time'
  const escapeSessionTimeText = looseText.escapeSessionTime || 'Escape time'
  const pendingInvitationsText = looseText.pendingInvitations || 'Pending invitations'
  const pendingInvitationsHintText = looseText.pendingInvitationsHint || 'Invites waiting for your answer.'
  const invitationReceivedText = looseText.invitationReceived || 'Session invitation'
  const invitationPopupTitleText = looseText.invitationPopupTitle || 'New session invitation'
  const invitationPopupBodyText = looseText.invitationPopupBody || 'You have been invited to join this session.'
  const openInvitationText = looseText.openInvitation || 'Open invite'
  const addToCalendarText = looseText.addToCalendar || 'Add calendar'
  const activeTotpFactor = useMemo(() => mfaFactors.find((factor) => factor.status === 'verified') || mfaFactors[0] || null, [mfaFactors])
  const mfaQrCodeSrc = useMemo(() => {
    if (!mfaEnrollment?.qrCode) return ''
    return mfaEnrollment.qrCode.startsWith('data:')
      ? mfaEnrollment.qrCode
      : `data:image/svg+xml;utf8,${encodeURIComponent(mfaEnrollment.qrCode)}`
  }, [mfaEnrollment])
  const clubRankingCriteria: Array<{ value: LeaderboardCriterion; label: string }> = [
    { value: 'totalScore', label: text.totalScoreCriterion },
    { value: 'wins', label: text.winsCriterion },
    { value: 'winRate', label: text.winRateCriterion },
    { value: 'accuracy', label: text.accuracyCriterion },
    { value: 'reliability', label: text.reliabilityCriterion },
    { value: 'projectiles', label: text.projectilesCriterion },
    { value: 'gamesPlayed', label: text.gamesPlayedCriterion },
    { value: 'escapeTime', label: text.escapeSpeedrunCriterion },
  ]
  const showProfileFields = Boolean(profile)
  const sessionIdsKey = useMemo(() => sessions.map((session) => session.id).join('|'), [sessions])

  function challengeStatusLabel(status?: ChallengeStatus | null) {
    if (status === 'accepted') return text.challengeAccepted
    if (status === 'declined') return text.challengeDeclined
    if (status === 'completed') return text.challengeCompleted
    if (status === 'cancelled') return text.challengeCancelled
    return text.challengePending
  }

  const loadSelectedPlayerStats = useCallback(async (profileId: string, force = false) => {
    if (!profileId) return
    if (!force && selectedPlayerStatsFetchedRef.current.has(profileId)) return
    if (selectedPlayerStatsLoadingRef.current.has(profileId)) return

    selectedPlayerStatsLoadingRef.current.add(profileId)

    try {
      const { data, error } = await (await getSupabase()).rpc(
        'get_leaderboard_players_page',
        leaderboardRpcArgs(leaderboardQueryRef.current, 0, 1, profileId)
      )

      if (error) throw error

      const player = ((data ?? []) as LeaderboardRpcRow[])
        .map((row) => leaderboardPlayerFromRpcRow(row, text.player))[0]

      selectedPlayerStatsFetchedRef.current.add(profileId)
      if (player && selectedPlayerIdRef.current === profileId) {
        setSelectedPlayerStatsOverride(player)
        setProfileScoreAdjustments((current) => ({
          ...current,
          [player.profileId]: player.scoreAdjustment,
        }))
      }
    } catch {
      selectedPlayerStatsFetchedRef.current.add(profileId)
    } finally {
      selectedPlayerStatsLoadingRef.current.delete(profileId)
    }
  }, [text.player])

  function openPlayerProfile(profileId: string, sessionId = '', seedStats?: LeaderboardPlayer) {
    selectedPlayerIdRef.current = profileId
    setSelectedPlayerId(profileId)
    setSelectedPlayerSessionId(sessionId)
    setSelectedPlayerStatsOverride((current) => seedStats ?? (current?.profileId === profileId ? current : null))
    setSelectedPlayerScoreEdit(null)
    if (sessionId) void loadSessionDetail(sessionId)
    else void loadSelectedPlayerStats(profileId, true)
  }

  function openStaffPlayerProfile(staffProfile: StaffProfile) {
    openPlayerProfile(staffProfile.id, '', leaderboardPlayerFromStaffProfile(staffProfile, text.player))
  }

  function closePlayerProfile() {
    selectedPlayerIdRef.current = ''
    setSelectedPlayerId('')
    setSelectedPlayerSessionId('')
    setSelectedPlayerStatsOverride(null)
    setSelectedPlayerScoreEdit(null)
    setChallengeTargetId('')
    setChallengeStatus('')
  }

  function updateAvatarColor(value: string) {
    const normalized = cleanHexColor(value, avatarColor)
    setAvatarColor(normalized)
    setAvatarColorDraft(normalized)
  }

  function updateAvatarColorDraft(value: string) {
    setAvatarColorDraft(value)
    if (isHexColor(value)) setAvatarColor(value.toLowerCase())
  }

  function updateAvatarTextColor(value: string) {
    const normalized = cleanHexColor(value, avatarTextColor)
    setAvatarTextColor(normalized)
    setAvatarTextColorDraft(normalized)
  }

  function updateAvatarTextColorDraft(value: string) {
    setAvatarTextColorDraft(value)
    if (isHexColor(value)) setAvatarTextColor(value.toLowerCase())
  }

  function updateClubThemeColor(value: string) {
    const normalized = cleanHexColor(value, clubEditThemeColor)
    setClubEditThemeColor(normalized)
    setClubEditThemeColorDraft(normalized)
  }

  function updateClubThemeColorDraft(value: string) {
    setClubEditThemeColorDraft(value)
    if (isHexColor(value)) setClubEditThemeColor(value.toLowerCase())
  }

  function chooseAvatarMode(mode: 'photo' | 'emoji' | 'initials') {
    setAvatarMode(mode)
    if (mode !== 'photo') {
      setAvatarFile(null)
      setAvatarPreview('')
    }
  }

  function avatarNode(source: {
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    display_name?: string | null
    full_name?: string | null
    nickname?: string | null
  } | null | undefined, fallback = 'Player') {
    const label = compactDisplayName(source?.display_name || source?.nickname || source?.full_name, fallback)
    const initials = validAvatarInitials(source?.avatar_initials)

    if (source?.avatar_url) {
      return (
        <span
          className="avatar-photo"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            borderRadius: 999,
          }}
        >
          <NextImage
            src={source.avatar_url}
            alt=""
            fill
            sizes="96px"
            unoptimized={shouldSkipImageOptimization(source.avatar_url)}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              borderRadius: 999,
            }}
          />
        </span>
      )
    }
    if (source?.avatar_emoji) return <span className="avatar-emoji">{source.avatar_emoji}</span>
    if (initials) return <span className="avatar-text">{initials}</span>
    return <span className="avatar-text">{compactInitials(label || fallback)}</span>
  }

  function avatarStyle(source: { avatar_color?: string | null; avatar_text_color?: string | null } | null | undefined) {
    if (!source?.avatar_color && !source?.avatar_text_color) return undefined

    return {
      ...(source.avatar_color ? { background: source.avatar_color } : {}),
      ...(source.avatar_text_color ? { color: source.avatar_text_color } : {}),
    }
  }

  function avatarFields(source: Profile) {
    if (source.anonymous_mode) {
      return {
        avatar_url: null,
        avatar_emoji: ANONYMOUS_MASK_EMOJI,
        avatar_initials: null,
        avatar_color: ANONYMOUS_MASK_COLOR,
        avatar_text_color: ANONYMOUS_MASK_TEXT_COLOR,
        profile_motto: null,
      }
    }

    return {
      avatar_url: source.avatar_url || null,
      avatar_emoji: source.avatar_emoji || null,
      avatar_initials: source.avatar_initials || null,
      avatar_color: source.avatar_color || null,
      avatar_text_color: source.avatar_text_color || null,
      profile_motto: source.profile_motto || null,
    }
  }

  function profileAvatarSnapshot(source: Profile) {
    return {
      display_name: displayName(source),
      ...avatarFields(source),
    }
  }

  function mergeCurrentUserAvatar<T extends {
    profile_id: string
    display_name?: string | null
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    profile_motto?: string | null
  }>(item: T, snapshot: ReturnType<typeof profileAvatarSnapshot>, profileId: string): T {
    return item.profile_id === profileId
      ? {
        ...item,
        ...snapshot,
      }
      : item
  }

  function syncProfileEverywhere(updatedProfile: Profile) {
    const nextProfileSnapshot = profileAvatarSnapshot(updatedProfile)

    setSessions((currentSessions) =>
      currentSessions.map((session) => ({
        ...session,
        session_participants: session.session_participants?.map((participant) =>
          mergeCurrentUserAvatar(participant, nextProfileSnapshot, updatedProfile.id)
        ),
        session_waitlist: session.session_waitlist?.map((entry) =>
          mergeCurrentUserAvatar(entry, nextProfileSnapshot, updatedProfile.id)
        ),
      }))
    )

    setClubs((currentClubs) =>
      currentClubs.map((club) => ({
        ...club,
        club_members: clubMembers(club).map((member) =>
          mergeCurrentUserAvatar(member, nextProfileSnapshot, updatedProfile.id)
        ),
      }))
    )

    setTournamentData((currentData) => ({
      ...currentData,
      editors: currentData.editors.map((editor) =>
        mergeCurrentUserAvatar(editor, nextProfileSnapshot, updatedProfile.id)
      ),
    }))

    setAllProfiles((currentProfiles) => {
      const nextProfiles = currentProfiles.map((item) => (item.id === updatedProfile.id ? { ...item, ...updatedProfile } : item))
      return nextProfiles.some((item) => item.id === updatedProfile.id) ? nextProfiles : [...nextProfiles, updatedProfile]
    })

    setLeaderboardPlayers((currentPlayers) =>
      currentPlayers.map((player) => player.profileId === updatedProfile.id
        ? (() => {
          const nextAvatar = avatarFields(updatedProfile)
          return {
            ...player,
            displayName: compactDisplayName(displayName(updatedProfile), text.player),
            avatarUrl: nextAvatar.avatar_url,
            avatarEmoji: nextAvatar.avatar_emoji,
            avatarInitials: nextAvatar.avatar_initials,
            avatarColor: nextAvatar.avatar_color,
            avatarTextColor: nextAvatar.avatar_text_color,
            profileMotto: updatedProfile.profile_motto || null,
          }
        })()
        : player
      )
    )
  }

  async function copyInviteCode(sessionId: string, inviteCode: string | null) {
    if (!inviteCode) return

    await navigator.clipboard?.writeText(inviteCode)
    setCopiedInviteId(sessionId)
    window.setTimeout(() => setCopiedInviteId((current) => (current === sessionId ? '' : current)), 1400)
  }

  function goToLogin() {
    setAuthMode('login')
    setAuthStep('email')
    setActiveView('profile')
    setProfileStatus(text.loginToContinue)
    setLoginPromptOpen(false)
  }

  function promptLogin() {
    setLoginPromptOpen(true)
    setProfileStatus(text.loginToContinue)
  }

  function requireProfile() {
    if (profile) return true

    promptLogin()
    return false
  }

  function ensureClubsLoaded() {
    if (clubsLoadedRef.current || clubsLoadingRef.current) return
    void loadClubs()
  }

  function ensureTournamentDataLoaded() {
    if (tournamentDataLoadedRef.current || tournamentDataLoadingRef.current) return
    void loadTournamentData()
  }

  function ensureNetworkDataLoaded() {
    if (networkDataLoadedRef.current || networkDataLoadingRef.current) return
    void loadNetworkData()
  }

  function ensureAllProfilesLoaded() {
    if (allProfilesLoadedRef.current || allProfilesLoadingRef.current) return
    void loadAllProfiles()
  }

  function ensureLeaderboardLoaded() {
    if (leaderboardLoadedRef.current || leaderboardLoadingRef.current) return
    void loadLeaderboardPlayers()
  }

  function ensureSessionsLoaded() {
    if (sessionsLoadedRef.current || loadingSessionRangeRef.current) return
    void loadSessions()
  }

  function refreshLeaderboardIfLoaded() {
    if (!leaderboardLoadedRef.current) return
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPlayers(leaderboardQueryRef.current, 0, 'replace', userId)
  }

  function reloadLeaderboard(nextQuery: LeaderboardQuery) {
    leaderboardQueryRef.current = nextQuery
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPlayers(nextQuery, 0, 'replace', userId)
  }

  function handleLeaderboardCriterionChange(criterion: LeaderboardCriterion) {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      criterion,
    })
  }

  function handleLeaderboardSearchChange(searchValue: string) {
    const nextQuery = {
      ...leaderboardQueryRef.current,
      search: searchValue,
    }
    leaderboardQueryRef.current = nextQuery

    if (leaderboardSearchReloadTimeoutRef.current) window.clearTimeout(leaderboardSearchReloadTimeoutRef.current)
    leaderboardSearchReloadTimeoutRef.current = window.setTimeout(() => {
      leaderboardLoadedCountRef.current = 0
      void loadLeaderboardPlayers(nextQuery, 0, 'replace', userId)
    }, 260)
  }

  function handleLeaderboardClubChange(clubId: string) {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      clubId,
      clubPin: clubId === leaderboardQueryRef.current.clubId ? leaderboardQueryRef.current.clubPin : '',
    })
  }

  function handleLeaderboardClubPinUnlock(clubId: string, pinCode: string) {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      clubId,
      clubPin: pinCode,
    })
  }

  function loadMoreLeaderboardPlayers() {
    if (!hasMoreLeaderboardPlayers || isLoadingMoreLeaderboardPlayers) return
    void loadLeaderboardPlayers(leaderboardQueryRef.current, leaderboardLoadedCountRef.current, 'append', userId)
  }

  function refreshSessionsIfLoaded() {
    if (!sessionsLoadedRef.current) return
    void loadSessions()
  }

  function loadExpandedSessionDetails() {
    expandedSessionIdsRef.current.forEach((sessionId) => {
      void loadSessionDetail(sessionId, { force: true })
    })
  }

  function loadExpandedSessionMessages(options: { force?: boolean } = {}) {
    expandedSessionIdsRef.current.forEach((sessionId) => {
      if (!options.force && !sessionMessagesLoadedRef.current.has(sessionId)) return
      void loadSessionMessages(sessionId, { force: true })
    })
  }

  function flushRealtimeRefreshes() {
    const tasks = realtimeRefreshQueueRef.current
    if (tasks.size === 0) return

    realtimeRefreshQueueRef.current = new Set()
    realtimeRefreshTimerRef.current = null

    if (tasks.has('profile')) loadProfileRef.current()
    if (tasks.has('sessions')) refreshSessionsIfLoadedRef.current()
    if (tasks.has('leaderboard')) refreshLeaderboardIfLoadedRef.current()
    if (tasks.has('clubs') && clubsLoadedRef.current) loadClubsRef.current()
    if (tasks.has('tournament') && tournamentDataLoadedRef.current) loadTournamentDataRef.current()
    if (tasks.has('network') && networkDataLoadedRef.current) loadNetworkDataRef.current()
    if (tasks.has('expandedDetails')) loadExpandedSessionDetailsRef.current()
    if (tasks.has('expandedMessages')) loadExpandedSessionMessagesRef.current()
  }

  function queueRealtimeRefresh(tasks: RealtimeRefreshTask[]) {
    tasks.forEach((task) => realtimeRefreshQueueRef.current.add(task))
    if (realtimeRefreshTimerRef.current) window.clearTimeout(realtimeRefreshTimerRef.current)
    realtimeRefreshTimerRef.current = window.setTimeout(flushRealtimeRefreshes, REALTIME_REFRESH_DEBOUNCE_MS)
  }

  function setSessionExpanded(session: Session, expanded: boolean) {
    setExpandedSessions((current) => ({ ...current, [session.id]: expanded }))
    if (!expanded) return

    void loadSessionDetail(session.id)
    void loadSessionMessages(session.id)
    ensureNetworkDataLoaded()
    if (session.session_type === 'tournament') ensureTournamentDataLoaded()
  }

  function highlightSessionCard(sessionId: string) {
    setHighlightedSessionId(sessionId)
    if (highlightedSessionTimeoutRef.current) window.clearTimeout(highlightedSessionTimeoutRef.current)
    highlightedSessionTimeoutRef.current = window.setTimeout(() => {
      setHighlightedSessionId('')
      highlightedSessionTimeoutRef.current = null
    }, 5000)
  }

  function openSessionFromProfile(sessionId: string) {
    const targetSession = sessions.find((session) => session.id === sessionId)

    setSearch('')
    setSelectedSessionDate('')
    setIsSearchOpen(false)
    setActiveView('sessions')
    highlightSessionCard(sessionId)
    setExpandedSessions((current) => ({ ...current, [sessionId]: true }))
    void loadSessionDetail(sessionId)
    void loadSessionMessages(sessionId)
    if (targetSession) {
      setSessionTimeScope(isUpcomingSession(targetSession) ? 'upcoming' : 'past')
      if (targetSession.session_type === 'tournament') ensureTournamentDataLoaded()
    }
    window.setTimeout(() => {
      document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  function startSessionFromCalendar(dateValue: string, timeValue: string) {
    if (!requireProfile()) return

    setSessionDate(dateValue)
    setSessionTime(timeValue)
    setCreateStatus('')
    setCreateSessionMode('form')
    window.setTimeout(() => {
      document.getElementById('create-session-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function openSessionFromCalendar(session: Session) {
    openSessionFromProfile(session.id)
  }

  async function loadCalendarWeek(startDate = calendarWeekStart) {
    const weekEnd = addDaysToDateValue(startDate, 6)
    await loadSessionRange(startDate, weekEnd, 'merge', {
      includeBlockedTimes: true,
      updateUpcomingPagination: false,
    })
  }

  function showCalendarMode() {
    setCreateSessionMode('calendar')
    void loadCalendarWeek(calendarWeekStart)
  }

  function openCreateSessionCalendar(dateValue = localDateString()) {
    const targetWeekStart = startOfWeekDateValue(dateValue)
    setActiveView('create')
    setCreateSessionMode('calendar')
    setCalendarWeekStart(targetWeekStart)
    void loadCalendarWeek(targetWeekStart)
    window.setTimeout(() => {
      document.querySelector('.calendar-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function showCreateFormMode() {
    setCreateSessionMode('form')
  }

  function moveCalendarWeek(dayOffset: number) {
    const nextWeekStart = addDaysToDateValue(calendarWeekStart, dayOffset)
    setCalendarWeekStart(nextWeekStart)
    void loadCalendarWeek(nextWeekStart)
  }

  function resetCaptcha() {
    setCaptchaToken('')

    const hcaptcha = getHCaptcha()

    if (hcaptcha && captchaWidgetId.current) {
      hcaptcha.reset(captchaWidgetId.current)
    }
  }

  function resetPasskeyCaptcha() {
    passkeyCaptchaResolveRef.current = null
    passkeyCaptchaRejectRef.current = null

    const hcaptcha = getHCaptcha()

    if (hcaptcha && passkeyCaptchaWidgetId.current) {
      hcaptcha.reset(passkeyCaptchaWidgetId.current)
    }
  }

  async function executePasskeyCaptcha() {
    const hcaptcha = getHCaptcha()
    const widgetId = passkeyCaptchaWidgetId.current

    if (!hcaptcha || !widgetId || !hcaptcha.execute) return ''

    return new Promise<string>((resolve, reject) => {
      let settled = false
      const settle = (token: string) => {
        if (settled) return
        settled = true
        passkeyCaptchaResolveRef.current = null
        passkeyCaptchaRejectRef.current = null
        resolve(token)
      }
      const fail = (error: Error) => {
        if (settled) return
        settled = true
        passkeyCaptchaResolveRef.current = null
        passkeyCaptchaRejectRef.current = null
        reject(error)
      }

      passkeyCaptchaResolveRef.current = settle
      passkeyCaptchaRejectRef.current = fail

      try {
        const result = hcaptcha.execute?.(widgetId, { async: true })

        if (result && typeof (result as Promise<string | { response?: string }>).then === 'function') {
          ;(result as Promise<string | { response?: string }>).then((value) => {
            const token = typeof value === 'string' ? value : value.response || ''

            if (token) settle(token)
            else fail(new Error(text.captchaRequired))
          }).catch(fail)
        }
      } catch (error) {
        passkeyCaptchaResolveRef.current = null
        passkeyCaptchaRejectRef.current = null
        fail(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  async function restorePasskeyDocumentFocus() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve())
    })

    window.focus()
    passkeyButtonRef.current?.focus({ preventScroll: true })

    if (document.hasFocus()) return

    await new Promise<void>((resolve) => {
      let settled = false
      let timeoutId: number | null = null
      const settle = () => {
        if (settled) return
        settled = true
        if (timeoutId) window.clearTimeout(timeoutId)
        window.removeEventListener('focus', settle)
        document.removeEventListener('visibilitychange', settle)
        resolve()
      }

      window.addEventListener('focus', settle, { once: true })
      document.addEventListener('visibilitychange', settle, { once: true })
      timeoutId = window.setTimeout(settle, 800)
    })

    window.focus()
    passkeyButtonRef.current?.focus({ preventScroll: true })
  }

  function updateAuthMode(nextMode: 'login' | 'create') {
    setAuthMode(nextMode)
    setAuthStep('email')
    setProfilePassword('')
    setProfileStatus('')
    resetCaptcha()
  }

  function continueAuthFromEmail() {
    const loginEmail = profileEmail.trim().toLowerCase()

    if (!loginEmail || !loginEmail.includes('@')) {
      setProfileStatus(text.emailRequired)
      return
    }

    setProfileEmail(loginEmail)
    setProfileStatus('')
    resetCaptcha()
    setAuthStep('credentials')
  }

  function editAuthEmail() {
    setAuthStep('email')
    setProfilePassword('')
    setProfileStatus('')
    resetCaptcha()
  }

  async function shareLink(key: string, title: string, path = '') {
    const url = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}${path}`

    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url })
      } else {
        await navigator.clipboard?.writeText(url)
      }
      setSharedKey(key)
      setCreateStatus(text.linkCopied)
      window.setTimeout(() => setSharedKey((current) => (current === key ? '' : current)), 1400)
    } catch {
      // Native share is often cancelled by users; no error message needed.
    }
  }

  function waitlistForSession(session: Session) {
    return [...(session.session_waitlist ?? [])].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0
      const right = b.created_at ? new Date(b.created_at).getTime() : 0
      return left - right || a.id.localeCompare(b.id)
    })
  }

  function waitlistPosition(session: Session, profileId: string) {
    const waitlist = waitlistForSession(session)
    const index = waitlist.findIndex((entry) => entry.profile_id === profileId)
    return index >= 0 ? index + 1 : null
  }

  function socialAvatarFields(source: {
    display_name?: string | null
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    profile_motto?: string | null
  }) {
    return {
      display_name: source.display_name || text.player,
      avatar_url: source.avatar_url || null,
      avatar_emoji: source.avatar_emoji || null,
      avatar_initials: source.avatar_initials || null,
      avatar_color: source.avatar_color || null,
      avatar_text_color: source.avatar_text_color || null,
      profile_motto: source.profile_motto || null,
    }
  }

  function friendList() {
    return friendConnections
      .filter((connection) => connection.follower_id === userId)
      .sort((a, b) => compactDisplayName(a.display_name, '').localeCompare(compactDisplayName(b.display_name, '')))
  }

  function isFollowing(profileId: string) {
    return friendConnections.some((connection) => connection.follower_id === userId && connection.following_id === profileId)
  }

  function invitesForSession(sessionId: string) {
    return sessionInvites.filter((invite) => invite.session_id === sessionId)
  }

  const sessionForInvite = useCallback((invite: SessionInvite) => {
    return sessions.find((session) => session.id === invite.session_id)
  }, [sessions])

  function hasSessionInvite(sessionId: string, profileId: string) {
    return sessionInvites.some((invite) => invite.session_id === sessionId && invite.recipient_id === profileId)
  }

  function canReviewSessionMessages(session: Session) {
    return Boolean(userId && (session.owner_id === userId || isAdmin))
  }

  function canSeeSessionMessage(session: Session, message: SessionMessage) {
    const status = message.moderation_status || 'approved'
    if (status === 'approved') return true
    return Boolean(userId && (message.author_id === userId || canReviewSessionMessages(session)))
  }

  function sortSessionMessages(messages: SessionMessage[]) {
    return [...messages].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0
      const right = b.created_at ? new Date(b.created_at).getTime() : 0
      return left - right || a.id.localeCompare(b.id)
    })
  }

  function mergeSessionMessage(message: SessionMessage) {
    setSessionMessages((current) => sortSessionMessages([
      ...current.filter((item) => item.id !== message.id),
      message,
    ]))
  }

  function resetSessionMessageState() {
    sessionMessagesLoadedRef.current.clear()
    sessionMessagesLoadingRef.current.clear()
    setSessionMessages([])
    setSessionMessagePages({})
  }

  function updateSessionMessagePage(sessionId: string, patch: Partial<SessionMessagePageState>) {
    setSessionMessagePages((current) => ({
      ...current,
      [sessionId]: {
        ...(current[sessionId] ?? {
          loaded: false,
          loading: false,
          hasMore: false,
          oldestCreatedAt: null,
        }),
        ...patch,
      },
    }))
  }

  function messagesForSession(session: Session) {
    return sortSessionMessages(sessionMessages
      .filter((message) => message.session_id === session.id && canSeeSessionMessage(session, message))
    )
  }

  function sortClubMessages(messages: ClubMessage[]) {
    return [...messages].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0
      const right = b.created_at ? new Date(b.created_at).getTime() : 0
      return left - right || a.id.localeCompare(b.id)
    })
  }

  function mergeClubMessage(message: ClubMessage) {
    setClubMessages((current) => sortClubMessages([
      ...current.filter((item) => item.id !== message.id),
      message,
    ]))
  }

  function messageTranslationKey(messageKind: 'club' | 'session', messageId: string, targetLanguage: LanguageCode) {
    return `${messageKind}:${messageId}:${targetLanguage}`
  }

  const requestMessageTranslation = useCallback(async (
    messageKind: 'club' | 'session',
    messageId: string,
    body: string,
    targetLanguage: LanguageCode
  ) => {
    const key = messageTranslationKey(messageKind, messageId, targetLanguage)

    setMessageTranslations((current) => {
      const existing = current[key]
      if (existing?.loading || existing?.translatedText || existing?.error) return current
      return {
        ...current,
        [key]: { loading: true },
      }
    })

    try {
      const client = await getSupabase()
      const { data: sessionData } = await client.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        setMessageTranslations((current) => ({
          ...current,
          [key]: { error: 'login_required' },
        }))
        return
      }

      const response = await fetch('/api/messages/translate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          messageKind,
          targetLanguage,
        }),
      })

      if (!response.ok) {
        setMessageTranslations((current) => ({
          ...current,
          [key]: { error: 'translation_failed' },
        }))
        return
      }

      const data = await response.json() as MessageTranslationResponse
      setMessageTranslations((current) => ({
        ...current,
        [key]: {
          changed: Boolean(data.changed && data.translatedText && data.translatedText !== body),
          loading: false,
          sourceLanguage: data.sourceLanguage || null,
          translatedText: data.translatedText || body,
        },
      }))
    } catch {
      setMessageTranslations((current) => ({
        ...current,
        [key]: { error: 'translation_failed' },
      }))
    }
  }, [])

  function toggleMessageOriginal(messageKind: 'club' | 'session', messageId: string, targetLanguage: LanguageCode) {
    const key = messageTranslationKey(messageKind, messageId, targetLanguage)
    setMessageTranslations((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        showOriginal: !current[key]?.showOriginal,
      },
    }))
  }

  function canUseClubMessages(club: Club | undefined) {
    if (!club || !userId) return false
    return canManageClub(club) || club.owner_id === userId || approvedClubMember(club)
  }

  function canSeeClubAdminMessage(club: Club, message: ClubMessage) {
    return message.message_type === 'public' || message.author_id === userId || canManageClub(club)
  }

  function messagesForClub(club: Club, messageType: ClubMessage['message_type']) {
    return sortClubMessages(clubMessages.filter((message) => (
      message.club_id === club.id
      && message.message_type === messageType
      && canSeeClubAdminMessage(club, message)
    )))
  }

  function previousPlayersForSession(session: Session) {
    const currentIds = new Set((session.session_participants ?? []).map((participant) => participant.profile_id))
    const people = new Map<string, ReturnType<typeof socialAvatarFields> & { profile_id: string }>()

    sessions.forEach((pastSession) => {
      if (!isPastSession(pastSession)) return
      const playedWithMe = (pastSession.session_participants ?? []).some((participant) => participant.profile_id === userId)
      if (!playedWithMe) return

      ;(pastSession.session_participants ?? []).forEach((participant) => {
        if (participant.profile_id === userId || currentIds.has(participant.profile_id)) return
        if (people.has(participant.profile_id)) return
        people.set(participant.profile_id, {
          profile_id: participant.profile_id,
          ...socialAvatarFields(participant),
        })
      })
    })

    return Array.from(people.values()).slice(0, 8)
  }

  function notifySession(session: Session, message: string) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

    new Notification('VRena', {
      body: `${message}: ${session.name} · ${formatShortDate(session.date, language)} ${session.start_time.slice(0, 5)}`,
      tag: `vrena-${session.id}-${message}`,
    })
  }

  function notifyInvite(session: Session) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

    new Notification('VRena', {
      body: `${invitationReceivedText}: ${session.name} · ${formatShortDate(session.date, language)} ${session.start_time.slice(0, 5)}`,
      tag: `vrena-invite-${session.id}`,
    })
  }

  async function requestBrowserReminderPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false

    return (await Notification.requestPermission()) === 'granted'
  }

  function canUseWebPush() {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
  }

  async function registerReminderServiceWorker() {
    return navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
  }

  async function enablePushReminders() {
    if (!requireProfile()) return false
    if (!VAPID_PUBLIC_KEY) {
      setPushReminderStatus(text.pushMissingConfig)
      return false
    }
    if (!canUseWebPush()) {
      setPushReminderStatus(text.pushUnsupported)
      return false
    }

    setIsEnablingPush(true)
    setPushReminderStatus('')

    try {
      const hasPermission = await requestBrowserReminderPermission()
      if (!hasPermission) {
        setPushReminderStatus(text.pushPermissionDenied)
        setIsEnablingPush(false)
        return false
      }

      const registration = await registerReminderServiceWorker()
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const serialized = subscription.toJSON()
      const keys = serialized.keys || {}
      if (!keys.p256dh || !keys.auth) {
        setPushReminderStatus(text.pushSaveError)
        setIsEnablingPush(false)
        return false
      }

      const { error } = await (await getSupabase())
        .from('push_subscriptions')
        .upsert({
          profile_id: userId,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent,
          disabled_at: null,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' })

      if (error) {
        setPushReminderStatus(error.message)
        setIsEnablingPush(false)
        return false
      }

      setIsPushSubscribed(true)
      setPushReminderStatus(text.pushEnabled)
      setIsEnablingPush(false)
      return true
    } catch (error) {
      setPushReminderStatus(error instanceof Error ? error.message : text.pushSaveError)
      setIsEnablingPush(false)
      return false
    }
  }

  function downloadSessionCalendar(session: Session) {
    if (typeof window === 'undefined') return

    const start = sessionStartDate(session)
    const end = sessionEndDate(session)
    const title = icsText(`VRena: ${session.name}`)
    const description = icsText(session.notes || 'VRena session')
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VRena//Booking//EN',
      'BEGIN:VEVENT',
      `UID:vrena-${session.id}@vrena-booking`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${title}`,
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      `DESCRIPTION:${title}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${session.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'vrena-session'}.ics`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function prepareJoinedSessionReminders(session: Session) {
    downloadSessionCalendar(session)
    const hasPermission = await enablePushReminders()
    if (hasPermission) notifySession(session, text.reminderJoined)
  }

  async function loadProfile(options: { skipMfaChallenge?: boolean } = {}) {
    try {
      authDebug('loadProfile:start')
      const { data: userData, error: userError } = await (await getSupabase()).auth.getUser()
      const authUser = userData.user
      authDebug('loadProfile:getUser', {
        error: userError,
        user: authUser ? {
          id: authUser.id,
          email: authUser.email,
          emailConfirmedAt: authUser.email_confirmed_at,
          lastSignInAt: authUser.last_sign_in_at,
          appMetadata: authUser.app_metadata,
          userMetadata: authUser.user_metadata,
        } : null,
      })

      if (userError) {
        setUserId('')
        setAuthEmail('')
        setProfile(null)
        if (/auth session missing/i.test(userError.message)) {
          setProfileStatus('')
          return
        }
        setProfileStatus(userError.message)
        return
      }

      if (!authUser) {
        setUserId('')
        setAuthEmail('')
        setProfile(null)
        return
      }

      setUserId(authUser.id)
      setAuthEmail(authUser.email?.toLowerCase() || '')

      if (!options.skipMfaChallenge) {
        const needsMfa = await prepareMfaChallengeIfNeeded()
        if (needsMfa) {
          setProfile(null)
          return
        }
      }

      await refreshMfaFactors()

      const { data: profileRow, error: profileError, status: profileStatusCode } = await (await getSupabase())
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', authUser.id)
        .is('deleted_at', null)
        .maybeSingle()

      authDebug('loadProfile:profileQuery', {
        status: profileStatusCode,
        error: profileError,
        profile: profileRow,
        role: profileRow?.role,
        isAdminEmail: isAdminEmail(authUser.email),
      })

      if (profileError) {
        setProfileStatus(profileError.message)
        return
      }

      if (profileRow) {
        const profileInitials = validAvatarInitials(profileRow.avatar_initials)
        const phoneParts = splitPhoneNumber(profileRow.phone || '')
        setProfile(profileRow)
        setProfileCountryCode(phoneParts.countryInput)
        setProfilePhone(phoneParts.localPhone)
        setProfileName(profileRow.full_name || '')
        setProfileMotto(limitMotto(profileRow.profile_motto || ''))
        setProfileNickname(limitDisplayName(profileRow.nickname || ''))
        setProfileEmail(profileRow.email || '')
        setProfileBirthday(profileRow.birthday || '')
        setProfileGender(normalizeProfileGender(profileRow.gender))
        setMarketingConsent(profileRow.marketing_consent !== false)
        setAvatarMode(profileRow.avatar_url ? 'photo' : profileRow.avatar_emoji ? 'emoji' : profileInitials ? 'initials' : 'photo')
        setAvatarEmoji(profileRow.avatar_emoji || '😎')
        setAvatarInitials(profileInitials)
        setAvatarColor(profileRow.avatar_color || avatarColors[0])
        setAvatarColorDraft(profileRow.avatar_color || avatarColors[0])
        setAvatarTextColor(profileRow.avatar_text_color || avatarTextColors[0])
        setAvatarTextColorDraft(profileRow.avatar_text_color || avatarTextColors[0])
        return
      }

      const email = authUser.email?.toLowerCase() || ''
      const fullName = (
        typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name :
          typeof authUser.user_metadata?.name === 'string' ? authUser.user_metadata.name :
            typeof authUser.user_metadata?.display_name === 'string' ? authUser.user_metadata.display_name :
              ''
      )
      const nickname = typeof authUser.user_metadata?.nickname === 'string' ? limitDisplayName(authUser.user_metadata.nickname) : ''
      const profileMottoValue = typeof authUser.user_metadata?.profile_motto === 'string' ? limitMotto(authUser.user_metadata.profile_motto) : ''
      const birthdayValue = typeof authUser.user_metadata?.birthday === 'string' ? authUser.user_metadata.birthday : ''
      const genderValue = normalizeProfileGender(authUser.user_metadata?.gender)
      const phone = typeof authUser.user_metadata?.phone === 'string' ? authUser.user_metadata.phone : ''
      const metadataAvatarUrl = (
        typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url :
          typeof authUser.user_metadata?.picture === 'string' ? authUser.user_metadata.picture :
            ''
      )
      const metadataInitials = validAvatarInitials(typeof authUser.user_metadata?.avatar_initials === 'string' ? authUser.user_metadata.avatar_initials : '')
      const fallbackProfile: Profile = {
        id: authUser.id,
        phone,
        full_name: fullName || null,
        nickname: nickname || null,
        email,
        birthday: birthdayValue || null,
        gender: genderValue || null,
        avatar_url: metadataAvatarUrl || null,
        avatar_emoji: typeof authUser.user_metadata?.avatar_emoji === 'string' ? authUser.user_metadata.avatar_emoji : null,
        avatar_initials: metadataInitials || null,
        avatar_color: typeof authUser.user_metadata?.avatar_color === 'string' ? authUser.user_metadata.avatar_color : null,
        avatar_text_color: typeof authUser.user_metadata?.avatar_text_color === 'string' ? authUser.user_metadata.avatar_text_color : null,
        profile_motto: profileMottoValue || null,
        role: defaultRoleForEmail(email),
        anonymous_mode: Boolean(authUser.user_metadata?.anonymous_mode),
        anonymous_callsign: typeof authUser.user_metadata?.anonymous_callsign === 'string' ? authUser.user_metadata.anonymous_callsign : null,
        marketing_consent: authUser.user_metadata?.marketing_consent === false ? false : true,
        marketing_consent_at: typeof authUser.user_metadata?.marketing_consent_at === 'string' ? authUser.user_metadata.marketing_consent_at : null,
        marketing_opted_out_at: typeof authUser.user_metadata?.marketing_opted_out_at === 'string' ? authUser.user_metadata.marketing_opted_out_at : null,
      }

      authDebug('loadProfile:missingProfileFallback', fallbackProfile)
      setProfile(fallbackProfile)
      setProfileCountryCode('+84')
      setProfilePhone(phone.replace(/^\+?84/, ''))
      setProfileName(fullName)
      setProfileMotto(profileMottoValue)
      setProfileNickname(nickname)
      setProfileEmail(email)
      setProfileBirthday(birthdayValue)
      setProfileGender(genderValue)
      setMarketingConsent(fallbackProfile.marketing_consent !== false)
      setAvatarMode(fallbackProfile.avatar_url ? 'photo' : fallbackProfile.avatar_emoji ? 'emoji' : metadataInitials ? 'initials' : 'photo')
      setAvatarEmoji(fallbackProfile.avatar_emoji || '😎')
      setAvatarInitials(metadataInitials)
      setAvatarColor(fallbackProfile.avatar_color || avatarColors[0])
      setAvatarColorDraft(fallbackProfile.avatar_color || avatarColors[0])
      setAvatarTextColor(fallbackProfile.avatar_text_color || avatarTextColors[0])
      setAvatarTextColorDraft(fallbackProfile.avatar_text_color || avatarTextColors[0])

      const repairResult = await (await getSupabase()).from('profiles').insert({
        id: authUser.id,
        phone: phone || null,
        full_name: fullName || null,
        nickname: nickname || null,
        email,
        birthday: fallbackProfile.birthday,
        gender: fallbackProfile.gender,
        avatar_url: fallbackProfile.avatar_url,
        avatar_emoji: fallbackProfile.avatar_emoji,
        avatar_initials: fallbackProfile.avatar_initials,
        avatar_color: fallbackProfile.avatar_color,
        avatar_text_color: fallbackProfile.avatar_text_color,
        profile_motto: fallbackProfile.profile_motto,
        anonymous_mode: fallbackProfile.anonymous_mode || false,
        anonymous_callsign: fallbackProfile.anonymous_callsign || null,
        marketing_consent: fallbackProfile.marketing_consent !== false,
        marketing_consent_at: fallbackProfile.marketing_consent_at || new Date().toISOString(),
        marketing_opted_out_at: fallbackProfile.marketing_opted_out_at || null,
        updated_at: new Date().toISOString(),
      })

      authDebug('loadProfile:profileRepairUpsert', repairResult)
    } catch (error) {
      authDebug('loadProfile:thrown', error)
      setProfileStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function consumeAppRateLimit(
    action: RateLimitAction,
    subject: string,
    setStatus: (message: string) => void = setCreateStatus
  ) {
    if (action === 'login_attempt') {
      const { error } = await (await getSupabase()).rpc('consume_login_attempt_rate_limit', {
        p_email: subject || null,
      })

      if (error) {
        setStatus(error.message || 'Too many attempts. Please wait a moment and try again.')
        return false
      }

      return true
    }

    const rule = RATE_LIMITS[action]
    const { error } = await (await getSupabase()).rpc('consume_rate_limit', {
      p_action: action,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
      p_subject: subject || null,
    })

    if (error) {
      setStatus(error.message || 'Too many attempts. Please wait a moment and try again.')
      return false
    }

    return true
  }

  async function softDeleteRecord(entityTable: string, entityId: string, reason: string) {
    return (await getSupabase()).rpc('soft_delete_record', {
      p_entity_table: entityTable,
      p_entity_id: entityId,
      p_delete_reason: reason,
    })
  }

  async function softDeleteTournamentRecords(sessionId: string, includePools: boolean, reason: string) {
    return (await getSupabase()).rpc('soft_delete_tournament_records', {
      p_session_id: sessionId,
      p_include_pools: includePools,
      p_delete_reason: reason,
    })
  }

  async function handleAuth() {
    try {
      if (!profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'email') {
        continueAuthFromEmail()
        return
      }

      const localPhone = profilePhone.replace(/\D/g, '')
      const loginEmail = profileEmail.trim().toLowerCase()
      const fullName = profileName.trim()

      authDebug('handleAuth:attempt', {
        mode: authMode,
        email: loginEmail,
        isAdminEmail: isAdminEmail(loginEmail),
        hasCaptcha: Boolean(captchaToken),
        localPhoneLength: localPhone.length,
        hasFullName: Boolean(fullName),
      })

      if (!loginEmail || !loginEmail.includes('@')) {
        setProfileStatus(text.emailRequired)
        return
      }

      if (profilePassword.length < 6) {
        setProfileStatus(text.passwordRequired)
        return
      }

      if (authMode === 'create' && !personalDataConsent) {
        setProfileStatus(text.consentRequired)
        return
      }

      if (authMode === 'create' && !captchaToken) {
        setProfileStatus(text.captchaRequired)
        return
      }

      if (authMode === 'login') {
        const allowed = await consumeAppRateLimit('login_attempt', loginEmail, setProfileStatus)
        if (!allowed) return
      }

      setIsSavingProfile(true)
      setProfileStatus(authMode === 'login' ? text.loggingIn : text.creating)

      const nickname = limitDisplayName(profileNickname.trim())
      const display = nickname || compactDisplayName(fullName || loginEmail.split('@')[0])
      const consentAt = new Date().toISOString()

      if (authMode === 'create') {
        const signUpResult = await (await getSupabase()).auth.signUp({
          email: loginEmail,
          password: profilePassword,
          options: {
            data: {
              display_name: display,
              name: display,
              gender: profileGender || null,
              marketing_consent: marketingConsent,
              marketing_consent_at: marketingConsent ? consentAt : null,
              marketing_opted_out_at: marketingConsent ? null : consentAt,
              personal_data_consent: personalDataConsent,
              personal_data_consent_at: consentAt,
              privacy_policy_url: PRIVACY_POLICY_URL,
            },
            captchaToken,
          },
        })

        authDebug('handleAuth:signUpResponse', {
          error: signUpResult.error,
          hasSession: Boolean(signUpResult.data.session),
          user: signUpResult.data.user ? {
            id: signUpResult.data.user.id,
            email: signUpResult.data.user.email,
            emailConfirmedAt: signUpResult.data.user.email_confirmed_at,
            appMetadata: signUpResult.data.user.app_metadata,
            userMetadata: signUpResult.data.user.user_metadata,
          } : null,
        })

        resetCaptcha()

        if (signUpResult.error) {
          setProfileStatus(signUpResult.error.message)
          setIsSavingProfile(false)
          return
        }

        if (!signUpResult.data.user) {
          setProfileStatus(text.loginRequired)
          setAuthMode('login')
          setAuthStep('credentials')
          setIsSavingProfile(false)
          return
        }

        setUserId(signUpResult.data.user.id)
        setPersonalDataConsent(false)
        setProfilePassword('')
        await loadProfile()
        setProfileStatus(text.accountCreated)
        setActiveView('profile')
        setIsSavingProfile(false)
        return
      }

      authDebug('handleAuth:signInWithPassword:start', {
        email: loginEmail,
        isAdminEmail: isAdminEmail(loginEmail),
      })

      const signInResult = await (await getSupabase()).auth.signInWithPassword({
        email: loginEmail,
        password: profilePassword,
      })

      authDebug('handleAuth:signInWithPassword:response', {
        error: signInResult.error,
        hasSession: Boolean(signInResult.data.session),
        user: signInResult.data.user ? {
          id: signInResult.data.user.id,
          email: signInResult.data.user.email,
          emailConfirmedAt: signInResult.data.user.email_confirmed_at,
          lastSignInAt: signInResult.data.user.last_sign_in_at,
          appMetadata: signInResult.data.user.app_metadata,
          userMetadata: signInResult.data.user.user_metadata,
        } : null,
      })

      if (signInResult.error) {
        setProfileStatus(signInResult.error.message)
        setIsSavingProfile(false)
        return
      }

      if (!signInResult.data.user) {
        setProfileStatus(text.loginRequired)
        setAuthMode('login')
        setAuthStep('credentials')
        setIsSavingProfile(false)
        return
      }

      setUserId(signInResult.data.user.id)
      setProfilePassword('')
      const needsMfa = await prepareMfaChallengeIfNeeded()
      if (needsMfa) {
        setIsSavingProfile(false)
        return
      }
      await loadProfile()
      setProfileStatus(text.loggedIn)
      setActiveView('leaderboard')
      setIsSavingProfile(false)
    } catch (error) {
      authDebug('handleAuth:thrown', error)
      resetCaptcha()
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsSavingProfile(false)
    }
  }

  async function logout() {
    await (await getSupabase()).auth.signOut()
    setUserId('')
    setAuthEmail('')
    setProfile(null)
    setProfilePassword('')
    setAuthStep('email')
    setNewPassword('')
    setIsRecoveryMode(false)
    setMfaFactors([])
    setMfaEnrollment(null)
    setMfaChallenge(null)
    setMfaChallengeCode('')
    setMfaVerifyCode('')
    setMfaRequired(false)
    setMfaStatus('')
    setProfileStatus(text.loggedOut)
  }

  function passkeysAvailable() {
    return typeof window !== 'undefined' && 'PublicKeyCredential' in window
  }

  function isDocumentFocusPasskeyError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '')
    return message.toLowerCase().includes('document is not focused')
  }

  async function signInWithPasskey() {
    if (!passkeysAvailable()) {
      setProfileStatus(text.passkeyUnavailable)
      return
    }

    try {
      setIsPasskeyLoading(true)
      setProfileStatus(text.passkeyStarting)
      const captchaTokenForPasskey = await executePasskeyCaptcha()

      if (!captchaTokenForPasskey) {
        setProfileStatus(text.captchaRequired)
        setIsPasskeyLoading(false)
        return
      }

      await restorePasskeyDocumentFocus()

      const client = await getSupabase()
      let { data, error } = await client.auth.signInWithPasskey({
        options: { captchaToken: captchaTokenForPasskey },
      })

      if (error && isDocumentFocusPasskeyError(error)) {
        resetPasskeyCaptcha()
        await restorePasskeyDocumentFocus()
        const retryCaptchaToken = await executePasskeyCaptcha()

        if (!retryCaptchaToken) {
          setProfileStatus(text.captchaRequired)
          setIsPasskeyLoading(false)
          return
        }

        await restorePasskeyDocumentFocus()
        const retryResult = await client.auth.signInWithPasskey({
          options: { captchaToken: retryCaptchaToken },
        })
        data = retryResult.data
        error = retryResult.error
      }

      resetPasskeyCaptcha()

      if (error) {
        setProfileStatus(error.message)
        setIsPasskeyLoading(false)
        return
      }

      if (!data) {
        setProfileStatus(text.passkeyUnavailable)
        setIsPasskeyLoading(false)
        return
      }

      const nextUserId = data.user?.id || data.session?.user.id || ''
      if (nextUserId) setUserId(nextUserId)
      const needsMfa = await prepareMfaChallengeIfNeeded()
      if (needsMfa) {
        setIsPasskeyLoading(false)
        return
      }
      await loadProfile()
      setProfileStatus(text.loggedIn)
      setActiveView('leaderboard')
      setIsPasskeyLoading(false)
    } catch (error) {
      resetPasskeyCaptcha()
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsPasskeyLoading(false)
    }
  }

  async function registerPasskey() {
    if (!profile) return

    if (!passkeysAvailable()) {
      setProfileStatus(text.passkeyUnavailable)
      return
    }

    try {
      setIsPasskeyLoading(true)
      setProfileStatus(text.passkeyStarting)
      const { error } = await (await getSupabase()).auth.registerPasskey()

      if (error) {
        setProfileStatus(error.message)
        setIsPasskeyLoading(false)
        return
      }

      setProfileStatus(text.passkeyAdded)
      setIsPasskeyLoading(false)
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsPasskeyLoading(false)
    }
  }

  async function refreshMfaFactors() {
    const { data, error } = await (await getSupabase()).auth.mfa.listFactors()

    if (error) {
      setMfaStatus(error.message)
      return []
    }

    const factors = (data?.totp ?? [])
      .filter((factor) => Boolean(factor?.id))
      .map((factor) => ({
        id: factor.id,
        friendly_name: factor.friendly_name,
        factor_type: factor.factor_type,
        status: factor.status,
        created_at: factor.created_at,
        updated_at: factor.updated_at,
      }))
    setMfaFactors(factors)
    return factors
  }

  async function prepareMfaChallengeIfNeeded() {
    if (mfaChallenge) return true

    const assurance = await (await getSupabase()).auth.mfa.getAuthenticatorAssuranceLevel()

    if (assurance.error) {
      setMfaStatus(assurance.error.message)
      return false
    }

    if (assurance.data?.currentLevel === 'aal1' && assurance.data.nextLevel === 'aal2') {
      const factors = await refreshMfaFactors()
      const factor = factors.find((item) => item.status === 'verified') || factors[0]

      if (!factor) {
        setMfaStatus(text.mfaChallengeError)
        setProfileStatus(text.mfaChallengeError)
        return false
      }

      const challenge = await (await getSupabase()).auth.mfa.challenge({ factorId: factor.id })

      if (challenge.error || !challenge.data) {
        setMfaStatus(challenge.error?.message || text.mfaChallengeError)
        setProfileStatus(challenge.error?.message || text.mfaChallengeError)
        return true
      }

      setMfaChallenge({ factorId: factor.id, challengeId: challenge.data.id })
      setMfaChallengeCode('')
      setMfaRequired(true)
      setActiveView('profile')
      setProfileStatus(text.mfaRequired)
      return true
    }

    setMfaChallenge(null)
    setMfaRequired(false)
    return false
  }

  async function verifyMfaChallenge() {
    if (!mfaChallenge || !mfaChallengeCode.trim()) {
      setProfileStatus(text.mfaCodeRequired)
      return
    }

    setIsMfaLoading(true)
    const { data, error } = await (await getSupabase()).auth.mfa.verify({
      factorId: mfaChallenge.factorId,
      challengeId: mfaChallenge.challengeId,
      code: mfaChallengeCode.trim(),
    })

    if (error) {
      setProfileStatus(error.message)
      setIsMfaLoading(false)
      return
    }

    setMfaChallenge(null)
    setMfaChallengeCode('')
    setMfaRequired(false)
    if (data?.user) {
      setUserId(data.user.id)
      setAuthEmail(data.user.email?.toLowerCase() || '')
    }
    setProfileStatus(text.loggedIn)
    await refreshMfaFactors()
    await loadProfile({ skipMfaChallenge: true })
    setActiveView('leaderboard')
    setIsMfaLoading(false)
  }

  async function beginTotpEnrollment() {
    if (!profile) return

    setIsMfaLoading(true)
    setMfaStatus('')
    setMfaVerifyCode('')
    const { data, error } = await (await getSupabase()).auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'VRena',
      issuer: 'VRena',
    })

    if (error || !data) {
      setMfaStatus(error?.message || text.mfaEnrollError)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment({
      id: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    })
    setIsMfaLoading(false)
  }

  async function confirmTotpEnrollment() {
    if (!mfaEnrollment || !mfaVerifyCode.trim()) {
      setMfaStatus(text.mfaCodeRequired)
      return
    }

    setIsMfaLoading(true)
    setMfaStatus('')
    const challenge = await (await getSupabase()).auth.mfa.challenge({ factorId: mfaEnrollment.id })

    if (challenge.error || !challenge.data) {
      setMfaStatus(challenge.error?.message || text.mfaVerifyError)
      setIsMfaLoading(false)
      return
    }

    const { error } = await (await getSupabase()).auth.mfa.verify({
      factorId: mfaEnrollment.id,
      challengeId: challenge.data.id,
      code: mfaVerifyCode.trim(),
    })

    if (error) {
      setMfaStatus(error.message)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment(null)
    setMfaVerifyCode('')
    setMfaStatus(text.mfaEnabled)
    await refreshMfaFactors()
    setIsMfaLoading(false)
  }

  async function removeTotpFactor(factorId: string) {
    if (typeof window !== 'undefined' && !window.confirm(text.mfaDisableConfirm)) return

    setIsMfaLoading(true)
    setMfaStatus('')
    const { error } = await (await getSupabase()).auth.mfa.unenroll({ factorId })

    if (error) {
      setMfaStatus(error.message)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment(null)
    setMfaVerifyCode('')
    setMfaStatus(text.mfaDisabled)
    await refreshMfaFactors()
    setIsMfaLoading(false)
  }

  async function signInWithGoogle() {
    try {
      setIsOAuthLoading(true)
      setProfileStatus(text.loggingIn)
      const { error } = await (await getSupabase()).auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appRedirectUrl(),
        },
      })

      if (error) {
        setProfileStatus(error.message)
        setIsOAuthLoading(false)
      }
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsOAuthLoading(false)
    }
  }

  async function sendPasswordReset() {
    const email = (profile?.email || profileEmail).trim().toLowerCase()

    if (!email || !email.includes('@')) {
      setProfileStatus(text.resetPasswordEmailRequired)
      return
    }

    if (!profile && !captchaToken) {
      setProfileStatus(text.captchaRequired)
      return
    }

    setIsResettingPassword(true)
    const redirectTo = appRedirectUrl()
    const supabase = await getSupabase()
    const { data: sessionData } = await supabase.auth.getSession()
    const response = await fetch('/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify({
        email,
        redirectTo,
        captchaToken: captchaToken || undefined,
      }),
    })
    const resetResult = (await response.json().catch(() => ({}))) as { error?: string }

    resetCaptcha()

    if (!response.ok) {
      setProfileStatus(resetResult.error || 'Could not send password reset email.')
      setIsResettingPassword(false)
      return
    }

    setProfileStatus(text.resetPasswordSent)
    setIsResettingPassword(false)
  }

  async function preparePasswordRecoveryFromUrl() {
    const recoveryParams = passwordRecoveryUrlParams()
    if (!recoveryParams) return null

    setActiveView('profile')
    setAuthMode('login')
    setAuthStep('email')

    if (recoveryParams.errorDescription) {
      setIsRecoveryMode(false)
      setProfileStatus(recoveryParams.errorDescription)
      cleanPasswordRecoveryUrl()
      return false
    }

    const client = await getSupabase()

    if (recoveryParams.accessToken && recoveryParams.refreshToken) {
      const { error } = await client.auth.setSession({
        access_token: recoveryParams.accessToken,
        refresh_token: recoveryParams.refreshToken,
      })

      if (error) {
        setIsRecoveryMode(false)
        setProfileStatus(error.message)
        cleanPasswordRecoveryUrl()
        return false
      }
    } else if (recoveryParams.code) {
      const { error } = await client.auth.exchangeCodeForSession(recoveryParams.code)

      if (error) {
        setIsRecoveryMode(false)
        setProfileStatus(error.message)
        cleanPasswordRecoveryUrl()
        return false
      }
    } else if (!recoveryParams.code) {
      setIsRecoveryMode(false)
      setProfileStatus(text.resetPasswordSessionRequired)
      cleanPasswordRecoveryUrl()
      return false
    }

    const { data, error } = await client.auth.getSession()
    cleanPasswordRecoveryUrl()

    if (error || !data.session) {
      setIsRecoveryMode(false)
      setProfileStatus(!data.session ? text.resetPasswordSessionRequired : error?.message || text.resetPasswordSessionRequired)
      return false
    }

    setUserId(data.session.user.id)
    setProfileEmail(data.session.user.email || profileEmail)
    setIsRecoveryMode(true)
    setProfileStatus(text.resetPasswordReady)
    return true
  }

  async function updatePasswordFromRecovery() {
    if (newPassword.length < 6) {
      setProfileStatus(text.passwordRequired)
      return
    }

    setIsResettingPassword(true)
    const client = await getSupabase()
    const { data: sessionData, error: sessionError } = await client.auth.getSession()

    if (sessionError || !sessionData.session) {
      setProfileStatus(!sessionData.session ? text.resetPasswordSessionRequired : sessionError?.message || text.resetPasswordSessionRequired)
      setIsResettingPassword(false)
      return
    }

    const { error } = await client.auth.updateUser({ password: newPassword })

    if (error) {
      setProfileStatus(error.message)
      setIsResettingPassword(false)
      return
    }

    setNewPassword('')
    setIsRecoveryMode(false)
    setProfileStatus(text.passwordUpdated)
    await loadProfile()
    setIsResettingPassword(false)
  }

  async function fetchLeaderboardRows(query: LeaderboardQuery, offset: number, limit: number, profileId = '') {
    const { data, error } = await (await getSupabase()).rpc(
      'get_leaderboard_players_page',
      leaderboardRpcArgs(query, offset, limit, profileId)
    )

    if (error) throw error
    return ((data ?? []) as LeaderboardRpcRow[]).map((row) => leaderboardPlayerFromRpcRow(row, text.player))
  }

  async function loadLeaderboardPlayers(
    query = leaderboardQueryRef.current,
    offset = 0,
    mode: 'append' | 'replace' = 'replace',
    targetUserId = userId
  ) {
    if (leaderboardLoadingRef.current) return false

    leaderboardLoadingRef.current = true
    setLeaderboardStatus('')
    if (mode === 'append') {
      setIsLoadingMoreLeaderboardPlayers(true)
    } else {
      setIsLeaderboardLoading(true)
      setHasMoreLeaderboardPlayers(false)
      setCurrentUserRankPlayer(null)
    }

    try {
      const players = await fetchLeaderboardRows(query, offset, LEADERBOARD_PAGE_SIZE)
      const totalCount = players[0]?.leaderboardTotalCount ?? offset + players.length
      const nextLoadedCount = mode === 'append'
        ? leaderboardLoadedCountRef.current + players.length
        : players.length
      const scoreAdjustments = Object.fromEntries(players.map((player) => [player.profileId, player.scoreAdjustment]))

      leaderboardLoadedRef.current = true
      leaderboardLoadedCountRef.current = nextLoadedCount
      setHasMoreLeaderboardPlayers(nextLoadedCount < totalCount)
      setProfileScoreAdjustments((current) => ({
        ...current,
        ...scoreAdjustments,
      }))

      if (mode === 'append') {
        setLeaderboardPlayers((currentPlayers) => {
          const existingIds = new Set(currentPlayers.map((player) => player.profileId))
          return [...currentPlayers, ...players.filter((player) => !existingIds.has(player.profileId))]
        })
      } else {
        setLeaderboardPlayers(players)
      }

      if (targetUserId && mode === 'replace') {
        const currentUserRow = players.find((player) => player.profileId === targetUserId)
        if (currentUserRow) {
          setCurrentUserRankPlayer(currentUserRow)
        } else {
          const currentUserRows = await fetchLeaderboardRows(query, 0, 1, targetUserId)
          const currentUserPlayer = currentUserRows[0] ?? null
          setCurrentUserRankPlayer(currentUserPlayer)
          if (currentUserPlayer) {
            setProfileScoreAdjustments((current) => ({
              ...current,
              [currentUserPlayer.profileId]: currentUserPlayer.scoreAdjustment,
            }))
          }
        }
      }

      return true
    } catch (error) {
      setLeaderboardStatus(error instanceof Error ? error.message : String(error))
      if (mode === 'replace') {
        leaderboardLoadedRef.current = false
        leaderboardLoadedCountRef.current = 0
        setLeaderboardPlayers([])
        await loadSessions()
      }
      setHasMoreLeaderboardPlayers(false)
      return false
    } finally {
      leaderboardLoadingRef.current = false
      setIsLeaderboardLoading(false)
      setIsLoadingMoreLeaderboardPlayers(false)
    }
  }

  async function loadAllProfiles() {
    if (allProfilesLoadingRef.current) return false

    allProfilesLoadingRef.current = true
    const { data, error } = await (await getSupabase()).rpc('profile_search', {
      p_search: null,
      p_limit: 500,
      p_offset: 0,
      p_role: 'all',
      p_include_demo: false,
      p_sort: 'name_asc',
    })

    allProfilesLoadingRef.current = false

    if (error) {
      setCreateStatus(error.message)
      return false
    }

    const profileRows = (data ?? []) as Profile[]
    allProfilesLoadedRef.current = true
    setAllProfiles(profileRows)
    setProfileScoreAdjustments((current) => ({
      ...current,
      ...Object.fromEntries(profileRows.map((row) => {
        const adjustment = Number(row.score_adjustment ?? 0)
        return [row.id, Number.isFinite(adjustment) ? adjustment : 0]
      })),
    }))
    return true
  }

  function optionalSessionMetadataMissing(error: { message?: string } | null | undefined) {
    const message = error?.message?.toLowerCase() || ''
    return OPTIONAL_SESSION_METADATA_COLUMNS.some((column) => message.includes(column))
  }

  function scoreAdjustmentMapFromPayload(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([profileId, rawAdjustment]) => {
      const adjustment = Number(rawAdjustment ?? 0)
      return [profileId, Number.isFinite(adjustment) ? adjustment : 0]
    }))
  }

  function sessionPageFromRpcPayload(value: unknown): SessionListPageResult {
    const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    return {
      sessions: Array.isArray(payload.sessions)
        ? (payload.sessions as Session[]).map(normalizeSessionRow)
        : [],
      scoreAdjustments: scoreAdjustmentMapFromPayload(payload.scoreAdjustments),
      blockedTimes: Array.isArray(payload.blockedTimes) ? payload.blockedTimes as BlockedTime[] : [],
      hasMoreAfter: typeof payload.hasMoreAfter === 'boolean' ? payload.hasMoreAfter : null,
      source: 'rpc',
    }
  }

  function sessionDetailFromRpcPayload(value: unknown) {
    const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    const session = payload.session && typeof payload.session === 'object'
      ? normalizeSessionRow(payload.session as Session)
      : null
    const invites = Array.isArray(payload.invites) ? payload.invites as SessionInvite[] : []
    const scoreAdjustments = scoreAdjustmentMapFromPayload(payload.scoreAdjustments)

    return { session, invites, scoreAdjustments }
  }

  function normalizeSessionRow(session: Session): Session {
    return {
      ...session,
      game_options: Array.isArray(session.game_options) ? session.game_options : [],
      game_votes: session.game_votes || {},
      session_participants: session.session_participants ?? [],
      session_waitlist: session.session_waitlist ?? [],
    }
  }

  async function loadSessionDetail(sessionId: string, options: { force?: boolean } = {}) {
    if (!sessionId) return null
    if (!options.force && sessionDetailsLoadedRef.current.has(sessionId)) {
      return sessions.find((session) => session.id === sessionId) ?? null
    }
    if (sessionDetailsLoadingRef.current.has(sessionId)) return null

    sessionDetailsLoadingRef.current.add(sessionId)
    setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: true }))

    const client = await getSupabase()
    const rpcDetailResult = await client.rpc('session_detail', { p_session_id: sessionId })

    if (!rpcDetailResult.error && rpcDetailResult.data) {
      const { session: detailSession, invites: inviteRows, scoreAdjustments } = sessionDetailFromRpcPayload(rpcDetailResult.data)

      if (detailSession) {
        setSessions((currentSessions) => {
          const sessionsById = new Map(currentSessions.map((session) => [session.id, session]))
          sessionsById.set(sessionId, detailSession)
          return sortSessionsByStart(Array.from(sessionsById.values()))
        })
        setSessionInvites((current) => [
          ...current.filter((invite) => invite.session_id !== sessionId),
          ...inviteRows,
        ])
        if (Object.keys(scoreAdjustments).length > 0) {
          setProfileScoreAdjustments((current) => ({
            ...current,
            ...scoreAdjustments,
          }))
        }

        sessionDetailsLoadedRef.current.add(sessionId)
        sessionDetailsLoadingRef.current.delete(sessionId)
        setLoadedSessionDetailIds((current) => ({ ...current, [sessionId]: true }))
        setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
        return detailSession
      }
    }

    let detailResult = await client
      .from('sessions')
      .select(SESSION_SELECT)
      .eq('id', sessionId)
      .is('deleted_at', null)
      .is('session_participants.deleted_at', null)
      .neq('status', 'cancelled')
      .single()

    if (optionalSessionMetadataMissing(detailResult.error)) {
      detailResult = await client
        .from('sessions')
        .select(SESSION_SELECT_BASE)
        .eq('id', sessionId)
        .is('deleted_at', null)
        .is('session_participants.deleted_at', null)
        .neq('status', 'cancelled')
        .single()
    }

    if (detailResult.error || !detailResult.data) {
      setCreateStatus(detailResult.error?.message || text.noMatchingSessions)
      sessionDetailsLoadingRef.current.delete(sessionId)
      setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
      return null
    }

    const detailSession = normalizeSessionRow(detailResult.data as Session)
    const participantIds = Array.from(new Set((detailSession.session_participants ?? []).map((participant) => participant.profile_id)))

    const [waitlistResult, invitesResult, adjustmentResult] = await Promise.all([
      client
        .from('session_waitlist')
        .select(WAITLIST_SELECT)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      userId
        ? client
          .from('session_invites')
          .select('id, session_id, inviter_id, recipient_id, recipient_display_name, recipient_avatar_url, recipient_avatar_emoji, recipient_avatar_initials, recipient_avatar_color, recipient_avatar_text_color, recipient_profile_motto, status, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      participantIds.length > 0
        ? client
          .from('profiles')
          .select('id, score_adjustment')
          .is('deleted_at', null)
          .in('id', participantIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const waitlistRows = waitlistResult.error ? [] : (waitlistResult.data ?? []) as WaitlistEntry[]
    const inviteRows = invitesResult.error ? [] : (invitesResult.data ?? []) as SessionInvite[]
    const adjustmentRows = adjustmentResult.error ? [] : (adjustmentResult.data ?? []) as Array<Pick<Profile, 'id' | 'score_adjustment'>>

    const hydratedDetailSession = {
      ...detailSession,
      session_waitlist: waitlistRows,
    }

    setSessions((currentSessions) => {
      const sessionsById = new Map(currentSessions.map((session) => [session.id, session]))
      sessionsById.set(sessionId, hydratedDetailSession)
      return sortSessionsByStart(Array.from(sessionsById.values()))
    })
    if (!invitesResult.error) {
      setSessionInvites((current) => [
        ...current.filter((invite) => invite.session_id !== sessionId),
        ...inviteRows,
      ])
    }
    if (adjustmentRows.length > 0) {
      setProfileScoreAdjustments((current) => ({
        ...current,
        ...Object.fromEntries(adjustmentRows.map((row) => {
          const adjustment = Number(row.score_adjustment ?? 0)
          return [row.id, Number.isFinite(adjustment) ? adjustment : 0]
        })),
      }))
    }

    sessionDetailsLoadedRef.current.add(sessionId)
    sessionDetailsLoadingRef.current.delete(sessionId)
    setLoadedSessionDetailIds((current) => ({ ...current, [sessionId]: true }))
    setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
    return hydratedDetailSession
  }

  async function loadSessionMessages(
    sessionId: string,
    options: { force?: boolean; before?: string | null } = {}
  ) {
    if (!sessionId || !userId) return

    const before = options.before ?? null
    const isInitialPage = !before
    if (isInitialPage && !options.force && sessionMessagesLoadedRef.current.has(sessionId)) return
    if (sessionMessagesLoadingRef.current.has(sessionId)) return

    sessionMessagesLoadingRef.current.add(sessionId)
    updateSessionMessagePage(sessionId, { loading: true })

    const client = await getSupabase()
    let messageQuery = client
      .from('session_messages')
      .select(SESSION_MESSAGE_SELECT)
      .eq('session_id', sessionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(SESSION_MESSAGE_PAGE_SIZE + 1)

    if (before) {
      messageQuery = messageQuery.lt('created_at', before)
    }

    const { data, error } = await messageQuery

    sessionMessagesLoadingRef.current.delete(sessionId)

    if (error) {
      setCreateStatus(error.message)
      updateSessionMessagePage(sessionId, { loading: false })
      return
    }

    const rows = ((data ?? []) as SessionMessage[]).slice(0, SESSION_MESSAGE_PAGE_SIZE)
    const sortedRows = sortSessionMessages(rows)
    const oldestCreatedAt = sortedRows[0]?.created_at ?? before ?? null
    const hasMore = ((data ?? []) as SessionMessage[]).length > SESSION_MESSAGE_PAGE_SIZE

    setSessionMessages((current) => {
      const otherSessions = current.filter((message) => message.session_id !== sessionId)
      const retainedSessionMessages = before
        ? current.filter((message) => message.session_id === sessionId)
        : []
      const messagesById = new Map(retainedSessionMessages.map((message) => [message.id, message]))
      sortedRows.forEach((message) => messagesById.set(message.id, message))
      return sortSessionMessages([...otherSessions, ...Array.from(messagesById.values())])
    })

    sessionMessagesLoadedRef.current.add(sessionId)
    updateSessionMessagePage(sessionId, {
      loaded: true,
      loading: false,
      hasMore,
      oldestCreatedAt,
    })
  }

  async function loadSessionRows(startDate?: string, endDate?: string, includeBlockedTimes = false) {
    const client = await getSupabase()
    const rpcResult = await client.rpc('sessions_list_page', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: 500,
      p_offset: 0,
      p_include_blocked_times: includeBlockedTimes,
    })

    if (!rpcResult.error && rpcResult.data) {
      return sessionPageFromRpcPayload(rpcResult.data)
    }

    let sessionQuery = client
      .from('sessions')
      .select(SESSION_CARD_SELECT)
      .is('deleted_at', null)
      .is('session_participants.deleted_at', null)
      .neq('status', 'cancelled')

    if (startDate) sessionQuery = sessionQuery.gte('date', startDate)
    if (endDate) sessionQuery = sessionQuery.lte('date', endDate)

    const sessionResult = await sessionQuery
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    let sessionRowsData: unknown[] | null = sessionResult.data as unknown[] | null
    let sessionError = sessionResult.error

    if (optionalSessionMetadataMissing(sessionResult.error)) {
      let fallbackSessionQuery = client
        .from('sessions')
        .select(SESSION_CARD_SELECT_BASE)
        .is('deleted_at', null)
        .is('session_participants.deleted_at', null)
        .neq('status', 'cancelled')

      if (startDate) fallbackSessionQuery = fallbackSessionQuery.gte('date', startDate)
      if (endDate) fallbackSessionQuery = fallbackSessionQuery.lte('date', endDate)

      const fallbackSessionResult = await fallbackSessionQuery
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      sessionRowsData = fallbackSessionResult.data
      sessionError = fallbackSessionResult.error
    }

    if (sessionError) {
      setCreateStatus(sessionError.message)
      return null
    }

    return {
      sessions: ((sessionRowsData ?? []) as Session[]).map(normalizeSessionRow),
      scoreAdjustments: {},
      blockedTimes: [],
      hasMoreAfter: null,
      source: 'select',
    } satisfies SessionListPageResult
  }

  async function hasFutureSessionsAfter(dateValue: string) {
    const { data, error } = await (await getSupabase())
      .from('sessions')
      .select('id')
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .gt('date', dateValue)
      .limit(1)

    if (error) return true
    return (data ?? []).length > 0
  }

  async function loadSessionRange(
    startDate: string | undefined,
    endDate: string | undefined,
    mode: 'replace-upcoming' | 'replace-past' | 'merge',
    options: { includeBlockedTimes?: boolean; updateUpcomingPagination?: boolean } = {}
  ) {
    if (loadingSessionRangeRef.current) return false

    loadingSessionRangeRef.current = true
    const sessionPage = await loadSessionRows(startDate, endDate, Boolean(options.includeBlockedTimes))

    if (!sessionPage) {
      loadingSessionRangeRef.current = false
      return false
    }

    const sessionRows = sessionPage.sessions
    const sessionIds = sessionRows.map((session) => session.id)
    const profileIds = Array.from(new Set(sessionRows.flatMap((session) => (session.session_participants ?? []).map((participant) => participant.profile_id))))
    const client = await getSupabase()
    const needsSupplementalListData = sessionPage.source !== 'rpc'
    const [waitlistResult, adjustmentResult] = needsSupplementalListData ? await Promise.all([
      sessionIds.length > 0
        ? client
        .from('session_waitlist')
        .select(WAITLIST_POSITION_SELECT)
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      profileIds.length > 0
        ? client
        .from('profiles')
        .select('id, score_adjustment')
        .is('deleted_at', null)
        .in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]) : [
      { data: [], error: null },
      { data: [], error: null },
    ]

    const waitlistRows = needsSupplementalListData
      ? waitlistResult.error ? [] : (waitlistResult.data ?? []) as WaitlistEntry[]
      : sessionRows.flatMap((session) => session.session_waitlist ?? [])
    const adjustmentRows = adjustmentResult.error ? [] : (adjustmentResult.data ?? [])
    const scoreAdjustments = needsSupplementalListData ? Object.fromEntries(adjustmentRows.map((row) => {
      const adjustment = Number((row as Pick<Profile, 'score_adjustment'>).score_adjustment ?? 0)
      return [(row as Pick<Profile, 'id'>).id, Number.isFinite(adjustment) ? adjustment : 0]
    })) : sessionPage.scoreAdjustments

    if (Object.keys(scoreAdjustments).length > 0) {
      setProfileScoreAdjustments((current) => ({
        ...current,
        ...scoreAdjustments,
      }))
    }
    const hydratedSessions = sessionRows.map((session) => ({
      ...session,
      session_waitlist: waitlistRows.filter((entry) => entry.session_id === session.id),
    }))
    hydratedSessions.forEach((session) => {
      sessionDetailsLoadedRef.current.delete(session.id)
    })

    sessionsLoadedRef.current = true
    setSessions((currentSessions) => {
      const retainedSessions = mode === 'replace-upcoming'
        ? currentSessions.filter((session) => isPastSession(session))
        : mode === 'replace-past'
          ? currentSessions.filter((session) => isUpcomingSession(session))
          : currentSessions
      const sessionsById = new Map(retainedSessions.map((session) => [session.id, session]))
      hydratedSessions.forEach((session) => sessionsById.set(session.id, session))
      return sortSessionsByStart(Array.from(sessionsById.values()))
    })
    loadExpandedSessionDetails()

    if (options.includeBlockedTimes) {
      if (sessionPage.source === 'rpc') {
        setBlockedTimes(sessionPage.blockedTimes)
      } else {
        const blockedResult = await client.from('blocked_times').select('date, start_time, end_time, arenas_used')
        setBlockedTimes((blockedResult.data ?? []) as BlockedTime[])
      }
    }

    if (options.updateUpcomingPagination !== false && endDate && endDate >= localDateString()) {
      setHasMoreUpcomingSessions(typeof sessionPage.hasMoreAfter === 'boolean'
        ? sessionPage.hasMoreAfter
        : await hasFutureSessionsAfter(endDate))
    }

    loadingSessionRangeRef.current = false
    return true
  }

  async function loadSessions(options: { focusDate?: string } = {}) {
    const today = localDateString()
    const defaultEndDate = addDaysToDateValue(today, SESSION_LOAD_BATCH_DAYS - 1)
    const focusEndDate = options.focusDate && options.focusDate >= today ? upcomingBatchEndForDate(options.focusDate) : ''
    const nextEndDate = maxDateValue(defaultEndDate, upcomingSessionsThroughRef.current, focusEndDate)

    const previousEndDate = upcomingSessionsThroughRef.current
    upcomingSessionsThroughRef.current = nextEndDate
    const loaded = await loadSessionRange(today, nextEndDate, 'replace-upcoming', { includeBlockedTimes: true })
    if (!loaded) upcomingSessionsThroughRef.current = previousEndDate
  }

  async function loadMoreUpcomingSessions() {
    if (isLoadingMoreSessions || loadingSessionRangeRef.current || !hasMoreUpcomingSessions) return

    const today = localDateString()
    const currentEndDate = upcomingSessionsThroughRef.current || addDaysToDateValue(today, SESSION_LOAD_BATCH_DAYS - 1)
    const nextStartDate = addDaysToDateValue(currentEndDate, 1)
    const nextEndDate = addDaysToDateValue(nextStartDate, SESSION_LOAD_BATCH_DAYS - 1)

    setIsLoadingMoreSessions(true)
    const previousEndDate = upcomingSessionsThroughRef.current
    upcomingSessionsThroughRef.current = nextEndDate
    const loaded = await loadSessionRange(nextStartDate, nextEndDate, 'merge')
    if (!loaded) upcomingSessionsThroughRef.current = previousEndDate
    setIsLoadingMoreSessions(false)
  }

  async function ensureUpcomingSessionsThroughDate(dateValue: string) {
    const today = localDateString()
    if (!dateValue || dateValue < today) return

    const currentEndDate = upcomingSessionsThroughRef.current || addDaysToDateValue(today, SESSION_LOAD_BATCH_DAYS - 1)
    const targetEndDate = upcomingBatchEndForDate(dateValue)

    if (targetEndDate <= currentEndDate) return

    const nextStartDate = addDaysToDateValue(currentEndDate, 1)
    const previousEndDate = upcomingSessionsThroughRef.current
    upcomingSessionsThroughRef.current = targetEndDate
    const loaded = await loadSessionRange(nextStartDate, targetEndDate, 'merge')
    if (!loaded) upcomingSessionsThroughRef.current = previousEndDate
  }

  async function ensurePastSessionsLoaded() {
    if (pastSessionsLoadedRef.current || pastSessionsLoadingRef.current) return

    pastSessionsLoadingRef.current = true
    setIsLoadingPastSessions(true)
    const loaded = await loadSessionRange(undefined, localDateString(), 'replace-past')
    pastSessionsLoadedRef.current = loaded
    pastSessionsLoadingRef.current = false
    setIsLoadingPastSessions(false)
  }

  async function loadClubs() {
    clubsLoadingRef.current = true
    const client = await getSupabase()

    if (!userId) {
      const { data, error } = await client
        .from('clubs')
        .select(CLUB_PUBLIC_SELECT)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })

      if (error) {
        setClubStatus(error.message)
        clubsLoadingRef.current = false
        return
      }

      clubsLoadedRef.current = true
      clubsLoadingRef.current = false
      setClubs(((data ?? []) as Club[]).map((club) => ({ ...club, club_members: [] })))
      return
    }

    const result = await client
      .from('clubs')
      .select(CLUB_SELECT)
      .is('club_members.deleted_at', null)
      .order('created_at', { ascending: false })
    let data = result.data as Club[] | null
    let error = result.error

    if (error) {
      const fallbackResult = await client
        .from('clubs')
        .select(CLUB_SELECT_BASE)
        .is('club_members.deleted_at', null)
        .order('created_at', { ascending: false })
      data = fallbackResult.data as Club[] | null
      error = fallbackResult.error
    }

    if (error) {
      setClubStatus(error.message)
      clubsLoadingRef.current = false
      return
    }

    let currentUserMemberships: ClubMember[] = []
    if (userId) {
      const membershipResult = await client
        .from('club_members')
        .select(CLUB_MEMBER_SELECT)
        .eq('profile_id', userId)
        .is('deleted_at', null)

      let membershipData = membershipResult.data as ClubMember[] | null
      let membershipError = membershipResult.error

      if (membershipError) {
        const fallbackMembershipResult = await client
          .from('club_members')
          .select(CLUB_MEMBER_SELECT_BASE)
          .eq('profile_id', userId)
          .is('deleted_at', null)

        membershipData = fallbackMembershipResult.data as ClubMember[] | null
        membershipError = fallbackMembershipResult.error
      }

      if (!membershipError) {
        currentUserMemberships = membershipData ?? []
      }
    }

    clubsLoadedRef.current = true
    clubsLoadingRef.current = false
    setClubs((data ?? []).map((club) => mergeCurrentUserClubMembership(club, currentUserMemberships)))
  }

  async function loadClubMessages(club: Club, force = false) {
    if (!canUseClubMessages(club)) return
    if (!force && loadedClubMessagesRef.current.has(club.id)) return

    setIsLoadingClubMessages(true)
    const { data, error } = await (await getSupabase())
      .from('club_messages')
      .select(CLUB_MESSAGE_SELECT)
      .eq('club_id', club.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(CLUB_MESSAGE_LIMIT)

    setIsLoadingClubMessages(false)

    if (error) {
      setClubMessageStatus(error.message)
      return
    }

    const rows = sortClubMessages((data ?? []) as ClubMessage[])
    loadedClubMessagesRef.current.add(club.id)
    setClubMessages((current) => [
      ...current.filter((message) => message.club_id !== club.id),
      ...rows,
    ])
  }

  async function loadTournamentData() {
    tournamentDataLoadingRef.current = true
    const [editorsResult, poolsResult, entriesResult, matchesResult, auditResult] = await Promise.all([
      (await getSupabase()).from('tournament_editors').select('id, session_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto'),
      (await getSupabase()).from('tournament_pools').select('id, session_id, name, sort_order').is('deleted_at', null).order('sort_order', { ascending: true }),
      (await getSupabase()).from('tournament_pool_entries').select('id, session_id, pool_id, participant_id, profile_id, seed, team_label').is('deleted_at', null),
      (await getSupabase())
        .from('tournament_matches')
        .select('id, session_id, pool_id, stage, round, match_number, participant_a_id, participant_b_id, score_a, score_b, wins_a, wins_b, winner_participant_id, loser_participant_id, status, arena_number, queue_position, best_of')
        .is('deleted_at', null)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true }),
      (await getSupabase())
        .from('tournament_audit_log')
        .select('id, session_id, user_id, action, old_value, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(80),
    ])

    const firstError = editorsResult.error || poolsResult.error || entriesResult.error || matchesResult.error || auditResult.error
    if (firstError) {
      setCreateStatus(firstError.message)
      tournamentDataLoadingRef.current = false
      return
    }

    tournamentDataLoadedRef.current = true
    tournamentDataLoadingRef.current = false
    setTournamentData({
      editors: (editorsResult.data ?? []) as TournamentEditor[],
      pools: (poolsResult.data ?? []) as TournamentPool[],
      poolEntries: (entriesResult.data ?? []) as TournamentPoolEntry[],
      matches: (matchesResult.data ?? []) as TournamentMatch[],
      auditLogs: (auditResult.data ?? []) as TournamentAuditLog[],
    })
  }

  async function loadNetworkData() {
    if (!userId) {
      networkDataLoadedRef.current = false
      networkDataLoadingRef.current = false
      setNetworkTablesReady(false)
      setFriendConnections([])
      setSessionInvites([])
      resetSessionMessageState()
      return
    }

    networkDataLoadingRef.current = true
    const sessionIds = sessions.map((session) => session.id)
    const client = await getSupabase()
    const [friendsResult, invitesResult] = await Promise.all([
      client
        .from('user_follows')
        .select('id, follower_id, following_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, created_at')
        .eq('follower_id', userId),
      client
        .from('session_invites')
        .select('id, session_id, inviter_id, recipient_id, recipient_display_name, recipient_avatar_url, recipient_avatar_emoji, recipient_avatar_initials, recipient_avatar_color, recipient_avatar_text_color, recipient_profile_motto, status, created_at')
        .or(`recipient_id.eq.${userId},inviter_id.eq.${userId}`)
        .order('created_at', { ascending: false }),
    ])

    const networkReady = !friendsResult.error && !invitesResult.error
    networkDataLoadedRef.current = networkReady
    networkDataLoadingRef.current = false
    setNetworkTablesReady(networkReady)
    setFriendConnections(friendsResult.error ? [] : (friendsResult.data ?? []) as FriendConnection[])
    const inviteRows = invitesResult.error ? [] : (invitesResult.data ?? []) as SessionInvite[]
    setSessionInvites(inviteRows)

    const loadedSessionIds = new Set(sessionIds)
    const missingInviteSessionIds = Array.from(new Set(inviteRows.map((invite) => invite.session_id)))
      .filter((sessionId) => !loadedSessionIds.has(sessionId))
      .slice(0, 20)

    if (missingInviteSessionIds.length > 0) {
      const invitedSessionsResult = await client
        .from('sessions')
        .select(SESSION_CARD_SELECT)
        .in('id', missingInviteSessionIds)
        .is('deleted_at', null)
        .is('session_participants.deleted_at', null)
        .neq('status', 'cancelled')

      if (!invitedSessionsResult.error && invitedSessionsResult.data) {
        setSessions((currentSessions) => {
          const sessionsById = new Map(currentSessions.map((session) => [session.id, session]))
          ;((invitedSessionsResult.data ?? []) as Session[]).map(normalizeSessionRow).forEach((session) => sessionsById.set(session.id, session))
          return sortSessionsByStart(Array.from(sessionsById.values()))
        })
      }
    }
  }

  useEffect(() => {
    ensureClubsLoadedRef.current = ensureClubsLoaded
    ensureLeaderboardLoadedRef.current = ensureLeaderboardLoaded
    ensureNetworkDataLoadedRef.current = ensureNetworkDataLoaded
    ensurePastSessionsLoadedRef.current = ensurePastSessionsLoaded
    ensureSessionsLoadedRef.current = ensureSessionsLoaded
    ensureTournamentDataLoadedRef.current = ensureTournamentDataLoaded
    ensureUpcomingSessionsThroughDateRef.current = ensureUpcomingSessionsThroughDate
    loadClubMessagesRef.current = loadClubMessages
    loadClubsRef.current = loadClubs
    loadExpandedSessionDetailsRef.current = loadExpandedSessionDetails
    loadExpandedSessionMessagesRef.current = loadExpandedSessionMessages
    loadLeaderboardPlayersRef.current = loadLeaderboardPlayers
    loadMoreUpcomingSessionsRef.current = loadMoreUpcomingSessions
    loadNetworkDataRef.current = loadNetworkData
    loadProfileRef.current = loadProfile
    loadSessionDetailRef.current = loadSessionDetail
    loadSessionMessagesRef.current = loadSessionMessages
    loadTournamentDataRef.current = loadTournamentData
    notifyInviteRef.current = notifyInvite
    notifySessionRef.current = notifySession
    preparePasswordRecoveryFromUrlRef.current = preparePasswordRecoveryFromUrl
    queueRealtimeRefreshRef.current = queueRealtimeRefresh
    refreshLeaderboardIfLoadedRef.current = refreshLeaderboardIfLoaded
    refreshSessionsIfLoadedRef.current = refreshSessionsIfLoaded
    syncProfileEverywhereRef.current = syncProfileEverywhere
    resetPasswordReadyTextRef.current = text.resetPasswordReady
  })

  useEffect(() => {
    return schedulePostEffectStateUpdate(() => {
      setActiveView((currentView) => currentView === initialView ? currentView : initialView)
    })
  }, [initialView])

  useEffect(() => {
    if (!externalLanguage) return
    return schedulePostEffectStateUpdate(() => {
      setLanguage((currentLanguage) => currentLanguage === externalLanguage ? currentLanguage : externalLanguage)
    })
  }, [externalLanguage])

  useEffect(() => {
    onActiveViewChange?.(activeView)
  }, [activeView, onActiveViewChange])

  useEffect(() => {
    onProfileChange?.(profile)
  }, [profile, onProfileChange])

  useEffect(() => {
    let active = true
    const deferredCleanup = scheduleDeferredWork(() => {
      ensureClubsLoadedRef.current()
    })

    void (async () => {
      const recoverySessionReady = await preparePasswordRecoveryFromUrlRef.current()
      if (!active) return
      if (recoverySessionReady === false) {
        loadLeaderboardPlayersRef.current()
        return
      }
      await loadProfileRef.current()
      if (!active) return
      loadLeaderboardPlayersRef.current()
    })()

    return () => {
      active = false
      deferredCleanup()
    }
  }, [])

  useEffect(() => {
    if (activeView === 'clubs' || activeView === 'create' || activeView === 'leaderboard') {
      ensureClubsLoadedRef.current()
    }

    if (activeView === 'leaderboard') {
      const nextQuery = initialLeaderboardQuery()
      leaderboardQueryRef.current = nextQuery
      leaderboardLoadedCountRef.current = 0
      void loadLeaderboardPlayersRef.current(nextQuery, 0, 'replace', userId)
    }

    if (activeView === 'sessions' || activeView === 'tickets' || activeView === 'create' || activeView === 'profile') {
      ensureSessionsLoadedRef.current()
    }

    if (activeView === 'profile') {
      ensureNetworkDataLoadedRef.current()
      ensureLeaderboardLoadedRef.current()
    }
  }, [activeView, userId])

  useEffect(() => {
    if (sessionTimeScope === 'past') {
      void ensurePastSessionsLoadedRef.current()
    }
  }, [sessionTimeScope])

  useEffect(() => () => {
    if (leaderboardSearchReloadTimeoutRef.current) window.clearTimeout(leaderboardSearchReloadTimeoutRef.current)
    if (highlightedSessionTimeoutRef.current) window.clearTimeout(highlightedSessionTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (activeView === 'tickets') {
      void ensureUpcomingSessionsThroughDateRef.current(ticketDate)
    }

    if (activeView === 'create') {
      void ensureUpcomingSessionsThroughDateRef.current(sessionDate)
    }

    if (editingSessionId) {
      void ensureUpcomingSessionsThroughDateRef.current(editSessionDate)
    }

    if (activeView === 'sessions' && sessionTimeScope === 'upcoming' && selectedSessionDate) {
      void ensureUpcomingSessionsThroughDateRef.current(selectedSessionDate)
    }
  }, [activeView, ticketDate, sessionDate, editingSessionId, editSessionDate, sessionTimeScope, selectedSessionDate])

  useEffect(() => {
    if (!challengeTargetId) return
    void ensureUpcomingSessionsThroughDateRef.current(challengeDate)
  }, [challengeDate, challengeTargetId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionTimeScope !== 'upcoming' || !hasMoreUpcomingSessions || isLoadingMoreSessions) return

    function loadWhenNearPageEnd() {
      const documentElement = document.documentElement
      const distanceFromEnd = documentElement.scrollHeight - window.scrollY - window.innerHeight
      if (distanceFromEnd < 640) {
        void loadMoreUpcomingSessionsRef.current()
      }
    }

    loadWhenNearPageEnd()
    window.addEventListener('scroll', loadWhenNearPageEnd, { passive: true })
    return () => window.removeEventListener('scroll', loadWhenNearPageEnd)
  }, [sessionTimeScope, hasMoreUpcomingSessions, isLoadingMoreSessions, sessions.length])

  useEffect(() => {
    networkDataLoadedRef.current = false
    networkDataLoadingRef.current = false

    if (!userId) {
      return schedulePostEffectStateUpdate(() => {
        setNetworkTablesReady(false)
        setFriendConnections([])
        setSessionInvites([])
        resetSessionMessageState()
      })
    }

    return scheduleDeferredWork(() => ensureNetworkDataLoadedRef.current())
  }, [userId])

  useEffect(() => {
    if (selectedPlayerId) {
      ensureNetworkDataLoadedRef.current()
    }
  }, [selectedPlayerId])

  useEffect(() => {
    if (!userId || !networkDataLoadedRef.current) return

    void loadNetworkDataRef.current()
  }, [sessionIdsKey, userId])

  useEffect(() => {
    const expandedIds = Object.entries(expandedSessions)
      .filter(([, expanded]) => expanded)
      .map(([sessionId]) => sessionId)
    expandedSessionIdsRef.current = new Set(expandedIds)
    if (expandedIds.length === 0) return

    ensureNetworkDataLoadedRef.current()
    expandedIds.forEach((sessionId) => {
      void loadSessionDetailRef.current(sessionId)
      void loadSessionMessagesRef.current(sessionId)
    })
    if (sessions.some((session) => expandedIds.includes(session.id) && session.session_type === 'tournament')) {
      ensureTournamentDataLoadedRef.current()
    }
  }, [expandedSessions, sessions])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | null = null

    void getSupabase().then((client) => {
      if (!active) return

      const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
        authDebug('authStateChange', {
          event,
          hasSession: Boolean(session),
          user: session?.user ? {
            id: session.user.id,
            email: session.user.email,
            emailConfirmedAt: session.user.email_confirmed_at,
            lastSignInAt: session.user.last_sign_in_at,
            appMetadata: session.user.app_metadata,
            userMetadata: session.user.user_metadata,
          } : null,
        })

        if (event === 'SIGNED_OUT') {
          setUserId('')
          setAuthEmail('')
          setProfile(null)
          setMfaFactors([])
          setMfaEnrollment(null)
          setMfaChallenge(null)
          setMfaChallengeCode('')
          setMfaVerifyCode('')
          setMfaRequired(false)
          setMfaStatus('')
        }

        if (event === 'PASSWORD_RECOVERY' && session) {
          setUserId(session.user.id)
          setProfileEmail((currentEmail) => session.user.email || currentEmail)
          setIsRecoveryMode(true)
          setActiveView('profile')
          setAuthMode('login')
          setAuthStep('email')
          setProfileStatus(resetPasswordReadyTextRef.current)
        }
      })

      unsubscribe = () => authListener.subscription.unsubscribe()
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (!profile) return
    return schedulePostEffectStateUpdate(() => syncProfileEverywhereRef.current(profile))
  }, [profile])

  useEffect(() => {
    let active = true
    let cleanup: (() => void) | null = null

    void getSupabase().then((client) => {
      if (!active) return

      const channel = client
        .channel('vrena-live-refresh')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
          queueRealtimeRefreshRef.current(['sessions', 'leaderboard'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, () => {
          queueRealtimeRefreshRef.current(['sessions', 'leaderboard'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_waitlist' }, () => {
          queueRealtimeRefreshRef.current(['sessions', 'expandedDetails'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          queueRealtimeRefreshRef.current(['profile', 'sessions', 'leaderboard', 'clubs', 'tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, () => {
          queueRealtimeRefreshRef.current(['clubs'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members' }, () => {
          queueRealtimeRefreshRef.current(['clubs'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_editors' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_pools' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_pool_entries' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_audit_log' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows' }, () => {
          queueRealtimeRefreshRef.current(['network'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_invites' }, () => {
          queueRealtimeRefreshRef.current(['network', 'expandedDetails'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_messages' }, () => {
          queueRealtimeRefreshRef.current(['expandedMessages'])
        })
        .subscribe()

      cleanup = () => {
        client.removeChannel(channel)
      }
    })

    return () => {
      active = false
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current)
        realtimeRefreshTimerRef.current = null
      }
      realtimeRefreshQueueRef.current = new Set()
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    const shouldShowCaptcha = authMode === 'reset' || (authMode === 'create' && authStep === 'credentials')

    if (typeof window === 'undefined' || profile || activeView !== 'profile' || !shouldShowCaptcha) return

    let cancelled = false

    function renderCaptcha() {
      const hcaptcha = getHCaptcha()

      if (cancelled || !captchaContainerRef.current || !hcaptcha || captchaWidgetId.current) return

      captchaWidgetId.current = hcaptcha.render(captchaContainerRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      })
    }

    const existingScript = document.getElementById('hcaptcha-script') as HTMLScriptElement | null
    const browserWindow = window as Window & { [HCAPTCHA_READY_CALLBACK]?: () => void }

    browserWindow[HCAPTCHA_READY_CALLBACK] = renderCaptcha

    if (getHCaptcha()) {
      renderCaptcha()
    } else if (existingScript) {
      existingScript.addEventListener('load', renderCaptcha, { once: true })
    } else {
      const script = document.createElement('script')
      script.id = 'hcaptcha-script'
      script.src = `https://js.hcaptcha.com/1/api.js?render=explicit&onload=${HCAPTCHA_READY_CALLBACK}`
      script.async = true
      script.defer = true
      document.body.appendChild(script)
    }

    return () => {
      cancelled = true
      setCaptchaToken('')

      const hcaptcha = getHCaptcha()

      if (hcaptcha && captchaWidgetId.current) {
        try {
          hcaptcha.remove?.(captchaWidgetId.current)
        } catch {
          hcaptcha.reset(captchaWidgetId.current)
        }
      }

      captchaWidgetId.current = null

      if (browserWindow[HCAPTCHA_READY_CALLBACK] === renderCaptcha) {
        delete browserWindow[HCAPTCHA_READY_CALLBACK]
      }
    }
  }, [activeView, authMode, authStep, profile])

  useEffect(() => {
    const shouldPreparePasskeyCaptcha = !profile && !isRecoveryMode && activeView === 'profile' && authMode === 'login' && authStep === 'email'

    if (typeof window === 'undefined' || !shouldPreparePasskeyCaptcha) return

    let cancelled = false

    function renderPasskeyCaptcha() {
      const hcaptcha = getHCaptcha()

      if (cancelled || !passkeyCaptchaContainerRef.current || !hcaptcha || passkeyCaptchaWidgetId.current) return

      passkeyCaptchaWidgetId.current = hcaptcha.render(passkeyCaptchaContainerRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        size: 'invisible',
        callback: (token) => {
          passkeyCaptchaResolveRef.current?.(token)
        },
        'expired-callback': () => {
          passkeyCaptchaRejectRef.current?.(new Error(text.captchaRequired))
        },
        'error-callback': () => {
          passkeyCaptchaRejectRef.current?.(new Error(text.captchaRequired))
        },
      })
      setIsPasskeyCaptchaReady(true)
    }

    const existingScript = document.getElementById('hcaptcha-script') as HTMLScriptElement | null
    const browserWindow = window as Window & { [HCAPTCHA_READY_CALLBACK]?: () => void }

    browserWindow[HCAPTCHA_READY_CALLBACK] = renderPasskeyCaptcha

    if (getHCaptcha()) {
      renderPasskeyCaptcha()
    } else if (existingScript) {
      existingScript.addEventListener('load', renderPasskeyCaptcha, { once: true })
    } else {
      const script = document.createElement('script')
      script.id = 'hcaptcha-script'
      script.src = `https://js.hcaptcha.com/1/api.js?render=explicit&onload=${HCAPTCHA_READY_CALLBACK}`
      script.async = true
      script.defer = true
      document.body.appendChild(script)
    }

    return () => {
      cancelled = true
      setIsPasskeyCaptchaReady(false)
      resetPasskeyCaptcha()

      const hcaptcha = getHCaptcha()

      if (hcaptcha && passkeyCaptchaWidgetId.current) {
        try {
          hcaptcha.remove?.(passkeyCaptchaWidgetId.current)
        } catch {
          hcaptcha.reset(passkeyCaptchaWidgetId.current)
        }
      }

      passkeyCaptchaWidgetId.current = null

      if (browserWindow[HCAPTCHA_READY_CALLBACK] === renderPasskeyCaptcha) {
        delete browserWindow[HCAPTCHA_READY_CALLBACK]
      }
    }
  }, [activeView, authMode, authStep, isRecoveryMode, profile, text.captchaRequired])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isSearchOpen && !search && !selectedSessionDate && !isClubSearchOpen && !clubSearch) return

    function closeSearchOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node
      const clickedSearch = searchShellRef.current?.contains(target)
      const clickedCalendar = dayStripRef.current?.contains(target)
      const clickedClubSearch = clubSearchShellRef.current?.contains(target)

      if (clickedSearch || clickedCalendar || clickedClubSearch) return

      if (isSearchOpen || search || selectedSessionDate) {
        setSearch('')
        setSelectedSessionDate('')
        setIsSearchOpen(false)
      }

      if (isClubSearchOpen || clubSearch) {
        setClubSearch('')
        setIsClubSearchOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeSearchOnOutsideClick)

    return () => {
      document.removeEventListener('pointerdown', closeSearchOnOutsideClick)
    }
  }, [clubSearch, isClubSearchOpen, isSearchOpen, search, selectedSessionDate])

  const getAvailableTimeOptions = useCallback((date: string, duration: number, arenaCount: number, excludeSessionId = '') => {
    if (!date) return []

    const now = new Date()
    const today = localDateString(now)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    const options: Array<{ value: string; label: string; remaining: number }> = []
    const latestStart = CLOSE_MINUTES - duration

    for (let start = OPEN_MINUTES; start <= latestStart; start += TIME_STEP_MINUTES) {
      const end = start + duration

      if (date === today && start <= nowMinutes) continue

      const activeSessionArenas = sessions
        .filter((session) => session.status === 'open' && session.date === date && session.id !== excludeSessionId)
        .filter((session) =>
          rangesOverlap(
            start,
            end,
            timeToMinutes(session.start_time),
            timeToMinutes(session.start_time) + session.duration_minutes
          )
        )
        .reduce((total, session) => total + arenasUsedBySession(session), 0)

      const activeBlockedArenas = blockedTimes
        .filter((blocked) => blocked.date === date)
        .filter((blocked) =>
          rangesOverlap(start, end, timeToMinutes(blocked.start_time), timeToMinutes(blocked.end_time))
        )
        .reduce((total, blocked) => total + blocked.arenas_used, 0)

      const remaining = ARENA_COUNT - activeSessionArenas - activeBlockedArenas

      if (remaining >= arenaCount) {
        options.push({
          value: minutesToTime(start),
          label: `${minutesToTime(start)}-${minutesToTime(end)} (${remaining} ${remaining > 1 ? text.arenasAvailable : text.arenaAvailable})`,
          remaining,
        })
      }
    }

    return options
  }, [blockedTimes, sessions, text.arenaAvailable, text.arenasAvailable])

  const timeOptions = useMemo(() => {
    return getAvailableTimeOptions(sessionDate, sessionDuration, sessionArenaCount)
  }, [getAvailableTimeOptions, sessionArenaCount, sessionDate, sessionDuration])

  const editTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(editSessionDate, editSessionDuration, editSessionArenaCount, editingSessionId)
  }, [editSessionArenaCount, editSessionDate, editSessionDuration, editingSessionId, getAvailableTimeOptions])

  const activeTicketService = selectedTicketService(ticketType)
  const activeTicketMinimumDuration = ticketDurationForPlayers(ticketType, ticketPlayers)
  const activeTicketDuration = Math.min(ticketMaxCustomerDurationMinutes, Math.max(ticketPriceBlockMinutes, ticketDuration))
  const activeTicketArenaCount = ticketArenaCountForPlayers()
  const isTicketDurationBelowRecommended = activeTicketDuration < activeTicketMinimumDuration
  const ticketDurationMessage =
    isTicketDurationBelowRecommended
      ? text.ticketDurationBelowRecommended
      : ticketPlayers > 12
      ? text.ticketDurationMinimum80
      : ticketPlayers > 8
      ? text.ticketDurationMinimum60
      : ticketPlayers > 4
        ? text.ticketDurationMinimum40
        : ''
  const ticketTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(ticketDate, activeTicketDuration, activeTicketArenaCount)
  }, [activeTicketArenaCount, activeTicketDuration, getAvailableTimeOptions, ticketDate])
  const challengeTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(challengeDate, challengeDuration, 1)
  }, [challengeDate, challengeDuration, getAvailableTimeOptions])
  const currentTicketPricing = ticketPricingSummary(ticketType, ticketDate, ticketTime, ticketPlayers, activeTicketDuration)
  const currentTicketUnitPrice = currentTicketPricing.unitPrice
  const ticketVoucherDiscountAmount = Math.max(0, Math.floor(Number(ticketDiscountQuote?.discount_amount ?? 0) || 0))
  const ticketAutomaticDiscountAmount = Math.max(0, Math.floor(Number(ticketAutomaticDiscountQuote?.discount_amount ?? 0) || 0))
  const hasTicketVoucherDiscount = ticketVoucherDiscountAmount > 0 && ticketDiscountCode.trim().length > 0
  const activeTicketDiscountAmount = Math.max(ticketAutomaticDiscountAmount, ticketVoucherDiscountAmount)
  const activeTicketDiscountSource: 'automatic' | 'voucher' = ticketVoucherDiscountAmount > ticketAutomaticDiscountAmount ? 'voucher' : 'automatic'
  const currentTicketPriceBeforeLoyalty = Math.max(0, currentTicketPricing.grossPrice - activeTicketDiscountAmount)
  const ticketLoyaltyBalance = Math.max(
    0,
    Math.floor(Number(ticketLoyaltyRedemption?.loyalty_points_total ?? profile?.loyalty_points_total ?? 0) || 0)
  )
  const ticketLoyaltyRedeemValue = Math.max(0, Math.floor(Number(ticketLoyaltyRedemption?.redeem_value_vnd_per_point ?? 0) || 0))
  const canUseTicketLoyaltyPoints = !hasTicketVoucherDiscount
  const requestedTicketLoyaltyPoints = ticketUseLoyaltyPoints && canUseTicketLoyaltyPoints
    ? Math.max(0, Math.floor(Number(ticketLoyaltyPointsToRedeem) || 0))
    : 0
  const maxTicketLoyaltyPoints = clampTicketLoyaltyRedemption(
    ticketLoyaltyBalance,
    ticketLoyaltyBalance,
    ticketLoyaltyRedeemValue,
    currentTicketPriceBeforeLoyalty
  )
  const appliedTicketLoyaltyPoints = ticketUseLoyaltyPoints && canUseTicketLoyaltyPoints
    ? clampTicketLoyaltyRedemption(
      requestedTicketLoyaltyPoints,
      ticketLoyaltyBalance,
      ticketLoyaltyRedeemValue,
      currentTicketPriceBeforeLoyalty
    )
    : 0
  const ticketLoyaltyDiscountAmount = appliedTicketLoyaltyPoints * ticketLoyaltyRedeemValue
  const currentTicketTotalPrice = Math.max(0, currentTicketPriceBeforeLoyalty - ticketLoyaltyDiscountAmount)
  const estimatedTicketLoyaltyPointsEarned = Math.max(0, Math.floor(Number(ticketLoyaltyEarnQuote?.estimated_points ?? 0) || 0))
  const estimatedTicketLoyaltyReductionValue = Math.max(0, Math.floor(Number(ticketLoyaltyEarnQuote?.estimated_reduction_vnd ?? 0) || 0))
  const gameGuideGames = useMemo(() => {
    if (!gameGuideGameId) return games
    const focusedGame = games.find((game) => game.id === gameGuideGameId)
    if (!focusedGame) return games
    return [focusedGame, ...games.filter((game) => game.id !== gameGuideGameId)]
  }, [gameGuideGameId])
  const effectiveEditTicketDuration = editSessionDuration
  const editTicketPricing = ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, editSessionMaxPlayers, effectiveEditTicketDuration)
  const ticketDurationOptions = useMemo(() => {
    const durationOptions = Array.from(
      { length: Math.floor((ticketMaxCustomerDurationMinutes - ticketPriceBlockMinutes) / ticketPriceBlockMinutes) + 1 },
      (_, index) => ticketPriceBlockMinutes + index * ticketPriceBlockMinutes
    )

    if (!ticketDate) return durationOptions

    return durationOptions.filter((duration) => {
      const options = getAvailableTimeOptions(ticketDate, duration, activeTicketArenaCount)
      if (ticketTime) return options.some((option) => option.value === ticketTime)
      return options.length > 0
    })
  }, [activeTicketArenaCount, getAvailableTimeOptions, ticketDate, ticketTime])
  const ticketPlayerOptions = useMemo(() => {
    return Array.from(
      { length: activeTicketService.maxPlayers - activeTicketService.minPlayers + 1 },
      (_, index) => activeTicketService.minPlayers + index
    )
  }, [activeTicketService.maxPlayers, activeTicketService.minPlayers])

  useEffect(() => {
    return schedulePostEffectStateUpdate(() => {
      if (ticketDurationOptions.length === 0) {
        if (ticketTime) setTicketTime('')
        return
      }

      if (!ticketDurationOptions.includes(activeTicketDuration)) {
        setTicketDuration(ticketDurationOptions[0])
        setTicketTime('')
        setTicketConfirmation(null)
      }
    })
  }, [activeTicketDuration, ticketDurationOptions, ticketTime])

  const ticketDiscountCodeInvalidText = text.ticketDiscountCodeInvalid
  const ticketDiscountCodeAppliedText = text.ticketDiscountCodeApplied
  const ticketDiscountBestReductionText = text.ticketDiscountBestReductionMessage
  const ticketDiscountCodeCheckingText = text.ticketDiscountCodeChecking

  useEffect(() => {
    if (!ticketDate || currentTicketPricing.grossPrice <= 0) {
      return schedulePostEffectStateUpdate(() => setTicketAutomaticDiscountQuote(null))
    }

    let active = true
    void getSupabase()
      .then((client) => client.rpc('ticket_automatic_discount_quote', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
        p_player_count: ticketPlayers,
        p_start_time: ticketTime ? `${ticketTime}:00` : null,
        p_subtotal: currentTicketPricing.grossPrice,
        p_ticket_type: ticketType,
        p_unit_price: currentTicketUnitPrice,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketAutomaticDiscountQuote(null)
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        const discountAmount = Math.max(0, Math.floor(Number(row?.discount_amount ?? 0) || 0))
        setTicketAutomaticDiscountQuote(row && discountAmount > 0
          ? {
            discount_rule_id: String(row.discount_rule_id || ''),
            discount_name: String(row.discount_name || ''),
            discount_amount: discountAmount,
          }
          : null)
      })
      .catch(() => {
        if (active) setTicketAutomaticDiscountQuote(null)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, currentTicketPricing.grossPrice, currentTicketUnitPrice, ticketDate, ticketPlayers, ticketTime, ticketType])

  useEffect(() => {
    const normalizedCode = ticketDiscountCode.trim().toUpperCase()

    if (!normalizedCode) {
      return schedulePostEffectStateUpdate(() => {
        setTicketDiscountQuote(null)
        setTicketDiscountStatus('')
        setIsCheckingTicketDiscount(false)
      })
    }

    let active = true
    const timeoutId = window.setTimeout(() => {
      setIsCheckingTicketDiscount(true)
      void getSupabase()
        .then((client) => client.rpc('ticket_discount_code_quote', {
          p_code: normalizedCode,
          p_booking_date: ticketDate,
          p_game_id: activeTicketService.defaultGame,
          p_player_count: ticketPlayers,
          p_start_time: ticketTime ? `${ticketTime}:00` : null,
          p_subtotal: currentTicketPricing.grossPrice,
          p_ticket_type: ticketType,
          p_unit_price: currentTicketUnitPrice,
        }))
        .then(({ data, error }) => {
          if (!active) return
          if (error) {
            setTicketDiscountQuote(null)
            setTicketDiscountStatus(error.message || ticketDiscountCodeInvalidText)
            return
          }

          const row = Array.isArray(data) ? data[0] : null
          const discountAmount = Math.max(0, Math.floor(Number(row?.discount_amount ?? 0) || 0))
          if (!row || discountAmount <= 0) {
            setTicketDiscountQuote(null)
            setTicketDiscountStatus(ticketDiscountCodeInvalidText)
            return
          }

          setTicketDiscountQuote({
            discount_code: String(row.discount_code || normalizedCode),
            discount_name: String(row.discount_name || ''),
            discount_amount: discountAmount,
          })
          setTicketDiscountStatus(ticketAutomaticDiscountAmount > 0 && discountAmount <= ticketAutomaticDiscountAmount
            ? ticketDiscountBestReductionText
            : ticketDiscountCodeAppliedText.replace('{amount}', formatVnd(discountAmount)))
        })
        .catch(() => {
          if (!active) return
          setTicketDiscountQuote(null)
          setTicketDiscountStatus(ticketDiscountCodeInvalidText)
        })
        .finally(() => {
          if (active) setIsCheckingTicketDiscount(false)
        })
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [activeTicketService.defaultGame, currentTicketPricing.grossPrice, currentTicketUnitPrice, ticketAutomaticDiscountAmount, ticketDate, ticketDiscountBestReductionText, ticketDiscountCode, ticketDiscountCodeAppliedText, ticketDiscountCodeInvalidText, ticketPlayers, ticketTime, ticketType])

  useEffect(() => {
    if (!hasTicketVoucherDiscount || !ticketUseLoyaltyPoints) return undefined
    return schedulePostEffectStateUpdate(() => {
      setTicketUseLoyaltyPoints(false)
      setTicketLoyaltyPointsToRedeem('')
      setTicketStatus(ticketDiscountBestReductionText)
    })
  }, [hasTicketVoucherDiscount, ticketDiscountBestReductionText, ticketUseLoyaltyPoints])

  useEffect(() => {
    if (!ticketUseLoyaltyPoints) return
    if (maxTicketLoyaltyPoints <= 0) {
      return schedulePostEffectStateUpdate(() => {
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
      })
    }

    const requestedPoints = Math.max(0, Math.floor(Number(ticketLoyaltyPointsToRedeem) || 0))
    if (requestedPoints > maxTicketLoyaltyPoints) {
      return schedulePostEffectStateUpdate(() => {
        setTicketLoyaltyPointsToRedeem(String(maxTicketLoyaltyPoints))
      })
    }

    return undefined
  }, [maxTicketLoyaltyPoints, ticketLoyaltyPointsToRedeem, ticketUseLoyaltyPoints])

  const sessionDurationRecommendation = durationRecommendation(sessionMaxPlayers, sessionDuration)
  const editSessionDurationRecommendation = durationRecommendation(editSessionMaxPlayers, editSessionDuration)

function handleSessionDateChange(value: string) {
  setSessionDate(value)
}

  function handleTicketTypeChange(value: TicketType) {
    const service = selectedTicketService(value)
    const nextPlayers = Math.min(service.maxPlayers, Math.max(service.minPlayers, ticketPlayers))
    const nextDuration = Math.max(ticketDurationForPlayers(value, nextPlayers), ticketDuration)
    setTicketType(value)
    setTicketPlayers(nextPlayers)
    setTicketDuration(nextDuration)
    setTicketTime('')
    setTicketConfirmation(null)
    setTicketStatus('')
  }

  function handleTicketPlayersChange(value: number) {
    const nextMinimumDuration = ticketDurationForPlayers(ticketType, value)
    const nextDuration = Math.max(nextMinimumDuration, ticketDuration)
    const nextArenaCount = ticketArenaCountForPlayers()
    const nextTimeOptions = getAvailableTimeOptions(ticketDate, nextDuration, nextArenaCount)
    const keepsSelectedTime = ticketTime && nextTimeOptions.some((option) => option.value === ticketTime)

    setTicketPlayers(value)
    setTicketDuration(nextDuration)
    setTicketConfirmation(null)
    if (!keepsSelectedTime || nextDuration !== activeTicketDuration || nextArenaCount !== activeTicketArenaCount) {
      setTicketTime('')
    }
  }

  function handleTicketDurationChange(value: number) {
    const nextDuration = Math.min(ticketMaxCustomerDurationMinutes, Math.max(ticketPriceBlockMinutes, value))
    const nextTimeOptions = getAvailableTimeOptions(ticketDate, nextDuration, activeTicketArenaCount)
    const keepsSelectedTime = ticketTime && nextTimeOptions.some((option) => option.value === ticketTime)

    setTicketDuration(nextDuration)
    if (!keepsSelectedTime) setTicketTime('')
    setTicketConfirmation(null)
  }

  function handleTicketUseLoyaltyPointsChange(checked: boolean) {
    if (checked && hasTicketVoucherDiscount) {
      setTicketUseLoyaltyPoints(false)
      setTicketLoyaltyPointsToRedeem('')
      setTicketStatus(ticketDiscountBestReductionText)
      return
    }
    setTicketUseLoyaltyPoints(checked)
    setTicketConfirmation(null)
    if (checked) {
      setTicketLoyaltyPointsToRedeem((current) => {
        const requested = Math.max(0, Math.floor(Number(current) || 0))
        const nextPoints = requested > 0 ? Math.min(requested, maxTicketLoyaltyPoints) : maxTicketLoyaltyPoints
        return nextPoints > 0 ? String(nextPoints) : ''
      })
    } else {
      setTicketLoyaltyPointsToRedeem('')
    }
  }

  function handleTicketLoyaltyPointsChange(value: string) {
    const requested = Math.max(0, Math.floor(Number(value) || 0))
    const nextPoints = maxTicketLoyaltyPoints > 0 ? Math.min(requested, maxTicketLoyaltyPoints) : 0
    setTicketLoyaltyPointsToRedeem(value === '' ? '' : String(nextPoints))
    setTicketConfirmation(null)
  }

  function handleTicketDiscountCodeChange(value: string) {
    setTicketDiscountCode(value.toUpperCase())
    setTicketDiscountQuote(null)
    setTicketDiscountStatus('')
    setTicketConfirmation(null)
  }

  useEffect(() => {
    let active = true

    if (!profile || activeView !== 'tickets') {
      return schedulePostEffectStateUpdate(() => {
        setTicketLoyaltyRedemption(null)
        setTicketLoyaltyEarnQuote(null)
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
        setIsLoadingTicketLoyalty(false)
      })
    }

    schedulePostEffectStateUpdate(() => setIsLoadingTicketLoyalty(true))
    void getSupabase()
      .then((client) => client.rpc('ticket_loyalty_redemption_settings', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketLoyaltyRedemption(null)
          setTicketUseLoyaltyPoints(false)
          setTicketLoyaltyPointsToRedeem('')
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        const pointsTotal = Math.max(0, Math.floor(Number(row?.loyalty_points_total ?? profile.loyalty_points_total ?? 0) || 0))
        const redeemValue = Math.max(0, Math.floor(Number(row?.redeem_value_vnd_per_point ?? 0) || 0))
        setTicketLoyaltyRedemption({
          loyalty_points_total: pointsTotal,
          redeem_value_vnd_per_point: redeemValue,
        })
      })
      .catch(() => {
        if (!active) return
        setTicketLoyaltyRedemption(null)
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
      })
      .finally(() => {
        if (active) setIsLoadingTicketLoyalty(false)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, activeView, profile, ticketDate])

  useEffect(() => {
    let active = true

    if (!profile || activeView !== 'tickets') {
      return schedulePostEffectStateUpdate(() => setTicketLoyaltyEarnQuote(null))
    }

    void getSupabase()
      .then((client) => client.rpc('ticket_loyalty_earn_quote', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
        p_paid_total: currentTicketTotalPrice,
        p_player_count: ticketPlayers,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketLoyaltyEarnQuote(null)
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        setTicketLoyaltyEarnQuote({
          estimated_points: Math.max(0, Math.floor(Number(row?.estimated_points ?? 0) || 0)),
          estimated_reduction_vnd: Math.max(0, Math.floor(Number(row?.estimated_reduction_vnd ?? 0) || 0)),
          redeem_value_vnd_per_point: Math.max(0, Math.floor(Number(row?.redeem_value_vnd_per_point ?? 0) || 0)),
        })
      })
      .catch(() => {
        if (active) setTicketLoyaltyEarnQuote(null)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, activeView, currentTicketTotalPrice, profile, ticketDate, ticketPlayers])

  function handleMaxPlayersChange(value: number) {
    setSessionMaxPlayers(value)

    if (value < 8) {
      setSessionArenaCount(1)
    }
  }

  function handleArenaCountChange(value: number) {
    if (value === 2 && sessionMaxPlayers < 8) {
      setSessionMaxPlayers(8)
    }

    setSessionArenaCount(value)
  }

  function handleEditMaxPlayersChange(value: number) {
    setEditSessionMaxPlayers(value)

    if (editBookingType === 'ticket') {
      const nextDuration = ticketDurationForPlayers(editTicketType, value)
      setEditSessionDuration(nextDuration)
      setEditSessionArenaCount(ticketArenaCountForPlayers())
      setEditTicketTotalPrice(String(ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, value, nextDuration).totalPrice))
      return
    }

    if (value < 8) {
      setEditSessionArenaCount(1)
    }
  }

  function handleEditArenaCountChange(value: number) {
    if (editBookingType === 'ticket') {
      setEditSessionArenaCount(ticketArenaCount)
      return
    }

    if (value === 2 && editSessionMaxPlayers < 8) {
      setEditSessionMaxPlayers(8)
    }

    setEditSessionArenaCount(value)
  }

  function durationRecommendation(maxPlayers: number, duration: number) {
    if (maxPlayers > 8 && duration < 60) return text.durationRecommend60
    if (maxPlayers > 4 && duration < 40) return text.durationRecommend40
    return ''
  }

  function handleSessionClubChange(value: string) {
    setSessionClubId(value)
    if (value) {
      setSessionVisibility('public')
      setCreateStatus(text.clubOnlyCreateHint)
    } else if (createStatus === text.clubOnlyCreateHint) {
      setCreateStatus('')
    }
  }

  const calendarWeekDays = useMemo(() => {
    return weekDaysFromStart(calendarWeekStart).map((value) => ({ value, ...formatDayButton(value, language) }))
  }, [calendarWeekStart, language])

  const calendarWeekEnd = addDaysToDateValue(calendarWeekStart, 6)

  const calendarTimeSlots = useMemo(() => {
    return Array.from({ length: Math.floor((CLOSE_MINUTES - OPEN_MINUTES) / TIME_STEP_MINUTES) }, (_, index) => {
      const minutes = OPEN_MINUTES + index * TIME_STEP_MINUTES
      return {
        minutes,
        value: minutesToTime(minutes),
        isHour: minutes % 60 === 0,
      }
    })
  }, [])

  const calendarSessions = useMemo(() => {
    return sortSessionsByStart(
      sessions.filter((session) => session.date >= calendarWeekStart && session.date <= calendarWeekEnd)
    )
  }, [calendarWeekEnd, calendarWeekStart, sessions])

  const calendarAvailableSlotKeys = useMemo(() => {
    const availableKeys = new Set<string>()
    const today = localDateString()
    calendarWeekDays.forEach((day) => {
      if (day.value < today) return
      getAvailableTimeOptions(day.value, TIME_STEP_MINUTES, 1).forEach((option) => {
        availableKeys.add(`${day.value}-${option.value}`)
      })
    })
    return availableKeys
  }, [calendarWeekDays, getAvailableTimeOptions])

  const filteredSessions = useMemo(() => {
    const query = normalizeSearchValue(search)

    return sessions.filter((session) => {
      if (sessionTimeScope === 'upcoming' && !isUpcomingSession(session)) return false
      if (sessionTimeScope === 'past' && !isPastSession(session)) return false
      if (selectedSessionDate && session.date !== selectedSessionDate) return false
      if (!query) return true

      const selectedGameNames = session.game_options
        .map((gameId) => games.find((game) => game.id === gameId)?.title || gameId)
        .join(' ')
      const profileNames = (session.session_participants ?? [])
        .map((participant) => participant.display_name || '')
        .join(' ')
      const haystack = normalizeSearchValue([
        session.name,
        profileNames,
        selectedGameNames,
        session.invite_code || '',
      ].join(' '))

      return haystack.includes(query)
    })
  }, [search, selectedSessionDate, sessionTimeScope, sessions])

  const filteredClubs = useMemo(() => {
    const query = normalizeSearchValue(clubSearch)
    if (!query) return clubs

    return clubs.filter((club) => {
      const memberNames = clubMembers(club)
        .map((member) => member.display_name || '')
        .join(' ')
      const haystack = normalizeSearchValue([
        club.name,
        club.description || '',
        club.visibility,
        memberNames,
      ].join(' '))

      return haystack.includes(query)
    })
  }, [clubSearch, clubs])

  const sessionDayOptions = useMemo(() => {
    const today = new Date()
    const upcomingDays = Array.from({ length: 14 }, (_, index) => {
      const value = localDateString(addDays(today, index))
      return { value, ...formatDayButton(value, language) }
    })
    const scopedSessions = sessions.filter((session) =>
      sessionTimeScope === 'past' ? isPastSession(session) : isUpcomingSession(session)
    )
    const sessionDays = scopedSessions.map((session) => session.date)
    const uniqueDays = Array.from(new Set([
      ...(sessionTimeScope === 'upcoming' ? upcomingDays.map((day) => day.value) : []),
      ...sessionDays,
    ])).sort()

    return uniqueDays.map((value) => {
      const existing = upcomingDays.find((day) => day.value === value)
      return existing || { value, ...formatDayButton(value, language) }
    })
  }, [language, sessionTimeScope, sessions])

  const mySessions = useMemo(() => {
    if (!userId) return []

    return sessions.filter((session) => {
      const isOwner = session.owner_id === userId
      const isParticipant = (session.session_participants ?? []).some((participant) => participant.profile_id === userId)
      return isOwner || isParticipant
    })
  }, [sessions, userId])

  const profileUpcomingSessions = useMemo(() => {
    return mySessions
      .filter((session) => isUpcomingSession(session))
      .sort((a, b) => sessionStartDate(a).getTime() - sessionStartDate(b).getTime())
  }, [mySessions])

  const profilePastSessions = useMemo(() => {
    return mySessions
      .filter((session) => isPastSession(session))
      .sort((a, b) => sessionStartDate(b).getTime() - sessionStartDate(a).getTime())
  }, [mySessions])

  const pendingSessionInvites = useMemo(() => {
    if (!userId) return []

    return sessionInvites
      .filter((invite) => invite.recipient_id === userId && invite.status === 'pending' && sessionForInvite(invite))
      .sort((a, b) => {
        const left = a.created_at ? new Date(a.created_at).getTime() : 0
        const right = b.created_at ? new Date(b.created_at).getTime() : 0
        return right - left || a.id.localeCompare(b.id)
      })
  }, [sessionForInvite, sessionInvites, userId])

  const invitePopupInvite = useMemo(() => {
    if (!invitePopupInviteId) return undefined
    return pendingSessionInvites.find((invite) => invite.id === invitePopupInviteId)
  }, [invitePopupInviteId, pendingSessionInvites])

  const invitePopupSession = invitePopupInvite ? sessionForInvite(invitePopupInvite) : undefined

  const joinedUpcomingSessions = useMemo(() => {
    if (!userId) return []

    return sessions
      .filter((session) =>
        isUpcomingSession(session)
        && (session.session_participants ?? []).some((participant) => participant.profile_id === userId)
      )
      .sort((a, b) => sessionStartDate(a).getTime() - sessionStartDate(b).getTime())
  }, [sessions, userId])

  const sessionReminders = useMemo(() => {
    const now = new Date()

    return joinedUpcomingSessions.map((session) => {
      const start = sessionStartDate(session)
      const diff = start.getTime() - now.getTime()
      const hours = diff / (60 * 60 * 1000)

      if (hours <= 2) return { session, label: text.reminderSoon }
      if (hours <= 24) return { session, label: text.reminderTomorrow }
      return { session, label: text.reminderJoined }
    })
  }, [joinedUpcomingSessions, text.reminderJoined, text.reminderSoon, text.reminderTomorrow])

  const sessionClubOptions = useMemo(() => {
    if (!userId) return []

    return clubs.filter((club) => club.owner_id === userId || clubMembers(club).some((member) => member.profile_id === userId && member.status === 'approved'))
  }, [clubs, userId])

  const selectedClub = useMemo(() => {
    return clubs.find((club) => club.id === selectedClubId)
  }, [clubs, selectedClubId])

  const clubUnlockTarget = useMemo(() => {
    return clubs.find((club) => club.id === clubUnlockTargetId)
  }, [clubUnlockTargetId, clubs])

  const selectedClubMembership = useMemo(() => {
    if (!selectedClub) return undefined
    return clubMembers(selectedClub).find((member) => member.profile_id === userId)
  }, [selectedClub, userId])

  const canSeeSelectedClubPrivateData = canSeeClubPrivateData(selectedClub)

  const selectedClubSessions = useMemo(() => {
    if (!selectedClub || !canSeeSelectedClubPrivateData) return []
    return sessions.filter((session) => {
      if (session.club_id !== selectedClub.id) return false
      return selectedClubSessionScope === 'past' ? isPastSession(session) : isUpcomingSession(session)
    })
  }, [canSeeSelectedClubPrivateData, selectedClub, selectedClubSessionScope, sessions])

  const selectedClubDayOptions = useMemo(() => {
    const uniqueDays = Array.from(new Set(selectedClubSessions.map((session) => session.date))).sort()
    return uniqueDays.map((value) => ({ value, ...formatDayButton(value, language) }))
  }, [language, selectedClubSessions])

  const filteredSelectedClubSessions = useMemo(() => {
    if (!selectedClubDate) return selectedClubSessions
    return selectedClubSessions.filter((session) => session.date === selectedClubDate)
  }, [selectedClubDate, selectedClubSessions])

  const selectedClubApprovedMembers = useMemo(() => {
    return clubMembers(selectedClub).filter((member) => member.status === 'approved')
  }, [selectedClub])

  const selectedClubPendingMembers = useMemo(() => {
    return clubMembers(selectedClub).filter((member) => member.status === 'pending')
  }, [selectedClub])

  useEffect(() => {
    if (!selectedClub) return

    return schedulePostEffectStateUpdate(() => {
      const themeColor = clubTheme(selectedClub)
      setClubEditName(selectedClub.name)
      setClubEditMotto(selectedClub.motto || '')
      setClubEditDescription(selectedClub.description || '')
      setClubEditVisibility(selectedClub.visibility)
      setClubEditThemeColor(themeColor)
      setClubEditThemeColorDraft(themeColor)
      setClubEditDefaultLanguage(isLanguageCode(selectedClub.default_language || '') ? selectedClub.default_language as LanguageCode : language)
      setClubEditRankingCriterion(clubRankingCriterion(selectedClub))
      setClubBannerFile(null)
      setClubBannerPreview('')
    })
  }, [language, selectedClub])

  useEffect(() => {
    if (!selectedClub || selectedClubTab !== 'messages') return
    return schedulePostEffectStateUpdate(() => {
      void loadClubMessagesRef.current(selectedClub)
    })
  }, [selectedClub, selectedClubTab])

  const checkInSession = useMemo(() => {
    if (!checkInTarget) return undefined
    return sessions.find((session) => session.id === checkInTarget.sessionId)
  }, [checkInTarget, sessions])

  const checkInParticipant = useMemo(() => {
    if (!checkInTarget || !checkInSession) return undefined
    return (checkInSession.session_participants ?? []).find((participant) => participant.id === checkInTarget.participantId)
  }, [checkInSession, checkInTarget])
  const normalizedCheckInPaymentSplits = useMemo(() => normalizeParticipantPaymentSplits(checkInPaymentSplits), [checkInPaymentSplits])
  const checkInPaymentTotal = useMemo(() => participantPaymentSplitTotal(normalizedCheckInPaymentSplits), [normalizedCheckInPaymentSplits])

  const allPlayerStats = useMemo(() => {
    const stats = new Map<string, {
      profileId: string
      displayName: string
      avatarUrl: string | null
      avatarEmoji: string | null
      avatarInitials: string | null
      avatarColor: string | null
      avatarTextColor: string | null
      profileMotto: string | null
      sessionsJoined: number
      gamesJoined: number
      wins: number
      bestPerformerCount: number
      baseTotalScore: number
      totalScore: number
      scoreAdjustment: number
      loyaltyPoints?: number
      totalAccuracy: number
      accuracyCount: number
      totalProjectiles: number
      bestEscapeDurationSeconds: number | null
      bestByGame: Map<string, number>
    }>()

    allProfiles.forEach((playerProfile) => {
      const playerAvatar = avatarFields(playerProfile)
      stats.set(playerProfile.id, {
        profileId: playerProfile.id,
        displayName: compactDisplayName(displayName(playerProfile), text.player),
        avatarUrl: playerAvatar.avatar_url,
        avatarEmoji: playerAvatar.avatar_emoji,
        avatarInitials: playerAvatar.avatar_initials,
        avatarColor: playerAvatar.avatar_color,
        avatarTextColor: playerAvatar.avatar_text_color,
        profileMotto: playerProfile.profile_motto || null,
        sessionsJoined: 0,
        gamesJoined: 0,
        wins: 0,
        bestPerformerCount: 0,
        baseTotalScore: 0,
        totalScore: 0,
        scoreAdjustment: 0,
        loyaltyPoints: Math.max(0, Math.floor(Number(playerProfile.loyalty_points_total ?? 0) || 0)),
        totalAccuracy: 0,
        accuracyCount: 0,
        totalProjectiles: 0,
        bestEscapeDurationSeconds: null,
        bestByGame: new Map<string, number>(),
      })
    })

    sessions.forEach((session) => {
      const bestPerformer = sessionBestPerformer(session)

      ;(session.session_participants ?? []).forEach((participant) => {
        const current = stats.get(participant.profile_id) ?? {
          profileId: participant.profile_id,
          displayName: compactDisplayName(participant.display_name, text.player),
          avatarUrl: participant.avatar_url,
          avatarEmoji: participant.avatar_emoji || null,
          avatarInitials: participant.avatar_initials || null,
          avatarColor: participant.avatar_color || null,
          avatarTextColor: participant.avatar_text_color || null,
          profileMotto: participant.profile_motto || null,
          sessionsJoined: 0,
          gamesJoined: 0,
          wins: 0,
          bestPerformerCount: 0,
          baseTotalScore: 0,
          totalScore: 0,
          scoreAdjustment: 0,
          loyaltyPoints: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          bestEscapeDurationSeconds: null,
          bestByGame: new Map<string, number>(),
        }

        current.displayName = compactDisplayName(participant.display_name, current.displayName)
        current.avatarUrl = participant.avatar_url || current.avatarUrl
        current.avatarEmoji = participant.avatar_emoji || current.avatarEmoji
        current.avatarInitials = participant.avatar_initials || current.avatarInitials
        current.avatarColor = participant.avatar_color || current.avatarColor
        current.avatarTextColor = participant.avatar_text_color || current.avatarTextColor
        current.profileMotto = participant.profile_motto || current.profileMotto
        current.sessionsJoined += 1
        if (participant.checked_in) current.gamesJoined += 1
        if (participant.placement === 1) current.wins += 1

        const numericScore = participantScore(participant)
        if (numericScore !== null) {
          current.baseTotalScore += numericScore
          if (bestPerformer?.participant.id === participant.id) current.bestPerformerCount += 1

          session.game_options.forEach((gameId) => {
            const game = games.find((item) => item.id === gameId)
            const previous = current.bestByGame.get(gameId)
            const isEscape = game?.category === 'Escape'

            if (previous === undefined || (isEscape ? numericScore < previous : numericScore > previous)) {
              current.bestByGame.set(gameId, numericScore)
            }
          })
        }

        const accuracy = Number(participant.accuracy_percent)
        if (Number.isFinite(accuracy)) {
          current.totalAccuracy += accuracy
          current.accuracyCount += 1
        }

        const projectiles = Number(participant.projectiles_fired)
        if (Number.isFinite(projectiles)) {
          current.totalProjectiles += projectiles
        }

        const escapeDuration = Number(participant.escape_duration_seconds)
        if (isEscapeSession(session) && Number.isFinite(escapeDuration) && escapeDuration > 0) {
          current.bestEscapeDurationSeconds = current.bestEscapeDurationSeconds === null
            ? escapeDuration
            : Math.min(current.bestEscapeDurationSeconds, escapeDuration)
        }

        stats.set(participant.profile_id, current)
      })
    })

    return Array.from(stats.values())
      .map((item) => ({
        ...item,
        scoreAdjustment: profileScoreAdjustments[item.profileId] ?? 0,
        totalScore: item.baseTotalScore + (profileScoreAdjustments[item.profileId] ?? 0),
        averageAccuracy: item.accuracyCount > 0 ? item.totalAccuracy / item.accuracyCount : null,
        reliabilityScore: percentValue(item.gamesJoined, item.sessionsJoined),
        bestByGame: Array.from(item.bestByGame.entries()).map(([gameId, score]) => ({
          game: games.find((game) => game.id === gameId)?.title || gameId,
          score,
        })),
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
  }, [allProfiles, profileScoreAdjustments, sessions, text.player])

  const leaderboardPlayerStats = leaderboardLoadedRef.current ? leaderboardPlayers : allPlayerStats
  const currentProfileAvatar = profile ? avatarFields(profile) : null

  const playerStats = leaderboardPlayerStats.find((item) => item.profileId === userId) ?? (currentUserRankPlayer?.profileId === userId ? currentUserRankPlayer : null) ?? {
    profileId: userId,
    displayName: displayName(profile),
    avatarUrl: currentProfileAvatar?.avatar_url || null,
    avatarEmoji: currentProfileAvatar?.avatar_emoji || null,
    avatarInitials: currentProfileAvatar?.avatar_initials || null,
    avatarColor: currentProfileAvatar?.avatar_color || null,
    avatarTextColor: currentProfileAvatar?.avatar_text_color || null,
    profileMotto: profile?.profile_motto || null,
    sessionsJoined: 0,
    gamesJoined: 0,
    wins: 0,
    bestPerformerCount: 0,
    baseTotalScore: 0,
    totalScore: profileScoreAdjustments[userId] ?? 0,
    scoreAdjustment: profileScoreAdjustments[userId] ?? 0,
    loyaltyPoints: Math.max(0, Math.floor(Number(profile?.loyalty_points_total ?? 0) || 0)),
    totalAccuracy: 0,
    accuracyCount: 0,
    totalProjectiles: 0,
    averageAccuracy: null,
    reliabilityScore: 0,
    bestEscapeDurationSeconds: null,
    bestByGame: [],
  }
  const canShareCurrentUserStats = Boolean(profile && hasShareablePlayerStats(playerStats))
  const currentUserStatsShared = sharedKey === 'stats'

  const isAdmin = Boolean(isAdminRole(profile?.role) || isAdminEmail(profile?.email) || isAdminEmail(authEmail))
  const staffAccessRank = profile
    ? Math.max(staffConsoleRank(profile.role, profile.email), staffConsoleRank(profile.role, authEmail))
    : 0
  const canAccessStaffConsole = Boolean(profile && staffAccessRank >= 20)
  const canStaffExpandTicketSessions = Boolean(profile && staffAccessRank >= 50)
  const selectedClubHallId = selectedClub?.id ?? ''
  const selectedClubHallRankingCriterion = selectedClub?.ranking_criterion ?? null

  useEffect(() => {
    if (!selectedClubHallId || selectedClubTab !== 'hall') return

    const nextQuery = {
      ...initialLeaderboardQuery(),
      clubId: selectedClubHallId,
      criterion: isLeaderboardCriterion(selectedClubHallRankingCriterion) ? selectedClubHallRankingCriterion : 'totalScore',
    }
    leaderboardQueryRef.current = nextQuery
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPlayersRef.current(nextQuery, 0, 'replace', userId)
  }, [selectedClubHallId, selectedClubHallRankingCriterion, selectedClubTab, userId])

  const topPlayer = leaderboardPlayerStats[0]
  const crownedTopPlayer = topPlayer && topPlayer.totalScore > 0 ? topPlayer : undefined
  const crownedTopPlayerId = crownedTopPlayer?.profileId ?? ''
  const crownedTopPlayerScore = crownedTopPlayer?.totalScore ?? 0
  const selectedPlayerStatsFromLoadedData = leaderboardPlayerStats.find((item) => item.profileId === selectedPlayerId)
    ?? (currentUserRankPlayer?.profileId === selectedPlayerId ? currentUserRankPlayer : undefined)
  const selectedPlayerStats = selectedPlayerStatsFromLoadedData
    ?? (selectedPlayerStatsOverride?.profileId === selectedPlayerId ? selectedPlayerStatsOverride : undefined)
  useEffect(() => {
    if (!selectedPlayerId || selectedPlayerStatsFromLoadedData || selectedPlayerStatsFetchedRef.current.has(selectedPlayerId)) return
    void loadSelectedPlayerStats(selectedPlayerId)
  }, [loadSelectedPlayerStats, selectedPlayerId, selectedPlayerStatsFromLoadedData])

  const selectedPlayerSessionContext = useMemo(() => {
    if (!selectedPlayerId || !selectedPlayerSessionId) return null

    const session = sessions.find((item) => item.id === selectedPlayerSessionId)
    const participant = session?.session_participants?.find((item) => item.profile_id === selectedPlayerId)
    if (!session || !participant) return null

    return {
      session,
      participant,
      score: participantScore(participant),
      isBestPerformer: isBestSessionPerformer(session, participant),
    }
  }, [selectedPlayerId, selectedPlayerSessionId, sessions])

  const selectedPlayerManageContext = useMemo(() => {
    if (!selectedPlayerId) return null

    const candidateSessions = selectedPlayerSessionId
      ? sessions.filter((session) => session.id === selectedPlayerSessionId)
      : sessions

    for (const session of candidateSessions) {
      const participant = (session.session_participants ?? []).find((item) => item.profile_id === selectedPlayerId)
      const canEditSessionResult = Boolean(
        userId
        && (
          isAdmin
          || session.owner_id === userId
          || tournamentData.editors.some((editor) => editor.session_id === session.id && editor.profile_id === userId)
        )
      )
      if (participant && canEditSessionResult) return { session, participant }
    }

    return null
  }, [selectedPlayerId, selectedPlayerSessionId, sessions, userId, isAdmin, tournamentData.editors])
  const selectedPlayerProfile = useMemo(() => {
    if (!selectedPlayerId) return undefined

    let visibleAvatar: string | null = null
    let visibleEmoji: string | null = null
    let visibleInitials: string | null = null
    let visibleColor: string | null = null
    let visibleTextColor: string | null = null
    let visibleMotto: string | null = null
    let visibleName = ''

    if (selectedPlayerId === userId && profile) {
      const profileAvatar = avatarFields(profile)
      visibleAvatar = profileAvatar.avatar_url || visibleAvatar
      visibleEmoji = profileAvatar.avatar_emoji || visibleEmoji
      visibleInitials = profileAvatar.avatar_initials || visibleInitials
      visibleColor = profileAvatar.avatar_color || visibleColor
      visibleTextColor = profileAvatar.avatar_text_color || visibleTextColor
      visibleMotto = profile.profile_motto || visibleMotto
      visibleName = displayName(profile) || visibleName
    }

    for (const session of sessions) {
      const participant = (session.session_participants ?? []).find((item) => item.profile_id === selectedPlayerId)
      if (participant) {
        visibleAvatar = participant.avatar_url || visibleAvatar
        visibleEmoji = participant.avatar_emoji || visibleEmoji
        visibleInitials = participant.avatar_initials || visibleInitials
        visibleColor = participant.avatar_color || visibleColor
        visibleTextColor = participant.avatar_text_color || visibleTextColor
        visibleMotto = participant.profile_motto || visibleMotto
        visibleName = compactDisplayName(participant.display_name, visibleName || text.player)
      }
    }

    for (const club of clubs) {
      const member = clubMembers(club).find((item) => item.profile_id === selectedPlayerId)
      if (member) {
        visibleAvatar = member.avatar_url || visibleAvatar
        visibleEmoji = member.avatar_emoji || visibleEmoji
        visibleInitials = member.avatar_initials || visibleInitials
        visibleColor = member.avatar_color || visibleColor
        visibleTextColor = member.avatar_text_color || visibleTextColor
        visibleMotto = member.profile_motto || visibleMotto
        visibleName = compactDisplayName(member.display_name, visibleName || text.player)
      }
    }

    if (selectedPlayerStats) {
      if (selectedPlayerId === userId && profile) {
        const profileAvatar = avatarFields(profile)
        return {
          ...selectedPlayerStats,
          displayName: compactDisplayName(displayName(profile) || selectedPlayerStats.displayName || visibleName, text.player),
          avatarUrl: profileAvatar.avatar_url,
          avatarEmoji: profileAvatar.avatar_emoji,
          avatarInitials: profileAvatar.avatar_initials,
          avatarColor: profileAvatar.avatar_color,
          avatarTextColor: profileAvatar.avatar_text_color,
          profileMotto: profile.profile_motto || null,
          loyaltyPoints: Math.max(0, Math.floor(Number(profile.loyalty_points_total ?? 0) || 0)),
        }
      }

      return {
        ...selectedPlayerStats,
        displayName: compactDisplayName(selectedPlayerStats.displayName || visibleName, text.player),
        avatarUrl: selectedPlayerStats.avatarUrl || visibleAvatar,
        avatarEmoji: selectedPlayerStats.avatarEmoji || visibleEmoji,
        avatarInitials: selectedPlayerStats.avatarInitials || visibleInitials,
        avatarColor: selectedPlayerStats.avatarColor || visibleColor,
        avatarTextColor: selectedPlayerStats.avatarTextColor || visibleTextColor,
        profileMotto: selectedPlayerStats.profileMotto || visibleMotto,
      }
    }

    if (selectedPlayerId === userId && profile) {
      const profileAvatar = avatarFields(profile)
      return {
        profileId: profile.id,
        displayName: compactDisplayName(displayName(profile), text.player),
        avatarUrl: profileAvatar.avatar_url,
        avatarEmoji: profileAvatar.avatar_emoji,
        avatarInitials: profileAvatar.avatar_initials,
        avatarColor: profileAvatar.avatar_color,
        avatarTextColor: profileAvatar.avatar_text_color,
        profileMotto: profile.profile_motto || null,
        sessionsJoined: 0,
        gamesJoined: 0,
        wins: 0,
        bestPerformerCount: 0,
        baseTotalScore: 0,
        totalScore: profileScoreAdjustments[profile.id] ?? 0,
        scoreAdjustment: profileScoreAdjustments[profile.id] ?? 0,
        loyaltyPoints: Math.max(0, Math.floor(Number(profile.loyalty_points_total ?? 0) || 0)),
        totalAccuracy: 0,
        accuracyCount: 0,
        totalProjectiles: 0,
        averageAccuracy: null,
        reliabilityScore: 0,
        bestEscapeDurationSeconds: null,
        bestByGame: [],
      }
    }

    for (const session of sessions) {
      const participant = (session.session_participants ?? []).find((item) => item.profile_id === selectedPlayerId)
      if (participant) {
        return {
          profileId: participant.profile_id,
          displayName: compactDisplayName(participant.display_name, text.player),
          avatarUrl: participant.avatar_url,
          avatarEmoji: participant.avatar_emoji || null,
          avatarInitials: participant.avatar_initials || null,
          avatarColor: participant.avatar_color || null,
          avatarTextColor: participant.avatar_text_color || null,
          profileMotto: participant.profile_motto || null,
          sessionsJoined: 0,
          gamesJoined: 0,
          wins: 0,
          bestPerformerCount: 0,
          baseTotalScore: 0,
          totalScore: profileScoreAdjustments[participant.profile_id] ?? 0,
          scoreAdjustment: profileScoreAdjustments[participant.profile_id] ?? 0,
          loyaltyPoints: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          averageAccuracy: null,
          reliabilityScore: 0,
          bestEscapeDurationSeconds: null,
          bestByGame: [],
        }
      }
    }

    for (const club of clubs) {
      const member = clubMembers(club).find((item) => item.profile_id === selectedPlayerId)
      if (member) {
        return {
          profileId: member.profile_id,
          displayName: compactDisplayName(member.display_name, text.player),
          avatarUrl: member.avatar_url,
          avatarEmoji: member.avatar_emoji || null,
          avatarInitials: member.avatar_initials || null,
          avatarColor: member.avatar_color || null,
          avatarTextColor: member.avatar_text_color || null,
          profileMotto: member.profile_motto || null,
          sessionsJoined: 0,
          gamesJoined: 0,
          wins: 0,
          bestPerformerCount: 0,
          baseTotalScore: 0,
          totalScore: profileScoreAdjustments[member.profile_id] ?? 0,
          scoreAdjustment: profileScoreAdjustments[member.profile_id] ?? 0,
          loyaltyPoints: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          averageAccuracy: null,
          reliabilityScore: 0,
          bestEscapeDurationSeconds: null,
          bestByGame: [],
        }
      }
    }

    return undefined
  }, [clubs, profile, profileScoreAdjustments, selectedPlayerId, selectedPlayerStats, sessions, text.player, userId])

  const selectedSessionParticipant = selectedPlayerSessionContext?.participant ?? null
  const selectedSessionEditableParticipant = selectedPlayerManageContext && selectedPlayerSessionContext && selectedPlayerManageContext.session.id === selectedPlayerSessionContext.session.id
    ? selectedPlayerManageContext.participant
    : null
  const selectedPlayerEditableParticipant = selectedSessionEditableParticipant ?? (isAdmin ? selectedPlayerManageContext?.participant ?? null : null)
  const selectedPlayerMetricParticipant = selectedPlayerEditableParticipant ?? selectedSessionParticipant
  const selectedPlayerMetricSession = selectedPlayerEditableParticipant
    ? selectedPlayerManageContext?.session ?? selectedPlayerSessionContext?.session ?? null
    : selectedPlayerSessionContext?.session ?? null
  const selectedPlayerSessionIsEscape = isEscapeSession(selectedPlayerMetricSession)
  const selectedPlayerEscapeDurationSeconds = selectedPlayerMetricParticipant?.escape_duration_seconds ?? null

  function openChallengeForm(player: NonNullable<typeof selectedPlayerProfile>) {
    if (!profile) {
      closePlayerProfile()
      promptLogin()
      return
    }
    if (player.profileId === userId) {
      setChallengeStatus(text.challengeSelfBlocked)
      return
    }

    const contextSession = selectedPlayerSessionContext?.session
    const contextDate = contextSession && !isPastSession(contextSession) ? contextSession.date : localDateString()
    const contextDuration = contextSession ? Math.min(120, Math.max(20, Math.ceil(contextSession.duration_minutes / 20) * 20)) : 20
    const contextGame = contextSession?.confirmed_game_id || contextSession?.game_options?.[0] || 'laser-tag'

    setChallengeTargetId(player.profileId)
    setChallengeGameId(contextGame)
    setChallengeDate(contextDate)
    setChallengeTime('')
    setChallengeDuration(contextDuration)
    setChallengeStatus('')
    void ensureUpcomingSessionsThroughDate(contextDate)
  }

  async function createFriendChallenge(player: NonNullable<typeof selectedPlayerProfile>) {
    if (!profile) {
      closePlayerProfile()
      promptLogin()
      return
    }
    if (player.profileId === userId) {
      setChallengeStatus(text.challengeSelfBlocked)
      return
    }

    if (!challengeDate || !challengeTime || !challengeGameId) {
      setChallengeStatus(text.challengeRequired)
      return
    }

    setIsCreatingChallenge(true)
    setChallengeStatus(text.challengeCreating)

    const { data, error } = await (await getSupabase()).rpc('create_friend_challenge', {
      p_target_profile_id: player.profileId,
      p_date: challengeDate,
      p_start_time: `${challengeTime}:00`,
      p_duration_minutes: challengeDuration,
      p_game_id: challengeGameId,
    })

    if (error) {
      setChallengeStatus(error.message)
      setIsCreatingChallenge(false)
      return
    }

    const sessionId = typeof data === 'object' && data && 'session_id' in data
      ? String((data as { session_id?: unknown }).session_id || '')
      : ''

    await loadSessions({ focusDate: challengeDate })
    await loadNetworkData()
    refreshLeaderboardIfLoaded()
    setIsCreatingChallenge(false)
    setChallengeTargetId('')
    setChallengeTime('')
    setChallengeStatus(text.challengeCreated)
    if (sessionId) {
      setExpandedSessions((current) => ({ ...current, [sessionId]: true }))
      void loadSessionDetail(sessionId)
      setSessionTimeScope('upcoming')
      setActiveView('sessions')
      window.setTimeout(() => {
        document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
    }
  }

  async function updateSelectedSessionMetric(metric: 'session' | 'accuracy' | 'projectiles' | 'escapeDuration', value: string) {
    const participant = selectedPlayerEditableParticipant
    if (!participant) return

    await updateParticipantResult(
      participant.id,
      metric === 'session' ? value : participant.score ?? '',
      participant.placement ?? '',
      metric === 'accuracy' ? value : participant.accuracy_percent ?? '',
      metric === 'projectiles' ? value : participant.projectiles_fired ?? '',
      metric === 'escapeDuration' ? value : undefined
    )
    setSelectedPlayerScoreEdit(null)
  }

  function renderTotalScoreControl(playerStats: NonNullable<typeof selectedPlayerProfile>) {
    if (selectedPlayerScoreEdit === 'total' && isAdmin) {
      return (
        <input
          aria-label={text.adminTotalScore}
          autoFocus
          className="inline-score-input compact-stat-input"
          defaultValue={playerStats.totalScore}
          inputMode="numeric"
          onBlur={async (event) => {
            await updateProfileTotalScore(playerStats.profileId, event.target.value, playerStats.baseTotalScore)
            setSelectedPlayerScoreEdit(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setSelectedPlayerScoreEdit(null)
          }}
        />
      )
    }

    return (
      <button
        aria-label={text.adminTotalScore}
        className={isAdmin ? 'score-value editable compact-stat-value' : 'score-value compact-stat-value'}
        disabled={!isAdmin}
        type="button"
        onClick={() => setSelectedPlayerScoreEdit('total')}
      >
        {playerStats.totalScore}
      </button>
    )
  }

  function renderSessionMetricControl(
    metric: 'session' | 'accuracy' | 'projectiles' | 'escapeDuration',
    value: number | null | undefined,
    ariaLabel: string,
    suffix = ''
  ) {
    const editable = Boolean(selectedPlayerEditableParticipant)
    const isEscapeDurationMetric = metric === 'escapeDuration'
    const displayValue = isEscapeDurationMetric
      ? formatSpeedrunDuration(value)
      : value === null || value === undefined ? '-' : `${value}${suffix}`

    if (selectedPlayerScoreEdit === metric && selectedPlayerEditableParticipant) {
      return (
        <input
          aria-label={ariaLabel}
          autoFocus
          className="inline-score-input compact-stat-input"
          defaultValue={isEscapeDurationMetric ? (value ? formatSpeedrunDuration(value) : '') : value ?? ''}
          inputMode={isEscapeDurationMetric ? 'text' : 'numeric'}
          placeholder={isEscapeDurationMetric ? text.escapeDurationPlaceholder : undefined}
          onBlur={async (event) => {
            await updateSelectedSessionMetric(metric, event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') setSelectedPlayerScoreEdit(null)
          }}
        />
      )
    }

    return (
      <button
        aria-label={ariaLabel}
        className={editable ? 'score-value editable compact-stat-value' : 'score-value compact-stat-value'}
        disabled={!editable}
        type="button"
        onClick={() => setSelectedPlayerScoreEdit(metric)}
      >
        {displayValue}
      </button>
    )
  }

  function renderTariffTrigger(extraClassName = '') {
    return (
      <button className={`session-tariff-link ${extraClassName}`.trim()} type="button" onClick={() => setTariffPaymentOpen(true)}>
        {text.sessionTariffTitle}
      </button>
    )
  }

  async function ensureStaffGameGuidesLoaded() {
    if (staffGameGuidesLoadedRef.current || staffGameGuidesLoadingRef.current) return

    staffGameGuidesLoadingRef.current = true
    const client = await getSupabase()
    const { data, error } = await client
      .from('staff_games')
      .select('slug, guide_language, guide_summary, guide_rules, guide_tips')
      .eq('active', true)

    staffGameGuidesLoadingRef.current = false
    staffGameGuidesLoadedRef.current = true

    if (error || !data) return

    const knownGameIds = new Set(games.map((game) => game.id))
    const guidesByGame = ((data ?? []) as StaffGameGuide[]).reduce<Partial<Record<GameId, StaffGameGuide>>>((guides, guide) => {
      if (knownGameIds.has(guide.slug as GameId)) {
        guides[guide.slug as GameId] = guide
      }
      return guides
    }, {})

    setStaffGameGuides(guidesByGame)
  }

  function openGameGuide(gameId?: GameId | null) {
    setGameGuideGameId(gameId || null)
    setGameGuideOpen(true)
    void ensureStaffGameGuidesLoaded()
  }

  function renderGameGuideTrigger(gameId?: GameId | null, extraClassName = '') {
    return (
      <button
        className={`game-guide-link ${extraClassName}`.trim()}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          openGameGuide(gameId)
        }}
      >
        {gameId ? text.gameGuideForGame : text.gameGuideOpen}
      </button>
    )
  }

  const playerProfileStats = selectedPlayerProfile ? [
    selectedPlayerSessionContext
      ? {
          key: 'score',
          className: 'score-stat-card',
          value: (
            <>
              <span className="stat-label">{sessionScoreText}</span>
              {renderSessionMetricControl('session', selectedPlayerSessionContext.score, text.score)}
              <span className="stat-subline">
                <span>{text.totalScore}</span>
                {renderTotalScoreControl(selectedPlayerProfile)}
              </span>
              {selectedPlayerSessionContext.isBestPerformer && <small className="best-performer-label compact-best-label">{bestPerformerText}</small>}
            </>
          ),
        }
      : {
          key: 'score',
          className: 'score-stat-card',
          value: (
            <>
              <span className="stat-label">{text.totalScore}</span>
              {renderTotalScoreControl(selectedPlayerProfile)}
            </>
          ),
        },
    { key: 'loyalty-points', value: <><span className="stat-label">{text.loyaltyPoints}</span><strong>{selectedPlayerProfile.loyaltyPoints ?? 0}</strong></> },
    selectedPlayerSessionIsEscape && selectedPlayerMetricParticipant
      ? {
          key: 'escape-time',
          className: 'editable-stat-card split-stat-card',
          value: (
            <>
              <span className="stat-label">{escapeSessionTimeText}</span>
              {renderSessionMetricControl('escapeDuration', selectedPlayerEscapeDurationSeconds, text.escapeSessionTime)}
              <span className="stat-subline">
                <span>{escapeBestTimeText}</span>
                <strong>{formatSpeedrunDuration(selectedPlayerProfile.bestEscapeDurationSeconds)}</strong>
              </span>
            </>
          ),
        }
      : {
          key: 'escape-time',
          value: (
            <>
              <span className="stat-label">{escapeBestTimeText}</span>
              <strong>{formatSpeedrunDuration(selectedPlayerProfile.bestEscapeDurationSeconds)}</strong>
            </>
          ),
        },
    selectedPlayerMetricParticipant
      ? {
          key: 'accuracy',
          className: 'editable-stat-card split-stat-card',
          value: (
            <>
              <span className="stat-label">{text.accuracy}</span>
              {renderSessionMetricControl('accuracy', selectedPlayerMetricParticipant.accuracy_percent, text.accuracy, '%')}
              <span className="stat-subline">
                <span>{averageAccuracyText}</span>
                <strong>{formatWholePercent(selectedPlayerProfile.averageAccuracy)}</strong>
              </span>
            </>
          ),
        }
      : { key: 'accuracy', value: <><span className="stat-label">{text.accuracy}</span><strong>{formatWholePercent(selectedPlayerProfile.averageAccuracy)}</strong></> },
    selectedPlayerMetricParticipant
      ? {
          key: 'projectiles',
          className: 'editable-stat-card split-stat-card',
          value: (
            <>
              <span className="stat-label">{text.projectiles}</span>
              {renderSessionMetricControl('projectiles', selectedPlayerMetricParticipant.projectiles_fired, text.projectiles)}
              <span className="stat-subline">
                <span>{totalShotsText}</span>
                <strong>{selectedPlayerProfile.totalProjectiles}</strong>
              </span>
            </>
          ),
        }
      : { key: 'projectiles', value: <><span className="stat-label">{text.projectiles}</span><strong>{selectedPlayerProfile.totalProjectiles}</strong></> },
    { key: 'games', value: <>{selectedPlayerProfile.gamesJoined} {text.gamesCheckedIn}</> },
    { key: 'wins', value: <>{selectedPlayerProfile.wins} {text.wins}</> },
    { key: 'best-performer', value: <>{selectedPlayerProfile.bestPerformerCount} {bestPerformerCountText}</> },
  ] : []

  function renderChallengeControls(player: NonNullable<typeof selectedPlayerProfile>) {
    if (player.profileId === userId) return null

    const isOpen = challengeTargetId === player.profileId
    const sentChallenge = sessionInvites.find((invite) => {
      const invitedSession = sessionForInvite(invite)
      return invite.inviter_id === userId
        && invite.recipient_id === player.profileId
        && invite.status === 'pending'
        && invitedSession
        && isChallengeSession(invitedSession)
    })

    if (!isOpen) {
      return (
        <div className="challenge-card compact-challenge-card">
          <button className="primary small-button challenge-button" type="button" onClick={() => openChallengeForm(player)}>
            {text.challengeFriend}
          </button>
          {sentChallenge && <span className="challenge-sent-pill">{text.challengePending}</span>}
        </div>
      )
    }

    const selectedGame = games.find((game) => game.id === challengeGameId) || games[0]

    return (
      <div className="challenge-card">
        <div className="challenge-card-head">
          <div>
            <strong>{text.challengeFriendTitle}</strong>
            <span>{text.challengeFriendHint}</span>
          </div>
          <button className="secondary small-button" type="button" onClick={() => setChallengeTargetId('')}>
            {text.close}
          </button>
        </div>
        <div className="challenge-form-grid">
          <label>
            <span>{text.playedGame}</span>
            <select value={challengeGameId} onChange={(event) => setChallengeGameId(event.target.value as GameId)}>
              {games.map((game) => (
                <option key={game.id} value={game.id}>{game.title}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{text.date}</span>
            <ShortDateInput
              ariaLabel={text.date}
              language={language}
              onChange={(value) => {
                setChallengeDate(value)
                setChallengeTime('')
              }}
              placeholder={text.chooseDate}
              value={challengeDate}
            />
          </label>
          <label>
            <span>{text.availableTime}</span>
            <select value={challengeTime} onChange={(event) => setChallengeTime(event.target.value)}>
              <option value="">{text.chooseTime}</option>
              {challengeTimeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{text.duration}</span>
            <select value={challengeDuration} onChange={(event) => {
              setChallengeDuration(Number(event.target.value))
              setChallengeTime('')
            }}>
              {[20, 40, 60, 80, 100, 120].map((duration) => (
                <option key={duration} value={duration}>{duration} min</option>
              ))}
            </select>
          </label>
        </div>
        <p className="challenge-summary">
          {selectedGame.title} · {challengeDate ? formatShortDate(challengeDate, language) : text.chooseDate}
          {challengeTime ? ` · ${challengeTime}` : ''}
        </p>
        <button
          className={isCreatingChallenge ? 'primary create-button loading' : 'primary create-button'}
          disabled={isCreatingChallenge}
          type="button"
          onClick={() => createFriendChallenge(player)}
        >
          {isCreatingChallenge ? text.challengeCreating : text.sendChallenge}
        </button>
        {challengeStatus && <p className="notice compact-notice">{challengeStatus}</p>}
      </div>
    )
  }

  useEffect(() => {
    return schedulePostEffectStateUpdate(() => {
      if (!checkInParticipant) {
        setCheckInPaymentSplits([newParticipantPaymentSplit('cash')])
        return
      }

      setCheckInPaymentSplits(paymentSplitsFromParticipant(checkInParticipant))
    })
  }, [checkInParticipant])

  useEffect(() => {
    if (!userId || !canUseWebPush() || Notification.permission !== 'granted') {
      return schedulePostEffectStateUpdate(() => setIsPushSubscribed(false))
    }

    let active = true

    registerReminderServiceWorker()
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setIsPushSubscribed(Boolean(subscription))
      })
      .catch(() => {
        if (active) setIsPushSubscribed(false)
      })

    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

    const now = Date.now()
    const timers: number[] = []

    joinedUpcomingSessions.forEach((session) => {
      const start = sessionStartDate(session).getTime()
      ;[
        { key: '24h', delay: start - 24 * 60 * 60 * 1000 - now, label: text.reminderTomorrow },
        { key: '2h', delay: start - 2 * 60 * 60 * 1000 - now, label: text.reminderSoon },
      ].forEach((reminder) => {
        const reminderKey = `${session.id}-${reminder.key}`
        if (notifiedReminderKeys.current.has(reminderKey)) return

        if (reminder.delay <= 0 && reminder.delay > -10 * 60 * 1000) {
          notifiedReminderKeys.current.add(reminderKey)
          notifySessionRef.current(session, reminder.label)
          return
        }

        if (reminder.delay > 0 && reminder.delay < 24 * 60 * 60 * 1000) {
          const timer = window.setTimeout(() => {
            notifiedReminderKeys.current.add(reminderKey)
            notifySessionRef.current(session, reminder.label)
          }, reminder.delay)
          timers.push(timer)
        }
      })
    })

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [joinedUpcomingSessions, language, text.reminderSoon, text.reminderTomorrow])

  useEffect(() => {
    if (typeof window === 'undefined' || !userId || pendingSessionInvites.length === 0) return

    const storageKey = `vrena-seen-session-invites-${userId}`
    let seenInviteIds: string[] = []

    try {
      const stored = window.localStorage.getItem(storageKey)
      seenInviteIds = stored ? JSON.parse(stored) : []
    } catch {
      seenInviteIds = []
    }

    const seen = new Set(seenInviteIds)
    const freshInvite = pendingSessionInvites.find((invite) => !seen.has(invite.id))
    if (!freshInvite) return

    const session = sessionForInvite(freshInvite)
    seen.add(freshInvite.id)
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(seen).slice(-80)))

    return schedulePostEffectStateUpdate(() => {
      setInvitePopupInviteId(freshInvite.id)

      if (session) {
        notifyInviteRef.current(session)
        downloadSessionCalendar(session)
      }
    })
  }, [pendingSessionInvites, sessionForInvite, userId])

  useEffect(() => {
    if (typeof window === 'undefined' || !profile || !userId || !profileBirthday || !isBirthdayToday(profileBirthday)) return

    const storageKey = `vrena-birthday-popup-${userId}-${localDateString()}`

    try {
      if (window.localStorage.getItem(storageKey)) return
      window.localStorage.setItem(storageKey, 'seen')
    } catch {
      // If localStorage is unavailable, still show the one-time in-memory popup for this mount.
    }

    return schedulePostEffectStateUpdate(() => setBirthdayPopupOpen(true))
  }, [profile, profileBirthday, userId])

  useEffect(() => {
    if (!profile || !crownedTopPlayerId || crownedTopPlayerId !== userId) {
      return schedulePostEffectStateUpdate(() => setChampionLoginOpen(false))
    }
    const storageKey = `vrena-crown-login:${userId}:${crownedTopPlayerScore}`
    const alreadyShown = window.sessionStorage.getItem(storageKey)
    if (alreadyShown === 'shown') return
    window.sessionStorage.setItem(storageKey, 'shown')
    return schedulePostEffectStateUpdate(() => setChampionLoginOpen(true))
  }, [crownedTopPlayerId, crownedTopPlayerScore, profile, userId])

  useEffect(() => {
    const query = tournamentEditorEmail.trim()
    if (query.length < 2) {
      return schedulePostEffectStateUpdate(() => setTournamentEditorResults([]))
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      const safe = query.replace(/[%_,]/g, '')
      const { data } = await (await getSupabase()).rpc('public_profile_search', {
        p_search: safe,
        p_limit: 6,
      })

      if (!cancelled) setTournamentEditorResults((data ?? []) as Profile[])
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [tournamentEditorEmail])

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase()
    if (!query) return countries

    return countries.filter((country) =>
      `${country.code} ${country.name}`.toLowerCase().includes(query)
    )
  }, [countrySearch])

  function canManageSession(session: Session) {
    return Boolean(
      userId
      && (
        session.owner_id === userId
        || isAdmin
        || tournamentData.editors.some((editor) => editor.session_id === session.id && editor.profile_id === userId)
      )
    )
  }

  function canEditParticipantResult(session: Session) {
    if (!userId) return false
    if (isAdmin) return true

    return Boolean(
      session.owner_id === userId
      || tournamentData.editors.some((editor) => editor.session_id === session.id && editor.profile_id === userId)
    )
  }

  function isSessionCreator(session: Session) {
    return Boolean(userId && (session.owner_id === userId || isAdmin))
  }

  function participantName(session: Session, participantId: string | null) {
    if (!participantId) return '-'
    const participant = (session.session_participants ?? []).find((item) => item.id === participantId)
    return compactDisplayName(participant?.display_name, text.player)
  }

  function participantById(session: Session, participantId: string | null) {
    if (!participantId) return null
    return (session.session_participants ?? []).find((item) => item.id === participantId) || null
  }

  function tournamentForSession(sessionId: string) {
    return {
      editors: tournamentData.editors.filter((editor) => editor.session_id === sessionId),
      pools: tournamentData.pools.filter((pool) => pool.session_id === sessionId).sort((a, b) => a.sort_order - b.sort_order),
      poolEntries: tournamentData.poolEntries.filter((entry) => entry.session_id === sessionId),
      matches: tournamentData.matches
        .filter((match) => match.session_id === sessionId)
        .sort((a, b) => a.round - b.round || a.match_number - b.match_number),
      auditLogs: tournamentData.auditLogs.filter((log) => log.session_id === sessionId),
    }
  }

  async function logTournamentAudit(sessionId: string, action: string, oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) {
    await (await getSupabase()).from('tournament_audit_log').insert({
      session_id: sessionId,
      user_id: userId || null,
      action,
      old_value: oldValue,
      new_value: newValue,
    })
  }

  function canEditTournamentSession(session: Session) {
    return Boolean(userId && (session.owner_id === userId || isAdmin || tournamentData.editors.some((editor) => editor.session_id === session.id && editor.profile_id === userId)))
  }

  function isTournamentHelper(session: Session) {
    return Boolean(userId && !isSessionCreator(session) && tournamentData.editors.some((editor) => editor.session_id === session.id && editor.profile_id === userId))
  }

  function tournamentLocked(session: Session) {
    return session.status === 'completed' || Boolean(session.tournament_locked)
  }

  function tournamentRoleHint(session: Session, hasBracket: boolean) {
    if (tournamentLocked(session)) return text.tournamentLockedHint
    if (isSessionCreator(session)) return hasBracket ? text.tournamentHostHint : text.tournamentEmptyHost
    if (isTournamentHelper(session)) return hasBracket ? text.tournamentHelperHint : text.tournamentEmptyHelper
    if (!profile) return hasBracket ? text.tournamentGuestHint : text.tournamentEmptyGuest
    return hasBracket ? text.tournamentPlayerHint : text.tournamentEmptyPlayer
  }

  function poolStandingsForSession(session: Session, pool: TournamentPool) {
    const data = tournamentForSession(session.id)
    return calculatePoolStandings(session, pool, data.poolEntries, data.matches)
  }

  function clubRoleFor(club: Club, profileId = userId): ClubRole {
    if (!profileId) return 'member'
    if (club.owner_id === profileId) return 'owner'
    const member = clubMembers(club).find((item) => item.profile_id === profileId)
    if (member?.status !== 'approved') return 'member'
    return member.role || 'member'
  }

  function clubRoleLabel(role: ClubRole) {
    if (role === 'owner') return text.ownerRole
    if (role === 'admin') return text.adminRole
    if (role === 'moderator') return text.moderatorRole
    return text.memberRole
  }

  function canManageClub(club: Club) {
    const role = clubRoleFor(club)
    return Boolean(userId && (isAdmin || role === 'owner' || role === 'admin'))
  }

  function canModerateClubMembers(club: Club) {
    const role = clubRoleFor(club)
    return Boolean(userId && (isAdmin || role === 'owner' || role === 'admin' || role === 'moderator'))
  }

  function canManageClubMember(club: Club, member: ClubMember) {
    if (!userId) return false
    if (member.profile_id === club.owner_id) return false
    if (isAdmin) return true

    const actorRole = clubRoleFor(club)
    const targetRole = clubRoleFor(club, member.profile_id)

    if (actorRole === 'owner') return true
    if (actorRole === 'admin') return targetRole === 'moderator' || targetRole === 'member'
    if (actorRole === 'moderator') return targetRole === 'member'
    return false
  }

  function manageableRoleOptions(club: Club, member: ClubMember): ClubMemberRole[] {
    if (!canManageClubMember(club, member)) return []
    if (isAdmin || clubRoleFor(club) === 'owner') return ['admin', 'moderator', 'member']
    if (clubRoleFor(club) === 'admin') return ['moderator', 'member']
    return ['member']
  }

  function clubTheme(club: Club | undefined) {
    return cleanHexColor(club?.theme_color || '', clubThemeColors[0])
  }

  function clubRankingCriterion(club: Club | undefined): LeaderboardCriterion {
    const criterion = club?.ranking_criterion
    return isLeaderboardCriterion(criterion) ? criterion : 'totalScore'
  }

  function clubThemeStyle(club: Club | undefined) {
    const color = clubTheme(club)
    return {
      '--club-theme': color,
      '--club-theme-soft': `${color}24`,
      '--club-theme-faint': `${color}12`,
    } as Record<string, string>
  }

  function clubMembers(club: Club | undefined): ClubMember[] {
    if (!Array.isArray(club?.club_members)) return []
    return club.club_members.filter((member) => Boolean(member?.id && member.profile_id && !member.deleted_at))
  }

  function mergeCurrentUserClubMembership(club: Club, memberships: ClubMember[]): Club {
    const currentUserMemberships = memberships.filter((member) => member.club_id === club.id && !member.deleted_at)
    if (currentUserMemberships.length === 0) return club

    const mergedMembers = new Map<string, ClubMember>()
    clubMembers(club).forEach((member) => mergedMembers.set(member.id, member))
    currentUserMemberships.forEach((member) => mergedMembers.set(member.id, member))
    return { ...club, club_members: Array.from(mergedMembers.values()) }
  }

  function approvedClubMember(club: Club, profileId = userId) {
    return clubMembers(club).some((member) => member.profile_id === profileId && member.status === 'approved')
  }

  function canEnterPrivateClubPage(club: Club | undefined) {
    if (!club) return false
    if (club.visibility !== 'private') return true
    if (!userId) return false
    return club.owner_id === userId || approvedClubMember(club) || Boolean(unlockedClubIds[club.id])
  }

  function canSeeClubPrivateData(club: Club | undefined) {
    if (!club) return true
    if (club.visibility === 'public') return true
    return canEnterPrivateClubPage(club) || canManageClub(club)
  }

  function canOpenClubPage(club: Club | undefined) {
    if (!club) return false
    if (!userId) return false
    if (club.visibility === 'private') return canEnterPrivateClubPage(club)
    return canSeeClubPrivateData(club)
  }

  function canCreateClubSession(club: Club | undefined) {
    if (!club) return false
    return canManageClub(club) || approvedClubMember(club)
  }

  function sessionClubFor(session: Session) {
    return session.club_id ? clubs.find((club) => club.id === session.club_id) : undefined
  }

  function clubMembershipFor(club: Club | undefined, profileId = userId) {
    if (!club || !profileId) return undefined
    return clubMembers(club).find((member) => member.profile_id === profileId)
  }

  function canAccessClubSession(session: Session) {
    const club = sessionClubFor(session)
    if (!club) return true
    return canSeeClubPrivateData(club)
  }

  function clubMemberCount(club: Club) {
    return club.member_count ?? clubMembers(club).filter((member) => member.status === 'approved').length
  }

  function openClubPage(clubId: string, tab: ClubTab = 'hall') {
    const club = clubs.find((item) => item.id === clubId)
    setClubStatus('')
    setClubMessageStatus('')

    if (!userId) {
      setSelectedClubId('')
      promptLogin()
      return
    }

    if (!canOpenClubPage(club)) {
      setSelectedClubId('')
      if (club?.visibility === 'private') {
        setClubUnlockTargetId(club.id)
        setClubUnlockCode('')
        setClubUnlockStatus('')
      } else {
        setClubStatus(text.hiddenMembers)
      }
      return
    }

    setSelectedClubId(clubId)
    setSelectedClubDate('')
    setSelectedClubTab(tab)
    setSelectedClubSessionScope('upcoming')
  }

  function closeClubUnlockModal() {
    setClubUnlockTargetId('')
    setClubUnlockCode('')
    setClubUnlockStatus('')
  }

  function unlockClubPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubUnlockTarget) return

    const expectedCode = normalizePrivateCode(clubUnlockTarget.pin_code)
    const typedCode = normalizePrivateCode(clubUnlockCode)
    if (!expectedCode || typedCode !== expectedCode) {
      setClubUnlockStatus(text.privateIncorrect)
      return
    }

    setUnlockedClubIds((current) => ({ ...current, [clubUnlockTarget.id]: true }))
    const unlockedClubId = clubUnlockTarget.id
    closeClubUnlockModal()
    setSelectedClubId(unlockedClubId)
    setSelectedClubDate('')
    setSelectedClubTab('hall')
    setSelectedClubSessionScope('upcoming')
  }

  function handleClubTabChange(tab: ClubTab) {
    setSelectedClubTab(tab)
    if (tab === 'sessions' && selectedClubSessionScope === 'past') {
      void ensurePastSessionsLoaded()
    }
  }

  function handleClubSessionScopeChange(scope: ClubSessionScope) {
    setSelectedClubSessionScope(scope)
    setSelectedClubDate('')
    if (scope === 'past') void ensurePastSessionsLoaded()
  }

  function handleClubBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!CLUB_BANNER_TYPES.includes(file.type)) {
      setClubStatus(text.clubBannerTypeError)
      event.target.value = ''
      return
    }

    if (file.size > CLUB_BANNER_MAX_BYTES) {
      setClubStatus(text.clubBannerSizeError)
      event.target.value = ''
      return
    }

    setClubBannerFile(file)
    setClubBannerPreview(URL.createObjectURL(file))
    setClubStatus('')
  }

  async function uploadClubBanner(club: Club) {
    if (!clubBannerFile) return club.banner_url || null

    const safeName = clubBannerFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const path = `${club.id}/${Date.now()}-${safeName}`
    const client = await getSupabase()
    const upload = await client.storage.from('club-banners').upload(path, clubBannerFile, {
      contentType: clubBannerFile.type,
      upsert: true,
    })

    if (upload.error) {
      setClubStatus(upload.error.message)
      return false
    }

    const { data } = client.storage.from('club-banners').getPublicUrl(path)
    return data.publicUrl
  }

  async function saveClubSettings(club: Club) {
    if (!canManageClub(club)) return

    const name = clubEditName.trim()
    if (!name) {
      setClubStatus(text.clubRequired)
      return
    }

    setIsSavingClub(true)
    setBusyClubId(club.id)
    setClubStatus(text.saving)

    const bannerUrl = await uploadClubBanner(club)
    if (bannerUrl === false) {
      setIsSavingClub(false)
      setBusyClubId('')
      return
    }

    const nextPinCode = clubEditVisibility === 'private' ? club.pin_code || generateInviteCode() : null
    const { error } = await (await getSupabase())
      .from('clubs')
      .update({
        name,
        motto: clubEditMotto.trim() || null,
        description: clubEditDescription.trim() || null,
        banner_url: bannerUrl,
        theme_color: cleanHexColor(clubEditThemeColor, clubThemeColors[0]),
        visibility: clubEditVisibility,
        pin_code: nextPinCode,
        default_language: clubEditDefaultLanguage,
        ranking_criterion: clubEditRankingCriterion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', club.id)

    if (error) {
      setClubStatus(error.message)
      setIsSavingClub(false)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubBannerFile(null)
    setClubBannerPreview('')
    setClubStatus(text.clubSaved)
    setIsSavingClub(false)
    setBusyClubId('')
  }

  async function regenerateClubInviteCode(club: Club) {
    if (!canManageClub(club)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase())
      .from('clubs')
      .update({
        pin_code: generateInviteCode(),
        visibility: 'private',
        updated_at: new Date().toISOString(),
      })
      .eq('id', club.id)

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubInviteRegenerated)
    }
    setBusyClubId('')
  }

  async function shareClubInvite(club: Club) {
    const code = club.pin_code || ''
    const shareBody = club.visibility === 'private'
      ? `${club.name} · ${text.privateCode}: ${code}`
      : `${club.name} · ${DEFAULT_APP_URL}`

    if (navigator.share) {
      await navigator.share({ title: club.name, text: shareBody })
    } else {
      await navigator.clipboard?.writeText(shareBody)
      setClubStatus(text.copied)
    }
  }

  async function updateClubMemberRole(club: Club, member: ClubMember, role: ClubMemberRole) {
    if (!manageableRoleOptions(club, member).includes(role)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase())
      .from('club_members')
      .update({ role, status: 'approved' })
      .eq('id', member.id)

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubRoleUpdated)
    }
    setBusyClubId('')
  }

  async function transferClubOwnership(club: Club, member: ClubMember) {
    if (!userId || (!isAdmin && club.owner_id !== userId)) return
    if (!window.confirm(text.transferOwnershipConfirm)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase()).rpc('transfer_club_ownership', {
      p_club_id: club.id,
      p_new_owner_id: member.profile_id,
    })

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubOwnershipTransferred)
    }
    setBusyClubId('')
  }

  async function notifyClubMembersOfSession(club: Club, sessionId: string) {
    const recipients = clubMembers(club)
      .filter((member) => member.status === 'approved' && member.profile_id !== userId)
      .slice(0, 80)

    if (recipients.length === 0) return

    const payloads = recipients.map((member) => {
      const snapshot = socialAvatarFields(member)
      return {
        session_id: sessionId,
        inviter_id: userId,
        recipient_id: member.profile_id,
        recipient_display_name: snapshot.display_name,
        recipient_avatar_url: snapshot.avatar_url,
        recipient_avatar_emoji: snapshot.avatar_emoji,
        recipient_avatar_initials: snapshot.avatar_initials,
        recipient_avatar_color: snapshot.avatar_color,
        recipient_avatar_text_color: snapshot.avatar_text_color,
        recipient_profile_motto: snapshot.profile_motto,
        status: 'pending',
      }
    })

    const { error } = await (await getSupabase())
      .from('session_invites')
      .upsert(payloads, { onConflict: 'session_id,recipient_id' })

    if (!error && networkDataLoadedRef.current) await loadNetworkData()
  }

  async function createClub() {
    if (!requireProfile()) return

    const activeProfile = profile
    const name = clubName.trim()

    if (!activeProfile) return

    if (!name) {
      setClubStatus(text.clubRequired)
      return
    }

    setIsCreatingClub(true)
    setClubStatus(text.creatingClub)

    const clubPinCode = clubVisibility === 'private' ? generateInviteCode() : null
    let savedClubPinCode = clubPinCode
    const client = await getSupabase()
    const clubPayload = {
      owner_id: userId,
      name,
      description: clubDescription.trim() || null,
      visibility: clubVisibility,
      pin_code: clubPinCode,
    }
    let clubResult = await client
      .from('clubs')
      .insert(clubPayload)
      .select('id')
      .single()

    if (clubResult.error && clubResult.error.message.toLowerCase().includes('pin_code')) {
      savedClubPinCode = null
      const fallbackClubPayload = {
        owner_id: clubPayload.owner_id,
        name: clubPayload.name,
        description: clubPayload.description,
        visibility: clubPayload.visibility,
      }
      clubResult = await client
        .from('clubs')
        .insert(fallbackClubPayload)
        .select('id')
        .single()
    }

    if (clubResult.error || !clubResult.data) {
      setClubStatus(clubResult.error?.message || text.createError)
      setIsCreatingClub(false)
      return
    }

    const memberResult = await client.from('club_members').insert({
      club_id: clubResult.data.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
      status: 'approved',
    })

    if (memberResult.error) {
      setClubStatus(memberResult.error.message)
      setIsCreatingClub(false)
      return
    }

    setClubName('')
    setClubDescription('')
    setClubVisibility('public')
    await loadClubs()
    setClubStatus(savedClubPinCode ? `${text.clubCreated} ${text.privateCode}: ${savedClubPinCode}` : text.clubCreated)
    setIsCreatingClub(false)
  }

  async function joinClub(club: Club) {
    if (!requireProfile()) return

    const activeProfile = profile
    if (!activeProfile) return

    const currentMembership = clubMembers(club).find((member) => member.profile_id === userId)
    if (currentMembership) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase()).from('club_members').insert({
      club_id: club.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
      status: club.visibility === 'private' ? 'pending' : 'approved',
    })

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(club.visibility === 'private' ? text.requestSent : text.joinedSession)
    setBusyClubId('')
  }

  async function approveClubMember(member: ClubMember) {
    const club = clubs.find((item) => item.id === member.club_id)
    if (!club || !canModerateClubMembers(club)) return

    setBusyClubId(member.club_id)
    const { error } = await (await getSupabase()).from('club_members').update({ status: 'approved', role: 'member' }).eq('id', member.id)

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(text.memberApproved)
    setBusyClubId('')
  }

  async function removeClubMember(club: Club, member: ClubMember) {
    if (!canManageClubMember(club, member)) return

    if (!window.confirm(text.removeMemberConfirm)) return

    setBusyClubId(club.id)
    const { error } = await softDeleteRecord('club_members', member.id, 'Removed from club')

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(text.memberRemoved)
    setBusyClubId('')
  }

  async function leaveClub(club: Club, member: ClubMember) {
    if (!userId || member.profile_id !== userId || club.owner_id === userId) return

    if (!window.confirm(leaveClubConfirmText)) return

    setBusyClubId(club.id)
    const { error } = await softDeleteRecord('club_members', member.id, 'User left club')

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(leftClubText)
    setBusyClubId('')
  }

  async function updateParticipantCheckIn(participantId: string, paymentSplits: ParticipantPaymentSplit[] | null, markFree = false) {
    const normalizedSplits = paymentSplits ?? []
    const normalizedAmount = participantPaymentSplitTotal(normalizedSplits)
    const summaryStatus = markFree
      ? 'free'
      : normalizedSplits.length > 0
        ? normalizedSplits[0].payment_method
        : null
    const { error } = await (await getSupabase())
      .from('session_participants')
      .update({
        checked_in: Boolean(summaryStatus),
        payment_status: summaryStatus,
        payment_amount: normalizedAmount > 0 ? normalizedAmount : null,
        payment_splits: markFree ? [] : normalizedSplits,
        checked_in_at: summaryStatus ? new Date().toISOString() : null,
      })
      .eq('id', participantId)

    if (error) {
      setCreateStatus(error.message === 'Failed to send a request to the Edge Function' ? text.messageFunctionFailed : error.message)
      return
    }

    setCheckInTarget(null)
    await loadSessions()
  }

  function updateCheckInPaymentSplit(splitId: string, patch: Partial<ParticipantPaymentSplitDraft>) {
    setCheckInPaymentSplits((splits) => splits.map((split) => (
      split.id === splitId ? { ...split, ...patch } : split
    )))
  }

  function addCheckInPaymentSplit() {
    setCheckInPaymentSplits((splits) => [...splits, newParticipantPaymentSplit('cash')])
  }

  function removeCheckInPaymentSplit(splitId: string) {
    setCheckInPaymentSplits((splits) => (
      splits.length > 1 ? splits.filter((split) => split.id !== splitId) : [newParticipantPaymentSplit('cash')]
    ))
  }

  async function updateParticipantResult(
    participantId: string,
    scoreValue: string | number | null,
    placementValue: string | number | null,
    accuracyValue: string | number | null,
    projectilesValue: string | number | null,
    escapeDurationValue?: string | number | null
  ) {
    const resultContext = sessions.reduce<{ session: Session; participant: Participant } | null>((match, session) => {
      if (match) return match
      const participant = (session.session_participants ?? []).find((item) => item.id === participantId)
      if (!participant || !canEditParticipantResult(session)) return null
      return { session, participant }
    }, null)

    if (!resultContext) {
      setCreateStatus('Only admins or session managers can edit player scores for this session.')
      return
    }

    const score = scoreValue === '' || scoreValue === null ? null : Number(scoreValue)
    const placement = placementValue === '' || placementValue === null ? null : Number(placementValue)
    const accuracy = accuracyValue === '' || accuracyValue === null ? null : Number(accuracyValue)
    const projectiles = projectilesValue === '' || projectilesValue === null ? null : Number(projectilesValue)
    const escapeDuration = escapeDurationValue === undefined ? undefined : parseSpeedrunDuration(escapeDurationValue)

    if (escapeDurationValue !== undefined && !isEscapeSession(resultContext.session)) {
      setCreateStatus(text.escapeDurationEscapeOnly)
      return
    }

    if (escapeDuration !== undefined && escapeDuration !== null && (!Number.isFinite(escapeDuration) || escapeDuration <= 0)) {
      setCreateStatus(text.invalidEscapeDuration)
      return
    }

    const resultPayload: {
      score: number | null
      accuracy_percent: number | null
      projectiles_fired: number | null
      placement: number | null
      escape_duration_seconds?: number | null
    } = {
      score: Number.isFinite(score as number) ? score : null,
      accuracy_percent: Number.isFinite(accuracy as number) ? accuracy : null,
      projectiles_fired: Number.isFinite(projectiles as number) ? projectiles : null,
      placement: Number.isFinite(placement as number) ? placement : null,
    }

    if (escapeDuration !== undefined) {
      resultPayload.escape_duration_seconds = escapeDuration
    }

    const { error } = await (await getSupabase())
      .from('session_participants')
      .update(resultPayload)
      .eq('id', participantId)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await loadSessions()
    refreshLeaderboardIfLoaded()
  }

  async function updateProfileTotalScore(profileId: string, totalScoreValue: string | number | null, baseTotalScore: number) {
    if (!isAdmin) {
      setCreateStatus(text.adminOnlyAction)
      return
    }

    const totalScore = totalScoreValue === '' || totalScoreValue === null ? null : Number(totalScoreValue)
    if (totalScore === null || !Number.isFinite(totalScore)) {
      setCreateStatus(text.invalidScore)
      return
    }

    const scoreAdjustment = totalScore - baseTotalScore
    const { data, error } = await (await getSupabase()).rpc('set_profile_score_adjustment', {
      p_profile_id: profileId,
      p_score_adjustment: scoreAdjustment,
    })

    if (error) {
      setCreateStatus(error.message)
      return
    }

    const savedAdjustment = Number((data as { score_adjustment?: number | null } | null)?.score_adjustment ?? scoreAdjustment)
    setProfileScoreAdjustments((current) => ({
      ...current,
      [profileId]: Number.isFinite(savedAdjustment) ? savedAdjustment : scoreAdjustment,
    }))
    if (profile?.id === profileId) {
      setProfile({ ...profile, score_adjustment: Number.isFinite(savedAdjustment) ? savedAdjustment : scoreAdjustment })
    }
    setLeaderboardPlayers((currentPlayers) =>
      currentPlayers.map((player) => player.profileId === profileId
        ? {
          ...player,
          scoreAdjustment: Number.isFinite(savedAdjustment) ? savedAdjustment : scoreAdjustment,
          totalScore: player.baseTotalScore + (Number.isFinite(savedAdjustment) ? savedAdjustment : scoreAdjustment),
        }
        : player
      )
    )
    refreshLeaderboardIfLoaded()
    setCreateStatus(text.scoreSaved)
  }

  function marketingConsentValues(consent: boolean, currentProfile: Profile | null, timestamp = new Date().toISOString()) {
    return {
      marketing_consent: consent,
      marketing_consent_at: consent ? currentProfile?.marketing_consent_at || timestamp : currentProfile?.marketing_consent_at || null,
      marketing_opted_out_at: consent ? null : timestamp,
    }
  }

  async function syncMarketingListForProfile(source: Profile, consent: boolean) {
    const client = await getSupabase()

    if (!consent) {
      const { error } = await client
        .from('marketing_list')
        .delete()
        .eq('profile_id', source.id)
      return error?.message || ''
    }

    const { error } = await client
      .from('marketing_list')
      .upsert({
        profile_id: source.id,
        email: source.email,
        full_name: source.full_name,
        nickname: source.nickname,
        phone: source.phone,
        consented_at: source.marketing_consent_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })

    return error?.message || ''
  }

  async function syncProfilePublicSnapshots(profileId: string) {
    const { error } = await (await getSupabase()).rpc('sync_profile_public_snapshot', { p_profile_id: profileId })
    return error?.message || ''
  }

  async function updateAnonymousMode(nextMode: boolean) {
    if (!profile || !userId) return

    setIsSavingAnonymousMode(true)
    const nextCallsign = profile.anonymous_callsign || anonymousCallsignForId(userId)
    const { data, error } = await (await getSupabase())
      .from('profiles')
      .update({
        anonymous_mode: nextMode,
        anonymous_callsign: nextCallsign,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    const metadataUpdate = await (await getSupabase()).auth.updateUser({
      data: {
        display_name: displayName(data),
        name: displayName(data),
        anonymous_mode: data.anonymous_mode,
        anonymous_callsign: data.anonymous_callsign,
      },
    })

    if (metadataUpdate.error) {
      setProfileStatus(metadataUpdate.error.message)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    const snapshotError = await syncProfilePublicSnapshots(data.id)
    if (snapshotError) {
      setProfileStatus(snapshotError)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    setProfile(data)
    syncProfileEverywhere(data)
    await loadSessions()
    await loadClubs()
    if (networkDataLoadedRef.current) await loadNetworkData()
    refreshLeaderboardIfLoaded()
    setProfileStatus(nextMode ? text.anonymousModeActivated : text.anonymousModeDeactivated)
    setAnonymousConfirmOpen(false)
    setIsSavingAnonymousMode(false)
  }

  async function updateMarketingConsent(nextConsent: boolean) {
    setMarketingConsent(nextConsent)
    if (!profile || !userId) return

    const previousProfile = profile
    const values = marketingConsentValues(nextConsent, profile)
    const optimisticProfile = { ...profile, ...values }
    setProfile(optimisticProfile)
    setProfileStatus(text.savingProfile)

    const { data, error } = await (await getSupabase())
      .from('profiles')
      .update(values)
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      setMarketingConsent(previousProfile.marketing_consent !== false)
      setProfile(previousProfile)
      setProfileStatus(error.message)
      return
    }

    const listError = await syncMarketingListForProfile(data, nextConsent)
    setProfile(data)
    setProfileStatus(listError || (nextConsent ? text.marketingConsentSaved : text.marketingConsentRemoved))
  }

  async function saveProfile() {
    if (!userId) {
      setProfileStatus(text.profileLoading)
      return
    }

    const countryCode = resolveCountryCode(profileCountryCode)
    const localPhone = profilePhone.replace(/[^\d\s-]/g, '').trim()
    const fullName = profileName.trim()
    const cleanMotto = limitMotto(profileMotto.trim())
    const nickname = limitDisplayName(profileNickname.trim())

    if (!profilePhone.trim()) {
      setProfileStatus(text.phoneRequired)
      return
    }

    if (!fullName) {
      setProfileStatus(text.nameRequired)
      return
    }

    setIsSavingProfile(true)
    setProfileStatus(text.savingProfile)

    const avatarUrl = avatarMode === 'photo' ? await uploadAvatar(userId, profile?.avatar_url || null) : null

    if (avatarUrl === false) return

    const avatarPayload = {
      avatar_url: avatarMode === 'photo' ? avatarUrl : null,
      avatar_emoji: avatarMode === 'emoji' ? avatarEmoji.trim() || '😎' : null,
      avatar_initials: avatarMode === 'initials' ? compactInitials(avatarInitials || displayName(profile) || fullName) : null,
      avatar_color: avatarColor,
      avatar_text_color: avatarTextColor,
    }

    const row = {
      full_name: fullName,
      phone: `${countryCode}${localPhone.replace(/\D/g, '')}`,
      profile_motto: cleanMotto || null,
      nickname: nickname || null,
      birthday: profileBirthday || null,
      gender: profileGender || null,
      ...marketingConsentValues(marketingConsent, profile),
      ...avatarPayload,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await (await getSupabase())
      .from('profiles')
      .update(row)
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingProfile(false)
      return
    }

    const display = displayName(data)
    const publicAvatar = avatarFields(data)
    const metadataUpdate = await (await getSupabase()).auth.updateUser({
      data: {
        display_name: display,
        full_name: fullName,
        name: display,
        nickname: nickname || null,
        birthday: data.birthday,
        gender: data.gender,
        phone: data.phone,
        avatar_url: publicAvatar.avatar_url,
        avatar_emoji: publicAvatar.avatar_emoji,
        avatar_initials: publicAvatar.avatar_initials,
        avatar_color: publicAvatar.avatar_color,
        avatar_text_color: publicAvatar.avatar_text_color,
        profile_motto: data.profile_motto,
        marketing_consent: data.marketing_consent,
        marketing_consent_at: data.marketing_consent_at,
        marketing_opted_out_at: data.marketing_opted_out_at,
      },
    })

    if (metadataUpdate.error) {
      setProfileStatus(metadataUpdate.error.message)
      setIsSavingProfile(false)
      return
    }

    const participantProfileUpdate = await (await getSupabase())
      .from('session_participants')
      .update({
        display_name: display,
        avatar_url: publicAvatar.avatar_url,
        avatar_emoji: publicAvatar.avatar_emoji,
        avatar_initials: publicAvatar.avatar_initials,
        avatar_color: publicAvatar.avatar_color,
        avatar_text_color: publicAvatar.avatar_text_color,
        profile_motto: data.profile_motto,
    })
      .eq('profile_id', userId)
      .select('id')

    if (participantProfileUpdate.error) {
      setProfileStatus(participantProfileUpdate.error.message)
      setIsSavingProfile(false)
      return
    }

    const clubMemberProfileUpdate = await (await getSupabase())
      .from('club_members')
      .update({
        display_name: display,
        avatar_url: publicAvatar.avatar_url,
        avatar_emoji: publicAvatar.avatar_emoji,
        avatar_initials: publicAvatar.avatar_initials,
        avatar_color: publicAvatar.avatar_color,
        avatar_text_color: publicAvatar.avatar_text_color,
        profile_motto: data.profile_motto,
      })
      .eq('profile_id', userId)
      .select('id')

    if (clubMemberProfileUpdate.error) {
      setProfileStatus(clubMemberProfileUpdate.error.message)
      setIsSavingProfile(false)
      return
    }

    const tournamentEditorProfileUpdate = await (await getSupabase())
      .from('tournament_editors')
      .update({
        display_name: display,
        avatar_url: publicAvatar.avatar_url,
        avatar_emoji: publicAvatar.avatar_emoji,
        avatar_initials: publicAvatar.avatar_initials,
        avatar_color: publicAvatar.avatar_color,
        avatar_text_color: publicAvatar.avatar_text_color,
        profile_motto: data.profile_motto,
      })
      .eq('profile_id', userId)
      .select('id')

    if (tournamentEditorProfileUpdate.error) {
      setProfileStatus(tournamentEditorProfileUpdate.error.message)
      setIsSavingProfile(false)
      return
    }

    const snapshotError = await syncProfilePublicSnapshots(data.id)
    if (snapshotError) {
      setProfileStatus(snapshotError)
      setIsSavingProfile(false)
      return
    }

    const marketingListError = await syncMarketingListForProfile(data, data.marketing_consent !== false)
    if (marketingListError) {
      setProfileStatus(marketingListError)
      setIsSavingProfile(false)
      return
    }

    setProfile(data)
    await loadSessions()
    await loadClubs()
    await loadTournamentData()
    syncProfileEverywhere(data)
    setAvatarFile(null)
    setAvatarPreview('')
    setProfileCountryCode(`${countryCode} ${countries.find((country) => country.code === countryCode)?.name || ''}`.trim())
    setProfilePhone(localPhone)
    setProfileBirthday(data.birthday || '')
    setProfileGender(normalizeProfileGender(data.gender))
    setProfileStatus(text.profileSaved)
    setIsSavingProfile(false)
  }

  async function uploadAvatar(ownerId: string, currentAvatarUrl: string | null) {
    if (!avatarFile) return currentAvatarUrl

    const safeName = avatarFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const path = `${ownerId}/${Date.now()}-${safeName}`
    const upload = await (await getSupabase()).storage.from('avatars').upload(path, avatarFile, {
      contentType: avatarFile.type,
      upsert: true,
    })

    if (upload.error) {
      setProfileStatus(upload.error.message)
      setIsSavingProfile(false)
      return false as const
    }

    const { data } = (await getSupabase()).storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null

    if (!file) {
      setAvatarFile(null)
      setAvatarPreview('')
      return
    }

    if (!AVATAR_IMAGE_TYPES.includes(file.type)) {
      setProfileStatus(text.avatarPhotoTypeError)
      setAvatarFile(null)
      setAvatarPreview('')
      event.target.value = ''
      return
    }

    if (file.size > AVATAR_IMAGE_MAX_BYTES) {
      setProfileStatus(text.avatarPhotoSizeError)
      setAvatarFile(null)
      setAvatarPreview('')
      event.target.value = ''
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarMode('photo')
    setProfileStatus('')
  }

  function toggleGame(gameId: GameId) {
    setSelectedGames((current) => {
      if (current.includes(gameId)) {
        return current.length === 1 ? current : current.filter((id) => id !== gameId)
      }
      return [...current, gameId]
    })
  }

  function applyRichTextCommand(command: 'bold' | 'italic' | 'underline' | 'strikeThrough') {
    document.execCommand(command, false)
  }

  async function bookTickets() {
    if (!requireProfile()) return

    const activeProfile = profile
    if (!activeProfile) return

    const service = selectedTicketService(ticketType)
    const selectedTimeOption = ticketTimeOptions.find((option) => option.value === ticketTime)

    if (!ticketDate || !ticketTime || !selectedTimeOption) {
      setTicketStatus(text.ticketRequired)
      return
    }

    if (ticketPlayers < service.minPlayers || ticketPlayers > service.maxPlayers) {
      setTicketStatus(text.ticketPlayersInvalid)
      return
    }

    if (ticketUseLoyaltyPoints && appliedTicketLoyaltyPoints <= 0) {
      setTicketStatus(text.ticketLoyaltyInvalid)
      return
    }

    const normalizedTicketDiscountCode = ticketDiscountCode.trim().toUpperCase()
    if (normalizedTicketDiscountCode && isCheckingTicketDiscount) {
      setTicketStatus(ticketDiscountCodeCheckingText)
      return
    }

    if (normalizedTicketDiscountCode && !ticketDiscountQuote) {
      setTicketStatus(ticketDiscountCodeInvalidText)
      return
    }

    const allowed = await consumeAppRateLimit('booking_attempt', `${ticketType}:${ticketDate}:${ticketTime}`, setTicketStatus)
    if (!allowed) return

    setIsBookingTickets(true)
    setTicketStatus(text.bookingTickets)
    setTicketConfirmation(null)

    const { data, error } = await (await getSupabase()).rpc('create_ticket_booking', {
      p_ticket_type: ticketType,
      p_date: ticketDate,
      p_start_time: `${ticketTime}:00`,
      p_duration_minutes: activeTicketDuration,
      p_player_count: ticketPlayers,
      p_arena_count: activeTicketArenaCount,
      p_game_options: [service.defaultGame],
      p_unit_price: currentTicketUnitPrice,
      p_total_price: currentTicketTotalPrice,
      p_loyalty_points_to_redeem: appliedTicketLoyaltyPoints,
      p_discount_code: ticketDiscountQuote ? normalizedTicketDiscountCode : null,
    })

    if (error) {
      setTicketStatus(error.message || text.ticketBookingError)
      setIsBookingTickets(false)
      return
    }

    const booking = (data || {}) as {
      discount_amount?: number | null
      discount_code?: string | null
      loyalty_points_total?: number | null
      session_id?: string
      ticket_reference?: string
    }
    const confirmation: TicketBookingConfirmation = {
      sessionId: booking.session_id || '',
      reference: booking.ticket_reference || '',
      ticketType,
      ticketLabel: ticketTypeLabel(ticketType, looseText),
      date: ticketDate,
      time: ticketTime,
      players: ticketPlayers,
      totalPrice: currentTicketTotalPrice,
      discountCode: booking.discount_code || undefined,
      discountAmount: Math.max(0, Math.floor(Number(booking.discount_amount ?? 0) || 0)),
      loyaltyPointsRedeemed: appliedTicketLoyaltyPoints,
      loyaltyDiscountAmount: ticketLoyaltyDiscountAmount,
    }

    if (profile && booking.loyalty_points_total !== undefined && booking.loyalty_points_total !== null) {
      const nextPointsTotal = Math.max(0, Math.floor(Number(booking.loyalty_points_total) || 0))
      const nextProfile = { ...profile, loyalty_points_total: nextPointsTotal }
      setProfile(nextProfile)
      syncProfileEverywhere(nextProfile)
      setTicketLoyaltyRedemption((current) => current
        ? { ...current, loyalty_points_total: nextPointsTotal }
        : { loyalty_points_total: nextPointsTotal, redeem_value_vnd_per_point: ticketLoyaltyRedeemValue })
    }

    setTicketConfirmation(confirmation)
    setTicketStatus(text.ticketBookingCreated)
    setTicketTime('')
    setTicketUseLoyaltyPoints(false)
    setTicketLoyaltyPointsToRedeem('')
    setTicketDiscountCode('')
    setTicketDiscountQuote(null)
    setTicketDiscountStatus('')
    await loadSessions({ focusDate: ticketDate })
    setIsBookingTickets(false)
  }

  async function createSession() {
    if (!requireProfile()) {
      setIsCreating(false)
      return
    }

    const activeProfile = profile

    if (!activeProfile) {
      setIsCreating(false)
      return
    }

    if (!sessionName.trim() || !sessionDate || !sessionTime) {
      setCreateStatus(text.sessionRequired)
      setIsCreating(false)
      return
    }

    const selectedSessionClub = sessionClubId ? clubs.find((club) => club.id === sessionClubId) : undefined

    if (selectedSessionClub && !canCreateClubSession(selectedSessionClub)) {
      setCreateStatus(text.clubMembershipRequired)
      setIsCreating(false)
      return
    }

    const allowed = await consumeAppRateLimit('booking_attempt', `${sessionDate}:${sessionTime}`)
    if (!allowed) {
      setIsCreating(false)
      return
    }

    setIsCreating(true)
    setCreateStatus(text.creating)

    const effectiveVisibility = selectedSessionClub ? 'public' : sessionVisibility
    const inviteCode = effectiveVisibility === 'private' ? generateInviteCode() : null

    const { data: created, error } = await (await getSupabase())
      .from('sessions')
      .insert({
        owner_id: userId,
        club_id: sessionClubId || null,
        session_type: sessionType,
        name: sessionName.trim(),
        date: sessionDate,
        start_time: `${sessionTime}:00`,
        duration_minutes: sessionDuration,
        max_players: sessionMaxPlayers,
        arena_count: sessionArenaCount,
        game_options: selectedGames,
        game_votes: { [userId]: selectedGames[0] },
        confirmed_game_id: null,
        visibility: effectiveVisibility,
        invite_code: inviteCode,
        notes: sessionNotes.trim() || null,
        status: 'open',
        tournament_format: sessionType === 'tournament' ? tournamentFormat : null,
        best_of: sessionType === 'tournament' ? tournamentBestOf : 1,
        rounds_per_match: sessionType === 'tournament' ? tournamentRoundsPerMatch : null,
        require_payment: sessionType === 'tournament' ? tournamentRequirePayment : false,
        qualification_rule: sessionType === 'tournament' ? tournamentQualificationRule : null,
        custom_qualifiers: sessionType === 'tournament' ? tournamentCustomQualifiers : null,
        enable_third_place_match: sessionType === 'tournament' ? tournamentThirdPlace : false,
        first_prize: sessionType === 'tournament' ? tournamentFirstPrize.trim() || null : null,
        second_prize: sessionType === 'tournament' ? tournamentSecondPrize.trim() || null : null,
        third_prize: sessionType === 'tournament' ? tournamentThirdPrize.trim() || null : null,
        tournament_locked: false,
      })
      .select('id')
      .single()

    if (error || !created) {
      setCreateStatus(error?.message || text.createError)
      setIsCreating(false)
      return
    }

    await (await getSupabase()).from('session_participants').insert({
      session_id: created.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
    })

    if (selectedSessionClub) {
      await notifyClubMembersOfSession(selectedSessionClub, created.id)
    }

    setCreateStatus(
      sessionVisibility === 'private'
        ? `${text.privateCreated} ${inviteCode}`
        : text.sessionCreated
    )

    setSessionName('')
    setSessionNotes('')
    setSessionTime('')
    setSessionDuration(20)
    setSessionMaxPlayers(4)
    setSessionArenaCount(1)
    setSessionClubId('')
    setSessionType('game')
    setTournamentFormat('pool_to_final')
    setTournamentBestOf(1)
    setTournamentRoundsPerMatch(1)
    setTournamentRequirePayment(false)
    setTournamentQualificationRule('top_1')
    setTournamentCustomQualifiers(2)
    setTournamentThirdPlace(true)
    setTournamentFirstPrize('')
    setTournamentSecondPrize('')
    setTournamentThirdPrize('')
    setSelectedGames(['laser-tag'])
    setSessionVisibility('public')
    await loadSessions({ focusDate: sessionDate })
    setActiveView('sessions')
    setIsCreating(false)
  }

  async function joinSession(session: Session) {
    if (!requireProfile()) return

    if (isTicketSession(session)) {
      setCreateStatus(text.privateTicketSession)
      return
    }

    if (isChallengeSession(session) && session.challenge_target_id !== userId && !hasSessionInvite(session.id, userId)) {
      setCreateStatus(text.challengeInviteOnly)
      return
    }

    const activeProfile = profile

    if (!activeProfile) return

    const sessionClub = sessionClubFor(session)
    if (sessionClub && !canAccessClubSession(session)) {
      setCreateStatus(text.clubMembershipRequired)
      return
    }

    const joinsWithPrivateCode = session.visibility === 'private' && !hasSessionInvite(session.id, userId)

    if (joinsWithPrivateCode) {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (!typedCode) {
        setCreateStatus(text.privateIncorrect)
        return
      }
    }

    const participants = session.session_participants ?? []
    if (participants.some((participant) => participant.profile_id === userId)) return

    if (participants.length >= session.max_players) {
      setCreateStatus(text.sessionFull)
      return
    }

    const allowed = await consumeAppRateLimit('join_leave', `join:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)

    const avatarPayload = avatarFields(activeProfile)
    const joinResult = joinsWithPrivateCode
      ? await (await getSupabase()).rpc('join_private_session_with_code', {
        p_session_id: session.id,
        p_invite_code: (joinCodes[session.id] || '').trim().toUpperCase(),
        p_display_name: displayName(activeProfile),
        p_avatar_url: avatarPayload.avatar_url,
        p_avatar_emoji: avatarPayload.avatar_emoji,
        p_avatar_initials: avatarPayload.avatar_initials,
        p_avatar_color: avatarPayload.avatar_color,
        p_avatar_text_color: avatarPayload.avatar_text_color,
        p_profile_motto: avatarPayload.profile_motto,
      })
      : await (await getSupabase()).from('session_participants').insert({
        session_id: session.id,
        profile_id: userId,
        display_name: displayName(activeProfile),
        ...avatarPayload,
      })

    if (joinResult.error) {
      setCreateStatus(joinResult.error.message)
      setBusySessionId('')
      return
    }

    await (await getSupabase())
      .from('session_waitlist')
      .delete()
      .eq('session_id', session.id)
      .eq('profile_id', userId)

    await (await getSupabase())
      .from('session_invites')
      .update({ status: 'accepted' })
      .eq('session_id', session.id)
      .eq('recipient_id', userId)

    await loadSessions({ focusDate: session.date })
    await loadNetworkData()
    setBusySessionId('')
    setCreateStatus(text.joinedSession)
    await prepareJoinedSessionReminders(session)
  }

  async function joinWaitlist(session: Session) {
    if (!requireProfile()) return

    if (isTicketSession(session)) {
      setCreateStatus(text.privateTicketSession)
      return
    }

    if (isChallengeSession(session)) {
      setCreateStatus(text.challengeInviteOnly)
      return
    }

    const activeProfile = profile
    if (!activeProfile) return

    const sessionClub = sessionClubFor(session)
    if (sessionClub && !canAccessClubSession(session)) {
      setCreateStatus(text.clubMembershipRequired)
      return
    }

    const waitlistsWithPrivateCode = session.visibility === 'private' && !hasSessionInvite(session.id, userId)

    if (waitlistsWithPrivateCode) {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (!typedCode) {
        setCreateStatus(text.privateIncorrect)
        return
      }
    }

    const participants = session.session_participants ?? []
    if (participants.some((participant) => participant.profile_id === userId)) return
    if (waitlistPosition(session, userId)) return

    const allowed = await consumeAppRateLimit('join_leave', `waitlist:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)

    const avatarPayload = avatarFields(activeProfile)
    const waitlistResult = waitlistsWithPrivateCode
      ? await (await getSupabase()).rpc('join_private_session_waitlist_with_code', {
        p_session_id: session.id,
        p_invite_code: (joinCodes[session.id] || '').trim().toUpperCase(),
        p_display_name: displayName(activeProfile),
        p_avatar_url: avatarPayload.avatar_url,
        p_avatar_emoji: avatarPayload.avatar_emoji,
        p_avatar_initials: avatarPayload.avatar_initials,
        p_avatar_color: avatarPayload.avatar_color,
        p_avatar_text_color: avatarPayload.avatar_text_color,
        p_profile_motto: avatarPayload.profile_motto,
      })
      : await (await getSupabase()).from('session_waitlist').insert({
        session_id: session.id,
        profile_id: userId,
        display_name: displayName(activeProfile),
        ...avatarPayload,
      })

    if (waitlistResult.error) {
      setCreateStatus(waitlistResult.error.message)
      setBusySessionId('')
      return
    }

    await loadSessions({ focusDate: session.date })
    setCreateStatus(text.waitlistJoined)
    setBusySessionId('')
  }

  async function toggleFollowPlayer(player: {
    profileId: string
    displayName: string
    avatarUrl: string | null
    avatarEmoji: string | null
    avatarInitials: string | null
    avatarColor: string | null
    avatarTextColor: string | null
    profileMotto: string | null
  }) {
    if (!requireProfile()) return
    if (player.profileId === userId) return

    setBusyFriendId(player.profileId)

    if (isFollowing(player.profileId)) {
      const { error } = await (await getSupabase())
        .from('user_follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', player.profileId)

      if (error) setCreateStatus(error.message)
      else setCreateStatus(text.friendRemoved)
    } else {
      const { error } = await (await getSupabase()).from('user_follows').upsert({
        follower_id: userId,
        following_id: player.profileId,
        display_name: compactDisplayName(player.displayName, text.player),
        avatar_url: player.avatarUrl,
        avatar_emoji: player.avatarEmoji,
        avatar_initials: player.avatarInitials,
        avatar_color: player.avatarColor,
        avatar_text_color: player.avatarTextColor,
        profile_motto: player.profileMotto,
      }, { onConflict: 'follower_id,following_id' })

      if (error) setCreateStatus(error.message)
      else setCreateStatus(text.friendAdded)
    }

    await loadNetworkData()
    setBusyFriendId('')
  }

  async function invitePlayerToSession(session: Session, player: {
    profile_id: string
    display_name: string | null
    avatar_url: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    profile_motto?: string | null
  }) {
    if (!requireProfile()) return
    if (player.profile_id === userId) return

    const inviteKey = `${session.id}-${player.profile_id}`
    setBusyInviteKey(inviteKey)

    const snapshot = socialAvatarFields(player)
    const { error } = await (await getSupabase()).from('session_invites').upsert({
      session_id: session.id,
      inviter_id: userId,
      recipient_id: player.profile_id,
      recipient_display_name: snapshot.display_name,
      recipient_avatar_url: snapshot.avatar_url,
      recipient_avatar_emoji: snapshot.avatar_emoji,
      recipient_avatar_initials: snapshot.avatar_initials,
      recipient_avatar_color: snapshot.avatar_color,
      recipient_avatar_text_color: snapshot.avatar_text_color,
      recipient_profile_motto: snapshot.profile_motto,
      status: 'pending',
    }, { onConflict: 'session_id,recipient_id' })

    if (error) setCreateStatus(error.message)
    else setCreateStatus(text.inviteSent)

    await loadNetworkData()
    await loadSessionDetail(session.id, { force: true })
    setBusyInviteKey('')
  }

  async function postSessionMessage(session: Session, messageType: 'announcement' | 'comment') {
    if (!requireProfile() || !profile) return
    if (messageType === 'announcement' && !canReviewSessionMessages(session)) return

    const draft = (messageType === 'announcement' ? announcementDrafts[session.id] : commentDrafts[session.id]) || ''
    const body = draft.trim()
    if (!body) return

    const messageKey = `${session.id}-${messageType}`
    setBusyMessageKey(messageKey)

    const { data, error } = await (await getSupabase()).functions.invoke('post-session-message', {
      body: {
        session_id: session.id,
        message_type: messageType,
        body,
      },
    })

    const message = data?.message as SessionMessage | undefined

    if (error) {
      setCreateStatus(error.message)
    } else {
      if (messageType === 'announcement') {
        setAnnouncementDrafts((current) => ({ ...current, [session.id]: '' }))
      } else {
        setCommentDrafts((current) => ({ ...current, [session.id]: '' }))
      }
      if (message) {
        mergeSessionMessage(message)
      } else {
        await loadSessionMessages(session.id, { force: true })
      }
      setCreateStatus(message?.moderation_status === 'pending_review' ? text.messagePendingReview : text.messagePosted)
    }

    setBusyMessageKey('')
  }

  async function postClubMessage(club: Club, messageType: ClubMessage['message_type']) {
    if (!requireProfile() || !profile) return
    if (!canUseClubMessages(club)) {
      setClubMessageStatus(text.clubMessageLoginRequired)
      return
    }

    const drafts = messageType === 'public' ? clubPublicMessageDrafts : clubAdminMessageDrafts
    const body = (drafts[club.id] || '').trim()
    if (!body) return

    if (Array.from(body).length > CLUB_MESSAGE_MAX_LENGTH) {
      setClubMessageStatus(text.clubMessageTooLong)
      return
    }

    const messageKey = `${club.id}-${messageType}`
    setBusyMessageKey(messageKey)
    setClubMessageStatus('')

    const avatarSnapshot = profileAvatarSnapshot(profile)
    const { data, error } = await (await getSupabase())
      .from('club_messages')
      .insert({
        club_id: club.id,
        author_id: userId,
        author_display_name: avatarSnapshot.display_name,
        author_avatar_url: avatarSnapshot.avatar_url,
        author_avatar_emoji: avatarSnapshot.avatar_emoji,
        author_avatar_initials: avatarSnapshot.avatar_initials,
        author_avatar_color: avatarSnapshot.avatar_color,
        author_avatar_text_color: avatarSnapshot.avatar_text_color,
        author_profile_motto: avatarSnapshot.profile_motto || null,
        message_type: messageType,
        body,
      })
      .select(CLUB_MESSAGE_SELECT)
      .single()

    if (error) {
      setClubMessageStatus(error.message)
    } else {
      if (messageType === 'public') {
        setClubPublicMessageDrafts((current) => ({ ...current, [club.id]: '' }))
      } else {
        setClubAdminMessageDrafts((current) => ({ ...current, [club.id]: '' }))
      }
      if (data) mergeClubMessage(data as ClubMessage)
      loadedClubMessagesRef.current.add(club.id)
      setClubMessageStatus(text.clubMessagePosted)
    }

    setBusyMessageKey('')
  }

  async function reviewSessionMessage(message: SessionMessage, status: 'approved' | 'rejected') {
    if (!requireProfile()) return

    setBusyMessageKey(`${message.id}-${status}`)
    const { error } = await (await getSupabase())
      .from('session_messages')
      .update({
        moderation_status: status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', message.id)

    if (error) {
      setCreateStatus(error.message)
    } else {
      setCreateStatus(status === 'approved' ? text.messageApproved : text.messageRejected)
      const reviewedAt = new Date().toISOString()
      setSessionMessages((current) => sortSessionMessages(current.map((item) => (
        item.id === message.id
          ? { ...item, moderation_status: status, reviewed_by: userId, reviewed_at: reviewedAt }
          : item
      ))))
    }

    setBusyMessageKey('')
  }

  async function deleteSessionMessage(message: SessionMessage) {
    if (!requireProfile()) return
    if (!isAdmin) {
      setCreateStatus(text.adminOnlyAction)
      return
    }

    const confirmed = window.confirm(text.deleteMessageConfirm)
    if (!confirmed) return

    setBusyMessageKey(`${message.id}-delete`)
    const { error } = await softDeleteRecord('session_messages', message.id, 'Admin deleted message')

    if (error) {
      setCreateStatus(error.message)
    } else {
      setCreateStatus(text.messageDeleted)
      setSessionMessages((current) => current.filter((item) => item.id !== message.id))
    }

    setBusyMessageKey('')
  }

  async function leaveSession(session: Session) {
    if (!requireProfile()) return

    if (session.owner_id === userId) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.leaveConfirmPrefix} "${session.name}"? ${text.leaveConfirmSuffix}`)
    if (!confirmed) return

    const participant = (session.session_participants ?? []).find((item) => item.profile_id === userId)
    if (!participant) return

    const allowed = await consumeAppRateLimit('join_leave', `leave:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)
    const { error } = await softDeleteRecord('session_participants', participant.id, 'User left session')

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.leftSession)
    setBusySessionId('')
  }

  async function voteForGame(session: Session, gameId: GameId) {
    if (!requireProfile()) return
    if (isPastSession(session) && !canManageSession(session)) return

    const voteKey = `${session.id}-${gameId}`
    setBusyVoteKey(voteKey)
    const votes = { ...(session.game_votes || {}), [userId]: gameId }
    const { error } = await (await getSupabase()).from('sessions').update({ game_votes: votes }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusyVoteKey('')
      return
    }

    await loadSessions()
    setCreateStatus(text.voteSaved)
    setBusyVoteKey('')
  }

  async function confirmPlayedGame(session: Session) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyEdit)
      return
    }

    const selectedGameId = confirmedGameDrafts[session.id] || session.confirmed_game_id || ''
    const validGameId = games.some((game) => game.id === selectedGameId) ? selectedGameId : null

    setBusySessionId(session.id)
    const { error } = await (await getSupabase())
      .from('sessions')
      .update({ confirmed_game_id: validGameId })
      .eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    setSessions((current) =>
      current.map((item) =>
        item.id === session.id
          ? { ...item, confirmed_game_id: validGameId as GameId | null }
          : item
      )
    )
    setConfirmedGameDrafts((current) => ({ ...current, [session.id]: validGameId || '' }))
    await loadSessions()
    setCreateStatus(text.confirmedPlayedGame)
    setBusySessionId('')
  }

  function toggleEditGame(gameId: GameId) {
    setEditSelectedGames((current) => {
      if (current.includes(gameId)) {
        return current.length === 1 ? current : current.filter((id) => id !== gameId)
      }
      return [...current, gameId]
    })
  }

  async function startEditingSession(session: Session) {
    if (isAdmin) ensureAllProfilesLoaded()
    const fullSession = sessionDetailsLoadedRef.current.has(session.id)
      ? session
      : (await loadSessionDetail(session.id)) || session

    setEditingSessionId(session.id)
    setEditSessionName(fullSession.name)
    setEditSessionDate(fullSession.date)
    setEditSessionTime(fullSession.start_time.slice(0, 5))
    setEditSessionDuration(fullSession.duration_minutes)
    setEditSessionMaxPlayers(fullSession.max_players)
    setEditSessionArenaCount(arenasUsedBySession(fullSession))
    setEditSessionVisibility(fullSession.visibility)
    setEditSessionNotes(fullSession.notes || '')
    setEditSelectedGames(fullSession.game_options?.length ? fullSession.game_options : ['laser-tag'])
    setEditBookingType(fullSession.booking_type || 'community')
    setEditTicketCustomerId(fullSession.ticket_customer_id || fullSession.owner_id)
    setEditTicketType(fullSession.ticket_type || 'individual')
    setEditTicketTotalPrice(String(fullSession.ticket_total_price ?? ''))
    setEditTicketStatus(fullSession.ticket_status || 'confirmed')
    setEditTournamentFormat(fullSession.tournament_format || 'pool_to_final')
    setEditTournamentBestOf((fullSession.best_of || 1) as 1 | 3 | 5)
    setEditTournamentRoundsPerMatch(fullSession.rounds_per_match || 1)
    setEditTournamentRequirePayment(Boolean(fullSession.require_payment))
    setEditTournamentQualificationRule(fullSession.qualification_rule || 'top_1')
    setEditTournamentCustomQualifiers(fullSession.custom_qualifiers || 2)
    setEditTournamentThirdPlace(Boolean(fullSession.enable_third_place_match))
    setEditTournamentFirstPrize(fullSession.first_prize || '')
    setEditTournamentSecondPrize(fullSession.second_prize || '')
    setEditTournamentThirdPrize(fullSession.third_prize || '')
    setCreateStatus('')
  }

  function stopEditingSession() {
    setEditingSessionId('')
    setIsUpdatingSession(false)
  }

  async function updateSession(session: Session) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyEdit)
      return
    }

    const participants = session.session_participants ?? []

    if (!editSessionName.trim() || !editSessionDate || !editSessionTime) {
      setCreateStatus(text.sessionRequired)
      return
    }

    if (editSessionMaxPlayers < participants.length) {
      setCreateStatus(text.maxPlayersBelowJoined)
      return
    }

    setIsUpdatingSession(true)
    setCreateStatus(text.savingSession)

    const effectiveEditVisibility = session.club_id ? 'public' : editBookingType === 'ticket' || editBookingType === 'challenge' ? 'private' : editSessionVisibility
    const inviteCode =
      effectiveEditVisibility === 'private'
        ? session.invite_code || generateInviteCode()
        : null
    const tournament = tournamentForSession(session.id)
    const hasTournamentBracket = tournament.pools.length > 0 || tournament.matches.length > 0
    const ticketEditDuration = editSessionDuration
    const ticketEditArenaCount = editBookingType === 'ticket'
      ? ticketArenaCountForPlayers()
      : editSessionArenaCount
    const ticketEditPricing = ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, editSessionMaxPlayers, ticketEditDuration)
    const sanitizedTicketTotal = Math.max(0, Math.round(Number(editTicketTotalPrice) || ticketEditPricing.totalPrice))

    const { error } = await (await getSupabase())
      .from('sessions')
      .update({
        name: editSessionName.trim(),
        ...(isAdmin && editBookingType === 'ticket' && editTicketCustomerId ? { owner_id: editTicketCustomerId } : {}),
        date: editSessionDate,
        start_time: `${editSessionTime}:00`,
        duration_minutes: ticketEditDuration,
        max_players: editSessionMaxPlayers,
        arena_count: ticketEditArenaCount,
        game_options: editSelectedGames,
        visibility: effectiveEditVisibility,
        invite_code: inviteCode,
        notes: editSessionNotes.trim() || null,
        ...(isAdmin
          ? {
            booking_type: editBookingType,
            ticket_customer_id: editBookingType === 'ticket' ? editTicketCustomerId || null : null,
            ticket_type: editBookingType === 'ticket' ? editTicketType : null,
            ticket_player_count: editBookingType === 'ticket' ? editSessionMaxPlayers : null,
            ticket_total_price: editBookingType === 'ticket' ? sanitizedTicketTotal : null,
            ticket_unit_price: editBookingType === 'ticket' ? ticketEditPricing.baseUnitPrice : null,
            ticket_status: editBookingType === 'ticket' ? editTicketStatus : null,
          }
          : {}),
        ...(session.session_type === 'tournament'
          ? {
            tournament_format: hasTournamentBracket ? session.tournament_format : editTournamentFormat,
            best_of: hasTournamentBracket ? session.best_of : editTournamentBestOf,
            rounds_per_match: editTournamentRoundsPerMatch,
            require_payment: editTournamentRequirePayment,
            qualification_rule: hasTournamentBracket ? session.qualification_rule : editTournamentQualificationRule,
            custom_qualifiers: hasTournamentBracket ? session.custom_qualifiers : editTournamentCustomQualifiers,
            enable_third_place_match: editTournamentThirdPlace,
            first_prize: editTournamentFirstPrize.trim() || null,
            second_prize: editTournamentSecondPrize.trim() || null,
            third_prize: editTournamentThirdPrize.trim() || null,
          }
          : {}),
      })
      .eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setIsUpdatingSession(false)
      return
    }

    await loadSessions({ focusDate: editSessionDate })
    setCreateStatus(effectiveEditVisibility === 'private' ? `${text.privateUpdated} ${inviteCode}` : text.sessionUpdated)
    stopEditingSession()
  }

  async function cancelSession(session: Session) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyCancel)
      return
    }

    const confirmed = window.confirm(`${text.cancelConfirmPrefix} "${session.name}"? ${text.cancelConfirmSuffix}`)
    if (!confirmed) return

    const allowed = await consumeAppRateLimit('admin_destructive', `cancel-session:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)
    const { error } = await (await getSupabase()).from('sessions').update({ status: 'cancelled' }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.sessionCancelled)
    setBusySessionId('')
  }

  async function removeParticipant(session: Session, participant: Participant) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyRemove)
      return
    }

    if (participant.profile_id === session.owner_id) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.removeConfirmPrefix} ${participant.display_name || text.removeConfirmFallback} ${text.fromSession} "${session.name}"?`)
    if (!confirmed) return

    setBusySessionId(session.id)
    const { error } = await softDeleteRecord('session_participants', participant.id, 'Removed from session')

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.playerRemoved)
    setBusySessionId('')
  }

  async function deleteMyAccount() {
    if (!profile || !userId) return

    const confirmed = window.confirm(text.deleteAccountConfirm)
    if (!confirmed) return

    setIsDeletingAccount(true)
    setProfileStatus(text.saving)

    const { error } = await softDeleteRecord('profiles', userId, 'User deleted own account')

    if (error) {
      setProfileStatus(error.message)
      setIsDeletingAccount(false)
      return
    }

    await (await getSupabase()).auth.signOut()
    setUserId('')
    setAuthEmail('')
    setProfile(null)
    setNewPassword('')
    setProfileStatus(text.accountDeleted)
    setIsDeletingAccount(false)
    await loadSessions()
  }

  function tournamentStageLabel(stage: TournamentMatch['stage']) {
    return stage.replace('_', ' ')
  }

  async function addTournamentEditor(session: Session, selectedEditor?: Profile) {
    if (!isSessionCreator(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const email = tournamentEditorEmail.trim().toLowerCase()
    if (!email && !selectedEditor) return

    setBusyTournamentId(session.id)
    const profileLookup = selectedEditor
      ? { data: selectedEditor, error: null }
      : await (await getSupabase()).rpc('public_profile_search', {
        p_search: email,
        p_limit: 1,
      }).then(({ data, error }) => ({ data: (data ?? [])[0] as Profile | undefined, error }))

    const editorProfile = profileLookup.data
    if (profileLookup.error || !editorProfile) {
      setCreateStatus(profileLookup.error?.message || text.editorNotFound)
      setBusyTournamentId('')
      return
    }

    const display = compactDisplayName(displayName(editorProfile), text.player)
    const { error } = await (await getSupabase()).from('tournament_editors').upsert({
      session_id: session.id,
      profile_id: editorProfile.id,
      display_name: display,
      ...avatarFields(editorProfile),
    }, { onConflict: 'session_id,profile_id' })

    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    setTournamentEditorEmail('')
    setTournamentEditorResults([])
    await loadTournamentData()
    setCreateStatus(text.profileSaved)
    setBusyTournamentId('')
  }

  async function setupTournamentPools(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const participants = eligibleTournamentParticipants(session)
    if (participants.length < 2) {
      setCreateStatus(text.noTournamentData)
      return
    }

    setBusyTournamentId(session.id)
    const softDeleteResult = await softDeleteTournamentRecords(session.id, true, 'Tournament pools regenerated')
    if (softDeleteResult.error) {
      setCreateStatus(softDeleteResult.error.message)
      setBusyTournamentId('')
      return
    }

    const format = session.tournament_format || 'pool_to_final'
    const seededParticipants = shuffleItems(participants)
    const poolCount = format === 'single_elimination'
      ? 1
      : Math.max(1, Math.ceil(seededParticipants.length / tournamentPoolSize))
    const poolRows = Array.from({ length: poolCount }, (_, index) => ({
      session_id: session.id,
      name: format === 'single_elimination' ? 'Knockout' : `Pool ${String.fromCharCode(65 + index)}`,
      sort_order: index + 1,
    }))

    const { data: pools, error: poolError } = await (await getSupabase())
      .from('tournament_pools')
      .insert(poolRows)
      .select('id, session_id, name, sort_order')

    if (poolError || !pools) {
      setCreateStatus(poolError?.message || text.createError)
      setBusyTournamentId('')
      return
    }

    const entries = seededParticipants.map((participant, index) => {
      const pool = pools[index % pools.length]
      return {
        session_id: session.id,
        pool_id: pool.id,
        participant_id: participant.id,
        profile_id: participant.profile_id,
        seed: index + 1,
      }
    })

    const { error } = await (await getSupabase()).from('tournament_pool_entries').insert(entries)
    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    await loadTournamentData()
    setCreateStatus(text.tournamentSetup)
    setBusyTournamentId('')
  }

  async function generateTournamentMatches(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    if (!data.pools.length || !data.poolEntries.length) {
      setCreateStatus(text.noTournamentData)
      return
    }

    setBusyTournamentId(session.id)
    const softDeleteResult = await softDeleteTournamentRecords(session.id, false, 'Tournament matches regenerated')
    if (softDeleteResult.error) {
      setCreateStatus(softDeleteResult.error.message)
      setBusyTournamentId('')
      return
    }

    const bestOf = session.best_of || 1
    const format = session.tournament_format || 'pool_to_final'
    const matchRows: TournamentMatchInsert[] = format === 'single_elimination'
      ? buildKnockoutRows(session.id, data.poolEntries.map((entry) => entry.participant_id), 'custom', 1, bestOf)
      : data.pools.flatMap((pool) => {
      const poolEntries = data.poolEntries.filter((entry) => entry.pool_id === pool.id)
      const rows: TournamentMatchInsert[] = []
      let matchNumber = 1

      for (let i = 0; i < poolEntries.length; i += 1) {
        for (let j = i + 1; j < poolEntries.length; j += 1) {
          rows.push({
            session_id: session.id,
            pool_id: pool.id,
            stage: 'pool',
            round: 1,
            match_number: matchNumber,
            participant_a_id: poolEntries[i].participant_id,
            participant_b_id: poolEntries[j].participant_id,
            status: 'waiting',
            arena_number: null,
            queue_position: matchNumber,
            best_of: bestOf,
          })
          matchNumber += 1
        }
      }

      return rows
    })

    if (!matchRows.length) {
      setCreateStatus(text.noTournamentData)
      setBusyTournamentId('')
      return
    }

    const { error } = await (await getSupabase()).from('tournament_matches').insert(matchRows)
    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    await logTournamentAudit(session.id, 'Tournament matches generated', null, { format, bestOf, matchCount: matchRows.length })
    await loadTournamentData()
    setCreateStatus(text.tournamentGenerateMatches)
    setBusyTournamentId('')
  }

  async function updateTournamentPoolEntry(entry: TournamentPoolEntry, changes: Partial<TournamentPoolEntry>) {
    const { error } = await (await getSupabase())
      .from('tournament_pool_entries')
      .update({
        pool_id: changes.pool_id ?? entry.pool_id,
        team_label: changes.team_label ?? entry.team_label ?? null,
      })
      .eq('id', entry.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(entry.session_id, 'Pool entry edited', entry as unknown as Record<string, unknown>, changes as Record<string, unknown>)
    await loadTournamentData()
  }

  async function updateTournamentMatch(match: TournamentMatch, changes: Partial<TournamentMatch>) {
    const nextA = changes.participant_a_id ?? match.participant_a_id
    const nextB = changes.participant_b_id ?? match.participant_b_id
    if (hasDuplicateMatchPlayers({ participant_a_id: nextA, participant_b_id: nextB })) {
      setCreateStatus(text.duplicateMatchPlayer)
      return
    }

    const scoreA = changes.score_a ?? match.score_a
    const scoreB = changes.score_b ?? match.score_b
    const draft = {
      ...match,
      ...changes,
      participant_a_id: nextA,
      participant_b_id: nextB,
      score_a: scoreA,
      score_b: scoreB,
      wins_a: changes.wins_a ?? match.wins_a,
      wins_b: changes.wins_b ?? match.wins_b,
      best_of: changes.best_of ?? match.best_of,
    }
    const autoWinner = matchWinnerFromSeries(draft)
    const winner = changes.winner_participant_id ?? autoWinner ?? match.winner_participant_id
    const loser = matchLoser(draft, winner || null)
    const { error } = await (await getSupabase())
      .from('tournament_matches')
      .update({
        participant_a_id: nextA,
        participant_b_id: nextB,
        score_a: scoreA,
        score_b: scoreB,
        wins_a: changes.wins_a ?? match.wins_a ?? null,
        wins_b: changes.wins_b ?? match.wins_b ?? null,
        winner_participant_id: winner || null,
        loser_participant_id: loser || null,
        status: changes.status ?? (winner ? 'completed' : match.status === 'completed' ? 'waiting' : match.status),
        arena_number: changes.arena_number ?? match.arena_number ?? null,
        queue_position: changes.queue_position ?? match.queue_position ?? null,
      })
      .eq('id', match.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(match.session_id, 'Match edited', match as unknown as Record<string, unknown>, changes as Record<string, unknown>)
    await loadTournamentData()
  }

  async function advanceTournamentRound(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    const format = session.tournament_format || 'pool_to_final'
    const bestOf = session.best_of || 1
    let qualified: string[] = []

    if (format === 'pool_to_final' || format === 'pool_to_semifinal' || format === 'pool_only' || format === 'leaderboard') {
      const perPool = qualificationCount(session.qualification_rule, session.custom_qualifiers || 2)
      qualified = data.pools.flatMap((pool) => poolStandingsForSession(session, pool).slice(0, perPool).map((standing) => standing.participantId))
      if (format === 'pool_only' || format === 'leaderboard') {
        setCreateStatus(text.tournamentPoolFinal)
        return
      }
    } else {
      const latestRound = Math.max(1, ...data.matches.map((match) => match.round))
      qualified = data.matches
        .filter((match) => match.round === latestRound && match.winner_participant_id)
        .map((match) => match.winner_participant_id as string)
    }

    qualified = Array.from(new Set(qualified)).filter(Boolean)

    if (qualified.length < 2) {
      setCreateStatus(text.noTournamentData)
      return
    }

    const existingKnockout = data.matches.some((match) => match.stage !== 'pool')
    const nextRound = existingKnockout ? Math.max(1, ...data.matches.map((match) => match.round)) + 1 : 2
    const desired = format === 'pool_to_final' ? qualified.slice(0, 2) : qualified
    const stage: MatchStage = format === 'pool_to_final' ? 'final' : knockoutStageForCount(desired.length)
    const matchRows = buildKnockoutRows(session.id, desired, stage, nextRound, bestOf)

    const { error } = await (await getSupabase()).from('tournament_matches').insert(matchRows)
    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(session.id, 'Round advanced', null, { qualified: desired, stage, round: nextRound })
    await loadTournamentData()
    setCreateStatus(text.tournamentNextRound)
  }

  async function finishTournament(session: Session) {
    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    const finalMatch = [...data.matches].reverse().find((match) => match.stage === 'final' && match.winner_participant_id)
    const thirdMatch = [...data.matches].reverse().find((match) => match.stage === 'third_place' && match.winner_participant_id)
    const semifinalLosers = data.matches
      .filter((match) => match.stage === 'semifinal' && match.loser_participant_id)
      .map((match) => match.loser_participant_id as string)

    const standingsPodium = data.pools
      .flatMap((pool) => poolStandingsForSession(session, pool))
      .sort((a, b) => b.points - a.points || b.scoreDifference - a.scoreDifference || b.scoreFor - a.scoreFor)
      .map((standing) => standing.participantId)

    const first = finalMatch?.winner_participant_id || standingsPodium[0] || null
    const second = finalMatch ? matchLoser(finalMatch, first) : standingsPodium.find((id) => id !== first) || null
    const third = thirdMatch?.winner_participant_id || semifinalLosers.find((id) => id !== second && id !== first) || standingsPodium.find((id) => id !== first && id !== second) || null

    if (!first) {
      setCreateStatus(text.tournamentFinishNeedsFinal)
      return
    }

    if (first) await (await getSupabase()).from('session_participants').update({ placement: 1 }).eq('id', first)
    if (second) await (await getSupabase()).from('session_participants').update({ placement: 2 }).eq('id', second)
    if (third) await (await getSupabase()).from('session_participants').update({ placement: 3 }).eq('id', third)
    await (await getSupabase()).from('sessions').update({ status: 'completed', tournament_locked: true }).eq('id', session.id)

    await logTournamentAudit(session.id, 'Tournament finished', null, { first, second, third })
    await loadSessions()
    await loadTournamentData()
    setCreateStatus(text.tournamentFinished)
  }

  async function createThirdPlaceMatch(session: Session) {
    if (!canEditTournamentSession(session) || !session.enable_third_place_match) return
    const data = tournamentForSession(session.id)
    if (data.matches.some((match) => match.stage === 'third_place')) return

    const losers = data.matches
      .filter((match) => match.stage === 'semifinal' && match.loser_participant_id)
      .map((match) => match.loser_participant_id as string)

    if (losers.length < 2 || new Set(losers).size < 2) return

    const { error } = await (await getSupabase()).from('tournament_matches').insert({
      session_id: session.id,
      pool_id: null,
      stage: 'third_place',
      round: Math.max(1, ...data.matches.map((match) => match.round)) + 1,
      match_number: 1,
      participant_a_id: losers[0],
      participant_b_id: losers[1],
      status: 'waiting',
      queue_position: 99,
      best_of: session.best_of || 1,
    })

    if (!error) {
      await logTournamentAudit(session.id, 'Bronze match created', null, { participants: losers.slice(0, 2) })
      await loadTournamentData()
    }
  }

  async function claimPrize(participant: Participant, claimed: boolean) {
    const { error } = await (await getSupabase())
      .from('session_participants')
      .update({
        prize_claimed: claimed,
        prize_claimed_at: claimed ? new Date().toISOString() : null,
      })
      .eq('id', participant.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await loadSessions()
  }

  async function shareCurrentUserStats(contextLabel = '') {
    if (!profile || !hasShareablePlayerStats(playerStats)) {
      setProfileStatus(text.statsShareUnavailable)
      return
    }

    const playerName = compactDisplayName(playerStats.displayName || displayName(profile), text.player)
    const title = contextLabel ? `${text.statsShareTitle} · ${contextLabel}` : text.statsShareTitle
    const bestScore = playerStats.bestByGame[0]
    const summary = [
      `${title}: ${playerName}`,
      `${text.totalScore}: ${playerStats.totalScore}`,
      `${text.gamesPlayedCriterion}: ${playerStats.gamesJoined}`,
      `${text.wins}: ${playerStats.wins}`,
      `${bestPerformerCountText}: ${playerStats.bestPerformerCount}`,
      `${text.accuracy}: ${formatWholePercent(playerStats.averageAccuracy)}`,
      `${text.projectiles}: ${playerStats.totalProjectiles}`,
      bestScore ? `${text.bestScores}: ${bestScore.game} ${bestScore.score}` : '',
      DEFAULT_APP_URL,
    ].filter(Boolean).join('\n')

    let templateImage: HTMLImageElement | null = null
    try {
      templateImage = await loadCanvasImage(`${window.location.origin}/brand/tournament-leaderboard-template.jpg`)
    } catch {
      templateImage = null
    }

    const canvas = document.createElement('canvas')
    canvas.width = templateImage?.naturalWidth || 1080
    canvas.height = templateImage?.naturalHeight || 1350
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      if (navigator.share) {
        await navigator.share({ title, text: summary, url: DEFAULT_APP_URL })
        setSharedKey('stats')
        return
      }

      await navigator.clipboard?.writeText(summary)
      setProfileStatus(text.statsShareReady)
      setSharedKey('stats')
      return
    }

    const fitText = (value: string, x: number, y: number, maxWidth: number, size: number, color = '#071112', weight = 900, align: CanvasTextAlign = 'center') => {
      let fontSize = size
      ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      while (ctx.measureText(value).width > maxWidth && fontSize > 18) {
        fontSize -= 2
        ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      }
      ctx.fillStyle = color
      ctx.textAlign = align
      ctx.fillText(value, x, y)
    }

    const drawShareAvatar = async (x: number, y: number, size: number) => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
      ctx.clip()

      let drewPhoto = false
      if (playerStats.avatarUrl) {
        try {
          const image = await loadCanvasImage(playerStats.avatarUrl)
          const imageWidth = image.naturalWidth || image.width
          const imageHeight = image.naturalHeight || image.height
          const scale = Math.max(size / imageWidth, size / imageHeight)
          const drawWidth = imageWidth * scale
          const drawHeight = imageHeight * scale
          ctx.drawImage(image, x + (size - drawWidth) / 2, y + (size - drawHeight) / 2, drawWidth, drawHeight)
          drewPhoto = true
        } catch {
          drewPhoto = false
        }
      }

      if (!drewPhoto) {
        const avatarGradient = ctx.createLinearGradient(x, y, x + size, y + size)
        avatarGradient.addColorStop(0, playerStats.avatarColor || '#00b6c6')
        avatarGradient.addColorStop(1, '#3059ff')
        ctx.fillStyle = avatarGradient
        ctx.fillRect(x, y, size, size)
        ctx.fillStyle = playerStats.avatarTextColor || '#ffffff'
        ctx.font = `900 ${playerStats.avatarEmoji ? size * 0.5 : size * 0.34}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(playerStats.avatarEmoji || compactInitials(playerStats.avatarInitials || playerStats.displayName || text.player).slice(0, 2), x + size / 2, y + size / 2)
      }

      ctx.restore()
    }

    if (templateImage) {
      ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height)
    } else {
      const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      background.addColorStop(0, '#f6fbfb')
      background.addColorStop(1, '#dfe8ff')
      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    ctx.save()
    ctx.shadowColor = 'rgba(7, 17, 18, 0.18)'
    ctx.shadowBlur = 34
    ctx.shadowOffsetY = 18
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    drawCanvasRoundRect(ctx, 92, 118, canvas.width - 184, canvas.height - 236, 42)
    ctx.fill()
    ctx.restore()

    ctx.textBaseline = 'alphabetic'
    fitText(title, canvas.width / 2, 220, 740, 44)

    await drawShareAvatar(canvas.width / 2 - 104, 278, 208)

    ctx.strokeStyle = '#3059ff'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(canvas.width / 2, 382, 108, 0, Math.PI * 2)
    ctx.stroke()

    fitText(playerName, canvas.width / 2, 552, 740, 54)
    if (contextLabel) {
      fitText(contextLabel, canvas.width / 2, 598, 660, 26, '#657278', 800)
    }

    const primaryStats = [
      { label: text.totalScore, value: playerStats.totalScore.toLocaleString('en-US') },
      { label: text.gamesPlayedCriterion, value: `${playerStats.gamesJoined}` },
      { label: text.wins, value: `${playerStats.wins}` },
      { label: bestPerformerCountText, value: `${playerStats.bestPerformerCount}` },
      { label: text.accuracy, value: formatWholePercent(playerStats.averageAccuracy) },
      { label: text.projectiles, value: `${playerStats.totalProjectiles}` },
    ]

    const cardWidth = 276
    const cardHeight = 138
    const startX = (canvas.width - cardWidth * 3 - 34 * 2) / 2
    const startY = 656

    primaryStats.forEach((stat, index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
      const x = startX + col * (cardWidth + 34)
      const y = startY + row * (cardHeight + 28)

      ctx.fillStyle = '#f0f4f6'
      drawCanvasRoundRect(ctx, x, y, cardWidth, cardHeight, 24)
      ctx.fill()
      fitText(stat.label, x + cardWidth / 2, y + 44, cardWidth - 36, 24, '#657278', 800)
      fitText(stat.value, x + cardWidth / 2, y + 98, cardWidth - 36, 46, '#071112', 900)
    })

    const bestScores = playerStats.bestByGame.slice(0, 3)
    if (bestScores.length > 0) {
      fitText(text.bestScores, canvas.width / 2, 1064, 700, 30, '#071112', 900)
      bestScores.forEach((item, index) => {
        fitText(`${item.game}: ${item.score}`, canvas.width / 2, 1110 + index * 40, 720, 28, '#39464b', 800)
      })
    }

    fitText('vrena-booking.vercel.app', canvas.width / 2, canvas.height - 94, 700, 24, '#657278', 800)

    let blob: Blob | null = null
    try {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    } catch {
      blob = null
    }

    if (!blob) {
      if (navigator.share) {
        await navigator.share({ title, text: summary, url: DEFAULT_APP_URL })
        setSharedKey('stats')
        return
      }
      await navigator.clipboard?.writeText(summary)
      setProfileStatus(text.statsShareReady)
      setSharedKey('stats')
      return
    }

    const file = new File([blob], `${safeDownloadSlug(playerName, 'vrena-player')}-stats.jpg`, { type: 'image/jpeg' })

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text: summary })
      setSharedKey('stats')
      return
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    URL.revokeObjectURL(url)
    setProfileStatus(text.statsShareReady)
    setSharedKey('stats')
  }

  async function shareTournamentResults(session: Session) {
    const podium = [1, 2, 3]
      .map((placement) => (session.session_participants ?? []).find((participant) => participant.placement === placement))
      .filter(Boolean) as Participant[]
    const summary = [
      `🏆 ${session.name}`,
      ...podium.map((participant) => `${rankEmoji(participant.placement)} ${compactDisplayName(participant.display_name, text.player)}${participant.score ? ` · ${participant.score}` : ''}`),
      DEFAULT_APP_URL,
    ].join('\n')

    if (podium.length === 0) {
      if (navigator.share) {
        await navigator.share({ title: session.name, text: summary, url: DEFAULT_APP_URL })
        return
      }

      await navigator.clipboard?.writeText(summary)
      setSharedKey(`results-${session.id}`)
      return
    }

    let templateImage: HTMLImageElement | null = null
    try {
      templateImage = await loadCanvasImage(`${window.location.origin}/brand/tournament-leaderboard-template.jpg`)
    } catch {
      templateImage = null
    }

    const canvas = document.createElement('canvas')
    canvas.width = templateImage?.naturalWidth || 1080
    canvas.height = templateImage?.naturalHeight || 1350
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      if (navigator.share) {
        await navigator.share({ title: session.name, text: summary, url: DEFAULT_APP_URL })
        return
      }

      await navigator.clipboard?.writeText(summary)
      setSharedKey(`results-${session.id}`)
      return
    }

    const drawRoundAvatar = async (participant: Participant, x: number, y: number, size: number) => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
      ctx.clip()

      let drewPhoto = false
      if (participant.avatar_url) {
        try {
          const image = new Image()
          image.crossOrigin = 'anonymous'
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('avatar failed'))
            image.src = participant.avatar_url || ''
          })
          const imageWidth = image.naturalWidth || image.width
          const imageHeight = image.naturalHeight || image.height
          const scale = Math.max(size / imageWidth, size / imageHeight)
          const drawWidth = imageWidth * scale
          const drawHeight = imageHeight * scale
          ctx.drawImage(image, x + (size - drawWidth) / 2, y + (size - drawHeight) / 2, drawWidth, drawHeight)
          drewPhoto = true
        } catch {
          drewPhoto = false
        }
      }

      if (!drewPhoto) {
        const avatarGradient = ctx.createLinearGradient(x, y, x + size, y + size)
        avatarGradient.addColorStop(0, participant.avatar_color || '#00b6c6')
        avatarGradient.addColorStop(1, '#3059ff')
        ctx.fillStyle = avatarGradient
        ctx.fillRect(x, y, size, size)
        ctx.fillStyle = '#ffffff'
        ctx.font = `800 ${participant.avatar_emoji ? size * 0.48 : size * 0.34}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(participant.avatar_emoji || compactInitials(participant.avatar_initials || participant.display_name || text.player).slice(0, 2), x + size / 2, y + size / 2)
      }

      ctx.restore()
    }

    const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
      const safeRadius = Math.min(radius, width / 2, height / 2)
      ctx.beginPath()
      ctx.moveTo(x + safeRadius, y)
      ctx.lineTo(x + width - safeRadius, y)
      ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
      ctx.lineTo(x + width, y + height - safeRadius)
      ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
      ctx.lineTo(x + safeRadius, y + height)
      ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
      ctx.lineTo(x, y + safeRadius)
      ctx.quadraticCurveTo(x, y, x + safeRadius, y)
      ctx.closePath()
    }

    const drawPodiumCard = async () => {
      if (templateImage) {
        ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height)
      } else {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      ctx.fillStyle = '#071112'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'

      const fitText = (value: string, x: number, y: number, maxWidth: number, size: number, color = '#071112', weight = 900) => {
        let fontSize = size
        ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        while (ctx.measureText(value).width > maxWidth && fontSize > 22) {
          fontSize -= 2
          ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        }
        ctx.fillStyle = color
        ctx.fillText(value, x, y)
      }

      fitText(session.name, canvas.width / 2, 300, 820, 46, '#071112', 900)

      ctx.fillStyle = '#4a5a60'
      ctx.font = '800 28px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ctx.fillText(`${formatShortDate(session.date, language)} · ${session.start_time.slice(0, 5)}`, canvas.width / 2, 338)

      const orderedPodium = [2, 1, 3]
        .map((placement) => podium.find((participant) => participant.placement === placement))
        .filter(Boolean) as Participant[]
      const slots = [
        { placement: 2, x: 125, y: 790, w: 285, h: 172, avatar: 178, avatarY: 580, accent: '#b7c0ca', fill: '#f4f6f8', emoji: '🥈' },
        { placement: 1, x: 388, y: 672, w: 304, h: 290, avatar: 232, avatarY: 405, accent: '#ffc928', fill: '#fff6cf', emoji: '🏆' },
        { placement: 3, x: 670, y: 820, w: 285, h: 142, avatar: 178, avatarY: 610, accent: '#c98742', fill: '#fff0df', emoji: '🥉' },
      ]

      for (const participant of orderedPodium) {
        const slot = slots.find((item) => item.placement === participant.placement)
        if (!slot) continue

        ctx.save()
        ctx.shadowColor = 'rgba(7, 17, 18, 0.12)'
        ctx.shadowBlur = 22
        ctx.shadowOffsetY = 12
        ctx.fillStyle = slot.accent
        roundedRect(slot.x, slot.y, slot.w, slot.h, 26)
        ctx.fill()
        ctx.restore()

        ctx.fillStyle = slot.fill
        roundedRect(slot.x + 8, slot.y + 8, slot.w - 16, slot.h - 16, 20)
        ctx.fill()

        await drawRoundAvatar(participant, slot.x + slot.w / 2 - slot.avatar / 2, slot.avatarY, slot.avatar)

        ctx.strokeStyle = slot.accent
        ctx.lineWidth = slot.placement === 1 ? 8 : 6
        ctx.beginPath()
        ctx.arc(slot.x + slot.w / 2, slot.avatarY + slot.avatar / 2, slot.avatar / 2 + 4, 0, Math.PI * 2)
        ctx.stroke()

        ctx.font = `900 ${slot.placement === 1 ? 58 : 46}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(slot.emoji, slot.x + slot.w / 2 + slot.avatar / 2 - 8, slot.avatarY + 18)

        ctx.textBaseline = 'alphabetic'
        fitText(compactDisplayName(participant.display_name, text.player), slot.x + slot.w / 2, slot.y + slot.h - 78, slot.w - 34, slot.placement === 1 ? 38 : 32)

        ctx.fillStyle = '#39464b'
        ctx.font = `800 ${slot.placement === 1 ? 26 : 23}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillText(`${participant.score ?? 0} pts · ${participant.accuracy_percent ?? '-'}%`, slot.x + slot.w / 2, slot.y + slot.h - 38)
      }
    }

    await drawPodiumCard()

    let blob: Blob | null = null
    try {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    } catch {
      blob = null
    }

    if (!blob) {
      if (navigator.share) {
        await navigator.share({ title: session.name, text: summary, url: DEFAULT_APP_URL })
        return
      }
      await navigator.clipboard?.writeText(summary)
      setSharedKey(`results-${session.id}`)
      return
    }

    const file = new File([blob], `${session.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'vrena-tournament'}-results.jpg`, { type: 'image/jpeg' })

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: session.name, text: summary })
      return
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    URL.revokeObjectURL(url)
    setSharedKey(`results-${session.id}`)
  }

  function voteCount(session: Session, gameId: GameId) {
    return Object.values(session.game_votes || {}).filter((vote) => vote === gameId).length
  }

  function renderProfileSessionCard(session: Session) {
    const participants = session.session_participants ?? []
    const createdByMe = session.owner_id === userId
    const canManage = canManageSession(session)
    const joinedByMe = participants.some((participant) => participant.profile_id === userId)
    const isChallenge = isChallengeSession(session)
    const canSeeInviteCode = !isTicketSession(session) && !isChallenge && session.visibility === 'private' && session.invite_code && (canManage || joinedByMe)
    const coverGame = sessionCoverGame(session)

    return (
      <article
        className="mini-session clickable"
        key={session.id}
        onClick={() => openSessionFromProfile(session.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openSessionFromProfile(session.id)
          }
        }}
      >
        <div className="mini-session-title mini-session-title-with-image">
          <NextImage className="mini-session-image" src={coverGame.image} alt="" width={84} height={84} />
          <strong>{session.name}</strong>
          {isTicketSession(session) && <span className="pill ticket-pill">{text.privateTicketSession}</span>}
          {isChallenge && <span className="pill challenge-pill">{text.challengeSession}</span>}
          <span className={createdByMe ? 'pill ok' : 'pill'}>
            {createdByMe ? text.createdByYou : text.joined}
          </span>
        </div>
        <div className="row-meta">
          <span>{formatShortDate(session.date, language)}</span>
          <span>{session.start_time.slice(0, 5)}</span>
          <span>{session.duration_minutes} min</span>
          <span>{participants.length}/{session.max_players} {text.players}</span>
          <span>{arenasUsedBySession(session)} arena{arenasUsedBySession(session) === 1 ? '' : 's'}</span>
        </div>
        {canSeeInviteCode && (
          <div className="invite-code compact">
            <span>{text.privateCode}</span>
            <strong>{session.invite_code}</strong>
            <button
              className={copiedInviteId === session.id ? 'copied' : ''}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                copyInviteCode(session.id, session.invite_code)
              }}
            >
              {copiedInviteId === session.id ? text.copied : text.copy}
            </button>
          </div>
        )}
        {canManage ? (
          <div className="mini-session-actions">
            <button
              className="secondary small-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                startEditingSession(session)
                openSessionFromProfile(session.id)
              }}
            >
              {text.editSession}
            </button>
            <button
              className={busySessionId === session.id ? 'danger small-button loading' : 'danger small-button'}
              disabled={busySessionId === session.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                cancelSession(session)
              }}
            >
              {text.cancelSession}
            </button>
          </div>
        ) : joinedByMe ? (
          <div className="mini-session-actions">
            <button
              className={busySessionId === session.id ? 'secondary small-button loading' : 'secondary small-button'}
              disabled={busySessionId === session.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                leaveSession(session)
              }}
            >
              {text.leaveSession}
            </button>
          </div>
        ) : null}
      </article>
    )
  }

  function renderPendingInvite(invite: SessionInvite) {
    const session = sessionForInvite(invite)
    if (!session) return null

    const coverGame = sessionCoverGame(session)
    const isChallenge = isChallengeSession(session)

    return (
      <article className="mini-session invite-session" key={invite.id}>
        <div className="mini-session-title mini-session-title-with-image">
          <NextImage className="mini-session-image" src={coverGame.image} alt="" width={84} height={84} />
          <strong>{session.name}</strong>
          <span className="pill ok">{isChallenge ? text.challengeInviteLabel : text.invited}</span>
        </div>
        <div className="row-meta">
          <span>{formatShortDate(session.date, language)}</span>
          <span>{session.start_time.slice(0, 5)}</span>
          <span>{session.duration_minutes} min</span>
          <span>{(session.session_participants ?? []).length}/{session.max_players} {text.players}</span>
        </div>
        <div className="mini-session-actions">
          <button className="primary small-button" type="button" onClick={() => openSessionFromProfile(session.id)}>
            {openInvitationText}
          </button>
          <button className="secondary small-button" type="button" onClick={() => downloadSessionCalendar(session)}>
            <ButtonIconText icon={<CalendarPlus aria-hidden="true" size={15} />}>{addToCalendarText}</ButtonIconText>
          </button>
        </div>
      </article>
    )
  }

  const appAside = (
      <aside>
        <div>
          <div className="app-title-row">
            <a className="brand-logo" href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer" aria-label="VRena Vietnam">
              <picture>
                <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-logo-full-dark.svg" />
                <img src="/brand/vrena-logo-full-light.svg" alt="VRena" />
              </picture>
            </a>
            <div className="language-picker">
              <button
                aria-expanded={languagePickerOpen}
                aria-label={text.language}
                type="button"
                onClick={() => setLanguagePickerOpen((open) => !open)}
              >
                {language.toUpperCase()}
              </button>
              {languagePickerOpen && (
                <div className="language-menu">
                  {languageOptions.map((item) => (
                    <button
                      className={language === item ? 'active' : ''}
                      key={item}
                      aria-pressed={language === item}
                      type="button"
                      onClick={() => {
                        setLanguage(item)
                        storeLanguage(item)
                        setLanguagePickerOpen(false)
                      }}
                    >
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              aria-label={sharedKey === 'app' ? text.shared : text.shareApp}
              className={sharedKey === 'app' ? 'share-button app-share copied' : 'share-button app-share'}
              title={sharedKey === 'app' ? text.shared : text.shareApp}
              type="button"
              onClick={() => shareLink('app', 'VRena Sessions')}
            >
              <ShareSymbol />
            </button>
          </div>
          <h1 className="sr-only">VRena Sessions</h1>
          <p className="muted">{text.tagline}</p>
        </div>

        <button className={activeView === 'profile' ? 'profile-chip active' : 'profile-chip'} onClick={() => setActiveView('profile')} type="button">
          <div className="avatar" style={avatarStyle(currentProfileAvatar)}>
            {avatarNode(profile ? {
              avatar_url: currentProfileAvatar?.avatar_url,
              avatar_emoji: currentProfileAvatar?.avatar_emoji,
              avatar_initials: currentProfileAvatar?.avatar_initials,
              avatar_color: currentProfileAvatar?.avatar_color,
              avatar_text_color: currentProfileAvatar?.avatar_text_color,
              display_name: displayName(profile),
            } : null, 'P')}
            {crownedTopPlayer?.profileId === userId && <span className="champion-badge">🏆</span>}
          </div>
          <div>
            <strong>{profile ? displayName(profile) : text.noProfile}</strong>
            <span>{profile ? profile.profile_motto || text.profileMottoEmpty : text.clickLogin}</span>
          </div>
        </button>

        <div className={canAccessStaffConsole ? 'tabs staff-tabs-visible' : 'tabs'}>
          <button className={activeView === 'sessions' || activeView === 'create' ? 'tab active' : 'tab'} onClick={() => setActiveView('sessions')}>
            {text.sessions}
          </button>
          <button className={activeView === 'tickets' ? 'tab active' : 'tab'} onClick={() => setActiveView('tickets')}>
            {text.tickets}
          </button>
          <button className={activeView === 'leaderboard' ? 'tab active' : 'tab'} onClick={() => setActiveView('leaderboard')}>
            {text.hallOfFame}
          </button>
          <button className={activeView === 'clubs' ? 'tab active' : 'tab'} onClick={() => setActiveView('clubs')}>
            {text.clubs}
          </button>
          {canAccessStaffConsole && (
            <button className={activeView === 'staff' ? 'tab active mobile-staff-tab' : 'tab mobile-staff-tab'} onClick={() => setActiveView('staff')}>
              Staff
            </button>
          )}
        </div>

        <div className="shop-contact">
          <strong>VRena Vietnam</strong>
          <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
          <a href="https://zalo.me/84981152315" target="_blank" rel="noreferrer">Zalo: 0981152315</a>
          <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
        </div>
      </aside>
  )

  const appMain = (
      <main>
        {activeView === 'sessions' && (
          <section className="section sessions-section">
            <div className="section-head sessions-filter-head">
              <div className="section-copy">
                <h2>{text.availableSessions}</h2>
                <p className="muted">{text.privateJoinHint}</p>
              </div>
              <div className={isSearchOpen ? 'search-shell open' : 'search-shell'} ref={searchShellRef}>
                <button
                  aria-label={text.searchSessions}
                  className="mobile-search-toggle"
                  type="button"
                  onClick={() => setIsSearchOpen((open) => !open)}
                >
                  <Search aria-hidden="true" size={24} strokeWidth={2.35} />
                </button>
                <input
                  className="search"
                  type="search"
                  placeholder={text.searchPlaceholder}
                  value={search}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {(isSearchOpen || search || selectedSessionDate) && (
                  <button
                    aria-label={text.close}
                    className="search-close"
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setSelectedSessionDate('')
                      setIsSearchOpen(false)
                    }}
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                )}
              </div>
            </div>
            {(isSearchOpen || search || selectedSessionDate) && (
              <div className="day-strip" aria-label={text.date} ref={dayStripRef}>
                <button
                  className={!selectedSessionDate ? 'day-chip active' : 'day-chip'}
                  type="button"
                  onClick={() => setSelectedSessionDate('')}
                >
                  <strong>{text.allDays}</strong>
                </button>
                {sessionDayOptions.map((day) => (
                  <button
                    className={selectedSessionDate === day.value ? 'day-chip active' : 'day-chip'}
                    key={day.value}
                    type="button"
                    onClick={() => setSelectedSessionDate(day.value)}
                  >
                    <span>{day.weekday}</span>
                    <strong>{day.day}</strong>
                  </button>
                ))}
              </div>
            )}
            {renderTariffTrigger()}
            {createStatus && <p className="notice">{createStatus}</p>}

            {sessionReminders.length > 0 && (
              <div className="reminder-strip" aria-label={text.sessionReminders}>
                <div className="reminder-strip-head">
                  <strong>{text.sessionReminders}</strong>
                  <button
                    className={isPushSubscribed ? 'secondary small-button' : 'primary small-button'}
                    disabled={isEnablingPush || isPushSubscribed}
                    type="button"
                    onClick={enablePushReminders}
                  >
                    {isPushSubscribed ? text.remindersEnabled : isEnablingPush ? text.enablingReminders : text.enableReminders}
                  </button>
                </div>
                {pushReminderStatus && <small className="push-reminder-status">{pushReminderStatus}</small>}
                {sessionReminders.slice(0, 3).map(({ session, label }) => (
                  <button key={session.id} type="button" onClick={() => openSessionFromProfile(session.id)}>
                    <span>{label}</span>
                    <small>{session.name} · {formatShortDate(session.date, language)} {session.start_time.slice(0, 5)}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="sub-tabs">
              <button
                className={sessionTimeScope === 'upcoming' ? 'active' : ''}
                type="button"
                onClick={() => {
                  setSessionTimeScope('upcoming')
                  setSelectedSessionDate('')
                }}
              >
                {text.upcoming}
              </button>
              <button
                className={sessionTimeScope === 'past' ? 'active' : ''}
                type="button"
                onClick={() => {
                  setSessionTimeScope('past')
                  setSelectedSessionDate('')
                }}
              >
                {text.past}
              </button>
              <button
                className="create-session-tab"
                type="button"
                onClick={() => (profile ? setActiveView('create') : promptLogin())}
              >
                {text.createSession}
              </button>
            </div>

            <div className="list">
              {filteredSessions.length === 0 && !(sessionTimeScope === 'past' && isLoadingPastSessions) && <p className="notice">{text.noMatchingSessions}</p>}
              {sessionTimeScope === 'past' && isLoadingPastSessions && <p className="notice" aria-busy="true">...</p>}

              {filteredSessions.map((session) => {
                const participants = session.session_participants ?? []
                const waitlist = waitlistForSession(session)
                const remaining = seatsLeft(session)
                const alreadyJoined = participants.some((participant) => participant.profile_id === userId)
                const myWaitlistPosition = userId ? waitlistPosition(session, userId) : null
                const isSessionOwner = session.owner_id === userId
                const isTicket = isTicketSession(session)
                const isChallenge = isChallengeSession(session)
                const canManage = canManageSession(session)
                const canExpandTicketSession = isSessionCreator(session) || canStaffExpandTicketSessions
                const canExpandDetails = isTicket
                  ? canExpandTicketSession
                  : isChallenge
                    ? Boolean(isSessionOwner || isAdmin || alreadyJoined || session.challenge_target_id === userId)
                    : true
                const canSeeInviteCode = !isTicket && !isChallenge && session.visibility === 'private' && session.invite_code && (alreadyJoined || isSessionOwner || isAdmin)
                const isEditing = editingSessionId === session.id
                const sessionClub = sessionClubFor(session)
                const sessionClubMembership = clubMembershipFor(sessionClub)
                const canJoinThisSession = canAccessClubSession(session)
                const canSeeSessionPlayers = canSeeClubPrivateData(sessionClub)
                const isExpanded = canExpandDetails && Boolean(expandedSessions[session.id])
                const isHighlighted = highlightedSessionId === session.id
                const isPast = isPastSession(session)
                const canMutatePastSession = !isPast || canManage
                const coverGame = sessionCoverGame(session)
                const confirmedGameDraft = confirmedGameDrafts[session.id] ?? session.confirmed_game_id ?? ''
                const confirmedGameSaved = Boolean(session.confirmed_game_id) && confirmedGameDraft === session.confirmed_game_id
                const confirmedGameOptions = isTicket || isChallenge
                  ? games
                  : session.game_options
                    .map((gameId) => games.find((item) => item.id === gameId))
                    .filter((game): game is (typeof games)[number] => Boolean(game))
                const sessionInviteRows = invitesForSession(session.id)
                const invitedMe = sessionInviteRows.some((invite) => invite.recipient_id === userId)
                const invitedIds = new Set(sessionInviteRows.map((invite) => invite.recipient_id))
                const friendInviteTargets = friendList().map((friend) => ({
                  profile_id: friend.following_id,
                  display_name: friend.display_name,
                  avatar_url: friend.avatar_url,
                  avatar_emoji: friend.avatar_emoji,
                  avatar_initials: friend.avatar_initials,
                  avatar_color: friend.avatar_color,
                  avatar_text_color: friend.avatar_text_color,
                  profile_motto: friend.profile_motto,
                }))
                const previousInviteTargets = previousPlayersForSession(session)
                const inviteTargets = [...friendInviteTargets, ...previousInviteTargets]
                  .filter((target, index, list) => list.findIndex((item) => item.profile_id === target.profile_id) === index)
                  .filter((target) => !participants.some((participant) => participant.profile_id === target.profile_id))
                const normalizedInviteSearch = inviteModalSessionId === session.id ? inviteSearch.trim().toLocaleLowerCase() : ''
                const filteredInviteTargets = normalizedInviteSearch
                  ? inviteTargets.filter((target) => {
                    const displayName = compactDisplayName(target.display_name, text.player).toLocaleLowerCase()
                    const motto = (target.profile_motto || '').toLocaleLowerCase()
                    return displayName.includes(normalizedInviteSearch) || motto.includes(normalizedInviteSearch)
                  })
                  : inviteTargets
                const visibleInviteTargets = filteredInviteTargets.slice(0, 24)
                const sessionMessageRows = messagesForSession(session)
                const sessionMessagePage = sessionMessagePages[session.id]
                const isSessionMessagesLoading = Boolean(sessionMessagePage?.loading)
                const hasEarlierSessionMessages = Boolean(sessionMessagePage?.hasMore && sessionMessagePage.oldestCreatedAt)
                const isSessionDetailLoading = Boolean(loadingSessionDetailIds[session.id])
                const isSessionDetailLoaded = Boolean(loadedSessionDetailIds[session.id])
                const hasCrownHolder = Boolean(
                  crownedTopPlayer?.profileId
                  && crownedTopPlayer.profileId !== userId
                  && participants.some((participant) => participant.profile_id === crownedTopPlayer.profileId)
                )

                return (
                  <article
                    className={[
                      'session',
                      isExpanded ? 'expanded-session' : '',
                      isHighlighted ? 'session-highlighted' : '',
                    ].filter(Boolean).join(' ')}
                    id={`session-${session.id}`}
                    key={session.id}
                  >
                    <div
                      className={isExpanded ? 'compact-session-card compact-session-card-expanded' : 'compact-session-card'}
                      onClick={(event) => {
                        if (!canExpandDetails) return
                        if (isInteractiveClickTarget(event.target)) return
                        setSessionExpanded(session, !isExpanded)
                      }}
                      role={canExpandDetails ? 'button' : undefined}
                      tabIndex={canExpandDetails ? 0 : undefined}
                      onKeyDown={(event) => {
                        if (!canExpandDetails) return
                        if (isInteractiveClickTarget(event.target)) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSessionExpanded(session, !isExpanded)
                        }
                      }}
                    >
                      <NextImage className="compact-session-image" src={coverGame.image} alt="" width={116} height={116} />
                      <div className="compact-session-main">
                        <div className="compact-session-title-row">
                          <h3>{session.name}</h3>
                          <span className={session.session_type === 'tournament' ? 'pill private' : 'pill ok'}>
                            {session.session_type === 'tournament' ? text.tournament : text.normalGame}
                          </span>
                          <span className={session.visibility === 'private' ? 'pill private' : 'pill ok'}>
                            {session.visibility === 'private' ? text.private : text.public}
                          </span>
                          {isTicket && <span className="pill ticket-pill">{text.privateTicketSession}</span>}
                          {isChallenge && <span className="pill challenge-pill">{text.challengeSession}</span>}
                          {isChallenge && session.challenge_status && <span className="pill ok">{challengeStatusLabel(session.challenge_status)}</span>}
                          {session.seeded && <span className="pill soft-opening-pill">{session.seed_label || text.softOpeningHighlights}</span>}
                          {isSessionOwner && <span className="pill host-pill">{text.host}</span>}
                          {!isTicket && !isChallenge && invitedMe && <span className="pill ok">{text.invited}</span>}
                        </div>
                        <div className="row-meta compact-meta">
                          <span>{formatShortDate(session.date, language)}</span>
                          <span>{session.start_time.slice(0, 5)}</span>
                          <span>{session.duration_minutes} min</span>
                          {renderGameGuideTrigger(coverGame.id, 'compact-game-guide-link')}
                          {!isTicket && !isPast && <span>{remaining} {text.seatsLeft}</span>}
                          {isPast && <span>{text.finalGame}: {coverGame.title}</span>}
                          {session.session_type === 'tournament' && <span>{text.roundsPerMatch}: {session.rounds_per_match || 1}</span>}
                          {isTicket && <span>{session.ticket_player_count || session.max_players} {text.players}</span>}
                        </div>
                      </div>
                      <div className="compact-session-actions">
                          {!isTicket && !isChallenge && !isPast && (!sessionClub || canJoinThisSession) && session.visibility === 'private' && !alreadyJoined && !myWaitlistPosition && !invitedMe && (
                          <input
                            className="compact-code"
                            placeholder={text.privateCode}
                            value={joinCodes[session.id] || ''}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setJoinCodes((current) => ({ ...current, [session.id]: event.target.value.toUpperCase() }))
                            }
                          />
                        )}
                        {!isPast && isTicket ? (
                          <span className="ticket-session-label">{text.privateTicketSession}</span>
                        ) : !isPast && isChallenge ? (
                          invitedMe && !alreadyJoined ? (
                            <button
                              className={busySessionId === session.id ? 'primary compact-join loading' : 'primary compact-join'}
                              disabled={busySessionId === session.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                joinSession(session)
                              }}
                              type="button"
                            >
                              {busySessionId === session.id ? text.joining : text.acceptChallenge}
                            </button>
                          ) : (
                            <span className="challenge-session-label">{challengeStatusLabel(session.challenge_status)}</span>
                          )
                        ) : !isPast && sessionClub && !canJoinThisSession ? (
                          <button
                            className={busyClubId === sessionClub.id ? 'secondary compact-join loading' : 'secondary compact-join'}
                            disabled={busyClubId === sessionClub.id || sessionClubMembership?.status === 'pending'}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (sessionClub.visibility === 'private') {
                                openClubPage(sessionClub.id)
                              } else {
                                joinClub(sessionClub)
                              }
                            }}
                            type="button"
                          >
                            {sessionClubMembership?.status === 'pending'
                              ? text.requestSent
                              : sessionClub.visibility === 'private'
                                ? text.unlockClub
                                : text.joinClub}
                          </button>
                        ) : !isPast && (
                          <button
                            className={busySessionId === session.id ? 'primary compact-join loading' : 'primary compact-join'}
                            disabled={alreadyJoined || Boolean(myWaitlistPosition) || busySessionId === session.id || !canMutatePastSession}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (remaining <= 0) {
                                joinWaitlist(session)
                              } else {
                                joinSession(session)
                              }
                            }}
                            type="button"
                          >
                            {alreadyJoined
                              ? text.joined
                              : myWaitlistPosition
                                ? `${text.waitlisted} #${myWaitlistPosition}`
                                : remaining <= 0
                                  ? text.joinWaitlist
                                  : busySessionId === session.id
                                    ? text.joining
                                    : text.joinSession}
                          </button>
                        )}
                        <button
                          aria-label={text.share}
                          className={sharedKey === session.id ? 'share-icon-button compact-share desktop-session-share copied' : 'share-icon-button compact-share desktop-session-share'}
                          title={text.share}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            shareLink(session.id, session.name, `#session-${session.id}`)
                          }}
                        >
                          <ShareSymbol />
                        </button>
                        {canExpandDetails && (
                          <button
                            className="secondary compact-expand"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSessionExpanded(session, !isExpanded)
                            }}
                          >
                            <ButtonIconText icon={isExpanded ? <ChevronUp aria-hidden="true" size={15} /> : <ChevronDown aria-hidden="true" size={15} />}>{isExpanded ? text.hideDetails : text.expandDetails}</ButtonIconText>
                          </button>
                        )}
                      </div>
                    </div>
                    {hasCrownHolder && <p className="notice crown-session-notice">{text.topPlayerNotice}</p>}
                    {isExpanded && (
                      <div className="session-expanded">
                        {isSessionDetailLoading && !isSessionDetailLoaded && (
                          <p className="notice" aria-busy="true">...</p>
                        )}

                        {sessionClub && (
                          <div className="expanded-session-flags">
                            <span className="pill">{text.clubSession}: {sessionClub.name}</span>
                          </div>
                        )}

                        {isTicket && (
                          <div className="ticket-session-summary">
                            <span>{text.ticketType}: <strong>{ticketTypeLabel(session.ticket_type || 'individual', looseText)}</strong></span>
                            <span>{text.numberOfPlayers}: <strong>{session.ticket_player_count || session.max_players}</strong></span>
                            <span>{text.bookingStatus}: <strong>{session.ticket_status || 'confirmed'}</strong></span>
                            {session.ticket_reference && <span>{text.bookingReference}: <strong>{session.ticket_reference}</strong></span>}
                          </div>
                        )}

                        {session.notes && (
                          <div className={expandedNotes[session.id] ? 'notes-block expanded' : 'notes-block'}>
                            <div
                              className="notes"
                              dangerouslySetInnerHTML={{ __html: formatNotesHtml(session.notes) }}
                            />
                            <button
                              className="expand-note"
                              type="button"
                              onClick={() => setExpandedNotes((current) => ({ ...current, [session.id]: !current[session.id] }))}
                            >
                              {expandedNotes[session.id] ? `⌃ ${text.collapse}` : `⌄ ${text.expand}`}
                            </button>
                          </div>
                        )}

                    {canManage && (
                      <div className="manage-row">
                        <button className="secondary small-button" type="button" onClick={() => startEditingSession(session)}>
                          {text.editSession}
                        </button>
                        <button
                          className={busySessionId === session.id ? 'danger small-button loading' : 'danger small-button'}
                          disabled={busySessionId === session.id}
                          type="button"
                          onClick={() => cancelSession(session)}
                        >
                          {text.cancelSession}
                        </button>
                      </div>
                    )}

                    {canManage && (
                      <div className="confirm-game-panel">
                        <select
                          aria-label={text.playedGame}
                          value={confirmedGameDraft}
                          onChange={(event) => {
                            setConfirmedGameDrafts((current) => ({ ...current, [session.id]: event.target.value }))
                          }}
                        >
                          <option value="">{text.notConfirmed}</option>
                          {confirmedGameOptions.map((game) => {
                            return <option key={game.id} value={game.id}>{game.title}</option>
                          })}
                        </select>
                        <button
                          className={busySessionId === session.id ? 'secondary small-button loading' : 'secondary small-button'}
                          disabled={busySessionId === session.id}
                          type="button"
                          onClick={() => confirmPlayedGame(session)}
                        >
                          {confirmedGameSaved ? text.playedGameConfirmed : text.confirmPlayedGame}
                        </button>
                      </div>
                    )}

                    {isEditing && (
                      <div className="edit-panel">
                        <div className="section-head compact-head">
                          <div>
                            <h3>{text.editSessionTitle}</h3>
                            <p className="muted">{text.editSessionHint}</p>
                          </div>
                          {!session.club_id && editBookingType !== 'ticket' && editBookingType !== 'challenge' && (
                            <div className="segmented">
                              <button className={editSessionVisibility === 'public' ? 'active' : ''} onClick={() => setEditSessionVisibility('public')} type="button">
                                {text.public}
                              </button>
                              <button className={editSessionVisibility === 'private' ? 'active' : ''} onClick={() => setEditSessionVisibility('private')} type="button">
                                {text.private}
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="form-grid">
                          <div className="full">
                            <label>{text.sessionName} <span className="required">*</span></label>
                            <input data-testid="edit-session-name" value={editSessionName} onChange={(event) => setEditSessionName(event.target.value)} />
                          </div>
                          {isAdmin && (
                            <div className="full ticket-admin-box">
                              <div className="ticket-admin-head">
                                <strong>{text.ticketAdminTitle}</strong>
                                <span>{text.ticketAdminHint}</span>
                              </div>
                              <div className="form-grid compact-form-grid">
                                <div>
                                  <label>{text.bookingType}</label>
                                  <select value={editBookingType} onChange={(event) => setEditBookingType(event.target.value as BookingType)}>
                                    <option value="community">{text.communitySession}</option>
                                    <option value="ticket">{text.ticketGenerated}</option>
                                    <option value="challenge">{text.challengeGenerated}</option>
                                  </select>
                                </div>
                                {editBookingType === 'ticket' && (
                                  <>
                                    <div>
                                      <label>{text.ticketCustomer}</label>
                                      <select value={editTicketCustomerId} onChange={(event) => setEditTicketCustomerId(event.target.value)}>
                                        <option value="">{text.noProfile}</option>
                                        {allProfiles.map((player) => (
                                          <option key={player.id} value={player.id}>
                                            {displayName(player)}{player.email ? ` · ${player.email}` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label>{text.ticketType}</label>
                                      <select
                                        value={editTicketType}
                                        onChange={(event) => {
                                          const nextType = event.target.value as TicketType
                                          const nextDuration = ticketDurationForPlayers(nextType, editSessionMaxPlayers)
                                          setEditTicketType(nextType)
                                          setEditSessionDuration(nextDuration)
                                          setEditSessionArenaCount(ticketArenaCountForPlayers())
                                          setEditTicketTotalPrice(String(ticketPricingSummary(nextType, editSessionDate, editSessionTime, editSessionMaxPlayers, nextDuration).totalPrice))
                                        }}
                                      >
                                        {ticketServices.map((service) => (
                                          <option key={service.id} value={service.id}>
                                            {ticketTypeLabel(service.id, looseText)}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label>{text.totalPrice}</label>
                                      <input
                                        inputMode="numeric"
                                        min={0}
                                        type="number"
                                        value={editTicketTotalPrice}
                                        onChange={(event) => setEditTicketTotalPrice(event.target.value)}
                                      />
                                      <p className="field-help">
                                        {text.reservedPlayerSpots}: {editTicketPricing.chargedPlayerSpots} · {text.unitPrice}: {formatVnd(editTicketPricing.baseUnitPrice)} · {text.totalPrice}: {formatVnd(editTicketPricing.totalPrice)}
                                      </p>
                                    </div>
                                    <div>
                                      <label>{text.bookingStatus}</label>
                                      <select value={editTicketStatus} onChange={(event) => setEditTicketStatus(event.target.value as TicketStatus)}>
                                        <option value="pending">{text.ticketStatusPending}</option>
                                        <option value="confirmed">{text.ticketStatusConfirmed}</option>
                                        <option value="cancelled">{text.ticketStatusCancelled}</option>
                                        <option value="completed">{text.ticketStatusCompleted}</option>
                                      </select>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                          {session.session_type === 'tournament' && (() => {
                            const tournament = tournamentForSession(session.id)
                            const hasTournamentBracket = tournament.pools.length > 0 || tournament.matches.length > 0

                            return (
                              <div className="full tournament-create-box tournament-settings-box">
                                <div className="tournament-settings-head">
                                  <strong>{text.tournamentRules}</strong>
                                  <span>{hasTournamentBracket ? text.tournamentRulesLockedHint : text.tournamentRulesHint}</span>
                                </div>
                                <div className="form-grid compact-form-grid">
                                  <div>
                                    <label>{text.tournamentFormat}</label>
                                    <select disabled={hasTournamentBracket} value={editTournamentFormat} onChange={(event) => setEditTournamentFormat(event.target.value as TournamentFormat)}>
                                      <option value="pool_only">{text.formatPoolOnly}</option>
                                      <option value="pool_to_semifinal">{text.formatPoolSemifinal}</option>
                                      <option value="pool_to_final">{text.formatPoolFinal}</option>
                                      <option value="single_elimination">{text.formatSingleElimination}</option>
                                      <option value="double_elimination">{text.formatDoubleElimination}</option>
                                      <option value="leaderboard">{text.formatLeaderboard}</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label>{text.matchSeries}</label>
                                    <select disabled={hasTournamentBracket} value={editTournamentBestOf} onChange={(event) => setEditTournamentBestOf(Number(event.target.value) as 1 | 3 | 5)}>
                                      <option value={1}>BO1</option>
                                      <option value={3}>BO3</option>
                                      <option value={5}>BO5</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label>{text.roundsPerMatch}</label>
                                    <select value={editTournamentRoundsPerMatch} onChange={(event) => setEditTournamentRoundsPerMatch(Number(event.target.value))}>
                                      {[1, 2, 3, 4, 5].map((roundCount) => (
                                        <option key={roundCount} value={roundCount}>{roundCount}</option>
                                      ))}
                                    </select>
                                    <p className="field-help">{text.roundsPerMatchHint}</p>
                                  </div>
                                  <div>
                                    <label>{text.qualification}</label>
                                    <select disabled={hasTournamentBracket} value={editTournamentQualificationRule} onChange={(event) => setEditTournamentQualificationRule(event.target.value as QualificationRule)}>
                                      <option value="top_1">{text.topOnePerPool}</option>
                                      <option value="top_2">{text.topTwoPerPool}</option>
                                      <option value="top_4">{text.topFourPerPool}</option>
                                      <option value="custom">{text.custom}</option>
                                    </select>
                                  </div>
                                  {editTournamentQualificationRule === 'custom' && (
                                    <div>
                                      <label>{text.customQualifiers}</label>
                                      <input disabled={hasTournamentBracket} inputMode="numeric" min={1} max={16} type="number" value={editTournamentCustomQualifiers} onChange={(event) => setEditTournamentCustomQualifiers(Number(event.target.value) || 1)} />
                                    </div>
                                  )}
                                  <label className="toggle-line">
                                    <input checked={editTournamentRequirePayment} onChange={(event) => setEditTournamentRequirePayment(event.target.checked)} type="checkbox" />
                                    <span>{text.requirePaymentForBracket}</span>
                                  </label>
                                  <label className="toggle-line">
                                    <input checked={editTournamentThirdPlace} onChange={(event) => setEditTournamentThirdPlace(event.target.checked)} type="checkbox" />
                                    <span>{text.createBronzeMatch}</span>
                                  </label>
                                  <div>
                                    <label>{text.firstPrize}</label>
                                    <input value={editTournamentFirstPrize} onChange={(event) => setEditTournamentFirstPrize(event.target.value)} placeholder="1,000,000 VND" />
                                  </div>
                                  <div>
                                    <label>{text.secondPrize}</label>
                                    <input value={editTournamentSecondPrize} onChange={(event) => setEditTournamentSecondPrize(event.target.value)} placeholder="Free Ticket" />
                                  </div>
                                  <div>
                                    <label>{text.thirdPrize}</label>
                                    <input value={editTournamentThirdPrize} onChange={(event) => setEditTournamentThirdPrize(event.target.value)} placeholder="Free Drink" />
                                  </div>
                                </div>
                              </div>
                            )
                          })()}
                          <div className="full session-timing-row">
                            <div>
                              <label>{text.date} <span className="required">*</span></label>
                              <ShortDateInput
                                ariaLabel={text.date}
                                language={language}
                                onChange={setEditSessionDate}
                                placeholder={text.chooseDate}
                                value={editSessionDate}
                              />
                            </div>
                            <div>
                              <label>{text.availableTime} <span className="required">*</span></label>
                              <select value={editSessionTime} onChange={(event) => setEditSessionTime(event.target.value)}>
                                <option value="">{text.chooseTime}</option>
                                {editTimeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label>{text.duration}</label>
                              <select value={editSessionDuration} onChange={(event) => setEditSessionDuration(Number(event.target.value))}>
                                {Array.from({ length: 12 }, (_, index) => (index + 1) * 20).map((duration) => (
                                  <option value={duration} key={duration}>
                                    {duration} min
                                  </option>
                                ))}
                              </select>
                              {editSessionDurationRecommendation && <p className="field-help">{editSessionDurationRecommendation}</p>}
                            </div>
                          </div>
                          <div className="full session-capacity-row">
                            <div>
                              <label>{text.maxPlayers}</label>
                              <select value={editSessionMaxPlayers} onChange={(event) => handleEditMaxPlayersChange(Number(event.target.value))}>
                                {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                                  <option value={count} key={count}>
                                    {count} player{count === 1 ? '' : 's'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label>{text.arenas}</label>
                              <select value={editSessionArenaCount} onChange={(event) => handleEditArenaCountChange(Number(event.target.value))}>
                                <option value={1}>{text.oneArena}</option>
                                <option value={2} disabled={editSessionMaxPlayers < 8}>
                                  {text.twoArenas}
                                </option>
                              </select>
                            </div>
                          </div>
                          <div className="full">
                            <div className="game-picker-head">
                              <label>{text.gameOptions} <span className="required">*</span></label>
                              {renderGameGuideTrigger(null, 'game-picker-guide-link')}
                            </div>
                            <div className="game-picker compact-games">
                              {games.map((game) => (
                                <div className="game-card-shell" key={game.id}>
                                  <button
                                    className={editSelectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                                    onClick={() => toggleEditGame(game.id)}
                                    type="button"
                                  >
                                    <NextImage src={game.image} alt="" width={240} height={240} />
                                    <span>{game.title}</span>
                                    <strong>{game.category}</strong>
                                  </button>
                                  {renderGameGuideTrigger(game.id, 'game-card-guide')}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="full">
                            <label>{text.notes}</label>
                            <div className="format-toolbar">
                              <button type="button" aria-label={text.formatBold} title={text.formatBold} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('bold') }}><Bold aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                              <button type="button" aria-label={text.formatItalic} title={text.formatItalic} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('italic') }}><Italic aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                              <button type="button" aria-label={text.formatUnderline} title={text.formatUnderline} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('underline') }}><Underline aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                              <button type="button" aria-label={text.formatStrike} title={text.formatStrike} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('strikeThrough') }}><Strikethrough aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                            </div>
                            <RichNotesEditor
                              value={editSessionNotes}
                              onChange={setEditSessionNotes}
                              placeholder={text.notesPlaceholder}
                              resetKey={`edit-${editingSessionId || session.id}`}
                            />
                          </div>
                        </div>
                        <div className="action-row">
                          <button
                            data-testid="edit-session-submit"
                            className={isUpdatingSession ? 'primary loading create-button' : 'primary create-button'}
                            disabled={isUpdatingSession}
                            type="button"
                            onClick={() => updateSession(session)}
                          >
                            {isUpdatingSession ? text.saving : text.saveChanges}
                          </button>
                          <button className="secondary create-button" type="button" onClick={stopEditingSession}>
                            {text.close}
                          </button>
                        </div>
                      </div>
                    )}

                    {canSeeInviteCode && (
                      <div className="invite-code">
                        <span>{text.privateCode}</span>
                        <strong>{session.invite_code}</strong>
                        <button
                          className={copiedInviteId === session.id ? 'copied' : ''}
                          type="button"
                          onClick={() => copyInviteCode(session.id, session.invite_code)}
                        >
                          {copiedInviteId === session.id ? text.copied : text.copy}
                        </button>
                      </div>
                    )}

                    {!isTicket && !isChallenge && networkTablesReady && (alreadyJoined || canManage) && (
                      <div className="network-panel">
                        <div className="section-head compact-head network-head">
                          <div>
                            <h3>{text.sessionNetwork}</h3>
                            <p className="muted">{text.sessionNetworkHint}</p>
                          </div>
                          <div className="network-actions">
                            <button
                              className="secondary small-button"
                              type="button"
                              onClick={() => {
                                setInviteSearch('')
                                setInviteModalSessionId(session.id)
                              }}
                            >
                              {text.invitePlayer}
                            </button>
                          </div>
                        </div>
                        {canManage && sessionInviteRows.length > 0 && (
                          <p className="muted">{text.sentInvites}: {sessionInviteRows.length}</p>
                        )}
                      </div>
                    )}

                    {inviteModalSessionId === session.id && (
                      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`invite-session-title-${session.id}`} onClick={() => setInviteModalSessionId('')}>
                        <div className="login-modal session-invite-modal" onClick={(event) => event.stopPropagation()}>
                          <button className="modal-close" type="button" onClick={() => setInviteModalSessionId('')} aria-label={text.close}>
                            <X aria-hidden="true" size={20} />
                          </button>
                          <div className="session-invite-modal-head">
                            <h3 id={`invite-session-title-${session.id}`}>{text.invitePlayer}</h3>
                            <p>{text.sessionNetworkHint}</p>
                          </div>
                          <button
                            aria-label={text.share}
                            className={sharedKey === session.id ? 'share-icon-button session-invite-share copied' : 'share-icon-button session-invite-share'}
                            title={text.share}
                            type="button"
                            onClick={() => shareLink(session.id, session.name, `#session-${session.id}`)}
                          >
                            <ShareSymbol />
                          </button>
                          <input
                            aria-label={text.invitePlayerSearch}
                            autoFocus
                            placeholder={text.invitePlayerSearchPlaceholder}
                            type="search"
                            value={inviteSearch}
                            onChange={(event) => setInviteSearch(event.target.value)}
                          />
                          {visibleInviteTargets.length === 0 ? (
                            <p className="notice">{text.noInviteTargets}</p>
                          ) : (
                            <div className="invite-search-results">
                              {visibleInviteTargets.map((target) => {
                                const inviteKey = `${session.id}-${target.profile_id}`
                                const isInvited = invitedIds.has(target.profile_id)

                                return (
                                  <button
                                    className="invite-result-row"
                                    disabled={isInvited || busyInviteKey === inviteKey}
                                    key={target.profile_id}
                                    type="button"
                                    onClick={() => invitePlayerToSession(session, target)}
                                  >
                                    <span className="player-avatar tiny-avatar" style={avatarStyle(target)}>
                                      {avatarNode(target, 'P')}
                                    </span>
                                    <span className="invite-result-copy">
                                      <strong>{compactDisplayName(target.display_name, text.player)}</strong>
                                      {target.profile_motto && <small>{target.profile_motto}</small>}
                                    </span>
                                    <small>{isInvited ? text.invited : text.invite}</small>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="players">
                      {participants.map((participant) => (
                        <div className="player result-player" key={participant.id} title={participant.display_name || text.player}>
                          <button
                            aria-label={canSeeSessionPlayers ? playerCardLabel(participant.display_name, text.player) : playerCardLabel(text.member, text.member)}
                            className={[
                              'player-avatar player-avatar-button',
                              participant.placement ? `place-${participant.placement}` : '',
                            ].join(' ').trim()}
                            onClick={() => openPlayerProfile(participant.profile_id, session.id)}
                            style={canSeeSessionPlayers ? avatarStyle(participant) : undefined}
                            type="button"
                          >
                            {canSeeSessionPlayers ? avatarNode(participant, 'P') : '?'}
                            {crownedTopPlayer?.profileId === participant.profile_id && <span className="champion-badge">👑</span>}
                            {participant.checked_in && <span className="check-badge">✓</span>}
                            {participant.placement && participant.placement <= 3 && <span className="cup-badge">{rankEmoji(participant.placement)}</span>}
                          </button>
                          <span className="player-name-line">
                            {canSeeSessionPlayers ? compactDisplayName(participant.display_name, text.player) : text.member}
                            {participant.profile_id === session.owner_id && <small>{text.host}</small>}
                            {isBestSessionPerformer(session, participant) && <small className="best-performer-label">{bestPerformerText}</small>}
                          </span>
                          {(canManage || participant.profile_id === userId) && participant.payment_status && (
                            <small className="private-payment">
                              {participantPaymentMethodSummary(participant, text)}
                              {participantPaymentAmountSummary(participant) ? ` · ${participantPaymentAmountSummary(participant).toLocaleString('vi-VN')} đ` : ''}
                            </small>
                          )}
                          {canManage && (
                            <button
                              className="checkin-mini"
                              type="button"
                              onClick={() => setCheckInTarget({ sessionId: session.id, participantId: participant.id })}
                            >
                              {participant.checked_in ? '✓' : text.checkIn}
                            </button>
                          )}
                          {canManage && participant.profile_id !== session.owner_id && (
                            <button
                              className="remove-player"
                              disabled={busySessionId === session.id}
                              type="button"
                              onClick={() => removeParticipant(session, participant)}
                              title={text.remove}
                            >
                              {text.remove}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {!isTicket && !isChallenge && myWaitlistPosition && (
                      <p className="notice waitlist-position">{text.waitlistPosition}: #{myWaitlistPosition}</p>
                    )}

                    {!isTicket && !isChallenge && canManage && (
                      <div className="waitlist-panel">
                        <strong>{text.waitlist}</strong>
                        {waitlist.length === 0 ? (
                          <span className="muted">{text.waitlistEmpty}</span>
                        ) : (
                          <div className="players compact-roster">
                            {waitlist.map((entry, index) => (
                              <div className="player" key={entry.id}>
                                <span className="player-avatar tiny-avatar" style={avatarStyle(entry)}>
                                  {avatarNode(entry, 'P')}
                                </span>
                                <span>{index + 1}. {compactDisplayName(entry.display_name, text.player)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!isTicket && Boolean(userId) && (
                    <div className="session-comms">
                      <div className="section-head compact-head">
                        <div>
                          <h3>{text.sessionCommunication}</h3>
                          <p className="muted">{text.sessionCommunicationHint}</p>
                        </div>
                      </div>
                      {canReviewSessionMessages(session) && (
                        <div className="message-compose">
                          <input
                            value={announcementDrafts[session.id] || ''}
                            onChange={(event) => setAnnouncementDrafts((current) => ({ ...current, [session.id]: event.target.value }))}
                            placeholder={text.announcementPlaceholder}
                          />
                          <button
                            className="secondary small-button"
                            disabled={busyMessageKey === `${session.id}-announcement`}
                            type="button"
                            onClick={() => postSessionMessage(session, 'announcement')}
                          >
                            {text.postAnnouncement}
                          </button>
                        </div>
                      )}
                      {hasEarlierSessionMessages && (
                        <button
                          className="secondary small-button load-earlier-messages"
                          disabled={isSessionMessagesLoading}
                          type="button"
                          onClick={() => loadSessionMessages(session.id, { before: sessionMessagePage?.oldestCreatedAt })}
                        >
                          {isSessionMessagesLoading ? text.sessionMessagesLoading : text.loadEarlierMessages}
                        </button>
                      )}
                      {sessionMessageRows.length === 0 ? (
                        <p className="notice" aria-busy={isSessionMessagesLoading}>
                          {isSessionMessagesLoading ? text.sessionMessagesLoading : text.noSessionMessages}
                        </p>
                      ) : (
                        <div className="message-list">
                          {sessionMessageRows.map((message) => {
                            const moderationStatus = message.moderation_status || 'approved'
                            const canReviewMessage = canReviewSessionMessages(session) && moderationStatus === 'pending_review'
                            const isOwnMessage = message.author_id === userId
                            const messageClassName = [
                              'session-message',
                              message.message_type === 'announcement' ? 'announcement' : '',
                              isOwnMessage ? 'own-message' : '',
                            ].filter(Boolean).join(' ')
                            const translationKey = messageTranslationKey('session', message.id, language)

                            return (
                              <div className={messageClassName} key={message.id}>
                                <span className="player-avatar tiny-avatar message-avatar" style={avatarStyle({
                                  avatar_color: message.author_avatar_color,
                                  avatar_text_color: message.author_avatar_text_color,
                                })}>
                                  {avatarNode({
                                    avatar_url: message.author_avatar_url,
                                    avatar_emoji: message.author_avatar_emoji,
                                    avatar_initials: message.author_avatar_initials,
                                    display_name: message.author_display_name,
                                  }, 'P')}
                                </span>
                                <div className="message-body">
                                  <div className="message-meta-row">
                                    <strong>{message.message_type === 'announcement' ? text.creatorAnnouncement : compactDisplayName(message.author_display_name, text.player)}</strong>
                                    {moderationStatus === 'pending_review' && <small className="moderation-badge pending">{text.pendingReview}</small>}
                                    {moderationStatus === 'rejected' && <small className="moderation-badge rejected">{text.rejectedMessage}</small>}
                                  </div>
                                  <MessageBodyText
                                    body={message.body}
                                    messageId={message.id}
                                    messageKind="session"
                                    onRequestTranslation={requestMessageTranslation}
                                    onToggleOriginal={() => toggleMessageOriginal('session', message.id, language)}
                                    targetLanguage={language}
                                    text={text}
                                    translation={messageTranslations[translationKey]}
                                  />
                                  {(canReviewMessage || isAdmin) && (
                                    <div className="moderation-actions">
                                      {canReviewMessage && (
                                        <>
                                          <button
                                            className="secondary small-button"
                                            disabled={busyMessageKey === `${message.id}-approved` || busyMessageKey === `${message.id}-rejected`}
                                            type="button"
                                            onClick={() => reviewSessionMessage(message, 'approved')}
                                          >
                                            {text.approveMessage}
                                          </button>
                                          <button
                                            className="danger small-button"
                                            disabled={busyMessageKey === `${message.id}-approved` || busyMessageKey === `${message.id}-rejected`}
                                            type="button"
                                            onClick={() => reviewSessionMessage(message, 'rejected')}
                                          >
                                            {text.rejectMessage}
                                          </button>
                                        </>
                                      )}
                                      {isAdmin && (
                                        <button
                                          className="danger small-button"
                                          disabled={busyMessageKey === `${message.id}-delete`}
                                          type="button"
                                          onClick={() => deleteSessionMessage(message)}
                                        >
                                          {text.deleteMessage}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {(alreadyJoined || canReviewSessionMessages(session)) && (
                        <div className="message-compose">
                          <input
                            value={commentDrafts[session.id] || ''}
                            onChange={(event) => setCommentDrafts((current) => ({ ...current, [session.id]: event.target.value }))}
                            placeholder={text.commentPlaceholder}
                          />
                          <button
                            className="secondary small-button"
                            disabled={busyMessageKey === `${session.id}-comment`}
                            type="button"
                            onClick={() => postSessionMessage(session, 'comment')}
                          >
                            {text.postComment}
                          </button>
                        </div>
                      )}
                    </div>
                    )}

                    {session.session_type === 'tournament' && (() => {
                      const tournament = tournamentForSession(session.id)
                      const canEditTournament = canEditTournamentSession(session) && !tournamentLocked(session)
                      const creatorCanAssignEditors = isSessionCreator(session)
                      const eligiblePlayers = eligibleTournamentParticipants(session)
                      const hasTournamentStructure = tournament.pools.length > 0 || tournament.matches.length > 0
                      const queueMatches = tournament.matches
                        .filter((match) => match.status !== 'completed')
                        .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999) || a.round - b.round || a.match_number - b.match_number)
                      const podium = [2, 1, 3]
                        .map((rank) => participants.find((participant) => participant.placement === rank))
                        .filter(Boolean) as Participant[]

                      return (
                        <div className="tournament-desk">
                          <div className="section-head compact-head">
                            <div>
                              <h3>{text.tournamentDesk}</h3>
                              <p className="muted">
                                {(session.tournament_format || 'pool_to_final').replace(/_/g, ' ')} · {bestOfLabel(session.best_of)} · {text.roundsPerMatch}: {session.rounds_per_match || 1} · {eligiblePlayers.length} {text.tournamentEligible}
                              </p>
                            </div>
                            {canEditTournament && (
                              <div className="manage-row">
                                <label className="mini-field">
                                  {text.poolSize}
                                  <select value={tournamentPoolSize} onChange={(event) => setTournamentPoolSize(Number(event.target.value))}>
                                    {[2, 3, 4, 5, 6].map((size) => <option key={size} value={size}>{size}</option>)}
                                  </select>
                                </label>
                                <button className="secondary small-button" disabled={busyTournamentId === session.id} type="button" onClick={() => setupTournamentPools(session)}>
                                  {text.tournamentRandomSetup}
                                </button>
                                <button className="secondary small-button" disabled={busyTournamentId === session.id} type="button" onClick={() => generateTournamentMatches(session)}>
                                  {text.tournamentGenerateMatches}
                                </button>
                                <button className="primary small-button" disabled={busyTournamentId === session.id} type="button" onClick={() => advanceTournamentRound(session)}>
                                  {text.tournamentNextRound}
                                </button>
                                <button className="secondary small-button" disabled={busyTournamentId === session.id} type="button" onClick={() => createThirdPlaceMatch(session)}>
                                  {text.bronzeMatch}
                                </button>
                                <button className="danger small-button" disabled={busyTournamentId === session.id} type="button" onClick={() => finishTournament(session)}>
                                  {text.finishTournament}
                                </button>
                              </div>
                            )}
                          </div>
                          <p className={canEditTournament ? 'notice tournament-role-notice manager' : 'notice tournament-role-notice'}>
                            {tournamentRoleHint(session, hasTournamentStructure)}
                          </p>

                          {podium.length > 0 && (
                            <div className="public-leaderboard">
                              <div className="section-head compact-head">
                                <div>
                                  <h3>{text.tournamentPodiumTitle}</h3>
                                  <p className="muted">{text.tournamentPodiumHint}</p>
                                </div>
                                <button className="share-icon-button" type="button" onClick={() => shareTournamentResults(session)}>
                                  ⇧
                                </button>
                              </div>
                              <div className="podium-row">
                                {podium.map((participant) => (
                                  <div className={`podium-player place-${participant.placement}`} key={`leader-${participant.id}`}>
                                    <span className="podium-medal">{rankEmoji(participant.placement)}</span>
                                    <button aria-label={playerCardLabel(participant.display_name, text.player)} className="player-avatar player-avatar-button" onClick={() => openPlayerProfile(participant.profile_id, session.id)} style={avatarStyle(participant)} type="button">
                                      {avatarNode(participant, 'P')}
                                    </button>
                                    <strong>{compactDisplayName(participant.display_name, text.player)}</strong>
                                    <small>{participant.score ?? 0} pts · {participant.accuracy_percent ?? '-'}%</small>
                                    {canEditTournament && participant.placement && (
                                      <button className="link-button" type="button" onClick={() => claimPrize(participant, !participant.prize_claimed)}>
                                        {participant.prize_claimed ? text.prizeClaimed : `${participant.placement === 1 ? session.first_prize || text.firstPrize : participant.placement === 2 ? session.second_prize || text.secondPrize : session.third_prize || text.thirdPrize}`}
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {queueMatches.length > 0 && (
                            <div className="queue-board">
                              {[1, 2].map((arenaNumber) => {
                                const arenaMatches = queueMatches.filter((match) => (match.arena_number || arenaNumber) === arenaNumber).slice(0, 4)
                                return (
                                  <div className="queue-lane" key={`arena-${arenaNumber}`}>
                                    <strong>Arena {arenaNumber}</strong>
                                    {arenaMatches.length === 0 ? <span className="muted">{text.tournamentQueueEmpty}</span> : arenaMatches.map((match, index) => (
                                      <div className={`queue-match ${match.status}`} key={`queue-${match.id}`}>
                                        <span>{queueLabel(match.status, index)}</span>
                                        <strong>{participantName(session, match.participant_a_id)} vs {participantName(session, match.participant_b_id)}</strong>
                                        <small>{tournamentStageLabel(match.stage)} {match.match_number} · {bestOfLabel(match.best_of || session.best_of)}</small>
                                        {canEditTournament && (
                                          <div className="queue-controls">
                                            <button type="button" onClick={() => updateTournamentMatch(match, { arena_number: arenaNumber, status: 'next' })}>{text.next}</button>
                                            <button type="button" onClick={() => updateTournamentMatch(match, { arena_number: arenaNumber, status: 'live' })}>{text.live}</button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {creatorCanAssignEditors && (
                            <div className="invite-code compact">
                              <span>{text.tournamentEditors}</span>
                              <input value={tournamentEditorEmail} onChange={(event) => setTournamentEditorEmail(event.target.value)} placeholder={text.editorSearchPlaceholder} />
                              <button disabled={busyTournamentId === session.id} type="button" onClick={() => addTournamentEditor(session)}>
                                {text.addEditor}
                              </button>
                              {tournamentEditorResults.length > 0 && (
                                <div className="editor-results">
                                  {tournamentEditorResults.map((editorProfile) => (
                                    <button key={editorProfile.id} onClick={() => addTournamentEditor(session, editorProfile)} type="button">
                                      <span className="player-avatar tiny-avatar" style={avatarStyle(avatarFields(editorProfile))}>{avatarNode({
                                        ...avatarFields(editorProfile),
                                        display_name: displayName(editorProfile),
                                      }, 'E')}</span>
                                      <span>{compactDisplayName(displayName(editorProfile), text.player)}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {tournament.editors.length > 0 && (
                            <div className="players compact-roster">
                              {tournament.editors.map((editor) => (
                                <div className="player" key={editor.id}>
                                  <span className="player-avatar" style={avatarStyle(editor)}>
                                    {avatarNode(editor, 'E')}
                                  </span>
                                  <span>{compactDisplayName(editor.display_name, text.player)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {tournament.pools.length > 0 && (
                            <div className="tournament-grid">
                              {tournament.pools.map((pool) => (
                                <div className="tournament-panel" key={pool.id}>
                                  <strong>{pool.name}</strong>
                                  <div className="standings-table">
                                    {poolStandingsForSession(session, pool).map((standing, index) => (
                                      <div className="standing-row" key={standing.participantId} title={standing.tieBreakNote}>
                                        <span>{index + 1}</span>
                                        <strong>{standing.displayName}</strong>
                                        <small>{standing.points} pts · {standing.wins}-{standing.losses} · Δ{standing.scoreDifference}</small>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="field-help">{text.tournamentStandingsHint}</p>
                                  <div className="players compact-roster">
                                    {tournament.poolEntries.filter((entry) => entry.pool_id === pool.id).map((entry) => {
                                      const entryParticipant = participantById(session, entry.participant_id)
                                      return (
                                        <div className="player tournament-entry" key={entry.id}>
                                          <button aria-label={playerCardLabel(entryParticipant?.display_name, text.player)} className="player-avatar player-avatar-button" onClick={() => entryParticipant && openPlayerProfile(entryParticipant.profile_id, session.id)} style={avatarStyle(entryParticipant)} type="button">
                                            {avatarNode(entryParticipant, 'P')}
                                            {crownedTopPlayer?.profileId === entryParticipant?.profile_id && <span className="champion-badge">👑</span>}
                                          </button>
                                          <span>{participantName(session, entry.participant_id)}</span>
                                          {entry.team_label && <small>{entry.team_label}</small>}
                                          {canEditTournament && (
                                            <div className="entry-controls">
                                              <select value={entry.pool_id} onChange={(event) => updateTournamentPoolEntry(entry, { pool_id: event.target.value })} aria-label={text.pool}>
                                                {tournament.pools.map((optionPool) => (
                                                  <option key={optionPool.id} value={optionPool.id}>{optionPool.name}</option>
                                                ))}
                                              </select>
                                              <input defaultValue={entry.team_label || ''} onBlur={(event) => updateTournamentPoolEntry(entry, { team_label: event.target.value.trim() || null })} placeholder={text.team} />
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {tournament.matches.length > 0 && (
                            <div className="match-list">
                              {tournament.matches.map((match) => (
                                (() => {
                                  const playerA = participantById(session, match.participant_a_id)
                                  const playerB = participantById(session, match.participant_b_id)
                                  return (
                                    <div className={match.status === 'completed' ? 'match-card completed' : 'match-card'} key={match.id}>
                                      <div className="match-head">
                                        <span>{tournamentStageLabel(match.stage)} {match.stage !== 'pool' ? match.match_number : `· R${match.round} M${match.match_number}`}</span>
                                        <strong>{bestOfLabel(match.best_of || session.best_of)} · {match.status}</strong>
                                      </div>
                                      <div className="match-versus">
                                        <button className={match.winner_participant_id === match.participant_a_id ? 'match-player winner' : 'match-player'} disabled={!canEditTournament || !match.participant_a_id} type="button" onClick={() => updateTournamentMatch(match, { winner_participant_id: match.participant_a_id })}>
                                          <span className="player-avatar" style={avatarStyle(playerA)}>
                                            {avatarNode(playerA, 'P')}
                                            {crownedTopPlayer?.profileId === playerA?.profile_id && <span className="champion-badge">👑</span>}
                                          </span>
                                          <span>{participantName(session, match.participant_a_id)}</span>
                                        </button>
                                        <span className="versus">VS</span>
                                        <button className={match.winner_participant_id === match.participant_b_id ? 'match-player winner' : 'match-player'} disabled={!canEditTournament || !match.participant_b_id} type="button" onClick={() => updateTournamentMatch(match, { winner_participant_id: match.participant_b_id })}>
                                          <span className="player-avatar" style={avatarStyle(playerB)}>
                                            {avatarNode(playerB, 'P')}
                                            {crownedTopPlayer?.profileId === playerB?.profile_id && <span className="champion-badge">👑</span>}
                                          </span>
                                          <span>{participantName(session, match.participant_b_id)}</span>
                                        </button>
                                      </div>
                                      {canEditTournament && (
                                        <div className="score-row match-edit-row">
                                          <select value={match.participant_a_id || ''} onChange={(event) => updateTournamentMatch(match, { participant_a_id: event.target.value || null })} aria-label={`${text.match} A`}>
                                            <option value="">{text.noMatch}</option>
                                            {participants.map((participant) => (
                                              <option key={participant.id} value={participant.id}>{compactDisplayName(participant.display_name, text.player)}</option>
                                            ))}
                                          </select>
                                          <select value={match.participant_b_id || ''} onChange={(event) => updateTournamentMatch(match, { participant_b_id: event.target.value || null })} aria-label={`${text.match} B`}>
                                            <option value="">{text.noMatch}</option>
                                            {participants.map((participant) => (
                                              <option key={participant.id} value={participant.id}>{compactDisplayName(participant.display_name, text.player)}</option>
                                            ))}
                                          </select>
                                          <input aria-label={text.scoreA} defaultValue={match.score_a ?? ''} inputMode="numeric" placeholder={text.scoreA} onBlur={(event) => updateTournamentMatch(match, { score_a: event.target.value === '' ? null : Number(event.target.value) })} />
                                          <input aria-label={text.scoreB} defaultValue={match.score_b ?? ''} inputMode="numeric" placeholder={text.scoreB} onBlur={(event) => updateTournamentMatch(match, { score_b: event.target.value === '' ? null : Number(event.target.value) })} />
                                          <input aria-label={text.winsA} defaultValue={match.wins_a ?? ''} inputMode="numeric" placeholder={text.winsA} onBlur={(event) => updateTournamentMatch(match, { wins_a: event.target.value === '' ? null : Number(event.target.value) })} />
                                          <input aria-label={text.winsB} defaultValue={match.wins_b ?? ''} inputMode="numeric" placeholder={text.winsB} onBlur={(event) => updateTournamentMatch(match, { wins_b: event.target.value === '' ? null : Number(event.target.value) })} />
                                          <select value={match.status} onChange={(event) => updateTournamentMatch(match, { status: event.target.value as MatchStatus })} aria-label={text.matchStatus}>
                                            <option value="waiting">{text.waiting}</option>
                                            <option value="next">{text.next}</option>
                                            <option value="live">{text.live}</option>
                                            <option value="completed">{text.completed}</option>
                                          </select>
                                          <select value={match.arena_number || ''} onChange={(event) => updateTournamentMatch(match, { arena_number: event.target.value ? Number(event.target.value) : null })} aria-label={text.arena}>
                                            <option value="">{text.arena}</option>
                                            <option value={1}>Arena 1</option>
                                            <option value={2}>Arena 2</option>
                                          </select>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()
                              ))}
                            </div>
                          )}

                          {tournament.auditLogs.length > 0 && creatorCanAssignEditors && (
                            <details className="audit-log">
                              <summary>{text.auditLog}</summary>
                              {tournament.auditLogs.slice(0, 10).map((log) => (
                                <div className="audit-row" key={log.id}>
                                  <strong>{log.action}</strong>
                                  <span>
                                    {formatShortDate(localDateString(new Date(log.created_at)), language)} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              ))}
                            </details>
                          )}
                        </div>
                      )
                    })()}

                    {!isTicket && !isChallenge && (
                      <div className="game-strip">
                        {session.game_options.map((gameId) => {
                          const game = games.find((item) => item.id === gameId)
                          if (!game) return null

                          return (
                            <div className="game-card-shell strip-game-card-shell" key={gameId}>
                              <button
                                className={[
                                  session.game_votes?.[userId] === gameId ? 'game-card selected' : 'game-card',
                                  busyVoteKey === `${session.id}-${gameId}` ? 'loading' : '',
                                ].join(' ').trim()}
                                disabled={busyVoteKey === `${session.id}-${gameId}` || !canMutatePastSession}
                                onClick={() => voteForGame(session, gameId)}
                                type="button"
                              >
                                <NextImage src={game.image} alt="" width={240} height={240} />
                                <span>{game.title}</span>
                                <strong>{voteCount(session, gameId)} {voteCount(session, gameId) === 1 ? text.vote : text.votes}</strong>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!isPast && !isChallenge && alreadyJoined && !isSessionOwner && canMutatePastSession && (
                    <div className="join-row">
                      <button
                        className={busySessionId === session.id ? 'secondary loading' : 'secondary'}
                        disabled={busySessionId === session.id}
                        onClick={() => leaveSession(session)}
                        type="button"
                      >
                        {text.leaveSession}
                      </button>
                    </div>
                    )}
                      </div>
                    )}
                  </article>
                )
              })}
              {sessionTimeScope === 'upcoming' && hasMoreUpcomingSessions && (
                <div className="session-load-more" aria-busy={isLoadingMoreSessions}>
                  {isLoadingMoreSessions ? '...' : ''}
                </div>
              )}
            </div>
          </section>
        )}

        {activeView === 'leaderboard' && (
          <>
            {isLeaderboardLoading && leaderboardPlayerStats.length === 0 && <p className="notice" aria-busy="true">...</p>}
            {leaderboardStatus && leaderboardPlayerStats.length === 0 && <p className="notice">{leaderboardStatus}</p>}
            <LocalErrorBoundary fallback={<p className="notice">{text.noLeaderboardPlayers}</p>} resetKey={`leaderboard-${language}-${leaderboardPlayerStats.length}-${clubs.length}`}>
              <LeaderboardPanel
                avatarStyleFor={(player: LeaderboardPlayer) => avatarStyle({
                  avatar_color: player.avatarColor,
                  avatar_text_color: player.avatarTextColor,
                })}
                canBypassPrivateClubPins={isAdmin}
                canShareCurrentUserStats={canShareCurrentUserStats}
                clubs={clubs}
                currentUserRankPlayer={currentUserRankPlayer}
                hasMorePlayers={hasMoreLeaderboardPlayers}
                initialCriterion={leaderboardQueryRef.current.criterion}
                isCurrentUserStatsShared={currentUserStatsShared}
                isLoadingMorePlayers={isLoadingMoreLeaderboardPlayers}
                onLeaderboardClubChange={handleLeaderboardClubChange}
                onLeaderboardClubFilterOpen={ensureClubsLoaded}
                onLeaderboardClubPinUnlock={handleLeaderboardClubPinUnlock}
                onLeaderboardCriterionChange={handleLeaderboardCriterionChange}
                onLeaderboardSearchChange={handleLeaderboardSearchChange}
                onLoadMorePlayers={loadMoreLeaderboardPlayers}
                onShareCurrentUserStats={() => shareCurrentUserStats()}
                onOpenPlayerProfile={openPlayerProfile}
                players={leaderboardPlayerStats}
                renderAvatar={(player: LeaderboardPlayer) => avatarNode({
                  avatar_url: player.avatarUrl,
                  avatar_emoji: player.avatarEmoji,
                  avatar_initials: player.avatarInitials,
                  avatar_color: player.avatarColor,
                  avatar_text_color: player.avatarTextColor,
                  display_name: player.displayName,
                }, 'P')}
                serverFiltered
                showClubFilter
                text={text}
                useServerRanking
                userId={userId}
              />
            </LocalErrorBoundary>
          </>
        )}

        {activeView === 'clubs' && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>{text.clubsTitle}</h2>
                <p className="muted">{text.clubsHint}</p>
              </div>
              <div className={isClubSearchOpen ? 'search-shell open' : 'search-shell'} ref={clubSearchShellRef}>
                <button
                  aria-label={text.searchSessions}
                  className="mobile-search-toggle"
                  type="button"
                  onClick={() => setIsClubSearchOpen((open) => !open)}
                >
                  <Search aria-hidden="true" size={24} strokeWidth={2.35} />
                </button>
                <input
                  className="search"
                  type="search"
                  placeholder={text.clubSearchPlaceholder}
                  value={clubSearch}
                  onFocus={() => setIsClubSearchOpen(true)}
                  onChange={(event) => setClubSearch(event.target.value)}
                />
                {(isClubSearchOpen || clubSearch) && (
                  <button
                    aria-label={text.close}
                    className="search-close"
                    type="button"
                    onClick={() => {
                      setClubSearch('')
                      setIsClubSearchOpen(false)
                    }}
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                )}
              </div>
            </div>

            {profile ? (
              <>
                <div className="segmented form-segmented">
                  <button className={clubVisibility === 'public' ? 'active' : ''} onClick={() => setClubVisibility('public')} type="button">
                    {text.public}
                  </button>
                  <button className={clubVisibility === 'private' ? 'active' : ''} onClick={() => setClubVisibility('private')} type="button">
                    {text.private}
                  </button>
                </div>

                <div className="form-grid club-form">
                  <div>
                    <label>{text.clubName} <span className="required">*</span></label>
                    <input value={clubName} onChange={(event) => setClubName(event.target.value)} placeholder="VRena Friday Club" />
                  </div>
                  <div>
                    <label>{text.clubDescription}</label>
                    <input value={clubDescription} onChange={(event) => setClubDescription(event.target.value)} placeholder={text.clubDescriptionPlaceholder} />
                  </div>
                </div>

                <button className={isCreatingClub ? 'primary loading create-button' : 'primary create-button'} disabled={isCreatingClub} onClick={createClub} type="button">
                  {isCreatingClub ? text.creatingClub : text.createClub}
                </button>
              </>
            ) : (
              <div className="notice club-login-notice">
                <span>{text.clubLoginHint}</span>
                <button className="secondary small-button" type="button" onClick={promptLogin}>
                  {text.logIn}
                </button>
              </div>
            )}
            {clubStatus && <p className="notice">{clubStatus}</p>}

            <div className="club-list">
              {filteredClubs.length === 0 && <p className="notice">{text.noMatchingClubs}</p>}
              {filteredClubs.map((club) => {
                const members = clubMembers(club)
                const approvedMembers = members.filter((member) => member.status === 'approved')
                const pendingMembers = members.filter((member) => member.status === 'pending')
                const membership = members.find((member) => member.profile_id === userId)
                const canManage = canManageClub(club)
                const canOpenPage = canOpenClubPage(club)
                const canAskPrivateCode = Boolean(userId && club.visibility === 'private' && !canOpenPage)
                const canActivateClubCard = !userId || canOpenPage || canAskPrivateCode
                const canSeeMembers = canSeeClubPrivateData(club)
                const canUseMessages = canOpenPage && canUseClubMessages(club)

                return (
                  <article
                    className={canActivateClubCard ? 'club-card clickable' : 'club-card'}
                    key={club.id}
                    onClick={canActivateClubCard ? () => openClubPage(club.id) : undefined}
                    onKeyDown={canActivateClubCard ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openClubPage(club.id)
                      }
                    } : undefined}
                    style={clubThemeStyle(club)}
                    role={canActivateClubCard ? 'button' : undefined}
                    tabIndex={canActivateClubCard ? 0 : undefined}
                  >
                    <div className="session-top">
                      <div>
                        <h3>{club.name}</h3>
                        {club.motto && <p className="club-card-motto">{club.motto}</p>}
                        <div className="row-meta">
                          <span className={club.visibility === 'private' ? 'pill private' : 'pill ok'}>
                            {club.visibility === 'private' ? text.private : text.public}
                          </span>
                          <span>{clubMemberCount(club)} {text.members}</span>
                          {membership?.status === 'pending' && <span className="pill">{text.pending}</span>}
                        </div>
                      </div>
                      {userId && !membership && !canManage && (
                        <button
                          className={busyClubId === club.id ? 'primary loading' : 'primary'}
                          disabled={busyClubId === club.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            joinClub(club)
                          }}
                          type="button"
                        >
                          {club.visibility === 'private' ? text.requestJoin : text.joinClub}
                        </button>
                      )}
                    </div>

                    {club.description && <p className="notes">{club.description}</p>}

                    {canUseMessages && (
                      <div className="club-card-actions">
                        <button
                          className="secondary small-button"
                          onClick={(event) => {
                            event.stopPropagation()
                            openClubPage(club.id, 'messages')
                          }}
                          type="button"
                        >
                          {text.clubMessages}
                        </button>
                      </div>
                    )}

                    {canSeeMembers ? (
                      <div className="players">
                        {approvedMembers.map((member) => (
                          <div className="player" key={member.id}>
                            <button
                              aria-label={playerCardLabel(member.display_name, text.player)}
                              className="player-avatar player-avatar-button"
                              onClick={(event) => {
                                event.stopPropagation()
                                openPlayerProfile(member.profile_id)
                              }}
                              style={avatarStyle(member)}
                              type="button"
                            >
                              {avatarNode(member, 'P')}
                            </button>
                            <span>{compactDisplayName(member.display_name, text.player)}</span>
                            {canManage && member.profile_id !== club.owner_id && (
                              <button className="remove-player" disabled={busyClubId === club.id} onClick={(event) => {
                                event.stopPropagation()
                                removeClubMember(club, member)
                              }} type="button">
                                {text.remove}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="notice">{text.hiddenMembers}</p>
                    )}

                    {canManage && pendingMembers.length > 0 && (
                      <div className="pending-list">
                        {pendingMembers.map((member) => (
                          <div className="pending-member" key={member.id}>
                            <span>{compactDisplayName(member.display_name, text.player)}</span>
                            <div className="mini-session-actions">
                              <button className="secondary small-button" disabled={busyClubId === club.id} onClick={(event) => {
                                event.stopPropagation()
                                approveClubMember(member)
                              }} type="button">
                                {text.approve}
                              </button>
                              <button className="danger small-button" disabled={busyClubId === club.id} onClick={(event) => {
                                event.stopPropagation()
                                removeClubMember(club, member)
                              }} type="button">
                                {text.remove}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeView === 'staff' && (
          canAccessStaffConsole ? (
            <StaffConsole
              authEmail={authEmail}
              language={language}
              profile={profile}
              onOpenPlayerProfile={openStaffPlayerProfile}
              onOpenSessionCalendar={openCreateSessionCalendar}
            />
          ) : (
            <section className="section staff-console">
              <h2>{language === 'vi' ? 'Bảng nhân viên' : 'Staff Console'}</h2>
              <p className="notice">{language === 'vi' ? 'Cần quyền nhân viên.' : 'Staff access required.'}</p>
            </section>
          )
        )}

        {activeView === 'tickets' && (
          <TicketBookingView
            activeTicketDuration={activeTicketDuration}
            currentTicketPricing={currentTicketPricing}
            currentTicketTotalPrice={currentTicketTotalPrice}
            currentTicketUnitPrice={currentTicketUnitPrice}
            formatShortDate={formatShortDate}
            formatVnd={formatVnd}
            gameGuideTrigger={renderGameGuideTrigger(null, 'ticket-game-guide-link')}
            isBookingTickets={isBookingTickets}
            isCheckingTicketDiscount={isCheckingTicketDiscount}
            isLoadingTicketLoyalty={isLoadingTicketLoyalty}
            isLoggedIn={Boolean(profile)}
            estimatedLoyaltyPointsEarned={estimatedTicketLoyaltyPointsEarned}
            estimatedLoyaltyReductionValue={estimatedTicketLoyaltyReductionValue}
            loyaltyDiscountAmount={ticketLoyaltyDiscountAmount}
            loyaltyPointsBalance={ticketLoyaltyBalance}
            loyaltyPointsToRedeem={ticketLoyaltyPointsToRedeem}
            loyaltyRedeemValue={ticketLoyaltyRedeemValue}
            maxLoyaltyPointsToRedeem={maxTicketLoyaltyPoints}
            language={language}
            onBookTickets={bookTickets}
            onPromptLogin={promptLogin}
            onTicketDiscountCodeChange={handleTicketDiscountCodeChange}
            onTicketLoyaltyPointsChange={handleTicketLoyaltyPointsChange}
            onTicketDateChange={(value) => {
              setTicketDate(value)
              setTicketTime('')
              setTicketConfirmation(null)
            }}
            onTicketDurationChange={handleTicketDurationChange}
            onTicketPlayersChange={handleTicketPlayersChange}
            onTicketTimeChange={(value) => {
              setTicketTime(value)
              setTicketConfirmation(null)
            }}
            onTicketTypeChange={handleTicketTypeChange}
            onTicketUseLoyaltyPointsChange={handleTicketUseLoyaltyPointsChange}
            tariffTrigger={renderTariffTrigger('ticket-tariff-link')}
            text={looseText}
            ticketConfirmation={ticketConfirmation}
            ticketDate={ticketDate}
            ticketDiscountAmount={activeTicketDiscountAmount}
            ticketDiscountCode={ticketDiscountCode}
            ticketDiscountName={ticketAutomaticDiscountQuote?.discount_name || ticketDiscountQuote?.discount_name || ''}
            ticketDiscountSource={activeTicketDiscountSource}
            ticketDiscountStatus={ticketDiscountStatus}
            ticketDurationMessage={ticketDurationMessage}
            ticketDurationOptions={ticketDurationOptions}
            ticketPlayerOptions={ticketPlayerOptions}
            ticketPlayers={ticketPlayers}
            ticketServices={ticketServices}
            ticketStatus={ticketStatus}
            ticketTime={ticketTime}
            ticketTimeOptions={ticketTimeOptions}
            ticketType={ticketType}
            ticketTypeDescription={ticketTypeDescription}
            ticketTypeLabel={ticketTypeLabel}
            ticketUnitFormulaText={ticketUnitFormulaText}
            useLoyaltyPoints={ticketUseLoyaltyPoints}
          />
        )}

        {activeView === 'create' && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>{text.createSessionTitle}</h2>
                <p className="muted">{text.createSessionHint}</p>
              </div>
            </div>

            <div className="segmented create-session-mode-toggle" aria-label={text.createSessionTitle}>
              <button className={createSessionMode === 'calendar' ? 'active' : ''} onClick={showCalendarMode} type="button">
                {text.calendar}
              </button>
              <button className={createSessionMode === 'form' ? 'active' : ''} onClick={showCreateFormMode} type="button">
                {text.createSession}
              </button>
            </div>

            {createSessionMode === 'calendar' ? (
              <div className="calendar-panel" aria-label={text.calendarAvailabilityTitle}>
                <div className="calendar-toolbar">
                  <div>
                    <strong>{text.calendarAvailabilityTitle}</strong>
                    <span>{text.weekOf} {formatCalendarWeekRange(calendarWeekStart, language)}</span>
                  </div>
                  <div className="calendar-nav">
                    <button
                      aria-label={text.previousWeek}
                      type="button"
                      onClick={() => moveCalendarWeek(-7)}
                    >
                      <ChevronLeft aria-hidden="true" size={18} />
                    </button>
                    <button
                      aria-label={text.nextWeek}
                      type="button"
                      onClick={() => moveCalendarWeek(7)}
                    >
                      <ChevronRight aria-hidden="true" size={18} />
                    </button>
                  </div>
                </div>
                <p className="muted calendar-hint">{text.calendarAvailabilityHint}</p>
                <div className="calendar-scroll" role="region" aria-label={text.calendarAvailabilityTitle}>
                  <div className="calendar-time-column" aria-hidden="true">
                    <div className="calendar-day-header calendar-time-header" />
                    {calendarTimeSlots.map((slot) => (
                      <span className={slot.isHour ? 'calendar-time-label hour' : 'calendar-time-label'} key={slot.value}>
                        {slot.isHour ? slot.value : ''}
                      </span>
                    ))}
                  </div>
                  <div className="calendar-days">
                    {calendarWeekDays.map((day) => {
                      const daySessions = calendarSessions.filter((session) => {
                        if (session.date !== day.value) return false
                        const start = timeToMinutes(session.start_time)
                        return rangesOverlap(start, start + session.duration_minutes, OPEN_MINUTES, CLOSE_MINUTES)
                      })

                      return (
                        <div className="calendar-day-column" key={day.value}>
                          <div className="calendar-day-header">
                            <span>{day.weekday}</span>
                            <strong>{day.day}</strong>
                          </div>
                          <div className="calendar-day-slots">
                            {calendarTimeSlots.map((slot) => {
                              const slotKey = `${day.value}-${slot.value}`
                              const slotAvailable = calendarAvailableSlotKeys.has(slotKey)
                              return (
                                <button
                                  aria-label={`${text.emptySlot}: ${day.weekday} ${day.day} ${slot.value}`}
                                  className={slotAvailable ? 'calendar-slot' : 'calendar-slot unavailable'}
                                  disabled={!slotAvailable}
                                  key={slot.value}
                                  type="button"
                                  onClick={() => startSessionFromCalendar(day.value, slot.value)}
                                >
                                  {slot.isHour ? <span>{slot.value}</span> : null}
                                </button>
                              )
                            })}
                            {daySessions.map((session) => {
                              const coverGame = sessionCoverGame(session)
                              const isTicket = isTicketSession(session)
                              const start = timeToMinutes(session.start_time)
                              const end = start + session.duration_minutes
                              const visibleStart = Math.max(start, OPEN_MINUTES)
                              const visibleEnd = Math.min(end, CLOSE_MINUTES)
                              const topPercent = ((visibleStart - OPEN_MINUTES) / (CLOSE_MINUTES - OPEN_MINUTES)) * 100
                              const heightPercent = Math.max(
                                4,
                                ((visibleEnd - visibleStart) / (CLOSE_MINUTES - OPEN_MINUTES)) * 100
                              )
                              const participantCount = session.session_participants?.length ?? 0
                              const capacity = isTicket ? session.ticket_player_count || session.max_players : session.max_players
                              const sessionKind = isTicket
                                ? text.privateTicketSession
                                : session.visibility === 'private'
                                  ? text.private
                                  : text.public
                              const timeRangeLabel = `${session.start_time.slice(0, 5)}-${minutesToTime(end)}`
                              const calendarSessionLabel = `${session.name}: ${formatShortDate(session.date, language)} ${timeRangeLabel}`

                              return (
                                <button
                                  aria-label={calendarSessionLabel}
                                  className={isTicket ? 'calendar-session-block ticket' : 'calendar-session-block'}
                                  key={session.id}
                                  style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                                  title={calendarSessionLabel}
                                  type="button"
                                  onClick={() => openSessionFromCalendar(session)}
                                >
                                  <span className="calendar-session-compact">
                                    <strong>{session.name}</strong>
                                    <span>{timeRangeLabel}</span>
                                    <small>{coverGame.title}</small>
                                  </span>
                                  <span className="calendar-session-popover" aria-hidden="true">
                                    <strong>{session.name}</strong>
                                    <span>{formatShortDate(session.date, language)} · {timeRangeLabel}</span>
                                    <span>{coverGame.title}</span>
                                    <span>{session.duration_minutes} min · {sessionKind}</span>
                                    <span>{participantCount}/{capacity} {text.players}</span>
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="create-session-form" id="create-session-form">
            <div className="form-grid">
              <div className="full">
                <label>{text.sessionName} <span className="required">*</span></label>
                <input data-testid="create-session-name" placeholder={text.fridayPlaceholder} value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
              </div>
              <div className="full session-mode-row">
                <div>
                  <label>{text.sessionType}</label>
                  <div className="segmented session-type-toggle">
                    <button className={sessionType === 'game' ? 'active' : ''} onClick={() => setSessionType('game')} type="button">
                      {text.normalGame}
                    </button>
                    <button className={sessionType === 'tournament' ? 'active' : ''} onClick={() => setSessionType('tournament')} type="button">
                      {text.tournament}
                    </button>
                  </div>
                </div>
                {!sessionClubId && (
                  <div>
                    <label>{text.visibility}</label>
                    <div className="segmented visibility-toggle">
                      <button className={sessionVisibility === 'public' ? 'active' : ''} onClick={() => setSessionVisibility('public')} type="button">
                        {text.public}
                      </button>
                      <button className={sessionVisibility === 'private' ? 'active' : ''} onClick={() => setSessionVisibility('private')} type="button">
                        {text.private}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {sessionType === 'tournament' && (
                <div className="full tournament-create-box tournament-settings-box">
                  <div className="tournament-settings-head">
                    <strong>{text.tournamentRules}</strong>
                    <span>{text.tournamentRulesHint}</span>
                  </div>
                  <div className="form-grid compact-form-grid">
                    <div>
                      <label>{text.tournamentFormat}</label>
                      <select value={tournamentFormat} onChange={(event) => setTournamentFormat(event.target.value as TournamentFormat)}>
                        <option value="pool_only">{text.formatPoolOnly}</option>
                        <option value="pool_to_semifinal">{text.formatPoolSemifinal}</option>
                        <option value="pool_to_final">{text.formatPoolFinal}</option>
                        <option value="single_elimination">{text.formatSingleElimination}</option>
                        <option value="double_elimination">{text.formatDoubleElimination}</option>
                        <option value="leaderboard">{text.formatLeaderboard}</option>
                      </select>
                    </div>
                    <div>
                      <label>{text.matchSeries}</label>
                      <select value={tournamentBestOf} onChange={(event) => setTournamentBestOf(Number(event.target.value) as 1 | 3 | 5)}>
                        <option value={1}>BO1</option>
                        <option value={3}>BO3</option>
                        <option value={5}>BO5</option>
                      </select>
                    </div>
                    <div>
                      <label>{text.roundsPerMatch}</label>
                      <select value={tournamentRoundsPerMatch} onChange={(event) => setTournamentRoundsPerMatch(Number(event.target.value))}>
                        {[1, 2, 3, 4, 5].map((roundCount) => (
                          <option key={roundCount} value={roundCount}>{roundCount}</option>
                        ))}
                      </select>
                      <p className="field-help">{text.roundsPerMatchHint}</p>
                    </div>
                    <div>
                      <label>{text.qualification}</label>
                      <select value={tournamentQualificationRule} onChange={(event) => setTournamentQualificationRule(event.target.value as QualificationRule)}>
                        <option value="top_1">{text.topOnePerPool}</option>
                        <option value="top_2">{text.topTwoPerPool}</option>
                        <option value="top_4">{text.topFourPerPool}</option>
                        <option value="custom">{text.custom}</option>
                      </select>
                    </div>
                    {tournamentQualificationRule === 'custom' && (
                      <div>
                        <label>{text.customQualifiers}</label>
                        <input inputMode="numeric" min={1} max={16} type="number" value={tournamentCustomQualifiers} onChange={(event) => setTournamentCustomQualifiers(Number(event.target.value) || 1)} />
                      </div>
                    )}
                    <label className="toggle-line">
                      <input checked={tournamentRequirePayment} onChange={(event) => setTournamentRequirePayment(event.target.checked)} type="checkbox" />
                      <span>{text.requirePaymentForBracket}</span>
                    </label>
                    <label className="toggle-line">
                      <input checked={tournamentThirdPlace} onChange={(event) => setTournamentThirdPlace(event.target.checked)} type="checkbox" />
                      <span>{text.createBronzeMatch}</span>
                    </label>
                    <div>
                      <label>{text.firstPrize}</label>
                      <input value={tournamentFirstPrize} onChange={(event) => setTournamentFirstPrize(event.target.value)} placeholder="1,000,000 VND" />
                    </div>
                    <div>
                      <label>{text.secondPrize}</label>
                      <input value={tournamentSecondPrize} onChange={(event) => setTournamentSecondPrize(event.target.value)} placeholder="Free Ticket" />
                    </div>
                    <div>
                      <label>{text.thirdPrize}</label>
                      <input value={tournamentThirdPrize} onChange={(event) => setTournamentThirdPrize(event.target.value)} placeholder="Free Drink" />
                    </div>
                  </div>
                </div>
              )}
              <div className="full">
                <label>{text.clubOnly}</label>
                <select value={sessionClubId} onChange={(event) => handleSessionClubChange(event.target.value)}>
                  <option value="">{text.noClub}</option>
                  {sessionClubOptions.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
                {sessionClubId && <p className="field-help">{text.clubOnlySessionHint}</p>}
              </div>
              <div className="full session-timing-row">
                <div>
                  <label>{text.date} <span className="required">*</span></label>
                  <ShortDateInput
                    ariaLabel={text.date}
                    language={language}
                    onChange={handleSessionDateChange}
                    placeholder={text.chooseDate}
                    value={sessionDate}
                  />
                </div>
                <div>
                  <label>{text.availableTime} <span className="required">*</span></label>
                  <select data-testid="create-session-time" value={sessionTime} onChange={(event) => setSessionTime(event.target.value)}>
                    <option value="">{text.chooseTime}</option>
                    {timeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{text.duration}</label>
                  <select data-testid="create-session-duration" value={sessionDuration} onChange={(event) => setSessionDuration(Number(event.target.value))}>
                    {Array.from({ length: 12 }, (_, index) => (index + 1) * 20).map((duration) => (
                      <option value={duration} key={duration}>
                        {duration} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="full session-capacity-row">
                <div>
                  <label>{text.maxPlayers}</label>
                  <select data-testid="create-session-max-players" value={sessionMaxPlayers} onChange={(event) => handleMaxPlayersChange(Number(event.target.value))}>
                    {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                      <option value={count} key={count}>
                        {count} player{count === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{text.arenas}</label>
                  <select value={sessionArenaCount} onChange={(event) => handleArenaCountChange(Number(event.target.value))}>
                    <option value={1}>{text.oneArena}</option>
                    <option value={2} disabled={sessionMaxPlayers < 8}>
                      {text.twoArenas}
                    </option>
                  </select>
                </div>
              </div>
              {sessionDurationRecommendation && (
                <p className="full notice duration-recommendation">{sessionDurationRecommendation}</p>
              )}
              <div className="full">
                <div className="game-picker-head">
                  <label>{text.gameOptions} <span className="required">*</span></label>
                  {renderGameGuideTrigger(null, 'game-picker-guide-link')}
                </div>
                <div className="game-picker">
                  {games.map((game) => (
                    <div className="game-card-shell" key={game.id}>
                      <button
                        className={selectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                        onClick={() => toggleGame(game.id)}
                        type="button"
                      >
                        <NextImage src={game.image} alt="" width={240} height={240} />
                        <span>{game.title}</span>
                        <strong>{game.category}</strong>
                      </button>
                      {renderGameGuideTrigger(game.id, 'game-card-guide')}
                    </div>
                  ))}
                </div>
              </div>
              <div className="full">
                <label>{text.notes}</label>
                <div className="format-toolbar">
                  <button type="button" aria-label={text.formatBold} title={text.formatBold} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('bold') }}><Bold aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                  <button type="button" aria-label={text.formatItalic} title={text.formatItalic} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('italic') }}><Italic aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                  <button type="button" aria-label={text.formatUnderline} title={text.formatUnderline} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('underline') }}><Underline aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                  <button type="button" aria-label={text.formatStrike} title={text.formatStrike} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('strikeThrough') }}><Strikethrough aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                </div>
                <RichNotesEditor
                  value={sessionNotes}
                  onChange={setSessionNotes}
                  placeholder={text.notesPlaceholder}
                  resetKey={`create-${activeView}`}
                />
              </div>
            </div>

            <button data-testid="create-session-submit" className={isCreating ? 'primary loading create-button' : 'primary create-button'} disabled={isCreating} onClick={createSession}>
              {isCreating ? text.creating : sessionVisibility === 'private' ? text.createPrivateSession : text.createSession}
            </button>
              </div>
            )}
            {createStatus && <p className="notice">{createStatus}</p>}
          </section>
        )}

        {activeView === 'profile' && (
          <section className={!profile ? 'section profile-auth-section' : 'section profile-account-section'}>
            <h2>{profile ? text.profile : isRecoveryMode ? text.setNewPasswordTitle : authMode === 'reset' ? text.resetPasswordTitle : text.authWelcomeTitle}</h2>
            {(profile || isRecoveryMode || authMode === 'reset') && (
              <p className="muted">
                {profile
                  ? text.profileUpdateHint
                  : isRecoveryMode
                    ? text.setNewPasswordIntro
                    : text.resetPasswordIntro}
              </p>
            )}

            {!mfaRequired && !profile && !isRecoveryMode && authMode !== 'reset' && (
              <div className="segmented auth-toggle">
                <button
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => updateAuthMode('login')}
                  type="button"
                >
                  {text.logIn}
                </button>
                <button
                  className={authMode === 'create' ? 'active' : ''}
                  onClick={() => updateAuthMode('create')}
                  type="button"
                >
                  {text.createAccountTab}
                </button>
              </div>
            )}

            {!mfaRequired && !profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'email' && (
              <div className="auth-method-stack">
                <button
                  className={isOAuthLoading ? 'secondary create-button google-auth-button loading' : 'secondary create-button google-auth-button'}
                  disabled={isOAuthLoading}
                  onClick={signInWithGoogle}
                  type="button"
                >
                  <span className="google-mark" aria-hidden="true">
                    <svg viewBox="0 0 18 18" focusable="false">
                      <path fill="#4285f4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                      <path fill="#34a853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.35 0-4.34-1.58-5.05-3.72H.93v2.33A9 9 0 0 0 9 18Z" />
                      <path fill="#fbbc05" d="M3.95 10.7a5.41 5.41 0 0 1 0-3.4V4.97H.93a9 9 0 0 0 0 8.06l3.02-2.33Z" />
                      <path fill="#ea4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .93 4.97L3.95 7.3C4.66 5.16 6.65 3.58 9 3.58Z" />
                    </svg>
                  </span>
                  {text.continueWithGoogle}
                </button>
                {authMode === 'login' && (
                  <button
                    className={isPasskeyLoading ? 'secondary create-button passkey-auth-button loading' : 'secondary create-button passkey-auth-button'}
                    disabled={isPasskeyLoading || !isPasskeyCaptchaReady}
                    onClick={signInWithPasskey}
                    ref={passkeyButtonRef}
                    type="button"
                  >
                    <span className="passkey-mark" aria-hidden="true">
                      <KeyRound size={19} strokeWidth={2.4} />
                    </span>
                    {text.continueWithPasskey}
                  </button>
                )}
                <div className="auth-divider">
                  <span>{text.authOr}</span>
                </div>
                {authMode === 'login' && <div className="passkey-captcha-box" ref={passkeyCaptchaContainerRef} aria-hidden="true" />}
              </div>
            )}

            <div className={[
              'form-grid profile-form',
              profile ? 'profile-account-form' : '',
              !profile && (authMode === 'login' || authMode === 'create' || authMode === 'reset' || isRecoveryMode) ? 'login-profile-form' : '',
              !profile && authMode === 'create' ? 'create-profile-form' : '',
            ].join(' ').trim()} hidden={mfaRequired}>
              {showProfileFields && (
                <div className={profile ? 'profile-photo-panel profile-account-hero' : 'profile-photo-panel'}>
                  <label className="profile-photo-preview" style={{ background: profile?.anonymous_mode ? ANONYMOUS_MASK_COLOR : avatarColor, color: profile?.anonymous_mode ? ANONYMOUS_MASK_TEXT_COLOR : avatarTextColor }}>
                    {profile?.anonymous_mode ? (
                      <span className="avatar-emoji">{ANONYMOUS_MASK_EMOJI}</span>
                    ) : avatarMode === 'photo' && (avatarPreview || profile?.avatar_url) ? (
                      <NextImage
                        src={avatarPreview || profile?.avatar_url || ''}
                        alt=""
                        width={112}
                        height={112}
                        unoptimized={shouldSkipImageOptimization(avatarPreview || profile?.avatar_url)}
                      />
                    ) : avatarMode === 'emoji' ? (
                      <span className="avatar-emoji">{avatarEmoji}</span>
                    ) : avatarMode === 'initials' ? (
                      <span className="avatar-text">{compactInitials(avatarInitials || displayName(profile))}</span>
                    ) : (
                      <span className="avatar-text">{compactInitials(displayName(profile))}</span>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} />
                  </label>
                  <div className="profile-identity-copy">
                    <strong>{profile ? displayName(profile) : text.profilePhoto}</strong>
                    <span>{text.uploadPhoto}</span>
                    {profile && (
                      <div className="profile-summary-pills" aria-label={text.playerProfile}>
                        {profileEmail && (
                          <span><Mail aria-hidden="true" size={13} /><span className="profile-summary-text">{profileEmail}</span></span>
                        )}
                        {profilePhone && (
                          <span><Phone aria-hidden="true" size={13} /><span className="profile-summary-text">{profileCountryCode} {profilePhone}</span></span>
                        )}
                        {profileBirthday && (
                          <span><CalendarDays aria-hidden="true" size={13} /><span className="profile-summary-text">{formatShortDate(profileBirthday, language)}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="avatar-options">
                    {profile && (
                      <label className="profile-toggle-field anonymous-mode-toggle">
                        <input
                          checked={Boolean(profile.anonymous_mode)}
                          disabled={isSavingAnonymousMode}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setAnonymousConfirmOpen(true)
                              return
                            }
                            updateAnonymousMode(false)
                          }}
                          type="checkbox"
                        />
                        <span>
                          <strong>{text.anonymousMode}</strong>
                          <small>{text.anonymousModeHint}</small>
                        </span>
                      </label>
                    )}
                    <span>{text.avatarStyle}</span>
                    <div className="segmented compact-segmented">
                      <button className={avatarMode === 'photo' ? 'active' : ''} onClick={() => chooseAvatarMode('photo')} type="button">{text.usePhoto}</button>
                      <button className={avatarMode === 'emoji' ? 'active' : ''} onClick={() => chooseAvatarMode('emoji')} type="button">{text.useEmoji}</button>
                      <button className={avatarMode === 'initials' ? 'active' : ''} onClick={() => chooseAvatarMode('initials')} type="button">{text.useInitials}</button>
                    </div>
                    {avatarMode === 'emoji' && (
                      <div className="emoji-row">
                        {avatarEmojis.map((emoji) => (
                          <button className={avatarEmoji === emoji ? 'active' : ''} key={emoji} onClick={() => setAvatarEmoji(emoji)} type="button">{emoji}</button>
                        ))}
                      </div>
                    )}
                    {avatarMode === 'initials' && (
                      <input maxLength={2} value={avatarInitials} onChange={(event) => setAvatarInitials(compactInitials(event.target.value))} placeholder="VR" aria-label={text.avatarInitials} />
                    )}
                    {avatarMode !== 'photo' && (
                      <>
                        <div className="avatar-color-field">
                          <div className="color-row" aria-label={text.avatarColor}>
                            {avatarColors.map((color) => (
                              <button
                                className={avatarColor === color ? 'active' : ''}
                                key={color}
                                onClick={() => updateAvatarColor(color)}
                                style={{ background: color }}
                                type="button"
                              />
                            ))}
                          </div>
                          <div className="custom-color-row">
                            <label>
                              <span>{text.customColor}</span>
                              <input type="color" value={avatarColor} onChange={(event) => updateAvatarColor(event.target.value)} />
                            </label>
                            <label className="hex-field">
                              <span>{text.hexColor}</span>
                              <input
                                maxLength={7}
                                value={avatarColorDraft}
                                onBlur={() => setAvatarColorDraft(avatarColor)}
                                onChange={(event) => updateAvatarColorDraft(event.target.value)}
                                placeholder="#3059ff"
                              />
                            </label>
                          </div>
                        </div>
                        {avatarMode === 'initials' && (
                          <>
                            <div className="avatar-color-field">
                              <div className="color-row" aria-label={text.avatarTextColor}>
                                {avatarTextColors.map((color) => (
                                  <button
                                    className={avatarTextColor === color ? 'active' : ''}
                                    key={color}
                                    onClick={() => updateAvatarTextColor(color)}
                                    style={{ background: color }}
                                    type="button"
                                  />
                                ))}
                              </div>
                              <div className="custom-color-row">
                                <label>
                                  <span>{text.avatarTextColor}</span>
                                  <input type="color" value={avatarTextColor} onChange={(event) => updateAvatarTextColor(event.target.value)} />
                                </label>
                                <label className="hex-field">
                                  <span>{text.hexColor}</span>
                                  <input
                                    maxLength={7}
                                    value={avatarTextColorDraft}
                                    onBlur={() => setAvatarTextColorDraft(avatarTextColor)}
                                    onChange={(event) => updateAvatarTextColorDraft(event.target.value)}
                                    placeholder="#ffffff"
                                  />
                                </label>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {profile && showProfileFields && (
                <div className="profile-card-section-title">
                  <UserRound aria-hidden="true" size={17} />
                  <span>{text.profile}</span>
                </div>
              )}
              {showProfileFields && (
                <>
                  <div className="country-phone-field">
                    <label className="country-phone-label">{text.phoneNumber} <span className="required">*</span></label>
                    <div className="country-field">
                      <div className="country-picker">
                        <button
                          aria-label={text.countryCode}
                          className="country-button"
                          onClick={() => setCountryPickerOpen((open) => !open)}
                          type="button"
                        >
                          {profileCountryCode}
                        </button>
                        {countryPickerOpen && (
                          <div className="country-menu">
                            <input
                              autoFocus
                              value={countrySearch}
                              onChange={(event) => setCountrySearch(event.target.value)}
                              placeholder={text.searchCountry}
                            />
                            <div className="country-list">
                              {filteredCountries.map((country) => (
                                <button
                                  key={`${country.code}-${country.name}`}
                                  onClick={() => {
                                    setProfileCountryCode(country.code)
                                    setCountrySearch('')
                                    setCountryPickerOpen(false)
                                  }}
                                  type="button"
                                >
                                  <span>{country.code}</span>
                                  <strong>{country.name}</strong>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="phone-field">
                      <input aria-label={text.phoneNumber} value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="0981152315" />
                    </div>
                  </div>
                </>
              )}
              {(profile || authMode === 'reset' || isRecoveryMode || authStep === 'email') && (
                <div className="email-field">
                  <label>{text.email} <span className="required">*</span></label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                    placeholder="contact@vre-vietnam.com"
                  />
                </div>
              )}
              {!profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'credentials' && (
                <div className="auth-email-review">
                  <span>{profileEmail}</span>
                  <button className="auth-inline-link" onClick={editAuthEmail} type="button">
                    {text.changeEmail}
                  </button>
                </div>
              )}
              {showProfileFields && (
                <div className="name-field">
                  <label>{text.name} <span className="required">*</span></label>
                  <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Nguyen Van A" />
                </div>
              )}
              {showProfileFields && (
                <div className="nickname-field">
                  <label>{text.nickname}</label>
                  <input
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    value={profileNickname}
                    onChange={(event) => setProfileNickname(limitDisplayName(event.target.value))}
                    placeholder={text.optional}
                  />
                </div>
              )}
              {showProfileFields && (
                <div className="motto-field">
                  <label>{text.profileMotto}</label>
                  <input
                    maxLength={20}
                    value={profileMotto}
                    onChange={(event) => setProfileMotto(limitMotto(event.target.value))}
                    placeholder={text.profileMottoPlaceholder}
                  />
                  <p className="field-help">{text.profileMottoHelp}</p>
                </div>
              )}
              {showProfileFields && (
                <div className="birthday-field">
                  <label>{text.birthday}</label>
                  <ShortDateInput
                    ariaLabel={text.birthday}
                    language={language}
                    onChange={setProfileBirthday}
                    placeholder={text.chooseDate}
                    value={profileBirthday}
                  />
                </div>
              )}
              {showProfileFields && (
                <div className="gender-field">
                  <label>{text.gender}</label>
                  <select value={profileGender} onChange={(event) => setProfileGender(normalizeProfileGender(event.target.value))}>
                    <option value="">{text.optional}</option>
                    <option value="male">{text.genderMale}</option>
                    <option value="female">{text.genderFemale}</option>
                    <option value="non_binary">{text.genderNonBinary}</option>
                    <option value="prefer_not_to_say">{text.genderPreferNotToSay}</option>
                    <option value="self_describe">{text.genderSelfDescribe}</option>
                  </select>
                </div>
              )}
              {profile && showProfileFields && (
                <div className="profile-card-section-title profile-preferences-title">
                  <Bell aria-hidden="true" size={17} />
                  <span>{text.profilePreferences}</span>
                </div>
              )}
              {showProfileFields && (
                <label className="consent-field marketing-consent-field">
                  <input
                    checked={marketingConsent}
                    onChange={(event) => {
                      const nextConsent = event.target.checked
                      if (profile) {
                        updateMarketingConsent(nextConsent)
                      } else {
                        setMarketingConsent(nextConsent)
                      }
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>{text.marketingConsent}</strong>
                    <small>{text.marketingConsentHint}</small>
                  </span>
                </label>
              )}
              {!profile && authMode === 'create' && authStep === 'credentials' && (
                <label className="consent-field">
                  <input
                    checked={personalDataConsent}
                    onChange={(event) => setPersonalDataConsent(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    {text.consentPrefix}
                    <a href={PRIVACY_POLICY_URL} rel="noreferrer" target="_blank">
                      {text.privacyPolicy}
                    </a>
                    {text.consentSuffix}
                  </span>
                </label>
              )}
              {!profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'credentials' && (
                <div className="password-field">
                  <label>{text.password} <span className="required">*</span></label>
                  <div className="password-control">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={profilePassword}
                      onChange={(event) => setProfilePassword(event.target.value)}
                      placeholder={text.passwordPlaceholder}
                    />
                    <button type="button" aria-label={showPassword ? text.hidePassword : text.showPassword} title={showPassword ? text.hidePassword : text.showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                    </button>
                  </div>
                  {authMode === 'create' && <p className="field-help">{text.passwordHelp}</p>}
                  {authMode === 'login' && (
                    <div className="auth-utility-row">
                      <label className="remember-field">
                        <input
                          checked={rememberLogin}
                          onChange={(event) => setRememberLogin(event.target.checked)}
                          type="checkbox"
                        />
                        <span>{text.rememberMe}</span>
                      </label>
                      <button
                        className="auth-inline-link"
                        onClick={() => {
                          setAuthMode('reset')
                          setAuthStep('email')
                          setProfileStatus('')
                          resetCaptcha()
                        }}
                        type="button"
                      >
                        {text.forgotPassword}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!profile && !isRecoveryMode && (authMode === 'reset' || (authMode === 'create' && authStep === 'credentials')) && (
                <div className="captcha-field">
                  <label>{text.captchaLabel} <span className="required">*</span></label>
                  <div className="captcha-box" ref={captchaContainerRef} />
                  <p className="field-help">{authMode === 'reset' ? text.resetPasswordCaptchaHelp : text.captchaHelp}</p>
                </div>
              )}
              {isRecoveryMode && (
                <div className="password-field">
                  <label>{text.newPassword} <span className="required">*</span></label>
                  <div className="password-control">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder={text.passwordPlaceholder}
                    />
                    <button type="button" aria-label={showPassword ? text.hidePassword : text.showPassword} title={showPassword ? text.hidePassword : text.showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                    </button>
                  </div>
                  <p className="field-help">{text.resetPasswordReady}</p>
                </div>
              )}
            </div>

            {mfaRequired ? (
              <div className="mfa-challenge-panel">
                <div className="mfa-panel-icon">
                  <ShieldCheck aria-hidden="true" size={22} />
                </div>
                <div className="mfa-panel-copy">
                  <strong>{text.mfaChallengeTitle}</strong>
                  <span>{text.mfaChallengeHint}</span>
                </div>
                <div className="mfa-code-row">
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={8}
                    onChange={(event) => setMfaChallengeCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder={text.mfaCodePlaceholder}
                    value={mfaChallengeCode}
                  />
                  <button className={isMfaLoading ? 'primary loading' : 'primary'} disabled={isMfaLoading} onClick={verifyMfaChallenge} type="button">
                    {isMfaLoading ? text.saving : text.mfaVerify}
                  </button>
                </div>
                <button className="auth-inline-link" onClick={logout} type="button">{text.logOut}</button>
              </div>
            ) : (authMode === 'reset' && !profile && !isRecoveryMode) ? (
              <div className="action-row">
                <button
                  className={isResettingPassword ? 'primary loading create-button' : 'primary create-button'}
                  disabled={isResettingPassword}
                  onClick={sendPasswordReset}
                  type="button"
                >
                  {isResettingPassword ? text.saving : text.resetPasswordCta}
                </button>
                <button
                  className="secondary create-button"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthStep('email')
                    setProfileStatus('')
                    resetCaptcha()
                  }}
                  type="button"
                >
                  {text.backToLogin}
                </button>
              </div>
            ) : isRecoveryMode ? (
              <div className="action-row">
                <button
                  className={isResettingPassword ? 'primary loading create-button' : 'primary create-button'}
                  disabled={isResettingPassword}
                  onClick={updatePasswordFromRecovery}
                  type="button"
                >
                  {isResettingPassword ? text.saving : text.updatePassword}
                </button>
              </div>
            ) : (
              <div className={profile ? 'action-row profile-save-actions' : 'action-row'}>
                <button
                  className={isSavingProfile ? 'primary loading create-button' : 'primary create-button'}
                  disabled={isSavingProfile}
                  onClick={profile ? saveProfile : authStep === 'email' && authMode !== 'reset' ? continueAuthFromEmail : handleAuth}
                  type="button"
                >
                  {isSavingProfile
                    ? profile
                      ? text.saving
                      : authMode === 'login'
                        ? text.loggingIn
                        : text.creating
                    : profile
                      ? text.saveProfile
                      : authStep === 'email' && authMode !== 'reset'
                        ? text.continueWithEmail
                      : authMode === 'login'
                        ? text.logIn
                        : text.createAccount}
                </button>
                {profile && canAccessStaffConsole && (
                  <button className="secondary create-button mobile-staff-profile-action" onClick={() => setActiveView('staff')} type="button">
                    Staff Console
                  </button>
                )}
                {profile && (
                  <button className="secondary create-button" onClick={logout} type="button">
                    {text.logOut}
                  </button>
                )}
              </div>
            )}
            {profile && (
              <div className="profile-security-panel">
                <div className="profile-card-section-title">
                  <ShieldCheck aria-hidden="true" size={17} />
                  <span>{text.profileSecurity}</span>
                </div>
                <div className="account-links">
                  <button className="link-button" disabled={isPasskeyLoading} onClick={registerPasskey} type="button">
                    <ButtonIconText icon={<KeyRound aria-hidden="true" size={16} />}>{isPasskeyLoading ? text.saving : text.addPasskey}</ButtonIconText>
                  </button>
                  <button className="link-button" disabled={isResettingPassword} onClick={sendPasswordReset} type="button">
                    <ButtonIconText icon={<LockKeyhole aria-hidden="true" size={16} />}>{isResettingPassword ? text.saving : text.resetPassword}</ButtonIconText>
                  </button>
                  <button className="link-button danger-link" disabled={isDeletingAccount} onClick={deleteMyAccount} type="button">
                    <ButtonIconText icon={<Trash2 aria-hidden="true" size={16} />}>{isDeletingAccount ? text.saving : text.deleteAccount}</ButtonIconText>
                  </button>
                  {activeTotpFactor ? (
                    <button
                      aria-label={text.mfaDisable}
                      className="link-button"
                      disabled={isMfaLoading}
                      onClick={() => removeTotpFactor(activeTotpFactor.id)}
                      title={text.mfaEnabledHint}
                      type="button"
                    >
                      <ButtonIconText icon={<ScanLine aria-hidden="true" size={16} />}>{isMfaLoading ? text.saving : text.mfaAuthenticatorTitle}</ButtonIconText>
                    </button>
                  ) : (
                    <button
                      aria-label={text.mfaEnable}
                      className="link-button"
                      disabled={isMfaLoading}
                      onClick={beginTotpEnrollment}
                      title={text.mfaAuthenticatorHint}
                      type="button"
                    >
                      <ButtonIconText icon={<ScanLine aria-hidden="true" size={16} />}>{isMfaLoading ? text.saving : text.mfaAuthenticatorTitle}</ButtonIconText>
                    </button>
                  )}
                </div>
                {mfaEnrollment && (
                  <div className="mfa-enroll-panel">
                    <div className="mfa-panel-copy">
                      <strong>{text.mfaSetupTitle}</strong>
                      <span>{text.mfaSetupHint}</span>
                    </div>
                    {mfaQrCodeSrc && <img alt="" className="mfa-qr" src={mfaQrCodeSrc} />}
                    <label className="mfa-secret-field">
                      <span>{text.mfaSecretLabel}</span>
                      <input readOnly type="text" value={mfaEnrollment.secret} />
                    </label>
                    <label className="mfa-code-field">
                      <span>{text.mfaCodeLabel}</span>
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={8}
                        onChange={(event) => setMfaVerifyCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder={text.mfaCodePlaceholder}
                        value={mfaVerifyCode}
                      />
                    </label>
                    <div className="mfa-enroll-actions">
                      <button className={isMfaLoading ? 'primary loading' : 'primary'} disabled={isMfaLoading} onClick={confirmTotpEnrollment} type="button">
                        {isMfaLoading ? text.saving : text.mfaVerify}
                      </button>
                      <button className="secondary" disabled={isMfaLoading} onClick={() => {
                        setMfaEnrollment(null)
                        setMfaVerifyCode('')
                        setMfaStatus('')
                      }} type="button">
                        {text.mfaCancel}
                      </button>
                    </div>
                  </div>
                )}
                {mfaStatus && <p className="notice compact-notice">{mfaStatus}</p>}
              </div>
            )}
            {profileStatus && <p className="notice">{profileStatus}</p>}

            <div className="profile-mobile-contact">
              <strong>VRena Vietnam</strong>
              <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
              <a href="https://zalo.me/84981152315" target="_blank" rel="noreferrer">Zalo: 0981152315</a>
              <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
            </div>

            {profile && (
              <div className="player-stats">
                <div className="profile-stats-head">
                  <h3>{text.stats} {crownedTopPlayer?.profileId === userId ? '🏆' : ''}</h3>
                  {canShareCurrentUserStats && (
                    <button className="secondary small-button" type="button" onClick={() => shareCurrentUserStats()}>
                      <ButtonIconText icon={<Share aria-hidden="true" size={15} />}>{currentUserStatsShared ? text.shared : text.shareStats}</ButtonIconText>
                    </button>
                  )}
                </div>
                {crownedTopPlayer?.profileId === userId && <p className="notice">{text.bestPlayer}</p>}
                <div className="stats">
                  <span>{playerStats.gamesJoined} {text.gamesCheckedIn}</span>
                  <span>{playerStats.wins} {text.wins}</span>
                  <span>{playerStats.bestPerformerCount} {bestPerformerCountText}</span>
                  <span>{playerStats.totalScore} {text.totalScore}</span>
                  <span>{formatWholePercent(playerStats.averageAccuracy)} {text.accuracy}</span>
                  <span>{playerStats.totalProjectiles} {text.projectiles}</span>
                </div>
                {playerStats.bestByGame.length > 0 && (
                  <div className="best-score-list">
                    <strong>{text.bestScores}</strong>
                    {playerStats.bestByGame.map((item) => (
                      <span key={item.game}>{item.game}: {item.score}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {profile && (
              <div className="my-sessions">
                <div>
                  <h3>{text.mySessions}</h3>
                  <p className="muted">{text.mySessionsHint}</p>
                </div>

                {pendingSessionInvites.length > 0 && (
                  <div className="profile-session-group profile-invites">
                    <div className="profile-session-group-head">
                      <div>
                        <h4>{pendingInvitationsText}</h4>
                        <p className="muted">{pendingInvitationsHintText}</p>
                      </div>
                      {pendingSessionInvites.length > 1 && (
                        <button className="secondary small-button" type="button" onClick={() => setProfileInvitesExpanded((expanded) => !expanded)}>
                          <ButtonIconText icon={profileInvitesExpanded ? <ChevronUp aria-hidden="true" size={15} /> : <ChevronDown aria-hidden="true" size={15} />}>{profileInvitesExpanded ? text.hideDetails : text.expandDetails}</ButtonIconText>
                        </button>
                      )}
                    </div>
                    <div className="mini-session-list">
                      {(profileInvitesExpanded ? pendingSessionInvites : pendingSessionInvites.slice(0, 1)).map((invite) => renderPendingInvite(invite))}
                    </div>
                  </div>
                )}

                {mySessions.length === 0 ? (
                  <p className="notice">{text.noSessionsYet}</p>
                ) : (
                  <>
                    <div className="profile-session-group">
                      <div className="profile-session-group-head">
                        <h4>{text.upcoming}</h4>
                        {profileUpcomingSessions.length > 1 && (
                          <button className="secondary small-button" type="button" onClick={() => setProfileUpcomingExpanded((expanded) => !expanded)}>
                            <ButtonIconText icon={profileUpcomingExpanded ? <ChevronUp aria-hidden="true" size={15} /> : <ChevronDown aria-hidden="true" size={15} />}>{profileUpcomingExpanded ? text.hideDetails : text.expandDetails}</ButtonIconText>
                          </button>
                        )}
                      </div>
                      {profileUpcomingSessions.length === 0 ? (
                        <p className="notice">{text.noMatchingSessions}</p>
                      ) : (
                        <div className="mini-session-list">
                          {(profileUpcomingExpanded ? profileUpcomingSessions : profileUpcomingSessions.slice(0, 1)).map((session) => renderProfileSessionCard(session))}
                        </div>
                      )}
                    </div>

                    <div className="profile-session-group">
                      <div className="profile-session-group-head">
                        <h4>{text.past}</h4>
                        {profilePastSessions.length > 1 && (
                          <button className="secondary small-button" type="button" onClick={() => setProfilePastExpanded((expanded) => !expanded)}>
                            <ButtonIconText icon={profilePastExpanded ? <ChevronUp aria-hidden="true" size={15} /> : <ChevronDown aria-hidden="true" size={15} />}>{profilePastExpanded ? text.hideDetails : text.expandDetails}</ButtonIconText>
                          </button>
                        )}
                      </div>
                      {profilePastSessions.length === 0 ? (
                        <p className="notice">{text.noMatchingSessions}</p>
                      ) : (
                        <div className="mini-session-list">
                          {(profilePastExpanded ? profilePastSessions : profilePastSessions.slice(0, 1)).map((session) => renderProfileSessionCard(session))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

      </main>
  )

  const appOverlays = (
    <>
      {loginPromptOpen && (
        <LoginPromptModal
          closeText={text.close}
          title={text.loginPromptTitle}
          message={text.loginPromptMessage}
          buttonText={text.loginPromptButton}
          onClose={() => setLoginPromptOpen(false)}
          onLogin={goToLogin}
        />
      )}

      {clubUnlockTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="club-unlock-title" onClick={closeClubUnlockModal}>
          <form className="login-modal" onSubmit={unlockClubPage} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={closeClubUnlockModal} aria-label={text.close}>
              <X aria-hidden="true" size={20} />
            </button>
            <h3 id="club-unlock-title">{text.unlockClub}</h3>
            <p>{text.privateClubLocked}</p>
            <p className="muted">{clubUnlockTarget.name}</p>
            <label>
              <span>{text.privateCode}</span>
              <input
                autoComplete="off"
                autoFocus
                inputMode="text"
                placeholder={text.privateCode}
                value={clubUnlockCode}
                onChange={(event) => {
                  setClubUnlockCode(event.target.value.toUpperCase())
                  setClubUnlockStatus('')
                }}
              />
            </label>
            {clubUnlockStatus && <p className="notice error">{clubUnlockStatus}</p>}
            <div className="club-action-row">
              <button className="primary create-button" type="submit">
                {text.unlockClub}
              </button>
              <button className="secondary create-button" type="button" onClick={closeClubUnlockModal}>
                {text.close}
              </button>
            </div>
          </form>
        </div>
      )}

      {anonymousConfirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="anonymous-mode-title" onClick={() => setAnonymousConfirmOpen(false)}>
          <div className="login-modal anonymous-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setAnonymousConfirmOpen(false)} aria-label={text.close}>
              <X aria-hidden="true" size={20} />
            </button>
            <div className="anonymous-mask-preview" aria-hidden="true">{ANONYMOUS_MASK_EMOJI}</div>
            <h3 id="anonymous-mode-title">{text.goAnonymousTitle}</h3>
            <p>{text.goAnonymousBody}</p>
            <div className="club-action-row">
              <button className="secondary create-button" type="button" onClick={() => setAnonymousConfirmOpen(false)}>
                {text.cancel}
              </button>
              <button className={isSavingAnonymousMode ? 'primary loading create-button' : 'primary create-button'} disabled={isSavingAnonymousMode} type="button" onClick={() => updateAnonymousMode(true)}>
                {text.activateAnonymousMode}
              </button>
            </div>
          </div>
        </div>
      )}

      {invitePopupInvite && invitePopupSession && (
        <InvitePopupModal
          closeText={text.close}
          title={invitationPopupTitleText}
          body={invitationPopupBodyText}
          sessionName={invitePopupSession.name}
          sessionImage={sessionCoverGame(invitePopupSession).image}
          invitedText={text.invited}
          dateText={formatShortDate(invitePopupSession.date, language)}
          timeText={invitePopupSession.start_time.slice(0, 5)}
          durationText={`${invitePopupSession.duration_minutes} min`}
          openText={openInvitationText}
          calendarText={addToCalendarText}
          onClose={() => setInvitePopupInviteId('')}
          onOpen={() => {
            setInvitePopupInviteId('')
            openSessionFromProfile(invitePopupSession.id)
          }}
          onCalendar={() => downloadSessionCalendar(invitePopupSession)}
        />
      )}

      {birthdayPopupOpen && (
        <BirthdayPopupModal
          closeText={text.close}
          title={text.birthdayPopupTitle}
          message={text.birthdayPopupMessage}
          buttonText={text.birthdayPopupButton}
          onClose={() => setBirthdayPopupOpen(false)}
          onAction={() => {
            setBirthdayPopupOpen(false)
            setActiveView('create')
          }}
        />
      )}

      {tariffPaymentOpen && (
        <TariffPaymentModal
          closeText={text.close}
          title={text.sessionTariffTitle}
          rates={[
            text.sessionTariffRateDay,
            text.sessionTariffRateEvening,
            text.sessionTariffRateWeekend,
          ]}
          arenaText={text.sessionTariffArena}
          discounts={[
            text.sessionTariffGroupSmall,
            text.sessionTariffGroupLarge,
            text.sessionTariffBirthdayOffer,
          ]}
          offerLimit={text.sessionOfferLimit}
          paymentText={text.sessionTariffPayment}
          loyaltyTitle={text.sessionTariffLoyaltyTitle}
          loyaltyText={text.sessionTariffLoyaltyText}
          zaloText={text.zaloContact}
          disclaimer={text.sessionTariffDisclaimer}
          onClose={() => setTariffPaymentOpen(false)}
        />
      )}

      {gameGuideOpen && (
        <GameGuideModal
          closeText={text.gameGuideClose}
          games={gameGuideGames}
          language={language}
          onClose={() => setGameGuideOpen(false)}
          staffGameGuides={staffGameGuides}
          text={looseText}
        />
      )}

      {selectedClub && canOpenClubPage(selectedClub) && (() => {
        const canManageSelectedClub = canManageClub(selectedClub)
        const canModerateSelectedClub = canModerateClubMembers(selectedClub)
        const canSeeSelectedClubData = canSeeClubPrivateData(selectedClub)
        const bannerUrl = clubBannerPreview || selectedClub.banner_url || ''
        const showInviteCode = selectedClub.visibility === 'private' && selectedClub.pin_code && canManageSelectedClub
        const canCreateSelectedClubSession = canManageSelectedClub || sessionClubOptions.some((club) => club.id === selectedClub.id)
        const noClubSessionsText = selectedClubSessionScope === 'past' ? text.noPastClubSessions : text.noUpcomingClubSessions
        const canUseSelectedClubMessages = canUseClubMessages(selectedClub)
        const selectedClubPublicMessages = messagesForClub(selectedClub, 'public')
        const selectedClubAdminMessages = messagesForClub(selectedClub, 'admin_private')
        const publicDraft = clubPublicMessageDrafts[selectedClub.id] || ''
        const adminDraft = clubAdminMessageDrafts[selectedClub.id] || ''
        const publicCharactersLeft = CLUB_MESSAGE_MAX_LENGTH - Array.from(publicDraft).length
        const adminCharactersLeft = CLUB_MESSAGE_MAX_LENGTH - Array.from(adminDraft).length

        return (
          <div className="club-drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="club-drawer-title" onClick={() => setSelectedClubId('')}>
            <div
              className="club-drawer club-page"
              onClick={(event) => event.stopPropagation()}
              onTouchStart={(event) => setDrawerTouchStart(event.touches[0]?.clientY ?? null)}
              onTouchEnd={(event) => {
                if (drawerTouchStart === null) return
                const endY = event.changedTouches[0]?.clientY ?? drawerTouchStart
                if (endY - drawerTouchStart > 70) {
                  setSelectedClubId('')
                }
                setDrawerTouchStart(null)
              }}
              style={clubThemeStyle(selectedClub)}
            >
              <div className="drawer-handle" />
              <div className={bannerUrl ? 'club-hero has-banner' : 'club-hero'}>
                {bannerUrl ? (
                  <NextImage src={bannerUrl} alt="" fill sizes="(max-width: 720px) 100vw, 720px" />
                ) : (
                  <div className="club-banner-empty">
                    <strong>{text.clubBanner}</strong>
                    {canManageSelectedClub && <span>{text.clubBannerHelp}</span>}
                  </div>
                )}
                <div className="club-hero-content">
                  <div>
                    <h2 id="club-drawer-title">{selectedClub.name}</h2>
                    {selectedClub.motto && <p className="club-motto">{selectedClub.motto}</p>}
                    <div className="row-meta">
                      <span className={selectedClub.visibility === 'private' ? 'pill private' : 'pill ok'}>
                        {selectedClub.visibility === 'private' ? text.private : text.public}
                      </span>
                      <span>{clubMemberCount(selectedClub)} {text.members}</span>
                      <span>{clubRoleLabel(clubRoleFor(selectedClub))}</span>
                    </div>
                  </div>
                  <button className="secondary small-button" type="button" onClick={() => setSelectedClubId('')}>
                    <ButtonIconText icon={<X aria-hidden="true" size={15} />}>{text.close}</ButtonIconText>
                  </button>
                </div>
              </div>

              {selectedClub.description && <p className="notes club-description">{selectedClub.description}</p>}

              <div className="club-action-row">
                {!selectedClubMembership && !canManageSelectedClub && (
                  <button
                    className={busyClubId === selectedClub.id ? 'primary loading create-button' : 'primary create-button'}
                    disabled={busyClubId === selectedClub.id}
                    onClick={() => joinClub(selectedClub)}
                    type="button"
                  >
                    {selectedClub.visibility === 'private' ? text.requestJoin : text.joinClub}
                  </button>
                )}

                {canCreateSelectedClubSession && (
                  <button
                    className="primary create-button"
                    type="button"
                    onClick={() => {
                      setSessionClubId(selectedClub.id)
                      setSessionVisibility('public')
                      setCreateStatus(text.clubOnlyCreateHint)
                      setActiveView('create')
                      setSelectedClubId('')
                    }}
                  >
                    {text.clubOnly}
                  </button>
                )}

                {selectedClubMembership?.status === 'approved' && selectedClub.owner_id !== userId && (
                  <button
                    className={busyClubId === selectedClub.id ? 'secondary loading create-button' : 'secondary create-button'}
                    disabled={busyClubId === selectedClub.id}
                    onClick={() => leaveClub(selectedClub, selectedClubMembership)}
                    type="button"
                  >
                    {leaveClubText}
                  </button>
                )}
              </div>

              {showInviteCode && (
                <div className="club-invite-box">
                  <span>{text.clubInviteCode}</span>
                  <strong>{selectedClub.pin_code}</strong>
                  <button className="secondary small-button" type="button" onClick={() => shareClubInvite(selectedClub)}>
                    <ButtonIconText icon={<Share aria-hidden="true" size={15} />}>{text.shareClubCode}</ButtonIconText>
                  </button>
                </div>
              )}

              {selectedClubMembership?.status === 'pending' && (
                <p className="notice">{text.requestSent}</p>
              )}

              <div className="sub-tabs club-page-tabs">
                <button className={selectedClubTab === 'hall' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('hall')}>
                  {text.clubHallOfFame}
                </button>
                <button className={selectedClubTab === 'members' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('members')}>
                  {text.clubMembers}
                </button>
                <button className={selectedClubTab === 'sessions' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('sessions')}>
                  {text.clubSessions}
                </button>
                <button className={selectedClubTab === 'messages' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('messages')}>
                  {text.clubMessages}
                </button>
                {canManageSelectedClub && (
                  <button className={selectedClubTab === 'settings' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('settings')}>
                    {text.clubSettings}
                  </button>
                )}
              </div>

              {selectedClubTab === 'hall' && (
                <div className="club-tab-panel club-hall-panel">
                  {!canSeeSelectedClubData ? (
                    <p className="notice">{text.hiddenMembers}</p>
                  ) : (
                    <>
                      {isLeaderboardLoading && leaderboardPlayerStats.length === 0 && <p className="notice" aria-busy="true">...</p>}
                      <LocalErrorBoundary fallback={<p className="notice">{text.noLeaderboardPlayers}</p>} resetKey={`club-hall-${selectedClub.id}-${language}-${leaderboardPlayerStats.length}`}>
                        <LeaderboardPanel
                          avatarStyleFor={(player: LeaderboardPlayer) => avatarStyle({
                            avatar_color: player.avatarColor,
                            avatar_text_color: player.avatarTextColor,
                          })}
                          canBypassPrivateClubPins={isAdmin}
                          canShareCurrentUserStats={canShareCurrentUserStats}
                          clubs={[selectedClub]}
                          currentUserRankPlayer={currentUserRankPlayer}
                          fixedClubId={selectedClub.id}
                          hasMorePlayers={hasMoreLeaderboardPlayers}
                          initialCriterion={clubRankingCriterion(selectedClub)}
                          isCurrentUserStatsShared={currentUserStatsShared}
                          isLoadingMorePlayers={isLoadingMoreLeaderboardPlayers}
                          onLeaderboardCriterionChange={handleLeaderboardCriterionChange}
                          onLeaderboardSearchChange={handleLeaderboardSearchChange}
                          onLoadMorePlayers={loadMoreLeaderboardPlayers}
                          onOpenPlayerProfile={openPlayerProfile}
                          onShareCurrentUserStats={() => shareCurrentUserStats(selectedClub.name)}
                          players={leaderboardPlayerStats}
                          renderAvatar={(player: LeaderboardPlayer) => avatarNode({
                            avatar_url: player.avatarUrl,
                            avatar_emoji: player.avatarEmoji,
                            avatar_initials: player.avatarInitials,
                            avatar_color: player.avatarColor,
                            avatar_text_color: player.avatarTextColor,
                            display_name: player.displayName,
                          }, 'P')}
                          serverFiltered
                          text={text}
                          useServerRanking
                          userId={userId}
                        />
                      </LocalErrorBoundary>
                      {selectedClubApprovedMembers.length === 0 && <p className="notice">{text.noTrophiesYet}</p>}
                    </>
                  )}
                </div>
              )}

              {selectedClubTab === 'members' && (
                <div className="club-tab-panel">
                  {!canSeeSelectedClubData ? (
                    <p className="notice">{text.hiddenMembers}</p>
                  ) : (
                    <>
                      {selectedClubApprovedMembers.length === 0 && <p className="notice">{text.noMembersYet}</p>}
                      <div className="club-member-list">
                        {selectedClubApprovedMembers.map((member) => {
                          const role = clubRoleFor(selectedClub, member.profile_id)
                          const roleOptions = manageableRoleOptions(selectedClub, member)
                          const canTransfer = (isAdmin || selectedClub.owner_id === userId) && member.profile_id !== selectedClub.owner_id

                          return (
                            <article className="club-member-row" key={member.id}>
                              <button aria-label={playerCardLabel(member.display_name, text.player)} className="player-avatar player-avatar-button" onClick={() => openPlayerProfile(member.profile_id)} style={avatarStyle(member)} type="button">
                                {avatarNode(member, 'P')}
                              </button>
                              <div className="club-member-main">
                                <strong>{compactDisplayName(member.display_name, text.player)}</strong>
                                <div className="row-meta">
                                  <span>{clubRoleLabel(role)}</span>
                                  {member.created_at && <span>{text.joinedOn}: {formatShortDate(localDateString(new Date(member.created_at)), language)}</span>}
                                </div>
                              </div>
                              {roleOptions.length > 0 && (
                                <select
                                  aria-label={text.assignRole}
                                  disabled={busyClubId === selectedClub.id}
                                  value={(member.role || 'member') as ClubMemberRole}
                                  onChange={(event) => updateClubMemberRole(selectedClub, member, event.target.value as ClubMemberRole)}
                                >
                                  {roleOptions.map((option) => (
                                    <option key={option} value={option}>{clubRoleLabel(option)}</option>
                                  ))}
                                </select>
                              )}
                              {canTransfer && (
                                <button className="secondary small-button" disabled={busyClubId === selectedClub.id} type="button" onClick={() => transferClubOwnership(selectedClub, member)}>
                                  <ButtonIconText icon={<Crown aria-hidden="true" size={15} />}>{text.transferOwnership}</ButtonIconText>
                                </button>
                              )}
                              {canManageClubMember(selectedClub, member) && (
                                <button className="danger small-button" disabled={busyClubId === selectedClub.id} type="button" onClick={() => removeClubMember(selectedClub, member)}>
                                  <ButtonIconText icon={<UserMinus aria-hidden="true" size={15} />}>{text.remove}</ButtonIconText>
                                </button>
                              )}
                            </article>
                          )
                        })}
                      </div>

                      {canModerateSelectedClub && selectedClubPendingMembers.length > 0 && (
                        <div className="pending-list">
                          <h3>{text.pending}</h3>
                          {selectedClubPendingMembers.map((member) => (
                            <div className="pending-member" key={member.id}>
                              <span>{compactDisplayName(member.display_name, text.player)}</span>
                              <div className="mini-session-actions">
                                <button className="secondary small-button" disabled={busyClubId === selectedClub.id} onClick={() => approveClubMember(member)} type="button">
                                  <ButtonIconText icon={<UserCheck aria-hidden="true" size={15} />}>{text.approve}</ButtonIconText>
                                </button>
                                {canManageClubMember(selectedClub, member) && (
                                  <button className="danger small-button" disabled={busyClubId === selectedClub.id} onClick={() => removeClubMember(selectedClub, member)} type="button">
                                    <ButtonIconText icon={<UserMinus aria-hidden="true" size={15} />}>{text.remove}</ButtonIconText>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {selectedClubTab === 'sessions' && (
                <div className="club-tab-panel">
                  <div className="section-head compact-head">
                    <div>
                      <h3>{text.clubSessions}</h3>
                      <p className="muted">{text.clubMembersOnly}</p>
                    </div>
                    <div className="segmented compact-segmented">
                      <button className={selectedClubSessionScope === 'upcoming' ? 'active' : ''} type="button" onClick={() => handleClubSessionScopeChange('upcoming')}>
                        {text.upcoming}
                      </button>
                      <button className={selectedClubSessionScope === 'past' ? 'active' : ''} type="button" onClick={() => handleClubSessionScopeChange('past')}>
                        {text.past}
                      </button>
                    </div>
                  </div>

                  {selectedClubDayOptions.length > 0 && (
                    <div className="day-strip drawer-days">
                      <button
                        className={!selectedClubDate ? 'day-chip active' : 'day-chip'}
                        type="button"
                        onClick={() => setSelectedClubDate('')}
                      >
                        <strong>{text.allDays}</strong>
                      </button>
                      {selectedClubDayOptions.map((day) => (
                        <button
                          className={selectedClubDate === day.value ? 'day-chip active' : 'day-chip'}
                          key={day.value}
                          type="button"
                          onClick={() => setSelectedClubDate(day.value)}
                        >
                          <span>{day.weekday}</span>
                          <strong>{day.day}</strong>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredSelectedClubSessions.length === 0 ? (
                    <p className="notice">{isLoadingPastSessions && selectedClubSessionScope === 'past' ? '...' : noClubSessionsText}</p>
                  ) : (
                    <div className="mini-session-list">
                      {filteredSelectedClubSessions.map((session) => {
                        const coverGame = sessionCoverGame(session)
                        const remaining = seatsLeft(session)
                        const isPast = isPastSession(session)

                        return (
                          <article
                            className="club-session-preview"
                            key={session.id}
                            onClick={() => {
                              setSelectedClubId('')
                              openSessionFromProfile(session.id)
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setSelectedClubId('')
                                openSessionFromProfile(session.id)
                              }
                            }}
                          >
                            <div className="compact-session-card club-session-card">
                              <NextImage className="compact-session-image" src={coverGame.image} alt="" width={116} height={116} />
                              <div className="compact-session-main">
                                <div className="compact-session-title-row">
                                  <h3>{session.name}</h3>
                                  <span className={session.session_type === 'tournament' ? 'pill private' : 'pill ok'}>
                                    {session.session_type === 'tournament' ? text.tournament : text.normalGame}
                                  </span>
                                  <span className="pill">{text.clubSession}</span>
                                </div>
                                <div className="row-meta compact-meta">
                                  <span>{formatShortDate(session.date, language)}</span>
                                  <span>{session.start_time.slice(0, 5)}</span>
                                  <span>{session.duration_minutes} min</span>
                                  {renderGameGuideTrigger(coverGame.id, 'compact-game-guide-link')}
                                  {!isPast && <span>{remaining} {text.seatsLeft}</span>}
                                  {isPast && <span>{text.finalGame}: {coverGame.title}</span>}
                                </div>
                              </div>
                              <div className="compact-session-actions club-session-actions">
                                <button
                                  className="secondary compact-expand"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedClubId('')
                                    openSessionFromProfile(session.id)
                                  }}
                                >
                                  <ButtonIconText icon={<ChevronDown aria-hidden="true" size={15} />}>{text.expandDetails}</ButtonIconText>
                                </button>
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}

                  {selectedClubSessionScope === 'upcoming' && hasMoreUpcomingSessions && (
                    <button className="secondary create-button" type="button" onClick={loadMoreUpcomingSessions} disabled={isLoadingMoreSessions}>
                      {isLoadingMoreSessions ? '...' : text.expandDetails}
                    </button>
                  )}
                </div>
              )}

              {selectedClubTab === 'messages' && (
                <div className="club-tab-panel club-messages-panel">
                  {!canUseSelectedClubMessages ? (
                    <p className="notice">{text.clubMessageLoginRequired}</p>
                  ) : (
                    <>
                      <div className="section-head compact-head">
                        <div>
                          <h3>{text.clubMessages}</h3>
                          <p className="muted">{text.clubMessagesHint}</p>
                        </div>
                        {isLoadingClubMessages && <span className="pill">{text.clubMessagesLoading}</span>}
                      </div>
                      {clubMessageStatus && <p className="notice">{clubMessageStatus}</p>}
                      <div className="club-message-channels">
                        <section className="club-message-channel">
                          <div className="message-channel-head">
                            <strong>{text.clubPublicMessages}</strong>
                            <small>{text.clubMessageLimit}</small>
                          </div>
                          <div className="message-compose club-message-compose">
                            <textarea
                              maxLength={CLUB_MESSAGE_MAX_LENGTH}
                              rows={2}
                              value={publicDraft}
                              onChange={(event) => setClubPublicMessageDrafts((current) => ({ ...current, [selectedClub.id]: event.target.value }))}
                              placeholder={text.clubPublicPlaceholder}
                            />
                            <button
                              className="secondary small-button"
                              disabled={busyMessageKey === `${selectedClub.id}-public`}
                              type="button"
                              onClick={() => postClubMessage(selectedClub, 'public')}
                            >
                              {text.sendMessage}
                            </button>
                          </div>
                          <small className={publicCharactersLeft < 0 ? 'character-count over-limit' : 'character-count'}>
                            {publicCharactersLeft}
                          </small>
                          {selectedClubPublicMessages.length === 0 ? (
                            <p className="notice">{text.noClubMessages}</p>
                          ) : (
                            <div className="message-list club-message-list">
                              {selectedClubPublicMessages.map((message) => {
                                const isOwnMessage = message.author_id === userId
                                const messageClassName = [
                                  'session-message',
                                  'club-message',
                                  isOwnMessage ? 'own-message' : '',
                                ].filter(Boolean).join(' ')
                                const translationKey = messageTranslationKey('club', message.id, language)

                                return (
                                  <div className={messageClassName} key={message.id}>
                                    <span className="player-avatar tiny-avatar message-avatar" style={avatarStyle({
                                      avatar_color: message.author_avatar_color,
                                      avatar_text_color: message.author_avatar_text_color,
                                    })}>
                                      {avatarNode({
                                        avatar_url: message.author_avatar_url,
                                        avatar_emoji: message.author_avatar_emoji,
                                        avatar_initials: message.author_avatar_initials,
                                        display_name: message.author_display_name,
                                      }, 'P')}
                                    </span>
                                    <div className="message-body">
                                      <div className="message-meta-row">
                                        <strong>{compactDisplayName(message.author_display_name, text.player)}</strong>
                                      </div>
                                      <MessageBodyText
                                        body={message.body}
                                        messageId={message.id}
                                        messageKind="club"
                                        onRequestTranslation={requestMessageTranslation}
                                        onToggleOriginal={() => toggleMessageOriginal('club', message.id, language)}
                                        targetLanguage={language}
                                        text={text}
                                        translation={messageTranslations[translationKey]}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </section>

                        <section className="club-message-channel">
                          <div className="message-channel-head">
                            <strong>{text.clubAdminMessages}</strong>
                            <small>{text.clubMessagesPrivateHint}</small>
                          </div>
                          <div className="message-compose club-message-compose">
                            <textarea
                              maxLength={CLUB_MESSAGE_MAX_LENGTH}
                              rows={2}
                              value={adminDraft}
                              onChange={(event) => setClubAdminMessageDrafts((current) => ({ ...current, [selectedClub.id]: event.target.value }))}
                              placeholder={text.clubAdminPlaceholder}
                            />
                            <button
                              className="secondary small-button"
                              disabled={busyMessageKey === `${selectedClub.id}-admin_private`}
                              type="button"
                              onClick={() => postClubMessage(selectedClub, 'admin_private')}
                            >
                              {text.sendMessage}
                            </button>
                          </div>
                          <small className={adminCharactersLeft < 0 ? 'character-count over-limit' : 'character-count'}>
                            {adminCharactersLeft}
                          </small>
                          {selectedClubAdminMessages.length === 0 ? (
                            <p className="notice">{text.noClubAdminMessages}</p>
                          ) : (
                            <div className="message-list club-message-list">
                              {selectedClubAdminMessages.map((message) => {
                                const isOwnMessage = message.author_id === userId
                                const messageClassName = [
                                  'session-message',
                                  'club-message',
                                  'admin-private',
                                  isOwnMessage ? 'own-message' : '',
                                ].filter(Boolean).join(' ')
                                const translationKey = messageTranslationKey('club', message.id, language)

                                return (
                                  <div className={messageClassName} key={message.id}>
                                    <span className="player-avatar tiny-avatar message-avatar" style={avatarStyle({
                                      avatar_color: message.author_avatar_color,
                                      avatar_text_color: message.author_avatar_text_color,
                                    })}>
                                      {avatarNode({
                                        avatar_url: message.author_avatar_url,
                                        avatar_emoji: message.author_avatar_emoji,
                                        avatar_initials: message.author_avatar_initials,
                                        display_name: message.author_display_name,
                                      }, 'P')}
                                    </span>
                                    <div className="message-body">
                                      <div className="message-meta-row">
                                        <strong>{compactDisplayName(message.author_display_name, text.player)}</strong>
                                        <small className="moderation-badge pending">{text.private}</small>
                                      </div>
                                      <MessageBodyText
                                        body={message.body}
                                        messageId={message.id}
                                        messageKind="club"
                                        onRequestTranslation={requestMessageTranslation}
                                        onToggleOriginal={() => toggleMessageOriginal('club', message.id, language)}
                                        targetLanguage={language}
                                        text={text}
                                        translation={messageTranslations[translationKey]}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </section>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedClubTab === 'settings' && canManageSelectedClub && (
                <div className="club-tab-panel club-settings-panel">
                  <div className="form-grid club-settings-grid">
                    <div>
                      <label>{text.clubName} <span className="required">*</span></label>
                      <input value={clubEditName} onChange={(event) => setClubEditName(event.target.value)} />
                    </div>
                    <div>
                      <label>{text.clubMotto}</label>
                      <input maxLength={48} value={clubEditMotto} onChange={(event) => setClubEditMotto(event.target.value)} placeholder={text.clubMottoPlaceholder} />
                    </div>
                    <div className="full">
                      <label>{text.clubDescription}</label>
                      <textarea value={clubEditDescription} onChange={(event) => setClubEditDescription(event.target.value)} placeholder={text.clubDescriptionPlaceholder} />
                    </div>
                    <div>
                      <label>{text.clubPrivacy}</label>
                      <div className="segmented visibility-toggle">
                        <button className={clubEditVisibility === 'public' ? 'active' : ''} onClick={() => setClubEditVisibility('public')} type="button">
                          {text.public}
                        </button>
                        <button className={clubEditVisibility === 'private' ? 'active' : ''} onClick={() => setClubEditVisibility('private')} type="button">
                          {text.private}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label>{text.clubDefaultLanguage}</label>
                      <select value={clubEditDefaultLanguage} onChange={(event) => setClubEditDefaultLanguage(event.target.value as LanguageCode)}>
                        {languageOptions.map((option) => (
                          <option key={option} value={option}>{option.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>{text.rankBy}</label>
                      <select value={clubEditRankingCriterion} onChange={(event) => setClubEditRankingCriterion(event.target.value as LeaderboardCriterion)}>
                        {clubRankingCriteria.map((criterion) => (
                          <option key={criterion.value} value={criterion.value}>
                            {criterion.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="full club-banner-field">
                      <label>{text.clubBanner}</label>
                      <label className="club-banner-upload">
                        {bannerUrl ? <NextImage src={bannerUrl} alt="" width={1600} height={600} /> : <span>{text.clubBannerHelp}</span>}
                        <input accept="image/jpeg,image/png,image/webp" type="file" onChange={handleClubBannerChange} />
                      </label>
                      <p className="field-help">{text.clubBannerHelp}</p>
                    </div>
                    <div className="full">
                      <label>{text.clubThemeColor}</label>
                      <div className="color-row" aria-label={text.clubThemeColor}>
                        {clubThemeColors.map((color) => (
                          <button
                            aria-label={color}
                            className={clubEditThemeColor === color ? 'active' : ''}
                            key={color}
                            onClick={() => updateClubThemeColor(color)}
                            style={{ background: color }}
                            type="button"
                          />
                        ))}
                      </div>
                      <div className="custom-color-row">
                        <label>
                          <span>{text.customColor}</span>
                          <input type="color" value={clubEditThemeColor} onChange={(event) => updateClubThemeColor(event.target.value)} />
                        </label>
                        <label className="hex-field">
                          <span>{text.hexColor}</span>
                          <input
                            value={clubEditThemeColorDraft}
                            onBlur={() => setClubEditThemeColorDraft(clubEditThemeColor)}
                            onChange={(event) => updateClubThemeColorDraft(event.target.value)}
                            placeholder="#3059ff"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="club-action-row">
                    <button className={isSavingClub ? 'primary loading create-button' : 'primary create-button'} disabled={isSavingClub || busyClubId === selectedClub.id} type="button" onClick={() => saveClubSettings(selectedClub)}>
                      <ButtonIconText icon={<Save aria-hidden="true" size={17} />}>{isSavingClub ? text.saving : text.saveClub}</ButtonIconText>
                    </button>
                    <button className="secondary create-button" disabled={busyClubId === selectedClub.id} type="button" onClick={() => regenerateClubInviteCode(selectedClub)}>
                      <ButtonIconText icon={<RefreshCw aria-hidden="true" size={17} />}>{text.regenerateInviteCode}</ButtonIconText>
                    </button>
                    {selectedClub.pin_code && (
                      <button className="secondary create-button" type="button" onClick={() => shareClubInvite(selectedClub)}>
                        <ButtonIconText icon={<Share aria-hidden="true" size={17} />}>{text.shareClubCode}</ButtonIconText>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {selectedPlayerProfile && (
        <PlayerProfileModal
          closeText={text.close}
          playerTitle={compactDisplayName(selectedPlayerProfile.displayName, text.player)}
          avatar={
            <div
              className={crownedTopPlayer?.profileId === selectedPlayerProfile.profileId ? 'player-avatar profile-large champion-avatar' : 'player-avatar profile-large'}
              style={avatarStyle({ avatar_color: selectedPlayerProfile.avatarColor, avatar_text_color: selectedPlayerProfile.avatarTextColor })}
            >
              {avatarNode({
                avatar_url: selectedPlayerProfile.avatarUrl,
                avatar_emoji: selectedPlayerProfile.avatarEmoji,
                avatar_initials: selectedPlayerProfile.avatarInitials,
                avatar_color: selectedPlayerProfile.avatarColor,
                avatar_text_color: selectedPlayerProfile.avatarTextColor,
                display_name: selectedPlayerProfile.displayName,
              }, 'P')}
              {crownedTopPlayer?.profileId === selectedPlayerProfile.profileId && <span className="champion-badge">👑</span>}
            </div>
          }
          motto={selectedPlayerProfile.profileMotto}
          isTopPlayer={crownedTopPlayer?.profileId === selectedPlayerProfile.profileId}
          bestOverallText={text.bestOverall}
          canFollow={networkTablesReady && selectedPlayerProfile.profileId !== userId}
          followBusy={busyFriendId === selectedPlayerProfile.profileId}
          followText={isFollowing(selectedPlayerProfile.profileId) ? text.following : text.addFriend}
          onFollow={() => toggleFollowPlayer(selectedPlayerProfile)}
          onClose={closePlayerProfile}
          stats={playerProfileStats}
          scoreSummary={null}
          challengeControls={renderChallengeControls(selectedPlayerProfile)}
          bestScoresTitle={text.bestScores}
          bestScores={selectedPlayerProfile.bestByGame}
          adminControls={selectedPlayerManageContext && !selectedPlayerSessionContext && isAdmin ? (
            <div className="score-controls profile-score-controls">
              <input
                aria-label={text.score}
                defaultValue={selectedPlayerManageContext.participant.score ?? ''}
                inputMode="numeric"
                onBlur={(event) => updateParticipantResult(selectedPlayerManageContext.participant.id, event.target.value, selectedPlayerManageContext.participant.placement ?? '', selectedPlayerManageContext.participant.accuracy_percent ?? '', selectedPlayerManageContext.participant.projectiles_fired ?? '')}
                placeholder={text.score}
              />
              <input
                aria-label={text.accuracy}
                defaultValue={selectedPlayerManageContext.participant.accuracy_percent ?? ''}
                inputMode="numeric"
                onBlur={(event) => updateParticipantResult(selectedPlayerManageContext.participant.id, selectedPlayerManageContext.participant.score ?? '', selectedPlayerManageContext.participant.placement ?? '', event.target.value, selectedPlayerManageContext.participant.projectiles_fired ?? '')}
                placeholder="%"
              />
              <input
                aria-label={text.projectiles}
                defaultValue={selectedPlayerManageContext.participant.projectiles_fired ?? ''}
                inputMode="numeric"
                onBlur={(event) => updateParticipantResult(selectedPlayerManageContext.participant.id, selectedPlayerManageContext.participant.score ?? '', selectedPlayerManageContext.participant.placement ?? '', selectedPlayerManageContext.participant.accuracy_percent ?? '', event.target.value)}
                placeholder={text.projectiles}
              />
              {isEscapeSession(selectedPlayerManageContext.session) && (
                <input
                  aria-label={text.escapeSessionTime}
                  defaultValue={selectedPlayerManageContext.participant.escape_duration_seconds ? formatSpeedrunDuration(selectedPlayerManageContext.participant.escape_duration_seconds) : ''}
                  inputMode="text"
                  onBlur={(event) => updateParticipantResult(
                    selectedPlayerManageContext.participant.id,
                    selectedPlayerManageContext.participant.score ?? '',
                    selectedPlayerManageContext.participant.placement ?? '',
                    selectedPlayerManageContext.participant.accuracy_percent ?? '',
                    selectedPlayerManageContext.participant.projectiles_fired ?? '',
                    event.target.value
                  )}
                  placeholder={text.escapeDurationPlaceholder}
                />
              )}
              <select
                aria-label={text.place}
                value={selectedPlayerManageContext.participant.placement ?? ''}
                onChange={(event) => updateParticipantResult(selectedPlayerManageContext.participant.id, selectedPlayerManageContext.participant.score ?? '', event.target.value, selectedPlayerManageContext.participant.accuracy_percent ?? '', selectedPlayerManageContext.participant.projectiles_fired ?? '')}
              >
                <option value="">{text.noPlace}</option>
                <option value="1">{text.firstPlace}</option>
                <option value="2">{text.secondPlace}</option>
                <option value="3">{text.thirdPlace}</option>
              </select>
            </div>
          ) : null}
        />
      )}

      {championLoginOpen && (
        <ChampionLoginModal
          closeText={text.close}
          title={text.bestOverall}
          message={text.bestPlayerLogin}
          onClose={() => setChampionLoginOpen(false)}
        />
      )}

      {checkInParticipant && (
        <CheckInModal
          closeText={text.close}
          title={text.checkIn}
          playerName={compactDisplayName(checkInParticipant.display_name, text.player)}
          paymentSplits={checkInPaymentSplits}
          paymentSummary={`${text.paidTotal}: ${formatTicketFormulaPrice(checkInPaymentTotal)}`}
          cashText={text.cash}
          bankTransferText={text.bankTransfer}
          freeText={text.free}
          amountText={text.paymentAmount}
          addSplitText={text.addPaymentSplit}
          removeText={text.remove}
          saveText={text.saveChanges}
          clearText={text.clearCheckIn}
          checkedIn={Boolean(checkInParticipant.checked_in)}
          onClose={() => setCheckInTarget(null)}
          onPaymentSplitMethodChange={(splitId, value) => updateCheckInPaymentSplit(splitId, { payment_method: value })}
          onPaymentSplitAmountChange={(splitId, value) => updateCheckInPaymentSplit(splitId, { amount: value })}
          onAddPaymentSplit={addCheckInPaymentSplit}
          onRemovePaymentSplit={removeCheckInPaymentSplit}
          onSaveFree={() => updateParticipantCheckIn(checkInParticipant.id, null, true)}
          onSavePaid={() => updateParticipantCheckIn(checkInParticipant.id, normalizedCheckInPaymentSplits)}
          onClear={() => updateParticipantCheckIn(checkInParticipant.id, null)}
        />
      )}
    </>
  )

  if (embedded) {
    return (
      <>
        {appMain}
        {appOverlays}
      </>
    )
  }

  return (
    <div className="app">
      {appAside}
      {appMain}
      {appOverlays}
    </div>
  )
}
