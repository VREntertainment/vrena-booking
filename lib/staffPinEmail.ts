import { vrenaPalette } from './theme/vrenaPalette.ts'

const DEFAULT_FROM_EMAIL = 'VRena <contact@vre-vietnam.com>'
const CONTACT_EMAIL = 'contact@vre-vietnam.com'
const DEFAULT_SITE_URL = 'https://booking.vre-vietnam.com'
const EMAIL_COLORS = {
  accent: vrenaPalette.purple[600],
  accentBorder: vrenaPalette.purple[200],
  accentInk: vrenaPalette.purple[700],
  accentSoft: vrenaPalette.purple[50],
  ink: vrenaPalette.neutral[950],
  muted: vrenaPalette.neutral[600],
  mutedStrong: vrenaPalette.neutral[700],
  page: vrenaPalette.neutral[100],
  border: vrenaPalette.neutral[200],
  header: vrenaPalette.neutral[900],
  white: vrenaPalette.white,
} as const

export type StaffPinEmailPayload = {
  accessRole: 'manager' | 'staff'
  employeeName: string
  pin: string
  recipientEmail: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
}

export function maskEmailAddress(email: string) {
  const [localPart, domain] = email.trim().toLowerCase().split('@')
  if (!localPart || !domain) return ''
  const visible = localPart.slice(0, Math.min(2, localPart.length))
  return `${visible}${'•'.repeat(Math.max(3, localPart.length - visible.length))}@${domain}`
}

export function buildStaffPinEmail(payload: StaffPinEmailPayload) {
  if (!/^\d{6}$/.test(payload.pin)) throw new Error('Employee PIN must contain exactly six digits.')

  const employeeName = payload.employeeName.trim() || 'VRena employee'
  const roleEnglish = payload.accessRole === 'manager' ? 'Manager' : 'Staff'
  const roleVietnamese = payload.accessRole === 'manager' ? 'Quản lý' : 'Nhân viên'
  const appUrl = `${siteUrl()}/staff`
  const logoUrl = `${siteUrl()}/brand/vrena-logo-full-dark.png`
  const subject = '[VRena] Your employee PIN / Mã PIN nhân viên'
  const text = [
    `Hello ${employeeName},`,
    '',
    'Your secure VRena employee PIN is:',
    payload.pin,
    `Access level: ${roleEnglish}`,
    '',
    'Use this code to identify yourself on shared VRena store devices. Keep it private and do not forward this email.',
    '',
    `Xin chào ${employeeName},`,
    '',
    'Mã PIN nhân viên VRena bảo mật của bạn là:',
    payload.pin,
    `Cấp quyền: ${roleVietnamese}`,
    '',
    'Dùng mã này để xác nhận danh tính trên thiết bị dùng chung tại cửa hàng VRena. Vui lòng giữ bí mật và không chuyển tiếp email này.',
    '',
    `Open VRena Staff: ${appUrl}`,
    `Questions / Hỗ trợ: ${CONTACT_EMAIL}`,
  ].join('\n')

  const safeName = escapeHtml(employeeName)
  const safePin = escapeHtml(payload.pin)
  const safeAppUrl = escapeHtml(appUrl)
  const safeLogoUrl = escapeHtml(logoUrl)
  const safeRoleEnglish = escapeHtml(roleEnglish)
  const safeRoleVietnamese = escapeHtml(roleVietnamese)
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light only">
    <title>${subject}</title>
  </head>
  <body style="margin:0;background:${EMAIL_COLORS.page};color:${EMAIL_COLORS.ink};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your private six-digit VRena employee PIN.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_COLORS.page};padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;overflow:hidden;border:1px solid ${EMAIL_COLORS.border};border-radius:20px;background:${EMAIL_COLORS.white};">
          <tr>
            <td style="padding:28px 32px;background:${EMAIL_COLORS.header};">
              <img src="${safeLogoUrl}" alt="VRena" width="176" style="display:block;width:176px;max-width:100%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td style="padding:34px 32px 16px;">
              <p style="margin:0 0 10px;color:${EMAIL_COLORS.accentInk};font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Private employee credential</p>
              <h1 style="margin:0 0 14px;font-size:28px;line-height:1.18;">Hello ${safeName},</h1>
              <p style="margin:0;color:${EMAIL_COLORS.mutedStrong};font-size:16px;line-height:1.55;">Your secure VRena employee PIN is ready. Use it to identify yourself on shared store devices.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 24px;">
              <div style="border:1px solid ${EMAIL_COLORS.accentBorder};border-radius:16px;background:${EMAIL_COLORS.accentSoft};padding:24px;text-align:center;">
                <p style="margin:0 0 9px;color:${EMAIL_COLORS.muted};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;">Employee PIN</p>
                <p style="margin:0;color:${EMAIL_COLORS.ink};font-family:'Courier New',monospace;font-size:34px;font-weight:800;letter-spacing:.22em;">${safePin}</p>
                <p style="margin:12px 0 0;color:${EMAIL_COLORS.mutedStrong};font-size:13px;">Access level: <strong>${safeRoleEnglish}</strong> · Cấp quyền: <strong>${safeRoleVietnamese}</strong></p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 26px;">
              <p style="margin:0 0 12px;color:${EMAIL_COLORS.mutedStrong};font-size:14px;line-height:1.55;"><strong>Keep this code private.</strong> VRena will never ask you to send your PIN by chat or share it with another employee.</p>
              <p style="margin:0;color:${EMAIL_COLORS.mutedStrong};font-size:14px;line-height:1.55;"><strong>Giữ mã này bí mật.</strong> VRena sẽ không bao giờ yêu cầu bạn gửi PIN qua tin nhắn hoặc chia sẻ với nhân viên khác.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 34px;">
              <a href="${safeAppUrl}" style="display:inline-block;border-radius:12px;background:${EMAIL_COLORS.accent};color:${EMAIL_COLORS.white};font-size:15px;font-weight:800;text-decoration:none;padding:13px 20px;">Open VRena Staff</a>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid ${EMAIL_COLORS.border};padding:20px 32px;color:${EMAIL_COLORS.muted};font-size:12px;line-height:1.5;">
              Questions / Hỗ trợ: <a href="mailto:${CONTACT_EMAIL}" style="color:${EMAIL_COLORS.accentInk};">${CONTACT_EMAIL}</a>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

  return { html, subject, text }
}

export async function sendStaffPinEmail(payload: StaffPinEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Employee PIN email is not configured.')

  const from = process.env.NOTIFICATION_FROM_EMAIL
    || process.env.RESEND_FROM_EMAIL
    || DEFAULT_FROM_EMAIL
  const email = buildStaffPinEmail(payload)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: payload.recipientEmail,
      reply_to: CONTACT_EMAIL,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  })

  if (!response.ok) {
    throw new Error(`Could not send employee PIN email (${response.status}).`)
  }

  return { sent: true }
}
