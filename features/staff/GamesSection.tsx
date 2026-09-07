'use client'

import {
  Save
} from 'lucide-react'
import { languageOptions } from '../../lib/i18n/languages'
import {
  guideTextValue,
  normalizeGuideLanguage,
  staffAudienceLabel
} from '../../lib/staff/catalog'
import type { StaffConsoleCopy } from '../../lib/staff/copy'
import {
  gameTypes,
  staffArenaOptions,
  staffAudienceOptions,
  staffGameImageTypes
} from '../../lib/staff/options'
import type {
  StaffGame
} from '../../lib/staff/types'
import { ButtonIconText } from './shared'

export type GamesSectionProps = {
  gameForm: { id: string; slug: string; name: string; game_type: "other" | "shooting" | "escape" | "tournament"; duration_minutes: number; max_players_per_arena: number; number_of_rounds: number; escape_chapter_count: number; description: string; audience: import("../../lib/staff/types").StaffAudience[]; guide_language: import("../../lib/i18n/languages").LanguageCode; guide_summary: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; guide_rules: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; guide_tips: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; image_url: string; active: boolean; available_arena_ids: string }
  text: StaffConsoleCopy
  canManageConfig: boolean
  setGameForm: React.Dispatch<React.SetStateAction<{ id: string; slug: string; name: string; game_type: "other" | "shooting" | "escape" | "tournament"; duration_minutes: number; max_players_per_arena: number; number_of_rounds: number; escape_chapter_count: number; description: string; audience: import("../../lib/staff/types").StaffAudience[]; guide_language: import("../../lib/i18n/languages").LanguageCode; guide_summary: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; guide_rules: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; guide_tips: Partial<Record<import("../../lib/i18n/languages").LanguageCode, string>>; image_url: string; active: boolean; available_arena_ids: string }>>
  gameImageUploading: boolean
  handleGameImageUpload: (event: React.ChangeEvent<HTMLInputElement, Element>) => Promise<void>
  selectedGameAudiences: import("../../lib/staff/types").StaffAudience[]
  updateGameAudience: (audience: import("../../lib/staff/types").StaffAudience, checked: boolean) => void
  selectedGameArenaIds: string[]
  updateGameArena: (arenaId: string, checked: boolean) => void
  updateGameGuideText: (field: "guide_summary" | "guide_rules" | "guide_tips", value: string) => void
  saving: boolean
  saveGame: () => Promise<void>
  startNewGame: () => void
  games: import("../../lib/staff/types").StaffGame[]
  editGame: (game: import("../../lib/staff/types").StaffGame) => void
}

export default function GamesSection({
  gameForm,
  text,
  canManageConfig,
  setGameForm,
  gameImageUploading,
  handleGameImageUpload,
  selectedGameAudiences,
  updateGameAudience,
  selectedGameArenaIds,
  updateGameArena,
  updateGameGuideText,
  saving,
  saveGame,
  startNewGame,
  games,
  editGame,
}: GamesSectionProps) {
  return (
    <div className="staff-grid">
      <div className="staff-card">
        <h3>{gameForm.id ? text.editGame : text.labels.createGame}</h3>
        {!canManageConfig && <p className="staff-readonly-note">{text.messages.readOnlyGames}</p>}
        <fieldset className="staff-readonly-fieldset" disabled={!canManageConfig}>
          <div className="form-grid compact-form-grid">
            <label>{text.labels.name}<input value={gameForm.name} onChange={(event) => setGameForm({ ...gameForm, name: event.target.value })} /></label>
            <label>{text.labels.slug}<input value={gameForm.slug} onChange={(event) => setGameForm({ ...gameForm, slug: event.target.value })} /></label>
            <label>{text.labels.type}<select value={gameForm.game_type} onChange={(event) => setGameForm({ ...gameForm, game_type: event.target.value as StaffGame['game_type'] })}>{gameTypes.map((type) => <option key={type} value={type}>{text.gameTypes[type]}</option>)}</select></label>
            <label>{text.labels.duration}<input type="number" value={gameForm.duration_minutes} onChange={(event) => setGameForm({ ...gameForm, duration_minutes: Number(event.target.value) })} /></label>
            <label>{text.labels.maxPlayersArena}<input type="number" value={gameForm.max_players_per_arena} onChange={(event) => setGameForm({ ...gameForm, max_players_per_arena: Number(event.target.value) })} /></label>
            <label>{text.labels.rounds}<input type="number" value={gameForm.number_of_rounds} onChange={(event) => setGameForm({ ...gameForm, number_of_rounds: Number(event.target.value) })} /></label>
            {gameForm.game_type === 'escape' && (
              <label>{text.labels.escapeChapters}<input min={1} max={50} type="number" value={gameForm.escape_chapter_count} onChange={(event) => setGameForm({ ...gameForm, escape_chapter_count: Number(event.target.value) })} /></label>
            )}
            <div className="full staff-game-media-row">
              <div className="staff-game-photo-field">
                <span className="staff-field-label">{text.labels.gamePhoto}</span>
                <label className={gameForm.image_url ? 'staff-game-photo-upload has-image' : 'staff-game-photo-upload'}>
                  {gameForm.image_url ? (
                    <span
                      aria-hidden="true"
                      className="staff-game-photo-preview"
                      style={{ backgroundImage: `url(${gameForm.image_url})` }}
                    />
                  ) : (
                    <span>
                      <strong>{text.messages.clickUploadGamePhoto}</strong>
                      <small>{text.gamePhotoHelp}</small>
                    </span>
                  )}
                  {gameImageUploading && <em>{text.messages.uploadGamePhoto}</em>}
                  <input
                    accept={staffGameImageTypes.join(',')}
                    disabled={gameImageUploading}
                    type="file"
                    onChange={handleGameImageUpload}
                  />
                </label>
              </div>
              <div className="staff-game-settings-panel">
                <div>
                  <span className="staff-field-label">{text.labels.audience}</span>
                  <details className="staff-audience-menu">
                    <summary className="staff-audience-summary">
                      <span className="staff-audience-value">
                        {selectedGameAudiences.length ? (
                          selectedGameAudiences.map((audience) => (
                            <span className="staff-audience-chip" key={audience}>{text.audienceOptions[audience]}</span>
                          ))
                        ) : (
                          <span className="staff-audience-placeholder">{text.any}</span>
                        )}
                      </span>
                    </summary>
                    <div className="staff-audience-dropdown">
                      {staffAudienceOptions.map((audience) => {
                        const checked = selectedGameAudiences.includes(audience)
                        return (
                          <label className="staff-audience-option" key={audience}>
                            <input
                              checked={checked}
                              type="checkbox"
                              onChange={(event) => updateGameAudience(audience, event.target.checked)}
                            />
                            <span>{text.audienceOptions[audience]}</span>
                          </label>
                        )
                      })}
                    </div>
                  </details>
                </div>
                <div>
                  <span className="staff-field-label">{text.labels.arenaIds}</span>
                  <div className="staff-arena-options">
                    {staffArenaOptions.map((arena) => {
                      const checked = selectedGameArenaIds.includes(arena.id)
                      return (
                        <label className="staff-arena-option" key={arena.id}>
                          <input
                            checked={checked}
                            disabled={checked && selectedGameArenaIds.length <= 1}
                            type="checkbox"
                            onChange={(event) => updateGameArena(arena.id, event.target.checked)}
                          />
                          <span>{arena.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <label className="checkbox-row staff-game-active-toggle">
                  <input type="checkbox" checked={gameForm.active} onChange={(event) => setGameForm({ ...gameForm, active: event.target.checked })} />
                  <span>{text.labels.active}</span>
                </label>
              </div>
            </div>
            <div className="full staff-game-guide-editor">
              <div className="staff-game-guide-head">
                <div>
                  <span className="staff-field-label">{text.labels.guideSummary}</span>
                  <small>{text.messages.gameGuideHelp}</small>
                </div>
                <label>
                  <span>{text.labels.guideLanguage}</span>
                  <select
                    value={gameForm.guide_language}
                    onChange={(event) => setGameForm({ ...gameForm, guide_language: normalizeGuideLanguage(event.target.value) })}
                  >
                    {languageOptions.map((language) => (
                      <option key={language} value={language}>{language.toUpperCase()}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="staff-game-guide-fields">
                <label>
                  <span>{text.labels.guideSummary}</span>
                  <textarea
                    value={guideTextValue(gameForm.guide_summary, gameForm.guide_language)}
                    onChange={(event) => updateGameGuideText('guide_summary', event.target.value)}
                  />
                </label>
                <label>
                  <span>{text.labels.guideGameplay}</span>
                  <textarea
                    value={guideTextValue(gameForm.guide_rules, gameForm.guide_language)}
                    onChange={(event) => updateGameGuideText('guide_rules', event.target.value)}
                  />
                </label>
                <label>
                  <span>{text.labels.guideTips}</span>
                  <textarea
                    value={guideTextValue(gameForm.guide_tips, gameForm.guide_language)}
                    onChange={(event) => updateGameGuideText('guide_tips', event.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>
          <button className="primary" type="button" disabled={saving || !gameForm.name.trim()} onClick={saveGame}>
            <ButtonIconText icon={<Save aria-hidden="true" size={15} />}>{text.actions.saveGame}</ButtonIconText>
          </button>
        </fieldset>
      </div>
      <div className="staff-card">
        <div className="staff-list-head">
          <h3>{text.labels.games}</h3>
          {canManageConfig && <button type="button" onClick={startNewGame}>{text.actions.newGame}</button>}
        </div>
        {games.map((game) => (
          <button className="staff-list-item" key={game.id} type="button" onClick={() => editGame(game)}>
            <strong>{game.name}</strong>
            <span>
              {[
                text.gameTypes[game.game_type],
                `${game.duration_minutes} min`,
                staffAudienceLabel(game.audience, game.difficulty, text),
                game.active ? text.active : text.inactive,
              ].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
