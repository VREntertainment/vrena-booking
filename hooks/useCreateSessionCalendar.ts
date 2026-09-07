import { useRef, useState } from 'react'
import type { CreateSessionMode } from '../components/CreateSessionView'

type LoadCalendarRange = (startDate: string, endDate: string) => Promise<unknown>

type UseCreateSessionCalendarOptions = {
  initialCalendarDate?: string
  addDaysToDateValue: (dateValue: string, days: number) => string
  getLocalDateString: () => string
  onActiveViewChange: (view: 'create') => void
  onCreateStatusChange: (status: string) => void
  onSessionDateChange: (dateValue: string) => void
  onSessionTimeChange: (timeValue: string) => void
  requireProfile: () => boolean
  scrollToCalendarPanel: () => void
  scrollToCreateForm: () => void
  startOfWeekDateValue: (dateValue: string) => string
  loadCalendarRange: LoadCalendarRange
}

export function useCreateSessionCalendar({
  initialCalendarDate,
  addDaysToDateValue,
  getLocalDateString,
  loadCalendarRange,
  onActiveViewChange,
  onCreateStatusChange,
  onSessionDateChange,
  onSessionTimeChange,
  requireProfile,
  scrollToCalendarPanel,
  scrollToCreateForm,
  startOfWeekDateValue,
}: UseCreateSessionCalendarOptions) {
  const [createSessionMode, setCreateSessionMode] = useState<CreateSessionMode>(initialCalendarDate ? 'calendar' : 'form')
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeekDateValue(initialCalendarDate || getLocalDateString()))
  const [isCalendarLoading, setIsCalendarLoading] = useState(Boolean(initialCalendarDate))
  const calendarRequest = useRef(0)

  async function loadCalendarWeek(startDate = calendarWeekStart) {
    const weekEnd = addDaysToDateValue(startDate, 6)
    const request = ++calendarRequest.current
    setIsCalendarLoading(true)
    try {
      await loadCalendarRange(startDate, weekEnd)
    } catch (error) {
      if (request === calendarRequest.current) onCreateStatusChange(error instanceof Error ? error.message : String(error))
    } finally {
      if (request === calendarRequest.current) setIsCalendarLoading(false)
    }
  }

  function startSessionFromCalendar(dateValue: string, timeValue: string) {
    if (!requireProfile()) return

    onSessionDateChange(dateValue)
    onSessionTimeChange(timeValue)
    onCreateStatusChange('')
    setCreateSessionMode('form')
    scrollToCreateForm()
  }

  function showCalendarMode() {
    setCreateSessionMode('calendar')
    void loadCalendarWeek(calendarWeekStart)
  }

  function openCreateSessionCalendar(dateValue = getLocalDateString()) {
    const targetWeekStart = startOfWeekDateValue(dateValue)
    onActiveViewChange('create')
    setCreateSessionMode('calendar')
    setCalendarWeekStart(targetWeekStart)
    void loadCalendarWeek(targetWeekStart)
    scrollToCalendarPanel()
  }

  function showCreateFormMode() {
    setCreateSessionMode('form')
  }

  function handleCreateSessionModeChange(mode: CreateSessionMode) {
    if (mode === 'calendar') {
      showCalendarMode()
      return
    }
    showCreateFormMode()
  }

  function moveCalendarWeek(dayOffset: number) {
    const nextWeekStart = addDaysToDateValue(calendarWeekStart, dayOffset)
    setCalendarWeekStart(nextWeekStart)
    void loadCalendarWeek(nextWeekStart)
  }

  return {
    calendarWeekStart,
    isCalendarLoading,
    createSessionMode,
    handleCreateSessionModeChange,
    loadCalendarWeek,
    moveCalendarWeek,
    openCreateSessionCalendar,
    startSessionFromCalendar,
  }
}
