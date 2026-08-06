'use client'

import NextImage from 'next/image'
import { BellRing, CalendarCheck2, Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { LanguageCode } from '../lib/i18n/languages'
import type { PlayerReturnMission } from '../lib/playerReturnMission'
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
}

type ReturnMissionCopy = {
  activeRun: string
  arenaRegular: string
  characterAlt: string
  findFirstSession: string
  graceAfterStart: string
  graceReady: string
  graceUsed: string
  joinSession: string
  keepMoving: string
  keepRunGoing: string
  planNextWeek: string
  reminderError: string
  remindFirstWeekend: string
  reminderSet: string
  remindWeekend: string
  runSaved: string
  safeProgress: string
  startBody: string
  startSafe: string
  startTitle: string
  streakBuilder: string
  weekFour: string
  weekOne: string
  weekTwo: string
  weeks: string
}

const returnMissionCopy: Record<LanguageCode, ReturnMissionCopy> = {
  en: {
    activeRun: 'Your Arena Regular run is active.',
    arenaRegular: 'Keep your run going to unlock Arena Regular.',
    characterAlt: 'Wild West cowboy',
    findFirstSession: 'Find my first session',
    graceAfterStart: 'Grace after start',
    graceReady: 'Grace week ready',
    graceUsed: 'Grace week used',
    joinSession: 'Join a session',
    keepMoving: 'One visit this week keeps your run moving.',
    keepRunGoing: 'Keep my run going',
    planNextWeek: 'Plan next week',
    reminderError: 'Could not set the reminder. Try again.',
    remindFirstWeekend: 'Remind me this weekend',
    reminderSet: 'Reminder set for {date}',
    remindWeekend: 'Remind me next weekend',
    runSaved: '{game} run saved',
    safeProgress: 'One grace week protects your progress.',
    startBody: 'Check in to your first session to begin your weekly path.',
    startSafe: 'Your run starts after your first checked-in visit.',
    startTitle: 'Start your VRena run',
    streakBuilder: 'Come back next week to unlock Streak Builder.',
    weekFour: 'Week 4',
    weekOne: 'Week 1',
    weekTwo: 'Week 2',
    weeks: '{current} of {target} weeks',
  },
  vi: {
    activeRun: 'Chuỗi Khách quen đấu trường đang hoạt động.',
    arenaRegular: 'Duy trì chuỗi để mở khóa Khách quen đấu trường.',
    characterAlt: 'Cao bồi Wild West',
    findFirstSession: 'Tìm phiên đầu tiên',
    graceAfterStart: 'Tuần nghỉ sau khi bắt đầu',
    graceReady: 'Tuần nghỉ sẵn sàng',
    graceUsed: 'Đã dùng tuần nghỉ',
    joinSession: 'Tham gia phiên',
    keepMoving: 'Một lượt chơi tuần này sẽ giữ chuỗi của bạn.',
    keepRunGoing: 'Tiếp tục chuỗi',
    planNextWeek: 'Lên kế hoạch tuần tới',
    reminderError: 'Không thể đặt lời nhắc. Vui lòng thử lại.',
    remindFirstWeekend: 'Nhắc tôi cuối tuần này',
    reminderSet: 'Đã nhắc vào {date}',
    remindWeekend: 'Nhắc tôi cuối tuần tới',
    runSaved: 'Đã lưu lượt {game}',
    safeProgress: 'Một tuần nghỉ sẽ bảo vệ tiến trình của bạn.',
    startBody: 'Check-in phiên đầu tiên để bắt đầu hành trình hàng tuần.',
    startSafe: 'Chuỗi bắt đầu sau lượt check-in đầu tiên.',
    startTitle: 'Bắt đầu hành trình VRena',
    streakBuilder: 'Quay lại tuần tới để mở khóa Chuỗi bền bỉ.',
    weekFour: 'Tuần 4',
    weekOne: 'Tuần 1',
    weekTwo: 'Tuần 2',
    weeks: '{current}/{target} tuần',
  },
  ko: {
    activeRun: '아레나 단골 연속 기록이 진행 중입니다.', arenaRegular: '연속 기록을 이어 아레나 단골을 잠금 해제하세요.', characterAlt: 'Wild West 카우보이', findFirstSession: '첫 세션 찾기', graceAfterStart: '시작 후 휴식 주', graceReady: '휴식 주 준비됨', graceUsed: '휴식 주 사용됨', joinSession: '세션 참가', keepMoving: '이번 주 한 번 방문하면 기록이 이어집니다.', keepRunGoing: '연속 기록 이어가기', planNextWeek: '다음 주 계획', reminderError: '알림을 설정하지 못했습니다. 다시 시도하세요.', remindFirstWeekend: '이번 주말에 알림', reminderSet: '{date} 알림 설정됨', remindWeekend: '다음 주말에 알림', runSaved: '{game} 기록 저장됨', safeProgress: '한 번의 휴식 주가 진행 상황을 보호합니다.', startBody: '첫 세션에 체크인하고 주간 여정을 시작하세요.', startSafe: '첫 체크인 방문 후 기록이 시작됩니다.', startTitle: 'VRena 여정 시작', streakBuilder: '다음 주에 돌아와 연속 플레이를 잠금 해제하세요.', weekFour: '4주 차', weekOne: '1주 차', weekTwo: '2주 차', weeks: '{current}/{target}주',
  },
  ja: {
    activeRun: 'アリーナ常連へのランが進行中です。', arenaRegular: 'ランを続けてアリーナ常連を解除しよう。', characterAlt: 'Wild Westのカウボーイ', findFirstSession: '最初のセッションを探す', graceAfterStart: '開始後にお休み週', graceReady: 'お休み週あり', graceUsed: 'お休み週使用済み', joinSession: 'セッションに参加', keepMoving: '今週あと1回来店するとランを維持できます。', keepRunGoing: 'ランを続ける', planNextWeek: '来週を計画', reminderError: 'リマインダーを設定できませんでした。', remindFirstWeekend: '今週末に通知', reminderSet: '{date}に通知します', remindWeekend: '次の週末に通知', runSaved: '{game}の記録を保存しました', safeProgress: '1回のお休み週で進捗を守れます。', startBody: '最初のセッションにチェックインして週間ランを始めよう。', startSafe: '最初のチェックイン後にランが始まります。', startTitle: 'VRenaランを始める', streakBuilder: '来週戻って連続プレイを解除しよう。', weekFour: '4週目', weekOne: '1週目', weekTwo: '2週目', weeks: '{current}/{target}週',
  },
  fr: {
    activeRun: 'Ta série Habitué de l’arène est active.', arenaRegular: 'Continue pour débloquer Habitué de l’arène.', characterAlt: 'Cow-boy de Wild West', findFirstSession: 'Trouver ma première session', graceAfterStart: 'Joker après le départ', graceReady: 'Semaine joker prête', graceUsed: 'Semaine joker utilisée', joinSession: 'Rejoindre une session', keepMoving: 'Une visite cette semaine maintient ta série.', keepRunGoing: 'Continuer ma série', planNextWeek: 'Planifier la semaine prochaine', reminderError: 'Impossible de programmer le rappel. Réessaie.', remindFirstWeekend: 'Me rappeler ce week-end', reminderSet: 'Rappel prévu le {date}', remindWeekend: 'Me rappeler le week-end prochain', runSaved: 'Partie {game} enregistrée', safeProgress: 'Une semaine joker protège ta progression.', startBody: 'Valide ta première session pour lancer ton parcours hebdomadaire.', startSafe: 'Ta série commence après ta première visite validée.', startTitle: 'Commence ton parcours VRena', streakBuilder: 'Reviens la semaine prochaine pour débloquer Série en cours.', weekFour: 'Semaine 4', weekOne: 'Semaine 1', weekTwo: 'Semaine 2', weeks: '{current} sur {target} semaines',
  },
  de: {
    activeRun: 'Deine Arena-Stammgast-Serie läuft.', arenaRegular: 'Bleib dran und schalte Arena-Stammgast frei.', characterAlt: 'Wild-West-Cowboy', findFirstSession: 'Erste Session finden', graceAfterStart: 'Pause nach dem Start', graceReady: 'Pausenwoche bereit', graceUsed: 'Pausenwoche genutzt', joinSession: 'Session beitreten', keepMoving: 'Ein Besuch diese Woche hält deine Serie am Laufen.', keepRunGoing: 'Serie fortsetzen', planNextWeek: 'Nächste Woche planen', reminderError: 'Erinnerung konnte nicht gesetzt werden.', remindFirstWeekend: 'Dieses Wochenende erinnern', reminderSet: 'Erinnerung für {date}', remindWeekend: 'Nächstes Wochenende erinnern', runSaved: '{game}-Runde gespeichert', safeProgress: 'Eine Pausenwoche schützt deinen Fortschritt.', startBody: 'Checke in deine erste Session ein und starte deinen Wochenpfad.', startSafe: 'Deine Serie beginnt nach deinem ersten Check-in.', startTitle: 'Starte deinen VRena-Lauf', streakBuilder: 'Komm nächste Woche zurück und schalte Serienmacher frei.', weekFour: 'Woche 4', weekOne: 'Woche 1', weekTwo: 'Woche 2', weeks: '{current} von {target} Wochen',
  },
  it: {
    activeRun: 'La tua serie Abituale dell’arena è attiva.', arenaRegular: 'Continua per sbloccare Abituale dell’arena.', characterAlt: 'Cowboy di Wild West', findFirstSession: 'Trova la prima sessione', graceAfterStart: 'Jolly dopo l’inizio', graceReady: 'Settimana jolly pronta', graceUsed: 'Settimana jolly usata', joinSession: 'Partecipa a una sessione', keepMoving: 'Una visita questa settimana mantiene attiva la serie.', keepRunGoing: 'Continua la serie', planNextWeek: 'Pianifica la prossima settimana', reminderError: 'Impossibile impostare il promemoria. Riprova.', remindFirstWeekend: 'Ricordamelo questo weekend', reminderSet: 'Promemoria per {date}', remindWeekend: 'Ricordamelo il prossimo weekend', runSaved: 'Partita {game} salvata', safeProgress: 'Una settimana jolly protegge i tuoi progressi.', startBody: 'Fai check-in alla prima sessione per iniziare il percorso settimanale.', startSafe: 'La serie inizia dopo la prima visita con check-in.', startTitle: 'Inizia il percorso VRena', streakBuilder: 'Torna la prossima settimana per sbloccare Serie in crescita.', weekFour: 'Settimana 4', weekOne: 'Settimana 1', weekTwo: 'Settimana 2', weeks: '{current} di {target} settimane',
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
}: PlayerReturnMissionCardProps) {
  const copy = returnMissionCopy[language] ?? returnMissionCopy.en
  const [isScheduling, setIsScheduling] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')
  const [status, setStatus] = useState('')
  const hasStarted = Boolean(mission.latestSession)
  const current = Math.min(mission.activeWeeks, mission.targetWeeks)
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
  const supportMessage = hasStarted ? copy.safeProgress : copy.startSafe
  const joinLabel = !hasStarted
    ? copy.findFirstSession
    : mission.currentWeekVisits > 0
      ? copy.planNextWeek
      : copy.keepRunGoing
  const progressLabel = copy.weeks
    .replace('{current}', String(current))
    .replace('{target}', String(mission.targetWeeks))
  const reminderLabel = scheduledFor
    ? copy.reminderSet.replace('{date}', formatReminderDate(scheduledFor, language))
    : hasStarted ? copy.remindWeekend : copy.remindFirstWeekend
  const steps = useMemo(() => [
    { label: copy.weekOne, state: current >= 1 ? 'complete' : 'current' },
    { label: copy.weekTwo, state: current >= 2 ? 'complete' : current === 1 ? 'current' : 'locked' },
    { label: hasStarted ? mission.graceAvailable ? copy.graceReady : copy.graceUsed : copy.graceAfterStart, state: hasStarted ? 'grace' : 'locked' },
    { label: copy.weekFour, state: current >= 4 ? 'complete' : current === 3 ? 'current' : 'locked' },
  ] as const, [copy, current, hasStarted, mission.graceAvailable])

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
          <span><ShieldCheck aria-hidden="true" size={16} />{supportMessage}</span>
        </div>
        <div className="return-mission-character" aria-label={copy.characterAlt} role="img">
          <NextImage
            alt=""
            fill
            priority
            sizes="(max-width: 520px) 112px, 144px"
            src="/retention/wild-west-cowboy.png"
          />
        </div>
      </div>

      <div className="return-mission-path" aria-label={progressLabel}>
        {steps.map((step, index) => (
          <div className={`return-mission-step ${step.state}`} key={`${step.label}-${index}`}>
            <span className="return-mission-node" aria-hidden="true">
              {step.state === 'complete' ? <Check size={17} strokeWidth={3} /> : step.state === 'grace' ? <ShieldCheck size={17} /> : step.state === 'locked' ? <LockKeyhole size={15} /> : index + 1}
            </span>
            <strong>{step.label}</strong>
          </div>
        ))}
      </div>

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
