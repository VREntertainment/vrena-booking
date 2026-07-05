import { Search, X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

export type ClubVisibility = 'public' | 'private'

export type ClubsViewProps = {
  children: ReactNode
  clubDescription: string
  clubListCount: number
  clubName: string
  clubSearch: string
  clubSearchShellRef: RefObject<HTMLDivElement | null>
  clubStatus: string
  clubVisibility: ClubVisibility
  isClubSearchOpen: boolean
  isCreatingClub: boolean
  onClubDescriptionChange: (value: string) => void
  onClubNameChange: (value: string) => void
  onClubSearchChange: (value: string) => void
  onClubSearchOpenChange: (open: boolean | ((open: boolean) => boolean)) => void
  onClubVisibilityChange: (visibility: ClubVisibility) => void
  onCreateClub: () => void
  text: TranslationMap
}

export default function ClubsView({
  children,
  clubDescription,
  clubListCount,
  clubName,
  clubSearch,
  clubSearchShellRef,
  clubStatus,
  clubVisibility,
  isClubSearchOpen,
  isCreatingClub,
  onClubDescriptionChange,
  onClubNameChange,
  onClubSearchChange,
  onClubSearchOpenChange,
  onClubVisibilityChange,
  onCreateClub,
  text,
}: ClubsViewProps) {
  const hasActiveSearch = Boolean(isClubSearchOpen || clubSearch)

  return (
    <section className="section clubs-section">
      <div className="section-head">
        <div>
          <h2>{text.clubsTitle}</h2>
        </div>
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
      {clubStatus && <p className="notice">{clubStatus}</p>}

      <div className="club-list">
        {clubListCount === 0 && <p className="notice">{text.noMatchingClubs}</p>}
        {children}
      </div>
    </section>
  )
}
