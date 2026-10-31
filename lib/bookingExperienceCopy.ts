import type { LanguageCode } from './i18n/languages'
import type { TranslationMap } from './i18n/base'
import { CUSTOMER_SOCIAL_FEATURES_ENABLED } from './customerExperience'

const copy = {
  zh: ["预约下一次 VR 体验。", "立即预约", "我的账户", "预约、积分与偏好", "积分", "管理预约、累积积分，享受生日优惠。", "预约记录", "账户偏好", "创建免费账户，保存预约并在付款后赚取积分。", "预约已确认。请保存预约编号，或创建账户保存预约并在付款后赚取积分。"],
  "en": [
    "Book your next VR experience.",
    "Book now",
    "My account",
    "Bookings, loyalty & preferences",
    "Loyalty",
    "Manage your bookings, collect loyalty points, and enjoy birthday rewards.",
    "Booking history",
    "Account preferences",
    "Create a free account to keep your bookings and collect loyalty points after payment.",
    "Your booking is confirmed. Keep your reference, or create an account to save this booking and collect loyalty points after payment."
  ],
  "vi": [
    "Đặt trải nghiệm VR tiếp theo của bạn.",
    "Đặt ngay",
    "Tài khoản",
    "Lịch sử đặt chỗ, điểm & tùy chọn",
    "Điểm thưởng",
    "Quản lý đặt chỗ, tích điểm và nhận ưu đãi sinh nhật.",
    "Lịch sử đặt chỗ",
    "Tùy chọn tài khoản",
    "Tạo tài khoản miễn phí để lưu đặt chỗ và tích điểm sau khi thanh toán.",
    "Đặt chỗ đã được xác nhận. Hãy lưu mã đặt chỗ hoặc tạo tài khoản để lưu đặt chỗ và tích điểm sau khi thanh toán."
  ],
  "ko": [
    "다음 VR 체험을 예약하세요.",
    "지금 예약",
    "내 계정",
    "예약, 포인트 및 설정",
    "포인트",
    "예약을 관리하고 포인트와 생일 혜택을 받으세요.",
    "예약 내역",
    "계정 설정",
    "무료 계정을 만들어 예약을 저장하고 결제 후 포인트를 적립하세요.",
    "예약이 확정되었습니다. 예약 번호를 보관하거나 계정을 만들어 예약을 저장하고 결제 후 포인트를 적립하세요."
  ],
  "ja": [
    "次のVR体験を予約しましょう。",
    "今すぐ予約",
    "マイアカウント",
    "予約・ポイント・設定",
    "ポイント",
    "予約を管理し、ポイントや誕生日特典をお楽しみください。",
    "予約履歴",
    "アカウント設定",
    "無料アカウントで予約を保存し、お支払い後にポイントを獲得できます。",
    "予約が確定しました。予約番号を保管するか、アカウントを作成して予約を保存し、お支払い後にポイントを獲得しましょう。"
  ],
  "fr": [
    "Réservez votre prochaine expérience VR.",
    "Réserver",
    "Mon compte",
    "Réservations, points et préférences",
    "Fidélité",
    "Gérez vos réservations, cumulez des points et profitez des offres anniversaire.",
    "Mes réservations",
    "Préférences du compte",
    "Créez un compte gratuit pour conserver vos réservations et cumuler des points après paiement.",
    "Votre réservation est confirmée. Conservez votre référence ou créez un compte pour enregistrer cette réservation et cumuler des points après paiement."
  ],
  "de": [
    "Buche dein nächstes VR-Erlebnis.",
    "Jetzt buchen",
    "Mein Konto",
    "Buchungen, Punkte und Einstellungen",
    "Treuepunkte",
    "Verwalte Buchungen, sammle Punkte und nutze Geburtstagsangebote.",
    "Buchungsverlauf",
    "Kontoeinstellungen",
    "Erstelle ein kostenloses Konto, um Buchungen zu speichern und nach der Zahlung Punkte zu sammeln.",
    "Deine Buchung ist bestätigt. Bewahre die Buchungsnummer auf oder erstelle ein Konto, um diese Buchung zu speichern und nach der Zahlung Punkte zu sammeln."
  ],
  "it": [
    "Prenota la tua prossima esperienza VR.",
    "Prenota ora",
    "Il mio account",
    "Prenotazioni, punti e preferenze",
    "Fedeltà",
    "Gestisci le prenotazioni, accumula punti e scopri i vantaggi per il compleanno.",
    "Storico prenotazioni",
    "Preferenze account",
    "Crea un account gratuito per salvare le prenotazioni e accumulare punti dopo il pagamento.",
    "La prenotazione è confermata. Conserva il riferimento oppure crea un account per salvarla e accumulare punti dopo il pagamento."
  ]
} as const

export function bookingExperienceCopy(language: LanguageCode) {
  const [tagline, book, account, accountHint, loyalty, welcome, history, preferences, accountValue, saved] = copy[language]
  return { tagline, book, account, accountHint, loyalty, welcome, history, preferences, accountValue, saved }
}

export function applyBookingExperienceCopy(language: LanguageCode, text: TranslationMap): TranslationMap {
  if (CUSTOMER_SOCIAL_FEATURES_ENABLED) return text
  const c = bookingExperienceCopy(language)
  return { ...text, tagline: c.tagline, tickets: c.book, profile: c.account, noProfile: c.account, authWelcomeBody: c.welcome, authBenefitBookings: c.history, authBenefitLoyalty: c.preferences, ticketAccountValueNoPoints: c.accountValue, guestTicketSavedBody: c.saved }
}
