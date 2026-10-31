import type { LanguageCode } from './i18n/languages'

export const collectionLabels: Record<LanguageCode, { games: string; modes: string; maps: string; included: string; eventSetup: string }> = {
  zh: { games: '游戏', modes: '模式', maps: '地图', included: '包含', eventSetup: '活动安排' },
  en: { games: 'Mini-games', modes: 'Game modes', maps: 'Maps', included: 'Explore games & modes', eventSetup: 'Event setup · duration and group size on request' },
  vi: { games: 'Trò chơi nhỏ', modes: 'Chế độ chơi', maps: 'Bản đồ', included: 'Khám phá trò chơi & chế độ', eventSetup: 'Sự kiện · thời lượng và số người theo yêu cầu' },
  fr: { games: 'Mini-jeux', modes: 'Modes de jeu', maps: 'Cartes', included: 'Explorer les jeux et modes', eventSetup: 'Événement · durée et groupe sur demande' },
  de: { games: 'Minispiele', modes: 'Spielmodi', maps: 'Karten', included: 'Spiele und Modi entdecken', eventSetup: 'Event · Dauer und Gruppengröße auf Anfrage' },
  it: { games: 'Minigiochi', modes: 'Modalità', maps: 'Mappe', included: 'Esplora giochi e modalità', eventSetup: 'Evento · durata e gruppo su richiesta' },
  ja: { games: 'ミニゲーム', modes: 'ゲームモード', maps: 'マップ', included: 'ゲームとモードを見る', eventSetup: 'イベント · 所要時間と人数はお問い合わせください' },
  ko: { games: '미니게임', modes: '게임 모드', maps: '맵', included: '게임 및 모드 보기', eventSetup: '이벤트 · 시간과 인원은 문의해 주세요' },
}

export const experienceCount: Record<LanguageCode, string> = {
  zh: '{shown} / {total} 种体验',
  en: '{shown} of {total} experiences',
  vi: '{shown} / {total} trải nghiệm',
  fr: '{shown} expériences sur {total}',
  de: '{shown} von {total} Erlebnissen',
  it: '{shown} esperienze su {total}',
  ja: '全{total}体験中{shown}件',
  ko: '전체 체험 {total}개 중 {shown}개',
}
