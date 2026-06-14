'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase/client'
import { getInitialLanguage, languageOptions, storeLanguage, type LanguageCode, uiText } from '../lib/i18n'

const ARENA_COUNT = 2
const OPEN_MINUTES = 9 * 60
const CLOSE_MINUTES = 22 * 60
const TIME_STEP_MINUTES = 20
const ADMIN_EMAILS = ['emile@vre-vietnam.com']
const DEFAULT_APP_URL = 'https://vrena-booking.vercel.app'
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || 'a4be4d0e-2570-4642-a1a6-a44c02fa0d46'
const PRIVACY_POLICY_URL = 'https://www.vre-vietnam.com'
const MAX_DISPLAY_NAME_LENGTH = 10

type HCaptchaApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    }
  ) => string
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

type Profile = {
  id: string
  phone: string
  full_name: string | null
  nickname: string | null
  email: string | null
  birthday?: string | null
  avatar_url: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
  avatar_color?: string | null
  avatar_text_color?: string | null
  profile_motto?: string | null
  role?: 'player' | 'admin'
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
  score?: number | null
  accuracy_percent?: number | null
  projectiles_fired?: number | null
  placement?: number | null
  prize_claimed?: boolean | null
  prize_claimed_at?: string | null
}

type TournamentFormat = 'pool_only' | 'pool_to_semifinal' | 'pool_to_final' | 'single_elimination' | 'double_elimination' | 'leaderboard'
type QualificationRule = 'top_1' | 'top_2' | 'top_4' | 'custom'
type MatchStage = 'pool' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final' | 'third_place' | 'leaderboard' | 'custom'
type MatchStatus = 'waiting' | 'next' | 'live' | 'completed' | 'pending'

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
  session_participants?: Participant[]
}

type BlockedTime = {
  date: string
  start_time: string
  end_time: string
  arenas_used: number
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
}

type Club = {
  id: string
  owner_id: string
  name: string
  description: string | null
  visibility: 'public' | 'private'
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

const games: Array<{
  id: GameId
  title: string
  category: 'FPS / PVP' | 'Escape'
  image: string
}> = [
  { id: 'laser-tag', title: 'Laser Tag', category: 'FPS / PVP', image: '/games/laser-tag.png' },
  { id: 'mini-block-towers', title: 'Mini Block Towers', category: 'FPS / PVP', image: '/games/mini-block-towers.png' },
  { id: 'office-war', title: 'Office War', category: 'FPS / PVP', image: '/games/office-war.png' },
  { id: 'paintball', title: 'Paintball', category: 'FPS / PVP', image: '/games/paintball.png' },
  { id: 'snow-battle', title: 'Snow Battle', category: 'FPS / PVP', image: '/games/snow-battle.png' },
  { id: 'castle-unspunnen', title: 'Castle Unspunnen', category: 'FPS / PVP', image: '/games/castle-unspunnen.png' },
  { id: 'wild-west', title: 'Wild West', category: 'FPS / PVP', image: '/games/wild-west.png' },
  { id: 'arc-of-the-covenant', title: 'The Secret of the Arc', category: 'Escape', image: '/games/arc-of-the-covenant.png' },
  { id: 'joller-house', title: 'Joller House', category: 'Escape', image: '/games/joller-house.png' },
]

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
  return compactDisplayName(profile.nickname || profile.full_name || profile.phone)
}

function limitDisplayName(value: string) {
  return Array.from(value).slice(0, MAX_DISPLAY_NAME_LENGTH).join('')
}

function compactDisplayName(value: string | null | undefined, fallback = 'Player') {
  const cleaned = (value || fallback).trim() || fallback
  return limitDisplayName(cleaned)
}

function compactInitials(value: string) {
  return Array.from(value.trim()).slice(0, 2).join('').toUpperCase()
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
  const date = new Date(`${dateValue}T12:00:00`)
  const day = String(date.getDate()).padStart(2, '0')
  const month = monthAbbreviations[date.getMonth()]
  return `${day} ${month}`
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

function RichNotesEditor({
  value,
  onChange,
  placeholder,
  resetKey,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  resetKey: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value ? formatNotesHtml(value) : ''
    }
  }, [resetKey])

  return (
    <div
      className="rich-note-editor"
      contentEditable
      data-placeholder={placeholder}
      onInput={(event) => onChange(event.currentTarget.innerHTML)}
      ref={editorRef}
      role="textbox"
      suppressContentEditableWarning
    />
  )
}

function ShortDateInput({
  value,
  onChange,
  language,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  language: LanguageCode
  placeholder: string
  ariaLabel: string
}) {
  const displayValue = value ? formatShortDate(value, language) : placeholder
  return (
    <div className="date-input-shell">
      <input
        aria-label={ariaLabel}
        className="date-input-native"
        type="date"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span className={value ? 'date-input-display' : 'date-input-display placeholder'}>
        {displayValue}
      </span>
    </div>
  )
}

function appRedirectUrl() {
  if (typeof window === 'undefined') return DEFAULT_APP_URL

  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return DEFAULT_APP_URL
  }

  return window.location.origin
}

function getHCaptcha() {
  if (typeof window === 'undefined') return undefined

  return (window as unknown as { hcaptcha?: HCaptchaApi }).hcaptcha
}

export default function WidgetPage() {
  const [activeView, setActiveView] = useState<'sessions' | 'create' | 'clubs' | 'profile'>('sessions')
  const [sessions, setSessions] = useState<Session[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
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
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedSessionDate, setSelectedSessionDate] = useState('')
  const [clubSearch, setClubSearch] = useState('')
  const [isClubSearchOpen, setIsClubSearchOpen] = useState(false)
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({})

  const [authMode, setAuthMode] = useState<'login' | 'create'>('login')
  const [profileCountryCode, setProfileCountryCode] = useState('+84')
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileMotto, setProfileMotto] = useState('')
  const [profileNickname, setProfileNickname] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileBirthday, setProfileBirthday] = useState('')
  const [personalDataConsent, setPersonalDataConsent] = useState(false)
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
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
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
  const [tournamentPoolSize, setTournamentPoolSize] = useState(4)
  const [tournamentEditorEmail, setTournamentEditorEmail] = useState('')
  const [tournamentEditorResults, setTournamentEditorResults] = useState<Profile[]>([])
  const [busyTournamentId, setBusyTournamentId] = useState('')
  const [drawerTouchStart, setDrawerTouchStart] = useState<number | null>(null)
  const [checkInTarget, setCheckInTarget] = useState<{ sessionId: string; participantId: string } | null>(null)
  const [checkInPaymentStatus, setCheckInPaymentStatus] = useState<'cash' | 'bank_transfer' | 'free' | ''>('')
  const [checkInPaymentAmount, setCheckInPaymentAmount] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [selectedPlayerSessionId, setSelectedPlayerSessionId] = useState('')
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [sessionTimeScope, setSessionTimeScope] = useState<'upcoming' | 'past'>('upcoming')
  const [confirmedGameDrafts, setConfirmedGameDrafts] = useState<Record<string, string>>({})
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [championLoginOpen, setChampionLoginOpen] = useState(false)
  const [language, setLanguage] = useState<LanguageCode>('en')
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const dayStripRef = useRef<HTMLDivElement | null>(null)
  const clubSearchShellRef = useRef<HTMLDivElement | null>(null)
  const captchaContainerRef = useRef<HTMLDivElement | null>(null)
  const captchaWidgetId = useRef<string | null>(null)
  const text = uiText[language]
  const looseText = text as Record<string, string>
  const leaveClubText = looseText.leaveClub || 'Leave Club'
  const leaveClubConfirmText = looseText.leaveClubConfirm || 'Leave this club?'
  const leftClubText = looseText.leftClub || text.memberRemoved
  const showProfileFields = Boolean(profile || authMode === 'create')

  function openPlayerProfile(profileId: string, sessionId = '') {
    setSelectedPlayerId(profileId)
    setSelectedPlayerSessionId(sessionId)
  }

  function closePlayerProfile() {
    setSelectedPlayerId('')
    setSelectedPlayerSessionId('')
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
  } | null | undefined, fallback = 'P') {
    const label = compactDisplayName(source?.display_name || source?.nickname || source?.full_name, fallback)

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
          <img
            src={source.avatar_url}
            alt=""
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
    if (source?.avatar_initials) return <span className="avatar-text">{compactInitials(source.avatar_initials)}</span>
    return <span className="avatar-text">{compactInitials(label || fallback).slice(0, 1)}</span>
  }

  function avatarStyle(source: { avatar_color?: string | null; avatar_text_color?: string | null } | null | undefined) {
    if (!source?.avatar_color && !source?.avatar_text_color) return undefined

    return {
      ...(source.avatar_color ? { background: source.avatar_color } : {}),
      ...(source.avatar_text_color ? { color: source.avatar_text_color } : {}),
    }
  }

  function avatarFields(source: Profile) {
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
      }))
    )

    setClubs((currentClubs) =>
      currentClubs.map((club) => ({
        ...club,
        club_members: club.club_members?.map((member) =>
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
  }

  async function copyInviteCode(sessionId: string, inviteCode: string | null) {
    if (!inviteCode) return

    await navigator.clipboard?.writeText(inviteCode)
    setCopiedInviteId(sessionId)
    window.setTimeout(() => setCopiedInviteId((current) => (current === sessionId ? '' : current)), 1400)
  }

  function goToLogin() {
    setAuthMode('login')
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

  function openSessionFromProfile(sessionId: string) {
    setSearch('')
    setActiveView('sessions')
    window.setTimeout(() => {
      document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function resetCaptcha() {
    setCaptchaToken('')

    const hcaptcha = getHCaptcha()

    if (hcaptcha && captchaWidgetId.current) {
      hcaptcha.reset(captchaWidgetId.current)
    }
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

  async function loadProfile() {
    try {
      authDebug('loadProfile:start')
      const { data: userData, error: userError } = await supabase.auth.getUser()
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
        setProfile(null)
        setProfileStatus(userError.message)
        return
      }

      if (!authUser) {
        setUserId('')
        setProfile(null)
        return
      }

      setUserId(authUser.id)

      const { data: profileRow, error: profileError, status: profileStatusCode } = await supabase
        .from('profiles')
        .select('id, phone, full_name, nickname, email, birthday, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role')
        .eq('id', authUser.id)
        .maybeSingle()

      authDebug('loadProfile:profileQuery', {
        status: profileStatusCode,
        error: profileError,
        profile: profileRow,
        role: profileRow?.role,
        isAdminEmail: Boolean(authUser.email && ADMIN_EMAILS.includes(authUser.email.toLowerCase())),
      })

      if (profileError) {
        setProfileStatus(profileError.message)
        return
      }

      if (profileRow) {
        const phoneParts = splitPhoneNumber(profileRow.phone || '')
        setProfile(profileRow)
        setProfileCountryCode(phoneParts.countryInput)
        setProfilePhone(phoneParts.localPhone)
        setProfileName(profileRow.full_name || '')
        setProfileMotto(limitMotto(profileRow.profile_motto || ''))
        setProfileNickname(limitDisplayName(profileRow.nickname || ''))
        setProfileEmail(profileRow.email || '')
        setProfileBirthday(profileRow.birthday || '')
        setAvatarMode(profileRow.avatar_url ? 'photo' : profileRow.avatar_emoji ? 'emoji' : profileRow.avatar_initials ? 'initials' : 'photo')
        setAvatarEmoji(profileRow.avatar_emoji || '😎')
        setAvatarInitials(profileRow.avatar_initials || '')
        setAvatarColor(profileRow.avatar_color || avatarColors[0])
        setAvatarColorDraft(profileRow.avatar_color || avatarColors[0])
        setAvatarTextColor(profileRow.avatar_text_color || avatarTextColors[0])
        setAvatarTextColorDraft(profileRow.avatar_text_color || avatarTextColors[0])
        return
      }

      const email = authUser.email?.toLowerCase() || ''
      const fullName = typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : ''
      const nickname = typeof authUser.user_metadata?.nickname === 'string' ? limitDisplayName(authUser.user_metadata.nickname) : ''
      const profileMottoValue = typeof authUser.user_metadata?.profile_motto === 'string' ? limitMotto(authUser.user_metadata.profile_motto) : ''
      const birthdayValue = typeof authUser.user_metadata?.birthday === 'string' ? authUser.user_metadata.birthday : ''
      const phone = typeof authUser.user_metadata?.phone === 'string' ? authUser.user_metadata.phone : ''
      const fallbackProfile: Profile = {
        id: authUser.id,
        phone,
        full_name: fullName || null,
        nickname: nickname || null,
        email,
        birthday: birthdayValue || null,
        avatar_url: typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url : null,
        avatar_emoji: typeof authUser.user_metadata?.avatar_emoji === 'string' ? authUser.user_metadata.avatar_emoji : null,
        avatar_initials: typeof authUser.user_metadata?.avatar_initials === 'string' ? authUser.user_metadata.avatar_initials : null,
        avatar_color: typeof authUser.user_metadata?.avatar_color === 'string' ? authUser.user_metadata.avatar_color : null,
        avatar_text_color: typeof authUser.user_metadata?.avatar_text_color === 'string' ? authUser.user_metadata.avatar_text_color : null,
        profile_motto: profileMottoValue || null,
        role: ADMIN_EMAILS.includes(email) ? 'admin' : 'player',
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
      setAvatarMode(fallbackProfile.avatar_url ? 'photo' : fallbackProfile.avatar_emoji ? 'emoji' : fallbackProfile.avatar_initials ? 'initials' : 'photo')
      setAvatarEmoji(fallbackProfile.avatar_emoji || '😎')
      setAvatarInitials(fallbackProfile.avatar_initials || '')
      setAvatarColor(fallbackProfile.avatar_color || avatarColors[0])
      setAvatarColorDraft(fallbackProfile.avatar_color || avatarColors[0])
      setAvatarTextColor(fallbackProfile.avatar_text_color || avatarTextColors[0])
      setAvatarTextColorDraft(fallbackProfile.avatar_text_color || avatarTextColors[0])

      const repairResult = await supabase.from('profiles').upsert({
        id: authUser.id,
        phone: phone || '+84000000000',
        full_name: fullName || null,
        nickname: nickname || null,
        email,
        birthday: fallbackProfile.birthday,
        avatar_url: fallbackProfile.avatar_url,
        avatar_emoji: fallbackProfile.avatar_emoji,
        avatar_initials: fallbackProfile.avatar_initials,
        avatar_color: fallbackProfile.avatar_color,
        avatar_text_color: fallbackProfile.avatar_text_color,
        profile_motto: fallbackProfile.profile_motto,
        updated_at: new Date().toISOString(),
      })

      authDebug('loadProfile:profileRepairUpsert', repairResult)
    } catch (error) {
      authDebug('loadProfile:thrown', error)
      setProfileStatus(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleAuth() {
    try {
      const countryCode = resolveCountryCode(profileCountryCode)
      const localPhone = profilePhone.replace(/\D/g, '')
      const fullPhone = `${countryCode}${localPhone}`
      const loginEmail = profileEmail.trim().toLowerCase()
      const fullName = profileName.trim()
      const cleanMotto = limitMotto(profileMotto.trim())

      authDebug('handleAuth:attempt', {
        mode: authMode,
        email: loginEmail,
        isAdminEmail: ADMIN_EMAILS.includes(loginEmail),
        hasCaptcha: Boolean(captchaToken),
        localPhoneLength: localPhone.length,
        hasFullName: Boolean(fullName),
      })

      if (authMode === 'create' && fullPhone.length < 8) {
        setProfileStatus(text.phoneRequired)
        return
      }

      if (authMode === 'create' && !fullName) {
        setProfileStatus(text.nameRequired)
        return
      }

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

      if (!captchaToken) {
        setProfileStatus(text.captchaRequired)
        return
      }

      setIsSavingProfile(true)
      setProfileStatus(authMode === 'login' ? text.loggingIn : text.creating)

      if (authMode === 'create') {
        const nickname = limitDisplayName(profileNickname.trim())
        const display = nickname || compactDisplayName(fullName)
        const consentAt = new Date().toISOString()
        const signUpResult = await supabase.auth.signUp({
          email: loginEmail,
          password: profilePassword,
          options: {
            data: {
              display_name: display,
              full_name: fullName,
              name: display,
              nickname: nickname || null,
              profile_motto: cleanMotto || null,
              birthday: profileBirthday || null,
              phone: fullPhone,
              avatar_text_color: avatarTextColor,
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

        if (signUpResult.error) {
          resetCaptcha()
          setProfileStatus(signUpResult.error.message)
          setIsSavingProfile(false)
          return
        }

        const authUser = signUpResult.data.user

        if (!authUser) {
          resetCaptcha()
          setProfileStatus(text.loginRequired)
          setAuthMode('login')
          setIsSavingProfile(false)
          return
        }

        setUserId(authUser.id)

        const existingProfileResult = await supabase
          .from('profiles')
          .select('avatar_url, nickname')
          .eq('id', authUser.id)
          .maybeSingle()
        const existingProfile = existingProfileResult.data

        authDebug('handleAuth:existingProfileQuery', {
          error: existingProfileResult.error,
          profile: existingProfile,
        })

        const avatarUrl = avatarMode === 'photo' ? await uploadAvatar(authUser.id, existingProfile?.avatar_url || null) : null

        if (avatarUrl === false) {
          resetCaptcha()
          setIsSavingProfile(false)
          return
        }

        const avatarPayload = {
          avatar_url: avatarMode === 'photo' ? avatarUrl : null,
          avatar_emoji: avatarMode === 'emoji' ? avatarEmoji.trim() || '😎' : null,
          avatar_initials: avatarMode === 'initials' ? compactInitials(avatarInitials || display) : null,
          avatar_color: avatarColor,
          avatar_text_color: avatarTextColor,
        }

        const profileUpsert = await supabase.from('profiles').upsert({
          id: authUser.id,
          full_name: fullName,
          phone: fullPhone,
          nickname: nickname || existingProfile?.nickname || null,
          email: loginEmail,
          birthday: profileBirthday || null,
          profile_motto: cleanMotto || null,
          ...avatarPayload,
          personal_data_consent: personalDataConsent,
          personal_data_consent_at: consentAt,
          privacy_policy_url: PRIVACY_POLICY_URL,
          updated_at: new Date().toISOString(),
        })

        authDebug('handleAuth:createProfileUpsert', {
          error: profileUpsert.error,
          authUserId: authUser.id,
          email: loginEmail,
        })

        if (profileUpsert.error) {
          resetCaptcha()
          setProfileStatus(profileUpsert.error.message)
          setIsSavingProfile(false)
          return
        }

        const metadataUpdate = await supabase.auth.updateUser({
          data: {
            display_name: display,
            full_name: fullName,
            name: display,
            nickname: nickname || null,
            birthday: profileBirthday || null,
            phone: fullPhone,
            avatar_url: avatarPayload.avatar_url,
            avatar_emoji: avatarPayload.avatar_emoji,
            avatar_initials: avatarPayload.avatar_initials,
            avatar_color: avatarPayload.avatar_color,
            avatar_text_color: avatarPayload.avatar_text_color,
            profile_motto: cleanMotto || null,
            personal_data_consent: personalDataConsent,
            personal_data_consent_at: consentAt,
            privacy_policy_url: PRIVACY_POLICY_URL,
          },
        })

        authDebug('handleAuth:updateUserMetadata', { error: metadataUpdate.error })

        if (metadataUpdate.error) {
          resetCaptcha()
          setProfileStatus(metadataUpdate.error.message)
          setIsSavingProfile(false)
          return
        }

        resetCaptcha()
        setProfilePassword('')
        setPersonalDataConsent(false)
        await loadProfile()
        setProfileStatus(text.accountCreated)
        setActiveView('sessions')
        setIsSavingProfile(false)
        return
      }

      authDebug('handleAuth:signInWithPassword:start', {
        email: loginEmail,
        isAdminEmail: ADMIN_EMAILS.includes(loginEmail),
        hasCaptcha: Boolean(captchaToken),
      })

      const signInResult = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: profilePassword,
        options: {
          captchaToken,
        },
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

      resetCaptcha()

      if (signInResult.error) {
        setProfileStatus(signInResult.error.message)
        setIsSavingProfile(false)
        return
      }

      const { data: verifiedUserData, error: verifiedUserError } = await supabase.auth.getUser()
      const authUser = verifiedUserData.user

      authDebug('handleAuth:getUserAfterLogin', {
        error: verifiedUserError,
        user: authUser ? {
          id: authUser.id,
          email: authUser.email,
          emailConfirmedAt: authUser.email_confirmed_at,
          lastSignInAt: authUser.last_sign_in_at,
          appMetadata: authUser.app_metadata,
          userMetadata: authUser.user_metadata,
        } : null,
      })

      if (verifiedUserError) {
        setProfileStatus(verifiedUserError.message)
        setIsSavingProfile(false)
        return
      }

      if (!authUser) {
        setProfileStatus(text.loginRequired)
        setAuthMode('login')
        setIsSavingProfile(false)
        return
      }

      setUserId(authUser.id)
      setProfilePassword('')
      await loadProfile()
      setProfileStatus(text.loggedIn)
      setActiveView('sessions')
      setIsSavingProfile(false)
    } catch (error) {
      authDebug('handleAuth:thrown', error)
      resetCaptcha()
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsSavingProfile(false)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setUserId('')
    setProfile(null)
    setProfilePassword('')
    setNewPassword('')
    setIsRecoveryMode(false)
    setProfileStatus(text.loggedOut)
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
    const resetOptions = {
      redirectTo,
      captchaToken: captchaToken || undefined,
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, resetOptions)

    resetCaptcha()

    if (error) {
      setProfileStatus(error.message)
      setIsResettingPassword(false)
      return
    }

    setProfileStatus(text.resetPasswordSent)
    setIsResettingPassword(false)
  }

  async function updatePasswordFromRecovery() {
    if (newPassword.length < 6) {
      setProfileStatus(text.passwordRequired)
      return
    }

    setIsResettingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setProfileStatus(error.message)
      setIsResettingPassword(false)
      return
    }

    setNewPassword('')
    setProfilePassword('')
    setIsRecoveryMode(false)
    setProfileStatus(text.passwordUpdated)
    setIsResettingPassword(false)
  }

  async function loadSessions() {
    const [sessionResult, blockedResult] = await Promise.all([
      supabase
      .from('sessions')
        .select('*, session_participants(id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, checked_in, payment_status, payment_amount, score, accuracy_percent, projectiles_fired, placement, prize_claimed, prize_claimed_at)')
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('blocked_times').select('date, start_time, end_time, arenas_used'),
    ])

    if (sessionResult.error) {
      setCreateStatus(sessionResult.error.message)
      return
    }

    setSessions((sessionResult.data ?? []) as Session[])
    setBlockedTimes((blockedResult.data ?? []) as BlockedTime[])
  }

  async function loadClubs() {
    const { data, error } = await supabase
      .from('clubs')
      .select('*, club_members(id, club_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, status)')
      .order('created_at', { ascending: false })

    if (error) {
      setClubStatus(error.message)
      return
    }

    setClubs((data ?? []) as Club[])
  }

  async function loadTournamentData() {
    const [editorsResult, poolsResult, entriesResult, matchesResult, auditResult] = await Promise.all([
      supabase.from('tournament_editors').select('id, session_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto'),
      supabase.from('tournament_pools').select('id, session_id, name, sort_order').order('sort_order', { ascending: true }),
      supabase.from('tournament_pool_entries').select('id, session_id, pool_id, participant_id, profile_id, seed, team_label'),
      supabase
        .from('tournament_matches')
        .select('id, session_id, pool_id, stage, round, match_number, participant_a_id, participant_b_id, score_a, score_b, wins_a, wins_b, winner_participant_id, loser_participant_id, status, arena_number, queue_position, best_of')
        .order('round', { ascending: true })
        .order('match_number', { ascending: true }),
      supabase
        .from('tournament_audit_log')
        .select('id, session_id, user_id, action, old_value, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(80),
    ])

    const firstError = editorsResult.error || poolsResult.error || entriesResult.error || matchesResult.error || auditResult.error
    if (firstError) {
      setCreateStatus(firstError.message)
      return
    }

    setTournamentData({
      editors: (editorsResult.data ?? []) as TournamentEditor[],
      pools: (poolsResult.data ?? []) as TournamentPool[],
      poolEntries: (entriesResult.data ?? []) as TournamentPoolEntry[],
      matches: (matchesResult.data ?? []) as TournamentMatch[],
      auditLogs: (auditResult.data ?? []) as TournamentAuditLog[],
    })
  }

  useEffect(() => {
    setLanguage(getInitialLanguage())
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsRecoveryMode(true)
      setActiveView('profile')
      window.history.replaceState(null, '', window.location.pathname)
    }
    loadProfile()
    loadSessions()
    loadClubs()
    loadTournamentData()
  }, [])

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
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
        setProfile(null)
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!profile) return
    syncProfileEverywhere(profile)
  }, [
    profile?.id,
    profile?.nickname,
    profile?.phone,
    profile?.avatar_url,
    profile?.avatar_emoji,
    profile?.avatar_initials,
    profile?.avatar_color,
    profile?.avatar_text_color,
    profile?.profile_motto,
  ])

  useEffect(() => {
    const channel = supabase
      .channel('vrena-live-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, () => loadSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadProfile()
        loadSessions()
        loadClubs()
        loadTournamentData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, () => loadClubs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members' }, () => loadClubs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_editors' }, () => loadTournamentData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_pools' }, () => loadTournamentData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_pool_entries' }, () => loadTournamentData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches' }, () => loadTournamentData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_audit_log' }, () => loadTournamentData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || profile || activeView !== 'profile') return

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

    if (getHCaptcha()) {
      renderCaptcha()
    } else if (existingScript) {
      existingScript.addEventListener('load', renderCaptcha, { once: true })
    } else {
      const script = document.createElement('script')
      script.id = 'hcaptcha-script'
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.addEventListener('load', renderCaptcha, { once: true })
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
    }
  }, [activeView, authMode, profile])

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

  const timeOptions = useMemo(() => {
    return getAvailableTimeOptions(sessionDate, sessionDuration, sessionArenaCount)
  }, [blockedTimes, language, sessionArenaCount, sessionDate, sessionDuration, sessions])

  const editTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(editSessionDate, editSessionDuration, editSessionArenaCount, editingSessionId)
  }, [blockedTimes, editSessionArenaCount, editSessionDate, editSessionDuration, editingSessionId, language, sessions])

  const sessionDurationRecommendation = durationRecommendation(sessionMaxPlayers, sessionDuration)
  const editSessionDurationRecommendation = durationRecommendation(editSessionMaxPlayers, editSessionDuration)

function handleSessionDateChange(value: string) {
  setSessionDate(value)
}

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

    if (value < 8) {
      setEditSessionArenaCount(1)
    }
  }

  function handleEditArenaCountChange(value: number) {
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

  function getAvailableTimeOptions(date: string, duration: number, arenaCount: number, excludeSessionId = '') {
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
  }

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
      const memberNames = (club.club_members ?? [])
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

  const sessionClubOptions = useMemo(() => {
    if (!userId) return []

    return clubs.filter((club) => club.owner_id === userId || (club.club_members ?? []).some((member) => member.profile_id === userId && member.status === 'approved'))
  }, [clubs, userId])

  const selectedClub = useMemo(() => {
    return clubs.find((club) => club.id === selectedClubId)
  }, [clubs, selectedClubId])

  const selectedClubMembership = useMemo(() => {
    if (!selectedClub) return undefined
    return (selectedClub.club_members ?? []).find((member) => member.profile_id === userId)
  }, [selectedClub, userId])

  const selectedClubSessions = useMemo(() => {
    if (!selectedClubId) return []
    return sessions.filter((session) => session.club_id === selectedClubId && isUpcomingSession(session))
  }, [selectedClubId, sessions])

  const selectedClubDayOptions = useMemo(() => {
    const uniqueDays = Array.from(new Set(selectedClubSessions.map((session) => session.date))).sort()
    return uniqueDays.map((value) => ({ value, ...formatDayButton(value, language) }))
  }, [language, selectedClubSessions])

  const filteredSelectedClubSessions = useMemo(() => {
    if (!selectedClubDate) return selectedClubSessions
    return selectedClubSessions.filter((session) => session.date === selectedClubDate)
  }, [selectedClubDate, selectedClubSessions])

  const checkInSession = useMemo(() => {
    if (!checkInTarget) return undefined
    return sessions.find((session) => session.id === checkInTarget.sessionId)
  }, [checkInTarget, sessions])

  const checkInParticipant = useMemo(() => {
    if (!checkInTarget || !checkInSession) return undefined
    return (checkInSession.session_participants ?? []).find((participant) => participant.id === checkInTarget.participantId)
  }, [checkInSession, checkInTarget])

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
      gamesJoined: number
      wins: number
      totalScore: number
      totalAccuracy: number
      accuracyCount: number
      totalProjectiles: number
      bestByGame: Map<string, number>
    }>()

    sessions.forEach((session) => {
      ;(session.session_participants ?? []).forEach((participant) => {
        if (!participant.checked_in) return

        const current = stats.get(participant.profile_id) ?? {
          profileId: participant.profile_id,
          displayName: compactDisplayName(participant.display_name, text.player),
          avatarUrl: participant.avatar_url,
          avatarEmoji: participant.avatar_emoji || null,
          avatarInitials: participant.avatar_initials || null,
          avatarColor: participant.avatar_color || null,
          avatarTextColor: participant.avatar_text_color || null,
          profileMotto: participant.profile_motto || null,
          gamesJoined: 0,
          wins: 0,
          totalScore: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          bestByGame: new Map<string, number>(),
        }

        current.displayName = compactDisplayName(participant.display_name, current.displayName)
        current.avatarUrl = participant.avatar_url || current.avatarUrl
        current.avatarEmoji = participant.avatar_emoji || current.avatarEmoji
        current.avatarInitials = participant.avatar_initials || current.avatarInitials
        current.avatarColor = participant.avatar_color || current.avatarColor
        current.avatarTextColor = participant.avatar_text_color || current.avatarTextColor
        current.profileMotto = participant.profile_motto || current.profileMotto
        current.gamesJoined += 1
        if (participant.placement === 1) current.wins += 1

        const numericScore = Number(participant.score)
        if (Number.isFinite(numericScore)) {
          current.totalScore += numericScore

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

        stats.set(participant.profile_id, current)
      })
    })

    return Array.from(stats.values())
      .map((item) => ({
        ...item,
        averageAccuracy: item.accuracyCount > 0 ? Math.round(item.totalAccuracy / item.accuracyCount) : null,
        bestByGame: Array.from(item.bestByGame.entries()).map(([gameId, score]) => ({
          game: games.find((game) => game.id === gameId)?.title || gameId,
          score,
        })),
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
  }, [sessions, text.player])

  const playerStats = allPlayerStats.find((item) => item.profileId === userId) ?? {
    profileId: userId,
    displayName: displayName(profile),
    avatarUrl: profile?.avatar_url || null,
    avatarEmoji: profile?.avatar_emoji || null,
    avatarInitials: profile?.avatar_initials || null,
    avatarColor: profile?.avatar_color || null,
    avatarTextColor: profile?.avatar_text_color || null,
    profileMotto: profile?.profile_motto || null,
    gamesJoined: 0,
    wins: 0,
    totalScore: 0,
    totalAccuracy: 0,
    accuracyCount: 0,
    totalProjectiles: 0,
    averageAccuracy: null,
    bestByGame: [],
  }

  const isAdmin = Boolean(profile?.role === 'admin' || (profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase())))
  const topPlayer = allPlayerStats[0]
  const selectedPlayerStats = allPlayerStats.find((item) => item.profileId === selectedPlayerId)
  const selectedPlayerManageContext = useMemo(() => {
    if (!selectedPlayerId) return null

    const candidateSessions = selectedPlayerSessionId
      ? sessions.filter((session) => session.id === selectedPlayerSessionId)
      : sessions

    for (const session of candidateSessions) {
      const participant = (session.session_participants ?? []).find((item) => item.profile_id === selectedPlayerId)
      if (participant && canEditParticipantResult(session, participant)) return { session, participant }
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
      visibleAvatar = profile.avatar_url || visibleAvatar
      visibleEmoji = profile.avatar_emoji || visibleEmoji
      visibleInitials = profile.avatar_initials || visibleInitials
      visibleColor = profile.avatar_color || visibleColor
      visibleTextColor = profile.avatar_text_color || visibleTextColor
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
      const member = (club.club_members ?? []).find((item) => item.profile_id === selectedPlayerId)
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
        return {
          ...selectedPlayerStats,
          displayName: compactDisplayName(displayName(profile) || selectedPlayerStats.displayName || visibleName, text.player),
          avatarUrl: profile.avatar_url || null,
          avatarEmoji: profile.avatar_emoji || null,
          avatarInitials: profile.avatar_initials || null,
          avatarColor: profile.avatar_color || null,
          avatarTextColor: profile.avatar_text_color || null,
          profileMotto: profile.profile_motto || null,
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
      return {
        profileId: profile.id,
        displayName: compactDisplayName(displayName(profile), text.player),
        avatarUrl: profile.avatar_url || null,
        avatarEmoji: profile.avatar_emoji || null,
        avatarInitials: profile.avatar_initials || null,
        avatarColor: profile.avatar_color || null,
        avatarTextColor: profile.avatar_text_color || null,
        profileMotto: profile.profile_motto || null,
        gamesJoined: 0,
        wins: 0,
        totalScore: 0,
        totalAccuracy: 0,
        accuracyCount: 0,
        totalProjectiles: 0,
        averageAccuracy: null,
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
          gamesJoined: 0,
          wins: 0,
          totalScore: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          averageAccuracy: null,
          bestByGame: [],
        }
      }
    }

    for (const club of clubs) {
      const member = (club.club_members ?? []).find((item) => item.profile_id === selectedPlayerId)
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
          gamesJoined: 0,
          wins: 0,
          totalScore: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          averageAccuracy: null,
          bestByGame: [],
        }
      }
    }

    return undefined
  }, [clubs, profile, selectedPlayerId, selectedPlayerStats, sessions, text.player, userId])

  useEffect(() => {
    if (!checkInParticipant) {
      setCheckInPaymentStatus('')
      setCheckInPaymentAmount('')
      return
    }

    setCheckInPaymentStatus(checkInParticipant.payment_status || '')
    setCheckInPaymentAmount(checkInParticipant.payment_amount ? String(checkInParticipant.payment_amount) : '')
  }, [checkInParticipant])

  useEffect(() => {
    if (!profile || !topPlayer || topPlayer.profileId !== userId) return
    const alreadyShown = window.sessionStorage.getItem('vrena-crown-login')
    if (alreadyShown === userId) return
    window.sessionStorage.setItem('vrena-crown-login', userId)
    setChampionLoginOpen(true)
  }, [profile, topPlayer, userId])

  useEffect(() => {
    const query = tournamentEditorEmail.trim()
    if (query.length < 2) {
      setTournamentEditorResults([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      const safe = query.replace(/[%_,]/g, '')
      const { data } = await supabase
        .from('profiles')
        .select('id, phone, full_name, nickname, email, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role')
        .or(`full_name.ilike.%${safe}%,nickname.ilike.%${safe}%,email.ilike.%${safe}%`)
        .limit(6)

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

  function canEditParticipantResult(session: Session, participant: Participant) {
    if (!userId) return false
    if (isAdmin) return true
    if (!participant.checked_in) return false

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
    await supabase.from('tournament_audit_log').insert({
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

  function canManageClub(club: Club) {
    return Boolean(userId && (club.owner_id === userId || isAdmin))
  }

  function approvedClubMember(club: Club, profileId = userId) {
    return (club.club_members ?? []).some((member) => member.profile_id === profileId && member.status === 'approved')
  }

  function canSeeClubPrivateData(club: Club | undefined) {
    if (!club) return true
    return club.visibility === 'public' || canManageClub(club) || approvedClubMember(club)
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
    return (club.club_members ?? []).find((member) => member.profile_id === profileId)
  }

  function canAccessClubSession(session: Session) {
    const club = sessionClubFor(session)
    if (!club) return true
    return canManageClub(club) || approvedClubMember(club)
  }

  function clubMemberCount(club: Club) {
    return club.member_count ?? (club.club_members ?? []).filter((member) => member.status === 'approved').length
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

    const { data: club, error } = await supabase
      .from('clubs')
      .insert({
        owner_id: userId,
        name,
        description: clubDescription.trim() || null,
        visibility: clubVisibility,
      })
      .select('id')
      .single()

    if (error || !club) {
      setClubStatus(error?.message || text.createError)
      setIsCreatingClub(false)
      return
    }

    const memberResult = await supabase.from('club_members').insert({
      club_id: club.id,
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
    setClubStatus(text.clubCreated)
    setIsCreatingClub(false)
  }

  async function joinClub(club: Club) {
    if (!requireProfile()) return

    const activeProfile = profile
    if (!activeProfile) return

    const currentMembership = (club.club_members ?? []).find((member) => member.profile_id === userId)
    if (currentMembership) return

    setBusyClubId(club.id)
    const { error } = await supabase.from('club_members').insert({
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
    setBusyClubId(member.club_id)
    const { error } = await supabase.from('club_members').update({ status: 'approved' }).eq('id', member.id)

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
    if (!canManageClub(club)) return

    if (!window.confirm(text.removeMemberConfirm)) return

    setBusyClubId(club.id)
    const { error } = await supabase.from('club_members').delete().eq('id', member.id)

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
    const { error } = await supabase.from('club_members').delete().eq('id', member.id).eq('profile_id', userId)

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(leftClubText)
    setBusyClubId('')
  }

  async function updateParticipantCheckIn(participantId: string, paymentStatus: 'cash' | 'bank_transfer' | 'free' | null, amountValue = '') {
    const normalizedAmount = paymentStatus && paymentStatus !== 'free' ? Number(amountValue.replace(/[^\d]/g, '')) : null
    const { error } = await supabase
      .from('session_participants')
      .update({
        checked_in: Boolean(paymentStatus),
        payment_status: paymentStatus,
        payment_amount: Number.isFinite(normalizedAmount as number) ? normalizedAmount : null,
        checked_in_at: paymentStatus ? new Date().toISOString() : null,
      })
      .eq('id', participantId)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    setCheckInTarget(null)
    await loadSessions()
  }

  async function updateParticipantResult(
    participantId: string,
    scoreValue: string | number | null,
    placementValue: string | number | null,
    accuracyValue: string | number | null,
    projectilesValue: string | number | null
  ) {
    const resultContext = sessions.reduce<{ session: Session; participant: Participant } | null>((match, session) => {
      if (match) return match
      const participant = (session.session_participants ?? []).find((item) => item.id === participantId)
      if (!participant || !canEditParticipantResult(session, participant)) return null
      return { session, participant }
    }, null)

    if (!resultContext) {
      setCreateStatus('Only admins or session managers can edit checked-in player scores.')
      return
    }

    const score = scoreValue === '' || scoreValue === null ? null : Number(scoreValue)
    const placement = placementValue === '' || placementValue === null ? null : Number(placementValue)
    const accuracy = accuracyValue === '' || accuracyValue === null ? null : Number(accuracyValue)
    const projectiles = projectilesValue === '' || projectilesValue === null ? null : Number(projectilesValue)

    const { error } = await supabase
      .from('session_participants')
      .update({
        score: Number.isFinite(score as number) ? score : null,
        accuracy_percent: Number.isFinite(accuracy as number) ? accuracy : null,
        projectiles_fired: Number.isFinite(projectiles as number) ? projectiles : null,
        placement: Number.isFinite(placement as number) ? placement : null,
      })
      .eq('id', participantId)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await loadSessions()
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
      id: userId,
      full_name: fullName,
      phone: `${countryCode}${localPhone.replace(/\D/g, '')}`,
      profile_motto: cleanMotto || null,
      nickname: nickname || null,
      email: profileEmail.trim() || null,
      birthday: profileBirthday || null,
      ...avatarPayload,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row)
      .select('id, phone, full_name, nickname, email, birthday, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role')
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingProfile(false)
      return
    }

    const display = nickname || compactDisplayName(fullName)
    const metadataUpdate = await supabase.auth.updateUser({
      data: {
        display_name: display,
        full_name: fullName,
        name: display,
        nickname: nickname || null,
        birthday: data.birthday,
        phone: data.phone,
        avatar_url: data.avatar_url,
        avatar_emoji: data.avatar_emoji,
        avatar_initials: data.avatar_initials,
        avatar_color: data.avatar_color,
        avatar_text_color: data.avatar_text_color,
        profile_motto: data.profile_motto,
      },
    })

    if (metadataUpdate.error) {
      setProfileStatus(metadataUpdate.error.message)
      setIsSavingProfile(false)
      return
    }

    const participantProfileUpdate = await supabase
      .from('session_participants')
      .update({
        display_name: display,
        avatar_url: data.avatar_url,
        avatar_emoji: data.avatar_emoji,
        avatar_initials: data.avatar_initials,
        avatar_color: data.avatar_color,
        avatar_text_color: data.avatar_text_color,
        profile_motto: data.profile_motto,
    })
      .eq('profile_id', userId)
      .select('id')

    if (participantProfileUpdate.error) {
      setProfileStatus(participantProfileUpdate.error.message)
      setIsSavingProfile(false)
      return
    }

    const clubMemberProfileUpdate = await supabase
      .from('club_members')
      .update({
        display_name: display,
        avatar_url: data.avatar_url,
        avatar_emoji: data.avatar_emoji,
        avatar_initials: data.avatar_initials,
        avatar_color: data.avatar_color,
        avatar_text_color: data.avatar_text_color,
        profile_motto: data.profile_motto,
      })
      .eq('profile_id', userId)
      .select('id')

    if (clubMemberProfileUpdate.error) {
      setProfileStatus(clubMemberProfileUpdate.error.message)
      setIsSavingProfile(false)
      return
    }

    const tournamentEditorProfileUpdate = await supabase
      .from('tournament_editors')
      .update({
        display_name: display,
        avatar_url: data.avatar_url,
        avatar_emoji: data.avatar_emoji,
        avatar_initials: data.avatar_initials,
        avatar_color: data.avatar_color,
        avatar_text_color: data.avatar_text_color,
        profile_motto: data.profile_motto,
      })
      .eq('profile_id', userId)
      .select('id')

    if (tournamentEditorProfileUpdate.error) {
      setProfileStatus(tournamentEditorProfileUpdate.error.message)
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
    setProfileStatus(text.profileSaved)
    setIsSavingProfile(false)
  }

  async function uploadAvatar(ownerId: string, currentAvatarUrl: string | null) {
    if (!avatarFile) return currentAvatarUrl

    const safeName = avatarFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const path = `${ownerId}/${Date.now()}-${safeName}`
    const upload = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })

    if (upload.error) {
      setProfileStatus(upload.error.message)
      setIsSavingProfile(false)
      return false as const
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setAvatarFile(file)
    setAvatarPreview(file ? URL.createObjectURL(file) : '')
    if (file) setAvatarMode('photo')
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

    setIsCreating(true)
    setCreateStatus(text.creating)

    const effectiveVisibility = selectedSessionClub ? 'public' : sessionVisibility
    const inviteCode = effectiveVisibility === 'private' ? generateInviteCode() : null

    const { data: created, error } = await supabase
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

    await supabase.from('session_participants').insert({
      session_id: created.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
    })

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
    await loadSessions()
    setActiveView('sessions')
    setIsCreating(false)
  }

  async function joinSession(session: Session) {
    if (!requireProfile()) return

    const activeProfile = profile

    if (!activeProfile) return

    const sessionClub = sessionClubFor(session)
    if (sessionClub && !canAccessClubSession(session)) {
      setCreateStatus(text.clubMembershipRequired)
      return
    }

    if (session.visibility === 'private') {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (typedCode !== session.invite_code) {
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

    setBusySessionId(session.id)

    const { error } = await supabase.from('session_participants').insert({
      session_id: session.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
    })

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setBusySessionId('')
    setCreateStatus(text.joinedSession)
  }

  async function leaveSession(session: Session) {
    if (!requireProfile()) return

    if (session.owner_id === userId) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.leaveConfirmPrefix} "${session.name}"? ${text.leaveConfirmSuffix}`)
    if (!confirmed) return

    setBusySessionId(session.id)
    const { error } = await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', session.id)
      .eq('profile_id', userId)

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
    const { error } = await supabase.from('sessions').update({ game_votes: votes }).eq('id', session.id)

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
    const { error } = await supabase
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

  function startEditingSession(session: Session) {
    setEditingSessionId(session.id)
    setEditSessionName(session.name)
    setEditSessionDate(session.date)
    setEditSessionTime(session.start_time.slice(0, 5))
    setEditSessionDuration(session.duration_minutes)
    setEditSessionMaxPlayers(session.max_players)
    setEditSessionArenaCount(arenasUsedBySession(session))
    setEditSessionVisibility(session.visibility)
    setEditSessionNotes(session.notes || '')
    setEditSelectedGames(session.game_options?.length ? session.game_options : ['laser-tag'])
    setEditTournamentFormat(session.tournament_format || 'pool_to_final')
    setEditTournamentBestOf((session.best_of || 1) as 1 | 3 | 5)
    setEditTournamentRoundsPerMatch(session.rounds_per_match || 1)
    setEditTournamentRequirePayment(Boolean(session.require_payment))
    setEditTournamentQualificationRule(session.qualification_rule || 'top_1')
    setEditTournamentCustomQualifiers(session.custom_qualifiers || 2)
    setEditTournamentThirdPlace(Boolean(session.enable_third_place_match))
    setEditTournamentFirstPrize(session.first_prize || '')
    setEditTournamentSecondPrize(session.second_prize || '')
    setEditTournamentThirdPrize(session.third_prize || '')
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

    const effectiveEditVisibility = session.club_id ? 'public' : editSessionVisibility
    const inviteCode =
      effectiveEditVisibility === 'private'
        ? session.invite_code || generateInviteCode()
        : null
    const tournament = tournamentForSession(session.id)
    const hasTournamentBracket = tournament.pools.length > 0 || tournament.matches.length > 0

    const { error } = await supabase
      .from('sessions')
      .update({
        name: editSessionName.trim(),
        date: editSessionDate,
        start_time: `${editSessionTime}:00`,
        duration_minutes: editSessionDuration,
        max_players: editSessionMaxPlayers,
        arena_count: editSessionArenaCount,
        game_options: editSelectedGames,
        visibility: effectiveEditVisibility,
        invite_code: inviteCode,
        notes: editSessionNotes.trim() || null,
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

    await loadSessions()
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

    setBusySessionId(session.id)
    const { error } = await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', session.id)

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
    const { error } = await supabase.from('session_participants').delete().eq('id', participant.id)

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

    const { error } = await supabase.from('profiles').delete().eq('id', userId)

    if (error) {
      setProfileStatus(error.message)
      setIsDeletingAccount(false)
      return
    }

    await supabase.auth.signOut()
    setUserId('')
    setProfile(null)
    setProfilePassword('')
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
      : await supabase
        .from('profiles')
        .select('id, phone, full_name, nickname, email, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role')
        .or(`email.eq.${email},nickname.ilike.%${email}%,full_name.ilike.%${email}%`)
        .limit(1)
        .maybeSingle()

    const editorProfile = profileLookup.data
    if (profileLookup.error || !editorProfile) {
      setCreateStatus(profileLookup.error?.message || text.editorNotFound)
      setBusyTournamentId('')
      return
    }

    const display = compactDisplayName(editorProfile.nickname || editorProfile.full_name || editorProfile.email, text.player)
    const { error } = await supabase.from('tournament_editors').upsert({
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
    await supabase.from('tournament_matches').delete().eq('session_id', session.id)
    await supabase.from('tournament_pool_entries').delete().eq('session_id', session.id)
    await supabase.from('tournament_pools').delete().eq('session_id', session.id)

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

    const { data: pools, error: poolError } = await supabase
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

    const { error } = await supabase.from('tournament_pool_entries').insert(entries)
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
    await supabase.from('tournament_matches').delete().eq('session_id', session.id)

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

    const { error } = await supabase.from('tournament_matches').insert(matchRows)
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
    const { error } = await supabase
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
    const { error } = await supabase
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

    const { error } = await supabase.from('tournament_matches').insert(matchRows)
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

    if (first) await supabase.from('session_participants').update({ placement: 1 }).eq('id', first)
    if (second) await supabase.from('session_participants').update({ placement: 2 }).eq('id', second)
    if (third) await supabase.from('session_participants').update({ placement: 3 }).eq('id', third)
    await supabase.from('sessions').update({ status: 'completed', tournament_locked: true }).eq('id', session.id)

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

    const { error } = await supabase.from('tournament_matches').insert({
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
    const { error } = await supabase
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

    const loadCanvasImage = async (src: string) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('image failed'))
        image.src = src
      })
      return image
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

  return (
    <div className="app">
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
            <button className={sharedKey === 'app' ? 'share-button app-share copied' : 'share-button app-share'} type="button" onClick={() => shareLink('app', 'VRena Sessions')}>
              {sharedKey === 'app' ? text.shared : text.shareApp}
            </button>
          </div>
          <h1 className="sr-only">VRena Sessions</h1>
          <p className="muted">{text.tagline}</p>
        </div>

        <button className={activeView === 'profile' ? 'profile-chip active' : 'profile-chip'} onClick={() => setActiveView('profile')} type="button">
          <div className="avatar" style={avatarStyle(profile)}>
            {avatarNode(profile, 'P')}
            {topPlayer?.profileId === userId && <span className="champion-badge">🏆</span>}
          </div>
          <div>
            <strong>{profile ? displayName(profile) : text.noProfile}</strong>
            <span>{profile ? profile.profile_motto || text.profileMottoEmpty : text.clickLogin}</span>
          </div>
        </button>

        <div className="tabs">
          <button className={activeView === 'sessions' ? 'tab active' : 'tab'} onClick={() => setActiveView('sessions')}>
            {text.sessions}
          </button>
          <button className={activeView === 'create' ? 'tab active' : 'tab'} onClick={() => (profile ? setActiveView('create') : promptLogin())}>
            {text.createSession}
          </button>
          <button className={activeView === 'clubs' ? 'tab active' : 'tab'} onClick={() => (profile ? setActiveView('clubs') : promptLogin())}>
            {text.clubs}
          </button>
        </div>

        <div className="shop-contact">
          <strong>VRena Vietnam</strong>
          <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
          <a href="https://zalo.me/84981152315" target="_blank" rel="noreferrer">Zalo: 0981152315</a>
          <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
        </div>
      </aside>

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
                  🔎
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
                    ×
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
            {createStatus && <p className="notice">{createStatus}</p>}

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
            </div>

            <div className="list">
              {filteredSessions.length === 0 && <p className="notice">{text.noMatchingSessions}</p>}

              {filteredSessions.map((session) => {
                const participants = session.session_participants ?? []
                const remaining = seatsLeft(session)
                const alreadyJoined = participants.some((participant) => participant.profile_id === userId)
                const isSessionOwner = session.owner_id === userId
                const canManage = canManageSession(session)
                const canSeeInviteCode = session.visibility === 'private' && session.invite_code && (alreadyJoined || isSessionOwner || isAdmin)
                const isEditing = editingSessionId === session.id
                const sessionClub = sessionClubFor(session)
                const sessionClubMembership = clubMembershipFor(sessionClub)
                const canJoinThisSession = canAccessClubSession(session)
                const canSeeSessionPlayers = canSeeClubPrivateData(sessionClub)
                const isExpanded = Boolean(expandedSessions[session.id])
                const isPast = isPastSession(session)
                const canMutatePastSession = !isPast || canManage
                const coverGame = sessionCoverGame(session)
                const confirmedGameDraft = confirmedGameDrafts[session.id] ?? session.confirmed_game_id ?? ''
                const hasCrownHolder = Boolean(
                  topPlayer?.profileId
                  && topPlayer.profileId !== userId
                  && participants.some((participant) => participant.profile_id === topPlayer.profileId)
                )

                return (
                  <article className={isExpanded ? 'session expanded-session' : 'session'} id={`session-${session.id}`} key={session.id}>
                    <div
                      className={isExpanded ? 'compact-session-card compact-session-card-expanded' : 'compact-session-card'}
                      onClick={(event) => {
                        if (isInteractiveClickTarget(event.target)) return
                        setExpandedSessions((current) => ({ ...current, [session.id]: !current[session.id] }))
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (isInteractiveClickTarget(event.target)) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setExpandedSessions((current) => ({ ...current, [session.id]: !current[session.id] }))
                        }
                      }}
                    >
                      <img className="compact-session-image" src={coverGame.image} alt="" />
                      <div className="compact-session-main">
                        <div className="compact-session-title-row">
                          <h3>{session.name}</h3>
                          <span className={session.session_type === 'tournament' ? 'pill private' : 'pill ok'}>
                            {session.session_type === 'tournament' ? text.tournament : text.normalGame}
                          </span>
                          <span className={session.visibility === 'private' ? 'pill private' : 'pill ok'}>
                            {session.visibility === 'private' ? text.private : text.public}
                          </span>
                          {isSessionOwner && <span className="pill host-pill">{text.host}</span>}
                        </div>
                        <div className="row-meta compact-meta">
                          <span>{formatShortDate(session.date, language)}</span>
                          <span>{session.start_time.slice(0, 5)}</span>
                          <span>{session.duration_minutes} min</span>
                          {!isPast && <span>{remaining} {text.seatsLeft}</span>}
                          {isPast && <span>{text.finalGame}: {coverGame.title}</span>}
                          {session.session_type === 'tournament' && <span>{text.roundsPerMatch}: {session.rounds_per_match || 1}</span>}
                        </div>
                      </div>
                      <div className="compact-session-actions">
                        {!isPast && (!sessionClub || canJoinThisSession) && session.visibility === 'private' && !alreadyJoined && (
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
                        {!isPast && sessionClub && !canJoinThisSession ? (
                          <button
                            className={busyClubId === sessionClub.id ? 'secondary compact-join loading' : 'secondary compact-join'}
                            disabled={busyClubId === sessionClub.id || sessionClubMembership?.status === 'pending'}
                            onClick={(event) => {
                              event.stopPropagation()
                              joinClub(sessionClub)
                            }}
                            type="button"
                          >
                            {sessionClubMembership?.status === 'pending' ? text.requestSent : text.joinClub}
                          </button>
                        ) : !isPast && (
                          <button
                            className={busySessionId === session.id ? 'primary compact-join loading' : 'primary compact-join'}
                            disabled={alreadyJoined || remaining <= 0 || busySessionId === session.id || !canMutatePastSession}
                            onClick={(event) => {
                              event.stopPropagation()
                              joinSession(session)
                            }}
                            type="button"
                          >
                            {alreadyJoined ? text.joined : remaining <= 0 ? text.full : busySessionId === session.id ? text.joining : text.joinSession}
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
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M12 5V16" />
                            <path d="M8 9L12 5L16 9" />
                            <path d="M5 13V18C5 19.1 5.9 20 7 20H17C18.1 20 19 19.1 19 18V13" />
                          </svg>
                        </button>
                        <button
                          className="secondary compact-expand"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setExpandedSessions((current) => ({ ...current, [session.id]: !current[session.id] }))
                          }}
                        >
                          {isExpanded ? text.hideDetails : text.expandDetails}
                        </button>
                      </div>
                    </div>
                    {hasCrownHolder && <p className="notice crown-session-notice">{text.topPlayerNotice}</p>}
                    {isExpanded && (
                      <div className="session-expanded">
                        {sessionClub && (
                          <div className="expanded-session-flags">
                            <span className="pill">{text.clubSession}: {sessionClub.name}</span>
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
                        <label>{text.playedGame}</label>
                        <select
                          value={confirmedGameDraft}
                          onChange={(event) => {
                            setConfirmedGameDrafts((current) => ({ ...current, [session.id]: event.target.value }))
                          }}
                        >
                          <option value="">{text.notConfirmed}</option>
                          {session.game_options.map((gameId) => {
                            const game = games.find((item) => item.id === gameId)
                            if (!game) return null
                            return <option key={game.id} value={game.id}>{game.title}</option>
                          })}
                        </select>
                        <button
                          className={busySessionId === session.id ? 'secondary small-button loading' : 'secondary small-button'}
                          disabled={busySessionId === session.id}
                          type="button"
                          onClick={() => confirmPlayedGame(session)}
                        >
                          {text.confirmPlayedGame}
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
                          {!session.club_id && (
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
                            <input value={editSessionName} onChange={(event) => setEditSessionName(event.target.value)} />
                          </div>
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
                            <label>{text.gameOptions} <span className="required">*</span></label>
                            <div className="game-picker compact-games">
                              {games.map((game) => (
                                <button
                                  className={editSelectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                                  key={game.id}
                                  onClick={() => toggleEditGame(game.id)}
                                  type="button"
                                >
                                  <img src={game.image} alt="" />
                                  <span>{game.title}</span>
                                  <strong>{game.category}</strong>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="full">
                            <label>{text.notes}</label>
                            <div className="format-toolbar">
                              <button type="button" onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('bold') }}>{text.formatBold}</button>
                              <button type="button" onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('italic') }}>{text.formatItalic}</button>
                              <button type="button" onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('underline') }}>{text.formatUnderline}</button>
                              <button type="button" onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('strikeThrough') }}>{text.formatStrike}</button>
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

                    <div className="players">
                      {participants.map((participant) => (
                        <div className="player result-player" key={participant.id} title={participant.display_name || text.player}>
                          <button
                            className={[
                              'player-avatar player-avatar-button',
                              participant.placement ? `place-${participant.placement}` : '',
                            ].join(' ').trim()}
                            onClick={() => openPlayerProfile(participant.profile_id, session.id)}
                            style={canSeeSessionPlayers ? avatarStyle(participant) : undefined}
                            type="button"
                          >
                            {canSeeSessionPlayers ? avatarNode(participant, 'P') : '?'}
                            {topPlayer?.profileId === participant.profile_id && <span className="champion-badge">👑</span>}
                            {participant.checked_in && <span className="check-badge">✓</span>}
                            {participant.placement && participant.placement <= 3 && <span className="cup-badge">{rankEmoji(participant.placement)}</span>}
                          </button>
                          <span className="player-name-line">
                            {canSeeSessionPlayers ? compactDisplayName(participant.display_name, text.player) : text.member}
                            {participant.profile_id === session.owner_id && <small>{text.host}</small>}
                          </span>
                          {(canManage || participant.profile_id === userId) && participant.payment_status && (
                            <small className="private-payment">
                              {participant.payment_status === 'cash' ? text.cash : participant.payment_status === 'bank_transfer' ? text.bankTransfer : text.free}
                              {participant.payment_amount ? ` · ${participant.payment_amount.toLocaleString('vi-VN')} đ` : ''}
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
                                    <button className="player-avatar player-avatar-button" onClick={() => openPlayerProfile(participant.profile_id, session.id)} style={avatarStyle(participant)} type="button">
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
                                      <span className="player-avatar tiny-avatar" style={avatarStyle(editorProfile)}>{avatarNode(editorProfile, 'E')}</span>
                                      <span>{compactDisplayName(editorProfile.nickname || editorProfile.full_name || editorProfile.email, text.player)}</span>
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
                                          <button className="player-avatar player-avatar-button" onClick={() => entryParticipant && openPlayerProfile(entryParticipant.profile_id, session.id)} style={avatarStyle(entryParticipant)} type="button">
                                            {avatarNode(entryParticipant, 'P')}
                                            {topPlayer?.profileId === entryParticipant?.profile_id && <span className="champion-badge">👑</span>}
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
                                            {topPlayer?.profileId === playerA?.profile_id && <span className="champion-badge">👑</span>}
                                          </span>
                                          <span>{participantName(session, match.participant_a_id)}</span>
                                        </button>
                                        <span className="versus">VS</span>
                                        <button className={match.winner_participant_id === match.participant_b_id ? 'match-player winner' : 'match-player'} disabled={!canEditTournament || !match.participant_b_id} type="button" onClick={() => updateTournamentMatch(match, { winner_participant_id: match.participant_b_id })}>
                                          <span className="player-avatar" style={avatarStyle(playerB)}>
                                            {avatarNode(playerB, 'P')}
                                            {topPlayer?.profileId === playerB?.profile_id && <span className="champion-badge">👑</span>}
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

                    <div className="game-strip">
                      {session.game_options.map((gameId) => {
                        const game = games.find((item) => item.id === gameId)
                        if (!game) return null

                        return (
                          <button
                            className={[
                              session.game_votes?.[userId] === gameId ? 'game-card selected' : 'game-card',
                              busyVoteKey === `${session.id}-${gameId}` ? 'loading' : '',
                            ].join(' ').trim()}
                            key={gameId}
                            disabled={busyVoteKey === `${session.id}-${gameId}` || !canMutatePastSession}
                            onClick={() => voteForGame(session, gameId)}
                            type="button"
                          >
                            <img src={game.image} alt="" />
                            <span>{game.title}</span>
                            <strong>{voteCount(session, gameId)} {voteCount(session, gameId) === 1 ? text.vote : text.votes}</strong>
                          </button>
                        )
                      })}
                    </div>

                    {!isPast && (
                    <div className="join-row">
                      {alreadyJoined && !isSessionOwner && canMutatePastSession && (
                        <button
                          className={busySessionId === session.id ? 'secondary loading' : 'secondary'}
                          disabled={busySessionId === session.id}
                          onClick={() => leaveSession(session)}
                          type="button"
                        >
                          {text.leaveSession}
                        </button>
                      )}
                      <button
                        aria-label={text.share}
                        className={sharedKey === session.id ? 'share-icon-button expanded-mobile-share copied' : 'share-icon-button expanded-mobile-share'}
                        title={text.share}
                        type="button"
                        onClick={() => shareLink(session.id, session.name, `#session-${session.id}`)}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M12 5V16" />
                          <path d="M8 9L12 5L16 9" />
                          <path d="M5 13V18C5 19.1 5.9 20 7 20H17C18.1 20 19 19.1 19 18V13" />
                        </svg>
                      </button>
                    </div>
                    )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
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
                  🔎
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
                    ×
                  </button>
                )}
              </div>
            </div>

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
            {clubStatus && <p className="notice">{clubStatus}</p>}

            <div className="club-list">
              {filteredClubs.length === 0 && <p className="notice">{text.noMatchingClubs}</p>}
              {filteredClubs.map((club) => {
                const members = club.club_members ?? []
                const approvedMembers = members.filter((member) => member.status === 'approved')
                const pendingMembers = members.filter((member) => member.status === 'pending')
                const membership = members.find((member) => member.profile_id === userId)
                const canManage = canManageClub(club)
                const canSeeMembers = club.visibility === 'public' || canManage

                return (
                  <article
                    className="club-card clickable"
                    key={club.id}
                    onClick={() => {
                      setSelectedClubId(club.id)
                      setSelectedClubDate('')
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="session-top">
                      <div>
                        <h3>{club.name}</h3>
                        <div className="row-meta">
                          <span className={club.visibility === 'private' ? 'pill private' : 'pill ok'}>
                            {club.visibility === 'private' ? text.private : text.public}
                          </span>
                          <span>{clubMemberCount(club)} {text.members}</span>
                          {membership?.status === 'pending' && <span className="pill">{text.pending}</span>}
                        </div>
                      </div>
                      {!membership && !canManage && (
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

                    {canSeeMembers ? (
                      <div className="players">
                        {approvedMembers.map((member) => (
                          <div className="player" key={member.id}>
                            <button
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

        {activeView === 'create' && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>{text.createSessionTitle}</h2>
                <p className="muted">{text.createSessionHint}</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="full">
                <label>{text.sessionName} <span className="required">*</span></label>
                <input placeholder={text.fridayPlaceholder} value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
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
                  <select value={sessionTime} onChange={(event) => setSessionTime(event.target.value)}>
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
                  <select value={sessionDuration} onChange={(event) => setSessionDuration(Number(event.target.value))}>
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
                  <select value={sessionMaxPlayers} onChange={(event) => handleMaxPlayersChange(Number(event.target.value))}>
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
                <label>{text.gameOptions} <span className="required">*</span></label>
                <div className="game-picker">
                  {games.map((game) => (
                    <button
                      className={selectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                      key={game.id}
                      onClick={() => toggleGame(game.id)}
                      type="button"
                    >
                      <img src={game.image} alt="" />
                      <span>{game.title}</span>
                      <strong>{game.category}</strong>
                    </button>
                  ))}
                </div>
              </div>
              <div className="full">
                <label>{text.notes}</label>
                <div className="format-toolbar">
                  <button type="button" onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('bold') }}>{text.formatBold}</button>
                  <button type="button" onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('italic') }}>{text.formatItalic}</button>
                  <button type="button" onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('underline') }}>{text.formatUnderline}</button>
                  <button type="button" onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('strikeThrough') }}>{text.formatStrike}</button>
                </div>
                <RichNotesEditor
                  value={sessionNotes}
                  onChange={setSessionNotes}
                  placeholder={text.notesPlaceholder}
                  resetKey={`create-${activeView}`}
                />
              </div>
            </div>

            <button className={isCreating ? 'primary loading create-button' : 'primary create-button'} disabled={isCreating} onClick={createSession}>
              {isCreating ? text.creating : sessionVisibility === 'private' ? text.createPrivateSession : text.createSession}
            </button>
            {createStatus && <p className="notice">{createStatus}</p>}
          </section>
        )}

        {activeView === 'profile' && (
          <section className="section">
            <h2>{text.profile}</h2>
            <p className="muted">
              {profile
                ? text.profileUpdateHint
                : text.profileLoginHint}
            </p>

            {!profile && (
              <div className="segmented auth-toggle">
                <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')} type="button">
                  {text.logIn}
                </button>
                <button className={authMode === 'create' ? 'active' : ''} onClick={() => setAuthMode('create')} type="button">
                  {text.createAccount}
                </button>
              </div>
            )}

            <div className={[
              'form-grid profile-form',
              !profile && authMode === 'login' ? 'login-profile-form' : '',
              !profile && authMode === 'create' ? 'create-profile-form' : '',
            ].join(' ').trim()}>
              {showProfileFields && (
                <div className="profile-photo-panel">
                  <label className="profile-photo-preview" style={{ background: avatarColor, color: avatarTextColor }}>
                    {avatarMode === 'photo' && (avatarPreview || profile?.avatar_url) ? (
                      <img src={avatarPreview || profile?.avatar_url || ''} alt="" />
                    ) : avatarMode === 'emoji' ? (
                      <span className="avatar-emoji">{avatarEmoji}</span>
                    ) : avatarMode === 'initials' ? (
                      <span className="avatar-text">{compactInitials(avatarInitials || displayName(profile))}</span>
                    ) : (
                      <span className="avatar-text">{displayName(profile).slice(0, 1)}</span>
                    )}
                    <input type="file" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                  <div>
                    <strong>{profile ? displayName(profile) : text.profilePhoto}</strong>
                    <span>{text.uploadPhoto}</span>
                  </div>
                  <div className="avatar-options">
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
                        <input maxLength={2} value={avatarEmoji} onChange={(event) => setAvatarEmoji(Array.from(event.target.value).slice(0, 2).join(''))} aria-label={text.avatarEmoji} />
                      </div>
                    )}
                    {avatarMode === 'initials' && (
                      <input maxLength={2} value={avatarInitials} onChange={(event) => setAvatarInitials(compactInitials(event.target.value))} placeholder="VR" aria-label={text.avatarInitials} />
                    )}
                    {avatarMode !== 'photo' && (
                      <>
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
                        {avatarMode === 'initials' && (
                          <>
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
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {showProfileFields && (
                <>
                  <div className="country-field">
                    <label>{text.countryCode} <span className="required">*</span></label>
                    <div className="country-picker">
                      <button
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
                    <label>{text.phoneNumber} <span className="required">*</span></label>
                    <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="0981152315" />
                  </div>
                </>
              )}
              <div className="email-field">
                <label>{text.email} <span className="required">*</span></label>
                <input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} placeholder="contact@vre-vietnam.com" />
              </div>
              {showProfileFields && (
                <div className="name-field">
                  <label>{text.name} <span className="required">*</span></label>
                  <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Nguyen Van A" />
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
              {!profile && authMode === 'create' && (
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
              {!profile && (
                <div className="password-field">
                  <label>{text.password} <span className="required">*</span></label>
                  <div className="password-control">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={profilePassword}
                      onChange={(event) => setProfilePassword(event.target.value)}
                      placeholder={text.passwordPlaceholder}
                    />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p className="field-help">{text.passwordHelp}</p>
                  {authMode === 'login' && (
                    <button className="link-button" disabled={isResettingPassword} onClick={sendPasswordReset} type="button">
                      {isResettingPassword ? text.saving : text.resetPassword}
                    </button>
                  )}
                </div>
              )}
              {!profile && (
                <div className="captcha-field">
                  <label>{text.captchaLabel} <span className="required">*</span></label>
                  <div className="captcha-box" ref={captchaContainerRef} />
                  <p className="field-help">{text.captchaHelp}</p>
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
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <button className="link-button" disabled={isResettingPassword} onClick={updatePasswordFromRecovery} type="button">
                    {isResettingPassword ? text.saving : text.updatePassword}
                  </button>
                </div>
              )}
            </div>

            <div className="action-row">
              <button
                className={isSavingProfile ? 'primary loading create-button' : 'primary create-button'}
                disabled={isSavingProfile}
                onClick={profile ? saveProfile : handleAuth}
              >
                {isSavingProfile
                  ? authMode === 'login'
                    ? text.loggingIn
                    : profile
                      ? text.saving
                      : text.creating
                  : profile
                    ? text.saveProfile
                    : authMode === 'login'
                      ? text.logIn
                      : text.createAccount}
              </button>
              {profile && (
                <button className="secondary create-button" onClick={logout} type="button">
                  {text.logOut}
                </button>
              )}
            </div>
            {profile && (
              <div className="account-links">
                <button className="link-button" disabled={isResettingPassword} onClick={sendPasswordReset} type="button">
                  {isResettingPassword ? text.saving : text.resetPassword}
                </button>
                <button className="link-button danger-link" disabled={isDeletingAccount} onClick={deleteMyAccount} type="button">
                  {isDeletingAccount ? text.saving : text.deleteAccount}
                </button>
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
                <h3>{text.stats} {topPlayer?.profileId === userId ? '🏆' : ''}</h3>
                {topPlayer?.profileId === userId && <p className="notice">{text.bestPlayer}</p>}
                <div className="stats">
                  <span>{playerStats.gamesJoined} {text.gamesCheckedIn}</span>
                  <span>{playerStats.wins} {text.wins}</span>
                  <span>{playerStats.totalScore} {text.totalScore}</span>
                  <span>{playerStats.averageAccuracy ?? '-'}% {text.accuracy}</span>
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

                {mySessions.length === 0 ? (
                  <p className="notice">{text.noSessionsYet}</p>
                ) : (
                  <div className="mini-session-list">
                    {mySessions.map((session) => {
                      const participants = session.session_participants ?? []
                      const createdByMe = session.owner_id === userId
                      const canManage = canManageSession(session)
                      const joinedByMe = participants.some((participant) => participant.profile_id === userId)
                      const canSeeInviteCode = session.visibility === 'private' && session.invite_code && (canManage || joinedByMe)
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
                            <img className="mini-session-image" src={coverGame.image} alt="" />
                            <strong>{session.name}</strong>
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
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

      </main>

      {loginPromptOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="login-prompt-title">
          <div className="login-modal">
            <button className="modal-close" type="button" onClick={() => setLoginPromptOpen(false)} aria-label={text.close}>
              ×
            </button>
            <h3 id="login-prompt-title">{text.loginPromptTitle}</h3>
            <p>{text.loginPromptMessage}</p>
            <button className="primary create-button" type="button" onClick={goToLogin}>
              {text.loginPromptButton}
            </button>
          </div>
        </div>
      )}

      {selectedClub && (
        <div className="club-drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="club-drawer-title" onClick={() => setSelectedClubId('')}>
          <div
            className="club-drawer"
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
          >
            <div className="drawer-handle" />
            <div className="session-top">
              <div>
                <h2 id="club-drawer-title">{selectedClub.name}</h2>
                <div className="row-meta">
                  <span className={selectedClub.visibility === 'private' ? 'pill private' : 'pill ok'}>
                    {selectedClub.visibility === 'private' ? text.private : text.public}
                  </span>
                  <span>{clubMemberCount(selectedClub)} {text.members}</span>
                </div>
              </div>
              <button className="secondary small-button" type="button" onClick={() => setSelectedClubId('')}>
                {text.close}
              </button>
            </div>

            {selectedClub.description && <p className="notes">{selectedClub.description}</p>}

            <div className="club-action-row">
              {!selectedClubMembership && (
                <button
                  className={busyClubId === selectedClub.id ? 'primary loading create-button' : 'primary create-button'}
                  disabled={busyClubId === selectedClub.id}
                  onClick={() => joinClub(selectedClub)}
                  type="button"
                >
                  {selectedClub.visibility === 'private' ? text.requestJoin : text.joinClub}
                </button>
              )}

              {sessionClubOptions.some((club) => club.id === selectedClub.id) && (
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

            {selectedClubMembership?.status === 'pending' && (
              <p className="notice">{text.requestSent}</p>
            )}

            <div className="drawer-block">
              <h3>{text.members}</h3>
              {canSeeClubPrivateData(selectedClub) ? (
                <div className="players">
                  {(selectedClub.club_members ?? [])
                    .filter((member) => member.status === 'approved')
                    .map((member) => (
                      <div className="player" key={member.id}>
                        <button className="player-avatar player-avatar-button" onClick={() => openPlayerProfile(member.profile_id)} style={avatarStyle(member)} type="button">
                          {avatarNode(member, 'P')}
                        </button>
                        <span>{compactDisplayName(member.display_name, text.player)}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="notice">{text.hiddenMembers}</p>
              )}
            </div>

            <div className="drawer-block">
              <div className="section-head compact-head">
                <div>
                  <h3>{text.nextGames}</h3>
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
                <p className="notice">{text.noClubGames}</p>
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
                          <img className="compact-session-image" src={coverGame.image} alt="" />
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
                              {text.expandDetails}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPlayerProfile && (
        <div className="club-drawer-backdrop player-profile-backdrop" role="dialog" aria-modal="true" aria-labelledby="player-profile-title" onClick={closePlayerProfile}>
          <div className="player-profile-panel" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="modal-close" type="button" onClick={closePlayerProfile} aria-label={text.close}>
              ×
            </button>
            <div className="player-profile-head">
              <div
                className={topPlayer?.profileId === selectedPlayerProfile.profileId ? 'player-avatar profile-large champion-avatar' : 'player-avatar profile-large'}
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
                {topPlayer?.profileId === selectedPlayerProfile.profileId && <span className="champion-badge">👑</span>}
              </div>
              <div>
                <h3 id="player-profile-title">{compactDisplayName(selectedPlayerProfile.displayName, text.player)}</h3>
                {selectedPlayerProfile.profileMotto && <p className="player-motto">{selectedPlayerProfile.profileMotto}</p>}
                {topPlayer?.profileId === selectedPlayerProfile.profileId && <span className="pill ok">{text.bestOverall}</span>}
              </div>
            </div>
            <div className="stats">
              <span>{selectedPlayerProfile.gamesJoined} {text.gamesCheckedIn}</span>
              <span>{selectedPlayerProfile.wins} {text.wins}</span>
              <span>{selectedPlayerProfile.totalScore} {text.totalScore}</span>
              <span>{selectedPlayerProfile.averageAccuracy ?? '-'}% {text.accuracy}</span>
              <span>{selectedPlayerProfile.totalProjectiles} {text.projectiles}</span>
            </div>
            {selectedPlayerProfile.bestByGame.length > 0 && (
              <div className="best-score-list">
                <strong>{text.bestScores}</strong>
                {selectedPlayerProfile.bestByGame.map((item) => (
                  <span key={item.game}>{item.game}: {item.score}</span>
                ))}
              </div>
            )}
            {selectedPlayerManageContext && (
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
            )}
          </div>
        </div>
      )}

      {championLoginOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="champion-title">
          <div className="login-modal champion-modal">
            <button className="modal-close" type="button" onClick={() => setChampionLoginOpen(false)} aria-label={text.close}>
              ×
            </button>
            <div className="champion-spark">👑</div>
            <h3 id="champion-title">{text.bestOverall}</h3>
            <p>{text.bestPlayerLogin}</p>
            <button className="primary" type="button" onClick={() => setChampionLoginOpen(false)}>
              {text.close}
            </button>
          </div>
        </div>
      )}

      {checkInParticipant && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
          <div className="login-modal">
            <button className="modal-close" type="button" onClick={() => setCheckInTarget(null)} aria-label={text.close}>
              ×
            </button>
            <h3 id="checkin-title">{text.checkIn}</h3>
            <p>{compactDisplayName(checkInParticipant.display_name, text.player)}</p>
            <div className="payment-grid">
              <button className={checkInPaymentStatus === 'cash' ? 'secondary active' : 'secondary'} type="button" onClick={() => setCheckInPaymentStatus('cash')}>
                {text.cash}
              </button>
              <button className={checkInPaymentStatus === 'bank_transfer' ? 'secondary active' : 'secondary'} type="button" onClick={() => setCheckInPaymentStatus('bank_transfer')}>
                {text.bankTransfer}
              </button>
              <button className={checkInPaymentStatus === 'free' ? 'secondary active' : 'secondary'} type="button" onClick={() => updateParticipantCheckIn(checkInParticipant.id, 'free')}>
                {text.free}
              </button>
              {(checkInPaymentStatus === 'cash' || checkInPaymentStatus === 'bank_transfer') && (
                <label className="amount-field">
                  <span>{text.paymentAmount}</span>
                  <div>
                    <input
                      inputMode="numeric"
                      value={checkInPaymentAmount}
                      onChange={(event) => setCheckInPaymentAmount(event.target.value.replace(/[^\d]/g, ''))}
                      placeholder="0"
                    />
                    <strong>đ</strong>
                  </div>
                </label>
              )}
              {(checkInPaymentStatus === 'cash' || checkInPaymentStatus === 'bank_transfer') && (
                <button className="primary" type="button" onClick={() => updateParticipantCheckIn(checkInParticipant.id, checkInPaymentStatus, checkInPaymentAmount)}>
                  {text.saveChanges}
                </button>
              )}
              {checkInParticipant.checked_in && (
                <button className="danger" type="button" onClick={() => updateParticipantCheckIn(checkInParticipant.id, null)}>
                  {text.clearCheckIn}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(body) {
          margin: 0;
          background: #f6f7f9;
          color: #071112;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .app {
          --avatar-xs: 34px;
          --avatar-xs-emoji: 26px;
          --avatar-xs-text: 16px;
          --avatar-sm: 42px;
          --avatar-sm-emoji: 33px;
          --avatar-sm-text: 18px;
          --avatar-md: 58px;
          --avatar-md-emoji: 45px;
          --avatar-md-text: 27px;
          --avatar-lg: 78px;
          --avatar-lg-emoji: 61px;
          --avatar-lg-text: 36px;
          height: 100vh;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          overflow: hidden;
        }

        aside {
          background: #ffffff;
          border-right: 1px solid rgba(7, 17, 18, 0.12);
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          height: 100vh;
          box-sizing: border-box;
          overflow-y: auto;
        }

        main {
          padding: 22px;
          height: 100vh;
          box-sizing: border-box;
          overflow-y: auto;
          scroll-behavior: smooth;
        }

        h1, h2, h3, p {
          margin: 0;
        }

        button {
          touch-action: manipulation;
        }

        h1 {
          font-size: 24px;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .brand-logo {
          display: block;
          width: min(156px, 72%);
          max-width: 156px;
          line-height: 0;
          color: inherit;
          text-decoration: none;
        }

        .brand-logo picture {
          display: block;
        }

        .brand-logo img {
          display: block;
          width: 100%;
          height: auto;
        }

        h2 {
          font-size: 19px;
          margin-bottom: 8px;
        }

        h3 {
          font-size: 18px;
        }

        .muted {
          color: #637075;
          font-size: 13px;
          line-height: 1.4;
        }

        .section {
          position: relative;
          background: #ffffff;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 10px 22px rgba(7, 17, 18, 0.08);
        }

        .sessions-section {
          border: 0;
          background: transparent;
          padding: 0;
          box-shadow: none;
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .search-shell {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
        }

        .search-close {
          display: inline-grid;
          place-items: center;
          width: 34px;
          height: 34px;
          min-height: 34px;
          border-radius: 999px;
          border: 1px solid rgba(7, 17, 18, 0.14);
          background: #ffffff;
          color: #071112;
          font-size: 20px;
          font-weight: 800;
          padding: 0;
        }

        .day-strip {
          position: absolute;
          top: 70px;
          right: 16px;
          z-index: 35;
          display: flex;
          gap: 8px;
          width: min(560px, calc(100% - 32px));
          max-width: calc(100vw - 32px);
          overflow-x: auto;
          overscroll-behavior-x: contain;
          box-sizing: border-box;
          padding: 8px;
          margin: 0;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(11, 21, 24, 0.14);
          scrollbar-width: thin;
        }

        .day-chip {
          flex: 0 0 auto;
          display: grid;
          gap: 1px;
          min-width: 58px;
          min-height: 48px;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          background: #f0f4f6;
          color: #071112;
          text-align: center;
        }

        .day-chip span {
          color: #637075;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .day-chip strong {
          font-size: 13px;
        }

        .day-chip.active {
          color: #ffffff;
          border-color: transparent;
          background: linear-gradient(135deg, #13c9c9, #3059ff);
        }

        .day-chip.active span {
          color: rgba(255, 255, 255, 0.82);
        }

        .mobile-search-toggle {
          display: none;
        }

        .app-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .language-picker {
          position: relative;
          z-index: 80;
          width: fit-content;
          max-width: 100%;
        }

        .language-picker > button,
        .language-menu button {
          min-height: 34px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 999px;
          background: #ffffff;
          color: #071112;
          padding: 6px 11px;
          font-size: 12px;
          font-weight: 900;
          transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease;
          white-space: nowrap;
        }

        .language-picker > button:hover,
        .language-menu button:hover {
          transform: translateY(-1px) scale(1.03);
          border-color: rgba(48, 89, 255, 0.38);
        }

        .language-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 60;
          display: flex;
          gap: 6px;
          width: min(236px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
          max-width: min(236px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
          overflow-x: auto;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 999px;
          background: #ffffff;
          padding: 6px;
          scroll-padding-inline: 8px;
          box-shadow: 0 12px 32px rgba(11, 21, 24, 0.14);
          animation: languagePickerIn 160ms ease-out;
        }

        .language-menu button {
          flex: 0 0 auto;
          min-width: 44px;
          background: transparent;
        }

        .language-menu button.active {
          background: #071112;
          border-color: #071112;
          color: #ffffff;
        }

        @keyframes languagePickerIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .profile-chip {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          width: 100%;
          text-align: left;
          color: #071112;
          background: #ffffff;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 10px;
          cursor: pointer;
        }

        .profile-chip:hover {
          background: #f0f4f6;
          color: #071112;
          box-shadow: 0 12px 26px rgba(11, 21, 24, 0.12);
        }

        .profile-chip.active {
          border-color: rgba(48, 89, 255, 0.28);
          box-shadow: inset 0 0 0 1px rgba(48, 89, 255, 0.14);
        }

        .profile-chip strong,
        .profile-chip span:not(.avatar-text):not(.avatar-emoji):not(.avatar-photo) {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-chip span:not(.avatar-text):not(.avatar-emoji):not(.avatar-photo) {
          color: #637075;
          font-size: 12px;
        }

        .field-help {
          color: #637075;
          font-size: 12px;
          line-height: 1.35;
          margin-top: 6px;
        }

        .date-input-shell {
          position: relative;
          min-height: 46px;
          display: block;
          border: 1px solid rgba(7, 17, 18, 0.16);
          border-radius: 14px;
          background: #ffffff;
        }

        .date-input-native {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          min-height: 46px;
          opacity: 0;
          color: transparent;
          -webkit-text-fill-color: transparent;
          z-index: 2;
          cursor: pointer;
        }

        .date-input-native::-webkit-date-and-time-value {
          color: transparent;
          -webkit-text-fill-color: transparent;
        }

        .date-input-display {
          position: absolute;
          top: 50%;
          left: 11px;
          right: 42px;
          transform: translateY(-50%);
          pointer-events: none;
          overflow: hidden;
          color: #071112;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
          z-index: 1;
        }

        .date-input-display.placeholder {
          color: #8a9498;
          font-weight: 700;
        }

        .date-input-shell:focus-within {
          border-color: rgba(48, 89, 255, 0.58);
          box-shadow: 0 0 0 3px rgba(48, 89, 255, 0.12);
        }

        .link-button {
          display: inline-flex;
          width: fit-content;
          min-height: auto;
          margin-top: 8px;
          border: 0;
          background: transparent;
          color: #3059ff;
          padding: 0;
          font-size: 12px;
          font-weight: 800;
          text-align: left;
          text-decoration: underline;
        }

        .share-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 30px;
          border: 1px solid rgba(48, 89, 255, 0.18);
          border-radius: 999px;
          background: #f5f8ff;
          color: #3059ff;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .share-button.copied {
          border-color: rgba(13, 124, 81, 0.28);
          background: #e9f8f1;
          color: #0d7c51;
        }

        .share-icon-button {
          display: inline-grid;
          place-items: center;
          flex: 0 0 auto;
          width: 44px;
          height: 44px;
          min-height: 44px;
          border: 1px solid rgba(48, 89, 255, 0.18);
          border-radius: 8px;
          background: #f5f8ff;
          color: #3059ff;
          padding: 0;
        }

        .share-icon-button svg {
          width: 21px;
          height: 21px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .share-icon-button.copied {
          border-color: rgba(13, 124, 81, 0.28);
          background: #e9f8f1;
          color: #0d7c51;
        }

        .danger-link {
          color: #b42318;
        }

        .account-links {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .my-sessions {
          display: grid;
          gap: 12px;
          border-top: 1px solid rgba(7, 17, 18, 0.12);
          margin-top: 18px;
          padding-top: 18px;
        }

        .mini-session-list {
          display: grid;
          gap: 10px;
        }

        .mini-session {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 12px;
          background: #ffffff;
        }

        .mini-session.clickable {
          cursor: pointer;
        }

        .mini-session.clickable:hover {
          border-color: rgba(48, 89, 255, 0.35);
          box-shadow: 0 10px 26px rgba(11, 21, 24, 0.08);
        }

        .mini-session-title {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
        }

        .mini-session-title-with-image {
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) auto;
          align-items: center;
        }

        .mini-session-title-with-image strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mini-session-image {
          width: 42px;
          height: 42px;
          border-radius: 7px;
          object-fit: cover;
          background: #071112;
        }

        .mini-session-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .profile-photo-panel {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 12px;
          background: #ffffff;
        }

        .profile-photo-panel strong,
        .profile-photo-panel span {
          display: block;
        }

        .profile-photo-panel span {
          color: #637075;
          font-size: 13px;
          margin-top: 4px;
        }

        .profile-photo-preview {
          --avatar-size: var(--avatar-lg);
          --avatar-emoji-size: var(--avatar-lg-emoji);
          --avatar-text-size: var(--avatar-lg-text);
          width: var(--avatar-size);
          height: var(--avatar-size);
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(135deg, #00cbd1, #3059ff);
          font-size: 30px;
          font-weight: 900;
          cursor: pointer;
        }

        .profile-photo-preview :global(.avatar-emoji) {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: inherit;
          font-size: var(--avatar-emoji-size);
          line-height: 1;
          margin: 0;
          transform: translateY(-1px);
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif;
        }

        .profile-photo-preview :global(.avatar-text) {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: inherit;
          font-size: var(--avatar-text-size);
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.04em;
          margin: 0;
          transform: translateY(-1px);
        }

        .profile-photo-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
          clip-path: circle(50% at 50% 50%);
        }

        .profile-photo-preview input {
          display: none;
        }

        .avatar-options {
          grid-column: 1 / -1;
          display: grid;
          gap: 8px;
        }

        .compact-segmented {
          width: fit-content;
        }

        .emoji-row,
        .color-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .emoji-row {
          max-width: 100%;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
          padding: 2px 2px 6px;
          scrollbar-width: thin;
        }

        .color-row {
          flex-wrap: wrap;
        }

        .emoji-row button,
        .color-row button {
          flex: 0 0 auto;
          width: 36px;
          height: 36px;
          min-height: 36px;
          border-radius: 999px;
          padding: 0;
          border: 1px solid rgba(7, 17, 18, 0.14);
          background: #ffffff;
          display: grid;
          place-items: center;
          font-size: 20px;
        }

        .emoji-row button.active,
        .color-row button.active {
          box-shadow: 0 0 0 3px rgba(48, 89, 255, 0.22);
          border-color: #3059ff;
        }

        .emoji-row input,
        .avatar-options input {
          max-width: 150px;
        }

        .custom-color-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: end;
        }

        .custom-color-row label {
          display: grid;
          gap: 4px;
          color: #637075;
          font-size: 12px;
          font-weight: 800;
        }

        .custom-color-row input[type="color"] {
          width: 42px;
          height: 36px;
          min-height: 36px;
          padding: 3px;
          border-radius: 8px;
        }

        .custom-color-row .hex-field input {
          width: 116px;
          max-width: 116px;
          min-height: 36px;
          padding: 7px 9px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          text-transform: lowercase;
        }

        .avatar,
        .player-avatar {
          --avatar-size: var(--avatar-sm);
          --avatar-emoji-size: var(--avatar-sm-emoji);
          --avatar-text-size: var(--avatar-sm-text);
          position: relative;
          width: var(--avatar-size);
          height: var(--avatar-size);
          min-width: var(--avatar-size);
          min-height: var(--avatar-size);
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: visible;
          background: linear-gradient(135deg, #00cbd1, #3059ff);
          color: #ffffff;
          font-weight: 800;
          line-height: 1;
          padding: 0;
          isolation: isolate;
        }

        :global(.avatar-text),
        :global(.avatar-emoji),
        :global(.avatar-photo) {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          line-height: 1;
          text-align: center;
        }

        :global(.avatar-emoji) {
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif;
          font-size: var(--avatar-emoji-size);
          line-height: 1;
          margin: 0;
          transform: translateY(-0.02em);
        }

        :global(.avatar-text) {
          font-size: var(--avatar-text-size);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0;
          margin: 0;
        }

        .player-avatar {
          --avatar-size: var(--avatar-md);
          --avatar-emoji-size: var(--avatar-md-emoji);
          --avatar-text-size: var(--avatar-md-text);
        }

        .player-avatar.tiny-avatar {
          --avatar-size: var(--avatar-xs);
          --avatar-emoji-size: var(--avatar-xs-emoji);
          --avatar-text-size: var(--avatar-xs-text);
        }

        .player-avatar.profile-large {
          --avatar-size: var(--avatar-lg);
          --avatar-emoji-size: var(--avatar-lg-emoji);
          --avatar-text-size: var(--avatar-lg-text);
        }

        .avatar-photo {
          position: absolute;
          inset: 0;
          display: block;
          width: 100% !important;
          height: 100% !important;
          min-width: 100%;
          min-height: 100%;
          z-index: 0;
          overflow: hidden !important;
          border-radius: 999px !important;
          clip-path: circle(50% at 50% 50%);
          -webkit-mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
          mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
        }

        .avatar-photo img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100% !important;
          height: 100% !important;
          min-width: 100%;
          min-height: 100%;
          max-width: none;
          object-fit: cover !important;
          object-position: center center !important;
          border: 0;
          border-radius: 999px !important;
          clip-path: circle(50% at 50% 50%);
          -webkit-mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
          mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
        }

        .champion-badge {
          position: absolute;
          right: -8px;
          top: -10px;
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #ffffff;
          font-size: 18px;
          box-shadow: 0 2px 6px rgba(11, 21, 24, 0.16);
          animation: crownBob 1.8s ease-in-out infinite;
          z-index: 3;
        }

        @keyframes crownBob {
          0%, 100% { transform: rotate(-8deg) translateY(0); }
          50% { transform: rotate(8deg) translateY(-2px); }
        }

        .avatar > img,
        .player-avatar > img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100% !important;
          height: 100% !important;
          max-width: none;
          object-fit: cover !important;
          object-position: center center !important;
          border-radius: 999px !important;
          clip-path: circle(50% at 50% 50%);
          -webkit-mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
          mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
          z-index: 0;
        }

        .shop-contact {
          display: grid;
          gap: 7px;
          margin-top: auto;
          border-top: 1px solid rgba(7, 17, 18, 0.12);
          padding-top: 16px;
          font-size: 13px;
        }

        .shop-contact strong {
          font-size: 14px;
        }

        .shop-contact a {
          color: #3059ff;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .shop-contact a:hover {
          text-decoration: underline;
        }

        .profile-mobile-contact {
          display: none;
        }

        .tabs {
          display: grid;
          gap: 8px;
        }

        .tab,
        .segmented button {
          text-align: left;
          background: transparent;
          color: #071112;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 10px 13px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .tab.active,
        .segmented button.active {
          background: #f0f4f6;
          border-color: rgba(7, 17, 18, 0.12);
        }

        .segmented {
          display: inline-flex;
          gap: 4px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 4px;
        }

        .auth-toggle {
          margin: 14px 0;
        }

        .search {
          max-width: 360px;
        }

        .club-list {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .club-card {
          display: grid;
          gap: 12px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 14px;
          background: #ffffff;
        }

        .pending-list {
          display: grid;
          gap: 8px;
          border-top: 1px solid rgba(7, 17, 18, 0.08);
          padding-top: 10px;
        }

        .pending-member {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-radius: 8px;
          background: #f0f4f6;
          padding: 8px 10px;
          font-weight: 800;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(7, 17, 18, 0.32);
        }

        .login-modal {
          position: relative;
          width: min(420px, 100%);
          display: grid;
          gap: 12px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 20px;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(11, 21, 24, 0.2);
        }

        .login-modal p {
          color: #637075;
          line-height: 1.45;
        }

        .payment-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .payment-grid .active {
          border-color: #3059ff;
          box-shadow: 0 0 0 2px rgba(48, 89, 255, 0.14);
        }

        .amount-field {
          grid-column: 1 / -1;
          display: grid;
          gap: 6px;
        }

        .amount-field div {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
        }

        .private-payment {
          color: #637075;
          font-size: 11px;
          font-weight: 800;
        }

        .player-profile-panel {
          position: relative;
          width: min(420px, 100%);
          display: grid;
          gap: 12px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 12px;
          background: #ffffff;
          color: #071112;
          padding: 18px;
          box-shadow: 0 28px 80px rgba(11, 21, 24, 0.22);
        }

        .player-profile-head {
          display: grid;
          gap: 10px;
          align-items: center;
          justify-items: center;
          text-align: center;
        }

        .player-profile-head h3 {
          margin: 0;
          color: inherit;
        }

        .player-motto {
          margin: 3px 0 0;
          color: #637075;
          font-size: 13px;
          font-weight: 800;
        }

        .champion-modal {
          text-align: center;
        }

        .champion-spark {
          font-size: 44px;
          animation: crownBob 1.1s ease-in-out infinite;
        }

        .profile-large {
          width: var(--avatar-lg);
          height: var(--avatar-lg);
          min-width: var(--avatar-lg);
          min-height: var(--avatar-lg);
          font-size: 26px;
        }

        .champion-avatar {
          box-shadow: 0 0 0 3px #f6c244;
        }

        .podium-row {
          display: grid;
          gap: 8px;
          max-width: 100%;
          padding: 6px 0 2px;
        }

        .podium-player {
          display: inline-grid;
          gap: 5px;
          align-items: center;
          justify-items: center;
          min-width: 0;
          min-height: 72px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 10px;
          background: #ffffff;
          color: #071112;
          padding: 7px;
          font-weight: 900;
          text-align: center;
        }

        .podium-player strong {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .podium-pyramid {
          grid-template-columns: repeat(3, minmax(0, 110px));
          align-items: end;
          justify-content: center;
        }

        .podium-rank-1 {
          min-height: 92px;
          transform: translateY(-8px);
        }

        .podium-rank-2 {
          min-height: 78px;
        }

        .podium-rank-3 {
          min-height: 68px;
        }

        .podium-medal {
          font-size: 16px;
          line-height: 1;
        }

        .tiny-avatar {
          --avatar-size: var(--avatar-xs);
          --avatar-emoji-size: var(--avatar-xs-emoji);
          --avatar-text-size: var(--avatar-xs-text);
          width: var(--avatar-xs);
          height: var(--avatar-xs);
          font-size: 12px;
        }

        .best-score-list,
        .player-stats {
          display: grid;
          gap: 8px;
        }

        .best-score-list {
          margin-top: 8px;
          color: #637075;
          font-size: 13px;
        }

        .club-drawer-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: grid;
          place-items: end center;
          padding: 20px;
          background: rgba(7, 17, 18, 0.34);
        }

        .club-drawer {
          width: min(860px, 100%);
          max-height: min(78vh, 760px);
          overflow-y: auto;
          display: grid;
          gap: 14px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 14px 14px 8px 8px;
          background: #ffffff;
          padding: 16px;
          box-shadow: 0 28px 80px rgba(11, 21, 24, 0.22);
          animation: drawerUp 180ms ease-out;
        }

        .drawer-handle {
          justify-self: center;
          width: 46px;
          height: 5px;
          border-radius: 999px;
          background: rgba(7, 17, 18, 0.18);
        }

        .drawer-block {
          display: grid;
          gap: 10px;
          border-top: 1px solid rgba(7, 17, 18, 0.08);
          padding-top: 12px;
        }

        .club-action-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .club-action-row .create-button {
          width: auto;
          min-width: min(220px, 100%);
          margin-top: 0;
        }

        .drawer-days {
          position: static;
          width: 100%;
          max-width: 100%;
          border-radius: 999px;
          box-shadow: none;
        }

        .club-session-preview {
          border: 1px solid rgba(7, 17, 18, 0.1);
          border-radius: 8px;
          background: #ffffff;
          padding: 8px;
          transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
        }

        .club-session-preview:hover {
          border-color: rgba(48, 89, 255, 0.22);
          box-shadow: 0 10px 24px rgba(11, 21, 24, 0.08);
          transform: translateY(-1px);
        }

        .club-session-card {
          grid-template-columns: 50px minmax(0, 1fr) auto;
        }

        .club-session-actions {
          align-self: center;
        }

        @keyframes drawerUp {
          from {
            transform: translateY(24px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 34px;
          height: 34px;
          display: inline-grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #637075;
          font-size: 24px;
          line-height: 1;
        }

        .list {
          display: grid;
          gap: 10px;
        }

        .session {
          display: grid;
          gap: 10px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 10px;
          background: #ffffff;
          transform-origin: top center;
          transition:
            border-color 180ms ease,
            box-shadow 220ms ease,
            transform 260ms cubic-bezier(0.18, 0.82, 0.24, 1);
        }

        .session:last-child {
          border-bottom: 1px solid rgba(7, 17, 18, 0.12);
        }

        .expanded-session {
          box-shadow: 0 14px 34px rgba(11, 21, 24, 0.08);
          animation: sessionShellBloom 280ms cubic-bezier(0.18, 0.82, 0.24, 1);
        }

        .sub-tabs {
          display: inline-flex;
          width: fit-content;
          gap: 4px;
          padding: 4px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 999px;
          background: #ffffff;
        }

        .sub-tabs button {
          min-height: 34px;
          padding: 6px 12px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #071112;
          font-weight: 800;
        }

        .sub-tabs button.active {
          background: #071112;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(11, 21, 24, 0.14);
        }

        .compact-session-card {
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
          cursor: pointer;
          border-radius: 8px;
          touch-action: manipulation;
          max-height: 220px;
          opacity: 1;
          overflow: hidden;
          transform: translateY(0) scale(1);
          transition:
            max-height 280ms cubic-bezier(0.18, 0.82, 0.24, 1),
            opacity 180ms ease,
            transform 280ms cubic-bezier(0.18, 0.82, 0.24, 1),
            margin 280ms cubic-bezier(0.18, 0.82, 0.24, 1);
        }

        .compact-session-card-hidden {
          max-height: 0;
          margin: -6px 0;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-8px) scale(0.975);
        }

        .compact-session-card-expanded {
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(7, 17, 18, 0.08);
        }

        .compact-session-card:focus-visible {
          outline: 3px solid rgba(48, 89, 255, 0.35);
          outline-offset: 4px;
        }

        .compact-session-image {
          width: 58px;
          height: 58px;
          border-radius: 7px;
          object-fit: cover;
          background: #071112;
        }

        .compact-session-main {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .compact-session-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .compact-session-title-row h3 {
          min-width: 0;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 18px;
        }

        .compact-meta {
          gap: 5px;
        }

        .compact-session-actions {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
          flex-wrap: wrap;
        }

        .compact-join,
        .compact-expand {
          min-height: 34px;
          padding: 6px 10px;
          font-size: 13px;
        }

        .compact-code {
          width: 92px;
          min-height: 34px;
          padding: 6px 8px;
          font-size: 13px;
        }

        .compact-share {
          width: 34px;
          height: 34px;
        }

        .compact-share svg {
          width: 18px;
          height: 18px;
        }

        .expanded-mobile-share {
          display: none;
        }

        .session-expanded {
          animation: sessionExpandIn 280ms cubic-bezier(0.18, 0.82, 0.24, 1);
          transform-origin: top center;
        }

        @keyframes sessionExpandIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.992);
            filter: blur(2px);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes sessionShellBloom {
          from {
            transform: translateY(4px) scale(0.996);
          }

          to {
            transform: translateY(0) scale(1);
          }
        }

        .confirm-game-panel {
          display: grid;
          grid-template-columns: minmax(150px, 220px) minmax(180px, 1fr) auto;
          gap: 8px;
          align-items: end;
          padding: 10px;
          border: 1px solid rgba(7, 17, 18, 0.1);
          border-radius: 8px;
          background: #f8fafb;
        }

        .confirm-game-panel label {
          color: #637075;
          font-size: 13px;
          font-weight: 900;
        }

        .session-expanded {
          display: grid;
          gap: 12px;
          padding-top: 8px;
        }

        .expanded-session-flags {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .host-pill {
          background: rgba(48, 89, 255, 0.1);
          color: #3059ff;
        }

        .hide-expanded-button {
          min-height: 30px;
          padding: 5px 9px;
        }

        .session-top,
        .join-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .session-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .manage-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .edit-panel {
          display: grid;
          gap: 12px;
          border: 1px solid rgba(48, 89, 255, 0.2);
          border-radius: 8px;
          background: #f8fbff;
          padding: 12px;
        }

        .compact-head {
          margin-bottom: 0;
        }

        .row-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          color: #637075;
          font-size: 13px;
          margin-top: 6px;
        }

        .notes {
          color: #465358;
          font-size: 13px;
          white-space: pre-wrap;
        }

        .notes-block {
          display: grid;
          gap: 4px;
        }

        .notes-block:not(.expanded) .notes {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .expand-note {
          width: fit-content;
          min-height: auto;
          border: 0;
          background: transparent;
          color: #3059ff;
          padding: 0;
          font-size: 12px;
          font-weight: 900;
        }

        .format-toolbar {
          display: inline-flex;
          gap: 4px;
          margin: 0 0 6px;
        }

        .format-toolbar button {
          display: inline-grid;
          place-items: center;
          width: 30px;
          height: 28px;
          min-height: 28px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 7px;
          background: #ffffff;
          color: #071112;
          padding: 0;
          font-size: 12px;
          font-weight: 900;
          box-shadow: 0 1px 0 rgba(7, 17, 18, 0.08);
        }

        .format-toolbar button:nth-child(2) {
          font-style: italic;
        }

        .format-toolbar button:nth-child(3) {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .format-toolbar button:nth-child(4) {
          text-decoration: line-through;
        }

        .format-toolbar button:hover,
        .format-toolbar button:focus-visible {
          transform: translateY(-1px) scale(1.03);
          border-color: rgba(48, 89, 255, 0.42);
        }

        .format-toolbar button:active {
          background: linear-gradient(135deg, #13c9c9, #3059ff);
          color: #ffffff;
          border-color: transparent;
          transform: translateY(0) scale(0.98);
        }

        .rich-note-editor {
          min-height: 86px;
          width: 100%;
          border: 2px solid rgba(7, 17, 18, 0.22);
          border-radius: 8px;
          background: #ffffff;
          color: #071112;
          padding: 10px 12px;
          font: inherit;
          line-height: 1.35;
          outline: none;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          box-shadow: inset 0 0 0 1px rgba(7, 17, 18, 0.08);
        }

        .rich-note-editor:focus {
          border-color: #3059ff;
          box-shadow: 0 0 0 3px rgba(48, 89, 255, 0.14), inset 0 0 0 1px rgba(48, 89, 255, 0.16);
        }

        .rich-note-editor:empty::before {
          content: attr(data-placeholder);
          color: #8a9498;
        }

        .invite-code {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          border: 1px solid rgba(48, 89, 255, 0.18);
          border-radius: 8px;
          background: #f5f8ff;
          padding: 9px 10px;
          color: #465358;
          font-size: 13px;
        }

        .invite-code strong {
          color: #071112;
          font-size: 15px;
          letter-spacing: 0.08em;
        }

        .invite-code button {
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 7px;
          background: #ffffff;
          color: #071112;
          padding: 5px 9px;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .invite-code button.copied {
          border-color: rgba(13, 124, 81, 0.35);
          background: #e9f8f1;
          color: #0d7c51;
        }

        .invite-code.compact {
          padding: 7px 8px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          flex: 0 0 auto;
          min-height: 26px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #f0f4f6;
          color: #637075;
          white-space: nowrap;
        }

        .pill.ok {
          color: #0d7c51;
        }

        .pill.private {
          color: #b04200;
        }

        .players {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 14px;
          max-width: 100%;
        }

        .players:has(.result-player) {
          gap: 16px;
        }

        .player {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 6px;
          align-items: start;
          justify-items: center;
          font-size: 13px;
          font-weight: 700;
          min-width: 0;
          width: 72px;
          max-width: 72px;
          border: 0;
          border-radius: 0;
          background: transparent;
          padding: 0;
          text-align: center;
        }

        .player > .player-name-line {
          display: grid;
          gap: 2px;
          justify-items: center;
          -webkit-line-clamp: unset;
          -webkit-box-orient: unset;
          white-space: normal;
        }

        .player-name-line small {
          display: block;
          color: #3059ff;
          font-size: 10px;
          font-weight: 900;
          line-height: 1.1;
        }

        .result-player {
          align-items: start;
          width: 86px;
          max-width: 86px;
        }

        .player > span:not(.player-avatar):not(.avatar-photo):not(.champion-badge):not(.check-badge):not(.cup-badge) {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: normal;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          font-size: 12px;
          line-height: 1.15;
        }

        .player > .remove-player,
        .player > .checkin-mini {
          grid-column: 1 / -1;
          justify-self: stretch;
          width: 100%;
          max-width: 100%;
        }

        .result-player > .remove-player,
        .result-player > .checkin-mini {
          width: 100%;
          justify-self: stretch;
        }

        .player-avatar {
          --avatar-size: var(--avatar-md);
          --avatar-emoji-size: var(--avatar-md-emoji);
          --avatar-text-size: var(--avatar-md-text);
          position: relative;
          display: inline-grid;
          place-items: center;
          width: var(--avatar-size);
          height: var(--avatar-size);
          min-width: var(--avatar-size);
          min-height: var(--avatar-size);
          max-width: 100%;
          aspect-ratio: 1;
          border-radius: 999px;
          border: 0;
          background: linear-gradient(135deg, #13c9c9, #3059ff);
          color: #ffffff;
          font-weight: 900;
          padding: 0;
          overflow: visible;
          isolation: isolate;
        }

        .player-avatar > img {
          position: absolute;
          inset: 0;
          display: block;
          width: 100% !important;
          height: 100% !important;
          max-width: none;
          object-fit: cover !important;
          object-position: center center !important;
          border-radius: 999px !important;
          clip-path: circle(50% at 50% 50%);
          -webkit-mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
          mask-image: radial-gradient(circle at center, #000 99%, transparent 100%);
          z-index: 0;
        }

        .player-avatar-button {
          cursor: pointer;
          min-height: var(--avatar-md);
        }

        .player-avatar-button:disabled {
          cursor: default;
        }

        .player-avatar.profile-large {
          --avatar-size: var(--avatar-lg);
          --avatar-emoji-size: var(--avatar-lg-emoji);
          --avatar-text-size: var(--avatar-lg-text);
          width: var(--avatar-size);
          height: var(--avatar-size);
          min-width: var(--avatar-size);
          min-height: var(--avatar-size);
          font-size: 24px;
        }

        .player-avatar.tiny-avatar {
          --avatar-size: var(--avatar-xs);
          --avatar-emoji-size: var(--avatar-xs-emoji);
          --avatar-text-size: var(--avatar-xs-text);
          width: var(--avatar-size);
          height: var(--avatar-size);
          min-width: var(--avatar-size);
          min-height: var(--avatar-size);
          font-size: 12px;
        }

        .place-1 {
          box-shadow: 0 0 0 3px #f5c542;
        }

        .place-2 {
          box-shadow: 0 0 0 3px #b7c0ca;
        }

        .place-3 {
          box-shadow: 0 0 0 3px #c98742;
        }

        .check-badge,
        .cup-badge {
          position: absolute;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 2px solid #ffffff;
          font-size: 10px;
          line-height: 1;
          z-index: 3;
        }

        .check-badge {
          right: -4px;
          bottom: -4px;
          width: 15px;
          height: 15px;
          background: #0d7c51;
          color: #ffffff;
        }

        .cup-badge {
          left: -6px;
          bottom: -6px;
          width: 17px;
          height: 17px;
          background: #fff6c7;
        }

        .score-controls {
          grid-column: 1 / -1;
          display: none;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          min-width: 0;
        }

        .score-controls input,
        .score-controls select {
          min-height: 30px;
          padding: 5px 6px;
          font-size: 11px;
        }

        .tournament-desk {
          display: grid;
          gap: 12px;
          border: 0;
          border-radius: 0;
          background: transparent;
          padding: 6px 0 0;
        }

        .mini-field {
          display: grid;
          gap: 4px;
          min-width: 110px;
          margin: 0;
        }

        .mini-field select {
          min-height: 34px;
          padding: 6px 8px;
        }

        .compact-roster {
          gap: 10px;
        }

        .compact-roster .player {
          width: 70px;
          max-width: 70px;
        }

        .tournament-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }

        .tournament-panel,
        .match-card {
          display: grid;
          gap: 10px;
          border: 0;
          border-radius: 10px;
          background: rgba(240, 244, 246, 0.72);
          padding: 10px;
        }

        .match-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 10px;
        }

        .match-card.completed {
          border-color: rgba(13, 124, 81, 0.3);
          background: #f3fbf7;
        }

        .match-head,
        .match-versus,
        .score-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .match-head {
          justify-content: space-between;
          color: #637075;
          font-size: 12px;
          text-transform: capitalize;
        }

        .match-versus {
          justify-content: center;
        }

        .match-player {
          display: grid;
          justify-items: center;
          gap: 4px;
          min-width: 74px;
          background: transparent;
          color: #071112;
          border: 1px solid transparent;
          padding: 6px;
          text-align: center;
        }

        .match-player span:last-child {
          max-width: 82px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
        }

        .match-player.winner {
          border-color: rgba(245, 197, 66, 0.8);
          background: #fff8dc;
          box-shadow: 0 0 0 2px rgba(245, 197, 66, 0.2);
        }

        .editor-results {
          grid-column: 1 / -1;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .editor-results button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 36px;
          padding: 5px 8px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 999px;
          background: #ffffff;
        }

        .tournament-entry {
          align-content: start;
        }

        .tournament-entry small {
          color: #637075;
          font-size: 11px;
          font-weight: 800;
        }

        .tournament-create-box,
        .public-leaderboard,
        .queue-board,
        .audit-log {
          border: 1px solid rgba(7, 17, 18, 0.1);
          border-radius: 10px;
          background: #ffffff;
          padding: 10px;
        }

        .tournament-settings-box {
          display: grid;
          gap: 10px;
          border-color: rgba(48, 89, 255, 0.2);
          background:
            linear-gradient(135deg, rgba(0, 174, 179, 0.08), rgba(48, 89, 255, 0.08)),
            #ffffff;
        }

        .tournament-settings-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .tournament-settings-head strong {
          font-size: 15px;
          line-height: 1.1;
        }

        .tournament-settings-head span {
          color: #637075;
          font-size: 12px;
          font-weight: 700;
        }

        .session-type-toggle button.active {
          border-color: rgba(48, 89, 255, 0.28);
          box-shadow: 0 0 0 2px rgba(48, 89, 255, 0.1);
        }

        .public-leaderboard {
          display: grid;
          gap: 10px;
          overflow: hidden;
          background:
            radial-gradient(circle at 0% 0%, rgba(245, 197, 66, 0.16), transparent 34%),
            radial-gradient(circle at 100% 100%, rgba(48, 89, 255, 0.14), transparent 38%),
            #ffffff;
        }

        .public-leaderboard .section-head {
          gap: 8px;
          align-items: center;
        }

        .public-leaderboard h3 {
          font-size: 18px;
          line-height: 1.1;
        }

        .public-leaderboard .muted {
          font-size: 12px;
        }

        .public-leaderboard .share-icon-button {
          width: 38px;
          height: 38px;
          min-height: 38px;
          border-radius: 999px;
        }

        .public-leaderboard .podium-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: end;
          gap: 8px;
        }

        .public-leaderboard .podium-player {
          position: relative;
          display: grid;
          justify-items: center;
          align-content: end;
          gap: 6px;
          min-height: 98px;
          padding: 8px;
          border: 1px solid rgba(7, 17, 18, 0.1);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.78);
          color: #071112;
          text-align: center;
          box-shadow: 0 10px 24px rgba(11, 21, 24, 0.06);
        }

        .public-leaderboard .podium-player.place-1 {
          min-height: 132px;
          transform: translateY(-5px);
          border-color: rgba(245, 197, 66, 0.7);
          background: linear-gradient(135deg, rgba(255, 248, 220, 0.95), rgba(255, 255, 255, 0.82));
        }

        .public-leaderboard .podium-player.place-2 {
          min-height: 112px;
          border-color: rgba(183, 192, 202, 0.75);
        }

        .public-leaderboard .podium-player.place-3 {
          min-height: 94px;
          border-color: rgba(201, 135, 66, 0.75);
        }

        .public-leaderboard .podium-player .player-avatar {
          --avatar-size: var(--avatar-sm);
          --avatar-emoji-size: var(--avatar-sm-emoji);
          --avatar-text-size: var(--avatar-sm-text);
          width: var(--avatar-size);
          height: var(--avatar-size);
          min-width: var(--avatar-size);
          min-height: var(--avatar-size);
        }

        .public-leaderboard .podium-medal {
          position: absolute;
          right: 8px;
          top: 7px;
          font-size: 14px;
          line-height: 1;
        }

        .public-leaderboard .podium-player strong {
          min-width: 0;
          max-width: 100%;
          padding-right: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          line-height: 1.1;
        }

        .public-leaderboard .podium-player small {
          color: #637075;
          font-size: 11px;
          font-weight: 800;
        }

        .public-leaderboard .podium-player .link-button {
          justify-self: center;
          min-height: auto;
          padding: 0;
          font-size: 11px;
        }

        .compact-form-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .toggle-line {
          display: flex;
          gap: 8px;
          align-items: center;
          min-height: 38px;
        }

        .toggle-line input {
          width: 16px;
          height: 16px;
          min-height: 16px;
        }

        .queue-board {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .queue-lane {
          display: grid;
          gap: 8px;
        }

        .queue-match {
          display: grid;
          gap: 3px;
          border: 1px solid rgba(7, 17, 18, 0.1);
          border-radius: 8px;
          padding: 8px;
          background: #f6f7f9;
        }

        .queue-match span {
          color: #3059ff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.03em;
        }

        .queue-match.live {
          border-color: rgba(180, 35, 24, 0.35);
          background: #fff3f0;
        }

        .queue-match.live span {
          color: #b42318;
        }

        .queue-match.next {
          border-color: rgba(13, 124, 81, 0.3);
          background: #e9f8f1;
        }

        .queue-controls {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .queue-controls button {
          min-height: 28px;
          padding: 4px 8px;
          font-size: 11px;
        }

        .standings-table {
          display: grid;
          gap: 4px;
          border: 1px solid rgba(7, 17, 18, 0.08);
          border-radius: 8px;
          padding: 6px;
          background: #f8fafb;
        }

        .standing-row {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          gap: 6px;
          align-items: center;
          font-size: 12px;
        }

        .standing-row span {
          color: #637075;
          font-weight: 900;
        }

        .standing-row small {
          color: #637075;
          font-weight: 800;
        }

        .audit-log summary {
          cursor: pointer;
          font-weight: 900;
        }

        .audit-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-top: 1px solid rgba(7, 17, 18, 0.08);
          padding: 7px 0;
          color: #637075;
          font-size: 12px;
        }

        .entry-controls,
        .match-edit-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          width: min(240px, 100%);
        }

        .entry-controls select,
        .entry-controls input,
        .match-edit-row select,
        .match-edit-row input {
          min-height: 36px;
          font-size: 12px;
          padding: 6px 8px;
        }

        .versus {
          color: #637075;
          font-size: 11px;
          font-weight: 900;
        }

        .score-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .score-row input {
          min-height: 34px;
          padding: 6px 8px;
          font-size: 12px;
        }

        .checkin-mini {
          border: 1px solid rgba(13, 124, 81, 0.22);
          background: #e9f8f1;
          color: #0d7c51;
          padding: 3px 5px;
          font-size: 10px;
          min-height: 24px;
        }

        .remove-player {
          background: #fff3f0;
          color: #b42318;
          border: 1px solid rgba(180, 35, 24, 0.22);
          padding: 4px 7px;
          font-size: 11px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .session-mode-row,
        .session-timing-row,
        .session-capacity-row {
          display: grid;
          gap: 12px;
          align-items: start;
        }

        .session-mode-row {
          grid-template-columns: minmax(0, 1fr) minmax(180px, 0.55fr);
        }

        .session-timing-row {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .session-capacity-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .session-mode-row .segmented {
          width: 100%;
        }

        .profile-form {
          grid-template-columns: 150px minmax(260px, 1fr) minmax(260px, 1fr);
          align-items: start;
        }

        .profile-form.login-profile-form {
          grid-template-columns: minmax(320px, 560px);
          max-width: 620px;
        }

        .profile-form.login-profile-form .email-field,
        .profile-form.login-profile-form .password-field,
        .profile-form.login-profile-form .captcha-field {
          grid-column: 1;
          max-width: 560px;
        }

        .profile-form .profile-photo-panel {
          grid-column: 1 / -1;
        }

        .country-field {
          grid-column: 1;
        }

        .phone-field {
          grid-column: 2;
        }

        .email-field {
          grid-column: 3;
        }

        .name-field {
          grid-column: 1 / span 2;
        }

        .birthday-field {
          grid-column: 3;
        }

        .nickname-field {
          grid-column: 3;
        }

        .motto-field {
          grid-column: 1 / span 2;
        }

        .password-field {
          grid-column: 1 / span 2;
          max-width: none;
        }

        .consent-field {
          grid-column: 1 / span 2;
          display: grid;
          grid-template-columns: 16px minmax(0, 1fr);
          gap: 8px;
          align-items: start;
          max-width: 720px;
          margin: 0;
          color: #637075;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.35;
        }

        .consent-field input {
          width: 14px;
          height: 14px;
          margin: 1px 0 0;
          padding: 0;
        }

        .consent-field a {
          color: #3059ff;
          font-weight: 800;
        }

        .captcha-field {
          grid-column: 1 / span 2;
          display: grid;
          gap: 6px;
        }

        .captcha-box {
          min-height: 78px;
        }

        .full {
          grid-column: 1 / -1;
        }

        label {
          display: block;
          color: #637075;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .required {
          color: #d72638;
          font-weight: 900;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(7, 17, 18, 0.12);
          background: #f0f4f6;
          color: #071112;
          border-radius: 8px;
          padding: 10px 11px;
          font: inherit;
          outline: none;
        }

        .country-picker {
          position: relative;
        }

        .country-button {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(7, 17, 18, 0.12);
          background: #f0f4f6;
          color: #071112;
          border-radius: 8px;
          padding: 10px 11px;
          text-align: left;
          min-height: 46px;
        }

        .country-menu {
          position: absolute;
          z-index: 20;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          display: grid;
          gap: 8px;
          border: 1px solid rgba(7, 17, 18, 0.14);
          border-radius: 8px;
          padding: 8px;
          background: #ffffff;
          box-shadow: 0 14px 30px rgba(7, 17, 18, 0.16);
        }

        .country-list {
          display: grid;
          max-height: 220px;
          overflow: auto;
        }

        .country-list button {
          display: grid;
          grid-template-columns: 72px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          background: transparent;
          color: #071112;
          border-radius: 6px;
          padding: 8px;
          text-align: left;
        }

        .country-list button:hover {
          background: #f0f4f6;
        }

        .country-list span {
          color: #3059ff;
          font-weight: 800;
        }

        .password-control {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 48px;
          align-items: stretch;
        }

        .password-control input {
          border-radius: 8px 0 0 8px;
        }

        .password-control button {
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-left: 0;
          border-radius: 0 8px 8px 0;
          background: #ffffff;
          color: #071112;
          padding: 0;
          font-size: 18px;
          line-height: 1;
        }

        textarea {
          resize: vertical;
          min-height: 82px;
        }

        button {
          border: 0;
          border-radius: 8px;
          padding: 10px 13px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          background: #071112;
          color: #ffffff;
          transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease;
          transform: translateY(0) scale(1);
          will-change: transform;
        }

        button:active:not(:disabled) {
          transform: translateY(1px) scale(0.97);
          filter: brightness(0.97);
        }

        button:focus-visible {
          outline: 3px solid rgba(48, 89, 255, 0.28);
          outline-offset: 2px;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.68;
        }

        /* Polish layer: tighter rhythm, consistent control sizing, cleaner cards. */
        aside {
          gap: 14px;
          padding: 20px;
        }

        main {
          padding: 20px;
        }

        .section,
        .session,
        .club-card,
        .mini-session,
        .profile-chip,
        .profile-photo-panel,
        .login-modal,
        .club-drawer,
        .player-profile-panel,
        .tournament-panel,
        .match-card,
        .tournament-create-box,
        .club-session-preview,
        .public-leaderboard,
        .queue-board,
        .audit-log {
          border-radius: 10px;
          border-color: rgba(7, 17, 18, 0.1);
          box-shadow: 0 8px 22px rgba(7, 17, 18, 0.045);
        }

        .section {
          padding: 14px;
        }

        .section-head {
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .section-head h2,
        .section-head h3,
        .session h3 {
          line-height: 1.14;
        }

        .list {
          gap: 9px;
        }

        .session {
          gap: 8px;
          padding: 9px 10px;
        }

        .expanded-session {
          box-shadow: 0 12px 30px rgba(11, 21, 24, 0.075);
        }

        .compact-session-card {
          grid-template-columns: 56px minmax(0, 1fr) auto;
          gap: 9px;
          align-items: center;
        }

        .compact-session-card-expanded {
          padding-bottom: 7px;
        }

        .compact-session-image {
          width: 56px;
          height: 56px;
          border-radius: 8px;
        }

        .compact-session-main {
          gap: 4px;
        }

        .compact-session-title-row {
          gap: 7px;
          align-items: center;
          flex-wrap: wrap;
        }

        .compact-session-title-row h3 {
          font-size: 17px;
          line-height: 1.12;
        }

        .compact-meta,
        .row-meta {
          gap: 6px;
        }

        .row-meta span,
        .pill,
        .status-pill,
        .host-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 24px;
          padding: 3px 8px;
          border-radius: 999px;
          line-height: 1.12;
        }

        .compact-session-actions,
        .action-row,
        .manage-row,
        .join-row,
        .club-action-row {
          align-items: center;
          gap: 7px;
        }

        .compact-join,
        .compact-expand,
        .compact-code {
          min-height: 36px;
          border-radius: 9px;
        }

        .compact-share,
        .share-icon-button {
          display: inline-grid;
          place-items: center;
          border-radius: 10px;
        }

        .sub-tabs {
          padding: 3px;
          gap: 3px;
        }

        .sub-tabs button {
          min-height: 36px;
          padding: 6px 14px;
        }

        .tab,
        .segmented button,
        button.secondary,
        button.primary,
        .create-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          line-height: 1.16;
        }

        .tab,
        .segmented button {
          min-height: 38px;
          padding: 8px 11px;
          text-align: center;
        }

        .segmented {
          gap: 4px;
          padding: 3px;
          border-radius: 12px;
        }

        label {
          margin-bottom: 5px;
          line-height: 1.18;
        }

        input,
        select,
        textarea,
        .country-button,
        .date-input-shell,
        .rich-note-editor {
          min-height: 42px;
          border-radius: 10px;
        }

        input,
        select,
        textarea,
        .country-button {
          padding: 9px 11px;
        }

        textarea,
        .rich-note-editor {
          line-height: 1.35;
        }

        .form-grid,
        .profile-form,
        .compact-form-grid,
        .session-mode-row,
        .session-timing-row,
        .session-capacity-row,
        .tournament-grid {
          gap: 10px;
        }

        .session-mode-row,
        .session-timing-row,
        .session-capacity-row {
          align-items: end;
        }

        .format-toolbar {
          gap: 6px;
          align-items: center;
        }

        .format-toolbar button {
          width: 34px;
          height: 32px;
          min-height: 32px;
          border-radius: 9px;
        }

        .notice {
          margin-top: 8px;
          padding: 9px 11px;
          line-height: 1.35;
        }

        .profile-chip {
          min-height: 54px;
          padding: 8px;
        }

        .profile-photo-panel,
        .confirm-game-panel,
        .tournament-create-box,
        .club-card,
        .mini-session,
        .match-card,
        .queue-board,
        .audit-log {
          padding: 12px;
        }

        .players {
          gap: 12px;
        }

        .player {
          gap: 5px;
        }

        .score-controls {
          gap: 6px;
        }

        .game-strip,
        .game-picker,
        .club-grid {
          gap: 10px;
        }

        .game-card {
          border-radius: 10px;
          padding: 8px;
        }

        .game-card strong {
          line-height: 1.12;
        }

        @media (hover: hover) and (pointer: fine) {
          button:not(:disabled),
          .profile-chip,
          .session.clickable,
          .compact-session-card,
          .club-card.clickable,
          .mini-session.clickable,
          .game-card,
          .day-chip,
          .country-list button,
          .shop-contact a {
            transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease;
          }

          button:hover:not(:disabled),
          .profile-chip:hover,
          .session.clickable:hover,
          .compact-session-card:hover,
          .club-card.clickable:hover,
          .mini-session.clickable:hover,
          .game-card:hover,
          .day-chip:hover,
          .country-list button:hover,
          .shop-contact a:hover {
            transform: translateY(-1px) scale(1.015);
            box-shadow: 0 12px 28px rgba(11, 21, 24, 0.14);
            filter: brightness(1.03);
          }
        }

        button.primary {
          background: linear-gradient(90deg, #00aeb3, #3059ff);
        }

        button.secondary {
          background: #f0f4f6;
          color: #071112;
          border: 1px solid rgba(7, 17, 18, 0.12);
        }

        button.danger {
          background: #fff3f0;
          color: #b42318;
          border: 1px solid rgba(180, 35, 24, 0.24);
        }

        .small-button {
          padding: 7px 10px;
          font-size: 12px;
        }

        .action-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .create-button {
          margin-top: 14px;
        }

        .loading {
          position: relative;
          overflow: hidden;
        }

        .loading::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
          animation: loadingSweep 1s infinite;
        }

        @keyframes loadingSweep {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }

        .notice {
          border-left: 4px solid #00aeb3;
          background: #f0f4f6;
          padding: 10px 12px;
          border-radius: 6px;
          color: #637075;
          font-size: 13px;
          margin-top: 12px;
        }

        .duration-recommendation {
          margin-top: 0;
        }

        .crown-session-notice {
          width: fit-content;
          max-width: 100%;
          border-left-color: #f5c542;
          background: rgba(245, 197, 66, 0.14);
          color: #4b3a05;
          font-weight: 800;
          margin-top: 0;
        }

        .game-picker,
        .game-strip {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
          gap: 10px;
        }

        .game-strip {
          grid-template-columns: repeat(auto-fill, minmax(118px, 150px));
          align-items: start;
        }

        .game-card {
          display: grid;
          gap: 7px;
          text-align: left;
          background: #ffffff;
          color: #071112;
          border: 2px solid rgba(7, 17, 18, 0.12);
          padding: 8px;
        }

        .game-card.selected {
          border-color: #00aeb3;
          box-shadow: 0 0 0 3px rgba(0, 174, 179, 0.15);
        }

        .game-card img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 6px;
          background: #071112;
        }

        .game-strip .game-card img {
          aspect-ratio: 1;
        }

        .game-card span {
          font-weight: 800;
          line-height: 1.2;
        }

        .game-card strong {
          color: #637075;
          font-size: 12px;
        }

        .compact-games {
          grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .stats div,
        .stats > span {
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 12px;
        }

        .stats strong,
        .stats span {
          display: block;
        }

        .stats strong {
          font-size: 24px;
        }

        .stats span {
          color: #637075;
          font-size: 13px;
        }

        @media (max-width: 960px) {
          .app {
            grid-template-columns: 1fr;
            grid-template-rows: calc(var(--mobile-header-height) + env(safe-area-inset-top, 0px)) auto;
            height: auto;
            min-height: 100vh;
            overflow: visible;
            --mobile-header-height: 108px;
          }

          aside {
            position: sticky;
            top: 0;
            z-index: 30;
            border-right: 0;
            border-bottom: 1px solid rgba(7, 17, 18, 0.12);
            height: calc(var(--mobile-header-height) + env(safe-area-inset-top, 0px));
            min-height: calc(var(--mobile-header-height) + env(safe-area-inset-top, 0px));
            max-height: calc(var(--mobile-header-height) + env(safe-area-inset-top, 0px));
            overflow: visible;
            padding: calc(8px + env(safe-area-inset-top, 0px)) 12px 8px;
            display: grid;
            grid-template-columns: 44px auto auto minmax(0, 1fr) auto;
            grid-template-rows: 42px 42px;
            grid-template-areas:
              "profile lang share . logo"
              "tabs tabs tabs tabs tabs";
            align-items: center;
            align-content: start;
            gap: 8px;
          }

          aside > div:first-child,
          .app-title-row {
            display: contents;
          }

          aside > div:first-child > .muted {
            display: none;
          }

          main {
            height: auto;
            overflow: visible;
            padding: 12px;
          }

          h1 {
            font-size: 26px;
          }

          .brand-logo {
            grid-area: logo;
            justify-self: end;
            width: 92px;
            max-width: 92px;
          }

          .language-picker {
            grid-area: lang;
            justify-self: start;
          }

          .language-menu {
            width: max-content;
            max-width: min(420px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
          }

          .language-picker > button {
            min-width: 50px;
            min-height: 40px;
            padding: 7px 11px;
          }

          h2 {
            font-size: 18px;
          }

          h3 {
            font-size: 20px;
          }

          .profile-chip {
            grid-area: profile;
            grid-template-columns: 42px;
            width: 42px;
            height: 42px;
            padding: 0;
            border: 0;
            border-radius: 50%;
            background: transparent;
            overflow: hidden;
          }

          .profile-chip > div:not(.avatar) {
            display: none;
          }

          .profile-chip .avatar {
            width: var(--avatar-sm);
            height: var(--avatar-sm);
          }

          .tabs {
            grid-area: tabs;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }

          .app-share {
            grid-area: share;
            justify-self: center;
            min-height: 40px;
            padding: 7px 11px;
            font-size: 13px;
            white-space: nowrap;
          }

          .tab {
            text-align: center;
            min-height: 42px;
            padding: 9px 8px;
            font-size: 14px;
          }

          .shop-contact {
            display: none;
          }

          .profile-mobile-contact {
            display: grid;
            gap: 7px;
            border-top: 1px solid rgba(7, 17, 18, 0.12);
            margin-top: 16px;
            padding-top: 14px;
            font-size: 13px;
          }

          .profile-mobile-contact a {
            color: #3059ff;
            text-decoration: none;
            overflow-wrap: anywhere;
          }

          .section {
            border-radius: 10px;
            padding: 10px;
            box-shadow: none;
          }

          .sessions-section {
            padding: 0;
          }

          .club-drawer-backdrop {
            align-items: end;
            padding: 0 10px 14px;
          }

          .club-drawer {
            max-height: calc(100vh - 86px);
            border-radius: 18px 18px 10px 10px;
            padding: 12px;
          }

          .player-profile-panel {
            width: 100%;
            border-radius: 18px 18px 10px 10px;
            align-self: end;
          }

          .section-head,
          .join-row {
            display: grid;
          }

          .section-copy {
            display: none;
          }

         .sessions-section {
            display: grid;
            align-content: start;
            gap: 8px;
            min-height: 0;
            padding: 0;
          }

          .sessions-filter-head {
            display: block;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible;
          }

          .sessions-filter-head .section-copy {
            display: none !important;
          }

          .sessions-section .sub-tabs {
            margin-top: 0 !important;
          }

          .sessions-section .list {
            margin-top: 0;
          }

          .search-shell {
            position: fixed;
            top: calc(env(safe-area-inset-top, 0px) + var(--mobile-header-height) + 6px);
            right: max(12px, env(safe-area-inset-right, 0px));
            z-index: 25;
            justify-content: flex-end;
            pointer-events: none;
          }

          .mobile-search-toggle {
            display: inline-grid;
            place-items: center;
            width: 46px;
            height: 46px;
            border: 1px solid rgba(48, 89, 255, 0.2);
            border-radius: 999px;
            background: #ffffff;
            box-shadow: 0 12px 34px rgba(11, 21, 24, 0.16);
            font-size: 20px;
            pointer-events: auto;
          }

          .search {
            display: none;
            width: min(100vw - 76px, 440px);
            max-width: none;
            box-shadow: 0 12px 34px rgba(11, 21, 24, 0.16);
            pointer-events: auto;
          }

          .search-shell.open {
            left: max(12px, env(safe-area-inset-left, 0px));
          }

          .search-shell.open .search {
            display: block;
          }

          .search-close {
            display: none;
            box-shadow: 0 12px 34px rgba(11, 21, 24, 0.16);
            pointer-events: auto;
          }

          .search-shell.open .search-close {
            display: inline-grid;
          }

          .day-strip {
            position: fixed;
            top: calc(env(safe-area-inset-top, 0px) + var(--mobile-header-height) + 58px);
            left: 0;
            right: 0;
            z-index: 24;
            width: 100vw;
            max-width: 100vw;
            margin: 0;
            padding: 8px 12px 10px;
            border-width: 1px 0;
            border-radius: 0;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 10px 26px rgba(11, 21, 24, 0.12);
          }

          .day-chip {
            min-width: 54px;
            min-height: 44px;
            padding: 6px 9px;
          }

          .drawer-days {
            position: static;
            width: 100%;
            max-width: 100%;
            border-width: 1px;
            border-radius: 999px;
          }

          .session {
            gap: 8px;
            padding: 8px;
            border-radius: 10px;
          }

          .confirm-game-panel {
            grid-template-columns: 1fr;
          }

          .sub-tabs {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .compact-session-card {
            grid-template-columns: 50px minmax(0, 1fr);
            gap: 8px;
            align-items: start;
          }

          .compact-session-image {
            width: 50px;
            height: 50px;
          }

          .compact-session-actions {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            justify-content: stretch;
            gap: 7px;
          }

          .compact-session-actions .compact-code {
            grid-column: 1 / -1;
            width: 100%;
          }

          .compact-session-actions .compact-join,
          .compact-session-actions .compact-expand {
            width: 100%;
            min-height: 42px;
          }

          .desktop-session-share {
            display: none;
          }

          .expanded-mobile-share {
            display: inline-grid;
          }

          .club-session-card {
            grid-template-columns: 50px minmax(0, 1fr);
          }

          .club-session-actions {
            grid-column: 1 / -1;
          }

          .session-expanded {
            gap: 10px;
          }

          .session-top {
            display: grid;
            gap: 8px;
          }

          .row-meta {
            gap: 5px;
          }

          .row-meta span {
            display: inline-flex;
            align-items: center;
            min-height: 26px;
            padding: 2px 8px;
            border-radius: 999px;
            background: #f0f4f6;
            font-size: 12px;
          }

          .pill {
            width: fit-content;
          }

          .players {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          input,
          select,
          textarea,
          .country-button,
          .date-input-shell,
          .rich-note-editor {
            min-height: 44px;
          }

          .form-grid,
          .profile-form,
          .compact-form-grid,
          .session-mode-row,
          .session-timing-row,
          .session-capacity-row,
          .tournament-grid,
          .queue-board,
          .match-list {
            gap: 9px;
          }

          .club-action-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            width: 100%;
          }

          .club-action-row .create-button,
          .club-action-row button {
            width: 100%;
            min-width: 0;
          }

          .club-action-row .create-button:only-child,
          .club-action-row button:only-child {
            grid-column: 1 / -1;
          }

          .players:not(:has(.result-player)) {
            grid-template-columns: repeat(auto-fit, minmax(86px, 1fr));
          }

          .player {
            grid-template-columns: minmax(0, 1fr);
            font-size: 13px;
          }

          .result-player .checkin-mini,
          .result-player .remove-player {
            grid-column: 1 / -1;
            width: 100%;
          }

          .score-controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .podium-pyramid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }

          .podium-player {
            min-height: 68px;
            padding: 6px 4px;
          }

          .podium-rank-1 {
            min-height: 82px;
            transform: translateY(-6px);
          }

          .manage-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .manage-row button {
            width: 100%;
          }

          .compact-head {
            gap: 10px;
          }

          .game-strip {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            padding: 2px 2px 8px;
            margin-inline: -2px;
            -webkit-overflow-scrolling: touch;
          }

          .game-strip .game-card {
            flex: 0 0 156px;
            scroll-snap-align: start;
          }

          .game-strip .game-card img {
            aspect-ratio: 1;
          }

          .game-picker {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .game-picker .game-card {
            padding: 7px;
          }

          .game-picker .game-card span,
          .game-strip .game-card span {
            font-size: 13px;
          }

          .join-row input,
          .join-row button,
          .action-row button,
          .create-button {
            width: 100%;
            min-height: 48px;
          }

          .join-row {
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: stretch;
          }

          .join-row input {
            grid-column: 1 / -1;
          }

          .join-row .share-icon-button {
            width: 48px;
            min-height: 48px;
          }

          .profile-photo-panel {
            grid-template-columns: 70px minmax(0, 1fr);
            padding: 10px;
          }

          .profile-photo-preview {
            --avatar-size: var(--avatar-lg);
            --avatar-emoji-size: var(--avatar-lg-emoji);
            --avatar-text-size: var(--avatar-lg-text);
            width: var(--avatar-size);
            height: var(--avatar-size);
            font-size: 24px;
          }

          .form-grid,
          .profile-form,
          .stats {
            grid-template-columns: 1fr;
          }

          .compact-form-grid,
          .session-mode-row,
          .session-timing-row,
          .session-capacity-row,
          .queue-board,
          .match-list,
          .tournament-grid {
            grid-template-columns: 1fr;
          }

          .standing-row {
            grid-template-columns: 20px minmax(0, 1fr);
          }

          .standing-row small {
            grid-column: 2;
          }

          .country-field,
          .phone-field,
          .email-field,
          .name-field,
          .birthday-field,
          .nickname-field,
          .motto-field,
          .consent-field,
          .password-field,
          .captcha-field {
            grid-column: 1;
            max-width: none;
          }
        }

        @media (max-width: 520px) {
          .app {
            --mobile-header-height: 108px;
          }

          aside {
            padding: calc(8px + env(safe-area-inset-top, 0px)) 10px 8px;
          }

          main {
            padding: 10px;
          }

          h1 {
            font-size: 24px;
          }

          .brand-logo {
            width: 86px;
            max-width: 86px;
          }

          .muted {
            font-size: 12px;
          }

          .tabs {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .tab {
            font-size: 13px;
            min-height: 40px;
            padding: 8px 6px;
          }

          .session h3 {
            font-size: 18px;
          }

          .compact-session-title-row h3 {
            font-size: 17px;
          }

          .compact-session-actions {
            gap: 6px;
          }

          .compact-session-actions .compact-join,
          .compact-session-actions .compact-expand {
            min-height: 40px;
            padding-inline: 9px;
          }

          .club-action-row {
            grid-template-columns: 1fr;
          }

          .game-strip .game-card {
            flex-basis: 142px;
          }

          .game-card strong {
            font-size: 11px;
          }

          .public-leaderboard .podium-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }

          .public-leaderboard .podium-player {
            min-height: 84px;
            padding: 6px 4px;
          }

          .public-leaderboard .podium-player.place-1 {
            min-height: 108px;
          }

          .public-leaderboard .podium-player.place-2 {
            min-height: 94px;
          }

          .public-leaderboard .podium-player.place-3 {
            min-height: 82px;
          }

          .public-leaderboard .podium-player .player-avatar {
            --avatar-size: var(--avatar-sm);
            --avatar-emoji-size: var(--avatar-sm-emoji);
            --avatar-text-size: var(--avatar-sm-text);
            width: var(--avatar-size);
            height: var(--avatar-size);
            min-width: var(--avatar-size);
            min-height: var(--avatar-size);
          }

          .public-leaderboard .podium-player strong {
            font-size: 11px;
          }

          .public-leaderboard .podium-player small {
            font-size: 10px;
          }
        }

        @media (prefers-color-scheme: dark) {
          :global(body) {
            background: #071112;
            color: #f6f7f9;
          }

          aside,
          .section,
          .session,
          .club-card,
          .mini-session,
          .profile-chip,
          .profile-photo-panel,
          .login-modal,
          .club-drawer,
          .player-profile-panel,
          .tournament-panel,
          .match-card,
          .tournament-create-box,
          .club-session-preview,
          .public-leaderboard,
          .queue-board,
          .audit-log {
            background: #10191b;
            border-color: rgba(255, 255, 255, 0.12);
            color: #f6f7f9;
            box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22);
          }

          .tournament-desk {
            background: transparent;
            border-color: transparent;
          }

          .sessions-section {
            background: transparent;
            border: 0;
            box-shadow: none;
          }

          .sessions-section .session {
            background: #10191b;
            border-color: rgba(255, 255, 255, 0.12);
            color: #f6f7f9;
          }

          .expanded-session {
            box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
          }

          .sub-tabs {
            background: #10191b;
            border-color: rgba(255, 255, 255, 0.14);
          }

          .sub-tabs button {
            color: #d7e1e4;
          }

          .sub-tabs button.active {
            background: #f6f7f9;
            color: #071112;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.32);
          }

          .session-expanded {
            border-top-color: rgba(255, 255, 255, 0.1);
          }

          .confirm-game-panel {
            background: #122124;
            border-color: rgba(255, 255, 255, 0.12);
          }

          .confirm-game-panel label {
            color: #b7c3c7;
          }

          .tournament-panel,
          .match-card {
            background: rgba(24, 34, 37, 0.72);
          }

          .muted,
          .profile-chip span:not(.avatar-text):not(.avatar-emoji):not(.avatar-photo),
          .row-meta,
          label,
          .notes,
          .login-modal p,
          .field-help,
          .consent-field,
          .game-card strong,
          .stats span {
            color: #aeb9bd;
          }

          .standings-table,
          .queue-match {
            background: #182225;
            border-color: rgba(255, 255, 255, 0.12);
          }

          .tab,
          .segmented button,
          button.secondary,
          .language-picker > button,
          .language-menu,
          input,
          select,
          textarea,
          .date-input-native,
          .rich-note-editor,
          .format-toolbar button,
          .country-button,
          .search-close,
          .mobile-search-toggle,
          .day-chip,
          .game-card,
          .editor-results button,
          .emoji-row button,
          .color-row button,
          .custom-color-row input,
          .invite-code button {
            background: #182225;
            color: #f6f7f9;
            border-color: rgba(255, 255, 255, 0.14);
          }

          .language-menu button {
            background: transparent;
            color: #d7e1e4;
            border-color: rgba(255, 255, 255, 0.14);
          }

          .language-menu button.active {
            background: #f6f7f9;
            border-color: #f6f7f9;
            color: #071112;
          }

          input,
          select,
          textarea,
          .date-input-native,
          .rich-note-editor,
          .country-button {
            border-color: rgba(255, 255, 255, 0.26);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
          }

          .date-input-native {
            color: transparent;
            caret-color: transparent;
          }

          .date-input-display {
            color: #f6f7f9;
          }

          .date-input-display.placeholder {
            color: #8f9ca1;
          }

          .date-input-native::-webkit-calendar-picker-indicator {
            filter: invert(1);
            opacity: 0.75;
          }

          .rich-note-editor {
            border-color: rgba(246, 247, 249, 0.5);
            box-shadow: inset 0 0 0 1px rgba(246, 247, 249, 0.16);
          }

          .rich-note-editor:focus {
            border-color: #62d3ff;
            box-shadow: 0 0 0 3px rgba(98, 211, 255, 0.16), inset 0 0 0 1px rgba(246, 247, 249, 0.2);
          }

          .selected-date-preview {
            color: #a8b6bc;
          }

          .rich-note-editor:empty::before {
            color: #8f9ca1;
          }

          .format-toolbar button {
            border-color: rgba(255, 255, 255, 0.24);
          }

          .custom-color-row label,
          .player-motto {
            color: #b9c4c8;
          }

          .champion-badge {
            background: #f6f7f9;
          }

          .profile-chip:hover {
            background: #182225;
            color: #f6f7f9;
            border-color: rgba(255, 255, 255, 0.24);
          }

          .profile-chip:hover span,
          .profile-chip:hover strong {
            color: #f6f7f9;
          }

          .tab.active,
          .segmented button.active,
          .notice,
          .row-meta span,
          .pill,
          .pending-member,
          .stats span,
          .match-card.completed {
            background: #1d2a2e;
          }

          .row-meta span,
          .pill,
          .status-pill {
            color: #d7e1e4;
            border-color: rgba(255, 255, 255, 0.12);
          }

          .compact-session-card-expanded {
            border-bottom-color: rgba(255, 255, 255, 0.1);
          }

          .game-card,
          .confirm-game-panel,
          .profile-photo-panel,
          .club-card,
          .mini-session,
          .tournament-create-box,
          .queue-board,
          .audit-log {
            box-shadow: 0 10px 26px rgba(0, 0, 0, 0.2);
          }

          .host-pill {
            background: rgba(98, 211, 255, 0.16);
            color: #8ee7ff;
          }

          .player-name-line small {
            color: #8ee7ff;
          }

          .crown-session-notice {
            background: rgba(245, 197, 66, 0.16);
            color: #ffe28a;
          }

          .match-player {
            color: #f6f7f9;
          }

          .match-player.winner {
            background: rgba(245, 197, 66, 0.16);
            border-color: rgba(245, 197, 66, 0.7);
          }

          .public-leaderboard {
            background:
              radial-gradient(circle at 0% 0%, rgba(245, 197, 66, 0.18), transparent 34%),
              radial-gradient(circle at 100% 100%, rgba(48, 89, 255, 0.18), transparent 38%),
              #10191b;
          }

          .public-leaderboard .podium-player {
            background: rgba(24, 34, 37, 0.92);
            color: #f6f7f9;
            border-color: rgba(255, 255, 255, 0.14);
            box-shadow: none;
          }

          .public-leaderboard .podium-player.place-1 {
            background: linear-gradient(135deg, rgba(245, 197, 66, 0.22), rgba(24, 34, 37, 0.94));
            border-color: rgba(245, 197, 66, 0.62);
          }

          .public-leaderboard .podium-player.place-2 {
            border-color: rgba(183, 192, 202, 0.46);
          }

          .public-leaderboard .podium-player.place-3 {
            border-color: rgba(201, 135, 66, 0.56);
          }

          .public-leaderboard .podium-player small {
            color: #aeb9bd;
          }

          .tournament-settings-box {
            background:
              linear-gradient(135deg, rgba(0, 174, 179, 0.12), rgba(48, 89, 255, 0.12)),
              #10191b;
            border-color: rgba(75, 132, 255, 0.24);
          }

          .tournament-settings-head span {
            color: #aeb9bd;
          }

          .modal-backdrop {
            background: rgba(0, 0, 0, 0.55);
          }

          .club-drawer-backdrop {
            background: rgba(0, 0, 0, 0.58);
          }

          .drawer-handle {
            background: rgba(255, 255, 255, 0.24);
          }

          .invite-code,
          .day-strip,
          .share-button {
            background: #111f31;
            border-color: rgba(75, 132, 255, 0.25);
          }

          .invite-code strong,
          h1,
          h2,
          h3,
          .profile-chip,
          .club-card,
          .game-card,
          .country-list button,
          .profile-photo-panel strong,
          .player-profile-panel h3,
          .modal-close {
            color: #f6f7f9;
          }
        }
      `}</style>
    </div>
  )
}
