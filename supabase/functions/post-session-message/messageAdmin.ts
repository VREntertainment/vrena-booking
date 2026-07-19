type MessageAdminInput = {
  isAnonymous: boolean
  staffRoleRank: unknown
}

export function hasMessageAdminPrivileges({ isAnonymous, staffRoleRank }: MessageAdminInput) {
  return !isAnonymous && typeof staffRoleRank === 'number' && Number.isFinite(staffRoleRank) && staffRoleRank >= 100
}
