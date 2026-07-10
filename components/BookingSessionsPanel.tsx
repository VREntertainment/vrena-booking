'use client'

import dynamic from 'next/dynamic'
import NextImage from 'next/image'
import { Fragment, type ReactNode } from 'react'
import { Bold, CalendarDays, ChevronDown, ChevronUp, Gift, Italic, Map, Send, Sparkles, Strikethrough, Ticket, Trophy, Underline, Users, X } from 'lucide-react'
import { formatNotesHtml } from '../lib/formatNotesHtml'
import { games, ticketServices, type GameId, type TicketType } from '../lib/bookingStaticData'
import { BookingType, MatchStatus, QualificationRule, TicketStatus, TournamentFormat, compactDisplayName, displayName, eligibleTournamentParticipants, formatShortDate, isBestSessionPerformer, isChallengeSession, isInteractiveClickTarget, isPastSession, isTicketSession, localDateString, participantPaymentAmountSummary, participantPaymentMethodSummary, playerCardLabel, queueLabel, rankEmoji, seatsLeft, sessionCoverGame, ticketArenaCountForPlayers, ticketDurationForPlayers, ticketPricingSummary, ticketTypeLabel, type Participant } from '../lib/bookingWidgetDomain'
import MessageBodyText from './MessageBodyText'
import SessionsView from './SessionsView'
import { ShareSymbol } from './BookingWidgetUi'
import AppLoadingState from './AppLoadingState'
import type { Session } from '../lib/bookingWidgetDomain'

const RichNotesEditor = dynamic(() => import('./RichNotesEditor'), { ssr: false })
const ShortDateInput = dynamic(() => import('./ShortDateInput'), { ssr: false })
const TournamentControlPanel = dynamic(() => import('./TournamentControlPanel'), {
  ssr: false,
  loading: () => <AppLoadingState className="tournament-desk" compact />,
})

type BookingSessionsPanelProps = {
  context: Record<string, any>
}

type SessionRetentionCardAction = 'tickets' | 'create' | 'share' | 'guide' | 'today' | 'clubs' | 'leaderboard'

type SessionRetentionCard = {
  action: SessionRetentionCardAction
  accent: string
  body: string
  cta: string
  icon: ReactNode
  id: string
  title: string
}

const sessionRetentionCadence = [3, 4, 5, 3, 5, 4, 3]

export default function BookingSessionsPanel({ context }: BookingSessionsPanelProps) {
  const {
    activeView, announcementDrafts, applyRichTextCommand, commentDrafts, editSelectedGames, editTournamentBestOf, editTournamentCustomQualifiers, editTournamentFirstPrize, editTournamentFormat, editTournamentQualificationRule, editTournamentRequirePayment, editTournamentRoundsPerMatch, editTournamentSecondPrize, editTournamentThirdPlace, editTournamentThirdPrize, handleEditArenaCountChange, handleEditMaxPlayersChange, inviteSearch, setAnnouncementDrafts, setCommentDrafts, setEditSelectedGames, setEditTournamentBestOf, setEditTournamentCustomQualifiers, setEditTournamentFirstPrize, setEditTournamentFormat, setEditTournamentQualificationRule, setEditTournamentRequirePayment, setEditTournamentRoundsPerMatch, setEditTournamentSecondPrize, setEditTournamentThirdPlace, setEditTournamentThirdPrize, setInviteSearch, setInviteModalSessionId, addToCalendarText, addTournamentEditor, advanceTournamentRound, allProfiles, avatarFields, avatarNode, avatarStyle, bestOfLabel, bestPerformerText, busyClubId, busyInviteKey, busyMessageKey, busySessionId, busyTournamentId, busyVoteKey, cancelSession, canAccessClubSession, canEditTournamentSession, canManageSession, canReviewSessionMessages, claimPrize, canSeeClubPrivateData, canStaffExpandTicketSessions, challengeStatusLabel, clubMemberCount, clubMembershipFor, compactDisplayName: compactDisplayNameFromContext, confirmPlayedGame, confirmedGameDrafts, copyInviteCode, copiedInviteId, createThirdPlaceMatch, crownedTopPlayer, createStatus, currentUserStatsShared, dayStripRef, deleteSessionMessage, downloadSessionCalendar, editBookingType, editSessionArenaCount, editSessionDate, editSessionDuration, editSessionDurationRecommendation, editSessionMaxPlayers, editSessionName, editSessionNotes, editSessionTime, editSessionVisibility, editTicketCustomerId, editTicketPricing, editTicketStatus, editTicketTotalPrice, editTicketType, editTimeOptions, editingSessionId, enablePushReminders, expandedNotes, expandedSessions, filteredSessions, finishTournament, formatVnd, friendList, generateTournamentMatches, hasMoreUpcomingSessions, highlightedSessionId, isAdmin,  isEnablingPush, isLoadingMoreSessions, isLoadingPastSessions, isPushSubscribed, isSearchOpen, isSessionCreator, isUpdatingSession, inviteModalSessionId, invitePlayerToSession, invitesForSession, joinClub, joinCodes, joinSession, joinWaitlist, language, leaveSession, loadedSessionDetailIds, loadingSessionDetailIds, loadSessionMessages, looseText, messageTranslationKey, messageTranslations, messagesForSession, networkTablesReady, openClubPage, openPlayerProfile, openSessionFromProfile, participantById, participantName, poolStandingsForSession, pendingInvitationsText, postSessionMessage, previousPlayersForSession, profile, promptLogin, pushReminderStatus, removeParticipant, renderGameGuideTrigger, renderTariffTrigger, requestMessageTranslation, reviewSessionMessage, search, searchShellRef, selectedSessionDate, sessionClubFor, sessionDayOptions, sessionForInvite, sessionMessagePages, sessionReminders, sessionTimeScope, setActiveView, setCheckInTarget, setConfirmedGameDrafts, setEditBookingType, setEditSessionArenaCount, setEditSessionDate, setEditSessionDuration, setEditSessionMaxPlayers, setEditSessionName, setEditSessionNotes, setEditSessionTime, setEditSessionVisibility, setEditTicketCustomerId, setEditTicketStatus, setEditTicketTotalPrice, setEditTicketType, setExpandedNotes, setIsSearchOpen, setJoinCodes, setSearch, setSelectedSessionDate, setSessionExpanded, setSessionTimeScope, setTournamentEditorEmail, setTournamentPoolSize, setupTournamentPools, shareLink, shareTournamentResults, sharedKey, startEditingSession, stopEditingSession, text, toggleMessageOriginal,  tournamentBestOf, tournamentCustomQualifiers, tournamentStageLabel, tournamentEditorEmail, tournamentEditorResults, tournamentFirstPrize, tournamentFormat, tournamentForSession, tournamentLocked, tournamentPoolSize, tournamentQualificationRule, tournamentRequirePayment, tournamentRoleHint, tournamentRoundsPerMatch, tournamentSecondPrize, tournamentThirdPlace, tournamentThirdPrize, toggleEditGame, updateSession, updateSessionMessagePage, updateTournamentMatch, updateTournamentPoolEntry, userId, voteCount, voteForGame, waitlistForSession, waitlistPosition
  } = context

  const sessionRetentionCards: SessionRetentionCard[] = [
    {
      action: 'tickets',
      accent: 'tickets',
      body: text.sessionCtaBookBody,
      cta: text.sessionCtaBookAction,
      icon: <Ticket aria-hidden="true" size={20} strokeWidth={2.35} />,
      id: 'tickets',
      title: text.sessionCtaBookTitle,
    },
    {
      action: 'create',
      accent: 'create',
      body: text.sessionCtaCreateBody,
      cta: text.sessionCtaCreateAction,
      icon: <CalendarDays aria-hidden="true" size={20} strokeWidth={2.35} />,
      id: 'create',
      title: text.sessionCtaCreateTitle,
    },
    {
      action: 'share',
      accent: 'share',
      body: text.sessionCtaShareBody,
      cta: text.sessionCtaShareAction,
      icon: <Users aria-hidden="true" size={20} strokeWidth={2.35} />,
      id: 'share',
      title: text.sessionCtaShareTitle,
    },
    {
      action: 'guide',
      accent: 'guide',
      body: text.sessionCtaGuideBody,
      cta: text.sessionCtaGuideAction,
      icon: <Map aria-hidden="true" size={20} strokeWidth={2.35} />,
      id: 'guide',
      title: text.sessionCtaGuideTitle,
    },
    {
      action: 'today',
      accent: 'today',
      body: text.sessionCtaTodayBody,
      cta: text.sessionCtaTodayAction,
      icon: <Sparkles aria-hidden="true" size={20} strokeWidth={2.35} />,
      id: 'today',
      title: text.sessionCtaTodayTitle,
    },
    {
      action: 'clubs',
      accent: 'clubs',
      body: text.sessionCtaClubsBody,
      cta: text.sessionCtaClubsAction,
      icon: <Gift aria-hidden="true" size={20} strokeWidth={2.35} />,
      id: 'clubs',
      title: text.sessionCtaClubsTitle,
    },
    {
      action: 'leaderboard',
      accent: 'leaderboard',
      body: text.sessionCtaLeaderboardBody,
      cta: text.sessionCtaLeaderboardAction,
      icon: <Trophy aria-hidden="true" size={20} strokeWidth={2.35} />,
      id: 'leaderboard',
      title: text.sessionCtaLeaderboardTitle,
    },
  ]

  const shouldShowSessionRetentionCards = sessionTimeScope === 'upcoming' && !search && !selectedSessionDate

  function sessionRetentionCardForIndex(index: number) {
    if (!shouldShowSessionRetentionCards) {
      return null
    }

    let insertionPoint = 0
    for (let cardIndex = 0; cardIndex < sessionRetentionCards.length; cardIndex += 1) {
      insertionPoint += sessionRetentionCadence[cardIndex]
      if (index + 1 === insertionPoint) {
        return sessionRetentionCards[cardIndex]
      }
    }
    return null
  }

  function handleSessionRetentionAction(action: SessionRetentionCardAction) {
    if (action === 'tickets') {
      setActiveView('tickets')
      return
    }
    if (action === 'create') {
      if (profile) {
        setActiveView('create')
      } else {
        promptLogin()
      }
      return
    }
    if (action === 'share') {
      void shareLink('app', 'VRena Sessions')
      return
    }
    if (action === 'today') {
      setSessionTimeScope('upcoming')
      setSelectedSessionDate(localDateString(new Date()))
      return
    }
    if (action === 'clubs') {
      setActiveView('clubs')
      return
    }
    if (action === 'leaderboard') {
      setActiveView('leaderboard')
    }
  }

  function renderSessionRetentionCard(card: SessionRetentionCard) {
    return (
      <div className={`session-retention-card session-retention-card-${card.accent}`} key={`session-retention-${card.id}`}>
        <span className="session-retention-card-icon">{card.icon}</span>
        <span className="session-retention-card-copy">
          <strong>{card.title}</strong>
          <span>{card.body}</span>
        </span>
        {card.action === 'guide' ? (
          renderGameGuideTrigger(null, 'session-retention-card-cta')
        ) : (
          <button className="session-retention-card-cta" type="button" onClick={() => handleSessionRetentionAction(card.action)}>
            {card.cta}
          </button>
        )}
      </div>
    )
  }

  return (
<SessionsView
  createStatus={createStatus}
  dayStripRef={dayStripRef}
  filteredSessionCount={filteredSessions.length}
  hasMoreUpcomingSessions={hasMoreUpcomingSessions}
  isEnablingPush={isEnablingPush}
  isLoadingMoreSessions={isLoadingMoreSessions}
  isLoadingPastSessions={isLoadingPastSessions}
  isPushSubscribed={isPushSubscribed}
  isSearchOpen={isSearchOpen}
  onClearSearch={() => {
    setSearch('')
    setSelectedSessionDate('')
    setIsSearchOpen(false)
  }}
  onCreateSession={() => (profile ? setActiveView('create') : promptLogin())}
  onEnablePushReminders={enablePushReminders}
  onSearchChange={setSearch}
  onSearchOpenChange={setIsSearchOpen}
  onSelectedSessionDateChange={setSelectedSessionDate}
  onSessionTimeScopeChange={setSessionTimeScope}
  pushReminderStatus={pushReminderStatus}
  search={search}
  searchShellRef={searchShellRef}
  selectedSessionDate={selectedSessionDate}
  sessionDayOptions={sessionDayOptions}
  sessionReminderItems={sessionReminders.slice(0, 3).map(({ session, label }: { session: Session; label: string }) => (
    <button key={session.id} type="button" onClick={() => openSessionFromProfile(session.id)}>
      <span>{label}</span>
      <small>{session.name} · {formatShortDate(session.date, language)} {session.start_time.slice(0, 5)}</small>
    </button>
  ))}
  sessionRemindersVisible={sessionReminders.length > 0}
  sessionTimeScope={sessionTimeScope}
  tariffTrigger={renderTariffTrigger()}
  text={text}
>
    {filteredSessions.map((session: Session, sessionIndex: number) => {
      const sessionRetentionCard = sessionRetentionCardForIndex(sessionIndex)
      const participants = session.session_participants ?? []
      const waitlist: any[] = waitlistForSession(session)
      const remaining = seatsLeft(session)
      const alreadyJoined = participants.some((participant) => participant.profile_id === userId)
      const myWaitlistPosition = userId ? waitlistPosition(session, userId) : null
      const isSessionOwner = session.owner_id === userId
      const isTicket = isTicketSession(session)
      const isChallenge = isChallengeSession(session)
      const canManage = canManageSession(session)
      const canExpandTicketSession = isSessionCreator(session) || canStaffExpandTicketSessions
      const canExpandDetails = isTicket
        ? canExpandTicketSession
        : isChallenge
          ? Boolean(isSessionOwner || isAdmin || alreadyJoined || session.challenge_target_id === userId)
          : true
      const canSeeInviteCode = !isTicket && !isChallenge && session.visibility === 'private' && session.invite_code && (alreadyJoined || isSessionOwner || isAdmin)
      const isEditing = editingSessionId === session.id
      const sessionClub = sessionClubFor(session)
      const sessionClubMembership = clubMembershipFor(sessionClub)
      const canJoinThisSession = canAccessClubSession(session)
      const canSeeSessionPlayers = canSeeClubPrivateData(sessionClub)
      const isExpanded = canExpandDetails && Boolean(expandedSessions[session.id])
      const isHighlighted = highlightedSessionId === session.id
      const isPast = isPastSession(session)
      const canMutatePastSession = !isPast || canManage
      const coverGame = sessionCoverGame(session)
      const confirmedGameDraft = confirmedGameDrafts[session.id] ?? session.confirmed_game_id ?? ''
      const confirmedGameSaved = Boolean(session.confirmed_game_id) && confirmedGameDraft === session.confirmed_game_id
      const confirmedGameOptions = isTicket || isChallenge
        ? games
        : session.game_options
          .map((gameId) => games.find((item) => item.id === gameId))
          .filter((game): game is (typeof games)[number] => Boolean(game))
      const sessionInviteRows: any[] = invitesForSession(session.id)
      const invitedMe = sessionInviteRows.some((invite) => invite.recipient_id === userId)
      const invitedIds = new Set(sessionInviteRows.map((invite: any) => invite.recipient_id))
      const friendInviteTargets = friendList().map((friend: any) => ({
        profile_id: friend.following_id,
        display_name: friend.display_name,
        avatar_url: friend.avatar_url,
        avatar_emoji: friend.avatar_emoji,
        avatar_initials: friend.avatar_initials,
        avatar_color: friend.avatar_color,
        avatar_text_color: friend.avatar_text_color,
        profile_motto: friend.profile_motto,
      }))
      const previousInviteTargets = previousPlayersForSession(session)
      const inviteTargets = [...friendInviteTargets, ...previousInviteTargets]
        .filter((target, index, list) => list.findIndex((item) => item.profile_id === target.profile_id) === index)
        .filter((target) => !participants.some((participant) => participant.profile_id === target.profile_id))
      const normalizedInviteSearch = inviteModalSessionId === session.id ? inviteSearch.trim().toLocaleLowerCase() : ''
      const filteredInviteTargets = normalizedInviteSearch
        ? inviteTargets.filter((target) => {
          const displayName = compactDisplayName(target.display_name, text.player).toLocaleLowerCase()
          const motto = (target.profile_motto || '').toLocaleLowerCase()
          return displayName.includes(normalizedInviteSearch) || motto.includes(normalizedInviteSearch)
        })
        : inviteTargets
      const visibleInviteTargets = filteredInviteTargets.slice(0, 24)
      const sessionMessageRows = messagesForSession(session)
      const sessionMessagePage = sessionMessagePages[session.id]
      const isSessionMessagesLoading = Boolean(sessionMessagePage?.loading)
      const hasEarlierSessionMessages = Boolean(sessionMessagePage?.hasMore && sessionMessagePage.oldestCreatedAt)
      const isSessionDetailLoading = Boolean(loadingSessionDetailIds[session.id])
      const isSessionDetailLoaded = Boolean(loadedSessionDetailIds[session.id])
      const hasCrownHolder = Boolean(
        crownedTopPlayer?.profileId
        && crownedTopPlayer.profileId !== userId
        && participants.some((participant) => participant.profile_id === crownedTopPlayer.profileId)
      )

      return (
        <Fragment key={session.id}>
        <article
          className={[
            'session',
            isTicket ? 'ticket-session-row' : '',
            isExpanded ? 'expanded-session' : '',
            isHighlighted ? 'session-highlighted' : '',
          ].filter(Boolean).join(' ')}
          id={`session-${session.id}`}
        >
          <div
            className={[
              'compact-session-card',
              isTicket ? 'ticket-session-card' : '',
              isExpanded ? 'compact-session-card-expanded' : '',
            ].filter(Boolean).join(' ')}
            onClick={(event) => {
              if (!canExpandDetails) return
              if (isInteractiveClickTarget(event.target)) return
              setSessionExpanded(session, !isExpanded)
            }}
            role={canExpandDetails ? 'button' : undefined}
            tabIndex={canExpandDetails ? 0 : undefined}
            onKeyDown={(event) => {
              if (!canExpandDetails) return
              if (isInteractiveClickTarget(event.target)) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setSessionExpanded(session, !isExpanded)
              }
            }}
          >
            {isTicket ? (
              <span className="ticket-session-visual" aria-hidden="true">
                <Ticket size={23} strokeWidth={2.45} />
              </span>
            ) : (
              <NextImage className="compact-session-image" src={coverGame.image} alt="" width={116} height={116} />
            )}
            <div className="compact-session-main">
              <div className="compact-session-title-row">
                <h3>{session.name}</h3>
                {session.session_type === 'tournament' && (
                  <span className="pill private session-kind-pill session-kind-tournament">
                    {text.tournament}
                  </span>
                )}
                <span className={session.visibility === 'private' ? 'pill private session-visibility-pill session-visibility-private' : 'pill ok session-visibility-pill session-visibility-open'}>
                  {session.visibility === 'private' ? text.private : text.sessionOpen}
                </span>
                {isTicket && <span className="pill ticket-pill">{text.privateTicketSession}</span>}
                {isChallenge && <span className="pill challenge-pill">{text.challengeSession}</span>}
                {isChallenge && session.challenge_status && <span className="pill ok">{challengeStatusLabel(session.challenge_status)}</span>}
                {session.seeded && <span className="pill soft-opening-pill">{session.seed_label || text.softOpeningHighlights}</span>}
                {isSessionOwner && <span className="pill host-pill">{text.host}</span>}
                {!isTicket && !isChallenge && invitedMe && <span className="pill ok">{text.invited}</span>}
              </div>
              <div className="row-meta compact-meta">
                <span>{formatShortDate(session.date, language)}</span>
                <span>{session.start_time.slice(0, 5)}</span>
                <span>{session.duration_minutes} min</span>
                {!isTicket && renderGameGuideTrigger(coverGame.id, 'compact-game-guide-link')}
                {!isTicket && !isPast && <span>{remaining} {text.seatsLeft}</span>}
                {isPast && <span>{text.finalGame}: {coverGame.title}</span>}
                {session.session_type === 'tournament' && <span>{text.roundsPerMatch}: {session.rounds_per_match || 1}</span>}
                {isTicket && <span>{session.ticket_player_count || session.max_players} {text.players}</span>}
              </div>
            </div>
            <div className="compact-session-actions">
                {!isTicket && !isChallenge && !isPast && (!sessionClub || canJoinThisSession) && session.visibility === 'private' && !alreadyJoined && !myWaitlistPosition && !invitedMe && (
                <input
                  className="compact-code"
                  placeholder={text.privateCode}
                  value={joinCodes[session.id] || ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    setJoinCodes((current: Record<string, string>) => ({ ...current, [session.id]: event.target.value.toUpperCase() }))
                  }
                />
              )}
              {!isPast && isTicket ? (
                canExpandTicketSession ? (
                  <span className="ticket-session-label">{text.privateTicketSession}</span>
                ) : (
                  <button
                    className="primary compact-join"
                    onClick={(event) => {
                      event.stopPropagation()
                      setActiveView('tickets')
                    }}
                    type="button"
                  >
                    {text.bookTickets}
                  </button>
                )
              ) : !isPast && isChallenge ? (
                invitedMe && !alreadyJoined ? (
                  <button
                    className={busySessionId === session.id ? 'primary compact-join loading' : 'primary compact-join'}
                    data-tour="join-session"
                    disabled={busySessionId === session.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      joinSession(session)
                    }}
                    type="button"
                  >
                    {busySessionId === session.id ? text.joining : text.acceptChallenge}
                  </button>
                ) : (
                  <span className="challenge-session-label">{challengeStatusLabel(session.challenge_status)}</span>
                )
              ) : !isPast && sessionClub && !canJoinThisSession ? (
                <button
                  className={busyClubId === sessionClub.id ? 'secondary compact-join loading' : 'secondary compact-join'}
                  disabled={busyClubId === sessionClub.id || sessionClubMembership?.status === 'pending'}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (sessionClub.visibility === 'private') {
                      openClubPage(sessionClub.id)
                    } else {
                      joinClub(sessionClub)
                    }
                  }}
                  type="button"
                >
                  {sessionClubMembership?.status === 'pending'
                    ? text.requestSent
                    : sessionClub.visibility === 'private'
                      ? text.unlockClub
                      : text.joinClub}
                </button>
              ) : !isPast && (
                <button
                  className={busySessionId === session.id ? 'primary compact-join loading' : 'primary compact-join'}
                  data-tour="join-session"
                  disabled={alreadyJoined || Boolean(myWaitlistPosition) || busySessionId === session.id || !canMutatePastSession}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (remaining <= 0) {
                      joinWaitlist(session)
                    } else {
                      joinSession(session)
                    }
                  }}
                  type="button"
                >
                  {alreadyJoined
                    ? text.joined
                    : myWaitlistPosition
                      ? `${text.waitlisted} #${myWaitlistPosition}`
                      : remaining <= 0
                        ? text.joinWaitlist
                        : busySessionId === session.id
                          ? text.joining
                          : text.joinSession}
                </button>
              )}
              <button
                aria-label={text.share}
                className={sharedKey === session.id ? 'share-icon-button compact-share desktop-session-share copied' : 'share-icon-button compact-share desktop-session-share'}
                title={text.share}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  shareLink(session.id, session.name, `#session-${session.id}`)
                }}
              >
                <ShareSymbol />
              </button>
              {canExpandDetails && (
                <button
                  className="secondary compact-expand"
                  aria-label={isExpanded ? text.hideDetails : text.expandDetails}
                  title={isExpanded ? text.hideDetails : text.expandDetails}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setSessionExpanded(session, !isExpanded)
                  }}
                >
                  {isExpanded ? <ChevronUp aria-hidden="true" size={18} /> : <ChevronDown aria-hidden="true" size={18} />}
                  <span className="sr-only">{isExpanded ? text.hideDetails : text.expandDetails}</span>
                </button>
              )}
            </div>
          </div>
          {hasCrownHolder && <p className="notice crown-session-notice">{text.topPlayerNotice}</p>}
          {isExpanded && (
            <div className="session-expanded">
              {isSessionDetailLoading && !isSessionDetailLoaded && (
                <p className="notice" aria-busy="true">...</p>
              )}

              {sessionClub && (
                <div className="expanded-session-flags">
                  <span className="pill">{text.clubSession}: {sessionClub.name}</span>
                </div>
              )}

              {isTicket && (
                <div className="ticket-session-summary">
                  <span>{text.ticketType}: <strong>{ticketTypeLabel(session.ticket_type || 'individual', looseText)}</strong></span>
                  <span>{text.numberOfPlayers}: <strong>{session.ticket_player_count || session.max_players}</strong></span>
                  <span>{text.bookingStatus}: <strong>{session.ticket_status || 'confirmed'}</strong></span>
                  {session.ticket_reference && <span>{text.bookingReference}: <strong>{session.ticket_reference}</strong></span>}
                </div>
              )}

              {session.notes && (
                <div className={expandedNotes[session.id] ? 'notes-block expanded' : 'notes-block'}>
                  <div
                    className="notes"
                    dangerouslySetInnerHTML={{ __html: formatNotesHtml(session.notes, { markdownShortcuts: true }) }}
                  />
                  <button
                    className="expand-note"
                    type="button"
                    onClick={() => setExpandedNotes((current: Record<string, boolean>) => ({ ...current, [session.id]: !current[session.id] }))}
                  >
                    {expandedNotes[session.id] ? `⌃ ${text.collapse}` : `⌄ ${text.expand}`}
                  </button>
                </div>
              )}

          {canManage && (
            <div className="manage-row">
              <button className="secondary small-button" type="button" onClick={() => startEditingSession(session)}>
                {text.editSession}
              </button>
              <button
                className={busySessionId === session.id ? 'danger small-button loading' : 'danger small-button'}
                disabled={busySessionId === session.id}
                type="button"
                onClick={() => cancelSession(session)}
              >
                {text.cancelSession}
              </button>
            </div>
          )}

          {canManage && (
            <div className="confirm-game-panel">
              <select
                aria-label={text.playedGame}
                value={confirmedGameDraft}
                onChange={(event) => {
                  setConfirmedGameDrafts((current: Record<string, string>) => ({ ...current, [session.id]: event.target.value }))
                }}
              >
                <option value="">{text.notConfirmed}</option>
                {confirmedGameOptions.map((game) => {
                  return <option key={game.id} value={game.id}>{game.title}</option>
                })}
              </select>
              <button
                className={busySessionId === session.id ? 'secondary small-button loading' : 'secondary small-button'}
                disabled={busySessionId === session.id}
                type="button"
                onClick={() => confirmPlayedGame(session)}
              >
                {confirmedGameSaved ? text.playedGameConfirmed : text.confirmPlayedGame}
              </button>
            </div>
          )}

          {isEditing && (
            <div className="edit-panel">
              <div className="section-head compact-head">
                <div>
                  <h3>{text.editSessionTitle}</h3>
                  <p className="muted">{text.editSessionHint}</p>
                </div>
                {!session.club_id && editBookingType !== 'ticket' && editBookingType !== 'challenge' && (
                  <div className="segmented">
                    <button className={editSessionVisibility === 'public' ? 'active' : ''} onClick={() => setEditSessionVisibility('public')} type="button">
                      {text.public}
                    </button>
                    <button className={editSessionVisibility === 'private' ? 'active' : ''} onClick={() => setEditSessionVisibility('private')} type="button">
                      {text.private}
                    </button>
                  </div>
                )}
              </div>
              <div className="form-grid">
                <div className="full">
                  <label>{text.sessionName} <span className="required">*</span></label>
                  <input data-testid="edit-session-name" value={editSessionName} onChange={(event) => setEditSessionName(event.target.value)} />
                </div>
                {isAdmin && (
                  <div className="full ticket-admin-box">
                    <div className="ticket-admin-head">
                      <strong>{text.ticketAdminTitle}</strong>
                      <span>{text.ticketAdminHint}</span>
                    </div>
                    <div className="form-grid compact-form-grid">
                      <div>
                        <label>{text.bookingType}</label>
                        <select value={editBookingType} onChange={(event) => setEditBookingType(event.target.value as BookingType)}>
                          <option value="community">{text.communitySession}</option>
                          <option value="ticket">{text.ticketGenerated}</option>
                          <option value="challenge">{text.challengeGenerated}</option>
                        </select>
                      </div>
                      {editBookingType === 'ticket' && (
                        <>
                          <div>
                            <label>{text.ticketCustomer}</label>
                            <select value={editTicketCustomerId} onChange={(event) => setEditTicketCustomerId(event.target.value)}>
                              <option value="">{text.noProfile}</option>
                            {(allProfiles as any[]).map((player) => (
                                <option key={player.id} value={player.id}>
                                  {displayName(player)}{player.email ? ` · ${player.email}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>{text.ticketType}</label>
                            <select
                              value={editTicketType}
                              onChange={(event) => {
                                const nextType = event.target.value as TicketType
                                const nextDuration = ticketDurationForPlayers(nextType, editSessionMaxPlayers)
                                setEditTicketType(nextType)
                                setEditSessionDuration(nextDuration)
                                setEditSessionArenaCount(ticketArenaCountForPlayers())
                                setEditTicketTotalPrice(String(ticketPricingSummary(nextType, editSessionDate, editSessionTime, editSessionMaxPlayers, nextDuration).totalPrice))
                              }}
                            >
                              {ticketServices.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {ticketTypeLabel(service.id, looseText)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>{text.totalPrice}</label>
                            <input
                              inputMode="numeric"
                              min={0}
                              type="number"
                              value={editTicketTotalPrice}
                              onChange={(event) => setEditTicketTotalPrice(event.target.value)}
                            />
                            <p className="field-help">
                              {text.reservedPlayerSpots}: {editTicketPricing.chargedPlayerSpots} · {text.unitPrice}: {formatVnd(editTicketPricing.baseUnitPrice)} · {text.totalPrice}: {formatVnd(editTicketPricing.totalPrice)}
                            </p>
                          </div>
                          <div>
                            <label>{text.bookingStatus}</label>
                            <select value={editTicketStatus} onChange={(event) => setEditTicketStatus(event.target.value as TicketStatus)}>
                              <option value="pending">{text.ticketStatusPending}</option>
                              <option value="confirmed">{text.ticketStatusConfirmed}</option>
                              <option value="cancelled">{text.ticketStatusCancelled}</option>
                              <option value="completed">{text.ticketStatusCompleted}</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {session.session_type === 'tournament' && (() => {
                  const tournament = tournamentForSession(session.id)
                  const hasTournamentBracket = tournament.pools.length > 0 || tournament.matches.length > 0

                  return (
                    <div className="full tournament-create-box tournament-settings-box">
                      <div className="tournament-settings-head">
                        <strong>{text.tournamentRules}</strong>
                        <span>{hasTournamentBracket ? text.tournamentRulesLockedHint : text.tournamentRulesHint}</span>
                      </div>
                      <div className="form-grid compact-form-grid">
                        <div>
                          <label>{text.tournamentFormat}</label>
                          <select disabled={hasTournamentBracket} value={editTournamentFormat} onChange={(event) => setEditTournamentFormat(event.target.value as TournamentFormat)}>
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
                          <select disabled={hasTournamentBracket} value={editTournamentBestOf} onChange={(event) => setEditTournamentBestOf(Number(event.target.value) as 1 | 3 | 5)}>
                            <option value={1}>BO1</option>
                            <option value={3}>BO3</option>
                            <option value={5}>BO5</option>
                          </select>
                        </div>
                        <div>
                          <label>{text.roundsPerMatch}</label>
                          <select value={editTournamentRoundsPerMatch} onChange={(event) => setEditTournamentRoundsPerMatch(Number(event.target.value))}>
                            {[1, 2, 3, 4, 5].map((roundCount) => (
                              <option key={roundCount} value={roundCount}>{roundCount}</option>
                            ))}
                          </select>
                          <p className="field-help">{text.roundsPerMatchHint}</p>
                        </div>
                        <div>
                          <label>{text.qualification}</label>
                          <select disabled={hasTournamentBracket} value={editTournamentQualificationRule} onChange={(event) => setEditTournamentQualificationRule(event.target.value as QualificationRule)}>
                            <option value="top_1">{text.topOnePerPool}</option>
                            <option value="top_2">{text.topTwoPerPool}</option>
                            <option value="top_4">{text.topFourPerPool}</option>
                            <option value="custom">{text.custom}</option>
                          </select>
                        </div>
                        {editTournamentQualificationRule === 'custom' && (
                          <div>
                            <label>{text.customQualifiers}</label>
                            <input disabled={hasTournamentBracket} inputMode="numeric" min={1} max={16} type="number" value={editTournamentCustomQualifiers} onChange={(event) => setEditTournamentCustomQualifiers(Number(event.target.value) || 1)} />
                          </div>
                        )}
                        <label className="toggle-line">
                          <input checked={editTournamentRequirePayment} onChange={(event) => setEditTournamentRequirePayment(event.target.checked)} type="checkbox" />
                          <span>{text.requirePaymentForBracket}</span>
                        </label>
                        <label className="toggle-line">
                          <input checked={editTournamentThirdPlace} onChange={(event) => setEditTournamentThirdPlace(event.target.checked)} type="checkbox" />
                          <span>{text.createBronzeMatch}</span>
                        </label>
                        <div>
                          <label>{text.firstPrize}</label>
                          <input value={editTournamentFirstPrize} onChange={(event) => setEditTournamentFirstPrize(event.target.value)} placeholder="1,000,000 VND" />
                        </div>
                        <div>
                          <label>{text.secondPrize}</label>
                          <input value={editTournamentSecondPrize} onChange={(event) => setEditTournamentSecondPrize(event.target.value)} placeholder="Free Ticket" />
                        </div>
                        <div>
                          <label>{text.thirdPrize}</label>
                          <input value={editTournamentThirdPrize} onChange={(event) => setEditTournamentThirdPrize(event.target.value)} placeholder="Free Drink" />
                        </div>
                      </div>
                    </div>
                  )
                })()}
                <div className="full session-timing-row">
                  <div>
                    <label>{text.date} <span className="required">*</span></label>
                    <ShortDateInput
                      ariaLabel={text.date}
                      language={language}
                      onChange={setEditSessionDate}
                      placeholder={text.chooseDate}
                      value={editSessionDate}
                    />
                  </div>
                  <div>
                    <label>{text.availableTime} <span className="required">*</span></label>
                    <select value={editSessionTime} onChange={(event) => setEditSessionTime(event.target.value)}>
                      <option value="">{text.chooseTime}</option>
                      {(editTimeOptions as Array<{ value: string; label: string }>).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>{text.duration}</label>
                    <select value={editSessionDuration} onChange={(event) => setEditSessionDuration(Number(event.target.value))}>
                      {Array.from({ length: 12 }, (_, index) => (index + 1) * 20).map((duration) => (
                        <option value={duration} key={duration}>
                          {duration} min
                        </option>
                      ))}
                    </select>
                    {editSessionDurationRecommendation && <p className="field-help">{editSessionDurationRecommendation}</p>}
                  </div>
                </div>
                <div className="full session-capacity-row">
                  <div>
                    <label>{text.maxPlayers}</label>
                    <select value={editSessionMaxPlayers} onChange={(event) => handleEditMaxPlayersChange(Number(event.target.value))}>
                      {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                        <option value={count} key={count}>
                          {count} player{count === 1 ? '' : 's'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>{text.arenas}</label>
                    <select value={editSessionArenaCount} onChange={(event) => handleEditArenaCountChange(Number(event.target.value))}>
                      <option value={1}>{text.oneArena}</option>
                      <option value={2} disabled={editSessionMaxPlayers < 8}>
                        {text.twoArenas}
                      </option>
                    </select>
                  </div>
                </div>
                <div className="full">
                  <div className="game-picker-head">
                    <label>{text.gameOptions} <span className="required">*</span></label>
                    {renderGameGuideTrigger(null, 'game-picker-guide-link')}
                  </div>
                  <div className="game-picker compact-games">
                    {games.map((game) => (
                      <div className="game-card-shell" key={game.id}>
                        <button
                          className={editSelectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                          onClick={() => toggleEditGame(game.id)}
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
                    value={editSessionNotes}
                    onChange={setEditSessionNotes}
                    placeholder={text.notesPlaceholder}
                    resetKey={`edit-${editingSessionId || session.id}`}
                  />
                </div>
              </div>
              <div className="action-row">
                <button
                  data-testid="edit-session-submit"
                  className={isUpdatingSession ? 'primary loading create-button' : 'primary create-button'}
                  disabled={isUpdatingSession}
                  type="button"
                  onClick={() => updateSession(session)}
                >
                  {isUpdatingSession ? text.saving : text.saveChanges}
                </button>
                <button className="secondary create-button" type="button" onClick={stopEditingSession}>
                  {text.close}
                </button>
              </div>
            </div>
          )}

          {canSeeInviteCode && (
            <div className="invite-code">
              <span>{text.privateCode}</span>
              <strong>{session.invite_code}</strong>
              <button
                className={copiedInviteId === session.id ? 'copied' : ''}
                type="button"
                onClick={() => copyInviteCode(session.id, session.invite_code)}
              >
                {copiedInviteId === session.id ? text.copied : text.copy}
              </button>
            </div>
          )}

          {!isTicket && !isChallenge && networkTablesReady && (alreadyJoined || canManage) && (
            <div className="network-panel">
              <div className="section-head compact-head network-head">
                <div>
                  <h3>{text.sessionNetwork}</h3>
                  <p className="muted">{text.sessionNetworkHint}</p>
                </div>
                <div className="network-actions">
                  <button
                    className="secondary small-button"
                    type="button"
                    onClick={() => {
                      setInviteSearch('')
                      setInviteModalSessionId(session.id)
                    }}
                  >
                    {text.invitePlayer}
                  </button>
                </div>
              </div>
              {canManage && sessionInviteRows.length > 0 && (
                <p className="muted">{text.sentInvites}: {sessionInviteRows.length}</p>
              )}
            </div>
          )}

          {inviteModalSessionId === session.id && (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`invite-session-title-${session.id}`} onClick={() => setInviteModalSessionId('')}>
              <div className="login-modal session-invite-modal" onClick={(event) => event.stopPropagation()}>
                <button className="modal-close" type="button" onClick={() => setInviteModalSessionId('')} aria-label={text.close}>
                  <X aria-hidden="true" size={20} />
                </button>
                <div className="session-invite-modal-head">
                  <h3 id={`invite-session-title-${session.id}`}>{text.invitePlayer}</h3>
                  <p>{text.sessionNetworkHint}</p>
                </div>
                <button
                  aria-label={text.share}
                  className={sharedKey === session.id ? 'share-icon-button session-invite-share copied' : 'share-icon-button session-invite-share'}
                  title={text.share}
                  type="button"
                  onClick={() => shareLink(session.id, session.name, `#session-${session.id}`)}
                >
                  <ShareSymbol />
                </button>
                <input
                  aria-label={text.invitePlayerSearch}
                  autoFocus
                  placeholder={text.invitePlayerSearchPlaceholder}
                  type="search"
                  value={inviteSearch}
                  onChange={(event) => setInviteSearch(event.target.value)}
                />
                {visibleInviteTargets.length === 0 ? (
                  <p className="notice">{text.noInviteTargets}</p>
                ) : (
                  <div className="invite-search-results">
                    {visibleInviteTargets.map((target: any) => {
                      const inviteKey = `${session.id}-${target.profile_id}`
                      const isInvited = invitedIds.has(target.profile_id)

                      return (
                        <button
                          className="invite-result-row"
                          disabled={isInvited || busyInviteKey === inviteKey}
                          key={target.profile_id}
                          type="button"
                          onClick={() => invitePlayerToSession(session, target)}
                        >
                          <span className="player-avatar tiny-avatar" style={avatarStyle(target)}>
                            {avatarNode(target, 'P')}
                          </span>
                          <span className="invite-result-copy">
                            <strong>{compactDisplayName(target.display_name, text.player)}</strong>
                            {target.profile_motto && <small>{target.profile_motto}</small>}
                          </span>
                          <small>{isInvited ? text.invited : text.invite}</small>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="players">
            {participants.map((participant: any) => (
              <div className="player result-player" key={participant.id} title={participant.display_name || text.player}>
                <button
                  aria-label={canSeeSessionPlayers ? playerCardLabel(participant.display_name, text.player) : playerCardLabel(text.member, text.member)}
                  className={[
                    'player-avatar player-avatar-button',
                    participant.placement ? `place-${participant.placement}` : '',
                  ].join(' ').trim()}
                  onClick={() => openPlayerProfile(participant.profile_id, session.id)}
                  style={canSeeSessionPlayers ? avatarStyle(participant) : undefined}
                  type="button"
                >
                  {canSeeSessionPlayers ? avatarNode(participant, 'P') : '?'}
                  {crownedTopPlayer?.profileId === participant.profile_id && <span className="champion-badge">👑</span>}
                  {participant.checked_in && <span className="check-badge">✓</span>}
                  {participant.placement && participant.placement <= 3 && <span className="cup-badge">{rankEmoji(participant.placement)}</span>}
                </button>
                <span className="player-name-line">
                  {canSeeSessionPlayers ? compactDisplayName(participant.display_name, text.player) : text.member}
                  {participant.profile_id === session.owner_id && <small>{text.host}</small>}
                  {isBestSessionPerformer(session, participant) && <small className="best-performer-label">{bestPerformerText}</small>}
                </span>
                {(canManage || participant.profile_id === userId) && participant.payment_status && (
                  <small className="private-payment">
                    {participantPaymentMethodSummary(participant, text)}
                    {participantPaymentAmountSummary(participant) ? ` · ${participantPaymentAmountSummary(participant).toLocaleString('vi-VN')} đ` : ''}
                  </small>
                )}
                {canManage && (
                  <button
                    className="checkin-mini"
                    type="button"
                    onClick={() => setCheckInTarget({ sessionId: session.id, participantId: participant.id })}
                  >
                    {participant.checked_in ? '✓' : text.checkIn}
                  </button>
                )}
                {canManage && participant.profile_id !== session.owner_id && (
                  <button
                    className="remove-player"
                    disabled={busySessionId === session.id}
                    type="button"
                    onClick={() => removeParticipant(session, participant)}
                    title={text.remove}
                  >
                    {text.remove}
                  </button>
                )}
              </div>
            ))}
          </div>

          {!isTicket && !isChallenge && myWaitlistPosition && (
            <p className="notice waitlist-position">{text.waitlistPosition}: #{myWaitlistPosition}</p>
          )}

          {!isTicket && !isChallenge && canManage && (
            <div className="waitlist-panel">
              <strong>{text.waitlist}</strong>
              {waitlist.length === 0 ? (
                <span className="muted">{text.waitlistEmpty}</span>
              ) : (
                <div className="players compact-roster">
                  {waitlist.map((entry, index) => (
                    <div className="player" key={entry.id}>
                      <span className="player-avatar tiny-avatar" style={avatarStyle(entry)}>
                        {avatarNode(entry, 'P')}
                      </span>
                      <span>{index + 1}. {compactDisplayName(entry.display_name, text.player)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isTicket && Boolean(userId) && (
          <div className="session-comms">
            <div className="section-head compact-head">
              <div>
                <h3>{text.sessionCommunication}</h3>
                <p className="muted">{text.sessionCommunicationHint}</p>
              </div>
            </div>
            {canReviewSessionMessages(session) && (
              <div className="message-compose">
                <input
                  value={announcementDrafts[session.id] || ''}
                  onChange={(event) => setAnnouncementDrafts((current: Record<string, string>) => ({ ...current, [session.id]: event.target.value }))}
                  placeholder={text.announcementPlaceholder}
                />
                <button
                  className="secondary small-button"
                  disabled={busyMessageKey === `${session.id}-announcement`}
                  type="button"
                  onClick={() => postSessionMessage(session, 'announcement')}
                >
                  {text.postAnnouncement}
                </button>
              </div>
            )}
            {hasEarlierSessionMessages && (
              <button
                className="secondary small-button load-earlier-messages"
                disabled={isSessionMessagesLoading}
                type="button"
                onClick={() => loadSessionMessages(session.id, { before: sessionMessagePage?.oldestCreatedAt })}
              >
                {isSessionMessagesLoading ? text.sessionMessagesLoading : text.loadEarlierMessages}
              </button>
            )}
            {sessionMessageRows.length === 0 ? (
              <p className="notice" aria-busy={isSessionMessagesLoading}>
                {isSessionMessagesLoading ? text.sessionMessagesLoading : text.noSessionMessages}
              </p>
            ) : (
              <div className="message-list">
                {sessionMessageRows.map((message: any) => {
                  const moderationStatus = message.moderation_status || 'approved'
                  const canReviewMessage = canReviewSessionMessages(session) && moderationStatus === 'pending_review'
                  const isOwnMessage = message.author_id === userId
                  const messageClassName = [
                    'session-message',
                    message.message_type === 'announcement' ? 'announcement' : '',
                    isOwnMessage ? 'own-message' : '',
                  ].filter(Boolean).join(' ')
                  const translationKey = messageTranslationKey('session', message.id, language)

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
                          <strong>{message.message_type === 'announcement' ? text.creatorAnnouncement : compactDisplayName(message.author_display_name, text.player)}</strong>
                          {moderationStatus === 'pending_review' && <small className="moderation-badge pending">{text.pendingReview}</small>}
                          {moderationStatus === 'rejected' && <small className="moderation-badge rejected">{text.rejectedMessage}</small>}
                        </div>
                        <MessageBodyText
                          body={message.body}
                          messageId={message.id}
                          messageKind="session"
                          onRequestTranslation={requestMessageTranslation}
                          onToggleOriginal={() => toggleMessageOriginal('session', message.id, language)}
                          targetLanguage={language}
                          text={text}
                          translation={messageTranslations[translationKey]}
                        />
                        {(canReviewMessage || isAdmin) && (
                          <div className="moderation-actions">
                            {canReviewMessage && (
                              <>
                                <button
                                  className="secondary small-button"
                                  disabled={busyMessageKey === `${message.id}-approved` || busyMessageKey === `${message.id}-rejected`}
                                  type="button"
                                  onClick={() => reviewSessionMessage(message, 'approved')}
                                >
                                  {text.approveMessage}
                                </button>
                                <button
                                  className="danger small-button"
                                  disabled={busyMessageKey === `${message.id}-approved` || busyMessageKey === `${message.id}-rejected`}
                                  type="button"
                                  onClick={() => reviewSessionMessage(message, 'rejected')}
                                >
                                  {text.rejectMessage}
                                </button>
                              </>
                            )}
                            {isAdmin && (
                              <button
                                className="danger small-button"
                                disabled={busyMessageKey === `${message.id}-delete`}
                                type="button"
                                onClick={() => deleteSessionMessage(message)}
                              >
                                {text.deleteMessage}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {(alreadyJoined || canReviewSessionMessages(session)) && (
              <div className="message-compose">
                <input
                  value={commentDrafts[session.id] || ''}
                  onChange={(event) => setCommentDrafts((current: Record<string, string>) => ({ ...current, [session.id]: event.target.value }))}
                  placeholder={text.commentPlaceholder}
                />
                <button
                  className="secondary small-button"
                  disabled={busyMessageKey === `${session.id}-comment`}
                  type="button"
                  onClick={() => postSessionMessage(session, 'comment')}
                >
                  {text.postComment}
                </button>
              </div>
            )}
          </div>
          )}

          {session.session_type === 'tournament' && (() => {
            const tournament = tournamentForSession(session.id)
            const canEditTournament = canEditTournamentSession(session) && !tournamentLocked(session)
            const creatorCanAssignEditors = isSessionCreator(session)
            const eligiblePlayers = eligibleTournamentParticipants(session)
            const hasTournamentStructure = tournament.pools.length > 0 || tournament.matches.length > 0
            const queueMatches = tournament.matches
              .filter((match: any) => match.status !== 'completed')
              .sort((a: any, b: any) => (a.queue_position ?? 999) - (b.queue_position ?? 999) || a.round - b.round || a.match_number - b.match_number)
            const podium = [2, 1, 3]
              .map((rank) => participants.find((participant) => participant.placement === rank))
              .filter(Boolean) as Participant[]

            return (
              <TournamentControlPanel
                canEdit={canEditTournament}
                isBusy={busyTournamentId === session.id}
                onAdvanceRound={() => advanceTournamentRound(session)}
                onCreateThirdPlaceMatch={() => createThirdPlaceMatch(session)}
                onFinishTournament={() => finishTournament(session)}
                onGenerateMatches={() => generateTournamentMatches(session)}
                onPoolSizeChange={setTournamentPoolSize}
                onSetupPools={() => setupTournamentPools(session)}
                poolSize={tournamentPoolSize}
                roleHint={tournamentRoleHint(session, hasTournamentStructure)}
                summary={`${(session.tournament_format || 'pool_to_final').replace(/_/g, ' ')} · ${bestOfLabel(session.best_of)} · ${text.roundsPerMatch}: ${session.rounds_per_match || 1} · ${eligiblePlayers.length} ${text.tournamentEligible}`}
                text={text}
              >

                {podium.length > 0 && (
                  <div className="public-leaderboard">
                    <div className="section-head compact-head">
                      <div>
                        <h3>{text.tournamentPodiumTitle}</h3>
                        <p className="muted">{text.tournamentPodiumHint}</p>
                      </div>
                      <button className="share-icon-button" type="button" onClick={() => shareTournamentResults(session)}>
                        ⇧
                      </button>
                    </div>
                    <div className="podium-row">
                      {podium.map((participant: any) => (
                        <div className={`podium-player place-${participant.placement}`} key={`leader-${participant.id}`}>
                          <span className="podium-medal">{rankEmoji(participant.placement)}</span>
                          <button aria-label={playerCardLabel(participant.display_name, text.player)} className="player-avatar player-avatar-button" onClick={() => openPlayerProfile(participant.profile_id, session.id)} style={avatarStyle(participant)} type="button">
                            {avatarNode(participant, 'P')}
                          </button>
                          <strong>{compactDisplayName(participant.display_name, text.player)}</strong>
                          <small>{participant.score ?? 0} pts · {participant.accuracy_percent ?? '-'}%</small>
                          {canEditTournament && participant.placement && (
                            <button className="link-button" type="button" onClick={() => claimPrize(participant, !participant.prize_claimed)}>
                              {participant.prize_claimed ? text.prizeClaimed : `${participant.placement === 1 ? session.first_prize || text.firstPrize : participant.placement === 2 ? session.second_prize || text.secondPrize : session.third_prize || text.thirdPrize}`}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {queueMatches.length > 0 && (
                  <div className="queue-board">
                    {[1, 2].map((arenaNumber) => {
                      const arenaMatches = queueMatches.filter((match: any) => (match.arena_number || arenaNumber) === arenaNumber).slice(0, 4)
                      return (
                        <div className="queue-lane" key={`arena-${arenaNumber}`}>
                          <strong>Arena {arenaNumber}</strong>
                          {arenaMatches.length === 0 ? <span className="muted">{text.tournamentQueueEmpty}</span> : arenaMatches.map((match: any, index: number) => (
                            <div className={`queue-match ${match.status}`} key={`queue-${match.id}`}>
                              <span>{queueLabel(match.status, index)}</span>
                              <strong>{participantName(session, match.participant_a_id)} vs {participantName(session, match.participant_b_id)}</strong>
                              <small>{tournamentStageLabel(match.stage)} {match.match_number} · {bestOfLabel(match.best_of || session.best_of)}</small>
                              {canEditTournament && (
                                <div className="queue-controls">
                                  <button type="button" onClick={() => updateTournamentMatch(match, { arena_number: arenaNumber, status: 'next' })}>{text.next}</button>
                                  <button type="button" onClick={() => updateTournamentMatch(match, { arena_number: arenaNumber, status: 'live' })}>{text.live}</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {creatorCanAssignEditors && (
                  <div className="invite-code compact">
                    <span>{text.tournamentEditors}</span>
                    <input value={tournamentEditorEmail} onChange={(event) => setTournamentEditorEmail(event.target.value)} placeholder={text.editorSearchPlaceholder} />
                    <button disabled={busyTournamentId === session.id} type="button" onClick={() => addTournamentEditor(session)}>
                      {text.addEditor}
                    </button>
                    {tournamentEditorResults.length > 0 && (
                      <div className="editor-results">
                        {tournamentEditorResults.map((editorProfile: any) => (
                          <button key={editorProfile.id} onClick={() => addTournamentEditor(session, editorProfile)} type="button">
                            <span className="player-avatar tiny-avatar" style={avatarStyle(avatarFields(editorProfile))}>{avatarNode({
                              ...avatarFields(editorProfile),
                              display_name: displayName(editorProfile),
                            }, 'E')}</span>
                            <span>{compactDisplayName(displayName(editorProfile), text.player)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tournament.editors.length > 0 && (
                  <div className="players compact-roster">
                    {tournament.editors.map((editor: any) => (
                      <div className="player" key={editor.id}>
                        <span className="player-avatar" style={avatarStyle(editor)}>
                          {avatarNode(editor, 'E')}
                        </span>
                        <span>{compactDisplayName(editor.display_name, text.player)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {tournament.pools.length > 0 && (
                  <div className="tournament-grid">
                    {tournament.pools.map((pool: any) => (
                      <div className="tournament-panel" key={pool.id}>
                        <strong>{pool.name}</strong>
                        <div className="standings-table">
                          {poolStandingsForSession(session, pool).map((standing: any, index: number) => (
                            <div className="standing-row" key={standing.participantId} title={standing.tieBreakNote}>
                              <span>{index + 1}</span>
                              <strong>{standing.displayName}</strong>
                              <small>{standing.points} pts · {standing.wins}-{standing.losses} · Δ{standing.scoreDifference}</small>
                            </div>
                          ))}
                        </div>
                        <p className="field-help">{text.tournamentStandingsHint}</p>
                        <div className="players compact-roster">
                          {tournament.poolEntries.filter((entry: any) => entry.pool_id === pool.id).map((entry: any) => {
                            const entryParticipant = participantById(session, entry.participant_id)
                            return (
                              <div className="player tournament-entry" key={entry.id}>
                                <button aria-label={playerCardLabel(entryParticipant?.display_name, text.player)} className="player-avatar player-avatar-button" onClick={() => entryParticipant && openPlayerProfile(entryParticipant.profile_id, session.id)} style={avatarStyle(entryParticipant)} type="button">
                                  {avatarNode(entryParticipant, 'P')}
                                  {crownedTopPlayer?.profileId === entryParticipant?.profile_id && <span className="champion-badge">👑</span>}
                                </button>
                                <span>{participantName(session, entry.participant_id)}</span>
                                {entry.team_label && <small>{entry.team_label}</small>}
                                {canEditTournament && (
                                  <div className="entry-controls">
                                    <select value={entry.pool_id} onChange={(event) => updateTournamentPoolEntry(entry, { pool_id: event.target.value })} aria-label={text.pool}>
                                      {tournament.pools.map((optionPool: any) => (
                                        <option key={optionPool.id} value={optionPool.id}>{optionPool.name}</option>
                                      ))}
                                    </select>
                                    <input defaultValue={entry.team_label || ''} onBlur={(event) => updateTournamentPoolEntry(entry, { team_label: event.target.value.trim() || null })} placeholder={text.team} />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tournament.matches.length > 0 && (
                  <div className="match-list">
                    {tournament.matches.map((match: any) => (
                      (() => {
                        const playerA = participantById(session, match.participant_a_id)
                        const playerB = participantById(session, match.participant_b_id)
                        return (
                          <div className={match.status === 'completed' ? 'match-card completed' : 'match-card'} key={match.id}>
                            <div className="match-head">
                              <span>{tournamentStageLabel(match.stage)} {match.stage !== 'pool' ? match.match_number : `· R${match.round} M${match.match_number}`}</span>
                              <strong>{bestOfLabel(match.best_of || session.best_of)} · {match.status}</strong>
                            </div>
                            <div className="match-versus">
                              <button className={match.winner_participant_id === match.participant_a_id ? 'match-player winner' : 'match-player'} disabled={!canEditTournament || !match.participant_a_id} type="button" onClick={() => updateTournamentMatch(match, { winner_participant_id: match.participant_a_id })}>
                                <span className="player-avatar" style={avatarStyle(playerA)}>
                                  {avatarNode(playerA, 'P')}
                                  {crownedTopPlayer?.profileId === playerA?.profile_id && <span className="champion-badge">👑</span>}
                                </span>
                                <span>{participantName(session, match.participant_a_id)}</span>
                              </button>
                              <span className="versus">VS</span>
                              <button className={match.winner_participant_id === match.participant_b_id ? 'match-player winner' : 'match-player'} disabled={!canEditTournament || !match.participant_b_id} type="button" onClick={() => updateTournamentMatch(match, { winner_participant_id: match.participant_b_id })}>
                                <span className="player-avatar" style={avatarStyle(playerB)}>
                                  {avatarNode(playerB, 'P')}
                                  {crownedTopPlayer?.profileId === playerB?.profile_id && <span className="champion-badge">👑</span>}
                                </span>
                                <span>{participantName(session, match.participant_b_id)}</span>
                              </button>
                            </div>
                            {canEditTournament && (
                              <div className="score-row match-edit-row">
                                <select value={match.participant_a_id || ''} onChange={(event) => updateTournamentMatch(match, { participant_a_id: event.target.value || null })} aria-label={`${text.match} A`}>
                                  <option value="">{text.noMatch}</option>
                                  {participants.map((participant: any) => (
                                    <option key={participant.id} value={participant.id}>{compactDisplayName(participant.display_name, text.player)}</option>
                                  ))}
                                </select>
                                <select value={match.participant_b_id || ''} onChange={(event) => updateTournamentMatch(match, { participant_b_id: event.target.value || null })} aria-label={`${text.match} B`}>
                                  <option value="">{text.noMatch}</option>
                                  {participants.map((participant: any) => (
                                    <option key={participant.id} value={participant.id}>{compactDisplayName(participant.display_name, text.player)}</option>
                                  ))}
                                </select>
                                <input aria-label={text.scoreA} defaultValue={match.score_a ?? ''} inputMode="numeric" placeholder={text.scoreA} onBlur={(event) => updateTournamentMatch(match, { score_a: event.target.value === '' ? null : Number(event.target.value) })} />
                                <input aria-label={text.scoreB} defaultValue={match.score_b ?? ''} inputMode="numeric" placeholder={text.scoreB} onBlur={(event) => updateTournamentMatch(match, { score_b: event.target.value === '' ? null : Number(event.target.value) })} />
                                <input aria-label={text.winsA} defaultValue={match.wins_a ?? ''} inputMode="numeric" placeholder={text.winsA} onBlur={(event) => updateTournamentMatch(match, { wins_a: event.target.value === '' ? null : Number(event.target.value) })} />
                                <input aria-label={text.winsB} defaultValue={match.wins_b ?? ''} inputMode="numeric" placeholder={text.winsB} onBlur={(event) => updateTournamentMatch(match, { wins_b: event.target.value === '' ? null : Number(event.target.value) })} />
                                <select value={match.status} onChange={(event) => updateTournamentMatch(match, { status: event.target.value as MatchStatus })} aria-label={text.matchStatus}>
                                  <option value="waiting">{text.waiting}</option>
                                  <option value="next">{text.next}</option>
                                  <option value="live">{text.live}</option>
                                  <option value="completed">{text.completed}</option>
                                </select>
                                <select value={match.arena_number || ''} onChange={(event) => updateTournamentMatch(match, { arena_number: event.target.value ? Number(event.target.value) : null })} aria-label={text.arena}>
                                  <option value="">{text.arena}</option>
                                  <option value={1}>Arena 1</option>
                                  <option value={2}>Arena 2</option>
                                </select>
                              </div>
                            )}
                          </div>
                        )
                      })()
                    ))}
                  </div>
                )}

                {tournament.auditLogs.length > 0 && creatorCanAssignEditors && (
                  <details className="audit-log">
                    <summary>{text.auditLog}</summary>
                    {tournament.auditLogs.slice(0, 10).map((log: any) => (
                      <div className="audit-row" key={log.id}>
                        <strong>{log.action}</strong>
                        <span>
                          {formatShortDate(localDateString(new Date(log.created_at)), language)} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </details>
                )}
              </TournamentControlPanel>
            )
          })()}

          {!isTicket && !isChallenge && (
            <div className="game-strip">
              {session.game_options.map((gameId) => {
                const game = games.find((item) => item.id === gameId)
                if (!game) return null

                return (
                  <div className="game-card-shell strip-game-card-shell" key={gameId}>
                    <button
                      className={[
                        session.game_votes?.[userId] === gameId ? 'game-card selected' : 'game-card',
                        busyVoteKey === `${session.id}-${gameId}` ? 'loading' : '',
                      ].join(' ').trim()}
                      disabled={busyVoteKey === `${session.id}-${gameId}` || !canMutatePastSession}
                      onClick={() => voteForGame(session, gameId)}
                      type="button"
                    >
                      <NextImage src={game.image} alt="" width={240} height={240} />
                      <span>{game.title}</span>
                      <strong>{voteCount(session, gameId)} {voteCount(session, gameId) === 1 ? text.vote : text.votes}</strong>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {!isPast && !isChallenge && alreadyJoined && !isSessionOwner && canMutatePastSession && (
          <div className="join-row">
            <button
              className={busySessionId === session.id ? 'secondary loading' : 'secondary'}
              disabled={busySessionId === session.id}
              onClick={() => leaveSession(session)}
              type="button"
            >
              {text.leaveSession}
            </button>
          </div>
          )}
            </div>
          )}
        </article>
        {sessionRetentionCard && renderSessionRetentionCard(sessionRetentionCard)}
        </Fragment>
      )
    })}
</SessionsView>

  )
}
