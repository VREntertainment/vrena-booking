export const bookingCategories = ['standard', 'birthday', 'event', 'free_trial'] as const
export type BookingCategory = typeof bookingCategories[number]
export type BookingVenue = 'ha-do-centrosa' | 'cafe-des-stagiaires'

// Matches the shared games in the current guide, including their mini-games/modes.
export const thaoDienGameSlugs = [
  'revolta', 'city-z', 'station-zarya', 'birthday-party', 'portal-zombie',
  'arcade-2-0', 'party-games', 'portal-mafia', 'orc-kings-arena', 'vr-arena-strike',
] as const

export function gameAvailableAtVenue(slug: string, venue: string) {
  return venue === 'ha-do-centrosa' || (venue === 'cafe-des-stagiaires' && (thaoDienGameSlugs as readonly string[]).includes(slug))
}

export type BookingMetadata = {
  booking_category?: BookingCategory | null
  booking_source?: string | null
  game_selection_explicit?: boolean | null
  booking_type?: string | null
  ticket_type?: string | null
  venue_key?: string | null
  confirmed_game_id?: string | null
  game_options?: string[] | null
  ticket_reference?: string | null
}

export function bookingCategory(booking: BookingMetadata): BookingCategory {
  return booking.booking_category || (booking.ticket_type === 'birthday' ? 'birthday' : booking.ticket_type === 'corporate' ? 'event' : 'standard')
}

export const bookingCategoryCopy = {
  en: { label: 'Booking category', standard: 'Standard', birthday: 'Birthday', event: 'Event', free_trial: 'Free trial', noGames: 'Games not selected' },
  vi: { label: 'Loại đặt chỗ', standard: 'Thông thường', birthday: 'Sinh nhật', event: 'Sự kiện', free_trial: 'Chơi thử miễn phí', noGames: 'Chưa chọn trò chơi' },
  fr: { label: 'Type de réservation', standard: 'Standard', birthday: 'Anniversaire', event: 'Événement', free_trial: 'Essai gratuit', noGames: 'Jeux non sélectionnés' },
  de: { label: 'Buchungsart', standard: 'Standard', birthday: 'Geburtstag', event: 'Veranstaltung', free_trial: 'Kostenloses Probespiel', noGames: 'Keine Spiele ausgewählt' },
  it: { label: 'Tipo di prenotazione', standard: 'Standard', birthday: 'Compleanno', event: 'Evento', free_trial: 'Prova gratuita', noGames: 'Giochi non selezionati' },
  ja: { label: '予約の種類', standard: '通常', birthday: '誕生日', event: 'イベント', free_trial: '無料体験', noGames: 'ゲーム未選択' },
  ko: { label: '예약 유형', standard: '일반', birthday: '생일', event: '이벤트', free_trial: '무료 체험', noGames: '게임 미선택' },
  zh: { label: '预约类型', standard: '标准', birthday: '生日', event: '活动', free_trial: '免费试玩', noGames: '尚未选择游戏' },
}

export function selectedBookingGames(booking: BookingMetadata) {
  // Ticket options historically contained automatic defaults. Only an explicit
  // staff/customer selection may label these reservations. Community options
  // are chosen through their existing game picker.
  if (booking.booking_type === 'ticket' && !(booking.game_selection_explicit ?? booking.ticket_reference?.startsWith('POS-')) && booking.confirmed_game_id !== 'sim-racing') return []
  return [...new Set([booking.confirmed_game_id, ...(booking.game_options || [])])]
    .filter((id): id is string => Boolean(id) && gameAvailableAtVenue(id!, booking.venue_key || 'ha-do-centrosa'))
}
