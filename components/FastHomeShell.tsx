'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getInitialLanguage, storeLanguage } from '../lib/i18n/detectLanguage'
import { languageOptions, type LanguageCode } from '../lib/i18n/languages'
import { getFallbackTranslation, loadTranslation, type TranslationMap } from '../lib/i18n/loadTranslation'
import type { LeaderboardCriterion, LeaderboardPlayer } from './LeaderboardPanel'
import type { StaffProfile } from './StaffConsole'

type AppView = 'sessions' | 'tickets' | 'create' | 'leaderboard' | 'clubs' | 'profile' | 'staff'

type Profile = {
  id: string
  phone: string | null
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
  role?: string | null
  anonymous_mode?: boolean | null
  anonymous_callsign?: string | null
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
const PROFILE_SELECT = 'id, phone, full_name, nickname, email, birthday, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role, anonymous_mode, anonymous_callsign'

type LeaderboardClub = {
  id: string
  owner_id: string
  name: string
  pin_code?: string | null
  visibility: 'public' | 'private'
  club_members?: Array<{
    profile_id: string
    status?: string | null
  }> | null
}

type HeavyTarget = {
  profileId?: string
  sessionId?: string
  view: AppView
}

const OWNER_EMAILS = ['emilejacquet@icloud.com']
const ADMIN_ONLY_EMAILS = ['emile@vre-vietnam.com', 'contact@vre-vietnam.com']
const ADMIN_EMAILS = [...OWNER_EMAILS, ...ADMIN_ONLY_EMAILS]
const LEADERBOARD_PAGE_SIZE = 20
const MAX_DISPLAY_NAME_LENGTH = 10
const STAFF_MODE_MOBILE_QUERY = '(max-width: 960px), (pointer: coarse)'

function ShareSymbol() {
  return <span aria-hidden="true" className="share-symbol-image" />
}

type LeaderboardQuery = {
  clubId: string
  clubPin: string
  criterion: LeaderboardCriterion
  search: string
}

const gameTitles: Record<string, string> = {
  'arc-of-the-covenant': 'The Secret of the Arc',
  'castle-unspunnen': 'Castle Unspunnen',
  'joller-house': 'Joller House',
  'laser-tag': 'Laser Tag',
  'mini-block-towers': 'Mini Block Towers',
  'office-war': 'Office War',
  paintball: 'Paintball',
  'snow-battle': 'Snow Battle',
  'wild-west': 'Wild West',
}

let supabaseClientPromise: Promise<typeof import('../lib/supabase/client').supabase> | null = null

function getSupabase() {
  supabaseClientPromise ??= import('../lib/supabase/client').then((module) => module.supabase)
  return supabaseClientPromise
}

const FullBookingWidget = dynamic(() => import('./BookingWidget'), {
  ssr: false,
  loading: () => (
    <main>
      <section className="section">
        <p className="notice" aria-busy="true">...</p>
      </section>
    </main>
  ),
})

const LeaderboardPanel = dynamic(() => import('./LeaderboardPanel'), {
  ssr: false,
  loading: () => (
    <section aria-busy="true" className="section leaderboard-section">
      <p className="notice">...</p>
    </section>
  ),
})

const StaffConsolePanel = dynamic(() => import('./StaffConsole'), {
  ssr: false,
  loading: () => (
    <section className="section staff-console">
      <p className="notice" aria-busy="true">Loading Staff Console...</p>
    </section>
  ),
})

function hasRecoveryParams() {
  if (typeof window === 'undefined') return false

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  return Boolean(
    hashParams.get('access_token')
    || hashParams.get('refresh_token')
    || hashParams.get('type') === 'recovery'
    || hashParams.get('type') === 'invite'
    || searchParams.get('code')
    || searchParams.get('type') === 'recovery'
    || searchParams.get('type') === 'invite'
    || hashParams.get('error_description')
    || searchParams.get('error_description')
  )
}

function isStaffModeMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(STAFF_MODE_MOBILE_QUERY).matches
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

function displayName(profile: Profile | null) {
  if (!profile) return 'Player'
  if (profile.anonymous_mode) return anonymousProfileName(profile)
  return compactDisplayName(profile.nickname || profile.full_name || profile.phone || profile.email)
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
      return [{ game: gameTitles[gameValue] || gameValue, score, escapeDurationSeconds: Number.isFinite(escapeDurationSeconds) ? escapeDurationSeconds : null }]
    }),
  }
}

function avatarStyle(source: { avatar_color?: string | null; avatar_text_color?: string | null } | null | undefined): CSSProperties | undefined {
  if (!source?.avatar_color && !source?.avatar_text_color) return undefined

  return {
    ...(source.avatar_color ? { background: source.avatar_color } : {}),
    ...(source.avatar_text_color ? { color: source.avatar_text_color } : {}),
  }
}

function avatarFields(source: Profile | null | undefined) {
  if (source?.anonymous_mode) {
    return {
      avatar_url: null,
      avatar_emoji: ANONYMOUS_MASK_EMOJI,
      avatar_initials: null,
      avatar_color: ANONYMOUS_MASK_COLOR,
      avatar_text_color: ANONYMOUS_MASK_TEXT_COLOR,
    }
  }

  return {
    avatar_url: source?.avatar_url || null,
    avatar_emoji: source?.avatar_emoji || null,
    avatar_initials: source?.avatar_initials || null,
    avatar_color: source?.avatar_color || null,
    avatar_text_color: source?.avatar_text_color || null,
  }
}

function avatarNode(source: {
  avatar_url?: string | null
  avatar_emoji?: string | null
  avatar_initials?: string | null
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
          backgroundImage: `url(${source.avatar_url})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          borderRadius: 999,
          display: 'block',
          height: '100%',
          inset: 0,
          overflow: 'hidden',
          position: 'absolute',
          width: '100%',
        }}
      />
    )
  }
  if (source?.avatar_emoji) return <span className="avatar-emoji">{source.avatar_emoji}</span>
  if (source?.avatar_initials) return <span className="avatar-text">{compactInitials(source.avatar_initials)}</span>
  return <span className="avatar-text">{compactInitials(label || fallback).slice(0, 1)}</span>
}

function isBirthdayToday(dateValue: string | null | undefined) {
  const [year, month, day] = (dateValue || '').split('-').map(Number)
  if (!year || !month || !day) return false

  const today = new Date()
  return today.getMonth() + 1 === month && today.getDate() === day
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

function isMissingPagedLeaderboardFunction(error: { message?: string; code?: string } | null | undefined) {
  const message = (error?.message || '').toLowerCase()
  return error?.code === 'PGRST202'
    || message.includes('get_leaderboard_players_page')
    || message.includes('could not find the function')
}

export default function FastHomeShell() {
  const [heavyTarget, setHeavyTarget] = useState<HeavyTarget | null>(() => hasRecoveryParams() ? { view: 'profile' } : null)
  const [language, setLanguage] = useState<LanguageCode>(() => getInitialLanguage())
  const [text, setText] = useState<TranslationMap>(() => getFallbackTranslation())
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isStaffModeMobile, setIsStaffModeMobile] = useState(() => isStaffModeMobileViewport())
  const [staffModeChoiceResolved, setStaffModeChoiceResolved] = useState(false)
  const [staffOnlyModeOpen, setStaffOnlyModeOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [clubs, setClubs] = useState<LeaderboardClub[]>([])
  const [clubsLoaded, setClubsLoaded] = useState(false)
  const [isLoadingClubs, setIsLoadingClubs] = useState(false)
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<LeaderboardPlayer[]>([])
  const [currentUserRankPlayer, setCurrentUserRankPlayer] = useState<LeaderboardPlayer | null>(null)
  const [hasMoreLeaderboardPlayers, setHasMoreLeaderboardPlayers] = useState(false)
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true)
  const [isLoadingMoreLeaderboardPlayers, setIsLoadingMoreLeaderboardPlayers] = useState(false)
  const [leaderboardStatus, setLeaderboardStatus] = useState('')
  const [sharedKey, setSharedKey] = useState('')
  const leaderboardQueryRef = useRef<LeaderboardQuery>(initialLeaderboardQuery())
  const leaderboardLoadedCountRef = useRef(0)
  const leaderboardLoadingRef = useRef(false)
  const clubsLoadingRef = useRef(false)
  const searchReloadTimeoutRef = useRef<number | null>(null)

  const topPlayer = leaderboardPlayers[0]
  const isAdmin = Boolean(isAdminRole(profile?.role) || isAdminEmail(profile?.email) || isAdminEmail(authEmail))
  const staffAccessRank = profile
    ? Math.max(staffConsoleRank(profile.role, profile.email), staffConsoleRank(profile.role, authEmail))
    : 0
  const canAccessStaffConsole = Boolean(profile && staffAccessRank >= 20)

  const currentUserIsCrowned = Boolean(userId && topPlayer?.profileId === userId && topPlayer.totalScore > 0)
  const shouldShowStaffModeChoice = Boolean(
    isStaffModeMobile
    && canAccessStaffConsole
    && !staffModeChoiceResolved
    && !heavyTarget
    && !staffOnlyModeOpen
  )
  const activeShellView = heavyTarget?.view ?? 'leaderboard'

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setStaffModeChoiceResolved(false)
    }, 0)

    return () => window.clearTimeout(handle)
  }, [staffAccessRank, userId])

  const handleFullWidgetViewChange = useCallback((view: AppView) => {
    setHeavyTarget((currentTarget) => {
      if (!currentTarget || currentTarget.view === view) return currentTarget
      return { ...currentTarget, view }
    })
  }, [])

  const handleFullWidgetProfileChange = useCallback((nextProfile: Profile | null) => {
    setProfile(nextProfile)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia(STAFF_MODE_MOBILE_QUERY)
    const updateMatch = () => setIsStaffModeMobile(mediaQuery.matches)

    updateMatch()
    mediaQuery.addEventListener?.('change', updateMatch)
    return () => mediaQuery.removeEventListener?.('change', updateMatch)
  }, [])

  const fullWidget = useMemo(() => {
    if (!heavyTarget) return null

    return (
      <FullBookingWidget
        embedded
        externalLanguage={language}
        initialSelectedPlayerId={heavyTarget.profileId || ''}
        initialSelectedPlayerSessionId={heavyTarget.sessionId || ''}
        initialView={heavyTarget.view}
        onActiveViewChange={handleFullWidgetViewChange}
        onProfileChange={handleFullWidgetProfileChange}
      />
    )
  }, [handleFullWidgetProfileChange, handleFullWidgetViewChange, heavyTarget, language])

  useEffect(() => {
    let active = true

    void loadTranslation(language).then((nextText) => {
      if (active) setText(nextText)
    })

    return () => {
      active = false
    }
  }, [language])

  const fetchLeaderboardRows = useCallback(async (query: LeaderboardQuery, offset: number, limit: number, profileId = '') => {
    const client = await getSupabase()
    const { data, error } = await client.rpc(
      'get_leaderboard_players_page',
      leaderboardRpcArgs(query, offset, limit, profileId)
    )

    if (error) {
      if (isMissingPagedLeaderboardFunction(error)) {
        setHeavyTarget({ view: 'leaderboard' })
        return null
      }

      throw error
    }

    return ((data ?? []) as LeaderboardRpcRow[]).map((row) => leaderboardPlayerFromRpcRow(row, 'Player'))
  }, [])

  const loadLeaderboardPage = useCallback(async (
    query: LeaderboardQuery,
    offset: number,
    mode: 'append' | 'replace',
    targetUserId = ''
  ) => {
    if (leaderboardLoadingRef.current) return null

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
      if (!players) return null

      const totalCount = players[0]?.leaderboardTotalCount ?? offset + players.length
      leaderboardLoadedCountRef.current = mode === 'append'
        ? leaderboardLoadedCountRef.current + players.length
        : players.length
      setHasMoreLeaderboardPlayers(leaderboardLoadedCountRef.current < totalCount)

      if (mode === 'append') {
        setLeaderboardPlayers((current) => {
          const existingIds = new Set(current.map((player) => player.profileId))
          return [...current, ...players.filter((player) => !existingIds.has(player.profileId))]
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
          setCurrentUserRankPlayer(currentUserRows?.[0] ?? null)
        }
      }

      return players
    } catch (error) {
      setLeaderboardStatus(error instanceof Error ? error.message : String(error))
      if (mode === 'replace') setLeaderboardPlayers([])
      setHasMoreLeaderboardPlayers(false)
      return null
    } finally {
      leaderboardLoadingRef.current = false
      setIsLeaderboardLoading(false)
      setIsLoadingMoreLeaderboardPlayers(false)
    }
  }, [fetchLeaderboardRows])

  const loadClubs = useCallback(async () => {
    if (clubsLoaded || clubsLoadingRef.current) return

    clubsLoadingRef.current = true
    setIsLoadingClubs(true)
    const client = await getSupabase()
    const { data, error } = await client
      .from('clubs')
      .select('id, owner_id, name, visibility, pin_code, club_members(profile_id, status)')
      .order('created_at', { ascending: false })

    if (!error) {
      setClubs((data ?? []) as LeaderboardClub[])
      setClubsLoaded(true)
    }

    clubsLoadingRef.current = false
    setIsLoadingClubs(false)
  }, [clubsLoaded])

  useEffect(() => {
    if (heavyTarget) return

    let active = true

    async function loadFastHome() {
      const client = await getSupabase()
      const [{ data: userData }] = await Promise.all([
        client.auth.getUser(),
      ])

      if (!active) return

      const authUser = userData.user
      let shouldOfferMobileStaffChoice = false
      if (authUser) {
        setUserId(authUser.id)
        setAuthEmail(authUser.email?.toLowerCase() || '')

        const { data: profileRow } = await client
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', authUser.id)
          .is('deleted_at', null)
          .maybeSingle()

        if (!active) return

        const nextProfile = profileRow as Profile | null
        const effectiveRole = nextProfile?.role || defaultRoleForEmail(authUser.email)
        shouldOfferMobileStaffChoice = Math.max(
          staffConsoleRank(effectiveRole, nextProfile?.email),
          staffConsoleRank(effectiveRole, authUser.email)
        ) >= 20 && isStaffModeMobileViewport()

        setProfile(nextProfile ?? {
          id: authUser.id,
          phone: typeof authUser.user_metadata?.phone === 'string' ? authUser.user_metadata.phone : null,
          full_name: typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : null,
          nickname: typeof authUser.user_metadata?.nickname === 'string' ? authUser.user_metadata.nickname : null,
          email: authUser.email?.toLowerCase() || null,
          birthday: typeof authUser.user_metadata?.birthday === 'string' ? authUser.user_metadata.birthday : null,
          avatar_url: typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url : null,
          avatar_emoji: typeof authUser.user_metadata?.avatar_emoji === 'string' ? authUser.user_metadata.avatar_emoji : null,
          avatar_initials: typeof authUser.user_metadata?.avatar_initials === 'string' ? authUser.user_metadata.avatar_initials : null,
          avatar_color: typeof authUser.user_metadata?.avatar_color === 'string' ? authUser.user_metadata.avatar_color : null,
          avatar_text_color: typeof authUser.user_metadata?.avatar_text_color === 'string' ? authUser.user_metadata.avatar_text_color : null,
          profile_motto: typeof authUser.user_metadata?.profile_motto === 'string' ? authUser.user_metadata.profile_motto : null,
          anonymous_mode: Boolean(authUser.user_metadata?.anonymous_mode),
          anonymous_callsign: typeof authUser.user_metadata?.anonymous_callsign === 'string' ? authUser.user_metadata.anonymous_callsign : null,
          role: defaultRoleForEmail(authUser.email),
        })

        if (!shouldOfferMobileStaffChoice && nextProfile?.birthday && isBirthdayToday(nextProfile.birthday)) {
          setHeavyTarget({ view: 'leaderboard' })
          return
        }

        if (!shouldOfferMobileStaffChoice) {
          const { data: pendingInvites } = await client
            .from('session_invites')
            .select('id')
            .eq('recipient_id', authUser.id)
            .eq('status', 'pending')
            .limit(1)

          if (!active) return

          if ((pendingInvites ?? []).length > 0) {
            setHeavyTarget({ view: 'profile' })
            return
          }
        }
      }

      const query = leaderboardQueryRef.current
      const players = await loadLeaderboardPage(query, 0, 'replace', authUser?.id || '')

      if (!active) return

      if (
        authUser
        && !shouldOfferMobileStaffChoice
        && players?.[0]?.profileId === authUser.id
        && players[0].totalScore > 0
      ) {
        setHeavyTarget({ view: 'leaderboard' })
      }
    }

    void loadFastHome()

    return () => {
      active = false
    }
  }, [heavyTarget, loadLeaderboardPage])

  async function shareApp() {
    const appUrl = window.location.origin || 'https://vrena-booking.vercel.app'
    if (navigator.share) {
      await navigator.share({ title: 'VRena Sessions', url: appUrl })
    } else {
      await navigator.clipboard?.writeText(appUrl)
    }

    setSharedKey('app')
    window.setTimeout(() => setSharedKey(''), 1400)
  }

  function openFullApp(view: AppView, profileId = '') {
    setHeavyTarget({ profileId, view })
  }

  function openStaffProfileInFullApp(staffProfile: StaffProfile) {
    setStaffOnlyModeOpen(false)
    setHeavyTarget({ profileId: staffProfile.id, view: 'leaderboard' })
  }

  function chooseMobileStaffMode(view: 'client' | 'staff') {
    setStaffModeChoiceResolved(true)
    if (view === 'staff') setStaffOnlyModeOpen(true)
  }

  const reloadLeaderboard = useCallback((nextQuery: LeaderboardQuery) => {
    leaderboardQueryRef.current = nextQuery
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPage(nextQuery, 0, 'replace', userId)
  }, [loadLeaderboardPage, userId])

  const handleLeaderboardCriterionChange = useCallback((criterion: LeaderboardCriterion) => {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      criterion,
    })
  }, [reloadLeaderboard])

  const handleLeaderboardSearchChange = useCallback((search: string) => {
    const nextQuery = {
      ...leaderboardQueryRef.current,
      search,
    }

    leaderboardQueryRef.current = nextQuery

    if (searchReloadTimeoutRef.current) window.clearTimeout(searchReloadTimeoutRef.current)
    searchReloadTimeoutRef.current = window.setTimeout(() => {
      leaderboardLoadedCountRef.current = 0
      void loadLeaderboardPage(nextQuery, 0, 'replace', userId)
    }, 260)
  }, [loadLeaderboardPage, userId])

  const handleLeaderboardClubChange = useCallback((clubId: string) => {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      clubId,
      clubPin: clubId === leaderboardQueryRef.current.clubId ? leaderboardQueryRef.current.clubPin : '',
    })
  }, [reloadLeaderboard])

  const handleLeaderboardClubPinUnlock = useCallback((clubId: string, clubPin: string) => {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      clubId,
      clubPin,
    })
  }, [reloadLeaderboard])

  const loadMoreLeaderboardPlayers = useCallback(() => {
    if (!hasMoreLeaderboardPlayers || isLoadingMoreLeaderboardPlayers) return
    void loadLeaderboardPage(leaderboardQueryRef.current, leaderboardLoadedCountRef.current, 'append', userId)
  }, [hasMoreLeaderboardPlayers, isLoadingMoreLeaderboardPlayers, loadLeaderboardPage, userId])

  useEffect(() => () => {
    if (searchReloadTimeoutRef.current) window.clearTimeout(searchReloadTimeoutRef.current)
  }, [])

  if (staffOnlyModeOpen && canAccessStaffConsole) {
    return (
      <div className="app staff-only-app">
        <main>
          <StaffConsolePanel
            authEmail={authEmail}
            language={language}
            profile={profile}
            onOpenPlayerProfile={openStaffProfileInFullApp}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      {shouldShowStaffModeChoice && (
        <div className="staff-mode-backdrop" role="dialog" aria-modal="true" aria-labelledby="staff-mode-title">
          <div className="staff-mode-panel">
            <h2 id="staff-mode-title">Choose mode</h2>
            <p>Open the customer app or the staff backend.</p>
            <div className="staff-mode-actions">
              <button type="button" onClick={() => chooseMobileStaffMode('client')}>Client</button>
              <button type="button" onClick={() => chooseMobileStaffMode('staff')}>Staff</button>
            </div>
          </div>
        </div>
      )}
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
              onClick={shareApp}
            >
              <ShareSymbol />
            </button>
          </div>
          <h1 className="sr-only">VRena Sessions</h1>
          <p className="muted">{text.tagline}</p>
        </div>

        <button className={activeShellView === 'profile' ? 'profile-chip active' : 'profile-chip'} onClick={() => openFullApp('profile')} type="button">
          <div className="avatar" style={avatarStyle(avatarFields(profile))}>
            {avatarNode(profile ? {
              ...avatarFields(profile),
              display_name: displayName(profile),
            } : null, 'P')}
            {currentUserIsCrowned && <span className="champion-badge">🏆</span>}
          </div>
          <div>
            <strong>{profile ? displayName(profile) : text.noProfile}</strong>
            <span>{profile ? profile.profile_motto || text.profileMottoEmpty : text.clickLogin}</span>
          </div>
        </button>

        <div className={canAccessStaffConsole ? 'tabs staff-tabs-visible' : 'tabs'}>
          <button className={activeShellView === 'sessions' || activeShellView === 'create' ? 'tab active' : 'tab'} onClick={() => openFullApp('sessions')} type="button">
            {text.sessions}
          </button>
          <button className={activeShellView === 'tickets' ? 'tab active' : 'tab'} onClick={() => openFullApp('tickets')} type="button">
            {text.tickets}
          </button>
          <button className={activeShellView === 'leaderboard' ? 'tab active' : 'tab'} onClick={() => heavyTarget && openFullApp('leaderboard')} type="button">
            {text.hallOfFame}
          </button>
          <button className={activeShellView === 'clubs' ? 'tab active' : 'tab'} onClick={() => openFullApp('clubs')} type="button">
            {text.clubs}
          </button>
          {canAccessStaffConsole && (
            <button className={activeShellView === 'staff' ? 'tab active mobile-staff-tab' : 'tab mobile-staff-tab'} onClick={() => openFullApp('staff')} type="button">
              Staff
            </button>
          )}
        </div>

        <div className="shop-contact">
          <strong>VRena Vietnam</strong>
          <a className="public-game-guide-shell-link" href={language === 'en' ? '/games' : `/games/${language}`}>{text.gameGuide}</a>
          <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
          <a href="https://zalo.me/84981152315" target="_blank" rel="noreferrer">Zalo: 0981152315</a>
          <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
        </div>
      </aside>

      {fullWidget ?? (
        <main>
          {isLeaderboardLoading && leaderboardPlayers.length === 0 && <p className="notice" aria-busy="true">...</p>}
          {leaderboardStatus && leaderboardPlayers.length === 0 && <p className="notice">{leaderboardStatus}</p>}
          <LeaderboardPanel
            avatarStyleFor={(player: LeaderboardPlayer) => avatarStyle({
              avatar_color: player.avatarColor,
              avatar_text_color: player.avatarTextColor,
            })}
            canBypassPrivateClubPins={isAdmin}
            clubs={clubs}
            currentUserRankPlayer={currentUserRankPlayer}
            hasMorePlayers={hasMoreLeaderboardPlayers}
            isLoadingClubs={isLoadingClubs}
            isLoadingMorePlayers={isLoadingMoreLeaderboardPlayers}
            onLeaderboardClubChange={handleLeaderboardClubChange}
            onLeaderboardClubFilterOpen={loadClubs}
            onLeaderboardClubPinUnlock={handleLeaderboardClubPinUnlock}
            onLeaderboardCriterionChange={handleLeaderboardCriterionChange}
            onLeaderboardSearchChange={handleLeaderboardSearchChange}
            onLoadMorePlayers={loadMoreLeaderboardPlayers}
            onOpenPlayerProfile={(profileId) => openFullApp('leaderboard', profileId)}
            players={leaderboardPlayers}
            renderAvatar={(player: LeaderboardPlayer) => avatarNode({
              avatar_url: player.avatarUrl,
              avatar_emoji: player.avatarEmoji,
              avatar_initials: player.avatarInitials,
              display_name: player.displayName,
            }, 'P')}
            serverFiltered
            showClubFilter
            text={text}
            useServerRanking
            userId={userId}
          />
        </main>
      )}
    </div>
  )
}
