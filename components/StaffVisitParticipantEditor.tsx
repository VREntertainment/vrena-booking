'use client'

import { useState } from 'react'
import type { StaffSessionParticipant } from '../lib/staff/types'
import { visitCopy } from '../lib/staffVisit'

const numericFields = ['payment_amount', 'score', 'accuracy_percent', 'hits', 'movement_meters', 'escape_duration_seconds', 'placement'] as const

export default function StaffVisitParticipantEditor({ participant, language, disabled, future, isEscape, onSave }: {
  participant: StaffSessionParticipant
  language: 'en' | 'vi'
  disabled: boolean
  future: boolean
  isEscape: boolean
  onSave: (patch: Partial<StaffSessionParticipant>) => Promise<boolean>
}) {
  const text = visitCopy[language]
  const [arrived, setArrived] = useState(Boolean(participant.checked_in))
  const [method, setMethod] = useState(participant.payment_status || '')
  const [values, setValues] = useState(() => Object.fromEntries(numericFields.map((key) => [key, (key === 'hits' ? participant.hits ?? participant.projectiles_fired : participant[key]) == null ? '' : String(key === 'hits' ? participant.hits ?? participant.projectiles_fired : participant[key])])) as Record<typeof numericFields[number], string>)
  const [feedback, setFeedback] = useState('')
  const [pending, setPending] = useState(false)
  const labels = { payment_amount: text.amount, score: text.score, accuracy_percent: text.accuracy, hits: text.hits, movement_meters: text.movement, escape_duration_seconds: text.escape, placement: text.place }
  return (
    <form className="staff-visit-editor" onSubmit={async (event) => {
      event.preventDefault()
      if (pending || disabled) return
      if ((method === 'cash' || method === 'bank_transfer') && values.payment_amount === '') {
        setFeedback(text.missingAmount)
        return
      }
      setPending(true)
      setFeedback('')
      try {
        const patch: Partial<StaffSessionParticipant> = { checked_in: arrived, payment_status: method }
        for (const key of numericFields) patch[key] = values[key] === '' ? null : Number(values[key])
        if (method === 'free') patch.payment_amount = 0
        const saved = await onSave(patch)
        setFeedback(saved ? text.saved : text.error)
      } catch {
        setFeedback(text.error)
      } finally {
        setPending(false)
      }
    }}>
      <fieldset disabled={disabled || pending}>
        <div className="staff-operation-field-grid compact">
          <label>{text.arrival}<input type="checkbox" checked={arrived} disabled={future && !arrived} onChange={(event) => setArrived(event.target.checked)} /></label>
          <label>{text.method}<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="">{text.none}</option><option value="cash">{text.cash}</option><option value="bank_transfer">{text.bank}</option><option value="free">{text.free}</option></select></label>
          {numericFields.filter((key) => key !== 'escape_duration_seconds' || isEscape).map((key) => (
            <label key={key}>{labels[key]}<input type="number" min={key === 'placement' || key === 'escape_duration_seconds' ? 1 : 0} max={key === 'accuracy_percent' ? 100 : key === 'placement' ? 3 : undefined} step={key === 'accuracy_percent' || key === 'movement_meters' ? 'any' : 1} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></label>
          ))}
        </div>
        {future && <p>{text.future}</p>}
        <button type="submit">{text.save}</button>
      </fieldset>
      {feedback && <p role="status">{feedback}</p>}
    </form>
  )
}
