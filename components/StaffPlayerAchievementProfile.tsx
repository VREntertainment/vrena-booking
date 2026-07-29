'use client'

import NextImage from 'next/image'
import { Check, ChevronDown, LoaderCircle, Save, Search, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ANONYMOUS_MASK_COLOR,
  ANONYMOUS_MASK_EMOJI,
  ANONYMOUS_MASK_TEXT_COLOR,
} from '../lib/bookingWidgetDomain'
import type { AchievementSession, AchievementVenueResult } from '../lib/profileAchievements'
import {
  initialLeaderboardQuery,
  leaderboardPlayerFromRpcRow,
  leaderboardRpcArgs,
  type LeaderboardRpcRow,
} from '../lib/leaderboard'
import type { LanguageCode } from '../lib/i18n/languages'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import { supabase } from '../lib/supabase/client'
import type { StaffProfile } from './StaffConsole'
import ProfileAchievementsPanel, { type ManualProfileAchievementAward } from './ProfileAchievementsPanel'
import type { StaffAchievementAward } from './StaffAchievementAwardPanel'
import StaffPlayerStatsEditor, { type StaffPlayerStatsDraft } from './StaffPlayerStatsEditor'
import type { LeaderboardPlayer } from './LeaderboardPanel'

type PendingAchievementChange = {
  action: 'remove' | 'unlock'
  description: string
  id: string
  kind: 'game' | 'retention'
  title: string
}

type HistoryPayload = {
  sessions?: AchievementSession[]
  venueResults?: AchievementVenueResult[]
}

type StaffPlayerAchievementProfileProps = {
  awards: StaffAchievementAward[]
  language: LanguageCode
  onDirtyChange: (dirty: boolean) => void
  onRefreshAwards: () => Promise<void>
  profiles: StaffProfile[]
  profilesLoading: boolean
  text: TranslationMap
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function profileName(profile: StaffProfile) {
  if (profile.anonymous_mode) {
    return profile.nickname?.trim() || profile.anonymous_callsign?.trim() || 'Anonymous player'
  }
  return profile.full_name?.trim() || profile.nickname?.trim() || profile.email?.trim() || profile.phone?.trim() || 'Customer'
}

function profileContact(profile: StaffProfile) {
  const contact = profile.email?.trim() || profile.phone?.trim()
  if (profile.anonymous_mode) return contact ? `Anonymous mode · ${contact}` : 'Anonymous mode'
  return contact || 'No email or phone'
}

function profileInitials(profile: StaffProfile) {
  const source = profile.avatar_initials?.trim() || profileName(profile)
  return source.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function emptyPlayer(profile: StaffProfile): LeaderboardPlayer {
  const anonymous = Boolean(profile.anonymous_mode)
  return {
    profileId: profile.id,
    displayName: profileName(profile),
    avatarUrl: anonymous ? null : profile.avatar_url || null,
    avatarEmoji: anonymous ? ANONYMOUS_MASK_EMOJI : profile.avatar_emoji || null,
    avatarInitials: anonymous ? null : profile.avatar_initials || null,
    avatarColor: anonymous ? ANONYMOUS_MASK_COLOR : profile.avatar_color || null,
    avatarTextColor: anonymous ? ANONYMOUS_MASK_TEXT_COLOR : profile.avatar_text_color || null,
    profileMotto: profile.profile_motto || null,
    sessionsJoined: 0,
    gamesJoined: 0,
    wins: 0,
    bestPerformerCount: 0,
    baseTotalScore: 0,
    totalScore: 0,
    scoreAdjustment: 0,
    loyaltyPoints: profile.loyalty_points_total || 0,
    totalAccuracy: 0,
    accuracyCount: 0,
    totalProjectiles: 0,
    totalMovementMeters: 0,
    averageAccuracy: profile.average_accuracy_override ?? null,
    reliabilityScore: 0,
    bestByGame: [],
    bestEscapeDurationSeconds: profile.best_escape_duration_seconds_override ?? null,
  }
}

function PlayerAvatar({ profile }: { profile: StaffProfile }) {
  const anonymous = Boolean(profile.anonymous_mode)
  const background = anonymous ? ANONYMOUS_MASK_COLOR : profile.avatar_color || 'var(--vrena-purple-100)'
  const color = anonymous ? ANONYMOUS_MASK_TEXT_COLOR : profile.avatar_text_color || 'var(--vrena-purple-800)'

  return (
    <span className="staff-profile-combobox-avatar" style={{ background, color }}>
      {anonymous ? (
        <span aria-hidden="true">{ANONYMOUS_MASK_EMOJI}</span>
      ) : profile.avatar_url ? (
        <NextImage alt="" fill sizes="40px" src={profile.avatar_url} unoptimized />
      ) : profile.avatar_emoji ? (
        <span aria-hidden="true">{profile.avatar_emoji}</span>
      ) : (
        <span aria-hidden="true">{profileInitials(profile)}</span>
      )}
    </span>
  )
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '')
  }
  return error instanceof Error ? error.message : String(error)
}

export default function StaffPlayerAchievementProfile({
  awards,
  language,
  onDirtyChange,
  onRefreshAwards,
  profiles,
  profilesLoading,
  text,
}: StaffPlayerAchievementProfileProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [player, setPlayer] = useState<LeaderboardPlayer | null>(null)
  const [sessions, setSessions] = useState<AchievementSession[]>([])
  const [venueResults, setVenueResults] = useState<AchievementVenueResult[]>([])
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsDraft, setStatsDraft] = useState<StaffPlayerStatsDraft | null>(null)
  const [statsDirty, setStatsDirty] = useState(false)
  const [pendingAchievements, setPendingAchievements] = useState<Map<string, PendingAchievementChange>>(() => new Map())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const comboboxRef = useRef<HTMLDivElement>(null)
  const successTimerRef = useRef<number | null>(null)

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) || null,
    [profiles, selectedProfileId],
  )
  const filteredProfiles = useMemo(() => {
    const search = normalizeSearch(query)
    const matches = search
      ? profiles.filter((profile) => normalizeSearch([
          profile.full_name,
          profile.nickname,
          profile.email,
          profile.phone,
          profile.anonymous_callsign,
        ].filter(Boolean).join(' ')).includes(search))
      : profiles
    return matches.slice(0, 80)
  }, [profiles, query])
  const baselineAwards = useMemo(
    () => awards.filter((award) => award.profile_id === selectedProfileId),
    [awards, selectedProfileId],
  )
  const effectiveAwards = useMemo<ManualProfileAchievementAward[]>(() => {
    const removed = new Set(Array.from(pendingAchievements.entries())
      .filter(([, change]) => change.action === 'remove')
      .map(([key]) => key))
    const current = baselineAwards
      .filter((award) => !removed.has(`${award.achievement_kind}:${award.achievement_id}`))
      .map((award) => ({ ...award }))
    const additions = Array.from(pendingAchievements.entries())
      .filter(([, change]) => change.action === 'unlock')
      .map(([key, change]) => ({
        id: `pending:${key}`,
        achievement_id: change.id,
        achievement_kind: change.kind,
        title: change.title,
        description: change.description,
        note: note.trim() || null,
        awarded_at: new Date().toISOString(),
      }))
    return [...additions, ...current]
  }, [baselineAwards, note, pendingAchievements])
  const pendingKeys = useMemo(() => new Set(pendingAchievements.keys()), [pendingAchievements])
  const dirty = statsDirty || pendingAchievements.size > 0 || Boolean(note.trim())

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!comboboxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  useEffect(() => () => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
  }, [])

  useEffect(() => {
    if (!selectedProfile) return

    let active = true
    void (async () => {
      setLoadingProfile(true)
      setStatus('')
      try {
        const [leaderboardResult, historyResult] = await Promise.all([
          supabase.rpc('get_leaderboard_players_page_v3', leaderboardRpcArgs(
            initialLeaderboardQuery(),
            0,
            1,
            selectedProfile.id,
          )),
          supabase.rpc('staff_get_player_achievement_history', {
            p_profile_id: selectedProfile.id,
          }),
        ])
        if (leaderboardResult.error) throw leaderboardResult.error
        if (historyResult.error) throw historyResult.error
        if (!active) return

        const leaderboardRow = Array.isArray(leaderboardResult.data)
          ? (leaderboardResult.data as LeaderboardRpcRow[])[0]
          : null
        const history = (historyResult.data || {}) as HistoryPayload
        const nextPlayer = leaderboardRow
          ? leaderboardPlayerFromRpcRow(leaderboardRow, profileName(selectedProfile))
          : emptyPlayer(selectedProfile)
        nextPlayer.loyaltyPoints = selectedProfile.loyalty_points_total || 0
        setPlayer(nextPlayer)
        setSessions(Array.isArray(history.sessions) ? history.sessions : [])
        setVenueResults(Array.isArray(history.venueResults) ? history.venueResults : [])
      } catch (error) {
        if (active) setStatus(errorMessage(error))
      } finally {
        if (active) setLoadingProfile(false)
      }
    })()
    return () => {
      active = false
    }
  }, [reloadKey, selectedProfile])

  const handleStatsDraft = useCallback((draft: StaffPlayerStatsDraft | null, changed: boolean) => {
    setStatsDraft(draft)
    setStatsDirty(changed)
  }, [])

  const handleStatsLoading = useCallback((loading: boolean) => {
    setStatsLoading(loading)
  }, [])

  function chooseProfile(profile: StaffProfile) {
    if (dirty && profile.id !== selectedProfileId && !window.confirm('Discard unsaved changes and switch customers?')) return
    setSelectedProfileId(profile.id)
    setQuery(profileName(profile))
    setOpen(false)
    setActiveIndex(0)
    setStatsDraft(null)
    setStatsDirty(false)
    setPendingAchievements(new Map())
    setNote('')
    setStatus('')
  }

  function handleComboboxKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.min(filteredProfiles.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter' && open && filteredProfiles[activeIndex]) {
      event.preventDefault()
      chooseProfile(filteredProfiles[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  function toggleAchievement(achievement: {
    description: string
    id: string
    kind: 'game' | 'retention'
    manuallyUnlocked: boolean
    title: string
  }) {
    const key = `${achievement.kind}:${achievement.id}`
    const baselineManual = baselineAwards.some(
      (award) => award.achievement_kind === achievement.kind && award.achievement_id === achievement.id,
    )
    setPendingAchievements((current) => {
      const next = new Map(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.set(key, {
          action: baselineManual ? 'remove' : 'unlock',
          description: achievement.description,
          id: achievement.id,
          kind: achievement.kind,
          title: achievement.title,
        })
      }
      return next
    })
  }

  async function saveChanges() {
    if (!selectedProfile || !statsDraft || saving || !dirty) return
    setSaving(true)
    setSaved(false)
    setStatus('')
    try {
      const { error } = await supabase.rpc('staff_save_player_achievement_profile', {
        p_profile_id: selectedProfile.id,
        p_loyalty_points: statsDraft.loyaltyPoints,
        p_overall: statsDraft.overall,
        p_games: statsDraft.games,
        p_achievement_changes: Array.from(pendingAchievements.values()),
        p_note: note.trim() || null,
      })
      if (error) throw error

      setPendingAchievements(new Map())
      setStatsDirty(false)
      setNote('')
      await onRefreshAwards()
      setReloadKey((value) => value + 1)
      setSaved(true)
      setStatus('All changes saved.')
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
      successTimerRef.current = window.setTimeout(() => {
        setSaved(false)
        setStatus('')
      }, 3000)
    } catch (error) {
      setStatus(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="staff-achievement-profile-workspace" aria-label="Customer Achievement Profile">
      <div className="staff-profile-combobox" ref={comboboxRef}>
        <label htmlFor="staff-player-search">Choose player</label>
        <div className="staff-profile-combobox-control">
          <Search aria-hidden="true" size={18} />
          <input
            aria-activedescendant={open && filteredProfiles[activeIndex] ? `staff-player-option-${filteredProfiles[activeIndex].id}` : undefined}
            aria-autocomplete="list"
            aria-controls="staff-player-options"
            aria-expanded={open}
            autoComplete="off"
            id="staff-player-search"
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
              setActiveIndex(0)
            }}
            onClick={() => setOpen(true)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleComboboxKeyDown}
            placeholder="Search name, nickname, email, or phone"
            role="combobox"
            value={query}
          />
          <button aria-label="Open customer list" onClick={() => setOpen((value) => !value)} type="button">
            <ChevronDown aria-hidden="true" size={18} />
          </button>
        </div>
        {open && (
          <div className="staff-profile-combobox-menu" id="staff-player-options" role="listbox">
            {profilesLoading ? (
              <div className="staff-profile-combobox-state"><LoaderCircle className="spin" size={18} />Loading customers…</div>
            ) : profiles.length === 0 ? (
              <div className="staff-profile-combobox-state"><UserRound size={18} />No customer profiles yet.</div>
            ) : filteredProfiles.length === 0 ? (
              <div className="staff-profile-combobox-state"><Search size={18} />No results found.</div>
            ) : filteredProfiles.map((profile, index) => (
              <button
                aria-selected={selectedProfileId === profile.id}
                className={index === activeIndex ? 'active' : ''}
                id={`staff-player-option-${profile.id}`}
                key={profile.id}
                onClick={() => chooseProfile(profile)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                <PlayerAvatar profile={profile} />
                <span>
                  <strong>{profileName(profile)}</strong>
                  {profile.anonymous_mode && profile.anonymous_callsign && profile.anonymous_callsign !== profileName(profile) ? (
                    <small>{profile.anonymous_callsign}</small>
                  ) : profile.nickname && profile.nickname !== profile.full_name ? (
                    <small>{profile.nickname}</small>
                  ) : null}
                  <small>{profileContact(profile)}</small>
                </span>
                {selectedProfileId === profile.id && <Check aria-hidden="true" size={17} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedProfile ? (
        <div className="staff-achievement-profile-empty">
          <UserRound aria-hidden="true" size={28} />
          <strong>Select a customer to load their Achievement Profile.</strong>
          <span>Search by name, nickname, email address, or phone number.</span>
        </div>
      ) : loadingProfile || !player ? (
        <div className="staff-achievement-profile-empty" aria-live="polite">
          <LoaderCircle className="spin" aria-hidden="true" size={28} />
          <strong>Loading Achievement Profile…</strong>
        </div>
      ) : (
        <ProfileAchievementsPanel
          editor={{
            onToggleAchievement: toggleAchievement,
            pendingAchievementKeys: pendingKeys,
          }}
          editorRankAction={(
            <div className="staff-achievement-save-row">
              <span aria-live="polite">{status}</span>
              <button
                className={saved ? 'primary staff-save-success' : saving ? 'primary loading' : 'primary'}
                disabled={!dirty || !statsDraft || statsLoading || saving}
                onClick={saveChanges}
                type="button"
              >
                {saved ? <><Check aria-hidden="true" size={17} /><Check aria-hidden="true" size={17} /> Saved</> : <><Save aria-hidden="true" size={17} />Save changes</>}
              </button>
            </div>
          )}
          editorToolbar={(
            <div className="staff-achievement-editor-toolbar">
              <div>
                <strong>Staff edit mode</strong>
                <span>Enter totals and per-game overrides. Select an achievement card to add or remove a manual unlock.</span>
              </div>
              <label>
                <span>Audit note (optional)</span>
                <textarea
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Reason for these changes"
                  value={note}
                />
              </label>
              <StaffPlayerStatsEditor
                deferredSave
                key={`${selectedProfile.id}:${reloadKey}`}
                language={language}
                onDraftChange={handleStatsDraft}
                onLoadingChange={handleStatsLoading}
                onSaved={() => undefined}
                player={player}
              />
            </div>
          )}
          language={language}
          manualAwardsOverride={effectiveAwards}
          mySessions={sessions}
          playerStats={player}
          profile={{
            ...selectedProfile,
            birthday: selectedProfile.birthday,
          }}
          text={text}
          userId={selectedProfile.id}
          venueResultsOverride={venueResults}
        />
      )}

      {status && !saved && !saving && <p className="notice compact-notice" role="alert">{status}</p>}
    </section>
  )
}
