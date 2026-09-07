'use client'

import type { Club } from '../../lib/bookingWidgetDomain'

import {
  ChevronDown,
  Crown,
  RefreshCw,
  Save,
  Send,
  Share,
  UserCheck,
  UserMinus,
  X
} from 'lucide-react'
import NextImage from 'next/image'
import AppLoadingState from '../../components/AppLoadingState'
import {
  LeaderboardPanel
} from '../../components/BookingWidgetSurfaces'
import { ButtonIconText, LocalErrorBoundary } from '../../components/BookingWidgetUi'
import type { LeaderboardCriterion, LeaderboardPlayer } from '../../components/LeaderboardPanel'
import MessageBodyText from '../../components/MessageBodyText'
import {
  clubThemeColors
} from '../../lib/bookingStaticData'
import {
  ClubMemberRole,
  clubMemberCount,
  compactDisplayName,
  formatShortDate,
  isPastSession,
  localDateString,
  playerCardLabel,
  seatsLeft,
  sessionCoverGame
} from '../../lib/bookingWidgetDomain'
import { languageOptions, type LanguageCode } from '../../lib/i18n/languages'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { vrenaPalette } from '../../lib/theme/vrenaPalette'
import { clubRankingCriterion } from './clubAccess.actions'
import { CLUB_MESSAGE_MAX_LENGTH } from './shared'
export type ClubDetailProps = {
  canManageClub: (club: import("../../lib/bookingWidgetDomain").Club) => boolean
  selectedClub: Club
  canModerateClubMembers: (club: import("../../lib/bookingWidgetDomain").Club) => boolean
  canSeeClubPrivateData: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => boolean
  clubBannerPreview: string
  sessionClubOptions: import("../../lib/bookingWidgetDomain").Club[]
  selectedClubSessionScope: import("../../lib/bookingWidgetDomain").ClubSessionScope
  text: TranslationMap
  canUseClubMessages: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => boolean
  messagesForClub: (club: import("../../lib/bookingWidgetDomain").Club, messageType: "public" | "admin_private") => import("../../lib/bookingWidgetDomain").ClubMessage[]
  clubPublicMessageDrafts: Record<string, string>
  clubAdminMessageDrafts: Record<string, string>
  setSelectedClubId: React.Dispatch<React.SetStateAction<string>>
  setDrawerTouchStart: React.Dispatch<React.SetStateAction<number | null>>
  drawerTouchStart: number | null
  clubThemeStyle: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => Record<string, string>
  userId: string
  selectedClubMembership: import("../../lib/bookingWidgetDomain").ClubMember | undefined
  clubRoleLabel: (role: import("../../lib/bookingWidgetDomain").ClubRole) => string
  clubRoleFor: (club: import("../../lib/bookingWidgetDomain").Club, profileId?: string) => import("../../lib/bookingWidgetDomain").ClubRole
  busyClubId: string
  joinClub: (club: import("../../lib/bookingWidgetDomain").Club) => Promise<void>
  setSessionClubId: React.Dispatch<React.SetStateAction<string>>
  setSessionVisibility: React.Dispatch<React.SetStateAction<"private" | "public">>
  setCreateStatus: React.Dispatch<React.SetStateAction<string>>
  setActiveView: React.Dispatch<React.SetStateAction<import("../../components/AppSidebar").AppView>>
  leaveClub: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember) => Promise<void>
  leaveClubText: string
  shareClubInvite: (club: import("../../lib/bookingWidgetDomain").Club) => Promise<void>
  selectedClubTab: import("../../lib/bookingWidgetDomain").ClubTab
  handleClubTabChange: (tab: import("../../lib/bookingWidgetDomain").ClubTab) => void
  isLeaderboardLoading: boolean
  leaderboardPlayerStats: import("../../components/LeaderboardPanel").LeaderboardPlayer[] | { scoreAdjustment: number; totalScore: number; averageAccuracy: number | null; reliabilityScore: number; totalProjectiles: number; bestEscapeDurationSeconds: number | null; bestByGame: { game: string; score: number }[]; profileId: string; displayName: string; avatarUrl: string | null; avatarEmoji: string | null; avatarInitials: string | null; avatarColor: string | null; avatarTextColor: string | null; profileMotto: string | null; sessionsJoined: number; gamesJoined: number; wins: number; bestPerformerCount: number; baseTotalScore: number; loyaltyPoints?: number | undefined; totalAccuracy: number; accuracyCount: number; totalProjectilesOverride: number | null; averageAccuracyOverride: number | null; bestEscapeDurationSecondsOverride: number | null }[]
  language: import("../../lib/i18n/languages").LanguageCode
  avatarStyle: (source: { avatar_color?: string | null | undefined; avatar_text_color?: string | null | undefined } | null | undefined) => { color?: string | undefined; background?: string | undefined } | undefined
  isAdmin: boolean
  currentUserRankPlayer: import("../../components/LeaderboardPanel").LeaderboardPlayer | null
  hasMoreLeaderboardPlayers: boolean
  leaderboardView: { loaded: boolean; query: import("../../lib/leaderboard").LeaderboardQuery }
  currentUserStatsShared: boolean
  isLoadingMoreLeaderboardPlayers: boolean
  handleLeaderboardCriterionChange: (criterion: import("../../components/LeaderboardPanel").LeaderboardCriterion) => void
  handleLeaderboardGameChange: (gameId: string) => void
  handleLeaderboardSearchChange: (searchValue: string) => void
  loadMoreLeaderboardPlayers: () => void
  openPlayerProfile: (profileId: string, sessionId?: string, seedStats?: import("../../components/LeaderboardPanel").LeaderboardPlayer | undefined) => void
  shareCurrentUserStats: (contextLabel?: string) => Promise<void>
  avatarNode: (source: { avatar_url?: string | null | undefined; avatar_emoji?: string | null | undefined; avatar_initials?: string | null | undefined; avatar_color?: string | null | undefined; avatar_text_color?: string | null | undefined; display_name?: string | null | undefined; full_name?: string | null | undefined; nickname?: string | null | undefined } | null | undefined, fallback?: string) => React.JSX.Element
  selectedClubApprovedMembers: import("../../lib/bookingWidgetDomain").ClubMember[]
  manageableRoleOptions: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember) => import("../../lib/bookingWidgetDomain").ClubMemberRole[]
  updateClubMemberRole: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember, role: import("../../lib/bookingWidgetDomain").ClubMemberRole) => Promise<void>
  transferClubOwnership: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember) => Promise<void>
  canManageClubMember: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember) => boolean
  removeClubMember: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember) => Promise<void>
  selectedClubPendingMembers: import("../../lib/bookingWidgetDomain").ClubMember[]
  approveClubMember: (member: import("../../lib/bookingWidgetDomain").ClubMember) => Promise<void>
  handleClubSessionScopeChange: (scope: import("../../lib/bookingWidgetDomain").ClubSessionScope) => void
  selectedClubDayOptions: { weekday: string; day: string; value: string }[]
  selectedClubDate: string
  setSelectedClubDate: React.Dispatch<React.SetStateAction<string>>
  filteredSelectedClubSessions: import("../../lib/bookingWidgetDomain").Session[]
  isLoadingPastSessions: boolean
  openSessionFromProfile: (sessionId: string) => void
  renderGameGuideTrigger: (gameId?: import("../../lib/bookingStaticData").GameId | null | undefined, extraClassName?: string) => React.JSX.Element
  hasMoreUpcomingSessions: boolean
  loadMoreUpcomingSessions: () => Promise<void>
  isLoadingMoreSessions: boolean
  isLoadingClubMessages: boolean
  clubMessageStatus: string
  setClubPublicMessageDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  busyMessageKey: string
  postClubMessage: (club: import("../../lib/bookingWidgetDomain").Club, messageType: "public" | "admin_private") => Promise<void>
  messageTranslationKey: (messageKind: "club" | "session", messageId: string, targetLanguage: import("../../lib/i18n/languages").LanguageCode) => string
  requestMessageTranslation: (messageKind: "club" | "session", messageId: string, body: string, targetLanguage: import("../../lib/i18n/languages").LanguageCode) => Promise<void>
  toggleMessageOriginal: (messageKind: "club" | "session", messageId: string, targetLanguage: import("../../lib/i18n/languages").LanguageCode) => void
  messageTranslations: Record<string, import("../../components/MessageBodyText").MessageTranslationState>
  setClubAdminMessageDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  clubEditName: string
  setClubEditName: React.Dispatch<React.SetStateAction<string>>
  clubEditMotto: string
  setClubEditMotto: React.Dispatch<React.SetStateAction<string>>
  clubEditDescription: string
  setClubEditDescription: React.Dispatch<React.SetStateAction<string>>
  clubEditVisibility: "private" | "public"
  setClubEditVisibility: React.Dispatch<React.SetStateAction<"private" | "public">>
  clubEditDefaultLanguage: import("../../lib/i18n/languages").LanguageCode
  setClubEditDefaultLanguage: React.Dispatch<React.SetStateAction<import("../../lib/i18n/languages").LanguageCode>>
  clubEditRankingCriterion: import("../../components/LeaderboardPanel").LeaderboardCriterion
  setClubEditRankingCriterion: React.Dispatch<React.SetStateAction<import("../../components/LeaderboardPanel").LeaderboardCriterion>>
  clubRankingCriteria: { value: import("../../components/LeaderboardPanel").LeaderboardCriterion; label: string }[]
  handleClubBannerChange: (event: React.ChangeEvent<HTMLInputElement, Element>) => void
  clubEditThemeColor: string
  updateClubThemeColor: (value: string) => void
  clubEditThemeColorDraft: string
  setClubEditThemeColorDraft: React.Dispatch<React.SetStateAction<string>>
  updateClubThemeColorDraft: (value: string) => void
  isSavingClub: boolean
  saveClubSettings: (club: import("../../lib/bookingWidgetDomain").Club) => Promise<void>
  regenerateClubInviteCode: (club: import("../../lib/bookingWidgetDomain").Club) => Promise<void>
}

export default function ClubDetail({
  canManageClub,
  selectedClub,
  canModerateClubMembers,
  canSeeClubPrivateData,
  clubBannerPreview,
  sessionClubOptions,
  selectedClubSessionScope,
  text,
  canUseClubMessages,
  messagesForClub,
  clubPublicMessageDrafts,
  clubAdminMessageDrafts,
  setSelectedClubId,
  setDrawerTouchStart,
  drawerTouchStart,
  clubThemeStyle,
  userId,
  selectedClubMembership,
  clubRoleLabel,
  clubRoleFor,
  busyClubId,
  joinClub,
  setSessionClubId,
  setSessionVisibility,
  setCreateStatus,
  setActiveView,
  leaveClub,
  leaveClubText,
  shareClubInvite,
  selectedClubTab,
  handleClubTabChange,
  isLeaderboardLoading,
  leaderboardPlayerStats,
  language,
  avatarStyle,
  isAdmin,
  currentUserRankPlayer,
  hasMoreLeaderboardPlayers,
  leaderboardView,
  currentUserStatsShared,
  isLoadingMoreLeaderboardPlayers,
  handleLeaderboardCriterionChange,
  handleLeaderboardGameChange,
  handleLeaderboardSearchChange,
  loadMoreLeaderboardPlayers,
  openPlayerProfile,
  shareCurrentUserStats,
  avatarNode,
  selectedClubApprovedMembers,
  manageableRoleOptions,
  updateClubMemberRole,
  transferClubOwnership,
  canManageClubMember,
  removeClubMember,
  selectedClubPendingMembers,
  approveClubMember,
  handleClubSessionScopeChange,
  selectedClubDayOptions,
  selectedClubDate,
  setSelectedClubDate,
  filteredSelectedClubSessions,
  isLoadingPastSessions,
  openSessionFromProfile,
  renderGameGuideTrigger,
  hasMoreUpcomingSessions,
  loadMoreUpcomingSessions,
  isLoadingMoreSessions,
  isLoadingClubMessages,
  clubMessageStatus,
  setClubPublicMessageDrafts,
  busyMessageKey,
  postClubMessage,
  messageTranslationKey,
  requestMessageTranslation,
  toggleMessageOriginal,
  messageTranslations,
  setClubAdminMessageDrafts,
  clubEditName,
  setClubEditName,
  clubEditMotto,
  setClubEditMotto,
  clubEditDescription,
  setClubEditDescription,
  clubEditVisibility,
  setClubEditVisibility,
  clubEditDefaultLanguage,
  setClubEditDefaultLanguage,
  clubEditRankingCriterion,
  setClubEditRankingCriterion,
  clubRankingCriteria,
  handleClubBannerChange,
  clubEditThemeColor,
  updateClubThemeColor,
  clubEditThemeColorDraft,
  setClubEditThemeColorDraft,
  updateClubThemeColorDraft,
  isSavingClub,
  saveClubSettings,
  regenerateClubInviteCode,
}: ClubDetailProps) {
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
                    initialGameId={leaderboardView.query.gameId}
                    isCurrentUserStatsShared={currentUserStatsShared}
                    isLoadingMorePlayers={isLoadingMoreLeaderboardPlayers}
                    onLeaderboardCriterionChange={handleLeaderboardCriterionChange}
                    onLeaderboardGameChange={handleLeaderboardGameChange}
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
}
