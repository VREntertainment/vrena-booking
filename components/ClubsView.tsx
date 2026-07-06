import { Plus, Search, X } from 'lucide-react'
import { useState, type ReactNode, type RefObject } from 'react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type ClubVisibility = 'public' | 'private'
export type ClubVisibilityFilter = 'all' | ClubVisibility

export type ClubsViewProps = {
  children: ReactNode
  clubDescription: string
  clubVisibilityFilter: ClubVisibilityFilter
  clubListCount: number
  clubName: string
  clubSearch: string
  clubSearchShellRef: RefObject<HTMLDivElement | null>
  clubStatus: string
  clubVisibility: ClubVisibility
  isClubSearchOpen: boolean
  isCreatingClub: boolean
  isLoggedIn: boolean
  onClubDescriptionChange: (value: string) => void
  onClubNameChange: (value: string) => void
  onClubSearchChange: (value: string) => void
  onClubSearchOpenChange: (open: boolean | ((open: boolean) => boolean)) => void
  onClubVisibilityFilterChange: (visibility: ClubVisibilityFilter) => void
  onClubVisibilityChange: (visibility: ClubVisibility) => void
  onCreateClub: () => void
  onPromptLogin: () => void
  text: TranslationMap
}

export default function ClubsView({
  children,
  clubDescription,
  clubVisibilityFilter,
  clubListCount,
  clubName,
  clubSearch,
  clubSearchShellRef,
  clubStatus,
  clubVisibility,
  isClubSearchOpen,
  isCreatingClub,
  isLoggedIn,
  onClubDescriptionChange,
  onClubNameChange,
  onClubSearchChange,
  onClubSearchOpenChange,
  onClubVisibilityFilterChange,
  onClubVisibilityChange,
  onCreateClub,
  onPromptLogin,
  text,
}: ClubsViewProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const hasActiveSearch = Boolean(isClubSearchOpen || clubSearch)
  const showCreatePanel = isLoggedIn && isCreateOpen

  function handleCreateToggle() {
    if (!isLoggedIn) {
      onPromptLogin()
      return
    }
    setIsCreateOpen((open) => !open)
  }

  return (
    <section className="section clubs-section">
      <div className="club-discovery-toolbar">
        <div className={isClubSearchOpen ? 'search-shell open' : 'search-shell'} ref={clubSearchShellRef}>
          <button
            aria-label={text.searchSessions}
            className="mobile-search-toggle"
            type="button"
            onClick={() => onClubSearchOpenChange((open) => !open)}
          >
            <Search aria-hidden="true" size={24} strokeWidth={2.35} />
          </button>
          <input
            className="search"
            type="search"
            placeholder={text.clubSearchPlaceholder}
            value={clubSearch}
            onFocus={() => onClubSearchOpenChange(true)}
            onChange={(event) => onClubSearchChange(event.target.value)}
          />
          {hasActiveSearch && (
            <button
              aria-label={text.close}
              className="search-close"
              type="button"
              onClick={() => {
                onClubSearchChange('')
                onClubSearchOpenChange(false)
              }}
            >
              <X aria-hidden="true" size={18} />
            </button>
          )}
        </div>

        <div className="club-discovery-actions">
          <div className="segmented club-filter" aria-label={text.allClubs}>
            <button className={clubVisibilityFilter === 'all' ? 'active' : ''} onClick={() => onClubVisibilityFilterChange('all')} type="button">
              {text.allClubs}
            </button>
            <button className={clubVisibilityFilter === 'public' ? 'active' : ''} onClick={() => onClubVisibilityFilterChange('public')} type="button">
              {text.public}
            </button>
            <button className={clubVisibilityFilter === 'private' ? 'active' : ''} onClick={() => onClubVisibilityFilterChange('private')} type="button">
              {text.private}
            </button>
          </div>

          <button className="primary club-create-toggle" onClick={handleCreateToggle} type="button">
            <Plus aria-hidden="true" size={18} />
            {showCreatePanel ? text.close : text.createClub}
          </button>
        </div>
      </div>

      {showCreatePanel && (
        <div className="club-create-panel">
          <div className="club-create-copy">
            <strong>{text.createClub}</strong>
            <span>{text.clubsHint}</span>
          </div>

          <div className="segmented form-segmented">
            <button className={clubVisibility === 'public' ? 'active' : ''} onClick={() => onClubVisibilityChange('public')} type="button">
              {text.public}
            </button>
            <button className={clubVisibility === 'private' ? 'active' : ''} onClick={() => onClubVisibilityChange('private')} type="button">
              {text.private}
            </button>
          </div>

          <div className="form-grid club-form">
            <div>
              <label>{text.clubName} <span className="required">*</span></label>
              <input value={clubName} onChange={(event) => onClubNameChange(event.target.value)} placeholder="VRena Friday Club" />
            </div>
            <div>
              <label>{text.clubDescription}</label>
              <input value={clubDescription} onChange={(event) => onClubDescriptionChange(event.target.value)} placeholder={text.clubDescriptionPlaceholder} />
            </div>
          </div>

          <button className={isCreatingClub ? 'primary loading create-button' : 'primary create-button'} disabled={isCreatingClub} onClick={onCreateClub} type="button">
            {isCreatingClub ? text.creatingClub : text.createClub}
          </button>
        </div>
      )}

      {clubStatus && <p className="notice">{clubStatus}</p>}

      <div className="club-list">
        {clubListCount === 0 && (
          <div className="club-empty-state">
            <strong>{text.noMatchingClubs}</strong>
            <span>{clubSearch ? text.clubEmptySearchHint : text.clubEmptyCreateHint}</span>
            {clubSearch && (
              <button
                className="secondary small-button"
                type="button"
                onClick={() => {
                  onClubSearchChange('')
                  onClubSearchOpenChange(false)
                }}
              >
                {text.clearClubSearch}
              </button>
            )}
          </div>
        )}
        {clubListCount > 0 && children}
      </div>
    </section>
  )
}
