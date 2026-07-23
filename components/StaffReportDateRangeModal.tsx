'use client'

import { CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useState, type ComponentType, type ReactNode } from 'react'

type StaffReportRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30'
  | 'last_60'
  | 'last_90'

type StaffPickerFieldComponent = ComponentType<{
  ariaLabel: string
  type: 'date' | 'time'
  value: string
  mode?: 'clock' | 'duration'
  placeholder?: string
  onChange: (value: string) => void
}>

type ButtonIconTextComponent = ComponentType<{
  children: ReactNode
  icon: ReactNode
}>

type StaffReportDateRangeText = {
  actions: {
    apply: string
    cancel: string
  }
  aria: {
    closeReportCalendar: string
    compareEndDate: string
    compareStartDate: string
    nextReportMonth: string
    previousReportMonth: string
    reportEndDate: string
    reportStartDate: string
  }
  chooseDate: string
  labels: {
    compare: string
    compareEditingHint: string
    compareInactiveHint: string
    compareRange: string
    editingRange: string
    endDate: string
    off: string
    referenceRange: string
    reportRange: string
    selectedRange: string
    startDate: string
  }
  reportRangePresets: Readonly<Record<StaffReportRangePreset, string>>
  reportWeekdays: readonly string[]
}

type StaffReportDateRangeModalProps = {
  ButtonIconText: ButtonIconTextComponent
  StaffPickerField: StaffPickerFieldComponent
  text: StaffReportDateRangeText
  reportStart: string
  reportEnd: string
  compareEnabled: boolean
  compareStart: string
  compareEnd: string
  initialRangeTarget: 'report' | 'compare'
  onApply: (reportStart: string, reportEnd: string, compareEnabled: boolean, compareStart: string, compareEnd: string) => void
  onClose: () => void
}

const staffReportPresetOptions: StaffReportRangePreset[] = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30', 'last_60', 'last_90']
const staffMonthFormatter = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateFromInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year || 1970, (month || 1) - 1, day || 1)
}

function todayString() {
  return dateInputValue(new Date())
}

function addDays(value: string, days: number) {
  const date = dateFromInput(value)
  date.setDate(date.getDate() + days)
  return dateInputValue(date)
}

function addMonths(value: string, months: number) {
  const date = dateFromInput(value)
  date.setMonth(date.getMonth() + months)
  return dateInputValue(date)
}

function orderedRange(start: string, end: string) {
  return start <= end ? [start, end] : [end, start]
}

function startOfWeek(value: string) {
  const date = dateFromInput(value)
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addDays(dateInputValue(date), mondayOffset)
}

function startOfMonth(value: string) {
  const date = dateFromInput(value)
  return dateInputValue(new Date(date.getFullYear(), date.getMonth(), 1))
}

function endOfMonth(value: string) {
  const date = dateFromInput(value)
  return dateInputValue(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function previousPeriodRange(start: string, end: string) {
  const [from, to] = orderedRange(start, end)
  const length = Math.max(1, Math.round((dateFromInput(to).getTime() - dateFromInput(from).getTime()) / 86400000) + 1)
  return [addDays(from, -length), addDays(to, -length)]
}

function reportPresetRange(preset: StaffReportRangePreset, anchor = todayString()) {
  const weekStart = startOfWeek(anchor)
  const monthStart = startOfMonth(anchor)
  if (preset === 'today') return [anchor, anchor]
  if (preset === 'yesterday') return [addDays(anchor, -1), addDays(anchor, -1)]
  if (preset === 'this_week') return [weekStart, addDays(weekStart, 6)]
  if (preset === 'last_week') return [addDays(weekStart, -7), addDays(weekStart, -1)]
  if (preset === 'this_month') return [monthStart, endOfMonth(anchor)]
  if (preset === 'last_month') {
    const previousMonth = addMonths(monthStart, -1)
    return [previousMonth, endOfMonth(previousMonth)]
  }
  if (preset === 'last_60') return [addDays(anchor, -59), anchor]
  if (preset === 'last_90') return [addDays(anchor, -89), anchor]
  return [addDays(anchor, -29), anchor]
}

function monthLabel(value: string) {
  return staffMonthFormatter.format(dateFromInput(value))
}

function reportCalendarCells(monthValue: string) {
  const start = startOfMonth(monthValue)
  const firstDate = dateFromInput(start)
  const startOffset = (firstDate.getDay() + 6) % 7
  const gridStart = addDays(start, -startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    return {
      date,
      day: String(dateFromInput(date).getDate()),
      inMonth: date.slice(0, 7) === start.slice(0, 7),
    }
  })
}

function rangeLabel(start: string, end: string) {
  return start === end ? start : `${start} - ${end}`
}

export default function StaffReportDateRangeModal({
  ButtonIconText,
  StaffPickerField,
  text,
  reportStart,
  reportEnd,
  compareEnabled,
  compareStart,
  compareEnd,
  initialRangeTarget,
  onApply,
  onClose,
}: StaffReportDateRangeModalProps) {
  const [draftStart, setDraftStart] = useState(reportStart)
  const [draftEnd, setDraftEnd] = useState(reportEnd)
  const [draftCompareEnabled, setDraftCompareEnabled] = useState(compareEnabled)
  const [draftCompareStart, setDraftCompareStart] = useState(compareStart)
  const [draftCompareEnd, setDraftCompareEnd] = useState(compareEnd)
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(reportStart))
  const [rangeTarget, setRangeTarget] = useState<'report' | 'compare'>(initialRangeTarget)
  const nextMonth = addMonths(visibleMonth, 1)
  const [orderedStart, orderedEnd] = orderedRange(draftStart, draftEnd)
  const [orderedCompareStart, orderedCompareEnd] = orderedRange(draftCompareStart, draftCompareEnd)
  const editingCompare = draftCompareEnabled && rangeTarget === 'compare'
  const activeRangeLabel = editingCompare ? text.labels.compareRange : text.labels.referenceRange

  function updateReportRange(start: string, end: string) {
    const [from, to] = orderedRange(start, end)
    setDraftStart(from)
    setDraftEnd(to)
    const [previousStart, previousEnd] = previousPeriodRange(from, to)
    setDraftCompareStart(previousStart)
    setDraftCompareEnd(previousEnd)
  }

  function updateActiveRangeStart(value: string) {
    if (editingCompare) {
      const [from, to] = orderedRange(value, draftCompareEnd)
      setDraftCompareStart(from)
      setDraftCompareEnd(to)
      return
    }

    updateReportRange(value, draftEnd)
  }

  function updateActiveRangeEnd(value: string) {
    if (editingCompare) {
      const [from, to] = orderedRange(draftCompareStart, value)
      setDraftCompareStart(from)
      setDraftCompareEnd(to)
      return
    }

    updateReportRange(draftStart, value)
  }

  function selectDate(date: string) {
    if (editingCompare) {
      if (date < orderedCompareStart || draftCompareStart !== draftCompareEnd) {
        setDraftCompareStart(date)
        setDraftCompareEnd(date)
      } else {
        const [from, to] = orderedRange(draftCompareStart, date)
        setDraftCompareStart(from)
        setDraftCompareEnd(to)
      }
      return
    }

    if (date < orderedStart || draftStart !== draftEnd) {
      updateReportRange(date, date)
    } else {
      updateReportRange(draftStart, date)
    }
  }

  function applyPreset(preset: StaffReportRangePreset) {
    const [from, to] = reportPresetRange(preset)
    updateReportRange(from, to)
    setVisibleMonth(startOfMonth(from))
    setRangeTarget('report')
  }

  function renderCalendarMonth(monthValue: string) {
    return (
      <div className="staff-report-calendar-month" key={monthValue}>
        <h4>{monthLabel(monthValue)}</h4>
        <div className="staff-report-calendar-weekdays" aria-hidden="true">
          {text.reportWeekdays.map((weekday: string) => (
            <span key={`${monthValue}-${weekday}`}>{weekday}</span>
          ))}
        </div>
        <div className="staff-report-calendar-days">
          {reportCalendarCells(monthValue).map((cell) => {
            const inReportRange = cell.date >= orderedStart && cell.date <= orderedEnd
            const isReportEdge = cell.date === orderedStart || cell.date === orderedEnd
            const inCompareRange = draftCompareEnabled && cell.date >= orderedCompareStart && cell.date <= orderedCompareEnd
            const isCompareEdge = draftCompareEnabled && (cell.date === orderedCompareStart || cell.date === orderedCompareEnd)
            return (
              <button
                className={[
                  'staff-report-calendar-day',
                  cell.inMonth ? '' : 'outside',
                  inReportRange ? 'in-range' : '',
                  isReportEdge ? 'range-edge' : '',
                  inCompareRange ? 'compare-range' : '',
                  isCompareEdge ? 'compare-edge' : '',
                ].filter(Boolean).join(' ')}
                key={cell.date}
                type="button"
                onClick={() => selectDate(cell.date)}
              >
                {cell.day}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="staff-report-date-modal-title" onClick={onClose}>
      <div className="login-modal staff-report-date-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label={text.aria.closeReportCalendar} onClick={onClose}>
          <X aria-hidden="true" size={20} />
        </button>
        <div className="staff-report-date-modal-head">
          <div>
            <h3 id="staff-report-date-modal-title">{text.labels.reportRange}</h3>
            <p>{text.labels.selectedRange}: {rangeLabel(orderedStart, orderedEnd)}</p>
          </div>
          <div className="staff-report-date-mode" role="tablist" aria-label={text.labels.editingRange}>
            <button
              aria-selected={!editingCompare}
              className={!editingCompare ? 'active' : ''}
              role="tab"
              type="button"
              onClick={() => setRangeTarget('report')}
            >
              <span>{text.labels.referenceRange}</span>
              <strong>{rangeLabel(orderedStart, orderedEnd)}</strong>
            </button>
            <button
              aria-selected={editingCompare}
              className={editingCompare ? 'active compare' : 'compare'}
              disabled={!draftCompareEnabled}
              role="tab"
              type="button"
              onClick={() => setRangeTarget('compare')}
            >
              <span>{text.labels.compareRange}</span>
              <strong>{draftCompareEnabled ? rangeLabel(orderedCompareStart, orderedCompareEnd) : text.labels.off}</strong>
            </button>
          </div>
        </div>

        <div className="staff-report-date-modal-body">
          <div className="staff-report-date-presets">
            {staffReportPresetOptions.map((preset) => {
              const [from, to] = reportPresetRange(preset)
              const active = from === orderedStart && to === orderedEnd
              return (
                <button className={active ? 'active' : ''} key={preset} type="button" onClick={() => applyPreset(preset)}>
                  {text.reportRangePresets[preset]}
                </button>
              )
            })}
          </div>
          <div className="staff-report-date-main">
            <div className="staff-report-active-range-head">
              <strong>{text.labels.editingRange}: {activeRangeLabel}</strong>
              <div className="staff-report-calendar-legend" aria-hidden="true">
                <span><i className="reference" />{text.labels.referenceRange}</span>
                <span><i className="compare" />{text.labels.compareRange}</span>
              </div>
            </div>
            <div className="staff-report-date-inputs">
              <label>
                <span>{text.labels.startDate}</span>
                <StaffPickerField
                  ariaLabel={editingCompare ? text.aria.compareStartDate : text.aria.reportStartDate}
                  placeholder={text.chooseDate}
                  type="date"
                  value={editingCompare ? draftCompareStart : draftStart}
                  onChange={updateActiveRangeStart}
                />
              </label>
              <label>
                <span>{text.labels.endDate}</span>
                <StaffPickerField
                  ariaLabel={editingCompare ? text.aria.compareEndDate : text.aria.reportEndDate}
                  placeholder={text.chooseDate}
                  type="date"
                  value={editingCompare ? draftCompareEnd : draftEnd}
                  onChange={updateActiveRangeEnd}
                />
              </label>
            </div>
            <div className="staff-report-calendar-nav">
              <button type="button" aria-label={text.aria.previousReportMonth} onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))}>
                <ChevronLeft aria-hidden="true" size={16} />
              </button>
              <span>{monthLabel(visibleMonth)} / {monthLabel(nextMonth)}</span>
              <button type="button" aria-label={text.aria.nextReportMonth} onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}>
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="staff-report-calendar-months">
              {renderCalendarMonth(visibleMonth)}
              {renderCalendarMonth(nextMonth)}
            </div>
            <div className="staff-report-date-compare">
              <label className="staff-compare-toggle">
                <input
                  type="checkbox"
                  checked={draftCompareEnabled}
                  onChange={(event) => {
                    setDraftCompareEnabled(event.target.checked)
                    if (event.target.checked) setRangeTarget('compare')
                    else setRangeTarget('report')
                  }}
                />
                {text.labels.compare}
              </label>
              {draftCompareEnabled && (
                <div className="staff-report-date-compare-fields">
                  <button className="staff-report-range-button compact" type="button" onClick={() => setRangeTarget('compare')}>
                    <span><CalendarRange aria-hidden="true" size={14} /> {text.labels.compareRange}</span>
                    <strong>{rangeLabel(orderedCompareStart, orderedCompareEnd)}</strong>
                  </button>
                  <p>{editingCompare ? text.labels.compareEditingHint : text.labels.compareInactiveHint}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="staff-report-date-modal-actions">
          <button className="secondary" type="button" onClick={onClose}>
            <ButtonIconText icon={<X aria-hidden="true" size={14} />}>{text.actions.cancel}</ButtonIconText>
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => onApply(orderedStart, orderedEnd, draftCompareEnabled, orderedCompareStart, orderedCompareEnd)}
          >
            {text.actions.apply}
          </button>
        </div>
      </div>
    </div>
  )
}
