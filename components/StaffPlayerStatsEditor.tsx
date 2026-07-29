'use client'

import { Save, ShieldCheck } from 'lucide-react'
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

type StatFields = {
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

type StoredOverride = Partial<Record<keyof StatFields, number>> & {
  scope: string
}

type OverridePayload = {
  profileId?: string
  loyaltyPoints?: number
  overrides?: StoredOverride[]
}

type StaffPlayerStatsEditorProps = {
  language: LanguageCode
  onSaved: () => void
  player: LeaderboardPlayer
}

const emptyFields = (): StatFields => ({
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
    automaticHint: 'Leave a field empty to keep its automatically calculated value.',
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
    automaticHint: 'Để trống một trường để tiếp tục dùng giá trị được tính tự động.',
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

function fieldsFromOverride(value?: StoredOverride): StatFields {
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

function fieldsPayload(fields: StatFields, scope?: string) {
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
  language,
  onSaved,
  player,
}: StaffPlayerStatsEditorProps) {
  const text = language === 'vi' ? copy.vi : copy.en
  const [activeGameId, setActiveGameId] = useState<string>(games[0]?.id || '')
  const [calculatedByScope, setCalculatedByScope] = useState<Record<string, LeaderboardPlayer>>({
    overall: player,
  })
  const [overall, setOverall] = useState<StatFields>(() => emptyFields())
  const [gameFields, setGameFields] = useState<Record<string, StatFields>>({})
  const [loyaltyPoints, setLoyaltyPoints] = useState(String(player.loyaltyPoints ?? 0))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let active = true

    void (async () => {
      setIsLoading(true)
      setStatus('')

      try {
        const { supabase } = await import('../lib/supabase/client')
        const [overrideResult, ...gameResults] = await Promise.all([
          supabase.rpc('staff_get_player_stat_overrides', {
            p_profile_id: player.profileId,
          }),
          ...games.map((game) => supabase.rpc(
            'get_leaderboard_players_page_v3',
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
        const nextCalculated: Record<string, LeaderboardPlayer> = { overall: player }
        const nextGameFields: Record<string, StatFields> = {}

        games.forEach((game, index) => {
          const result = gameResults[index]
          const row = !result?.error && Array.isArray(result?.data)
            ? (result.data as LeaderboardRpcRow[])[0]
            : null
          if (row) nextCalculated[game.id] = leaderboardPlayerFromRpcRow(row, player.displayName)
          nextGameFields[game.id] = fieldsFromOverride(overridesByScope.get(game.id))
        })

        setCalculatedByScope(nextCalculated)
        setOverall(fieldsFromOverride(overridesByScope.get('overall')))
        setGameFields(nextGameFields)
        setLoyaltyPoints(String(payload.loyaltyPoints ?? player.loyaltyPoints ?? 0))
      } catch (error) {
        if (active) setStatus(errorText(error))
      } finally {
        if (active) setIsLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [player])

  const activeGame = useMemo(
    () => games.find((game) => game.id === activeGameId) || games[0],
    [activeGameId],
  )
  const activeFields = gameFields[activeGame?.id || ''] || emptyFields()
  const activeCalculated = calculatedByScope[activeGame?.id || '']

  function patchOverall(field: keyof StatFields, value: string) {
    setOverall((current) => ({ ...current, [field]: value }))
  }

  function patchActiveGame(field: keyof StatFields, value: string) {
    if (!activeGame) return
    setGameFields((current) => ({
      ...current,
      [activeGame.id]: {
        ...(current[activeGame.id] || emptyFields()),
        [field]: value,
      },
    }))
  }

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
          <small>{text.automaticHint}</small>
        </div>
      </div>

      {isLoading ? (
        <p className="notice compact-notice">{text.loading}</p>
      ) : (
        <>
          <section>
            <h4>{text.generalStats}</h4>
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

          <div className="staff-player-stats-actions">
            <button className={isSaving ? 'primary loading' : 'primary'} disabled={isSaving} onClick={save} type="button">
              <Save aria-hidden="true" size={15} />
              {text.save}
            </button>
            {status === text.saved && <span>{status}</span>}
          </div>
        </>
      )}

      {!isLoading && status && !isSaving && status !== text.saved && (
        <p className="notice compact-notice">{status}</p>
      )}
    </div>
  )
}
