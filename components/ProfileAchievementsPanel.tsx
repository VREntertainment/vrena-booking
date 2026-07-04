'use client'

import NextImage from 'next/image'
import {
  Award,
  Crown,
  Flame,
  Gamepad2,
  Lock,
  Medal,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
} from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import type { LanguageCode } from '../lib/i18n/languages'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import {
  achievementMilestoneRewards,
  achievementRarityForGame,
  achievementRarityForRetention,
  achievementSummary,
  buildGameAchievements,
  buildRetentionAchievements,
  closestAchievement,
  profileLevelProgress,
  recentUnlockedAchievements,
  sessionsByRecentWeek,
  weeklyAchievementSpotlight,
  type AchievementProgressPoint,
  type AchievementRarity,
  type AchievementSession,
  type GameAchievement,
  type RetentionAchievement,
} from '../lib/profileAchievements'
import { ANONYMOUS_MASK_COLOR, ANONYMOUS_MASK_EMOJI, ANONYMOUS_MASK_TEXT_COLOR, compactInitials } from '../lib/bookingWidgetDomain'
import { formatWholePercent } from '../lib/playerStatsShare'
import { shouldSkipImageOptimization } from './AvatarNode'

type ProfileAchievementsPanelProps = {
  language: LanguageCode
  mySessions: AchievementSession[]
  playerStats: {
    averageAccuracy?: number | null
    gamesJoined?: number | null
    reliabilityScore?: number | null
    totalScore?: number | null
    wins?: number | null
  }
  profile: {
    anonymous_mode?: boolean | null
    avatar_color?: string | null
    avatar_emoji?: string | null
    avatar_initials?: string | null
    avatar_text_color?: string | null
    avatar_url?: string | null
    birthday?: string | null
    full_name?: string | null
    id?: string | null
    nickname?: string | null
  }
  text: TranslationMap
  userId: string
}

type AchievementCopy = {
  achievements: string
  achievementsEmpty: string
  achievementsHint: string
  achievementsUnlocked: string
  all: string
  badgePath: string
  bronze: string
  collection: string
  closestUnlock: string
  common: string
  currentState: string
  epic: string
  featuredBadge: string
  filters: string
  gamesTried: string
  gold: string
  hiddenBadge: string
  hiddenHints: string
  legendary: string
  level: string
  locked: string
  mastered: string
  nextLevel: string
  nextRequirement: string
  noRecentUnlocks: string
  playToUnlock: string
  playerRank: string
  progress: string
  progressGraph: string
  rare: string
  rarity: string
  recentUnlocks: string
  reliability: string
  retentionCollection: string
  retentionHint: string
  rewards: string
  rewardsHint: string
  secret: string
  secretHint: string
  sessionsPlayed: string
  shareAchievement: string
  shareCopied: string
  shareComingSoon: string
  silver: string
  social: string
  streakBanner: string
  tapForDetails: string
  trickster: string
  unlocked: string
  unlockCondition: string
  xp: string
}

type AchievementFilter = 'all' | 'games' | 'trickster' | 'social' | 'performance' | 'hidden'

const achievementCopy: Record<LanguageCode, AchievementCopy> = {
  en: {
    achievements: 'Achievements',
    achievementsEmpty: 'Check in to a session and your first badge will light up here.',
    achievementsHint: 'Game badges are powered by your checked-in sessions.',
    achievementsUnlocked: 'Achievements',
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
    shareAchievement: 'Share achievement',
    shareCopied: 'Copied',
    shareComingSoon: 'Share coming soon',
    silver: 'Silver',
    social: 'Social',
    streakBanner: 'This week',
    tapForDetails: 'Tap for details',
    trickster: 'Trickster',
    unlocked: 'Unlocked',
    unlockCondition: 'Bronze: play once. Silver: 3 plays. Gold: 5 plays. Mastered: 10 plays.',
    xp: 'XP',
  },
  vi: {
    achievements: 'Thành tựu',
    achievementsEmpty: 'Check-in một phiên chơi và huy hiệu đầu tiên sẽ sáng lên tại đây.',
    achievementsHint: 'Huy hiệu game được tính từ các phiên bạn đã check-in.',
    achievementsUnlocked: 'Thành tựu',
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
    shareAchievement: 'Chia sẻ thành tựu',
    shareCopied: 'Đã sao chép',
    shareComingSoon: 'Chia sẻ sắp có',
    silver: 'Bạc',
    social: 'Xã hội',
    streakBanner: 'Tuần này',
    tapForDetails: 'Chạm để xem chi tiết',
    trickster: 'Trickster',
    unlocked: 'Đã mở',
    unlockCondition: 'Đồng: chơi 1 lần. Bạc: 3 lần. Vàng: 5 lần. Tinh thông: 10 lần.',
    xp: 'XP',
  },
  ko: {
    achievements: '업적',
    achievementsEmpty: '세션에 체크인하면 첫 배지가 여기에 켜집니다.',
    achievementsHint: '게임 배지는 체크인한 세션을 기준으로 계산됩니다.',
    achievementsUnlocked: '업적',
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
    shareAchievement: '업적 공유',
    shareCopied: '복사됨',
    shareComingSoon: '공유 준비 중',
    silver: '실버',
    social: '소셜',
    streakBanner: '이번 주',
    tapForDetails: '탭하여 자세히',
    trickster: '트릭스터',
    unlocked: '해제됨',
    unlockCondition: '브론즈: 1회 플레이. 실버: 3회. 골드: 5회. 마스터: 10회.',
    xp: 'XP',
  },
  ja: {
    achievements: '実績',
    achievementsEmpty: 'セッションにチェックインすると、最初のバッジがここで点灯します。',
    achievementsHint: 'ゲームバッジはチェックイン済みセッションから計算されます。',
    achievementsUnlocked: '実績',
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
    shareAchievement: '実績を共有',
    shareCopied: 'コピー済み',
    shareComingSoon: '共有は近日対応',
    silver: 'シルバー',
    social: 'ソーシャル',
    streakBanner: '今週',
    tapForDetails: 'タップして詳細',
    trickster: 'トリックスター',
    unlocked: '解除済み',
    unlockCondition: 'ブロンズ: 1回プレイ。シルバー: 3回。ゴールド: 5回。マスター: 10回。',
    xp: 'XP',
  },
  fr: {
    achievements: 'Succès',
    achievementsEmpty: 'Check-in à une session et ton premier badge s’allumera ici.',
    achievementsHint: 'Les badges de jeu utilisent tes sessions validées.',
    achievementsUnlocked: 'Succès',
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
    shareAchievement: 'Partager le succès',
    shareCopied: 'Copié',
    shareComingSoon: 'Partage bientôt disponible',
    silver: 'Argent',
    social: 'Social',
    streakBanner: 'Cette semaine',
    tapForDetails: 'Appuie pour les détails',
    trickster: 'Trickster',
    unlocked: 'Déverrouillé',
    unlockCondition: 'Bronze : jouer 1 fois. Argent : 3 fois. Or : 5 fois. Maîtrisé : 10 fois.',
    xp: 'XP',
  },
  de: {
    achievements: 'Erfolge',
    achievementsEmpty: 'Checke in eine Session ein, dann leuchtet dein erstes Abzeichen hier auf.',
    achievementsHint: 'Spielabzeichen basieren auf deinen eingecheckten Sessions.',
    achievementsUnlocked: 'Erfolge',
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
    shareAchievement: 'Erfolg teilen',
    shareCopied: 'Kopiert',
    shareComingSoon: 'Teilen bald verfügbar',
    silver: 'Silber',
    social: 'Sozial',
    streakBanner: 'Diese Woche',
    tapForDetails: 'Tippen für Details',
    trickster: 'Trickster',
    unlocked: 'Freigeschaltet',
    unlockCondition: 'Bronze: 1 Spiel. Silber: 3 Spiele. Gold: 5 Spiele. Gemeistert: 10 Spiele.',
    xp: 'XP',
  },
  it: {
    achievements: 'Obiettivi',
    achievementsEmpty: 'Fai check-in a una sessione e il primo badge si illuminerà qui.',
    achievementsHint: 'I badge dei giochi usano le sessioni con check-in.',
    achievementsUnlocked: 'Obiettivi',
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
    shareAchievement: 'Condividi obiettivo',
    shareCopied: 'Copiato',
    shareComingSoon: 'Condivisione in arrivo',
    silver: 'Argento',
    social: 'Sociale',
    streakBanner: 'Questa settimana',
    tapForDetails: 'Tocca per dettagli',
    trickster: 'Trickster',
    unlocked: 'Sbloccato',
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

function tierIcon(tier: GameAchievement['tier']) {
  if (tier === 'mastered') return <Crown aria-hidden="true" size={15} />
  if (tier === 'gold') return <Trophy aria-hidden="true" size={15} />
  if (tier === 'silver') return <Medal aria-hidden="true" size={15} />
  if (tier === 'bronze') return <Award aria-hidden="true" size={15} />
  return <Lock aria-hidden="true" size={15} />
}

const gameIconByAchievementId: Record<string, string> = {
  'accuracy-upgrade': 'targeting',
  'arena-regular': 'tarot-wheel',
  'back-for-more': 'footprint',
  'birthday-hero': 'crowned-heart',
  'bring-the-crew': 'backup',
  'challenge-accepted': 'dagger-rose',
  'club-loyalist': 'riot-shield',
  'clutch-player': 'sprint',
  completionist: 'crowned-heart',
  'double-session-day': 'tarot-wheel',
  'escape-breakthrough': 'hourglass',
  'first-blood': 'medallist',
  'friendly-rivalry': 'dagger-rose',
  'genre-explorer': 'dice',
  'mask-mode': 'domino-mask',
  'night-owl': 'tarot-moon',
  'off-peak-explorer': 'sunrise',
  'perfect-rotation': 'dice',
  'personal-best': 'medallist',
  'secret-hunter': 'magnifying-glass',
  specialist: 'targeting',
  'squad-starter': 'team-idea',
  'streak-builder': 'sprint',
  'team-builder': 'briefcase',
  'top-ten-moment': 'medallist',
  'weekly-warrior': 'gamepad',
  'weekend-raider': 'gamepad',
}

function retentionIcon(achievement: Pick<RetentionAchievement, 'id' | 'title'>) {
  const iconId = gameIconByAchievementId[achievement.id] ?? 'gamepad'
  return (
    <span
      aria-hidden="true"
      className={`retention-game-icon retention-game-icon-${iconId}`}
      title={achievement.title}
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

function AchievementAvatar({ profile }: { profile: ProfileAchievementsPanelProps['profile'] }) {
  const isAnonymous = Boolean(profile.anonymous_mode)
  const background = isAnonymous ? ANONYMOUS_MASK_COLOR : profile.avatar_color || '#3059ff'
  const color = isAnonymous ? ANONYMOUS_MASK_TEXT_COLOR : profile.avatar_text_color || '#ffffff'
  const fallbackName = profile.nickname || profile.full_name || 'VR'

  return (
    <div className="achievement-rank-avatar" style={{ background, color }}>
      {isAnonymous ? (
        <span>{ANONYMOUS_MASK_EMOJI}</span>
      ) : profile.avatar_url ? (
        <NextImage
          alt=""
          height={92}
          src={profile.avatar_url}
          unoptimized={shouldSkipImageOptimization(profile.avatar_url)}
          width={92}
        />
      ) : profile.avatar_emoji ? (
        <span>{profile.avatar_emoji}</span>
      ) : (
        <span>{compactInitials(profile.avatar_initials || fallbackName)}</span>
      )}
    </div>
  )
}

export default function ProfileAchievementsPanel({
  language,
  mySessions,
  playerStats,
  profile,
  text,
  userId,
}: ProfileAchievementsPanelProps) {
  const copy = achievementCopy[language] ?? achievementCopy.en
  const [selectedAchievement, setSelectedAchievement] = useState<GameAchievement | null>(null)
  const [selectedRetentionAchievement, setSelectedRetentionAchievement] = useState<RetentionAchievement | null>(null)
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('all')
  const [shareStatus, setShareStatus] = useState('')
  const [sparkedAchievementId, setSparkedAchievementId] = useState('')
  const [, setTapCounts] = useState<Record<string, number>>({})

  const achievements = useMemo(() => buildGameAchievements(mySessions, userId), [mySessions, userId])
  const retentionAchievements = useMemo(() => buildRetentionAchievements(mySessions, userId, profile), [mySessions, profile, userId])
  const sessionsPlayed = useMemo(
    () => mySessions.filter((session) => session.session_participants?.some((participant) => participant.profile_id === userId && participant.checked_in)).length,
    [mySessions, userId],
  )
  const summary = useMemo(() => achievementSummary(achievements, sessionsPlayed, retentionAchievements), [achievements, retentionAchievements, sessionsPlayed])
  const levelProgress = useMemo(() => profileLevelProgress(playerStats), [playerStats])
  const graphPoints = useMemo(() => sessionsByRecentWeek(mySessions, userId, language), [language, mySessions, userId])
  const spotlight = useMemo(() => weeklyAchievementSpotlight(mySessions, userId, retentionAchievements), [mySessions, retentionAchievements, userId])
  const closestUnlock = useMemo(() => closestAchievement(achievements, retentionAchievements), [achievements, retentionAchievements])
  const recentUnlocks = useMemo(
    () => recentUnlockedAchievements(mySessions, userId, achievements, retentionAchievements),
    [achievements, mySessions, retentionAchievements, userId],
  )
  const milestoneRewards = useMemo(() => achievementMilestoneRewards(summary), [summary])
  const graphPathPoints = useMemo(() => progressPath(graphPoints), [graphPoints])
  const graphLine = graphPathPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const graphArea = graphPathPoints.length > 0
    ? `${graphLine} L ${graphPathPoints[graphPathPoints.length - 1].x} 112 L ${graphPathPoints[0].x} 112 Z`
    : ''
  const hasProgress = summary.sessionsPlayed > 0
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
  const filteredRetentionAchievements = retentionAchievements.filter((achievement) => {
    if (achievementFilter === 'all') return true
    if (achievementFilter === 'trickster') return ['comeback', 'explore', 'special'].includes(achievement.category)
    if (achievementFilter === 'hidden') return achievement.id === 'secret-hunter' || achievement.id === 'mask-mode'
    return achievement.category === achievementFilter
  })

  function openAchievement(achievement: GameAchievement) {
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
    setSelectedRetentionAchievement(achievement)
    setShareStatus('')

    if (achievement.state === 'locked') return

    setSparkedAchievementId(achievement.id)
    window.setTimeout(() => setSparkedAchievementId(''), 900)
  }

  async function shareAchievement(title: string, description: string) {
    const shareText = `${title} - ${description}`
    const nav = typeof navigator !== 'undefined' ? navigator : null
    try {
      if (nav && 'share' in nav && typeof nav.share === 'function') {
        await nav.share({
          text: shareText,
          title,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        })
      } else if (nav?.clipboard) {
        await nav.clipboard.writeText(shareText)
        setShareStatus(copy.shareCopied)
        window.setTimeout(() => setShareStatus(''), 1600)
      }
    } catch {
      if (nav?.clipboard) {
        await nav.clipboard.writeText(shareText)
        setShareStatus(copy.shareCopied)
        window.setTimeout(() => setShareStatus(''), 1600)
      }
    }
  }

  return (
    <div className="profile-achievements-panel">
      <div className="achievement-rank-card">
        <div className="achievement-rank-main">
          <div className="achievement-rank-ring" style={{ '--rank-progress': `${levelProgress.progressToNext}%` } as CSSProperties}>
            <AchievementAvatar profile={profile} />
          </div>
          <div className="achievement-rank-copy">
            <span>{copy.playerRank}</span>
            <strong>{levelProgress.rankLabel}</strong>
            <small>{copy.level} {levelProgress.level}</small>
            <div className="achievement-xp-track" aria-label={`${levelProgress.progressToNext}% ${copy.progress}`}>
              <span style={{ width: `${levelProgress.progressToNext}%` }} />
            </div>
            <small>{levelProgress.xp.toLocaleString(language)} / {levelProgress.nextLevelXp.toLocaleString(language)} {copy.xp} - {copy.nextLevel}</small>
          </div>
        </div>
        <div className="achievement-rank-badge" aria-hidden="true">
          <ShieldCheck size={34} />
          <span>{levelProgress.level}</span>
        </div>
      </div>

      <div className="achievement-summary-grid" aria-label={copy.achievementsHint}>
        <div className="achievement-summary-card">
          <Gamepad2 aria-hidden="true" size={18} />
          <strong>{summary.sessionsPlayed}</strong>
          <span>{copy.sessionsPlayed}</span>
        </div>
        <div className="achievement-summary-card">
          <Target aria-hidden="true" size={18} />
          <strong>{summary.gamesTried}/{summary.totalGames}</strong>
          <span>{copy.gamesTried}</span>
        </div>
        <div className="achievement-summary-card">
          <Trophy aria-hidden="true" size={18} />
          <strong>{summary.achievementsUnlocked}</strong>
          <span>{copy.achievementsUnlocked}</span>
        </div>
        {typeof playerStats.reliabilityScore === 'number' && playerStats.reliabilityScore > 0 && (
          <div className="achievement-summary-card">
            <ShieldCheck aria-hidden="true" size={18} />
            <strong>{formatWholePercent(playerStats.reliabilityScore)}</strong>
            <span>{copy.reliability}</span>
          </div>
        )}
      </div>

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
        </div>
        {hasProgress ? (
          <div className="achievement-chart">
            <svg aria-hidden="true" viewBox="0 0 320 112">
              <defs>
                <linearGradient id="achievementLineGradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#00aeb3" />
                  <stop offset="100%" stopColor="#3059ff" />
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
          {showGameAchievements && achievements.map((achievement) => {
            const rarity = achievementRarityForGame(achievement)
            return (
            <button
              className={[
                'achievement-card',
                `achievement-${achievement.state}`,
                achievement.tier !== 'none' ? `achievement-tier-${achievement.tier}` : '',
                sparkedAchievementId === achievement.game.id ? 'achievement-sparked' : '',
              ].filter(Boolean).join(' ')}
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
            <span><Flame size={14} />{retentionAchievements.filter((achievement) => achievement.state !== 'locked').length}</span>
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
              ].filter(Boolean).join(' ')}
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
              </dl>
              {selectedAchievement.bestScore !== null && <p className="notice compact-notice">{text.bestScores}: {selectedAchievement.bestScore}</p>}
              <button
                className="secondary small-button"
                onClick={() => shareAchievement(selectedAchievement.title, `${selectedAchievement.game.title} ${selectedAchievement.playedCount}/${selectedAchievement.nextRequirement ?? 10}`)}
                type="button"
              >
                <Share2 aria-hidden="true" size={15} />
                {shareStatus || copy.shareAchievement}
              </button>
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
              <button
                className="secondary small-button"
                onClick={() => shareAchievement(selectedRetentionAchievement.title, `${selectedRetentionAchievement.description} ${selectedRetentionAchievement.current}/${selectedRetentionAchievement.target}`)}
                type="button"
              >
                <Share2 aria-hidden="true" size={15} />
                {shareStatus || copy.shareAchievement}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
