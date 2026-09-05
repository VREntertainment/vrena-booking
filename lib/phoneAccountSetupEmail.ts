import { vrenaPalette } from './theme/vrenaPalette'
import { maskPhoneSetupEmail, PHONE_SETUP_TOKEN_TTL_MINUTES } from './phoneAccountSetup'

const DEFAULT_FROM_EMAIL = 'VRena <contact@vre-vietnam.com>'
const CONTACT_EMAIL = 'contact@vre-vietnam.com'

export type PhoneAccountSetupEmailPayload = {
  customerName: string
  recipientEmail: string
  setupUrl: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function buildPhoneAccountSetupEmail(payload: PhoneAccountSetupEmailPayload) {
  const name = payload.customerName.trim() || 'VRena player'
  const subject = '[VRena] Verify your email and create your password'
  const text = [
    `Hello ${name},`,
    '',
    'Your VRena account was started at the venue using your phone number.',
    'Verify this email and create your private permanent password:',
    payload.setupUrl,
    '',
    `This secure link expires in ${PHONE_SETUP_TOKEN_TTL_MINUTES} minutes and can be used once.`,
    '',
    `Xin chao ${name},`,
    '',
    'Tai khoan VRena cua ban da duoc tao tai cua hang bang so dien thoai.',
    'Xac minh email nay va tao mat khau rieng cua ban tai day:',
    payload.setupUrl,
    '',
    `Lien ket bao mat het han sau ${PHONE_SETUP_TOKEN_TTL_MINUTES} phut va chi dung duoc mot lan.`,
    '',
    `Questions / Ho tro: ${CONTACT_EMAIL}`,
  ].join('\n')

  const safeName = escapeHtml(name)
  const safeUrl = escapeHtml(payload.setupUrl)
  const html = `<!doctype html>
<html lang="en">
  <head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${subject}</title></head>
  <body style="margin:0;background:${vrenaPalette.neutral[100]};color:${vrenaPalette.neutral[950]};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Verify your VRena email and create your password.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${vrenaPalette.neutral[100]};padding:28px 12px;"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;overflow:hidden;border:1px solid ${vrenaPalette.neutral[200]};border-radius:20px;background:${vrenaPalette.white};">
        <tr><td style="padding:28px 32px;background:${vrenaPalette.neutral[900]};"><img src="https://booking.vre-vietnam.com/brand/vrena-logo-full-dark.png" alt="VRena" width="176" style="display:block;width:176px;max-width:100%;height:auto;border:0;"></td></tr>
        <tr><td style="padding:34px 32px 16px;"><p style="margin:0 0 10px;color:${vrenaPalette.purple[700]};font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Finish account setup</p><h1 style="margin:0 0 14px;font-size:28px;line-height:1.18;">Hello ${safeName},</h1><p style="margin:0;color:${vrenaPalette.neutral[700]};font-size:16px;line-height:1.55;">Verify this email address, then create the private password you will use for VRena.</p></td></tr>
        <tr><td style="padding:12px 32px 24px;"><a href="${safeUrl}" style="display:inline-block;border-radius:12px;background:${vrenaPalette.purple[600]};color:${vrenaPalette.white};font-size:15px;font-weight:800;text-decoration:none;padding:14px 22px;">Verify email and create password</a><p style="margin:16px 0 0;color:${vrenaPalette.neutral[600]};font-size:13px;line-height:1.5;">This link expires in ${PHONE_SETUP_TOKEN_TTL_MINUTES} minutes and can be used once.</p></td></tr>
        <tr><td style="padding:0 32px 28px;"><p style="margin:0;color:${vrenaPalette.neutral[700]};font-size:14px;line-height:1.55;"><strong>Tiếng Việt:</strong> Xác minh email này, sau đó tạo mật khẩu riêng để đăng nhập VRena. Liên kết hết hạn sau ${PHONE_SETUP_TOKEN_TTL_MINUTES} phút.</p></td></tr>
        <tr><td style="border-top:1px solid ${vrenaPalette.neutral[200]};padding:20px 32px;color:${vrenaPalette.neutral[600]};font-size:12px;line-height:1.5;">Questions / Hỗ trợ: <a href="mailto:${CONTACT_EMAIL}" style="color:${vrenaPalette.purple[700]};">${CONTACT_EMAIL}</a></td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`

  return { html, subject, text }
}

export async function sendPhoneAccountSetupEmail(payload: PhoneAccountSetupEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Account setup email is not configured.')

  const email = buildPhoneAccountSetupEmail(payload)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to: payload.recipientEmail,
      reply_to: CONTACT_EMAIL,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  })

  if (!response.ok) throw new Error(`Could not send account setup email (${response.status}).`)
  const result = await response.json().catch(() => ({})) as { id?: string }
  return { id: result.id || null, maskedEmail: maskPhoneSetupEmail(payload.recipientEmail) }
}
