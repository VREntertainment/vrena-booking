'use client'
import { useState } from 'react'
import { voucherExpiryLabel, type PaymentVoucher } from '../lib/paymentVouchers'
import { formatVnd } from '../lib/staff/formatting'
import { vrenaPalette } from '../lib/theme/vrenaPalette'

export default function PaymentVoucherCard({ voucher, language = 'en' }: { voucher: PaymentVoucher; language?: string }) {
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const vi = language === 'vi'
  const venue = voucher.venue_key === 'cafe-des-stagiaires' ? 'VRena Thảo Điền' : 'VRena Hà Đô Centrosa'
  async function prepare() {
    setError('')
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1200; canvas.height = 700
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Image export unavailable')
      ctx.fillStyle = vrenaPalette.purple[950]; ctx.fillRect(0, 0, 1200, 700)
      ctx.fillStyle = vrenaPalette.cyan[400]; ctx.fillRect(60, 60, 100, 8)
      ctx.font = 'bold 48px sans-serif'; ctx.fillStyle = vrenaPalette.white; ctx.fillText('VRena · VALUE VOUCHER', 60, 140)
      ctx.font = 'bold 76px sans-serif'; ctx.fillText(formatVnd(voucher.amount), 60, 260)
      ctx.font = '28px sans-serif'; ctx.fillText(venue, 60, 325)
      ctx.font = 'bold 64px monospace'; ctx.fillStyle = vrenaPalette.cyan[300]; ctx.fillText(voucher.code, 60, 410)
      ctx.fillStyle = vrenaPalette.white; ctx.font = '24px sans-serif'
      ctx.fillText(vi ? 'Nhập mã khi đặt chỗ tại booking.vre-vietnam.com hoặc đưa cho nhân viên.' : 'Enter code at booking.vre-vietnam.com or show it to staff.', 60, 490)
      ctx.fillText(vi ? 'Số dư được kiểm tra khi sử dụng. Không đổi thành tiền mặt.' : 'Current balance is checked on redemption. No cash exchange.', 60, 535)
      ctx.fillText(voucherExpiryLabel(voucher.expires_at, vi), 60, 580)
      ctx.font = '20px sans-serif'; ctx.fillText(`Issued ${new Date(voucher.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })}`, 60, 640)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('JPEG export failed')), 'image/jpeg', 0.95))
      setFile(new File([blob], `${voucher.code}.jpg`, { type: 'image/jpeg' }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'JPEG export failed') }
  }
  function download() {
    if (!file) return
    const url = URL.createObjectURL(file)
    const a = document.createElement('a'); a.href = url; a.download = file.name; a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
  return <article className="payment-voucher-card" style={{ border: '1px solid var(--vrena-purple-300)', borderRadius: 16, padding: 16, marginBlock: 12, overflowWrap: 'anywhere' }}>
    <strong>{vi ? 'Voucher giá trị' : 'Value voucher'} · {formatVnd(voucher.amount)}</strong>
    <p><code>{voucher.code}</code></p>
    <p>{vi ? 'Số dư hiện tại' : 'Current balance'}: <strong>{formatVnd(voucher.balance)}</strong> · {venue}</p>
    <p>{voucherExpiryLabel(voucher.expires_at, vi)} {vi ? 'Giữ mã an toàn; số dư được kiểm tra khi dùng.' : 'Keep the code safe; the balance is checked when used.'}</p>
    <div className="staff-row-actions">
      {!file ? <button type="button" className="secondary" onClick={() => void prepare()}>{vi ? 'Tạo ảnh JPEG' : 'Prepare JPEG'}</button> : <>
        <button type="button" className="secondary" onClick={download}>{vi ? 'Tải JPEG' : 'Download JPEG'}</button>
        <button type="button" className="primary" onClick={() => {
          if (navigator.canShare?.({ files: [file] })) void navigator.share({ files: [file], title: 'VRena voucher' }).catch(cause => { if (cause.name !== 'AbortError') setError(cause.message) })
          else download()
        }}>{vi ? 'Chia sẻ JPEG' : 'Share JPEG'}</button>
      </>}
    </div>
    {error && <p role="alert">{error}</p>}
  </article>
}
