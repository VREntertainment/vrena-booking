import { DEFAULT_APP_URL, loadCanvasImage } from './bookingWidgetDomain'

export type AchievementShareResult = 'shared' | 'ready' | 'cancelled'

export type AchievementShareTheme = {
  accent?: string
  background?: string
}

export type AchievementShareOptions = {
  appUrl?: string
  badgeImageUrl?: string | null
  current?: number | null
  description: string
  displayName: string
  fileLabel: string
  footer?: string
  kindLabel: string
  progressLabel?: string
  rarityLabel?: string
  target?: number | null
  theme?: AchievementShareTheme
  title: string
}

const defaultTheme = {
  accent: '#3059ff',
  background: '#f6fbfb',
}

function safeDownloadSlug(value: string, fallback: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || fallback
}

function isShareCancelled(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const { name, message } = error as { name?: string; message?: string }
  return name === 'AbortError' || /cancel/i.test(message || '')
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

function fitText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color = '#071112',
  weight = 900,
  align: CanvasTextAlign = 'center',
) {
  let fontSize = size
  ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  while (ctx.measureText(value).width > maxWidth && fontSize > 18) {
    fontSize -= 2
    ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  }
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(value, x, y)
}

function wrapText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  })

  if (current) lines.push(current)
  return lines.slice(0, 3)
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  try {
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  } catch {
    return null
  }
}

async function tryNativeShare(data: ShareData): Promise<AchievementShareResult | null> {
  if (!navigator.share) return null

  try {
    await navigator.share(data)
    return 'shared'
  } catch (error) {
    if (isShareCancelled(error)) return 'cancelled'
    return null
  }
}

async function copyShareText(summary: string) {
  try {
    await navigator.clipboard?.writeText(summary)
  } catch {
    // Clipboard permissions vary by browser; sharing still has a download fallback.
  }
}

function downloadShareImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

export function achievementShareText({
  appUrl = DEFAULT_APP_URL,
  description,
  displayName,
  kindLabel,
  rarityLabel,
  title,
}: Pick<AchievementShareOptions, 'appUrl' | 'description' | 'displayName' | 'kindLabel' | 'rarityLabel' | 'title'>) {
  return [
    `${displayName} unlocked "${title}" at VRena.`,
    rarityLabel ? `${kindLabel} - ${rarityLabel}` : kindLabel,
    description,
    appUrl,
  ].filter(Boolean).join('\n')
}

export function openAchievementShareChannel(channel: 'email' | 'whatsapp', summary: string, subject: string) {
  const encodedSummary = encodeURIComponent(summary)
  const encodedSubject = encodeURIComponent(subject)
  const url = channel === 'whatsapp'
    ? `https://wa.me/?text=${encodedSummary}`
    : `mailto:?subject=${encodedSubject}&body=${encodedSummary}`

  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function shareAchievementImage(options: AchievementShareOptions): Promise<AchievementShareResult> {
  const appUrl = options.appUrl || DEFAULT_APP_URL
  const theme = { ...defaultTheme, ...options.theme }
  const summary = achievementShareText({ ...options, appUrl })

  let templateImage: HTMLImageElement | null = null
  try {
    templateImage = await loadCanvasImage(`${window.location.origin}/brand/tournament-leaderboard-template.jpg`)
  } catch {
    templateImage = null
  }

  const canvas = document.createElement('canvas')
  canvas.width = templateImage?.naturalWidth || 1080
  canvas.height = templateImage?.naturalHeight || 1350
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    const textShareResult = await tryNativeShare({ title: options.title, text: summary, url: appUrl })
    if (textShareResult) return textShareResult
    await copyShareText(summary)
    return 'ready'
  }

  const templateWidth = 1080
  const templateHeight = 1350
  const canvasScale = Math.min(canvas.width / templateWidth, canvas.height / templateHeight)
  const ss = (value: number) => value * canvasScale
  const sx = (value: number) => value * canvasScale
  const sy = (value: number) => value * canvasScale

  if (templateImage) {
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    drawRoundRect(ctx, sx(160), sy(166), ss(760), ss(86), ss(26))
    ctx.fill()
  } else {
    const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    background.addColorStop(0, theme.background)
    background.addColorStop(0.58, '#ffffff')
    background.addColorStop(1, '#dfe8ff')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(48, 89, 255, 0.1)'
    ctx.beginPath()
    ctx.arc(ss(130), ss(130), ss(260), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(245, 197, 66, 0.18)'
    ctx.beginPath()
    ctx.arc(ss(960), ss(310), ss(230), 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = '#071112'
  ctx.textBaseline = 'alphabetic'
  fitText(ctx, 'ACHIEVEMENT UNLOCKED', canvas.width / 2, sy(214), ss(760), ss(44), theme.accent, 950)
  fitText(ctx, options.displayName, canvas.width / 2, sy(292), ss(820), ss(48))

  const badgeX = sx(290)
  const badgeY = sy(352)
  const badgeSize = ss(500)
  ctx.save()
  ctx.shadowColor = 'rgba(7, 17, 18, 0.18)'
  ctx.shadowBlur = ss(34)
  ctx.shadowOffsetY = ss(18)
  ctx.fillStyle = '#071112'
  drawRoundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, ss(48))
  ctx.fill()
  ctx.restore()

  let drewBadge = false
  if (options.badgeImageUrl) {
    try {
      const image = await loadCanvasImage(options.badgeImageUrl)
      const scale = Math.max(badgeSize / image.naturalWidth, badgeSize / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      ctx.save()
      drawRoundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, ss(48))
      ctx.clip()
      ctx.drawImage(image, badgeX + (badgeSize - width) / 2, badgeY + (badgeSize - height) / 2, width, height)
      ctx.restore()
      drewBadge = true
    } catch {
      drewBadge = false
    }
  }

  if (!drewBadge) {
    const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeSize, badgeY + badgeSize)
    badgeGradient.addColorStop(0, theme.accent)
    badgeGradient.addColorStop(1, '#00aeb3')
    ctx.fillStyle = badgeGradient
    drawRoundRect(ctx, badgeX, badgeY, badgeSize, badgeSize, ss(48))
    ctx.fill()
    fitText(ctx, '★', canvas.width / 2, badgeY + ss(322), ss(360), ss(190), '#ffffff', 900)
  }

  ctx.fillStyle = 'rgba(7, 17, 18, 0.42)'
  drawRoundRect(ctx, badgeX + ss(42), badgeY + badgeSize - ss(120), badgeSize - ss(84), ss(70), ss(28))
  ctx.fill()
  fitText(ctx, options.kindLabel, canvas.width / 2, badgeY + badgeSize - ss(75), badgeSize - ss(140), ss(28), '#ffffff', 900)

  fitText(ctx, options.title, canvas.width / 2, sy(925), ss(870), ss(58))
  if (options.rarityLabel) {
    fitText(ctx, options.rarityLabel, canvas.width / 2, sy(974), ss(620), ss(28), theme.accent, 900)
  }

  ctx.font = `850 ${ss(32)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  const lines = wrapText(ctx, options.description, ss(820))
  lines.forEach((line, index) => {
    fitText(ctx, line, canvas.width / 2, sy(1032 + index * 42), ss(820), ss(32), '#39464b', 850)
  })

  if (typeof options.current === 'number' && typeof options.target === 'number' && options.target > 0) {
    const trackX = sx(190)
    const trackY = sy(1168)
    const trackWidth = ss(700)
    const percent = Math.max(0, Math.min(1, options.current / options.target))
    ctx.fillStyle = 'rgba(7, 17, 18, 0.1)'
    drawRoundRect(ctx, trackX, trackY, trackWidth, ss(18), ss(999))
    ctx.fill()
    ctx.fillStyle = theme.accent
    drawRoundRect(ctx, trackX, trackY, trackWidth * percent, ss(18), ss(999))
    ctx.fill()
    fitText(ctx, options.progressLabel || `${options.current}/${options.target}`, canvas.width / 2, sy(1214), ss(500), ss(26), '#657278', 850)
  }

  if (!templateImage) {
    fitText(ctx, options.footer || appUrl.replace(/^https?:\/\//, ''), canvas.width / 2, sy(1310), ss(760), ss(24), '#657278', 800)
  }

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)

  if (!blob) {
    const textShareResult = await tryNativeShare({ title: options.title, text: summary, url: appUrl })
    if (textShareResult) return textShareResult
    await copyShareText(summary)
    return 'ready'
  }

  const file = new File([blob], `${safeDownloadSlug(options.fileLabel, 'vrena-achievement')}.jpg`, { type: 'image/jpeg' })

  if (navigator.canShare?.({ files: [file] })) {
    const fileShareResult = await tryNativeShare({ files: [file], title: options.title, text: summary })
    if (fileShareResult) return fileShareResult
  }

  const textShareResult = await tryNativeShare({ title: options.title, text: summary, url: appUrl })
  if (textShareResult) return textShareResult

  downloadShareImage(blob, file.name)
  await copyShareText(summary)
  return 'ready'
}
