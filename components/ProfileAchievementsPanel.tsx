'use client'

import NextImage from 'next/image'
import {
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CakeSlice,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  Check,
  ChevronRight,
  Compass,
  Crosshair,
  Crown,
  Flame,
  Gamepad2,
  Handshake,
  Lock,
  Mail,
  Medal,
  MessageCircle,
  MoonStar,
  Orbit,
  PartyPopper,
  RotateCcw,
  SearchCheck,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  TimerReset,
  TrendingUp,
  Trophy,
  UserRoundPlus,
  UsersRound,
  VenetianMask,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { LanguageCode } from '../lib/i18n/languages'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import {
  localizeGameAchievement,
  localizeMilestoneReward,
  localizeRetentionAchievement,
} from '../lib/profileAchievementTranslations'
import { vrenaPalette } from '../lib/theme/vrenaPalette'
import {
  achievementMilestoneRewards,
  achievementRarityForGame,
  achievementRarityForRetention,
  achievementSummary,
  buildGameAchievements,
  buildRetentionAchievements,
  closestAchievement,
  completedAchievementSessions,
  profileLevelProgress,
  recentUnlockedAchievements,
  sessionsByRecentWeek,
  venueResultsAsAchievementSessions,
  weeklyAchievementSpotlight,
  type AchievementProgressPoint,
  type AchievementRarity,
  type AchievementSession,
  type AchievementVenueResult,
  type GameAchievement,
  type RecentAchievement,
  type RetentionAchievement,
} from '../lib/profileAchievements'
import {
  achievementShareText,
  openAchievementShareChannel,
  shareAchievementImage,
  type AchievementShareOptions,
} from '../lib/achievementShare'
import {
  anonymousCallsignForId,
  ANONYMOUS_MASK_COLOR,
  ANONYMOUS_MASK_EMOJI,
  ANONYMOUS_MASK_TEXT_COLOR,
  compactDisplayName,
  compactInitials,
  DEFAULT_APP_URL,
} from '../lib/bookingWidgetDomain'
import { formatWholePercent } from '../lib/playerStatsShare'
import { supabase } from '../lib/supabase/client'
import { shouldSkipImageOptimization } from './AvatarNode'
import PlayerReturnMissionCard from './PlayerReturnMissionCard'
import { buildPlayerReturnMission } from '../lib/playerReturnMission'

type ProfileAchievementsPanelProps = {
  editor?: {
    onToggleAchievement: (achievement: {
      description: string
      id: string
      kind: 'game' | 'retention'
      manuallyUnlocked: boolean
      title: string
    }) => void
    pendingAchievementKeys: Set<string>
  }
  editorRankAction?: ReactNode
  editorSessionsAction?: ReactNode
  editorToolbar?: ReactNode
  language: LanguageCode
  manualAwardsOverride?: ManualProfileAchievementAward[]
  mySessions: AchievementSession[]
  onJoinSession?: () => void
  onScheduleReturnReminder?: () => Promise<{ message?: string; ok: boolean; scheduledFor?: string }>
  playerGameCountOverrides?: Record<string, number>
  playerStats: {
    averageAccuracy?: number | null
    bestByGame?: Array<{ game: string; score: number }>
    gamesJoined?: number | null
    reliabilityScore?: number | null
    totalScore?: number | null
    wins?: number | null
  }
  profile: {
    anonymous_mode?: boolean | null
    anonymous_callsign?: string | null
    avatar_color?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_text_color?: string | null
    avatar_url?: string | null
    birthday?: string | null
    full_name?: string | null
    id?: string | null
    nickname?: string | null
    phone?: string | null
  }
  text: TranslationMap
  userId: string
  venueResultsOverride?: AchievementVenueResult[]
}

type AchievementCopy = {
  accuracy: string
  achievements: string
  achievementsEmpty: string
  achievementsHint: string
  achievementsUnlocked: string
  achievementsUnlockedTotal: string
  all: string
  badgePath: string
  bestScore: string
  bronze: string
  collection: string
  closestUnlock: string
  common: string
  currentState: string
  dateUnavailable: string
  epic: string
  featuredBadge: string
  filters: string
  gamesTried: string
  gamesTriedDetailHint: string
  gold: string
  hiddenBadge: string
  hiddenHints: string
  legendary: string
  level: string
  locked: string
  mastered: string
  nextLevel: string
  nextRequirement: string
  noGamesTried: string
  noRecentUnlocks: string
  noSessionsCreated: string
  noSessionsPlayed: string
  playToUnlock: string
  playerRank: string
  progress: string
  progressGraph: string
  rare: string
  rankList: string
  rankListIntro: string
  rarity: string
  recentUnlocks: string
  reliability: string
  retentionCollection: string
  retentionHint: string
  rewards: string
  rewardsHint: string
  score: string
  secret: string
  secretHint: string
  sessionsPlayed: string
  sessionsCreated: string
  sessionsCreatedDetailHint: string
  sessionsPlayedDetailHint: string
  timesPlayed: string
  shareAchievement: string
  shareAchievements: string
  shareAllAchievements: string
  shareByEmail: string
  shareCopied: string
  shareComingSoon: string
  shareToFriends: string
  shareToWhatsApp: string
  shareToZalo: string
  shareReady: string
  silver: string
  social: string
  streakBanner: string
  tapForDetails: string
  trickster: string
  unlocked: string
  unlockCelebrationDismiss: string
  unlockCelebrationBatchMessage: string
  unlockCelebrationBatchTitle: string
  unlockCelebrationTitle: string
  unlockJesterMessage: string
  unlockCondition: string
  viewDetails: string
  xp: string
}

export type ManualProfileAchievementAward = {
  id: string
  achievement_id: string
  achievement_kind: 'game' | 'retention' | string
  title: string
  description: string | null
  note: string | null
  awarded_at: string
}

type AchievementFilter = 'all' | 'games' | 'trickster' | 'social' | 'performance' | 'hidden'
type AchievementSummaryDetail = 'sessions-played' | 'games-tried' | 'sessions-created'

type AchievementUnlockView = {
  achievement_id: string
  achievement_kind: 'game' | 'retention' | string
  achievement_tier: string
  shared_at: string | null
}

type AchievementCelebration = {
  badgeImageUrl?: string | null
  current: number
  description: string
  id: string
  key: string
  kind: 'game' | 'retention'
  kindLabel: string
  rarityLabel?: string
  target: number
  tier: string
  title: string
}

const achievementCopy: Record<LanguageCode, AchievementCopy> = {
  en: {
    accuracy: 'Accuracy',
    bestScore: 'Best score',
    dateUnavailable: 'Date unavailable',
    gamesTriedDetailHint: 'Games that count toward your achievement progress.',
    noGamesTried: 'No checked-in games yet. Your first played game will appear here.',
    noSessionsCreated: 'You have not created a session yet.',
    noSessionsPlayed: 'No checked-in sessions yet. Completed visits will appear here.',
    score: 'Score',
    sessionsCreatedDetailHint: 'Sessions you organized, with their date and selected game.',
    sessionsPlayedDetailHint: 'Your checked-in session history and recorded results.',
    timesPlayed: 'Plays: {count}',
    viewDetails: 'View details',
    achievements: 'Achievements',
    achievementsEmpty: 'Check in to a session and your first badge will light up here.',
    achievementsHint: 'Game badges are powered by your checked-in sessions.',
    achievementsUnlocked: 'Achievements',
    achievementsUnlockedTotal: 'Unlocked total',
    all: 'All',
    badgePath: 'Badge path',
    bronze: 'Bronze',
    collection: 'Achievement collection',
    closestUnlock: 'Closest unlock',
    common: 'Common',
    currentState: 'Current state',
    epic: 'Epic',
    featuredBadge: 'Featured badge',
    filters: 'Filters',
    gamesTried: 'Games tried',
    gold: 'Gold',
    hiddenBadge: 'Hidden badge',
    hiddenHints: 'Hint: rotate games, return on unusual days, and keep an eye on profile rituals.',
    legendary: 'Legendary',
    level: 'Level',
    locked: 'Locked',
    mastered: 'Mastered',
    nextLevel: 'Next level',
    nextRequirement: 'Next requirement',
    noRecentUnlocks: 'Recent unlocks will appear after your first checked-in session.',
    playToUnlock: 'Play to unlock',
    playerRank: 'Player rank',
    progress: 'Progress',
    progressGraph: 'Sessions played',
    rare: 'Rare',
    rankList: 'Rank list',
    rankListIntro: 'Ranks grow with XP from score, games joined, and wins.',
    rarity: 'Rarity',
    recentUnlocks: 'Recent unlocks',
    reliability: 'Reliability',
    retentionCollection: "The Trickster's Deck",
    retentionHint: 'A playful set of hidden patterns, rivals, rituals, and lucky moments from your VRena runs.',
    rewards: 'Rewards',
    rewardsHint: 'Cosmetic rewards unlock from real play progress.',
    secret: 'Secret',
    secretHint: 'Try more game types to reveal this badge.',
    sessionsPlayed: 'Sessions played',
    sessionsCreated: 'Sessions created',
    shareAchievement: 'Share achievement',
    shareAchievements: 'Share achievements',
    shareAllAchievements: 'Share all {count}',
    shareByEmail: 'Email',
    shareCopied: 'Copied',
    shareComingSoon: 'Share coming soon',
    shareToFriends: 'Share with friends',
    shareToWhatsApp: 'WhatsApp',
    shareToZalo: 'Zalo',
    shareReady: 'Share ready',
    silver: 'Silver',
    social: 'Social',
    streakBanner: 'This week',
    tapForDetails: 'Tap for details',
    trickster: 'Trickster',
    unlocked: 'Unlocked',
    unlockCelebrationDismiss: 'Keep playing',
    unlockCelebrationBatchMessage: 'A whole collection just landed in your profile.',
    unlockCelebrationBatchTitle: '{count} achievements unlocked',
    unlockCelebrationTitle: 'Achievement unlocked',
    unlockJesterMessage: 'The Jester declares this moment too shiny to keep secret.',
    unlockCondition: 'Bronze: play once. Silver: 3 plays. Gold: 5 plays. Mastered: 10 plays.',
    xp: 'XP',
  },
  vi: {
    accuracy: 'Độ chính xác',
    bestScore: 'Điểm cao nhất',
    dateUnavailable: 'Chưa có ngày',
    gamesTriedDetailHint: 'Các game được tính vào tiến độ thành tựu của bạn.',
    noGamesTried: 'Chưa có game đã check-in. Game đầu tiên bạn chơi sẽ xuất hiện tại đây.',
    noSessionsCreated: 'Bạn chưa tạo phiên chơi nào.',
    noSessionsPlayed: 'Chưa có phiên đã check-in. Các lượt chơi hoàn tất sẽ xuất hiện tại đây.',
    score: 'Điểm',
    sessionsCreatedDetailHint: 'Các phiên bạn tổ chức, kèm ngày và game đã chọn.',
    sessionsPlayedDetailHint: 'Lịch sử phiên đã check-in và kết quả được ghi nhận.',
    timesPlayed: 'Lượt chơi: {count}',
    viewDetails: 'Xem chi tiết',
    achievements: 'Thành tựu',
    achievementsEmpty: 'Check-in một phiên chơi và huy hiệu đầu tiên sẽ sáng lên tại đây.',
    achievementsHint: 'Huy hiệu game được tính từ các phiên bạn đã check-in.',
    achievementsUnlocked: 'Thành tựu',
    achievementsUnlockedTotal: 'Tổng đã mở',
    all: 'Tất cả',
    badgePath: 'Lộ trình huy hiệu',
    bronze: 'Đồng',
    collection: 'Bộ sưu tập thành tựu',
    closestUnlock: 'Sắp mở nhất',
    common: 'Phổ biến',
    currentState: 'Trạng thái',
    epic: 'Sử thi',
    featuredBadge: 'Huy hiệu nổi bật',
    filters: 'Bộ lọc',
    gamesTried: 'Game đã thử',
    gold: 'Vàng',
    hiddenBadge: 'Huy hiệu ẩn',
    hiddenHints: 'Gợi ý: đổi game, quay lại vào ngày lạ, và chú ý các nghi thức hồ sơ.',
    legendary: 'Huyền thoại',
    level: 'Cấp',
    locked: 'Đang khóa',
    mastered: 'Tinh thông',
    nextLevel: 'Cấp tiếp theo',
    nextRequirement: 'Mục tiêu tiếp theo',
    noRecentUnlocks: 'Huy hiệu mới sẽ xuất hiện sau phiên check-in đầu tiên.',
    playToUnlock: 'Chơi để mở khóa',
    playerRank: 'Hạng người chơi',
    progress: 'Tiến độ',
    progressGraph: 'Phiên đã chơi',
    rare: 'Hiếm',
    rankList: 'Danh sách hạng',
    rankListIntro: 'Hạng tăng theo XP từ điểm số, phiên đã tham gia và chiến thắng.',
    rarity: 'Độ hiếm',
    recentUnlocks: 'Mới mở',
    reliability: 'Độ tin cậy',
    retentionCollection: 'Bộ bài Trickster',
    retentionHint: 'Những dấu ấn tinh nghịch về thói quen, đối thủ, nghi thức và khoảnh khắc may mắn trong các lượt chơi VRena.',
    rewards: 'Phần thưởng',
    rewardsHint: 'Phần thưởng trang trí mở bằng tiến độ chơi thật.',
    secret: 'Bí mật',
    secretHint: 'Thử thêm nhiều thể loại game để mở huy hiệu này.',
    sessionsPlayed: 'Phiên đã chơi',
    sessionsCreated: 'Phiên đã tạo',
    shareAchievement: 'Chia sẻ thành tựu',
    shareAchievements: 'Chia sẻ thành tựu',
    shareAllAchievements: 'Chia sẻ cả {count}',
    shareByEmail: 'Email',
    shareCopied: 'Đã sao chép',
    shareComingSoon: 'Chia sẻ sắp có',
    shareToFriends: 'Khoe với bạn bè',
    shareToWhatsApp: 'WhatsApp',
    shareToZalo: 'Zalo',
    shareReady: 'Đã sẵn sàng chia sẻ',
    silver: 'Bạc',
    social: 'Xã hội',
    streakBanner: 'Tuần này',
    tapForDetails: 'Chạm để xem chi tiết',
    trickster: 'Trickster',
    unlocked: 'Đã mở',
    unlockCelebrationDismiss: 'Chơi tiếp',
    unlockCelebrationBatchMessage: 'Một bộ sưu tập mới vừa xuất hiện trong hồ sơ của bạn.',
    unlockCelebrationBatchTitle: 'Đã mở khóa {count} thành tựu',
    unlockCelebrationTitle: 'Mở khóa thành tựu',
    unlockJesterMessage: 'Jester tuyên bố khoảnh khắc này quá lấp lánh để giấu kín.',
    unlockCondition: 'Đồng: chơi 1 lần. Bạc: 3 lần. Vàng: 5 lần. Tinh thông: 10 lần.',
    xp: 'XP',
  },
  ko: {
    accuracy: '정확도',
    bestScore: '최고 점수',
    dateUnavailable: '날짜 없음',
    gamesTriedDetailHint: '업적 진행도에 반영되는 게임입니다.',
    noGamesTried: '체크인한 게임이 아직 없습니다. 첫 플레이 게임이 여기에 표시됩니다.',
    noSessionsCreated: '아직 생성한 세션이 없습니다.',
    noSessionsPlayed: '체크인한 세션이 아직 없습니다. 완료한 방문이 여기에 표시됩니다.',
    score: '점수',
    sessionsCreatedDetailHint: '직접 만든 세션의 날짜와 선택한 게임입니다.',
    sessionsPlayedDetailHint: '체크인한 세션 기록과 저장된 결과입니다.',
    timesPlayed: '플레이 횟수: {count}',
    viewDetails: '세부 정보 보기',
    achievements: '업적',
    achievementsEmpty: '세션에 체크인하면 첫 배지가 여기에 켜집니다.',
    achievementsHint: '게임 배지는 체크인한 세션을 기준으로 계산됩니다.',
    achievementsUnlocked: '업적',
    achievementsUnlockedTotal: '전체 해제',
    all: '전체',
    badgePath: '배지 경로',
    bronze: '브론즈',
    collection: '업적 컬렉션',
    closestUnlock: '가장 가까운 해제',
    common: '일반',
    currentState: '현재 상태',
    epic: '에픽',
    featuredBadge: '추천 배지',
    filters: '필터',
    gamesTried: '플레이한 게임',
    gold: '골드',
    hiddenBadge: '숨겨진 배지',
    hiddenHints: '힌트: 게임을 바꾸고, 특별한 날에 돌아오고, 프로필 습관을 살펴보세요.',
    legendary: '전설',
    level: '레벨',
    locked: '잠김',
    mastered: '마스터',
    nextLevel: '다음 레벨',
    nextRequirement: '다음 목표',
    noRecentUnlocks: '첫 체크인 세션 후 최근 해제가 표시됩니다.',
    playToUnlock: '플레이하여 잠금 해제',
    playerRank: '플레이어 랭크',
    progress: '진행도',
    progressGraph: '플레이한 세션',
    rare: '레어',
    rankList: '랭크 목록',
    rankListIntro: '랭크는 점수, 참여한 게임, 승리로 얻는 XP에 따라 올라갑니다.',
    rarity: '희귀도',
    recentUnlocks: '최근 해제',
    reliability: '신뢰도',
    retentionCollection: '트릭스터의 덱',
    retentionHint: 'VRena 플레이 속 패턴, 라이벌, 의식, 행운의 순간을 모은 장난스러운 배지입니다.',
    rewards: '보상',
    rewardsHint: '실제 플레이 진행도로 프로필 장식 보상을 해제합니다.',
    secret: '비밀',
    secretHint: '더 다양한 게임 유형을 시도하면 배지가 드러납니다.',
    sessionsPlayed: '플레이한 세션',
    sessionsCreated: '생성한 세션',
    shareAchievement: '업적 공유',
    shareAchievements: '업적 공유',
    shareAllAchievements: '{count}개 모두 공유',
    shareByEmail: '이메일',
    shareCopied: '복사됨',
    shareComingSoon: '공유 준비 중',
    shareToFriends: '친구에게 공유',
    shareToWhatsApp: 'WhatsApp',
    shareToZalo: 'Zalo',
    shareReady: '공유 준비 완료',
    silver: '실버',
    social: '소셜',
    streakBanner: '이번 주',
    tapForDetails: '탭하여 자세히',
    trickster: '트릭스터',
    unlocked: '해제됨',
    unlockCelebrationDismiss: '계속 플레이',
    unlockCelebrationBatchMessage: '새로운 업적 컬렉션이 프로필에 추가되었습니다.',
    unlockCelebrationBatchTitle: '업적 {count}개 해제',
    unlockCelebrationTitle: '업적 해제',
    unlockJesterMessage: '트릭스터가 선언합니다. 이 순간은 혼자 간직하기엔 너무 반짝입니다.',
    unlockCondition: '브론즈: 1회 플레이. 실버: 3회. 골드: 5회. 마스터: 10회.',
    xp: 'XP',
  },
  ja: {
    accuracy: '精度',
    bestScore: 'ベストスコア',
    dateUnavailable: '日付なし',
    gamesTriedDetailHint: '実績の進行に反映されるゲームです。',
    noGamesTried: 'チェックイン済みのゲームはまだありません。最初に遊んだゲームがここに表示されます。',
    noSessionsCreated: '作成したセッションはまだありません。',
    noSessionsPlayed: 'チェックイン済みセッションはまだありません。完了した来店がここに表示されます。',
    score: 'スコア',
    sessionsCreatedDetailHint: 'あなたが作成したセッションの日付と選択ゲームです。',
    sessionsPlayedDetailHint: 'チェックイン済みセッションの履歴と記録結果です。',
    timesPlayed: 'プレイ回数: {count}',
    viewDetails: '詳細を見る',
    achievements: '実績',
    achievementsEmpty: 'セッションにチェックインすると、最初のバッジがここで点灯します。',
    achievementsHint: 'ゲームバッジはチェックイン済みセッションから計算されます。',
    achievementsUnlocked: '実績',
    achievementsUnlockedTotal: '解除済み合計',
    all: 'すべて',
    badgePath: 'バッジ経路',
    bronze: 'ブロンズ',
    collection: '実績コレクション',
    closestUnlock: '次に近い解除',
    common: 'コモン',
    currentState: '現在の状態',
    epic: 'エピック',
    featuredBadge: '注目バッジ',
    filters: 'フィルター',
    gamesTried: '試したゲーム',
    gold: 'ゴールド',
    hiddenBadge: '隠しバッジ',
    hiddenHints: 'ヒント: ゲームを巡り、珍しい日に戻り、プロフィールの習慣を見てみよう。',
    legendary: 'レジェンド',
    level: 'レベル',
    locked: 'ロック中',
    mastered: 'マスター',
    nextLevel: '次のレベル',
    nextRequirement: '次の条件',
    noRecentUnlocks: '最初のチェックイン後に最近の解除が表示されます。',
    playToUnlock: 'プレイして解除',
    playerRank: 'プレイヤーランク',
    progress: '進行状況',
    progressGraph: 'プレイ済みセッション',
    rare: 'レア',
    rankList: 'ランク一覧',
    rankListIntro: 'ランクはスコア、参加ゲーム、勝利から得たXPで上がります。',
    rarity: 'レア度',
    recentUnlocks: '最近の解除',
    reliability: '信頼度',
    retentionCollection: 'トリックスターのデッキ',
    retentionHint: 'VRenaでのプレイに隠れた流れ、ライバル、儀式、幸運の瞬間を集めた遊び心あるバッジです。',
    rewards: '報酬',
    rewardsHint: '実際のプレイ進行でプロフィール装飾を解除します。',
    secret: 'シークレット',
    secretHint: 'さらに多くのゲームタイプを試すと、このバッジが現れます。',
    sessionsPlayed: 'プレイ済みセッション',
    sessionsCreated: '作成したセッション',
    shareAchievement: '実績を共有',
    shareAchievements: '実績を共有',
    shareAllAchievements: '{count}件をまとめて共有',
    shareByEmail: 'メール',
    shareCopied: 'コピー済み',
    shareComingSoon: '共有は近日対応',
    shareToFriends: '友だちに共有',
    shareToWhatsApp: 'WhatsApp',
    shareToZalo: 'Zalo',
    shareReady: '共有の準備完了',
    silver: 'シルバー',
    social: 'ソーシャル',
    streakBanner: '今週',
    tapForDetails: 'タップして詳細',
    trickster: 'トリックスター',
    unlocked: '解除済み',
    unlockCelebrationDismiss: 'プレイを続ける',
    unlockCelebrationBatchMessage: '新しい実績コレクションがプロフィールに追加されました。',
    unlockCelebrationBatchTitle: '{count}件の実績を解除',
    unlockCelebrationTitle: '実績解除',
    unlockJesterMessage: 'トリックスター曰く、この瞬間は秘密にするには輝きすぎています。',
    unlockCondition: 'ブロンズ: 1回プレイ。シルバー: 3回。ゴールド: 5回。マスター: 10回。',
    xp: 'XP',
  },
  fr: {
    accuracy: 'Précision',
    bestScore: 'Meilleur score',
    dateUnavailable: 'Date indisponible',
    gamesTriedDetailHint: 'Les jeux pris en compte dans ta progression de succès.',
    noGamesTried: 'Aucun jeu validé pour le moment. Ton premier jeu apparaîtra ici.',
    noSessionsCreated: "Tu n'as pas encore créé de session.",
    noSessionsPlayed: 'Aucune session validée pour le moment. Tes visites terminées apparaîtront ici.',
    score: 'Score',
    sessionsCreatedDetailHint: 'Les sessions que tu as organisées, avec leur date et le jeu choisi.',
    sessionsPlayedDetailHint: 'Ton historique de sessions validées et les résultats enregistrés.',
    timesPlayed: 'Parties : {count}',
    viewDetails: 'Voir les détails',
    achievements: 'Succès',
    achievementsEmpty: 'Check-in à une session et ton premier badge s’allumera ici.',
    achievementsHint: 'Les badges de jeu utilisent tes sessions validées.',
    achievementsUnlocked: 'Succès',
    achievementsUnlockedTotal: 'Total débloqué',
    all: 'Tout',
    badgePath: 'Parcours du badge',
    bronze: 'Bronze',
    collection: 'Collection de succès',
    closestUnlock: 'Déblocage proche',
    common: 'Commun',
    currentState: 'État actuel',
    epic: 'Épique',
    featuredBadge: 'Badge à la une',
    filters: 'Filtres',
    gamesTried: 'Jeux essayés',
    gold: 'Or',
    hiddenBadge: 'Badge caché',
    hiddenHints: 'Indice : varie les jeux, reviens certains jours, et observe tes rituels de profil.',
    legendary: 'Légendaire',
    level: 'Niveau',
    locked: 'Verrouillé',
    mastered: 'Maîtrisé',
    nextLevel: 'Niveau suivant',
    nextRequirement: 'Objectif suivant',
    noRecentUnlocks: 'Tes déblocages récents apparaîtront après ton premier check-in.',
    playToUnlock: 'Joue pour déverrouiller',
    playerRank: 'Rang joueur',
    progress: 'Progression',
    progressGraph: 'Sessions jouées',
    rare: 'Rare',
    rankList: 'Liste des rangs',
    rankListIntro: 'Les rangs montent avec l’XP liée au score, aux jeux rejoints et aux victoires.',
    rarity: 'Rareté',
    recentUnlocks: 'Déblocages récents',
    reliability: 'Fiabilité',
    retentionCollection: 'Le deck du Trickster',
    retentionHint: 'Une série de motifs cachés, rivaux, rituels et coups de chance tirés de tes parties VRena.',
    rewards: 'Récompenses',
    rewardsHint: 'Des cosmétiques se débloquent avec ta vraie progression.',
    secret: 'Secret',
    secretHint: 'Essaie plus de types de jeux pour révéler ce badge.',
    sessionsPlayed: 'Sessions jouées',
    sessionsCreated: 'Sessions créées',
    shareAchievement: 'Partager le succès',
    shareAchievements: 'Partager les succès',
    shareAllAchievements: 'Partager les {count}',
    shareByEmail: 'Email',
    shareCopied: 'Copié',
    shareComingSoon: 'Partage bientôt disponible',
    shareToFriends: 'Partager aux amis',
    shareToWhatsApp: 'WhatsApp',
    shareToZalo: 'Zalo',
    shareReady: 'Partage prêt',
    silver: 'Argent',
    social: 'Social',
    streakBanner: 'Cette semaine',
    tapForDetails: 'Appuie pour les détails',
    trickster: 'Trickster',
    unlocked: 'Déverrouillé',
    unlockCelebrationDismiss: 'Continuer à jouer',
    unlockCelebrationBatchMessage: 'Une nouvelle collection vient d’arriver sur ton profil.',
    unlockCelebrationBatchTitle: '{count} succès débloqués',
    unlockCelebrationTitle: 'Succès débloqué',
    unlockJesterMessage: 'Le Jester déclare ce moment trop brillant pour rester secret.',
    unlockCondition: 'Bronze : jouer 1 fois. Argent : 3 fois. Or : 5 fois. Maîtrisé : 10 fois.',
    xp: 'XP',
  },
  de: {
    accuracy: 'Genauigkeit',
    bestScore: 'Bestpunktzahl',
    dateUnavailable: 'Datum nicht verfügbar',
    gamesTriedDetailHint: 'Games, die für deinen Erfolgsfortschritt zählen.',
    noGamesTried: 'Noch keine eingecheckten Games. Dein erstes Game erscheint hier.',
    noSessionsCreated: 'Du hast noch keine Session erstellt.',
    noSessionsPlayed: 'Noch keine eingecheckten Sessions. Abgeschlossene Besuche erscheinen hier.',
    score: 'Punktzahl',
    sessionsCreatedDetailHint: 'Von dir organisierte Sessions mit Datum und ausgewähltem Game.',
    sessionsPlayedDetailHint: 'Deine eingecheckten Sessions und gespeicherten Ergebnisse.',
    timesPlayed: 'Spiele: {count}',
    viewDetails: 'Details ansehen',
    achievements: 'Erfolge',
    achievementsEmpty: 'Checke in eine Session ein, dann leuchtet dein erstes Abzeichen hier auf.',
    achievementsHint: 'Spielabzeichen basieren auf deinen eingecheckten Sessions.',
    achievementsUnlocked: 'Erfolge',
    achievementsUnlockedTotal: 'Gesamt freigeschaltet',
    all: 'Alle',
    badgePath: 'Abzeichenpfad',
    bronze: 'Bronze',
    collection: 'Erfolgssammlung',
    closestUnlock: 'Nächste Freischaltung',
    common: 'Gewöhnlich',
    currentState: 'Aktueller Status',
    epic: 'Episch',
    featuredBadge: 'Abzeichen der Woche',
    filters: 'Filter',
    gamesTried: 'Gespielte Games',
    gold: 'Gold',
    hiddenBadge: 'Verstecktes Abzeichen',
    hiddenHints: 'Hinweis: Wechsle Spiele, komm an besonderen Tagen zurück und beachte Profilrituale.',
    legendary: 'Legendär',
    level: 'Level',
    locked: 'Gesperrt',
    mastered: 'Gemeistert',
    nextLevel: 'Nächstes Level',
    nextRequirement: 'Nächstes Ziel',
    noRecentUnlocks: 'Neue Freischaltungen erscheinen nach deiner ersten eingecheckten Session.',
    playToUnlock: 'Spielen zum Freischalten',
    playerRank: 'Spielerrang',
    progress: 'Fortschritt',
    progressGraph: 'Gespielte Sessions',
    rare: 'Selten',
    rankList: 'Rangliste',
    rankListIntro: 'Ränge steigen durch XP aus Punkten, gespielten Games und Siegen.',
    rarity: 'Seltenheit',
    recentUnlocks: 'Neue Freischaltungen',
    reliability: 'Zuverlässigkeit',
    retentionCollection: 'Das Trickster-Deck',
    retentionHint: 'Verspielte Abzeichen für versteckte Muster, Rivalen, Rituale und Glücksmomente aus deinen VRena-Runden.',
    rewards: 'Belohnungen',
    rewardsHint: 'Kosmetische Belohnungen werden durch echten Fortschritt freigeschaltet.',
    secret: 'Geheim',
    secretHint: 'Probiere mehr Spieltypen aus, um dieses Abzeichen zu enthüllen.',
    sessionsPlayed: 'Gespielte Sessions',
    sessionsCreated: 'Erstellte Sessions',
    shareAchievement: 'Erfolg teilen',
    shareAchievements: 'Erfolge teilen',
    shareAllAchievements: 'Alle {count} teilen',
    shareByEmail: 'E-Mail',
    shareCopied: 'Kopiert',
    shareComingSoon: 'Teilen bald verfügbar',
    shareToFriends: 'Mit Freunden teilen',
    shareToWhatsApp: 'WhatsApp',
    shareToZalo: 'Zalo',
    shareReady: 'Teilen bereit',
    silver: 'Silber',
    social: 'Sozial',
    streakBanner: 'Diese Woche',
    tapForDetails: 'Tippen für Details',
    trickster: 'Trickster',
    unlocked: 'Freigeschaltet',
    unlockCelebrationDismiss: 'Weiterspielen',
    unlockCelebrationBatchMessage: 'Eine neue Sammlung ist gerade in deinem Profil gelandet.',
    unlockCelebrationBatchTitle: '{count} Erfolge freigeschaltet',
    unlockCelebrationTitle: 'Erfolg freigeschaltet',
    unlockJesterMessage: 'Der Jester erklärt diesen Moment für zu glänzend, um ihn geheim zu halten.',
    unlockCondition: 'Bronze: 1 Spiel. Silber: 3 Spiele. Gold: 5 Spiele. Gemeistert: 10 Spiele.',
    xp: 'XP',
  },
  it: {
    accuracy: 'Precisione',
    bestScore: 'Miglior punteggio',
    dateUnavailable: 'Data non disponibile',
    gamesTriedDetailHint: 'I giochi che contano per i progressi dei tuoi obiettivi.',
    noGamesTried: 'Nessun gioco con check-in. Il primo gioco apparirà qui.',
    noSessionsCreated: 'Non hai ancora creato una sessione.',
    noSessionsPlayed: 'Nessuna sessione con check-in. Le visite completate appariranno qui.',
    score: 'Punteggio',
    sessionsCreatedDetailHint: 'Le sessioni organizzate da te, con data e gioco selezionato.',
    sessionsPlayedDetailHint: 'La cronologia delle sessioni con check-in e i risultati registrati.',
    timesPlayed: 'Partite: {count}',
    viewDetails: 'Vedi dettagli',
    achievements: 'Obiettivi',
    achievementsEmpty: 'Fai check-in a una sessione e il primo badge si illuminerà qui.',
    achievementsHint: 'I badge dei giochi usano le sessioni con check-in.',
    achievementsUnlocked: 'Obiettivi',
    achievementsUnlockedTotal: 'Totale sbloccati',
    all: 'Tutti',
    badgePath: 'Percorso badge',
    bronze: 'Bronzo',
    collection: 'Collezione obiettivi',
    closestUnlock: 'Sblocco vicino',
    common: 'Comune',
    currentState: 'Stato attuale',
    epic: 'Epico',
    featuredBadge: 'Badge in evidenza',
    filters: 'Filtri',
    gamesTried: 'Giochi provati',
    gold: 'Oro',
    hiddenBadge: 'Badge nascosto',
    hiddenHints: 'Suggerimento: cambia giochi, torna in giorni speciali e osserva i rituali del profilo.',
    legendary: 'Leggendario',
    level: 'Livello',
    locked: 'Bloccato',
    mastered: 'Maestro',
    nextLevel: 'Prossimo livello',
    nextRequirement: 'Prossimo obiettivo',
    noRecentUnlocks: 'Gli sblocchi recenti appariranno dopo il primo check-in.',
    playToUnlock: 'Gioca per sbloccare',
    playerRank: 'Rango giocatore',
    progress: 'Progresso',
    progressGraph: 'Sessioni giocate',
    rare: 'Raro',
    rankList: 'Lista ranghi',
    rankListIntro: 'I ranghi crescono con XP da punteggio, giochi giocati e vittorie.',
    rarity: 'Rarità',
    recentUnlocks: 'Sblocchi recenti',
    reliability: 'Affidabilità',
    retentionCollection: 'Il mazzo del Trickster',
    retentionHint: 'Badge giocosi per schemi nascosti, rivali, rituali e colpi di fortuna delle tue partite VRena.',
    rewards: 'Ricompense',
    rewardsHint: 'Ricompense estetiche sbloccate dai progressi reali.',
    secret: 'Segreto',
    secretHint: 'Prova più tipi di gioco per rivelare questo badge.',
    sessionsPlayed: 'Sessioni giocate',
    sessionsCreated: 'Sessioni create',
    shareAchievement: 'Condividi obiettivo',
    shareAchievements: 'Condividi obiettivi',
    shareAllAchievements: 'Condividi tutti e {count}',
    shareByEmail: 'Email',
    shareCopied: 'Copiato',
    shareComingSoon: 'Condivisione in arrivo',
    shareToFriends: 'Condividi con amici',
    shareToWhatsApp: 'WhatsApp',
    shareToZalo: 'Zalo',
    shareReady: 'Condivisione pronta',
    silver: 'Argento',
    social: 'Sociale',
    streakBanner: 'Questa settimana',
    tapForDetails: 'Tocca per dettagli',
    trickster: 'Trickster',
    unlocked: 'Sbloccato',
    unlockCelebrationDismiss: 'Continua a giocare',
    unlockCelebrationBatchMessage: 'Una nuova collezione è appena arrivata sul tuo profilo.',
    unlockCelebrationBatchTitle: '{count} obiettivi sbloccati',
    unlockCelebrationTitle: 'Obiettivo sbloccato',
    unlockJesterMessage: 'Il Jester dichiara questo momento troppo brillante per restare segreto.',
    unlockCondition: 'Bronzo: gioca 1 volta. Argento: 3 volte. Oro: 5 volte. Maestro: 10 volte.',
    xp: 'XP',
  },
}

const tierLabels: Record<GameAchievement['tier'], keyof AchievementCopy> = {
  none: 'locked',
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
  mastered: 'mastered',
}

const rarityLabels: Record<AchievementRarity, keyof AchievementCopy> = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
}

const gamePathSteps: Array<{ labelKey: keyof AchievementCopy; target: number; tier: Exclude<GameAchievement['tier'], 'none'> }> = [
  { labelKey: 'bronze', target: 1, tier: 'bronze' },
  { labelKey: 'silver', target: 3, tier: 'silver' },
  { labelKey: 'gold', target: 5, tier: 'gold' },
  { labelKey: 'mastered', target: 10, tier: 'mastered' },
]

const rankLevels = [
  { level: '1-5', name: 'Rookie' },
  { level: '6-11', name: 'Rising Player' },
  { level: '12-19', name: 'Arena Ace' },
  { level: '20+', name: 'VR Master' },
] as const

function tierIcon(tier: GameAchievement['tier']) {
  if (tier === 'mastered') return <Crown aria-hidden="true" size={15} />
  if (tier === 'gold') return <Trophy aria-hidden="true" size={15} />
  if (tier === 'silver') return <Medal aria-hidden="true" size={15} />
  if (tier === 'bronze') return <Award aria-hidden="true" size={15} />
  return <Lock aria-hidden="true" size={15} />
}

type RetentionIconDefinition = {
  icon: LucideIcon
  name: string
}

const retentionIconByAchievementId: Record<RetentionAchievement['id'], RetentionIconDefinition> = {
  'accuracy-upgrade': { icon: Target, name: 'target' },
  'arena-regular': { icon: CalendarRange, name: 'calendar-range' },
  'back-for-more': { icon: RotateCcw, name: 'rotate-ccw' },
  'birthday-hero': { icon: CakeSlice, name: 'cake-slice' },
  'bring-the-crew': { icon: UserRoundPlus, name: 'user-round-plus' },
  'challenge-accepted': { icon: Swords, name: 'swords' },
  'club-loyalist': { icon: ShieldCheck, name: 'shield-check' },
  'clutch-player': { icon: Trophy, name: 'trophy' },
  completionist: { icon: Crown, name: 'crown' },
  'double-session-day': { icon: CalendarPlus, name: 'calendar-plus' },
  'escape-breakthrough': { icon: TimerReset, name: 'timer-reset' },
  'first-blood': { icon: BadgeCheck, name: 'badge-check' },
  'friendly-rivalry': { icon: Handshake, name: 'handshake' },
  'genre-explorer': { icon: Compass, name: 'compass' },
  'mask-mode': { icon: VenetianMask, name: 'venetian-mask' },
  'night-owl': { icon: MoonStar, name: 'moon-star' },
  'off-peak-explorer': { icon: Sun, name: 'sun' },
  'perfect-rotation': { icon: Orbit, name: 'orbit' },
  'personal-best': { icon: TrendingUp, name: 'trending-up' },
  'secret-hunter': { icon: SearchCheck, name: 'search-check' },
  specialist: { icon: Crosshair, name: 'crosshair' },
  'squad-starter': { icon: UsersRound, name: 'users-round' },
  'streak-builder': { icon: Flame, name: 'flame' },
  'team-builder': { icon: BriefcaseBusiness, name: 'briefcase-business' },
  'top-ten-moment': { icon: Medal, name: 'medal' },
  'weekly-warrior': { icon: CalendarCheck, name: 'calendar-check' },
  'weekend-raider': { icon: PartyPopper, name: 'party-popper' },
}

const retentionIconNames = Object.values(retentionIconByAchievementId).map(({ name }) => name)
if (new Set(retentionIconNames).size !== retentionIconNames.length) {
  throw new Error('Every retention achievement must use a unique icon.')
}

function retentionIcon(achievement: Pick<RetentionAchievement, 'id'>) {
  const { icon: Icon, name } = retentionIconByAchievementId[achievement.id]
  return (
    <Icon
      aria-hidden="true"
      className="retention-game-icon"
      data-achievement-icon={name}
      strokeWidth={1.9}
    />
  )
}

function progressPath(points: AchievementProgressPoint[]) {
  const width = 320
  const height = 112
  const padding = 14
  const maxValue = Math.max(1, ...points.map((point) => point.value))

  return points.map((point, index) => {
    const x = points.length === 1
      ? width / 2
      : padding + (index / (points.length - 1)) * (width - padding * 2)
    const y = height - padding - (point.value / maxValue) * (height - padding * 2)
    return { ...point, x: Math.round(x), y: Math.round(y) }
  })
}

function achievementSessionSortValue(session: AchievementSession) {
  return `${session.date ?? ''}T${session.start_time ?? ''}`
}

function achievementSessionDateLabel(session: AchievementSession, language: LanguageCode, unavailable: string) {
  if (!session.date) return unavailable
  const date = new Date(`${session.date}T${session.start_time || '00:00:00'}`)
  if (Number.isNaN(date.getTime())) return unavailable

  const formattedDate = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const time = session.start_time?.slice(0, 5)
  return time ? `${formattedDate} · ${time}` : formattedDate
}

function achievementNumericValue(value: number | string | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function AchievementAvatar({ profile }: { profile: ProfileAchievementsPanelProps['profile'] }) {
  const isAnonymous = Boolean(profile.anonymous_mode)
  const background = isAnonymous ? ANONYMOUS_MASK_COLOR : profile.avatar_color || vrenaPalette.purple[500]
  const color = isAnonymous ? ANONYMOUS_MASK_TEXT_COLOR : profile.avatar_text_color || vrenaPalette.white
  const fallbackName = profile.nickname || profile.full_name || 'VR'

  return (
    <div className="achievement-rank-avatar" style={{ background, color }}>
      {isAnonymous ? (
        <span className="avatar-emoji">{ANONYMOUS_MASK_EMOJI}</span>
      ) : profile.avatar_url ? (
        <NextImage
          alt=""
          height={92}
          src={profile.avatar_url}
          unoptimized={shouldSkipImageOptimization(profile.avatar_url)}
          width={92}
        />
      ) : profile.avatar_emoji ? (
        <span className="avatar-emoji">{profile.avatar_emoji}</span>
      ) : (
        <span>{compactInitials(profile.avatar_initials || fallbackName)}</span>
      )}
    </div>
  )
}

function profileAchievementName(profile: ProfileAchievementsPanelProps['profile']) {
  if (profile.anonymous_mode) {
    return compactDisplayName(
      profile.nickname || profile.anonymous_callsign || anonymousCallsignForId(profile.id),
      'CIPHER-291',
    )
  }

  return compactDisplayName(profile.nickname || profile.full_name || profile.phone, 'Player')
}

function applyManualGameAwards(achievements: GameAchievement[], manualAwards: ManualProfileAchievementAward[]) {
  const manualGameIds = new Set(manualAwards
    .filter((award) => award.achievement_kind === 'game')
    .map((award) => award.achievement_id))

  return achievements.map((achievement): GameAchievement => {
    if (!manualGameIds.has(achievement.game.id) || achievement.state !== 'locked') return achievement
    return {
      ...achievement,
      nextRequirement: 3,
      playedCount: Math.max(1, achievement.playedCount),
      progressPercent: 34,
      state: 'unlocked',
      tier: 'bronze',
      title: `${achievement.game.title} Rookie`,
    }
  })
}

function applyManualRetentionAwards(achievements: RetentionAchievement[], manualAwards: ManualProfileAchievementAward[]) {
  const manualRetentionIds = new Set(manualAwards
    .filter((award) => award.achievement_kind === 'retention')
    .map((award) => award.achievement_id))

  return achievements.map((achievement): RetentionAchievement => {
    if (!manualRetentionIds.has(achievement.id) || achievement.state !== 'locked') return achievement
    return {
      ...achievement,
      current: achievement.target,
      progressPercent: 100,
      state: 'unlocked',
    }
  })
}

function mergeRecentAchievements(automatic: RecentAchievement[], manualAwards: ManualProfileAchievementAward[]) {
  const manualRecent: RecentAchievement[] = manualAwards.map((award) => ({
    id: award.achievement_id,
    kind: award.achievement_kind === 'game' ? 'game' : 'retention',
    title: award.title,
    unlockedAt: award.awarded_at ? award.awarded_at.slice(0, 10) : null,
  }))
  const seen = new Set<string>()
  return [...manualRecent, ...automatic]
    .filter((achievement) => {
      const key = `${achievement.kind}:${achievement.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return Boolean(achievement.unlockedAt)
    })
    .sort((left, right) => String(right.unlockedAt).localeCompare(String(left.unlockedAt)))
    .slice(0, 4)
}

function achievementUnlockKey(kind: AchievementCelebration['kind'], id: string, tier = 'base') {
  return `${kind}:${id}:${tier || 'base'}`
}

function achievementUnlockStorageKey(profileId: string) {
  return `vrena:achievement-unlocks-seen:${profileId}`
}

function readLocalSeenUnlockKeys(profileId: string) {
  if (typeof window === 'undefined') return new Set<string>()

  try {
    const raw = window.localStorage.getItem(achievementUnlockStorageKey(profileId))
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function writeLocalSeenUnlockKeys(profileId: string, keys: Set<string>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(achievementUnlockStorageKey(profileId), JSON.stringify(Array.from(keys).slice(-160)))
  } catch {
    // Local storage can be unavailable in private modes; Supabase remains the durable store.
  }
}

export default function ProfileAchievementsPanel({
  editor,
  editorRankAction,
  editorSessionsAction,
  editorToolbar,
  language,
  manualAwardsOverride,
  mySessions,
  onJoinSession,
  onScheduleReturnReminder,
  playerGameCountOverrides,
  playerStats,
  profile,
  text,
  userId,
  venueResultsOverride,
}: ProfileAchievementsPanelProps) {
  const copy = achievementCopy[language] ?? achievementCopy.en
  const [selectedAchievement, setSelectedAchievement] = useState<GameAchievement | null>(null)
  const [selectedRetentionAchievement, setSelectedRetentionAchievement] = useState<RetentionAchievement | null>(null)
  const [selectedSummaryDetail, setSelectedSummaryDetail] = useState<AchievementSummaryDetail | null>(null)
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('all')
  const [showRankList, setShowRankList] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [sparkedAchievementId, setSparkedAchievementId] = useState('')
  const [fetchedManualAwards, setFetchedManualAwards] = useState<ManualProfileAchievementAward[]>([])
  const [fetchedVenueResults, setFetchedVenueResults] = useState<AchievementVenueResult[]>([])
  const [fetchedGameCountOverrides, setFetchedGameCountOverrides] = useState<Record<string, number>>({})
  const [seenUnlockKeys, setSeenUnlockKeys] = useState<Set<string>>(() => new Set())
  const [unlockViewsLoaded, setUnlockViewsLoaded] = useState(false)
  const [sharingAchievementKey, setSharingAchievementKey] = useState('')
  const [featuredCelebrationKey, setFeaturedCelebrationKey] = useState('')
  const [, setTapCounts] = useState<Record<string, number>>({})
  const summaryTriggerRef = useRef<HTMLButtonElement | null>(null)

  function closeSummaryDetail() {
    setSelectedSummaryDetail(null)
    window.requestAnimationFrame(() => summaryTriggerRef.current?.focus())
  }

  useEffect(() => {
    if (!selectedSummaryDetail) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedSummaryDetail(null)
        window.requestAnimationFrame(() => summaryTriggerRef.current?.focus())
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selectedSummaryDetail])

  useEffect(() => {
    if (manualAwardsOverride) return
    const profileId = profile.id || userId
    if (!profileId) return

    let cancelled = false
    void supabase
      .from('profile_achievement_awards')
      .select('id, achievement_id, achievement_kind, title, description, note, awarded_at')
      .eq('profile_id', profileId)
      .is('revoked_at', null)
      .order('awarded_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setFetchedManualAwards((data ?? []) as ManualProfileAchievementAward[])
      })

    return () => {
      cancelled = true
    }
  }, [manualAwardsOverride, profile.id, userId])

  useEffect(() => {
    if (venueResultsOverride) return
    const profileId = profile.id || userId
    if (!profileId) return

    let cancelled = false
    void supabase
      .from('venue_game_results')
      .select('id, game_slug, score, accuracy_percent, captured_at, matched_participant_id')
      .eq('profile_id', profileId)
      .order('captured_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Venue achievement results could not be loaded.', error)
          setFetchedVenueResults([])
          return
        }
        setFetchedVenueResults((data ?? []) as AchievementVenueResult[])
      })

    return () => {
      cancelled = true
    }
  }, [profile.id, userId, venueResultsOverride])

  useEffect(() => {
    if (playerGameCountOverrides || manualAwardsOverride) return
    let cancelled = false
    void supabase
      .rpc('get_my_player_game_count_overrides')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Player game progress overrides could not be loaded.', error)
          setFetchedGameCountOverrides({})
          return
        }
        setFetchedGameCountOverrides(
          data && typeof data === 'object' && !Array.isArray(data)
            ? data as Record<string, number>
            : {},
        )
      })
    return () => {
      cancelled = true
    }
  }, [manualAwardsOverride, playerGameCountOverrides, userId])

  const manualAwards = manualAwardsOverride ?? fetchedManualAwards
  const venueResults = venueResultsOverride ?? fetchedVenueResults
  const gameCountOverrides = playerGameCountOverrides ?? fetchedGameCountOverrides
  const achievementSessions = useMemo(
    () => [...mySessions, ...venueResultsAsAchievementSessions(venueResults, userId)],
    [mySessions, userId, venueResults],
  )
  const automaticAchievements = useMemo(
    () => buildGameAchievements(achievementSessions, userId, gameCountOverrides),
    [achievementSessions, gameCountOverrides, userId],
  )
  const playerBestScoreByGame = useMemo(
    () => new Map(
      (playerStats.bestByGame ?? []).flatMap(({ game, score }) => (
        typeof game === 'string' && Number.isFinite(score) ? [[game, score] as const] : []
      )),
    ),
    [playerStats.bestByGame],
  )
  const scoredAutomaticAchievements = useMemo(
    () => automaticAchievements.map((achievement) => {
      const recordedBest = playerBestScoreByGame.get(achievement.game.title)
      if (recordedBest === undefined || (achievement.bestScore !== null && achievement.bestScore >= recordedBest)) {
        return achievement
      }
      return { ...achievement, bestScore: recordedBest }
    }),
    [automaticAchievements, playerBestScoreByGame],
  )
  const automaticRetentionAchievements = useMemo(
    () => buildRetentionAchievements(achievementSessions, userId, profile, gameCountOverrides),
    [achievementSessions, gameCountOverrides, profile, userId],
  )
  const achievements = useMemo(
    () => applyManualGameAwards(scoredAutomaticAchievements, manualAwards),
    [manualAwards, scoredAutomaticAchievements],
  )
  const retentionAchievements = useMemo(
    () => applyManualRetentionAwards(automaticRetentionAchievements, manualAwards),
    [automaticRetentionAchievements, manualAwards],
  )
  const displayAchievements = useMemo(
    () => achievements.map((achievement) => localizeGameAchievement(achievement, language)),
    [achievements, language],
  )
  const displayRetentionAchievements = useMemo(
    () => retentionAchievements.map((achievement) => localizeRetentionAchievement(achievement, language)),
    [language, retentionAchievements],
  )
  const gameTitleById = useMemo(
    () => new Map<string, string>(displayAchievements.map((achievement) => [achievement.game.id, achievement.game.title])),
    [displayAchievements],
  )
  const playedSessionDetails = useMemo(
    () => [...completedAchievementSessions(achievementSessions, userId)]
      .sort((left, right) => achievementSessionSortValue(right).localeCompare(achievementSessionSortValue(left))),
    [achievementSessions, userId],
  )
  const returnMission = useMemo(
    () => buildPlayerReturnMission(completedAchievementSessions(achievementSessions, userId)),
    [achievementSessions, userId],
  )
  const returnMissionGameTitle = useMemo(() => {
    const gameId = returnMission.latestSession?.confirmed_game_id || returnMission.latestSession?.game_options?.[0]
    return (gameId && gameTitleById.get(gameId)) || returnMission.latestSession?.name || 'Wild West'
  }, [gameTitleById, returnMission.latestSession])
  const createdSessionDetails = useMemo(
    () => mySessions
      .filter((session) => session.owner_id === userId)
      .slice()
      .sort((left, right) => achievementSessionSortValue(right).localeCompare(achievementSessionSortValue(left))),
    [mySessions, userId],
  )
  const triedGameDetails = useMemo(
    () => displayAchievements
      .filter((achievement) => achievement.playedCount > 0)
      .slice()
      .sort((left, right) => right.playedCount - left.playedCount || left.game.title.localeCompare(right.game.title, language)),
    [displayAchievements, language],
  )
  const sessionsPlayed = useMemo(
    () => achievementSessions.filter((session) => session.session_participants?.some((participant) => participant.profile_id === userId && participant.checked_in)).length,
    [achievementSessions, userId],
  )
  const sessionsCreated = useMemo(
    () => mySessions.filter((session) => session.owner_id === userId).length,
    [mySessions, userId],
  )
  const summary = useMemo(() => achievementSummary(achievements, sessionsPlayed, retentionAchievements), [achievements, retentionAchievements, sessionsPlayed])
  const levelProgress = useMemo(() => profileLevelProgress(playerStats), [playerStats])
  const playerDisplayName = useMemo(() => profileAchievementName(profile), [profile])
  const graphPoints = useMemo(() => sessionsByRecentWeek(achievementSessions, userId, language), [achievementSessions, language, userId])
  const spotlight = useMemo(() => weeklyAchievementSpotlight(achievementSessions, userId, displayRetentionAchievements), [achievementSessions, displayRetentionAchievements, userId])
  const closestUnlock = useMemo(() => closestAchievement(displayAchievements, displayRetentionAchievements), [displayAchievements, displayRetentionAchievements])
  const recentUnlocks = useMemo(
    () => mergeRecentAchievements(
      recentUnlockedAchievements(achievementSessions, userId, displayAchievements, displayRetentionAchievements),
      manualAwards,
    ).map((recent) => {
      const localized = recent.kind === 'game'
        ? displayAchievements.find((achievement) => achievement.game.id === recent.id)
        : displayRetentionAchievements.find((achievement) => achievement.id === recent.id)
      return localized ? { ...recent, title: localized.title } : recent
    }),
    [achievementSessions, displayAchievements, displayRetentionAchievements, manualAwards, userId],
  )
  const milestoneRewards = useMemo(
    () => achievementMilestoneRewards(summary).map((reward) => localizeMilestoneReward(reward, language)),
    [language, summary],
  )
  const graphPathPoints = useMemo(() => progressPath(graphPoints), [graphPoints])
  const graphLine = graphPathPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const graphArea = graphPathPoints.length > 0
    ? `${graphLine} L ${graphPathPoints[graphPathPoints.length - 1].x} 112 L ${graphPathPoints[0].x} 112 Z`
    : ''
  const hasProgress = summary.sessionsPlayed > 0

  function gameTitleForSession(session: AchievementSession) {
    const gameId = session.confirmed_game_id || session.game_options?.[0]
    return (gameId && gameTitleById.get(gameId)) || session.name || copy.gamesTried
  }

  function playerResultForSession(session: AchievementSession) {
    return session.session_participants?.find((participant) => participant.profile_id === userId) ?? null
  }

  const filterOptions: Array<{ label: string; value: AchievementFilter }> = [
    { label: copy.all, value: 'all' },
    { label: copy.gamesTried, value: 'games' },
    { label: copy.trickster, value: 'trickster' },
    { label: copy.social, value: 'social' },
    { label: copy.progress, value: 'performance' },
    { label: copy.secret, value: 'hidden' },
  ]
  const showGameAchievements = achievementFilter === 'all' || achievementFilter === 'games'
  const showSecretAchievement = achievementFilter === 'all' || achievementFilter === 'hidden'
  const filteredRetentionAchievements = displayRetentionAchievements.filter((achievement) => {
    if (achievementFilter === 'all') return true
    if (achievementFilter === 'trickster') return ['comeback', 'explore', 'special'].includes(achievement.category)
    if (achievementFilter === 'hidden') return achievement.id === 'secret-hunter' || achievement.id === 'mask-mode'
    return achievement.category === achievementFilter
  })
  const achievementCelebrations = useMemo(() => {
    const gameCelebrations: AchievementCelebration[] = displayAchievements
      .filter((achievement) => achievement.state !== 'locked' && achievement.tier !== 'none')
      .map((achievement) => {
        const tierLabel = copy[tierLabels[achievement.tier]]
        const rarityLabel = copy[rarityLabels[achievementRarityForGame(achievement)]]
        const target = achievement.nextRequirement ?? (achievement.playedCount || 1)
        return {
          badgeImageUrl: achievement.game.image,
          current: achievement.playedCount,
          description: `${achievement.game.title} - ${achievement.title}`,
          id: achievement.game.id,
          key: achievementUnlockKey('game', achievement.game.id, achievement.tier),
          kind: 'game',
          kindLabel: tierLabel,
          rarityLabel,
          target,
          tier: achievement.tier,
          title: achievement.title,
        }
      })

    const retentionCelebrations: AchievementCelebration[] = displayRetentionAchievements
      .filter((achievement) => achievement.state !== 'locked')
      .map((achievement) => {
        const rarityLabel = copy[rarityLabels[achievementRarityForRetention(achievement)]]
        return {
          current: achievement.current,
          description: achievement.description,
          id: achievement.id,
          key: achievementUnlockKey('retention', achievement.id),
          kind: 'retention',
          kindLabel: copy.trickster,
          rarityLabel,
          target: achievement.target,
          tier: 'base',
          title: achievement.title,
        }
      })

    return [...gameCelebrations, ...retentionCelebrations]
  }, [copy, displayAchievements, displayRetentionAchievements])
  const celebrationByKey = useMemo(() => new Map(achievementCelebrations.map((celebration) => [celebration.key, celebration])), [achievementCelebrations])
  const pendingCelebrations = useMemo(
    () => !editor && unlockViewsLoaded
      ? achievementCelebrations.filter((celebration) => !seenUnlockKeys.has(celebration.key))
      : [],
    [achievementCelebrations, editor, seenUnlockKeys, unlockViewsLoaded],
  )
  const activeCelebration = pendingCelebrations[0] ?? null
  const featuredCelebration = pendingCelebrations.find((celebration) => celebration.key === featuredCelebrationKey)
    ?? activeCelebration
  const isCelebrationBatch = pendingCelebrations.length > 1
  const selectedAchievementCelebration = selectedAchievement
    ? celebrationByKey.get(achievementUnlockKey('game', selectedAchievement.game.id, selectedAchievement.tier))
    : null
  const selectedRetentionCelebration = selectedRetentionAchievement
    ? celebrationByKey.get(achievementUnlockKey('retention', selectedRetentionAchievement.id))
    : null

  useEffect(() => {
    const profileId = profile.id || userId
    if (!profileId) {
      window.setTimeout(() => setUnlockViewsLoaded(true), 0)
      return
    }

    let cancelled = false
    const localKeys = readLocalSeenUnlockKeys(profileId)
    window.setTimeout(() => {
      if (cancelled) return
      setSeenUnlockKeys(localKeys)
      setUnlockViewsLoaded(false)
    }, 0)

    void supabase
      .from('profile_achievement_unlock_views')
      .select('achievement_kind, achievement_id, achievement_tier, shared_at')
      .eq('profile_id', profileId)
      .then(({ data }) => {
        if (cancelled) return

        const dbKeys = new Set(localKeys)
        ;((data ?? []) as AchievementUnlockView[]).forEach((view) => {
          const kind = view.achievement_kind === 'game' ? 'game' : 'retention'
          dbKeys.add(achievementUnlockKey(kind, view.achievement_id, view.achievement_tier || 'base'))
        })
        setSeenUnlockKeys(dbKeys)
        writeLocalSeenUnlockKeys(profileId, dbKeys)
        setUnlockViewsLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [profile.id, userId])

  function openAchievement(achievement: GameAchievement) {
    if (editor) {
      const manualAward = manualAwards.find((award) => award.achievement_kind === 'game' && award.achievement_id === achievement.game.id)
      editor.onToggleAchievement({
        description: `Unlock the ${achievement.game.title} game achievement for this player.`,
        id: achievement.game.id,
        kind: 'game',
        manuallyUnlocked: Boolean(manualAward),
        title: achievement.game.title,
      })
      return
    }
    setSelectedAchievement(achievement)
    setShareStatus('')

    if (achievement.state === 'locked') return

    setTapCounts((current) => {
      const nextCount = (current[achievement.game.id] ?? 0) + 1
      if (nextCount >= 4) {
        setSparkedAchievementId(achievement.game.id)
        window.setTimeout(() => setSparkedAchievementId(''), 900)
        return { ...current, [achievement.game.id]: 0 }
      }
      return { ...current, [achievement.game.id]: nextCount }
    })
  }

  function openRetentionAchievement(achievement: RetentionAchievement) {
    if (editor) {
      const manualAward = manualAwards.find((award) => award.achievement_kind === 'retention' && award.achievement_id === achievement.id)
      const canonicalAchievement = retentionAchievements.find((candidate) => candidate.id === achievement.id) ?? achievement
      editor.onToggleAchievement({
        description: canonicalAchievement.description,
        id: achievement.id,
        kind: 'retention',
        manuallyUnlocked: Boolean(manualAward),
        title: canonicalAchievement.title,
      })
      return
    }
    setSelectedRetentionAchievement(achievement)
    setShareStatus('')

    if (achievement.state === 'locked') return

    setSparkedAchievementId(achievement.id)
    window.setTimeout(() => setSparkedAchievementId(''), 900)
  }

  async function rememberCelebrations(celebrations: AchievementCelebration[], shared = false) {
    if (celebrations.length === 0) return

    const profileId = profile.id || userId
    const nextKeys = new Set(seenUnlockKeys)
    celebrations.forEach((celebration) => nextKeys.add(celebration.key))
    setSeenUnlockKeys(nextKeys)
    if (profileId) writeLocalSeenUnlockKeys(profileId, nextKeys)

    if (!profileId) return

    const now = new Date().toISOString()
    const payload = celebrations.map((celebration) => ({
      achievement_id: celebration.id,
      achievement_kind: celebration.kind,
      achievement_tier: celebration.tier || 'base',
      first_seen_at: now,
      profile_id: profileId,
      shared_at: shared ? now : null,
    }))

    try {
      const { error } = await supabase
        .from('profile_achievement_unlock_views')
        .upsert(payload, { onConflict: 'profile_id,achievement_kind,achievement_id,achievement_tier' })

      if (!error && shared) {
        await Promise.all(celebrations.map((celebration) => supabase
          .from('profile_achievement_unlock_views')
          .update({ shared_at: now })
          .eq('profile_id', profileId)
          .eq('achievement_kind', celebration.kind)
          .eq('achievement_id', celebration.id)
          .eq('achievement_tier', celebration.tier || 'base')))
      }
    } catch {
      // The local seen key already prevents repeat popups for this browser.
    }
  }

  async function rememberCelebration(celebration: AchievementCelebration, shared = false) {
    await rememberCelebrations([celebration], shared)
  }

  function shareOptionsForCelebration(celebration: AchievementCelebration) {
    return {
      appUrl: DEFAULT_APP_URL,
      badgeImageUrl: celebration.badgeImageUrl,
      current: celebration.current,
      description: celebration.description,
      displayName: playerDisplayName,
      fileLabel: `${playerDisplayName}-${celebration.title}`,
      footer: DEFAULT_APP_URL.replace(/^https?:\/\//, ''),
      kindLabel: celebration.kindLabel,
      progressLabel: `${celebration.current}/${celebration.target} ${copy.progress.toLowerCase()}`,
      rarityLabel: celebration.rarityLabel,
      target: celebration.target,
      title: celebration.title,
    }
  }

  function shareOptionsForCelebrations(celebrations: AchievementCelebration[]): AchievementShareOptions {
    if (celebrations.length === 1) return shareOptionsForCelebration(celebrations[0])

    const count = celebrations.length
    const title = copy.unlockCelebrationBatchTitle.replace('{count}', String(count))
    const achievementList = celebrations.map((celebration) => `• ${celebration.title} — ${celebration.description}`).join('\n')
    return {
      appUrl: DEFAULT_APP_URL,
      badgeImageUrl: celebrations[0]?.badgeImageUrl,
      badgeImageUrls: celebrations.map((celebration) => celebration.badgeImageUrl),
      current: count,
      description: celebrations.map((celebration) => celebration.title).join(' · '),
      displayName: playerDisplayName,
      fileLabel: `${playerDisplayName}-${count}-achievements`,
      footer: DEFAULT_APP_URL.replace(/^https?:\/\//, ''),
      kindLabel: copy.collection,
      progressLabel: title,
      shareSummary: `${playerDisplayName} — ${title}\n${achievementList}\n${DEFAULT_APP_URL}`,
      target: count,
      title,
    }
  }

  async function shareCelebration(celebration: AchievementCelebration, markShared = false) {
    setShareStatus('')
    setSharingAchievementKey(celebration.key)
    try {
      const shareResult = await shareAchievementImage(shareOptionsForCelebration(celebration))
      if (shareResult === 'ready') {
        setShareStatus(copy.shareReady)
        window.setTimeout(() => setShareStatus(''), 1800)
      }
      if (shareResult !== 'cancelled' && markShared) {
        await rememberCelebration(celebration, true)
      }
    } catch {
      const summary = achievementShareText(shareOptionsForCelebration(celebration))
      await navigator.clipboard?.writeText(summary)
      setShareStatus(copy.shareCopied)
      window.setTimeout(() => setShareStatus(''), 1800)
      if (markShared) {
        await rememberCelebration(celebration, true)
      }
    } finally {
      setSharingAchievementKey('')
    }
  }

  async function shareCelebrations(celebrations: AchievementCelebration[], markShared = false) {
    if (celebrations.length === 1) {
      await shareCelebration(celebrations[0], markShared)
      return
    }

    setShareStatus('')
    setSharingAchievementKey('batch')
    const options = shareOptionsForCelebrations(celebrations)
    try {
      const shareResult = await shareAchievementImage(options)
      if (shareResult === 'ready') {
        setShareStatus(copy.shareReady)
        window.setTimeout(() => setShareStatus(''), 1800)
      }
      if (shareResult !== 'cancelled' && markShared) {
        await rememberCelebrations(celebrations, true)
      }
    } catch {
      await navigator.clipboard?.writeText(options.shareSummary ?? achievementShareText(options))
      setShareStatus(copy.shareCopied)
      window.setTimeout(() => setShareStatus(''), 1800)
      if (markShared) {
        await rememberCelebrations(celebrations, true)
      }
    } finally {
      setSharingAchievementKey('')
    }
  }

  async function dismissCelebrations(celebrations: AchievementCelebration[]) {
    await rememberCelebrations(celebrations)
  }

  async function shareAchievementSummary() {
    const celebration: AchievementCelebration = {
      current: summary.totalUnlocked,
      description: `${summary.totalUnlocked}/${summary.availableAchievements} ${copy.achievementsUnlockedTotal.toLowerCase()} - ${levelProgress.rankLabel}`,
      id: 'summary',
      key: 'summary',
      kind: 'retention',
      kindLabel: copy.playerRank,
      rarityLabel: `${copy.level} ${levelProgress.level}`,
      target: summary.availableAchievements || 1,
      tier: 'base',
      title: `${playerDisplayName} - ${copy.achievements}`,
    }
    await shareCelebration(celebration)
  }

  function openDirectShare(channel: 'email' | 'whatsapp' | 'zalo', celebration: AchievementCelebration) {
    const options = shareOptionsForCelebration(celebration)
    openAchievementShareChannel(channel, achievementShareText(options), options.title)
  }

  function openDirectBatchShare(channel: 'email' | 'whatsapp' | 'zalo', celebrations: AchievementCelebration[]) {
    const options = shareOptionsForCelebrations(celebrations)
    openAchievementShareChannel(channel, options.shareSummary ?? achievementShareText(options), options.title)
    void rememberCelebrations(celebrations, true)
  }

  const celebrationStageItems = featuredCelebration
    ? [
        featuredCelebration,
        ...pendingCelebrations.filter((celebration) => celebration.key !== featuredCelebration.key),
      ].slice(0, 3)
    : []

  return (
    <div className="profile-achievements-panel">
      {editorToolbar}
      {!editor && onJoinSession && onScheduleReturnReminder && (
        <PlayerReturnMissionCard
          gameTitle={returnMissionGameTitle}
          language={language}
          mission={returnMission}
          onJoinSession={onJoinSession}
          onScheduleReminder={onScheduleReturnReminder}
          userId={userId}
        />
      )}
      <div className="achievement-rank-card">
        <div className="achievement-rank-main">
          <div className="achievement-rank-ring" style={{ '--rank-progress': `${levelProgress.progressToNext}%` } as CSSProperties}>
            <AchievementAvatar profile={profile} />
          </div>
          <div className="achievement-rank-copy">
            <span>{copy.playerRank}</span>
            <div className="achievement-rank-name-row">
              <strong>{playerDisplayName}</strong>
              {editorRankAction}
            </div>
            <small>{levelProgress.rankLabel} · {copy.level} {levelProgress.level}</small>
            <div className="achievement-xp-track" aria-label={`${levelProgress.progressToNext}% ${copy.progress}`}>
              <span style={{ width: `${levelProgress.progressToNext}%` }} />
            </div>
            <small>{levelProgress.xp.toLocaleString(language)} / {levelProgress.nextLevelXp.toLocaleString(language)} {copy.xp} - {copy.nextLevel}</small>
            <button className="achievement-rank-list-button" onClick={() => setShowRankList(true)} type="button">
              <Trophy aria-hidden="true" size={14} />
              {copy.rankList}
            </button>
            <button className="achievement-rank-list-button achievement-share-button" onClick={() => void shareAchievementSummary()} type="button">
              <Share2 aria-hidden="true" size={14} />
              {copy.shareAchievements}
            </button>
          </div>
        </div>
        <div className="achievement-rank-badge" aria-hidden="true">
          <ShieldCheck size={34} />
          <span>{levelProgress.level}</span>
        </div>
      </div>

      {showRankList && (
        <div className="modal-backdrop" onClick={() => setShowRankList(false)}>
          <div className="achievement-rank-list-sheet achievement-detail-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowRankList(false)} type="button" aria-label={text.close}>
              <X aria-hidden="true" size={18} />
            </button>
            <div className="achievement-detail-copy">
              <span className="achievement-tier-pill">
                <ShieldCheck aria-hidden="true" size={15} />
                {copy.playerRank}
              </span>
              <h3>{copy.rankList}</h3>
              <strong>{copy.rankListIntro}</strong>
              <div className="achievement-rank-list">
                {rankLevels.map((rank) => (
                  <span className={levelProgress.rankLabel === rank.name ? 'active' : ''} key={rank.name}>
                    <ShieldCheck aria-hidden="true" size={18} />
                    <strong>{rank.name}</strong>
                    <small>{copy.level} {rank.level}</small>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="achievement-summary-grid" aria-label={copy.achievementsHint}>
        <button
          aria-haspopup="dialog"
          aria-label={`${copy.viewDetails}: ${copy.sessionsPlayed}`}
          className="achievement-summary-card achievement-summary-action"
          onClick={(event) => {
            summaryTriggerRef.current = event.currentTarget
            setSelectedSummaryDetail('sessions-played')
          }}
          type="button"
        >
          <Gamepad2 aria-hidden="true" size={18} />
          <strong>{summary.sessionsPlayed}</strong>
          <span>{copy.sessionsPlayed}</span>
          <ChevronRight aria-hidden="true" className="achievement-summary-action-icon" size={17} />
        </button>
        <button
          aria-haspopup="dialog"
          aria-label={`${copy.viewDetails}: ${copy.gamesTried}`}
          className="achievement-summary-card achievement-summary-action"
          onClick={(event) => {
            summaryTriggerRef.current = event.currentTarget
            setSelectedSummaryDetail('games-tried')
          }}
          type="button"
        >
          <Target aria-hidden="true" size={18} />
          <strong>{summary.gamesTried}/{summary.totalGames}</strong>
          <span>{copy.gamesTried}</span>
          <ChevronRight aria-hidden="true" className="achievement-summary-action-icon" size={17} />
        </button>
        <button
          aria-haspopup="dialog"
          aria-label={`${copy.viewDetails}: ${copy.sessionsCreated}`}
          className="achievement-summary-card achievement-summary-action"
          onClick={(event) => {
            summaryTriggerRef.current = event.currentTarget
            setSelectedSummaryDetail('sessions-created')
          }}
          type="button"
        >
          <CalendarPlus aria-hidden="true" size={18} />
          <strong>{sessionsCreated}</strong>
          <span>{copy.sessionsCreated}</span>
          <ChevronRight aria-hidden="true" className="achievement-summary-action-icon" size={17} />
        </button>
        <div className="achievement-summary-card achievement-summary-progress-card">
          <Award aria-hidden="true" size={18} />
          <strong>{summary.totalUnlocked}/{summary.availableAchievements}</strong>
          <span>{copy.achievementsUnlockedTotal}</span>
          <span className="achievement-mini-progress" aria-hidden="true">
            <span style={{ width: `${summary.availableAchievements > 0 ? Math.round((summary.totalUnlocked / summary.availableAchievements) * 100) : 0}%` }} />
          </span>
        </div>
        {typeof playerStats.reliabilityScore === 'number' && playerStats.reliabilityScore > 0 && (
          <div className="achievement-summary-card">
            <ShieldCheck aria-hidden="true" size={18} />
            <strong>{formatWholePercent(playerStats.reliabilityScore)}</strong>
            <span>{copy.reliability}</span>
          </div>
        )}
      </div>

      {selectedSummaryDetail && (
        <div className="modal-backdrop" onClick={closeSummaryDetail}>
          <div
            aria-labelledby="achievement-summary-detail-title"
            aria-modal="true"
            className="achievement-detail-sheet achievement-summary-detail-sheet"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button
              aria-label={text.close}
              autoFocus
              className="modal-close"
              onClick={closeSummaryDetail}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
            <div className="achievement-summary-detail-head">
              <span className="achievement-summary-detail-icon" aria-hidden="true">
                {selectedSummaryDetail === 'sessions-played' ? <Gamepad2 size={24} /> : selectedSummaryDetail === 'games-tried' ? <Target size={24} /> : <CalendarPlus size={24} />}
              </span>
              <div>
                <span className="achievement-tier-pill">{copy.viewDetails}</span>
                <h3 id="achievement-summary-detail-title">
                  {selectedSummaryDetail === 'sessions-played' ? copy.sessionsPlayed : selectedSummaryDetail === 'games-tried' ? copy.gamesTried : copy.sessionsCreated}
                </h3>
                <p className="muted">
                  {selectedSummaryDetail === 'sessions-played' ? copy.sessionsPlayedDetailHint : selectedSummaryDetail === 'games-tried' ? copy.gamesTriedDetailHint : copy.sessionsCreatedDetailHint}
                </p>
              </div>
            </div>

            {selectedSummaryDetail === 'sessions-played' && (
              <div className="achievement-summary-detail-list">
                {playedSessionDetails.length > 0 ? playedSessionDetails.map((session, index) => {
                  const result = playerResultForSession(session)
                  const score = achievementNumericValue(result?.score)
                  const accuracy = achievementNumericValue(result?.accuracy_percent)
                  return (
                    <article className="achievement-summary-detail-row" key={session.id || `${achievementSessionSortValue(session)}-${index}`}>
                      <span className="achievement-summary-row-icon" aria-hidden="true"><Gamepad2 size={18} /></span>
                      <div>
                        <strong>{session.name || gameTitleForSession(session)}</strong>
                        <small>{achievementSessionDateLabel(session, language, copy.dateUnavailable)}</small>
                        <span className="achievement-summary-row-meta">
                          {score !== null && <span>{copy.score}: {score.toLocaleString(language)}</span>}
                          {accuracy !== null && <span>{copy.accuracy}: {formatWholePercent(accuracy)}</span>}
                        </span>
                      </div>
                    </article>
                  )
                }) : (
                  <p className="notice compact-notice achievement-summary-detail-empty">{copy.noSessionsPlayed}</p>
                )}
              </div>
            )}

            {selectedSummaryDetail === 'games-tried' && (
              <div className="achievement-summary-detail-list">
                {triedGameDetails.length > 0 ? triedGameDetails.map((achievement) => (
                  <article className="achievement-summary-detail-row" key={achievement.game.id}>
                    <span className="achievement-summary-game-art">
                      <NextImage alt="" fill sizes="52px" src={achievement.game.image} />
                    </span>
                    <div>
                      <strong>{achievement.game.title}</strong>
                      <small>{copy.timesPlayed.replace('{count}', String(achievement.playedCount))}</small>
                      {achievement.bestScore !== null && (
                        <span className="achievement-summary-row-meta">
                          <span>{copy.bestScore}: {achievement.bestScore.toLocaleString(language)}</span>
                        </span>
                      )}
                    </div>
                    <span className="achievement-tier-pill">{copy[tierLabels[achievement.tier]]}</span>
                  </article>
                )) : (
                  <p className="notice compact-notice achievement-summary-detail-empty">{copy.noGamesTried}</p>
                )}
              </div>
            )}

            {selectedSummaryDetail === 'sessions-created' && (
              <div className="achievement-summary-detail-list">
                {createdSessionDetails.length > 0 ? createdSessionDetails.map((session, index) => (
                  <article className="achievement-summary-detail-row" key={session.id || `${achievementSessionSortValue(session)}-${index}`}>
                    <span className="achievement-summary-row-icon" aria-hidden="true"><CalendarPlus size={18} /></span>
                    <div>
                      <strong>{session.name || gameTitleForSession(session)}</strong>
                      <small>{achievementSessionDateLabel(session, language, copy.dateUnavailable)}</small>
                      {session.name && (
                        <span className="achievement-summary-row-meta"><span>{gameTitleForSession(session)}</span></span>
                      )}
                    </div>
                  </article>
                )) : (
                  <p className="notice compact-notice achievement-summary-detail-empty">{copy.noSessionsCreated}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="achievement-insights-grid">
        <div className="achievement-insight-card achievement-spotlight-card">
          <span className="achievement-insight-label"><Sparkles aria-hidden="true" size={15} />{copy.featuredBadge}</span>
          <strong>{spotlight.title}</strong>
          <small>{spotlight.description}</small>
          <span className="achievement-mini-progress" aria-hidden="true">
            <span style={{ width: `${spotlight.progressPercent}%` }} />
          </span>
          <small>{spotlight.current}/{spotlight.target}</small>
        </div>
        {closestUnlock && (
          <div className="achievement-insight-card">
            <span className="achievement-insight-label"><Target aria-hidden="true" size={15} />{copy.closestUnlock}</span>
            <strong>{closestUnlock.title}</strong>
            <small>{closestUnlock.current}/{closestUnlock.target}</small>
            <span className="achievement-mini-progress" aria-hidden="true">
              <span style={{ width: `${closestUnlock.progressPercent}%` }} />
            </span>
          </div>
        )}
        <div className="achievement-insight-card achievement-streak-card">
          <span className="achievement-insight-label"><Flame aria-hidden="true" size={15} />{copy.streakBanner}</span>
          <strong>{spotlight.progressPercent >= 100 ? copy.unlocked : copy.playToUnlock}</strong>
          <small>{spotlight.description}</small>
        </div>
      </div>

      <div className="achievement-progress-card achievement-recent-card">
        <div className="achievement-section-head">
          <div>
            <h3>{copy.recentUnlocks}</h3>
            <p className="muted">{copy.achievementsHint}</p>
          </div>
        </div>
        {recentUnlocks.length > 0 ? (
          <div className="achievement-recent-list">
            {recentUnlocks.map((achievement) => (
              <span className="achievement-recent-item" key={`${achievement.kind}-${achievement.id}`}>
                <Trophy aria-hidden="true" size={16} />
                <strong>{achievement.title}</strong>
                {achievement.unlockedAt && <small>{achievement.unlockedAt}</small>}
              </span>
            ))}
          </div>
        ) : (
          <p className="notice compact-notice">{copy.noRecentUnlocks}</p>
        )}
      </div>

      <div className="achievement-progress-card achievement-rewards-card">
        <div className="achievement-section-head">
          <div>
            <h3>{copy.rewards}</h3>
            <p className="muted">{copy.rewardsHint}</p>
          </div>
        </div>
        <div className="achievement-rewards-grid">
          {milestoneRewards.map((reward) => (
            <span className={['achievement-reward-card', reward.unlocked ? 'reward-unlocked' : 'reward-locked'].join(' ')} key={reward.id}>
              {reward.unlocked ? <Crown aria-hidden="true" size={18} /> : <Lock aria-hidden="true" size={18} />}
              <strong>{reward.title}</strong>
              <small>{reward.description}</small>
              <span className="achievement-mini-progress" aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.round((reward.current / reward.target) * 100))}%` }} />
              </span>
              <small>{Math.min(reward.current, reward.target)}/{reward.target}</small>
            </span>
          ))}
        </div>
      </div>

      <div className="achievement-progress-card">
        <div className="achievement-section-head">
          <div>
            <h3>{copy.progressGraph}</h3>
            <p className="muted">{copy.achievementsHint}</p>
          </div>
          {editorSessionsAction}
        </div>
        {hasProgress ? (
          <div className="achievement-chart">
            <svg aria-hidden="true" viewBox="0 0 320 112">
              <defs>
                <linearGradient id="achievementLineGradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={vrenaPalette.cyan[500]} />
                  <stop offset="100%" stopColor={vrenaPalette.purple[500]} />
                </linearGradient>
              </defs>
              <path className="achievement-chart-area" d={graphArea} />
              <path className="achievement-chart-line" d={graphLine} />
              {graphPathPoints.map((point) => (
                <circle className="achievement-chart-dot" cx={point.x} cy={point.y} key={point.label} r="4" />
              ))}
            </svg>
            <div className="achievement-chart-labels">
              {graphPoints.map((point) => (
                <span key={point.label}>
                  <strong>{point.value}</strong>
                  {point.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="notice">{copy.achievementsEmpty}</p>
        )}
      </div>

      <div className="achievement-collection-card">
        <div className="achievement-section-head">
          <div>
            <h3>{copy.collection}</h3>
            <p className="muted">{copy.achievementsHint}</p>
          </div>
          <div className="achievement-collection-counts">
            <span><Award size={14} />{summary.achievementsUnlocked}</span>
            <span><Crown size={14} />{summary.masteredCount}</span>
          </div>
        </div>
        <div className="achievement-filter-bar" aria-label={copy.filters}>
          {filterOptions.map((option) => (
            <button
              className={achievementFilter === option.value ? 'active' : ''}
              key={option.value}
              onClick={() => setAchievementFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="achievement-grid">
          {showGameAchievements && displayAchievements.map((achievement) => {
            const rarity = achievementRarityForGame(achievement)
            return (
            <button
              className={[
                'achievement-card',
                `achievement-${achievement.state}`,
                achievement.tier !== 'none' ? `achievement-tier-${achievement.tier}` : '',
                sparkedAchievementId === achievement.game.id ? 'achievement-sparked' : '',
                editor?.pendingAchievementKeys.has(`game:${achievement.game.id}`) ? 'achievement-pending-change' : '',
              ].filter(Boolean).join(' ')}
              aria-label={editor ? `${achievement.game.title}. ${manualAwards.some((award) => award.achievement_kind === 'game' && award.achievement_id === achievement.game.id) ? 'Remove manual unlock' : 'Add manual unlock'}` : undefined}
              key={achievement.game.id}
              onClick={() => openAchievement(achievement)}
              type="button"
            >
              <span className="achievement-image-wrap">
                <NextImage alt="" fill sizes="(max-width: 720px) 44vw, 180px" src={achievement.game.image} />
                <span className="achievement-image-mask" />
                {achievement.state === 'locked' && <Lock className="achievement-lock" aria-hidden="true" size={20} />}
              </span>
              <span className="achievement-card-body">
                <span className="achievement-tier-pill">
                  {tierIcon(achievement.tier)}
                  {copy[tierLabels[achievement.tier]]}
                </span>
                <span className={`achievement-rarity-pill rarity-${rarity}`}>{copy[rarityLabels[rarity]]}</span>
                <strong>{achievement.game.title}</strong>
                <small>{achievement.state === 'locked' ? copy.playToUnlock : achievement.title}</small>
                <span className="achievement-mini-progress" aria-hidden="true">
                  <span style={{ width: `${achievement.progressPercent}%` }} />
                </span>
                <small>{achievement.playedCount}/{achievement.nextRequirement ?? 10}</small>
              </span>
            </button>
          )})}
          {showSecretAchievement && <button className="achievement-card achievement-secret" onClick={() => setSparkedAchievementId('secret')} type="button">
            <span className="achievement-secret-mark">
              <Sparkles aria-hidden="true" size={24} />
              <strong>???</strong>
            </span>
            <span className="achievement-card-body">
              <span className="achievement-tier-pill"><Star aria-hidden="true" size={15} />{copy.secret}</span>
              <strong>{copy.hiddenBadge}</strong>
              <small>{copy.secretHint}</small>
              <span className="achievement-mini-progress" aria-hidden="true"><span style={{ width: summary.gamesTried >= 3 ? '100%' : `${Math.round((summary.gamesTried / 3) * 100)}%` }} /></span>
              <small>{summary.gamesTried}/3</small>
            </span>
          </button>}
        </div>
      </div>

      {(achievementFilter === 'all' || achievementFilter !== 'games') && (
      <div className="achievement-collection-card retention-achievements-card">
        <div className="achievement-section-head">
          <div>
            <h3>{copy.retentionCollection}</h3>
            <p className="muted">{copy.retentionHint}</p>
          </div>
          <div className="achievement-collection-counts">
            <span><Flame size={14} />{displayRetentionAchievements.filter((achievement) => achievement.state !== 'locked').length}</span>
          </div>
        </div>
        <div className="retention-achievement-grid">
          {filteredRetentionAchievements.map((achievement) => {
            const rarity = achievementRarityForRetention(achievement)
            return (
            <button
              className={[
                'retention-achievement-card',
                `retention-${achievement.category}`,
                achievement.state === 'locked' ? 'retention-locked' : 'retention-unlocked',
                sparkedAchievementId === achievement.id ? 'achievement-sparked' : '',
                editor?.pendingAchievementKeys.has(`retention:${achievement.id}`) ? 'achievement-pending-change' : '',
              ].filter(Boolean).join(' ')}
              aria-label={editor ? `${achievement.title}. ${manualAwards.some((award) => award.achievement_kind === 'retention' && award.achievement_id === achievement.id) ? 'Remove manual unlock' : 'Add manual unlock'}` : undefined}
              key={achievement.id}
              onClick={() => openRetentionAchievement(achievement)}
              type="button"
            >
              <span className="retention-achievement-icon">
                {retentionIcon(achievement)}
              </span>
              <span className="retention-achievement-copy">
                <strong>{achievement.title}</strong>
                <span className={`achievement-rarity-pill rarity-${rarity}`}>{copy[rarityLabels[rarity]]}</span>
                <small>{achievement.description}</small>
                <span className="achievement-mini-progress" aria-hidden="true">
                  <span style={{ width: `${achievement.progressPercent}%` }} />
                </span>
                <small>{achievement.current}/{achievement.target}</small>
              </span>
            </button>
          )})}
        </div>
      </div>
      )}

      {selectedAchievement && (
        <div className="modal-backdrop" onClick={() => setSelectedAchievement(null)}>
          <div className="achievement-detail-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedAchievement(null)} type="button" aria-label={text.close}>
              <X aria-hidden="true" size={18} />
            </button>
            <div className={`achievement-detail-badge achievement-${selectedAchievement.state}`}>
              <NextImage alt="" fill sizes="240px" src={selectedAchievement.game.image} />
              <span className="achievement-image-mask" />
            </div>
            <div className="achievement-detail-copy">
              <span className="achievement-tier-pill">
                {tierIcon(selectedAchievement.tier)}
                {copy[tierLabels[selectedAchievement.tier]]}
              </span>
              <span className={`achievement-rarity-pill rarity-${achievementRarityForGame(selectedAchievement)}`}>
                {copy.rarity}: {copy[rarityLabels[achievementRarityForGame(selectedAchievement)]]}
              </span>
              <h3>{selectedAchievement.game.title}</h3>
              <strong>{selectedAchievement.title}</strong>
              <div className="achievement-path" aria-label={copy.badgePath}>
                {gamePathSteps.map((step) => (
                  <span
                    className={selectedAchievement.playedCount >= step.target ? 'active' : ''}
                    key={step.tier}
                  >
                    {tierIcon(step.tier)}
                    <small>{copy[step.labelKey]}</small>
                    <em>{step.target}</em>
                  </span>
                ))}
              </div>
              <dl className="achievement-detail-list">
                <div>
                  <dt>{copy.currentState}</dt>
                  <dd>{selectedAchievement.state === 'locked' ? copy.locked : selectedAchievement.state === 'mastered' ? copy.mastered : copy.unlocked}</dd>
                </div>
                <div>
                  <dt>{copy.unlockCondition}</dt>
                  <dd>{copy.unlockCondition}</dd>
                </div>
                <div>
                  <dt>{copy.progress}</dt>
                  <dd>{selectedAchievement.playedCount}/{selectedAchievement.nextRequirement ?? 10}</dd>
                </div>
                <div>
                  <dt>{copy.nextRequirement}</dt>
                  <dd>{selectedAchievement.nextRequirement ? `${selectedAchievement.nextRequirement} ${copy.sessionsPlayed.toLowerCase()}` : copy.mastered}</dd>
                </div>
                <div>
                  <dt>{copy.bestScore}</dt>
                  <dd>{selectedAchievement.bestScore === null ? '—' : selectedAchievement.bestScore.toLocaleString(language)}</dd>
                </div>
              </dl>
              {selectedAchievementCelebration && (
                <div className="achievement-share-actions">
                  <button
                    className="secondary small-button"
                    disabled={sharingAchievementKey === selectedAchievementCelebration.key}
                    onClick={() => void shareCelebration(selectedAchievementCelebration)}
                    type="button"
                  >
                    <Share2 aria-hidden="true" size={15} />
                    {shareStatus || copy.shareAchievement}
                  </button>
                  <button className="secondary small-button" onClick={() => openDirectShare('whatsapp', selectedAchievementCelebration)} type="button">
                    <MessageCircle aria-hidden="true" size={15} />
                    {copy.shareToWhatsApp}
                  </button>
                  <button className="secondary small-button achievement-zalo-button" onClick={() => openDirectShare('zalo', selectedAchievementCelebration)} type="button">
                    <NextImage aria-hidden="true" alt="" className="achievement-zalo-icon" height={18} src="/brand/zalo-blue.svg" width={18} />
                    {copy.shareToZalo}
                  </button>
                  <button className="secondary small-button" onClick={() => openDirectShare('email', selectedAchievementCelebration)} type="button">
                    <Mail aria-hidden="true" size={15} />
                    {copy.shareByEmail}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedRetentionAchievement && (
        <div className="modal-backdrop" onClick={() => setSelectedRetentionAchievement(null)}>
          <div className="achievement-detail-sheet retention-detail-sheet" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedRetentionAchievement(null)} type="button" aria-label={text.close}>
              <X aria-hidden="true" size={18} />
            </button>
            <div className={[
              'retention-detail-badge',
              `retention-${selectedRetentionAchievement.category}`,
              selectedRetentionAchievement.state === 'locked' ? 'retention-locked' : 'retention-unlocked',
            ].join(' ')}>
              {retentionIcon(selectedRetentionAchievement)}
            </div>
            <div className="achievement-detail-copy">
              <span className="achievement-tier-pill">
                {selectedRetentionAchievement.state === 'locked' ? <Lock aria-hidden="true" size={15} /> : <Trophy aria-hidden="true" size={15} />}
                {selectedRetentionAchievement.state === 'locked' ? copy.locked : copy.unlocked}
              </span>
              <span className={`achievement-rarity-pill rarity-${achievementRarityForRetention(selectedRetentionAchievement)}`}>
                {copy.rarity}: {copy[rarityLabels[achievementRarityForRetention(selectedRetentionAchievement)]]}
              </span>
              <h3>{selectedRetentionAchievement.title}</h3>
              <strong>{selectedRetentionAchievement.description}</strong>
              <dl className="achievement-detail-list">
                <div>
                  <dt>{copy.currentState}</dt>
                  <dd>{selectedRetentionAchievement.state === 'locked' ? copy.locked : copy.unlocked}</dd>
                </div>
                <div>
                  <dt>{copy.progress}</dt>
                  <dd>{selectedRetentionAchievement.current}/{selectedRetentionAchievement.target}</dd>
                </div>
                <div>
                  <dt>{copy.nextRequirement}</dt>
                  <dd>{selectedRetentionAchievement.state === 'locked' ? selectedRetentionAchievement.description : copy.unlocked}</dd>
                </div>
              </dl>
              {selectedRetentionAchievement.id === 'secret-hunter' && <p className="notice compact-notice">{copy.hiddenHints}</p>}
              {selectedRetentionCelebration && (
                <div className="achievement-share-actions">
                  <button
                    className="secondary small-button"
                    disabled={sharingAchievementKey === selectedRetentionCelebration.key}
                    onClick={() => void shareCelebration(selectedRetentionCelebration)}
                    type="button"
                  >
                    <Share2 aria-hidden="true" size={15} />
                    {shareStatus || copy.shareAchievement}
                  </button>
                  <button className="secondary small-button" onClick={() => openDirectShare('whatsapp', selectedRetentionCelebration)} type="button">
                    <MessageCircle aria-hidden="true" size={15} />
                    {copy.shareToWhatsApp}
                  </button>
                  <button className="secondary small-button achievement-zalo-button" onClick={() => openDirectShare('zalo', selectedRetentionCelebration)} type="button">
                    <NextImage aria-hidden="true" alt="" className="achievement-zalo-icon" height={18} src="/brand/zalo-blue.svg" width={18} />
                    {copy.shareToZalo}
                  </button>
                  <button className="secondary small-button" onClick={() => openDirectShare('email', selectedRetentionCelebration)} type="button">
                    <Mail aria-hidden="true" size={15} />
                    {copy.shareByEmail}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeCelebration && featuredCelebration && (
        <div
          className="modal-backdrop achievement-celebration-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="achievement-unlock-title"
          onClick={() => void dismissCelebrations(pendingCelebrations)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            void dismissCelebrations(pendingCelebrations)
          }}
        >
          <div
            className={`achievement-detail-sheet achievement-unlock-sheet${isCelebrationBatch ? ' achievement-unlock-batch' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              autoFocus
              className="modal-close achievement-unlock-close"
              onClick={() => void dismissCelebrations(pendingCelebrations)}
              type="button"
              aria-label={text.close}
            >
              <X aria-hidden="true" size={18} />
            </button>
            <div className="achievement-unlock-stage" aria-hidden="true">
              <span className="achievement-confetti-dot dot-one" />
              <span className="achievement-confetti-dot dot-two" />
              <span className="achievement-confetti-dot dot-three" />
              <div className="achievement-unlock-badge-stack">
                {celebrationStageItems.map((celebration, index) => (
                  <div
                    className="achievement-unlock-badge"
                    data-stack-index={index}
                    key={celebration.key}
                  >
                    {celebration.badgeImageUrl ? (
                      <NextImage alt="" fill sizes="(max-width: 719px) 170px, 260px" src={celebration.badgeImageUrl} />
                    ) : (
                      <Sparkles size={72} />
                    )}
                    <span className="achievement-image-mask" />
                  </div>
                ))}
              </div>
              {isCelebrationBatch && (
                <span className="achievement-unlock-count">
                  <Sparkles size={16} />
                  {pendingCelebrations.length}
                </span>
              )}
            </div>
            <div className="achievement-detail-copy achievement-unlock-copy">
              <span className="achievement-tier-pill">
                <Sparkles aria-hidden="true" size={15} />
                {copy.unlockCelebrationTitle}
              </span>
              <h3 id="achievement-unlock-title">
                {isCelebrationBatch
                  ? copy.unlockCelebrationBatchTitle.replace('{count}', String(pendingCelebrations.length))
                  : featuredCelebration.title}
              </h3>
              <strong>{isCelebrationBatch ? copy.unlockCelebrationBatchMessage : copy.unlockJesterMessage}</strong>
              {isCelebrationBatch ? (
                <div className="achievement-unlock-list" role="list">
                  {pendingCelebrations.map((celebration) => (
                    <button
                      aria-current={featuredCelebration.key === celebration.key ? 'true' : undefined}
                      className={featuredCelebration.key === celebration.key ? 'active' : ''}
                      key={celebration.key}
                      onClick={() => setFeaturedCelebrationKey(celebration.key)}
                      type="button"
                    >
                      <span className="achievement-unlock-list-art">
                        {celebration.badgeImageUrl ? (
                          <NextImage alt="" fill sizes="48px" src={celebration.badgeImageUrl} />
                        ) : (
                          <Sparkles aria-hidden="true" size={22} />
                        )}
                      </span>
                      <span className="achievement-unlock-list-copy">
                        <strong>{celebration.title}</strong>
                        <small>{celebration.rarityLabel || celebration.kindLabel} · {celebration.description}</small>
                      </span>
                      <span className="achievement-unlock-list-check" aria-hidden="true"><Check size={14} /></span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="notice compact-notice">{featuredCelebration.description}</p>
              )}
              <div className="achievement-unlock-share-panel">
                <button
                  className="primary achievement-unlock-share-primary"
                  disabled={sharingAchievementKey === (isCelebrationBatch ? 'batch' : featuredCelebration.key)}
                  onClick={() => void shareCelebrations(pendingCelebrations, true)}
                  type="button"
                >
                  <Share2 aria-hidden="true" size={18} />
                  <span>
                    {shareStatus || (isCelebrationBatch
                      ? copy.shareAllAchievements.replace('{count}', String(pendingCelebrations.length))
                      : copy.shareToFriends)}
                  </span>
                </button>
                <div className="achievement-share-actions achievement-unlock-channels">
                  <button
                    className="secondary small-button"
                    onClick={() => isCelebrationBatch
                      ? openDirectBatchShare('whatsapp', pendingCelebrations)
                      : openDirectShare('whatsapp', featuredCelebration)}
                    type="button"
                  >
                    <MessageCircle aria-hidden="true" size={17} />
                    {copy.shareToWhatsApp}
                  </button>
                  <button
                    className="secondary small-button achievement-zalo-button"
                    onClick={() => isCelebrationBatch
                      ? openDirectBatchShare('zalo', pendingCelebrations)
                      : openDirectShare('zalo', featuredCelebration)}
                    type="button"
                  >
                    <NextImage aria-hidden="true" alt="" className="achievement-zalo-icon" height={18} src="/brand/zalo-blue.svg" width={18} />
                    {copy.shareToZalo}
                  </button>
                  <button
                    className="secondary small-button"
                    onClick={() => isCelebrationBatch
                      ? openDirectBatchShare('email', pendingCelebrations)
                      : openDirectShare('email', featuredCelebration)}
                    type="button"
                  >
                    <Mail aria-hidden="true" size={17} />
                    {copy.shareByEmail}
                  </button>
                </div>
              </div>
              <button
                className="achievement-dismiss-button"
                onClick={() => void dismissCelebrations(pendingCelebrations)}
                type="button"
              >
                {copy.unlockCelebrationDismiss}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
