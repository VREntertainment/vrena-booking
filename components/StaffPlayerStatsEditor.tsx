'use client'

import { ChevronDown, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { games } from '../lib/bookingStaticData'
import type { LanguageCode } from '../lib/i18n/languages'
import {
  initialLeaderboardQuery,
  leaderboardPlayerFromRpcRow,
  leaderboardRpcArgs,
  type LeaderboardRpcRow,
} from '../lib/leaderboard'
import type { LeaderboardPlayer } from './LeaderboardPanel'

export type StaffPlayerStatFields = {
  sessionsJoined: string
  gamesJoined: string
  wins: string
  bestPerformerCount: string
  totalScore: string
  bestScore: string
  averageAccuracy: string
  totalProjectiles: string
  totalMovementMeters: string
  bestEscapeDurationSeconds: string
}

type StoredOverride = Partial<Record<keyof StaffPlayerStatFields, number>> & {
  scope: string
}

type OverridePayload = {
  profileId?: string
  loyaltyPoints?: number
  overrides?: StoredOverride[]
}

export type StaffPlayerStatsDraft = {
  games: Array<Record<string, number | string | null>>
  loyaltyPoints: number
  overall: Record<string, number | string | null>
}

type StaffPlayerStatsEditorProps = {
  deferredSave?: boolean
  language: LanguageCode
  onDraftChange?: (draft: StaffPlayerStatsDraft | null, dirty: boolean) => void
  onLoadingChange?: (loading: boolean) => void
  onSaved: () => void
  player: LeaderboardPlayer
}

const emptyFields = (): StaffPlayerStatFields => ({
  sessionsJoined: '',
  gamesJoined: '',
  wins: '',
  bestPerformerCount: '',
  totalScore: '',
  bestScore: '',
  averageAccuracy: '',
  totalProjectiles: '',
  totalMovementMeters: '',
  bestEscapeDurationSeconds: '',
})

const copy = {
  en: {
    accuracy: 'Average accuracy (%)',
    bestEscape: 'Best escape time (seconds)',
    bestPerformer: 'Best Performer count',
    bestScore: 'Best single-game score',
    gameStats: 'Stats per game',
    games: 'Games played',
    generalStats: 'General totals',
    hits: 'Total hits / shots',
    loading: 'Loading editable stats…',
    loyalty: 'Loyalty points',
    movement: 'Movement (meters)',
    save: 'Save all stats',
    saved: 'Player stats saved.',
    sessions: 'Sessions joined',
    title: 'Edit player stats',
    totalScore: 'Total score',
    wins: 'Wins',
  },
  vi: {
    accuracy: 'Độ chính xác trung bình (%)',
    bestEscape: 'Thời gian thoát tốt nhất (giây)',
    bestPerformer: 'Số lần Best Performer',
    bestScore: 'Điểm cao nhất trong một lượt',
    gameStats: 'Thống kê theo trò chơi',
    games: 'Số lượt chơi',
    generalStats: 'Tổng thống kê',
    hits: 'Tổng số hit / phát bắn',
    loading: 'Đang tải thống kê có thể chỉnh sửa…',
    loyalty: 'Điểm khách hàng thân thiết',
    movement: 'Quãng đường (mét)',
    save: 'Lưu tất cả thống kê',
    saved: 'Đã lưu thống kê người chơi.',
    sessions: 'Số phiên đã tham gia',
    title: 'Chỉnh sửa thống kê người chơi',
    totalScore: 'Tổng điểm',
    wins: 'Số trận thắng',
  },
} as const

function numberString(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? '' : String(value)
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '')
  }
  return String(error)
}

function fieldsFromOverride(value?: StoredOverride): StaffPlayerStatFields {
  if (!value) return emptyFields()
  return {
    sessionsJoined: numberString(value.sessionsJoined),
    gamesJoined: numberString(value.gamesJoined),
    wins: numberString(value.wins),
    bestPerformerCount: numberString(value.bestPerformerCount),
    totalScore: numberString(value.totalScore),
    bestScore: numberString(value.bestScore),
    averageAccuracy: numberString(value.averageAccuracy),
    totalProjectiles: numberString(value.totalProjectiles),
    totalMovementMeters: numberString(value.totalMovementMeters),
    bestEscapeDurationSeconds: numberString(value.bestEscapeDurationSeconds),
  }
}

function integerOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error('Enter a valid whole number.')
  }
  return parsed
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error('Enter a valid number.')
  return parsed
}

function fieldsPayload(fields: StaffPlayerStatFields, scope?: string) {
  return {
    ...(scope ? { scope } : {}),
    sessionsJoined: integerOrNull(fields.sessionsJoined),
    gamesJoined: integerOrNull(fields.gamesJoined),
    wins: integerOrNull(fields.wins),
    bestPerformerCount: integerOrNull(fields.bestPerformerCount),
    totalScore: integerOrNull(fields.totalScore),
    bestScore: integerOrNull(fields.bestScore),
    averageAccuracy: numberOrNull(fields.averageAccuracy),
    totalProjectiles: integerOrNull(fields.totalProjectiles),
    totalMovementMeters: numberOrNull(fields.totalMovementMeters),
    bestEscapeDurationSeconds: integerOrNull(fields.bestEscapeDurationSeconds),
  }
}

const additiveLinkedFields: Array<keyof StaffPlayerStatFields> = [
  'sessionsJoined',
  'gamesJoined',
  'wins',
  'bestPerformerCount',
  'totalScore',
  'totalProjectiles',
  'totalMovementMeters',
]

function calculatedField(
  player: LeaderboardPlayer | undefined,
  field: keyof StaffPlayerStatFields,
) {
  if (!player) return 0
  if (field === 'bestScore') return player.bestByGame[0]?.score ?? 0
  if (field === 'bestEscapeDurationSeconds') return player.bestEscapeDurationSeconds ?? 0
  const value = player[field as keyof LeaderboardPlayer]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function fieldNumber(value: string, fallback: number) {
  if (!value.trim()) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function linkedOverallFields(
  currentOverall: StaffPlayerStatFields,
  nextGameFields: Record<string, StaffPlayerStatFields>,
  calculatedByScope: Record<string, LeaderboardPlayer>,
  player: LeaderboardPlayer,
) {
  const linked = { ...currentOverall }

  additiveLinkedFields.forEach((field) => {
    if (!games.some((game) => (nextGameFields[game.id]?.[field] || '').trim())) return
    const adjustment = games.reduce((total, game) => {
      const calculated = calculatedField(calculatedByScope[game.id], field)
      const effective = fieldNumber(nextGameFields[game.id]?.[field] || '', calculated)
      return total + effective - calculated
    }, 0)
    const nextValue = calculatedField(player, field) + adjustment
    linked[field] = Number.isInteger(nextValue) ? String(nextValue) : String(Number(nextValue.toFixed(2)))
  })

  const hasAccuracyOverride = games.some(
    (game) => (nextGameFields[game.id]?.averageAccuracy || '').trim(),
  )
  const weightedAccuracy = games.reduce((summary, game) => {
    const calculated = calculatedByScope[game.id]
    const gamesPlayed = fieldNumber(
      nextGameFields[game.id]?.gamesJoined || '',
      calculatedField(calculated, 'gamesJoined'),
    )
    const accuracy = fieldNumber(
      nextGameFields[game.id]?.averageAccuracy || '',
      calculatedField(calculated, 'averageAccuracy'),
    )
    return {
      samples: summary.samples + Math.max(0, gamesPlayed),
      total: summary.total + Math.max(0, gamesPlayed) * accuracy,
    }
  }, { samples: 0, total: 0 })
  if (hasAccuracyOverride && weightedAccuracy.samples > 0) {
    linked.averageAccuracy = String(Number((weightedAccuracy.total / weightedAccuracy.samples).toFixed(2)))
  }

  const hasEscapeOverride = games.some(
    (game) => (nextGameFields[game.id]?.bestEscapeDurationSeconds || '').trim(),
  )
  const escapeDurations = games
    .filter((game) => game.category === 'Escape')
    .map((game) => fieldNumber(
      nextGameFields[game.id]?.bestEscapeDurationSeconds || '',
      calculatedField(calculatedByScope[game.id], 'bestEscapeDurationSeconds'),
    ))
    .filter((value) => value > 0)
  if (hasEscapeOverride && escapeDurations.length > 0) {
    linked.bestEscapeDurationSeconds = String(Math.min(...escapeDurations))
  }

  return linked
}

function StatField({
  label,
  min,
  onChange,
  placeholder,
  step,
  value,
}: {
  label: string
  min?: number
  onChange: (value: string) => void
  placeholder: string
  step?: number
  value: string
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        inputMode={step && step < 1 ? 'decimal' : 'numeric'}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step={step}
        type="number"
        value={value}
      />
    </label>
  )
}

export default function StaffPlayerStatsEditor({
  deferredSave = false,
  language,
  onDraftChange,
  onLoadingChange,
  onSaved,
  player,
}: StaffPlayerStatsEditorProps) {
  const text = language === 'vi' ? copy.vi : copy.en
  const [activeGameId, setActiveGameId] = useState<string>(games[0]?.id || '')
  const [calculatedByScope, setCalculatedByScope] = useState<Record<string, LeaderboardPlayer>>({
    overall: player,
  })
  const [overall, setOverall] = useState<StaffPlayerStatFields>(() => emptyFields())
  const [gameFields, setGameFields] = useState<Record<string, StaffPlayerStatFields>>({})
  const [loyaltyPoints, setLoyaltyPoints] = useState(String(player.loyaltyPoints ?? 0))
  const [baseline, setBaseline] = useState('')
  const [generalExpanded, setGeneralExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let active = true

    void (async () => {
      setIsLoading(true)
      onLoadingChange?.(true)
      setStatus('')

      try {
        const { supabase } = await import('../lib/supabase/client')
        const [overrideResult, overallResult, ...gameResults] = await Promise.all([
          supabase.rpc('staff_get_player_stat_overrides', {
            p_profile_id: player.profileId,
          }),
          supabase.rpc(
            'get_leaderboard_players_page_v2',
            leaderboardRpcArgs(
              initialLeaderboardQuery(),
              0,
              1,
              player.profileId,
            ),
          ),
          ...games.map((game) => supabase.rpc(
            'get_leaderboard_players_page_v2',
            leaderboardRpcArgs(
              { ...initialLeaderboardQuery(), gameId: game.id },
              0,
              1,
              player.profileId,
            ),
          )),
        ])

        if (overrideResult.error) throw overrideResult.error
        if (!active) return

        const payload = (overrideResult.data || {}) as OverridePayload
        const overrideRows = Array.isArray(payload.overrides) ? payload.overrides : []
        const overridesByScope = new Map(overrideRows.map((row) => [row.scope, row]))
        const overallRow = !overallResult?.error && Array.isArray(overallResult?.data)
          ? (overallResult.data as LeaderboardRpcRow[])[0]
          : null
        const nextCalculated: Record<string, LeaderboardPlayer> = {
          overall: overallRow
            ? leaderboardPlayerFromRpcRow(overallRow, player.displayName)
            : player,
        }
        const nextGameFields: Record<string, StaffPlayerStatFields> = {}

        games.forEach((game, index) => {
          const result = gameResults[index]
          const row = !result?.error && Array.isArray(result?.data)
            ? (result.data as LeaderboardRpcRow[])[0]
            : null
          if (row) nextCalculated[game.id] = leaderboardPlayerFromRpcRow(row, player.displayName)
          nextGameFields[game.id] = fieldsFromOverride(overridesByScope.get(game.id))
        })

        const loadedOverall = linkedOverallFields(
          fieldsFromOverride(overridesByScope.get('overall')),
          nextGameFields,
          nextCalculated,
          nextCalculated.overall,
        )
        setCalculatedByScope(nextCalculated)
        setOverall(loadedOverall)
        setGameFields(nextGameFields)
        const nextLoyaltyPoints = String(payload.loyaltyPoints ?? player.loyaltyPoints ?? 0)
        setLoyaltyPoints(nextLoyaltyPoints)
        setBaseline(JSON.stringify({
          gameFields: nextGameFields,
          loyaltyPoints: nextLoyaltyPoints,
          overall: loadedOverall,
        }))
      } catch (error) {
        if (active) setStatus(errorText(error))
      } finally {
        if (active) {
          setIsLoading(false)
          onLoadingChange?.(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [onLoadingChange, player])

  const activeGame = useMemo(
    () => games.find((game) => game.id === activeGameId) || games[0],
    [activeGameId],
  )
  const activeFields = gameFields[activeGame?.id || ''] || emptyFields()
  const activeCalculated = calculatedByScope[activeGame?.id || '']

  function patchOverall(field: keyof StaffPlayerStatFields, value: string) {
    setOverall((current) => ({ ...current, [field]: value }))
  }

  function patchActiveGame(field: keyof StaffPlayerStatFields, value: string) {
    if (!activeGame) return
    const nextGameFields = {
      ...gameFields,
      [activeGame.id]: {
        ...(gameFields[activeGame.id] || emptyFields()),
        [field]: value,
      },
    }
    setGameFields(nextGameFields)
    setOverall((current) => linkedOverallFields(
      current,
      nextGameFields,
      calculatedByScope,
      calculatedByScope.overall || player,
    ))
  }

  const draftState = useMemo(() => {
    if (isLoading) return { draft: null, dirty: false }
    try {
      const nextLoyaltyPoints = integerOrNull(loyaltyPoints)
      if (nextLoyaltyPoints === null || nextLoyaltyPoints < 0) return { draft: null, dirty: true }
      const draft: StaffPlayerStatsDraft = {
        loyaltyPoints: nextLoyaltyPoints,
        overall: fieldsPayload(overall),
        games: games.map((game) => fieldsPayload(gameFields[game.id] || emptyFields(), game.id)),
      }
      const current = JSON.stringify({ gameFields, loyaltyPoints, overall })
      return { draft, dirty: Boolean(baseline) && current !== baseline }
    } catch {
      return { draft: null, dirty: true }
    }
  }, [baseline, gameFields, isLoading, loyaltyPoints, overall])

  useEffect(() => {
    onDraftChange?.(draftState.draft, draftState.dirty)
  }, [draftState, onDraftChange])

  async function save() {
    if (isSaving) return
    setIsSaving(true)
    setStatus('')

    try {
      const nextLoyaltyPoints = integerOrNull(loyaltyPoints)
      if (nextLoyaltyPoints === null || nextLoyaltyPoints < 0) {
        throw new Error('Loyalty points must be zero or higher.')
      }

      const { supabase } = await import('../lib/supabase/client')
      const { error } = await supabase.rpc('staff_set_player_stat_overrides', {
        p_profile_id: player.profileId,
        p_loyalty_points: nextLoyaltyPoints,
        p_overall: fieldsPayload(overall),
        p_games: games.map((game) => fieldsPayload(
          gameFields[game.id] || emptyFields(),
          game.id,
        )),
      })

      if (error) throw error
      setStatus(text.saved)
      onSaved()
    } catch (error) {
      setStatus(errorText(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="staff-player-stats-editor">
      <div className="staff-player-stats-editor-head">
        <span aria-hidden="true"><ShieldCheck size={18} /></span>
        <div>
          <strong>{text.title}</strong>
        </div>
      </div>

      {isLoading ? (
        <p className="notice compact-notice">{text.loading}</p>
      ) : (
        <>
          <section>
            <button
              aria-expanded={generalExpanded}
              className="staff-player-stats-collapse"
              onClick={() => setGeneralExpanded((value) => !value)}
              type="button"
            >
              <span>{text.generalStats}</span>
              <ChevronDown aria-hidden="true" className={generalExpanded ? 'expanded' : ''} size={18} />
            </button>
            {generalExpanded && (
              <div className="staff-player-stats-grid">
                <StatField label={text.sessions} min={0} onChange={(value) => patchOverall('sessionsJoined', value)} placeholder={String(player.sessionsJoined)} value={overall.sessionsJoined} />
                <StatField label={text.games} min={0} onChange={(value) => patchOverall('gamesJoined', value)} placeholder={String(player.gamesJoined)} value={overall.gamesJoined} />
                <StatField label={text.wins} min={0} onChange={(value) => patchOverall('wins', value)} placeholder={String(player.wins)} value={overall.wins} />
                <StatField label={text.bestPerformer} min={0} onChange={(value) => patchOverall('bestPerformerCount', value)} placeholder={String(player.bestPerformerCount)} value={overall.bestPerformerCount} />
                <StatField label={text.totalScore} onChange={(value) => patchOverall('totalScore', value)} placeholder={String(player.totalScore)} value={overall.totalScore} />
                <StatField label={text.loyalty} min={0} onChange={setLoyaltyPoints} placeholder="0" value={loyaltyPoints} />
                <StatField label={text.accuracy} min={0} onChange={(value) => patchOverall('averageAccuracy', value)} placeholder={numberString(player.averageAccuracy)} step={0.01} value={overall.averageAccuracy} />
                <StatField label={text.hits} min={0} onChange={(value) => patchOverall('totalProjectiles', value)} placeholder={String(player.totalProjectiles)} value={overall.totalProjectiles} />
                <StatField label={text.movement} min={0} onChange={(value) => patchOverall('totalMovementMeters', value)} placeholder={numberString(player.totalMovementMeters)} step={0.01} value={overall.totalMovementMeters} />
                <StatField label={text.bestEscape} min={1} onChange={(value) => patchOverall('bestEscapeDurationSeconds', value)} placeholder={numberString(player.bestEscapeDurationSeconds)} value={overall.bestEscapeDurationSeconds} />
              </div>
            )}
          </section>

          <section>
            <div className="staff-player-stats-game-head">
              <h4>{text.gameStats}</h4>
              <select
                aria-label={text.gameStats}
                onChange={(event) => setActiveGameId(event.target.value)}
                value={activeGame?.id || ''}
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>{game.title}</option>
                ))}
              </select>
            </div>
            <div className="staff-player-stats-grid">
              <StatField label={text.sessions} min={0} onChange={(value) => patchActiveGame('sessionsJoined', value)} placeholder={numberString(activeCalculated?.sessionsJoined)} value={activeFields.sessionsJoined} />
              <StatField label={text.games} min={0} onChange={(value) => patchActiveGame('gamesJoined', value)} placeholder={numberString(activeCalculated?.gamesJoined)} value={activeFields.gamesJoined} />
              <StatField label={text.wins} min={0} onChange={(value) => patchActiveGame('wins', value)} placeholder={numberString(activeCalculated?.wins)} value={activeFields.wins} />
              <StatField label={text.bestPerformer} min={0} onChange={(value) => patchActiveGame('bestPerformerCount', value)} placeholder={numberString(activeCalculated?.bestPerformerCount)} value={activeFields.bestPerformerCount} />
              <StatField label={text.totalScore} onChange={(value) => patchActiveGame('totalScore', value)} placeholder={numberString(activeCalculated?.totalScore)} value={activeFields.totalScore} />
              <StatField label={text.bestScore} onChange={(value) => patchActiveGame('bestScore', value)} placeholder={numberString(activeCalculated?.bestByGame.find((score) => score.game === activeGame?.title)?.score)} value={activeFields.bestScore} />
              <StatField label={text.accuracy} min={0} onChange={(value) => patchActiveGame('averageAccuracy', value)} placeholder={numberString(activeCalculated?.averageAccuracy)} step={0.01} value={activeFields.averageAccuracy} />
              <StatField label={text.hits} min={0} onChange={(value) => patchActiveGame('totalProjectiles', value)} placeholder={numberString(activeCalculated?.totalProjectiles)} value={activeFields.totalProjectiles} />
              <StatField label={text.movement} min={0} onChange={(value) => patchActiveGame('totalMovementMeters', value)} placeholder={numberString(activeCalculated?.totalMovementMeters)} step={0.01} value={activeFields.totalMovementMeters} />
              {activeGame?.category === 'Escape' && (
                <StatField label={text.bestEscape} min={1} onChange={(value) => patchActiveGame('bestEscapeDurationSeconds', value)} placeholder={numberString(activeCalculated?.bestEscapeDurationSeconds)} value={activeFields.bestEscapeDurationSeconds} />
              )}
            </div>
          </section>

          {!deferredSave && <div className="staff-player-stats-actions">
            <button className={isSaving ? 'primary loading' : 'primary'} disabled={isSaving} onClick={save} type="button">
              <Save aria-hidden="true" size={15} />
              {text.save}
            </button>
            {status === text.saved && <span>{status}</span>}
          </div>}
        </>
      )}

      {!isLoading && status && !isSaving && status !== text.saved && (
        <p className="notice compact-notice">{status}</p>
      )}
    </div>
  )
}
