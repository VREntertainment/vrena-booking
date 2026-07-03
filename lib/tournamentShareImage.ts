type TournamentShareParticipant = {
  accuracyPercent?: number | null
  avatarColor?: string | null
  avatarEmoji?: string | null
  avatarInitials?: string | null
  avatarUrl?: string | null
  displayName?: string | null
  placement?: number | null
  score?: number | null
}

export type ShareTournamentResultsImageOptions = {
  appUrl: string
  dateLabel: string
  fallbackPlayerLabel: string
  participants: TournamentShareParticipant[]
  sessionName: string
  startTime: string
}

export type ShareTournamentResultsImageResult = 'shared' | 'ready'

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

function compactInitials(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return ''
  const words = cleaned.split(/\s+/).filter(Boolean)
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0] || '').join('')
    : Array.from(cleaned).slice(0, 2).join('')
  return letters.toUpperCase()
}

function compactDisplayName(value: string | null | undefined, fallback = 'Player') {
  const cleaned = (value || fallback).trim() || fallback
  return Array.from(cleaned).slice(0, 10).join('')
}

function rankEmoji(placement?: number | null) {
  if (placement === 1) return '🥇'
  if (placement === 2) return '🥈'
  if (placement === 3) return '🥉'
  return ''
}

function safeDownloadSlug(value: string, fallback: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || fallback
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

async function shareTextFallback(title: string, summary: string, appUrl: string): Promise<ShareTournamentResultsImageResult> {
  if (navigator.share) {
    await navigator.share({ title, text: summary, url: appUrl })
    return 'shared'
  }

  await navigator.clipboard?.writeText(summary)
  return 'ready'
}

export async function shareTournamentResultsImage({
  appUrl,
  dateLabel,
  fallbackPlayerLabel,
  participants,
  sessionName,
  startTime,
}: ShareTournamentResultsImageOptions): Promise<ShareTournamentResultsImageResult> {
  const podium = [1, 2, 3]
    .map((placement) => participants.find((participant) => participant.placement === placement))
    .filter(Boolean) as TournamentShareParticipant[]
  const summary = [
    `🏆 ${sessionName}`,
    ...podium.map((participant) => `${rankEmoji(participant.placement)} ${compactDisplayName(participant.displayName, fallbackPlayerLabel)}${participant.score ? ` · ${participant.score}` : ''}`),
    appUrl,
  ].join('\n')

  if (podium.length === 0) {
    return shareTextFallback(sessionName, summary, appUrl)
  }

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
    return shareTextFallback(sessionName, summary, appUrl)
  }

  const drawRoundAvatar = async (participant: TournamentShareParticipant, x: number, y: number, size: number) => {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()

    let drewPhoto = false
    if (participant.avatarUrl) {
      try {
        const image = await loadCanvasImage(participant.avatarUrl)
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
      avatarGradient.addColorStop(0, participant.avatarColor || '#00b6c6')
      avatarGradient.addColorStop(1, '#3059ff')
      ctx.fillStyle = avatarGradient
      ctx.fillRect(x, y, size, size)
      ctx.fillStyle = '#ffffff'
      ctx.font = `800 ${participant.avatarEmoji ? size * 0.48 : size * 0.34}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(participant.avatarEmoji || compactInitials(participant.avatarInitials || participant.displayName || fallbackPlayerLabel).slice(0, 2), x + size / 2, y + size / 2)
    }

    ctx.restore()
  }

  const fitText = (value: string, x: number, y: number, maxWidth: number, size: number, color = '#071112', weight = 900) => {
    let fontSize = size
    ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    while (ctx.measureText(value).width > maxWidth && fontSize > 22) {
      fontSize -= 2
      ctx.font = `${weight} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    }
    ctx.fillStyle = color
    ctx.fillText(value, x, y)
  }

  if (templateImage) {
    ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  ctx.fillStyle = '#071112'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  fitText(sessionName, canvas.width / 2, 300, 820, 46, '#071112', 900)

  ctx.fillStyle = '#4a5a60'
  ctx.font = '800 28px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  ctx.fillText(`${dateLabel} · ${startTime.slice(0, 5)}`, canvas.width / 2, 338)

  const orderedPodium = [2, 1, 3]
    .map((placement) => podium.find((participant) => participant.placement === placement))
    .filter(Boolean) as TournamentShareParticipant[]
  const slots = [
    { placement: 2, x: 125, y: 790, w: 285, h: 172, avatar: 178, avatarY: 580, accent: '#b7c0ca', fill: '#f4f6f8', emoji: '🥈' },
    { placement: 1, x: 388, y: 672, w: 304, h: 290, avatar: 232, avatarY: 405, accent: '#ffc928', fill: '#fff6cf', emoji: '🏆' },
    { placement: 3, x: 670, y: 820, w: 285, h: 142, avatar: 178, avatarY: 610, accent: '#c98742', fill: '#fff0df', emoji: '🥉' },
  ]

  for (const participant of orderedPodium) {
    const slot = slots.find((item) => item.placement === participant.placement)
    if (!slot) continue

    ctx.save()
    ctx.shadowColor = 'rgba(7, 17, 18, 0.12)'
    ctx.shadowBlur = 22
    ctx.shadowOffsetY = 12
    ctx.fillStyle = slot.accent
    drawCanvasRoundRect(ctx, slot.x, slot.y, slot.w, slot.h, 26)
    ctx.fill()
    ctx.restore()

    ctx.fillStyle = slot.fill
    drawCanvasRoundRect(ctx, slot.x + 8, slot.y + 8, slot.w - 16, slot.h - 16, 20)
    ctx.fill()

    await drawRoundAvatar(participant, slot.x + slot.w / 2 - slot.avatar / 2, slot.avatarY, slot.avatar)

    ctx.strokeStyle = slot.accent
    ctx.lineWidth = slot.placement === 1 ? 8 : 6
    ctx.beginPath()
    ctx.arc(slot.x + slot.w / 2, slot.avatarY + slot.avatar / 2, slot.avatar / 2 + 4, 0, Math.PI * 2)
    ctx.stroke()

    ctx.font = `900 ${slot.placement === 1 ? 58 : 46}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(slot.emoji, slot.x + slot.w / 2 + slot.avatar / 2 - 8, slot.avatarY + 18)

    ctx.textBaseline = 'alphabetic'
    fitText(compactDisplayName(participant.displayName, fallbackPlayerLabel), slot.x + slot.w / 2, slot.y + slot.h - 78, slot.w - 34, slot.placement === 1 ? 38 : 32)

    ctx.fillStyle = '#39464b'
    ctx.font = `800 ${slot.placement === 1 ? 26 : 23}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
    ctx.fillText(`${participant.score ?? 0} pts · ${participant.accuracyPercent ?? '-'}%`, slot.x + slot.w / 2, slot.y + slot.h - 38)
  }

  let blob: Blob | null = null
  try {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  } catch {
    blob = null
  }

  if (!blob) {
    return shareTextFallback(sessionName, summary, appUrl)
  }

  const file = new File([blob], `${safeDownloadSlug(sessionName, 'vrena-tournament')}-results.jpg`, { type: 'image/jpeg' })

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: sessionName, text: summary })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
  return 'ready'
}
