'use client'
import { useCallback, type ReactNode } from 'react'
import { ShareLanguageButton, type PrepareShare } from './ShareLanguageButton'
import { shareImageFile } from '../lib/shareFiles'
import { voucherExpiryLabel, voucherVenueNames, type PaymentVoucher } from '../lib/paymentVouchers'
import { formatVnd } from '../lib/staff/formatting'
import { vrenaPalette } from '../lib/theme/vrenaPalette'

let interReady: Promise<void> | undefined
function loadInter() {
  interReady ??= (async () => {
    const font = new FontFace('Inter', 'url(/fonts/InterVariable.woff2)', { weight: '100 900' })
    document.fonts.add(await font.load())
  })().catch(cause => { interReady = undefined; throw cause })
  return interReady
}

export default function PaymentVoucherCard({ voucher, language = 'en', management }: { voucher: PaymentVoucher; language?: string; management?: ReactNode }) {
  const vi = language === 'vi'
  const venueNames = voucherVenueNames(voucher)
  const venueKeys = voucher.valid_venue_keys ?? [voucher.venue_key]
  const prepare = useCallback<PrepareShare>(async (selectedLanguage, signal) => {
    const exportVi = selectedLanguage === 'vi'
    await loadInter()
    const canvas = document.createElement('canvas')
    canvas.width = 900; canvas.height = 1200
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image export unavailable')
    ctx.fillStyle = vrenaPalette.purple[950]; ctx.fillRect(0, 0, 900, 1200)
    ctx.fillStyle = vrenaPalette.cyan[400]; ctx.fillRect(60, 52, 92, 8)
    const logo = new Image()
    logo.src = '/brand/vrena-logo-full-dark.svg'
    await logo.decode()
    ctx.drawImage(logo, 60, 95, 320, 320 * 1000 / 4886)
    ctx.fillStyle = vrenaPalette.white
    ctx.font = '700 42px Inter'; ctx.fillText(exportVi ? 'VOUCHER GIÁ TRỊ' : 'VALUE VOUCHER', 60, 250)
    ctx.font = '700 86px Inter'; ctx.fillText(formatVnd(voucher.amount), 60, 360)
    ctx.font = '400 28px Inter'; ctx.fillText(exportVi ? 'Sử dụng tại' : 'Valid at', 60, 440)
    ctx.font = '400 36px Inter'
    voucherVenueNames(voucher).forEach((name, index) => ctx.fillText(name, 60, 495 + index * 50))
    ctx.font = '700 74px Inter'; ctx.fillStyle = vrenaPalette.cyan[300]; ctx.fillText(voucher.code, 60, 670)
    function paragraph(text: string, y: number, lineHeight: number) {
      if (!ctx) return
      let line = ''
      for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word
        if (line && ctx.measureText(next).width > 780) { ctx.fillText(line, 60, y); y += lineHeight; line = word }
        else line = next
      }
      if (line) ctx.fillText(line, 60, y)
    }
    ctx.fillStyle = vrenaPalette.white; ctx.font = '400 30px Inter'
    paragraph(exportVi ? 'Nhập mã khi đặt chỗ tại booking.vre-vietnam.com hoặc đưa voucher cho nhân viên.' : 'Enter code at booking.vre-vietnam.com or show this voucher to our team.', 780, 42)
    ctx.font = '400 26px Inter'
    paragraph(exportVi ? 'Số dư được kiểm tra khi sử dụng. Không đổi thành tiền mặt.' : 'Current balance is checked on redemption. No cash exchange.', 900, 36)
    ctx.font = '400 30px Inter'; paragraph(voucherExpiryLabel(voucher.expires_at, exportVi), 1040, 40)
    ctx.font = '400 24px Inter'; ctx.fillText(`${exportVi ? 'Ngày phát hành' : 'Issued'} ${new Date(voucher.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })}`, 60, 1150)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('JPEG export failed')), 'image/jpeg', 0.95))
    const file = new File([blob], `${voucher.code}-${selectedLanguage}.jpg`, { type: 'image/jpeg' })
    signal.throwIfAborted()
    return () => shareImageFile(file, exportVi ? 'Voucher VRena' : 'VRena voucher')
  }, [voucher])
  return <article className="payment-voucher-card" style={{ border: '1px solid var(--vrena-purple-300)', borderRadius: 16, padding: 16, marginBlock: 12, overflowWrap: 'anywhere' }}>
    <header className="payment-voucher-heading"><strong>{vi ? 'Voucher giá trị' : 'Value voucher'} · {formatVnd(voucher.amount)}</strong><code>{voucher.code}</code></header>
    <p className="payment-voucher-balance">{vi ? 'Số dư hiện tại' : 'Current balance'}: <strong>{formatVnd(voucher.balance)}</strong></p>
    <div className="payment-voucher-venues">{venueNames.map((name, index) => <span className={management ? "venue-indicator" : undefined} data-venue={management ? venueKeys[index] : undefined} key={name}>{name}</span>)}</div>
    <p className="payment-voucher-expiry">{voucherExpiryLabel(voucher.expires_at, vi)}</p>
    <div className="payment-voucher-footer">
      <ShareLanguageButton className="primary" language={language} prepare={prepare}>{vi ? 'Chia sẻ ảnh' : 'Share image'}</ShareLanguageButton>
      {management && <details className="payment-voucher-more"><summary>{vi ? 'Thao tác' : 'More'}</summary><div className="payment-voucher-menu">{management}</div></details>}
    </div>
  </article>
}
