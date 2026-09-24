'use client'

import { useEffect, useState, type RefObject } from 'react'
import { Share2 } from 'lucide-react'
import { vrenaPalette } from '../../lib/theme/vrenaPalette'
import { toCanvas } from 'html-to-image'

type Props = { contentRef: RefObject<HTMLDivElement | null>; snapshotKey: string; date: string; language: 'en' | 'vi' }

export function StaffBookingShareButton({ contentRef, snapshotKey, date, language }: Props) {
  const [image, setImage] = useState<{ key: string; file?: File; failed?: boolean } | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const ready = image?.key === snapshotKey ? image : null
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        if (!contentRef.current) return
        const canvas = await toCanvas(contentRef.current, { pixelRatio: 2, backgroundColor: vrenaPalette.white, filter: (node) => !(node instanceof HTMLElement && node.classList.contains('staff-summary-share')) })
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image export failed')), 'image/jpeg', 0.95))
        const file = new File([blob], `VRena-booking-${date}.jpg`, { type: 'image/jpeg' })
        if (!cancelled) setImage({ key: snapshotKey, file })
      } catch {
        if (!cancelled) setImage({ key: snapshotKey, failed: true })
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [contentRef, snapshotKey, date, retry])

  async function share() {
    setError(false)
    if (!ready?.file) { setRetry((value) => value + 1); return }
    try {
      // Prepare the file before the click so native sharing retains user activation.
      if (navigator.share && navigator.canShare?.({ files: [ready.file] })) {
        await navigator.share({ files: [ready.file], title: 'VRena' })
      } else {
        const url = URL.createObjectURL(ready.file)
        const link = document.createElement('a')
        link.href = url
        link.download = ready.file.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(true)
    }
  }
  return <div className="staff-summary-share">
    <button type="button" className="secondary" disabled={!ready} onClick={share}>
      <Share2 size={16} aria-hidden="true" /> {language === 'vi' ? 'Chia sẻ' : 'Share'}
    </button>
    {(error || ready?.failed) && <p role="alert">{language === 'vi' ? 'Không thể chia sẻ hình ảnh. Vui lòng thử lại.' : 'Unable to share the image. Please try again.'}</p>}
  </div>
}
