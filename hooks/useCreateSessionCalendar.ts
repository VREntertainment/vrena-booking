import { useEffect, useRef, useState } from 'react'
import type { CreateSessionMode } from '../components/CreateSessionView'

type LoadCalendarRange = (startDate: string, endDate: string, request: {
  signal: AbortSignal
  isCurrent: () => boolean
}) => Promise<unknown>

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
  const [calendarError, setCalendarError] = useState('')
  const calendarRequest = useRef(0)
  const pendingRequest = useRef<{ id: number; startDate: string; controller: AbortController } | null>(null)

  useEffect(() => () => {
    calendarRequest.current++
    pendingRequest.current?.controller.abort()
  }, [])

  async function loadCalendarWeek(startDate = calendarWeekStart, options: { background?: boolean } = {}) {
    // Focus, visibility and reconnect often arrive together on Android.
    if (options.background && pendingRequest.current?.startDate === startDate) return
    const weekEnd = addDaysToDateValue(startDate, 6)
    const request = ++calendarRequest.current
    pendingRequest.current?.controller.abort()
    const controller = new AbortController()
    pendingRequest.current = { id: request, startDate, controller }
    if (!options.background) setIsCalendarLoading(true)
    let timeout: number | undefined
    try {
      if (!navigator.onLine) throw new Error('offline')
      await Promise.race([
        loadCalendarRange(startDate, weekEnd, {
          signal: controller.signal,
          isCurrent: () => request === calendarRequest.current && !controller.signal.aborted,
        }),
        new Promise<never>((_, reject) => {
          timeout = window.setTimeout(() => {
            controller.abort()
            reject(new Error('timeout'))
          }, 15_000)
        }),
      ])
      if (request === calendarRequest.current) setCalendarError('')
    } catch (error) {
      if (request === calendarRequest.current) {
        setCalendarError(error instanceof Error ? error.message : String(error))
        if (!options.background) onCreateStatusChange('')
      }
    } finally {
      window.clearTimeout(timeout)
      if (request === calendarRequest.current) {
        pendingRequest.current = null
        setIsCalendarLoading(false)
      }
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
    calendarError,
    createSessionMode,
    handleCreateSessionModeChange,
    loadCalendarWeek,
    moveCalendarWeek,
    openCreateSessionCalendar,
    startSessionFromCalendar,
  }
}
