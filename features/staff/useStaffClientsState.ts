'use client'

import { useState } from 'react'
import type { StaffAchievementAward } from '../../components/StaffAchievementAwardPanel'
import { defaultCustomerInviteForm } from '../../lib/staff/forms'
import type {
  CustomerInviteForm,
  CustomerTemporaryAccess,
  RoleSaveFeedback,
  SoftDeletedRecord,
  StaffProfile,
  StaffProfileDeleteDraft,
  StaffRole,
  StaffRoleSort
} from '../../lib/staff/types'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useStaffClientsState() {
  const [profiles, setProfiles] = useState<StaffProfile[]>([])
  const [achievementAwards, setAchievementAwards] = useState<StaffAchievementAward[]>([])
  const [deletedRecords, setDeletedRecords] = useState<SoftDeletedRecord[]>([])
  const [customerInviteForm, setCustomerInviteForm] = useState<CustomerInviteForm>(() => defaultCustomerInviteForm())
  const [customerInviteStatus, setCustomerInviteStatus] = useState('')
  const [customerTemporaryAccess, setCustomerTemporaryAccess] = useState<CustomerTemporaryAccess | null>(null)
  const [isCustomerInviteSaving, setIsCustomerInviteSaving] = useState(false)
  const [clientProfileDirty, setClientProfileDirty] = useState(false)
  const [roleSearch, setRoleSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all')
  const [roleSort, setRoleSort] = useState<StaffRoleSort>('name_asc')
  const [roleHelpOpen, setRoleHelpOpen] = useState(false)
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Record<string, StaffRole>>({})
  const [roleSaveFeedback, setRoleSaveFeedback] = useState<Record<string, RoleSaveFeedback>>({})
  const [profileDeleteDraft, setProfileDeleteDraft] = useState<StaffProfileDeleteDraft | null>(null)
  return {
    profiles,
    setProfiles,
    achievementAwards,
    setAchievementAwards,
    deletedRecords,
    setDeletedRecords,
    customerInviteForm,
    setCustomerInviteForm,
    customerInviteStatus,
    setCustomerInviteStatus,
    customerTemporaryAccess,
    setCustomerTemporaryAccess,
    isCustomerInviteSaving,
    setIsCustomerInviteSaving,
    clientProfileDirty,
    setClientProfileDirty,
    roleSearch,
    setRoleSearch,
    roleFilter,
    setRoleFilter,
    roleSort,
    setRoleSort,
    roleHelpOpen,
    setRoleHelpOpen,
    pendingRoleChanges,
    setPendingRoleChanges,
    roleSaveFeedback,
    setRoleSaveFeedback,
    profileDeleteDraft,
    setProfileDeleteDraft,
  }
}
