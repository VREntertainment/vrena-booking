export type TicketBookingSelection = {
  isHaDo: boolean
  authenticated: boolean
  ticketType: 'individual' | 'birthday' | 'corporate'
  date: string
  time: string
  durationMinutes: number
  players: number
  arenaCount: number
  defaultGame: string
  unitPrice: number
  totalPrice: number
  special: boolean
  note: string
  loyaltyPoints: number
  discountCode: string | null
  guestName: string
  guestPhone: string
}

// Booking validation and pricing happen before this boundary; the server still
// validates capacity and recalculates tariffs. Keep guest and account RPCs distinct.
export function buildTicketBookingRequest(selection: TicketBookingSelection) {
  const common = {
    p_ticket_type: selection.ticketType,
    p_date: selection.date,
    p_start_time: `${selection.time}:00`,
    p_duration_minutes: selection.durationMinutes,
    p_player_count: selection.players,
    p_arena_count: selection.arenaCount,
    p_game_options: [selection.defaultGame],
  }
  const note = selection.note.trim().slice(0, 500) || null
  const guestName = selection.guestName.trim() || null
  if (!selection.isHaDo) {
    return {
      name: 'create_cafe_ticket_booking_request' as const,
      args: {
        ...common,
        p_guest_name: selection.authenticated ? null : guestName,
        p_guest_phone: selection.authenticated ? null : selection.guestPhone,
        p_special_note: note,
      },
    }
  }
  const priced = {
    ...common,
    p_unit_price: selection.special ? 0 : selection.unitPrice,
    p_total_price: selection.special ? 0 : selection.totalPrice,
  }
  if (selection.authenticated) {
    return {
      name: 'create_ticket_booking' as const,
      args: {
        ...priced,
        p_loyalty_points_to_redeem: selection.special ? 0 : selection.loyaltyPoints,
        p_discount_code: selection.special ? null : selection.discountCode,
        ...(selection.special ? { p_special_note: note } : {}),
      },
    }
  }
  return {
    name: 'create_guest_ticket_booking' as const,
    args: {
      ...priced,
      p_guest_name: guestName,
      p_guest_phone: selection.guestPhone,
      ...(selection.special ? { p_guest_note: note } : {}),
    },
  }
}
