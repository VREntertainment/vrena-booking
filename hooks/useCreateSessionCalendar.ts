import { useState } from 'react'
import type { CreateSessionMode } from '../components/CreateSessionView'

type LoadCalendarRange = (startDate: string, endDate: string) => Promise<unknown>

type UseCreateSessionCalendarOptions = {
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
  const [createSessionMode, setCreateSessionMode] = useState<CreateSessionMode>('form')
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeekDateValue(getLocalDateString()))

  async function loadCalendarWeek(startDate = calendarWeekStart) {
    const weekEnd = addDaysToDateValue(startDate, 6)
    await loadCalendarRange(startDate, weekEnd)
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
    createSessionMode,
    handleCreateSessionModeChange,
    loadCalendarWeek,
    moveCalendarWeek,
    openCreateSessionCalendar,
    startSessionFromCalendar,
  }
}
