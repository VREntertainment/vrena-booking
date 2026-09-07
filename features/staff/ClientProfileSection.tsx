'use client'

import { PhoneNumberInput } from '../../components/CountryCodePicker'
import StaffPlayerAchievementProfile from '../../components/StaffPlayerAchievementProfile'
import { uiText } from '../../lib/i18n/translations'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import type {
  StaffConsoleLanguage
} from '../../lib/staff/types'

export type ClientProfileSectionProps = {
  canCreateCustomerAccounts: boolean
  text: StaffConsoleCopy
  customerInviteForm: import("../../lib/staff/types").CustomerInviteForm
  setCustomerInviteForm: React.Dispatch<React.SetStateAction<import("../../lib/staff/types").CustomerInviteForm>>
  sharedText: (typeof uiText)[StaffConsoleLanguage]
  isCustomerInviteSaving: boolean
  createCustomerAccount: () => Promise<void>
  customerInviteStatus: string
  customerTemporaryAccess: import("../../lib/staff/types").CustomerTemporaryAccess | null
  resolvedLanguage: import("../../lib/staff/types").StaffConsoleLanguage
  setCustomerInviteStatus: React.Dispatch<React.SetStateAction<string>>
  canAwardAchievements: boolean
  achievementAwards: import("../../components/StaffAchievementAwardPanel").StaffAchievementAward[]
  setClientProfileDirty: React.Dispatch<React.SetStateAction<boolean>>
  markStaffDataStale: (...keys: import("../../lib/staff/types").StaffDataKey[]) => void
  loadAchievementAwards: (force?: boolean) => Promise<void>
  awardableProfiles: import("../../lib/staff/types").StaffProfile[]
  loadingData: Partial<Record<import("../../lib/staff/types").StaffDataKey, boolean>>
}

export default function ClientProfileSection({
  canCreateCustomerAccounts,
  text,
  customerInviteForm,
  setCustomerInviteForm,
  sharedText,
  isCustomerInviteSaving,
  createCustomerAccount,
  customerInviteStatus,
  customerTemporaryAccess,
  resolvedLanguage,
  setCustomerInviteStatus,
  canAwardAchievements,
  achievementAwards,
  setClientProfileDirty,
  markStaffDataStale,
  loadAchievementAwards,
  awardableProfiles,
  loadingData,
}: ClientProfileSectionProps) {
  return (
    <div className="staff-client-profile-page">
      {canCreateCustomerAccounts && (
        <div className="staff-card staff-card-wide staff-customer-invite-panel">
          <div className="staff-customer-invite-copy">
            <strong>{text.labels.createCustomerAccount}</strong>
            <span>{text.labels.customerAccountHelp}</span>
          </div>
          <div className="staff-customer-invite-form">
            <label>
              <span className="staff-field-label">{text.labels.name}</span>
              <input
                autoComplete="name"
                value={customerInviteForm.fullName}
                onChange={(event) => setCustomerInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="Nguyen Van A"
              />
            </label>
            <label>
              <span className="staff-field-label">{text.labels.email} ({text.labels.optional})</span>
              <input
                autoComplete="email"
                type="email"
                value={customerInviteForm.email}
                onChange={(event) => setCustomerInviteForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="customer@example.com"
              />
            </label>
            <label>
              <span className="staff-field-label">
                {text.labels.phone}{!customerInviteForm.email.trim() ? ' *' : ` (${text.labels.optional})`}
              </span>
              <PhoneNumberInput
                buttonLabel={sharedText.countryCode}
                className="staff-phone-control"
                inputLabel={text.labels.phone}
                onChange={(phone) => setCustomerInviteForm((current) => ({ ...current, phone }))}
                searchPlaceholder={sharedText.searchCountry}
                value={customerInviteForm.phone}
              />
            </label>
            <label>
              <span className="staff-field-label">{text.labels.nickname} *</span>
              <input
                value={customerInviteForm.nickname}
                onChange={(event) => setCustomerInviteForm((current) => ({ ...current, nickname: event.target.value }))}
                placeholder="Phantom"
              />
            </label>
            {!customerInviteForm.email.trim() && (
              <div className="staff-customer-phone-account-setup">
                <p>{text.labels.customerAccountPhonePasswordHelp}</p>
              </div>
            )}
            <button
              className={isCustomerInviteSaving ? 'primary loading' : 'primary'}
              disabled={isCustomerInviteSaving}
              type="button"
              onClick={createCustomerAccount}
            >
              {customerInviteForm.email.trim()
                ? text.actions.sendPasswordRequest
                : text.actions.createPhoneAccount}
            </button>
          </div>
          {customerInviteStatus && <p className="notice compact-notice">{customerInviteStatus}</p>}
          {customerTemporaryAccess && (
            <div className="staff-customer-temporary-access" role="status">
              <span>{text.labels.customerTemporaryPassword}</span>
              <strong>{customerTemporaryAccess.password}</strong>
              <small>{customerTemporaryAccess.phone} · {new Date(customerTemporaryAccess.expiresAt).toLocaleString(resolvedLanguage)}</small>
              <p>{text.labels.customerTemporaryPasswordHelp}</p>
              <button
                className="secondary small-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(customerTemporaryAccess.password)
                    setCustomerInviteStatus(text.messages.customerTemporaryPasswordCopied)
                  } catch {
                    setCustomerInviteStatus(customerTemporaryAccess.password)
                  }
                }}
                type="button"
              >
                {text.actions.copyTemporaryPassword}
              </button>
            </div>
          )}
        </div>
      )}
      {canAwardAchievements && (
        <div className="staff-card staff-card-wide">
          <StaffPlayerAchievementProfile
            awards={achievementAwards}
            language={resolvedLanguage}
            onDirtyChange={setClientProfileDirty}
            onRefreshAwards={async () => {
              markStaffDataStale('achievementAwards')
              await loadAchievementAwards(true)
            }}
            profiles={awardableProfiles}
            profilesLoading={Boolean(loadingData.profiles)}
            text={sharedText}
          />
        </div>
      )}
    </div>
  )
}
