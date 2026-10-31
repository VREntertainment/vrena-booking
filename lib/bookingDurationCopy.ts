import type { LanguageCode } from './i18n/languages'

export const bookingDurationCopy = {
  zh: {"ticket": "门票预约时长", "game": "游戏时长", "hint": "普通门票以 30 分钟为单位预约。单个游戏可能较短，所选门票时长即为您预约的时段。", "event": "活动预约时长"},
  en: { ticket: 'Reserved ticket time', game: 'Game runtime', hint: 'Standard tickets reserve time in 30-minute blocks. Individual game runtimes may be shorter; your selected ticket time is the reserved booking slot.', event: 'Reserved event time' },
  vi: { ticket: 'Thời gian đặt vé', game: 'Thời lượng trò chơi', hint: 'Vé thường đặt theo khung 30 phút. Mỗi trò chơi có thể ngắn hơn; thời gian vé đã chọn là khung giờ đặt chỗ.', event: 'Thời gian sự kiện đã đặt' },
  fr: { ticket: 'Temps réservé du billet', game: 'Durée du jeu', hint: 'Les billets standard réservent des créneaux de 30 minutes. Un jeu peut être plus court ; la durée du billet correspond au créneau réservé.', event: 'Durée réservée pour l’événement' },
  de: { ticket: 'Reservierte Ticketzeit', game: 'Spieldauer', hint: 'Standardtickets reservieren 30-Minuten-Blöcke. Einzelne Spiele können kürzer sein; die gewählte Ticketzeit ist Ihr reserviertes Zeitfenster.', event: 'Reservierte Veranstaltungszeit' },
  it: { ticket: 'Tempo prenotato con il biglietto', game: 'Durata del gioco', hint: 'I biglietti standard prenotano blocchi di 30 minuti. I singoli giochi possono essere più brevi; il tempo del biglietto è la fascia prenotata.', event: 'Durata riservata per l’evento' },
  ja: { ticket: 'チケットの予約時間', game: 'ゲームの所要時間', hint: '通常チケットは30分単位の予約です。各ゲームの所要時間はそれより短い場合があります。選択したチケット時間が予約枠です。', event: 'イベント予約時間' },
  ko: { ticket: '티켓 예약 시간', game: '게임 소요 시간', hint: '일반 티켓은 30분 단위로 예약합니다. 개별 게임은 더 짧을 수 있으며 선택한 티켓 시간이 예약 시간대입니다.', event: '행사 예약 시간' },
} satisfies Record<LanguageCode, { ticket: string; game: string; hint: string; event: string }>
