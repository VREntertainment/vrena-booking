import { Search, X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type SessionTimeScope = 'upcoming' | 'past'

type SessionDayOption = {
  day: string
  value: string
  weekday: string
}

type SessionsViewProps = {
  children: ReactNode
  createStatus: string
  dayStripRef: RefObject<HTMLDivElement | null>
  filteredSessionCount: number
  hasMoreUpcomingSessions: boolean
  isEnablingPush: boolean
  isLoadingMoreSessions: boolean
  isLoadingPastSessions: boolean
  isPushSubscribed: boolean
  isSearchOpen: boolean
  onClearSearch: () => void
  onCreateSession: () => void
  onEnablePushReminders: () => void
  onSearchChange: (value: string) => void
  onSearchOpenChange: (open: boolean | ((open: boolean) => boolean)) => void
  onSelectedSessionDateChange: (value: string) => void
  onSessionTimeScopeChange: (scope: SessionTimeScope) => void
  pushReminderStatus: string
  search: string
  searchShellRef: RefObject<HTMLDivElement | null>
  selectedSessionDate: string
  sessionDayOptions: SessionDayOption[]
  sessionReminderItems: ReactNode
  sessionRemindersVisible: boolean
  sessionTimeScope: SessionTimeScope
  tariffTrigger: ReactNode
  text: TranslationMap
}

export default function SessionsView({
  children,
  createStatus,
  dayStripRef,
  filteredSessionCount,
  hasMoreUpcomingSessions,
  isEnablingPush,
  isLoadingMoreSessions,
  isLoadingPastSessions,
  isPushSubscribed,
  isSearchOpen,
  onClearSearch,
  onCreateSession,
  onEnablePushReminders,
  onSearchChange,
  onSearchOpenChange,
  onSelectedSessionDateChange,
  onSessionTimeScopeChange,
  pushReminderStatus,
  search,
  searchShellRef,
  selectedSessionDate,
  sessionDayOptions,
  sessionReminderItems,
  sessionRemindersVisible,
  sessionTimeScope,
  tariffTrigger,
  text,
}: SessionsViewProps) {
  const hasActiveSearchFilter = Boolean(isSearchOpen || search || selectedSessionDate)

  return (
    <section className="section sessions-section" data-tour="sessions-list">
      <div className="section-head sessions-filter-head">
        <div className="section-copy">
          <h2>{text.availableSessions}</h2>
          <p className="muted">{text.privateJoinHint}</p>
        </div>
        <div className={isSearchOpen ? 'search-shell open' : 'search-shell'} ref={searchShellRef}>
          <button
            aria-label={text.searchSessions}
            className="mobile-search-toggle"
            type="button"
            onClick={() => onSearchOpenChange((open) => !open)}
          >
            <Search aria-hidden="true" size={24} strokeWidth={2.35} />
          </button>
          <input
            className="search"
            type="search"
            placeholder={text.searchPlaceholder}
            value={search}
            onFocus={() => onSearchOpenChange(true)}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {hasActiveSearchFilter && (
            <button
              aria-label={text.close}
              className="search-close"
              type="button"
              onClick={onClearSearch}
            >
              <X aria-hidden="true" size={18} />
            </button>
          )}
        </div>
      </div>

      {hasActiveSearchFilter && (
        <div className="day-strip" aria-label={text.date} ref={dayStripRef}>
          <button
            className={!selectedSessionDate ? 'day-chip active' : 'day-chip'}
            type="button"
            onClick={() => onSelectedSessionDateChange('')}
          >
            <strong>{text.allDays}</strong>
          </button>
          {sessionDayOptions.map((day) => (
            <button
              className={selectedSessionDate === day.value ? 'day-chip active' : 'day-chip'}
              key={day.value}
              type="button"
              onClick={() => onSelectedSessionDateChange(day.value)}
            >
              <span>{day.weekday}</span>
              <strong>{day.day}</strong>
            </button>
          ))}
        </div>
      )}

      {tariffTrigger}
      {createStatus && <p className="notice">{createStatus}</p>}

      {sessionRemindersVisible && (
        <div className="reminder-strip" aria-label={text.sessionReminders}>
          <div className="reminder-strip-head">
            <strong>{text.sessionReminders}</strong>
            <button
              className={isPushSubscribed ? 'secondary small-button' : 'primary small-button'}
              disabled={isEnablingPush || isPushSubscribed}
              type="button"
              onClick={onEnablePushReminders}
            >
              {isPushSubscribed ? text.remindersEnabled : isEnablingPush ? text.enablingReminders : text.enableReminders}
            </button>
          </div>
          {pushReminderStatus && <small className="push-reminder-status">{pushReminderStatus}</small>}
          {sessionReminderItems}
        </div>
      )}

      <div className="sub-tabs">
        <button
          className={sessionTimeScope === 'upcoming' ? 'active' : ''}
          type="button"
          onClick={() => {
            onSessionTimeScopeChange('upcoming')
            onSelectedSessionDateChange('')
          }}
        >
          {text.upcoming}
        </button>
        <button
          className={sessionTimeScope === 'past' ? 'active' : ''}
          type="button"
          onClick={() => {
            onSessionTimeScopeChange('past')
            onSelectedSessionDateChange('')
          }}
        >
          {text.past}
        </button>
        <button
          className="create-session-tab"
          data-tour="create-session-button"
          type="button"
          onClick={onCreateSession}
        >
          {text.createSession}
        </button>
      </div>

      <div className="list">
        {filteredSessionCount === 0 && !(sessionTimeScope === 'past' && isLoadingPastSessions) && <p className="notice">{text.noMatchingSessions}</p>}
        {sessionTimeScope === 'past' && isLoadingPastSessions && <p className="notice" aria-busy="true">...</p>}
        {children}
        {sessionTimeScope === 'upcoming' && hasMoreUpcomingSessions && (
          <div className="session-load-more" aria-busy={isLoadingMoreSessions}>
            {isLoadingMoreSessions ? '...' : ''}
          </div>
        )}
      </div>
    </section>
  )
}
