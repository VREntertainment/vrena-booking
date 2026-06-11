'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase/client'

const ARENA_COUNT = 2
const OPEN_MINUTES = 9 * 60
const CLOSE_MINUTES = 22 * 60
const TIME_STEP_MINUTES = 20
const ADMIN_EMAILS = ['emile@vre-vietnam.com']
const DEFAULT_APP_URL = 'https://vrena-booking.vercel.app'
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || 'a4be4d0e-2570-4642-a1a6-a44c02fa0d46'
const PRIVACY_POLICY_URL = 'https://www.vre-vietnam.com'

type HCaptchaApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    }
  ) => string
  reset: (widgetId?: string) => void
  remove?: (widgetId: string) => void
}

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
  full_name: string | null
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
  checked_in?: boolean | null
  payment_status?: 'cash' | 'bank_transfer' | 'free' | null
  score?: number | null
  accuracy_percent?: number | null
  projectiles_fired?: number | null
  placement?: number | null
}

type Session = {
  id: string
  owner_id: string
  club_id: string | null
  session_type: 'game' | 'tournament'
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

type ClubMember = {
  id: string
  club_id: string
  profile_id: string
  display_name: string | null
  avatar_url: string | null
  status: 'pending' | 'approved'
}

type Club = {
  id: string
  owner_id: string
  name: string
  description: string | null
  visibility: 'public' | 'private'
  member_count: number | null
  created_at: string
  club_members?: ClubMember[]
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
    clubs: 'Clubs',
    clubSearchPlaceholder: 'Search club name, member name, description',
    availableSessions: 'Available Game Sessions',
    privateJoinHint: 'Private sessions are listed, but joining requires the 6-character code.',
    searchPlaceholder: 'Search session name, profile name, game, private code',
    searchSessions: 'Search sessions',
    noMatchingSessions: 'No matching sessions yet.',
    noMatchingClubs: 'No matching clubs yet.',
    allDays: 'All',
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
    durationRecommend40: 'Tiny wisdom from the VR oracle: for more than 4 players, 40 min minimum is recommended so everyone gets a proper run.',
    durationRecommend60: 'Big squad detected: for more than 8 players, 60 min minimum is recommended so the fun does not get squeezed.',
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
    clubsTitle: 'Clubs',
    clubsHint: 'Create a public club or a private club with approved members only.',
    clubName: 'Club Name',
    clubDescription: 'Club Description',
    clubDescriptionPlaceholder: 'Who is this club for?',
    noClub: 'No club',
    clubOnly: 'Club members only',
    clubOnlySessionHint: 'Club mischief only: approved members can join this session.',
    clubOnlyCreateHint: 'This session is for approved club members only.',
    clubSession: 'Club session',
    normalGame: 'Game',
    tournament: 'Tournament',
    tournamentSession: 'Tournament',
    checkIn: 'Check-in',
    checkedIn: 'Checked in',
    paymentMethod: 'Payment method',
    cash: 'Cash',
    bankTransfer: 'Bank transfer',
    free: 'Free',
    clearCheckIn: 'Clear check-in',
    score: 'Score',
    accuracy: 'Accuracy %',
    projectiles: 'Shots',
    place: 'Place',
    noPlace: 'No place',
    firstPlace: '🥇 1st',
    secondPlace: '🥈 2nd',
    thirdPlace: '🥉 3rd',
    stats: 'Player stats',
    gamesCheckedIn: 'games checked in',
    wins: 'wins',
    totalScore: 'total score',
    bestPlayer: 'Leaderboard jester crowned you: current top scorer in the realm.',
    topPlayerNotice: 'Heads up: the court champion is in this session. Friendly chaos encouraged.',
    playerProfile: 'Player profile',
    bestOverall: 'Best overall',
    language: 'Language',
    expand: 'Expand',
    collapse: 'Collapse',
    formatBold: 'B',
    formatItalic: 'I',
    formatUnderline: 'U',
    formatStrike: 'S',
    bestScores: 'Best scores',
    chooseClub: 'Choose a club',
    clubMembersOnly: 'Only approved club members can join and create sessions here.',
    clubMembershipRequired: 'Only approved members of this club can create a session here.',
    openClubDetails: 'Open club details',
    nextGames: 'Next games',
    noClubGames: 'No upcoming games for this club yet.',
    createClub: 'Create Club',
    creatingClub: 'Creating club...',
    clubCreated: 'Club created.',
    clubRequired: 'Please enter a club name.',
    joinClub: 'Join Club',
    requestJoin: 'Request to Join',
    requestSent: 'Request sent.',
    approve: 'Approve',
    approved: 'Approved',
    memberApproved: 'Member approved.',
    memberRemoved: 'Member removed.',
    pending: 'Pending',
    members: 'members',
    member: 'member',
    hiddenMembers: 'Members hidden until your request is approved.',
    removeMemberConfirm: 'Remove this member from the club?',
    fridayPlaceholder: 'Friday VR squad',
    notesPlaceholder: 'Language, skill level, preferred game, special notes',
    creating: 'Creating...',
    createPrivateSession: 'Create Private Session',
    profile: 'Profile',
    profileUpdateHint: 'Update your profile details.',
    profileLoginHint: 'Log in with email and password. Phone is only needed to create an account.',
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
    captchaLabel: 'Human check',
    captchaHelp: 'One quick bot trap before the account is created.',
    captchaRequired: 'Please complete the human check first.',
    consentPrefix: 'I agree to the collection and use of my personal data according to the ',
    privacyPolicy: 'privacy policy',
    consentSuffix: '.',
    consentRequired: 'Please accept the personal data consent to create an account.',
    name: 'Name',
    nameRequired: 'Name is required.',
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
    shareApp: 'Share app',
    shared: 'Shared',
    linkCopied: 'Link copied.',
    loginToContinue: 'Please log in first.',
    loginPromptTitle: 'Tiny quest checkpoint',
    loginPromptMessage: 'You must log in first. Then the session gates open and the fun can continue.',
    loginPromptButton: 'Log in',
  },
  vi: {
    tagline: 'Tạo phiên chơi công khai hoặc riêng tư và mời người chơi khác tham gia.',
    noProfile: 'Chưa có hồ sơ',
    clickLogin: 'Bấm để đăng nhập',
    sessions: 'Phiên chơi',
    createSession: 'Tạo phiên',
    clubs: 'Câu lạc bộ',
    clubSearchPlaceholder: 'Tìm tên club, thành viên, mô tả',
    availableSessions: 'Các phiên chơi hiện có',
    privateJoinHint: 'Phiên riêng tư vẫn hiển thị, nhưng cần mã 6 ký tự để tham gia.',
    searchPlaceholder: 'Tìm tên phiên, tên hồ sơ, game, mã riêng tư',
    searchSessions: 'Tìm phiên',
    noMatchingSessions: 'Chưa có phiên phù hợp.',
    noMatchingClubs: 'Chưa có club phù hợp.',
    allDays: 'Tất cả',
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
    durationRecommend40: 'Lời nhắn nhỏ từ nhà tiên tri VR: trên 4 người nên chọn tối thiểu 40 phút để ai cũng chơi đã.',
    durationRecommend60: 'Đội hình đông rồi đó: trên 8 người nên chọn tối thiểu 60 phút để cuộc vui không bị vội.',
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
    clubsTitle: 'Câu lạc bộ',
    clubsHint: 'Tạo câu lạc bộ công khai hoặc riêng tư với thành viên cần được duyệt.',
    clubName: 'Tên câu lạc bộ',
    clubDescription: 'Mô tả câu lạc bộ',
    clubDescriptionPlaceholder: 'Câu lạc bộ này dành cho ai?',
    noClub: 'Không thuộc club',
    clubOnly: 'Chỉ thành viên club',
    clubOnlySessionHint: 'Cuộc vui riêng của club: chỉ thành viên đã duyệt mới tham gia.',
    clubOnlyCreateHint: 'Phiên này chỉ dành cho thành viên đã duyệt của club.',
    clubSession: 'Phiên của club',
    normalGame: 'Game',
    tournament: 'Giải đấu',
    tournamentSession: 'Giải đấu',
    checkIn: 'Check-in',
    checkedIn: 'Đã check-in',
    paymentMethod: 'Phương thức thanh toán',
    cash: 'Tiền mặt',
    bankTransfer: 'Chuyển khoản',
    free: 'Miễn phí',
    clearCheckIn: 'Hủy check-in',
    score: 'Điểm',
    accuracy: 'Độ chính xác %',
    projectiles: 'Lượt bắn',
    place: 'Hạng',
    noPlace: 'Chưa xếp hạng',
    firstPlace: '🥇 Hạng 1',
    secondPlace: '🥈 Hạng 2',
    thirdPlace: '🥉 Hạng 3',
    stats: 'Thống kê người chơi',
    gamesCheckedIn: 'phiên đã check-in',
    wins: 'lần thắng',
    totalScore: 'tổng điểm',
    bestPlayer: 'Hề triều đình tuyên bố: bạn đang là cao thủ điểm số của vương quốc.',
    topPlayerNotice: 'Báo nhẹ: cao thủ điểm số đang trong phiên này. Chuẩn bị tranh tài vui nhé.',
    playerProfile: 'Hồ sơ người chơi',
    bestOverall: 'Cao nhất',
    language: 'Ngôn ngữ',
    expand: 'Mở rộng',
    collapse: 'Thu gọn',
    formatBold: 'B',
    formatItalic: 'I',
    formatUnderline: 'U',
    formatStrike: 'S',
    bestScores: 'Thành tích tốt nhất',
    chooseClub: 'Chọn club',
    clubMembersOnly: 'Chỉ thành viên đã được duyệt mới có thể tham gia và tạo phiên tại club này.',
    clubMembershipRequired: 'Chỉ thành viên đã được duyệt của club này mới có thể tạo phiên.',
    openClubDetails: 'Mở chi tiết club',
    nextGames: 'Phiên sắp tới',
    noClubGames: 'Chưa có phiên sắp tới cho club này.',
    createClub: 'Tạo câu lạc bộ',
    creatingClub: 'Đang tạo câu lạc bộ...',
    clubCreated: 'Đã tạo câu lạc bộ.',
    clubRequired: 'Vui lòng nhập tên câu lạc bộ.',
    joinClub: 'Tham gia câu lạc bộ',
    requestJoin: 'Yêu cầu tham gia',
    requestSent: 'Đã gửi yêu cầu.',
    approve: 'Duyệt',
    approved: 'Đã duyệt',
    memberApproved: 'Đã duyệt thành viên.',
    memberRemoved: 'Đã xóa thành viên.',
    pending: 'Đang chờ',
    members: 'thành viên',
    member: 'thành viên',
    hiddenMembers: 'Thành viên được ẩn cho đến khi yêu cầu của bạn được duyệt.',
    removeMemberConfirm: 'Xóa thành viên này khỏi câu lạc bộ?',
    fridayPlaceholder: 'Nhóm VR tối thứ Sáu',
    notesPlaceholder: 'Ngôn ngữ, trình độ, game yêu thích, ghi chú đặc biệt',
    creating: 'Đang tạo...',
    createPrivateSession: 'Tạo phiên riêng tư',
    profile: 'Hồ sơ',
    profileUpdateHint: 'Cập nhật thông tin hồ sơ.',
    profileLoginHint: 'Đăng nhập bằng email và mật khẩu. Số điện thoại chỉ cần khi tạo tài khoản.',
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
    captchaLabel: 'Xác minh người dùng',
    captchaHelp: 'Một bước nhỏ để chặn bot trước khi tạo tài khoản.',
    captchaRequired: 'Vui lòng hoàn tất bước xác minh trước.',
    consentPrefix: 'Tôi đồng ý cho VRena thu thập và sử dụng dữ liệu cá nhân của tôi theo ',
    privacyPolicy: 'chính sách bảo mật',
    consentSuffix: '.',
    consentRequired: 'Vui lòng đồng ý với điều khoản dữ liệu cá nhân để tạo tài khoản.',
    name: 'Tên',
    nameRequired: 'Vui lòng nhập tên.',
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
    shareApp: 'Chia sẻ app',
    shared: 'Đã chia sẻ',
    linkCopied: 'Đã sao chép liên kết.',
    loginToContinue: 'Vui lòng đăng nhập trước.',
    loginPromptTitle: 'Một cửa ải nhỏ',
    loginPromptMessage: 'Bạn cần đăng nhập trước. Sau đó cánh cổng phiên chơi sẽ mở ra.',
    loginPromptButton: 'Đăng nhập',
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
  return profile.nickname || profile.full_name || profile.phone
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatDayButton(dateValue: string, language: 'en' | 'vi') {
  const date = new Date(`${dateValue}T12:00:00`)
  const locale = language === 'vi' ? 'vi-VN' : 'en-US'
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date),
    day: new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(date),
  }
}

function sessionStartDate(session: Pick<Session, 'date' | 'start_time'>) {
  return new Date(`${session.date}T${session.start_time}`)
}

function isUpcomingSession(session: Session) {
  return sessionStartDate(session).getTime() >= Date.now()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatNotesHtml(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(^|[^*])\*(?!\*)(.+?)\*/g, '$1<em>$2</em>')
}

function rankEmoji(placement?: number | null) {
  if (placement === 1) return '🥇'
  if (placement === 2) return '🥈'
  if (placement === 3) return '🥉'
  return ''
}

function appRedirectUrl() {
  if (typeof window === 'undefined') return DEFAULT_APP_URL

  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return DEFAULT_APP_URL
  }

  return window.location.origin
}

function getHCaptcha() {
  if (typeof window === 'undefined') return undefined

  return (window as unknown as { hcaptcha?: HCaptchaApi }).hcaptcha
}

export default function WidgetPage() {
  const [activeView, setActiveView] = useState<'sessions' | 'create' | 'clubs' | 'profile'>('sessions')
  const [sessions, setSessions] = useState<Session[]>([])
  const [clubs, setClubs] = useState<Club[]>([])
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedSessionDate, setSelectedSessionDate] = useState('')
  const [clubSearch, setClubSearch] = useState('')
  const [isClubSearchOpen, setIsClubSearchOpen] = useState(false)
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({})

  const [authMode, setAuthMode] = useState<'login' | 'create'>('login')
  const [profileCountryCode, setProfileCountryCode] = useState('+84')
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileNickname, setProfileNickname] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [personalDataConsent, setPersonalDataConsent] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [profileStatus, setProfileStatus] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [loginPromptOpen, setLoginPromptOpen] = useState(false)

  const [sessionVisibility, setSessionVisibility] = useState<'public' | 'private'>('public')
  const [sessionType, setSessionType] = useState<'game' | 'tournament'>('game')
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState(localDateString())
  const [sessionTime, setSessionTime] = useState('')
  const [sessionDuration, setSessionDuration] = useState(20)
  const [sessionMaxPlayers, setSessionMaxPlayers] = useState(4)
  const [sessionArenaCount, setSessionArenaCount] = useState(1)
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionClubId, setSessionClubId] = useState('')
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
  const [clubVisibility, setClubVisibility] = useState<'public' | 'private'>('public')
  const [clubName, setClubName] = useState('')
  const [clubDescription, setClubDescription] = useState('')
  const [clubStatus, setClubStatus] = useState('')
  const [isCreatingClub, setIsCreatingClub] = useState(false)
  const [busyClubId, setBusyClubId] = useState('')
  const [selectedClubId, setSelectedClubId] = useState('')
  const [selectedClubDate, setSelectedClubDate] = useState('')
  const [drawerTouchStart, setDrawerTouchStart] = useState<number | null>(null)
  const [checkInTarget, setCheckInTarget] = useState<{ sessionId: string; participantId: string } | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [championNoticeSessionId, setChampionNoticeSessionId] = useState('')
  const [language, setLanguage] = useState<'en' | 'vi'>('en')
  const searchShellRef = useRef<HTMLDivElement | null>(null)
  const dayStripRef = useRef<HTMLDivElement | null>(null)
  const clubSearchShellRef = useRef<HTMLDivElement | null>(null)
  const captchaContainerRef = useRef<HTMLDivElement | null>(null)
  const captchaWidgetId = useRef<string | null>(null)
  const text = uiText[language]
  const showProfileFields = Boolean(profile || authMode === 'create')

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
    setLoginPromptOpen(false)
  }

  function promptLogin() {
    setLoginPromptOpen(true)
    setProfileStatus(text.loginToContinue)
  }

  function requireProfile() {
    if (profile) return true

    promptLogin()
    return false
  }

  function openSessionFromProfile(sessionId: string) {
    setSearch('')
    setActiveView('sessions')
    window.setTimeout(() => {
      document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  function resetCaptcha() {
    setCaptchaToken('')

    const hcaptcha = getHCaptcha()

    if (hcaptcha && captchaWidgetId.current) {
      hcaptcha.reset(captchaWidgetId.current)
    }
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
      .select('id, phone, full_name, nickname, email, avatar_url, role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileRow) {
      const phoneParts = splitPhoneNumber(profileRow.phone || '')
      setProfile(profileRow)
      setProfileCountryCode(phoneParts.countryInput)
      setProfilePhone(phoneParts.localPhone)
      setProfileName(profileRow.full_name || '')
      setProfileNickname(profileRow.nickname || '')
      setProfileEmail(profileRow.email || '')
    }
  }

  async function handleAuth() {
    const countryCode = resolveCountryCode(profileCountryCode)
    const localPhone = profilePhone.replace(/\D/g, '')
    const fullPhone = `${countryCode}${localPhone}`
    const loginEmail = profileEmail.trim().toLowerCase()
    const fullName = profileName.trim()

    if (authMode === 'create' && fullPhone.length < 8) {
      setProfileStatus(text.phoneRequired)
      return
    }

    if (authMode === 'create' && !fullName) {
      setProfileStatus(text.nameRequired)
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

    if (authMode === 'create' && !personalDataConsent) {
      setProfileStatus(text.consentRequired)
      return
    }

    if (!captchaToken) {
      setProfileStatus(text.captchaRequired)
      return
    }

    setIsSavingProfile(true)
    setProfileStatus(authMode === 'login' ? text.loggingIn : text.creating)

    if (authMode === 'create') {
      const nickname = profileNickname.trim()
      const display = nickname || fullName
      const consentAt = new Date().toISOString()
      const signUpResult = await supabase.auth.signUp({
        email: loginEmail,
        password: profilePassword,
        options: {
          data: {
            display_name: display,
            full_name: fullName,
            name: display,
            nickname: nickname || null,
            phone: fullPhone,
            personal_data_consent: personalDataConsent,
            personal_data_consent_at: consentAt,
            privacy_policy_url: PRIVACY_POLICY_URL,
          },
          captchaToken,
        },
      })

      if (signUpResult.error) {
        resetCaptcha()
        setProfileStatus(signUpResult.error.message)
        setIsSavingProfile(false)
        return
      }

      const authUser = signUpResult.data.user

      if (!authUser) {
        resetCaptcha()
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

      if (avatarUrl === false) {
        resetCaptcha()
        return
      }

      const { error } = await supabase.from('profiles').upsert({
        id: authUser.id,
        full_name: fullName,
        phone: fullPhone,
        nickname: nickname || existingProfile?.nickname || null,
        email: loginEmail,
        avatar_url: avatarUrl,
        personal_data_consent: personalDataConsent,
        personal_data_consent_at: consentAt,
        privacy_policy_url: PRIVACY_POLICY_URL,
        updated_at: new Date().toISOString(),
      })

      if (error) {
        resetCaptcha()
        setProfileStatus(error.message)
        setIsSavingProfile(false)
        return
      }

      const metadataUpdate = await supabase.auth.updateUser({
        data: {
          display_name: display,
          full_name: fullName,
          name: display,
          nickname: nickname || null,
          phone: fullPhone,
          avatar_url: avatarUrl,
          personal_data_consent: personalDataConsent,
          personal_data_consent_at: consentAt,
          privacy_policy_url: PRIVACY_POLICY_URL,
        },
      })

      if (metadataUpdate.error) {
        resetCaptcha()
        setProfileStatus(metadataUpdate.error.message)
        setIsSavingProfile(false)
        return
      }

      resetCaptcha()
      setProfilePassword('')
      setPersonalDataConsent(false)
      await loadProfile()
      setProfileStatus(text.accountCreated)
      setActiveView('sessions')
      setIsSavingProfile(false)
      return
    }

    const signInResult = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: profilePassword,
      options: {
        captchaToken,
      },
    })

    resetCaptcha()

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
    setProfilePassword('')
    await loadProfile()
    setProfileStatus(text.loggedIn)
    setActiveView('sessions')
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

    if (!profile && !captchaToken) {
      setProfileStatus(text.captchaRequired)
      return
    }

    setIsResettingPassword(true)
    const redirectTo = appRedirectUrl()
    const resetOptions = {
      redirectTo,
      captchaToken: captchaToken || undefined,
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, resetOptions)

    resetCaptcha()

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
        .select('*, session_participants(id, profile_id, display_name, avatar_url, checked_in, payment_status, score, accuracy_percent, projectiles_fired, placement)')
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

  async function loadClubs() {
    const { data, error } = await supabase
      .from('clubs')
      .select('*, club_members(id, club_id, profile_id, display_name, avatar_url, status)')
      .order('created_at', { ascending: false })

    if (error) {
      setClubStatus(error.message)
      return
    }

    setClubs((data ?? []) as Club[])
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
    loadClubs()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('vrena-live-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants' }, () => loadSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, () => loadClubs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_members' }, () => loadClubs())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || profile || activeView !== 'profile') return

    let cancelled = false

    function renderCaptcha() {
      const hcaptcha = getHCaptcha()

      if (cancelled || !captchaContainerRef.current || !hcaptcha || captchaWidgetId.current) return

      captchaWidgetId.current = hcaptcha.render(captchaContainerRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      })
    }

    const existingScript = document.getElementById('hcaptcha-script') as HTMLScriptElement | null

    if (getHCaptcha()) {
      renderCaptcha()
    } else if (existingScript) {
      existingScript.addEventListener('load', renderCaptcha, { once: true })
    } else {
      const script = document.createElement('script')
      script.id = 'hcaptcha-script'
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.addEventListener('load', renderCaptcha, { once: true })
      document.body.appendChild(script)
    }

    return () => {
      cancelled = true
      setCaptchaToken('')

      const hcaptcha = getHCaptcha()

      if (hcaptcha && captchaWidgetId.current) {
        try {
          hcaptcha.remove?.(captchaWidgetId.current)
        } catch {
          hcaptcha.reset(captchaWidgetId.current)
        }
      }

      captchaWidgetId.current = null
    }
  }, [activeView, authMode, profile])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isSearchOpen && !search && !selectedSessionDate && !isClubSearchOpen && !clubSearch) return

    function closeSearchOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node
      const clickedSearch = searchShellRef.current?.contains(target)
      const clickedCalendar = dayStripRef.current?.contains(target)
      const clickedClubSearch = clubSearchShellRef.current?.contains(target)

      if (clickedSearch || clickedCalendar || clickedClubSearch) return

      if (isSearchOpen || search || selectedSessionDate) {
        setSearch('')
        setSelectedSessionDate('')
        setIsSearchOpen(false)
      }

      if (isClubSearchOpen || clubSearch) {
        setClubSearch('')
        setIsClubSearchOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeSearchOnOutsideClick)

    return () => {
      document.removeEventListener('pointerdown', closeSearchOnOutsideClick)
    }
  }, [clubSearch, isClubSearchOpen, isSearchOpen, search, selectedSessionDate])

  const timeOptions = useMemo(() => {
    return getAvailableTimeOptions(sessionDate, sessionDuration, sessionArenaCount)
  }, [blockedTimes, language, sessionArenaCount, sessionDate, sessionDuration, sessions])

  const editTimeOptions = useMemo(() => {
    return getAvailableTimeOptions(editSessionDate, editSessionDuration, editSessionArenaCount, editingSessionId)
  }, [blockedTimes, editSessionArenaCount, editSessionDate, editSessionDuration, editingSessionId, language, sessions])

  const sessionDurationRecommendation = durationRecommendation(sessionMaxPlayers, sessionDuration)
  const editSessionDurationRecommendation = durationRecommendation(editSessionMaxPlayers, editSessionDuration)

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

  function durationRecommendation(maxPlayers: number, duration: number) {
    if (maxPlayers > 8 && duration < 60) return text.durationRecommend60
    if (maxPlayers > 4 && duration < 40) return text.durationRecommend40
    return ''
  }

  function handleSessionClubChange(value: string) {
    setSessionClubId(value)
    if (value) {
      setSessionVisibility('public')
      setCreateStatus(text.clubOnlyCreateHint)
    } else if (createStatus === text.clubOnlyCreateHint) {
      setCreateStatus('')
    }
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
    const query = normalizeSearchValue(search)

    return sessions.filter((session) => {
      if (!isUpcomingSession(session)) return false
      if (selectedSessionDate && session.date !== selectedSessionDate) return false
      if (!query) return true

      const selectedGameNames = session.game_options
        .map((gameId) => games.find((game) => game.id === gameId)?.title || gameId)
        .join(' ')
      const profileNames = (session.session_participants ?? [])
        .map((participant) => participant.display_name || '')
        .join(' ')
      const haystack = normalizeSearchValue([
        session.name,
        profileNames,
        selectedGameNames,
        session.invite_code || '',
      ].join(' '))

      return haystack.includes(query)
    })
  }, [search, selectedSessionDate, sessions])

  const filteredClubs = useMemo(() => {
    const query = normalizeSearchValue(clubSearch)
    if (!query) return clubs

    return clubs.filter((club) => {
      const memberNames = (club.club_members ?? [])
        .map((member) => member.display_name || '')
        .join(' ')
      const haystack = normalizeSearchValue([
        club.name,
        club.description || '',
        club.visibility,
        memberNames,
      ].join(' '))

      return haystack.includes(query)
    })
  }, [clubSearch, clubs])

  const sessionDayOptions = useMemo(() => {
    const today = new Date()
    const upcomingDays = Array.from({ length: 14 }, (_, index) => {
      const value = localDateString(addDays(today, index))
      return { value, ...formatDayButton(value, language) }
    })
    const sessionDays = sessions.filter(isUpcomingSession).map((session) => session.date)
    const uniqueDays = Array.from(new Set([...upcomingDays.map((day) => day.value), ...sessionDays])).sort()

    return uniqueDays.map((value) => {
      const existing = upcomingDays.find((day) => day.value === value)
      return existing || { value, ...formatDayButton(value, language) }
    })
  }, [language, sessions])

  const mySessions = useMemo(() => {
    if (!userId) return []

    return sessions.filter((session) => {
      const isOwner = session.owner_id === userId
      const isParticipant = (session.session_participants ?? []).some((participant) => participant.profile_id === userId)
      return isOwner || isParticipant
    })
  }, [sessions, userId])

  const sessionClubOptions = useMemo(() => {
    if (!userId) return []

    return clubs.filter((club) => club.owner_id === userId || (club.club_members ?? []).some((member) => member.profile_id === userId && member.status === 'approved'))
  }, [clubs, userId])

  const selectedClub = useMemo(() => {
    return clubs.find((club) => club.id === selectedClubId)
  }, [clubs, selectedClubId])

  const selectedClubMembership = useMemo(() => {
    if (!selectedClub) return undefined
    return (selectedClub.club_members ?? []).find((member) => member.profile_id === userId)
  }, [selectedClub, userId])

  const selectedClubSessions = useMemo(() => {
    if (!selectedClubId) return []
    return sessions.filter((session) => session.club_id === selectedClubId && isUpcomingSession(session))
  }, [selectedClubId, sessions])

  const selectedClubDayOptions = useMemo(() => {
    const uniqueDays = Array.from(new Set(selectedClubSessions.map((session) => session.date))).sort()
    return uniqueDays.map((value) => ({ value, ...formatDayButton(value, language) }))
  }, [language, selectedClubSessions])

  const filteredSelectedClubSessions = useMemo(() => {
    if (!selectedClubDate) return selectedClubSessions
    return selectedClubSessions.filter((session) => session.date === selectedClubDate)
  }, [selectedClubDate, selectedClubSessions])

  const checkInSession = useMemo(() => {
    if (!checkInTarget) return undefined
    return sessions.find((session) => session.id === checkInTarget.sessionId)
  }, [checkInTarget, sessions])

  const checkInParticipant = useMemo(() => {
    if (!checkInTarget || !checkInSession) return undefined
    return (checkInSession.session_participants ?? []).find((participant) => participant.id === checkInTarget.participantId)
  }, [checkInSession, checkInTarget])

  const allPlayerStats = useMemo(() => {
    const stats = new Map<string, {
      profileId: string
      displayName: string
      avatarUrl: string | null
      gamesJoined: number
      wins: number
      totalScore: number
      totalAccuracy: number
      accuracyCount: number
      totalProjectiles: number
      bestByGame: Map<string, number>
    }>()

    sessions.forEach((session) => {
      ;(session.session_participants ?? []).forEach((participant) => {
        if (!participant.checked_in) return

        const current = stats.get(participant.profile_id) ?? {
          profileId: participant.profile_id,
          displayName: participant.display_name || text.player,
          avatarUrl: participant.avatar_url,
          gamesJoined: 0,
          wins: 0,
          totalScore: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          bestByGame: new Map<string, number>(),
        }

        current.displayName = participant.display_name || current.displayName
        current.avatarUrl = participant.avatar_url || current.avatarUrl
        current.gamesJoined += 1
        if (participant.placement === 1) current.wins += 1

        const numericScore = Number(participant.score)
        if (Number.isFinite(numericScore)) {
          current.totalScore += numericScore

          session.game_options.forEach((gameId) => {
            const game = games.find((item) => item.id === gameId)
            const previous = current.bestByGame.get(gameId)
            const isEscape = game?.category === 'Escape'

            if (previous === undefined || (isEscape ? numericScore < previous : numericScore > previous)) {
              current.bestByGame.set(gameId, numericScore)
            }
          })
        }

        const accuracy = Number(participant.accuracy_percent)
        if (Number.isFinite(accuracy)) {
          current.totalAccuracy += accuracy
          current.accuracyCount += 1
        }

        const projectiles = Number(participant.projectiles_fired)
        if (Number.isFinite(projectiles)) {
          current.totalProjectiles += projectiles
        }

        stats.set(participant.profile_id, current)
      })
    })

    return Array.from(stats.values())
      .map((item) => ({
        ...item,
        averageAccuracy: item.accuracyCount > 0 ? Math.round(item.totalAccuracy / item.accuracyCount) : null,
        bestByGame: Array.from(item.bestByGame.entries()).map(([gameId, score]) => ({
          game: games.find((game) => game.id === gameId)?.title || gameId,
          score,
        })),
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
  }, [sessions, text.player])

  const playerStats = allPlayerStats.find((item) => item.profileId === userId) ?? {
    profileId: userId,
    displayName: displayName(profile),
    avatarUrl: profile?.avatar_url || null,
    gamesJoined: 0,
    wins: 0,
    totalScore: 0,
    totalAccuracy: 0,
    accuracyCount: 0,
    totalProjectiles: 0,
    averageAccuracy: null,
    bestByGame: [],
  }

  const topPlayer = allPlayerStats[0]
  const selectedPlayerStats = allPlayerStats.find((item) => item.profileId === selectedPlayerId)
  const selectedPlayerProfile = useMemo(() => {
    if (!selectedPlayerId) return undefined
    if (selectedPlayerStats) return selectedPlayerStats

    for (const session of sessions) {
      const participant = (session.session_participants ?? []).find((item) => item.profile_id === selectedPlayerId)
      if (participant) {
        return {
          profileId: participant.profile_id,
          displayName: participant.display_name || text.player,
          avatarUrl: participant.avatar_url,
          gamesJoined: 0,
          wins: 0,
          totalScore: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          averageAccuracy: null,
          bestByGame: [],
        }
      }
    }

    for (const club of clubs) {
      const member = (club.club_members ?? []).find((item) => item.profile_id === selectedPlayerId)
      if (member) {
        return {
          profileId: member.profile_id,
          displayName: member.display_name || text.player,
          avatarUrl: member.avatar_url,
          gamesJoined: 0,
          wins: 0,
          totalScore: 0,
          totalAccuracy: 0,
          accuracyCount: 0,
          totalProjectiles: 0,
          averageAccuracy: null,
          bestByGame: [],
        }
      }
    }

    return undefined
  }, [clubs, selectedPlayerId, selectedPlayerStats, sessions, text.player])

  useEffect(() => {
    if (!profile || !topPlayer || topPlayer.profileId === userId || activeView !== 'sessions') return

    const championSession = filteredSessions.find((session) =>
      (session.session_participants ?? []).some((participant) => participant.profile_id === topPlayer.profileId)
    )

    if (!championSession || championNoticeSessionId === championSession.id) return

    setChampionNoticeSessionId(championSession.id)
    setCreateStatus(text.topPlayerNotice)
  }, [activeView, championNoticeSessionId, filteredSessions, profile, text.topPlayerNotice, topPlayer, userId])

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

  function canManageClub(club: Club) {
    return Boolean(userId && (club.owner_id === userId || isAdmin))
  }

  function approvedClubMember(club: Club, profileId = userId) {
    return (club.club_members ?? []).some((member) => member.profile_id === profileId && member.status === 'approved')
  }

  function canSeeClubPrivateData(club: Club | undefined) {
    if (!club) return true
    return club.visibility === 'public' || canManageClub(club) || approvedClubMember(club)
  }

  function canCreateClubSession(club: Club | undefined) {
    if (!club) return false
    return canManageClub(club) || approvedClubMember(club)
  }

  function clubMemberCount(club: Club) {
    return club.member_count ?? (club.club_members ?? []).filter((member) => member.status === 'approved').length
  }

  async function createClub() {
    if (!requireProfile()) return

    const activeProfile = profile
    const name = clubName.trim()

    if (!activeProfile) return

    if (!name) {
      setClubStatus(text.clubRequired)
      return
    }

    setIsCreatingClub(true)
    setClubStatus(text.creatingClub)

    const { data: club, error } = await supabase
      .from('clubs')
      .insert({
        owner_id: userId,
        name,
        description: clubDescription.trim() || null,
        visibility: clubVisibility,
      })
      .select('id')
      .single()

    if (error || !club) {
      setClubStatus(error?.message || text.createError)
      setIsCreatingClub(false)
      return
    }

    const memberResult = await supabase.from('club_members').insert({
      club_id: club.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      avatar_url: activeProfile.avatar_url,
      status: 'approved',
    })

    if (memberResult.error) {
      setClubStatus(memberResult.error.message)
      setIsCreatingClub(false)
      return
    }

    setClubName('')
    setClubDescription('')
    setClubVisibility('public')
    await loadClubs()
    setClubStatus(text.clubCreated)
    setIsCreatingClub(false)
  }

  async function joinClub(club: Club) {
    if (!requireProfile()) return

    const activeProfile = profile
    if (!activeProfile) return

    const currentMembership = (club.club_members ?? []).find((member) => member.profile_id === userId)
    if (currentMembership) return

    setBusyClubId(club.id)
    const { error } = await supabase.from('club_members').insert({
      club_id: club.id,
      profile_id: userId,
      display_name: displayName(activeProfile),
      avatar_url: activeProfile.avatar_url,
      status: club.visibility === 'private' ? 'pending' : 'approved',
    })

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(club.visibility === 'private' ? text.requestSent : text.joinedSession)
    setBusyClubId('')
  }

  async function approveClubMember(member: ClubMember) {
    setBusyClubId(member.club_id)
    const { error } = await supabase.from('club_members').update({ status: 'approved' }).eq('id', member.id)

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(text.memberApproved)
    setBusyClubId('')
  }

  async function removeClubMember(club: Club, member: ClubMember) {
    if (!canManageClub(club)) return

    if (!window.confirm(text.removeMemberConfirm)) return

    setBusyClubId(club.id)
    const { error } = await supabase.from('club_members').delete().eq('id', member.id)

    if (error) {
      setClubStatus(error.message)
      setBusyClubId('')
      return
    }

    await loadClubs()
    setClubStatus(text.memberRemoved)
    setBusyClubId('')
  }

  async function updateParticipantCheckIn(participantId: string, paymentStatus: 'cash' | 'bank_transfer' | 'free' | null) {
    const { error } = await supabase
      .from('session_participants')
      .update({
        checked_in: Boolean(paymentStatus),
        payment_status: paymentStatus,
        checked_in_at: paymentStatus ? new Date().toISOString() : null,
      })
      .eq('id', participantId)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    setCheckInTarget(null)
    await loadSessions()
  }

  async function updateParticipantResult(
    participantId: string,
    scoreValue: string | number | null,
    placementValue: string | number | null,
    accuracyValue: string | number | null,
    projectilesValue: string | number | null
  ) {
    const score = scoreValue === '' || scoreValue === null ? null : Number(scoreValue)
    const placement = placementValue === '' || placementValue === null ? null : Number(placementValue)
    const accuracy = accuracyValue === '' || accuracyValue === null ? null : Number(accuracyValue)
    const projectiles = projectilesValue === '' || projectilesValue === null ? null : Number(projectilesValue)

    const { error } = await supabase
      .from('session_participants')
      .update({
        score: Number.isFinite(score as number) ? score : null,
        accuracy_percent: Number.isFinite(accuracy as number) ? accuracy : null,
        projectiles_fired: Number.isFinite(projectiles as number) ? projectiles : null,
        placement: Number.isFinite(placement as number) ? placement : null,
      })
      .eq('id', participantId)

    if (error) {
      setCreateStatus(error.message)
      return
    }

    await loadSessions()
  }

  async function saveProfile() {
    if (!userId) {
      setProfileStatus(text.profileLoading)
      return
    }

    const countryCode = resolveCountryCode(profileCountryCode)
    const localPhone = profilePhone.replace(/[^\d\s-]/g, '').trim()
    const fullName = profileName.trim()
    const nickname = profileNickname.trim()

    if (!profilePhone.trim()) {
      setProfileStatus(text.phoneRequired)
      return
    }

    if (!fullName) {
      setProfileStatus(text.nameRequired)
      return
    }

    setIsSavingProfile(true)
    setProfileStatus(text.savingProfile)

    const avatarUrl = await uploadAvatar(userId, profile?.avatar_url || null)

    if (avatarUrl === false) return

    const row = {
      id: userId,
      full_name: fullName,
      phone: `${countryCode}${localPhone.replace(/\D/g, '')}`,
      nickname: nickname || null,
      email: profileEmail.trim() || null,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(row)
      .select('id, phone, full_name, nickname, email, avatar_url, role')
      .single()

    if (error) {
      setProfileStatus(error.message)
      setIsSavingProfile(false)
      return
    }

    const display = nickname || fullName
    const metadataUpdate = await supabase.auth.updateUser({
      data: {
        display_name: display,
        full_name: fullName,
        name: display,
        nickname: nickname || null,
        phone: data.phone,
        avatar_url: data.avatar_url,
      },
    })

    if (metadataUpdate.error) {
      setProfileStatus(metadataUpdate.error.message)
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

  function wrapTextFormat(value: string, setter: (value: string) => void, markerStart: string, markerEnd = markerStart) {
    setter(`${value}${value ? '\n' : ''}${markerStart}${text.notes}${markerEnd}`)
  }

  async function createSession() {
    if (!requireProfile()) {
      setIsCreating(false)
      return
    }

    const activeProfile = profile

    if (!activeProfile) {
      setIsCreating(false)
      return
    }

    if (!sessionName.trim() || !sessionDate || !sessionTime) {
      setCreateStatus(text.sessionRequired)
      setIsCreating(false)
      return
    }

    const selectedSessionClub = sessionClubId ? clubs.find((club) => club.id === sessionClubId) : undefined

    if (selectedSessionClub && !canCreateClubSession(selectedSessionClub)) {
      setCreateStatus(text.clubMembershipRequired)
      setIsCreating(false)
      return
    }

    setIsCreating(true)
    setCreateStatus(text.creating)

    const effectiveVisibility = selectedSessionClub ? 'public' : sessionVisibility
    const inviteCode = effectiveVisibility === 'private' ? generateInviteCode() : null

    const { data: created, error } = await supabase
      .from('sessions')
      .insert({
        owner_id: userId,
        club_id: sessionClubId || null,
        session_type: sessionType,
        name: sessionName.trim(),
        date: sessionDate,
        start_time: `${sessionTime}:00`,
        duration_minutes: sessionDuration,
        max_players: sessionMaxPlayers,
        arena_count: sessionArenaCount,
        game_options: selectedGames,
        game_votes: { [userId]: selectedGames[0] },
        visibility: effectiveVisibility,
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
      display_name: displayName(activeProfile),
      avatar_url: activeProfile.avatar_url,
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
    setSessionClubId('')
    setSessionType('game')
    setSelectedGames(['laser-tag'])
    setSessionVisibility('public')
    await loadSessions()
    setActiveView('sessions')
    setIsCreating(false)
  }

  async function joinSession(session: Session) {
    if (!requireProfile()) return

    const activeProfile = profile

    if (!activeProfile) return

    const sessionClub = session.club_id ? clubs.find((club) => club.id === session.club_id) : undefined
    if (sessionClub && !approvedClubMember(sessionClub)) {
      setCreateStatus(text.clubMembershipRequired)
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
      display_name: displayName(activeProfile),
      avatar_url: activeProfile.avatar_url,
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
    if (!requireProfile()) return

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
    if (!requireProfile()) return

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

    const effectiveEditVisibility = session.club_id ? 'public' : editSessionVisibility
    const inviteCode =
      effectiveEditVisibility === 'private'
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
        visibility: effectiveEditVisibility,
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
    setCreateStatus(effectiveEditVisibility === 'private' ? `${text.privateUpdated} ${inviteCode}` : text.sessionUpdated)
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
            <picture className="brand-logo">
              <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-logo-full-dark.svg" />
              <img src="/brand/vrena-logo-full-light.svg" alt="VRena" />
            </picture>
            <div className="language-picker">
              <button type="button" onClick={() => setLanguagePickerOpen((open) => !open)}>
                {language.toUpperCase()}
              </button>
              {languagePickerOpen && (
                <div className="language-menu">
                  {(['en', 'vi'] as const).filter((item) => item !== language).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setLanguage(item)
                        setLanguagePickerOpen(false)
                      }}
                    >
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className={sharedKey === 'app' ? 'share-button app-share copied' : 'share-button app-share'} type="button" onClick={() => shareLink('app', 'VRena Sessions')}>
              {sharedKey === 'app' ? text.shared : text.shareApp}
            </button>
          </div>
          <h1 className="sr-only">VRena Sessions</h1>
          <p className="muted">{text.tagline}</p>
        </div>

        <button className="profile-chip" onClick={() => setActiveView('profile')} type="button">
          <div className="avatar">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : displayName(profile).slice(0, 1)}
            {topPlayer?.profileId === userId && <span className="champion-badge">🏆</span>}
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
          <button className={activeView === 'create' ? 'tab active' : 'tab'} onClick={() => (profile ? setActiveView('create') : promptLogin())}>
            {text.createSession}
          </button>
          <button className={activeView === 'clubs' ? 'tab active' : 'tab'} onClick={() => (profile ? setActiveView('clubs') : promptLogin())}>
            {text.clubs}
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
              <div className="section-copy">
                <h2>{text.availableSessions}</h2>
                <p className="muted">{text.privateJoinHint}</p>
              </div>
              <div className={isSearchOpen ? 'search-shell open' : 'search-shell'} ref={searchShellRef}>
                <button
                  aria-label={text.searchSessions}
                  className="mobile-search-toggle"
                  type="button"
                  onClick={() => setIsSearchOpen((open) => !open)}
                >
                  🔎
                </button>
                <input
                  className="search"
                  type="search"
                  placeholder={text.searchPlaceholder}
                  value={search}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {(isSearchOpen || search || selectedSessionDate) && (
                  <button
                    aria-label={text.close}
                    className="search-close"
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setSelectedSessionDate('')
                      setIsSearchOpen(false)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            {(isSearchOpen || search || selectedSessionDate) && (
              <div className="day-strip" aria-label={text.date} ref={dayStripRef}>
                <button
                  className={!selectedSessionDate ? 'day-chip active' : 'day-chip'}
                  type="button"
                  onClick={() => setSelectedSessionDate('')}
                >
                  <strong>{text.allDays}</strong>
                </button>
                {sessionDayOptions.map((day) => (
                  <button
                    className={selectedSessionDate === day.value ? 'day-chip active' : 'day-chip'}
                    key={day.value}
                    type="button"
                    onClick={() => setSelectedSessionDate(day.value)}
                  >
                    <span>{day.weekday}</span>
                    <strong>{day.day}</strong>
                  </button>
                ))}
              </div>
            )}
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
                const sessionClub = session.club_id ? clubs.find((club) => club.id === session.club_id) : undefined
                const canSeeSessionPlayers = canSeeClubPrivateData(sessionClub)

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
                          {sessionClub && <span className="pill">{text.clubSession}: {sessionClub.name}</span>}
                          {session.session_type === 'tournament' && <span className="pill private">{text.tournament}</span>}
                        </div>
                      </div>
                      <div className="session-actions">
                        <span className={session.visibility === 'private' ? 'pill private' : 'pill ok'}>
                          {session.visibility === 'private' ? text.private : text.public}
                        </span>
                      </div>
                    </div>

                    {session.notes && (
                      <div className={expandedNotes[session.id] ? 'notes-block expanded' : 'notes-block'}>
                        <div
                          className="notes"
                          dangerouslySetInnerHTML={{ __html: formatNotesHtml(session.notes) }}
                        />
                        <button
                          className="expand-note"
                          type="button"
                          onClick={() => setExpandedNotes((current) => ({ ...current, [session.id]: !current[session.id] }))}
                        >
                          {expandedNotes[session.id] ? `⌃ ${text.collapse}` : `⌄ ${text.expand}`}
                        </button>
                      </div>
                    )}

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
                          {!session.club_id && (
                            <div className="segmented">
                              <button className={editSessionVisibility === 'public' ? 'active' : ''} onClick={() => setEditSessionVisibility('public')} type="button">
                                {text.public}
                              </button>
                              <button className={editSessionVisibility === 'private' ? 'active' : ''} onClick={() => setEditSessionVisibility('private')} type="button">
                                {text.private}
                              </button>
                            </div>
                          )}
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
                            {editSessionDurationRecommendation && <p className="field-help">{editSessionDurationRecommendation}</p>}
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
                            <div className="format-toolbar">
                              <button type="button" onClick={() => wrapTextFormat(editSessionNotes, setEditSessionNotes, '**')}>{text.formatBold}</button>
                              <button type="button" onClick={() => wrapTextFormat(editSessionNotes, setEditSessionNotes, '*')}>{text.formatItalic}</button>
                              <button type="button" onClick={() => wrapTextFormat(editSessionNotes, setEditSessionNotes, '__')}>{text.formatUnderline}</button>
                              <button type="button" onClick={() => wrapTextFormat(editSessionNotes, setEditSessionNotes, '~~')}>{text.formatStrike}</button>
                            </div>
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

                    {participants.some((participant) => participant.placement && participant.placement <= 3) && (
                      <div className="podium-row">
                        {participants
                          .filter((participant) => participant.placement && participant.placement <= 3)
                          .sort((a, b) => (a.placement || 9) - (b.placement || 9))
                          .map((participant) => (
                            <button
                              className={`podium-player place-${participant.placement}`}
                              key={`podium-${participant.id}`}
                              onClick={() => setSelectedPlayerId(participant.profile_id)}
                              type="button"
                            >
                              <span>{rankEmoji(participant.placement)}</span>
                              <span className="player-avatar tiny-avatar">
                                {canSeeSessionPlayers && participant.avatar_url ? <img src={participant.avatar_url} alt="" /> : (canSeeSessionPlayers ? (participant.display_name || 'P').slice(0, 1) : '?')}
                              </span>
                              <strong>{canSeeSessionPlayers ? participant.display_name || text.player : text.member}</strong>
                            </button>
                          ))}
                      </div>
                    )}

                    <div className="players">
                      {participants.map((participant) => (
                        <div className="player result-player" key={participant.id} title={participant.display_name || text.player}>
                          <button
                            className={[
                              'player-avatar player-avatar-button',
                              participant.placement ? `place-${participant.placement}` : '',
                            ].join(' ').trim()}
                            onClick={() => setSelectedPlayerId(participant.profile_id)}
                            type="button"
                          >
                            {canSeeSessionPlayers && participant.avatar_url ? <img src={participant.avatar_url} alt="" /> : (canSeeSessionPlayers ? (participant.display_name || 'P').slice(0, 1) : '?')}
                            {participant.checked_in && <span className="check-badge">✓</span>}
                            {participant.placement && participant.placement <= 3 && <span className="cup-badge">{rankEmoji(participant.placement)}</span>}
                          </button>
                          <span>{canSeeSessionPlayers ? participant.display_name || text.player : text.member}</span>
                          {canManage && (
                            <button
                              className="checkin-mini"
                              type="button"
                              onClick={() => setCheckInTarget({ sessionId: session.id, participantId: participant.id })}
                            >
                              {participant.checked_in ? '✓' : text.checkIn}
                            </button>
                          )}
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
                          {canManage && (
                            <div className="score-controls">
                              <input
                                aria-label={text.score}
                                defaultValue={participant.score ?? ''}
                                inputMode="numeric"
                                onBlur={(event) => updateParticipantResult(participant.id, event.target.value, participant.placement ?? '', participant.accuracy_percent ?? '', participant.projectiles_fired ?? '')}
                                placeholder={text.score}
                              />
                              <input
                                aria-label={text.accuracy}
                                defaultValue={participant.accuracy_percent ?? ''}
                                inputMode="numeric"
                                onBlur={(event) => updateParticipantResult(participant.id, participant.score ?? '', participant.placement ?? '', event.target.value, participant.projectiles_fired ?? '')}
                                placeholder="%"
                              />
                              <input
                                aria-label={text.projectiles}
                                defaultValue={participant.projectiles_fired ?? ''}
                                inputMode="numeric"
                                onBlur={(event) => updateParticipantResult(participant.id, participant.score ?? '', participant.placement ?? '', participant.accuracy_percent ?? '', event.target.value)}
                                placeholder={text.projectiles}
                              />
                              <select
                                aria-label={text.place}
                                value={participant.placement ?? ''}
                                onChange={(event) => updateParticipantResult(participant.id, participant.score ?? '', event.target.value, participant.accuracy_percent ?? '', participant.projectiles_fired ?? '')}
                              >
                                <option value="">{text.noPlace}</option>
                                <option value="1">{text.firstPlace}</option>
                                <option value="2">{text.secondPlace}</option>
                                <option value="3">{text.thirdPlace}</option>
                              </select>
                            </div>
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
                      <button
                        aria-label={text.share}
                        className={sharedKey === session.id ? 'share-icon-button copied' : 'share-icon-button'}
                        title={text.share}
                        type="button"
                        onClick={() => shareLink(session.id, session.name, `#session-${session.id}`)}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M12 5V16" />
                          <path d="M8 9L12 5L16 9" />
                          <path d="M5 13V18C5 19.1 5.9 20 7 20H17C18.1 20 19 19.1 19 18V13" />
                        </svg>
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )}

        {activeView === 'clubs' && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>{text.clubsTitle}</h2>
                <p className="muted">{text.clubsHint}</p>
              </div>
              <div className={isClubSearchOpen ? 'search-shell open' : 'search-shell'} ref={clubSearchShellRef}>
                <button
                  aria-label={text.searchSessions}
                  className="mobile-search-toggle"
                  type="button"
                  onClick={() => setIsClubSearchOpen((open) => !open)}
                >
                  🔎
                </button>
                <input
                  className="search"
                  type="search"
                  placeholder={text.clubSearchPlaceholder}
                  value={clubSearch}
                  onFocus={() => setIsClubSearchOpen(true)}
                  onChange={(event) => setClubSearch(event.target.value)}
                />
                {(isClubSearchOpen || clubSearch) && (
                  <button
                    aria-label={text.close}
                    className="search-close"
                    type="button"
                    onClick={() => {
                      setClubSearch('')
                      setIsClubSearchOpen(false)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="segmented form-segmented">
              <button className={clubVisibility === 'public' ? 'active' : ''} onClick={() => setClubVisibility('public')} type="button">
                {text.public}
              </button>
              <button className={clubVisibility === 'private' ? 'active' : ''} onClick={() => setClubVisibility('private')} type="button">
                {text.private}
              </button>
            </div>

            <div className="form-grid club-form">
              <div>
                <label>{text.clubName} <span className="required">*</span></label>
                <input value={clubName} onChange={(event) => setClubName(event.target.value)} placeholder="VRena Friday Club" />
              </div>
              <div>
                <label>{text.clubDescription}</label>
                <input value={clubDescription} onChange={(event) => setClubDescription(event.target.value)} placeholder={text.clubDescriptionPlaceholder} />
              </div>
            </div>

            <button className={isCreatingClub ? 'primary loading create-button' : 'primary create-button'} disabled={isCreatingClub} onClick={createClub} type="button">
              {isCreatingClub ? text.creatingClub : text.createClub}
            </button>
            {clubStatus && <p className="notice">{clubStatus}</p>}

            <div className="club-list">
              {filteredClubs.length === 0 && <p className="notice">{text.noMatchingClubs}</p>}
              {filteredClubs.map((club) => {
                const members = club.club_members ?? []
                const approvedMembers = members.filter((member) => member.status === 'approved')
                const pendingMembers = members.filter((member) => member.status === 'pending')
                const membership = members.find((member) => member.profile_id === userId)
                const canManage = canManageClub(club)
                const canSeeMembers = club.visibility === 'public' || canManage

                return (
                  <article
                    className="club-card clickable"
                    key={club.id}
                    onClick={() => {
                      setSelectedClubId(club.id)
                      setSelectedClubDate('')
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="session-top">
                      <div>
                        <h3>{club.name}</h3>
                        <div className="row-meta">
                          <span className={club.visibility === 'private' ? 'pill private' : 'pill ok'}>
                            {club.visibility === 'private' ? text.private : text.public}
                          </span>
                          <span>{clubMemberCount(club)} {text.members}</span>
                          {membership?.status === 'pending' && <span className="pill">{text.pending}</span>}
                        </div>
                      </div>
                      {!membership && !canManage && (
                        <button
                          className={busyClubId === club.id ? 'primary loading' : 'primary'}
                          disabled={busyClubId === club.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            joinClub(club)
                          }}
                          type="button"
                        >
                          {club.visibility === 'private' ? text.requestJoin : text.joinClub}
                        </button>
                      )}
                    </div>

                    {club.description && <p className="notes">{club.description}</p>}

                    {canSeeMembers ? (
                      <div className="players">
                        {approvedMembers.map((member) => (
                          <div className="player" key={member.id}>
                            <button
                              className="player-avatar player-avatar-button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedPlayerId(member.profile_id)
                              }}
                              type="button"
                            >
                              {member.avatar_url ? <img src={member.avatar_url} alt="" /> : (member.display_name || 'P').slice(0, 1)}
                            </button>
                            <span>{member.display_name || text.player}</span>
                            {canManage && member.profile_id !== club.owner_id && (
                              <button className="remove-player" disabled={busyClubId === club.id} onClick={(event) => {
                                event.stopPropagation()
                                removeClubMember(club, member)
                              }} type="button">
                                {text.remove}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="notice">{text.hiddenMembers}</p>
                    )}

                    {canManage && pendingMembers.length > 0 && (
                      <div className="pending-list">
                        {pendingMembers.map((member) => (
                          <div className="pending-member" key={member.id}>
                            <span>{member.display_name || text.player}</span>
                            <div className="mini-session-actions">
                              <button className="secondary small-button" disabled={busyClubId === club.id} onClick={(event) => {
                                event.stopPropagation()
                                approveClubMember(member)
                              }} type="button">
                                {text.approve}
                              </button>
                              <button className="danger small-button" disabled={busyClubId === club.id} onClick={(event) => {
                                event.stopPropagation()
                                removeClubMember(club, member)
                              }} type="button">
                                {text.remove}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
              {!sessionClubId && (
                <div className="segmented">
                  <button className={sessionVisibility === 'public' ? 'active' : ''} onClick={() => setSessionVisibility('public')} type="button">
                    {text.public}
                  </button>
                  <button className={sessionVisibility === 'private' ? 'active' : ''} onClick={() => setSessionVisibility('private')} type="button">
                    {text.private}
                  </button>
                </div>
              )}
            </div>

            <div className="form-grid">
              <div className="full">
                <label>{text.sessionName} <span className="required">*</span></label>
                <input placeholder={text.fridayPlaceholder} value={sessionName} onChange={(event) => setSessionName(event.target.value)} />
              </div>
              <div className="full">
                <label>{text.tournamentSession}</label>
                <div className="segmented">
                  <button className={sessionType === 'game' ? 'active' : ''} onClick={() => setSessionType('game')} type="button">
                    {text.normalGame}
                  </button>
                  <button className={sessionType === 'tournament' ? 'active' : ''} onClick={() => setSessionType('tournament')} type="button">
                    {text.tournament}
                  </button>
                </div>
              </div>
              <div className="full">
                <label>{text.clubOnly}</label>
                <select value={sessionClubId} onChange={(event) => handleSessionClubChange(event.target.value)}>
                  <option value="">{text.noClub}</option>
                  {sessionClubOptions.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
                {sessionClubId && <p className="field-help">{text.clubOnlySessionHint}</p>}
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
                {sessionDurationRecommendation && <p className="field-help">{sessionDurationRecommendation}</p>}
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
                <div className="format-toolbar">
                  <button type="button" onClick={() => wrapTextFormat(sessionNotes, setSessionNotes, '**')}>{text.formatBold}</button>
                  <button type="button" onClick={() => wrapTextFormat(sessionNotes, setSessionNotes, '*')}>{text.formatItalic}</button>
                  <button type="button" onClick={() => wrapTextFormat(sessionNotes, setSessionNotes, '__')}>{text.formatUnderline}</button>
                  <button type="button" onClick={() => wrapTextFormat(sessionNotes, setSessionNotes, '~~')}>{text.formatStrike}</button>
                </div>
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
              {showProfileFields && (
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
              {showProfileFields && (
                <>
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
                </>
              )}
              <div className="email-field">
                <label>{text.email} <span className="required">*</span></label>
                <input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} placeholder="contact@vre-vietnam.com" />
              </div>
              {showProfileFields && (
                <div className="name-field">
                  <label>{text.name} <span className="required">*</span></label>
                  <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Nguyen Van A" />
                </div>
              )}
              {showProfileFields && (
                <div className="nickname-field">
                  <label>{text.nickname}</label>
                  <input value={profileNickname} onChange={(event) => setProfileNickname(event.target.value)} placeholder={text.optional} />
                </div>
              )}
              {!profile && authMode === 'create' && (
                <label className="consent-field">
                  <input
                    checked={personalDataConsent}
                    onChange={(event) => setPersonalDataConsent(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    {text.consentPrefix}
                    <a href={PRIVACY_POLICY_URL} rel="noreferrer" target="_blank">
                      {text.privacyPolicy}
                    </a>
                    {text.consentSuffix}
                  </span>
                </label>
              )}
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
              {!profile && (
                <div className="captcha-field">
                  <label>{text.captchaLabel} <span className="required">*</span></label>
                  <div className="captcha-box" ref={captchaContainerRef} />
                  <p className="field-help">{text.captchaHelp}</p>
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

            <div className="profile-mobile-contact">
              <strong>VRena Vietnam</strong>
              <a href="mailto:contact@vre-vietnam.com">contact@vre-vietnam.com</a>
              <a href="https://zalo.me/84981152315" target="_blank" rel="noreferrer">Zalo: 0981152315</a>
              <a href="https://www.vre-vietnam.com" target="_blank" rel="noreferrer">www.vre-vietnam.com</a>
            </div>

            {profile && (
              <div className="player-stats">
                <h3>{text.stats} {topPlayer?.profileId === userId ? '🏆' : ''}</h3>
                {topPlayer?.profileId === userId && <p className="notice">{text.bestPlayer}</p>}
                <div className="stats">
                  <span>{playerStats.gamesJoined} {text.gamesCheckedIn}</span>
                  <span>{playerStats.wins} {text.wins}</span>
                  <span>{playerStats.totalScore} {text.totalScore}</span>
                  <span>{playerStats.averageAccuracy ?? '-'}% {text.accuracy}</span>
                  <span>{playerStats.totalProjectiles} {text.projectiles}</span>
                </div>
                {playerStats.bestByGame.length > 0 && (
                  <div className="best-score-list">
                    <strong>{text.bestScores}</strong>
                    {playerStats.bestByGame.map((item) => (
                      <span key={item.game}>{item.game}: {item.score}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                      const canManage = canManageSession(session)
                      const joinedByMe = participants.some((participant) => participant.profile_id === userId)
                      const canSeeInviteCode = session.visibility === 'private' && session.invite_code && (canManage || joinedByMe)

                      return (
                        <article
                          className="mini-session clickable"
                          key={session.id}
                          onClick={() => openSessionFromProfile(session.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openSessionFromProfile(session.id)
                            }
                          }}
                        >
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
                                onClick={(event) => {
                                  event.stopPropagation()
                                  copyInviteCode(session.id, session.invite_code)
                                }}
                              >
                                {copiedInviteId === session.id ? text.copied : text.copy}
                              </button>
                            </div>
                          )}
                          {canManage ? (
                            <div className="mini-session-actions">
                              <button
                                className="secondary small-button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  startEditingSession(session)
                                  openSessionFromProfile(session.id)
                                }}
                              >
                                {text.editSession}
                              </button>
                              <button
                                className={busySessionId === session.id ? 'danger small-button loading' : 'danger small-button'}
                                disabled={busySessionId === session.id}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  cancelSession(session)
                                }}
                              >
                                {text.cancelSession}
                              </button>
                            </div>
                          ) : joinedByMe ? (
                            <div className="mini-session-actions">
                              <button
                                className={busySessionId === session.id ? 'secondary small-button loading' : 'secondary small-button'}
                                disabled={busySessionId === session.id}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  leaveSession(session)
                                }}
                              >
                                {text.leaveSession}
                              </button>
                            </div>
                          ) : null}
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

      {loginPromptOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="login-prompt-title">
          <div className="login-modal">
            <button className="modal-close" type="button" onClick={() => setLoginPromptOpen(false)} aria-label={text.close}>
              ×
            </button>
            <h3 id="login-prompt-title">{text.loginPromptTitle}</h3>
            <p>{text.loginPromptMessage}</p>
            <button className="primary create-button" type="button" onClick={goToLogin}>
              {text.loginPromptButton}
            </button>
          </div>
        </div>
      )}

      {selectedClub && (
        <div className="club-drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="club-drawer-title" onClick={() => setSelectedClubId('')}>
          <div
            className="club-drawer"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => setDrawerTouchStart(event.touches[0]?.clientY ?? null)}
            onTouchEnd={(event) => {
              if (drawerTouchStart === null) return
              const endY = event.changedTouches[0]?.clientY ?? drawerTouchStart
              if (endY - drawerTouchStart > 70) {
                setSelectedClubId('')
              }
              setDrawerTouchStart(null)
            }}
          >
            <div className="drawer-handle" />
            <div className="session-top">
              <div>
                <h2 id="club-drawer-title">{selectedClub.name}</h2>
                <div className="row-meta">
                  <span className={selectedClub.visibility === 'private' ? 'pill private' : 'pill ok'}>
                    {selectedClub.visibility === 'private' ? text.private : text.public}
                  </span>
                  <span>{clubMemberCount(selectedClub)} {text.members}</span>
                </div>
              </div>
              <button className="secondary small-button" type="button" onClick={() => setSelectedClubId('')}>
                {text.close}
              </button>
            </div>

            {selectedClub.description && <p className="notes">{selectedClub.description}</p>}

            {!selectedClubMembership && !canManageClub(selectedClub) && (
              <button
                className={busyClubId === selectedClub.id ? 'primary loading create-button' : 'primary create-button'}
                disabled={busyClubId === selectedClub.id}
                onClick={() => joinClub(selectedClub)}
                type="button"
              >
                {selectedClub.visibility === 'private' ? text.requestJoin : text.joinClub}
              </button>
            )}

            {selectedClubMembership?.status === 'pending' && (
              <p className="notice">{text.requestSent}</p>
            )}

            {canCreateClubSession(selectedClub) && (
              <button
                className="primary create-button"
                type="button"
                onClick={() => {
                  setSessionClubId(selectedClub.id)
                  setSessionVisibility('public')
                  setCreateStatus(text.clubOnlyCreateHint)
                  setActiveView('create')
                  setSelectedClubId('')
                }}
              >
                {text.clubOnly}
              </button>
            )}

            <div className="drawer-block">
              <h3>{text.members}</h3>
              {canSeeClubPrivateData(selectedClub) ? (
                <div className="players">
                  {(selectedClub.club_members ?? [])
                    .filter((member) => member.status === 'approved')
                    .map((member) => (
                      <div className="player" key={member.id}>
                        <button className="player-avatar player-avatar-button" onClick={() => setSelectedPlayerId(member.profile_id)} type="button">
                          {member.avatar_url ? <img src={member.avatar_url} alt="" /> : (member.display_name || 'P').slice(0, 1)}
                        </button>
                        <span>{member.display_name || text.player}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="notice">{text.hiddenMembers}</p>
              )}
            </div>

            <div className="drawer-block">
              <div className="section-head compact-head">
                <div>
                  <h3>{text.nextGames}</h3>
                </div>
              </div>
              {selectedClubDayOptions.length > 0 && (
                <div className="day-strip drawer-days">
                  <button
                    className={!selectedClubDate ? 'day-chip active' : 'day-chip'}
                    type="button"
                    onClick={() => setSelectedClubDate('')}
                  >
                    <strong>{text.allDays}</strong>
                  </button>
                  {selectedClubDayOptions.map((day) => (
                    <button
                      className={selectedClubDate === day.value ? 'day-chip active' : 'day-chip'}
                      key={day.value}
                      type="button"
                      onClick={() => setSelectedClubDate(day.value)}
                    >
                      <span>{day.weekday}</span>
                      <strong>{day.day}</strong>
                    </button>
                  ))}
                </div>
              )}

              {filteredSelectedClubSessions.length === 0 ? (
                <p className="notice">{text.noClubGames}</p>
              ) : (
                <div className="mini-session-list">
                  {filteredSelectedClubSessions.map((session) => (
                    <article className="mini-session clickable" key={session.id} onClick={() => {
                      setSelectedClubId('')
                      openSessionFromProfile(session.id)
                    }}>
                      <div className="mini-session-title">
                        <strong>{session.name}</strong>
                        <span className="pill ok">{text.clubSession}</span>
                      </div>
                      <div className="row-meta">
                        <span>{session.date}</span>
                        <span>{session.start_time.slice(0, 5)}</span>
                        <span>{session.duration_minutes} min</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPlayerProfile && (
        <div className="club-drawer-backdrop player-profile-backdrop" role="dialog" aria-modal="true" aria-labelledby="player-profile-title" onClick={() => setSelectedPlayerId('')}>
          <div className="player-profile-panel" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-handle" />
            <button className="modal-close" type="button" onClick={() => setSelectedPlayerId('')} aria-label={text.close}>
              ×
            </button>
            <div className="player-profile-head">
              <div className={topPlayer?.profileId === selectedPlayerProfile.profileId ? 'player-avatar profile-large champion-avatar' : 'player-avatar profile-large'}>
                {selectedPlayerProfile.avatarUrl ? <img src={selectedPlayerProfile.avatarUrl} alt="" /> : selectedPlayerProfile.displayName.slice(0, 1)}
                {topPlayer?.profileId === selectedPlayerProfile.profileId && <span className="champion-badge">🏆</span>}
              </div>
              <div>
                <h3 id="player-profile-title">{selectedPlayerProfile.displayName}</h3>
                {topPlayer?.profileId === selectedPlayerProfile.profileId && <span className="pill ok">{text.bestOverall}</span>}
              </div>
            </div>
            <div className="stats">
              <span>{selectedPlayerProfile.gamesJoined} {text.gamesCheckedIn}</span>
              <span>{selectedPlayerProfile.wins} {text.wins}</span>
              <span>{selectedPlayerProfile.totalScore} {text.totalScore}</span>
              <span>{selectedPlayerProfile.averageAccuracy ?? '-'}% {text.accuracy}</span>
              <span>{selectedPlayerProfile.totalProjectiles} {text.projectiles}</span>
            </div>
            {selectedPlayerProfile.bestByGame.length > 0 && (
              <div className="best-score-list">
                <strong>{text.bestScores}</strong>
                {selectedPlayerProfile.bestByGame.map((item) => (
                  <span key={item.game}>{item.game}: {item.score}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {checkInParticipant && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
          <div className="login-modal">
            <button className="modal-close" type="button" onClick={() => setCheckInTarget(null)} aria-label={text.close}>
              ×
            </button>
            <h3 id="checkin-title">{text.checkIn}</h3>
            <p>{checkInParticipant.display_name || text.player}</p>
            <div className="payment-grid">
              <button className="secondary" type="button" onClick={() => updateParticipantCheckIn(checkInParticipant.id, 'cash')}>
                {text.cash}
              </button>
              <button className="secondary" type="button" onClick={() => updateParticipantCheckIn(checkInParticipant.id, 'bank_transfer')}>
                {text.bankTransfer}
              </button>
              <button className="secondary" type="button" onClick={() => updateParticipantCheckIn(checkInParticipant.id, 'free')}>
                {text.free}
              </button>
              {checkInParticipant.checked_in && (
                <button className="danger" type="button" onClick={() => updateParticipantCheckIn(checkInParticipant.id, null)}>
                  {text.clearCheckIn}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .brand-logo {
          display: block;
          width: min(156px, 72%);
          max-width: 156px;
          line-height: 0;
        }

        .brand-logo img {
          display: block;
          width: 100%;
          height: auto;
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
          position: relative;
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

        .search-shell {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
        }

        .search-close {
          display: inline-grid;
          place-items: center;
          width: 34px;
          height: 34px;
          min-height: 34px;
          border-radius: 999px;
          border: 1px solid rgba(7, 17, 18, 0.14);
          background: #ffffff;
          color: #071112;
          font-size: 20px;
          font-weight: 800;
          padding: 0;
        }

        .day-strip {
          position: absolute;
          top: 70px;
          right: 16px;
          z-index: 35;
          display: flex;
          gap: 8px;
          width: min(560px, calc(100% - 32px));
          max-width: calc(100vw - 32px);
          overflow-x: auto;
          overscroll-behavior-x: contain;
          box-sizing: border-box;
          padding: 8px;
          margin: 0;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(11, 21, 24, 0.14);
          scrollbar-width: thin;
        }

        .day-chip {
          flex: 0 0 auto;
          display: grid;
          gap: 1px;
          min-width: 58px;
          min-height: 48px;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          background: #f0f4f6;
          color: #071112;
          text-align: center;
        }

        .day-chip span {
          color: #637075;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .day-chip strong {
          font-size: 13px;
        }

        .day-chip.active {
          color: #ffffff;
          border-color: transparent;
          background: linear-gradient(135deg, #13c9c9, #3059ff);
        }

        .day-chip.active span {
          color: rgba(255, 255, 255, 0.82);
        }

        .mobile-search-toggle {
          display: none;
        }

        .app-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .language-picker {
          position: relative;
        }

        .language-picker > button,
        .language-menu button {
          min-height: 30px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 999px;
          background: #ffffff;
          color: #071112;
          padding: 4px 9px;
          font-size: 12px;
          font-weight: 900;
        }

        .language-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          z-index: 60;
          display: grid;
          gap: 4px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          background: #ffffff;
          padding: 6px;
          box-shadow: 0 12px 32px rgba(11, 21, 24, 0.14);
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

        .share-icon-button {
          display: inline-grid;
          place-items: center;
          flex: 0 0 auto;
          width: 44px;
          height: 44px;
          min-height: 44px;
          border: 1px solid rgba(48, 89, 255, 0.18);
          border-radius: 8px;
          background: #f5f8ff;
          color: #3059ff;
          padding: 0;
        }

        .share-icon-button svg {
          width: 21px;
          height: 21px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .share-icon-button.copied {
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

        .mini-session.clickable {
          cursor: pointer;
        }

        .mini-session.clickable:hover {
          border-color: rgba(48, 89, 255, 0.35);
          box-shadow: 0 10px 26px rgba(11, 21, 24, 0.08);
        }

        .mini-session-title {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: wrap;
        }

        .mini-session-actions {
          display: flex;
          gap: 8px;
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
          position: relative;
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

        .champion-badge {
          position: absolute;
          right: -3px;
          bottom: -3px;
          display: grid;
          place-items: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          font-size: 11px;
          box-shadow: 0 2px 6px rgba(11, 21, 24, 0.16);
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

        .profile-mobile-contact {
          display: none;
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

        .club-list {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .club-card {
          display: grid;
          gap: 12px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 14px;
          background: #ffffff;
        }

        .pending-list {
          display: grid;
          gap: 8px;
          border-top: 1px solid rgba(7, 17, 18, 0.08);
          padding-top: 10px;
        }

        .pending-member {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-radius: 8px;
          background: #f0f4f6;
          padding: 8px 10px;
          font-weight: 800;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(7, 17, 18, 0.32);
        }

        .login-modal {
          position: relative;
          width: min(420px, 100%);
          display: grid;
          gap: 12px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 8px;
          padding: 20px;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(11, 21, 24, 0.2);
        }

        .login-modal p {
          color: #637075;
          line-height: 1.45;
        }

        .payment-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .player-profile-panel {
          position: relative;
          width: min(420px, 100%);
          display: grid;
          gap: 12px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 12px;
          background: #ffffff;
          padding: 18px;
          box-shadow: 0 28px 80px rgba(11, 21, 24, 0.22);
        }

        .player-profile-head {
          display: grid;
          grid-template-columns: 64px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
        }

        .profile-large {
          width: 64px;
          height: 64px;
          font-size: 24px;
        }

        .champion-avatar {
          box-shadow: 0 0 0 3px #f6c244;
        }

        .podium-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 0;
        }

        .podium-player {
          flex: 0 0 auto;
          display: inline-grid;
          grid-template-columns: auto 30px auto;
          gap: 6px;
          align-items: center;
          min-height: 40px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 999px;
          background: #ffffff;
          color: #071112;
          padding: 5px 9px;
          font-weight: 900;
        }

        .tiny-avatar {
          width: 30px;
          height: 30px;
          font-size: 12px;
        }

        .best-score-list,
        .player-stats {
          display: grid;
          gap: 8px;
        }

        .best-score-list {
          margin-top: 8px;
          color: #637075;
          font-size: 13px;
        }

        .club-drawer-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: grid;
          place-items: end center;
          padding: 20px;
          background: rgba(7, 17, 18, 0.34);
        }

        .club-drawer {
          width: min(860px, 100%);
          max-height: min(78vh, 760px);
          overflow-y: auto;
          display: grid;
          gap: 14px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 14px 14px 8px 8px;
          background: #ffffff;
          padding: 16px;
          box-shadow: 0 28px 80px rgba(11, 21, 24, 0.22);
          animation: drawerUp 180ms ease-out;
        }

        .drawer-handle {
          justify-self: center;
          width: 46px;
          height: 5px;
          border-radius: 999px;
          background: rgba(7, 17, 18, 0.18);
        }

        .drawer-block {
          display: grid;
          gap: 10px;
          border-top: 1px solid rgba(7, 17, 18, 0.08);
          padding-top: 12px;
        }

        .drawer-days {
          position: static;
          width: 100%;
          max-width: 100%;
          border-radius: 999px;
          box-shadow: none;
        }

        @keyframes drawerUp {
          from {
            transform: translateY(24px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 34px;
          height: 34px;
          display: inline-grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #637075;
          font-size: 24px;
          line-height: 1;
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
          white-space: pre-wrap;
        }

        .notes-block {
          display: grid;
          gap: 4px;
        }

        .notes-block:not(.expanded) .notes {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .expand-note {
          width: fit-content;
          min-height: auto;
          border: 0;
          background: transparent;
          color: #3059ff;
          padding: 0;
          font-size: 12px;
          font-weight: 900;
        }

        .format-toolbar {
          display: inline-flex;
          gap: 4px;
          margin: 0 0 6px;
        }

        .format-toolbar button {
          display: inline-grid;
          place-items: center;
          width: 30px;
          height: 28px;
          min-height: 28px;
          border: 1px solid rgba(7, 17, 18, 0.12);
          border-radius: 7px;
          background: #ffffff;
          color: #071112;
          padding: 0;
          font-size: 12px;
          font-weight: 900;
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
          position: relative;
          display: inline-grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 0;
          background: linear-gradient(135deg, #13c9c9, #3059ff);
          color: #ffffff;
          font-weight: 900;
          padding: 0;
          overflow: visible;
        }

        .player-avatar-button {
          cursor: pointer;
        }

        .player-avatar-button:disabled {
          cursor: default;
        }

        .place-1 {
          box-shadow: 0 0 0 3px #f5c542;
        }

        .place-2 {
          box-shadow: 0 0 0 3px #b7c0ca;
        }

        .place-3 {
          box-shadow: 0 0 0 3px #c98742;
        }

        .check-badge,
        .cup-badge {
          position: absolute;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 2px solid #ffffff;
          font-size: 10px;
          line-height: 1;
        }

        .check-badge {
          right: -4px;
          bottom: -4px;
          width: 15px;
          height: 15px;
          background: #0d7c51;
          color: #ffffff;
        }

        .cup-badge {
          left: -6px;
          bottom: -6px;
          width: 17px;
          height: 17px;
          background: #fff6c7;
        }

        .score-controls {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(4, minmax(54px, 1fr));
          gap: 6px;
        }

        .score-controls input,
        .score-controls select {
          min-height: 30px;
          padding: 5px 6px;
          font-size: 11px;
        }

        .checkin-mini {
          border: 1px solid rgba(13, 124, 81, 0.22);
          background: #e9f8f1;
          color: #0d7c51;
          padding: 4px 7px;
          font-size: 11px;
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
          grid-template-columns: 150px minmax(260px, 1fr) minmax(260px, 1fr);
          align-items: start;
        }

        .profile-form .profile-photo-panel {
          grid-column: 1 / -1;
        }

        .country-field {
          grid-column: 1;
        }

        .phone-field {
          grid-column: 2;
        }

        .email-field {
          grid-column: 3;
        }

        .name-field {
          grid-column: 1 / span 2;
        }

        .nickname-field {
          grid-column: 3;
        }

        .password-field {
          grid-column: 1 / span 2;
          max-width: none;
        }

        .consent-field {
          grid-column: 1 / span 2;
          display: grid;
          grid-template-columns: 16px minmax(0, 1fr);
          gap: 8px;
          align-items: start;
          max-width: 720px;
          margin: 0;
          color: #637075;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.35;
        }

        .consent-field input {
          width: 14px;
          height: 14px;
          margin: 1px 0 0;
          padding: 0;
        }

        .consent-field a {
          color: #3059ff;
          font-weight: 800;
        }

        .captcha-field {
          grid-column: 1 / span 2;
          display: grid;
          gap: 6px;
        }

        .captcha-box {
          min-height: 78px;
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

        .stats div,
        .stats > span {
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
            display: grid;
            grid-template-columns: 46px auto minmax(0, 1fr) auto;
            grid-template-areas:
              "profile lang share logo"
              "tabs tabs tabs tabs";
            align-items: center;
            gap: 10px;
          }

          aside > div:first-child,
          .app-title-row {
            display: contents;
          }

          aside > div:first-child > .muted {
            display: none;
          }

          main {
            height: auto;
            overflow: visible;
            padding: 12px;
          }

          h1 {
            font-size: 26px;
          }

          .brand-logo {
            grid-area: logo;
            justify-self: end;
            width: 104px;
            max-width: 104px;
          }

          .language-picker {
            grid-area: lang;
            justify-self: start;
          }

          h2 {
            font-size: 18px;
          }

          h3 {
            font-size: 20px;
          }

          .profile-chip {
            grid-area: profile;
            grid-template-columns: 44px;
            width: 44px;
            height: 44px;
            padding: 0;
            border: 0;
            border-radius: 50%;
            background: transparent;
            overflow: hidden;
          }

          .profile-chip > div:not(.avatar) {
            display: none;
          }

          .profile-chip .avatar {
            width: 44px;
            height: 44px;
          }

          .tabs {
            grid-area: tabs;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }

          .app-share {
            grid-area: share;
            justify-self: center;
            min-height: 38px;
            padding: 7px 13px;
          }

          .tab {
            text-align: center;
            padding: 11px 8px;
            font-size: 14px;
          }

          .shop-contact {
            display: none;
          }

          .profile-mobile-contact {
            display: grid;
            gap: 7px;
            border-top: 1px solid rgba(7, 17, 18, 0.12);
            margin-top: 16px;
            padding-top: 14px;
            font-size: 13px;
          }

          .profile-mobile-contact a {
            color: #3059ff;
            text-decoration: none;
            overflow-wrap: anywhere;
          }

          .section {
            border-radius: 8px;
            padding: 12px;
            box-shadow: none;
          }

          .club-drawer-backdrop {
            align-items: end;
            padding: 0 10px 14px;
          }

          .club-drawer {
            max-height: calc(100vh - 86px);
            border-radius: 18px 18px 10px 10px;
            padding: 12px;
          }

          .player-profile-panel {
            width: 100%;
            border-radius: 18px 18px 10px 10px;
            align-self: end;
          }

          .section-head,
          .join-row {
            display: grid;
          }

          .section-copy {
            display: none;
          }

          .search-shell {
            position: fixed;
            top: 124px;
            right: 12px;
            z-index: 25;
            justify-content: flex-end;
            pointer-events: none;
          }

          .mobile-search-toggle {
            display: inline-grid;
            place-items: center;
            width: 46px;
            height: 46px;
            border: 1px solid rgba(48, 89, 255, 0.2);
            border-radius: 999px;
            background: #ffffff;
            box-shadow: 0 12px 34px rgba(11, 21, 24, 0.16);
            font-size: 20px;
            pointer-events: auto;
          }

          .search {
            display: none;
            width: min(100vw - 76px, 440px);
            max-width: none;
            box-shadow: 0 12px 34px rgba(11, 21, 24, 0.16);
            pointer-events: auto;
          }

          .search-shell.open {
            left: 12px;
          }

          .search-shell.open .search {
            display: block;
          }

          .search-close {
            display: none;
            box-shadow: 0 12px 34px rgba(11, 21, 24, 0.16);
            pointer-events: auto;
          }

          .search-shell.open .search-close {
            display: inline-grid;
          }

          .day-strip {
            position: fixed;
            top: 178px;
            left: 0;
            right: 0;
            z-index: 24;
            width: 100vw;
            max-width: 100vw;
            margin: 0;
            padding: 8px 12px 10px;
            border-width: 1px 0;
            border-radius: 0;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 10px 26px rgba(11, 21, 24, 0.12);
          }

          .day-chip {
            min-width: 54px;
            min-height: 44px;
            padding: 6px 9px;
          }

          .drawer-days {
            position: static;
            width: 100%;
            max-width: 100%;
            border-width: 1px;
            border-radius: 999px;
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

          .join-row {
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: stretch;
          }

          .join-row input {
            grid-column: 1 / -1;
          }

          .join-row .share-icon-button {
            width: 48px;
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
          .name-field,
          .nickname-field,
          .consent-field,
          .password-field,
          .captcha-field {
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

          .brand-logo {
            width: 92px;
            max-width: 92px;
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

        @media (prefers-color-scheme: dark) {
          :global(body) {
            background: #071112;
            color: #f6f7f9;
          }

          aside,
          .section,
          .session,
          .club-card,
          .mini-session,
          .profile-chip,
          .profile-photo-panel,
          .login-modal,
          .club-drawer {
            background: #10191b;
            border-color: rgba(255, 255, 255, 0.12);
          }

          .muted,
          .profile-chip span,
          .row-meta,
          label,
          .notes,
          .login-modal p,
          .field-help,
          .consent-field,
          .game-card strong,
          .stats span {
            color: #aeb9bd;
          }

          .tab,
          .segmented button,
          button.secondary,
          input,
          select,
          textarea,
          .country-button,
          .search-close,
          .mobile-search-toggle,
          .day-chip,
          .game-card,
          .invite-code button {
            background: #182225;
            color: #f6f7f9;
            border-color: rgba(255, 255, 255, 0.14);
          }

          .tab.active,
          .segmented button.active,
          .notice,
          .row-meta span,
          .pill,
          .pending-member {
            background: #1d2a2e;
          }

          .modal-backdrop {
            background: rgba(0, 0, 0, 0.55);
          }

          .club-drawer-backdrop {
            background: rgba(0, 0, 0, 0.58);
          }

          .drawer-handle {
            background: rgba(255, 255, 255, 0.24);
          }

          .invite-code,
          .day-strip,
          .share-button {
            background: #111f31;
            border-color: rgba(75, 132, 255, 0.25);
          }

          .invite-code strong,
          h1,
          h2,
          h3,
          .profile-chip,
          .club-card,
          .game-card,
          .country-list button,
          .profile-photo-panel strong {
            color: #f6f7f9;
          }
        }
      `}</style>
    </div>
  )
}
