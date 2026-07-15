'use client'

import NextImage from 'next/image'
import { Bold, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Crown, Italic, Lock, MessageSquare, RefreshCw, Save, Send, Share, Strikethrough, Underline, UserCheck, UserMinus, X } from 'lucide-react'
import { ChangeEvent, FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCreateSessionCalendar } from '../hooks/useCreateSessionCalendar'
import { CLUB_LIST_SELECT, CLUB_LIST_SELECT_BASE, CLUB_LIST_WITH_MEMBERS_SELECT, CLUB_LIST_WITH_MEMBERS_SELECT_BASE, CLUB_MEMBER_SELECT, CLUB_MEMBER_SELECT_BASE, CLUB_MESSAGE_SELECT, CLUB_PUBLIC_SELECT, OPTIONAL_SESSION_METADATA_COLUMNS, SESSION_CARD_PARTICIPANT_SELECT, SESSION_CARD_SELECT, SESSION_CARD_SELECT_BASE, SESSION_MESSAGE_SELECT, SESSION_SELECT, SESSION_SELECT_BASE, WAITLIST_POSITION_SELECT, WAITLIST_SELECT, avatarColors, avatarTextColors, clubThemeColors, games, isEscapeSession, selectedTicketService, ticketArenaCount, ticketMaxCustomerDurationMinutes, ticketPriceBlockMinutes, ticketServices, type GameId, type TicketType } from '../lib/bookingStaticData'
import { getInitialLanguage } from '../lib/i18n/detectLanguage'
import { isLanguageCode, languageOptions, type LanguageCode } from '../lib/i18n/languages'
import { getFallbackTranslation, loadTranslation, type TranslationMap } from '../lib/i18n/loadTranslation'
import { canUseWebPush, downloadSessionCalendarFile, notifyBookingInvite, notifyBookingSession, registerReminderServiceWorker, requestBrowserReminderPermission, shareBookingLink, urlBase64ToUint8Array } from '../lib/bookingBrowserActions'
import { notifyBookingUpdateEmail } from '../lib/bookingUpdateNotificationClient'
import { ageBandFromBirthday, isUnder13Birthday } from '../lib/agePolicy'
import { currentUserLeaderboardPlayer, initialLeaderboardQuery, isLeaderboardCriterion, isMissingPagedLeaderboardFunction, leaderboardPlayerFromRpcRow, leaderboardRpcArgs, type LeaderboardQuery, type LeaderboardRpcRow } from '../lib/leaderboard'
import { buildPlayerStatsShareSummary, hasShareablePlayerStats } from '../lib/playerStatsShare'
import { cleanMessageText, equivalentMessageText } from '../lib/messageText'
import type { RateLimitAction } from '../lib/security/rateLimit'
import { vrenaPalette } from '../lib/theme/vrenaPalette'
import { defaultStaffRoleForEmail as defaultRoleForEmail, isStaffAdminEmail as isAdminEmail, isStaffAdminRole as isAdminRole, staffRoleRank as staffConsoleRank } from '../lib/staffRoles'
import { HCAPTCHA_SITE_KEY, ensureHCaptcha, getHCaptcha, passkeysAvailable, removeHCaptchaWidget } from '../lib/hcaptcha'
import { validateGuestTicketContact, type GuestTicketContact } from '../lib/guestTicketBooking'
import AppLoadingState from './AppLoadingState'
import AppSidebar, { type AppView } from './AppSidebar'
import AvatarNode from './AvatarNode'
import { ARENA_COUNT, OPEN_MINUTES, CLOSE_MINUTES, TIME_STEP_MINUTES, SESSION_LOAD_BATCH_DAYS, LEADERBOARD_PAGE_SIZE, DEFAULT_APP_URL, TicketStatus, BookingType, ChallengeStatus, ClubRole, ClubMemberRole, ClubTab, ClubSessionScope, ParticipantPaymentSplit, ParticipantPaymentSplitDraft, StaffGameGuide, TicketBookingConfirmation, Profile, TotpFactor, TotpEnrollment, TicketLoyaltyRedemption, TicketLoyaltyEarnQuote, TicketDiscountQuote, ANONYMOUS_MASK_EMOJI, ANONYMOUS_MASK_COLOR, ANONYMOUS_MASK_TEXT_COLOR, ProfileGender, PROFILE_SELECT, normalizeProfileGender, normalizePrivateCode, Participant, WaitlistEntry, FriendConnection, SessionInvite, SessionMessage, SessionMessagePageState, ClubMessage, MessageTranslationResponse, TournamentFormat, QualificationRule, MatchStage, RealtimeRefreshTask, Session, BlockedTime, SessionListPageResult, ClubMember, Club, ClubListPageRow, TournamentEditor, TournamentPool, TournamentPoolEntry, TournamentMatch, TournamentData, TournamentAuditLog, TournamentMatchInsert, minutesToTime, timeToMinutes, rangesOverlap, localDateString, generateInviteCode, arenasUsedBySession, isTicketSession, isChallengeSession, ticketTypeLabel, ticketTypeDescription, formatVnd, formatTicketFormulaPrice, newParticipantPaymentSplit, normalizeParticipantPaymentSplits, participantPaymentSplitTotal, paymentSplitsFromParticipant, ticketPricingSummary, ticketDurationForPlayers, ticketArenaCountForPlayers, ticketUnitFormulaText, clampTicketLoyaltyRedemption, isBirthdayToday, resolveCountryCode, splitPhoneNumber, displayName, limitDisplayName, compactDisplayName, playerCardLabel, anonymousCallsignForId, finiteNumber, leaderboardPlayerFromStaffProfile, compactInitials, validAvatarInitials, limitMotto, isHexColor, cleanHexColor, normalizeSearchValue, addDays, addDaysToDateValue, maxDateValue, upcomingBatchEndForDate, startOfWeekDateValue, weekDaysFromStart, formatDayButton, formatShortDate, formatCalendarWeekRange, sessionStartDate, isPastSession, isUpcomingSession, sortSessionsByStart, seatsLeft, sessionCoverGame, participantScore, sessionBestPerformer, isBestSessionPerformer, percentValue, formatSpeedrunDuration, bestOfLabel, authDebug, eligibleTournamentParticipants, shuffleItems, matchWinnerFromSeries, matchLoser, hasDuplicateMatchPlayers, knockoutStageForCount, qualificationCount, calculatePoolStandings, buildKnockoutRows, appRedirectUrl, passwordRecoveryUrlParams, cleanPasswordRecoveryUrl, clubMembers, clubMemberCount, normalizeClubListPageRow, mergeCurrentUserClubMembership, mergeClubRecords, clubRoleForProfile, scheduleDeferredWork, schedulePostEffectStateUpdate } from '../lib/bookingWidgetDomain'
import { BookingProfileView, BookingSessionsPanel, BirthdayPopupModal, ChampionLoginModal, CheckInModal, ClubsView, CreateSessionView, FirstLoginTour, GameGuideModal, InvitePopupModal, LeaderboardPanel, LoginPromptModal, PlayerProfileModal, RichNotesEditor, ShortDateInput, StaffConsole, TariffPaymentModal, TicketBookingView, type ClubVisibility, type ClubVisibilityFilter, type SessionTimeScope } from './BookingWidgetSurfaces'
import { ButtonIconText, LocalErrorBoundary } from './BookingWidgetUi'
import type { LeaderboardCriterion, LeaderboardPlayer } from './LeaderboardPanel'
import MessageBodyText, { type MessageTranslationState } from './MessageBodyText'
import type { AuthMode } from './ProfileAuthView'
import type { StaffProfile } from './StaffConsole'

const REALTIME_REFRESH_DEBOUNCE_MS = 650
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VRENA_WEBSITE_URL = 'https://www.vre-vietnam.com'
const PRIVACY_POLICY_URL = `${VRENA_WEBSITE_URL}/privacy-policy`
const TERMS_CONDITIONS_URL = `${VRENA_WEBSITE_URL}/terms-and-conditions`
const CONSENT_WAIVER_URL = `${VRENA_WEBSITE_URL}/consent-form`
const LEGAL_CONSENT_VERSION = '2026-07-06'
const CLUB_BANNER_MAX_BYTES = 2 * 1024 * 1024
const CLUB_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_IMAGE_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const CLUB_MESSAGE_MAX_LENGTH = 150

const CLUB_MESSAGE_LIMIT = 30

const SESSION_MESSAGE_PAGE_SIZE = 30
const TICKET_NEXT_AVAILABLE_SCAN_DAYS = 35

let supabaseClientPromise: Promise<typeof import('../lib/supabase/client').supabase> | null = null

function getSupabase() {
  supabaseClientPromise ??= import('../lib/supabase/client').then((module) => module.supabase)
  return supabaseClientPromise
}

type BookingWidgetProps = {
  embedded?: boolean
  externalLanguage?: LanguageCode
  initialText?: TranslationMap
  initialSelectedPlayerId?: string
  initialSelectedPlayerSessionId?: string
  initialView?: AppView
  onActiveViewChange?: (view: AppView) => void
  onProfileChange?: (profile: Profile | null) => void
  restoreStoredView?: boolean
}

type ActionToast = {
  id: number
  message: string
}

const BOOKING_ACTIVE_VIEW_STORAGE_KEY = 'vrena.booking.activeView'
const CONSOLE_SIDEBAR_STORAGE_KEY = 'vrena.console.sidebarCollapsed.v1'
const bookingAppViews: AppView[] = ['sessions', 'tickets', 'create', 'leaderboard', 'clubs', 'profile', 'hr', 'staff']

function isBookingAppView(value: unknown): value is AppView {
  return typeof value === 'string' && bookingAppViews.includes(value as AppView)
}

function bookingUpdateKind(session: Pick<Session, 'booking_type'>) {
  return session.booking_type === 'ticket' ? 'ticket' : 'session'
}

function bookingUpdateChanges(rows: Array<[string, unknown, unknown]>) {
  return rows
    .filter(([, before, after]) => String(before ?? '') !== String(after ?? ''))
    .map(([label, before, after]) => ({ label, before: before as string | number | boolean | null, after: after as string | number | boolean | null }))
}

export default function WidgetPage({
  embedded = false,
  externalLanguage,
  initialText,
  initialSelectedPlayerId = '',
  initialSelectedPlayerSessionId = '',
  initialView = 'tickets',
  onActiveViewChange,
  onProfileChange,
  restoreStoredView = true,
}: BookingWidgetProps = {}) {
  const [activeView, setActiveView] = useState<AppView>(initialView)
  const [consoleSidebarCollapsed, setConsoleSidebarCollapsed] = useState(false)
  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      try {
        setConsoleSidebarCollapsed(window.localStorage.getItem(CONSOLE_SIDEBAR_STORAGE_KEY) === '1')
      } catch {
        // The default expanded layout remains available when storage is blocked.
      }
    })

    return () => window.cancelAnimationFrame(restoreFrame)
  }, [])
  const hasMountedInitialViewSyncRef = useRef(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [leaderboardPlayers, setLeaderboardPlayers] = useState<LeaderboardPlayer[]>([])
  const [currentUserRankPlayer, setCurrentUserRankPlayer] = useState<LeaderboardPlayer | null>(null)
  const [currentUserShareStats, setCurrentUserShareStats] = useState<LeaderboardPlayer | null>(null)
  const [hasMoreLeaderboardPlayers, setHasMoreLeaderboardPlayers] = useState(false)
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false)
  const [isLoadingMoreLeaderboardPlayers, setIsLoadingMoreLeaderboardPlayers] = useState(false)
  const [leaderboardStatus, setLeaderboardStatus] = useState('')
  const [friendConnections, setFriendConnections] = useState<FriendConnection[]>([])
  const [sessionInvites, setSessionInvites] = useState<SessionInvite[]>([])
  const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([])
  const [sessionMessagePages, setSessionMessagePages] = useState<Record<string, SessionMessagePageState>>({})
  const [loadedSessionDetailIds, setLoadedSessionDetailIds] = useState<Record<string, boolean>>({})
  const [loadingSessionDetailIds, setLoadingSessionDetailIds] = useState<Record<string, boolean>>({})
  const [clubMessages, setClubMessages] = useState<ClubMessage[]>([])
  const [isLoadingClubMessages, setIsLoadingClubMessages] = useState(false)
  const [clubMessageStatus, setClubMessageStatus] = useState('')
  const [messageTranslations, setMessageTranslations] = useState<Record<string, MessageTranslationState>>({})
  const [networkTablesReady, setNetworkTablesReady] = useState(false)
  const [tournamentData, setTournamentData] = useState<TournamentData>({
    editors: [],
    pools: [],
    poolEntries: [],
    matches: [],
    auditLogs: [],
  })
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedSessionDate, setSelectedSessionDate] = useState('')
  const [clubSearch, setClubSearch] = useState('')
  const [isClubSearchOpen, setIsClubSearchOpen] = useState(false)
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({})

  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authStep, setAuthStep] = useState<'email' | 'credentials'>('email')
  const [profileCountryCode, setProfileCountryCode] = useState('+84')
  const [profilePhone, setProfilePhone] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [rememberLogin, setRememberLogin] = useState(true)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaTokenRef = useRef('')
  const [newPassword, setNewPassword] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileMotto, setProfileMotto] = useState('')
  const [profileNickname, setProfileNickname] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileBirthday, setProfileBirthday] = useState('')
  const [profileGender, setProfileGender] = useState<ProfileGender | ''>('')
  const [personalDataConsent, setPersonalDataConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(true)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarMode, setAvatarMode] = useState<'photo' | 'emoji' | 'initials'>('photo')
  const [failedAvatarUrls, setFailedAvatarUrls] = useState<Set<string>>(() => new Set())
  const [avatarEmoji, setAvatarEmoji] = useState('😎')
  const [avatarInitials, setAvatarInitials] = useState('')
  const [avatarColor, setAvatarColor] = useState(avatarColors[0])
  const [avatarColorDraft, setAvatarColorDraft] = useState(avatarColors[0])
  const [avatarTextColor, setAvatarTextColor] = useState(avatarTextColors[0])
  const [avatarTextColorDraft, setAvatarTextColorDraft] = useState(avatarTextColors[0])
  const [profileStatus, setProfileStatus] = useState('')
  const [actionToast, setActionToast] = useState<ActionToast | null>(null)
  const actionToastTimerRef = useRef<number | null>(null)
  const [isProfileAuthLoading, setIsProfileAuthLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [mfaFactors, setMfaFactors] = useState<TotpFactor[]>([])
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollment | null>(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaChallengeCode, setMfaChallengeCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [isMfaLoading, setIsMfaLoading] = useState(false)
  const [mfaStatus, setMfaStatus] = useState('')
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)
  const [tourReplayNonce, setTourReplayNonce] = useState(0)

  const [sessionVisibility, setSessionVisibility] = useState<'public' | 'private'>('public')
  const [sessionType, setSessionType] = useState<'game' | 'tournament'>('game')
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>('pool_to_final')
  const [tournamentBestOf, setTournamentBestOf] = useState<1 | 3 | 5>(1)
  const [tournamentRoundsPerMatch, setTournamentRoundsPerMatch] = useState(1)
  const [tournamentRequirePayment, setTournamentRequirePayment] = useState(false)
  const [tournamentQualificationRule, setTournamentQualificationRule] = useState<QualificationRule>('top_1')
  const [tournamentCustomQualifiers, setTournamentCustomQualifiers] = useState(2)
  const [tournamentThirdPlace, setTournamentThirdPlace] = useState(true)
  const [tournamentFirstPrize, setTournamentFirstPrize] = useState('')
  const [tournamentSecondPrize, setTournamentSecondPrize] = useState('')
  const [tournamentThirdPrize, setTournamentThirdPrize] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState(localDateString())
  const [sessionTime, setSessionTime] = useState('')
  const [sessionDuration, setSessionDuration] = useState(20)
  const [sessionMaxPlayers, setSessionMaxPlayers] = useState(4)
  const [sessionArenaCount, setSessionArenaCount] = useState(1)
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionClubId, setSessionClubId] = useState('')
  const [selectedGames, setSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [createStatus, setCreateStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [pushReminderStatus, setPushReminderStatus] = useState('')
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)
  const [isEnablingPush, setIsEnablingPush] = useState(false)
  const [ticketType, setTicketType] = useState<TicketType>('individual')
  const [ticketDate, setTicketDate] = useState(localDateString())
  const [ticketTime, setTicketTime] = useState('')
  const [ticketPlayers, setTicketPlayers] = useState(1)
  const [ticketDuration, setTicketDuration] = useState(20)
  const [ticketSpecialNote, setTicketSpecialNote] = useState('')
  const [guestTicketContact, setGuestTicketContact] = useState<GuestTicketContact>({ name: '', phone: '' })
  const [pendingGuestTicketClaim, setPendingGuestTicketClaim] = useState<{ phone: string; reference: string; name?: string; date?: string } | null>(null)
  const [pendingTicketAuthAction, setPendingTicketAuthAction] = useState<'book-after-login' | 'claim-after-auth' | null>(null)
  const pendingTicketAuthCompletingRef = useRef(false)
  const [ticketStatus, setTicketStatus] = useState('')
  const [ticketStatusVariant, setTicketStatusVariant] = useState<'info' | 'error'>('info')
  const [isBookingTickets, setIsBookingTickets] = useState(false)
  const [ticketConfirmation, setTicketConfirmation] = useState<TicketBookingConfirmation | null>(null)
  const [ticketUseLoyaltyPoints, setTicketUseLoyaltyPoints] = useState(false)
  const [ticketLoyaltyPointsToRedeem, setTicketLoyaltyPointsToRedeem] = useState('')
  const [ticketLoyaltyRedemption, setTicketLoyaltyRedemption] = useState<TicketLoyaltyRedemption | null>(null)
  const [ticketLoyaltyEarnQuote, setTicketLoyaltyEarnQuote] = useState<TicketLoyaltyEarnQuote | null>(null)
  const [isLoadingTicketLoyalty, setIsLoadingTicketLoyalty] = useState(false)
  const [ticketDiscountCode, setTicketDiscountCode] = useState('')
  const [ticketDiscountQuote, setTicketDiscountQuote] = useState<TicketDiscountQuote | null>(null)
  const [ticketAutomaticDiscountQuote, setTicketAutomaticDiscountQuote] = useState<TicketDiscountQuote | null>(null)
  const [ticketDiscountStatus, setTicketDiscountStatus] = useState('')
  const [isCheckingTicketDiscount, setIsCheckingTicketDiscount] = useState(false)
  const [ticketAvailabilitySearchTick, setTicketAvailabilitySearchTick] = useState(0)
  const [gameGuideOpen, setGameGuideOpen] = useState(false)
  const [gameGuideGameId, setGameGuideGameId] = useState<GameId | null>(null)
  const [staffGameGuides, setStaffGameGuides] = useState<Partial<Record<GameId, StaffGameGuide>>>({})
  const staffGameGuidesLoadedRef = useRef(false)
  const staffGameGuidesLoadingRef = useRef(false)
  const [challengeTargetId, setChallengeTargetId] = useState('')
  const [challengeGameId, setChallengeGameId] = useState<GameId>('laser-tag')
  const [challengeDate, setChallengeDate] = useState(localDateString())
  const [challengeTime, setChallengeTime] = useState('')
  const [challengeDuration, setChallengeDuration] = useState(20)
  const [challengeStatus, setChallengeStatus] = useState('')
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false)
  const [busySessionId, setBusySessionId] = useState('')
  const [busyVoteKey, setBusyVoteKey] = useState('')
  const [copiedInviteId, setCopiedInviteId] = useState('')
  const [sharedKey, setSharedKey] = useState('')
  const [editingSessionId, setEditingSessionId] = useState('')
  const [editSessionName, setEditSessionName] = useState('')
  const [editSessionDate, setEditSessionDate] = useState(localDateString())
  const [editSessionTime, setEditSessionTime] = useState('')
  const [editSessionDuration, setEditSessionDuration] = useState(20)
  const [editSessionMaxPlayers, setEditSessionMaxPlayers] = useState(4)
  const [editSessionArenaCount, setEditSessionArenaCount] = useState(1)
  const [editSessionVisibility, setEditSessionVisibility] = useState<'public' | 'private'>('public')
  const [editSessionNotes, setEditSessionNotes] = useState('')
  const [editSelectedGames, setEditSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [editBookingType, setEditBookingType] = useState<BookingType>('community')
  const [editTicketCustomerId, setEditTicketCustomerId] = useState('')
  const [editTicketType, setEditTicketType] = useState<TicketType>('individual')
  const [editTicketTotalPrice, setEditTicketTotalPrice] = useState('')
  const [editTicketStatus, setEditTicketStatus] = useState<TicketStatus>('confirmed')
  const [editTournamentFormat, setEditTournamentFormat] = useState<TournamentFormat>('pool_to_final')
  const [editTournamentBestOf, setEditTournamentBestOf] = useState<1 | 3 | 5>(1)
  const [editTournamentRoundsPerMatch, setEditTournamentRoundsPerMatch] = useState(1)
  const [editTournamentRequirePayment, setEditTournamentRequirePayment] = useState(false)
  const [editTournamentQualificationRule, setEditTournamentQualificationRule] = useState<QualificationRule>('top_1')
  const [editTournamentCustomQualifiers, setEditTournamentCustomQualifiers] = useState(2)
  const [editTournamentThirdPlace, setEditTournamentThirdPlace] = useState(true)
  const [editTournamentFirstPrize, setEditTournamentFirstPrize] = useState('')
  const [editTournamentSecondPrize, setEditTournamentSecondPrize] = useState('')
  const [editTournamentThirdPrize, setEditTournamentThirdPrize] = useState('')
  const [isUpdatingSession, setIsUpdatingSession] = useState(false)
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
  const [tournamentPoolSize, setTournamentPoolSize] = useState(4)
  const [tournamentEditorEmail, setTournamentEditorEmail] = useState('')
  const [tournamentEditorResults, setTournamentEditorResults] = useState<Profile[]>([])
  const [busyTournamentId, setBusyTournamentId] = useState('')
  const [drawerTouchStart, setDrawerTouchStart] = useState<number | null>(null)
  const [checkInTarget, setCheckInTarget] = useState<{ sessionId: string; participantId: string } | null>(null)
  const [checkInPaymentSplits, setCheckInPaymentSplits] = useState<ParticipantPaymentSplitDraft[]>(() => [newParticipantPaymentSplit('cash')])
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialSelectedPlayerId)
  const [selectedPlayerSessionId, setSelectedPlayerSessionId] = useState(initialSelectedPlayerSessionId)
  const [selectedPlayerStatsOverride, setSelectedPlayerStatsOverride] = useState<LeaderboardPlayer | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [highlightedSessionId, setHighlightedSessionId] = useState('')
  const [profileUpcomingExpanded, setProfileUpcomingExpanded] = useState(false)
  const [profilePastExpanded, setProfilePastExpanded] = useState(false)
  const [profileInvitesExpanded, setProfileInvitesExpanded] = useState(false)
  const [invitePopupInviteId, setInvitePopupInviteId] = useState('')
  const [inviteModalSessionId, setInviteModalSessionId] = useState('')
  const [inviteSearch, setInviteSearch] = useState('')
  const [birthdayPopupOpen, setBirthdayPopupOpen] = useState(false)
  const [tariffPaymentOpen, setTariffPaymentOpen] = useState(false)
  const [anonymousConfirmOpen, setAnonymousConfirmOpen] = useState(false)
  const [isSavingAnonymousMode, setIsSavingAnonymousMode] = useState(false)
  const [sessionTimeScope, setSessionTimeScope] = useState<SessionTimeScope>('upcoming')
  const [hasMoreUpcomingSessions, setHasMoreUpcomingSessions] = useState(true)
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false)
  const [isLoadingPastSessions, setIsLoadingPastSessions] = useState(false)
  const [confirmedGameDrafts, setConfirmedGameDrafts] = useState<Record<string, string>>({})
  const [announcementDrafts, setAnnouncementDrafts] = useState<Record<string, string>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [clubPublicMessageDrafts, setClubPublicMessageDrafts] = useState<Record<string, string>>({})
  const [clubAdminMessageDrafts, setClubAdminMessageDrafts] = useState<Record<string, string>>({})
  const [profileScoreAdjustments, setProfileScoreAdjustments] = useState<Record<string, number>>({})
  const [busyInviteKey, setBusyInviteKey] = useState('')
  const [busyFriendId, setBusyFriendId] = useState('')
  const [busyMessageKey, setBusyMessageKey] = useState('')
  const [championLoginOpen, setChampionLoginOpen] = useState(false)
  const [language, setLanguage] = useState<LanguageCode>(() => externalLanguage ?? getInitialLanguage())
  const [text, setText] = useState<TranslationMap>(() => initialText ?? getFallbackTranslation())
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const dayStripRef = useRef<HTMLDivElement | null>(null)
  const clubSearchShellRef = useRef<HTMLDivElement | null>(null)
  const captchaContainerRef = useRef<HTMLDivElement | null>(null)
  const captchaWidgetId = useRef<string | null>(null)
  const passkeyButtonRef = useRef<HTMLButtonElement | null>(null)
  const warmedSupabaseClientRef = useRef<Awaited<ReturnType<typeof getSupabase>> | null>(null)
  const notifiedReminderKeys = useRef<Set<string>>(new Set())
  const clubsLoadedRef = useRef(false)
  const clubsLoadedForUserIdRef = useRef<string | null>(null)
  const clubsLoadingRef = useRef(false)
  const loadedClubMessagesRef = useRef<Set<string>>(new Set())
  const tournamentDataLoadedRef = useRef(false)
  const tournamentDataLoadingRef = useRef(false)
  const networkDataLoadedRef = useRef(false)
  const networkDataLoadingRef = useRef(false)
  const allProfilesLoadedRef = useRef(false)
  const allProfilesLoadingRef = useRef(false)
  const selectedPlayerIdRef = useRef(initialSelectedPlayerId)
  const selectedPlayerStatsFetchedRef = useRef<Set<string>>(new Set())
  const selectedPlayerStatsLoadingRef = useRef<Set<string>>(new Set())
  const currentUserShareStatsLoadingRef = useRef(false)
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
  const leaderboardLoadedRef = useRef(false)
  const leaderboardLoadingRef = useRef(false)
  const leaderboardLoadedCountRef = useRef(0)
  const leaderboardQueryRef = useRef<LeaderboardQuery>(initialLeaderboardQuery())
  const leaderboardSearchReloadTimeoutRef = useRef<number | null>(null)
  const highlightedSessionTimeoutRef = useRef<number | null>(null)
  const sessionsLoadedRef = useRef(false)
  const upcomingSessionsThroughRef = useRef('')
  const loadingSessionRangeRef = useRef(false)
  const ticketAvailabilitySearchLoadingRef = useRef(false)
  const pastSessionsLoadedRef = useRef(false)
  const pastSessionsLoadingRef = useRef(false)
  const ensureClubsLoadedRef = useRef(ensureClubsLoaded)
  const ensureLeaderboardLoadedRef = useRef(ensureLeaderboardLoaded)
  const ensureNetworkDataLoadedRef = useRef(ensureNetworkDataLoaded)
  const ensurePastSessionsLoadedRef = useRef(ensurePastSessionsLoaded)
  const ensureSessionsLoadedRef = useRef(ensureSessionsLoaded)
  const ensureTournamentDataLoadedRef = useRef(ensureTournamentDataLoaded)
  const ensureUpcomingSessionsThroughDateRef = useRef(ensureUpcomingSessionsThroughDate)
  const loadClubMessagesRef = useRef(loadClubMessages)
  const loadClubsRef = useRef(loadClubs)
  const loadExpandedSessionDetailsRef = useRef(loadExpandedSessionDetails)
  const loadExpandedSessionMessagesRef = useRef(loadExpandedSessionMessages)
  const loadLeaderboardPlayersRef = useRef(loadLeaderboardPlayers)
  const loadMoreUpcomingSessionsRef = useRef(loadMoreUpcomingSessions)
  const loadNetworkDataRef = useRef(loadNetworkData)
  const loadProfileRef = useRef(loadProfile)
  const profileAuthLoadSeqRef = useRef(0)
  const loadSessionDetailRef = useRef(loadSessionDetail)
  const loadSessionMessagesRef = useRef(loadSessionMessages)
  const loadTournamentDataRef = useRef(loadTournamentData)
  const notifyInviteRef = useRef(notifyInvite)
  const notifySessionRef = useRef(notifySession)
  const preparePasswordRecoveryFromUrlRef = useRef(preparePasswordRecoveryFromUrl)
  const refreshLeaderboardIfLoadedRef = useRef(refreshLeaderboardIfLoaded)
  const refreshSessionsIfLoadedRef = useRef(refreshSessionsIfLoaded)
  const syncProfileEverywhereRef = useRef(syncProfileEverywhere)
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
    createSessionMode,
    handleCreateSessionModeChange,
    moveCalendarWeek,
    openCreateSessionCalendar,
    startSessionFromCalendar,
  } = useCreateSessionCalendar({
    addDaysToDateValue,
    getLocalDateString: localDateString,
    loadCalendarRange: (startDate, endDate) => loadSessionRange(startDate, endDate, 'merge', {
      includeBlockedTimes: true,
      updateUpcomingPagination: false,
    }),
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
    { value: 'projectiles', label: text.projectilesCriterion },
    { value: 'gamesPlayed', label: text.gamesPlayedCriterion },
    { value: 'escapeTime', label: text.escapeSpeedrunCriterion },
  ]
  const showProfileFields = Boolean(profile)
  const activeAgeBand = ageBandFromBirthday(profileBirthday || profile?.birthday || null)
  const isUnder13Profile = activeAgeBand === 'under13'
  const isTeenMinorProfile = activeAgeBand === 'minor'
  const isAdultProfile = activeAgeBand === 'adult'
  const sessionIdsKey = useMemo(() => sessions.map((session) => session.id).join('|'), [sessions])

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
        'get_leaderboard_players_page',
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
  }, [text.player])

  function openPlayerProfile(profileId: string, sessionId = '', seedStats?: LeaderboardPlayer) {
    selectedPlayerIdRef.current = profileId
    setSelectedPlayerId(profileId)
    setSelectedPlayerSessionId(sessionId)
    setSelectedPlayerStatsOverride((current) => seedStats ?? (current?.profileId === profileId ? current : null))
    if (sessionId) void loadSessionDetail(sessionId)
    else void loadSelectedPlayerStats(profileId, true)
  }

  function openStaffPlayerProfile(staffProfile: StaffProfile) {
    openPlayerProfile(staffProfile.id, '', leaderboardPlayerFromStaffProfile(staffProfile, text.player))
  }

  function closePlayerProfile() {
    selectedPlayerIdRef.current = ''
    setSelectedPlayerId('')
    setSelectedPlayerSessionId('')
    setSelectedPlayerStatsOverride(null)
    setChallengeTargetId('')
    setChallengeStatus('')
  }

  function updateAvatarColor(value: string) {
    const normalized = cleanHexColor(value, avatarColor)
    setAvatarColor(normalized)
    setAvatarColorDraft(normalized)
  }

  function updateAvatarColorDraft(value: string) {
    setAvatarColorDraft(value)
    if (isHexColor(value)) setAvatarColor(value.toLowerCase())
  }

  function updateAvatarTextColor(value: string) {
    const normalized = cleanHexColor(value, avatarTextColor)
    setAvatarTextColor(normalized)
    setAvatarTextColorDraft(normalized)
  }

  function updateAvatarTextColorDraft(value: string) {
    setAvatarTextColorDraft(value)
    if (isHexColor(value)) setAvatarTextColor(value.toLowerCase())
  }

  function updateClubThemeColor(value: string) {
    const normalized = cleanHexColor(value, clubEditThemeColor)
    setClubEditThemeColor(normalized)
    setClubEditThemeColorDraft(normalized)
  }

  function updateClubThemeColorDraft(value: string) {
    setClubEditThemeColorDraft(value)
    if (isHexColor(value)) setClubEditThemeColor(value.toLowerCase())
  }

  function chooseAvatarMode(mode: 'photo' | 'emoji' | 'initials') {
    setAvatarMode(mode)
    if (mode !== 'photo') {
      setAvatarFile(null)
      setAvatarPreview('')
    }
  }

  function rememberFailedAvatarUrl(source: string | null | undefined) {
    const normalizedSource = source?.trim()
    if (!normalizedSource || normalizedSource.startsWith('blob:') || normalizedSource.startsWith('data:')) return
    setFailedAvatarUrls((current) => {
      if (current.has(normalizedSource)) return current
      return new Set([...current, normalizedSource])
    })
  }

  function avatarNode(source: {
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    display_name?: string | null
    full_name?: string | null
    nickname?: string | null
  } | null | undefined, fallback = 'Player') {
    return (
      <AvatarNode
        failedAvatarUrls={failedAvatarUrls}
        fallback={fallback}
        onFailedAvatarUrl={rememberFailedAvatarUrl}
        source={source}
      />
    )
  }

  function avatarStyle(source: { avatar_color?: string | null; avatar_text_color?: string | null } | null | undefined) {
    if (!source?.avatar_color && !source?.avatar_text_color) return undefined

    return {
      ...(source.avatar_color ? { background: source.avatar_color } : {}),
      ...(source.avatar_text_color ? { color: source.avatar_text_color } : {}),
    }
  }

  function avatarFields(source: Profile) {
    if (source.anonymous_mode) {
      return {
        avatar_url: null,
        avatar_emoji: ANONYMOUS_MASK_EMOJI,
        avatar_initials: null,
        avatar_color: ANONYMOUS_MASK_COLOR,
        avatar_text_color: ANONYMOUS_MASK_TEXT_COLOR,
        profile_motto: null,
      }
    }

    return {
      avatar_url: source.avatar_url || null,
      avatar_emoji: source.avatar_emoji || null,
      avatar_initials: source.avatar_initials || null,
      avatar_color: source.avatar_color || null,
      avatar_text_color: source.avatar_text_color || null,
      profile_motto: source.profile_motto || null,
    }
  }

  function profileAvatarSnapshot(source: Profile) {
    return {
      display_name: displayName(source),
      ...avatarFields(source),
    }
  }

  function mergeCurrentUserAvatar<T extends {
    profile_id: string
    display_name?: string | null
    avatar_url?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_color?: string | null
    avatar_text_color?: string | null
    profile_motto?: string | null
  }>(item: T, snapshot: ReturnType<typeof profileAvatarSnapshot>, profileId: string): T {
    return item.profile_id === profileId
      ? {
        ...item,
        ...snapshot,
      }
      : item
  }

  function syncProfileEverywhere(updatedProfile: Profile) {
    const nextProfileSnapshot = profileAvatarSnapshot(updatedProfile)

    setSessions((currentSessions) =>
      currentSessions.map((session) => ({
        ...session,
        session_participants: session.session_participants?.map((participant) =>
          mergeCurrentUserAvatar(participant, nextProfileSnapshot, updatedProfile.id)
        ),
        session_waitlist: session.session_waitlist?.map((entry) =>
          mergeCurrentUserAvatar(entry, nextProfileSnapshot, updatedProfile.id)
        ),
      }))
    )

    setClubs((currentClubs) =>
      currentClubs.map((club) => ({
        ...club,
        club_members: clubMembers(club).map((member) =>
          mergeCurrentUserAvatar(member, nextProfileSnapshot, updatedProfile.id)
        ),
      }))
    )

    setTournamentData((currentData) => ({
      ...currentData,
      editors: currentData.editors.map((editor) =>
        mergeCurrentUserAvatar(editor, nextProfileSnapshot, updatedProfile.id)
      ),
    }))

    setAllProfiles((currentProfiles) => {
      const nextProfiles = currentProfiles.map((item) => (item.id === updatedProfile.id ? { ...item, ...updatedProfile } : item))
      return nextProfiles.some((item) => item.id === updatedProfile.id) ? nextProfiles : [...nextProfiles, updatedProfile]
    })

    setLeaderboardPlayers((currentPlayers) =>
      currentPlayers.map((player) => player.profileId === updatedProfile.id
        ? (() => {
          const nextAvatar = avatarFields(updatedProfile)
          return {
            ...player,
            displayName: compactDisplayName(displayName(updatedProfile), text.player),
            avatarUrl: nextAvatar.avatar_url,
            avatarEmoji: nextAvatar.avatar_emoji,
            avatarInitials: nextAvatar.avatar_initials,
            avatarColor: nextAvatar.avatar_color,
            avatarTextColor: nextAvatar.avatar_text_color,
            profileMotto: updatedProfile.profile_motto || null,
          }
        })()
        : player
      )
    )
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
  }, [])

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

  function promptCreateAccount() {
    setLoginPromptOpen(false)
    const claimSource = pendingGuestTicketClaim || (ticketConfirmation?.guestPhone ? {
      phone: ticketConfirmation.guestPhone,
      reference: ticketConfirmation.reference,
      name: ticketConfirmation.guestName,
      date: ticketConfirmation.date,
    } : null)
    if (claimSource?.phone) {
      const phoneParts = splitPhoneNumber(claimSource.phone)
      setProfileCountryCode(phoneParts.countryInput || '+84')
      setProfilePhone(phoneParts.localPhone)
      if (claimSource.name) setProfileName(claimSource.name)
      if (claimSource.reference) setPendingGuestTicketClaim(claimSource)
    }
    updateAuthMode('create')
    setActiveView('profile')
  }

  function prefillProfileFromGuestTicketClaim(claimSource: { phone: string; reference?: string; name?: string; date?: string } | null) {
    if (!claimSource?.phone) return

    const phoneParts = splitPhoneNumber(claimSource.phone)
    setProfileCountryCode(phoneParts.countryInput || '+84')
    setProfilePhone(phoneParts.localPhone)
    if (claimSource.name) setProfileName(claimSource.name)
    if (claimSource.reference) {
      setPendingGuestTicketClaim({
        phone: claimSource.phone,
        reference: claimSource.reference,
        name: claimSource.name,
        date: claimSource.date,
      })
    }
  }

  function promptTicketLogin() {
    const claimSource = pendingGuestTicketClaim || (ticketConfirmation?.guestPhone ? {
      phone: ticketConfirmation.guestPhone,
      reference: ticketConfirmation.reference,
      name: ticketConfirmation.guestName,
      date: ticketConfirmation.date,
    } : null)

    setPendingTicketAuthAction(claimSource?.phone && claimSource.reference ? 'claim-after-auth' : 'book-after-login')
    prefillProfileFromGuestTicketClaim(claimSource)
    goToLogin()
  }

  function promptTicketCreateAccount() {
    const claimSource = pendingGuestTicketClaim || (ticketConfirmation?.guestPhone ? {
      phone: ticketConfirmation.guestPhone,
      reference: ticketConfirmation.reference,
      name: ticketConfirmation.guestName,
      date: ticketConfirmation.date,
    } : null)

    setPendingTicketAuthAction(claimSource?.phone && claimSource.reference ? 'claim-after-auth' : 'book-after-login')
    prefillProfileFromGuestTicketClaim(claimSource)
    setLoginPromptOpen(false)
    updateAuthMode('create')
    setActiveView('profile')
    setProfileStatus('')
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
    leaderboardQueryRef.current = nextQuery
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPlayers(nextQuery, 0, 'replace', userId)
  }

  function handleLeaderboardCriterionChange(criterion: LeaderboardCriterion) {
    reloadLeaderboard({
      ...leaderboardQueryRef.current,
      criterion,
    })
  }

  function handleLeaderboardSearchChange(searchValue: string) {
    const nextQuery = {
      ...leaderboardQueryRef.current,
      search: searchValue,
    }
    leaderboardQueryRef.current = nextQuery

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
    if (session.session_type === 'tournament') ensureTournamentDataLoaded()
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
      if (targetSession.session_type === 'tournament') ensureTournamentDataLoaded()
    }
    window.setTimeout(() => {
      document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  function openSessionFromCalendar(session: Session) {
    openSessionFromProfile(session.id)
  }

  function updateCaptchaToken(token: string) {
    captchaTokenRef.current = token
    setCaptchaToken(token)
  }

  function currentCaptchaToken() {
    const tokenFromState = captchaToken || captchaTokenRef.current
    if (tokenFromState) return tokenFromState

    const hcaptcha = getHCaptcha()
    const widgetId = captchaWidgetId.current || undefined
    const tokenFromWidget = hcaptcha?.getResponse?.(widgetId)

    if (tokenFromWidget) {
      updateCaptchaToken(tokenFromWidget)
      return tokenFromWidget
    }

    return ''
  }

  function resetCaptcha() {
    updateCaptchaToken('')

    const hcaptcha = getHCaptcha()

    if (hcaptcha && captchaWidgetId.current) {
      hcaptcha.reset(captchaWidgetId.current)
    }
  }

  function warmSupabaseClient() {
    void getSupabase().then((client) => {
      warmedSupabaseClientRef.current = client
    }).catch(() => {})
  }

  function focusPasskeyDocument() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return true

    window.focus()
    passkeyButtonRef.current?.focus({ preventScroll: true })

    return document.hasFocus()
  }

  async function restorePasskeyDocumentFocus() {
    if (focusPasskeyDocument()) return

    await new Promise<void>((resolve) => {
      let settled = false
      let timeoutId: number | null = null
      const settle = () => {
        if (settled) return
        settled = true
        if (timeoutId) window.clearTimeout(timeoutId)
        window.removeEventListener('focus', settle)
        document.removeEventListener('visibilitychange', settle)
        resolve()
      }

      window.addEventListener('focus', settle, { once: true })
      document.addEventListener('visibilitychange', settle, { once: true })
      timeoutId = window.setTimeout(settle, 800)
    })

    focusPasskeyDocument()
  }

  function updateAuthMode(nextMode: 'login' | 'create') {
    setAuthMode(nextMode)
    setAuthStep('email')
    setProfilePassword('')
    setProfileStatus('')
    resetCaptcha()
  }

  function continueAuthFromEmail() {
    const loginEmail = profileEmail.trim().toLowerCase()

    if (!loginEmail || !loginEmail.includes('@')) {
      setProfileStatus(text.emailRequired)
      return
    }

    setProfileEmail(loginEmail)
    setProfileStatus('')
    resetCaptcha()
    setAuthStep('credentials')
  }

  function editAuthEmail() {
    setAuthStep('email')
    setProfilePassword('')
    setProfileStatus('')
    resetCaptcha()
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

  function canReviewSessionMessages(session: Session) {
    return Boolean(userId && (session.owner_id === userId || isAdmin))
  }

  function canSeeSessionMessage(session: Session, message: SessionMessage) {
    const status = message.moderation_status || 'approved'
    if (status === 'approved') return true
    return Boolean(userId && (message.author_id === userId || canReviewSessionMessages(session)))
  }

  function sortSessionMessages(messages: SessionMessage[]) {
    return [...messages].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0
      const right = b.created_at ? new Date(b.created_at).getTime() : 0
      return left - right || a.id.localeCompare(b.id)
    })
  }

  function mergeSessionMessage(message: SessionMessage) {
    setSessionMessages((current) => sortSessionMessages([
      ...current.filter((item) => item.id !== message.id),
      message,
    ]))
  }

  function resetSessionMessageState() {
    sessionMessagesLoadedRef.current.clear()
    sessionMessagesLoadingRef.current.clear()
    setSessionMessages([])
    setSessionMessagePages({})
  }

  function updateSessionMessagePage(sessionId: string, patch: Partial<SessionMessagePageState>) {
    setSessionMessagePages((current) => ({
      ...current,
      [sessionId]: {
        ...(current[sessionId] ?? {
          loaded: false,
          loading: false,
          hasMore: false,
          oldestCreatedAt: null,
        }),
        ...patch,
      },
    }))
  }

  function messagesForSession(session: Session) {
    return sortSessionMessages(sessionMessages
      .filter((message) => message.session_id === session.id && canSeeSessionMessage(session, message))
    )
  }

  function sortClubMessages(messages: ClubMessage[]) {
    return [...messages].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0
      const right = b.created_at ? new Date(b.created_at).getTime() : 0
      return left - right || a.id.localeCompare(b.id)
    })
  }

  function mergeClubMessage(message: ClubMessage) {
    setClubMessages((current) => sortClubMessages([
      ...current.filter((item) => item.id !== message.id),
      message,
    ]))
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
      if (existing?.loading || (existing?.changed && existing.translatedText)) return current
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

  function canUseClubMessages(club: Club | undefined) {
    if (!club || !userId) return false
    return canManageClub(club) || club.owner_id === userId || approvedClubMember(club)
  }

  function canSeeClubAdminMessage(club: Club, message: ClubMessage) {
    return message.message_type === 'public' || message.author_id === userId || canManageClub(club)
  }

  function messagesForClub(club: Club, messageType: ClubMessage['message_type']) {
    return sortClubMessages(clubMessages.filter((message) => (
      message.club_id === club.id
      && message.message_type === messageType
      && canSeeClubAdminMessage(club, message)
    )))
  }

  function previousPlayersForSession(session: Session) {
    const currentIds = new Set((session.session_participants ?? []).map((participant) => participant.profile_id))
    const people = new Map<string, ReturnType<typeof socialAvatarFields> & { profile_id: string }>()

    sessions.forEach((pastSession) => {
      if (!isPastSession(pastSession)) return
      const playedWithMe = (pastSession.session_participants ?? []).some((participant) => participant.profile_id === userId)
      if (!playedWithMe) return

      ;(pastSession.session_participants ?? []).forEach((participant) => {
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

  function notifySession(session: Session, message: string) {
    notifyBookingSession(session, message, language)
  }

  function notifyInvite(session: Session) {
    notifyBookingInvite(session, invitationReceivedText, language)
  }

  async function enablePushReminders() {
    if (!requireProfile()) return false
    if (!VAPID_PUBLIC_KEY) {
      setPushReminderStatus(text.pushMissingConfig)
      return false
    }
    if (!canUseWebPush()) {
      setPushReminderStatus(text.pushUnsupported)
      return false
    }

    setIsEnablingPush(true)
    setPushReminderStatus('')

    try {
      const hasPermission = await requestBrowserReminderPermission()
      if (!hasPermission) {
        setPushReminderStatus(text.pushPermissionDenied)
        setIsEnablingPush(false)
        return false
      }

      const registration = await registerReminderServiceWorker()
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      const serialized = subscription.toJSON()
      const keys = serialized.keys || {}
      if (!keys.p256dh || !keys.auth) {
        setPushReminderStatus(text.pushSaveError)
        setIsEnablingPush(false)
        return false
      }

      const { error } = await (await getSupabase())
        .from('push_subscriptions')
        .upsert({
          profile_id: userId,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: navigator.userAgent,
          disabled_at: null,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' })

      if (error) {
        setPushReminderStatus(error.message)
        setIsEnablingPush(false)
        return false
      }

      setIsPushSubscribed(true)
      setPushReminderStatus(text.pushEnabled)
      setIsEnablingPush(false)
      return true
    } catch (error) {
      setPushReminderStatus(error instanceof Error ? error.message : text.pushSaveError)
      setIsEnablingPush(false)
      return false
    }
  }

  function downloadSessionCalendar(session: Session) {
    downloadSessionCalendarFile(session)
  }

  async function prepareJoinedSessionReminders(session: Session) {
    downloadSessionCalendar(session)
    const hasPermission = await enablePushReminders()
    if (hasPermission) notifySession(session, text.reminderJoined)
  }

  async function loadProfile(options: { skipMfaChallenge?: boolean; showAuthLoading?: boolean } = {}) {
    const shouldShowAuthLoading = options.showAuthLoading ?? isProfileAuthLoading
    const authLoadSeq = shouldShowAuthLoading ? profileAuthLoadSeqRef.current + 1 : profileAuthLoadSeqRef.current
    if (shouldShowAuthLoading) {
      profileAuthLoadSeqRef.current = authLoadSeq
      setIsProfileAuthLoading(true)
    }

    try {
      authDebug('loadProfile:start')
      const { data: userData, error: userError } = await (await getSupabase()).auth.getUser()
      const authUser = userData.user
      authDebug('loadProfile:getUser', {
        error: userError,
        user: authUser ? {
          id: authUser.id,
          email: authUser.email,
          emailConfirmedAt: authUser.email_confirmed_at,
          lastSignInAt: authUser.last_sign_in_at,
          appMetadata: authUser.app_metadata,
          userMetadata: authUser.user_metadata,
        } : null,
      })

      if (userError) {
        setUserId('')
        setAuthEmail('')
        setProfile(null)
        if (/auth session missing/i.test(userError.message)) {
          setProfileStatus('')
          return null
        }
        setProfileStatus(userError.message)
        return null
      }

      if (!authUser) {
        setUserId('')
        setAuthEmail('')
        setProfile(null)
        return null
      }

      setUserId(authUser.id)
      setAuthEmail(authUser.email?.toLowerCase() || '')

      if (!options.skipMfaChallenge) {
        const needsMfa = await prepareMfaChallengeIfNeeded()
        if (needsMfa) {
          setProfile(null)
          return null
        }
      }

      await refreshMfaFactors()

      const { data: profileRow, error: profileError, status: profileStatusCode } = await (await getSupabase())
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', authUser.id)
        .is('deleted_at', null)
        .maybeSingle()

      authDebug('loadProfile:profileQuery', {
        status: profileStatusCode,
        error: profileError,
        profile: profileRow,
        role: profileRow?.role,
        isAdminEmail: isAdminEmail(authUser.email),
      })

      if (profileError) {
        setProfileStatus(profileError.message)
        return null
      }

      if (profileRow) {
        const profileInitials = validAvatarInitials(profileRow.avatar_initials)
        const phoneParts = splitPhoneNumber(profileRow.phone || '')
        setProfile(profileRow)
        setProfileCountryCode(phoneParts.countryInput)
        setProfilePhone(phoneParts.localPhone)
        setProfileName(profileRow.full_name || '')
        setProfileMotto(limitMotto(profileRow.profile_motto || ''))
        setProfileNickname(limitDisplayName(profileRow.nickname || ''))
        setProfileEmail(profileRow.email || '')
        setProfileBirthday(profileRow.birthday || '')
        setProfileGender(normalizeProfileGender(profileRow.gender))
        setMarketingConsent(profileRow.marketing_consent !== false)
        setAvatarMode(profileRow.avatar_url ? 'photo' : profileRow.avatar_emoji ? 'emoji' : profileInitials ? 'initials' : 'photo')
        setAvatarEmoji(profileRow.avatar_emoji || '😎')
        setAvatarInitials(profileInitials)
        setAvatarColor(profileRow.avatar_color || avatarColors[0])
        setAvatarColorDraft(profileRow.avatar_color || avatarColors[0])
        setAvatarTextColor(profileRow.avatar_text_color || avatarTextColors[0])
        setAvatarTextColorDraft(profileRow.avatar_text_color || avatarTextColors[0])
        return profileRow
      }

      const email = authUser.email?.toLowerCase() || ''
      const fullName = (
        typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name :
          typeof authUser.user_metadata?.name === 'string' ? authUser.user_metadata.name :
            typeof authUser.user_metadata?.display_name === 'string' ? authUser.user_metadata.display_name :
              ''
      )
      const nickname = typeof authUser.user_metadata?.nickname === 'string' ? limitDisplayName(authUser.user_metadata.nickname) : ''
      const profileMottoValue = typeof authUser.user_metadata?.profile_motto === 'string' ? limitMotto(authUser.user_metadata.profile_motto) : ''
      const birthdayValue = typeof authUser.user_metadata?.birthday === 'string' ? authUser.user_metadata.birthday : ''
      const genderValue = ageBandFromBirthday(birthdayValue) === 'under13' ? '' : normalizeProfileGender(authUser.user_metadata?.gender)
      const personalDataConsentValue = authUser.user_metadata?.personal_data_consent === true
      const phone = typeof authUser.user_metadata?.phone === 'string' ? authUser.user_metadata.phone : ''
      const metadataAvatarUrl = (
        typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url :
          typeof authUser.user_metadata?.picture === 'string' ? authUser.user_metadata.picture :
            ''
      )
      const metadataInitials = validAvatarInitials(typeof authUser.user_metadata?.avatar_initials === 'string' ? authUser.user_metadata.avatar_initials : '')
      const fallbackProfile: Profile = {
        id: authUser.id,
        phone,
        full_name: fullName || null,
        nickname: nickname || null,
        email,
        birthday: birthdayValue || null,
        gender: genderValue || null,
        avatar_url: metadataAvatarUrl || null,
        avatar_emoji: typeof authUser.user_metadata?.avatar_emoji === 'string' ? authUser.user_metadata.avatar_emoji : null,
        avatar_initials: metadataInitials || null,
        avatar_color: typeof authUser.user_metadata?.avatar_color === 'string' ? authUser.user_metadata.avatar_color : null,
        avatar_text_color: typeof authUser.user_metadata?.avatar_text_color === 'string' ? authUser.user_metadata.avatar_text_color : null,
        profile_motto: profileMottoValue || null,
        role: defaultRoleForEmail(email),
        anonymous_mode: Boolean(authUser.user_metadata?.anonymous_mode),
        anonymous_callsign: typeof authUser.user_metadata?.anonymous_callsign === 'string' ? authUser.user_metadata.anonymous_callsign : null,
        marketing_consent: authUser.user_metadata?.marketing_consent === false ? false : true,
        marketing_consent_at: typeof authUser.user_metadata?.marketing_consent_at === 'string' ? authUser.user_metadata.marketing_consent_at : null,
        marketing_opted_out_at: typeof authUser.user_metadata?.marketing_opted_out_at === 'string' ? authUser.user_metadata.marketing_opted_out_at : null,
        personal_data_consent: personalDataConsentValue,
        personal_data_consent_at: typeof authUser.user_metadata?.personal_data_consent_at === 'string' ? authUser.user_metadata.personal_data_consent_at : null,
        privacy_policy_url: typeof authUser.user_metadata?.privacy_policy_url === 'string' ? authUser.user_metadata.privacy_policy_url : null,
        terms_conditions_url: typeof authUser.user_metadata?.terms_conditions_url === 'string' ? authUser.user_metadata.terms_conditions_url : null,
        consent_waiver_url: typeof authUser.user_metadata?.consent_waiver_url === 'string' ? authUser.user_metadata.consent_waiver_url : null,
        legal_consent_version: typeof authUser.user_metadata?.legal_consent_version === 'string' ? authUser.user_metadata.legal_consent_version : null,
      }

      authDebug('loadProfile:missingProfileFallback', fallbackProfile)
      setProfile(fallbackProfile)
      setProfileCountryCode('+84')
      setProfilePhone(phone.replace(/^\+?84/, ''))
      setProfileName(fullName)
      setProfileMotto(profileMottoValue)
      setProfileNickname(nickname)
      setProfileEmail(email)
      setProfileBirthday(birthdayValue)
      setProfileGender(genderValue)
      setMarketingConsent(fallbackProfile.marketing_consent !== false)
      setAvatarMode(fallbackProfile.avatar_url ? 'photo' : fallbackProfile.avatar_emoji ? 'emoji' : metadataInitials ? 'initials' : 'photo')
      setAvatarEmoji(fallbackProfile.avatar_emoji || '😎')
      setAvatarInitials(metadataInitials)
      setAvatarColor(fallbackProfile.avatar_color || avatarColors[0])
      setAvatarColorDraft(fallbackProfile.avatar_color || avatarColors[0])
      setAvatarTextColor(fallbackProfile.avatar_text_color || avatarTextColors[0])
      setAvatarTextColorDraft(fallbackProfile.avatar_text_color || avatarTextColors[0])

      const repairResult = await (await getSupabase()).from('profiles').insert({
        id: authUser.id,
        phone: phone || null,
        full_name: fullName || null,
        nickname: nickname || null,
        email,
        birthday: fallbackProfile.birthday,
        gender: fallbackProfile.gender,
        avatar_url: fallbackProfile.avatar_url,
        avatar_emoji: fallbackProfile.avatar_emoji,
        avatar_initials: fallbackProfile.avatar_initials,
        avatar_color: fallbackProfile.avatar_color,
        avatar_text_color: fallbackProfile.avatar_text_color,
        profile_motto: fallbackProfile.profile_motto,
        anonymous_mode: fallbackProfile.anonymous_mode || false,
        anonymous_callsign: fallbackProfile.anonymous_callsign || null,
        marketing_consent: fallbackProfile.marketing_consent !== false,
        marketing_consent_at: fallbackProfile.marketing_consent_at || new Date().toISOString(),
        marketing_opted_out_at: fallbackProfile.marketing_opted_out_at || null,
        personal_data_consent: fallbackProfile.personal_data_consent || false,
        personal_data_consent_at: fallbackProfile.personal_data_consent_at || null,
        privacy_policy_url: fallbackProfile.privacy_policy_url || null,
        terms_conditions_url: fallbackProfile.terms_conditions_url || null,
        consent_waiver_url: fallbackProfile.consent_waiver_url || null,
        legal_consent_version: fallbackProfile.legal_consent_version || null,
        updated_at: new Date().toISOString(),
      })

      authDebug('loadProfile:profileRepairUpsert', repairResult)
      return fallbackProfile
    } catch (error) {
      authDebug('loadProfile:thrown', error)
      setProfileStatus(error instanceof Error ? error.message : String(error))
      return null
    } finally {
      if (shouldShowAuthLoading && profileAuthLoadSeqRef.current === authLoadSeq) {
        setIsProfileAuthLoading(false)
      }
    }
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

  async function handleAuth() {
    try {
      if (!profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'email') {
        continueAuthFromEmail()
        return
      }

      const localPhone = profilePhone.replace(/\D/g, '')
      const loginEmail = profileEmail.trim().toLowerCase()
      const fullName = profileName.trim()

      authDebug('handleAuth:attempt', {
        mode: authMode,
        email: loginEmail,
        isAdminEmail: isAdminEmail(loginEmail),
        hasCaptcha: Boolean(currentCaptchaToken()),
        localPhoneLength: localPhone.length,
        hasFullName: Boolean(fullName),
      })

      if (!loginEmail || !loginEmail.includes('@')) {
        setProfileStatus(text.emailRequired)
        return
      }

      if (profilePassword.length < 6) {
        setProfileStatus(text.passwordRequired)
        return
      }

      const signupAgeBand = ageBandFromBirthday(profileBirthday)

      if (authMode === 'create' && signupAgeBand === 'unknown') {
        setProfileStatus(text.birthdayRequired)
        return
      }

      if (authMode === 'create' && signupAgeBand === 'adult' && !personalDataConsent) {
        setProfileStatus(text.consentRequired)
        return
      }

      const captchaTokenForAuth = authMode === 'create' || authMode === 'login' ? currentCaptchaToken() : ''

      if ((authMode === 'create' || authMode === 'login') && !captchaTokenForAuth) {
        setProfileStatus(text.captchaRequired)
        return
      }

      setIsSavingProfile(true)
      setProfileStatus(authMode === 'login' ? text.loggingIn : text.creating)

      const nickname = limitDisplayName(profileNickname.trim())
      const display = nickname || compactDisplayName(fullName || loginEmail.split('@')[0])
      const consentAt = new Date().toISOString()
      const countryCode = resolveCountryCode(profileCountryCode)
      const normalizedProfilePhone = localPhone ? `${countryCode}${localPhone}` : ''
      const legalConsentAccepted = authMode === 'create' && signupAgeBand === 'adult' && personalDataConsent

      if (authMode === 'create') {
        const signUpResult = await (await getSupabase()).auth.signUp({
          email: loginEmail,
          password: profilePassword,
          options: {
            data: {
              display_name: display,
              full_name: fullName || display,
              name: display,
              phone: normalizedProfilePhone || null,
              birthday: profileBirthday || null,
              gender: signupAgeBand === 'under13' ? null : profileGender || null,
              marketing_consent: marketingConsent,
              marketing_consent_at: marketingConsent ? consentAt : null,
              marketing_opted_out_at: marketingConsent ? null : consentAt,
              personal_data_consent: legalConsentAccepted,
              personal_data_consent_at: legalConsentAccepted ? consentAt : null,
              privacy_policy_url: PRIVACY_POLICY_URL,
              terms_conditions_url: TERMS_CONDITIONS_URL,
              consent_waiver_url: CONSENT_WAIVER_URL,
              legal_consent_version: LEGAL_CONSENT_VERSION,
            },
            captchaToken: captchaTokenForAuth,
          },
        })

        authDebug('handleAuth:signUpResponse', {
          error: signUpResult.error,
          hasSession: Boolean(signUpResult.data.session),
          user: signUpResult.data.user ? {
            id: signUpResult.data.user.id,
            email: signUpResult.data.user.email,
            emailConfirmedAt: signUpResult.data.user.email_confirmed_at,
            appMetadata: signUpResult.data.user.app_metadata,
            userMetadata: signUpResult.data.user.user_metadata,
          } : null,
        })

        resetCaptcha()

        if (signUpResult.error) {
          setProfileStatus(signUpResult.error.message)
          setIsSavingProfile(false)
          return
        }

        if (!signUpResult.data.user) {
          setProfileStatus(text.loginRequired)
          setAuthMode('login')
          setAuthStep('credentials')
          setIsSavingProfile(false)
          return
        }

        setUserId(signUpResult.data.user.id)
        setPersonalDataConsent(false)
        setProfilePassword('')
        const loadedProfile = await loadProfile()
        const completedTicketAuth = await completePendingTicketAuth(loadedProfile)
        if (!completedTicketAuth) {
          setProfileStatus(text.accountCreated)
          setActiveView('profile')
        }
        setIsSavingProfile(false)
        return
      }

      authDebug('handleAuth:signInWithPassword:start', {
        email: loginEmail,
        isAdminEmail: isAdminEmail(loginEmail),
      })

      const signInResult = await (await getSupabase()).auth.signInWithPassword({
        email: loginEmail,
        password: profilePassword,
        options: {
          captchaToken: captchaTokenForAuth,
        },
      })

      authDebug('handleAuth:signInWithPassword:response', {
        error: signInResult.error,
        hasSession: Boolean(signInResult.data.session),
        user: signInResult.data.user ? {
          id: signInResult.data.user.id,
          email: signInResult.data.user.email,
          emailConfirmedAt: signInResult.data.user.email_confirmed_at,
          lastSignInAt: signInResult.data.user.last_sign_in_at,
          appMetadata: signInResult.data.user.app_metadata,
          userMetadata: signInResult.data.user.user_metadata,
        } : null,
      })

      resetCaptcha()

      if (signInResult.error) {
        setProfileStatus(signInResult.error.message)
        setIsSavingProfile(false)
        return
      }

      if (!signInResult.data.user) {
        setProfileStatus(text.loginRequired)
        setAuthMode('login')
        setAuthStep('credentials')
        setIsSavingProfile(false)
        return
      }

      setUserId(signInResult.data.user.id)
      setProfilePassword('')
      const needsMfa = await prepareMfaChallengeIfNeeded()
      if (needsMfa) {
        setIsSavingProfile(false)
        return
      }
      const loadedProfile = await loadProfile()
      const completedTicketAuth = await completePendingTicketAuth(loadedProfile)
      if (!completedTicketAuth) {
        setProfileStatus('')
        setActiveView('leaderboard')
      }
      setIsSavingProfile(false)
    } catch (error) {
      authDebug('handleAuth:thrown', error)
      resetCaptcha()
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsSavingProfile(false)
    }
  }

  async function logout() {
    await (await getSupabase()).auth.signOut()
    setUserId('')
    setAuthEmail('')
    setProfile(null)
    setProfilePassword('')
    setAuthStep('email')
    setNewPassword('')
    setIsRecoveryMode(false)
    setMfaFactors([])
    setMfaEnrollment(null)
    setMfaChallenge(null)
    setMfaChallengeCode('')
    setMfaVerifyCode('')
    setMfaRequired(false)
    setMfaStatus('')
    setProfileStatus(text.loggedOut)
  }

  function isDocumentFocusPasskeyError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || '')
    return message.toLowerCase().includes('document is not focused')
  }

  async function signInWithPasskey() {
    if (!passkeysAvailable()) {
      setProfileStatus(text.passkeyUnavailable)
      return
    }

    try {
      setIsPasskeyLoading(true)
      setProfileStatus(text.passkeyStarting)
      await restorePasskeyDocumentFocus()

      const client = warmedSupabaseClientRef.current || await getSupabase()
      warmedSupabaseClientRef.current = client
      let { data, error } = await client.auth.signInWithPasskey()

      if (error && isDocumentFocusPasskeyError(error)) {
        await restorePasskeyDocumentFocus()
        const retryResult = await client.auth.signInWithPasskey()
        data = retryResult.data
        error = retryResult.error
      }

      if (error) {
        setProfileStatus(error.message)
        setIsPasskeyLoading(false)
        return
      }

      if (!data) {
        setProfileStatus(text.passkeyUnavailable)
        setIsPasskeyLoading(false)
        return
      }

      const nextUserId = data.user?.id || data.session?.user.id || ''
      if (nextUserId) setUserId(nextUserId)
      const needsMfa = await prepareMfaChallengeIfNeeded()
      if (needsMfa) {
        setIsPasskeyLoading(false)
        return
      }
      const loadedProfile = await loadProfile()
      const completedTicketAuth = await completePendingTicketAuth(loadedProfile)
      if (!completedTicketAuth) {
        setProfileStatus('')
        setActiveView('leaderboard')
      }
      setIsPasskeyLoading(false)
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsPasskeyLoading(false)
    }
  }

  async function registerPasskey() {
    if (!profile) return

    if (!passkeysAvailable()) {
      setProfileStatus(text.passkeyUnavailable)
      return
    }

    try {
      setIsPasskeyLoading(true)
      setProfileStatus(text.passkeyStarting)
      const { error } = await (await getSupabase()).auth.registerPasskey()

      if (error) {
        setProfileStatus(error.message)
        setIsPasskeyLoading(false)
        return
      }

      setProfileStatus(text.passkeyAdded)
      setIsPasskeyLoading(false)
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsPasskeyLoading(false)
    }
  }

  async function refreshMfaFactors() {
    const { data, error } = await (await getSupabase()).auth.mfa.listFactors()

    if (error) {
      setMfaStatus(error.message)
      return []
    }

    const factors = (data?.totp ?? [])
      .filter((factor) => Boolean(factor?.id))
      .map((factor) => ({
        id: factor.id,
        friendly_name: factor.friendly_name,
        factor_type: factor.factor_type,
        status: factor.status,
        created_at: factor.created_at,
        updated_at: factor.updated_at,
      }))
    setMfaFactors(factors)
    return factors
  }

  async function prepareMfaChallengeIfNeeded() {
    if (mfaChallenge) return true

    const assurance = await (await getSupabase()).auth.mfa.getAuthenticatorAssuranceLevel()

    if (assurance.error) {
      setMfaStatus(assurance.error.message)
      return false
    }

    if (assurance.data?.currentLevel === 'aal1' && assurance.data.nextLevel === 'aal2') {
      const factors = await refreshMfaFactors()
      const factor = factors.find((item) => item.status === 'verified') || factors[0]

      if (!factor) {
        setMfaStatus(text.mfaChallengeError)
        setProfileStatus(text.mfaChallengeError)
        return false
      }

      const challenge = await (await getSupabase()).auth.mfa.challenge({ factorId: factor.id })

      if (challenge.error || !challenge.data) {
        setMfaStatus(challenge.error?.message || text.mfaChallengeError)
        setProfileStatus(challenge.error?.message || text.mfaChallengeError)
        return true
      }

      setMfaChallenge({ factorId: factor.id, challengeId: challenge.data.id })
      setMfaChallengeCode('')
      setMfaRequired(true)
      setActiveView('profile')
      setProfileStatus(text.mfaRequired)
      return true
    }

    setMfaChallenge(null)
    setMfaRequired(false)
    return false
  }

  async function verifyMfaChallenge() {
    if (!mfaChallenge || !mfaChallengeCode.trim()) {
      setProfileStatus(text.mfaCodeRequired)
      return
    }

    setIsMfaLoading(true)
    const { data, error } = await (await getSupabase()).auth.mfa.verify({
      factorId: mfaChallenge.factorId,
      challengeId: mfaChallenge.challengeId,
      code: mfaChallengeCode.trim(),
    })

    if (error) {
      setProfileStatus(error.message)
      setIsMfaLoading(false)
      return
    }

    setMfaChallenge(null)
    setMfaChallengeCode('')
    setMfaRequired(false)
    if (data?.user) {
      setUserId(data.user.id)
      setAuthEmail(data.user.email?.toLowerCase() || '')
    }
    setProfileStatus('')
    await refreshMfaFactors()
    await loadProfile({ skipMfaChallenge: true })
    setActiveView('leaderboard')
    setIsMfaLoading(false)
  }

  async function beginTotpEnrollment() {
    if (!profile) return

    setIsMfaLoading(true)
    setMfaStatus('')
    setMfaVerifyCode('')
    const { data, error } = await (await getSupabase()).auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'VRena',
      issuer: 'VRena',
    })

    if (error || !data) {
      setMfaStatus(error?.message || text.mfaEnrollError)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment({
      id: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    })
    setIsMfaLoading(false)
  }

  async function confirmTotpEnrollment() {
    if (!mfaEnrollment || !mfaVerifyCode.trim()) {
      setMfaStatus(text.mfaCodeRequired)
      return
    }

    setIsMfaLoading(true)
    setMfaStatus('')
    const challenge = await (await getSupabase()).auth.mfa.challenge({ factorId: mfaEnrollment.id })

    if (challenge.error || !challenge.data) {
      setMfaStatus(challenge.error?.message || text.mfaVerifyError)
      setIsMfaLoading(false)
      return
    }

    const { error } = await (await getSupabase()).auth.mfa.verify({
      factorId: mfaEnrollment.id,
      challengeId: challenge.data.id,
      code: mfaVerifyCode.trim(),
    })

    if (error) {
      setMfaStatus(error.message)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment(null)
    setMfaVerifyCode('')
    setMfaStatus(text.mfaEnabled)
    await refreshMfaFactors()
    setIsMfaLoading(false)
  }

  async function removeTotpFactor(factorId: string) {
    if (typeof window !== 'undefined' && !window.confirm(text.mfaDisableConfirm)) return

    setIsMfaLoading(true)
    setMfaStatus('')
    const { error } = await (await getSupabase()).auth.mfa.unenroll({ factorId })

    if (error) {
      setMfaStatus(error.message)
      setIsMfaLoading(false)
      return
    }

    setMfaEnrollment(null)
    setMfaVerifyCode('')
    setMfaStatus(text.mfaDisabled)
    await refreshMfaFactors()
    setIsMfaLoading(false)
  }

  async function signInWithGoogle() {
    try {
      setIsOAuthLoading(true)
      setProfileStatus(text.loggingIn)
      const { error } = await (await getSupabase()).auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appRedirectUrl(),
        },
      })

      if (error) {
        setProfileStatus(error.message)
        setIsOAuthLoading(false)
      }
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : String(error))
      setIsOAuthLoading(false)
    }
  }

  async function sendPasswordReset() {
    const email = (profile?.email || profileEmail).trim().toLowerCase()

    if (!email || !email.includes('@')) {
      setProfileStatus(text.resetPasswordEmailRequired)
      return
    }

    const captchaTokenForReset = profile ? '' : currentCaptchaToken()

    if (!profile && !captchaTokenForReset) {
      setProfileStatus(text.captchaRequired)
      return
    }

    setIsResettingPassword(true)
    const redirectTo = appRedirectUrl()
    const supabase = await getSupabase()
    const { data: sessionData } = await supabase.auth.getSession()
    const response = await fetch('/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify({
        email,
        redirectTo,
        captchaToken: captchaTokenForReset || undefined,
      }),
    })
    const resetResult = (await response.json().catch(() => ({}))) as { error?: string }

    resetCaptcha()

    if (!response.ok) {
      setProfileStatus(resetResult.error || 'Could not send password reset email.')
      setIsResettingPassword(false)
      return
    }

    setProfileStatus(text.resetPasswordSent)
    setIsResettingPassword(false)
  }

  async function preparePasswordRecoveryFromUrl() {
    const recoveryParams = passwordRecoveryUrlParams()
    if (!recoveryParams) return null

    setActiveView('profile')
    setAuthMode('login')
    setAuthStep('email')

    if (recoveryParams.errorDescription) {
      setIsRecoveryMode(false)
      setProfileStatus(recoveryParams.errorDescription)
      cleanPasswordRecoveryUrl()
      return false
    }

    const client = await getSupabase()

    if (recoveryParams.accessToken && recoveryParams.refreshToken) {
      const { error } = await client.auth.setSession({
        access_token: recoveryParams.accessToken,
        refresh_token: recoveryParams.refreshToken,
      })

      if (error) {
        setIsRecoveryMode(false)
        setProfileStatus(error.message)
        cleanPasswordRecoveryUrl()
        return false
      }
    } else if (recoveryParams.code) {
      const { error } = await client.auth.exchangeCodeForSession(recoveryParams.code)

      if (error) {
        setIsRecoveryMode(false)
        setProfileStatus(error.message)
        cleanPasswordRecoveryUrl()
        return false
      }
    } else if (!recoveryParams.code) {
      setIsRecoveryMode(false)
      setProfileStatus(text.resetPasswordSessionRequired)
      cleanPasswordRecoveryUrl()
      return false
    }

    const { data, error } = await client.auth.getSession()
    cleanPasswordRecoveryUrl()

    if (error || !data.session) {
      setIsRecoveryMode(false)
      setProfileStatus(!data.session ? text.resetPasswordSessionRequired : error?.message || text.resetPasswordSessionRequired)
      return false
    }

    setUserId(data.session.user.id)
    setProfileEmail(data.session.user.email || profileEmail)
    setIsRecoveryMode(true)
    setProfileStatus(text.resetPasswordReady)
    return true
  }

  async function updatePasswordFromRecovery() {
    if (newPassword.length < 6) {
      setProfileStatus(text.passwordRequired)
      return
    }

    setIsResettingPassword(true)
    const client = await getSupabase()
    const { data: sessionData, error: sessionError } = await client.auth.getSession()

    if (sessionError || !sessionData.session) {
      setProfileStatus(!sessionData.session ? text.resetPasswordSessionRequired : sessionError?.message || text.resetPasswordSessionRequired)
      setIsResettingPassword(false)
      return
    }

    const { error } = await client.auth.updateUser({ password: newPassword })

    if (error) {
      setProfileStatus(error.message)
      setIsResettingPassword(false)
      return
    }

    setNewPassword('')
    setIsRecoveryMode(false)
    setProfileStatus(text.passwordUpdated)
    await loadProfile()
    setIsResettingPassword(false)
  }

  async function fetchLeaderboardRows(query: LeaderboardQuery, offset: number, limit: number, profileId = '') {
    const { data, error } = await (await getSupabase()).rpc(
      'get_leaderboard_players_page',
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

      leaderboardLoadedRef.current = true
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
        leaderboardLoadedRef.current = false
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

  async function loadSessionDetail(sessionId: string, options: { force?: boolean } = {}) {
    if (!sessionId) return null
    if (!options.force && sessionDetailsLoadedRef.current.has(sessionId)) {
      return sessions.find((session) => session.id === sessionId) ?? null
    }
    if (sessionDetailsLoadingRef.current.has(sessionId)) return null

    sessionDetailsLoadingRef.current.add(sessionId)
    setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: true }))

    const client = await getSupabase()
    const rpcDetailResult = await client.rpc('session_detail', { p_session_id: sessionId })

    if (!rpcDetailResult.error && rpcDetailResult.data) {
      const { session: detailSession, invites: inviteRows, scoreAdjustments } = sessionDetailFromRpcPayload(rpcDetailResult.data)

      if (detailSession) {
        setSessions((currentSessions) => {
          const sessionsById = new Map(currentSessions.map((session) => [session.id, session]))
          sessionsById.set(sessionId, detailSession)
          return sortSessionsByStart(Array.from(sessionsById.values()))
        })
        setSessionInvites((current) => [
          ...current.filter((invite) => invite.session_id !== sessionId),
          ...inviteRows,
        ])
        if (Object.keys(scoreAdjustments).length > 0) {
          setProfileScoreAdjustments((current) => ({
            ...current,
            ...scoreAdjustments,
          }))
        }

        sessionDetailsLoadedRef.current.add(sessionId)
        sessionDetailsLoadingRef.current.delete(sessionId)
        setLoadedSessionDetailIds((current) => ({ ...current, [sessionId]: true }))
        setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
        return detailSession
      }
    }

    let detailResult = await client
      .from('sessions')
      .select(SESSION_SELECT)
      .eq('id', sessionId)
      .is('deleted_at', null)
      .is('session_participants.deleted_at', null)
      .neq('status', 'cancelled')
      .single()

    if (optionalSessionMetadataMissing(detailResult.error)) {
      detailResult = await client
        .from('sessions')
        .select(SESSION_SELECT_BASE)
        .eq('id', sessionId)
        .is('deleted_at', null)
        .is('session_participants.deleted_at', null)
        .neq('status', 'cancelled')
        .single()
    }

    if (detailResult.error || !detailResult.data) {
      setCreateStatus(detailResult.error?.message || text.noMatchingSessions)
      sessionDetailsLoadingRef.current.delete(sessionId)
      setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
      return null
    }

    const detailSession = normalizeSessionRow(detailResult.data as Session)
    const participantIds = Array.from(new Set((detailSession.session_participants ?? []).map((participant) => participant.profile_id)))

    const [waitlistResult, invitesResult, adjustmentResult] = await Promise.all([
      client
        .from('session_waitlist')
        .select(WAITLIST_SELECT)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      userId
        ? client
          .from('session_invites')
          .select('id, session_id, inviter_id, recipient_id, recipient_display_name, recipient_avatar_url, recipient_avatar_emoji, recipient_avatar_initials, recipient_avatar_color, recipient_avatar_text_color, recipient_profile_motto, status, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      participantIds.length > 0
        ? client
          .from('profiles')
          .select('id, score_adjustment')
          .is('deleted_at', null)
          .in('id', participantIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const waitlistRows = waitlistResult.error ? [] : (waitlistResult.data ?? []) as WaitlistEntry[]
    const inviteRows = invitesResult.error ? [] : (invitesResult.data ?? []) as SessionInvite[]
    const adjustmentRows = adjustmentResult.error ? [] : (adjustmentResult.data ?? []) as Array<Pick<Profile, 'id' | 'score_adjustment'>>

    const hydratedDetailSession = {
      ...detailSession,
      session_waitlist: waitlistRows,
    }

    setSessions((currentSessions) => {
      const sessionsById = new Map(currentSessions.map((session) => [session.id, session]))
      sessionsById.set(sessionId, hydratedDetailSession)
      return sortSessionsByStart(Array.from(sessionsById.values()))
    })
    if (!invitesResult.error) {
      setSessionInvites((current) => [
        ...current.filter((invite) => invite.session_id !== sessionId),
        ...inviteRows,
      ])
    }
    if (adjustmentRows.length > 0) {
      setProfileScoreAdjustments((current) => ({
        ...current,
        ...Object.fromEntries(adjustmentRows.map((row) => {
          const adjustment = Number(row.score_adjustment ?? 0)
          return [row.id, Number.isFinite(adjustment) ? adjustment : 0]
        })),
      }))
    }

    sessionDetailsLoadedRef.current.add(sessionId)
    sessionDetailsLoadingRef.current.delete(sessionId)
    setLoadedSessionDetailIds((current) => ({ ...current, [sessionId]: true }))
    setLoadingSessionDetailIds((current) => ({ ...current, [sessionId]: false }))
    return hydratedDetailSession
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

  async function loadSessionMessages(
    sessionId: string,
    options: { force?: boolean; before?: string | null } = {}
  ) {
    if (!sessionId || !userId) return

    const before = options.before ?? null
    const isInitialPage = !before
    if (isInitialPage && !options.force && sessionMessagesLoadedRef.current.has(sessionId)) return
    if (sessionMessagesLoadingRef.current.has(sessionId)) return

    sessionMessagesLoadingRef.current.add(sessionId)
    updateSessionMessagePage(sessionId, { loading: true })

    const client = await getSupabase()
    let messageQuery = client
      .from('session_messages')
      .select(SESSION_MESSAGE_SELECT)
      .eq('session_id', sessionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(SESSION_MESSAGE_PAGE_SIZE + 1)

    if (before) {
      messageQuery = messageQuery.lt('created_at', before)
    }

    const { data, error } = await messageQuery

    sessionMessagesLoadingRef.current.delete(sessionId)

    if (error) {
      setCreateStatus(error.message)
      updateSessionMessagePage(sessionId, { loading: false })
      return
    }

    const rows = ((data ?? []) as SessionMessage[]).slice(0, SESSION_MESSAGE_PAGE_SIZE)
    const sortedRows = sortSessionMessages(rows)
    const oldestCreatedAt = sortedRows[0]?.created_at ?? before ?? null
    const hasMore = ((data ?? []) as SessionMessage[]).length > SESSION_MESSAGE_PAGE_SIZE

    setSessionMessages((current) => {
      const otherSessions = current.filter((message) => message.session_id !== sessionId)
      const retainedSessionMessages = before
        ? current.filter((message) => message.session_id === sessionId)
        : []
      const messagesById = new Map(retainedSessionMessages.map((message) => [message.id, message]))
      sortedRows.forEach((message) => messagesById.set(message.id, message))
      return sortSessionMessages([...otherSessions, ...Array.from(messagesById.values())])
    })

    sessionMessagesLoadedRef.current.add(sessionId)
    updateSessionMessagePage(sessionId, {
      loaded: true,
      loading: false,
      hasMore,
      oldestCreatedAt,
    })
  }

  async function loadSessionRows(startDate?: string, endDate?: string, includeBlockedTimes = false) {
    const client = await getSupabase()
    const rpcResult = await client.rpc('sessions_list_page', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: 500,
      p_offset: 0,
      p_include_blocked_times: includeBlockedTimes,
    })

    if (!rpcResult.error && rpcResult.data) {
      return sessionPageFromRpcPayload(rpcResult.data)
    }

    let sessionQuery = client
      .from('sessions')
      .select(SESSION_CARD_SELECT)
      .is('deleted_at', null)
      .is('session_participants.deleted_at', null)
      .neq('status', 'cancelled')

    if (startDate) sessionQuery = sessionQuery.gte('date', startDate)
    if (endDate) sessionQuery = sessionQuery.lte('date', endDate)

    const sessionResult = await sessionQuery
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    let sessionRowsData: unknown[] | null = sessionResult.data as unknown[] | null
    let sessionError = sessionResult.error

    if (optionalSessionMetadataMissing(sessionResult.error)) {
      let fallbackSessionQuery = client
        .from('sessions')
        .select(SESSION_CARD_SELECT_BASE)
        .is('deleted_at', null)
        .is('session_participants.deleted_at', null)
        .neq('status', 'cancelled')

      if (startDate) fallbackSessionQuery = fallbackSessionQuery.gte('date', startDate)
      if (endDate) fallbackSessionQuery = fallbackSessionQuery.lte('date', endDate)

      const fallbackSessionResult = await fallbackSessionQuery
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      sessionRowsData = fallbackSessionResult.data
      sessionError = fallbackSessionResult.error
    }

    if (sessionError) {
      setCreateStatus(sessionError.message)
      return null
    }

    return {
      sessions: ((sessionRowsData ?? []) as Session[]).map(normalizeSessionRow),
      scoreAdjustments: {},
      blockedTimes: [],
      hasMoreAfter: null,
      source: 'select',
    } satisfies SessionListPageResult
  }

  async function hasFutureSessionsAfter(dateValue: string) {
    const { data, error } = await (await getSupabase())
      .from('sessions')
      .select('id')
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .gt('date', dateValue)
      .limit(1)

    if (error) return true
    return (data ?? []).length > 0
  }

  async function loadSessionRange(
    startDate: string | undefined,
    endDate: string | undefined,
    mode: 'replace-upcoming' | 'replace-past' | 'merge',
    options: { includeBlockedTimes?: boolean; updateUpcomingPagination?: boolean } = {}
  ) {
    if (loadingSessionRangeRef.current) return false

    loadingSessionRangeRef.current = true
    const sessionPage = await loadSessionRows(startDate, endDate, Boolean(options.includeBlockedTimes))

    if (!sessionPage) {
      loadingSessionRangeRef.current = false
      return false
    }

    const sessionRows = sessionPage.sessions
    const sessionIds = sessionRows.map((session) => session.id)
    const profileIds = Array.from(new Set(sessionRows.flatMap((session) => (session.session_participants ?? []).map((participant) => participant.profile_id))))
    const client = await getSupabase()
    const needsSupplementalListData = sessionPage.source !== 'rpc'
    const [waitlistResult, adjustmentResult] = needsSupplementalListData ? await Promise.all([
      sessionIds.length > 0
        ? client
        .from('session_waitlist')
        .select(WAITLIST_POSITION_SELECT)
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      profileIds.length > 0
        ? client
        .from('profiles')
        .select('id, score_adjustment')
        .is('deleted_at', null)
        .in('id', profileIds)
        : Promise.resolve({ data: [], error: null }),
    ]) : [
      { data: [], error: null },
      { data: [], error: null },
    ]

    const waitlistRows = needsSupplementalListData
      ? waitlistResult.error ? [] : (waitlistResult.data ?? []) as WaitlistEntry[]
      : sessionRows.flatMap((session) => session.session_waitlist ?? [])
    const adjustmentRows = adjustmentResult.error ? [] : (adjustmentResult.data ?? [])
    const scoreAdjustments = needsSupplementalListData ? Object.fromEntries(adjustmentRows.map((row) => {
      const adjustment = Number((row as Pick<Profile, 'score_adjustment'>).score_adjustment ?? 0)
      return [(row as Pick<Profile, 'id'>).id, Number.isFinite(adjustment) ? adjustment : 0]
    })) : sessionPage.scoreAdjustments

    if (Object.keys(scoreAdjustments).length > 0) {
      setProfileScoreAdjustments((current) => ({
        ...current,
        ...scoreAdjustments,
      }))
    }
    const hydratedSessions = sessionRows.map((session) => ({
      ...session,
      session_waitlist: waitlistRows.filter((entry) => entry.session_id === session.id),
    }))
    hydratedSessions.forEach((session) => {
      sessionDetailsLoadedRef.current.delete(session.id)
    })

    sessionsLoadedRef.current = true
    setSessions((currentSessions) => {
      const retainedSessions = mode === 'replace-upcoming'
        ? currentSessions.filter((session) => isPastSession(session))
        : mode === 'replace-past'
          ? currentSessions.filter((session) => isUpcomingSession(session))
          : currentSessions
      const sessionsById = new Map(retainedSessions.map((session) => [session.id, session]))
      hydratedSessions.forEach((session) => sessionsById.set(session.id, session))
      return sortSessionsByStart(Array.from(sessionsById.values()))
    })
    loadExpandedSessionDetails()

    if (options.includeBlockedTimes) {
      if (sessionPage.source === 'rpc') {
        setBlockedTimes(sessionPage.blockedTimes)
      } else {
        const blockedResult = await client.from('blocked_times').select('date, start_time, end_time, arenas_used')
        setBlockedTimes((blockedResult.data ?? []) as BlockedTime[])
      }
    }

    if (options.updateUpcomingPagination !== false && endDate && endDate >= localDateString()) {
      setHasMoreUpcomingSessions(typeof sessionPage.hasMoreAfter === 'boolean'
        ? sessionPage.hasMoreAfter
        : await hasFutureSessionsAfter(endDate))
    }

    loadingSessionRangeRef.current = false
    return true
  }

  async function loadSessions(options: { focusDate?: string } = {}) {
    const today = localDateString()
    const defaultEndDate = addDaysToDateValue(today, SESSION_LOAD_BATCH_DAYS - 1)
    const focusEndDate = options.focusDate && options.focusDate >= today ? upcomingBatchEndForDate(options.focusDate) : ''
    const nextEndDate = maxDateValue(defaultEndDate, upcomingSessionsThroughRef.current, focusEndDate)

    const previousEndDate = upcomingSessionsThroughRef.current
    upcomingSessionsThroughRef.current = nextEndDate
    const loaded = await loadSessionRange(today, nextEndDate, 'replace-upcoming', { includeBlockedTimes: true })
    if (!loaded) upcomingSessionsThroughRef.current = previousEndDate
  }

  async function loadMoreUpcomingSessions() {
    if (isLoadingMoreSessions || loadingSessionRangeRef.current || !hasMoreUpcomingSessions) return

    const today = localDateString()
    const currentEndDate = upcomingSessionsThroughRef.current || addDaysToDateValue(today, SESSION_LOAD_BATCH_DAYS - 1)
    const nextStartDate = addDaysToDateValue(currentEndDate, 1)
    const nextEndDate = addDaysToDateValue(nextStartDate, SESSION_LOAD_BATCH_DAYS - 1)

    setIsLoadingMoreSessions(true)
    const previousEndDate = upcomingSessionsThroughRef.current
    upcomingSessionsThroughRef.current = nextEndDate
    const loaded = await loadSessionRange(nextStartDate, nextEndDate, 'merge')
    if (!loaded) upcomingSessionsThroughRef.current = previousEndDate
    setIsLoadingMoreSessions(false)
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

  async function loadClubs() {
    clubsLoadingRef.current = true
    const client = await getSupabase()
    const clubsPageResult = await client.rpc('clubs_list_page')
    let data = Array.isArray(clubsPageResult.data)
      ? (clubsPageResult.data as ClubListPageRow[]).map(normalizeClubListPageRow)
      : null
    let error = clubsPageResult.error
    const publicResult = await client
      .from('clubs')
      .select(CLUB_PUBLIC_SELECT)
      .order('created_at', { ascending: false })

    if (!userId) {
      const publicClubs = publicResult.error ? [] : (publicResult.data ?? []) as Club[]
      const loadedClubs = mergeClubRecords(data ?? [], publicClubs.map((club) => ({ ...club, club_members: [] })))

      if (error && publicResult.error && loadedClubs.length === 0) {
        setClubStatus(error.message || publicResult.error.message)
        clubsLoadingRef.current = false
        return
      }

      clubsLoadedRef.current = true
      clubsLoadedForUserIdRef.current = ''
      clubsLoadingRef.current = false
      setClubs(loadedClubs)
      return
    }

    if (error || !data) {
      const result = await client
        .from('clubs')
        .select(CLUB_LIST_WITH_MEMBERS_SELECT)
        .order('created_at', { ascending: false })
      data = result.data as Club[] | null
      error = result.error

      if (error) {
        const fallbackResult = await client
          .from('clubs')
          .select(CLUB_LIST_WITH_MEMBERS_SELECT_BASE)
          .order('created_at', { ascending: false })
        data = fallbackResult.data as Club[] | null
        error = fallbackResult.error
      }

      if (error) {
        const fallbackResult = await client
          .from('clubs')
          .select(CLUB_LIST_SELECT)
          .order('created_at', { ascending: false })
        data = fallbackResult.data as Club[] | null
        error = fallbackResult.error
      }

      if (error) {
        const fallbackResult = await client
          .from('clubs')
          .select(CLUB_LIST_SELECT_BASE)
          .order('created_at', { ascending: false })
        data = fallbackResult.data as Club[] | null
        error = fallbackResult.error
      }
    }

    const publicClubs = publicResult.error ? [] : (publicResult.data ?? []) as Club[]
    const loadedClubs = mergeClubRecords(data ?? [], publicClubs)

    if (error && publicClubs.length === 0) {
      setClubStatus(error.message)
      clubsLoadingRef.current = false
      return
    }

    const clubIds = loadedClubs.map((club) => club.id)
    const membershipsByClubId = new Map<string, ClubMember[]>()
    loadedClubs.forEach((club) => {
      const members = clubMembers(club)
      if (members.length > 0) membershipsByClubId.set(club.id, members)
    })
    if (clubIds.length > 0) {
      const membersResult = await client
        .from('club_members')
        .select(CLUB_MEMBER_SELECT)
        .in('club_id', clubIds)
        .is('deleted_at', null)

      let membersData = membersResult.data as ClubMember[] | null
      let membersError = membersResult.error

      if (membersError) {
        const fallbackMembersResult = await client
          .from('club_members')
          .select(CLUB_MEMBER_SELECT_BASE)
          .in('club_id', clubIds)
          .is('deleted_at', null)

        membersData = fallbackMembersResult.data as ClubMember[] | null
        membersError = fallbackMembersResult.error
      }

      if (!membersError) {
        const visibleMembers = membersData ?? []
        visibleMembers.forEach((member) => {
          const members = membershipsByClubId.get(member.club_id) ?? []
          if (!members.some((existingMember) => existingMember.id === member.id)) members.push(member)
          membershipsByClubId.set(member.club_id, members)
        })
      }
    }

    let currentUserMemberships: ClubMember[] = []
    if (userId) {
      const membershipResult = await client
        .from('club_members')
        .select(CLUB_MEMBER_SELECT)
        .eq('profile_id', userId)
        .is('deleted_at', null)

      let membershipData = membershipResult.data as ClubMember[] | null
      let membershipError = membershipResult.error

      if (membershipError) {
        const fallbackMembershipResult = await client
          .from('club_members')
          .select(CLUB_MEMBER_SELECT_BASE)
          .eq('profile_id', userId)
          .is('deleted_at', null)

        membershipData = fallbackMembershipResult.data as ClubMember[] | null
        membershipError = fallbackMembershipResult.error
      }

      if (!membershipError) {
        currentUserMemberships = membershipData ?? []
      }
    }

    clubsLoadedRef.current = true
    clubsLoadedForUserIdRef.current = userId
    clubsLoadingRef.current = false
    setClubs(loadedClubs.map((club) => mergeCurrentUserClubMembership({
      ...club,
      club_members: membershipsByClubId.get(club.id) ?? [],
    }, currentUserMemberships)))
  }

  async function loadClubMessages(club: Club, force = false) {
    if (!canUseClubMessages(club)) return
    if (!force && loadedClubMessagesRef.current.has(club.id)) return

    setIsLoadingClubMessages(true)
    const { data, error } = await (await getSupabase())
      .from('club_messages')
      .select(CLUB_MESSAGE_SELECT)
      .eq('club_id', club.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(CLUB_MESSAGE_LIMIT)

    setIsLoadingClubMessages(false)

    if (error) {
      setClubMessageStatus(error.message)
      return
    }

    const rows = sortClubMessages((data ?? []) as ClubMessage[])
    loadedClubMessagesRef.current.add(club.id)
    setClubMessages((current) => [
      ...current.filter((message) => message.club_id !== club.id),
      ...rows,
    ])
  }

  async function loadTournamentData() {
    tournamentDataLoadingRef.current = true
    const [editorsResult, poolsResult, entriesResult, matchesResult, auditResult] = await Promise.all([
      (await getSupabase()).from('tournament_editors').select('id, session_id, profile_id, display_name, avatar_url, avatar_emoji, avatar_initials, avatar_color, avatar_text_color, profile_motto'),
      (await getSupabase()).from('tournament_pools').select('id, session_id, name, sort_order').is('deleted_at', null).order('sort_order', { ascending: true }),
      (await getSupabase()).from('tournament_pool_entries').select('id, session_id, pool_id, participant_id, profile_id, seed, team_label').is('deleted_at', null),
      (await getSupabase())
        .from('tournament_matches')
        .select('id, session_id, pool_id, stage, round, match_number, participant_a_id, participant_b_id, score_a, score_b, wins_a, wins_b, winner_participant_id, loser_participant_id, status, arena_number, queue_position, best_of')
        .is('deleted_at', null)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true }),
      (await getSupabase())
        .from('tournament_audit_log')
        .select('id, session_id, user_id, action, old_value, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(80),
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
          ;((invitedSessionsResult.data ?? []) as Session[]).map(normalizeSessionRow).forEach((session) => sessionsById.set(session.id, session))
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
    } catch {}

    onActiveViewChange?.(activeView)
  }, [activeView, onActiveViewChange])

  useEffect(() => {
    onProfileChange?.(profile)
  }, [profile, onProfileChange])

  useEffect(() => {
    if (!profile || !userId) return
    if (currentUserShareStats?.profileId === userId) return

    return scheduleDeferredWork(() => {
      void hydrateCurrentUserShareStats(userId)
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
  }, [])

  useEffect(() => {
    if (activeView === 'clubs' || activeView === 'create' || activeView === 'leaderboard') {
      ensureClubsLoadedRef.current()
    }

    if (activeView === 'leaderboard') {
      const nextQuery = initialLeaderboardQuery()
      leaderboardQueryRef.current = nextQuery
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
  }, [activeView, userId])

  useEffect(() => {
    if (sessionTimeScope === 'past') {
      void ensurePastSessionsLoadedRef.current()
    }
  }, [sessionTimeScope])

  useEffect(() => () => {
    if (leaderboardSearchReloadTimeoutRef.current) window.clearTimeout(leaderboardSearchReloadTimeoutRef.current)
    if (highlightedSessionTimeoutRef.current) window.clearTimeout(highlightedSessionTimeoutRef.current)
  }, [])

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
  }, [userId])

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
  }, [])

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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
          queueRealtimeRefreshRef.current(['profile', 'sessions', 'leaderboard', 'clubs', 'tournament'])
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
    const shouldShowCaptcha = authMode === 'reset' || ((authMode === 'create' || authMode === 'login') && authStep === 'credentials')

    if (typeof window === 'undefined' || profile || activeView !== 'profile' || !shouldShowCaptcha) return

    let cancelled = false

    ensureHCaptcha().then((hcaptcha) => {
      if (cancelled || !captchaContainerRef.current || !hcaptcha || captchaWidgetId.current) return

      captchaWidgetId.current = hcaptcha.render(captchaContainerRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: (token) => updateCaptchaToken(token),
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
  }, [activeView, authMode, authStep, profile])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (profile || isRecoveryMode || activeView !== 'profile' || authMode !== 'login') return

    warmSupabaseClient()
  }, [activeView, authMode, isRecoveryMode, profile])

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
  }, [clubSearch, isClubSearchOpen, isSearchOpen, search, selectedSessionDate])

  const getAvailableTimeOptions = useCallback((date: string, duration: number, arenaCount: number, excludeSessionId = '') => {
    if (!date) return []

    const now = new Date()
    const today = localDateString(now)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    const options: Array<{ value: string; label: string; remaining: number }> = []
    const latestStart = CLOSE_MINUTES - duration

    for (let start = OPEN_MINUTES; start <= latestStart; start += TIME_STEP_MINUTES) {
      const end = start + duration

      if (date === today && start <= nowMinutes) continue

      const activeSessionArenas = sessions
        .filter((session) => session.status === 'open' && session.date === date && session.id !== excludeSessionId)
        .filter((session) =>
          rangesOverlap(
            start,
            end,
            timeToMinutes(session.start_time),
            timeToMinutes(session.start_time) + session.duration_minutes
          )
        )
        .reduce((total, session) => total + arenasUsedBySession(session), 0)

      const activeBlockedArenas = blockedTimes
        .filter((blocked) => blocked.date === date)
        .filter((blocked) =>
          rangesOverlap(start, end, timeToMinutes(blocked.start_time), timeToMinutes(blocked.end_time))
        )
        .reduce((total, blocked) => total + blocked.arenas_used, 0)

      const remaining = ARENA_COUNT - activeSessionArenas - activeBlockedArenas

      if (remaining >= arenaCount) {
        options.push({
          value: minutesToTime(start),
          label: `${minutesToTime(start)}-${minutesToTime(end)} (${remaining} ${remaining > 1 ? text.arenasAvailable : text.arenaAvailable})`,
          remaining,
        })
      }
    }

    return options
  }, [blockedTimes, sessions, text.arenaAvailable, text.arenasAvailable])

  const timeOptions = useMemo(() => {
    return getAvailableTimeOptions(sessionDate, sessionDuration, sessionArenaCount)
  }, [getAvailableTimeOptions, sessionArenaCount, sessionDate, sessionDuration])

  const editTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(editSessionDate, editSessionDuration, editSessionArenaCount, editingSessionId)
  }, [editSessionArenaCount, editSessionDate, editSessionDuration, editingSessionId, getAvailableTimeOptions])

  const activeTicketService = selectedTicketService(ticketType)
  const activeTicketDuration = Math.min(ticketMaxCustomerDurationMinutes, Math.max(ticketPriceBlockMinutes, ticketDuration))
  const activeTicketArenaCount = ticketArenaCountForPlayers()
  const ticketTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(ticketDate, activeTicketDuration, activeTicketArenaCount)
  }, [activeTicketArenaCount, activeTicketDuration, getAvailableTimeOptions, ticketDate])
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
  }, [activeView, ticketTime, ticketTimeOptions])
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
      const candidateOptions = getAvailableTimeOptions(candidateDate, activeTicketDuration, activeTicketArenaCount)
      if (candidateOptions.length > 0) return candidateDate
    }

    return ''
  }, [
    activeTicketArenaCount,
    activeTicketDuration,
    getAvailableTimeOptions,
    ticketDate,
    ticketAvailabilitySearchTick,
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
  }, [
    activeView,
    nextTicketDateWithAvailability,
    ticketAvailabilitySearchTick,
    ticketDate,
    ticketNextAvailableSearchEndDate,
    ticketTimeOptions.length,
  ])
  const challengeTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(challengeDate, challengeDuration, 1)
  }, [challengeDate, challengeDuration, getAvailableTimeOptions])
  const currentTicketPricing = ticketPricingSummary(ticketType, ticketDate, ticketTime, ticketPlayers, activeTicketDuration)
  const currentTicketUnitPrice = currentTicketPricing.unitPrice
  const isSpecialTicketType = ticketType !== 'individual'
  const ticketVoucherDiscountAmount = Math.max(0, Math.floor(Number(ticketDiscountQuote?.discount_amount ?? 0) || 0))
  const ticketAutomaticDiscountAmount = Math.max(0, Math.floor(Number(ticketAutomaticDiscountQuote?.discount_amount ?? 0) || 0))
  const ticketBuiltInDiscountAmount = Math.max(0, Math.floor(Number(currentTicketPricing.discountAmount ?? 0) || 0))
  const hasTicketVoucherDiscount = !isSpecialTicketType && ticketVoucherDiscountAmount > 0 && ticketDiscountCode.trim().length > 0
  const activeTicketAutomaticDiscountAmount = Math.max(ticketBuiltInDiscountAmount, ticketAutomaticDiscountAmount)
  const activeTicketDiscountAmount = isSpecialTicketType ? 0 : Math.max(activeTicketAutomaticDiscountAmount, ticketVoucherDiscountAmount)
  const activeTicketDiscountSource: 'automatic' | 'voucher' = ticketVoucherDiscountAmount > activeTicketAutomaticDiscountAmount ? 'voucher' : 'automatic'
  const currentTicketPriceBeforeLoyalty = isSpecialTicketType ? 0 : Math.max(0, currentTicketPricing.grossPrice - activeTicketDiscountAmount)
  const ticketLoyaltyBalance = Math.max(
    0,
    Math.floor(Number(ticketLoyaltyRedemption?.loyalty_points_total ?? profile?.loyalty_points_total ?? 0) || 0)
  )
  const ticketLoyaltyRedeemValue = Math.max(0, Math.floor(Number(ticketLoyaltyRedemption?.redeem_value_vnd_per_point ?? 0) || 0))
  const canUseTicketLoyaltyPoints = !isSpecialTicketType && !hasTicketVoucherDiscount
  const requestedTicketLoyaltyPoints = ticketUseLoyaltyPoints && canUseTicketLoyaltyPoints
    ? Math.max(0, Math.floor(Number(ticketLoyaltyPointsToRedeem) || 0))
    : 0
  const maxTicketLoyaltyPoints = clampTicketLoyaltyRedemption(
    ticketLoyaltyBalance,
    ticketLoyaltyBalance,
    ticketLoyaltyRedeemValue,
    currentTicketPriceBeforeLoyalty
  )
  const appliedTicketLoyaltyPoints = ticketUseLoyaltyPoints && canUseTicketLoyaltyPoints
    ? clampTicketLoyaltyRedemption(
      requestedTicketLoyaltyPoints,
      ticketLoyaltyBalance,
      ticketLoyaltyRedeemValue,
      currentTicketPriceBeforeLoyalty
    )
    : 0
  const ticketLoyaltyDiscountAmount = isSpecialTicketType ? 0 : appliedTicketLoyaltyPoints * ticketLoyaltyRedeemValue
  const currentTicketTotalPrice = isSpecialTicketType ? 0 : Math.max(0, currentTicketPriceBeforeLoyalty - ticketLoyaltyDiscountAmount)
  const estimatedTicketLoyaltyPointsEarned = Math.max(0, Math.floor(Number(ticketLoyaltyEarnQuote?.estimated_points ?? 0) || 0))
  const estimatedTicketLoyaltyReductionValue = Math.max(0, Math.floor(Number(ticketLoyaltyEarnQuote?.estimated_reduction_vnd ?? 0) || 0))
  const gameGuideGames = useMemo(() => {
    if (!gameGuideGameId) return games
    const focusedGame = games.find((game) => game.id === gameGuideGameId)
    if (!focusedGame) return games
    return [focusedGame, ...games.filter((game) => game.id !== gameGuideGameId)]
  }, [gameGuideGameId])
  const effectiveEditTicketDuration = editSessionDuration
  const editTicketPricing = ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, editSessionMaxPlayers, effectiveEditTicketDuration)
  const ticketDurationOptions = useMemo(() => {
    const durationOptions = Array.from(
      { length: Math.floor((ticketMaxCustomerDurationMinutes - ticketPriceBlockMinutes) / ticketPriceBlockMinutes) + 1 },
      (_, index) => ticketPriceBlockMinutes + index * ticketPriceBlockMinutes
    )

    if (!ticketDate) return durationOptions

    return durationOptions.filter((duration) => {
      const options = getAvailableTimeOptions(ticketDate, duration, activeTicketArenaCount)
      if (ticketTime) return options.some((option) => option.value === ticketTime)
      return options.length > 0
    })
  }, [activeTicketArenaCount, getAvailableTimeOptions, ticketDate, ticketTime])
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
  }, [activeTicketDuration, ticketDurationOptions, ticketTime])

  const ticketDiscountCodeInvalidText = text.ticketDiscountCodeInvalid
  const ticketDiscountCodeAppliedText = text.ticketDiscountCodeApplied
  const ticketDiscountBestReductionText = text.ticketDiscountBestReductionMessage
  const ticketDiscountCodeCheckingText = text.ticketDiscountCodeChecking

  useEffect(() => {
    if (isSpecialTicketType || !ticketDate || currentTicketPricing.grossPrice <= 0) {
      return schedulePostEffectStateUpdate(() => setTicketAutomaticDiscountQuote(null))
    }

    let active = true
    void getSupabase()
      .then((client) => client.rpc('ticket_automatic_discount_quote', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
        p_player_count: ticketPlayers,
        p_start_time: ticketTime ? `${ticketTime}:00` : null,
        p_subtotal: currentTicketPricing.grossPrice,
        p_ticket_type: ticketType,
        p_unit_price: currentTicketUnitPrice,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketAutomaticDiscountQuote(null)
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        const discountAmount = Math.max(0, Math.floor(Number(row?.discount_amount ?? 0) || 0))
        setTicketAutomaticDiscountQuote(row && discountAmount > 0
          ? {
            discount_rule_id: String(row.discount_rule_id || ''),
            discount_name: String(row.discount_name || ''),
            discount_amount: discountAmount,
          }
          : null)
      })
      .catch(() => {
        if (active) setTicketAutomaticDiscountQuote(null)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, currentTicketPricing.grossPrice, currentTicketUnitPrice, isSpecialTicketType, ticketDate, ticketPlayers, ticketTime, ticketType])

  useEffect(() => {
    const normalizedCode = ticketDiscountCode.trim().toUpperCase()

    if (isSpecialTicketType || !normalizedCode) {
      return schedulePostEffectStateUpdate(() => {
        setTicketDiscountQuote(null)
        if (isSpecialTicketType) setTicketDiscountCode('')
        setTicketDiscountStatus('')
        setIsCheckingTicketDiscount(false)
      })
    }

    let active = true
    const timeoutId = window.setTimeout(() => {
      setIsCheckingTicketDiscount(true)
      void getSupabase()
        .then((client) => client.rpc('ticket_discount_code_quote', {
          p_code: normalizedCode,
          p_booking_date: ticketDate,
          p_game_id: activeTicketService.defaultGame,
          p_player_count: ticketPlayers,
          p_start_time: ticketTime ? `${ticketTime}:00` : null,
          p_subtotal: currentTicketPricing.grossPrice,
          p_ticket_type: ticketType,
          p_unit_price: currentTicketUnitPrice,
        }))
        .then(({ data, error }) => {
          if (!active) return
          if (error) {
            setTicketDiscountQuote(null)
            setTicketDiscountStatus(error.message || ticketDiscountCodeInvalidText)
            return
          }

          const row = Array.isArray(data) ? data[0] : null
          const discountAmount = Math.max(0, Math.floor(Number(row?.discount_amount ?? 0) || 0))
          if (!row || discountAmount <= 0) {
            setTicketDiscountQuote(null)
            setTicketDiscountStatus(ticketDiscountCodeInvalidText)
            return
          }

          setTicketDiscountQuote({
            discount_code: String(row.discount_code || normalizedCode),
            discount_name: String(row.discount_name || ''),
            discount_amount: discountAmount,
          })
          setTicketDiscountStatus(ticketAutomaticDiscountAmount > 0 && discountAmount <= ticketAutomaticDiscountAmount
            ? ticketDiscountBestReductionText
            : ticketDiscountCodeAppliedText.replace('{amount}', formatVnd(discountAmount)))
        })
        .catch(() => {
          if (!active) return
          setTicketDiscountQuote(null)
          setTicketDiscountStatus(ticketDiscountCodeInvalidText)
        })
        .finally(() => {
          if (active) setIsCheckingTicketDiscount(false)
        })
    }, 300)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [activeTicketService.defaultGame, currentTicketPricing.grossPrice, currentTicketUnitPrice, isSpecialTicketType, ticketAutomaticDiscountAmount, ticketDate, ticketDiscountBestReductionText, ticketDiscountCode, ticketDiscountCodeAppliedText, ticketDiscountCodeInvalidText, ticketPlayers, ticketTime, ticketType])

  useEffect(() => {
    if (!hasTicketVoucherDiscount || !ticketUseLoyaltyPoints) return undefined
    return schedulePostEffectStateUpdate(() => {
      setTicketUseLoyaltyPoints(false)
      setTicketLoyaltyPointsToRedeem('')
      showTicketStatus(ticketDiscountBestReductionText)
    })
  }, [hasTicketVoucherDiscount, ticketDiscountBestReductionText, ticketUseLoyaltyPoints])

  useEffect(() => {
    if (!ticketUseLoyaltyPoints) return
    if (maxTicketLoyaltyPoints <= 0) {
      return schedulePostEffectStateUpdate(() => {
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
      })
    }

    const requestedPoints = Math.max(0, Math.floor(Number(ticketLoyaltyPointsToRedeem) || 0))
    if (requestedPoints > maxTicketLoyaltyPoints) {
      return schedulePostEffectStateUpdate(() => {
        setTicketLoyaltyPointsToRedeem(String(maxTicketLoyaltyPoints))
      })
    }

    return undefined
  }, [maxTicketLoyaltyPoints, ticketLoyaltyPointsToRedeem, ticketUseLoyaltyPoints])

  const sessionDurationRecommendation = durationRecommendation(sessionMaxPlayers, sessionDuration)
  const editSessionDurationRecommendation = durationRecommendation(editSessionMaxPlayers, editSessionDuration)

function handleSessionDateChange(value: string) {
  setSessionDate(value)
}

  function showTicketStatus(message: string, variant: 'info' | 'error' = 'info') {
    setTicketStatus(message)
    setTicketStatusVariant(variant)
  }

  function clearTicketStatus() {
    setTicketStatus('')
    setTicketStatusVariant('info')
  }

  async function prepareGuestTicketAction(
    action: 'create-account' | 'guest',
    options: { continueWithoutAccount?: boolean } = {}
  ): Promise<'ready' | 'registered-account' | 'blocked'> {
    const validation = validateGuestTicketContact(guestTicketContact, looseText)
    if (validation.error) {
      showTicketStatus(validation.error, 'error')
      return 'blocked'
    }

    const { data, error } = await (await getSupabase()).rpc('guest_ticket_phone_account_status', {
      p_guest_phone: validation.normalizedPhone,
    })

    if (error) {
      showTicketStatus(error.message || text.ticketBookingError, 'error')
      return 'blocked'
    }

    const accountStatus = (data && typeof data === 'object' ? data : {}) as { has_account?: boolean }
    if (!accountStatus.has_account) return 'ready'

    if (action === 'create-account') {
      showTicketStatus(text.guestTicketExistingAccountCreateMessage, 'error')
      return 'registered-account'
    }

    if (!options.continueWithoutAccount) {
      showTicketStatus(text.guestTicketExistingAccountGuestMessage, 'error')
      return 'registered-account'
    }

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
          setTicketConfirmation((current) => current
            ? { ...current, guestPhone: undefined, guestName: undefined }
            : current)
          showTicketStatus(text.guestTicketSavedToAccount)
          setProfileStatus(text.guestTicketSavedToAccount)
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

    if (activeProfile && ticketUseLoyaltyPoints && appliedTicketLoyaltyPoints <= 0) {
      showTicketStatus(text.ticketLoyaltyInvalid, 'error')
      return false
    }

    const normalizedTicketDiscountCode = ticketDiscountCode.trim().toUpperCase()
    if (!isSpecialTicketType && normalizedTicketDiscountCode && isCheckingTicketDiscount) {
      showTicketStatus(ticketDiscountCodeCheckingText)
      return false
    }

    if (!isSpecialTicketType && normalizedTicketDiscountCode && !ticketDiscountQuote) {
      showTicketStatus(ticketDiscountCodeInvalidText, 'error')
      return false
    }

    return true
  }

  function handleTicketTypeChange(value: TicketType) {
    const service = selectedTicketService(value)
    const nextPlayers = Math.min(service.maxPlayers, Math.max(service.minPlayers, ticketPlayers))
    const nextDuration = Math.max(ticketDurationForPlayers(value, nextPlayers), ticketDuration)
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
    const nextMinimumDuration = ticketDurationForPlayers(ticketType, value)
    const nextDuration = Math.max(nextMinimumDuration, ticketDuration)
    const nextArenaCount = ticketArenaCountForPlayers()
    const nextTimeOptions = getAvailableTimeOptions(ticketDate, nextDuration, nextArenaCount)
    const keepsSelectedTime = ticketTime && nextTimeOptions.some((option) => option.value === ticketTime)

    setTicketPlayers(value)
    setTicketDuration(nextDuration)
    setTicketConfirmation(null)
    if (!keepsSelectedTime || nextDuration !== activeTicketDuration || nextArenaCount !== activeTicketArenaCount) {
      setTicketTime('')
    }
  }

  function handleTicketDurationChange(value: number) {
    const nextDuration = Math.min(ticketMaxCustomerDurationMinutes, Math.max(ticketPriceBlockMinutes, value))
    const nextTimeOptions = getAvailableTimeOptions(ticketDate, nextDuration, activeTicketArenaCount)
    const keepsSelectedTime = ticketTime && nextTimeOptions.some((option) => option.value === ticketTime)

    setTicketDuration(nextDuration)
    if (!keepsSelectedTime) setTicketTime('')
    setTicketConfirmation(null)
  }

  function handleTicketUseLoyaltyPointsChange(checked: boolean) {
    if (checked && hasTicketVoucherDiscount) {
      setTicketUseLoyaltyPoints(false)
      setTicketLoyaltyPointsToRedeem('')
      showTicketStatus(ticketDiscountBestReductionText)
      return
    }
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

  useEffect(() => {
    let active = true

    if (!profile || activeView !== 'tickets' || isSpecialTicketType) {
      return schedulePostEffectStateUpdate(() => {
        setTicketLoyaltyRedemption(null)
        setTicketLoyaltyEarnQuote(null)
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
        setIsLoadingTicketLoyalty(false)
      })
    }

    schedulePostEffectStateUpdate(() => setIsLoadingTicketLoyalty(true))
    void getSupabase()
      .then((client) => client.rpc('ticket_loyalty_redemption_settings', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketLoyaltyRedemption(null)
          setTicketUseLoyaltyPoints(false)
          setTicketLoyaltyPointsToRedeem('')
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        const pointsTotal = Math.max(0, Math.floor(Number(row?.loyalty_points_total ?? profile.loyalty_points_total ?? 0) || 0))
        const redeemValue = Math.max(0, Math.floor(Number(row?.redeem_value_vnd_per_point ?? 0) || 0))
        setTicketLoyaltyRedemption({
          loyalty_points_total: pointsTotal,
          redeem_value_vnd_per_point: redeemValue,
        })
      })
      .catch(() => {
        if (!active) return
        setTicketLoyaltyRedemption(null)
        setTicketUseLoyaltyPoints(false)
        setTicketLoyaltyPointsToRedeem('')
      })
      .finally(() => {
        if (active) setIsLoadingTicketLoyalty(false)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, activeView, isSpecialTicketType, profile, ticketDate])

  useEffect(() => {
    let active = true

    if (activeView !== 'tickets' || isSpecialTicketType) {
      return schedulePostEffectStateUpdate(() => setTicketLoyaltyEarnQuote(null))
    }

    void getSupabase()
      .then((client) => client.rpc('ticket_loyalty_earn_quote', {
        p_booking_date: ticketDate,
        p_game_id: activeTicketService.defaultGame,
        p_paid_total: currentTicketTotalPrice,
        p_player_count: ticketPlayers,
      }))
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setTicketLoyaltyEarnQuote(null)
          return
        }

        const row = Array.isArray(data) ? data[0] : null
        setTicketLoyaltyEarnQuote({
          estimated_points: Math.max(0, Math.floor(Number(row?.estimated_points ?? 0) || 0)),
          estimated_reduction_vnd: Math.max(0, Math.floor(Number(row?.estimated_reduction_vnd ?? 0) || 0)),
          redeem_value_vnd_per_point: Math.max(0, Math.floor(Number(row?.redeem_value_vnd_per_point ?? 0) || 0)),
        })
      })
      .catch(() => {
        if (active) setTicketLoyaltyEarnQuote(null)
      })

    return () => {
      active = false
    }
  }, [activeTicketService.defaultGame, activeView, currentTicketTotalPrice, isSpecialTicketType, ticketDate, ticketPlayers])

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
      const nextDuration = ticketDurationForPlayers(editTicketType, value)
      setEditSessionDuration(nextDuration)
      setEditSessionArenaCount(ticketArenaCountForPlayers())
      setEditTicketTotalPrice(String(ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, value, nextDuration).totalPrice))
      return
    }

    if (value < 8) {
      setEditSessionArenaCount(1)
    }
  }

  function handleEditArenaCountChange(value: number) {
    if (editBookingType === 'ticket') {
      setEditSessionArenaCount(ticketArenaCount)
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
      sessions.filter((session) => session.date >= calendarWeekStart && session.date <= calendarWeekEnd)
    )
  }, [calendarWeekEnd, calendarWeekStart, sessions])

  const calendarAvailableSlotKeys = useMemo(() => {
    const availableKeys = new Set<string>()
    const today = localDateString()
    calendarWeekDays.forEach((day) => {
      if (day.value < today) return
      getAvailableTimeOptions(day.value, TIME_STEP_MINUTES, 1).forEach((option) => {
        availableKeys.add(`${day.value}-${option.value}`)
      })
    })
    return availableKeys
  }, [calendarWeekDays, getAvailableTimeOptions])

  const filteredSessions = useMemo(() => {
    const query = normalizeSearchValue(search)

    return sessions.filter((session) => {
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
  }, [language, selectedClub])

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

      ;(session.session_participants ?? []).forEach((participant) => {
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

  const leaderboardPlayerStats = leaderboardLoadedRef.current ? leaderboardPlayers : allPlayerStats
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

  const isAdmin = Boolean(isAdminRole(profile?.role) || isAdminEmail(profile?.email) || isAdminEmail(authEmail))
  const staffAccessRank = profile
    ? Math.max(staffConsoleRank(profile.role, profile.email), staffConsoleRank(profile.role, authEmail))
    : 0
  const canAccessStaffConsole = Boolean(profile && staffAccessRank >= 20)
  const canStaffExpandTicketSessions = false
  const selectedClubHallId = selectedClub?.id ?? ''
  const selectedClubHallRankingCriterion = selectedClub?.ranking_criterion ?? null

  useEffect(() => {
    if (!selectedClubHallId || selectedClubTab !== 'hall') return

    const nextQuery = {
      ...initialLeaderboardQuery(),
      clubId: selectedClubHallId,
      criterion: isLeaderboardCriterion(selectedClubHallRankingCriterion) ? selectedClubHallRankingCriterion : 'totalScore',
    }
    leaderboardQueryRef.current = nextQuery
    leaderboardLoadedCountRef.current = 0
    void loadLeaderboardPlayersRef.current(nextQuery, 0, 'replace', userId)
  }, [selectedClubHallId, selectedClubHallRankingCriterion, selectedClubTab, userId])

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
  }, [loadSelectedPlayerStats, selectedPlayerId, selectedPlayerStatsFromLoadedData])

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
  }, [selectedPlayerSessionIsEscape])

  function openChallengeForm(player: NonNullable<typeof selectedPlayerProfile>) {
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

  async function createFriendChallenge(player: NonNullable<typeof selectedPlayerProfile>) {
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

  async function ensureStaffGameGuidesLoaded() {
    if (staffGameGuidesLoadedRef.current || staffGameGuidesLoadingRef.current) return

    staffGameGuidesLoadingRef.current = true
    const client = await getSupabase()
    const { data, error } = await client
      .from('staff_games')
      .select('slug, game_type, escape_chapter_count, guide_language, guide_summary, guide_rules, guide_tips')
      .eq('active', true)

    staffGameGuidesLoadingRef.current = false
    staffGameGuidesLoadedRef.current = true

    if (error || !data) return

    const knownGameIds = new Set(games.map((game) => game.id))
    const guidesByGame = ((data ?? []) as StaffGameGuide[]).reduce<Partial<Record<GameId, StaffGameGuide>>>((guides, guide) => {
      if (knownGameIds.has(guide.slug as GameId)) {
        guides[guide.slug as GameId] = guide
      }
      return guides
    }, {})

    setStaffGameGuides(guidesByGame)
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

  function renderChallengeControls(player: NonNullable<typeof selectedPlayerProfile>) {
    if (player.profileId === userId) return null

    const isOpen = challengeTargetId === player.profileId
    const sentChallenge = sessionInvites.find((invite) => {
      const invitedSession = sessionForInvite(invite)
      return invite.inviter_id === userId
        && invite.recipient_id === player.profileId
        && invite.status === 'pending'
        && invitedSession
        && isChallengeSession(invitedSession)
    })

    if (!isOpen) {
      return (
        <div className="challenge-card compact-challenge-card">
          <button className="primary small-button challenge-button" type="button" onClick={() => openChallengeForm(player)}>
            {text.challengeFriend}
          </button>
          {sentChallenge && <span className="challenge-sent-pill">{text.challengePending}</span>}
        </div>
      )
    }

    const selectedGame = games.find((game) => game.id === challengeGameId) || games[0]

    return (
      <div className="challenge-card">
        <div className="challenge-card-head">
          <div>
            <strong>{text.challengeFriendTitle}</strong>
            <span>{text.challengeFriendHint}</span>
          </div>
          <button className="secondary small-button" type="button" onClick={() => setChallengeTargetId('')}>
            {text.close}
          </button>
        </div>
        <div className="challenge-form-grid">
          <label>
            <span>{text.playedGame}</span>
            <select value={challengeGameId} onChange={(event) => setChallengeGameId(event.target.value as GameId)}>
              {games.map((game) => (
                <option key={game.id} value={game.id}>{game.title}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{text.date}</span>
            <ShortDateInput
              ariaLabel={text.date}
              language={language}
              onChange={(value) => {
                setChallengeDate(value)
                setChallengeTime('')
              }}
              placeholder={text.chooseDate}
              value={challengeDate}
            />
          </label>
          <label>
            <span>{text.availableTime}</span>
            <select value={challengeTime} onChange={(event) => setChallengeTime(event.target.value)}>
              <option value="">{text.chooseTime}</option>
              {challengeTimeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{text.duration}</span>
            <select value={challengeDuration} onChange={(event) => {
              setChallengeDuration(Number(event.target.value))
              setChallengeTime('')
            }}>
              {[20, 40, 60, 80, 100, 120].map((duration) => (
                <option key={duration} value={duration}>{duration} min</option>
              ))}
            </select>
          </label>
        </div>
        <p className="challenge-summary">
          {selectedGame.title} · {challengeDate ? formatShortDate(challengeDate, language) : text.chooseDate}
          {challengeTime ? ` · ${challengeTime}` : ''}
        </p>
        <button
          className={isCreatingChallenge ? 'primary create-button loading' : 'primary create-button'}
          disabled={isCreatingChallenge}
          type="button"
          onClick={() => createFriendChallenge(player)}
        >
          {isCreatingChallenge ? text.challengeCreating : text.sendChallenge}
        </button>
        {challengeStatus && <p className="notice compact-notice">{challengeStatus}</p>}
      </div>
    )
  }

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
  }, [userId])

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
  }, [tournamentEditorEmail])

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
    await (await getSupabase()).from('tournament_audit_log').insert({
      session_id: sessionId,
      user_id: userId || null,
      action,
      old_value: oldValue,
      new_value: newValue,
    })
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

  function clubRoleFor(club: Club, profileId = userId): ClubRole {
    return clubRoleForProfile(club, profileId)
  }

  function clubRoleLabel(role: ClubRole) {
    if (role === 'owner') return text.ownerRole
    if (role === 'admin') return text.adminRole
    if (role === 'moderator') return text.moderatorRole
    return text.memberRole
  }

  function canManageClub(club: Club) {
    const role = clubRoleFor(club)
    return Boolean(userId && (isAdmin || role === 'owner' || role === 'admin'))
  }

  function canModerateClubMembers(club: Club) {
    const role = clubRoleFor(club)
    return Boolean(userId && (isAdmin || role === 'owner' || role === 'admin' || role === 'moderator'))
  }

  function canManageClubMember(club: Club, member: ClubMember) {
    if (!userId) return false
    if (member.profile_id === club.owner_id) return false
    if (isAdmin) return true

    const actorRole = clubRoleFor(club)
    const targetRole = clubRoleFor(club, member.profile_id)

    if (actorRole === 'owner') return true
    if (actorRole === 'admin') return targetRole === 'moderator' || targetRole === 'member'
    if (actorRole === 'moderator') return targetRole === 'member'
    return false
  }

  function manageableRoleOptions(club: Club, member: ClubMember): ClubMemberRole[] {
    if (!canManageClubMember(club, member)) return []
    if (isAdmin || clubRoleFor(club) === 'owner') return ['admin', 'moderator', 'member']
    if (clubRoleFor(club) === 'admin') return ['moderator', 'member']
    return ['member']
  }

  function clubTheme(club: Club | undefined) {
    return cleanHexColor(club?.theme_color || '', clubThemeColors[0])
  }

  function clubRankingCriterion(club: Club | undefined): LeaderboardCriterion {
    const criterion = club?.ranking_criterion
    return isLeaderboardCriterion(criterion) ? criterion : 'totalScore'
  }

  function clubThemeStyle(club: Club | undefined) {
    const color = clubTheme(club)
    return {
      '--club-theme': color,
      '--club-theme-soft': `${color}24`,
      '--club-theme-faint': `${color}12`,
    } as Record<string, string>
  }

  function isDuplicateClubMembershipError(error: { code?: string; message?: string } | null | undefined) {
    const message = error?.message?.toLowerCase() || ''
    return error?.code === '23505' || message.includes('club_members_active_club_profile_key')
  }

  function approvedClubMember(club: Club, profileId = userId) {
    return clubMembers(club).some((member) => member.profile_id === profileId && member.status === 'approved')
  }

  function canEnterPrivateClubPage(club: Club | undefined) {
    if (!club) return false
    if (club.visibility !== 'private') return true
    if (!userId) return false
    return club.owner_id === userId || approvedClubMember(club) || Boolean(unlockedClubIds[club.id])
  }

  function canSeeClubPrivateData(club: Club | undefined) {
    if (!club) return true
    if (club.visibility === 'public') return true
    return canEnterPrivateClubPage(club) || canManageClub(club)
  }

  function canOpenClubPage(club: Club | undefined) {
    if (!club) return false
    if (!userId) return false
    if (club.visibility === 'private') return canEnterPrivateClubPage(club)
    return canSeeClubPrivateData(club)
  }

  function canCreateClubSession(club: Club | undefined) {
    if (!club) return false
    return canManageClub(club) || approvedClubMember(club)
  }

  function sessionClubFor(session: Session) {
    return session.club_id ? clubs.find((club) => club.id === session.club_id) : undefined
  }

  function clubMembershipFor(club: Club | undefined, profileId = userId) {
    if (!club || !profileId) return undefined
    return clubMembers(club).find((member) => member.profile_id === profileId)
  }

  function canAccessClubSession(session: Session) {
    const club = sessionClubFor(session)
    if (!club) return true
    return canSeeClubPrivateData(club)
  }

  function openClubPage(clubId: string, tab: ClubTab = 'hall') {
    const club = clubs.find((item) => item.id === clubId)
    setClubStatus('')
    setClubMessageStatus('')

    if (!userId) {
      setSelectedClubId('')
      promptLogin()
      return
    }

    if (!canOpenClubPage(club)) {
      setSelectedClubId('')
      if (club?.visibility === 'private') {
        setClubUnlockTargetId(club.id)
        setClubUnlockCode('')
        setClubUnlockStatus('')
      } else {
        setClubStatus(text.hiddenMembers)
      }
      return
    }

    setSelectedClubId(clubId)
    setSelectedClubDate('')
    setSelectedClubTab(tab)
    setSelectedClubSessionScope('upcoming')
  }

  function closeClubUnlockModal() {
    setClubUnlockTargetId('')
    setClubUnlockCode('')
    setClubUnlockStatus('')
  }

  function unlockClubPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!clubUnlockTarget) return

    const expectedCode = normalizePrivateCode(clubUnlockTarget.pin_code)
    const typedCode = normalizePrivateCode(clubUnlockCode)
    if (!expectedCode || typedCode !== expectedCode) {
      setClubUnlockStatus(text.privateIncorrect)
      return
    }

    setUnlockedClubIds((current) => ({ ...current, [clubUnlockTarget.id]: true }))
    const unlockedClubId = clubUnlockTarget.id
    closeClubUnlockModal()
    setSelectedClubId(unlockedClubId)
    setSelectedClubDate('')
    setSelectedClubTab('hall')
    setSelectedClubSessionScope('upcoming')
  }

  function handleClubTabChange(tab: ClubTab) {
    setSelectedClubTab(tab)
    if (tab === 'sessions' && selectedClubSessionScope === 'past') {
      void ensurePastSessionsLoaded()
    }
  }

  function handleClubSessionScopeChange(scope: ClubSessionScope) {
    setSelectedClubSessionScope(scope)
    setSelectedClubDate('')
    if (scope === 'past') void ensurePastSessionsLoaded()
  }

  function handleClubBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!CLUB_BANNER_TYPES.includes(file.type)) {
      setClubStatus(text.clubBannerTypeError)
      event.target.value = ''
      return
    }

    if (file.size > CLUB_BANNER_MAX_BYTES) {
      setClubStatus(text.clubBannerSizeError)
      event.target.value = ''
      return
    }

    setClubBannerFile(file)
    setClubBannerPreview(URL.createObjectURL(file))
    setClubStatus('')
  }

  async function uploadClubBanner(club: Club) {
    if (!clubBannerFile) return club.banner_url || null

    const safeName = clubBannerFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const path = `${club.id}/${Date.now()}-${safeName}`
    const client = await getSupabase()
    const upload = await client.storage.from('club-banners').upload(path, clubBannerFile, {
      contentType: clubBannerFile.type,
      upsert: true,
    })

    if (upload.error) {
      setClubStatus(upload.error.message)
      return false
    }

    const { data } = client.storage.from('club-banners').getPublicUrl(path)
    return data.publicUrl
  }

  async function saveClubSettings(club: Club) {
    if (!canManageClub(club)) return

    const name = clubEditName.trim()
    if (!name) {
      setClubStatus(text.clubRequired)
      return
    }

    setIsSavingClub(true)
    setBusyClubId(club.id)
    setClubStatus(text.saving)

    const bannerUrl = await uploadClubBanner(club)
    if (bannerUrl === false) {
      setIsSavingClub(false)
      setBusyClubId('')
      return
    }

    const nextPinCode = clubEditVisibility === 'private' ? club.pin_code || generateInviteCode() : null
    const { error } = await (await getSupabase())
      .from('clubs')
      .update({
        name,
        motto: clubEditMotto.trim() || null,
        description: clubEditDescription.trim() || null,
        banner_url: bannerUrl,
        theme_color: cleanHexColor(clubEditThemeColor, clubThemeColors[0]),
        visibility: clubEditVisibility,
        pin_code: nextPinCode,
        default_language: clubEditDefaultLanguage,
        ranking_criterion: clubEditRankingCriterion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', club.id)

    if (error) {
      setClubStatus(error.message)
      setIsSavingClub(false)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubBannerFile(null)
    setClubBannerPreview('')
    setClubStatus(text.clubSaved)
    setIsSavingClub(false)
    setBusyClubId('')
  }

  async function regenerateClubInviteCode(club: Club) {
    if (!canManageClub(club)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase())
      .from('clubs')
      .update({
        pin_code: generateInviteCode(),
        visibility: 'private',
        updated_at: new Date().toISOString(),
      })
      .eq('id', club.id)

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubInviteRegenerated)
    }
    setBusyClubId('')
  }

  async function shareClubInvite(club: Club) {
    const code = club.pin_code || ''
    const shareBody = club.visibility === 'private'
      ? `${club.name} · ${text.privateCode}: ${code}`
      : `${club.name} · ${DEFAULT_APP_URL}`

    if (navigator.share) {
      await navigator.share({ title: club.name, text: shareBody })
    } else {
      await navigator.clipboard?.writeText(shareBody)
      setClubStatus(text.copied)
    }
  }

  async function updateClubMemberRole(club: Club, member: ClubMember, role: ClubMemberRole) {
    if (!manageableRoleOptions(club, member).includes(role)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase())
      .from('club_members')
      .update({ role, status: 'approved' })
      .eq('id', member.id)

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubRoleUpdated)
    }
    setBusyClubId('')
  }

  async function transferClubOwnership(club: Club, member: ClubMember) {
    if (!userId || (!isAdmin && club.owner_id !== userId)) return
    if (!window.confirm(text.transferOwnershipConfirm)) return

    setBusyClubId(club.id)
    const { error } = await (await getSupabase()).rpc('transfer_club_ownership', {
      p_club_id: club.id,
      p_new_owner_id: member.profile_id,
    })

    if (error) setClubStatus(error.message)
    else {
      await loadClubs()
      setClubStatus(text.clubOwnershipTransferred)
    }
    setBusyClubId('')
  }

  async function notifyClubMembersOfSession(club: Club, sessionId: string) {
    const recipients = clubMembers(club)
      .filter((member) => member.status === 'approved' && member.profile_id !== userId)
      .slice(0, 80)

    if (recipients.length === 0) return

    const payloads = recipients.map((member) => {
      const snapshot = socialAvatarFields(member)
      return {
        session_id: sessionId,
        inviter_id: userId,
        recipient_id: member.profile_id,
        recipient_display_name: snapshot.display_name,
        recipient_avatar_url: snapshot.avatar_url,
        recipient_avatar_emoji: snapshot.avatar_emoji,
        recipient_avatar_initials: snapshot.avatar_initials,
        recipient_avatar_color: snapshot.avatar_color,
        recipient_avatar_text_color: snapshot.avatar_text_color,
        recipient_profile_motto: snapshot.profile_motto,
        status: 'pending',
      }
    })

    const { error } = await (await getSupabase())
      .from('session_invites')
      .upsert(payloads, { onConflict: 'session_id,recipient_id' })

    if (!error && networkDataLoadedRef.current) await loadNetworkData()
  }

  async function createClub() {
    if (!requireProfile()) return

    const activeProfile = profile
    const name = clubName.trim()

    if (!activeProfile) return

    if (!name) {
      setClubStatus(text.clubRequired)
      return
    }

    setIsCreatingClub(true)
    setClubStatus(text.creatingClub)

    const clubPinCode = clubVisibility === 'private' ? generateInviteCode() : null
    let savedClubPinCode = clubPinCode
    const client = await getSupabase()
    const clubPayload = {
      owner_id: userId,
      name,
      description: clubDescription.trim() || null,
      visibility: clubVisibility,
      pin_code: clubPinCode,
    }
    let clubResult = await client
      .from('clubs')
      .insert(clubPayload)
      .select('id')
      .single()

    if (clubResult.error && clubResult.error.message.toLowerCase().includes('pin_code')) {
      savedClubPinCode = null
      const fallbackClubPayload = {
        owner_id: clubPayload.owner_id,
        name: clubPayload.name,
        description: clubPayload.description,
        visibility: clubPayload.visibility,
      }
      clubResult = await client
        .from('clubs')
        .insert(fallbackClubPayload)
        .select('id')
        .single()
    }

    if (clubResult.error || !clubResult.data) {
      setClubStatus(clubResult.error?.message || text.createError)
      setIsCreatingClub(false)
      return
    }

    const memberResult = await client.from('club_members').insert({
      club_id: clubResult.data.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
      status: 'approved',
    })

    if (memberResult.error) {
      setClubStatus(memberResult.error.message)
      setIsCreatingClub(false)
      return
    }

    setClubName('')
    setClubDescription('')
    setClubVisibility('public')
    await loadClubs()
    setClubStatus(savedClubPinCode ? `${text.clubCreated} ${text.privateCode}: ${savedClubPinCode}` : text.clubCreated)
    setIsCreatingClub(false)
  }

  async function joinClub(club: Club) {
    if (!requireProfile()) return

    const activeProfile = profile
    if (!activeProfile) return

    const currentMembership = clubMembers(club).find((member) => member.profile_id === userId)
    if (currentMembership) {
      setClubStatus(currentMembership.status === 'pending' ? text.requestSent : text.joinedClub)
      showActionToast(currentMembership.status === 'pending' ? text.requestSent : text.joinedClub)
      return
    }

    setBusyClubId(club.id)
    const client = await getSupabase()
    const desiredStatus = club.visibility === 'private' ? 'pending' : 'approved'
    const existingMembershipResult = await client
      .from('club_members')
      .select(CLUB_MEMBER_SELECT)
      .eq('club_id', club.id)
      .eq('profile_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingMembershipResult.error) {
      const fallbackMembershipResult = await client
        .from('club_members')
        .select(CLUB_MEMBER_SELECT_BASE)
        .eq('club_id', club.id)
        .eq('profile_id', userId)
        .is('deleted_at', null)
        .maybeSingle()

      if (fallbackMembershipResult.error) {
        setClubStatus(fallbackMembershipResult.error.message)
        setBusyClubId('')
        return
      }

      if (fallbackMembershipResult.data) {
        await loadClubs()
        setClubStatus(fallbackMembershipResult.data.status === 'pending' ? text.requestSent : text.joinedClub)
        showActionToast(fallbackMembershipResult.data.status === 'pending' ? text.requestSent : text.joinedClub)
        setBusyClubId('')
        return
      }
    } else if (existingMembershipResult.data) {
      await loadClubs()
      setClubStatus(existingMembershipResult.data.status === 'pending' ? text.requestSent : text.joinedClub)
      showActionToast(existingMembershipResult.data.status === 'pending' ? text.requestSent : text.joinedClub)
      setBusyClubId('')
      return
    }

    const { error } = await client.from('club_members').insert({
      club_id: club.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
      status: desiredStatus,
    })

    if (error) {
      if (isDuplicateClubMembershipError(error)) {
        await loadClubs()
        setClubStatus(desiredStatus === 'pending' ? text.requestSent : text.joinedClub)
        showActionToast(desiredStatus === 'pending' ? text.requestSent : text.joinedClub)
      } else {
        setClubStatus(error.message)
      }
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(club.visibility === 'private' ? text.requestSent : text.joinedClub)
    showActionToast(club.visibility === 'private' ? text.requestSent : text.joinedClub)
    setBusyClubId('')
  }

  async function approveClubMember(member: ClubMember) {
    const club = clubs.find((item) => item.id === member.club_id)
    if (!club || !canModerateClubMembers(club)) return

    setBusyClubId(member.club_id)
    const { error } = await (await getSupabase()).from('club_members').update({ status: 'approved', role: 'member' }).eq('id', member.id)

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(text.memberApproved)
    setBusyClubId('')
  }

  async function removeClubMember(club: Club, member: ClubMember) {
    if (!canManageClubMember(club, member)) return

    if (!window.confirm(text.removeMemberConfirm)) return

    setBusyClubId(club.id)
    const { error } = await softDeleteRecord('club_members', member.id, 'Removed from club')

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(text.memberRemoved)
    setBusyClubId('')
  }

  async function leaveClub(club: Club, member: ClubMember) {
    if (!userId || member.profile_id !== userId || club.owner_id === userId) return

    if (!window.confirm(leaveClubConfirmText)) return

    setBusyClubId(club.id)
    const { error } = await softDeleteRecord('club_members', member.id, 'User left club')

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(leftClubText)
    setBusyClubId('')
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

  function marketingConsentValues(consent: boolean, currentProfile: Profile | null, timestamp = new Date().toISOString()) {
    return {
      marketing_consent: consent,
      marketing_consent_at: consent ? currentProfile?.marketing_consent_at || timestamp : currentProfile?.marketing_consent_at || null,
      marketing_opted_out_at: consent ? null : timestamp,
    }
  }

  async function syncMarketingListForProfile(source: Profile, consent: boolean) {
    const client = await getSupabase()

    if (!consent) {
      const { error } = await client
        .from('marketing_list')
        .delete()
        .eq('profile_id', source.id)
      return error?.message || ''
    }

    const { error } = await client
      .from('marketing_list')
      .upsert({
        profile_id: source.id,
        email: source.email,
        full_name: source.full_name,
        nickname: source.nickname,
        phone: source.phone,
        consented_at: source.marketing_consent_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })

    return error?.message || ''
  }

  async function syncProfilePublicSnapshots(profileId: string) {
    const { error } = await (await getSupabase()).rpc('sync_profile_public_snapshot', { p_profile_id: profileId })
    return error?.message || ''
  }

  async function notifyMinorBookingCreated(kind: 'session' | 'ticket', sessionId: string | null | undefined, sourceProfile: Profile | null) {
    if (!sessionId || !sourceProfile || ageBandFromBirthday(sourceProfile.birthday) !== 'minor') return

    try {
      await notifyBookingUpdateEmail(await getSupabase(), {
        action: 'created',
        bookingKind: kind,
        sessionId,
        source: 'player-app',
      })
    } catch (error) {
      console.warn('Could not send minor booking notice.', error)
    }
  }

  async function updateAnonymousMode(nextMode: boolean) {
    if (!profile || !userId) return

    setIsSavingAnonymousMode(true)
    const nextCallsign = profile.anonymous_callsign || anonymousCallsignForId(userId)
    const { data, error } = await (await getSupabase())
      .from('profiles')
      .update({
        anonymous_mode: nextMode,
        anonymous_callsign: nextCallsign,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    const metadataUpdate = await (await getSupabase()).auth.updateUser({
      data: {
        display_name: displayName(data),
        name: displayName(data),
        anonymous_mode: data.anonymous_mode,
        anonymous_callsign: data.anonymous_callsign,
      },
    })

    if (metadataUpdate.error) {
      setProfileStatus(metadataUpdate.error.message)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    const snapshotError = await syncProfilePublicSnapshots(data.id)
    if (snapshotError) {
      setProfileStatus(snapshotError)
      setIsSavingAnonymousMode(false)
      setAnonymousConfirmOpen(false)
      return
    }

    setProfile(data)
    syncProfileEverywhere(data)
    await loadSessions()
    await loadClubs()
    if (networkDataLoadedRef.current) await loadNetworkData()
    refreshLeaderboardIfLoaded()
    setProfileStatus(nextMode ? text.anonymousModeActivated : text.anonymousModeDeactivated)
    setAnonymousConfirmOpen(false)
    setIsSavingAnonymousMode(false)
  }

  async function updateMarketingConsent(nextConsent: boolean) {
    setMarketingConsent(nextConsent)
    if (!profile || !userId) return

    const previousProfile = profile
    const values = marketingConsentValues(nextConsent, profile)
    const optimisticProfile = { ...profile, ...values }
    setProfile(optimisticProfile)
    setProfileStatus(text.savingProfile)

    const { data, error } = await (await getSupabase())
      .from('profiles')
      .update(values)
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      setMarketingConsent(previousProfile.marketing_consent !== false)
      setProfile(previousProfile)
      setProfileStatus(error.message)
      return
    }

    const listError = await syncMarketingListForProfile(data, nextConsent)
    setProfile(data)
    setProfileStatus(listError || (nextConsent ? text.marketingConsentSaved : text.marketingConsentRemoved))
  }

  async function saveProfile() {
    if (!userId) {
      setProfileStatus(text.profileLoading)
      return
    }

    const countryCode = resolveCountryCode(profileCountryCode)
    const localPhone = profilePhone.replace(/[^\d\s-]/g, '').trim()
    const fullName = profileName.trim()
    const cleanMotto = limitMotto(profileMotto.trim())
    const nickname = limitDisplayName(profileNickname.trim())

    if (!profilePhone.trim()) {
      setProfileStatus(text.phoneRequired)
      return
    }

    if (!fullName) {
      setProfileStatus(text.nameRequired)
      return
    }

    setIsSavingProfile(true)
    setProfileStatus(text.savingProfile)

    const avatarUrl = avatarMode === 'photo' ? await uploadAvatar(userId, profile?.avatar_url || null) : null

    if (avatarUrl === false) return

    const avatarPayload = {
      avatar_url: avatarMode === 'photo' ? avatarUrl : null,
      avatar_emoji: avatarMode === 'emoji' ? avatarEmoji.trim() || '😎' : null,
      avatar_initials: avatarMode === 'initials' ? compactInitials(avatarInitials || displayName(profile) || fullName) : null,
      avatar_color: avatarColor,
      avatar_text_color: avatarTextColor,
    }

    const row = {
      full_name: fullName,
      phone: `${countryCode}${localPhone.replace(/\D/g, '')}`,
      profile_motto: cleanMotto || null,
      nickname: nickname || null,
      birthday: profileBirthday || null,
      gender: isUnder13Birthday(profileBirthday) ? null : profileGender || null,
      ...marketingConsentValues(marketingConsent, profile),
      ...avatarPayload,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await (await getSupabase())
      .from('profiles')
      .update(row)
      .eq('id', userId)
      .select(PROFILE_SELECT)
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingProfile(false)
      return
    }

    const display = displayName(data)
    const publicAvatar = avatarFields(data)
    const metadataUpdate = await (await getSupabase()).auth.updateUser({
      data: {
        display_name: display,
        full_name: fullName,
        name: display,
        nickname: nickname || null,
        birthday: data.birthday,
        gender: data.gender,
        phone: data.phone,
        avatar_url: publicAvatar.avatar_url,
        avatar_emoji: publicAvatar.avatar_emoji,
        avatar_initials: publicAvatar.avatar_initials,
        avatar_color: publicAvatar.avatar_color,
        avatar_text_color: publicAvatar.avatar_text_color,
        profile_motto: data.profile_motto,
        marketing_consent: data.marketing_consent,
        marketing_consent_at: data.marketing_consent_at,
        marketing_opted_out_at: data.marketing_opted_out_at,
        personal_data_consent: data.personal_data_consent,
        personal_data_consent_at: data.personal_data_consent_at,
        privacy_policy_url: data.privacy_policy_url,
        terms_conditions_url: data.terms_conditions_url,
        consent_waiver_url: data.consent_waiver_url,
        legal_consent_version: data.legal_consent_version,
      },
    })

    if (metadataUpdate.error) {
      setProfileStatus(metadataUpdate.error.message)
      setIsSavingProfile(false)
      return
    }

    const snapshotError = await syncProfilePublicSnapshots(data.id)
    if (snapshotError) {
      setProfileStatus(snapshotError)
      setIsSavingProfile(false)
      return
    }

    const marketingListError = await syncMarketingListForProfile(data, data.marketing_consent !== false)
    if (marketingListError) {
      setProfileStatus(marketingListError)
      setIsSavingProfile(false)
      return
    }

    setProfile(data)
    await loadSessions()
    await loadClubs()
    await loadTournamentData()
    syncProfileEverywhere(data)
    setAvatarFile(null)
    setAvatarPreview('')
    setProfileCountryCode(countryCode)
    setProfilePhone(localPhone)
    setProfileBirthday(data.birthday || '')
    setProfileGender(normalizeProfileGender(data.gender))
    setProfileStatus(text.profileSaved)
    showActionToast(text.profileSaved)
    setIsSavingProfile(false)
  }

  async function uploadAvatar(ownerId: string, currentAvatarUrl: string | null) {
    if (!avatarFile) return currentAvatarUrl

    const safeName = avatarFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const path = `${ownerId}/${Date.now()}-${safeName}`
    const upload = await (await getSupabase()).storage.from('avatars').upload(path, avatarFile, {
      contentType: avatarFile.type,
      upsert: true,
    })

    if (upload.error) {
      setProfileStatus(upload.error.message)
      setIsSavingProfile(false)
      return false as const
    }

    const { data } = (await getSupabase()).storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null

    if (!file) {
      setAvatarFile(null)
      setAvatarPreview('')
      return
    }

    if (!AVATAR_IMAGE_TYPES.includes(file.type)) {
      setProfileStatus(text.avatarPhotoTypeError)
      setAvatarFile(null)
      setAvatarPreview('')
      event.target.value = ''
      return
    }

    if (file.size > AVATAR_IMAGE_MAX_BYTES) {
      setProfileStatus(text.avatarPhotoSizeError)
      setAvatarFile(null)
      setAvatarPreview('')
      event.target.value = ''
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarMode('photo')
    setProfileStatus('')
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

  async function bookTickets(profileOverride?: Profile | null) {
    const activeProfile = profileOverride === undefined ? profile : profileOverride

    const service = selectedTicketService(ticketType)
    const selectedTimeOption = ticketTimeOptions.find((option) => option.value === ticketTime)
    const normalizedTicketDiscountCode = ticketDiscountCode.trim().toUpperCase()

    if (activeProfile && ageBandFromBirthday(activeProfile.birthday) === 'under13') {
      showTicketStatus(text.under13BookingBlocked, 'error')
      return false
    }

    if (!validateTicketSelection(activeProfile) || !selectedTimeOption) return false

    const guestContactValidation = activeProfile
      ? { normalizedPhone: '', error: '' }
      : validateGuestTicketContact(guestTicketContact, looseText)

    if (guestContactValidation.error) {
      showTicketStatus(guestContactValidation.error, 'error')
      return false
    }

    const allowed = await consumeAppRateLimit('booking_attempt', `${ticketType}:${ticketDate}:${ticketTime}`, (message) => showTicketStatus(message, 'error'))
    if (!allowed) return false

    setIsBookingTickets(true)
    showTicketStatus(text.bookingTickets)
    setTicketConfirmation(null)

    const ticketRpcArgs = {
      p_ticket_type: ticketType,
      p_date: ticketDate,
      p_start_time: `${ticketTime}:00`,
      p_duration_minutes: activeTicketDuration,
      p_player_count: ticketPlayers,
      p_arena_count: activeTicketArenaCount,
      p_game_options: [service.defaultGame],
      p_unit_price: isSpecialTicketType ? 0 : currentTicketUnitPrice,
      p_total_price: isSpecialTicketType ? 0 : currentTicketTotalPrice,
    }
    const trimmedTicketSpecialNote = ticketSpecialNote.trim().slice(0, 500)

    const { data, error } = activeProfile
      ? await (await getSupabase()).rpc('create_ticket_booking', {
        ...ticketRpcArgs,
        p_loyalty_points_to_redeem: isSpecialTicketType ? 0 : appliedTicketLoyaltyPoints,
        p_discount_code: !isSpecialTicketType && ticketDiscountQuote ? normalizedTicketDiscountCode : null,
        ...(isSpecialTicketType ? { p_special_note: trimmedTicketSpecialNote || null } : {}),
      })
      : await (await getSupabase()).rpc('create_guest_ticket_booking', {
        ...ticketRpcArgs,
        p_guest_name: guestTicketContact.name.trim() || null,
        p_guest_phone: guestContactValidation.normalizedPhone,
        ...(isSpecialTicketType ? { p_guest_note: trimmedTicketSpecialNote || null } : {}),
      })

    if (error) {
      showTicketStatus(error.message || text.ticketBookingError, 'error')
      setIsBookingTickets(false)
      return false
    }

    const booking = (data || {}) as {
      discount_amount?: number | null
      discount_code?: string | null
      loyalty_points_total?: number | null
      session_id?: string
      ticket_reference?: string
    }
    const confirmation: TicketBookingConfirmation = {
      sessionId: booking.session_id || '',
      reference: booking.ticket_reference || '',
      ticketType,
      ticketLabel: ticketTypeLabel(ticketType, looseText),
      date: ticketDate,
      time: ticketTime,
      players: ticketPlayers,
      totalPrice: isSpecialTicketType ? 0 : currentTicketTotalPrice,
      guestPhone: activeProfile ? undefined : guestContactValidation.normalizedPhone,
      guestName: activeProfile ? undefined : guestTicketContact.name.trim() || undefined,
      discountCode: activeProfile && !isSpecialTicketType ? booking.discount_code || undefined : undefined,
      discountAmount: activeProfile && !isSpecialTicketType ? Math.max(0, Math.floor(Number(booking.discount_amount ?? 0) || 0)) : 0,
      loyaltyPointsRedeemed: activeProfile && !isSpecialTicketType ? appliedTicketLoyaltyPoints : 0,
      loyaltyDiscountAmount: activeProfile && !isSpecialTicketType ? ticketLoyaltyDiscountAmount : 0,
    }

    if (!activeProfile && confirmation.guestPhone && confirmation.reference) {
      setPendingGuestTicketClaim({
        phone: confirmation.guestPhone,
        reference: confirmation.reference,
        name: confirmation.guestName,
        date: confirmation.date,
      })
    }

    if (activeProfile && booking.loyalty_points_total !== undefined && booking.loyalty_points_total !== null) {
      const nextPointsTotal = Math.max(0, Math.floor(Number(booking.loyalty_points_total) || 0))
      const nextProfile = { ...activeProfile, loyalty_points_total: nextPointsTotal }
      setProfile(nextProfile)
      syncProfileEverywhere(nextProfile)
      setTicketLoyaltyRedemption((current) => current
        ? { ...current, loyalty_points_total: nextPointsTotal }
        : { loyalty_points_total: nextPointsTotal, redeem_value_vnd_per_point: ticketLoyaltyRedeemValue })
    }

    setTicketConfirmation(confirmation)
    showTicketStatus(text.ticketBookingCreated)
    showActionToast(text.ticketBookingCreated)
    setTicketTime('')
    setTicketUseLoyaltyPoints(false)
    setTicketLoyaltyPointsToRedeem('')
    setTicketDiscountCode('')
    setTicketDiscountQuote(null)
    setTicketDiscountStatus('')
    await notifyMinorBookingCreated('ticket', confirmation.sessionId, activeProfile)
    await loadSessions({ focusDate: ticketDate })
    setIsBookingTickets(false)
    return true
  }

  async function createSession() {
    if (!requireProfile()) {
      setIsCreating(false)
      return
    }

    const activeProfile = profile

    if (!activeProfile) {
      setIsCreating(false)
      return
    }

    if (ageBandFromBirthday(activeProfile.birthday) === 'under13') {
      setCreateStatus(text.under13CreateBlocked)
      setIsCreating(false)
      return
    }

    if (!sessionName.trim() || !sessionDate || !sessionTime) {
      setCreateStatus(text.sessionRequired)
      setIsCreating(false)
      return
    }

    const selectedSessionClub = sessionClubId ? clubs.find((club) => club.id === sessionClubId) : undefined

    if (selectedSessionClub && !canCreateClubSession(selectedSessionClub)) {
      setCreateStatus(text.clubMembershipRequired)
      setIsCreating(false)
      return
    }

    const allowed = await consumeAppRateLimit('booking_attempt', `${sessionDate}:${sessionTime}`)
    if (!allowed) {
      setIsCreating(false)
      return
    }

    setIsCreating(true)
    setCreateStatus(text.creating)

    const effectiveVisibility = selectedSessionClub ? 'public' : sessionVisibility
    const inviteCode = effectiveVisibility === 'private' ? generateInviteCode() : null

    const { data: created, error } = await (await getSupabase())
      .from('sessions')
      .insert({
        owner_id: userId,
        club_id: sessionClubId || null,
        session_type: sessionType,
        name: sessionName.trim(),
        date: sessionDate,
        start_time: `${sessionTime}:00`,
        duration_minutes: sessionDuration,
        max_players: sessionMaxPlayers,
        arena_count: sessionArenaCount,
        game_options: selectedGames,
        game_votes: { [userId]: selectedGames[0] },
        confirmed_game_id: null,
        visibility: effectiveVisibility,
        invite_code: inviteCode,
        notes: sessionNotes.trim() || null,
        status: 'open',
        tournament_format: sessionType === 'tournament' ? tournamentFormat : null,
        best_of: sessionType === 'tournament' ? tournamentBestOf : 1,
        rounds_per_match: sessionType === 'tournament' ? tournamentRoundsPerMatch : null,
        require_payment: sessionType === 'tournament' ? tournamentRequirePayment : false,
        qualification_rule: sessionType === 'tournament' ? tournamentQualificationRule : null,
        custom_qualifiers: sessionType === 'tournament' ? tournamentCustomQualifiers : null,
        enable_third_place_match: sessionType === 'tournament' ? tournamentThirdPlace : false,
        first_prize: sessionType === 'tournament' ? tournamentFirstPrize.trim() || null : null,
        second_prize: sessionType === 'tournament' ? tournamentSecondPrize.trim() || null : null,
        third_prize: sessionType === 'tournament' ? tournamentThirdPrize.trim() || null : null,
        tournament_locked: false,
      })
      .select('id')
      .single()

    if (error || !created) {
      setCreateStatus(error?.message || text.createError)
      setIsCreating(false)
      return
    }

    await (await getSupabase()).from('session_participants').insert({
      session_id: created.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      ...avatarFields(activeProfile),
    })

    if (selectedSessionClub) {
      await notifyClubMembersOfSession(selectedSessionClub, created.id)
    }

    await notifyMinorBookingCreated('session', created.id, activeProfile)

    setCreateStatus(
      sessionVisibility === 'private'
        ? `${text.privateCreated} ${inviteCode}`
        : text.sessionCreated
    )
    showActionToast(sessionVisibility === 'private' ? text.privateCreated : text.sessionCreated)

    setSessionName('')
    setSessionNotes('')
    setSessionTime('')
    setSessionDuration(20)
    setSessionMaxPlayers(4)
    setSessionArenaCount(1)
    setSessionClubId('')
    setSessionType('game')
    setTournamentFormat('pool_to_final')
    setTournamentBestOf(1)
    setTournamentRoundsPerMatch(1)
    setTournamentRequirePayment(false)
    setTournamentQualificationRule('top_1')
    setTournamentCustomQualifiers(2)
    setTournamentThirdPlace(true)
    setTournamentFirstPrize('')
    setTournamentSecondPrize('')
    setTournamentThirdPrize('')
    setSelectedGames(['laser-tag'])
    setSessionVisibility('public')
    await loadSessions({ focusDate: sessionDate })
    setActiveView('sessions')
    setIsCreating(false)
  }

  async function joinSession(session: Session) {
    if (!requireProfile()) return

    if (isTicketSession(session)) {
      setCreateStatus(text.privateTicketSession)
      return
    }

    if (isChallengeSession(session) && session.challenge_target_id !== userId && !hasSessionInvite(session.id, userId)) {
      setCreateStatus(text.challengeInviteOnly)
      return
    }

    const activeProfile = profile

    if (!activeProfile) return

    const sessionClub = sessionClubFor(session)
    if (sessionClub && !canAccessClubSession(session)) {
      setCreateStatus(text.clubMembershipRequired)
      return
    }

    const joinsWithPrivateCode = session.visibility === 'private' && !hasSessionInvite(session.id, userId)

    if (joinsWithPrivateCode) {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (!typedCode) {
        setCreateStatus(text.privateIncorrect)
        return
      }
    }

    const participants = session.session_participants ?? []
    if (participants.some((participant) => participant.profile_id === userId)) return

    if (participants.length >= session.max_players) {
      setCreateStatus(text.sessionFull)
      return
    }

    const allowed = await consumeAppRateLimit('join_leave', `join:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)

    const avatarPayload = avatarFields(activeProfile)
    const client = await getSupabase()
    let joinedParticipant: Participant | null = null
    const joinResult = joinsWithPrivateCode
      ? await client.rpc('join_private_session_with_code', {
        p_session_id: session.id,
        p_invite_code: (joinCodes[session.id] || '').trim().toUpperCase(),
        p_display_name: displayName(activeProfile),
        p_avatar_url: avatarPayload.avatar_url,
        p_avatar_emoji: avatarPayload.avatar_emoji,
        p_avatar_initials: avatarPayload.avatar_initials,
        p_avatar_color: avatarPayload.avatar_color,
        p_avatar_text_color: avatarPayload.avatar_text_color,
        p_profile_motto: avatarPayload.profile_motto,
      })
      : await client.from('session_participants').insert({
        session_id: session.id,
        profile_id: userId,
        display_name: displayName(activeProfile),
        ...avatarPayload,
      })

    if (joinResult.error) {
      setCreateStatus(joinResult.error.message)
      setBusySessionId('')
      return
    }

    joinedParticipant = await fetchCurrentUserSessionParticipant(session.id)

    mergeJoinedParticipantIntoSession(session.id, joinedParticipant)

    await client
      .from('session_waitlist')
      .delete()
      .eq('session_id', session.id)
      .eq('profile_id', userId)

    await client
      .from('session_invites')
      .update({ status: 'accepted' })
      .eq('session_id', session.id)
      .eq('recipient_id', userId)

    await loadSessions({ focusDate: session.date })
    await loadSessionDetail(session.id, { force: true })
    mergeJoinedParticipantIntoSession(session.id, joinedParticipant)
    await loadNetworkData()
    setBusySessionId('')
    setCreateStatus(text.joinedSession)
    showActionToast(text.joinedSession)
    await prepareJoinedSessionReminders(session)
  }

  async function joinWaitlist(session: Session) {
    if (!requireProfile()) return

    if (isTicketSession(session)) {
      setCreateStatus(text.privateTicketSession)
      return
    }

    if (isChallengeSession(session)) {
      setCreateStatus(text.challengeInviteOnly)
      return
    }

    const activeProfile = profile
    if (!activeProfile) return

    const sessionClub = sessionClubFor(session)
    if (sessionClub && !canAccessClubSession(session)) {
      setCreateStatus(text.clubMembershipRequired)
      return
    }

    const waitlistsWithPrivateCode = session.visibility === 'private' && !hasSessionInvite(session.id, userId)

    if (waitlistsWithPrivateCode) {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (!typedCode) {
        setCreateStatus(text.privateIncorrect)
        return
      }
    }

    const participants = session.session_participants ?? []
    if (participants.some((participant) => participant.profile_id === userId)) return
    if (waitlistPosition(session, userId)) return

    const allowed = await consumeAppRateLimit('join_leave', `waitlist:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)

    const avatarPayload = avatarFields(activeProfile)
    const waitlistResult = waitlistsWithPrivateCode
      ? await (await getSupabase()).rpc('join_private_session_waitlist_with_code', {
        p_session_id: session.id,
        p_invite_code: (joinCodes[session.id] || '').trim().toUpperCase(),
        p_display_name: displayName(activeProfile),
        p_avatar_url: avatarPayload.avatar_url,
        p_avatar_emoji: avatarPayload.avatar_emoji,
        p_avatar_initials: avatarPayload.avatar_initials,
        p_avatar_color: avatarPayload.avatar_color,
        p_avatar_text_color: avatarPayload.avatar_text_color,
        p_profile_motto: avatarPayload.profile_motto,
      })
      : await (await getSupabase()).from('session_waitlist').insert({
        session_id: session.id,
        profile_id: userId,
        display_name: displayName(activeProfile),
        ...avatarPayload,
      })

    if (waitlistResult.error) {
      setCreateStatus(waitlistResult.error.message)
      setBusySessionId('')
      return
    }

    await loadSessions({ focusDate: session.date })
    setCreateStatus(text.waitlistJoined)
    setBusySessionId('')
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

  async function postSessionMessage(session: Session, messageType: 'announcement' | 'comment') {
    if (!requireProfile() || !profile) return
    if (ageBandFromBirthday(profile.birthday) === 'under13') {
      setCreateStatus(text.under13MessageBlocked)
      return
    }
    if (messageType === 'announcement' && !canReviewSessionMessages(session)) return

    const draft = (messageType === 'announcement' ? announcementDrafts[session.id] : commentDrafts[session.id]) || ''
    const body = draft.trim()
    if (!body) return

    const messageKey = `${session.id}-${messageType}`
    setBusyMessageKey(messageKey)

    const { data, error } = await (await getSupabase()).functions.invoke('post-session-message', {
      body: {
        session_id: session.id,
        message_type: messageType,
        body,
      },
    })

    const message = data?.message as SessionMessage | undefined

    if (error) {
      setCreateStatus(error.message)
    } else {
      if (messageType === 'announcement') {
        setAnnouncementDrafts((current) => ({ ...current, [session.id]: '' }))
      } else {
        setCommentDrafts((current) => ({ ...current, [session.id]: '' }))
      }
      if (message) {
        mergeSessionMessage(message)
      } else {
        await loadSessionMessages(session.id, { force: true })
      }
      setCreateStatus(message?.moderation_status === 'pending_review' ? text.messagePendingReview : text.messagePosted)
    }

    setBusyMessageKey('')
  }

  async function postClubMessage(club: Club, messageType: ClubMessage['message_type']) {
    if (!requireProfile() || !profile) return
    if (ageBandFromBirthday(profile.birthday) === 'under13') {
      setClubMessageStatus(text.under13MessageBlocked)
      return
    }
    if (!canUseClubMessages(club)) {
      setClubMessageStatus(text.clubMessageLoginRequired)
      return
    }

    const drafts = messageType === 'public' ? clubPublicMessageDrafts : clubAdminMessageDrafts
    const body = (drafts[club.id] || '').trim()
    if (!body) return

    if (Array.from(body).length > CLUB_MESSAGE_MAX_LENGTH) {
      setClubMessageStatus(text.clubMessageTooLong)
      return
    }

    const messageKey = `${club.id}-${messageType}`
    setBusyMessageKey(messageKey)
    setClubMessageStatus('')

    const avatarSnapshot = profileAvatarSnapshot(profile)
    const { data, error } = await (await getSupabase())
      .from('club_messages')
      .insert({
        club_id: club.id,
        author_id: userId,
        author_display_name: avatarSnapshot.display_name,
        author_avatar_url: avatarSnapshot.avatar_url,
        author_avatar_emoji: avatarSnapshot.avatar_emoji,
        author_avatar_initials: avatarSnapshot.avatar_initials,
        author_avatar_color: avatarSnapshot.avatar_color,
        author_avatar_text_color: avatarSnapshot.avatar_text_color,
        author_profile_motto: avatarSnapshot.profile_motto || null,
        message_type: messageType,
        body,
      })
      .select(CLUB_MESSAGE_SELECT)
      .single()

    if (error) {
      setClubMessageStatus(error.message)
    } else {
      if (messageType === 'public') {
        setClubPublicMessageDrafts((current) => ({ ...current, [club.id]: '' }))
      } else {
        setClubAdminMessageDrafts((current) => ({ ...current, [club.id]: '' }))
      }
      if (data) mergeClubMessage(data as ClubMessage)
      loadedClubMessagesRef.current.add(club.id)
      setClubMessageStatus(text.clubMessagePosted)
    }

    setBusyMessageKey('')
  }

  async function reviewSessionMessage(message: SessionMessage, status: 'approved' | 'rejected') {
    if (!requireProfile()) return

    setBusyMessageKey(`${message.id}-${status}`)
    const { error } = await (await getSupabase())
      .from('session_messages')
      .update({
        moderation_status: status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', message.id)

    if (error) {
      setCreateStatus(error.message)
    } else {
      setCreateStatus(status === 'approved' ? text.messageApproved : text.messageRejected)
      const reviewedAt = new Date().toISOString()
      setSessionMessages((current) => sortSessionMessages(current.map((item) => (
        item.id === message.id
          ? { ...item, moderation_status: status, reviewed_by: userId, reviewed_at: reviewedAt }
          : item
      ))))
    }

    setBusyMessageKey('')
  }

  async function deleteSessionMessage(message: SessionMessage) {
    if (!requireProfile()) return
    if (!isAdmin) {
      setCreateStatus(text.adminOnlyAction)
      return
    }

    const confirmed = window.confirm(text.deleteMessageConfirm)
    if (!confirmed) return

    setBusyMessageKey(`${message.id}-delete`)
    const { error } = await softDeleteRecord('session_messages', message.id, 'Admin deleted message')

    if (error) {
      setCreateStatus(error.message)
    } else {
      setCreateStatus(text.messageDeleted)
      setSessionMessages((current) => current.filter((item) => item.id !== message.id))
    }

    setBusyMessageKey('')
  }

  async function leaveSession(session: Session) {
    if (!requireProfile()) return

    if (session.owner_id === userId) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.leaveConfirmPrefix} "${session.name}"? ${text.leaveConfirmSuffix}`)
    if (!confirmed) return

    const participant = (session.session_participants ?? []).find((item) => item.profile_id === userId)
    if (!participant) return

    const allowed = await consumeAppRateLimit('join_leave', `leave:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)
    const { error } = await softDeleteRecord('session_participants', participant.id, 'User left session')

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.leftSession)
    setBusySessionId('')
  }

  async function voteForGame(session: Session, gameId: GameId) {
    if (!requireProfile()) return
    if (isPastSession(session) && !canManageSession(session)) return

    const voteKey = `${session.id}-${gameId}`
    setBusyVoteKey(voteKey)
    const votes = { ...(session.game_votes || {}), [userId]: gameId }
    const { error } = await (await getSupabase()).from('sessions').update({ game_votes: votes }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusyVoteKey('')
      return
    }

    await loadSessions()
    setCreateStatus(text.voteSaved)
    setBusyVoteKey('')
  }

  async function confirmPlayedGame(session: Session) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyEdit)
      return
    }

    const selectedGameId = confirmedGameDrafts[session.id] || session.confirmed_game_id || ''
    const validGameId = games.some((game) => game.id === selectedGameId) ? selectedGameId : null

    setBusySessionId(session.id)
    const { error } = await (await getSupabase())
      .from('sessions')
      .update({ confirmed_game_id: validGameId })
      .eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    setSessions((current) =>
      current.map((item) =>
        item.id === session.id
          ? { ...item, confirmed_game_id: validGameId as GameId | null }
          : item
      )
    )
    setConfirmedGameDrafts((current) => ({ ...current, [session.id]: validGameId || '' }))
    await loadSessions()
    setCreateStatus(text.confirmedPlayedGame)
    setBusySessionId('')
  }

  function toggleEditGame(gameId: GameId) {
    setEditSelectedGames((current) => {
      if (current.includes(gameId)) {
        return current.length === 1 ? current : current.filter((id) => id !== gameId)
      }
      return [...current, gameId]
    })
  }

  async function startEditingSession(session: Session) {
    if (isAdmin) ensureAllProfilesLoaded()
    const fullSession = sessionDetailsLoadedRef.current.has(session.id)
      ? session
      : (await loadSessionDetail(session.id)) || session

    setEditingSessionId(session.id)
    setEditSessionName(fullSession.name)
    setEditSessionDate(fullSession.date)
    setEditSessionTime(fullSession.start_time.slice(0, 5))
    setEditSessionDuration(fullSession.duration_minutes)
    setEditSessionMaxPlayers(fullSession.max_players)
    setEditSessionArenaCount(arenasUsedBySession(fullSession))
    setEditSessionVisibility(fullSession.visibility)
    setEditSessionNotes(fullSession.notes || '')
    setEditSelectedGames(fullSession.game_options?.length ? fullSession.game_options : ['laser-tag'])
    setEditBookingType(fullSession.booking_type || 'community')
    setEditTicketCustomerId(fullSession.ticket_customer_id || fullSession.owner_id)
    setEditTicketType(fullSession.ticket_type || 'individual')
    setEditTicketTotalPrice(String(fullSession.ticket_total_price ?? ''))
    setEditTicketStatus(fullSession.ticket_status || 'confirmed')
    setEditTournamentFormat(fullSession.tournament_format || 'pool_to_final')
    setEditTournamentBestOf((fullSession.best_of || 1) as 1 | 3 | 5)
    setEditTournamentRoundsPerMatch(fullSession.rounds_per_match || 1)
    setEditTournamentRequirePayment(Boolean(fullSession.require_payment))
    setEditTournamentQualificationRule(fullSession.qualification_rule || 'top_1')
    setEditTournamentCustomQualifiers(fullSession.custom_qualifiers || 2)
    setEditTournamentThirdPlace(Boolean(fullSession.enable_third_place_match))
    setEditTournamentFirstPrize(fullSession.first_prize || '')
    setEditTournamentSecondPrize(fullSession.second_prize || '')
    setEditTournamentThirdPrize(fullSession.third_prize || '')
    setCreateStatus('')
  }

  function stopEditingSession() {
    setEditingSessionId('')
    setIsUpdatingSession(false)
  }

  async function sendSessionUpdateNotification(
    session: Session,
    payload: {
      action: 'edited' | 'cancelled' | 'deleted'
      summary: string
      changes?: Array<{ label: string; before?: string | number | boolean | null; after?: string | number | boolean | null }>
    },
  ) {
    try {
      await notifyBookingUpdateEmail(await getSupabase(), {
        action: payload.action,
        bookingKind: bookingUpdateKind(session),
        sessionId: session.id,
        title: session.name,
        reference: session.ticket_reference || null,
        date: session.date,
        time: session.start_time.slice(0, 5),
        total: session.ticket_total_price ?? null,
        summary: payload.summary,
        changes: payload.changes || [],
        source: 'Player booking flow',
      })
    } catch (error) {
      console.warn('Could not send booking update email.', error)
    }
  }

  async function updateSession(session: Session) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyEdit)
      return
    }

    const participants = session.session_participants ?? []

    if (!editSessionName.trim() || !editSessionDate || !editSessionTime) {
      setCreateStatus(text.sessionRequired)
      return
    }

    if (editSessionMaxPlayers < participants.length) {
      setCreateStatus(text.maxPlayersBelowJoined)
      return
    }

    setIsUpdatingSession(true)
    setCreateStatus(text.savingSession)

    const effectiveEditVisibility = session.club_id ? 'public' : editBookingType === 'ticket' || editBookingType === 'challenge' ? 'private' : editSessionVisibility
    const inviteCode =
      effectiveEditVisibility === 'private'
        ? session.invite_code || generateInviteCode()
        : null
    const tournament = tournamentForSession(session.id)
    const hasTournamentBracket = tournament.pools.length > 0 || tournament.matches.length > 0
    const ticketEditDuration = editSessionDuration
    const ticketEditArenaCount = editBookingType === 'ticket'
      ? ticketArenaCountForPlayers()
      : editSessionArenaCount
    const ticketEditPricing = ticketPricingSummary(editTicketType, editSessionDate, editSessionTime, editSessionMaxPlayers, ticketEditDuration)
    const sanitizedTicketTotal = Math.max(0, Math.round(Number(editTicketTotalPrice) || ticketEditPricing.totalPrice))

    const { error } = await (await getSupabase())
      .from('sessions')
      .update({
        name: editSessionName.trim(),
        ...(isAdmin && editBookingType === 'ticket' && editTicketCustomerId ? { owner_id: editTicketCustomerId } : {}),
        date: editSessionDate,
        start_time: `${editSessionTime}:00`,
        duration_minutes: ticketEditDuration,
        max_players: editSessionMaxPlayers,
        arena_count: ticketEditArenaCount,
        game_options: editSelectedGames,
        visibility: effectiveEditVisibility,
        invite_code: inviteCode,
        notes: editSessionNotes.trim() || null,
        ...(isAdmin
          ? {
            booking_type: editBookingType,
            ticket_customer_id: editBookingType === 'ticket' ? editTicketCustomerId || null : null,
            ticket_type: editBookingType === 'ticket' ? editTicketType : null,
            ticket_player_count: editBookingType === 'ticket' ? editSessionMaxPlayers : null,
            ticket_total_price: editBookingType === 'ticket' ? sanitizedTicketTotal : null,
            ticket_unit_price: editBookingType === 'ticket' ? ticketEditPricing.baseUnitPrice : null,
            ticket_status: editBookingType === 'ticket' ? editTicketStatus : null,
          }
          : {}),
        ...(session.session_type === 'tournament'
          ? {
            tournament_format: hasTournamentBracket ? session.tournament_format : editTournamentFormat,
            best_of: hasTournamentBracket ? session.best_of : editTournamentBestOf,
            rounds_per_match: editTournamentRoundsPerMatch,
            require_payment: editTournamentRequirePayment,
            qualification_rule: hasTournamentBracket ? session.qualification_rule : editTournamentQualificationRule,
            custom_qualifiers: hasTournamentBracket ? session.custom_qualifiers : editTournamentCustomQualifiers,
            enable_third_place_match: editTournamentThirdPlace,
            first_prize: editTournamentFirstPrize.trim() || null,
            second_prize: editTournamentSecondPrize.trim() || null,
            third_prize: editTournamentThirdPrize.trim() || null,
          }
          : {}),
      })
      .eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setIsUpdatingSession(false)
      return
    }

    await loadSessions({ focusDate: editSessionDate })
    void sendSessionUpdateNotification(session, {
      action: editBookingType === 'ticket' && editTicketStatus === 'cancelled' ? 'cancelled' : 'edited',
      summary: editBookingType === 'ticket' && editTicketStatus === 'cancelled'
        ? 'Booking status was changed to cancelled.'
        : 'Booking details were edited.',
      changes: bookingUpdateChanges([
        ['Name', session.name, editSessionName.trim()],
        ['Date', session.date, editSessionDate],
        ['Time', session.start_time.slice(0, 5), editSessionTime],
        ['Duration', session.duration_minutes, ticketEditDuration],
        ['Max players', session.max_players, editSessionMaxPlayers],
        ['Visibility', session.visibility, effectiveEditVisibility],
        ['Ticket status', session.ticket_status, editBookingType === 'ticket' ? editTicketStatus : session.ticket_status],
        ['Total', session.ticket_total_price, editBookingType === 'ticket' ? sanitizedTicketTotal : session.ticket_total_price],
      ]),
    })
    setCreateStatus(effectiveEditVisibility === 'private' ? `${text.privateUpdated} ${inviteCode}` : text.sessionUpdated)
    stopEditingSession()
  }

  async function cancelSession(session: Session) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyCancel)
      return
    }

    const confirmed = window.confirm(`${text.cancelConfirmPrefix} "${session.name}"? ${text.cancelConfirmSuffix}`)
    if (!confirmed) return

    const allowed = await consumeAppRateLimit('admin_destructive', `cancel-session:${session.id}`)
    if (!allowed) return

    setBusySessionId(session.id)
    const { error } = await (await getSupabase()).from('sessions').update({ status: 'cancelled' }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    void sendSessionUpdateNotification(session, {
      action: 'cancelled',
      summary: 'Booking status was changed to cancelled.',
      changes: [{ label: 'Status', before: session.status, after: 'cancelled' }],
    })
    setCreateStatus(text.sessionCancelled)
    setBusySessionId('')
  }

  async function removeParticipant(session: Session, participant: Participant) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyRemove)
      return
    }

    if (participant.profile_id === session.owner_id) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.removeConfirmPrefix} ${participant.display_name || text.removeConfirmFallback} ${text.fromSession} "${session.name}"?`)
    if (!confirmed) return

    setBusySessionId(session.id)
    const { error } = await softDeleteRecord('session_participants', participant.id, 'Removed from session')

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.playerRemoved)
    setBusySessionId('')
  }

  async function deleteMyAccount() {
    if (!profile || !userId) return

    const confirmed = window.confirm(text.deleteAccountConfirm)
    if (!confirmed) return

    setIsDeletingAccount(true)
    setProfileStatus(text.saving)

    const { error } = await softDeleteRecord('profiles', userId, 'User deleted own account')

    if (error) {
      setProfileStatus(error.message)
      setIsDeletingAccount(false)
      return
    }

    await (await getSupabase()).auth.signOut()
    setUserId('')
    setAuthEmail('')
    setProfile(null)
    setNewPassword('')
    setProfileStatus(text.accountDeleted)
    setIsDeletingAccount(false)
    await loadSessions()
  }

  function tournamentStageLabel(stage: TournamentMatch['stage']) {
    return stage.replace('_', ' ')
  }

  async function addTournamentEditor(session: Session, selectedEditor?: Profile) {
    if (!isSessionCreator(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const email = tournamentEditorEmail.trim().toLowerCase()
    if (!email && !selectedEditor) return

    setBusyTournamentId(session.id)
    const profileLookup = selectedEditor
      ? { data: selectedEditor, error: null }
      : await (await getSupabase()).rpc('public_profile_search', {
        p_search: email,
        p_limit: 1,
      }).then(({ data, error }) => ({ data: (data ?? [])[0] as Profile | undefined, error }))

    const editorProfile = profileLookup.data
    if (profileLookup.error || !editorProfile) {
      setCreateStatus(profileLookup.error?.message || text.editorNotFound)
      setBusyTournamentId('')
      return
    }

    const display = compactDisplayName(displayName(editorProfile), text.player)
    const { error } = await (await getSupabase()).from('tournament_editors').upsert({
      session_id: session.id,
      profile_id: editorProfile.id,
      display_name: display,
      ...avatarFields(editorProfile),
    }, { onConflict: 'session_id,profile_id' })

    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    setTournamentEditorEmail('')
    setTournamentEditorResults([])
    await loadTournamentData()
    setCreateStatus(text.profileSaved)
    setBusyTournamentId('')
  }

  async function setupTournamentPools(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const participants = eligibleTournamentParticipants(session)
    if (participants.length < 2) {
      setCreateStatus(text.noTournamentData)
      return
    }

    setBusyTournamentId(session.id)
    const softDeleteResult = await softDeleteTournamentRecords(session.id, true, 'Tournament pools regenerated')
    if (softDeleteResult.error) {
      setCreateStatus(softDeleteResult.error.message)
      setBusyTournamentId('')
      return
    }

    const format = session.tournament_format || 'pool_to_final'
    const seededParticipants = shuffleItems(participants)
    const poolCount = format === 'single_elimination'
      ? 1
      : Math.max(1, Math.ceil(seededParticipants.length / tournamentPoolSize))
    const poolRows = Array.from({ length: poolCount }, (_, index) => ({
      session_id: session.id,
      name: format === 'single_elimination' ? 'Knockout' : `Pool ${String.fromCharCode(65 + index)}`,
      sort_order: index + 1,
    }))

    const { data: pools, error: poolError } = await (await getSupabase())
      .from('tournament_pools')
      .insert(poolRows)
      .select('id, session_id, name, sort_order')

    if (poolError || !pools) {
      setCreateStatus(poolError?.message || text.createError)
      setBusyTournamentId('')
      return
    }

    const entries = seededParticipants.map((participant, index) => {
      const pool = pools[index % pools.length]
      return {
        session_id: session.id,
        pool_id: pool.id,
        participant_id: participant.id,
        profile_id: participant.profile_id,
        seed: index + 1,
      }
    })

    const { error } = await (await getSupabase()).from('tournament_pool_entries').insert(entries)
    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    await loadTournamentData()
    setCreateStatus(text.tournamentSetup)
    setBusyTournamentId('')
  }

  async function generateTournamentMatches(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    if (!data.pools.length || !data.poolEntries.length) {
      setCreateStatus(text.noTournamentData)
      return
    }

    setBusyTournamentId(session.id)
    const softDeleteResult = await softDeleteTournamentRecords(session.id, false, 'Tournament matches regenerated')
    if (softDeleteResult.error) {
      setCreateStatus(softDeleteResult.error.message)
      setBusyTournamentId('')
      return
    }

    const bestOf = session.best_of || 1
    const format = session.tournament_format || 'pool_to_final'
    const matchRows: TournamentMatchInsert[] = format === 'single_elimination'
      ? buildKnockoutRows(session.id, data.poolEntries.map((entry) => entry.participant_id), 'custom', 1, bestOf)
      : data.pools.flatMap((pool) => {
      const poolEntries = data.poolEntries.filter((entry) => entry.pool_id === pool.id)
      const rows: TournamentMatchInsert[] = []
      let matchNumber = 1

      for (let i = 0; i < poolEntries.length; i += 1) {
        for (let j = i + 1; j < poolEntries.length; j += 1) {
          rows.push({
            session_id: session.id,
            pool_id: pool.id,
            stage: 'pool',
            round: 1,
            match_number: matchNumber,
            participant_a_id: poolEntries[i].participant_id,
            participant_b_id: poolEntries[j].participant_id,
            status: 'waiting',
            arena_number: null,
            queue_position: matchNumber,
            best_of: bestOf,
          })
          matchNumber += 1
        }
      }

      return rows
    })

    if (!matchRows.length) {
      setCreateStatus(text.noTournamentData)
      setBusyTournamentId('')
      return
    }

    const { error } = await (await getSupabase()).from('tournament_matches').insert(matchRows)
    if (error) {
      setCreateStatus(error.message)
      setBusyTournamentId('')
      return
    }

    await logTournamentAudit(session.id, 'Tournament matches generated', null, { format, bestOf, matchCount: matchRows.length })
    await loadTournamentData()
    setCreateStatus(text.tournamentGenerateMatches)
    setBusyTournamentId('')
  }

  async function updateTournamentPoolEntry(entry: TournamentPoolEntry, changes: Partial<TournamentPoolEntry>) {
    const { error } = await (await getSupabase())
      .from('tournament_pool_entries')
      .update({
        pool_id: changes.pool_id ?? entry.pool_id,
        team_label: changes.team_label ?? entry.team_label ?? null,
      })
      .eq('id', entry.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(entry.session_id, 'Pool entry edited', entry as unknown as Record<string, unknown>, changes as Record<string, unknown>)
    await loadTournamentData()
  }

  async function updateTournamentMatch(match: TournamentMatch, changes: Partial<TournamentMatch>) {
    const nextA = changes.participant_a_id ?? match.participant_a_id
    const nextB = changes.participant_b_id ?? match.participant_b_id
    if (hasDuplicateMatchPlayers({ participant_a_id: nextA, participant_b_id: nextB })) {
      setCreateStatus(text.duplicateMatchPlayer)
      return
    }

    const scoreA = changes.score_a ?? match.score_a
    const scoreB = changes.score_b ?? match.score_b
    const draft = {
      ...match,
      ...changes,
      participant_a_id: nextA,
      participant_b_id: nextB,
      score_a: scoreA,
      score_b: scoreB,
      wins_a: changes.wins_a ?? match.wins_a,
      wins_b: changes.wins_b ?? match.wins_b,
      best_of: changes.best_of ?? match.best_of,
    }
    const autoWinner = matchWinnerFromSeries(draft)
    const winner = changes.winner_participant_id ?? autoWinner ?? match.winner_participant_id
    const loser = matchLoser(draft, winner || null)
    const { error } = await (await getSupabase())
      .from('tournament_matches')
      .update({
        participant_a_id: nextA,
        participant_b_id: nextB,
        score_a: scoreA,
        score_b: scoreB,
        wins_a: changes.wins_a ?? match.wins_a ?? null,
        wins_b: changes.wins_b ?? match.wins_b ?? null,
        winner_participant_id: winner || null,
        loser_participant_id: loser || null,
        status: changes.status ?? (winner ? 'completed' : match.status === 'completed' ? 'waiting' : match.status),
        arena_number: changes.arena_number ?? match.arena_number ?? null,
        queue_position: changes.queue_position ?? match.queue_position ?? null,
      })
      .eq('id', match.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(match.session_id, 'Match edited', match as unknown as Record<string, unknown>, changes as Record<string, unknown>)
    await loadTournamentData()
  }

  async function advanceTournamentRound(session: Session) {
    if (tournamentLocked(session)) {
      setCreateStatus(text.tournamentLockedAction)
      return
    }

    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    const format = session.tournament_format || 'pool_to_final'
    const bestOf = session.best_of || 1
    let qualified: string[] = []

    if (format === 'pool_to_final' || format === 'pool_to_semifinal' || format === 'pool_only' || format === 'leaderboard') {
      const perPool = qualificationCount(session.qualification_rule, session.custom_qualifiers || 2)
      qualified = data.pools.flatMap((pool) => poolStandingsForSession(session, pool).slice(0, perPool).map((standing) => standing.participantId))
      if (format === 'pool_only' || format === 'leaderboard') {
        setCreateStatus(text.tournamentPoolFinal)
        return
      }
    } else {
      const latestRound = Math.max(1, ...data.matches.map((match) => match.round))
      qualified = data.matches
        .filter((match) => match.round === latestRound && match.winner_participant_id)
        .map((match) => match.winner_participant_id as string)
    }

    qualified = Array.from(new Set(qualified)).filter(Boolean)

    if (qualified.length < 2) {
      setCreateStatus(text.noTournamentData)
      return
    }

    const existingKnockout = data.matches.some((match) => match.stage !== 'pool')
    const nextRound = existingKnockout ? Math.max(1, ...data.matches.map((match) => match.round)) + 1 : 2
    const desired = format === 'pool_to_final' ? qualified.slice(0, 2) : qualified
    const stage: MatchStage = format === 'pool_to_final' ? 'final' : knockoutStageForCount(desired.length)
    const matchRows = buildKnockoutRows(session.id, desired, stage, nextRound, bestOf)

    const { error } = await (await getSupabase()).from('tournament_matches').insert(matchRows)
    if (error) {
      setCreateStatus(error.message)
      return
    }

    await logTournamentAudit(session.id, 'Round advanced', null, { qualified: desired, stage, round: nextRound })
    await loadTournamentData()
    setCreateStatus(text.tournamentNextRound)
  }

  async function finishTournament(session: Session) {
    if (!canEditTournamentSession(session)) {
      setCreateStatus(text.tournamentControlOnly)
      return
    }

    const data = tournamentForSession(session.id)
    const finalMatch = [...data.matches].reverse().find((match) => match.stage === 'final' && match.winner_participant_id)
    const thirdMatch = [...data.matches].reverse().find((match) => match.stage === 'third_place' && match.winner_participant_id)
    const semifinalLosers = data.matches
      .filter((match) => match.stage === 'semifinal' && match.loser_participant_id)
      .map((match) => match.loser_participant_id as string)

    const standingsPodium = data.pools
      .flatMap((pool) => poolStandingsForSession(session, pool))
      .sort((a, b) => b.points - a.points || b.scoreDifference - a.scoreDifference || b.scoreFor - a.scoreFor)
      .map((standing) => standing.participantId)

    const first = finalMatch?.winner_participant_id || standingsPodium[0] || null
    const second = finalMatch ? matchLoser(finalMatch, first) : standingsPodium.find((id) => id !== first) || null
    const third = thirdMatch?.winner_participant_id || semifinalLosers.find((id) => id !== second && id !== first) || standingsPodium.find((id) => id !== first && id !== second) || null

    if (!first) {
      setCreateStatus(text.tournamentFinishNeedsFinal)
      return
    }

    if (first) await (await getSupabase()).from('session_participants').update({ placement: 1 }).eq('id', first)
    if (second) await (await getSupabase()).from('session_participants').update({ placement: 2 }).eq('id', second)
    if (third) await (await getSupabase()).from('session_participants').update({ placement: 3 }).eq('id', third)
    await (await getSupabase()).from('sessions').update({ status: 'completed', tournament_locked: true }).eq('id', session.id)

    await logTournamentAudit(session.id, 'Tournament finished', null, { first, second, third })
    await loadSessions()
    await loadTournamentData()
    setCreateStatus(text.tournamentFinished)
  }

  async function createThirdPlaceMatch(session: Session) {
    if (!canEditTournamentSession(session) || !session.enable_third_place_match) return
    const data = tournamentForSession(session.id)
    if (data.matches.some((match) => match.stage === 'third_place')) return

    const losers = data.matches
      .filter((match) => match.stage === 'semifinal' && match.loser_participant_id)
      .map((match) => match.loser_participant_id as string)

    if (losers.length < 2 || new Set(losers).size < 2) return

    const { error } = await (await getSupabase()).from('tournament_matches').insert({
      session_id: session.id,
      pool_id: null,
      stage: 'third_place',
      round: Math.max(1, ...data.matches.map((match) => match.round)) + 1,
      match_number: 1,
      participant_a_id: losers[0],
      participant_b_id: losers[1],
      status: 'waiting',
      queue_position: 99,
      best_of: session.best_of || 1,
    })

    if (!error) {
      await logTournamentAudit(session.id, 'Bronze match created', null, { participants: losers.slice(0, 2) })
      await loadTournamentData()
    }
  }

  async function claimPrize(participant: Participant, claimed: boolean) {
    const { error } = await (await getSupabase())
      .from('session_participants')
      .update({
        prize_claimed: claimed,
        prize_claimed_at: claimed ? new Date().toISOString() : null,
      })
      .eq('id', participant.id)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await loadSessions()
  }

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
      canAccessStaffConsole={canAccessStaffConsole}
      consoleNavigationCollapsed={consoleSidebarCollapsed}
      isChampion={crownedTopPlayer?.profileId === userId}
      language={language}
      onLanguageChange={setLanguage}
      onConsoleNavigationCollapsedChange={(collapsed) => {
        setConsoleSidebarCollapsed(collapsed)
        try {
          window.localStorage.setItem(CONSOLE_SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0')
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

  const profileViewContext = { activeAgeBand, activeTotpFactor, addToCalendarText, authMode, authStep, avatarColor, avatarColorDraft, avatarEmoji, avatarInitials, avatarMode, avatarPreview, avatarTextColor, avatarTextColorDraft, beginTotpEnrollment, bestPerformerCountText, consentWaiverUrl: CONSENT_WAIVER_URL, sessionForInvite, copiedInviteId, leaveSession, cancelSession, busySessionId, startEditingSession, copyInviteCode, openSessionFromProfile, canManageSession: publicCanManageSession, canAccessStaffConsole, canShareCurrentUserStats, captchaContainerRef, chooseAvatarMode, confirmTotpEnrollment, continueAuthFromEmail, crownedTopPlayer, currentUserStatsShared, deleteMyAccount, downloadSessionCalendar, editAuthEmail, failedAvatarUrls, handleAuth, handleAvatarChange, isAdultProfile, isDeletingAccount, isMfaLoading, isOAuthLoading, isPasskeyLoading, isProfileAuthLoading, isRecoveryMode, isResettingPassword, isSavingAnonymousMode, isSavingProfile, isTeenMinorProfile, isUnder13Profile, language, logout, marketingConsent, mfaChallengeCode, mfaEnrollment, mfaQrCodeSrc, mfaRequired, mfaStatus, mfaVerifyCode, mySessions, newPassword, openInvitationText, passkeyButtonRef, pendingInvitationsHintText, pendingInvitationsText, pendingSessionInvites, personalDataConsent, playerStats, privacyPolicyUrl: PRIVACY_POLICY_URL, profile, profileBirthday, profileCountryCode, profileEmail, profileGender, profileInvitesExpanded, profileMotto, profileName, profileNickname, profilePassword, profilePastExpanded, profilePastSessions, profilePhone, profileStatus, profileUpcomingExpanded, profileUpcomingSessions, registerPasskey, rememberFailedAvatarUrl, replayOnboardingTour, rememberLogin, removeTotpFactor, resetCaptcha, saveProfile, sendPasswordReset, setActiveView, setAnonymousConfirmOpen, setAuthMode, setAuthStep, setAvatarColorDraft, setAvatarEmoji, setAvatarInitials, setAvatarTextColorDraft, setMarketingConsent, setMfaChallengeCode, setMfaEnrollment, setMfaStatus, setMfaVerifyCode, setNewPassword, setPersonalDataConsent, setProfileBirthday, setProfileCountryCode, setProfileEmail, setProfileGender, setProfileInvitesExpanded, setProfileMotto, setProfileName, setProfileNickname, setProfilePassword, setProfilePastExpanded, setProfilePhone, setProfileStatus, setProfileUpcomingExpanded, setRememberLogin, setShowPassword, shareCurrentUserStats, showPassword, showProfileFields, signInWithGoogle, signInWithPasskey, termsConditionsUrl: TERMS_CONDITIONS_URL, text, updateAnonymousMode, updateAuthMode, updateAvatarColor, updateAvatarColorDraft, updateAvatarTextColor, updateAvatarTextColorDraft, updateMarketingConsent, updatePasswordFromRecovery, userId, verifyMfaChallenge }

  const sessionsPanelContext = { activeView, announcementDrafts, applyRichTextCommand, commentDrafts, editSelectedGames, editTournamentBestOf, editTournamentCustomQualifiers, editTournamentFirstPrize, editTournamentFormat, editTournamentQualificationRule, editTournamentRequirePayment, editTournamentRoundsPerMatch, editTournamentSecondPrize, editTournamentThirdPlace, editTournamentThirdPrize, handleEditArenaCountChange, handleEditMaxPlayersChange, inviteSearch, setAnnouncementDrafts, setCommentDrafts, setEditSelectedGames, setEditTournamentBestOf, setEditTournamentCustomQualifiers, setEditTournamentFirstPrize, setEditTournamentFormat, setEditTournamentQualificationRule, setEditTournamentRequirePayment, setEditTournamentRoundsPerMatch, setEditTournamentSecondPrize, setEditTournamentThirdPlace, setEditTournamentThirdPrize, setInviteSearch, setInviteModalSessionId, addToCalendarText, addTournamentEditor, advanceTournamentRound, allProfiles, avatarFields, avatarNode, avatarStyle, bestOfLabel, bestPerformerText, busyClubId, busyInviteKey, busyMessageKey, busySessionId, busyTournamentId, busyVoteKey, cancelSession, canAccessClubSession, canEditTournamentSession: publicCanEditTournamentSession, canManageSession: publicCanManageSession, canReviewSessionMessages: publicCanReviewSessionMessages, claimPrize, canSeeClubPrivateData, canStaffExpandTicketSessions, challengeStatusLabel, clubMemberCount, clubMembershipFor, confirmPlayedGame, confirmedGameDrafts, copyInviteCode, copiedInviteId, createThirdPlaceMatch, crownedTopPlayer, createStatus, currentUserStatsShared, dayStripRef, deleteSessionMessage, downloadSessionCalendar, editBookingType, editSessionArenaCount, editSessionDate, editSessionDuration, editSessionDurationRecommendation, editSessionMaxPlayers, editSessionName, editSessionNotes, editSessionTime, editSessionVisibility, editTicketCustomerId, editTicketPricing, editTicketStatus, editTicketTotalPrice, editTicketType, editTimeOptions, editingSessionId, enablePushReminders, expandedNotes, expandedSessions, filteredSessions, finishTournament, formatVnd, friendList, generateTournamentMatches, hasMoreUpcomingSessions, highlightedSessionId, isAdmin,  isEnablingPush, isLoadingMoreSessions, isLoadingPastSessions, isPushSubscribed, isSearchOpen, isSessionCreator, isUpdatingSession, inviteModalSessionId, invitePlayerToSession, invitesForSession, joinClub, joinCodes, joinSession, joinWaitlist, language, leaveSession, loadedSessionDetailIds, loadingSessionDetailIds, loadSessionMessages, looseText, messageTranslationKey, messageTranslations, messagesForSession, networkTablesReady, openClubPage, openPlayerProfile, openSessionFromProfile, participantById, participantName, poolStandingsForSession, pendingInvitationsText, postSessionMessage, previousPlayersForSession, profile, promptLogin, pushReminderStatus, removeParticipant, renderGameGuideTrigger, renderTariffTrigger, requestMessageTranslation, reviewSessionMessage, search, searchShellRef, selectedSessionDate, sessionClubFor, sessionDayOptions, sessionForInvite, sessionMessagePages, sessionReminders, sessionTimeScope, setActiveView, setCheckInTarget, setConfirmedGameDrafts, setEditBookingType, setEditSessionArenaCount, setEditSessionDate, setEditSessionDuration, setEditSessionMaxPlayers, setEditSessionName, setEditSessionNotes, setEditSessionTime, setEditSessionVisibility, setEditTicketCustomerId, setEditTicketStatus, setEditTicketTotalPrice, setEditTicketType, setExpandedNotes, setIsSearchOpen, setJoinCodes, setSearch, setSelectedSessionDate, setSessionExpanded, setSessionTimeScope, setTournamentEditorEmail, setTournamentPoolSize, setupTournamentPools, shareLink, shareTournamentResults, sharedKey, startEditingSession, stopEditingSession, text, toggleMessageOriginal,  tournamentBestOf, tournamentCustomQualifiers, tournamentStageLabel, tournamentEditorEmail, tournamentEditorResults, tournamentFirstPrize, tournamentFormat, tournamentForSession, tournamentLocked, tournamentPoolSize, tournamentQualificationRule, tournamentRequirePayment, tournamentRoleHint, tournamentRoundsPerMatch, tournamentSecondPrize, tournamentThirdPlace, tournamentThirdPrize, toggleEditGame, updateSession, updateSessionMessagePage, updateTournamentMatch, updateTournamentPoolEntry, userId, voteCount, voteForGame, waitlistForSession, waitlistPosition }

  function isUserClub(club: Club) {
    if (!userId) return false
    if (club.owner_id === userId || canManageClub(club)) return true
    return clubMembers(club).some((member) => member.profile_id === userId && member.status === 'approved')
  }

  function nextSessionForClub(club: Club) {
    return sessions
      .filter((session) => session.club_id === club.id && isUpcomingSession(session))
      .sort((left, right) => sessionStartDate(left).getTime() - sessionStartDate(right).getTime())[0]
  }

  function latestMessageForClub(club: Club) {
    return [...messagesForClub(club, 'public'), ...messagesForClub(club, 'admin_private')]
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
        return rightTime - leftTime
      })[0]
  }

  function renderClubCard(club: Club) {
    const members = clubMembers(club)
    const approvedMembers = members.filter((member) => member.status === 'approved')
    const pendingMembers = members.filter((member) => member.status === 'pending')
    const membership = members.find((member) => member.profile_id === userId)
    const canManage = canManageClub(club)
    const canOpenPage = canOpenClubPage(club)
    const canAskPrivateCode = Boolean(userId && club.visibility === 'private' && !canOpenPage)
    const canActivateClubCard = !userId || canOpenPage || canAskPrivateCode
    const canSeeMembers = canSeeClubPrivateData(club)
    const canUseMessages = canOpenPage && canUseClubMessages(club)
    const visibleApprovedMembers = approvedMembers.slice(0, 6)
    const extraApprovedMemberCount = Math.max(0, approvedMembers.length - visibleApprovedMembers.length)
    const nextClubSession = nextSessionForClub(club)
    const latestClubMessage = latestMessageForClub(club)
    const latestClubMessageDate = formatClubActivityDate(latestClubMessage?.created_at)
    const clubPrimaryActionText = !userId
      ? (club.visibility === 'private' ? text.requestJoin : text.viewClub)
      : (!membership && !canManage ? (club.visibility === 'private' ? text.requestJoin : text.joinClub) : text.viewClub)
    const canShowPrimaryAction = !membership || canManage || canOpenPage || !userId

    function handleClubPrimaryAction(event: MouseEvent<HTMLButtonElement>) {
      event.stopPropagation()
      if (!userId || membership || canManage || canOpenPage) {
        openClubPage(club.id)
        return
      }
      joinClub(club)
    }

    return (
      <article
        className={canActivateClubCard ? 'club-card clickable' : 'club-card'}
        key={club.id}
        onClick={canActivateClubCard ? () => openClubPage(club.id) : undefined}
        onKeyDown={canActivateClubCard ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openClubPage(club.id)
          }
        } : undefined}
        style={clubThemeStyle(club)}
        role={canActivateClubCard ? 'button' : undefined}
        tabIndex={canActivateClubCard ? 0 : undefined}
      >
        <div className={club.banner_url ? 'club-card-cover has-banner' : 'club-card-cover'}>
          {club.banner_url && <NextImage src={club.banner_url} alt="" fill loading="eager" sizes="(max-width: 720px) 100vw, 720px" />}
          <div className="club-card-cover-copy">
            <span className={club.visibility === 'private' ? 'pill private' : 'pill ok'}>
              {club.visibility === 'private' ? text.private : text.public}
            </span>
            {membership?.status === 'pending' && <span className="pill">{text.pending}</span>}
          </div>
        </div>

        <div className="club-card-main">
          <div>
            <h3>{club.name}</h3>
            {club.motto && <p className="club-card-motto">{club.motto}</p>}
          </div>
          <div className="row-meta club-card-meta">
            <span>{clubMemberCount(club)} {text.members}</span>
            {canManage && pendingMembers.length > 0 && <span className="pill">{pendingMembers.length} {text.pending}</span>}
          </div>
        </div>

        {club.description && <p className="notes club-card-description">{club.description}</p>}

        <div className="club-card-activity">
          <button
            className="club-card-signal"
            onClick={(event) => {
              event.stopPropagation()
              openClubPage(club.id, 'sessions')
            }}
            type="button"
          >
            <CalendarDays aria-hidden="true" size={17} />
            <span>
              <strong>{text.clubNextSession}</strong>
              {nextClubSession ? `${formatShortDate(nextClubSession.date, language)} · ${nextClubSession.start_time.slice(0, 5)} · ${nextClubSession.name}` : text.noUpcomingClubSessions}
            </span>
          </button>
          {canUseMessages && (
            <button
              className="club-card-signal"
              onClick={(event) => {
                event.stopPropagation()
                openClubPage(club.id, 'messages')
              }}
              type="button"
            >
              <MessageSquare aria-hidden="true" size={17} />
              <span>
                <strong>{text.clubLatestMessage}</strong>
                {latestClubMessage ? `${latestClubMessage.author_display_name || text.player}${latestClubMessageDate ? ` · ${latestClubMessageDate}` : ''}` : text.noClubMessages}
              </span>
            </button>
          )}
          {canManage && pendingMembers.length > 0 && (
            <button
              className="club-card-signal attention"
              onClick={(event) => {
                event.stopPropagation()
                openClubPage(club.id, 'members')
              }}
              type="button"
            >
              <UserCheck aria-hidden="true" size={17} />
              <span>
                <strong>{text.clubPendingRequests}</strong>
                {pendingMembers.length} {text.pending}
              </span>
            </button>
          )}
        </div>

        <div className="club-card-footer">
          {canSeeMembers ? (
            <div className="players club-card-players">
              {visibleApprovedMembers.map((member) => (
                <div className="player" key={member.id}>
                  <button
                    aria-label={playerCardLabel(member.display_name, text.player)}
                    className="player-avatar player-avatar-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      openPlayerProfile(member.profile_id)
                    }}
                    style={avatarStyle(member)}
                    type="button"
                  >
                    {avatarNode(member, 'P')}
                  </button>
                  <span>{compactDisplayName(member.display_name, text.player)}</span>
                  {canManage && member.profile_id !== club.owner_id && (
                    <button className="remove-player" disabled={busyClubId === club.id} onClick={(event) => {
                      event.stopPropagation()
                      removeClubMember(club, member)
                    }} type="button">
                      {text.remove}
                    </button>
                  )}
                </div>
              ))}
              {extraApprovedMemberCount > 0 && <span className="club-card-more-members">+{extraApprovedMemberCount}</span>}
            </div>
          ) : (
            <span className="club-private-note">
              <Lock aria-hidden="true" size={15} />
              {text.hiddenMembers}
            </span>
          )}

          <div className="club-card-actions">
            {canUseMessages && (
              <button
                className="secondary small-button"
                onClick={(event) => {
                  event.stopPropagation()
                  openClubPage(club.id, 'messages')
                }}
                type="button"
              >
                {text.clubMessages}
              </button>
            )}
            {canShowPrimaryAction && (
              <button
                className={busyClubId === club.id ? 'primary loading club-card-primary-action' : 'primary club-card-primary-action'}
                disabled={busyClubId === club.id}
                onClick={handleClubPrimaryAction}
                type="button"
              >
                {clubPrimaryActionText}
              </button>
            )}
          </div>
        </div>

        {canManage && pendingMembers.length > 0 && (
          <div className="pending-list">
            {pendingMembers.map((member) => (
              <div className="pending-member" key={member.id}>
                <span>{compactDisplayName(member.display_name, text.player)}</span>
                <div className="mini-session-actions">
                  <button className="secondary small-button" disabled={busyClubId === club.id} onClick={(event) => {
                    event.stopPropagation()
                    approveClubMember(member)
                  }} type="button">
                    {text.approve}
                  </button>
                  <button className="danger small-button" disabled={busyClubId === club.id} onClick={(event) => {
                    event.stopPropagation()
                    removeClubMember(club, member)
                  }} type="button">
                    {text.remove}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    )
  }

  const appMain = (
      <main>
        {activeView === 'sessions' && (
          <BookingSessionsPanel context={sessionsPanelContext} />
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
                initialCriterion={leaderboardQueryRef.current.criterion}
                isCurrentUserStatsShared={currentUserStatsShared}
                isLoadingMorePlayers={isLoadingMoreLeaderboardPlayers}
                onLeaderboardClubChange={handleLeaderboardClubChange}
                onLeaderboardClubFilterOpen={ensureClubsLoaded}
                onLeaderboardClubPinUnlock={handleLeaderboardClubPinUnlock}
                onLeaderboardCriterionChange={handleLeaderboardCriterionChange}
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
          canAccessStaffConsole ? (
            <StaffConsole
              authEmail={authEmail}
              key="staff-console"
              language={language}
              mode="staff"
              profile={profile}
              onOpenPlayerProfile={openStaffPlayerProfile}
              onOpenSessionCalendar={openCreateSessionCalendar}
            />
          ) : (
            <section className="section staff-console">
              <h2>{language === 'vi' ? 'Bảng nhân viên' : 'Staff Console'}</h2>
              <p className="notice">{language === 'vi' ? 'Cần quyền nhân viên.' : 'Staff access required.'}</p>
            </section>
          )
        )}

        {activeView === 'hr' && (
          canAccessStaffConsole ? (
            <StaffConsole
              authEmail={authEmail}
              key="hr-console"
              language={language}
              mode="hr"
              profile={profile}
              onOpenPlayerProfile={openStaffPlayerProfile}
              onOpenSessionCalendar={openCreateSessionCalendar}
            />
          ) : (
            <section className="section staff-console">
              <h2>{language === 'vi' ? 'HR' : 'HR Console'}</h2>
              <p className="notice">{language === 'vi' ? 'Cần quyền nhân viên.' : 'Staff access required.'}</p>
            </section>
          )
        )}

        {activeView === 'tickets' && (
          <TicketBookingView
            activeTicketDuration={activeTicketDuration}
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
            ticketDiscountName={ticketAutomaticDiscountQuote?.discount_name || ticketDiscountQuote?.discount_name || ''}
            ticketDiscountSource={activeTicketDiscountSource}
            ticketDiscountStatus={ticketDiscountStatus}
            ticketDurationOptions={ticketDurationOptions}
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
        )}

        {activeView === 'create' && (
          <CreateSessionView
            createStatus={createStatus}
            mode={createSessionMode}
            onModeChange={handleCreateSessionModeChange}
            text={text}
          >
            {createSessionMode === 'calendar' ? (
              <div className="calendar-panel" aria-label={text.calendarAvailabilityTitle}>
                <div className="calendar-toolbar">
                  <div>
                    <strong>{text.calendarAvailabilityTitle}</strong>
                    <span>{text.weekOf} {formatCalendarWeekRange(calendarWeekStart, language)}</span>
                  </div>
                  <div className="calendar-nav">
                    <button
                      aria-label={text.previousWeek}
                      type="button"
                      onClick={() => moveCalendarWeek(-7)}
                    >
                      <ChevronLeft aria-hidden="true" size={18} />
                    </button>
                    <button
                      aria-label={text.nextWeek}
                      type="button"
                      onClick={() => moveCalendarWeek(7)}
                    >
                      <ChevronRight aria-hidden="true" size={18} />
                    </button>
                  </div>
                </div>
                <p className="muted calendar-hint">{text.calendarAvailabilityHint}</p>
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
                                  disabled={!slotAvailable}
                                  key={slot.value}
                                  type="button"
                                  onClick={() => startSessionFromCalendar(day.value, slot.value)}
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
                              const heightPercent = Math.max(
                                4,
                                ((visibleEnd - visibleStart) / (CLOSE_MINUTES - OPEN_MINUTES)) * 100
                              )
                              const participantCount = session.session_participants?.length ?? 0
                              const capacity = isTicket ? session.ticket_player_count || session.max_players : session.max_players
                              const sessionKind = isTicket
                                ? text.privateTicketSession
                                : session.visibility === 'private'
                                  ? text.private
                                  : text.public
                              const timeRangeLabel = `${session.start_time.slice(0, 5)}-${minutesToTime(end)}`
                              const calendarSessionLabel = `${session.name}: ${formatShortDate(session.date, language)} ${timeRangeLabel}`

                              return (
                                <button
                                  aria-label={calendarSessionLabel}
                                  className={isTicket ? 'calendar-session-block ticket' : 'calendar-session-block'}
                                  key={session.id}
                                  style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
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
                <label>{text.sessionName} <span className="required">*</span></label>
                <input data-testid="create-session-name" placeholder={text.fridayPlaceholder} value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
              </div>
              <div className="full session-mode-row">
                <div>
                  <label>{text.sessionType}</label>
                  <div className="segmented session-type-toggle">
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
                    <div className="segmented visibility-toggle">
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
                      <label>{text.tournamentFormat}</label>
                      <select value={tournamentFormat} onChange={(event) => setTournamentFormat(event.target.value as TournamentFormat)}>
                        <option value="pool_only">{text.formatPoolOnly}</option>
                        <option value="pool_to_semifinal">{text.formatPoolSemifinal}</option>
                        <option value="pool_to_final">{text.formatPoolFinal}</option>
                        <option value="single_elimination">{text.formatSingleElimination}</option>
                        <option value="double_elimination">{text.formatDoubleElimination}</option>
                        <option value="leaderboard">{text.formatLeaderboard}</option>
                      </select>
                    </div>
                    <div>
                      <label>{text.matchSeries}</label>
                      <select value={tournamentBestOf} onChange={(event) => setTournamentBestOf(Number(event.target.value) as 1 | 3 | 5)}>
                        <option value={1}>BO1</option>
                        <option value={3}>BO3</option>
                        <option value={5}>BO5</option>
                      </select>
                    </div>
                    <div>
                      <label>{text.roundsPerMatch}</label>
                      <select value={tournamentRoundsPerMatch} onChange={(event) => setTournamentRoundsPerMatch(Number(event.target.value))}>
                        {[1, 2, 3, 4, 5].map((roundCount) => (
                          <option key={roundCount} value={roundCount}>{roundCount}</option>
                        ))}
                      </select>
                      <p className="field-help">{text.roundsPerMatchHint}</p>
                    </div>
                    <div>
                      <label>{text.qualification}</label>
                      <select value={tournamentQualificationRule} onChange={(event) => setTournamentQualificationRule(event.target.value as QualificationRule)}>
                        <option value="top_1">{text.topOnePerPool}</option>
                        <option value="top_2">{text.topTwoPerPool}</option>
                        <option value="top_4">{text.topFourPerPool}</option>
                        <option value="custom">{text.custom}</option>
                      </select>
                    </div>
                    {tournamentQualificationRule === 'custom' && (
                      <div>
                        <label>{text.customQualifiers}</label>
                        <input inputMode="numeric" min={1} max={16} type="number" value={tournamentCustomQualifiers} onChange={(event) => setTournamentCustomQualifiers(Number(event.target.value) || 1)} />
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
                      <label>{text.firstPrize}</label>
                      <input value={tournamentFirstPrize} onChange={(event) => setTournamentFirstPrize(event.target.value)} placeholder="1,000,000 VND" />
                    </div>
                    <div>
                      <label>{text.secondPrize}</label>
                      <input value={tournamentSecondPrize} onChange={(event) => setTournamentSecondPrize(event.target.value)} placeholder="Free Ticket" />
                    </div>
                    <div>
                      <label>{text.thirdPrize}</label>
                      <input value={tournamentThirdPrize} onChange={(event) => setTournamentThirdPrize(event.target.value)} placeholder="Free Drink" />
                    </div>
                  </div>
                </div>
              )}
              <div className="full">
                <label>{text.clubOnly}</label>
                <select value={sessionClubId} onChange={(event) => handleSessionClubChange(event.target.value)}>
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
                  <label>{text.availableTime} <span className="required">*</span></label>
                  <select data-testid="create-session-time" value={sessionTime} onChange={(event) => setSessionTime(event.target.value)}>
                    <option value="">{text.chooseTime}</option>
                    {timeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{text.duration}</label>
                  <select data-testid="create-session-duration" value={sessionDuration} onChange={(event) => setSessionDuration(Number(event.target.value))}>
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
                  <label>{text.maxPlayers}</label>
                  <select data-testid="create-session-max-players" value={sessionMaxPlayers} onChange={(event) => handleMaxPlayersChange(Number(event.target.value))}>
                    {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                      <option value={count} key={count}>
                        {count} player{count === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>{text.arenas}</label>
                  <select value={sessionArenaCount} onChange={(event) => handleArenaCountChange(Number(event.target.value))}>
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
                <div className="game-picker">
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
                <RichNotesEditor
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
        )}

        {activeView === 'profile' && (
          <BookingProfileView context={profileViewContext} />
        )}

      </main>
  )

  const appOverlays = (
    <>
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
          title={text.sessionTariffTitle}
          rates={[
            text.sessionTariffRateDay,
            text.sessionTariffRateEvening,
            text.sessionTariffRateWeekend,
          ]}
          arenaText={text.sessionTariffArena}
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
          disclaimer={text.sessionTariffDisclaimer}
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

      {selectedClub && canOpenClubPage(selectedClub) && (() => {
        const canManageSelectedClub = canManageClub(selectedClub)
        const canModerateSelectedClub = canModerateClubMembers(selectedClub)
        const canSeeSelectedClubData = canSeeClubPrivateData(selectedClub)
        const bannerUrl = clubBannerPreview || selectedClub.banner_url || ''
        const showInviteCode = selectedClub.visibility === 'private' && selectedClub.pin_code && canManageSelectedClub
        const canCreateSelectedClubSession = canManageSelectedClub || sessionClubOptions.some((club) => club.id === selectedClub.id)
        const noClubSessionsText = selectedClubSessionScope === 'past' ? text.noPastClubSessions : text.noUpcomingClubSessions
        const canUseSelectedClubMessages = canUseClubMessages(selectedClub)
        const selectedClubPublicMessages = messagesForClub(selectedClub, 'public')
        const selectedClubAdminMessages = messagesForClub(selectedClub, 'admin_private')
        const publicDraft = clubPublicMessageDrafts[selectedClub.id] || ''
        const adminDraft = clubAdminMessageDrafts[selectedClub.id] || ''
        const publicCharactersLeft = CLUB_MESSAGE_MAX_LENGTH - Array.from(publicDraft).length
        const adminCharactersLeft = CLUB_MESSAGE_MAX_LENGTH - Array.from(adminDraft).length

        return (
          <div className="club-drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="club-drawer-title" onClick={() => setSelectedClubId('')}>
            <div
              className="club-drawer club-page"
              onClick={(event) => event.stopPropagation()}
              onTouchStart={(event) => setDrawerTouchStart(event.touches[0]?.clientY ?? null)}
              onTouchEnd={(event) => {
                if (drawerTouchStart === null) return
                const endY = event.changedTouches[0]?.clientY ?? drawerTouchStart
                if (endY - drawerTouchStart > 70) {
                  setSelectedClubId('')
                }
                setDrawerTouchStart(null)
              }}
              style={clubThemeStyle(selectedClub)}
            >
              <div className="drawer-handle" />
              <div className={bannerUrl ? 'club-hero has-banner' : 'club-hero'}>
                {bannerUrl ? (
                  <NextImage src={bannerUrl} alt="" fill sizes="(max-width: 720px) 100vw, 720px" />
                ) : (
                  <div className="club-banner-empty">
                    <strong>{text.clubBanner}</strong>
                    {canManageSelectedClub && <span>{text.clubBannerHelp}</span>}
                  </div>
                )}
                <div className="club-hero-content">
                  <div>
                    <h2 id="club-drawer-title">{selectedClub.name}</h2>
                    {selectedClub.motto && <p className="club-motto">{selectedClub.motto}</p>}
                    <div className="row-meta">
                      <span className={selectedClub.visibility === 'private' ? 'pill private' : 'pill ok'}>
                        {selectedClub.visibility === 'private' ? text.private : text.public}
                      </span>
                      <span>{clubMemberCount(selectedClub)} {text.members}</span>
                      {(selectedClub.owner_id === userId || selectedClubMembership?.status === 'approved') && (
                        <span>{clubRoleLabel(clubRoleFor(selectedClub))}</span>
                      )}
                    </div>
                  </div>
                  <button className="secondary small-button" type="button" onClick={() => setSelectedClubId('')}>
                    <ButtonIconText icon={<X aria-hidden="true" size={15} />}>{text.close}</ButtonIconText>
                  </button>
                </div>
              </div>

              {selectedClub.description && <p className="notes club-description">{selectedClub.description}</p>}

              <div className="club-action-row">
                {!selectedClubMembership && !canManageSelectedClub && (
                  <button
                    className={busyClubId === selectedClub.id ? 'primary loading create-button' : 'primary create-button'}
                    disabled={busyClubId === selectedClub.id}
                    onClick={() => joinClub(selectedClub)}
                    type="button"
                  >
                    {selectedClub.visibility === 'private' ? text.requestJoin : text.joinClub}
                  </button>
                )}

                {canCreateSelectedClubSession && (
                  <button
                    className="primary create-button"
                    type="button"
                    onClick={() => {
                      setSessionClubId(selectedClub.id)
                      setSessionVisibility('public')
                      setCreateStatus(text.clubOnlyCreateHint)
                      setActiveView('create')
                      setSelectedClubId('')
                    }}
                  >
                    {text.clubOnly}
                  </button>
                )}

                {selectedClubMembership?.status === 'approved' && selectedClub.owner_id !== userId && (
                  <button
                    className={busyClubId === selectedClub.id ? 'danger loading create-button club-leave-button' : 'danger create-button club-leave-button'}
                    disabled={busyClubId === selectedClub.id}
                    onClick={() => leaveClub(selectedClub, selectedClubMembership)}
                    type="button"
                  >
                    <ButtonIconText icon={<UserMinus aria-hidden="true" size={18} />}>{leaveClubText}</ButtonIconText>
                  </button>
                )}
              </div>

              {showInviteCode && (
                <div className="club-invite-box">
                  <span>{text.clubInviteCode}</span>
                  <strong>{selectedClub.pin_code}</strong>
                  <button className="secondary small-button" type="button" onClick={() => shareClubInvite(selectedClub)}>
                    <ButtonIconText icon={<Share aria-hidden="true" size={15} />}>{text.shareClubCode}</ButtonIconText>
                  </button>
                </div>
              )}

              {selectedClubMembership?.status === 'pending' && (
                <p className="notice">{text.requestSent}</p>
              )}

              <div className="sub-tabs club-page-tabs">
                <button className={selectedClubTab === 'hall' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('hall')}>
                  {text.clubHallOfFame}
                </button>
                <button className={selectedClubTab === 'members' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('members')}>
                  {text.clubMembers}
                </button>
                <button className={selectedClubTab === 'sessions' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('sessions')}>
                  {text.clubSessions}
                </button>
                <button className={selectedClubTab === 'messages' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('messages')}>
                  {text.clubMessages}
                </button>
                {canManageSelectedClub && (
                  <button className={selectedClubTab === 'settings' ? 'active' : ''} type="button" onClick={() => handleClubTabChange('settings')}>
                    {text.clubSettings}
                  </button>
                )}
              </div>

              {selectedClubTab === 'hall' && (
                <div className="club-tab-panel club-hall-panel">
                  {!canSeeSelectedClubData ? (
                    <p className="notice">{text.hiddenMembers}</p>
                  ) : (
                    <>
                      {isLeaderboardLoading && leaderboardPlayerStats.length === 0 && <AppLoadingState className="section leaderboard-section" compact />}
                      <LocalErrorBoundary fallback={<p className="notice">{text.noLeaderboardPlayers}</p>} resetKey={`club-hall-${selectedClub.id}-${language}-${leaderboardPlayerStats.length}`}>
                        <LeaderboardPanel
                          avatarStyleFor={(player: LeaderboardPlayer) => avatarStyle({
                            avatar_color: player.avatarColor,
                            avatar_text_color: player.avatarTextColor,
                          })}
                          canBypassPrivateClubPins={isAdmin}
                          clubs={[selectedClub]}
                          currentUserRankPlayer={currentUserRankPlayer}
                          fixedClubId={selectedClub.id}
                          hasMorePlayers={hasMoreLeaderboardPlayers}
                          hideIntro
                          initialCriterion={clubRankingCriterion(selectedClub)}
                          isCurrentUserStatsShared={currentUserStatsShared}
                          isLoadingMorePlayers={isLoadingMoreLeaderboardPlayers}
                          onLeaderboardCriterionChange={handleLeaderboardCriterionChange}
                          onLeaderboardSearchChange={handleLeaderboardSearchChange}
                          onLoadMorePlayers={loadMoreLeaderboardPlayers}
                          onOpenPlayerProfile={openPlayerProfile}
                          onShareCurrentUserStats={() => shareCurrentUserStats(selectedClub.name)}
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
                          text={text}
                          useServerRanking
                          userId={userId}
                        />
                      </LocalErrorBoundary>
                      {selectedClubApprovedMembers.length === 0 && <p className="notice">{text.noTrophiesYet}</p>}
                    </>
                  )}
                </div>
              )}

              {selectedClubTab === 'members' && (
                <div className="club-tab-panel">
                  {!canSeeSelectedClubData ? (
                    <p className="notice">{text.hiddenMembers}</p>
                  ) : (
                    <>
                      {selectedClubApprovedMembers.length === 0 && <p className="notice">{text.noMembersYet}</p>}
                      <div className="club-member-list">
                        {selectedClubApprovedMembers.map((member) => {
                          const role = clubRoleFor(selectedClub, member.profile_id)
                          const roleOptions = manageableRoleOptions(selectedClub, member)
                          const canTransfer = (isAdmin || selectedClub.owner_id === userId) && member.profile_id !== selectedClub.owner_id

                          return (
                            <article className="club-member-row" key={member.id}>
                              <button aria-label={playerCardLabel(member.display_name, text.player)} className="player-avatar player-avatar-button" onClick={() => openPlayerProfile(member.profile_id)} style={avatarStyle(member)} type="button">
                                {avatarNode(member, 'P')}
                              </button>
                              <div className="club-member-main">
                                <strong>{compactDisplayName(member.display_name, text.player)}</strong>
                                <div className="row-meta">
                                  <span>{clubRoleLabel(role)}</span>
                                  {member.created_at && <span>{text.joinedOn}: {formatShortDate(localDateString(new Date(member.created_at)), language)}</span>}
                                </div>
                              </div>
                              {roleOptions.length > 0 && (
                                <select
                                  aria-label={text.assignRole}
                                  disabled={busyClubId === selectedClub.id}
                                  value={(member.role || 'member') as ClubMemberRole}
                                  onChange={(event) => updateClubMemberRole(selectedClub, member, event.target.value as ClubMemberRole)}
                                >
                                  {roleOptions.map((option) => (
                                    <option key={option} value={option}>{clubRoleLabel(option)}</option>
                                  ))}
                                </select>
                              )}
                              {canTransfer && (
                                <button className="secondary small-button" disabled={busyClubId === selectedClub.id} type="button" onClick={() => transferClubOwnership(selectedClub, member)}>
                                  <ButtonIconText icon={<Crown aria-hidden="true" size={15} />}>{text.transferOwnership}</ButtonIconText>
                                </button>
                              )}
                              {canManageClubMember(selectedClub, member) && (
                                <button className="danger small-button" disabled={busyClubId === selectedClub.id} type="button" onClick={() => removeClubMember(selectedClub, member)}>
                                  <ButtonIconText icon={<UserMinus aria-hidden="true" size={15} />}>{text.remove}</ButtonIconText>
                                </button>
                              )}
                            </article>
                          )
                        })}
                      </div>

                      {canModerateSelectedClub && selectedClubPendingMembers.length > 0 && (
                        <div className="pending-list">
                          <h3>{text.pending}</h3>
                          {selectedClubPendingMembers.map((member) => (
                            <div className="pending-member" key={member.id}>
                              <span>{compactDisplayName(member.display_name, text.player)}</span>
                              <div className="mini-session-actions">
                                <button className="secondary small-button" disabled={busyClubId === selectedClub.id} onClick={() => approveClubMember(member)} type="button">
                                  <ButtonIconText icon={<UserCheck aria-hidden="true" size={15} />}>{text.approve}</ButtonIconText>
                                </button>
                                {canManageClubMember(selectedClub, member) && (
                                  <button className="danger small-button" disabled={busyClubId === selectedClub.id} onClick={() => removeClubMember(selectedClub, member)} type="button">
                                    <ButtonIconText icon={<UserMinus aria-hidden="true" size={15} />}>{text.remove}</ButtonIconText>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {selectedClubTab === 'sessions' && (
                <div className="club-tab-panel">
                  <div className="club-tab-toolbar">
                    <div className="segmented compact-segmented">
                      <button className={selectedClubSessionScope === 'upcoming' ? 'active' : ''} type="button" onClick={() => handleClubSessionScopeChange('upcoming')}>
                        {text.upcoming}
                      </button>
                      <button className={selectedClubSessionScope === 'past' ? 'active' : ''} type="button" onClick={() => handleClubSessionScopeChange('past')}>
                        {text.past}
                      </button>
                    </div>
                  </div>

                  {selectedClubDayOptions.length > 0 && (
                    <div className="day-strip drawer-days">
                      <button
                        className={!selectedClubDate ? 'day-chip active' : 'day-chip'}
                        type="button"
                        onClick={() => setSelectedClubDate('')}
                      >
                        <strong>{text.allDays}</strong>
                      </button>
                      {selectedClubDayOptions.map((day) => (
                        <button
                          className={selectedClubDate === day.value ? 'day-chip active' : 'day-chip'}
                          key={day.value}
                          type="button"
                          onClick={() => setSelectedClubDate(day.value)}
                        >
                          <span>{day.weekday}</span>
                          <strong>{day.day}</strong>
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredSelectedClubSessions.length === 0 ? (
                    <p className="notice">{isLoadingPastSessions && selectedClubSessionScope === 'past' ? '...' : noClubSessionsText}</p>
                  ) : (
                    <div className="mini-session-list">
                      {filteredSelectedClubSessions.map((session) => {
                        const coverGame = sessionCoverGame(session)
                        const remaining = seatsLeft(session)
                        const isPast = isPastSession(session)

                        return (
                          <article
                            className="club-session-preview"
                            key={session.id}
                            onClick={() => {
                              setSelectedClubId('')
                              openSessionFromProfile(session.id)
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setSelectedClubId('')
                                openSessionFromProfile(session.id)
                              }
                            }}
                          >
                            <div className="compact-session-card club-session-card">
                              <NextImage className="compact-session-image" src={coverGame.image} alt="" width={116} height={116} />
                              <div className="compact-session-main">
                                <div className="compact-session-title-row">
                                  <h3>{session.name}</h3>
                                  {session.session_type === 'tournament' && (
                                    <span className="pill private">
                                      {text.tournament}
                                    </span>
                                  )}
                                  <span className="pill">{text.clubSession}</span>
                                </div>
                                <div className="row-meta compact-meta">
                                  <span>{formatShortDate(session.date, language)}</span>
                                  <span>{session.start_time.slice(0, 5)}</span>
                                  <span>{session.duration_minutes} min</span>
                                  {renderGameGuideTrigger(coverGame.id, 'compact-game-guide-link')}
                                  {!isPast && <span>{remaining} {text.seatsLeft}</span>}
                                  {isPast && <span>{text.finalGame}: {coverGame.title}</span>}
                                </div>
                              </div>
                              <div className="compact-session-actions club-session-actions">
                                <button
                                  className="secondary compact-expand"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedClubId('')
                                    openSessionFromProfile(session.id)
                                  }}
                                >
                                  <ButtonIconText icon={<ChevronDown aria-hidden="true" size={15} />}>{text.expandDetails}</ButtonIconText>
                                </button>
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}

                  {selectedClubSessionScope === 'upcoming' && hasMoreUpcomingSessions && (
                    <button className="secondary create-button" type="button" onClick={loadMoreUpcomingSessions} disabled={isLoadingMoreSessions}>
                      {isLoadingMoreSessions ? '...' : text.expandDetails}
                    </button>
                  )}
                </div>
              )}

              {selectedClubTab === 'messages' && (
                <div className="club-tab-panel club-messages-panel">
                  {!canUseSelectedClubMessages ? (
                    <p className="notice">{text.clubMessageLoginRequired}</p>
                  ) : (
                    <>
                      {isLoadingClubMessages && <div className="club-tab-toolbar"><span className="pill">{text.clubMessagesLoading}</span></div>}
                      {clubMessageStatus && <p className="notice">{clubMessageStatus}</p>}
                      <div className="club-message-channels">
                        <section className="club-message-channel">
                          <div className="message-channel-head">
                            <strong>{text.clubPublicMessages}</strong>
                            <small>{text.clubMessageLimit}</small>
                          </div>
                          <div className="message-compose club-message-compose">
                            <textarea
                              maxLength={CLUB_MESSAGE_MAX_LENGTH}
                              rows={2}
                              value={publicDraft}
                              onChange={(event) => setClubPublicMessageDrafts((current) => ({ ...current, [selectedClub.id]: event.target.value }))}
                              placeholder={text.clubPublicPlaceholder}
                            />
                            <button
                              aria-label={text.sendMessage}
                              className="secondary small-button club-message-send-button"
                              disabled={busyMessageKey === `${selectedClub.id}-public`}
                              title={text.sendMessage}
                              type="button"
                              onClick={() => postClubMessage(selectedClub, 'public')}
                            >
                              <Send aria-hidden="true" size={18} />
                            </button>
                          </div>
                          <small className={publicCharactersLeft < 0 ? 'character-count over-limit' : 'character-count'}>
                            {publicCharactersLeft}
                          </small>
                          {selectedClubPublicMessages.length === 0 ? (
                            <p className="notice">{text.noClubMessages}</p>
                          ) : (
                            <div className="message-list club-message-list">
                              {selectedClubPublicMessages.map((message) => {
                                const isOwnMessage = message.author_id === userId
                                const messageClassName = [
                                  'session-message',
                                  'club-message',
                                  isOwnMessage ? 'own-message' : '',
                                ].filter(Boolean).join(' ')
                                const translationKey = messageTranslationKey('club', message.id, language)

                                return (
                                  <div className={messageClassName} key={message.id}>
                                    <span className="player-avatar tiny-avatar message-avatar" style={avatarStyle({
                                      avatar_color: message.author_avatar_color,
                                      avatar_text_color: message.author_avatar_text_color,
                                    })}>
                                      {avatarNode({
                                        avatar_url: message.author_avatar_url,
                                        avatar_emoji: message.author_avatar_emoji,
                                        avatar_initials: message.author_avatar_initials,
                                        display_name: message.author_display_name,
                                      }, 'P')}
                                    </span>
                                    <div className="message-body">
                                      <div className="message-meta-row">
                                        <strong>{compactDisplayName(message.author_display_name, text.player)}</strong>
                                      </div>
                                      <MessageBodyText
                                        body={message.body}
                                        messageId={message.id}
                                        messageKind="club"
                                        onRequestTranslation={requestMessageTranslation}
                                        onToggleOriginal={() => toggleMessageOriginal('club', message.id, language)}
                                        targetLanguage={language}
                                        text={text}
                                        translation={messageTranslations[translationKey]}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </section>

                        <section className="club-message-channel">
                          <div className="message-channel-head">
                            <strong>{text.clubAdminMessages}</strong>
                            <small>{text.clubMessagesPrivateHint}</small>
                          </div>
                          <div className="message-compose club-message-compose">
                            <textarea
                              maxLength={CLUB_MESSAGE_MAX_LENGTH}
                              rows={2}
                              value={adminDraft}
                              onChange={(event) => setClubAdminMessageDrafts((current) => ({ ...current, [selectedClub.id]: event.target.value }))}
                              placeholder={text.clubAdminPlaceholder}
                            />
                            <button
                              aria-label={text.sendMessage}
                              className="secondary small-button club-message-send-button"
                              disabled={busyMessageKey === `${selectedClub.id}-admin_private`}
                              title={text.sendMessage}
                              type="button"
                              onClick={() => postClubMessage(selectedClub, 'admin_private')}
                            >
                              <Send aria-hidden="true" size={18} />
                            </button>
                          </div>
                          <small className={adminCharactersLeft < 0 ? 'character-count over-limit' : 'character-count'}>
                            {adminCharactersLeft}
                          </small>
                          {selectedClubAdminMessages.length === 0 ? (
                            <p className="notice">{text.noClubAdminMessages}</p>
                          ) : (
                            <div className="message-list club-message-list">
                              {selectedClubAdminMessages.map((message) => {
                                const isOwnMessage = message.author_id === userId
                                const messageClassName = [
                                  'session-message',
                                  'club-message',
                                  'admin-private',
                                  isOwnMessage ? 'own-message' : '',
                                ].filter(Boolean).join(' ')
                                const translationKey = messageTranslationKey('club', message.id, language)

                                return (
                                  <div className={messageClassName} key={message.id}>
                                    <span className="player-avatar tiny-avatar message-avatar" style={avatarStyle({
                                      avatar_color: message.author_avatar_color,
                                      avatar_text_color: message.author_avatar_text_color,
                                    })}>
                                      {avatarNode({
                                        avatar_url: message.author_avatar_url,
                                        avatar_emoji: message.author_avatar_emoji,
                                        avatar_initials: message.author_avatar_initials,
                                        display_name: message.author_display_name,
                                      }, 'P')}
                                    </span>
                                    <div className="message-body">
                                      <div className="message-meta-row">
                                        <strong>{compactDisplayName(message.author_display_name, text.player)}</strong>
                                        <small className="moderation-badge pending">{text.private}</small>
                                      </div>
                                      <MessageBodyText
                                        body={message.body}
                                        messageId={message.id}
                                        messageKind="club"
                                        onRequestTranslation={requestMessageTranslation}
                                        onToggleOriginal={() => toggleMessageOriginal('club', message.id, language)}
                                        targetLanguage={language}
                                        text={text}
                                        translation={messageTranslations[translationKey]}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </section>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedClubTab === 'settings' && canManageSelectedClub && (
                <div className="club-tab-panel club-settings-panel">
                  <div className="form-grid club-settings-grid">
                    <div>
                      <label>{text.clubName} <span className="required">*</span></label>
                      <input value={clubEditName} onChange={(event) => setClubEditName(event.target.value)} />
                    </div>
                    <div>
                      <label>{text.clubMotto}</label>
                      <input maxLength={48} value={clubEditMotto} onChange={(event) => setClubEditMotto(event.target.value)} placeholder={text.clubMottoPlaceholder} />
                    </div>
                    <div className="full">
                      <label>{text.clubDescription}</label>
                      <textarea value={clubEditDescription} onChange={(event) => setClubEditDescription(event.target.value)} placeholder={text.clubDescriptionPlaceholder} />
                    </div>
                    <div>
                      <label>{text.clubPrivacy}</label>
                      <div className="segmented visibility-toggle">
                        <button className={clubEditVisibility === 'public' ? 'active' : ''} onClick={() => setClubEditVisibility('public')} type="button">
                          {text.public}
                        </button>
                        <button className={clubEditVisibility === 'private' ? 'active' : ''} onClick={() => setClubEditVisibility('private')} type="button">
                          {text.private}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label>{text.clubDefaultLanguage}</label>
                      <select value={clubEditDefaultLanguage} onChange={(event) => setClubEditDefaultLanguage(event.target.value as LanguageCode)}>
                        {languageOptions.map((option) => (
                          <option key={option} value={option}>{option.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>{text.rankBy}</label>
                      <select value={clubEditRankingCriterion} onChange={(event) => setClubEditRankingCriterion(event.target.value as LeaderboardCriterion)}>
                        {clubRankingCriteria.map((criterion) => (
                          <option key={criterion.value} value={criterion.value}>
                            {criterion.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="full club-banner-field">
                      <label>{text.clubBanner}</label>
                      <label className="club-banner-upload">
                        {bannerUrl ? <NextImage src={bannerUrl} alt="" width={1600} height={600} /> : <span>{text.clubBannerHelp}</span>}
                        <input accept="image/jpeg,image/png,image/webp" type="file" onChange={handleClubBannerChange} />
                      </label>
                      <p className="field-help">{text.clubBannerHelp}</p>
                    </div>
                    <div className="full">
                      <label>{text.clubThemeColor}</label>
                      <div className="color-row" aria-label={text.clubThemeColor}>
                        {clubThemeColors.map((color) => (
                          <button
                            aria-label={color}
                            className={clubEditThemeColor === color ? 'active' : ''}
                            key={color}
                            onClick={() => updateClubThemeColor(color)}
                            style={{ background: color }}
                            type="button"
                          />
                        ))}
                      </div>
                      <div className="custom-color-row">
                        <label>
                          <span>{text.customColor}</span>
                          <input type="color" value={clubEditThemeColor} onChange={(event) => updateClubThemeColor(event.target.value)} />
                        </label>
                        <label className="hex-field">
                          <span>{text.hexColor}</span>
                          <input
                            value={clubEditThemeColorDraft}
                            onBlur={() => setClubEditThemeColorDraft(clubEditThemeColor)}
                            onChange={(event) => updateClubThemeColorDraft(event.target.value)}
                            placeholder={vrenaPalette.purple[500]}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="club-action-row">
                    <button className={isSavingClub ? 'primary loading create-button' : 'primary create-button'} disabled={isSavingClub || busyClubId === selectedClub.id} type="button" onClick={() => saveClubSettings(selectedClub)}>
                      <ButtonIconText icon={<Save aria-hidden="true" size={17} />}>{isSavingClub ? text.saving : text.saveClub}</ButtonIconText>
                    </button>
                    <button className="secondary create-button" disabled={busyClubId === selectedClub.id} type="button" onClick={() => regenerateClubInviteCode(selectedClub)}>
                      <ButtonIconText icon={<RefreshCw aria-hidden="true" size={17} />}>{text.regenerateInviteCode}</ButtonIconText>
                    </button>
                    {selectedClub.pin_code && (
                      <button className="secondary create-button" type="button" onClick={() => shareClubInvite(selectedClub)}>
                        <ButtonIconText icon={<Share aria-hidden="true" size={17} />}>{text.shareClubCode}</ButtonIconText>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

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
          challengeControls={renderChallengeControls(selectedPlayerProfile)}
          bestScoresTitle={text.bestScores}
          bestScores={selectedPlayerProfile.bestByGame}
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

  return (
    <div className={`app ${isConsoleWorkspace ? 'console-workspace' : ''} ${isConsoleWorkspace && consoleSidebarCollapsed ? 'console-workspace-collapsed' : ''}`.trim()} data-tour="app-shell">
      {profile && userId && (
        <FirstLoginTour enabled onViewChange={setActiveView} replayNonce={tourReplayNonce} text={text} userId={userId} />
      )}
      {appAside}
      {appMain}
      {appOverlays}
    </div>
  )
}
