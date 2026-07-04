import { buildPlayerStatsShareSummary, formatWholePercent } from './playerStatsShare'

type ShareStatsImageLabels = {
  accuracy: string
  bestPerformerCount: string
  bestScores: string
  currentRank: string
  gamesPlayed: string
  projectiles: string
  rankFallback: string
  statsTitle: string
  totalScore: string
  wins: string
}

type ShareStatsImagePlayer = {
  averageAccuracy: number | null
  avatarColor: string | null
  avatarEmoji: string | null
  avatarInitials: string | null
  avatarTextColor: string | null
  avatarUrl: string | null
  bestByGame: Array<{ game: string; score: number }>
  bestPerformerCount: number
  displayName: string
  gamesJoined: number
  leaderboardDistinctRank?: number | null
  leaderboardRank?: number
  profileId: string
  sessionsJoined: number
  totalProjectiles: number
  totalScore: number
  wins: number
}

export type SharePlayerStatsImageOptions = {
  appUrl: string
  contextLabel?: string
  currentRank?: number
  displayName: string
  distinctRank?: number | null
  fallbackPlayerLabel: string
  labels: ShareStatsImageLabels
  player: ShareStatsImagePlayer
}

export type SharePlayerStatsImageResult = 'shared' | 'ready' | 'cancelled'

async function loadCanvasImage(src: string) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('image failed'))
    image.src = src
  })
  return image
}

function drawCanvasRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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

function compactInitials(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return ''
  const words = cleaned.split(/\s+/).filter(Boolean)
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0] || '').join('')
    : Array.from(cleaned).slice(0, 2).join('')
  return letters.toUpperCase()
}

function safeDownloadSlug(value: string, fallback: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || fallback
}

function isShareCancelled(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const { name, message } = error as { name?: string; message?: string }
  return name === 'AbortError' || /cancel/i.test(message || '')
}

async function tryNativeShare(data: ShareData): Promise<SharePlayerStatsImageResult | null> {
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
    // Clipboard permissions vary by browser; downloading the image remains the durable fallback.
  }
}

async function shareTextFallback(title: string, summary: string, appUrl: string): Promise<SharePlayerStatsImageResult> {
  const nativeShareResult = await tryNativeShare({ title, text: summary, url: appUrl })
  if (nativeShareResult) return nativeShareResult

  await copyShareText(summary)
  return 'ready'
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

export async function sharePlayerStatsImage({
  appUrl,
  contextLabel = '',
  currentRank,
  displayName,
  distinctRank,
  fallbackPlayerLabel,
  labels,
  player,
}: SharePlayerStatsImageOptions): Promise<SharePlayerStatsImageResult> {
  const { rankTitle, summary, title } = buildPlayerStatsShareSummary({
    appUrl,
    contextLabel,
    currentRank,
    displayName,
    labels,
    stats: {
      ...player,
      leaderboardDistinctRank: distinctRank,
      leaderboardRank: currentRank,
    },
  })

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
    return shareTextFallback(title, summary, appUrl)
  }

  const templateWidth = 1080
  const templateHeight = 1350
  const canvasScale = Math.min(canvas.width / templateWidth, canvas.height / templateHeight)
  const overlayScale = templateImage ? canvasScale * 0.9 : canvasScale
  const overlayOffsetY = templateImage ? 18 * canvasScale : 0
  const sy = (value: number) => overlayOffsetY + value * overlayScale
  const ss = (value: number) => value * overlayScale

  const fitText = (value: string, x: number, y: number, maxWidth: number, size: number, color = '#071112', weight = 900, align: CanvasTextAlign = 'center') => {
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

  const drawShareAvatar = async (x: number, y: number, size: number) => {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()

    let drewPhoto = false
    if (player.avatarUrl) {
      try {
        const image = await loadCanvasImage(player.avatarUrl)
        const imageWidth = image.naturalWidth || image.width
        const imageHeight = image.naturalHeight || image.height
        const scale = Math.max(size / imageWidth, size / imageHeight)
        const drawWidth = imageWidth * scale
        const drawHeight = imageHeight * scale
        ctx.drawImage(image, x + (size - drawWidth) / 2, y + (size - drawHeight) / 2, drawWidth, drawHeight)
        drewPhoto = true
      } catch {
        drewPhoto = false
      }
    }

    if (!drewPhoto) {
      const avatarGradient = ctx.createLinearGradient(x, y, x + size, y + size)
      avatarGradient.addColorStop(0, player.avatarColor || '#00b6c6')
      avatarGradient.addColorStop(1, '#3059ff')
      ctx.fillStyle = avatarGradient
      ctx.fillRect(x, y, size, size)
      ctx.fillStyle = player.avatarTextColor || '#ffffff'
      ctx.font = `900 ${player.avatarEmoji ? size * 0.5 : size * 0.34}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(player.avatarEmoji || compactInitials(player.avatarInitials || player.displayName || fallbackPlayerLabel).slice(0, 2), x + size / 2, y + size / 2)
    }

    ctx.restore()
  }

  if (templateImage) {
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height)
  } else {
    const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    background.addColorStop(0, '#f6fbfb')
    background.addColorStop(1, '#dfe8ff')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.textBaseline = 'alphabetic'

  await drawShareAvatar(canvas.width / 2 - ss(104), sy(278), ss(208))

  ctx.strokeStyle = '#3059ff'
  ctx.lineWidth = ss(7)
  ctx.beginPath()
  ctx.arc(canvas.width / 2, sy(382), ss(108), 0, Math.PI * 2)
  ctx.stroke()

  fitText(displayName, canvas.width / 2, sy(528), ss(740), ss(52))
  if (contextLabel) {
    fitText(contextLabel, canvas.width / 2, sy(570), ss(660), ss(25), '#657278', 800)
  }

  if (currentRank) {
    fitText(`#${currentRank}`, canvas.width / 2, sy(contextLabel ? 616 : 590), ss(300), ss(38), '#3059ff', 900)
    fitText(rankTitle, canvas.width / 2, sy(contextLabel ? 650 : 624), ss(620), ss(26), '#657278', 850)
  } else {
    fitText(rankTitle, canvas.width / 2, sy(contextLabel ? 620 : 596), ss(620), ss(27), '#657278', 850)
  }

  const primaryStats = [
    { label: labels.totalScore, value: player.totalScore.toLocaleString('en-US') },
    { label: labels.gamesPlayed, value: `${player.gamesJoined}` },
    { label: labels.wins, value: `${player.wins}` },
    { label: labels.bestPerformerCount, value: `${player.bestPerformerCount}` },
    { label: labels.accuracy, value: formatWholePercent(player.averageAccuracy) },
    { label: labels.projectiles, value: `${player.totalProjectiles}` },
  ]

  const cardWidth = ss(276)
  const cardHeight = ss(138)
  const cardGap = ss(34)
  const rowGap = ss(28)
  const startX = (canvas.width - cardWidth * 3 - cardGap * 2) / 2
  const startY = sy(690)

  primaryStats.forEach((stat, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = startX + col * (cardWidth + cardGap)
    const y = startY + row * (cardHeight + rowGap)

    ctx.fillStyle = '#f0f4f6'
    drawCanvasRoundRect(ctx, x, y, cardWidth, cardHeight, ss(24))
    ctx.fill()
    fitText(stat.label, x + cardWidth / 2, y + ss(44), cardWidth - ss(36), ss(24), '#657278', 800)
    fitText(stat.value, x + cardWidth / 2, y + ss(98), cardWidth - ss(36), ss(46), '#071112', 900)
  })

  const bestScores = player.bestByGame.slice(0, 3)
  if (bestScores.length > 0) {
    fitText(labels.bestScores, canvas.width / 2, sy(1064), ss(700), ss(30), '#071112', 900)
    bestScores.forEach((item, index) => {
      fitText(`${item.game}: ${item.score}`, canvas.width / 2, sy(1110 + index * 40), ss(720), ss(28), '#39464b', 800)
    })
  }

  if (!templateImage) {
    fitText('vrena-booking.vercel.app', canvas.width / 2, canvas.height - 94, 700, 24, '#657278', 800)
  }

  let blob: Blob | null = null
  try {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  } catch {
    blob = null
  }

  if (!blob) {
    return shareTextFallback(title, summary, appUrl)
  }

  const file = new File([blob], `${safeDownloadSlug(displayName, 'vrena-player')}-stats.jpg`, { type: 'image/jpeg' })

  if (navigator.canShare?.({ files: [file] })) {
    const nativeFileResult = await tryNativeShare({ files: [file], title, text: summary })
    if (nativeFileResult) return nativeFileResult
  }

  downloadShareImage(blob, file.name)
  await copyShareText(summary)
  return 'ready'
}
