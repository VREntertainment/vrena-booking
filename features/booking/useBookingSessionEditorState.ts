'use client'

import {
  useState
} from 'react'
import {
  type GameId,
  type TicketType
} from '../../lib/bookingStaticData'
import {
  BookingType,
  Session,
  TicketStatus,
  localDateString
} from '../../lib/bookingWidgetDomain'
import type { BookingForm } from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingSessionEditorState({ incomingCalendar, initialView }: { incomingCalendar: import("../../lib/bookingCalendar").CalendarNavigation | null | undefined; initialView: import("../../components/AppSidebar").AppView }) {
  const [calendarEditSession, setCalendarEditSession] = useState<Session | null>(null)
  const [calendarBookingDraft, setCalendarBookingDraft] = useState<Pick<BookingForm, 'date' | 'time' | 'venueKey'> | undefined>(() => incomingCalendar?.mode === 'staff-booking' && initialView === 'staff' ? { date: incomingCalendar.date, time: incomingCalendar.time, venueKey: incomingCalendar.venue } : undefined)
  const [sessionVisibility, setSessionVisibility] = useState<'public' | 'private'>('public')
  const [sessionType, setSessionType] = useState<'game' | 'tournament'>('game')
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState(localDateString())
  const [sessionTime, setSessionTime] = useState('')
  const [sessionDuration, setSessionDuration] = useState(20)
  const [sessionMaxPlayers, setSessionMaxPlayers] = useState(4)
  const [sessionArenaCount, setSessionArenaCount] = useState(1)
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionClubId, setSessionClubId] = useState('')
  const [selectedGames, setSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [createStatus, setCreateStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState('')
  const [editSessionName, setEditSessionName] = useState('')
  const [editSessionDate, setEditSessionDate] = useState(localDateString())
  const [editSessionTime, setEditSessionTime] = useState('')
  const [editSessionDuration, setEditSessionDuration] = useState(20)
  const [editSessionMaxPlayers, setEditSessionMaxPlayers] = useState(4)
  const [editSessionArenaCount, setEditSessionArenaCount] = useState(1)
  const [editSessionVisibility, setEditSessionVisibility] = useState<'public' | 'private'>('public')
  const [editSessionNotes, setEditSessionNotes] = useState('')
  const [editSelectedGames, setEditSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [editBookingType, setEditBookingType] = useState<BookingType>('community')
  const [editTicketCustomerId, setEditTicketCustomerId] = useState('')
  const [editTicketType, setEditTicketType] = useState<TicketType>('individual')
  const [editTicketTotalPrice, setEditTicketTotalPrice] = useState('')
  const [editTicketStatus, setEditTicketStatus] = useState<TicketStatus>('confirmed')
  const [isUpdatingSession, setIsUpdatingSession] = useState(false)
  return {
    calendarEditSession,
    setCalendarEditSession,
    calendarBookingDraft,
    setCalendarBookingDraft,
    sessionVisibility,
    setSessionVisibility,
    sessionType,
    setSessionType,
    sessionName,
    setSessionName,
    sessionDate,
    setSessionDate,
    sessionTime,
    setSessionTime,
    sessionDuration,
    setSessionDuration,
    sessionMaxPlayers,
    setSessionMaxPlayers,
    sessionArenaCount,
    setSessionArenaCount,
    sessionNotes,
    setSessionNotes,
    sessionClubId,
    setSessionClubId,
    selectedGames,
    setSelectedGames,
    createStatus,
    setCreateStatus,
    isCreating,
    setIsCreating,
    editingSessionId,
    setEditingSessionId,
    editSessionName,
    setEditSessionName,
    editSessionDate,
    setEditSessionDate,
    editSessionTime,
    setEditSessionTime,
    editSessionDuration,
    setEditSessionDuration,
    editSessionMaxPlayers,
    setEditSessionMaxPlayers,
    editSessionArenaCount,
    setEditSessionArenaCount,
    editSessionVisibility,
    setEditSessionVisibility,
    editSessionNotes,
    setEditSessionNotes,
    editSelectedGames,
    setEditSelectedGames,
    editBookingType,
    setEditBookingType,
    editTicketCustomerId,
    setEditTicketCustomerId,
    editTicketType,
    setEditTicketType,
    editTicketTotalPrice,
    setEditTicketTotalPrice,
    editTicketStatus,
    setEditTicketStatus,
    isUpdatingSession,
    setIsUpdatingSession,
  }
}
