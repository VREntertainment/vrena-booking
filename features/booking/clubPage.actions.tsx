'use client'

import {
  CalendarDays,
  Lock,
  MessageSquare,
  UserCheck
} from 'lucide-react'
import NextImage from 'next/image'
import {
  ChangeEvent,
  FormEvent,
  MouseEvent
} from 'react'
import {
  Club,
  ClubSessionScope,
  ClubTab,
  cleanHexColor,
  clubMemberCount,
  clubMembers,
  compactDisplayName,
  formatShortDate,
  isHexColor,
  isUpcomingSession,
  normalizePrivateCode,
  playerCardLabel,
  sessionStartDate
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { CLUB_BANNER_MAX_BYTES, CLUB_BANNER_TYPES } from './shared'

export type ClubPageActionContext = {
  clubEditThemeColor: string
  setClubEditThemeColor: React.Dispatch<React.SetStateAction<string>>
  setClubEditThemeColorDraft: React.Dispatch<React.SetStateAction<string>>
  clubs: import("../../lib/bookingWidgetDomain").Club[]
  setClubStatus: React.Dispatch<React.SetStateAction<string>>
  setClubMessageStatus: React.Dispatch<React.SetStateAction<string>>
  userId: string
  setSelectedClubId: React.Dispatch<React.SetStateAction<string>>
  promptLogin: () => void
  canOpenClubPage: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => boolean
  setClubUnlockTargetId: React.Dispatch<React.SetStateAction<string>>
  setClubUnlockCode: React.Dispatch<React.SetStateAction<string>>
  setClubUnlockStatus: React.Dispatch<React.SetStateAction<string>>
  text: TranslationMap
  setSelectedClubDate: React.Dispatch<React.SetStateAction<string>>
  setSelectedClubTab: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").ClubTab>>
  setSelectedClubSessionScope: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").ClubSessionScope>>
  clubUnlockTarget: import("../../lib/bookingWidgetDomain").Club | undefined
  clubUnlockCode: string
  setUnlockedClubIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  selectedClubSessionScope: import("../../lib/bookingWidgetDomain").ClubSessionScope
  ensurePastSessionsLoaded: () => Promise<void>
  setClubBannerFile: React.Dispatch<React.SetStateAction<File | null>>
  setClubBannerPreview: React.Dispatch<React.SetStateAction<string>>
  canManageClub: (club: import("../../lib/bookingWidgetDomain").Club) => boolean
  sessions: import("../../lib/bookingWidgetDomain").Session[]
  messagesForClub: (club: import("../../lib/bookingWidgetDomain").Club, messageType: "public" | "admin_private") => import("../../lib/bookingWidgetDomain").ClubMessage[]
  canSeeClubPrivateData: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => boolean
  canUseClubMessages: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => boolean
  formatClubActivityDate: (value: string | null | undefined) => string
  joinClub: (club: import("../../lib/bookingWidgetDomain").Club) => Promise<void>
  clubThemeStyle: (club: import("../../lib/bookingWidgetDomain").Club | undefined) => Record<string, string>
  language: import("../../lib/i18n/languages").LanguageCode
  openPlayerProfile: (profileId: string, sessionId?: string, seedStats?: import("../../components/LeaderboardPanel").LeaderboardPlayer | undefined) => void
  avatarStyle: (source: { avatar_color?: string | null | undefined; avatar_text_color?: string | null | undefined } | null | undefined) => { color?: string | undefined; background?: string | undefined } | undefined
  avatarNode: (source: { avatar_url?: string | null | undefined; avatar_emoji?: string | null | undefined; avatar_initials?: string | null | undefined; avatar_color?: string | null | undefined; avatar_text_color?: string | null | undefined; display_name?: string | null | undefined; full_name?: string | null | undefined; nickname?: string | null | undefined } | null | undefined, fallback?: string) => React.JSX.Element
  busyClubId: string
  removeClubMember: (club: import("../../lib/bookingWidgetDomain").Club, member: import("../../lib/bookingWidgetDomain").ClubMember) => Promise<void>
  approveClubMember: (member: import("../../lib/bookingWidgetDomain").ClubMember) => Promise<void>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingClubPageActions(getContext: () => ClubPageActionContext) {
  function updateClubThemeColor(value: string) {
    const { clubEditThemeColor, setClubEditThemeColor, setClubEditThemeColorDraft } = getContext()

    const normalized = cleanHexColor(value, clubEditThemeColor)
    setClubEditThemeColor(normalized)
    setClubEditThemeColorDraft(normalized)
  }

  function updateClubThemeColorDraft(value: string) {
    const { setClubEditThemeColorDraft, setClubEditThemeColor } = getContext()

    setClubEditThemeColorDraft(value)
    if (isHexColor(value)) setClubEditThemeColor(value.toLowerCase())
  }

  function openClubPage(clubId: string, tab: ClubTab = 'hall') {
    const {
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
    } = getContext()

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
    const { setClubUnlockTargetId, setClubUnlockCode, setClubUnlockStatus } = getContext()

    setClubUnlockTargetId('')
    setClubUnlockCode('')
    setClubUnlockStatus('')
  }

  function unlockClubPage(event: FormEvent<HTMLFormElement>) {
    const {
      clubUnlockTarget,
      clubUnlockCode,
      setClubUnlockStatus,
      text,
      setUnlockedClubIds,
      setSelectedClubId,
      setSelectedClubDate,
      setSelectedClubTab,
      setSelectedClubSessionScope,
    } = getContext()

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
    const { setSelectedClubTab, selectedClubSessionScope, ensurePastSessionsLoaded } = getContext()

    setSelectedClubTab(tab)
    if (tab === 'sessions' && selectedClubSessionScope === 'past') {
      void ensurePastSessionsLoaded()
    }
  }

  function handleClubSessionScopeChange(scope: ClubSessionScope) {
    const { setSelectedClubSessionScope, setSelectedClubDate, ensurePastSessionsLoaded } = getContext()

    setSelectedClubSessionScope(scope)
    setSelectedClubDate('')
    if (scope === 'past') void ensurePastSessionsLoaded()
  }

  function handleClubBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const { setClubStatus, text, setClubBannerFile, setClubBannerPreview } = getContext()

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

  function isUserClub(club: Club) {
    const { userId, canManageClub } = getContext()

    if (!userId) return false
    if (club.owner_id === userId || canManageClub(club)) return true
    return clubMembers(club).some((member) => member.profile_id === userId && member.status === 'approved')
  }

  function nextSessionForClub(club: Club) {
    const { sessions } = getContext()

    return sessions
      .filter((session) => session.club_id === club.id && isUpcomingSession(session))
      .sort((left, right) => sessionStartDate(left).getTime() - sessionStartDate(right).getTime())[0]
  }

  function latestMessageForClub(club: Club) {
    const { messagesForClub } = getContext()

    return [...messagesForClub(club, 'public'), ...messagesForClub(club, 'admin_private')]
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
        return rightTime - leftTime
      })[0]
  }

  function renderClubCard(club: Club) {
    const {
      userId,
      canManageClub,
      canOpenClubPage,
      canSeeClubPrivateData,
      canUseClubMessages,
      formatClubActivityDate,
      text,
      joinClub,
      clubThemeStyle,
      language,
      openPlayerProfile,
      avatarStyle,
      avatarNode,
      busyClubId,
      removeClubMember,
      approveClubMember,
    } = getContext()

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

  return {
    updateClubThemeColor,
    updateClubThemeColorDraft,
    openClubPage,
    closeClubUnlockModal,
    unlockClubPage,
    handleClubTabChange,
    handleClubSessionScopeChange,
    handleClubBannerChange,
    isUserClub,
    nextSessionForClub,
    latestMessageForClub,
    renderClubCard,
  }
}
