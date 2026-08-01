export const venueGameSlugs = [
  'laser-tag',
  'mini-block-towers',
  'office-war',
  'paintball',
  'snow-battle',
  'castle-unspunnen',
  'wild-west',
  'arc-of-the-covenant',
  'joller-house',
  'zg-marbles',
] as const

export type VenueGameSlug = typeof venueGameSlugs[number]

export type VenueResultPlayer = {
  accuracyPercent: number | null
  hits: number
  movementMeters: number | null
  name: string
  score: number
}

export type VenueResultPayload = {
  captureId: string
  capturedAt: string
  deviceName: string
  externalSessionLabel: string | null
  gameName: string
  gameSlug: VenueGameSlug
  players: VenueResultPlayer[]
}

const gameAliases: Record<string, VenueGameSlug> = {
  arccovenant: 'arc-of-the-covenant',
  arcofthecovenant: 'arc-of-the-covenant',
  castleunspunnen: 'castle-unspunnen',
  dgb: 'arc-of-the-covenant',
  unspunnen: 'castle-unspunnen',
  joller: 'joller-house',
  jollerhouse: 'joller-house',
  lasertag: 'laser-tag',
  mbtowers: 'mini-block-towers',
  miniblocktowers: 'mini-block-towers',
  officewar: 'office-war',
  paintball: 'paintball',
  secretarc: 'arc-of-the-covenant',
  showbattle: 'snow-battle',
  snowbattle: 'snow-battle',
  wildwest: 'wild-west',
  zgmarbles: 'zg-marbles',
}

function normalizedAlias(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
}

export function venueGameSlugFromName(value: unknown): VenueGameSlug | null {
  if (typeof value !== 'string') return null
  const direct = value.trim().toLowerCase()
  if (venueGameSlugs.includes(direct as VenueGameSlug)) return direct as VenueGameSlug
  return gameAliases[normalizedAlias(value)] ?? null
}

function finiteNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  const numeric = finiteNumber(value)
  if (numeric === null || !Number.isInteger(numeric) || numeric < minimum || numeric > maximum) return null
  return numeric
}

function boundedDecimal(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === '') return null
  const numeric = finiteNumber(value)
  if (numeric === null || numeric < minimum || numeric > maximum) return undefined
  return Math.round(numeric * 100) / 100
}

function cleanString(value: unknown, maximumLength: number) {
  if (typeof value !== 'string') return ''
  return Array.from(value.trim()).slice(0, maximumLength).join('')
}

export function parseVenueResultPayload(value: unknown): VenueResultPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>

  const captureId = cleanString(body.captureId, 128)
  if (!/^[a-fA-F0-9-]{16,128}$/.test(captureId)) return null

  const capturedAt = cleanString(body.capturedAt, 64)
  const capturedTimestamp = Date.parse(capturedAt)
  if (!capturedAt || !Number.isFinite(capturedTimestamp)) return null

  const gameName = cleanString(body.gameName, 120)
  const gameSlug = venueGameSlugFromName(body.gameSlug) ?? venueGameSlugFromName(gameName)
  if (!gameName || !gameSlug) return null

  if (!Array.isArray(body.players) || body.players.length < 1 || body.players.length > 16) return null
  const players: VenueResultPlayer[] = []

  for (const candidate of body.players) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
    const player = candidate as Record<string, unknown>
    const name = cleanString(player.name, 80)
    const score = boundedInteger(player.score, 0, 10_000_000)
    const hits = boundedInteger(player.hits, 0, 10_000_000)
    const accuracyPercent = boundedDecimal(player.accuracyPercent, 0, 100)
    const movementMeters = boundedDecimal(player.movementMeters, 0, 1_000_000)

    if (!name || score === null || hits === null || accuracyPercent === undefined || movementMeters === undefined) {
      return null
    }

    players.push({
      accuracyPercent,
      hits,
      movementMeters,
      name,
      score,
    })
  }

  if (new Set(players.map((player) => player.name)).size !== players.length) return null

  return {
    captureId,
    capturedAt: new Date(capturedTimestamp).toISOString(),
    deviceName: cleanString(body.deviceName, 120) || 'VRena Results Capture',
    externalSessionLabel: cleanString(body.externalSessionLabel, 120) || null,
    gameName,
    gameSlug,
    players,
  }
}

export function venueSessionContainsTimestamp(
  sessionDate: string,
  startTime: string,
  durationMinutes: number,
  capturedAt: string
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return false
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(startTime)) return false
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return false

  const normalizedTime = startTime.length === 5 ? `${startTime}:00` : startTime
  const startsAt = Date.parse(`${sessionDate}T${normalizedTime}+07:00`)
  const capturedTimestamp = Date.parse(capturedAt)
  if (!Number.isFinite(startsAt) || !Number.isFinite(capturedTimestamp)) return false

  const endsAt = startsAt + durationMinutes * 60_000
  return capturedTimestamp >= startsAt && capturedTimestamp < endsAt
}

export function venueCaptureDateRange(capturedAt: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  })
  const localDate = formatter.format(new Date(capturedAt))
  const center = new Date(`${localDate}T00:00:00+07:00`)
  const previous = new Date(center.getTime() - 86_400_000)
  const next = new Date(center.getTime() + 86_400_000)
  const dateOnly = (date: Date) => new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).format(date)

  return {
    from: dateOnly(previous),
    to: dateOnly(next),
  }
}
