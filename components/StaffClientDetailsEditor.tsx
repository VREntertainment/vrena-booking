'use client'

import type { ClientDetails } from '../lib/staff/clientDetails'

export default function StaffClientDetailsEditor({ value, onChange, disabled, language }: {
  value: ClientDetails; onChange: (value: ClientDetails) => void; disabled: boolean; language: string
}) {
  const vi = language === 'vi'
  const fields: [keyof Omit<ClientDetails, 'anonymous_mode'>, string, string, string?][] = [
    ['full_name', 'Full name (including surname)', 'Họ và tên'],
    ['nickname', 'Nickname', 'Biệt danh'], ['phone', 'Phone number', 'Số điện thoại', 'tel'],
    ['email', 'Contact email', 'Email liên hệ', 'email'], ['birthday', 'Date of birth', 'Ngày sinh', 'date'],
    ['profile_motto', 'Profile motto', 'Khẩu hiệu cá nhân'],
    ['avatar_url', 'Avatar image URL', 'Đường dẫn ảnh đại diện', 'url'],
    ['avatar_emoji', 'Avatar emoji', 'Biểu tượng đại diện'], ['avatar_initials', 'Avatar initials', 'Chữ viết tắt đại diện'],
    ['avatar_color', 'Avatar background color', 'Màu nền đại diện'], ['avatar_text_color', 'Avatar text color', 'Màu chữ đại diện'],
  ]
  return <fieldset className="staff-card staff-client-details" disabled={disabled}>
    <legend>{vi ? 'Thông tin khách hàng' : 'Client details'}</legend>
    <div className="form-grid compact-form-grid">
      {fields.map(([key, en, vn, type]) => <label key={key}>{vi ? vn : en}<input type={type || 'text'} value={value[key]} maxLength={key === 'avatar_url' ? 2048 : 200} onChange={(event) => onChange({ ...value, [key]: event.target.value })} /></label>)}
      <label>{vi ? 'Giới tính' : 'Gender'}<select value={value.gender} onChange={(event) => onChange({ ...value, gender: event.target.value })}>
        <option value="">{vi ? 'Chưa cung cấp' : 'Not specified'}</option>
        <option value="female">{vi ? 'Nữ' : 'Female'}</option><option value="male">{vi ? 'Nam' : 'Male'}</option>
        <option value="non_binary">{vi ? 'Phi nhị nguyên' : 'Non-binary'}</option><option value="prefer_not_to_say">{vi ? 'Không muốn tiết lộ' : 'Prefer not to say'}</option><option value="self_describe">{vi ? 'Tự mô tả' : 'Self-described'}</option>
      </select></label>
      <label><input type="checkbox" checked={value.anonymous_mode} onChange={(event) => onChange({ ...value, anonymous_mode: event.target.checked })} />{vi ? 'Chế độ ẩn danh' : 'Anonymous mode'}</label>
    </div>
    <p className="muted">{vi ? 'Email liên hệ không thay đổi email đăng nhập. Lưu bằng nút Lưu thay đổi phía trên.' : 'Contact email does not change the sign-in email. Use Save changes above to save this profile.'}</p>
  </fieldset>
}
