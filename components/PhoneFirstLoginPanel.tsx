'use client'

import { Mail } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import type { TranslationMap } from '@/lib/i18n/loadTranslation'

type Props = {
  email: string
  isSaving: boolean
  maskedEmail: string
  onEmailChange: (email: string) => void
  onLogout: () => void
  onResetEmail: () => void
  onSend: () => void
  status: string
  text: TranslationMap
}

export default function PhoneFirstLoginPanel({
  email,
  isSaving,
  maskedEmail,
  onEmailChange,
  onLogout,
  onResetEmail,
  onSend,
  status,
  text,
}: Props) {
  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) onSend()
  }

  return (
    <section className="section profile-auth-section phone-first-login-section">
      <div className="phone-first-login-icon"><Mail aria-hidden="true" size={24} /></div>
      <span className="phone-first-login-eyebrow">{text.phoneSetupTitle}</span>
      <h2>{maskedEmail ? text.phoneSetupSentTitle : text.phoneSetupTitle}</h2>
      {maskedEmail ? (
        <>
          <p className="muted">{text.phoneSetupSentBody.replace('{email}', maskedEmail)}</p>
          <button className="secondary create-button" onClick={onResetEmail} type="button">
            {text.phoneSetupResend}
          </button>
        </>
      ) : (
        <>
          <p className="muted">{text.phoneSetupIntro}</p>
          <div className="phone-first-login-form">
            <label>
              <span>{text.phoneSetupEmailLabel}</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => onEmailChange(event.target.value)}
                onKeyDown={submitOnEnter}
                placeholder="customer@example.com"
                type="email"
                value={email}
              />
            </label>
            <p className="field-help">{text.phoneSetupEmailHelp}</p>
            <button className={isSaving ? 'primary create-button loading' : 'primary create-button'} disabled={isSaving} onClick={onSend} type="button">
              {isSaving ? text.phoneSetupSending : text.phoneSetupSend}
            </button>
          </div>
        </>
      )}
      {status && <p className="notice compact-notice" role="status">{status}</p>}
      <button className="auth-inline-link phone-first-login-logout" onClick={onLogout} type="button">{text.logOut}</button>
    </section>
  )
}
