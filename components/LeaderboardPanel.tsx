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
  { name: 'Bronze', emoji: '🥉', minScore: 0 },
  { name: 'Silver', emoji: '🥈', minScore: 100 },
  { name: 'Gold', emoji: '🥇', minScore: 250 },
  { name: 'Platinum', emoji: '💠', minScore: 500 },
  { name: 'Diamond', emoji: '💎', minScore: 900 },
  { name: 'Master', emoji: '⭐', minScore: 1400 },
  { name: 'Grand Master', emoji: '🌟', minScore: 2000 },
  { name: 'Champion', emoji: '🏆', minScore: 3000 },
] as const

type RankTier = typeof rankTiers[number]

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

function rankTierForScore(totalScore: number) {
  const normalizedScore = Number.isFinite(totalScore) ? totalScore : 0
  const tierIndex = rankTiers.reduce((currentIndex, tier, index) => (
    normalizedScore >= tier.minScore ? index : currentIndex
  ), 0)
  const tier = rankTiers[tierIndex] ?? rankTiers[0]
  const nextTier = rankTiers[tierIndex + 1]
  const progress = nextTier
    ? Math.max(0, Math.min(100, Math.round(((normalizedScore - tier.minScore) / (nextTier.minScore - tier.minScore)) * 100)))
    : 100

  return { tier, nextTier, progress }
}

function rankTierEmoji(tier: RankTier, criterion: LeaderboardCriterion) {
  if (criterion === 'totalScore' && tier.name === 'Grand Master') return '👑'
  return tier.emoji
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

    let previousValue: number | null = null
    let previousRank = 0

    return sortedPlayers.map((player, index) => {
      const value = leaderboardMetricValue(player, leaderboardCriterion)
      const rank = previousValue !== null && value === previousValue ? previousRank : index + 1
      previousValue = value
      previousRank = rank
      return { player, rank, rankInfo: rankTierForScore(player.totalScore) }
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
  const currentRankTierEmoji = currentUserLeaderboardRow ? rankTierEmoji(currentUserLeaderboardRow.rankInfo.tier, leaderboardCriterion) : ''

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
            <span>{currentRankTierEmoji} {currentUserLeaderboardRow.rankInfo.tier.name}</span>
            <span>
              {currentUserLeaderboardRow.rankInfo.nextTier
                ? `${currentUserLeaderboardRow.rankInfo.progress}% ${text.rankProgress}`
                : 'Champion'}
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
                {isScoreRanking && (
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
                    <span>{rankInfo.tier.name}</span>
                    <span>{rankInfo.nextTier ? `${rankInfo.progress}%` : 'MAX'}</span>
                  </div>
                  <div className="rank-progress-track">
                    <span style={{ width: `${rankInfo.progress}%` }} />
                  </div>
                  <small>
                    {rankInfo.nextTier
                      ? `${text.nextRank}: ${nextTierEmoji} ${rankInfo.nextTier.name}`
                      : 'Champion'}
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
