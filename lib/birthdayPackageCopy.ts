import type { LanguageCode } from './i18n/languages'
export const birthdayPackageCopy = {
  zh: {"duration": "2 小时", "label": "生日套餐", "custom": "定制生日活动", "note": "套餐包含 2 小时及休息时间。如需加时或调整，请在下方说明，工作人员将确认最终安排。"},
  en: { duration: '2hrs', label: 'Birthday package', custom: 'Custom birthday', note: 'Package price for 2 hours, including breaks. Extra time or changes? Add your request below. The team confirms your final arrangement.' },
  vi: { duration: '2 giờ', label: 'Gói sinh nhật', custom: 'Sinh nhật tùy chỉnh', note: 'Giá gói cho 2 giờ, bao gồm thời gian nghỉ. Muốn thêm giờ hoặc thay đổi? Ghi yêu cầu bên dưới. Đội ngũ sẽ xác nhận phương án cuối cùng.' },
  fr: { duration: '2 h', label: 'Forfait anniversaire', custom: 'Anniversaire sur mesure', note: 'Prix du forfait pour 2 heures, pauses comprises. Plus de temps ou des modifications ? Ajoute ta demande ci-dessous. Notre équipe confirmera les détails.' },
  ko: { duration: '2시간', label: '생일 패키지', custom: '맞춤 생일', note: '휴식 시간을 포함한 2시간 패키지 가격입니다. 시간 추가나 변경을 원하시면 아래에 요청을 적어주세요. 직원이 최종 내용을 확인합니다.' },
  ja: { duration: '2時間', label: 'バースデープラン', custom: 'カスタムプラン', note: '休憩を含む2時間のプラン料金です。延長や変更のご希望は下にご記入ください。スタッフが最終内容を確認します。' },
  de: { duration: '2 Std.', label: 'Geburtstagspaket', custom: 'Individueller Geburtstag', note: 'Paketpreis für 2 Stunden inklusive Pausen. Mehr Zeit oder Änderungen? Schreibe deinen Wunsch unten. Unser Team bestätigt die endgültige Planung.' },
  it: { duration: '2 ore', label: 'Pacchetto compleanno', custom: 'Compleanno personalizzato', note: 'Prezzo del pacchetto per 2 ore, pause incluse. Vuoi più tempo o modifiche? Scrivi la richiesta qui sotto. Il team confermerà i dettagli finali.' },
} satisfies Record<LanguageCode, { duration: string; label: string; custom: string; note: string }>
