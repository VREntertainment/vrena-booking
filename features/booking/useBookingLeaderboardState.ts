'use client'
import { useCallback } from 'react'

import {
  useRef,
  useState
} from 'react'
import type { LeaderboardPlayer } from '../../components/LeaderboardPanel'
import {
  initialLeaderboardQuery,
  type LeaderboardQuery
} from '../../lib/leaderboard'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingLeaderboardState({ initialSelectedPlayerId, initialSelectedPlayerSessionId }: { initialSelectedPlayerId: string; initialSelectedPlayerSessionId: string }) {
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<LeaderboardPlayer[]>([])
  const [currentUserRankPlayer, setCurrentUserRankPlayer] = useState<LeaderboardPlayer | null>(null)
  const [currentUserShareStats, setCurrentUserShareStats] = useState<LeaderboardPlayer | null>(null)
  const [hasMoreLeaderboardPlayers, setHasMoreLeaderboardPlayers] = useState(false)
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false)
  const [isLoadingMoreLeaderboardPlayers, setIsLoadingMoreLeaderboardPlayers] = useState(false)
  const [leaderboardStatus, setLeaderboardStatus] = useState('')
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialSelectedPlayerId)
  const [selectedPlayerSessionId, setSelectedPlayerSessionId] = useState(initialSelectedPlayerSessionId)
  const [selectedPlayerStatsOverride, setSelectedPlayerStatsOverride] = useState<LeaderboardPlayer | null>(null)
  const [selectedPlayerGameStats, setSelectedPlayerGameStats] = useState<Record<string, LeaderboardPlayer>>({})
  const [selectedPlayerGameStatsLoading, setSelectedPlayerGameStatsLoading] = useState(false)
  const selectedPlayerStatsFetchedRef = useRef<Set<string>>(new Set())
  const selectedPlayerStatsLoadingRef = useRef<Set<string>>(new Set())
  const selectedPlayerGameStatsFetchedRef = useRef<Set<string>>(new Set())
  const selectedPlayerGameStatsLoadingRef = useRef<Set<string>>(new Set())
  const currentUserShareStatsLoadingRef = useRef(false)
  const leaderboardLoadedRef = useRef(false)
  const leaderboardLoadingRef = useRef(false)
  const leaderboardLoadedCountRef = useRef(0)
  const leaderboardQueryRef = useRef<LeaderboardQuery>(initialLeaderboardQuery())
  const [leaderboardView, setLeaderboardView] = useState(() => ({ loaded: false, query: initialLeaderboardQuery() }))
  const setLeaderboardLoaded = useCallback((loaded: boolean) => {
    leaderboardLoadedRef.current = loaded
    setLeaderboardView((current) => current.loaded === loaded ? current : { ...current, loaded })
  }, [leaderboardLoadedRef])
  const setLeaderboardQuery = useCallback((query: LeaderboardQuery) => {
    leaderboardQueryRef.current = query
    setLeaderboardView((current) => current.query === query ? current : { ...current, query })
  }, [leaderboardQueryRef])
  const leaderboardSearchReloadTimeoutRef = useRef<number | null>(null)
  return {
    leaderboardView,
    setLeaderboardLoaded,
    setLeaderboardQuery,
    leaderboardPlayers,
    setLeaderboardPlayers,
    currentUserRankPlayer,
    setCurrentUserRankPlayer,
    currentUserShareStats,
    setCurrentUserShareStats,
    hasMoreLeaderboardPlayers,
    setHasMoreLeaderboardPlayers,
    isLeaderboardLoading,
    setIsLeaderboardLoading,
    isLoadingMoreLeaderboardPlayers,
    setIsLoadingMoreLeaderboardPlayers,
    leaderboardStatus,
    setLeaderboardStatus,
    selectedPlayerId,
    setSelectedPlayerId,
    selectedPlayerSessionId,
    setSelectedPlayerSessionId,
    selectedPlayerStatsOverride,
    setSelectedPlayerStatsOverride,
    selectedPlayerGameStats,
    setSelectedPlayerGameStats,
    selectedPlayerGameStatsLoading,
    setSelectedPlayerGameStatsLoading,
    selectedPlayerStatsFetchedRef,
    selectedPlayerStatsLoadingRef,
    selectedPlayerGameStatsFetchedRef,
    selectedPlayerGameStatsLoadingRef,
    currentUserShareStatsLoadingRef,
    leaderboardLoadedRef,
    leaderboardLoadingRef,
    leaderboardLoadedCountRef,
    leaderboardQueryRef,
    leaderboardSearchReloadTimeoutRef,
  }
}
