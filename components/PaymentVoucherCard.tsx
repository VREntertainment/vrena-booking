'use client'
import { useEffect, useRef, useState } from 'react'
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

export default function PaymentVoucherCard({ voucher, language = 'en' }: { voucher: PaymentVoucher; language?: string }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [exportLanguage, setExportLanguage] = useState<'en' | 'vi' | null>(null)
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)
  const previewUrl = useRef<string | null>(null)
  const shareDialog = useRef<HTMLDialogElement>(null)
  const vi = language === 'vi'
  const venue = voucherVenueNames(voucher).join(' · ')
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current) }, [])
  async function prepare(selectedLanguage: 'en' | 'vi') {
    if (busy) return
    setError(''); setBusy(true); setExportLanguage(selectedLanguage); setImage(null)
    const exportVi = selectedLanguage === 'vi'
    try {
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
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      previewUrl.current = URL.createObjectURL(file)
      setImage({ file, url: previewUrl.current })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'JPEG export failed') }
    finally { setBusy(false) }
  }
  function download() {
    if (!image) return
    const a = document.createElement('a'); a.href = image.url; a.download = image.file.name; a.click()
  }
  return <article className="payment-voucher-card" style={{ border: '1px solid var(--vrena-purple-300)', borderRadius: 16, padding: 16, marginBlock: 12, overflowWrap: 'anywhere' }}>
    <strong>{vi ? 'Voucher giá trị' : 'Value voucher'} · {formatVnd(voucher.amount)}</strong>
    <p><code>{voucher.code}</code></p>
    <p>{vi ? 'Số dư hiện tại' : 'Current balance'}: <strong>{formatVnd(voucher.balance)}</strong> · {venue}</p>
    <p>{voucherExpiryLabel(voucher.expires_at, vi)} {vi ? 'Giữ mã an toàn; số dư được kiểm tra khi dùng.' : 'Keep the code safe; the balance is checked when used.'}</p>
    <button type="button" className="secondary" onClick={() => { setError(''); shareDialog.current?.showModal() }}>{vi ? 'Chia sẻ ảnh' : 'Share image'}</button>
    <dialog ref={shareDialog} className="staff-voucher-dialog payment-voucher-share-dialog" aria-label={vi ? 'Chọn ngôn ngữ ảnh' : 'Choose image language'}>
      <button type="button" className="secondary" onClick={() => shareDialog.current?.close()}>{vi ? 'Đóng' : 'Close'}</button>
      <h3>{vi ? 'Ngôn ngữ ảnh voucher' : 'Voucher image language'}</h3>
      <div className="staff-row-actions">
        <button type="button" className="secondary" disabled={busy} aria-pressed={exportLanguage === 'en'} onClick={() => void prepare('en')}>English (EN)</button>
        <button type="button" className="secondary" disabled={busy} aria-pressed={exportLanguage === 'vi'} onClick={() => void prepare('vi')}>Tiếng Việt (VI)</button>
      </div>
      {busy && <p role="status">{vi ? 'Đang tạo ảnh…' : 'Preparing image…'}</p>}
      {image && <>
        {/* A plain image preserves the locally generated JPEG without a remote optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={exportLanguage === 'vi' ? 'Ảnh voucher sẽ chia sẻ' : 'Voucher image to share'} width={900} height={1200} style={{ display: 'block', width: '100%', height: 'auto', marginBlock: 16 }} />
        <div className="staff-row-actions">
          <button type="button" className="secondary" onClick={download}>{vi ? 'Tải JPEG' : 'Download JPEG'}</button>
          <button type="button" className="primary" onClick={() => {
            if (navigator.canShare?.({ files: [image.file] })) void navigator.share({ files: [image.file], title: exportLanguage === 'vi' ? 'Voucher VRena' : 'VRena voucher' }).catch(cause => { if (cause.name !== 'AbortError') setError(cause.message) })
            else download()
          }}>{vi ? 'Chia sẻ JPEG' : 'Share JPEG'}</button>
        </div>
      </>}
      {error && <p role="alert">{error}</p>}
    </dialog>
  </article>
}
