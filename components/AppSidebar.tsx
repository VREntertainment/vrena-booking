import { BriefcaseBusiness, CalendarDays, Images, PanelLeftClose, PanelLeftOpen, ShieldCheck, Share, Ticket, Trophy, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { publicAppRoutes } from '../lib/appRoutes'
import { languageOptions, type LanguageCode } from '../lib/i18n/languages'
import { storeLanguage } from '../lib/i18n/detectLanguage'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import { vrenaGalleryUrl } from '../lib/siteMetadata'
import ContactChannels from './ContactChannels'

export type AppView = 'sessions' | 'tickets' | 'create' | 'leaderboard' | 'clubs' | 'profile' | 'hr' | 'staff'

type AppSidebarProps = {
  activeView: AppView
  canAccessStaffConsole: boolean
  consoleNavigationCollapsed: boolean
  isChampion: boolean
  language: LanguageCode
  onLanguageChange: (language: LanguageCode) => void
  onConsoleNavigationCollapsedChange: (collapsed: boolean) => void
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
  consoleNavigationCollapsed,
  isChampion,
  language,
  onLanguageChange,
  onConsoleNavigationCollapsedChange,
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
  const isConsoleView = activeView === 'staff' || activeView === 'hr'
  const navigationCollapsed = isConsoleView && consoleNavigationCollapsed
  const collapseLabel = language === 'vi' ? 'Thu gọn menu' : 'Collapse navigation'
  const expandLabel = language === 'vi' ? 'Mở rộng menu' : 'Expand navigation'

  function selectLanguage(nextLanguage: LanguageCode) {
    onLanguageChange(nextLanguage)
    storeLanguage(nextLanguage)
    setLanguagePickerOpen(false)
  }

  return (
    <aside className={navigationCollapsed ? 'console-sidebar console-sidebar-collapsed' : isConsoleView ? 'console-sidebar' : undefined}>
      {isConsoleView && (
        <button
          aria-expanded={!navigationCollapsed}
          aria-label={navigationCollapsed ? expandLabel : collapseLabel}
          className="console-sidebar-toggle"
          title={navigationCollapsed ? expandLabel : collapseLabel}
          type="button"
          onClick={() => onConsoleNavigationCollapsedChange(!navigationCollapsed)}
        >
          {navigationCollapsed ? <PanelLeftOpen aria-hidden="true" size={17} /> : <PanelLeftClose aria-hidden="true" size={17} />}
        </button>
      )}
      <div>
        <div className="app-title-row">
          <a className="brand-logo" href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer" aria-label="VRena Vietnam">
            {navigationCollapsed ? (
              <picture className="brand-logo-mark">
                <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-mark-dark.svg" />
                <img src="/brand/vrena-mark-light.svg" alt="" width="1000" height="1000" />
              </picture>
            ) : (
              <picture className="brand-logo-full">
                <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-logo-full-dark.svg" />
                <img src="/brand/vrena-logo-full-light.svg" alt="VRena" width="4886" height="1000" />
              </picture>
            )}
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

      <Link className={activeView === 'profile' ? 'profile-chip active' : 'profile-chip'} data-tour="profile-card" href={publicAppRoutes.profile} title={profileTitle} onClick={() => onViewChange('profile')}>
        <div className="avatar" style={profileAvatarStyle}>
          {profileAvatar}
          {isChampion && <span className="champion-badge">🏆</span>}
        </div>
        <div>
          <strong>{profileTitle}</strong>
          <span>{profileSubtitle}</span>
        </div>
      </Link>

      <div className="tabs">
        <Link className={activeView === 'sessions' || activeView === 'create' ? 'tab active' : 'tab'} href={publicAppRoutes.sessions} title={text.sessions} onClick={() => onViewChange('sessions')}>
          <CalendarDays aria-hidden="true" className="sidebar-tab-icon" size={18} strokeWidth={2.3} />
          <span className="sidebar-tab-label">{text.sessions}</span>
        </Link>
        <Link className={activeView === 'tickets' ? 'tab active' : 'tab'} href={publicAppRoutes.tickets} title={text.tickets} onClick={() => onViewChange('tickets')}>
          <Ticket aria-hidden="true" className="sidebar-tab-icon" size={18} strokeWidth={2.3} />
          <span className="sidebar-tab-label">{text.tickets}</span>
        </Link>
        <Link className={activeView === 'leaderboard' ? 'tab active' : 'tab'} data-tour="hall-of-fame-tab" href={publicAppRoutes.leaderboard} title={text.hallOfFame} onClick={() => onViewChange('leaderboard')}>
          <Trophy aria-hidden="true" className="sidebar-tab-icon" size={18} strokeWidth={2.3} />
          <span className="sidebar-tab-label">{text.hallOfFame}</span>
        </Link>
        <Link className={activeView === 'clubs' ? 'tab active' : 'tab'} href={publicAppRoutes.clubs} title={text.clubs} onClick={() => onViewChange('clubs')}>
          <UsersRound aria-hidden="true" className="sidebar-tab-icon" size={18} strokeWidth={2.3} />
          <span className="sidebar-tab-label">{text.clubs}</span>
        </Link>
        <a className="tab sidebar-gallery-tab" href={vrenaGalleryUrl} target="_blank" rel="noreferrer" title={text.galleryLink}>
          <Images aria-hidden="true" className="sidebar-tab-icon" size={18} strokeWidth={2.3} />
          <span className="sidebar-tab-label">{text.galleryLink}</span>
        </a>
        {canAccessStaffConsole && (
          <>
            <Link className={activeView === 'staff' ? 'tab sidebar-staff-tab active' : 'tab sidebar-staff-tab'} href={publicAppRoutes.staff} title={language === 'vi' ? 'Nhân viên' : 'Staff'} onClick={() => onViewChange('staff')}>
              <ShieldCheck aria-hidden="true" className="sidebar-tab-icon" size={18} strokeWidth={2.3} />
              <span className="sidebar-tab-label">{language === 'vi' ? 'Nhân viên' : 'Staff'}</span>
            </Link>
            <Link className={activeView === 'hr' ? 'tab sidebar-staff-tab sidebar-hr-tab active' : 'tab sidebar-staff-tab sidebar-hr-tab'} href={publicAppRoutes.hr} title="HR" onClick={() => onViewChange('hr')}>
              <BriefcaseBusiness aria-hidden="true" className="sidebar-tab-icon" size={18} strokeWidth={2.3} />
              <span className="sidebar-tab-label">HR</span>
            </Link>
          </>
        )}
      </div>

      <div className="shop-contact">
        <strong>VRena Vietnam</strong>
        <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
        <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
        <ContactChannels label={text.contactUs} />
      </div>
    </aside>
  )
}
