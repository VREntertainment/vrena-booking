'use client'

import type { LanguageCode } from '../lib/i18n'
import { isLanguageCode } from '../lib/i18n'

type GameAudience =
  | 'familyFriendly'
  | 'scary'
  | 'fun'
  | 'quest'
  | 'teamwork'
  | 'beginnerFriendly'
  | 'competitive'

export type GameGuideGame = {
  id: string
  title: string
  category: 'FPS / PVP' | 'Escape'
  image: string
  durationMinutes: number
  maxPlayersPerArena: number
  audience: GameAudience[]
}

type StaffGameGuideText = Partial<Record<LanguageCode, string>>

export type GameGuideStaffGuide = {
  slug: string
  guide_language?: string | null
  guide_summary?: StaffGameGuideText | null
  guide_rules?: StaffGameGuideText | null
  guide_tips?: StaffGameGuideText | null
}

type GameGuideModalProps = {
  closeText: string
  text: Record<string, string>
  language: LanguageCode
  games: GameGuideGame[]
  staffGameGuides: Partial<Record<string, GameGuideStaffGuide>>
  onClose: () => void
}

const gameAudienceLabelKeys: Record<GameAudience, string> = {
  familyFriendly: 'audienceFamilyFriendly',
  scary: 'audienceScary',
  fun: 'audienceFun',
  quest: 'audienceQuest',
  teamwork: 'audienceTeamwork',
  beginnerFriendly: 'audienceBeginnerFriendly',
  competitive: 'audienceCompetitive',
}

function guideTextItems(value: string) {
  return value
    .split(/\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizedGuideText(value: StaffGameGuideText | null | undefined, language: LanguageCode, fallbackLanguage: LanguageCode, fallback: string) {
  const directText = value?.[language]?.trim()
  if (directText) return directText

  const fallbackLanguageText = value?.[fallbackLanguage]?.trim()
  if (fallbackLanguageText) return fallbackLanguageText

  const englishText = value?.en?.trim()
  if (englishText) return englishText

  return fallback
}

export default function GameGuideModal({
  closeText,
  text,
  language,
  games,
  staffGameGuides,
  onClose,
}: GameGuideModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="game-guide-title" onClick={onClose}>
      <div className="login-modal game-guide-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label={closeText}>
          ×
        </button>
        <div className="game-guide-header">
          <h3 id="game-guide-title">{text.gameGuideTitle}</h3>
          <p>{text.gameGuideIntro}</p>
        </div>
        <div className="game-guide-scroll">
          {games.map((game) => {
            const isEscape = game.category === 'Escape'
            const isMiniBlockTowers = game.id === 'mini-block-towers'
            const staffGuide = staffGameGuides[game.id]
            const fallbackGuideLanguage = isLanguageCode(staffGuide?.guide_language) ? staffGuide.guide_language : 'en'
            const fallbackSummary = isMiniBlockTowers
              ? text.gameGuideBlockTowersSummary
              : isEscape
                ? text.gameGuideEscapeSummary
                : text.gameGuideFpsSummary
            const fallbackRules = isEscape
              ? ''
              : isMiniBlockTowers
                ? text.gameGuideBlockTowersRules
                : text.gameGuideFpsRules
            const fallbackTips = isMiniBlockTowers
              ? text.gameGuideBlockTowersTips
              : isEscape
                ? text.gameGuideEscapeTips
                : text.gameGuideFpsTips
            const summary = normalizedGuideText(staffGuide?.guide_summary, language, fallbackGuideLanguage, fallbackSummary)
            const tips = guideTextItems(normalizedGuideText(staffGuide?.guide_tips, language, fallbackGuideLanguage, fallbackTips))
            const ruleItems = guideTextItems(normalizedGuideText(staffGuide?.guide_rules, language, fallbackGuideLanguage, fallbackRules))

            return (
              <article className="game-guide-card" key={game.id}>
                <img src={game.image} alt="" loading="lazy" decoding="async" />
                <div className="game-guide-card-body">
                  <div className="game-guide-card-head">
                    <div>
                      <h4>{game.title}</h4>
                      <span>{game.category}</span>
                    </div>
                    <div className="game-guide-facts">
                      <span>{text.gameGuideDuration}: <strong>{game.durationMinutes} min</strong></span>
                      <span>{text.gameGuidePlayers}: <strong>{game.maxPlayersPerArena} / {text.arena}</strong></span>
                    </div>
                  </div>
                  <p>{summary}</p>
                  <div className="game-guide-audience" aria-label={text.gameGuideAudience}>
                    {game.audience.map((audience) => (
                      <span key={audience}>{text[gameAudienceLabelKeys[audience]]}</span>
                    ))}
                  </div>
                  {ruleItems.length > 0 && (
                    <details className="game-guide-panel">
                      <summary>{text.gameGuideRules}</summary>
                      <ul>
                        {ruleItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {tips.length > 0 && (
                    <details className="game-guide-panel">
                      <summary>{text.gameGuideTips}</summary>
                      <ul>
                        {tips.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
