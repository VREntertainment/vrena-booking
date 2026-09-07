'use client'

import {
  useRef,
  useState
} from 'react'
import {
  avatarColors,
  avatarTextColors
} from '../../lib/bookingStaticData'
import {
  ProfileGender
} from '../../lib/bookingWidgetDomain'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingProfilesState() {
  const [profileCountryCode, setProfileCountryCode] = useState('+84')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profileMotto, setProfileMotto] = useState('')
  const [profileNickname, setProfileNickname] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileBirthday, setProfileBirthday] = useState('')
  const [profileGender, setProfileGender] = useState<ProfileGender | ''>('')
  const [personalDataConsent, setPersonalDataConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(true)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarMode, setAvatarMode] = useState<'photo' | 'emoji' | 'initials'>('photo')
  const [failedAvatarUrls, setFailedAvatarUrls] = useState<Set<string>>(() => new Set())
  const [avatarEmoji, setAvatarEmoji] = useState('😎')
  const [avatarInitials, setAvatarInitials] = useState('')
  const [avatarColor, setAvatarColor] = useState(avatarColors[0])
  const [avatarColorDraft, setAvatarColorDraft] = useState(avatarColors[0])
  const [avatarTextColor, setAvatarTextColor] = useState(avatarTextColors[0])
  const [avatarTextColorDraft, setAvatarTextColorDraft] = useState(avatarTextColors[0])
  const [profileStatus, setProfileStatus] = useState('')
  const profileSaveSuccessTimerRef = useRef<number | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isProfileSaveSuccessful, setIsProfileSaveSuccessful] = useState(false)
  const [profileUpcomingExpanded, setProfileUpcomingExpanded] = useState(false)
  const [profilePastExpanded, setProfilePastExpanded] = useState(false)
  const [profileInvitesExpanded, setProfileInvitesExpanded] = useState(false)
  const [anonymousConfirmOpen, setAnonymousConfirmOpen] = useState(false)
  const [isSavingAnonymousMode, setIsSavingAnonymousMode] = useState(false)
  const [profileScoreAdjustments, setProfileScoreAdjustments] = useState<Record<string, number>>({})
  return {
    profileCountryCode,
    setProfileCountryCode,
    profilePhone,
    setProfilePhone,
    profileName,
    setProfileName,
    profileMotto,
    setProfileMotto,
    profileNickname,
    setProfileNickname,
    profileEmail,
    setProfileEmail,
    profileBirthday,
    setProfileBirthday,
    profileGender,
    setProfileGender,
    personalDataConsent,
    setPersonalDataConsent,
    marketingConsent,
    setMarketingConsent,
    avatarFile,
    setAvatarFile,
    avatarPreview,
    setAvatarPreview,
    avatarMode,
    setAvatarMode,
    failedAvatarUrls,
    setFailedAvatarUrls,
    avatarEmoji,
    setAvatarEmoji,
    avatarInitials,
    setAvatarInitials,
    avatarColor,
    setAvatarColor,
    avatarColorDraft,
    setAvatarColorDraft,
    avatarTextColor,
    setAvatarTextColor,
    avatarTextColorDraft,
    setAvatarTextColorDraft,
    profileStatus,
    setProfileStatus,
    profileSaveSuccessTimerRef,
    isSavingProfile,
    setIsSavingProfile,
    isProfileSaveSuccessful,
    setIsProfileSaveSuccessful,
    profileUpcomingExpanded,
    setProfileUpcomingExpanded,
    profilePastExpanded,
    setProfilePastExpanded,
    profileInvitesExpanded,
    setProfileInvitesExpanded,
    anonymousConfirmOpen,
    setAnonymousConfirmOpen,
    isSavingAnonymousMode,
    setIsSavingAnonymousMode,
    profileScoreAdjustments,
    setProfileScoreAdjustments,
  }
}
