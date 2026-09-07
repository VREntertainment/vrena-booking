'use client'
import dynamic from 'next/dynamic'
import type { ChallengeTarget } from '../features/booking/ChallengeControls'
import { clubRankingCriterion, clubTheme } from '../features/booking/clubAccess.actions'
import { avatarFields } from '../features/booking/profiles.actions'
import { downloadSessionCalendar } from '../features/booking/reminders.actions'
import { useBookingLifecycleActions } from '../features/booking/useBookingLifecycleActions'

import { useBookingAuthenticationState } from '../features/booking/useBookingAuthenticationState'
import { useBookingClubsState } from '../features/booking/useBookingClubsState'
import { useBookingGameGuideState } from '../features/booking/useBookingGameGuideState'
import { useBookingLeaderboardState } from '../features/booking/useBookingLeaderboardState'
import { useBookingProfilesState } from '../features/booking/useBookingProfilesState'
import { useBookingRemindersState } from '../features/booking/useBookingRemindersState'
import { useBookingSessionEditorState } from '../features/booking/useBookingSessionEditorState'
import { useBookingSessionsState } from '../features/booking/useBookingSessionsState'
import { useBookingTicketsState } from '../features/booking/useBookingTicketsState'
import { useBookingTournamentsState } from '../features/booking/useBookingTournamentsState'

import { createBookingAuthCredentialsActions } from '../features/booking/authCredentials.actions'
import { createBookingAuthSessionActions } from '../features/booking/authSession.actions'
import { createBookingClubAccessActions } from '../features/booking/clubAccess.actions'
import { createBookingClubDataActions } from '../features/booking/clubData.actions'
import { createBookingClubManagementActions } from '../features/booking/clubManagement.actions'
import { createBookingClubMembershipActions } from '../features/booking/clubMembership.actions'
import { createBookingClubMessagesActions } from '../features/booking/clubMessages.actions'
import { createBookingClubPageActions } from '../features/booking/clubPage.actions'
import { createBookingMfaActions } from '../features/booking/mfa.actions'
import { createBookingPasskeysActions } from '../features/booking/passkeys.actions'
import { createBookingProfilesActions } from '../features/booking/profiles.actions'
import { createBookingRecoveryActions } from '../features/booking/recovery.actions'
import { createBookingRemindersActions } from '../features/booking/reminders.actions'
import { createBookingSessionBookingActions } from '../features/booking/sessionBooking.actions'
import { createBookingSessionEditingActions } from '../features/booking/sessionEditing.actions'
import { createBookingSessionLoadingActions } from '../features/booking/sessionLoading.actions'
import { createBookingSessionMessagesActions } from '../features/booking/sessionMessages.actions'
import { ActionToast, BOOKING_ACTIVE_VIEW_STORAGE_KEY, BookingWidgetProps, CONSENT_WAIVER_URL, NAVIGATION_COLLAPSE_STORAGE_KEY, PRIVACY_POLICY_URL, REALTIME_REFRESH_DEBOUNCE_MS, TERMS_CONDITIONS_URL, TICKET_NEXT_AVAILABLE_SCAN_DAYS, isBookingAppView } from '../features/booking/shared'
import { createBookingTicketsActions } from '../features/booking/tickets.actions'


import { bindBookingTournamentActions } from '../features/booking/tournament.actions'

import { CAFE_SOFT_OPENING_DATE, availableSessionTimes, cafeTicketTimes } from '../lib/booking/availability'
import { clearPendingTicketAccountBooking, readPendingTicketAccountBooking } from '../lib/booking/pendingAccountBooking'

import { useTicketCheckout } from '../hooks/useTicketCheckout'
import { getSupabase } from '../lib/booking/client'


import {
  Bold,
  ChevronLeft,
  ChevronRight,
  Italic,
  Strikethrough,
  Underline,
  X
} from 'lucide-react'
import NextImage from 'next/image'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useCreateSessionCalendar } from '../hooks/useCreateSessionCalendar'
import { ageBandFromBirthday, isMinorBirthday } from '../lib/agePolicy'
import {
  canUseWebPush,
  registerReminderServiceWorker,
  shareBookingLink
} from '../lib/bookingBrowserActions'
import { calendarLanes } from '../lib/bookingCalendar'
import {
  OPTIONAL_SESSION_METADATA_COLUMNS,
  SESSION_CARD_PARTICIPANT_SELECT,
  SESSION_CARD_SELECT,
  games,
  isEscapeSession,
  selectedTicketService,
  ticketMaxCustomerDurationMinutes,
  ticketServices,
  type GameId,
  type TicketType
} from '../lib/bookingStaticData'
import {
  ANONYMOUS_MASK_EMOJI,
  BlockedTime,
  CLOSE_MINUTES,
  ChallengeStatus,
  DEFAULT_APP_URL,
  FriendConnection,
  LEADERBOARD_PAGE_SIZE,
  MessageTranslationResponse,
  OPEN_MINUTES,
  Participant,
  ParticipantPaymentSplit,
  ParticipantPaymentSplitDraft,
  Profile,
  QualificationRule,
  RealtimeRefreshTask,
  SESSION_LOAD_BATCH_DAYS,
  Session,
  SessionInvite,
  SessionListPageResult,
  TIME_STEP_MINUTES,
  TournamentAuditLog,
  TournamentEditor,
  TournamentFormat,
  TournamentMatch,
  TournamentPool,
  TournamentPoolEntry,
  addDays,
  addDaysToDateValue,
  authDebug,
  bestOfLabel,
  calculatePoolStandings,
  clubMemberCount,
  clubMembers,
  compactDisplayName,
  displayName,
  finiteNumber,
  formatCalendarWeekRange,
  formatDayButton,
  formatShortDate,
  formatSpeedrunDuration,
  formatTicketFormulaPrice,
  formatVnd,
  isBestSessionPerformer,
  isBirthdayToday,
  isPastSession,
  isTicketSession,
  isUpcomingSession,
  leaderboardPlayerFromStaffProfile,
  localDateString,
  minutesToTime,
  newParticipantPaymentSplit,
  normalizeParticipantPaymentSplits,
  normalizeSearchValue,
  participantPaymentSplitTotal,
  participantScore,
  paymentSplitsFromParticipant,
  percentValue,
  rangesOverlap,
  scheduleDeferredWork,
  schedulePostEffectStateUpdate,
  sessionBestPerformer,
  sessionCoverGame,
  sessionStartDate,
  sortSessionsByStart,
  startOfWeekDateValue,
  ticketArenaCountForPlayers,
  ticketDurationForPlayers,
  ticketPricingSummary,
  ticketTypeDescription,
  ticketTypeLabel,
  ticketUnitFormulaText,
  timeToMinutes,
  upcomingBatchEndForDate,
  weekDaysFromStart
} from '../lib/bookingWidgetDomain'
import { publicGameGuideCatalog } from '../lib/gameGuideCatalog'
import { validateGuestTicketContact } from '../lib/guestTicketBooking'
import { HCAPTCHA_SITE_KEY, ensureHCaptcha, removeHCaptchaWidget } from '../lib/hcaptcha'
import { getInitialLanguage } from '../lib/i18n/detectLanguage'
import { isLanguageCode, type LanguageCode } from '../lib/i18n/languages'
import { getFallbackTranslation, loadTranslation, type TranslationMap } from '../lib/i18n/loadTranslation'
import {
  currentUserLeaderboardPlayer,
  initialLeaderboardQuery,
  isLeaderboardCriterion,
  isMissingPagedLeaderboardFunction,
  leaderboardPlayerFromRpcRow,
  leaderboardRpcArgs,
  type LeaderboardQuery,
  type LeaderboardRpcRow,
} from '../lib/leaderboard'
import { cleanMessageText, equivalentMessageText } from '../lib/messageText'
import { buildPlayerStatsShareSummary, hasShareablePlayerStats } from '../lib/playerStatsShare'
import type { RateLimitAction } from '../lib/security/rateLimit'
import type { BookingForm } from '../lib/staff/types'
import { canAccessHrConsole as canAccessHrConsoleForActor, canEnterStaffConsole, canStaffKioskOperatorAccessHr, canStaffKioskOperatorAccessStaff, requiresStaffKioskPin } from '../lib/staffKioskScope'
import { isStaffAdminEmail as isAdminEmail, isStaffAdminRole as isAdminRole, staffRoleRank as staffConsoleRank } from '../lib/staffRoles'
import { setStaffKioskOperatorToken } from '../lib/supabase/client'
import { ticketPriceBlockMinutesForDate } from '../lib/ticketTariffs'
import AppLoadingState from './AppLoadingState'
import AppSidebar, { type AppView } from './AppSidebar'
import BookingVenueSelector, { BookingVenueComingSoon, CafeSoftOpeningBookingNotice, type BookingVenueId } from './BookingVenueSelector'
import {
  BirthdayPopupModal,
  BookingProfileView,
  BookingSessionsPanel,
  ChampionLoginModal,
  CheckInModal,
  ClubsView,
  CreateSessionView,
  FirstLoginTour,
  GameGuideModal,
  InvitePopupModal,
  LeaderboardPanel,
  LoginPromptModal,
  PlayerProfileModal,
  RichNotesEditor,
  ShortDateInput,
  StaffCalendarBookingDialog,
  StaffConsole,
  TariffPaymentModal,
  TicketBookingView
} from './BookingWidgetSurfaces'
import { LocalErrorBoundary } from './BookingWidgetUi'
import DocumentLanguage from './DocumentLanguage'
import type { LeaderboardCriterion, LeaderboardPlayer } from './LeaderboardPanel'
import { type MessageTranslationState } from './MessageBodyText'
import type { StaffProfile } from './StaffConsole'
import StaffKioskGate from './StaffKioskGate'

const ChallengeControls = dynamic(() => import('../features/booking/ChallengeControls'), { ssr: false })
const ClubDetail = dynamic(() => import('../features/booking/ClubDetail'), { ssr: false })

export default function WidgetPage({
  embedded = false,
  externalLanguage,
  initialText,
  initialSelectedPlayerId = '',
  initialSelectedPlayerSessionId = '',
  initialView = 'tickets',
  initialCalendarNavigation,
  onActiveViewChange,
  onProfileChange,
  restoreStoredView = true,
}: BookingWidgetProps = {}) {

  const [incomingCalendar] = useState(initialCalendarNavigation)
  const {
    calendarTicketDraft,
    setCalendarTicketDraft,
    ticketType,
    setTicketType,
    ticketDate,
    setTicketDate,
    ticketTime,
    setTicketTime,
    ticketPlayers,
    setTicketPlayers,
    ticketArenaCount,
    setTicketArenaCount,
    ticketDuration,
    setTicketDuration,
    ticketSpecialNote,
    setTicketSpecialNote,
    guestTicketContact,
    setGuestTicketContact,
    pendingGuestTicketClaim,
    setPendingGuestTicketClaim,
    pendingTicketAuthAction,
    setPendingTicketAuthAction,
    pendingTicketAuthCompletingRef,
    ticketStatus,
    setTicketStatus,
    ticketStatusVariant,
    setTicketStatusVariant,
    isBookingTickets,
    setIsBookingTickets,
    bookingTicketsInFlightRef,
    ticketConfirmation,
    setTicketConfirmation,
    ticketAvailabilitySearchTick,
    setTicketAvailabilitySearchTick,
    ticketAvailabilitySearchLoadingRef,
  } = useBookingTicketsState({ incomingCalendar, initialView })
  const [activeView, setActiveView] = useState<AppView>(initialView)
  const [navigationCollapsed, setNavigationCollapsed] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      try {
        setNavigationCollapsed(window.localStorage.getItem(NAVIGATION_COLLAPSE_STORAGE_KEY) === '1')
      } catch {
        // The default expanded layout remains available when storage is blocked.
      }
    })

    return () => window.cancelAnimationFrame(restoreFrame)
  }, [])
  useEffect(() => {
    const platformFrame = window.requestAnimationFrame(() => {
      setIsAndroid(/Android/i.test(window.navigator.userAgent))
    })
    return () => window.cancelAnimationFrame(platformFrame)
  }, [])
  const hasMountedInitialViewSyncRef = useRef(false)
  const {
    sessions,
    setSessions,
    sessionMessages,
    setSessionMessages,
    sessionMessagePages,
    setSessionMessagePages,
    loadedSessionDetailIds,
    setLoadedSessionDetailIds,
    loadingSessionDetailIds,
    setLoadingSessionDetailIds,
    blockedTimes,
    setBlockedTimes,
    search,
    setSearch,
    isSearchOpen,
    setIsSearchOpen,
    selectedSessionDate,
    setSelectedSessionDate,
    joinCodes,
    setJoinCodes,
    busySessionId,
    setBusySessionId,
    busyVoteKey,
    setBusyVoteKey,
    expandedNotes,
    setExpandedNotes,
    expandedSessions,
    setExpandedSessions,
    highlightedSessionId,
    setHighlightedSessionId,
    sessionTimeScope,
    setSessionTimeScope,
    hasMoreUpcomingSessions,
    setHasMoreUpcomingSessions,
    isLoadingMoreSessions,
    setIsLoadingMoreSessions,
    isLoadingPastSessions,
    setIsLoadingPastSessions,
    confirmedGameDrafts,
    setConfirmedGameDrafts,
    announcementDrafts,
    setAnnouncementDrafts,
    commentDrafts,
    setCommentDrafts,
  } = useBookingSessionsState()
  const {
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
  } = useBookingClubsState()
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const {
    leaderboardPlayers,
    setLeaderboardPlayers,
    currentUserRankPlayer,
    setCurrentUserRankPlayer,
    currentUserShareStats,
    setCurrentUserShareStats,
    hasMoreLeaderboardPlayers,
    setHasMoreLeaderboardPlayers,
    isLeaderboardLoading,
    setIsLeaderboardLoading,
    isLoadingMoreLeaderboardPlayers,
    setIsLoadingMoreLeaderboardPlayers,
    leaderboardStatus,
    setLeaderboardStatus,
    selectedPlayerId,
    setSelectedPlayerId,
    selectedPlayerSessionId,
    setSelectedPlayerSessionId,
    selectedPlayerStatsOverride,
    setSelectedPlayerStatsOverride,
    selectedPlayerGameStats,
    setSelectedPlayerGameStats,
    selectedPlayerGameStatsLoading,
    setSelectedPlayerGameStatsLoading,
    selectedPlayerStatsFetchedRef,
    selectedPlayerStatsLoadingRef,
    selectedPlayerGameStatsFetchedRef,
    selectedPlayerGameStatsLoadingRef,
    currentUserShareStatsLoadingRef,
    leaderboardLoadedRef,
    leaderboardLoadingRef,
    leaderboardLoadedCountRef,
    leaderboardQueryRef,
    leaderboardSearchReloadTimeoutRef,
    leaderboardView,
    setLeaderboardLoaded,
    setLeaderboardQuery,
  } = useBookingLeaderboardState({ initialSelectedPlayerId, initialSelectedPlayerSessionId })
  const [friendConnections, setFriendConnections] = useState<FriendConnection[]>([])
  const [sessionInvites, setSessionInvites] = useState<SessionInvite[]>([])
  const [messageTranslations, setMessageTranslations] = useState<Record<string, MessageTranslationState>>({})
  const [networkTablesReady, setNetworkTablesReady] = useState(false)
  const {
    tournamentData,
    setTournamentData,
    tournamentFormat,
    setTournamentFormat,
    tournamentBestOf,
    setTournamentBestOf,
    tournamentRoundsPerMatch,
    setTournamentRoundsPerMatch,
    tournamentRequirePayment,
    setTournamentRequirePayment,
    tournamentQualificationRule,
    setTournamentQualificationRule,
    tournamentCustomQualifiers,
    setTournamentCustomQualifiers,
    tournamentThirdPlace,
    setTournamentThirdPlace,
    tournamentFirstPrize,
    setTournamentFirstPrize,
    tournamentSecondPrize,
    setTournamentSecondPrize,
    tournamentThirdPrize,
    setTournamentThirdPrize,
    editTournamentFormat,
    setEditTournamentFormat,
    editTournamentBestOf,
    setEditTournamentBestOf,
    editTournamentRoundsPerMatch,
    setEditTournamentRoundsPerMatch,
    editTournamentRequirePayment,
    setEditTournamentRequirePayment,
    editTournamentQualificationRule,
    setEditTournamentQualificationRule,
    editTournamentCustomQualifiers,
    setEditTournamentCustomQualifiers,
    editTournamentThirdPlace,
    setEditTournamentThirdPlace,
    editTournamentFirstPrize,
    setEditTournamentFirstPrize,
    editTournamentSecondPrize,
    setEditTournamentSecondPrize,
    editTournamentThirdPrize,
    setEditTournamentThirdPrize,
    tournamentPoolSize,
    setTournamentPoolSize,
    tournamentEditorEmail,
    setTournamentEditorEmail,
    tournamentEditorResults,
    setTournamentEditorResults,
    busyTournamentId,
    setBusyTournamentId,
    tournamentDataLoadedRef,
    tournamentDataLoadingRef,
  } = useBookingTournamentsState()
  const {
    profile,
    setProfile,
    userId,
    setUserId,
    authEmail,
    setAuthEmail,
    kioskOperator,
    setKioskOperator,
    kioskLock,
    setKioskLock,
    authMode,
    setAuthMode,
    authStep,
    setAuthStep,
    profilePassword,
    setProfilePassword,
    phoneSetupRequired,
    setPhoneSetupRequired,
    phoneSetupEmail,
    setPhoneSetupEmail,
    phoneSetupSentTo,
    setPhoneSetupSentTo,
    isPhoneSetupSaving,
    setIsPhoneSetupSaving,
    rememberLogin,
    setRememberLogin,
    captchaToken,
    setCaptchaToken,
    captchaTokenRef,
    newPassword,
    setNewPassword,
    isRecoveryMode,
    setIsRecoveryMode,
    showPassword,
    setShowPassword,
    isProfileAuthLoading,
    setIsProfileAuthLoading,
    isOAuthLoading,
    setIsOAuthLoading,
    isPasskeyLoading,
    setIsPasskeyLoading,
    isResettingPassword,
    setIsResettingPassword,
    isDeletingAccount,
    setIsDeletingAccount,
    mfaFactors,
    setMfaFactors,
    mfaEnrollment,
    setMfaEnrollment,
    mfaVerifyCode,
    setMfaVerifyCode,
    mfaChallenge,
    setMfaChallenge,
    mfaChallengeCode,
    setMfaChallengeCode,
    mfaRequired,
    setMfaRequired,
    mfaAssuranceLevel,
    setMfaAssuranceLevel,
    isMfaLoading,
    setIsMfaLoading,
    mfaVerificationInFlightRef,
    mfaStatus,
    setMfaStatus,
    captchaContainerRef,
    captchaWidgetId,
    profileAuthLoadSeqRef,
  } = useBookingAuthenticationState()
  const {
    profileCountryCode,
    setProfileCountryCode,
    profilePhone,
    setProfilePhone,
    profileName,
    setProfileName,
    profileMotto,
    setProfileMotto,
    profileNickname,
    setProfileNickname,
    profileEmail,
    setProfileEmail,
    profileBirthday,
    setProfileBirthday,
    profileGender,
    setProfileGender,
    personalDataConsent,
    setPersonalDataConsent,
    marketingConsent,
    setMarketingConsent,
    avatarFile,
    setAvatarFile,
    avatarPreview,
    setAvatarPreview,
    avatarMode,
    setAvatarMode,
    failedAvatarUrls,
    setFailedAvatarUrls,
    avatarEmoji,
    setAvatarEmoji,
    avatarInitials,
    setAvatarInitials,
    avatarColor,
    setAvatarColor,
    avatarColorDraft,
    setAvatarColorDraft,
    avatarTextColor,
    setAvatarTextColor,
    avatarTextColorDraft,
    setAvatarTextColorDraft,
    profileStatus,
    setProfileStatus,
    profileSaveSuccessTimerRef,
    isSavingProfile,
    setIsSavingProfile,
    isProfileSaveSuccessful,
    setIsProfileSaveSuccessful,
    profileUpcomingExpanded,
    setProfileUpcomingExpanded,
    profilePastExpanded,
    setProfilePastExpanded,
    profileInvitesExpanded,
    setProfileInvitesExpanded,
    anonymousConfirmOpen,
    setAnonymousConfirmOpen,
    isSavingAnonymousMode,
    setIsSavingAnonymousMode,
    profileScoreAdjustments,
    setProfileScoreAdjustments,
  } = useBookingProfilesState()
  const [actionToast, setActionToast] = useState<ActionToast | null>(null)
  const actionToastTimerRef = useRef<number | null>(null)
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [tourReplayNonce, setTourReplayNonce] = useState(0)
  const {
    calendarEditSession,
    setCalendarEditSession,
    calendarBookingDraft,
    setCalendarBookingDraft,
    sessionVisibility,
    setSessionVisibility,
    sessionType,
    setSessionType,
    sessionName,
    setSessionName,
    sessionDate,
    setSessionDate,
    sessionTime,
    setSessionTime,
    sessionDuration,
    setSessionDuration,
    sessionMaxPlayers,
    setSessionMaxPlayers,
    sessionArenaCount,
    setSessionArenaCount,
    sessionNotes,
    setSessionNotes,
    sessionClubId,
    setSessionClubId,
    selectedGames,
    setSelectedGames,
    createStatus,
    setCreateStatus,
    isCreating,
    setIsCreating,
    editingSessionId,
    setEditingSessionId,
    editSessionName,
    setEditSessionName,
    editSessionDate,
    setEditSessionDate,
    editSessionTime,
    setEditSessionTime,
    editSessionDuration,
    setEditSessionDuration,
    editSessionMaxPlayers,
    setEditSessionMaxPlayers,
    editSessionArenaCount,
    setEditSessionArenaCount,
    editSessionVisibility,
    setEditSessionVisibility,
    editSessionNotes,
    setEditSessionNotes,
    editSelectedGames,
    setEditSelectedGames,
    editBookingType,
    setEditBookingType,
    editTicketCustomerId,
    setEditTicketCustomerId,
    editTicketType,
    setEditTicketType,
    editTicketTotalPrice,
    setEditTicketTotalPrice,
    editTicketStatus,
    setEditTicketStatus,
    isUpdatingSession,
    setIsUpdatingSession,
  } = useBookingSessionEditorState({ incomingCalendar, initialView })
  const [bookingVenue, setBookingVenue] = useState<BookingVenueId>(incomingCalendar?.venue || 'ha-do-centrosa')
  const isHaDoBookingVenue = bookingVenue === 'ha-do-centrosa'
  const { pushReminderStatus, setPushReminderStatus, isPushSubscribed, setIsPushSubscribed, isEnablingPush, setIsEnablingPush } = useBookingRemindersState()
  const {
    gameGuideOpen,
    setGameGuideOpen,
    gameGuideGameId,
    setGameGuideGameId,
    staffGameGuides,
    tariffPaymentOpen,
    setTariffPaymentOpen,
    ensureStaffGameGuidesLoaded,
  } = useBookingGameGuideState()
  const [challengeTargetId, setChallengeTargetId] = useState('')
  const [challengeGameId, setChallengeGameId] = useState<GameId>('laser-tag')
  const [challengeDate, setChallengeDate] = useState(localDateString())
  const [challengeTime, setChallengeTime] = useState('')
  const [challengeDuration, setChallengeDuration] = useState(20)
  const [challengeStatus, setChallengeStatus] = useState('')
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState('')
  const [sharedKey, setSharedKey] = useState('')
  const [drawerTouchStart, setDrawerTouchStart] = useState<number | null>(null)
  const [checkInTarget, setCheckInTarget] = useState<{ sessionId: string; participantId: string } | null>(null)
  const [checkInPaymentSplits, setCheckInPaymentSplits] = useState<ParticipantPaymentSplitDraft[]>(() => [newParticipantPaymentSplit('cash')])
  const [invitePopupInviteId, setInvitePopupInviteId] = useState('')
  const [inviteModalSessionId, setInviteModalSessionId] = useState('')
  const [inviteSearch, setInviteSearch] = useState('')
  const [birthdayPopupOpen, setBirthdayPopupOpen] = useState(false)
  const [busyInviteKey, setBusyInviteKey] = useState('')
  const [busyFriendId, setBusyFriendId] = useState('')
  const [busyMessageKey, setBusyMessageKey] = useState('')
  const [championLoginOpen, setChampionLoginOpen] = useState(false)
  const [language, setLanguage] = useState<LanguageCode>(() => externalLanguage ?? getInitialLanguage())
  const [text, setText] = useState<TranslationMap>(() => initialText ?? getFallbackTranslation())
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const dayStripRef = useRef<HTMLDivElement | null>(null)
  const passkeyButtonRef = useRef<HTMLButtonElement | null>(null)
  const warmedSupabaseClientRef = useRef<Awaited<ReturnType<typeof getSupabase>> | null>(null)
  const notifiedReminderKeys = useRef<Set<string>>(new Set())
  const networkDataLoadedRef = useRef(false)
  const networkDataLoadingRef = useRef(false)
  const allProfilesLoadedRef = useRef(false)
  const allProfilesLoadingRef = useRef(false)
  const selectedPlayerIdRef = useRef(initialSelectedPlayerId)
  const sessionDetailsLoadedRef = useRef<Set<string>>(new Set())
  const sessionDetailsLoadingRef = useRef<Set<string>>(new Set())
  const sessionMessagesLoadedRef = useRef<Set<string>>(new Set())
  const sessionMessagesLoadingRef = useRef<Set<string>>(new Set())
  const expandedSessionIdsRef = useRef<Set<string>>(new Set())
  const realtimeRefreshQueueRef = useRef<Set<RealtimeRefreshTask>>(new Set())
  const realtimeRefreshTimerRef = useRef<number | null>(null)
  const queueRealtimeRefreshRef = useRef((tasks: RealtimeRefreshTask[]) => {
    void tasks
  })
  const highlightedSessionTimeoutRef = useRef<number | null>(null)
  const sessionsLoadedRef = useRef(false)
  const upcomingSessionsThroughRef = useRef('')
  const loadingSessionRangeRef = useRef(false)
  const pastSessionsLoadedRef = useRef(false)
  const pastSessionsLoadingRef = useRef(false)
  const resetPasswordReadyTextRef = useRef(text.resetPasswordReady)
  const looseText = text as Record<string, string>
  const leaveClubText = looseText.leaveClub || 'Leave Club'
  const leaveClubConfirmText = looseText.leaveClubConfirm || 'Leave this club?'
  const leftClubText = looseText.leftClub || text.memberRemoved
  const bestPerformerText = looseText.bestPerformer || 'Best Performer'
  const bestPerformerCountText = looseText.bestPerformerCount || 'Best Performer count'
  const sessionScoreText = looseText.sessionScore || 'Session score'
  const averageAccuracyText = looseText.averageAccuracy || 'Average'
  const totalShotsText = looseText.totalShots || 'Total Shots'
  const escapeBestTimeText = looseText.escapeBestTime || 'Best escape time'
  const escapeSessionTimeText = looseText.escapeSessionTime || 'Escape time'
  const pendingInvitationsText = looseText.pendingInvitations || 'Pending invitations'
  const pendingInvitationsHintText = looseText.pendingInvitationsHint || 'Invites waiting for your answer.'
  const invitationReceivedText = looseText.invitationReceived || 'Session invitation'
  const invitationPopupTitleText = looseText.invitationPopupTitle || 'New session invitation'
  const invitationPopupBodyText = looseText.invitationPopupBody || 'You have been invited to join this session.'
  const openInvitationText = looseText.openInvitation || 'Open invite'
  const addToCalendarText = looseText.addToCalendar || 'Add calendar'
  const {
    calendarWeekStart,
    isCalendarLoading,
    loadCalendarWeek,
    createSessionMode,
    handleCreateSessionModeChange,
    moveCalendarWeek,
    openCreateSessionCalendar,
    startSessionFromCalendar,
  } = useCreateSessionCalendar({
    initialCalendarDate: incomingCalendar?.mode === 'calendar' && initialView === 'create' ? incomingCalendar.date : undefined,
    addDaysToDateValue,
    getLocalDateString: localDateString,
    loadCalendarRange: async (startDate, endDate) => {
      const client = await getSupabase()
      const rows: Session[] = []
      const blocks: BlockedTime[] = []
      for (let offset = 0; ; offset += 250) {
        const { data, error } = await client.rpc('sessions_list_page', {
          p_start_date: startDate, p_end_date: endDate, p_limit: 250, p_offset: offset, p_include_blocked_times: offset === 0,
        })
        if (error) throw new Error(error.message)
        const page = sessionPageFromRpcPayload(data)
        rows.push(...page.sessions)
        blocks.push(...page.blockedTimes)
        if (page.sessions.length < 250) break
      }
      setSessions((current) => sortSessionsByStart([...current.filter((session) => session.date < startDate || session.date > endDate), ...rows]))
      setBlockedTimes((current) => [...current.filter((block) => block.date < startDate || block.date > endDate), ...blocks])
    },
    onActiveViewChange: setActiveView,
    onCreateStatusChange: setCreateStatus,
    onSessionDateChange: setSessionDate,
    onSessionTimeChange: setSessionTime,
    requireProfile,
    scrollToCalendarPanel: () => {
      window.setTimeout(() => {
        document.querySelector('.calendar-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    },
    scrollToCreateForm: () => {
      window.setTimeout(() => {
        document.getElementById('create-session-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    },
    startOfWeekDateValue,
  })
  const isAdmin = Boolean(isAdminRole(profile?.role) || isAdminEmail(profile?.email) || isAdminEmail(authEmail))
  const { loadProfile, logout, logoutStaffKiosk } = createBookingAuthSessionActions(() => ({
    isProfileAuthLoading,
    profileAuthLoadSeqRef,
    setIsProfileAuthLoading,
    setUserId,
    setAuthEmail,
    setProfile,
    setPhoneSetupRequired,
    setProfileStatus,
    setActiveView,
    prepareMfaChallengeIfNeeded,
    refreshMfaFactors,
    setProfileCountryCode,
    setProfilePhone,
    setProfileName,
    setProfileMotto,
    setProfileNickname,
    setProfileEmail,
    setProfileBirthday,
    setProfileGender,
    setMarketingConsent,
    setAvatarMode,
    setAvatarEmoji,
    setAvatarInitials,
    setAvatarColor,
    setAvatarColorDraft,
    setAvatarTextColor,
    setAvatarTextColorDraft,
    setProfilePassword,
    setPhoneSetupEmail,
    setPhoneSetupSentTo,
    setAuthStep,
    setNewPassword,
    setIsRecoveryMode,
    setMfaFactors,
    setMfaEnrollment,
    setMfaChallenge,
    setMfaChallengeCode,
    setMfaVerifyCode,
    setMfaRequired,
    setMfaAssuranceLevel,
    setMfaStatus,
    text,
  }))
  const {
    currentCaptchaToken,
    resetCaptcha,
    restorePasskeyDocumentFocus,
    updateAuthMode,
    continueAuthFromEmail,
    editAuthEmail,
    handleAuth,
    sendPhoneSetupEmail,
    signInWithGoogle,
  } = createBookingAuthCredentialsActions(() => ({
    captchaTokenRef,
    setCaptchaToken,
    captchaToken,
    captchaWidgetId,
    warmedSupabaseClientRef,
    passkeyButtonRef,
    setAuthMode,
    setAuthStep,
    setProfilePassword,
    setProfileStatus,
    profileEmail,
    authMode,
    text,
    setProfileEmail,
    profile,
    isRecoveryMode,
    authStep,
    profilePhone,
    profileName,
    profilePassword,
    profileBirthday,
    personalDataConsent,
    setIsSavingProfile,
    profileNickname,
    profileCountryCode,
    profileGender,
    marketingConsent,
    setUserId,
    setPersonalDataConsent,
    loadProfile,
    completePendingTicketAuth,
    setActiveView,
    prepareMfaChallengeIfNeeded,
    isPhoneSetupSaving,
    phoneSetupEmail,
    setIsPhoneSetupSaving,
    setPhoneSetupEmail,
    setPhoneSetupSentTo,
    setIsOAuthLoading,
  }))
  const { refreshMfaFactors, prepareMfaChallengeIfNeeded, verifyMfaChallenge, beginTotpEnrollment, confirmTotpEnrollment, removeTotpFactor } = createBookingMfaActions(() => ({
    setMfaStatus,
    setMfaFactors,
    mfaChallenge,
    setMfaAssuranceLevel,
    text,
    setProfileStatus,
    setMfaChallenge,
    setMfaChallengeCode,
    setMfaRequired,
    setActiveView,
    mfaChallengeCode,
    mfaVerificationInFlightRef,
    setIsMfaLoading,
    setUserId,
    setAuthEmail,
    loadProfile,
    profile,
    setMfaVerifyCode,
    setMfaEnrollment,
    mfaEnrollment,
    mfaVerifyCode,
  }))
  const { signInWithPasskey, registerPasskey } = createBookingPasskeysActions(() => ({
    setProfileStatus,
    text,
    setIsPasskeyLoading,
    restorePasskeyDocumentFocus,
    warmedSupabaseClientRef,
    setUserId,
    prepareMfaChallengeIfNeeded,
    loadProfile,
    completePendingTicketAuth,
    setActiveView,
    profile,
  }))
  const { sendPasswordReset, preparePasswordRecoveryFromUrl, updatePasswordFromRecovery } = createBookingRecoveryActions(() => ({
    profile,
    profileEmail,
    setProfileStatus,
    text,
    currentCaptchaToken,
    setIsResettingPassword,
    resetCaptcha,
    setActiveView,
    setAuthMode,
    setAuthStep,
    setIsRecoveryMode,
    setUserId,
    setProfileEmail,
    newPassword,
    setNewPassword,
    loadProfile,
  }))
  const {
    updateAvatarColor,
    updateAvatarColorDraft,
    updateAvatarTextColor,
    updateAvatarTextColorDraft,
    chooseAvatarMode,
    rememberFailedAvatarUrl,
    avatarNode,
    avatarStyle,
    profileAvatarSnapshot,
    syncProfileEverywhere,
    notifyMinorBookingCreated,
    updateAnonymousMode,
    updateMarketingConsent,
    saveProfile,
    handleAvatarChange,
    deleteMyAccount,
  } = createBookingProfilesActions(() => ({
    avatarColor,
    setAvatarColor,
    setAvatarColorDraft,
    avatarTextColor,
    setAvatarTextColor,
    setAvatarTextColorDraft,
    setAvatarMode,
    setAvatarFile,
    setAvatarPreview,
    setFailedAvatarUrls,
    failedAvatarUrls,
    setSessions,
    setClubs,
    setTournamentData,
    setAllProfiles,
    setLeaderboardPlayers,
    text,
    profile,
    userId,
    setIsSavingAnonymousMode,
    setProfileStatus,
    setAnonymousConfirmOpen,
    setProfile,
    loadSessions,
    loadClubs,
    networkDataLoadedRef,
    loadNetworkData,
    refreshLeaderboardIfLoaded,
    setMarketingConsent,
    profileCountryCode,
    profilePhone,
    profileName,
    profileMotto,
    profileNickname,
    setIsSavingProfile,
    setIsProfileSaveSuccessful,
    avatarMode,
    avatarEmoji,
    avatarInitials,
    effectiveProfileBirthday,
    profileGender,
    marketingConsent,
    loadTournamentData,
    setProfileCountryCode,
    setProfilePhone,
    setProfileBirthday,
    setProfileGender,
    showActionToast,
    profileSaveSuccessTimerRef,
    avatarFile,
    setIsDeletingAccount,
    softDeleteRecord,
    setUserId,
    setAuthEmail,
    setNewPassword,
  }))
  const { loadClubs, loadClubMessages } = createBookingClubDataActions(() => ({
    clubsLoadingRef,
    userId,
    setClubStatus,
    clubsLoadedRef,
    clubsLoadedForUserIdRef,
    setClubs,
    canUseClubMessages,
    loadedClubMessagesRef,
    setIsLoadingClubMessages,
    setClubMessageStatus,
    sortClubMessages,
    setClubMessages,
  }))
  const {
    clubRoleFor,
    clubRoleLabel,
    canManageClub,
    canModerateClubMembers,
    canManageClubMember,
    manageableRoleOptions,
    clubThemeStyle,
    isDuplicateClubMembershipError,
    approvedClubMember,
    canSeeClubPrivateData,
    canOpenClubPage,
    canCreateClubSession,
    sessionClubFor,
    clubMembershipFor,
    canAccessClubSession,
  } = useMemo(() => createBookingClubAccessActions({ userId, text, isAdmin, unlockedClubIds, clubs }), [userId, text, isAdmin, unlockedClubIds, clubs])
  const {
    saveClubSettings,
    regenerateClubInviteCode,
    shareClubInvite,
    updateClubMemberRole,
    transferClubOwnership,
    notifyClubMembersOfSession,
    createClub,
  } = createBookingClubManagementActions(() => ({
    clubBannerFile,
    setClubStatus,
    canManageClub,
    clubEditName,
    text,
    setIsSavingClub,
    setBusyClubId,
    clubEditVisibility,
    clubEditMotto,
    clubEditDescription,
    clubEditThemeColor,
    clubEditDefaultLanguage,
    clubEditRankingCriterion,
    loadClubs,
    setClubBannerFile,
    setClubBannerPreview,
    manageableRoleOptions,
    userId,
    isAdmin,
    socialAvatarFields,
    networkDataLoadedRef,
    loadNetworkData,
    requireProfile,
    profile,
    clubName,
    setIsCreatingClub,
    clubVisibility,
    clubDescription,
    avatarFields,
    setClubName,
    setClubDescription,
    setClubVisibility,
  }))
  const { joinClub, approveClubMember, removeClubMember, leaveClub } = createBookingClubMembershipActions(() => ({
    requireProfile,
    profile,
    userId,
    setClubStatus,
    text,
    showActionToast,
    setBusyClubId,
    loadClubs,
    avatarFields,
    isDuplicateClubMembershipError,
    clubs,
    canModerateClubMembers,
    canManageClubMember,
    softDeleteRecord,
    leaveClubConfirmText,
    leftClubText,
  }))
  const { postClubMessage, sortClubMessages, canUseClubMessages, messagesForClub } = createBookingClubMessagesActions(() => ({
    requireProfile,
    profile,
    setClubMessageStatus,
    text,
    clubPublicMessageDrafts,
    clubAdminMessageDrafts,
    setBusyMessageKey,
    profileAvatarSnapshot,
    userId,
    setClubPublicMessageDrafts,
    setClubAdminMessageDrafts,
    loadedClubMessagesRef,
    setClubMessages,
    canManageClub,
    approvedClubMember,
    clubMessages,
  }))
  const { updateSessionMessagePage, messagesForSession, loadSessionMessages, postSessionMessage, reviewSessionMessage, deleteSessionMessage } = createBookingSessionMessagesActions(() => ({
    userId,
    isAdmin,
    setSessionMessages,
    sessionMessagesLoadedRef,
    sessionMessagesLoadingRef,
    setSessionMessagePages,
    sessionMessages,
    setCreateStatus,
    requireProfile,
    profile,
    text,
    announcementDrafts,
    commentDrafts,
    setBusyMessageKey,
    setAnnouncementDrafts,
    setCommentDrafts,
    softDeleteRecord,
  }))
  const { loadSessionDetail, loadSessionRange, loadSessions, loadMoreUpcomingSessions } = createBookingSessionLoadingActions(() => ({
    sessionDetailsLoadedRef,
    sessions,
    sessionDetailsLoadingRef,
    setLoadingSessionDetailIds,
    sessionDetailFromRpcPayload,
    setSessions,
    setSessionInvites,
    setProfileScoreAdjustments,
    setLoadedSessionDetailIds,
    optionalSessionMetadataMissing,
    setCreateStatus,
    text,
    normalizeSessionRow,
    userId,
    sessionPageFromRpcPayload,
    loadingSessionRangeRef,
    sessionsLoadedRef,
    loadExpandedSessionDetails,
    setBlockedTimes,
    setHasMoreUpcomingSessions,
    upcomingSessionsThroughRef,
    isLoadingMoreSessions,
    hasMoreUpcomingSessions,
    setIsLoadingMoreSessions,
  }))
  const { createSession, joinSession, joinWaitlist, leaveSession, voteForGame, confirmPlayedGame } = createBookingSessionBookingActions(() => ({
    isHaDoBookingVenue,
    setCreateStatus,
    text,
    setIsCreating,
    requireProfile,
    profile,
    sessionName,
    sessionDate,
    sessionTime,
    sessionClubId,
    clubs,
    canCreateClubSession,
    consumeAppRateLimit,
    sessionVisibility,
    userId,
    sessionType,
    sessionDuration,
    sessionMaxPlayers,
    sessionArenaCount,
    selectedGames,
    sessionNotes,
    tournamentFormat,
    tournamentBestOf,
    tournamentRoundsPerMatch,
    tournamentRequirePayment,
    tournamentQualificationRule,
    tournamentCustomQualifiers,
    tournamentThirdPlace,
    tournamentFirstPrize,
    tournamentSecondPrize,
    tournamentThirdPrize,
    avatarFields,
    notifyClubMembersOfSession,
    notifyMinorBookingCreated,
    showActionToast,
    setSessionName,
    setSessionNotes,
    setSessionTime,
    setSessionDuration,
    setSessionMaxPlayers,
    setSessionArenaCount,
    setSessionClubId,
    setSessionType,
    setTournamentFormat,
    setTournamentBestOf,
    setTournamentRoundsPerMatch,
    setTournamentRequirePayment,
    setTournamentQualificationRule,
    setTournamentCustomQualifiers,
    setTournamentThirdPlace,
    setTournamentFirstPrize,
    setTournamentSecondPrize,
    setTournamentThirdPrize,
    setSelectedGames,
    setSessionVisibility,
    loadSessions,
    setActiveView,
    hasSessionInvite,
    sessionClubFor,
    canAccessClubSession,
    joinCodes,
    setBusySessionId,
    fetchCurrentUserSessionParticipant,
    mergeJoinedParticipantIntoSession,
    loadSessionDetail,
    loadNetworkData,
    prepareJoinedSessionReminders,
    waitlistPosition,
    softDeleteRecord,
    canManageSession,
    setBusyVoteKey,
    confirmedGameDrafts,
    setSessions,
    setConfirmedGameDrafts,
  }))
  const { toggleEditGame, startEditingSession, stopEditingSession, updateSession, cancelSession, removeParticipant } = createBookingSessionEditingActions(() => ({
    setEditSelectedGames,
    isAdmin,
    ensureAllProfilesLoaded,
    sessionDetailsLoadedRef,
    loadSessionDetail,
    setEditingSessionId,
    setEditSessionName,
    setEditSessionDate,
    setEditSessionTime,
    setEditSessionDuration,
    setEditSessionMaxPlayers,
    setEditSessionArenaCount,
    setEditSessionVisibility,
    setEditSessionNotes,
    setEditBookingType,
    setEditTicketCustomerId,
    setEditTicketType,
    setEditTicketTotalPrice,
    setEditTicketStatus,
    setEditTournamentFormat,
    setEditTournamentBestOf,
    setEditTournamentRoundsPerMatch,
    setEditTournamentRequirePayment,
    setEditTournamentQualificationRule,
    setEditTournamentCustomQualifiers,
    setEditTournamentThirdPlace,
    setEditTournamentFirstPrize,
    setEditTournamentSecondPrize,
    setEditTournamentThirdPrize,
    setCreateStatus,
    setIsUpdatingSession,
    canManageSession,
    text,
    editSessionName,
    editSessionDate,
    editSessionTime,
    editSessionMaxPlayers,
    editBookingType,
    editSessionVisibility,
    tournamentForSession,
    editSessionDuration,
    editSessionArenaCount,
    editTicketType,
    editTicketTotalPrice,
    editTicketCustomerId,
    editSelectedGames,
    editSessionNotes,
    editTicketStatus,
    editTournamentFormat,
    editTournamentBestOf,
    editTournamentRoundsPerMatch,
    editTournamentRequirePayment,
    editTournamentQualificationRule,
    editTournamentCustomQualifiers,
    editTournamentThirdPlace,
    editTournamentFirstPrize,
    editTournamentSecondPrize,
    editTournamentThirdPrize,
    loadSessions,
    consumeAppRateLimit,
    setBusySessionId,
    softDeleteRecord,
  }))
  const { notifySession, notifyInvite, enablePushReminders, scheduleReturnReminder, prepareJoinedSessionReminders } = createBookingRemindersActions(() => ({ language, invitationReceivedText, requireProfile, setPushReminderStatus, text, setIsEnablingPush, userId, setIsPushSubscribed }))
  const ensureClubsLoadedRef = useRef(ensureClubsLoaded)
  const ensureLeaderboardLoadedRef = useRef(ensureLeaderboardLoaded)
  const ensureNetworkDataLoadedRef = useRef(ensureNetworkDataLoaded)
  const ensurePastSessionsLoadedRef = useRef(ensurePastSessionsLoaded)
  const ensureSessionsLoadedRef = useRef(ensureSessionsLoaded)
  const ensureTournamentDataLoadedRef = useRef(ensureTournamentDataLoaded)
  const ensureUpcomingSessionsThroughDateRef = useRef(ensureUpcomingSessionsThroughDate)
  const loadExpandedSessionDetailsRef = useRef(loadExpandedSessionDetails)
  const loadExpandedSessionMessagesRef = useRef(loadExpandedSessionMessages)
  const hydrateCurrentUserShareStatsRef = useRef(hydrateCurrentUserShareStats)
  const loadLeaderboardPlayersRef = useRef(loadLeaderboardPlayers)
  const loadNetworkDataRef = useRef(loadNetworkData)
  const loadTournamentDataRef = useRef(loadTournamentData)
  const refreshLeaderboardIfLoadedRef = useRef(refreshLeaderboardIfLoaded)
  const refreshSessionsIfLoadedRef = useRef(refreshSessionsIfLoaded)
  const loadClubMessagesRef = useRef(loadClubMessages)
  const loadClubsRef = useRef(loadClubs)
  const loadMoreUpcomingSessionsRef = useRef(loadMoreUpcomingSessions)
  const loadProfileRef = useRef(loadProfile)
  const loadSessionDetailRef = useRef(loadSessionDetail)
  const loadSessionMessagesRef = useRef(loadSessionMessages)
  const notifyInviteRef = useRef(notifyInvite)
  const notifySessionRef = useRef(notifySession)
  const preparePasswordRecoveryFromUrlRef = useRef(preparePasswordRecoveryFromUrl)
  const syncProfileEverywhereRef = useRef(syncProfileEverywhere)

  const activeTotpFactor = useMemo(() => mfaFactors.find((factor) => factor.status === 'verified') || mfaFactors[0] || null, [mfaFactors])
  const mfaQrCodeSrc = useMemo(() => {
    if (!mfaEnrollment?.qrCode) return ''
    return mfaEnrollment.qrCode.startsWith('data:')
      ? mfaEnrollment.qrCode
      : `data:image/svg+xml;utf8,${encodeURIComponent(mfaEnrollment.qrCode)}`
  }, [mfaEnrollment])
  const clubRankingCriteria: Array<{ value: LeaderboardCriterion; label: string }> = [
    { value: 'totalScore', label: text.totalScoreCriterion },
    { value: 'wins', label: text.winsCriterion },
    { value: 'winRate', label: text.winRateCriterion },
    { value: 'accuracy', label: text.accuracyCriterion },
    { value: 'reliability', label: text.reliabilityCriterion },
    { value: 'hits', label: text.projectilesCriterion },
    { value: 'movement', label: text.movementCriterion },
    { value: 'gamesPlayed', label: text.gamesPlayedCriterion },
    { value: 'escapeTime', label: text.escapeSpeedrunCriterion },
  ]
  const showProfileFields = Boolean(profile)
  const isMinorBirthdayLocked = Boolean(profile?.birthday && isMinorBirthday(profile.birthday))
  const effectiveProfileBirthday = isMinorBirthdayLocked ? profile?.birthday || '' : profileBirthday
  const activeAgeBand = ageBandFromBirthday(effectiveProfileBirthday || profile?.birthday || null)
  const isUnder13Profile = activeAgeBand === 'under13'
  const isTeenMinorProfile = activeAgeBand === 'minor'
  const isAdultProfile = activeAgeBand === 'adult'
  const sessionIdsKey = useMemo(() => sessions.map((session) => session.id).join('|'), [sessions])
  const { updateCaptchaToken, warmSupabaseClient, resetSessionMessageState, clearTicketStatus } = useBookingLifecycleActions({
    captchaTokenRef,
    setCaptchaToken,
    warmedSupabaseClientRef,
    sessionMessagesLoadedRef,
    sessionMessagesLoadingRef,
    setSessionMessages,
    setSessionMessagePages,
    setTicketStatus,
    setTicketStatusVariant,
  })


  function challengeStatusLabel(status?: ChallengeStatus | null) {
    if (status === 'accepted') return text.challengeAccepted
    if (status === 'declined') return text.challengeDeclined
    if (status === 'completed') return text.challengeCompleted
    if (status === 'cancelled') return text.challengeCancelled
    return text.challengePending
  }

  const loadSelectedPlayerStats = useCallback(async (profileId: string, force = false) => {
    if (!profileId) return
    if (!force && selectedPlayerStatsFetchedRef.current.has(profileId)) return
    if (selectedPlayerStatsLoadingRef.current.has(profileId)) return

    selectedPlayerStatsLoadingRef.current.add(profileId)

    try {
      const { data, error } = await (await getSupabase()).rpc(
        'get_leaderboard_players_page_v3',
        leaderboardRpcArgs(leaderboardQueryRef.current, 0, 1, profileId)
      )

      if (error) throw error

      const player = ((data ?? []) as LeaderboardRpcRow[])
        .map((row) => leaderboardPlayerFromRpcRow(row, text.player))[0]

      selectedPlayerStatsFetchedRef.current.add(profileId)
      if (player && selectedPlayerIdRef.current === profileId) {
        setSelectedPlayerStatsOverride(player)
        setProfileScoreAdjustments((current) => ({
          ...current,
          [player.profileId]: player.scoreAdjustment,
        }))
      }
    } catch {
      selectedPlayerStatsFetchedRef.current.add(profileId)
    } finally {
      selectedPlayerStatsLoadingRef.current.delete(profileId)
    }
  }, [leaderboardQueryRef, selectedPlayerStatsFetchedRef, selectedPlayerStatsLoadingRef, setProfileScoreAdjustments, setSelectedPlayerStatsOverride, text.player])

  const loadSelectedPlayerGameStats = useCallback(async (profileId: string, force = false) => {
    if (!profileId) return
    if (!force && selectedPlayerGameStatsFetchedRef.current.has(profileId)) return
    if (selectedPlayerGameStatsLoadingRef.current.has(profileId)) return

    selectedPlayerGameStatsLoadingRef.current.add(profileId)
    if (selectedPlayerIdRef.current === profileId) setSelectedPlayerGameStatsLoading(true)

    try {
      const supabase = await getSupabase()
      const rows = await Promise.all(games.map(async (game) => {
        const { data, error } = await supabase.rpc(
          'get_leaderboard_players_page_v3',
          leaderboardRpcArgs(
            { ...initialLeaderboardQuery(), gameId: game.id },
            0,
            1,
            profileId
          )
        )

        if (error) return null
        const player = ((data ?? []) as LeaderboardRpcRow[])
          .map((row) => leaderboardPlayerFromRpcRow(row, text.player))[0]
        return player ? [game.id, player] as const : null
      }))

      selectedPlayerGameStatsFetchedRef.current.add(profileId)
      if (selectedPlayerIdRef.current === profileId) {
        setSelectedPlayerGameStats(Object.fromEntries(rows.filter((row) => row !== null)))
      }
    } catch {
      if (selectedPlayerIdRef.current === profileId) setSelectedPlayerGameStats({})
    } finally {
      selectedPlayerGameStatsLoadingRef.current.delete(profileId)
      if (selectedPlayerIdRef.current === profileId) setSelectedPlayerGameStatsLoading(false)
    }
  }, [selectedPlayerGameStatsFetchedRef, selectedPlayerGameStatsLoadingRef, setSelectedPlayerGameStats, setSelectedPlayerGameStatsLoading, text.player])

  function openPlayerProfile(profileId: string, sessionId = '', seedStats?: LeaderboardPlayer) {
    selectedPlayerIdRef.current = profileId
    setSelectedPlayerId(profileId)
    setSelectedPlayerSessionId(sessionId)
    setSelectedPlayerStatsOverride((current) => seedStats ?? (current?.profileId === profileId ? current : null))
    setSelectedPlayerGameStats({})
    if (sessionId) void loadSessionDetail(sessionId)
    else void loadSelectedPlayerStats(profileId, true)
    void loadSelectedPlayerGameStats(profileId, true)
  }

  function openStaffPlayerProfile(staffProfile: StaffProfile) {
    openPlayerProfile(staffProfile.id, '', leaderboardPlayerFromStaffProfile(staffProfile, text.player))
  }

  function closePlayerProfile() {
    selectedPlayerIdRef.current = ''
    setSelectedPlayerId('')
    setSelectedPlayerSessionId('')
    setSelectedPlayerStatsOverride(null)
    setSelectedPlayerGameStats({})
    setSelectedPlayerGameStatsLoading(false)
    setChallengeTargetId('')
    setChallengeStatus('')
  }

  const showActionToast = useCallback((message: string) => {
    const cleanMessage = message.trim()
    if (!cleanMessage) return

    if (actionToastTimerRef.current !== null) {
      window.clearTimeout(actionToastTimerRef.current)
    }

    const id = Date.now()
    setActionToast({ id, message: cleanMessage })
    actionToastTimerRef.current = window.setTimeout(() => {
      setActionToast((currentToast) => (currentToast?.id === id ? null : currentToast))
      actionToastTimerRef.current = null
    }, 2600)
  }, [])

  useEffect(() => () => {
    if (actionToastTimerRef.current !== null) {
      window.clearTimeout(actionToastTimerRef.current)
    }
    if (profileSaveSuccessTimerRef.current !== null) {
      window.clearTimeout(profileSaveSuccessTimerRef.current)
    }
  }, [profileSaveSuccessTimerRef])

  async function copyInviteCode(sessionId: string, inviteCode: string | null) {
    if (!inviteCode) return

    await navigator.clipboard?.writeText(inviteCode)
    setCopiedInviteId(sessionId)
    showActionToast(text.copied)
    window.setTimeout(() => setCopiedInviteId((current) => (current === sessionId ? '' : current)), 1400)
  }

  function goToLogin() {
    setAuthMode('login')
    setAuthStep('email')
    setActiveView('profile')
    setProfileStatus(text.loginToContinue)
    setLoginPromptOpen(false)
  }

  function promptLogin() {
    setLoginPromptOpen(true)
    setProfileStatus(text.loginToContinue)
  }

  function requireProfile() {
    if (profile) return true

    promptLogin()
    return false
  }

  function ensureClubsLoaded() {
    const clubsLoadedForCurrentUser = clubsLoadedRef.current && clubsLoadedForUserIdRef.current === (userId || '')
    if (clubsLoadedForCurrentUser || clubsLoadingRef.current) return
    void loadClubs()
  }

  function ensureTournamentDataLoaded() {
    if (tournamentDataLoadedRef.current || tournamentDataLoadingRef.current) return
    void loadTournamentData()
  }

  function ensureNetworkDataLoaded() {
    if (networkDataLoadedRef.current || networkDataLoadingRef.current) return
    void loadNetworkData()
  }

  function ensureAllProfilesLoaded() {
    if (allProfilesLoadedRef.current || allProfilesLoadingRef.current) return
    void loadAllProfiles()
  }

  function ensureLeaderboardLoaded() {
    if (leaderboardLoadedRef.current || leaderboardLoadingRef.current) return
    void loadLeaderboardPlayers()
  }

  function ensureSessionsLoaded() {
    if (sessionsLoadedRef.current || loadingSessionRangeRef.current) return
    void loadSessions()
  }

  function refreshLeaderboardIfLoaded() {
    if (!leaderboardLoadedRef.current) return
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPlayers(leaderboardQueryRef.current, 0, 'replace', userId)
  }

  function reloadLeaderboard(nextQuery: LeaderboardQuery) {
    setLeaderboardQuery(nextQuery)
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPlayers(nextQuery, 0, 'replace', userId)
  }

  function handleLeaderboardCriterionChange(criterion: LeaderboardCriterion) {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      criterion,
    })
  }

  function handleLeaderboardGameChange(gameId: string) {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      gameId,
    })
  }

  function handleLeaderboardSearchChange(searchValue: string) {
    const nextQuery = {
      ...leaderboardQueryRef.current,
      search: searchValue,
    }
    setLeaderboardQuery(nextQuery)

    if (leaderboardSearchReloadTimeoutRef.current) window.clearTimeout(leaderboardSearchReloadTimeoutRef.current)
    leaderboardSearchReloadTimeoutRef.current = window.setTimeout(() => {
      leaderboardLoadedCountRef.current = 0
      void loadLeaderboardPlayers(nextQuery, 0, 'replace', userId)
    }, 260)
  }

  function handleLeaderboardClubChange(clubId: string) {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      clubId,
      clubPin: clubId === leaderboardQueryRef.current.clubId ? leaderboardQueryRef.current.clubPin : '',
    })
  }

  function handleLeaderboardClubPinUnlock(clubId: string, pinCode: string) {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      clubId,
      clubPin: pinCode,
    })
  }

  function loadMoreLeaderboardPlayers() {
    if (!hasMoreLeaderboardPlayers || isLoadingMoreLeaderboardPlayers) return
    void loadLeaderboardPlayers(leaderboardQueryRef.current, leaderboardLoadedCountRef.current, 'append', userId)
  }

  function refreshSessionsIfLoaded() {
    if (!sessionsLoadedRef.current) return
    void loadSessions()
  }

  function loadExpandedSessionDetails() {
    expandedSessionIdsRef.current.forEach((sessionId) => {
      void loadSessionDetail(sessionId, { force: true })
    })
  }

  function loadExpandedSessionMessages(options: { force?: boolean } = {}) {
    expandedSessionIdsRef.current.forEach((sessionId) => {
      if (!options.force && !sessionMessagesLoadedRef.current.has(sessionId)) return
      void loadSessionMessages(sessionId, { force: true })
    })
  }

  function flushRealtimeRefreshes() {
    const tasks = realtimeRefreshQueueRef.current
    if (tasks.size === 0) return

    realtimeRefreshQueueRef.current = new Set()
    realtimeRefreshTimerRef.current = null

    if (tasks.has('profile')) loadProfileRef.current()
    if (tasks.has('sessions')) refreshSessionsIfLoadedRef.current()
    if (tasks.has('leaderboard')) refreshLeaderboardIfLoadedRef.current()
    if (tasks.has('clubs') && clubsLoadedRef.current) loadClubsRef.current()
    if (tasks.has('tournament') && tournamentDataLoadedRef.current) loadTournamentDataRef.current()
    if (tasks.has('network') && networkDataLoadedRef.current) loadNetworkDataRef.current()
    if (tasks.has('expandedDetails')) loadExpandedSessionDetailsRef.current()
    if (tasks.has('expandedMessages')) loadExpandedSessionMessagesRef.current()
  }

  function queueRealtimeRefresh(tasks: RealtimeRefreshTask[]) {
    tasks.forEach((task) => realtimeRefreshQueueRef.current.add(task))
    if (realtimeRefreshTimerRef.current) window.clearTimeout(realtimeRefreshTimerRef.current)
    realtimeRefreshTimerRef.current = window.setTimeout(flushRealtimeRefreshes, REALTIME_REFRESH_DEBOUNCE_MS)
  }

  function setSessionExpanded(session: Session, expanded: boolean) {
    setExpandedSessions((current) => ({ ...current, [session.id]: expanded }))
    if (!expanded) return

    void loadSessionDetail(session.id)
    void loadSessionMessages(session.id)
    ensureNetworkDataLoaded()
    if (session.session_type === 'tournament') void loadTournamentData(session.id)
  }

  function highlightSessionCard(sessionId: string) {
    setHighlightedSessionId(sessionId)
    if (highlightedSessionTimeoutRef.current) window.clearTimeout(highlightedSessionTimeoutRef.current)
    highlightedSessionTimeoutRef.current = window.setTimeout(() => {
      setHighlightedSessionId('')
      highlightedSessionTimeoutRef.current = null
    }, 5000)
  }

  function openSessionFromProfile(sessionId: string) {
    const targetSession = sessions.find((session) => session.id === sessionId)

    setSearch('')
    setSelectedSessionDate('')
    setIsSearchOpen(false)
    setActiveView('sessions')
    highlightSessionCard(sessionId)
    setExpandedSessions((current) => ({ ...current, [sessionId]: true }))
    void loadSessionDetail(sessionId)
    void loadSessionMessages(sessionId)
    if (targetSession) {
      setSessionTimeScope(isUpcomingSession(targetSession) ? 'upcoming' : 'past')
      if (targetSession.session_type === 'tournament') void loadTournamentData(targetSession.id)
    }
    window.setTimeout(() => {
      document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  function openSessionFromCalendar(session: Session) {
    if (canManageCalendarBookings) {
      setCalendarEditSession(session)
      return
    }
    if ((session.venue_key || 'ha-do-centrosa') === 'cafe-des-stagiaires') {
      setTicketDate(session.date)
      setActiveView('tickets')
      return
    }
    openSessionFromProfile(session.id)
  }

  function openStaffCalendar(date: string, venue?: BookingForm['venueKey']) {
    if (venue) handleBookingVenueChange(venue)
    setCalendarBookingDraft(undefined)
    openCreateSessionCalendar(date)
  }

  function startCalendarBooking(date: string, time: string) {
    if (canManageCalendarBookings) {
      setCalendarBookingDraft({ date, time, venueKey: bookingVenue })
      setActiveView('staff')
    } else if (isHaDoBookingVenue) {
      startSessionFromCalendar(date, time)
    } else {
      setTicketDate(date)
      setTicketTime(time)
      setCalendarTicketDraft(true)
      setActiveView('tickets')
    }
  }

  async function shareLink(key: string, title: string, path = '') {
    await shareBookingLink({
      key,
      linkCopiedText: text.linkCopied,
      onCreateStatus: setCreateStatus,
      onSharedKey: setSharedKey,
      path,
      title,
    })
  }

  function waitlistForSession(session: Session) {
    return [...(session.session_waitlist ?? [])].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0
      const right = b.created_at ? new Date(b.created_at).getTime() : 0
      return left - right || a.id.localeCompare(b.id)
    })
  }

  function waitlistPosition(session: Session, profileId: string) {
    const waitlist = waitlistForSession(session)
    const index = waitlist.findIndex((entry) => entry.profile_id === profileId)
    return index >= 0 ? index + 1 : null
  }

  function socialAvatarFields(source: {
    display_name?: string | null
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    profile_motto?: string | null
  }) {
    return {
      display_name: source.display_name || text.player,
      avatar_url: source.avatar_url || null,
      avatar_emoji: source.avatar_emoji || null,
      avatar_initials: source.avatar_initials || null,
      avatar_color: source.avatar_color || null,
      avatar_text_color: source.avatar_text_color || null,
      profile_motto: source.profile_motto || null,
    }
  }

  function friendList() {
    return friendConnections
      .filter((connection) => connection.follower_id === userId)
      .sort((a, b) => compactDisplayName(a.display_name, '').localeCompare(compactDisplayName(b.display_name, '')))
  }

  function isFollowing(profileId: string) {
    return friendConnections.some((connection) => connection.follower_id === userId && connection.following_id === profileId)
  }

  function invitesForSession(sessionId: string) {
    return sessionInvites.filter((invite) => invite.session_id === sessionId)
  }

  const sessionForInvite = useCallback((invite: SessionInvite) => {
    return sessions.find((session) => session.id === invite.session_id)
  }, [sessions])

  function hasSessionInvite(sessionId: string, profileId: string) {
    return sessionInvites.some((invite) => invite.session_id === sessionId && invite.recipient_id === profileId)
  }

  function messageTranslationKey(messageKind: 'club' | 'session', messageId: string, targetLanguage: LanguageCode) {
    return `${messageKind}:${messageId}:${targetLanguage}`
  }

  const requestMessageTranslation = useCallback(async (
    messageKind: 'club' | 'session',
    messageId: string,
    body: string,
    targetLanguage: LanguageCode
  ) => {
    const key = messageTranslationKey(messageKind, messageId, targetLanguage)

    setMessageTranslations((current) => {
      const existing = current[key]
      if (existing?.loading || (existing?.attempted && !existing.error)) return current
      return {
        ...current,
        [key]: {
          ...(existing ?? {}),
          error: undefined,
          loading: true,
        },
      }
    })

    try {
      const client = await getSupabase()
      const { data: sessionData } = await client.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        setMessageTranslations((current) => ({
          ...current,
          [key]: {
            ...(current[key] ?? {}),
            attempted: true,
            error: 'login_required',
            loading: false,
          },
        }))
        return
      }

      const response = await fetch('/api/messages/translate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          messageKind,
          targetLanguage,
        }),
      })

      if (!response.ok) {
        setMessageTranslations((current) => ({
          ...current,
          [key]: {
            ...(current[key] ?? {}),
            attempted: true,
            error: 'translation_failed',
            loading: false,
          },
        }))
        return
      }

      const data = await response.json() as MessageTranslationResponse
      const translatedText = cleanMessageText(data.translatedText) || body
      setMessageTranslations((current) => ({
        ...current,
        [key]: {
          attempted: true,
          changed: Boolean(translatedText && !equivalentMessageText(translatedText, body)),
          error: undefined,
          loading: false,
          sourceLanguage: data.sourceLanguage || null,
          showOriginal: false,
          translatedText,
        },
      }))
    } catch {
      setMessageTranslations((current) => ({
        ...current,
        [key]: {
          ...(current[key] ?? {}),
          attempted: true,
          error: 'translation_failed',
          loading: false,
        },
      }))
    }
  }, [])

  function toggleMessageOriginal(messageKind: 'club' | 'session', messageId: string, targetLanguage: LanguageCode) {
    const key = messageTranslationKey(messageKind, messageId, targetLanguage)
    setMessageTranslations((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        showOriginal: !current[key]?.showOriginal,
      },
    }))
  }

  function previousPlayersForSession(session: Session) {
    const currentIds = new Set((session.session_participants ?? []).map((participant) => participant.profile_id))
    const people = new Map<string, ReturnType<typeof socialAvatarFields> & { profile_id: string }>()

    sessions.forEach((pastSession) => {
      if (!isPastSession(pastSession)) return
      const playedWithMe = (pastSession.session_participants ?? []).some((participant) => participant.profile_id === userId)
      if (!playedWithMe) return

        ; (pastSession.session_participants ?? []).forEach((participant) => {
          if (participant.profile_id === userId || currentIds.has(participant.profile_id)) return
          if (people.has(participant.profile_id)) return
          people.set(participant.profile_id, {
            profile_id: participant.profile_id,
            ...socialAvatarFields(participant),
          })
        })
    })

    return Array.from(people.values()).slice(0, 8)
  }

  async function consumeAppRateLimit(
    action: RateLimitAction,
    subject: string,
    setStatus: (message: string) => void = setCreateStatus
  ) {
    if (action === 'booking_attempt') {
      const { error } = await (await getSupabase()).rpc('consume_booking_attempt_rate_limit', {
        p_subject: subject || null,
      })

      if (error) {
        setStatus(error.message || 'Too many attempts. Please wait a moment and try again.')
        return false
      }

      return true
    }

    const { error } = await (await getSupabase()).rpc('consume_user_action_rate_limit', {
      p_action: action,
      p_subject: subject || null,
    })

    if (error) {
      setStatus(error.message || 'Too many attempts. Please wait a moment and try again.')
      return false
    }

    return true
  }

  async function softDeleteRecord(entityTable: string, entityId: string, reason: string) {
    return (await getSupabase()).rpc('soft_delete_record', {
      p_entity_table: entityTable,
      p_entity_id: entityId,
      p_delete_reason: reason,
    })
  }

  async function softDeleteTournamentRecords(sessionId: string, includePools: boolean, reason: string) {
    return (await getSupabase()).rpc('soft_delete_tournament_records', {
      p_session_id: sessionId,
      p_include_pools: includePools,
      p_delete_reason: reason,
    })
  }

  async function fetchLeaderboardRows(query: LeaderboardQuery, offset: number, limit: number, profileId = '') {
    const { data, error } = await (await getSupabase()).rpc(
      'get_leaderboard_players_page_v3',
      leaderboardRpcArgs(query, offset, limit, profileId)
    )

    if (error) throw error
    return ((data ?? []) as LeaderboardRpcRow[]).map((row) => leaderboardPlayerFromRpcRow(row, text.player))
  }

  async function hydrateCurrentUserShareStats(profileId = userId, force = false) {
    if (!profileId) return null
    if (!force && currentUserShareStats?.profileId === profileId && hasShareablePlayerStats(currentUserShareStats)) {
      return currentUserShareStats
    }
    if (currentUserShareStatsLoadingRef.current) {
      return currentUserShareStats?.profileId === profileId ? currentUserShareStats : null
    }

    currentUserShareStatsLoadingRef.current = true

    try {
      const currentUserRows = await fetchLeaderboardRows(leaderboardQueryRef.current, 0, 1, profileId)
      const currentUserPlayer = currentUserRows[0] ?? null
      setCurrentUserShareStats(currentUserPlayer)
      setCurrentUserRankPlayer(currentUserPlayer)
      if (currentUserPlayer) {
        setProfileScoreAdjustments((current) => ({
          ...current,
          [currentUserPlayer.profileId]: currentUserPlayer.scoreAdjustment,
        }))
      }
      return currentUserPlayer
    } catch {
      return null
    } finally {
      currentUserShareStatsLoadingRef.current = false
    }
  }

  async function loadLeaderboardPlayers(
    query = leaderboardQueryRef.current,
    offset = 0,
    mode: 'append' | 'replace' = 'replace',
    targetUserId = userId
  ) {
    if (leaderboardLoadingRef.current) return false

    leaderboardLoadingRef.current = true
    setLeaderboardStatus('')
    if (mode === 'append') {
      setIsLoadingMoreLeaderboardPlayers(true)
    } else {
      setIsLeaderboardLoading(true)
      setHasMoreLeaderboardPlayers(false)
      setCurrentUserRankPlayer(null)
      if (targetUserId && currentUserShareStats?.profileId !== targetUserId) {
        setCurrentUserShareStats(null)
      }
    }

    try {
      const players = await fetchLeaderboardRows(query, offset, LEADERBOARD_PAGE_SIZE)
      const totalCount = players[0]?.leaderboardTotalCount ?? offset + players.length
      const nextLoadedCount = mode === 'append'
        ? leaderboardLoadedCountRef.current + players.length
        : players.length
      const scoreAdjustments = Object.fromEntries(players.map((player) => [player.profileId, player.scoreAdjustment]))

      setLeaderboardLoaded(true)
      leaderboardLoadedCountRef.current = nextLoadedCount
      setHasMoreLeaderboardPlayers(nextLoadedCount < totalCount)
      setProfileScoreAdjustments((current) => ({
        ...current,
        ...scoreAdjustments,
      }))

      if (mode === 'append') {
        setLeaderboardPlayers((currentPlayers) => {
          const existingIds = new Set(currentPlayers.map((player) => player.profileId))
          return [...currentPlayers, ...players.filter((player) => !existingIds.has(player.profileId))]
        })
      } else {
        setLeaderboardPlayers(players)
      }

      if (targetUserId && mode === 'replace') {
        const currentUserRow = players.find((player) => player.profileId === targetUserId)
        if (currentUserRow) {
          setCurrentUserRankPlayer(currentUserRow)
          setCurrentUserShareStats(currentUserRow)
        } else {
          const currentUserRows = await fetchLeaderboardRows(query, 0, 1, targetUserId)
          const currentUserPlayer = currentUserRows[0] ?? null
          setCurrentUserRankPlayer(currentUserPlayer)
          setCurrentUserShareStats(currentUserPlayer)
          if (currentUserPlayer) {
            setProfileScoreAdjustments((current) => ({
              ...current,
              [currentUserPlayer.profileId]: currentUserPlayer.scoreAdjustment,
            }))
          }
        }
      }

      return true
    } catch (error) {
      const leaderboardError = error && typeof error === 'object'
        ? error as { message?: string; code?: string }
        : null
      setLeaderboardStatus(isMissingPagedLeaderboardFunction(leaderboardError) ? '' : error instanceof Error ? error.message : String(error))
      if (mode === 'replace') {
        setLeaderboardLoaded(false)
        leaderboardLoadedCountRef.current = 0
        setLeaderboardPlayers([])
        await loadSessions()
      }
      setHasMoreLeaderboardPlayers(false)
      return false
    } finally {
      leaderboardLoadingRef.current = false
      setIsLeaderboardLoading(false)
      setIsLoadingMoreLeaderboardPlayers(false)
    }
  }

  async function loadAllProfiles() {
    if (allProfilesLoadingRef.current) return false

    allProfilesLoadingRef.current = true
    const { data, error } = await (await getSupabase()).rpc('profile_search', {
      p_search: null,
      p_limit: 500,
      p_offset: 0,
      p_role: 'all',
      p_include_demo: false,
      p_sort: 'name_asc',
    })

    allProfilesLoadingRef.current = false

    if (error) {
      setCreateStatus(error.message)
      return false
    }

    const profileRows = (data ?? []) as Profile[]
    allProfilesLoadedRef.current = true
    setAllProfiles(profileRows)
    setProfileScoreAdjustments((current) => ({
      ...current,
      ...Object.fromEntries(profileRows.map((row) => {
        const adjustment = Number(row.score_adjustment ?? 0)
        return [row.id, Number.isFinite(adjustment) ? adjustment : 0]
      })),
    }))
    return true
  }

  function optionalSessionMetadataMissing(error: { message?: string } | null | undefined) {
    const message = error?.message?.toLowerCase() || ''
    return OPTIONAL_SESSION_METADATA_COLUMNS.some((column) => message.includes(column))
  }

  function scoreAdjustmentMapFromPayload(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([profileId, rawAdjustment]) => {
      const adjustment = Number(rawAdjustment ?? 0)
      return [profileId, Number.isFinite(adjustment) ? adjustment : 0]
    }))
  }

  function sessionPageFromRpcPayload(value: unknown): SessionListPageResult {
    const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    return {
      sessions: Array.isArray(payload.sessions)
        ? (payload.sessions as Session[]).map(normalizeSessionRow)
        : [],
      scoreAdjustments: scoreAdjustmentMapFromPayload(payload.scoreAdjustments),
      blockedTimes: Array.isArray(payload.blockedTimes) ? payload.blockedTimes as BlockedTime[] : [],
      hasMoreAfter: typeof payload.hasMoreAfter === 'boolean' ? payload.hasMoreAfter : null,
      source: 'rpc',
    }
  }

  function sessionDetailFromRpcPayload(value: unknown) {
    const payload = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    const session = payload.session && typeof payload.session === 'object'
      ? normalizeSessionRow(payload.session as Session)
      : null
    const invites = Array.isArray(payload.invites) ? payload.invites as SessionInvite[] : []
    const scoreAdjustments = scoreAdjustmentMapFromPayload(payload.scoreAdjustments)

    return { session, invites, scoreAdjustments }
  }

  function normalizeSessionRow(session: Session): Session {
    return {
      ...session,
      game_options: Array.isArray(session.game_options) ? session.game_options : [],
      game_votes: session.game_votes || {},
      session_participants: session.session_participants ?? [],
      session_waitlist: session.session_waitlist ?? [],
    }
  }

  function mergeJoinedParticipantIntoSession(sessionId: string, participant: Participant | null) {
    if (!participant) return

    setSessions((currentSessions) => currentSessions.map((session) => {
      if (session.id !== sessionId) return session

      const participants = session.session_participants ?? []
      const alreadyJoined = participants.some((item) => item.profile_id === participant.profile_id)

      return {
        ...session,
        session_participants: alreadyJoined
          ? participants.map((item) => item.profile_id === participant.profile_id ? { ...item, ...participant } : item)
          : [...participants, participant],
        session_waitlist: session.session_waitlist?.filter((entry) => entry.profile_id !== participant.profile_id),
      }
    }))
  }

  async function fetchCurrentUserSessionParticipant(sessionId: string) {
    if (!userId) return null

    const { data, error } = await (await getSupabase())
      .from('session_participants')
      .select(SESSION_CARD_PARTICIPANT_SELECT)
      .eq('session_id', sessionId)
      .eq('profile_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) return null
    return data as Participant
  }

  async function ensureUpcomingSessionsThroughDate(dateValue: string) {
    const today = localDateString()
    if (!dateValue || dateValue < today) return

    const currentEndDate = upcomingSessionsThroughRef.current || addDaysToDateValue(today, SESSION_LOAD_BATCH_DAYS - 1)
    const targetEndDate = upcomingBatchEndForDate(dateValue)

    if (targetEndDate <= currentEndDate) return

    const nextStartDate = addDaysToDateValue(currentEndDate, 1)
    const previousEndDate = upcomingSessionsThroughRef.current
    upcomingSessionsThroughRef.current = targetEndDate
    const loaded = await loadSessionRange(nextStartDate, targetEndDate, 'merge')
    if (!loaded) upcomingSessionsThroughRef.current = previousEndDate
  }

  async function ensurePastSessionsLoaded() {
    if (pastSessionsLoadedRef.current || pastSessionsLoadingRef.current) return

    pastSessionsLoadingRef.current = true
    setIsLoadingPastSessions(true)
    const loaded = await loadSessionRange(undefined, localDateString(), 'replace-past')
    pastSessionsLoadedRef.current = loaded
    pastSessionsLoadingRef.current = false
    setIsLoadingPastSessions(false)
  }

  async function loadTournamentData(focusSessionId?: string) {
    tournamentDataLoadingRef.current = true
    const client = await getSupabase()
    const auditSessionIds = Array.from(new Set([
      ...expandedSessionIdsRef.current,
      ...(focusSessionId ? [focusSessionId] : []),
    ]))
    const auditRequest = auditSessionIds.length > 0
      ? client
        .from('tournament_audit_log')
        .select('id, session_id, user_id, action, old_value, new_value, created_at')
        .in('session_id', auditSessionIds)
        .order('created_at', { ascending: false })
        .limit(80)
      : Promise.resolve({ data: [] as TournamentAuditLog[], error: null })

    const [editorsResult, poolsResult, entriesResult, matchesResult, auditResult] = await Promise.all([
      client.from('tournament_editors').select('id, session_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto'),
      client.from('tournament_pools').select('id, session_id, name, sort_order').is('deleted_at', null).order('sort_order', { ascending: true }),
      client.from('tournament_pool_entries').select('id, session_id, pool_id, participant_id, profile_id, seed, team_label').is('deleted_at', null),
      client
        .from('tournament_matches')
        .select('id, session_id, pool_id, stage, round, match_number, participant_a_id, participant_b_id, score_a, score_b, wins_a, wins_b, winner_participant_id, loser_participant_id, status, arena_number, queue_position, best_of')
        .is('deleted_at', null)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true }),
      auditRequest,
    ])

    const firstError = editorsResult.error || poolsResult.error || entriesResult.error || matchesResult.error || auditResult.error
    if (firstError) {
      setCreateStatus(firstError.message)
      tournamentDataLoadingRef.current = false
      return
    }

    tournamentDataLoadedRef.current = true
    tournamentDataLoadingRef.current = false
    setTournamentData({
      editors: (editorsResult.data ?? []) as TournamentEditor[],
      pools: (poolsResult.data ?? []) as TournamentPool[],
      poolEntries: (entriesResult.data ?? []) as TournamentPoolEntry[],
      matches: (matchesResult.data ?? []) as TournamentMatch[],
      auditLogs: (auditResult.data ?? []) as TournamentAuditLog[],
    })
  }

  async function loadNetworkData() {
    if (!userId) {
      networkDataLoadedRef.current = false
      networkDataLoadingRef.current = false
      setNetworkTablesReady(false)
      setFriendConnections([])
      setSessionInvites([])
      resetSessionMessageState()
      return
    }

    networkDataLoadingRef.current = true
    const sessionIds = sessions.map((session) => session.id)
    const client = await getSupabase()
    const [friendsResult, invitesResult] = await Promise.all([
      client
        .from('user_follows')
        .select('id, follower_id, following_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto, created_at')
        .eq('follower_id', userId),
      client
        .from('session_invites')
        .select('id, session_id, inviter_id, recipient_id, recipient_display_name, recipient_avatar_url, recipient_avatar_emoji, recipient_avatar_initials, recipient_avatar_color, recipient_avatar_text_color, recipient_profile_motto, status, created_at')
        .or(`recipient_id.eq.${userId},inviter_id.eq.${userId}`)
        .order('created_at', { ascending: false }),
    ])

    const networkReady = !friendsResult.error && !invitesResult.error
    networkDataLoadedRef.current = networkReady
    networkDataLoadingRef.current = false
    setNetworkTablesReady(networkReady)
    setFriendConnections(friendsResult.error ? [] : (friendsResult.data ?? []) as FriendConnection[])
    const inviteRows = invitesResult.error ? [] : (invitesResult.data ?? []) as SessionInvite[]
    setSessionInvites(inviteRows)

    const loadedSessionIds = new Set(sessionIds)
    const missingInviteSessionIds = Array.from(new Set(inviteRows.map((invite) => invite.session_id)))
      .filter((sessionId) => !loadedSessionIds.has(sessionId))
      .slice(0, 20)

    if (missingInviteSessionIds.length > 0) {
      const invitedSessionsResult = await client
        .from('sessions')
        .select(SESSION_CARD_SELECT)
        .in('id', missingInviteSessionIds)
        .is('deleted_at', null)
        .is('session_participants.deleted_at', null)
        .neq('status', 'cancelled')

      if (!invitedSessionsResult.error && invitedSessionsResult.data) {
        setSessions((currentSessions) => {
          const sessionsById = new Map(currentSessions.map((session) => [session.id, session]))
            ; ((invitedSessionsResult.data ?? []) as Session[]).map(normalizeSessionRow).forEach((session) => sessionsById.set(session.id, session))
          return sortSessionsByStart(Array.from(sessionsById.values()))
        })
      }
    }
  }

  useEffect(() => {
    ensureClubsLoadedRef.current = ensureClubsLoaded
    ensureLeaderboardLoadedRef.current = ensureLeaderboardLoaded
    ensureNetworkDataLoadedRef.current = ensureNetworkDataLoaded
    ensurePastSessionsLoadedRef.current = ensurePastSessionsLoaded
    ensureSessionsLoadedRef.current = ensureSessionsLoaded
    ensureTournamentDataLoadedRef.current = ensureTournamentDataLoaded
    ensureUpcomingSessionsThroughDateRef.current = ensureUpcomingSessionsThroughDate
    loadClubMessagesRef.current = loadClubMessages
    loadClubsRef.current = loadClubs
    loadExpandedSessionDetailsRef.current = loadExpandedSessionDetails
    loadExpandedSessionMessagesRef.current = loadExpandedSessionMessages
    hydrateCurrentUserShareStatsRef.current = hydrateCurrentUserShareStats
    loadLeaderboardPlayersRef.current = loadLeaderboardPlayers
    loadMoreUpcomingSessionsRef.current = loadMoreUpcomingSessions
    loadNetworkDataRef.current = loadNetworkData
    loadProfileRef.current = loadProfile
    loadSessionDetailRef.current = loadSessionDetail
    loadSessionMessagesRef.current = loadSessionMessages
    loadTournamentDataRef.current = loadTournamentData
    notifyInviteRef.current = notifyInvite
    notifySessionRef.current = notifySession
    preparePasswordRecoveryFromUrlRef.current = preparePasswordRecoveryFromUrl
    queueRealtimeRefreshRef.current = queueRealtimeRefresh
    refreshLeaderboardIfLoadedRef.current = refreshLeaderboardIfLoaded
    refreshSessionsIfLoadedRef.current = refreshSessionsIfLoaded
    syncProfileEverywhereRef.current = syncProfileEverywhere
    resetPasswordReadyTextRef.current = text.resetPasswordReady
  })

  useEffect(() => {
    if (!hasMountedInitialViewSyncRef.current) {
      hasMountedInitialViewSyncRef.current = true
      return
    }

    return schedulePostEffectStateUpdate(() => {
      setActiveView((currentView) => currentView === initialView ? currentView : initialView)
    })
  }, [initialView])

  useEffect(() => {
    if (!restoreStoredView) return undefined

    let storedView: AppView | null = null

    try {
      const storedValue = window.localStorage.getItem(BOOKING_ACTIVE_VIEW_STORAGE_KEY)
      storedView = isBookingAppView(storedValue) ? storedValue : null
    } catch {
      storedView = null
    }

    if (!storedView) return undefined

    return schedulePostEffectStateUpdate(() => {
      setActiveView((currentView) => currentView === storedView ? currentView : storedView)
    })
  }, [restoreStoredView])

  useEffect(() => {
    if (!externalLanguage) return
    return schedulePostEffectStateUpdate(() => {
      setLanguage((currentLanguage) => currentLanguage === externalLanguage ? currentLanguage : externalLanguage)
    })
  }, [externalLanguage])

  useEffect(() => {
    let active = true

    void loadTranslation(language).then((nextText) => {
      if (active) setText(nextText)
    })

    return () => {
      active = false
    }
  }, [language])

  useEffect(() => {
    try {
      window.localStorage.setItem(BOOKING_ACTIVE_VIEW_STORAGE_KEY, activeView)
    } catch { }

    const navigation: Record<string, string> | null = activeView === 'create' && createSessionMode === 'calendar'
      ? { mode: 'calendar', date: calendarWeekStart, venue: bookingVenue }
      : activeView === 'staff' && calendarBookingDraft
        ? { mode: 'staff-booking', date: calendarBookingDraft.date, time: calendarBookingDraft.time, venue: calendarBookingDraft.venueKey }
        : activeView === 'tickets' && calendarTicketDraft
          ? { mode: 'client-ticket', date: ticketDate, time: ticketTime, venue: bookingVenue }
          : null
    onActiveViewChange?.(activeView, navigation ? new URLSearchParams(navigation).toString() : activeView === 'create' ? '' : undefined)
  }, [activeView, bookingVenue, calendarBookingDraft, calendarTicketDraft, calendarWeekStart, createSessionMode, onActiveViewChange, ticketDate, ticketTime])

  useEffect(() => {
    onProfileChange?.(profile)
  }, [profile, onProfileChange])

  useEffect(() => {
    if (!profile || !userId) return
    if (currentUserShareStats?.profileId === userId) return

    return scheduleDeferredWork(() => {
      void hydrateCurrentUserShareStatsRef.current(userId)
    })
  }, [profile, userId, currentUserShareStats])

  useEffect(() => {
    let active = true
    const deferredCleanup = scheduleDeferredWork(() => {
      ensureClubsLoadedRef.current()
    })

    void (async () => {
      const recoverySessionReady = await preparePasswordRecoveryFromUrlRef.current()
      if (!active) return
      if (recoverySessionReady === false) {
        setIsProfileAuthLoading(false)
        loadLeaderboardPlayersRef.current()
        return
      }
      await loadProfileRef.current()
      if (!active) return
      loadLeaderboardPlayersRef.current()
    })()

    return () => {
      active = false
      deferredCleanup()
    }
  }, [setIsProfileAuthLoading])

  useEffect(() => {
    if (activeView === 'clubs' || activeView === 'create' || activeView === 'leaderboard') {
      ensureClubsLoadedRef.current()
    }

    if (activeView === 'leaderboard') {
      const nextQuery = initialLeaderboardQuery()
      setLeaderboardQuery(nextQuery)
      leaderboardLoadedCountRef.current = 0
      void loadLeaderboardPlayersRef.current(nextQuery, 0, 'replace', userId)
    }

    if (activeView === 'sessions' || activeView === 'tickets' || activeView === 'create' || activeView === 'profile') {
      ensureSessionsLoadedRef.current()
    }

    if (activeView === 'profile') {
      ensureNetworkDataLoadedRef.current()
      ensureLeaderboardLoadedRef.current()
    }
  }, [setLeaderboardQuery, activeView, leaderboardLoadedCountRef, leaderboardQueryRef, userId])

  useEffect(() => {
    if (activeView !== 'profile' || pendingTicketAuthAction) return undefined

    const pendingBooking = readPendingTicketAccountBooking()
    if (!pendingBooking) return undefined

    return schedulePostEffectStateUpdate(() => {
      setTicketType(pendingBooking.ticketType)
      setTicketDate(pendingBooking.date)
      setTicketTime(pendingBooking.time)
      setTicketPlayers(pendingBooking.players)
      setTicketDuration(pendingBooking.duration)
      setTicketSpecialNote(pendingBooking.specialNote)
      setPendingTicketAuthAction('book-after-login')
      setAuthMode(pendingBooking.authMode)
      setAuthStep('email')
      setProfilePassword('')
      setProfileStatus('')
    })
  }, [activeView, pendingTicketAuthAction, setAuthMode, setAuthStep, setPendingTicketAuthAction, setProfilePassword, setProfileStatus, setTicketDate, setTicketDuration, setTicketPlayers, setTicketSpecialNote, setTicketTime, setTicketType])

  useEffect(() => {
    if (sessionTimeScope === 'past') {
      void ensurePastSessionsLoadedRef.current()
    }
  }, [sessionTimeScope])

  useEffect(() => () => {
    if (leaderboardSearchReloadTimeoutRef.current) window.clearTimeout(leaderboardSearchReloadTimeoutRef.current)
    if (highlightedSessionTimeoutRef.current) window.clearTimeout(highlightedSessionTimeoutRef.current)
  }, [leaderboardSearchReloadTimeoutRef])

  useEffect(() => {
    if (activeView === 'tickets') {
      void ensureUpcomingSessionsThroughDateRef.current(ticketDate)
    }

    if (activeView === 'create') {
      void ensureUpcomingSessionsThroughDateRef.current(sessionDate)
    }

    if (editingSessionId) {
      void ensureUpcomingSessionsThroughDateRef.current(editSessionDate)
    }

    if (activeView === 'sessions' && sessionTimeScope === 'upcoming' && selectedSessionDate) {
      void ensureUpcomingSessionsThroughDateRef.current(selectedSessionDate)
    }
  }, [activeView, ticketDate, sessionDate, editingSessionId, editSessionDate, sessionTimeScope, selectedSessionDate])

  useEffect(() => {
    if (!challengeTargetId) return
    void ensureUpcomingSessionsThroughDateRef.current(challengeDate)
  }, [challengeDate, challengeTargetId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionTimeScope !== 'upcoming' || !hasMoreUpcomingSessions || isLoadingMoreSessions) return

    function loadWhenNearPageEnd() {
      const documentElement = document.documentElement
      const distanceFromEnd = documentElement.scrollHeight - window.scrollY - window.innerHeight
      if (distanceFromEnd < 640) {
        void loadMoreUpcomingSessionsRef.current()
      }
    }

    loadWhenNearPageEnd()
    window.addEventListener('scroll', loadWhenNearPageEnd, { passive: true })
    return () => window.removeEventListener('scroll', loadWhenNearPageEnd)
  }, [sessionTimeScope, hasMoreUpcomingSessions, isLoadingMoreSessions, sessions.length])

  useEffect(() => {
    networkDataLoadedRef.current = false
    networkDataLoadingRef.current = false

    if (!userId) {
      return schedulePostEffectStateUpdate(() => {
        setNetworkTablesReady(false)
        setFriendConnections([])
        setSessionInvites([])
        resetSessionMessageState()
      })
    }

    return scheduleDeferredWork(() => ensureNetworkDataLoadedRef.current())
  }, [resetSessionMessageState, userId])

  useEffect(() => {
    if (selectedPlayerId) {
      ensureNetworkDataLoadedRef.current()
    }
  }, [selectedPlayerId])

  useEffect(() => {
    if (!userId || !networkDataLoadedRef.current) return

    void loadNetworkDataRef.current()
  }, [sessionIdsKey, userId])

  useEffect(() => {
    const expandedIds = Object.entries(expandedSessions)
      .filter(([, expanded]) => expanded)
      .map(([sessionId]) => sessionId)
    expandedSessionIdsRef.current = new Set(expandedIds)
    if (expandedIds.length === 0) return

    ensureNetworkDataLoadedRef.current()
    expandedIds.forEach((sessionId) => {
      void loadSessionDetailRef.current(sessionId)
      void loadSessionMessagesRef.current(sessionId)
    })
    if (sessions.some((session) => expandedIds.includes(session.id) && session.session_type === 'tournament')) {
      ensureTournamentDataLoadedRef.current()
    }
  }, [expandedSessions, sessions])

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | null = null

    void getSupabase().then((client) => {
      if (!active) return

      const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
        if (!requiresStaffKioskPin(session?.user.email)) {
          setStaffKioskOperatorToken('')
          setKioskOperator(null)
        }

        authDebug('authStateChange', {
          event,
          hasSession: Boolean(session),
          user: session?.user ? {
            id: session.user.id,
            email: session.user.email,
            emailConfirmedAt: session.user.email_confirmed_at,
            lastSignInAt: session.user.last_sign_in_at,
            appMetadata: session.user.app_metadata,
            userMetadata: session.user.user_metadata,
          } : null,
        })

        if (event === 'SIGNED_OUT') {
          setUserId('')
          setAuthEmail('')
          setProfile(null)
          setPhoneSetupRequired(false)
          setPhoneSetupEmail('')
          setPhoneSetupSentTo('')
          setIsProfileAuthLoading(false)
          setMfaFactors([])
          setMfaEnrollment(null)
          setMfaChallenge(null)
          setMfaChallengeCode('')
          setMfaVerifyCode('')
          setMfaRequired(false)
          setMfaStatus('')
        }

        if (event === 'PASSWORD_RECOVERY' && session) {
          setUserId(session.user.id)
          setProfileEmail((currentEmail) => session.user.email || currentEmail)
          setIsRecoveryMode(true)
          setActiveView('profile')
          setAuthMode('login')
          setAuthStep('email')
          setProfileStatus(resetPasswordReadyTextRef.current)
        }
      })

      unsubscribe = () => authListener.subscription.unsubscribe()
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [setAuthEmail, setAuthMode, setAuthStep, setIsProfileAuthLoading, setIsRecoveryMode, setKioskOperator, setMfaChallenge, setMfaChallengeCode, setMfaEnrollment, setMfaFactors, setMfaRequired, setMfaStatus, setMfaVerifyCode, setPhoneSetupEmail, setPhoneSetupRequired, setPhoneSetupSentTo, setProfile, setProfileEmail, setProfileStatus, setUserId])

  useEffect(() => {
    if (!profile) return
    return schedulePostEffectStateUpdate(() => syncProfileEverywhereRef.current(profile))
  }, [profile])

  useEffect(() => {
    let active = true
    let cleanup: (() => void) | null = null

    void getSupabase().then((client) => {
      if (!active) return

      const channel = client
        .channel('vrena-live-refresh')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
          queueRealtimeRefreshRef.current(['sessions', 'leaderboard'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, () => {
          queueRealtimeRefreshRef.current(['sessions', 'leaderboard'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_waitlist' }, () => {
          queueRealtimeRefreshRef.current(['sessions', 'expandedDetails'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, () => {
          queueRealtimeRefreshRef.current(['clubs'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members' }, () => {
          queueRealtimeRefreshRef.current(['clubs'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_editors' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_pools' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_pool_entries' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_audit_log' }, () => {
          queueRealtimeRefreshRef.current(['tournament'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows' }, () => {
          queueRealtimeRefreshRef.current(['network'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_invites' }, () => {
          queueRealtimeRefreshRef.current(['network', 'expandedDetails'])
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_messages' }, () => {
          queueRealtimeRefreshRef.current(['expandedMessages'])
        })
        .subscribe()

      cleanup = () => {
        client.removeChannel(channel)
      }
    })

    return () => {
      active = false
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current)
        realtimeRefreshTimerRef.current = null
      }
      realtimeRefreshQueueRef.current = new Set()
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    if (!userId) return undefined

    let active = true
    let cleanup: (() => void) | null = null

    void getSupabase().then((client) => {
      if (!active) return

      const channel = client
        .channel(`vrena-profile-refresh:${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          () => {
            queueRealtimeRefreshRef.current(['profile', 'sessions', 'leaderboard', 'clubs', 'tournament'])
          }
        )
        .subscribe()

      cleanup = () => {
        client.removeChannel(channel)
      }
    })

    return () => {
      active = false
      cleanup?.()
    }
  }, [userId])

  useEffect(() => {
    const shouldShowCaptcha = authMode === 'reset' || ((authMode === 'create' || authMode === 'login') && authStep === 'credentials')

    if (typeof window === 'undefined' || profile || activeView !== 'profile' || !shouldShowCaptcha) return

    let cancelled = false

    ensureHCaptcha().then((hcaptcha) => {
      if (cancelled || !captchaContainerRef.current || !hcaptcha || captchaWidgetId.current) return

      captchaWidgetId.current = hcaptcha.render(captchaContainerRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: (token) => {
          updateCaptchaToken(token)
        },
        'expired-callback': () => updateCaptchaToken(''),
        'error-callback': () => updateCaptchaToken(''),
      })
    }).catch(() => {
      if (!cancelled) updateCaptchaToken('')
    })

    return () => {
      cancelled = true
      updateCaptchaToken('')

      removeHCaptchaWidget(captchaWidgetId.current)
      captchaWidgetId.current = null
    }
  }, [activeView, authMode, authStep, captchaContainerRef, captchaWidgetId, profile, updateCaptchaToken])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (profile || isRecoveryMode || activeView !== 'profile' || authMode !== 'login') return

    warmSupabaseClient()
  }, [activeView, authMode, isRecoveryMode, profile, warmSupabaseClient])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isSearchOpen && !search && !selectedSessionDate && !isClubSearchOpen && !clubSearch) return

    function closeSearchOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node
      const clickedSearch = searchShellRef.current?.contains(target)
      const clickedCalendar = dayStripRef.current?.contains(target)
      const clickedClubSearch = clubSearchShellRef.current?.contains(target)

      if (clickedSearch || clickedCalendar || clickedClubSearch) return

      if (isSearchOpen || search || selectedSessionDate) {
        setSearch('')
        setSelectedSessionDate('')
        setIsSearchOpen(false)
      }

      if (isClubSearchOpen || clubSearch) {
        setClubSearch('')
        setIsClubSearchOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeSearchOnOutsideClick)

    return () => {
      document.removeEventListener('pointerdown', closeSearchOnOutsideClick)
    }
  }, [clubSearch, clubSearchShellRef, isClubSearchOpen, isSearchOpen, search, selectedSessionDate, setClubSearch, setIsClubSearchOpen, setIsSearchOpen, setSearch, setSelectedSessionDate])

  const getAvailableTimeOptions = useCallback((date: string, duration: number, arenaCount: number, excludeSessionId = '') => (
    availableSessionTimes({ date, duration, arenaCount, excludeSessionId, sessions, blockedTimes, text: { arenaAvailable: text.arenaAvailable, arenasAvailable: text.arenasAvailable } })
  ), [blockedTimes, sessions, text.arenaAvailable, text.arenasAvailable])

  const getCafeSoftOpeningTimeOptions = cafeTicketTimes

  const getTicketTimeOptions = useCallback((date: string, duration: number, arenaCount: number) => (
    isHaDoBookingVenue
      ? getAvailableTimeOptions(date, duration, arenaCount)
      : getCafeSoftOpeningTimeOptions(date, duration, arenaCount)
  ), [getAvailableTimeOptions, getCafeSoftOpeningTimeOptions, isHaDoBookingVenue])

  const timeOptions = useMemo(() => {
    return getAvailableTimeOptions(sessionDate, sessionDuration, sessionArenaCount)
  }, [getAvailableTimeOptions, sessionArenaCount, sessionDate, sessionDuration])

  const editTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(editSessionDate, editSessionDuration, editSessionArenaCount, editingSessionId)
  }, [editSessionArenaCount, editSessionDate, editSessionDuration, editingSessionId, getAvailableTimeOptions])

  const activeTicketService = selectedTicketService(ticketType)
  const activeTicketPriceBlockMinutes = ticketPriceBlockMinutesForDate(ticketDate)
  const activeTicketDuration = Math.min(ticketMaxCustomerDurationMinutes, Math.max(activeTicketPriceBlockMinutes, ticketDuration))
  const activeTicketArenaCount = isHaDoBookingVenue ? ticketArenaCountForPlayers(ticketArenaCount) : 1
  const ticketTimeOptions = useMemo(() => {
    return getTicketTimeOptions(ticketDate, activeTicketDuration, activeTicketArenaCount)
  }, [activeTicketArenaCount, activeTicketDuration, getTicketTimeOptions, ticketDate])
  useEffect(() => {
    if (activeView !== 'tickets' || ticketTimeOptions.length === 0) return

    const selectedTimeStillAvailable = ticketTimeOptions.some((option) => option.value === ticketTime)
    if (ticketTime && selectedTimeStillAvailable) return

    return schedulePostEffectStateUpdate(() => {
      setTicketTime((currentTime) => (
        currentTime && ticketTimeOptions.some((option) => option.value === currentTime)
          ? currentTime
          : ticketTimeOptions[0].value
      ))
      if (ticketTime && !selectedTimeStillAvailable) setTicketConfirmation(null)
    })
  }, [activeView, setTicketConfirmation, setTicketTime, ticketTime, ticketTimeOptions])
  const ticketNextAvailableSearchEndDate = useMemo(() => {
    if (!ticketDate) return ''

    const searchStartDate = ticketDate < localDateString() ? localDateString() : ticketDate
    return addDaysToDateValue(searchStartDate, TICKET_NEXT_AVAILABLE_SCAN_DAYS)
  }, [ticketDate])
  const nextTicketDateWithAvailability = useMemo(() => {
    if (!ticketDate || ticketTimeOptions.length > 0 || !ticketNextAvailableSearchEndDate) return ''

    const searchStartDate = ticketDate < localDateString() ? localDateString() : ticketDate
    for (let offset = 1; offset <= TICKET_NEXT_AVAILABLE_SCAN_DAYS; offset += 1) {
      const candidateDate = addDaysToDateValue(searchStartDate, offset)
      const candidateOptions = getTicketTimeOptions(candidateDate, activeTicketDuration, activeTicketArenaCount)
      if (candidateOptions.length > 0) return candidateDate
    }

    return ''
  }, [
    activeTicketArenaCount,
    activeTicketDuration,
    getTicketTimeOptions,
    ticketDate,
    ticketNextAvailableSearchEndDate,
    ticketTimeOptions.length,
  ])
  useEffect(() => {
    if (activeView !== 'tickets' || !ticketDate || ticketTimeOptions.length > 0 || !ticketNextAvailableSearchEndDate) return

    const loadedThroughDate = upcomingSessionsThroughRef.current || ''
    if (loadingSessionRangeRef.current) {
      const retryTimer = window.setTimeout(() => {
        setTicketAvailabilitySearchTick((tick) => tick + 1)
      }, 250)
      return () => window.clearTimeout(retryTimer)
    }

    if (!sessionsLoadedRef.current || !loadedThroughDate || loadedThroughDate < ticketNextAvailableSearchEndDate) {
      if (ticketAvailabilitySearchLoadingRef.current) return
      ticketAvailabilitySearchLoadingRef.current = true
      void ensureUpcomingSessionsThroughDateRef.current(ticketNextAvailableSearchEndDate)
        .finally(() => {
          ticketAvailabilitySearchLoadingRef.current = false
          setTicketAvailabilitySearchTick((tick) => tick + 1)
        })
      return
    }

    if (!nextTicketDateWithAvailability || nextTicketDateWithAvailability === ticketDate) return

    return schedulePostEffectStateUpdate(() => {
      setTicketDate((currentDate) => currentDate === ticketDate ? nextTicketDateWithAvailability : currentDate)
      setTicketTime('')
      setTicketConfirmation(null)
      clearTicketStatus()
    })
  }, [activeView, clearTicketStatus, nextTicketDateWithAvailability, setTicketAvailabilitySearchTick, setTicketConfirmation, setTicketDate, setTicketTime, ticketAvailabilitySearchLoadingRef, ticketAvailabilitySearchTick, ticketDate, ticketNextAvailableSearchEndDate, ticketTimeOptions.length])
  const challengeTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(challengeDate, challengeDuration, 1)
  }, [challengeDate, challengeDuration, getAvailableTimeOptions])
  const {
    ticketUseLoyaltyPoints,
    ticketLoyaltyPointsToRedeem,
    isLoadingTicketLoyalty,
    ticketDiscountCode,
    ticketDiscountQuote,
    ticketDiscountStatus,
    isCheckingTicketDiscount,
    setTicketUseLoyaltyPoints,
    setTicketLoyaltyPointsToRedeem,
    setTicketLoyaltyRedemption,
    setTicketDiscountCode,
    setTicketDiscountQuote,
    setTicketAutomaticDiscountQuote,
    setTicketDiscountStatus,
    currentTicketPricing,
    currentTicketUnitPrice,
    isSpecialTicketType,
    activeTicketDiscountAmount,
    activeTicketDiscountSource,
    ticketLoyaltyBalance,
    ticketLoyaltyRedeemValue,
    maxTicketLoyaltyPoints,
    appliedTicketLoyaltyPoints,
    ticketLoyaltyDiscountAmount,
    currentTicketTotalPrice,
    estimatedTicketLoyaltyPointsEarned,
    estimatedTicketLoyaltyReductionValue,
    ticketDiscountCodeInvalidText,
    ticketDiscountCodeCheckingText
  } = useTicketCheckout({
    ticketType,
    ticketDate,
    ticketTime,
    ticketPlayers,
    activeTicketDuration,
    activeTicketArenaCount,
    bookingVenue,
    isHaDoBookingVenue,
    activeView,
    profile,
    text,
  })
  const gameGuideGames = useMemo(() => {
    if (!gameGuideGameId) return publicGameGuideCatalog
    const focusedGame = publicGameGuideCatalog.find((game) => game.id === gameGuideGameId)
    if (!focusedGame) return publicGameGuideCatalog
    return [focusedGame, ...publicGameGuideCatalog.filter((game) => game.id !== gameGuideGameId)]
  }, [gameGuideGameId])
  const effectiveEditTicketDuration = editSessionDuration
  const editTicketPricing = ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, editSessionMaxPlayers, effectiveEditTicketDuration, editSessionArenaCount)
  const minimumTicketDuration = ticketDurationForPlayers(ticketType, ticketPlayers, activeTicketArenaCount, ticketDate, bookingVenue)
  const ticketDurationOptions = useMemo(() => {
    const durationOptions = Array.from(
      { length: Math.floor((ticketMaxCustomerDurationMinutes - activeTicketPriceBlockMinutes) / activeTicketPriceBlockMinutes) + 1 },
      (_, index) => activeTicketPriceBlockMinutes + index * activeTicketPriceBlockMinutes
    )

    if (!ticketDate) return durationOptions

    return durationOptions.filter((duration) => {
      if (duration < minimumTicketDuration) return false
      const options = getTicketTimeOptions(ticketDate, duration, activeTicketArenaCount)
      if (ticketTime) return options.some((option) => option.value === ticketTime)
      return options.length > 0
    })
  }, [activeTicketArenaCount, activeTicketPriceBlockMinutes, getTicketTimeOptions, minimumTicketDuration, ticketDate, ticketTime])
  const ticketPlayerOptions = useMemo(() => {
    return Array.from(
      { length: activeTicketService.maxPlayers - activeTicketService.minPlayers + 1 },
      (_, index) => activeTicketService.minPlayers + index
    )
  }, [activeTicketService.maxPlayers, activeTicketService.minPlayers])

  useEffect(() => {
    return schedulePostEffectStateUpdate(() => {
      if (ticketDurationOptions.length === 0) {
        if (ticketTime) setTicketTime('')
        return
      }

      if (!ticketDurationOptions.includes(activeTicketDuration)) {
        setTicketDuration(ticketDurationOptions[0])
        setTicketTime('')
        setTicketConfirmation(null)
      }
    })
  }, [activeTicketDuration, setTicketConfirmation, setTicketDuration, setTicketTime, ticketDurationOptions, ticketTime])

  const sessionDurationRecommendation = durationRecommendation(sessionMaxPlayers, sessionDuration)
  const editSessionDurationRecommendation = durationRecommendation(editSessionMaxPlayers, editSessionDuration)

  function handleSessionDateChange(value: string) {
    setSessionDate(value)
  }

  function showTicketStatus(message: string, variant: 'info' | 'error' = 'info') {
    setTicketStatus(message)
    setTicketStatusVariant(variant)
  }

  function handleBookingVenueChange(value: BookingVenueId) {
    const nextTicketDate = value === 'cafe-des-stagiaires' && ticketDate < CAFE_SOFT_OPENING_DATE
      ? CAFE_SOFT_OPENING_DATE
      : ticketDate
    setBookingVenue(value)
    setTicketArenaCount(1)
    setTicketDuration(ticketDurationForPlayers(ticketType, ticketPlayers, 1, nextTicketDate, value))
    setTicketTime('')
    setTicketConfirmation(null)
    setTicketDiscountCode('')
    setTicketDiscountQuote(null)
    setTicketAutomaticDiscountQuote(null)
    setTicketDiscountStatus('')
    setTicketUseLoyaltyPoints(false)
    setTicketLoyaltyPointsToRedeem('')
    clearTicketStatus()

    if (value === 'cafe-des-stagiaires' && ticketDate < CAFE_SOFT_OPENING_DATE) {
      setTicketDate(CAFE_SOFT_OPENING_DATE)
    }
  }

  function ticketAccountBookingConfirmationMessage() {
    if (!isHaDoBookingVenue) return text.bookingRequestPendingZalo

    const pendingBooking = readPendingTicketAccountBooking()
    if (!pendingBooking) return text.guestTicketSavedToAccount

    return text.ticketAccountBookingConfirmed
      .replace('{date}', formatShortDate(pendingBooking.date, language))
      .replace('{time}', pendingBooking.time)
      .replace('{players}', String(pendingBooking.players))
  }

  async function prepareGuestTicketAction(
    action: 'create-account' | 'guest',
    options: { continueWithoutAccount?: boolean } = {}
  ): Promise<'ready' | 'confirmation-required' | 'blocked'> {
    const validation = validateGuestTicketContact(guestTicketContact, looseText)
    if (validation.error) {
      showTicketStatus(validation.error, 'error')
      return 'blocked'
    }

    clearTicketStatus()
    if (action === 'guest' && !options.continueWithoutAccount) return 'confirmation-required'

    return 'ready'
  }

  async function claimPendingGuestTicketForAccount() {
    if (!pendingGuestTicketClaim?.phone || !pendingGuestTicketClaim.reference) return ''

    const claimDate = pendingGuestTicketClaim.date
    const { data, error } = await (await getSupabase()).rpc('claim_guest_ticket_booking', {
      p_guest_phone: pendingGuestTicketClaim.phone,
      p_ticket_reference: pendingGuestTicketClaim.reference,
    })

    if (error) return error.message || text.ticketBookingError

    const claimResult = (data && typeof data === 'object' ? data : {}) as { loyalty_points_total?: number | null }
    setPendingGuestTicketClaim(null)
    if (claimResult.loyalty_points_total !== undefined && claimResult.loyalty_points_total !== null) {
      const nextPointsTotal = Math.max(0, Math.floor(Number(claimResult.loyalty_points_total) || 0))
      setTicketLoyaltyRedemption((current) => current
        ? { ...current, loyalty_points_total: nextPointsTotal }
        : { loyalty_points_total: nextPointsTotal, redeem_value_vnd_per_point: ticketLoyaltyRedeemValue })
    }
    await loadSessions({ focusDate: claimDate })
    return ''
  }

  async function completePendingTicketAuth(activeProfile: Profile | null) {
    if (!pendingTicketAuthAction || !activeProfile || pendingTicketAuthCompletingRef.current) return false

    pendingTicketAuthCompletingRef.current = true
    try {
      if (pendingTicketAuthAction === 'claim-after-auth') {
        const claimError = await claimPendingGuestTicketForAccount()
        if (claimError) {
          showTicketStatus(claimError, 'error')
          setProfileStatus(claimError)
          setActiveView('tickets')
          return true
        }

        setTicketConfirmation((current) => current
          ? { ...current, guestPhone: undefined, guestName: undefined }
          : current)
        showTicketStatus(text.guestTicketSavedToAccount)
        setProfileStatus(text.guestTicketSavedToAccount)
        await loadProfile()
        setActiveView('tickets')
        return true
      }

      if (pendingTicketAuthAction === 'book-after-login') {
        const booked = ticketConfirmation ? true : await bookTickets(activeProfile)
        if (booked) {
          const confirmationMessage = ticketAccountBookingConfirmationMessage()
          clearPendingTicketAccountBooking()
          setTicketConfirmation((current) => current
            ? { ...current, guestPhone: undefined, guestName: undefined }
            : current)
          showTicketStatus(confirmationMessage)
          setProfileStatus(confirmationMessage)
        }
        setActiveView('tickets')
        return true
      }

      return false
    } finally {
      setPendingTicketAuthAction(null)
      pendingTicketAuthCompletingRef.current = false
    }
  }

  function validateTicketSelection(activeProfile = profile) {
    const service = selectedTicketService(ticketType)
    const selectedTimeOption = ticketTimeOptions.find((option) => option.value === ticketTime)

    if (!ticketDate || !ticketTime || !selectedTimeOption) {
      showTicketStatus(text.ticketRequired, 'error')
      return false
    }

    if (ticketPlayers < service.minPlayers || ticketPlayers > service.maxPlayers) {
      showTicketStatus(text.ticketPlayersInvalid, 'error')
      return false
    }

    if (isHaDoBookingVenue && activeProfile && ticketUseLoyaltyPoints && appliedTicketLoyaltyPoints <= 0) {
      showTicketStatus(text.ticketLoyaltyInvalid, 'error')
      return false
    }

    const normalizedTicketDiscountCode = ticketDiscountCode.trim().toUpperCase()
    if (isHaDoBookingVenue && !isSpecialTicketType && normalizedTicketDiscountCode && isCheckingTicketDiscount) {
      showTicketStatus(ticketDiscountCodeCheckingText)
      return false
    }

    if (isHaDoBookingVenue && !isSpecialTicketType && normalizedTicketDiscountCode && !ticketDiscountQuote) {
      showTicketStatus(ticketDiscountCodeInvalidText, 'error')
      return false
    }

    return true
  }

  function handleTicketTypeChange(value: TicketType) {
    const service = selectedTicketService(value)
    const nextPlayers = Math.min(service.maxPlayers, Math.max(service.minPlayers, ticketPlayers))
    const nextDuration = Math.max(ticketDurationForPlayers(value, nextPlayers, activeTicketArenaCount, ticketDate, bookingVenue), ticketDuration)
    const nextIsSpecialTicket = value !== 'individual'
    setTicketType(value)
    setTicketPlayers(nextPlayers)
    setTicketDuration(nextDuration)
    setTicketTime('')
    setTicketConfirmation(null)
    clearTicketStatus()
    if (nextIsSpecialTicket) {
      setTicketDiscountCode('')
      setTicketDiscountQuote(null)
      setTicketDiscountStatus('')
      setTicketAutomaticDiscountQuote(null)
      setTicketUseLoyaltyPoints(false)
      setTicketLoyaltyPointsToRedeem('')
    } else {
      setTicketSpecialNote('')
    }
  }

  function handleTicketSpecialNoteChange(value: string) {
    setTicketSpecialNote(value.slice(0, 500))
    setTicketConfirmation(null)
    clearTicketStatus()
  }

  function handleTicketPlayersChange(value: number) {
    const nextArenaCount = !isHaDoBookingVenue || value <= 4 ? 1 : activeTicketArenaCount
    const nextMinimumDuration = ticketDurationForPlayers(ticketType, value, nextArenaCount, ticketDate, bookingVenue)
    const nextDuration = Math.max(nextMinimumDuration, ticketDuration)
    const nextTimeOptions = getTicketTimeOptions(ticketDate, nextDuration, nextArenaCount)
    const keepsSelectedTime = ticketTime && nextTimeOptions.some((option) => option.value === ticketTime)

    setTicketPlayers(value)
    setTicketArenaCount(nextArenaCount)
    setTicketDuration(nextDuration)
    setTicketConfirmation(null)
    if (!keepsSelectedTime || nextDuration !== activeTicketDuration || nextArenaCount !== activeTicketArenaCount) {
      setTicketTime('')
    }
  }

  function handleTicketArenaCountChange(value: number) {
    const nextArenaCount = !isHaDoBookingVenue || ticketPlayers <= 4 ? 1 : ticketArenaCountForPlayers(value)
    const nextMinimumDuration = ticketDurationForPlayers(ticketType, ticketPlayers, nextArenaCount, ticketDate, bookingVenue)
    const nextDuration = Math.max(nextMinimumDuration, ticketDuration)
    const nextTimeOptions = getTicketTimeOptions(ticketDate, nextDuration, nextArenaCount)
    const keepsSelectedTime = ticketTime && nextTimeOptions.some((option) => option.value === ticketTime)

    setTicketArenaCount(nextArenaCount)
    setTicketDuration(nextDuration)
    setTicketConfirmation(null)
    clearTicketStatus()
    if (!keepsSelectedTime || nextDuration !== activeTicketDuration || nextArenaCount !== activeTicketArenaCount) {
      setTicketTime('')
    }
  }

  function handleTicketDurationChange(value: number) {
    const nextDuration = Math.min(ticketMaxCustomerDurationMinutes, Math.max(activeTicketPriceBlockMinutes, value))
    const nextTimeOptions = getTicketTimeOptions(ticketDate, nextDuration, activeTicketArenaCount)
    const keepsSelectedTime = ticketTime && nextTimeOptions.some((option) => option.value === ticketTime)

    setTicketDuration(nextDuration)
    if (!keepsSelectedTime) setTicketTime('')
    setTicketConfirmation(null)
  }

  function handleTicketUseLoyaltyPointsChange(checked: boolean) {
    setTicketUseLoyaltyPoints(checked)
    setTicketConfirmation(null)
    if (checked) {
      setTicketLoyaltyPointsToRedeem((current) => {
        const requested = Math.max(0, Math.floor(Number(current) || 0))
        const nextPoints = requested > 0 ? Math.min(requested, maxTicketLoyaltyPoints) : maxTicketLoyaltyPoints
        return nextPoints > 0 ? String(nextPoints) : ''
      })
    } else {
      setTicketLoyaltyPointsToRedeem('')
    }
  }

  function handleTicketLoyaltyPointsChange(value: string) {
    const requested = Math.max(0, Math.floor(Number(value) || 0))
    const nextPoints = maxTicketLoyaltyPoints > 0 ? Math.min(requested, maxTicketLoyaltyPoints) : 0
    setTicketLoyaltyPointsToRedeem(value === '' ? '' : String(nextPoints))
    setTicketConfirmation(null)
  }

  function handleTicketDiscountCodeChange(value: string) {
    setTicketDiscountCode(value.toUpperCase())
    setTicketDiscountQuote(null)
    setTicketDiscountStatus('')
    setTicketConfirmation(null)
  }

  function replayOnboardingTour() {
    setActiveView('profile')
    setTourReplayNonce((value) => value + 1)
  }

  function handleMaxPlayersChange(value: number) {
    setSessionMaxPlayers(value)

    if (value < 8) {
      setSessionArenaCount(1)
    }
  }

  function handleArenaCountChange(value: number) {
    if (value === 2 && sessionMaxPlayers < 8) {
      setSessionMaxPlayers(8)
    }

    setSessionArenaCount(value)
  }

  function handleEditMaxPlayersChange(value: number) {
    setEditSessionMaxPlayers(value)

    if (editBookingType === 'ticket') {
      const nextArenaCount = value <= 4 ? 1 : editSessionArenaCount
      const nextDuration = ticketDurationForPlayers(editTicketType, value, nextArenaCount, editSessionDate)
      setEditSessionArenaCount(nextArenaCount)
      setEditSessionDuration(nextDuration)
      setEditTicketTotalPrice(String(ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, value, nextDuration, nextArenaCount).totalPrice))
      return
    }

    if (value < 8) {
      setEditSessionArenaCount(1)
    }
  }

  function handleEditArenaCountChange(value: number) {
    if (editBookingType === 'ticket') {
      const nextArenaCount = editSessionMaxPlayers <= 4 ? 1 : ticketArenaCountForPlayers(value)
      const nextDuration = Math.max(ticketDurationForPlayers(editTicketType, editSessionMaxPlayers, nextArenaCount, editSessionDate), editSessionDuration)
      setEditSessionArenaCount(nextArenaCount)
      setEditSessionDuration(nextDuration)
      setEditTicketTotalPrice(String(ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, editSessionMaxPlayers, nextDuration, nextArenaCount).totalPrice))
      return
    }

    if (value === 2 && editSessionMaxPlayers < 8) {
      setEditSessionMaxPlayers(8)
    }

    setEditSessionArenaCount(value)
  }

  function durationRecommendation(maxPlayers: number, duration: number) {
    if (maxPlayers > 8 && duration < 60) return text.durationRecommend60
    if (maxPlayers > 4 && duration < 40) return text.durationRecommend40
    return ''
  }

  function handleSessionClubChange(value: string) {
    setSessionClubId(value)
    if (value) {
      setSessionVisibility('public')
      setCreateStatus(text.clubOnlyCreateHint)
    } else if (createStatus === text.clubOnlyCreateHint) {
      setCreateStatus('')
    }
  }

  const calendarWeekDays = useMemo(() => {
    return weekDaysFromStart(calendarWeekStart).map((value) => ({ value, ...formatDayButton(value, language) }))
  }, [calendarWeekStart, language])

  const calendarWeekEnd = addDaysToDateValue(calendarWeekStart, 6)

  const calendarTimeSlots = useMemo(() => {
    return Array.from({ length: Math.floor((CLOSE_MINUTES - OPEN_MINUTES) / TIME_STEP_MINUTES) }, (_, index) => {
      const minutes = OPEN_MINUTES + index * TIME_STEP_MINUTES
      return {
        minutes,
        value: minutesToTime(minutes),
        isHour: minutes % 60 === 0,
      }
    })
  }, [])

  const calendarSessions = useMemo(() => {
    return sortSessionsByStart(
      sessions.filter((session) => session.date >= calendarWeekStart && session.date <= calendarWeekEnd && (session.venue_key || 'ha-do-centrosa') === bookingVenue && session.status !== 'cancelled' && !['cancelled', 'expired'].includes(session.ticket_status || ''))
    )
  }, [bookingVenue, calendarWeekEnd, calendarWeekStart, sessions])
  const calendarSessionLanes = useMemo(() => calendarLanes(calendarSessions), [calendarSessions])

  const calendarAvailableSlotKeys = useMemo(() => {
    const availableKeys = new Set<string>()
    const today = localDateString()
    calendarWeekDays.forEach((day) => {
      if (day.value < today) return
      const options = isHaDoBookingVenue
        ? getAvailableTimeOptions(day.value, TIME_STEP_MINUTES, 1)
        : getCafeSoftOpeningTimeOptions(day.value, TIME_STEP_MINUTES, 1)
      options.forEach((option) => {
        const start = timeToMinutes(option.value)
        const cafeOccupied = !isHaDoBookingVenue && calendarSessions.some((session) => session.date === day.value && session.status === 'open' && rangesOverlap(start, start + TIME_STEP_MINUTES, timeToMinutes(session.start_time), timeToMinutes(session.start_time) + session.duration_minutes))
        if (!cafeOccupied) availableKeys.add(`${day.value}-${option.value}`)
      })
    })
    return availableKeys
  }, [calendarSessions, calendarWeekDays, getAvailableTimeOptions, getCafeSoftOpeningTimeOptions, isHaDoBookingVenue])

  const filteredSessions = useMemo(() => {
    const query = normalizeSearchValue(search)

    const matchingSessions = sessions.filter((session) => {
      if (sessionTimeScope === 'upcoming' && !isUpcomingSession(session)) return false
      if (sessionTimeScope === 'past' && !isPastSession(session)) return false
      if (selectedSessionDate && session.date !== selectedSessionDate) return false
      if (!query) return true

      const selectedGameNames = session.game_options
        .map((gameId) => games.find((game) => game.id === gameId)?.title || gameId)
        .join(' ')
      const profileNames = (session.session_participants ?? [])
        .map((participant) => participant.display_name || '')
        .join(' ')
      const haystack = normalizeSearchValue([
        session.name,
        profileNames,
        selectedGameNames,
        session.invite_code || '',
      ].join(' '))

      return haystack.includes(query)
    })

    const sortedSessions = sortSessionsByStart(matchingSessions)
    return sessionTimeScope === 'past' ? sortedSessions.reverse() : sortedSessions
  }, [search, selectedSessionDate, sessionTimeScope, sessions])

  const filteredClubs = useMemo(() => {
    const query = normalizeSearchValue(clubSearch)
    const visibleClubs = clubVisibilityFilter === 'all'
      ? clubs
      : clubs.filter((club) => club.visibility === clubVisibilityFilter)
    if (!query) return visibleClubs

    return visibleClubs.filter((club) => {
      const memberNames = clubMembers(club)
        .map((member) => member.display_name || '')
        .join(' ')
      const haystack = normalizeSearchValue([
        club.name,
        club.description || '',
        club.visibility,
        memberNames,
      ].join(' '))

      return haystack.includes(query)
    })
  }, [clubSearch, clubVisibilityFilter, clubs])

  const sessionDayOptions = useMemo(() => {
    const today = new Date()
    const upcomingDays = Array.from({ length: 14 }, (_, index) => {
      const value = localDateString(addDays(today, index))
      return { value, ...formatDayButton(value, language) }
    })
    const scopedSessions = sessions.filter((session) =>
      sessionTimeScope === 'past' ? isPastSession(session) : isUpcomingSession(session)
    )
    const sessionDays = scopedSessions.map((session) => session.date)
    const uniqueDays = Array.from(new Set([
      ...(sessionTimeScope === 'upcoming' ? upcomingDays.map((day) => day.value) : []),
      ...sessionDays,
    ])).sort()

    return uniqueDays.map((value) => {
      const existing = upcomingDays.find((day) => day.value === value)
      return existing || { value, ...formatDayButton(value, language) }
    })
  }, [language, sessionTimeScope, sessions])

  const mySessions = useMemo(() => {
    if (!userId) return []

    return sessions.filter((session) => {
      const isOwner = session.owner_id === userId
      const isParticipant = (session.session_participants ?? []).some((participant) => participant.profile_id === userId)
      return isOwner || isParticipant
    })
  }, [sessions, userId])

  const profileUpcomingSessions = useMemo(() => {
    return mySessions
      .filter((session) => isUpcomingSession(session))
      .sort((a, b) => sessionStartDate(a).getTime() - sessionStartDate(b).getTime())
  }, [mySessions])

  const profilePastSessions = useMemo(() => {
    return mySessions
      .filter((session) => isPastSession(session))
      .sort((a, b) => sessionStartDate(b).getTime() - sessionStartDate(a).getTime())
  }, [mySessions])

  const pendingSessionInvites = useMemo(() => {
    if (!userId) return []

    return sessionInvites
      .filter((invite) => invite.recipient_id === userId && invite.status === 'pending' && sessionForInvite(invite))
      .sort((a, b) => {
        const left = a.created_at ? new Date(a.created_at).getTime() : 0
        const right = b.created_at ? new Date(b.created_at).getTime() : 0
        return right - left || a.id.localeCompare(b.id)
      })
  }, [sessionForInvite, sessionInvites, userId])

  const invitePopupInvite = useMemo(() => {
    if (!invitePopupInviteId) return undefined
    return pendingSessionInvites.find((invite) => invite.id === invitePopupInviteId)
  }, [invitePopupInviteId, pendingSessionInvites])

  const invitePopupSession = invitePopupInvite ? sessionForInvite(invitePopupInvite) : undefined

  const joinedUpcomingSessions = useMemo(() => {
    if (!userId) return []

    return sessions
      .filter((session) =>
        isUpcomingSession(session)
        && (session.session_participants ?? []).some((participant) => participant.profile_id === userId)
      )
      .sort((a, b) => sessionStartDate(a).getTime() - sessionStartDate(b).getTime())
  }, [sessions, userId])

  const sessionReminders = useMemo(() => {
    const now = new Date()

    return joinedUpcomingSessions.map((session) => {
      const start = sessionStartDate(session)
      const diff = start.getTime() - now.getTime()
      const hours = diff / (60 * 60 * 1000)

      if (hours <= 2) return { session, label: text.reminderSoon }
      if (hours <= 24) return { session, label: text.reminderTomorrow }
      return { session, label: text.reminderJoined }
    })
  }, [joinedUpcomingSessions, text.reminderJoined, text.reminderSoon, text.reminderTomorrow])

  const sessionClubOptions = useMemo(() => {
    if (!userId) return []

    return clubs.filter((club) => club.owner_id === userId || clubMembers(club).some((member) => member.profile_id === userId && member.status === 'approved'))
  }, [clubs, userId])

  const selectedClub = useMemo(() => {
    return clubs.find((club) => club.id === selectedClubId)
  }, [clubs, selectedClubId])

  const clubUnlockTarget = useMemo(() => {
    return clubs.find((club) => club.id === clubUnlockTargetId)
  }, [clubUnlockTargetId, clubs])

  const selectedClubMembership = useMemo(() => {
    if (!selectedClub) return undefined
    return clubMembers(selectedClub).find((member) => member.profile_id === userId)
  }, [selectedClub, userId])

  const canSeeSelectedClubPrivateData = canSeeClubPrivateData(selectedClub)

  const selectedClubSessions = useMemo(() => {
    if (!selectedClub || !canSeeSelectedClubPrivateData) return []
    return sessions.filter((session) => {
      if (session.club_id !== selectedClub.id) return false
      return selectedClubSessionScope === 'past' ? isPastSession(session) : isUpcomingSession(session)
    })
  }, [canSeeSelectedClubPrivateData, selectedClub, selectedClubSessionScope, sessions])

  const selectedClubDayOptions = useMemo(() => {
    const uniqueDays = Array.from(new Set(selectedClubSessions.map((session) => session.date))).sort()
    return uniqueDays.map((value) => ({ value, ...formatDayButton(value, language) }))
  }, [language, selectedClubSessions])

  const filteredSelectedClubSessions = useMemo(() => {
    if (!selectedClubDate) return selectedClubSessions
    return selectedClubSessions.filter((session) => session.date === selectedClubDate)
  }, [selectedClubDate, selectedClubSessions])

  const selectedClubApprovedMembers = useMemo(() => {
    return clubMembers(selectedClub).filter((member) => member.status === 'approved')
  }, [selectedClub])

  const selectedClubPendingMembers = useMemo(() => {
    return clubMembers(selectedClub).filter((member) => member.status === 'pending')
  }, [selectedClub])

  useEffect(() => {
    if (!selectedClub) return

    return schedulePostEffectStateUpdate(() => {
      const themeColor = clubTheme(selectedClub)
      setClubEditName(selectedClub.name)
      setClubEditMotto(selectedClub.motto || '')
      setClubEditDescription(selectedClub.description || '')
      setClubEditVisibility(selectedClub.visibility)
      setClubEditThemeColor(themeColor)
      setClubEditThemeColorDraft(themeColor)
      setClubEditDefaultLanguage(isLanguageCode(selectedClub.default_language || '') ? selectedClub.default_language as LanguageCode : language)
      setClubEditRankingCriterion(clubRankingCriterion(selectedClub))
      setClubBannerFile(null)
      setClubBannerPreview('')
    })
  }, [language, selectedClub, setClubBannerFile, setClubBannerPreview, setClubEditDefaultLanguage, setClubEditDescription, setClubEditMotto, setClubEditName, setClubEditRankingCriterion, setClubEditThemeColor, setClubEditThemeColorDraft, setClubEditVisibility])

  useEffect(() => {
    if (!selectedClub || selectedClubTab !== 'messages') return
    return schedulePostEffectStateUpdate(() => {
      void loadClubMessagesRef.current(selectedClub)
    })
  }, [selectedClub, selectedClubTab])

  const checkInSession = useMemo(() => {
    if (!checkInTarget) return undefined
    return sessions.find((session) => session.id === checkInTarget.sessionId)
  }, [checkInTarget, sessions])

  const checkInParticipant = useMemo(() => {
    if (!checkInTarget || !checkInSession) return undefined
    return (checkInSession.session_participants ?? []).find((participant) => participant.id === checkInTarget.participantId)
  }, [checkInSession, checkInTarget])
  const normalizedCheckInPaymentSplits = useMemo(() => normalizeParticipantPaymentSplits(checkInPaymentSplits), [checkInPaymentSplits])
  const checkInPaymentTotal = useMemo(() => participantPaymentSplitTotal(normalizedCheckInPaymentSplits), [normalizedCheckInPaymentSplits])

  const allPlayerStats = useMemo(() => {
    const stats = new Map<string, {
      profileId: string
      displayName: string
      avatarUrl: string | null
      avatarEmoji: string | null
      avatarInitials: string | null
      avatarColor: string | null
      avatarTextColor: string | null
      profileMotto: string | null
      sessionsJoined: number
      gamesJoined: number
      wins: number
      bestPerformerCount: number
      baseTotalScore: number
      totalScore: number
      scoreAdjustment: number
      loyaltyPoints?: number
      totalAccuracy: number
      accuracyCount: number
      totalProjectiles: number
      totalProjectilesOverride: number | null
      bestEscapeDurationSeconds: number | null
      averageAccuracyOverride: number | null
      bestEscapeDurationSecondsOverride: number | null
      bestByGame: Map<string, number>
    }>()

    allProfiles.forEach((playerProfile) => {
      const playerAvatar = avatarFields(playerProfile)
      const averageAccuracyOverride = Number(playerProfile.average_accuracy_override)
      const bestEscapeDurationSecondsOverride = Number(playerProfile.best_escape_duration_seconds_override)
      const totalProjectilesOverride = Number(playerProfile.total_projectiles_override)
      stats.set(playerProfile.id, {
        profileId: playerProfile.id,
        displayName: compactDisplayName(displayName(playerProfile), text.player),
        avatarUrl: playerAvatar.avatar_url,
        avatarEmoji: playerAvatar.avatar_emoji,
        avatarInitials: playerAvatar.avatar_initials,
        avatarColor: playerAvatar.avatar_color,
        avatarTextColor: playerAvatar.avatar_text_color,
        profileMotto: playerProfile.profile_motto || null,
        sessionsJoined: 0,
        gamesJoined: 0,
        wins: 0,
        bestPerformerCount: 0,
        baseTotalScore: 0,
        totalScore: 0,
        scoreAdjustment: 0,
        loyaltyPoints: Math.max(0, Math.floor(Number(playerProfile.loyalty_points_total ?? 0) || 0)),
        totalAccuracy: 0,
        accuracyCount: 0,
        totalProjectiles: 0,
        totalProjectilesOverride: Number.isFinite(totalProjectilesOverride) && totalProjectilesOverride >= 0 ? totalProjectilesOverride : null,
        bestEscapeDurationSeconds: null,
        averageAccuracyOverride: Number.isFinite(averageAccuracyOverride) ? averageAccuracyOverride : null,
        bestEscapeDurationSecondsOverride: Number.isFinite(bestEscapeDurationSecondsOverride) && bestEscapeDurationSecondsOverride > 0 ? bestEscapeDurationSecondsOverride : null,
        bestByGame: new Map<string, number>(),
      })
    })

    sessions.forEach((session) => {
      const bestPerformer = sessionBestPerformer(session)

        ; (session.session_participants ?? []).forEach((participant) => {
          const current = stats.get(participant.profile_id) ?? {
            profileId: participant.profile_id,
            displayName: compactDisplayName(participant.display_name, text.player),
            avatarUrl: participant.avatar_url,
            avatarEmoji: participant.avatar_emoji || null,
            avatarInitials: participant.avatar_initials || null,
            avatarColor: participant.avatar_color || null,
            avatarTextColor: participant.avatar_text_color || null,
            profileMotto: participant.profile_motto || null,
            sessionsJoined: 0,
            gamesJoined: 0,
            wins: 0,
            bestPerformerCount: 0,
            baseTotalScore: 0,
            totalScore: 0,
            scoreAdjustment: 0,
            loyaltyPoints: 0,
            totalAccuracy: 0,
            accuracyCount: 0,
            totalProjectiles: 0,
            totalProjectilesOverride: null,
            bestEscapeDurationSeconds: null,
            averageAccuracyOverride: null,
            bestEscapeDurationSecondsOverride: null,
            bestByGame: new Map<string, number>(),
          }

          current.displayName = compactDisplayName(participant.display_name, current.displayName)
          current.avatarUrl = participant.avatar_url || current.avatarUrl
          current.avatarEmoji = participant.avatar_emoji || current.avatarEmoji
          current.avatarInitials = participant.avatar_initials || current.avatarInitials
          current.avatarColor = participant.avatar_color || current.avatarColor
          current.avatarTextColor = participant.avatar_text_color || current.avatarTextColor
          current.profileMotto = participant.profile_motto || current.profileMotto
          current.sessionsJoined += 1
          if (participant.checked_in) current.gamesJoined += 1
          if (participant.placement === 1) current.wins += 1

          const numericScore = participantScore(participant)
          if (numericScore !== null) {
            current.baseTotalScore += numericScore
            if (bestPerformer?.participant.id === participant.id) current.bestPerformerCount += 1

            session.game_options.forEach((gameId) => {
              const game = games.find((item) => item.id === gameId)
              const previous = current.bestByGame.get(gameId)
              const isEscape = game?.category === 'Escape'

              if (previous === undefined || (isEscape ? numericScore < previous : numericScore > previous)) {
                current.bestByGame.set(gameId, numericScore)
              }
            })
          }

          const accuracy = Number(participant.accuracy_percent)
          if (Number.isFinite(accuracy)) {
            current.totalAccuracy += accuracy
            current.accuracyCount += 1
          }

          const projectiles = Number(participant.projectiles_fired)
          if (Number.isFinite(projectiles)) {
            current.totalProjectiles += projectiles
          }

          const escapeDuration = Number(participant.escape_duration_seconds)
          if (isEscapeSession(session) && Number.isFinite(escapeDuration) && escapeDuration > 0) {
            current.bestEscapeDurationSeconds = current.bestEscapeDurationSeconds === null
              ? escapeDuration
              : Math.min(current.bestEscapeDurationSeconds, escapeDuration)
          }

          stats.set(participant.profile_id, current)
        })
    })

    return Array.from(stats.values())
      .map((item) => ({
        ...item,
        scoreAdjustment: profileScoreAdjustments[item.profileId] ?? 0,
        totalScore: item.baseTotalScore + (profileScoreAdjustments[item.profileId] ?? 0),
        averageAccuracy: item.averageAccuracyOverride ?? (item.accuracyCount > 0 ? item.totalAccuracy / item.accuracyCount : null),
        reliabilityScore: percentValue(item.gamesJoined, item.sessionsJoined),
        totalProjectiles: item.totalProjectilesOverride ?? item.totalProjectiles,
        bestEscapeDurationSeconds: item.bestEscapeDurationSecondsOverride ?? item.bestEscapeDurationSeconds,
        bestByGame: Array.from(item.bestByGame.entries()).map(([gameId, score]) => ({
          game: games.find((game) => game.id === gameId)?.title || gameId,
          score,
        })),
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
  }, [allProfiles, profileScoreAdjustments, sessions, text.player])

  const leaderboardPlayerStats = leaderboardView.loaded ? leaderboardPlayers : allPlayerStats
  const currentProfileAvatar = profile ? avatarFields(profile) : null

  const hydratedCurrentUserShareStats = currentUserShareStats?.profileId === userId ? currentUserShareStats : null
  const currentLeaderboardPlayer = currentUserLeaderboardPlayer(leaderboardPlayerStats, currentUserRankPlayer, userId)
  const playerStats = hydratedCurrentUserShareStats ?? currentLeaderboardPlayer ?? {
    profileId: userId,
    displayName: displayName(profile),
    avatarUrl: currentProfileAvatar?.avatar_url || null,
    avatarEmoji: currentProfileAvatar?.avatar_emoji || null,
    avatarInitials: currentProfileAvatar?.avatar_initials || null,
    avatarColor: currentProfileAvatar?.avatar_color || null,
    avatarTextColor: currentProfileAvatar?.avatar_text_color || null,
    profileMotto: profile?.profile_motto || null,
    sessionsJoined: 0,
    gamesJoined: 0,
    wins: 0,
    bestPerformerCount: 0,
    baseTotalScore: 0,
    totalScore: profileScoreAdjustments[userId] ?? 0,
    scoreAdjustment: profileScoreAdjustments[userId] ?? 0,
    loyaltyPoints: Math.max(0, Math.floor(Number(profile?.loyalty_points_total ?? 0) || 0)),
    totalAccuracy: 0,
    accuracyCount: 0,
    totalProjectiles: 0,
    averageAccuracy: null,
    reliabilityScore: 0,
    bestEscapeDurationSeconds: null,
    bestByGame: [],
  }
  const canShareCurrentUserStats = Boolean(profile && userId)
  const currentUserStatsShared = sharedKey === 'stats'

  const staffAccessRank = profile
    ? Math.max(staffConsoleRank(profile.role, profile.email), staffConsoleRank(profile.role, authEmail))
    : 0
  const hasVerifiedTotpFactor = mfaFactors.some((factor) => factor.status === 'verified')
  const staffAccountEmail = authEmail || profile?.email || ''
  const staffMfaEnrollmentRequired = Boolean(
    profile
    && staffAccessRank >= 20
    && !requiresStaffKioskPin(staffAccountEmail)
    && !hasVerifiedTotpFactor
  )
  const sharedKioskAccount = requiresStaffKioskPin(staffAccountEmail)
  const handleKioskLockChange = useCallback((lock: (() => void) | null) => {
    setKioskLock(() => lock)
  }, [setKioskLock])
  const canAccessStaffConsole = Boolean(profile && (
    sharedKioskAccount
      ? canStaffKioskOperatorAccessStaff(kioskOperator?.accessRole)
      : canEnterStaffConsole({
        authEmail: staffAccountEmail,
        hasVerifiedMfaFactor: hasVerifiedTotpFactor,
        mfaAssuranceLevel,
        profileRank: staffAccessRank,
      })
  ))
  const canAccessHrConsole = Boolean(profile && canAccessStaffConsole && (
    sharedKioskAccount
      ? canStaffKioskOperatorAccessHr(kioskOperator?.accessRole)
      : canAccessHrConsoleForActor({
        authEmail: staffAccountEmail,
        role: profile.role,
        roleRank: staffAccessRank,
      })
  ))
  const canManageCalendarBookings = canAccessStaffConsole && (sharedKioskAccount ? ['staff', 'manager'].includes(kioskOperator?.accessRole || '') : staffAccessRank >= 50)
  useEffect(() => {
    if (activeView === 'create' && createSessionMode === 'calendar' && !isProfileAuthLoading) void loadCalendarWeek()
    // Reload the shared calendar after route hydration or a change in staff access.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, createSessionMode, isProfileAuthLoading, canManageCalendarBookings])
  const canStaffExpandTicketSessions = false
  const selectedClubHallId = selectedClub?.id ?? ''
  const selectedClubHallRankingCriterion = selectedClub?.ranking_criterion ?? null

  useEffect(() => {
    if (!staffMfaEnrollmentRequired || activeView === 'profile') return
    return schedulePostEffectStateUpdate(() => setActiveView('profile'))
  }, [activeView, staffMfaEnrollmentRequired])

  useEffect(() => {
    if (!selectedClubHallId || selectedClubTab !== 'hall') return

    const nextQuery = {
      ...initialLeaderboardQuery(),
      clubId: selectedClubHallId,
      criterion: selectedClubHallRankingCriterion === 'projectiles'
        ? 'hits'
        : isLeaderboardCriterion(selectedClubHallRankingCriterion)
          ? selectedClubHallRankingCriterion
          : 'totalScore',
    }
    setLeaderboardQuery(nextQuery)
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPlayersRef.current(nextQuery, 0, 'replace', userId)
  }, [setLeaderboardQuery, leaderboardLoadedCountRef, leaderboardQueryRef, selectedClubHallId, selectedClubHallRankingCriterion, selectedClubTab, userId])

  const topPlayer = leaderboardPlayerStats[0]
  const crownedTopPlayer = topPlayer && topPlayer.totalScore > 0 ? topPlayer : undefined
  const crownedTopPlayerId = crownedTopPlayer?.profileId ?? ''
  const crownedTopPlayerScore = crownedTopPlayer?.totalScore ?? 0
  const selectedPlayerStatsFromLoadedData = leaderboardPlayerStats.find((item) => item.profileId === selectedPlayerId)
    ?? (currentUserRankPlayer?.profileId === selectedPlayerId ? currentUserRankPlayer : undefined)
  const selectedPlayerStats = selectedPlayerStatsFromLoadedData
    ?? (selectedPlayerStatsOverride?.profileId === selectedPlayerId ? selectedPlayerStatsOverride : undefined)
  useEffect(() => {
    if (!selectedPlayerId || selectedPlayerStatsFromLoadedData || selectedPlayerStatsFetchedRef.current.has(selectedPlayerId)) return
    void loadSelectedPlayerStats(selectedPlayerId)
  }, [loadSelectedPlayerStats, selectedPlayerId, selectedPlayerStatsFetchedRef, selectedPlayerStatsFromLoadedData])

  useEffect(() => {
    if (!selectedPlayerId || selectedPlayerGameStatsFetchedRef.current.has(selectedPlayerId)) return
    void loadSelectedPlayerGameStats(selectedPlayerId)
  }, [loadSelectedPlayerGameStats, selectedPlayerGameStatsFetchedRef, selectedPlayerId])

  const selectedPlayerSessionContext = useMemo(() => {
    if (!selectedPlayerId || !selectedPlayerSessionId) return null

    const session = sessions.find((item) => item.id === selectedPlayerSessionId)
    const participant = session?.session_participants?.find((item) => item.profile_id === selectedPlayerId)
    if (!session || !participant) return null

    return {
      session,
      participant,
      score: participantScore(participant),
      isBestPerformer: isBestSessionPerformer(session, participant),
    }
  }, [selectedPlayerId, selectedPlayerSessionId, sessions])

  const selectedPlayerProfileRecord = useMemo(() => {
    if (!selectedPlayerId) return null
    if (profile?.id === selectedPlayerId) return profile
    return allProfiles.find((item) => item.id === selectedPlayerId) ?? null
  }, [allProfiles, profile, selectedPlayerId])
  const selectedPlayerAverageAccuracyOverride = selectedPlayerProfileRecord?.average_accuracy_override === null || selectedPlayerProfileRecord?.average_accuracy_override === undefined
    ? null
    : finiteNumber(selectedPlayerProfileRecord.average_accuracy_override, Number.NaN)
  const selectedPlayerBestEscapeOverride = selectedPlayerProfileRecord?.best_escape_duration_seconds_override === null || selectedPlayerProfileRecord?.best_escape_duration_seconds_override === undefined
    ? null
    : finiteNumber(selectedPlayerProfileRecord.best_escape_duration_seconds_override, Number.NaN)
  const selectedPlayerTotalProjectilesOverride = selectedPlayerProfileRecord?.total_projectiles_override === null || selectedPlayerProfileRecord?.total_projectiles_override === undefined
    ? null
    : finiteNumber(selectedPlayerProfileRecord.total_projectiles_override, Number.NaN)
  const selectedPlayerAverageAccuracyValue = selectedPlayerAverageAccuracyOverride !== null && Number.isFinite(selectedPlayerAverageAccuracyOverride)
    ? selectedPlayerAverageAccuracyOverride
    : null
  const selectedPlayerBestEscapeValue = selectedPlayerBestEscapeOverride !== null && Number.isFinite(selectedPlayerBestEscapeOverride) && selectedPlayerBestEscapeOverride > 0
    ? selectedPlayerBestEscapeOverride
    : null
  const selectedPlayerTotalProjectilesValue = selectedPlayerTotalProjectilesOverride !== null && Number.isFinite(selectedPlayerTotalProjectilesOverride) && selectedPlayerTotalProjectilesOverride >= 0
    ? selectedPlayerTotalProjectilesOverride
    : null
  const selectedPlayerProfile = useMemo(() => {
    if (!selectedPlayerId) return undefined

    let visibleAvatar: string | null = null
    let visibleEmoji: string | null = null
    let visibleInitials: string | null = null
    let visibleColor: string | null = null
    let visibleTextColor: string | null = null
    let visibleMotto: string | null = null
    let visibleName = ''

    if (selectedPlayerProfileRecord) {
      const profileAvatar = avatarFields(selectedPlayerProfileRecord)
      visibleAvatar = profileAvatar.avatar_url || visibleAvatar
      visibleEmoji = profileAvatar.avatar_emoji || visibleEmoji
      visibleInitials = profileAvatar.avatar_initials || visibleInitials
      visibleColor = profileAvatar.avatar_color || visibleColor
      visibleTextColor = profileAvatar.avatar_text_color || visibleTextColor
      visibleMotto = selectedPlayerProfileRecord.profile_motto || visibleMotto
      visibleName = displayName(selectedPlayerProfileRecord) || visibleName
    }

    if (selectedPlayerId === userId && profile) {
      const profileAvatar = avatarFields(profile)
      visibleAvatar = profileAvatar.avatar_url || visibleAvatar
      visibleEmoji = profileAvatar.avatar_emoji || visibleEmoji
      visibleInitials = profileAvatar.avatar_initials || visibleInitials
      visibleColor = profileAvatar.avatar_color || visibleColor
      visibleTextColor = profileAvatar.avatar_text_color || visibleTextColor
      visibleMotto = profile.profile_motto || visibleMotto
      visibleName = displayName(profile) || visibleName
    }

    for (const session of sessions) {
      const participant = (session.session_participants ?? []).find((item) => item.profile_id === selectedPlayerId)
      if (participant) {
        visibleAvatar = participant.avatar_url || visibleAvatar
        visibleEmoji = participant.avatar_emoji || visibleEmoji
        visibleInitials = participant.avatar_initials || visibleInitials
        visibleColor = participant.avatar_color || visibleColor
        visibleTextColor = participant.avatar_text_color || visibleTextColor
        visibleMotto = participant.profile_motto || visibleMotto
        visibleName = compactDisplayName(participant.display_name, visibleName || text.player)
      }
    }

    for (const club of clubs) {
      const member = clubMembers(club).find((item) => item.profile_id === selectedPlayerId)
      if (member) {
        visibleAvatar = member.avatar_url || visibleAvatar
        visibleEmoji = member.avatar_emoji || visibleEmoji
        visibleInitials = member.avatar_initials || visibleInitials
        visibleColor = member.avatar_color || visibleColor
        visibleTextColor = member.avatar_text_color || visibleTextColor
        visibleMotto = member.profile_motto || visibleMotto
        visibleName = compactDisplayName(member.display_name, visibleName || text.player)
      }
    }

    if (selectedPlayerStats) {
      if (selectedPlayerId === userId && profile) {
        const profileAvatar = avatarFields(profile)
        return {
          ...selectedPlayerStats,
          displayName: compactDisplayName(displayName(profile) || selectedPlayerStats.displayName || visibleName, text.player),
          avatarUrl: profileAvatar.avatar_url,
          avatarEmoji: profileAvatar.avatar_emoji,
          avatarInitials: profileAvatar.avatar_initials,
          avatarColor: profileAvatar.avatar_color,
          avatarTextColor: profileAvatar.avatar_text_color,
          profileMotto: profile.profile_motto || null,
          loyaltyPoints: Math.max(0, Math.floor(Number(profile.loyalty_points_total ?? 0) || 0)),
          averageAccuracy: selectedPlayerAverageAccuracyValue ?? selectedPlayerStats.averageAccuracy,
          bestEscapeDurationSeconds: selectedPlayerBestEscapeValue ?? selectedPlayerStats.bestEscapeDurationSeconds,
          totalProjectiles: selectedPlayerTotalProjectilesValue ?? selectedPlayerStats.totalProjectiles,
        }
      }

      return {
        ...selectedPlayerStats,
        displayName: compactDisplayName(selectedPlayerStats.displayName || visibleName, text.player),
        avatarUrl: selectedPlayerStats.avatarUrl || visibleAvatar,
        avatarEmoji: selectedPlayerStats.avatarEmoji || visibleEmoji,
        avatarInitials: selectedPlayerStats.avatarInitials || visibleInitials,
        avatarColor: selectedPlayerStats.avatarColor || visibleColor,
        avatarTextColor: selectedPlayerStats.avatarTextColor || visibleTextColor,
        profileMotto: selectedPlayerStats.profileMotto || visibleMotto,
        loyaltyPoints: selectedPlayerProfileRecord
          ? Math.max(0, Math.floor(Number(selectedPlayerProfileRecord.loyalty_points_total ?? selectedPlayerStats.loyaltyPoints ?? 0) || 0))
          : selectedPlayerStats.loyaltyPoints,
        averageAccuracy: selectedPlayerAverageAccuracyValue ?? selectedPlayerStats.averageAccuracy,
        bestEscapeDurationSeconds: selectedPlayerBestEscapeValue ?? selectedPlayerStats.bestEscapeDurationSeconds,
        totalProjectiles: selectedPlayerTotalProjectilesValue ?? selectedPlayerStats.totalProjectiles,
      }
    }

    if (selectedPlayerId === userId && profile) {
      const profileAvatar = avatarFields(profile)
      return {
        profileId: profile.id,
        displayName: compactDisplayName(displayName(profile), text.player),
        avatarUrl: profileAvatar.avatar_url,
        avatarEmoji: profileAvatar.avatar_emoji,
        avatarInitials: profileAvatar.avatar_initials,
        avatarColor: profileAvatar.avatar_color,
        avatarTextColor: profileAvatar.avatar_text_color,
        profileMotto: profile.profile_motto || null,
        sessionsJoined: 0,
        gamesJoined: 0,
        wins: 0,
        bestPerformerCount: 0,
        baseTotalScore: 0,
        totalScore: profileScoreAdjustments[profile.id] ?? 0,
        scoreAdjustment: profileScoreAdjustments[profile.id] ?? 0,
        loyaltyPoints: Math.max(0, Math.floor(Number(profile.loyalty_points_total ?? 0) || 0)),
        totalAccuracy: 0,
        accuracyCount: 0,
        totalProjectiles: 0,
        averageAccuracy: selectedPlayerAverageAccuracyValue,
        reliabilityScore: 0,
        bestEscapeDurationSeconds: selectedPlayerBestEscapeValue,
        bestByGame: [],
      }
    }

    for (const session of sessions) {
      const participant = (session.session_participants ?? []).find((item) => item.profile_id === selectedPlayerId)
      if (participant) {
        return {
          profileId: participant.profile_id,
          displayName: compactDisplayName(participant.display_name, text.player),
          avatarUrl: participant.avatar_url,
          avatarEmoji: participant.avatar_emoji || null,
          avatarInitials: participant.avatar_initials || null,
          avatarColor: participant.avatar_color || null,
          avatarTextColor: participant.avatar_text_color || null,
          profileMotto: participant.profile_motto || null,
          sessionsJoined: 0,
          gamesJoined: 0,
          wins: 0,
          bestPerformerCount: 0,
          baseTotalScore: 0,
          totalScore: profileScoreAdjustments[participant.profile_id] ?? 0,
          scoreAdjustment: profileScoreAdjustments[participant.profile_id] ?? 0,
          loyaltyPoints: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: selectedPlayerTotalProjectilesValue ?? 0,
          averageAccuracy: selectedPlayerAverageAccuracyValue,
          reliabilityScore: 0,
          bestEscapeDurationSeconds: selectedPlayerBestEscapeValue,
          bestByGame: [],
        }
      }
    }

    for (const club of clubs) {
      const member = clubMembers(club).find((item) => item.profile_id === selectedPlayerId)
      if (member) {
        return {
          profileId: member.profile_id,
          displayName: compactDisplayName(member.display_name, text.player),
          avatarUrl: member.avatar_url,
          avatarEmoji: member.avatar_emoji || null,
          avatarInitials: member.avatar_initials || null,
          avatarColor: member.avatar_color || null,
          avatarTextColor: member.avatar_text_color || null,
          profileMotto: member.profile_motto || null,
          sessionsJoined: 0,
          gamesJoined: 0,
          wins: 0,
          bestPerformerCount: 0,
          baseTotalScore: 0,
          totalScore: profileScoreAdjustments[member.profile_id] ?? 0,
          scoreAdjustment: profileScoreAdjustments[member.profile_id] ?? 0,
          loyaltyPoints: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: selectedPlayerTotalProjectilesValue ?? 0,
          averageAccuracy: selectedPlayerAverageAccuracyValue,
          reliabilityScore: 0,
          bestEscapeDurationSeconds: selectedPlayerBestEscapeValue,
          bestByGame: [],
        }
      }
    }

    return undefined
  }, [clubs, profile, profileScoreAdjustments, selectedPlayerAverageAccuracyValue, selectedPlayerBestEscapeValue, selectedPlayerId, selectedPlayerProfileRecord, selectedPlayerStats, selectedPlayerTotalProjectilesValue, sessions, text.player, userId])

  const selectedPlayerGameCards = useMemo(() => {
    if (!selectedPlayerProfile) return []

    const overallBestScores = new Map(
      selectedPlayerProfile.bestByGame.map((item) => [item.game, item.score])
    )

    return games.map((game) => {
      const perGame = selectedPlayerGameStats[game.id]
      const perGameBestScore = perGame?.bestByGame.find((item) => item.game === game.title)?.score
      const bestScore = perGameBestScore ?? overallBestScores.get(game.title)

      const stats = [
        { key: 'sessions', label: text.sessions, value: perGame ? Math.floor(perGame.sessionsJoined) : '-' },
        { key: 'games', label: text.gamesPlayedCriterion, value: perGame ? Math.floor(perGame.gamesJoined) : '-' },
        { key: 'wins', label: text.winsCriterion, value: perGame ? Math.floor(perGame.wins) : '-' },
        { key: 'best-performer', label: bestPerformerCountText, value: perGame ? Math.floor(perGame.bestPerformerCount) : '-' },
        { key: 'total-score', label: text.totalScoreCriterion, value: perGame ? Math.round(perGame.baseTotalScore) : '-' },
        { key: 'best-score', label: text.bestScores, value: bestScore === undefined ? '-' : Math.round(bestScore) },
        { key: 'accuracy', label: text.accuracy, value: perGame ? formatCompactNumber(perGame.averageAccuracy, '%') : '-' },
        { key: 'hits', label: text.projectiles, value: perGame ? formatCompactCount(perGame.totalProjectiles) : '-' },
        { key: 'movement', label: text.movement, value: perGame ? formatCompactNumber(perGame.totalMovementMeters, ' m') : '-' },
      ]

      if (game.category === 'Escape') {
        stats.push({
          key: 'escape-time',
          label: escapeBestTimeText,
          value: perGame ? formatSpeedrunDuration(perGame.bestEscapeDurationSeconds) : '-',
        })
      }

      return {
        id: game.id,
        image: game.image,
        title: game.title,
        stats,
      }
    })
  }, [bestPerformerCountText, escapeBestTimeText, selectedPlayerGameStats, selectedPlayerProfile, text])

  const selectedSessionParticipant = selectedPlayerSessionContext?.participant ?? null
  const selectedPlayerMetricParticipant = selectedSessionParticipant
  const selectedPlayerMetricSession = selectedPlayerSessionContext?.session ?? null
  const selectedPlayerSessionIsEscape = isEscapeSession(selectedPlayerMetricSession)
  const selectedPlayerEscapeGameId = selectedPlayerMetricSession?.confirmed_game_id
    || selectedPlayerMetricSession?.game_options?.find((gameId) => games.find((game) => game.id === gameId)?.category === 'Escape')
    || null
  const selectedPlayerEscapeChapterCount = selectedPlayerEscapeGameId
    ? Math.max(1, Math.min(50, Math.floor(Number(staffGameGuides[selectedPlayerEscapeGameId]?.escape_chapter_count ?? 1) || 1)))
    : 1
  const selectedPlayerEscapeDurationSeconds = selectedPlayerMetricParticipant?.escape_duration_seconds ?? null
  const selectedPlayerChapterTimes = useMemo(() => {
    const gameSlug = selectedPlayerEscapeGameId || ''
    return (selectedPlayerMetricParticipant?.chapter_times ?? [])
      .filter((item) => !gameSlug || item.game_slug === gameSlug)
      .reduce<Record<number, number>>((times, item) => {
        const chapter = Number(item.chapter_number)
        const duration = Number(item.duration_seconds)
        if (Number.isFinite(chapter) && Number.isFinite(duration) && duration > 0) {
          times[chapter] = duration
        }
        return times
      }, {})
  }, [selectedPlayerEscapeGameId, selectedPlayerMetricParticipant])

  useEffect(() => {
    if (selectedPlayerSessionIsEscape) void ensureStaffGameGuidesLoaded()
  }, [ensureStaffGameGuidesLoaded, selectedPlayerSessionIsEscape])

  function openChallengeForm(player: ChallengeTarget) {
    if (!profile) {
      closePlayerProfile()
      promptLogin()
      return
    }
    if (player.profileId === userId) {
      setChallengeStatus(text.challengeSelfBlocked)
      return
    }

    const contextSession = selectedPlayerSessionContext?.session
    const contextDate = contextSession && !isPastSession(contextSession) ? contextSession.date : localDateString()
    const contextDuration = contextSession ? Math.min(120, Math.max(20, Math.ceil(contextSession.duration_minutes / 20) * 20)) : 20
    const contextGame = contextSession?.confirmed_game_id || contextSession?.game_options?.[0] || 'laser-tag'

    setChallengeTargetId(player.profileId)
    setChallengeGameId(contextGame)
    setChallengeDate(contextDate)
    setChallengeTime('')
    setChallengeDuration(contextDuration)
    setChallengeStatus('')
    void ensureUpcomingSessionsThroughDate(contextDate)
  }

  async function createFriendChallenge(player: ChallengeTarget) {
    if (!profile) {
      closePlayerProfile()
      promptLogin()
      return
    }
    if (player.profileId === userId) {
      setChallengeStatus(text.challengeSelfBlocked)
      return
    }

    if (!challengeDate || !challengeTime || !challengeGameId) {
      setChallengeStatus(text.challengeRequired)
      return
    }

    setIsCreatingChallenge(true)
    setChallengeStatus(text.challengeCreating)

    const { data, error } = await (await getSupabase()).rpc('create_friend_challenge', {
      p_target_profile_id: player.profileId,
      p_date: challengeDate,
      p_start_time: `${challengeTime}:00`,
      p_duration_minutes: challengeDuration,
      p_game_id: challengeGameId,
    })

    if (error) {
      setChallengeStatus(error.message)
      setIsCreatingChallenge(false)
      return
    }

    const sessionId = typeof data === 'object' && data && 'session_id' in data
      ? String((data as { session_id?: unknown }).session_id || '')
      : ''

    await loadSessions({ focusDate: challengeDate })
    await loadNetworkData()
    refreshLeaderboardIfLoaded()
    setIsCreatingChallenge(false)
    setChallengeTargetId('')
    setChallengeTime('')
    setChallengeStatus(text.challengeCreated)
    if (sessionId) {
      setExpandedSessions((current) => ({ ...current, [sessionId]: true }))
      void loadSessionDetail(sessionId)
      setSessionTimeScope('upcoming')
      setActiveView('sessions')
      window.setTimeout(() => {
        document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
    }
  }

  function renderCompactStatValue(value: string | number) {
    return <span className="score-value compact-stat-value">{value}</span>
  }

  function formatCompactNumber(value: number | null | undefined, suffix = '') {
    return value === null || value === undefined ? '-' : `${Math.round(value)}${suffix}`
  }

  function formatCompactCount(value: number | null | undefined) {
    return value === null || value === undefined ? '-' : Math.floor(value)
  }

  function formatClubActivityDate(value: string | null | undefined) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return `${formatShortDate(localDateString(date), language)} · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  function renderEscapeChapterTimes() {
    if (!selectedPlayerSessionIsEscape || !selectedPlayerMetricParticipant || !selectedPlayerEscapeGameId) return null

    const chapters = Array.from({ length: selectedPlayerEscapeChapterCount }, (_, index) => index + 1)

    return (
      <div className="escape-chapter-times">
        <span className="stat-label">{text.escapeChapterTimes}</span>
        <div className="escape-chapter-time-grid">
          {chapters.map((chapterNumber) => {
            const value = selectedPlayerChapterTimes[chapterNumber] ?? null
            const label = `${text.escapeChapterLabel} ${chapterNumber}`

            return (
              <div className="escape-chapter-time-row" key={chapterNumber}>
                <span>{label}</span>
                {renderCompactStatValue(formatSpeedrunDuration(value))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderTariffTrigger(extraClassName = '') {
    return (
      <button className={`session-tariff-link ${extraClassName}`.trim()} type="button" onClick={() => setTariffPaymentOpen(true)}>
        {text.sessionTariffTitle}
      </button>
    )
  }

  function openGameGuide(gameId?: GameId | null) {
    setGameGuideGameId(gameId || null)
    setGameGuideOpen(true)
    void ensureStaffGameGuidesLoaded()
  }

  function renderGameGuideTrigger(gameId?: GameId | null, extraClassName = '') {
    return (
      <button
        className={`game-guide-link ${extraClassName}`.trim()}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          openGameGuide(gameId)
        }}
      >
        {gameId ? text.gameGuideForGame : text.gameGuideOpen}
      </button>
    )
  }

  const playerProfileStats = selectedPlayerProfile ? [
    selectedPlayerSessionContext
      ? {
        key: 'score',
        className: 'score-stat-card',
        value: (
          <>
            <span className="stat-label">{sessionScoreText}</span>
            {renderCompactStatValue(formatCompactNumber(selectedPlayerSessionContext.score))}
            <span className="stat-subline">
              <span>{text.totalScore}</span>
              {renderCompactStatValue(selectedPlayerProfile.totalScore)}
            </span>
            {selectedPlayerSessionContext.isBestPerformer && <small className="best-performer-label compact-best-label">{bestPerformerText}</small>}
          </>
        ),
      }
      : {
        key: 'score',
        className: 'score-stat-card',
        value: (
          <>
            <span className="stat-label">{text.totalScore}</span>
            {renderCompactStatValue(selectedPlayerProfile.totalScore)}
          </>
        ),
      },
    {
      key: 'loyalty-points',
      className: 'editable-stat-card',
      value: (
        <>
          <span className="stat-label">{text.loyaltyPoints}</span>
          {renderCompactStatValue(selectedPlayerProfile.loyaltyPoints ?? 0)}
        </>
      ),
    },
    selectedPlayerSessionIsEscape && selectedPlayerMetricParticipant
      ? {
        key: 'escape-time',
        className: 'editable-stat-card split-stat-card',
        value: (
          <>
            <span className="stat-label">{escapeSessionTimeText}</span>
            {renderCompactStatValue(formatSpeedrunDuration(selectedPlayerEscapeDurationSeconds))}
            <span className="stat-subline">
              <span>{escapeBestTimeText}</span>
              {renderCompactStatValue(formatSpeedrunDuration(selectedPlayerProfile.bestEscapeDurationSeconds))}
            </span>
            {renderEscapeChapterTimes()}
          </>
        ),
      }
      : {
        key: 'escape-time',
        value: (
          <>
            <span className="stat-label">{escapeBestTimeText}</span>
            {renderCompactStatValue(formatSpeedrunDuration(selectedPlayerProfile.bestEscapeDurationSeconds))}
          </>
        ),
      },
    selectedPlayerMetricParticipant
      ? {
        key: 'accuracy',
        className: 'editable-stat-card split-stat-card',
        value: (
          <>
            <span className="stat-label">{text.accuracy}</span>
            {renderCompactStatValue(formatCompactNumber(selectedPlayerMetricParticipant.accuracy_percent, '%'))}
            <span className="stat-subline">
              <span>{averageAccuracyText}</span>
              {renderCompactStatValue(formatCompactNumber(selectedPlayerProfile.averageAccuracy, '%'))}
            </span>
          </>
        ),
      }
      : {
        key: 'accuracy',
        className: 'editable-stat-card',
        value: (
          <>
            <span className="stat-label">{text.accuracy}</span>
            {renderCompactStatValue(formatCompactNumber(selectedPlayerProfile.averageAccuracy, '%'))}
          </>
        ),
      },
    selectedPlayerMetricParticipant
      ? {
        key: 'projectiles',
        className: 'editable-stat-card split-stat-card',
        value: (
          <>
            <span className="stat-label">{text.projectiles}</span>
            {renderCompactStatValue(formatCompactCount(selectedPlayerMetricParticipant.projectiles_fired))}
            <span className="stat-subline">
              <span>{totalShotsText}</span>
              {renderCompactStatValue(formatCompactCount(selectedPlayerProfile.totalProjectiles))}
            </span>
          </>
        ),
      }
      : {
        key: 'projectiles',
        className: 'editable-stat-card',
        value: (
          <>
            <span className="stat-label">{text.projectiles}</span>
            {renderCompactStatValue(formatCompactCount(selectedPlayerProfile.totalProjectiles))}
          </>
        ),
      },
    { key: 'games', value: <>{selectedPlayerProfile.gamesJoined} {text.gamesCheckedIn}</> },
    { key: 'wins', value: <>{selectedPlayerProfile.wins} {text.wins}</> },
    { key: 'best-performer', value: <>{selectedPlayerProfile.bestPerformerCount} {bestPerformerCountText}</> },
  ] : []

  useEffect(() => {
    return schedulePostEffectStateUpdate(() => {
      if (!checkInParticipant) {
        setCheckInPaymentSplits([newParticipantPaymentSplit('cash')])
        return
      }

      setCheckInPaymentSplits(paymentSplitsFromParticipant(checkInParticipant))
    })
  }, [checkInParticipant])

  useEffect(() => {
    if (!userId || !canUseWebPush() || Notification.permission !== 'granted') {
      return schedulePostEffectStateUpdate(() => setIsPushSubscribed(false))
    }

    let active = true

    registerReminderServiceWorker()
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setIsPushSubscribed(Boolean(subscription))
      })
      .catch(() => {
        if (active) setIsPushSubscribed(false)
      })

    return () => {
      active = false
    }
  }, [setIsPushSubscribed, userId])

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return

    const now = Date.now()
    const timers: number[] = []

    joinedUpcomingSessions.forEach((session) => {
      const start = sessionStartDate(session).getTime()
        ;[
          { key: '24h', delay: start - 24 * 60 * 60 * 1000 - now, label: text.reminderTomorrow },
          { key: '2h', delay: start - 2 * 60 * 60 * 1000 - now, label: text.reminderSoon },
        ].forEach((reminder) => {
          const reminderKey = `${session.id}-${reminder.key}`
          if (notifiedReminderKeys.current.has(reminderKey)) return

          if (reminder.delay <= 0 && reminder.delay > -10 * 60 * 1000) {
            notifiedReminderKeys.current.add(reminderKey)
            notifySessionRef.current(session, reminder.label)
            return
          }

          if (reminder.delay > 0 && reminder.delay < 24 * 60 * 60 * 1000) {
            const timer = window.setTimeout(() => {
              notifiedReminderKeys.current.add(reminderKey)
              notifySessionRef.current(session, reminder.label)
            }, reminder.delay)
            timers.push(timer)
          }
        })
    })

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [joinedUpcomingSessions, language, text.reminderSoon, text.reminderTomorrow])

  useEffect(() => {
    if (typeof window === 'undefined' || !userId || pendingSessionInvites.length === 0) return

    const storageKey = `vrena-seen-session-invites-${userId}`
    let seenInviteIds: string[] = []

    try {
      const stored = window.localStorage.getItem(storageKey)
      seenInviteIds = stored ? JSON.parse(stored) : []
    } catch {
      seenInviteIds = []
    }

    const seen = new Set(seenInviteIds)
    const freshInvite = pendingSessionInvites.find((invite) => !seen.has(invite.id))
    if (!freshInvite) return

    const session = sessionForInvite(freshInvite)
    seen.add(freshInvite.id)
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(seen).slice(-80)))

    return schedulePostEffectStateUpdate(() => {
      setInvitePopupInviteId(freshInvite.id)

      if (session) {
        notifyInviteRef.current(session)
        downloadSessionCalendar(session)
      }
    })
  }, [pendingSessionInvites, sessionForInvite, userId])

  useEffect(() => {
    if (typeof window === 'undefined' || !profile || !userId || !profileBirthday || !isBirthdayToday(profileBirthday)) return

    const storageKey = `vrena-birthday-popup-${userId}-${localDateString()}`

    try {
      if (window.localStorage.getItem(storageKey)) return
      window.localStorage.setItem(storageKey, 'seen')
    } catch {
      // If localStorage is unavailable, still show the one-time in-memory popup for this mount.
    }

    return schedulePostEffectStateUpdate(() => setBirthdayPopupOpen(true))
  }, [profile, profileBirthday, userId])

  useEffect(() => {
    if (!profile || !crownedTopPlayerId || crownedTopPlayerId !== userId) {
      return schedulePostEffectStateUpdate(() => setChampionLoginOpen(false))
    }
    const storageKey = `vrena-crown-login:${userId}:${crownedTopPlayerScore}`
    const alreadyShown = window.sessionStorage.getItem(storageKey)
    if (alreadyShown === 'shown') return
    window.sessionStorage.setItem(storageKey, 'shown')
    return schedulePostEffectStateUpdate(() => setChampionLoginOpen(true))
  }, [crownedTopPlayerId, crownedTopPlayerScore, profile, userId])

  useEffect(() => {
    const query = tournamentEditorEmail.trim()
    if (query.length < 2) {
      return schedulePostEffectStateUpdate(() => setTournamentEditorResults([]))
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      const safe = query.replace(/[%_,]/g, '')
      const { data } = await (await getSupabase()).rpc('public_profile_search', {
        p_search: safe,
        p_limit: 6,
      })

      if (!cancelled) setTournamentEditorResults((data ?? []) as Profile[])
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [setTournamentEditorResults, tournamentEditorEmail])

  function canManageSession(session: Session) {
    return Boolean(
      userId
      && (
        session.owner_id === userId
        || isAdmin
        || tournamentData.editors.some((editor) => editor.session_id === session.id && editor.profile_id === userId)
      )
    )
  }

  function isSessionCreator(session: Session) {
    return Boolean(userId && (session.owner_id === userId || isAdmin))
  }

  function participantName(session: Session, participantId: string | null) {
    if (!participantId) return '-'
    const participant = (session.session_participants ?? []).find((item) => item.id === participantId)
    return compactDisplayName(participant?.display_name, text.player)
  }

  function participantById(session: Session, participantId: string | null) {
    if (!participantId) return null
    return (session.session_participants ?? []).find((item) => item.id === participantId) || null
  }

  function tournamentForSession(sessionId: string) {
    return {
      editors: tournamentData.editors.filter((editor) => editor.session_id === sessionId),
      pools: tournamentData.pools.filter((pool) => pool.session_id === sessionId).sort((a, b) => a.sort_order - b.sort_order),
      poolEntries: tournamentData.poolEntries.filter((entry) => entry.session_id === sessionId),
      matches: tournamentData.matches
        .filter((match) => match.session_id === sessionId)
        .sort((a, b) => a.round - b.round || a.match_number - b.match_number),
      auditLogs: tournamentData.auditLogs.filter((log) => log.session_id === sessionId),
    }
  }

  async function logTournamentAudit(sessionId: string, action: string, oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) {
    const { error } = await (await getSupabase()).rpc('log_tournament_audit', {
      p_session_id: sessionId,
      p_action: action,
      p_old_value: oldValue,
      p_new_value: newValue,
    })
    if (error) throw error
  }

  function canEditTournamentSession(session: Session) {
    return Boolean(userId && (session.owner_id === userId || isAdmin || tournamentData.editors.some((editor) => editor.session_id === session.id && editor.profile_id === userId)))
  }

  function isTournamentHelper(session: Session) {
    return Boolean(userId && !isSessionCreator(session) && tournamentData.editors.some((editor) => editor.session_id === session.id && editor.profile_id === userId))
  }

  function tournamentLocked(session: Session) {
    return session.status === 'completed' || Boolean(session.tournament_locked)
  }

  function tournamentRoleHint(session: Session, hasBracket: boolean) {
    if (tournamentLocked(session)) return text.tournamentLockedHint
    if (isSessionCreator(session)) return hasBracket ? text.tournamentHostHint : text.tournamentEmptyHost
    if (isTournamentHelper(session)) return hasBracket ? text.tournamentHelperHint : text.tournamentEmptyHelper
    if (!profile) return hasBracket ? text.tournamentGuestHint : text.tournamentEmptyGuest
    return hasBracket ? text.tournamentPlayerHint : text.tournamentEmptyPlayer
  }

  function poolStandingsForSession(session: Session, pool: TournamentPool) {
    const data = tournamentForSession(session.id)
    return calculatePoolStandings(session, pool, data.poolEntries, data.matches)
  }

  async function updateParticipantCheckIn(participantId: string, paymentSplits: ParticipantPaymentSplit[] | null, markFree = false) {
    const normalizedSplits = paymentSplits ?? []
    const normalizedAmount = participantPaymentSplitTotal(normalizedSplits)
    const summaryStatus = markFree
      ? 'free'
      : normalizedSplits.length > 0
        ? normalizedSplits[0].payment_method
        : null
    const { error } = await (await getSupabase())
      .from('session_participants')
      .update({
        checked_in: Boolean(summaryStatus),
        payment_status: summaryStatus,
        payment_amount: normalizedAmount > 0 ? normalizedAmount : null,
        payment_splits: markFree ? [] : normalizedSplits,
        checked_in_at: summaryStatus ? new Date().toISOString() : null,
      })
      .eq('id', participantId)

    if (error) {
      setCreateStatus(error.message === 'Failed to send a request to the Edge Function' ? text.messageFunctionFailed : error.message)
      return
    }

    setCheckInTarget(null)
    await loadSessions()
  }

  function updateCheckInPaymentSplit(splitId: string, patch: Partial<ParticipantPaymentSplitDraft>) {
    setCheckInPaymentSplits((splits) => splits.map((split) => (
      split.id === splitId ? { ...split, ...patch } : split
    )))
  }

  function addCheckInPaymentSplit() {
    setCheckInPaymentSplits((splits) => [...splits, newParticipantPaymentSplit('cash')])
  }

  function removeCheckInPaymentSplit(splitId: string) {
    setCheckInPaymentSplits((splits) => (
      splits.length > 1 ? splits.filter((split) => split.id !== splitId) : [newParticipantPaymentSplit('cash')]
    ))
  }

  function toggleGame(gameId: GameId) {
    setSelectedGames((current) => {
      if (current.includes(gameId)) {
        return current.length === 1 ? current : current.filter((id) => id !== gameId)
      }
      return [...current, gameId]
    })
  }

  function applyRichTextCommand(command: 'bold' | 'italic' | 'underline' | 'strikeThrough') {
    document.execCommand(command, false)
  }

  async function toggleFollowPlayer(player: {
    profileId: string
    displayName: string
    avatarUrl: string | null
    avatarEmoji: string | null
    avatarInitials: string | null
    avatarColor: string | null
    avatarTextColor: string | null
    profileMotto: string | null
  }) {
    if (!requireProfile()) return
    if (player.profileId === userId) return

    setBusyFriendId(player.profileId)

    if (isFollowing(player.profileId)) {
      const { error } = await (await getSupabase())
        .from('user_follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', player.profileId)

      if (error) setCreateStatus(error.message)
      else setCreateStatus(text.friendRemoved)
    } else {
      const { error } = await (await getSupabase()).from('user_follows').upsert({
        follower_id: userId,
        following_id: player.profileId,
        display_name: compactDisplayName(player.displayName, text.player),
        avatar_url: player.avatarUrl,
        avatar_emoji: player.avatarEmoji,
        avatar_initials: player.avatarInitials,
        avatar_color: player.avatarColor,
        avatar_text_color: player.avatarTextColor,
        profile_motto: player.profileMotto,
      }, { onConflict: 'follower_id,following_id' })

      if (error) setCreateStatus(error.message)
      else setCreateStatus(text.friendAdded)
    }

    await loadNetworkData()
    setBusyFriendId('')
  }

  async function invitePlayerToSession(session: Session, player: {
    profile_id: string
    display_name: string | null
    avatar_url: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    profile_motto?: string | null
  }) {
    if (!requireProfile()) return
    if (player.profile_id === userId) return

    const inviteKey = `${session.id}-${player.profile_id}`
    setBusyInviteKey(inviteKey)

    const snapshot = socialAvatarFields(player)
    const { error } = await (await getSupabase()).from('session_invites').upsert({
      session_id: session.id,
      inviter_id: userId,
      recipient_id: player.profile_id,
      recipient_display_name: snapshot.display_name,
      recipient_avatar_url: snapshot.avatar_url,
      recipient_avatar_emoji: snapshot.avatar_emoji,
      recipient_avatar_initials: snapshot.avatar_initials,
      recipient_avatar_color: snapshot.avatar_color,
      recipient_avatar_text_color: snapshot.avatar_text_color,
      recipient_profile_motto: snapshot.profile_motto,
      status: 'pending',
    }, { onConflict: 'session_id,recipient_id' })

    if (error) setCreateStatus(error.message)
    else setCreateStatus(text.inviteSent)

    await loadNetworkData()
    await loadSessionDetail(session.id, { force: true })
    setBusyInviteKey('')
  }

  function tournamentStageLabel(stage: TournamentMatch['stage']) {
    return stage.replace('_', ' ')
  }

  const {
    addTournamentEditor,
    setupTournamentPools,
    generateTournamentMatches,
    updateTournamentPoolEntry,
    updateTournamentMatch,
    advanceTournamentRound,
    finishTournament,
    createThirdPlaceMatch,
    claimPrize
  } = bindBookingTournamentActions(() => ({
    text,
    tournamentEditorEmail,
    tournamentPoolSize,
    isSessionCreator,
    tournamentLocked,
    canEditTournamentSession,
    tournamentForSession,
    poolStandingsForSession,
    editorDisplayName: (editorProfile) => compactDisplayName(displayName(editorProfile), text.player),
    avatarFields,
    softDeleteTournamentRecords,
    loadTournamentData: () => loadTournamentData(),
    loadSessions: () => loadSessions(),
    logTournamentAudit,
    setCreateStatus,
    setBusyTournamentId,
    setTournamentEditorEmail,
    setTournamentEditorResults
  }))

  async function shareCurrentUserStats(contextLabel = '') {
    let shareStats = playerStats
    if (profile && !hasShareablePlayerStats(shareStats)) {
      const hydratedStats = await hydrateCurrentUserShareStats(userId, true)
      if (hydratedStats) shareStats = hydratedStats
    }

    if (!profile || !hasShareablePlayerStats(shareStats)) {
      setProfileStatus(text.statsShareUnavailable)
      return
    }

    const playerName = compactDisplayName(shareStats.displayName || displayName(profile), text.player)
    const loadedRankIndex = leaderboardPlayerStats.findIndex((item) => item.profileId === userId)
    const playerLeaderboardRank = 'leaderboardRank' in shareStats ? shareStats.leaderboardRank : undefined
    const playerLeaderboardDistinctRank = 'leaderboardDistinctRank' in shareStats ? shareStats.leaderboardDistinctRank : null
    const currentUserRank = playerLeaderboardRank
      ?? (currentUserRankPlayer?.profileId === userId ? currentUserRankPlayer.leaderboardRank : undefined)
      ?? (loadedRankIndex >= 0 ? loadedRankIndex + 1 : undefined)
    const currentUserDistinctRank = playerLeaderboardDistinctRank
      ?? (currentUserRankPlayer?.profileId === userId ? currentUserRankPlayer.leaderboardDistinctRank : null)
    const shareLabels = {
      accuracy: text.accuracy,
      bestPerformerCount: bestPerformerCountText,
      bestScores: text.bestScores,
      currentRank: text.currentRank,
      gamesPlayed: text.gamesPlayedCriterion,
      projectiles: text.projectiles,
      rankFallback: text.rankJesterMessage,
      statsTitle: text.statsShareTitle,
      totalScore: text.totalScore,
      wins: text.wins,
    }
    const shareSummary = buildPlayerStatsShareSummary({
      appUrl: DEFAULT_APP_URL,
      contextLabel,
      currentRank: currentUserRank,
      displayName: playerName,
      labels: shareLabels,
      stats: {
        ...shareStats,
        leaderboardDistinctRank: currentUserDistinctRank,
        leaderboardRank: currentUserRank,
      },
    })

    try {
      const { sharePlayerStatsImage } = await import('../lib/playerStatsShareImage')
      const shareResult = await sharePlayerStatsImage({
        appUrl: DEFAULT_APP_URL,
        contextLabel,
        currentRank: currentUserRank,
        displayName: playerName,
        distinctRank: currentUserDistinctRank,
        fallbackPlayerLabel: text.player,
        labels: shareLabels,
        player: {
          ...shareStats,
          leaderboardDistinctRank: currentUserDistinctRank,
          leaderboardRank: currentUserRank,
        },
      })

      if (shareResult === 'ready') setProfileStatus(text.statsShareReady)
      if (shareResult !== 'cancelled') setSharedKey('stats')
    } catch {
      try {
        if (navigator.share) {
          await navigator.share({ title: shareSummary.title, text: shareSummary.summary, url: DEFAULT_APP_URL })
        } else {
          await navigator.clipboard?.writeText(shareSummary.summary)
        }
      } catch {
        // Sharing and clipboard permissions vary by browser; still show the user that the action finished.
      }
      setProfileStatus(text.statsShareReady)
      setSharedKey('stats')
    }
  }

  async function shareTournamentResults(session: Session) {
    const { shareTournamentResultsImage } = await import('../lib/tournamentResultsShare')
    await shareTournamentResultsImage({
      language,
      onSharedKey: setSharedKey,
      session,
      text,
    })
  }

  function voteCount(session: Session, gameId: GameId) {
    return Object.values(session.game_votes || {}).filter((vote) => vote === gameId).length
  }
  const isConsoleWorkspace = activeView === 'staff' || activeView === 'hr'
  const appAside = (
    <AppSidebar
      activeView={activeView}
      canAccessHrConsole={canAccessHrConsole}
      canAccessStaffConsole={canAccessStaffConsole}
      isChampion={crownedTopPlayer?.profileId === userId}
      language={language}
      navigationCollapsed={navigationCollapsed}
      onLanguageChange={setLanguage}
      onNavigationCollapsedChange={(collapsed) => {
        setNavigationCollapsed(collapsed)
        try {
          window.localStorage.setItem(NAVIGATION_COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0')
        } catch {
          // The layout still works when storage is blocked; only persistence is skipped.
        }
      }}
      onShareApp={() => shareLink('app', 'VRena Sessions')}
      onViewChange={setActiveView}
      profileAvatar={avatarNode(profile ? {
        avatar_url: currentProfileAvatar?.avatar_url,
        avatar_emoji: currentProfileAvatar?.avatar_emoji,
        avatar_initials: currentProfileAvatar?.avatar_initials,
        avatar_color: currentProfileAvatar?.avatar_color,
        avatar_text_color: currentProfileAvatar?.avatar_text_color,
        display_name: displayName(profile),
      } : null, 'P')}
      profileAvatarStyle={avatarStyle(currentProfileAvatar)}
      profileSubtitle={profile ? profile.profile_motto || text.profileMottoEmpty : text.clickLogin}
      profileTitle={profile ? displayName(profile) : text.noProfile}
      sharedApp={sharedKey === 'app'}
      text={text}
    />
  )


  const publicCanManageSession = () => false
  const publicCanEditTournamentSession = () => false
  const publicCanReviewSessionMessages = () => false
  const { promptTicketLogin, promptTicketCreateAccount, bookTickets } = createBookingTicketsActions(() => ({
    setProfileCountryCode,
    setProfilePhone,
    setProfileName,
    setPendingGuestTicketClaim,
    pendingGuestTicketClaim,
    ticketConfirmation,
    ticketDate,
    ticketTime,
    ticketType,
    ticketPlayers,
    ticketDuration,
    ticketSpecialNote,
    setPendingTicketAuthAction,
    goToLogin,
    setLoginPromptOpen,
    updateAuthMode,
    setActiveView,
    setProfileStatus,
    bookingTicketsInFlightRef,
    profile,
    ticketTimeOptions,
    ticketDiscountCode,
    showTicketStatus,
    text,
    validateTicketSelection,
    guestTicketContact,
    looseText,
    setIsBookingTickets,
    consumeAppRateLimit,
    activeTicketDuration,
    isSpecialTicketType,
    currentTicketTotalPrice,
    isHaDoBookingVenue,
    setTicketConfirmation,
    activeTicketArenaCount,
    currentTicketUnitPrice,
    appliedTicketLoyaltyPoints,
    ticketDiscountQuote,
    currentTicketPricing,
    ticketLoyaltyDiscountAmount,
    setProfile,
    syncProfileEverywhere,
    setTicketLoyaltyRedemption,
    ticketLoyaltyRedeemValue,
    showActionToast,
    setTicketTime,
    setTicketUseLoyaltyPoints,
    setTicketLoyaltyPointsToRedeem,
    setTicketDiscountCode,
    setTicketDiscountQuote,
    setTicketDiscountStatus,
    notifyMinorBookingCreated,
    loadSessions,
  }))
  const {
    updateClubThemeColor,
    updateClubThemeColorDraft,
    openClubPage,
    closeClubUnlockModal,
    unlockClubPage,
    handleClubTabChange,
    handleClubSessionScopeChange,
    handleClubBannerChange,
    isUserClub,
    renderClubCard,
  } = createBookingClubPageActions(() => ({
    clubEditThemeColor,
    setClubEditThemeColor,
    setClubEditThemeColorDraft,
    clubs,
    setClubStatus,
    setClubMessageStatus,
    userId,
    setSelectedClubId,
    promptLogin,
    canOpenClubPage,
    setClubUnlockTargetId,
    setClubUnlockCode,
    setClubUnlockStatus,
    text,
    setSelectedClubDate,
    setSelectedClubTab,
    setSelectedClubSessionScope,
    clubUnlockTarget,
    clubUnlockCode,
    setUnlockedClubIds,
    selectedClubSessionScope,
    ensurePastSessionsLoaded,
    setClubBannerFile,
    setClubBannerPreview,
    canManageClub,
    sessions,
    messagesForClub,
    canSeeClubPrivateData,
    canUseClubMessages,
    formatClubActivityDate,
    joinClub,
    clubThemeStyle,
    language,
    openPlayerProfile,
    avatarStyle,
    avatarNode,
    busyClubId,
    removeClubMember,
    approveClubMember,
  }))


  const profileViewContext = { activeAgeBand, activeTotpFactor, addToCalendarText, authMode, authStep, avatarColor, avatarColorDraft, avatarEmoji, avatarInitials, avatarMode, avatarPreview, avatarTextColor, avatarTextColorDraft, beginTotpEnrollment, bestPerformerCountText, consentWaiverUrl: CONSENT_WAIVER_URL, sessionForInvite, copiedInviteId, leaveSession, cancelSession, busySessionId, startEditingSession, copyInviteCode, openSessionFromProfile, canManageSession: publicCanManageSession, canAccessStaffConsole, canShareCurrentUserStats, captchaContainerRef, chooseAvatarMode, confirmTotpEnrollment, continueAuthFromEmail, crownedTopPlayer, currentUserStatsShared, deleteMyAccount, downloadSessionCalendar, editAuthEmail, failedAvatarUrls, handleAuth, handleAvatarChange, isAdultProfile, isDeletingAccount, isMfaLoading, isOAuthLoading, isPasskeyLoading, isPhoneSetupSaving, isProfileAuthLoading, isProfileSaveSuccessful, isMinorBirthdayLocked, isRecoveryMode, isResettingPassword, isSavingAnonymousMode, isSavingProfile, isTeenMinorProfile, isUnder13Profile, language, logout, marketingConsent, mfaChallengeCode, mfaEnrollment, mfaQrCodeSrc, mfaRequired, mfaStatus, mfaVerifyCode, mySessions, newPassword, openInvitationText, passkeyButtonRef, pendingInvitationsHintText, pendingInvitationsText, pendingSessionInvites, personalDataConsent, phoneSetupEmail, phoneSetupRequired, phoneSetupSentTo, playerStats, privacyPolicyUrl: PRIVACY_POLICY_URL, profile, profileBirthday: effectiveProfileBirthday, profileCountryCode, profileEmail, profileGender, profileInvitesExpanded, profileMotto, profileName, profileNickname, profilePassword, profilePastExpanded, profilePastSessions, profilePhone, profileStatus, profileUpcomingExpanded, profileUpcomingSessions, registerPasskey, rememberFailedAvatarUrl, replayOnboardingTour, rememberLogin, removeTotpFactor, resetCaptcha, saveProfile, scheduleReturnReminder, sendPasswordReset, sendPhoneSetupEmail, setActiveView, setAnonymousConfirmOpen, setAuthMode, setAuthStep, setAvatarColorDraft, setAvatarEmoji, setAvatarInitials, setAvatarTextColorDraft, setMarketingConsent, setMfaChallengeCode, setMfaEnrollment, setMfaStatus, setMfaVerifyCode, setNewPassword, setPersonalDataConsent, setPhoneSetupEmail, setPhoneSetupSentTo, setProfileBirthday, setProfileCountryCode, setProfileEmail, setProfileGender, setProfileInvitesExpanded, setProfileMotto, setProfileName, setProfileNickname, setProfilePassword, setProfilePastExpanded, setProfilePhone, setProfileStatus, setProfileUpcomingExpanded, setRememberLogin, setShowPassword, shareCurrentUserStats, showPassword, showProfileFields, signInWithGoogle, signInWithPasskey, staffMfaEnrollmentRequired, termsConditionsUrl: TERMS_CONDITIONS_URL, text, updateAnonymousMode, updateAuthMode, updateAvatarColor, updateAvatarColorDraft, updateAvatarTextColor, updateAvatarTextColorDraft, updateMarketingConsent, updatePasswordFromRecovery, userId, verifyMfaChallenge }

  const sessionsPanelContext = { activeView, announcementDrafts, applyRichTextCommand, commentDrafts, editSelectedGames, editTournamentBestOf, editTournamentCustomQualifiers, editTournamentFirstPrize, editTournamentFormat, editTournamentQualificationRule, editTournamentRequirePayment, editTournamentRoundsPerMatch, editTournamentSecondPrize, editTournamentThirdPlace, editTournamentThirdPrize, handleEditArenaCountChange, handleEditMaxPlayersChange, inviteSearch, setAnnouncementDrafts, setCommentDrafts, setEditSelectedGames, setEditTournamentBestOf, setEditTournamentCustomQualifiers, setEditTournamentFirstPrize, setEditTournamentFormat, setEditTournamentQualificationRule, setEditTournamentRequirePayment, setEditTournamentRoundsPerMatch, setEditTournamentSecondPrize, setEditTournamentThirdPlace, setEditTournamentThirdPrize, setInviteSearch, setInviteModalSessionId, addToCalendarText, addTournamentEditor, advanceTournamentRound, allProfiles, avatarFields, avatarNode, avatarStyle, bestOfLabel, bestPerformerText, busyClubId, busyInviteKey, busyMessageKey, busySessionId, busyTournamentId, busyVoteKey, cancelSession, canAccessClubSession, canEditTournamentSession: publicCanEditTournamentSession, canManageSession: publicCanManageSession, canReviewSessionMessages: publicCanReviewSessionMessages, claimPrize, canSeeClubPrivateData, canStaffExpandTicketSessions, challengeStatusLabel, clubMemberCount, clubMembershipFor, confirmPlayedGame, confirmedGameDrafts, copyInviteCode, copiedInviteId, createThirdPlaceMatch, crownedTopPlayer, createStatus, currentUserStatsShared, dayStripRef, deleteSessionMessage, downloadSessionCalendar, editBookingType, editSessionArenaCount, editSessionDate, editSessionDuration, editSessionDurationRecommendation, editSessionMaxPlayers, editSessionName, editSessionNotes, editSessionTime, editSessionVisibility, editTicketCustomerId, editTicketPricing, editTicketStatus, editTicketTotalPrice, editTicketType, editTimeOptions, editingSessionId, enablePushReminders, expandedNotes, expandedSessions, filteredSessions, finishTournament, formatVnd, friendList, generateTournamentMatches, hasMoreUpcomingSessions, highlightedSessionId, isAdmin, isEnablingPush, isLoadingMoreSessions, isLoadingPastSessions, isPushSubscribed, isSearchOpen, isSessionCreator, isUpdatingSession, inviteModalSessionId, invitePlayerToSession, invitesForSession, joinClub, joinCodes, joinSession, joinWaitlist, language, leaveSession, loadedSessionDetailIds, loadingSessionDetailIds, loadSessionMessages, looseText, messageTranslationKey, messageTranslations, messagesForSession, networkTablesReady, openClubPage, openPlayerProfile, openSessionFromProfile, participantById, participantName, poolStandingsForSession, pendingInvitationsText, postSessionMessage, previousPlayersForSession, profile, promptLogin, pushReminderStatus, removeParticipant, renderGameGuideTrigger, renderTariffTrigger, requestMessageTranslation, reviewSessionMessage, search, searchShellRef, selectedSessionDate, sessionClubFor, sessionDayOptions, sessionForInvite, sessionMessagePages, sessionReminders, sessionTimeScope, setActiveView, setCheckInTarget, setConfirmedGameDrafts, setEditBookingType, setEditSessionArenaCount, setEditSessionDate, setEditSessionDuration, setEditSessionMaxPlayers, setEditSessionName, setEditSessionNotes, setEditSessionTime, setEditSessionVisibility, setEditTicketCustomerId, setEditTicketStatus, setEditTicketTotalPrice, setEditTicketType, setExpandedNotes, setIsSearchOpen, setJoinCodes, setSearch, setSelectedSessionDate, setSessionExpanded, setSessionTimeScope, setTournamentEditorEmail, setTournamentPoolSize, setupTournamentPools, shareLink, shareTournamentResults, sharedKey, startEditingSession, stopEditingSession, text, toggleMessageOriginal, tournamentBestOf, tournamentCustomQualifiers, tournamentStageLabel, tournamentEditorEmail, tournamentEditorResults, tournamentFirstPrize, tournamentFormat, tournamentForSession, tournamentLocked, tournamentPoolSize, tournamentQualificationRule, tournamentRequirePayment, tournamentRoleHint, tournamentRoundsPerMatch, tournamentSecondPrize, tournamentThirdPlace, tournamentThirdPrize, toggleEditGame, updateSession, updateSessionMessagePage, updateTournamentMatch, updateTournamentPoolEntry, userId, voteCount, voteForGame, waitlistForSession, waitlistPosition }

  const appMain = (
    <main lang={language}>
      {(activeView === 'sessions' || activeView === 'tickets' || activeView === 'create') && (
        <BookingVenueSelector compactOnMobile={activeView === 'tickets'} onChange={handleBookingVenueChange} text={text} value={bookingVenue} />
      )}

      {activeView === 'sessions' && (
        isHaDoBookingVenue
          ? <BookingSessionsPanel context={sessionsPanelContext} />
          : <BookingVenueComingSoon text={text} />
      )}

      {activeView === 'leaderboard' && (
        <>
          {isLeaderboardLoading && leaderboardPlayerStats.length === 0 && <AppLoadingState className="section leaderboard-section" />}
          {leaderboardStatus && leaderboardPlayerStats.length === 0 && <p className="notice">{leaderboardStatus}</p>}
          <LocalErrorBoundary fallback={<p className="notice">{text.noLeaderboardPlayers}</p>} resetKey={`leaderboard-${language}-${leaderboardPlayerStats.length}-${clubs.length}`}>
            <LeaderboardPanel
              avatarStyleFor={(player: LeaderboardPlayer) => avatarStyle({
                avatar_color: player.avatarColor,
                avatar_text_color: player.avatarTextColor,
              })}
              canBypassPrivateClubPins={isAdmin}
              clubs={clubs}
              currentUserRankPlayer={currentUserRankPlayer}
              hasMorePlayers={hasMoreLeaderboardPlayers}
              initialCriterion={leaderboardView.query.criterion}
              initialGameId={leaderboardView.query.gameId}
              isCurrentUserStatsShared={currentUserStatsShared}
              isLoadingMorePlayers={isLoadingMoreLeaderboardPlayers}
              onLeaderboardClubChange={handleLeaderboardClubChange}
              onLeaderboardClubFilterOpen={ensureClubsLoaded}
              onLeaderboardClubPinUnlock={handleLeaderboardClubPinUnlock}
              onLeaderboardCriterionChange={handleLeaderboardCriterionChange}
              onLeaderboardGameChange={handleLeaderboardGameChange}
              onLeaderboardSearchChange={handleLeaderboardSearchChange}
              onLoadMorePlayers={loadMoreLeaderboardPlayers}
              onShareCurrentUserStats={() => shareCurrentUserStats()}
              onOpenPlayerProfile={openPlayerProfile}
              players={leaderboardPlayerStats}
              renderAvatar={(player: LeaderboardPlayer) => avatarNode({
                avatar_url: player.avatarUrl,
                avatar_emoji: player.avatarEmoji,
                avatar_initials: player.avatarInitials,
                avatar_color: player.avatarColor,
                avatar_text_color: player.avatarTextColor,
                display_name: player.displayName,
              }, 'P')}
              serverFiltered
              showClubFilter
              text={text}
              useServerRanking
              userId={userId}
            />
          </LocalErrorBoundary>
        </>
      )}

      {activeView === 'clubs' && (
        <ClubsView
          clubDescription={clubDescription}
          clubListCount={filteredClubs.length}
          clubName={clubName}
          clubSearch={clubSearch}
          clubSearchShellRef={clubSearchShellRef}
          clubStatus={clubStatus}
          clubVisibility={clubVisibility}
          clubVisibilityFilter={clubVisibilityFilter}
          isClubSearchOpen={isClubSearchOpen}
          isCreatingClub={isCreatingClub}
          isLoggedIn={Boolean(profile)}
          onClubDescriptionChange={setClubDescription}
          onClubNameChange={setClubName}
          onClubSearchChange={setClubSearch}
          onClubSearchOpenChange={setIsClubSearchOpen}
          onClubVisibilityFilterChange={setClubVisibilityFilter}
          onClubVisibilityChange={setClubVisibility}
          onCreateClub={createClub}
          onPromptLogin={promptLogin}
          text={text}
        >
          {userId ? (() => {
            const myClubs = filteredClubs.filter(isUserClub)
            const discoverClubs = filteredClubs.filter((club) => !isUserClub(club))
            return (
              <>
                <div className="club-list-group">
                  <div className="club-list-group-head">
                    <h3>{text.myClubs}</h3>
                    <span>{myClubs.length}</span>
                  </div>
                  {myClubs.length > 0 ? myClubs.map(renderClubCard) : <p className="notice">{text.noMyClubs}</p>}
                </div>

                <div className="club-list-group">
                  <div className="club-list-group-head">
                    <h3>{text.discoverClubs}</h3>
                    <span>{discoverClubs.length}</span>
                  </div>
                  {discoverClubs.length > 0 ? discoverClubs.map(renderClubCard) : <p className="notice">{text.noDiscoverClubs}</p>}
                </div>
              </>
            )
          })() : filteredClubs.map(renderClubCard)}
        </ClubsView>
      )}

      {activeView === 'staff' && (
        isProfileAuthLoading ? <AppLoadingState label={language === 'vi' ? 'Đang kiểm tra đăng nhập…' : 'Checking sign-in…'} /> : canAccessStaffConsole ? (
          sharedKioskAccount && kioskOperator ? (
            <StaffConsole
              authEmail=""
              key={`staff-console-${kioskOperator.profileId}`}
              kioskOperator={kioskOperator}
              language={language}
              mode="staff"
              onKioskLock={kioskLock || undefined}
              profile={profile ? { ...profile, id: kioskOperator.profileId, email: null, full_name: kioskOperator.name, role: kioskOperator.accessRole } : null}
              onOpenPlayerProfile={openStaffPlayerProfile}
              onOpenSessionCalendar={openStaffCalendar}
              initialBooking={calendarBookingDraft}
              onBookingCreated={calendarBookingDraft ? openStaffCalendar : undefined}
            />
          ) : (
            <StaffConsole
              authEmail={authEmail}
              key="staff-console"
              language={language}
              mode="staff"
              profile={profile}
              onOpenPlayerProfile={openStaffPlayerProfile}
              onOpenSessionCalendar={openStaffCalendar}
              initialBooking={calendarBookingDraft}
              onBookingCreated={calendarBookingDraft ? openStaffCalendar : undefined}
            />
          )
        ) : (
          <section className="section staff-console">
            <h2>{language === 'vi' ? 'Bảng nhân viên' : 'Staff Console'}</h2>
            <p className="notice">{language === 'vi' ? 'Cần quyền nhân viên.' : 'Staff access required.'}</p>
          </section>
        )
      )}

      {activeView === 'hr' && (
        isProfileAuthLoading ? <AppLoadingState label={language === 'vi' ? 'Đang kiểm tra đăng nhập…' : 'Checking sign-in…'} /> : canAccessHrConsole ? (
          sharedKioskAccount && kioskOperator ? (
            <StaffConsole
              authEmail=""
              key={`hr-console-${kioskOperator.profileId}`}
              kioskOperator={kioskOperator}
              language={language}
              mode="hr"
              onKioskLock={kioskLock || undefined}
              profile={profile ? { ...profile, id: kioskOperator.profileId, email: null, full_name: kioskOperator.name, role: kioskOperator.accessRole } : null}
              onOpenPlayerProfile={openStaffPlayerProfile}
              onOpenSessionCalendar={openStaffCalendar}
              initialBooking={calendarBookingDraft}
              onBookingCreated={calendarBookingDraft ? openStaffCalendar : undefined}
            />
          ) : (
            <StaffConsole
              authEmail={authEmail}
              key="hr-console"
              language={language}
              mode="hr"
              profile={profile}
              onOpenPlayerProfile={openStaffPlayerProfile}
              onOpenSessionCalendar={openStaffCalendar}
              initialBooking={calendarBookingDraft}
              onBookingCreated={calendarBookingDraft ? openStaffCalendar : undefined}
            />
          )
        ) : (
          <section className="section staff-console">
            <h2>{language === 'vi' ? 'HR' : 'HR Console'}</h2>
            <p className="notice">{language === 'vi' ? 'Cần quyền truy cập HR.' : 'HR access required.'}</p>
          </section>
        )
      )}

      {activeView === 'tickets' && (
        <div className={isHaDoBookingVenue ? 'ticket-booking-layout' : 'ticket-booking-layout cafe'}>
          <TicketBookingView
            activeTicketDuration={activeTicketDuration}
            activeTicketArenaCount={activeTicketArenaCount}
            currentTicketPricing={currentTicketPricing}
            currentTicketTotalPrice={currentTicketTotalPrice}
            currentTicketUnitPrice={currentTicketUnitPrice}
            formatShortDate={formatShortDate}
            formatVnd={formatVnd}
            gameGuideTrigger={renderGameGuideTrigger(null, 'ticket-game-guide-link')}
            guestTicketContact={guestTicketContact}
            isBookingTickets={isBookingTickets}
            isCheckingTicketDiscount={isCheckingTicketDiscount}
            isLoadingTicketLoyalty={isLoadingTicketLoyalty}
            isLoggedIn={Boolean(profile)}
            requiresZaloConfirmation={!isHaDoBookingVenue}
            singleArenaOnly={!isHaDoBookingVenue}
            estimatedLoyaltyPointsEarned={estimatedTicketLoyaltyPointsEarned}
            estimatedLoyaltyReductionValue={estimatedTicketLoyaltyReductionValue}
            loyaltyDiscountAmount={ticketLoyaltyDiscountAmount}
            loyaltyPointsBalance={ticketLoyaltyBalance}
            loyaltyPointsToRedeem={ticketLoyaltyPointsToRedeem}
            loyaltyRedeemValue={ticketLoyaltyRedeemValue}
            maxLoyaltyPointsToRedeem={maxTicketLoyaltyPoints}
            language={language}
            onBookTickets={bookTickets}
            onGuestTicketContactChange={setGuestTicketContact}
            onPrepareGuestTicketAction={prepareGuestTicketAction}
            onPromptCreateAccount={promptTicketCreateAccount}
            onPromptLogin={promptTicketLogin}
            onValidateTicketSelection={validateTicketSelection}
            onTicketDiscountCodeChange={handleTicketDiscountCodeChange}
            onTicketLoyaltyPointsChange={handleTicketLoyaltyPointsChange}
            onTicketDateChange={(value) => {
              setTicketDate(value)
              setTicketTime('')
              setTicketConfirmation(null)
              clearTicketStatus()
            }}
            onTicketDurationChange={handleTicketDurationChange}
            onTicketArenaCountChange={handleTicketArenaCountChange}
            onTicketPlayersChange={handleTicketPlayersChange}
            onTicketTimeChange={(value) => {
              setTicketTime(value)
              setTicketConfirmation(null)
              clearTicketStatus()
            }}
            onTicketTypeChange={handleTicketTypeChange}
            onTicketUseLoyaltyPointsChange={handleTicketUseLoyaltyPointsChange}
            tariffTrigger={renderTariffTrigger('ticket-tariff-link')}
            text={looseText}
            ticketConfirmation={ticketConfirmation}
            ticketDate={ticketDate}
            ticketDiscountAmount={activeTicketDiscountAmount}
            ticketDiscountCode={ticketDiscountCode}
            ticketDiscountSource={activeTicketDiscountSource}
            ticketDiscountStatus={ticketDiscountStatus}
            ticketDurationOptions={ticketDurationOptions}
            ticketPriceBlockMinutes={activeTicketPriceBlockMinutes}
            ticketPlayerOptions={ticketPlayerOptions}
            ticketPlayers={ticketPlayers}
            ticketServices={ticketServices}
            ticketStatus={ticketStatus}
            ticketStatusVariant={ticketStatusVariant}
            ticketSpecialNote={ticketSpecialNote}
            ticketTime={ticketTime}
            ticketTimeOptions={ticketTimeOptions}
            ticketType={ticketType}
            ticketTypeDescription={ticketTypeDescription}
            ticketTypeLabel={ticketTypeLabel}
            ticketUnitFormulaText={ticketUnitFormulaText}
            useLoyaltyPoints={ticketUseLoyaltyPoints}
            onTicketSpecialNoteChange={handleTicketSpecialNoteChange}
          />
          {!isHaDoBookingVenue && <CafeSoftOpeningBookingNotice text={text} />}
        </div>
      )}

      {activeView === 'create' && (
        isHaDoBookingVenue || createSessionMode === 'calendar' ? (
          <CreateSessionView
            createStatus={createStatus}
            mode={createSessionMode}
            onModeChange={(mode) => { if (mode === 'form' && !isHaDoBookingVenue) { setActiveView('tickets'); return }; handleCreateSessionModeChange(mode) }}
            text={text}
          >
            {createSessionMode === 'calendar' ? (
              <div className={`calendar-panel calendar-venue-${bookingVenue}`} aria-label={text.calendarAvailabilityTitle} aria-busy={isCalendarLoading}>
                <div className="calendar-toolbar">
                  <div>
                    <strong>{text.calendarAvailabilityTitle}</strong>
                    <span className="calendar-shop-badge">{isHaDoBookingVenue ? text.bookingVenueHaDoName : text.bookingVenueCafeName}</span>
                    <span>{text.weekOf} {formatCalendarWeekRange(calendarWeekStart, language)}</span>
                  </div>
                  <div className="calendar-nav">
                    <button
                      aria-label={text.previousWeek}
                      disabled={isCalendarLoading}
                      type="button"
                      onClick={() => moveCalendarWeek(-7)}
                    >
                      <ChevronLeft aria-hidden="true" size={18} />
                    </button>
                    <button
                      aria-label={text.nextWeek}
                      disabled={isCalendarLoading}
                      type="button"
                      onClick={() => moveCalendarWeek(7)}
                    >
                      <ChevronRight aria-hidden="true" size={18} />
                    </button>
                  </div>
                </div>
                <div className="calendar-actions">
                  <p className="muted calendar-hint">{text.calendarAvailabilityHint}</p>
                  <label>{text.date}<input type="date" aria-label={text.date} value={calendarWeekStart} disabled={isCalendarLoading} onChange={(event) => { if (event.target.value) openCreateSessionCalendar(event.target.value) }} /></label>
                  <button className="secondary" disabled={isCalendarLoading} type="button" onClick={() => openCreateSessionCalendar(localDateString())}>{text.sessionCtaTodayAction}</button>
                  {canManageCalendarBookings && <button type="button" onClick={() => startCalendarBooking(calendarWeekStart < localDateString() ? localDateString() : calendarWeekStart, isHaDoBookingVenue ? '09:00' : '16:00')}>{language === 'vi' ? 'Đặt chỗ mới' : 'New booking'}</button>}
                </div>
                <div className="calendar-scroll" role="region" aria-label={text.calendarAvailabilityTitle}>
                  <div className="calendar-time-column" aria-hidden="true">
                    <div className="calendar-day-header calendar-time-header" />
                    {calendarTimeSlots.map((slot) => (
                      <span className={slot.isHour ? 'calendar-time-label hour' : 'calendar-time-label'} key={slot.value}>
                        {slot.isHour ? slot.value : ''}
                      </span>
                    ))}
                  </div>
                  <div className="calendar-days">
                    {calendarWeekDays.map((day) => {
                      const daySessions = calendarSessions.filter((session) => {
                        if (session.date !== day.value) return false
                        const start = timeToMinutes(session.start_time)
                        return rangesOverlap(start, start + session.duration_minutes, OPEN_MINUTES, CLOSE_MINUTES)
                      })

                      return (
                        <div className="calendar-day-column" key={day.value}>
                          <div className="calendar-day-header">
                            <span>{day.weekday}</span>
                            <strong>{day.day}</strong>
                          </div>
                          <div className="calendar-day-slots">
                            {calendarTimeSlots.map((slot) => {
                              const slotKey = `${day.value}-${slot.value}`
                              const slotAvailable = calendarAvailableSlotKeys.has(slotKey)
                              return (
                                <button
                                  aria-label={`${text.emptySlot}: ${day.weekday} ${day.day} ${slot.value}`}
                                  className={slotAvailable ? 'calendar-slot' : 'calendar-slot unavailable'}
                                  disabled={!slotAvailable || isCalendarLoading}
                                  key={slot.value}
                                  type="button"
                                  onClick={() => startCalendarBooking(day.value, slot.value)}
                                >
                                  {slot.isHour ? <span>{slot.value}</span> : null}
                                </button>
                              )
                            })}
                            {daySessions.map((session) => {
                              const coverGame = sessionCoverGame(session)
                              const isTicket = isTicketSession(session)
                              const start = timeToMinutes(session.start_time)
                              const end = start + session.duration_minutes
                              const visibleStart = Math.max(start, OPEN_MINUTES)
                              const visibleEnd = Math.min(end, CLOSE_MINUTES)
                              const topPercent = ((visibleStart - OPEN_MINUTES) / (CLOSE_MINUTES - OPEN_MINUTES)) * 100
                              const heightPercent = ((visibleEnd - visibleStart) / (CLOSE_MINUTES - OPEN_MINUTES)) * 100
                              const participantCount = session.session_participants?.length ?? 0
                              const capacity = isTicket ? session.ticket_player_count || session.max_players : session.max_players
                              const sessionKind = isTicket
                                ? text.privateTicketSession
                                : session.visibility === 'private'
                                  ? text.private
                                  : text.public
                              const timeRangeLabel = `${session.start_time.slice(0, 5)}-${minutesToTime(end)}`
                              const lane = calendarSessionLanes.get(session.id) || { lane: 0, lanes: 1 }
                              const calendarSessionLabel = `${session.name} · ${isHaDoBookingVenue ? text.bookingVenueHaDoName : text.bookingVenueCafeName}: ${formatShortDate(session.date, language)} ${timeRangeLabel}`

                              return (
                                <button
                                  aria-label={calendarSessionLabel}
                                  className={isTicket ? 'calendar-session-block ticket' : 'calendar-session-block'}
                                  key={session.id}
                                  style={{ top: `${topPercent}%`, height: `${heightPercent}%`, left: `calc(${lane.lane * 100 / lane.lanes}% + 3px)`, right: 'auto', width: `calc(${100 / lane.lanes}% - 6px)` }}
                                  title={calendarSessionLabel}
                                  type="button"
                                  onClick={() => openSessionFromCalendar(session)}
                                >
                                  <span className="calendar-session-compact">
                                    <strong>{session.name}</strong>
                                    <span>{timeRangeLabel}</span>
                                    <small>{coverGame.title}</small>
                                  </span>
                                  <span className="calendar-session-popover" aria-hidden="true">
                                    <strong>{session.name}</strong>
                                    <span>{formatShortDate(session.date, language)} · {timeRangeLabel}</span>
                                    <span>{coverGame.title}</span>
                                    <span>{session.duration_minutes} min · {sessionKind}</span>
                                    <span>{participantCount}/{capacity} {text.players}</span>
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="create-session-form" id="create-session-form">
                <div className="form-grid">
                  <div className="full">
                    <label htmlFor="create-sessionName">{text.sessionName} <span className="required">*</span></label>
                    <input id="create-sessionName" data-testid="create-session-name" placeholder={text.fridayPlaceholder} value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
                  </div>
                  <div className="full session-mode-row">
                    <div>
                      <label>{text.sessionType}</label>
                      <div className="segmented session-type-toggle" role="group" aria-label={text.sessionType}>
                        <button className={sessionType === 'game' ? 'active' : ''} onClick={() => setSessionType('game')} type="button">
                          {text.normalGame}
                        </button>
                        <button className={sessionType === 'tournament' ? 'active' : ''} onClick={() => setSessionType('tournament')} type="button">
                          {text.tournament}
                        </button>
                      </div>
                    </div>
                    {!sessionClubId && (
                      <div>
                        <label>{text.visibility}</label>
                        <div className="segmented visibility-toggle" role="group" aria-label={text.visibility}>
                          <button className={sessionVisibility === 'public' ? 'active' : ''} onClick={() => setSessionVisibility('public')} type="button">
                            {text.public}
                          </button>
                          <button className={sessionVisibility === 'private' ? 'active' : ''} onClick={() => setSessionVisibility('private')} type="button">
                            {text.private}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {sessionType === 'tournament' && (
                    <div className="full tournament-create-box tournament-settings-box">
                      <div className="tournament-settings-head">
                        <strong>{text.tournamentRules}</strong>
                        <span>{text.tournamentRulesHint}</span>
                      </div>
                      <div className="form-grid compact-form-grid">
                        <div>
                          <label htmlFor="create-tournamentFormat">{text.tournamentFormat}</label>
                          <select id="create-tournamentFormat" value={tournamentFormat} onChange={(event) => setTournamentFormat(event.target.value as TournamentFormat)}>
                            <option value="pool_only">{text.formatPoolOnly}</option>
                            <option value="pool_to_semifinal">{text.formatPoolSemifinal}</option>
                            <option value="pool_to_final">{text.formatPoolFinal}</option>
                            <option value="single_elimination">{text.formatSingleElimination}</option>
                            <option value="double_elimination">{text.formatDoubleElimination}</option>
                            <option value="leaderboard">{text.formatLeaderboard}</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="create-matchSeries">{text.matchSeries}</label>
                          <select id="create-matchSeries" value={tournamentBestOf} onChange={(event) => setTournamentBestOf(Number(event.target.value) as 1 | 3 | 5)}>
                            <option value={1}>BO1</option>
                            <option value={3}>BO3</option>
                            <option value={5}>BO5</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="create-roundsPerMatch">{text.roundsPerMatch}</label>
                          <select id="create-roundsPerMatch" value={tournamentRoundsPerMatch} onChange={(event) => setTournamentRoundsPerMatch(Number(event.target.value))}>
                            {[1, 2, 3, 4, 5].map((roundCount) => (
                              <option key={roundCount} value={roundCount}>{roundCount}</option>
                            ))}
                          </select>
                          <p className="field-help">{text.roundsPerMatchHint}</p>
                        </div>
                        <div>
                          <label htmlFor="create-qualification">{text.qualification}</label>
                          <select id="create-qualification" value={tournamentQualificationRule} onChange={(event) => setTournamentQualificationRule(event.target.value as QualificationRule)}>
                            <option value="top_1">{text.topOnePerPool}</option>
                            <option value="top_2">{text.topTwoPerPool}</option>
                            <option value="top_4">{text.topFourPerPool}</option>
                            <option value="custom">{text.custom}</option>
                          </select>
                        </div>
                        {tournamentQualificationRule === 'custom' && (
                          <div>
                            <label htmlFor="create-customQualifiers">{text.customQualifiers}</label>
                            <input id="create-customQualifiers" inputMode="numeric" min={1} max={16} type="number" value={tournamentCustomQualifiers} onChange={(event) => setTournamentCustomQualifiers(Number(event.target.value) || 1)} />
                          </div>
                        )}
                        <label className="toggle-line">
                          <input checked={tournamentRequirePayment} onChange={(event) => setTournamentRequirePayment(event.target.checked)} type="checkbox" />
                          <span>{text.requirePaymentForBracket}</span>
                        </label>
                        <label className="toggle-line">
                          <input checked={tournamentThirdPlace} onChange={(event) => setTournamentThirdPlace(event.target.checked)} type="checkbox" />
                          <span>{text.createBronzeMatch}</span>
                        </label>
                        <div>
                          <label htmlFor="create-firstPrize">{text.firstPrize}</label>
                          <input id="create-firstPrize" value={tournamentFirstPrize} onChange={(event) => setTournamentFirstPrize(event.target.value)} placeholder="1,000,000 VND" />
                        </div>
                        <div>
                          <label htmlFor="create-secondPrize">{text.secondPrize}</label>
                          <input id="create-secondPrize" value={tournamentSecondPrize} onChange={(event) => setTournamentSecondPrize(event.target.value)} placeholder="Free Ticket" />
                        </div>
                        <div>
                          <label htmlFor="create-thirdPrize">{text.thirdPrize}</label>
                          <input id="create-thirdPrize" value={tournamentThirdPrize} onChange={(event) => setTournamentThirdPrize(event.target.value)} placeholder="Free Drink" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="full">
                    <label htmlFor="create-clubOnly">{text.clubOnly}</label>
                    <select id="create-clubOnly" value={sessionClubId} onChange={(event) => handleSessionClubChange(event.target.value)}>
                      <option value="">{text.noClub}</option>
                      {sessionClubOptions.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                    {sessionClubId && <p className="field-help">{text.clubOnlySessionHint}</p>}
                  </div>
                  <div className="full session-timing-row">
                    <div>
                      <label>{text.date} <span className="required">*</span></label>
                      <ShortDateInput
                        ariaLabel={text.date}
                        language={language}
                        onChange={handleSessionDateChange}
                        placeholder={text.chooseDate}
                        value={sessionDate}
                      />
                    </div>
                    <div>
                      <label htmlFor="create-availableTime">{text.availableTime} <span className="required">*</span></label>
                      <select id="create-availableTime" data-testid="create-session-time" value={sessionTime} onChange={(event) => setSessionTime(event.target.value)}>
                        <option value="">{text.chooseTime}</option>
                        {timeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="create-duration">{text.duration}</label>
                      <select id="create-duration" data-testid="create-session-duration" value={sessionDuration} onChange={(event) => setSessionDuration(Number(event.target.value))}>
                        {Array.from({ length: 12 }, (_, index) => (index + 1) * 20).map((duration) => (
                          <option value={duration} key={duration}>
                            {duration} min
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="full session-capacity-row">
                    <div>
                      <label htmlFor="create-maxPlayers">{text.maxPlayers}</label>
                      <select id="create-maxPlayers" data-testid="create-session-max-players" value={sessionMaxPlayers} onChange={(event) => handleMaxPlayersChange(Number(event.target.value))}>
                        {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                          <option value={count} key={count}>
                            {count} player{count === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="create-arenas">{text.arenas}</label>
                      <select id="create-arenas" value={sessionArenaCount} onChange={(event) => handleArenaCountChange(Number(event.target.value))}>
                        <option value={1}>{text.oneArena}</option>
                        <option value={2} disabled={sessionMaxPlayers < 8}>
                          {text.twoArenas}
                        </option>
                      </select>
                    </div>
                  </div>
                  {sessionDurationRecommendation && (
                    <p className="full notice duration-recommendation">{sessionDurationRecommendation}</p>
                  )}
                  <div className="full">
                    <div className="game-picker-head">
                      <label>{text.gameOptions} <span className="required">*</span></label>
                      {renderGameGuideTrigger(null, 'game-picker-guide-link')}
                    </div>
                    <div className="game-picker" role="group" aria-label={text.gameOptions}>
                      {games.map((game) => (
                        <div className="game-card-shell" key={game.id}>
                          <button
                            className={selectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                            onClick={() => toggleGame(game.id)}
                            type="button"
                          >
                            <NextImage src={game.image} alt="" width={240} height={240} />
                            <span>{game.title}</span>
                            <strong>{game.category}</strong>
                          </button>
                          {renderGameGuideTrigger(game.id, 'game-card-guide')}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="full">
                    <label>{text.notes}</label>
                    <div className="format-toolbar">
                      <button type="button" aria-label={text.formatBold} title={text.formatBold} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('bold') }}><Bold aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                      <button type="button" aria-label={text.formatItalic} title={text.formatItalic} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('italic') }}><Italic aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                      <button type="button" aria-label={text.formatUnderline} title={text.formatUnderline} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('underline') }}><Underline aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                      <button type="button" aria-label={text.formatStrike} title={text.formatStrike} onMouseDown={(event) => { event.preventDefault(); applyRichTextCommand('strikeThrough') }}><Strikethrough aria-hidden="true" size={15} strokeWidth={2.5} /></button>
                    </div>
                    <RichNotesEditor ariaLabel={text.notes}
                      value={sessionNotes}
                      onChange={setSessionNotes}
                      placeholder={text.notesPlaceholder}
                      resetKey={`create-${activeView}`}
                    />
                  </div>
                </div>

                <button data-testid="create-session-submit" className={isCreating ? 'primary loading create-button' : 'primary create-button'} disabled={isCreating} onClick={createSession}>
                  {isCreating ? text.creating : sessionVisibility === 'private' ? text.createPrivateSession : text.createSession}
                </button>
              </div>
            )}
          </CreateSessionView>
        ) : (
          <BookingVenueComingSoon text={text} />
        )
      )}

      {activeView === 'profile' && (
        <BookingProfileView context={profileViewContext} />
      )}

    </main>
  )

  const appOverlays = (
    <>
      {calendarEditSession && canManageCalendarBookings && (
        <StaffCalendarBookingDialog session={calendarEditSession} language={language === 'vi' ? 'vi' : 'en'}
          onClose={() => setCalendarEditSession(null)}
          onSaved={(date, deleted, venue) => {
            if (deleted) setSessions((current) => current.filter((session) => session.id !== calendarEditSession.id))
            setCalendarEditSession(null)
            if (!deleted) handleBookingVenueChange(venue)
            openCreateSessionCalendar(date)
          }} />
      )}
      {actionToast && (
        <div className="action-toast" role="status" aria-live="polite" aria-atomic="true" key={actionToast.id}>
          {actionToast.message}
        </div>
      )}

      {loginPromptOpen && (
        <LoginPromptModal
          closeText={text.close}
          title={text.loginPromptTitle}
          message={text.loginPromptMessage}
          buttonText={text.loginPromptButton}
          secondaryButtonText={text.loginPromptTicketButton}
          onClose={() => setLoginPromptOpen(false)}
          onLogin={goToLogin}
          onSecondaryAction={() => {
            setLoginPromptOpen(false)
            setActiveView('tickets')
          }}
        />
      )}

      {clubUnlockTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="club-unlock-title" onClick={closeClubUnlockModal}>
          <form className="login-modal" onSubmit={unlockClubPage} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={closeClubUnlockModal} aria-label={text.close}>
              <X aria-hidden="true" size={20} />
            </button>
            <h3 id="club-unlock-title">{text.unlockClub}</h3>
            <p>{text.privateClubLocked}</p>
            <p className="muted">{clubUnlockTarget.name}</p>
            <label>
              <span>{text.privateCode}</span>
              <input
                autoComplete="off"
                autoFocus
                inputMode="text"
                placeholder={text.privateCode}
                value={clubUnlockCode}
                onChange={(event) => {
                  setClubUnlockCode(event.target.value.toUpperCase())
                  setClubUnlockStatus('')
                }}
              />
            </label>
            {clubUnlockStatus && <p className="notice error">{clubUnlockStatus}</p>}
            <div className="club-action-row">
              <button className="primary create-button" type="submit">
                {text.unlockClub}
              </button>
              <button className="secondary create-button" type="button" onClick={closeClubUnlockModal}>
                {text.close}
              </button>
            </div>
          </form>
        </div>
      )}

      {anonymousConfirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="anonymous-mode-title" onClick={() => setAnonymousConfirmOpen(false)}>
          <div className="login-modal anonymous-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setAnonymousConfirmOpen(false)} aria-label={text.close}>
              <X aria-hidden="true" size={20} />
            </button>
            <div className="anonymous-mask-preview" aria-hidden="true">{ANONYMOUS_MASK_EMOJI}</div>
            <h3 id="anonymous-mode-title">{text.goAnonymousTitle}</h3>
            <p>{text.goAnonymousBody}</p>
            <div className="club-action-row">
              <button className="secondary create-button" type="button" onClick={() => setAnonymousConfirmOpen(false)}>
                {text.cancel}
              </button>
              <button className={isSavingAnonymousMode ? 'primary loading create-button' : 'primary create-button'} disabled={isSavingAnonymousMode} type="button" onClick={() => updateAnonymousMode(true)}>
                {text.activateAnonymousMode}
              </button>
            </div>
          </div>
        </div>
      )}

      {invitePopupInvite && invitePopupSession && (
        <InvitePopupModal
          closeText={text.close}
          title={invitationPopupTitleText}
          body={invitationPopupBodyText}
          sessionName={invitePopupSession.name}
          sessionImage={sessionCoverGame(invitePopupSession).image}
          invitedText={text.invited}
          dateText={formatShortDate(invitePopupSession.date, language)}
          timeText={invitePopupSession.start_time.slice(0, 5)}
          durationText={`${invitePopupSession.duration_minutes} min`}
          openText={openInvitationText}
          calendarText={addToCalendarText}
          onClose={() => setInvitePopupInviteId('')}
          onOpen={() => {
            setInvitePopupInviteId('')
            openSessionFromProfile(invitePopupSession.id)
          }}
          onCalendar={() => downloadSessionCalendar(invitePopupSession)}
        />
      )}

      {birthdayPopupOpen && (
        <BirthdayPopupModal
          closeText={text.close}
          title={text.birthdayPopupTitle}
          message={text.birthdayPopupMessage}
          buttonText={text.birthdayPopupButton}
          onClose={() => setBirthdayPopupOpen(false)}
          onAction={() => {
            setBirthdayPopupOpen(false)
            setActiveView('create')
          }}
        />
      )}

      {tariffPaymentOpen && (
        <TariffPaymentModal
          closeText={text.close}
          title={isHaDoBookingVenue ? text.sessionTariffHaDoTitle : text.sessionTariffCafeTitle}
          rates={isHaDoBookingVenue
            ? [
              text.sessionTariffRateDay,
              text.sessionTariffRateEvening,
              text.sessionTariffRateWeekend,
              text.sessionTariffRateWeekendDay,
              text.sessionTariffRateWeekendEvening,
            ]
            : [
              text.sessionTariffRateCafeHappy,
              text.sessionTariffRateCafeEvening,
            ]}
          arenaText={isHaDoBookingVenue ? text.sessionTariffHaDoArena : text.sessionTariffCafeArena}
          discounts={[
            text.sessionTariffGroupSmall,
            text.sessionTariffGroupLarge,
            text.sessionTariffBirthdayOffer,
          ]}
          offerLimit={text.sessionOfferLimit}
          paymentText={text.sessionTariffPayment}
          loyaltyTitle={text.sessionTariffLoyaltyTitle}
          loyaltyText={text.sessionTariffLoyaltyText}
          contactText={text.contactUs}
          disclaimer={isHaDoBookingVenue ? text.sessionTariffHaDoDisclaimer : text.sessionTariffCafeDisclaimer}
          onClose={() => setTariffPaymentOpen(false)}
        />
      )}

      {gameGuideOpen && (
        <GameGuideModal
          closeText={text.gameGuideClose}
          games={gameGuideGames}
          language={language}
          onClose={() => setGameGuideOpen(false)}
          staffGameGuides={staffGameGuides}
          text={looseText}
        />
      )}

      {selectedClub && canOpenClubPage(selectedClub) && <ClubDetail
        canManageClub={canManageClub}
        selectedClub={selectedClub}
        canModerateClubMembers={canModerateClubMembers}
        canSeeClubPrivateData={canSeeClubPrivateData}
        clubBannerPreview={clubBannerPreview}
        sessionClubOptions={sessionClubOptions}
        selectedClubSessionScope={selectedClubSessionScope}
        text={text}
        canUseClubMessages={canUseClubMessages}
        messagesForClub={messagesForClub}
        clubPublicMessageDrafts={clubPublicMessageDrafts}
        clubAdminMessageDrafts={clubAdminMessageDrafts}
        setSelectedClubId={setSelectedClubId}
        setDrawerTouchStart={setDrawerTouchStart}
        drawerTouchStart={drawerTouchStart}
        clubThemeStyle={clubThemeStyle}
        userId={userId}
        selectedClubMembership={selectedClubMembership}
        clubRoleLabel={clubRoleLabel}
        clubRoleFor={clubRoleFor}
        busyClubId={busyClubId}
        joinClub={joinClub}
        setSessionClubId={setSessionClubId}
        setSessionVisibility={setSessionVisibility}
        setCreateStatus={setCreateStatus}
        setActiveView={setActiveView}
        leaveClub={leaveClub}
        leaveClubText={leaveClubText}
        shareClubInvite={shareClubInvite}
        selectedClubTab={selectedClubTab}
        handleClubTabChange={handleClubTabChange}
        isLeaderboardLoading={isLeaderboardLoading}
        leaderboardPlayerStats={leaderboardPlayerStats}
        language={language}
        avatarStyle={avatarStyle}
        isAdmin={isAdmin}
        currentUserRankPlayer={currentUserRankPlayer}
        hasMoreLeaderboardPlayers={hasMoreLeaderboardPlayers}
        leaderboardView={leaderboardView}
        currentUserStatsShared={currentUserStatsShared}
        isLoadingMoreLeaderboardPlayers={isLoadingMoreLeaderboardPlayers}
        handleLeaderboardCriterionChange={handleLeaderboardCriterionChange}
        handleLeaderboardGameChange={handleLeaderboardGameChange}
        handleLeaderboardSearchChange={handleLeaderboardSearchChange}
        loadMoreLeaderboardPlayers={loadMoreLeaderboardPlayers}
        openPlayerProfile={openPlayerProfile}
        shareCurrentUserStats={shareCurrentUserStats}
        avatarNode={avatarNode}
        selectedClubApprovedMembers={selectedClubApprovedMembers}
        manageableRoleOptions={manageableRoleOptions}
        updateClubMemberRole={updateClubMemberRole}
        transferClubOwnership={transferClubOwnership}
        canManageClubMember={canManageClubMember}
        removeClubMember={removeClubMember}
        selectedClubPendingMembers={selectedClubPendingMembers}
        approveClubMember={approveClubMember}
        handleClubSessionScopeChange={handleClubSessionScopeChange}
        selectedClubDayOptions={selectedClubDayOptions}
        selectedClubDate={selectedClubDate}
        setSelectedClubDate={setSelectedClubDate}
        filteredSelectedClubSessions={filteredSelectedClubSessions}
        isLoadingPastSessions={isLoadingPastSessions}
        openSessionFromProfile={openSessionFromProfile}
        renderGameGuideTrigger={renderGameGuideTrigger}
        hasMoreUpcomingSessions={hasMoreUpcomingSessions}
        loadMoreUpcomingSessions={loadMoreUpcomingSessions}
        isLoadingMoreSessions={isLoadingMoreSessions}
        isLoadingClubMessages={isLoadingClubMessages}
        clubMessageStatus={clubMessageStatus}
        setClubPublicMessageDrafts={setClubPublicMessageDrafts}
        busyMessageKey={busyMessageKey}
        postClubMessage={postClubMessage}
        messageTranslationKey={messageTranslationKey}
        requestMessageTranslation={requestMessageTranslation}
        toggleMessageOriginal={toggleMessageOriginal}
        messageTranslations={messageTranslations}
        setClubAdminMessageDrafts={setClubAdminMessageDrafts}
        clubEditName={clubEditName}
        setClubEditName={setClubEditName}
        clubEditMotto={clubEditMotto}
        setClubEditMotto={setClubEditMotto}
        clubEditDescription={clubEditDescription}
        setClubEditDescription={setClubEditDescription}
        clubEditVisibility={clubEditVisibility}
        setClubEditVisibility={setClubEditVisibility}
        clubEditDefaultLanguage={clubEditDefaultLanguage}
        setClubEditDefaultLanguage={setClubEditDefaultLanguage}
        clubEditRankingCriterion={clubEditRankingCriterion}
        setClubEditRankingCriterion={setClubEditRankingCriterion}
        clubRankingCriteria={clubRankingCriteria}
        handleClubBannerChange={handleClubBannerChange}
        clubEditThemeColor={clubEditThemeColor}
        updateClubThemeColor={updateClubThemeColor}
        clubEditThemeColorDraft={clubEditThemeColorDraft}
        setClubEditThemeColorDraft={setClubEditThemeColorDraft}
        updateClubThemeColorDraft={updateClubThemeColorDraft}
        isSavingClub={isSavingClub}
        saveClubSettings={saveClubSettings}
        regenerateClubInviteCode={regenerateClubInviteCode}
      />}

      {selectedPlayerProfile && (
        <PlayerProfileModal
          closeText={text.close}
          playerTitle={compactDisplayName(selectedPlayerProfile.displayName, text.player)}
          avatar={
            <div
              className={crownedTopPlayer?.profileId === selectedPlayerProfile.profileId ? 'player-avatar profile-large champion-avatar' : 'player-avatar profile-large'}
              style={avatarStyle({ avatar_color: selectedPlayerProfile.avatarColor, avatar_text_color: selectedPlayerProfile.avatarTextColor })}
            >
              {avatarNode({
                avatar_url: selectedPlayerProfile.avatarUrl,
                avatar_emoji: selectedPlayerProfile.avatarEmoji,
                avatar_initials: selectedPlayerProfile.avatarInitials,
                avatar_color: selectedPlayerProfile.avatarColor,
                avatar_text_color: selectedPlayerProfile.avatarTextColor,
                display_name: selectedPlayerProfile.displayName,
              }, 'P')}
              {crownedTopPlayer?.profileId === selectedPlayerProfile.profileId && <span className="champion-badge">👑</span>}
            </div>
          }
          motto={selectedPlayerProfile.profileMotto}
          isTopPlayer={crownedTopPlayer?.profileId === selectedPlayerProfile.profileId}
          bestOverallText={text.bestOverall}
          canFollow={networkTablesReady && selectedPlayerProfile.profileId !== userId}
          followBusy={busyFriendId === selectedPlayerProfile.profileId}
          followText={isFollowing(selectedPlayerProfile.profileId) ? text.following : text.addFriend}
          onFollow={() => toggleFollowPlayer(selectedPlayerProfile)}
          onClose={closePlayerProfile}
          stats={playerProfileStats}
          scoreSummary={null}
          challengeControls={<ChallengeControls
            userId={userId}
            challengeTargetId={challengeTargetId}
            sessionInvites={sessionInvites}
            sessionForInvite={sessionForInvite}
            openChallengeForm={openChallengeForm}
            text={text}
            challengeGameId={challengeGameId}
            setChallengeTargetId={setChallengeTargetId}
            setChallengeGameId={setChallengeGameId}
            language={language}
            setChallengeDate={setChallengeDate}
            setChallengeTime={setChallengeTime}
            challengeDate={challengeDate}
            challengeTime={challengeTime}
            challengeTimeOptions={challengeTimeOptions}
            challengeDuration={challengeDuration}
            setChallengeDuration={setChallengeDuration}
            isCreatingChallenge={isCreatingChallenge}
            createFriendChallenge={createFriendChallenge}
            challengeStatus={challengeStatus}
            player={selectedPlayerProfile}
          />}
          gameStatsTitle={text.bestScores}
          gameStats={selectedPlayerGameCards}
          gameStatsLoading={selectedPlayerGameStatsLoading}
          previousGameText={text.onboardingPrevious}
          nextGameText={text.next}
        />
      )}

      {championLoginOpen && (
        <ChampionLoginModal
          closeText={text.close}
          title={text.bestOverall}
          message={text.bestPlayerLogin}
          onClose={() => setChampionLoginOpen(false)}
        />
      )}

      {checkInParticipant && (
        <CheckInModal
          closeText={text.close}
          title={text.checkIn}
          playerName={compactDisplayName(checkInParticipant.display_name, text.player)}
          paymentSplits={checkInPaymentSplits}
          paymentSummary={`${text.paidTotal}: ${formatTicketFormulaPrice(checkInPaymentTotal)}`}
          cashText={text.cash}
          bankTransferText={text.bankTransfer}
          freeText={text.free}
          amountText={text.paymentAmount}
          addSplitText={text.addPaymentSplit}
          removeText={text.remove}
          saveText={text.saveChanges}
          clearText={text.clearCheckIn}
          checkedIn={Boolean(checkInParticipant.checked_in)}
          onClose={() => setCheckInTarget(null)}
          onPaymentSplitMethodChange={(splitId, value) => updateCheckInPaymentSplit(splitId, { payment_method: value })}
          onPaymentSplitAmountChange={(splitId, value) => updateCheckInPaymentSplit(splitId, { amount: value })}
          onAddPaymentSplit={addCheckInPaymentSplit}
          onRemovePaymentSplit={removeCheckInPaymentSplit}
          onSaveFree={() => updateParticipantCheckIn(checkInParticipant.id, null, true)}
          onSavePaid={() => updateParticipantCheckIn(checkInParticipant.id, normalizedCheckInPaymentSplits)}
          onClear={() => updateParticipantCheckIn(checkInParticipant.id, null)}
        />
      )}
    </>
  )

  if (embedded) {
    return (
      <>
        {appMain}
        {appOverlays}
      </>
    )
  }

  const appShell = (
    <div className={`app${isAndroid ? ' platform-android' : ''} ${isConsoleWorkspace ? 'console-workspace' : 'player-workspace'}${navigationCollapsed ? ' navigation-collapsed' : ''}`} data-tour="app-shell">
      <DocumentLanguage language={language} />
      {profile && userId && (
        <FirstLoginTour enabled onViewChange={setActiveView} replayNonce={tourReplayNonce} text={text} userId={userId} />
      )}
      {appAside}
      {appMain}
      {appOverlays}
    </div>
  )

  if (!sharedKioskAccount) return appShell

  return (
    <StaffKioskGate
      authEmail={authEmail}
      language={language}
      onLockChange={handleKioskLockChange}
      onLogout={logoutStaffKiosk}
      onOperatorChange={setKioskOperator}
    >
      {() => appShell}
    </StaffKioskGate>
  )
}
