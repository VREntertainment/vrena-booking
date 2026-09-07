'use client'

import {
  ShortDateInput
} from '../../components/BookingWidgetSurfaces'
import {
  games,
  type GameId
} from '../../lib/bookingStaticData'
import {
  formatShortDate,
  isChallengeSession
} from '../../lib/bookingWidgetDomain'
import { type TranslationMap } from '../../lib/i18n/loadTranslation'
export type ChallengeTarget = { profileId: string }

export type ChallengeControlsProps = {
  userId: string
  challengeTargetId: string
  sessionInvites: import("../../lib/bookingWidgetDomain").SessionInvite[]
  sessionForInvite: (invite: import("../../lib/bookingWidgetDomain").SessionInvite) => import("../../lib/bookingWidgetDomain").Session | undefined
  openChallengeForm: (player: ChallengeTarget) => void
  text: TranslationMap
  challengeGameId: import("../../lib/bookingStaticData").GameId
  setChallengeTargetId: React.Dispatch<React.SetStateAction<string>>
  setChallengeGameId: React.Dispatch<React.SetStateAction<import("../../lib/bookingStaticData").GameId>>
  language: import("../../lib/i18n/languages").LanguageCode
  setChallengeDate: React.Dispatch<React.SetStateAction<string>>
  setChallengeTime: React.Dispatch<React.SetStateAction<string>>
  challengeDate: string
  challengeTime: string
  challengeTimeOptions: import("../../lib/booking/availability").BookingTimeOption[]
  challengeDuration: number
  setChallengeDuration: React.Dispatch<React.SetStateAction<number>>
  isCreatingChallenge: boolean
  createFriendChallenge: (player: ChallengeTarget) => Promise<void>
  challengeStatus: string
  player: ChallengeTarget
}

export default function ChallengeControls({
  userId,
  challengeTargetId,
  sessionInvites,
  sessionForInvite,
  openChallengeForm,
  text,
  challengeGameId,
  setChallengeTargetId,
  setChallengeGameId,
  language,
  setChallengeDate,
  setChallengeTime,
  challengeDate,
  challengeTime,
  challengeTimeOptions,
  challengeDuration,
  setChallengeDuration,
  isCreatingChallenge,
  createFriendChallenge,
  challengeStatus,
  player,
}: ChallengeControlsProps) {
  if (player.profileId === userId) return null

  const isOpen = challengeTargetId === player.profileId
  const sentChallenge = sessionInvites.find((invite) => {
    const invitedSession = sessionForInvite(invite)
    return invite.inviter_id === userId
      && invite.recipient_id === player.profileId
      && invite.status === 'pending'
      && invitedSession
      && isChallengeSession(invitedSession)
  })

  if (!isOpen) {
    return (
      <div className="challenge-card compact-challenge-card">
        <button className="primary small-button challenge-button" type="button" onClick={() => openChallengeForm(player)}>
          {text.challengeFriend}
        </button>
        {sentChallenge && <span className="challenge-sent-pill">{text.challengePending}</span>}
      </div>
    )
  }

  const selectedGame = games.find((game) => game.id === challengeGameId) || games[0]

  return (
    <div className="challenge-card">
      <div className="challenge-card-head">
        <div>
          <strong>{text.challengeFriendTitle}</strong>
          <span>{text.challengeFriendHint}</span>
        </div>
        <button className="secondary small-button" type="button" onClick={() => setChallengeTargetId('')}>
          {text.close}
        </button>
      </div>
      <div className="challenge-form-grid">
        <label>
          <span>{text.playedGame}</span>
          <select value={challengeGameId} onChange={(event) => setChallengeGameId(event.target.value as GameId)}>
            {games.map((game) => (
              <option key={game.id} value={game.id}>{game.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{text.date}</span>
          <ShortDateInput
            ariaLabel={text.date}
            language={language}
            onChange={(value) => {
              setChallengeDate(value)
              setChallengeTime('')
            }}
            placeholder={text.chooseDate}
            value={challengeDate}
          />
        </label>
        <label>
          <span>{text.availableTime}</span>
          <select value={challengeTime} onChange={(event) => setChallengeTime(event.target.value)}>
            <option value="">{text.chooseTime}</option>
            {challengeTimeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{text.duration}</span>
          <select value={challengeDuration} onChange={(event) => {
            setChallengeDuration(Number(event.target.value))
            setChallengeTime('')
          }}>
            {[20, 40, 60, 80, 100, 120].map((duration) => (
              <option key={duration} value={duration}>{duration} min</option>
            ))}
          </select>
        </label>
      </div>
      <p className="challenge-summary">
        {selectedGame.title} · {challengeDate ? formatShortDate(challengeDate, language) : text.chooseDate}
        {challengeTime ? ` · ${challengeTime}` : ''}
      </p>
      <button
        className={isCreatingChallenge ? 'primary create-button loading' : 'primary create-button'}
        disabled={isCreatingChallenge}
        type="button"
        onClick={() => createFriendChallenge(player)}
      >
        {isCreatingChallenge ? text.challengeCreating : text.sendChallenge}
      </button>
      {challengeStatus && <p className="notice compact-notice">{challengeStatus}</p>}
    </div>
  )
}
