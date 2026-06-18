'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getInitialLanguage, storeLanguage } from '../lib/i18n/detectLanguage'
import { languageOptions, type LanguageCode } from '../lib/i18n/languages'
import { getFallbackTranslation, loadTranslation, type TranslationMap } from '../lib/i18n/loadTranslation'
import type { LeaderboardPlayer } from './LeaderboardPanel'

type AppView = 'sessions' | 'tickets' | 'create' | 'leaderboard' | 'clubs' | 'profile'

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
}

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

const ADMIN_EMAILS = ['emile@vre-vietnam.com', 'contact@vre-vietnam.com']
const MAX_DISPLAY_NAME_LENGTH = 10

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
    <div className="app">
      <main>
        <section className="section">
          <p className="notice" aria-busy="true">...</p>
        </section>
      </main>
    </div>
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

function hasRecoveryParams() {
  if (typeof window === 'undefined') return false

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)
  return Boolean(
    hashParams.get('access_token')
    || hashParams.get('refresh_token')
    || hashParams.get('type') === 'recovery'
    || searchParams.get('code')
    || searchParams.get('type') === 'recovery'
    || hashParams.get('error_description')
    || searchParams.get('error_description')
  )
}

function isAdminEmail(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()))
}

function isAdminRole(role?: string | null) {
  return role?.toLowerCase() === 'admin'
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

function displayName(profile: Profile | null) {
  if (!profile) return 'Player'
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
    bestByGame: bestByGameRows.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const gameValue = 'game' in item ? String(item.game || '') : ''
      const score = finiteNumber('score' in item ? item.score : null, Number.NaN)
      if (!gameValue || !Number.isFinite(score)) return []
      return [{ game: gameTitles[gameValue] || gameValue, score }]
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

export default function FastHomeShell() {
  const [heavyTarget, setHeavyTarget] = useState<HeavyTarget | null>(() => hasRecoveryParams() ? { view: 'profile' } : null)
  const [language, setLanguage] = useState<LanguageCode>(() => getInitialLanguage())
  const [text, setText] = useState<TranslationMap>(() => getFallbackTranslation())
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [clubs, setClubs] = useState<LeaderboardClub[]>([])
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<LeaderboardPlayer[]>([])
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true)
  const [leaderboardStatus, setLeaderboardStatus] = useState('')
  const [sharedKey, setSharedKey] = useState('')

  const topPlayer = leaderboardPlayers[0]
  const isAdmin = Boolean(isAdminRole(profile?.role) || isAdminEmail(profile?.email) || isAdminEmail(authEmail))

  const currentUserIsCrowned = Boolean(userId && topPlayer?.profileId === userId && topPlayer.totalScore > 0)

  const fullWidget = useMemo(() => {
    if (!heavyTarget) return null

    return (
      <FullBookingWidget
        initialSelectedPlayerId={heavyTarget.profileId || ''}
        initialSelectedPlayerSessionId={heavyTarget.sessionId || ''}
        initialView={heavyTarget.view}
      />
    )
  }, [heavyTarget])

  useEffect(() => {
    let active = true

    void loadTranslation(language).then((nextText) => {
      if (active) setText(nextText)
    })

    return () => {
      active = false
    }
  }, [language])

  useEffect(() => {
    if (heavyTarget) return

    let active = true

    async function loadFastHome() {
      const client = await getSupabase()
      const [{ data: userData }, leaderboardResult, clubsResult] = await Promise.all([
        client.auth.getUser(),
        client.rpc('get_leaderboard_players'),
        client
          .from('clubs')
          .select('id, owner_id, name, visibility, pin_code, club_members(profile_id, status)')
          .order('created_at', { ascending: false }),
      ])

      if (!active) return

      const authUser = userData.user
      if (authUser) {
        setUserId(authUser.id)
        setAuthEmail(authUser.email?.toLowerCase() || '')

        const { data: profileRow } = await client
          .from('profiles')
          .select('id, phone, full_name, nickname, email, birthday, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, role')
          .eq('id', authUser.id)
          .maybeSingle()

        if (!active) return

        const nextProfile = profileRow as Profile | null
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
          role: isAdminEmail(authUser.email) ? 'admin' : 'player',
        })

        if (nextProfile?.birthday && isBirthdayToday(nextProfile.birthday)) {
          setHeavyTarget({ view: 'leaderboard' })
          return
        }

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

      if (leaderboardResult.error) {
        setLeaderboardStatus(leaderboardResult.error.message)
        setHeavyTarget({ view: 'leaderboard' })
        return
      }

      const players = ((leaderboardResult.data ?? []) as LeaderboardRpcRow[]).map((row) => leaderboardPlayerFromRpcRow(row, 'Player'))
      setLeaderboardPlayers(players)
      setIsLeaderboardLoading(false)

      if (!clubsResult.error) {
        setClubs((clubsResult.data ?? []) as LeaderboardClub[])
      }

      if (authUser && players[0]?.profileId === authUser.id && players[0].totalScore > 0) {
        setHeavyTarget({ view: 'leaderboard' })
      }
    }

    void loadFastHome()

    return () => {
      active = false
    }
  }, [heavyTarget])

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

  if (fullWidget) return fullWidget

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
            <button className={sharedKey === 'app' ? 'share-button app-share copied' : 'share-button app-share'} type="button" onClick={shareApp}>
              {sharedKey === 'app' ? text.shared : text.shareApp}
            </button>
          </div>
          <h1 className="sr-only">VRena Sessions</h1>
          <p className="muted">{text.tagline}</p>
        </div>

        <button className="profile-chip" onClick={() => openFullApp('profile')} type="button">
          <div className="avatar" style={avatarStyle(profile)}>
            {avatarNode(profile, 'P')}
            {currentUserIsCrowned && <span className="champion-badge">🏆</span>}
          </div>
          <div>
            <strong>{profile ? displayName(profile) : text.noProfile}</strong>
            <span>{profile ? profile.profile_motto || text.profileMottoEmpty : text.clickLogin}</span>
          </div>
        </button>

        <div className="tabs">
          <button className="tab" onClick={() => openFullApp('sessions')} type="button">
            {text.sessions}
          </button>
          <button className="tab" onClick={() => openFullApp('tickets')} type="button">
            {text.tickets}
          </button>
          <button className="tab active" type="button">
            {text.hallOfFame}
          </button>
          <button className="tab" onClick={() => openFullApp(profile ? 'clubs' : 'profile')} type="button">
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
        {isLeaderboardLoading && leaderboardPlayers.length === 0 && <p className="notice" aria-busy="true">...</p>}
        {leaderboardStatus && leaderboardPlayers.length === 0 && <p className="notice">{leaderboardStatus}</p>}
        <LeaderboardPanel
          avatarStyleFor={(player: LeaderboardPlayer) => avatarStyle({
            avatar_color: player.avatarColor,
            avatar_text_color: player.avatarTextColor,
          })}
          canBypassPrivateClubPins={isAdmin}
          clubs={clubs}
          onOpenPlayerProfile={(profileId) => openFullApp('leaderboard', profileId)}
          players={leaderboardPlayers}
          renderAvatar={(player: LeaderboardPlayer) => avatarNode({
            avatar_url: player.avatarUrl,
            avatar_emoji: player.avatarEmoji,
            avatar_initials: player.avatarInitials,
            display_name: player.displayName,
          }, 'P')}
          text={text}
          userId={userId}
        />
      </main>
    </div>
  )
}
