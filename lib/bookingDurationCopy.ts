import type { LanguageCode } from './i18n/languages'

export const bookingDurationCopy = {
  en: { ticket: 'Reserved ticket time', game: 'Game runtime', hint: 'Standard tickets reserve time in 45-minute blocks. Individual game runtimes may be shorter; your selected ticket time is the reserved booking slot.', event: 'Event time confirmed with our team' },
  vi: { ticket: 'Thời gian đặt vé', game: 'Thời lượng trò chơi', hint: 'Vé thường đặt theo khung 45 phút. Mỗi trò chơi có thể ngắn hơn; thời gian vé đã chọn là khung giờ đặt chỗ.', event: 'Thời gian sự kiện do đội ngũ xác nhận' },
  fr: { ticket: 'Temps réservé du billet', game: 'Durée du jeu', hint: 'Les billets standard réservent des créneaux de 45 minutes. Un jeu peut être plus court ; la durée du billet correspond au créneau réservé.', event: 'Durée de l’événement à confirmer avec notre équipe' },
  de: { ticket: 'Reservierte Ticketzeit', game: 'Spieldauer', hint: 'Standardtickets reservieren 45-Minuten-Blöcke. Einzelne Spiele können kürzer sein; die gewählte Ticketzeit ist Ihr reserviertes Zeitfenster.', event: 'Veranstaltungsdauer mit unserem Team bestätigen' },
  it: { ticket: 'Tempo prenotato con il biglietto', game: 'Durata del gioco', hint: 'I biglietti standard prenotano blocchi di 45 minuti. I singoli giochi possono essere più brevi; il tempo del biglietto è la fascia prenotata.', event: 'Durata dell’evento da confermare con il nostro team' },
  ja: { ticket: 'チケットの予約時間', game: 'ゲームの所要時間', hint: '通常チケットは45分単位の予約です。各ゲームの所要時間はそれより短い場合があります。選択したチケット時間が予約枠です。', event: 'イベント時間はスタッフが確認します' },
  ko: { ticket: '티켓 예약 시간', game: '게임 소요 시간', hint: '일반 티켓은 45분 단위로 예약합니다. 개별 게임은 더 짧을 수 있으며 선택한 티켓 시간이 예약 시간대입니다.', event: '이벤트 시간은 직원과 확인해 주세요' },
} satisfies Record<LanguageCode, { ticket: string; game: string; hint: string; event: string }>
