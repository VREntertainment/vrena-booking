'use client'

import { useEffect, useRef, useState } from 'react'
import { normalizeTime, normalizeTypedStaffDuration, normalizeTypedStaffTime, staffDateLabel, staffTimeOptions } from '../../lib/staff/dates.ts'
import type { StaffPickerFieldProps } from '../../lib/staff/types.ts'

export function StaffPickerField({ ariaLabel, type, value, mode = 'clock', minTime, maxTime, placeholder, inputRef, onChange }: StaffPickerFieldProps) {
  const displayValue = type === 'date' ? staffDateLabel(value) : normalizeTime(value)
  const fallback = placeholder || (type === 'date' ? 'Choose date' : 'Choose time')
  const [timeOpen, setTimeOpen] = useState(false)
  const [timeDraft, setTimeDraft] = useState<string | null>(null)
  const timePickerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!timeOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (timePickerRef.current?.contains(event.target as Node)) return
      setTimeOpen(false)
      setTimeDraft(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setTimeOpen(false)
      setTimeDraft(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [timeOpen])

  if (type === 'time') {
    const normalizedTime = normalizeTime(value)
    const manualTime = timeDraft ?? normalizedTime

    const withinHours = (time: string) => (!minTime || time >= minTime) && (!maxTime || time <= maxTime)
    const options = staffTimeOptions.filter(withinHours)

    const commitManualTime = () => {
      if (timeDraft === null) return
      const normalizedDraft = mode === 'duration'
        ? normalizeTypedStaffDuration(timeDraft)
        : normalizeTypedStaffTime(timeDraft)
      if (normalizedDraft && withinHours(normalizedDraft)) onChange(normalizedDraft)
      setTimeDraft(null)
      setTimeOpen(false)
    }

    return (
      <span ref={timePickerRef} className={displayValue ? 'staff-picker-shell staff-time-picker' : 'staff-picker-shell staff-time-picker placeholder'}>
        <button
          aria-expanded={timeOpen}
          aria-label={ariaLabel}
          className="staff-time-trigger"
          type="button"
          onClick={() => {
            setTimeOpen((open) => !open)
            setTimeDraft(null)
          }}
        >
          <span className="staff-picker-display">{displayValue || fallback}</span>
        </button>
        {timeOpen ? (
          <span className="staff-time-panel">
            <input
              aria-label={`${ariaLabel}: type a specific time`}
              autoFocus
              className="staff-time-manual"
              inputMode="numeric"
              placeholder="HH:mm"
              value={manualTime}
              onBlur={commitManualTime}
              onChange={(event) => setTimeDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitManualTime()
                }
              }}
            />
            <span aria-label={ariaLabel} className="staff-time-option-list" role="listbox">
              {options.map((option) => (
                <button
                  aria-selected={normalizedTime === option}
                  className={normalizedTime === option ? 'staff-time-option active' : 'staff-time-option'}
                  key={option}
                  role="option"
                  type="button"
                  onClick={() => {
                    onChange(option)
                    setTimeDraft(null)
                    setTimeOpen(false)
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {option}
                </button>
              ))}
            </span>
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <span className={displayValue ? 'staff-picker-shell' : 'staff-picker-shell placeholder'}>
      <input
        aria-label={ariaLabel}
        className="staff-picker-native"
        ref={inputRef}
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          event.currentTarget.blur()
        }}
      />
      <span className="staff-picker-display">{displayValue || fallback}</span>
    </span>
  )
}
