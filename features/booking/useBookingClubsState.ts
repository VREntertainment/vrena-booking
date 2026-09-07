'use client'

import {
  useRef,
  useState
} from 'react'
import {
  type ClubVisibility,
  type ClubVisibilityFilter
} from '../../components/BookingWidgetSurfaces'
import type { LeaderboardCriterion } from '../../components/LeaderboardPanel'
import {
  clubThemeColors
} from '../../lib/bookingStaticData'
import {
  Club,
  ClubMessage,
  ClubSessionScope,
  ClubTab
} from '../../lib/bookingWidgetDomain'
import { type LanguageCode } from '../../lib/i18n/languages'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingClubsState() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [clubMessages, setClubMessages] = useState<ClubMessage[]>([])
  const [isLoadingClubMessages, setIsLoadingClubMessages] = useState(false)
  const [clubMessageStatus, setClubMessageStatus] = useState('')
  const [clubSearch, setClubSearch] = useState('')
  const [isClubSearchOpen, setIsClubSearchOpen] = useState(false)
  const [clubVisibility, setClubVisibility] = useState<ClubVisibility>('public')
  const [clubVisibilityFilter, setClubVisibilityFilter] = useState<ClubVisibilityFilter>('all')
  const [clubName, setClubName] = useState('')
  const [clubDescription, setClubDescription] = useState('')
  const [clubStatus, setClubStatus] = useState('')
  const [isCreatingClub, setIsCreatingClub] = useState(false)
  const [busyClubId, setBusyClubId] = useState('')
  const [selectedClubId, setSelectedClubId] = useState('')
  const [selectedClubDate, setSelectedClubDate] = useState('')
  const [selectedClubTab, setSelectedClubTab] = useState<ClubTab>('hall')
  const [selectedClubSessionScope, setSelectedClubSessionScope] = useState<ClubSessionScope>('upcoming')
  const [clubUnlockTargetId, setClubUnlockTargetId] = useState('')
  const [clubUnlockCode, setClubUnlockCode] = useState('')
  const [clubUnlockStatus, setClubUnlockStatus] = useState('')
  const [unlockedClubIds, setUnlockedClubIds] = useState<Record<string, boolean>>({})
  const [clubEditName, setClubEditName] = useState('')
  const [clubEditMotto, setClubEditMotto] = useState('')
  const [clubEditDescription, setClubEditDescription] = useState('')
  const [clubEditVisibility, setClubEditVisibility] = useState<'public' | 'private'>('public')
  const [clubEditThemeColor, setClubEditThemeColor] = useState(clubThemeColors[0])
  const [clubEditThemeColorDraft, setClubEditThemeColorDraft] = useState(clubThemeColors[0])
  const [clubEditDefaultLanguage, setClubEditDefaultLanguage] = useState<LanguageCode>('en')
  const [clubEditRankingCriterion, setClubEditRankingCriterion] = useState<LeaderboardCriterion>('totalScore')
  const [clubBannerFile, setClubBannerFile] = useState<File | null>(null)
  const [clubBannerPreview, setClubBannerPreview] = useState('')
  const [isSavingClub, setIsSavingClub] = useState(false)
  const [clubPublicMessageDrafts, setClubPublicMessageDrafts] = useState<Record<string, string>>({})
  const [clubAdminMessageDrafts, setClubAdminMessageDrafts] = useState<Record<string, string>>({})
  const clubSearchShellRef = useRef<HTMLDivElement | null>(null)
  const clubsLoadedRef = useRef(false)
  const clubsLoadedForUserIdRef = useRef<string | null>(null)
  const clubsLoadingRef = useRef(false)
  const loadedClubMessagesRef = useRef<Set<string>>(new Set())
  return {
    clubs,
    setClubs,
    clubMessages,
    setClubMessages,
    isLoadingClubMessages,
    setIsLoadingClubMessages,
    clubMessageStatus,
    setClubMessageStatus,
    clubSearch,
    setClubSearch,
    isClubSearchOpen,
    setIsClubSearchOpen,
    clubVisibility,
    setClubVisibility,
    clubVisibilityFilter,
    setClubVisibilityFilter,
    clubName,
    setClubName,
    clubDescription,
    setClubDescription,
    clubStatus,
    setClubStatus,
    isCreatingClub,
    setIsCreatingClub,
    busyClubId,
    setBusyClubId,
    selectedClubId,
    setSelectedClubId,
    selectedClubDate,
    setSelectedClubDate,
    selectedClubTab,
    setSelectedClubTab,
    selectedClubSessionScope,
    setSelectedClubSessionScope,
    clubUnlockTargetId,
    setClubUnlockTargetId,
    clubUnlockCode,
    setClubUnlockCode,
    clubUnlockStatus,
    setClubUnlockStatus,
    unlockedClubIds,
    setUnlockedClubIds,
    clubEditName,
    setClubEditName,
    clubEditMotto,
    setClubEditMotto,
    clubEditDescription,
    setClubEditDescription,
    clubEditVisibility,
    setClubEditVisibility,
    clubEditThemeColor,
    setClubEditThemeColor,
    clubEditThemeColorDraft,
    setClubEditThemeColorDraft,
    clubEditDefaultLanguage,
    setClubEditDefaultLanguage,
    clubEditRankingCriterion,
    setClubEditRankingCriterion,
    clubBannerFile,
    setClubBannerFile,
    clubBannerPreview,
    setClubBannerPreview,
    isSavingClub,
    setIsSavingClub,
    clubPublicMessageDrafts,
    setClubPublicMessageDrafts,
    clubAdminMessageDrafts,
    setClubAdminMessageDrafts,
    clubSearchShellRef,
    clubsLoadedRef,
    clubsLoadedForUserIdRef,
    clubsLoadingRef,
    loadedClubMessagesRef,
  }
}
