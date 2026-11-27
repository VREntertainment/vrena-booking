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
  loadProfiles: (force?: boolean) => Promise<void>
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
  loadProfiles,
  loadAchievementAwards,
  awardableProfiles,
  loadingData,
}: ClientProfileSectionProps) {
  const messages = text.messages
  const nameError = customerInviteStatus === messages.customerAccountNameRequired && !customerInviteForm.fullName.trim()
  const phoneError = customerInviteStatus === messages.customerAccountPhoneRequired && !customerInviteForm.email.trim()
  const nicknameError = (customerInviteStatus === messages.customerAccountNicknameRequired && !customerInviteForm.nickname.trim())
    || customerInviteStatus === messages.customerAccountNicknameTaken
  const isFieldFeedback = [messages.customerAccountNameRequired, messages.customerAccountPhoneRequired,
    messages.customerAccountNicknameRequired, messages.customerAccountNicknameTaken].some((message) => message === customerInviteStatus)
  const confirmed = [messages.customerAccountInvited, messages.customerAccountPhoneCreated,
    messages.customerTemporaryPasswordCopied, customerTemporaryAccess?.password].some((message) => message === customerInviteStatus)
  const clearFeedback = (...feedback: string[]) => {
    setCustomerInviteStatus((current) => feedback.includes(current) ? '' : current)
  }

  return (
    <div className="staff-client-profile-page">
      {canCreateCustomerAccounts && (
        <section className="staff-card staff-card-wide staff-customer-invite-panel" aria-labelledby="staff-invite-title">
          <header className="staff-customer-invite-copy">
            <h3 id="staff-invite-title">{text.labels.createCustomerAccount}</h3>
            <p>{text.labels.customerAccountHelp}</p>
          </header>
          <div className="staff-customer-invite-form">
            <label>
              <span className="staff-field-label">{text.labels.name} *</span>
              <input
                autoComplete="name"
                aria-required="true"
                aria-invalid={nameError || undefined}
                aria-describedby={nameError ? 'staff-invite-name-error' : undefined}
                value={customerInviteForm.fullName}
                onChange={(event) => setCustomerInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="Nguyen Van A"
              />
              {nameError && <span id="staff-invite-name-error" className="staff-client-field-error" role="alert">{customerInviteStatus}</span>}
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
                required={!customerInviteForm.email.trim()}
                invalid={phoneError || undefined}
                describedBy={phoneError ? 'staff-invite-phone-error' : undefined}
                onChange={(phone) => {
                  clearFeedback(messages.customerAccountPhoneRequired)
                  setCustomerInviteForm((current) => ({ ...current, phone }))
                }}
                searchPlaceholder={sharedText.searchCountry}
                value={customerInviteForm.phone}
              />
              {phoneError && <span id="staff-invite-phone-error" className="staff-client-field-error" role="alert">{customerInviteStatus}</span>}
            </label>
            <label>
              <span className="staff-field-label">{text.labels.nickname} *</span>
              <input
                aria-required="true"
                aria-invalid={nicknameError || undefined}
                aria-describedby={nicknameError ? 'staff-invite-nickname-error' : undefined}
                value={customerInviteForm.nickname}
                onChange={(event) => {
                  clearFeedback(messages.customerAccountNicknameRequired, messages.customerAccountNicknameTaken)
                  setCustomerInviteForm((current) => ({ ...current, nickname: event.target.value }))
                }}
                placeholder="Phantom"
              />
              {nicknameError && <span id="staff-invite-nickname-error" className="staff-client-field-error" role="alert">{customerInviteStatus}</span>}
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
          {customerInviteStatus && !isFieldFeedback && <p className="staff-client-feedback" data-tone={confirmed ? 'success' : 'error'} role={confirmed ? 'status' : 'alert'}>{customerInviteStatus}</p>}
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
        </section>
      )}
      {canAwardAchievements && (
        <section className="staff-card staff-card-wide staff-client-workspace-card" aria-labelledby="staff-client-workspace-title">
          <h3 id="staff-client-workspace-title">{text.tabs.clientProfile}</h3>
          <StaffPlayerAchievementProfile
            awards={achievementAwards}
            language={resolvedLanguage}
            onDirtyChange={setClientProfileDirty}
            onRefreshAwards={async () => {
              markStaffDataStale('achievementAwards')
              await Promise.all([loadAchievementAwards(true), loadProfiles(true)])
            }}
            profiles={awardableProfiles}
            profilesLoading={Boolean(loadingData.profiles)}
            text={sharedText}
          />
        </section>
      )}
    </div>
  )
}
