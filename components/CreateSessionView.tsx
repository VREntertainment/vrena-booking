import type { ReactNode } from 'react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type CreateSessionMode = 'calendar' | 'form'

type CreateSessionViewProps = {
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
    <section className="section">
      <div className="section-head">
        <div>
          <h2>{text.createSessionTitle}</h2>
          <p className="muted">{text.createSessionHint}</p>
        </div>
      </div>

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
