import { hasMessageAdminPrivileges } from './messageAdmin.ts'

type ActiveRecord = { deleted_at: string | null }
type MessageAuthorizationInput = {
  userId: string
  isAnonymous: boolean
  messageType: unknown
  profile: ActiveRecord | null
  session: (ActiveRecord & { owner_id: string | null }) | null
  participant: ActiveRecord | null
  staffRoleRank: unknown
  readFailed: boolean
}

export function authorizeSessionMessage(input: MessageAuthorizationInput) {
  const denied = { allowed: false, trustedAuthor: false }
  if (input.readFailed || input.isAnonymous || !input.userId
    || !input.profile || input.profile.deleted_at !== null
    || !input.session || input.session.deleted_at !== null
    || (input.messageType !== 'announcement' && input.messageType !== 'comment')) return denied

  const trustedAuthor = input.session.owner_id === input.userId || hasMessageAdminPrivileges(input)
  const activeParticipant = Boolean(input.participant && input.participant.deleted_at === null)
  return {
    allowed: trustedAuthor || (input.messageType === 'comment' && activeParticipant),
    trustedAuthor,
  }
}
