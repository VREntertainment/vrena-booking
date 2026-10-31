import type { LanguageCode } from './i18n/languages'

const copy: Record<LanguageCode, readonly [string, string, string]> = {
  zh: ["名", "姓", "更换头像"],
  en: ['Name', 'Surname', 'Change photo'],
  vi: ['Tên', 'Họ', 'Đổi ảnh'],
  ko: ['이름', '성', '사진 변경'],
  ja: ['名', '姓', '写真を変更'],
  fr: ['Prénom', 'Nom de famille', 'Changer la photo'],
  de: ['Vorname', 'Nachname', 'Foto ändern'],
  it: ['Nome', 'Cognome', 'Cambia foto'],
}
export function accountDetailsCopy(language: LanguageCode) {
  const [firstName, surname, changePhoto] = copy[language]
  return { firstName, surname, changePhoto }
}
