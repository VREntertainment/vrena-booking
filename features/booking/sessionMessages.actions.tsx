'use client'

import { ageBandFromBirthday } from '../../lib/agePolicy'
import { getSupabase } from '../../lib/booking/client'
import {
  SESSION_MESSAGE_SELECT
} from '../../lib/bookingStaticData'
import {
  Session,
  SessionMessage,
  SessionMessagePageState
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
import { SESSION_MESSAGE_PAGE_SIZE } from './shared'

export type SessionMessagesActionContext = {
  userId: string
  isAdmin: boolean
  setSessionMessages: React.Dispatch<React.SetStateAction<import("../../lib/bookingWidgetDomain").SessionMessage[]>>
  sessionMessagesLoadedRef: React.RefObject<Set<string>>
  sessionMessagesLoadingRef: React.RefObject<Set<string>>
  setSessionMessagePages: React.Dispatch<React.SetStateAction<Record<string, import("../../lib/bookingWidgetDomain").SessionMessagePageState>>>
  sessionMessages: import("../../lib/bookingWidgetDomain").SessionMessage[]
  setCreateStatus: React.Dispatch<React.SetStateAction<string>>
  requireProfile: () => boolean
  profile: import("../../lib/bookingWidgetDomain").Profile | null
  text: TranslationMap
  announcementDrafts: Record<string, string>
  commentDrafts: Record<string, string>
  setBusyMessageKey: React.Dispatch<React.SetStateAction<string>>
  setAnnouncementDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setCommentDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  softDeleteRecord: (entityTable: string, entityId: string, reason: string) => Promise<import("@supabase/postgrest-js").PostgrestSingleResponse<unknown>>
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createBookingSessionMessagesActions(getContext: () => SessionMessagesActionContext) {
  function canReviewSessionMessages(session: Session) {
    const { userId, isAdmin } = getContext()

    return Boolean(userId && (session.owner_id === userId || isAdmin))
  }

  function canSeeSessionMessage(session: Session, message: SessionMessage) {
    const { userId } = getContext()

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
    const { setSessionMessages } = getContext()

    setSessionMessages((current) => sortSessionMessages([
      ...current.filter((item) => item.id !== message.id),
      message,
    ]))
  }

  function resetSessionMessageState() {
    return clearSessionMessageState(getContext())
  }

  function updateSessionMessagePage(sessionId: string, patch: Partial<SessionMessagePageState>) {
    const { setSessionMessagePages } = getContext()

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
    const { sessionMessages } = getContext()

    return sortSessionMessages(sessionMessages
      .filter((message) => message.session_id === session.id && canSeeSessionMessage(session, message))
    )
  }

  async function loadSessionMessages(
    sessionId: string,
    options: { force?: boolean; before?: string | null } = {}
  ) {
    const { userId, sessionMessagesLoadedRef, sessionMessagesLoadingRef, setCreateStatus, setSessionMessages } = getContext()

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

  async function postSessionMessage(session: Session, messageType: 'announcement' | 'comment') {
    const {
      requireProfile,
      profile,
      setCreateStatus,
      text,
      announcementDrafts,
      commentDrafts,
      setBusyMessageKey,
      setAnnouncementDrafts,
      setCommentDrafts,
    } = getContext()

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

  async function reviewSessionMessage(message: SessionMessage, status: 'approved' | 'rejected') {
    const { requireProfile, setBusyMessageKey, userId, setCreateStatus, text, setSessionMessages } = getContext()

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
    const { requireProfile, isAdmin, setCreateStatus, text, setBusyMessageKey, softDeleteRecord, setSessionMessages } = getContext()

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

  return {
    canReviewSessionMessages,
    canSeeSessionMessage,
    sortSessionMessages,
    mergeSessionMessage,
    resetSessionMessageState,
    updateSessionMessagePage,
    messagesForSession,
    loadSessionMessages,
    postSessionMessage,
    reviewSessionMessage,
    deleteSessionMessage,
  }
}

export function clearSessionMessageState(context: Pick<SessionMessagesActionContext, 'sessionMessagesLoadedRef' | 'sessionMessagesLoadingRef' | 'setSessionMessages' | 'setSessionMessagePages'>) {
  const { sessionMessagesLoadedRef, sessionMessagesLoadingRef, setSessionMessages, setSessionMessagePages } = context

  sessionMessagesLoadedRef.current.clear()
  sessionMessagesLoadingRef.current.clear()
  setSessionMessages([])
  setSessionMessagePages({})
}
