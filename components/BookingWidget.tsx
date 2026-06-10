'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase/client'

const ARENA_COUNT = 2
const OPEN_MINUTES = 9 * 60
const CLOSE_MINUTES = 22 * 60
const TIME_STEP_MINUTES = 20
const ADMIN_EMAILS = ['emile@vre-vietnam.com']

type GameId =
  | 'laser-tag'
  | 'mini-block-towers'
  | 'office-war'
  | 'paintball'
  | 'snow-battle'
  | 'castle-unspunnen'
  | 'wild-west'
  | 'arc-of-the-covenant'
  | 'joller-house'

type Profile = {
  id: string
  phone: string
  nickname: string | null
  email: string | null
  avatar_url: string | null
  role?: 'player' | 'admin'
}

type Participant = {
  id: string
  profile_id: string
  display_name: string | null
  avatar_url: string | null
}

type Session = {
  id: string
  owner_id: string
  name: string
  date: string
  start_time: string
  duration_minutes: number
  max_players: number
  arena_count: number | null
  game_options: GameId[]
  game_votes: Record<string, GameId>
  visibility: 'public' | 'private'
  invite_code: string | null
  notes: string | null
  status: 'open' | 'cancelled' | 'completed'
  session_participants?: Participant[]
}

type BlockedTime = {
  date: string
  start_time: string
  end_time: string
  arenas_used: number
}

const games: Array<{
  id: GameId
  title: string
  category: 'FPS / PVP' | 'Escape'
  image: string
}> = [
  { id: 'laser-tag', title: 'Laser Tag', category: 'FPS / PVP', image: '/games/laser-tag.png' },
  { id: 'mini-block-towers', title: 'Mini Block Towers', category: 'FPS / PVP', image: '/games/mini-block-towers.png' },
  { id: 'office-war', title: 'Office War', category: 'FPS / PVP', image: '/games/office-war.png' },
  { id: 'paintball', title: 'Paintball', category: 'FPS / PVP', image: '/games/paintball.png' },
  { id: 'snow-battle', title: 'Snow Battle', category: 'FPS / PVP', image: '/games/snow-battle.png' },
  { id: 'castle-unspunnen', title: 'Castle Unspunnen', category: 'FPS / PVP', image: '/games/castle-unspunnen.png' },
  { id: 'wild-west', title: 'Wild West', category: 'FPS / PVP', image: '/games/wild-west.png' },
  { id: 'arc-of-the-covenant', title: 'The Secret of the Arc', category: 'Escape', image: '/games/arc-of-the-covenant.png' },
  { id: 'joller-house', title: 'Joller House', category: 'Escape', image: '/games/joller-house.png' },
]

const countries = [
  { code: '+84', name: 'Vietnam' },
  { code: '+33', name: 'France' },
  { code: '+1', name: 'United States / Canada' },
  { code: '+44', name: 'United Kingdom' },
  { code: '+61', name: 'Australia' },
  { code: '+65', name: 'Singapore' },
  { code: '+66', name: 'Thailand' },
  { code: '+60', name: 'Malaysia' },
  { code: '+62', name: 'Indonesia' },
  { code: '+63', name: 'Philippines' },
  { code: '+81', name: 'Japan' },
  { code: '+82', name: 'South Korea' },
  { code: '+86', name: 'China' },
  { code: '+852', name: 'Hong Kong' },
  { code: '+886', name: 'Taiwan' },
  { code: '+49', name: 'Germany' },
  { code: '+39', name: 'Italy' },
  { code: '+34', name: 'Spain' },
  { code: '+31', name: 'Netherlands' },
  { code: '+41', name: 'Switzerland' },
]

const uiText = {
  en: {
    tagline: 'Create a public or private game session and let other players join.',
    noProfile: 'No profile yet',
    clickLogin: 'Click to log in',
    sessions: 'Sessions',
    createSession: 'Create Session',
    availableSessions: 'Available Game Sessions',
    privateJoinHint: 'Private sessions are listed, but joining requires the 6-character code.',
    searchPlaceholder: 'Search by session name, game, or private code',
    noMatchingSessions: 'No matching sessions yet.',
    private: 'Private',
    public: 'Public',
    privateCode: 'Private code',
    copy: 'Copy',
    copied: 'Copied',
    editSession: 'Edit Session',
    cancelSession: 'Cancel Session',
    editSessionTitle: 'Edit session',
    editSessionHint: 'Changes must still match arena availability.',
    sessionName: 'Session Name',
    date: 'Date',
    availableTime: 'Available Time',
    chooseTime: 'Choose a time',
    duration: 'Duration',
    maxPlayers: 'Maximum Players',
    arenas: 'Arenas',
    oneArena: '1 arena',
    twoArenas: '2 arenas - 8 players minimum',
    gameOptions: 'Game Options',
    notes: 'Notes',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    close: 'Close',
    remove: 'Remove',
    seatsLeft: 'seats left',
    joined: 'Joined',
    full: 'Full',
    joining: 'Joining...',
    joinSession: 'Join Session',
    createSessionTitle: 'Create Session',
    createSessionHint: 'Duration increases by 20 minutes. Max players is 16.',
    fridayPlaceholder: 'Friday VR squad',
    notesPlaceholder: 'Language, skill level, preferred game, special notes',
    creating: 'Creating...',
    createPrivateSession: 'Create Private Session',
    profile: 'Profile',
    profileUpdateHint: 'Update your profile details.',
    profileLoginHint: 'Log in or create an account with email, phone number, and password.',
    logIn: 'Log In',
    createAccount: 'Create Account',
    profilePhoto: 'Profile photo',
    uploadPhoto: 'Click the circle to upload your photo.',
    photoShown: 'Shown beside your name when you join a session.',
    countryCode: 'Country Code',
    searchCountry: 'Search country or code',
    phoneNumber: 'Phone Number',
    email: 'Email',
    password: 'Password',
    passwordPlaceholder: 'Minimum 6 characters',
    passwordHelp: 'Use at least 6 characters. Keep this password to log in again later.',
    nickname: 'Nickname',
    optional: 'Optional',
    saveProfile: 'Save Profile',
    loggingIn: 'Logging in...',
    loggedIn: 'Logged in.',
    accountCreated: 'Account created.',
    savingProfile: 'Saving profile...',
    profileSaved: 'Profile saved.',
    logOut: 'Log Out',
    mySessions: 'My sessions',
    mySessionsHint: 'Sessions you created or joined.',
    noSessionsYet: 'No sessions yet.',
    createdByYou: 'Created by you',
    playerRemoved: 'Player removed from session.',
    sessionCancelled: 'Session cancelled.',
    sessionUpdated: 'Session updated.',
    sessionCreated: 'Session created.',
    voteSaved: 'Vote saved.',
    phoneRequired: 'Phone number is required.',
    emailRequired: 'Valid email is required.',
    passwordRequired: 'Password must be at least 6 characters.',
    loginRequired: 'Please log in to finish your profile.',
    loggedOut: 'Logged out.',
    profileLoading: 'Please wait, profile login is still loading.',
    createProfileFirst: 'Please create your profile first.',
    sessionRequired: 'Please enter a session name, date, and available time.',
    privateCreated: 'Private session created. Invite code:',
    privateIncorrect: 'Private code is incorrect.',
    sessionFull: 'This session is already full.',
    joinedSession: 'You joined the session.',
    creatorOnlyEdit: 'Only the creator can edit this session.',
    creatorOnlyCancel: 'Only the creator can cancel this session.',
    creatorOnlyRemove: 'Only the creator can remove players from this session.',
    creatorCannotRemove: 'The session creator cannot be removed.',
    savingSession: 'Saving session...',
    privateUpdated: 'Session updated. Private code:',
    maxPlayersBelowJoined: 'Maximum players cannot be below the current joined players.',
    cancelConfirmPrefix: 'Cancel',
    cancelConfirmSuffix: 'This will remove it from available sessions.',
    removeConfirmPrefix: 'Remove',
    removeConfirmFallback: 'this player',
    fromSession: 'from',
    player: 'Player',
    players: 'players',
    vote: 'vote',
    votes: 'votes',
    arenaAvailable: 'arena available',
    arenasAvailable: 'arenas available',
    createError: 'Could not create session.',
    resetPassword: 'Reset password',
    resetPasswordHelp: 'Enter your email, then tap reset password.',
    resetPasswordSent: 'Password reset email sent. Please check your inbox.',
    resetPasswordEmailRequired: 'Enter your email first.',
    newPassword: 'New password',
    updatePassword: 'Update password',
    passwordUpdated: 'Password updated. You can keep using your account.',
    leaveSession: 'Leave Session',
    leaveConfirmPrefix: 'Leave',
    leaveConfirmSuffix: 'You will be removed from this session.',
    leftSession: 'You left the session.',
    deleteAccount: 'Delete my account',
    deleteAccountConfirm: 'Delete your account? This removes your profile, sessions you created, and sessions you joined.',
    accountDeleted: 'Your account profile has been deleted.',
    share: 'Share',
    shared: 'Shared',
    linkCopied: 'Link copied.',
    loginToContinue: 'Please log in first.',
  },
  vi: {
    tagline: 'Tạo phiên chơi công khai hoặc riêng tư và mời người chơi khác tham gia.',
    noProfile: 'Chưa có hồ sơ',
    clickLogin: 'Bấm để đăng nhập',
    sessions: 'Phiên chơi',
    createSession: 'Tạo phiên',
    availableSessions: 'Các phiên chơi hiện có',
    privateJoinHint: 'Phiên riêng tư vẫn hiển thị, nhưng cần mã 6 ký tự để tham gia.',
    searchPlaceholder: 'Tìm theo tên phiên, game hoặc mã riêng tư',
    noMatchingSessions: 'Chưa có phiên phù hợp.',
    private: 'Riêng tư',
    public: 'Công khai',
    privateCode: 'Mã riêng tư',
    copy: 'Sao chép',
    copied: 'Đã sao chép',
    editSession: 'Sửa phiên',
    cancelSession: 'Hủy phiên',
    editSessionTitle: 'Sửa phiên chơi',
    editSessionHint: 'Thay đổi vẫn phải phù hợp với lịch trống của arena.',
    sessionName: 'Tên phiên',
    date: 'Ngày',
    availableTime: 'Giờ còn trống',
    chooseTime: 'Chọn giờ',
    duration: 'Thời lượng',
    maxPlayers: 'Số người tối đa',
    arenas: 'Arena',
    oneArena: '1 arena',
    twoArenas: '2 arena - tối thiểu 8 người',
    gameOptions: 'Lựa chọn game',
    notes: 'Ghi chú',
    saveChanges: 'Lưu thay đổi',
    saving: 'Đang lưu...',
    close: 'Đóng',
    remove: 'Xóa',
    seatsLeft: 'chỗ còn lại',
    joined: 'Đã tham gia',
    full: 'Đã đầy',
    joining: 'Đang tham gia...',
    joinSession: 'Tham gia',
    createSessionTitle: 'Tạo phiên chơi',
    createSessionHint: 'Thời lượng tăng mỗi 20 phút. Tối đa 16 người chơi.',
    fridayPlaceholder: 'Nhóm VR tối thứ Sáu',
    notesPlaceholder: 'Ngôn ngữ, trình độ, game yêu thích, ghi chú đặc biệt',
    creating: 'Đang tạo...',
    createPrivateSession: 'Tạo phiên riêng tư',
    profile: 'Hồ sơ',
    profileUpdateHint: 'Cập nhật thông tin hồ sơ.',
    profileLoginHint: 'Đăng nhập hoặc tạo tài khoản bằng email, số điện thoại và mật khẩu.',
    logIn: 'Đăng nhập',
    createAccount: 'Tạo tài khoản',
    profilePhoto: 'Ảnh hồ sơ',
    uploadPhoto: 'Bấm vào hình tròn để tải ảnh lên.',
    photoShown: 'Ảnh sẽ hiển thị cạnh tên của bạn khi tham gia phiên.',
    countryCode: 'Mã quốc gia',
    searchCountry: 'Tìm quốc gia hoặc mã',
    phoneNumber: 'Số điện thoại',
    email: 'Email',
    password: 'Mật khẩu',
    passwordPlaceholder: 'Tối thiểu 6 ký tự',
    passwordHelp: 'Dùng ít nhất 6 ký tự. Giữ mật khẩu này để đăng nhập lại.',
    nickname: 'Biệt danh',
    optional: 'Không bắt buộc',
    saveProfile: 'Lưu hồ sơ',
    loggingIn: 'Đang đăng nhập...',
    loggedIn: 'Đã đăng nhập.',
    accountCreated: 'Đã tạo tài khoản.',
    savingProfile: 'Đang lưu hồ sơ...',
    profileSaved: 'Đã lưu hồ sơ.',
    logOut: 'Đăng xuất',
    mySessions: 'Phiên của tôi',
    mySessionsHint: 'Các phiên bạn đã tạo hoặc tham gia.',
    noSessionsYet: 'Chưa có phiên nào.',
    createdByYou: 'Bạn đã tạo',
    playerRemoved: 'Đã xóa người chơi khỏi phiên.',
    sessionCancelled: 'Đã hủy phiên.',
    sessionUpdated: 'Đã cập nhật phiên.',
    sessionCreated: 'Đã tạo phiên.',
    voteSaved: 'Đã lưu bình chọn.',
    phoneRequired: 'Vui lòng nhập số điện thoại.',
    emailRequired: 'Vui lòng nhập email hợp lệ.',
    passwordRequired: 'Mật khẩu phải có ít nhất 6 ký tự.',
    loginRequired: 'Vui lòng đăng nhập để hoàn tất hồ sơ.',
    loggedOut: 'Đã đăng xuất.',
    profileLoading: 'Vui lòng chờ, hồ sơ đăng nhập vẫn đang tải.',
    createProfileFirst: 'Vui lòng tạo hồ sơ trước.',
    sessionRequired: 'Vui lòng nhập tên phiên, ngày và giờ còn trống.',
    privateCreated: 'Đã tạo phiên riêng tư. Mã mời:',
    privateIncorrect: 'Mã riêng tư không đúng.',
    sessionFull: 'Phiên này đã đầy.',
    joinedSession: 'Bạn đã tham gia phiên.',
    creatorOnlyEdit: 'Chỉ người tạo phiên mới có thể sửa phiên này.',
    creatorOnlyCancel: 'Chỉ người tạo phiên mới có thể hủy phiên này.',
    creatorOnlyRemove: 'Chỉ người tạo phiên mới có thể xóa người chơi khỏi phiên này.',
    creatorCannotRemove: 'Không thể xóa người tạo phiên.',
    savingSession: 'Đang lưu phiên...',
    privateUpdated: 'Đã cập nhật phiên. Mã riêng tư:',
    maxPlayersBelowJoined: 'Số người tối đa không thể thấp hơn số người đã tham gia.',
    cancelConfirmPrefix: 'Hủy',
    cancelConfirmSuffix: 'Phiên này sẽ không còn hiển thị trong danh sách.',
    removeConfirmPrefix: 'Xóa',
    removeConfirmFallback: 'người chơi này',
    fromSession: 'khỏi',
    player: 'Người chơi',
    players: 'người chơi',
    vote: 'bình chọn',
    votes: 'bình chọn',
    arenaAvailable: 'arena còn trống',
    arenasAvailable: 'arena còn trống',
    createError: 'Không thể tạo phiên.',
    resetPassword: 'Đặt lại mật khẩu',
    resetPasswordHelp: 'Nhập email của bạn, sau đó bấm đặt lại mật khẩu.',
    resetPasswordSent: 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.',
    resetPasswordEmailRequired: 'Vui lòng nhập email trước.',
    newPassword: 'Mật khẩu mới',
    updatePassword: 'Cập nhật mật khẩu',
    passwordUpdated: 'Đã cập nhật mật khẩu. Bạn có thể tiếp tục dùng tài khoản.',
    leaveSession: 'Rời phiên',
    leaveConfirmPrefix: 'Rời',
    leaveConfirmSuffix: 'Bạn sẽ được xóa khỏi phiên này.',
    leftSession: 'Bạn đã rời phiên.',
    deleteAccount: 'Xóa tài khoản của tôi',
    deleteAccountConfirm: 'Xóa tài khoản? Hồ sơ, phiên bạn đã tạo và các phiên bạn đã tham gia sẽ bị xóa.',
    accountDeleted: 'Hồ sơ tài khoản của bạn đã được xóa.',
    share: 'Chia sẻ',
    shared: 'Đã chia sẻ',
    linkCopied: 'Đã sao chép liên kết.',
    loginToContinue: 'Vui lòng đăng nhập trước.',
  },
}

function detectLanguage() {
  if (typeof navigator === 'undefined') return 'en'
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  return languages.some((language) => language.toLowerCase().startsWith('vi')) ? 'vi' : 'en'
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA
}

function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function arenasUsedBySession(session: Pick<Session, 'max_players' | 'arena_count'>) {
  return session.arena_count || (session.max_players > 7 ? 2 : 1)
}

function resolveCountryCode(input: string) {
  const normalized = input.trim().toLowerCase()
  const explicitCode = normalized.match(/\+\d{1,4}/)?.[0]
  if (explicitCode) return explicitCode

  const country = countries.find((item) => item.name.toLowerCase().includes(normalized))
  return country?.code || '+84'
}

function splitPhoneNumber(phone: string) {
  const cleaned = phone.trim()
  const country = [...countries]
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => cleaned.startsWith(item.code))

  if (!country) {
    return { countryInput: '+84', localPhone: cleaned }
  }

  return {
    countryInput: country.code,
    localPhone: cleaned.slice(country.code.length).trim(),
  }
}

function displayName(profile: Profile | null) {
  if (!profile) return 'Player'
  return profile.nickname || profile.phone
}

export default function WidgetPage() {
  const [activeView, setActiveView] = useState<'sessions' | 'create' | 'profile'>('sessions')
  const [sessions, setSessions] = useState<Session[]>([])
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({})

  const [authMode, setAuthMode] = useState<'login' | 'create'>('login')
  const [profileCountryCode, setProfileCountryCode] = useState('+84')
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [profileNickname, setProfileNickname] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [profileStatus, setProfileStatus] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const [sessionVisibility, setSessionVisibility] = useState<'public' | 'private'>('public')
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState(localDateString())
  const [sessionTime, setSessionTime] = useState('')
  const [sessionDuration, setSessionDuration] = useState(20)
  const [sessionMaxPlayers, setSessionMaxPlayers] = useState(4)
  const [sessionArenaCount, setSessionArenaCount] = useState(1)
  const [sessionNotes, setSessionNotes] = useState('')
  const [selectedGames, setSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [createStatus, setCreateStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [busySessionId, setBusySessionId] = useState('')
  const [busyVoteKey, setBusyVoteKey] = useState('')
  const [copiedInviteId, setCopiedInviteId] = useState('')
  const [sharedKey, setSharedKey] = useState('')
  const [editingSessionId, setEditingSessionId] = useState('')
  const [editSessionName, setEditSessionName] = useState('')
  const [editSessionDate, setEditSessionDate] = useState(localDateString())
  const [editSessionTime, setEditSessionTime] = useState('')
  const [editSessionDuration, setEditSessionDuration] = useState(20)
  const [editSessionMaxPlayers, setEditSessionMaxPlayers] = useState(4)
  const [editSessionArenaCount, setEditSessionArenaCount] = useState(1)
  const [editSessionVisibility, setEditSessionVisibility] = useState<'public' | 'private'>('public')
  const [editSessionNotes, setEditSessionNotes] = useState('')
  const [editSelectedGames, setEditSelectedGames] = useState<GameId[]>(['laser-tag'])
  const [isUpdatingSession, setIsUpdatingSession] = useState(false)
  const [language, setLanguage] = useState<'en' | 'vi'>('en')
  const text = uiText[language]

  async function copyInviteCode(sessionId: string, inviteCode: string | null) {
    if (!inviteCode) return

    await navigator.clipboard?.writeText(inviteCode)
    setCopiedInviteId(sessionId)
    window.setTimeout(() => setCopiedInviteId((current) => (current === sessionId ? '' : current)), 1400)
  }

  function goToLogin() {
    setAuthMode('login')
    setActiveView('profile')
    setProfileStatus(text.loginToContinue)
  }

  async function shareLink(key: string, title: string, path = '') {
    const url = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}${path}`

    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url })
      } else {
        await navigator.clipboard?.writeText(url)
      }
      setSharedKey(key)
      setCreateStatus(text.linkCopied)
      window.setTimeout(() => setSharedKey((current) => (current === key ? '' : current)), 1400)
    } catch {
      // Native share is often cancelled by users; no error message needed.
    }
  }

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser()
    const authUser = userData.user

    if (!authUser) {
      setUserId('')
      setProfile(null)
      return
    }

    setUserId(authUser.id)

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, phone, nickname, email, avatar_url, role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileRow) {
      const phoneParts = splitPhoneNumber(profileRow.phone || '')
      setProfile(profileRow)
      setProfileCountryCode(phoneParts.countryInput)
      setProfilePhone(phoneParts.localPhone)
      setProfileNickname(profileRow.nickname || '')
      setProfileEmail(profileRow.email || '')
    }
  }

  async function handleAuth() {
    const countryCode = resolveCountryCode(profileCountryCode)
    const localPhone = profilePhone.replace(/\D/g, '')
    const fullPhone = `${countryCode}${localPhone}`
    const loginEmail = profileEmail.trim().toLowerCase()

    if (fullPhone.length < 8) {
      setProfileStatus(text.phoneRequired)
      return
    }

    if (!loginEmail || !loginEmail.includes('@')) {
      setProfileStatus(text.emailRequired)
      return
    }

    if (profilePassword.length < 6) {
      setProfileStatus(text.passwordRequired)
      return
    }

    setIsSavingProfile(true)
    setProfileStatus(authMode === 'login' ? text.loggingIn : text.creating)

    if (authMode === 'create') {
      const signUpResult = await supabase.auth.signUp({ email: loginEmail, password: profilePassword })

      if (signUpResult.error) {
        setProfileStatus(signUpResult.error.message)
        setIsSavingProfile(false)
        return
      }
    }

    const signInResult = await supabase.auth.signInWithPassword({ email: loginEmail, password: profilePassword })

    if (signInResult.error) {
      setProfileStatus(signInResult.error.message)
      setIsSavingProfile(false)
      return
    }

    const { data: verifiedUserData } = await supabase.auth.getUser()
    const authUser = verifiedUserData.user

    if (!authUser) {
      setProfileStatus(text.loginRequired)
      setAuthMode('login')
      setIsSavingProfile(false)
      return
    }

    setUserId(authUser.id)

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('avatar_url, nickname')
      .eq('id', authUser.id)
      .maybeSingle()

    const avatarUrl = await uploadAvatar(authUser.id, existingProfile?.avatar_url || null)

    if (avatarUrl === false) return

    const { error } = await supabase.from('profiles').upsert({
      id: authUser.id,
      phone: fullPhone,
      nickname: profileNickname.trim() || existingProfile?.nickname || null,
      email: loginEmail,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      setProfileStatus(error.message)
      setIsSavingProfile(false)
      return
    }

    setProfilePassword('')
    await loadProfile()
    setProfileStatus(authMode === 'login' ? text.loggedIn : text.accountCreated)
    setIsSavingProfile(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    setUserId('')
    setProfile(null)
    setProfilePassword('')
    setNewPassword('')
    setIsRecoveryMode(false)
    setProfileStatus(text.loggedOut)
  }

  async function sendPasswordReset() {
    const email = (profile?.email || profileEmail).trim().toLowerCase()

    if (!email || !email.includes('@')) {
      setProfileStatus(text.resetPasswordEmailRequired)
      return
    }

    setIsResettingPassword(true)
    const redirectTo = typeof window === 'undefined' ? undefined : window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      setProfileStatus(error.message)
      setIsResettingPassword(false)
      return
    }

    setProfileStatus(text.resetPasswordSent)
    setIsResettingPassword(false)
  }

  async function updatePasswordFromRecovery() {
    if (newPassword.length < 6) {
      setProfileStatus(text.passwordRequired)
      return
    }

    setIsResettingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setProfileStatus(error.message)
      setIsResettingPassword(false)
      return
    }

    setNewPassword('')
    setProfilePassword('')
    setIsRecoveryMode(false)
    setProfileStatus(text.passwordUpdated)
    setIsResettingPassword(false)
  }

  async function loadSessions() {
    const [sessionResult, blockedResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('*, session_participants(id, profile_id, display_name, avatar_url)')
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('blocked_times').select('date, start_time, end_time, arenas_used'),
    ])

    if (sessionResult.error) {
      setCreateStatus(sessionResult.error.message)
      return
    }

    setSessions((sessionResult.data ?? []) as Session[])
    setBlockedTimes((blockedResult.data ?? []) as BlockedTime[])
  }

  useEffect(() => {
    setLanguage(detectLanguage())
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsRecoveryMode(true)
      setActiveView('profile')
      window.history.replaceState(null, '', window.location.pathname)
    }
    loadProfile()
    loadSessions()
  }, [])

  const timeOptions = useMemo(() => {
    return getAvailableTimeOptions(sessionDate, sessionDuration, sessionArenaCount)
  }, [blockedTimes, language, sessionArenaCount, sessionDate, sessionDuration, sessions])

  const editTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(editSessionDate, editSessionDuration, editSessionArenaCount, editingSessionId)
  }, [blockedTimes, editSessionArenaCount, editSessionDate, editSessionDuration, editingSessionId, language, sessions])

  function handleSessionDateChange(event: ChangeEvent<HTMLInputElement>) {
    setSessionDate(event.target.value)
    event.currentTarget.blur()
  }

  function handleMaxPlayersChange(value: number) {
    setSessionMaxPlayers(value)

    if (value < 8) {
      setSessionArenaCount(1)
    }
  }

  function handleArenaCountChange(value: number) {
    if (value === 2 && sessionMaxPlayers < 8) {
      setSessionMaxPlayers(8)
    }

    setSessionArenaCount(value)
  }

  function handleEditMaxPlayersChange(value: number) {
    setEditSessionMaxPlayers(value)

    if (value < 8) {
      setEditSessionArenaCount(1)
    }
  }

  function handleEditArenaCountChange(value: number) {
    if (value === 2 && editSessionMaxPlayers < 8) {
      setEditSessionMaxPlayers(8)
    }

    setEditSessionArenaCount(value)
  }

  function getAvailableTimeOptions(date: string, duration: number, arenaCount: number, excludeSessionId = '') {
    if (!date) return []

    const now = new Date()
    const today = localDateString(now)
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    const options: Array<{ value: string; label: string; remaining: number }> = []
    const latestStart = CLOSE_MINUTES - duration

    for (let start = OPEN_MINUTES; start <= latestStart; start += TIME_STEP_MINUTES) {
      const end = start + duration

      if (date === today && start <= nowMinutes) continue

      const activeSessionArenas = sessions
        .filter((session) => session.status === 'open' && session.date === date && session.id !== excludeSessionId)
        .filter((session) =>
          rangesOverlap(
            start,
            end,
            timeToMinutes(session.start_time),
            timeToMinutes(session.start_time) + session.duration_minutes
          )
        )
        .reduce((total, session) => total + arenasUsedBySession(session), 0)

      const activeBlockedArenas = blockedTimes
        .filter((blocked) => blocked.date === date)
        .filter((blocked) =>
          rangesOverlap(start, end, timeToMinutes(blocked.start_time), timeToMinutes(blocked.end_time))
        )
        .reduce((total, blocked) => total + blocked.arenas_used, 0)

      const remaining = ARENA_COUNT - activeSessionArenas - activeBlockedArenas

      if (remaining >= arenaCount) {
        options.push({
          value: minutesToTime(start),
          label: `${minutesToTime(start)}-${minutesToTime(end)} (${remaining} ${remaining > 1 ? text.arenasAvailable : text.arenaAvailable})`,
          remaining,
        })
      }
    }

    return options
  }

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return sessions

    return sessions.filter((session) => {
      const selectedGameNames = session.game_options
        .map((gameId) => games.find((game) => game.id === gameId)?.title || gameId)
        .join(' ')
        .toLowerCase()

      return (
        session.name.toLowerCase().includes(query) ||
        selectedGameNames.includes(query) ||
        session.invite_code?.toLowerCase() === query
      )
    })
  }, [search, sessions])

  const mySessions = useMemo(() => {
    if (!userId) return []

    return sessions.filter((session) => {
      const isOwner = session.owner_id === userId
      const isParticipant = (session.session_participants ?? []).some((participant) => participant.profile_id === userId)
      return isOwner || isParticipant
    })
  }, [sessions, userId])

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase()
    if (!query) return countries

    return countries.filter((country) =>
      `${country.code} ${country.name}`.toLowerCase().includes(query)
    )
  }, [countrySearch])

  const isAdmin = Boolean(profile?.role === 'admin' || (profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase())))

  function canManageSession(session: Session) {
    return Boolean(userId && (session.owner_id === userId || isAdmin))
  }

  async function saveProfile() {
    if (!userId) {
      setProfileStatus(text.profileLoading)
      return
    }

    const countryCode = resolveCountryCode(profileCountryCode)
    const localPhone = profilePhone.replace(/[^\d\s-]/g, '').trim()

    if (!profilePhone.trim()) {
      setProfileStatus(text.phoneRequired)
      return
    }

    setIsSavingProfile(true)
    setProfileStatus(text.savingProfile)

    const avatarUrl = await uploadAvatar(userId, profile?.avatar_url || null)

    if (avatarUrl === false) return

    const row = {
      id: userId,
      phone: `${countryCode}${localPhone.replace(/\D/g, '')}`,
      nickname: profileNickname.trim() || null,
      email: profileEmail.trim() || null,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row)
      .select('id, phone, nickname, email, avatar_url, role')
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingProfile(false)
      return
    }

    setProfile(data)
    setAvatarFile(null)
    setAvatarPreview('')
    setProfileCountryCode(`${countryCode} ${countries.find((country) => country.code === countryCode)?.name || ''}`.trim())
    setProfilePhone(localPhone)
    setProfileStatus(text.profileSaved)
    setIsSavingProfile(false)
  }

  async function uploadAvatar(ownerId: string, currentAvatarUrl: string | null) {
    if (!avatarFile) return currentAvatarUrl

    const safeName = avatarFile.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase()
    const path = `${ownerId}/${Date.now()}-${safeName}`
    const upload = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })

    if (upload.error) {
      setProfileStatus(upload.error.message)
      setIsSavingProfile(false)
      return false as const
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setAvatarFile(file)
    setAvatarPreview(file ? URL.createObjectURL(file) : '')
  }

  function toggleGame(gameId: GameId) {
    setSelectedGames((current) => {
      if (current.includes(gameId)) {
        return current.length === 1 ? current : current.filter((id) => id !== gameId)
      }
      return [...current, gameId]
    })
  }

  async function createSession() {
    if (!profile) {
      setCreateStatus(text.createProfileFirst)
      goToLogin()
      setIsCreating(false)
      return
    }

    if (!sessionName.trim() || !sessionDate || !sessionTime) {
      setCreateStatus(text.sessionRequired)
      setIsCreating(false)
      return
    }

    setIsCreating(true)
    setCreateStatus(text.creating)

    const inviteCode = sessionVisibility === 'private' ? generateInviteCode() : null

    const { data: created, error } = await supabase
      .from('sessions')
      .insert({
        owner_id: userId,
        name: sessionName.trim(),
        date: sessionDate,
        start_time: `${sessionTime}:00`,
        duration_minutes: sessionDuration,
        max_players: sessionMaxPlayers,
        arena_count: sessionArenaCount,
        game_options: selectedGames,
        game_votes: { [userId]: selectedGames[0] },
        visibility: sessionVisibility,
        invite_code: inviteCode,
        notes: sessionNotes.trim() || null,
        status: 'open',
      })
      .select('id')
      .single()

    if (error || !created) {
      setCreateStatus(error?.message || text.createError)
      setIsCreating(false)
      return
    }

    await supabase.from('session_participants').insert({
      session_id: created.id,
      profile_id: userId,
      display_name: displayName(profile),
      avatar_url: profile.avatar_url,
    })

    setCreateStatus(
      sessionVisibility === 'private'
        ? `${text.privateCreated} ${inviteCode}`
        : text.sessionCreated
    )

    setSessionName('')
    setSessionNotes('')
    setSessionTime('')
    setSessionDuration(20)
    setSessionMaxPlayers(4)
    setSessionArenaCount(1)
    setSelectedGames(['laser-tag'])
    setSessionVisibility('public')
    await loadSessions()
    setActiveView('sessions')
    setIsCreating(false)
  }

  async function joinSession(session: Session) {
    if (!profile) {
      setCreateStatus(text.createProfileFirst)
      goToLogin()
      return
    }

    if (session.visibility === 'private') {
      const typedCode = (joinCodes[session.id] || '').trim().toUpperCase()
      if (typedCode !== session.invite_code) {
        setCreateStatus(text.privateIncorrect)
        return
      }
    }

    const participants = session.session_participants ?? []
    if (participants.some((participant) => participant.profile_id === userId)) return

    if (participants.length >= session.max_players) {
      setCreateStatus(text.sessionFull)
      return
    }

    setBusySessionId(session.id)

    const { error } = await supabase.from('session_participants').insert({
      session_id: session.id,
      profile_id: userId,
      display_name: displayName(profile),
      avatar_url: profile.avatar_url,
    })

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setBusySessionId('')
    setCreateStatus(text.joinedSession)
  }

  async function leaveSession(session: Session) {
    if (!profile) {
      goToLogin()
      return
    }

    if (session.owner_id === userId) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.leaveConfirmPrefix} "${session.name}"? ${text.leaveConfirmSuffix}`)
    if (!confirmed) return

    setBusySessionId(session.id)
    const { error } = await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', session.id)
      .eq('profile_id', userId)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.leftSession)
    setBusySessionId('')
  }

  async function voteForGame(session: Session, gameId: GameId) {
    if (!profile) {
      setActiveView('profile')
      return
    }

    const voteKey = `${session.id}-${gameId}`
    setBusyVoteKey(voteKey)
    const votes = { ...(session.game_votes || {}), [userId]: gameId }
    const { error } = await supabase.from('sessions').update({ game_votes: votes }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusyVoteKey('')
      return
    }

    await loadSessions()
    setCreateStatus(text.voteSaved)
    setBusyVoteKey('')
  }

  function toggleEditGame(gameId: GameId) {
    setEditSelectedGames((current) => {
      if (current.includes(gameId)) {
        return current.length === 1 ? current : current.filter((id) => id !== gameId)
      }
      return [...current, gameId]
    })
  }

  function startEditingSession(session: Session) {
    setEditingSessionId(session.id)
    setEditSessionName(session.name)
    setEditSessionDate(session.date)
    setEditSessionTime(session.start_time.slice(0, 5))
    setEditSessionDuration(session.duration_minutes)
    setEditSessionMaxPlayers(session.max_players)
    setEditSessionArenaCount(arenasUsedBySession(session))
    setEditSessionVisibility(session.visibility)
    setEditSessionNotes(session.notes || '')
    setEditSelectedGames(session.game_options?.length ? session.game_options : ['laser-tag'])
    setCreateStatus('')
  }

  function stopEditingSession() {
    setEditingSessionId('')
    setIsUpdatingSession(false)
  }

  async function updateSession(session: Session) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyEdit)
      return
    }

    const participants = session.session_participants ?? []

    if (!editSessionName.trim() || !editSessionDate || !editSessionTime) {
      setCreateStatus(text.sessionRequired)
      return
    }

    if (editSessionMaxPlayers < participants.length) {
      setCreateStatus(text.maxPlayersBelowJoined)
      return
    }

    setIsUpdatingSession(true)
    setCreateStatus(text.savingSession)

    const inviteCode =
      editSessionVisibility === 'private'
        ? session.invite_code || generateInviteCode()
        : null

    const { error } = await supabase
      .from('sessions')
      .update({
        name: editSessionName.trim(),
        date: editSessionDate,
        start_time: `${editSessionTime}:00`,
        duration_minutes: editSessionDuration,
        max_players: editSessionMaxPlayers,
        arena_count: editSessionArenaCount,
        game_options: editSelectedGames,
        visibility: editSessionVisibility,
        invite_code: inviteCode,
        notes: editSessionNotes.trim() || null,
      })
      .eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setIsUpdatingSession(false)
      return
    }

    await loadSessions()
    setCreateStatus(editSessionVisibility === 'private' ? `${text.privateUpdated} ${inviteCode}` : text.sessionUpdated)
    stopEditingSession()
  }

  async function cancelSession(session: Session) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyCancel)
      return
    }

    const confirmed = window.confirm(`${text.cancelConfirmPrefix} "${session.name}"? ${text.cancelConfirmSuffix}`)
    if (!confirmed) return

    setBusySessionId(session.id)
    const { error } = await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', session.id)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.sessionCancelled)
    setBusySessionId('')
  }

  async function removeParticipant(session: Session, participant: Participant) {
    if (!canManageSession(session)) {
      setCreateStatus(text.creatorOnlyRemove)
      return
    }

    if (participant.profile_id === session.owner_id) {
      setCreateStatus(text.creatorCannotRemove)
      return
    }

    const confirmed = window.confirm(`${text.removeConfirmPrefix} ${participant.display_name || text.removeConfirmFallback} ${text.fromSession} "${session.name}"?`)
    if (!confirmed) return

    setBusySessionId(session.id)
    const { error } = await supabase.from('session_participants').delete().eq('id', participant.id)

    if (error) {
      setCreateStatus(error.message)
      setBusySessionId('')
      return
    }

    await loadSessions()
    setCreateStatus(text.playerRemoved)
    setBusySessionId('')
  }

  async function deleteMyAccount() {
    if (!profile || !userId) return

    const confirmed = window.confirm(text.deleteAccountConfirm)
    if (!confirmed) return

    setIsDeletingAccount(true)
    setProfileStatus(text.saving)

    const { error } = await supabase.from('profiles').delete().eq('id', userId)

    if (error) {
      setProfileStatus(error.message)
      setIsDeletingAccount(false)
      return
    }

    await supabase.auth.signOut()
    setUserId('')
    setProfile(null)
    setProfilePassword('')
    setNewPassword('')
    setProfileStatus(text.accountDeleted)
    setIsDeletingAccount(false)
    await loadSessions()
  }

  function voteCount(session: Session, gameId: GameId) {
    return Object.values(session.game_votes || {}).filter((vote) => vote === gameId).length
  }

  return (
    <div className="app">
      <aside>
        <div>
          <div className="app-title-row">
            <h1>VRena Sessions</h1>
            <button className={sharedKey === 'app' ? 'share-button copied' : 'share-button'} type="button" onClick={() => shareLink('app', 'VRena Sessions')}>
              {sharedKey === 'app' ? text.shared : text.share}
            </button>
          </div>
          <p className="muted">{text.tagline}</p>
        </div>

        <button className="profile-chip" onClick={() => setActiveView('profile')} type="button">
          <div className="avatar">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : displayName(profile).slice(0, 1)}
          </div>
          <div>
            <strong>{profile ? displayName(profile) : text.noProfile}</strong>
            <span>{profile?.phone || text.clickLogin}</span>
          </div>
        </button>

        <div className="tabs">
          <button className={activeView === 'sessions' ? 'tab active' : 'tab'} onClick={() => setActiveView('sessions')}>
            {text.sessions}
          </button>
          <button className={activeView === 'create' ? 'tab active' : 'tab'} onClick={() => (profile ? setActiveView('create') : goToLogin())}>
            {text.createSession}
          </button>
        </div>

        <div className="shop-contact">
          <strong>VRena Vietnam</strong>
          <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
          <a href="https://zalo.me/84981152315" target="_blank" rel="noreferrer">Zalo: 0981152315</a>
          <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
        </div>
      </aside>

      <main>
        {activeView === 'sessions' && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>{text.availableSessions}</h2>
                <p className="muted">{text.privateJoinHint}</p>
              </div>
              <input
                className="search"
                type="search"
                placeholder={text.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {createStatus && <p className="notice">{createStatus}</p>}

            <div className="list">
              {filteredSessions.length === 0 && <p className="notice">{text.noMatchingSessions}</p>}

              {filteredSessions.map((session) => {
                const participants = session.session_participants ?? []
                const remaining = session.max_players - participants.length
                const alreadyJoined = participants.some((participant) => participant.profile_id === userId)
                const isSessionOwner = session.owner_id === userId
                const canManage = canManageSession(session)
                const canSeeInviteCode = session.visibility === 'private' && session.invite_code && (alreadyJoined || isSessionOwner || isAdmin)
                const isEditing = editingSessionId === session.id

                return (
                  <article className="session" id={`session-${session.id}`} key={session.id}>
                    <div className="session-top">
                      <div>
                        <h3>{session.name}</h3>
                        <div className="row-meta">
                          <span>{session.date}</span>
                          <span>{session.start_time.slice(0, 5)}</span>
                          <span>{session.duration_minutes} min</span>
                          <span>{remaining} {text.seatsLeft}</span>
                        </div>
                      </div>
                      <div className="session-actions">
                        <span className={session.visibility === 'private' ? 'pill private' : 'pill ok'}>
                          {session.visibility === 'private' ? text.private : text.public}
                        </span>
                        <button
                          className={sharedKey === session.id ? 'share-button copied' : 'share-button'}
                          type="button"
                          onClick={() => shareLink(session.id, session.name, `#session-${session.id}`)}
                        >
                          {sharedKey === session.id ? text.shared : text.share}
                        </button>
                      </div>
                    </div>

                    {session.notes && <p className="notes">{session.notes}</p>}

                    {canManage && (
                      <div className="manage-row">
                        <button className="secondary small-button" type="button" onClick={() => startEditingSession(session)}>
                          {text.editSession}
                        </button>
                        <button
                          className={busySessionId === session.id ? 'danger small-button loading' : 'danger small-button'}
                          disabled={busySessionId === session.id}
                          type="button"
                          onClick={() => cancelSession(session)}
                        >
                          {text.cancelSession}
                        </button>
                      </div>
                    )}

                    {isEditing && (
                      <div className="edit-panel">
                        <div className="section-head compact-head">
                          <div>
                            <h3>{text.editSessionTitle}</h3>
                            <p className="muted">{text.editSessionHint}</p>
                          </div>
                          <div className="segmented">
                            <button className={editSessionVisibility === 'public' ? 'active' : ''} onClick={() => setEditSessionVisibility('public')} type="button">
                              {text.public}
                            </button>
                            <button className={editSessionVisibility === 'private' ? 'active' : ''} onClick={() => setEditSessionVisibility('private')} type="button">
                              {text.private}
                            </button>
                          </div>
                        </div>
                        <div className="form-grid">
                          <div className="full">
                            <label>{text.sessionName} <span className="required">*</span></label>
                            <input value={editSessionName} onChange={(event) => setEditSessionName(event.target.value)} />
                          </div>
                          <div>
                            <label>{text.date} <span className="required">*</span></label>
                            <input type="date" value={editSessionDate} onChange={(event) => setEditSessionDate(event.target.value)} />
                          </div>
                          <div>
                            <label>{text.availableTime} <span className="required">*</span></label>
                            <select value={editSessionTime} onChange={(event) => setEditSessionTime(event.target.value)}>
                              <option value="">{text.chooseTime}</option>
                              {editTimeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>{text.duration}</label>
                            <select value={editSessionDuration} onChange={(event) => setEditSessionDuration(Number(event.target.value))}>
                              {Array.from({ length: 12 }, (_, index) => (index + 1) * 20).map((duration) => (
                                <option value={duration} key={duration}>
                                  {duration} min
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>{text.maxPlayers}</label>
                            <select value={editSessionMaxPlayers} onChange={(event) => handleEditMaxPlayersChange(Number(event.target.value))}>
                              {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                                <option value={count} key={count}>
                                  {count} player{count === 1 ? '' : 's'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>{text.arenas}</label>
                            <select value={editSessionArenaCount} onChange={(event) => handleEditArenaCountChange(Number(event.target.value))}>
                              <option value={1}>{text.oneArena}</option>
                              <option value={2} disabled={editSessionMaxPlayers < 8}>
                                {text.twoArenas}
                              </option>
                            </select>
                          </div>
                          <div className="full">
                            <label>{text.gameOptions} <span className="required">*</span></label>
                            <div className="game-picker compact-games">
                              {games.map((game) => (
                                <button
                                  className={editSelectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                                  key={game.id}
                                  onClick={() => toggleEditGame(game.id)}
                                  type="button"
                                >
                                  <img src={game.image} alt="" />
                                  <span>{game.title}</span>
                                  <strong>{game.category}</strong>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="full">
                            <label>{text.notes}</label>
                            <textarea value={editSessionNotes} onChange={(event) => setEditSessionNotes(event.target.value)} />
                          </div>
                        </div>
                        <div className="action-row">
                          <button
                            className={isUpdatingSession ? 'primary loading create-button' : 'primary create-button'}
                            disabled={isUpdatingSession}
                            type="button"
                            onClick={() => updateSession(session)}
                          >
                            {isUpdatingSession ? text.saving : text.saveChanges}
                          </button>
                          <button className="secondary create-button" type="button" onClick={stopEditingSession}>
                            {text.close}
                          </button>
                        </div>
                      </div>
                    )}

                    {canSeeInviteCode && (
                      <div className="invite-code">
                        <span>{text.privateCode}</span>
                        <strong>{session.invite_code}</strong>
                        <button
                          className={copiedInviteId === session.id ? 'copied' : ''}
                          type="button"
                          onClick={() => copyInviteCode(session.id, session.invite_code)}
                        >
                          {copiedInviteId === session.id ? text.copied : text.copy}
                        </button>
                      </div>
                    )}

                    <div className="players">
                      {participants.map((participant) => (
                        <div className="player" key={participant.id} title={participant.display_name || text.player}>
                          <div className="player-avatar">
                            {participant.avatar_url ? <img src={participant.avatar_url} alt="" /> : (participant.display_name || 'P').slice(0, 1)}
                          </div>
                          <span>{participant.display_name || text.player}</span>
                          {canManage && participant.profile_id !== session.owner_id && (
                            <button
                              className="remove-player"
                              disabled={busySessionId === session.id}
                              type="button"
                              onClick={() => removeParticipant(session, participant)}
                              title={text.remove}
                            >
                              {text.remove}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="game-strip">
                      {session.game_options.map((gameId) => {
                        const game = games.find((item) => item.id === gameId)
                        if (!game) return null

                        return (
                          <button
                            className={[
                              session.game_votes?.[userId] === gameId ? 'game-card selected' : 'game-card',
                              busyVoteKey === `${session.id}-${gameId}` ? 'loading' : '',
                            ].join(' ').trim()}
                            key={gameId}
                            disabled={busyVoteKey === `${session.id}-${gameId}`}
                            onClick={() => voteForGame(session, gameId)}
                            type="button"
                          >
                            <img src={game.image} alt="" />
                            <span>{game.title}</span>
                            <strong>{voteCount(session, gameId)} {voteCount(session, gameId) === 1 ? text.vote : text.votes}</strong>
                          </button>
                        )
                      })}
                    </div>

                    <div className="join-row">
                      {session.visibility === 'private' && !alreadyJoined && (
                        <input
                          placeholder={text.privateCode}
                          value={joinCodes[session.id] || ''}
                          onChange={(event) =>
                            setJoinCodes((current) => ({ ...current, [session.id]: event.target.value.toUpperCase() }))
                          }
                        />
                      )}
                      {alreadyJoined && !isSessionOwner && (
                        <button
                          className={busySessionId === session.id ? 'secondary loading' : 'secondary'}
                          disabled={busySessionId === session.id}
                          onClick={() => leaveSession(session)}
                          type="button"
                        >
                          {text.leaveSession}
                        </button>
                      )}
                      <button
                        className={busySessionId === session.id ? 'primary loading' : 'primary'}
                        disabled={alreadyJoined || remaining <= 0 || busySessionId === session.id}
                        onClick={() => joinSession(session)}
                      >
                        {alreadyJoined ? text.joined : remaining <= 0 ? text.full : busySessionId === session.id ? text.joining : text.joinSession}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeView === 'create' && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>{text.createSessionTitle}</h2>
                <p className="muted">{text.createSessionHint}</p>
              </div>
              <div className="segmented">
                <button className={sessionVisibility === 'public' ? 'active' : ''} onClick={() => setSessionVisibility('public')} type="button">
                  {text.public}
                </button>
                <button className={sessionVisibility === 'private' ? 'active' : ''} onClick={() => setSessionVisibility('private')} type="button">
                  {text.private}
                </button>
              </div>
            </div>

            <div className="form-grid">
              <div className="full">
                <label>{text.sessionName} <span className="required">*</span></label>
                <input placeholder={text.fridayPlaceholder} value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
              </div>
              <div>
                <label>{text.date} <span className="required">*</span></label>
                <input type="date" value={sessionDate} onChange={handleSessionDateChange} />
              </div>
              <div>
                <label>{text.availableTime} <span className="required">*</span></label>
                <select value={sessionTime} onChange={(event) => setSessionTime(event.target.value)}>
                  <option value="">{text.chooseTime}</option>
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>{text.duration}</label>
                <select value={sessionDuration} onChange={(event) => setSessionDuration(Number(event.target.value))}>
                  {Array.from({ length: 12 }, (_, index) => (index + 1) * 20).map((duration) => (
                    <option value={duration} key={duration}>
                      {duration} min
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>{text.maxPlayers}</label>
                <select value={sessionMaxPlayers} onChange={(event) => handleMaxPlayersChange(Number(event.target.value))}>
                  {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => (
                    <option value={count} key={count}>
                      {count} player{count === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>{text.arenas}</label>
                <select value={sessionArenaCount} onChange={(event) => handleArenaCountChange(Number(event.target.value))}>
                  <option value={1}>{text.oneArena}</option>
                  <option value={2} disabled={sessionMaxPlayers < 8}>
                    {text.twoArenas}
                  </option>
                </select>
              </div>
              <div className="full">
                <label>{text.gameOptions} <span className="required">*</span></label>
                <div className="game-picker">
                  {games.map((game) => (
                    <button
                      className={selectedGames.includes(game.id) ? 'game-card selected' : 'game-card'}
                      key={game.id}
                      onClick={() => toggleGame(game.id)}
                      type="button"
                    >
                      <img src={game.image} alt="" />
                      <span>{game.title}</span>
                      <strong>{game.category}</strong>
                    </button>
                  ))}
                </div>
              </div>
              <div className="full">
                <label>{text.notes}</label>
                <textarea
                  placeholder={text.notesPlaceholder}
                  value={sessionNotes}
                  onChange={(event) => setSessionNotes(event.target.value)}
                />
              </div>
            </div>

            <button className={isCreating ? 'primary loading create-button' : 'primary create-button'} disabled={isCreating} onClick={createSession}>
              {isCreating ? text.creating : sessionVisibility === 'private' ? text.createPrivateSession : text.createSession}
            </button>
            {createStatus && <p className="notice">{createStatus}</p>}
          </section>
        )}

        {activeView === 'profile' && (
          <section className="section">
            <h2>{text.profile}</h2>
            <p className="muted">
              {profile
                ? text.profileUpdateHint
                : text.profileLoginHint}
            </p>

            {!profile && (
              <div className="segmented auth-toggle">
                <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')} type="button">
                  {text.logIn}
                </button>
                <button className={authMode === 'create' ? 'active' : ''} onClick={() => setAuthMode('create')} type="button">
                  {text.createAccount}
                </button>
              </div>
            )}

            <div className="form-grid profile-form">
              {(profile || authMode === 'create') && (
                <div className="profile-photo-panel">
                  <label className="profile-photo-preview">
                    {avatarPreview || profile?.avatar_url ? (
                      <img src={avatarPreview || profile?.avatar_url || ''} alt="" />
                    ) : (
                      displayName(profile).slice(0, 1)
                    )}
                    <input type="file" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                  <div>
                    <strong>{profile ? displayName(profile) : text.profilePhoto}</strong>
                    <span>{text.uploadPhoto}</span>
                  </div>
                </div>
              )}
              <div className="country-field">
                <label>{text.countryCode} <span className="required">*</span></label>
                <div className="country-picker">
                  <button
                    className="country-button"
                    onClick={() => setCountryPickerOpen((open) => !open)}
                    type="button"
                  >
                    {profileCountryCode}
                  </button>
                  {countryPickerOpen && (
                    <div className="country-menu">
                      <input
                        autoFocus
                        value={countrySearch}
                        onChange={(event) => setCountrySearch(event.target.value)}
                        placeholder={text.searchCountry}
                      />
                      <div className="country-list">
                        {filteredCountries.map((country) => (
                          <button
                            key={`${country.code}-${country.name}`}
                            onClick={() => {
                              setProfileCountryCode(country.code)
                              setCountrySearch('')
                              setCountryPickerOpen(false)
                            }}
                            type="button"
                          >
                            <span>{country.code}</span>
                            <strong>{country.name}</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="phone-field">
                <label>{text.phoneNumber} <span className="required">*</span></label>
                <input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="0981152315" />
              </div>
              <div className="email-field">
                <label>{text.email} <span className="required">*</span></label>
                <input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} placeholder="contact@vre-vietnam.com" />
              </div>
              {!profile && (
                <div className="password-field">
                  <label>{text.password} <span className="required">*</span></label>
                  <div className="password-control">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={profilePassword}
                      onChange={(event) => setProfilePassword(event.target.value)}
                      placeholder={text.passwordPlaceholder}
                    />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p className="field-help">{text.passwordHelp}</p>
                  {authMode === 'login' && (
                    <button className="link-button" disabled={isResettingPassword} onClick={sendPasswordReset} type="button">
                      {isResettingPassword ? text.saving : text.resetPassword}
                    </button>
                  )}
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
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <button className="link-button" disabled={isResettingPassword} onClick={updatePasswordFromRecovery} type="button">
                    {isResettingPassword ? text.saving : text.updatePassword}
                  </button>
                </div>
              )}
              {(profile || authMode === 'create') && (
                <div className="nickname-field">
                  <label>{text.nickname}</label>
                  <input value={profileNickname} onChange={(event) => setProfileNickname(event.target.value)} placeholder={text.optional} />
                </div>
              )}
            </div>

            <div className="action-row">
              <button
                className={isSavingProfile ? 'primary loading create-button' : 'primary create-button'}
                disabled={isSavingProfile}
                onClick={profile ? saveProfile : handleAuth}
              >
                {isSavingProfile
                  ? authMode === 'login'
                    ? text.loggingIn
                    : profile
                      ? text.saving
                      : text.creating
                  : profile
                    ? text.saveProfile
                    : authMode === 'login'
                      ? text.logIn
                      : text.createAccount}
              </button>
              {profile && (
                <button className="secondary create-button" onClick={logout} type="button">
                  {text.logOut}
                </button>
              )}
            </div>
            {profile && (
              <div className="account-links">
                <button className="link-button" disabled={isResettingPassword} onClick={sendPasswordReset} type="button">
                  {isResettingPassword ? text.saving : text.resetPassword}
                </button>
                <button className="link-button danger-link" disabled={isDeletingAccount} onClick={deleteMyAccount} type="button">
                  {isDeletingAccount ? text.saving : text.deleteAccount}
                </button>
              </div>
            )}
            {profileStatus && <p className="notice">{profileStatus}</p>}

            {profile && (
              <div className="my-sessions">
                <div>
                  <h3>{text.mySessions}</h3>
                  <p className="muted">{text.mySessionsHint}</p>
                </div>

                {mySessions.length === 0 ? (
                  <p className="notice">{text.noSessionsYet}</p>
                ) : (
                  <div className="mini-session-list">
                    {mySessions.map((session) => {
                      const participants = session.session_participants ?? []
                      const createdByMe = session.owner_id === userId
                      const joinedByMe = participants.some((participant) => participant.profile_id === userId)
                      const canSeeInviteCode = session.visibility === 'private' && session.invite_code && (createdByMe || joinedByMe)

                      return (
                        <article className="mini-session" key={session.id}>
                          <div className="mini-session-title">
                            <strong>{session.name}</strong>
                            <span className={createdByMe ? 'pill ok' : 'pill'}>
                              {createdByMe ? text.createdByYou : text.joined}
                            </span>
                          </div>
                          <div className="row-meta">
                            <span>{session.date}</span>
                            <span>{session.start_time.slice(0, 5)}</span>
                            <span>{session.duration_minutes} min</span>
                            <span>{participants.length}/{session.max_players} {text.players}</span>
                            <span>{arenasUsedBySession(session)} arena{arenasUsedBySession(session) === 1 ? '' : 's'}</span>
                          </div>
                          {canSeeInviteCode && (
                            <div className="invite-code compact">
                              <span>{text.privateCode}</span>
                              <strong>{session.invite_code}</strong>
                              <button
                                className={copiedInviteId === session.id ? 'copied' : ''}
                                type="button"
                                onClick={() => copyInviteCode(session.id, session.invite_code)}
                              >
                                {copiedInviteId === session.id ? text.copied : text.copy}
                              </button>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

      </main>

      <style jsx>{`
        :global(body) {
          margin: 0;
          background: #f6f7f9;
          color: #071112;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .app {
          height: 100vh;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          overflow: hidden;
        }

        aside {
          background: #ffffff;
          border-right: 1px solid rgba(7, 17, 18, 0.12);
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          height: 100vh;
          box-sizing: border-box;
          overflow-y: auto;
        }

        main {
          padding: 22px;
          height: 100vh;
          box-sizing: border-box;
          overflow-y: auto;
          scroll-behavior: smooth;
        }

        h1, h2, h3, p {
          margin: 0;
        }

        h1 {
          font-size: 24px;
        }

        h2 {
          font-size: 19px;
          margin-bottom: 8px;
        }

        h3 {
          font-size: 18px;
        }

        .muted {
          color: #637075;
          font-size: 13px;
          line-height: 1.4;
        }

        .section {
          background: #ffffff;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 10px 22px rgba(7, 17, 18, 0.08);
        }

        .section-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .app-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .profile-chip {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          width: 100%;
          text-align: left;
          color: #071112;
          background: #ffffff;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 10px;
          cursor: pointer;
        }

        .profile-chip:hover {
          background: #f0f4f6;
        }

        .profile-chip strong,
        .profile-chip span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .profile-chip span {
          color: #637075;
          font-size: 12px;
        }

        .field-help {
          color: #637075;
          font-size: 12px;
          line-height: 1.35;
          margin-top: 6px;
        }

        .link-button {
          display: inline-flex;
          width: fit-content;
          min-height: auto;
          margin-top: 8px;
          border: 0;
          background: transparent;
          color: #3059ff;
          padding: 0;
          font-size: 12px;
          font-weight: 800;
          text-align: left;
          text-decoration: underline;
        }

        .share-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 30px;
          border: 1px solid rgba(48, 89, 255, 0.18);
          border-radius: 999px;
          background: #f5f8ff;
          color: #3059ff;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .share-button.copied {
          border-color: rgba(13, 124, 81, 0.28);
          background: #e9f8f1;
          color: #0d7c51;
        }

        .danger-link {
          color: #b42318;
        }

        .account-links {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .my-sessions {
          display: grid;
          gap: 12px;
          border-top: 1px solid rgba(7, 17, 18, 0.12);
          margin-top: 18px;
          padding-top: 18px;
        }

        .mini-session-list {
          display: grid;
          gap: 10px;
        }

        .mini-session {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 12px;
          background: #ffffff;
        }

        .mini-session-title {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
        }

        .profile-photo-panel {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 12px;
          background: #ffffff;
        }

        .profile-photo-panel strong,
        .profile-photo-panel span {
          display: block;
        }

        .profile-photo-panel span {
          color: #637075;
          font-size: 13px;
          margin-top: 4px;
        }

        .profile-photo-preview {
          width: 78px;
          height: 78px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(135deg, #00cbd1, #3059ff);
          color: #ffffff;
          font-size: 30px;
          font-weight: 900;
          cursor: pointer;
        }

        .profile-photo-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-photo-preview input {
          display: none;
        }

        .avatar,
        .player-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(135deg, #00cbd1, #3059ff);
          color: #ffffff;
          font-weight: 800;
        }

        .avatar img,
        .player-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .shop-contact {
          display: grid;
          gap: 7px;
          margin-top: auto;
          border-top: 1px solid rgba(7, 17, 18, 0.12);
          padding-top: 16px;
          font-size: 13px;
        }

        .shop-contact strong {
          font-size: 14px;
        }

        .shop-contact a {
          color: #3059ff;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .shop-contact a:hover {
          text-decoration: underline;
        }

        .tabs {
          display: grid;
          gap: 8px;
        }

        .tab,
        .segmented button {
          text-align: left;
          background: transparent;
          color: #071112;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 10px 13px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .tab.active,
        .segmented button.active {
          background: #f0f4f6;
          border-color: rgba(7, 17, 18, 0.12);
        }

        .segmented {
          display: inline-flex;
          gap: 4px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 4px;
        }

        .auth-toggle {
          margin: 14px 0;
        }

        .search {
          max-width: 360px;
        }

        .list {
          display: grid;
          gap: 12px;
        }

        .session {
          display: grid;
          gap: 13px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 14px;
          background: #ffffff;
        }

        .session-top,
        .join-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .session-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .manage-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .edit-panel {
          display: grid;
          gap: 12px;
          border: 1px solid rgba(48, 89, 255, 0.2);
          border-radius: 8px;
          background: #f8fbff;
          padding: 12px;
        }

        .compact-head {
          margin-bottom: 0;
        }

        .row-meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          color: #637075;
          font-size: 13px;
          margin-top: 6px;
        }

        .notes {
          color: #465358;
          font-size: 13px;
        }

        .invite-code {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          border: 1px solid rgba(48, 89, 255, 0.18);
          border-radius: 8px;
          background: #f5f8ff;
          padding: 9px 10px;
          color: #465358;
          font-size: 13px;
        }

        .invite-code strong {
          color: #071112;
          font-size: 15px;
          letter-spacing: 0.08em;
        }

        .invite-code button {
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 7px;
          background: #ffffff;
          color: #071112;
          padding: 5px 9px;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .invite-code button.copied {
          border-color: rgba(13, 124, 81, 0.35);
          background: #e9f8f1;
          color: #0d7c51;
        }

        .invite-code.compact {
          padding: 7px 8px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #f0f4f6;
          color: #637075;
          white-space: nowrap;
        }

        .pill.ok {
          color: #0d7c51;
        }

        .pill.private {
          color: #b04200;
        }

        .players {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .player {
          display: inline-grid;
          grid-template-columns: 32px auto auto;
          gap: 7px;
          align-items: center;
          font-size: 13px;
          font-weight: 700;
        }

        .player-avatar {
          width: 32px;
          height: 32px;
        }

        .remove-player {
          background: #fff3f0;
          color: #b42318;
          border: 1px solid rgba(180, 35, 24, 0.22);
          padding: 4px 7px;
          font-size: 11px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .profile-form {
          grid-template-columns: 110px minmax(240px, 1fr) minmax(240px, 1fr);
        }

        .profile-form .profile-photo-panel {
          grid-column: 1 / -1;
        }

        .country-field {
          grid-column: 1;
        }

        .phone-field,
        .email-field,
        .nickname-field {
          grid-column: span 1;
        }

        .password-field {
          grid-column: 1 / span 2;
          max-width: 520px;
        }

        .full {
          grid-column: 1 / -1;
        }

        label {
          display: block;
          color: #637075;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .required {
          color: #d72638;
          font-weight: 900;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(7, 17, 18, 0.12);
          background: #f0f4f6;
          color: #071112;
          border-radius: 8px;
          padding: 10px 11px;
          font: inherit;
          outline: none;
        }

        .country-picker {
          position: relative;
        }

        .country-button {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(7, 17, 18, 0.12);
          background: #f0f4f6;
          color: #071112;
          border-radius: 8px;
          padding: 10px 11px;
          text-align: left;
          min-height: 46px;
        }

        .country-menu {
          position: absolute;
          z-index: 20;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          display: grid;
          gap: 8px;
          border: 1px solid rgba(7, 17, 18, 0.14);
          border-radius: 8px;
          padding: 8px;
          background: #ffffff;
          box-shadow: 0 14px 30px rgba(7, 17, 18, 0.16);
        }

        .country-list {
          display: grid;
          max-height: 220px;
          overflow: auto;
        }

        .country-list button {
          display: grid;
          grid-template-columns: 72px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          background: transparent;
          color: #071112;
          border-radius: 6px;
          padding: 8px;
          text-align: left;
        }

        .country-list button:hover {
          background: #f0f4f6;
        }

        .country-list span {
          color: #3059ff;
          font-weight: 800;
        }

        .password-control {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 48px;
          align-items: stretch;
        }

        .password-control input {
          border-radius: 8px 0 0 8px;
        }

        .password-control button {
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-left: 0;
          border-radius: 0 8px 8px 0;
          background: #ffffff;
          color: #071112;
          padding: 0;
          font-size: 18px;
          line-height: 1;
        }

        textarea {
          resize: vertical;
          min-height: 82px;
        }

        button {
          border: 0;
          border-radius: 8px;
          padding: 10px 13px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          background: #071112;
          color: #ffffff;
          transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease;
          transform: translateY(0) scale(1);
          will-change: transform;
        }

        button:active:not(:disabled) {
          transform: translateY(1px) scale(0.97);
          filter: brightness(0.97);
        }

        button:focus-visible {
          outline: 3px solid rgba(48, 89, 255, 0.28);
          outline-offset: 2px;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.68;
        }

        button.primary {
          background: linear-gradient(90deg, #00aeb3, #3059ff);
        }

        button.secondary {
          background: #f0f4f6;
          color: #071112;
          border: 1px solid rgba(7, 17, 18, 0.12);
        }

        button.danger {
          background: #fff3f0;
          color: #b42318;
          border: 1px solid rgba(180, 35, 24, 0.24);
        }

        .small-button {
          padding: 7px 10px;
          font-size: 12px;
        }

        .action-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .create-button {
          margin-top: 14px;
        }

        .loading {
          position: relative;
          overflow: hidden;
        }

        .loading::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
          animation: loadingSweep 1s infinite;
        }

        @keyframes loadingSweep {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }

        .notice {
          border-left: 4px solid #00aeb3;
          background: #f0f4f6;
          padding: 10px 12px;
          border-radius: 6px;
          color: #637075;
          font-size: 13px;
          margin-top: 12px;
        }

        .game-picker,
        .game-strip {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
          gap: 10px;
        }

        .game-card {
          display: grid;
          gap: 7px;
          text-align: left;
          background: #ffffff;
          color: #071112;
          border: 2px solid rgba(7, 17, 18, 0.12);
          padding: 8px;
        }

        .game-card.selected {
          border-color: #00aeb3;
          box-shadow: 0 0 0 3px rgba(0, 174, 179, 0.15);
        }

        .game-card img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 6px;
          background: #071112;
        }

        .game-card span {
          font-weight: 800;
          line-height: 1.2;
        }

        .game-card strong {
          color: #637075;
          font-size: 12px;
        }

        .compact-games {
          grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }

        .stats div {
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 12px;
        }

        .stats strong,
        .stats span {
          display: block;
        }

        .stats strong {
          font-size: 24px;
        }

        .stats span {
          color: #637075;
          font-size: 13px;
        }

        @media (max-width: 960px) {
          .app {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 100vh;
            overflow: visible;
          }

          aside {
            position: sticky;
            top: 0;
            z-index: 30;
            border-right: 0;
            border-bottom: 1px solid rgba(7, 17, 18, 0.12);
            height: auto;
            overflow: visible;
            padding: 14px;
            gap: 12px;
          }

          main {
            height: auto;
            overflow: visible;
            padding: 12px;
          }

          h1 {
            font-size: 26px;
          }

          h2 {
            font-size: 18px;
          }

          h3 {
            font-size: 20px;
          }

          .profile-chip {
            grid-template-columns: 42px minmax(0, 1fr);
            padding: 9px;
          }

          .tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
          }

          .tab {
            text-align: center;
            padding: 11px 8px;
            font-size: 14px;
          }

          .shop-contact {
            display: none;
          }

          .section {
            border-radius: 8px;
            padding: 12px;
            box-shadow: none;
          }

          .section-head,
          .join-row {
            display: grid;
          }

          .search {
            max-width: none;
          }

          .session {
            gap: 12px;
            padding: 12px;
          }

          .session-top {
            display: grid;
            gap: 10px;
          }

          .row-meta {
            gap: 6px;
          }

          .row-meta span {
            display: inline-flex;
            align-items: center;
            min-height: 26px;
            padding: 2px 8px;
            border-radius: 999px;
            background: #f0f4f6;
            font-size: 12px;
          }

          .pill {
            width: fit-content;
          }

          .players {
            gap: 8px;
          }

          .player {
            grid-template-columns: 30px minmax(0, auto) auto;
            font-size: 13px;
          }

          .manage-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .manage-row button {
            width: 100%;
          }

          .compact-head {
            gap: 10px;
          }

          .game-strip {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            padding: 2px 2px 8px;
            margin-inline: -2px;
            -webkit-overflow-scrolling: touch;
          }

          .game-strip .game-card {
            flex: 0 0 156px;
            scroll-snap-align: start;
          }

          .game-strip .game-card img {
            aspect-ratio: 1;
          }

          .game-picker {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .game-picker .game-card {
            padding: 7px;
          }

          .game-picker .game-card span,
          .game-strip .game-card span {
            font-size: 13px;
          }

          .join-row input,
          .join-row button,
          .action-row button,
          .create-button {
            width: 100%;
            min-height: 48px;
          }

          .profile-photo-panel {
            grid-template-columns: 70px minmax(0, 1fr);
            padding: 10px;
          }

          .profile-photo-preview {
            width: 62px;
            height: 62px;
            font-size: 24px;
          }

          .form-grid,
          .profile-form,
          .stats {
            grid-template-columns: 1fr;
          }

          .country-field,
          .phone-field,
          .email-field,
          .nickname-field,
          .password-field {
            grid-column: 1;
            max-width: none;
          }
        }

        @media (max-width: 520px) {
          aside {
            padding: 12px;
          }

          main {
            padding: 10px;
          }

          h1 {
            font-size: 24px;
          }

          .muted {
            font-size: 12px;
          }

          .tabs {
            position: sticky;
            top: 0;
          }

          .tab {
            font-size: 13px;
            padding: 10px 6px;
          }

          .session h3 {
            font-size: 18px;
          }

          .game-strip .game-card {
            flex-basis: 142px;
          }

          .game-card strong {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  )
}
