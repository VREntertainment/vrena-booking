'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { CalendarDays, Check, ChevronDown, ChevronUp, CircleAlert, Expand, Monitor, Plus, RotateCcw, Trophy, UsersRound, X } from 'lucide-react'
import {
  matchOrder, tournamentStandings, venueNames,
  type TeamMatch, type TieBreak, type TournamentCommand, type TournamentDetail, type TournamentFormat, type TournamentOptions, type TournamentTeam,
  type TournamentVenue,
} from '../../../lib/staff/tournaments'
import { tournamentCopy, type TournamentCopy } from './copy'
import type { TournamentGateway } from './data'
import TournamentBracket, { emptyMotion, tournamentMotion, type TVMotion } from './TournamentBracket'
import styles from './TournamentWorkspace.module.css'

type View = 'day' | 'teams' | 'results' | 'setup'
type MatchFilter = TeamMatch['status']
type ActionDialog = { kind: 'schedule' | 'result' | 'reset'; match: TeamMatch }
type Label = TournamentCopy
const counts = (matches: TeamMatch[]) => {
  const played = matches.filter(match => match.outcome !== 'bye')
  return { total: played.length, complete: played.filter(match => match.status === 'completed' && !match.review).length }
}

function timeLabel(match: TeamMatch, text: Label, language: 'en' | 'vi') {
  if (!match.match_date || !match.start_time || !match.arena_number) return text.unscheduled
  const date = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(match.match_date + 'T00:00:00Z'))
  return date + ' · ' + match.start_time.slice(0, 5) + ' · ' + text.arena + ' ' + match.arena_number
}

function teamLabel(teams: TournamentTeam[], match: TeamMatch, side: 'a' | 'b', text: Label) {
  const team = teams.find(item => item.id === match['team_' + side as 'team_a' | 'team_b'])
  return team?.name ?? (match.outcome === 'bye' ? text.bye : text.waiting)
}

function roundLabel(round: number, lastRound: number, format: TournamentFormat, text: Label) {
  if (format === 'single_elimination') {
    if (round === lastRound) return text.final
    if (round === lastRound - 1) return text.semi
    if (round === lastRound - 2) return text.quarters
  }
  return text.round + ' ' + round
}

function outcomeLabel(match: TeamMatch, text: Label) {
  if (match.outcome === 'bye') return text.bye
  if (match.outcome === 'forfeit') return text.forfeit
  if (match.outcome === 'no_show') return text.noShow
  return match.status === 'completed' ? text.completed : match.status === 'in_progress' ? text.active : text.upcoming
}

function errorText(cause: unknown) { return cause instanceof Error ? cause.message : String(cause) }

export default function TournamentWorkspace({ gateway, language, manager, canOperate, initialId = null, initialTV = false }: {
  gateway: TournamentGateway; language: 'en' | 'vi'; manager: boolean; canOperate: boolean; initialId?: string | null; initialTV?: boolean
}) {
  const text = tournamentCopy[language]
  const [options, setOptions] = useState<TournamentOptions | null>(null)
  const [id, setId] = useState(initialId)
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [view, setView] = useState<View>('day')
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('scheduled')
  const [creating, setCreating] = useState(false)
  const [dialog, setDialog] = useState<ActionDialog | null>(null)
  const [tv, setTV] = useState(initialTV)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [motion, setMotion] = useState(emptyMotion)
  const pending = useRef(false)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    let active = true
    gateway.list().then(list => {
      if (!active) return
      setOptions(list)
      setId(current => current ?? list.tournaments[0]?.id ?? null)
    }).catch(cause => { if (active) setError(errorText(cause)) })
    return () => { active = false }
  }, [gateway])

  useEffect(() => {
    if (!id) return
    let active = true
    let last: TournamentDetail | null = null
    let settle: ReturnType<typeof setTimeout> | undefined
    const load = () => gateway.detail(id).then(value => {
      if (!active || (last && last.tournament.version >= value.tournament.version)) return
      if (tv) {
        if (settle) clearTimeout(settle)
        setMotion(last ? tournamentMotion(last, value) : emptyMotion)
        settle = setTimeout(() => setMotion(emptyMotion), 1600)
        setError('')
      }
      last = value
      setDetail(current => current?.tournament.id === id && current.tournament.version > value.tournament.version ? current : value)
    }).catch(cause => {
      if (!active) return
      if (tv) { setDetail(null); last = null }
      setError(errorText(cause))
    })
    void load()
    const timer = tv ? window.setInterval(() => void load(), 8000) : undefined
    return () => {
      active = false
      if (timer !== undefined) window.clearInterval(timer)
      if (settle) clearTimeout(settle)
    }
  }, [gateway, id, tv])

  const event = detail?.tournament.id === id ? detail : null
  async function change(command: TournamentCommand) {
    if (pending.current) return false
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const result = await gateway.write(command.action === 'create' ? null : id, event?.tournament.version ?? null, command)
      setDetail(result)
      if (command.action === 'create') {
        setOptions(current => current ? { ...current, tournaments: [result.tournament, ...current.tournaments] } : null)
        setCreating(false)
        setView('setup')
        setId(result.tournament.id)
      }
      if (command.action === 'start') setMatchFilter('in_progress')
      if (command.action === 'result') setMatchFilter('completed')
      setDialog(null)
      return true
    } catch (cause) {
      setError(errorText(cause))
      return false
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  async function refresh() {
    if (!id || pending.current) return
    setError('')
    try { setDetail(await gateway.detail(id)) } catch (cause) { setError(errorText(cause)) }
  }

  const total = event ? counts(event.matches) : { total: 0, complete: 0 }
  const progress = total.total ? total.complete / total.total : 0
  const complete = total.total > 0 && progress === 1
  const game = event && options?.games.find(item => item.slug === event.tournament.game_slug)?.name
  const standings = event && event.tournament.format === 'round_robin' ? tournamentStandings(event.teams, event.matches, event.tournament.tie_break) : null
  const final = event && event.tournament.format === 'single_elimination' && event.matches.at(-1)
  const champion = final && final.winner ? event?.teams.find(team => team.id === final.winner)?.name : standings?.[0]?.name
  const viewLabels: Record<View, string> = { day: text.matchDay, teams: text.teams, results: standings ? text.standings : text.bracket, setup: text.setup }
  const filtered = event?.matches.filter(match => match.status === matchFilter && match.outcome !== 'bye').sort(matchOrder) ?? []
  const tvHref = id ? '?' + new URLSearchParams({ tournament_tv: id }).toString() : undefined

  if (tv) return <section ref={root} className={`${styles.root} ${styles.tv}`} aria-label={text.tv}>
    <div className={styles.tvBar}><span><Image src="/brand/vrena-logo-full-dark.svg" alt="VRena" width={105} height={22} unoptimized />{text.tv}</span>
      <div>
        <button type="button" className="secondary" onClick={() => { void root.current?.requestFullscreen?.().catch(() => {}) }}><Expand size={16} />{text.fullScreen}</button>
        <button type="button" className="secondary" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); setTV(false) }}>{text.exitTV}</button>
      </div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {event ? <>
      <div className={styles.event}>
        <div><h1>{event.tournament.name}</h1><p className={styles.tvMeta}>{venueNames[event.tournament.venue_key]} · {game || event.tournament.game_slug}</p></div>
        <div className={styles.tvProgress}><strong>{total.complete} / {total.total}</strong> {text.progress}
          <progress value={total.complete} max={Math.max(total.total, 1)} aria-label={text.progress} />
        </div>
      </div>
      {complete && champion && <p className={styles.tvChampion}><Trophy size={28} />{text.champion} · {champion}</p>}
      <section>
        <h2>{text.nowNext}</h2>
        <div className={styles.tvQueues}>
          {event.matches.filter(match => !match.review && match.outcome !== 'bye' &&
            (match.status === 'in_progress' || (match.status === 'scheduled' && match.match_date && match.team_a && match.team_b)))
            .sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress') || matchOrder(a, b)).slice(0, 2).map(match =>
            <section key={match.number} data-motion={motion.matches.has(match.number) ? event.tournament.version : undefined}>
              <h3>{text.match} {match.number} · {outcomeLabel(match,text)}</h3>
              <ul><li>
                <strong>{teamLabel(event.teams, match, 'a', text)}</strong>
                <strong>{teamLabel(event.teams, match, 'b', text)}</strong>
                <small>{timeLabel(match, text, language)}</small>
              </li></ul>
            </section>
          )}
        </div>
      </section>
      <Results detail={event} text={text} language={language} motion={motion} />
    </> : !error && <p role="status">{text.loading}</p>}
  </section>

  return <section ref={root} className={styles.root} aria-label={text.tournaments}>
    <header className={styles.header}>
      <div className={styles.heading}><span className={styles.mark}><Trophy size={20} aria-hidden="true" /></span><h2>{text.tournaments}</h2></div>
      <div className={styles.headerActions}>
        {event && <button type="button" className="secondary" onClick={() => setTV(true)}><Monitor size={17} />{text.tv}</button>}
        {manager && <button type="button" className="primary" onClick={() => { setError(''); setCreating(true) }}><Plus size={17} />{text.newEvent}</button>}
      </div>
    </header>
    {error && !dialog && !creating && <div className={styles.error} role="alert"><CircleAlert size={17} />{error}{id && <button type="button" className="secondary" onClick={() => void refresh()}>{text.refresh}</button>}</div>}
    {!options && !error && <p role="status" className={styles.empty}>{text.loading}</p>}
    {options && !options.tournaments.length && !creating && <p className={styles.empty}>{text.noEvents}</p>}
    {options && options.tournaments.length > 0 && <div className={styles.eventSelect}>
      <label>{text.noTournament}<select value={id ?? ''} disabled={busy} onChange={e => {
        setId(e.target.value)
        setError('')
        setView('day')
        setMatchFilter('scheduled')
      }}>{options.tournaments.map(tournament => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></label>
      <button type="button" className="secondary" aria-label={text.refresh} onClick={() => void refresh()}><RotateCcw size={17} /></button>
    </div>}
    {event && <>
      <div className={styles.event} data-venue={event.tournament.venue_key}>
        <div><p>{venueNames[event.tournament.venue_key]} · {game || event.tournament.game_slug}</p><h3>{event.tournament.name}</h3>
          <span className={styles.eventFormat}>{event.tournament.format === 'round_robin' ? text.roundRobin : text.elimination}</span></div>
        <div className={styles.progress}>
          <strong>{total.complete}<span> / {total.total}</span></strong>
          <label htmlFor="tournament-match-progress">{text.progress}</label>
          <progress id="tournament-match-progress" value={total.complete} max={Math.max(1, total.total)} />
        </div>
      </div>
      {complete && champion && <p className={styles.champion}><Trophy size={19} />{text.champion} · <strong>{champion}</strong></p>}
      <nav className={styles.nav} aria-label={text.tournaments}>
        {(Object.keys(viewLabels) as View[]).filter(key => key !== 'setup' || manager).map(key =>
          <button type="button" key={key} aria-current={view === key ? 'page' : undefined} onClick={() => { setView(key); setError('') }}>{viewLabels[key]}</button>)}
      </nav>
      {view === 'day' && <>
        <div className={styles.dayHeader}>
          <h3>{text.matchDay}</h3>
          <button type="button" className="secondary" onClick={() => setView('teams')}><UsersRound size={16} />
            {event.teams.filter(team => team.checked_in).length}/{event.teams.length} {text.checkedCount}</button>
        </div>
        <div className={styles.seg} aria-label={text.matchDay}>
          {(['scheduled','in_progress','completed'] as MatchFilter[]).map((status, index) => <button key={status} type="button"
            aria-pressed={matchFilter === status} onClick={() => setMatchFilter(status)}>
            {[text.upcoming,text.active,text.completed][index]} <span>{event.matches.filter(match => match.status === status && match.outcome !== 'bye').length}</span>
          </button>)}
        </div>
        <div className={styles.matchGrid}>
          {filtered.map(match => <MatchCard key={match.number} detail={event} match={match} text={text} language={language} busy={busy}
            manager={manager} canOperate={canOperate} change={change} edit={(kind) => { setError(''); setDialog({ kind, match }) }} />)}
        </div>
        {!filtered.length && <p className={styles.empty}>{text.noMatches}</p>}
      </>}
      {view === 'teams' && <TeamList detail={event} text={text} editing={false} manager={manager} busy={busy} canOperate={canOperate} change={change} />}
      {view === 'results' && <Results detail={event} text={text} language={language} />}
      {view === 'setup' && manager && <>
        {event.tournament.format === 'round_robin' && <form className={styles.rules} onSubmit={form => {
          form.preventDefault()
          const value = new FormData(form.currentTarget).get('rule') as TieBreak
          void change({ action: 'rules', tie_break: value })
        }}>
          <label>{text.tieBreak}<select name="rule" key={event.tournament.id} defaultValue={event.tournament.tie_break}>
            <option value="difference">{text.difference}</option><option value="scored">{text.scored}</option>
          </select></label>
          <small>{text.seedFallback}</small><button type="submit" className="secondary" disabled={busy}>{text.saveRules}</button>
        </form>}
        <TeamList detail={event} text={text} editing manager canOperate={canOperate} busy={busy} change={change} />
        {!event.matches.length && <button type="button" className="primary" disabled={busy || event.teams.length < 2}
          onClick={async () => { if (await change({ action: 'generate' })) { setMatchFilter('scheduled'); setView(event.tournament.format === 'single_elimination' ? 'setup' : 'day') } }}>{text.generate}</button>}
        {event.matches.length > 0 && event.tournament.format === 'single_elimination' && !event.matches.some(match => match.started_at) &&
          <Results detail={event} text={text} language={language} choose={change} busy={busy} />}
        {event.matches.length > 0 && <AuditLog detail={event} text={text} language={language} />}
      </>}
      <a className={styles.tvLink} href={tvHref} target="_blank" rel="noopener">{text.newTV}</a>
    </>}
    {options && creating && <CreateDialog options={options} text={text} busy={busy} error={error}
      close={() => { setCreating(false); setError('') }} submit={change} />}
    {dialog && event && <MatchDialog key={dialog.kind + dialog.match.number} detail={event} text={text} dialog={dialog}
      busy={busy} error={error} close={() => { setDialog(null); setError('') }} submit={change}
      arenas={event.tournament.venue_key === 'cafe-des-stagiaires' ? [1] : [1, 2].filter(number => {
        const game = options?.games.find(row => row.slug === event.tournament.game_slug)
        return !game?.arena_ids?.length || game.arena_ids.includes('arena-' + number)
      })} />}
  </section>
}

function MatchCard({ detail, match, text, language, busy, manager, canOperate, change, edit }: {
  detail: TournamentDetail; match: TeamMatch; text: Label; language: 'en' | 'vi'; busy: boolean; manager: boolean; canOperate: boolean
  change: (command: TournamentCommand) => Promise<boolean>; edit: (kind: ActionDialog['kind']) => void
}) {
  const ready = Boolean(match.team_a && match.team_b && match.match_date)
  const bothChecked = detail.teams.filter(team => team.checked_in && (team.id === match.team_a || team.id === match.team_b)).length === 2
  const lastRound = detail.matches.at(-1)?.round ?? 1
  return <article className={styles.match} data-review={match.review || undefined}>
    <div className={styles.matchTop}><strong>{roundLabel(match.round, lastRound, detail.tournament.format, text)} · {text.match} {match.number}</strong>
      <span className={styles.outcome} data-active={match.status === 'in_progress' || undefined}>{match.review ? text.flagged : outcomeLabel(match, text)}</span>
    </div>
    <p className={styles.scheduleLine}><CalendarDays size={15} aria-hidden="true" />{timeLabel(match, text, language)}</p>
    <div className={styles.sides}>
      {(['a','b'] as const).map(side => {
        const id = side === 'a' ? match.team_a : match.team_b
        const score = side === 'a' ? match.score_a : match.score_b
        return <div key={side} data-winner={Boolean(id && id === match.winner && !match.review) || undefined}>
          <strong>{teamLabel(detail.teams, match, side, text)}</strong>
          {score !== null ? <b>{score}</b> : <span>{detail.teams.some(team => team.id === id && team.checked_in) && <Check size={16} aria-label={text.checked} />}</span>}
        </div>
      })}
    </div>
    {match.review ? <>
      <p className={styles.warning}><CircleAlert size={16} />{text.reviewCopy}</p>
      {manager && <button type="button" className="secondary" disabled={busy} onClick={() => edit('reset')}>{text.reopen}</button>}
    </> : <div className={styles.cardActions}>
      {match.status === 'scheduled' && <>
        {manager && <button type="button" className="secondary" disabled={busy} onClick={() => edit('schedule')}>{match.match_date ? text.reschedule : text.schedule}</button>}
        {canOperate && ready && <>
          <button type="button" className="secondary" disabled={busy} onClick={() => edit('result')}>{text.result}</button>
          <button type="button" className="primary" disabled={busy || !bothChecked} onClick={() => void change({ action: 'start', match_number: match.number })}>{text.start}</button>
        </>}
      </>}
      {match.status === 'in_progress' && canOperate && <button type="button" className="primary" disabled={busy} onClick={() => edit('result')}>{text.score}</button>}
      {match.status === 'completed' && manager && <button type="button" className="secondary" disabled={busy} onClick={() => edit('result')}>{text.correct}</button>}
    </div>}
    {match.status === 'scheduled' && canOperate && ready && !bothChecked && <small className={styles.callout}>{text.awaits}</small>}
  </article>
}

function TeamList({ detail, text, editing, manager, busy, canOperate, change }: {
  detail: TournamentDetail; text: Label; editing: boolean; manager: boolean; busy: boolean; canOperate: boolean
  change: (command: TournamentCommand) => Promise<boolean>
}) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const [rename, setRename] = useState<TournamentTeam | null>(null)
  const unlocked = editing && !detail.matches.length
  const byes = detail.matches.filter(match => detail.open_byes?.includes(match.number))
  const knockout = detail.tournament.format === 'single_elimination'
  const redraw = knockout && detail.matches.length > 0 && !byes.length && !detail.matches.some(match => match.started_at)
  const reserve = knockout && detail.matches.length > 0 && !byes.length && !redraw
  return <section className={styles.teams}>
    <h3>{text.teams}</h3>
    {manager && <button type="button" className="primary" onClick={() => { setName(''); setRename(null); setOpen(true) }}
      disabled={busy || detail.teams.length >= 16}><Plus size={15} />{text.addTeam}</button>}
    {open && <form className={styles.teamEditor} onSubmit={async event => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      const saved = await change(rename ? { action: 'rename_team', team_id: rename.id, name: name.trim() } :
        { action: 'team', name: name.trim(), bye_match: byes.length ? Number(form.get('bye')) : undefined, regenerate: redraw })
      if (saved) setOpen(false)
    }}>
      <label>{text.teamName}<input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={80} /></label>
      {!rename && byes.length > 0 && <label>{text.openingOpponent}<select name="bye">{byes.map(match =>
        <option key={match.number} value={match.number}>{teamLabel(detail.teams, match, match.team_a ? 'a' : 'b', text)} · {text.match} {match.number}</option>)}</select></label>}
      {!rename && (reserve || redraw) && <small>{reserve ? text.reserveHelp : text.redraw}</small>}
      <button type="submit" className="primary" disabled={busy}>{text.save}</button>
      <button type="button" className="secondary" onClick={() => setOpen(false)}>{text.cancel}</button>
    </form>}
    {!detail.teams.length && <p className={styles.empty}>{text.noTeams}</p>}
    <ul>{detail.teams.map(team => <li key={team.id}>
      <span className={styles.seed} aria-label={text.seed + ' ' + team.seed}>{team.seed}</span>
      <strong>{team.name}{team.reserve ? ' · ' + text.reserve : ''}</strong>
      {manager && <button type="button" className="secondary" disabled={busy} onClick={() => { setName(team.name); setRename(team); setOpen(true) }}>{text.renameTeam}</button>}
      {unlocked && <div className={styles.seedButtons}>
        <button type="button" className="secondary" disabled={busy || team.seed === 1}
          aria-label={text.seed + ' ' + (team.seed - 1) + ' · ' + team.name} onClick={() => void change({ action: 'seed', team_id: team.id, seed: team.seed - 1 })}><ChevronUp size={16} /></button>
        <button type="button" className="secondary" disabled={busy || team.seed === detail.teams.length}
          aria-label={text.seed + ' ' + (team.seed + 1) + ' · ' + team.name} onClick={() => void change({ action: 'seed', team_id: team.id, seed: team.seed + 1 })}><ChevronDown size={16} /></button>
        <button type="button" className="secondary" disabled={busy} aria-label={text.remove + ' ' + team.name}
          onClick={() => void change({ action: 'remove_team', team_id: team.id })}><X size={16} /></button>
      </div>}
      {!editing && canOperate && <button type="button" className={team.checked_in ? 'secondary' : 'primary'} disabled={busy}
        aria-label={(team.checked_in ? text.undo : text.checkIn) + ' · ' + team.name}
        onClick={() => void change({ action: 'check_in', team_id: team.id, checked_in: !team.checked_in })}>
        {team.checked_in && <Check size={16} />}{team.checked_in ? text.checked : text.checkIn}
      </button>}
      {!editing && !canOperate && team.checked_in && <span>{text.checked}</span>}
    </li>)}</ul>
  </section>
}

function Results({ detail, text, language, choose, busy, motion = emptyMotion }: {
  detail: TournamentDetail; text: Label; language: 'en' | 'vi';
  choose?: (command: TournamentCommand) => Promise<boolean>; busy?: boolean; motion?: TVMotion
}) {
  const last = detail.matches.at(-1)?.round ?? 0
  if (!last) return <p className={styles.empty}>{text.noMatches}</p>
  if (detail.tournament.format === 'round_robin') return <section className={styles.results}>
    <h3>{text.standings}</h3>
    <div className={styles.tableWrap}><table>
      <thead><tr>{[text.rank,text.team,text.played,text.wins,text.draws,text.losses,text.scoreFor,text.scoreAgainst,text.diff,text.points].map(name => <th key={name} scope="col">{name}</th>)}</tr></thead>
      <tbody>{tournamentStandings(detail.teams, detail.matches, detail.tournament.tie_break).map((team, index) =>
        <tr key={team.id} data-motion={motion.teams.has(team.id) ? detail.tournament.version : undefined}><td>{index + 1}</td><th scope="row">{team.name}</th><td>{team.played}</td><td>{team.wins}</td><td>{team.draws}</td><td>{team.losses}</td>
          <td>{team.scored}</td><td>{team.against}</td><td>{team.difference}</td><td><strong>{team.points}</strong></td></tr>)}</tbody>
    </table></div>
  </section>
  return <section className={styles.results}>
    <h3>{text.bracket}</h3>
    <TournamentBracket detail={detail} text={text} choose={choose} busy={busy} motion={motion}
      labels={round => roundLabel(round, last, detail.tournament.format, text)} date={match => match.outcome === 'bye' ? text.bye : timeLabel(match,text,language)} />
  </section>
}

function AuditLog({ detail, text, language }: { detail: TournamentDetail; text: Label; language: 'en' | 'vi' }) {
  const date = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
  return <section className={styles.audit}><h3>{text.corrections}</h3>
    {!detail.audit.length ? <p>{text.noChanges}</p> : <ul>{detail.audit.map(row => <li key={row.id}>
      <strong>{text.match} {row.match_number} · {row.action === 'reset' ? text.reset : text.changed}</strong>
      <p>{row.actor} · {date.format(new Date(row.changed_at))}</p>
      <p>{row.before.score_a ?? '–'} : {row.before.score_b ?? '–'} → {row.after.score_a ?? '–'} : {row.after.score_b ?? '–'}</p>
      <p>{row.reason}</p>
    </li>)}</ul>}
  </section>
}

function DialogFrame({ title, busy, close, children }: { title: string; busy: boolean; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current?.showModal()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [])
  return <dialog ref={ref} className={styles.dialog} aria-label={title}
    onCancel={event => { event.preventDefault(); if (!busy) close() }}>
    <div className={styles.dialogHead}><h3>{title}</h3>
      <button type="button" className="secondary" disabled={busy} aria-label="Close" onClick={close}><X size={19} /></button></div>
    {children}
  </dialog>
}

function CreateDialog({ options, text, busy, error, close, submit }: {
  options: TournamentOptions; text: Label; busy: boolean; error: string; close: () => void
  submit: (command: TournamentCommand) => Promise<boolean>
}) {
  const [venue, setVenue] = useState<TournamentVenue | ''>(options.venues[0]?.venue_key ?? '')
  const [format, setFormat] = useState<TournamentFormat>('single_elimination')
  const games = options.games.filter(game => venue && game.venue_keys?.includes(venue))
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!venue) return
    const fields = new FormData(event.currentTarget)
    void submit({ action: 'create', name: String(fields.get('name')).trim(), venue_key: venue, game_slug: String(fields.get('game')),
      format, tie_break: (fields.get('tie') ?? 'difference') as TieBreak })
  }
  return <DialogFrame title={text.newEvent} busy={busy} close={close}>
    <form onSubmit={save}><fieldset disabled={busy}>
      <label>{text.eventName}<input required name="name" minLength={2} maxLength={100} /></label>
      <label>{text.venue}<select required value={venue} onChange={event => setVenue(event.target.value as TournamentVenue)}>
        {!options.venues.length && <option value="">—</option>}
        {options.venues.map(item => <option key={item.venue_key} value={item.venue_key}>{item.name}</option>)}
      </select></label>
      <label>{text.game}<select name="game" key={venue} required defaultValue={games.find(game => game.slug === 'laser-tag')?.slug ?? games[0]?.slug ?? ''}>
        {!games.length && <option value="">{text.gameUnavailable}</option>}
        {games.map(game => <option key={game.slug} value={game.slug}>{game.name}</option>)}
      </select></label>
      <label>{text.format}<select value={format} onChange={event => setFormat(event.target.value as TournamentFormat)}>
        <option value="single_elimination">{text.elimination}</option><option value="round_robin">{text.roundRobin}</option>
      </select></label>
      {format === 'round_robin' && <label>{text.tieBreak}<select name="tie" defaultValue="difference">
        <option value="difference">{text.difference}</option><option value="scored">{text.scored}</option>
      </select></label>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.dialogActions}><button type="button" className="secondary" onClick={close}>{text.cancel}</button>
        <button type="submit" className="primary" disabled={!venue || !games.length}>{text.create}</button></div>
    </fieldset></form>
  </DialogFrame>
}

function MatchDialog({ detail, text, dialog, busy, error, close, submit, arenas }: {
  detail: TournamentDetail; text: Label; dialog: ActionDialog; busy: boolean; error: string; close: () => void; arenas: number[]
  submit: (command: TournamentCommand) => Promise<boolean>
}) {
  const { kind, match } = dialog
  const scoreAllowed = match.status !== 'scheduled'
  const [outcome, setOutcome] = useState<'score' | 'forfeit' | 'no_show'>(scoreAllowed ? (match.outcome === 'forfeit' || match.outcome === 'no_show' ? match.outcome : 'score') : 'no_show')
  const isCorrection = match.status === 'completed'
  const title = kind === 'schedule' ? (match.match_date ? text.reschedule : text.schedule)
    : kind === 'reset' ? text.reopen : isCorrection ? text.correct : scoreAllowed ? text.score : text.result
  const reason = kind === 'reset' || (kind === 'result' && isCorrection)
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const match_number = match.number
    if (kind === 'schedule') {
      void submit({ action: 'schedule', match_number, match_date: String(fields.get('date')), start_time: String(fields.get('time')),
        arena_number: Number(fields.get('arena')), duration: Number(fields.get('duration')) })
    } else if (kind === 'reset') {
      void submit({ action: 'reset', match_number, reason: String(fields.get('reason')).trim() })
    } else {
      void submit({ action: 'result', match_number, outcome, reason: reason ? String(fields.get('reason')).trim() : undefined,
        ...(outcome === 'score' ? { score_a: Number(fields.get('a')), score_b: Number(fields.get('b')) }
          : { winner_side: fields.get('winner') as 'a' | 'b' }) })
    }
  }
  const a = teamLabel(detail.teams, match, 'a', text), b = teamLabel(detail.teams, match, 'b', text)
  return <DialogFrame title={title} busy={busy} close={close}>
    <form onSubmit={save}><fieldset disabled={busy}>
      <p className={styles.dialogMatch}>{text.match} {match.number} · {a} / {b}</p>
      {kind === 'schedule' && <div className={styles.formGrid}>
        <label>{text.date}<input type="date" name="date" required defaultValue={match.match_date ?? new Intl.DateTimeFormat('sv-SE',{ timeZone:'Asia/Ho_Chi_Minh' }).format()} /></label>
        <label>{text.time}<input type="time" name="time" required defaultValue={match.start_time?.slice(0, 5) ?? ''} /></label>
        <label>{text.arena}<select name="arena" required defaultValue={match.arena_number ?? arenas[0]}>{arenas.map(arena => <option key={arena} value={arena}>{text.arena} {arena}</option>)}</select></label>
        <label>{text.duration}<input name="duration" type="number" min={5} max={240} required defaultValue={match.duration ?? 30} /></label>
      </div>}
      {kind === 'result' && <>
        <label>{text.resultType}<select value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)}>
          {scoreAllowed && <option value="score">{text.scoreType}</option>}<option value="forfeit">{text.forfeit}</option><option value="no_show">{text.noShow}</option>
        </select></label>
        {outcome === 'score' ? <div className={styles.formGrid}>
          <label>{a}<input name="a" type="number" inputMode="numeric" min={0} max={999} required defaultValue={match.score_a ?? undefined} /></label>
          <label>{b}<input name="b" type="number" inputMode="numeric" min={0} max={999} required defaultValue={match.score_b ?? undefined} /></label>
        </div> : <label>{text.winner}<select name="winner" required defaultValue={match.winner === match.team_a ? 'a' : match.winner === match.team_b ? 'b' : ''}>
          <option value="">—</option><option value="a">{a}</option><option value="b">{b}</option>
        </select></label>}
      </>}
      {kind === 'reset' && <p>{text.reviewCopy}</p>}
      {reason && <label>{text.reason}<textarea name="reason" required minLength={3} maxLength={300} rows={3} /></label>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.dialogActions}>
        {kind === 'schedule' && match.match_date && <button type="button" className="secondary"
          onClick={() => void submit({ action: 'unschedule', match_number: match.number })}>{text.unschedule}</button>}
        <button type="button" className="secondary" onClick={close}>{text.cancel}</button>
        <button type="submit" className="primary" disabled={kind === 'schedule' && !arenas.length}>{kind === 'result' ? text.confirm : text.save}</button>
      </div>
    </fieldset></form>
  </DialogFrame>
}
