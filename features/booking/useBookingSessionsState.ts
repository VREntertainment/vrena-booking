'use client'

import {
  useState
} from 'react'
import {
  type SessionTimeScope
} from '../../components/BookingWidgetSurfaces'
import {
  BlockedTime,
  Session,
  SessionMessage,
  SessionMessagePageState
} from '../../lib/bookingWidgetDomain'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingSessionsState() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([])
  const [sessionMessagePages, setSessionMessagePages] = useState<Record<string, SessionMessagePageState>>({})
  const [loadedSessionDetailIds, setLoadedSessionDetailIds] = useState<Record<string, boolean>>({})
  const [loadingSessionDetailIds, setLoadingSessionDetailIds] = useState<Record<string, boolean>>({})
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedSessionDate, setSelectedSessionDate] = useState('')
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({})
  const [busySessionId, setBusySessionId] = useState('')
  const [busyVoteKey, setBusyVoteKey] = useState('')
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [highlightedSessionId, setHighlightedSessionId] = useState('')
  const [sessionTimeScope, setSessionTimeScope] = useState<SessionTimeScope>('upcoming')
  const [hasMoreUpcomingSessions, setHasMoreUpcomingSessions] = useState(true)
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false)
  const [isLoadingPastSessions, setIsLoadingPastSessions] = useState(false)
  const [confirmedGameDrafts, setConfirmedGameDrafts] = useState<Record<string, string>>({})
  const [announcementDrafts, setAnnouncementDrafts] = useState<Record<string, string>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  return {
    sessions,
    setSessions,
    sessionMessages,
    setSessionMessages,
    sessionMessagePages,
    setSessionMessagePages,
    loadedSessionDetailIds,
    setLoadedSessionDetailIds,
    loadingSessionDetailIds,
    setLoadingSessionDetailIds,
    blockedTimes,
    setBlockedTimes,
    search,
    setSearch,
    isSearchOpen,
    setIsSearchOpen,
    selectedSessionDate,
    setSelectedSessionDate,
    joinCodes,
    setJoinCodes,
    busySessionId,
    setBusySessionId,
    busyVoteKey,
    setBusyVoteKey,
    expandedNotes,
    setExpandedNotes,
    expandedSessions,
    setExpandedSessions,
    highlightedSessionId,
    setHighlightedSessionId,
    sessionTimeScope,
    setSessionTimeScope,
    hasMoreUpcomingSessions,
    setHasMoreUpcomingSessions,
    isLoadingMoreSessions,
    setIsLoadingMoreSessions,
    isLoadingPastSessions,
    setIsLoadingPastSessions,
    confirmedGameDrafts,
    setConfirmedGameDrafts,
    announcementDrafts,
    setAnnouncementDrafts,
    commentDrafts,
    setCommentDrafts,
  }
}
