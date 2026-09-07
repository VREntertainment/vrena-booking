'use client'

import type { StaffAchievementAward } from '../../components/StaffAchievementAwardPanel'
import { normalizePhonePasswordIdentifier } from '../../lib/phonePasswordAccount'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import { rpcFunctionMissing } from '../../lib/staff/errors'
import { defaultCustomerInviteForm } from '../../lib/staff/forms'
import {
  staffProfileAvatarSelect,
  staffProfileSelect
} from '../../lib/staff/options'
import {
  isDemoProfile,
  staffRoleName,
  storedRoleValue
} from '../../lib/staff/profiles'
import type {
  SoftDeletedRecord,
  StaffAuditLog,
  StaffProfile,
  StaffRole
} from '../../lib/staff/types'
import { staffConsoleRoleRank as staffRank } from '../../lib/staffRoles'
import { getStaffKioskOperatorToken, STAFF_KIOSK_HEADER, supabase } from '../../lib/supabase/client'

export type ClientsActionContext = {
  runStaffLoader: (key: import("../../lib/staff/types").StaffDataKey, loader: () => Promise<void>, force?: boolean) => Promise<void>
  roleSort: import("../../lib/staff/types").StaffRoleSort
  setProfiles: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffProfile[]>>
  setPendingRoleChanges: React.Dispatch<React.SetStateAction<Record<string, import("../../lib/staff/types").StaffRole>>>
  canAwardAchievements: boolean
  setAchievementAwards: React.Dispatch<React.SetStateAction<import("../../components/StaffAchievementAwardPanel").StaffAchievementAward[]>>
  canRestoreDeleted: boolean
  setDeletedRecords: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").SoftDeletedRecord[]>>
  canCreateCustomerAccounts: boolean
  isCustomerInviteSaving: boolean
  customerInviteForm: import("../../lib/staff/types").CustomerInviteForm
  setCustomerInviteStatus: React.Dispatch<React.SetStateAction<string>>
  text: StaffConsoleCopy
  setIsCustomerInviteSaving: React.Dispatch<React.SetStateAction<boolean>>
  setCustomerTemporaryAccess: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").CustomerTemporaryAccess | null>>
  setCustomerInviteForm: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").CustomerInviteForm>>
  setStatus: React.Dispatch<React.SetStateAction<string>>
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  canManageRoles: boolean
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  setRoleSaveFeedback: React.Dispatch<React.SetStateAction<Record<string, import("../../lib/staff/types").RoleSaveFeedback>>>
  profile: import("../../lib/staff/types").StaffProfile | null
  setProfileDeleteDraft: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffProfileDeleteDraft | null>>
  profileDeleteDraft: import("../../lib/staff/types").StaffProfileDeleteDraft | null
  currentTab: import("../../lib/staff/types").StaffTab
}

/** Reads the calling render at action entry; requests and authorization retain their original snapshot. */
export function createStaffClientsActions(getContext: () => ClientsActionContext) {
  async function loadProfiles(force = false) {
    const { runStaffLoader, roleSort, setProfiles, setPendingRoleChanges } = getContext()

    await runStaffLoader('profiles', async () => {
      async function hydrateProfileAvatars(rows: StaffProfile[]) {
        const profileIds = rows.map((item) => item.id).filter(Boolean)
        if (profileIds.length === 0) return rows

        const { data } = await supabase
          .from('profiles')
          .select(staffProfileAvatarSelect)
          .in('id', profileIds)

        const avatarById = new Map((data ?? []).map((item) => [item.id, item as StaffProfile]))
        return rows.map((item) => ({
          ...item,
          ...(avatarById.get(item.id) ?? {}),
        }))
      }

      const rpcResult = await supabase.rpc('profile_search', {
        p_search: null,
        p_limit: 500,
        p_offset: 0,
        p_role: 'all',
        p_include_demo: false,
        p_sort: roleSort,
      })

      if (!rpcResult.error && rpcResult.data) {
        const rows = (rpcResult.data as StaffProfile[]).filter((item) => !isDemoProfile(item))
        setProfiles(await hydrateProfileAvatars(rows))
        setPendingRoleChanges({})
        return
      }

      if (rpcResult.error && !rpcFunctionMissing(rpcResult.error)) {
        throw new Error(rpcResult.error.message)
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(staffProfileSelect)
        .is('deleted_at', null)
        .order('full_name', { ascending: true })
        .limit(500)
      if (error) throw new Error(error.message)
      setProfiles(((data ?? []) as StaffProfile[]).filter((item) => !isDemoProfile(item)))
      setPendingRoleChanges({})
    }, force)
  }

  async function loadAchievementAwards(force = false) {
    const { runStaffLoader, canAwardAchievements, setAchievementAwards } = getContext()

    await runStaffLoader('achievementAwards', async () => {
      if (!canAwardAchievements) {
        setAchievementAwards([])
        return
      }
      const { data, error } = await supabase
        .from('profile_achievement_awards')
        .select('id, profile_id, achievement_id, achievement_kind, title, description, note, awarded_at')
        .is('revoked_at', null)
        .order('awarded_at', { ascending: false })
        .limit(500)
      if (error) throw new Error(error.message)
      setAchievementAwards((data ?? []) as StaffAchievementAward[])
    }, force)
  }

  async function fetchAuditLogs(limit = 60) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_user_id, action, entity_type, entity_id, old_value, new_value, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []) as StaffAuditLog[]
  }

  async function loadDeletedRecords(force = false) {
    const { runStaffLoader, canRestoreDeleted, setDeletedRecords } = getContext()

    await runStaffLoader('restore', async () => {
      if (!canRestoreDeleted) {
        setDeletedRecords([])
        return
      }
      const actorResult = await supabase.rpc('get_soft_deleted_records_v2', { p_limit: 100 })
      if (!actorResult.error) {
        setDeletedRecords((actorResult.data ?? []) as SoftDeletedRecord[])
        return
      }
      if (!rpcFunctionMissing(actorResult.error)) throw new Error(actorResult.error.message)

      const fallbackResult = await supabase.rpc('get_soft_deleted_records', { p_limit: 100 })
      if (fallbackResult.error) throw new Error(fallbackResult.error.message)
      setDeletedRecords((fallbackResult.data ?? []) as SoftDeletedRecord[])
    }, force)
  }

  async function createCustomerAccount() {
    const {
      canCreateCustomerAccounts,
      isCustomerInviteSaving,
      customerInviteForm,
      setCustomerInviteStatus,
      text,
      setIsCustomerInviteSaving,
      setCustomerTemporaryAccess,
      setCustomerInviteForm,
      setStatus,
      markStaffDataStale,
    } = getContext()

    if (!canCreateCustomerAccounts || isCustomerInviteSaving) return

    const fullName = customerInviteForm.fullName.trim()
    const email = customerInviteForm.email.trim()
    const nickname = customerInviteForm.nickname.trim()
    const phone = normalizePhonePasswordIdentifier(customerInviteForm.phone)
    const phoneAccount = !email
    if (!fullName) {
      setCustomerInviteStatus(text.messages.customerAccountNameRequired)
      return
    }
    if (phoneAccount && !phone) {
      setCustomerInviteStatus(text.messages.customerAccountPhoneRequired)
      return
    }
    if (!nickname) {
      setCustomerInviteStatus(text.messages.customerAccountNicknameRequired)
      return
    }
    setIsCustomerInviteSaving(true)
    setCustomerInviteStatus('')
    setCustomerTemporaryAccess(null)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (sessionError || !accessToken) {
      setCustomerInviteStatus(sessionError?.message || text.messages.readOnlyBooking)
      setIsCustomerInviteSaving(false)
      return
    }

    try {
      const response = await fetch('/api/staff/customers/invite', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          ...(getStaffKioskOperatorToken() ? { [STAFF_KIOSK_HEADER]: getStaffKioskOperatorToken() } : {}),
        },
        body: JSON.stringify({
          fullName,
          email: email || null,
          phone: phone || customerInviteForm.phone.trim(),
          nickname,
        }),
      })
      const payload = await response.json().catch(() => ({})) as {
        error?: string
        message?: string
        temporaryPassword?: string | null
        temporaryPasswordExpiresAt?: string | null
      }
      if (!response.ok) {
        const message = response.status === 409 && /nickname/i.test(payload.error || '')
          ? text.messages.customerAccountNicknameTaken
          : payload.error || 'Could not create customer account.'
        throw new Error(message)
      }

      if (phoneAccount && payload.temporaryPassword && payload.temporaryPasswordExpiresAt) {
        setCustomerTemporaryAccess({
          expiresAt: payload.temporaryPasswordExpiresAt,
          password: payload.temporaryPassword,
          phone,
        })
      }

      setCustomerInviteForm(defaultCustomerInviteForm())
      const successMessage = phoneAccount
        ? text.messages.customerAccountPhoneCreated
        : text.messages.customerAccountInvited
      setCustomerInviteStatus(successMessage)
      setStatus(successMessage)
      markStaffDataStale('profiles')
      await loadProfiles(true)
    } catch (error) {
      setCustomerInviteStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setIsCustomerInviteSaving(false)
    }
  }

  async function updateProfileRole(profileId: string, nextRole: StaffRole) {
    const { canManageRoles, setSaving, setStatus, text, setRoleSaveFeedback, setProfiles, setPendingRoleChanges, markStaffDataStale } = getContext()

    if (!canManageRoles) return
    setSaving(true)
    setStatus(text.messages.roleUpdating)
    setRoleSaveFeedback((current) => ({
      ...current,
      [profileId]: { tone: 'saving', message: text.messages.roleUpdating },
    }))

    const { data, error } = await supabase.rpc('set_staff_profile_role', {
      p_profile_id: profileId,
      p_role: nextRole,
    })

    const savedRole = storedRoleValue((data as { role?: string | null } | null)?.role || '')
    const saveError = error?.message || ''

    if (saveError) {
      const message = saveError || text.messages.roleSaveFailed
      setStatus(message)
      setRoleSaveFeedback((current) => ({
        ...current,
        [profileId]: { tone: 'error', message },
      }))
    } else if (savedRole !== nextRole) {
      const message = `${text.messages.roleSaveMismatch} ${text.labels.current} ${staffRoleName(savedRole, text)}.`
      setStatus(message)
      setRoleSaveFeedback((current) => ({
        ...current,
        [profileId]: { tone: 'error', message },
      }))
    } else {
      const message = `${text.messages.roleUpdated} ${staffRoleName(savedRole, text)}.`
      setProfiles((items) => items.map((item) => item.id === profileId ? { ...item, role: savedRole } : item))
      setPendingRoleChanges((current) => {
        const next = { ...current }
        delete next[profileId]
        return next
      })
      markStaffDataStale('profiles')
      setStatus(message)
      setRoleSaveFeedback((current) => ({
        ...current,
        [profileId]: { tone: 'success', message },
      }))
    }
    setSaving(false)
  }

  function stageProfileRole(profileId: string, storedRole: StaffRole, nextRole: StaffRole) {
    const { setPendingRoleChanges } = getContext()

    setPendingRoleChanges((current) => {
      const next = { ...current }
      if (nextRole === storedRole) delete next[profileId]
      else next[profileId] = nextRole
      return next
    })
  }

  function clearStagedProfileRole(profileId: string) {
    const { setPendingRoleChanges } = getContext()

    setPendingRoleChanges((current) => {
      const next = { ...current }
      delete next[profileId]
      return next
    })
  }

  function canDeleteProfileAccount(item: StaffProfile) {
    const { canManageRoles, profile, canRestoreDeleted } = getContext()

    if (!canManageRoles) return false
    if (item.id === profile?.id) return false
    const targetRank = staffRank(item.role, item.email)
    return targetRank < 120 || canRestoreDeleted
  }

  function openProfileDeleteDialog(item: StaffProfile) {
    const { setProfileDeleteDraft } = getContext()

    if (!canDeleteProfileAccount(item)) return
    setProfileDeleteDraft({ profile: item, ban: false, reason: '', confirmation: '' })
  }

  async function deleteProfileAccount() {
    const { profileDeleteDraft, setSaving, setStatus, text, setProfileDeleteDraft, setProfiles, markStaffDataStale, currentTab } = getContext()

    if (!profileDeleteDraft || !canDeleteProfileAccount(profileDeleteDraft.profile)) return
    if (profileDeleteDraft.confirmation !== 'DELETE') return

    setSaving(true)
    setStatus(text.messages.accountDeleting)
    const reason = profileDeleteDraft.reason.trim()
    const { error } = await supabase.rpc('staff_delete_profile_account', {
      p_profile_id: profileDeleteDraft.profile.id,
      p_delete_reason: reason || null,
      p_ban: profileDeleteDraft.ban,
      p_ban_reason: profileDeleteDraft.ban ? reason || null : null,
      p_confirmation: profileDeleteDraft.confirmation,
    })

    if (error) {
      setStatus(error.message)
    } else {
      setStatus(text.messages.accountDeleted)
      setProfileDeleteDraft(null)
      setProfiles((items) => items.filter((item) => item.id !== profileDeleteDraft.profile.id))
      markStaffDataStale('profiles', 'restore')
      if (currentTab === 'restore') await loadDeletedRecords(true)
    }
    setSaving(false)
  }

  async function restoreDeletedRecord(record: SoftDeletedRecord) {
    const { canRestoreDeleted, setSaving, setStatus, text, markStaffDataStale } = getContext()

    if (!canRestoreDeleted) return
    setSaving(true)
    setStatus(text.messages.restoringRecord)
    const { error } = await supabase.rpc('restore_soft_deleted_record', {
      p_entity_table: record.entity_table,
      p_entity_id: record.entity_id,
    })
    setStatus(error ? error.message : text.messages.recordRestored)
    if (!error) {
      markStaffDataStale('restore', 'profiles')
      await Promise.all([loadDeletedRecords(true), loadProfiles(true)])
    }
    setSaving(false)
  }

  return {
    loadProfiles,
    loadAchievementAwards,
    fetchAuditLogs,
    loadDeletedRecords,
    createCustomerAccount,
    updateProfileRole,
    stageProfileRole,
    clearStagedProfileRole,
    canDeleteProfileAccount,
    openProfileDeleteDialog,
    deleteProfileAccount,
    restoreDeletedRecord,
  }
}
