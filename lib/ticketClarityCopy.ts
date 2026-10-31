import type { LanguageCode } from './i18n/languages'

export const ticketClarityCopy = {
  zh: {"duration": "时长", "requests": "添加要求（选填）", "help": "预约详情与帮助", "quote": "定制报价", "confirm": "最终价格由工作人员确认", "pay": "到店付款"},
  en: { duration: 'Duration', requests: 'Add a request (optional)', help: 'Booking details & help', quote: 'Custom quote', confirm: 'Final price confirmed by our team', pay: 'Pay at the venue' },
  vi: { duration: 'Thời lượng', requests: 'Thêm yêu cầu (không bắt buộc)', help: 'Chi tiết đặt chỗ & hỗ trợ', quote: 'Báo giá riêng', confirm: 'Đội ngũ xác nhận giá cuối cùng', pay: 'Thanh toán tại địa điểm' },
  fr: { duration: 'Durée', requests: 'Ajouter une demande (facultatif)', help: 'Détails et aide', quote: 'Sur devis', confirm: 'Prix final confirmé par notre équipe', pay: 'Paiement sur place' },
  de: { duration: 'Dauer', requests: 'Wunsch hinzufügen (optional)', help: 'Buchungsdetails & Hilfe', quote: 'Individuelles Angebot', confirm: 'Endpreis wird vom Team bestätigt', pay: 'Zahlung vor Ort' },
  it: { duration: 'Durata', requests: 'Aggiungi una richiesta (facoltativo)', help: 'Dettagli e assistenza', quote: 'Preventivo personalizzato', confirm: 'Prezzo finale confermato dal team', pay: 'Pagamento sul posto' },
  ja: { duration: '予約時間', requests: 'リクエストを追加（任意）', help: '予約の詳細・お問い合わせ', quote: '個別お見積もり', confirm: '最終料金はスタッフが確認します', pay: '現地でお支払い' },
  ko: { duration: '예약 시간', requests: '요청 추가 (선택)', help: '예약 안내 및 문의', quote: '맞춤 견적', confirm: '최종 금액은 직원이 확인합니다', pay: '현장 결제' },
} satisfies Record<LanguageCode, { duration: string; requests: string; help: string; quote: string; confirm: string; pay: string }>
