'use client'

import {
  Info,
  Save,
  Trash2,
  X
} from 'lucide-react'
import { StaffRoleAvatar } from '../../components/staff/StaffRoleAvatar'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  assignableWebAppRoleOptions,
  roleFilterOptions,
  roleSortOptions
} from '../../lib/staff/options'
import {
  customerName,
  roleLabel,
  staffRoleName,
  staffRoleSortName,
  storedRoleValue
} from '../../lib/staff/profiles'
import type {
  StaffRole,
  StaffRoleSort
} from '../../lib/staff/types'
import { requiresStaffKioskPin } from '../../lib/staffKioskScope'
import { isStaffAdminEmail as isAdminEmail } from '../../lib/staffRoles'
import { ButtonIconText } from './shared'

export type RolesSectionProps = {
  text: StaffConsoleCopy
  setRoleHelpOpen: React.Dispatch<React.SetStateAction<boolean>>
  roleSearch: string
  setRoleSearch: React.Dispatch<React.SetStateAction<string>>
  roleFilter: "all" | import("../../lib/staff/types").StaffRole
  setRoleFilter: React.Dispatch<React.SetStateAction<"all" | import("../../lib/staff/types").StaffRole>>
  roleSort: import("../../lib/staff/types").StaffRoleSort
  setRoleSort: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").StaffRoleSort>>
  filteredRoleProfiles: import("../../lib/staff/types").StaffProfile[]
  pendingRoleChanges: Record<string, import("../../lib/staff/types").StaffRole>
  roleSaveFeedback: Record<string, import("../../lib/staff/types").RoleSaveFeedback>
  canOpenRoleProfiles: boolean
  onOpenPlayerProfile: ((profile: import("../../lib/staff/types").StaffProfile) => void) | undefined
  canManageRoles: boolean
  saving: boolean
  stageProfileRole: (profileId: string, storedRole: import("../../lib/staff/types").StaffRole, nextRole: import("../../lib/staff/types").StaffRole) => void
  canRestoreDeleted: boolean
  canDeleteProfileAccount: (item: import("../../lib/staff/types").StaffProfile) => boolean
  openProfileDeleteDialog: (item: import("../../lib/staff/types").StaffProfile) => void
  updateProfileRole: (profileId: string, nextRole: import("../../lib/staff/types").StaffRole) => Promise<void>
  clearStagedProfileRole: (profileId: string) => void
}

export default function RolesSection({
  text,
  setRoleHelpOpen,
  roleSearch,
  setRoleSearch,
  roleFilter,
  setRoleFilter,
  roleSort,
  setRoleSort,
  filteredRoleProfiles,
  pendingRoleChanges,
  roleSaveFeedback,
  canOpenRoleProfiles,
  onOpenPlayerProfile,
  canManageRoles,
  saving,
  stageProfileRole,
  canRestoreDeleted,
  canDeleteProfileAccount,
  openProfileDeleteDialog,
  updateProfileRole,
  clearStagedProfileRole,
}: RolesSectionProps) {
  return (
    <div className="staff-card staff-card-wide">
      <div className="staff-card-heading">
        <h3>{text.labels.roles}</h3>
        <button className="staff-link-button" type="button" onClick={() => setRoleHelpOpen(true)}>
          <ButtonIconText icon={<Info aria-hidden="true" size={14} />}>{text.labels.roleExplanation}</ButtonIconText>
        </button>
      </div>
      <div className="staff-role-tools">
        <label>
          <span className="staff-field-label">{text.labels.searchUsers}</span>
          <input
            value={roleSearch}
            onChange={(event) => setRoleSearch(event.target.value)}
            placeholder={`${text.labels.name}, ${text.labels.email}, ${text.labels.phone}`}
          />
        </label>
        <label>
          <span className="staff-field-label">{text.labels.filterByRole}</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as StaffRole | 'all')}>
            {roleFilterOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? text.allRoles : staffRoleName(option, text)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="staff-field-label">{text.labels.sortBy}</span>
          <select value={roleSort} onChange={(event) => setRoleSort(event.target.value as StaffRoleSort)}>
            {roleSortOptions.map((option) => (
              <option key={option} value={option}>
                {staffRoleSortName(option, text)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="staff-role-list">
        {filteredRoleProfiles.map((item) => {
          const effectiveRole = roleLabel(item.role, item.email)
          const storedRole = storedRoleValue(item.role, item.email)
          const selectedRole = pendingRoleChanges[item.id] || storedRole
          const hasPendingRoleChange = selectedRole !== storedRole
          const protectedEmail = isAdminEmail(item.email)
          const sharedKioskAccount = requiresStaffKioskPin(item.email)
          const rowFeedback = roleSaveFeedback[item.id]
          const rolePersonContent = (
            <>
              <StaffRoleAvatar profile={item} text={text} />
              <span className="staff-role-person-text">
                <strong>{customerName(item, text)}</strong>
                <span>{item.email || item.phone || text.noContact} · {text.labels.current} {staffRoleName(effectiveRole, text)}</span>
                {protectedEmail && <small>{text.emailOverrideKeepsAdmin}</small>}
                {sharedKioskAccount && <small>{text.sharedKioskRoleProtected}</small>}
              </span>
            </>
          )
          return (
            <div className="staff-role-row" key={item.id}>
              {canOpenRoleProfiles ? (
                <button
                  aria-label={`Open ${customerName(item, text)} player card`}
                  className="staff-role-person"
                  type="button"
                  onClick={() => onOpenPlayerProfile?.(item)}
                >
                  {rolePersonContent}
                </button>
              ) : (
                <div className="staff-role-person">
                  {rolePersonContent}
                </div>
              )}
              <div className="staff-role-action-cell">
                <div className="staff-role-primary-actions">
                  <select
                    aria-label={`${text.labels.roleFor} ${customerName(item, text)}`}
                    disabled={!canManageRoles || saving || sharedKioskAccount}
                    value={selectedRole}
                    onChange={(event) => stageProfileRole(item.id, storedRole, event.target.value as StaffRole)}
                  >
                    {([
                      ...(storedRole === 'employee' ? ['employee' as StaffRole] : []),
                      ...assignableWebAppRoleOptions,
                    ]).filter((option) => (
                      canRestoreDeleted || option !== 'owner' || option === storedRole
                    )).map((option) => (
                      <option disabled={option === 'employee'} key={option} value={option}>{staffRoleName(option, text)}</option>
                    ))}
                  </select>
                  {canDeleteProfileAccount(item) && (
                    <button
                      className="danger small-button staff-role-delete-button"
                      disabled={saving}
                      type="button"
                      onClick={() => openProfileDeleteDialog(item)}
                    >
                      <ButtonIconText icon={<Trash2 aria-hidden="true" size={14} />}>{text.actions.deleteAccount}</ButtonIconText>
                    </button>
                  )}
                </div>
                {hasPendingRoleChange && (
                  <div className="staff-role-actions">
                    <button
                      className="primary"
                      disabled={!canManageRoles || saving}
                      type="button"
                      onClick={() => updateProfileRole(item.id, selectedRole)}
                    >
                      <ButtonIconText icon={<Save aria-hidden="true" size={14} />}>{text.actions.saveRole}</ButtonIconText>
                    </button>
                    <button
                      className="secondary"
                      disabled={saving}
                      type="button"
                      onClick={() => clearStagedProfileRole(item.id)}
                    >
                      <ButtonIconText icon={<X aria-hidden="true" size={14} />}>{text.actions.cancel}</ButtonIconText>
                    </button>
                  </div>
                )}
                {rowFeedback && (
                  <small className={`staff-role-feedback ${rowFeedback.tone}`}>
                    {rowFeedback.message}
                  </small>
                )}
              </div>
            </div>
          )
        })}
        {filteredRoleProfiles.length === 0 && <p className="notice">{text.noUsersFound}</p>}
      </div>
    </div>
  )
}
