import { Share } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { languageOptions, type LanguageCode } from '../lib/i18n/languages'
import { storeLanguage } from '../lib/i18n/detectLanguage'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import ContactChannels from './ContactChannels'

export type AppView = 'sessions' | 'tickets' | 'create' | 'leaderboard' | 'clubs' | 'profile' | 'staff'

type AppSidebarProps = {
  activeView: AppView
  canAccessStaffConsole: boolean
  isChampion: boolean
  language: LanguageCode
  onLanguageChange: (language: LanguageCode) => void
  onShareApp: () => void
  onViewChange: (view: AppView) => void
  profileAvatar: ReactNode
  profileAvatarStyle?: CSSProperties
  profileSubtitle: string
  profileTitle: string
  sharedApp: boolean
  text: TranslationMap
}

function ShareSymbol() {
  return <Share aria-hidden="true" className="share-symbol-icon" size={26} strokeWidth={2.2} />
}

export default function AppSidebar({
  activeView,
  canAccessStaffConsole,
  isChampion,
  language,
  onLanguageChange,
  onShareApp,
  onViewChange,
  profileAvatar,
  profileAvatarStyle,
  profileSubtitle,
  profileTitle,
  sharedApp,
  text,
}: AppSidebarProps) {
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)

  function selectLanguage(nextLanguage: LanguageCode) {
    onLanguageChange(nextLanguage)
    storeLanguage(nextLanguage)
    setLanguagePickerOpen(false)
  }

  return (
    <aside>
      <div>
        <div className="app-title-row">
          <a className="brand-logo" href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer" aria-label="VRena Vietnam">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-logo-full-dark.svg" />
              <img src="/brand/vrena-logo-full-light.svg" alt="VRena" />
            </picture>
          </a>
          <div className="language-picker">
            <button
              aria-expanded={languagePickerOpen}
              aria-label={text.language}
              type="button"
              onClick={() => setLanguagePickerOpen((open) => !open)}
            >
              {language.toUpperCase()}
            </button>
            {languagePickerOpen && (
              <div className="language-menu">
                {languageOptions.map((item) => (
                  <button
                    className={language === item ? 'active' : ''}
                    key={item}
                    aria-pressed={language === item}
                    type="button"
                    onClick={() => selectLanguage(item)}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            aria-label={sharedApp ? text.shared : text.shareApp}
            className={sharedApp ? 'share-button app-share copied' : 'share-button app-share'}
            title={sharedApp ? text.shared : text.shareApp}
            type="button"
            onClick={onShareApp}
          >
            <ShareSymbol />
          </button>
        </div>
        <h1 className="sr-only">VRena Sessions</h1>
        <p className="muted">{text.tagline}</p>
      </div>

      <button className={activeView === 'profile' ? 'profile-chip active' : 'profile-chip'} data-tour="profile-card" onClick={() => onViewChange('profile')} type="button">
        <div className="avatar" style={profileAvatarStyle}>
          {profileAvatar}
          {isChampion && <span className="champion-badge">🏆</span>}
        </div>
        <div>
          <strong>{profileTitle}</strong>
          <span>{profileSubtitle}</span>
        </div>
      </button>

      <div className="tabs">
        <button className={activeView === 'sessions' || activeView === 'create' ? 'tab active' : 'tab'} onClick={() => onViewChange('sessions')}>
          {text.sessions}
        </button>
        <button className={activeView === 'tickets' ? 'tab active' : 'tab'} onClick={() => onViewChange('tickets')}>
          {text.tickets}
        </button>
        <button className={activeView === 'leaderboard' ? 'tab active' : 'tab'} data-tour="hall-of-fame-tab" onClick={() => onViewChange('leaderboard')}>
          {text.hallOfFame}
        </button>
        <button className={activeView === 'clubs' ? 'tab active' : 'tab'} onClick={() => onViewChange('clubs')}>
          {text.clubs}
        </button>
        {canAccessStaffConsole && (
          <button className={activeView === 'staff' ? 'tab sidebar-staff-tab active' : 'tab sidebar-staff-tab'} onClick={() => onViewChange('staff')}>
            {language === 'vi' ? 'Nhân viên' : 'Staff'}
          </button>
        )}
      </div>

      <div className="shop-contact">
        <strong>VRena Vietnam</strong>
        <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
        <ContactChannels label={text.contactUs} />
        <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
      </div>
    </aside>
  )
}
