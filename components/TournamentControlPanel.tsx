import type { ReactNode } from 'react'
import type { TranslationMap } from '../lib/i18n/loadTranslation'

type TournamentControlPanelProps = {
  children: ReactNode
  canEdit: boolean
  isBusy: boolean
  onAdvanceRound: () => void
  onCreateThirdPlaceMatch: () => void
  onFinishTournament: () => void
  onGenerateMatches: () => void
  onPoolSizeChange: (size: number) => void
  onSetupPools: () => void
  poolSize: number
  roleHint: string
  summary: string
  text: TranslationMap
}

export default function TournamentControlPanel({
  children,
  canEdit,
  isBusy,
  onAdvanceRound,
  onCreateThirdPlaceMatch,
  onFinishTournament,
  onGenerateMatches,
  onPoolSizeChange,
  onSetupPools,
  poolSize,
  roleHint,
  summary,
  text,
}: TournamentControlPanelProps) {
  return (
    <div className="tournament-desk">
      <div className="section-head compact-head">
        <div>
          <h3>{text.tournamentDesk}</h3>
          <p className="muted">{summary}</p>
        </div>
        {canEdit && (
          <div className="manage-row">
            <label className="mini-field">
              {text.poolSize}
              <select value={poolSize} onChange={(event) => onPoolSizeChange(Number(event.target.value))}>
                {[2, 3, 4, 5, 6].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button className="secondary small-button" disabled={isBusy} type="button" onClick={onSetupPools}>
              {text.tournamentRandomSetup}
            </button>
            <button className="secondary small-button" disabled={isBusy} type="button" onClick={onGenerateMatches}>
              {text.tournamentGenerateMatches}
            </button>
            <button className="primary small-button" disabled={isBusy} type="button" onClick={onAdvanceRound}>
              {text.tournamentNextRound}
            </button>
            <button className="secondary small-button" disabled={isBusy} type="button" onClick={onCreateThirdPlaceMatch}>
              {text.bronzeMatch}
            </button>
            <button className="danger small-button" disabled={isBusy} type="button" onClick={onFinishTournament}>
              {text.finishTournament}
            </button>
          </div>
        )}
      </div>
      <p className={canEdit ? 'notice tournament-role-notice manager' : 'notice tournament-role-notice'}>
        {roleHint}
      </p>

      {children}
    </div>
  )
}
