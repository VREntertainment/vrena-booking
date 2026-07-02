'use client'

import { Share } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import type { TranslationMap } from '../lib/i18n'

export type LeaderboardPlayer = {
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
  averageAccuracy: number | null
  reliabilityScore: number
  bestByGame: Array<{ game: string; score: number; escapeDurationSeconds?: number | null }>
  bestEscapeDurationSeconds: number | null
  leaderboardRank?: number
  leaderboardDistinctRank?: number | null
  leaderboardHigherMetricValue?: number | null
  leaderboardMetricValue?: number | null
  leaderboardTotalCount?: number
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

export type LeaderboardCriterion = 'totalScore' | 'wins' | 'winRate' | 'accuracy' | 'reliability' | 'projectiles' | 'gamesPlayed' | 'escapeTime'

type LeaderboardPanelProps = {
  avatarStyleFor: (player: LeaderboardPlayer) => CSSProperties | undefined
  canBypassPrivateClubPins?: boolean
  clubs: LeaderboardClub[]
  currentUserRankPlayer?: LeaderboardPlayer | null
  fixedClubId?: string
  hasMorePlayers?: boolean
  hideIntro?: boolean
  isCurrentUserStatsShared?: boolean
  initialCriterion?: LeaderboardCriterion
  isLoadingMorePlayers?: boolean
  isLoadingClubs?: boolean
  onOpenPlayerProfile: (profileId: string) => void
  onLeaderboardClubChange?: (clubId: string) => void
  onLeaderboardClubFilterOpen?: () => void
  onLeaderboardClubPinUnlock?: (clubId: string, pinCode: string) => void
  onLeaderboardCriterionChange?: (criterion: LeaderboardCriterion) => void
  onLeaderboardSearchChange?: (search: string) => void
  onLoadMorePlayers?: () => void
  onShareCurrentUserStats?: () => void
  players: LeaderboardPlayer[]
  renderAvatar: (player: LeaderboardPlayer) => ReactNode
  serverFiltered?: boolean
  useServerRanking?: boolean
  showClubFilter?: boolean
  text: TranslationMap
  userId: string
}

function schedulePostEffectStateUpdate(callback: () => void) {
  if (typeof window === 'undefined') return () => {}

  const handle = window.setTimeout(callback, 0)
  return () => window.clearTimeout(handle)
}

const rankTiers = [
  { name: 'Champion', emoji: '🏆' },
  { name: 'Grandmaster', emoji: '🌟' },
  { name: 'Master', emoji: '⭐' },
  { name: 'Diamond', emoji: '🔷' },
  { name: 'Platinum', emoji: '💎' },
  { name: 'Gold', emoji: '🥇' },
  { name: 'Silver', emoji: '🥈' },
  { name: 'Bronze', emoji: '🥉' },
  { name: 'None', emoji: '' },
] as const

type RankTier = typeof rankTiers[number]
type RankInfo = {
  nextTier: RankTier | undefined
  progress: number
  tier: RankTier
}

const noneRankTier = rankTiers[rankTiers.length - 1]

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizePinCode(value: string | null | undefined) {
  return (value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function safeLeaderboardName(player: Pick<LeaderboardPlayer, 'displayName'>, fallback: string) {
  return (typeof player.displayName === 'string' && player.displayName.trim()) || fallback
}

function playerCardLabel(player: Pick<LeaderboardPlayer, 'displayName'>, fallback: string) {
  return `Open ${safeLeaderboardName(player, fallback)} player card`
}

function visibleClubMembers(club: LeaderboardClub | null) {
  if (!Array.isArray(club?.club_members)) return []
  return club.club_members.filter((member) => Boolean(member?.profile_id))
}

function percentValue(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

function isRankableLeaderboardValue(value: number) {
  return Number.isFinite(value) && value > 0
}

function isAscendingLeaderboardCriterion(criterion: LeaderboardCriterion) {
  return criterion === 'escapeTime'
}

function progressTowardHigherValue(value: number, higherValue: number | null, lowerIsBetter = false) {
  if (!isRankableLeaderboardValue(value) || !higherValue || higherValue <= 0) return 0
  if (lowerIsBetter) return Math.max(0, Math.min(99, Math.round((higherValue / value) * 100)))
  return Math.max(0, Math.min(99, Math.round((value / higherValue) * 100)))
}

function rankTierForDistinctStatRank(distinctStatRankIndex: number | null, value: number, higherValue: number | null, lowerIsBetter = false): RankInfo {
  if (distinctStatRankIndex === null || !isRankableLeaderboardValue(value)) {
    return { tier: noneRankTier, nextTier: rankTiers[rankTiers.length - 2], progress: 0 }
  }

  const tierIndex = distinctStatRankIndex < rankTiers.length - 1 ? distinctStatRankIndex : rankTiers.length - 1
  const tier = rankTiers[tierIndex] ?? noneRankTier
  const nextTier = tierIndex > 0 ? rankTiers[tierIndex - 1] : undefined
  const progress = nextTier ? progressTowardHigherValue(value, higherValue, lowerIsBetter) : 100
  return { tier, nextTier, progress }
}

function rankTierEmoji(tier: RankTier) {
  if (tier.name === 'None') return ''
  return tier.emoji
}

function rankTierName(tier: RankTier, text: TranslationMap) {
  return tier.name === 'None' ? text.rankJesterMessage : tier.name
}

function rankTierLabel(tier: RankTier, text: TranslationMap) {
  const emoji = rankTierEmoji(tier)
  const name = rankTierName(tier, text)
  return emoji ? `${emoji} ${name}` : name
}

function leaderboardMetricValue(player: LeaderboardPlayer, criterion: LeaderboardCriterion) {
  if (criterion === 'wins') return player.wins
  if (criterion === 'winRate') return percentValue(player.wins, player.gamesJoined)
  if (criterion === 'accuracy') return player.averageAccuracy ?? 0
  if (criterion === 'reliability') return player.reliabilityScore
  if (criterion === 'projectiles') return player.totalProjectiles
  if (criterion === 'gamesPlayed') return player.gamesJoined
  if (criterion === 'escapeTime') return player.bestEscapeDurationSeconds ?? 0
  return player.totalScore
}

function formatSpeedrunTime(value: number | null | undefined) {
  if (!Number.isFinite(value) || Number(value) <= 0) return '-'

  const totalSeconds = Math.round(Number(value))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatLeaderboardValue(player: LeaderboardPlayer, criterion: LeaderboardCriterion) {
  const value = leaderboardMetricValue(player, criterion)
  if (criterion === 'escapeTime') return formatSpeedrunTime(value)
  if (criterion === 'winRate' || criterion === 'accuracy' || criterion === 'reliability') return `${Math.round(value)}%`
  return Math.round(value).toLocaleString('en-US')
}

export default function LeaderboardPanel({
  avatarStyleFor,
  canBypassPrivateClubPins = false,
  clubs,
  currentUserRankPlayer,
  fixedClubId = '',
  hasMorePlayers = false,
  hideIntro = false,
  isCurrentUserStatsShared = false,
  initialCriterion = 'totalScore',
  isLoadingMorePlayers = false,
  isLoadingClubs = false,
  onLeaderboardClubChange,
  onLeaderboardClubFilterOpen,
  onLeaderboardClubPinUnlock,
  onLeaderboardCriterionChange,
  onLeaderboardSearchChange,
  onLoadMorePlayers,
  onOpenPlayerProfile,
  onShareCurrentUserStats,
  players,
  renderAvatar,
  serverFiltered = false,
  showClubFilter = false,
  text,
  useServerRanking = false,
  userId,
}: LeaderboardPanelProps) {
  const [leaderboardCriterion, setLeaderboardCriterion] = useState<LeaderboardCriterion>(initialCriterion)
  const [leaderboardSearch, setLeaderboardSearch] = useState('')
  const [leaderboardClubId, setLeaderboardClubId] = useState(fixedClubId)
  const [leaderboardClubPinDrafts, setLeaderboardClubPinDrafts] = useState<Record<string, string>>({})
  const [leaderboardClubPinStatus, setLeaderboardClubPinStatus] = useState('')
  const [unlockedLeaderboardClubIds, setUnlockedLeaderboardClubIds] = useState<Record<string, boolean>>({})
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const leaderboardCriteria: Array<{ value: LeaderboardCriterion; label: string }> = [
    { value: 'totalScore', label: text.totalScoreCriterion },
    { value: 'wins', label: text.winsCriterion },
    { value: 'winRate', label: text.winRateCriterion },
    { value: 'accuracy', label: text.accuracyCriterion },
    { value: 'reliability', label: text.reliabilityCriterion },
    { value: 'projectiles', label: text.projectilesCriterion },
    { value: 'gamesPlayed', label: text.gamesPlayedCriterion },
    { value: 'escapeTime', label: text.escapeSpeedrunCriterion },
  ]

  useEffect(() => {
    if (!fixedClubId) return
    return schedulePostEffectStateUpdate(() => setLeaderboardClubId(fixedClubId))
  }, [fixedClubId])

  useEffect(() => {
    return schedulePostEffectStateUpdate(() => setLeaderboardCriterion(initialCriterion))
  }, [initialCriterion])

  const rankedLeaderboardRows = useMemo(() => {
    const lowerIsBetter = isAscendingLeaderboardCriterion(leaderboardCriterion)

    if (useServerRanking) {
      return players.map((player, index) => {
        const value = leaderboardMetricValue(player, leaderboardCriterion)
        const distinctRankIndex = typeof player.leaderboardDistinctRank === 'number' ? player.leaderboardDistinctRank - 1 : null
        const rankInfo = rankTierForDistinctStatRank(distinctRankIndex, value, player.leaderboardHigherMetricValue ?? null, lowerIsBetter)

        return {
          player,
          rank: player.leaderboardRank ?? index + 1,
          rankInfo,
        }
      })
    }

    const sortedPlayers = [...players].sort((left, right) => {
      const leftValue = leaderboardMetricValue(left, leaderboardCriterion)
      const rightValue = leaderboardMetricValue(right, leaderboardCriterion)
      const leftRankable = isRankableLeaderboardValue(leftValue)
      const rightRankable = isRankableLeaderboardValue(rightValue)

      if (leftRankable !== rightRankable) return leftRankable ? -1 : 1

      const valueDiff = lowerIsBetter ? leftValue - rightValue : rightValue - leftValue
      if (valueDiff !== 0) return valueDiff
      const scoreDiff = right.totalScore - left.totalScore
      if (scoreDiff !== 0) return scoreDiff
      return safeLeaderboardName(left, text.player).localeCompare(safeLeaderboardName(right, text.player))
    })

    const metricRows = sortedPlayers.map((player) => ({
      player,
      value: leaderboardMetricValue(player, leaderboardCriterion),
    }))
    const distinctPositiveValues = Array.from(new Set(
      metricRows
        .map(({ value }) => value)
        .filter(isRankableLeaderboardValue)
    ))

    return metricRows.map(({ player, value }) => {
      const rank = metricRows.findIndex((row) => row.value === value) + 1
      const rankInfo = (() => {
        if (!isRankableLeaderboardValue(value)) {
          const bronzeValue = distinctPositiveValues[rankTiers.length - 2] ?? null
          return rankTierForDistinctStatRank(null, value, bronzeValue)
        }

        const distinctPositiveValueIndex = distinctPositiveValues.indexOf(value)
        const previousPositiveValue = distinctPositiveValueIndex > 0 ? distinctPositiveValues[distinctPositiveValueIndex - 1] ?? null : null
        return rankTierForDistinctStatRank(distinctPositiveValueIndex, value, previousPositiveValue, lowerIsBetter)
      })()

      return { player, rank, rankInfo }
    })
  }, [leaderboardCriterion, players, text.player, useServerRanking])

  const selectedLeaderboardClub = useMemo(() => {
    if (!leaderboardClubId) return null
    return clubs.find((item) => item.id === leaderboardClubId) ?? null
  }, [clubs, leaderboardClubId])

  const selectedLeaderboardClubCanView = useMemo(() => {
    if (!selectedLeaderboardClub) return true
    if (selectedLeaderboardClub.visibility === 'public') return true
    if (canBypassPrivateClubPins) return true
    if (unlockedLeaderboardClubIds[selectedLeaderboardClub.id]) return true
    if (!userId) return false
    if (selectedLeaderboardClub.owner_id === userId) return true
    return visibleClubMembers(selectedLeaderboardClub).some((member) => member.profile_id === userId && member.status === 'approved')
  }, [canBypassPrivateClubPins, selectedLeaderboardClub, unlockedLeaderboardClubIds, userId])
  const selectedLeaderboardClubLocked = Boolean(selectedLeaderboardClub && !selectedLeaderboardClubCanView)
  const selectedLeaderboardClubPinDraft = selectedLeaderboardClub ? leaderboardClubPinDrafts[selectedLeaderboardClub.id] ?? '' : ''

  const selectedLeaderboardClubProfileIds = useMemo(() => {
    if (!selectedLeaderboardClub || selectedLeaderboardClubLocked) return null
    const club = selectedLeaderboardClub
    const profileIds = new Set<string>([club.owner_id])
    visibleClubMembers(club).forEach((member) => {
      if (member.status === 'approved') profileIds.add(member.profile_id)
    })
    return profileIds
  }, [selectedLeaderboardClub, selectedLeaderboardClubLocked])

  const visibleLeaderboardRows = useMemo(() => {
    if (selectedLeaderboardClubLocked) return []

    if (serverFiltered) return rankedLeaderboardRows

    const query = normalizeSearchValue(leaderboardSearch)

    return rankedLeaderboardRows.filter(({ player }) => {
      const matchesSearch = !query || normalizeSearchValue(`${safeLeaderboardName(player, text.player)} ${player.profileMotto || ''}`).includes(query)
      const matchesClub = !selectedLeaderboardClubProfileIds || selectedLeaderboardClubProfileIds.has(player.profileId)
      return matchesSearch && matchesClub
    })
  }, [leaderboardSearch, rankedLeaderboardRows, selectedLeaderboardClubLocked, selectedLeaderboardClubProfileIds, serverFiltered, text.player])

  const currentUserLeaderboardRow = useMemo(() => {
    const localRow = userId ? rankedLeaderboardRows.find(({ player }) => player.profileId === userId) : undefined
    if (localRow || !currentUserRankPlayer) return localRow

    const value = leaderboardMetricValue(currentUserRankPlayer, leaderboardCriterion)
    const distinctRankIndex = typeof currentUserRankPlayer.leaderboardDistinctRank === 'number'
      ? currentUserRankPlayer.leaderboardDistinctRank - 1
      : null
    return {
      player: currentUserRankPlayer,
      rank: currentUserRankPlayer.leaderboardRank ?? 0,
      rankInfo: rankTierForDistinctStatRank(
        distinctRankIndex,
        value,
        currentUserRankPlayer.leaderboardHigherMetricValue ?? null,
        isAscendingLeaderboardCriterion(leaderboardCriterion)
      ),
    }
  }, [currentUserRankPlayer, leaderboardCriterion, rankedLeaderboardRows, userId])
  const selectedLeaderboardCriterionLabel = leaderboardCriteria.find((item) => item.value === leaderboardCriterion)?.label || text.totalScoreCriterion
  const showCurrentUserShareButton = Boolean(onShareCurrentUserStats)

  useEffect(() => {
    if (!onLoadMorePlayers || !hasMorePlayers || isLoadingMorePlayers || !loadMoreRef.current) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMorePlayers()
    }, { rootMargin: '480px 0px' })

    observer.observe(loadMoreRef.current)

    return () => observer.disconnect()
  }, [hasMorePlayers, isLoadingMorePlayers, onLoadMorePlayers])

  function unlockLeaderboardClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedLeaderboardClub) return

    const expectedPin = normalizePinCode(selectedLeaderboardClub.pin_code)
    const typedPin = normalizePinCode(selectedLeaderboardClubPinDraft)
    if (!expectedPin || typedPin !== expectedPin) {
      setLeaderboardClubPinStatus(text.privateIncorrect)
      return
    }

    setUnlockedLeaderboardClubIds((current) => ({ ...current, [selectedLeaderboardClub.id]: true }))
    setLeaderboardClubPinStatus('')
    onLeaderboardClubPinUnlock?.(selectedLeaderboardClub.id, selectedLeaderboardClubPinDraft)
  }

  return (
    <section className="section leaderboard-section">
      <div className={hideIntro ? 'section-head leaderboard-head compact-leaderboard-head' : 'section-head leaderboard-head'}>
        {!hideIntro && (
          <div>
            <h2>{text.hallOfFame}</h2>
            <p className="muted">{text.leaderboardHint}</p>
          </div>
        )}
        <div className="leaderboard-controls">
          <label>
            <span>{text.rankBy}</span>
            <select
              value={leaderboardCriterion}
              onChange={(event) => {
                const nextCriterion = event.target.value as LeaderboardCriterion
                setLeaderboardCriterion(nextCriterion)
                onLeaderboardCriterionChange?.(nextCriterion)
              }}
            >
              {leaderboardCriteria.map((criterion) => (
                <option key={criterion.value} value={criterion.value}>
                  {criterion.label}
                </option>
              ))}
            </select>
          </label>
          {!fixedClubId && (showClubFilter || clubs.length > 0) && (
            <label>
              <span>{text.clubFilter}</span>
              <select
                value={leaderboardClubId}
                onFocus={onLeaderboardClubFilterOpen}
                onMouseDown={onLeaderboardClubFilterOpen}
                onChange={(event) => {
                  const nextClubId = event.target.value
                  setLeaderboardClubId(nextClubId)
                  setLeaderboardClubPinStatus('')
                  onLeaderboardClubChange?.(nextClubId)
                }}
              >
                <option value="">{isLoadingClubs ? '...' : text.allClubs}</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {selectedLeaderboardClubLocked && selectedLeaderboardClub && (
        <form className="leaderboard-club-pin" onSubmit={unlockLeaderboardClub}>
          <div className="leaderboard-club-pin-copy">
            <strong>{text.privateClubLocked}</strong>
            <small>{selectedLeaderboardClub.name}</small>
          </div>
          <label>
            <span>{text.privateCode}</span>
            <input
              autoComplete="off"
              inputMode="text"
              placeholder={text.privateCode}
              value={selectedLeaderboardClubPinDraft}
              onChange={(event) => {
                const value = event.target.value.toUpperCase()
                setLeaderboardClubPinDrafts((current) => ({ ...current, [selectedLeaderboardClub.id]: value }))
                setLeaderboardClubPinStatus('')
              }}
            />
          </label>
          <button className="secondary" type="submit">
            {text.unlockClub}
          </button>
          {leaderboardClubPinStatus && <small className="leaderboard-club-pin-error">{leaderboardClubPinStatus}</small>}
        </form>
      )}

      <input
        className="search leaderboard-search"
        type="search"
        placeholder={text.leaderboardSearchPlaceholder}
        value={leaderboardSearch}
        onChange={(event) => {
          const nextSearch = event.target.value
          setLeaderboardSearch(nextSearch)
          onLeaderboardSearchChange?.(nextSearch)
        }}
      />

      {(currentUserLeaderboardRow || showCurrentUserShareButton) && !selectedLeaderboardClubLocked && (
        <div className="current-rank-card">
          {currentUserLeaderboardRow ? (
            <>
              <span>{text.currentRank}</span>
              <strong>#{currentUserLeaderboardRow.rank}</strong>
              <small>{selectedLeaderboardCriterionLabel}: {formatLeaderboardValue(currentUserLeaderboardRow.player, leaderboardCriterion)}</small>
              <div className="rank-mini">
                <span>{rankTierLabel(currentUserLeaderboardRow.rankInfo.tier, text)}</span>
                <span>
                  {currentUserLeaderboardRow.rankInfo.nextTier
                    ? `${currentUserLeaderboardRow.rankInfo.progress}% ${text.rankProgress}`
                    : rankTierName(currentUserLeaderboardRow.rankInfo.tier, text)}
                </span>
              </div>
            </>
          ) : (
            <>
              <span>{text.currentRank}</span>
              <strong>-</strong>
              <small>{text.rankJesterMessage}</small>
            </>
          )}
          {showCurrentUserShareButton && (
            <button className="secondary small-button leaderboard-share-button" type="button" onClick={() => onShareCurrentUserStats?.()}>
              <span className="button-icon-text">
                <Share aria-hidden="true" size={15} />
                <span>{isCurrentUserStatsShared ? text.shared : text.shareStats}</span>
              </span>
            </button>
          )}
        </div>
      )}

      <div className="leaderboard-list" aria-label={text.leaderboard}>
        {visibleLeaderboardRows.length === 0 && <p className="notice">{text.noLeaderboardPlayers}</p>}
        {visibleLeaderboardRows.map(({ player, rank, rankInfo }) => {
          const isCurrentUser = player.profileId === userId
          const tierEmoji = rankTierEmoji(rankInfo.tier)
          const nextTierEmoji = rankInfo.nextTier ? rankTierEmoji(rankInfo.nextTier) : ''
          const tierName = rankTierName(rankInfo.tier, text)
          const nextTierName = rankInfo.nextTier ? rankTierName(rankInfo.nextTier, text) : ''

          return (
            <article className={isCurrentUser ? 'leaderboard-row current-user' : 'leaderboard-row'} key={player.profileId}>
              <div className="leaderboard-rank">#{rank}</div>
              <button
                aria-label={playerCardLabel(player, text.player)}
                className="player-avatar player-avatar-button leaderboard-avatar-button"
                onClick={() => onOpenPlayerProfile(player.profileId)}
                style={avatarStyleFor(player)}
                type="button"
              >
                {renderAvatar(player)}
                {tierEmoji && (
                  <span className="leaderboard-tier-badge">
                    {tierEmoji}
                  </span>
                )}
              </button>
              <div className="leaderboard-player-main">
                <div className="leaderboard-player-title">
                  <strong>{safeLeaderboardName(player, text.player)}</strong>
                  {isCurrentUser && <span className="pill ok">{text.currentPlayer}</span>}
                </div>
                <div className="rank-progress">
                  <div className="rank-progress-label">
                    <span>{tierName}</span>
                    <span>{rankInfo.nextTier ? `${rankInfo.progress}%` : 'MAX'}</span>
                  </div>
                  <div className="rank-progress-track">
                    <span style={{ width: `${rankInfo.progress}%` }} />
                  </div>
                  <small>
                    {rankInfo.nextTier
                      ? `${text.nextRank}: ${nextTierEmoji ? `${nextTierEmoji} ` : ''}${nextTierName}`
                      : tierName}
                  </small>
                </div>
              </div>
              <div className="leaderboard-metric">
                <span>{selectedLeaderboardCriterionLabel}</span>
                <strong>{formatLeaderboardValue(player, leaderboardCriterion)}</strong>
              </div>
            </article>
          )
        })}
        {(hasMorePlayers || isLoadingMorePlayers) && (
          <div ref={loadMoreRef} className="leaderboard-load-more" aria-busy={isLoadingMorePlayers}>
            {isLoadingMorePlayers ? '...' : ''}
          </div>
        )}
      </div>
    </section>
  )
}
