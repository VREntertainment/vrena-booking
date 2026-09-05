import type { StaffOperationSession, StaffOrder, StaffSessionParticipant } from './staff/types'

export function hasVisitResult(player: StaffSessionParticipant) {
  return [player.score, player.accuracy_percent, player.hits, player.projectiles_fired, player.movement_meters, player.escape_duration_seconds, player.placement]
    .some((value) => value !== null && value !== undefined)
    || Boolean(player.chapter_times?.length)
}

export function visitProgress(session: StaffOperationSession, order?: StaffOrder) {
  const players = (session.session_participants || []).filter((player) => !player.deleted_at)
  const arrived = players.filter((player) => player.checked_in)
  const expected = Math.max(players.length, order?.players_count || session.ticket_player_count || 0)
  const withResults = arrived.filter(hasVisitResult).length
  return {
    players: players.length, expected, arrived: arrived.length, withResults,
    missingPlayers: Math.max(0, expected - players.length),
    needsArrival: arrived.length === 0,
    needsResults: arrived.length > withResults,
    // Completing an order alone is never proof that a player attended.
    recorded: arrived.length > 0 && withResults === arrived.length,
  }
}

export const visitCopy = {
  en: {
    savePayment: 'Save order payment', noBalance: 'No balance due. Review existing receipts before adding a payment.',
    orderPaymentHint: 'Record money actually received for the whole order. Player payment details do not add receipts to this order.',
    paymentError: 'Couldn’t record payment. Check the connection and remaining balance, then retry. The same entry can be retried safely.',
    recordPayment: 'Record order payment', title: 'Visit records', record: 'Record visit', arrival: 'Player arrived', save: 'Save visit record',
    hint: 'Add each player who actually played, confirm arrival, then save their payment and results. A completed order alone does not record attendance.',
    missing: 'Players still need to be linked', results: 'Arrived players with results', arrived: 'Recorded arrivals',
    payment: 'Order / payment record', link: 'Link existing order', choose: 'Choose the matching order',
    noOrder: 'No linked order. Create one in New Booking if needed, then link the matching order here.',
    linkError: 'Couldn’t link the order. Refresh and check that it is still available.',
    linked: 'Order linked.', saved: 'Visit record saved.', error: 'Couldn’t save. Your entries are still here; try again.',
    amount: 'Payment amount (VND)', method: 'Player payment method', none: 'Not recorded / unpaid',
    cash: 'Cash', bank: 'Bank transfer', free: 'Complimentary', score: 'Score', accuracy: 'Accuracy (%)',
    hits: 'Hits', movement: 'Movement (m)', escape: 'Escape time (seconds)', place: 'Placement',
    missingAmount: 'Enter the amount received, or choose complimentary.', future: 'Arrival can be recorded on the booking date.',
  },
  vi: {
    savePayment: 'Lưu thanh toán đơn', noBalance: 'Không còn số dư phải trả. Kiểm tra phiếu thu hiện có trước khi thêm thanh toán.',
    orderPaymentHint: 'Ghi số tiền thực nhận cho cả đơn. Thông tin thanh toán của từng người chơi không tự tạo phiếu thu cho đơn này.',
    paymentError: 'Không thể ghi thanh toán. Kiểm tra kết nối và số dư rồi thử lại. Có thể thử lại cùng thông tin một cách an toàn.',
    recordPayment: 'Ghi thanh toán đơn', title: 'Ghi nhận lượt chơi', record: 'Ghi nhận lượt chơi', arrival: 'Người chơi đã đến', save: 'Lưu lượt chơi',
    hint: 'Thêm từng người thực sự chơi, xác nhận đã đến rồi lưu thanh toán và kết quả. Hoàn tất đơn hàng không tự ghi nhận lượt đến.',
    missing: 'Còn người chơi cần liên kết', results: 'Người đã đến có kết quả', arrived: 'Đã ghi nhận đến',
    payment: 'Đơn hàng / thanh toán', link: 'Liên kết đơn có sẵn', choose: 'Chọn đơn hàng tương ứng',
    noOrder: 'Chưa liên kết đơn. Nếu cần, tạo đơn tại Đặt chỗ mới rồi liên kết đúng đơn tại đây.',
    linkError: 'Không thể liên kết đơn. Tải lại và kiểm tra đơn còn khả dụng.',
    linked: 'Đã liên kết đơn.', saved: 'Đã lưu lượt chơi.', error: 'Không thể lưu. Thông tin đã nhập vẫn được giữ; vui lòng thử lại.',
    amount: 'Số tiền thanh toán (VND)', method: 'Hình thức thanh toán', none: 'Chưa ghi nhận / chưa trả',
    cash: 'Tiền mặt', bank: 'Chuyển khoản', free: 'Miễn phí', score: 'Điểm', accuracy: 'Độ chính xác (%)',
    hits: 'Số lần bắn trúng', movement: 'Di chuyển (m)', escape: 'Thời gian thoát (giây)', place: 'Xếp hạng',
    missingAmount: 'Nhập số tiền đã nhận hoặc chọn miễn phí.', future: 'Có thể ghi nhận đến vào ngày đặt chỗ.',
  },
}
