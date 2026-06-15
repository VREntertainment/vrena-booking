'use client'

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
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
  totalAccuracy: number
  accuracyCount: number
  totalProjectiles: number
  averageAccuracy: number | null
  reliabilityScore: number
  bestByGame: Array<{ game: string; score: number }>
}

type LeaderboardClub = {
  id: string
  owner_id: string
  name: string
  club_members?: Array<{
    profile_id: string
    status?: string | null
  }> | null
}

type LeaderboardCriterion = 'totalScore' | 'wins' | 'winRate' | 'accuracy' | 'reliability' | 'projectiles' | 'gamesPlayed'

type LeaderboardPanelProps = {
  avatarStyleFor: (player: LeaderboardPlayer) => CSSProperties | undefined
  clubs: LeaderboardClub[]
  onOpenPlayerProfile: (profileId: string) => void
  players: LeaderboardPlayer[]
  renderAvatar: (player: LeaderboardPlayer) => ReactNode
  text: TranslationMap
  userId: string
}

const rankTiers = [
  { name: 'Champion', emoji: '🏆' },
  { name: 'Grand Master', emoji: '🌟' },
  { name: 'Master', emoji: '⭐' },
  { name: 'Diamond', emoji: '💎' },
  { name: 'Platinum', emoji: '💠' },
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

function percentValue(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return (numerator / denominator) * 100
}

function isRankableLeaderboardValue(value: number) {
  return Number.isFinite(value) && value > 0
}

function progressTowardHigherValue(value: number, higherValue: number | null) {
  if (!isRankableLeaderboardValue(value) || !higherValue || higherValue <= 0) return 0
  return Math.max(0, Math.min(99, Math.round((value / higherValue) * 100)))
}

function rankTierForDistinctStatRank(distinctStatRankIndex: number | null, value: number, higherValue: number | null): RankInfo {
  if (distinctStatRankIndex === null || !isRankableLeaderboardValue(value)) {
    return { tier: noneRankTier, nextTier: rankTiers[rankTiers.length - 2], progress: 0 }
  }

  const tierIndex = distinctStatRankIndex < rankTiers.length - 1 ? distinctStatRankIndex : rankTiers.length - 1
  const tier = rankTiers[tierIndex] ?? noneRankTier
  const nextTier = tierIndex > 0 ? rankTiers[tierIndex - 1] : undefined
  const progress = nextTier ? progressTowardHigherValue(value, higherValue) : 100
  return { tier, nextTier, progress }
}

function rankTierEmoji(tier: RankTier, criterion: LeaderboardCriterion) {
  if (tier.name === 'None') return ''
  if (criterion === 'totalScore' && tier.name === 'Grand Master') return '👑'
  return tier.emoji
}

function rankTierName(tier: RankTier, text: TranslationMap) {
  return tier.name === 'None' ? text.rankJesterMessage : tier.name
}

function rankTierLabel(tier: RankTier, criterion: LeaderboardCriterion, text: TranslationMap) {
  const emoji = rankTierEmoji(tier, criterion)
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
  return player.totalScore
}

function formatLeaderboardValue(player: LeaderboardPlayer, criterion: LeaderboardCriterion) {
  const value = leaderboardMetricValue(player, criterion)
  if (criterion === 'winRate' || criterion === 'accuracy' || criterion === 'reliability') return `${Math.round(value)}%`
  return Math.round(value).toLocaleString('en-US')
}

export default function LeaderboardPanel({
  avatarStyleFor,
  clubs,
  onOpenPlayerProfile,
  players,
  renderAvatar,
  text,
  userId,
}: LeaderboardPanelProps) {
  const [leaderboardCriterion, setLeaderboardCriterion] = useState<LeaderboardCriterion>('totalScore')
  const [leaderboardSearch, setLeaderboardSearch] = useState('')
  const [leaderboardClubId, setLeaderboardClubId] = useState('')

  const leaderboardCriteria: Array<{ value: LeaderboardCriterion; label: string }> = [
    { value: 'totalScore', label: text.totalScoreCriterion },
    { value: 'wins', label: text.winsCriterion },
    { value: 'winRate', label: text.winRateCriterion },
    { value: 'accuracy', label: text.accuracyCriterion },
    { value: 'reliability', label: text.reliabilityCriterion },
    { value: 'projectiles', label: text.projectilesCriterion },
    { value: 'gamesPlayed', label: text.gamesPlayedCriterion },
  ]

  const rankedLeaderboardRows = useMemo(() => {
    const sortedPlayers = [...players].sort((left, right) => {
      const valueDiff = leaderboardMetricValue(right, leaderboardCriterion) - leaderboardMetricValue(left, leaderboardCriterion)
      if (valueDiff !== 0) return valueDiff
      const scoreDiff = right.totalScore - left.totalScore
      if (scoreDiff !== 0) return scoreDiff
      return left.displayName.localeCompare(right.displayName)
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
        return rankTierForDistinctStatRank(distinctPositiveValueIndex, value, previousPositiveValue)
      })()

      return { player, rank, rankInfo }
    })
  }, [leaderboardCriterion, players])

  const selectedLeaderboardClubProfileIds = useMemo(() => {
    if (!leaderboardClubId) return null
    const club = clubs.find((item) => item.id === leaderboardClubId)
    if (!club) return null

    const profileIds = new Set<string>([club.owner_id])
    ;(club.club_members ?? []).forEach((member) => {
      if (member.status === 'approved') profileIds.add(member.profile_id)
    })
    return profileIds
  }, [clubs, leaderboardClubId])

  const visibleLeaderboardRows = useMemo(() => {
    const query = normalizeSearchValue(leaderboardSearch)

    return rankedLeaderboardRows.filter(({ player }) => {
      const matchesSearch = !query || normalizeSearchValue(`${player.displayName} ${player.profileMotto || ''}`).includes(query)
      const matchesClub = !selectedLeaderboardClubProfileIds || selectedLeaderboardClubProfileIds.has(player.profileId)
      return matchesSearch && matchesClub
    })
  }, [leaderboardSearch, rankedLeaderboardRows, selectedLeaderboardClubProfileIds])

  const currentUserLeaderboardRow = userId ? rankedLeaderboardRows.find(({ player }) => player.profileId === userId) : undefined
  const selectedLeaderboardCriterionLabel = leaderboardCriteria.find((item) => item.value === leaderboardCriterion)?.label || text.totalScoreCriterion
  const isScoreRanking = leaderboardCriterion === 'totalScore'

  return (
    <section className="section leaderboard-section">
      <div className="section-head leaderboard-head">
        <div>
          <h2>{text.hallOfFame}</h2>
          <p className="muted">{text.leaderboardHint}</p>
        </div>
        <div className="leaderboard-controls">
          <label>
            <span>{text.rankBy}</span>
            <select value={leaderboardCriterion} onChange={(event) => setLeaderboardCriterion(event.target.value as LeaderboardCriterion)}>
              {leaderboardCriteria.map((criterion) => (
                <option key={criterion.value} value={criterion.value}>
                  {criterion.label}
                </option>
              ))}
            </select>
          </label>
          {clubs.length > 0 && (
            <label>
              <span>{text.clubFilter}</span>
              <select value={leaderboardClubId} onChange={(event) => setLeaderboardClubId(event.target.value)}>
                <option value="">{text.allClubs}</option>
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

      <input
        className="search leaderboard-search"
        type="search"
        placeholder={text.leaderboardSearchPlaceholder}
        value={leaderboardSearch}
        onChange={(event) => setLeaderboardSearch(event.target.value)}
      />

      {currentUserLeaderboardRow && (
        <div className="current-rank-card">
          <span>{text.currentRank}</span>
          <strong>#{currentUserLeaderboardRow.rank}</strong>
          <small>{selectedLeaderboardCriterionLabel}: {formatLeaderboardValue(currentUserLeaderboardRow.player, leaderboardCriterion)}</small>
          <div className="rank-mini">
            <span>{rankTierLabel(currentUserLeaderboardRow.rankInfo.tier, leaderboardCriterion, text)}</span>
            <span>
              {currentUserLeaderboardRow.rankInfo.nextTier
                ? `${currentUserLeaderboardRow.rankInfo.progress}% ${text.rankProgress}`
                : rankTierName(currentUserLeaderboardRow.rankInfo.tier, text)}
            </span>
          </div>
        </div>
      )}

      <div className="leaderboard-list" aria-label={text.leaderboard}>
        {visibleLeaderboardRows.length === 0 && <p className="notice">{text.noLeaderboardPlayers}</p>}
        {visibleLeaderboardRows.map(({ player, rank, rankInfo }) => {
          const isCurrentUser = player.profileId === userId
          const tierEmoji = rankTierEmoji(rankInfo.tier, leaderboardCriterion)
          const nextTierEmoji = rankInfo.nextTier ? rankTierEmoji(rankInfo.nextTier, leaderboardCriterion) : ''
          const isAnimatedCrown = isScoreRanking && tierEmoji === '👑'
          const tierName = rankTierName(rankInfo.tier, text)
          const nextTierName = rankInfo.nextTier ? rankTierName(rankInfo.nextTier, text) : ''

          return (
            <article className={isCurrentUser ? 'leaderboard-row current-user' : 'leaderboard-row'} key={player.profileId}>
              <div className="leaderboard-rank">#{rank}</div>
              <button
                className="player-avatar player-avatar-button leaderboard-avatar-button"
                onClick={() => onOpenPlayerProfile(player.profileId)}
                style={avatarStyleFor(player)}
                type="button"
              >
                {renderAvatar(player)}
                {isScoreRanking && tierEmoji && (
                  <span className={isAnimatedCrown ? 'leaderboard-tier-badge crown' : 'leaderboard-tier-badge'}>
                    {tierEmoji}
                  </span>
                )}
              </button>
              <div className="leaderboard-player-main">
                <div className="leaderboard-player-title">
                  <strong>{player.displayName}</strong>
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
      </div>
    </section>
  )
}
