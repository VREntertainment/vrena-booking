'use client'

import NextImage from 'next/image'
import {
  Activity,
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  Cake,
  CalendarCheck,
  CalendarHeart,
  Clock3,
  Club,
  Crosshair,
  Crown,
  Flame,
  Footprints,
  Gauge,
  Gamepad2,
  Handshake,
  Lock,
  Medal,
  Moon,
  Repeat2,
  RotateCcw,
  SearchCheck,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Target,
  TimerReset,
  Trophy,
  UserPlus,
  UsersRound,
  VenetianMask,
  X,
  Zap,
} from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import type { LanguageCode } from '../lib/i18n/languages'
import type { TranslationMap } from '../lib/i18n/loadTranslation'
import {
  achievementSummary,
  buildGameAchievements,
  buildRetentionAchievements,
  profileLevelProgress,
  sessionsByRecentWeek,
  type AchievementProgressPoint,
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
  bronze: string
  collection: string
  currentState: string
  gamesTried: string
  gold: string
  hiddenBadge: string
  level: string
  locked: string
  mastered: string
  nextLevel: string
  nextRequirement: string
  playToUnlock: string
  playerRank: string
  progress: string
  progressGraph: string
  reliability: string
  retentionCollection: string
  retentionHint: string
  secret: string
  secretHint: string
  sessionsPlayed: string
  shareComingSoon: string
  silver: string
  tapForDetails: string
  unlocked: string
  unlockCondition: string
  xp: string
}

const achievementCopy: Record<LanguageCode, AchievementCopy> = {
  en: {
    achievements: 'Achievements',
    achievementsEmpty: 'Check in to a session and your first badge will light up here.',
    achievementsHint: 'Game badges are powered by your checked-in sessions.',
    achievementsUnlocked: 'Achievements',
    bronze: 'Bronze',
    collection: 'Achievement collection',
    currentState: 'Current state',
    gamesTried: 'Games tried',
    gold: 'Gold',
    hiddenBadge: 'Hidden badge',
    level: 'Level',
    locked: 'Locked',
    mastered: 'Mastered',
    nextLevel: 'Next level',
    nextRequirement: 'Next requirement',
    playToUnlock: 'Play to unlock',
    playerRank: 'Player rank',
    progress: 'Progress',
    progressGraph: 'Sessions played',
    reliability: 'Reliability',
    retentionCollection: "The Trickster's Deck",
    retentionHint: 'A playful set of hidden patterns, rivals, rituals, and lucky moments from your VRena runs.',
    secret: 'Secret',
    secretHint: 'Try more game types to reveal this badge.',
    sessionsPlayed: 'Sessions played',
    shareComingSoon: 'Share coming soon',
    silver: 'Silver',
    tapForDetails: 'Tap for details',
    unlocked: 'Unlocked',
    unlockCondition: 'Bronze: play once. Silver: 3 plays. Gold: 5 plays. Mastered: 10 plays.',
    xp: 'XP',
  },
  vi: {
    achievements: 'Thành tựu',
    achievementsEmpty: 'Check-in một phiên chơi và huy hiệu đầu tiên sẽ sáng lên tại đây.',
    achievementsHint: 'Huy hiệu game được tính từ các phiên bạn đã check-in.',
    achievementsUnlocked: 'Thành tựu',
    bronze: 'Đồng',
    collection: 'Bộ sưu tập thành tựu',
    currentState: 'Trạng thái',
    gamesTried: 'Game đã thử',
    gold: 'Vàng',
    hiddenBadge: 'Huy hiệu ẩn',
    level: 'Cấp',
    locked: 'Đang khóa',
    mastered: 'Tinh thông',
    nextLevel: 'Cấp tiếp theo',
    nextRequirement: 'Mục tiêu tiếp theo',
    playToUnlock: 'Chơi để mở khóa',
    playerRank: 'Hạng người chơi',
    progress: 'Tiến độ',
    progressGraph: 'Phiên đã chơi',
    reliability: 'Độ tin cậy',
    retentionCollection: 'Bộ bài Trickster',
    retentionHint: 'Những dấu ấn tinh nghịch về thói quen, đối thủ, nghi thức và khoảnh khắc may mắn trong các lượt chơi VRena.',
    secret: 'Bí mật',
    secretHint: 'Thử thêm nhiều thể loại game để mở huy hiệu này.',
    sessionsPlayed: 'Phiên đã chơi',
    shareComingSoon: 'Chia sẻ sắp có',
    silver: 'Bạc',
    tapForDetails: 'Chạm để xem chi tiết',
    unlocked: 'Đã mở',
    unlockCondition: 'Đồng: chơi 1 lần. Bạc: 3 lần. Vàng: 5 lần. Tinh thông: 10 lần.',
    xp: 'XP',
  },
  ko: {
    achievements: '업적',
    achievementsEmpty: '세션에 체크인하면 첫 배지가 여기에 켜집니다.',
    achievementsHint: '게임 배지는 체크인한 세션을 기준으로 계산됩니다.',
    achievementsUnlocked: '업적',
    bronze: '브론즈',
    collection: '업적 컬렉션',
    currentState: '현재 상태',
    gamesTried: '플레이한 게임',
    gold: '골드',
    hiddenBadge: '숨겨진 배지',
    level: '레벨',
    locked: '잠김',
    mastered: '마스터',
    nextLevel: '다음 레벨',
    nextRequirement: '다음 목표',
    playToUnlock: '플레이하여 잠금 해제',
    playerRank: '플레이어 랭크',
    progress: '진행도',
    progressGraph: '플레이한 세션',
    reliability: '신뢰도',
    retentionCollection: '트릭스터의 덱',
    retentionHint: 'VRena 플레이 속 패턴, 라이벌, 의식, 행운의 순간을 모은 장난스러운 배지입니다.',
    secret: '비밀',
    secretHint: '더 다양한 게임 유형을 시도하면 배지가 드러납니다.',
    sessionsPlayed: '플레이한 세션',
    shareComingSoon: '공유 준비 중',
    silver: '실버',
    tapForDetails: '탭하여 자세히',
    unlocked: '해제됨',
    unlockCondition: '브론즈: 1회 플레이. 실버: 3회. 골드: 5회. 마스터: 10회.',
    xp: 'XP',
  },
  ja: {
    achievements: '実績',
    achievementsEmpty: 'セッションにチェックインすると、最初のバッジがここで点灯します。',
    achievementsHint: 'ゲームバッジはチェックイン済みセッションから計算されます。',
    achievementsUnlocked: '実績',
    bronze: 'ブロンズ',
    collection: '実績コレクション',
    currentState: '現在の状態',
    gamesTried: '試したゲーム',
    gold: 'ゴールド',
    hiddenBadge: '隠しバッジ',
    level: 'レベル',
    locked: 'ロック中',
    mastered: 'マスター',
    nextLevel: '次のレベル',
    nextRequirement: '次の条件',
    playToUnlock: 'プレイして解除',
    playerRank: 'プレイヤーランク',
    progress: '進行状況',
    progressGraph: 'プレイ済みセッション',
    reliability: '信頼度',
    retentionCollection: 'トリックスターのデッキ',
    retentionHint: 'VRenaでのプレイに隠れた流れ、ライバル、儀式、幸運の瞬間を集めた遊び心あるバッジです。',
    secret: 'シークレット',
    secretHint: 'さらに多くのゲームタイプを試すと、このバッジが現れます。',
    sessionsPlayed: 'プレイ済みセッション',
    shareComingSoon: '共有は近日対応',
    silver: 'シルバー',
    tapForDetails: 'タップして詳細',
    unlocked: '解除済み',
    unlockCondition: 'ブロンズ: 1回プレイ。シルバー: 3回。ゴールド: 5回。マスター: 10回。',
    xp: 'XP',
  },
  fr: {
    achievements: 'Succès',
    achievementsEmpty: 'Check-in à une session et ton premier badge s’allumera ici.',
    achievementsHint: 'Les badges de jeu utilisent tes sessions validées.',
    achievementsUnlocked: 'Succès',
    bronze: 'Bronze',
    collection: 'Collection de succès',
    currentState: 'État actuel',
    gamesTried: 'Jeux essayés',
    gold: 'Or',
    hiddenBadge: 'Badge caché',
    level: 'Niveau',
    locked: 'Verrouillé',
    mastered: 'Maîtrisé',
    nextLevel: 'Niveau suivant',
    nextRequirement: 'Objectif suivant',
    playToUnlock: 'Joue pour déverrouiller',
    playerRank: 'Rang joueur',
    progress: 'Progression',
    progressGraph: 'Sessions jouées',
    reliability: 'Fiabilité',
    retentionCollection: 'Le deck du Trickster',
    retentionHint: 'Une série de motifs cachés, rivaux, rituels et coups de chance tirés de tes parties VRena.',
    secret: 'Secret',
    secretHint: 'Essaie plus de types de jeux pour révéler ce badge.',
    sessionsPlayed: 'Sessions jouées',
    shareComingSoon: 'Partage bientôt disponible',
    silver: 'Argent',
    tapForDetails: 'Appuie pour les détails',
    unlocked: 'Déverrouillé',
    unlockCondition: 'Bronze : jouer 1 fois. Argent : 3 fois. Or : 5 fois. Maîtrisé : 10 fois.',
    xp: 'XP',
  },
  de: {
    achievements: 'Erfolge',
    achievementsEmpty: 'Checke in eine Session ein, dann leuchtet dein erstes Abzeichen hier auf.',
    achievementsHint: 'Spielabzeichen basieren auf deinen eingecheckten Sessions.',
    achievementsUnlocked: 'Erfolge',
    bronze: 'Bronze',
    collection: 'Erfolgssammlung',
    currentState: 'Aktueller Status',
    gamesTried: 'Gespielte Games',
    gold: 'Gold',
    hiddenBadge: 'Verstecktes Abzeichen',
    level: 'Level',
    locked: 'Gesperrt',
    mastered: 'Gemeistert',
    nextLevel: 'Nächstes Level',
    nextRequirement: 'Nächstes Ziel',
    playToUnlock: 'Spielen zum Freischalten',
    playerRank: 'Spielerrang',
    progress: 'Fortschritt',
    progressGraph: 'Gespielte Sessions',
    reliability: 'Zuverlässigkeit',
    retentionCollection: 'Das Trickster-Deck',
    retentionHint: 'Verspielte Abzeichen für versteckte Muster, Rivalen, Rituale und Glücksmomente aus deinen VRena-Runden.',
    secret: 'Geheim',
    secretHint: 'Probiere mehr Spieltypen aus, um dieses Abzeichen zu enthüllen.',
    sessionsPlayed: 'Gespielte Sessions',
    shareComingSoon: 'Teilen bald verfügbar',
    silver: 'Silber',
    tapForDetails: 'Tippen für Details',
    unlocked: 'Freigeschaltet',
    unlockCondition: 'Bronze: 1 Spiel. Silber: 3 Spiele. Gold: 5 Spiele. Gemeistert: 10 Spiele.',
    xp: 'XP',
  },
  it: {
    achievements: 'Obiettivi',
    achievementsEmpty: 'Fai check-in a una sessione e il primo badge si illuminerà qui.',
    achievementsHint: 'I badge dei giochi usano le sessioni con check-in.',
    achievementsUnlocked: 'Obiettivi',
    bronze: 'Bronzo',
    collection: 'Collezione obiettivi',
    currentState: 'Stato attuale',
    gamesTried: 'Giochi provati',
    gold: 'Oro',
    hiddenBadge: 'Badge nascosto',
    level: 'Livello',
    locked: 'Bloccato',
    mastered: 'Maestro',
    nextLevel: 'Prossimo livello',
    nextRequirement: 'Prossimo obiettivo',
    playToUnlock: 'Gioca per sbloccare',
    playerRank: 'Rango giocatore',
    progress: 'Progresso',
    progressGraph: 'Sessioni giocate',
    reliability: 'Affidabilità',
    retentionCollection: 'Il mazzo del Trickster',
    retentionHint: 'Badge giocosi per schemi nascosti, rivali, rituali e colpi di fortuna delle tue partite VRena.',
    secret: 'Segreto',
    secretHint: 'Prova più tipi di gioco per rivelare questo badge.',
    sessionsPlayed: 'Sessioni giocate',
    shareComingSoon: 'Condivisione in arrivo',
    silver: 'Argento',
    tapForDetails: 'Tocca per dettagli',
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

function tierIcon(tier: GameAchievement['tier']) {
  if (tier === 'mastered') return <Crown aria-hidden="true" size={15} />
  if (tier === 'gold') return <Trophy aria-hidden="true" size={15} />
  if (tier === 'silver') return <Medal aria-hidden="true" size={15} />
  if (tier === 'bronze') return <Award aria-hidden="true" size={15} />
  return <Lock aria-hidden="true" size={15} />
}

function retentionIcon(achievement: Pick<RetentionAchievement, 'category' | 'id'>) {
  if (achievement.id === 'first-blood') return <BadgeCheck aria-hidden="true" size={17} />
  if (achievement.id === 'weekly-warrior') return <CalendarCheck aria-hidden="true" size={17} />
  if (achievement.id === 'streak-builder') return <Flame aria-hidden="true" size={17} />
  if (achievement.id === 'arena-regular') return <Repeat2 aria-hidden="true" size={17} />
  if (achievement.id === 'back-for-more') return <Footprints aria-hidden="true" size={17} />
  if (achievement.id === 'perfect-rotation') return <Target aria-hidden="true" size={17} />
  if (achievement.id === 'genre-explorer') return <Crosshair aria-hidden="true" size={17} />
  if (achievement.id === 'specialist') return <Medal aria-hidden="true" size={17} />
  if (achievement.id === 'completionist') return <Crown aria-hidden="true" size={17} />
  if (achievement.id === 'squad-starter') return <UsersRound aria-hidden="true" size={17} />
  if (achievement.id === 'challenge-accepted') return <Swords aria-hidden="true" size={17} />
  if (achievement.id === 'friendly-rivalry') return <Handshake aria-hidden="true" size={17} />
  if (achievement.id === 'club-loyalist') return <Club aria-hidden="true" size={17} />
  if (achievement.id === 'bring-the-crew') return <UserPlus aria-hidden="true" size={17} />
  if (achievement.id === 'personal-best') return <Trophy aria-hidden="true" size={17} />
  if (achievement.id === 'clutch-player') return <Zap aria-hidden="true" size={17} />
  if (achievement.id === 'accuracy-upgrade') return <Gauge aria-hidden="true" size={17} />
  if (achievement.id === 'escape-breakthrough') return <TimerReset aria-hidden="true" size={17} />
  if (achievement.id === 'top-ten-moment') return <Activity aria-hidden="true" size={17} />
  if (achievement.id === 'birthday-hero') return <Cake aria-hidden="true" size={17} />
  if (achievement.id === 'team-builder') return <BriefcaseBusiness aria-hidden="true" size={17} />
  if (achievement.id === 'off-peak-explorer') return <Clock3 aria-hidden="true" size={17} />
  if (achievement.id === 'double-session-day') return <CalendarHeart aria-hidden="true" size={17} />
  if (achievement.id === 'weekend-raider') return <Gamepad2 aria-hidden="true" size={17} />
  if (achievement.id === 'night-owl') return <Moon aria-hidden="true" size={17} />
  if (achievement.id === 'secret-hunter') return <SearchCheck aria-hidden="true" size={17} />
  if (achievement.id === 'mask-mode') return <VenetianMask aria-hidden="true" size={17} />

  const category = achievement.category
  if (category === 'comeback') return <RotateCcw aria-hidden="true" size={17} />
  if (category === 'explore') return <Target aria-hidden="true" size={17} />
  if (category === 'social') return <UsersRound aria-hidden="true" size={17} />
  if (category === 'performance') return <Trophy aria-hidden="true" size={17} />
  return <Clock3 aria-hidden="true" size={17} />
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
  const [sparkedAchievementId, setSparkedAchievementId] = useState('')
  const [, setTapCounts] = useState<Record<string, number>>({})

  const achievements = useMemo(() => buildGameAchievements(mySessions, userId), [mySessions, userId])
  const retentionAchievements = useMemo(() => buildRetentionAchievements(mySessions, userId, profile), [mySessions, profile, userId])
  const sessionsPlayed = useMemo(
    () => mySessions.filter((session) => session.session_participants?.some((participant) => participant.profile_id === userId && participant.checked_in)).length,
    [mySessions, userId],
  )
  const summary = useMemo(() => achievementSummary(achievements, sessionsPlayed), [achievements, sessionsPlayed])
  const levelProgress = useMemo(() => profileLevelProgress(playerStats), [playerStats])
  const graphPoints = useMemo(() => sessionsByRecentWeek(mySessions, userId, language), [language, mySessions, userId])
  const graphPathPoints = useMemo(() => progressPath(graphPoints), [graphPoints])
  const graphLine = graphPathPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const graphArea = graphPathPoints.length > 0
    ? `${graphLine} L ${graphPathPoints[graphPathPoints.length - 1].x} 112 L ${graphPathPoints[0].x} 112 Z`
    : ''
  const hasProgress = summary.sessionsPlayed > 0

  function openAchievement(achievement: GameAchievement) {
    setSelectedAchievement(achievement)

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

    if (achievement.state === 'locked') return

    setSparkedAchievementId(achievement.id)
    window.setTimeout(() => setSparkedAchievementId(''), 900)
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
        <div className="achievement-grid">
          {achievements.map((achievement) => (
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
                <strong>{achievement.game.title}</strong>
                <small>{achievement.state === 'locked' ? copy.playToUnlock : achievement.title}</small>
                <span className="achievement-mini-progress" aria-hidden="true">
                  <span style={{ width: `${achievement.progressPercent}%` }} />
                </span>
                <small>{achievement.playedCount}/{achievement.nextRequirement ?? 10}</small>
              </span>
            </button>
          ))}
          <button className="achievement-card achievement-secret" onClick={() => setSparkedAchievementId('secret')} type="button">
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
          </button>
        </div>
      </div>

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
          {retentionAchievements.map((achievement) => (
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
                <small>{achievement.description}</small>
                <span className="achievement-mini-progress" aria-hidden="true">
                  <span style={{ width: `${achievement.progressPercent}%` }} />
                </span>
                <small>{achievement.current}/{achievement.target}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

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
              <h3>{selectedAchievement.game.title}</h3>
              <strong>{selectedAchievement.title}</strong>
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
              <button className="secondary small-button" type="button" disabled>
                <Share2 aria-hidden="true" size={15} />
                {copy.shareComingSoon}
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
            <div className={`retention-detail-badge retention-${selectedRetentionAchievement.category}`}>
              {retentionIcon(selectedRetentionAchievement)}
            </div>
            <div className="achievement-detail-copy">
              <span className="achievement-tier-pill">
                {selectedRetentionAchievement.state === 'locked' ? <Lock aria-hidden="true" size={15} /> : <CalendarCheck aria-hidden="true" size={15} />}
                {selectedRetentionAchievement.state === 'locked' ? copy.locked : copy.unlocked}
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
