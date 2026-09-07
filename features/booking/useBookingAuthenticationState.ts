'use client'

import {
  useRef,
  useState
} from 'react'
import type { AuthMode } from '../../components/ProfileAuthView'
import {
  Profile,
  TotpEnrollment,
  TotpFactor
} from '../../lib/bookingWidgetDomain'
import { getStaffKioskOperator, type StaffKioskOperator } from '../../lib/supabase/client'

/** Feature-owned state. Mounted unconditionally so navigation preserves drafts and request locks. */
export function useBookingAuthenticationState() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [kioskOperator, setKioskOperator] = useState<StaffKioskOperator | null>(() => getStaffKioskOperator())
  const [kioskLock, setKioskLock] = useState<(() => void) | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authStep, setAuthStep] = useState<'email' | 'credentials'>('email')
  const [profilePassword, setProfilePassword] = useState('')
  const [phoneSetupRequired, setPhoneSetupRequired] = useState(false)
  const [phoneSetupEmail, setPhoneSetupEmail] = useState('')
  const [phoneSetupSentTo, setPhoneSetupSentTo] = useState('')
  const [isPhoneSetupSaving, setIsPhoneSetupSaving] = useState(false)
  const [rememberLogin, setRememberLogin] = useState(true)
  const [captchaToken, setCaptchaToken] = useState('')
  const captchaTokenRef = useRef('')
  const [newPassword, setNewPassword] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isProfileAuthLoading, setIsProfileAuthLoading] = useState(true)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [mfaFactors, setMfaFactors] = useState<TotpFactor[]>([])
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollment | null>(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [mfaChallengeCode, setMfaChallengeCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaAssuranceLevel, setMfaAssuranceLevel] = useState<'aal1' | 'aal2' | null>(null)
  const [isMfaLoading, setIsMfaLoading] = useState(false)
  const mfaVerificationInFlightRef = useRef(false)
  const [mfaStatus, setMfaStatus] = useState('')
  const captchaContainerRef = useRef<HTMLDivElement | null>(null)
  const captchaWidgetId = useRef<string | null>(null)
  const profileAuthLoadSeqRef = useRef(0)
  return {
    profile,
    setProfile,
    userId,
    setUserId,
    authEmail,
    setAuthEmail,
    kioskOperator,
    setKioskOperator,
    kioskLock,
    setKioskLock,
    authMode,
    setAuthMode,
    authStep,
    setAuthStep,
    profilePassword,
    setProfilePassword,
    phoneSetupRequired,
    setPhoneSetupRequired,
    phoneSetupEmail,
    setPhoneSetupEmail,
    phoneSetupSentTo,
    setPhoneSetupSentTo,
    isPhoneSetupSaving,
    setIsPhoneSetupSaving,
    rememberLogin,
    setRememberLogin,
    captchaToken,
    setCaptchaToken,
    captchaTokenRef,
    newPassword,
    setNewPassword,
    isRecoveryMode,
    setIsRecoveryMode,
    showPassword,
    setShowPassword,
    isProfileAuthLoading,
    setIsProfileAuthLoading,
    isOAuthLoading,
    setIsOAuthLoading,
    isPasskeyLoading,
    setIsPasskeyLoading,
    isResettingPassword,
    setIsResettingPassword,
    isDeletingAccount,
    setIsDeletingAccount,
    mfaFactors,
    setMfaFactors,
    mfaEnrollment,
    setMfaEnrollment,
    mfaVerifyCode,
    setMfaVerifyCode,
    mfaChallenge,
    setMfaChallenge,
    mfaChallengeCode,
    setMfaChallengeCode,
    mfaRequired,
    setMfaRequired,
    mfaAssuranceLevel,
    setMfaAssuranceLevel,
    isMfaLoading,
    setIsMfaLoading,
    mfaVerificationInFlightRef,
    mfaStatus,
    setMfaStatus,
    captchaContainerRef,
    captchaWidgetId,
    profileAuthLoadSeqRef,
  }
}
