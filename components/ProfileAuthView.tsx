import type { ReactNode } from 'react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type AuthMode = 'login' | 'create' | 'reset'
type AuthToggleMode = Exclude<AuthMode, 'reset'>

type ProfileAuthViewProps = {
  authMode: AuthMode
  children: ReactNode
  isRecoveryMode: boolean
  loading?: boolean
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
  loading = false,
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
      loading ? 'profile-auth-section-loading' : '',
      profileExists && unframed ? 'profile-account-section-unframed' : '',
    ].filter(Boolean).join(' ')}>
      {!loading && !profileExists && (
        <>
          <h2>{isRecoveryMode ? text.setNewPasswordTitle : authMode === 'reset' ? text.resetPasswordTitle : text.authWelcomeTitle}</h2>
          {(isRecoveryMode || authMode === 'reset') && (
            <p className="muted">
              {isRecoveryMode ? text.setNewPasswordIntro : text.resetPasswordIntro}
            </p>
          )}
        </>
      )}

      {!loading && !mfaRequired && !profileExists && !isRecoveryMode && authMode !== 'reset' && (
        <div className="auth-entry-stack">
          <div className="auth-benefit-strip">
            <strong>{text.authWelcomeBody}</strong>
            <div>
              <span>{text.authBenefitBookings}</span>
              <span>{text.authBenefitLoyalty}</span>
              <span>{text.authBenefitBirthday}</span>
            </div>
          </div>
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
        </div>
      )}

      {children}
    </section>
  )
}
