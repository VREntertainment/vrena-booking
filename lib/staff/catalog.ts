import type { LanguageCode } from '../i18n/languages.ts'
import { languageOptions } from '../i18n/languages.ts'
import { uiText } from '../i18n/translations.ts'
import type { StaffConsoleCopy } from './copy.ts'
import { staffConsoleText } from './copy.ts'
import { defaultStaffArenaIds, staffAudienceOptions } from './options.ts'
import type { StaffAudience, StaffGame, StaffGuideTextMap } from './types.ts'

export function normalizeStaffAudienceToken(value: string): StaffAudience | null {
  const token = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (!token) return null
  if (token === 'familyfriendly' || token === 'family_friendly' || token === 'family') return 'family_friendly'
  if (token === 'beginnerfriendly' || token === 'beginner_friendly' || token === 'beginner') return 'beginner_friendly'
  if (token === 'scary' || token === 'hard') return 'scary'
  if (token === 'fun' || token === 'medium') return 'fun'
  if (token === 'quest') return 'quest'
  if (token === 'teamwork' || token === 'team') return 'teamwork'
  if (token === 'competitive') return 'competitive'
  if (token === 'easy') return 'family_friendly'
  return null
}

export function normalizeStaffAudienceItems(value?: StaffAudience[] | string[] | string | null): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value !== 'string') return []

  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return parsed.map((item) => String(item))
    if (typeof parsed === 'string') return [parsed]
  } catch {
    // Postgres array strings and legacy comma text are handled below.
  }

  return trimmed
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeStaffAudience(value?: StaffAudience[] | string[] | string | null, legacyDifficulty?: string | null): StaffAudience[] {
  const validOptions = new Set<StaffAudience>(staffAudienceOptions)
  const selected = normalizeStaffAudienceItems(value).reduce<StaffAudience[]>((items, item) => {
    const audience = normalizeStaffAudienceToken(item)
    if (audience && validOptions.has(audience) && !items.includes(audience)) items.push(audience)
    return items
  }, [])

  if (selected.length) return selected

  const legacyAudience = normalizeStaffAudienceItems(legacyDifficulty).reduce<StaffAudience[]>((items, item) => {
    const audience = normalizeStaffAudienceToken(item)
    if (audience && validOptions.has(audience) && !items.includes(audience)) items.push(audience)
    return items
  }, [])
  if (legacyAudience.length) return legacyAudience

  const legacy = (legacyDifficulty || '').toLowerCase()
  if (legacy.includes('family')) return ['family_friendly']
  if (legacy.includes('scary') || legacy.includes('hard')) return ['scary']
  if (legacy.includes('beginner')) return ['beginner_friendly']
  if (legacy.includes('quest')) return ['quest']
  if (legacy.includes('team')) return ['teamwork']
  if (legacy.includes('competitive')) return ['competitive']
  if (legacy.includes('fun') || legacy.includes('medium')) return ['fun']
  if (legacy.includes('easy')) return ['family_friendly', 'fun']
  return []
}

export function staffAudienceLabel(value?: StaffAudience[] | string[] | string | null, legacyDifficulty?: string | null, text: StaffConsoleCopy = staffConsoleText.en) {
  const audience = normalizeStaffAudience(value, legacyDifficulty)
  return audience.map((item) => text.audienceOptions[item]).join(', ')
}

export function isMissingStaffAudienceColumnError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('audience') && (normalized.includes('schema cache') || normalized.includes('column'))
}

export function normalizeGuideLanguage(value?: string | null): LanguageCode {
  return languageOptions.includes(value as LanguageCode) ? value as LanguageCode : 'en'
}

export function normalizeGuideTextMap(value?: unknown): StaffGuideTextMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return languageOptions.reduce<StaffGuideTextMap>((guideText, language) => {
    const item = (value as Record<string, unknown>)[language]
    if (typeof item === 'string' && item.trim()) {
      guideText[language] = item
    }
    return guideText
  }, {})
}

export function cleanGuideTextMap(value: StaffGuideTextMap): StaffGuideTextMap {
  return languageOptions.reduce<StaffGuideTextMap>((guideText, language) => {
    const item = value[language]?.trim()
    if (item) guideText[language] = item
    return guideText
  }, {})
}

export function guideTextValue(value: StaffGuideTextMap, language: LanguageCode) {
  return value[language] || ''
}

export function guideTextForEditing(value: string) {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n')
}

export function defaultGameGuideMaps(slug: string, gameType: StaffGame['game_type']) {
  const isMiniBlockTowers = slug === 'mini-block-towers'
  const isEscape = gameType === 'escape'

  return languageOptions.reduce<{
    guide_summary: StaffGuideTextMap
    guide_rules: StaffGuideTextMap
    guide_tips: StaffGuideTextMap
  }>((guides, language) => {
    const text = uiText[language]
    const summary = isMiniBlockTowers
      ? text.gameGuideBlockTowersSummary
      : isEscape
        ? text.gameGuideEscapeSummary
        : text.gameGuideFpsSummary
    const rules = isEscape
      ? ''
      : isMiniBlockTowers
        ? text.gameGuideBlockTowersRules
        : text.gameGuideFpsRules
    const tips = isMiniBlockTowers
      ? text.gameGuideBlockTowersTips
      : isEscape
        ? text.gameGuideEscapeTips
        : text.gameGuideFpsTips

    guides.guide_summary[language] = guideTextForEditing(summary)
    if (rules.trim()) guides.guide_rules[language] = guideTextForEditing(rules)
    guides.guide_tips[language] = guideTextForEditing(tips)
    return guides
  }, { guide_summary: {}, guide_rules: {}, guide_tips: {} })
}

export function guideTextMapWithDefaults(value: unknown, defaults: StaffGuideTextMap) {
  const savedGuideText = normalizeGuideTextMap(value)
  return languageOptions.reduce<StaffGuideTextMap>((guideText, language) => {
    guideText[language] = savedGuideText[language] || defaults[language] || ''
    return guideText
  }, {})
}

export function parseStaffArenaIds(value?: string | null) {
  const knownArenaIds = new Set(defaultStaffArenaIds)
  const arenaIds = (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => knownArenaIds.has(item))

  return arenaIds.length ? arenaIds : defaultStaffArenaIds
}

export function parseStaffDuration(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.floor(value) : null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return Math.floor(Number(trimmed))
  const parts = trimmed.split(':').map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null
  if (parts.length === 2) return Math.floor(parts[0] * 60 + parts[1])
  if (parts.length === 3) return Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2])
  return null
}

export function formatStaffDuration(value: number | null | undefined) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const wholeSeconds = Math.floor(seconds)
  const hours = Math.floor(wholeSeconds / 3600)
  const minutes = Math.floor((wholeSeconds % 3600) / 60)
  const remainingSeconds = wholeSeconds % 60
  const minuteText = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes)
  return hours > 0
    ? `${hours}:${minuteText}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minuteText}:${String(remainingSeconds).padStart(2, '0')}`
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `game-${Date.now()}`
}

export function safeStorageFileName(value: string) {
  const extension = value.includes('.') ? value.split('.').pop() || '' : ''
  const baseName = value.replace(/\.[^.]+$/, '')
  const safeBase = baseName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'file'
  return extension ? `${safeBase}.${extension.toLowerCase()}` : safeBase
}
