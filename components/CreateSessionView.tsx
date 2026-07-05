import type { ReactNode } from 'react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type CreateSessionMode = 'calendar' | 'form'

export type CreateSessionViewProps = {
  children: ReactNode
  createStatus: string
  mode: CreateSessionMode
  onModeChange: (mode: CreateSessionMode) => void
  text: TranslationMap
}

export default function CreateSessionView({
  children,
  createStatus,
  mode,
  onModeChange,
  text,
}: CreateSessionViewProps) {
  return (
    <section className="section create-session-section">
      <div className="segmented create-session-mode-toggle" aria-label={text.createSessionTitle}>
        <button className={mode === 'calendar' ? 'active' : ''} onClick={() => onModeChange('calendar')} type="button">
          {text.calendar}
        </button>
        <button className={mode === 'form' ? 'active' : ''} onClick={() => onModeChange('form')} type="button">
          {text.createSession}
        </button>
      </div>

      {children}
      {createStatus && <p className="notice">{createStatus}</p>}
    </section>
  )
}
