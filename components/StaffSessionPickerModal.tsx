'use client'

import { CalendarDays, Check, ChevronLeft, ChevronRight, LoaderCircle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase/client'

export type StaffSessionOption = {
  alreadyAdded: boolean
  bookingType: string | null
  date: string
  gameName: string | null
  id: string
  name: string
  startTime: string
  status: string
  ticketType: string | null
}

type StaffSessionPickerModalProps = {
  onClose: () => void
  onValidate: (session: StaffSessionOption) => void
  pendingSessionIds: Set<string>
  profileId: string
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function parseMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

function formatTime(value: string) {
  return value.slice(0, 5)
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '')
  }
  return error instanceof Error ? error.message : String(error)
}

export default function StaffSessionPickerModal({
  onClose,
  onValidate,
  pendingSessionIds,
  profileId,
}: StaffSessionPickerModalProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthKey(new Date()))
  const [sessions, setSessions] = useState<StaffSessionOption[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  useEffect(() => {
    let active = true
    void (async () => {
      setLoading(true)
      setError('')
      setSelectedSessionId('')
      try {
        const { data, error: rpcError } = await supabase.rpc('staff_list_player_session_options', {
          p_profile_id: profileId,
          p_month: visibleMonth,
        })
        if (rpcError) throw rpcError
        if (!active) return
        const options = Array.isArray(data) ? data as StaffSessionOption[] : []
        setSessions(options)
        const today = new Date().toISOString().slice(0, 10)
        const firstSelectable = options.find((session) => (
          session.status !== 'cancelled'
          && !session.alreadyAdded
          && !pendingSessionIds.has(session.id)
        ))
        const todayHasSessions = options.some((session) => session.date === today)
        setSelectedDate(todayHasSessions ? today : firstSelectable?.date || options[0]?.date || '')
      } catch (loadError) {
        if (active) {
          setSessions([])
          setSelectedDate('')
          setError(errorMessage(loadError))
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [pendingSessionIds, profileId, visibleMonth])

  const monthDate = useMemo(() => parseMonth(visibleMonth), [visibleMonth])
  const calendarDays = useMemo(() => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const dayCount = new Date(year, month + 1, 0).getDate()
    const leadingDays = new Date(year, month, 1).getDay()
    return [
      ...Array.from({ length: leadingDays }, () => null),
      ...Array.from({ length: dayCount }, (_, index) => {
        const day = index + 1
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }),
    ]
  }, [monthDate])
  const sessionCountByDate = useMemo(() => {
    const counts = new Map<string, number>()
    sessions.forEach((session) => counts.set(session.date, (counts.get(session.date) || 0) + 1))
    return counts
  }, [sessions])
  const daySessions = useMemo(
    () => sessions.filter((session) => session.date === selectedDate),
    [selectedDate, sessions],
  )
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) || null

  function moveMonth(offset: number) {
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + offset, 1)
    setVisibleMonth(monthKey(nextMonth))
  }

  return (
    <div className="modal-backdrop staff-session-picker-backdrop" onClick={onClose}>
      <section
        aria-labelledby="staff-session-picker-title"
        aria-modal="true"
        className="staff-session-picker-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close session picker" autoFocus className="modal-close" onClick={onClose} type="button">
          <X aria-hidden="true" size={18} />
        </button>
        <header>
          <span className="staff-session-picker-icon"><CalendarDays aria-hidden="true" size={21} /></span>
          <div>
            <h3 id="staff-session-picker-title">Add player to session</h3>
            <p>Choose a date and session. Validate only queues the change until Save changes is clicked.</p>
          </div>
        </header>

        <div className="staff-session-picker-nav">
          <button aria-label="Previous month" onClick={() => moveMonth(-1)} type="button">
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <strong>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(monthDate)}</strong>
          <button aria-label="Next month" onClick={() => moveMonth(1)} type="button">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>

        {loading ? (
          <div className="staff-session-picker-state" aria-live="polite">
            <LoaderCircle aria-hidden="true" className="spin" size={22} />
            Loading sessions…
          </div>
        ) : error ? (
          <div className="notice" role="alert">{error}</div>
        ) : (
          <div className="staff-session-picker-layout">
            <div className="staff-session-picker-calendar" aria-label="Session calendar">
              <div className="staff-session-picker-weekdays" aria-hidden="true">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
              </div>
              <div className="staff-session-picker-days">
                {calendarDays.map((date, index) => date ? (
                  <button
                    aria-label={`${date}. ${sessionCountByDate.get(date) || 0} sessions`}
                    className={[
                      date === selectedDate ? 'active' : '',
                      sessionCountByDate.has(date) ? 'has-sessions' : '',
                    ].filter(Boolean).join(' ')}
                    key={date}
                    onClick={() => {
                      setSelectedDate(date)
                      setSelectedSessionId('')
                    }}
                    type="button"
                  >
                    <span>{Number(date.slice(-2))}</span>
                    {sessionCountByDate.has(date) && <i aria-hidden="true">{sessionCountByDate.get(date)}</i>}
                  </button>
                ) : <span aria-hidden="true" key={`blank-${index}`} />)}
              </div>
            </div>

            <div className="staff-session-picker-list" role="radiogroup" aria-label="Sessions on selected date">
              {!selectedDate || daySessions.length === 0 ? (
                <div className="staff-session-picker-state">
                  <CalendarDays aria-hidden="true" size={22} />
                  No sessions on this date.
                </div>
              ) : daySessions.map((session) => {
                const queued = pendingSessionIds.has(session.id)
                const unavailable = session.status === 'cancelled' || session.alreadyAdded || queued
                const stateLabel = session.alreadyAdded
                  ? 'Already added'
                  : queued
                    ? 'Queued'
                    : session.status === 'cancelled'
                      ? 'Cancelled'
                      : session.status
                return (
                  <button
                    aria-checked={selectedSessionId === session.id}
                    className={selectedSessionId === session.id ? 'active' : ''}
                    disabled={unavailable}
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    role="radio"
                    type="button"
                  >
                    <span className="staff-session-picker-time">{formatTime(session.startTime)}</span>
                    <span>
                      <strong>{session.name}</strong>
                      <small>{session.gameName || session.ticketType || session.bookingType || 'Session'}</small>
                    </span>
                    <em>{stateLabel}</em>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <footer>
          <button className="secondary" onClick={onClose} type="button">Cancel</button>
          <button
            className="primary"
            disabled={!selectedSession}
            onClick={() => selectedSession && onValidate(selectedSession)}
            type="button"
          >
            <Check aria-hidden="true" size={17} />
            Validate
          </button>
        </footer>
      </section>
    </div>
  )
}
