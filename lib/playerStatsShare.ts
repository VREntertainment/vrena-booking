type ShareablePlayerStats = {
  averageAccuracy?: number | null
  bestByGame?: Array<{ game: string; score: number }>
  bestPerformerCount: number
  displayName: string
  gamesJoined: number
  leaderboardDistinctRank?: number | null
  leaderboardRank?: number
  profileId: string
  sessionsJoined: number
  totalProjectiles: number
  totalScore: number
  wins: number
}

type PlayerStatsShareLabels = {
  accuracy: string
  bestPerformerCount: string
  bestScores: string
  currentRank: string
  gamesPlayed: string
  projectiles: string
  rankFallback: string
  statsTitle: string
  totalScore: string
  wins: string
}

const shareRankTiers = [
  'Champion',
  'Grandmaster',
  'Master',
  'Diamond',
  'Platinum',
  'Gold',
  'Silver',
  'Bronze',
] as const

export function formatWholePercent(value: number | null | undefined) {
  return Number.isFinite(value) ? `${Math.round(Number(value))}%` : '-%'
}

export function shareRankTitle(distinctRank: number | null | undefined, fallback: string) {
  if (!distinctRank || distinctRank < 1) return fallback
  return shareRankTiers[distinctRank - 1] || fallback
}

export function hasShareablePlayerStats(stats: ShareablePlayerStats | null | undefined) {
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

export function buildPlayerStatsShareSummary({
  appUrl,
  contextLabel,
  currentRank,
  displayName,
  labels,
  stats,
}: {
  appUrl: string
  contextLabel?: string
  currentRank?: number
  displayName: string
  labels: PlayerStatsShareLabels
  stats: ShareablePlayerStats
}) {
  const title = contextLabel ? `${labels.statsTitle} · ${contextLabel}` : labels.statsTitle
  const rankTitle = shareRankTitle(stats.leaderboardDistinctRank, labels.rankFallback)
  const rankSummary = currentRank ? `${labels.currentRank}: #${currentRank} · ${rankTitle}` : `${labels.currentRank}: ${rankTitle}`
  const bestScore = stats.bestByGame?.[0]

  return {
    rankSummary,
    rankTitle,
    summary: [
      `${title}: ${displayName}`,
      rankSummary,
      `${labels.totalScore}: ${stats.totalScore}`,
      `${labels.gamesPlayed}: ${stats.gamesJoined}`,
      `${labels.wins}: ${stats.wins}`,
      `${labels.bestPerformerCount}: ${stats.bestPerformerCount}`,
      `${labels.accuracy}: ${formatWholePercent(stats.averageAccuracy)}`,
      `${labels.projectiles}: ${stats.totalProjectiles}`,
      bestScore ? `${labels.bestScores}: ${bestScore.game} ${bestScore.score}` : '',
      appUrl,
    ].filter(Boolean).join('\n'),
    title,
  }
}
