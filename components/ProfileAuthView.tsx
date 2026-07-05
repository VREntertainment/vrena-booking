import type { ReactNode } from 'react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type AuthMode = 'login' | 'create' | 'reset'
type AuthToggleMode = Exclude<AuthMode, 'reset'>

type ProfileAuthViewProps = {
  authMode: AuthMode
  children: ReactNode
  isRecoveryMode: boolean
  mfaRequired: boolean
  onAuthModeChange: (mode: AuthToggleMode) => void
  profileExists: boolean
  unframed?: boolean
  text: TranslationMap
}

export default function ProfileAuthView({
  authMode,
  children,
  isRecoveryMode,
  mfaRequired,
  onAuthModeChange,
  profileExists,
  unframed = false,
  text,
}: ProfileAuthViewProps) {
  return (
    <section className={[
      'section',
      !profileExists ? 'profile-auth-section' : 'profile-account-section',
      profileExists && unframed ? 'profile-account-section-unframed' : '',
    ].filter(Boolean).join(' ')}>
      {!profileExists && (
        <>
          <h2>{isRecoveryMode ? text.setNewPasswordTitle : authMode === 'reset' ? text.resetPasswordTitle : text.authWelcomeTitle}</h2>
          {(isRecoveryMode || authMode === 'reset') && (
            <p className="muted">
              {isRecoveryMode ? text.setNewPasswordIntro : text.resetPasswordIntro}
            </p>
          )}
        </>
      )}

      {!mfaRequired && !profileExists && !isRecoveryMode && authMode !== 'reset' && (
        <div className="segmented auth-toggle">
          <button
            className={authMode === 'login' ? 'active' : ''}
            onClick={() => onAuthModeChange('login')}
            type="button"
          >
            {text.logIn}
          </button>
          <button
            className={authMode === 'create' ? 'active' : ''}
            onClick={() => onAuthModeChange('create')}
            type="button"
          >
            {text.createAccountTab}
          </button>
        </div>
      )}

      {children}
    </section>
  )
}
