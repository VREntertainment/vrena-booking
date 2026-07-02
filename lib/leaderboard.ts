import type { LeaderboardCriterion, LeaderboardPlayer } from '../components/LeaderboardPanel'

export type LeaderboardRpcRow = {
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

export type LeaderboardQuery = {
  clubId: string
  clubPin: string
  criterion: LeaderboardCriterion
  search: string
}

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

export function finiteLeaderboardNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function compactLeaderboardDisplayName(value: string | null | undefined, fallback = 'Player') {
  const cleaned = (value || fallback).trim() || fallback
  return Array.from(cleaned).slice(0, MAX_DISPLAY_NAME_LENGTH).join('')
}

export function isLeaderboardCriterion(value: string | null | undefined): value is LeaderboardCriterion {
  return value === 'totalScore'
    || value === 'wins'
    || value === 'winRate'
    || value === 'accuracy'
    || value === 'reliability'
    || value === 'projectiles'
    || value === 'gamesPlayed'
    || value === 'escapeTime'
}

export function initialLeaderboardQuery(): LeaderboardQuery {
  return {
    clubId: '',
    clubPin: '',
    criterion: 'totalScore',
    search: '',
  }
}

export function leaderboardRpcArgs(query: LeaderboardQuery, offset: number, limit: number, profileId = '') {
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

export function isMissingPagedLeaderboardFunction(error: { message?: string; code?: string } | null | undefined) {
  const message = (error?.message || '').toLowerCase()
  return error?.code === 'PGRST202'
    || message.includes('get_leaderboard_players_page')
    || message.includes('could not find the function')
}

export function leaderboardPlayerFromRpcRow(row: LeaderboardRpcRow, fallbackName: string): LeaderboardPlayer {
  const bestByGameRows = Array.isArray(row.best_by_game) ? row.best_by_game : []
  const baseTotalScore = finiteLeaderboardNumber(row.base_total_score)
  const scoreAdjustment = finiteLeaderboardNumber(row.score_adjustment)
  const bestEscapeDurationSeconds = bestByGameRows.reduce<number | null>((best, item) => {
    if (!item || typeof item !== 'object') return best
    const duration = finiteLeaderboardNumber('escapeDurationSeconds' in item ? item.escapeDurationSeconds : null, Number.NaN)
    if (!Number.isFinite(duration) || duration <= 0) return best
    return best === null || duration < best ? duration : best
  }, null)

  return {
    profileId: row.profile_id,
    displayName: compactLeaderboardDisplayName(row.display_name, fallbackName),
    avatarUrl: row.avatar_url || null,
    avatarEmoji: row.avatar_emoji || null,
    avatarInitials: row.avatar_initials || null,
    avatarColor: row.avatar_color || null,
    avatarTextColor: row.avatar_text_color || null,
    profileMotto: row.profile_motto || null,
    sessionsJoined: finiteLeaderboardNumber(row.sessions_joined),
    gamesJoined: finiteLeaderboardNumber(row.games_joined),
    wins: finiteLeaderboardNumber(row.wins),
    bestPerformerCount: finiteLeaderboardNumber(row.best_performer_count),
    baseTotalScore,
    totalScore: finiteLeaderboardNumber(row.total_score, baseTotalScore + scoreAdjustment),
    scoreAdjustment,
    totalAccuracy: finiteLeaderboardNumber(row.total_accuracy),
    accuracyCount: finiteLeaderboardNumber(row.accuracy_count),
    totalProjectiles: finiteLeaderboardNumber(row.total_projectiles),
    averageAccuracy: row.average_accuracy === null || row.average_accuracy === undefined ? null : finiteLeaderboardNumber(row.average_accuracy),
    reliabilityScore: finiteLeaderboardNumber(row.reliability_score),
    bestEscapeDurationSeconds,
    leaderboardRank: row.leaderboard_rank === null || row.leaderboard_rank === undefined ? undefined : finiteLeaderboardNumber(row.leaderboard_rank),
    leaderboardDistinctRank: row.leaderboard_distinct_rank === null || row.leaderboard_distinct_rank === undefined
      ? null
      : finiteLeaderboardNumber(row.leaderboard_distinct_rank),
    leaderboardHigherMetricValue: row.leaderboard_higher_metric_value === null || row.leaderboard_higher_metric_value === undefined
      ? null
      : finiteLeaderboardNumber(row.leaderboard_higher_metric_value),
    leaderboardMetricValue: row.leaderboard_metric_value === null || row.leaderboard_metric_value === undefined
      ? null
      : finiteLeaderboardNumber(row.leaderboard_metric_value),
    leaderboardTotalCount: row.leaderboard_total_count === null || row.leaderboard_total_count === undefined
      ? undefined
      : finiteLeaderboardNumber(row.leaderboard_total_count),
    bestByGame: bestByGameRows.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const gameValue = 'game' in item ? String(item.game || '') : ''
      const score = finiteLeaderboardNumber('score' in item ? item.score : null, Number.NaN)
      const escapeDurationSeconds = finiteLeaderboardNumber('escapeDurationSeconds' in item ? item.escapeDurationSeconds : null, Number.NaN)
      if (!gameValue || !Number.isFinite(score)) return []
      return [{
        game: gameTitles[gameValue] || gameValue,
        score,
        escapeDurationSeconds: Number.isFinite(escapeDurationSeconds) ? escapeDurationSeconds : null,
      }]
    }),
  }
}

export function leaderboardTotalCountFromRows(rows: LeaderboardRpcRow[]) {
  return rows.reduce((count, row) => Math.max(count, finiteLeaderboardNumber(row.leaderboard_total_count)), 0)
}

export function currentUserLeaderboardPlayer(
  players: LeaderboardPlayer[],
  currentUserRankPlayer: LeaderboardPlayer | null | undefined,
  userId: string
) {
  if (!userId) return null
  return currentUserRankPlayer?.profileId === userId
    ? currentUserRankPlayer
    : players.find((player) => player.profileId === userId) ?? null
}
