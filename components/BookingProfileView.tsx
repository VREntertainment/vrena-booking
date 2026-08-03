'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

import NextImage from 'next/image'
import {
  Bell,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  ScanLine,
  ShieldCheck,
  Settings,
  Trash2,
  Trophy,
  UserRound,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { avatarColors, avatarEmojis, avatarTextColors } from '../lib/bookingStaticData'
import { vrenaPalette } from '../lib/theme/vrenaPalette'
import {
  ANONYMOUS_MASK_COLOR,
  ANONYMOUS_MASK_EMOJI,
  ANONYMOUS_MASK_TEXT_COLOR,
  MAX_DISPLAY_NAME_LENGTH,
  compactInitials,
  displayName,
  formatShortDate,
  limitDisplayName,
  limitMotto,
  normalizeProfileGender,
} from '../lib/bookingWidgetDomain'
import AppLoadingState from './AppLoadingState'
import CountryCodePicker from './CountryCodePicker'
import ContactChannels from './ContactChannels'
import { shouldSkipImageOptimization } from './AvatarNode'
import ProfileAchievementsPanel from './ProfileAchievementsPanel'
import ProfileAuthView from './ProfileAuthView'
import ShortDateInput from './ShortDateInput'

const profileTabCopy = {
  en: { achievements: 'Achievements', settings: 'Settings' },
  vi: { achievements: 'Thành tựu', settings: 'Cài đặt' },
  ko: { achievements: '업적', settings: '설정' },
  ja: { achievements: '実績', settings: '設定' },
  fr: { achievements: 'Succès', settings: 'Réglages' },
  de: { achievements: 'Erfolge', settings: 'Einstellungen' },
  it: { achievements: 'Obiettivi', settings: 'Impostazioni' },
}

function ButtonIconText({ children, icon }: { children: ReactNode; icon: ReactNode }) {


  return (
    <span className="button-icon-text">
      {icon}
      <span>{children}</span>
    </span>
  )
}

export default function BookingProfileView({ context }: { context: any }) {
  const [profileSubTab, setProfileSubTab] = useState<'achievements' | 'settings'>('achievements')
  const {
    activeTotpFactor,
    activeAgeBand,
    authMode,
    authStep,
    avatarColor,
    avatarColorDraft,
    avatarEmoji,
    avatarInitials,
    avatarMode,
    avatarPreview,
    avatarTextColor,
    avatarTextColorDraft,
    beginTotpEnrollment,
    canAccessStaffConsole,
    captchaContainerRef,
    consentWaiverUrl,
    chooseAvatarMode,
    confirmTotpEnrollment,
    continueAuthFromEmail,
    deleteMyAccount,
    editAuthEmail,
    failedAvatarUrls,
    handleAuth,
    handleAvatarChange,
    isAdultProfile,
    isDeletingAccount,
    isMfaLoading,
    isMinorBirthdayLocked,
    isOAuthLoading,
    isProfileAuthLoading,
    isProfileSaveSuccessful,
    isPasskeyLoading,
    isRecoveryMode,
    isResettingPassword,
    isSavingAnonymousMode,
    isSavingProfile,
    isTeenMinorProfile,
    isUnder13Profile,
    language,
    logout,
    marketingConsent,
    mfaChallengeCode,
    mfaEnrollment,
    mfaQrCodeSrc,
    mfaRequired,
    mfaStatus,
    mfaVerifyCode,
    mySessions,
    newPassword,
    passkeyButtonRef,
    personalDataConsent,
    playerStats,
    privacyPolicyUrl,
    profile,
    profileBirthday,
    profileCountryCode,
    profileEmail,
    profileGender,
    profileMotto,
    profileName,
    profileNickname,
    profilePassword,
    profilePastSessions,
    profilePhone,
    profileStatus,
    profileUpcomingSessions,
    registerPasskey,
    rememberFailedAvatarUrl,
    rememberLogin,
    replayOnboardingTour,
    removeTotpFactor,
    resetCaptcha,
    saveProfile,
    sendPasswordReset,
    setActiveView,
    setAnonymousConfirmOpen,
    setAuthMode,
    setAuthStep,
    setAvatarColorDraft,
    setAvatarEmoji,
    setAvatarInitials,
    setAvatarTextColorDraft,
    setMarketingConsent,
    setMfaChallengeCode,
    setMfaEnrollment,
    setMfaStatus,
    setMfaVerifyCode,
    setNewPassword,
    setPersonalDataConsent,
    setProfileBirthday,
    setProfileCountryCode,
    setProfileEmail,
    setProfileGender,
    setProfileMotto,
    setProfileName,
    setProfileNickname,
    setProfilePassword,
    setProfilePhone,
    setProfileStatus,
    setRememberLogin,
    setShowPassword,
    showPassword,
    showProfileFields,
    signInWithGoogle,
    signInWithPasskey,
    staffMfaEnrollmentRequired,
    termsConditionsUrl,
    text,
    updateAnonymousMode,
    updateAuthMode,
    updateAvatarColor,
    updateAvatarColorDraft,
    updateAvatarTextColor,
    updateAvatarTextColorDraft,
    updateMarketingConsent,
    updatePasswordFromRecovery,
    userId,
    verifyMfaChallenge
  } = context

  const profileTabs = profileTabCopy[language as keyof typeof profileTabCopy] ?? profileTabCopy.en

  const profileCompletionSteps = [
    { done: Boolean(profile), label: text.profileStepAccount },
    { done: Boolean(profileName.trim()), label: text.profileStepName },
    { done: Boolean(profileBirthday), label: text.profileStepBirthday },
    { done: Boolean(profileNickname.trim()), label: text.profileStepNickname },
    {
      done: Boolean(avatarPreview || profile?.avatar_url || profile?.avatar_emoji || avatarInitials.trim()),
      label: text.profileStepAvatar,
    },
    { done: ((profilePastSessions?.length ?? 0) + (profileUpcomingSessions?.length ?? 0)) > 0, label: text.profileStepFirstBooking },
  ]
  const completedProfileSteps = profileCompletionSteps.filter((step) => step.done).length
  const profileCompletionPercent = Math.round((completedProfileSteps / profileCompletionSteps.length) * 100)
  const nextProfileStep = profileCompletionSteps.find((step) => !step.done)

  return (
          <ProfileAuthView
            authMode={authMode}
            isRecoveryMode={isRecoveryMode}
            mfaRequired={mfaRequired}
            onAuthModeChange={updateAuthMode}
            profileExists={Boolean(profile)}
            loading={isProfileAuthLoading}
            text={text}
            unframed={Boolean(profile)}
          >
            {isProfileAuthLoading ? (
              <AppLoadingState className="profile-loading-panel" label={text.profileLoading} />
            ) : (
              <>
            {!mfaRequired && !profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'email' && (
              <div className="auth-method-stack">
                <button
                  className={isOAuthLoading ? 'secondary create-button google-auth-button loading' : 'secondary create-button google-auth-button'}
                  disabled={isOAuthLoading}
                  onClick={signInWithGoogle}
                  type="button"
                >
                  <span className="google-mark" aria-hidden="true">
                    <svg viewBox="0 0 18 18" focusable="false">
                      <path fill="#4285f4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                      <path fill="#34a853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.35 0-4.34-1.58-5.05-3.72H.93v2.33A9 9 0 0 0 9 18Z" />
                      <path fill="#fbbc05" d="M3.95 10.7a5.41 5.41 0 0 1 0-3.4V4.97H.93a9 9 0 0 0 0 8.06l3.02-2.33Z" />
                      <path fill="#ea4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .93 4.97L3.95 7.3C4.66 5.16 6.65 3.58 9 3.58Z" />
                    </svg>
                  </span>
                  {text.continueWithGoogle}
                </button>
                {authMode === 'login' && (
                  <button
                    aria-busy={isPasskeyLoading}
                    aria-disabled={isPasskeyLoading}
                    className="secondary create-button passkey-auth-button"
                    disabled={isPasskeyLoading}
                    onClick={signInWithPasskey}
                    ref={passkeyButtonRef}
                    type="button"
                  >
                    <span className="passkey-mark" aria-hidden="true">
                      <KeyRound size={19} strokeWidth={2.4} />
                    </span>
                    {isPasskeyLoading ? text.passkeyStarting : text.continueWithPasskey}
                  </button>
                )}
                <div className="auth-divider">
                  <span>{text.authOr}</span>
                </div>
              </div>
            )}

            {profile && staffMfaEnrollmentRequired && (
              <div className="mfa-challenge-panel" role="status">
                <div className="mfa-panel-icon">
                  <ShieldCheck aria-hidden="true" size={22} />
                </div>
                <div className="mfa-panel-copy">
                  <strong>{text.staffMfaRequiredTitle}</strong>
                  <span>{text.staffMfaRequiredHint}</span>
                </div>
                <button className="secondary small-button" onClick={() => setProfileSubTab('settings')} type="button">
                  {text.mfaSetupTitle}
                </button>
              </div>
            )}

            {profile && (
              <div className="segmented profile-sub-tabs" aria-label={text.profile}>
                <button
                  className={profileSubTab === 'achievements' ? 'active' : ''}
                  onClick={() => setProfileSubTab('achievements')}
                  type="button"
                >
                  <ButtonIconText icon={<Trophy aria-hidden="true" size={17} />}>{profileTabs.achievements}</ButtonIconText>
                </button>
                <button
                  className={profileSubTab === 'settings' ? 'active' : ''}
                  onClick={() => setProfileSubTab('settings')}
                  type="button"
                >
                  <ButtonIconText icon={<Settings aria-hidden="true" size={17} />}>{profileTabs.settings}</ButtonIconText>
                </button>
              </div>
            )}

            {profile && profileSubTab === 'achievements' ? (
              <ProfileAchievementsPanel
                language={language}
                mySessions={mySessions}
                playerStats={playerStats}
                profile={profile}
                text={text}
                userId={userId}
              />
            ) : (
              <>
            {profile && (
              <>
                <section className="profile-completion-card" aria-label={text.profileCompletionTitle}>
                  <div className="profile-completion-head">
                    <div>
                      <strong>{text.profileCompletionTitle}</strong>
                      <span>{nextProfileStep ? text.profileCompletionBody : text.profileCompletionComplete}</span>
                    </div>
                    <b>{profileCompletionPercent}%</b>
                  </div>
                  <span className="rank-progress-track" aria-hidden="true">
                    <span style={{ width: `${profileCompletionPercent}%` }} />
                  </span>
                  <div className="profile-completion-footer">
                    <span>
                      {text.profileCompletionSteps
                        .replace('{done}', String(completedProfileSteps))
                        .replace('{total}', String(profileCompletionSteps.length))}
                    </span>
                    {nextProfileStep && (
                      <span>
                        {text.profileCompletionNext.replace('{step}', nextProfileStep.label)}
                      </span>
                    )}
                  </div>
                </section>
                <div className="action-row profile-save-actions profile-settings-actions">
                  <button
                    className={[
                      'primary create-button profile-save-button',
                      isSavingProfile ? 'loading' : '',
                      isProfileSaveSuccessful ? 'save-success' : '',
                    ].filter(Boolean).join(' ')}
                    aria-describedby={profileStatus ? 'profile-save-status' : undefined}
                    disabled={isSavingProfile}
                    onClick={saveProfile}
                    type="button"
                  >
                    {isProfileSaveSuccessful ? (
                      <span className="profile-save-success-content">
                        <span className="profile-save-success-icon" aria-hidden="true">
                          <Check size={18} strokeWidth={3} />
                        </span>
                        <span>{text.profileSaved}</span>
                      </span>
                    ) : isSavingProfile ? text.saving : text.saveProfile}
                  </button>
                  <button className="secondary create-button" onClick={logout} type="button">
                    {text.logOut}
                  </button>
                  {canAccessStaffConsole && (
                    <button className="secondary create-button mobile-staff-profile-action" onClick={() => setActiveView('staff')} type="button">
                      Staff Console
                    </button>
                  )}
                  {profileStatus && (
                    <p
                      aria-live="polite"
                      className="notice compact-notice profile-save-status"
                      id="profile-save-status"
                      role="status"
                    >
                      {profileStatus}
                    </p>
                  )}
                </div>
              </>
            )}
            <div className={[
              'form-grid profile-form',
              profile ? 'profile-account-form' : '',
              !profile && (authMode === 'login' || authMode === 'create' || authMode === 'reset' || isRecoveryMode) ? 'login-profile-form' : '',
              !profile && authMode === 'create' ? 'create-profile-form' : '',
            ].join(' ').trim()} hidden={mfaRequired}>
              {showProfileFields && (
                <div className={profile ? 'profile-photo-panel profile-account-hero' : 'profile-photo-panel'}>
                  <label className="profile-photo-preview" style={{ background: profile?.anonymous_mode ? ANONYMOUS_MASK_COLOR : avatarColor, color: profile?.anonymous_mode ? ANONYMOUS_MASK_TEXT_COLOR : avatarTextColor }}>
                    {profile?.anonymous_mode ? (
                      <span className="avatar-emoji">{ANONYMOUS_MASK_EMOJI}</span>
                    ) : avatarMode === 'photo' && (avatarPreview || (profile?.avatar_url && !failedAvatarUrls.has(profile.avatar_url.trim()))) ? (
                      <NextImage
                        src={avatarPreview || profile?.avatar_url || ''}
                        alt=""
                        width={112}
                        height={112}
                        unoptimized={shouldSkipImageOptimization(avatarPreview || profile?.avatar_url)}
                        onError={() => rememberFailedAvatarUrl(avatarPreview || profile?.avatar_url)}
                      />
                    ) : avatarMode === 'emoji' ? (
                      <span className="avatar-emoji">{avatarEmoji}</span>
                    ) : avatarMode === 'initials' ? (
                      <span className="avatar-text">{compactInitials(avatarInitials || displayName(profile))}</span>
                    ) : (
                      <span className="avatar-text">{compactInitials(displayName(profile))}</span>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} />
                  </label>
                  <div className="profile-identity-copy">
                    <strong>{profile ? displayName(profile) : text.profilePhoto}</strong>
                    <span>{text.uploadPhoto}</span>
                    {profile && (
                      <div className="profile-summary-pills" aria-label={text.playerProfile}>
                        {profileEmail && (
                          <span><Mail aria-hidden="true" size={13} /><span className="profile-summary-text">{profileEmail}</span></span>
                        )}
                        {profilePhone && (
                          <span><Phone aria-hidden="true" size={13} /><span className="profile-summary-text">{profileCountryCode} {profilePhone}</span></span>
                        )}
                        {profileBirthday && (
                          <span><CalendarDays aria-hidden="true" size={13} /><span className="profile-summary-text">{formatShortDate(profileBirthday, language)}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="avatar-options">
                    {profile && (
                      <label className="profile-toggle-field anonymous-mode-toggle">
                        <input
                          checked={Boolean(profile.anonymous_mode)}
                          disabled={isSavingAnonymousMode}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setAnonymousConfirmOpen(true)
                              return
                            }
                            updateAnonymousMode(false)
                          }}
                          type="checkbox"
                        />
                        <span>
                          <strong>{text.anonymousMode}</strong>
                          <small>{text.anonymousModeHint}</small>
                        </span>
                      </label>
                    )}
                    <span>{text.avatarStyle}</span>
                    <div className="segmented compact-segmented">
                      <button className={avatarMode === 'photo' ? 'active' : ''} onClick={() => chooseAvatarMode('photo')} type="button">{text.usePhoto}</button>
                      <button className={avatarMode === 'emoji' ? 'active' : ''} onClick={() => chooseAvatarMode('emoji')} type="button">{text.useEmoji}</button>
                      <button className={avatarMode === 'initials' ? 'active' : ''} onClick={() => chooseAvatarMode('initials')} type="button">{text.useInitials}</button>
                    </div>
                    {avatarMode === 'emoji' && (
                      <div className="emoji-row">
                        {avatarEmojis.map((emoji) => (
                          <button className={avatarEmoji === emoji ? 'active' : ''} key={emoji} onClick={() => setAvatarEmoji(emoji)} type="button">{emoji}</button>
                        ))}
                      </div>
                    )}
                    {avatarMode === 'initials' && (
                      <input maxLength={2} value={avatarInitials} onChange={(event) => setAvatarInitials(compactInitials(event.target.value))} placeholder="VR" aria-label={text.avatarInitials} />
                    )}
                    {avatarMode !== 'photo' && (
                      <>
                        <div className="avatar-color-field">
                          <div className="color-row" aria-label={text.avatarColor}>
                            {avatarColors.map((color) => (
                              <button
                                className={avatarColor === color ? 'active' : ''}
                                key={color}
                                onClick={() => updateAvatarColor(color)}
                                style={{ background: color }}
                                type="button"
                              />
                            ))}
                          </div>
                          <div className="custom-color-row">
                            <label>
                              <span>{text.customColor}</span>
                              <input type="color" value={avatarColor} onChange={(event) => updateAvatarColor(event.target.value)} />
                            </label>
                            <label className="hex-field">
                              <span>{text.hexColor}</span>
                              <input
                                maxLength={7}
                                value={avatarColorDraft}
                                onBlur={() => setAvatarColorDraft(avatarColor)}
                                onChange={(event) => updateAvatarColorDraft(event.target.value)}
                                placeholder={vrenaPalette.purple[500]}
                              />
                            </label>
                          </div>
                        </div>
                        {avatarMode === 'initials' && (
                          <>
                            <div className="avatar-color-field">
                              <div className="color-row" aria-label={text.avatarTextColor}>
                                {avatarTextColors.map((color) => (
                                  <button
                                    className={avatarTextColor === color ? 'active' : ''}
                                    key={color}
                                    onClick={() => updateAvatarTextColor(color)}
                                    style={{ background: color }}
                                    type="button"
                                  />
                                ))}
                              </div>
                              <div className="custom-color-row">
                                <label>
                                  <span>{text.avatarTextColor}</span>
                                  <input type="color" value={avatarTextColor} onChange={(event) => updateAvatarTextColor(event.target.value)} />
                                </label>
                                <label className="hex-field">
                                  <span>{text.hexColor}</span>
                                  <input
                                    maxLength={7}
                                    value={avatarTextColorDraft}
                                    onBlur={() => setAvatarTextColorDraft(avatarTextColor)}
                                    onChange={(event) => updateAvatarTextColorDraft(event.target.value)}
                                    placeholder={vrenaPalette.white}
                                  />
                                </label>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {profile && showProfileFields && (
                <div className="profile-card-section-title">
                  <UserRound aria-hidden="true" size={17} />
                  <span>{text.profile}</span>
                </div>
              )}
              {showProfileFields && (
                <>
                  <div className="country-phone-field">
                    <label className="country-phone-label">{text.phoneNumber} <span className="required">*</span></label>
                    <div className="country-field">
                      <CountryCodePicker
                        buttonLabel={text.countryCode}
                        onChange={setProfileCountryCode}
                        searchPlaceholder={text.searchCountry}
                        value={profileCountryCode}
                      />
                    </div>
                    <div className="phone-field">
                      <input
                        aria-invalid={profileStatus === text.phoneRequired}
                        aria-label={text.phoneNumber}
                        aria-required="true"
                        id="profile-phone-input"
                        onChange={(event) => setProfilePhone(event.target.value)}
                        placeholder="0981152315"
                        value={profilePhone}
                      />
                    </div>
                  </div>
                </>
              )}
              {(profile || authMode === 'reset' || isRecoveryMode || authStep === 'email') && (
                <div className="email-field">
                  <label>{text.email} <span className="required">*</span></label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                    placeholder="contact@vre-vietnam.com"
                  />
                </div>
              )}
              {!profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'credentials' && (
                <div className="auth-email-review">
                  <span>{profileEmail}</span>
                  <button className="auth-inline-link" onClick={editAuthEmail} type="button">
                    {text.changeEmail}
                  </button>
                </div>
              )}
              {showProfileFields && (
                <div className="name-field">
                  <label>{text.name} <span className="required">*</span></label>
                  <input
                    aria-invalid={profileStatus === text.nameRequired}
                    aria-required="true"
                    id="profile-name-input"
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Nguyen Van A"
                    value={profileName}
                  />
                </div>
              )}
              {showProfileFields && (
                <div className="nickname-field">
                  <label>{text.nickname}</label>
                  <input
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    value={profileNickname}
                    onChange={(event) => setProfileNickname(limitDisplayName(event.target.value))}
                    placeholder={text.optional}
                  />
                </div>
              )}
              {showProfileFields && (
                <div className="motto-field">
                  <label>{text.profileMotto}</label>
                  <input
                    maxLength={20}
                    value={profileMotto}
                    onChange={(event) => setProfileMotto(limitMotto(event.target.value))}
                    placeholder={text.profileMottoPlaceholder}
                  />
                  <p className="field-help">{text.profileMottoHelp}</p>
                </div>
              )}
              {(showProfileFields || (!profile && authMode === 'create' && authStep === 'credentials')) && (
                <div className="birthday-field">
                  <label>{text.birthday} {!profile && <span className="required">*</span>}</label>
                  <ShortDateInput
                    ariaLabel={text.birthday}
                    disabled={isMinorBirthdayLocked}
                    language={language}
                    onChange={setProfileBirthday}
                    placeholder={text.chooseDate}
                    value={profileBirthday}
                  />
                  {!profile && <p className="field-help">{text.birthdaySignupHelp}</p>}
                  {isMinorBirthdayLocked && (
                    <p className="field-help minor-birthday-lock-note">
                      <LockKeyhole aria-hidden="true" size={14} />
                      <span>
                        {text.minorBirthdayLockedHelp}{' '}
                        <a href="mailto:contact@vre-vietnam.com">{text.contactUs}</a>
                      </span>
                    </p>
                  )}
                </div>
              )}
              {showProfileFields && (
                <div className="gender-field">
                  <label>{text.gender}</label>
                  <select
                    disabled={isUnder13Profile}
                    value={isUnder13Profile ? '' : profileGender}
                    onChange={(event) => setProfileGender(normalizeProfileGender(event.target.value))}
                  >
                    <option value="">{text.optional}</option>
                    <option value="male">{text.genderMale}</option>
                    <option value="female">{text.genderFemale}</option>
                    <option value="non_binary">{text.genderNonBinary}</option>
                    <option value="prefer_not_to_say">{text.genderPreferNotToSay}</option>
                    <option value="self_describe">{text.genderSelfDescribe}</option>
                  </select>
                  {isUnder13Profile && <p className="field-help minor-policy-note">{text.under13GenderDisabled}</p>}
                </div>
              )}
              {activeAgeBand === 'minor' && (
                <p className="minor-policy-note profile-age-policy-note">{text.minorConsentNotice}</p>
              )}
              {activeAgeBand === 'under13' && (
                <p className="minor-policy-note profile-age-policy-note">{text.under13AccountNotice}</p>
              )}
              {profile && showProfileFields && (
                <div className="profile-consent-panel">
                  <div className="profile-card-section-title profile-preferences-title">
                    <Bell aria-hidden="true" size={17} />
                    <span>{text.profilePreferences}</span>
                  </div>
                  <label className="consent-field profile-preference-consent-field marketing-consent-field">
                    <input
                      checked={marketingConsent}
                      onChange={(event) => {
                        const nextConsent = event.target.checked
                        updateMarketingConsent(nextConsent)
                      }}
                      type="checkbox"
                    />
                    <span>
                      <strong>{text.marketingConsent}</strong>
                      <small>{text.marketingConsentHint}</small>
                    </span>
                  </label>
                  <div className="profile-legal-panel">
                    <div className="account-links legal-links">
                      <a className="link-button" href={termsConditionsUrl} rel="noreferrer" target="_blank">{text.termsConditions}</a>
                      <a className="link-button" href={privacyPolicyUrl} rel="noreferrer" target="_blank">{text.privacyPolicy}</a>
                      <a className="link-button" href={consentWaiverUrl} rel="noreferrer" target="_blank">{text.consentWaiver}</a>
                    </div>
                    {isAdultProfile && profile.personal_data_consent_at && (
                      <p className="field-help">{text.legalAcceptedPrefix} {formatShortDate(profile.personal_data_consent_at.slice(0, 10), language)}</p>
                    )}
                    {isTeenMinorProfile && <p className="minor-policy-note">{text.minorConsentNotice}</p>}
                    {isUnder13Profile && <p className="minor-policy-note">{text.under13AccountNotice}</p>}
                  </div>
                </div>
              )}
              {!profile && showProfileFields && (
                <label className="consent-field marketing-consent-field">
                  <input
                    checked={marketingConsent}
                    onChange={(event) => {
                      const nextConsent = event.target.checked
                      setMarketingConsent(nextConsent)
                    }}
                    type="checkbox"
                  />
                  <span>
                    <strong>{text.marketingConsent}</strong>
                    <small>{text.marketingConsentHint}</small>
                  </span>
                </label>
              )}
              {!profile && authMode === 'create' && authStep === 'credentials' && activeAgeBand === 'adult' && (
                <label className="consent-field">
                  <input
                    checked={personalDataConsent}
                    onChange={(event) => setPersonalDataConsent(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    {text.consentPrefix}
                    <a href={termsConditionsUrl} rel="noreferrer" target="_blank">{text.termsConditions}</a>
                    {text.legalSeparator}
                    <a href={privacyPolicyUrl} rel="noreferrer" target="_blank">{text.privacyPolicy}</a>
                    {text.legalSeparator}
                    <a href={consentWaiverUrl} rel="noreferrer" target="_blank">{text.consentWaiver}</a>
                    {text.consentSuffix}
                  </span>
                </label>
              )}
              {!profile && !isRecoveryMode && authMode !== 'reset' && authStep === 'credentials' && (
                <div className="password-field">
                  <label>{text.password} <span className="required">*</span></label>
                  <div className="password-control">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={profilePassword}
                      onChange={(event) => setProfilePassword(event.target.value)}
                      placeholder={text.passwordPlaceholder}
                    />
                    <button type="button" aria-label={showPassword ? text.hidePassword : text.showPassword} title={showPassword ? text.hidePassword : text.showPassword} onClick={() => setShowPassword((visible: boolean) => !visible)}>
                      {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                    </button>
                  </div>
                  {authMode === 'create' && <p className="field-help">{text.passwordHelp}</p>}
                  {authMode === 'login' && (
                    <>
                      <div className="auth-utility-row">
                        <label className="remember-field">
                          <input
                            checked={rememberLogin}
                            onChange={(event) => setRememberLogin(event.target.checked)}
                            type="checkbox"
                          />
                          <span>{text.rememberMe}</span>
                        </label>
                        <button
                          className="auth-inline-link"
                          onClick={() => {
                            setAuthMode('reset')
                            setAuthStep('email')
                            setProfileStatus('')
                            resetCaptcha()
                          }}
                          type="button"
                        >
                          {text.forgotPassword}
                        </button>
                      </div>
                      <p className="field-help">{text.passwordLoginHelp}</p>
                    </>
                  )}
                </div>
              )}
              {!profile && !isRecoveryMode && (authMode === 'reset' || ((authMode === 'create' || authMode === 'login') && authStep === 'credentials')) && (
                <div className="captcha-field">
                  <label>{text.captchaLabel} <span className="required">*</span></label>
                  <div className="captcha-box" ref={captchaContainerRef} />
                  <p className="field-help">{authMode === 'reset' ? text.resetPasswordCaptchaHelp : text.captchaHelp}</p>
                </div>
              )}
              {isRecoveryMode && (
                <div className="password-field">
                  <label>{text.newPassword} <span className="required">*</span></label>
                  <div className="password-control">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder={text.passwordPlaceholder}
                    />
                    <button type="button" aria-label={showPassword ? text.hidePassword : text.showPassword} title={showPassword ? text.hidePassword : text.showPassword} onClick={() => setShowPassword((visible: boolean) => !visible)}>
                      {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                    </button>
                  </div>
                  <p className="field-help">{text.resetPasswordReady}</p>
                </div>
              )}
            </div>

            {mfaRequired ? (
              <div className="mfa-challenge-panel">
                <div className="mfa-panel-icon">
                  <ShieldCheck aria-hidden="true" size={22} />
                </div>
                <div className="mfa-panel-copy">
                  <strong>{text.mfaChallengeTitle}</strong>
                  <span>{text.mfaChallengeHint}</span>
                </div>
                <div className="mfa-code-row">
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={8}
                    onChange={(event) => setMfaChallengeCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder={text.mfaCodePlaceholder}
                    value={mfaChallengeCode}
                  />
                  <button className={isMfaLoading ? 'primary loading' : 'primary'} disabled={isMfaLoading} onClick={verifyMfaChallenge} type="button">
                    {isMfaLoading ? text.saving : text.mfaVerify}
                  </button>
                </div>
                <button className="auth-inline-link" onClick={logout} type="button">{text.logOut}</button>
              </div>
            ) : (authMode === 'reset' && !profile && !isRecoveryMode) ? (
              <div className="action-row">
                <button
                  className={isResettingPassword ? 'primary loading create-button' : 'primary create-button'}
                  disabled={isResettingPassword}
                  onClick={sendPasswordReset}
                  type="button"
                >
                  {isResettingPassword ? text.saving : text.resetPasswordCta}
                </button>
                <button
                  className="secondary create-button"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthStep('email')
                    setProfileStatus('')
                    resetCaptcha()
                  }}
                  type="button"
                >
                  {text.backToLogin}
                </button>
              </div>
            ) : isRecoveryMode ? (
              <div className="action-row">
                <button
                  className={isResettingPassword ? 'primary loading create-button' : 'primary create-button'}
                  disabled={isResettingPassword}
                  onClick={updatePasswordFromRecovery}
                  type="button"
                >
                  {isResettingPassword ? text.saving : text.updatePassword}
                </button>
              </div>
            ) : profile ? null : (
              <div className="action-row">
                <button
                  className={isSavingProfile ? 'primary loading create-button' : 'primary create-button'}
                  disabled={isSavingProfile}
                  onClick={profile ? saveProfile : authStep === 'email' && authMode !== 'reset' ? continueAuthFromEmail : handleAuth}
                  type="button"
                >
                  {isSavingProfile
                    ? profile
                      ? text.saving
                      : authMode === 'login'
                        ? text.loggingIn
                        : text.creating
                    : profile
                      ? text.saveProfile
                      : authStep === 'email' && authMode !== 'reset'
                        ? text.continueWithEmail
                      : authMode === 'login'
                        ? text.logIn
                        : text.createAccount}
                </button>
              </div>
            )}
            {profile && (
              <div className="profile-security-panel">
                <div className="profile-card-section-title">
                  <ShieldCheck aria-hidden="true" size={17} />
                  <span>{text.profileSecurity}</span>
                </div>
                <div className="account-links">
                  <button className="link-button" disabled={isPasskeyLoading} onClick={registerPasskey} type="button">
                    <ButtonIconText icon={<KeyRound aria-hidden="true" size={16} />}>{isPasskeyLoading ? text.saving : text.addPasskey}</ButtonIconText>
                  </button>
                  <button className="link-button" disabled={isResettingPassword} onClick={sendPasswordReset} type="button">
                    <ButtonIconText icon={<LockKeyhole aria-hidden="true" size={16} />}>{isResettingPassword ? text.saving : text.resetPassword}</ButtonIconText>
                  </button>
                  <button className="link-button" onClick={replayOnboardingTour} type="button">
                    <ButtonIconText icon={<UserRound aria-hidden="true" size={16} />}>{text.takeTourAgain}</ButtonIconText>
                  </button>
                  <button className="link-button danger-link" disabled={isDeletingAccount} onClick={deleteMyAccount} type="button">
                    <ButtonIconText icon={<Trash2 aria-hidden="true" size={16} />}>{isDeletingAccount ? text.saving : text.deleteAccount}</ButtonIconText>
                  </button>
                  {activeTotpFactor ? (
                    <button
                      aria-label={text.mfaDisable}
                      className="link-button"
                      disabled={isMfaLoading}
                      onClick={() => removeTotpFactor(activeTotpFactor.id)}
                      title={text.mfaEnabledHint}
                      type="button"
                    >
                      <ButtonIconText icon={<ScanLine aria-hidden="true" size={16} />}>{isMfaLoading ? text.saving : text.mfaAuthenticatorTitle}</ButtonIconText>
                    </button>
                  ) : (
                    <button
                      aria-label={text.mfaEnable}
                      className="link-button"
                      disabled={isMfaLoading}
                      onClick={beginTotpEnrollment}
                      title={text.mfaAuthenticatorHint}
                      type="button"
                    >
                      <ButtonIconText icon={<ScanLine aria-hidden="true" size={16} />}>{isMfaLoading ? text.saving : text.mfaAuthenticatorTitle}</ButtonIconText>
                    </button>
                  )}
                </div>
                {mfaEnrollment && (
                  <div className="mfa-enroll-panel">
                    <div className="mfa-panel-copy">
                      <strong>{text.mfaSetupTitle}</strong>
                      <span>{text.mfaSetupHint}</span>
                    </div>
                    {mfaQrCodeSrc && <NextImage alt="" className="mfa-qr" height={148} src={mfaQrCodeSrc} unoptimized width={148} />}
                    <label className="mfa-secret-field">
                      <span>{text.mfaSecretLabel}</span>
                      <input readOnly type="text" value={mfaEnrollment.secret} />
                    </label>
                    <label className="mfa-code-field">
                      <span>{text.mfaCodeLabel}</span>
                      <input
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={8}
                        onChange={(event) => setMfaVerifyCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder={text.mfaCodePlaceholder}
                        value={mfaVerifyCode}
                      />
                    </label>
                    <div className="mfa-enroll-actions">
                      <button className={isMfaLoading ? 'primary loading' : 'primary'} disabled={isMfaLoading} onClick={confirmTotpEnrollment} type="button">
                        {isMfaLoading ? text.saving : text.mfaVerify}
                      </button>
                      <button className="secondary" disabled={isMfaLoading} onClick={() => {
                        setMfaEnrollment(null)
                        setMfaVerifyCode('')
                        setMfaStatus('')
                      }} type="button">
                        {text.mfaCancel}
                      </button>
                    </div>
                  </div>
                )}
                {mfaStatus && <p className="notice compact-notice">{mfaStatus}</p>}
              </div>
            )}
            {!profile && profileStatus && <p aria-live="polite" className="notice" role="status">{profileStatus}</p>}

            <div className="profile-mobile-contact">
              <strong>VRena Vietnam</strong>
              <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
              <ContactChannels label={text.contactUs} />
              <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
            </div>
              </>
            )}
              </>
            )}
          </ProfileAuthView>

  )
}
