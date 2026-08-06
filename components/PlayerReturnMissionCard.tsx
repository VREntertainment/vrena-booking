'use client'

import NextImage from 'next/image'
import { BellRing, CalendarCheck2, Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { LanguageCode } from '../lib/i18n/languages'
import { playerReturnGraceState, type PlayerReturnMission } from '../lib/playerReturnMission'
import type { PlayerReturnVisual } from '../lib/playerReturnVisual'
import { supabase } from '../lib/supabase/client'

type ScheduleReminderResult = {
  message?: string
  ok: boolean
  scheduledFor?: string
}

type PlayerReturnMissionCardProps = {
  gameTitle: string
  language: LanguageCode
  mission: PlayerReturnMission
  onJoinSession: () => void
  onScheduleReminder: () => Promise<ScheduleReminderResult>
  userId: string
  visual: PlayerReturnVisual
}

type ReturnMissionCopy = {
  activeRun: string
  arenaRegular: string
  characterAlt: string
  findFirstSession: string
  graceAvailable: string
  graceProtecting: string
  graceRecovered: string
  fromCollection: string
  fromTricksterDeck: string
  keepMoving: string
  keepRunGoing: string
  planNextWeek: string
  reminderError: string
  remindFirstWeekend: string
  reminderSet: string
  remindWeekend: string
  runSaved: string
  startBody: string
  startSafe: string
  startTitle: string
  streakBuilder: string
  weekFour: string
  weekOne: string
  weekThree: string
  weekTwo: string
  weeks: string
}

const returnMissionCopy: Record<LanguageCode, ReturnMissionCopy> = {
  en: {
    activeRun: 'Your Arena Regular run is active.',
    arenaRegular: 'Keep your run going to unlock Arena Regular.',
    characterAlt: 'Wild West cowboy',
    findFirstSession: 'Find my first session',
    graceAvailable: 'One grace week is available if you miss a week.',
    graceProtecting: 'Grace is protecting your run. Play this week to continue.',
    graceRecovered: 'Grace used. Your progress stayed safe.',
    fromCollection: 'From your collection',
    fromTricksterDeck: "Trickster's Deck",
    keepMoving: 'One visit this week keeps your run moving.',
    keepRunGoing: 'Keep my run going',
    planNextWeek: 'Plan next week',
    reminderError: 'Could not set the reminder. Try again.',
    remindFirstWeekend: 'Remind me this weekend',
    reminderSet: 'Reminder set for {date}',
    remindWeekend: 'Remind me next weekend',
    runSaved: '{game} run saved',
    startBody: 'Check in to your first session to begin your weekly path.',
    startSafe: 'Your run starts after your first checked-in visit.',
    startTitle: 'Start your VRena run',
    streakBuilder: 'Come back next week to unlock Streak Builder.',
    weekFour: 'Week 4',
    weekOne: 'Week 1',
    weekThree: 'Week 3',
    weekTwo: 'Week 2',
    weeks: '{current} of {target} weeks',
  },
  vi: {
    activeRun: 'Chuỗi Khách quen đấu trường đang hoạt động.',
    arenaRegular: 'Duy trì chuỗi để mở khóa Khách quen đấu trường.',
    characterAlt: 'Cao bồi Wild West',
    findFirstSession: 'Tìm phiên đầu tiên',
    graceAvailable: 'Bạn có một tuần nghỉ dự phòng nếu bỏ lỡ một tuần.',
    graceProtecting: 'Tuần nghỉ đang bảo vệ chuỗi. Hãy chơi trong tuần này để tiếp tục.',
    graceRecovered: 'Đã dùng tuần nghỉ. Tiến trình của bạn vẫn an toàn.',
    fromCollection: 'Từ bộ sưu tập của bạn',
    fromTricksterDeck: 'Bộ bài Trickster',
    keepMoving: 'Một lượt chơi tuần này sẽ giữ chuỗi của bạn.',
    keepRunGoing: 'Tiếp tục chuỗi',
    planNextWeek: 'Lên kế hoạch tuần tới',
    reminderError: 'Không thể đặt lời nhắc. Vui lòng thử lại.',
    remindFirstWeekend: 'Nhắc tôi cuối tuần này',
    reminderSet: 'Đã nhắc vào {date}',
    remindWeekend: 'Nhắc tôi cuối tuần tới',
    runSaved: 'Đã lưu lượt {game}',
    startBody: 'Check-in phiên đầu tiên để bắt đầu hành trình hàng tuần.',
    startSafe: 'Chuỗi bắt đầu sau lượt check-in đầu tiên.',
    startTitle: 'Bắt đầu hành trình VRena',
    streakBuilder: 'Quay lại tuần tới để mở khóa Chuỗi bền bỉ.',
    weekFour: 'Tuần 4',
    weekOne: 'Tuần 1',
    weekThree: 'Tuần 3',
    weekTwo: 'Tuần 2',
    weeks: '{current}/{target} tuần',
  },
  ko: {
    activeRun: '아레나 단골 연속 기록이 진행 중입니다.', arenaRegular: '연속 기록을 이어 아레나 단골을 잠금 해제하세요.', characterAlt: 'VRena 게임 캐릭터', findFirstSession: '첫 세션 찾기', fromCollection: '내 컬렉션', fromTricksterDeck: '트릭스터 덱', graceAvailable: '한 주를 놓치면 한 번의 휴식 주를 사용할 수 있습니다.', graceProtecting: '휴식 주가 기록을 보호하고 있습니다. 이번 주에 플레이해 계속하세요.', graceRecovered: '휴식 주를 사용했습니다. 진행 상황은 안전합니다.', keepMoving: '이번 주 한 번 방문하면 기록이 이어집니다.', keepRunGoing: '연속 기록 이어가기', planNextWeek: '다음 주 계획', reminderError: '알림을 설정하지 못했습니다. 다시 시도하세요.', remindFirstWeekend: '이번 주말에 알림', reminderSet: '{date} 알림 설정됨', remindWeekend: '다음 주말에 알림', runSaved: '{game} 기록 저장됨', startBody: '첫 세션에 체크인하고 주간 여정을 시작하세요.', startSafe: '첫 체크인 방문 후 기록이 시작됩니다.', startTitle: 'VRena 여정 시작', streakBuilder: '다음 주에 돌아와 연속 플레이를 잠금 해제하세요.', weekFour: '4주 차', weekOne: '1주 차', weekThree: '3주 차', weekTwo: '2주 차', weeks: '{current}/{target}주',
  },
  ja: {
    activeRun: 'アリーナ常連へのランが進行中です。', arenaRegular: 'ランを続けてアリーナ常連を解除しよう。', characterAlt: 'VRenaゲームキャラクター', findFirstSession: '最初のセッションを探す', fromCollection: 'コレクションから', fromTricksterDeck: 'トリックスター・デッキ', graceAvailable: '1週逃しても使えるお休み週があります。', graceProtecting: 'お休み週がランを守っています。今週プレイして続けよう。', graceRecovered: 'お休み週を使用しました。進捗は守られました。', keepMoving: '今週あと1回来店するとランを維持できます。', keepRunGoing: 'ランを続ける', planNextWeek: '来週を計画', reminderError: 'リマインダーを設定できませんでした。', remindFirstWeekend: '今週末に通知', reminderSet: '{date}に通知します', remindWeekend: '次の週末に通知', runSaved: '{game}の記録を保存しました', startBody: '最初のセッションにチェックインして週間ランを始めよう。', startSafe: '最初のチェックイン後にランが始まります。', startTitle: 'VRenaランを始める', streakBuilder: '来週戻って連続プレイを解除しよう。', weekFour: '4週目', weekOne: '1週目', weekThree: '3週目', weekTwo: '2週目', weeks: '{current}/{target}週',
  },
  fr: {
    activeRun: 'Ta série Habitué de l’arène est active.', arenaRegular: 'Continue pour débloquer Habitué de l’arène.', characterAlt: 'Personnage de jeu VRena', findFirstSession: 'Trouver ma première session', fromCollection: 'Depuis ta collection', fromTricksterDeck: 'Le deck du Trickster', graceAvailable: 'Une semaine joker est disponible si tu manques une semaine.', graceProtecting: 'Le joker protège ta série. Joue cette semaine pour continuer.', graceRecovered: 'Joker utilisé. Ta progression est restée intacte.', keepMoving: 'Une visite cette semaine maintient ta série.', keepRunGoing: 'Continuer ma série', planNextWeek: 'Planifier la semaine prochaine', reminderError: 'Impossible de programmer le rappel. Réessaie.', remindFirstWeekend: 'Me rappeler ce week-end', reminderSet: 'Rappel prévu le {date}', remindWeekend: 'Me rappeler le week-end prochain', runSaved: 'Partie {game} enregistrée', startBody: 'Valide ta première session pour lancer ton parcours hebdomadaire.', startSafe: 'Ta série commence après ta première visite validée.', startTitle: 'Commence ton parcours VRena', streakBuilder: 'Reviens la semaine prochaine pour débloquer Série en cours.', weekFour: 'Semaine 4', weekOne: 'Semaine 1', weekThree: 'Semaine 3', weekTwo: 'Semaine 2', weeks: '{current} sur {target} semaines',
  },
  de: {
    activeRun: 'Deine Arena-Stammgast-Serie läuft.', arenaRegular: 'Bleib dran und schalte Arena-Stammgast frei.', characterAlt: 'VRena-Spielfigur', findFirstSession: 'Erste Session finden', fromCollection: 'Aus deiner Sammlung', fromTricksterDeck: 'Das Trickster-Deck', graceAvailable: 'Eine Pausenwoche ist verfügbar, falls du eine Woche verpasst.', graceProtecting: 'Die Pausenwoche schützt deine Serie. Spiele diese Woche weiter.', graceRecovered: 'Pausenwoche genutzt. Dein Fortschritt blieb erhalten.', keepMoving: 'Ein Besuch diese Woche hält deine Serie am Laufen.', keepRunGoing: 'Serie fortsetzen', planNextWeek: 'Nächste Woche planen', reminderError: 'Erinnerung konnte nicht gesetzt werden.', remindFirstWeekend: 'Dieses Wochenende erinnern', reminderSet: 'Erinnerung für {date}', remindWeekend: 'Nächstes Wochenende erinnern', runSaved: '{game}-Runde gespeichert', startBody: 'Checke in deine erste Session ein und starte deinen Wochenpfad.', startSafe: 'Deine Serie beginnt nach deinem ersten Check-in.', startTitle: 'Starte deinen VRena-Lauf', streakBuilder: 'Komm nächste Woche zurück und schalte Serienmacher frei.', weekFour: 'Woche 4', weekOne: 'Woche 1', weekThree: 'Woche 3', weekTwo: 'Woche 2', weeks: '{current} von {target} Wochen',
  },
  it: {
    activeRun: 'La tua serie Abituale dell’arena è attiva.', arenaRegular: 'Continua per sbloccare Abituale dell’arena.', characterAlt: 'Personaggio di gioco VRena', findFirstSession: 'Trova la prima sessione', fromCollection: 'Dalla tua collezione', fromTricksterDeck: 'Il mazzo del Trickster', graceAvailable: 'Hai una settimana jolly se salti una settimana.', graceProtecting: 'La settimana jolly protegge la serie. Gioca questa settimana per continuare.', graceRecovered: 'Settimana jolly usata. I tuoi progressi sono rimasti al sicuro.', keepMoving: 'Una visita questa settimana mantiene attiva la serie.', keepRunGoing: 'Continua la serie', planNextWeek: 'Pianifica la prossima settimana', reminderError: 'Impossibile impostare il promemoria. Riprova.', remindFirstWeekend: 'Ricordamelo questo weekend', reminderSet: 'Promemoria per {date}', remindWeekend: 'Ricordamelo il prossimo weekend', runSaved: 'Partita {game} salvata', startBody: 'Fai check-in alla prima sessione per iniziare il percorso settimanale.', startSafe: 'La serie inizia dopo la prima visita con check-in.', startTitle: 'Inizia il percorso VRena', streakBuilder: 'Torna la prossima settimana per sbloccare Serie in crescita.', weekFour: 'Settimana 4', weekOne: 'Settimana 1', weekThree: 'Settimana 3', weekTwo: 'Settimana 2', weeks: '{current} di {target} settimane',
  },
}

function formatReminderDate(value: string, language: LanguageCode) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

export default function PlayerReturnMissionCard({
  gameTitle,
  language,
  mission,
  onJoinSession,
  onScheduleReminder,
  userId,
  visual,
}: PlayerReturnMissionCardProps) {
  const copy = returnMissionCopy[language] ?? returnMissionCopy.en
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')
  const [status, setStatus] = useState('')
  const hasStarted = Boolean(mission.latestSession)
  const current = Math.min(mission.activeWeeks, 4)
  const graceState = playerReturnGraceState(mission)
  const missionTitle = hasStarted
    ? copy.runSaved.replace('{game}', gameTitle)
    : copy.startTitle
  const missionMessage = !hasStarted
    ? copy.startBody
    : mission.currentWeekVisits === 0
    ? copy.keepMoving
    : mission.activeWeeks < 2
      ? copy.streakBuilder
      : mission.activeWeeks < 4
        ? copy.arenaRegular
        : copy.activeRun
  const graceMessage = graceState === 'available'
    ? copy.graceAvailable
    : graceState === 'protecting'
      ? copy.graceProtecting
      : graceState === 'used'
        ? copy.graceRecovered
        : ''
  const joinLabel = !hasStarted
    ? copy.findFirstSession
    : mission.currentWeekVisits > 0
      ? copy.planNextWeek
      : copy.keepRunGoing
  const progressLabel = copy.weeks
    .replace('{current}', String(current))
    .replace('{target}', '4')
  const reminderLabel = scheduledFor
    ? copy.reminderSet.replace('{date}', formatReminderDate(scheduledFor, language))
    : hasStarted ? copy.remindWeekend : copy.remindFirstWeekend
  const visualSourceLabel = visual.source === 'achievement'
    ? copy.fromCollection
    : visual.source === 'trickster'
      ? copy.fromTricksterDeck
      : ''
  const steps = [copy.weekOne, copy.weekTwo, copy.weekThree, copy.weekFour]
    .map((label, index): { label: string; state: 'complete' | 'current' | 'locked' } => {
      const week = index + 1
      return {
        label,
        state: current >= week ? 'complete' : current === week - 1 ? 'current' : 'locked',
      }
    })

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('push_events')
      .select('scheduled_for')
      .eq('recipient_id', userId)
      .eq('event_type', 'return_reminder')
      .eq('status', 'pending')
      .is('processed_at', null)
      .gt('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.scheduled_for) setScheduledFor(data.scheduled_for)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  async function scheduleReminder() {
    setIsScheduling(true)
    setStatus('')
    const result = await onScheduleReminder()
    setIsScheduling(false)
    if (!result.ok || !result.scheduledFor) {
      setStatus(result.message || copy.reminderError)
      return
    }
    setScheduledFor(result.scheduledFor)
    setStatus(copy.reminderSet.replace('{date}', formatReminderDate(result.scheduledFor, language)))
  }

  return (
    <section className="return-mission-card" aria-labelledby="return-mission-title">
      <div className="return-mission-head">
        <span className="return-mission-saved-icon" aria-hidden="true"><Check size={20} strokeWidth={3} /></span>
        <div className="return-mission-copy">
          <h2 id="return-mission-title">{missionTitle}</h2>
          <p>{missionMessage}</p>
          {!hasStarted && <span><ShieldCheck aria-hidden="true" size={16} />{copy.startSafe}</span>}
        </div>
        <div
          aria-label={visualSourceLabel ? `${visualSourceLabel}: ${visual.title}` : copy.characterAlt}
          className="return-mission-character"
          data-source={visual.source}
          role="img"
        >
          <NextImage
            alt=""
            fill
            preload
            sizes="(max-width: 520px) 112px, 144px"
            src={visual.imageSrc}
          />
          {visualSourceLabel && <span className="return-mission-character-origin">{visualSourceLabel}</span>}
        </div>
      </div>

      <div className="return-mission-path" aria-label={progressLabel}>
        {steps.map((step, index) => (
          <div className={`return-mission-step ${step.state}`} key={`${step.label}-${index}`}>
            <span className="return-mission-node" aria-hidden="true">
              {step.state === 'complete' ? <Check size={17} strokeWidth={3} /> : step.state === 'locked' ? <LockKeyhole size={15} /> : index + 1}
            </span>
            <strong>{step.label}</strong>
          </div>
        ))}
      </div>

      {graceState !== 'hidden' && (
        <div className={`return-mission-relief ${graceState}`} role={graceState === 'protecting' ? 'status' : undefined}>
          <ShieldCheck aria-hidden="true" size={18} />
          <span>{graceMessage}</span>
        </div>
      )}

      <div className="return-mission-meta">
        <CalendarCheck2 aria-hidden="true" size={18} />
        <span>{progressLabel}</span>
      </div>

      <div className="return-mission-actions">
        <button className="primary create-button" onClick={onJoinSession} type="button">
          {joinLabel}
        </button>
        <button
          className="secondary create-button return-mission-reminder"
          disabled={isScheduling || Boolean(scheduledFor)}
          onClick={() => void scheduleReminder()}
          type="button"
        >
          {scheduledFor ? <Check aria-hidden="true" size={18} /> : <BellRing aria-hidden="true" size={18} />}
          <span>{isScheduling ? '…' : reminderLabel}</span>
        </button>
      </div>
      {status && <p className="return-mission-status" aria-live="polite" role="status">{status}</p>}
    </section>
  )
}
